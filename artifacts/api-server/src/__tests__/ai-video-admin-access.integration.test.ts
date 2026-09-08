import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  holdCredits: vi.fn(),
  provider: vi.fn(),
  upload: vi.fn(),
  startRender: vi.fn(),
}));

function chain(result: () => unknown): any {
  return new Proxy(function () {}, {
    get(_target, property) {
      if (property === "then" || property === "catch" || property === "finally") {
        const promise = Promise.resolve(result());
        return (promise as any)[property].bind(promise);
      }
      return () => chain(result);
    },
    apply: () => chain(result),
  });
}

const briefBase = {
  title: "Lesson",
  topic: "Water",
  sourceImages: [],
  prompt: "",
  language: "ar",
  durationSeconds: 30,
  aspectRatio: "16:9",
  visualStyle: "educational",
  voice: "nova",
  music: false,
  captions: true,
  idempotencyKey: "project-key-123",
};

const economyProject = {
  id: 9,
  teacherId: 42,
  title: "Economy",
  status: "storyboard_ready",
  brief: { ...briefBase, mode: "narrated_images" },
  storyboard: null,
  storyboardLeaseId: null,
  storyboardLeaseExpiresAt: null,
  renderLeaseId: null,
  renderLeaseExpiresAt: null,
};

const advancedProject = {
  ...economyProject,
  id: 10,
  title: "Advanced",
  brief: { ...briefBase, mode: "realistic_motion", idempotencyKey: "advanced-key-123" },
};

vi.mock("../lib/ai-video-access", () => ({
  hasAiVideoAdminAccess: mocks.access,
}));

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: (_target, property) => String(property) });
  return {
    aiVideoProjectsTable: table,
    creditHoldsTable: table,
    creditTransactionsTable: table,
    db: {
      select: mocks.select,
      update: mocks.update,
      insert: mocks.insert,
    },
  };
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
  holdCreditsForToolRequest: mocks.holdCredits,
}));
vi.mock("../lib/credit-service", () => ({ CreditService: {} }));
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class { uploadBufferAsPrivate = mocks.upload; },
}));
vi.mock("../lib/ai-video-renderer", () => ({
  AI_VIDEO_RENDER_LEASE_MS: 180_000,
  AI_VIDEO_STORYBOARD_LEASE_MS: 180_000,
  aiVideoRenderCreditRequestId: vi.fn(),
  aiVideoStoryboardCreditRequestId: vi.fn(),
  failStaleAiVideoStoryboards: vi.fn(),
  startAiVideoRender: mocks.startRender,
}));
vi.mock("../lib/rate-limiter", () => ({
  sensitiveActionLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.provider } } },
}));

import aiVideoRouter from "../routes/ai-video-projects";

function app(teacherId?: number) {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).session = teacherId ? { teacherId } : {};
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  instance.use(aiVideoRouter);
  return instance;
}

describe("Administrator-only AI video access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue(false);
    mocks.select.mockImplementation(() => chain(() => [economyProject, advancedProject]));
    mocks.update.mockImplementation(() => chain(() => []));
    mocks.insert.mockImplementation(() => chain(() => []));
  });

  it("requires an authenticated teacher", async () => {
    const response = await request(app()).get("/ai-video/projects");
    expect(response.status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("blocks an ordinary teacher from listing narrated-image projects", async () => {
    const response = await request(app(42)).get("/ai-video/projects");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ADMIN_ONLY");
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("blocks an ordinary teacher from reopening an owned narrated-image project", async () => {
    mocks.select.mockImplementation(() => chain(() => [economyProject]));
    const response = await request(app(42)).get("/ai-video/projects/9");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ADMIN_ONLY");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.access).toHaveBeenCalledWith(42);
  });

  it("blocks an ordinary teacher from an owned advanced project", async () => {
    mocks.select.mockImplementation(() => chain(() => [advancedProject]));
    const response = await request(app(42)).get("/ai-video/projects/10");
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("ADMIN_ONLY");
    expect(mocks.access).toHaveBeenCalledWith(42);
  });

  it("blocks a valid advanced storyboard request before provider or credits", async () => {
    const response = await request(app(42))
      .post("/ai-video/projects/storyboard")
      .send({ ...briefBase, mode: "realistic_motion" });
    expect(response.status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("lets a database-confirmed admin list both modes", async () => {
    mocks.access.mockResolvedValue(true);
    const response = await request(app(42)).get("/ai-video/projects");
    expect(response.status).toBe(200);
    expect(response.body.projects.map((project: { id: number }) => project.id)).toEqual([9, 10]);
  });
});