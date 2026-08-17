/* سياسة: «توليد صورة لكل سؤال» أداة داخلية للمسؤول فقط.
   يثبت هذا الملف أن:
   1. معلماً عادياً (Free/Basic/Pro — أي is_admin=false) يستلم 403 من
      POST /api/ai/generate-questions-with-images قبل أي hold أو أي استدعاء
      لمزود النص أو الصور.
   2. المسؤول يمر بالمسار كاملاً (مع mock آمن للمزود) ويستلم الأسئلة والصور.
   3. توليد الأسئلة النصي العادي يبقى متاحاً للمعلم العادي عبر
      checkCredits("ai-questions") المركزي كما هو. */

import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Hoisted spies ─────────────────────────────────────────────────────────── */

const spies = vi.hoisted(() => ({
  checkCreditsInvoked: vi.fn(),        // يسجّل كل مرور فعلي عبر وسيط النقاط
  capture: vi.fn(async () => {}),
  refund:  vi.fn(async () => {}),
  openaiCreate: vi.fn(),
  openaiImagesGenerate: vi.fn(),
  /* نتيجة استعلام is_admin — تضبط داخل كل اختبار */
  teacherRow: [] as Array<{ isAdmin: boolean }>,
}));

/* ── Mocks ─────────────────────────────────────────────────────────────────── */

vi.mock("../lib/check-credits", () => ({
  checkCredits: (toolKey: string) =>
    (req: any, _res: any, next: any) => {
      spies.checkCreditsInvoked(toolKey);
      req.__creditRequestId = "test-hold-id";
      req.__creditToolKey = toolKey;
      req.__creditsHeld = 1;
      next();
    },
  captureCredits: (req: any) => { if (req.__creditRequestId) spies.capture(); },
  refundCredits:  (req: any, _reason?: string) => { if (req.__creditRequestId) spies.refund(); },
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("@workspace/db", () => {
  /* select(...).from(teachers).where(...).limit(1) → صف المعلم المضبوط في الاختبار */
  function makeChain(result: () => unknown): unknown {
    return new Proxy(function () {} as object, {
      get(_t, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const p = Promise.resolve(result());
          return (p as any)[prop].bind(p);
        }
        return () => makeChain(result);
      },
      apply: () => makeChain(result),
    });
  }
  const stub = new Proxy({}, { get: () => "stub" });
  const dbObj = {
    select: () => makeChain(() => spies.teacherRow),
    insert: () => makeChain(() => []),
    update: () => makeChain(() => []),
    delete: () => makeChain(() => []),
  };
  return new Proxy({ db: dbObj }, {
    has: () => true, // vitest يتحقق بـ`in` من وجود التصدير
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return stub;
    },
  });
});

/* eq الحقيقي يرفض أعمدة الجدول المزيفة — نستبدله بعملية لا-شيء */
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: () => ({}) as any };
});

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat:   { completions: { create: spies.openaiCreate } },
    images: { generate: spies.openaiImagesGenerate },
  },
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async uploadBufferAsPublic() { return "/objects/uploads/test-image.png"; }
  },
}));

vi.mock("../lib/rate-limiter", () => ({
  imageUploadLimiter: (_req: any, _res: any, next: any) => next(),
}));

/* ── App builder ───────────────────────────────────────────────────────────── */

import express from "express";
import request from "supertest";
import aiQuestionsRouter from "../routes/ai-questions";

function makeApp(session: { teacherId?: number } | null = { teacherId: 1 }) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use((req, _res, next) => {
    (req as any).session = session ?? {};
    (req as any).log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use("/api", aiQuestionsRouter);
  return app;
}

const VALID_AI_JSON = JSON.stringify([
  {
    text: "ما ناتج 2+2؟",
    imagePrompt: "Simple illustration of two plus two apples, white background",
    optionA: "3", optionB: "4", optionC: "5", optionD: "6",
    correctAnswer: "B", points: 1,
  },
]);

beforeEach(() => {
  spies.checkCreditsInvoked.mockClear();
  spies.capture.mockClear();
  spies.refund.mockClear();
  spies.openaiCreate.mockReset();
  spies.openaiImagesGenerate.mockReset();
  spies.teacherRow = [];
});

/* ── 1) معلم عادي — 403 قبل أي شيء ────────────────────────────────────────── */

describe("POST /api/ai/generate-questions-with-images — بوابة المسؤول", () => {
  it("معلم عادي (غير مسؤول) يستلم 403 دون hold ودون أي استدعاء لمزود AI", async () => {
    spies.teacherRow = [{ isAdmin: false }];
    const res = await request(makeApp())
      .post("/api/ai/generate-questions-with-images")
      .send({ topic: "الكسور", count: 2, difficulty: "easy" });

    expect(res.status).toBe(403);
    expect(spies.checkCreditsInvoked).not.toHaveBeenCalled(); // لا hold إطلاقاً
    expect(spies.openaiCreate).not.toHaveBeenCalled();        // لا توليد نص
    expect(spies.openaiImagesGenerate).not.toHaveBeenCalled(); // لا توليد صور
    expect(spies.capture).not.toHaveBeenCalled();
    expect(spies.refund).not.toHaveBeenCalled();
  });

  it("معلم غير موجود في الجدول يعامل كغير مسؤول (403)", async () => {
    spies.teacherRow = [];
    const res = await request(makeApp())
      .post("/api/ai/generate-questions-with-images")
      .send({ topic: "الكسور", count: 2 });
    expect(res.status).toBe(403);
    expect(spies.checkCreditsInvoked).not.toHaveBeenCalled();
    expect(spies.openaiCreate).not.toHaveBeenCalled();
  });

  it("غير مسجل الدخول يستلم 401 قبل أي شيء", async () => {
    const res = await request(makeApp(null))
      .post("/api/ai/generate-questions-with-images")
      .send({ topic: "الكسور", count: 2 });
    expect(res.status).toBe(401);
    expect(spies.checkCreditsInvoked).not.toHaveBeenCalled();
    expect(spies.openaiCreate).not.toHaveBeenCalled();
  });

  /* ── 2) المسؤول يمر بالمسار كما هو متوقع ─────────────────────────────────── */

  it("المسؤول يمر: أسئلة + صور مع capture عبر الآلية المركزية", async () => {
    spies.teacherRow = [{ isAdmin: true }];
    spies.openaiCreate.mockResolvedValue({ choices: [{ message: { content: VALID_AI_JSON } }] });
    spies.openaiImagesGenerate.mockResolvedValue({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });

    const res = await request(makeApp())
      .post("/api/ai/generate-questions-with-images")
      .send({ topic: "الكسور", count: 1, difficulty: "easy" });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].imageUrl).toBe("/objects/uploads/test-image.png");
    expect(res.body.failedImages).toBe(0);
    expect(spies.checkCreditsInvoked).toHaveBeenCalledWith("ai-questions-images");
    expect(spies.capture).toHaveBeenCalledTimes(1);
    expect(spies.refund).not.toHaveBeenCalled();
  });

  /* ── 3) التوليد النصي العادي غير متأثر ───────────────────────────────────── */

  it("التوليد النصي العادي يبقى متاحاً لمعلم عادي ويخصم عبر ai-questions المركزي", async () => {
    spies.teacherRow = [{ isAdmin: false }];
    spies.openaiCreate.mockResolvedValue({ choices: [{ message: { content: VALID_AI_JSON } }] });

    const res = await request(makeApp())
      .post("/api/ai/generate-questions")
      .send({ topic: "الكسور", count: 1, difficulty: "easy" });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(spies.checkCreditsInvoked).toHaveBeenCalledWith("ai-questions");
    expect(spies.capture).toHaveBeenCalledTimes(1);
    expect(spies.openaiImagesGenerate).not.toHaveBeenCalled();
  });
});
