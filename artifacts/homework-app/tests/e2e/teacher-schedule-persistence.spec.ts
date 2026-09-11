import { expect, test } from "@playwright/test";
import {
  db,
  pool,
  teacherScheduleTable,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

type ScheduleFixture = {
  teacher: TestTeacher;
  otherTeacherId: number;
  lessonTitles: string[];
  breakTitle: string;
  otherBreakTitle: string;
};

let fixture: ScheduleFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(
  baseURL: string,
  label: string,
): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-schedule-${label}-${suffix}@example.com`;
  const otp = "995000";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Schedule ${label} ${suffix}`,
      email,
      passwordHash: "e2e-schedule-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create schedule teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(
        `Could not verify schedule teacher: ${response.status()} ${await response.text()}`,
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
      id: teacher.id,
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
    throw new Error("Schedule E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  const teacher = await createVerifiedTeacher(baseURL, "owner");
  const otherTeacher = await createVerifiedTeacher(baseURL, "other");
  const suffix = uniqueSuffix();
  const lessonTitles = [
    `الحصة الأولى ${suffix}`,
    `الحصة الثانية ${suffix}`,
    `الحصة الثالثة ${suffix}`,
  ];
  const breakTitle = `استراحة محفوظة ${suffix}`;
  const otherBreakTitle = `استراحة معلم آخر ${suffix}`;
  const api = await newApi(baseURL);
  try {
    const entries = [
      {
        kind: "weekly",
        title: lessonTitles[0],
        subject: "رياضيات",
        className: "الرابع",
        dayOfWeek: 1,
        lessonNumber: 1,
        breakAfterLesson: null,
        appointmentDate: null,
        startTime: "08:00",
        endTime: "08:45",
        location: null,
        notes: null,
      },
      {
        kind: "weekly",
        title: lessonTitles[1],
        subject: "علوم",
        className: "الرابع",
        dayOfWeek: 1,
        lessonNumber: 2,
        breakAfterLesson: null,
        appointmentDate: null,
        startTime: "09:00",
        endTime: "09:45",
        location: null,
        notes: null,
      },
      {
        kind: "break",
        title: breakTitle,
        subject: null,
        className: null,
        dayOfWeek: 1,
        lessonNumber: null,
        breakAfterLesson: 2,
        appointmentDate: null,
        startTime: "09:45",
        endTime: "10:00",
        location: null,
        notes: null,
      },
      {
        kind: "weekly",
        title: lessonTitles[2],
        subject: "لغة عربية",
        className: "الرابع",
        dayOfWeek: 1,
        lessonNumber: 3,
        breakAfterLesson: null,
        appointmentDate: null,
        startTime: "10:00",
        endTime: "10:45",
        location: null,
        notes: null,
      },
    ];
    for (const entry of entries) {
      const response = await api.post("/api/teacher/schedule", {
        headers: { Cookie: teacher.cookieHeader },
        data: entry,
      });
      if (!response.ok()) {
        throw new Error(
          `Could not create schedule entry: ${response.status()} ${await response.text()}`,
        );
      }
    }
  } finally {
    await api.dispose();
  }

  await db.insert(teacherScheduleTable).values({
    teacherId: otherTeacher.id,
    kind: "break",
    title: otherBreakTitle,
    dayOfWeek: 1,
    breakAfterLesson: 2,
    startTime: "09:45",
    endTime: "10:00",
  });

  fixture = {
    teacher,
    otherTeacherId: otherTeacher.id,
    lessonTitles,
    breakTitle,
    otherBreakTitle,
  };
});

test.afterAll(async () => {
  try {
    if (fixture) {
      await pool.query("DELETE FROM teachers WHERE id = ANY($1::int[])", [
        [fixture.teacher.id, fixture.otherTeacherId],
      ]);
    }
  } finally {
    await pool.end();
  }
});

test("break remains in the correct day and position after reopening the dashboard", async ({
  page,
  context,
  baseURL,
}) => {
  if (!fixture || !baseURL) throw new Error("Schedule fixture is unavailable");
  await attachSession(context, baseURL, fixture.teacher);

  await page.goto("/teacher");
  await page.getByRole("button", { name: "الأسبوع", exact: true }).click();
  await expect(page.getByText(fixture.breakTitle, { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "الأسبوع", exact: true }).click();
  const schedule = page.getByTestId("teacher-schedule-card");
  await expect(schedule.getByText("الاثنين", { exact: true })).toBeVisible();
  await expect(schedule.getByText(fixture.breakTitle, { exact: true })).toBeVisible();
  await expect(schedule.getByText("بين الثانية والثالثة", { exact: true })).toBeVisible();
  await expect(
    schedule.getByText(fixture.otherBreakTitle, { exact: true }),
  ).toHaveCount(0);

  const mondayRows = schedule.locator(
    '[data-testid^="schedule-entry-"][data-schedule-day="1"]',
  );
  await expect(mondayRows).toHaveCount(4);
  expect(
    await mondayRows.evaluateAll((rows) =>
      rows.map((row) => ({
        kind: row.getAttribute("data-schedule-kind"),
        position: row.getAttribute("data-schedule-position"),
        text: row.textContent,
      })),
    ),
  ).toEqual([
    expect.objectContaining({
      kind: "weekly",
      position: "1",
      text: expect.stringContaining(fixture.lessonTitles[0]),
    }),
    expect.objectContaining({
      kind: "weekly",
      position: "2",
      text: expect.stringContaining(fixture.lessonTitles[1]),
    }),
    expect.objectContaining({
      kind: "break",
      position: "2.5",
      text: expect.stringContaining(fixture.breakTitle),
    }),
    expect.objectContaining({
      kind: "weekly",
      position: "3",
      text: expect.stringContaining(fixture.lessonTitles[2]),
    }),
  ]);
});