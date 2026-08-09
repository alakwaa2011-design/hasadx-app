/**
 * Regression tests: the worksheet grading link (linkedAssignmentId) points at
 * an internal assignment whose submissions contain student names/scores.
 * It must never be exposed to teachers who don't own the worksheet (e.g. via
 * the admin-shared library), and the submissions endpoint must reject
 * non-owners of worksheet-internal assignments.
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
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    },
    worksheetsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionsTable: stub,
    submissionsTable: stub,
    answersTable: stub,
    notificationsTable: stub,
    examSessionsTable: stub,
    studentsTable: stub,
  };
});

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));
vi.mock("../lib/anthropic-client", () => ({ anthropic: {}, SONNET_MODEL: "m" }));
vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => ({ runAfterCommit: async () => {} }),
}));
vi.mock("../lib/xp/engine", () => ({ reverseXpIfWithinWindow: async () => {} }));
vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  captureCredits: async () => {},
  refundCredits: async () => {},
}));
vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  processUploadedFiles: async () => [],
  runVisionCompletionMulti: async () => "",
}));
vi.mock("../lib/rate-limiter", () => ({
  imageUploadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from "express";
import request from "supertest";
import worksheetsRouter from "../routes/worksheets";
import submissionsRouter from "../routes/submissions";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: unknown }).log = {
      error: () => {},
      info: () => {},
      warn: () => {},
    };
    next();
  });
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  mockState.queue.length = 0;
});

describe("GET /worksheets — linkedAssignmentId exposure", () => {
  it("hides linkedAssignmentId for admin-shared worksheets not owned by the caller", async () => {
    mockState.queue.push([
      {
        id: 1, teacherId: 7, title: "خاصتي", isShared: false,
        linkedAssignmentId: 100, ownerName: "أنا", ownerIsAdmin: false,
      },
      {
        id: 2, teacherId: 1, title: "مشتركة من المشرف", isShared: true,
        linkedAssignmentId: 200, ownerName: "المشرف", ownerIsAdmin: true,
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets");
    expect(res.status).toBe(200);
    const own = res.body.find((w: any) => w.id === 1);
    const shared = res.body.find((w: any) => w.id === 2);
    expect(own.linkedAssignmentId).toBe(100);
    expect(shared.linkedAssignmentId).toBeNull();
  });
});

describe("GET /worksheets/:id — linkedAssignmentId exposure", () => {
  it("hides linkedAssignmentId when reading an admin-shared worksheet as non-owner", async () => {
    mockState.queue.push([
      {
        worksheet: { id: 2, teacherId: 1, title: "مشتركة", isShared: true, linkedAssignmentId: 200 },
        owner: { id: 1, name: "المشرف", isAdmin: true },
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets/2");
    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
    expect(res.body.linkedAssignmentId).toBeNull();
  });

  it("keeps linkedAssignmentId for the owner", async () => {
    mockState.queue.push([
      {
        worksheet: { id: 1, teacherId: 7, title: "خاصتي", isShared: false, linkedAssignmentId: 100 },
        owner: { id: 7, name: "أنا", isAdmin: false },
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets/1");
    expect(res.status).toBe(200);
    expect(res.body.linkedAssignmentId).toBe(100);
  });
});

describe("GET /assignments/:id/submissions — worksheet-internal assignments", () => {
  it("rejects a teacher who does not own the worksheet-source assignment", async () => {
    mockState.queue.push([{ teacherId: 1, source: "worksheet" }]);
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(makeApp(submissionsRouter, null))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(401);
  });

  it("allows the owning teacher", async () => {
    mockState.queue.push(
      [{ teacherId: 7, source: "worksheet" }],
      [
        {
          id: 5, studentId: null, studentName: "طالب", studentClass: null,
          score: 80, totalQuestions: 5, correctAnswers: 4, earnedPoints: 4,
          totalPoints: 5, teacherAdjustedPoints: null, teacherNote: null,
          aiFeedback: null, durationSeconds: null, submittedAt: new Date("2026-01-01"),
        },
      ],
    );
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(200);
    expect(res.body[0].studentName).toBe("طالب");
  });
});
