import { Router, type IRouter } from "express";
import { db, presentationsTable, assignmentsTable, questionsTable, teachersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveTier, modelForTier, getAvailableTiers, isClaudeTier, type AiTier } from "../lib/ai-tier";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";

/* Run a single-prompt AI completion against the model for the resolved tier.
   Returns the raw text response. Branches between Anthropic (claude tier) and
   OpenAI (standard / pro tiers) so the rest of the route just deals with text.
   Optionally accepts a `system` message that is forwarded as a system prompt
   to Anthropic and prepended as a system role message to OpenAI. */
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
    const textBlock = response.content.find((c) => c.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text : "";
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

/* ── Pro design gating ───────────────────────────────────────── */
const FREE_THEMES = new Set(["harvest", "ocean", "sunset", "midnight", "rose"]);
const FREE_PATTERNS = new Set(["solid"]);

async function teacherHasProDesign(teacherId: number): Promise<boolean> {
  const [t] = await db
    .select({ isAdmin: teachersTable.isAdmin, hasProDesign: teachersTable.hasProDesign })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!t) return false;
  return Boolean(t.isAdmin || t.hasProDesign);
}

const router: IRouter = Router();

/* ─────────────────────────────────────────────────────────────
   GET /api/presentations/ai-options
   Returns the AI tiers a teacher is allowed to choose from.
   ───────────────────────────────────────────────────────────── */
router.get("/presentations/ai-options", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const tiers = await getAvailableTiers(req.session.teacherId);
    res.json({ tiers });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch AI options");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ─────────────────────────────────────────────────────────────
   Slide types & validation
   ───────────────────────────────────────────────────────────── */

const slideSchema = z.object({
  id: z.string(),
  type: z.enum([
    "cover",
    "content",
    "bullets",
    "quiz",
    "activity",
    "discussion",
    "image",
    "video",
    "summary",
    "objectives",
    "warmup",
  ]),
  title: z.string().nullish(),
  subtitle: z.string().nullish(),
  body: z.string().nullish(),
  bullets: z.array(z.string()).nullish(),
  emoji: z.string().nullish(),
  imageUrl: z.string().nullish(),
  videoUrl: z.string().nullish(),
  speakerNotes: z.string().nullish(),
  /* quiz slide */
  question: z.object({
    text: z.string(),
    optionA: z.string(),
    optionB: z.string(),
    optionC: z.string(),
    optionD: z.string(),
    correctAnswer: z.enum(["A", "B", "C", "D"]),
    explanation: z.string().nullish(),
  }).nullish(),
  /* activity slide */
  activity: z.object({
    gameType: z.enum(["wameed", "million", "tug", "memory", "scramble"]),
    instructions: z.string().nullish(),
    questions: z.array(z.object({
      text: z.string(),
      optionA: z.string(),
      optionB: z.string(),
      optionC: z.string(),
      optionD: z.string(),
      correctAnswer: z.enum(["A", "B", "C", "D"]),
      points: z.number().default(1),
    })).default([]),
  }).nullish(),
  /* discussion slide */
  discussionPrompt: z.string().nullish(),
  discussionPoints: z.array(z.string()).nullish(),
  /* per-slide AI-picked background (only honoured when presentation.pattern
     === "ai"). Defined inline to avoid a forward-reference; the equivalent
     customBackgroundSchema below validates the same shape coming back from
     the AI fill endpoint. */
  customBackground: z.object({
    gradientFrom: z.string(),
    gradientTo: z.string(),
    textOnLight: z.boolean().optional(),
  }).nullish(),
});

const themeEnum = z.enum([
  "harvest", "ocean", "sunset", "midnight", "rose",
  "royal", "noor", "sage", "sand", "obsidian",
]);
const patternEnum = z.enum([
  "solid", "dots", "grid", "lines", "waves", "geometric", "stars", "glow", "ai",
]);

/* Tailwind gradient classes the AI is allowed to pick when the presentation
   uses the "ai" pattern. MUST be kept in sync with
   artifacts/homework-app/src/lib/slide-themes.ts so that Tailwind's JIT
   includes them in the bundle. The server only validates against this list. */
const AI_GRADIENT_FROM = [
  "from-rose-400","from-rose-500","from-rose-600",
  "from-pink-400","from-pink-500","from-pink-600",
  "from-fuchsia-500","from-fuchsia-600","from-fuchsia-700",
  "from-purple-500","from-purple-600","from-purple-700",
  "from-violet-500","from-violet-600","from-violet-700",
  "from-indigo-500","from-indigo-600","from-indigo-700",
  "from-blue-400","from-blue-500","from-blue-600","from-blue-700",
  "from-sky-400","from-sky-500","from-sky-600",
  "from-cyan-400","from-cyan-500","from-cyan-600",
  "from-teal-400","from-teal-500","from-teal-600",
  "from-emerald-400","from-emerald-500","from-emerald-600","from-emerald-700",
  "from-green-400","from-green-500","from-green-600","from-green-700",
  "from-lime-400","from-lime-500",
  "from-yellow-400","from-yellow-500",
  "from-amber-400","from-amber-500","from-amber-600",
  "from-orange-400","from-orange-500","from-orange-600",
  "from-red-500","from-red-600","from-red-700",
  "from-slate-700","from-slate-800","from-slate-900",
  "from-stone-700","from-stone-800",
  "from-neutral-800","from-neutral-900",
  "from-zinc-700","from-zinc-800",
] as const;
const AI_GRADIENT_TO = [
  "to-rose-500","to-rose-600","to-rose-700","to-rose-800",
  "to-pink-500","to-pink-600","to-pink-700",
  "to-fuchsia-600","to-fuchsia-700","to-fuchsia-800",
  "to-purple-600","to-purple-700","to-purple-800","to-purple-900",
  "to-violet-600","to-violet-700","to-violet-800","to-violet-900",
  "to-indigo-700","to-indigo-800","to-indigo-900",
  "to-blue-600","to-blue-700","to-blue-800","to-blue-900",
  "to-sky-600","to-sky-700","to-sky-800",
  "to-cyan-600","to-cyan-700",
  "to-teal-600","to-teal-700","to-teal-800",
  "to-emerald-600","to-emerald-700","to-emerald-800",
  "to-green-600","to-green-700","to-green-800","to-green-900",
  "to-lime-600","to-lime-700",
  "to-yellow-600","to-yellow-700",
  "to-amber-600","to-amber-700","to-amber-800",
  "to-orange-600","to-orange-700","to-orange-800",
  "to-red-600","to-red-700","to-red-800",
  "to-slate-800","to-slate-900",
  "to-stone-800","to-stone-900",
  "to-neutral-900",
  "to-zinc-800","to-zinc-900",
  "to-indigo-950","to-purple-950","to-rose-950","to-emerald-950",
] as const;
const aiGradientFromEnum = z.enum(AI_GRADIENT_FROM as unknown as [string, ...string[]]);
const aiGradientToEnum = z.enum(AI_GRADIENT_TO as unknown as [string, ...string[]]);
const customBackgroundSchema = z.object({
  gradientFrom: aiGradientFromEnum,
  gradientTo: aiGradientToEnum,
  textOnLight: z.boolean().optional(),
});

/* ─────────────────────────────────────────────────────────────
   GET /api/presentations  — list teacher's decks
   ───────────────────────────────────────────────────────────── */
router.get("/presentations", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: presentationsTable.id,
        title: presentationsTable.title,
        subject: presentationsTable.subject,
        gradeLevel: presentationsTable.gradeLevel,
        theme: presentationsTable.theme,
        pattern: presentationsTable.pattern,
        coverEmoji: presentationsTable.coverEmoji,
        description: presentationsTable.description,
        slideCount: sql<number>`jsonb_array_length(${presentationsTable.slides})::int`,
        lastPresentedAt: presentationsTable.lastPresentedAt,
        createdAt: presentationsTable.createdAt,
        updatedAt: presentationsTable.updatedAt,
      })
      .from(presentationsTable)
      .where(eq(presentationsTable.teacherId, req.session.teacherId))
      .orderBy(desc(presentationsTable.updatedAt));
    res.json({ presentations: rows });
  } catch (err) {
    req.log.error({ err }, "List presentations failed");
    res.status(500).json({ message: "خطأ في تحميل العروض" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/presentations/:id  — single deck
   ───────────────────────────────────────────────────────────── */
router.get("/presentations/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const [row] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }
  res.json({ presentation: row });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations  — save (after generation or manual create)
   ───────────────────────────────────────────────────────────── */
const createBody = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  language: z.enum(["ar", "en"]).default("ar"),
  theme: themeEnum.default("harvest"),
  pattern: patternEnum.default("solid"),
  coverEmoji: z.string().max(8).nullish(),
  description: z.string().max(1000).nullish(),
  slides: z.array(slideSchema).default([]),
  isShared: z.boolean().optional(),
});

router.post("/presentations", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة", issues: parsed.error.issues });
    return;
  }
  try {
    const isPro = await teacherHasProDesign(req.session.teacherId);
    let theme = parsed.data.theme;
    let pattern = parsed.data.pattern;
    if (!isPro) {
      if (!FREE_THEMES.has(theme)) theme = "harvest";
      if (!FREE_PATTERNS.has(pattern)) pattern = "solid";
    }
    const [row] = await db
      .insert(presentationsTable)
      .values({
        teacherId: req.session.teacherId,
        title: parsed.data.title,
        subject: parsed.data.subject ?? null,
        gradeLevel: parsed.data.gradeLevel ?? null,
        language: parsed.data.language,
        theme,
        pattern,
        coverEmoji: parsed.data.coverEmoji ?? "📚",
        description: parsed.data.description ?? null,
        slides: parsed.data.slides as unknown as object,
      })
      .returning();
    res.json({ presentation: row });
  } catch (err) {
    req.log.error({ err }, "Create presentation failed");
    res.status(500).json({ message: "تعذّر حفظ العرض" });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/presentations/:id  — update
   ───────────────────────────────────────────────────────────── */
const updateBody = createBody.partial();
router.put("/presentations/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة", issues: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select({ id: presentationsTable.id })
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }

  const isPro = await teacherHasProDesign(req.session.teacherId);
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.subject !== undefined) updateData.subject = parsed.data.subject;
  if (parsed.data.gradeLevel !== undefined) updateData.gradeLevel = parsed.data.gradeLevel;
  if (parsed.data.language !== undefined) updateData.language = parsed.data.language;
  if (parsed.data.theme !== undefined) {
    if (!isPro && !FREE_THEMES.has(parsed.data.theme)) {
      res.status(403).json({ message: "هذا التصميم احترافي — تواصل مع المسؤول لتفعيله" });
      return;
    }
    updateData.theme = parsed.data.theme;
  }
  if (parsed.data.pattern !== undefined) {
    if (!isPro && !FREE_PATTERNS.has(parsed.data.pattern)) {
      res.status(403).json({ message: "هذه الخلفية احترافية — تواصل مع المسؤول لتفعيلها" });
      return;
    }
    updateData.pattern = parsed.data.pattern;
  }
  if (parsed.data.coverEmoji !== undefined) updateData.coverEmoji = parsed.data.coverEmoji;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.slides !== undefined) updateData.slides = parsed.data.slides;
  if (parsed.data.isShared !== undefined) updateData.isShared = parsed.data.isShared;

  const [row] = await db
    .update(presentationsTable)
    .set(updateData)
    .where(eq(presentationsTable.id, id))
    .returning();
  res.json({ presentation: row });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/presentations/public/:id  — anyone can view (if shared)
   No auth required. Returns only if isShared = true.
   ───────────────────────────────────────────────────────────── */
router.get("/presentations/public/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const [row] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.isShared, true)))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "العرض غير متاح للعرض العام" });
    return;
  }
  /* Strip teacher info; only return display fields. */
  const { teacherId: _t, ...publicData } = row;
  res.json({ presentation: publicData });
});

/* ─────────────────────────────────────────────────────────────
   GET /api/presentations/shared  — gallery of shared decks (public)
   ───────────────────────────────────────────────────────────── */
router.get("/presentations-shared/list", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: presentationsTable.id,
        title: presentationsTable.title,
        subject: presentationsTable.subject,
        gradeLevel: presentationsTable.gradeLevel,
        theme: presentationsTable.theme,
        coverEmoji: presentationsTable.coverEmoji,
        description: presentationsTable.description,
        slideCount: sql<number>`jsonb_array_length(${presentationsTable.slides})::int`,
        createdAt: presentationsTable.createdAt,
      })
      .from(presentationsTable)
      .where(eq(presentationsTable.isShared, true))
      .orderBy(desc(presentationsTable.createdAt))
      .limit(60);
    res.json({ presentations: rows });
  } catch (err) {
    res.status(500).json({ presentations: [] });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/presentations/:id
   ───────────────────────────────────────────────────────────── */
router.delete("/presentations/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const result = await db
    .delete(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .returning({ id: presentationsTable.id });
  if (result.length === 0) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }
  res.json({ ok: true });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations/:id/duplicate
   ───────────────────────────────────────────────────────────── */
router.post("/presentations/:id/duplicate", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const [src] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!src) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }
  const isPro = await teacherHasProDesign(req.session.teacherId);
  const dupTheme = !isPro && !FREE_THEMES.has(src.theme as string) ? "harvest" : src.theme;
  const dupPattern = !isPro && !FREE_PATTERNS.has(src.pattern as string) ? "solid" : src.pattern;
  const [row] = await db
    .insert(presentationsTable)
    .values({
      teacherId: req.session.teacherId,
      title: `${src.title} — نسخة`,
      subject: src.subject,
      gradeLevel: src.gradeLevel,
      language: src.language,
      theme: dupTheme,
      pattern: dupPattern,
      coverEmoji: src.coverEmoji,
      description: src.description,
      slides: src.slides as unknown as object,
    })
    .returning();
  res.json({ presentation: row });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations/:id/launch-game
   Creates a hidden assignment from an activity slide's questions and
   returns the assignment id + recommended URL for the chosen game.
   ───────────────────────────────────────────────────────────── */
const launchBody = z.object({
  slideId: z.string(),
});

router.post("/presentations/:id/launch-game", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const parsed = launchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const [pres] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!pres) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }
  const slides = (pres.slides as unknown as Array<Record<string, unknown>>) || [];
  const slide = slides.find((s) => s.id === parsed.data.slideId);
  if (!slide || slide.type !== "activity" || !slide.activity) {
    res.status(400).json({ message: "الشريحة ليست نشاطاً تفاعلياً" });
    return;
  }
  const activity = slide.activity as { gameType: string; questions: Array<{ text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D"; points?: number }> };
  if (!Array.isArray(activity.questions) || activity.questions.length === 0) {
    res.status(400).json({ message: "لا توجد أسئلة في هذا النشاط" });
    return;
  }

  /* Create a hidden assignment for the activity. */
  const totalPoints = activity.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  const [assignment] = await db
    .insert(assignmentsTable)
    .values({
      title: `${pres.title} — ${(slide.title as string) || "نشاط"}`,
      subject: pres.subject || "عرض تفاعلي",
      description: `نشاط من العرض: ${pres.title}`,
      submissionMode: "electronic",
      accessMode: "private",
      targetClass: pres.gradeLevel || null,
      teacherId: req.session.teacherId,
      totalPoints,
      showResults: true,
    })
    .returning();

  /* Insert questions linked to the assignment. */
  const questionRows = activity.questions.map((q) => ({
    assignmentId: assignment.id,
    text: q.text,
    questionType: "mcq" as const,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    points: q.points || 1,
  }));
  await db.insert(questionsTable).values(questionRows);

  /* Each game type launches into its own setup page (or the assignment
     review page for wameed/memory/scramble which use the assignment-detail
     launcher because their authoring flows aren't pure MCQ). */
  const urlByGame: Record<string, string> = {
    wameed: `/teacher/assignment/${assignment.id}`,
    million: `/game/million?assignmentId=${assignment.id}`,
    tug: `/game/tug/create?assignmentId=${assignment.id}`,
    memory: `/teacher/assignment/${assignment.id}`,
    scramble: `/teacher/assignment/${assignment.id}`,
  };

  res.json({
    assignmentId: assignment.id,
    gameType: activity.gameType,
    launchUrl: urlByGame[activity.gameType] || urlByGame.wameed,
  });
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations/:id/regenerate-questions
   AI-generates fresh questions for a single quiz/activity slide.
   ───────────────────────────────────────────────────────────── */
const regenBody = z.object({
  slideId: z.string(),
  count: z.number().int().min(1).max(10).default(5),
  topic: z.string().max(300).nullish(),
});

router.post("/presentations/:id/regenerate-questions", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const parsed = regenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const [pres] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!pres) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }
  const slides = (pres.slides as unknown as Array<Record<string, unknown>>) || [];
  const slide = slides.find((s) => s.id === parsed.data.slideId);
  if (!slide) {
    res.status(404).json({ message: "الشريحة غير موجودة" });
    return;
  }
  const isQuiz = slide.type === "quiz";
  const isActivity = slide.type === "activity";
  if (!isQuiz && !isActivity) {
    res.status(400).json({ message: "هذه الشريحة ليست شريحة سؤال أو نشاط" });
    return;
  }
  const topicHint = parsed.data.topic
    || (slide.title as string)
    || pres.title;
  const count = isQuiz ? 1 : parsed.data.count;
  const langInst = pres.language === "en"
    ? "Use clear English suited to the grade level."
    : "استخدم اللغة العربية الفصحى المبسطة المناسبة للطلاب.";

  const prompt = `أنت معلم خبير. ولّد ${count} ${count === 1 ? "سؤال اختيار من متعدد" : "أسئلة اختيار من متعدد"} عن: ${topicHint}
${pres.subject ? `المادة: ${pres.subject}` : ""}
${pres.gradeLevel ? `الصف: ${pres.gradeLevel}` : ""}
${langInst}

أعد JSON فقط بهذا الشكل:
{"questions":[{"text":"السؤال","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A","explanation":"شرح قصير"}]}

نوّع مواضع الإجابات الصحيحة بين A وB وC وD، واجعل المغريات قريبة من الإجابة الصحيحة.`;

  try {
    const tier = await resolveTier(req.session.teacherId, (req.body as { tier?: string })?.tier);
    const txt = await runTierCompletion({ tier, prompt, maxTokens: 4000 });
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) { res.status(500).json({ message: "تعذّر التوليد" }); return; }
    const parsed2 = JSON.parse(m[0]) as { questions?: Array<{ text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: "A"|"B"|"C"|"D"; explanation?: string }> };
    const qs = (parsed2.questions || []).filter((q) => q && q.text && q.optionA && q.optionB && q.optionC && q.optionD && ["A","B","C","D"].includes(q.correctAnswer));
    if (qs.length === 0) { res.status(500).json({ message: "لم تُولَّد أسئلة صالحة" }); return; }

    res.json({
      questions: qs.map((q) => ({
        text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        correctAnswer: q.correctAnswer, explanation: q.explanation || null, points: 1,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Regenerate questions failed");
    res.status(500).json({ message: "تعذّر توليد الأسئلة" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations/generate  — AI generation
   ───────────────────────────────────────────────────────────── */
const generateBody = z.object({
  title: z.string().min(2).max(200),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  slideCount: z.number().int().min(5).max(20).default(10),
  lessonOutline: z.string().max(2000).nullish(),
  includeQuizzes: z.boolean().default(true),
  includeActivities: z.boolean().default(true),
  includeDiscussion: z.boolean().default(true),
  language: z.enum(["ar", "en"]).default("ar"),
});

router.post("/presentations/generate", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const parsed = generateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة", issues: parsed.error.issues });
    return;
  }
  const { title, subject, gradeLevel, slideCount, lessonOutline, includeQuizzes, includeActivities, includeDiscussion, language } = parsed.data;

  const langInstruction = language === "ar"
    ? "استخدم اللغة العربية الفصحى المبسطة المناسبة للطلاب."
    : "Use clear English suited to the grade level.";

  const includeList: string[] = [];
  if (includeQuizzes) includeList.push("شريحة سؤال اختيار من متعدد واحدة على الأقل في الوسط");
  if (includeActivities) includeList.push("شريحة نشاط تفاعلي واحدة على الأقل (لعبة جماعية للفصل) تحتوي 5-8 أسئلة قصيرة");
  if (includeDiscussion) includeList.push("شريحة سؤال نقاش مفتوح واحدة على الأقل");

  const prompt = `أنت خبير تربوي متخصص في تصميم الدروس التفاعلية. مهمتك إنشاء عرض تقديمي كامل وإبداعي.

الموضوع: ${title}
${subject ? `المادة: ${subject}` : ""}
${gradeLevel ? `الصف: ${gradeLevel}` : ""}
عدد الشرائح المطلوب: ${slideCount}
${lessonOutline ? `خطة الدرس من المعلم: ${lessonOutline}` : ""}

${langInstruction}

التركيب المطلوب للعرض (بالترتيب):
1. شريحة غلاف (cover) فيها العنوان ووصف جذاب قصير وإيموجي مناسب.
2. شريحة أهداف الدرس (objectives) — قائمة 3-4 أهداف.
3. شريحة تنشيطية (warmup) — سؤال إثارة فضول قصير لجذب انتباه الطلاب.
4. شرائح محتوى (content أو bullets) تشرح الموضوع بطريقة منظمة وممتعة.
${includeList.length ? `5. أثناء العرض أدرج: ${includeList.join("، ")}.` : ""}
${slideCount}. شريحة ملخص (summary) — أهم 3-5 نقاط للحفظ.

قواعد التصميم:
- كل شريحة لها إيموجي واحد مناسب يعبر عن محتواها (emoji).
- نصوص الشرائح مختصرة ومرتبة (ليست فقرات طويلة).
- شرائح bullets فيها 3-5 نقاط مختصرة.
- شرائح content فيها body قصير 2-4 جمل.
- شريحة الكويز (quiz) فيها سؤال + 4 خيارات + الإجابة الصحيحة + شرح قصير.
- شريحة النشاط (activity) فيها instructions موجزة + قائمة questions (5-8 أسئلة اختيار من متعدد) + اختر gameType الأنسب من: wameed (سؤال وجواب سريع) / million (مسابقة من سيربح المليون) / memory (لعبة الذاكرة) / tug (شد الحبل بين فريقين) / scramble (الكلمات المبعثرة).
- شريحة النقاش (discussion) فيها discussionPrompt + discussionPoints (3-4 محاور للنقاش).
- اكتب speakerNotes قصيرة لكل شريحة (2-3 جمل توجه المعلم ماذا يقول).
- ضع id فريد لكل شريحة مثل: "s1", "s2", ...
- نوّع الإيموجيز ولا تكررها.

أعد النتيجة بتنسيق JSON فقط بدون أي نص قبل أو بعد. الشكل:
{
  "slides": [
    {
      "id": "s1",
      "type": "cover",
      "title": "...",
      "subtitle": "...",
      "emoji": "📚",
      "speakerNotes": "..."
    },
    {
      "id": "s2",
      "type": "objectives",
      "title": "أهداف الدرس",
      "bullets": ["...", "...", "..."],
      "emoji": "🎯",
      "speakerNotes": "..."
    },
    {
      "id": "s3",
      "type": "content",
      "title": "...",
      "body": "...",
      "emoji": "💡",
      "speakerNotes": "..."
    },
    {
      "id": "s4",
      "type": "bullets",
      "title": "...",
      "bullets": ["...", "...", "..."],
      "emoji": "📌",
      "speakerNotes": "..."
    },
    {
      "id": "s5",
      "type": "quiz",
      "title": "اختبر فهمك",
      "emoji": "❓",
      "question": {
        "text": "...",
        "optionA": "...",
        "optionB": "...",
        "optionC": "...",
        "optionD": "...",
        "correctAnswer": "B",
        "explanation": "..."
      },
      "speakerNotes": "..."
    },
    {
      "id": "s6",
      "type": "activity",
      "title": "نشاط جماعي",
      "emoji": "🎮",
      "activity": {
        "gameType": "wameed",
        "instructions": "...",
        "questions": [
          {"text": "...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A","points":1}
        ]
      },
      "speakerNotes": "..."
    },
    {
      "id": "s7",
      "type": "discussion",
      "title": "حوار وتفكير",
      "emoji": "💬",
      "discussionPrompt": "...",
      "discussionPoints": ["...", "...", "..."],
      "speakerNotes": "..."
    },
    {
      "id": "sN",
      "type": "summary",
      "title": "خلاصة الدرس",
      "emoji": "✨",
      "bullets": ["...", "...", "..."],
      "speakerNotes": "..."
    }
  ],
  "coverEmoji": "📚",
  "description": "وصف قصير للدرس (جملة واحدة)"
}

مهم: نوّز مواضع الإجابات الصحيحة في الكويز والأنشطة بين A وB وC وD.`;

  try {
    const tier = await resolveTier(req.session.teacherId, (req.body as { tier?: string })?.tier);
    const responseText = await runTierCompletion({ tier, prompt, maxTokens: 16000 });
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد العرض. حاول مرة أخرى." });
      return;
    }
    let parsedJson: { slides?: unknown; coverEmoji?: string; description?: string };
    try {
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة. حاول مرة أخرى." });
      return;
    }
    if (!parsedJson.slides || !Array.isArray(parsedJson.slides)) {
      res.status(500).json({ message: "لم يتم توليد شرائح صالحة." });
      return;
    }
    /* Light normalisation: ensure each slide has an id and a type. */
    const cleaned = parsedJson.slides
      .map((raw, idx) => {
        const s = raw as Record<string, unknown>;
        const safe = {
          id: typeof s.id === "string" && s.id ? s.id : `s${idx + 1}`,
          type: typeof s.type === "string" ? s.type : "content",
          title: typeof s.title === "string" ? s.title : null,
          subtitle: typeof s.subtitle === "string" ? s.subtitle : null,
          body: typeof s.body === "string" ? s.body : null,
          bullets: Array.isArray(s.bullets) ? s.bullets.filter((b) => typeof b === "string") : null,
          emoji: typeof s.emoji === "string" ? s.emoji : "📄",
          speakerNotes: typeof s.speakerNotes === "string" ? s.speakerNotes : null,
          question: s.question ?? null,
          activity: s.activity ?? null,
          discussionPrompt: typeof s.discussionPrompt === "string" ? s.discussionPrompt : null,
          discussionPoints: Array.isArray(s.discussionPoints) ? s.discussionPoints.filter((p) => typeof p === "string") : null,
          imageUrl: typeof s.imageUrl === "string" ? s.imageUrl : null,
          videoUrl: typeof s.videoUrl === "string" ? s.videoUrl : null,
        };
        const validTypes = ["cover","content","bullets","quiz","activity","discussion","image","video","summary","objectives","warmup"];
        if (!validTypes.includes(safe.type)) safe.type = "content";
        return safe;
      });

    res.json({
      slides: cleaned,
      coverEmoji: typeof parsedJson.coverEmoji === "string" ? parsedJson.coverEmoji : "📚",
      description: typeof parsedJson.description === "string" ? parsedJson.description : null,
    });
  } catch (err) {
    req.log.error({ err }, "Generate presentation failed");
    res.status(500).json({ message: "تعذّر توليد العرض. حاول مرة أخرى." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/presentations/:id/ai-fill-slide
   Body: { slideId: string, hint?: string }
   Uses Claude Sonnet to fill in the body of a slide given its title.
   Returns a partial slide patch matching the slide's type.
   ───────────────────────────────────────────────────────────── */
const aiFillBody = z.object({
  slideId: z.string().min(1),
  hint: z.string().max(500).optional(),
});

router.post("/presentations/:id/ai-fill-slide", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const parsed = aiFillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }

  const [pres] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.id, id), eq(presentationsTable.teacherId, req.session.teacherId)))
    .limit(1);
  if (!pres) {
    res.status(404).json({ message: "العرض غير موجود" });
    return;
  }

  const slides = (pres.slides as Array<Record<string, unknown>>) || [];
  const slide = slides.find((s) => s.id === parsed.data.slideId);
  if (!slide) {
    res.status(404).json({ message: "الشريحة غير موجودة" });
    return;
  }

  const slideType = (slide.type as string) || "content";
  const title = (slide.title as string | null | undefined)?.trim() || "";
  if (!title) {
    res.status(400).json({ message: "اكتب عنوان الشريحة أولاً" });
    return;
  }

  const lang = (pres.language as string) === "en" ? "en" : "ar";
  const subject = (pres.subject as string | null) || "";
  const grade = (pres.gradeLevel as string | null) || "";
  const hint = parsed.data.hint?.trim() || "";

  const langDirective =
    lang === "ar"
      ? "اكتب كل المحتوى باللغة العربية الفصحى المبسّطة المناسبة للمعلمين والطلاب."
      : "Write all content in clear, classroom-appropriate English.";

  const contextLines = [
    subject ? (lang === "ar" ? `المادة: ${subject}` : `Subject: ${subject}`) : "",
    grade ? (lang === "ar" ? `المرحلة الدراسية: ${grade}` : `Grade level: ${grade}`) : "",
    hint ? (lang === "ar" ? `إرشاد المعلم: ${hint}` : `Teacher hint: ${hint}`) : "",
  ]
    .filter(Boolean)
    .join("\n");

  let schemaInstruction = "";
  switch (slideType) {
    case "cover":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON بهذا الشكل فقط: {"subtitle": "<عنوان فرعي قصير 6-12 كلمة>", "emoji": "<إيموجي واحد مناسب>"}`
          : `Return JSON only: {"subtitle": "<6-12 word subtitle>", "emoji": "<one fitting emoji>"}`;
      break;
    case "content":
    case "warmup":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"body": "<فقرة شرح من 3-5 جمل واضحة>"}`
          : `Return JSON: {"body": "<3-5 sentence explanation paragraph>"}`;
      break;
    case "bullets":
    case "summary":
    case "objectives":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"bullets": ["<نقطة قصيرة>", ...]} بحيث تكون 4 إلى 6 نقاط، كل نقطة جملة كاملة قصيرة.`
          : `Return JSON: {"bullets": ["<short point>", ...]} with 4 to 6 short, complete-sentence points.`;
      break;
    case "quiz":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"question": {"text": "<نص السؤال>", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "A|B|C|D", "explanation": "<شرح موجز للإجابة الصحيحة>"}}`
          : `Return JSON: {"question": {"text": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "A|B|C|D", "explanation": "<brief why>"}}`;
      break;
    case "activity": {
      const gameType =
        ((slide.activity as Record<string, unknown> | null | undefined)?.gameType as string) ||
        "wameed";
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"activity": {"gameType": "${gameType}", "instructions": "<تعليمات قصيرة للطلاب>", "questions": [{"text": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctAnswer": "A|B|C|D", "points": 1}, ...]} مع 4 أسئلة بالضبط مناسبة للعبة (${gameType}).`
          : `Return JSON: {"activity": {"gameType": "${gameType}", "instructions": "...", "questions": [...4 MCQs...]}} with exactly 4 questions appropriate for game (${gameType}).`;
      break;
    }
    case "discussion":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"discussionPrompt": "<سؤال نقاش رئيسي مفتوح>", "discussionPoints": ["<نقطة>", "<نقطة>", "<نقطة>", "<نقطة>"]} بأربع نقاط نقاش.`
          : `Return JSON: {"discussionPrompt": "<main open question>", "discussionPoints": [...4 talking points...]}`;
      break;
    case "image":
    case "video":
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"body": "<وصف توضيحي لما يجب أن يراه/يسمعه الطلاب وكيف يربطونه بعنوان الشريحة، 2-4 جمل>"}`
          : `Return JSON: {"body": "<2-4 sentence description tying the media to the title>"}`;
      break;
    default:
      schemaInstruction =
        lang === "ar"
          ? `أعد JSON: {"body": "<فقرة شرح قصيرة 3-5 جمل>"}`
          : `Return JSON: {"body": "<3-5 sentence explanation>"}`;
  }

  /* When the deck uses the "ai" pattern, also ask the AI to pick a per-slide
     background gradient that visually fits the slide's topic. The picked
     classes must come from the AI_GRADIENT_FROM / AI_GRADIENT_TO whitelists
     so Tailwind has them in the bundle. */
  const isAiPattern = (pres.pattern as string) === "ai";
  const customBgInstruction = isAiPattern
    ? (lang === "ar"
        ? `أيضاً، اختر تدرّجاً لونياً ملائماً جدّاً لمحتوى وعنوان الشريحة (مثلاً ألوان زاهية للأنشطة، ألوان دافئة للمواضيع الإيجابية، ألوان داكنة للمواضيع الجادة). أضف الحقل التالي إلى الكائن: "customBackground": {"gradientFrom": "<من القائمة>", "gradientTo": "<من القائمة>", "textOnLight": <true إذا كانت الخلفية فاتحة جدّاً يحتاج النص الأسود وإلا false>}.\nالقيم المسموح بها لـ gradientFrom (اختر واحدة بالضبط):\n${AI_GRADIENT_FROM.join(", ")}\nالقيم المسموح بها لـ gradientTo (اختر واحدة بالضبط):\n${AI_GRADIENT_TO.join(", ")}`
        : `Also pick a gradient that visually fits the slide's topic (e.g. bright for activities, warm for positive topics, dark for serious ones). Add to the object: "customBackground": {"gradientFrom": "<from list>", "gradientTo": "<from list>", "textOnLight": <true only if the background is so light it needs dark text, else false>}.\nAllowed gradientFrom values (pick exactly one):\n${AI_GRADIENT_FROM.join(", ")}\nAllowed gradientTo values (pick exactly one):\n${AI_GRADIENT_TO.join(", ")}`)
    : "";

  const userPrompt = [
    lang === "ar"
      ? `أنت مساعد تربوي يساعد المعلم على إعداد شريحة عرض. عنوان الشريحة هو: «${title}».`
      : `You are an instructional assistant helping a teacher author one slide. The slide title is: "${title}".`,
    contextLines,
    schemaInstruction,
    customBgInstruction,
    lang === "ar"
      ? "أعد كائن JSON واحد فقط بدون أي نص آخر، بدون علامات ```."
      : "Return ONLY a single JSON object, no prose, no ``` fences.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    /* Honour the teacher's resolved AI tier (claude → Anthropic, pro/standard
       → OpenAI). Bypassing this would leak Claude usage to non-claude tiers
       and break paid-tier access controls. */
    const tier = await resolveTier(req.session.teacherId, undefined);
    const systemPrompt =
      lang === "ar"
        ? `${langDirective} كن دقيقاً ومناسباً للسن. التزم تماماً بصيغة JSON المطلوبة.`
        : `${langDirective} Be accurate and age-appropriate. Strictly follow the requested JSON shape.`;
    const raw = await runTierCompletion({
      tier,
      prompt: userPrompt,
      maxTokens: 1500,
      system: systemPrompt,
    });
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    let patch: Record<string, unknown>;
    try {
      patch = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) {
        req.log.error({ raw }, "AI fill: no JSON in response");
        res.status(502).json({ message: "تعذّر فهم رد الذكاء الاصطناعي" });
        return;
      }
      patch = JSON.parse(cleaned.slice(start, end + 1));
    }

    /* These shapes MUST match what the prompt asked for AND what the persisted
       slideSchema expects (text/optionA..D/correctAnswer). Drift here causes
       silent 502s for quiz / activity slides. */
    const quizQuestionSchema = z.object({
      text: z.string().min(1).max(500),
      optionA: z.string().min(1).max(300),
      optionB: z.string().min(1).max(300),
      optionC: z.string().min(1).max(300),
      optionD: z.string().min(1).max(300),
      correctAnswer: z.enum(["A", "B", "C", "D"]),
      explanation: z.string().max(800).nullish(),
    });

    const activityQuestionSchema = z.object({
      text: z.string().min(1).max(500),
      optionA: z.string().min(1).max(300),
      optionB: z.string().min(1).max(300),
      optionC: z.string().min(1).max(300),
      optionD: z.string().min(1).max(300),
      correctAnswer: z.enum(["A", "B", "C", "D"]),
      points: z.number().int().min(1).max(10).optional(),
    });

    /* Each per-type schema also allows an optional customBackground (only
       expected when pres.pattern === "ai", but harmless to accept otherwise —
       the client only honours it for the "ai" pattern). */
    const cb = customBackgroundSchema.optional();
    const patchSchemas: Record<string, z.ZodTypeAny> = {
      cover: z.object({
        subtitle: z.string().max(500).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      content: z.object({
        body: z.string().max(3000).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      warmup: z.object({
        body: z.string().max(2000).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      bullets: z.object({
        bullets: z.array(z.string().min(1).max(400)).min(2).max(10).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      summary: z.object({
        bullets: z.array(z.string().min(1).max(400)).min(2).max(10).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      objectives: z.object({
        bullets: z.array(z.string().min(1).max(400)).min(2).max(10).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      quiz: z.object({
        question: quizQuestionSchema.optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      activity: z.object({
        activity: z.object({
          gameType: z.string().optional(),
          instructions: z.string().max(1000).optional(),
          questions: z.array(activityQuestionSchema).max(20).optional(),
        }).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
      discussion: z.object({
        discussionPrompt: z.string().max(1000).optional(),
        discussionPoints: z.array(z.string().min(1).max(400)).min(2).max(10).optional(),
        emoji: z.string().max(8).optional(),
        customBackground: cb,
      }),
    };

    const schema = patchSchemas[slideType] ?? z.object({ customBackground: cb }).passthrough();
    const parsed = schema.safeParse(patch);
    if (!parsed.success) {
      req.log.error({ raw, issues: parsed.error.issues, slideType }, "AI fill: schema validation failed");
      res.status(502).json({ message: "تعذّر فهم رد الذكاء الاصطناعي" });
      return;
    }
    const safePatch = parsed.data as Record<string, unknown>;

    if (slideType === "activity" && safePatch.activity) {
      const incoming = safePatch.activity as Record<string, unknown>;
      const existing = (slide.activity as Record<string, unknown> | null) || {};
      safePatch.activity = {
        gameType: existing.gameType || incoming.gameType || "wameed",
        instructions: incoming.instructions ?? existing.instructions ?? "",
        questions: Array.isArray(incoming.questions) ? incoming.questions : [],
      };
    }

    res.json({ patch: safePatch });
  } catch (err) {
    req.log.error({ err }, "AI fill slide failed");
    res.status(500).json({ message: "تعذّر توليد المحتوى. حاول مرة أخرى." });
  }
});

export default router;
