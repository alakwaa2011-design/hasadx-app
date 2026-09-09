import { expect, test } from "@playwright/test";
import {
  db,
  pool,
  studentsTable,
  teacherClassesTable,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

type RewardsFixture = {
  teacher: TestTeacher;
  className: string;
  students: Array<{ id: number; name: string }>;
};

let fixture: RewardsFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function seedRewardsFixture(baseURL: string): Promise<RewardsFixture> {
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Rewards E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  const suffix = uniqueSuffix();
  const email = `e2e-rewards-${suffix}@example.com`;
  const otp = "994000";
  const className = `صف اختبار ${suffix}`;
  const studentNames = [`طالب اختبار أ ${suffix}`, `طالب اختبار ب ${suffix}`];
  const [teacherRow] = await db.insert(teachersTable).values({
    name: `E2E Rewards Teacher ${suffix}`,
    email,
    passwordHash: "e2e-rewards-fixture",
    verificationOtp: otp,
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    emailVerified: false,
    role: "teacher",
    isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!teacherRow) throw new Error("Could not create the rewards teacher fixture");

  await db.insert(teacherClassesTable).values({ teacherId: teacherRow.id, name: className });
  const studentRows = await db.insert(studentsTable).values(
    studentNames.map((name) => ({
      teacherId: teacherRow.id,
      name,
      studentClass: className,
      parentName: "ولي أمر ثابت",
      notes: "ملاحظة ثابتة",
      avatar: "/avatars/adventurer-boy.webp",
    })),
  ).returning({ id: studentsTable.id, name: studentsTable.name });
  if (studentRows.length !== studentNames.length) throw new Error("Could not create the rewards student fixtures");

  const api = await newApi(baseURL);
  try {
    const verify = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp } });
    if (!verify.ok()) {
      throw new Error(`Could not verify rewards teacher: ${verify.status()} ${await verify.text()}`);
    }
    const cookieHeader = verify.headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");

    return {
      teacher: {
        id: teacherRow.id,
        email,
        password: "not-used-after-otp-verification",
        cookieHeader,
      },
      className,
      students: studentRows,
    };
  } finally {
    await api.dispose();
  }
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  fixture = await seedRewardsFixture(baseURL);
});

test.beforeEach(async ({ context, baseURL }) => {
  if (!fixture || !baseURL) throw new Error("Rewards fixture is unavailable");
  await attachSession(context, baseURL, fixture.teacher);
});

test.afterAll(async () => {
  try {
    if (fixture) await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacher.id]);
  } finally {
    await pool.end();
  }
});

test("single grant celebrates only success, resists repeated input, and saves only the avatar", async ({ page }) => {
  if (!fixture) throw new Error("Rewards fixture is unavailable");
  await page.goto(`/teacher/rewards/${encodeURIComponent(fixture.className)}`);
  const student = fixture.students[0];
  const studentCard = page.getByRole("button", { name: `فتح خيارات تحفيز ${student.name}` });
  await expect(studentCard).toBeVisible({ timeout: 20_000 });

  let failedGrantRequests = 0;
  await page.route("**/api/classroom-rewards/grants", async (route) => {
    failedGrantRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "فشل اختباري" }),
    });
  });
  await studentCard.click();
  await page.getByRole("button", { name: /مشاركة مميزة/ }).click();
  await expect(page.getByText("فشل اختباري")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);
  expect(failedGrantRequests).toBe(1);
  await page.unroute("**/api/classroom-rewards/grants");

  await page.getByRole("button", { name: /مشاركة مميزة/ }).click();
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toBeVisible();
  await studentCard.click({ force: true });
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect.poll(async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM classroom_reward_transactions
       WHERE teacher_id = $1 AND student_id = $2 AND kind = 'grant'`,
      [fixture!.teacher.id, student.id],
    );
    return result.rows[0]?.count;
  }).toBe(1);

  await page.getByRole("dialog", { name: "احتفال بمنح النقاط" }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);

  await studentCard.locator("xpath=..").getByTitle("ملف الطالب").click();
  const profileGrant = page.getByRole("button", { name: /مشاركة مميزة/ });
  await expect(profileGrant).toBeVisible();

  let failedProfileGrantRequests = 0;
  await page.route("**/api/classroom-rewards/grants", async (route) => {
    failedProfileGrantRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "فشل منح ملف الطالب" }),
    });
  });
  await profileGrant.click();
  await expect(page.getByText("فشل منح ملف الطالب")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);
  expect(failedProfileGrantRequests).toBe(1);
  await page.unroute("**/api/classroom-rewards/grants");

  let profileGrantRequests = 0;
  await page.route("**/api/classroom-rewards/grants", async (route) => {
    profileGrantRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await profileGrant.click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toBeVisible();
  expect(profileGrantRequests).toBe(1);
  await expect.poll(async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM classroom_reward_transactions
       WHERE teacher_id = $1 AND student_id = $2 AND kind = 'grant'`,
      [fixture!.teacher.id, student.id],
    );
    return result.rows[0]?.count;
  }).toBe(2);
  await page.unroute("**/api/classroom-rewards/grants");
  await page.getByRole("dialog", { name: "احتفال بمنح النقاط" }).evaluate((element) => {
    (element as HTMLElement).click();
  });
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);

  await page.getByRole("tab", { name: "البيانات" }).click();
  const avatarChoice = page.getByRole("button", { name: "راصدة النجوم" });
  await avatarChoice.click();
  const saveAvatar = page.getByRole("button", { name: "حفظ الشخصية" });
  await expect(saveAvatar).toBeVisible();
  const avatarGrid = avatarChoice.locator("xpath=..");
  const [saveBox, gridBox] = await Promise.all([saveAvatar.boundingBox(), avatarGrid.boundingBox()]);
  expect(saveBox, "save avatar button must have visible geometry").not.toBeNull();
  expect(gridBox, "avatar grid must have visible geometry").not.toBeNull();
  expect(saveBox!.y).toBeLessThan(gridBox!.y);

  const profileRequest = page.waitForRequest((request) =>
    request.method() === "PATCH" &&
    request.url().includes(`/api/classroom-rewards/students/${student.id}/profile`),
  );
  await saveAvatar.click();
  const request = await profileRequest;
  expect(request.postDataJSON()).toEqual({ avatar: "/avatars/hijabi-stargazer.webp" });
  await expect(page.getByText("تم تحديث شخصية الطالب بنجاح")).toBeVisible();

  const saved = await pool.query(
    "SELECT avatar, parent_name, notes FROM students WHERE id = $1",
    [student.id],
  );
  expect(saved.rows[0]).toMatchObject({
    avatar: "/avatars/hijabi-stargazer.webp",
    parent_name: "ولي أمر ثابت",
    notes: "ملاحظة ثابتة",
  });
});

test("bulk grant sends one request and records one grant per student under rapid click and Enter", async ({ page }) => {
  if (!fixture) throw new Error("Rewards fixture is unavailable");
  await page.goto(`/teacher/rewards/${encodeURIComponent(fixture.className)}`);

  for (const student of fixture.students) {
    await page.getByRole("button", { name: `تحديد ${student.name} للمنح الجماعي` }).click();
  }

  const grantButton = page.locator("button").filter({ hasText: /^\s*مشاركة مميزة\s*\+\d+\s*$/ }).first();
  await expect(grantButton).toBeVisible();
  await grantButton.focus();

  let grantRequests = 0;
  const requestBodies: unknown[] = [];
  await page.route("**/api/classroom-rewards/grants", async (route) => {
    grantRequests += 1;
    requestBodies.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  await grantButton.dispatchEvent("click");
  await grantButton.dispatchEvent("click");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toBeVisible();
  await grantButton.dispatchEvent("click");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);

  expect(grantRequests).toBe(1);
  expect(requestBodies).toHaveLength(1);
  expect(requestBodies[0]).toMatchObject({
    className: fixture.className,
    studentIds: expect.arrayContaining(fixture.students.map((student) => student.id)),
  });
  const bulkRequest = requestBodies[0] as { idempotencyKey: string };
  expect(bulkRequest.idempotencyKey).toEqual(expect.any(String));

  const transactionResult = await pool.query(
    `SELECT student_id, COUNT(*)::int AS count, SUM(amount)::int AS points
     FROM classroom_reward_transactions
     WHERE teacher_id = $1 AND idempotency_key = $2 AND student_id = ANY($3::int[]) AND kind = 'grant'
     GROUP BY student_id
     ORDER BY student_id`,
    [fixture.teacher.id, bulkRequest.idempotencyKey, fixture.students.map((student) => student.id)],
  );
  expect(transactionResult.rows).toHaveLength(fixture.students.length);
  for (const student of fixture.students) {
    expect(transactionResult.rows.find((row) => row.student_id === student.id)).toMatchObject({
      count: 1,
      points: expect.any(Number),
    });
  }

  const batchResult = await pool.query(
    `SELECT COUNT(*)::int AS count, MIN(target_count)::int AS target_count
     FROM classroom_reward_batches
     WHERE teacher_id = $1 AND idempotency_key = $2`,
    [fixture.teacher.id, bulkRequest.idempotencyKey],
  );
  expect(batchResult.rows[0]).toMatchObject({
    count: 1,
    target_count: fixture.students.length,
  });

  await page.unroute("**/api/classroom-rewards/grants");
  await page.getByRole("dialog", { name: "احتفال بمنح النقاط" }).evaluate((element) => {
    (element as HTMLElement).click();
  });
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);

  await page.getByRole("button", { name: `تحديد ${fixture.students[0].name} للمنح الجماعي` }).click();
  const nextGrantRequest = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("/api/classroom-rewards/grants"),
  );
  await grantButton.click();
  await nextGrantRequest;
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toBeVisible();
});
