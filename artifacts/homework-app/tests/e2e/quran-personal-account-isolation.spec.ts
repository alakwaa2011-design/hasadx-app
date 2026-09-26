import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";

test.setTimeout(240_000);

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const studentPassword = "QuranIsolation123!";
type Account = { id: number; identifier: string };
let teachers: Account[] = [];
let students: Account[] = [];
let wardId: number;

async function authenticated(context: BrowserContext, path: string, data: object) {
  const response = await context.request.post(path, { data });
  if (!response.ok()) throw new Error(`${path} failed: ${response.status()} ${await response.text()}`);
}

async function teacherLogin(context: BrowserContext, teacher: Account) {
  await authenticated(context, "/api/auth/login", { email: teacher.identifier, password: studentPassword });
}

async function studentLogin(context: BrowserContext, student: Account) {
  await authenticated(context, "/api/student-auth/login", {
    username: student.identifier,
    password: studentPassword,
  });
}

async function openPlan(page: Page, path: string) {
  await page.goto(path);
  const button = page.getByTestId("button-personal-quran-plan");
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByTestId("quran-personal-plan-panel")).toBeVisible();
}

async function savePlan(page: Page, startAyah: string, endAyah: string, goal: string) {
  await page.getByTestId("select-personal-plan-start-ayah").selectOption(startAyah);
  await page.getByTestId("select-personal-plan-end-ayah").selectOption(endAyah);
  await page.getByTestId("input-personal-plan-daily-goal").fill(goal);
  await page.getByTestId("button-save-personal-plan").click();
  await expect(page.getByTestId("text-personal-plan-progress")).toHaveText(`0 / ${goal}`);
  await expect(page.getByTestId("text-personal-plan-start")).toContainText(`الآية ${startAyah}`);
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Personal Quran browser fixtures require isolated TEST_DATABASE_URL");
  }
  for (let n = 0; n < 2; n++) {
    const email = `quran-personal-${suffix}-${n}@example.com`;
    const teacher = await pool.query(
      `INSERT INTO teachers(name, email, password_hash, email_verified)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [`Quran personal ${suffix} ${n}`, email, "$2b$10$kH8yOb76hIhYOS5qMaRxW.QYeVKm05nDD/34lKSBVXN2270B.vZAS"],
    );
    teachers.push({ id: Number(teacher.rows[0].id), identifier: email });
  }
});

test.afterAll(async () => {
  for (const teacher of teachers) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  for (const student of students) await pool.query("DELETE FROM student_accounts WHERE id = $1", [student.id]);
});

test("keeps teacher and student plans and sessions private on one device; ward opens independent practice", async ({
  page, context,
}) => {
  for (let n = 0; n < 2; n++) {
    const username = `quranpersonal${suffix}${n}`;
    const response = await context.request.post("/api/student-auth/register", {
      data: { username, displayName: `طالب خطة ${suffix} ${n}`, password: studentPassword },
    });
    expect(response.ok(), await response.text()).toBe(true);
    students.push({ id: Number((await response.json()).student.id), identifier: username });
    await authenticated(context, "/api/student-auth/logout", {});
  }

  const roster = await pool.query(
    `INSERT INTO students(name, teacher_id, student_account_id, student_class)
     VALUES ($1, $2, $3, 'E2E') RETURNING id`,
    [`طالب خطة ${suffix}`, teachers[0].id, students[0].id],
  );
  const ward = await pool.query(
    `INSERT INTO quran_wards(teacher_id, student_id, mode, surah_number, surah_name, start_ayah, end_ayah, assigned_date)
     VALUES ($1, $2, 'memorization', 1, 'الفاتحة', 5, 7, CURRENT_DATE) RETURNING id`,
    [teachers[0].id, roster.rows[0].id],
  );
  wardId = Number(ward.rows[0].id);

  await teacherLogin(context, teachers[0]);
  await openPlan(page, "/teacher/quran-reader/1");
  await savePlan(page, "1", "2", "1");
  await page.getByTestId("button-start-next-personal-ayah").click();
  await expect(page.getByTestId("quran-guided-memorization-panel")).toBeVisible();
  await authenticated(context, "/api/auth/logout", {});

  await teacherLogin(context, teachers[1]);
  await openPlan(page, "/teacher/quran-reader/1");
  await expect(page.getByTestId("form-personal-plan")).toBeVisible();
  await expect(page.getByTestId("button-resume-personal-session")).toHaveCount(0);
  await savePlan(page, "3", "4", "2");
  await authenticated(context, "/api/auth/logout", {});

  await teacherLogin(context, teachers[0]);
  await openPlan(page, "/teacher/quran-reader/1");
  await expect(page.getByTestId("text-personal-plan-start")).toContainText("الآية 1");
  await expect(page.getByTestId("button-resume-personal-session")).toBeVisible();
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, body: "{}" }));
  await page.reload();
  await expect(page.getByTestId("quran-personal-plan-panel")).toHaveCount(0);
  await expect(page.getByTestId("quran-guided-memorization-panel")).toHaveCount(0);
  await expect(page.getByTestId("button-personal-quran-plan")).toHaveCount(0);
  await page.unroute("**/api/auth/me");
  await authenticated(context, "/api/auth/logout", {});

  await studentLogin(context, students[0]);
  await openPlan(page, `/student/quran-wards/${wardId}`);
  await expect(page).toHaveURL(new RegExp(`/student/quran-practice/1\\?personalPlan=1`));
  await expect(page.getByTestId("form-personal-plan")).toBeVisible();
  await expect(page.getByText("مهمة حفظ: الآيات 5 إلى 7")).toHaveCount(0);
  await savePlan(page, "1", "2", "1");
  await page.getByTestId("button-start-next-personal-ayah").click();
  await expect(page.getByTestId("quran-guided-memorization-panel")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("startAyah")).toBe(false);
  expect(new URL(page.url()).searchParams.has("endAyah")).toBe(false);
  await page.getByRole("button", { name: "الانتقال إلى خطوة قيّم" }).click();
  await page.getByRole("button", { name: "أتقنتها" }).click();
  await expect.poll(() => page.evaluate((id) => {
    const saved = localStorage.getItem(`hasaad:quran-personal-plan:v1:student:${id}`);
    return saved ? JSON.parse(saved).assessments["1:1"]?.result : null;
  }, students[0].id)).toBe("mastered");
  await expect(page.getByTestId("text-personal-plan-progress")).toHaveText("1 / 1");
  await page.getByTestId("button-start-next-personal-ayah").click();
  await expect(page.getByTestId("quran-guided-memorization-panel")).toBeVisible();
  const wardState = await pool.query("SELECT status, start_ayah, end_ayah FROM quran_wards WHERE id = $1", [wardId]);
  expect(wardState.rows[0]).toMatchObject({ status: "assigned", start_ayah: 5, end_ayah: 7 });
  const submissions = await pool.query("SELECT COUNT(*)::int AS count FROM quran_submissions WHERE ward_id = $1", [wardId]);
  expect(submissions.rows[0].count).toBe(0);
  await authenticated(context, "/api/student-auth/logout", {});

  await studentLogin(context, students[1]);
  await openPlan(page, "/student/quran-practice/1");
  await expect(page.getByTestId("form-personal-plan")).toBeVisible();
  await expect(page.getByTestId("button-resume-personal-session")).toHaveCount(0);
  await savePlan(page, "3", "4", "2");
  await authenticated(context, "/api/student-auth/logout", {});

  await studentLogin(context, students[0]);
  await openPlan(page, "/student/quran-practice/1");
  await expect(page.getByTestId("text-personal-plan-start")).toContainText("الآية 1");
  await expect(page.getByTestId("button-resume-personal-session")).toBeVisible();
  await page.route("**/api/student-auth/me", route => route.fulfill({ status: 401, body: "{}" }));
  await page.reload();
  await expect(page.getByTestId("quran-personal-plan-panel")).toHaveCount(0);
  await expect(page.getByTestId("quran-guided-memorization-panel")).toHaveCount(0);
  await expect(page.getByTestId("button-personal-quran-plan")).toHaveCount(0);
});