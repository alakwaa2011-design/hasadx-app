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
    },
    presentationsTable: stub,
    presentationSessionsTable: stub,
    presentationResponsesTable: stub,
    teacherClassesTable: stub,
    studentsTable: stub,
    assignmentsTable: stub,
  };
});

import express from "express";
import request from "supertest";
import router from "../routes/presentation-sessions";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    next();
  });
  app.use("/api", router);
  return app;
}

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

beforeEach(() => {
  mockState.queue.length = 0;
});

describe("presentation-sessions.ts — auth & ownership", () => {
  it("POST /presentations/:id/sessions returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null))
      .post("/api/presentations/5/sessions")
      .send({});
    expect(res.status).toBe(401);
  });

  it("POST /presentations/:id/sessions returns 403 when another teacher owns the deck", async () => {
    // ownsPresentation() does one select on presentationsTable.
    pushQueue([{ teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/5/sessions")
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("POST /presentations/sessions/:id/end returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).post(
      "/api/presentations/sessions/77/end",
    );
    expect(res.status).toBe(401);
  });

  it("POST /presentations/sessions/:id/end returns 403 when the session belongs to another teacher", async () => {
    pushQueue([{ id: 77, teacherId: 99, presentationId: 5 }]);
    const res = await request(makeApp({ teacherId: 1 })).post(
      "/api/presentations/sessions/77/end",
    );
    expect(res.status).toBe(403);
  });

  it("POST /presentations/sessions/:id/end returns 404 when the session does not exist", async () => {
    pushQueue([]);
    const res = await request(makeApp({ teacherId: 1 })).post(
      "/api/presentations/sessions/77/end",
    );
    expect(res.status).toBe(404);
  });

  it("GET /presentations/sessions/:id returns 403 when the session belongs to another teacher", async () => {
    pushQueue([{ id: 77, teacherId: 99, presentationId: 5 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/sessions/77",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/sessions/:id/results returns 403 when the session belongs to another teacher", async () => {
    pushQueue([{ id: 77, teacherId: 99, presentationId: 5 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/sessions/77/results",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/:id/sessions/history returns 403 when another teacher owns the deck", async () => {
    pushQueue([{ teacherId: 99 }]); // ownsPresentation()
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5/sessions/history",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/:id/sessions/compare returns 403 when another teacher owns the deck", async () => {
    pushQueue([{ teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5/sessions/compare",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/sessions/:id/results.csv returns 403 when the session belongs to another teacher", async () => {
    pushQueue([{ id: 77, teacherId: 99, presentationId: 5 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/sessions/77/results.csv",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/sessions/:id/students.csv returns 403 when the session belongs to another teacher", async () => {
    pushQueue([{ id: 77, teacherId: 99, presentationId: 5 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/sessions/77/students.csv",
    );
    expect(res.status).toBe(403);
  });
});
