import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { parseQuranXml } from './quran-parser';
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
