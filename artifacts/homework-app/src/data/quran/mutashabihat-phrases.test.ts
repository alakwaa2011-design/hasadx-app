import { describe, expect, it } from "vitest";
import verses from "./qcomplex/verses.json";
import { buildQuranPhraseIndex, findRepeatedPhrases, getSharedPhrase } from "./mutashabihat-phrases";

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
});