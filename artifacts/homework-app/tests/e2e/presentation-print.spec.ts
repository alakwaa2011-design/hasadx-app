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
 * Regression coverage for the "blank black slide preview / blank PDF
 * export" bug.
 *
 * The bug came from a subtle React style-merging quirk in
 * `slide-render.tsx`: writing a longhand `backgroundImage: undefined`
 * alongside the `background` shorthand cleared the theme gradient on
 * commit, leaving an all-black slide both in the on-screen print
 * preview and in the headless-Chromium PDF that is rendered from the
 * exact same page.
 *
 * The unit suite under `src/lib/slide-render.test.tsx` guards the
 * style logic in isolation; this spec guards the integration:
 *
 *   1. The teacher's print preview page mounts and the first
 *      `.print-slide` carries a non-empty, non-black background once
 *      the deck has loaded.
 *   2. The PDF export endpoint returns a real, multi-kB
 *      `application/pdf` payload starting with the `%PDF-` magic
 *      bytes (anything tiny means chromium captured an empty page).
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

test.describe("Presentation print preview & PDF export", () => {
  test("print preview renders the first slide with a non-blank background", async ({ page }) => {
    /* Suppress the auto-print() that the manual flow triggers a few
       hundred ms after the deck loads, so the test isn't racing the
       browser print dialog. */
    await page.addInitScript(() => {
      Object.defineProperty(window, "print", {
        value: () => undefined,
        configurable: true,
      });
    });

    await page.goto(`/teacher/presentations/${deck.id}/print`);

    const firstSlide = page.locator(".print-slide").first();
    await expect(firstSlide).toBeVisible({ timeout: 20_000 });

    /* The renderer's outermost div carries the background style. */
    const innerDiv = firstSlide.locator("> div").first();
    await expect(innerDiv).toBeAttached({ timeout: 10_000 });

    const probe = await innerDiv.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        backgroundImage: cs.backgroundImage,
        width: r.width,
        height: r.height,
      };
    });

    /* Non-collapsed layout. */
    expect(probe.width).toBeGreaterThan(100);
    expect(probe.height).toBeGreaterThan(100);

    /* The theme gradient must reach the rendered element. The bug
       wiped it, leaving "none" — which is exactly the signal that
       proves the regression is gone. We deliberately do not assert
       on `backgroundColor`: a healthy gradient is set via
       `background-image`, so the computed `background-color` is
       legitimately transparent (`rgba(0, 0, 0, 0)`) and would make
       a colour-based check noisy. */
    expect(probe.backgroundImage).toMatch(/gradient/);
    expect(probe.backgroundImage).not.toBe("none");
  });

  test("PDF export returns a valid, non-empty application/pdf payload", async ({ request }) => {
    const res = await request.post(`/api/presentations/${deck.id}/export/pdf`, {
      headers: { Cookie: teacher.cookieHeader },
    });

    expect(
      res.status(),
      `unexpected status; body: ${res.status() === 200 ? "<pdf>" : await res.text()}`,
    ).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/^application\/pdf/);

    const buf = Buffer.from(await res.body());
    /* Magic bytes — every PDF starts with "%PDF-". */
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
    /* Non-trivial body — anything under a few kB means chromium
       captured an empty/blank page. The blank-PDF regression
       produced a tiny, near-empty file even though the page count
       looked right. */
    expect(buf.length).toBeGreaterThan(2000);
  });
});
