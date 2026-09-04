import { describe, expect, it } from "vitest";
import { ISTIHDAR_AYAT_COUNT, ISTIHDAR_AYAT_ITEMS } from "../data/istihdar-ayat";
import { formatIstihdarAyatAnswer } from "../seedIstihdarAyat";

describe("curated استحضار الآيات items", () => {
  it("contains the verified 15/10/5 batch with unique source URLs", () => {
    expect(ISTIHDAR_AYAT_COUNT).toBe(30);
    expect(ISTIHDAR_AYAT_ITEMS.filter((item) => item.kind === "single_recall")).toHaveLength(15);
    expect(ISTIHDAR_AYAT_ITEMS.filter((item) => item.kind === "multi_point")).toHaveLength(10);
    expect(ISTIHDAR_AYAT_ITEMS.filter((item) => item.kind === "numeric")).toHaveLength(5);
    expect(new Set(ISTIHDAR_AYAT_ITEMS.map((item) => item.sourceUrl)).size).toBe(30);
  });

  it("keeps every item source-backed and every multi-point answer independently scoreable", () => {
    for (const item of ISTIHDAR_AYAT_ITEMS) {
      expect(item.prompt.length).toBeGreaterThan(8);
      expect(item.answer.length).toBeGreaterThan(2);
      expect(item.reference).toMatch(/.+:\s*\d/);
      expect(item.sourceUrl).toMatch(/^https:\/\/quranpedia\.net\/quran-qa\/chapters\/istihdar\/\d+$/);
      if (item.kind === "multi_point") {
        expect(item.points).toBeDefined();
        expect(item.points!.length).toBeGreaterThan(1);
        expect(item.points!.length).toBeLessThanOrEqual(5);
        const encoded = JSON.parse(formatIstihdarAyatAnswer(item));
        expect(encoded).toEqual({ answer: item.answer, points: item.points });
        for (const point of item.points!) expect(point.reference).toMatch(/.+:\s*\d/);
      } else {
        expect("points" in item).toBe(false);
      }
    }
  });
});