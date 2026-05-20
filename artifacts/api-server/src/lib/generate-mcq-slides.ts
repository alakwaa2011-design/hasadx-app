/* generate-mcq-slides.ts
   Given extracted text from a PPTX/DOCX import, calls OpenAI to produce
   2-3 MCQ questions and returns them as materialized interactive slides
   ready to be appended to the deck.
*/

import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { buildOneSlide } from "./materialize-slide";
import { slideSchema } from "../routes/presentations";
import type { OutlineCard } from "@workspace/slide-templates";

const MCQ_MODEL = "gpt-4o-mini";

/* ── Zod schema for the AI response ─────────────────────────────── */
const mcqQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  slideTitle: z.string().min(1).max(80).optional(),
});

const mcqResponseSchema = z.object({
  questions: z.array(mcqQuestionSchema).min(1).max(5),
});

type McqQuestion = z.infer<typeof mcqQuestionSchema>;

/* ── Loose JSON parser (same pattern as file-to-outline.ts) ──────── */
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

/* ── Build the prompt asking for MCQ questions ───────────────────── */
function buildMcqPrompt(text: string, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const schema = `{
  "questions": [
    {
      "slideTitle": "${ar ? "سؤال تحقق من الفهم" : "Check your understanding"}",
      "prompt": "${ar ? "السؤال هنا؟" : "Question here?"}",
      "options": ["${ar ? "الخيار أ" : "Option A"}", "${ar ? "الخيار ب" : "Option B"}", "${ar ? "الخيار ج" : "Option C"}", "${ar ? "الخيار د" : "Option D"}"],
      "correctIndex": 0
    }
  ]
}`;

  if (ar) {
    return [
      "اقرأ النص التعليمي التالي وأنتج 2-3 أسئلة اختيار متعدد (MCQ) لاختبار فهم الطلاب.",
      "كل سؤال يجب أن يكون واضحاً ومباشراً ومرتبطاً بالمحتوى الفعلي.",
      "الخيارات 3-4 لكل سؤال. حدد correctIndex (صفري) للإجابة الصحيحة.",
      "slideTitle: عنوان قصير للشريحة التفاعلية (اختياري).",
      "أجب بـ JSON صارم فقط — بدون أي شرح.",
      "",
      `صيغة الرد:\n${schema}`,
      "",
      "النص التعليمي:",
      text.slice(0, 6000),
    ].join("\n");
  }

  return [
    "Read the following educational text and produce 2-3 multiple-choice questions (MCQ) to check student understanding.",
    "Each question must be clear, direct, and grounded in the actual content.",
    "3-4 options per question. Set correctIndex (zero-based) to the correct answer.",
    "slideTitle: a short heading for the interactive slide (optional).",
    "Reply with strict JSON only — no prose.",
    "",
    `Reply shape:\n${schema}`,
    "",
    "Educational text:",
    text.slice(0, 6000),
  ].join("\n");
}

/* ── Convert an MCQ question to a materialized slide ─────────────── */
function questionToCard(q: McqQuestion, index: number, lang: "ar" | "en"): OutlineCard {
  const ar = lang === "ar";
  return {
    index,
    kind: "interactive",
    title: q.slideTitle ?? (ar ? "سؤال تحقق من الفهم" : "Check your understanding"),
    purpose: ar ? "اختبار فهم الطلاب للمحتوى" : "Check student comprehension",
    talkingPoints: [q.prompt],
    interactionHint: "quiz",
    gameSuggestion: null,
    gameQuestions: [
      {
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
      },
    ],
    slideTheme: null,
    visualDirection: { icon: "HelpCircle", layoutHint: "center" },
  };
}

/* ── Main entry point ────────────────────────────────────────────── */

/**
 * Given extracted text from a PPTX/DOCX file, calls OpenAI to generate
 * 2-3 MCQ questions and returns them as validated slide objects that can
 * be appended to the final deck.
 *
 * @param text      The full extracted text (titles + bullets joined).
 * @param lang      Detected deck language.
 * @param themeKey  Theme to apply when materializing slides.
 * @param startIdx  The index to start numbering OutlineCards from.
 * @returns         Array of validated slide objects (may be empty on failure).
 */
export async function generateMcqSlides(
  text: string,
  lang: "ar" | "en",
  themeKey: string,
  startIdx: number,
): Promise<unknown[]> {
  if (!text.trim()) return [];

  const prompt = buildMcqPrompt(text, lang);

  const resp = await openai.chat.completions.create({
    model: MCQ_MODEL,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: lang === "ar"
          ? "أنت مساعد تعليمي. أنتج أسئلة اختيار متعدد بناءً على المحتوى المقدم. أجب بـ JSON فقط."
          : "You are an educational assistant. Produce multiple-choice questions from the provided content. Reply with JSON only.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = parseJsonLoose(resp.choices[0]?.message?.content ?? "");
  const parsed = mcqResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  /* Limit to 3 questions max. */
  const questions = parsed.data.questions.slice(0, 3);

  const slides: unknown[] = [];
  for (let i = 0; i < questions.length; i++) {
    const card = questionToCard(questions[i], startIdx + i, lang);
    const result = buildOneSlide({
      card,
      themeKey,
      density: "balanced",
      lang,
    });
    const validated = slideSchema.safeParse(result.slide);
    if (validated.success) {
      slides.push(validated.data);
    }
  }
  return slides;
}
