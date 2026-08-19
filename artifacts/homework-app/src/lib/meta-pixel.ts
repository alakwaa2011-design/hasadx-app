/**
 * Meta Pixel — browser-only conversion tracking.
 *
 * This module deliberately sends no user-identifying values. Script loading
 * and initialization are guarded both in module memory and on the window so
 * HMR/StrictMode cannot create duplicate Pixel instances.
 */

export const META_PIXEL_ID = "2633775947079857";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
    };
    _fbq?: Window["fbq"];
    __hasadMetaPixelInitialized?: boolean;
  }
}

let initialized = false;

function storageHas(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storageSet(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Tracking must never affect the application.
  }
}

export function initMetaPixel(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (initialized || window.__hasadMetaPixelInitialized) return;

  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      const queue = fbq.queue ?? [];
      queue.push(args);
      fbq.queue = queue;
    }) as NonNullable<Window["fbq"]>;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }

  if (!document.querySelector(`script[data-meta-pixel-id="${META_PIXEL_ID}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.setAttribute("data-meta-pixel-id", META_PIXEL_ID);
    document.head.appendChild(script);
  }

  window.fbq!("init", META_PIXEL_ID);
  initialized = true;
  window.__hasadMetaPixelInitialized = true;
}

export function trackMetaPageView(): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}

function trackOnce(key: string, eventName: string): void {
  if (typeof window === "undefined" || !window.fbq || storageHas(key)) return;
  storageSet(key);
  window.fbq("track", eventName);
}

/** Fires once for a newly created, server-verified teacher account. */
export function trackMetaCompleteRegistration(teacherId: number): void {
  trackOnce(`hasad:meta:complete-registration:${teacherId}`, "CompleteRegistration");
}

/**
 * Fires once per checkout offer in the current browser session. The offer key
 * prevents double-clicks/reloads from duplicating the same intent without
 * sending any plan, package, price, or personal data to Meta.
 */
export function trackMetaInitiateCheckout(
  offerType: "subscription" | "credits",
  offerId: string | number,
): void {
  trackOnce(`hasad:meta:initiate-checkout:${offerType}:${String(offerId)}`, "InitiateCheckout");
}

/** Fires only after the server-side purchase-status endpoint says completed. */
export function trackMetaPurchaseOnce(purchaseIntentId: string): void {
  trackOnce(`hasad:meta:purchase:${purchaseIntentId}`, "Purchase");
}