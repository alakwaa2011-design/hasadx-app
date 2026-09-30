export type SimilarityVerse = {
    chapter_id: number;
    number: number;
    content: string;
};
type Word = {
    value: string;
    originalIndex: number;
};
type IndexedVerse = {
    words: Word[];
    normalizedText: string;
};
export type PhraseMatch = {
    otherVerseKey: string;
    wordCount: number;
    exactVerse: boolean;
};
export type SharedPhrase = {
    first: Set<number>;
    second: Set<number>;
    wordCount: number;
    exactVerse: boolean;
};
export type WordDifferences = {
    first: Set<number>;
    second: Set<number>;
};
export type QuranPhraseIndex = {
    byVerse: Map<string, IndexedVerse>;
    byThreeWords: Map<string, string[]>;
    byFullVerse: Map<string, string[]>;
};
export declare function buildQuranPhraseIndex(verses: readonly SimilarityVerse[]): QuranPhraseIndex;
export declare function getQuranPhraseIndex(verses: readonly SimilarityVerse[]): QuranPhraseIndex;
export declare function getSharedPhrase(index: QuranPhraseIndex, firstKey: string, secondKey: string): SharedPhrase;
export declare function getWordDifferences(index: QuranPhraseIndex, firstKey: string, secondKey: string): WordDifferences;
export declare function findRepeatedPhrases(index: QuranPhraseIndex, verseKey: string): PhraseMatch[];
export {};
//# sourceMappingURL=phrases.d.ts.map