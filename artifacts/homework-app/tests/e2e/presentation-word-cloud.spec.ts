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
    throw new Error("Word-cloud fixtures require isolated TEST_DATABASE_URL");
  }
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-word-cloud-${suffix}@example.com`;
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Word Cloud ${suffix}`, email, passwordHash: "e2e-word-cloud-fixture",
    verificationOtp: "997310", otpExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create isolated word-cloud teacher");
  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "997310" } });
    if (!verify.ok()) throw new Error(`OTP verification failed: ${verify.status()} ${await verify.text()}`);
    const cookieHeader = verify.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP did not establish a teacher session");
    teacher = { id: row.id, email, password: "not-used", cookieHeader };

    const created = await api.post("/api/presentations", {
      headers: { Cookie: cookieHeader }, data: { title: `E2E word cloud ${suffix}`, language: "ar" },
    });
    if (!created.ok()) throw new Error(`Presentation create failed: ${created.status()} ${await created.text()}`);
    const deck = await created.json();
    deckId = Number(deck.id);
    const activityId = "e2e-word-cloud";
    const updated = await api.put(`/api/presentations/${deckId}`, {
      headers: { Cookie: cookieHeader },
      data: { slides: [{ id: "e2e-first-slide", layout: "blank", background: "#ffffff", elements: [{
        id: activityId, kind: "activity", activityKind: "word_cloud", prompt: "اكتب كلمة واحدة",
        x: 80, y: 200, w: 1120, h: 180,
      }] }] },
    });
    if (!updated.ok()) throw new Error(`Presentation seed failed: ${updated.status()} ${await updated.text()}`);
    const started = await api.post(`/api/presentations/${deckId}/sessions`, {
      headers: { Cookie: cookieHeader }, data: { sessionMode: "teacher" },
    });
    if (!started.ok()) throw new Error(`Session create failed: ${started.status()} ${await started.text()}`);
    sessionId = Number((await started.json()).sessionId);
  } finally { await api.dispose(); }
});

test.afterAll(async () => {
  try {
    if (sessionId) {
      await pool.query("DELETE FROM presentation_responses WHERE session_id = $1", [sessionId]);
      await pool.query("DELETE FROM presentation_sessions WHERE id = $1", [sessionId]);
    }
    if (deckId) await pool.query("DELETE FROM presentations WHERE id = $1", [deckId]);
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  } finally { await pool.end(); }
});

async function joinAsGuest(context: BrowserContext, baseURL: string, pin: string, name: string): Promise<Page> {
  const page = await context.newPage();
  page.on("request", r => { if (r.url().includes("/api/p/by-pin/") || r.url().includes("/api/p/sessions/by-pin")) console.log("PIN REQUEST", r.method(), r.url()); });
  page.on("response", r => { if (r.url().includes("/api/p/by-pin/") || r.url().includes("/api/p/sessions/by-pin")) console.log("PIN RESPONSE", r.status(), r.url()); });
  await page.goto(`${baseURL}/p/join`);
  await page.locator('input[inputmode="numeric"]').fill(pin);
  await page.getByRole("button").first().click();
  await page.getByPlaceholder(/اسمك|your name/i).fill(name);
  const joinResponsePromise = page.waitForResponse(r => r.url().includes("/api/p/sessions/by-pin") && r.request().method() === "POST");
  await page.getByRole("button").first().click();
  const joinResponse = await joinResponsePromise;
  if (!joinResponse.ok()) throw new Error(`Guest join failed: ${joinResponse.status()} ${await joinResponse.text()}`);
  await expect(page).toHaveURL(/\/p\/play\/\d+/);
  return page;
}

async function submitWord(page: Page, word: string) {
  const input = page.locator("textarea");
  await expect(input).toBeVisible();
  await input.fill(word);
  await page.getByRole("button", { name: /إرسال|send/i }).click();
  await expect(page.getByText(/تم إرسال ردك|response sent/i)).toBeVisible();
}

async function expectCloud(page: Page, words: Array<{ text: string; count: number }>) {
  const cloud = page.getByTestId("live-word-cloud");
  await expect(cloud).toBeVisible();
  await expect.poll(async () => cloud.getByTestId("cloud-word").count()).toBe(words.length);
  for (const word of words) {
    const item = cloud.getByTestId("cloud-word").filter({ hasText: word.text });
    await expect(item).toHaveAttribute("data-count", String(word.count));
  }
}

test("first-slide word cloud shows two students' submissions on both stages and restores the projector", async ({ page, context, browser, baseURL }) => {
  if (!teacher || !sessionId || !deckId || !baseURL) throw new Error("Isolated word-cloud fixtures missing");
  const browserErrors: string[] = [];
  const capture = (p: Page) => {
    p.on("pageerror", e => browserErrors.push(`pageerror: ${e.message}`));
    p.on("console", m => { if (m.type() === "error") browserErrors.push(`console: ${m.text()}`); });
  };
  await mkdir("screenshots/word-cloud", { recursive: true });
  await attachSession(context, baseURL, teacher);
  await page.setViewportSize({ width: 390, height: 844 });
  capture(page);
  await page.goto(`${baseURL}/p/control/${sessionId}`);
  const pinResponse = await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`);
  expect(pinResponse.ok()).toBeTruthy();
  const beforeOpen = await pool.query("SELECT status, current_slide_index FROM presentation_sessions WHERE id = $1", [sessionId]);
  expect(beforeOpen.rows[0]).toMatchObject({ status: "lobby", current_slide_index: 0 });
  await page.getByRole("button", { name: /فتح النشاط|open activity/i }).click();
  await expect.poll(async () => (await pool.query("SELECT status FROM presentation_sessions WHERE id = $1", [sessionId])).rows[0]?.status).toBe("running");
  await expect(page.getByTestId("live-word-cloud")).toBeVisible();

  const projector = await context.newPage();
  capture(projector);
  await projector.setViewportSize({ width: 1280, height: 720 });
  await projector.goto(`${baseURL}/p/show/${sessionId}`);
  const studentContextA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.11" } });
  const studentContextB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.12" } });
  let studentA: Page | undefined;
  let studentB: Page | undefined;
  try {
    const sessionInfo = await (await context.request.get(`${baseURL}/api/presentations/sessions/${sessionId}`)).json();
    const pin = String(sessionInfo.session.pin);
    studentA = await joinAsGuest(studentContextA, baseURL, pin, "طالب أول");
    studentB = await joinAsGuest(studentContextB, baseURL, pin, "طالب ثان");
    capture(studentA); capture(studentB);
    await expect(studentA.locator("textarea")).toBeVisible();
    await expect(page.getByText("المشاركون", { exact: true }).locator("xpath=../..").locator("span.font-bold").first()).toHaveText("2");
    await submitWord(studentA, "مدرسة");
    await submitWord(studentB, "مدرسة");
    await expectCloud(projector, [{ text: "مدرسة", count: 2 }]);
    await expectCloud(page, [{ text: "مدرسة", count: 2 }]);
    await projector.screenshot({ path: "screenshots/word-cloud/projector-shared-count-two.png" });

    await projector.reload();
    await expectCloud(projector, [{ text: "مدرسة", count: 2 }]);
    await page.screenshot({ path: "screenshots/word-cloud/teacher-shared-count-two.png", fullPage: true });

    console.log("Captured browser initialization/socket console errors:", browserErrors);
  } finally {
    await studentContextA.close();
    await studentContextB.close();
  }
});
