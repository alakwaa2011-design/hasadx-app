import { Router, type IRouter } from "express";
import { db, arenaCategoriesTable, arenaActivitiesTable, arenaQuestionReportsTable, teachersTable, platformSettingsTable, DEFAULT_ARENA_IMPORT_SOURCES, type ArenaImportSources } from "@workspace/db";
import { eq, or, and, isNull, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";
import { awardXpAndNotify } from "../lib/xp/socket";

const router: IRouter = Router();

async function isAdmin(teacherId: number): Promise<boolean> {
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId));
  return !!t?.isAdmin;
}

async function getArenaImportSources(): Promise<ArenaImportSources> {
  const [row] = await db.select({ s: platformSettingsTable.arenaImportSources }).from(platformSettingsTable).limit(1);
  return row?.s ?? { ...DEFAULT_ARENA_IMPORT_SOURCES };
}

const CategoryBody = z.object({
  name: z.string().min(1).max(120),
  emoji: z.string().max(8).default("🎯"),
  coverImageUrl: z.string().nullable().optional(),
  coverColor: z.string().default("#1E4D35"),
  coverGradient: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  parentId: z.number().int().nullable().optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const ActivityBody = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(["text", "image", "video", "audio", "memory", "sin-jeem", "categorize", "logo", "secret"]).default("text"),
  difficulty: z.number().int().refine(v => [200, 400, 600, 800].includes(v)).default(200),
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

// GET /arena-content/categories — admins: all rows; teachers: public + own; guests: public only
router.get("/arena-content/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    const admin = teacherId ? await isAdmin(teacherId) : false;
    const rows = await db
      .select()
      .from(arenaCategoriesTable)
      .where(
        admin
          ? undefined
          : teacherId
            ? or(eq(arenaCategoriesTable.isPublic, true), eq(arenaCategoriesTable.teacherId, teacherId))
            : eq(arenaCategoriesTable.isPublic, true),
      )
      .orderBy(asc(arenaCategoriesTable.sortOrder), asc(arenaCategoriesTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena categories");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/arena-content/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const body = CategoryBody.parse(req.body);
    const admin = await isAdmin(teacherId);
    // Non-admins can create private categories only (owned by them, never public)
    const isPublic = admin ? (body.isPublic ?? false) : false;
    const [row] = await db.insert(arenaCategoriesTable).values({
      ...body,
      isPublic,
      teacherId: isPublic ? null : teacherId,
    }).returning();
    // Award XP only for own (non-public admin) categories
    if (!isPublic && row?.id) {
      void awardXpAndNotify({
        teacherId,
        actionKey: "arena.category.create",
        refId: `arena_category:${row.id}`,
      }).catch(() => {});
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena category");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/arena-content/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const ownsOrAdmin = existing.teacherId === teacherId || admin;
    if (!ownsOrAdmin) return res.status(403).json({ error: "Forbidden" });
    const body = CategoryBody.partial().parse(req.body);
    const isPublic = admin ? (body.isPublic ?? existing.isPublic) : existing.isPublic;
    const [row] = await db.update(arenaCategoriesTable).set({
      ...body,
      isPublic,
      teacherId: isPublic ? null : (existing.teacherId ?? teacherId),
      updatedAt: new Date(),
    }).where(eq(arenaCategoriesTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena category");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/arena-content/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const ownsOrAdmin = existing.teacherId === teacherId || admin;
    if (!ownsOrAdmin) return res.status(403).json({ error: "Forbidden" });
    await db.delete(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena category");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /arena-content/activities?categoryIds=1,2,3 — admins: all rows; teachers: public+own; guests: public only
router.get("/arena-content/activities", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    const admin = teacherId ? await isAdmin(teacherId) : false;
    const idsRaw = String(req.query.categoryIds ?? "").trim();
    const ids = idsRaw ? idsRaw.split(",").map(Number).filter(n => Number.isFinite(n)) : [];

    let cond = admin
      ? undefined
      : teacherId
        ? or(eq(arenaActivitiesTable.isPublic, true), eq(arenaActivitiesTable.teacherId, teacherId))
        : eq(arenaActivitiesTable.isPublic, true);

    if (ids.length > 0) {
      const idsCond = inArray(arenaActivitiesTable.categoryId, ids);
      cond = cond ? and(cond, idsCond)! : idsCond;
    }

    const rows = await db.select().from(arenaActivitiesTable)
      .where(cond)
      .orderBy(asc(arenaActivitiesTable.sortOrder), asc(arenaActivitiesTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena activities");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/arena-content/activities", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const body = ActivityBody.parse(req.body);
    const [cat] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, body.categoryId));
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const admin = await isAdmin(teacherId);
    // Non-admins can only add activities to their own private categories
    const ownsCat = cat.teacherId === teacherId || admin;
    if (!ownsCat) return res.status(403).json({ error: "Forbidden — يمكنك فقط إضافة أسئلة لفئاتك الخاصة" });
    /* Enforce per-source feature flag — admins bypass so they can still
       moderate even when a source is globally disabled. The frontend
       picks the source via the `source` query param; legacy callers
       (no param) default to "manual". */
    if (!admin) {
      const rawSource = String(req.query.source ?? "manual").toLowerCase();
      const source = (["manual", "ai", "homework", "file"] as const).includes(rawSource as any)
        ? (rawSource as "manual" | "ai" | "homework" | "file")
        : "manual";
      const sources = await getArenaImportSources();
      if (!sources[source]) {
        return res.status(403).json({ error: `Import source '${source}' is currently disabled by the admin` });
      }
    }
    const isPublic = admin && cat.isPublic;
    const [row] = await db.insert(arenaActivitiesTable).values({
      ...body,
      payload: (body.payload as any) ?? null,
      isPublic,
      teacherId: isPublic ? null : teacherId,
    }).returning();
    // Award XP for own questions only (not admin public questions)
    if (!isPublic && row?.id) {
      void awardXpAndNotify({
        teacherId,
        actionKey: "arena.question.create",
        refId: `arena_activity:${row.id}`,
      }).catch(() => {});
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena activity");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/arena-content/activities/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const owns = existing.teacherId === teacherId || admin;
    if (!owns) return res.status(403).json({ error: "Forbidden" });
    const body = ActivityBody.partial().parse(req.body);
    const [row] = await db.update(arenaActivitiesTable).set({
      ...body,
      payload: body.payload === undefined ? existing.payload : (body.payload as any),
    }).where(eq(arenaActivitiesTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena activity");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/arena-content/activities/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const owns = existing.teacherId === teacherId || admin;
    if (!owns) return res.status(403).json({ error: "Forbidden" });
    await db.delete(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena activity");
    res.status(500).json({ error: "Server error" });
  }
});

/* ───────────────────── Question reports ───────────────────── */

const ReportBody = z.object({
  categoryId: z.number().int().nullable().optional(),
  activityId: z.number().int().nullable().optional(),
  subCategoryId: z.string().max(120).nullable().optional(),
  difficulty: z.number().int().nullable().optional(),
  questionType: z.string().max(40).nullable().optional(),
  questionText: z.string().min(1).max(2000),
  currentAnswer: z.string().min(1).max(2000),
  suggestedAnswer: z.string().max(2000).nullable().optional(),
  note: z.string().min(1).max(2000),
});

// POST /arena-content/reports — anyone (auth optional) can report
router.post("/arena-content/reports", async (req, res) => {
  try {
    const body = ReportBody.parse(req.body);
    const teacherId = (req.session as any)?.teacherId ?? null;
    let reporterName: string | null = null;
    if (teacherId) {
      const [t] = await db.select({ name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, teacherId));
      reporterName = t?.name ?? null;
    }
    const [row] = await db.insert(arenaQuestionReportsTable).values({
      categoryId: body.categoryId ?? null,
      activityId: body.activityId ?? null,
      subCategoryId: body.subCategoryId ?? null,
      difficulty: body.difficulty ?? null,
      questionType: body.questionType ?? null,
      questionText: body.questionText,
      currentAnswer: body.currentAnswer,
      suggestedAnswer: body.suggestedAnswer ?? null,
      note: body.note,
      reporterTeacherId: teacherId,
      reporterName,
      status: "open",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena report");
    res.status(400).json({ error: "Invalid data" });
  }
});

// GET /arena-content/reports — admin only
router.get("/arena-content/reports", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const status = String(req.query.status ?? "").trim();
    const where = status && ["open", "resolved", "dismissed"].includes(status)
      ? eq(arenaQuestionReportsTable.status, status)
      : undefined;
    const q = db.select().from(arenaQuestionReportsTable);
    const rows = await (where ? q.where(where) : q).orderBy(desc(arenaQuestionReportsTable.createdAt)).limit(500);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena reports");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /arena-content/reports/:id — admin only — update status / admin note
router.patch("/arena-content/reports/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const id = Number(req.params.id);
    const patch = z.object({
      status: z.enum(["open", "resolved", "dismissed"]).optional(),
      adminNote: z.string().max(2000).nullable().optional(),
    }).parse(req.body);
    const setData: any = {};
    if (patch.status !== undefined) {
      setData.status = patch.status;
      if (patch.status === "resolved" || patch.status === "dismissed") {
        setData.resolvedByTeacherId = teacherId;
        setData.resolvedAt = new Date();
      } else {
        setData.resolvedByTeacherId = null;
        setData.resolvedAt = null;
      }
    }
    if (patch.adminNote !== undefined) setData.adminNote = patch.adminNote;
    const [row] = await db.update(arenaQuestionReportsTable).set(setData).where(eq(arenaQuestionReportsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena report");
    res.status(400).json({ error: "Invalid data" });
  }
});

// DELETE /arena-content/reports/:id — admin only
router.delete("/arena-content/reports/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const id = Number(req.params.id);
    await db.delete(arenaQuestionReportsTable).where(eq(arenaQuestionReportsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena report");
    res.status(500).json({ error: "Server error" });
  }
});

/* ─── Import-source flags (public read) ──────────────────────
   Lets any authenticated organiser see which question import
   flows (manual / AI / homework / file) are currently enabled
   by the platform admin. Updates flow through the existing
   admin /admin/platform-settings PATCH. */
router.get("/arena-content/import-sources", async (req, res) => {
  try {
    const sources = await getArenaImportSources();
    res.json(sources);
  } catch (err) {
    req.log.error({ err }, "get arena import sources");
    res.status(500).json({ error: "Server error" });
  }
});

/* ─── AI question generation ────────────────────────────────
   Generates a batch of arena questions for a custom category
   given a topic + count. Difficulty is auto-assigned by the
   model (200/400/600 — easy/medium/hard) and an optional bonus
   800-pt question can be requested. Output is preview-only:
   the organiser inspects/edits each row, then chooses what to
   save via the existing POST /arena-content/activities. */
const AiGenerateBody = z.object({
  topic: z.string().min(2).max(300),
  count: z.number().int().min(1).max(15),
  includeBonus800: z.boolean().default(false),
  language: z.enum(["ar", "en"]).default("ar"),
  notes: z.string().max(500).optional(),
}).strict();

interface GeneratedQuestion {
  q: string;
  a: string;
  difficulty: 200 | 400 | 600 | 800;
  hint?: string | null;
}

function parseAiQuestions(text: string): GeneratedQuestion[] {
  if (!text) return [];
  const trimmed = text.trim();
  let parsed: unknown = null;
  try { parsed = JSON.parse(trimmed); } catch { /* try fence */ }
  if (parsed === null) {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try { parsed = JSON.parse(fence[1]); } catch { /* try slice */ }
    }
  }
  if (parsed === null) {
    const a = trimmed.indexOf("[");
    const b = trimmed.lastIndexOf("]");
    if (a !== -1 && b > a) {
      try { parsed = JSON.parse(trimmed.slice(a, b + 1)); } catch { /* give up */ }
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: GeneratedQuestion[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const q = String(r.question ?? r.q ?? "").trim();
    const a = String(r.answer ?? r.a ?? "").trim();
    const dRaw = Number(r.difficulty ?? r.diff ?? 200);
    const difficulty = ([200, 400, 600, 800] as const).includes(dRaw as 200 | 400 | 600 | 800)
      ? (dRaw as 200 | 400 | 600 | 800)
      : 200;
    const hint = typeof r.hint === "string" ? r.hint.trim() : null;
    if (!q || !a) continue;
    out.push({ q, a, difficulty, hint: hint || null });
  }
  return out;
}

router.post("/arena-content/ai-generate-questions", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const sources = await getArenaImportSources();
    if (!sources.ai) {
      return res.status(403).json({ error: "AI generation is currently disabled by the admin" });
    }

    const body = AiGenerateBody.parse(req.body);

    const langName = body.language === "ar" ? "Arabic" : "English";
    const sysPrompt = [
      `You are an expert quiz writer for an Arabic educational competition platform called "Hasad Challenge".`,
      `Generate factually accurate, engaging short-answer trivia questions on the user-provided topic.`,
      `Write the questions and answers in ${langName}.`,
      `Each question must have ONE concise canonical answer (1–6 words). Avoid yes/no, avoid multi-part.`,
      `Assign a difficulty integer to each question:`,
      `  200 = easy (general knowledge, recall),`,
      `  400 = medium (some specific knowledge),`,
      `  600 = hard (deeper specialized knowledge).`,
      `If the user requests a bonus 800-point question, that question must be exceptionally hard / expert-level.`,
      `Distribute the difficulties roughly evenly (e.g. for 6 questions: 2×200, 2×400, 2×600).`,
      `Optionally include a short helpful hint per question (≤10 words) — never reveal the answer in the hint.`,
      `Output STRICT JSON only — a single JSON array. No markdown, no prose, no comments.`,
      `Schema per item: { "question": string, "answer": string, "difficulty": 200|400|600|800, "hint": string | null }`,
    ].join("\n");

    const baseCount = body.count;
    const totalCount = baseCount + (body.includeBonus800 ? 1 : 0);
    const userPrompt = [
      `Topic: ${body.topic}`,
      `Count: ${baseCount} regular questions${body.includeBonus800 ? " + 1 bonus 800-point expert question (total " + totalCount + ")" : ""}`,
      body.notes ? `Notes: ${body.notes}` : "",
      `Return a JSON array with exactly ${totalCount} items, ordered by ascending difficulty.`,
    ].filter(Boolean).join("\n");

    const completion = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 3500,
      system: sysPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = completion.content.find((c) => c.type === "text");
    const raw = block && "text" in block ? block.text : "";
    const questions = parseAiQuestions(raw);

    if (questions.length === 0) {
      req.log.warn({ topic: body.topic, raw: raw.slice(0, 400) }, "AI returned no parseable questions");
      return res.status(502).json({ error: "تعذّر توليد الأسئلة — حاول مجدداً أو غيّر الموضوع" });
    }

    /* Enforce the bonus 800 if requested but model didn't include it. */
    if (body.includeBonus800 && !questions.some(q => q.difficulty === 800)) {
      const last = questions[questions.length - 1];
      if (last) last.difficulty = 800;
    }

    res.json({ questions: questions.slice(0, totalCount) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.issues });
    }
    req.log.error({ err }, "ai generate arena questions");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
