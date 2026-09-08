import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: {} as Record<string, any>,
  holdCalls: 0,
  releaseHold: null as null | (() => void),
  blockHold: false,
  holdResult: { mode: "held", creditsHeld: 5, existingStatus: undefined } as Record<string, any>,
  holdError: null as Error | null,
  startRender: vi.fn(),
  refund: vi.fn(async () => {}),
  assertRequestsResumable: vi.fn(async () => {}),
}));

vi.mock("../lib/ai-video-request-journal", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/ai-video-request-journal")>(),
  assertAiVideoRequestsResumable: state.assertRequestsResumable,
}));

function asyncChain(result: () => unknown): any {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const promise = Promise.resolve(result());
        return (promise as any)[prop].bind(promise);
      }
      return () => asyncChain(result);
    },
    apply: () => asyncChain(result),
  });
}

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: (_target, prop) => String(prop) });
  const db = {
    select: () => asyncChain(() => [{ ...state.project }]),
    update: () => {
      let values: Record<string, any> = {};
      let rows: Array<Record<string, any>> = [];
      const chain: any = {
        set(next: Record<string, any>) {
          values = next;
          return chain;
        },
        where() {
          if (values.status === "rendering") {
            if (state.project.status === "storyboard_ready") {
              state.project = { ...state.project, ...values };
              rows = [{ ...state.project }];
            } else {
              rows = [];
            }
          } else {
            state.project = { ...state.project, ...values };
            rows = [{ ...state.project }];
          }
          return chain;
        },
        returning() {
          return Promise.resolve(rows);
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return chain;
    },
    insert: () => asyncChain(() => []),
  };
  return new Proxy({ db, aiVideoProjectsTable: table }, {
    has: () => true,
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return table;
    },
  });
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => conditions,
    desc: (column: unknown) => column,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  };
});

vi.mock("../lib/check-credits", () => ({
  InsufficientCreditsError: class extends Error {},
  estimateCreditsForToolRequest: vi.fn(async () => 5),
  holdCreditsForToolRequest: vi.fn(async () => {
    state.holdCalls += 1;
    if (state.blockHold) {
      await new Promise<void>((resolve) => {
        state.releaseHold = resolve;
      });
    }
    if (state.holdError) throw state.holdError;
    return state.holdResult;
  }),
}));

vi.mock("../lib/credit-service", () => ({
  CreditService: {
    capture: vi.fn(),
    refund: state.refund,
  },
}));

vi.mock("../lib/ai-video-renderer", () => ({
  AI_VIDEO_RENDER_LEASE_MS: 180_000,
  AI_VIDEO_STORYBOARD_LEASE_MS: 180_000,
  aiVideoRenderCreditRequestId: (teacherId: number, projectId: number, key: string) =>
    `${teacherId}:ai-video-render:${projectId}:${key}`,
  aiVideoStoryboardCreditRequestId: (teacherId: number, key: string) =>
    `${teacherId}:ai-video:${key}`,
  failStaleAiVideoStoryboards: vi.fn(),
  startAiVideoRender: state.startRender,
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {},
}));

vi.mock("../lib/rate-limiter", () => ({
  sensitiveActionLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/ai-video-access", () => ({
  hasAiVideoAdminAccess: vi.fn(async () => true),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));

import express from "express";
import request from "supertest";
import aiVideoRouter from "../routes/ai-video-projects";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).session = { teacherId: 42 };
    (req as any).log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  instance.use("/api", aiVideoRouter);
  return instance;
}

beforeEach(() => {
  state.project = {
    id: 9,
    teacherId: 42,
    title: "Water cycle",
    status: "storyboard_ready",
    brief: {
      title: "Water cycle",
      topic: "Water",
      sourceImages: [],
      prompt: "",
      language: "en",
      durationSeconds: 30,
      aspectRatio: "16:9",
      visualStyle: "educational",
      voice: "nova",
      music: false,
      captions: true,
      idempotencyKey: "storyboard-key",
    },
    storyboard: {
      title: "Water cycle",
      version: 1,
      characters: [
        {
          id: "teacher",
          role: "teacher",
          displayName: "Ms River",
          appearance: "An adult science teacher wearing a blue jacket and round glasses.",
          voice: "Warm, measured adult female voice with a clear educational tone.",
        },
        {
          id: "student",
          role: "student",
          displayName: "Sam",
          appearance: "A curious school student wearing a green sweater and carrying a notebook.",
          voice: "Bright, youthful male voice with an inquisitive and energetic tone.",
        },
      ],
      scenes: Array.from({ length: 5 }, (_, index) => ({
        id: `scene-${index + 1}`,
        objective: `Objective ${index + 1}`,
        narration: `Question ${index + 1} Answer ${index + 1}`,
        onScreenText: `Text ${index + 1}`,
        visualPrompt: `Visual ${index + 1}`,
        durationSeconds: 6,
        transition: "cut",
        sourceImage: null,
        visibleCharacterIds: ["teacher", "student"],
        dialogue: [
          { speakerId: "student", text: `Question ${index + 1}`, delivery: "Curious and clear" },
          { speakerId: "teacher", text: `Answer ${index + 1}`, delivery: "Warm and concise" },
        ],
      })),
    },
    renderQuote: null,
    renderApproval: null,
    outputUrl: null,
    errorMessage: null,
    storyboardIdempotencyKey: "storyboard-key",
    storyboardLeaseId: null,
    storyboardLeaseExpiresAt: null,
    renderIdempotencyKey: null,
    renderLeaseId: null,
    renderLeaseExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.holdCalls = 0;
  state.releaseHold = null;
  state.blockHold = false;
  state.holdResult = { mode: "held", creditsHeld: 5, existingStatus: undefined };
  state.holdError = null;
  state.startRender.mockReset();
  state.refund.mockClear();
  state.assertRequestsResumable.mockReset().mockResolvedValue(undefined);
});

describe("AI video render idempotency", () => {
  it("blocks unresolved or terminal provider work before a quote, hold or new render", async () => {
    state.assertRequestsResumable.mockRejectedValue(new Error("Provider request needs reconciliation"));
    const deniedQuote = await request(app()).post("/api/ai-video/projects/9/render-quote");
    expect(deniedQuote.status).toBe(409);
    expect(deniedQuote.body.message).toContain("reconciliation");
    expect(state.holdCalls).toBe(0);
    expect(state.startRender).not.toHaveBeenCalled();

    state.assertRequestsResumable.mockResolvedValue(undefined);
    const quote = await request(app()).post("/api/ai-video/projects/9/render-quote");
    expect(quote.status).toBe(200);
    // Recheck at production time, not just when the earlier quote was issued.
    state.assertRequestsResumable.mockRejectedValue(new Error("Provider result is unusable"));
    const deniedRender = await request(app()).post("/api/ai-video/projects/9/render").send({
      idempotencyKey: "blocked-terminal-render",
      approval: { quoteId: quote.body.id, accepted: true, maxProviderCostUsd: 12 },
    });
    expect(deniedRender.status).toBe(409);
    expect(state.holdCalls).toBe(0);
    expect(state.startRender).not.toHaveBeenCalled();
  });

  it("keeps a concurrent duplicate on the same render and hold", async () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";
    const quote = await request(app()).post("/api/ai-video/projects/9/render-quote").send({
      providerCostUsd: 0.01,
      platformCredits: 1,
    });
    expect(quote.status).toBe(200);
    expect(quote.body.providerCostUsd).toBe(12);
    expect(quote.body.platformCredits).toBe(5);
    state.blockHold = true;
    const firstRequest = request(app())
      .post("/api/ai-video/projects/9/render")
      .send({
        idempotencyKey: key,
        approval: {
          quoteId: quote.body.id,
          accepted: true,
          maxProviderCostUsd: quote.body.totalEstimatedUsd,
        },
      })
      .then((response) => response);

    await expect(new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("render did not reach credit hold")), 1_000);
      const poll = () => {
        if (state.holdCalls > 0) {
          clearTimeout(deadline);
          resolve();
        } else {
          setImmediate(poll);
        }
      };
      poll();
    })).resolves.toBeUndefined();

    const duplicate = await request(app())
      .post("/api/ai-video/projects/9/render")
      .send({
        idempotencyKey: key,
        approval: {
          quoteId: quote.body.id,
          accepted: true,
          maxProviderCostUsd: quote.body.totalEstimatedUsd,
        },
      });
    state.releaseHold?.();
    const first = await firstRequest;

    expect(first.status).toBe(202);
    expect(duplicate.status).toBe(202);
    expect(first.body.id).toBe(9);
    expect(duplicate.body.id).toBe(9);
    expect(first.body.renderIdempotencyKey).toBe(key);
    expect(duplicate.body.renderIdempotencyKey).toBe(key);
    expect(state.holdCalls).toBe(1);
    expect(state.startRender).toHaveBeenCalledTimes(1);
    expect(state.refund).not.toHaveBeenCalled();
  });

  it("replays a completed render without another hold or provider start", async () => {
    state.project.status = "ready";
    state.project.outputUrl = "/objects/rendered.mp4";
    state.project.renderIdempotencyKey = "550e8400-e29b-41d4-a716-446655440000";

    const response = await request(app()).post("/api/ai-video/projects/9/render").send({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      approval: {
        quoteId: "550e8400-e29b-41d4-a716-446655440001",
        accepted: true,
        maxProviderCostUsd: 12,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.outputUrl).toBe("/objects/rendered.mp4");
    expect(state.holdCalls).toBe(0);
    expect(state.startRender).not.toHaveBeenCalled();
  });

  it.each([
    ["missing approval", undefined],
    ["false consent", {
      quoteId: "550e8400-e29b-41d4-a716-446655440001",
      accepted: false,
      maxProviderCostUsd: 12,
    }],
  ])("denies %s before a hold or provider start", async (_name, approval) => {
    const response = await request(app()).post("/api/ai-video/projects/9/render").send({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      ...(approval ? { approval } : {}),
    });

    expect(response.status).toBe(400);
    expect(state.holdCalls).toBe(0);
    expect(state.startRender).not.toHaveBeenCalled();
  });

  it.each(["stale", "edited", "wrong-budget"] as const)(
    "denies a %s approval before a hold or provider start",
    async (kind) => {
      const quoteResponse = await request(app()).post("/api/ai-video/projects/9/render-quote");
      expect(quoteResponse.status).toBe(200);
      if (kind === "stale") {
        state.project.renderQuote.expiresAt = new Date(Date.now() - 1_000).toISOString();
      } else if (kind === "edited") {
        state.project.storyboard.scenes[0].visualPrompt = "Edited after quote";
      }
      const response = await request(app()).post("/api/ai-video/projects/9/render").send({
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
        approval: {
          quoteId: quoteResponse.body.id,
          accepted: true,
          maxProviderCostUsd: kind === "wrong-budget"
            ? quoteResponse.body.totalEstimatedUsd + 1
            : quoteResponse.body.totalEstimatedUsd,
        },
      });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("RENDER_APPROVAL_REQUIRED");
      expect(state.holdCalls).toBe(0);
      expect(state.startRender).not.toHaveBeenCalled();
    },
  );

  it("does not let a consumed quote authorize a failed-render retry", async () => {
    const quote = await request(app()).post("/api/ai-video/projects/9/render-quote");
    const approval = {
      quoteId: quote.body.id,
      accepted: true,
      maxProviderCostUsd: quote.body.totalEstimatedUsd,
    };
    const first = await request(app()).post("/api/ai-video/projects/9/render").send({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      approval,
    });
    expect(first.status).toBe(202);
    expect(state.project.renderQuote).toBeNull();
    state.project.status = "failed";

    const retry = await request(app()).post("/api/ai-video/projects/9/retry-render").send({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440002",
      approval,
    });

    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe("RENDER_APPROVAL_REQUIRED");
    expect(state.holdCalls).toBe(1);
    expect(state.startRender).toHaveBeenCalledTimes(1);
  });

  it("refunds a newly-created mismatched hold and invalidates the quote", async () => {
    const quote = await request(app()).post("/api/ai-video/projects/9/render-quote");
    state.holdResult = { mode: "held", creditsHeld: 4, existingStatus: undefined };

    const response = await request(app()).post("/api/ai-video/projects/9/render").send({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      approval: {
        quoteId: quote.body.id,
        accepted: true,
        maxProviderCostUsd: quote.body.totalEstimatedUsd,
      },
    });

    expect(response.status).toBe(500);
    expect(state.refund).toHaveBeenCalledTimes(1);
    expect(state.project.status).toBe("storyboard_ready");
    expect(state.project.renderQuote).toBeNull();
    expect(state.startRender).not.toHaveBeenCalled();
  });
});