import { expect, test } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
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

let teacher: TestTeacher;
let worksheetId: number;
let longAnswerWorksheetId: number;

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