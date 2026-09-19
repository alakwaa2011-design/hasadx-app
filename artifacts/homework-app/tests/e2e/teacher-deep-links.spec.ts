import { expect, test } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

let teacher: TestTeacher | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-deep-links-${suffix}@example.com`;
  const otp = "995000";
  const [row] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Deep Links ${suffix}`,
      email,
      passwordHash: "e2e-deep-links-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create deep-link teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(
        `Could not verify deep-link teacher: ${response.status()} ${await response.text()}`,
      );
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find(
        (value) =>
          value.startsWith("connect.sid=") || value.startsWith("session="),
      );
    if (!cookieHeader) {
      throw new Error("OTP verification did not establish a teacher session");
    }
    return {
      id: row.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
  } finally {
    await api.dispose();
  }
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Deep-link E2E fixtures require the isolated TEST_DATABASE_URL");
  }
  teacher = await createVerifiedTeacher(baseURL);
});

test.afterAll(async () => {
  if (teacher) {
    await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  }
});

test("teacher sections, tools, and games survive direct links and browser history", async ({
  page,
  context,
  baseURL,
}) => {
  if (!teacher || !baseURL) throw new Error("Deep-link fixture is unavailable");
  await attachSession(context, baseURL, teacher);

  await page.goto("/teacher/assignments");
  await expect(page).toHaveURL(/\/teacher\/assignments$/);

  await page.goto("/teacher/tools/content");
  await expect(page).toHaveURL(/\/teacher\/tools\/content$/);
  await expect(page.locator('[data-testid="teacher-tools-page"]:visible')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/teacher\/tools\/content$/);
  await expect(page.locator('[data-testid="tools-group-content"]:visible')).toBeVisible();

  await page.goto("/teacher/competitions");
  await expect(page).toHaveURL(/\/teacher\/competitions$/);
  await expect(page.locator('[data-testid="teacher-competitions-page"]:visible')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/teacher\/tools\/content$/);
  await expect(page.locator('[data-testid="tools-group-content"]:visible')).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/teacher\/competitions$/);
  await expect(page.locator('[data-testid="teacher-competitions-page"]:visible')).toBeVisible();

  const copiedToolUrl = new URL("/teacher/tools/timer", baseURL).toString();
  await page.goto(copiedToolUrl);
  await expect(page).toHaveURL(/\/teacher\/tools\/timer$/);
  await page.reload();
  await expect(page).toHaveURL(/\/teacher\/tools\/timer$/);

  const copiedGameUrl = new URL("/game/wameeth/create", baseURL).toString();
  await page.goto(copiedGameUrl);
  await expect(page).toHaveURL(/\/game\/wameeth\/create$/);
  await page.reload();
  await expect(page).toHaveURL(/\/game\/wameeth\/create$/);

  await page.goto("/teacher?tab=tools");
  await expect(page).toHaveURL(/\/teacher\/tools\/ai-tools$/);
  await expect(page.locator('[data-testid="tools-group-ai-tools"]:visible')).toBeVisible();

  await page.goto("/teacher?tab=competitive");
  await expect(page).toHaveURL(/\/teacher\/competitions$/);

  await page.goto("/teacher?liveGame=1");
  await expect(page).toHaveURL(/\/game\/wameeth\/create$/);

  await page.goto("/game/wameeth?assignmentId=42");
  await expect(page).toHaveURL(/\/game\/wameeth\/create\?assignmentId=42$/);
});