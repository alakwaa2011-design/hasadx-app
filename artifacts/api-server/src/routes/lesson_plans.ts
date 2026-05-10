import { Router, type IRouter } from "express";
import { db, lessonPlansTable, teachersTable } from "@workspace/db";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveTier, modelForTier, isClaudeTier, type AiTier } from "../lib/ai-tier";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";
import {
  createUploadFilesMiddleware,
  processUploadedFiles,
  runVisionCompletionMulti,
} from "../lib/file-upload";

const router: IRouter = Router();

/* Multi-file upload middleware (per-tier caps enforced inside the
   route handler via `processUploadedFiles`). */
const uploadFiles = createUploadFilesMiddleware();

/* ── Local AI completion helper. Same pattern as worksheets.ts / wheel.ts.
   Routes to Anthropic for claude tier, OpenAI otherwise; returns raw text. */
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

/* ── Section schemas. Each block is intentionally permissive on optional
   fields but every required `description` is bounded so AI output never
   blows up the page or sneaks in absurdly long content. */
const blockSchema = z.object({
  title: z.string().max(200).optional(),
  durationMinutes: z.number().int().min(0).max(240).optional(),
  description: z.string().min(1).max(2000),
});

const activityRefSchema = z.object({
  kind: z.enum(["assignment", "presentation", "video-lesson"]),
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
}).optional();

const activityBlockSchema = z.object({
  title: z.string().min(1).max(200),
  durationMinutes: z.number().int().min(0).max(240).optional(),
  description: z.string().min(1).max(2000),
  activityRef: activityRefSchema,
});

const vocabularyTermSchema = z.object({
  term: z.string().min(1).max(120),
  definition: z.string().max(500).optional(),
});

const sectionsSchema = z.object({
  objectives: z.array(z.string().min(1).max(400)).max(15).default([]),
  materials: z.array(z.string().min(1).max(200)).max(30).default([]),
  vocabulary: z.array(vocabularyTermSchema).max(30).default([]),
  warmUp: blockSchema,
  introduction: blockSchema,
  activities: z.array(activityBlockSchema).min(0).max(10).default([]),
  assessment: z.object({
    description: z.string().min(1).max(2000),
    method: z.string().max(200).optional(),
  }),
  closure: z.object({
    description: z.string().min(1).max(2000),
  }),
  homework: z.object({
    description: z.string().min(1).max(2000),
  }).optional(),
  differentiation: z.object({
    support: z.string().max(2000).optional(),
    extension: z.string().max(2000).optional(),
  }).optional(),
  notes: z.string().max(3000).optional(),
});

const settingsSchema = z.object({
  includeObjectives: z.boolean().default(true),
  includeMaterials: z.boolean().default(true),
  includeVocabulary: z.boolean().default(true),
  includeWarmUp: z.boolean().default(true),
  includeIntroduction: z.boolean().default(true),
  includeActivities: z.boolean().default(true),
  includeAssessment: z.boolean().default(true),
  includeClosure: z.boolean().default(true),
  includeHomework: z.boolean().default(true),
  includeDifferentiation: z.boolean().default(true),
  includeNotes: z.boolean().default(true),
  headerNote: z.string().max(300).optional(),
  footerNote: z.string().max(300).optional(),
  lessonDateGregorian: z.string().max(40).optional(),
  lessonDateHijri: z.string().max(40).optional(),
  fontFamily: z.enum(["default", "cairo", "tajawal", "amiri", "naskh", "reem", "inter", "serif", "mono"]).optional(),
  fontSizePt: z.number().min(9).max(18).optional(),
});

const upsertBody = z.object({
  title: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]).default("ar"),
  gradeLevel: z.string().max(50).nullish(),
  subject: z.string().max(100).nullish(),
  durationMinutes: z.number().int().min(5).max(240).nullish(),
  sections: sectionsSchema,
  settings: settingsSchema,
});

/* ── Auth middleware (session-based). */
function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* ── List: own plans + admin-shared library. */
router.get("/lesson-plans", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const rows = await db
      .select({
        id: lessonPlansTable.id,
        teacherId: lessonPlansTable.teacherId,
        title: lessonPlansTable.title,
        language: lessonPlansTable.language,
        gradeLevel: lessonPlansTable.gradeLevel,
        subject: lessonPlansTable.subject,
        durationMinutes: lessonPlansTable.durationMinutes,
        sections: lessonPlansTable.sections,
        settings: lessonPlansTable.settings,
        isShared: lessonPlansTable.isShared,
        createdAt: lessonPlansTable.createdAt,
        updatedAt: lessonPlansTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(lessonPlansTable)
      .innerJoin(teachersTable, eq(teachersTable.id, lessonPlansTable.teacherId))
      .where(or(
        eq(lessonPlansTable.teacherId, teacherId),
        and(eq(lessonPlansTable.isShared, true), eq(teachersTable.isAdmin, true)),
      ))
      .orderBy(desc(lessonPlansTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List lesson plans failed");
    res.status(500).json({ message: "Failed to load lesson plans" });
  }
});

/* ── Read one — own or admin-shared. */
router.get("/lesson-plans/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [row] = await db
      .select({
        plan: lessonPlansTable,
        owner: teachersTable,
      })
      .from(lessonPlansTable)
      .innerJoin(teachersTable, eq(teachersTable.id, lessonPlansTable.teacherId))
      .where(eq(lessonPlansTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const isOwner = row.plan.teacherId === teacherId;
    const isAdminShared = row.plan.isShared && row.owner.isAdmin;
    if (!isOwner && !isAdminShared) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json({ ...row.plan, ownerName: row.owner.name, isOwner });
  } catch (err) {
    req.log.error({ err }, "Read lesson plan failed");
    res.status(500).json({ message: "Failed to load lesson plan" });
  }
});

/* ── Create. */
router.post("/lesson-plans", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const body = upsertBody.parse(req.body);
    const [row] = await db
      .insert(lessonPlansTable)
      .values({
        teacherId,
        title: body.title,
        language: body.language,
        gradeLevel: body.gradeLevel ?? null,
        subject: body.subject ?? null,
        durationMinutes: body.durationMinutes ?? null,
        sections: body.sections,
        settings: body.settings,
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.issues) {
      req.log.warn({ issues: err.issues }, "Lesson plan create validation failed");
      res.status(400).json({ message: "Invalid lesson plan", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Create lesson plan failed");
    res.status(500).json({ message: "Failed to create lesson plan" });
  }
});

/* ── Update. Owner only. */
router.put("/lesson-plans/:id", requireTeacher, async (req, res) => {
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
      .from(lessonPlansTable)
      .where(eq(lessonPlansTable.id, id))
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
      .update(lessonPlansTable)
      .set({
        title: body.title,
        language: body.language,
        gradeLevel: body.gradeLevel ?? null,
        subject: body.subject ?? null,
        durationMinutes: body.durationMinutes ?? null,
        sections: body.sections,
        settings: body.settings,
        updatedAt: new Date(),
      })
      .where(eq(lessonPlansTable.id, id))
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid lesson plan", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Update lesson plan failed");
    res.status(500).json({ message: "Failed to update lesson plan" });
  }
});

/* ── Delete. Owner only. */
router.delete("/lesson-plans/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(lessonPlansTable)
      .where(eq(lessonPlansTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await db.delete(lessonPlansTable).where(eq(lessonPlansTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete lesson plan failed");
    res.status(500).json({ message: "Failed to delete lesson plan" });
  }
});

/* ── AI generate a full lesson plan. The teacher gives a topic + grade
   level + duration; the model returns a strict JSON shape that we
   re-validate before responding so the client gets the same guarantees
   as a manually-edited plan. */
const aiGenerateBody = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  topic: z.string().min(2).max(500),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  durationMinutes: z.number().int().min(15).max(180).default(45),
  pedagogy: z.enum(["direct", "inquiry", "project", "flipped", "mixed"]).default("mixed"),
  notes: z.string().max(800).optional(),
});

router.post("/lesson-plans/ai/generate", requireTeacher, async (req, res) => {
  let language: "ar" | "en" = "ar";
  try {
    const teacherId = req.session.teacherId as number;
    const body = aiGenerateBody.parse(req.body);
    language = body.language;

    const tier = await resolveTier(teacherId, (req.body as { tier?: string })?.tier);

    const prompt = buildLessonPlanPrompt(body);
    const text = await runTierCompletion({ tier, prompt, maxTokens: 8000 });
    const json = parseJsonLoose(text);
    const cleaned = sanitizeGeneratedSections(json, body);

    const validated = sectionsSchema.safeParse(cleaned);
    if (!validated.success) {
      req.log.warn({ issues: validated.error.issues }, "AI lesson plan failed strict validation");
      res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح من المولّد" : "Generator returned an invalid format" });
      return;
    }
    res.json({ sections: validated.data });
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: language === "ar" ? "إدخال غير صالح" : "Invalid input", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Lesson plan AI generation failed");
    res.status(500).json({ message: language === "ar" ? "تعذّر التوليد" : "Generation failed" });
  }
});

/* ── AI extract from uploaded files. Reads the teacher's textbook /
   lesson source(s) and produces a complete lesson plan that fits the
   requested duration + pedagogy. Multi-file: all images go to one
   vision call; text from PDFs / DOCX is concatenated. Per-tier limits
   (5 / 50MB for teachers, 25 / 200MB for admins) are enforced inside
   `processUploadedFiles`. */
const aiExtractFields = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  topic: z.string().max(500).optional(),
  subject: z.string().max(100).optional(),
  gradeLevel: z.string().max(50).optional(),
  durationMinutes: z.union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : 45;
    })
    .pipe(z.number().int().min(15).max(180))
    .default(45),
  pedagogy: z.enum(["direct", "inquiry", "project", "flipped", "mixed"]).default("mixed"),
  notes: z.string().max(800).optional(),
});

router.post(
  "/lesson-plans/ai/extract",
  requireTeacher,
  uploadFiles,
  async (req, res) => {
    let language: "ar" | "en" = "ar";
    try {
      const teacherId = req.session.teacherId as number;
      const files = (req.files as Express.Multer.File[]) || [];

      const parsedBody = aiExtractFields.parse({
        language: req.body.language,
        topic: req.body.topic || undefined,
        subject: req.body.subject || undefined,
        gradeLevel: req.body.gradeLevel || undefined,
        durationMinutes: req.body.durationMinutes,
        pedagogy: req.body.pedagogy,
        notes: req.body.notes || undefined,
      });
      language = parsedBody.language;

      const prepared = await processUploadedFiles(req, res, files, language);
      if (!prepared) return;

      const tier = await resolveTier(teacherId, (req.body as { tier?: string })?.tier);

      const prompt = buildLessonPlanExtractPrompt({
        language: parsedBody.language,
        topic: parsedBody.topic ?? null,
        subject: parsedBody.subject ?? null,
        gradeLevel: parsedBody.gradeLevel ?? null,
        durationMinutes: parsedBody.durationMinutes,
        pedagogy: parsedBody.pedagogy,
        notes: parsedBody.notes ?? null,
        sourceText: prepared.text || null,
        hasImages: prepared.images.length > 0,
        filenames: prepared.filenames,
      });

      const text = prepared.images.length > 0
        ? await runVisionCompletionMulti({ tier, prompt, images: prepared.images, maxTokens: 8000 })
        : await runTierCompletion({ tier, prompt, maxTokens: 8000 });

      const json = parseJsonLoose(text);
      const cleaned = sanitizeGeneratedSections(json, {
        language: parsedBody.language,
        topic: parsedBody.topic || "",
        subject: parsedBody.subject ?? null,
        gradeLevel: parsedBody.gradeLevel ?? null,
        durationMinutes: parsedBody.durationMinutes,
        pedagogy: parsedBody.pedagogy,
        notes: parsedBody.notes,
      });

      const validated = sectionsSchema.safeParse(cleaned);
      if (!validated.success) {
        req.log.warn({ issues: validated.error.issues }, "AI lesson plan extraction failed strict validation");
        res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح من المولّد" : "Generator returned an invalid format" });
        return;
      }
      res.json({ sections: validated.data });
    } catch (err: any) {
      if (err?.issues) {
        res.status(400).json({ message: language === "ar" ? "إدخال غير صالح" : "Invalid input", issues: err.issues });
        return;
      }
      if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: language === "ar" ? "حجم أحد الملفات يتجاوز الحد" : "One of the files exceeds the size limit" });
        return;
      }
      req.log.error({ err }, "Lesson plan AI extract failed");
      res.status(500).json({ message: language === "ar" ? "تعذّر استخراج الخطة" : "Extraction failed" });
    }
  },
);

/* Builds the extraction prompt. Mirrors `buildLessonPlanPrompt` shape
   so the model produces the same strict JSON; the difference is that
   the source content (image OCR / PDF text) is the lesson — the topic
   is optional and used only as a hint. */
function buildLessonPlanExtractPrompt(opts: {
  language: "ar" | "en";
  topic: string | null;
  subject: string | null;
  gradeLevel: string | null;
  durationMinutes: number;
  pedagogy: "direct" | "inquiry" | "project" | "flipped" | "mixed";
  notes: string | null;
  sourceText: string | null;
  hasImages: boolean;
  filenames: string[];
}): string {
  const ar = opts.language === "ar";
  const langName = ar ? "العربية" : "English";

  const subj = opts.subject ? (ar ? `المادة: ${opts.subject}` : `Subject: ${opts.subject}`) : "";
  const grade = opts.gradeLevel ? (ar ? `المرحلة الدراسية: ${opts.gradeLevel}` : `Grade level: ${opts.gradeLevel}`) : "";
  const topicLine = opts.topic
    ? (ar ? `موضوع تركيز إضافي من المعلّم: ${opts.topic}` : `Extra topic hint from the teacher: ${opts.topic}`)
    : "";

  const pedLabelAr = { direct: "تعليم مباشر", inquiry: "تعلّم استقصائي", project: "تعلّم بالمشاريع", flipped: "صف معكوس", mixed: "متنوّع" }[opts.pedagogy];
  const pedLabel = ar ? pedLabelAr : opts.pedagogy;

  const sourceHeader = opts.hasImages
    ? (ar
        ? `المصدر: ${opts.filenames.length} ملف/ملفات مرفوعة (صور و/أو نصوص). استخرج فكرة الدرس وخطّط الحصة بناءً على محتواها.`
        : `Source: ${opts.filenames.length} uploaded file(s) (images and/or text). Read the content and design the lesson around it.`)
    : (ar
        ? `المصدر: ${opts.filenames.length} ملف/ملفات نصية مرفوعة. اعتمد على المحتوى التالي كمحور للحصة.`
        : `Source: ${opts.filenames.length} uploaded text file(s). Use the content below as the basis for the lesson.`);

  const textBlock = opts.sourceText
    ? (ar ? `\n--- محتوى الملفات ---\n${opts.sourceText}\n--- نهاية المحتوى ---` : `\n--- File content ---\n${opts.sourceText}\n--- End of content ---`)
    : "";

  const ratio = (frac: number) => Math.max(2, Math.round(opts.durationMinutes * frac));
  const wm = ratio(0.1);
  const intro = ratio(0.15);
  const act = Math.max(5, opts.durationMinutes - wm - intro - ratio(0.15) - ratio(0.05));
  const ass = ratio(0.15);
  const clo = ratio(0.05);
  const guideMins = ar
    ? `الإحماء ~${wm}د، التمهيد ~${intro}د، الأنشطة ~${act}د، التقييم ~${ass}د، الخاتمة ~${clo}د.`
    : `warm-up ~${wm}min, introduction ~${intro}min, activities ~${act}min, assessment ~${ass}min, closure ~${clo}min.`;

  const rules = ar
    ? [
        "أعد ردًّا بصيغة JSON نقية فقط — بدون شرح أو ترميز ولا أي نص خارج كائن JSON.",
        "صيغة الرد:",
        "{",
        "  \"objectives\": [\"...\", \"...\"],",
        "  \"materials\": [\"...\", \"...\"],",
        "  \"vocabulary\": [{\"term\":\"...\",\"definition\":\"...\"}],",
        "  \"warmUp\":        {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"introduction\":  {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"activities\":   [{\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"}],",
        "  \"assessment\":    {\"method\":\"...\",\"description\":\"...\"},",
        "  \"closure\":       {\"description\":\"...\"},",
        "  \"homework\":      {\"description\":\"...\"},",
        "  \"differentiation\":{\"support\":\"...\",\"extension\":\"...\"},",
        "  \"notes\":         \"...\"",
        "}",
        "اجعل الأهداف بصيغة \"سيكون الطالب قادرًا على ...\" (3-5 أهداف).",
        "اجعل الأنشطة بين 2 و 4 أنشطة، وكل نشاط لديه عنوان واضح ومدة بالدقائق ووصف عملي.",
        "وزّع المدد بحيث يقترب مجموعها من المدة الكلية للحصة.",
        "اكتب جميع الحقول بالعربية الفصحى المبسّطة المناسبة للمرحلة.",
        "اربط الأهداف والأنشطة بشكل وثيق بمحتوى الملفات المرفوعة.",
      ]
    : [
        "Reply with strict JSON ONLY — no prose, no code fences, no text outside the JSON object.",
        "Reply shape:",
        "{",
        "  \"objectives\": [\"...\", \"...\"],",
        "  \"materials\":  [\"...\", \"...\"],",
        "  \"vocabulary\": [{\"term\":\"...\",\"definition\":\"...\"}],",
        "  \"warmUp\":        {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"introduction\":  {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"activities\":    [{\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"}],",
        "  \"assessment\":    {\"method\":\"...\",\"description\":\"...\"},",
        "  \"closure\":       {\"description\":\"...\"},",
        "  \"homework\":      {\"description\":\"...\"},",
        "  \"differentiation\":{\"support\":\"...\",\"extension\":\"...\"},",
        "  \"notes\":         \"...\"",
        "}",
        "Phrase objectives as \"Students will be able to ...\" (3-5 objectives).",
        "Provide 2-4 main activities, each with a clear title, durationMinutes, and concrete steps.",
        "Distribute durationMinutes so the total is close to the requested period length.",
        "Use grade-appropriate, classroom-ready language.",
        "Tie objectives and activities tightly to the content of the uploaded files.",
      ];

  return [
    ar
      ? `أنت معلّم خبير ومخطّط تربوي. تُعدّ خطة درس متكاملة باللغة ${langName} مبنية على محتوى مرفوع.`
      : `You are an expert teacher and instructional designer. Build a complete lesson plan in ${langName} based on uploaded source content.`,
    sourceHeader,
    topicLine,
    subj,
    grade,
    ar ? `مدة الحصة الكلية: ${opts.durationMinutes} دقيقة.` : `Total period length: ${opts.durationMinutes} minutes.`,
    ar ? `المنهجية المفضّلة: ${pedLabel}.` : `Preferred pedagogy: ${pedLabel}.`,
    ar ? `إرشاد توزيع الزمن: ${guideMins}` : `Time-budget guide: ${guideMins}`,
    opts.notes ? (ar ? `ملاحظات إضافية من المعلّم: ${opts.notes}` : `Extra teacher notes: ${opts.notes}`) : "",
    textBlock,
    "",
    rules.join("\n"),
  ].filter(Boolean).join("\n");
}

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

function clip(s: any, max: number): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function clipDuration(n: any): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(240, Math.floor(n)));
}

function arrStr(value: any, max: number, perItem: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = clip(item, perItem);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeGeneratedSections(
  raw: any,
  body: z.infer<typeof aiGenerateBody>,
): any {
  // Defensive coercion: force every field into the expected shape so a single
  // missing key from the model doesn't fail Zod validation downstream.
  const r = raw && typeof raw === "object" ? raw : {};
  const fallback = body.language === "ar" ? "—" : "—";

  const vocab = Array.isArray(r.vocabulary)
    ? r.vocabulary
        .map((v: any) => v && typeof v === "object"
          ? { term: clip(v.term, 120), definition: clip(v.definition, 500) || undefined }
          : null,
        )
        .filter((v: any): v is { term: string; definition?: string } => !!v && !!v.term)
        .slice(0, 30)
    : [];

  const block = (b: any): { title?: string; durationMinutes?: number; description: string } => {
    const obj = b && typeof b === "object" ? b : {};
    return {
      title: clip(obj.title, 200) || undefined,
      durationMinutes: clipDuration(obj.durationMinutes),
      description: clip(obj.description, 2000) || fallback,
    };
  };

  const activities = Array.isArray(r.activities)
    ? r.activities
        .map((a: any) => {
          const obj = a && typeof a === "object" ? a : {};
          const title = clip(obj.title, 200);
          const description = clip(obj.description, 2000);
          if (!title || !description) return null;
          return { title, durationMinutes: clipDuration(obj.durationMinutes), description };
        })
        .filter((a: any): a is { title: string; durationMinutes?: number; description: string } => !!a)
        .slice(0, 10)
    : [];

  const assessment = (() => {
    const a = r.assessment && typeof r.assessment === "object" ? r.assessment : {};
    return {
      description: clip(a.description, 2000) || fallback,
      method: clip(a.method, 200) || undefined,
    };
  })();

  const closure = {
    description: clip(r.closure?.description, 2000) || fallback,
  };

  const homework = (() => {
    const h = r.homework && typeof r.homework === "object" ? r.homework : null;
    if (!h) return undefined;
    const description = clip(h.description, 2000);
    return description ? { description } : undefined;
  })();

  const differentiation = (() => {
    const d = r.differentiation && typeof r.differentiation === "object" ? r.differentiation : null;
    if (!d) return undefined;
    const support = clip(d.support, 2000) || undefined;
    const extension = clip(d.extension, 2000) || undefined;
    if (!support && !extension) return undefined;
    return { support, extension };
  })();

  return {
    objectives: arrStr(r.objectives, 15, 400),
    materials: arrStr(r.materials, 30, 200),
    vocabulary: vocab,
    warmUp: block(r.warmUp),
    introduction: block(r.introduction),
    activities,
    assessment,
    closure,
    homework,
    differentiation,
    notes: clip(r.notes, 3000) || undefined,
  };
}

function buildLessonPlanPrompt(body: z.infer<typeof aiGenerateBody>): string {
  const { language, topic, subject, gradeLevel, durationMinutes, pedagogy, notes } = body;
  const ar = language === "ar";
  const langName = ar ? "العربية" : "English";

  const subj = subject ? (ar ? `المادة: ${subject}` : `Subject: ${subject}`) : "";
  const grade = gradeLevel ? (ar ? `المرحلة الدراسية: ${gradeLevel}` : `Grade level: ${gradeLevel}`) : "";

  const pedLabelAr = { direct: "تعليم مباشر", inquiry: "تعلّم استقصائي", project: "تعلّم بالمشاريع", flipped: "صف معكوس", mixed: "متنوّع" }[pedagogy];
  const pedLabel = ar ? pedLabelAr : pedagogy;

  const ratio = (frac: number) => Math.max(2, Math.round(durationMinutes * frac));
  const wm = ratio(0.1);
  const intro = ratio(0.15);
  const act = Math.max(5, durationMinutes - wm - intro - ratio(0.15) - ratio(0.05));
  const ass = ratio(0.15);
  const clo = ratio(0.05);

  const rules = ar
    ? [
        "أعد ردًّا بصيغة JSON نقية فقط — بدون شرح أو ترميز ولا أي نص خارج كائن JSON.",
        "صيغة الرد:",
        "{",
        "  \"objectives\": [\"...\", \"...\"],",
        "  \"materials\": [\"...\", \"...\"],",
        "  \"vocabulary\": [{\"term\":\"...\",\"definition\":\"...\"}],",
        "  \"warmUp\":        {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"introduction\":  {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"activities\":   [{\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"}],",
        "  \"assessment\":    {\"method\":\"...\",\"description\":\"...\"},",
        "  \"closure\":       {\"description\":\"...\"},",
        "  \"homework\":      {\"description\":\"...\"},",
        "  \"differentiation\":{\"support\":\"...\",\"extension\":\"...\"},",
        "  \"notes\":         \"...\"",
        "}",
        "اجعل الأهداف بصيغة \"سيكون الطالب قادرًا على ...\" (3-5 أهداف).",
        "اجعل الأنشطة بين 2 و 4 أنشطة، وكل نشاط لديه عنوان واضح ومدة بالدقائق ووصف عملي.",
        "وزّع المدد بحيث يقترب مجموعها من المدة الكلية للحصة.",
        "اكتب جميع الحقول بالعربية الفصحى المبسّطة المناسبة للمرحلة.",
      ]
    : [
        "Reply with strict JSON ONLY — no prose, no code fences, no text outside the JSON object.",
        "Reply shape:",
        "{",
        "  \"objectives\": [\"...\", \"...\"],",
        "  \"materials\":  [\"...\", \"...\"],",
        "  \"vocabulary\": [{\"term\":\"...\",\"definition\":\"...\"}],",
        "  \"warmUp\":        {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"introduction\":  {\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"},",
        "  \"activities\":    [{\"title\":\"...\",\"durationMinutes\":N,\"description\":\"...\"}],",
        "  \"assessment\":    {\"method\":\"...\",\"description\":\"...\"},",
        "  \"closure\":       {\"description\":\"...\"},",
        "  \"homework\":      {\"description\":\"...\"},",
        "  \"differentiation\":{\"support\":\"...\",\"extension\":\"...\"},",
        "  \"notes\":         \"...\"",
        "}",
        "Phrase objectives as \"Students will be able to ...\" (3-5 objectives).",
        "Provide 2-4 main activities, each with a clear title, durationMinutes, and concrete steps.",
        "Distribute durationMinutes so the total is close to the requested period length.",
        "Use grade-appropriate, classroom-ready language.",
      ];

  const guideMins = ar
    ? `الإحماء ~${wm}د، التمهيد ~${intro}د، الأنشطة ~${act}د، التقييم ~${ass}د، الخاتمة ~${clo}د.`
    : `warm-up ~${wm}min, introduction ~${intro}min, activities ~${act}min, assessment ~${ass}min, closure ~${clo}min.`;

  return [
    ar
      ? `أنت معلّم خبير ومخطّط تربوي. تُعدّ خطة درس متكاملة باللغة ${langName}.`
      : `You are an expert teacher and instructional designer. Build a complete lesson plan in ${langName}.`,
    ar ? `الموضوع: ${topic}` : `Topic: ${topic}`,
    subj,
    grade,
    ar ? `مدة الحصة الكلية: ${durationMinutes} دقيقة.` : `Total period length: ${durationMinutes} minutes.`,
    ar ? `المنهجية المفضّلة: ${pedLabel}.` : `Preferred pedagogy: ${pedLabel}.`,
    ar ? `إرشاد توزيع الزمن: ${guideMins}` : `Time-budget guide: ${guideMins}`,
    notes ? (ar ? `ملاحظات إضافية من المعلّم: ${notes}` : `Extra teacher notes: ${notes}`) : "",
    "",
    rules.join("\n"),
  ].filter(Boolean).join("\n");
}

export default router;
