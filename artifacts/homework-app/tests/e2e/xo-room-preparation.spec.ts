import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db, pool, savedGameActivitiesTable, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);
type Fixture = { teacher: TestTeacher; activityId: number; title: string };
let fixture: Fixture | undefined;
let fixtureTeacherId: number | undefined;
const students: BrowserContext[] = [];
const relevantBrowserErrors: string[] = [];
const startRequests: string[] = [];

function assertIsolatedDatabase() {
  if (!process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("XO preparation E2E requires the isolated TEST_DATABASE_URL");
  }
}

function watchPage(page: Page) {
  page.on("console", message => {
    if (message.type() === "error" && /xo|socket|game|play|share/i.test(message.text())) {
      relevantBrowserErrors.push(message.text());
    }
  });
  page.on("requestfailed", request => {
    if (/\/api\/(?:play|game-share-links)|\/socket\.io/i.test(request.url())) {
      relevantBrowserErrors.push(`${request.url()}: ${request.failure()?.errorText}`);
    }
  });
  page.on("response", response => {
    if (response.status() >= 400 && /\/api\/(?:play|game-share-links)/i.test(response.url())) {
      relevantBrowserErrors.push(`${response.status()} ${response.url()}`);
    }
  });
}

test.beforeAll(async ({ baseURL }) => {
  assertIsolatedDatabase();
  if (!baseURL) throw new Error("baseURL is required");
  const suffix = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
  const email = `e2e-xo-prep-${suffix}@example.com`;
  const otp = "995000";
  const [teacherRow] = await db.insert(teachersTable).values({
    name: `E2E XO Prep ${suffix}`,
    email,
    passwordHash: "e2e-xo-preparation-fixture",
    verificationOtp: otp,
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    emailVerified: false,
    role: "teacher",
    isBlocked: false,
  }).returning({ id: teachersTable.id });
  fixtureTeacherId = teacherRow.id;

  const api = await newApi(baseURL);
  let cookieHeader: string | undefined;
  try {
    const response = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp } });
    if (!response.ok()) throw new Error(`Teacher OTP verification failed: ${response.status()} ${await response.text()}`);
    cookieHeader = response.headersArray()
      .filter(header => header.name.toLowerCase() === "set-cookie")
      .map(header => header.value.split(";")[0])
      .find(value => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");
  } finally {
    await api.dispose();
  }

  const title = `E2E XO room prep ${suffix}`;
  const [activity] = await db.insert(savedGameActivitiesTable).values({
    teacherId: teacherRow.id,
    gameType: "xo",
    title,
    content: [
      { text: `Prepared room question one ${suffix}`, options: ["الصحيح", "خطأ"], correct: 0, type: "mcq" },
      { text: `Prepared room question two ${suffix}`, options: ["الصحيح", "خطأ"], correct: 0, type: "mcq" },
    ],
    settings: { duration: 45, teamX: "Preparation Blue", teamO: "Preparation Gold", playMode: "online" },
    source: "e2e",
    isShared: false,
    contentFingerprint: `e2e-xo-room-prep-${suffix}`,
    questionCount: 2,
  }).returning({ id: savedGameActivitiesTable.id });
  fixture = {
    teacher: { id: teacherRow.id, email, password: "not-used-after-otp-verification", cookieHeader },
    activityId: activity.id,
    title,
  };
});

test.afterAll(async () => {
  try {
    await Promise.all(students.map(context => context.close().catch(() => {})));
    if (fixtureTeacherId) {
      await pool.query("DELETE FROM direct_play_links WHERE teacher_id = $1", [fixtureTeacherId]);
      await pool.query("DELETE FROM saved_game_activities WHERE teacher_id = $1", [fixtureTeacherId]);
      await pool.query("DELETE FROM teachers WHERE id = $1", [fixtureTeacherId]);
    }
  } finally {
    await pool.end();
  }
});

test("online XO setup prepares, shares, restores and enters the same teacher room", async ({
  page, context, browser, baseURL,
}) => {
  assertIsolatedDatabase();
  if (!fixture || !baseURL) throw new Error("XO preparation fixture or baseURL unavailable");
  const origin = new URL(baseURL).origin;
  await attachSession(context, baseURL, fixture.teacher);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await context.addInitScript(() => localStorage.setItem("hw_lang", "en"));
  await page.setViewportSize({ width: 1280, height: 900 });
  watchPage(page);
  page.on("request", request => {
    if (request.method() === "POST" && /\/api\/play\/[^/]+\/start(?:\?|$)/.test(new URL(request.url()).pathname)) {
      startRequests.push(request.url());
    }
  });

  await page.goto(`/game/xo/create?savedGameId=${fixture.activityId}`);
  await expect(page.getByTestId("button-start-game")).toHaveText(/Enter teacher room/);
  await expect(page.getByTestId("select-duration")).toHaveValue("45");
  await expect(page.getByText(fixture.title, { exact: true })).toBeVisible();

  // Verify classroom keeps its permanent-link action, then return to online setup.
  await page.getByTestId("button-mode-classroom").click();
  await expect(page.getByTestId("button-copy-permanent-link")).toBeVisible();
  await expect(page.getByTestId("button-copy-room-link")).toHaveCount(0);
  await page.getByTestId("button-mode-online").click();
  await expect(page.getByTestId("button-copy-room-link")).toBeVisible();
  await expect(page.getByTestId("button-copy-permanent-link")).toHaveCount(0);

  const copyRoom = page.getByTestId("button-copy-room-link");
  await copyRoom.click();
  await expect(page.getByTestId("xo-prepared-room")).toContainText("Room ready", { timeout: 20_000 });
  await expect.poll(() => startRequests.length).toBe(1);
  expect(page.url()).toMatch(/\/game\/xo\/create\?savedGameId=\d+$/);
  expect(new URL(page.url()).searchParams.get("savedGameId")).toBeTruthy();
  const status = await page.getByTestId("xo-prepared-room").innerText();
  const pin = status.match(/\bPIN\s+(\d{6})\b/)?.[1];
  expect(pin).toBeTruthy();
  const firstLink = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(firstLink).pathname).toMatch(/\/s\/[a-z2-7]{10}$/);
  expect(firstLink).not.toContain("/play/");
  await expect(page.getByTestId("button-start-game")).toHaveText(/Enter teacher room/);
  await expect(page.getByTestId("button-mode-online")).toBeDisabled();
  await expect(page.getByTestId("input-team-x")).toBeDisabled();
  await expect(page.getByTestId("input-team-o")).toBeDisabled();
  await expect(page.getByTestId("select-duration")).toBeDisabled();
  await expect(page.getByTestId("button-change-questions")).toBeDisabled();

  await page.screenshot({ path: test.info().outputPath("xo-preparation-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("xo-preparation-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  const joinStudent = async (name: string) => {
    const studentContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    });
    students.push(studentContext);
    await studentContext.addInitScript(() => localStorage.setItem("hw_lang", "en"));
    const student = await studentContext.newPage();
    watchPage(student);
    await student.goto(firstLink);
    await expect(student).toHaveURL(new RegExp(`/game/xo/join/${pin}$`));
    await student.getByTestId("input-player-name").fill(name);
    await student.getByTestId("button-join-game").click();
    await expect(student).toHaveURL(new RegExp(`/game/xo/play/${pin}\\?`));
    expect(new URL(student.url()).searchParams.get("creator")).not.toBe("1");
    expect(await student.evaluate(p => sessionStorage.getItem(`xo-control-${p}`), pin)).toBeNull();
    await expect(student.getByRole("heading", { name: new RegExp(`^${fixture!.title}`) })).toBeVisible();
    return student;
  };
  const studentOne = await joinStudent("Student One");
  const studentTwo = await joinStudent("Student Two");
  for (const student of [studentOne, studentTwo]) {
    await expect(student.getByTestId("xo-team-count-x")).toContainText("1 of 1");
    await expect(student.getByTestId("xo-team-count-o")).toContainText("1 of 1");
  }
  expect(new URL(studentOne.url()).pathname).toBe(new URL(studentTwo.url()).pathname);

  await copyRoom.click();
  await expect(page.getByTestId("xo-prepared-room")).toContainText(pin!);
  const secondLink = await page.evaluate(() => navigator.clipboard.readText());
  expect(secondLink).toBe(firstLink);
  await expect.poll(() => startRequests.length).toBe(1);

  await page.reload();
  await expect(page.getByTestId("xo-prepared-room")).toContainText(pin!, { timeout: 20_000 });
  await expect(page.getByTestId("button-copy-room-link")).toBeVisible();
  await page.getByTestId("button-copy-room-link").click();
  await expect(page.getByTestId("xo-prepared-room")).toContainText(pin!);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(firstLink);
  await expect.poll(() => startRequests.length).toBe(1);

  await page.getByTestId("button-start-game").click();
  await expect(page).toHaveURL(new RegExp(`/game/xo/play/${pin}\\?creator=1`));
  await expect(page.getByTestId("xo-team-count-x")).toContainText("1 of 1");
  await expect(page.getByTestId("xo-team-count-o")).toContainText("1 of 1");
  await expect(page.getByTestId("xo-start-game")).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe(new URL(studentOne.url()).pathname);
  await expect.poll(() => startRequests.length).toBe(1);
  await page.getByTestId("xo-start-game").click();

  const answer = (student: Page) => student.getByRole("button", { name: /^[A-D]\s*الصحيح$/ });
  await expect(answer(studentOne)).toBeVisible();
  await expect(answer(studentTwo)).toBeVisible();
  await expect.poll(async () => {
    return Number(await answer(studentOne).isEnabled()) + Number(await answer(studentTwo).isEnabled());
  }).toBe(1);
  expect(relevantBrowserErrors).toEqual([]);
});