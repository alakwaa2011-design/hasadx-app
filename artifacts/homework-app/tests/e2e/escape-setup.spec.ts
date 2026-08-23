import { test, expect, type Page } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import {
  attachSession,
  newApi,
  type TestTeacher,
} from "./helpers";

test.setTimeout(120_000);

type EscapeFixture = {
  teacher: TestTeacher;
  assignmentTitle: string;
};

type EscapeClassSetup = {
  questions: unknown[];
  totalTime: number;
  lockCount: number;
  hints: number;
  title?: string;
};

let fixture: EscapeFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function seedTeacherAssignment(baseURL: string): Promise<EscapeFixture> {
  const api = await newApi(baseURL);
  try {
    const suffix = uniqueSuffix();
    const email = `e2e-escape-${suffix}@example.com`;
    const otp = "993000";
    const [teacherRow] = await db.insert(teachersTable).values({
      name: `E2E Escape Teacher ${suffix}`,
      email,
      // This account only reaches the verification route, never password
      // login; its hash is deliberately non-usable outside this test database.
      passwordHash: "e2e-escape-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    }).returning({ id: teachersTable.id });
    if (!teacherRow) throw new Error("Could not create the Escape Room teacher fixture");

    // Verify through the real endpoint so the browser receives the same
    // teacher session cookie that the product uses after OTP confirmation.
    const verify = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!verify.ok()) {
      throw new Error(`Could not verify the Escape Room teacher: ${verify.status()} ${await verify.text()}`);
    }
    const setCookie = verify.headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);
    const cookieHeader = setCookie
      .map((line) => line.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");
    const teacher: TestTeacher = {
      id: teacherRow.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };

    const assignmentTitle = `واجب غرفة الهروب ${suffix}`;
    const createAssignment = await api.post("/api/assignments", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: assignmentTitle,
        subject: "اختبار تلقائي",
        submissionMode: "electronic",
        accessMode: "private",
        accessCode: "E2E993",
        isShared: false,
        // Six valid MCQs allow the device-mode assertion to verify a
        // five-lock configuration without the product correctly capping it.
        questions: [1, 2, 3, 4, 5, 6].map((number) => ({
          text: `سؤال غرفة الهروب ${number} ${suffix}`,
          questionType: "mcq",
          optionA: `الإجابة الصحيحة ${number}`,
          optionB: `إجابة خاطئة ب ${number}`,
          optionC: `إجابة خاطئة ج ${number}`,
          optionD: `إجابة خاطئة د ${number}`,
          correctAnswer: "A",
          points: 1,
        })),
      },
    });
    if (!createAssignment.ok()) {
      throw new Error(
        `Could not create the Escape Room assignment fixture: ${createAssignment.status()} ${await createAssignment.text()}`,
      );
    }

    return { teacher, assignmentTitle };
  } finally {
    await api.dispose();
  }
}

async function chooseFixtureAssignment(page: Page, assignmentTitle: string): Promise<void> {
  await page.goto("/game/escape/create");
  await expect(page.getByRole("heading", { name: "أنشئ غرفة الهروب", exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: /^من واجب موجود/ }).click();
  const assignmentButton = page.getByRole("button", { name: new RegExp(assignmentTitle) });
  await expect(assignmentButton).toBeVisible({ timeout: 15_000 });
  await assignmentButton.click();

  // Escape Room deliberately uses this fixed-position card instead of a
  // footer button, so it remains actionable above a long assignment list.
  const continueButton = page.getByRole("button", { name: /^متابعة/ });
  await expect(continueButton).toBeVisible({ timeout: 15_000 });
  const continueCard = continueButton.locator("xpath=../..");
  await expect(continueCard).toBeVisible();
  await expect(continueCard).toHaveCSS("position", "fixed");

  await continueButton.click();
  await expect(page.getByRole("heading", { name: "إعدادات غرفة الهروب", exact: true })).toBeVisible();
}

async function setRoomSettings(
  page: Page,
  { minutes, locks, hints }: { minutes: number; locks: number; hints: number },
): Promise<void> {
  const timeInput = page.getByRole("spinbutton", { name: "زمن الهروب بالدقائق", exact: true });
  await timeInput.fill(String(minutes));
  await timeInput.blur();
  await page.getByRole("combobox", { name: "عدد الأقفال", exact: true }).selectOption(String(locks));
  await page.getByRole("combobox", { name: "مفاتيح المساعدة", exact: true }).selectOption(String(hints));
}

function watchEscapeCreateMessages(page: Page): string[] {
  const messages: string[] = [];
  const capture = (payload: unknown) => {
    const text = typeof payload === "string" ? payload : String(payload ?? "");
    if (text.includes("escape:create")) messages.push(text);
  };

  // Socket.IO can use either polling POST bodies or WebSocket frames depending
  // on the browser/network. Capture both transports, not the mere connection:
  // the app intentionally opens a shared socket before a game is selected.
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/socket.io/")) capture(request.postData());
  });
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => capture(payload));
  });
  return messages;
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  fixture = await seedTeacherAssignment(baseURL);
});

test.beforeEach(async ({ context, baseURL }) => {
  if (!fixture || !baseURL) throw new Error("Escape Room fixture is unavailable");
  await attachSession(context, baseURL, fixture.teacher);
});

test.afterAll(async () => {
  try {
    if (fixture) {
      // The assignment, its questions, and the test-only session cascade with
      // this teacher record in the dedicated E2E database.
      await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacher.id]);
    }
  } finally {
    await pool.end();
  }
});

test.describe("Teacher Escape Room setup from an assignment", () => {
  test("keeps class setup local and creates a device room after changing round settings", async ({ page }) => {
    if (!fixture) throw new Error("Escape Room fixture is unavailable");

    const classEscapeCreateMessages = watchEscapeCreateMessages(page);

    await chooseFixtureAssignment(page, fixture.assignmentTitle);
    await setRoomSettings(page, { minutes: 15, locks: 3, hints: 1 });

    await Promise.all([
      page.waitForURL(/\/game\/escape\/class$/, { timeout: 15_000 }),
      page.getByRole("button", { name: /وضع الصف/ }).click(),
    ]);
    await expect(page.getByText("استعدوا للتحدي", { exact: true })).toBeVisible();

    const classSetup = await page.evaluate(() => {
      const raw = sessionStorage.getItem("escape-class-setup");
      return raw ? JSON.parse(raw) : null;
    }) as EscapeClassSetup | null;
    expect(classSetup).toMatchObject({
      title: fixture.assignmentTitle,
      totalTime: 15 * 60,
      lockCount: 3,
      hints: 1,
    });
    expect(classSetup?.questions).toHaveLength(6);
    // Class mode may reuse the app-wide Socket.IO connection, but it must not
    // emit the event that creates a server-backed device room.
    expect(classEscapeCreateMessages).toEqual([]);

    // Continue as the same teacher from the class run. The game page's shared
    // socket is already authenticated, just as it is in the real teacher flow.
    await chooseFixtureAssignment(page, fixture.assignmentTitle);
    await setRoomSettings(page, { minutes: 8, locks: 5, hints: 3 });

    await page.getByRole("button", { name: /وضع الأجهزة/ }).click();
    await expect(page).toHaveURL(/\/game\/escape\/host\/\d{6}$/, { timeout: 20_000 });
    // The captured Socket.IO packet is the exact configuration stored by the
    // device-room server. Six seeded questions ensure five locks are preserved.
    expect(classEscapeCreateMessages).toHaveLength(1);
    expect(classEscapeCreateMessages[0]).toContain('"totalTime":480');
    expect(classEscapeCreateMessages[0]).toContain('"lockCount":5');
    expect(classEscapeCreateMessages[0]).toContain('"hints":3');

    const pin = new URL(page.url()).pathname.split("/").at(-1);
    expect(pin).toMatch(/^\d{6}$/);
    await expect(page.getByText("رمز الدخول للقبو", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(pin!, { exact: true }).first()).toBeVisible();
    const creatorToken = await page.evaluate((roomPin) =>
      sessionStorage.getItem(`escape-creator-${roomPin}`),
    pin);
    expect(creatorToken).toMatch(/^[a-f0-9]{32}$/);
  });
});