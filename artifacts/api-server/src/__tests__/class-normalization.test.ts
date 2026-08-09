/** اختبارات تطبيع خانة الصف المقروءة من الورقة المصوّرة (مهمة 879). */
import { describe, it, expect } from "vitest";
import { normalizeExtractedClass } from "../routes/submissions";

describe("normalizeExtractedClass", () => {
  it("يقبل الأنماط القياسية رقم+شعبة", () => {
    expect(normalizeExtractedClass("3أ")).toBe("3أ");
    expect(normalizeExtractedClass("3 أ")).toBe("3أ");
    expect(normalizeExtractedClass("5ب")).toBe("5ب");
    expect(normalizeExtractedClass("12ج")).toBe("12ج");
  });

  it("يوحّد الأرقام العربية-الهندية", () => {
    expect(normalizeExtractedClass("٣أ")).toBe("3أ");
    expect(normalizeExtractedClass("١٢ ب")).toBe("12ب");
  });

  it("يحوّل الصف اللفظي إلى رقم", () => {
    expect(normalizeExtractedClass("ثالث أ")).toBe("3أ");
    expect(normalizeExtractedClass("الثالث أ")).toBe("3أ");
    expect(normalizeExtractedClass("حادي عشر ب")).toBe("11ب");
    expect(normalizeExtractedClass("ثاني عشر")).toBe("12");
    expect(normalizeExtractedClass("الصف الخامس")).toBe("5");
  });

  it("ينظف ضجيج OCR اللاتيني الملاصق للرقم", () => {
    expect(normalizeExtractedClass("i3")).toBe("3");
    expect(normalizeExtractedClass("3a")).toBe("3");
  });

  it("يرفض القيم المشوهة/غير الموثوقة ويعيد فارغاً", () => {
    expect(normalizeExtractedClass("13")).toBe(""); // رقم صف غير صالح (>12)
    expect(normalizeExtractedClass("0")).toBe("");
    expect(normalizeExtractedClass("abc")).toBe("");
    expect(normalizeExtractedClass("غير واضح")).toBe("");
    expect(normalizeExtractedClass("-")).toBe("");
    expect(normalizeExtractedClass("")).toBe("");
  });

  it("يزيل كلمات الحشو ويوحّد ألف الشعبة", () => {
    expect(normalizeExtractedClass("الصف 3 شعبة ا")).toBe("3أ");
    expect(normalizeExtractedClass("فصل ٤/د")).toBe("4د");
    expect(normalizeExtractedClass("5 هـ")).toBe("5ه");
  });
});
