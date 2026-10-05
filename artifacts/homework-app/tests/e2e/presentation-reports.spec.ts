import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db, pool, teachersTable, teacherClassesTable, studentsTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(285_000);
let teacher: TestTeacher | undefined;
let foreign: TestTeacher | undefined;
let deckId: number | undefined;
let sessionId: number | undefined;
let classId: number | undefined;
let studentIds: number[] = [];

test("saved class presentation reports persist answers, nonresponders, exports and history", async ({ page, context, browser, baseURL }) => {
  if (!baseURL || !process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error("Requires isolated TEST_DATABASE_URL");
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-reports-${suffix}@example.com`;
  const [tr] = await db.insert(teachersTable).values({
    name: `E2E reports ${suffix}`, email, passwordHash: "e2e-report-fixture", verificationOtp: "997310",
    otpExpiresAt: new Date(Date.now() + 10 * 60_000), emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!tr) throw new Error("Teacher fixture insert failed");
  teacher = { id: tr.id, email, password: "not-used", cookieHeader: "" };
  let api = await newApi(baseURL);
  let studentsContext: BrowserContext | undefined;
  let studentA: Page | undefined;
  let studentB: Page | undefined;
  const browserErrors: string[] = [];
  const capture = (p: Page) => {
    p.on("pageerror", e => browserErrors.push(`pageerror: ${e.message}`));
    p.on("console", m => { if (m.type() === "error") browserErrors.push(`console: ${m.text()}`); });
  };
  try {
    const verified = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "997310" } });
    expect(verified.ok(), await verified.text()).toBeTruthy();
    const cookie = verified.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookie) throw new Error("OTP verification did not establish teacher session");
    teacher.cookieHeader = cookie;
    const [cls] = await db.insert(teacherClassesTable).values({ teacherId: tr.id, name: `E2E ${suffix}` }).returning({ id: teacherClassesTable.id });
    if (!cls) throw new Error("Class fixture insert failed");
    classId = cls.id;
    const roster = await db.insert(studentsTable).values(["طالبة أولى", "طالب ثان", "طالب ثالث"].map(name => ({
      teacherId: tr.id, name, studentClass: `E2E ${suffix}`,
    }))).returning({ id: studentsTable.id });
    studentIds = roster.map(s => s.id);
    const created = await api.post("/api/presentations", { headers: { Cookie: cookie }, data: { title: `تقرير محفوظ ${suffix}`, language: "ar" } });
    expect(created.ok(), await created.text()).toBeTruthy();
    deckId = Number((await created.json()).id);
    const slides = [
      { id: "report-cloud-slide", layout: "blank", background: "#ffffff", elements: [{ id: "report-cloud", kind: "activity", activityKind: "word_cloud", prompt: "اكتب كلمة عن الصدق", x: 50, y: 100, w: 500, h: 140 }] },
      { id: "report-mcq-slide", layout: "blank", background: "#ffffff", elements: [{ id: "report-mcq", kind: "activity", activityKind: "mcq", prompt: "ما الإجابة الصحيحة؟", options: ["الصدق", "الكذب"], correctIndex: 0, x: 50, y: 100, w: 500, h: 140 }] },
      { id: "report-game-slide", layout: "blank", background: "#ffffff", elements: [{ id: "report-game", kind: "hasad-game", gameKind: "kahoot", prompt: "اختبار حفظ فوري", x: 50, y: 100, w: 500, h: 140, questions: [
        { prompt: "السؤال الأول", options: ["صحيح", "خطأ"], correctIndex: 0 },
        { prompt: "السؤال الثاني", options: ["نعم", "لا"], correctIndex: 0 },
      ] }] },
      { id: "report-wall-slide", layout: "blank", background: "#ffffff", elements: [{ id: "report-wall", kind: "activity", activityKind: "open_wall", prompt: "رسالة ختامية", x: 50, y: 100, w: 500, h: 140 }] },
    ];
    const updated = await api.put(`/api/presentations/${deckId}`, { headers: { Cookie: cookie }, data: { slides } });
    expect(updated.ok(), await updated.text()).toBeTruthy();
    const started = await api.post(`/api/presentations/${deckId}/sessions`, { headers: { Cookie: cookie }, data: { sessionMode: "teacher", targetClass: `E2E ${suffix}` } });
    expect(started.ok(), await started.text()).toBeTruthy();
    sessionId = Number((await started.json()).sessionId);
    await attachSession(context, baseURL, teacher);
    await page.setViewportSize({ width: 390, height: 844 });
    page.setDefaultTimeout(20_000);
    capture(page);
    await page.goto(`${baseURL}/p/control/${sessionId}`);
    const sessionResponse = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`);
    expect(sessionResponse.ok()).toBeTruthy();
    const pin = String((await sessionResponse.json()).session.pin);
    const waitForSlide = async (index: number) => {
      await expect.poll(async () => {
        const r = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`);
        return r.ok() ? (await r.json()).session.currentSlideIndex : -1;
      }, { timeout: 20_000 }).toBe(index);
    };

    const join = async (name: string, forwarded: string) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        extraHTTPHeaders: { "X-Forwarded-For": forwarded } });
      const p = await ctx.newPage(); p.setDefaultTimeout(20_000); capture(p);
      await p.goto(`${baseURL}/p/join`);
      await p.locator('input[inputmode="numeric"]').fill(pin);
      await p.getByRole("button").first().click();
      await p.getByRole("button", { name, exact: true }).click();
      await p.getByRole("button", { name: /ادخل|enter/i }).click();
      await expect(p).toHaveURL(/\/p\/play\/\d+/);
      return { ctx, p };
    };
    const a = await join("طالبة أولى", "198.51.100.31"); studentsContext = a.ctx; studentA = a.p;
    const b = await join("طالب ثان", "198.51.100.32"); studentB = b.p;
    await expect(page.getByText(/المشاركون/)).toBeVisible();

    await page.getByRole("button", { name: /فتح النشاط/ }).click();
    await expect.poll(async () => {
      const r = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`);
      return r.ok() ? (await r.json()).session.activeElementId : null;
    }, { timeout: 20_000 }).toBe("report-cloud");
    await expect(studentA.locator("textarea")).toBeVisible();
    await studentA.locator("textarea").fill("صدق");
    await studentA.getByRole("button", { name: /إرسال/ }).click();
    await expect(studentA.getByText(/تم إرسال ردك/)).toBeVisible();

    await page.getByRole("button", { name: "التالية", exact: true }).click();
    await waitForSlide(1);
    await page.getByRole("button", { name: /فتح النشاط/ }).click();
    await expect.poll(async () => {
      const r = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`);
      return r.ok() ? (await r.json()).session.activeElementId : null;
    }, { timeout: 20_000 }).toBe("report-mcq");
    await studentA.getByRole("button", { name: /الصدق/ }).last().click();
    await expect.poll(async () => (await pool.query("SELECT COUNT(*)::int AS n FROM presentation_session_events WHERE session_id=$1 AND kind='answer'", [sessionId])).rows[0]?.n).toBe(2);

    await page.getByRole("button", { name: "التالية", exact: true }).click();
    await waitForSlide(2);
    await page.getByRole("button", { name: /إطلاق اللعبة الآن/ }).click();
    await expect(studentA.getByText("السؤال الأول")).toBeVisible();
    await studentA.getByRole("button", { name: /صحيح/ }).last().click();
    await expect(page.getByText(/أجاب: 1 طالب/)).toBeVisible();
    await page.getByRole("button", { name: /كشف الإجابة/ }).click();
    await page.getByRole("button", { name: /السؤال التالي/ }).click();
    await expect(studentA.getByText("السؤال الثاني")).toBeVisible();
    await studentA.getByRole("button", { name: /لا/ }).last().click();
    await expect(page.getByText(/أجاب: 1 طالب/)).toBeVisible();
    await expect.poll(async () => (await pool.query("SELECT COUNT(*)::int AS n FROM presentation_session_events WHERE session_id=$1 AND kind='answer'", [sessionId])).rows[0]?.n).toBe(4);

    await page.getByRole("button", { name: "إنهاء الجلسة", exact: true }).click();
    await page.getByRole("button", { name: "إنهاء الجلسة", exact: true }).last().click();
    await expect.poll(async () => (await pool.query("SELECT status FROM presentation_sessions WHERE id=$1", [sessionId])).rows[0]?.status).toBe("ended");
    await page.goto(`${baseURL}/p/results/${sessionId}`);
    await expect(page.getByText("متوسط الصحة", { exact: true }).locator("xpath=../..").getByText("67%", { exact: true })).toBeVisible();
    await expect(page.getByText("نسبة المشاركة", { exact: true }).first().locator("xpath=../..").getByText("33%", { exact: true })).toBeVisible();
    await expect(page.getByText("صدق", { exact: true })).toBeVisible();
    await expect(page.getByText("طالب ثالث", { exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "طالب ثان" })).toBeVisible();
    await expect(page.getByText(/100% صحيح \(1\/1\)/).first()).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "طالبة أولى" }).filter({ hasText: "الصدق" }).first()).toBeVisible();
    await expect(page.getByText(/شارك الجميع بالكامل/)).toHaveCount(0);
    await mkdir("screenshots/presentation-reports", { recursive: true });
    await page.screenshot({ path: "screenshots/presentation-reports/saved-report.png", fullPage: true });

    const resultsRes = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}/results`);
    expect(resultsRes.status()).toBe(200);
    const results = await resultsRes.json();
    expect(results.participantsCount).toBe(2);
    expect(results.summary).toMatchObject({ participantsCount: 2, classSize: 3, participationPct: 33, avgScorePct: 67, totalAnswers: 4 });
    expect(results.students).toHaveLength(2);
    expect(results.students.find((s: any) => s.name === "طالب ثان")?.answered).toBe(0);
    expect(results.insights.nonResponders).toHaveLength(2);
    expect(results.insights.nonResponders.map((s: any) => s.name)).toEqual(expect.arrayContaining(["طالب ثان", "طالب ثالث"]));
    const answersCsv = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}/results.csv`);
    const studentsCsv = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}/students.csv`);
    expect(answersCsv.status()).toBe(200); expect(studentsCsv.status()).toBe(200);
    const acsv = await answersCsv.text(); const scsv = await studentsCsv.text();
    expect(acsv).toContain("صدق"); expect(acsv).toContain("السؤال الأول"); expect(acsv).toContain("السؤال الثاني");
    expect(scsv).toContain("طالبة أولى"); expect(scsv).toContain("طالب ثان"); expect(scsv).toMatch(/طالب ثان[^\\r\\n]*0/);
    const history = await (await context.request.get(`${baseURL}/api/presentations/${deckId}/sessions/history`)).json();
    const hist = history.sessions.find((s: any) => s.id === sessionId);
    expect(hist).toMatchObject({ participantsCount: 2, totalAnswers: 4, avgScorePct: 67, participationPct: 33 });
    const comparison = await (await context.request.get(`${baseURL}/api/presentations/${deckId}/sessions/compare`)).json();
    const compareRow = comparison.sessions.find((s: any) => s.id === sessionId);
    expect(compareRow).toMatchObject({ participantsCount: 2, avgScorePct: 67, participationPct: 33 });

    await page.reload();
    await expect(page.getByText("متوسط الصحة", { exact: true }).first().locator("xpath=../..").getByText("67%", { exact: true })).toBeVisible();
    await expect(page.getByText("صدق", { exact: true })).toBeVisible();
    const otherEmail = `e2e-reports-foreign-${suffix}@example.com`;
    const [other] = await db.insert(teachersTable).values({ name: "Foreign", email: otherEmail, passwordHash: "fixture",
      verificationOtp: "997310", otpExpiresAt: new Date(Date.now() + 10 * 60_000), emailVerified: false, role: "teacher", isBlocked: false })
      .returning({ id: teachersTable.id });
    if (!other) throw new Error("Foreign teacher fixture insert failed");
    foreign = { id: other.id, email: otherEmail, password: "not-used", cookieHeader: "" };
    const verifyOther = await api.post("/api/auth/verify-otp", { data: { identifier: otherEmail, otp: "997310" } });
    const otherCookie = verifyOther.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!otherCookie) throw new Error("Foreign teacher OTP did not establish session");
    foreign.cookieHeader = otherCookie;
    const forbidden = await api.get(`/api/presentations/sessions/${sessionId}/results`, { headers: { Cookie: otherCookie } });
    expect(forbidden.status()).toBe(403);
    expect(browserErrors.filter(e => e.startsWith("pageerror:"))).toEqual([]);
    console.log("Verified report summary:", results.summary, "browser console errors:", browserErrors);
  } finally {
    await studentsContext?.close();
    await api.dispose();
  }
});

test.afterAll(async () => {
  try {
    if (sessionId) {
      await pool.query("DELETE FROM presentation_session_events WHERE session_id=$1", [sessionId]);
      await pool.query("DELETE FROM presentation_inline_quiz_runs WHERE session_id=$1", [sessionId]);
      await pool.query("DELETE FROM presentation_responses WHERE session_id=$1", [sessionId]);
      await pool.query("DELETE FROM presentation_sessions WHERE id=$1", [sessionId]);
    }
    if (deckId) await pool.query("DELETE FROM presentations WHERE id=$1", [deckId]);
    if (studentIds.length) await pool.query("DELETE FROM students WHERE id = ANY($1::int[])", [studentIds]);
    if (classId) await pool.query("DELETE FROM teacher_classes WHERE id=$1", [classId]);
    const ids = [teacher?.id, foreign?.id].filter(Boolean);
    if (ids.length) await pool.query("DELETE FROM teachers WHERE id = ANY($1::int[])", [ids]);
  } finally { await pool.end(); }
});
