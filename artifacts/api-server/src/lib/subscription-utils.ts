/**
 * Shared subscription helpers.
 *
 * Kept in lib/ (not routes/) so both the webhook handler and integration tests
 * can import without creating circular or route→route dependencies.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Returns true if the subscription can still receive credits for an already
 * paid period. A cancel-at-period-end subscription remains entitled through
 * its recorded paid/current period end.
 *
 * Any other status — 'cancelled', 'canceled', 'expired', 'past_due', etc. —
 * causes this to return false, blocking credit grants in the webhook handler.
 *
 * Exported for:
 *   - routes/webhooks-lemonsqueezy.ts (guard inside handleSubscriptionPaymentSuccess)
 *   - src/__tests__/subscription-credits-integration.test.ts  (S10c)
 */
export async function checkEligibleForCreditGrant(
  externalSubId: string,
  periodEnd?: Date,
): Promise<boolean> {
  if (!externalSubId) return false;
  const rows = await db.execute(sql`
    SELECT status, current_period_end, paid_through FROM subscriptions
    WHERE external_subscription_id = ${externalSubId}
    LIMIT 1
  `);
  const sub = rows.rows[0] as any;
  if (!sub || sub.status === "expired") return false;
  if (sub.status === "active") return true;
  if (sub.status !== "canceled" && sub.status !== "cancelled") return false;
  const retainedThrough = sub.paid_through ?? sub.current_period_end;
  return !!retainedThrough && (!periodEnd || new Date(retainedThrough) >= periodEnd);
}
