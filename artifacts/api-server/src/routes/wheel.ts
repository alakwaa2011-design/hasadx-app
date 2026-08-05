import { Router, type IRouter } from "express";
import { db, wheelTemplatesTable, teachersTable } from "@workspace/db";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveTier, modelForTier, isClaudeTier, type AiTier } from "../lib/ai-tier";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";

const router: IRouter = Router();

/* ── Local AI completion helper (mirrors the one in presentations.ts).
   Routes one prompt to either Anthropic (claude tier) or OpenAI
   (standard / pro tiers) and returns the raw text response. */
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

/* ── Hasaad-branded wheel palette. The wheel paints segments by cycling
   through this list so adjacent slices are always different. Calm hues
   that match the rest of the platform identity (deep green + warm gold). */
const WHEEL_PALETTE = [
  "#225739", // brand green
  "#D9A521", // brand gold
  "#3a7a55", // sage
  "#c47e2c", // bronze
  "#1f4d3a", // forest
  "#e6b54f", // honey
  "#2d6a4f", // emerald
  "#b08440", // ochre
];

const segmentSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(800),
  answer: z.string().max(800).optional().nullable(),
  explanation: z.string().max(800).optional().nullable(),
  points: z.number().int().min(0).max(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  kind: z.enum(["question", "bonus"]).default("question"),
  bonusType: z.enum(["double", "skip", "swap", "lucky", "lose"]).optional(),
});

const configSchema = z.object({
  teamCount: z.number().int().min(2).max(6).default(2),
  teamNames: z.array(z.string().min(1).max(40)).min(2).max(6),
  spinSeconds: z.number().int().min(3).max(10).default(5),
  soundOn: z.boolean().default(true),
}).refine((c) => c.teamNames.length === c.teamCount, {
  message: "teamNames length must equal teamCount",
  path: ["teamNames"],
});

const upsertBody = z.object({
  title: z.string().min(2).max(200),
  language: z.enum(["ar", "en"]).default("ar"),
  gradeLevel: z.string().max(50).nullish(),
  subject: z.string().max(100).nullish(),
  segments: z.array(segmentSchema).min(2).max(20),
  config: configSchema,
});

/* ─────────────────────────────────────────────────────────────
   GET /api/wheel-templates  — list teacher's own + admin-shared
   ───────────────────────────────────────────────────────────── */
router.get("/wheel-templates", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const teacherId = req.session.teacherId;
  try {
    const rows = await db
      .select({
        id: wheelTemplatesTable.id,
        teacherId: wheelTemplatesTable.teacherId,
        title: wheelTemplatesTable.title,
        language: wheelTemplatesTable.language,
        gradeLevel: wheelTemplatesTable.gradeLevel,
        subject: wheelTemplatesTable.subject,
        segments: wheelTemplatesTable.segments,
        config: wheelTemplatesTable.config,
        isShared: wheelTemplatesTable.isShared,
        createdAt: wheelTemplatesTable.createdAt,
        updatedAt: wheelTemplatesTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(wheelTemplatesTable)
      .leftJoin(teachersTable, eq(wheelTemplatesTable.teacherId, teachersTable.id))
      .where(
        or(
          eq(wheelTemplatesTable.teacherId, teacherId),
          and(
            eq(wheelTemplatesTable.isShared, true),
            eq(teachersTable.isAdmin, true),
            ne(wheelTemplatesTable.teacherId, teacherId),
          ),
        ),
      )
      .orderBy(desc(wheelTemplatesTable.updatedAt))
      .limit(100);
    const templates = rows.map((r) => ({
      ...r,
      isOwn: r.teacherId === teacherId,
      fromAdmin: !!r.ownerIsAdmin && r.teacherId !== teacherId,
    }));
    res.json(templates);
  } catch (err) {
    req.log.error({ err }, "Failed to list wheel templates");
    res.status(500).json({ message: "Failed to fetch templates" });
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/wheel-templates/:id  — fetch one (own or admin-shared)
   ───────────────────────────────────────────────────────────── */
router.get("/wheel-templates/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .select({
        tpl: wheelTemplatesTable,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(wheelTemplatesTable)
      .leftJoin(teachersTable, eq(wheelTemplatesTable.teacherId, teachersTable.id))
      .where(eq(wheelTemplatesTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const isOwn = row.tpl.teacherId === req.session.teacherId;
    const accessible = isOwn || (row.tpl.isShared && row.ownerIsAdmin);
    if (!accessible) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json({ ...row.tpl, isOwn });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch wheel template");
    res.status(500).json({ message: "Failed to fetch template" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/wheel-templates  — create
   ───────────────────────────────────────────────────────────── */
router.post("/wheel-templates", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const parsed = upsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    return;
  }
  try {
    const segments = colorizeSegments(parsed.data.segments);
    const [row] = await db
      .insert(wheelTemplatesTable)
      .values({
        teacherId: req.session.teacherId,
        title: parsed.data.title,
        language: parsed.data.language,
        gradeLevel: parsed.data.gradeLevel ?? null,
        subject: parsed.data.subject ?? null,
        segments,
        config: parsed.data.config,
      })
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create wheel template");
    res.status(500).json({ message: "Failed to save template" });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/wheel-templates/:id  — update (owner only)
   ───────────────────────────────────────────────────────────── */
router.put("/wheel-templates/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const parsed = upsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(wheelTemplatesTable)
      .where(eq(wheelTemplatesTable.id, id))
      .limit(1);
    if (!existing || existing.teacherId !== req.session.teacherId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const segments = colorizeSegments(parsed.data.segments);
    const [row] = await db
      .update(wheelTemplatesTable)
      .set({
        title: parsed.data.title,
        language: parsed.data.language,
        gradeLevel: parsed.data.gradeLevel ?? null,
        subject: parsed.data.subject ?? null,
        segments,
        config: parsed.data.config,
        updatedAt: new Date(),
      })
      .where(eq(wheelTemplatesTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update wheel template");
    res.status(500).json({ message: "Failed to update template" });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/wheel-templates/:id  — delete (owner only)
   ───────────────────────────────────────────────────────────── */
router.delete("/wheel-templates/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(wheelTemplatesTable)
      .where(eq(wheelTemplatesTable.id, id))
      .limit(1);
    if (!existing || existing.teacherId !== req.session.teacherId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    await db.delete(wheelTemplatesTable).where(eq(wheelTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete wheel template");
    res.status(500).json({ message: "Failed to delete template" });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/wheel-templates/generate  — AI segment generation
   ───────────────────────────────────────────────────────────── */
const generateBody = z.object({
  topic: z.string().min(2).max(300),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  segmentCount: z.number().int().min(6).max(16).default(10),
  language: z.enum(["ar", "en"]).default("ar"),
  includeBonus: z.boolean().default(true),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
});

router.post("/wheel-templates/generate", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const parsed = generateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    return;
  }
  const { topic, subject, gradeLevel, segmentCount, language, includeBonus, difficulty } = parsed.data;
  try {
    const tier = await resolveTier(req.session.teacherId, (req.body as { tier?: string })?.tier);
    const prompt = buildWheelPrompt({ topic, subject: subject ?? null, gradeLevel: gradeLevel ?? null, segmentCount, language, includeBonus, difficulty });
    const text = await runTierCompletion({ tier, prompt, maxTokens: 6000 });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      res.status(500).json({ message: language === "ar" ? "تعذّر التوليد" : "Generation failed" });
      return;
    }
    let json: { segments?: unknown };
    try {
      json = JSON.parse(m[0]);
    } catch {
      res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح" : "Invalid format" });
      return;
    }
    const raw = Array.isArray(json.segments) ? json.segments : [];
    const cleaned = sanitizeGeneratedSegments(raw, includeBonus, language);
    // Final safety net: re-validate the cleaned segments through the same Zod
    // schema used by save endpoints so AI output that passes generation can
    // never fail later on save with a confusing 400.
    const validated = z.array(segmentSchema).min(2).max(20).safeParse(cleaned);
    if (!validated.success) {
      req.log.warn({ issues: validated.error.issues }, "AI segments failed strict validation");
      res.status(500).json({ message: language === "ar" ? "تنسيق غير صالح من المولّد" : "Generator returned an invalid format" });
      return;
    }
    res.json({ segments: colorizeSegments(validated.data) });
  } catch (err) {
    req.log.error({ err }, "Wheel AI generation failed");
    res.status(500).json({ message: language === "ar" ? "تعذّر التوليد" : "Generation failed" });
  }
});

/* ── Helpers ─────────────────────────────────────────────────── */

function colorizeSegments<T extends { color?: string }>(segments: T[]): T[] {
  return segments.map((s, i) => ({
    ...s,
    color: s.color ?? WHEEL_PALETTE[i % WHEEL_PALETTE.length],
  }));
}

function sanitizeGeneratedSegments(
  raw: unknown[],
  includeBonus: boolean,
  language: "ar" | "en",
): Array<z.infer<typeof segmentSchema>> {
  const out: Array<z.infer<typeof segmentSchema>> = [];
  let idx = 0;
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) continue;
    const kindRaw = typeof o.kind === "string" ? o.kind : "question";
    const kind: "question" | "bonus" = kindRaw === "bonus" && includeBonus ? "bonus" : "question";
    const points = clampPoints(o.points, kind);
    const seg: z.infer<typeof segmentSchema> = {
      id: `seg_${++idx}_${Date.now().toString(36)}`,
      text: text.slice(0, 800),
      kind,
      points,
    };
    if (kind === "question") {
      seg.answer = typeof o.answer === "string" ? o.answer.trim().slice(0, 800) : "";
      seg.explanation = typeof o.explanation === "string" ? o.explanation.trim().slice(0, 800) : undefined;
    } else {
      const bt = typeof o.bonusType === "string" ? o.bonusType : "lucky";
      seg.bonusType = (["double", "skip", "swap", "lucky", "lose"] as const).includes(bt as never)
        ? (bt as "double" | "skip" | "swap" | "lucky" | "lose")
        : "lucky";
      // Bonus tiles always carry their own copy so the play page can render it
      // without re-translating. The label written by the AI is honored.
      seg.text = text || (language === "ar" ? "مفاجأة!" : "Surprise!");
    }
    out.push(seg);
    if (out.length >= 16) break;
  }
  return out;
}

function clampPoints(v: unknown, kind: "question" | "bonus"): number {
  // Bonus tiles can carry 0/100/200 (some are pure actions, others give bonus
  // points); question tiles always pay out one of the standard tiers.
  const allowed = kind === "bonus" ? [0, 100, 200] : [50, 100, 200, 300, 500];
  const n = typeof v === "number" ? Math.round(v) : (kind === "bonus" ? 0 : 100);
  let best = allowed[0];
  let bestDist = Math.abs(n - best);
  for (const a of allowed) {
    const d = Math.abs(n - a);
    if (d < bestDist) { best = a; bestDist = d; }
  }
  return best;
}

function buildWheelPrompt(opts: {
  topic: string;
  subject: string | null;
  gradeLevel: string | null;
  segmentCount: number;
  language: "ar" | "en";
  includeBonus: boolean;
  difficulty: "easy" | "medium" | "hard" | "mixed";
}): string {
  const { topic, subject, gradeLevel, segmentCount, language, includeBonus, difficulty } = opts;
  const bonusCount = includeBonus ? Math.max(1, Math.floor(segmentCount * 0.2)) : 0;
  const questionCount = segmentCount - bonusCount;

  if (language === "en") {
    return `You are an expert teacher designing a "Wheel of Fortune" classroom game.

Topic: ${topic}
${subject ? `Subject: ${subject}` : ""}
${gradeLevel ? `Grade level: ${gradeLevel}` : ""}
Total segments needed: ${segmentCount}
Question segments: ${questionCount}
${includeBonus ? `Bonus segments: ${bonusCount}` : "No bonus segments."}
Difficulty: ${difficulty}

Return JSON ONLY in this exact shape (no prose, no markdown):
{
  "segments": [
    {
      "kind": "question",
      "text": "<short, clear question, ≤ 25 words>",
      "answer": "<the correct answer, concise>",
      "explanation": "<one short sentence justifying the answer>",
      "points": <50 | 100 | 200 | 300 | 500>
    }${includeBonus ? `,
    {
      "kind": "bonus",
      "text": "<bonus title, e.g. \\"Double Points!\\">",
      "bonusType": "<double | skip | swap | lucky | lose>",
      "points": <0 | 100 | 200>
    }` : ""}
  ]
}

Rules:
- Vary the points across segments to make spinning exciting (mix 50/100/200/300/500).
- Make most questions multiple-choice friendly but state them as open questions the teacher reads aloud.
- Bonus types: "double" = double the next answer's points, "skip" = pass to another team, "swap" = swap scores, "lucky" = free points, "lose" = lose half points.
- Keep answers and explanations short — this is read aloud in class.
- ${difficulty === "mixed" ? "Mix easy / medium / hard questions." : `All questions ${difficulty} difficulty.`}
- Make each question genuinely different — do not repeat the same concept twice.`;
  }

  /* Arabic prompt */
  return `أنت معلّم خبير تصمّم لعبة "عجلة التحدي" للفصل.

الموضوع: ${topic}
${subject ? `المادة: ${subject}` : ""}
${gradeLevel ? `الصف: ${gradeLevel}` : ""}
عدد القطاعات الكلي: ${segmentCount}
قطاعات الأسئلة: ${questionCount}
${includeBonus ? `قطاعات المكافأة: ${bonusCount}` : "بدون قطاعات مكافأة."}
الصعوبة: ${difficulty === "easy" ? "سهلة" : difficulty === "hard" ? "صعبة" : difficulty === "medium" ? "متوسطة" : "مختلطة"}

أعد JSON فقط بهذا الشكل بالضبط (بدون شرح، بدون Markdown):
{
  "segments": [
    {
      "kind": "question",
      "text": "<سؤال قصير وواضح، حتى ٢٥ كلمة>",
      "answer": "<الإجابة الصحيحة بإيجاز>",
      "explanation": "<جملة قصيرة توضح سبب الإجابة>",
      "points": <50 | 100 | 200 | 300 | 500>
    }${includeBonus ? `,
    {
      "kind": "bonus",
      "text": "<عنوان المكافأة، مثلاً: \\"النقاط المضاعفة!\\">",
      "bonusType": "<double | skip | swap | lucky | lose>",
      "points": <0 | 100 | 200>
    }` : ""}
  ]
}

قواعد:
- نوّع النقاط بين القطاعات لإثارة الدوران (٥٠/١٠٠/٢٠٠/٣٠٠/٥٠٠).
- اجعل الأسئلة قابلة للإجابة شفهياً بسرعة (المعلّم يقرأها على الفصل).
- أنواع المكافأة: "double" = ضاعف نقاط السؤال التالي، "skip" = تخطّي للفريق الآخر، "swap" = بدّل النقاط بين الفريقين، "lucky" = نقاط مجانية، "lose" = يخسر الفريق نصف نقاطه.
- اجعل الإجابات والشروحات قصيرة — كلّها تُقرأ بصوت عالٍ.
- ${difficulty === "mixed" ? "نوّع بين السهلة والمتوسطة والصعبة." : `جميع الأسئلة بمستوى ${difficulty === "easy" ? "سهل" : difficulty === "hard" ? "صعب" : "متوسط"}.`}
- اجعل كل سؤال مختلفاً فعلاً — لا تكرّر نفس المفهوم مرّتين.`;
}

export default router;
