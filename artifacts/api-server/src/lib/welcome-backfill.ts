/**
 * ترحيل نقاط الترحيب للحسابات القديمة — welcome_credits_backfill_v1
 *
 * السياسة المعتمدة: كل معلم يستحق 50 نقطة ترحيبية مرة واحدة فقط، حتى لو كان
 * مسجلاً قبل إضافة نظام النقاط.
 *
 * - versioned + idempotent: محمي بمفتاح seed_completions فلا يعمل إلا مرة
 *   واحدة لكل قاعدة بيانات؛ وكل خطوة داخله idempotent بذاتها أيضًا.
 * - transaction واحدة: إنشاء credit_account صفري لمن لا يملكه، ثم منح دفعة
 *   source='free' / reference_id='welcome_credits' / expires_at=NULL فقط لمن
 *   لا يملك أي دفعة ترحيب (بالحارسين معًا: source='free' أو reference_id).
 * - يحاكي أثر CreditService._grantBatchInTx بالكامل (دفعة + تحديث balance
 *   وfree_balance وtotal_earned تراكميًا + سجل credit_transactions) —
 *   لا يعيد كتابة أي أرصدة موجودة.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const WELCOME_BACKFILL_SEED_KEY = "welcome_credits_backfill_v1";
export const WELCOME_AMOUNT = 50;

export interface WelcomeBackfillResult {
  /** false إذا كان المفتاح مسجلاً مسبقًا (لم يعمل شيء) */
  applied: boolean;
  /** عدد المعلمين الذين مُنحوا دفعة جديدة */
  granted: number;
}

export async function runWelcomeCreditsBackfill(): Promise<WelcomeBackfillResult> {
  const done = await db.execute(
    sql`SELECT 1 FROM seed_completions WHERE key = ${WELCOME_BACKFILL_SEED_KEY}`,
  );
  if (done.rows.length > 0) return { applied: false, granted: 0 };

  let grantedCount = 0;
  await db.transaction(async (tx) => {
    // 1) credit_account صفري فقط لمن لا يملكه — لا مساس بأي أرصدة قائمة.
    await tx.execute(sql`
      INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
      SELECT t.id, 0, 0, 0, NOW()
      FROM teachers t
      WHERE NOT EXISTS (SELECT 1 FROM credit_accounts ca WHERE ca.teacher_id = t.id)
      ON CONFLICT (teacher_id) DO NOTHING
    `);

    // 2) دفعة ترحيب واحدة لكل معلم لم يحصل عليها قط.
    //    الحارس يطابق حارس runtime (أي دفعة source='free') وأيضًا reference_id
    //    الصريح — فلا يمكن منح معلم مرتين بأي مسار.
    const granted = await tx.execute(sql`
      INSERT INTO credit_batches
        (teacher_id, source, amount, amount_remaining, expires_at, reference_id, created_at, updated_at)
      SELECT t.id, 'free', ${WELCOME_AMOUNT}, ${WELCOME_AMOUNT}, NULL, 'welcome_credits', NOW(), NOW()
      FROM teachers t
      WHERE NOT EXISTS (
        SELECT 1 FROM credit_batches cb
        WHERE cb.teacher_id = t.id
          AND (cb.source = 'free' OR cb.reference_id = 'welcome_credits')
      )
      RETURNING teacher_id
    `);
    const grantedIds = (granted.rows as any[]).map((r) => Number(r.teacher_id));
    grantedCount = grantedIds.length;

    if (grantedIds.length > 0) {
      const idList = sql.join(grantedIds.map((id) => sql`${id}`), sql`, `);
      // 3) تحديث تراكمي (+50) للممنوحين فقط — لا استبدال ولا إعادة كتابة.
      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance      = balance + ${WELCOME_AMOUNT},
            free_balance = free_balance + ${WELCOME_AMOUNT},
            total_earned = total_earned + ${WELCOME_AMOUNT},
            updated_at   = NOW()
        WHERE teacher_id IN (${idList})
      `);
      // 4) سجل الحركات بنفس دلالات CreditService._grantBatchInTx.
      await tx.execute(sql`
        INSERT INTO credit_transactions (teacher_id, amount, type, reason, status, credit_type, source, created_at)
        SELECT tid, ${WELCOME_AMOUNT}, 'earn', 'رصيد ترحيبي (مرة واحدة)', 'completed', 'free', 'welcome_credits', NOW()
        FROM (VALUES ${sql.join(grantedIds.map((id) => sql`(${id}::int)`), sql`, `)}) AS v(tid)
      `);
    }

    await tx.execute(sql`INSERT INTO seed_completions (key) VALUES (${WELCOME_BACKFILL_SEED_KEY})`);
  });

  return { applied: true, granted: grantedCount };
}
