import { describe, expect, it } from "vitest";
import type { WorksheetQuestion } from "@workspace/api-zod";
import { answerText, buildAnswerItems, matchingColumnFractions, optionLabel } from "./worksheet-print";

describe("worksheet answer labels", () => {
  it("uses the same Arabic labels in MCQ answers as the printed choices", () => {
    const question = {
      id: "mcq-1",
      type: "mcq",
      prompt: "اختر الإجابة",
      options: ["الأول", "الثاني", "الثالث"],
      correctIndex: 1,
    } as WorksheetQuestion;

    expect(answerText(question, true, { true: "صح", false: "خطأ" }))
      .toBe(`(${optionLabel(1, true)}) الثاني`);
  });

  it("uses Arabic answer-bank letters throughout an Arabic matching key", () => {
    const question = {
      id: "matching-1",
      type: "matching",
      prompt: "صل",
      pairs: [
        { left: "واحد", right: "الأول" },
        { left: "اثنان", right: "الثاني" },
        { left: "ثلاثة", right: "الثالث" },
      ],
    } as WorksheetQuestion;

    const answer = answerText(question, true, { true: "صح", false: "خطأ" });
    expect(answer).toMatch(/^1 ← [أ-ي]/);
    expect(answer).not.toMatch(/[A-Z]/);
  });

  it("keeps global numeric question numbering across question types", () => {
    const questions = [
      { id: "tf-1", type: "true_false", prompt: "عبارة 1", correct: true },
      { id: "tf-2", type: "true_false", prompt: "عبارة 2", correct: false },
      { id: "mcq-1", type: "mcq", prompt: "اختر 1", options: ["أ", "ب"], correctIndex: 0 },
      { id: "mcq-2", type: "mcq", prompt: "اختر 2", options: ["أ", "ب"], correctIndex: 1 },
    ] as WorksheetQuestion[];
    expect(buildAnswerItems(questions, true, { true: "صح", false: "خطأ" })
      .map(item => item.questionLabel))
      .toEqual(["1", "2", "3", "4"]);
  });
});

describe("adaptive matching columns", () => {
  it("gives longer definitions more room without collapsing the short column", () => {
    expect(matchingColumnFractions([
      { left: "المشبه", right: "ما خفي منه وجه الشبه وبقيت الأداة مذكورة في العبارة" },
      { left: "وجه الشبه", right: "الصفة المشتركة بين الطرفين" },
    ])).toEqual({ left: 0.35, right: 0.65 });
  });

  it("keeps similar content close to equal widths", () => {
    const fractions = matchingColumnFractions([
      { left: "عبارة قصيرة", right: "تعريف قصير" },
      { left: "عبارة أخرى", right: "تعريف آخر" },
    ]);
    expect(Math.abs(fractions.left - fractions.right)).toBeLessThanOrEqual(0.05);
  });
});
