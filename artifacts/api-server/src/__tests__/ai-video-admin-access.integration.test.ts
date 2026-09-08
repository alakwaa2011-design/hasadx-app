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

const ownedProject = {
  id: 9,
  teacherId: 42,
  title: "Owned project",
  status: "storyboard_ready",
  brief: {},
  storyboard: null,
  storyboardLeaseId: null,
  storyboardLeaseExpiresAt: null,
  renderLeaseId: null,
  renderLeaseExpiresAt: null,
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

vi.mock("../lib/credit-service", () => ({
  CreditService: {},
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    uploadBufferAsPrivate = mocks.upload;
  },
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

type Session = { teacherId?: number; isAdmin?: boolean } | undefined;

function app(session: Session = { teacherId: 42 }) {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).session = session;
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  instance.use(aiVideoRouter);
  return instance;
}

const endpoints = [
  ["post", "/ai-video/uploads/image", undefined],
  ["get", "/ai-video/projects", undefined],
  ["post", "/ai-video/projects/storyboard", { role: "admin" }],
  ["get", "/ai-video/projects/9", undefined],
  ["patch", "/ai-video/projects/9", { role: "admin" }],
  ["post", "/ai-video/projects/9/render", { role: "admin" }],
  ["post", "/ai-video/projects/9/retry-render", { role: "admin" }],
] as const;

describe("AI video admin route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue(true);
    mocks.select.mockImplementation(() => chain(() => [ownedProject]));
    mocks.update.mockImplementation(() => chain(() => []));
    mocks.insert.mockImplementation(() => chain(() => []));
  });

  it.each(endpoints)("denies non-admins before endpoint work: %s %s", async (method, path, body) => {
    mocks.access.mockResolvedValue(false);
    const pending = (request(app()) as any)[method](path);
    const response = body === undefined ? await pending : await pending.send(body);

    expect(response.status).toBe(403);
    expect(mocks.access).toHaveBeenCalledWith(42);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.startRender).not.toHaveBeenCalled();
  });

  it("returns 401 without a teacher session before checking admin access", async () => {
    const response = await request(app({})).get("/ai-video/projects");

    expect(response.status).toBe(401);
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("returns 503 when the admin lookup fails closed", async () => {
    mocks.access.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app()).get("/ai-video/projects");

    expect(response.status).toBe(503);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not trust session.isAdmin or an admin role in the request body", async () => {
    mocks.access.mockResolvedValue(false);

    const sessionSpoof = await request(app({ teacherId: 42, isAdmin: true }))
      .get("/ai-video/projects");
    const bodySpoof = await request(app())
      .post("/ai-video/projects/storyboard")
      .send({ role: "admin", isAdmin: true });

    expect(sessionSpoof.status).toBe(403);
    expect(bodySpoof.status).toBe(403);
    expect(mocks.access).toHaveBeenNthCalledWith(1, 42);
    expect(mocks.access).toHaveBeenNthCalledWith(2, 42);
  });

  it("allows a database-confirmed admin to list and get only owned projects", async () => {
    const list = await request(app()).get("/ai-video/projects");
    const get = await request(app()).get("/ai-video/projects/9");

    expect(list.status).toBe(200);
    expect(list.body.projects).toEqual([expect.objectContaining({ id: 9, teacherId: 42 })]);
    expect(get.status).toBe(200);
    expect(get.body).toEqual(expect.objectContaining({ id: 9, teacherId: 42 }));
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["post", "/ai-video/uploads/image"],
    ["post", "/ai-video/projects/storyboard"],
    ["patch", "/ai-video/projects/9"],
    ["post", "/ai-video/projects/9/render"],
    ["post", "/ai-video/projects/9/retry-render"],
  ] as const)("lets admins reach endpoint validation: %s %s", async (method, path) => {
    const response = await (request(app()) as any)[method](path).send({});

    expect(response.status).toBe(400);
    expect(mocks.access).toHaveBeenCalledWith(42);
    expect(mocks.holdCredits).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});