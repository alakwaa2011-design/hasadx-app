/**
 * Shared subscription helpers.
 *
 * Kept in lib/ (not routes/) so both the webhook handler and integration tests
 * can import without creating circular or route→route dependencies.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Returns true if the subscription (identified by the Lemon Squeezy
 * external_subscription_id) has status='active' and is eligible to receive
 * new credit grants.
 *
 * Any other status — 'cancelled', 'canceled', 'expired', 'past_due', etc. —
 * causes this to return false, blocking credit grants in the webhook handler.
 *
 * Exported for:
 *   - routes/webhooks-lemonsqueezy.ts (guard inside handleSubscriptionPaymentSuccess)
 *   - src/__tests__/subscription-credits-integration.test.ts  (S10c)
 */
export async function checkEligibleForCreditGrant(
  externalSubId: string
): Promise<boolean> {
  if (!externalSubId) return false;
  const rows = await db.execute(sql`
    SELECT status FROM subscriptions
    WHERE external_subscription_id = ${externalSubId}
    LIMIT 1
  `);
  const status = (rows.rows[0] as any)?.status;
  return status === "active";
}
