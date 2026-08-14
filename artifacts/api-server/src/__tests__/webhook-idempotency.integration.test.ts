/**
 * اختبارات تكاملية: دلالة idempotency في Lemon Squeezy webhooks
 *
 * تعمل فقط عبر `pnpm run test:integration` (setup-integration يوجّه DATABASE_URL
 * إلى TEST_DATABASE_URL). تُتخطى بأمان في تشغيل الـ mock الافتراضي.
 *
 * W1. subscription_created بـ variant غير معروف → 500 و status=failed (ليس processed)
 * W2. بعد تصحيح ربط الـ variant، إعادة نفس الحدث → يُعاد تشغيله ويخزّن external_subscription_id
 * W3. إعادة حدث ناجح (processed) → duplicate، لا يُنفَّذ مرة ثانية
 * W4. subscription_created الناجح لا يمنح أي نقاط
 * W5. subscription_payment_success بعد الربط → يمنح 250 نقطة Basic مرة واحدة فقط (التكرار لا يضاعف)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

// سرّ اختباري محلي لعملية الاختبار فقط — لا علاقة له بأي secret حقيقي
const TEST_WEBHOOK_SECRET = "test-webhook-secret-local-only";
const envBackup = {
  webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  apiKey: process.env.LEMON_SQUEEZY_API_KEY,
};
if (RUN_INTEGRATION) {
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  // تعطيل نداء LS API الحقيقي في fetchLSSubscriptionAttrs (يرجع null → fallback على renews_at من الـ payload)
  process.env.LEMON_SQUEEZY_API_KEY = "";
}

const RUN_ID = `wh${Date.now()}`;
const SUB_ID = `9${Date.now()}`.slice(0, 9);          // subscription id وهمي فريد
const INVOICE_ID = `8${Date.now()}`.slice(0, 9);      // invoice id وهمي فريد
const VARIANT_ID = `7${Date.now()}`.slice(0, 9);      // variant id وهمي فريد

function sign(body: string): string {
  return crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(Buffer.from(body)).digest("hex");
}

async function makeApp() {
  const { default: webhooksRouter } = await import("../routes/webhooks-lemonsqueezy");
  const app = express();
  app.use("/api/webhooks/lemonsqueezy", express.raw({ type: "*/*" }));
  app.use("/api", webhooksRouter);
  return app;
}

function subscriptionCreatedPayload(teacherId: number) {
  return JSON.stringify({
    meta: { event_name: "subscription_created", custom_data: { user_id: String(teacherId) } },
    data: {
      type: "subscriptions",
      id: SUB_ID,
      attributes: {
        variant_id: VARIANT_ID,
        customer_id: "555001",
        status: "active",
        renews_at: "2026-09-14T07:29:45.000000Z",
      },
    },
  });
}

function paymentSuccessPayload() {
  return JSON.stringify({
    meta: { event_name: "subscription_payment_success", custom_data: {} },
    data: {
      type: "subscription-invoices",
      id: INVOICE_ID,
      attributes: {
        subscription_id: SUB_ID,
        renews_at: "2026-09-14T07:29:45.000000Z",
        status: "paid",
      },
    },
  });
}

async function post(app: express.Express, body: string) {
  return request(app)
    .post("/api/webhooks/lemonsqueezy")
    .set("Content-Type", "application/json")
    .set("X-Signature", sign(body))
    .send(body);
}

async function eventRow(idempotencyKey: string) {
  const r = await db.execute(sql`
    SELECT status, attempts, error_message FROM webhook_events
    WHERE idempotency_key = ${idempotencyKey} LIMIT 1`);
  return r.rows[0] as any;
}

describe.skipIf(!RUN_INTEGRATION)("Lemon Squeezy webhook idempotency — route", () => {
  let teacherId = 0;
  let basicBackup: any = null;
  const createdKey = `lemonsqueezy:subscription_created:${SUB_ID}`;
  const paymentKey = `lemonsqueezy:subscription_payment_success:${INVOICE_ID}`;

  beforeAll(async () => {
    const t = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('WebhookT', ${`${RUN_ID}@test.local`}, 'x', false, NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);

    const basic = await db.execute(sql`
      SELECT id, lemon_variant_id FROM plans WHERE code = 'basic' LIMIT 1`);
    if (!basic.rows[0]) throw new Error("basic plan missing in test DB");
    basicBackup = basic.rows[0];
  });

  afterAll(async () => {
    // إعادة ربط basic كما كان
    if (basicBackup) {
      await db.execute(sql`
        UPDATE plans SET lemon_variant_id = ${basicBackup.lemon_variant_id} WHERE id = ${basicBackup.id}`);
    }
    await db.execute(sql`DELETE FROM webhook_events WHERE idempotency_key IN (${createdKey}, ${paymentKey})`);
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    // استرجاع متغيرات البيئة كما كانت
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = envBackup.webhookSecret;
    process.env.LEMON_SQUEEZY_API_KEY = envBackup.apiKey;
  });

  it("W1 — variant غير معروف → 500 و webhook_events.status = failed", async () => {
    const app = await makeApp();
    const res = await post(app, subscriptionCreatedPayload(teacherId));
    expect(res.status).toBe(500);

    const row = await eventRow(createdKey);
    expect(row).toBeTruthy();
    expect(row.status).toBe("failed");
    expect(String(row.error_message)).toContain("Variant غير معروف");

    // لم يُربط الاشتراك
    const sub = await db.execute(sql`
      SELECT external_subscription_id FROM subscriptions WHERE teacher_id = ${teacherId}`);
    expect(sub.rows.length).toBe(0);
  });

  it("W2 — بعد تصحيح الربط، إعادة نفس الحدث → processed ويخزّن external_subscription_id", async () => {
    // «تصحيح المسؤول»: ربط الـ variant الوهمي بخطة basic في قاعدة الاختبار
    await db.execute(sql`UPDATE plans SET lemon_variant_id = ${VARIANT_ID} WHERE id = ${basicBackup.id}`);

    const app = await makeApp();
    const res = await post(app, subscriptionCreatedPayload(teacherId));
    expect(res.status).toBe(200);

    const row = await eventRow(createdKey);
    expect(row.status).toBe("processed");
    expect(Number(row.attempts)).toBe(2);

    const sub = await db.execute(sql`
      SELECT s.external_subscription_id, p.code
      FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.teacher_id = ${teacherId}`);
    expect(sub.rows.length).toBe(1);
    expect((sub.rows[0] as any).external_subscription_id).toBe(SUB_ID);
    expect((sub.rows[0] as any).code).toBe("basic");
  });

  it("W3 — تكرار حدث ناجح → duplicate بلا إعادة تنفيذ", async () => {
    const app = await makeApp();
    const res = await post(app, subscriptionCreatedPayload(teacherId));
    expect(res.status).toBe(200);
    expect(String(res.body?.message ?? "")).toContain("duplicate");

    const row = await eventRow(createdKey);
    expect(row.status).toBe("processed");
    expect(Number(row.attempts)).toBe(2); // لم تزد — لم يُعاد التشغيل
  });

  it("W4 — subscription_created الناجح لا يمنح أي نقاط", async () => {
    const batches = await db.execute(sql`
      SELECT id FROM credit_batches WHERE teacher_id = ${teacherId}`);
    const grants = await db.execute(sql`
      SELECT id FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    expect(batches.rows.length).toBe(0);
    expect(grants.rows.length).toBe(0);
  });

  it("W5 — subscription_payment_success بعد الربط → 250 نقطة Basic مرة واحدة فقط", async () => {
    const app = await makeApp();

    const res1 = await post(app, paymentSuccessPayload());
    expect(res1.status).toBe(200);

    const grants1 = await db.execute(sql`
      SELECT credits_granted FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    expect(grants1.rows.length).toBe(1);
    expect(Number((grants1.rows[0] as any).credits_granted)).toBe(250);

    const batches1 = await db.execute(sql`
      SELECT amount FROM credit_batches WHERE teacher_id = ${teacherId}`);
    expect(batches1.rows.length).toBe(1);
    expect(Number((batches1.rows[0] as any).amount)).toBe(250);

    // تكرار نفس الحدث (نفس invoice) → duplicate على مستوى webhook_events، لا منح ثانٍ
    const res2 = await post(app, paymentSuccessPayload());
    expect(res2.status).toBe(200);

    const grants2 = await db.execute(sql`
      SELECT id FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    const batches2 = await db.execute(sql`
      SELECT id FROM credit_batches WHERE teacher_id = ${teacherId}`);
    expect(grants2.rows.length).toBe(1);
    expect(batches2.rows.length).toBe(1);
  });

  it("W6 — payload بعيب دائم (user_id مفقود) → 200 (إقرار) و status=failed بلا retry storm", async () => {
    const app = await makeApp();
    const badSubId = `6${Date.now()}`.slice(0, 9);
    const body = JSON.stringify({
      meta: { event_name: "subscription_created", custom_data: {} }, // بلا user_id
      data: { type: "subscriptions", id: badSubId, attributes: { variant_id: VARIANT_ID, status: "active" } },
    });
    const res = await post(app, body);
    expect(res.status).toBe(200); // إقرار — لا 500 يستدعي retry من LS
    expect(String(res.body?.message ?? "")).toContain("terminal");

    const row = await eventRow(`lemonsqueezy:subscription_created:${badSubId}`);
    expect(row.status).toBe("failed");
    expect(String(row.error_message)).toContain("user_id مفقود");
    await db.execute(sql`DELETE FROM webhook_events WHERE idempotency_key = ${`lemonsqueezy:subscription_created:${badSubId}`}`);
  });

  it("W7 — subscription_updated بـ variant غير معروف → failed retryable ولا تُمس الخطة", async () => {
    const app = await makeApp();
    const unknownVariant = `5${Date.now()}`.slice(0, 9);
    const updatedAt = "2026-08-14T08:00:00.000000Z";
    const body = JSON.stringify({
      meta: { event_name: "subscription_updated", custom_data: { user_id: String(teacherId) } },
      data: { type: "subscriptions", id: SUB_ID, attributes: { variant_id: unknownVariant, updated_at: updatedAt } },
    });
    const res = await post(app, body);
    expect(res.status).toBe(500); // retryable — بعد تصحيح الربط يُعاد تشغيله

    const key = `lemonsqueezy:subscription_updated:${SUB_ID}:${updatedAt}`;
    const row = await eventRow(key);
    expect(row.status).toBe("failed");

    // الخطة لم تتغير (لا تزال basic)
    const sub = await db.execute(sql`
      SELECT p.code FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.teacher_id = ${teacherId}`);
    expect((sub.rows[0] as any).code).toBe("basic");
    await db.execute(sql`DELETE FROM webhook_events WHERE idempotency_key = ${key}`);
  });
});
