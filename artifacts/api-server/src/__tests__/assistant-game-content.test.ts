import { describe, expect, it } from "vitest";
import { assistantGameDraft } from "../lib/assistant-game-content";
import { assistantResultUrl, validateAssistantToolRequest } from "../lib/assistant-tools";

const questions = [
  { text: "كم حاصل جمع ٢ + ٢؟", questionType: "mcq", optionA: "٣", optionB: "٤", optionC: "٥", optionD: "٦", correctAnswer: "B" },
  { text: "الماء ضروري للحياة.", questionType: "true_false", correctAnswer: "true" },
];
describe("assistant game drafts", () => {
  it.each(["wheel", "rocket", "hack", "self"] as const)("opens %s on its correct review page", gameType => {
    const url = assistantResultUrl({ tool: "game", parameters: { gameType }, resultId: 42, worksheetId: null });
    expect(url).toBe(gameType === "self" ? "/teacher/solo-challenges/new?savedGameId=42"
      : gameType === "hack" ? "/game/hack?savedGameId=42" : `/game/${gameType}/create?savedGameId=42`);
  });
  it("writes wheel segments and Arabic answers without dropping questions", () => {
    const draft = assistantGameDraft("wheel", questions, "ar");
    expect(draft.content).toMatchObject({ segments: [
      { text: questions[0].text, answer: "٤", kind: "question", points: 100 },
      { text: questions[1].text, answer: "صح", kind: "question" },
    ] });
    expect(draft.settings).toMatchObject({ contentLang: "ar", teamCount: 2, spinSeconds: 5, soundOn: true });
  });
  it("writes rocket questions in its native format", () => {
    const draft = assistantGameDraft("rocket", questions, "ar");
    expect(draft.content).toMatchObject({ questions: [
      { text: questions[0].text, correct: 1 },
      { text: questions[1].text, type: "tf", options: ["صح", "خطأ"], correct: 0 },
    ] });
  });
  it("keeps native self-paced and hack questions intact", () => {
    expect(assistantGameDraft("self", questions, "ar")).toMatchObject({ gameType: "solo", content: { questions } });
    expect(assistantGameDraft("hack", questions, "ar")).toMatchObject({ gameType: "hack", content: { questions } });
  });
  it.each(["tug", "xo"] as const)("preserves two-choice true/false compatibility for existing %s drafts", gameType => {
    expect(assistantGameDraft(gameType, questions, "ar").content).toMatchObject({
      questions: [{ correct: 1 }, { options: ["صح", "خطأ"], correct: 0 }],
    });
  });
  it.each([1, 17, 30])("refuses incompatible wheel count %s rather than truncating", questionCount => {
    expect(() => validateAssistantToolRequest({ title: "عجلة العلوم", template: "geometric",
      parameters: { topic: "الماء", subject: "العلوم", gradeLevel: "الرابع", gameType: "wheel", questionCount } }, "game")).toThrow();
  });
});
