/**
 * اختبارات وحدات نظام شراء الرصيد (Lemon Squeezy):
 * - ترتيب خصم الرصيد: مجاني ← مكتسب ← مدفوع
 * - تحقق HMAC من X-Signature على raw body (timing-safe)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { splitDeduction } from "../lib/credit-service";
import { verifySignature, lemonConfigured } from "../lib/lemonsqueezy";

describe("splitDeduction — ترتيب الخصم", () => {
  it("يخصم من المجاني أولاً", () => {
    expect(splitDeduction(10, { promo: 50, earned: 20, paid: 100 }))
      .toEqual({ promo: 10, earned: 0, paid: 0 });
  });

  it("يتجاوز للمكتسب عند نفاد المجاني", () => {
    expect(splitDeduction(30, { promo: 20, earned: 20, paid: 100 }))
      .toEqual({ promo: 20, earned: 10, paid: 0 });
  });

  it("يصل للمدفوع أخيراً فقط", () => {
    expect(splitDeduction(50, { promo: 10, earned: 15, paid: 100 }))
      .toEqual({ promo: 10, earned: 15, paid: 25 });
  });

  it("خصم كامل من المدفوع عندما لا يوجد رصيد مجاني", () => {
    expect(splitDeduction(40, { promo: 0, earned: 0, paid: 100 }))
      .toEqual({ promo: 0, earned: 0, paid: 40 });
  });

  it("يتعامل مع قيم سالبة في الجيوب كصفر", () => {
    expect(splitDeduction(10, { promo: -5, earned: 0, paid: 50 }))
      .toEqual({ promo: 0, earned: 0, paid: 10 });
  });

  it("مجموع الأجزاء يساوي المبلغ دائماً", () => {
    const cases = [
      [7,  { promo: 3, earned: 2, paid: 10 }],
      [100, { promo: 0, earned: 100, paid: 0 }],
      [1,  { promo: 1, earned: 0, paid: 0 }],
    ] as const;
    for (const [amount, buckets] of cases) {
      const s = splitDeduction(amount, buckets as any);
      expect(s.promo + s.earned + s.paid).toBe(amount);
    }
  });
});

describe("verifySignature — HMAC على raw body", () => {
  const SECRET = "test_webhook_secret_123";
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = originalSecret;
  });

  const sign = (body: Buffer, secret = SECRET) =>
    crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("يقبل التوقيع الصحيح", () => {
    const body = Buffer.from(JSON.stringify({ meta: { event_name: "order_created" } }));
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("يرفض التوقيع الخاطئ", () => {
    const body = Buffer.from("{}");
    expect(verifySignature(body, "deadbeef".repeat(8))).toBe(false);
  });

  it("يرفض توقيعاً صحيح الشكل لكن بسر مختلف", () => {
    const body = Buffer.from('{"a":1}');
    expect(verifySignature(body, sign(body, "wrong_secret"))).toBe(false);
  });

  it("يرفض عند تعديل الـ body بعد التوقيع", () => {
    const body = Buffer.from('{"amount":100}');
    const sig = sign(body);
    expect(verifySignature(Buffer.from('{"amount":999}'), sig)).toBe(false);
  });

  it("يرفض غياب الهيدر أو السر", () => {
    const body = Buffer.from("{}");
    expect(verifySignature(body, undefined)).toBe(false);
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    expect(verifySignature(body, sign(body))).toBe(false);
  });
});

describe("lemonConfigured", () => {
  it("false عند غياب أي متغير", () => {
    const saved = { ...process.env };
    delete process.env.LEMON_SQUEEZY_API_KEY;
    expect(lemonConfigured()).toBe(false);
    Object.assign(process.env, saved);
  });
});
