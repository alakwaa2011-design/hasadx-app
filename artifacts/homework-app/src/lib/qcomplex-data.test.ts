import { describe, expect, it } from "vitest";
import chapters from "@/data/quran/qcomplex/chapters.json";
import pages from "@/data/quran/qcomplex/pages.json";
import parts from "@/data/quran/qcomplex/parts.json";
import verses from "@/data/quran/qcomplex/verses.json";

describe("official Quran Complex page data", () => {
  it("contains the complete Madinah page, part, chapter, and verse indexes", () => {
    expect(chapters).toHaveLength(114);
    expect(parts).toHaveLength(30);
    expect(pages).toHaveLength(604);
    expect(verses).toHaveLength(6236);
  });

  it("assigns every verse to an existing page, part, and chapter", () => {
    const chapterIds = new Set(chapters.map((chapter) => chapter.id));
    const partIds = new Set(parts.map((part) => part.id));
    const pageIds = new Set(pages.map((page) => page.id));

    for (const verse of verses) {
      expect(chapterIds.has(verse.chapter_id)).toBe(true);
      expect(partIds.has(verse.part_id)).toBe(true);
      expect(pageIds.has(verse.page_id)).toBe(true);
      expect(verse.content.trim()).not.toBe("");
    }
  });

  it("matches each page's declared verse count", () => {
    const counts = new Map<number, number>();
    for (const verse of verses) counts.set(verse.page_id, (counts.get(verse.page_id) ?? 0) + 1);
    for (const page of pages) expect(counts.get(page.id)).toBe(page.verse_count);
  });
});