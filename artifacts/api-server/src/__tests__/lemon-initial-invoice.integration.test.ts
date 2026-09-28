import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(async () => ({ delivered: true })),
  getAppBaseUrl: () => "https://test.local",
}));

const integration = !!process.env.TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const secret = "local-initial-invoice-test-secret";
const run = String(Date.now());
const subscriptionId = `sub_initial_${run}`;
const invoiceId = `invoice_initial_${run}`;
const mismatchInvoiceId = `${invoiceId}_mismatch`;
const orderId = `order_initial_${run}`;
const storeId = 500;
const customerId = 900;
const total = 1149;
const createdAt = new Date().toISOString();
const beforeSwitch = new Date(Date.now() + 30 * 86_400_000).toISOString();
const switchedAt = new Date(Date.now() + 45 * 86_400_000).toISOString();
const afterSwitch = new Date(Date.now() + 60 * 86_400_000).toISOString();
const oldRenewalId = `invoice_old_renewal_${run}`;
const newRenewalId = `invoice_new_renewal_${run}`;
const unknownRenewalId = `invoice_unknown_renewal_${run}`;
let teacherId = 0;
let variantId = "";
let nextVariantId = "";
let optionId = 0;
let createdOption = false;
let createdSecondOptionId = 0;
let providerStatus: "pending" | "paid" = "pending";
let providerCustomerId = customerId;
let providerVariant = "";
let providerUpdatedAt = createdAt;
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
    const secondOption = await db.execute(sql`
      SELECT o.lemon_variant_id FROM plan_billing_options o
      WHERE o.billing_interval = 'month' AND o.lemon_variant_id <> ${variantId} LIMIT 1
    `);
    if (secondOption.rows[0]) {
      nextVariantId = String((secondOption.rows[0] as any).lemon_variant_id);
    } else {
      const otherPlan = await db.execute(sql`SELECT id FROM plans WHERE code <> 'pro' LIMIT 1`);
      if (!otherPlan.rows[0]) throw new Error("Second plan missing from integration database");
      nextVariantId = `variant_renewal_${run}`;
      const added = await db.execute(sql`
        INSERT INTO plan_billing_options (plan_id, billing_interval, lemon_variant_id, price_minor)
        VALUES (${(otherPlan.rows[0] as any).id}, 'month', ${nextVariantId}, ${total}) RETURNING id
      `);
      createdSecondOptionId = Number((added.rows[0] as any).id);
    }
    providerVariant = variantId;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      let attributes: Record<string, unknown>;
      if (input.endsWith(`/subscription-invoices/${invoiceId}`)
        || input.endsWith(`/subscription-invoices/${mismatchInvoiceId}`)
        || input.endsWith(`/subscription-invoices/${oldRenewalId}`)
        || input.endsWith(`/subscription-invoices/${newRenewalId}`)
        || input.endsWith(`/subscription-invoices/${unknownRenewalId}`)) {
        const isRenewal = !input.endsWith(`/subscription-invoices/${invoiceId}`)
          && !input.endsWith(`/subscription-invoices/${mismatchInvoiceId}`);
        attributes = {
          subscription_id: subscriptionId, customer_id: providerCustomerId, store_id: storeId,
          status: isRenewal ? "paid" : providerStatus, total, currency: "USD", test_mode: false, refunded: false,
          refunded_amount: 0, created_at: input.endsWith(`/subscription-invoices/${oldRenewalId}`) ? beforeSwitch
            : input.endsWith(`/subscription-invoices/${newRenewalId}`) ? afterSwitch
            : input.endsWith(`/subscription-invoices/${unknownRenewalId}`) ? new Date(Date.parse(createdAt) - 86_400_000).toISOString()
            : createdAt, billing_reason: isRenewal ? "renewal" : "initial",
        };
      } else if (input.endsWith(`/subscriptions/${subscriptionId}`)) {
        attributes = { order_id: orderId, customer_id: customerId, store_id: storeId, test_mode: false,
          variant_id: providerVariant, updated_at: providerUpdatedAt };
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
    await db.execute(sql`DELETE FROM webhook_events WHERE provider_object_id IN
      (${subscriptionId}, ${invoiceId}, ${orderId}, ${mismatchInvoiceId}, ${oldRenewalId}, ${newRenewalId}, ${unknownRenewalId})`);
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
    if (createdSecondOptionId) {
      await db.execute(sql`DELETE FROM plan_billing_options WHERE id = ${createdSecondOptionId}`);
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
    const otherInvoice = mismatchInvoiceId;
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

  it("fails closed for an invoice older than the known history, without granting credits", async () => {
    providerCustomerId = customerId;
    const response = await post(webhook("subscription_payment_success", unknownRenewalId, {
      subscription_id: subscriptionId, status: "paid",
    }));
    expect(response.status).toBe(500);
    const failed = await db.execute(sql`SELECT status, error_message FROM webhook_events WHERE provider_object_id = ${unknownRenewalId}`);
    expect((failed.rows[0] as any).status).toBe("failed");
    expect((failed.rows[0] as any).error_message).toContain("no unambiguous dated plan");
    const { sendEmail } = await import("../lib/email");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: "حصاد: فاتورة اشتراك مدفوعة تحتاج مراجعة",
      text: expect.stringContaining(unknownRenewalId),
    }));
    const count = await db.execute(sql`SELECT COUNT(*)::int AS n FROM subscription_credit_entitlements WHERE teacher_id = ${teacherId}`);
    expect(Number((count.rows[0] as any).n)).toBe(1);
  });

  it("reconciles delayed renewals against the plan at invoice time, not today's variant; retries only once", async () => {
    providerVariant = nextVariantId;
    providerUpdatedAt = switchedAt;
    const newPayment = webhook("subscription_payment_success", newRenewalId, {
      subscription_id: subscriptionId, status: "paid",
    });
    expect((await post(newPayment)).status).toBe(500);
    const missingChange = await db.execute(sql`
      SELECT error_message FROM webhook_events WHERE provider_object_id = ${newRenewalId}
    `);
    expect((missingChange.rows[0] as any).error_message).toContain("missing plan change in history");
    const change = webhook("subscription_updated", subscriptionId, {
      variant_id: nextVariantId, customer_id: customerId, updated_at: switchedAt,
    });
    expect((await post(change)).status).toBe(200);
    const oldPayment = webhook("subscription_payment_success", oldRenewalId, {
      subscription_id: subscriptionId, status: "paid",
    });
    expect((await post(newPayment)).status).toBe(200);
    expect((await post(oldPayment)).status).toBe(200);
    expect((await post(oldPayment)).status).toBe(200);
    const result = await db.execute(sql`
      SELECT e.provider_invoice_id, e.plan_code, e.billing_interval, e.provider_order_id,
        COUNT(g.id)::int AS grants
      FROM subscription_credit_entitlements e
      LEFT JOIN subscription_credit_grants g ON g.entitlement_id = e.id
      WHERE e.teacher_id = ${teacherId} AND e.provider_invoice_id IN (${oldRenewalId}, ${newRenewalId})
      GROUP BY e.id ORDER BY e.provider_invoice_id
    `);
    expect(result.rows).toHaveLength(2);
    const oldPlan = await db.execute(sql`
      SELECT p.code FROM plan_billing_options o JOIN plans p ON p.id = o.plan_id
      WHERE o.lemon_variant_id = ${variantId}
    `);
    const newPlan = await db.execute(sql`
      SELECT p.code FROM plan_billing_options o JOIN plans p ON p.id = o.plan_id
      WHERE o.lemon_variant_id = ${nextVariantId}
    `);
    const byId = Object.fromEntries(result.rows.map((r: any) => [r.provider_invoice_id, r]));
    expect(byId[oldRenewalId].plan_code).toBe((oldPlan.rows[0] as any).code);
    expect(byId[newRenewalId].plan_code).toBe((newPlan.rows[0] as any).code);
    expect(byId[oldRenewalId].provider_order_id).toBeNull();
    expect(byId[oldRenewalId].grants).toBe(1);
    expect(byId[newRenewalId].grants).toBe(1);
    const projection = await db.execute(sql`SELECT current_period_end FROM subscriptions WHERE teacher_id = ${teacherId}`);
    expect(new Date((projection.rows[0] as any).current_period_end).toISOString())
      .toBe(new Date(new Date(afterSwitch).setUTCMonth(new Date(afterSwitch).getUTCMonth() + 1)).toISOString());
  }, 30_000);

  it("matches a refunded subscription order to its invoice entitlement", async () => {
    const refunded = webhook("order_refunded", orderId, { total, refunded_amount: total });
    expect((await post(refunded)).status).toBe(200);
    const record = await db.execute(sql`
      SELECT e.status, ca.subscription_balance FROM subscription_credit_entitlements e
      JOIN credit_accounts ca ON ca.teacher_id = e.teacher_id
      WHERE e.provider_invoice_id = ${invoiceId}
    `);
    expect((record.rows[0] as any).status).toBe("revoked");
    // Later renewal terms remain funded; refunding the initial order must
    // revoke only the initial invoice's entitlement.
    expect(Number((record.rows[0] as any).subscription_balance)).toBeGreaterThan(0);
  });
});