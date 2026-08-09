/**
 * اختبارات تقرير التصحيح الورقي: GET /worksheets/:id/report
 *
 * تحمي المنطق الدقيق للتقرير:
 *  - الدمج بالاسم العربي المطبَّع (عبدالله = عبد الله، الهمزات، التاء المربوطة)
 *  - اعتماد أحدث محاولة لكل طالب مع احتساب عدد المحاولات
 *  - «غير معروف» والأسماء الفارغة لا تُدمج — كل ورقة طالب مستقل
 *  - تعديل المعلم (teacherAdjustedPoints/teacherPoints) يتقدم على الآلي
 *  - نسب الأسئلة (correctPercent) ونسب الملخص (avg/max/min/passRate)
 */
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

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
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
  app.use("/api", worksheetsRouter);
  return app;
}

const WS = { id: 1, teacherId: 7, title: "ورقة عمل", linkedAssignmentId: 100 };

type Sub = {
  id: number;
  studentId: number | null;
  studentName: string;
  studentClass: string | null;
  score: number | null;
  earnedPoints: number | null;
  totalPoints: number | null;
  teacherAdjustedPoints: number | null;
  submittedAt: Date;
};

let subId = 0;
function sub(partial: Partial<Sub> & { studentName: string }): Sub {
  subId += 1;
  return {
    id: partial.id ?? subId,
    studentId: null,
    studentClass: null,
    score: null,
    earnedPoints: 0,
    totalPoints: 10,
    teacherAdjustedPoints: null,
    submittedAt: new Date(2026, 0, subId),
    ...partial,
  } as Sub;
}

/** يجهّز الطابور: ورقة العمل، ثم الأسئلة، ثم التصحيحات، ثم الإجابات (إن لزم)،
 *  ثم بيانات أولياء الأمور للطلاب المسجلين (إن وُجدوا). */
function queueReport(opts: {
  questions?: unknown[];
  subs: Sub[];
  answers?: unknown[];
  parents?: unknown[];
}) {
  mockState.queue.push([WS], opts.questions ?? [], opts.subs);
  if (opts.subs.length > 0) {
    mockState.queue.push(opts.answers ?? []);
    // المسار يستعلم عن بيانات ولي الأمر فقط عند وجود طلاب مسجلين
    if (opts.subs.some((s) => s.studentId != null)) mockState.queue.push(opts.parents ?? []);
  }
}

async function getReport() {
  const res = await request(makeApp({ teacherId: 7 })).get("/api/worksheets/1/report");
  expect(res.status).toBe(200);
  return res.body;
}

beforeEach(() => {
  mockState.queue.length = 0;
  subId = 0;
});

describe("الدمج بالاسم المطبَّع", () => {
  it("يدمج «عبدالله» مع «عبد الله» في طالب واحد ويعتمد أحدث محاولة", async () => {
    queueReport({
      subs: [
        sub({ studentName: "عبد الله محمد", earnedPoints: 4, submittedAt: new Date("2026-01-01") }),
        sub({ studentName: "عبدالله محمد", earnedPoints: 8, submittedAt: new Date("2026-01-02") }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(1);
    expect(body.summary.gradedPapersCount).toBe(2);
    expect(body.students).toHaveLength(1);
    expect(body.students[0].attempts).toBe(2);
    // أحدث محاولة: 8/10 = 80%
    expect(body.students[0].earnedPoints).toBe(8);
    expect(body.students[0].percent).toBe(80);
    expect(body.summary.avgPercent).toBe(80);
  });

  it("يدمج اختلاف الهمزة والتاء المربوطة (أحمد/احمد، فاطمة/فاطمه)", async () => {
    queueReport({
      subs: [
        sub({ studentName: "أحمد خالد", earnedPoints: 5 }),
        sub({ studentName: "احمد خالد", earnedPoints: 7 }),
        sub({ studentName: "فاطمة الزهراء", earnedPoints: 6 }),
        sub({ studentName: "فاطمه الزهراء", earnedPoints: 9 }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(2);
    const pts = body.students.map((s: any) => s.earnedPoints).sort();
    expect(pts).toEqual([7, 9]);
  });

  it("لا يدمج طالبين مسجلين مختلفين حتى لو تشابه الاسم — الهوية بالسجل", async () => {
    queueReport({
      subs: [
        sub({ studentId: 11, studentName: "أحمد خالد", earnedPoints: 5 }),
        sub({ studentId: 12, studentName: "احمد خالد", earnedPoints: 7 }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(2);
    expect(body.students.every((s: any) => s.registered)).toBe(true);
  });

  it("يدمج محاولات نفس الطالب المسجل ولو تغيّر الاسم المكتوب", async () => {
    queueReport({
      subs: [
        sub({ studentId: 11, studentName: "أحمد", earnedPoints: 3, submittedAt: new Date("2026-01-01") }),
        sub({ studentId: 11, studentName: "أحمد خالد", earnedPoints: 6, submittedAt: new Date("2026-01-02") }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(1);
    expect(body.students[0].attempts).toBe(2);
    expect(body.students[0].earnedPoints).toBe(6);
  });
});

describe("«غير معروف» والأسماء الفارغة لا تُدمج", () => {
  it("ورقتان باسم «غير معروف» تبقيان طالبين مستقلين", async () => {
    queueReport({
      subs: [
        sub({ studentName: "غير معروف", earnedPoints: 2 }),
        sub({ studentName: "غير معروف", earnedPoints: 9 }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(2);
    expect(body.students.every((s: any) => s.attempts === 1)).toBe(true);
  });

  it("الأسماء الفارغة لا تُدمج مع بعضها", async () => {
    queueReport({
      subs: [
        sub({ studentName: "", earnedPoints: 1 }),
        sub({ studentName: "", earnedPoints: 5 }),
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(2);
  });
});

describe("تعديل المعلم يتقدم على التصحيح الآلي", () => {
  it("teacherAdjustedPoints تحل محل earnedPoints في الدرجة والنسبة", async () => {
    queueReport({
      subs: [
        sub({ studentName: "سارة", earnedPoints: 4, teacherAdjustedPoints: 9 }),
      ],
    });
    const body = await getReport();
    expect(body.students[0].earnedPoints).toBe(9);
    expect(body.students[0].percent).toBe(90);
    expect(body.summary.avgPercent).toBe(90);
  });

  it("teacherAdjustedPoints = 0 تُحترم (لا تسقط إلى الدرجة الآلية)", async () => {
    queueReport({
      subs: [
        sub({ studentName: "سارة", earnedPoints: 8, teacherAdjustedPoints: 0 }),
      ],
    });
    const body = await getReport();
    expect(body.students[0].earnedPoints).toBe(0);
    expect(body.students[0].percent).toBe(0);
  });

  it("teacherPoints على مستوى السؤال تتقدم على isCorrect في إحصاءات الأسئلة", async () => {
    const s1 = sub({ studentName: "سارة", earnedPoints: 5 });
    const s2 = sub({ studentName: "محمد", earnedPoints: 5 });
    queueReport({
      questions: [{ id: 51, text: "س١", points: 2 }],
      subs: [s1, s2],
      answers: [
        // آلياً خطأ لكن المعلم أعطى درجة جزئية → تُحتسب صحيحة
        { submissionId: s1.id, questionId: 51, isCorrect: false, teacherPoints: 1 },
        // آلياً صحيح لكن المعلم صفّرها → تُحتسب خطأ
        { submissionId: s2.id, questionId: 51, isCorrect: true, teacherPoints: 0 },
      ],
    });
    const body = await getReport();
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].correctCount).toBe(1);
    expect(body.questions[0].wrongCount).toBe(1);
    expect(body.questions[0].correctPercent).toBe(50);
  });
});

describe("نسب الأسئلة والملخص", () => {
  it("يحسب correctPercent لكل سؤال من أحدث المحاولات فقط", async () => {
    const a = sub({ studentName: "أحمد", earnedPoints: 2 });
    const b = sub({ studentName: "سارة", earnedPoints: 1 });
    const c = sub({ studentName: "محمد", earnedPoints: 0 });
    queueReport({
      questions: [
        { id: 51, text: "س١", points: 1 },
        { id: 52, text: "س٢", points: 1 },
      ],
      subs: [a, b, c],
      answers: [
        { submissionId: a.id, questionId: 51, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 51, isCorrect: true, teacherPoints: null },
        { submissionId: c.id, questionId: 51, isCorrect: false, teacherPoints: null },
        { submissionId: a.id, questionId: 52, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 52, isCorrect: false, teacherPoints: null },
        // c لم يجب عن س٢
      ],
    });
    const body = await getReport();
    const q1 = body.questions.find((q: any) => q.questionId === 51);
    const q2 = body.questions.find((q: any) => q.questionId === 52);
    expect(q1.correctPercent).toBe(67);
    expect(q1.answeredCount).toBe(3);
    expect(q2.correctPercent).toBe(50);
    expect(q2.answeredCount).toBe(2);
  });

  it("سؤال بلا إجابات: correctPercent = null", async () => {
    queueReport({
      questions: [{ id: 51, text: "س١", points: 1 }],
      subs: [sub({ studentName: "أحمد", earnedPoints: 0 })],
      answers: [],
    });
    const body = await getReport();
    expect(body.questions[0].correctPercent).toBeNull();
    expect(body.questions[0].answeredCount).toBe(0);
  });

  it("يحسب avg/max/min/passRate من نسب أحدث المحاولات", async () => {
    queueReport({
      subs: [
        sub({ studentName: "أحمد", earnedPoints: 9 }),   // 90%
        sub({ studentName: "سارة", earnedPoints: 5 }),   // 50% — ناجحة (>=50)
        sub({ studentName: "محمد", earnedPoints: 2 }),   // 20%
      ],
    });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(3);
    expect(body.summary.avgPercent).toBeCloseTo(53.3, 1);
    expect(body.summary.maxPercent).toBe(90);
    expect(body.summary.minPercent).toBe(20);
    expect(body.summary.passRate).toBe(67);
    // الطلاب مرتبون تنازلياً بالنسبة
    expect(body.students.map((s: any) => s.studentName)).toEqual(["أحمد", "سارة", "محمد"]);
  });

  it("totalPoints = 0 يسقط إلى score المحفوظة كنسبة", async () => {
    queueReport({
      subs: [sub({ studentName: "أحمد", earnedPoints: 0, totalPoints: 0, score: 75 })],
    });
    const body = await getReport();
    expect(body.students[0].percent).toBe(75);
    expect(body.summary.avgPercent).toBe(75);
  });
});

describe("تعديل الورقة بعد التصحيح (حذف/إضافة سؤال)", () => {
  it("إجابات مرتبطة بسؤال محذوف تُتجاهل ولا تُحسب في أي سؤال متبقٍ", async () => {
    const a = sub({ studentName: "أحمد", earnedPoints: 2 });
    const b = sub({ studentName: "سارة", earnedPoints: 1 });
    queueReport({
      // السؤال 52 حُذف بعد التصحيح — لم يعد ضمن الأسئلة الحالية
      questions: [{ id: 51, text: "س١", points: 1 }],
      subs: [a, b],
      answers: [
        { submissionId: a.id, questionId: 51, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 51, isCorrect: false, teacherPoints: null },
        // إجابات يتيمة تشير إلى السؤال المحذوف 52
        { submissionId: a.id, questionId: 52, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 52, isCorrect: true, teacherPoints: null },
      ],
    });
    const body = await getReport();
    // لا ينهار التقرير، والسؤال المحذوف لا يظهر
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].questionId).toBe(51);
    // الإجابات اليتيمة لا تنحرف بإحصاءات السؤال المتبقي
    expect(body.questions[0].answeredCount).toBe(2);
    expect(body.questions[0].correctCount).toBe(1);
    expect(body.questions[0].correctPercent).toBe(50);
  });

  it("سؤال جديد أُضيف بعد التصحيح بلا إجابات: correctPercent = null والقديم سليم", async () => {
    const a = sub({ studentName: "أحمد", earnedPoints: 1 });
    queueReport({
      questions: [
        { id: 51, text: "س١ قديم", points: 1 },
        { id: 60, text: "س٢ جديد بعد التصحيح", points: 1 },
      ],
      subs: [a],
      answers: [
        { submissionId: a.id, questionId: 51, isCorrect: true, teacherPoints: null },
      ],
    });
    const body = await getReport();
    expect(body.questions).toHaveLength(2);
    const oldQ = body.questions.find((q: any) => q.questionId === 51);
    const newQ = body.questions.find((q: any) => q.questionId === 60);
    expect(oldQ.correctPercent).toBe(100);
    expect(oldQ.answeredCount).toBe(1);
    expect(newQ.correctPercent).toBeNull();
    expect(newQ.answeredCount).toBe(0);
    expect(newQ.correctCount).toBe(0);
    expect(newQ.wrongCount).toBe(0);
  });

  it("حذف وإضافة معاً: النسب تُحسب من الإجابات المطابقة للأسئلة الحالية فقط", async () => {
    const a = sub({ studentName: "أحمد", earnedPoints: 2 });
    const b = sub({ studentName: "سارة", earnedPoints: 0 });
    queueReport({
      questions: [
        { id: 51, text: "س١ باقٍ", points: 1 },
        { id: 60, text: "س جديد", points: 2 },
      ],
      subs: [a, b],
      answers: [
        { submissionId: a.id, questionId: 51, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 51, isCorrect: false, teacherPoints: null },
        // سؤالان محذوفان 52 و53 بإجابات قديمة
        { submissionId: a.id, questionId: 52, isCorrect: true, teacherPoints: null },
        { submissionId: b.id, questionId: 53, isCorrect: false, teacherPoints: 2 },
      ],
    });
    const body = await getReport();
    expect(body.questions.map((q: any) => q.questionId)).toEqual([51, 60]);
    const q1 = body.questions.find((q: any) => q.questionId === 51);
    const qNew = body.questions.find((q: any) => q.questionId === 60);
    expect(q1.correctPercent).toBe(50);
    expect(qNew.correctPercent).toBeNull();
    // الملخص لا ينهار: النسب من درجات التصحيحات المحفوظة كما هي
    expect(body.summary.studentCount).toBe(2);
    expect(body.summary.avgPercent).toBe(10);
  });
});

describe("حالات الوصول والحواف", () => {
  it("بدون تصحيحات: ملخص صفري وقوائم فارغة", async () => {
    queueReport({ subs: [] });
    const body = await getReport();
    expect(body.summary.studentCount).toBe(0);
    expect(body.summary.avgPercent).toBeNull();
    expect(body.students).toEqual([]);
    expect(body.questions).toEqual([]);
  });

  it("403 لغير مالك الورقة", async () => {
    mockState.queue.push([{ ...WS, teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 7 })).get("/api/worksheets/1/report");
    expect(res.status).toBe(403);
  });

  it("409 عندما لا يوجد تصحيح مرتبط", async () => {
    mockState.queue.push([{ ...WS, linkedAssignmentId: null }]);
    const res = await request(makeApp({ teacherId: 7 })).get("/api/worksheets/1/report");
    expect(res.status).toBe(409);
  });

  it("401 بدون تسجيل دخول", async () => {
    const res = await request(makeApp(null)).get("/api/worksheets/1/report");
    expect(res.status).toBe(401);
  });
});
