/**
 * اختبارات تكاملية لترحيل نقاط الترحيب — welcome_credits_backfill_v1
 * DB حقيقي (TEST_DATABASE_URL) بدون mocks.
 *
 * WB1. معلم قديم بلا credit_account → يحصل على account + دفعة 50 (free/welcome_credits/NULL)
 *      وbalance=free_balance=50 وحركة earn واحدة.
 * WB2. التشغيل الثاني → no-op بالكامل (المفتاح مسجّل)؛ لا مضاعفة.
 * WB3. معلم لديه دفعة welcome سابقة → لا يتغير رصيده ولا تُضاف دفعة.
 * WB4. معلم لديه credit_account برصيد مدفوع قائم وبلا welcome → يُمنح 50 تراكميًا
 *      دون إعادة كتابة الرصيد المدفوع.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  runWelcomeCreditsBackfill,
  WELCOME_BACKFILL_SEED_KEY,
} from "../lib/welcome-backfill";

// Skip the entire file when no real DB is available (global mock has no execute).
const DB_AVAILABLE = typeof (db as any).execute === "function";
const suite = DB_AVAILABLE ? describe : describe.skip;

const RUN_ID = `wb${Date.now()}`;
const teachers: number[] = [];

async function createTeacher(suffix: string): Promise<number> {
  const email = `${RUN_ID}_${suffix}@test.local`;
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${email}, 'x', NOW()) RETURNING id
  `);
  const id = Number((r.rows[0] as any).id);
  teachers.push(id);
  return id;
}

async function account(tid: number) {
  const r = await db.execute(sql`
    SELECT balance, free_balance, paid_balance, total_earned
    FROM credit_accounts WHERE teacher_id = ${tid}
  `);
  return r.rows[0] as any;
}

async function welcomeBatches(tid: number): Promise<number> {
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM credit_batches
    WHERE teacher_id = ${tid} AND reference_id = 'welcome_credits'
  `);
  return Number((r.rows[0] as any).c);
}

let tLegacy: number; // بلا account إطلاقًا
let tHasWelcome: number; // لديه دفعة welcome سابقة
let tPaidNoWelcome: number; // لديه account برصيد مدفوع، بلا welcome

beforeAll(async () => {
  if (!DB_AVAILABLE) return;
  // نظافة: أزل المفتاح إن وُجد من تشغيل سابق للاختبارات
  await db.execute(sql`DELETE FROM seed_completions WHERE key = ${WELCOME_BACKFILL_SEED_KEY}`);

  tLegacy = await createTeacher("legacy");

  tHasWelcome = await createTeacher("haswelcome");
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, free_balance, total_earned, total_spent, updated_at)
    VALUES (${tHasWelcome}, 50, 50, 50, 0, NOW())
  `);
  await db.execute(sql`
    INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
    VALUES (${tHasWelcome}, 'free', 50, 50, NULL, 'welcome_credits', NOW(), NOW())
  `);

  tPaidNoWelcome = await createTeacher("paid");
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, paid_balance, free_balance, total_earned, total_spent, updated_at)
    VALUES (${tPaidNoWelcome}, 400, 400, 0, 400, 0, NOW())
  `);
  await db.execute(sql`
    INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
    VALUES (${tPaidNoWelcome}, 'purchased', 400, 400, NULL, ${RUN_ID + "_order"}, NOW(), NOW())
  `);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM seed_completions WHERE key = ${WELCOME_BACKFILL_SEED_KEY}`);
  for (const tid of teachers) {
    await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${tid}`);
    await db.execute(sql`DELETE FROM teachers WHERE id = ${tid}`);
  }
});

suite("ترحيل نقاط الترحيب — welcome_credits_backfill_v1", () => {
  it("WB1 — معلم قديم بلا محفظة يحصل على 50 نقطة مرة واحدة", async () => {
    const result = await runWelcomeCreditsBackfill();
    expect(result.applied).toBe(true);
    expect(result.granted).toBeGreaterThanOrEqual(2); // tLegacy + tPaidNoWelcome على الأقل

    const acc = await account(tLegacy);
    expect(Number(acc.balance)).toBe(50);
    expect(Number(acc.free_balance)).toBe(50);
    expect(Number(acc.total_earned)).toBe(50);
    expect(await welcomeBatches(tLegacy)).toBe(1);

    const batch = await db.execute(sql`
      SELECT source, amount, amount_remaining, expires_at
      FROM credit_batches WHERE teacher_id = ${tLegacy} AND reference_id = 'welcome_credits'
    `);
    const b = batch.rows[0] as any;
    expect(b.source).toBe("free");
    expect(Number(b.amount)).toBe(50);
    expect(Number(b.amount_remaining)).toBe(50);
    expect(b.expires_at).toBeNull();

    const txs = await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM credit_transactions
      WHERE teacher_id = ${tLegacy} AND type = 'earn' AND source = 'welcome_credits'
    `);
    expect(Number((txs.rows[0] as any).c)).toBe(1);
  });

  it("WB2 — التشغيل الثاني no-op ولا يضاعف النقاط", async () => {
    const second = await runWelcomeCreditsBackfill();
    expect(second.applied).toBe(false);
    expect(second.granted).toBe(0);

    const acc = await account(tLegacy);
    expect(Number(acc.balance)).toBe(50);
    expect(await welcomeBatches(tLegacy)).toBe(1);
  });

  it("WB3 — حساب لديه welcome_credits سابقًا لا يتغير", async () => {
    const acc = await account(tHasWelcome);
    expect(Number(acc.balance)).toBe(50);
    expect(Number(acc.free_balance)).toBe(50);
    expect(await welcomeBatches(tHasWelcome)).toBe(1); // لم تُضف ثانية
  });

  it("WB4 — رصيد مدفوع قائم يبقى كما هو والمنحة تُضاف تراكميًا", async () => {
    const acc = await account(tPaidNoWelcome);
    expect(Number(acc.paid_balance)).toBe(400); // لم يُعد كتابته
    expect(Number(acc.free_balance)).toBe(50);
    expect(Number(acc.balance)).toBe(450); // 400 + 50 تراكمي
    expect(await welcomeBatches(tPaidNoWelcome)).toBe(1);
  });
});
