import { expect, test } from "@playwright/test";
import {
  db,
  pool,
  soloChallengesTable,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

type DistributionFixture = {
  teacher: TestTeacher;
  challengeSlug: string;
};

let fixture: DistributionFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-distribution-${suffix}@example.com`;
  const otp = "995000";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Distribution ${suffix}`,
      email,
      passwordHash: "e2e-distribution-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create distribution teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(
        `Could not verify distribution teacher: ${response.status()} ${await response.text()}`,
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

async function seedFixture(baseURL: string): Promise<DistributionFixture> {
  const teacher = await createVerifiedTeacher(baseURL);
  const suffix = uniqueSuffix();
  const challengeSlug = `e2e-distribution-${suffix}`;
  const [challenge] = await db.insert(soloChallengesTable).values({
    slug: challengeSlug,
    shortSlug: `dist-${suffix}`,
    assignmentId: null,
    teacherId: teacher.id,
    assignmentTitle: `مسابقة قديمة للتوزيع ${suffix}`,
    questions: Array.from({ length: 6 }, (_, index) => ({
      text: `سؤال المسابقة القديمة ${index + 1} ${suffix}`,
      questionType: "mcq",
      optionA: "إجابة صحيحة",
      optionB: "إجابة بديلة",
      optionC: "إجابة ثالثة",
      optionD: "إجابة رابعة",
      correctAnswer: "A",
      difficulty: (index % 3) + 1,
    })),
    timePerQuestion: 20,
    questionsPerParticipant: 3,
    leaderboardDisplay: "top20",
    maxAttempts: 1,
  }).returning({ slug: soloChallengesTable.slug });
  if (!challenge) throw new Error("Could not create distribution challenge fixture");

  return { teacher, challengeSlug };
}

async function expectControlsFitMobile(page: import("@playwright/test").Page): Promise<void> {
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.width).toBeLessThanOrEqual(430);
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);

  for (const mode of ["all", "random", "difficulty"]) {
    const box = await page.getByTestId(`selection-mode-${mode}`).boundingBox();
    expect(box, `${mode} mode should have a rendered box`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  }
}

test.describe("solo challenge distribution on mobile", () => {
  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Distribution E2E fixtures require the isolated TEST_DATABASE_URL");
    }
    fixture = await seedFixture(baseURL);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    if (!fixture || !baseURL) throw new Error("Distribution fixture is unavailable");
    await attachSession(context, baseURL, fixture.teacher);
  });

  test.afterAll(async () => {
    if (fixture) {
      await pool.query("DELETE FROM teachers WHERE id = $1", [fixture.teacher.id]);
    }
    await pool.end();
  });

  test("keeps all creation modes and distribution controls visible on a phone", async ({
    page,
  }) => {
    if (!fixture) throw new Error("Distribution fixture is unavailable");

    await page.goto("/teacher/solo-challenges/new?source=manual");
    await page.getByText("أضف سؤالك الأول", { exact: true }).click();
    await page.getByLabel("نص السؤال 1").fill("سؤال اختبار توزيع الهاتف");
    await page.getByRole("textbox", { name: "الخيار أ", exact: true }).fill("الإجابة الأولى");
    await page.getByRole("textbox", { name: "الخيار ب", exact: true }).fill("الإجابة الثانية");
    await page.getByRole("textbox", { name: "الخيار ج", exact: true }).fill("الإجابة الثالثة");
    await page.getByRole("textbox", { name: "الخيار د", exact: true }).fill("الإجابة الرابعة");
    await page.getByRole("button", { name: "حفظ السؤال 1", exact: true }).click();

    await page.getByRole("button", { name: "إعدادات إضافية", exact: true }).click();
    await expect(page.getByTestId("selection-mode-all")).toBeVisible();
    await expect(page.getByTestId("selection-mode-random")).toBeVisible();
    await expect(page.getByTestId("selection-mode-difficulty")).toBeVisible();
    await expectControlsFitMobile(page);

    await page.getByTestId("selection-mode-difficulty").click();
    for (const level of ["easy", "medium", "hard"]) {
      await expect(page.getByTestId(`difficulty-row-${level}`)).toBeVisible();
    }
    await expect(page.getByTestId("difficulty-total")).toContainText("1");
    await expect(page.getByTestId("difficulty-classification-hint")).toContainText(
      "صنّف أسئلة البنك أولاً",
    );
    await expectControlsFitMobile(page);
  });

  test("switches an existing challenge back to random without sending both modes", async ({
    page,
  }) => {
    if (!fixture) throw new Error("Distribution fixture is unavailable");

    await page.goto(`/teacher/solo-challenges/${fixture.challengeSlug}`);
    await expect(page.getByTestId("tab-settings")).toBeVisible();
    await page.getByTestId("tab-settings").click();

    await expect(page.getByTestId("selection-mode-all")).toBeVisible();
    await expect(page.getByTestId("selection-mode-random")).toBeVisible();
    await expect(page.getByTestId("selection-mode-difficulty")).toBeVisible();
    await expectControlsFitMobile(page);

    await page.getByTestId("selection-mode-difficulty").click();
    await expect(page.getByTestId("difficulty-row-easy")).toBeVisible();
    await expect(page.getByTestId("difficulty-total")).toContainText("6");

    await page.getByTestId("selection-mode-random").click();
    await expect(page.getByTestId("difficulty-row-easy")).toBeHidden();
    await expect(page.getByTestId("selection-mode-random")).toHaveClass(/bg-primary/);

    const saveRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes(`/api/solo-challenges/${fixture!.challengeSlug}/settings`) &&
        request.method() === "PATCH",
    );
    await page.getByTestId("button-save-all").click();
    const saveRequest = await saveRequestPromise;
    expect(saveRequest.postDataJSON()).toMatchObject({
      questionsPerParticipant: 3,
      difficultyDistribution: null,
    });

    const saved = await page.evaluate(async (slug) => {
      const response = await fetch(`/api/solo-challenges/${slug}/teacher`, {
        credentials: "include",
      });
      return response.json();
    }, fixture.challengeSlug);
    expect(saved.questionsPerParticipant).toBe(3);
    expect(saved.difficultyDistribution).toBeNull();
  });
});