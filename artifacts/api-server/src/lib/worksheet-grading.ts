/* ── منطق تحليل ردود الذكاء الاصطناعي لتصحيح أوراق العمل ──
   مستخرج من مسار submit-image ليكون قابلاً للاختبار بوحدات vitest. */

/* مطابقة أسماء عربية بتسامح: توحيد الهمزات والألف والتاء المربوطة
   وإزالة التشكيل والمسافات الزائدة، ليطابق «عبد الله» «عبدالله» مثلاً. */
export function normalizeArabicName(s: string): string {
  return (s || "")
    .replace(/[\u064B-\u065F\u0670]/g, "") // تشكيل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/عبد\s+ال/g, "عبدال")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** يبحث عن أفضل تطابق لاسم مستخرج ضمن طلاب المعلم (تطابق كامل أو احتواء). */
export function matchStudentByName<
  T extends { id: number; name: string; studentClass: string | null },
>(extracted: string, students: T[]): T | null {
  const target = normalizeArabicName(extracted);
  if (target.length < 2) return null;
  // تطابق كامل أولاً
  for (const st of students) {
    if (normalizeArabicName(st.name) === target) return st;
  }
  // ثم احتواء (اسم الورقة جزء من الاسم الكامل أو العكس) بشرط طول معقول
  const contains = students.filter((st) => {
    const n = normalizeArabicName(st.name);
    return (n.includes(target) || target.includes(n)) && Math.min(n.length, target.length) >= 5;
  });
  return contains.length === 1 ? contains[0] : null;
}

/** تحويل الأرقام العربية-الهندية إلى لاتينية. */
export function toLatinDigits(t: string): string {
  return t.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export interface ParsedWorksheetResponse {
  extractedName: string;
  extractedClass: string;
  nameConfidence: "clear" | "uncertain";
  results: Array<{
    studentAnswer: string;
    earnedPoints: number;
    isCorrect: boolean;
  }>;
}

/**
 * يحلل رد نموذج الذكاء الاصطناعي لتصحيح ورقة عمل:
 * - سطر «الاسم: ... | الصف | واضح/غير مؤكد» (اختياري)
 * - أسطر مرقمة «N: إجابة | درجة | صحيح/خطأ/جزئي» — تُربط برقم السؤال
 *   (يدعم الأرقام العربية-الهندية والنقطتين بنوعيهما) بدل الاعتماد على الترتيب.
 */
export function parseWorksheetGradingResponse(
  responseText: string,
  questionPoints: number[],
): ParsedWorksheetResponse {
  const allLines = responseText.split("\n").filter((l) => l.trim());

  let extractedName = "";
  let extractedClass = "";
  let nameConfidence: "clear" | "uncertain" = "uncertain";

  const nameLine = allLines.find((l) => /^\s*الاسم\s*[:：]/.test(l));
  if (nameLine) {
    const parts = nameLine.replace(/^\s*الاسم\s*[:：]\s*/, "").split("|").map((p) => p.trim());
    const rawName = parts[0] || "";
    if (rawName && !/غير\s*واضح/.test(rawName)) extractedName = rawName;
    const rawClass = parts[1] || "";
    if (rawClass && rawClass !== "-") extractedClass = rawClass;
    nameConfidence = /واضح/.test(parts[2] || "") && !/غير\s*مؤكد/.test(parts[2] || "") ? "clear" : "uncertain";
    if (!extractedName) nameConfidence = "uncertain";
  }

  const lineByQuestionNo = new Map<number, string>();
  for (const l of allLines) {
    const m = toLatinDigits(l).match(/^\s*(\d+)\s*[:：]/);
    if (m) lineByQuestionNo.set(parseInt(m[1], 10), toLatinDigits(l));
  }

  const results: ParsedWorksheetResponse["results"] = [];
  for (let i = 0; i < questionPoints.length; i++) {
    const qPoints = questionPoints[i] || 1;
    const line = lineByQuestionNo.get(i + 1) || "";
    const parts = line.split("|").map((p) => p.trim());

    const studentAnswer = parts[0]?.replace(/^\d+\s*[:：]\s*/, "") || "غير واضح";
    let qEarned = 0;
    let isCorrect = false;

    if (parts.length >= 3) {
      const earnedStr = parts[1]?.match(/[\d.]+/);
      qEarned = earnedStr ? Math.min(parseFloat(earnedStr[0]), qPoints) : 0;
      const status = parts[2]?.trim();
      isCorrect = status === "صحيح" || qEarned >= qPoints;
    }

    results.push({ studentAnswer, earnedPoints: qEarned, isCorrect });
  }

  return { extractedName, extractedClass, nameConfidence, results };
}
