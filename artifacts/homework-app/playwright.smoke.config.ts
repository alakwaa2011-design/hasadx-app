import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Intentionally independent of playwright.config.ts: no DB fixtures, auth,
// Vite development server or browser security-disabling launch flags.
const localOrigin = "http://127.0.0.1:4187";
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath) {
  try { executablePath = execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(); }
  catch { /* Use Playwright's installed browser; absence must fail loudly. */ }
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 35_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/production-smoke",
  use: {
    baseURL: process.env.SMOKE_URL ?? localOrigin,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    launchOptions: executablePath ? { executablePath, chromiumSandbox: true } : { chromiumSandbox: true },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "built-app", testMatch: /production-smoke\.spec\.ts/ },
    { name: "guard-regressions", testMatch: /production-smoke-guards\.spec\.ts/, expect: { timeout: 1_000 } },
  ],
  webServer: process.env.SMOKE_URL ? undefined : {
    command: "node serve.mjs",
    url: localOrigin,
    env: { PORT: "4187" },
    reuseExistingServer: false,
    timeout: 20_000,
  },
});