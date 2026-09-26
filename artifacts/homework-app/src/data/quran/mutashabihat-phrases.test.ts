import { describe, expect, it } from "vitest";
import verses from "./qcomplex/verses.json";
import { buildQuranPhraseIndex, findRepeatedPhrases, getSharedPhrase, getWordDifferences } from "./mutashabihat-phrases";

const index = buildQuranPhraseIndex(verses);

describe("Quran textual repetition from the canonical verses", () => {
  it("finds every repetition of the complete promise question", () => {
    const exact = findRepeatedPhrases(index, "10:48")
      .filter((match) => match.exactVerse)
      .map((match) => match.otherVerseKey);
    expect(exact).toEqual(["21:38", "27:71", "34:29", "36:48", "67:25"]);
    expect(getSharedPhrase(index, "10:48", "67:25").wordCount).toBe(7);
  });

  it("finds alif-lam-mim despite the opening basmala without matching other initials", () => {
    const matches = findRepeatedPhrases(index, "2:1");
    expect(matches.map((match) => match.otherVerseKey)).toEqual(["3:1", "29:1", "30:1", "31:1", "32:1"]);
    const shared = getSharedPhrase(index, "2:1", "3:1");
    expect(shared.first).toEqual(new Set([4]));
    expect(shared.second).toEqual(new Set([4]));
    expect(matches.some((match) => match.otherVerseKey === "7:1")).toBe(false);
  });

  it("does not treat a shared opening basmala as a match between distinct ayahs", () => {
    expect(findRepeatedPhrases(index, "2:1").every((match) => match.exactVerse)).toBe(true);
    expect(findRepeatedPhrases(index, "111:1")).toEqual([]);
  });

  it("does not mark exact repeated verses or a long unrelated continuation as a local difference", () => {
    expect(getWordDifferences(index, "10:48", "21:38")).toEqual({ first: new Set(), second: new Set() });
    expect(getWordDifferences(index, "2:255", "3:2")).toEqual({ first: new Set(), second: new Set() });
  });

  it("marks an insertion and changed wording without changing shared-word detection", () => {
    const sample = buildQuranPhraseIndex([
      { chapter_id: 1, number: 2, content: "قال الرجل هذا اليوم" },
      { chapter_id: 2, number: 2, content: "قال الرجل في هذا اليوم" },
      { chapter_id: 3, number: 2, content: "قال الرجل ذاك اليوم" },
    ]);
    expect(getWordDifferences(sample, "1:2", "2:2")).toEqual({ first: new Set(), second: new Set([2]) });
    expect(getWordDifferences(sample, "1:2", "3:2")).toEqual({ first: new Set([2]), second: new Set([2]) });
    expect(getSharedPhrase(sample, "1:2", "3:2").first).toEqual(new Set([0, 1]));
  });
});