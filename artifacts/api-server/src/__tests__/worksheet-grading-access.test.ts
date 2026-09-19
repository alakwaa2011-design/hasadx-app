/**
 * Regression tests: the worksheet grading link (linkedAssignmentId) points at
 * an internal assignment whose submissions contain student names/scores.
 * It must never be exposed to teachers who don't own the worksheet (e.g. via
 * the admin-shared library), and the submissions endpoint must reject
 * non-owners of worksheet-internal assignments.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  let transactionError: Error | null = null;
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
  return {
    queue,
    makeChain,
    get transactionError() { return transactionError; },
    set transactionError(error: Error | null) { transactionError = error; },
  };
});

const storageMocks = vi.hoisted(() => ({
  getFile: vi.fn(async (path: string) => ({ path })),
  sign: vi.fn(async (_file: unknown, _ttlSec: number) => "https://signed.example/page"),
  deleteObject: vi.fn(async () => true),
  uploadPrivate: vi.fn(async () => "/objects/uploads/submission-images/7/new-page.jpg"),
}));

const aiMocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  const db: Record<string, unknown> = {};
  Object.assign(db, {
    execute: () => mockState.makeChain(mockState.queue.shift()),
    select: () => mockState.makeChain(mockState.queue.shift()),
    insert: () => mockState.makeChain(mockState.queue.shift()),
    update: () => mockState.makeChain(mockState.queue.shift()),
    delete: () => mockState.makeChain(mockState.queue.shift()),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (mockState.transactionError) throw mockState.transactionError;
      return fn(db);
    },
  });
  return {
    db,
    worksheetsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionsTable: stub,
    submissionsTable: stub,
    submissionImagesTable: stub,
    answersTable: stub,
    notificationsTable: stub,
    examSessionsTable: stub,
    studentsTable: stub,
  };
});

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: aiMocks.create } } },
}));
vi.mock("../lib/objectStorage", () => ({
  detectUploadType: (bytes: Buffer) => {
    if (bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "image/jpeg";
    if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
    if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
      return "image/webp";
    }
    return null;
  },
  ObjectStorageService: class {
    getObjectEntityFile = storageMocks.getFile;
    signFileDownloadUrl = storageMocks.sign;
    tryDeleteObjectEntity = storageMocks.deleteObject;
    uploadBufferAsPrivate = storageMocks.uploadPrivate;
  },
}));
vi.mock("../lib/ai-usage-ledger", () => ({
  trackAiUsageCall: async (
    _req: unknown,
    _config: unknown,
    call: () => Promise<unknown>,
  ) => call(),
}));
vi.mock("../lib/anthropic-client", () => ({ anthropic: {}, SONNET_MODEL: "m" }));
vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => ({ runAfterCommit: async () => {} }),
}));
vi.mock("../lib/xp/engine", () => ({ reverseXpIfWithinWindow: async () => {} }));
vi.mock("../lib/classroom-reward-evaluator", () => ({
  evaluateClassroomRewardEvidence: async () => [],
  lockAssignmentRewardEvidence: async () => {},
  hasActiveAutomaticAssignmentGrant: async () => false,
}));
vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  captureCredits: async () => {},
  refundCredits: async () => {},
}));
vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  processUploadedFiles: async () => [],
  runVisionCompletionMulti: async () => "",
}));
vi.mock("../lib/rate-limiter", () => ({
  imageUploadLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from "express";
import request from "supertest";
import worksheetsRouter from "../routes/worksheets";
import submissionsRouter from "../routes/submissions";

type Session = { teacherId?: number };

function makeApp(router: express.Router, session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
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

beforeEach(() => {
  mockState.queue.length = 0;
  mockState.transactionError = null;
  vi.clearAllMocks();
});

describe("GET /worksheets — linkedAssignmentId exposure", () => {
  it("hides linkedAssignmentId for admin-shared worksheets not owned by the caller", async () => {
    mockState.queue.push([
      {
        id: 1, teacherId: 7, title: "خاصتي", isShared: false,
        linkedAssignmentId: 100, ownerName: "أنا", ownerIsAdmin: false,
      },
      {
        id: 2, teacherId: 1, title: "مشتركة من المشرف", isShared: true,
        linkedAssignmentId: 200, ownerName: "المشرف", ownerIsAdmin: true,
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets");
    expect(res.status).toBe(200);
    const own = res.body.find((w: any) => w.id === 1);
    const shared = res.body.find((w: any) => w.id === 2);
    expect(own.linkedAssignmentId).toBe(100);
    expect(shared.linkedAssignmentId).toBeNull();
  });
});

describe("GET /worksheets/:id — linkedAssignmentId exposure", () => {
  it("hides linkedAssignmentId when reading an admin-shared worksheet as non-owner", async () => {
    mockState.queue.push([
      {
        worksheet: { id: 2, teacherId: 1, title: "مشتركة", isShared: true, linkedAssignmentId: 200 },
        owner: { id: 1, name: "المشرف", isAdmin: true },
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets/2");
    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
    expect(res.body.linkedAssignmentId).toBeNull();
  });

  it("keeps linkedAssignmentId for the owner", async () => {
    mockState.queue.push([
      {
        worksheet: { id: 1, teacherId: 7, title: "خاصتي", isShared: false, linkedAssignmentId: 100 },
        owner: { id: 7, name: "أنا", isAdmin: false },
      },
    ]);
    const res = await request(makeApp(worksheetsRouter, { teacherId: 7 })).get("/api/worksheets/1");
    expect(res.status).toBe(200);
    expect(res.body.linkedAssignmentId).toBe(100);
  });
});

describe("GET /assignments/:id/submissions — worksheet-internal assignments", () => {
  it("rejects a teacher who does not own the worksheet-source assignment", async () => {
    mockState.queue.push([{ teacherId: 1, source: "worksheet" }]);
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(makeApp(submissionsRouter, null))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(401);
  });

  it("allows the owning teacher", async () => {
    mockState.queue.push(
      [{ teacherId: 7, source: "worksheet" }],
      [
        {
          id: 5, studentId: null, studentName: "طالب", studentClass: null,
          score: 80, totalQuestions: 5, correctAnswers: 4, earnedPoints: 4,
          totalPoints: 5, teacherAdjustedPoints: null, teacherNote: null,
          aiFeedback: null, durationSeconds: null, submittedAt: new Date("2026-01-01"),
        },
      ],
    );
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/assignments/200/submissions");
    expect(res.status).toBe(200);
    expect(res.body[0].studentName).toBe("طالب");
  });
});

describe("DELETE /assignments/:id/submissions", () => {
  it("requires an authenticated teacher", async () => {
    const res = await request(makeApp(submissionsRouter, null))
      .delete("/api/assignments/200/submissions");
    expect(res.status).toBe(401);
  });

  it("does not let another teacher delete the submissions", async () => {
    mockState.queue.push({ rows: [{ id: 200, teacher_id: 1 }] });
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .delete("/api/assignments/200/submissions");
    expect(res.status).toBe(403);
  });

  it("deletes every submission for the owner and returns the count", async () => {
    mockState.queue.push(
      { rows: [{ id: 200, teacher_id: 7 }] },
      { rows: [{ id: 10 }, { id: 11 }] },
      [{ objectPath: "/objects/uploads/submission-images/7/page-a.jpg" }],
      { rows: [] },
      [{ id: 10 }, { id: 11 }],
    );
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .delete("/api/assignments/200/submissions");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedCount: 2 });
    expect(storageMocks.deleteObject).toHaveBeenCalledWith("/objects/uploads/submission-images/7/page-a.jpg");
  });
});

describe("GET /submissions/:submissionId/details — stored paper pages", () => {
  const submission = {
    id: 5,
    assignmentId: 200,
    studentName: "طالب",
    studentClass: "5أ",
    score: 80,
    totalQuestions: 1,
    correctAnswers: 1,
    earnedPoints: 1,
    totalPoints: 1,
    teacherAdjustedPoints: null,
    teacherNote: null,
    aiFeedback: null,
    durationSeconds: null,
    submittedAt: new Date("2026-01-01"),
  };

  it("rejects a non-owner before signing any image URL", async () => {
    mockState.queue.push([submission], [{ teacherId: 1 }]);
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/submissions/5/details");
    expect(res.status).toBe(403);
    expect(storageMocks.sign).not.toHaveBeenCalled();
  });

  it("returns old submissions without images safely", async () => {
    mockState.queue.push([submission], [{ teacherId: 7 }], [], []);
    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/submissions/5/details");
    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([]);
  });

  it("signs owned pages in stored page order with a five-minute lifetime", async () => {
    mockState.queue.push(
      [submission],
      [{ teacherId: 7 }],
      [],
      [
        { pageNumber: 1, objectPath: "/objects/uploads/submission-images/7/page-a.jpg" },
        { pageNumber: 2, objectPath: "/objects/uploads/submission-images/7/page-b.jpg" },
      ],
    );
    storageMocks.sign
      .mockResolvedValueOnce("https://signed.example/page-1")
      .mockResolvedValueOnce("https://signed.example/page-2");

    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .get("/api/submissions/5/details");

    expect(res.status).toBe(200);
    expect(res.body.images).toEqual([
      { pageNumber: 1, url: "https://signed.example/page-1" },
      { pageNumber: 2, url: "https://signed.example/page-2" },
    ]);
    expect(storageMocks.sign).toHaveBeenCalledTimes(2);
    expect(storageMocks.sign.mock.calls.every((call) => call[1] === 300)).toBe(true);
  });
});

describe("POST /assignments/:id/submit-image — storage rollback", () => {
  it("deletes an uploaded page when the submission transaction fails", async () => {
    mockState.queue.push(
      [{
        id: 200,
        teacherId: 7,
        title: "ورقة",
        source: "worksheet",
        archivedAt: null,
        closedAt: null,
        submissionMode: "paper",
        examMode: false,
        deadline: null,
        modelImageBase64: null,
        aiGradingInstructions: null,
        resultsReleaseMode: "immediate",
        showResults: true,
      }],
      [{ id: 11, text: "اكتب الإجابة", points: 1, correctAnswer: null }],
      [],
      { rows: [] },
    );
    aiMocks.create
      .mockResolvedValueOnce({
        choices: [{ message: { content: "الاسم: طالب | 5أ | واضح\n1: إجابة | 1 | صحيح" } }],
        usage: {},
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "أحسنت" } }],
        usage: {},
      });
    mockState.transactionError = new Error("database unavailable");

    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .post("/api/assignments/200/submit-image")
      .send({
        studentName: "",
        studentClass: "",
        deviceFingerprint: "teacher-scan-1",
        imageBase64: `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64")}`,
      });

    expect(res.status).toBe(400);
    expect(storageMocks.uploadPrivate).toHaveBeenCalledTimes(1);
    expect(storageMocks.deleteObject).toHaveBeenCalledWith("/objects/uploads/submission-images/7/new-page.jpg");
  });

  it("rejects active or spoofed image formats before uploading", async () => {
    mockState.queue.push(
      [{
        id: 200,
        teacherId: 7,
        title: "ورقة",
        source: "worksheet",
        archivedAt: null,
        closedAt: null,
        submissionMode: "paper",
        examMode: false,
        deadline: null,
      }],
      [{ id: 11, text: "اكتب الإجابة", points: 1, correctAnswer: null }],
    );

    const res = await request(makeApp(submissionsRouter, { teacherId: 7 }))
      .post("/api/assignments/200/submit-image")
      .send({
        studentName: "",
        studentClass: "",
        deviceFingerprint: "teacher-scan-2",
        imageBase64: `data:image/svg+xml;base64,${Buffer.from("<svg><script>alert(1)</script></svg>").toString("base64")}`,
      });

    expect(res.status).toBe(400);
    expect(storageMocks.uploadPrivate).not.toHaveBeenCalled();
  });
});
