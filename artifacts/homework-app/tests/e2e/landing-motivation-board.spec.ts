import { expect, test } from "@playwright/test";

test("keeps the motivation board complete and correctly ordered", async ({ page }) => {
  await page.goto("/");

  const motivation = page.locator("#motivation");
  const reports = page
    .getByRole("heading", { name: /قِس الأداء بلمحة بصر|Measure performance at a glance/i })
    .locator("xpath=ancestor::section[1]");
  const joinGame = page
    .getByRole("heading", { name: /لديك رمز نشاط؟|Have an activity code?/i })
    .locator("xpath=ancestor::section[1]");
  const image = page.getByTestId("img-motivation-board");

  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("alt", /لوحة التحفيز الأصلية|original motivation board/i);

  const geometry = await image.evaluate((element: HTMLImageElement) => {
    const style = getComputedStyle(element);
    return {
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      renderedWidth: element.getBoundingClientRect().width,
      renderedHeight: element.getBoundingClientRect().height,
      objectFit: style.objectFit,
    };
  });

  expect(geometry.complete).toBe(true);
  expect(geometry.naturalWidth).toBeGreaterThan(0);
  expect(geometry.naturalHeight).toBeGreaterThan(0);
  expect(geometry.renderedWidth).toBeGreaterThan(0);
  expect(geometry.renderedHeight).toBeGreaterThan(0);
  expect(geometry.objectFit).toBe("contain");
  expect(geometry.renderedWidth / geometry.renderedHeight).toBeCloseTo(
    geometry.naturalWidth / geometry.naturalHeight,
    2,
  );

  const [reportsBox, motivationBox, joinGameBox] = await Promise.all([
    reports.boundingBox(),
    motivation.boundingBox(),
    joinGame.boundingBox(),
  ]);

  expect(reportsBox).not.toBeNull();
  expect(motivationBox).not.toBeNull();
  expect(joinGameBox).not.toBeNull();
  expect(reportsBox!.y + reportsBox!.height).toBeLessThanOrEqual(motivationBox!.y + 1);
  expect(motivationBox!.y + motivationBox!.height).toBeLessThanOrEqual(joinGameBox!.y + 1);
});