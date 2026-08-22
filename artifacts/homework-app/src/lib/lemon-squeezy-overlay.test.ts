import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete window.LemonSqueezy;
  delete window.createLemonSqueezy;
  document.getElementById("hasad-lemon-squeezy")?.remove();
});

describe("Lemon Squeezy Overlay", () => {
  it("يفتح رابط Checkout النهائي عبر واجهة Lemon الرسمية ويهيئ معالجاً واحداً للأحداث", async () => {
    const open = vi.fn();
    const setup = vi.fn();
    window.LemonSqueezy = { Setup: setup, Url: { Open: open } };

    const { openLemonSqueezyOverlay, subscribeToLemonSqueezyEvents } =
      await import("./lemon-squeezy-overlay");
    const listener = vi.fn();
    subscribeToLemonSqueezyEvents(listener);

    await openLemonSqueezyOverlay("https://checkout.example/credits");
    await openLemonSqueezyOverlay("https://checkout.example/subscription");

    expect(open).toHaveBeenNthCalledWith(1, "https://checkout.example/credits");
    expect(open).toHaveBeenNthCalledWith(2, "https://checkout.example/subscription");
    expect(setup).toHaveBeenCalledOnce();

    const eventHandler = setup.mock.calls[0][0].eventHandler;
    eventHandler({ event: "Checkout.Success" });
    expect(listener).toHaveBeenCalledWith({ event: "Checkout.Success" });
  });

  it("يعرض خطأ قابلاً لإعادة المحاولة إن فشل تحميل Lemon.js", async () => {
    const { loadLemonSqueezy } = await import("./lemon-squeezy-overlay");
    const loading = loadLemonSqueezy();
    const script = document.getElementById("hasad-lemon-squeezy") as HTMLScriptElement;
    expect(script.src).toBe("https://app.lemonsqueezy.com/js/lemon.js");
    script.dispatchEvent(new Event("error"));

    await expect(loading).rejects.toThrow("تعذر تحميل نافذة الدفع الآمن");
  });
});