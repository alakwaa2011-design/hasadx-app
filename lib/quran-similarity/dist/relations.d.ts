export type QuranMutashabihatCategory = "lafzi" | "word_swap" | "addition_omission" | "ending_variation" | "order_change" | "pronoun_shift" | "structural";
export interface QuranMutashabihatRelation {
    otherVerseKey: string;
    category: QuranMutashabihatCategory;
}
export declare function getQuranMutashabihat(verseKey: string): QuranMutashabihatRelation[];
export declare function hasQuranMutashabihat(verseKey: string): boolean;
//# sourceMappingURL=relations.d.ts.map