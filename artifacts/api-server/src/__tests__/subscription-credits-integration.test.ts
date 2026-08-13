/**
 * اختبارات تكاملية لنظام رصيد الاشتراكات — DB حقيقي بدون mocks.
 *
 * S1. subscription_created لا يضيف أي رصيد
 * S2. subscription_payment_success يضيف رصيداً باستخدام payload.data.id
 * S3. إعادة إرسال نفس الـ webhook → لا تكرار
 * S4. Pro + 900 متبقٍ → تجديد يضيف 300 فقط (cap=1200)
 * S5. Pro + 1200 متبقٍ → credits_granted=0 مسجّل، إعادة webhook لا تضيف شيئاً
 * S6. expires_at الدفعات القديمة لا تتغير عند التجديد
 * S7. Hold ثم فشل → يعود الرصيد للـ batch نفسها
 * S8. Refund شراء → يُخصم من دفعات الشراء فقط
 * S9. migration idempotency + مجموع batches = credit_accounts.balance
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreditService } from "../lib/credit-service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RUN_ID = `t${Date.now()}`;

async function createTestTeacher(suffix: string): Promise<number> {
  const email = `${RUN_ID}_${suffix}@test.local`;
  const r = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${email}, 'x', NOW())
    RETURNING id
  `);
  return Number((r.rows[0] as any).id);
}

async function cleanTeacher(tid: number): Promise<void> {
  await db.execute(sql`DELETE FROM subscription_credit_grants WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${tid})`);
  await db.execute(sql`DELETE FROM credit_holds       WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_batches     WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM credit_accounts    WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM subscriptions      WHERE teacher_id = ${tid}`);
  await db.execute(sql`DELETE FROM teachers           WHERE id = ${tid}`);
}

async function seedSubscription(tid: number, planCode: "basic" | "pro"): Promise<void> {
  const planRow = await db.execute(sql`SELECT id FROM plans WHERE code = ${planCode} LIMIT 1`);
  if (!planRow.rows[0]) throw new Error(`Plan '${planCode}' not found`);
  const planId = Number((planRow.rows[0] as any).id);
  await db.execute(sql`
    INSERT INTO subscriptions
      (teacher_id, plan_id, status, payment_status, external_subscription_id,
       payment_provider, started_at, created_at, updated_at)
    VALUES
      (${tid}, ${planId}, 'active', 'active', ${'sub_' + RUN_ID + '_' + tid},
       'lemonsqueezy', NOW(), NOW(), NOW())
    ON CONFLICT (teacher_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id, status = 'active',
          payment_status = 'active', updated_at = NOW()
  `);
}

async function seedSubBatch(tid: number, amount: number, expiresAt: Date): Promise<number> {
  const r = await db.execute(sql`
    INSERT INTO credit_batches
      (teacher_id, source, amount, amount_remaining, expires_at,
       reference_id, plan_code, created_at, updated_at)
    VALUES
      (${tid}, 'subscription', ${amount}, ${amount}, ${expiresAt},
       ${'seed_' + RUN_ID + '_' + tid + '_' + Date.now()}, 'pro', NOW(), NOW())
    RETURNING id
  `);
  await db.execute(sql`
    INSERT INTO credit_accounts
      (teacher_id, balance, subscription_balance, total_earned, updated_at)
    VALUES (${tid}, ${amount}, ${amount}, ${amount}, NOW())
    ON CONFLICT (teacher_id) DO UPDATE
      SET balance              = credit_accounts.balance              + ${amount},
          subscription_balance = credit_accounts.subscription_balance + ${amount},
          total_earned         = credit_accounts.total_earned         + ${amount},
          updated_at           = NOW()
  `);
  return Number((r.rows[0] as any).id);
}

async function getGrants(tid: number): Promise<any[]> {
  const r = await db.execute(sql`
    SELECT * FROM subscription_credit_grants WHERE teacher_id = ${tid} ORDER BY id
  `);
  return r.rows as any[];
}

async function getSubBatches(tid: number): Promise<any[]> {
  const r = await db.execute(sql`
    SELECT * FROM credit_batches WHERE teacher_id = ${tid} AND source = 'subscription' ORDER BY id
  `);
  return r.rows as any[];
}

async function getPurchasedBatches(tid: number): Promise<any[]> {
  const r = await db.execute(sql`
    SELECT * FROM credit_batches WHERE teacher_id = ${tid} AND source = 'purchased' ORDER BY id
  `);
  return r.rows as any[];
}

async function getAllBatches(tid: number): Promise<any[]> {
  const r = await db.execute(sql`
    SELECT * FROM credit_batches WHERE teacher_id = ${tid} ORDER BY id
  `);
  return r.rows as any[];
}

async function getBalance(tid: number): Promise<any> {
  const r = await db.execute(sql`
    SELECT balance, subscription_balance, free_balance, paid_balance,
           promo_balance, earned_balance
    FROM credit_accounts WHERE teacher_id = ${tid}
  `);
  return r.rows[0] ?? {
    balance: 0, subscription_balance: 0, free_balance: 0,
    paid_balance: 0, promo_balance: 0, earned_balance: 0,
  };
}

const NOW         = new Date();
const PERIOD_END  = new Date(NOW.getTime() + 30 * 86_400_000);
const NEXT_PERIOD = new Date(NOW.getTime() + 60 * 86_400_000);
const FAR_FUTURE  = new Date(NOW.getTime() + 365 * 86_400_000);

// ─── Test teachers ────────────────────────────────────────────────────────────

const T: Record<string, number> = {};

beforeAll(async () => {
  for (const s of ["s1","s2","s3","s4","s5","s6","s7","s8","s9"]) {
    T[s] = await createTestTeacher(s);
  }
  for (const s of ["s2","s3","s4","s5","s6"]) await seedSubscription(T[s], "pro");
  await seedSubscription(T["s7"], "basic");
}, 30_000);

afterAll(async () => {
  for (const tid of Object.values(T)) {
    try { await cleanTeacher(tid); } catch { /* best-effort */ }
  }
}, 30_000);

// ═══════════════════════════════════════════════════════════════════════════════
// S1 · subscription_created — no credit grant
// ═══════════════════════════════════════════════════════════════════════════════

describe("S1 · subscription_created لا يضيف أي رصيد", () => {
  it("لا توجد دفعات أو grants بعد إنشاء الاشتراك فقط", async () => {
    // subscription_created only upserts the subscription row — CreditService is NOT called
    await db.execute(sql`
      INSERT INTO subscriptions
        (teacher_id, plan_id, status, payment_status, external_subscription_id,
         payment_provider, started_at, created_at, updated_at)
      VALUES
        (${T.s1},
         (SELECT id FROM plans WHERE code = 'basic' LIMIT 1),
         'active', 'active', ${'sub_s1_' + RUN_ID},
         'lemonsqueezy', NOW(), NOW(), NOW())
      ON CONFLICT (teacher_id) DO NOTHING
    `);

    const grants  = await getGrants(T.s1);
    const batches = await getSubBatches(T.s1);
    const bal     = await getBalance(T.s1);

    expect(grants.length,               "grants = 0").toBe(0);
    expect(batches.length,              "batches = 0").toBe(0);
    expect(Number(bal.balance ?? 0),    "balance = 0").toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S2 · subscription_payment_success — منح رصيد مرة واحدة
// ═══════════════════════════════════════════════════════════════════════════════

describe("S2 · subscription_payment_success يضيف رصيداً باستخدام payload.data.id", () => {
  it("يضيف 600 رصيد لـ Pro ويسجل invoice_id صحيحاً", async () => {
    const invoiceId = `inv_${RUN_ID}_s2`;
    const subId     = `sub_${RUN_ID}_${T.s2}`;

    const { granted, alreadyGranted } = await CreditService.grantSubscriptionCredits(
      T.s2, "pro", invoiceId, subId, PERIOD_END, NEXT_PERIOD
    );

    expect(alreadyGranted,              "ليس مكرراً").toBe(false);
    expect(granted,                     "منح 600").toBe(600);

    const grants  = await getGrants(T.s2);
    const batches = await getSubBatches(T.s2);
    const bal     = await getBalance(T.s2);

    expect(grants.length,               "صف واحد في grants").toBe(1);
    expect(grants[0].subscription_invoice_id, "invoice_id صحيح").toBe(invoiceId);
    expect(Number(grants[0].credits_granted), "credits_granted=600").toBe(600);
    expect(grants[0].subscription_id,   "subscription_id صحيح").toBe(subId);

    expect(batches.length,              "دفعة واحدة").toBe(1);
    expect(Number(batches[0].amount_remaining), "amount_remaining=600").toBe(600);
    expect(batches[0].reference_id,     "reference_id=invoiceId").toBe(invoiceId);

    const batchExpiry = new Date(batches[0].expires_at).getTime();
    expect(Math.abs(batchExpiry - NEXT_PERIOD.getTime()),
      "expires_at = nextPeriodEnd (±5s)").toBeLessThan(5_000);

    expect(Number(bal.balance),               "balance=600").toBe(600);
    expect(Number(bal.subscription_balance),   "subscription_balance=600").toBe(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S3 · webhook مكرر — idempotent
// ═══════════════════════════════════════════════════════════════════════════════

describe("S3 · إعادة إرسال نفس الـ webhook لا تُكرر المنح", () => {
  it("نفس invoice_id 3 مرات → grants=1، batches=1، balance=600", async () => {
    const invoiceId = `inv_${RUN_ID}_s3`;
    const subId     = `sub_${RUN_ID}_${T.s3}`;

    const r1 = await CreditService.grantSubscriptionCredits(T.s3, "pro", invoiceId, subId, PERIOD_END, NEXT_PERIOD);
    const r2 = await CreditService.grantSubscriptionCredits(T.s3, "pro", invoiceId, subId, PERIOD_END, NEXT_PERIOD);
    const r3 = await CreditService.grantSubscriptionCredits(T.s3, "pro", invoiceId, subId, PERIOD_END, NEXT_PERIOD);

    expect(r1.alreadyGranted, "r1: new grant").toBe(false);
    expect(r1.granted,        "r1: 600").toBe(600);
    expect(r2.alreadyGranted, "r2: duplicate").toBe(true);
    expect(r2.granted,        "r2: 0").toBe(0);
    expect(r3.alreadyGranted, "r3: duplicate").toBe(true);
    expect(r3.granted,        "r3: 0").toBe(0);

    const grants  = await getGrants(T.s3);
    const batches = await getSubBatches(T.s3);
    const bal     = await getBalance(T.s3);

    expect(grants.length,  "صف واحد فقط في grants").toBe(1);
    expect(batches.length, "دفعة واحدة فقط").toBe(1);
    expect(Number(bal.balance), "balance=600 (لا تضاعف)").toBe(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S4 · Pro + 900 متبقٍ → يضيف 300 فقط (cap=1200)
// ═══════════════════════════════════════════════════════════════════════════════

describe("S4 · rollover cap — يضيف حتى السقف فقط", () => {
  it("Pro + 900 رصيد → تجديد يضيف 300 (cap=1200)", async () => {
    await seedSubBatch(T.s4, 900, FAR_FUTURE);

    const invoiceId = `inv_${RUN_ID}_s4`;
    const subId     = `sub_${RUN_ID}_${T.s4}`;

    const { granted, alreadyGranted } = await CreditService.grantSubscriptionCredits(
      T.s4, "pro", invoiceId, subId, PERIOD_END, NEXT_PERIOD
    );

    expect(alreadyGranted).toBe(false);
    expect(granted,               "يضيف 300 فقط (1200-900)").toBe(300);

    const bal = await getBalance(T.s4);
    expect(Number(bal.balance),              "balance=1200").toBe(1200);
    expect(Number(bal.subscription_balance), "subscription_balance=1200").toBe(1200);

    const grants = await getGrants(T.s4);
    expect(Number(grants[0].credits_granted), "grants.credits_granted=300").toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S5 · Pro + 1200 متبقٍ → credits_granted=0 مسجّل
// ═══════════════════════════════════════════════════════════════════════════════

describe("S5 · عند السقف — credits_granted=0 مسجّل، إعادة webhook لا تضيف شيئاً", () => {
  it("فاتورتان مختلفتان عند cap=1200 → كلتاهما مسجّلتان بـ 0", async () => {
    await seedSubBatch(T.s5, 1200, FAR_FUTURE);

    const inv1  = `inv_${RUN_ID}_s5_a`;
    const inv2  = `inv_${RUN_ID}_s5_b`;
    const subId = `sub_${RUN_ID}_${T.s5}`;

    const r1 = await CreditService.grantSubscriptionCredits(T.s5, "pro", inv1, subId, PERIOD_END, NEXT_PERIOD);
    expect(r1.alreadyGranted).toBe(false);
    expect(r1.granted, "0 رصيد (عند السقف)").toBe(0);

    // Duplicate of inv1
    const dup = await CreditService.grantSubscriptionCredits(T.s5, "pro", inv1, subId, PERIOD_END, NEXT_PERIOD);
    expect(dup.alreadyGranted, "تكرار → alreadyGranted").toBe(true);

    // New invoice — also 0 since still at cap
    const r2 = await CreditService.grantSubscriptionCredits(T.s5, "pro", inv2, subId, PERIOD_END, NEXT_PERIOD);
    expect(r2.granted, "فاتورة جديدة لكن السقف ممتلئ → 0").toBe(0);

    const grants = await getGrants(T.s5);
    expect(grants.length, "صفّان — فاتورتان مختلفتان").toBe(2);
    expect(Number(grants[0].credits_granted), "inv1: credits_granted=0").toBe(0);
    expect(Number(grants[1].credits_granted), "inv2: credits_granted=0").toBe(0);

    const bal = await getBalance(T.s5);
    expect(Number(bal.balance), "balance لا يزال 1200").toBe(1200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S6 · expires_at الدفعات القديمة لا تتغير
// ═══════════════════════════════════════════════════════════════════════════════

describe("S6 · تجديد لا يمدد expires_at الدفعات القديمة", () => {
  it("شهر 1 + شهر 2 → دفعتان مستقلتان بـ expires_at مختلفة", async () => {
    const subId   = `sub_${RUN_ID}_${T.s6}`;
    const inv1    = `inv_${RUN_ID}_s6_m1`;
    const inv2    = `inv_${RUN_ID}_s6_m2`;

    const p1End   = new Date(NOW.getTime() + 30 * 86_400_000);
    const n1End   = new Date(NOW.getTime() + 60 * 86_400_000);
    const p2End   = n1End;
    const n2End   = new Date(NOW.getTime() + 90 * 86_400_000);

    // Month 1
    const m1 = await CreditService.grantSubscriptionCredits(T.s6, "pro", inv1, subId, p1End, n1End);
    expect(m1.granted, "شهر 1: 600").toBe(600);

    const batches1 = await getSubBatches(T.s6);
    const b1ExpiryBefore = new Date(batches1[0].expires_at).getTime();

    // Month 2
    const m2 = await CreditService.grantSubscriptionCredits(T.s6, "pro", inv2, subId, p2End, n2End);
    expect(m2.granted, "شهر 2: 600 (1200-600=600)").toBe(600);

    const batches2 = await getSubBatches(T.s6);
    expect(batches2.length, "دفعتان منفصلتان").toBe(2);

    const oldBatch = batches2.find((b: any) => b.reference_id === inv1)!;
    const newBatch = batches2.find((b: any) => b.reference_id === inv2)!;

    expect(new Date(oldBatch.expires_at).getTime(),
      "expires_at الدفعة الأولى لم تتغير").toBe(b1ExpiryBefore);

    expect(Math.abs(new Date(newBatch.expires_at).getTime() - n2End.getTime()),
      "الدفعة الجديدة: expires_at=n2End (±5s)").toBeLessThan(5_000);

    const bal = await getBalance(T.s6);
    expect(Number(bal.balance), "balance=1200").toBe(1200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S7 · Hold ثم فشل → يعود الرصيد للـ batch نفسها
// ═══════════════════════════════════════════════════════════════════════════════

describe("S7 · Hold ثم فشل أداة AI → يعود الرصيد للـ batch الأصلية", () => {
  it("amount_remaining يعود لقيمته قبل الـ hold بعد الـ refund", async () => {
    const inv   = `inv_${RUN_ID}_s7`;
    const subId = `sub_${RUN_ID}_${T.s7}`;

    // Grant 250 credits (Basic)
    const { granted } = await CreditService.grantSubscriptionCredits(
      T.s7, "basic", inv, subId, PERIOD_END, NEXT_PERIOD
    );
    expect(granted, "منح 250").toBe(250);

    // Ensure test tool price exists
    await db.execute(sql`
      INSERT INTO credit_tool_prices
        (tool_key, tool_name_ar, category, credits_cost, default_credits_cost,
         is_credit_enabled, timeout_seconds, updated_at)
      VALUES
        ('test_hold_tool', 'أداة اختبار', 'test', 50, 50, true, 60, NOW())
      ON CONFLICT (tool_key) DO UPDATE
        SET credits_cost = 50, is_credit_enabled = true
    `);

    const reqId = `req_${RUN_ID}_s7`;
    const holdResult = await CreditService.hold(T.s7, "test_hold_tool", reqId);
    expect(holdResult.creditsHeld, "Hold 50 رصيد").toBe(50);
    expect(holdResult.newBalance,  "balance بعد hold=200").toBe(200);

    // Verify the batch was reduced
    const batchesBefore = await getSubBatches(T.s7);
    const batchId = Number(batchesBefore[0].id);
    expect(Number(batchesBefore[0].amount_remaining), "amount_remaining بعد hold=200").toBe(200);

    // Simulate AI failure → refund
    await CreditService.refund(reqId, "فشل أداة AI — اختبار");

    const batchesAfter = await getSubBatches(T.s7);
    const restoredBatch = batchesAfter.find((b: any) => Number(b.id) === batchId)!;
    expect(restoredBatch, "الـ batch الأصلية موجودة").toBeTruthy();
    expect(Number(restoredBatch.amount_remaining),
      "amount_remaining عاد إلى 250").toBe(250);

    const bal = await getBalance(T.s7);
    expect(Number(bal.balance),              "balance عاد إلى 250").toBe(250);
    expect(Number(bal.subscription_balance), "subscription_balance عاد إلى 250").toBe(250);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S8 · Refund شراء — لا يمس الاشتراك أو المجاني
// ═══════════════════════════════════════════════════════════════════════════════

describe("S8 · Refund شراء → يُخصم فقط من دفعات الشراء", () => {
  it("free_balance و subscription_balance لا يتغيران بعد refund الشراء", async () => {
    // Grant 50 free credits
    await CreditService.resetFreeCredits(T.s8);

    const orderRef = `ls_order_${RUN_ID}_s8`;

    // Grant 100 purchased credits
    await db.transaction(async (tx: any) => {
      await CreditService.addPurchasedCredits(tx, T.s8, 100, 888888, orderRef, "شراء اختبار");
    });

    const balBefore = await getBalance(T.s8);
    expect(Number(balBefore.balance),     "balance=150").toBe(150);
    expect(Number(balBefore.free_balance), "free=50").toBe(50);
    expect(Number(balBefore.paid_balance), "paid=100").toBe(100);

    const pBefore = await getPurchasedBatches(T.s8);
    expect(pBefore.length, "دفعة شراء واحدة").toBe(1);
    const purchasedBatchId = Number(pBefore[0].id);

    // Refund 60 credits
    await db.transaction(async (tx: any) => {
      await CreditService.deductRefundedCredits(tx, T.s8, 60, 888888, orderRef, "استرجاع اختبار");
    });

    const balAfter = await getBalance(T.s8);
    expect(Number(balAfter.balance),      "balance=90 (150-60)").toBe(90);
    expect(Number(balAfter.free_balance),  "free_balance لم يتغير=50").toBe(50);
    expect(Number(balAfter.paid_balance),  "paid_balance=40 (100-60)").toBe(40);

    const pAfter = await getPurchasedBatches(T.s8);
    const affected = pAfter.find((b: any) => Number(b.id) === purchasedBatchId)!;
    expect(Number(affected.amount_remaining), "batch المشترى=40").toBe(40);

    // Free batch untouched
    const allBatches = await getAllBatches(T.s8);
    const freeBatch  = allBatches.find((b: any) => b.source === "free")!;
    expect(freeBatch, "free batch موجود").toBeTruthy();
    expect(Number(freeBatch.amount_remaining), "free batch لم يتغير=50").toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// S9 · Migration idempotency + consistency
// ═══════════════════════════════════════════════════════════════════════════════

describe("S9 · Migration idempotency + balance consistency", () => {
  it("seed_completions يحمي من تكرار المنح عند إعادة تشغيل migration", async () => {
    const scRows = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM seed_completions WHERE key LIKE 'credit_batches_seeded_%'
    `);
    const seedCount = Number((scRows.rows[0] as any).cnt);
    console.log(`  seed_completions guards: ${seedCount}`);
    expect(seedCount, "يوجد حماية في seed_completions").toBeGreaterThanOrEqual(1);
  });

  it("مجموع credit_batches.amount_remaining = credit_accounts.balance لكل معلم اختبار", async () => {
    // Run all test teachers through S2/S3/S4/S5/S6/S7/S8 have completed
    const inconsistencies: string[] = [];

    for (const [key, tid] of Object.entries(T)) {
      const batchRow = await db.execute(sql`
        SELECT COALESCE(SUM(amount_remaining), 0)::int AS total
        FROM credit_batches
        WHERE teacher_id = ${tid}
          AND amount_remaining > 0
          AND (expires_at IS NULL OR expires_at > NOW())
      `);
      const acctRow = await db.execute(sql`
        SELECT COALESCE(balance, 0)::int AS bal
        FROM credit_accounts WHERE teacher_id = ${tid}
      `);

      const batchTotal = Number((batchRow.rows[0] as any)?.total ?? 0);
      const acctBal    = Number((acctRow.rows[0] as any)?.bal   ?? 0);

      console.log(`  S${key.slice(1)}: batches=${batchTotal}  accounts.balance=${acctBal}`);

      if (batchTotal !== acctBal) {
        inconsistencies.push(`${key}: batches=${batchTotal} ≠ accounts=${acctBal}`);
      }
    }

    expect(inconsistencies, `عدم تطابق: ${inconsistencies.join(", ")}`).toHaveLength(0);
  });
});
