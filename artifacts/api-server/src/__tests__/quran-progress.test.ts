import { describe, expect, it } from "vitest";
import {
  applyCompletedWardProgress,
  nextPositionForCompletedWard,
  shouldApplyRecitationProgress,
} from "../lib/quran-progress";

const counts = [7, 286, 3];

describe("Quran progress", () => {
  it("moves to the next surah at a completed boundary", () => {
    expect(nextPositionForCompletedWard(1, 7, counts)).toEqual({ surahNumber: 2, ayah: 1 });
    expect(nextPositionForCompletedWard(3, 3, counts)).toEqual({ surahNumber: 3, ayah: 3 });
  });

  it("does not regress position or mastery count for older wards", () => {
    const current = {
      currentSurahNumber: 2,
      currentAyah: 10,
      progressPercent: 99,
      masteredAyahCount: 293,
    };
    expect(applyCompletedWardProgress(current, { surahNumber: 1, endAyah: 7, ayahCounts: counts })).toEqual(current);
  });

  it("only applies mastery on the first completed save", () => {
    expect(shouldApplyRecitationProgress("needs_review", false)).toBe(false);
    expect(shouldApplyRecitationProgress("completed", false)).toBe(true);
    expect(shouldApplyRecitationProgress("completed", true)).toBe(false);
  });
});