/**
 * Acceptance tests for the 2026-08 plans policy:
 * - Manual work creation (assignments) is NEVER limited by plan quotas —
 *   no 403 quota gate, no increment/refund calls to featureAccess.
 * - The plan-based daily outline cap for AI presentations is gone —
 *   /presentations/ai/limits reports no daily limit and the outline route
 *   never returns 429 DAILY_LIMIT_REACHED.
 * - Commercial tier capabilities (maxSlides, densities, Claude access)
 *   remain enforced.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
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
  return { queue, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
      execute: () => mockState.makeChain(mockState.queue.shift()),
      transaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => mockState.makeChain(mockState.queue.shift()),
          insert: () => mockState.makeChain(mockState.queue.shift()),
          update: () => mockState.makeChain(mockState.queue.shift()),
          delete: () => mockState.makeChain(mockState.queue.shift()),
        }),
    },
    assignmentsTable: stub,
    questionsTable: stub,
    teachersTable: stub,
    notificationsTable: stub,
    gameHistoryTable: stub,
    dismissedSharedTable: stub,
    studentsTable: stub,
    submissionsTable: stub,
    presentationsTable: stub,
    presentationAssetsTable: stub,
    presentationDraftsTable: stub,
    questionBankTable: stub,
    platformSettingsTable: stub,
    aiCache: stub,
    aiUsageDaily: stub,
    DEFAULT_PRESENTATION_LIMITS: { maxDecks: 1000, maxAssetMb: 100 },
  };
});

// featureAccess mocked to DENY everything — if any route still consults the
// old quota gate for manual work, the test fails loudly.
const denyGate = vi.hoisted(() => ({
  check: vi.fn(async () => ({ allowed: false, limit: 3, used: 3, remaining: 0, reason: "limit" })),
  increment: vi.fn(async () => ({ allowed: false, limit: 3, used: 3, remaining: 0, reason: "limit" })),
  refund: vi.fn(async () => undefined),
  getSubscription: vi.fn(async () => ({ planCode: "free", isAdmin: false })),
}));
vi.mock("@workspace/billing", () => ({ featureAccess: denyGate }));

vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: any, _res: any, next: any) => next(),
  captureCredits: async () => {},
  refundCredits: async () => {},
  invalidateCreditsSettingsCache: () => {},
}));

vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: vi.fn(async () => ({ runAfterCommit: async () => {} })),
}));

vi.mock("../lib/ai-tier", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../lib/ai-tier")>();
  return { ...orig, resolveTier: vi.fn(async () => "free" as const) };
});

import express from "express";
import request from "supertest";
import assignmentsRouter from "../routes/assignments";
import aiPresentationsRouter from "../routes/ai-presentations";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: Record<string, () => void> }).log = {
      info: () => {}, warn: () => {}, error: () => {},
    };
    next();
  });
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  mockState.queue.length = 0;
  denyGate.increment.mockClear();
  denyGate.refund.mockClear();
});

describe("policy: manual assignment creation is quota-free", () => {
  it("POST /assignments never consults the old create_homework quota (no 403 even when featureAccess would deny)", async () => {
    // Body intentionally fails a later validation (private without access
    // code) so we can assert the request got PAST any quota gate without
    // needing the full DB insert flow.
    const res = await request(makeApp(assignmentsRouter, { teacherId: 1 }))
      .post("/api/assignments")
      .send({ title: "واجب يدوي", subject: "رياضيات", accessMode: "private" });
    expect(res.status).toBe(400); // validation error, NOT a quota 403
    expect(res.status).not.toBe(403);
    expect(denyGate.increment).not.toHaveBeenCalled();
  });

  it("POST /assignments returns 201 with a valid body while featureAccess denies everything (Free beyond 3 / Basic beyond 20)", async () => {
    const row = {
      id: 77,
      title: "واجب يدوي",
      subject: "علوم",
      description: null,
      submissionMode: "both",
      accessMode: "public",
      accessCode: null,
      targetClass: null,
      targetClasses: null,
      showResults: true,
      teacherId: 1,
      modelImageBase64: null,
      deadline: null,
      createdAt: new Date("2026-08-18T10:00:00Z"),
      examMode: false,
      examDurationMinutes: null,
      resultsReleaseMode: "immediate",
    };
    mockState.queue.push(
      [row],                    // tx insert(assignments).returning()
      [{ id: 1, name: "أ. سارة" }], // teacher lookup after commit
    );
    const res = await request(makeApp(assignmentsRouter, { teacherId: 1 }))
      .post("/api/assignments")
      .send({ title: "واجب يدوي", subject: "علوم", questions: [] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(77);
    expect(denyGate.increment).not.toHaveBeenCalled();
    expect(denyGate.refund).not.toHaveBeenCalled();
  });
});

describe("policy: no plan-based daily outline cap for AI presentations", () => {
  it("GET /presentations/ai/limits reports no daily limit (nulls) while keeping tier capabilities", async () => {
    mockState.queue.push([{ n: 999 }]); // todaysOutlineCount — way past the old cap of 3
    const res = await request(makeApp(aiPresentationsRouter, { teacherId: 1 }))
      .get("/api/presentations/ai/limits");
    expect(res.status).toBe(200);
    expect(res.body.dailyOutlines).toBeNull();
    expect(res.body.remaining).toBeNull();
    // Commercial capabilities preserved for the free tier (12 since the
    // full-lesson default of 10-12 slides must fit the free plan):
    expect(res.body.maxSlides).toBe(12);
    expect(res.body.allowedDensities).toEqual(["balanced"]);
    expect(res.body.allowClaude).toBe(false);
  });

  it("POST /presentations/ai/outline still enforces the tier slide ceiling (commercial capability kept)", async () => {
    const res = await request(makeApp(aiPresentationsRouter, { teacherId: 1 }))
      .post("/api/presentations/ai/outline")
      .send({
        language: "ar", subject: "علوم", gradeLevel: "5", topic: "الماء",
        presentationKind: "explain", slideCount: 25, durationMinutes: 30,
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("LIMIT_EXCEEDED");
    expect(res.body.kind).toBe("slides");
  });
});
