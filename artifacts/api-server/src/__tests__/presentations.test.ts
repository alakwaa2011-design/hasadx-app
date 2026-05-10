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
    presentationAssetsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionBankTable: stub,
    platformSettingsTable: stub,
    DEFAULT_PRESENTATION_LIMITS: { maxDecks: 1000, maxAssetMb: 100 },
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
import router from "../routes/presentations";

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

describe("presentations.ts — auth & ownership", () => {
  it("GET /presentations/:id returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).get("/api/presentations/5");
    expect(res.status).toBe(401);
  });

  it("GET /presentations/:id returns 403 when another teacher owns the deck", async () => {
    // GET does an innerJoin returning rows shaped as { deck, owner }.
    pushQueue([
      {
        deck: { id: 5, teacherId: 99, slides: [], language: "ar", isShared: false },
        owner: { id: 99, name: "Other", isAdmin: false },
      },
    ]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5",
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("PUT /presentations/:id returns 403 when another teacher owns the deck", async () => {
    pushQueue([{ id: 5, teacherId: 99, slides: [], language: "ar" }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/presentations/5")
      .send({ title: "New" });
    expect(res.status).toBe(403);
  });

  it("DELETE /presentations/:id returns 403 when another teacher owns the deck", async () => {
    pushQueue([{ id: 5, teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 })).delete(
      "/api/presentations/5",
    );
    expect(res.status).toBe(403);
  });

  it("POST /presentations/:id/publish returns 403 for a non-owner", async () => {
    pushQueue([{ id: 5, teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 })).post(
      "/api/presentations/5/publish",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/:id returns 404 when the deck does not exist", async () => {
    pushQueue([]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5",
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /presentations/:id/link-activity returns 403 for a non-owner", async () => {
    pushQueue([{ teacherId: 99 }]); // ownsPresentation()
    const res = await request(makeApp({ teacherId: 1 }))
      .patch("/api/presentations/5/link-activity")
      .send({ activityId: null, activityKind: "assignment" });
    expect(res.status).toBe(403);
  });

  it("GET /presentations/:id/linked-activity returns 403 for a non-owner of a non-shared deck", async () => {
    pushQueue([
      { teacherId: 99, isShared: false, ownerIsAdmin: false, linkedActivityId: null, linkedActivityKind: null },
    ]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5/linked-activity",
    );
    expect(res.status).toBe(403);
  });

  it("POST /presentations/:id/duplicate returns 403 for a non-owner of a non-shared deck", async () => {
    pushQueue([
      {
        deck: { id: 5, teacherId: 99, title: "x", slides: [], isShared: false },
        owner: { id: 99, name: "Other", isAdmin: false },
      },
    ]);
    const res = await request(makeApp({ teacherId: 1 })).post(
      "/api/presentations/5/duplicate",
    );
    expect(res.status).toBe(403);
  });

  it("GET /presentations/:id/assets returns 403 for a non-owner", async () => {
    pushQueue([{ teacherId: 99 }]); // ownsPresentation()
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/presentations/5/assets",
    );
    expect(res.status).toBe(403);
  });

  it("POST /presentations/:id/assets returns 403 for a non-owner", async () => {
    pushQueue([{ teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/5/assets")
      .send({ kind: "image", url: "https://example.com/a.png", byteSize: 0 });
    expect(res.status).toBe(403);
  });
});
