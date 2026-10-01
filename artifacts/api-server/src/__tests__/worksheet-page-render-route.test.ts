import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  errors: [] as unknown[],
  selects: 0,
  render: vi.fn(async () => Buffer.from("png-bytes")),
}));

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: () => ({}) });
  function chain(result: unknown): unknown {
    const promise = Promise.resolve(result);
    return new Proxy(promise, {
      get(target, property) {
        if (["then", "catch", "finally"].includes(String(property))) {
          return (target as any)[property].bind(target);
        }
        return () => chain(result);
      },
    });
  }
  return {
    db: { select: () => { state.selects += 1; return chain(state.rows.shift()); } },
    worksheetsTable: table,
    teachersTable: table,
    assignmentsTable: table,
    questionsTable: table,
    submissionsTable: table,
    answersTable: table,
    studentsTable: table,
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  captureCredits: vi.fn(),
  captureCreditsOrThrow: vi.fn(),
  refundCredits: vi.fn(),
}));
vi.mock("@workspace/billing", () => ({ featureAccess: { check: vi.fn(), increment: vi.fn() } }));
vi.mock("../lib/xp/socket", () => ({ awardXpInTxAndNotifyAfterCommit: vi.fn() }));
vi.mock("../lib/xp/engine", () => ({ reverseXpIfWithinWindow: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("../lib/ai-tier", () => ({
  resolveTier: vi.fn(),
  modelForTier: vi.fn(),
  isClaudeTier: vi.fn(),
}));
vi.mock("../lib/anthropic-client", () => ({ anthropic: {}, SONNET_MODEL: "test-model" }));
vi.mock("../lib/worksheet-grading", () => ({ normalizeArabicName: (value: string) => value }));
vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  processUploadedFiles: vi.fn(),
  runVisionCompletionMulti: vi.fn(),
}));
vi.mock("../lib/ai-content-language", () => ({ resolveAiContentLanguage: vi.fn() }));
vi.mock("../lib/ai-usage-ledger", () => ({ trackAiUsageCall: vi.fn() }));
vi.mock("../lib/objectStorage", () => ({ ObjectStorageService: class {} }));
vi.mock("../lib/worksheet-page-render", () => ({
  renderWorksheetPage: state.render,
  WorksheetPageRenderError: class WorksheetPageRenderError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 422) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import express from "express";
import request from "supertest";
import worksheetsRouter from "../routes/worksheets";

const ownerRow = {
  worksheet: { id: 4, teacherId: 1, isShared: false },
  owner: { isAdmin: false },
};

function makeApp(teacherId: number | null = 1) {
  const app = express();
  app.use(express.json({ limit: "3mb" }));
  app.use((req, _res, next) => {
    (req as any).session = teacherId === null ? {} : { teacherId };
    (req as any).log = { info() {}, warn() {}, error: (entry: unknown) => state.errors.push(entry) };
    next();
  });
  app.use("/api", worksheetsRouter);
  return app;
}

beforeEach(() => {
  state.rows = [];
  state.errors = [];
  state.selects = 0;
  state.render.mockClear();
});

describe("POST /api/worksheets/:id/render-page", () => {
  it("requires an authenticated teacher", async () => {
    const response = await request(makeApp(null))
      .post("/api/worksheets/4/render-page")
      .send({ html: "<h1>عنوان عربي</h1>", width: 600, height: 800 });
    expect(response.status).toBe(401);
  });

  it("validates dimensions and rejects HTML over 2 MB before rendering", async () => {
    const invalidDimensions = await request(makeApp())
      .post("/api/worksheets/4/render-page")
      .send({ html: "<h1>عنوان</h1>", width: 99, height: 800 });
    expect(invalidDimensions.status).toBe(400);

    const tooLarge = await request(makeApp())
      .post("/api/worksheets/4/render-page")
      .send({ html: "x".repeat(2 * 1024 * 1024 + 1), width: 600, height: 800 });
    expect(tooLarge.status).toBe(413);
    expect(state.render).not.toHaveBeenCalled();
  });

  it("enforces worksheet access and returns an uncacheable PNG for an owner", async () => {
    state.rows = [[{ ...ownerRow, worksheet: { ...ownerRow.worksheet, teacherId: 2 } }]];
    const forbidden = await request(makeApp(1))
      .post("/api/worksheets/4/render-page")
      .send({ html: "<h1>عنوان عربي</h1>", width: 600, height: 800 });
    expect(state.errors).toEqual([]);
    expect(state.selects).toBe(1);
    expect(forbidden.status).toBe(403);
    expect(state.render).not.toHaveBeenCalled();

    state.rows = [[ownerRow]];
    const rendered = await request(makeApp(1))
      .post("/api/worksheets/4/render-page")
      .send({ html: "<h1>عنوان عربي</h1>", width: 600, height: 800 });
    expect(rendered.status).toBe(200);
    expect(rendered.headers["content-type"]).toContain("image/png");
    expect(rendered.headers["cache-control"]).toBe("private, no-store");
    expect(rendered.body).toEqual(Buffer.from("png-bytes"));
    expect(state.render).toHaveBeenCalledWith("<h1>عنوان عربي</h1>", 600, 800);

    state.rows = [[{
      worksheet: { id: 4, teacherId: 2, isShared: true },
      owner: { isAdmin: true },
    }]];
    const shared = await request(makeApp(1))
      .post("/api/worksheets/4/render-page")
      .send({ html: "<h1>عنوان منشور</h1>", width: 600, height: 800 });
    expect(shared.status).toBe(200);
  });
});