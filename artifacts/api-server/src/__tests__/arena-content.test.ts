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
    arenaCategoriesTable: stub,
    arenaActivitiesTable: stub,
    arenaQuestionReportsTable: stub,
    teachersTable: stub,
    platformSettingsTable: stub,
    DEFAULT_ARENA_IMPORT_SOURCES: { manual: true, ai: true, homework: true, file: true },
  };
});

import express from "express";
import request from "supertest";
import router from "../routes/arena-content";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session; log: unknown }).session =
      session ?? {};
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

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

beforeEach(() => {
  mockState.queue.length = 0;
});

// POST /arena-content/activities DB call order:
//   1. db.select → category lookup
//   2. db.select → isAdmin check (via isAdmin())
//   3. db.select → getArenaImportSources() — returns [] so DEFAULT_ARENA_IMPORT_SOURCES is used
//   4. db.insert → activity insert

describe("arena-content — activity difficulty validation (POST)", () => {
  it("accepts difficulty 200", async () => {
    pushQueue([{ id: 7, teacherId: 1, isPublic: false }]); // category
    pushQueue([{ isAdmin: false }]);                         // isAdmin
    pushQueue([]);                                           // getArenaImportSources → uses default (all enabled)
    pushQueue([{ id: 42, difficulty: 200, categoryId: 7 }]); // insert result
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 200, question: "ما عاصمة فرنسا؟", answer: "باريس" });
    expect(res.status).toBe(201);
    expect(res.body.difficulty).toBe(200);
  });

  it("accepts difficulty 400", async () => {
    pushQueue([{ id: 7, teacherId: 1, isPublic: false }]);
    pushQueue([{ isAdmin: false }]);
    pushQueue([]); // getArenaImportSources
    pushQueue([{ id: 43, difficulty: 400, categoryId: 7 }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 400, question: "ما عاصمة ألمانيا؟", answer: "برلين" });
    expect(res.status).toBe(201);
    expect(res.body.difficulty).toBe(400);
  });

  it("accepts difficulty 600", async () => {
    pushQueue([{ id: 7, teacherId: 1, isPublic: false }]);
    pushQueue([{ isAdmin: false }]);
    pushQueue([]); // getArenaImportSources
    pushQueue([{ id: 44, difficulty: 600, categoryId: 7 }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 600, question: "ما عاصمة اليابان؟", answer: "طوكيو" });
    expect(res.status).toBe(201);
    expect(res.body.difficulty).toBe(600);
  });

  it("accepts difficulty 800", async () => {
    pushQueue([{ id: 7, teacherId: 1, isPublic: false }]);
    pushQueue([{ isAdmin: false }]);
    pushQueue([]); // getArenaImportSources
    pushQueue([{ id: 45, difficulty: 800, categoryId: 7 }]);
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 800, question: "ما هي أصغر دولة في العالم من حيث المساحة؟", answer: "الفاتيكان" });
    expect(res.status).toBe(201);
    expect(res.body.difficulty).toBe(800);
  });

  it("rejects difficulty 1000 with 400", async () => {
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 1000, question: "سؤال", answer: "إجابة" });
    expect(res.status).toBe(400);
  });

  it("rejects difficulty 500 with 400", async () => {
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 500, question: "سؤال", answer: "إجابة" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(makeApp(null))
      .post("/api/arena-content/activities")
      .send({ categoryId: 7, difficulty: 800, question: "سؤال", answer: "إجابة" });
    expect(res.status).toBe(401);
  });
});

// PUT /arena-content/activities/:id DB call order:
//   1. db.select → existing activity lookup
//   2. db.select → isAdmin check (via isAdmin())
//   3. db.update → activity update (only on success)

describe("arena-content — activity difficulty validation (PUT)", () => {
  it("accepts difficulty 800 on update", async () => {
    pushQueue([{ id: 45, teacherId: 1, difficulty: 600 }]); // existing activity
    pushQueue([{ isAdmin: false }]);                          // isAdmin
    pushQueue([{ id: 45, difficulty: 800, categoryId: 7 }]); // update result
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/arena-content/activities/45")
      .send({ difficulty: 800 });
    expect(res.status).toBe(200);
    expect(res.body.difficulty).toBe(800);
  });

  it("rejects difficulty 300 on update with 400", async () => {
    pushQueue([{ id: 45, teacherId: 1, difficulty: 600 }]); // existing activity
    pushQueue([{ isAdmin: false }]);                          // isAdmin
    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/arena-content/activities/45")
      .send({ difficulty: 300 });
    expect(res.status).toBe(400);
  });
});
