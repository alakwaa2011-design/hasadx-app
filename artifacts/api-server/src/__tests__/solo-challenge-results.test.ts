import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const inserted: unknown[] = [];
  const tx = {
    execute: vi.fn(() => Promise.resolve()),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const db = {
    select: vi.fn(),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  return { selectResults, inserted, tx, db };
});

vi.mock("@workspace/db", () => {
  const tableStub = new Proxy({}, {
    get: (_target, property) => (typeof property === "string" ? property : undefined),
  });
  const chain = (result: unknown) => {
    const builder: any = {
      from: () => builder,
      where: () => builder,
      limit: () => Promise.resolve(result),
    };
    return builder;
  };
  dbState.tx.select.mockImplementation(() => chain(dbState.selectResults.shift()));
  dbState.db.select.mockImplementation(() => chain(dbState.selectResults.shift()));
  dbState.tx.insert.mockImplementation(() => ({
    values: (payload: unknown) => {
      dbState.inserted.push(payload);
      return Promise.resolve();
    },
  }));
  dbState.tx.update.mockImplementation(() => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }));
  return {
    db: dbState.db,
    soloChallengeAttemptsTable: tableStub,
    soloChallengeScoresTable: tableStub,
  };
});

import { persistSoloChallengeResult } from "../lib/solo-challenge-results";

function makeGame() {
  return {
    soloChallengeSlug: "challenge",
    gameRunId: "run-123456789",
    questions: [{ id: 1 }, { id: 2 }, { id: 3 }] as any[],
    players: new Map([
      ["socket", {
        name: "طالب",
        isBot: false,
        score: 240,
        totalCorrect: 2,
        answers: new Map([
          [0, { time: 4000 }],
          [1, { time: 6000 }],
        ]),
      }],
    ]),
  } as any;
}

describe("persistSoloChallengeResult", () => {
  beforeEach(() => {
    dbState.selectResults.length = 0;
    dbState.inserted.length = 0;
    dbState.tx.execute.mockClear();
    dbState.db.transaction.mockClear();
  });

  it("stores the verified result with the participant capability and run size", async () => {
    dbState.selectResults.push([{ participantKey: "participant-key" }], []);

    await expect(persistSoloChallengeResult(makeGame())).resolves.toBe("created");

    expect(dbState.inserted).toEqual([expect.objectContaining({
      slug: "challenge",
      participantKey: "participant-key",
      gameRunId: "run-123456789",
      playerName: "طالب",
      score: 240,
      correctCount: 2,
      timeTaken: 10,
      totalQuestions: 3,
    })]);
  });

  it("returns duplicate without inserting the same run twice", async () => {
    dbState.selectResults.push(
      [{ participantKey: "participant-key" }],
      [{ gameRunId: "run-123456789", score: 240, correctCount: 2, timeTaken: 10 }],
    );

    await expect(persistSoloChallengeResult(makeGame())).resolves.toBe("duplicate");
    expect(dbState.inserted).toHaveLength(0);
  });
});