import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import {
  db,
  pool,
  teachersTable,
  worksheetsTable,
} from "../../../../lib/db/src/index.ts";
import {
  attachSession,
  newApi,
  type TestTeacher,
} from "./helpers";

const questionCount = 8;
const questionPrompts = Array.from(
  { length: questionCount },
  (_, index) => `E2E-Q${String(index + 1).padStart(2, "0")}-ORDER-MARKER`,
);
const arabicFontFamilies = [
  "default",
  "cairo",
  "tajawal",
  "amiri",
  "noto-naskh",
  "inter",
  "georgia",
] as const;

let teacher: TestTeacher;
let worksheetId: number;
let framedWorksheetId: number;
let longAnswerWorksheetId: number;
let arabicFormattingWorksheetId: number;

let singleHugeAnswerWorksheetId: number;
const arabicLongAnswerWorksheetIds = new Map<
  (typeof arabicFontFamilies)[number],
  number
>();

function countChromiumPdfPages(pdf: Buffer): number {
  // Chromium writes every physical page as a /Type /Page object. The word
  // boundary deliberately excludes the parent /Type /Pages node.
  return pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  const api = await newApi(baseURL);
  try {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-worksheet-${suffix}@example.com`;
    const otp = "994000";
    const [teacherRow] = await db
      .insert(teachersTable)
      .values({
        name: `E2E Worksheet Teacher ${suffix}`,
        email,
        passwordHash: "e2e-worksheet-fixture",
        verificationOtp: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        emailVerified: false,
        role: "teacher",
        isBlocked: false,
      })
      .returning({ id: teachersTable.id });
    if (!teacherRow) throw new Error("Could not create the worksheet teacher fixture");

    const verify = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!verify.ok()) {
      throw new Error(`Teacher verification failed: ${verify.status()} ${await verify.text()}`);
    }
    const cookieHeader = verify
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("Teacher verification did not establish a session");
    teacher = {
      id: teacherRow.id,
      email,
      password: "not-used",
      cookieHeader,
    };

    const questions = questionPrompts.map((prompt, index) => ({
      id: `e2e-worksheet-q-${index + 1}`,
      type: "short_answer" as const,
      prompt,
      // Keep the worksheet multi-page while leaving its compact eight-row
      // answer key within one A4 page.
      lines: 8,
      answer: `ANSWER-${index + 1}`,
    }));
    const response = await api.post("/api/worksheets", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: "E2E MULTIPAGE PDF",
        language: "en",
        gradeLevel: "E2E",
        subject: "PDF regression",
        questions,
        settings: {
          includeName: true,
          includeDate: true,
          includeClass: true,
          includeAnswerKey: true,
          columns: 2,
          fontFamily: "inter",
          fontSizePt: 12,
          showWatermark: true,
          template: "geometric",
          footerNote: "E2E-FOOTER-MARKER",
        },
      },
    });
    if (!response.ok()) {
      throw new Error(`Worksheet seed failed: ${response.status()} ${await response.text()}`);
    }
    const worksheet = await response.json();
    worksheetId = worksheet.id;

    const framedQuestions = Array.from({ length: 6 }, (_, index) => ({
      id: `e2e-framed-q-${index + 1}`,
      type: "short_answer" as const,
      prompt: `FRAMED-Q${index + 1}-MARKER`,
      lines: 1,
      answer: `FRAMED-ANSWER-${index + 1}`,
    }));
    const framedResponse = await api.post("/api/worksheets", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: "E2E FRAMED KIDS WORKSHEET",
        language: "en",
        gradeLevel: "E2E",
        subject: "Framed A4 regression",
        questions: framedQuestions,
        settings: {
          includeName: true,
          includeDate: true,
          includeClass: true,
          includeAnswerKey: false,
          columns: 1,
          fontFamily: "inter",
          fontSizePt: 12,
          showWatermark: true,
          template: "kids_play",
        },
      },
    });
    if (!framedResponse.ok()) {
      throw new Error(`Framed worksheet seed failed: ${framedResponse.status()} ${await framedResponse.text()}`);
    }
    framedWorksheetId = (await framedResponse.json()).id;

    const arabicFormattingQuestions = [
      {
        id: "e2e-arabic-format-q-1",
        type: "mcq" as const,
        prompt: "سؤال التنسيق العربي الأول",
        options: ["الإجابة الأولى", "الإجابة الثانية", "الإجابة الثالثة", "الإجابة الرابعة"],
        correctIndex: 2,
      },
      {
        id: "e2e-arabic-format-q-2",
        type: "mcq" as const,
        prompt: "سؤال التنسيق العربي الثاني",
        options: ["الخيار ألف", "الخيار باء", "الخيار جيم", "الخيار دال"],
        correctIndex: 1,
      },
      {
        id: "e2e-arabic-format-q-3",
        type: "true_false" as const,
        prompt: "سؤال التنسيق العربي الثالث",
        correct: true,
      },
    ];
    const arabicFormattingResponse = await api.post("/api/worksheets", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: "اختبار ثبات تنسيق الأسئلة",
        language: "ar",
        gradeLevel: "اختبار",
        subject: "ثبات التنسيق",
        questions: arabicFormattingQuestions,
        settings: {
          includeName: true,
          includeDate: true,
          includeClass: true,
          includeAnswerKey: true,
          columns: 1,
          fontFamily: "cairo",
          fontSizePt: 12,
          showWatermark: true,
          template: "arabic_ink",
        },
      },
    });
    if (!arabicFormattingResponse.ok()) {
      throw new Error(`Arabic formatting worksheet seed failed: ${arabicFormattingResponse.status()} ${await arabicFormattingResponse.text()}`);
    }
    arabicFormattingWorksheetId = (await arabicFormattingResponse.json()).id;

    const longAnswerQuestions = Array.from({ length: 18 }, (_, index) => ({
      id: `e2e-long-answer-q-${index + 1}`,
      type: "short_answer" as const,
      prompt: `LONG-ANSWER-PROMPT-${index + 1}`,
      lines: 1,
      answer: `LONG-ANSWER-${index + 1}-MARKER ${"A deliberately verbose answer used to verify measured A4 answer-key pagination. ".repeat(5)}`,
    }));
    const longAnswerResponse = await api.post("/api/worksheets", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: "E2E LONG ANSWER KEY",
        language: "en",
        gradeLevel: "E2E",
        subject: "PDF regression",
        questions: longAnswerQuestions,
        settings: {
          includeName: false,
          includeDate: false,
          includeClass: false,
          includeAnswerKey: true,
          columns: 1,
          fontFamily: "inter",
          fontSizePt: 12,
          showWatermark: true,
          template: "geometric",
        },
      },
    });
    if (!longAnswerResponse.ok()) {
      throw new Error(`Long answer worksheet seed failed: ${longAnswerResponse.status()} ${await longAnswerResponse.text()}`);
    }
    longAnswerWorksheetId = (await longAnswerResponse.json()).id;

    const [hugeAnswerWorksheet] = await db
      .insert(worksheetsTable)
      .values({
        teacherId: teacher.id,
        title: "E2E SINGLE HUGE ANSWER",
        language: "en",
        gradeLevel: "E2E",
        subject: "PDF regression",
        questions: [{
          id: "e2e-single-huge-answer",
          type: "short_answer",
          prompt: "SINGLE-HUGE-ANSWER-PROMPT",
          lines: 1,
          // Seed through the database to represent legacy/imported content that
          // predates the current API's 800-character answer validation.
          answer: `SINGLE-HUGE-ANSWER-START ${"W".repeat(4000)} SINGLE-HUGE-ANSWER-END`,
        }],
        settings: {
          includeName: false,
          includeDate: false,
          includeClass: false,
          includeAnswerKey: true,
          columns: 1,
          fontFamily: "inter",
          fontSizePt: 18,
          showWatermark: true,
          template: "geometric",
        },
      })
      .returning({ id: worksheetsTable.id });
    if (!hugeAnswerWorksheet) throw new Error("Could not create huge answer worksheet fixture");
    singleHugeAnswerWorksheetId = hugeAnswerWorksheet.id;

    const arabicLongAnswerQuestions = Array.from({ length: 18 }, (_, index) => ({
      id: `e2e-arabic-long-answer-q-${index + 1}`,
      type: "short_answer" as const,
      prompt: `سؤال ترتيب الإجابات العربية ${index + 1}`,
      lines: 1,
      answer: `إجابة عربية رقم ${index + 1} — ${"نص عربي طويل للتحقق من ثبات تقسيم صفحة الإجابات وقياسات الخط العربي. ".repeat(5)}`,
    }));
    for (const fontFamily of arabicFontFamilies) {
      const arabicLongAnswerResponse = await api.post("/api/worksheets", {
        headers: { Cookie: teacher.cookieHeader },
        data: {
          title: `اختبار مفتاح الإجابات العربية الطويل — ${fontFamily}`,
          language: "ar",
          gradeLevel: "اختبار",
          subject: "ثبات الطباعة",
          questions: arabicLongAnswerQuestions,
          settings: {
            includeName: false,
            includeDate: false,
            includeClass: false,
            includeAnswerKey: true,
            columns: 1,
            fontFamily,
            fontSizePt: 13,
            showWatermark: true,
            template: "arabic_ink",
          },
        },
      });
      if (!arabicLongAnswerResponse.ok()) {
        throw new Error(`Arabic long answer worksheet seed failed for ${fontFamily}: ${arabicLongAnswerResponse.status()} ${await arabicLongAnswerResponse.text()}`);
      }
      arabicLongAnswerWorksheetIds.set(
        fontFamily,
        (await arabicLongAnswerResponse.json()).id,
      );
    }
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await pool.end();
});

test.beforeEach(async ({ context, baseURL }) => {
  await attachSession(context, baseURL!, teacher);
});

test("Arabic question formatting and option layout survive save, reload, and PDF export", async ({
  page,
}) => {
  const prompts = [
    "سؤال التنسيق العربي الأول",
    "سؤال التنسيق العربي الثاني",
    "سؤال التنسيق العربي الثالث",
  ];
  const answers = ["(ج) الإجابة الثالثة", "(ب) الخيار باء", "صح"];

  await page.goto(`/teacher/worksheets/${arabicFormattingWorksheetId}/print`);
  const printable = page.locator("#ws-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "تحرير الورقة", exact: true }).click();

  const firstPrompt = printable.locator(".ws-q-prompt .ws-editable").first();
  await firstPrompt.click();
  const formattingToolbar = page.getByRole("toolbar", { name: "تنسيق النص المحدد" });
  await expect(formattingToolbar).toBeVisible();
  await formattingToolbar.getByTitle("تكبير الخط").click();
  await formattingToolbar.getByTitle("تكبير الخط").click();
  await formattingToolbar.getByTitle("عريض").click();
  await formattingToolbar.getByTitle("توسيط").click();
  await formattingToolbar.getByRole("button", { name: "خياران في سطر" }).click();

  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByText("تم حفظ تعديلات الورقة")).toBeVisible();
  await page.reload();
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const reloadedPrompt = printable
    .locator("[data-worksheet-page] .ws-q-prompt")
    .filter({ hasText: prompts[0] })
    .locator("span")
    .first();
  await expect(reloadedPrompt).toHaveCSS("font-size", "18.6667px");
  await expect(reloadedPrompt).toHaveCSS("font-weight", "800");
  await expect(reloadedPrompt).toHaveCSS("text-align", "center");
  expect(
    await printable.locator("[data-worksheet-page] .ws-mcq").first().evaluate(
      element => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(2);

  const worksheetPrompts = (await printable
    .locator("[data-worksheet-page] .ws-q-prompt > span:first-child")
    .allTextContents())
    .map(text => text.trim());
  expect(worksheetPrompts).toEqual(prompts);

  const answerRows = (await printable
    .locator("[data-answer-key-page] .ws-answer-line")
    .allTextContents())
    .map(text => text.replace(/^الإجابة:\s*/, "").trim());
  expect(answerRows).toEqual(answers);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "وورد", exact: true }).click();
  const wordDownload = await downloadPromise;
  expect(wordDownload.suggestedFilename()).toBe("اختبار ثبات تنسيق الأسئلة.docx");
  const wordPath = await wordDownload.path();
  expect(wordPath).not.toBeNull();
  const wordBytes = await readFile(wordPath!);
  expect(wordBytes.subarray(0, 2).toString("ascii")).toBe("PK");
  const zip = await JSZip.loadAsync(wordBytes);
  expect(zip.file("[Content_Types].xml")).not.toBeNull();
  expect(zip.file("word/document.xml")).not.toBeNull();
  const wordXml = await zip.file("word/document.xml")!.async("string");
  expect(wordXml).toContain("<w:document");
  expect(wordXml).toContain("<w:bidi");
  expect(wordXml).toContain("<w:rtl");
  expect(wordXml).toContain("<w:sz w:val=\"28\"");
  expect(wordXml).toContain("<w:b");
  expect(wordXml).toContain("<w:jc w:val=\"center\"");
  for (const prompt of prompts) expect(wordXml).toContain(prompt);
  for (const answer of answers) expect(wordXml).toContain(answer);
  expect(wordXml.match(/<w:tr>/g)?.length).toBeGreaterThanOrEqual(2);
  expect(wordXml.match(/<w:tc>/g)?.length).toBeGreaterThanOrEqual(4);
  for (const choice of ["الإجابة الأولى", "الإجابة الثانية", "الإجابة الثالثة", "الإجابة الرابعة"]) {
    expect(wordXml).toContain(choice);
  }

  const domPageCount = await printable.locator(".ws-page").count();
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("A4 PDF preserves every DOM page without duplicated questions or a detached footer", async ({
  page,
}) => {
  await page.goto(`/teacher/worksheets/${worksheetId}/print`);

    const printable = page.locator("#ws-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await expect(printable.locator("[data-answer-key-page]")).toHaveCount(1);

  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Pagination is measurement-driven. Require the page partition to remain
  // unchanged across two animation frames before asking Chromium to print it.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            new Promise<string>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const pages = Array.from(
                    document.querySelectorAll<HTMLElement>(
                      "#ws-printable-root [data-worksheet-page]",
                    ),
                  );
                  resolve(
                    pages
                      .map((node) =>
                        Array.from(node.querySelectorAll(".ws-q-num"))
                          .map((number) => number.textContent?.trim())
                          .join(","),
                      )
                      .join("|"),
                  );
                }),
              );
            }),
        ),
      { timeout: 15_000 },
    )
    .toMatch(/\|/);

  const worksheetPages = printable.locator("[data-worksheet-page]");
    const domPageCount = await printable.locator(".ws-page").count();
  expect(await worksheetPages.count()).toBeGreaterThanOrEqual(2);
  expect(domPageCount).toBe((await worksheetPages.count()) + 1);

  const renderedPrompts = await worksheetPages.locator(".ws-q-prompt").allTextContents();
  const normalizedPrompts = renderedPrompts.map((text) => text.trim());
  expect(normalizedPrompts).toEqual(questionPrompts);
  for (const prompt of questionPrompts) {
    expect(normalizedPrompts.filter((value) => value === prompt)).toHaveLength(1);
  }

  // Every worksheet DOM page owns question content. The only visible footer is
  // on the final worksheet page; requiring a question beside it protects
  // against a footer-only DOM page, while the PDF/DOM count below catches a
  // footer fragmented onto an extra physical page.
  for (const worksheetPage of await worksheetPages.all()) {
    expect(await worksheetPage.locator(".ws-q").count()).toBeGreaterThan(0);
  }
  const finalWorksheetPage = worksheetPages.last();
  await expect(finalWorksheetPage.locator(".ws-footer")).toHaveCount(1);
  await expect(finalWorksheetPage.locator(".ws-footer-note")).toHaveText(
    "E2E-FOOTER-MARKER",
  );
  expect(await finalWorksheetPage.locator(".ws-q").count()).toBeGreaterThan(0);

  const answerPage = printable.locator("[data-answer-key-page]");
  await expect(answerPage.locator(".ws-answer")).toHaveCount(questionCount);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("framed Kids Play pages keep usable A4 space in preview and Chromium PDF", async ({
  page,
}) => {
  await page.goto(`/teacher/worksheets/${framedWorksheetId}/print`);
  const printable = page.locator("#ws-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const worksheetPages = printable.locator("[data-worksheet-page]");
  await expect.poll(async () => worksheetPages.count(), { timeout: 15_000 }).toBeGreaterThan(1);

  await expect
    .poll(
      async () => worksheetPages.first().locator(".ws-q-prompt").allTextContents(),
      { timeout: 15_000 },
    )
    .toContain("FRAMED-Q4-MARKER");

  const previewHeights = await worksheetPages.evaluateAll((pages) => {
    const a4HeightPx = (297 / 25.4) * 96;
    return pages.map((worksheetPage) => ({
      height: worksheetPage.getBoundingClientRect().height,
      a4HeightPx,
    }));
  });
  for (const { height, a4HeightPx } of previewHeights) {
    expect(height).toBeLessThanOrEqual(a4HeightPx + 2);
  }

  const domPageCount = await printable.locator(".ws-page").count();
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("long answer keys become numbered A4 DOM pages that match the PDF", async ({
  page,
}) => {
  await page.goto(`/teacher/worksheets/${longAnswerWorksheetId}/print`);
  const printable = page.locator("#ws-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const answerPages = printable.locator("[data-answer-key-page]");
  await expect
    .poll(async () => answerPages.count(), { timeout: 15_000 })
    .toBeGreaterThan(1);

  await expect(answerPages.nth(1).locator("[data-answer-key-continuation]")).toBeVisible();
  await expect(answerPages.nth(1).locator(".ws-cont-title")).toContainText("Answer Key");
  await expect(answerPages.nth(1).locator(".ws-cont-page")).toContainText("Page");

  const answerMarkers = (await answerPages.locator(".ws-answer-line").allTextContents())
    .map(text => text.match(/LONG-ANSWER-\d+-MARKER/)?.[0])
    .filter((marker): marker is string => Boolean(marker));
  expect(answerMarkers).toEqual(
    Array.from({ length: 18 }, (_, index) => `LONG-ANSWER-${index + 1}-MARKER`),
  );

  for (const answerPage of await answerPages.all()) {
    expect(await answerPage.locator(".ws-answer").count()).toBeGreaterThan(0);
  }

  const domPageCount = await printable.locator(".ws-page").count();
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("one huge answer is split across contextual DOM pages that match the PDF", async ({
  page,
}) => {
  await page.goto(`/teacher/worksheets/${singleHugeAnswerWorksheetId}/print`);
    const printable = page.locator("#ws-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

    const answerPages = printable.locator("[data-answer-key-page]");
  await expect.poll(async () => answerPages.count(), { timeout: 15_000 }).toBeGreaterThan(1);
  const answerParts = answerPages.locator(".ws-answer");
  expect(await answerParts.count()).toBeGreaterThan(1);
  await expect(answerParts.first()).toContainText("SINGLE-HUGE-ANSWER-START");
  await expect(answerParts.last()).toContainText("SINGLE-HUGE-ANSWER-END");

  for (const part of await answerParts.all()) {
    await expect(part.locator(".ws-q-num")).toHaveText("1");
    await expect(part.locator(".ws-q-prompt")).toContainText("SINGLE-HUGE-ANSWER-PROMPT");
  }
  await expect(answerParts.nth(1)).toHaveAttribute("data-answer-continuation", "true");
  await expect(answerParts.nth(1)).toContainText("continued");

    const domPageCount = await printable.locator(".ws-page").count();
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("Arabic long answer keys preserve RTL continuation headers, answer order, and PDF page count", async ({
  page,
}) => {
  for (const fontFamily of arabicFontFamilies) {
    const worksheetId = arabicLongAnswerWorksheetIds.get(fontFamily);
    expect(worksheetId, `missing Arabic fixture for ${fontFamily}`).toBeDefined();
    await page.goto(`/teacher/worksheets/${worksheetId}/print`);

    const printable = page.locator("#ws-printable-root");
    await expect(printable).toBeVisible({ timeout: 20_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const worksheetPageCount = await printable.locator("[data-worksheet-page]").count();
    const answerPages = printable.locator("[data-answer-key-page]");

    await expect
      .poll(async () => answerPages.count(), { timeout: 15_000 })
      .toBeGreaterThan(1);

    const continuationHeaders = answerPages.locator("[data-answer-key-continuation]");
    const continuationHeaderCount = await continuationHeaders.count();
    expect(continuationHeaderCount).toBe((await answerPages.count()) - 1);
    for (let index = 0; index < continuationHeaderCount; index += 1) {
      const continuationHeader = continuationHeaders.nth(index);
      await expect(continuationHeader.locator(".ws-cont-title")).toContainText("صفحة الإجابات");
      await expect(continuationHeader.locator(".ws-cont-page")).toHaveText(
        `صفحة ${worksheetPageCount + index + 2}`,
      );
      expect(
        await continuationHeader.evaluate((node) => getComputedStyle(node).direction),
      ).toBe("rtl");
    }

    const answerNumbers = (await answerPages.locator(".ws-answer .ws-q-num").allTextContents())
      .map((text) => Number.parseInt(text.trim(), 10));
    expect(answerNumbers).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );

    for (const answerPage of await answerPages.all()) {
      expect(await answerPage.locator(".ws-answer").count()).toBeGreaterThan(0);
    }

    const domPageCount = await printable.locator(".ws-page").count();
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
  }
});
