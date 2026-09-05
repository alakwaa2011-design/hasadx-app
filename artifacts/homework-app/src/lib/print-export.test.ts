import { afterEach, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildWordDocument, printToPdf } from "./print-export";

describe("printToPdf", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for a stable worksheet layout and uses its title as the PDF filename", async () => {
    document.title = "منصة حصاد";
    let titleAtPrint = "";
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "print").mockImplementation(() => {
      titleAtPrint = document.title;
    });

    await printToPdf("ورقة الكسور / الصف الخامس");

    expect(titleAtPrint).toBe("ورقة الكسور - الصف الخامس");
    window.dispatchEvent(new Event("afterprint"));
    expect(document.title).toBe("منصة حصاد");
  });

  it("coalesces repeated PDF clicks while the layout is still preparing", async () => {
    let resolveFrame: (() => void) | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      resolveFrame = () => callback(0);
      return 1;
    });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    const first = printToPdf("الأولى");
    const second = printToPdf("الثانية");
    expect(first).toBe(second);
    for (let index = 0; index < 4; index += 1) {
      resolveFrame?.();
      await Promise.resolve();
    }
    await first;
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("buildWordDocument", () => {
  it("creates native OOXML with RTL formatting and a two-column choice table", async () => {
    const root = document.createElement("div");
    root.id = "ws-printable-root";
    root.innerHTML = `
      <div data-worksheet-page>
        <div class="ws-q-head">
          <span class="ws-q-num">١</span>
          <div class="ws-q-prompt"><span style="font-size: 14pt; font-weight: 800; text-align: center;">السؤال الأول</span></div>
        </div>
        <ol class="ws-mcq" data-choice-columns="2" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <li>الخيار الأول</li><li>الخيار الثاني</li><li>الخيار الثالث</li><li>الخيار الرابع</li>
        </ol>
      </div>`;

    const wordDocument = buildWordDocument({
      element: root,
      title: "ورقة عربية",
      lang: "ar",
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(wordDocument));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("<w:document");
    expect(xml).toContain("<w:bidi");
    expect(xml).toContain("<w:rtl");
    expect(xml).toContain("<w:sz w:val=\"28\"");
    expect(xml).toContain("<w:b");
    expect(xml).toContain("<w:jc w:val=\"center\"");
    expect(xml.match(/<w:tr>/g)).toHaveLength(2);
    expect(xml.match(/<w:tc>/g)).toHaveLength(4);
    for (const text of ["١", "السؤال الأول", "الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"]) {
      expect(xml).toContain(text);
    }
  });
});