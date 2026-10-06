/**
 * Provider-verified initial order evidence, not a fabricated subscription invoice.
 * Callers must establish the account from a signature-verified subscription event.
 */
export async function verifyLemonInitialOrder(subscriptionId: string, signed: Record<string, any>) {
  const read = async (path: string) => {
    const key = process.env.LEMON_SQUEEZY_API_KEY;
    if (!key) throw new Error("Lemon provider credentials unavailable");
    const response = await fetch(`https://api.lemonsqueezy.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Initial payment provider lookup failed; retry required");
    return await response.json() as { data?: any; meta?: { page?: { total?: number } } };
  };
  if (!/^\d+$/.test(subscriptionId)) throw new Error("Invalid provider subscription identity");
  const subscription = await read(`subscriptions/${subscriptionId}`);
  const sub = subscription.data?.attributes;
  if (String(subscription.data?.id) !== subscriptionId || !sub?.order_id
    || !["active", "cancelled"].includes(sub.status) || sub.trial_ends_at != null
    || sub.test_mode !== false || !sub.store_id || !sub.customer_id
    || signed.test_mode !== false
    || String(signed.store_id) !== String(sub.store_id)
    || String(signed.customer_id) !== String(sub.customer_id)
    || String(signed.order_id) !== String(sub.order_id)) {
    throw new Error("Initial payment subscription identity mismatch");
  }
  const orderId = String(sub.order_id);
  if (!/^\d+$/.test(orderId)) throw new Error("Invalid provider order identity");
  const orderResponse = await read(`orders/${orderId}`);
  const order = orderResponse.data?.attributes;
  const createdAt = new Date(order?.created_at);
  const subscriptionCreatedAt = new Date(sub.created_at);
  if (String(orderResponse.data?.id) !== orderId
    || order?.status !== "paid" || order.refunded === true || Number(order.refunded_amount ?? 0) !== 0
    || order.test_mode !== false || Number(order.total) <= 0 || !Number.isFinite(Number(order.total))
    || !order.currency || String(order.store_id) !== String(sub.store_id)
    || String(order.customer_id) !== String(sub.customer_id)
    || !order.first_order_item?.variant_id
    || String(order.first_order_item.order_id) !== orderId
    || Number(order.first_order_item.quantity) !== 1
    || !Number.isFinite(createdAt.getTime()) || !Number.isFinite(subscriptionCreatedAt.getTime())
    || Math.abs(createdAt.getTime() - subscriptionCreatedAt.getTime()) > 5 * 60_000) {
    throw new Error("Initial order is not a verified, unrefunded single-subscription payment");
  }
  const invoices = await read(`subscriptions/${subscriptionId}/subscription-invoices`);
  if (!Array.isArray(invoices.data)) throw new Error("Provider invoice collection unavailable");
  const initial = invoices.data.find((invoice: any) =>
    ["initial", "subscription_created"].includes(invoice.attributes?.billing_reason));
  if (initial) {
    if (initial.attributes?.status !== "paid"
      || String(initial.attributes.subscription_id) !== subscriptionId) throw new Error("Initial invoice is not paid or belongs to another subscription");
    return { invoiceId: String(initial.id), orderId, variantId: String(order.first_order_item.variant_id), attrs: initial.attributes };
  }
  if (invoices.data.length || Number(invoices.meta?.page?.total ?? 0) > 0) {
    throw new Error("Existing invoices require historical invoice review; order recovery refused");
  }
  return {
    invoiceId: null, orderId, variantId: String(order.first_order_item.variant_id),
    attrs: { ...order, subscription_id: subscriptionId, billing_reason: "initial" },
  };
}
