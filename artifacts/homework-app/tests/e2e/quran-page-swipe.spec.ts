import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

type Point = { x: number; y: number };

async function pointInside(locator: Locator, preferredX: "left" | "right" | "center"): Promise<Point> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Could not measure the touch target");

  const xRatio = preferredX === "left" ? 0.25 : preferredX === "right" ? 0.75 : 0.5;
  return {
    x: Math.round(box.x + box.width * xRatio),
    y: Math.round(box.y + Math.min(box.height * 0.45, box.height - 12)),
  };
}

async function wordPointForSwipe(pageFigure: Locator, direction: "right" | "left"): Promise<Point> {
  await expect(pageFigure.locator("button").first()).toBeVisible({ timeout: 20_000 });
  const points = await pageFigure.locator("button").evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const box = button.getBoundingClientRect();
        return {
          x: Math.round(box.left + box.width / 2),
          y: Math.round(box.top + box.height / 2),
          visible: box.width > 0 && box.height > 0,
        };
      })
      .filter((point) => point.visible),
  );
  if (points.length === 0) throw new Error("Could not find an interactive Quran word");

  return points.reduce((chosen, point) => {
    if (direction === "right") return point.x < chosen.x ? point : chosen;
    return point.x > chosen.x ? point : chosen;
  });
}

async function swipe(page: Page, start: Point, end: Point): Promise<void> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, radiusX: 4, radiusY: 4, force: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: Math.round((start.x + end.x) / 2),
        y: Math.round((start.y + end.y) / 2),
        radiusX: 4,
        radiusY: 4,
        force: 1,
      }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, radiusX: 4, radiusY: 4, force: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

test("keeps Mushaf page swipes correctly directed and isolated from taps", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hw_lang", "ar");
    (window as Window & { quranPageClickCount?: number }).quranPageClickCount = 0;
    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-quran-page]")) {
        (window as Window & { quranPageClickCount?: number }).quranPageClickCount! += 1;
      }
    }, true);
  });

  await page.goto("/quran/1");
  const pageSelect = page.getByTestId("select-mobile-page");
  await expect(pageSelect).toBeVisible();
  await pageSelect.selectOption("300");

  const page300 = page.locator('[data-quran-page="300"]');
  await expect(page300).toBeVisible();
  const rightSwipeStart = await wordPointForSwipe(page300, "right");
  await swipe(page, rightSwipeStart, { x: rightSwipeStart.x + 120, y: rightSwipeStart.y });

  const page301 = page.locator('[data-quran-page="301"]');
  await expect(page301).toBeVisible();
  await expect(page300).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as Window & { quranPageClickCount?: number }
  ).quranPageClickCount)).toBe(0);

  const leftSwipeStart = await wordPointForSwipe(page301, "left");
  await swipe(page, leftSwipeStart, { x: leftSwipeStart.x - 120, y: leftSwipeStart.y });

  await expect(page300).toBeVisible();
  await expect(page301).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as Window & { quranPageClickCount?: number }
  ).quranPageClickCount)).toBe(0);

  const toolbar = page.locator(".quran-reader-header");
  const toolbarStart = await pointInside(toolbar, "left");
  await swipe(page, toolbarStart, { x: toolbarStart.x + 120, y: toolbarStart.y });

  await expect(page300).toBeVisible();
  await expect(pageSelect).toHaveValue("300");
});