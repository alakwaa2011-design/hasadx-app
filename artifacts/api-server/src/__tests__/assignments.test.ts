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
      execute: async () => undefined,
      transaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          select: () => mockState.makeChain(mockState.queue.shift()),
          insert: () => mockState.makeChain(mockState.queue.shift()),
          update: () => mockState.makeChain(mockState.queue.shift()),
          delete: () => mockState.makeChain(mockState.queue.shift()),
           execute: async () => undefined,
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
  };
});

vi.mock("@workspace/billing", () => ({
  featureAccess: {
    check: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    increment: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    refund: vi.fn(async () => undefined),
  },
}));

import express from "express";
import request from "supertest";
import router, { hasAssignmentId } from "../routes/assignments";
import { localizeApiMessages } from "../lib/request-locale";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    next();
  });
  // Mirrors production's single API registration-boundary localization layer.
  app.use("/api", localizeApiMessages);
  app.use("/api", router);
  return app;
}

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

beforeEach(() => {
  mockState.queue.length = 0;
});

describe("assignments.ts — auth & ownership", () => {
  it.each([
    ["en", "You must sign in first"],
    ["ar", "يجب تسجيل الدخول أولاً"],
  ])("localizes an assignment auth error for language=%s", async (language, message) => {
    const res = await request(makeApp(null))
      .post("/api/assignments")
      .send({ language });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message });
    expect(res.headers["content-language"]).toBe(language);
  });

  it("PUT /assignments/:id returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null))
      .put("/api/assignments/5")
      .send({ title: "X" });
    expect(res.status).toBe(401);
  });

  it("PUT /assignments/:id returns 403 when another teacher owns it", async () => {
    pushQueue([{ id: 5, teacherId: 99, title: "x", accessMode: "public" }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/assignments/5")
      .send({ title: "New" });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("غير مصرح لك بتعديل هذا الواجب");
  });

  it("PUT /assignments/:id returns 404 when the assignment is missing", async () => {
    pushQueue([]);
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/assignments/5")
      .send({ title: "New" });
    expect(res.status).toBe(404);
  });

  it("DELETE /assignments/:id returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).delete("/api/assignments/5");
    expect(res.status).toBe(401);
  });

  it("DELETE /assignments/:id returns 403 when another teacher owns it", async () => {
    pushQueue([{ id: 5, teacherId: 99, title: "x" }]);
    const res = await request(makeApp({ teacherId: 1 })).delete(
      "/api/assignments/5",
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("غير مصرح لك بحذف هذا الواجب");
  });

  it("POST /assignments/:id/duplicate returns 403 when another teacher owns it", async () => {
    pushQueue([{ id: 5, teacherId: 99, title: "x" }]);
    const res = await request(makeApp({ teacherId: 1 })).post(
      "/api/assignments/5/duplicate",
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("غير مصرح لك بنسخ هذا الواجب");
  });

  it("DELETE /assignments/:id/questions/:qid returns 403 when another teacher owns the assignment", async () => {
    pushQueue([{ id: 5, teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 })).delete(
      "/api/assignments/5/questions/77",
    ).send({ version: 1 });
    expect(res.status).toBe(403);
  });

  it("PATCH /assignments/:id/share returns 404 when another teacher owns the assignment", async () => {
    // The transaction's teacher-scoped lookup cannot see another owner's row.
    pushQueue([]);
    const res = await request(makeApp({ teacherId: 1 }))
      .patch("/api/assignments/5/share")
      .send({ isShared: true, version: 1 });
    expect(res.status).toBe(404);
  });
});

describe("assignments.ts — nullable game assignment", () => {
  it("skips game-history rows that are not linked to an assignment", () => {
    expect(hasAssignmentId({ assignmentId: null })).toBe(false);
    expect(hasAssignmentId({ assignmentId: 42 })).toBe(true);
  });
});
