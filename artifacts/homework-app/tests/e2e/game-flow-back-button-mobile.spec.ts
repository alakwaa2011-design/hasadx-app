import { test, expect, type Page } from "@playwright/test";

const BACK_BUTTON_NAME = /الرجوع خطوة|Go back one step/;

async function expectMobileBackButton(page: Page) {
  const backButton = page.getByRole("button", { name: BACK_BUTTON_NAME }).first();
  await expect(backButton).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(viewport.width).toBeLessThanOrEqual(390);

  const geometry = await backButton.boundingBox();
  expect(geometry).not.toBeNull();
  expect(geometry!.x).toBeGreaterThanOrEqual(0);
  expect(geometry!.y).toBeGreaterThanOrEqual(0);
  expect(geometry!.x + geometry!.width).toBeLessThanOrEqual(viewport.width);
  expect(geometry!.y + geometry!.height).toBeLessThanOrEqual(viewport.height);
  expect(geometry!.width).toBeGreaterThanOrEqual(40);
  expect(geometry!.height).toBeGreaterThanOrEqual(40);

  const horizontalOverflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(horizontalOverflow.documentWidth).toBeLessThanOrEqual(horizontalOverflow.viewportWidth);
  expect(horizontalOverflow.bodyWidth).toBeLessThanOrEqual(horizontalOverflow.viewportWidth);

  return backButton;
}

test.describe("game setup back button on small mobile screens", () => {
  for (const route of ["/game/color", "/game/escape/create", "/game/secret"]) {
    test(`stays visible and returns home from the first step on ${route}`, async ({ page }) => {
      await page.goto(route);
      const backButton = await expectMobileBackButton(page);

      await backButton.click();
      await expect(page).toHaveURL(/\/$/);
    });
  }

  test("returns to the previous setup step before home in Capitals", async ({ page }) => {
    await page.goto("/game/capitals");
    const firstStepBack = await expectMobileBackButton(page);

    await page.getByRole("button", { name: /لعب فردي|Solo play/ }).click();
    await expect(page.getByText(/اختر المستوى|Choose level/)).toBeVisible();

    const settingsStepBack = await expectMobileBackButton(page);
    await settingsStepBack.click();
    await expect(page.getByRole("button", { name: /لعب فردي|Solo play/ })).toBeVisible();

    await firstStepBack.click();
    await expect(page).toHaveURL(/\/$/);
  });
});