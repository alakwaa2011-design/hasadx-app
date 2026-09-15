import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  getJuzStart,
  getPageStart,
  getQuranLocation,
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
