export type AiContentLanguage = "ar" | "en";

type ResolveAiContentLanguageOptions = {
  preferredLanguage?: unknown;
  primaryText?: unknown;
  detailTexts?: unknown[];
};

const ARABIC_RE = /[\u0600-\u06FF]/g;
const LATIN_RE = /[A-Za-z]/g;

/**
 * Determines the language of generated content, not the language of the UI.
 *
 * A teacher can explicitly ask for a language in their notes. Otherwise, a
 * clearly English topic/details should work from an Arabic UI too. The UI
 * preference remains the fallback, so English UI sessions stay English when
 * the tool has no meaningful text to infer from.
 */
export function resolveAiContentLanguage({
  preferredLanguage,
  primaryText,
  detailTexts = [],
}: ResolveAiContentLanguageOptions): AiContentLanguage {
  const texts = [primaryText, ...detailTexts]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  const combined = texts.join("\n");
  const explicit = findExplicitAiContentLanguage(combined);
  if (explicit) return explicit;

  if (texts.some(isClearlyEnglish)) return "en";
  return preferredLanguage === "en" ? "en" : "ar";
}

function isClearlyEnglish(value: string): boolean {
  const arabicCount = (value.match(ARABIC_RE) ?? []).length;
  const latinCount = (value.match(LATIN_RE) ?? []).length;
  return latinCount >= 4 && arabicCount === 0;
}

export function findExplicitAiContentLanguage(value: unknown): AiContentLanguage | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  const asksForEnglish =
    /\b(?:in|write|answer|respond|output|generate)\s+(?:only\s+)?english\b/.test(normalized) ||
    /\benglish\s+only\b/.test(normalized) ||
    /بال(?:ل)?إنجليزية|بالانجليزية|باللغة\s+الإنجليزية/.test(value);
  if (asksForEnglish) return "en";

  const asksForArabic =
    /\b(?:in|write|answer|respond|output|generate)\s+(?:only\s+)?arabic\b/.test(normalized) ||
    /\barabic\s+only\b/.test(normalized) ||
    /بال(?:ل)?عربية|باللغة\s+العربية/.test(value);
  if (asksForArabic) return "ar";

  return null;
}