/* file-extractor.ts
   Converts uploaded files into a structured text payload for the AI outline
   generator. Handles: PDF, DOCX, XLSX/XLS, and common image types.

   PDF   → pdf-parse (text per page + heading detection)
   DOCX  → mammoth  (raw text + HTML for heading detection)
   XLSX  → xlsx     (sheet → rows formatted as a readable table)
   Image → base64   (passed verbatim to GPT-4o Vision)
*/

import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ExtractedFile {
  fileType: "pdf" | "docx" | "xlsx" | "image";
  /** Concatenated readable text (empty for pure-image files). */
  text: string;
  /** Page count (PDF only). */
  pageCount?: number;
  /** Major headings / section titles extracted from the document. */
  headings: string[];
  /** Language guessed from character distribution: "ar" if >20% Arabic. */
  detectedLanguage: "ar" | "en";
  /** For images: base64-encoded data. */
  imageBase64?: string;
  imageMime?: string;
}

/* ── Language detection ──────────────────────────────────────────── */
function detectLanguage(text: string): "ar" | "en" {
  if (!text) return "ar";
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicChars / text.length > 0.15 ? "ar" : "en";
}

/* ── Heading heuristics ──────────────────────────────────────────── */
const MAX_HEADING_LEN = 80;
const MIN_HEADING_LEN = 3;

/** Extract probable headings from plain text.
    A line is treated as a heading if it's:
    - Short (≤ MAX_HEADING_LEN chars)
    - Followed by a blank line OR ends with ":" OR is UPPERCASE/ALL_CAPS (Latin)
    - Arabic: ends with ":" or is a standalone short phrase on its own line */
function extractHeadingsFromText(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const headings: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < MIN_HEADING_LEN || line.length > MAX_HEADING_LEN) continue;
    const nextBlank = !lines[i + 1]?.trim();
    const prevBlank = !lines[i - 1]?.trim();
    const endsColon = line.endsWith(":") || line.endsWith(":");
    const isUppercase = /^[A-Z\s\d\-–—:]{4,}$/.test(line);
    const standaloneArabic = /[\u0600-\u06FF]/.test(line) && (prevBlank || nextBlank);
    if (endsColon || isUppercase || (prevBlank && nextBlank) || standaloneArabic) {
      const clean = line.replace(/:+$/, "").trim();
      if (clean.length >= MIN_HEADING_LEN) headings.push(clean);
    }
  }
  return [...new Set(headings)].slice(0, 30);
}

/* Cap text to ~6 000 chars so we don't blow the model context.
   Strategy: keep the first 2 000 chars (usually the most info-dense),
   skip to mid-document for 2 000, and the last 2 000. */
function truncateText(text: string, limit = 6000): string {
  if (text.length <= limit) return text;
  const third = Math.floor(limit / 3);
  const mid = Math.floor(text.length / 2);
  return [
    text.slice(0, third),
    "\n…\n",
    text.slice(mid - third / 2, mid + third / 2),
    "\n…\n",
    text.slice(text.length - third),
  ].join("");
}

/* ── PDF ─────────────────────────────────────────────────────────── */
async function extractPdf(buffer: Buffer): Promise<ExtractedFile> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText() as { text?: string; numpages?: number };
  const rawText = result.text ?? "";
  const pageCount = result.numpages ?? 0;
  const text = truncateText(rawText.replace(/\s{3,}/g, "\n").trim());
  const headings = extractHeadingsFromText(rawText);
  return {
    fileType: "pdf",
    text,
    pageCount,
    headings,
    detectedLanguage: detectLanguage(rawText),
  };
}

/* ── DOCX ────────────────────────────────────────────────────────── */
async function extractDocx(buffer: Buffer): Promise<ExtractedFile> {
  /* Extract headings via HTML (mammoth tags h1/h2/h3). */
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);
  const rawText = rawResult.value ?? "";

  /* Pull <h1>, <h2>, <h3> content from HTML output. */
  const htmlHeadings: string[] = [];
  const hTagRe = /<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = hTagRe.exec(htmlResult.value)) !== null) {
    const clean = m[1].replace(/<[^>]+>/g, "").trim();
    if (clean.length >= MIN_HEADING_LEN && clean.length <= MAX_HEADING_LEN) {
      htmlHeadings.push(clean);
    }
  }

  const headings = htmlHeadings.length
    ? [...new Set(htmlHeadings)].slice(0, 30)
    : extractHeadingsFromText(rawText);

  return {
    fileType: "docx",
    text: truncateText(rawText.replace(/\s{3,}/g, "\n").trim()),
    headings,
    detectedLanguage: detectLanguage(rawText),
  };
}

/* ── XLSX / XLS ──────────────────────────────────────────────────── */
function extractXlsx(buffer: Buffer): ExtractedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  const headings: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, 5)) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows.length) continue;

    parts.push(`=== ${sheetName} ===`);
    headings.push(sheetName);

    /* First row is often a header. */
    const firstRow = rows[0] as unknown[];
    if (firstRow.every((c) => c !== null && c !== undefined && c !== "")) {
      headings.push(firstRow.map(String).join(" | "));
    }

    /* Write up to 30 rows as pipe-delimited text. */
    for (const row of rows.slice(0, 30)) {
      const cells = (row as unknown[]).map((c) =>
        c == null ? "" : String(c).slice(0, 60)
      );
      if (cells.some((c) => c.trim())) parts.push(cells.join(" | "));
    }
    if (rows.length > 30) parts.push(`… (${rows.length - 30} more rows)`);
    parts.push("");
  }

  const text = truncateText(parts.join("\n"));
  return {
    fileType: "xlsx",
    text,
    headings: [...new Set(headings)].slice(0, 20),
    detectedLanguage: detectLanguage(text),
  };
}

/* ── Image ───────────────────────────────────────────────────────── */
function extractImage(buffer: Buffer, mimetype: string): ExtractedFile {
  return {
    fileType: "image",
    text: "",
    headings: [],
    detectedLanguage: "ar",
    imageBase64: buffer.toString("base64"),
    imageMime: mimetype,
  };
}

/* ── Public entry point ──────────────────────────────────────────── */
export async function extractFileContent(
  buffer: Buffer,
  mimetype: string,
  _filename: string,
): Promise<ExtractedFile> {
  if (mimetype === "application/pdf") return extractPdf(buffer);

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) return extractDocx(buffer);

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimetype === "application/vnd.ms-excel"
  ) return extractXlsx(buffer);

  /* Everything else is treated as an image (PNG, JPEG, WebP, GIF). */
  return extractImage(buffer, mimetype);
}
