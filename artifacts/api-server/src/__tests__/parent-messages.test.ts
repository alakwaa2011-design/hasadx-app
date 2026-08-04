import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  function makeChain(result: unknown): unknown {
    const p: Promise<unknown> = Promise.resolve(result);
    const handler: ProxyHandler<Promise<unknown>> = {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const fn = (target as unknown as Record<string, unknown>)[prop as string] as (...args: unknown[]) => unknown;
          return fn.bind(target);
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { queue, makeChain };
});

// Controllable sendEmail mock
const mockSendEmail = vi.hoisted(() => vi.fn(async () => ({ delivered: true })));

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
    },
    parentMessagesTable: stub,
    parentMessageRepliesTable: stub,
    studentsTable: stub,
    teachersTable: stub,
  };
});

vi.mock("../lib/email", () => ({
  sendEmail: mockSendEmail,
  getAppBaseUrl: () => "https://test.example.com",
}));

vi.mock("../lib/parent-message-email", () => ({
  buildParentMessageEmail: () => "<p>test email</p>",
  buildTeacherReplyNotificationEmail: () => "<p>reply notif</p>",
  buildParentThreadReplyEmail: () => "<p>thread reply</p>",
}));

import express from "express";
import request from "supertest";
import router from "../routes/parent-messages";

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

// ── helpers ────────────────────────────────────────────────────────────────

const TEACHER = { id: 1, name: "أستاذ علي", email: "teacher@school.sa" };
const STUDENT = { id: 42, name: "أحمد محمد", teacherId: 1, parentEmail: null, parentName: null, studentClass: "3أ", gradeLevel: "الثالث" };
const SENT_MSG = { id: 99, teacherId: 1, studentId: 42, subject: "test", body: "test", parentEmail: "parent@example.com", parentName: null, replyToken: "abc-token", tokenExpiresAt: new Date(Date.now() + 86400_000), isArchived: false, sentAt: new Date() };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    studentId: 42,
    subject: "تقرير واجب",
    body: "نتيجة الطالب 85%",
    parentEmail: "parent@example.com",
    parentName: "محمد السعيد",
    ...overrides,
  };
}

beforeEach(() => {
  mockState.queue.length = 0;
  mockSendEmail.mockReset();
  mockSendEmail.mockResolvedValue({ delivered: true });
});

// ── tests ──────────────────────────────────────────────────────────────────

describe("POST /api/parent-messages", () => {
  it("requires authentication", async () => {
    const res = await request(makeApp(null)).post("/api/parent-messages").send(validBody());
    expect(res.status).toBe(401);
  });

  it("returns 404 when student not owned by teacher", async () => {
    // select student → empty (student belongs to different teacher)
    mockState.queue.push([]);
    const res = await request(makeApp({ teacherId: 1 })).post("/api/parent-messages").send(validBody());
    expect(res.status).toBe(404);
  });

  it("sends email and returns 201 on success", async () => {
    mockState.queue.push([STUDENT]);    // select student
    mockState.queue.push([TEACHER]);   // select teacher
    mockState.queue.push([SENT_MSG]);  // insert message
    // sendEmail already mocked to delivered: true
    mockState.queue.push([]);          // update student parentEmail (skipped, parentEmail already null but check passes)

    const res = await request(makeApp({ teacherId: 1 })).post("/api/parent-messages").send(validBody());
    expect(res.status).toBe(201);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("rolls back the insert and returns 502 when email delivery fails", async () => {
    mockSendEmail.mockResolvedValueOnce({ delivered: false, reason: "smtp_timeout" });

    mockState.queue.push([STUDENT]);    // select student
    mockState.queue.push([TEACHER]);   // select teacher
    mockState.queue.push([SENT_MSG]);  // insert message → will be rolled back
    mockState.queue.push([]);          // delete (rollback)

    const res = await request(makeApp({ teacherId: 1 })).post("/api/parent-messages").send(validBody());

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/تعذّر إرسال البريد/);
    // Confirm rollback was attempted (delete chain was consumed from queue)
    expect(mockState.queue.length).toBe(0);
  });

  it("rolls back and returns 502 when Resend is not configured", async () => {
    mockSendEmail.mockResolvedValueOnce({ delivered: false, reason: "resend_not_configured" });

    mockState.queue.push([STUDENT]);
    mockState.queue.push([TEACHER]);
    mockState.queue.push([SENT_MSG]);
    mockState.queue.push([]);

    const res = await request(makeApp({ teacherId: 1 })).post("/api/parent-messages").send(validBody());

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/خدمة البريد غير مُهيأة/);
  });
});

// ── Submissions list: studentId present in response ────────────────────────
// (Integration-level check — ensures the fix to include studentId is verified
//  in the test suite even though the route lives in submissions.ts.)

import submissionsRouter from "../routes/submissions";

vi.mock("../routes/assignments", () => ({ default: { get: vi.fn(), post: vi.fn() } }), { virtual: true });

// Extra db tables needed by the submissions router
vi.mock("@workspace/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...original,
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
    },
  };
});

describe("GET /api/assignments/:id/submissions — studentId in response", () => {
  it("includes studentId in each submission row", async () => {
    const submissionRow = {
      id: 1,
      studentId: 42,        // <-- the stable db id
      studentName: "أحمد",
      studentClass: "3أ",
      score: 85,
      totalQuestions: 10,
      correctAnswers: 8,
      earnedPoints: 85,
      totalPoints: 100,
      teacherAdjustedPoints: null,
      teacherNote: null,
      aiFeedback: null,
      durationSeconds: 120,
      submittedAt: new Date("2025-01-01T10:00:00Z"),
    };

    // select assignment (ownership check)
    mockState.queue.push([{ teacherId: 1 }]);
    // select submissions
    mockState.queue.push([submissionRow]);

    function makeSubApp(session: Session | null) {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as unknown as { session: Session; log: { error: () => void } }).session = session ?? {};
        (req as any).log = { error: () => {} };
        next();
      });
      app.use("/api", submissionsRouter);
      return app;
    }

    const res = await request(makeSubApp({ teacherId: 1 })).get("/api/assignments/5/submissions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].studentId).toBe(42);
    expect(res.body[0].studentName).toBe("أحمد");
  });
});
