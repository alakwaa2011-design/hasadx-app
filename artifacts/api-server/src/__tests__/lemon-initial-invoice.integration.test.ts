import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const integration = !!process.env.TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const secret = "local-initial-invoice-test-secret";
const run = String(Date.now());
const subscriptionId = `sub_initial_${run}`;
const invoiceId = `invoice_initial_${run}`;
const orderId = `order_initial_${run}`;
const storeId = 500;
const customerId = 900;
const total = 1149;
const createdAt = new Date().toISOString();
let teacherId = 0;
let variantId = "";
let optionId = 0;
let createdOption = false;
let providerStatus: "pending" | "paid" = "pending";
let providerCustomerId = customerId;
const originalKey = process.env.LEMON_SQUEEZY_API_KEY;
const originalSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

function webhook(eventName: string, id: string, attrs: Record<string, unknown>, customData: Record<string, string> = {}) {
  return JSON.stringify({
    meta: { event_name: eventName, custom_data: customData },
    data: { id, type: eventName.startsWith("subscription_payment") ? "subscription-invoices"
      : eventName.startsWith("order") ? "orders" : "subscriptions", attributes: attrs },
  });
}

describe.skipIf(!integration)("Lemon Squeezy initial paid invoice reconciliation", () => {
  let app: express.Express;

  async function post(body: string) {
    return request(app).post("/api/webhooks/lemonsqueezy")
      .set("Content-Type", "application/json")
      .set("X-Signature", crypto.createHmac("sha256", secret).update(body).digest("hex"))
      .send(body);
  }

  beforeAll(async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "local-provider-test-key";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = secret;
    const option = await db.execute(sql`
      SELECT o.id, o.lemon_variant_id FROM plan_billing_options o
      JOIN plans p ON p.id = o.plan_id WHERE p.code = 'pro' AND o.billing_interval = 'month' LIMIT 1
    `);
    if (option.rows[0]) {
      optionId = Number((option.rows[0] as any).id);
      variantId = String((option.rows[0] as any).lemon_variant_id);
    } else {
      const plan = await db.execute(sql`SELECT id FROM plans WHERE code = 'pro' LIMIT 1`);
      if (!plan.rows[0]) throw new Error("Pro plan missing from integration database");
      variantId = `variant_initial_${run}`;
      const inserted = await db.execute(sql`
        INSERT INTO plan_billing_options (plan_id, billing_interval, lemon_variant_id, price_minor)
        VALUES (${(plan.rows[0] as any).id}, 'month', ${variantId}, ${total})
        RETURNING id
      `);
      optionId = Number((inserted.rows[0] as any).id);
      createdOption = true;
    }
    const created = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, created_at)
      VALUES ('Initial Invoice Test', ${`initial_${run}@test.local`}, 'x', NOW()) RETURNING id
    `);
    teacherId = Number((created.rows[0] as any).id);
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      let attributes: Record<string, unknown>;
      if (input.endsWith(`/subscription-invoices/${invoiceId}`)
        || input.endsWith(`/subscription-invoices/${invoiceId}_mismatch`)) {
        attributes = {
          subscription_id: subscriptionId, customer_id: providerCustomerId, store_id: storeId,
          status: providerStatus, total, currency: "USD", test_mode: false, refunded: false,
          refunded_amount: 0, created_at: createdAt, billing_reason: "initial",
        };
      } else if (input.endsWith(`/subscriptions/${subscriptionId}`)) {
        attributes = { order_id: orderId, customer_id: customerId, store_id: storeId, test_mode: false };
      } else if (input.endsWith(`/orders/${orderId}`)) {
        attributes = {
          status: "paid", order_id: orderId, customer_id: customerId, store_id: storeId,
          total, currency: "USD", test_mode: false, refunded: false, refunded_amount: 0,
          first_order_item: { order_id: orderId, variant_id: variantId },
        };
      } else {
        throw new Error(`Unexpected provider request: ${input}`);
      }
      return new Response(JSON.stringify({ data: { attributes } }), { status: 200 });
    }));
    const { default: router } = await import("../routes/webhooks-lemonsqueezy");
    app = express();
    app.use("/api/webhooks/lemonsqueezy", express.raw({ type: "*/*" }));
    app.use("/api", router);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.LEMON_SQUEEZY_API_KEY;
    else process.env.LEMON_SQUEEZY_API_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = originalSecret;
    if (!teacherId) return;
    await db.execute(sql`DELETE FROM webhook_events WHERE provider_object_id IN (${subscriptionId}, ${invoiceId}, ${orderId})`);
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${teacherId})`);
    await db.execute(sql`DELETE FROM credit_holds WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_entitlements WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    if (createdOption) {
      await db.execute(sql`DELETE FROM plan_billing_options WHERE id = ${optionId}`);
    }
  });

  it("does not grant on subscription creation or its order; retries a paid invoice exactly once", async () => {
    const created = webhook("subscription_created", subscriptionId, {
      variant_id: variantId, customer_id: customerId, status: "active",
      renews_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), updated_at: createdAt,
    }, { user_id: String(teacherId) });
    expect((await post(created)).status).toBe(200);

    const order = webhook("order_created", orderId, {
      first_order_item: { variant_id: variantId }, customer_id: customerId, total, currency: "USD",
    }, { user_id: String(teacherId) });
    expect((await post(order)).status).toBe(200);
    const payment = webhook("subscription_payment_success", invoiceId, {
      subscription_id: subscriptionId, status: "paid",
    });
    expect((await post(payment)).status).toBe(500);
    const failedEvent = await db.execute(sql`
      SELECT id FROM webhook_events WHERE provider_object_id = ${invoiceId}
    `);
    const failedId = Number((failedEvent.rows[0] as any).id);
    providerStatus = "paid";
    const { default: adminRouter } = await import("../routes/credits-admin");
    const adminApp = express();
    adminApp.use((req, _res, next) => { (req as any).session = { teacherId }; next(); });
    adminApp.use("/api/admin/credits", adminRouter);
    const retryPath = `/api/admin/credits/webhook-events/${failedId}/retry`;
    expect((await request(adminApp).post(retryPath)).status).toBe(403);
    await db.execute(sql`UPDATE teachers SET is_admin = true WHERE id = ${teacherId}`);
    expect((await request(adminApp).post(retryPath)).status).toBe(200);
    expect((await request(adminApp).post(retryPath)).status).toBe(409);
    expect((await post(payment)).status).toBe(200);

    const record = await db.execute(sql`
      SELECT e.provider_order_id, e.status, g.credits_granted, ca.subscription_balance,
        w.status AS event_status, w.attempts
      FROM subscription_credit_entitlements e
      JOIN subscription_credit_grants g ON g.entitlement_id = e.id
      JOIN credit_accounts ca ON ca.teacher_id = e.teacher_id
      JOIN webhook_events w ON w.provider_object_id = e.provider_invoice_id
      WHERE e.teacher_id = ${teacherId}
    `);
    expect(record.rows).toHaveLength(1);
    const row = record.rows[0] as any;
    expect(row.provider_order_id).toBe(orderId);
    expect(row.status).toBe("active");
    expect(Number(row.credits_granted)).toBeGreaterThan(0);
    expect(Number(row.subscription_balance)).toBe(Number(row.credits_granted));
    expect(row.event_status).toBe("processed");
    expect(Number(row.attempts)).toBe(2);
  }, 30_000);

  it("rejects an invoice with mismatched provider customer without a second grant", async () => {
    const otherInvoice = `${invoiceId}_mismatch`;
    providerCustomerId = customerId + 1;
    // A second event pointing to the same subscription is not an initial
    // invoice: the provider read must fail closed before creating entitlement.
    const payment = webhook("subscription_payment_success", otherInvoice, {
      subscription_id: subscriptionId, status: "paid", created_at: createdAt,
      billing_reason: "initial",
    });
    expect((await post(payment)).status).toBe(500);
    const failed = await db.execute(sql`
      SELECT id, error_message FROM webhook_events WHERE provider_object_id = ${otherInvoice}
    `);
    expect(String((failed.rows[0] as any).error_message)).toContain("does not match paid invoice");
    const { retryStoredLemonInvoiceWebhook } = await import("../routes/webhooks-lemonsqueezy");
    await expect(retryStoredLemonInvoiceWebhook(Number((failed.rows[0] as any).id)))
      .rejects.toThrow("does not match paid invoice");
    const count = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM subscription_credit_grants WHERE teacher_id = ${teacherId}
    `);
    expect(Number((count.rows[0] as any).n)).toBe(1);
  });

  it("handles a subscription update without an optional variant", async () => {
    const updated = webhook("subscription_updated", subscriptionId, {
      customer_id: customerId, renews_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      updated_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect((await post(updated)).status).toBe(200);
  });

  it("matches a refunded subscription order to its invoice entitlement", async () => {
    const refunded = webhook("order_refunded", orderId, { total, refunded_amount: total });
    expect((await post(refunded)).status).toBe(200);
    const record = await db.execute(sql`
      SELECT e.status, ca.subscription_balance FROM subscription_credit_entitlements e
      JOIN credit_accounts ca ON ca.teacher_id = e.teacher_id
      WHERE e.provider_invoice_id = ${invoiceId}
    `);
    expect((record.rows[0] as any).status).toBe("revoked");
    expect(Number((record.rows[0] as any).subscription_balance)).toBe(0);
  });
});