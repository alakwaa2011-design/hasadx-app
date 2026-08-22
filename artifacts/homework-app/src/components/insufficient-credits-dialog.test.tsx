import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { INSUFFICIENT_CREDITS_EVENT } from "@/lib/credit-aware-fetch";

const navigation = vi.hoisted(() => ({ setLocation: vi.fn() }));
const checkout = vi.hoisted(() => ({
  fetchCreditPackages: vi.fn(),
  fetchSubscriptionPlans: vi.fn(),
  fetchCurrentSubscription: vi.fn(),
  beginCreditPackageCheckout: vi.fn(),
  beginSubscriptionCheckout: vi.fn(),
  getEligibleUpgradePlans: vi.fn(),
}));
const overlay = vi.hoisted(() => ({
  openLemonSqueezyOverlay: vi.fn(),
  subscribeToLemonSqueezyEvents: vi.fn(),
}));
const creditsBalance = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/create-assignment", navigation.setLocation],
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    lang: "ar",
    dir: "rtl",
    t: { pricing: { checkoutError: "تعذر بدء الدفع", paymentsDisabled: "المدفوعات غير متاحة حالياً" } },
  }),
}));

vi.mock("@/lib/credits-checkout", () => checkout);
vi.mock("@/lib/lemon-squeezy-overlay", () => overlay);
vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => creditsBalance.refresh,
}));

import { InsufficientCreditsDialog } from "./insufficient-credits-dialog";

const PACKAGES = [
  { id: 1, name: "حزمة 100", description: null, priceUsdCents: 299, currency: "USD", credits: 100, isFeatured: false },
  { id: 2, name: "حزمة 300", description: "الوصف الحالي", priceUsdCents: 699, currency: "USD", credits: 300, isFeatured: true },
  { id: 3, name: "حزمة 600", description: null, priceUsdCents: 1199, currency: "USD", credits: 600, isFeatured: false },
];
const PLANS = [
  { id: 1, code: "free", nameAr: "المجانية", nameEn: "Free", priceMinor: 0, currency: "USD", billingPeriodDays: 0, monthlyCredits: 50, rolloverCap: null },
  { id: 2, code: "basic", nameAr: "الأساسية", nameEn: "Basic", priceMinor: 499, currency: "USD", billingPeriodDays: 30, monthlyCredits: 250, rolloverCap: 500 },
  { id: 3, code: "pro", nameAr: "الاحترافية", nameEn: "Pro", priceMinor: 999, currency: "USD", billingPeriodDays: 30, monthlyCredits: 600, rolloverCap: 1200 },
];

let container: HTMLDivElement;
let root: Root;
let lemonEventHandler: ((event: { event?: string } | "close") => void) | null = null;

beforeEach(() => {
  navigation.setLocation.mockReset();
  checkout.fetchCreditPackages.mockReset();
  checkout.fetchSubscriptionPlans.mockReset();
  checkout.fetchCurrentSubscription.mockReset();
  checkout.beginCreditPackageCheckout.mockReset();
  checkout.beginSubscriptionCheckout.mockReset();
  checkout.getEligibleUpgradePlans.mockReset();
  overlay.openLemonSqueezyOverlay.mockReset();
  overlay.subscribeToLemonSqueezyEvents.mockReset();
  creditsBalance.refresh.mockReset();
  overlay.openLemonSqueezyOverlay.mockResolvedValue(undefined);
  lemonEventHandler = null;
  overlay.subscribeToLemonSqueezyEvents.mockImplementation((listener: (event: { event?: string } | "close") => void) => {
    lemonEventHandler = listener;
    return () => { lemonEventHandler = null; };
  });
  checkout.beginCreditPackageCheckout.mockResolvedValue(undefined);
  checkout.beginSubscriptionCheckout.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderAndOpen(detail = { balance: 3, required: 10 }) {
  await act(async () => {
    root.render(<InsufficientCreditsDialog />);
  });
  await act(async () => {
    window.dispatchEvent(new CustomEvent(INSUFFICIENT_CREDITS_EVENT, { detail }));
  });
}

function buttonWithText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  ) as HTMLButtonElement;
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe("InsufficientCreditsDialog", () => {
  it("يعرض الأرقام الخادمية ويتجاهل إشعار نقص ثانٍ أثناء فتحه", async () => {
    await renderAndOpen();

    expect(document.body.textContent).toContain("رصيد نقاط حصاد غير كافٍ");
    expect(document.body.textContent).toContain("لديك 3 نقطة");
    expect(document.body.textContent).toContain("يتطلب هذا الإجراء 10 نقطة");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(INSUFFICIENT_CREDITS_EVENT, {
          detail: { balance: 0, required: 99 },
        }),
      );
    });

    expect(document.body.textContent).not.toContain("99 نقطة");
  });

  it("يعرض حزم الخادم داخل النافذة ولا ينشئ Checkout قبل التأكيد", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: true });
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();

    expect(document.body.textContent).toContain("اختر حزمة نقاط");
    expect(document.body.textContent).toContain("100");
    expect(document.body.textContent).toContain("300");
    expect(document.body.textContent).toContain("600");
    expect(checkout.fetchCreditPackages).toHaveBeenCalledTimes(1);
    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();
    expect(navigation.setLocation).not.toHaveBeenCalled();

    const selected = document.querySelector('[data-testid="credit-package-2"]') as HTMLButtonElement;
    await act(async () => selected.click());
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();

    const confirm = buttonWithText(document, "المتابعة إلى الدفع الآمن");
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    await flush();

    expect(checkout.beginCreditPackageCheckout).toHaveBeenCalledTimes(1);
    expect(checkout.beginCreditPackageCheckout).toHaveBeenCalledWith(2, "تعذر بدء الدفع", expect.objectContaining({
      redirect: expect.any(Function),
    }));
    expect(navigation.setLocation).not.toHaveBeenCalled();
  });

  it("يعرض الباقات والترقية المؤهلة داخل النافذة ثم يستدعي الدفع مرة واحدة عند التأكيد", async () => {
    checkout.fetchSubscriptionPlans.mockResolvedValue({
      plans: PLANS,
      pricingPageVisible: true,
      paymentsEnabled: true,
    });
    checkout.fetchCurrentSubscription.mockResolvedValue({
      plan_code: "basic",
      plan_name_ar: "الأساسية",
      plan_name_en: "Basic",
      status: "active",
      payment_status: "active",
      current_period_end: "2026-10-01T00:00:00.000Z",
      cancelled_at: null,
    });
    checkout.getEligibleUpgradePlans.mockReturnValue([PLANS[2]]);
    await renderAndOpen();

    await act(async () => buttonWithText(document, "عرض الباقات").click());
    await flush();

    expect(document.body.textContent).toContain("الباقات والاشتراكات");
    expect(document.body.textContent).toContain("باقتك الحالية: الأساسية");
    expect(document.querySelector('[data-testid="subscription-plan-basic"]')).toBeNull();
    expect(document.querySelector('[data-testid="subscription-plan-pro"]')).not.toBeNull();
    expect(checkout.beginSubscriptionCheckout).not.toHaveBeenCalled();
    expect(navigation.setLocation).not.toHaveBeenCalled();

    const selected = document.querySelector('[data-testid="subscription-plan-pro"]') as HTMLButtonElement;
    await act(async () => selected.click());
    const confirm = buttonWithText(document, "المتابعة إلى الدفع الآمن");
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    await flush();

    expect(checkout.beginSubscriptionCheckout).toHaveBeenCalledTimes(1);
    expect(checkout.beginSubscriptionCheckout).toHaveBeenCalledWith("pro", "تعذر بدء الدفع", expect.objectContaining({
      snapshotCreditBalance: true,
      redirect: expect.any(Function),
    }));
  });

  it("تعود للرسالة الأولى وتغلق بلا طلب دفع أو تغيير مسار", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: true });
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    await act(async () => buttonWithText(document, "عودة").click());
    expect(document.body.textContent).toContain("رصيد نقاط حصاد غير كافٍ");

    await act(async () => buttonWithText(document, "ليس الآن").click());
    expect(document.body.textContent).not.toContain("رصيد نقاط حصاد غير كافٍ");
    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();
    expect(checkout.beginSubscriptionCheckout).not.toHaveBeenCalled();
    expect(navigation.setLocation).not.toHaveBeenCalled();
  });

  it("يعطل المتابعة عندما يعلن مصدر الحزم تعطيل المدفوعات", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: false });
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="credit-package-1"]') as HTMLButtonElement).click());

    const confirm = buttonWithText(document, "المتابعة إلى الدفع الآمن");
    expect(confirm.disabled).toBe(true);
    expect(document.body.textContent).toContain("المدفوعات غير متاحة حالياً");
    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();
  });

  it("يعيد تحميل الحزم من مصدرها نفسه بعد خطأ مؤقت", async () => {
    checkout.fetchCreditPackages
      .mockRejectedValueOnce(new Error("تعذر تحميل الحزم"))
      .mockResolvedValueOnce({ packages: PACKAGES, purchasesEnabled: true });
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    expect(document.body.textContent).toContain("تعذر تحميل الحزم");

    await act(async () => buttonWithText(document, "إعادة المحاولة").click());
    await flush();
    expect(checkout.fetchCreditPackages).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-testid="credit-package-3"]')).not.toBeNull();
    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();
  });

  it("يؤكد باقة الاشتراك فقط بعد الرجوع من اختيار حزمة نقاط", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: true });
    checkout.fetchSubscriptionPlans.mockResolvedValue({
      plans: PLANS,
      pricingPageVisible: true,
      paymentsEnabled: true,
    });
    checkout.fetchCurrentSubscription.mockResolvedValue(null);
    checkout.getEligibleUpgradePlans.mockReturnValue([PLANS[2]]);
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="credit-package-2"]') as HTMLButtonElement).click());
    await act(async () => buttonWithText(document, "عودة").click());

    await act(async () => buttonWithText(document, "عرض الباقات").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="subscription-plan-pro"]') as HTMLButtonElement).click());
    await act(async () => buttonWithText(document, "المتابعة إلى الدفع الآمن").click());
    await flush();

    expect(checkout.beginCreditPackageCheckout).not.toHaveBeenCalled();
    expect(checkout.beginSubscriptionCheckout).toHaveBeenCalledWith("pro", "تعذر بدء الدفع", expect.objectContaining({
      snapshotCreditBalance: true,
      redirect: expect.any(Function),
    }));
  });

  it("يؤكد حزمة النقاط فقط بعد الرجوع من اختيار باقة اشتراك", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: true });
    checkout.fetchSubscriptionPlans.mockResolvedValue({
      plans: PLANS,
      pricingPageVisible: true,
      paymentsEnabled: true,
    });
    checkout.fetchCurrentSubscription.mockResolvedValue(null);
    checkout.getEligibleUpgradePlans.mockReturnValue([PLANS[2]]);
    await renderAndOpen();

    await act(async () => buttonWithText(document, "عرض الباقات").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="subscription-plan-pro"]') as HTMLButtonElement).click());
    await act(async () => buttonWithText(document, "عودة").click());

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="credit-package-1"]') as HTMLButtonElement).click());
    await act(async () => buttonWithText(document, "المتابعة إلى الدفع الآمن").click());
    await flush();

    expect(checkout.beginSubscriptionCheckout).not.toHaveBeenCalled();
    expect(checkout.beginCreditPackageCheckout).toHaveBeenCalledWith(1, "تعذر بدء الدفع", expect.objectContaining({
      redirect: expect.any(Function),
    }));
  });

  it("لا يعرض باقات الاشتراك عندما يخفيها مصدر الباقات", async () => {
    checkout.fetchSubscriptionPlans.mockResolvedValue({
      plans: PLANS,
      pricingPageVisible: false,
      paymentsEnabled: true,
    });
    checkout.fetchCurrentSubscription.mockResolvedValue(null);
    checkout.getEligibleUpgradePlans.mockReturnValue([PLANS[2]]);
    await renderAndOpen();

    await act(async () => buttonWithText(document, "عرض الباقات").click());
    await flush();

    expect(document.body.textContent).toContain("الباقات غير متاحة حالياً");
    expect(document.querySelector('[data-testid="subscription-plan-pro"]')).toBeNull();
    expect(buttonWithText(document, "المتابعة إلى الدفع الآمن").disabled).toBe(true);
    expect(checkout.beginSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("يفتح Overlay الرسمي ويحافظ على الاختيار بعد إغلاقه ويحدّث الرصيد من الخادم بعد النجاح", async () => {
    checkout.fetchCreditPackages.mockResolvedValue({ packages: PACKAGES, purchasesEnabled: true });
    checkout.beginCreditPackageCheckout.mockImplementation(async (
      _packageId: number,
      _fallback: string,
      options: { redirect: (url: string) => Promise<void> },
    ) => options.redirect("https://checkout.example/credits"));
    await renderAndOpen();

    await act(async () => buttonWithText(document, "شراء نقاط").click());
    await flush();
    await act(async () => (document.querySelector('[data-testid="credit-package-2"]') as HTMLButtonElement).click());
    await act(async () => buttonWithText(document, "المتابعة إلى الدفع الآمن").click());
    await flush();

    expect(overlay.openLemonSqueezyOverlay).toHaveBeenCalledWith("https://checkout.example/credits");
    expect(checkout.beginCreditPackageCheckout).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("اختر حزمة نقاط");

    await act(async () => lemonEventHandler?.("close"));
    expect(document.body.textContent).toContain("اختر حزمة نقاط");

    await act(async () => buttonWithText(document, "المتابعة إلى الدفع الآمن").click());
    await flush();
    expect(overlay.openLemonSqueezyOverlay).toHaveBeenCalledTimes(2);
    expect(checkout.beginCreditPackageCheckout).toHaveBeenCalledTimes(1);

    await act(async () => lemonEventHandler?.({ event: "Checkout.Success" }));
    await act(async () => lemonEventHandler?.("close"));
    expect(creditsBalance.refresh).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("تم استلام عملية الدفع");
  });
});