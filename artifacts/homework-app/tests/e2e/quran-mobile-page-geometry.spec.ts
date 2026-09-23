import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

const FIXED_PAGE = 3;

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
] as const;
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
  test("keeps Mushaf rows readable when Memorize me opens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("hw_lang", "ar");
      localStorage.setItem("quran-reader-tips-seen-v1", "true");
    });
    await page.goto("/quran/76?ayah=8&page=579&view=pages");

    const mushafPage = page.locator(
      '[data-testid="quran-mushaf-page"][data-page-number="579"]',
    );
    await expect(mushafPage).toBeVisible();
    await expect(mushafPage.locator(".quran-madani-line")).toHaveCount(15);
    await page.evaluate(() => document.fonts.ready);

    await page.getByTestId("button-mobile-memo-session").click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toBeVisible();

    const rowGeometry = await mushafPage.locator(".quran-madani-line").evaluateAll((rows) =>
      rows.map((row) => {
        const rect = row.getBoundingClientRect();
        const fontSize = Number.parseFloat(getComputedStyle(row).fontSize);
        return { top: rect.top, bottom: rect.bottom, height: rect.height, fontSize };
      }),
    );

    for (let index = 0; index < rowGeometry.length; index += 1) {
      const row = rowGeometry[index];
      expect(row.height).toBeGreaterThanOrEqual(row.fontSize * 0.8);
      if (index > 0) {
        expect(row.top).toBeGreaterThanOrEqual(rowGeometry[index - 1].bottom - 0.5);
      }
    }
  });

  for (const viewport of MOBILE_VIEWPORTS) {
    test(`keeps the final Mushaf line above the audio player without horizontal overflow at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
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
      await expect(mushafPage.locator(".quran-madani-line")).toHaveCount(15);
      await page.evaluate(() => document.fonts.ready);

      const initialGeometry = await page.locator(".quran-reader-main").evaluate((reader) => {
        const paper = reader.querySelector<HTMLElement>(".quran-madani-page");
        if (!paper) return null;
        const readerRect = reader.getBoundingClientRect();
        const paperRect = paper.getBoundingClientRect();
        return {
          readerTop: readerRect.top,
          readerBottom: readerRect.bottom,
          paperTop: paperRect.top,
          paperBottom: paperRect.bottom,
          scrollTop: reader.scrollTop,
        };
      });

      expect(initialGeometry).not.toBeNull();
      if (initialGeometry) {
        expect(initialGeometry.scrollTop).toBe(0);
        expect(initialGeometry.paperTop).toBeGreaterThanOrEqual(initialGeometry.readerTop);
        expect(initialGeometry.paperBottom).toBeLessThanOrEqual(initialGeometry.readerBottom + 0.5);
      }

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

      const horizontalGeometry = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(horizontalGeometry.documentWidth).toBeLessThanOrEqual(
        horizontalGeometry.viewportWidth,
      );

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
  }
});
