import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: {} as Record<string, any>,
  holdCalls: 0,
  releaseHold: null as null | (() => void),
  startRender: vi.fn(),
  refund: vi.fn(async () => {}),
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
  holdCreditsForToolRequest: vi.fn(async () => {
    state.holdCalls += 1;
    await new Promise<void>((resolve) => {
      state.releaseHold = resolve;
    });
    return { mode: "held", creditsHeld: 5 };
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
      scenes: Array.from({ length: 6 }, (_, index) => ({
        id: `scene-${index + 1}`,
        objective: `Objective ${index + 1}`,
        narration: `Narration ${index + 1}`,
        onScreenText: `Text ${index + 1}`,
        visualPrompt: `Visual ${index + 1}`,
        durationSeconds: 5,
        transition: "cut",
        sourceImage: null,
      })),
    },
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
  state.startRender.mockReset();
  state.refund.mockClear();
});

describe("AI video render idempotency", () => {
  it("keeps a concurrent duplicate on the same render and hold", async () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";
    const firstRequest = request(app())
      .post("/api/ai-video/projects/9/render")
      .send({ idempotencyKey: key })
      .then((response) => response);

    while (state.holdCalls === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const duplicate = await request(app())
      .post("/api/ai-video/projects/9/render")
      .send({ idempotencyKey: key });
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
});