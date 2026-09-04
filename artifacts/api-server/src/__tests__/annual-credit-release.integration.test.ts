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
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS scg_credit_cycle_uniq ON subscription_credit_grants(credit_cycle_key)`);
    const p = await db.execute(sql`SELECT id FROM plans WHERE code = 'basic' LIMIT 1`);
    planId = Number((p.rows[0] as any).id);
    const t = await db.execute(sql`INSERT INTO teachers (name, email, password_hash, created_at) VALUES ('Annual test', ${`${run}@test.local`}, 'x', NOW()) RETURNING id`);
    teacherId = Number((t.rows[0] as any).id);
  });
  afterAll(async () => {
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM subscriptions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
  });
  async function reset(status = "active", release = new Date()): Promise<void> {
    await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
    const paid = new Date(release); paid.setFullYear(paid.getFullYear() + 1);
    await db.execute(sql`
      INSERT INTO subscriptions (teacher_id, plan_id, status, payment_status, external_subscription_id, billing_interval, paid_through, release_through, started_at)
      VALUES (${teacherId}, ${planId}, ${status}, 'active', ${subId}, 'year', ${paid}, ${release}, NOW())
      ON CONFLICT (teacher_id) DO UPDATE SET status = ${status}, paid_through = ${paid}, release_through = ${release}, billing_interval = 'year', external_subscription_id = ${subId}
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