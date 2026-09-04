import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreditService } from "../lib/credit-service";
import { addOneCalendarMonth, releaseDueAnnualCredits } from "../lib/annual-credit-release";

const available = typeof (db as any).execute === "function";
const suite = available ? describe : describe.skip;
const run = `annual_${Date.now()}`;
let teacherId = 0;
let planId = 0;
const subId = `sub_${run}`;

suite("annual subscription credit releases", () => {
  beforeAll(async () => {
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'month', ADD COLUMN IF NOT EXISTS paid_through TIMESTAMP, ADD COLUMN IF NOT EXISTS release_through TIMESTAMP`);
    await db.execute(sql`ALTER TABLE subscription_credit_grants ADD COLUMN IF NOT EXISTS credit_cycle_key TEXT`);
    await db.execute(sql`ALTER TABLE subscription_credit_grants ADD COLUMN IF NOT EXISTS entitlement_id INTEGER`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS scg_credit_cycle_uniq ON subscription_credit_grants(credit_cycle_key)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_credit_entitlements (
        id SERIAL PRIMARY KEY, provider_invoice_id TEXT NOT NULL UNIQUE, subscription_id TEXT NOT NULL,
        provider_order_id TEXT, teacher_id INTEGER NOT NULL, plan_code TEXT NOT NULL,
        monthly_credits_snapshot INTEGER NOT NULL DEFAULT 250, rollover_cap_snapshot INTEGER,
        billing_interval TEXT NOT NULL, period_start TIMESTAMP NOT NULL, period_end TIMESTAMP NOT NULL,
        release_through TIMESTAMP NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        provider_event_at TIMESTAMP, refund_review_status TEXT NOT NULL DEFAULT 'none', refund_review_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
    await db.execute(sql`ALTER TABLE subscription_credit_entitlements ADD COLUMN IF NOT EXISTS monthly_credits_snapshot INTEGER NOT NULL DEFAULT 250, ADD COLUMN IF NOT EXISTS rollover_cap_snapshot INTEGER, ADD COLUMN IF NOT EXISTS refund_review_status TEXT NOT NULL DEFAULT 'none', ADD COLUMN IF NOT EXISTS refund_review_note TEXT`);
    const p = await db.execute(sql`SELECT id FROM plans WHERE code = 'basic' LIMIT 1`);
    planId = Number((p.rows[0] as any).id);
    const t = await db.execute(sql`INSERT INTO teachers (name, email, password_hash, created_at) VALUES ('Annual test', ${`${run}@test.local`}, 'x', NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);
  });
  afterAll(async () => {
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_entitlements WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
  });
  async function reset(status = "active", release = new Date()): Promise<void> {
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscription_credit_entitlements WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    const paid = new Date(release); paid.setFullYear(paid.getFullYear() + 1);
    await db.execute(sql`
      INSERT INTO subscriptions (teacher_id, plan_id, status, payment_status, external_subscription_id, billing_interval, paid_through, release_through, started_at)
      VALUES (${teacherId}, ${planId}, ${status}, 'active', ${subId}, 'year', ${paid}, ${release}, NOW())
      ON CONFLICT (teacher_id) DO UPDATE SET status = ${status}, paid_through = ${paid}, release_through = ${release}, billing_interval = 'year', external_subscription_id = ${subId}
    `);
    await db.execute(sql`
      INSERT INTO subscription_credit_entitlements
        (provider_invoice_id, subscription_id, teacher_id, plan_code, billing_interval, period_start, period_end, release_through, status)
      VALUES (${`invoice_${run}_${release.getTime()}`}, ${subId}, ${teacherId}, 'basic', 'year',
        ${release}, ${paid}, ${release}, ${status === "expired" ? "revoked" : "active"})
      ON CONFLICT (provider_invoice_id) DO UPDATE
      SET period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
          release_through = EXCLUDED.release_through, status = EXCLUDED.status
    `);
  }

  it("annual first payment grants one month, never twelve", async () => {
    const end = addOneCalendarMonth(new Date());
    await reset();
    const key = `annual:${subId}:${end.toISOString()}`;
    await CreditService.grantSubscriptionCredits(teacherId, "basic", key, subId, end, addOneCalendarMonth(end), key);
    const r = await db.execute(sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM credit_batches WHERE teacher_id = ${teacherId}`);
    expect(Number((r.rows[0] as any).total)).toBe(250);
  });

  it("idempotent annual cycle key prevents duplicate monthly release", async () => {
    const end = addOneCalendarMonth(new Date());
    await reset();
    const key = `annual:${subId}:${end.toISOString()}`;
    await Promise.all([
      CreditService.grantSubscriptionCredits(teacherId, "basic", key, subId, end, addOneCalendarMonth(end), key),
      CreditService.grantSubscriptionCredits(teacherId, "basic", key, subId, end, addOneCalendarMonth(end), key),
    ]);
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM subscription_credit_grants WHERE credit_cycle_key = ${key}`);
    expect(Number((r.rows[0] as any).n)).toBe(1);
  });

  it("catch-up releases missed cycles, including after cancellation through paid-through", async () => {
    const release = new Date(); release.setMonth(release.getMonth() - 2);
    await reset("canceled", release);
    await releaseDueAnnualCredits(new Date());
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    expect(Number((r.rows[0] as any).n)).toBeGreaterThanOrEqual(2);
  });

  it("expired/refunded subscription stops future annual releases", async () => {
    const release = new Date(); release.setMonth(release.getMonth() - 2);
    await reset("expired", release);
    await releaseDueAnnualCredits(new Date());
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    expect(Number((r.rows[0] as any).n)).toBe(0);
  });

  it("monthly invoice behavior remains invoice-idempotent", async () => {
    await reset();
    await db.execute(sql`UPDATE subscriptions SET billing_interval = 'month' WHERE teacher_id = ${teacherId}`);
    const invoice = `invoice_${run}`;
    const end = addOneCalendarMonth(new Date());
    await CreditService.grantSubscriptionCredits(teacherId, "basic", invoice, subId, end, addOneCalendarMonth(end));
    await CreditService.grantSubscriptionCredits(teacherId, "basic", invoice, subId, end, addOneCalendarMonth(end));
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM subscription_credit_grants WHERE subscription_invoice_id = ${invoice}`);
    expect(Number((r.rows[0] as any).n)).toBe(1);
  });
});