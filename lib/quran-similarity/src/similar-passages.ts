import { findRepeatedPhrases, type QuranPhraseIndex } from "./phrases";
import { getQuranMutashabihat, type QuranMutashabihatCategory } from "./relations";

export type QuranSimilarPassageCategory = QuranMutashabihatCategory | "repeated_verse" | "repeated_phrase";

export type QuranSimilarPassage = {
  otherVerseKey: string;
  category: QuranSimilarPassageCategory;
  exactVerse: boolean;
};

/**
 * Combines the reviewed references with exact-text matches computed from the
 * supplied local Quran corpus. Repeated text takes precedence, while curated
 * categories are retained when a reviewed pair also shares an exact phrase.
 */
export function getQuranSimilarPassages(index: QuranPhraseIndex, verseKey: string): QuranSimilarPassage[] {
  const curated = getQuranMutashabihat(verseKey);
  const curatedByVerse = new Map(curated.map((relation) => [relation.otherVerseKey, relation.category]));
  const repeated = findRepeatedPhrases(index, verseKey);
  const repeatedKeys = new Set(repeated.map((relation) => relation.otherVerseKey));

  return [
    ...repeated.map((relation) => ({
      otherVerseKey: relation.otherVerseKey,
      category: relation.exactVerse
        ? "repeated_verse" as const
        : curatedByVerse.get(relation.otherVerseKey) ?? "repeated_phrase" as const,
      exactVerse: relation.exactVerse,
    })),
    ...curated.filter((relation) => !repeatedKeys.has(relation.otherVerseKey))
      .map((relation) => ({ ...relation, exactVerse: false })),
  ];
}