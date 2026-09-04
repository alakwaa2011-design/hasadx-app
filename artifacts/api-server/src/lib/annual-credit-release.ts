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
  return new Date(Date.UTC(
    targetYear, targetMonth, Math.min(date.getUTCDate(), maxDay),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds(),
  ));
}

export function addCalendarYearsUtc(date: Date, years: number): Date {
  return addCalendarMonthsUtc(date, years * 12);
}

/** Releases overdue annual credit months. Idempotency is enforced by credit_cycle_key. */
export async function releaseDueAnnualCredits(now = new Date()): Promise<number> {
  const result = await db.execute(sql`
    SELECT s.teacher_id, s.external_subscription_id, s.release_through, s.paid_through, p.code
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.billing_interval = 'year'
      AND s.status IN ('active', 'canceled', 'cancelled')
      AND s.paid_through > s.release_through
      AND s.release_through <= NOW()
  `);
  let released = 0;
  for (const row of result.rows as any[]) {
    /* Serialize each subscription with a transaction-scoped advisory lock.
       CreditService owns its own transaction, so holding a row FOR UPDATE here
       would deadlock when it locks the subscription to grant the batch. */
    await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"annual-release:" + String(row.external_subscription_id)}))`);
    const locked = await tx.execute(sql`
      SELECT s.teacher_id, s.external_subscription_id, s.release_through, s.paid_through, p.code
      FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.external_subscription_id = ${String(row.external_subscription_id)}
        AND s.billing_interval = 'year'
        AND s.status IN ('active', 'canceled', 'cancelled')
    `);
    const claimed = locked.rows[0] as any;
    if (!claimed || !claimed.release_through || !claimed.paid_through) return;
    let cycleEnd = new Date(claimed.release_through);
    const paidThrough = new Date(claimed.paid_through);
    while (cycleEnd < paidThrough) {
      const next = addOneCalendarMonth(cycleEnd);
      if (next > now) break;
      const end = next > paidThrough ? paidThrough : next;
      const key = `annual:${row.external_subscription_id}:${end.toISOString()}`;
      await CreditService.grantSubscriptionCredits(
        Number(claimed.teacher_id), String(claimed.code), key, String(claimed.external_subscription_id),
        end, addOneCalendarMonth(end), key,
      );
      await db.execute(sql`
        UPDATE subscriptions SET release_through = ${end}, updated_at = NOW()
        WHERE external_subscription_id = ${String(claimed.external_subscription_id)}
          AND (release_through IS NULL OR release_through < ${end})
      `);
      cycleEnd = end;
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