import { describe, expect, it } from "vitest";
import {
  alignQuranRecitationChunk,
  confirmQuranMismatch,
  downsamplePcm,
  isStudentQuranReaderPath,
  normalizeQuranWord,
} from "./quran-live-recitation";

describe("Quran live recitation helpers", () => {
  it("normalizes Uthmani marks and common Arabic letter variants", () => {
    expect(normalizeQuranWord("ٱلرَّحْمَٰنِ")).toBe("الرحمن");
    expect(normalizeQuranWord("إِيَّاكَ")).toBe("اياك");
  });

  it.each([
    "/student/quran-wards/41",
    "/student/quran-practice/2",
    "/student/quran-recitation/1",
  ])("identifies student Quran entry point %s", (pathname) => {
    expect(isStudentQuranReaderPath(pathname)).toBe(true);
  });

  it("does not classify the teacher Quran reader as a student entry point", () => {
    expect(isStudentQuranReaderPath("/teacher/quran-reader/2")).toBe(false);
  });

  it("advances only through the exact next confident words", () => {
    const expected = ["بسم", "الله", "الرحمن", "الرحيم"];
    const result = alignQuranRecitationChunk(expected, 1, [
      { word: "بسم", confidence: 0.99 },
      { word: "الله", confidence: 0.98 },
      { word: "الرحمن", confidence: 0.97 },
    ]);

    expect(result).toEqual({
      nextExpectedIndex: 3,
      madeProgress: true,
      mismatchKey: null,
    });
  });

  it("does not advance past a substituted expected word", () => {
    const expected = ["بسم", "الله", "الرحمن", "الرحيم"];
    const result = alignQuranRecitationChunk(expected, 1, [
      { word: "الناس", confidence: 0.96 },
      { word: "الرحمن", confidence: 0.98 },
    ]);

    expect(result.nextExpectedIndex).toBe(1);
    expect(result.madeProgress).toBe(false);
    expect(result.mismatchKey).toBe("1:الناس");
  });

  it("does not treat low-confidence recognition as progress or a confirmed mismatch", () => {
    const result = alignQuranRecitationChunk(["الحمد"], 0, [
      { word: "الحمد", confidence: 0.4 },
      { word: "الناس", confidence: 0.3 },
    ]);

    expect(result).toEqual({
      nextExpectedIndex: 0,
      madeProgress: false,
      mismatchKey: null,
    });
  });

  it("alerts only after the same mismatch is confirmed twice", () => {
    const first = confirmQuranMismatch(null, 0, "1:الناس");
    expect(first).toEqual({ mismatchKey: "1:الناس", count: 1, shouldAlert: false });

    const changed = confirmQuranMismatch(first.mismatchKey, first.count, "1:الفلق");
    expect(changed).toEqual({ mismatchKey: "1:الفلق", count: 1, shouldAlert: false });

    const confirmed = confirmQuranMismatch(changed.mismatchKey, changed.count, "1:الفلق");
    expect(confirmed).toEqual({ mismatchKey: "1:الفلق", count: 0, shouldAlert: true });
  });

  it("clears a pending mismatch for silence, noise, or low-confidence input", () => {
    expect(confirmQuranMismatch("1:الناس", 1, null)).toEqual({
      mismatchKey: null,
      count: 0,
      shouldAlert: false,
    });
  });

  it("downsamples PCM while preserving its approximate duration", () => {
    const source = new Float32Array(48_000);
    const result = downsamplePcm(source, 48_000, 16_000);
    expect(result).toHaveLength(16_000);
  });
});