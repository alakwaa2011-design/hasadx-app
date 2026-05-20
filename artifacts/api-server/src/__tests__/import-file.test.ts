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

/* ── MCQ slides generator mock ───────────────────────────────────────────────── */
vi.mock("../lib/generate-mcq-slides", () => ({
  generateMcqSlides: vi.fn(),
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
import { generateMcqSlides } from "../lib/generate-mcq-slides";
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

beforeEach(() => {
  mockState.queue.length = 0;
  /* Reset only the parser mocks between tests (preserve tier/storage stubs). */
  vi.mocked(parsePptx).mockReset();
  vi.mocked(parsePdf).mockReset();
  vi.mocked(parseDocx).mockReset();
  vi.mocked(buildSlidesFromParsed).mockReset();
  vi.mocked(buildSlidesFromPdfPages).mockReset();
  vi.mocked(generateMcqSlides).mockReset();
  /* Default: MCQ generator returns one stub slide. */
  vi.mocked(generateMcqSlides).mockResolvedValue([MCQ_SLIDE_STUB]);
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

  it("calls parsePptx and creates a deck with extracted slides plus MCQ slides", async () => {
    const parsedSlides = [{ title: "Slide 1", bullets: [] }];
    const builtSlides  = [{ id: "s1", layout: "title-only", background: "#ffffff", elements: [] }];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* MCQ generator returns one extra slide by default from beforeEach. */

    /* DB: resolvePresentationsTier → insert deck → insert asset */
    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "My Deck.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.presentationId).toBe(42);
    /* 1 content slide + 1 MCQ slide */
    expect(res.body.slideCount).toBe(2);
    expect(res.body.aiGenerated).toBe(true);
    expect(parsePptx).toHaveBeenCalledOnce();
    expect(buildSlidesFromParsed).toHaveBeenCalledWith(parsedSlides, expect.any(String));
    expect(generateMcqSlides).toHaveBeenCalledOnce();
  });

  it("sets aiGenerated true and appends MCQ slides after content slides", async () => {
    const parsedSlides = [
      { title: "Intro", bullets: ["Point 1", "Point 2"] },
      { title: "Topic", bullets: ["Detail A", "Detail B"] },
    ];
    const builtSlides = [
      { id: "s1", layout: "title-only", background: "#ffffff", elements: [] },
      { id: "s2", layout: "concept-card", background: "#ffffff", elements: [] },
    ];
    const mcqSlides = [
      { id: "mcq-1", layout: "interactive", background: "#ffffff", elements: [] },
      { id: "mcq-2", layout: "interactive", background: "#ffffff", elements: [] },
    ];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    vi.mocked(generateMcqSlides).mockResolvedValue(mcqSlides);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const pptxBuf = await makePptxBuffer();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", pptxBuf, { filename: "Lesson.pptx", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    expect(res.status).toBe(201);
    expect(res.body.aiGenerated).toBe(true);
    expect(res.body.slideCount).toBe(4); /* 2 content + 2 MCQ */
    /* generateMcqSlides was called with startIdx = 3 (after the 2 content slides) */
    expect(generateMcqSlides).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      3,
    );
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

  it("still succeeds when MCQ generation fails (graceful degradation)", async () => {
    const parsedSlides = [{ title: "Slide 1", bullets: ["content"] }];
    const builtSlides  = [{ id: "s1", layout: "title-only", background: "#ffffff", elements: [] }];

    vi.mocked(parsePptx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* Simulate MCQ generator throwing — the whole PPTX path catches and falls back. */
    vi.mocked(generateMcqSlides).mockRejectedValue(new Error("OpenAI timeout"));

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

  it("calls parseDocx, applies balanced distribution, and appends MCQ slides", async () => {
    const parsedSlides = [
      { title: "Chapter 1", bullets: ["Some content here."] },
    ];
    const builtSlides = [{ id: "s1", layout: "blank", background: "#ffffff", elements: [] }];

    vi.mocked(parseDocx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    /* MCQ generator returns one stub slide from beforeEach default. */

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const docxBuf = await makeMinimalDocx();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", docxBuf, { filename: "Notes.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    expect(res.status).toBe(201);
    /* 1 content slide + 1 MCQ slide */
    expect(res.body.slideCount).toBe(2);
    expect(res.body.aiGenerated).toBe(true);
    expect(parseDocx).toHaveBeenCalledOnce();
    expect(buildSlidesFromParsed).toHaveBeenCalledWith(parsedSlides, expect.any(String));
    expect(generateMcqSlides).toHaveBeenCalledOnce();
  });

  it("sets aiGenerated true for DOCX and places MCQ slides at the end", async () => {
    const parsedSlides = [
      { title: "Chapter 1", bullets: ["Detail A"] },
      { title: "Chapter 2", bullets: ["Detail B"] },
    ];
    const builtSlides = [
      { id: "s1", layout: "blank", background: "#ffffff", elements: [] },
      { id: "s2", layout: "blank", background: "#ffffff", elements: [] },
    ];
    const mcqSlides = [
      { id: "mcq-1", layout: "interactive", background: "#ffffff", elements: [] },
    ];

    vi.mocked(parseDocx).mockResolvedValue(parsedSlides);
    vi.mocked(buildSlidesFromParsed).mockReturnValue(builtSlides);
    vi.mocked(generateMcqSlides).mockResolvedValue(mcqSlides);

    pushQueue([DECK_STUB], [ASSET_STUB]);

    const docxBuf = await makeMinimalDocx();
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/import-file")
      .attach("file", docxBuf, { filename: "Notes.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    expect(res.status).toBe(201);
    expect(res.body.aiGenerated).toBe(true);
    expect(res.body.slideCount).toBe(3); /* 2 content + 1 MCQ */
    expect(generateMcqSlides).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      3,
    );
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
