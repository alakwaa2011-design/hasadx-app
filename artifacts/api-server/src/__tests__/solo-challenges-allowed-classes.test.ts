import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => {
  const queue: unknown[] = [];
  const insertPayloads: unknown[] = [];
  const updatePayloads: unknown[] = [];

  function makeChain(result: unknown): unknown {
    const promise = Promise.resolve(result);
    return new Proxy(promise, {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const method = target[prop as "then" | "catch" | "finally"].bind(target);
          return method;
        }
        return () => makeChain(result);
      },
    });
  }

  return { queue, insertPayloads, updatePayloads, makeChain };
});

vi.mock("@workspace/db", () => {
  const tableStub = new Proxy({}, {
    get: (_target, property) => (typeof property === "string" ? property : undefined),
  });

  return {
    db: {
      select: () => dbState.makeChain(dbState.queue.shift()),
      insert: () => ({
        values: (payload: unknown) => {
          dbState.insertPayloads.push(payload);
          return dbState.makeChain(dbState.queue.shift());
        },
      }),
      update: () => ({
        set: (payload: unknown) => {
          dbState.updatePayloads.push(payload);
          return dbState.makeChain(dbState.queue.shift());
        },
      }),
    },
    assignmentsTable: tableStub,
    questionsTable: tableStub,
    soloChallengesTable: tableStub,
    soloChallengeScoresTable: tableStub,
    soloChallengeAttemptsTable: tableStub,
    studentsTable: tableStub,
  };
});

vi.mock("../game/manager", () => ({
  createGame: vi.fn(),
  deleteGame: vi.fn(),
  getGame: vi.fn(),
}));

vi.mock("../game/socket-handlers", () => ({
  startGameFromRest: vi.fn(),
}));

import express from "express";
import request from "supertest";
import router from "../routes/solo-challenges";

const ASSIGNMENT = {
  id: 17,
  title: "اختبار الصفوف",
  teacherId: 42,
  archivedAt: null,
};

const EXISTING_CHALLENGE = {
  id: 88,
  slug: "اختبار-الصفوف-ab12",
  shortSlug: "ikhtbar-alsofوف-ab12",
  playCount: 0,
  assignmentTitle: ASSIGNMENT.title,
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { teacherId: 42 };
    req.log = { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use("/api", router);
  return app;
}

function pushQueue(...results: unknown[]) {
  dbState.queue.push(...results);
}

beforeEach(() => {
  dbState.queue.length = 0;
  dbState.insertPayloads.length = 0;
  dbState.updatePayloads.length = 0;
});

describe("solo challenge allowedClasses persistence", () => {
  it("saves allowedClasses when creating a challenge from an assignment", async () => {
    pushQueue(
      [ASSIGNMENT],
      [],
      [{ slug: "اختبار-الصفوف-ab12", shortSlug: "ikhtbar-alsofوف-ab12" }],
    );

    const response = await request(makeApp())
      .post("/api/solo-challenges")
      .send({
        assignmentId: ASSIGNMENT.id,
        allowedClasses: [" الصف الرابع ", "", "الصف الخامس", 6],
      });

    expect(response.status).toBe(200);
    expect(dbState.insertPayloads).toHaveLength(1);
    expect(dbState.insertPayloads[0]).toMatchObject({
      assignmentId: ASSIGNMENT.id,
      teacherId: ASSIGNMENT.teacherId,
      allowedClasses: ["الصف الرابع", "الصف الخامس", "6"],
    });
  });

  it("preserves an existing restriction on unrelated updates and clears it only when requested", async () => {
    pushQueue([ASSIGNMENT], [EXISTING_CHALLENGE], undefined);

    const unrelatedUpdate = await request(makeApp())
      .post("/api/solo-challenges")
      .send({ assignmentId: ASSIGNMENT.id, timePerQuestion: 45 });

    expect(unrelatedUpdate.status).toBe(200);
    expect(dbState.updatePayloads[0]).toEqual({ timePerQuestion: 45 });
    expect(dbState.updatePayloads[0]).not.toHaveProperty("allowedClasses");

    pushQueue([ASSIGNMENT], [EXISTING_CHALLENGE], undefined);

    const clearUpdate = await request(makeApp())
      .post("/api/solo-challenges")
      .send({ assignmentId: ASSIGNMENT.id, allowedClasses: [] });

    expect(clearUpdate.status).toBe(200);
    expect(dbState.updatePayloads[1]).toEqual({ allowedClasses: null });
  });
});