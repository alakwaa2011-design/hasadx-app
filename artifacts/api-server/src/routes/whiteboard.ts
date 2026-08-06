import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";
import { resolveTier, isClaudeTier, type AiTier } from "../lib/ai-tier";

const router: IRouter = Router();

// ── Auth helpers ─────────────────────────────────────────────────────────────

function requireTeacher(req: any, res: any, next: any) {
  if (req.session?.teacherId) return next();
  res.status(401).json({ message: "Unauthorized" });
}

// ── AI helpers ────────────────────────────────────────────────────────────────

async function runCompletion(opts: {
  tier: AiTier;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const max = opts.maxTokens ?? 5000;
  if (isClaudeTier(opts.tier)) {
    const r = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: max,
      messages: [{ role: "user", content: opts.prompt }],
    });
    return (r.content[0] as any)?.text ?? "";
  }
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: max,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return r.choices[0]?.message?.content ?? "";
}

function parseJsonLoose(text: string): any {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* keep trying */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) { try { return JSON.parse(fence[1]); } catch { /* ignore */ } }
  const first = t.indexOf("{"); const last = t.lastIndexOf("}");
  if (first !== -1 && last > first) { try { return JSON.parse(t.slice(first, last + 1)); } catch { /* ignore */ } }
  return null;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const boardActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("writeText"), content: z.string(), color: z.string().optional() }),
  z.object({ type: z.literal("writeMath"), content: z.string(), color: z.string().optional() }),
  z.object({ type: z.literal("drawArrow"), label: z.string().optional(), color: z.string().optional() }),
  z.object({ type: z.literal("drawCircle"), label: z.string().optional(), color: z.string().optional() }),
  z.object({ type: z.literal("highlight"), content: z.string(), color: z.string().optional() }),
  z.object({ type: z.literal("underline"), content: z.string(), color: z.string().optional() }),
  z.object({ type: z.literal("showDiagram"), description: z.string() }),
  z.object({ type: z.literal("erase") }),
  z.object({ type: z.literal("clearBoard") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("bullet"), content: z.string(), color: z.string().optional() }),
  z.object({
    type: z.literal("showImage"),
    imageQuery: z.string(),
    description: z.string(),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("drawConnector"),
    from: z.string(),            // left/start concept
    to: z.string(),              // right/end concept
    label: z.string().optional(),// optional middle arrow label
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("showChart"),
    description: z.string(),     // chart title, read aloud
    data: z.array(z.object({ label: z.string(), value: z.number() })),
    color: z.string().optional(),
  }),
]);

const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  voiceText: z.string(),
  boardActions: z.array(boardActionSchema),
});

const lessonPlanSchema = z.object({
  title: z.string(),
  topic: z.string(),
  subject: z.string().optional(),
  gradeLevel: z.string().optional(),
  intro: z.object({
    voiceText: z.string(),
    boardActions: z.array(boardActionSchema),
  }),
  steps: z.array(stepSchema).min(1),
  summary: z.object({
    voiceText: z.string(),
    boardActions: z.array(boardActionSchema),
  }),
  keyPoints: z.array(z.string()).optional(),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;
export type LessonStep = z.infer<typeof stepSchema>;
export type BoardAction = z.infer<typeof boardActionSchema>;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildLessonPrompt(opts: {
  topic: string;
  subject?: string;
  gradeLevel?: string;
  depth: "brief" | "standard" | "detailed";
  language: "ar" | "en";
}): string {
  const ar = opts.language === "ar";

  const depthLabel = ar
    ? ({ brief: "موجز (١٠ دقائق)", standard: "عادي (٢٠ دقيقة)", detailed: "تفصيلي (٣٠ دقيقة)" })[opts.depth]
    : ({ brief: "brief (10 min)", standard: "standard (20 min)", detailed: "detailed (30 min)" })[opts.depth];

  const stepsCount = { brief: "3-4", standard: "4-5", detailed: "5-6" }[opts.depth];

  const colorGuide = ar
    ? `ألوان السبورة: "white" للنص العادي، "yellow" للعناوين، "green" للإجابات والنتائج، "pink" للأمثلة، "blue" للتعريفات والقوانين.`
    : `Colors: "white" normal, "yellow" titles, "green" answers, "pink" examples, "blue" definitions.`;

  const boardActionsList = ar
    ? `أنواع boardActions المتاحة — استخدمها بذكاء حسب الحاجة:
- bullet: { type, content, color } — نقطة مختصرة (3-6 كلمات)
- highlight: { type, content, color } — مصطلح أو قانون رئيسي (2-5 كلمات) — لأهم فكرة في الخطوة
- writeText: { type, content, color } — جملة قصيرة شارحة
- writeMath: { type, content, color } — معادلة LaTeX. مثال: \\frac{1}{2} أو a^2 + b^2 = c^2. استخدم لأي صيغة رياضية.
- drawArrow: { type, label, color } — سهم بعلامة — للتسلسل أو الاتجاه (مثال: label:"يسخن → يتمدد")
- drawConnector: { type, from, to, label?, color } — ربط مفهومين بسهم. from/to: كلمة أو عبارة قصيرة. مثال: from:"النبتة" to:"الطاقة" label:"تمتص". استخدم لعلاقات السبب والنتيجة أو التحول أو الدورات.
- drawCircle: { type, label, color } — دائرة حول مصطلح أساسي
- showChart: { type, description, data:[{label,value},...], color } — مخطط أعمدة للمقارنات الكمية. description يُقرأ صوتاً. استخدم عند وجود أرقام قابلة للمقارنة (سرعات، أعداد، نسب). مثال: data:[{label:"الفهد",value:120},{label:"الحصان",value:70}]
- showImage: { type, imageQuery, description, color } — صورة من ويكيبيديا. imageQuery بالإنجليزية. استخدم للأحياء، الجغرافيا، الفلك، التاريخ، الفيزياء — مرة واحدة فقط في الدرس.
- clearBoard: { type } — مسح (نادراً جداً)
قاعدة ذهبية: كل خطوة يجب أن تحتوي على عنصر بصري واحد على الأقل (drawConnector أو showChart أو drawArrow أو showImage) إذا كان الموضوع يسمح بذلك.`
    : `Available boardActions — use smartly as needed:
- bullet: { type, content, color } — short point (3-6 words)
- highlight: { type, content, color } — key term or rule (2-5 words)
- writeText: { type, content, color } — short explanatory sentence
- writeMath: { type, content, color } — LaTeX formula. E.g. \\frac{1}{2} or a^2+b^2=c^2
- drawArrow: { type, label, color } — labeled arrow for sequence/direction
- drawConnector: { type, from, to, label?, color } — connects two concepts with an arrow. E.g. from:"Heat" to:"Expansion" label:"causes". Use for cause/effect, input/output, transformations, cycles.
- drawCircle: { type, label, color } — circles a key term
- showChart: { type, description, data:[{label,value},...], color } — bar chart for quantitative comparisons. Use when numbers/quantities can be compared (speeds, counts, percentages). E.g. data:[{label:"Cheetah",value:120},{label:"Horse",value:70}]
- showImage: { type, imageQuery, description, color } — Wikipedia image. imageQuery in English. Use for biology, geography, astronomy, history, physics — at most ONCE per lesson.
- clearBoard: { type } — clear board (rarely)
Golden rule: every step should include at least one visual element (drawConnector, showChart, drawArrow, or showImage) if the topic allows it.`;

  const sysPrompt = ar
    ? `أنت معلم متحمس يقدم أبرز نقاط الدرس على السبورة بسرعة وحيوية. أسلوبك: مختصر ومثير — تُلقي الفكرة بجملة واحدة قوية، ثم تكتب على السبورة النقاط الجوهرية فقط. لا شرح مطوّل، لا تكرار — فقط اللحظات التي تجعل الطالب يقول "آه فهمت!".`
    : `You are an enthusiastic teacher who highlights lesson key points on the board quickly and energetically. Your style: punchy and exciting — one strong sentence, then the essential points on the board. No long explanations, no repetition — only the moments that make students say "I got it!"`;

  const rules = ar ? `
قواعد صارمة:
- أعد JSON نقياً فقط، بدون أي نص خارجه.
- الحقول: title, topic, subject, gradeLevel, intro, steps, summary, keyPoints.
- intro: { voiceText, boardActions[] } — جملة واحدة قصيرة ومثيرة تفتح الشهية. boardActions: عنوان الدرس فقط.
- steps: ${stepsCount} خطوات، كل خطوة: id, title (2-3 كلمات), voiceText (جملة واحدة — حماسية ومركّزة، تذكر الفكرة الأساسية مباشرةً بدون مقدمات), boardActions (2-4 عناصر: bullet/highlight للنص + drawConnector أو showChart أو drawArrow أو showImage لعنصر بصري واحد إن أضاف قيمة).
- summary: { voiceText, boardActions[] } — جملة ختامية تُعيد تثبيت الفكرة المحورية بإيجاز. boardActions: highlight واحد للمفهوم الجوهري.
- keyPoints: 3-4 نقاط قصيرة جداً (3-6 كلمات لكل نقطة).
- voiceText: جملة واحدة فقط — مباشرة، متحمسة، تصل للب الفكرة. لا مقدمات، لا عبارات مثل "سنتعلم اليوم" أو "دعونا نرى".
- كل bullet: 3-6 كلمات — فكرة مركّزة لا جملة.
- highlight: أهم مصطلح أو قانون في الخطوة — 2-5 كلمات.
- لا تضيف clearBoard إطلاقاً.
- ${colorGuide}
- ${boardActionsList}
` : `
Strict rules:
- Return STRICT JSON only.
- Required: title, topic, subject, gradeLevel, intro, steps, summary, keyPoints.
- intro: one short exciting sentence to spark curiosity. boardActions: lesson title only.
- steps: ${stepsCount} steps, each: id, title (2-3 words), voiceText (ONE sentence — punchy and direct, gets straight to the key idea, no warm-up phrases), boardActions (1-3 items only: short bullets + highlight for the main concept + writeMath for formulas + showImage when needed).
- summary: one closing sentence that stamps the core idea. boardActions: one highlight with the essential concept.
- keyPoints: 3-4 items, 3-6 words each.
- voiceText: ONE sentence only — direct, energetic, gets to the point. No "Today we will learn" or "Let us explore".
- Each bullet: 3-6 words — a focused idea, not a full sentence.
- highlight: the most important term or rule — 2-5 words.
- Never use clearBoard.
- ${colorGuide}
- ${boardActionsList}
`;

  return [
    sysPrompt,
    ar ? `موضوع الدرس: ${opts.topic}` : `Lesson topic: ${opts.topic}`,
    opts.subject ? (ar ? `المادة الدراسية: ${opts.subject}` : `Subject: ${opts.subject}`) : "",
    opts.gradeLevel ? (ar ? `المرحلة الدراسية: ${opts.gradeLevel}` : `Grade level: ${opts.gradeLevel}`) : "",
    ar ? `مدة الشرح: ${depthLabel}` : `Lesson depth: ${depthLabel}`,
    rules,
  ].filter(Boolean).join("\n");
}

// ── POST /api/whiteboard/generate ─────────────────────────────────────────────
const generateBody = z.object({
  topic: z.string().min(2).max(500),
  language: z.enum(["ar", "en"]).default("ar"),
  subject: z.string().max(100).optional(),
  gradeLevel: z.string().max(50).optional(),
  depth: z.enum(["brief", "standard", "detailed"]).default("standard"),
});

router.post("/whiteboard/generate", requireTeacher, async (req, res) => {
  try {
    const body = generateBody.parse(req.body);
    const tier: AiTier = await resolveTier(req.session.teacherId as number);
    const prompt = buildLessonPrompt({
      topic: body.topic,
      subject: body.subject,
      gradeLevel: body.gradeLevel,
      depth: body.depth,
      language: body.language,
    });
    const rawText = await runCompletion({ tier, prompt, maxTokens: 6000 });
    const json = parseJsonLoose(rawText);
    if (!json) {
      res.status(500).json({ message: "تنسيق غير صالح من النموذج" }); return;
    }
    const validated = lessonPlanSchema.safeParse(json);
    if (!validated.success) {
      if (json.steps && Array.isArray(json.steps) && json.steps.length > 0) {
        res.json({ plan: json }); return;
      }
      req.log.warn({ issues: validated.error.issues }, "whiteboard generate schema mismatch");
      res.status(500).json({ message: "تعذّر توليد خطة الدرس" }); return;
    }
    res.json({ plan: validated.data });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ message: "إدخال غير صالح" }); return; }
    req.log.error({ err }, "whiteboard generate failed");
    res.status(500).json({ message: "تعذّر توليد خطة الدرس" });
  }
});

// ── POST /api/whiteboard/lessons ──────────────────────────────────────────────
const saveLessonBody = z.object({
  topic: z.string().min(1).max(500),
  plan: z.record(z.any()),
  subject: z.string().max(100).optional(),
  gradeLevel: z.string().max(50).optional(),
  depth: z.string().max(20).optional(),
  language: z.enum(["ar", "en"]).default("ar"),
});

router.post("/whiteboard/lessons", requireTeacher, async (req, res) => {
  try {
    const body = saveLessonBody.parse(req.body);
    const teacherId = req.session.teacherId as number;
    const result = await db.execute(sql`
      INSERT INTO whiteboard_sessions
        (teacher_id, question, plan, subject, grade_level, level, language)
      VALUES
        (${teacherId}, ${body.topic}, ${JSON.stringify(body.plan)}::jsonb,
         ${body.subject ?? null}, ${body.gradeLevel ?? null}, ${body.depth ?? null}, ${body.language})
      RETURNING id, created_at
    `);
    const row = (result.rows ?? result as any)[0];
    res.json({ id: row.id, createdAt: row.created_at });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ message: "إدخال غير صالح" }); return; }
    req.log.error({ err }, "whiteboard save lesson failed");
    res.status(500).json({ message: "تعذّر حفظ الدرس" });
  }
});

// ── GET /api/whiteboard/lessons ───────────────────────────────────────────────
router.get("/whiteboard/lessons", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const result = await db.execute(sql`
      SELECT id, question AS topic, subject, grade_level, level, language, created_at
      FROM whiteboard_sessions
      WHERE teacher_id = ${teacherId}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json({ lessons: result.rows ?? result });
  } catch (err) {
    req.log.error({ err }, "whiteboard list lessons failed");
    res.status(500).json({ message: "تعذّر جلب الدروس" });
  }
});

// ── GET /api/whiteboard/lessons/:id ──────────────────────────────────────────
router.get("/whiteboard/lessons/:id", requireTeacher, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const teacherId = req.session.teacherId as number;
    const result = await db.execute(sql`
      SELECT * FROM whiteboard_sessions
      WHERE id = ${id} AND teacher_id = ${teacherId}
    `);
    const row = (result.rows ?? result as any)[0];
    if (!row) { res.status(404).json({ message: "الدرس غير موجود" }); return; }
    res.json({ lesson: { ...row, topic: row.question } });
  } catch (err) {
    req.log.error({ err }, "whiteboard get lesson failed");
    res.status(500).json({ message: "تعذّر جلب الدرس" });
  }
});

// ── GET /api/whiteboard/image ─────────────────────────────────────────────────
// Fetches a Wikipedia thumbnail for educational image display on the whiteboard.
const imageCache = new Map<string, { url: string; alt: string }>();

router.get("/whiteboard/image", requireTeacher, async (req, res) => {
  const q = ((req.query.q as string) ?? "").trim().slice(0, 200);
  if (!q) { res.status(400).json({ error: "missing q" }); return; }

  const cached = imageCache.get(q);
  if (cached) { res.json(cached); return; }

  try {
    const title = encodeURIComponent(q.replace(/ /g, "_"));
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { headers: { "User-Agent": "Hasad-Education/1.0 (classroom app; https://hasad.app)" } }
    );
    if (!wikiRes.ok) { res.status(404).json({ error: "not found" }); return; }
    const data = await wikiRes.json() as any;
    const url: string | undefined = data.thumbnail?.source ?? data.originalimage?.source;
    if (!url) { res.status(404).json({ error: "no image available" }); return; }
    const result = { url, alt: data.description ?? q };
    if (imageCache.size > 200) imageCache.clear(); // simple eviction
    imageCache.set(q, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "whiteboard image fetch failed");
    res.status(500).json({ error: "fetch failed" });
  }
});

// ── PUT /api/whiteboard/lessons/:id ──────────────────────────────────────────
router.put("/whiteboard/lessons/:id", requireTeacher, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const teacherId = req.session.teacherId as number;
    const body = saveLessonBody.parse(req.body);
    const result = await db.execute(sql`
      UPDATE whiteboard_sessions
      SET plan     = ${JSON.stringify(body.plan)}::jsonb,
          question = ${body.topic}
      WHERE id = ${id} AND teacher_id = ${teacherId}
      RETURNING id
    `);
    const updated = (result.rows ?? result as any)[0];
    if (!updated) { res.status(404).json({ message: "الدرس غير موجود" }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.issues) { res.status(400).json({ message: "إدخال غير صالح" }); return; }
    req.log.error({ err }, "whiteboard update lesson failed");
    res.status(500).json({ message: "تعذّر حفظ التغييرات" });
  }
});

// ── DELETE /api/whiteboard/lessons/:id ───────────────────────────────────────
router.delete("/whiteboard/lessons/:id", requireTeacher, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const teacherId = req.session.teacherId as number;
    await db.execute(sql`
      DELETE FROM whiteboard_sessions
      WHERE id = ${id} AND teacher_id = ${teacherId}
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "whiteboard delete lesson failed");
    res.status(500).json({ message: "تعذّر حذف الدرس" });
  }
});

export default router;
