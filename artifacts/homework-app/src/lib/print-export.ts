import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";
import { contentDirection, type ContentDirection } from "./content-direction";

// Lightweight export helpers for the teacher's printable surfaces.

export interface WordExportOptions {
  /** The DOM element whose HTML should be exported. */
  element: HTMLElement;
  /** Title used both as the file name and the Word document title. */
  title: string;
  /** Optional language attribute for the body — affects Word's text direction. */
  lang?: "ar" | "en";
}

type WordChild = Paragraph | Table;

function pointsFromCss(value: string, fallback = 12): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (value.endsWith("px")) return parsed * 0.75;
  if (value.endsWith("pt")) return parsed;
  return fallback;
}

function alignmentFor(
  element: Element,
  rtl: boolean,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  const explicitlyAligned = [element, ...element.querySelectorAll<HTMLElement>("[style]")]
    .find(candidate => (candidate as HTMLElement).style.textAlign);
  const alignment = (explicitlyAligned as HTMLElement | undefined)?.style.textAlign
    || window.getComputedStyle(element).textAlign;
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right" || alignment === "end") return AlignmentType.RIGHT;
  if (alignment === "justify") return AlignmentType.JUSTIFIED;
  return rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
}

function directionForElement(
  element: Element,
  fallback: ContentDirection,
): ContentDirection {
  const explicitDirection = element.getAttribute("dir");
  if (explicitDirection === "ltr" || explicitDirection === "rtl") {
    return explicitDirection;
  }
  return contentDirection(element.textContent, fallback);
}

function directionForTextParent(
  element: Element,
  fallback: ContentDirection,
): ContentDirection {
  const explicitDirection = element.closest("[dir]")?.getAttribute("dir");
  if (explicitDirection === "ltr" || explicitDirection === "rtl") {
    return explicitDirection;
  }
  return contentDirection(element.textContent, fallback);
}

function textRuns(element: Element, direction: ContentDirection): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (node: Node, inherited: Partial<CSSStyleDeclaration> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ") ?? "";
      if (!text.trim()) return;
      const parent = node.parentElement;
      const computed = parent ? window.getComputedStyle(parent) : null;
      const inline = parent?.style;
      const size = pointsFromCss(inline?.fontSize || computed?.fontSize || "", 12);
      const weight = inline?.fontWeight || computed?.fontWeight || inherited.fontWeight || "";
      const runDirection = parent
        ? directionForTextParent(parent, direction)
        : contentDirection(text, direction);
      const runRtl = runDirection === "rtl";
      runs.push(new TextRun({
        text,
        bold: Number.parseInt(weight, 10) >= 600 || weight === "bold",
        italics: (inline?.fontStyle || computed?.fontStyle) === "italic",
        size: Math.round(size * 2),
        font: inline?.fontFamily?.split(",")[0]?.replace(/['"]/g, "") || (runRtl ? "Cairo" : "Arial"),
        rightToLeft: runRtl,
      }));
      return;
    }
    node.childNodes.forEach(child => visit(child, inherited));
  };
  visit(element);
  return runs.length
    ? runs
    : [new TextRun({ text: "", rightToLeft: direction === "rtl" })];
}

function paragraphFor(element: Element, rtl: boolean, text?: string): Paragraph {
  const direction = directionForElement(element, rtl ? "rtl" : "ltr");
  const paragraphRtl = direction === "rtl";
  return new Paragraph({
    children: text == null
      ? textRuns(element, direction)
      : [new TextRun({ text, rightToLeft: paragraphRtl, font: paragraphRtl ? "Cairo" : "Arial", size: 24 })],
    bidirectional: paragraphRtl,
    alignment: alignmentFor(element, paragraphRtl),
    spacing: { after: 100, line: 300 },
  });
}

function choiceTable(list: Element, rtl: boolean): Table {
  const choices = Array.from(list.children);
  const columns = list.getAttribute("data-choice-columns") === "2" ? 2 : 1;
  const rows: TableRow[] = [];
  for (let index = 0; index < choices.length; index += columns) {
    rows.push(new TableRow({
      children: Array.from({ length: columns }, (_, column) => {
        const choice = choices[index + column];
        return new TableCell({
          width: { size: 100 / columns, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [choice ? paragraphFor(choice, rtl) : new Paragraph("")],
        });
      }),
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
}

function matchingTable(container: Element, rtl: boolean): Table {
  const columns = Array.from(container.querySelectorAll<HTMLElement>(":scope > .ws-match-col"));
  const columnItems = columns.map(column =>
    Array.from(column.children).filter(item => item.matches(".ws-match-pair")),
  );
  const rowCount = Math.max(0, ...columnItems.map(items => items.length));
  const leftShare = Number.parseFloat(container.getAttribute("data-matching-left-share") ?? "");
  const rightShare = Number.parseFloat(container.getAttribute("data-matching-right-share") ?? "");
  const totalShare = leftShare + rightShare;
  const widths = Number.isFinite(totalShare) && totalShare > 0
    ? [leftShare / totalShare * 100, rightShare / totalShare * 100]
    : [50, 50];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: Array.from({ length: rowCount }, (_, rowIndex) => new TableRow({
      children: columnItems.map((items, columnIndex) => {
        const item = items[rowIndex];
        return new TableCell({
          width: { size: widths[columnIndex], type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [item ? paragraphFor(item, rtl) : new Paragraph("")],
        });
      }),
    })),
  });
}

function pageChildren(page: Element, rtl: boolean): WordChild[] {
  const output: WordChild[] = [];
  const selectors = [
    "h1", "h2", "h3",
    ".ws-kicker-center", ".ws-cont-title", ".ws-cont-page",
    ".ws-identity-cell", ".ws-field-label", ".ws-subtitle", ".ws-instructions",
    ".ws-section-instr", ".ws-q-head", ".ws-q-prompt", ".ws-answer-line",
    ".ws-tf-choice", ".ws-match", ".ws-match-pair", ".ws-footer-note", ".ws-good-luck",
    ".ws-mcq",
  ].join(",");
  page.querySelectorAll(selectors).forEach(element => {
    if (element.matches(".ws-mcq")) {
      output.push(choiceTable(element, rtl));
      return;
    }
    if (element.matches(".ws-match")) {
      output.push(matchingTable(element, rtl));
      return;
    }
    if (element.closest(".ws-mcq")) return;
    if (element.closest(".ws-match")) return;
    if (element.matches(".ws-q-prompt") && element.closest(".ws-q-head")) return;
    const text = element.textContent?.trim();
    if (text) output.push(paragraphFor(element, rtl));
  });
  return output.length ? output : [paragraphFor(page, rtl)];
}

export function buildWordDocument({
  element,
  title,
  lang = "ar",
}: WordExportOptions): Document {
  const rtl = lang === "ar";
  const pages = Array.from(element.querySelectorAll(
    "[data-worksheet-page], [data-answer-key-page], .lp-page",
  ));
  const sourcePages = pages.length ? pages : [element];
  const children: WordChild[] = [];
  sourcePages.forEach((page, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(...pageChildren(page, rtl));
  });
  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 680, right: 567, bottom: 680, left: 567 },
      },
    },
    children,
  };
  return new Document({
    creator: "Hasad",
    title,
    description: rtl ? "ورقة عمل من منصة حصاد" : "Worksheet from Hasad",
    sections: [section],
  });
}

/**
 * Trigger a real `.docx` download containing native OOXML paragraphs and
 * tables so modern Word clients do not show a file-format mismatch warning.
 */
export async function downloadAsWord(options: WordExportOptions): Promise<void> {
  const { title } = options;
  const blob = await Packer.toBlob(buildWordDocument(options));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Trigger the browser's print dialog. The print stylesheet on the page
 * already enforces `@page { size: A4; margin: 0 }` so the dialog's
 * "Save as PDF" produces a true A4 PDF.
 */
let printInFlight: Promise<void> | null = null;

async function waitForStablePrintLayout(): Promise<void> {
  if ("fonts" in document) {
    await document.fonts.ready.catch(() => undefined);
  }

  const nextFrame = () => new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else window.setTimeout(resolve, 0);
  });
  let previousSignature: string | null = null;
  let stableFrames = 0;
  for (let attempt = 0; attempt < 12 && stableFrames < 2; attempt += 1) {
    await nextFrame();
    const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-worksheet-page], [data-answer-key-page]"));
    const signature = pages
      .map(page => `${page.getBoundingClientRect().height}:${page.scrollHeight}:${page.textContent?.length ?? 0}`)
      .join("|");
    stableFrames = signature === previousSignature ? stableFrames + 1 : 0;
    previousSignature = signature;
  }
}

export function printToPdf(title?: string): Promise<void> {
  if (printInFlight) return printInFlight;
  printInFlight = (async () => {
    await waitForStablePrintLayout();
  const previousTitle = document.title;
  if (title?.trim()) document.title = sanitizeFilename(title);

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle, { once: true });
  try {
    window.print();
  } finally {
    // Chromium blocks until the dialog closes; other browsers may not emit
    // afterprint reliably, so keep a fallback without changing the PDF name.
    window.setTimeout(restoreTitle, 1000);
  }
  })().finally(() => {
    printInFlight = null;
  });
  return printInFlight;
}

function sanitizeFilename(s: string): string {
  // Allow Arabic/Latin letters, digits, spaces, dashes, underscores;
  // collapse anything else to a single dash.
  const cleaned = s
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "document";
}
