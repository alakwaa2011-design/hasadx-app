import type { QuranSurah, QuranWardRangeInput } from "@workspace/api-client-react";

export type QuranRangeChoice =
  | { id: string; kind: "surahs"; fromSurah: number; toSurah: number }
  | { id: string; kind: "juz"; fromJuz: number; toJuz: number }
  | {
      id: string;
      kind: "ayahs";
      fromSurah: number;
      fromAyah: number;
      toSurah: number;
      toAyah: number;
    };

const JUZ_STARTS = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148],
  [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6],
  [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1],
  [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
] as const;

function wholeSurah(surah: QuranSurah): QuranWardRangeInput {
  return {
    surahNumber: surah.number,
    surahName: surah.arabicName,
    startAyah: 1,
    endAyah: surah.ayahCount,
  };
}

function betweenAyahs(
  surahs: QuranSurah[],
  fromSurah: number,
  fromAyah: number,
  toSurah: number,
  toAyah: number,
): QuranWardRangeInput[] {
  const startSurah = Math.min(fromSurah, toSurah);
  const endSurah = Math.max(fromSurah, toSurah);
  const sameSurahStart = Math.min(fromAyah, toAyah);
  const sameSurahEnd = Math.max(fromAyah, toAyah);
  return surahs
    .filter((surah) => surah.number >= startSurah && surah.number <= endSurah)
    .map((surah) => {
      const startAyah = surah.number === startSurah
        ? Math.max(1, Math.min(startSurah === endSurah ? sameSurahStart : (fromSurah <= toSurah ? fromAyah : toAyah), surah.ayahCount))
        : 1;
      const endAyah = surah.number === endSurah
        ? Math.max(1, Math.min(startSurah === endSurah ? sameSurahEnd : (fromSurah <= toSurah ? toAyah : fromAyah), surah.ayahCount))
        : surah.ayahCount;
      return { ...wholeSurah(surah), startAyah, endAyah: Math.max(startAyah, endAyah) };
    });
}

export function quranChoiceToRanges(
  choice: QuranRangeChoice,
  surahs: QuranSurah[],
): QuranWardRangeInput[] {
  if (choice.kind === "surahs") {
    const start = Math.min(choice.fromSurah, choice.toSurah);
    const end = Math.max(choice.fromSurah, choice.toSurah);
    return surahs.filter((surah) => surah.number >= start && surah.number <= end).map(wholeSurah);
  }
  if (choice.kind === "ayahs") {
    return betweenAyahs(
      surahs,
      choice.fromSurah,
      choice.fromAyah,
      choice.toSurah,
      choice.toAyah,
    );
  }
  const fromJuz = Math.min(choice.fromJuz, choice.toJuz);
  const toJuz = Math.max(choice.fromJuz, choice.toJuz);
  const [startSurah, startAyah] = JUZ_STARTS[fromJuz - 1];
  const nextStart = JUZ_STARTS[toJuz];
  if (!nextStart) {
    const lastSurah = surahs[surahs.length - 1];
    return betweenAyahs(surahs, startSurah, startAyah, lastSurah.number, lastSurah.ayahCount);
  }
  const [nextSurah, nextAyah] = nextStart;
  const endSurah = nextAyah === 1 ? nextSurah - 1 : nextSurah;
  const endAyah = nextAyah === 1
    ? (surahs.find((surah) => surah.number === endSurah)?.ayahCount ?? 1)
    : nextAyah - 1;
  return betweenAyahs(surahs, startSurah, startAyah, endSurah, endAyah);
}

export function quranChoicesToRanges(
  choices: QuranRangeChoice[],
  surahs: QuranSurah[],
): QuranWardRangeInput[] {
  const seen = new Set<string>();
  return choices.flatMap((choice) => quranChoiceToRanges(choice, surahs)).filter((range) => {
    const key = `${range.surahNumber}:${range.startAyah}:${range.endAyah}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}