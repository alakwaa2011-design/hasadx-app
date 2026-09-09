import { expect, test } from "@playwright/test";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  db,
  pool,
  studentsTable,
  teacherClassesTable,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { NORMAL_AVATARS as SERVER_NORMAL_AVATARS } from "../../../api-server/src/routes/classroom-rewards.ts";
import { ILLUSTRATED_AVATARS } from "../../src/lib/avatars.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

type RewardsFixture = {
  teacher: TestTeacher;
  className: string;
  students: Array<{ id: number; name: string }>;
};

let fixture: RewardsFixture | undefined;

const publicDirectory = fileURLToPath(new URL("../../public/", import.meta.url));

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

test("every illustrated avatar offered by the UI is accepted by the server", () => {
  const missingFromServer = ILLUSTRATED_AVATARS
    .map((avatar) => avatar.value)
    .filter((avatar) => !SERVER_NORMAL_AVATARS.has(avatar));

  expect(
    missingFromServer,
    `Add these UI avatars to the server NORMAL_AVATARS allowlist: ${missingFromServer.join(", ")}`,
  ).toEqual([]);
});

test("every illustrated avatar has a local image file", () => {
  const missingLocalFiles = ILLUSTRATED_AVATARS
    .map((avatar) => ({
      ...avatar,
      filePath: resolve(publicDirectory, avatar.value.replace(/^\/+/, "")),
    }))
    .filter(({ filePath }) => !existsSync(filePath) || !statSync(filePath).isFile());

  expect(
    missingLocalFiles,
    missingLocalFiles.length > 0
      ? `ملفات صور الشخصيات المفقودة:\n${missingLocalFiles
          .map(({ label, value, filePath }) => `- ${label}: ${value} (${filePath})`)
          .join("\n")}`
      : "كل شخصية مصوّرة مرتبطة بملف صورة محلي",
  ).toEqual([]);
});

test("single grant celebrates only success, resists repeated input, and saves only the avatar", async ({ page }) => {
  if (!fixture) throw new Error("Rewards fixture is unavailable");
  const failedAvatarRequests: string[] = [];
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).pathname.startsWith("/avatars/")) {
      failedAvatarRequests.push(request.url());
    }
  });
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
  await page.getByRole("button", { name: /عرض المجموعة الكاملة/ }).click();
  for (const avatar of ILLUSTRATED_AVATARS) {
    const avatarChoice = page.getByRole("button", { name: avatar.label });
    const avatarImage = avatarChoice.locator("img");
    await expect(
      avatarChoice,
      `بطاقة الشخصية "${avatar.label}" غير ظاهرة في المجموعة الكاملة: ${avatar.value}`,
    ).toBeVisible();
    await expect(
      avatarImage,
      `صورة الشخصية "${avatar.label}" غير ظاهرة في المجموعة الكاملة: ${avatar.value}`,
    ).toBeVisible();
    await expect(
      avatarImage,
      `مصدر صورة الشخصية "${avatar.label}" لا يطابق مسارها: ${avatar.value}`,
    ).toHaveAttribute("src", avatar.value);
    await expect
      .poll(
        () =>
          avatarImage.evaluate((image: HTMLImageElement) => ({
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          })),
        {
          message: `الشخصية "${avatar.label}" لم تُحمّل صورة فعلية من ${avatar.value}`,
        },
      )
      .toMatchObject({
        complete: true,
        naturalWidth: expect.any(Number),
        naturalHeight: expect.any(Number),
      });
    const dimensions = await avatarImage.evaluate((image: HTMLImageElement) => ({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));
    expect(
      dimensions.naturalWidth,
      `الشخصية "${avatar.label}" حمّلت ملفًا بلا عرض فعلي: ${avatar.value}`,
    ).toBeGreaterThan(0);
    expect(
      dimensions.naturalHeight,
      `الشخصية "${avatar.label}" حمّلت ملفًا بلا ارتفاع فعلي: ${avatar.value}`,
    ).toBeGreaterThan(0);
    expect(
      failedAvatarRequests.filter((url) => new URL(url).pathname === avatar.value),
      `فشل طلب صورة الشخصية "${avatar.label}": ${avatar.value}`,
    ).toEqual([]);
  }

  const avatarChoice = page.getByRole("button", { name: "روح الإبداع" });
  await avatarChoice.click();
  const saveAvatar = page.getByRole("button", { name: "حفظ الشخصية" });
  await expect(saveAvatar).toBeVisible();
  const avatarGrid = avatarChoice.locator("xpath=..");
  const [saveBox, gridBox] = await Promise.all([saveAvatar.boundingBox(), avatarGrid.boundingBox()]);
  expect(saveBox, "save avatar button must have visible geometry").not.toBeNull();
  expect(gridBox, "avatar grid must have visible geometry").not.toBeNull();
  expect(saveBox!.y).toBeLessThan(gridBox!.y);

  let avatarSaveRequests = 0;
  const avatarSaveBodies: unknown[] = [];
  await page.route(`**/api/classroom-rewards/students/${student.id}/profile`, async (route) => {
    avatarSaveRequests += 1;
    avatarSaveBodies.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await saveAvatar.dispatchEvent("click");
  await saveAvatar.dispatchEvent("click");
  await saveAvatar.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByText("تم تحديث شخصية الطالب بنجاح")).toBeVisible();
  expect(avatarSaveRequests).toBe(1);
  expect(avatarSaveBodies).toEqual([{ avatar: "/avatars/casual-bob-girl.webp" }]);
  await page.unroute(`**/api/classroom-rewards/students/${student.id}/profile`);

  const saved = await pool.query(
    "SELECT avatar, parent_name, notes FROM students WHERE id = $1",
    [student.id],
  );
  expect(saved.rows[0]).toMatchObject({
    avatar: "/avatars/casual-bob-girl.webp",
    parent_name: "ولي أمر ثابت",
    notes: "ملاحظة ثابتة",
  });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "البيانات" })).toHaveCount(0);
  await studentCard.locator("xpath=..").getByTitle("ملف الطالب").click();
  await page.getByRole("tab", { name: "البيانات" }).click();
  await expect(page.getByRole("button", { name: "روح الإبداع" })).toHaveAttribute("aria-pressed", "true");
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
