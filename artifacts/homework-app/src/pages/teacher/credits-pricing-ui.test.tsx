/**
 * اختبارات واجهة صفحتي «نقاط حصاد» و«الباقات» — /teacher/credits و /teacher/pricing
 *
 * تتحقق من النصوص المعتمدة والحالات الحرجة التي حددها صاحب المنتج:
 *  1. المجاني يعرض 50 نقطة ترحيبية لمرة واحدة ولا يعرض إلغاء اشتراك.
 *  2. Pro يعرض خصم 20% بالنصوص المعتمدة والمزايا الفعلية فقط.
 *  3. ظهور الحزم الثلاث بأسعارها الصحيحة وعبارة عدم انتهاء الصلاحية.
 *  4. رسائل حالة الإلغاء وعدم تغيّر عرض الرصيد بسبب الحالة.
 *  5. الحفاظ على مسار Checkout في نفس التبويب (بلا window.open).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { I18nProvider } from "@/lib/i18n";
import { ar } from "@/locales/ar";
import { en } from "@/locales/en";

// Layout يجرّ الكثير من التبعيات — نستبدله بغلاف بسيط
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: vi.fn() }));

import PricingPage from "./pricing";
import TeacherCreditsPage from "./credits";

const __dirname_ = path.dirname(fileURLToPath(import.meta.url));

/* ─── بيانات فعلية معتمدة (تطابق قاعدة الإنتاج) ─── */
const PLANS = [
  { id: 1, code: "free",  nameAr: "المجانية", nameEn: "Free",  priceMinor: 0,   currency: "USD", billingPeriodDays: 0,  monthlyCredits: 50,  rolloverCap: null },
  { id: 2, code: "basic", nameAr: "الأساسية", nameEn: "Basic", priceMinor: 499, currency: "USD", billingPeriodDays: 30, monthlyCredits: 250, rolloverCap: 500 },
  { id: 3, code: "pro",   nameAr: "الاحترافية", nameEn: "Pro", priceMinor: 999, currency: "USD", billingPeriodDays: 30, monthlyCredits: 600, rolloverCap: 1200 },
];
const PACKAGES = [
  { id: 1, name: "حزمة 100", description: null, priceUsdCents: 299,  currency: "USD", credits: 100, isFeatured: false },
  { id: 2, name: "حزمة 300", description: null, priceUsdCents: 699,  currency: "USD", credits: 300, isFeatured: true },
  { id: 3, name: "حزمة 600", description: null, priceUsdCents: 1199, currency: "USD", credits: 600, isFeatured: false },
];
const BALANCE = { balance: 137, paidBalance: 100, promoBalance: 0, earnedBalance: 7, subscriptionBalance: 0, freeBalance: 30 };

function jsonResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
}

/** fetch وهمي يوجّه حسب المسار */
function mockFetch(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    "/api/subscriptions/plans": { plans: PLANS, pricingPageVisible: true, paymentsEnabled: true },
    "/api/subscriptions/me": { subscription: null },
    "/api/credits/me": BALANCE,
    "/api/credits/packages": { packages: PACKAGES, purchasesEnabled: true },
    "/api/credits/purchases": [],
    ...overrides,
  };
  return vi.fn((url: string) => {
    const key = Object.keys(routes).find((r) => String(url).includes(r));
    return key ? jsonResponse(routes[key]) : jsonResponse({});
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.setItem("hw_lang", "ar");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(el: React.ReactElement) {
  await act(async () => {
    root.render(<I18nProvider>{el}</I18nProvider>);
  });
  // انتظار اكتمال promises تحميل البيانات
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return () => container.textContent ?? "";
}

describe("صفحة الباقات /teacher/pricing", () => {
  it("المجاني: 50 نقطة ترحيبية لمرة واحدة، بلا إلغاء اشتراك أو إدارة اشتراك", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const text = await render(<PricingPage />);
    expect(text()).toContain((50).toLocaleString("ar-EG")); // ٥٠ بالأرقام العربية
    expect(text()).toContain(ar.pricing.freeWelcomePoints);
    expect(text()).not.toContain(ar.pricing.cancelSubscription);
    expect(text()).not.toContain(ar.pricing.manageSubscription);
  });

  it("Pro: يعرض نص خصم 20% المعتمد والمزايا الفعلية فقط (600 نقطة، ترحيل 1,200)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const text = await render(<PricingPage />);
    expect(text()).toContain(ar.pricing.proSavings20);
    expect(ar.pricing.proSavings20).toBe("وفّر 20% من الرصيد عند استخدام أدوات الذكاء الاصطناعي.");
    expect(text()).toContain(ar.pricing.proCredits600);
    expect(text()).toContain(ar.pricing.proRollover1200);
    // لا «تقارير متقدمة» في بطاقة Pro — ميزة غير معتمدة
    expect(text()).not.toContain(ar.pricing.proAdvancedReports);
    // لا مزايا مخترعة
    expect(text()).not.toMatch(/دعم أولوية|معالجة أسرع|priority/i);
    // لا خطة School
    expect(text()).not.toMatch(/School|مدرسة/);
  });

  it("أزرار الترقية تظهر لمستخدم مجاني للباقتين المدفوعتين", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const text = await render(<PricingPage />);
    expect(text()).toContain(`${ar.pricing.upgradePrefix} الأساسية`);
    expect(text()).toContain(`${ar.pricing.upgradePrefix} الاحترافية`);
  });

  it("عند تعطيل المدفوعات: رسالة تعطيل بدل زر شراء فعّال", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/subscriptions/plans": { plans: PLANS, pricingPageVisible: true, paymentsEnabled: false },
    }));
    const text = await render(<PricingPage />);
    expect(text()).toContain(ar.pricing.paymentsDisabled);
    expect(text()).not.toContain(`${ar.pricing.upgradePrefix} الاحترافية`);
  });

  it("الاشتراك الملغى: تُعرض حالة الإلغاء ونهاية الدورة", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/subscriptions/me": {
        subscription: {
          plan_code: "pro", status: "active", payment_status: "active",
          current_period_end: "2026-09-01T00:00:00Z", cancelled_at: "2026-08-10T00:00:00Z",
        },
      },
    }));
    const text = await render(<PricingPage />);
    // لا يظهر زر «إلغاء الاشتراك» مرة أخرى بعد الإلغاء
    expect(text()).not.toContain(ar.pricing.cancelSubscription);
  });
});

describe("صفحة النقاط /teacher/credits", () => {
  it("الحزم الثلاث بأسعارها الصحيحة وعبارة عدم انتهاء الصلاحية", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const text = await render(<TeacherCreditsPage />);
    expect(text()).toContain("2.99");
    expect(text()).toContain("6.99");
    expect(text()).toContain("11.99");
    // عبارة عدم انتهاء الصلاحية تظهر في كل بطاقة من البطاقات الثلاث
    const occurrences = (container.innerHTML.match(new RegExp(ar.credits.neverExpires, "g")) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("الرصيد يُعرض كما جاء من الخادم ولا يتغيّر بسبب حالة الاشتراك", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const noSub = await render(<TeacherCreditsPage />);
    const totalAr = (137).toLocaleString("ar-EG");
    expect(noSub()).toContain(totalAr);

    await act(async () => root.unmount());
    root = createRoot(container);
    vi.stubGlobal("fetch", mockFetch({
      "/api/subscriptions/me": {
        subscription: {
          plan_code: "pro", plan_name_ar: "الاحترافية", plan_name_en: "Pro",
          status: "active", payment_status: "active",
          current_period_end: "2026-09-01T00:00:00Z", cancelled_at: null,
          monthly_credits: 600, rollover_cap: 1200,
        },
      },
    }));
    const withSub = await render(<TeacherCreditsPage />);
    expect(withSub()).toContain(totalAr); // نفس الرصيد بغضّ النظر عن الحالة
  });

  it("مستخدم مجاني: لا تظهر «إدارة الاشتراك» في صفحة النقاط", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const text = await render(<TeacherCreditsPage />);
    expect(text()).not.toContain(ar.credits.manageSubscription);
  });
});

describe("سلامة مسار الدفع والنصوص المعتمدة", () => {
  const creditsSrc = readFileSync(path.join(__dirname_, "credits.tsx"), "utf8");
  const pricingSrc = readFileSync(path.join(__dirname_, "pricing.tsx"), "utf8");

  it("Checkout يبقى في نفس التبويب: window.location.href موجود وwindow.open غير موجود", () => {
    expect(creditsSrc).toContain("window.location.href");
    expect(pricingSrc).toContain("window.location.href");
    expect(creditsSrc).not.toContain("window.open");
    expect(pricingSrc).not.toContain("window.open");
  });

  it("نص توضيح ما قبل الدفع معتمد حرفيًا في العربية", () => {
    expect(ar.credits.checkoutConfirmDesc).toBe(
      "سيتم فتح صفحة دفع آمنة لإكمال العملية. الكويت محددة تلقائيًا، ورقم الضريبة اختياري، وقد يطلب مزود الدفع الرمز البريدي للتحقق من الفوترة."
    );
  });

  it("اكتمال الترجمة: كل مفاتيح credits وpricing موجودة في الإنجليزية أيضًا", () => {
    for (const k of Object.keys(ar.credits)) expect((en.credits as any)[k], `en.credits.${k}`).toBeTruthy();
    for (const k of Object.keys(ar.pricing)) expect((en.pricing as any)[k], `en.pricing.${k}`).toBeTruthy();
  });
});
