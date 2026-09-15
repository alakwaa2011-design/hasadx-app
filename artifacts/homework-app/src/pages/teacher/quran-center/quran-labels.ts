export function quranModeLabel(mode: string, isArabic: boolean): string {
  const labels: Record<string, [string, string]> = {
    memorization: ["حفظ", "Memorization"],
    review: ["مراجعة", "Review"],
    recitation: ["تلاوة", "Recitation"],
    assessment: ["تقييم", "Assessment"],
  };
  const label = labels[mode];
  return label ? label[isArabic ? 0 : 1] : (isArabic ? "مهمة قرآنية" : "Quran task");
}

export function quranStatusLabel(status: string, isArabic: boolean): string {
  const labels: Record<string, [string, string]> = {
    assigned: ["جديدة", "Assigned"],
    in_progress: ["قيد الإنجاز", "In progress"],
    completed: ["مكتملة", "Completed"],
    needs_review: ["تحتاج مراجعة", "Needs review"],
    absent: ["غائب", "Absent"],
    not_recited: ["لم يسمّع", "Not recited"],
  };
  const label = labels[status];
  return label ? label[isArabic ? 0 : 1] : (isArabic ? "غير محددة" : "Unknown");
}

export function quranDateLabel(value: string | null | undefined, isArabic: boolean): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(isArabic ? "ar-KW" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}