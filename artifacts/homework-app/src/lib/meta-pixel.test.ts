import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Meta Pixel tracking", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.sessionStorage.clear();
    delete window.fbq;
    delete window._fbq;
    delete window.__hasadMetaPixelInitialized;
    vi.resetModules();
  });

  it("loads the script and initializes the Pixel only once", async () => {
    const { initMetaPixel, META_PIXEL_ID } = await import("./meta-pixel");

    initMetaPixel();
    initMetaPixel();

    expect(document.querySelectorAll("script[data-meta-pixel-id]").length).toBe(1);
    expect(document.querySelector("script[data-meta-pixel-id]")?.getAttribute("src"))
      .toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(window.fbq?.queue.map((call) => Array.from(call))).toEqual([
      ["init", META_PIXEL_ID],
    ]);
  });

  it("tracks PageView for the initial view and SPA navigations", async () => {
    const { initMetaPixel, trackMetaPageView } = await import("./meta-pixel");
    initMetaPixel();

    trackMetaPageView();
    trackMetaPageView();

    expect(window.fbq?.queue.map((call) => Array.from(call))).toEqual([
      ["init", "2633775947079857"],
      ["track", "PageView"],
      ["track", "PageView"],
    ]);
  });

  it("deduplicates registration, checkout, and proven purchase events", async () => {
    const {
      initMetaPixel,
      trackMetaCompleteRegistration,
      trackMetaInitiateCheckout,
      trackMetaPurchaseOnce,
    } = await import("./meta-pixel");
    initMetaPixel();

    trackMetaCompleteRegistration(42);
    trackMetaCompleteRegistration(42);
    trackMetaInitiateCheckout("credits", 7);
    trackMetaInitiateCheckout("credits", 7);
    trackMetaInitiateCheckout("subscription", "pro");
    trackMetaPurchaseOnce("server-intent-1");
    trackMetaPurchaseOnce("server-intent-1");

    expect(window.fbq?.queue.map((call) => Array.from(call))).toEqual([
      ["init", "2633775947079857"],
      ["track", "CompleteRegistration"],
      ["track", "InitiateCheckout"],
      ["track", "InitiateCheckout"],
      ["track", "Purchase"],
    ]);
    expect(window.fbq?.queue.every((call) => call.length <= 2)).toBe(true);
  });

  it("dispatches directly through callMethod after fbevents.js loads", async () => {
    const { initMetaPixel } = await import("./meta-pixel");
    initMetaPixel();

    const dispatched: unknown[][] = [];
    window.fbq!.callMethod = (...args) => dispatched.push(args);
    window.fbq!("track", "PageView");

    expect(dispatched).toEqual([["track", "PageView"]]);
    expect(window.fbq?.queue).toHaveLength(1);
  });
});