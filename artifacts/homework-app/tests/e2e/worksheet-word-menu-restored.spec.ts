import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

let teacher: TestTeacher;
let worksheetId: number;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Worksheet Word fixtures require the isolated TEST_DATABASE_URL");
  }
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-ws-word-${suffix}@example.com`;
  const otp = "996000";
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Worksheet Word ${suffix}`,
    email,
    passwordHash: "e2e-worksheet-word-fixture",
    verificationOtp: otp,
    otpExpiresAt: new Date(Date.now() + 10 * 60_000),
    emailVerified: false,
    role: "teacher",
    isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create worksheet Word teacher");

  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp } });
    if (!verify.ok()) throw new Error(`OTP verification failed: ${verify.status()} ${await verify.text()}`);
    const cookieHeader = verify.headersArray()
      .filter(header => header.name.toLowerCase() === "set-cookie")
      .map(header => header.value.split(";")[0])
      .find(value => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP did not establish a teacher session");
    teacher = { id: row.id, email, password: "not-used", cookieHeader };

    const questions = Array.from({ length: 12 }, (_, index) => index % 4 === 0
      ? {
          id: `word-mcq-${index}`,
          type: "mcq",
          prompt: `اختر الإجابة الصحيحة: ${index + 3} × ٤ = ؟`,
          options: ["١٢", "١٦", "٢٠", "٢٤"],
          correctIndex: 0,
        }
      : index % 4 === 1
        ? {
            id: `word-match-${index}`,
            type: "matching",
            prompt: `صِل بين المفردة ومعناها — Match ${index}`,
            pairs: [
              { left: "مدرسة", right: "School" },
              { left: "كتاب", right: "Book" },
              { left: "قلم", right: "Pen" },
            ],
          }
        : {
            id: `word-answer-${index}`,
            type: "short_answer",
            prompt: `اكتب الحل بخط واضح: ${index + 5} + ٧ = ؟`,
            lines: 5,
            answer: `${index + 12}`,
          });
    const created = await api.post("/api/worksheets", {
      headers: { Cookie: cookieHeader },
      data: {
        title: "مغامرة في عالم الرياضيات",
        language: "ar",
        gradeLevel: "الصف الخامس",
        subject: "رياضيات وEnglish",
        questions,
        settings: {
          includeName: true,
          includeDate: true,
          includeClass: true,
          includeAnswerKey: true,
          columns: 1,
          fontFamily: "cairo",
          fontSizePt: 13,
          showWatermark: true,
          template: "modern_band",
          schoolName: "مدرسة حصاد",
          headerNote: "مراجعة شاملة — Connected Arabic headings",
          footerNote: "Math • English • Arabic",
          layout: {
            elements: [
              { id: "word-generic-table-label", kind: "text", x: 8, y: 92, width: 80, height: 4, text: "مراجعة جدول العمليات | Operations table", fontSize: 14, bold: true, align: "center", fontColor: "#225739" },
              { id: "word-table-rule", kind: "line", x: 8, y: 97, width: 84, height: 0, strokeColor: "#D9A521", strokeWidth: 1.5 },
            ],
          },
        },
      },
    });
    if (!created.ok()) throw new Error(`Worksheet seed failed: ${created.status()} ${await created.text()}`);
    worksheetId = (await created.json()).id;
  } finally {
    await api.dispose();
  }
});

test.afterAll(async ({ baseURL }) => {
  try {
    if (worksheetId) await pool.query("DELETE FROM worksheets WHERE id = $1 AND teacher_id = $2", [worksheetId, teacher.id]);
    if (teacher?.id) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  } finally {
    await pool.end();
  }
});

test("worksheet Word menu opens without exporting; explicit editable choice downloads native DOCX", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  if (!teacher || !worksheetId || !baseURL) throw new Error("Worksheet Word fixture missing");
  await attachSession(context, baseURL, teacher);
  const relevantFailures: string[] = [];
  let renderRequests = 0;
  let downloadCount = 0;
  page.on("request", request => {
    if (/\/api\/worksheets\/\d+\/render-page/.test(request.url())) renderRequests += 1;
  });
  page.on("download", () => { downloadCount += 1; });
  page.on("response", response => {
    if (response.status() >= 500 && /worksheets|render-page/i.test(response.url())) {
      relevantFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", request => {
    if (/worksheets|render-page/i.test(request.url())) {
      relevantFailures.push(`request failed ${request.url()}: ${request.failure()?.errorText}`);
    }
  });
  page.on("console", message => {
    if (message.type() === "error") console.log("page console error:", message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/teacher/worksheets/create?edit=${worksheetId}`);
  await expect(page.getByTestId("button-ws-word")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#ws-printable-root .ws-band-title")).toBeVisible();
  const openMenuAndDismiss = async (triggerId: string) => {
    const trigger = page.getByTestId(triggerId);
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(page.getByTestId("word-export-visual")).toBeVisible();
    await expect(page.getByTestId("word-export-editable")).toBeEnabled();
    await expect(trigger).not.toHaveAttribute("aria-busy", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("word-export-visual")).toBeHidden();
    await expect(trigger).toBeEnabled();
    await expect(trigger).not.toHaveAttribute("aria-busy", "true");
    expect(renderRequests).toBe(0);
    expect(downloadCount).toBe(0);
  };
  await openMenuAndDismiss("button-ws-word");
  await openMenuAndDismiss("button-ws-word");
  await page.getByTestId("button-ws-preview").click();
  await expect(page.getByTestId("button-preview-word")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#ws-printable-root [data-worksheet-page]")).not.toHaveCount(0);

  await openMenuAndDismiss("button-preview-word");
  await openMenuAndDismiss("button-preview-word");
  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceTrigger = page.getByTestId("button-preview-word");
  await expect(workspaceTrigger).toBeEnabled();
  await workspaceTrigger.click();
  await expect(page.getByTestId("word-export-editable")).toBeVisible();
  await expect(page.getByTestId("word-export-editable")).toBeEnabled();
  const mobileRect = await page.getByTestId("word-export-visual").boundingBox();
  const toolbarRect = await page.getByTestId("toolbar-worksheet-workspace").boundingBox();
  expect(mobileRect && toolbarRect && mobileRect.y < toolbarRect.y + toolbarRect.height).toBeTruthy();
  const mobileMenuZ = await page.getByTestId("word-export-visual").evaluate(element => getComputedStyle(element.parentElement!).zIndex);
  expect(Number(mobileMenuZ)).toBeGreaterThan(100);
  await page.screenshot({ path: testInfo.outputPath("workspace-word-menu-mobile-fixed.png") });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(mobileOverflow).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("word-export-visual")).toBeHidden();
  expect(renderRequests).toBe(0);
  expect(downloadCount).toBe(0);

  await page.getByTestId("button-preview-word").click();
  await expect(page.getByTestId("word-export-editable")).toBeVisible();
  await expect(page.getByTestId("word-export-editable")).toBeEnabled();
  const editableDownload = page.waitForEvent("download", { timeout: 45_000 });
  await page.getByTestId("word-export-editable").click();
  await expect(page.getByTestId("word-export-visual")).toBeHidden();
  const editable = await editableDownload;
  const outDir = testInfo.outputPath("worksheet-word-fixed");
  const { mkdir, readFile } = await import("node:fs/promises");
  await mkdir(outDir, { recursive: true });
  const editablePath = `${outDir}/workspace-editable.docx`;
  await editable.saveAs(editablePath);
  await expect(page.getByTestId("button-preview-word")).toBeEnabled({ timeout: 30_000 });

  const editableZip = await JSZip.loadAsync(await readFile(editablePath));
  const editableXml = await editableZip.file("word/document.xml")!.async("string");
  expect(editableXml).toContain("مغامرة");
  expect(editableXml).toContain("مدرسة");
  expect(editableXml).toContain("Book");
  expect(editableXml).toContain("×");
  expect(editableXml).toContain("<w:tbl");
  expect(editableXml).toContain("<w:tblBorders");
  expect(editableXml).toMatch(/w:(?:bidi|rtl)/);
  expect(editableXml).toMatch(/<w:rFonts\b/);
  expect(editableXml).toMatch(/<w:color\b/);
  expect((editableXml.match(/<w:sectPr\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  expect(editableXml).toContain("<w:pgMar");
  expect((editableXml.match(/<w:t\b/g) ?? []).length).toBeGreaterThan(10);
  const pictureExtents = [...editableXml.matchAll(/<wp:extent\b[^>]*>/g)].map(([tag]) => ({
    cx: Number(tag.match(/\bcx="(\d+)"/)?.[1] ?? 0),
    cy: Number(tag.match(/\bcy="(\d+)"/)?.[1] ?? 0),
  }));
  expect(pictureExtents.some(({ cx, cy }) => cx >= 5_500_000 && cy >= 8_000_000)).toBe(false);

  // The close action transitions back to the builder and detaches its own
  // locator before Playwright's click settles; navigate directly for the
  // independent saved-print menu checkpoint.
  await page.goto(`/teacher/worksheets/${worksheetId}/print`);
  await expect(page.getByTestId("btn-word-export")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("btn-word-export").click();
  await expect(page.getByTestId("word-export-visual")).toBeVisible();
  await expect(page.getByTestId("word-export-editable")).toBeVisible();
  await expect(page.getByTestId("word-export-editable")).toBeEnabled();
  expect(relevantFailures).toEqual([]);
});