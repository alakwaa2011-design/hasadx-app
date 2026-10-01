/**
 * Build gate: production static server + final prerendered dist/public.
 * Optional read-only remote check: SMOKE_URL=https://... pnpm test:smoke
 * API responses remain synthetic in both modes; no real users or DB access.
 */
import { test, expect } from "@playwright/test";
import { assertHealthyStartup, collectStartupErrors, isolateAnonymousNetwork } from "./production-smoke-helpers";

for (const path of ["/", "/about", "/login", "/game/join"]) {
  test(`production startup: ${path}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const errors = collectStartupErrors(page, origin);
    const unexpected = await isolateAnonymousNetwork(page, origin);
    const response = await page.goto(`${baseURL!.replace(/\/$/, "")}${path}`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await assertHealthyStartup(page, path, errors);
    expect(unexpected, "Only configured anonymous fixtures are permitted").toEqual([]);
  });
}