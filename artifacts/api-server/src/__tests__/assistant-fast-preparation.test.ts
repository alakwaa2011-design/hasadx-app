import { describe, expect, it } from "vitest";
import { assistantCreditTool, fastAssistantPreparation, resolveAssistantToolIntent, validateAssistantToolRequest } from "../lib/assistant-tools";

describe("assistant fast preparation and tool contracts", () => {
  it.each([
    ["اريد لعبة عن مكروهات الصيام للصف الرابع", "game"],
    ["أريد أن تصنع لي لعبة عن الكسور", "game"],
    ["حولها إلى لعبة", "game"],
    ["create a game about plants", "game"],
    ["أريد اختبار عن الكسور", "quiz"],
    ["أريد خطة درس عن الصيام", "lesson-plan"],
    ["ورقة عمل فيها لعبة إكس أو", "worksheet"],
    ["غير عدد الأسئلة إلى عشرة", "worksheet"],
  ] as const)("resolves the requested tool without matching incidental mentions: %s", (message, expected) => {
    expect(resolveAssistantToolIntent(message, "worksheet")).toBe(expected);
  });
  it.each(["worksheet", "quiz", "game", "lesson-plan"] as const)("prepares a clear %s without an AI call", tool => {
    const result = fastAssistantPreparation("أنشئ محتوى عن الكسور للصف الرابع", "ar", tool);
    expect(result?.parameters.topic).toBe("الكسور");
    expect(result?.parameters.gradeLevel).toBe("الرابع");
    expect(result?.parameters.subject).toBe("الرياضيات");
  });
  it("preserves explicit Arabic-numeral quiz counts", () => {
    expect(fastAssistantPreparation("اختبار عن الكسور للصف الرابع من ٨ أسئلة", "ar", "quiz")?.parameters.questionCount).toBe(8);
  });
  it("keeps English content English even from an Arabic interface", () => {
    expect(fastAssistantPreparation("quiz about fractions for grade 4", "ar", "quiz")?.parameters.language).toBe("en");
  });
  it.each(["ورقة عن الكسور للصف الرابع من سؤال واحد", "ورقة عن الكسور للصف الرابع من سؤالين", "ورقة عن الكسور للصف الرابع بتصميم ملوّن", "ورقة عن الكسور للصف الرابع بالإنجليزية"])("never shortcuts a teacher choice: %s", text => {
    expect(fastAssistantPreparation(text, "ar", "worksheet")).toBeNull();
  });
  it("routes complex duration and pedagogy to the full parser instead of silently defaulting", () => {
    expect(fastAssistantPreparation("تحضير عن الكسور للصف الرابع 60 دقيقة بالاستقصاء", "ar", "lesson-plan")).toBeNull();
  });
  it("uses each tool's existing price and rejects nonplayable XO counts", () => {
    expect(assistantCreditTool("game")).toBe("ai-questions");
    expect(assistantCreditTool("quiz")).toBe("ai-questions");
    expect(assistantCreditTool("lesson-plan")).toBe("lesson-plan");
    expect(() => validateAssistantToolRequest({ title: "درس الكسور", template: "geometric",
      parameters: { topic: "الكسور", subject: "الرياضيات", gradeLevel: "الرابع", gameType: "xo", questionCount: 5 } }, "game")).toThrow();
  });
});
