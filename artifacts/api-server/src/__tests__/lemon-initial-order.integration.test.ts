import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(async () => ({ delivered: false, reason: "test mail disabled" })),
  getAppBaseUrl: () => "https://test.local",
}));

const integration = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
describe.skipIf(!integration)("initial paid order recovery accounting", () => {
  const run = String(Date.now());
  const subId = `8${run}`;
  const orderId = `9${run}`;
  const invoiceId = `invoice_order_recovery_${run}`;
  const secret = "initial-order-integration-only";
  const createdAt = new Date().toISOString();
  let teacherId = 0, variantId = "", monthlyCredits = 0;
  let createdOptionId = 0;
  let app: express.Express, adminApp: express.Express;
  let providerRefunded = false;
  let invoiceExists = false;
  const provider = { order_id: orderId, customer_id: 987, store_id: 654,
    test_mode: false, created_at: createdAt, updated_at: createdAt };
  const payment = { subscription_id: subId, customer_id: 987, store_id: 654,
    test_mode: false, status: "paid", total: 1149, currency: "USD",
    refunded: false, refunded_amount: 0, billing_reason: "initial", created_at: createdAt };
  const body = () => JSON.stringify({ meta: { event_name: "subscription_created", custom_data: { user_id: String(teacherId) } },
    data: { id: subId, type: "subscriptions", attributes: { ...provider, variant_id: variantId,
      status: "active", renews_at: new Date(Date.now() + 30 * 86400000).toISOString() } } });
  async function post(raw: string) {
    return request(app).post("/api/webhooks/lemonsqueezy").set("Content-Type", "application/json")
      .set("X-Signature", crypto.createHmac("sha256", secret).update(raw).digest("hex")).send(raw);
  }
  beforeAll(async () => {
    vi.stubEnv("LEMON_SQUEEZY_API_KEY", "integration-only");
    vi.stubEnv("LEMON_SQUEEZY_WEBHOOK_SECRET", secret);
    const plans = await db.execute(sql`
      SELECT o.lemon_variant_id, p.monthly_credits FROM plan_billing_options o
      JOIN plans p ON p.id=o.plan_id WHERE p.code='pro' AND o.billing_interval='month' LIMIT 1
    `);
    if (plans.rows[0]) {
      variantId = String((plans.rows[0] as any).lemon_variant_id);
      monthlyCredits = Number((plans.rows[0] as any).monthly_credits);
    } else {
      const pro = (await db.execute(sql`SELECT id, monthly_credits FROM plans WHERE code='pro' LIMIT 1`)).rows[0] as any;
      if (!pro) throw new Error("Pro plan required in test seeds");
      variantId = `initial_order_variant_${run}`;
      monthlyCredits = Number(pro.monthly_credits);
      const option = (await db.execute(sql`
        INSERT INTO plan_billing_options (plan_id,billing_interval,lemon_variant_id,price_minor)
        VALUES (${pro.id},'month',${variantId},999) RETURNING id
      `)).rows[0] as any;
      createdOptionId = Number(option.id);
    }
    const teacher = await db.execute(sql`
      INSERT INTO teachers (name,email,password_hash,is_admin)
      VALUES ('Initial Order Fixture', ${`initial_order_${run}@test.local`}, 'x', TRUE) RETURNING id
    `);
    teacherId = Number((teacher.rows[0] as any).id);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const invoice = { id: invoiceId, attributes: payment };
      if (url.endsWith(`/subscriptions/${subId}/subscription-invoices`)) {
        return new Response(JSON.stringify({ data: invoiceExists ? [invoice] : [], meta: { page: { total: invoiceExists ? 1 : 0 } } }));
      }
      const attrs = url.endsWith(`/subscriptions/${subId}`)
        ? { ...provider, status: "active", trial_ends_at: null, variant_id: variantId }
        : url.endsWith(`/orders/${orderId}`)
          ? { ...provider, status: "paid", total: 1149, currency: "USD", refunded_amount: providerRefunded ? 1149 : 0,
            first_order_item: { order_id: orderId, variant_id: variantId, quantity: 1 } }
          : url.endsWith(`/subscription-invoices/${invoiceId}`) ? payment : null;
      if (!attrs) throw new Error(`Unexpected provider lookup ${url}`);
      return new Response(JSON.stringify({ data: { id: url.split("/").pop(), attributes: attrs } }));
    }));
    const { default: webhookRouter } = await import("../routes/webhooks-lemonsqueezy");
    const { default: adminRouter } = await import("../routes/credits-admin");
    app = express();
    app.use("/api/webhooks/lemonsqueezy", express.raw({ type: "*/*" }));
    app.use("/api", webhookRouter);
    adminApp = express();
    adminApp.use((req, _res, next) => { (req as any).session = { teacherId }; next(); });
    adminApp.use("/api/admin/credits", adminRouter);
  });
  afterAll(async () => {
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
    if (!teacherId) return;
    await db.execute(sql`DELETE FROM webhook_events WHERE provider_object_id IN (${subId},${invoiceId},${orderId})`);
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_entitlements WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id=${teacherId}`);
    if (createdOptionId) await db.execute(sql`DELETE FROM plan_billing_options WHERE id=${createdOptionId}`);
  });
  async function accounting() {
    return (await db.execute(sql`
      SELECT (SELECT COUNT(*)::int FROM subscription_credit_entitlements WHERE teacher_id=${teacherId}) AS entitlements,
        (SELECT COUNT(*)::int FROM subscription_credit_grants WHERE teacher_id=${teacherId}) AS grants,
        (SELECT subscription_balance FROM credit_accounts WHERE teacher_id=${teacherId}) AS balance
    `)).rows[0] as any;
  }
  async function clearFixturePayment() {
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id=${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_entitlements WHERE teacher_id=${teacherId}`);
    await db.execute(sql`UPDATE credit_accounts SET balance=0,subscription_balance=0 WHERE teacher_id=${teacherId}`);
    await db.execute(sql`UPDATE subscriptions SET last_credited_period_end=NULL,paid_through=NULL WHERE teacher_id=${teacherId}`);
  }
  it("automatically grants the paid initial order even without a provider invoice", async () => {
    expect((await post(body())).status).toBe(200);
    expect(await accounting()).toEqual({ entitlements: 1, grants: 1, balance: monthlyCredits });
    const receipt = (await db.execute(sql`
      SELECT provider_invoice_id, provider_order_id FROM subscription_credit_entitlements WHERE teacher_id=${teacherId}
    `)).rows[0] as any;
    expect(receipt.provider_invoice_id).toBe(`initial-order:${orderId}`);
    expect(receipt.provider_order_id).toBe(orderId);
  });
  it("serializes concurrent admin recoveries and does not grant the same order again", async () => {
    const event = (await db.execute(sql`SELECT id FROM webhook_events WHERE provider_object_id=${subId}`)).rows[0] as any;
    const path = `/api/admin/credits/webhook-events/${event.id}/retry`;
    const results = await Promise.all([request(adminApp).post(path), request(adminApp).post(path)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(await accounting()).toEqual({ entitlements: 1, grants: 1, balance: monthlyCredits });
    await db.execute(sql`UPDATE teachers SET is_admin=FALSE WHERE id=${teacherId}`);
    expect((await request(adminApp).post(path)).status).toBe(403);
    await db.execute(sql`UPDATE teachers SET is_admin=TRUE WHERE id=${teacherId}`);
  });
  it("recovers a legacy processed subscription event whose paid points were never granted", async () => {
    await clearFixturePayment();
    const event = (await db.execute(sql`SELECT id,status FROM webhook_events WHERE provider_object_id=${subId}`)).rows[0] as any;
    expect(event.status).toBe("processed");
    expect((await request(adminApp).post(`/api/admin/credits/webhook-events/${event.id}/retry`)).status).toBe(200);
    expect(await accounting()).toEqual({ entitlements: 1, grants: 1, balance: monthlyCredits });
    const audit = (await db.execute(sql`SELECT review_evidence FROM webhook_events WHERE id=${event.id}`)).rows[0] as any;
    expect(audit.review_evidence.initialOrderPayment.orderId).toBe(orderId);
    expect(audit.review_evidence.adminId).toBe(teacherId);
  });
  it("ignores a late paid initial invoice and a later recovery without duplicating credits", async () => {
    invoiceExists = true;
    const raw = JSON.stringify({ meta: { event_name: "subscription_payment_success" },
      data: { id: invoiceId, type: "subscription-invoices", attributes: payment } });
    expect((await post(raw)).status).toBe(200);
    const event = (await db.execute(sql`SELECT id FROM webhook_events WHERE provider_object_id=${subId}`)).rows[0] as any;
    expect((await request(adminApp).post(`/api/admin/credits/webhook-events/${event.id}/retry`)).status).toBe(200);
    expect(await accounting()).toEqual({ entitlements: 1, grants: 1, balance: monthlyCredits });
  });
  it("uses an existing real invoice on recovery rather than creating a second order receipt", async () => {
    await clearFixturePayment();
    const event = (await db.execute(sql`SELECT id FROM webhook_events WHERE provider_object_id=${subId}`)).rows[0] as any;
    expect((await request(adminApp).post(`/api/admin/credits/webhook-events/${event.id}/retry`)).status).toBe(200);
    expect(await accounting()).toEqual({ entitlements: 1, grants: 1, balance: monthlyCredits });
    const receipt = (await db.execute(sql`
      SELECT provider_invoice_id FROM subscription_credit_entitlements WHERE teacher_id=${teacherId}
    `)).rows[0] as any;
    expect(receipt.provider_invoice_id).toBe(invoiceId);
    expect((await request(adminApp).post(`/api/admin/credits/webhook-events/${event.id}/retry`)).status).toBe(200);
    expect((await accounting()).grants).toBe(1);
  });
  it("revokes only the initial order's entitlement and refuses recovery after refund", async () => {
    const raw = JSON.stringify({ meta: { event_name: "order_refunded" },
      data: { id: orderId, type: "orders", attributes: { total: 1149, refunded_amount: 1149 } } });
    expect((await post(raw)).status).toBe(200);
    providerRefunded = true;
    const event = (await db.execute(sql`SELECT id FROM webhook_events WHERE provider_object_id=${subId}`)).rows[0] as any;
    expect((await request(adminApp).post(`/api/admin/credits/webhook-events/${event.id}/retry`)).status).toBe(500);
    expect((await accounting()).balance).toBe(0);
    expect((await accounting()).grants).toBe(1);
  });
});
