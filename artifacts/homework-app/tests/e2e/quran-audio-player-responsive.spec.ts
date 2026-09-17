import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-quran-responsive-${suffix}@example.com`;
  const otp = "995410";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Quran Responsive ${suffix}`,
      email,
      passwordHash: "e2e-quran-responsive-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create Quran responsive teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify Quran teacher: ${response.status()} ${await response.text()}`);
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");

    return {
      id: teacher.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
  } finally {
    await api.dispose();
  }
}

async function expectInsideViewport(locator: Locator, page: Page): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.width).toBeGreaterThanOrEqual(32);
  expect(box.height).toBeGreaterThanOrEqual(32);
}

test.describe("Quran audio player responsive controls", () => {
  let teacher: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Quran responsive E2E requires the isolated TEST_DATABASE_URL");
    }
    teacher = await createVerifiedTeacher(baseURL);
  });

  test.afterAll(async () => {
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
    await pool.end();
  });

  test("keeps reader and player controls reachable across phone and tablet widths", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!teacher || !baseURL) throw new Error("Quran responsive fixture is unavailable");
    await attachSession(context, baseURL, teacher);

    const controls = [
      "button-play-pause",
      "button-prev-ayah",
      "button-stop",
      "button-next-ayah",
      "button-memo-options",
      "button-audio-options",
      "button-close-player",
    ];

    for (const language of ["ar", "en"] as const) {
      await page.addInitScript((lang) => localStorage.setItem("hw_lang", lang), language);
      for (const width of [320, 360, 375, 390, 768]) {
        await page.setViewportSize({ width, height: width === 768 ? 640 : 844 });
        await page.goto("/teacher/quran-reader/1?view=reader");
        await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
        await expect(page.getByTestId("button-play-pause")).toBeVisible();

        for (const testId of controls) {
          await expectInsideViewport(page.getByTestId(testId), page);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

        const toolsButton = page.getByRole("button", {
          name: language === "ar" ? "أدوات القراءة" : "Reading tools",
        });
        await expectInsideViewport(toolsButton, page);
        await toolsButton.click();
        for (const name of language === "ar"
          ? ["السورة", "الآية", "الجزء", "صفحة المصحف"]
          : ["Surah", "Ayah", "Juz", "Mushaf page"]) {
          const control = page.getByRole("combobox", { name });
          await control.scrollIntoViewIfNeeded();
          await expectInsideViewport(control, page);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    }
  });
});