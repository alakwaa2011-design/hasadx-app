import { describe, it, expect } from "vitest";
import {
  normalizeArabicName,
  matchStudentByName,
  parseWorksheetGradingResponse,
} from "../lib/worksheet-grading";

describe("parseWorksheetGradingResponse — سطر الاسم", () => {
  it("يستخرج الاسم والصف بثقة واضحة", () => {
    const r = parseWorksheetGradingResponse(
      "الاسم: محمد أحمد | خامس أ | واضح\n1: إجابة | 2 | صحيح",
      [2],
    );
    expect(r.extractedName).toBe("محمد أحمد");
    expect(r.extractedClass).toBe("خامس أ");
    expect(r.nameConfidence).toBe("clear");
  });

  it("يعتبر الاسم غير مؤكد عند وسم «غير مؤكد»", () => {
    const r = parseWorksheetGradingResponse(
      "الاسم: محمد | - | غير مؤكد\n1: x | 1 | صحيح",
      [1],
    );
    expect(r.extractedName).toBe("محمد");
    expect(r.extractedClass).toBe("");
    expect(r.nameConfidence).toBe("uncertain");
  });

  it("يتجاهل «غير واضح» كاسم ويبقى غير مؤكد", () => {
    const r = parseWorksheetGradingResponse(
      "الاسم: غير واضح | - | واضح\n1: x | 1 | صحيح",
      [1],
    );
    expect(r.extractedName).toBe("");
    expect(r.nameConfidence).toBe("uncertain");
  });

  it("سطر الاسم مفقود بالكامل: لا اسم، غير مؤكد، والأسئلة تُحلَّل", () => {
    const r = parseWorksheetGradingResponse("1: جواب | 1 | صحيح", [1]);
    expect(r.extractedName).toBe("");
    expect(r.nameConfidence).toBe("uncertain");
    expect(r.results[0].isCorrect).toBe(true);
  });

  it("يدعم النقطتين بعرض كامل «：» في سطر الاسم", () => {
    const r = parseWorksheetGradingResponse("الاسم： سارة | أول | واضح", [1]);
    expect(r.extractedName).toBe("سارة");
    expect(r.nameConfidence).toBe("clear");
  });
});

describe("parseWorksheetGradingResponse — أسطر الأسئلة", () => {
  it("يحلل الأسطر المرتبة بشكل طبيعي", () => {
    const r = parseWorksheetGradingResponse(
      "1: أ | 2 | صحيح\n2: ب | 0 | خطأ\n3: ج | 1 | جزئي",
      [2, 2, 2],
    );
    expect(r.results.map((x) => x.earnedPoints)).toEqual([2, 0, 1]);
    expect(r.results.map((x) => x.isCorrect)).toEqual([true, false, false]);
  });

  it("يربط برقم السؤال عند إعادة الترتيب", () => {
    const r = parseWorksheetGradingResponse(
      "3: ج | 3 | صحيح\n1: أ | 1 | صحيح\n2: ب | 0 | خطأ",
      [1, 2, 3],
    );
    expect(r.results.map((x) => x.earnedPoints)).toEqual([1, 0, 3]);
    expect(r.results[0].studentAnswer).toBe("أ");
    expect(r.results[2].studentAnswer).toBe("ج");
  });

  it("سطر مفقود لا يزحزح بقية الدرجات", () => {
    const r = parseWorksheetGradingResponse(
      "1: أ | 2 | صحيح\n3: ج | 2 | صحيح",
      [2, 2, 2],
    );
    expect(r.results[0].earnedPoints).toBe(2);
    expect(r.results[1].earnedPoints).toBe(0);
    expect(r.results[1].studentAnswer).toBe("غير واضح");
    expect(r.results[1].isCorrect).toBe(false);
    expect(r.results[2].earnedPoints).toBe(2);
  });

  it("يتجاهل مقدمة نصية قبل النتائج", () => {
    const r = parseWorksheetGradingResponse(
      "بالتأكيد! هذه نتائج التصحيح:\nملاحظة: الخط واضح.\n1: أ | 1 | صحيح\n2: ب | 0 | خطأ",
      [1, 1],
    );
    expect(r.results.map((x) => x.earnedPoints)).toEqual([1, 0]);
  });

  it("يدعم الأرقام العربية-الهندية في رقم السؤال والدرجة", () => {
    const r = parseWorksheetGradingResponse(
      "١: أ | ٢ | صحيح\n٢: ب | ١ | جزئي",
      [2, 2],
    );
    expect(r.results[0].earnedPoints).toBe(2);
    expect(r.results[0].isCorrect).toBe(true);
    expect(r.results[1].earnedPoints).toBe(1);
    expect(r.results[1].isCorrect).toBe(false);
  });

  it("يسقف الدرجة عند الحد الأقصى للسؤال", () => {
    const r = parseWorksheetGradingResponse("1: أ | 10 | صحيح", [3]);
    expect(r.results[0].earnedPoints).toBe(3);
  });

  it("درجة كاملة تعني صحيح حتى بدون وسم «صحيح»", () => {
    const r = parseWorksheetGradingResponse("1: أ | 2 | جزئي", [2]);
    expect(r.results[0].isCorrect).toBe(true);
  });

  it("سطر ناقص الأجزاء (بدون | كافية) يعطي صفراً", () => {
    const r = parseWorksheetGradingResponse("1: أ", [2]);
    expect(r.results[0].earnedPoints).toBe(0);
    expect(r.results[0].isCorrect).toBe(false);
    expect(r.results[0].studentAnswer).toBe("أ");
  });
});

describe("normalizeArabicName / matchStudentByName", () => {
  const roster = [
    { id: 1, name: "عبد الله محمد العتيبي", studentClass: "خامس أ" },
    { id: 2, name: "أحمد خالد", studentClass: null },
    { id: 3, name: "فاطمة الزهراء", studentClass: "رابع ب" },
    { id: 4, name: "مروة سعيد", studentClass: null },
  ];

  it("يطابق عبدالله مع عبد الله", () => {
    expect(normalizeArabicName("عبدالله")).toBe(normalizeArabicName("عبد الله"));
    expect(matchStudentByName("عبدالله محمد العتيبي", roster)?.id).toBe(1);
  });

  it("يتسامح مع الهمزات", () => {
    expect(matchStudentByName("احمد خالد", roster)?.id).toBe(2);
    expect(normalizeArabicName("إحسان")).toBe(normalizeArabicName("احسان"));
  });

  it("يتسامح مع التاء المربوطة والهاء", () => {
    expect(matchStudentByName("فاطمه الزهراء", roster)?.id).toBe(3);
  });

  it("يتجاهل التشكيل", () => {
    expect(matchStudentByName("أَحْمَد خَالِد", roster)?.id).toBe(2);
  });

  it("مطابقة احتواء لاسم جزئي طويل بما يكفي", () => {
    expect(matchStudentByName("عبد الله محمد", roster)?.id).toBe(1);
  });

  it("يرفض الأسماء القصيرة جداً", () => {
    expect(matchStudentByName("م", roster)).toBeNull();
  });

  it("يرفض الاحتواء الغامض (أكثر من مطابقة)", () => {
    const dup = [
      ...roster,
      { id: 5, name: "عبد الله محمد القحطاني", studentClass: null },
    ];
    expect(matchStudentByName("عبد الله محمد", dup)).toBeNull();
  });

  it("لا مطابقة لاسم غير موجود", () => {
    expect(matchStudentByName("يوسف إبراهيم", roster)).toBeNull();
  });
});
