/**
 * Mandatory final build step. Never accepts SMOKE_URL: Publish must test the
 * exact dist/public output, after prerender, using the production static server.
 * No API server, accounts, credentials or database are needed.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = { ...process.env };
delete env.SMOKE_URL;
if (!env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  const system = spawnSync("which", ["chromium"], { encoding: "utf8" });
  if (system.status === 0) env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = system.stdout.trim();
}
function run(args) {
  const result = spawnSync("pnpm", ["exec", "playwright", ...args], {
    env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Clean deployment builders may not cache Playwright's browser. A failed
// installation/launch is a build failure, not permission to skip the gate.
if (!env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && !existsSync(chromium.executablePath())) {
  run(["install", "chromium"]);
}
run(["test", "--config", "playwright.smoke.config.ts", "--project", "built-app"]);