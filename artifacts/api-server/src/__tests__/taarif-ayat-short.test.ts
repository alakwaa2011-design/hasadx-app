import { describe, expect, it } from "vitest";
import { TAARIF_AYAT_SHORT_ITEMS } from "../data/taarif-ayat-short";

describe("curated concise تعرف على الآية items", () => {
  it("contains exactly 23 single concise verses", () => {
    expect(TAARIF_AYAT_SHORT_ITEMS).toHaveLength(23);
    for (const item of TAARIF_AYAT_SHORT_ITEMS) {
      expect(item.verse.length).toBeLessThanOrEqual(130);
      expect(item.prompt).not.toMatch(/آيتان|آيتين/);
      expect(item.ayah).not.toContain("-");
      expect(item.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("has stable unique source URLs for idempotent seed matching", () => {
    expect(new Set(TAARIF_AYAT_SHORT_ITEMS.map((item) => item.sourceUrl)).size)
      .toBe(TAARIF_AYAT_SHORT_ITEMS.length);
  });
});