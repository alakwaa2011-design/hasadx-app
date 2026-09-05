import { describe, expect, it } from "vitest";
import { mapTypedQuestion, validateAdaptiveDistribution, validateAdaptiveTarget } from "../routes/ai-questions";

describe("adaptive AI question classification", () => {
  it("normalizes textual difficulty and preserves the skill", () => {
    const question = mapTypedQuestion({
      text: "2 + 2 = ?",
      optionA: "3",
      optionB: "4",
      optionC: "5",
      optionD: "6",
      correctAnswer: "B",
      skill: "الجمع",
      difficulty: "easy",
    }, "mcq", true);

    expect(question).toMatchObject({ skill: "الجمع", difficulty: 1 });
  });

  it("rejects adaptive questions with a missing classification", () => {
    const question = mapTypedQuestion({
      text: "2 + 2 = ?",
      optionA: "3",
      optionB: "4",
      optionC: "5",
      optionD: "6",
      correctAnswer: "B",
    }, "mcq", true);

    expect(question).toBeNull();
  });

  it("accepts exactly two questions per skill and difficulty", () => {
    const questions = ["الجمع", "الطرح"].flatMap(skill =>
      [1, 2, 3].flatMap(difficulty => [
        { skill, difficulty },
        { skill, difficulty },
      ]));

    expect(validateAdaptiveDistribution(questions, 12)).toEqual({
      ready: true,
      skills: ["الجمع", "الطرح"],
    });
  });

  it("rejects an uneven distribution", () => {
    const questions = Array.from({ length: 12 }, () => ({ skill: "الجمع", difficulty: 1 }));
    expect(validateAdaptiveDistribution(questions, 12).ready).toBe(false);
  });

  it("accepts a targeted batch only when every question matches the requested gap", () => {
    const questions = [
      { skill: "الكسور", difficulty: 3 },
      { skill: "الكسور", difficulty: 3 },
    ];
    expect(validateAdaptiveTarget(questions, 2, "الكسور", 3)).toBe(true);
    expect(validateAdaptiveTarget(questions, 2, "الكسور", 2)).toBe(false);
  });
});