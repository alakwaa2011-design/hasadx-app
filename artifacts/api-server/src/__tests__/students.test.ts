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
    studentsTable: stub,
    studentAccountsTable: stub,
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
import router from "../routes/students";

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

describe("students.ts — auth & ownership", () => {
  it("PUT /students/:id returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null))
      .put("/api/students/5")
      .send({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("PUT /students/:id returns 404 when the row belongs to another teacher", async () => {
    // The query is `and(id=5, teacherId=1)` so a row owned by teacher 99
    // is NOT returned for teacher 1 — handler responds 404 ("not found"),
    // which is the documented "whichever is correct" status here.
    pushQueue([]); // ownership-scoped lookup returns no row
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/students/5")
      .send({ name: "X" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("الطالب غير موجود");
  });

  it("PUT /students/:id allows the owner through", async () => {
    pushQueue(
      [{ id: 5, teacherId: 1, name: "Y" }], // ownership lookup
      [{ id: 5, teacherId: 1, name: "Y" }], // update().returning()
    );
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/students/5")
      .send({ name: "Y" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
  });

  it("DELETE /students/:id returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).delete("/api/students/5");
    expect(res.status).toBe(401);
  });

  it("DELETE /students/:id returns 404 when the row belongs to another teacher", async () => {
    pushQueue([]); // ownership-scoped lookup returns no row
    const res = await request(makeApp({ teacherId: 1 })).delete(
      "/api/students/5",
    );
    expect(res.status).toBe(404);
  });

  it("GET /students returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).get("/api/students");
    expect(res.status).toBe(401);
  });
});
