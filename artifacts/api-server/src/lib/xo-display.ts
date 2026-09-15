const LEGACY_XO_TITLES = new Set([
  "إكس أو",
  "إكس أو الصف",
  "إعداد إكس أو",
  "إنشاء لعبة إكس أو",
  "XO",
  "XO Class",
  "XO setup",
  "Create XO game",
]);

/** Normalize only known built-in XO titles; teacher-authored titles stay intact. */
export function normalizeXoTitle(title: string | null | undefined): string {
  const value = typeof title === "string" ? title.trim() : "";
  if (!LEGACY_XO_TITLES.has(value)) return title ?? "";
  return "X O";
}