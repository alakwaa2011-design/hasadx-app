import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const assignmentId = 1502;
const title = "واجب الألعاب المباشرة";
const questions = [
  {
    id: 1,
    text: "السؤال الأول",
    questionType: "mcq",
    type: "mcq",
    optionA: "الإجابة الصحيحة",
    optionB: "إجابة أخرى",
    options: ["الإجابة الصحيحة", "إجابة أخرى"],
    correctAnswer: "A",
    correct: 0,
  },
  {
    id: 2,
    text: "السؤال الثاني",
    questionType: "mcq",
    type: "mcq",
    optionA: "إجابة أخرى",
    optionB: "الإجابة الصحيحة",
    options: ["إجابة أخرى", "الإجابة الصحيحة"],
    correctAnswer: "B",
    correct: 1,
  },
  {
    id: 3,
    text: "السؤال الثالث",
    questionType: "true_false",
    type: "true_false",
    optionA: "صح",
    optionB: "خطأ",
    options: ["صح", "خطأ"],
    correctAnswer: "صح",
    correct: 0,
  },
  {
    id: 4,
    text: "السؤال الرابع",
    questionType: "mcq",
    type: "mcq",
    optionA: "الإجابة الصحيحة",
    optionB: "إجابة أخرى",
    options: ["الإجابة الصحيحة", "إجابة أخرى"],
    correctAnswer: "A",
    correct: 0,
  },
  {
    id: 5,
    text: "السؤال الخامس",
    questionType: "mcq",
    type: "mcq",
    optionA: "الإجابة الصحيحة",
    optionB: "إجابة أخرى",
    options: ["الإجابة الصحيحة", "إجابة أخرى"],
    correctAnswer: "A",
    correct: 0,
  },
];

async function mockTeacherAssignment(page: Page) {
  await page.addInitScript(() => localStorage.setItem("hw_lang", "ar"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 77, teacherId: 77, name: "معلم الاختبار" }),
    }),
  );
  await page.route("**/api/assignments?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: assignmentId, title, questionCount: questions.length, isOwn: true, isShared: false },
      ]),
    }),
  );
  await page.route(`**/api/assignments/${assignmentId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: assignmentId, title, questions }),
    }),
  );
}

const importedGames = [
  {
    name: "شد الحبل",
    route: "/game/tug/create",
    count: "5 سؤال",
    setup: "إعدادات اللعبة",
  },
  {
    name: "غرفة الهروب",
    route: "/game/escape/create",
    count: "5 أسئلة",
    setup: "إعدادات غرفة الهروب",
  },
  {
    name: "سباق الصواريخ",
    route: "/game/rocket/create",
    count: "5 أسئلة من الواجب",
    setup: "إعدادات السباق",
  },
  {
    name: "عجلة الحظ",
    route: "/game/wheel/create",
    count: "5 سؤال من الواجب",
    setup: "الإعداد والبدء",
  },
  {
    name: "الكرسي الساخن",
    route: "/game/hotseat/create",
    count: "5 سؤال محمّل",
    setup: "مصدر أسئلة الجلسة",
  },
] as const;

test.describe("assignment links for live games launched from My Activities", () => {
  test.beforeEach(async ({ page }) => {
    await mockTeacherAssignment(page);
  });

  for (const game of importedGames) {
    test(`${game.name} keeps the assignment and reaches setup`, async ({ page }) => {
      await page.goto(`${game.route}?assignmentId=${assignmentId}`);

      await expect(page).toHaveURL(
        new RegExp(`${game.route.replaceAll("/", "\\/")}\\?assignmentId=${assignmentId}$`),
      );
      const visibleTitle = page.getByText(title, { exact: false });
      const titleInput = page.locator(`input[value="${title}"]`);
      await expect(visibleTitle.or(titleInput).first()).toBeVisible();
      await expect(page.getByText(game.count, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(game.setup, { exact: false }).first()).toBeVisible();
    });
  }

  test("من سيربح المليون keeps the preselected assignment on setup", async ({ page }) => {
    await page.goto(`/game/million?assignmentId=${assignmentId}`);

    await expect(page.getByRole("button", { name: new RegExp(`${title}.*5 س`) })).toBeVisible();
    await expect(page.getByRole("heading", { name: "إعداد اللعبة" })).toBeVisible();
  });

  test("الاختراق keeps the preselected assignment on setup", async ({ page }) => {
    await page.goto(`/game/hack?assignmentId=${assignmentId}`);

    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText("Q:5", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /إعدادات الاختراق/ })).toBeVisible();
  });

  for (const route of importedGames.map((game) => game.route)) {
    test(`${route} without assignmentId remains on source selection`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await expect(page.getByText(/مصدر|الأسئلة|إنشاء/).first()).toBeVisible();
    });
  }
});