export type NormalizedGameQuestionType = "mcq" | "true_false" | "fill_blank";

export interface RawGameQuestion {
  text?: unknown;
  question?: unknown;
  questionType?: unknown;
  type?: unknown;
  options?: unknown;
  optionA?: unknown;
  optionB?: unknown;
  optionC?: unknown;
  optionD?: unknown;
  correct?: unknown;
  correctAnswer?: unknown;
  correctText?: unknown;
  imageUrl?: unknown;
}

export interface NormalizedGameQuestion {
  text: string;
  type: NormalizedGameQuestionType;
  options: string[];
  correct: number;
  correctText?: string;
  imageUrl: string | null;
}

const LETTERS = ["A", "B", "C", "D"] as const;

export function normalizeGameQuestion(
  input: RawGameQuestion,
  options: {
    trueLabel?: string;
    falseLabel?: string;
    allowFillBlank?: boolean;
  } = {},
): NormalizedGameQuestion | null {
  const text = typeof input.text === "string"
    ? input.text.trim()
    : typeof input.question === "string"
      ? input.question.trim()
      : "";
  if (!text) return null;

  const rawType = String(input.questionType ?? input.type ?? "mcq").toLowerCase();
  const imageUrl = typeof input.imageUrl === "string" && input.imageUrl.trim()
    ? input.imageUrl
    : null;
  const answer = input.correct ?? input.correctAnswer;

  if (rawType === "true_false" || rawType === "tf") {
    const normalizedAnswer = String(answer ?? "").trim().toLowerCase();
    const correct = normalizedAnswer === "false" || normalizedAnswer === "b" || normalizedAnswer === "خطأ" ? 1 : 0;
    return {
      text,
      type: "true_false",
      options: [options.trueLabel ?? "صح", options.falseLabel ?? "خطأ"],
      correct,
      imageUrl,
    };
  }

  if (rawType === "fill_blank") {
    if (!options.allowFillBlank) return null;
    const correctText = String(input.correctText ?? input.correctAnswer ?? "").trim();
    if (!correctText) return null;
    const acceptedAnswers = correctText.split("|").map(value => value.trim()).filter(Boolean);
    return {
      text,
      type: "fill_blank",
      options: acceptedAnswers,
      correct: -1,
      correctText: acceptedAnswers[0],
      imageUrl,
    };
  }

  const keyedOptions = Array.isArray(input.options)
    ? input.options.slice(0, 4).map((value, index) => ({
        key: LETTERS[index],
        value: typeof value === "string" ? value.trim() : "",
      }))
    : LETTERS.map(key => ({
        key,
        value: typeof input[`option${key}`] === "string"
          ? (input[`option${key}`] as string).trim()
          : "",
      }));
  const presentOptions = keyedOptions.filter(option => option.value);
  if (presentOptions.length < 2) return null;

  let correct = 0;
  if (typeof answer === "number" && Number.isInteger(answer)) {
    const originalKey = LETTERS[answer];
    const remapped = presentOptions.findIndex(option => option.key === originalKey);
    if (remapped >= 0) correct = remapped;
  } else if (typeof answer === "string") {
    const normalizedAnswer = answer.trim();
    const remapped = presentOptions.findIndex(option =>
      option.key === normalizedAnswer.toUpperCase() || option.value === normalizedAnswer
    );
    if (remapped >= 0) correct = remapped;
  }

  return {
    text,
    type: "mcq",
    options: presentOptions.map(option => option.value),
    correct,
    imageUrl,
  };
}