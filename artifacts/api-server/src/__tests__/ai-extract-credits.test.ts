/* Credit hold/capture/refund behaviour for the AI extraction endpoints.
   Tests that captureCredits fires on success and refundCredits fires on
   every early-return / failure path — so a held balance is never stranded.

   Kept separate from ai-tools-endpoints.test.ts so we can track
   captureCredits / refundCredits calls independently. */

import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Hoisted spy state ────────────────────────────────────────────────────── */

const creditState = vi.hoisted(() => ({
  capture: vi.fn(() => Promise.resolve()),
  refund:  vi.fn(() => Promise.resolve()),
}));

const mockOpenaiCreate = vi.hoisted(() => vi.fn());

/* ── Hoisted file-upload state ────────────────────────────────────────────── */
const fileUploadState = vi.hoisted(() => ({
  processResult: null as
    | { images: any[]; text: string; filenames: string[] }
    | null
    | "PASS",
}));

/* ── Mocks ────────────────────────────────────────────────────────────────── */

vi.mock("../lib/check-credits", () => ({
  /** Attaches a fake __creditRequestId so captureCredits/refundCredits fire. */
  checkCredits: (_toolKey: string) =>
    (req: any, _res: any, next: any) => {
      req.__creditRequestId = "test-hold-id";
      req.__creditToolKey   = _toolKey;
      req.__creditsHeld     = 1;
      next();
    },
  captureCredits: async (req: any) => {
    if (req.__creditRequestId) {
      creditState.capture.mockResolvedValueOnce(undefined);
      await creditState.capture();
    }
  },
  refundCredits: async (req: any) => {
    if (req.__creditRequestId) {
      creditState.refund.mockResolvedValueOnce(undefined);
      await creditState.refund();
    }
  },
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("@workspace/db", () => {
  /* makeChain produces a thenable proxy so `await db.select()...` resolves
     to an empty array — same pattern as ai-tools-endpoints.test.ts. */
  function makeChain(result: unknown): unknown {
    const p = Promise.resolve(result);
    return new Proxy(p, {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return (target as any)[prop].bind(target);
        }
        return () => makeChain(result);
      },
    });
  }
  const stub = new Proxy({}, { get: () => "stub" });
  const dbObj = {
    select: () => makeChain([]),
    insert: () => makeChain([]),
    update: () => makeChain([]),
    delete: () => makeChain([]),
  };
  return new Proxy(
    { db: dbObj },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return stub;
      },
    },
  );
});

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mockOpenaiCreate } } },
}));

vi.mock("../lib/anthropic-client", () => ({
  anthropic:             { messages: { create: vi.fn() } },
  SONNET_MODEL:          "claude-test",
  PRICE_INPUT_PER_MTOK:  3,
  PRICE_OUTPUT_PER_MTOK: 15,
  estimateCostMicroUsd:  () => 0,
}));

vi.mock("../lib/ai-tier", () => ({
  resolveTier:       async () => "standard" as const,
  getAvailableTiers: async () => ["standard"],
  modelForTier:      () => "gpt-test",
  isClaudeTier:      (t: string) => t === "claude",
}));

vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => {},
}));

vi.mock("../lib/xp/engine", () => ({
  reverseXpIfWithinWindow: async () => {},
}));

vi.mock("../lib/geocode-nominatim", () => ({
  geocodeMemCache:    new Map(),
  dbGeocacheLookup:   async () => null,
  dbGeocacheStore:    async () => {},
  fetchFromNominatim: async () => null,
}));

vi.mock("../game/million-class-handlers", () => ({
  getClassSession: () => null,
}));

vi.mock("../lib/file-upload", () => ({
  /** Passes through without actually running multer. */
  createUploadFilesMiddleware: () => (req: any, _res: any, next: any) => {
    req.files = [];
    next();
  },
  /** Returns the preset result, or writes its own error when null. */
  processUploadedFiles: async (_req: any, res: any, _files: any, lang: any) => {
    const r = fileUploadState.processResult;
    if (r === null) {
      res.status(400).json({
        message: lang !== "en" ? "لم يتم رفع أي ملف" : "No file uploaded",
      });
      return null;
    }
    return r === "PASS" || r === null ? null : r;
  },
  runVisionCompletionMulti: async () => "",
}));

/* ── App builder ──────────────────────────────────────────────────────────── */

import express from "express";
import request from "supertest";
import worksheetsRouter  from "../routes/worksheets";
import lessonPlansRouter from "../routes/lesson_plans";

type Session = { teacherId?: number };

function makeApp(
  router: express.Router,
  session: Session | null = { teacherId: 1 },
) {
  const app = express();
  /* JSON + URL-encoded parsers so tests can send body via .send() with
     Content-Type application/x-www-form-urlencoded or application/json.
     The real route uses multer (mocked above), so req.body is set by
     express itself when the mock passes through. */
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    (req as any).session = session ?? {};
    (req as any).log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use("/api", router);
  return app;
}

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

const VALID_COUNTS = JSON.stringify({
  mcq: 2, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0,
});

const ZERO_COUNTS = JSON.stringify({
  mcq: 0, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0,
});

const GOOD_WORKSHEET_RESPONSE = JSON.stringify({
  questions: [
    { type: "mcq", prompt: "س", options: ["أ", "ب", "ج", "د"], correctIndex: 0 },
    { type: "mcq", prompt: "س2", options: ["أ", "ب", "ج", "د"], correctIndex: 1 },
  ],
});

const GOOD_LESSON_RESPONSE = JSON.stringify({
  objectives: ["هدف"],
  materials: ["مادة"],
  vocabulary: [],
  warmUp:       { title: "تهيئة",  durationMinutes: 5,  description: "وصف" },
  introduction: { title: "مقدمة", durationMinutes: 10, description: "وصف" },
  activities:   [{ title: "نشاط", durationMinutes: 15, description: "وصف" }],
  assessment:   { description: "تقييم", method: "شفهي" },
  closure:      { description: "خاتمة" },
  homework:     { description: "واجب" },
});

/* ── Setup ────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  creditState.capture.mockReset();
  creditState.refund.mockReset();
  mockOpenaiCreate.mockReset();
  fileUploadState.processResult = {
    images: [],
    text: "محتوى الكتاب المدرسي",
    filenames: ["test.txt"],
  };
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/worksheets/ai/extract — credit hold / capture / refund
   ══════════════════════════════════════════════════════════════════════════ */

describe("POST /api/worksheets/ai/extract — credits", () => {
  it("captures credits on successful extraction", async () => {
    mockOpenaiCreate.mockResolvedValue({
      choices: [{ message: { content: GOOD_WORKSHEET_RESPONSE } }],
    });

    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/extract")
      .type("form")
      .send({ counts: VALID_COUNTS, language: "ar" });

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when the model returns garbage JSON", async () => {
    mockOpenaiCreate.mockResolvedValue({
      choices: [{ message: { content: "not json at all" } }],
    });

    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/extract")
      .type("form")
      .send({ counts: VALID_COUNTS, language: "ar" });

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when zero question types are requested", async () => {
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/extract")
      .type("form")
      .send({ counts: ZERO_COUNTS, language: "ar" });

    expect(res.status).toBe(400);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
    expect(mockOpenaiCreate).not.toHaveBeenCalled();
  });

  it("refunds when processUploadedFiles returns null (no readable file)", async () => {
    fileUploadState.processResult = null;

    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/extract")
      .type("form")
      .send({ counts: VALID_COUNTS, language: "ar" });

    expect(res.status).toBe(400);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
    expect(mockOpenaiCreate).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/lesson-plans/ai/extract — credit hold / capture / refund
   ══════════════════════════════════════════════════════════════════════════ */

describe("POST /api/lesson-plans/ai/extract — credits", () => {
  it("captures credits on successful extraction", async () => {
    mockOpenaiCreate.mockResolvedValue({
      choices: [{ message: { content: GOOD_LESSON_RESPONSE } }],
    });

    const res = await request(makeApp(lessonPlansRouter))
      .post("/api/lesson-plans/ai/extract")
      .type("form")
      .send({ language: "ar", durationMinutes: "45" });

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when the AI call throws an error", async () => {
    mockOpenaiCreate.mockRejectedValue(new Error("network timeout"));

    const res = await request(makeApp(lessonPlansRouter))
      .post("/api/lesson-plans/ai/extract")
      .type("form")
      .send({ language: "ar", durationMinutes: "45" });

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when processUploadedFiles returns null (no readable file)", async () => {
    fileUploadState.processResult = null;

    const res = await request(makeApp(lessonPlansRouter))
      .post("/api/lesson-plans/ai/extract")
      .type("form")
      .send({ language: "ar", durationMinutes: "45" });

    expect(res.status).toBe(400);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
    expect(mockOpenaiCreate).not.toHaveBeenCalled();
  });
});
