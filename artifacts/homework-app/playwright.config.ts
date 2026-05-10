import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the mobile-shell regression suite.
 *
 * The tests target a running dev environment via the shared Replit proxy
 * (defaults to http://localhost:80). The api-server and homework-app
 * workflows must be running before invoking `pnpm test:e2e`.
 *
 * The suite is intentionally tiny — it only covers the mobile presentation
 * editor flows that regressed in task #475 (AI outline button, Go-live
 * button, present-mode tap zones, and SlideStage letterboxing). Add new
 * specs sparingly; broader coverage belongs in the API-level vitest
 * suites under `artifacts/api-server/src/__tests__`.
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
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:80",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "mobile-portrait",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
