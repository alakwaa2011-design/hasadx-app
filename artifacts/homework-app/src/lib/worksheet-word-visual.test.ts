import { afterEach, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildVisualWordDocument, captureWorksheetPages, VisualWordExportError } from "./worksheet-word-visual";

const capture = vi.hoisted(() => vi.fn());
vi.mock("html2canvas", () => ({ default: capture }));
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII="), c => c.charCodeAt(0));

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  capture.mockReset();
});

describe("visual worksheet Word", () => {
  it("uses one page-anchored image per A4 section, without inline images or extra page breaks", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildVisualWordDocument([
      { data: png, width: 794, height: 1123 },
      { data: png, width: 794, height: 1123 },
    ], "ورقة تجريبية")));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml.match(/<wp:anchor /g)).toHaveLength(2);
    expect(xml.match(/<w:sectPr>/g)).toHaveLength(2);
    // docx emits one additional paragraph to carry the section boundary.
    expect(xml.match(/<w:p>/g)).toHaveLength(3);
    expect(xml).toContain('w:w="11906" w:h="16838"');
    expect(xml).toContain('<w:type w:val="nextPage"/>');
    expect(xml).toContain('<wp:positionH relativeFrom="page">');
    expect(xml).toContain('<wp:positionV relativeFrom="page">');
    expect(xml).not.toContain("<wp:inline");
    expect(xml).not.toContain('<w:br w:type="page"');
    expect(Object.keys(zip.files).some(path => path.startsWith("word/media/") && path.endsWith(".png"))).toBe(true);
  });

  it("fits unexpectedly tall pages inside A4 without clipping their content", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildVisualWordDocument([
      { data: png, width: 794, height: 1600 },
    ], "Tall page", "en")));
    const xml = await zip.file("word/document.xml")!.async("string");
    const extent = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    expect(extent).not.toBeNull();
    expect(Number(extent![1])).toBeLessThan(11906 * 635);
    expect(Number(extent![2])).toBeCloseTo(16838 * 635, -2);
  });

  it("captures worksheet and answer pages at double resolution, strips editing tools, and leaves originals intact", async () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 794, height: 1123, x: 0, y: 0, top: 0, left: 0, right: 794, bottom: 1123, toJSON: () => ({}),
    });
    const root = document.createElement("div");
    root.id = "ws-printable-root";
    root.innerHTML = `<article data-worksheet-page><div class="ws-q-selected"><span contenteditable="true">سؤال</span><button class="no-print">حذف</button></div></article><article data-answer-key-page>الإجابة</article>`;
    document.body.appendChild(root);
    const progress = vi.fn();
    capture.mockImplementation(async (page: HTMLElement) => {
      expect(page.querySelector(".no-print")).toBeNull();
      expect(page.querySelector(".ws-q-selected")).toBeNull();
      expect(page.querySelector("[contenteditable]")).toBeNull();
      return { width: 1588, height: 2246, toBlob: (fn: (blob: unknown) => void) => fn({ arrayBuffer: async () => png.buffer }) };
    });
    const pages = await captureWorksheetPages(root, progress);
    expect(pages).toHaveLength(2);
    expect(capture.mock.calls[0][1]).toMatchObject({ scale: 2 });
    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    expect(root.querySelector(".no-print")).not.toBeNull();
    expect(root.querySelector("[contenteditable]")).not.toBeNull();
    expect(document.body.children).toHaveLength(1);
  });

  it("does not download a partial document when a capture fails, and cleans up the frozen copy", async () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 794, height: 1123 } as DOMRect);
    const root = document.createElement("div");
    root.innerHTML = "<article data-worksheet-page>سؤال</article>";
    document.body.appendChild(root);
    capture.mockRejectedValue(new Error("tainted canvas"));
    await expect(captureWorksheetPages(root)).rejects.toBeInstanceOf(VisualWordExportError);
    expect(document.body.children).toHaveLength(1);
  });

  it("rejects a missing page list", () => {
    expect(() => buildVisualWordDocument([], "Empty")).toThrow(VisualWordExportError);
  });

  it("fails explicitly rather than silently omitting an unavailable design image", async () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const root = document.createElement("div");
    root.innerHTML = '<article data-worksheet-page><img src="/design-image.png" loading="lazy"></article>';
    document.body.appendChild(root);
    await expect(captureWorksheetPages(root)).rejects.toMatchObject({ code: "image" });
    expect(capture).not.toHaveBeenCalled();
    expect(root.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(document.body.children).toHaveLength(1);
  });
});