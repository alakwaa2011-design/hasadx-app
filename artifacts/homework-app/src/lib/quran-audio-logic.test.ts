import { describe, it, expect } from 'vitest';
import { getNextAyahMemo, clampAyah, getActiveWordPosition } from './quran-audio-logic';

describe('quran-audio-logic', () => {
  it('clamps ayah correctly', () => {
    expect(clampAyah(5, 2, 10)).toBe(5);
    expect(clampAyah(1, 2, 10)).toBe(2);
    expect(clampAyah(11, 2, 10)).toBe(null);
  });

  describe('getActiveWordPosition', () => {
    it('returns correct word based on strict boundary logic', () => {
      const segments = [
        { wordPosition: 1, startMs: 0, endMs: 500 },
        { wordPosition: 2, startMs: 600, endMs: 1000 },
      ];
      
      expect(getActiveWordPosition(900, 1000, segments)).toBe(null); // before first (-100ms)
      expect(getActiveWordPosition(1000, 1000, segments)).toBe(1); // exactly at startMs (0ms)
      expect(getActiveWordPosition(1400, 1000, segments)).toBe(1); // inside first (400ms)
      expect(getActiveWordPosition(1500, 1000, segments)).toBe(null); // exact endMs of first (500ms) -> gap
      expect(getActiveWordPosition(1550, 1000, segments)).toBe(null); // inside gap (550ms)
      expect(getActiveWordPosition(1600, 1000, segments)).toBe(2); // exactly at startMs of second (600ms)
      expect(getActiveWordPosition(1999, 1000, segments)).toBe(2); // inside second (999ms)
      expect(getActiveWordPosition(2000, 1000, segments)).toBe(null); // exact endMs of second (1000ms)
      expect(getActiveWordPosition(2500, 1000, segments)).toBe(null); // after last (1500ms)
    });
  });

  describe('getNextAyahMemo - ayah scope', () => {
    it('repeats current ayah until maxPlays', () => {
      const res = getNextAyahMemo(1, 10, 1, 5, 'ayah', 3, 1, 1);
      expect(res).toEqual({ nextAyah: 1, nextAyahPlayCount: 2, nextRangePlayCount: 1 });
    });

    it('moves to next ayah after maxPlays', () => {
      const res = getNextAyahMemo(1, 10, 1, 5, 'ayah', 3, 3, 1);
      expect(res).toEqual({ nextAyah: 2, nextAyahPlayCount: 1, nextRangePlayCount: 1 });
    });

    it('stops at end of range', () => {
      const res = getNextAyahMemo(5, 10, 1, 5, 'ayah', 3, 3, 1);
      expect(res).toEqual({ nextAyah: null, nextAyahPlayCount: 1, nextRangePlayCount: 1 });
    });

    it('loops to start if continuous', () => {
      const res = getNextAyahMemo(5, 10, 1, 5, 'ayah', 'continuous', 3, 1);
      expect(res).toEqual({ nextAyah: 5, nextAyahPlayCount: 4, nextRangePlayCount: 1 });
    });
  });

  describe('getNextAyahMemo - range scope', () => {
    it('moves to next ayah within range', () => {
      const res = getNextAyahMemo(1, 10, 1, 5, 'range', 3, 1, 1);
      expect(res).toEqual({ nextAyah: 2, nextAyahPlayCount: 1, nextRangePlayCount: 1 });
    });

    it('loops back to start at end of range until maxPlays', () => {
      const res = getNextAyahMemo(5, 10, 1, 5, 'range', 3, 1, 1);
      expect(res).toEqual({ nextAyah: 1, nextAyahPlayCount: 1, nextRangePlayCount: 2 });
    });

    it('stops after maxPlays range repeats', () => {
      const res = getNextAyahMemo(5, 10, 1, 5, 'range', 3, 1, 3);
      expect(res).toEqual({ nextAyah: null, nextAyahPlayCount: 1, nextRangePlayCount: 1 });
    });

    it('loops infinitely if continuous', () => {
      const res = getNextAyahMemo(5, 10, 1, 5, 'range', 'continuous', 1, 3);
      expect(res).toEqual({ nextAyah: 1, nextAyahPlayCount: 1, nextRangePlayCount: 4 });
    });
  });
});
