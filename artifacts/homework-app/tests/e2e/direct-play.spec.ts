import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import {
  assignmentsTable,
  db,
  directPlayLinksTable,
  pool,
  questionsTable,
  teachersTable,
} from "../../../../lib/db/src/index.ts";

type DirectPlayFixture = {
  teacherId: number;
  classToken: string;
  soloToken: string;
  touchToken: string;
};

let fixture: DirectPlayFixture | undefined;
let cleanupTeacherId: number | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createDirectPlayFixture(): Promise<DirectPlayFixture> {
  const suffix = uniqueSuffix();
  const [teacher] = await db.insert(teachersTable).values({
    name: `E2E Direct Play ${suffix}`,
    email: `e2e-direct-play-${suffix}@example.com`,
    // This account is test data only. It never authenticates, so no usable
    // password or email-verification flow is needed to exercise public links.
    passwordHash: "e2e-direct-play-fixture",
    emailVerified: true,
    verifiedAt: new Date(),
  }).returning({ id: teachersTable.id });
  cleanupTeacherId = teacher.id;

  const [classAssignment] = await db.insert(assignmentsTable).values({
    teacherId: teacher.id,
    title: `E2E Wameeth Class ${suffix}`,
    subject: "اختبار تلقائي",
    submissionMode: "electronic",
    accessMode: "private",
    accessCode: "E2E959",
    isShared: false,
    totalPoints: 2,
  }).returning({ id: assignmentsTable.id });

  await db.insert(questionsTable).values([
    {
      assignmentId: classAssignment.id,
      text: `سؤال وميض الصف الأول ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة صف أولى صحيحة",
      optionB: "إجابة صف أولى خاطئة",
      optionC: "إجابة صف أولى بديلة",
      optionD: "إجابة صف أولى أخيرة",
      correctAnswer: "A",
      points: 1,
    },
    {
      assignmentId: classAssignment.id,
      text: `سؤال وميض الصف الثاني ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة صف ثانية خاطئة",
      optionB: "إجابة صف ثانية صحيحة",
      optionC: "إجابة صف ثانية بديلة",
      optionD: "إجابة صف ثانية أخيرة",
      correctAnswer: "B",
      points: 1,
    },
  ]);

  // A single-question independent activity completes in one server-timed
  // round. The class activity above must retain two questions because its
  // public setup intentionally rejects shorter fixtures.
  const [soloAssignment] = await db.insert(assignmentsTable).values({
    teacherId: teacher.id,
    title: `E2E Wameeth Solo ${suffix}`,
    subject: "اختبار تلقائي",
    submissionMode: "electronic",
    accessMode: "private",
    accessCode: "E2E959",
    isShared: false,
    totalPoints: 1,
  }).returning({ id: assignmentsTable.id });
  await db.insert(questionsTable).values({
    assignmentId: soloAssignment.id,
    text: `سؤال وميض فردي ${suffix}`,
    questionType: "mcq",
    optionA: "إجابة فردية صحيحة",
    optionB: "إجابة فردية خاطئة",
    optionC: "إجابة فردية بديلة",
    optionD: "إجابة فردية أخيرة",
    correctAnswer: "A",
    points: 1,
  });

  const [touchAssignment] = await db.insert(assignmentsTable).values({
    teacherId: teacher.id,
    title: `E2E Wameeth Touch ${suffix}`,
    subject: "اختبار تلقائي",
    submissionMode: "electronic",
    accessMode: "private",
    accessCode: "E2E959",
    isShared: false,
    totalPoints: 3,
  }).returning({ id: assignmentsTable.id });
  await db.insert(questionsTable).values([
    {
      assignmentId: touchAssignment.id,
      text: `سؤال لمس وميض الأول ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة اختبار أساسية",
      optionB: "بديل اختبار",
      correctAnswer: "A",
      points: 1,
    },
    {
      assignmentId: touchAssignment.id,
      text: `سؤال لمس وميض الثاني ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة اختبار أساسية",
      optionB: "بديل اختبار",
      correctAnswer: "A",
      points: 1,
    },
    {
      assignmentId: touchAssignment.id,
      text: `سؤال لمس وميض الثالث ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة اختبار أساسية",
      optionB: "بديل اختبار",
      correctAnswer: "A",
      points: 1,
    },
  ]);

  const classToken = randomBytes(16).toString("hex");
  const soloToken = randomBytes(16).toString("hex");
  const touchToken = randomBytes(16).toString("hex");
  await db.insert(directPlayLinksTable).values([
    {
      token: classToken,
      assignmentId: classAssignment.id,
      teacherId: teacher.id,
      gameType: "wameeth_class",
    },
    {
      token: soloToken,
      assignmentId: soloAssignment.id,
      teacherId: teacher.id,
      gameType: "wameeth",
    },
    {
      token: touchToken,
      assignmentId: touchAssignment.id,
      teacherId: teacher.id,
      gameType: "wameeth",
    },
  ]);

  return {
    teacherId: teacher.id,
    classToken,
    soloToken,
    touchToken,
  };
}

/**
 * Browser regression coverage for public Wameeth links.
 *
 * Email registration now requires an out-of-band OTP, so this test seeds a
 * non-login-capable teacher directly. Deleting that temporary teacher in
 * afterAll cascades to its assignment, questions, and direct_play_links rows.
 */
test.beforeAll(async () => {
  fixture = await createDirectPlayFixture();
});


test.afterAll(async () => {
  try {
    const teacherId = fixture?.teacherId ?? cleanupTeacherId;
    if (teacherId) {
      await pool.query("DELETE FROM teachers WHERE id = $1", [teacherId]);
    }
  } finally {
    await pool.end();
  }
});

test.describe("Public Wameeth direct links", () => {
  // Socket.IO can transiently reconnect through the shared development proxy.
  // A retry keeps that transport noise from masking an otherwise deterministic
  // public-link regression, while a real UI or game-flow failure still fails.
  test.describe.configure({ retries: 2 });

  test("class link loads both team screens and exposes a copy-link action", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!fixture || !baseURL) throw new Error("direct-play fixture is unavailable");

    const origin = new URL(baseURL).origin;
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    await page.goto(`/game/wameeth/class?token=${fixture.classToken}`);

    // The public setup has two independently named team screens before the
    // host starts the round; no authenticated teacher session is attached.
    await expect(page.getByText("الفريق الأيسر", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("الفريق الأيمن", { exact: true })).toBeVisible();

    const copyButton = page.getByTestId("button-copy-wameeth-class-link");
    await expect(copyButton).toBeVisible();

    // Start the round to prove the two side-by-side player panels mount. The
    // setup overlay intentionally blocks the control bar until this action.
    await page.getByRole("button", { name: "ابدأ اللعبة", exact: true }).click();
    await expect(page.getByText("الفريق الأزرق", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("الفريق الأحمر", { exact: true })).toBeVisible();
    await copyButton.click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()))
      .toContain(`/game/wameeth/class?token=${fixture.classToken}`);
  });

  test("independent link starts itself and shows only personal score and result", async ({
    page,
  }) => {
    if (!fixture) throw new Error("direct-play fixture is unavailable");

    await page.goto(`/play/${fixture.soloToken}`);

    // The landing route must create a session automatically, then open the
    // game without asking for a visitor name or a PIN.
    await expect(page).toHaveURL(
      new RegExp(`/game/play/[^?]+\\?.*independent=1.*token=${fixture.soloToken}`),
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("text-independent-live-score")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("اكتب اسمك للبدء", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/كود اللعبة|PIN/i)).toHaveCount(0);

    await expect(page.getByText(/سؤال وميض فردي/, { exact: false })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button").filter({ hasText: "إجابة فردية صحيحة" }).click();

    await expect(page.getByTestId("text-independent-result-title")).toBeVisible({ timeout: 30_000 });
    // This regression owns the independent presentation. Correct-answer
    // mapping is validated separately, so here we only require a personal,
    // numeric score and a result count for this one-question activity.
    await expect(page.getByTestId("text-independent-score")).toHaveText(/^\d[\d,]*$/);
    await expect(page.getByTestId("text-independent-correct-count")).toHaveText(/^\d+\/1$/);
    await expect(page.getByTestId("button-copy-independent-link-results")).toBeVisible();

    // The independent result is deliberately personal: no shared ranking,
    // lobby/PIN prompt, or player list may leak back into this route.
    await expect(page.getByText(/ترتيب المشاركين|Final Rankings/i)).toHaveCount(0);
    await expect(page.getByText(/انتظار المعلم|Waiting for teacher/i)).toHaveCount(0);
    await expect(page.getByText(/كود اللعبة|PIN/i)).toHaveCount(0);
  });

  test("independent answers commit only after a completed activation", async ({
    page,
  }) => {
    if (!fixture) throw new Error("direct-play fixture is unavailable");

    let submittedAnswers = 0;
    page.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => {
        if (
          typeof payload === "string" &&
          payload.includes("student:submit-answer")
        ) {
          submittedAnswers += 1;
        }
      });
    });

    await page.goto(`/play/${fixture.touchToken}`);
    const primaryAnswer = page.getByRole("button", { name: /إجابة اختبار أساسية/ });
    await expect(primaryAnswer).toBeVisible({ timeout: 20_000 });

    const firstAnswer = primaryAnswer;
    const box = await firstAnswer.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    const endX = Math.max(1, box!.x - 20);
    const endY = Math.max(1, box!.y - 20);
    await firstAnswer.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: startX,
      clientY: startY,
      buttons: 1,
    });
    await firstAnswer.dispatchEvent("pointermove", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: endX,
      clientY: endY,
      buttons: 1,
    });
    await firstAnswer.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: endX,
      clientY: endY,
      buttons: 0,
    });
    // Safari emits a compatibility click after a touch sequence. It must not
    // turn a cancelled drag into an answer.
    await firstAnswer.dispatchEvent("click", { detail: 1 });

    await page.waitForTimeout(300);
    expect(submittedAnswers).toBe(0);
    await expect(primaryAnswer).toBeEnabled();

    await firstAnswer.dispatchEvent("pointerdown", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: startX,
      clientY: startY,
      buttons: 1,
    });
    await firstAnswer.dispatchEvent("pointercancel", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: startX,
      clientY: startY,
      buttons: 0,
    });
    // iOS Safari may still emit a compatibility click after the system
    // interrupts a touch. A cancelled pointer must never submit an answer.
    await firstAnswer.dispatchEvent("click", { detail: 1 });

    await page.waitForTimeout(300);
    expect(submittedAnswers).toBe(0);
    await expect(primaryAnswer).toBeEnabled();

    await firstAnswer.dispatchEvent("pointerdown", {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: startX,
      clientY: startY,
      buttons: 1,
    });
    await firstAnswer.dispatchEvent("pointerup", {
      pointerId: 3,
      pointerType: "touch",
      isPrimary: true,
      clientX: startX,
      clientY: startY,
      buttons: 0,
    });
    await firstAnswer.dispatchEvent("click", { detail: 1 });
    await expect.poll(() => submittedAnswers).toBe(1);
    await expect(primaryAnswer).toBeEnabled({ timeout: 15_000 });

    await primaryAnswer.click();
    await expect.poll(() => submittedAnswers).toBe(2);
    await expect(primaryAnswer).toBeEnabled({ timeout: 15_000 });

    await primaryAnswer.focus();
    await primaryAnswer.press("Enter");
    await expect.poll(() => submittedAnswers).toBe(3);
    await expect(page.getByTestId("text-independent-result-title"))
      .toBeVisible({ timeout: 30_000 });
    expect(submittedAnswers).toBe(3);
  });
});