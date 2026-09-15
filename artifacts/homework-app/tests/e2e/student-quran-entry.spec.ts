import { test, expect } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi } from "./helpers";

test.setTimeout(120_000);

type StudentQuranFixture = {
  teacherId: number;
  studentId: number;
  linkedAccountId: number;
  linkedCookieHeader: string;
  unlinkedAccountId: number;
  unlinkedCookieHeader: string;
};

let fixture: StudentQuranFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function registerStudentSession(
  baseURL: string,
  username: string,
  displayName: string,
): Promise<{ accountId: number; cookieHeader: string }> {
  const api = await newApi(baseURL);
  const response = await api.post("/api/student-auth/register", {
    data: {
      username,
      displayName,
      password: "QuranTest123!",
    },
  });
  if (!response.ok()) {
    throw new Error(`Could not create the Quran student fixture: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  const cookieHeader = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value)
    .map((line) => line.split(";")[0])
    .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
  if (!cookieHeader) throw new Error("Student registration did not establish a session");

  return {
    accountId: Number(body.student.id),
    cookieHeader,
  };
}

async function createStudentQuranFixture(baseURL: string): Promise<StudentQuranFixture> {
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Student Quran E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  const suffix = uniqueSuffix();
  const teacherResult = await pool.query(
    `INSERT INTO teachers(name, email, password_hash)
     VALUES ($1, $2, 'e2e-quran-fixture')
     RETURNING id`,
    [`Quran E2E ${suffix}`, `quran-e2e-${suffix}@example.com`],
  );
  const teacherId = Number(teacherResult.rows[0]?.id);
  if (!teacherId) throw new Error("Could not create the Quran teacher fixture");

  const linked = await registerStudentSession(baseURL, `quranlinked${suffix}`, `طالب قرآن مرتبط ${suffix}`);
  const unlinked = await registerStudentSession(baseURL, `quranunlinked${suffix}`, `طالب قرآن غير مرتبط ${suffix}`);

  const studentResult = await pool.query(
    `INSERT INTO students(name, teacher_id, student_account_id, student_class)
     VALUES ($1, $2, $3, 'E2E')
     RETURNING id`,
    [`طالب قرآن مرتبط ${suffix}`, teacherId, linked.accountId],
  );
  const studentId = Number(studentResult.rows[0]?.id);
  if (!studentId) throw new Error("Could not create the linked Quran student fixture");

  return {
    teacherId,
    studentId,
    linkedAccountId: linked.accountId,
    linkedCookieHeader: linked.cookieHeader,
    unlinkedAccountId: unlinked.accountId,
    unlinkedCookieHeader: unlinked.cookieHeader,
  };
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  fixture = await createStudentQuranFixture(baseURL);
});

test.afterAll(async () => {
  if (!fixture) return;

  await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacherId]);
  await pool.query("DELETE FROM student_accounts WHERE id = $1", [fixture.linkedAccountId]);
  await pool.query("DELETE FROM student_accounts WHERE id = $1", [fixture.unlinkedAccountId]);
});

test("shows the Quran entry before and after assignment, but not for an unlinked account", async ({
  page,
  context,
  baseURL,
}) => {
  if (!fixture || !baseURL) throw new Error("Student Quran fixture is unavailable");

  await attachSession(context, baseURL, {
    id: fixture.linkedAccountId,
    email: "",
    password: "",
    cookieHeader: fixture.linkedCookieHeader,
  });

  await page.goto("/student/dashboard");
  await expect(page.getByTestId("card-student-quran-empty")).toBeVisible();
  await expect(page.getByText("لم يُسند لك ورد بعد", { exact: true })).toBeVisible();
  await expect(page.getByTestId("link-quran-journey")).toBeVisible();
  await expect(page.getByTestId("link-quran-journey")).toHaveAttribute(
    "href",
    "/student/quran-journey",
  );

  const wardResult = await pool.query(
    `INSERT INTO quran_wards(
       teacher_id, student_id, mode, surah_number, surah_name,
       start_ayah, end_ayah, assigned_date
     )
     VALUES ($1, $2, 'memorization', 1, 'الفاتحة', 1, 7, CURRENT_DATE)
     RETURNING id`,
    [fixture.teacherId, fixture.studentId],
  );
  const wardId = Number(wardResult.rows[0]?.id);
  if (!wardId) throw new Error("Could not create the Quran ward fixture");

  await page.goto("/student/dashboard");
  await expect(page.getByTestId("card-student-quran-empty")).toHaveCount(0);
  await expect(page.getByTestId(`student-quran-ward-${wardId}`)).toBeVisible();
  await expect(page.getByText("سورة الفاتحة", { exact: true })).toBeVisible();

  await context.clearCookies();
  await attachSession(context, baseURL, {
    id: fixture.unlinkedAccountId,
    email: "",
    password: "",
    cookieHeader: fixture.unlinkedCookieHeader,
  });
  await page.goto("/student/dashboard");
  await expect(page.getByTestId("link-quran-journey")).toHaveCount(0);
  await expect(page.getByTestId("card-student-quran-empty")).toHaveCount(0);
  await expect(page.locator('[aria-labelledby="student-quran-wards"]')).toHaveCount(0);
});