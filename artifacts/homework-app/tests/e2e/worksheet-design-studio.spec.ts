import { expect, test } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";
import { mkdir } from "node:fs/promises";

test.setTimeout(120_000);
let teacher: TestTeacher | undefined;
let worksheetId: number | undefined;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Worksheet design fixtures require isolated TEST_DATABASE_URL");
  }
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-design-${suffix}@example.com`;
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Design ${suffix}`, email, passwordHash: "e2e-design-fixture",
    verificationOtp: "997310", otpExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create isolated design teacher");
  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "997310" } });
    if (!verify.ok()) throw new Error(`OTP verification failed: ${verify.status()} ${await verify.text()}`);
    const cookieHeader = verify.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0]).find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP did not establish a teacher session");
    teacher = { id: row.id, email, password: "not-used", cookieHeader };
  } finally { await api.dispose(); }
});

test.afterAll(async () => {
  try {
    if (teacher) await pool.query("DELETE FROM worksheets WHERE teacher_id = $1", [teacher.id]);
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  } finally { await pool.end(); }
});

test("worksheet design studio saves, reloads and prints a styled A4 worksheet", async ({ page, context, baseURL }, testInfo) => {
  if (!teacher || !baseURL) throw new Error("Isolated teacher fixture missing");
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir("screenshots/worksheet-design", { recursive: true });
  await attachSession(context, baseURL, teacher);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/worksheets/create");
  await expect(page.getByTestId("button-open-worksheet-design")).toBeVisible();
  await page.getByTestId("tab-format-info").click();
  await page.getByTestId("input-ws-title").fill("Design Studio E2E");
  await page.getByTestId("button-open-worksheet-design").click();
  const studio = page.getByTestId("design-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByTestId("theme-studio_pro")).toBeVisible();
  await expect(studio.getByTestId("theme-pastel_garden")).toBeVisible();
  await studio.getByTestId("design-filter-pro").click();
  await expect(studio.getByTestId("theme-studio_pro")).toBeVisible();
  await expect(studio.getByTestId("theme-pastel_garden")).toHaveCount(0);
  await studio.getByTestId("design-filter-kids").click();
  for (const id of ["pastel_garden", "space_journey", "storybook"]) await expect(studio.getByTestId(`theme-${id}`)).toBeVisible();
  await studio.getByTestId("theme-space_journey").click();
  await expect(studio.getByTestId("theme-space_journey")).toHaveAttribute("aria-pressed", "true");
  await studio.getByTestId("theme-storybook").click();
  await expect(studio.getByTestId("theme-storybook")).toHaveAttribute("aria-pressed", "true");
  await studio.getByTestId("theme-math_grid").count().then(async n => {
    if (!n) { await studio.getByTestId("design-filter-all").click(); await expect(studio.getByTestId("theme-math_grid")).toBeVisible(); }
  });
  await studio.getByTestId("design-preset-kids").click();
  await studio.getByTestId("design-preset-pro").click();
  const proPage = page.locator("#ws-printable-root [data-worksheet-page]").first();
  await expect(proPage).toHaveClass(/ws-theme-studio_pro/);
  const proHeaderFits = await proPage.evaluate(el => {
    const header = el.querySelector<HTMLElement>(".ws-play-banner, .ws-header, .ws-headrow, .ws-band-top");
    const h = header?.getBoundingClientRect(), p = el.getBoundingClientRect();
    return !!h && h.left >= p.left && h.right <= p.right && h.top >= p.top && h.bottom <= p.bottom;
  });
  expect(proHeaderFits).toBe(true);
  await studio.getByTestId("design-preset-kids").click();
  await studio.getByTestId("design-answer-grid").click();
  await studio.getByTestId("design-deco-botanical").click();
  await page.screenshot({ path: "screenshots/worksheet-design/design-studio.png", fullPage: true });

  await page.getByRole("button", { name: "إضافة سؤال" }).click();
  await page.getByRole("menuitem", { name: "إجابة قصيرة" }).click();
  await page.locator('textarea[placeholder="نص السؤال"]').first().fill("اكتب مثالاً على شكل هندسي.");
  const savedResponsePromise = page.waitForResponse(r => r.url().includes("/api/worksheets") && r.request().method() === "POST" && !r.url().includes("/ai/"));
  await page.getByTestId("button-ws-save").click();
  const savedResponse = await savedResponsePromise;
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  worksheetId = Number(Array.isArray(saved) ? saved[0]?.id : saved?.id);
  expect(worksheetId).toBeGreaterThan(0);
  await page.goto(`/teacher/worksheets/${worksheetId}/print`);
  await expect(page.locator("#ws-printable-root")).toHaveCount(1);
  await expect(page.locator("#ws-printable-root")).toContainText("اكتب مثالاً على شكل هندسي");
  const persisted = await (await context.request.get(`/api/worksheets/${worksheetId}`)).json();
  expect(persisted.settings.design.answerPattern).toBe("grid");
  expect(persisted.settings.design.decoration).toBe("botanical");
  expect(persisted.settings.design.themeSelection).toBe("manual");
  expect(persisted.settings.template).toBe("pastel_garden");
  expect(persisted.settings.includeAnswerKey).toBe(false);
  const paper = page.locator("#ws-printable-root [data-worksheet-page]").first();
  await expect(paper).toHaveClass(/ws-theme-pastel_garden/);
  const styled = await paper.evaluate(el => {
    const after = getComputedStyle(el, "::after");
    const head = el.querySelector<HTMLElement>(".ws-play-banner, .ws-header, .ws-headrow");
    const box = head?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height, motif: after.backgroundImage, afterContent: after.content,
      headerInside: !!box && box.left >= rect.left && box.right <= rect.right && box.top >= rect.top && box.bottom <= rect.bottom,
      background: getComputedStyle(el).backgroundColor };
  });
  expect(styled.width).toBeGreaterThan(styled.height * 0.65);
  expect(styled.motif).not.toBe("none");
  expect(await page.locator("#ws-printable-root [data-worksheet-page]").first().evaluate(el => getComputedStyle(el).backgroundImage)).not.toBe("none");
  expect(styled.afterContent).toBe('""');
  expect(styled.headerInside).toBe(true);
  expect(styled.background).not.toBe("rgb(255, 255, 255)");
  await page.screenshot({ path: "screenshots/worksheet-design/colored-saved-paper.png", fullPage: true });
  await page.reload();
  const reloaded = await (await context.request.get(`/api/worksheets/${worksheetId}`)).json();
  expect(reloaded.settings.design.answerPattern).toBe("grid");
  expect(reloaded.settings.design.decoration).toBe("botanical");
  expect(reloaded.settings.template).toBe("pastel_garden");
  await expect(page.locator("#ws-printable-root")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/teacher/worksheets/create?edit=${worksheetId}`);
  await page.getByTestId("button-open-worksheet-design").click();
  await page.getByTestId("design-print-mono").click();
  await page.getByTestId("button-ws-save").click();
  await expect.poll(async () => (await (await context.request.get(`/api/worksheets/${worksheetId}`)).json()).settings.design.printMode).toBe("mono");
  await page.reload();
  const finalSaved = await (await context.request.get(`/api/worksheets/${worksheetId}`)).json();
  expect(finalSaved.settings.design.printMode).toBe("mono");
  await page.goto(`/teacher/worksheets/${worksheetId}/print`);
  await expect(page.locator("#ws-printable-root")).toHaveCount(1);
  await expect(page.locator("#ws-printable-root [data-worksheet-page]")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const domPages = await page.locator("#ws-printable-root [data-worksheet-page]").count();
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  const pdfPages = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  expect(pdfPages).toBe(domPages);
  expect(pdfPages).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  await mkdir(testInfo.outputDir, { recursive: true });
});