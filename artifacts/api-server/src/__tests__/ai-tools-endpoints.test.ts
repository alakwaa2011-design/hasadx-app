/* Endpoint tests for the credit-protected AI routes.
   Mocks the OpenAI/Anthropic clients so a future model or parameter
   change (e.g. legacy max_tokens/temperature rejected by gpt-5-family)
   is caught here instead of silently breaking in production.
   Follows the mock pattern from ai-presentations-build.test.ts. */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const openaiCreate = vi.fn();
  const anthropicCreate = vi.fn();
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
  return { openaiCreate, anthropicCreate, makeChain };
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
  captureCredits: async () => {},
  refundCredits: async () => {},
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mockState.openaiCreate } } },
}));

vi.mock("../lib/anthropic-client", () => ({
  anthropic: { messages: { create: mockState.anthropicCreate } },
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

vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (_req: any, _res: any, next: any) => next(),
  processUploadedFiles: async () => ({ images: [], text: "" }),
  runVisionCompletionMulti: async () => "",
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
import mindmapRouter from "../routes/ai-mindmap";
import millionRouter from "../routes/million-game";
import worksheetsRouter from "../routes/worksheets";
import lessonPlansRouter from "../routes/lesson_plans";
import whiteboardRouter from "../routes/whiteboard";
import aiQuestionsRouter from "../routes/ai-questions";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null = { teacherId: 1 }) {
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
  app.use("/api", router);
  return app;
}

function openaiReturns(content: string) {
  mockState.openaiCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

/* gpt-5-family models reject the legacy params — assert no AI call
   sneaks them back in. */
function expectNoLegacyParams() {
  for (const call of mockState.openaiCreate.mock.calls) {
    const args = call[0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("max_tokens");
    expect(args).not.toHaveProperty("temperature");
  }
}

beforeEach(() => {
  mockState.openaiCreate.mockReset();
  mockState.anthropicCreate.mockReset();
});

describe("POST /api/ai/generate-mindmap", () => {
  it("returns 200 with a well-formed mind map", async () => {
    openaiReturns(
      JSON.stringify({
        center: "الطاقة المتجددة",
        branches: [
          { label: "الشمسية", icon: "☀️", children: ["الألواح", "التخزين"] },
          { label: "الرياح", icon: "🌬️", children: ["التوربينات"] },
        ],
      }),
    );

    const res = await request(makeApp(mindmapRouter))
      .post("/api/ai/generate-mindmap")
      .send({ topic: "الطاقة المتجددة" });

    expect(res.status).toBe(200);
    expect(res.body.center).toBe("الطاقة المتجددة");
    expect(res.body.branches).toHaveLength(2);
    expect(res.body.branches[0]).toMatchObject({
      label: "الشمسية",
      children: ["الألواح", "التخزين"],
    });
    expect(typeof res.body.branches[0].color).toBe("string");
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(mindmapRouter, null))
      .post("/api/ai/generate-mindmap")
      .send({ topic: "x" });
    expect(res.status).toBe(401);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });

  it("returns 500 (not a silent success) when the model returns bad JSON", async () => {
    openaiReturns("not json at all");
    const res = await request(makeApp(mindmapRouter))
      .post("/api/ai/generate-mindmap")
      .send({ topic: "الطاقة" });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/million/hint", () => {
  it("returns 200 with the AI hint", async () => {
    openaiReturns("فكّر في العاصمة الواقعة على نهر.");
    const res = await request(makeApp(millionRouter))
      .post("/api/million/hint")
      .send({
        questionText: "ما عاصمة فرنسا؟",
        optionA: "لندن",
        optionB: "باريس",
        optionC: "روما",
        optionD: "مدريد",
      });

    expect(res.status).toBe(200);
    expect(res.body.hint).toBe("فكّر في العاصمة الواقعة على نهر.");
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("does NOT silently fall back to the canned hint when the AI succeeds", async () => {
    openaiReturns("تلميح حقيقي");
    const res = await request(makeApp(millionRouter))
      .post("/api/million/hint")
      .send({ questionText: "سؤال؟", optionA: "أ", optionB: "ب", optionC: "ج", optionD: "د" });
    expect(res.status).toBe(200);
    expect(res.body.hint).not.toBe("لا يتوفر تلميح الآن.");
  });
});

describe("POST /api/worksheets/ai/generate", () => {
  it("returns 200 with validated questions", async () => {
    openaiReturns(
      JSON.stringify({
        questions: [
          {
            type: "mcq",
            prompt: "ما ناتج 2+2؟",
            options: ["3", "4", "5", "6"],
            correctIndex: 1,
          },
          { type: "true_false", prompt: "الأرض كروية.", correct: true },
        ],
      }),
    );

    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({
        topic: "الرياضيات الأساسية",
        counts: { mcq: 1, true_false: 1, short_answer: 0, fill_blank: 0, matching: 0 },
      });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0]).toMatchObject({
      type: "mcq",
      prompt: "ما ناتج 2+2؟",
      correctIndex: 1,
    });
    expect(res.body.questions[1]).toMatchObject({ type: "true_false", correct: true });
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(worksheetsRouter, null))
      .post("/api/worksheets/ai/generate")
      .send({ topic: "x y", counts: { mcq: 1, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 } });
    expect(res.status).toBe(401);
  });

  it("returns 500 (not a silent success) when the model returns garbage", async () => {
    openaiReturns("garbage — no json");
    const res = await request(makeApp(worksheetsRouter))
      .post("/api/worksheets/ai/generate")
      .send({
        topic: "الرياضيات",
        counts: { mcq: 2, true_false: 0, short_answer: 0, fill_blank: 0, matching: 0 },
      });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/lesson-plans/ai/generate", () => {
  it("returns 200 with validated sections", async () => {
    openaiReturns(
      JSON.stringify({
        objectives: ["يتعرف الطالب على الكسور"],
        materials: ["سبورة", "أوراق عمل"],
        vocabulary: [{ term: "كسر", definition: "جزء من كل" }],
        warmUp: { title: "تهيئة", durationMinutes: 5, description: "نشاط افتتاحي قصير." },
        introduction: { title: "مقدمة", durationMinutes: 10, description: "شرح مفهوم الكسر." },
        activities: [
          { title: "نشاط جماعي", durationMinutes: 15, description: "تقسيم أشكال إلى أجزاء." },
        ],
        assessment: { description: "أسئلة شفهية قصيرة.", method: "شفهي" },
        closure: { description: "تلخيص أهم النقاط." },
        homework: { description: "حل تمارين الكتاب." },
      }),
    );

    const res = await request(makeApp(lessonPlansRouter))
      .post("/api/lesson-plans/ai/generate")
      .send({ topic: "الكسور", gradeLevel: "الصف الرابع", durationMinutes: 45 });

    expect(res.status).toBe(200);
    expect(res.body.sections).toBeDefined();
    expect(res.body.sections.objectives).toEqual(["يتعرف الطالب على الكسور"]);
    expect(res.body.sections.warmUp.description).toBe("نشاط افتتاحي قصير.");
    expect(res.body.sections.assessment.description).toBe("أسئلة شفهية قصيرة.");
    expect(res.body.sections.activities).toHaveLength(1);
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(lessonPlansRouter, null))
      .post("/api/lesson-plans/ai/generate")
      .send({ topic: "الكسور" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/whiteboard/generate", () => {
  it("returns 200 with a validated lesson plan", async () => {
    openaiReturns(
      JSON.stringify({
        title: "درس الجاذبية",
        topic: "الجاذبية",
        intro: {
          voiceText: "مرحباً، اليوم نتعلم الجاذبية.",
          boardActions: [{ type: "writeTitle", content: "الجاذبية" }],
        },
        steps: [
          {
            id: "s1",
            title: "ما هي الجاذبية؟",
            voiceText: "الجاذبية قوة تجذب الأجسام نحو الأرض.",
            boardActions: [{ type: "bullet", content: "قوة جذب" }],
          },
        ],
        summary: {
          voiceText: "تعلمنا اليوم أن الجاذبية قوة أساسية.",
          boardActions: [],
        },
        keyPoints: ["الجاذبية قوة"],
      }),
    );

    const res = await request(makeApp(whiteboardRouter))
      .post("/api/whiteboard/generate")
      .send({ topic: "الجاذبية" });

    expect(res.status).toBe(200);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.title).toBe("درس الجاذبية");
    expect(res.body.plan.steps).toHaveLength(1);
    expect(res.body.plan.steps[0].boardActions[0]).toMatchObject({
      type: "bullet",
      content: "قوة جذب",
    });
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("returns 500 (not a silent success) when the model output has no steps", async () => {
    openaiReturns(JSON.stringify({ title: "x", topic: "y" }));
    const res = await request(makeApp(whiteboardRouter))
      .post("/api/whiteboard/generate")
      .send({ topic: "الجاذبية" });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/ai/generate-questions", () => {
  it("returns 200 with well-formed questions", async () => {
    openaiReturns(
      JSON.stringify([
        {
          text: "ما عاصمة السعودية؟",
          optionA: "جدة",
          optionB: "الرياض",
          optionC: "الدمام",
          optionD: "مكة",
          correctAnswer: "B",
          points: 1,
        },
      ]),
    );

    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send({ topic: "الجغرافيا", count: 1, difficulty: "medium" });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0]).toMatchObject({
      text: "ما عاصمة السعودية؟",
      correctAnswer: "B",
      points: 1,
    });
    expect(mockState.openaiCreate).toHaveBeenCalledTimes(1);
    expectNoLegacyParams();
  });

  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(aiQuestionsRouter, null))
      .post("/api/ai/generate-questions")
      .send({ topic: "x", count: 1 });
    expect(res.status).toBe(401);
    expect(mockState.openaiCreate).not.toHaveBeenCalled();
  });

  it("returns 500 (not a silent success) when the model returns no JSON array", async () => {
    openaiReturns("عذراً لا أستطيع");
    const res = await request(makeApp(aiQuestionsRouter))
      .post("/api/ai/generate-questions")
      .send({ topic: "الجغرافيا", count: 1 });
    expect(res.status).toBe(500);
  });
});
