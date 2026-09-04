import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const meta = vi.hoisted(() => ({ trackMetaInitiateCheckout: vi.fn() }));
const overlay = vi.hoisted(() => ({ openLemonSqueezyOverlay: vi.fn() }));

vi.mock("@/lib/meta-pixel", () => meta);
vi.mock("@/lib/lemon-squeezy-overlay", () => overlay);

import {
  beginCreditPackageCheckout,
  beginSubscriptionCheckout,
  openSubscriptionCheckout,
} from "./credits-checkout";

function jsonResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

beforeEach(() => {
  meta.trackMetaInitiateCheckout.mockReset();
  overlay.openLemonSqueezyOverlay.mockReset();
  overlay.openLemonSqueezyOverlay.mockResolvedValue(undefined);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("معالجات Checkout المشتركة", () => {
  it("يحفظ Intent حزمة النقاط ويتتبعها ويحوّل مرة واحدة بعد استجابة Checkout الناجحة", async () => {
    const redirect = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        checkoutUrl: "https://checkout.example/credits",
        purchaseIntentId: "purchase-intent-42",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await beginCreditPackageCheckout(2, "تعذر بدء الدفع", { redirect });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/api/credits/checkout");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ packageId: 2 }),
    });
    expect(sessionStorage.getItem("hasad:pending-credit-purchase-intent")).toBe("purchase-intent-42");
    expect(meta.trackMetaInitiateCheckout).toHaveBeenCalledWith("credits", 2);
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/credits");
  });

  it("لا يتتبع أو يحوّل حزمة نقاط عند رفض Checkout", async () => {
    const redirect = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ message: "الدفع غير متاح" }, false),
    ));

    await expect(beginCreditPackageCheckout(2, "تعذر بدء الدفع", { redirect })).rejects.toThrow("الدفع غير متاح");
    expect(sessionStorage.getItem("hasad:pending-credit-purchase-intent")).toBeNull();
    expect(meta.trackMetaInitiateCheckout).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("يلتقط رصيد ما قبل الاشتراك ثم يتتبع التحويل الآمن للباقة", async () => {
    const redirect = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ balance: 137 }))
      .mockResolvedValueOnce(jsonResponse({ checkoutUrl: "https://checkout.example/pro" }));
    vi.stubGlobal("fetch", fetchMock);

    await beginSubscriptionCheckout("pro", "تعذر بدء الدفع", {
      snapshotCreditBalance: true,
      redirect,
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/api/credits/me");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/subscriptions/checkout");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ planCode: "pro", billingInterval: "month" }),
    });
    expect(sessionStorage.getItem("subCheckoutBalanceSnapshot")).toBe("137");
    expect(meta.trackMetaInitiateCheckout).toHaveBeenCalledWith("subscription", "pro");
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/pro");
  });

  it("يرسل فترة سنوية صراحةً عند اختيارها", async () => {
    const redirect = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ checkoutUrl: "https://checkout.example/basic" }));
    vi.stubGlobal("fetch", fetchMock);
    await beginSubscriptionCheckout("basic", "تعذر بدء الدفع", "year", { redirect });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({ planCode: "basic", billingInterval: "year" }),
    });
  });

  it.each([
    ["basic", "month"],
    ["pro", "month"],
    ["basic", "year"],
    ["pro", "year"],
  ] as const)("يفتح Overlay داخل الصفحة لاشتراك %s %s", async (planCode, billingInterval) => {
    const checkoutUrl = `https://checkout.example/${planCode}-${billingInterval}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ checkoutUrl })));

    await beginSubscriptionCheckout(planCode, "تعذر بدء الدفع", billingInterval);

    expect(overlay.openLemonSqueezyOverlay).toHaveBeenCalledOnce();
    expect(overlay.openLemonSqueezyOverlay).toHaveBeenCalledWith(checkoutUrl);
  });

  it("يستخدم التحويل الخارجي كـ fallback فقط عند فشل Lemon.js", async () => {
    const checkoutUrl = "https://checkout.example/pro-year";
    const externalRedirect = vi.fn();
    overlay.openLemonSqueezyOverlay.mockRejectedValueOnce(new Error("Lemon.js unavailable"));

    await openSubscriptionCheckout(checkoutUrl, externalRedirect);

    expect(overlay.openLemonSqueezyOverlay).toHaveBeenCalledWith(checkoutUrl);
    expect(externalRedirect).toHaveBeenCalledOnce();
    expect(externalRedirect).toHaveBeenCalledWith(checkoutUrl);
  });

  it("لا يمنع فشل لقطة الرصيد Checkout الاشتراك", async () => {
    const redirect = vi.fn();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(jsonResponse({ checkoutUrl: "https://checkout.example/basic" }));
    vi.stubGlobal("fetch", fetchMock);

    await beginSubscriptionCheckout("basic", "تعذر بدء الدفع", {
      snapshotCreditBalance: true,
      redirect,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/subscriptions/checkout");
    expect(sessionStorage.getItem("subCheckoutBalanceSnapshot")).toBeNull();
    expect(redirect).toHaveBeenCalledWith("https://checkout.example/basic");
  });
});