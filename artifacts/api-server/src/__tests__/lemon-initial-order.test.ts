import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyLemonInitialOrder } from "../lib/lemon-initial-order";

describe("provider-verified initial subscription order", () => {
  const signed = { order_id: 22, store_id: 33, customer_id: 44, test_mode: false };
  let sub: any, order: any, invoices: any;
  beforeEach(() => {
    vi.stubEnv("LEMON_SQUEEZY_API_KEY", "unit-test-only");
    sub = { ...signed, status: "active", created_at: "2026-10-06T07:41:42Z", trial_ends_at: null };
    order = { ...signed, status: "paid", total: 1149, currency: "USD",
      created_at: sub.created_at, first_order_item: { order_id: 22, variant_id: 55, quantity: 1 } };
    invoices = { data: [], meta: { page: { total: 0 } } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith("/subscription-invoices") ? invoices
        : { data: { id: url.includes("/orders/") ? "22" : "11",
          attributes: url.includes("/orders/") ? order : sub } },
    ), { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("accepts a verified paid order only when no initial invoice exists", async () => {
    const evidence = await verifyLemonInitialOrder("11", signed);
    expect(evidence.invoiceId).toBeNull();
    expect(evidence.orderId).toBe("22");
    expect(evidence.variantId).toBe("55");
    expect(evidence.attrs.subscription_id).toBe("11");
  });
  it.each([
    ["unpaid", () => { order.status = "pending"; }],
    ["refunded", () => { order.refunded_amount = 1; }],
    ["test payment", () => { order.test_mode = true; }],
    ["customer mismatch", () => { order.customer_id = 999; }],
    ["store mismatch", () => { order.store_id = 999; }],
    ["wrong order item", () => { order.first_order_item.order_id = 999; }],
    ["multiple seats", () => { order.first_order_item.quantity = 2; }],
    ["missing date", () => { delete order.created_at; }],
    ["unrelated old order", () => { order.created_at = "2025-01-01T00:00:00Z"; }],
    ["trial", () => { sub.trial_ends_at = "2026-11-01T00:00:00Z"; }],
    ["zero payment", () => { order.total = 0; }],
    ["renewal history", () => { invoices = { data: [{ id: "66", attributes: { billing_reason: "renewal" } }] }; }],
  ] as const)("refuses %s without fabricating a paid invoice", async (_name, alter) => {
    alter();
    await expect(verifyLemonInitialOrder("11", signed)).rejects.toThrow();
  });
  it("prefers an actual initial paid invoice", async () => {
    invoices = { data: [{ id: "66", attributes: { billing_reason: "initial", status: "paid", subscription_id: 11 } }] };
    expect((await verifyLemonInitialOrder("11", signed)).invoiceId).toBe("66");
  });
  it("refuses provider outages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(verifyLemonInitialOrder("11", signed)).rejects.toThrow();
  });
});
