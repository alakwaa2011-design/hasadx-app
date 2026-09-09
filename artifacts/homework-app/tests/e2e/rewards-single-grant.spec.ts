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
  studentId: number;
  studentName: string;
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
  const studentName = `طالب اختبار ${suffix}`;
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
  const [studentRow] = await db.insert(studentsTable).values({
    teacherId: teacherRow.id,
    name: studentName,
    studentClass: className,
    parentName: "ولي أمر ثابت",
    notes: "ملاحظة ثابتة",
    avatar: "/avatars/adventurer-boy.webp",
  }).returning({ id: studentsTable.id });
  if (!studentRow) throw new Error("Could not create the rewards student fixture");

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
      studentId: studentRow.id,
      studentName,
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
  const studentCard = page.getByRole("button", { name: `فتح خيارات تحفيز ${fixture.studentName}` });
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
      [fixture!.teacher.id, fixture!.studentId],
    );
    return result.rows[0]?.count;
  }).toBe(1);

  await page.getByRole("dialog", { name: "احتفال بمنح النقاط" }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog", { name: "احتفال بمنح النقاط" })).toHaveCount(0);

  await page.getByTitle("ملف الطالب").click();
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
    request.url().includes(`/api/classroom-rewards/students/${fixture!.studentId}/profile`),
  );
  await saveAvatar.click();
  const request = await profileRequest;
  expect(request.postDataJSON()).toEqual({ avatar: "/avatars/hijabi-stargazer.webp" });
  await expect(page.getByText("تم تحديث شخصية الطالب بنجاح")).toBeVisible();

  const saved = await pool.query(
    "SELECT avatar, parent_name, notes FROM students WHERE id = $1",
    [fixture.studentId],
  );
  expect(saved.rows[0]).toMatchObject({
    avatar: "/avatars/hijabi-stargazer.webp",
    parent_name: "ولي أمر ثابت",
    notes: "ملاحظة ثابتة",
  });
});