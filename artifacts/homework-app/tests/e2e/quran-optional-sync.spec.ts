import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(180_000);

const READER_KEY = "hasaad:standalone-quran-reader:v1";
const SYNC_KEY = "hasaad:standalone-quran-sync:v1";
const RECITER_KEY = "hasaad:standalone-quran-recitation-id";

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-quran-sync-${suffix}@example.com`;
  const otp = "995430";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Quran Sync ${suffix}`,
      email,
      passwordHash: "e2e-quran-sync-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create Quran sync teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify Quran sync teacher: ${response.status()} ${await response.text()}`);
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

async function localReaderState(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), READER_KEY);
}

async function enableSync(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: /مزامنة العلامات والموضع والقارئ بين الأجهزة|Sync bookmarks, position, and reciter across devices/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("button", { name: /إيقاف المزامنة بين الأجهزة|Turn off sync across devices/ })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SYNC_KEY)).toBe("true");
}

async function attachAndReload(context: BrowserContext, page: Page, baseURL: string, teacher: TestTeacher) {
  await attachSession(context, baseURL, teacher);
  await page.reload();
}

test.describe("optional public Quran account sync", () => {
  let teacher: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL
      || process.env.E2E_DATABASE_ISOLATED !== "1"
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Quran sync E2E requires the isolated TEST_DATABASE_URL");
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

  test("keeps guest data local while syncing the opted-in account across two devices", async ({
    browser,
    context,
    page,
    baseURL,
  }) => {
    if (!teacher || !baseURL) throw new Error("Quran sync fixture is unavailable");

    await page.goto("/quran/2?ayah=6&page=3&view=pages");
    await expect(page.getByTestId("select-mobile-page")).toBeVisible();
    await expect(page).toHaveURL(/\/quran\/2\?.*page=3/);
    await page.getByTestId("button-mobile-bookmark").click();
    await expect(page.getByText("تم حفظ العلامة المرجعية")).toBeVisible();

    const recitersResponse = await page.request.get("/api/quran/reciters");
    expect(recitersResponse.ok()).toBe(true);
    const catalog = await recitersResponse.json() as { reciters: Array<{ id: number }> };
    const localReciterId = catalog.reciters.at(-1)?.id;
    expect(localReciterId).toBeTruthy();
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: RECITER_KEY, value: String(localReciterId) },
    );

    await expect.poll(() => localReaderState(page)).toMatchObject({
      position: { surahNumber: 2, ayahNumber: 6, pageNumber: 3 },
      bookmarks: [{ surahNumber: 2, ayahNumber: 6, pageNumber: 3 }],
    });
    expect(await page.evaluate((key) => localStorage.getItem(key), SYNC_KEY)).toBeNull();

    await attachAndReload(context, page, baseURL, teacher);
    await enableSync(page);

    const accountState = await page.request.get("/api/quran/reader-state");
    expect(accountState.ok()).toBe(true);
    await expect(accountState.json()).resolves.toMatchObject({
      position: { surahNumber: 2, ayahNumber: 6, pageNumber: 3 },
      bookmarks: [{ surahNumber: 2, ayahNumber: 6, pageNumber: 3 }],
    });

    const secondContext = await browser.newContext();
    try {
      await attachSession(secondContext, baseURL, teacher);
      const secondPage = await secondContext.newPage();
      await secondPage.goto("/quran");
      await enableSync(secondPage);

      await expect(secondPage.getByTestId("select-mobile-page")).toHaveValue("3");
      await expect(secondPage.getByTestId("button-mobile-bookmark")).toHaveAttribute("aria-label", "إزالة علامة الموضع");
      await secondPage.waitForTimeout(2_000);
      const serverAfterFreshDeviceSync = await secondPage.request.get("/api/quran/reader-state");
      expect(serverAfterFreshDeviceSync.ok()).toBe(true);
      await expect(serverAfterFreshDeviceSync.json()).resolves.toMatchObject({
        position: { surahNumber: 2, ayahNumber: 6, pageNumber: 3 },
      });
      await secondPage.getByTestId("button-mobile-audio").click({ force: true });
      await secondPage.getByTestId("button-audio-options").click();
      await expect(secondPage.getByTestId(`button-reciter-${localReciterId}`)).toHaveClass(/bg-emerald-50/);

      await secondPage.getByRole("button", { name: "إيقاف المزامنة بين الأجهزة" }).click();
      await expect.poll(() => secondPage.evaluate((key) => localStorage.getItem(key), SYNC_KEY)).toBe("false");
      await secondPage.getByTestId("select-mobile-page").selectOption("4");
      await expect.poll(() => localReaderState(secondPage)).toMatchObject({
        position: { pageNumber: 4 },
      });

      const serverAfterDisable = await secondPage.request.get("/api/quran/reader-state");
      expect(serverAfterDisable.ok()).toBe(true);
      await expect(serverAfterDisable.json()).resolves.toMatchObject({
        position: { surahNumber: 2, ayahNumber: 6, pageNumber: 3 },
        bookmarks: [{ surahNumber: 2, ayahNumber: 6, pageNumber: 3 }],
      });

    } finally {
      await secondContext.close();
    }

    await context.clearCookies();
    await page.reload();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SYNC_KEY)).toBe("false");
    await expect(page.getByTestId("select-mobile-page")).toHaveValue("3");
    await expect(page.getByTestId("button-mobile-bookmark")).toHaveAttribute("aria-label", "إزالة علامة الموضع");
    await page.getByTestId("select-mobile-page").selectOption("4");
    await expect.poll(() => localReaderState(page)).toMatchObject({
      position: { pageNumber: 4 },
    });
    await expect(page.getByTestId("select-mobile-page")).toBeVisible();
  });
});