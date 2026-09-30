import { type QuranPhraseIndex } from "./phrases";
import { type QuranMutashabihatCategory } from "./relations";
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
export declare function getQuranSimilarPassages(index: QuranPhraseIndex, verseKey: string): QuranSimilarPassage[];
//# sourceMappingURL=similar-passages.d.ts.map