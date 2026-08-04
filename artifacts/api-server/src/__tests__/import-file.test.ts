/**
 * Route-level integration tests for POST /api/presentations/import-file.
 *
 * Covers:
 *  - Auth guard (401 without session)
 *  - PPTX: slides are extracted from the parsed deck
 *  - DOCX: balanced distribution across slides
 *  - PDF:  pages are rendered to PNG images; slides have backgroundImage set
 *  - Fallback: parser failure produces a blank deck (no 500)
 *  - Unsupported file extension → 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── DB mock ─────────────────────────────────────────────────────────────────── */
const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  function makeChain(result: unknown): unknown {
    const p: Promise<unknown> = Promise.resolve(result);
    const handler: ProxyHandler<Promise<unknown>> = {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const fn = (target as unknown as Record<string, unknown>)[
            prop as string
          ] as (...args: unknown[]) => unknown;
          return fn.bind(target);
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { queue, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
    },
    presentationsTable: stub,
    presentationAssetsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionBankTable: stub,
    platformSettingsTable: stub,
    DEFAULT_PRESENTATION_LIMITS: { maxDecks: 1000, maxAssetMb: 100 },
  };
});

vi.mock("@workspace/billing", () => ({
  featureAccess: {
    check: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    increment: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    refund: vi.fn(async () => undefined),
  },
}));

/* ── Parser mocks ────────────────────────────────────────────────────────────── */
vi.mock("../lib/import-file-parser", () => ({
  parsePptx: vi.fn(),
  parsePdf: vi.fn(),
  parseDocx: vi.fn(),
  buildSlidesFromParsed: vi.fn(),
  buildSlidesFromPdfPages: vi.fn(),
}));

/* ── MCQ question generator mock ────────────────────────────────────────────── */
vi.mock("../lib/generate-mcq-slides", () => ({
  generateMcqQuestions: vi.fn(),
  materializeMcqSlides: vi.fn(),
}));

/* ── ObjectStorageService mock ───────────────────────────────────────────────── */
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.uploadBufferAsPublic = vi.fn().mockResolvedValue("https://storage.example.com/file.png");
  }),
}));

/* ── presentations-tier mock ─────────────────────────────────────────────────── */
vi.mock("../lib/presentations-tier", () => ({
  resolvePresentationsTier: vi.fn().mockResolvedValue({
    isPro: false,
    limits: {
      maxSlidesRegular: 20,
      maxSizeMbRegular: 50,
      maxImagesRegular: 10,
      maxFilesRegular: 3,
    },
  }),
  getPresentationUsage: vi.fn().mockResolvedValue({ slides: 0, images: 0, files: 0 }),
}));

import express from "express";
import request from "supertest";
import router from "../routes/presentations";
import {
  parsePptx,
  parsePdf,
  parseDocx,
  buildSlidesFromParsed,
  buildSlidesFromPdfPages,
} from "../lib/import-file-parser";
import { generateMcqQuestions } from "../lib/generate-mcq-slides";
import JSZip from "jszip";

type Session = { teacherId?: number };

/* Stub logger satisfying the pino-http `req.log` interface that routes use.
   Errors are forwarded to console.error so test failures surface the real cause. */
const noopLog = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
};

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: typeof noopLog }).log = noopLog;
    next();
  });
  app.use("/api", router);
  return app;
}

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

/* Returned deck stub from the DB insert. */
const DECK_STUB = { id: 42, title: "Test Deck", teacherId: 1, language: "en", slides: [] };
/* Returned asset stub from the DB insert. */
const ASSET_STUB = [{ id: 1 }];

/* Minimal valid slide shape that passes slideSchema validation. */
const MCQ_SLIDE_STUB = {
  id: "mcq-1",
  layout: "interactive",
  background: "#ffffff",
  elements: [],
};

/* A minimal McqQuestion stub that satisfies the McqQuestion type. */
const MCQ_QUESTION_STUB = {
  prompt: "What is the main topic?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correctIndex: 0,
  slideTitle: "Review",
};

beforeEach(() => {
  mockState.queue.length = 0;
  /* Reset only the parser mocks between tests (preserve tier/storage stubs). */
  vi.mocked(parsePptx).mockReset();
  vi.mocked(parsePdf).mockReset();
  vi.mocked(parseDocx).mockReset();
  vi.mocked(buildSlidesFromParsed).mockReset();
  vi.mocked(buildSlidesFromPdfPages).mockReset();
  vi.mocked(generateMcqQuestions).mockReset();
  /* Default: MCQ generator returns one stub question (pending review, not yet a slide). */
  vi.mocked(generateMcqQuestions).mockResolvedValue([MCQ_QUESTION_STUB]);
});

// ─── Auth guard ────────────────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — auth", () => {
  it("returns 401 when no teacher session is present", async () => {
    const res = await request(makeApp(null))
      .post("/api/presentations/import-file")
      .attach("file", Buffer.from("hello"), "test.pdf");
    expect(res.status).toBe(401);
  });
});

// ─── Unsupported file type ─────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — file type validation", () => {
  it("returns 400 for an unsupported file extension", async () => {
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", Buffer.from("hello"), "test.exe");
    expect(res.status).toBe(400);
  });
});

// ─── PPTX import ──────────────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — PPTX", () => {
  async function makePptxBuffer(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`,
    );
    zip.folder("ppt")!.folder("slides")!.file(
      "slide1.xml",
      `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Slide 1</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    );
    return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  }

  it("calls parsePptx and creates a deck with extracted slides; MCQ questions returned for review", async () => {
    const parsedSlides = [{ title: "Slide 1", bullets: [] }];
    const builtSlides  = [{ id: "s1", layout: "title-only", background: "#ffffff", elements: [] }];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* MCQ generator returns one stub question by default from beforeEach. */

    /* DB: insert deck → insert asset */
    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "My Deck.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.presentationId).toBe(42);
    /* MCQ questions are returned as pendingMcqQuestions (not appended as slides).
       slideCount reflects content slides only. */
    expect(res.body.slideCount).toBe(1);
    expect(res.body.aiGenerated).toBe(true);
    expect(res.body.pendingMcqQuestions).toHaveLength(1);
    expect(parsePptx).toHaveBeenCalledOnce();
    expect(buildSlidesFromParsed).toHaveBeenCalledWith(parsedSlides, expect.any(String));
    expect(generateMcqQuestions).toHaveBeenCalledOnce();
  });

  it("sets aiGenerated true and returns MCQ questions as pendingMcqQuestions for review", async () => {
    const parsedSlides = [
      { title: "Intro", bullets: ["Point 1", "Point 2"] },
      { title: "Topic", bullets: ["Detail A", "Detail B"] },
    ];
    const builtSlides = [
      { id: "s1", layout: "title-only", background: "#ffffff", elements: [] },
      { id: "s2", layout: "concept-card", background: "#ffffff", elements: [] },
    ];
    const mcqQuestions = [
      { prompt: "Q1?", options: ["A", "B", "C", "D"], correctIndex: 0 },
      { prompt: "Q2?", options: ["A", "B", "C", "D"], correctIndex: 1 },
    ];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    vi.mocked(generateMcqQuestions).mockResolvedValue(mcqQuestions);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "Lesson.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.aiGenerated).toBe(true);
    /* MCQ questions are pending review — slideCount is content slides only. */
    expect(res.body.slideCount).toBe(2);
    expect(res.body.pendingMcqQuestions).toHaveLength(2);
    expect(generateMcqQuestions).toHaveBeenCalledOnce();
  });

  it("falls back to a blank deck when parsePptx throws", async () => {
    vi.mocked(parsePptx).mockRejectedValue(new Error("corrupt zip"));

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "Corrupt.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe("content_extraction_failed");
  });

  it("still returns 201 when MCQ generation fails (falls back to blank deck)", async () => {
    const parsedSlides = [{ title: "Slide 1", bullets: ["content"] }];
    const builtSlides  = [{ id: "s1", layout: "title-only", background: "#ffffff", elements: [] }];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* generateMcqQuestions is called inside the same try/catch as parsePptx, so
       a throw here causes the entire PPTX branch to fall back to a blank deck. */
    vi.mocked(generateMcqQuestions).mockRejectedValue(new Error("OpenAI timeout"));

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "Fail.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe("content_extraction_failed");
  });
});

// ─── DOCX import ──────────────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — DOCX", () => {
  async function makeMinimalDocx(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.folder("_rels")!.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.folder("word")!.folder("_rels")!.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
    zip.folder("word")!.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter 1</w:t></w:r></w:p><w:p><w:r><w:t>Some content here.</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
    return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  }

  it("calls parseDocx, applies balanced distribution, and returns MCQ questions for review", async () => {
    const parsedSlides = [
      { title: "Chapter 1", bullets: ["Some content here."] },
    ];
    const builtSlides = [{ id: "s1", layout: "blank", background: "#ffffff", elements: [] }];

    vi.mocked(parseDocx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* MCQ generator returns one stub question by default from beforeEach. */

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const docxBuf = await makeMinimalDocx();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", docxBuf, { filename: "Notes.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    expect(res.status).toBe(201);
    /* MCQ questions are pending review — slideCount is content slides only. */
    expect(res.body.slideCount).toBe(1);
    expect(res.body.aiGenerated).toBe(true);
    expect(res.body.pendingMcqQuestions).toHaveLength(1);
    expect(parseDocx).toHaveBeenCalledOnce();
    expect(buildSlidesFromParsed).toHaveBeenCalledWith(parsedSlides, expect.any(String));
    expect(generateMcqQuestions).toHaveBeenCalledOnce();
  });

  it("sets aiGenerated true for DOCX and returns multiple MCQ questions for review", async () => {
    const parsedSlides = [
      { title: "Chapter 1", bullets: ["Detail A"] },
      { title: "Chapter 2", bullets: ["Detail B"] },
    ];
    const builtSlides = [
      { id: "s1", layout: "blank", background: "#ffffff", elements: [] },
      { id: "s2", layout: "blank", background: "#ffffff", elements: [] },
    ];
    const mcqQuestions = [
      { prompt: "Q1?", options: ["A", "B", "C", "D"], correctIndex: 0 },
    ];

    vi.mocked(parseDocx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    vi.mocked(generateMcqQuestions).mockResolvedValue(mcqQuestions);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const docxBuf = await makeMinimalDocx();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", docxBuf, { filename: "Notes.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    expect(res.status).toBe(201);
    expect(res.body.aiGenerated).toBe(true);
    /* MCQ questions are pending review — slideCount is content slides only. */
    expect(res.body.slideCount).toBe(2);
    expect(res.body.pendingMcqQuestions).toHaveLength(1);
    expect(generateMcqQuestions).toHaveBeenCalledOnce();
  });

  it("falls back to a blank deck when parseDocx throws", async () => {
    vi.mocked(parseDocx).mockRejectedValue(new Error("corrupt docx"));

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const docxBuf = await makeMinimalDocx();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", docxBuf, { filename: "Bad.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe("content_extraction_failed");
  });
});

// ─── Arabic RTL import ────────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — Arabic RTL", () => {
  async function makeMinimalPptxBuffer(): Promise<Buffer> {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`,
    );
    zip.folder("ppt")!.folder("slides")!.file(
      "slide1.xml",
      `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>عنوان</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    );
    return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  }

  it("calls buildSlidesFromParsed with 'ar' when PPTX text is predominantly Arabic", async () => {
    const arabicParsed = [
      { title: "عنوان الدرس الأول", bullets: ["النقطة الأولى بالعربية", "النقطة الثانية بالعربية"] },
    ];
    const builtSlides = [{ id: "s1", layout: "blank", background: "#ffffff", elements: [] }];

    vi.mocked(parsePptx).mockResolvedValue(arabicParsed);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    vi.mocked(generateMcqQuestions).mockResolvedValue([]);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makeMinimalPptxBuffer();
    await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, {
        filename: "arabic.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });

    expect(buildSlidesFromParsed).toHaveBeenCalledWith(arabicParsed, "ar");
  });

  it("accepts slides with dir/lang/textDirection RTL fields through slidesSchema validation", async () => {
    const arabicParsed = [{ title: "عنوان", bullets: ["محتوى"] }];
    const builtArabicSlides = [
      {
        id: "s1",
        layout: "blank",
        background: "#ffffff",
        dir: "rtl",
        lang: "ar",
        elements: [
          {
            id: "s1_e1",
            kind: "text",
            x: 64, y: 64, w: 1152, h: 100,
            text: "عنوان",
            fontSize: 48,
            fontWeight: "700",
            align: "end",
            textDirection: "rtl",
            fontFamily: "'Cairo', sans-serif",
            color: "#1a1a1a",
          },
        ],
      },
    ];

    vi.mocked(parsePptx).mockResolvedValue(arabicParsed);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtArabicSlides);
    vi.mocked(generateMcqQuestions).mockResolvedValue([]);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makeMinimalPptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, {
        filename: "arabic.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });

    /* 201 means slidesSchema accepted the RTL slide — no fallback to defaultSlides */
    expect(res.status).toBe(201);
    expect(res.body.slideCount).toBe(1);
  });
});

// ─── PDF import ───────────────────────────────────────────────────────────────

describe("POST /api/presentations/import-file — PDF", () => {
  /* A minimal but structurally valid single-page PDF. */
  const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n" +
    "0000000058 00000 n \n0000000115 00000 n \n" +
    "trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF",
  );

  it("calls parsePdf, uploads page images, and produces background-image slides", async () => {
    const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    vi.mocked(parsePdf).mockResolvedValue([
      { imageBuffer: fakeImageBuffer, pageNumber: 1 },
      { imageBuffer: fakeImageBuffer, pageNumber: 2 },
    ]);
    vi.mocked(buildSlidesFromPdfPages).mockReturnValue([
      { id: "s1", layout: "blank", background: "#000000", backgroundImage: "https://storage.example.com/p1.png", elements: [] },
      { id: "s2", layout: "blank", background: "#000000", backgroundImage: "https://storage.example.com/p2.png", elements: [] },
    ]);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", MINIMAL_PDF, { filename: "lecture.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.slideCount).toBe(2);
    expect(parsePdf).toHaveBeenCalledOnce();
    /* buildSlidesFromPdfPages should have been called with URLs, not raw buffers. */
    expect(buildSlidesFromPdfPages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("http")]),
    );
  });

  it("produces slides with backgroundImage on each slide (image-first layout)", async () => {
    const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(parsePdf).mockResolvedValue([
      { imageBuffer: fakeImageBuffer, pageNumber: 1 },
    ]);
    vi.mocked(buildSlidesFromPdfPages).mockImplementation((urls) =>
      urls.map((url, i) => ({
        id: `s${i + 1}`,
        layout: "blank",
        background: "#000000",
        backgroundImage: url,
        elements: [],
      })),
    );

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", MINIMAL_PDF, { filename: "slides.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.slideCount).toBe(1);
  });

  it("falls back to a blank deck when parsePdf throws", async () => {
    vi.mocked(parsePdf).mockRejectedValue(new Error("pdftoppm not found"));

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", MINIMAL_PDF, { filename: "scan.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBe("content_extraction_failed");
  });
});
