import { expect, type Page } from "@playwright/test";

/** Only errors provably outside the app are exempt, never generic TypeErrors. */
export function isBrowserToolError(message: string, source: string): boolean {
  return /^(chrome-extension|moz-extension|devtools):\/\//.test(source) ||
    (/^(chrome-extension|moz-extension|devtools):\/\//m.test(message));
}

export function isLocalGoogleOriginError(message: string, source: string, origin: string): boolean {
  const host = new URL(origin).hostname;
  return (host === "127.0.0.1" || host === "localhost") &&
    /^https:\/\/accounts\.google\.com\//.test(source) &&
    /^\[GSI_LOGGER\]: The given origin is not allowed for the given client ID\.?$/.test(message);
}

export function collectStartupErrors(page: Page, origin: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!isBrowserToolError(error.stack ?? error.message, "")) {
      errors.push(`JavaScript: ${error.stack ?? error.message}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    const text = message.text();
    if (isBrowserToolError(text, source) || isLocalGoogleOriginError(text, source, origin)) return;
    // Chromium network diagnostics are not JS exceptions (anonymous 401s,
    // blocked third-party resources). Real console.error calls still fail.
    if (/^Failed to load resource:/.test(text)) return;
    errors.push(`console.error (${source}): ${text}`);
  });
  // Bad first-party chunks/CSS must fail even when Chromium reports only a
  // resource error and prerendered HTML is visible.
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === new URL(origin).origin &&
        ["script", "stylesheet"].includes(request.resourceType())) {
      errors.push(`Asset failed: ${url.pathname}: ${request.failure()?.errorText}`);
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).origin === new URL(origin).origin &&
        ["script", "stylesheet"].includes(response.request().resourceType()) &&
        response.status() >= 400) errors.push(`Asset HTTP ${response.status()}: ${response.url()}`);
  });
  return errors;
}

/** All API traffic is synthetic; external requests never leave the browser. */
export async function isolateAnonymousNetwork(page: Page, origin: string) {
  const unexpected: string[] = [];
  // HTTP interception does not cover WebSockets. Never connect a smoke
  // browser to a real game/session backend, even in optional remote checks.
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      // The app emits anonymous telemetry on mount. Consume it locally without
      // sending writes to an API or changing application behavior.
      if (request.method() === "POST" &&
          ["/api/activity/page-view", "/api/analytics/heartbeat"].includes(url.pathname)) {
        return route.fulfill({ status: 204 });
      }
      if (request.method() !== "GET") {
        unexpected.push(`Unexpected mutation: ${request.method()} ${url.pathname}`);
        return route.fulfill({ status: 405, json: { error: "Smoke test is read-only" } });
      }
      const fixtures: Record<string, { status?: number; body: unknown }> = {
        "/api/auth/me": { status: 401, body: { error: "Not authenticated" } },
        "/api/student-auth/me": { status: 401, body: { error: "Not authenticated" } },
        "/api/public/settings": { body: {} },
        "/api/stats/public": { body: { teachers: 0, assignments: 0, submissions: 0 } },
        "/api/public/assignments": { body: [] },
      };
      const fixture = fixtures[url.pathname];
      if (!fixture) unexpected.push(`Unconfigured anonymous API: ${url.pathname}`);
      return route.fulfill({ status: fixture?.status ?? 200, json: fixture?.body ?? {} });
    }
    if (url.origin !== new URL(origin).origin) return route.abort("blockedbyclient");
    return route.continue();
  });
  return unexpected;
}

async function assertRouteContent(page: Page, path: string) {
  // These controls do not exist in prerender.ts: static crawler HTML cannot
  // satisfy readiness even if the splash has been removed prematurely.
  if (path === "/") {
    await expect(page.getByRole("heading", { level: 1, name: /من فكرة الدرس إلى/ })).toBeVisible();
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();
  } else if (path === "/login") {
    const form = page.locator("form").filter({ has: page.locator('input[type="email"]') });
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="email"]')).toBeEditable();
    await expect(form.locator('input[type="password"]')).toBeEditable();
    await expect(form.locator('button[type="submit"]')).toBeEnabled();
  } else {
    await expect(page.locator("#root > :not(noscript)")).not.toHaveCount(0);
  }
}

export async function assertHealthyStartup(page: Page, path: string, errors: string[]) {
  await expect(page.locator("#hasad-splash")).toHaveCount(0);
  await expect(page.getByTestId("root-error-boundary-fallback")).toHaveCount(0);
  await assertRouteContent(page, path);
  // Observe after async session resolution, lazy imports and initial effects;
  // a healthy shell followed by a delayed crash must not pass.
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId("root-error-boundary-fallback")).toHaveCount(0);
  await assertRouteContent(page, path);
  expect(errors, "Application startup errors").toEqual([]);
}