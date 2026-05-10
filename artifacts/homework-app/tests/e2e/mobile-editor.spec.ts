import { test, expect } from "@playwright/test";
import {
  attachSession,
  createPresentation,
  newApi,
  registerTeacher,
  type TestPresentation,
  type TestTeacher,
} from "./helpers";

/**
 * Regression coverage for the mobile presentation editor shell.
 *
 * Each spec runs in a 390×844 portrait viewport (configured in
 * `playwright.config.ts`) so the editor mounts the `MobileShell`
 * branch (rendered when `useIsBelowLg()` returns true).
 *
 * Bugs guarded:
 *   • AI outline action in the More sheet must mount the AI builder.
 *   • Go-live action in the More sheet must navigate to /p/control/:id.
 *   • Arabic present mode: tapping the right edge moves backward.
 *   • SlideStage must paint with non-zero width and height (no
 *     letterboxing collapse on portrait viewports).
 */

let teacher: TestTeacher;
let deck: TestPresentation;

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  const api = await newApi(baseURL);
  try {
    teacher = await registerTeacher(api);
    deck = await createPresentation(api, teacher);
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ context, baseURL }) => {
  await attachSession(context, baseURL!, teacher);
});

test.describe("Mobile presentation editor", () => {
  test('opens the "AI outline" dialog from the More sheet', async ({ page }) => {
    await page.goto(`/teacher/presentations/${deck.id}`);
    // Wait for the editor to settle before opening the sheet.
    await expect(page.getByRole("button", { name: /المزيد|More/ })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /المزيد|More/ }).click();

    const aiItem = page.getByRole("button", { name: /اقترح خطة بالذكاء|AI outline/ });
    await expect(aiItem).toBeVisible();
    await aiItem.click();

    // The AI builder mounts as a Radix dialog (role="dialog").
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  });

  test('"Go live" creates a session and navigates to /p/control/:id', async ({ page }) => {
    await page.goto(`/teacher/presentations/${deck.id}`);
    await expect(page.getByRole("button", { name: /المزيد|More/ })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /المزيد|More/ }).click();

    const goLive = page.getByRole("button", { name: /بدء جلسة مباشرة|Go live/ });
    await expect(goLive).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/p\/control\/[\w-]+/, { timeout: 20_000 }),
      goLive.click(),
    ]);

    expect(page.url()).toMatch(/\/p\/control\/[\w-]+/);
  });

  test("Arabic present mode: tapping the right edge moves backward", async ({ page }) => {
    // Start on slide 2 so a "previous" tap can be observed.
    await page.goto(`/teacher/presentations/${deck.id}/present?slide=2`);

    // Wait for the SlideStage to mount before reading tap-zone geometry.
    await expect(page.locator("[data-slide-stage]")).toBeVisible({ timeout: 20_000 });

    // The tap zones use aria-label only (no text content); the control bar
    // uses title attributes. Disambiguate to the aria-label-only buttons.
    const prevBtn = page.locator('button[aria-label="السابق"]:not([title])');
    const nextBtn = page.locator('button[aria-label="التالي"]:not([title])');
    await expect(prevBtn).toBeVisible({ timeout: 20_000 });
    await expect(nextBtn).toBeVisible({ timeout: 20_000 });

    const prevBox = await prevBtn.boundingBox();
    const nextBox = await nextBtn.boundingBox();
    expect(prevBox).not.toBeNull();
    expect(nextBox).not.toBeNull();

    // In RTL, "previous" is anchored to the RIGHT edge and "next" to the LEFT.
    expect(prevBox!.x).toBeGreaterThan(nextBox!.x);

    // Capture the slide counter ("2 / N") then click the previous tap zone.
    const counterLoc = page.locator("text=/^\\s*\\d+\\s*\\/\\s*\\d+\\s*$/").first();
    const counterBefore = (await counterLoc.innerText()).trim();

    await prevBtn.click({ force: true });

    await expect
      .poll(async () => (await counterLoc.innerText()).trim(), { timeout: 10_000 })
      .not.toBe(counterBefore);
  });

  test("SlideStage paints with non-zero size at the portrait viewport", async ({ page }) => {
    await page.goto(`/teacher/presentations/${deck.id}/present?slide=1`);

    const stage = page.locator("[data-slide-stage]").first();
    await expect(stage).toBeVisible({ timeout: 20_000 });

    // Probe the inner letterboxed frame for non-zero size at the portrait
    // viewport. This guards against the regression where the 16:9 slide
    // collapses to ~0 height inside a tall mobile container.
    const size = await page
      .locator("[data-slide-stage-frame]")
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });

    expect(size.width).toBeGreaterThan(200);
    expect(size.height).toBeGreaterThan(100);
  });
});
