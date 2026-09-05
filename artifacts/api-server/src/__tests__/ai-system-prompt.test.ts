import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    expect(prompt).toContain("لا توجد حصة رسائل يومية مستقلة");
    expect(prompt).not.toContain("له حد رسائل يومي حسب الباقة");
    expect(prompt).not.toContain("انتهى الحدّ اليومي");
  });

  it("keeps unsupported platform claims behind the exact support fallback", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("لا أملك هذه المعلومة حالياً، تواصل مع الدعم.");
    expect(prompt).toContain("لا تخترع");
    expect(prompt).toContain("لا تعرض قاعدة المعرفة أسعاراً أو حدوداً رقمية للباقات");
  });

  it("consistently supports teachers and organizers", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("مساعدة المعلّمين والمنظّمين");
    expect(prompt).toContain("زر عائم للمعلّمين والمنظّمين");
    expect(prompt).toContain("تسجيل دخول من `/login` ثم فتح `/organizer`");
    expect(prompt).toContain("واجهة مبسّطة للفعاليات والألعاب فقط، وتحتاج إلى تسجيل دخول");
    expect(prompt).not.toContain("للمعلّمين فقط");
    expect(prompt).not.toContain("زر عائم للمعلّم.");
    expect(prompt).not.toContain("الزائر (مقدّم فعالية)");
    expect(prompt).not.toContain("من `/organizer` (لوحة المنظّم)");
  });

  it("documents current high-value routes and rejects retired links", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("/student/login");
    expect(prompt).toContain("/game/join");
    expect(prompt).toContain("/game/wameeth/create");
    expect(prompt).toContain("/game/rocket/create");
    expect(prompt).toContain("/game/hotseat/create");
    expect(prompt).toContain("/game/tug/create");
    expect(prompt).toContain("/game/wheel/create");
    expect(prompt).toContain("/teacher/worksheets/create");
    expect(prompt).toContain("/teacher/lesson-plans/create");
    expect(prompt).toContain("/teacher/admin");
    expect(prompt).not.toContain("/student-login");
    expect(prompt).not.toContain("/game/wameedh");
  });

  it("keeps the FAQ data internally consistent with the prompt policy", () => {
    const faqPath = resolve(process.cwd(), "src/data/hasad_faq.json");
    const parsed = JSON.parse(readFileSync(faqPath, "utf8")) as {
      faqs: Array<{ q: string; a: string }>;
    };
    const answers = parsed.faqs.map((entry) => entry.a).join("\n");
    const quotaEntry = parsed.faqs.find((entry) =>
      entry.q.includes("الحدّ اليومي"),
    );

    expect(quotaEntry?.a).toContain("لا توجد حصة رسائل يومية مستقلة");
    expect(answers).not.toContain("انتهى الحدّ اليومي");
    expect(answers).not.toContain("/game/wameedh/create");
    expect(answers).toContain("/game/wameeth/create");
  });
});