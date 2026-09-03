import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { holdCreditsForToolRequest } = vi.hoisted(() => ({
  holdCreditsForToolRequest: vi.fn(),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { audio: { data: "cHJldmlldy1hdWRpbw==" } } }],
          usage: { total_tokens: 5 },
        })),
      },
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  assignmentsTable: {},
}));

vi.mock("../lib/rate-limiter", () => ({
  ttsLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/check-credits", () => ({
  holdCreditsForToolRequest,
  InsufficientCreditsError: class InsufficientCreditsError extends Error {},
}));

vi.mock("../lib/credit-service", () => ({
  CreditService: {},
}));

vi.mock("../lib/tts-cache", () => ({
  TTS_SYSTEM_PROMPT: "Read the supplied text.",
}));

vi.mock("../lib/ai-usage-ledger", () => ({
  trackAiUsageCall: async (
    _req: unknown,
    _config: unknown,
    run: () => Promise<unknown>,
  ) => run(),
  recordCachedAiUsage: vi.fn(),
}));

vi.mock("../game/manager.js", () => ({
  getGame: vi.fn(),
  getPlayerByToken: vi.fn(),
  getDictationListenCount: vi.fn(),
  incrementDictationListenCount: vi.fn(),
  decrementDictationListenCount: vi.fn(),
  getCachedDictationAudioByIndex: vi.fn(),
  cacheDictationAudio: vi.fn(),
  getInFlightDictationSynthesis: vi.fn(),
  setInFlightDictationSynthesis: vi.fn(),
  clearInFlightDictationSynthesis: vi.fn(),
}));

import router from "../routes/tts";

function makeApp(teacherId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: { teacherId?: number } }).session = teacherId ? { teacherId } : {};
    req.log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      child: vi.fn(),
      level: "silent",
      silent: vi.fn(),
    } as never;
    next();
  });
  app.use("/api", router);
  return app;
}

describe("POST /api/tts/preview", () => {
  beforeEach(() => {
    holdCreditsForToolRequest.mockClear();
  });

  it("يرفض الطلب غير المسجل", async () => {
    const response = await request(makeApp())
      .post("/api/tts/preview")
      .send({ text: "نص المعاينة" });

    expect(response.status).toBe(401);
  });

  it("يعيد صوت المعاينة للمعلّم دون حجز رصيد", async () => {
    const response = await request(makeApp(42))
      .post("/api/tts/preview")
      .send({ text: "مرحبا بكم في نشاط الاستماع", voice: "nova" });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^audio\/mpeg/);
    expect(response.body).toEqual(Buffer.from("preview-audio"));
    expect(holdCreditsForToolRequest).not.toHaveBeenCalled();
  });
});