import { describe, expect, it } from "vitest";
import type { QuranSurah } from "@workspace/api-client-react";
import { quranChoiceToRanges } from "./quran-range-selection";

const ayahCounts: Record<number, number> = {
  1: 7,
  2: 286,
  3: 200,
  77: 50,
  78: 40,
  114: 6,
};

const surahs: QuranSurah[] = Array.from({ length: 114 }, (_, index) => ({
  number: index + 1,
  arabicName: `سورة ${index + 1}`,
  englishName: `Surah ${index + 1}`,
  ayahCount: ayahCounts[index + 1] ?? 10,
}));

describe("Quran assignment range selection", () => {
  it("expands a surah interval into complete surahs", () => {
    const ranges = quranChoiceToRanges(
      { id: "s", kind: "surahs", fromSurah: 1, toSurah: 3 },
      surahs,
    );
    expect(ranges).toMatchObject([
      { surahNumber: 1, startAyah: 1, endAyah: 7 },
      { surahNumber: 2, startAyah: 1, endAyah: 286 },
      { surahNumber: 3, startAyah: 1, endAyah: 200 },
    ]);
  });

  it("uses the canonical start and end of a single juz", () => {
    expect(quranChoiceToRanges(
      { id: "j", kind: "juz", fromJuz: 2, toJuz: 2 },
      surahs,
    )).toMatchObject([
      { surahNumber: 2, startAyah: 142, endAyah: 252 },
    ]);
  });

  it("normalizes reversed ayah bounds within one surah", () => {
    expect(quranChoiceToRanges(
      { id: "a", kind: "ayahs", fromSurah: 2, fromAyah: 20, toSurah: 2, toAyah: 10 },
      surahs,
    )).toMatchObject([
      { surahNumber: 2, startAyah: 10, endAyah: 20 },
    ]);
  });

  it("expands the final juz through the final surah", () => {
    const ranges = quranChoiceToRanges(
      { id: "last", kind: "juz", fromJuz: 30, toJuz: 30 },
      surahs,
    );
    expect(ranges[0]).toMatchObject({ surahNumber: 78, startAyah: 1 });
    expect(ranges.at(-1)).toMatchObject({ surahNumber: 114, endAyah: 6 });
  });
});