/**
 * Production smoke test — hasadx.com
 *
 * Guards against blank loading-screen regressions where the splash screen
 * stays visible indefinitely because React failed to mount (bad build,
 * missing chunk, runtime crash, etc.).
 *
 * Run against production:
 *   SMOKE_URL=https://hasadx.com pnpm --filter @workspace/homework-app test:smoke
 *
 * Run against the local dev server (default):
 *   pnpm --filter @workspace/homework-app test:smoke
 *
 * Each route check:
 *   1. HTTP response is 200.
 *   2. #hasad-splash is fully removed from the DOM (React fades it out and
 *      removes it 380 ms after createRoot().render() runs). This is the
 *      definitive signal that the JS bundle executed and React committed.
 *   3. #root contains at least one element that is not #hasad-splash and not
 *      a <noscript> block — i.e. a genuine React-rendered DOM node.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Override the target origin with SMOKE_URL to point at production:
 *   SMOKE_URL=https://hasadx.com pnpm test:smoke
 */
const BASE = (process.env.SMOKE_URL ?? "http://localhost:80").replace(/\/$/, "");

/**
 * Routes to verify. Each entry is checked independently.
 * The homepage check is the primary guard; the others are secondary.
 */
const ROUTES: Array<{ path: string; description: string }> = [
  { path: "/", description: "home page" },
  { path: "/about", description: "about page" },
  { path: "/login", description: "login page" },
  { path: "/game/join", description: "game-join page" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait until React has provably mounted:
 *
 *   Step 1 — #hasad-splash must be fully removed from the DOM.
 *             main.tsx fades it to opacity 0, then calls splice.remove()
 *             after 380 ms. If the JS bundle crashes before or during React's
 *             commit phase, the splash is never removed.
 *
 *   Step 2 — #root must contain at least one child that is neither
 *             #hasad-splash nor a <noscript> element.  #root starts with
 *             those two nodes as static HTML; React-rendered children are
 *             anything else (e.g. the ErrorBoundary / App wrapper divs).
 *
 * Returns null on success, or a descriptive string on failure.
 */
async function assertReactMounted(page: Page): Promise<string | null> {
  // Step 1: Wait for #hasad-splash to disappear from the DOM entirely.
  // The fade-out takes ~380 ms; we allow up to 15 s for slow networks.
  try {
    await page.waitForSelector("#hasad-splash", {
      state: "detached",
      timeout: 15_000,
    });
  } catch {
    const splashInfo = await page.evaluate(() => {
      const el = document.getElementById("hasad-splash");
      if (!el) return "unexpectedly absent";
      const s = window.getComputedStyle(el);
      return `still present (opacity=${s.opacity}, display=${s.display}, visibility=${s.visibility})`;
    });
    return (
      `React never removed #hasad-splash — the JS bundle likely crashed or the ` +
      `splash fade-out code never ran.\n` +
      `  #hasad-splash: ${splashInfo}`
    );
  }

  // Step 2: Confirm #root has a React-rendered child (not just noscript).
  // After the splash is removed, React's rendered tree is the only content
  // left inside #root.  We exclude <noscript> because it is static HTML
  // injected for crawlers — it is present even when React fails entirely.
  const reactChildCount = await page.evaluate(() => {
    const root = document.getElementById("root");
    if (!root) return -1;
    return Array.from(root.children).filter(
      (el) => el.tagName !== "NOSCRIPT" && el.id !== "hasad-splash",
    ).length;
  });

  if (reactChildCount < 1) {
    const rootHTML = await page.evaluate(
      () => document.getElementById("root")?.innerHTML.slice(0, 400) ?? "(missing)",
    );
    return (
      `#hasad-splash was removed but #root has no React-rendered children.\n` +
      `  Non-splash/noscript children: ${reactChildCount}\n` +
      `  #root innerHTML (first 400 chars): ${rootHTML}`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

for (const route of ROUTES) {
  test(`smoke: ${route.description} (${route.path})`, async ({ page }) => {
    const url = `${BASE}${route.path}`;

    // 1. HTTP 200 ----------------------------------------------------------
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(
      response?.status(),
      `Expected HTTP 200 for ${url}, got ${response?.status()}`,
    ).toBe(200);

    // 2 & 3. React mounted; splash removed; real children present ----------
    const error = await assertReactMounted(page);
    expect(error, error ?? undefined).toBeNull();
  });
}
