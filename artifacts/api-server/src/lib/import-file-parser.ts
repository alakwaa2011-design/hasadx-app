/**
 * File import parsers for presentation content extraction.
 *
 * Supported formats:
 *  - PPTX: extracts slide titles and body text via JSZip + XML regex
 *  - PDF:  renders each page as a PNG image via the `pdftoppm` system
 *          utility (poppler-utils, available in the Replit Nix environment)
 *  - DOCX: extracts headings and paragraphs via mammoth
 *
 * PDF pages are returned as raw PNG buffers; the caller is responsible
 * for uploading them to object storage and building the slide JSONB.
 *
 * Canvas reference: 1280 × 720 px.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import mammoth from "mammoth";

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface ParsedSlide {
  title?: string;
  /** Paragraph / bullet strings for the body area. */
  bullets: string[];
}

export interface ParsedPdfPage {
  /** Raw PNG buffer of the rendered page. */
  imageBuffer: Buffer;
  /** 1-based page number. */
  pageNumber: number;
}

// ─── Canvas layout constants ───────────────────────────────────────────────────

const CANVAS_W = 1280;
const CANVAS_H = 720;
const MARGIN   = 64;
const TITLE_H  = 100;
const TITLE_FS = 48;
const BODY_FS  = 26;

/** Adaptive body font size — shrinks when many bullets are present. */
function adaptiveBodyFs(lineCount: number): number {
  if (lineCount >= 9) return 20;
  if (lineCount >= 6) return 24;
  return BODY_FS;
}

// ─── Slide builders ────────────────────────────────────────────────────────────

/**
 * Convert an array of `ParsedSlide` objects (from PPTX or DOCX) into the
 * HasadX slide JSONB format accepted by `slidesSchema` in presentations.ts.
 */
export function buildSlidesFromParsed(
  parsed: ParsedSlide[],
  language: "ar" | "en",
): object[] {
  const isRtl = language === "ar";
  const align = isRtl ? ("end" as const) : ("start" as const);
  const fontFamily = isRtl ? "'Cairo', sans-serif" : undefined;
  const bodyY = MARGIN + TITLE_H + 20;
  const bodyH = CANVAS_H - bodyY - MARGIN;

  return parsed.map((p, i) => {
    const slideId = `s${i + 1}`;
    const elements: object[] = [];
    let elIdx = 0;

    const textDirection = isRtl ? ("rtl" as const) : undefined;

    if (p.title?.trim()) {
      elements.push({
        id: `${slideId}_e${++elIdx}`,
        kind: "text" as const,
        x: MARGIN,
        y: MARGIN,
        w: CANVAS_W - MARGIN * 2,
        h: TITLE_H,
        text: p.title.trim().slice(0, 200),
        fontSize: TITLE_FS,
        fontWeight: "700",
        align,
        textDirection,
        fontFamily,
        color: "#1a1a1a",
      });
    }

    const bodyLines = p.bullets.map((b) => b.trim()).filter(Boolean);
    if (bodyLines.length > 0) {
      const bodyText = bodyLines.join("\n").slice(0, 4000);
      elements.push({
        id: `${slideId}_e${++elIdx}`,
        kind: "text" as const,
        x: MARGIN,
        y: p.title?.trim() ? bodyY : MARGIN,
        w: CANVAS_W - MARGIN * 2,
        h: p.title?.trim() ? bodyH : CANVAS_H - MARGIN * 2,
        text: bodyText,
        fontSize: adaptiveBodyFs(bodyLines.length),
        fontWeight: "400",
        align,
        textDirection,
        fontFamily,
        color: "#333333",
      });
    }

    return {
      id: slideId,
      layout:
        elements.length === 1 && p.title?.trim() && bodyLines.length === 0
          ? "title-only"
          : "blank",
      background: "#ffffff",
      ...(isRtl ? { dir: "rtl" as const, lang: "ar" as const } : {}),
      elements,
    };
  });
}

/**
 * Build slides from uploaded PDF page image URLs.
 * Each page becomes a blank slide with its image set as the background.
 * We intentionally leave `background` null so that when the image URL
 * fails to load the renderer falls back to the deck's theme gradient
 * instead of painting a solid black canvas.
 */
export function buildSlidesFromPdfPages(pageUrls: string[]): object[] {
  return pageUrls.map((imageUrl, i) => ({
    id: `s${i + 1}`,
    layout: "blank",
    background: null,
    backgroundImage: imageUrl,
    elements: [],
  }));
}

// ─── PPTX parser ───────────────────────────────────────────────────────────────

/**
 * Extract slide content from a PPTX buffer.
 *
 * A PPTX file is a ZIP archive; each slide lives at
 * `ppt/slides/slide{N}.xml`.  Text runs are stored in `<a:t>` elements;
 * title placeholders are identified by `<p:ph type="title">` or
 * `<p:ph type="ctrTitle">`.
 */
export async function parsePptx(buffer: Buffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);

  const slideEntries: Array<{ index: number; file: JSZip.JSZipObject }> = [];
  zip.forEach((path, file) => {
    const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (m && !file.dir) {
      slideEntries.push({ index: parseInt(m[1], 10), file });
    }
  });
  slideEntries.sort((a, b) => a.index - b.index);

  const results: ParsedSlide[] = [];
  for (const { file } of slideEntries) {
    const xml = await file.async("string");
    results.push(parsePptxSlideXml(xml));
  }
  return results;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parsePptxSlideXml(xml: string): ParsedSlide {
  let title: string | undefined;
  const bullets: string[] = [];

  const spRegex = /<p:sp[ >]([\s\S]*?)<\/p:sp>/g;
  let spMatch: RegExpExecArray | null;
  while ((spMatch = spRegex.exec(xml)) !== null) {
    const shapeXml = spMatch[1];
    const isTitlePh = /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(shapeXml);

    const paraRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
    let paraMatch: RegExpExecArray | null;
    const paragraphTexts: string[] = [];

    while ((paraMatch = paraRegex.exec(shapeXml)) !== null) {
      const runRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let runMatch: RegExpExecArray | null;
      const runParts: string[] = [];
      while ((runMatch = runRegex.exec(paraMatch[1])) !== null) {
        const t = decodeXmlEntities(runMatch[1]).trim();
        if (t) runParts.push(t);
      }
      const p = runParts.join(" ").trim();
      if (p) paragraphTexts.push(p);
    }

    if (paragraphTexts.length === 0) continue;

    if (isTitlePh && !title) {
      title = paragraphTexts.join(" ").trim().slice(0, 200);
    } else {
      for (const pt of paragraphTexts) {
        bullets.push(pt.slice(0, 500));
      }
    }
  }

  return { title, bullets };
}

// ─── PDF parser ────────────────────────────────────────────────────────────────

/**
 * Render each PDF page as a PNG image using the `pdftoppm` system utility
 * (from poppler-utils, available in the Replit Nix environment).
 *
 * Returns one `ParsedPdfPage` per page (capped at `maxPages`).
 * The caller is responsible for uploading each `imageBuffer` to object
 * storage and passing the resulting URLs to `buildSlidesFromPdfPages()`.
 *
 * @throws If `pdftoppm` is not available or the PDF is corrupt.
 *         The route handler wraps this call in a try/catch and falls back
 *         to `defaultSlides()` so deck creation always succeeds.
 */
export async function parsePdf(
  buffer: Buffer,
  maxPages = 100,
): Promise<ParsedPdfPage[]> {
  const workDir = join(
    tmpdir(),
    `hasad-pdf-${randomBytes(8).toString("hex")}`,
  );
  const pdfPath     = join(workDir, "input.pdf");
  const outputPrefix = join(workDir, "page");

  await fs.mkdir(workDir, { recursive: true });
  try {
    await fs.writeFile(pdfPath, buffer);

    /* pdftoppm renders PDF pages to PNG images.
       -png       — output format
       -r 150     — 150 DPI (good quality without ballooning memory)
       -scale-to 1280 — fit to the 1280 px slide canvas width
       -l maxPages — stop after this many pages                    */
    await new Promise<void>((resolve, reject) => {
      execFile(
        "pdftoppm",
        [
          "-png",
          "-r", "150",
          "-scale-to-x", "1280",
          "-scale-to-y", "-1",
          "-l", String(maxPages),
          pdfPath,
          outputPrefix,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });

    /* Collect output files.  pdftoppm zero-pads the suffix based on the
       total page count, so we sort numerically by extracting the number. */
    const allFiles = await fs.readdir(workDir);
    const pngFiles = allFiles
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/^page-0*/, "").replace(".png", ""), 10);
        const numB = parseInt(b.replace(/^page-0*/, "").replace(".png", ""), 10);
        return numA - numB;
      });

    const pages: ParsedPdfPage[] = [];
    for (let i = 0; i < Math.min(pngFiles.length, maxPages); i++) {
      const imgBuffer = await fs.readFile(join(workDir, pngFiles[i]));
      pages.push({ imageBuffer: imgBuffer, pageNumber: i + 1 });
    }
    return pages;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ─── DOCX parser ───────────────────────────────────────────────────────────────

/**
 * Extract headings and paragraphs from a DOCX buffer via mammoth.
 *
 * Strategy:
 *  1. Convert to HTML to detect heading levels (h1–h6).
 *  2. Each `<h1>` starts a new slide; `<h2>`/`<h3>` become bold bullets.
 *  3. `<p>` and `<li>` elements are added as body bullets.
 *  4. Auto-break a slide when it accumulates 12+ bullets ("balanced" layout).
 *  5. If no headings are found, fall back to balanced chunking (10 lines per
 *     slide) using the raw-text extraction.
 *
 * Capped at 100 slides.
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedSlide[]> {
  const [htmlResult, rawResult] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);

  const html    = htmlResult.value;
  const rawText = rawResult.value;

  const slides: ParsedSlide[] = [];
  let current: ParsedSlide | null = null;
  let hasHeadings = false;

  const tagRegex = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(html)) !== null) {
    const tag  = m[1].toLowerCase();
    const text = m[2]
      .replace(/<[^>]+>/g,  "")
      .replace(/&amp;/g,    "&")
      .replace(/&lt;/g,     "<")
      .replace(/&gt;/g,     ">")
      .replace(/&nbsp;/g,   " ")
      .replace(/&quot;/g,   '"')
      .trim();
    if (!text) continue;

    if (tag === "h1") {
      hasHeadings = true;
      if (current) slides.push(current);
      current = { title: text.slice(0, 200), bullets: [] };
    } else if (tag === "h2" || tag === "h3") {
      hasHeadings = true;
      if (!current) {
        current = { title: text.slice(0, 200), bullets: [] };
      } else {
        current.bullets.push(`▸ ${text.slice(0, 200)}`);
      }
    } else {
      /* p or li */
      if (!current) current = { bullets: [] };
      current.bullets.push(text.slice(0, 500));

      /* Balanced density — auto-break at 12 bullets per slide. */
      if (current.bullets.length >= 12) {
        slides.push(current);
        current = { bullets: [] };
      }
    }
  }
  if (current && (current.title || current.bullets.length > 0)) {
    slides.push(current);
  }

  if (!hasHeadings || slides.length === 0) {
    return balancedChunk(rawText);
  }

  return slides.slice(0, 100);
}

/** Distribute plain-text lines evenly at ~10 lines per slide. */
function balancedChunk(rawText: string): ParsedSlide[] {
  const lines = rawText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const CHUNK  = 10;
  const slides: ParsedSlide[] = [];
  for (let i = 0; i < Math.min(lines.length, 1000); i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK);
    slides.push({
      title:   chunk[0]?.slice(0, 200),
      bullets: chunk.slice(1).map((l) => l.slice(0, 500)),
    });
  }
  return slides.slice(0, 100);
}
