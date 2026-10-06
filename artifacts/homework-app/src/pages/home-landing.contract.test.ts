import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(path.resolve(process.cwd(), "src/pages/home.tsx"), "utf8");
const landingSource = readFileSync(path.resolve(process.cwd(), "src/components/landing/home-landing.tsx"), "utf8");
const copySource = readFileSync(path.resolve(process.cwd(), "src/components/landing/home-copy.ts"), "utf8");

describe("الصفحة العامة (تصميم المصممة)", () => {
  it("تعرض رسالة الغلاف ورابط البدء كمعلم وأقسام التصميم الأحد عشر", () => {
    expect(copySource).toContain("حوّل دروسك إلى");
    expect(copySource).toContain("تجربة تعليمية");
    expect(copySource).toContain("ابدأ الآن مجاناً");
    expect(landingSource).toContain("/register?role=teacher");
    for (const id of ['id="top"', 'id="tools"', 'id="how-it-works"', 'id="join"', 'id="games"', 'id="contact"']) {
      expect(landingSource).toContain(id);
    }
  });

  it("يبقي الصفحة ثنائية اللغة واتجاهها مرتبطاً باللغة", () => {
    expect(landingSource).toContain('dir={dir}');
    expect(copySource).toContain("Turn your lessons into an");
    expect(copySource).toContain("Start free now");
    expect(copySource).toContain("Ready, student?");
  });

  it("يبقي منطق الانضمام الحالي ومسار البحث عن الرمز متصلين بالواجهة", () => {
    expect(homeSource).toContain("const handlePinJoin");
    expect(homeSource).toContain("/api/pin-lookup/${trimmed}");
    expect(homeSource).toContain("startScanner");
    expect(homeSource).toContain("stopScanner");
    expect(homeSource).toContain("const digitRefs = [");
    expect(homeSource).toContain("<HomeLanding");
    expect(landingSource).toContain("slots.map((slotVal, i) =>");
    expect(landingSource).toContain("maxLength={1}");
  });

  it("لا تعرض رقماً أو رأياً للمشتركين إلا من بيانات حقيقية", () => {
    // شارة الثقة تأتي من إحصاءات المنصة فقط، وقسم الآراء لا يظهر دون رأي ممرَّر
    expect(landingSource).toContain("teacherCount");
    expect(landingSource).toContain("{testimonial && (");
    expect(homeSource).not.toContain("testimonial=");
  });
});
