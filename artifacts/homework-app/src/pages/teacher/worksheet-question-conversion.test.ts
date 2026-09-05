import { describe, expect, it } from "vitest";
import { convertQuestionType, type Question } from "./worksheet-print";

describe("worksheet question type conversion", () => {
  const mcq: Question = {
    id: "q-1",
    type: "mcq",
    prompt: "اختر الإجابة الصحيحة",
    options: ["الأول", "الثاني", "الثالث", "الرابع"],
    correctIndex: 1,
    points: 2,
  };

  it("keeps the prompt and points while removing fields from the old type", () => {
    expect(convertQuestionType(mcq, "true_false", true)).toEqual({
      id: "q-1",
      type: "true_false",
      prompt: "اختر الإجابة الصحيحة",
      correct: true,
      points: 2,
    });
  });

  it("creates editable matching pairs from existing MCQ options", () => {
    const converted = convertQuestionType(mcq, "matching", true);
    expect(converted.type).toBe("matching");
    if (converted.type !== "matching") return;
    expect(converted.pairs).toHaveLength(4);
    expect(converted.pairs.map(pair => pair.right)).toEqual(mcq.options);
    expect(converted.pairs[0].left).toBe("العبارة 1");
  });

  it("creates four valid editable options when converting to MCQ", () => {
    const converted = convertQuestionType(
      { id: "q-2", type: "true_false", prompt: "عبارة", correct: false },
      "mcq",
      true,
    );
    expect(converted.type).toBe("mcq");
    if (converted.type !== "mcq") return;
    expect(converted.options).toEqual(["الخيار 1", "الخيار 2", "الخيار 3", "الخيار 4"]);
    expect(converted.correctIndex).toBe(0);
  });
});