import { describe, it, expect, beforeEach, vi } from "vitest";

/* Task #599 — auto-tag new live competitions so the library stays
 * current. This test covers the two server-side auto-tag paths:
 *
 *   1. POST /api/assignments with `fromPresentationSlide` set must
 *      insert the row with content_kind='competition' (bypassing the
 *      teacher's manual contentKind picker).
 *   2. POST /api/game-history/save/:pin must flip the underlying
 *      assignment's content_kind from 'homework' to 'competition'
 *      after the live game has been persisted.
 */

const calls = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; values: unknown }>,
  updates: [] as Array<{ table: string; set: unknown; whereCalled: boolean }>,
  selectResults: [] as unknown[],
  insertReturning: [] as unknown[],
}));

function tableName(stub: unknown): string {
  return (stub as { __tableName?: string }).__tableName ?? "?";
}

function makeSelectChain(result: unknown): any {
  const chain: any = {};
  const passthrough = ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit"];
  for (const m of passthrough) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (cb: (e: unknown) => unknown) => Promise.resolve(result).catch(cb);
  chain.finally = (cb: () => void) => Promise.resolve(result).finally(cb);
  return chain;
}

function makeInsertChain(table: string): any {
  const chain: any = {};
  chain.values = (vals: unknown) => {
    calls.inserts.push({ table, values: vals });
    return chain;
  };
  chain.returning = () => {
    const result = calls.insertReturning.shift() ?? [];
    return makeSelectChain(result);
  };
  chain.onConflictDoNothing = () => chain;
  // direct await on insert().values() — when no .returning() is used
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(undefined).then(resolve, reject);
  return chain;
}

function makeUpdateChain(table: string): any {
  const entry: { table: string; set: unknown; whereCalled: boolean } = {
    table,
    set: undefined,
    whereCalled: false,
  };
  calls.updates.push(entry);
  const chain: any = {};
  chain.set = (s: unknown) => {
    entry.set = s;
    return chain;
  };
  chain.where = () => {
    entry.whereCalled = true;
    return chain;
  };
  chain.returning = () => makeSelectChain([]);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(undefined).then(resolve, reject);
  return chain;
}

vi.mock("@workspace/db", () => {
  const mkStub = (name: string) => ({ __tableName: name });
  const makeDb = () => ({
    select: () => makeSelectChain(calls.selectResults.shift() ?? []),
    insert: (tbl: unknown) => makeInsertChain(tableName(tbl)),
    update: (tbl: unknown) => makeUpdateChain(tableName(tbl)),
    delete: () => makeSelectChain([]),
  });
  const dbInstance = {
    ...makeDb(),
    /* The assignments POST route wraps its inserts in a transaction.
       We implement it as a pass-through that provides the same mock
       interface to the callback, so the recorded calls/returning
       results work identically to the non-transaction path. */
    transaction: async (fn: (tx: ReturnType<typeof makeDb>) => unknown) => fn(makeDb()),
  };
  return {
    db: dbInstance,
    assignmentsTable: mkStub("assignments"),
    questionsTable: mkStub("questions"),
    teachersTable: mkStub("teachers"),
    notificationsTable: mkStub("notifications"),
    gameHistoryTable: mkStub("game_history"),
    dismissedSharedTable: mkStub("dismissed_shared"),
    studentsTable: mkStub("students"),
    submissionsTable: mkStub("submissions"),
    activityLogsTable: mkStub("activity_logs"),
  };
});

/* Stub out XP and activity-logger side effects so they don't consume
   queue slots or throw from missing table stubs. */
vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: vi.fn(async () => ({ runAfterCommit: async () => {} })),
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@workspace/billing", () => ({
  featureAccess: {
    check: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    increment: vi.fn(async () => ({ allowed: true, limit: null, used: 0, remaining: null })),
    refund: vi.fn(async () => undefined),
  },
}));

vi.mock("../game/manager.js", () => {
  return {
    getGame: vi.fn(),
    findActiveGameByTeacher: vi.fn(),
    getLeaderboard: vi.fn(() => []),
  };
});

import express from "express";
import request from "supertest";
import assignmentsRouter from "../routes/assignments";
import gameHistoryRouter from "../routes/game-history";
import * as manager from "../game/manager.js";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: { error: () => void; info: () => void } }).log = {
      error: () => undefined,
      info: () => undefined,
    };
    next();
  });
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  calls.inserts.length = 0;
  calls.updates.length = 0;
  calls.selectResults.length = 0;
  calls.insertReturning.length = 0;
});

describe("task #599 — auto-tag assignments as competitions", () => {
  it("POST /api/assignments forces content_kind='competition' when fromPresentationSlide is set", async () => {
    // insertReturning sequence:
    //   1. assignmentsTable insert → returning [{ id: 42, ... }]
    // selectResults sequence:
    //   1. teachersTable select → [{ name: "T" }]
    calls.insertReturning.push([
      {
        id: 42,
        title: "Activity Quiz",
        subject: "علوم",
        description: null,
        submissionMode: "both",
        accessMode: "public",
        accessCode: null,
        targetClass: null,
        targetClasses: null,
        showResults: true,
        teacherId: 7,
        modelImageBase64: null,
        totalPoints: 0,
        deadline: null,
        createdAt: new Date(),
        examMode: false,
        examDurationMinutes: null,
        resultsReleaseMode: "immediate",
      },
    ]);
    calls.selectResults.push([{ name: "T" }]);

    const res = await request(makeApp(assignmentsRouter, { teacherId: 7 }))
      .post("/api/assignments")
      .send({
        title: "Activity Quiz",
        subject: "علوم",
        // Teacher form left contentKind as default ('homework') — the
        // presentation-slide marker should override it.
        contentKind: "homework",
        fromPresentationSlide: "12:slide-3",
        questions: [
          { text: "س؟", questionType: "mcq", optionA: "A", optionB: "B", correctAnswer: "A", points: 1 },
        ],
      });

    expect(res.status).toBe(201);
    const assignmentInsert = calls.inserts.find((c) => c.table === "assignments");
    expect(assignmentInsert).toBeDefined();
    const v = assignmentInsert!.values as Record<string, unknown>;
    expect(v.contentKind).toBe("competition");
    expect(v.fromPresentationSlide).toBe("12:slide-3");
  });

  it("POST /api/assignments keeps content_kind='homework' when fromPresentationSlide is absent", async () => {
    calls.insertReturning.push([
      {
        id: 43,
        title: "Plain Homework",
        subject: "رياضيات",
        description: null,
        submissionMode: "both",
        accessMode: "public",
        accessCode: null,
        targetClass: null,
        targetClasses: null,
        showResults: true,
        teacherId: 7,
        modelImageBase64: null,
        totalPoints: 0,
        deadline: null,
        createdAt: new Date(),
        examMode: false,
        examDurationMinutes: null,
        resultsReleaseMode: "immediate",
      },
    ]);
    calls.selectResults.push([{ name: "T" }]);

    const res = await request(makeApp(assignmentsRouter, { teacherId: 7 }))
      .post("/api/assignments")
      .send({
        title: "Plain Homework",
        subject: "رياضيات",
        questions: [
          { text: "س؟", questionType: "mcq", optionA: "A", optionB: "B", correctAnswer: "A", points: 1 },
        ],
      });

    expect(res.status).toBe(201);
    const assignmentInsert = calls.inserts.find((c) => c.table === "assignments");
    const v = assignmentInsert!.values as Record<string, unknown>;
    expect(v.contentKind).toBe("homework");
    expect(v.fromPresentationSlide).toBeNull();
  });

  it("POST /api/game-history/save/:pin flips assignment content_kind to 'competition'", async () => {
    // selectResults: 1. existing-by-pin lookup → [] (not yet saved)
    calls.selectResults.push([]);
    // insertReturning: 1. game_history insert → [{ id: 99 }]
    calls.insertReturning.push([{ id: 99 }]);

    (manager.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      pin: "ABC123",
      teacherId: 7,
      assignmentId: 42,
      assignmentTitle: "Activity Quiz",
      questions: [],
      players: new Map(),
      gameMode: "solo",
    });

    const res = await request(makeApp(gameHistoryRouter, { teacherId: 7 }))
      .post("/api/game-history/save/ABC123")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The auto-tag UPDATE should target the assignments table.
    const assignmentUpdate = calls.updates.find((u) => u.table === "assignments");
    expect(assignmentUpdate).toBeDefined();
    expect(assignmentUpdate!.set).toEqual({ contentKind: "competition" });
    expect(assignmentUpdate!.whereCalled).toBe(true);
  });

  it("POST /api/game-history/save/:pin skips the auto-tag flip when assignmentId is 0 (bank game)", async () => {
    calls.selectResults.push([]);
    calls.insertReturning.push([{ id: 100 }]);

    (manager.getGame as ReturnType<typeof vi.fn>).mockReturnValue({
      pin: "XYZ999",
      teacherId: 7,
      assignmentId: 0, // bank/quick-challenge game with no assignment row
      assignmentTitle: "بنك الأسئلة",
      questions: [],
      players: new Map(),
      gameMode: "solo",
    });

    const res = await request(makeApp(gameHistoryRouter, { teacherId: 7 }))
      .post("/api/game-history/save/XYZ999")
      .send({});

    expect(res.status).toBe(200);
    const assignmentUpdate = calls.updates.find((u) => u.table === "assignments");
    expect(assignmentUpdate).toBeUndefined();
  });
});
