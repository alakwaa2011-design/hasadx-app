import { describe, expect, it } from "vitest";
import { normalizeGameQuestion } from "./normalize-game-question";

describe("normalizeGameQuestion", () => {
  it("accepts two and three-option multiple-choice questions", () => {
    expect(normalizeGameQuestion({
      text: "Two?",
      optionA: "A",
      optionB: "B",
      correctAnswer: "B",
    })).toMatchObject({ options: ["A", "B"], correct: 1, type: "mcq" });

    expect(normalizeGameQuestion({
      text: "Three?",
      optionA: "A",
      optionB: "B",
      optionC: "C",
      correctAnswer: "C",
    })).toMatchObject({ options: ["A", "B", "C"], correct: 2, type: "mcq" });
  });

  it("normalizes true/false answers into two choices", () => {
    expect(normalizeGameQuestion({
      text: "Statement",
      questionType: "true_false",
      correctAnswer: "false",
    }, { trueLabel: "True", falseLabel: "False" })).toEqual({
      text: "Statement",
      type: "true_false",
      options: ["True", "False"],
      correct: 1,
      imageUrl: null,
    });
  });

  it("only accepts fill-blank when the target game supports text answers", () => {
    const question = {
      text: "Capital?",
      questionType: "fill_blank",
      correctAnswer: "Kuwait|Kuwait City",
    };
    expect(normalizeGameQuestion(question)).toBeNull();
    expect(normalizeGameQuestion(question, { allowFillBlank: true })).toMatchObject({
      type: "fill_blank",
      options: ["Kuwait", "Kuwait City"],
      correct: -1,
      correctText: "Kuwait",
    });
  });
});