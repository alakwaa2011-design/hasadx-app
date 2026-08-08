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
  /* English 2-5 word web image query — server fetches the photo and uses
     it as the slide background. Optional / tolerant. */
  imageQuery: z
    .any()
    .optional()
    .transform((v) => {
      if (typeof v !== "string") return "";
      return v.trim().replace(/\s+/g, " ").slice(0, 80);
    }),
  /* How to place the photo: "side" inserts an inline image column,
     "background" paints it full-bleed, "none" suppresses it. Tolerant
     parse — any unknown value falls back to undefined so the server
     can pick a default per slide kind. */
  imagePlacement: z
    .any()
    .optional()
    .transform((v): "side" | "background" | "none" | undefined => {
      if (v === "side" || v === "background" || v === "none") return v;
      return undefined;
    }),
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
      "visualDirection": { "icon": "Lightbulb", "shape": "rect", "layoutHint": "..." },
      "source": "",
      "imageQuery": "renewable energy classroom",
      "imagePlacement": "side"
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
        `أنتج بالضبط ${slideCount} شريحة تعالج محتوى الملف بعمق — استخرج كل الأفكار الرئيسية والتفاصيل المهمة والأمثلة والأدلة الموجودة في الملف. لا تختصر أو تحذف شيئاً مهماً.`,
        `ابدأ بشريحة عنوان (title)، أنهِ بشريحة خاتمة (closure).`,
        `اللغة: ${ar ? "عربية فصحى مبسّطة" : "English"}.`,
        `الكثافة: مفصّلة (3-5 نقاط لكل شريحة، كل نقطة تحمل معلومة حقيقية محددة وليست تسمية عامة، أسلوب عناوين مكثّفة لا فقرات). إذا الموضوع يستحق أكثر من شريحة فقسّمه — لا تكدّس كل شيء في نقطتين.`,
        `إذا ظهرت عناوين أو أرقام صفحات في الملف، اذكرها في حقل source للشريحة المناسبة.`,
        `objectives: 2-5 أهداف مستخرجة من محتوى الملف بصياغة "سيكون الطالب قادراً على ..."`,
        `كل index يظهر في مرحلة واحدة فقط من teachingFlow.`,
        `slideTheme = null على كل شريحة بلا استثناء.`,
        `gameSuggestion = null دائماً.`,
        `visualDirection.icon: اسم أيقونة Lucide بصيغة PascalCase مثل Lightbulb, Target, BookOpen, Brain, FlaskConical, Atom, Calculator, Globe2, Leaf, Sun, Zap, BarChart3, Clock, CheckCircle2, Megaphone, ListChecks, Users, Quote, Microscope.`,
        `imageQuery: استعلام بحث **بالإنجليزية من 2-5 كلمات** يصف صورة احترافية ملموسة تناسب الشريحة وتشرح/توضّح إحدى نقاطها (مثل "solar panels desert", "human heart anatomy", "ancient Egyptian pyramids"). تجنّب المفاهيم المجردة ("introduction", "summary"). هذا الحقل مهم جداً لجمالية العرض.`,
        `imagePlacement: "side" (الافتراضي، عمود صورة بجانب النص — استخدمه لكل شرائح المحتوى) أو "background" (تعبئة كاملة — للشرائح ذات العبارة القوية الموجزة فقط مثل visual-hero/stat/quote) أو "none" (نادراً).`,
      ]
    : [
        `Produce exactly ${slideCount} slides that thoroughly cover the document's content — extract ALL main ideas, details, examples, and evidence from the file. Do not skip important material or over-simplify.`,
        `Start with a title slide, end with a closure slide.`,
        `Language: English.`,
        `Density: detailed (3-5 points per slide; each point must carry a real, specific piece of information — not a generic label. Use headline style, not paragraphs). If a section has rich content, split it into multiple slides rather than cramming it into two bullet points.`,
        `If headings or page numbers appear in the document, cite them in the source field.`,
        `Objectives: 2-5 items extracted from the file, phrased "Students will be able to ..."`,
        `Each slide index must appear in exactly one teachingFlow stage.`,
        `slideTheme = null on every slide, no exceptions.`,
        `gameSuggestion = null always.`,
        `visualDirection.icon: a Lucide icon name in PascalCase such as Lightbulb, Target, BookOpen, Brain, FlaskConical, Atom, Calculator, Globe2, Leaf, Sun, Zap, BarChart3, Clock, CheckCircle2, Megaphone, ListChecks, Users, Quote, Microscope.`,
        `imageQuery: a **2-5 word English** web search phrase describing a concrete, professional photo that fits the slide and helps explain one of its bullets (e.g. "solar panels desert", "human heart anatomy", "ancient Egyptian pyramids"). Avoid abstract terms ("introduction", "summary"). This field is critical to the deck's visual quality.`,
        `imagePlacement: "side" (default — inline photo column next to the text, use for content slides) | "background" (full-bleed — only for hero/stat/quote-style slides with one strong line) | "none" (rare).`,
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
const FILE_OUTLINE_MODEL = "gpt-5";

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
      /* gpt-5 counts hidden reasoning tokens against max_completion_tokens;
         minimal effort + a large budget prevents empty truncated replies. */
      max_completion_tokens: 16000,
      reasoning_effort: "minimal",
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
      max_completion_tokens: 16000,
      reasoning_effort: "minimal",
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
  /* Tolerant index — coerce strings/floats, default to 0 if missing. The
     post-parse pipeline reassigns indices sequentially anyway. */
  index: z
    .any()
    .optional()
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 0;
    }),
  /* Coerce unexpected values to "concept-card" instead of failing. */
  kind: slideKindSchema.catch("concept-card" as const),
  /* Title may arrive empty/whitespace — keep optional; we drop slides with
     no usable title in the post-parse cleanup. */
  title: z
    .any()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim().slice(0, 80) : "")),
  purpose: z
    .any()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim().slice(0, 140) : "")),
  /* talkingPoints — fully tolerant. Accept null, missing, or a string.
     Filter out non-string / empty entries. Empty arrays survive parse and
     the post-parse cleanup uses the title as a fallback bullet so the
     slide is never dropped just because the AI forgot bullets. */
  talkingPoints: z
    .any()
    .optional()
    .transform((v) => {
      const arr = Array.isArray(v) ? v : v == null ? [] : [v];
      return arr
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 140))
        .slice(0, 6);
    }),
  interactionHint: z
    .any()
    .optional()
    .transform((v) => {
      const allowed = ["poll", "quiz", "discussion", "activity"] as const;
      return typeof v === "string" && (allowed as readonly string[]).includes(v)
        ? (v as (typeof allowed)[number])
        : null;
    }),
  gameSuggestion: z.any().optional().transform(() => null),
  slideTheme: z.any().optional().transform(() => null),
  visualDirection: z
    .any()
    .optional()
    .transform((v) => {
      if (!v || typeof v !== "object") return {};
      const obj = v as Record<string, unknown>;
      const out: { icon?: string; layoutHint?: string } = {};
      if (typeof obj.icon === "string") out.icon = obj.icon.slice(0, 40);
      if (typeof obj.layoutHint === "string") out.layoutHint = obj.layoutHint.slice(0, 40);
      return out;
    }),
  /* 1-based index of the uploaded image to use as this slide's background,
     or null if the slide is purely AI-text (no source image). Parse-tolerant
     on purpose — any garbage value (string, 0, negative, NaN, out-of-range)
     becomes null instead of failing the whole AI response. The route handler
     still re-clamps against the actual upload count. */
  sourceImageIndex: z
    .any()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const num = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(num)) return null;
      const intVal = Math.floor(num);
      return intVal >= 1 ? intVal : null;
    }),
  /* Free-text web search query (2-5 English words) the server uses to fetch
     a relevant photo from Brave/Wikimedia and stamp as the slide background.
     Empty / non-string ⇒ no web image lookup for this slide. */
  imageQuery: z
    .any()
    .optional()
    .transform((v) => {
      if (typeof v !== "string") return "";
      return v.trim().replace(/\s+/g, " ").slice(0, 80);
    }),
  /* Where the photo should sit on the slide. "side" inserts a real
     image column next to the text (default), "background" paints it
     full-bleed (use for hero/cover-style slides only), "none"
     suppresses image rendering. Tolerant parse. */
  imagePlacement: z
    .any()
    .optional()
    .transform((v): "side" | "background" | "none" | undefined => {
      if (v === "side" || v === "background" || v === "none") return v;
      return undefined;
    }),
});

const multiImageResponseSchema = z.object({
  language: z
    .any()
    .optional()
    .transform((v) => (v === "en" ? "en" : "ar") as "ar" | "en"),
  /* Tolerant — accept whatever array we get (even empty). Post-parse cleanup
     drops invalid slides and the caller throws only when the *cleaned*
     count is below the minimum, so a single bad slide can't blank a 12-
     slide response. */
  slides: z.any().optional().transform((v) => (Array.isArray(v) ? v : [])),
});

export interface MultiImageOutlineResult {
  cards: OutlineCard[];
  language: "ar" | "en";
  density: Density;
  /** Per-card 1-based source image index, or null when the slide has no
      backing image. Length === cards.length. The route handler maps each
      entry to the corresponding uploaded URL to stamp `backgroundImage`. */
  sourceImageIndices: (number | null)[];
  /** Per-card free-text web search query (English keywords) the route
      handler uses to fetch a real photo from Brave/Wikimedia and stamp
      as `backgroundImage` when no uploaded image is associated. Empty
      string ⇒ skip web lookup for that slide. Length === cards.length. */
  imageQueries: string[];
  /** Per-card hint for where the resolved photo should live on the
      slide ("side" = inline column, "background" = full-bleed,
      "none" = suppress, undefined = let the materializer pick a
      sensible default per slide kind). Length === cards.length. */
  imagePlacements: Array<"side" | "background" | "none" | undefined>;
}

export async function multiImagesToOutline(
  images: Array<{ buffer: Buffer; filename: string; mime: string }>,
): Promise<MultiImageOutlineResult> {
  if (images.length === 0) throw new Error("multiImagesToOutline: empty images array");
  const n = images.length;

  /* Recommended slide count is content-driven, not 1-per-image. The AI is
     asked to extract the actual material in the photos and lay it out as
     a coherent lesson. We give a target range (min..max) so a single dense
     page becomes 6-10 slides and a thick batch becomes 12-18. */
  const minSlides = Math.min(20, Math.max(5, Math.ceil(n * 1.5) + 3));
  const maxSlides = Math.min(20, minSlides + 4);

  const schemaExample = `{
  "language": "ar",
  "slides": [
    {
      "index": 1,
      "kind": "concept-card",
      "title": "عنوان الشريحة",
      "purpose": "وصف موجز",
      "talkingPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "interactionHint": null,
      "gameSuggestion": null,
      "slideTheme": null,
      "visualDirection": { "icon": "Lightbulb", "layoutHint": "left-icon" },
      "sourceImageIndex": null,
      "imageQuery": "renewable energy classroom",
      "imagePlacement": "side"
    }
  ]
}`;

  const lines = [
    n === 1
      ? `لديك صورة واحدة مرفوعة تحتوي على مادة تعليمية. اقرأ كل ما فيها بدقة (نصوص، عناوين، أمثلة، أرقام، أشكال) ثم حوّلها إلى عرض تقديمي **متكامل** من ${minSlides}-${maxSlides} شريحة.`
      : `لديك ${n} صور تعليمية مرفوعة تشكّل معاً مصدر المحتوى. اقرأ كل الصور كأنها فصل واحد متصل، استخرج كل المعلومات والمفاهيم الموجودة فيها، ثم رتّبها في عرض تقديمي **منظَّم ومتكامل** من ${minSlides}-${maxSlides} شريحة.`,
    "",
    `قواعد البناء (مهمة جداً):`,
    `1. **لا تستخدم kind="title" ولا kind="closure" أبداً.** كل شرائح العرض يجب أن تكون من نفس عائلة التخطيطات حتى يبدو العرض متجانساً (نفس الإطار والتباعد).`,
    `2. استخدم خليطاً متنوعاً من: concept-card, visual-hero, objectives, steps, comparison, formula, stat, quote, callout, timeline, interactive. لا تكرر نفس الـ kind أكثر من مرتين متتاليتين.`,
    `3. الشريحة الأولى تكون عادةً kind="concept-card" أو "objectives" (تعرض الموضوع الرئيسي والأهداف بنفس تخطيط بقية العرض).`,
    `4. الشريحة الأخيرة تكون عادةً kind="callout" أو "concept-card" تلخّص الفكرة (لا تستخدم closure).`,
    `5. **لا تختصر الصور إلى شريحة واحدة لكل صورة.** إذا الصورة تحتوي 3 أمثلة مثلاً، اجعل كل مثال شريحة منفصلة. إذا الصور كثيرة وتشترك في موضوع واحد، اجمع المتشابه.`,
    `6. **استخرج المحتوى الفعلي من الصور** — لا تختلق معلومات غير موجودة. اقتبس النصوص والأرقام كما هي.`,
    `7. أضف 1-2 شريحة تفاعلية (kind="interactive", interactionHint="quiz") تختبر فهم الطلاب لمحتوى الصور.`,
    `8. talkingPoints: 3-5 نقاط لكل شريحة بأسلوب عناوين مكثّفة. كل نقطة يجب أن تحمل معلومة حقيقية محددة من محتوى الصور — لا نقاط عامة مثل "أهمية الموضوع" أو "خطوات العمل". إذا الشريحة غنية بالمعلومات قسّمها إلى شريحتين.`,
    `9. اللغة: عربية إذا كان محتوى الصور بالعربية، إنجليزية إذا كان بالإنجليزية.`,
    `10. slideTheme = null دائماً، gameSuggestion = null دائماً.`,
    "",
    `الربط بالصور المرفوعة (sourceImageIndex):`,
    `- لكل شريحة، اختر **رقم الصورة (1 إلى ${n})** التي تستند إليها هذه الشريحة من الصور المرفوعة، أو null.`,
    `- يمكن استخدام نفس الصورة في أكثر من شريحة (مثلاً صورة بها 3 أمثلة → 3 شرائح كلها sourceImageIndex=1).`,
    `- اجعل sourceImageIndex=null على الشرائح التمهيدية أو التلخيصية التي لا تطابق صورة معينة.`,
    "",
    `الصور الاحترافية من الويب (imageQuery) — مهم جداً للحصول على عرض جذاب:`,
    `- لكل شريحة (خاصةً sourceImageIndex=null) أنشئ **استعلام بحث بالإنجليزية من 2-5 كلمات** يصف صورة احترافية تناسب موضوع الشريحة وتشرح أو توضّح نقطة من نقاطها.`,
    `- الكلمات يجب أن تكون مرئية وملموسة (وصف بصري لمشهد/كائن)، لا مفاهيم مجردة.`,
    `- أمثلة جيدة: "solar panels desert", "human heart anatomy", "ancient Egyptian pyramids", "mathematics blackboard equations", "microscope laboratory close-up", "library books shelves".`,
    `- أمثلة سيئة: "introduction", "summary", "lesson 3", "important note" (مفاهيم مجردة لا تعطي صورة).`,
    `- إذا كانت الشريحة تستخدم sourceImageIndex فعلياً (لها صورة مرفوعة)، اجعل imageQuery="" لتجنب البحث.`,
    `- اجتهد في كل استعلام — هذه الصور هي ما يجعل العرض احترافياً ومميزاً.`,
    "",
    `موضع الصورة (imagePlacement) — اختر ذلك بعناية:`,
    `- **"side"** (الافتراضي): تظهر الصورة كعمود حقيقي بجانب النص، مثل عروض Gamma/Canva. استخدمها لكل شرائح المحتوى (concept-card, callout, comparison, formula, steps, objectives, timeline, interactive).`,
    `- **"background"**: تغطّي الصورة كامل الشريحة كخلفية. استخدمها فقط للشرائح التي تحتوي عبارة قوية موجزة (visual-hero, stat, quote) أو شريحة افتتاحية ذات أثر بصري.`,
    `- **"none"**: لا تعرض صورة على هذه الشريحة. استخدمها نادراً عند رغبتك في إبراز النص فقط.`,
    "",
    `الأيقونات (visualDirection.icon):`,
    `- لكل شريحة اختر اسم أيقونة بالإنجليزية بصيغة PascalCase من Lucide مثل: Lightbulb, Target, BookOpen, Brain, Heart, Trophy, GraduationCap, FlaskConical, Atom, Calculator, Globe2, Leaf, Sun, Moon, Zap, BarChart3, PieChart, TrendingUp, Clock, CheckCircle2, Megaphone, ListChecks, Users, Quote, Camera, Code, Microscope.`,
    `- اختر الأيقونة الأنسب لمحتوى الشريحة، لا تكرر نفس الأيقونة على شرائح متجاورة.`,
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
  /* Larger token budget — content-driven decks need room to breathe. */
  const resp = await openai.chat.completions.create({
    model: FILE_OUTLINE_MODEL,
    max_completion_tokens: 16000,
    reasoning_effort: "minimal",
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
    /* Should be unreachable now that the response schema is fully tolerant,
       but guard anyway. */
    throw new Error(
      `multiImagesToOutline parse failed: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    );
  }

  /* Per-slide tolerant cleanup. We safeParse each entry independently so
     a single malformed slide cannot wipe out the whole response. Slides
     are kept whenever they have a usable title; missing talkingPoints are
     repaired by reusing the title (better than dropping the slide). */
  type ParsedSlide = z.infer<typeof multiImageSlideSchema>;
  const cleaned: ParsedSlide[] = [];
  for (const rawSlide of parsed.data.slides) {
    const r = multiImageSlideSchema.safeParse(rawSlide);
    if (!r.success) continue;
    const s = r.data;
    if (!s.title) continue;
    if (s.talkingPoints.length === 0) {
      s.talkingPoints = [s.purpose || s.title];
    }
    /* Enforce visual consistency — even if the AI ignored the prompt and
       returned title/closure kinds (which use centered/contrast layouts),
       remap them to neutral content kinds so every slide in the deck shares
       the same frame, padding, and typography. */
    if (s.kind === "title") s.kind = "concept-card";
    else if (s.kind === "closure") s.kind = "callout";
    cleaned.push(s);
  }

  /* Require at least 3 usable slides so a single uploaded image still
     produces a real intro+content+closure deck. The caller catches this
     and falls back to the safe blank-slides path with a logged warning. */
  if (cleaned.length < 3) {
    throw new Error(
      `multiImagesToOutline: only ${cleaned.length} usable slides after cleanup (need ≥ 3)`,
    );
  }

  /* Sort by index then reassign sequentially so duplicates / gaps don't
     break downstream `s${index}` element IDs. */
  const sorted = [...cleaned].sort((a, b) => (a.index || 0) - (b.index || 0));

  const cards: OutlineCard[] = sorted.map((s, i) => ({
    index: i + 1,
    kind: s.kind as SlideKind,
    title: s.title,
    purpose: s.purpose || s.title,
    talkingPoints: s.talkingPoints,
    interactionHint: (s.interactionHint ?? null) as InteractionHint,
    gameSuggestion: null,
    slideTheme: null,
    visualDirection: s.visualDirection ?? {},
  }));

  /* Map each slide's sourceImageIndex (1-based, AI-supplied) into a clamped
     1-based index of the uploaded images, or null. Out-of-range or missing
     values become null so the slide renders as plain AI text. */
  const sourceImageIndices: (number | null)[] = sorted.map((s) => {
    const v = s.sourceImageIndex;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const clamped = Math.floor(v);
    if (clamped < 1 || clamped > n) return null;
    return clamped;
  });

  /* Per-card web image search query. Empty string means "no lookup". When
     a slide already has a real uploaded image, we deliberately drop the
     query so we don't override the user's photo. */
  const imageQueries: string[] = sorted.map((s, i) => {
    if (sourceImageIndices[i] != null) return "";
    return s.imageQuery || "";
  });

  /* Per-card placement hint. For uploaded source photos we force
     "background" because the teacher's original photo should dominate
     the slide; for AI-fetched web images we honour whatever the model
     picked (or leave undefined so the materializer chooses a sensible
     default per slide kind). */
  const imagePlacements: Array<"side" | "background" | "none" | undefined> =
    sorted.map((s, i) =>
      sourceImageIndices[i] != null ? "background" : s.imagePlacement,
    );

  return {
    cards,
    language: parsed.data.language,
    density: "balanced" as Density,
    sourceImageIndices,
    imageQueries,
    imagePlacements,
  };
}
