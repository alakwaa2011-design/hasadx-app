import { randomBytes } from "node:crypto";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { db, directPlayLinksTable, pool, savedGameActivitiesTable, teachersTable } from "../../../../lib/db/src/index.ts";

type FixtureIds = { teacherId?: number; activityId?: number; linkId?: number; token?: string };
const fixture: FixtureIds = {};
const names = ["Player One", "Player Two", "Player Three", "Player Four"];
const browserErrors: string[] = [];

function requireIsolatedDatabase() {
  if (!process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("XO online E2E requires the isolated TEST_DATABASE_URL");
  }
}

async function cleanupFixture() {
  if (fixture.linkId) await pool.query("DELETE FROM direct_play_links WHERE id = $1", [fixture.linkId]);
  if (fixture.activityId) await pool.query("DELETE FROM saved_game_activities WHERE id = $1", [fixture.activityId]);
  if (fixture.teacherId) await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacherId]);
}

function watchErrors(page: Page) {
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
}

async function joinRoom(context: BrowserContext, url: string, name: string, pin: string) {
  await context.addInitScript(() => localStorage.setItem("hw_lang", "en"));
  const page = await context.newPage();
  watchErrors(page);
  await page.goto(url);
  await expect(page).toHaveURL(new RegExp(`/game/xo/join/${pin}$`));
  await page.getByTestId("input-player-name").fill(name);
  await page.getByTestId("button-join-game").click();
  await expect(page).toHaveURL(new RegExp(`/game/xo/play/${pin}\\?`));
  expect(new URL(page.url()).searchParams.get("creator")).not.toBe("1");
  expect(await page.evaluate(p => sessionStorage.getItem(`xo-control-${p}`), pin)).toBeNull();
  await expect(page.getByRole("heading", { name: /^E2E X O/ })).toBeVisible();
  return page;
}

async function verifyJoinLink(context: BrowserContext, url: string, pin: string) {
  expect(url).not.toContain("/play/");
  const page = await context.newPage();
  await page.goto(url);
  await expect(page).toHaveURL(new RegExp(`/game/xo/join/${pin}$`));
  await page.close();
}

async function representativeId(host: Page): Promise<string> {
  const rep = host.locator('[data-testid^="xo-player-"]').filter({ has: host.getByText("Representative", { exact: true }) });
  await expect(rep).toHaveCount(1);
  return (await rep.getAttribute("data-testid"))!.replace("xo-player-", "");
}

test.beforeAll(async () => {
  requireIsolatedDatabase();
  try {
    const suffix = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
    const [teacher] = await db.insert(teachersTable).values({
      name: `E2E XO ${suffix}`, email: `e2e-xo-${suffix}@example.com`,
      passwordHash: "e2e-xo-fixture", emailVerified: true, verifiedAt: new Date(),
    }).returning({ id: teachersTable.id });
    fixture.teacherId = teacher.id;
    const questions = [1, 2, 3, 4].map(n => ({
      text: `XO rotation question ${n} ${suffix}`, options: ["الصحيح", "خطأ"], correct: 0,
    }));
    const [activity] = await db.insert(savedGameActivitiesTable).values({
      teacherId: teacher.id, gameType: "xo", title: `E2E X O ${suffix}`, content: questions,
      settings: { duration: 45, teamX: "Blue", teamO: "Gold", playMode: "online" },
      source: "e2e", isShared: false, contentFingerprint: `e2e-xo-online-${suffix}`, questionCount: questions.length,
    }).returning({ id: savedGameActivitiesTable.id });
    fixture.activityId = activity.id;
    fixture.token = randomBytes(16).toString("hex");
    const [link] = await db.insert(directPlayLinksTable).values({
      token: fixture.token, savedGameActivityId: activity.id, teacherId: teacher.id, gameType: "xo_online",
    }).returning({ id: directPlayLinksTable.id });
    fixture.linkId = link.id;
  } catch (error) {
    await cleanupFixture();
    throw error;
  }
});

test.afterAll(async () => {
  try {
    await cleanupFixture();
  } finally {
    await pool.end();
  }
});

test("public X O host link, balanced teams, representative rotation, disconnect and rejoin", async ({ page, context, browser, baseURL }) => {
  test.setTimeout(120_000);
  requireIsolatedDatabase();
  if (!fixture.token || !baseURL) throw new Error("XO fixture or baseURL unavailable");
  await page.setViewportSize({ width: 1280, height: 900 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL).origin });
  await page.addInitScript(() => localStorage.setItem("hw_lang", "en"));
  watchErrors(page);

  const studentContexts: BrowserContext[] = [];
  try {
    await page.goto(`/play/${fixture.token}`);
    await expect(page).toHaveURL(/\/game\/xo\/play\/\d{6}\?creator=1/);
    const pin = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(page.getByTestId("xo-team-roster")).toBeVisible();
    const start = page.getByTestId("xo-start-game");
    await expect(start).toBeDisabled();

    // QR and primary share control must resolve to the join route for this room.
    await page.getByRole("button", { name: "QR" }).click();
    const qrPanel = page.locator(".fixed.inset-0").last();
    await expect(qrPanel.getByText("Game QR code")).toBeVisible();
    const qrLink = (await qrPanel.locator("p").allTextContents()).find(text => text.includes("/"));
    expect(qrLink).toBeTruthy();
    expect(qrLink).not.toContain(`/play/${fixture.token}`);
    await verifyJoinLink(context, qrLink!, pin);
    await qrPanel.getByRole("button", { name: "Close" }).click();
    const copy = page.getByRole("button", { name: "Copy student join link" });
    await expect(copy).toBeEnabled();
    await copy.click();
    const primaryLink = await page.evaluate(() => navigator.clipboard.readText());
    expect(primaryLink).not.toContain(`/play/${fixture.token}`);
    await verifyJoinLink(context, primaryLink, pin);

    const firstContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    studentContexts.push(firstContext);
    const first = await joinRoom(firstContext, primaryLink, names[0], pin);
    await expect(page.locator('[data-testid^="xo-player-"]')).toHaveCount(1);
    await expect(start).toBeDisabled();

    const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    studentContexts.push(secondContext);
    const second = await joinRoom(secondContext, qrLink!, names[1], pin);
    await expect(page.getByTestId("xo-team-count-x")).toContainText("1 of 1");
    await expect(page.getByTestId("xo-team-count-o")).toContainText("1 of 1");
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.getByTestId("xo-turn-status")).toBeVisible();

    const thirdContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    studentContexts.push(thirdContext);
    const third = await joinRoom(thirdContext, primaryLink, names[2], pin);
    const fourthContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    studentContexts.push(fourthContext);
    const fourth = await joinRoom(fourthContext, primaryLink, names[3], pin);
    await expect(page.getByTestId("xo-team-count-x")).toContainText("2 of 2");
    await expect(page.getByTestId("xo-team-count-o")).toContainText("2 of 2");
    await expect(page.locator('[data-testid^="xo-player-"]')).toHaveCount(4);

    const students = [first, second, third, fourth];
    const answer = (student: Page) => student.getByRole("button", { name: /^[A-D]\s*الصحيح$/ });
    const answerEnabled = async (student: Page) => {
      try { return await answer(student).count() > 0 && await answer(student).isEnabled(); } catch { return false; }
    };
    const enabledAnswerPage = async () => {
      await expect.poll(async () => (await Promise.all(students.map(async (student, i) =>
        await answerEnabled(student) ? i : -1))).filter(i => i >= 0).length).toBe(1);
      return students[(await Promise.all(students.map(async (student, i) =>
        await answerEnabled(student) ? i : -1))).findIndex(i => i >= 0)];
    };
    const firstXRep = await representativeId(page);
    const activeFirst = await enabledAnswerPage();
    await expect(activeFirst.getByRole("button", { name: /^[A-D]\s*خطأ$/ })).toBeEnabled();
    await expect(answer(activeFirst)).toBeEnabled();
    await answer(activeFirst).click();
    await expect(activeFirst.getByRole("gridcell", { name: "Cell 1" })).toBeEnabled();
    await expect.poll(async () => (await Promise.all(students.map(answerEnabled))).filter(Boolean).length).toBe(0);
    await activeFirst.getByRole("gridcell", { name: "Cell 1" }).click();
    for (const boardPage of [page, ...students]) {
      await expect(boardPage.getByRole("gridcell", { name: /Cell 1: [XO]/ })).toBeVisible();
    }

    // A student's reload reuses localStorage identity and leaves the opponent's representative alone.
    const firstId = await first.evaluate(p => JSON.parse(localStorage.getItem(`xo-player-${new URL(location.href).pathname.split("/").at(-1)}`) || "{}").id);
    const opponentRep = await representativeId(page);
    await expect.poll(async () => (await Promise.all(students.map(answerEnabled))).filter(Boolean).length).toBe(1);
    await first.reload();
    await expect(first.getByRole("heading", { name: /^E2E X O/ })).toBeVisible();
    await expect(page.locator(`[data-testid="xo-player-${firstId}"]`)).toHaveCount(1);
    expect(await representativeId(page)).toBe(opponentRep);

    const activeO = await enabledAnswerPage();
    await answer(activeO).click();
    await expect(activeO.getByRole("gridcell", { name: "Cell 2" })).toBeEnabled();
    await activeO.getByRole("gridcell", { name: "Cell 2" }).click();
    const activeNextX = await enabledAnswerPage();
    const nextXId = await activeNextX.evaluate(p => JSON.parse(localStorage.getItem(`xo-player-${new URL(location.href).pathname.split("/").at(-1)}`) || "{}").id);
    expect(nextXId).not.toBe(firstXRep);
    await answer(activeNextX).click();
    await expect(activeNextX.getByRole("gridcell", { name: "Cell 3" })).toBeEnabled();
    const remainingXPage = await (async () => {
      for (const student of students) {
        const id = await student.evaluate(p => JSON.parse(localStorage.getItem(`xo-player-${new URL(location.href).pathname.split("/").at(-1)}`) || "{}").id);
        if (id !== nextXId && await page.getByTestId("xo-team-x").locator(`[data-testid="xo-player-${id}"]`).count()) return student;
      }
      throw new Error("No connected X teammate available for placement transfer");
    })();
    const remainingXId = await remainingXPage.evaluate(() => JSON.parse(localStorage.getItem(`xo-player-${new URL(location.href).pathname.split("/").at(-1)}`) || "{}").id);
    await activeNextX.context().close();
    await expect(page.locator(`[data-testid="xo-player-${nextXId}"]`).getByText("Offline", { exact: true })).toBeVisible();
    await expect(page.locator(`[data-testid="xo-player-${remainingXId}"]`).getByText("Representative")).toBeVisible();
    await expect(remainingXPage.getByRole("gridcell", { name: "Cell 3" })).toBeEnabled();
    await remainingXPage.getByRole("gridcell", { name: "Cell 3" }).click();
    for (const boardPage of [page, ...students.filter(s => s !== activeNextX)]) {
      await expect(boardPage.getByRole("gridcell", { name: /Cell 3: X/ })).toBeVisible();
    }

    await page.screenshot({ path: test.info().outputPath("xo-host-roster.png"), fullPage: true });
    await remainingXPage.screenshot({ path: test.info().outputPath("xo-student-board.png"), fullPage: true });
    for (const student of students.filter(s => s !== activeNextX)) {
      expect(await student.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    const end = page.getByRole("button", { name: "End Early" });
    await end.click();
    for (const student of students.filter(s => s !== activeNextX)) {
      await expect(student).toHaveURL(/\/game\/xo\/join(?:\/\d{6})?(?:\?.*)?$/);
    }
    await expect(page).toHaveURL(/\/game\/xo\/create(?:\?.*)?$/);
    expect(browserErrors.filter(error => /xo|socket|game|play/i.test(error))).toEqual([]);
  } finally {
    await Promise.all(studentContexts.map(c => c.close().catch(() => {})));
  }
});