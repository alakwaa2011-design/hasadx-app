import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test.describe("X O assignment deep links", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hw_lang", "ar"));
  });

  test("keeps a delayed assignment attached when the language changes", async ({ page }) => {
    const assignmentId = 1501;
    const title = "واجب X O المرتبط";
    await page.setViewportSize({ width: 1280, height: 800 });
    let releaseAssignmentResponse!: () => void;
    const assignmentResponseReleased = new Promise<void>((resolve) => {
      releaseAssignmentResponse = resolve;
    });
    let markAssignmentRequested!: () => void;
    const assignmentRequested = new Promise<void>((resolve) => {
      markAssignmentRequested = resolve;
    });

    await page.route(`**/api/assignments/${assignmentId}`, async (route) => {
      markAssignmentRequested();
      await assignmentResponseReleased;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: assignmentId,
          title,
          questions: [
            {
              text: "السؤال الأول",
              type: "mcq",
              options: ["الإجابة الصحيحة", "إجابة أخرى"],
              correct: 0,
            },
            {
              text: "السؤال الثاني",
              type: "mcq",
              options: ["إجابة أخرى", "الإجابة الصحيحة"],
              correct: 1,
            },
            {
              text: "السؤال الثالث",
              type: "true_false",
              options: ["صح", "خطأ"],
              correct: 0,
            },
          ],
        }),
      });
    });

    await page.goto(`/game/xo/create?assignmentId=${assignmentId}`);
    await assignmentRequested;
    await expect(page.getByText("جارٍ تحميل أسئلة الواجب…", { exact: true })).toBeVisible();

    await expect(page).toHaveURL(
      new RegExp(`/game/xo/create\\?assignmentId=${assignmentId}$`),
    );
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText("Loading assignment questions…", { exact: true })).toBeVisible();

    releaseAssignmentResponse();

    await expect(page.getByRole("heading", { name: "X O setup" })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText("3 Questions", { exact: true })).toBeVisible();
    await expect(page.getByText("Play mode", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/game/xo/create\\?assignmentId=${assignmentId}$`),
    );
  });

  test("without an assignment stays on question source selection", async ({ page }) => {
    await page.goto("/game/xo/create");

    await expect(page).toHaveURL(/\/game\/xo\/create$/);
    await expect(
      page.getByRole("heading", { name: "إنشاء لعبة X O" }),
    ).toBeVisible();
    await expect(page.getByTestId("button-question-source-editor")).toBeVisible();
    await expect(page.getByText("نمط اللعب", { exact: true })).toHaveCount(0);
  });
});