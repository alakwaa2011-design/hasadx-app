import { expect, test } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);
let teacher: TestTeacher;
let savedId: number | undefined;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || !process.env.TEST_DATABASE_URL
    || process.env.E2E_DATABASE_ISOLATED !== "1"
    || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Worksheet fixtures require the isolated TEST_DATABASE_URL");
  }
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-ws-auto-${suffix}@example.com`;
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Worksheet Auto ${suffix}`, email, passwordHash: "e2e-worksheet-auto-fixture",
    verificationOtp: "995000", otpExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create isolated worksheet teacher");
  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "995000" } });
    if (!verify.ok()) throw new Error(`OTP verification failed: ${verify.status()}`);
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

test("automatic worksheet selection generates, saves and renders its diagram", async ({ page, context, baseURL }, testInfo) => {
  if (!teacher || !baseURL) throw new Error("Isolated teacher fixture missing");
  await attachSession(context, baseURL, teacher);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/worksheets/create");
  await expect(page.getByRole("heading", { name: "بناء ورقة عمل" })).toBeVisible({ timeout: 20_000 });

  const details = page.getByTestId("tab-format-info");
  await details.click();
  await page.getByTestId("input-ws-subject").fill("الرياضيات");
  await page.getByTestId("input-ws-grade").fill("الصف الأول");
  const selection = page.getByTestId("worksheet-question-selection");
  const auto = selection.locator("button").nth(0);
  const manual = selection.locator("button").nth(1);
  await expect(auto).toBeVisible();
  await expect(auto).toHaveClass(/bg-background/);
  await expect(page.getByTestId("worksheet-auto-selection-hint")).toBeVisible();
  await expect(page.getByText("اختيار من متعدد", { exact: true })).toHaveCount(0);

  await manual.click();
  const mainTypes = ["اختيار من متعدد", "صح أو خطأ", "إجابة قصيرة", "إكمال الفراغ", "توصيل"];
  for (const label of mainTypes) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "أنواع إضافية" }).click();
  const additionalTypes = ["مسألة مع خطوات الحل", "إجابة مطولة", "اكتشف الخطأ وصححه", "بنك كلمات", "قارن"];
  for (const label of additionalTypes) await expect(page.getByText(label, { exact: true })).toBeVisible();
  const mcqStepper = page.locator("div.flex.items-center.gap-2").filter({ has: page.getByText("اختيار من متعدد", { exact: true }) });
  await mcqStepper.getByRole("button", { name: "+" }).click();
  await expect(mcqStepper.locator("span").nth(1)).toHaveText("5");
  await auto.click();
  await expect(page.getByText("اختيار من متعدد", { exact: true })).toHaveCount(0);
  await manual.click();
  await expect(mcqStepper.locator("span").nth(1)).toHaveText("5");
  await auto.click();
  await page.getByRole("button", { name: /أنواع إضافية/ }).count().then(async n => { if (n) await page.getByRole("button", { name: "أنواع إضافية" }).click(); });
  await page.getByPlaceholder(/عن ماذا تتحدث الورقة/).fill("العد والأشكال");

  let generatePayload: any;
  let saveBody: any;
  let saveStatus = 0;
  await page.route("**/api/worksheets/ai/generate", async route => {
    if (route.request().method() !== "POST") return route.continue();
    generatePayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      language: "ar",
      questions: [
        { id: "auto-visual", type: "short_answer", prompt: "كم دائرة ترى؟", answer: "٢", lines: 2,
          visual: { caption: "عدّ الدوائر", shapes: [
            { kind: "circle", x: 20, y: 20, width: 30, height: 30, shaded: false },
            { kind: "circle", x: 70, y: 20, width: 30, height: 30, shaded: false },
          ] } },
        { id: "auto-worked", type: "worked_problem", prompt: "أوجد ٢ + ٣", answer: "٥", steps: 2 },
      ],
    }) });
  });
  page.on("response", async response => {
    if (response.url().includes("/api/worksheets") && response.request().method() === "POST"
      && !response.url().includes("/ai/")) {
      saveStatus = response.status();
      try { saveBody = await response.json(); } catch { saveBody = await response.text(); }
    }
  });
  await page.getByRole("button", { name: /توليد الأسئلة/ }).click();
  await expect(page.getByTestId("status-worksheet-autosave")).toContainText("تم حفظ التوليد تلقائياً", { timeout: 30_000 });
  expect(generatePayload?.questionSelection).toBe("auto");
  expect(generatePayload?.counts).not.toHaveProperty("mcq");
  expect(generatePayload?.counts).not.toHaveProperty("true_false");
  expect(generatePayload?.subject).toBe("الرياضيات");
  expect(generatePayload?.gradeLevel).toBe("الصف الأول");
  expect(generatePayload?.topic).toBe("العد والأشكال");
  savedId = Number(Array.isArray(saveBody) ? saveBody[0]?.id : saveBody?.id);
  expect(saveStatus, `save response: ${JSON.stringify(saveBody)}`).toBe(201);
  expect(savedId, `save response: ${JSON.stringify(saveBody)}`).toBeGreaterThan(0);

  const printable = page.locator("#ws-printable-root");
  await expect(printable).toHaveCount(1);
  const diagram = printable.getByTestId("worksheet-question-visual");
  await expect(diagram).toBeVisible();
  await expect(diagram).toContainText("عدّ الدوائر");
  await expect(diagram.locator("svg ellipse")).toHaveCount(2);
  expect(await diagram.locator("svg ellipse").evaluateAll(nodes =>
    nodes.every(node => node.getAttribute("rx") === node.getAttribute("ry")))).toBe(true);
  await expect(printable).toContainText("كم دائرة ترى؟");
  await expect(printable).toContainText("أوجد ٢ + ٣");
  await page.screenshot({ path: testInfo.outputPath("worksheet-auto-generated-paper.png"), fullPage: true });

  const persistedResponse = page.waitForResponse(response =>
    response.url().includes(`/api/worksheets/${savedId}`) && response.request().method() === "GET");
  await page.goto(`/teacher/worksheets/${savedId}/print`);
  const persistedBody = await (await persistedResponse).json();
  expect(JSON.stringify(persistedBody), `saved worksheet API response: ${JSON.stringify(persistedBody)}`).toContain("عدّ الدوائر");
  expect(JSON.stringify(persistedBody), `saved worksheet API response: ${JSON.stringify(persistedBody)}`).toContain('"kind":"circle"');
  await expect(page.locator("#ws-printable-root")).toHaveCount(1);
  await expect(page.locator("#ws-printable-root [data-testid='worksheet-question-visual'] svg ellipse")).toHaveCount(2);
  await expect(page.locator("#ws-printable-root")).toContainText("عدّ الدوائر");
  await page.reload();
  await expect(page.locator("#ws-printable-root")).toHaveCount(1);
  await expect(page.locator("#ws-printable-root [data-testid='worksheet-question-visual'] svg ellipse")).toHaveCount(2);

  await page.goto("/teacher/worksheets/create");
  await expect(selection).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(selection.locator("button").nth(0)).toBeVisible();
  await selection.locator("button").nth(1).click();
  await expect(page.getByText("اختيار من متعدد", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("worksheet-auto-selector-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});