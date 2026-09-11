import { expect, test, type Page } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import {
  attachSession,
  newApi,
  type TestTeacher,
} from "./helpers";

test.setTimeout(120_000);

type ClassColorFixture = {
  teacher: TestTeacher;
  firstClassName: string;
  secondClassName: string;
};

let fixture: ClassColorFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function classCard(page: Page, className: string) {
  return page.locator(
    `[data-testid="class-card"][data-class-name="${className}"]`,
  );
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");

  const api = await newApi(baseURL);
  try {
    const suffix = uniqueSuffix();
    const email = `e2e-class-colors-${suffix}@example.com`;
    const otp = "994000";
    const firstClassName = `صف اللون الثابت ${suffix}`;
    const secondClassName = `صف اللون الآخر ${suffix}`;

    const [teacherRow] = await db
      .insert(teachersTable)
      .values({
        name: `E2E Class Colors Teacher ${suffix}`,
        email,
        passwordHash: "e2e-class-colors-fixture",
        verificationOtp: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        emailVerified: false,
        role: "teacher",
        isBlocked: false,
      })
      .returning({ id: teachersTable.id });
    if (!teacherRow) throw new Error("Could not create the class color teacher fixture");

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

    const teacher: TestTeacher = {
      id: teacherRow.id,
      email,
      password: "not-used",
      cookieHeader,
    };

    await pool.query(
      `INSERT INTO teacher_classes (teacher_id, name)
       VALUES ($1, $2), ($1, $3)`,
      [teacher.id, firstClassName, secondClassName],
    );
    await pool.query(
      `INSERT INTO students (teacher_id, name, grade_level, student_class)
       VALUES ($1, $2, $3, $3), ($1, $4, $5, $5)`,
      [
        teacher.id,
        `طالب الصف الأول ${suffix}`,
        firstClassName,
        `طالب الصف الثاني ${suffix}`,
        secondClassName,
      ],
    );

    fixture = { teacher, firstClassName, secondClassName };
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ context, baseURL }) => {
  if (!fixture || !baseURL) throw new Error("Class color fixture is unavailable");
  await attachSession(context, baseURL, fixture.teacher);
});

test.afterAll(async () => {
  if (fixture) {
    await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacher.id]);
  }
});

test("class colors survive reload and rename, while reset stays isolated", async ({ page }) => {
  if (!fixture) throw new Error("Class color fixture is unavailable");

  const renamedClassName = `${fixture.firstClassName} بعد التسمية`;
  await page.goto("/teacher/students", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("إدارة الصفوف والطلاب", { exact: true })).toBeVisible({ timeout: 20_000 });

  const firstCard = classCard(page, fixture.firstClassName);
  const secondCard = classCard(page, fixture.secondClassName);
  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible();

  // Give both classes explicit, different colors so a reset or rename cannot
  // accidentally apply one class's state to another.
  await firstCard.getByRole("button", { name: "تغيير لون الصف" }).click();
  await firstCard.getByRole("button", { name: "بنفسجي", exact: true }).click();
  await expect(firstCard.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-purple-500/);

  await secondCard.getByRole("button", { name: "تغيير لون الصف" }).click();
  await secondCard.getByRole("button", { name: "برتقالي", exact: true }).click();
  await expect(secondCard.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-orange-500/);

  // The persisted classes response must restore both explicit colors.
  await page.reload({ waitUntil: "domcontentloaded" });
  const firstCardAfterReload = classCard(page, fixture.firstClassName);
  const secondCardAfterReload = classCard(page, fixture.secondClassName);
  await expect(firstCardAfterReload.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-purple-500/);
  await expect(secondCardAfterReload.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-orange-500/);

  // Renaming must preserve the color under the new class name.
  await firstCardAfterReload.getByRole("button", { name: "تغيير اسم الصف" }).click();
  const renameInput = firstCardAfterReload.locator("input").first();
  await renameInput.fill(renamedClassName);
  await renameInput.press("Enter");

  const renamedCard = classCard(page, renamedClassName);
  await expect(renamedCard).toBeVisible();
  await expect(renamedCard.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-purple-500/);
  await expect(classCard(page, fixture.firstClassName)).toHaveCount(0);
  await expect(classCard(page, fixture.secondClassName).locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-orange-500/);

  // Reset the second class to its automatic palette without changing the
  // renamed class's explicit purple selection.
  const secondCardBeforeReset = classCard(page, fixture.secondClassName);
  await secondCardBeforeReset.getByRole("button", { name: "تغيير لون الصف" }).click();
  const resetButton = secondCardBeforeReset.getByRole("button", { name: "اللون التلقائي", exact: true });
  await expect(resetButton).toBeVisible();
  await resetButton.click();

  await page.reload({ waitUntil: "domcontentloaded" });
  const renamedCardAfterReset = classCard(page, renamedClassName);
  const secondCardAfterReset = classCard(page, fixture.secondClassName);
  await expect(renamedCardAfterReset.locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-purple-500/);
  await secondCardAfterReset.getByRole("button", { name: "تغيير لون الصف" }).click();
  await expect(
    secondCardAfterReset.locator('button[aria-pressed="true"]'),
  ).toHaveCount(0);
});