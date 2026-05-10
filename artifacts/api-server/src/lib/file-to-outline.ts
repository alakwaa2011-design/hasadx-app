/* file-to-outline.ts
   Takes structured content extracted from an uploaded file (PDF, DOCX, XLSX,
   or image) and calls GPT-4o to produce a full presentation outline in the
   same JSON shape as the standard brief-based generator.

   For image files the Vision API is used directly; for text-based files the
   content is sent as a structured text message.
*/

import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { ExtractedFile } from "./file-extractor";
import {
  systemPromptFor,
  type OutlineLanguage,
} from "./outline-prompt";
import type {
  OutlineCard,
  SlideKind,
  InteractionHint,
  Density,
} from "@workspace/slide-templates";

/* ── Shared layout / games / design rule strings ────────────────── */
const LAYOUT_RULES_AR = `قواعد اختيار نوع الشريحة (kind):
- title         → شريحة الافتتاح فقط. عنوان + عنوان فرعي.
- objectives    → سرد 2-4 أهداف.
- concept-card  → فكرة محورية + نقاط داعمة.
- comparison    → طرفان/خياران/قبل-بعد.
- steps         → 2-4 خطوات متتالية.
- timeline      → 3-5 أحداث زمنية.
- visual-hero   → تعريف مفهوم بصرياً.
- formula       → قاعدة/معادلة.
- stat          → رقم/إحصائية بارزة.
- quote         → اقتباس أو حكمة.
- callout       → ملاحظة مهمة جداً.
- interactive   → سؤال/استطلاع/نشاط.
- closure       → الشريحة الأخيرة فقط.
لا تكرر نفس kind أكثر من 3 مرات متتالية. نوّع التخطيطات.`;

const LAYOUT_RULES_EN = `Layout-selection rules (pick ONE kind per slide):
- title         → Only the opening slide.
- objectives    → 2-4 lesson objectives.
- concept-card  → One central idea + related points.
- comparison    → Two sides / before-after.
- steps         → 2-4 sequential steps.
- timeline      → 3-5 events on a time axis.
- visual-hero   → Introduce a concept visually.
- formula       → A rule or formula.
- stat          → 1-3 striking numbers.
- quote         → Short quote or wisdom.
- callout       → High-importance note/warning.
- interactive   → Question / poll / activity.
- closure       → Only the final slide.
Never repeat the same kind more than 3 times in a row.`;

const GAMES_RULES_AR = `أسئلة النشاط (gameQuestions):
- أنتج 4-6 أسئلة على الشرائح التفاعلية فقط (interactionHint="quiz" أو "activity").
- لا أسئلة على العنوان أو الخاتمة أو الشرح النظري.
- كل سؤال: { "prompt": "...", "options": ["أ","ب","ج","د"], "correctIndex": 0 }
- اترك gameSuggestion = null دائماً.
- لا تنتج gameQuestions على الشرائح غير التفاعلية.`;

const GAMES_RULES_EN = `Activity questions (gameQuestions):
- Produce 4-6 questions only on interactive slides (interactionHint="quiz" or "activity").
- No questions on title, closure, or pure-explanation slides.
- Each: { "prompt": "...", "options": ["A","B","C","D"], "correctIndex": 0 }
- Always leave gameSuggestion = null.`;

const DESIGN_RULES_AR = `التصميم البصري — slideTheme = null على كل شريحة بلا استثناء.
العرض له تيمة واحدة يختارها المعلم. تغيير التيمة من شريحة لأخرى مظهر غير احترافي.`;

const DESIGN_RULES_EN = `Visual design — slideTheme = null on EVERY slide, no exceptions.
The deck has a single teacher-chosen theme. Per-slide overrides look unprofessional.`;

/* ── Simplified outline Zod schema (matches ai-presentations.ts) ── */
const slideKindSchema = z.enum([
  "title", "objectives", "concept-card", "comparison", "visual-hero",
  "steps", "interactive", "closure", "timeline", "formula",
  "stat", "quote", "callout",
]);

const gameQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
});

const outlineCardSchema = z.object({
  index: z.number().int().min(1).max(30),
  kind: slideKindSchema,
  title: z.string().min(1).max(80),
  subtitle: z.string().max(80).optional(),
  purpose: z.string().min(1).max(140),
  talkingPoints: z.array(z.string().min(1).max(140)).min(1).max(6),
  interactionHint: z.enum(["poll", "quiz", "discussion", "activity"]).nullable(),
  gameSuggestion: z.any().nullable().optional().transform(() => null),
  gameQuestions: z.array(gameQuestionSchema).max(12).optional(),
  slideTheme: z.any().nullable().optional().transform(() => null),
  visualDirection: z.object({
    icon: z.string().max(40).optional(),
    shape: z.enum(["rect", "circle", "line", "arrow", "divider"]).optional(),
    layoutHint: z.string().max(40).optional(),
  }),
  source: z.string().max(200).optional(),
});

export const fileOutlineSchema = z.object({
  language: z.enum(["ar", "en"]),
  density: z.enum(["minimal", "balanced", "detailed"]),
  totalEstimatedMinutes: z.number().int().min(1).max(240),
  objectives: z.array(z.string().min(1).max(140)).min(2).max(6),
  teachingFlow: z.array(z.object({
    stage: z.enum(["opener", "concept", "practice", "closure"]),
    slideIndices: z.array(z.number().int().min(1).max(30)).min(1),
    estimatedMinutes: z.number().int().min(1).max(240),
  })).length(4),
  slides: z.array(outlineCardSchema).min(3).max(30),
});

export type FileOutline = z.infer<typeof fileOutlineSchema>;

/* ── JSON extraction (loose, same as ai-presentations.ts) ─────── */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) { try { return JSON.parse(fence[1]); } catch { /* */ } }
  const first = trimmed.indexOf("{");
  const last  = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* */ }
  }
  return null;
}

/* ── Prompt builder for document-based generation ─────────────── */
function buildDocPrompt(ef: ExtractedFile, filename: string): string {
  const ar = ef.detectedLanguage === "ar";
  const layoutRules = ar ? LAYOUT_RULES_AR : LAYOUT_RULES_EN;
  const gamesRules  = ar ? GAMES_RULES_AR  : GAMES_RULES_EN;
  const designRules = ar ? DESIGN_RULES_AR : DESIGN_RULES_EN;

  const slideCount = estimateSlideCount(ef);
  const lang = ef.detectedLanguage;

  const schema = `{
  "language": "${lang}",
  "density": "balanced",
  "totalEstimatedMinutes": 30,
  "objectives": ["...", "...", "..."],
  "teachingFlow": [
    { "stage": "opener",   "slideIndices": [1],     "estimatedMinutes": 5  },
    { "stage": "concept",  "slideIndices": [2,3,4,5], "estimatedMinutes": 15 },
    { "stage": "practice", "slideIndices": [6,7],   "estimatedMinutes": 7  },
    { "stage": "closure",  "slideIndices": [${slideCount}], "estimatedMinutes": 3 }
  ],
  "slides": [
    {
      "index": 1,
      "kind": "title|objectives|concept-card|...",
      "title": "...",
      "purpose": "...",
      "talkingPoints": ["...", "...", "..."],
      "interactionHint": "quiz|activity|null",
      "gameSuggestion": null,
      "gameQuestions": [{ "prompt": "...", "options": ["أ","ب","ج","د"], "correctIndex": 0 }],
      "slideTheme": null,
      "visualDirection": { "icon": "lightbulb", "shape": "rect", "layoutHint": "..." },
      "source": ""
    }
  ]
}`;

  const docSection = ar
    ? [
        `اسم الملف: ${filename}`,
        ef.pageCount ? `عدد الصفحات: ${ef.pageCount}` : "",
        ef.headings.length
          ? `العناوين الرئيسية المكتشفة:\n${ef.headings.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`
          : "",
        "",
        "محتوى الملف:",
        ef.text || "(محتوى مرئي — انظر الصورة المرفقة)",
      ].filter(Boolean).join("\n")
    : [
        `Filename: ${filename}`,
        ef.pageCount ? `Pages: ${ef.pageCount}` : "",
        ef.headings.length
          ? `Detected headings:\n${ef.headings.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`
          : "",
        "",
        "Document content:",
        ef.text || "(Visual content — see attached image)",
      ].filter(Boolean).join("\n");

  const rules = ar
    ? [
        `أنتج بالضبط ${slideCount} شريحة مستخرجة من محتوى الملف الفعلي — لا تختلق معلومات غير موجودة في الملف.`,
        `ابدأ بشريحة عنوان (title)، أنهِ بشريحة خاتمة (closure).`,
        `اللغة: ${ar ? "عربية فصحى مبسّطة" : "English"}.`,
        `الكثافة: متوسطة (3-4 نقاط لكل شريحة، أسلوب عناوين، لا فقرات).`,
        `إذا ظهرت عناوين أو أرقام صفحات في الملف، اذكرها في حقل source للشريحة المناسبة.`,
        `objectives: 2-5 أهداف مستخرجة من محتوى الملف بصياغة "سيكون الطالب قادراً على ..."`,
        `كل index يظهر في مرحلة واحدة فقط من teachingFlow.`,
        `slideTheme = null على كل شريحة بلا استثناء.`,
        `gameSuggestion = null دائماً.`,
      ]
    : [
        `Produce exactly ${slideCount} slides drawn from the actual file content — do NOT invent information not present in the document.`,
        `Start with a title slide, end with a closure slide.`,
        `Language: English.`,
        `Density: balanced (3-4 headline-style points per slide, no paragraphs).`,
        `If headings or page numbers appear in the document, cite them in the source field.`,
        `Objectives: 2-5 items extracted from the file, phrased "Students will be able to ..."`,
        `Each slide index must appear in exactly one teachingFlow stage.`,
        `slideTheme = null on every slide, no exceptions.`,
        `gameSuggestion = null always.`,
      ];

  return [
    ar ? "محتوى الملف المرفوع" : "UPLOADED DOCUMENT",
    docSection,
    "",
    ar ? "تخطيطات الشرائح المتاحة" : "AVAILABLE LAYOUTS",
    layoutRules,
    "",
    ar ? "أسئلة الأنشطة" : "ACTIVITY QUESTIONS",
    gamesRules,
    "",
    ar ? "ذكاء التصميم" : "VISUAL DESIGN",
    designRules,
    "",
    ar ? "القواعد" : "RULES",
    ...rules.map((r) => `- ${r}`),
    "",
    ar ? "صيغة الرد (JSON صارم فقط — بدون شرح)" : "REPLY SHAPE (strict JSON only — no prose)",
    schema,
  ].join("\n");
}

/* Estimate slide count: 1 per detected heading (capped), or a fixed
   count based on content length. */
function estimateSlideCount(ef: ExtractedFile): number {
  if (ef.fileType === "image") return 8;
  const headingDriven = ef.headings.length > 2 ? Math.min(ef.headings.length + 2, 14) : 0;
  const textDriven    = ef.text.length > 3000 ? 12 : ef.text.length > 1500 ? 10 : 8;
  return headingDriven || textDriven;
}

/* ── Main entry point ────────────────────────────────────────────── */
const FILE_OUTLINE_MODEL = "gpt-4o";

export async function fileToOutline(
  ef: ExtractedFile,
  filename: string,
): Promise<FileOutline> {
  const lang: OutlineLanguage = ef.detectedLanguage;
  const systemPrompt = systemPromptFor(lang);

  let rawJson: string;

  if (ef.fileType === "image" && ef.imageBase64 && ef.imageMime) {
    /* Vision path: send image directly to GPT-4o. */
    const userPrompt = lang === "ar"
      ? `الصورة المرفوعة تحتوي على مادة تعليمية. استخرج كل المحتوى الظاهر في الصورة وحوّله إلى عرض تقديمي بـ 8 شرائح.\n\n${buildDocPrompt(ef, filename)}`
      : `The attached image contains educational material. Extract all visible content and turn it into an 8-slide presentation.\n\n${buildDocPrompt(ef, filename)}`;

    const resp = await openai.chat.completions.create({
      model: FILE_OUTLINE_MODEL,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${ef.imageMime};base64,${ef.imageBase64}`, detail: "high" } },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });
    rawJson = resp.choices[0]?.message?.content ?? "";
  } else {
    /* Text path. */
    const userPrompt = buildDocPrompt(ef, filename);
    const resp = await openai.chat.completions.create({
      model: FILE_OUTLINE_MODEL,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    rawJson = resp.choices[0]?.message?.content ?? "";
  }

  const raw = parseJsonLoose(rawJson);
  const parsed = fileOutlineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `AI outline parse failed: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    );
  }
  return parsed.data;
}

/* ── Multi-image outline ─────────────────────────────────────────────
   Sends N uploaded images to GPT-4o Vision in one call and returns
   exactly N OutlineCards (one card per image, sorted by index).
   The route handler maps each card → buildOneSlide and then stamps
   the resulting slide with the corresponding Object Storage URL as
   `backgroundImage` so the original photo remains visible beneath
   the AI-generated text layout.                                     */

const multiImageSlideSchema = z.object({
  index: z.number().int().min(1).max(30),
  /* Coerce unexpected values to "concept-card" instead of failing. */
  kind: slideKindSchema.catch("concept-card" as const),
  title: z.string().min(1).max(80),
  purpose: z.string().min(1).max(140).optional(),
  talkingPoints: z.array(z.string().min(1).max(140)).min(1).max(6),
  interactionHint: z
    .enum(["poll", "quiz", "discussion", "activity"])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  gameSuggestion: z.any().optional().transform(() => null),
  slideTheme: z.any().optional().transform(() => null),
  visualDirection: z
    .object({
      icon: z.string().max(40).optional(),
      layoutHint: z.string().max(40).optional(),
    })
    .optional()
    .default({}),
});

const multiImageResponseSchema = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  slides: z.array(multiImageSlideSchema).min(1).max(20),
});

export interface MultiImageOutlineResult {
  cards: OutlineCard[];
  language: "ar" | "en";
  density: Density;
}

export async function multiImagesToOutline(
  images: Array<{ buffer: Buffer; filename: string; mime: string }>,
): Promise<MultiImageOutlineResult> {
  if (images.length === 0) throw new Error("multiImagesToOutline: empty images array");
  const n = images.length;

  const schemaExample = `{
  "language": "ar",
  "slides": [
    {
      "index": 1,
      "kind": "title",
      "title": "عنوان الشريحة",
      "purpose": "وصف موجز",
      "talkingPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "interactionHint": null,
      "gameSuggestion": null,
      "slideTheme": null,
      "visualDirection": { "icon": "book", "layoutHint": "center-title" }
    }
  ]
}`;

  const lines = [
    `لديك ${n} ${n === 1 ? "صورة تعليمية" : "صور تعليمية"} مرفوعة. انظر إلى كل صورة وأنتج شريحة واحدة لكلٍّ منها.`,
    "",
    `ترتيب الشرائح:`,
    `• الصورة الأولى  (index=1)  → kind="title"`,
    n > 1 ? `• الصورة الأخيرة (index=${n}) → kind="closure"` : "",
    n > 2 ? `• الصور الوسطى  → kind مناسب (concept-card، visual-hero، steps، comparison)` : "",
    "",
    `لكل شريحة:`,
    `- عنوان (title) يعبّر عن المحتوى الرئيسي الظاهر في الصورة`,
    `- 3-4 نقاط في talkingPoints تشرح أو تصف ما تراه`,
    `- اللغة: عربية إذا كان محتوى الصور بالعربية، إنجليزية إذا كان بالإنجليزية`,
    `- slideTheme = null دائماً بلا استثناء`,
    `- gameSuggestion = null دائماً`,
    `- interactionHint = null إلا إذا كانت الصورة تحتوي سؤالاً أو نشاطاً صريحاً`,
    "",
    DESIGN_RULES_AR,
    "",
    `رُدّ بـ JSON صارم فقط — بدون أي شرح — بهذه الصيغة:`,
    schemaExample,
  ].filter((l) => l !== null && l !== undefined) as string[];

  const userText = lines.join("\n");

  /* Build the content array: all images first, then the instruction text. */
  type ImagePart = { type: "image_url"; image_url: { url: string; detail: "high" } };
  type TextPart  = { type: "text"; text: string };
  const contentParts: Array<ImagePart | TextPart> = [
    ...images.map((img): ImagePart => ({
      type: "image_url",
      image_url: {
        url: `data:${img.mime};base64,${img.buffer.toString("base64")}`,
        detail: "high",
      },
    })),
    { type: "text", text: userText },
  ];

  const systemPrompt = systemPromptFor("ar");
  const resp = await openai.chat.completions.create({
    model: FILE_OUTLINE_MODEL,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ],
  });

  const rawJson = resp.choices[0]?.message?.content ?? "";
  const raw = parseJsonLoose(rawJson);
  const parsed = multiImageResponseSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `multiImagesToOutline parse failed: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    );
  }

  /* Enforce 1-to-1 mapping: AI must return exactly N slides for N images.
     If the count doesn't match we throw so the caller falls back to the
     safe default-slides path instead of silently misaligning images. */
  if (parsed.data.slides.length !== n) {
    throw new Error(
      `multiImagesToOutline: expected ${n} slides but AI returned ${parsed.data.slides.length}`,
    );
  }

  /* Sort by index so image[0] → card[0], image[1] → card[1], etc. */
  const sorted = [...parsed.data.slides].sort((a, b) => a.index - b.index);

  const cards: OutlineCard[] = sorted.map((s, i) => ({
    index: i + 1,
    kind: s.kind as SlideKind,
    title: s.title,
    purpose: s.purpose ?? s.title,
    talkingPoints: s.talkingPoints,
    interactionHint: (s.interactionHint ?? null) as InteractionHint,
    gameSuggestion: null,
    slideTheme: null,
    visualDirection: s.visualDirection ?? {},
  }));

  return {
    cards,
    language: parsed.data.language,
    density: "balanced" as Density,
  };
}
