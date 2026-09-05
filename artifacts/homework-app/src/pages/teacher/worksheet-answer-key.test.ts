import { describe, expect, it } from "vitest";
import type { WorksheetQuestion } from "@workspace/api-zod";
import { answerText, buildAnswerItems, optionLabel } from "./worksheet-print";

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

  it("restarts labels for every type and numbers MCQs separately from their lettered options", () => {
    const questions = [
      { id: "tf-1", type: "true_false", prompt: "عبارة 1", correct: true },
      { id: "tf-2", type: "true_false", prompt: "عبارة 2", correct: false },
      { id: "mcq-1", type: "mcq", prompt: "اختر 1", options: ["أ", "ب"], correctIndex: 0 },
      { id: "mcq-2", type: "mcq", prompt: "اختر 2", options: ["أ", "ب"], correctIndex: 1 },
    ] as WorksheetQuestion[];

    expect(buildAnswerItems(questions, true, { true: "صح", false: "خطأ" })
      .map(item => item.questionLabel))
      .toEqual(["أ", "ب", "١", "٢"]);
  });
});
