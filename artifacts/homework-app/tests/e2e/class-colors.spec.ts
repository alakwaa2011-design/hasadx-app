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
  thirdClassName: string;
  fourthClassName: string;
  firstGroupName: string;
  secondGroupName: string;
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
    const thirdClassName = `صف اللون الثالث ${suffix}`;
    const fourthClassName = `صف اللون الرابع ${suffix}`;
    const firstGroupName = `مجموعة الألوان الأولى ${suffix}`;
    const secondGroupName = `مجموعة الألوان الثانية ${suffix}`;

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
      `INSERT INTO teacher_classes (teacher_id, name, group_name)
       VALUES ($1, $2, $3), ($1, $4, $3), ($1, $5, $6), ($1, $7, $6)`,
      [
        teacher.id,
        firstClassName,
        firstGroupName,
        secondClassName,
        thirdClassName,
        secondGroupName,
        fourthClassName,
      ],
    );
    await pool.query(
      `INSERT INTO students (teacher_id, name, grade_level, student_class)
       VALUES
         ($1, $2, $3, $3),
         ($1, $4, $5, $5),
         ($1, $6, $7, $7),
         ($1, $8, $9, $9)`,
      [
        teacher.id,
        `طالب الصف الأول ${suffix}`,
        firstClassName,
        `طالب الصف الثاني ${suffix}`,
        secondClassName,
        `طالب الصف الثالث ${suffix}`,
        thirdClassName,
        `طالب الصف الرابع ${suffix}`,
        fourthClassName,
      ],
    );

    fixture = {
      teacher,
      firstClassName,
      secondClassName,
      thirdClassName,
      fourthClassName,
      firstGroupName,
      secondGroupName,
    };
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

test("desktop grouped class cards keep their colors after reassignment and reorder", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-class-colors", "This regression covers the desktop grid only");
  if (!fixture) throw new Error("Class color fixture is unavailable");

  await page.goto("/teacher/students", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("إدارة الصفوف والطلاب", { exact: true })).toBeVisible({ timeout: 20_000 });

  const firstCard = classCard(page, fixture.firstClassName);
  const secondCard = classCard(page, fixture.secondClassName);
  const thirdCard = classCard(page, fixture.thirdClassName);
  const fourthCard = classCard(page, fixture.fourthClassName);
  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible();
  await expect(thirdCard).toBeVisible();
  await expect(fourthCard).toBeVisible();
  expect(await page.evaluate(() => window.innerWidth)).toBeGreaterThanOrEqual(1000);

  const setColor = async (
    card: ReturnType<typeof classCard>,
    label: string,
    accentClass: string,
  ) => {
    await card.getByRole("button", { name: "تغيير لون الصف" }).click();
    await card.getByRole("button", { name: label, exact: true }).click();
    await expect(card.locator('[data-testid="class-color-accent"]')).toHaveClass(
      new RegExp(accentClass),
    );
  };

  const assertColors = async () => {
    await expect(classCard(page, fixture.firstClassName).locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-purple-500/);
    await expect(classCard(page, fixture.secondClassName).locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-orange-500/);
    await expect(classCard(page, fixture.thirdClassName).locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-cyan-500/);
    await expect(classCard(page, fixture.fourthClassName).locator('[data-testid="class-color-accent"]')).toHaveClass(/bg-rose-500/);
  };

  await setColor(firstCard, "بنفسجي", "bg-purple-500");
  await setColor(secondCard, "برتقالي", "bg-orange-500");
  await setColor(thirdCard, "سماوي", "bg-cyan-500");
  await setColor(fourthCard, "وردي", "bg-rose-500");
  await assertColors();

  // Move the third class from the second group into the first group. The
  // class identity, not its previous position or group, must own its color.
  await thirdCard.getByTitle("تعيين مجموعة").click();
  await thirdCard.getByRole("button", { name: fixture.firstGroupName, exact: true }).click();
  await expect(thirdCard).toBeVisible();
  await expect(thirdCard.getByTitle("تعيين مجموعة")).toBeVisible();
  await assertColors();

  // Reorder cards within the now three-class first group. This exercises the
  // desktop grid's sortable keys rather than relying on the mobile list.
  const firstHandle = firstCard.getByRole("button", { name: "اسحب لإعادة الترتيب" });
  const thirdHandle = thirdCard.getByRole("button", { name: "اسحب لإعادة الترتيب" });
  await firstHandle.dragTo(thirdHandle);

  await expect
    .poll(async () =>
      page.locator('[data-testid="class-card"]').evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-class-name")),
      ),
    )
    .toEqual([
      fixture.secondClassName,
      fixture.firstClassName,
      fixture.thirdClassName,
      fixture.fourthClassName,
    ]);
  await assertColors();
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