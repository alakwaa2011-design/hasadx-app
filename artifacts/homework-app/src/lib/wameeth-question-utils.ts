import {
  emptyQuestion,
  type Correct,
  type Question,
} from "@/components/game/question-editor";

export interface WameethBackendQuestion {
  text: string;
  questionType?: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null;
  imageUrl?: string | null;
}

/**
 * Maps an assignment question into the editable question shape used by
 * Wameeth's review step. MCQs intentionally require only A and B: C and D
 * remain optional so assignments with two or three choices stay playable.
 */
export function mapBackendQuestionToWameethQuestion(
  q: WameethBackendQuestion,
): Question | null {
  const qt = q.questionType || "mcq";

  if (qt === "true_false") {
    if (q.correctAnswer !== "true" && q.correctAnswer !== "false") return null;
    return {
      ...emptyQuestion("tf"),
      text: q.text,
      correctAnswer: q.correctAnswer === "true" ? "A" : "B",
      imageUrl: q.imageUrl || null,
    };
  }

  if (qt === "fill_blank") {
    if (!q.correctAnswer) return null;
    const parts = q.correctAnswer.split("|").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    return {
      ...emptyQuestion("fill_blank"),
      text: q.text,
      fillAnswer: parts[0],
      closeAnswers: parts.slice(1).join(", "),
      imageUrl: q.imageUrl || null,
    };
  }

  if (!(q.optionA && q.optionB && q.correctAnswer)) return null;
  return {
    ...emptyQuestion("mcq"),
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC || "",
    optionD: q.optionD || "",
    correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer)
      ? q.correctAnswer
      : "A") as Correct,
    imageUrl: q.imageUrl || null,
  };
}