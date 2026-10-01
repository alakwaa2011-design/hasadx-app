import { test, expect } from "@playwright/test";
import { assertHealthyStartup, collectStartupErrors, isolateAnonymousNetwork, isBrowserToolError, isLocalGoogleOriginError } from "./production-smoke-helpers";

const origin = "http://127.0.0.1:4187";
const home = '<div id="root"><h1>من فكرة الدرس إلى تجربة تعليمية كاملة</h1><a href="/register">ابدأ</a></div>';

for (const scenario of [
  { name: "HTTP 200 root fallback", html: '<div id="root"><div data-testid="root-error-boundary-fallback">crash</div></div>' },
  { name: "uncaught app JavaScript", html: `${home}<script>throw new Error("No QueryClient set")</script>` },
  { name: "caught React crash", html: `${home}<script>console.error("[ErrorBoundary] No QueryClient set")</script>` },
  { name: "late asynchronous crash", html: `${home}<script>setTimeout(() => {document.querySelector("#root").innerHTML='<div data-testid="root-error-boundary-fallback">crash</div>'}, 300)</script>` },
  { name: "static prerender content only", html: '<div id="root"><h1>منصة حصاد التعليمية</h1></div>' },
  { name: "splash never removed", html: `${home}<div id="hasad-splash">Loading...</div>` },
  { name: "login shell without form", html: '<div id="root">Loading login...</div>', path: "/login" },
]) {
  test(`gate rejects ${scenario.name}`, async ({ page }) => {
    const errors = collectStartupErrors(page, origin);
    await page.route("**/*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: scenario.html }));
    expect((await page.goto(origin))?.status()).toBe(200);
    await expect(assertHealthyStartup(page, scenario.path ?? "/", errors)).rejects.toThrow();
  });
}

test("error exclusions are narrow and source-aware", () => {
  expect(isBrowserToolError("tool failure", "chrome-extension://id/script.js")).toBe(true);
  expect(isBrowserToolError("No QueryClient set", `${origin}/assets/app.js`)).toBe(false);
  const googleMessage = "[GSI_LOGGER]: The given origin is not allowed for the given client ID.";
  expect(isLocalGoogleOriginError(googleMessage, "https://accounts.google.com/gsi/client", origin)).toBe(true);
  expect(isLocalGoogleOriginError(googleMessage, `${origin}/assets/app.js`, origin)).toBe(false);
  expect(isLocalGoogleOriginError(googleMessage, "https://accounts.google.com/gsi/client", "https://hasaadx.com")).toBe(false);
  expect(isLocalGoogleOriginError("TypeError: broken bundle", "https://accounts.google.com/gsi/client", origin)).toBe(false);
});

test("gate rejects missing first-party JavaScript assets", async ({ page }) => {
  const errors = collectStartupErrors(page, origin);
  await page.route("**/*", (route) => route.request().resourceType() === "script"
    ? route.fulfill({ status: 404, body: "Missing chunk" })
    : route.fulfill({ status: 200, contentType: "text/html", body: `${home}<script src="/assets/missing.js"></script>` }));
  expect((await page.goto(origin))?.status()).toBe(200);
  await expect(assertHealthyStartup(page, "/", errors)).rejects.toThrow();
  expect(errors.some((error) => error.includes("Asset HTTP 404"))).toBe(true);
});

test("network isolation consumes telemetry and rejects account writes", async ({ page }) => {
  const unexpected = await isolateAnonymousNetwork(page, origin);
  await page.route(`${origin}/`, (route) => route.fulfill({ contentType: "text/html", body: home }));
  await page.goto(origin);
  const statuses = await page.evaluate(async () => ({
    me: (await fetch("/api/auth/me")).status,
    telemetry: (await fetch("/api/activity/page-view", { method: "POST" })).status,
    accountWrite: (await fetch("/api/auth/login", { method: "POST" })).status,
    externalBlocked: await fetch("https://example.com/").then(() => false, () => true),
  }));
  expect(statuses).toEqual({ me: 401, telemetry: 204, accountWrite: 405, externalBlocked: true });
  expect(unexpected).toEqual(["Unexpected mutation: POST /api/auth/login"]);
});