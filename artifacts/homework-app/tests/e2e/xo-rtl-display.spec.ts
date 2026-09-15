import { test, expect, type Locator, type Page } from "@playwright/test";

const CLASS_SETUP = Buffer.from(
  encodeURIComponent(JSON.stringify({
    questions: [
      { text: "سؤال X O الأول", options: ["صحيح", "خطأ"], correct: 0 },
      { text: "سؤال X O الثاني", options: ["صحيح", "خطأ"], correct: 1 },
    ],
    duration: 20,
    teamX: "فريق X",
    teamO: "فريق O",
    title: "إكس أو الصف",
  })),
).toString("base64");

async function expectIsolatedXo(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const metrics = await locator.evaluate((element) => {
    const text = element.textContent ?? "";
    const makeRange = (needle: string) => {
      const start = text.indexOf(needle);
      if (start < 0) return null;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let node: Node | null = walker.nextNode();
      while (node) {
        const length = node.textContent?.length ?? 0;
        if (start >= offset && start < offset + length) {
          const range = document.createRange();
          range.setStart(node, start - offset);
          range.setEnd(node, start - offset + 1);
          const rect = range.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }
        offset += length;
        node = walker.nextNode();
      }
      return null;
    };
    const x = makeRange("X");
    const o = makeRange("O");
    const style = getComputedStyle(element);
    return {
      x,
      o,
      direction: style.direction,
      unicodeBidi: style.unicodeBidi,
    };
  });

  expect(metrics.direction).toBe("ltr");
  expect(metrics.unicodeBidi).toContain("isolate");
  expect(metrics.x).not.toBeNull();
  expect(metrics.o).not.toBeNull();
  expect(metrics.x!.left).toBeLessThan(metrics.o!.left);
}

async function expectArabicPage(page: Page): Promise<void> {
  await expect(page.locator('main[dir="rtl"]').first()).toBeVisible();
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const documentSize = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(documentSize.width).toBeLessThanOrEqual(viewport.width);
  expect(documentSize.height).toBeGreaterThan(0);
}

async function expectVisibleXoTitle(page: Page): Promise<void> {
  const title = page.locator('[dir="ltr"]').filter({ hasText: "X O" }).first();
  await expectIsolatedXo(title);
}

test.describe("X O order stays visual in Arabic RTL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hw_lang", "ar"));
  });

  test("keeps X then O in the create screen on mobile and desktop", async ({ page }) => {
    await page.goto("/game/xo/create");
    await expectArabicPage(page);
    await expectVisibleXoTitle(page);
  });

  test("keeps X then O in the join screen", async ({ page }) => {
    await page.goto("/game/xo/join");
    await expectArabicPage(page);
    await expectVisibleXoTitle(page);
  });

  test("keeps the classroom title and team markers isolated", async ({ page }) => {
    await page.goto(`/game/xo/class#setup=${CLASS_SETUP}`);
    await expectArabicPage(page);
    await expectVisibleXoTitle(page);

    const teamX = page.locator('[dir="ltr"]').filter({ hasText: "X" }).filter({ hasText: /^X$/ }).first();
    const teamO = page.locator('[dir="ltr"]').filter({ hasText: "O" }).filter({ hasText: /^O$/ }).first();
    await expect(teamX).toBeVisible();
    await expect(teamO).toBeVisible();
    await expect(teamX).toHaveCSS("direction", "ltr");
    await expect(teamO).toHaveCSS("direction", "ltr");
  });

  test("keeps the direct-play screen RTL while isolating its game title", async ({ page }) => {
    await page.goto("/game/xo/play/rtl-direct-pin?creator=1");
    await expectArabicPage(page);
    await expectVisibleXoTitle(page);
  });
});