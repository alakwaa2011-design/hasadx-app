/**
 * Format coverage for the shared source-upload pipeline
 * (`processUploadedFiles`) used by worksheet / lesson-plan / activity
 * question extraction:
 *  - supported: images (JPG/PNG/WEBP/GIF), PDF (text), DOCX, PPTX, TXT/MD
 *  - rejected with a clear message: legacy DOC/PPT, XLS/XLSX, HEIC, ZIP
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { processUploadedFiles } from "../lib/file-upload";

/* ── Minimal express req/res doubles ─────────────────────────────── */
function makeReq() {
  return {
    tierLimits: { isAdmin: false, maxFiles: 5, maxBytes: 50 * 1024 * 1024 },
    log: { warn: () => {}, error: () => {} },
  } as any;
}
function makeRes() {
  const res: any = {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res;
}
function file(name: string, buffer: Buffer, mimetype: string) {
  return { originalname: name, buffer, size: buffer.length, mimetype } as any;
}

/* ── Fixture builders ────────────────────────────────────────────── */
/** Smallest valid PDF with one text object ("Hello Hasad PDF"). */
function makePdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objs = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n",
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const o of objs) { offsets.push(pdf.length); pdf += o; }
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function makeDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function makePptx(slides: Array<{ title: string; bullets: string[] }>): Promise<Buffer> {
  const zip = new JSZip();
  slides.forEach((s, i) => {
    const bulletXml = s.bullets
      .map(b => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`)
      .join("");
    zip.file(`ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<p:sp ><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${s.title}</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp ><p:txBody>${bulletXml}</p:txBody></p:sp>
</p:sld>`);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

/* ── Supported formats pass through ──────────────────────────────── */
describe("processUploadedFiles — supported formats", () => {
  it("accepts a supported image and returns it for the vision path", async () => {
    const res = makeRes();
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const out = await processUploadedFiles(makeReq(), res, [file("page1.png", png, "image/png")], "ar");
    expect(out).not.toBeNull();
    expect(out!.images).toHaveLength(1);
    expect(out!.images[0].mimeType).toBe("image/png");
  });

  it("normalises image/jpg to image/jpeg", async () => {
    const res = makeRes();
    const out = await processUploadedFiles(makeReq(), res, [file("p.jpg", Buffer.from("ffd8ff", "hex"), "image/jpg")], "ar");
    expect(out!.images[0].mimeType).toBe("image/jpeg");
  });

  it("extracts text from a text-based PDF", async () => {
    const res = makeRes();
    const out = await processUploadedFiles(makeReq(), res, [file("lesson.pdf", makePdf("Hello Hasad PDF"), "application/pdf")], "ar");
    expect(out).not.toBeNull();
    expect(out!.text).toContain("Hello Hasad PDF");
  });

  it("extracts text from a DOCX", async () => {
    const res = makeRes();
    const docx = await makeDocx("درس الكسور العشرية");
    const out = await processUploadedFiles(makeReq(), res, [file("lesson.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")], "ar");
    expect(out).not.toBeNull();
    expect(out!.text).toContain("درس الكسور العشرية");
  });

  it("extracts slide text from a PPTX via the existing parser", async () => {
    const res = makeRes();
    const pptx = await makePptx([
      { title: "الدرس الأول", bullets: ["النقطة الأولى", "النقطة الثانية"] },
      { title: "الدرس الثاني", bullets: ["مراجعة"] },
    ]);
    const out = await processUploadedFiles(makeReq(), res, [file("deck.pptx", pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation")], "ar");
    expect(out).not.toBeNull();
    expect(out!.text).toContain("الدرس الأول");
    expect(out!.text).toContain("النقطة الثانية");
    expect(out!.text).toContain("الدرس الثاني");
  });

  it("treats TXT and MD as raw text", async () => {
    const res = makeRes();
    const out = await processUploadedFiles(makeReq(), res, [
      file("notes.txt", Buffer.from("نص تجريبي للأسئلة"), "text/plain"),
      file("notes.md", Buffer.from("# عنوان\nمحتوى ماركداون"), "text/markdown"),
    ], "ar");
    expect(out).not.toBeNull();
    expect(out!.text).toContain("نص تجريبي للأسئلة");
    expect(out!.text).toContain("محتوى ماركداون");
  });
});

/* ── Unsupported formats are rejected with clear messages ────────── */
describe("processUploadedFiles — rejected formats", () => {
  const cases: Array<[string, string, string]> = [
    ["old.doc", "application/msword", "DOCX"],
    ["old.ppt", "application/vnd.ms-powerpoint", "PPTX"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel"],
    ["sheet.xls", "application/vnd.ms-excel", "Excel"],
    ["archive.zip", "application/zip", "ZIP"],
  ];
  for (const [name, mime, hint] of cases) {
    it(`rejects ${name} with a clear Arabic message`, async () => {
      const res = makeRes();
      const out = await processUploadedFiles(makeReq(), res, [file(name, Buffer.from("x"), mime)], "ar");
      expect(out).toBeNull();
      expect(res.statusCode).toBe(415);
      expect(String(res.body.message)).toContain(hint);
    });
  }

  it("rejects HEIC images", async () => {
    const res = makeRes();
    const out = await processUploadedFiles(makeReq(), res, [file("photo.heic", Buffer.from("x"), "image/heic")], "ar");
    expect(out).toBeNull();
    expect(res.statusCode).toBe(415);
  });

  it("returns an actionable error when a PDF cannot be read", async () => {
    const res = makeRes();
    const out = await processUploadedFiles(makeReq(), res, [file("broken.pdf", Buffer.from("not a pdf"), "application/pdf")], "ar");
    expect(out).toBeNull();
    expect(res.statusCode).toBe(422);
    expect(String(res.body.message)).toContain("ارفع الصفحات كصور");
  });
});
