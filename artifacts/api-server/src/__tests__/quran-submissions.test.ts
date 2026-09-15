import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const db = {
    select: vi.fn(() => chain(selectResults.shift() ?? [])),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };
  function chain(result: unknown): any {
    const promise = Promise.resolve(result);
    return new Proxy(promise, {
      get(target, property) {
        if (property === "then" || property === "catch" || property === "finally") {
          return (target as any)[property].bind(target);
        }
        return () => chain(result);
      },
    });
  }
  return { db, selectResults, chain, getObjectEntityFile: vi.fn(), signFileDownloadUrl: vi.fn() };
});

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: (_target, property) => property });
  return {
    db: state.db,
    quranCirclesTable: table,
    quranCircleMembersTable: table,
    quranProfilesTable: table,
    quranRecitationsTable: table,
    quranSubmissionsTable: table,
    quranWardsTable: table,
    studentsTable: table,
    teacherClassesTable: table,
  };
});

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityFile = state.getObjectEntityFile;
    signFileDownloadUrl = state.signFileDownloadUrl;
    getObjectEntityUploadURL = vi.fn();
    normalizeObjectEntityPath = vi.fn();
  },
}));

import quranRouter from "../routes/quran";

function makeApp(session: { teacherId?: number; studentAccountId?: number }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: typeof session }).session = session;
    next();
  });
  app.use("/api", quranRouter);
  return app;
}

const submission = {
  id: 7,
  wardId: 12,
  studentId: 31,
  status: "submitted",
  memorizationScore: null,
  recitationScore: null,
  mistakeCounts: null,
  feedback: null,
  contentType: "audio/webm",
  fileSize: 1200,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  state.selectResults.length = 0;
  state.db.select.mockClear();
  state.db.insert.mockReset();
  state.db.transaction.mockReset();
  state.getObjectEntityFile.mockReset();
  state.signFileDownloadUrl.mockReset();
});

describe("Quran submission authorization and idempotency", () => {
  it("returns the existing row on duplicate finalize without inserting again", async () => {
    state.selectResults.push(
      [{ id: 12, studentId: 31, teacherId: 4 }],
      [{ ...submission, objectPath: "/objects/uploads/quran-submissions/55/existing" }],
    );
    state.getObjectEntityFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{ contentType: "audio/webm", size: "1200" }]),
    });

    const response = await request(makeApp({ studentAccountId: 55 }))
      .post("/api/quran/me/submissions")
      .send({
        wardId: 12,
        objectPath: "/objects/uploads/quran-submissions/55/existing",
        clientRequestId: "request-1234",
      });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(7);
    expect(state.db.insert).not.toHaveBeenCalled();
  });

  it("rejects a unique-conflict replay when the object path differs", async () => {
    state.selectResults.push(
      [{ id: 12, studentId: 31, teacherId: 4 }],
      [],
      [{ ...submission, objectPath: "/objects/uploads/quran-submissions/55/original" }],
    );
    state.getObjectEntityFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{ contentType: "audio/webm", size: "1200" }]),
    });
    state.db.insert.mockReturnValue(state.chain([]));

    const response = await request(makeApp({ studentAccountId: 55 }))
      .post("/api/quran/me/submissions")
      .send({
        wardId: 12,
        objectPath: "/objects/uploads/quran-submissions/55/different",
        clientRequestId: "request-1234",
      });

    expect(response.status).toBe(409);
  });

  it("does not reveal a submission belonging to another student", async () => {
    state.selectResults.push([]);
    const response = await request(makeApp({ studentAccountId: 99 }))
      .get("/api/quran/me/submissions/7");
    expect(response.status).toBe(404);
  });

  it("does not reveal audio belonging to another teacher", async () => {
    state.selectResults.push([]);
    const response = await request(makeApp({ teacherId: 99 }))
      .get("/api/quran/submissions/7/audio-url");
    expect(response.status).toBe(404);
    expect(state.signFileDownloadUrl).not.toHaveBeenCalled();
  });

  it("replays an identical review and rejects a conflicting retry", async () => {
    const reviewed = {
      ...submission,
      status: "reviewed",
      memorizationScore: 92,
      recitationScore: 90,
      feedback: "حسن الأداء",
    };
    const tx = {
      update: vi.fn()
        .mockReturnValueOnce(state.chain([reviewed])) // claim submission
        .mockReturnValueOnce(state.chain([])) // complete ward
        .mockReturnValueOnce(state.chain([{ id: 101 }])), // claim recitation progress
      select: vi.fn()
        .mockReturnValueOnce(state.chain([{
          id: 12,
          studentId: 31,
          teacherId: 4,
          surahNumber: 1,
          endAyah: 7,
        }]))
        .mockReturnValueOnce(state.chain([{
          currentSurahNumber: null,
          currentAyah: null,
          progressPercent: 0,
          masteredAyahCount: 0,
          lastRecitedDate: null,
        }])),
      insert: vi.fn().mockReturnValue(state.chain([{
        id: 101,
        status: "completed",
        progressApplied: false,
      }])),
      execute: vi.fn().mockResolvedValue(undefined),
    };
    state.db.transaction.mockImplementationOnce(async (callback: (value: typeof tx) => unknown) => callback(tx));

    const first = await request(makeApp({ teacherId: 4 }))
      .patch("/api/quran/submissions/7/review")
      .send({ status: "reviewed", memorizationScore: 92, recitationScore: 90, feedback: "حسن الأداء" });
    expect(first.status).toBe(200);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(tx.execute).toHaveBeenCalledTimes(1);

    state.db.transaction.mockImplementationOnce(async () => null);
    state.selectResults.push([{
      ...reviewed,
      teacherId: 4,
      reviewedByTeacherId: 4,
    }]);
    const second = await request(makeApp({ teacherId: 4 }))
      .patch("/api/quran/submissions/7/review")
      .send({ status: "reviewed", memorizationScore: 92, recitationScore: 90, feedback: "حسن الأداء" });
    expect(second.status).toBe(200);
    expect(tx.insert).toHaveBeenCalledTimes(2);

    state.db.transaction.mockImplementationOnce(async () => null);
    state.selectResults.push([{
      ...reviewed,
      teacherId: 4,
      reviewedByTeacherId: 4,
    }]);
    const conflicting = await request(makeApp({ teacherId: 4 }))
      .patch("/api/quran/submissions/7/review")
      .send({ status: "reviewed", memorizationScore: 91, recitationScore: 90, feedback: "حسن الأداء" });
    expect(conflicting.status).toBe(409);
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });
});
