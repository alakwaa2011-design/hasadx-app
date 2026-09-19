import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const executeQueue: unknown[] = [];
  const deleteQueue: unknown[] = [];

  function makeChain(result: unknown): unknown {
    const promise = Promise.resolve(result);
    return new Proxy(promise, {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return target[prop as "then" | "catch" | "finally"].bind(target);
        }
        return () => makeChain(result);
      },
    });
  }

  return { executeQueue, deleteQueue, makeChain };
});

const storageMocks = vi.hoisted(() => ({
  deleteObject: vi.fn(async () => true),
}));

vi.mock("@workspace/db", () => {
  const tableStub = new Proxy({}, {
    get: (_target, property) => (typeof property === "string" ? property : undefined),
  });
  const tx = {
    execute: () => dbMocks.makeChain(dbMocks.executeQueue.shift()),
    delete: () => dbMocks.makeChain(dbMocks.deleteQueue.shift()),
  };
  return {
    db: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    },
    assignmentsTable: tableStub,
    questionsTable: tableStub,
    soloChallengesTable: tableStub,
    soloChallengeScoresTable: tableStub,
    soloChallengeAttemptsTable: tableStub,
    submissionsTable: tableStub,
    studentsTable: tableStub,
  };
});

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    tryDeleteObjectEntity = storageMocks.deleteObject;
  },
}));
vi.mock("../lib/classroom-reward-evaluator", () => ({
  lockAssignmentRewardEvidence: vi.fn(async () => undefined),
  hasActiveAutomaticAssignmentGrant: vi.fn(async () => false),
}));
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
import soloChallengesRouter from "../routes/solo-challenges";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = { teacherId: 42 };
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use("/api", soloChallengesRouter);
  return app;
}

beforeEach(() => {
  dbMocks.executeQueue.length = 0;
  dbMocks.deleteQueue.length = 0;
  vi.clearAllMocks();
});

describe("DELETE /solo-challenges/:slug/submissions", () => {
  it("removes stored paper images after deleting linked submissions", async () => {
    dbMocks.executeQueue.push(
      { rows: [{ id: 8, teacher_id: 42, assignment_id: 17 }] },
      { rows: [{ id: 17, teacher_id: 42 }] },
      { rows: [{ id: 101 }] },
      { rows: [{ object_path: "/objects/uploads/submission-images/42/page-1.jpg" }] },
      { rows: [] },
    );
    dbMocks.deleteQueue.push(
      [{ id: 101 }],
      [{ id: 201 }],
      [{ id: 301 }],
    );

    const response = await request(makeApp())
      .delete("/api/solo-challenges/challenge-a/submissions");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      deletedScores: 1,
      deletedAttempts: 1,
      deletedAssignmentSubmissions: 1,
    });
    expect(storageMocks.deleteObject).toHaveBeenCalledWith(
      "/objects/uploads/submission-images/42/page-1.jpg",
    );
  });
});