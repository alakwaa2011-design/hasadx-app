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

  it("keeps equations and signed choices LTR inside an Arabic Word document", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <div class="ws-q-prompt">
          <span dir="ltr">(+20) - (+14)</span>
        </div>
        <ol class="ws-mcq" data-choice-columns="2">
          <li><span dir="rtl"><span>(أ) </span><span dir="ltr">+6</span></span></li>
          <li><span dir="rtl"><span>(ب) </span><span dir="ltr">-34</span></span></li>
        </ol>
      </div>`;

    const wordDocument = buildWordDocument({
      element: root,
      title: "ورقة الأعداد الصحيحة",
      lang: "ar",
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(wordDocument));
    const xml = await zip.file("word/document.xml")!.async("string");

    const equationParagraph = xml.match(/<w:p>.*?\(\+20\) - \(\+14\).*?<\/w:p>/)?.[0];
    expect(equationParagraph).toBeDefined();
    expect(equationParagraph).toContain('<w:bidi w:val="false"/>');
    expect(equationParagraph).not.toContain("<w:rtl/>");
    expect(equationParagraph).toContain("(+20) - (+14)");

    for (const [label, option] of [["(أ) ", "+6"], ["(ب) ", "-34"]]) {
      const choiceParagraph = xml.match(/<w:p>.*?<\/w:p>/g)
        ?.find(paragraph => paragraph.includes(label) && paragraph.includes(option));
      expect(choiceParagraph).toBeDefined();
      expect(choiceParagraph).toContain("<w:bidi");
      expect(choiceParagraph!.indexOf(label)).toBeLessThan(choiceParagraph!.indexOf(option));
      const runs = choiceParagraph!.match(/<w:r>.*?<\/w:r>/g) ?? [];
      expect(runs.find(run => run.includes(label))).toContain("<w:rtl/>");
      expect(runs.find(run => run.includes(option))).toContain('<w:rtl w:val="false"/>');
    }
  });

  it("keeps an answer-key equation LTR inside its Arabic answer paragraph", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page data-answer-key-page dir="rtl">
        <div class="ws-answer-line">
          <strong dir="rtl">الإجابة:</strong>
          <span dir="ltr">(-12) + (+7) = -5</span>
        </div>
      </div>`;

    const wordDocument = buildWordDocument({
      element: root,
      title: "مفتاح إجابة الأعداد الصحيحة",
      lang: "ar",
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(wordDocument));
    const xml = await zip.file("word/document.xml")!.async("string");

    const answerParagraph = xml.match(/<w:p>.*?الإجابة:.*?\(-12\) \+ \(\+7\) = -5.*?<\/w:p>/)?.[0];
    expect(answerParagraph).toBeDefined();
    expect(answerParagraph).toContain("<w:bidi");
    const runs = answerParagraph!.match(/<w:r>.*?<\/w:r>/g) ?? [];
    expect(runs.find(run => run.includes("الإجابة:"))).toContain("<w:rtl/>");
    expect(runs.find(run => run.includes("(-12) + (+7) = -5"))).toContain('<w:rtl w:val="false"/>');
    expect(answerParagraph!.indexOf("(-12) + (+7) = -5")).toBeGreaterThan(answerParagraph!.indexOf("الإجابة:"));
  });

  it("exports matching lists as a native RTL two-column table while keeping signed values LTR", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <div class="ws-match" data-matching-left-share="0.55" data-matching-right-share="0.45">
          <ul class="ws-match-col">
            <li class="ws-match-pair">
              <span class="ws-match-bullet ws-match-num" dir="rtl">١.</span>
              <span class="ws-match-text" dir="rtl">
                <span>درجة الحرارة </span><span dir="ltr">-8°C</span>
              </span>
            </li>
            <li class="ws-match-pair"><span dir="rtl">٢. الماء</span></li>
          </ul>
          <div class="ws-match-divider"></div>
          <ul class="ws-match-col">
            <li class="ws-match-pair"><span dir="rtl">(أ) بارد</span></li>
            <li class="ws-match-pair"><span dir="rtl">(ب) سائل</span></li>
          </ul>
        </div>
      </div>`;

    const wordDocument = buildWordDocument({
      element: root,
      title: "سؤال توصيل عربي",
      lang: "ar",
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(wordDocument));
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml.match(/<w:tbl>/g)).toHaveLength(1);
    expect(xml.match(/<w:tr>/g)).toHaveLength(2);
    expect(xml.match(/<w:tc>/g)).toHaveLength(4);
    expect(xml).toContain("<w:bidiVisual/>");
    expect(xml.indexOf("١.")).toBeLessThan(xml.indexOf("(أ) بارد"));
    expect(xml.indexOf("٢. الماء")).toBeLessThan(xml.indexOf("(ب) سائل"));

    const pairParagraph = xml.match(/<w:p>.*?درجة الحرارة.*?-8°C.*?<\/w:p>/)?.[0];
    expect(pairParagraph).toBeDefined();
    expect(pairParagraph).toContain("<w:bidi");
    const runs = pairParagraph!.match(/<w:r>.*?<\/w:r>/g) ?? [];
    expect(runs.find(run => run.includes("درجة الحرارة"))).toContain("<w:rtl/>");
    expect(runs.find(run => run.includes("-8°C"))).toContain('<w:rtl w:val="false"/>');
    expect(pairParagraph!.indexOf("درجة الحرارة")).toBeLessThan(pairParagraph!.indexOf("-8°C"));
  });
});