import { describe, expect, it } from "vitest";
import verses from "@/data/quran/qcomplex/verses.json";
import {
  getQuranMutashabihat,
  hasQuranMutashabihat,
  type QuranMutashabihatCategory,
} from "./mutashabihat-relations";

const categories = new Set<QuranMutashabihatCategory>([
  "lafzi",
  "word_swap",
  "addition_omission",
  "ending_variation",
  "order_change",
  "pronoun_shift",
  "structural",
]);

const verseKeys = new Set(verses.map((verse) => `${verse.chapter_id}:${verse.number}`));
const versePositions = new Map<string, number>(
  verses.map((verse) => [`${verse.chapter_id}:${verse.number}`, verse.id] as const),
);

describe("curated Quran mutashabihat relations", () => {
  it("contains all 283 curated pairs with canonical, valid Quran verse references", () => {
    const pairs = new Set<string>();

    for (const verseKey of verseKeys) {
      for (const relation of getQuranMutashabihat(verseKey)) {
        expect(verseKey).toMatch(/^[1-9]\d{0,2}:[1-9]\d{0,2}$/);
        expect(relation.otherVerseKey).toMatch(/^[1-9]\d{0,2}:[1-9]\d{0,2}$/);
        expect(verseKeys.has(verseKey)).toBe(true);
        expect(verseKeys.has(relation.otherVerseKey)).toBe(true);
        expect(categories.has(relation.category)).toBe(true);
        expect(relation.otherVerseKey).not.toBe(verseKey);

        const relationKeys = getQuranMutashabihat(verseKey).map(
          (item) => item.otherVerseKey,
        );
        expect(new Set(relationKeys).size).toBe(relationKeys.length);

        const versePosition = versePositions.get(verseKey)!;
        const otherPosition = versePositions.get(relation.otherVerseKey)!;
        if (versePosition < otherPosition) {
          pairs.add(`${verseKey}|${relation.otherVerseKey}|${relation.category}`);
        } else {
          expect(otherPosition).toBeLessThan(versePosition);
        }
      }
    }

    expect(pairs.size).toBe(283);
  });

  it("returns every curated relation from both sides with the same category", () => {
    for (const verseKey of verseKeys) {
      const relations = getQuranMutashabihat(verseKey);
      expect(hasQuranMutashabihat(verseKey)).toBe(relations.length > 0);

      for (const relation of relations) {
        const reverseMatches = getQuranMutashabihat(relation.otherVerseKey).filter(
          (candidate) => candidate.otherVerseKey === verseKey,
        );
        expect(reverseMatches).toEqual([{ otherVerseKey: verseKey, category: relation.category }]);
      }
    }
  });

  it("returns an empty list and false for a verse without curated matches", () => {
    expect(getQuranMutashabihat("1:1")).toEqual([]);
    expect(hasQuranMutashabihat("1:1")).toBe(false);
  });
});