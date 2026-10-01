import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildVisualWordDocument, captureWorksheetPages, VisualWordExportError } from "./worksheet-word-visual";

const render = vi.fn();
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII="), c => c.charCodeAt(0));
const nativeStyle = window.getComputedStyle.bind(window);

beforeEach(() => {
  vi.stubGlobal("getComputedStyle", (element: Element, pseudo?: string) => pseudo
    ? { getPropertyValue: () => "none" }
    : nativeStyle(element));
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
  vi.stubGlobal("fetch", render);
  render.mockResolvedValue({
    ok: true, headers: new Headers({ "Content-Type": "image/png" }),
    arrayBuffer: async () => png.buffer,
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  render.mockReset();
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
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(794);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1123);
    const root = document.createElement("div");
    root.id = "ws-printable-root";
    root.setAttribute("data-responsive-preview", "");
    root.style.setProperty("--ws-preview-scale", "0.45");
    root.innerHTML = `<article data-worksheet-page><div class="ws-q-selected"><span contenteditable="true">سؤال</span><button class="no-print">حذف</button></div></article><article data-answer-key-page>الإجابة</article>`;
    document.body.appendChild(root);
    const progress = vi.fn();
    const pages = await captureWorksheetPages(root, 987, progress);
    expect(pages).toHaveLength(2);
    expect(render.mock.calls[0][0]).toBe("/api/worksheets/987/render-page");
    const payload = JSON.parse(render.mock.calls[0][1].body);
    expect(payload).toMatchObject({ width: 794, height: 1123 });
    expect(payload.html).not.toContain("no-print");
    expect(payload.html).not.toContain("contenteditable");
    expect(payload.html).toContain("zoom: 1");
    expect(payload.html).toContain("سؤال");
    expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    expect(root.querySelector(".no-print")).not.toBeNull();
    expect(root.querySelector("[contenteditable]")).not.toBeNull();
    expect(root.style.getPropertyValue("--ws-preview-scale")).toBe("0.45");
    expect(document.body.children).toHaveLength(1);
  });

  it("does not download a partial document when a capture fails, and cleans up the frozen copy", async () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 1; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 794, height: 1123 } as DOMRect);
    const root = document.createElement("div");
    root.innerHTML = "<article data-worksheet-page>سؤال</article>";
    document.body.appendChild(root);
    render.mockRejectedValue(new Error("renderer unavailable"));
    await expect(captureWorksheetPages(root, 987)).rejects.toBeInstanceOf(VisualWordExportError);
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
    await expect(captureWorksheetPages(root, 987)).rejects.toMatchObject({ code: "image" });
    expect(root.querySelector("img")?.getAttribute("loading")).toBe("lazy");
    expect(document.body.children).toHaveLength(1);
  });

  it("reports a busy renderer explicitly instead of switching to corrupted canvas output", async () => {
    render.mockResolvedValue({ ok: false, status: 429 });
    const root = document.createElement("div");
    root.innerHTML = "<article data-worksheet-page>غزوة بدر</article>";
    await expect(captureWorksheetPages(root, 987)).rejects.toMatchObject({ code: "busy" });
  });

  it("rejects missing authorization context before making a renderer request", async () => {
    await expect(captureWorksheetPages(document.createElement("div"), 0)).rejects.toMatchObject({ code: "pages" });
    expect(render).not.toHaveBeenCalled();
  });
});