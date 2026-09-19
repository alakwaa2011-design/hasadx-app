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

async function swipePointForPage(pageFigure: Locator, direction: "right" | "left"): Promise<Point> {
  await expect(pageFigure).toBeVisible();
  await expect.poll(
    async () => pageFigure.locator("button, img").count(),
    { timeout: 20_000 },
  ).toBeGreaterThan(0);
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
  if (points.length > 0) {
    return points.reduce((chosen, point) => {
      if (direction === "right") return point.x < chosen.x ? point : chosen;
      return point.x > chosen.x ? point : chosen;
    });
  }

  const box = await pageFigure.boundingBox();
  if (!box) throw new Error("Could not measure the Quran page touch target");
  return {
    x: Math.round(box.x + box.width * (direction === "right" ? 0.25 : 0.75)),
    y: Math.round(box.y + Math.min(box.height * 0.45, box.height - 12)),
  };
}

async function swipe(page: Page, start: Point, end: Point, browserName: string): Promise<void> {
  if (browserName === "webkit") {
    await page.evaluate(({ start, end }) => {
      const target = document.elementFromPoint(start.x, start.y);
      if (!target) throw new Error("Could not find the WebKit touch target");

      const dispatchTouch = (
        type: "touchstart" | "touchmove" | "touchend",
        point: Point,
      ): boolean => {
        const touch = {
          identifier: 1,
          target,
          clientX: point.x,
          clientY: point.y,
          screenX: point.x,
          screenY: point.y,
          pageX: point.x + window.scrollX,
          pageY: point.y + window.scrollY,
          radiusX: 4,
          radiusY: 4,
          rotationAngle: 0,
          force: 1,
        };
        const event = new Event(type, {
          bubbles: true,
          cancelable: type !== "touchend",
        });
        Object.defineProperties(event, {
          touches: { value: type === "touchend" ? [] : [touch] },
          targetTouches: { value: type === "touchend" ? [] : [touch] },
          changedTouches: { value: [touch] },
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };

      dispatchTouch("touchstart", start);
      dispatchTouch("touchmove", {
        x: Math.round((start.x + end.x) / 2),
        y: Math.round((start.y + end.y) / 2),
      });
      const moveWasCancelled = dispatchTouch("touchmove", end);
      dispatchTouch("touchend", end);
      if (!moveWasCancelled) {
        target.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
        }));
      }
    }, { start, end });
    return;
  }

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

test("keeps Mushaf page swipes correctly directed and isolated from taps", async ({ page, browserName }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hw_lang", "ar");
    const counters = window as Window & {
      quranPageClickCount?: number;
      toolbarClickCount?: number;
    };
    counters.quranPageClickCount = 0;
    counters.toolbarClickCount = 0;
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-quran-page]")) {
        counters.quranPageClickCount! += 1;
      }
      if (event.target.closest(".quran-reader-header")) {
        counters.toolbarClickCount! += 1;
      }
    }, true);
  });

  await page.goto("/quran/1");
  const pageSelect = page.getByTestId("select-mobile-page");
  await expect(pageSelect).toBeVisible();
  await pageSelect.selectOption("300");

  const page300 = page.locator('[data-quran-page="300"]');
  await expect(page300).toBeVisible();
  const rightSwipeStart = await swipePointForPage(page300, "right");
  await swipe(page, rightSwipeStart, { x: rightSwipeStart.x + 120, y: rightSwipeStart.y }, browserName);

  const page301 = page.locator('[data-quran-page="301"]');
  await expect(page301).toBeVisible();
  await expect(page300).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as Window & { quranPageClickCount?: number }
  ).quranPageClickCount)).toBe(0);

  const leftSwipeStart = await swipePointForPage(page301, "left");
  await swipe(page, leftSwipeStart, { x: leftSwipeStart.x - 120, y: leftSwipeStart.y }, browserName);

  await expect(page300).toBeVisible();
  await expect(page301).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as Window & { quranPageClickCount?: number }
  ).quranPageClickCount)).toBe(0);

  const toolbar = page.locator(".quran-reader-header");
  const toolbarStart = await pointInside(toolbar, "left");
  await swipe(page, toolbarStart, { x: toolbarStart.x + 120, y: toolbarStart.y }, browserName);

  await expect(page300).toBeVisible();
  await expect(pageSelect).toHaveValue("300");
  expect(await page.evaluate(() => (
    window as Window & { toolbarClickCount?: number }
  ).toolbarClickCount)).toBe(0);
});