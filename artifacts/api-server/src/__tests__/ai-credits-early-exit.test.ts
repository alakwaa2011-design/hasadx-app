/* Regression tests: credit refund on early-exit failure paths.
   Verifies that every early-return in credit-protected AI routes calls
   refundCredits, so a held balance is never stranded when the AI returns
   garbage or validation fails.

   Routes covered:
     POST /api/ai/generate-questions          (ai-questions.ts)
     POST /api/ai/generate-questions-with-images (ai-questions.ts)
     POST /api/ai/generate-mindmap            (ai-mindmap.ts)
     POST /api/worksheets/ai/generate         (worksheets.ts)
*/

import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Hoisted spy state ─────────────────────────────────────────────────────── */

const creditState = vi.hoisted(() => ({
  capture: vi.fn(async () => {}),
  refund:  vi.fn(async () => {}),
}));

const mockOpenaiCreate         = vi.hoisted(() => vi.fn());
const mockOpenaiImagesGenerate = vi.hoisted(() => vi.fn());

/* ── Mocks ─────────────────────────────────────────────────────────────────── */

vi.mock("../lib/check-credits", () => ({
  /** Attaches a fake __creditRequestId so captureCredits/refundCredits fire. */
  checkCredits: (_toolKey: string) =>
    (req: any, _res: any, next: any) => {
      req.__creditRequestId = "test-hold-id";
      req.__creditToolKey   = _toolKey;
      req.__creditsHeld     = 1;
      next();
    },
  captureCredits: (req: any) => {
    if (req.__creditRequestId) creditState.capture();
  },
  refundCredits: (req: any, _reason?: string) => {
    if (req.__creditRequestId) creditState.refund();
  },
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("@workspace/db", () => {
  function makeChain(result: unknown): unknown {
    const p = Promise.resolve(result);
    return new Proxy(p as object, {
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
  openai: {
    chat:   { completions: { create: mockOpenaiCreate } },
    images: { generate: mockOpenaiImagesGenerate },
  },
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async uploadBufferAsPublic() { return "https://storage.example.com/img.png"; }
  },
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
  awardXpInTxAndNotifyAfterCommit: async () => ({ runAfterCommit: async () => {} }),
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
  createUploadFilesMiddleware: () => (req: any, _res: any, next: any) => {
    req.files = [];
    next();
  },
  processUploadedFiles: async () => ({ images: [], text: "محتوى" }),
  runVisionCompletionMulti: async () => "",
}));

/* ── App builder ────────────────────────────────────────────────────────────── */

import express from "express";
import request from "supertest";
import aiQuestionsRouter from "../routes/ai-questions";
import aiMindmapRouter   from "../routes/ai-mindmap";
import worksheetsRouter  from "../routes/worksheets";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null = { teacherId: 1 }) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    (req as any).session = session ?? {};
    (req as any).log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use("/api", router);
  return app;
}

/* ── Fixture helpers ──────────────────────────────────────────────────────── */

function aiReturns(content: string) {
  mockOpenaiCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

const VALID_MCQ_RESPONSE = JSON.stringify([
  { text: "ما عاصمة السعودية؟", optionA: "جدة", optionB: "الرياض", optionC: "مكة", optionD: "الدمام", correctAnswer: "B", points: 1 },
]);

/* ── Setup ──────────────────────────────────────────────────────────────────── */

beforeEach(() => {
  creditState.capture.mockClear();
  creditState.refund.mockClear();
  mockOpenaiCreate.mockReset();
  mockOpenaiImagesGenerate.mockReset();
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/ai/generate-questions
   ══════════════════════════════════════════════════════════════════════════════ */

describe("POST /api/ai/generate-questions — credit refund on early exit", () => {
  const VALID_BODY = { topic: "الفيزياء", count: "5", difficulty: "medium" };

  it("captures on success", async () => {
    aiReturns(VALID_MCQ_RESPONSE);
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when the model returns prose with no JSON array", async () => {
    aiReturns("آسف، لا أستطيع المساعدة في ذلك.");
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when the model returns an empty array", async () => {
    aiReturns("[]");
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when every mapped question fails validation (all invalid shapes)", async () => {
    // MCQ with no options — mapTypedQuestion returns null for each
    aiReturns(JSON.stringify([
      { text: "سؤال؟", correctAnswer: "Z", points: 1 },
    ]));
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when the AI call throws a network error", async () => {
    mockOpenaiCreate.mockRejectedValue(new Error("network error"));
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/ai/generate-questions-with-images
   ══════════════════════════════════════════════════════════════════════════════ */

describe("POST /api/ai/generate-questions-with-images — credit refund on early exit", () => {
  const VALID_BODY = { topic: "الرياضيات", count: "3", difficulty: "easy" };

  it("captures on success (all images generated)", async () => {
    aiReturns(VALID_MCQ_RESPONSE);
    mockOpenaiImagesGenerate.mockResolvedValue({
      data: [{ b64_json: "aGVsbG8=" }],
    });
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions-with-images")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when the model returns prose with no JSON array", async () => {
    aiReturns("عذراً لا أستطيع توليد أسئلة الآن.");
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions-with-images")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when all mapped questions are invalid (no valid shapes survive)", async () => {
    // Questions with unrecognised correctAnswer for MCQ → all dropped
    aiReturns(JSON.stringify([
      { text: "سؤال؟", optionA: "أ", optionB: "ب", optionC: "ج", optionD: "د", correctAnswer: "X", points: 1 },
    ]));
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions-with-images")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when all image generation fails", async () => {
    aiReturns(VALID_MCQ_RESPONSE);
    mockOpenaiImagesGenerate.mockRejectedValue(new Error("dall-e rate limit"));
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions-with-images")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/ai/generate-mindmap
   ══════════════════════════════════════════════════════════════════════════════ */

describe("POST /api/ai/generate-mindmap — credit refund on early exit", () => {
  const VALID_BODY = { topic: "النظام الشمسي", lang: "ar" };
  const VALID_MINDMAP_RESPONSE = JSON.stringify({
    center: "النظام الشمسي",
    branches: [
      { label: "الكواكب", icon: "🪐", children: ["المريخ", "الزهرة", "الأرض"] },
    ],
  });

  it("captures on success", async () => {
    aiReturns(VALID_MINDMAP_RESPONSE);
    const res = await request(makeApp(aiMindmapRouter))
      .post("/api/ai/generate-mindmap")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when the model returns invalid JSON (inner catch path)", async () => {
    // Provide syntactically invalid JSON so JSON.parse throws in the inner catch
    aiReturns("{ invalid json }}}");
    const res = await request(makeApp(aiMindmapRouter))
      .post("/api/ai/generate-mindmap")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when the AI call throws", async () => {
    mockOpenaiCreate.mockRejectedValue(new Error("timeout"));
    const res = await request(makeApp(aiMindmapRouter))
      .post("/api/ai/generate-mindmap")
      .send(VALID_BODY);

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   POST /api/worksheets/ai/generate
   ══════════════════════════════════════════════════════════════════════════════ */

describe("POST /api/worksheets/ai/generate — credit refund on early exit", () => {
  const BASE_COUNTS = { mcq: 3, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 };

  it("captures on success", async () => {
    aiReturns(JSON.stringify({
      questions: [
        { id: "q1", type: "mcq", prompt: "ما 2+2؟", options: ["1", "2", "3", "4"], correctIndex: 3 },
        { id: "q2", type: "mcq", prompt: "ما 3+3؟", options: ["4", "5", "6", "7"], correctIndex: 2 },
        { id: "q3", type: "mcq", prompt: "ما 1+1؟", options: ["0", "2", "3", "4"], correctIndex: 1 },
      ],
    }));
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({ topic: "الرياضيات", language: "ar", counts: BASE_COUNTS });

    expect(res.status).toBe(200);
    expect(creditState.capture).toHaveBeenCalledTimes(1);
    expect(creditState.refund).not.toHaveBeenCalled();
  });

  it("refunds when all question counts are zero", async () => {
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({
        topic: "الرياضيات",
        language: "ar",
        counts: { mcq: 0, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 },
      });

    expect(res.status).toBe(400);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
    // No AI call should have been made
    expect(mockOpenaiCreate).not.toHaveBeenCalled();
  });

  it("refunds when the model returns garbage that fails schema validation", async () => {
    // Output has no valid question fields — sanitizeGeneratedQuestions strips all
    // → questionsArraySchema.safeParse fails → refund path
    aiReturns(JSON.stringify({ questions: [{ completely: "invalid" }] }));
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({ topic: "الكيمياء", language: "ar", counts: BASE_COUNTS });

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });

  it("refunds when the AI call throws a network error", async () => {
    mockOpenaiCreate.mockRejectedValue(new Error("connection refused"));
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({ topic: "العلوم", language: "ar", counts: BASE_COUNTS });

    expect(res.status).toBe(500);
    expect(creditState.refund).toHaveBeenCalledTimes(1);
    expect(creditState.capture).not.toHaveBeenCalled();
  });
});
