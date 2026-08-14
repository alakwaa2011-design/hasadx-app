/**
 * Lemon Squeezy integration — server-side only.
 *
 * - createCheckout: يُنشئ Checkout عبر API باستخدام بيانات الباقة من قاعدة
 *   البيانات فقط (المتصفح لا يرسل سعراً أو رصيداً أبداً).
 * - verifySignature: تحقق HMAC-SHA256 من X-Signature على الـ raw body
 *   بمقارنة timing-safe.
 *
 * Env vars (بدون بادئة VITE_ — لا تصل للمتصفح):
 *   LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID,
 *   LEMON_SQUEEZY_WEBHOOK_SECRET, LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL
 */
import crypto from "crypto";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export function lemonConfigured(): boolean {
  return Boolean(
    process.env.LEMON_SQUEEZY_API_KEY &&
    process.env.LEMON_SQUEEZY_STORE_ID &&
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
  );
}

export interface CheckoutCustomData {
  user_id: string;
  package_id: string;
  purchase_intent_id: string;
}

export async function createCheckout(opts: {
  variantId: string;
  customData: CheckoutCustomData;
  email?: string | null;
  name?: string | null;
  successUrl?: string | null;
}): Promise<{ checkoutUrl: string }> {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
  if (!apiKey || !storeId) throw new Error("Lemon Squeezy غير مُهيأ");

  const successUrl = opts.successUrl ?? process.env.LEMON_SQUEEZY_CHECKOUT_SUCCESS_URL;

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          // بيانات المعلم تملأ الحقول مسبقًا (قابلة للتعديل في صفحة الدفع)
          ...(opts.email ? { email: opts.email } : {}),
          ...(opts.name  ? { name: opts.name }   : {}),
          // تحديد الكويت مسبقًا لتقليل الإدخال اليدوي — لا يُخفي حقولًا إلزامية
          billing_address: { country: "KW" },
          custom: opts.customData,
        },
        ...(successUrl ? { product_options: { redirect_url: successUrl } } : {}),
      },
      relationships: {
        store:   { data: { type: "stores",   id: String(storeId) } },
        variant: { data: { type: "variants", id: String(opts.variantId) } },
      },
    },
  };

  const resp = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout failed (${resp.status}): ${text.slice(0, 500)}`);
  }

  const json: any = await resp.json();
  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy لم يُرجع رابط Checkout");
  return { checkoutUrl: url };
}

/** تحقق HMAC-SHA256 timing-safe من توقيع X-Signature على الـ raw body. */
export function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = Buffer.from(signatureHeader, "utf8");
  const expected = Buffer.from(digest, "utf8");
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(sig, expected);
}
