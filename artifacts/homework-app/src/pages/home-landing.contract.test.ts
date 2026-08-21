import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  path.resolve(process.cwd(), "src/pages/home.tsx"),
  "utf8",
);
const layoutSource = readFileSync(
  path.resolve(process.cwd(), "src/components/layout.tsx"),
  "utf8",
);

describe("الصفحة العامة", () => {
  it("تعرض رسالة المعلم ورابط البدء وشريط الانضمام في بداية التجربة", () => {
    expect(homeSource).toContain("من فكرة الدرس إلى");
    expect(homeSource).toContain("تجربة تعليمية كاملة");
    expect(homeSource).toContain("ابدأ مجاناً كمعلم");
    expect(homeSource).toContain('id="join"');
    expect(homeSource).toContain("لديك رمز لعبة أو مسابقة؟");
    expect(layoutSource).toContain('href="/#join"');
    expect(layoutSource).toContain("/register?role=teacher");
  });

  it("يبقي تجربة البداية ثنائية اللغة واتجاه الصفحة مرتبطاً باللغة", () => {
    expect(homeSource).toContain('<main className="overflow-hidden bg-background font-display" dir={dir}>');
    expect(homeSource).toContain('dir={dir}');
    expect(homeSource).toContain("From lesson idea to");
    expect(homeSource).toContain("a complete learning experience");
    expect(homeSource).toContain("Start free as a teacher");
    expect(homeSource).toContain("Have a game or quiz code?");
  });

  it("يبقي منطق الانضمام الحالي ومسار البحث عن الرمز متصلين بالواجهة", () => {
    expect(homeSource).toContain("const handlePinJoin");
    expect(homeSource).toContain("/api/pin-lookup/${trimmed}");
    expect(homeSource).toContain("startScanner");
    expect(homeSource).toContain("stopScanner");
    expect(homeSource).toContain("const digitRefs = [");
    expect(homeSource).toContain("slots.map((slotVal, i) =>");
    expect(homeSource).toContain("maxLength={1}");
  });
});