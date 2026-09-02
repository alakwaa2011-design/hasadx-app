import { describe, expect, it } from "vitest";
import { isValidQ } from "@/components/game/question-editor";
import { mapBackendQuestionToWameethQuestion } from "./wameeth-question-utils";

describe("mapBackendQuestionToWameethQuestion", () => {
  it("keeps a two-option MCQ valid when optionC and optionD are absent", () => {
    const question = mapBackendQuestionToWameethQuestion({
      text: "ما ناتج 2 + 2؟",
      optionA: "3",
      optionB: "4",
      correctAnswer: "B",
    });

    expect(question).not.toBeNull();
    expect(question).toMatchObject({
      type: "mcq",
      optionA: "3",
      optionB: "4",
      optionC: "",
      optionD: "",
      correctAnswer: "B",
    });
    expect(isValidQ(question!)).toBe(true);
  });

  it("keeps a three-option MCQ valid without requiring optionD", () => {
    const question = mapBackendQuestionToWameethQuestion({
      text: "أيها كوكب؟",
      optionA: "القمر",
      optionB: "الشمس",
      optionC: "الأرض",
      correctAnswer: "C",
    });

    expect(question).not.toBeNull();
    expect(question).toMatchObject({
      type: "mcq",
      optionA: "القمر",
      optionB: "الشمس",
      optionC: "الأرض",
      optionD: "",
      correctAnswer: "C",
    });
    expect(isValidQ(question!)).toBe(true);
  });

  it("preserves all four options and the correct answer", () => {
    const question = mapBackendQuestionToWameethQuestion({
      text: "ما عاصمة فرنسا؟",
      optionA: "مدريد",
      optionB: "روما",
      optionC: "باريس",
      optionD: "برلين",
      correctAnswer: "C",
    });

    expect(question).toMatchObject({
      optionA: "مدريد",
      optionB: "روما",
      optionC: "باريس",
      optionD: "برلين",
      correctAnswer: "C",
    });
    expect(isValidQ(question!)).toBe(true);
  });
});