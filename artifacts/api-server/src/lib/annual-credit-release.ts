import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreditService } from "./credit-service";
import { logger } from "./logger";

export function addOneCalendarMonth(date: Date): Date {
  return addCalendarMonthsUtc(date, 1);
}

/** UTC calendar arithmetic: clamp 31st/29th to the target month end. */
export function addCalendarMonthsUtc(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), maxDay),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

export function addCalendarYearsUtc(date: Date, years: number): Date {
  return addCalendarMonthsUtc(date, years * 12);
}

/** The same provider-subscription lock is used by payments, refunds and state handlers. */
export async function lockProviderSubscription(tx: any, subscriptionId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"provider-subscription:" + subscriptionId}))`);
}

/** Releases annual months from immutable paid-invoice snapshots, never current subscriptions. */
export async function releaseDueAnnualCredits(now = new Date()): Promise<number> {
  const due = await db.execute(sql`
    SELECT id, subscription_id FROM subscription_credit_entitlements
    WHERE billing_interval = 'year' AND status = 'active'
      AND release_through < period_end AND release_through <= ${now}
  `);
  let released = 0;
  for (const dueRow of due.rows as any[]) {
    await db.transaction(async (tx) => {
      // Global order: provider advisory lock first, then entitlement row lock.
      await lockProviderSubscription(tx, String((dueRow as any).subscription_id));
      const current = await tx.execute(sql`
        SELECT * FROM subscription_credit_entitlements WHERE id = ${Number(dueRow.id)} FOR UPDATE
      `);
      const e = current.rows[0] as any;
      if (!e || e.status !== "active") return;
      let releaseThrough = new Date(e.release_through);
      const periodEnd = new Date(e.period_end);
      while (releaseThrough < periodEnd) {
        const next = addOneCalendarMonth(releaseThrough);
        if (next > now) break;
        const cycleEnd = next > periodEnd ? periodEnd : next;
        const key = `annual:${e.provider_invoice_id}:${cycleEnd.toISOString()}`;
        // Lock remains held while this independently transactional credit grant runs.
        await CreditService.grantSubscriptionCredits(Number(e.teacher_id), String(e.plan_code), key,
          String(e.subscription_id), cycleEnd, addOneCalendarMonth(cycleEnd), key, {
            monthlyCredits: Number(e.monthly_credits_snapshot),
            rolloverCap: e.rollover_cap_snapshot == null ? null : Number(e.rollover_cap_snapshot),
            entitlementId: Number(e.id),
          });
        await tx.execute(sql`
          UPDATE subscription_credit_entitlements SET release_through = ${cycleEnd}, updated_at = NOW()
          WHERE id = ${Number(e.id)} AND status = 'active' AND release_through < ${cycleEnd}
        `);
        releaseThrough = cycleEnd;
        released++;
      }
    });
  }
  return released;
}

export function startAnnualCreditReleaseJob(): NodeJS.Timeout {
  const run = () => releaseDueAnnualCredits().catch((err) => logger.error(err, "annual credit release failed"));
  run();
  return setInterval(run, 60 * 60 * 1000);
}