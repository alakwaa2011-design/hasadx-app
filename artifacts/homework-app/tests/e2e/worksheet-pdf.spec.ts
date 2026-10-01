import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import sharp from "sharp";
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
let arabicEquationWorksheetId: number;

let singleHugeAnswerWorksheetId: number;
const arabicLongAnswerWorksheetIds = new Map<
  (typeof arabicFontFamilies)[number],
  number
>();
const execFileAsync = promisify(execFile);

async function installPrintDialogStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const printWindow = window as typeof window & { __worksheetPrintCalls?: number };
    printWindow.__worksheetPrintCalls = 0;
    printWindow.print = () => {
      printWindow.__worksheetPrintCalls = (printWindow.__worksheetPrintCalls ?? 0) + 1;
    };
  });
}

async function createPdfWithPrintHandler(
  page: Page,
  printButton: Locator,
  afterPdfBeforePrintCleanup?: () => Promise<void>,
): Promise<Buffer> {
  const printCalls = await page.evaluate(() => {
    const printWindow = window as typeof window & { __worksheetPrintCalls?: number };
    return printWindow.__worksheetPrintCalls ?? 0;
  });

  await printButton.click();
  await expect
    .poll(
      () => page.evaluate(() => {
        const printWindow = window as typeof window & { __worksheetPrintCalls?: number };
        return printWindow.__worksheetPrintCalls ?? 0;
      }),
      { timeout: 15_000 },
    )
    .toBe(printCalls + 1);
  await expect(page.locator("#ws-printable-root[data-worksheet-print-target]"))
    .toHaveCount(1);
  await expect(page.locator("[data-worksheet-print-path]")).not.toHaveCount(0);

  // PrintToPDF runs while the real application export handler has scoped the
  // selected worksheet's ancestor chain for print. The stub keeps the
  // simulated print dialog open.
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await afterPdfBeforePrintCleanup?.();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("[data-worksheet-print-target]")).toHaveCount(0);
  await expect(page.locator("[data-worksheet-print-path]")).toHaveCount(0);
  if (!afterPdfBeforePrintCleanup) {
    await expect(page.locator("#ws-printable-root")).toBeAttached();
  }
  return pdf;
}

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

    const arabicEquationResponse = await api.post("/api/worksheets", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: "اختبار ترتيب المعادلات",
        language: "ar",
        gradeLevel: "اختبار",
        subject: "رياضيات",
        questions: [{
          id: "e2e-arabic-equation-q-1",
          type: "mcq",
          prompt: "ما ناتج (+20) - (+14)؟",
          options: ["+6", "-34"],
          correctIndex: 0,
        }],
        settings: {
          includeName: false,
          includeDate: false,
          includeClass: false,
          includeAnswerKey: false,
          columns: 1,
          fontFamily: "cairo",
          fontSizePt: 18,
          showWatermark: false,
          template: "exam_paper",
        },
      },
    });
    if (!arabicEquationResponse.ok()) {
      throw new Error(`Arabic equation worksheet seed failed: ${arabicEquationResponse.status()} ${await arabicEquationResponse.text()}`);
    }
    arabicEquationWorksheetId = (await arabicEquationResponse.json()).id;

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

test("Arabic equation signs and boundaries render in the same order in preview and PDF", async ({
  page,
}, testInfo) => {
  await page.goto(`/teacher/worksheets/${arabicEquationWorksheetId}/print`);
  const worksheetPage = page.locator("[data-worksheet-page]").first();
  await expect(worksheetPage).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const targets = [worksheetPage.locator(".ws-question-block").first()];
  for (const target of targets) await expect(target).toBeVisible();
  for (const token of ["(+20) - (+14)", "+6", "-34"]) {
    const mathToken = worksheetPage
      .locator('span[dir="ltr"]')
      .filter({ hasText: new RegExp(`^${token.replace(/[()+\-]/g, "\\$&")}$`) })
      .last();
    await expect(mathToken).toHaveText(token);
    const positions = await mathToken.evaluate((element, expected) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Text | null = null;
      while (walker.nextNode()) {
        const candidate = walker.currentNode as Text;
        if (candidate.data === expected) {
          node = candidate;
          break;
        }
      }
      if (!node) throw new Error(`Could not find text node for ${expected}`);
      return Array.from(expected, (_, index) => {
        const range = document.createRange();
        range.setStart(node!, index);
        range.setEnd(node!, index + 1);
        return range.getBoundingClientRect().x;
      });
    }, token);
    expect(
      positions.every((position, index) =>
        index === 0 || position >= positions[index - 1]! - 0.5),
      `Preview visually reordered ${token}`,
    ).toBe(true);
  }

  const previewTargets: Array<{
    image: Buffer;
    relativeBox: { x: number; y: number; width: number; height: number };
  }> = [];
  let worksheetSize: { width: number; height: number } | undefined;
  for (const target of targets) {
    const [pageBox, targetBox] = await Promise.all([
      worksheetPage.boundingBox(),
      target.boundingBox(),
    ]);
    if (!pageBox || !targetBox) throw new Error("Equation preview target has no bounding box");
    worksheetSize ??= { width: pageBox.width, height: pageBox.height };
    const originalStyle = await target.getAttribute("style");
    await target.evaluate((element, width) => {
      Object.assign((element as HTMLElement).style, {
        position: "fixed",
        inset: "20px auto auto 20px",
        width: `${width}px`,
        zIndex: "2147483647",
        background: "#ffffff",
      });
    }, targetBox.width);
    await page.evaluate(() => new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ));
    const previewImage = await target.screenshot();
    await target.evaluate((element, style) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    }, originalStyle);
    previewTargets.push({
      image: previewImage,
      relativeBox: {
        x: targetBox.x - pageBox.x,
        y: targetBox.y - pageBox.y,
        width: targetBox.width,
        height: targetBox.height,
      },
    });
  }
  if (!worksheetSize) throw new Error("Worksheet preview page has no size");
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  const workDir = await mkdtemp(join(tmpdir(), "worksheet-equation-pdf-"));
  try {
    const pdfPath = join(workDir, "worksheet.pdf");
    const pdfImagePrefix = join(workDir, "worksheet");
    await writeFile(pdfPath, pdf);
    await execFileAsync("pdftoppm", [
      "-f", "1",
      "-singlefile",
      "-png",
      "-r", "96",
      pdfPath,
      pdfImagePrefix,
    ]);
    const pdfPage = await readFile(`${pdfImagePrefix}.png`);
    const pdfMeta = await sharp(pdfPage).metadata();
    const scaleX = pdfMeta.width! / worksheetSize.width;
    const scaleY = pdfMeta.height! / worksheetSize.height;

    for (const [index, previewTarget] of previewTargets.entries()) {
      const box = previewTarget.relativeBox;
      const padding = 4;
      const left = Math.max(
        0,
        Math.floor(box.x * scaleX) - padding,
      );
      const top = Math.max(
        0,
        Math.floor(box.y * scaleY) - padding,
      );
      const width = Math.min(
        pdfMeta.width! - left,
        Math.ceil(box.width * scaleX) + padding * 2,
      );
      const height = Math.min(
        pdfMeta.height! - top,
        Math.ceil(box.height * scaleY) + padding * 2,
      );
      const region = { left, top, width, height };
      const pdfRegion = await sharp(pdfPage).extract(region).png().toBuffer();
      await testInfo.attach(`equation-region-${index + 1}-preview.png`, {
        body: previewTarget.image,
        contentType: "image/png",
      });
      await testInfo.attach(`equation-region-${index + 1}-pdf.png`, {
        body: pdfRegion,
        contentType: "image/png",
      });
      expect(pdfRegion).toMatchSnapshot("arabic-equation-order-pdf.png", {
        maxDiffPixelRatio: 0.005,
      });
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
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
  const formattingToolbar = page.getByTestId("toolbar-question-formatting");
  await expect(formattingToolbar).toBeVisible();
  await formattingToolbar.getByTestId("button-increase-font-size").click();
  await formattingToolbar.getByTestId("button-increase-font-size").click();
  await formattingToolbar.getByTestId("button-toggle-bold").click();
  await formattingToolbar.getByTestId("button-align-center").click();
  await formattingToolbar.getByTestId("button-choice-columns-2").click();

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
    .locator(":scope > span:not(.ws-tf-mark)")
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
    .locator("[data-worksheet-page] .ws-q-prompt > span:not(.ws-tf-mark)")
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
  await installPrintDialogStub(page);
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

  const pdf = await createPdfWithPrintHandler(
    page,
    page.getByRole("button", { name: "Save PDF", exact: true }),
  );
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("framed Kids Play pages keep usable A4 space in preview and Chromium PDF", async ({
  page,
}) => {
  await installPrintDialogStub(page);
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
  const pdf = await createPdfWithPrintHandler(
    page,
    page.getByRole("button", { name: "Save PDF", exact: true }),
  );
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("long answer keys become numbered A4 DOM pages that match the PDF", async ({
  page,
}) => {
  await installPrintDialogStub(page);
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
  const pdf = await createPdfWithPrintHandler(
    page,
    page.getByRole("button", { name: "Save PDF", exact: true }),
  );
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
});

test("creator PDF export isolates exact question pages at multiple overlay scroll positions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await installPrintDialogStub(page);

  const blockedApiWrites: Array<{ method: string; path: string }> = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.includes("/socket.io/")) return route.abort();
    if (!["GET", "HEAD"].includes(request.method())) {
      blockedApiWrites.push({ method: request.method(), path });
      return route.abort();
    }

    const emptyListPaths = new Set([
      "/api/teacher/schedule",
      "/api/notifications",
      "/api/teacher/grade-levels",
      "/api/me/achievements",
      "/api/direct-messages",
    ]);
    const body = path === "/api/auth/me"
      ? {
        id: 998_877,
        name: "PDF Baseline Teacher",
        email: "worksheet-pdf-baseline@example.invalid",
        role: "teacher",
        isAdmin: false,
      }
      : emptyListPaths.has(path) || path.includes("/worksheets")
        ? []
        : {};
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("hw_lang", "en");
  });
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const artifactDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../.local/worksheet-pdf-baseline/creator-after",
  );
  await mkdir(artifactDir, { recursive: true });

  const markerFor = (prefix: string, index: number) =>
    `CREATOR-${prefix}-Q${String(index).padStart(2, "0")}-QUESTION-MARKER`;
  const answerFor = (index: number) =>
    `CREATOR-KEY-A${String(index).padStart(2, "0")}-ANSWER-MARKER`;
  const questionMarkerPattern = /CREATOR-(?:TWO|THREE|LONG|KEY)-Q\d+-QUESTION-MARKER/g;
  const answerMarkerPattern = /CREATOR-KEY-A\d+-ANSWER-MARKER/g;

  const openCreatorPreview = async (
    label: string,
    prefix: "TWO" | "THREE" | "LONG" | "KEY",
    count: number,
  ) => {
    await page.goto("/teacher/worksheets/create");
    await page.getByTestId("tab-format-info").click();
    await page.getByTestId("input-ws-title").fill(label);
    for (let index = 0; index < count; index += 1) {
      await page.getByRole("button", { name: "Add Question", exact: true }).click();
      await page.getByRole("menuitem", { name: "Short Answer", exact: true }).click();
    }

    const prompts = page.getByPlaceholder("Question text");
    await expect(prompts).toHaveCount(count);
    const cards = page.locator('[id^="worksheet-question-"]');
    for (let index = 0; index < count; index += 1) {
      await prompts.nth(index).fill(markerFor(prefix, index + 1));
      const card = cards.nth(index);
      await card
        .locator("label")
        .filter({ hasText: "Lines for printing" })
        .locator("input")
        .fill("18");
      await card
        .locator("label")
        .filter({ hasText: "Model answer (key)" })
        .locator("input")
          .fill(prefix === "KEY"
            ? `${answerFor(index + 1)} ${"A detailed model answer used to verify long answer-key page boundaries. ".repeat(12)}`
            : `CREATOR-${prefix}-A${index + 1}-MODEL-ANSWER`);
    }

    await page.getByTestId("button-ws-preview").click();
    const overlay = page
      .locator("div.fixed.inset-0")
      .filter({ has: page.getByTestId("button-close-preview") })
      .last();
    await expect(overlay).toBeVisible();
    await expect(overlay.locator("#ws-printable-root")).toBeVisible();
    return { overlay, root: overlay.locator("#ws-printable-root") };
  };

  const setScrollPosition = async (overlay: Locator, pageIndex: number) => {
    const targetTop = await overlay.evaluate((element, index) => {
      const pageNode = element.querySelectorAll("[data-worksheet-page], [data-answer-key-page]")[index];
      if (!pageNode) throw new Error(`Expected worksheet page at scroll index ${index}`);
      return pageNode.getBoundingClientRect().top
        - element.getBoundingClientRect().top
        + element.scrollTop;
    }, pageIndex);
    await overlay.evaluate((element, top) => {
      element.scrollTop = top;
    }, targetTop);
    if (pageIndex > 0) {
      await expect.poll(() => overlay.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    }
    const visiblePageIndices = await overlay.evaluate(element =>
      Array.from(element.querySelectorAll("[data-worksheet-page], [data-answer-key-page]"))
        .map((pageNode, index) => ({
          index,
          bounds: pageNode.getBoundingClientRect(),
        }))
        .filter(({ bounds }) =>
          bounds.bottom > element.getBoundingClientRect().top
          && bounds.top < element.getBoundingClientRect().bottom,
        )
        .map(({ index }) => index),
    );
    expect(visiblePageIndices).toContain(pageIndex);
  };

  const captureCreatorPdf = async (
    captureName: string,
    prefix: "TWO" | "THREE" | "LONG" | "KEY",
    questionCountForCase: number,
    overlay: Locator,
    root: Locator,
    scrollPageIndex: number,
    withAnswerKey = false,
    closePreviewWhilePrintIsOpen = false,
  ) => {
    await setScrollPosition(overlay, scrollPageIndex);
    const worksheetPages = root.locator("[data-worksheet-page]");
    const answerPages = root.locator("[data-answer-key-page]");
    const worksheetPageCount = await worksheetPages.count();
    const answerPageCount = await answerPages.count();
    const domPageCount = worksheetPageCount + answerPageCount;
    const questionMarkers = Array.from(
      { length: questionCountForCase },
      (_, index) => markerFor(prefix, index + 1),
    );
    const domQuestionMarkers = await worksheetPages.evaluateAll(pages =>
      pages.flatMap(pageNode =>
        Array.from(pageNode.querySelectorAll(".ws-q-prompt"))
          .map(prompt => prompt.textContent?.match(/CREATOR-(?:TWO|THREE|LONG|KEY)-Q\d+-QUESTION-MARKER/)?.[0])
          .filter((marker): marker is string => Boolean(marker)),
      ),
    );
    expect(domQuestionMarkers).toEqual(questionMarkers);

    const pdf = await createPdfWithPrintHandler(
      page,
      overlay.getByRole("button", { name: "Save PDF", exact: true }),
      closePreviewWhilePrintIsOpen
        ? async () => {
          await overlay.getByTestId("button-close-preview").click();
          await expect(page.locator("div.fixed.inset-0").filter({
            has: page.getByTestId("button-close-preview"),
          })).toHaveCount(0);
          await expect(page.getByTestId("button-ws-preview")).toBeVisible();
        }
        : undefined,
    );
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdfPath = join(artifactDir, `${captureName}.pdf`);
    await writeFile(pdfPath, pdf);
    const extracted = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
    });
    const pdfText = String(extracted.stdout);
    const physicalPages = pdfText.split("\f").filter(text => text.trim().length > 0);
    expect(physicalPages).toHaveLength(domPageCount);

    const worksheetPdfText = physicalPages.slice(0, worksheetPageCount).join("\n");
    const answerPdfText = physicalPages.slice(worksheetPageCount).join("\n");
    const printedQuestionMarkers = worksheetPdfText.match(questionMarkerPattern) ?? [];
    expect(printedQuestionMarkers).toEqual(questionMarkers);
    for (const marker of questionMarkers) {
      expect(printedQuestionMarkers.filter(value => value === marker)).toHaveLength(1);
    }
    expect(pdfText).not.toContain("Worksheet Builder");
    expect(pdfText).not.toContain("Preview & print");
    if (withAnswerKey) {
      const expectedAnswers = Array.from(
        { length: questionCountForCase },
        (_, index) => answerFor(index + 1),
      );
      const printedAnswerMarkers = answerPdfText.match(answerMarkerPattern) ?? [];
      expect(printedAnswerMarkers).toEqual(expectedAnswers);
      expect(answerPageCount).toBeGreaterThan(0);
      expect(answerPageCount).toBeGreaterThan(1);
      for (const marker of expectedAnswers) {
        expect(printedAnswerMarkers.filter(value => value === marker)).toHaveLength(1);
      }
    } else {
      expect(answerPageCount).toBe(0);
      expect(pdfText.match(answerMarkerPattern) ?? []).toHaveLength(0);
    }

    await writeFile(join(artifactDir, `${captureName}.txt`), pdfText);
    await writeFile(
      join(artifactDir, `${captureName}.json`),
      JSON.stringify({
        browser: "Playwright Chromium",
        viewport: { width: 1280, height: 1000 },
        mockedApi: "All GET /api responses intercepted; all non-read API requests aborted.",
        blockedApiWrites,
        pageErrors,
        captureName,
        overlayScrollPageIndex: scrollPageIndex,
        domPageCounts: { worksheet: worksheetPageCount, answerKey: answerPageCount, total: domPageCount },
        physicalPageCount: countChromiumPdfPages(pdf),
        pdfBytes: pdf.length,
        questionMarkers: domQuestionMarkers,
        answerMarkers: withAnswerKey ? answerPdfText.match(answerMarkerPattern) ?? [] : [],
        baseline: ".local/worksheet-pdf-baseline/creator/two-question-pages.pdf",
      }, null, 2),
    );
    expect(countChromiumPdfPages(pdf)).toBe(domPageCount);
    expect(pageErrors).toEqual([]);
  };

  const pendingPreview = await openCreatorPreview(
    "CREATOR CANCELLED EXPORT REGRESSION",
    "TWO",
    2,
  );
  await page.evaluate(() => {
    localStorage.setItem("e2e-worksheet-pdf-persistent-print-count", "0");
    const nativePrint = window.print.bind(window);
    window.print = () => {
      const count = Number(localStorage.getItem("e2e-worksheet-pdf-persistent-print-count") ?? "0");
      localStorage.setItem("e2e-worksheet-pdf-persistent-print-count", String(count + 1));
      nativePrint();
    };
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise<FontFaceSet>(() => {}) },
    });
  });
  await pendingPreview.overlay.getByRole("button", { name: "Save PDF", exact: true }).click();
  await expect(pendingPreview.root).toHaveAttribute("data-worksheet-print-target", "");
  await expect(pendingPreview.overlay.getByTestId("button-close-preview")).toBeDisabled();
  // The UI intentionally keeps Close disabled while export is preparing.
  // A real browser navigation still unmounts the selected worksheet; verify
  // readiness cancellation survives that unmount without starting print.
  await page.goto("/teacher/worksheets");
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("e2e-worksheet-pdf-persistent-print-count"),
  )).toBe("0");
  await expect(page.locator("[data-worksheet-print-target], [data-worksheet-print-path]"))
    .toHaveCount(0);
  expect(pageErrors).toEqual([]);

  const two = await openCreatorPreview("CREATOR TWO PAGE REGRESSION", "TWO", 2);
  await expect(two.root.locator("[data-worksheet-page]")).toHaveCount(2);
  await captureCreatorPdf(
    "creator-two-scroll-page-1",
    "TWO",
    2,
    two.overlay,
    two.root,
    0,
    false,
    true,
  );

  const three = await openCreatorPreview("CREATOR THREE PAGE REGRESSION", "THREE", 3);
  await expect(three.root.locator("[data-worksheet-page]")).toHaveCount(3);
  await captureCreatorPdf("creator-three-scroll-page-1", "THREE", 3, three.overlay, three.root, 0);
  await captureCreatorPdf("creator-three-scroll-page-2", "THREE", 3, three.overlay, three.root, 1);

  const longer = await openCreatorPreview("CREATOR LONG QUESTION PAPER REGRESSION", "LONG", 6);
  await expect.poll(async () => longer.root.locator("[data-worksheet-page]").count())
    .toBeGreaterThan(3);
  await captureCreatorPdf("creator-long-questions-scroll-page-4", "LONG", 6, longer.overlay, longer.root, 3);

  const keyed = await openCreatorPreview("CREATOR LONG ANSWER KEY REGRESSION", "KEY", 6);
  const formatPanelButton = keyed.overlay.getByRole("button", { name: /Header & format/ });
  if (await formatPanelButton.getAttribute("aria-expanded") !== "true") {
    await formatPanelButton.click();
  }
  await keyed.overlay.getByTestId("tab-format-header").click();
  await keyed.overlay.getByTestId("toggle-ws-answers").click();
  await keyed.overlay.getByTestId("tab-format-design").click();
  await keyed.overlay.getByTestId("theme-kids_play").click();
  await keyed.overlay.getByTestId("select-ws-font").selectOption("georgia");
  await keyed.overlay.getByTestId("tab-format-header").click();
  await keyed.overlay.getByTestId("input-ws-school").fill(
    "CREATOR LONG HEADER SCHOOL DISTRICT AND CAMPUS NAME",
  );
  await keyed.overlay.getByTestId("input-ws-teacher").fill("PDF Baseline Teacher");
  await expect.poll(async () => keyed.root.locator("[data-answer-key-page]").count())
    .toBeGreaterThan(0);
  await expect.poll(async () => keyed.root.locator("[data-worksheet-page]").count())
    .toBeGreaterThan(2);
  const longHeader = await keyed.overlay.getByTestId("input-ws-school").inputValue();
  expect(longHeader).toContain("CREATOR LONG HEADER");
  const fontFamily = await keyed.root.evaluate(root =>
    getComputedStyle(root).fontFamily.toLowerCase(),
  );
  expect(fontFamily).toContain("georgia");
  await captureCreatorPdf(
    "creator-kids-play-long-key-scroll-answer-page",
    "KEY",
    6,
    keyed.overlay,
    keyed.root,
    (await keyed.root.locator("[data-worksheet-page], [data-answer-key-page]").count()) - 1,
    true,
  );

  await keyed.overlay.getByTestId("tab-format-info").click();
  await keyed.overlay.getByTestId("input-ws-title").fill("LONG ANSWER KEY");
  await keyed.overlay.getByTestId("tab-format-design").click();
  await keyed.overlay.getByTestId("theme-science_lab").click();
  const logoBuffer = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 34, g: 87, b: 57, alpha: 1 },
    },
  }).png().toBuffer();
  await keyed.overlay.getByTestId("input-ws-logo").setInputFiles({
    name: "worksheet-logo.png",
    mimeType: "image/png",
    buffer: logoBuffer,
  });
  await expect(
    keyed.overlay.getByTestId("panel-worksheet-format").getByAltText("Logo"),
  ).toBeVisible();
  await expect.poll(async () => keyed.root.locator("img").evaluateAll(images =>
    images.some(image => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
  await captureCreatorPdf(
    "creator-science-lab-logo-key-scroll-answer-page",
    "KEY",
    6,
    keyed.overlay,
    keyed.root,
    (await keyed.root.locator("[data-worksheet-page], [data-answer-key-page]").count()) - 1,
    true,
  );

  expect(blockedApiWrites.every(write => !["GET", "HEAD"].includes(write.method))).toBe(true);
  expect(pageErrors).toEqual([]);
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
