import {
  MADANI_PAGE_STARTS,
  QURAN_JUZ_STARTS,
  type QuranPosition,
} from '@/data/quran/madani-mushaf-metadata';

export interface QuranAyah {
  index: number;
  text: string;
  bismillah?: string;
}

export interface QuranSurahParsed {
  index: number;
  name: string;
  ayahs: QuranAyah[];
}

export interface QuranLocation extends QuranPosition {
  page: number;
  juz: number;
}

export interface QuranPageGroup<T> {
  page: number;
  ayahs: T[];
}

function parseAttributes(tagStr: string) {
  const attrRegex = /([a-zA-Z0-9_]+)="([^"]*)"/g;
  const attrs: Record<string, string> = {};
  let match;
  while ((match = attrRegex.exec(tagStr)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function parseQuranXml(xml: string): QuranSurahParsed[] {
  const surahs: QuranSurahParsed[] = [];
  const suraRegex = /<sura\s+([^>]+)>([\s\S]*?)<\/sura>/g;
  const ayaRegex = /<aya\s+([^>]+)\/?>/g;

  let suraMatch;
  while ((suraMatch = suraRegex.exec(xml)) !== null) {
    const suraAttrs = parseAttributes(suraMatch[1]);
    const ayahsStr = suraMatch[2];

    const ayahs: QuranAyah[] = [];
    let ayaMatch;
    while ((ayaMatch = ayaRegex.exec(ayahsStr)) !== null) {
      const ayaAttrs = parseAttributes(ayaMatch[1]);
      ayahs.push({
        index: parseInt(ayaAttrs.index, 10),
        text: ayaAttrs.text,
        bismillah: ayaAttrs.bismillah
      });
    }

    surahs.push({
      index: parseInt(suraAttrs.index, 10),
      name: suraAttrs.name,
      ayahs
    });
  }
  return surahs;
}

function boundaryNumber(position: QuranPosition, starts: readonly QuranPosition[]) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (comparePositions(starts[middle], position) <= 0) low = middle + 1;
    else high = middle - 1;
  }
  return Math.max(1, high + 1);
}

export function getPageStart(page: number): QuranPosition {
  return MADANI_PAGE_STARTS[Math.min(Math.max(page, 1), MADANI_PAGE_STARTS.length) - 1];
}

function comparePositions(a: QuranPosition, b: QuranPosition) {
  return a.surah - b.surah || a.ayah - b.ayah;
}

export function getJuzStart(juz: number): QuranPosition {
  return QURAN_JUZ_STARTS[Math.min(Math.max(juz, 1), QURAN_JUZ_STARTS.length) - 1];
}

export function getQuranLocation(surah: number, ayah: number): QuranLocation {
  const position = { surah, ayah };
  return {
    ...position,
    page: boundaryNumber(position, MADANI_PAGE_STARTS),
    juz: boundaryNumber(position, QURAN_JUZ_STARTS),
  };
}

/**
 * Groups a surah's verses by their Madani mushaf page.
 *
 * The source XML is already ordered by ayah. Keeping that order while
 * creating groups means the boundary between cards cannot silently duplicate
 * or omit a verse.
 */
export function groupAyahsByMushafPage<T extends { index: number }>(
  surah: number,
  ayahs: readonly T[],
): QuranPageGroup<T>[] {
  const groups: QuranPageGroup<T>[] = [];

  for (const ayah of ayahs) {
    const page = getQuranLocation(surah, ayah.index).page;
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.page !== page) {
      groups.push({ page, ayahs: [ayah] });
    } else {
      currentGroup.ayahs.push(ayah);
    }
  }

  return groups;
}

export function getGlobalAyahNumber(surahs: QuranSurahParsed[], surahNumber: number, ayahNumber: number): number {
  let global = 0;
  for (let i = 0; i < surahNumber - 1; i++) {
    global += surahs[i].ayahs.length;
  }
  return global + ayahNumber;
}

export interface MinimalVerse {
  chapter_id: number;
}

/**
 * Groups an array of verses by their chapter_id.
 * Preserves the order of verses.
 */
export function groupVersesByChapter<T extends MinimalVerse>(verses: T[]): { chapterId: number; verses: T[] }[] {
  const grouped: { chapterId: number; verses: T[] }[] = [];
  let currentGroup: { chapterId: number; verses: T[] } | null = null;

  for (const v of verses) {
    if (!currentGroup || currentGroup.chapterId !== v.chapter_id) {
      currentGroup = { chapterId: v.chapter_id, verses: [] };
      grouped.push(currentGroup);
    }
    currentGroup.verses.push(v);
  }
  return grouped;
}
