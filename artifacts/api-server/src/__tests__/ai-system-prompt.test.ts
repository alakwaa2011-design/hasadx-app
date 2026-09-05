import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../lib/ai-system-prompt";

describe("Hasad Guide system prompt", () => {
  it("loads the current adaptive-assessment knowledge", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("الاختبار التكيفي");
    expect(prompt).toContain("تكيفي متعدد المراحل");
    expect(prompt).toContain("عرض مسار الطالب");
    expect(prompt).toContain("الأسئلة الناقصة فقط");
  });

  it("uses the current points policy instead of the retired daily-message limit", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("نقاط حصاد");
    expect(prompt).toContain("ليست لها حصة رسائل يومية مستقلة");
    expect(prompt).not.toContain("له حد رسائل يومي حسب الباقة");
  });
});