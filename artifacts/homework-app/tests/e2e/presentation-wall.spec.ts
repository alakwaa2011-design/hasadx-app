import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(240_000);
let teacher: TestTeacher | undefined;
let deckId: number | undefined;
let sessionId: number | undefined;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || !process.env.TEST_DATABASE_URL ||
      process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Presentation-wall fixtures require isolated TEST_DATABASE_URL");
  }
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-presentation-wall-${suffix}@example.com`;
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Presentation Wall ${suffix}`, email, passwordHash: "e2e-presentation-wall-fixture",
    verificationOtp: "997310", otpExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create isolated presentation-wall teacher");
  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "997310" } });
    if (!verify.ok()) throw new Error(`OTP verification failed: ${verify.status()}`);
    const cookieHeader = verify.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP did not establish a teacher session");
    teacher = { id: row.id, email, password: "not-used", cookieHeader };
    const created = await api.post("/api/presentations", {
      headers: { Cookie: cookieHeader }, data: { title: `E2E response wall ${suffix}`, language: "ar" },
    });
    if (!created.ok()) throw new Error(`Presentation create failed: ${created.status()}`);
    deckId = Number((await created.json()).id);
    const updated = await api.put(`/api/presentations/${deckId}`, {
      headers: { Cookie: cookieHeader },
      data: { slides: [{ id: "e2e-wall-slide", layout: "blank", background: "#ffffff", elements: [{
        id: "e2e-open-wall", kind: "activity", activityKind: "open_wall", prompt: "اكتب ردك",
        x: 80, y: 200, w: 1120, h: 180,
      }] }] },
    });
    if (!updated.ok()) throw new Error(`Presentation seed failed: ${updated.status()}`);
    const started = await api.post(`/api/presentations/${deckId}/sessions`, {
      headers: { Cookie: cookieHeader }, data: { sessionMode: "teacher" },
    });
    if (!started.ok()) throw new Error(`Session create failed: ${started.status()}`);
    sessionId = Number((await started.json()).sessionId);
  } finally { await api.dispose(); }
});

test.afterAll(async () => {
  try {
    // Deleting the isolated session cascades its response rows, wall runs and cards.
    if (sessionId) await pool.query("DELETE FROM presentation_sessions WHERE id = $1", [sessionId]);
    if (deckId) await pool.query("DELETE FROM presentations WHERE id = $1", [deckId]);
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  } finally { await pool.end(); }
});

function safeDiagnostic(value: string): string {
  return value
    .replace(/([?&](?:sid|token|joinToken|cookie)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/("(?:joinToken|token|cookie)"\s*:\s*")[^"]*"/gi, '$1[redacted]"');
}

function captureBrowserAndTransport(page: Page, label: string, browserErrors: string[]) {
  page.on("pageerror", e => browserErrors.push(`${label}: pageerror: ${safeDiagnostic(e.message)}`));
  // Anonymous auth probes return 401; old Engine.IO polling requests can return
  // 400 during reload/upgrade. Neither implies a UI error. The journey below
  // verifies actual acknowledgements, realtime delivery and durable state.
  page.on("response", response => {
    if (response.status() >= 500 && new URL(response.url()).origin === new URL(page.url()).origin) {
      browserErrors.push(`${label}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
}

async function joinAsGuest(context: BrowserContext, baseURL: string, pin: string, name: string, browserErrors: string[]): Promise<Page> {
  const page = await context.newPage();
  captureBrowserAndTransport(page, name, browserErrors);
  await page.goto(`${baseURL}/p/join`);
  await page.locator('input[inputmode="numeric"]').fill(pin);
  await page.getByRole("button").first().click();
  await page.getByPlaceholder(/اسمك|your name/i).fill(name);
  const responsePromise = page.waitForResponse(r => r.url().includes("/api/p/sessions/by-pin") && r.request().method() === "POST");
  await page.getByRole("button").first().click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Guest join failed: ${response.status()}`);
  await expect(page).toHaveURL(/\/p\/play\/\d+/);
  return page;
}

async function submitCard(page: Page, text: string) {
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: /إرسال|send/i }).click();
  await expect(page.getByText("تم إرسال ردك!", { exact: true })).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
}

async function expectCard(page: Page, text: string, visible: boolean) {
  const card = page.getByText(text, { exact: true });
  if (visible) await expect(card).toBeVisible();
  else await expect(card).toHaveCount(0);
}

test("open-wall card visibility restores across teacher, projector and student reloads, then resets for a new round", async ({ page, context, browser, baseURL }) => {
  if (!teacher || !sessionId || !deckId || !baseURL) throw new Error("Isolated presentation-wall fixtures missing");
  const browserErrors: string[] = [];
  await mkdir("screenshots/presentation-wall", { recursive: true });
  await attachSession(context, baseURL, teacher);
  await page.setViewportSize({ width: 390, height: 844 });
  captureBrowserAndTransport(page, "teacher", browserErrors);
  await page.goto(`${baseURL}/p/control/${sessionId}`);
  const initial = await pool.query("SELECT status FROM presentation_sessions WHERE id = $1", [sessionId]);
  expect(initial.rows[0]?.status).toBe("lobby");
  await page.getByRole("button", { name: /فتح النشاط|open activity/i }).click();
  await expect.poll(async () => (await pool.query("SELECT status FROM presentation_sessions WHERE id = $1", [sessionId])).rows[0]?.status).toBe("running");

  const projector = await context.newPage();
  captureBrowserAndTransport(projector, "projector", browserErrors);
  await projector.setViewportSize({ width: 1280, height: 720 });
  await projector.goto(`${baseURL}/p/show/${sessionId}`);
  const studentContextA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const studentContextB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  let studentA: Page | undefined;
  let studentB: Page | undefined;
  try {
    const info = await (await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`)).json();
    const pin = String(info.session.pin);
    studentA = await joinAsGuest(studentContextA, baseURL, pin, "طالب أول", browserErrors);
    studentB = await joinAsGuest(studentContextB, baseURL, pin, "طالب ثان", browserErrors);
    await expect(page.getByText("المشاركون", { exact: true }).locator("xpath=../..").locator("span.font-bold").first()).toHaveText("2");
    await submitCard(studentA, "فكرة رائعة");
    await submitCard(studentB, "عمل جماعي");
    await expectCard(page, "فكرة رائعة", true);
    await expectCard(page, "عمل جماعي", true);
    await expectCard(projector, "فكرة رائعة", true);
    await expectCard(projector, "عمل جماعي", true);
    await page.screenshot({ path: "screenshots/presentation-wall/teacher-both-cards.png", fullPage: true });
    await projector.screenshot({ path: "screenshots/presentation-wall/projector-both-cards.png" });

    const teacherCard = page.getByText("فكرة رائعة", { exact: true }).locator("xpath=../..");
    await teacherCard.getByTitle("إخفاء البطاقة").click();
    await expectCard(page, "فكرة رائعة", true);
    await expectCard(projector, "فكرة رائعة", false);
    await expectCard(projector, "عمل جماعي", true);
    await page.reload();
    await expectCard(page, "فكرة رائعة", true);
    await expect(page.getByTitle("إظهار البطاقة")).toBeVisible();
    await expectCard(page, "عمل جماعي", true);
    await projector.reload();
    await expectCard(projector, "فكرة رائعة", false);
    await expectCard(projector, "عمل جماعي", true);
    await studentA.reload();
    await expect(studentA.getByText("تم إرسال ردك!", { exact: true })).toBeVisible();
    await expect(studentA.locator("textarea")).toHaveCount(0);

    await page.getByTitle("إظهار البطاقة").click();
    await expectCard(projector, "فكرة رائعة", true);
    await expectCard(projector, "عمل جماعي", true);
    const firstRun = (await pool.query("SELECT active_wall_run_id FROM presentation_sessions WHERE id = $1", [sessionId])).rows[0].active_wall_run_id;
    await page.getByTitle("إغلاق النشاط").click();
    await expect(page.getByTitle("إغلاق النشاط")).toHaveCount(0);
    await page.getByRole("button", { name: /فتح النشاط|open activity/i }).click();
    await expect(page.getByText(/بطاقات جدار الردود/)).toHaveCount(0);
    await expectCard(projector, "فكرة رائعة", false);
    await expectCard(projector, "عمل جماعي", false);
    await expect(studentA.locator("textarea")).toBeVisible();
    await submitCard(studentA, "فكرة جديدة");
    await expectCard(page, "فكرة جديدة", true);
    await expectCard(projector, "فكرة جديدة", true);
    const rounds = await pool.query(
      "SELECT r.id, count(c.id)::int AS cards FROM presentation_wall_runs r LEFT JOIN presentation_wall_cards c ON c.run_id = r.id WHERE r.session_id = $1 GROUP BY r.id ORDER BY r.opened_at",
      [sessionId],
    );
    expect(rounds.rows).toHaveLength(2);
    expect(rounds.rows.find(r => r.id === firstRun)?.cards).toBe(2);
    expect(rounds.rows.filter(r => r.id !== firstRun)[0]?.cards).toBe(1);
    await page.screenshot({ path: "screenshots/presentation-wall/teacher-new-round.png", fullPage: true });
    await projector.screenshot({ path: "screenshots/presentation-wall/projector-new-round.png" });
    expect(browserErrors).toEqual([]);
  } finally {
    await studentContextA.close();
    await studentContextB.close();
  }
});
