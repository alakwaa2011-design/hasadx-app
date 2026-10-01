import {
  Document, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  ImageRun, Packer, Paragraph, SectionType, TextWrappingType,
  VerticalPositionAlign, VerticalPositionRelativeFrom,
} from "docx";
import type { WordExportOptions } from "./print-export";

const PAGE_SELECTOR = "[data-worksheet-page], [data-answer-key-page]";
const A4_WIDTH = 11906;
const A4_HEIGHT = 16838;

export class VisualWordExportError extends Error {
  constructor(public readonly code: "pages" | "image" | "capture") {
    super(`Visual Word export failed: ${code}`);
  }
}

export interface WordPageImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/** One floating picture per A4 section: no inline-image line can create a blank page. */
export function buildVisualWordDocument(
  pages: WordPageImage[],
  title: string,
  lang: "ar" | "en" = "ar",
): Document {
  if (!pages.length) throw new VisualWordExportError("pages");
  return new Document({
    creator: "Hasad",
    title,
    description: lang === "ar"
      ? "نسخة مطابقة بصريًا؛ صفحات مصورة غير قابلة لتحرير النص"
      : "Visual copy; page images, not editable text",
    sections: pages.map((page, index) => {
      const scale = Math.min(A4_WIDTH / 15 / page.width, A4_HEIGHT / 15 / page.height);
      return {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: A4_WIDTH, height: A4_HEIGHT },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
          },
        },
        children: [new Paragraph({
          spacing: { before: 0, after: 0, line: 20 },
          children: [new ImageRun({
            type: "png",
            data: page.data,
            transformation: { width: page.width * scale, height: page.height * scale },
            altText: {
              name: `Worksheet page ${index + 1}`,
              title: `${title} — ${index + 1}`,
              description: lang === "ar" ? "صفحة مصورة للحفاظ على التصميم" : "Page image preserving the design",
            },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.TOP },
              wrap: { type: TextWrappingType.NONE },
              allowOverlap: true,
              behindDocument: false,
            },
          })],
        })],
      };
    }),
  });
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new VisualWordExportError("image"));
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(original: HTMLElement, clone: HTMLElement): Promise<void> {
  const images = Array.from(original.querySelectorAll<HTMLImageElement>("img"))
    .filter(image => !image.closest(".no-print"));
  const clonedImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));
  const cache = new Map<string, Promise<string>>();
  await Promise.all(images.map(async (image, index) => {
    const src = image.currentSrc || image.src;
    if (!src || !clonedImages[index]) throw new VisualWordExportError("image");
    if (!cache.has(src)) {
      cache.set(src, (async () => {
        try {
          // Same-origin credentials never travel to an external image host.
          const response = await fetch(src, { credentials: "same-origin", signal: AbortSignal.timeout(20000) });
          if (!response.ok) throw new VisualWordExportError("image");
          return await blobAsDataUrl(await response.blob());
        } catch {
          throw new VisualWordExportError("image");
        }
      })());
    }
    const target = clonedImages[index];
    target.removeAttribute("srcset");
    target.removeAttribute("crossorigin");
    target.loading = "eager";
    target.src = await cache.get(src)!;
    if (typeof target.decode === "function") {
      await target.decode().catch(() => { throw new VisualWordExportError("image"); });
    }
  }));
}

async function stablePages(element: HTMLElement): Promise<void> {
  if ("fonts" in document) await document.fonts.ready;
  let previous = "";
  let same = 0;
  for (let attempt = 0; attempt < 20 && same < 3; attempt += 1) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const signature = Array.from(element.querySelectorAll<HTMLElement>(PAGE_SELECTOR))
      .map(page => `${page.scrollHeight}:${page.textContent?.length}`).join("|");
    same = signature === previous ? same + 1 : 0;
    previous = signature;
  }
}

async function waitForImages(element: HTMLElement): Promise<void> {
  await Promise.all(Array.from(element.querySelectorAll<HTMLImageElement>("img"))
    .filter(image => !image.closest(".no-print"))
    .map(image => new Promise<void>((resolve, reject) => {
      const loading = image.getAttribute("loading");
      const finish = (failed: boolean) => {
        clearTimeout(timeout);
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failedLoad);
        if (loading === null) image.removeAttribute("loading");
        else image.setAttribute("loading", loading);
        if (failed) reject(new VisualWordExportError("image"));
        else resolve();
      };
      const loaded = () => finish(false);
      const failedLoad = () => finish(true);
      const timeout = setTimeout(failedLoad, 20000);
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failedLoad, { once: true });
      image.loading = "eager";
      if (image.complete) finish(image.naturalWidth === 0);
    })));
}

/** Freeze the displayed pages, including answer keys, before rasterizing sequentially. */
export async function captureWorksheetPages(
  element: HTMLElement,
  onProgress?: (done: number, total: number) => void,
): Promise<WordPageImage[]> {
  await waitForImages(element);
  await stablePages(element);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  const inherited = getComputedStyle(element);
  Object.assign(clone.style, {
    position: "fixed", left: "-100000px", top: "0",
    width: `${Math.max(element.scrollWidth, 810)}px`, fontFamily: inherited.fontFamily,
    maxWidth: "none", overflow: "visible",
    direction: inherited.direction, pointerEvents: "none",
  });
  // Phone fitting is screen-only: rasterize at the original A4 size, not phone resolution.
  clone.style.setProperty("--ws-preview-scale", "1");
  clone.querySelectorAll(".no-print").forEach(node => node.remove());
  clone.querySelectorAll(".ws-q-selected").forEach(node => node.classList.remove("ws-q-selected"));
  clone.querySelectorAll<HTMLElement>(".ws-editable").forEach(node => {
    node.style.background = "transparent";
    node.style.boxShadow = "none";
    node.style.outline = "none";
  });
  clone.querySelectorAll("[contenteditable]").forEach(node => node.removeAttribute("contenteditable"));
  document.body.appendChild(clone);
  try {
    await inlineImages(element, clone);
    const pages = Array.from(clone.querySelectorAll<HTMLElement>(PAGE_SELECTOR));
    if (!pages.length) throw new VisualWordExportError("pages");
    const { default: html2canvas } = await import("html2canvas");
    const images: WordPageImage[] = [];
    for (const [index, page] of pages.entries()) {
      page.style.boxShadow = "none";
      const bounds = page.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) throw new VisualWordExportError("capture");
      const canvas = await html2canvas(page, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: "#ffffff", scrollX: 0, scrollY: 0,
        ignoreElements: node => node.classList.contains("no-print"),
      });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(value => value ? resolve(value) : reject(new VisualWordExportError("capture")), "image/png");
        });
        images.push({
          data: new Uint8Array(await blob.arrayBuffer()),
          width: bounds.width,
          height: bounds.height,
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
      onProgress?.(index + 1, pages.length);
    }
    return images;
  } catch (error) {
    if (error instanceof VisualWordExportError) throw error;
    throw new VisualWordExportError("capture");
  } finally {
    clone.remove();
  }
}

export async function downloadVisualWorksheetWord(
  options: WordExportOptions & { onProgress?: (done: number, total: number) => void },
): Promise<void> {
  const pages = await captureWorksheetPages(options.element, options.onProgress);
  const blob = await Packer.toBlob(buildVisualWordDocument(pages, options.title, options.lang));
  const filename = options.title.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-").trim().slice(0, 80) || "worksheet";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename} - ${options.lang === "en" ? "Visual design" : "مطابق للتصميم"}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}