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

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

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

describe.skipIf(!RUN_INTEGRATION)("Checkout redirect_url — payload unit tests (no real LS call)", () => {
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

  it("credits/checkout — payload يتضمن product_options.redirect_url صحيحًا لشراء النقاط", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");
    capturedBody = null;
    const { checkoutUrl } = await createCheckout({
      variantId: "2017706",
      successUrl: "https://example.hasad.app/teacher/credits?purchase=success",
      customData: { user_id: "35", package_id: "1", purchase_intent_id: "uuid-test" },
    });

    expect(checkoutUrl).toBe("https://pay.lemonsqueezy.com/test/fake-checkout-url");
    expect(capturedBody?.data?.attributes?.product_options?.redirect_url).toBe(
      "https://example.hasad.app/teacher/credits?purchase=success"
    );
  });

  it("subscriptions/checkout payload — redirect_url يشير إلى ?subscribed=1", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");
    capturedBody = null;
    await createCheckout({
      variantId: "2017681",
      successUrl: `${process.env.FRONTEND_URL}/teacher/credits?subscribed=1`,
      customData: { user_id: "35", package_id: "", purchase_intent_id: "" },
    });

    expect(capturedBody?.data?.attributes?.product_options?.redirect_url).toBe(
      "https://example.hasad.app/teacher/credits?subscribed=1"
    );
  });

  it("redirect_url غائب عند عدم إرسال successUrl → الكائن خالٍ من product_options", async () => {
    const { createCheckout } = await import("../lib/lemonsqueezy");
    capturedBody = null;
    const origSuccess = process.env.LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL;
    delete process.env.LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL;

    await createCheckout({
      variantId: "2017706",
      customData: { user_id: "35", package_id: "1", purchase_intent_id: "uuid-test" },
    });

    expect(capturedBody?.data?.attributes?.product_options).toBeUndefined();
    restore("LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL", origSuccess);
  });
});

// ─── اختبار سلوك الواجهة (لا يحتاج قاعدة بيانات) ──────────────────────────

describe("واجهة Checkout — فتح نفس التبويب (لا window.open)", () => {
  it("credits.tsx: يستخدم window.location.href لا window.open لفتح Checkout", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../../../");
    const src = await fs.readFile(
      path.join(root, "artifacts/homework-app/src/pages/teacher/credits.tsx"),
      "utf8"
    );
    // يجب أن يوجد window.location.href = checkoutUrl (أو assign)
    expect(src).toMatch(/window\.location\.(?:href|assign)\s*[\(=]/);
    // يجب ألا يفتح النافذة في _blank بعد الحصول على checkoutUrl
    const openLines = src.split("\n").filter(
      (l) => l.includes("window.open") && l.includes("checkoutUrl")
    );
    expect(openLines.length).toBe(0);
  });

  it("pricing.tsx: يستخدم window.location.href لا window.open لفتح Checkout الاشتراك", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "../../../../");
    const src = await fs.readFile(
      path.join(root, "artifacts/homework-app/src/pages/teacher/pricing.tsx"),
      "utf8"
    );
    expect(src).toMatch(/window\.location\.(?:href|assign)\s*[\(=]/);
    const openLines = src.split("\n").filter(
      (l) => l.includes("window.open") && l.includes("checkoutUrl")
    );
    expect(openLines.length).toBe(0);
  });
});
