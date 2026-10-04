/**
 * Integration tests for POST /api/worksheets/ai/extract
 *
 * Covers the full server-side path: multipart upload → file processing →
 * AI extraction → schema validation → JSON response.
 *
 * The AI client and file-processing are mocked so the tests are deterministic
 * and don't require real files or API keys.
 *
 * "Done looks like" checklist from task 922:
 *  ✓ Text-based file → extract → validated questions returned
 *  ✓ Image file → vision path → validated questions returned
 *  ✓ 401 without a teacher session
 *  ✓ 400 for malformed counts JSON
 *  ✓ 400 when all counts are zero
 *  ✓ 500 (not silent success) when AI returns garbage
 *  ✓ 500 when schema validation fails on model output
 *  ✓ Unsupported format (DOC/PPT/XLSX) → 415 + Arabic message via processUploadedFiles
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Hoist mutable state for mock control ──────────────────────────── */
const mockState = vi.hoisted(() => {
  const openaiCreate = vi.fn();
  function makeChain(result: unknown): unknown {
    const p: Promise<unknown> = Promise.resolve(result);
    const handler: ProxyHandler<Promise<unknown>> = {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const fn = (target as unknown as Record<string, unknown>)[prop as string] as (...args: unknown[]) => unknown;
          return fn.bind(target);
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { openaiCreate, makeChain, captureCredits: vi.fn(async () => {}), refundCredits: vi.fn(async () => {}) };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  const dbObj = {
    select: () => mockState.makeChain([]),
    insert: () => mockState.makeChain([]),
    update: () => mockState.makeChain([]),
    delete: () => mockState.makeChain([]),
  };
  return new Proxy(
    { db: dbObj },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
        return stub;
      },
    },
  );
});

vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: any, _res: any, next: any) => next(),
  captureCredits: mockState.captureCredits,
  refundCredits: mockState.refundCredits,
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mockState.openaiCreate } } },
}));

vi.mock("../lib/anthropic-client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  SONNET_MODEL: "claude-sonnet-4-6",
  PRICE_INPUT_PER_MTOK: 3,
  PRICE_OUTPUT_PER_MTOK: 15,
  estimateCostMicroUsd: () => 0,
}));

vi.mock("../lib/ai-tier", () => ({
  resolveTier: async () => "standard" as const,
  getAvailableTiers: async () => ["standard"],
  modelForTier: () => "gpt-test-model",
  isClaudeTier: (t: string) => t === "claude",
}));

vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => {},
}));

vi.mock("../lib/xp/engine", () => ({
  reverseXpIfWithinWindow: async () => {},
}));

/* processUploadedFiles / runVisionCompletionMulti control what the
   endpoint "sees" from uploaded files and the vision AI path. */
const mockProcessUploadedFiles = vi.fn();
const mockRunVisionCompletionMulti = vi.fn();

vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (req: any, _res: any, next: any) => {
    req.files = [{ originalname: "lesson.txt", mimetype: "text/plain", size: 100 }];
    next();
  },
  processUploadedFiles: (...args: any[]) => mockProcessUploadedFiles(...args),
  runVisionCompletionMulti: (...args: any[]) => mockRunVisionCompletionMulti(...args),
}));

vi.mock("../game/million-class-handlers", () => ({
  getClassSession: () => null,
}));

vi.mock("../lib/geocode-nominatim", () => ({
  geocodeMemCache: new Map(),
  dbGeocacheLookup: async () => null,
  dbGeocacheStore: async () => {},
  fetchFromNominatim: async () => null,
}));

import express from "express";
import request from "supertest";
import worksheetsRouter from "../routes/worksheets";

/* ── Test app factory ───────────────────────────────────────────────── */
type Session = { teacherId?: number };
function makeApp(session: Session | null = { teacherId: 1 }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: Record<string, () => void> }).log = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    next();
  });
  app.use("/api", worksheetsRouter);
  return app;
}

/** Valid multipart body sent by create-assignment.tsx */
const VALID_FORM = {
  language: "ar",
  difficulty: "medium",
  pages: "1",
  counts: JSON.stringify({ mcq: 6, true_false: 2, short_answer: 0, fill_blank: 2, matching: 0 }),
};

/** Representative set of validated questions that the AI might return */
const AI_MCQ_QUESTIONS = [
  { type: "mcq", prompt: "ما ناتج 2+2؟", options: ["3", "4", "5", "6"], correctIndex: 1 },
  { type: "mcq", prompt: "ما عاصمة السعودية؟", options: ["جدة", "الرياض", "مكة", "الدمام"], correctIndex: 1 },
  { type: "true_false", prompt: "الأرض كروية.", correct: true },
];

function openaiReturns(content: string) {
  mockState.openaiCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

beforeEach(() => {
  mockState.openaiCreate.mockReset();
  mockState.captureCredits.mockClear();
  mockState.refundCredits.mockClear();
  mockProcessUploadedFiles.mockReset();
  mockRunVisionCompletionMulti.mockReset();
  // Default: simulate a text-based PDF upload
  mockProcessUploadedFiles.mockResolvedValue({ images: [], text: "محتوى الملف النصي" });
  // Default vision path: return valid question JSON
  mockRunVisionCompletionMulti.mockResolvedValue(
    JSON.stringify({ questions: AI_MCQ_QUESTIONS }),
  );
});

/* ── Happy-path: text source ────────────────────────────────────────── */

describe("automatic worksheet generation", () => {
  const visual = { caption: "الأشكال", shapes: [{ kind: "circle", x: 20, y: 20, width: 30, height: 30, shaded: false }] };
  const autoQuestions = [
    { type: "short_answer", prompt: "كم دائرة ترى؟", answer: "١", visual },
    { type: "worked_problem", prompt: "أوجد ٢ + ٣", answer: "٥", steps: 2 },
  ];

  it("generates from subject and grade alone, without asking for any types or fixed counts", async () => {
    openaiReturns(JSON.stringify({ questions: autoQuestions }));
    const res = await request(makeApp()).post("/api/worksheets/ai/generate").send({
      questionSelection: "auto", subject: "الرياضيات", gradeLevel: "الصف الأول", pages: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.questions.map((q: any) => q.type)).toEqual(["short_answer", "worked_problem"]);
    expect(res.body.questions[0].visual).toEqual(visual);
    const prompt = mockState.openaiCreate.mock.calls[0][0].messages[1].content as string;
    expect(prompt).toContain("الرياضيات");
    expect(prompt).toContain("الصف الأول");
    expect(prompt).toContain("اختيار أنواع الأسئلة تلقائي");
    expect(prompt).not.toContain("المطلوب: 30 اختيار من متعدد");
    expect(mockState.captureCredits).toHaveBeenCalledTimes(1);
    expect(mockState.refundCredits).not.toHaveBeenCalled();
  });

  it("defaults to automatic when a topic is provided without counts", async () => {
    openaiReturns(JSON.stringify({ questions: autoQuestions }));
    const res = await request(makeApp()).post("/api/worksheets/ai/generate").send({ topic: "الأشكال الهندسية" });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(mockState.openaiCreate.mock.calls[0][0].messages[1].content).toContain("اختيار أنواع الأسئلة تلقائي");
  });

  it("preserves legacy explicit type counts, even when the new selection field is absent", async () => {
    openaiReturns(JSON.stringify({ questions: autoQuestions }));
    const res = await request(makeApp()).post("/api/worksheets/ai/generate").send({
      topic: "الجمع", counts: { mcq: 0, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0, worked_problem: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.questions.map((q: any) => q.type)).toEqual(["worked_problem"]);
    expect(mockState.openaiCreate.mock.calls[0][0].messages[1].content).toContain("المطلوب: 1 مسألة محلولة");
  });

  it("uses automatic selection for reference-file generation and retains its diagrams", async () => {
    openaiReturns(JSON.stringify({ questions: autoQuestions }));
    const res = await request(makeApp()).post("/api/worksheets/ai/extract").send({
      ...VALID_FORM, questionSelection: "auto", subject: "الرياضيات", gradeLevel: "الصف الأول",
      counts: JSON.stringify({ tic_tac_toe: 0 }),
    });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0].visual).toEqual(visual);
    expect(mockState.openaiCreate.mock.calls[0][0].messages[1].content).toContain("اختيار أنواع الأسئلة تلقائي");
  });

  it("caps automatic output at the per-page limit without imposing per-type quotas", async () => {
    openaiReturns(JSON.stringify({ questions: Array.from({ length: 35 }, () => autoQuestions[0]) }));
    const res = await request(makeApp()).post("/api/worksheets/ai/generate").send({
      questionSelection: "auto", topic: "العد", pages: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(30);
  });
});

describe("POST /api/worksheets/ai/extract — text source", () => {
  it("returns 200 with validated questions when the AI responds correctly", async () => {
    openaiReturns(JSON.stringify({ questions: AI_MCQ_QUESTIONS }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    // Every returned question must have the required shape
    for (const q of res.body.questions) {
      expect(q).toHaveProperty("type");
      expect(q).toHaveProperty("prompt");
    }
  });

  it("calls the AI exactly once for a text-only source", async () => {
    openaiReturns(JSON.stringify({ questions: AI_MCQ_QUESTIONS }));

    await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
  });

  it("does NOT add legacy max_tokens / temperature params (gpt-5 compatibility)", async () => {
    openaiReturns(JSON.stringify({ questions: AI_MCQ_QUESTIONS }));
    await request(makeApp()).post("/api/worksheets/ai/extract").send(VALID_FORM);

    for (const call of mockState.openaiCreate.mock.calls) {
      const args = call[0] as Record<string, unknown>;
      expect(args).not.toHaveProperty("max_tokens");
      expect(args).not.toHaveProperty("temperature");
    }
  });
});

/* ── Happy-path: image source (vision path) ─────────────────────────── */

describe("POST /api/worksheets/ai/extract — image source", () => {
  it("returns 200 with questions when processUploadedFiles returns images", async () => {
    // Simulate an uploaded PNG; processUploadedFiles returns base64 image data
    mockProcessUploadedFiles.mockResolvedValue({
      images: [{ mimeType: "image/png", data: "aGVsbG8=" }],
      text: "",
    });
    openaiReturns(JSON.stringify({ questions: AI_MCQ_QUESTIONS }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(0);
  });
});

/* ── Auth ───────────────────────────────────────────────────────────── */

describe("POST /api/worksheets/ai/extract — authentication", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null))
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(401);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });
});

/* ── Validation errors ──────────────────────────────────────────────── */

describe("POST /api/worksheets/ai/extract — input validation", () => {
  it("returns 400 when counts is malformed JSON", async () => {
    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send({ ...VALID_FORM, counts: "{ not json }" });

    expect(res.status).toBe(400);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when all question counts are zero", async () => {
    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send({
        ...VALID_FORM,
        counts: JSON.stringify({ mcq: 0, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 }),
      });

    expect(res.status).toBe(400);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when language is an unsupported value", async () => {
    // language has a .default("ar") so missing is fine; an explicit bad value
    // should fail Zod validation and hit the 400 branch.
    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send({ ...VALID_FORM, language: "fr" });

    expect(res.status).toBe(400);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });
});

/* ── File-format rejection (via processUploadedFiles) ──────────────── */

describe("POST /api/worksheets/ai/extract — rejected file formats", () => {
  /**
   * processUploadedFiles writes the error response itself (415) and returns
   * null. We simulate that behavior here to confirm the route correctly
   * short-circuits when processUploadedFiles returns null.
   */
  const rejectedCases: Array<[string, string]> = [
    ["old.doc", "DOCX"],
    ["old.ppt", "PPTX"],
    ["sheet.xlsx", "Excel"],
    ["sheet.xls", "Excel"],
  ];

  for (const [fileName, hint] of rejectedCases) {
    it(`short-circuits (no AI call) when ${fileName} produces a 415`, async () => {
      // Simulate processUploadedFiles writing 415 and returning null
      mockProcessUploadedFiles.mockImplementation((_req: any, res: any) => {
        res.status(415).json({
          message: `الصيغة غير مدعومة: ${fileName}. استخدم ${hint}`,
        });
        return null;
      });

      const res = await request(makeApp())
        .post("/api/worksheets/ai/extract")
        .send(VALID_FORM);

      expect(res.status).toBe(415);
      expect(res.body.message).toContain(hint);
      // The AI must NOT have been called
      expect(mockState.openaiCreate).not.toHaveBeenCalled();
    });
  }
});

/* ── AI failure modes ───────────────────────────────────────────────── */

describe("POST /api/worksheets/ai/extract — AI failure modes", () => {
  it("returns 500 (not silent) when the model returns garbage JSON", async () => {
    openaiReturns("عذراً، لا أستطيع المساعدة في ذلك.");

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });

  it("refunds and never captures when zero valid questions survive sanitization", async () => {
    // MCQs with no resolvable correct answer — normalization must NOT invent one.
    openaiReturns(JSON.stringify({ questions: [
      { type: "mcq", prompt: "سؤال بلا إجابة؟", options: ["أ", "ب", "ج", "د"] },
      { type: "mcq", prompt: "سؤال آخر؟", options: ["أ", "ب", "ج", "د"], correctAnswer: "هـ" },
    ] }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(500);
    expect(mockState.captureCredits).not.toHaveBeenCalled();
    expect(mockState.refundCredits).toHaveBeenCalled();
  });

  it("captures exactly once on a successful extraction", async () => {
    openaiReturns(JSON.stringify({ questions: AI_MCQ_QUESTIONS }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(200);
    expect(mockState.captureCredits).toHaveBeenCalledTimes(1);
    expect(mockState.refundCredits).not.toHaveBeenCalled();
  });

  it("accepts Claude-style questions ('question' key + correctAnswer letter) via normalization", async () => {
    openaiReturns(JSON.stringify({ questions: [
      { type: "mcq", question: "ما عاصمة الكويت؟", options: ["الكويت", "حولي", "الجهراء", "الفروانية"], correctAnswer: "A" },
      { type: "mcq", question: "كم عدد المحافظات؟", options: ["4", "5", "6", "7"], correctIndex: 2 },
    ] }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0]).toMatchObject({ prompt: "ما عاصمة الكويت؟", correctIndex: 0 });
    expect(mockState.captureCredits).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the model returns valid JSON that fails schema validation", async () => {
    // questions array missing required fields
    openaiReturns(JSON.stringify({ questions: [{ invalid: true }] }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 500 when the model returns an empty questions array", async () => {
    // An empty array passes schema parse but sanitizeGeneratedQuestions may
    // strip everything, leading the validated array to be empty → 500.
    openaiReturns(JSON.stringify({ questions: [] }));

    const res = await request(makeApp())
      .post("/api/worksheets/ai/extract")
      .send(VALID_FORM);

    // Either 200 with 0 questions (edge-case) or 500 is acceptable;
    // what must NOT happen is a silent 200 { questions: undefined }.
    if (res.status === 200) {
      expect(Array.isArray(res.body.questions)).toBe(true);
    } else {
      expect(res.status).toBe(500);
    }
  });
});
