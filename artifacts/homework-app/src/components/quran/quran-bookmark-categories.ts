export type QuranBookmarkCategory =
  | "stopped_here"
  | "review"
  | "similar"
  | "repeated_mistake"
  | "ask_teacher";

export const QURAN_BOOKMARK_CATEGORIES: QuranBookmarkCategory[] = [
  "stopped_here",
  "review",
  "similar",
  "repeated_mistake",
  "ask_teacher",
];

export function normalizeQuranBookmarkCategory(value: unknown): QuranBookmarkCategory {
  return QURAN_BOOKMARK_CATEGORIES.includes(value as QuranBookmarkCategory)
    ? value as QuranBookmarkCategory
    : "stopped_here";
}

export function quranBookmarkCategoryLabel(category: QuranBookmarkCategory, lang: string) {
  const labels: Record<QuranBookmarkCategory, { ar: string; en: string }> = {
    stopped_here: { ar: "توقفت هنا", en: "Stopped here" },
    review: { ar: "تحتاج مراجعة", en: "Needs review" },
    similar: { ar: "متشابهة", en: "Similar ayah" },
    repeated_mistake: { ar: "خطأ متكرر", en: "Repeated mistake" },
    ask_teacher: { ar: "سؤال للمعلم", en: "Ask teacher" },
  };
  return lang === "ar" ? labels[category].ar : labels[category].en;
}