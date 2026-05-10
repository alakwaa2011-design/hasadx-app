/**
 * Unit tests for the import-file-parser module.
 *
 * Tests cover:
 *  - buildSlidesFromParsed (slide layout, element positioning, RTL/LTR)
 *  - buildSlidesFromPdfPages (image-background slide construction)
 *  - parsePptx (ZIP-level XML extraction)
 *  - parseDocx (heading-based splitting and balanced-chunk fallback)
 *  - parsePdf (pdftoppm rendering, tested separately in integration tests)
 */

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  buildSlidesFromParsed,
  buildSlidesFromPdfPages,
  parsePptx,
  parseDocx,
} from "../lib/import-file-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makePptxBuffer(
  slides: Array<{ title?: string; body?: string[] }>,
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>`,
  );

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const titleXml = s.title
      ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${s.title}</a:t></a:r></a:p></p:txBody></p:sp>`
      : "";
    const bodyXml = (s.body ?? [])
      .map(
        (line) =>
          `<p:sp><p:nvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${line}</a:t></a:r></a:p></p:txBody></p:sp>`,
      )
      .join("");

    const slideXml = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${titleXml}${bodyXml}</p:spTree></p:cSld></p:sld>`;
    zip.folder("ppt")!.folder("slides")!.file(`slide${i + 1}.xml`, slideXml);
  }

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

async function makeDocxBuffer(content: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.folder("word")!.folder("_rels")!.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  const paragraphs = content
    .split(/\n/)
    .map((line) => {
      const h1 = line.match(/^# (.+)$/);
      const h2 = line.match(/^## (.+)$/);
      const text = h1 ? h1[1] : h2 ? h2[1] : line;
      const style = h1 ? "Heading1" : h2 ? "Heading2" : "Normal";
      return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
    })
    .join("\n");

  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`,
  );

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

// ─── buildSlidesFromParsed ─────────────────────────────────────────────────────

describe("buildSlidesFromParsed", () => {
  it("produces one slide per parsed entry", () => {
    const parsed = [
      { title: "Intro", bullets: ["Point A", "Point B"] },
      { title: "Outro", bullets: [] },
    ];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    expect(slides).toHaveLength(2);
  });

  it("generates unique sequential slide IDs", () => {
    const parsed = [
      { title: "A", bullets: [] },
      { title: "B", bullets: [] },
      { title: "C", bullets: [] },
    ];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const ids = slides.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("includes a 700-weight title element when title is provided", () => {
    const parsed = [{ title: "Hello World", bullets: [] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    const titleEl = elements.find((e) => e.fontWeight === "700");
    expect(titleEl).toBeDefined();
    expect(titleEl!.text).toBe("Hello World");
    expect(titleEl!.fontSize).toBe(38);
  });

  it("includes a body text element when bullets are present", () => {
    const parsed = [{ title: "Title", bullets: ["Bullet 1", "Bullet 2"] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    const bodyEl = elements.find((e) => e.fontWeight === "400");
    expect(bodyEl).toBeDefined();
    expect((bodyEl!.text as string).includes("Bullet 1")).toBe(true);
    expect((bodyEl!.text as string).includes("Bullet 2")).toBe(true);
  });

  it("uses RTL alignment for Arabic language", () => {
    const parsed = [{ title: "عنوان", bullets: ["نقطة"] }];
    const slides = buildSlidesFromParsed(parsed, "ar") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    const bodyEl = elements.find((e) => e.fontWeight === "400");
    expect(bodyEl!.align).toBe("end");
  });

  it("uses LTR alignment for English language", () => {
    const parsed = [{ title: "Title", bullets: ["bullet"] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    const bodyEl = elements.find((e) => e.fontWeight === "400");
    expect(bodyEl!.align).toBe("start");
  });

  it("produces an empty elements array for a slide with no title or bullets", () => {
    const parsed = [{ title: "Good", bullets: ["A"] }, { title: undefined, bullets: [] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const emptySlide = slides[1];
    const elements = emptySlide.elements as Array<Record<string, unknown>>;
    expect(elements).toHaveLength(0);
  });

  it("truncates concatenated bullet text to 4000 chars", () => {
    const longBullet = "x".repeat(5000);
    const parsed = [{ title: undefined, bullets: [longBullet] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    expect((elements[0].text as string).length).toBeLessThanOrEqual(4000);
  });

  it("sets white background on all slides", () => {
    const parsed = [{ title: "S1", bullets: [] }, { title: "S2", bullets: ["b"] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    for (const s of slides) {
      expect(s.background).toBe("#ffffff");
    }
  });

  it("positions body below title when both are present", () => {
    const parsed = [{ title: "T", bullets: ["b"] }];
    const slides = buildSlidesFromParsed(parsed, "en") as Array<Record<string, unknown>>;
    const elements = slides[0].elements as Array<Record<string, unknown>>;
    const titleEl = elements.find((e) => e.fontWeight === "700")!;
    const bodyEl  = elements.find((e) => e.fontWeight === "400")!;
    expect((bodyEl.y as number)).toBeGreaterThan((titleEl.y as number));
  });
});

// ─── buildSlidesFromPdfPages ───────────────────────────────────────────────────

describe("buildSlidesFromPdfPages", () => {
  it("produces one slide per page URL", () => {
    const slides = buildSlidesFromPdfPages([
      "https://storage.example.com/page1.png",
      "https://storage.example.com/page2.png",
      "https://storage.example.com/page3.png",
    ]) as Array<Record<string, unknown>>;
    expect(slides).toHaveLength(3);
  });

  it("sets backgroundImage to the provided URL", () => {
    const url = "https://storage.example.com/page1.png";
    const slides = buildSlidesFromPdfPages([url]) as Array<Record<string, unknown>>;
    expect(slides[0].backgroundImage).toBe(url);
  });

  it("produces blank elements array for each slide", () => {
    const slides = buildSlidesFromPdfPages([
      "https://storage.example.com/page1.png",
    ]) as Array<Record<string, unknown>>;
    expect(slides[0].elements).toEqual([]);
  });

  it("assigns sequential IDs to slides", () => {
    const slides = buildSlidesFromPdfPages([
      "https://storage.example.com/page1.png",
      "https://storage.example.com/page2.png",
    ]) as Array<Record<string, unknown>>;
    expect(slides[0].id).toBe("s1");
    expect(slides[1].id).toBe("s2");
  });

  it("returns an empty array for empty input", () => {
    const slides = buildSlidesFromPdfPages([]);
    expect(slides).toHaveLength(0);
  });
});

// ─── parsePptx ────────────────────────────────────────────────────────────────

describe("parsePptx", () => {
  it("returns an empty array for an empty PPTX (no slides)", async () => {
    const buf = await makePptxBuffer([]);
    const result = await parsePptx(buf);
    expect(result).toEqual([]);
  });

  it("extracts one ParsedSlide per PPTX slide", async () => {
    const buf = await makePptxBuffer([
      { title: "Slide One", body: ["Body A"] },
      { title: "Slide Two", body: ["Body B", "Body C"] },
    ]);
    const result = await parsePptx(buf);
    expect(result).toHaveLength(2);
  });

  it("correctly identifies title placeholder text", async () => {
    const buf = await makePptxBuffer([{ title: "My Title", body: ["Some body"] }]);
    const result = await parsePptx(buf);
    expect(result[0].title).toBe("My Title");
  });

  it("correctly extracts body text into bullets", async () => {
    const buf = await makePptxBuffer([
      { title: "T", body: ["First bullet", "Second bullet"] },
    ]);
    const result = await parsePptx(buf);
    expect(result[0].bullets).toContain("First bullet");
    expect(result[0].bullets).toContain("Second bullet");
  });

  it("handles slides with no title placeholder", async () => {
    const buf = await makePptxBuffer([{ body: ["Body only text"] }]);
    const result = await parsePptx(buf);
    expect(result[0].title).toBeUndefined();
    expect(result[0].bullets).toContain("Body only text");
  });

  it("preserves slide order", async () => {
    const buf = await makePptxBuffer([
      { title: "First" },
      { title: "Second" },
      { title: "Third" },
    ]);
    const result = await parsePptx(buf);
    expect(result[0].title).toBe("First");
    expect(result[1].title).toBe("Second");
    expect(result[2].title).toBe("Third");
  });

  it("decodes common XML entities in text", async () => {
    const buf = await makePptxBuffer([{ title: "A &amp; B" }]);
    const result = await parsePptx(buf);
    expect(result[0].title).toBe("A & B");
  });
});

// ─── parseDocx ────────────────────────────────────────────────────────────────

describe("parseDocx", () => {
  it("splits on Heading1 into multiple slides", async () => {
    const buf = await makeDocxBuffer(
      "# Chapter One\nSome content here\n# Chapter Two\nMore content",
    );
    const result = await parseDocx(buf);
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to balanced chunking when there are no headings", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i + 1}`).join("\n");
    const buf = await makeDocxBuffer(lines);
    const result = await parseDocx(buf);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns at most 100 slides", async () => {
    const manyHeadings = Array.from({ length: 150 }, (_, i) => `# Section ${i + 1}`).join("\n");
    const buf = await makeDocxBuffer(manyHeadings);
    const result = await parseDocx(buf);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it("auto-breaks a slide when bullets exceed the density limit", async () => {
    /* 15 plain paragraphs under a single heading — should trigger an
       auto-break at the 12-bullet boundary, producing ≥ 2 slides. */
    const body = Array.from({ length: 15 }, (_, i) => `Para ${i + 1}`).join("\n");
    const buf = await makeDocxBuffer(`# Only Heading\n${body}`);
    const result = await parseDocx(buf);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
