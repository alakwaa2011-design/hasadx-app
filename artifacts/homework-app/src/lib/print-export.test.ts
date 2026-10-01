import { afterEach, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildWordDocument, downloadAsWord, printToPdf } from "./print-export";

function xmlTableAt(xml: string, start: number): string {
  const tags = /<w:tbl>|<\/w:tbl>/g;
  tags.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(xml))) {
    depth += match[0] === "<w:tbl>" ? 1 : -1;
    if (depth === 0) return xml.slice(start, tags.lastIndex);
  }
  return "";
}

describe("printToPdf", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
  it("omits editing controls even when nested inside an exported paragraph", async () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-worksheet-page><button class="no-print">DELETE-CONTROL</button><div class="ws-q-head"><span class="ws-q-num">١</span><div class="ws-q-prompt">النص المطلوب<span class="no-print">EDIT-CONTROL</span></div></div></div>`;
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({ element: root, title: "Test" })));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("النص المطلوب");
    expect(xml).not.toContain("DELETE-CONTROL");
    expect(xml).not.toContain("EDIT-CONTROL");
  });

  it("creates native OOXML with RTL formatting and a two-column choice table", async () => {
    const root = document.createElement("div");
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
    const stylesXml = await zip.file("word/styles.xml")!.async("string");
    expect(xml).toContain("<w:document");
    expect(xml).toContain("<w:bidi");
    expect(xml).toContain("<w:rtl");
    expect(xml).toContain("<w:bidiVisual/>");
    expect(xml).toContain("<w:sz w:val=\"28\"");
    expect(xml).toContain("<w:szCs w:val=\"28\"");
    expect(xml).toContain("<w:b");
    expect(xml).toContain("<w:jc w:val=\"center\"");
    expect(stylesXml).toContain('w:ascii="Arial"');
    expect(stylesXml).toContain('w:cs="Cairo"');
    expect(stylesXml).toContain('<w:szCs w:val="24"/>');
    expect(xml.match(/<w:tr>/g)).toHaveLength(2);
    expect(xml.match(/<w:tc>/g)).toHaveLength(4);
    for (const text of ["١", "السؤال الأول", "الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"]) {
      expect(xml).toContain(text);
    }
  });

  it("keeps Arabic question and section paragraphs physically right-aligned and fields in one editable row", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <div class="ws-q-head">
          <span class="ws-q-num">1</span>
          <div class="ws-q-prompt">السؤال الأول</div>
        </div>
        <div class="ws-section-instr">اختر الإجابة الصحيحة:</div>
        <div class="ws-fields">
          <div class="ws-field-line"><span class="ws-field-label">الاسم:</span></div>
          <div class="ws-field-line short"><span class="ws-field-label">الصف:</span></div>
          <div class="ws-field-line short"><span class="ws-field-label">التاريخ:</span></div>
        </div>
        <ol class="ws-mcq" data-choice-columns="1">
          <li><span class="ws-mcq-letter">(أ)</span><span class="ws-mcq-text">اختيار أول</span></li>
        </ol>
        <div class="ws-cont-header">
          <span class="ws-cont-title">متابعة الورقة</span>
          <span class="ws-cont-page">صفحة ٢</span>
        </div>
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: "تخطيط RTL",
      lang: "ar",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");

    for (const text of ["السؤال الأول", "اختر الإجابة الصحيحة:"]) {
      const paragraph = xml.match(new RegExp(`<w:p>.*?${text}.*?</w:p>`))?.[0];
      expect(paragraph).toBeDefined();
      expect(paragraph).toContain("<w:bidi/>");
      // Word resolves START to the paragraph's leading edge; with w:bidi that
      // is the physical right edge, avoiding Mac Word's mirrored RIGHT case.
      expect(paragraph).toContain('<w:jc w:val="start"/>');
    }

    const tables = xml.match(/<w:tbl>.*?<\/w:tbl>/g) ?? [];
    expect(tables).toHaveLength(3);
    const fieldsTableXml = tables[0];
    expect(fieldsTableXml.match(/<w:tr>/g)).toHaveLength(1);
    expect(fieldsTableXml.match(/<w:tc>/g)).toHaveLength(3);
    expect(fieldsTableXml).toContain('w:w="47%"');
    expect(fieldsTableXml).toContain('w:w="25%"');
    expect(fieldsTableXml).toContain('w:w="28%"');
    for (const label of ["الاسم:", "الصف:", "التاريخ:"]) {
      expect(fieldsTableXml).toContain(label);
      expect(fieldsTableXml).toContain("________");
    }

    const choiceParagraph = xml.match(/<w:p>.*?\(أ\).*?اختيار أول.*?<\/w:p>/)?.[0];
    expect(choiceParagraph).toBeDefined();
    expect(choiceParagraph).toContain('<w:t xml:space="preserve"> </w:t>');
    expect(tables[2].match(/<w:tr>/g)).toHaveLength(1);
    expect(tables[2].match(/<w:tc>/g)).toHaveLength(2);
    expect(tables[2]).toContain("متابعة الورقة");
    expect(tables[2]).toContain("صفحة ٢");
  });

  it.each([
    {
      lang: "ar" as const,
      dir: "rtl",
      label: "(أ)",
      option: "اختيار أول",
      sectionSide: "right",
      paragraphAlign: "start",
    },
    {
      lang: "en" as const,
      dir: "ltr",
      label: "(A)",
      option: "First choice",
      sectionSide: "left",
      paragraphAlign: "left",
    },
  ])("preserves $lang option direction and computed editable boxes", async ({
    lang, dir, label, option, sectionSide, paragraphAlign,
  }) => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="${dir}" style="background-color: #fbf7ea;">
        <div class="ws-q" style="background-color: rgba(100, 150, 200, 0.25); border: 2px solid #123456; border-radius: 8px; padding: 5px 7px;">
          <div class="ws-q-head">
            <span class="ws-q-num">1</span>
            <div class="ws-q-prompt">${lang === "ar" ? "السؤال الأول" : "Question one"}</div>
          </div>
          <div class="ws-section-instr" style="background-color: #fff4cc; border-${sectionSide}: 3px dashed #aa5500; border-radius: 4px; padding: 4px 6px;">
            ${lang === "ar" ? "اختر إجابة:" : "Choose an answer:"}
          </div>
          <ol class="ws-mcq" data-choice-columns="1">
            <li style="background-color: #eef7ff; border: 2px dotted #13579b; border-radius: 6px; padding: 3px 5px;">
              <span class="ws-mcq-letter">${label}</span><span class="ws-mcq-text">${option}</span>
            </li>
          </ol>
          <div class="ws-lines"><span class="ws-line" style="background-color: #f5f0e8; border-bottom: 2px dashed #654321; border-radius: 4px;"></span></div>
        </div>
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: `${lang} boxes`,
      lang,
    })));
    const xml = await zip.file("word/document.xml")!.async("string");
    const choiceParagraph = xml.match(new RegExp(`<w:p>.*?${label}.*?${option}.*?</w:p>`))?.[0];
    const question = lang === "ar" ? "السؤال الأول" : "Question one";
    const section = lang === "ar" ? "اختر إجابة:" : "Choose an answer:";
    const sectionParagraph = xml.match(new RegExp(`<w:p>.*?${section}.*?</w:p>`))?.[0];
    const questionTable = xmlTableAt(xml, xml.indexOf("<w:tbl>"));
    const questionCellProperties = questionTable.match(/<w:tcPr>.*?<\/w:tcPr>/)?.[0];
    const choiceTableStart = questionTable.indexOf("<w:tbl>", 1);
    const choiceTable = xmlTableAt(questionTable, choiceTableStart);
    const writingParagraph = xml.match(/<w:p>.*?<w:shd w:fill="F5F0E8".*?<\/w:p>/)?.[0];

    expect(choiceParagraph).toBeDefined();
    expect(choiceParagraph).toContain(`<w:jc w:val="${paragraphAlign}"/>`);
    expect(questionTable).toContain(question);
    expect(questionTable).toContain(section);
    expect(questionTable).toContain(option);
    expect(questionTable).toContain("F5F0E8");
    expect(questionCellProperties).toContain('<w:shd w:fill="D5DFE2"');
    expect(questionCellProperties).toContain('<w:top w:val="single" w:color="123456" w:sz="12"/>');
    expect(questionCellProperties).toContain('<w:left w:val="single" w:color="123456" w:sz="12"/>');
    expect(questionCellProperties).toContain('<w:right w:val="single" w:color="123456" w:sz="12"/>');
    expect(questionCellProperties).toContain('<w:bottom w:val="single" w:color="123456" w:sz="12"/>');
    expect(xml).toContain('<w:background w:color="FBF7EA"/>');
    expect(sectionParagraph).toContain('<w:shd w:fill="FFF4CC"');
    expect(sectionParagraph).toContain(`<w:${sectionSide} w:val="dashed" w:color="AA5500" w:sz="18"/>`);
    expect(choiceTable).toContain('<w:shd w:fill="EEF7FF"');
    expect(choiceTable).toContain('<w:top w:val="dotted" w:color="13579B" w:sz="12"/>');
    expect(choiceTable).toContain('<w:left w:val="dotted" w:color="13579B" w:sz="12"/>');
    expect(choiceTable).toContain('<w:right w:val="dotted" w:color="13579B" w:sz="12"/>');
    expect(choiceTable).toContain('<w:bottom w:val="dotted" w:color="13579B" w:sz="12"/>');
    expect(writingParagraph).toContain('<w:bottom w:val="dashed" w:color="654321" w:sz="12"/>');
    expect(writingParagraph).toContain('<w:shd w:fill="F5F0E8"');
    if (lang === "ar") {
      expect(choiceParagraph).toContain("<w:bidi/>");
      expect(xml).toContain("<w:bidiVisual/>");
    } else {
      expect(choiceParagraph).not.toContain("<w:bidi/>");
      expect(choiceParagraph).toContain('<w:bidi w:val="false"/>');
      expect(choiceParagraph).not.toContain("<w:rtl/>");
    }
  });

  it.each([
    ["arabesque", "ws-arb-fields"],
    ["modern band", "ws-band-fields"],
    ["playful", "ws-play-fields"],
    ["clipboard", "ws-clip-fields"],
    ["masthead", "ws-mast-fields"],
    ["tabular", ""],
  ])("keeps %s theme student fields horizontal in the actual Word layout", async (_, fieldClass) => {
    const root = document.createElement("div");
    root.innerHTML = `<article data-worksheet-page dir="rtl">
      <div class="${fieldClass ? "ws-theme-header" : "ws-tab-header"}">
        <div class="${fieldClass}" style="display:grid">
          <div style="color:#3b0f3f">الاسم<span></span></div>
          <div style="color:#3b0f3f">الصف<span></span></div>
          <div style="color:#3b0f3f">التاريخ<span></span></div>
        </div>
      </div>
    </article>`;
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root, title: "حقول الطالب", lang: "ar",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");
    const fields = (xml.match(/<w:tbl>.*?<\/w:tbl>/g) ?? []).find(table =>
      table.includes("الاسم") && table.includes("الصف") && table.includes("التاريخ"));
    expect(fields).toBeDefined();
    expect(fields?.match(/<w:tr>/g)).toHaveLength(1);
    expect(fields?.match(/<w:tc>/g)).toHaveLength(3);
    expect(fields).toContain("________");
  });

  it("embeds available data-URL images as editable-document media rather than replacing them with alt text", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page>
        <img alt="School logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC">
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: "Image export",
      lang: "en",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");
    const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith("word/media/") && !path.endsWith("/"));

    expect(mediaFiles).toHaveLength(1);
    expect(xml).toContain("<w:drawing>");
    expect(xml).not.toContain("<w:t>School logo</w:t>");
  });

  it("preserves editable formatting and content across all worksheet question types", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <h1 style="color: #123456">عنوان الورقة</h1>
        <h2>بيانات المدرسة</h2>
        <div class="ws-school-cell"><span>المدرسة</span><span>مدرسة النور</span></div>
        <div class="ws-q-head">
          <span class="ws-q-num">١</span>
          <div class="ws-q-prompt">سؤال <span style="color: rgb(12, 34, 56); text-decoration: underline; background-color: #ffff00">منسق</span></div>
        </div>
        <ol class="ws-mcq" data-choice-columns="2"><li>اختيار ألف</li><li>اختيار باء</li></ol>
        <div class="ws-tf-choices">
          <span class="ws-tf-choice"><span class="ws-tf-box" aria-hidden="true"></span>صح</span>
          <span class="ws-tf-choice"><span class="ws-tf-box" aria-hidden="true"></span>خطأ</span>
        </div>
        <div class="ws-lines"><span class="ws-line"></span><span class="ws-line"></span></div>
        <div class="ws-fill"><span class="ws-fill-rule"></span></div>
        <div class="ws-match">
          <ul class="ws-match-col">
            <li class="ws-match-pair"><span dir="rtl">١. </span><span dir="ltr">-8°C</span></li>
          </ul>
          <div class="ws-match-divider"></div>
          <ul class="ws-match-col"><li class="ws-match-pair"><span>بارد</span></li></ul>
        </div>
        <div class="ws-tic-board">
          <div class="ws-tic-cell"><span class="ws-tic-text">مهمة اللوحة ١</span><span class="ws-tic-writing"><span></span></span></div>
          <div class="ws-tic-cell"><span class="ws-tic-text">مهمة اللوحة ٢</span></div>
          <div class="ws-tic-cell"><span class="ws-tic-text">مهمة اللوحة ٣</span></div>
        </div>
        <div class="ws-worked-problem"><div class="ws-response-label">خطوات الحل</div><div class="ws-work-step"><span class="ws-work-step-num">١</span><span class="ws-work-step-line"></span></div><div class="ws-final-answer"><strong>الإجابة النهائية</strong><span></span></div></div>
        <div class="ws-extended-response"><span class="ws-line"></span></div>
        <div class="ws-error-correction">
          <div class="ws-incorrect-box"><strong>النص غير الصحيح:</strong><span>٢ + ٢ = ٥</span></div>
          <div class="ws-correction-area"><div class="ws-response-label">التصحيح</div><span class="ws-line"></span></div>
          <div class="ws-explanation-area"><div class="ws-response-label">التفسير</div><span class="ws-line"></span></div>
        </div>
        <div class="ws-word-bank"><strong>بنك الكلمات</strong><div><span>ماء</span><span>هواء</span></div></div>
        <div class="ws-compare-organizer">
          <div class="ws-compare-panel"><strong>العنصر أ</strong><span class="ws-compare-subtitle">الاختلافات</span><span class="ws-compare-line"></span></div>
          <div class="ws-compare-panel ws-compare-similarities"><strong>أوجه الشبه</strong><span class="ws-compare-line"></span></div>
          <div class="ws-compare-panel"><strong>العنصر ب</strong><span class="ws-compare-subtitle">الاختلافات</span></div>
        </div>
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: "اختبار التغطية",
      lang: "ar",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:color w:val="0C2238"/>');
    expect(xml).toContain("<w:u w:val=\"single\"/>");
    expect(xml).toContain('<w:shd w:fill="FFFF00"');
    expect(xml).toContain("<w:bidiVisual/>");
    for (const text of [
      "عنوان الورقة", "مدرسة النور", "اختيار ألف", "اختيار باء", "صح", "خطأ",
      "-8°C", "بارد", "مهمة اللوحة ١", "مهمة اللوحة ٢", "مهمة اللوحة ٣",
      "خطوات الحل", "الإجابة النهائية", "النص غير الصحيح:", "٢ + ٢ = ٥", "التصحيح",
      "التفسير", "بنك الكلمات", "ماء", "هواء", "العنصر أ", "أوجه الشبه", "العنصر ب",
    ]) {
      expect(xml).toContain(text);
    }
    expect(xml.match(/<w:tbl>/g)).toHaveLength(5);
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

  it("exports supported LaTeX as editable Word equations and preserves unsupported source", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <div class="ws-q-prompt">
          <span>احسب </span>
          <span dir="ltr" data-math-latex="\\frac{x^{2}}{\\sqrt{y}}">rendered fraction</span>
          <span> ثم </span>
          <span dir="ltr" data-math-latex="\\sum_{i=1}^{n} i">unsupported sum</span>
        </div>
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: "معادلات قابلة للتحرير",
      lang: "ar",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");

    expect(xml).toContain("<m:oMath>");
    expect(xml).toContain("<m:f>");
    expect(xml).toContain("<m:sSup>");
    expect(xml).toContain("<m:rad>");
    expect(xml).toContain("\\sum_{i=1}^{n} i");
    expect(xml).not.toContain("rendered fraction");
    expect(xml).not.toContain("unsupported sum");
    const math = xml.match(/<m:oMath>.*?<\/m:oMath>/)?.[0];
    expect(math).toContain("<m:t>x</m:t>");
    expect(math).toContain("<m:t>2</m:t>");
    expect(math).toContain("<m:t>y</m:t>");
    expect(math).not.toContain("<w:rtl");
  });

  it("binds each power to its immediate base without absorbing operators or earlier terms", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-worksheet-page>
        <div class="ws-q-prompt">
          <span data-math-latex="a^2+b^2=c^2">rendered</span>
          <span data-math-latex="x+1^2">rendered</span>
          <span data-math-latex="\\frac{x^2}{\\sqrt{y^3}}">rendered</span>
        </div>
      </div>`;

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument({
      element: root,
      title: "Power structure",
      lang: "ar",
    })));
    const xml = await zip.file("word/document.xml")!.async("string");
    const equations = xml.match(/<m:oMath>.*?<\/m:oMath>/g) ?? [];

    expect(equations).toHaveLength(3);
    const powers = equations[0].match(/<m:sSup>.*?<\/m:sSup>/g) ?? [];
    expect(powers).toHaveLength(3);
    expect(powers.map(power => power.match(/<m:e>.*?<m:t>(.*?)<\/m:t>.*?<\/m:e>/)?.[1]))
      .toEqual(["a", "b", "c"]);
    expect(equations[0]).toMatch(/<\/m:sSup><m:r><m:t>\+<\/m:t><\/m:r><m:sSup>/);
    expect(equations[0]).toMatch(/<\/m:sSup><m:r><m:t>=<\/m:t><\/m:r><m:sSup>/);

    const finalPower = equations[1].match(/<m:sSup>.*?<\/m:sSup>/)?.[0];
    expect(finalPower).toContain("<m:e><m:r><m:t>1</m:t></m:r></m:e>");
    expect(equations[1]).toMatch(/<m:t>x<\/m:t>.*?<m:t>\+<\/m:t>.*?<m:sSup>/);

    expect(equations[2]).toMatch(
      /<m:f>.*?<m:num>.*?<m:sSup>.*?<m:t>x<\/m:t>.*?<m:t>2<\/m:t>.*?<\/m:sSup>.*?<\/m:num>.*?<m:den>.*?<m:rad>.*?<m:sSup>.*?<m:t>y<\/m:t>.*?<m:t>3<\/m:t>.*?<\/m:sSup>.*?<\/m:rad>.*?<\/m:den>.*?<\/m:f>/,
    );
  });
});

describe("downloadAsWord", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.querySelectorAll("[data-word-test-style]").forEach(style => style.remove());
    document.body.querySelectorAll("[data-word-test-source]").forEach(element => element.remove());
  });

  it("builds from a connected offscreen clone so stylesheet-only formatting is retained, and always removes it", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:worksheet-export"),
      revokeObjectURL: vi.fn(),
    });
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler, timeout, ...args) => {
      if (timeout === 1500) return 0 as ReturnType<typeof setTimeout>;
      return realSetTimeout(handler, timeout, ...args);
    }) as typeof setTimeout);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const style = document.createElement("style");
    style.dataset.wordTestStyle = "true";
    style.textContent = `
      .print-host[data-responsive-preview] { width: 100%; min-width: 0; max-width: 100%; overflow-x: clip; }
      .print-host[data-responsive-preview] .ws-title {
        color: rgb(128, 0, 128); font-family: Arial; font-size: 24pt; text-align: center;
      }
      .print-host[data-responsive-preview] .ws-section-instr {
        border-right: 4px solid rgb(12, 34, 56); font-size: 18pt;
      }`;
    document.head.appendChild(style);

    const source = document.createElement("div");
    source.dataset.wordTestSource = "true";
    source.className = "print-host";
    source.setAttribute("data-responsive-preview", "");
    source.innerHTML = `
      <div data-worksheet-page dir="rtl">
        <h1 class="ws-title">Purple title</h1>
        <div class="ws-section-instr">تعليمات</div>
      </div>`;
    document.body.appendChild(source);

    let packedBlob: Blob | undefined;
    let rejectPacking = false;
    vi.spyOn(Packer, "toBlob").mockImplementation(async wordDocument => {
      const stagingRoot = document.querySelector<HTMLElement>("[data-word-export-staging]");
      expect(stagingRoot).not.toBeNull();
      expect(stagingRoot!.isConnected).toBe(true);
      expect(stagingRoot!.style.position).toBe("fixed");
      expect(stagingRoot!.style.width).toBe("810px");
      expect(stagingRoot!.style.minWidth).toBe("810px");
      expect(stagingRoot!.style.maxWidth).toBe("none");
      expect(stagingRoot!.style.overflow).toBe("visible");
      expect(stagingRoot!.style.pointerEvents).toBe("none");
      expect(stagingRoot!.style.getPropertyValue("--ws-preview-scale")).toBe("1");
      const title = stagingRoot!.querySelector(".ws-title")!;
      expect(window.getComputedStyle(title).color).toBe("rgb(128, 0, 128)");
      expect(window.getComputedStyle(title).textAlign).toBe("center");
      const bytes = await Packer.toBuffer(wordDocument);
      if (rejectPacking) throw new Error("Packer failed");
      packedBlob = new Blob([bytes]);
      return packedBlob;
    });

    await downloadAsWord({ element: source, title: "Connected formatting", lang: "ar" });
    expect(document.querySelector("[data-word-export-staging]")).toBeNull();
    const zip = await JSZip.loadAsync(packedBlob!);
    const xml = await zip.file("word/document.xml")!.async("string");
    const heading = xml.match(/<w:p>.*?Purple title.*?<\/w:p>/)?.[0];
    const instruction = xml.match(/<w:p>.*?تعليمات.*?<\/w:p>/)?.[0];
    expect(heading).toContain('<w:color w:val="800080"/>');
    expect(heading).toContain('<w:sz w:val="48"/>');
    expect(heading).toContain('<w:jc w:val="center"/>');
    expect(instruction).toContain('<w:sz w:val="36"/>');
    expect(instruction).toContain('<w:right w:val="single" w:color="0C2238"');

    rejectPacking = true;
    await expect(downloadAsWord({ element: source, title: "Failed formatting", lang: "ar" }))
      .rejects.toThrow("Packer failed");
    expect(document.querySelector("[data-word-export-staging]")).toBeNull();
  });
});
