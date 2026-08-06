import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  geocodeMemCache,
  dbGeocacheLookup,
  dbGeocacheStore,
  fetchFromNominatim,
} from "../lib/geocode-nominatim";
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
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("showChart"),
    description: z.string(),
    data: z.array(z.object({ label: z.string(), value: z.number() })),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal("showLocation"),
    name: z.string(),            // city / place name in Arabic
    country: z.string().optional(),
    description: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
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
- showLocation: { type, name, country?, description?, color } — بطاقة موقع جغرافي بأسلوب طباشيري. استخدم عند ذكر مدينة أو دولة أو معلم جغرافي. مثال: name:"الرياض" country:"المملكة العربية السعودية" description:"على هضبة نجد، مركز شبه الجزيرة"
- clearBoard: { type } — مسح (نادراً جداً)
قاعدة ذهبية: كل خطوة تحتوي على عنصر بصري واحد على الأقل — اختر الأنسب للمحتوى (موقع جغرافي، مخطط، رابط مفهومي، صورة).`
    : `Available boardActions — use smartly as needed:
- bullet: { type, content, color } — short point (3-6 words)
- highlight: { type, content, color } — key term or rule (2-5 words)
- writeText: { type, content, color } — short explanatory sentence
- writeMath: { type, content, color } — LaTeX formula. E.g. \\frac{1}{2} or a^2+b^2=c^2
- drawArrow: { type, label, color } — labeled arrow for sequence/direction
- drawConnector: { type, from, to, label?, color } — connects two concepts with an arrow
- drawCircle: { type, label, color } — circles a key term
- showChart: { type, description, data:[{label,value},...], color } — bar chart for comparisons
- showImage: { type, imageQuery, description, color } — Wikipedia image. imageQuery in English. Use for biology, geography, astronomy, history — at most ONCE per lesson.
- showLocation: { type, name, country?, description?, color } — chalk-style location card. Use when a city, country, or landmark is the topic. E.g. name:"Cairo" country:"Egypt" description:"On the Nile delta, founded 969 AD"
- clearBoard: { type } — clear board (rarely)
Golden rule: every step includes at least one visual element — choose the most fitting (location card, chart, connector, image).`;

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
// ?type=ask  → Q&A history only
// ?type=lesson (or omitted) → full lessons only
router.get("/whiteboard/lessons", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const type = (req.query.type as string | undefined) ?? "lesson";
    let result;
    if (type === "ask") {
      result = await db.execute(sql`
        SELECT id, question AS topic, subject, grade_level, level, language, created_at
        FROM whiteboard_sessions
        WHERE teacher_id = ${teacherId} AND level = 'ask'
        ORDER BY created_at DESC
        LIMIT 100
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, question AS topic, subject, grade_level, level, language, created_at
        FROM whiteboard_sessions
        WHERE teacher_id = ${teacherId} AND (level IS NULL OR level != 'ask')
        ORDER BY created_at DESC
        LIMIT 50
      `);
    }
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

// ── POST /api/whiteboard/ask — instant Q&A answer on the chalkboard ──────────
router.post("/whiteboard/ask", requireTeacher, async (req, res) => {
  try {
    const { question = "", imageBase64 } = req.body as { question?: string; imageBase64?: string };
    if (!question.trim() && !imageBase64) {
      res.status(400).json({ error: "سؤال مطلوب" }); return;
    }

    const KNOWN_TYPES = ["bullet","highlight","writeText","writeTitle","writeMath","drawArrow",
      "drawCircle","drawConnector","showChart","showImage","showLocation","showDiagram","clearBoard","erase"];

    const normalizeActions = (raw: any): any[] => {
      if (!Array.isArray(raw)) return [];
      const out: any[] = [];
      for (const a of raw) {
        // Plain string → bullet
        if (typeof a === "string" && a.trim()) {
          out.push({ type: "bullet", content: a.trim(), color: "white" }); continue;
        }
        if (!a || typeof a !== "object") continue;
        // Correct format: {type, content, ...}
        if (typeof a.type === "string" && KNOWN_TYPES.includes(a.type)) { out.push(a); continue; }
        // Wrong format: {action, element, description} — remap to correct types
        if (typeof a.action === "string" && !a.type) {
          const act = a.action.toLowerCase();
          const content: string = a.element ?? a.description ?? a.content ?? "";
          const desc: string = a.description ?? "";
          const color: string = a.color ?? "white";
          if (act === "highlight")       out.push({ type: "highlight", content: content || desc, color: "yellow" });
          else if (act === "draw" || act === "draw_image" || act === "show_image")
                                          out.push({ type: "showImage", imageQuery: content, description: desc, color: "blue" });
          else if (act === "list" || act === "bullet" || act === "enumerate")
                                          out.push({ type: "bullet", content: desc || content, color });
          else if (act === "compare" || act === "chart")
                                          out.push({ type: "showChart", description: content, data: [], color: "blue" });
          else if (act === "connect" || act === "arrow")
                                          out.push({ type: "drawConnector", from: content, to: desc, color: "orange" });
          else if (act === "write" || act === "text")
                                          out.push({ type: "writeText", content: desc || content, color });
          else                            out.push({ type: "bullet", content: desc || content, color });
          continue;
        }
        // Wrapped form: {"showLocation": {...}} or {"bullet": "text"}
        const keys = Object.keys(a);
        if (keys.length === 1 && KNOWN_TYPES.includes(keys[0])) {
          const inner = a[keys[0]];
          if (typeof inner === "object" && inner !== null) out.push({ type: keys[0], ...inner });
          else if (typeof inner === "string") out.push({ type: keys[0], content: inner });
        }
      }
      return out.filter((a) => {
        if (a.type === "showLocation") return typeof a.name === "string" && a.name.trim();
        if (a.type === "showChart") {
          if (!Array.isArray(a.data) || a.data.length === 0) return false;
          a.data = a.data
            .filter((d: any) => d && typeof d.label === "string" && Number.isFinite(Number(d.value)))
            .map((d: any) => ({ label: d.label, value: Number(d.value) }))
            .slice(0, 10);
          return a.data.length > 0;
        }
        if (a.type === "drawConnector") return typeof a.from === "string" && typeof a.to === "string";
        if (a.type === "showImage") return typeof a.imageQuery === "string" && a.imageQuery.trim();
        return true;
      });
    };

    const systemPrompt = `أنت معلم خبير محترف — مرجعك أفضل معلمي العالم. دورك أن تُقدّم إجابة تعليمية شاملة ومُفصَّلة على السبورة الذكية، موزّعة على مراحل واضحة كما يفعل أي معلم ناجح في الفصل.

━━━ بنية الإجابة المطلوبة ━━━
أعد JSON نقياً بهذا الهيكل بالضبط:
{
  "steps": [
    {
      "id": "1",
      "title": "عنوان المرحلة (3-5 كلمات)",
      "voiceText": "شرح صوتي للمرحلة — فقرة كاملة بالعربية المنطوقة",
      "boardActions": [ ... ]
    },
    ...المزيد من الخطوات
  ]
}

━━━ عدد الخطوات حسب نوع السؤال ━━━
• سؤال بسيط (تعريف، موقع، حقيقة): 2-3 خطوات
• سؤال متوسط (شرح ظاهرة، قانون فيزيائي، قصيدة): 3-4 خطوات  
• سؤال معقد (مقارنة، حل معادلة، تحليل تاريخي، فرق بين مفهومين): 4-6 خطوات

━━━ قواعد voiceText ━━━
• فقرة كاملة لكل خطوة — 2 إلى 5 جمل مترابطة، تشرح بعمق وتربط الأفكار ببعضها.
• ابدأ مباشرةً بالمعلومة — لا مقدمات، لا "سنتعلم اليوم"، لا "سؤال رائع".
• كلمات افتتاح محظورة: "صحيح، تماماً، بالتأكيد، بالطبع، بالضبط، معك حق، ممتاز، حسناً، دعنا، تفضّل"
• لا تختم بـ: "أنا هنا للمساعدة، إذا احتجت سؤالاً، أتمنى أن أكون أفدتك"
• للرياضيات: اشرح الخطوات بكلام عربي منطوق — لا رموز LaTeX في voiceText إطلاقاً.
  ✓ "المميز يساوي ب تربيع ناقص أربعة أ جيم"  
  ✗ "\\Delta = b^2 - 4ac"

━━━ قواعد boardActions الصارمة ━━━
كل عنصر كائن JSON يبدأ بـ "type". لا نصوص مجردة إطلاقاً (ممنوع: "نص عادي" بدون كائن).
لكل خطوة: 3-6 عناصر بصرية تدعم وتُعمّق المعلومة الصوتية.

⛔ الأخطاء الشائعة المحظورة — لا ترتكبها:
• ممنوع: { "action": "highlight", "element": "..." }     →  الصواب: { "type": "highlight", "content": "..." }
• ممنوع: { "action": "draw", "element": "DNA" }          →  الصواب: { "type": "showImage", "imageQuery": "DNA double helix", "description": "...", "color": "blue" }
• ممنوع: { "action": "list", "element": "..." }          →  الصواب: { "type": "bullet", "content": "...", "color": "white" }
• ممنوع: "نص مجرد بدون كائن"                            →  الصواب: { "type": "bullet", "content": "النص هنا", "color": "white" }
• ممنوع: أي كائن لا يحتوي حقل "type"

✅ الأنواع الصحيحة — كل عنصر يبدأ بحقل "type":
{ "type": "writeMath",     "content": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "color": "green" }
{ "type": "bullet",        "content": "نقطة مختصرة 3-8 كلمات", "color": "white" }
{ "type": "highlight",     "content": "مصطلح أو قانون مهم", "color": "yellow" }
{ "type": "writeText",     "content": "جملة توضيحية كاملة", "color": "white" }
{ "type": "drawConnector", "from": "المفهوم الأول", "to": "المفهوم الثاني", "label": "العلاقة", "color": "orange" }
{ "type": "drawArrow",     "label": "التسلسل أو الاتجاه", "color": "white" }
{ "type": "drawCircle",    "label": "مصطلح محوري", "color": "pink" }
{ "type": "showChart",     "description": "عنوان المقارنة", "data": [{"label":"أ","value":10},{"label":"ب","value":20}], "color": "blue" }
{ "type": "showImage",     "imageQuery": "English Wikipedia search term", "description": "وصف عربي", "color": "blue" }
{ "type": "showLocation",  "name": "اسم المكان", "country": "الدولة", "description": "وصف جغرافي", "color": "blue" }

━━━ مثال مرجعي كامل — مقارنة DNA و RNA (انسخ هذه البنية بالضبط) ━━━
{
  "steps": [
    {
      "id": "1", "title": "ما هو الـ DNA؟",
      "voiceText": "الـ DNA هو الحمض النووي الريبوزي منقوص الأكسجين، وهو خارطة الحياة كاملة. يتكون من شريطين ملتفّين على شكل حلزون مزدوج، ويحمل التعليمات الكاملة لبناء كل بروتين في جسمك.",
      "boardActions": [
        { "type": "showImage",  "imageQuery": "DNA double helix structure", "description": "الحلزون المزدوج للـ DNA", "color": "blue" },
        { "type": "highlight",  "content": "حلزون مزدوج الشريط",  "color": "yellow" },
        { "type": "bullet",     "content": "سكر الديوكسيريبوز",    "color": "white" },
        { "type": "bullet",     "content": "قواعد: A T G C",        "color": "white" },
        { "type": "bullet",     "content": "موقعه: نواة الخلية",   "color": "white" }
      ]
    },
    {
      "id": "2", "title": "ما هو الـ RNA؟",
      "voiceText": "الـ RNA هو الحمض النووي الريبوزي، ويعمل كرسول ينقل التعليمات من الـ DNA إلى مصنع البروتين. يختلف في أنه شريط واحد فقط، وأكثر نشاطاً وأقل استقراراً.",
      "boardActions": [
        { "type": "showImage",  "imageQuery": "RNA single strand molecule", "description": "شريط الـ RNA المفرد", "color": "blue" },
        { "type": "highlight",  "content": "شريط مفرد — رسول نشط", "color": "pink" },
        { "type": "bullet",     "content": "سكر الريبوز",           "color": "white" },
        { "type": "bullet",     "content": "قواعد: A U G C",        "color": "white" },
        { "type": "bullet",     "content": "موقعه: النواة والسيتوبلازم", "color": "white" }
      ]
    },
    {
      "id": "3", "title": "الفروق الجوهرية",
      "voiceText": "الفرق الأول في البنية: DNA حلزون مزدوج بينما RNA شريط مفرد. الثاني في السكر: ديوكسيريبوز مقابل ريبوز. والثالث: DNA يستخدم ثايمين بينما RNA يستبدله بيوراسيل.",
      "boardActions": [
        { "type": "showChart",      "description": "مقارنة DNA و RNA", "data": [{"label":"أشرطة DNA","value":2},{"label":"أشرطة RNA","value":1}], "color": "blue" },
        { "type": "drawConnector",  "from": "DNA — ثايمين (T)", "to": "RNA — يوراسيل (U)", "label": "يُستبدل بـ", "color": "orange" },
        { "type": "highlight",      "content": "الاستقرار (DNA) مقابل النشاط (RNA)", "color": "yellow" }
      ]
    }
  ]
}

━━━ استراتيجية التنويع البصري حسب نوع السؤال ━━━

🔢 رياضيات — كل خطوة في معادلة منفصلة:
خطوة 1: المعادلة الأصلية [writeMath] + تعريف المجاهيل [highlight]
خطوة 2: الصيغة المستخدمة [writeMath] + حساب المميز [writeMath]
خطوة 3: تطبيق الصيغة [writeMath] + [drawArrow] + النتيجة [writeMath] + [highlight]

⚗️ مقارنة بين مفهومين (DNA/RNA، نبات/حيوان، إلخ):
خطوة 1: [showImage] للأول + [bullet×3] لخصائصه
خطوة 2: [showImage] للثاني + [bullet×3] لخصائصه  
خطوة 3: [showChart] للمقارنة الكمية + [drawConnector] للعلاقة + [highlight] للفرق الجوهري
خطوة 4: [writeText] للتطبيق أو الأهمية + [bullet×2] لأمثلة

🌍 جغرافيا:
خطوة 1: [showLocation] + [highlight] للاسم والموقع
خطوة 2: [bullet×4] للحقائق الجغرافية والسكانية
خطوة 3: [showChart] للمقارنة مع الجيران + [writeText] للأهمية الاستراتيجية

🔬 علوم وأحياء وفيزياء:
خطوة 1: [showImage] + [writeText] للتعريف
خطوة 2: [drawConnector×2] للآليات + [bullet×3] للخصائص
خطوة 3: [writeMath] للقانون (إن وجد) + [showChart] للأرقام + [highlight] للتطبيق

🏛️ تاريخ وشخصيات:
خطوة 1: [showImage] + [highlight] للاسم والحقبة
خطوة 2: [drawConnector] (السبب→الحدث→النتيجة) + [bullet×3]
خطوة 3: [writeText] للتأثير والإرث + [highlight] للدرس المستفاد

📖 لغة وأدب:
خطوة 1: [highlight] للمصطلح + [writeText] للتعريف الدقيق
خطوة 2: [drawConnector] للفرق + [bullet×3] للسمات + [drawCircle] للمفهوم المحوري
خطوة 3: [writeText] للمثال التطبيقي + [bullet×2] للأمثلة الإضافية

━━━ ألوان السبورة ━━━
yellow=قوانين وتعريفات | green=أمثلة ونتائج رياضية | blue=مواقع وصور | orange=خطوات وعلاقات | white=نص عام | pink=ملاحظات وتنبيهات | red=أخطاء شائعة | purple=مصطلحات متقدمة`;

    let rawJson: string;

    if (imageBase64) {
      const r = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 5000,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } as any },
              { type: "text", text: question.trim() ? `اشرح وحل: ${question}` : "اقرأ المسألة في الصورة وحلّها على السبورة بالتفصيل" },
            ] as any,
          },
        ],
      });
      rawJson = r.choices[0]?.message?.content ?? "{}";
    } else {
      const r = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 5000,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question.trim() },
        ],
      });
      rawJson = r.choices[0]?.message?.content ?? "{}";
    }

    const parsed = parseJsonLoose(rawJson);
    if (!parsed) {
      req.log.error({ rawSample: rawJson.slice(0, 800) }, "whiteboard ask: JSON parse failed");
      res.status(500).json({ error: "تعذّر توليد الإجابة" });
      return;
    }

    // Support both multi-step {steps:[...]} and legacy {voiceText, boardActions}
    let steps: Array<{ id: string; title: string; voiceText: string; boardActions: any[] }>;
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      steps = parsed.steps.map((s: any, i: number) => ({
        id: String(s.id ?? i + 1),
        title: s.title ?? `الخطوة ${i + 1}`,
        voiceText: s.voiceText ?? "",
        boardActions: normalizeActions(s.boardActions),
      })).filter((s: any) => s.voiceText.trim() || s.boardActions.length > 0);
    } else {
      // Legacy fallback
      let actions = normalizeActions(parsed.boardActions);
      if (actions.length === 0 && (parsed.voiceText ?? "").trim()) {
        actions = [{ type: "writeText", content: parsed.voiceText.trim(), color: "white" }];
      }
      steps = [{ id: "1", title: "الإجابة", voiceText: parsed.voiceText ?? "", boardActions: actions }];
    }

    // Ensure no step has a completely blank board
    steps = steps.map(s => {
      if (s.boardActions.length === 0 && s.voiceText.trim()) {
        return { ...s, boardActions: [{ type: "writeText", content: s.voiceText.trim().slice(0, 120), color: "white" }] };
      }
      return s;
    });

    const plan = {
      title: question.trim() || "سؤال",
      topic: question.trim() || "سؤال",
      intro:   { voiceText: "", boardActions: [] },
      steps,
      summary: { voiceText: "", boardActions: [] },
      keyPoints: [],
    };

    // Auto-save to whiteboard_sessions (level='ask' marks Q&A entries)
    let savedId: number | null = null;
    try {
      const teacherId = req.session.teacherId as number;
      const saveResult = await db.execute(sql`
        INSERT INTO whiteboard_sessions
          (teacher_id, question, plan, language, level)
        VALUES
          (${teacherId}, ${question.trim() || "سؤال"}, ${JSON.stringify(plan)}::jsonb, 'ar', 'ask')
        RETURNING id
      `);
      savedId = ((saveResult.rows ?? saveResult as any)[0] as any)?.id ?? null;
    } catch (saveErr) {
      req.log.warn({ saveErr }, "whiteboard ask auto-save failed (non-fatal)");
    }

    res.json({ ...plan, savedId });
  } catch (err) {
    req.log.error({ err }, "whiteboard ask failed");
    res.status(500).json({ error: "تعذّر توليد الإجابة" });
  }
});

// ── Whiteboard broadcast sessions (in-memory, poll-based) ─────────────────────
// Pattern mirrors arena-session.ts — short-lived, teacher-owned, no DB.

interface BroadcastSession {
  writeSecret: string;
  title: string;
  stepTitle: string;
  sections: unknown[];   // BoardSection[] as JSON
  updatedAt: number;
}

const broadcastSessions = new Map<string, BroadcastSession>();
const BROADCAST_TTL_MS = 4 * 60 * 60 * 1000; // 4 h

function evictBroadcasts() {
  const now = Date.now();
  for (const [code, s] of broadcastSessions) {
    if (now - s.updatedAt > BROADCAST_TTL_MS) broadcastSessions.delete(code);
  }
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// POST /api/whiteboard/broadcast — teacher creates a session
router.post("/whiteboard/broadcast", requireTeacher, (req, res) => {
  evictBroadcasts();
  let code: string;
  do { code = randomCode(); } while (broadcastSessions.has(code));
  const writeSecret = randomCode(16);
  broadcastSessions.set(code, {
    writeSecret,
    title: "",
    stepTitle: "",
    sections: [],
    updatedAt: Date.now(),
  });
  res.json({ code, writeSecret });
});

// PUT /api/whiteboard/broadcast/:code — teacher pushes board state
router.put("/whiteboard/broadcast/:code", requireTeacher, (req, res) => {
  const code = req.params.code?.toUpperCase().slice(0, 12);
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }
  const existing = broadcastSessions.get(code);
  if (!existing) { res.status(404).json({ error: "Session not found or expired" }); return; }

  const { writeSecret, title, stepTitle, sections } = req.body as Partial<BroadcastSession>;
  if (writeSecret !== existing.writeSecret) { res.status(403).json({ error: "Wrong write secret" }); return; }

  existing.title = String(title ?? existing.title).slice(0, 200);
  existing.stepTitle = String(stepTitle ?? existing.stepTitle).slice(0, 200);
  existing.sections = Array.isArray(sections) ? sections : existing.sections;
  existing.updatedAt = Date.now();
  res.json({ ok: true });
});

// GET /api/whiteboard/broadcast/:code — student polls board state (no auth)
router.get("/whiteboard/broadcast/:code", (req, res) => {
  evictBroadcasts();
  const code = req.params.code?.toUpperCase().slice(0, 12);
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }
  const session = broadcastSessions.get(code);
  if (!session) { res.status(404).json({ error: "Session not found or expired" }); return; }
  session.updatedAt = Date.now();
  const { writeSecret: _omit, ...pub } = session;
  res.json(pub);
});

// DELETE /api/whiteboard/broadcast/:code — teacher ends session
router.delete("/whiteboard/broadcast/:code", requireTeacher, (req, res) => {
  const code = req.params.code?.toUpperCase().slice(0, 12);
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }
  broadcastSessions.delete(code);
  res.json({ ok: true });
});


// ── DELETE /api/whiteboard/lessons/:id ───────────────────────────────────────
// ── GET /api/whiteboard/geocode — proxy to Nominatim (mem + DB cached + throttled) ────
// Caching and serialisation logic lives in lib/geocode-nominatim.ts.
// TTL: 90 days (positive) / 7 days (negative). See that module for rationale.
router.get("/whiteboard/geocode", requireTeacher, async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim().slice(0, 120);
    if (!q) { res.status(400).json({ error: "query required" }); return; }
    const key = q.toLowerCase();

    // L1: in-memory cache
    if (geocodeMemCache.has(key)) {
      const hit = geocodeMemCache.get(key);
      req.log.info({ key, layer: "mem" }, "geocode cache hit");
      if (hit) { res.json(hit); } else { res.status(404).json({ error: "not found" }); }
      return;
    }

    // L2: DB cache (survives restarts)
    const dbHit = await dbGeocacheLookup(key);
    if (dbHit !== null) {
      req.log.info({ key, layer: "db" }, "geocode cache hit");
      if (geocodeMemCache.size > 500) geocodeMemCache.clear();
      geocodeMemCache.set(key, dbHit.result);
      if (dbHit.result) { res.json(dbHit.result); } else { res.status(404).json({ error: "not found" }); }
      return;
    }

    // L3: Nominatim — serialised via process-wide promise-chain mutex (≥1.1 s between calls)
    const out = await fetchFromNominatim(q);
    if (!out) {
      if (geocodeMemCache.size > 500) geocodeMemCache.clear();
      geocodeMemCache.set(key, null);
      await dbGeocacheStore(key, null);  // await so restart-survival is immediate
      req.log.info({ key, layer: "nominatim" }, "geocode not found — cached negative");
      res.status(404).json({ error: "not found" });
      return;
    }
    if (geocodeMemCache.size > 500) geocodeMemCache.clear();
    geocodeMemCache.set(key, out);
    await dbGeocacheStore(key, out);     // await so restart-survival is immediate
    req.log.info({ key, layer: "nominatim" }, "geocode fetched from Nominatim — cached");
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "geocode failed");
    res.status(500).json({ error: "geocode error" });
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


// ── Exported boardActions helpers (unit-tested in __tests__/whiteboard-normalize.test.ts) ──
const KNOWN_TYPES = ["bullet","highlight","writeText","writeTitle","writeMath","drawArrow",
  "drawCircle","drawConnector","showChart","showImage","showLocation","showDiagram","clearBoard","erase"] as const;

/**
 * Normalise raw boardActions from the LLM.
 *
 * Handles two malformed patterns:
 *   1. Wrapped: { "showLocation": { name: "..." } }  → { type: "showLocation", name: "..." }
 *   2. String value: { "bullet": "some text" }        → { type: "bullet", content: "some text" }
 *
 * Then validates field-level constraints so malformed items never reach the renderer.
 */
export function normalizeActions(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  const out: any[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    if (typeof a.type === "string" && (KNOWN_TYPES as readonly string[]).includes(a.type)) {
      out.push(a); continue;
    }
    // Wrapped form: { "showLocation": { name: ... } } or { "bullet": "text" }
    const keys = Object.keys(a);
    if (keys.length === 1 && (KNOWN_TYPES as readonly string[]).includes(keys[0])) {
      const inner = a[keys[0]];
      if (typeof inner === "object" && inner !== null) out.push({ type: keys[0], ...inner });
      else if (typeof inner === "string") out.push({ type: keys[0], content: inner });
    }
  }
  // Field-level validation so malformed items can't crash the renderer
  return out.filter((a) => {
    if (a.type === "showLocation") return typeof a.name === "string" && a.name.trim();
    if (a.type === "showChart") {
      if (!Array.isArray(a.data) || a.data.length === 0) return false;
      a.data = a.data
        .filter((d: any) => d && typeof d.label === "string" && Number.isFinite(Number(d.value)))
        .map((d: any) => ({ label: d.label, value: Number(d.value) }))
        .slice(0, 10);
      return a.data.length > 0;
    }
    if (a.type === "drawConnector") return typeof a.from === "string" && typeof a.to === "string";
    if (a.type === "showImage") return typeof a.imageQuery === "string" && a.imageQuery.trim();
    return true;
  });
}

/**
 * Apply the "never leave the board blank" fallback.
 * If actions is empty and voiceText has content, returns a single writeText action.
 * Otherwise returns actions unchanged.
 */
export function actionsWithFallback(actions: any[], voiceText: string): any[] {
  if (actions.length === 0 && voiceText.trim()) {
    return [{ type: "writeText", content: voiceText.trim(), color: "white" }];
  }
  return actions;
}


export default router;
