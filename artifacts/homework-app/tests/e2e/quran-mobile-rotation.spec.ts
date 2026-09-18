import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-quran-rotation-${suffix}@example.com`;
  const otp = "731946";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Quran Rotation ${suffix}`,
      email,
      passwordHash: "e2e-quran-rotation-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create Quran rotation teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify Quran rotation teacher: ${response.status()} ${await response.text()}`);
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");
    return { id: teacher.id, email, password: "not-used", cookieHeader };
  } finally {
    await api.dispose();
  }
}

async function expectCompletePortraitPage(page: Page) {
  const mushafPage = page.locator("[data-quran-page]").first();
  await expect(mushafPage).toBeVisible();
  await expect(mushafPage.locator(".animate-spin")).toHaveCount(0);

  const geometry = await page.locator(".quran-reader-main").evaluate((main) => {
    const pageElement = main.querySelector<HTMLElement>("[data-quran-page]");
    if (!pageElement) throw new Error("Mushaf page is unavailable");
    main.scrollTop = main.scrollHeight;
    const pageRect = pageElement.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return {
      pageBottom: pageRect.bottom,
      viewportBottom: window.innerHeight,
      scrollBottom: main.scrollTop + main.clientHeight,
      scrollHeight: main.scrollHeight,
      mainBottom: mainRect.bottom,
    };
  });

  expect(geometry.scrollBottom).toBeGreaterThanOrEqual(geometry.scrollHeight - 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.mainBottom + 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1);
}

async function expectFocusedLandscape(page: Page, expectedUrl: RegExp) {
  await page.setViewportSize(LANDSCAPE);
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.locator(".quran-reader-header")).toBeHidden();
  await expect(page.locator(".quran-reader-nav")).toBeHidden();
  await expect(page.locator(".quran-reader-dock")).toBeHidden();

  const geometry = await page.locator(".quran-reader-figure").first().evaluate((figure) => {
    const rect = figure.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      leftGap: rect.left,
      rightGap: window.innerWidth - rect.right,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewportHeight - 1);
  expect(Math.abs(geometry.leftGap - geometry.rightGap)).toBeLessThanOrEqual(2);
}

test.describe("mobile Mushaf rotation", () => {
  let teacher: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL
      || process.env.E2E_DATABASE_ISOLATED !== "1"
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Quran rotation E2E requires the isolated TEST_DATABASE_URL");
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quran_reader_positions (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        student_account_id INTEGER REFERENCES student_accounts(id) ON DELETE CASCADE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT quran_reader_positions_exactly_one_owner
          CHECK (num_nonnulls(teacher_id, student_account_id) = 1)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS quran_reader_positions_teacher_uq
        ON quran_reader_positions(teacher_id) WHERE teacher_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS quran_reader_positions_student_account_uq
        ON quran_reader_positions(student_account_id) WHERE student_account_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS quran_bookmarks (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        student_account_id INTEGER REFERENCES student_accounts(id) ON DELETE CASCADE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT quran_bookmarks_exactly_one_owner
          CHECK (num_nonnulls(teacher_id, student_account_id) = 1)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS quran_bookmarks_teacher_verse_uq
        ON quran_bookmarks(teacher_id, surah_number, ayah_number) WHERE teacher_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS quran_bookmarks_student_verse_uq
        ON quran_bookmarks(student_account_id, surah_number, ayah_number) WHERE student_account_id IS NOT NULL;
    `);
    teacher = await createVerifiedTeacher(baseURL);
  });

  test.afterAll(async () => {
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  });

  test("keeps the public Quran complete through portrait and landscape", async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await page.goto("/quran");
    await expectCompletePortraitPage(page);
    await expectFocusedLandscape(page, /\/quran(?:\/1)?(?:\?.*)?$/);
    await page.setViewportSize(PORTRAIT);
    await expect(page).toHaveURL(/\/quran(?:\/1)?(?:\?.*)?$/);
    await expectCompletePortraitPage(page);
  });

  test("keeps the teacher Quran Center route and hides its shell in landscape", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!teacher || !baseURL) throw new Error("Quran rotation fixture is unavailable");
    await attachSession(context as BrowserContext, baseURL, teacher);
    await page.setViewportSize(PORTRAIT);
    await page.goto("/teacher/quran-center?tab=mushaf");
    await expectCompletePortraitPage(page);

    await page.setViewportSize(LANDSCAPE);
    await expect(page).toHaveURL(/\/teacher\/quran-center\?tab=mushaf$/);
    await expect(page.locator(".site-layout-header")).toBeHidden();
    await expect(page.locator(".quran-center-sidebar")).toBeHidden();
    await expect(page.getByRole("button", { name: "الحلقات والطلاب" })).toBeHidden();
    await expectFocusedLandscape(page, /\/teacher\/quran-center\?tab=mushaf$/);
    await page.setViewportSize(PORTRAIT);
    await expect(page).toHaveURL(/\/teacher\/quran-center\?tab=mushaf$/);
    await expectCompletePortraitPage(page);
  });
});