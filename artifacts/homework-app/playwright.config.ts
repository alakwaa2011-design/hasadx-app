import { defineConfig, devices, webkit } from "@playwright/test";
import { fileURLToPath } from "node:url";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseIsolated = process.env.E2E_DATABASE_ISOLATED === "1";

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required for browser tests. Refusing to run E2E fixtures against the application database.",
  );
}

if (testDatabaseIsolated) {
  if (applicationDatabaseUrl !== testDatabaseUrl) {
    throw new Error("Playwright worker is not connected to TEST_DATABASE_URL.");
  }
} else {
  if (!applicationDatabaseUrl || testDatabaseUrl === applicationDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL must be a dedicated database that differs from DATABASE_URL before running browser tests.",
    );
  }

  // Playwright workers inherit this marker and the test-only connection below.
  // They must verify the inherited connection, but should not compare it to the
  // original application connection a second time.
  process.env.E2E_DATABASE_ISOLATED = "1";
}

// Playwright workers inherit this environment, so fixture imports from
// @workspace/db are pinned to the same isolated database as the API below.
process.env.DATABASE_URL = testDatabaseUrl;

const apiPort = 5101;
const appPort = 5102;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const appBaseUrl = `http://127.0.0.1:${appPort}`;
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (!process.env.CI
    ? process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
    : undefined);
const chromiumLaunchOptions = chromiumExecutablePath
  ? { launchOptions: { executablePath: chromiumExecutablePath } }
  : {};
const runsOnReplitNix =
  process.platform === "linux" && Boolean(process.env.REPL_ID);
const webkitLaunchOptions = runsOnReplitNix
  ? {
      launchOptions: {
        executablePath: fileURLToPath(
          new URL("./tests/e2e/webkit-nixos-launcher.sh", import.meta.url),
        ),
        env: {
          ...process.env,
          PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH: webkit.executablePath(),
        },
      },
    }
  : {};

/**
 * Playwright configuration for the mobile-shell regression suite.
 *
 * Each run starts an isolated API + Vite pair. The API and Playwright fixtures
 * share TEST_DATABASE_URL, never the application database.
 *
 * The suite is intentionally targeted: it protects the mobile presentation
 * editor regressions and public, browser-facing game flows. Add new specs
 * sparingly; broader coverage belongs in the API-level Vitest suites under
 * `artifacts/api-server/src/__tests__`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: appBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "mobile-portrait",
      testIgnore: /(escape-setup|worksheet-pdf|lesson-plan-word|rewards-single-grant)\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        // CI normally uses Playwright's downloaded browser. Local recovery
        // falls back to Replit's managed Chromium only for Chromium projects.
        ...chromiumLaunchOptions,
      },
    },
    {
      name: "iphone-webkit-direct-play",
      testMatch: /direct-play\.spec\.ts/,
      grep: /independent answers commit only after a completed activation/,
      use: {
        ...devices["iPhone 13"],
        // Playwright's Linux WebKit bundle replaces LD_LIBRARY_PATH in its
        // launcher. Replit's launcher preserves the bundle paths and appends
        // the Nix-provided runtime libraries.
        ...webkitLaunchOptions,
      },
    },
    // Escape setup owns database-backed fixtures, so its two viewports run in
    // dedicated projects rather than sharing a worker with legacy specs that
    // close their own database pool during cleanup.
    {
      name: "mobile-escape-setup",
      testMatch: /escape-setup\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        ...chromiumLaunchOptions,
      },
    },
    {
      name: "desktop-escape-setup",
      testMatch: /escape-setup\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        ...chromiumLaunchOptions,
      },
    },
    {
      name: "desktop-worksheet-pdf",
      testMatch: /(worksheet-pdf|lesson-plan-word)\.spec\.ts/,
      use: {
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        ...chromiumLaunchOptions,
      },
    },
    {
      name: "desktop-rewards",
      testMatch: /rewards-single-grant\.spec\.ts/,
      grepInvert: /mobile avatar gallery/,
      use: {
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        ...chromiumLaunchOptions,
      },
    },
    {
      name: "mobile-rewards",
      testMatch: /rewards-single-grant\.spec\.ts/,
      grep: /mobile avatar gallery/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        ...chromiumLaunchOptions,
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      url: `${apiBaseUrl}/api/healthz`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        PORT: String(apiPort),
      },
    },
    {
      command: "pnpm --filter @workspace/homework-app run dev",
      url: appBaseUrl,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        API_PROXY_TARGET: apiBaseUrl,
        E2E_TEST: "1",
        PORT: String(appPort),
      },
    },
  ],
});
