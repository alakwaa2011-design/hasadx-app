import { describe, it, expect } from 'vitest';
import { getNextAyah, getPrevAyah, clampAyah, isAyahAllowed } from './quran-audio-logic';

describe('Quran Audio Logic', () => {
  describe('clampAyah', () => {
    it('clamps ayah to allowedStart if below', () => {
      expect(clampAyah(3, 5, 10)).toBe(5);
    });
    it('returns null if ayah is above allowedEnd', () => {
      expect(clampAyah(11, 5, 10)).toBe(null);
    });
    it('returns ayah if within bounds', () => {
      expect(clampAyah(7, 5, 10)).toBe(7);
      expect(clampAyah(1, null, null)).toBe(1);
    });
  });

  describe('isAyahAllowed', () => {
    it('returns false if outside bounds', () => {
      expect(isAyahAllowed(4, 5, 10)).toBe(false);
      expect(isAyahAllowed(11, 5, 10)).toBe(false);
    });
    it('returns true if inside bounds', () => {
      expect(isAyahAllowed(5, 5, 10)).toBe(true);
      expect(isAyahAllowed(10, 5, 10)).toBe(true);
      expect(isAyahAllowed(7, null, null)).toBe(true);
    });
  });

  describe('getNextAyah', () => {
    it('repeats the current ayah if currentPlay < maxPlays', () => {
      expect(getNextAyah(5, 10, null, null, 1, 3)).toEqual({ nextAyah: 5, nextPlay: 2 });
      expect(getNextAyah(5, 10, null, null, 2, 3)).toEqual({ nextAyah: 5, nextPlay: 3 });
    });

    it('advances to next ayah if maxPlays reached', () => {
      expect(getNextAyah(5, 10, null, null, 3, 3)).toEqual({ nextAyah: 6, nextPlay: 1 });
    });

    it('stops if end of surah is reached', () => {
      expect(getNextAyah(10, 10, null, null, 1, 1)).toEqual({ nextAyah: null, nextPlay: 1 });
    });

    it('stops if allowedEnd is reached', () => {
      expect(getNextAyah(5, 10, null, 5, 1, 1)).toEqual({ nextAyah: null, nextPlay: 1 });
    });
  });

  describe('getPrevAyah', () => {
    it('goes to previous ayah if within bounds', () => {
      expect(getPrevAyah(5, null)).toBe(4);
      expect(getPrevAyah(1, null)).toBe(null);
      expect(getPrevAyah(5, 5)).toBe(null);
      expect(getPrevAyah(6, 5)).toBe(5);
    });
  });
});
