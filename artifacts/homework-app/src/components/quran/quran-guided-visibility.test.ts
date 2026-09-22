import { describe, expect, it } from "vitest";
import { getGuidedVerseScrollDelta } from "./quran-guided-visibility";

describe("getGuidedVerseScrollDelta", () => {
  const reader = { top: 100, bottom: 900, height: 800 };

  it("keeps an already visible verse in place", () => {
    expect(
      getGuidedVerseScrollDelta(
        { top: 300, bottom: 420, height: 120 },
        reader,
        700,
      ),
    ).toBeNull();
  });

  it("moves a verse above the fixed guided card", () => {
    expect(
      getGuidedVerseScrollDelta(
        { top: 650, bottom: 760, height: 110 },
        reader,
        600,
      ),
    ).toBe(176);
  });

  it("moves a verse down from under the reader toolbar", () => {
    expect(
      getGuidedVerseScrollDelta(
        { top: 80, bottom: 180, height: 100 },
        reader,
        700,
      ),
    ).toBe(-36);
  });

  it("aligns a verse to the readable top when the card leaves too little room", () => {
    expect(
      getGuidedVerseScrollDelta(
        { top: 320, bottom: 820, height: 500 },
        reader,
        350,
      ),
    ).toBe(204);
  });
});