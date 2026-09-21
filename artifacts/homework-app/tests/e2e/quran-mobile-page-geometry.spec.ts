import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

const FIXED_PAGE = 3;

async function expectHorizontallyInsideViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible();
  const [box, viewport] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
  ]);

  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
}

test.describe("public Quran mobile page geometry", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the final Mushaf line above the audio player and action cards on screen", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hw_lang", "ar");
      localStorage.removeItem("quran-reader-tips-seen-v1");
    });
    await page.goto(`/quran/2?page=${FIXED_PAGE}&view=pages`);

    await expect(page.getByTestId("select-mobile-page")).toHaveValue(String(FIXED_PAGE));
    const readerTips = page.getByTestId("quran-reader-tips");
    await expect(readerTips).toBeVisible();
    await page.getByTestId("button-mobile-page-layout").click();
    await expect(page.getByTestId("button-mobile-page-layout")).toHaveAttribute(
      "aria-label",
      "عرض صفحة واحدة",
    );

    const mushafPage = page.locator(
      `[data-testid="quran-mushaf-page"][data-page-number="${FIXED_PAGE}"]`,
    );
    await expect(mushafPage).toBeVisible();
    await mushafPage.scrollIntoViewIfNeeded();
    await expect(mushafPage.locator(".quran-madani-line")).toHaveCount(15);
    await page.evaluate(() => document.fonts.ready);

    await page.getByTestId("button-mobile-audio").click();
    const audioDock = page.getByTestId("quran-bottom-dock");
    await expect(audioDock).toBeVisible();
    await mushafPage.scrollIntoViewIfNeeded();

    const geometry = await mushafPage.evaluate((pageElement) => {
      const paper = pageElement.querySelector<HTMLElement>(".quran-madani-page");
      const lines = [...pageElement.querySelectorAll<HTMLElement>(".quran-madani-line")];
      const dock = document.querySelector<HTMLElement>('[data-testid="quran-bottom-dock"]');
      if (!paper || lines.length === 0 || !dock) return null;

      const paperRect = paper.getBoundingClientRect();
      const lastLineRect = lines.at(-1)!.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      return {
        paperBottom: paperRect.bottom,
        lastLineBottom: lastLineRect.bottom,
        dockTop: dockRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    if (geometry) {
      expect(geometry.lastLineBottom).toBeLessThanOrEqual(geometry.paperBottom + 0.5);
      expect(geometry.lastLineBottom).toBeLessThanOrEqual(geometry.dockTop);
    }

    await page.getByTestId("button-close-player").click();

    const word = mushafPage.locator('[data-quran-tour="word"]').first();
    await word.evaluate((element: HTMLButtonElement) => element.click());
    await expectHorizontallyInsideViewport(page.getByTestId("quran-word-action-popover"), page);
    await expect(readerTips).toBeHidden();
    await page.getByTestId("word-action-meaning").click();
    await expect(page.getByTestId("quran-word-action-popover")).toBeHidden();

    const ayahMarker = mushafPage.locator('[data-quran-tour="ayah-action"]').first();
    const markerCenter = await ayahMarker.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    });
    await ayahMarker.dispatchEvent("pointerdown", {
      ...markerCenter,
      button: 0,
      pointerType: "mouse",
    });
    await page.waitForTimeout(650);
    await ayahMarker.dispatchEvent("pointerup", {
      ...markerCenter,
      button: 0,
      pointerType: "mouse",
    });
    await expectHorizontallyInsideViewport(page.getByTestId("ayah-action-popover"), page);
    await expect(readerTips).toBeHidden();
    await page.getByTestId("action-copy").click();
    await page.getByTestId("action-copy-current").click();
    await expect(page.getByTestId("ayah-action-popover")).toBeHidden();
    await expect(readerTips).toBeVisible();
  });
});
