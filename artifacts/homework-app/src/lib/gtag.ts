/**
 * Google Analytics 4 helper.
 *
 * - Loads gtag.js exactly once (guarded by a module-level flag and a
 *   data-attribute on the <script> tag, so HMR/StrictMode double-renders
 *   never inject a second copy).
 * - Disables automatic page_view (`send_page_view: false`) because this is
 *   a wouter-driven SPA — we fire page_view manually from PageViewTracker.
 * - Falls back to the hard-coded measurement ID when the env var is unset,
 *   so production keeps working even without a build-time secret.
 * - All exports are safe to call before init / outside the browser; they
 *   become no-ops in those cases.
 */

const DEFAULT_MEASUREMENT_ID = "G-3W1J3J2YE4";

export const GA_MEASUREMENT_ID: string =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ||
  DEFAULT_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initGA(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!GA_MEASUREMENT_ID) return;

  // Belt-and-suspenders: if a script tag is already present (e.g. from a
  // previous mount in dev), don't add another.
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-ga-id="${GA_MEASUREMENT_ID}"]`,
  );
  if (!existing) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute("data-ga-id", GA_MEASUREMENT_ID);
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = window.gtag || gtag;
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
  });

  initialized = true;
}

/** Fire a SPA page_view. Safe to call before init (becomes a no-op). */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  if (typeof window === "undefined") return;
  if (!window.gtag || !GA_MEASUREMENT_ID) return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.origin + pagePath,
    page_title: pageTitle ?? document.title,
    send_to: GA_MEASUREMENT_ID,
  });
}

/** Fire a custom GA4 event. Safe to call before init. */
export function trackGAEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  window.gtag("event", name, params ?? {});
}
