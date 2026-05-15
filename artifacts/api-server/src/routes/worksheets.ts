import { Router, type IRouter } from "express";
import { db, worksheetsTable, teachersTable } from "@workspace/db";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { awardXpInTxAndNotifyAfterCommit } from "../lib/xp/socket";
import { reverseXpIfWithinWindow } from "../lib/xp/engine";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveTier, modelForTier, isClaudeTier, type AiTier } from "../lib/ai-tier";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";
import {
  createUploadFilesMiddleware,
  processUploadedFiles,
  runVisionCompletionMulti,
} from "../lib/file-upload";

const router: IRouter = Router();

/* ── File upload middleware (multi-file). Tier-aware caps are enforced
   inside the route handler via `processUploadedFiles` after we look up
   the teacher's admin status. */
const uploadFiles = createUploadFilesMiddleware();

/* ── Local AI completion helper (mirrors wheel.ts / presentations.ts).
   Routes one prompt to Anthropic (claude tier) or OpenAI (other tiers)
   and returns the raw text response. */
async function runTierCompletion(opts: {
  tier: AiTier;
  prompt: string;
  maxTokens: number;
  system?: string;
}): Promise<string> {
  if (isClaudeTier(opts.tier)) {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: opts.maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.prompt }],
    });
    const block = response.content.find((c) => c.type === "text");
    return block && "text" in block ? block.text : "";
  }
  const completion = await openai.chat.completions.create({
    model: modelForTier(opts.tier),
    max_completion_tokens: opts.maxTokens,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: opts.prompt },
    ],
  });
  return completion.choices[0]?.message?.content || "";
}

/* ── Question schema — discriminated by `type`. Each variant constrains
   the fields that make sense for it; this is shared by the create AND
   AI-generate endpoints so AI output is held to the same standard as
   manual entry. */
// Note: cross-field validation (correctIndex < options.length) lives on the
// array via `.superRefine` below — discriminatedUnion requires plain ZodObjects,
// not ZodEffects, so we cannot `.refine` here.
const mcqSchema = z.object({
  id: z.string().min(1),
  type: z.literal("mcq"),
  prompt: z.string().min(1).max(1000),
  options: z.array(z.string().min(1).max(300)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  points: z.number().int().min(0).max(100).optional(),
});

const trueFalseSchema = z.object({
  id: z.string().min(1),
  type: z.literal("true_false"),
  prompt: z.string().min(1).max(1000),
  correct: z.boolean(),
  points: z.number().int().min(0).max(100).optional(),
});

const shortAnswerSchema = z.object({
  id: z.string().min(1),
  type: z.literal("short_answer"),
  prompt: z.string().min(1).max(1000),
  lines: z.number().int().min(1).max(20).default(2),
  answer: z.string().max(800).optional(),
  points: z.number().int().min(0).max(100).optional(),
});

const fillBlankSchema = z.object({
  id: z.string().min(1),
  type: z.literal("fill_blank"),
  // The prompt should contain "____" where the blank goes; the worksheet
  // renderer just shows the prompt as-is. The `answer` is what fills the blank.
  prompt: z.string().min(1).max(1000),
  answer: z.string().min(1).max(300),
  points: z.number().int().min(0).max(100).optional(),
});

const matchingSchema = z.object({
  id: z.string().min(1),
  type: z.literal("matching"),
  prompt: z.string().max(500).optional(),
  pairs: z.array(z.object({
    left: z.string().min(1).max(200),
    right: z.string().min(1).max(200),
  })).min(2).max(10),
  points: z.number().int().min(0).max(100).optional(),
});

const questionSchema = z.discriminatedUnion("type", [
  mcqSchema,
  trueFalseSchema,
  shortAnswerSchema,
  fillBlankSchema,
  matchingSchema,
]);

const questionsArraySchema = z.array(questionSchema).min(1).max(60).superRefine((arr, ctx) => {
  arr.forEach((q, i) => {
    if (q.type === "mcq" && q.correctIndex >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, "correctIndex"],
        message: "correctIndex must be within options",
      });
    }
  });
});

const settingsSchema = z.object({
  instructions: z.string().max(2000).optional(),
  includeName: z.boolean().default(true),
  includeDate: z.boolean().default(true),
  includeClass: z.boolean().default(true),
  includeAnswerKey: z.boolean().default(false),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  headerNote: z.string().max(300).optional(),
  footerNote: z.string().max(300).optional(),
  // Header identity fields (school / section / teacher name) printed at
  // the top of the worksheet so a single class can reuse the same
  // header across many printouts.
  schoolName: z.string().max(200).optional(),
  section: z.string().max(100).optional(),
  teacherName: z.string().max(100).optional(),
  // Typography controls — let the teacher pick their font and base size.
  fontFamily: z.enum(["default", "cairo", "tajawal", "amiri", "noto-naskh", "inter", "georgia"]).default("default"),
  fontSizePt: z.number().int().min(9).max(18).default(12),
  // Watermark behind worksheet content. Currently always available; once
  // billing is wired up, the frontend will hide the toggle for paid plans.
  showWatermark: z.boolean().default(true),
});

const upsertBody = z.object({
  title: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]).default("ar"),
  gradeLevel: z.string().max(50).nullish(),
  subject: z.string().max(100).nullish(),
  questions: questionsArraySchema,
  settings: settingsSchema,
});

/* ── Auth middleware (session-based). Mirrors wheel.ts. */
function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* ── List: own worksheets + admin-shared library. */
router.get("/worksheets", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const rows = await db
      .select({
        id: worksheetsTable.id,
        teacherId: worksheetsTable.teacherId,
        title: worksheetsTable.title,
        language: worksheetsTable.language,
        gradeLevel: worksheetsTable.gradeLevel,
        subject: worksheetsTable.subject,
        questions: worksheetsTable.questions,
        settings: worksheetsTable.settings,
        isShared: worksheetsTable.isShared,
        createdAt: worksheetsTable.createdAt,
        updatedAt: worksheetsTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(worksheetsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, worksheetsTable.teacherId))
      .where(or(
        eq(worksheetsTable.teacherId, teacherId),
        and(eq(worksheetsTable.isShared, true), eq(teachersTable.isAdmin, true)),
      ))
      .orderBy(desc(worksheetsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List worksheets failed");
    res.status(500).json({ message: "Failed to load worksheets" });
  }
});

/* ── Read one — own or admin-shared. */
router.get("/worksheets/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [row] = await db
      .select({
        worksheet: worksheetsTable,
        owner: teachersTable,
      })
      .from(worksheetsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, worksheetsTable.teacherId))
      .where(eq(worksheetsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const isOwner = row.worksheet.teacherId === teacherId;
    const isAdminShared = row.worksheet.isShared && row.owner.isAdmin;
    if (!isOwner && !isAdminShared) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json({ ...row.worksheet, ownerName: row.owner.name, isOwner });
  } catch (err) {
    req.log.error({ err }, "Read worksheet failed");
    res.status(500).json({ message: "Failed to load worksheet" });
  }
});

/* ── Create. */
router.post("/worksheets", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const body = upsertBody.parse(req.body);
    const { row, runAfterCommit } = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(worksheetsTable)
        .values({
          teacherId,
          title: body.title,
          language: body.language,
          gradeLevel: body.gradeLevel ?? null,
          subject: body.subject ?? null,
          questions: body.questions,
          settings: body.settings,
        })
        .returning();
      const xp = await awardXpInTxAndNotifyAfterCommit(tx, {
        teacherId,
        actionKey: "worksheet.generate",
        refId: `worksheet:${inserted.id}`,
        reason: inserted.title,
      });
      return { row: inserted, runAfterCommit: xp.runAfterCommit };
    });
    void runAfterCommit();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.issues) {
      req.log.warn({ issues: err.issues }, "Worksheet create validation failed");
      res.status(400).json({ message: "Invalid worksheet", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Create worksheet failed");
    res.status(500).json({ message: "Failed to create worksheet" });
  }
});

/* ── Update. Owner only. */
router.put("/worksheets/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const body = upsertBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(worksheetsTable)
      .where(eq(worksheetsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const [row] = await db
      .update(worksheetsTable)
      .set({
        title: body.title,
        language: body.language,
        gradeLevel: body.gradeLevel ?? null,
        subject: body.subject ?? null,
        questions: body.questions,
        settings: body.settings,
        updatedAt: new Date(),
      })
      .where(eq(worksheetsTable.id, id))
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid worksheet", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Update worksheet failed");
    res.status(500).json({ message: "Failed to update worksheet" });
  }
});

/* ── Delete. Owner only. */
router.delete("/worksheets/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(worksheetsTable)
      .where(eq(worksheetsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await db.delete(worksheetsTable).where(eq(worksheetsTable.id, id));
    // Reverse XP if deleted within 5-minute anti-abuse window (fire-and-forget)
    void reverseXpIfWithinWindow(
      teacherId,
      "worksheet.generate",
      `worksheet:${id}`,
    ).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete worksheet failed");
    res.status(500).json({ message: "Failed to delete worksheet" });
  }
});

/* ── AI generate questions. The teacher gives a topic + how many of each
   question type they want, the model returns a strict JSON shape that we
   re-validate before responding. The `pages` field is a hint for the
   model about how much content to generate (1-3 A4 pages); we also use
   it to relax per-type caps so a 3-page worksheet can have more items. */
const countsSchema = z.object({
  mcq: z.number().int().min(0).max(40).default(4),
  true_false: z.number().int().min(0).max(40).default(2),
  short_answer: z.number().int().min(0).max(40).default(2),
  fill_blank: z.number().int().min(0).max(40).default(2),
  matching: z.number().int().min(0).max(10).default(0),
});
const aiGenerateBody = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  topic: z.string().min(2).max(500),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("medium"),
  pages: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  counts: countsSchema,
});

router.post("/worksheets/ai/generate", requireTeacher, async (req, res) => {
  let language: "ar" | "en" = "ar";
  try {
    const teacherId = req.session.teacherId as number;
    const body = aiGenerateBody.parse(req.body);
    language = body.language;

    const total = body.counts.mcq + body.counts.true_false + body.counts.short_answer + body.counts.fill_blank + body.counts.matching;
    if (total === 0) {
      res.status(400).json({ message: language === "ar" ? "اختر نوع سؤال واحد على الأقل" : "Pick at least one question type" });
      return;
    }
    const maxTotal = body.pages * 30;
    if (total > maxTotal) {
      res.status(400).json({ message: language === "ar" ? `العدد الإجمالي يتجاوز ${maxTotal}` : `Total exceeds ${maxTotal} questions` });
      return;
    }

    const tier = await resolveTier(teacherId, (req.body as { tier?: string })?.tier);

    const prompt = buildWorksheetPrompt(body);
    const text = await runTierCompletion({ tier, prompt, maxTokens: 4000 + body.pages * 4000 });
    const json = parseJsonLoose(text);
    const raw = Array.isArray(json?.questions) ? json.questions : [];
    const cleaned = sanitizeGeneratedQuestions(raw, body.counts);

    const validated = questionsArraySchema.safeParse(cleaned);
    if (!validated.success) {
      req.log.warn({ issues: validated.error.issues }, "AI worksheet questions failed strict validation");
      res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح من المولّد" : "Generator returned an invalid format" });
      return;
    }
    res.json({ questions: validated.data });
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: language === "ar" ? "إدخال غير صالح" : "Invalid input", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Worksheet AI generation failed");
    res.status(500).json({ message: language === "ar" ? "تعذّر التوليد" : "Generation failed" });
  }
});

/* ── AI extract from uploaded files (image/PDF/DOCX/text). Reads the
   teacher's textbook/lesson source(s) and produces worksheet questions
   matching the requested counts. Multi-file: all images go to a single
   vision call; text from PDFs/DOCX is concatenated. Per-tier limits
   (5 files / 50MB for teachers, 25 / 200MB for admins) are enforced
   inside `processUploadedFiles`. */
router.post(
  "/worksheets/ai/extract",
  requireTeacher,
  uploadFiles,
  async (req, res) => {
    let language: "ar" | "en" = "ar";
    try {
      const teacherId = req.session.teacherId as number;
      const files = (req.files as Express.Multer.File[]) || [];

      // Parse JSON-encoded form fields (multer puts them in req.body as strings).
      // counts is JSON.parse'd from the multipart string — guard against
      // malformed JSON so the route returns 400 instead of crashing to 500.
      let parsedCounts: unknown;
      if (req.body.counts) {
        try { parsedCounts = JSON.parse(String(req.body.counts)); }
        catch {
          res.status(400).json({ message: language === "ar" ? "إدخال غير صالح" : "Invalid input (counts)" });
          return;
        }
      }
      const parsedBody = aiExtractFields.parse({
        language: req.body.language,
        subject: req.body.subject || undefined,
        gradeLevel: req.body.gradeLevel || undefined,
        difficulty: req.body.difficulty,
        pages: req.body.pages ? Number(req.body.pages) : 1,
        topicHint: req.body.topicHint || undefined,
        counts: parsedCounts,
      });
      language = parsedBody.language;

      const total = parsedBody.counts.mcq + parsedBody.counts.true_false + parsedBody.counts.short_answer + parsedBody.counts.fill_blank + parsedBody.counts.matching;
      if (total === 0) {
        res.status(400).json({ message: language === "ar" ? "اختر نوع سؤال واحد على الأقل" : "Pick at least one question type" });
        return;
      }
      const maxTotal = parsedBody.pages * 30;
      if (total > maxTotal) {
        res.status(400).json({ message: language === "ar" ? `العدد الإجمالي يتجاوز ${maxTotal}` : `Total exceeds ${maxTotal} questions` });
        return;
      }

      // Validate tier limits and normalise files into images + text.
      // `processUploadedFiles` writes the error response itself on
      // failure, so we just bail out when it returns null.
      const prepared = await processUploadedFiles(req, res, files, language);
      if (!prepared) return;

      const tier = await resolveTier(teacherId, (req.body as { tier?: string })?.tier);

      const prompt = buildExtractionPrompt({
        language: parsedBody.language,
        subject: parsedBody.subject || null,
        gradeLevel: parsedBody.gradeLevel || null,
        difficulty: parsedBody.difficulty,
        pages: parsedBody.pages,
        counts: parsedBody.counts,
        topicHint: parsedBody.topicHint || null,
        // When images are present, also pass any extracted text as
        // additional context inside the same vision request.
        sourceText: prepared.text || null,
        hasImage: prepared.images.length > 0,
      });

      const maxTokens = 4000 + parsedBody.pages * 4000;
      const text = prepared.images.length > 0
        ? await runVisionCompletionMulti({ tier, prompt, images: prepared.images, maxTokens })
        : await runTierCompletion({ tier, prompt, maxTokens });

      const json = parseJsonLoose(text);
      const raw = Array.isArray(json?.questions) ? json.questions : [];
      const cleaned = sanitizeGeneratedQuestions(raw, parsedBody.counts);

      const validated = questionsArraySchema.safeParse(cleaned);
      if (!validated.success) {
        req.log.warn({ issues: validated.error.issues }, "AI extraction questions failed strict validation");
        res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح من المولّد" : "Generator returned an invalid format" });
        return;
      }
      res.json({ questions: validated.data });
    } catch (err: any) {
      if (err?.issues) {
        res.status(400).json({ message: language === "ar" ? "إدخال غير صالح" : "Invalid input", issues: err.issues });
        return;
      }
      if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: language === "ar" ? "حجم أحد الملفات يتجاوز الحد" : "One of the files exceeds the size limit" });
        return;
      }
      req.log.error({ err }, "Worksheet AI extract failed");
      res.status(500).json({ message: language === "ar" ? "تعذّر استخراج الأسئلة" : "Extraction failed" });
    }
  },
);

const aiExtractFields = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  subject: z.string().max(100).optional(),
  gradeLevel: z.string().max(50).optional(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("medium"),
  pages: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  topicHint: z.string().max(300).optional(),
  counts: countsSchema,
});

function parseJsonLoose(text: string): any {
  // Models occasionally wrap JSON in fences or add prose; pull out the first {...}.
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* keep trying */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    try { return JSON.parse(fence[1]); } catch { /* keep trying */ }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
}

function sanitizeGeneratedQuestions(
  raw: any[],
  counts: z.infer<typeof aiGenerateBody>["counts"],
): z.infer<typeof questionSchema>[] {
  const out: z.infer<typeof questionSchema>[] = [];
  let idx = 0;
  const cap = {
    mcq: counts.mcq,
    true_false: counts.true_false,
    short_answer: counts.short_answer,
    fill_blank: counts.fill_blank,
    matching: counts.matching,
  };
  const tally = { mcq: 0, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 };

  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const type = typeof q.type === "string" ? q.type : "";
    const prompt = typeof q.prompt === "string" ? q.prompt.trim().slice(0, 1000) : "";
    if (!prompt && type !== "matching") continue;
    const id = `q_${++idx}_${Date.now().toString(36)}`;

    if (type === "mcq" && tally.mcq < cap.mcq) {
      const options = Array.isArray(q.options)
        ? q.options
            .filter((o: any) => typeof o === "string" && o.trim())
            .map((o: string) => o.trim().slice(0, 300))
            .slice(0, 6)
        : [];
      if (options.length < 2) continue;
      const correctIndex = typeof q.correctIndex === "number"
        ? Math.max(0, Math.min(options.length - 1, Math.floor(q.correctIndex)))
        : 0;
      out.push({ id, type: "mcq", prompt, options, correctIndex });
      tally.mcq++;
    } else if (type === "true_false" && tally.true_false < cap.true_false) {
      out.push({ id, type: "true_false", prompt, correct: q.correct === true });
      tally.true_false++;
    } else if (type === "short_answer" && tally.short_answer < cap.short_answer) {
      const lines = typeof q.lines === "number" ? Math.max(1, Math.min(20, Math.floor(q.lines))) : 2;
      const answer = typeof q.answer === "string" ? q.answer.trim().slice(0, 800) : undefined;
      out.push({ id, type: "short_answer", prompt, lines, answer });
      tally.short_answer++;
    } else if (type === "fill_blank" && tally.fill_blank < cap.fill_blank) {
      const answer = typeof q.answer === "string" ? q.answer.trim().slice(0, 300) : "";
      if (!answer) continue;
      // Ensure the prompt actually contains a blank marker; if not, append one.
      const promptWithBlank = prompt.includes("____") ? prompt : `${prompt} ____`;
      out.push({ id, type: "fill_blank", prompt: promptWithBlank, answer });
      tally.fill_blank++;
    } else if (type === "matching" && tally.matching < cap.matching) {
      const pairs = Array.isArray(q.pairs)
        ? q.pairs
            .filter((p: any) => p && typeof p.left === "string" && typeof p.right === "string" && p.left.trim() && p.right.trim())
            .map((p: any) => ({ left: p.left.trim().slice(0, 200), right: p.right.trim().slice(0, 200) }))
            .slice(0, 10)
        : [];
      if (pairs.length < 2) continue;
      out.push({ id, type: "matching", prompt: prompt || undefined, pairs });
      tally.matching++;
    }
  }

  return out;
}

function buildWorksheetPrompt(body: z.infer<typeof aiGenerateBody>): string {
  const { language, topic, subject, gradeLevel, difficulty, counts, pages } = body;
  const ar = language === "ar";
  const langName = ar ? "العربية" : "English";
  const subj = subject ? (ar ? `المادة: ${subject}` : `Subject: ${subject}`) : "";
  const grade = gradeLevel ? (ar ? `المرحلة الدراسية: ${gradeLevel}` : `Grade level: ${gradeLevel}`) : "";
  const pagesLine = ar ? `الحجم المستهدف: ${pages} صفحة A4.` : `Target size: ${pages} A4 page(s).`;
  const diffLabel = ar
    ? ({ easy: "سهل", medium: "متوسط", hard: "صعب", mixed: "متنوّع" } as const)[difficulty]
    : difficulty;

  const requested: string[] = [];
  if (counts.mcq > 0) requested.push(ar ? `${counts.mcq} اختيار من متعدد` : `${counts.mcq} multiple-choice`);
  if (counts.true_false > 0) requested.push(ar ? `${counts.true_false} صح أو خطأ` : `${counts.true_false} true/false`);
  if (counts.short_answer > 0) requested.push(ar ? `${counts.short_answer} إجابة قصيرة` : `${counts.short_answer} short-answer`);
  if (counts.fill_blank > 0) requested.push(ar ? `${counts.fill_blank} إكمال الفراغ` : `${counts.fill_blank} fill-in-the-blank`);
  if (counts.matching > 0) requested.push(ar ? `${counts.matching} توصيل (مع 4–6 أزواج)` : `${counts.matching} matching (with 4–6 pairs)`);

  const rules = ar
    ? [
        "أعد ردًّا بصيغة JSON نقية فقط — بدون أي شرح أو ترميز.",
        "صيغة الرد: { \"questions\": [...] }.",
        "لكل سؤال، حقل type لا بد أن يكون أحد: mcq | true_false | short_answer | fill_blank | matching.",
        "للـ mcq: options مصفوفة من 3-5 خيارات نصّية، و correctIndex فهرس صحيح بين 0 وطول options.",
        "للـ true_false: correct قيمة منطقية.",
        "للـ short_answer: prompt هو السؤال، و lines رقم بين 1 و 5، و answer هو الإجابة المُقترحة.",
        "للـ fill_blank: prompt يحتوي على \"____\" مكان الفراغ، و answer هو الكلمة الصحيحة.",
        "للـ matching: pairs مصفوفة من 4-6 أزواج {left, right}.",
        "اجعل الأسئلة دقيقة، تربوية، ومناسبة للمرحلة. تجنّب الأسئلة المتكرّرة أو المضلِّلة.",
      ]
    : [
        "Reply with strict JSON ONLY — no prose, no code fences.",
        "Reply shape: { \"questions\": [...] }.",
        "Each question's type must be one of: mcq | true_false | short_answer | fill_blank | matching.",
        "mcq: options is an array of 3–5 strings; correctIndex is an integer between 0 and options.length-1.",
        "true_false: correct is a boolean.",
        "short_answer: prompt is the question; lines is 1–5; answer is the model answer.",
        "fill_blank: prompt contains \"____\" where the blank goes; answer is the missing word/phrase.",
        "matching: pairs is an array of 4–6 {left, right} string pairs.",
        "Keep questions accurate, pedagogical, and grade-appropriate. Avoid duplicates or trick questions.",
      ];

  return [
    ar ? `أنت مساعد تربوي تُولّد أسئلة لورقة عمل باللغة ${langName}.` : `You are an educational assistant generating worksheet questions in ${langName}.`,
    ar ? `الموضوع: ${topic}` : `Topic: ${topic}`,
    subj,
    grade,
    pagesLine,
    ar ? `الصعوبة: ${diffLabel}` : `Difficulty: ${diffLabel}`,
    ar ? `المطلوب: ${requested.join("، ")}.` : `Requested: ${requested.join(", ")}.`,
    "",
    rules.join("\n"),
  ].filter(Boolean).join("\n");
}

/* ── Build the prompt for the file-extraction endpoint. Either includes
   the source text inline (PDF/DOCX/text) or instructs the model to read
   the attached image (handled by runVisionCompletion). */
function buildExtractionPrompt(opts: {
  language: "ar" | "en";
  subject: string | null;
  gradeLevel: string | null;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  pages: 1 | 2 | 3;
  counts: z.infer<typeof countsSchema>;
  topicHint: string | null;
  sourceText: string | null;
  hasImage: boolean;
}): string {
  const ar = opts.language === "ar";
  const subj = opts.subject ? (ar ? `المادة: ${opts.subject}` : `Subject: ${opts.subject}`) : "";
  const grade = opts.gradeLevel ? (ar ? `المرحلة الدراسية: ${opts.gradeLevel}` : `Grade level: ${opts.gradeLevel}`) : "";
  const hint = opts.topicHint ? (ar ? `ملاحظة من المعلم: ${opts.topicHint}` : `Teacher hint: ${opts.topicHint}`) : "";
  const pagesLine = ar ? `الحجم المستهدف: ${opts.pages} صفحة A4.` : `Target size: ${opts.pages} A4 page(s).`;
  const diffLabel = ar
    ? ({ easy: "سهل", medium: "متوسط", hard: "صعب", mixed: "متنوّع" } as const)[opts.difficulty]
    : opts.difficulty;

  const requested: string[] = [];
  const c = opts.counts;
  if (c.mcq > 0) requested.push(ar ? `${c.mcq} اختيار من متعدد` : `${c.mcq} multiple-choice`);
  if (c.true_false > 0) requested.push(ar ? `${c.true_false} صح أو خطأ` : `${c.true_false} true/false`);
  if (c.short_answer > 0) requested.push(ar ? `${c.short_answer} إجابة قصيرة` : `${c.short_answer} short-answer`);
  if (c.fill_blank > 0) requested.push(ar ? `${c.fill_blank} إكمال الفراغ` : `${c.fill_blank} fill-in-the-blank`);
  if (c.matching > 0) requested.push(ar ? `${c.matching} توصيل` : `${c.matching} matching`);

  const sourceBlock = opts.sourceText
    ? (ar ? `\nالمحتوى المصدر (المرجع لاستخراج الأسئلة):\n"""\n${opts.sourceText}\n"""\n` : `\nSource content (use to derive questions):\n"""\n${opts.sourceText}\n"""\n`)
    : (ar ? `\nاقرأ الصورة المرفقة بعناية واستخرج المفاهيم والأسئلة منها.` : `\nRead the attached image carefully and derive concepts/questions from it.`);

  const rules = ar
    ? [
        "أعد ردًّا بصيغة JSON نقية فقط — بدون أي شرح أو ترميز.",
        "صيغة الرد: { \"questions\": [...] }.",
        "لكل سؤال، حقل type لا بد أن يكون أحد: mcq | true_false | short_answer | fill_blank | matching.",
        "للـ mcq: options مصفوفة من 3-5 خيارات نصّية، و correctIndex فهرس صحيح بين 0 وطول options.",
        "للـ true_false: correct قيمة منطقية.",
        "للـ short_answer: prompt هو السؤال، و lines رقم بين 1 و 5، و answer هو الإجابة المُقترحة.",
        "للـ fill_blank: prompt يحتوي على \"____\" مكان الفراغ، و answer هو الكلمة الصحيحة.",
        "للـ matching: pairs مصفوفة من 4-6 أزواج {left, right}.",
        "اعتمد فقط على المحتوى المعطى. لا تخترع حقائق غير واردة فيه.",
      ]
    : [
        "Reply with strict JSON ONLY — no prose, no code fences.",
        "Reply shape: { \"questions\": [...] }.",
        "Each question's type must be one of: mcq | true_false | short_answer | fill_blank | matching.",
        "mcq: options is an array of 3–5 strings; correctIndex is an integer between 0 and options.length-1.",
        "true_false: correct is a boolean.",
        "short_answer: prompt is the question; lines is 1–5; answer is the model answer.",
        "fill_blank: prompt contains \"____\" where the blank goes; answer is the missing word/phrase.",
        "matching: pairs is an array of 4–6 {left, right} string pairs.",
        "Ground questions ONLY in the provided source. Do not invent facts not present.",
      ];

  return [
    ar
      ? `أنت مساعد تربوي. اقرأ المصدر التالي ثم ولّد أسئلة ورقة عمل بناءً عليه باللغة العربية.`
      : `You are an educational assistant. Read the source and derive worksheet questions in English.`,
    subj,
    grade,
    pagesLine,
    ar ? `الصعوبة: ${diffLabel}` : `Difficulty: ${diffLabel}`,
    ar ? `المطلوب: ${requested.join("، ")}.` : `Requested: ${requested.join(", ")}.`,
    hint,
    sourceBlock,
    rules.join("\n"),
  ].filter(Boolean).join("\n");
}

export default router;
