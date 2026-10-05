import { expect, test } from "@playwright/test";
import { db, pool, teachersTable, teacherClassesTable, studentsTable, presentationSessionEventsTable } from "../../../../lib/db/src/index.ts";
import { newApi } from "./helpers";

// API-only regression: no browser is launched. The real student journey is
// covered separately; these deterministic saved fixtures exercise exports.
test("Arabic saved reports export safely and agree with history and comparison", async ({ baseURL }) => {
  if (!baseURL || process.env.E2E_DATABASE_ISOLATED !== "1" || !process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error("Requires isolated test database");
  const api = await newApi(baseURL);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const teacherIds: number[] = [];
  let deckId: number | undefined;
  let classId: number | undefined;
  const studentIds: number[] = [];
  const login = async (label: string) => {
    const email = `reports-api-${label}-${suffix}@example.com`;
    const [row] = await db.insert(teachersTable).values({ name: label, email, passwordHash: "test-fixture",
      verificationOtp: "997310", otpExpiresAt: new Date(Date.now() + 600_000), emailVerified: false,
      role: "teacher", isBlocked: false }).returning({ id: teachersTable.id });
    teacherIds.push(row.id);
    const verified = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "997310" } });
    expect(verified.status()).toBe(200);
    const cookie = verified.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookie) throw new Error("No authenticated fixture session");
    return { id: row.id, cookie };
  };
  try {
    const owner = await login("owner");
    const [cls] = await db.insert(teacherClassesTable).values({ teacherId: owner.id, name: suffix }).returning();
    classId = cls.id;
    const roster = await db.insert(studentsTable).values(["مجيب", "صامت", "غائب"].map(name => ({
      teacherId: owner.id, name, studentClass: suffix,
    }))).returning();
    studentIds.push(...roster.map(r => r.id));
    const headers = { Cookie: owner.cookie };
    const made = await api.post("/api/presentations", { headers, data: { title: "تقرير حصاد", language: "ar" } });
    expect(made.status()).toBe(201);
    deckId = Number((await made.json()).id);
    const started = await api.post(`/api/presentations/${deckId}/sessions`, { headers, data: { targetClass: suffix } });
    expect(started.ok()).toBeTruthy();
    const sid = Number((await started.json()).sessionId);
    await db.insert(presentationSessionEventsTable).values([
      ...roster.slice(0, 2).map((s, i) => ({ sessionId: sid, kind: "join", eventKey: `student-${i}`,
        payload: { studentKey: `student-${i}`, name: s.name, classStudentId: s.id } })),
      ...[
        { elementId: "cloud", answerText: "صدق", isCorrect: null, meta: { activityKind: "word_cloud", prompt: "كلمة" } },
        { elementId: "mcq", answerIndex: 0, isCorrect: true, meta: { prompt: "سؤال", options: ["الصدق", "خيار"], correctIndex: 0 } },
        { elementId: "game::q:0", answerIndex: 0, isCorrect: true, meta: { prompt: "السؤال الأول", options: ["نعم", "لا"], correctIndex: 0 } },
        { elementId: "game::q:1", answerIndex: 1, isCorrect: false, meta: { prompt: "السؤال الثاني", options: ["نعم", "لا"], correctIndex: 0 } },
      ].map((answer, i) => ({ sessionId: sid, kind: "answer", eventKey: `answer-${i}`, payload: {
        ...answer, slideIndex: i, studentKey: "student-0", studentName: roster[0].name,
        classStudentId: roster[0].id, responseSec: 2,
      } })),
    ]);
    const results = await api.get(`/api/presentations/sessions/${sid}/results`, { headers });
    expect(results.status()).toBe(200);
    expect((await results.json()).summary).toMatchObject({ participantsCount: 2, classSize: 3,
      participationPct: 33, avgScorePct: 67, totalAnswers: 4 });
    for (const endpoint of ["results.csv", "students.csv"]) {
      const response = await api.get(`/api/presentations/sessions/${sid}/${endpoint}`, { headers });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["content-disposition"]).toContain("filename*=UTF-8''");
      const csv = await response.text();
      expect(csv).toContain("مجيب");
      if (endpoint === "results.csv") {
        expect(csv).toContain("صدق"); expect(csv).toContain("السؤال الأول"); expect(csv).toContain("السؤال الثاني");
        expect(csv.trim().split(/\r?\n/)).toHaveLength(5);
      } else {
        expect(csv).toMatch(/صامت[^\r\n]*,0,0,0,/);
        expect(csv.trim().split(/\r?\n/)).toHaveLength(3);
      }
    }
    for (const endpoint of ["history", "compare"]) {
      const response = await api.get(`/api/presentations/${deckId}/sessions/${endpoint}`, { headers });
      expect(response.status()).toBe(200);
      expect((await response.json()).sessions.find((s: any) => s.id === sid)).toMatchObject({
        participantsCount: 2, avgScorePct: 67, participationPct: 33,
      });
    }
    const reloaded = await api.get(`/api/presentations/sessions/${sid}/results`, { headers });
    expect((await reloaded.json()).summary.totalAnswers).toBe(4);
    const foreign = await login("foreign");
    for (const endpoint of ["results", "results.csv", "students.csv"]) {
      expect((await api.get(`/api/presentations/sessions/${sid}/${endpoint}`, { headers: { Cookie: foreign.cookie } })).status()).toBe(403);
    }
  } finally {
    if (deckId) await pool.query("DELETE FROM presentations WHERE id=$1", [deckId]);
    for (const id of studentIds) await pool.query("DELETE FROM students WHERE id=$1", [id]);
    if (classId) await pool.query("DELETE FROM teacher_classes WHERE id=$1", [classId]);
    for (const id of teacherIds) await pool.query("DELETE FROM teachers WHERE id=$1", [id]);
    await api.dispose();
    await pool.end();
  }
});
