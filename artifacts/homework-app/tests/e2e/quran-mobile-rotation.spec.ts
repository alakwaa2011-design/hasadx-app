import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

const LANDSCAPE_SAFE_AREA = { left: 47, right: 0 };
const PORTRAIT_SAFE_AREA_CASES = [
  {
    name: "small iPhone",
    viewport: { width: 320, height: 568 },
    topInset: 20,
    bottomInset: 20,
  },
  {
    name: "tall Android phone",
    viewport: { width: 412, height: 915 },
    topInset: 24,
    bottomInset: 24,
  },
] as const;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-quran-rotation-${suffix}@example.com`;
  const otp = "731946";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Quran Rotation ${suffix}`,
      email,
      passwordHash: "e2e-quran-rotation-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create Quran rotation teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify Quran rotation teacher: ${response.status()} ${await response.text()}`);
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");
    return { id: teacher.id, email, password: "not-used", cookieHeader };
  } finally {
    await api.dispose();
  }
}

async function expectCompletePortraitPage(page: Page) {
  const mushafPage = page.locator("[data-quran-page]").first();
  await expect(mushafPage).toBeVisible();
  await expect(mushafPage.locator(".animate-spin")).toHaveCount(0);

  const geometry = await page.locator(".quran-reader-main").evaluate((main) => {
    const pageElement = main.querySelector<HTMLElement>("[data-quran-page]");
    if (!pageElement) throw new Error("Mushaf page is unavailable");
    main.scrollTop = main.scrollHeight;
    const pageRect = pageElement.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return {
      pageBottom: pageRect.bottom,
      viewportBottom: window.innerHeight,
      scrollBottom: main.scrollTop + main.clientHeight,
      scrollHeight: main.scrollHeight,
      mainBottom: mainRect.bottom,
    };
  });

  expect(geometry.scrollBottom).toBeGreaterThanOrEqual(geometry.scrollHeight - 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.mainBottom + 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1);
}

async function expectDockDoesNotOverlapMushaf(page: Page) {
  const geometry = await page.locator(".quran-reader-root").evaluate((root) => {
    const main = root.querySelector<HTMLElement>(".quran-reader-main");
    const dock = root.querySelector<HTMLElement>(".quran-reader-dock");
    const pageElement = main?.querySelector<HTMLElement>("[data-quran-page='604']");
    const finalLine = pageElement?.querySelector<HTMLElement>(".quran-madani-page-content > :last-child");
    if (!main || !dock || !pageElement) throw new Error("Mushaf dock geometry is unavailable");
    main.scrollTop = main.scrollHeight;
    const mainRect = main.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    const finalLineRect = finalLine?.getBoundingClientRect();
    return {
      mainBottom: mainRect.bottom,
      dockTop: dockRect.top,
      pageBottom: pageRect.bottom,
      finalLineBottom: finalLineRect?.bottom ?? pageRect.bottom,
      pageLeft: pageRect.left,
      pageRight: pageRect.right,
      viewportWidth: window.innerWidth,
      scrollBottom: main.scrollTop + main.clientHeight,
      scrollHeight: main.scrollHeight,
    };
  });

  expect(geometry.scrollBottom).toBeGreaterThanOrEqual(geometry.scrollHeight - 1);
  expect(geometry.pageLeft).toBeLessThanOrEqual(1);
  expect(geometry.pageRight).toBeGreaterThanOrEqual(geometry.viewportWidth - 1);
  expect(geometry.finalLineBottom).toBeLessThanOrEqual(geometry.dockTop + 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.dockTop + 1);
}

async function emulatePortraitSafeArea(page: Page, top: number, bottom: number) {
  await page.addInitScript(({ topInset, bottomInset }) => {
    const installSafeAreaOverride = () => {
      const style = document.createElement("style");
      style.dataset.quranSafeAreaOverride = "true";
      style.textContent = `:root {
        --quran-safe-area-top: ${topInset}px !important;
        --quran-safe-area-bottom: ${bottomInset}px !important;
      }`;
      document.head.append(style);
    };
    if (document.head) installSafeAreaOverride();
    else document.addEventListener("DOMContentLoaded", installSafeAreaOverride, { once: true });
  }, { topInset: top, bottomInset: bottom });
}

async function emulateLandscapeSafeArea(page: Page, left: number, right: number) {
  await page.addInitScript(({ leftInset, rightInset }) => {
    const applyInsets = () => {
      document.documentElement.style.setProperty("--quran-safe-area-left", `${leftInset}px`);
      document.documentElement.style.setProperty("--quran-safe-area-right", `${rightInset}px`);
    };
    if (document.documentElement) applyInsets();
    else document.addEventListener("DOMContentLoaded", applyInsets, { once: true });
  }, { leftInset: left, rightInset: right });
}
async function expectDockRespectsSafeArea(page: Page, bottomInset: number) {
  const geometry = await page.getByTestId("quran-bottom-dock").evaluate((dock) => {
    const rect = dock.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      paddingBottom: Number.parseFloat(getComputedStyle(dock).paddingBottom),
      viewportBottom: window.innerHeight,
    };
  });

  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportBottom + 1);
  expect(geometry.paddingBottom).toBeGreaterThanOrEqual(bottomInset);
}

async function expectGuidedPanelDoesNotOverlapMushaf(page: Page, bottomInset: number) {
  const geometry = await page.locator(".quran-reader-root").evaluate((root) => {
    const main = root.querySelector<HTMLElement>(".quran-reader-main");
    const pageElement = main?.querySelector<HTMLElement>("[data-quran-page='604']");
    const panel = root.querySelector<HTMLElement>("[data-testid='quran-guided-memorization-panel']");
    if (!main || !pageElement || !panel) throw new Error("Guided memorization geometry is unavailable");
    main.scrollTop = main.scrollHeight;
    const pageRect = pageElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelChildren = Array.from(panel.querySelectorAll<HTMLElement>("button, h2, [aria-label]"));
    return {
      pageBottom: pageRect.bottom,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      viewportBottom: window.innerHeight,
      scrollBottom: main.scrollTop + main.clientHeight,
      scrollHeight: main.scrollHeight,
      childrenInsidePanel: panelChildren.every((child) => {
        const rect = child.getBoundingClientRect();
        return rect.top >= panelRect.top - 1 && rect.bottom <= panelRect.bottom + 1;
      }),
    };
  });

  expect(geometry.scrollBottom).toBeGreaterThanOrEqual(geometry.scrollHeight - 1);
  expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.panelTop + 1);
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.viewportBottom - bottomInset + 1);
  expect(geometry.childrenInsidePanel).toBe(true);
}
async function expectFocusedLandscape(
  page: Page,
  expectedUrl: RegExp,
  safeArea = { left: 0, right: 0 },
) {
  await page.setViewportSize(LANDSCAPE);
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.locator(".quran-reader-header")).toBeHidden();
  await expect(page.locator(".quran-reader-nav")).toBeHidden();
  await expect(page.locator(".quran-reader-dock")).toBeHidden();

  const geometry = await page.locator(".quran-page-shell").first().evaluate(
    (shell, insets) => {
      const shellRect = shell.getBoundingClientRect();
      const visiblePages = Array.from(
        shell.querySelectorAll<HTMLElement>(".quran-reader-figure"),
      )
        .map((figure) => {
          const rect = figure.getBoundingClientRect();
          const lines = Array.from(
            figure.querySelectorAll<HTMLElement>(".quran-madani-page-content > div"),
          ).map((line) => line.getBoundingClientRect());
          return {
            rect,
            lineCount: lines.length,
            linesContained: lines.every(
              (line) => line.top >= rect.top - 1 && line.bottom <= rect.bottom + 1,
            ),
            linesDoNotOverlap: lines.every(
              (line, index) => index === 0 || line.top >= lines[index - 1].bottom - 1,
            ),
          };
        })
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
      return {
        top: Math.min(...visiblePages.map(({ rect }) => rect.top)),
        bottom: Math.max(...visiblePages.map(({ rect }) => rect.bottom)),
        leftGap: shellRect.left,
        rightGap: window.innerWidth - shellRect.right,
        safeLeft: insets.left,
        safeRight: window.innerWidth - insets.right,
        viewportHeight: window.innerHeight,
        pageCount: visiblePages.length,
        pagesHaveCanonicalRatio: visiblePages.every(
          ({ rect }) => Math.abs(rect.width / rect.height - 382.677 / 547.086) < 0.005,
        ),
        pagesHaveCompleteRows: visiblePages.every(
          ({ lineCount, linesContained, linesDoNotOverlap }) =>
            lineCount === 15 && linesContained && linesDoNotOverlap,
        ),
      };
    },
    safeArea,
  );
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.bottom - geometry.top).toBeGreaterThanOrEqual(geometry.viewportHeight - 1);
  expect(geometry.pageCount).toBeGreaterThanOrEqual(1);
  expect(geometry.pagesHaveCanonicalRatio).toBe(true);
  expect(geometry.pagesHaveCompleteRows).toBe(true);
  expect(geometry.leftGap).toBeGreaterThanOrEqual(geometry.safeLeft - 1);
  expect(geometry.rightGap).toBeGreaterThanOrEqual(safeArea.right - 1);
  const leftVisibleGap = geometry.leftGap - safeArea.left;
  const rightVisibleGap = geometry.rightGap - safeArea.right;
  expect(Math.abs(leftVisibleGap - rightVisibleGap)).toBeLessThanOrEqual(2);
}

test.describe("mobile Mushaf rotation", () => {
  let teacher: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL
      || process.env.E2E_DATABASE_ISOLATED !== "1"
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Quran rotation E2E requires the isolated TEST_DATABASE_URL");
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quran_reader_positions (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        student_account_id INTEGER REFERENCES student_accounts(id) ON DELETE CASCADE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT quran_reader_positions_exactly_one_owner
          CHECK (num_nonnulls(teacher_id, student_account_id) = 1)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS quran_reader_positions_teacher_uq
        ON quran_reader_positions(teacher_id) WHERE teacher_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS quran_reader_positions_student_account_uq
        ON quran_reader_positions(student_account_id) WHERE student_account_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS quran_bookmarks (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        student_account_id INTEGER REFERENCES student_accounts(id) ON DELETE CASCADE,
        surah_number INTEGER NOT NULL,
        ayah_number INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'stopped_here'
          CHECK (category IN ('stopped_here', 'review', 'similar', 'repeated_mistake', 'ask_teacher')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT quran_bookmarks_exactly_one_owner
          CHECK (num_nonnulls(teacher_id, student_account_id) = 1)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS quran_bookmarks_teacher_verse_uq
        ON quran_bookmarks(teacher_id, surah_number, ayah_number) WHERE teacher_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS quran_bookmarks_student_verse_uq
        ON quran_bookmarks(student_account_id, surah_number, ayah_number) WHERE student_account_id IS NOT NULL;
    `);
    teacher = await createVerifiedTeacher(baseURL);
  });

  test.afterAll(async () => {
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  });

  test("keeps the public Quran complete through portrait and landscape", async ({ page }) => {
    await page.setViewportSize(PORTRAIT);
    await emulateLandscapeSafeArea(
      page,
      LANDSCAPE_SAFE_AREA.left,
      LANDSCAPE_SAFE_AREA.right,
    );
    await page.goto("/quran");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /(?:^|,\s*)viewport-fit=cover(?:,|$)/,
    );
    await expectCompletePortraitPage(page);
    await expectFocusedLandscape(
      page,
      /\/quran(?:\/1)?(?:\?.*)?$/,
      LANDSCAPE_SAFE_AREA,
    );
    await page.setViewportSize(PORTRAIT);
    await expect(page).toHaveURL(/\/quran(?:\/1)?(?:\?.*)?$/);
    await expectCompletePortraitPage(page);
  });

  for (const safeAreaCase of PORTRAIT_SAFE_AREA_CASES) {
    test(`keeps page 604 complete with the player and tafsir open on a ${safeAreaCase.name}`, async ({
      page,
    }) => {
      await page.setViewportSize(safeAreaCase.viewport);
      await emulatePortraitSafeArea(page, safeAreaCase.topInset, safeAreaCase.bottomInset);
      await page.goto("/quran/114?ayah=1&page=604&view=pages");

      const finalPage = page.locator("[data-quran-page='604']");
      await expect(finalPage).toBeVisible();
      await expect(finalPage.locator(".animate-spin")).toHaveCount(0);
      await expect(page.getByTestId("quran-bottom-dock")).toHaveCount(0);

      const closedGeometry = await page.locator(".quran-reader-root").evaluate((root) => {
        const main = root.querySelector<HTMLElement>(".quran-reader-main");
        if (!main) throw new Error("Mushaf viewport is unavailable");
        const rootRect = root.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        return {
          mainBottom: mainRect.bottom,
          rootBottom: rootRect.bottom,
        };
      });
      expect(Math.abs(closedGeometry.rootBottom - closedGeometry.mainBottom)).toBeLessThanOrEqual(1);
      await expectCompletePortraitPage(page);

      await page.getByTestId("button-mobile-audio").click();
      await expect(page.getByTestId("quran-bottom-dock")).toBeVisible();
      await finalPage.locator(".quran-madani-page-content button").first().click();
      await expect(page.getByLabel("معاني الآية وتفسيرها")).toBeVisible();
      await expectDockDoesNotOverlapMushaf(page);
      await expectDockRespectsSafeArea(page, safeAreaCase.bottomInset);

      const headerTop = await page.locator(".quran-reader-header").evaluate(
        (header) => header.getBoundingClientRect().top,
      );
      expect(headerTop).toBeGreaterThanOrEqual(safeAreaCase.topInset);
    });
  }

  test("keeps page 604 above the expanded guided memorization panel on a short safe-area phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await emulatePortraitSafeArea(page, 20, 34);
    await page.goto("/quran/114?ayah=1&page=604&view=pages");

    const finalPage = page.locator("[data-quran-page='604']");
    await expect(finalPage).toBeVisible();
    await expect(finalPage.locator(".animate-spin")).toHaveCount(0);
    await page.getByTestId("button-mobile-memo-session").click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toBeVisible();
    await expectGuidedPanelDoesNotOverlapMushaf(page, 34);
  });
});
