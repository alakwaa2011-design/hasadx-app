import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  getJuzStart,
  getPageStart,
  getQuranLocation,
  groupAyahsByMushafPage,
  parseQuranXml,
} from './quran-parser';
import {
  MADANI_MUSHAF_METADATA,
  MADANI_PAGE_STARTS,
  QURAN_JUZ_STARTS,
} from '../data/quran/madani-mushaf-metadata';
import quranXml from '../data/quran/tanzil-uthmani.xml?raw';

describe('Quran XML Parser', () => {
  it('keeps the reviewed Tanzil file byte-for-byte unchanged', () => {
    expect(createHash('sha256').update(quranXml).digest('hex')).toBe(
      '8c5aeae20363a98f6963720d29fce040ca8b56a8e75f8b564c257fce7f6d0417'
    );
  });

  it('should parse 114 surahs and 6236 ayahs with correct counts', () => {
    const surahs = parseQuranXml(quranXml);

    expect(surahs.length).toBe(114);
    
    let totalAyahs = 0;
    surahs.forEach(s => totalAyahs += s.ayahs.length);
    expect(totalAyahs).toBe(6236);

    const fatiha = surahs.find(s => s.index === 1);
    expect(fatiha?.name).toBe('الفاتحة');
    expect(fatiha?.ayahs.length).toBe(7);

    const baqarah = surahs.find(s => s.index === 2);
    expect(baqarah?.name).toBe('البقرة');
    expect(baqarah?.ayahs.length).toBe(286);

    const nas = surahs.find(s => s.index === 114);
    expect(nas?.name).toBe('الناس');
    expect(nas?.ayahs.length).toBe(6);

    // check first text is not empty
    expect(fatiha?.ayahs[0].text.trim().length).toBeGreaterThan(0);
    // check last text is not empty
    expect(nas?.ayahs[5].text.trim().length).toBeGreaterThan(0);
  });
});

describe('Madani Mushaf navigation metadata', () => {
  it('has exactly 604 pages and 30 juz boundaries', () => {
    expect(MADANI_MUSHAF_METADATA.pageCount).toBe(604);
    expect(MADANI_PAGE_STARTS).toHaveLength(604);
    expect(QURAN_JUZ_STARTS).toHaveLength(30);
    expect(getPageStart(1)).toEqual({ surah: 1, ayah: 1 });
    expect(getPageStart(604)).toEqual({ surah: 112, ayah: 1 });
    expect(getJuzStart(30)).toEqual({ surah: 78, ayah: 1 });
  });

  it.each([
    [1, 1, 1, 1],
    [2, 141, 21, 1],
    [2, 142, 22, 2],
    [2, 252, 41, 2],
    [2, 253, 42, 3],
    [78, 1, 582, 30],
    [114, 6, 604, 30],
  ])('maps %i:%i to page %i and juz %i', (surah, ayah, page, juz) => {
    expect(getQuranLocation(surah, ayah)).toMatchObject({ page, juz });
  });

  it('round-trips every page and juz start boundary', () => {
    MADANI_PAGE_STARTS.forEach((start, index) => {
      expect(getQuranLocation(start.surah, start.ayah).page).toBe(index + 1);
    });
    QURAN_JUZ_STARTS.forEach((start, index) => {
      expect(getQuranLocation(start.surah, start.ayah).juz).toBe(index + 1);
    });
  });

  it('keeps every ayah of a short surah in the correct ordered page card', () => {
    const surah = parseQuranXml(quranXml).find((entry) => entry.index === 1);
    expect(surah).toBeDefined();

    const groups = groupAyahsByMushafPage(1, surah!.ayahs);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      page: 1,
      ayahs: expect.arrayContaining([
        expect.objectContaining({ index: 1 }),
        expect.objectContaining({ index: 7 }),
      ]),
    });
    expect(groups[0].ayahs[0].index).toBe(1);
    expect(groups[0].ayahs.at(-1)?.index).toBe(7);
    expect(groups.flatMap((group) => group.ayahs.map((ayah) => ayah.index))).toEqual(
      surah!.ayahs.map((ayah) => ayah.index),
    );
  });

  it('preserves every first and last ayah when a surah crosses mushaf pages', () => {
    const surah = parseQuranXml(quranXml).find((entry) => entry.index === 2);
    expect(surah).toBeDefined();

    const groups = groupAyahsByMushafPage(2, surah!.ayahs);
    const expectedBoundaries = MADANI_PAGE_STARTS
      .map((start, index) => ({ ...start, page: index + 1 }))
      .filter((start) => start.surah === 2)
      .map((start, index, starts) => ({
        page: start.page,
        first: start.ayah,
        last: starts[index + 1]?.ayah - 1 || surah!.ayahs.length,
      }));

    expect(groups.map((group) => ({
      page: group.page,
      first: group.ayahs[0].index,
      last: group.ayahs.at(-1)?.index,
    }))).toEqual(expectedBoundaries);

    const flattenedIndexes = groups.flatMap((group) => group.ayahs.map((ayah) => ayah.index));
    expect(flattenedIndexes).toEqual(surah!.ayahs.map((ayah) => ayah.index));
    expect(new Set(flattenedIndexes).size).toBe(surah!.ayahs.length);
  });

  it.each([
    [2, 5, 2],
    [2, 6, 3],
    [2, 16, 3],
    [2, 17, 4],
    [2, 141, 21],
    [2, 142, 22],
    [2, 252, 41],
    [2, 253, 42],
  ])('routes a verse target to the card containing %i:%i', (surah, ayah, page) => {
    const groups = groupAyahsByMushafPage(
      surah,
      parseQuranXml(quranXml).find((entry) => entry.index === surah)!.ayahs,
    );
    const targetGroup = groups.find((group) =>
      group.ayahs.some((candidate) => candidate.index === ayah),
    );

    expect(getQuranLocation(surah, ayah).page).toBe(page);
    expect(targetGroup?.page).toBe(page);
  });
});

import { getGlobalAyahNumber } from './quran-parser';

describe('Global Ayah Numbering', () => {
  it('computes global ayah number correctly', () => {
    const surahs = parseQuranXml(quranXml);
    expect(getGlobalAyahNumber(surahs, 1, 1)).toBe(1);
    expect(getGlobalAyahNumber(surahs, 1, 7)).toBe(7);
    expect(getGlobalAyahNumber(surahs, 2, 1)).toBe(8);
    expect(getGlobalAyahNumber(surahs, 114, 6)).toBe(6236);
  });
});

import { groupVersesByChapter } from './quran-parser';

describe('groupVersesByChapter utility', () => {
  it('groups consecutive verses of the same chapter', () => {
    const verses = [
      { id: 1, chapter_id: 1, content: 'a' },
      { id: 2, chapter_id: 1, content: 'b' },
      { id: 3, chapter_id: 2, content: 'c' },
      { id: 4, chapter_id: 2, content: 'd' },
    ];
    const grouped = groupVersesByChapter(verses);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].chapterId).toBe(1);
    expect(grouped[0].verses).toHaveLength(2);
    expect(grouped[1].chapterId).toBe(2);
    expect(grouped[1].verses).toHaveLength(2);
  });

  it('handles empty arrays', () => {
    expect(groupVersesByChapter([])).toHaveLength(0);
  });
});
