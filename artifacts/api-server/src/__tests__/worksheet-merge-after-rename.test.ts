/**
 * اختبارات دمج الأوراق المكررة بعد تصحيح الاسم يدوياً:
 *   PATCH /api/submissions/:id/student-name ← GET /worksheets/:id/report
 *
 * تضمن أن ربط ورقة «غير معروف» بطالب (عبر studentId من السجل أو الاسم
 * المطبَّع) يؤدي فعلاً لاندماجها مع ورقة الطالب نفسه في التقرير، وأن
 * attempts وstudentCount يُحدَّثان دون فقدان أي ورقة (gradedPapersCount ثابت
 * ومجموع المحاولات = عدد الأوراق).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  /** حمولات .set() الملتقطة من db.update — لتطبيقها على البيانات المحاكاة. */
  const updateSets: Record<string, unknown>[] = [];
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
        if (prop === "set") {
          return (v: Record<string, unknown>) => {
            updateSets.push(v);
            // مثل قاعدة بيانات حقيقية: returning() تعيد الصف بعد التحديث
            if (Array.isArray(result)) {
              for (const row of result) Object.assign(row as object, v);
            }
            return makeChain(result);
          };
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { queue, updateSets, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    },
    worksheetsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionsTable: stub,
    submissionsTable: stub,
    answersTable: stub,
    notificationsTable: stub,
    examSessionsTable: stub,
    studentsTable: stub,
  };
});

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));
vi.mock("../lib/anthropic-client", () => ({ anthropic: {}, SONNET_MODEL: "m" }));
vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => ({ runAfterCommit: async () => {} }),
}));
vi.mock("../lib/xp/engine", () => ({ reverseXpIfWithinWindow: async () => {} }));
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

const TEACHER_ID = 7;
const WS = { id: 1, teacherId: TEACHER_ID, title: "ورقة عمل", linkedAssignmentId: 100 };
const ASSIGNMENT = { id: 100, teacherId: TEACHER_ID, source: "worksheet" };

type Sub = {
  id: number;
  assignmentId: number;
  studentId: number | null;
  studentName: string;
  studentClass: string | null;
  score: number | null;
  earnedPoints: number | null;
  totalPoints: number | null;
  teacherAdjustedPoints: number | null;
  submittedAt: Date;
};

function sub(partial: Partial<Sub> & { id: number; studentName: string }): Sub {
  return {
    assignmentId: 100,
    studentId: null,
    studentClass: null,
    score: null,
    earnedPoints: 0,
    totalPoints: 10,
    teacherAdjustedPoints: null,
    submittedAt: new Date(2026, 0, partial.id),
    ...partial,
  } as Sub;
}

/**
 * ينفّذ PATCH student-name على ورقة ثم يطبّق حمولة التحديث الملتقطة على
 * كائن الورقة نفسه — يحاكي حالة قاعدة البيانات بعد التصحيح اليدوي.
 */
async function patchStudentName(
  target: Sub,
  body: { studentName: string; studentClass?: string },
  roster: { id: number; name: string; studentClass: string | null }[],
) {
  // طابور PATCH: (1) الورقة+التصحيح، (2) سجل الطلاب، (3) نتيجة التحديث
  mockState.queue.push(
    [{ submission: target, assignment: ASSIGNMENT }],
    roster,
    [target],
  );
  const res = await request(makeApp(submissionsRouter, { teacherId: TEACHER_ID }))
    .patch(`/api/submissions/${target.id}/student-name`)
    .send(body);
  expect(res.status).toBe(200);
  const setPayload = mockState.updateSets.at(-1)!;
  Object.assign(target, setPayload);
  return res.body as {
    id: number;
    studentName: string;
    studentClass: string | null;
    matchedStudentId: number | null;
  };
}

async function getReport(subs: Sub[]) {
  // طابور التقرير: الورقة، الأسئلة، التصحيحات، الإجابات
  mockState.queue.push([WS], [], subs);
  if (subs.length > 0) mockState.queue.push([]);
  const res = await request(makeApp(worksheetsRouter, { teacherId: TEACHER_ID }))
    .get("/api/worksheets/1/report");
  expect(res.status).toBe(200);
  return res.body;
}

beforeEach(() => {
  mockState.queue.length = 0;
  mockState.updateSets.length = 0;
});

describe("دمج ورقة «غير معروف» بعد التصحيح اليدوي — بالربط عبر studentId", () => {
  it("قبل التصحيح: ورقتان منفصلتان؛ بعده: طالب واحد بمحاولتين وأحدث درجة", async () => {
    const registered = sub({
      id: 1, studentId: 11, studentName: "أحمد خالد",
      earnedPoints: 4, submittedAt: new Date("2026-01-01"),
    });
    const unknown = sub({
      id: 2, studentName: "غير معروف",
      earnedPoints: 8, submittedAt: new Date("2026-01-02"),
    });
    const subs = [registered, unknown];

    // قبل التصحيح: «غير معروف» ورقة مستقلة
    const before = await getReport(subs);
    expect(before.summary.studentCount).toBe(2);
    expect(before.summary.gradedPapersCount).toBe(2);
    expect(before.students.map((s: any) => s.attempts)).toEqual([1, 1]);

    // المعلم يصحّح الاسم — يطابق طالباً في السجل (مع اختلاف الهمزة)
    const patched = await patchStudentName(
      unknown,
      { studentName: "احمد خالد" },
      [{ id: 11, name: "أحمد خالد", studentClass: "5أ" }],
    );
    expect(patched.matchedStudentId).toBe(11);
    expect(patched.studentName).toBe("أحمد خالد"); // الاسم القانوني من السجل
    expect(unknown.studentId).toBe(11);

    // بعد التصحيح: اندماج كامل دون فقدان أي ورقة
    const after = await getReport(subs);
    expect(after.summary.studentCount).toBe(1);
    expect(after.summary.gradedPapersCount).toBe(2); // لا ورقة ضائعة
    expect(after.students).toHaveLength(1);
    expect(after.students[0].attempts).toBe(2);
    expect(after.students[0].registered).toBe(true);
    // أحدث محاولة (الورقة المصحَّحة) هي المعتمدة: 8/10
    expect(after.students[0].earnedPoints).toBe(8);
    expect(after.students[0].percent).toBe(80);
    expect(after.summary.avgPercent).toBe(80);
  });

  it("لا يدمج مع طالب آخر: التصحيح لطالب مختلف يُبقي الورقتين منفصلتين", async () => {
    const registered = sub({ id: 1, studentId: 11, studentName: "أحمد خالد", earnedPoints: 4 });
    const unknown = sub({ id: 2, studentName: "غير معروف", earnedPoints: 8 });
    const subs = [registered, unknown];

    const patched = await patchStudentName(
      unknown,
      { studentName: "سارة العلي" },
      [
        { id: 11, name: "أحمد خالد", studentClass: null },
        { id: 12, name: "سارة العلي", studentClass: null },
      ],
    );
    expect(patched.matchedStudentId).toBe(12);

    const after = await getReport(subs);
    expect(after.summary.studentCount).toBe(2);
    expect(after.summary.gradedPapersCount).toBe(2);
    expect(after.students.every((s: any) => s.attempts === 1)).toBe(true);
  });
});

describe("دمج بعد التصحيح اليدوي — بالاسم المطبَّع (بدون سجل)", () => {
  it("تصحيح «غير معروف» لاسم يطابق ورقة غير مسجلة يدمجهما (عبدالله = عبد الله)", async () => {
    const first = sub({
      id: 1, studentName: "عبدالله محمد",
      earnedPoints: 3, submittedAt: new Date("2026-01-01"),
    });
    const unknown = sub({
      id: 2, studentName: "غير معروف",
      earnedPoints: 7, submittedAt: new Date("2026-01-02"),
    });
    const subs = [first, unknown];

    // لا يوجد طالب مطابق في السجل → يُحفظ الاسم كما أدخله المعلم
    const patched = await patchStudentName(
      unknown,
      { studentName: "عبد الله محمد" },
      [],
    );
    expect(patched.matchedStudentId).toBeNull();
    expect(unknown.studentId).toBeNull();
    expect(unknown.studentName).toBe("عبد الله محمد");

    const after = await getReport(subs);
    expect(after.summary.studentCount).toBe(1);
    expect(after.summary.gradedPapersCount).toBe(2);
    expect(after.students[0].attempts).toBe(2);
    // أحدث محاولة: 7/10
    expect(after.students[0].earnedPoints).toBe(7);
    expect(after.students[0].percent).toBe(70);
  });

  it("مجموع المحاولات = عدد الأوراق دائماً — لا ورقة تُفقد في الدمج", async () => {
    const a = sub({ id: 1, studentId: 11, studentName: "أحمد", earnedPoints: 4 });
    const b = sub({ id: 2, studentName: "غير معروف", earnedPoints: 6 });
    const c = sub({ id: 3, studentName: "غير معروف", earnedPoints: 9 });
    const subs = [a, b, c];

    // ربط الورقة الثانية بأحمد، والثالثة تبقى مجهولة
    await patchStudentName(b, { studentName: "أحمد" }, [
      { id: 11, name: "أحمد", studentClass: null },
    ]);

    const after = await getReport(subs);
    expect(after.summary.gradedPapersCount).toBe(3);
    const totalAttempts = after.students.reduce(
      (sum: number, s: any) => sum + s.attempts, 0,
    );
    expect(totalAttempts).toBe(3);
    expect(after.summary.studentCount).toBe(2); // أحمد (محاولتان) + مجهول واحد
  });
});
