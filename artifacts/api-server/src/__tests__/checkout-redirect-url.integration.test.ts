/**
 * اختبار تكاملي: redirect_url في payload Checkout
 *
 * السبب الجذري: createCheckout() في /credits/checkout كانت تُستدعى
 * بلا successUrl → product_options لم يُرسل لـ Lemon → المستخدم يُعاد
 * إلى "My Orders" بدل صفحة حصاد.
 *
 * يثبت الاختبار بدون استدعاء LS API الحقيقي (nock-style env stub +
 * تعويض fetch في بيئة Node) أن payload كل Checkout يتضمن
 * product_options.redirect_url الصحيح، وأن الواجهة تستخدم نفس التبويب.
 */
import { describe, it, expect, beforeAll, afterAll, vi, type MockInstance } from "vitest";

// ─── اختبار frontendOrigin() — لا يحتاج قاعدة بيانات ───────────────────────

describe("frontendOrigin() — يجرّد أي path زائد من FRONTEND_URL", () => {
  const backupFrontend = process.env.FRONTEND_URL;
  afterAll(() => restore("FRONTEND_URL", backupFrontend));

  it("يُرجع الأصل فقط عندما تحتوي FRONTEND_URL على /homework-app", async () => {
    process.env.FRONTEND_URL = "https://domain.replit.dev/homework-app";
    const { frontendOrigin } = await import("../lib/lemonsqueezy");
    expect(frontendOrigin()).toBe("https://domain.replit.dev");
  });

  it("يُرجع القيمة كما هي إذا كانت بلا path (الحالة النظيفة)", async () => {
    process.env.FRONTEND_URL = "https://domain.replit.dev";
    const { frontendOrigin } = await import("../lib/lemonsqueezy");
    expect(frontendOrigin()).toBe("https://domain.replit.dev");
  });

  it("يُرجع نصًا فارغًا إذا كانت FRONTEND_URL غير مضبوطة", async () => {
    delete process.env.FRONTEND_URL;
    const { frontendOrigin } = await import("../lib/lemonsqueezy");
    expect(frontendOrigin()).toBe("");
  });

  it("redirect_url الناتج لشراء النقاط لا يحتوي /homework-app عندما تكون FRONTEND_URL ملوثة", async () => {
    process.env.FRONTEND_URL = "https://domain.replit.dev/homework-app";
    const { frontendOrigin } = await import("../lib/lemonsqueezy");
    const url = `${frontendOrigin()}/teacher/credits?purchase=success`;
    expect(url).toBe("https://domain.replit.dev/teacher/credits?purchase=success");
    expect(url).not.toContain("/homework-app");
  });

  it("redirect_url الناتج للاشتراك لا يحتوي /homework-app عندما تكون FRONTEND_URL ملوثة", async () => {
    process.env.FRONTEND_URL = "https://domain.replit.dev/homework-app";
    const { frontendOrigin } = await import("../lib/lemonsqueezy");
    const url = `${frontendOrigin()}/teacher/credits?subscribed=1`;
    expect(url).toBe("https://domain.replit.dev/teacher/credits?subscribed=1");
    expect(url).not.toContain("/homework-app");
  });
});

// قيم بيئة تجريبية — تُسترجع في afterAll
const envBackup = {
  payments: process.env.PAYMENTS_ENABLED,
  apiKey: process.env.LEMON_SQUEEZY_API_KEY,
  storeId: process.env.LEMON_SQUEEZY_STORE_ID,
  webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
};
function restore(key: string, val: string | undefined) {
  if (val === undefined) delete process.env[key];
  else process.env[key] = val;
}

/** صورة payload الـ POST الذي يُرسله Checkout لـ LS API */
let capturedBody: any = null;

describe("Checkout redirect_url — payload unit tests (no real LS call)", () => {
  let fetchSpy: MockInstance | null = null;

  beforeAll(() => {
    process.env.PAYMENTS_ENABLED = "true";
    process.env.LEMON_SQUEEZY_API_KEY = "test-key-local";
    process.env.LEMON_SQUEEZY_STORE_ID = "999";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-secret-local";
    process.env.FRONTEND_URL = "https://example.hasad.app";

    // اعتراض fetch الخاصة بـ Node لمنع الاتصال الحقيقي بـ LS API
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      if (String(url).includes("api.lemonsqueezy.com/v1/checkouts")) {
        capturedBody = JSON.parse((init?.body as string) ?? "{}");
        return new Response(
          JSON.stringify({
            data: { attributes: { url: "https://pay.lemonsqueezy.com/test/fake-checkout-url" } },
          }),
          { status: 201, headers: { "Content-Type": "application/vnd.api+json" } }
        ) as any;
      }
      // ليست لـ LS — استدع الأصل
      return fetch(url as any, init as any);
    });
  });

  afterAll(() => {
    fetchSpy?.mockRestore();
    restore("PAYMENTS_ENABLED", envBackup.payments);
    restore("LEMON_SQUEEZY_API_KEY", envBackup.apiKey);
    restore("LEMON_SQUEEZY_STORE_ID", envBackup.storeId);
    restore("LEMON_SQUEEZY_WEBHOOK_SECRET", envBackup.webhookSecret);
    restore("FRONTEND_URL", envBackup.frontendUrl);
  });

  it("credits/checkout — payload يتضمن locale=en وredirect_url وcountry=KW وemail وname وcustom.user_id", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");
    capturedBody = null;
    const { checkoutUrl } = await createCheckout({
      variantId:  "2017706",
      successUrl: "https://example.hasad.app/teacher/credits?purchase=success",
      email:      "teacher@school.kw",
      name:       "أحمد الكويتي",
      customData: { user_id: "35", package_id: "1", purchase_intent_id: "uuid-test" },
    });

    const cd = capturedBody?.data?.attributes?.checkout_data;
    const po = capturedBody?.data?.attributes?.product_options;
    const co = capturedBody?.data?.attributes?.checkout_options;

    expect(checkoutUrl).toBe("https://pay.lemonsqueezy.com/test/fake-checkout-url");
    // locale في checkout_options يتجاوز لغة المتصفح وإعداد المتجر.
    expect(co?.locale).toBe("en");
    // redirect_url في product_options
    expect(po?.redirect_url).toBe("https://example.hasad.app/teacher/credits?purchase=success");
    // بيانات المعلم في checkout_data
    expect(cd?.email).toBe("teacher@school.kw");
    expect(cd?.name).toBe("أحمد الكويتي");
    // البلد في checkout_data.billing_address
    expect(cd?.billing_address?.country).toBe("KW");
    // custom user_id محفوظ
    expect(cd?.custom?.user_id).toBe("35");
    expect(cd?.custom?.package_id).toBe("1");
  });

  it("subscriptions/checkout payload — يثبت كل Checkout على Variant الاشتراك المختار فقط", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");

    const subscriptionVariants = ["2019526", "2019527", "2019525", "2092611"];
    for (const variantId of subscriptionVariants) {
      capturedBody = null;
      await createCheckout({
        variantId,
        restrictToVariant: true,
        compactSubscriptionCheckout: true,
        successUrl: `${process.env.FRONTEND_URL}/teacher/credits?subscribed=1`,
        email: "teacher@school.kw",
        name: "مريم المطيري",
        customData: { user_id: "42" },
      });

      const cd = capturedBody?.data?.attributes?.checkout_data;
      const po = capturedBody?.data?.attributes?.product_options;
      const co = capturedBody?.data?.attributes?.checkout_options;

      expect(co?.locale).toBe("en");
      expect(co).toMatchObject({
        media: false,
        logo: false,
        desc: false,
        discount: true,
        subscription_preview: true,
      });
      expect(po?.redirect_url).toBe("https://example.hasad.app/teacher/credits?subscribed=1");
      expect(po?.enabled_variants).toEqual([Number(variantId)]);
      expect(capturedBody?.data?.relationships?.variant?.data?.id).toBe(variantId);
      expect(cd?.billing_address?.country).toBe("KW");
      expect(cd?.custom?.user_id).toBe("42");
      expect(cd?.email).toBe("teacher@school.kw");
      expect(cd?.name).toBe("مريم المطيري");
      expect(cd?.custom?.package_id).toBeUndefined();
      expect(cd?.custom?.purchase_intent_id).toBeUndefined();
    }
  });

  it("بلا name/email — billing_address.country=KW يظل موجودًا و product_options غائب بلا successUrl", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");
    capturedBody = null;
    const origSuccess = process.env.LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL;
    delete process.env.LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL;

    await createCheckout({
      variantId:  "2017706",
      customData: { user_id: "35", package_id: "1", purchase_intent_id: "uuid-test" },
    });

    const cd = capturedBody?.data?.attributes?.checkout_data;
    expect(cd?.billing_address?.country).toBe("KW");
    expect(cd?.name).toBeUndefined();
    expect(cd?.email).toBeUndefined();
    expect(capturedBody?.data?.attributes?.product_options).toBeUndefined();
    restore("LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL", origSuccess);
  });
});

// ─── اختبار سلوك الواجهة (لا يحتاج قاعدة بيانات) ──────────────────────────

describe("واجهة Checkout — فتح نفس التبويب (لا window.open)", () => {
  it("طبقة Checkout المشتركة تستخدم window.location.href، وتستدعيها صفحة النقاط", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../../../");
    const [creditsSrc, checkoutSrc] = await Promise.all([
      fs.readFile(
      path.join(root, "artifacts/homework-app/src/pages/teacher/credits.tsx"),
      "utf8"
      ),
      fs.readFile(
        path.join(root, "artifacts/homework-app/src/lib/credits-checkout.ts"),
        "utf8"
      ),
    ]);
    // يجب أن يوجد window.location.href = checkoutUrl (أو assign)
    expect(checkoutSrc).toMatch(/window\.location\.(?:href|assign)\s*[\(=]/);
    expect(creditsSrc).toContain("beginCreditPackageCheckout");
    // يجب ألا يفتح النافذة في _blank بعد الحصول على checkoutUrl
    const openLines = checkoutSrc.split("\n").filter(
      (l) => l.includes("window.open") && l.includes("checkoutUrl")
    );
    expect(openLines.length).toBe(0);
  });

  it("طبقة Checkout المشتركة تستخدم window.location.href، وتستدعيها صفحة الباقات", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../../../");
    const [pricingSrc, checkoutSrc] = await Promise.all([
      fs.readFile(
      path.join(root, "artifacts/homework-app/src/pages/teacher/pricing.tsx"),
      "utf8"
      ),
      fs.readFile(
        path.join(root, "artifacts/homework-app/src/lib/credits-checkout.ts"),
        "utf8"
      ),
    ]);
    expect(checkoutSrc).toMatch(/window\.location\.(?:href|assign)\s*[\(=]/);
    expect(pricingSrc).toContain("beginSubscriptionCheckout");
    const openLines = checkoutSrc.split("\n").filter(
      (l) => l.includes("window.open") && l.includes("checkoutUrl")
    );
    expect(openLines.length).toBe(0);
  });
});
