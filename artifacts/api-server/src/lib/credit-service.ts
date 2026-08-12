/**
 * CreditService — atomic hold/capture/refund for the credits system.
 *
 * The global credits switch (`creditsEnabled`) defaults to false, so all of
 * these operations are no-ops for current users until an admin turns it on.
 * Every balance mutation uses SELECT FOR UPDATE to prevent race conditions.
 */
import { db } from "@workspace/db";
import {
  creditAccountsTable,
  creditTransactionsTable,
  creditHoldsTable,
  creditToolPricesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoldResult {
  requestId: string;
  creditsHeld: number;
  newBalance: number;
}

export interface BalanceDetail {
  balance: number;
  paidBalance: number;
  promoBalance: number;
  earnedBalance: number;
}

/**
 * ترتيب الخصم: المجاني (promo) أولاً، ثم المكتسب (earned)، ثم المدفوع (paid).
 * يُرجع توزيع المبلغ على الأنواع الثلاثة.
 */
export function splitDeduction(
  amount: number,
  buckets: { promo: number; earned: number; paid: number }
): { promo: number; earned: number; paid: number } {
  const fromPromo  = Math.min(amount, Math.max(0, buckets.promo));
  const fromEarned = Math.min(amount - fromPromo, Math.max(0, buckets.earned));
  const fromPaid   = amount - fromPromo - fromEarned;
  return { promo: fromPromo, earned: fromEarned, paid: fromPaid };
}

export interface TransactionFilter {
  teacherId?: number;
  type?: string;
  toolKey?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const CreditService = {
  // ── Read ────────────────────────────────────────────────────────────────────

  async getBalance(teacherId: number): Promise<number> {
    const [row] = await db
      .select({ balance: creditAccountsTable.balance })
      .from(creditAccountsTable)
      .where(eq(creditAccountsTable.teacherId, teacherId))
      .limit(1);
    return row?.balance ?? 0;
  },

  async getBalanceDetail(teacherId: number): Promise<BalanceDetail> {
    const [row] = await db
      .select({
        balance:       creditAccountsTable.balance,
        paidBalance:   creditAccountsTable.paidBalance,
        promoBalance:  creditAccountsTable.promoBalance,
        earnedBalance: creditAccountsTable.earnedBalance,
      })
      .from(creditAccountsTable)
      .where(eq(creditAccountsTable.teacherId, teacherId))
      .limit(1);
    return row ?? { balance: 0, paidBalance: 0, promoBalance: 0, earnedBalance: 0 };
  },

  // ── Hold → Capture / Refund ──────────────────────────────────────────────────

  /**
   * Atomically deduct `creditsHeld` from the teacher's balance and create a
   * pending hold + transaction. Rejects if balance is insufficient or the
   * `requestId` already exists.
   */
  async hold(
    teacherId: number,
    toolKey: string,
    requestId: string
  ): Promise<HoldResult> {
    // Check for duplicate request_id first (idempotency)
    const [existing] = await db
      .select({ id: creditHoldsTable.id, creditsHeld: creditHoldsTable.creditsHeld })
      .from(creditHoldsTable)
      .where(eq(creditHoldsTable.requestId, requestId))
      .limit(1);

    if (existing) {
      const balance = await this.getBalance(teacherId);
      return { requestId, creditsHeld: existing.creditsHeld, newBalance: balance };
    }

    // Fetch tool price + timeout
    const [tool] = await db
      .select({
        creditsCost: creditToolPricesTable.creditsCost,
        timeoutSeconds: creditToolPricesTable.timeoutSeconds,
      })
      .from(creditToolPricesTable)
      .where(eq(creditToolPricesTable.toolKey, toolKey))
      .limit(1);

    const creditsCost = tool?.creditsCost ?? 0;
    const timeoutSeconds = tool?.timeoutSeconds ?? 60;

    if (creditsCost === 0) {
      // Free tool — no hold needed; return a synthetic result
      return { requestId, creditsHeld: 0, newBalance: await this.getBalance(teacherId) };
    }

    return await db.transaction(async (tx) => {
      // Ensure account row exists
      await tx.execute(sql`
        INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
        VALUES (${teacherId}, 0, 0, 0, NOW())
        ON CONFLICT (teacher_id) DO NOTHING
      `);

      // SELECT FOR UPDATE to prevent concurrent double-spend
      const lockResult = await tx.execute(sql`
        SELECT balance, promo_balance, earned_balance, paid_balance FROM credit_accounts
        WHERE teacher_id = ${teacherId}
        FOR UPDATE
      `);
      const acct = lockResult.rows[0] as any;
      const currentBalance = Number(acct?.balance ?? 0);

      if (currentBalance < creditsCost) {
        throw new Error(`رصيد غير كافٍ (${currentBalance} من ${creditsCost} رصيد مطلوب)`);
      }

      const newBalance = currentBalance - creditsCost;
      // ترتيب الخصم: مجاني ← مكتسب ← مدفوع
      const split = splitDeduction(creditsCost, {
        promo:  Number(acct?.promo_balance  ?? 0),
        earned: Number(acct?.earned_balance ?? 0),
        paid:   Number(acct?.paid_balance   ?? 0),
      });

      // Deduct balance
      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance = ${newBalance},
            promo_balance  = promo_balance  - ${split.promo},
            earned_balance = earned_balance - ${split.earned},
            paid_balance   = paid_balance   - ${split.paid},
            total_spent = total_spent + ${creditsCost},
            updated_at = NOW()
        WHERE teacher_id = ${teacherId}
      `);

      // Insert hold record (with bucket breakdown so refunds restore correctly)
      await tx.insert(creditHoldsTable).values({
        teacherId,
        toolKey,
        creditsHeld: creditsCost,
        requestId,
        status: "pending",
        timeoutSeconds,
        heldPromo:  split.promo,
        heldEarned: split.earned,
        heldPaid:   split.paid,
      });

      // Insert transaction record (pending)
      await tx.insert(creditTransactionsTable).values({
        teacherId,
        amount: -creditsCost,
        type: "spend",
        reason: `استخدام أداة: ${toolKey}`,
        toolKey,
        requestId,
        status: "pending",
      });

      return { requestId, creditsHeld: creditsCost, newBalance };
    });
  },

  /**
   * Mark a pending hold + transaction as completed (no balance change — already
   * deducted on hold).
   */
  async capture(requestId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(creditHoldsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(
          and(eq(creditHoldsTable.requestId, requestId), eq(creditHoldsTable.status, "pending"))
        );
      await tx
        .update(creditTransactionsTable)
        .set({ status: "completed" })
        .where(eq(creditTransactionsTable.requestId, requestId));
    });
  },

  /**
   * Refund a pending hold: restore balance and mark hold + transaction as
   * refunded.
   */
  async refund(requestId: string, reason?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Atomically claim the pending hold — concurrent refund callers (e.g. the
      // stale-hold worker racing an application failure) get zero rows and stop.
      const claimed = await tx
        .update(creditHoldsTable)
        .set({ status: "refunded", refundedAt: new Date() })
        .where(and(eq(creditHoldsTable.requestId, requestId), eq(creditHoldsTable.status, "pending")))
        .returning();
      const hold = claimed[0];
      if (!hold) return;

      // Restore balance atomically — back into the same buckets it was held from
      const hp = (hold as any).heldPromo ?? 0;
      const he = (hold as any).heldEarned ?? 0;
      const hd = (hold as any).heldPaid ?? 0;
      // Legacy holds (before buckets existed) restore to promo
      const legacyPromo = hp + he + hd === hold.creditsHeld ? 0 : hold.creditsHeld;
      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance = balance + ${hold.creditsHeld},
            promo_balance  = promo_balance  + ${legacyPromo > 0 ? legacyPromo : hp},
            earned_balance = earned_balance + ${legacyPromo > 0 ? 0 : he},
            paid_balance   = paid_balance   + ${legacyPromo > 0 ? 0 : hd},
            total_spent = GREATEST(0, total_spent - ${hold.creditsHeld}),
            updated_at = NOW()
        WHERE teacher_id = ${hold.teacherId}
      `);

      // Insert refund transaction
      await tx.insert(creditTransactionsTable).values({
        teacherId: hold.teacherId,
        amount: hold.creditsHeld,
        type: "refund",
        reason: reason ?? "فشل تنفيذ العملية",
        toolKey: hold.toolKey,
        requestId: `refund_${requestId}`,
        status: "completed",
      });

      // Mark original transaction as refunded
      await tx
        .update(creditTransactionsTable)
        .set({ status: "refunded" })
        .where(eq(creditTransactionsTable.requestId, requestId));
    });
  },

  // ── Admin mutations ──────────────────────────────────────────────────────────

  /**
   * Manually add / deduct / set a teacher's balance. All mutations are logged
   * as `adjust` transactions.
   */
  async adjustBalance(
    teacherId: number,
    delta: number,
    reason: string,
    adminId: number,
    mode: "add" | "deduct" | "set" = "add"
  ): Promise<number> {
    return await db.transaction(async (tx) => {
      // Ensure account row exists
      await tx.execute(sql`
        INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
        VALUES (${teacherId}, 0, 0, 0, NOW())
        ON CONFLICT (teacher_id) DO NOTHING
      `);

      const lockResult = await tx.execute(sql`
        SELECT balance, promo_balance, earned_balance, paid_balance FROM credit_accounts
        WHERE teacher_id = ${teacherId}
        FOR UPDATE
      `);
      const acct = lockResult.rows[0] as any;
      const current = Number(acct?.balance ?? 0);

      let newBalance: number;
      let actualDelta: number;

      if (mode === "set") {
        newBalance = Math.max(0, delta);
        actualDelta = newBalance - current;
      } else if (mode === "deduct") {
        newBalance = Math.max(0, current - delta);
        actualDelta = newBalance - current;
      } else {
        newBalance = current + delta;
        actualDelta = delta;
      }

      const earnedDelta = actualDelta > 0 ? actualDelta : 0;
      const spentDelta  = actualDelta < 0 ? -actualDelta : 0;

      // Buckets: additions go to promo; deductions follow the promo→earned→paid order
      let promoDelta = 0, earnedBucketDelta = 0, paidDelta = 0;
      if (actualDelta >= 0) {
        promoDelta = actualDelta;
      } else {
        const split = splitDeduction(-actualDelta, {
          promo:  Number(acct?.promo_balance  ?? 0),
          earned: Number(acct?.earned_balance ?? 0),
          paid:   Number(acct?.paid_balance   ?? 0),
        });
        promoDelta = -split.promo;
        earnedBucketDelta = -split.earned;
        paidDelta = -split.paid;
      }

      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance = ${newBalance},
            promo_balance  = promo_balance  + ${promoDelta},
            earned_balance = earned_balance + ${earnedBucketDelta},
            paid_balance   = paid_balance   + ${paidDelta},
            total_earned = total_earned + ${earnedDelta},
            total_spent  = total_spent  + ${spentDelta},
            updated_at   = NOW()
        WHERE teacher_id = ${teacherId}
      `);

      await tx.insert(creditTransactionsTable).values({
        teacherId,
        amount: actualDelta,
        type: "adjust",
        reason,
        adminId,
        status: "completed",
        creditType: "promo",
        source: "admin_adjustment",
      });

      return newBalance;
    });
  },

  // ── Paid credits (Lemon Squeezy purchases) ──────────────────────────────────

  /**
   * إضافة رصيد مدفوع بعد Webhook موثّق. تُستدعى داخل Transaction معالجة
   * الـ Webhook (يُمرَّر لها tx). الرصيد المدفوع لا ينتهي (expires_at = NULL).
   */
  async addPurchasedCredits(
    tx: any,
    teacherId: number,
    credits: number,
    purchaseId: number,
    requestId: string,
    reason: string
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
      VALUES (${teacherId}, 0, 0, 0, NOW())
      ON CONFLICT (teacher_id) DO NOTHING
    `);
    await tx.execute(sql`
      UPDATE credit_accounts
      SET balance = balance + ${credits},
          paid_balance = paid_balance + ${credits},
          total_earned = total_earned + ${credits},
          updated_at = NOW()
      WHERE teacher_id = ${teacherId}
    `);
    await tx.insert(creditTransactionsTable).values({
      teacherId,
      amount: credits,
      type: "earn",
      reason,
      requestId,
      status: "completed",
      creditType: "paid",
      source: "package_purchase",
      expiresAt: null,
      purchaseId,
    });
  },

  /**
   * سحب رصيد بعد Refund. يخصم من المدفوع أولاً ثم المكتسب ثم المجاني،
   * ولا ينشئ رصيداً سالباً أبداً — العجز يُعاد كـ shortfall ليُسجّل
   * refund_adjustment_required على عملية الشراء.
   */
  async deductRefundedCredits(
    tx: any,
    teacherId: number,
    credits: number,
    purchaseId: number,
    requestId: string,
    reason: string
  ): Promise<{ deducted: number; shortfall: number }> {
    await tx.execute(sql`
      INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
      VALUES (${teacherId}, 0, 0, 0, NOW())
      ON CONFLICT (teacher_id) DO NOTHING
    `);
    const lockResult = await tx.execute(sql`
      SELECT balance, promo_balance, earned_balance, paid_balance FROM credit_accounts
      WHERE teacher_id = ${teacherId}
      FOR UPDATE
    `);
    const acct = lockResult.rows[0] as any;
    const current = Number(acct?.balance ?? 0);
    const deducted = Math.min(credits, Math.max(0, current));
    const shortfall = credits - deducted;

    if (deducted > 0) {
      // للاسترجاع: نخصم من المدفوع أولاً (هو ما يُسترجع)، ثم المكتسب، ثم المجاني
      const paidAvail   = Number(acct?.paid_balance   ?? 0);
      const earnedAvail = Number(acct?.earned_balance ?? 0);
      const fromPaid   = Math.min(deducted, Math.max(0, paidAvail));
      const fromEarned = Math.min(deducted - fromPaid, Math.max(0, earnedAvail));
      const fromPromo  = deducted - fromPaid - fromEarned;

      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance = balance - ${deducted},
            paid_balance   = paid_balance   - ${fromPaid},
            earned_balance = earned_balance - ${fromEarned},
            promo_balance  = promo_balance  - ${fromPromo},
            updated_at = NOW()
        WHERE teacher_id = ${teacherId}
      `);
    }

    await tx.insert(creditTransactionsTable).values({
      teacherId,
      amount: -deducted,
      type: "adjust",
      reason: shortfall > 0 ? `${reason} (عجز ${shortfall} — يتطلب مراجعة)` : reason,
      requestId,
      status: "completed",
      creditType: "paid",
      source: "order_refund",
      purchaseId,
    });

    return { deducted, shortfall };
  },

  /**
   * Apply the same delta to every teacher that has a credit account. Creates
   * one transaction row per teacher for audit trail.
   */
  async bulkAdjustBalance(
    delta: number,
    reason: string,
    adminId: number
  ): Promise<number> {
    const accounts = await db
      .select({ teacherId: creditAccountsTable.teacherId })
      .from(creditAccountsTable);

    for (const { teacherId } of accounts) {
      await this.adjustBalance(teacherId, delta, reason, adminId, "add");
    }

    return accounts.length;
  },

  // ── Query ────────────────────────────────────────────────────────────────────

  async listTransactions(
    filters: TransactionFilter,
    page = 1,
    pageSize = 50
  ) {
    const conditions = buildTransactionConditions(filters);
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select()
      .from(creditTransactionsTable)
      .where(conditions)
      .orderBy(sql`created_at DESC`)
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(creditTransactionsTable)
      .where(conditions);

    return { rows, total, page, pageSize };
  },

  async exportTransactionsCsv(filters: TransactionFilter): Promise<string> {
    const conditions = buildTransactionConditions(filters);
    const rows = await db
      .select()
      .from(creditTransactionsTable)
      .where(conditions)
      .orderBy(sql`created_at DESC`);

    const header = "id,teacher_id,amount,type,reason,tool_key,request_id,status,admin_id,created_at\n";
    const body = rows
      .map((r) =>
        [
          r.id,
          r.teacherId,
          r.amount,
          r.type,
          `"${(r.reason ?? "").replace(/"/g, '""')}"`,
          r.toolKey ?? "",
          r.requestId ?? "",
          r.status,
          r.adminId ?? "",
          r.createdAt.toISOString(),
        ].join(",")
      )
      .join("\n");

    return header + body;
  },

  // ── Auto-refund stale holds ──────────────────────────────────────────────────

  /**
   * Reads each hold's snapshot `timeout_seconds` and refunds those past their
   * deadline. Called by a 60-second setInterval in the API server entrypoint.
   */
  async autoRefundStaleHolds(): Promise<void> {
    const stale = await db
      .select()
      .from(creditHoldsTable)
      .where(
        and(
          eq(creditHoldsTable.status, "pending"),
          sql`created_at + (timeout_seconds || ' seconds')::interval < NOW()`
        )
      );

    for (const hold of stale) {
      try {
        await this.refund(hold.requestId, "انتهت مهلة العملية تلقائياً");
      } catch {
        // ignore individual failures — will be retried next tick
      }
    }
  },

  // ── Summary stats ────────────────────────────────────────────────────────────

  async getSummary() {
    const accountsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(total_earned), 0)::int AS total_earned,
        COALESCE(SUM(total_spent),  0)::int AS total_spent,
        COUNT(*)::int                        AS teacher_count
      FROM credit_accounts
    `);

    const holdsResult = await db.execute(sql`
      SELECT COALESCE(SUM(credits_held), 0)::int AS total_held
      FROM credit_holds
      WHERE status = 'pending'
    `);

    const opsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int                                            AS operation_count,
        COUNT(*) FILTER (WHERE type = 'refund')::int            AS refund_count
      FROM credit_transactions
    `);

    const topToolsResult = await db.execute(sql`
      SELECT tool_key, COALESCE(SUM(ABS(amount)), 0)::int AS total_credits
      FROM credit_transactions
      WHERE type = 'spend' AND tool_key IS NOT NULL
      GROUP BY tool_key
      ORDER BY total_credits DESC
      LIMIT 5
    `);

    const accts = accountsResult.rows[0] as any;
    const holds = holdsResult.rows[0] as any;
    const ops   = opsResult.rows[0] as any;

    return {
      totalEarned:    Number(accts?.total_earned   ?? 0),
      totalSpent:     Number(accts?.total_spent    ?? 0),
      totalHeld:      Number(holds?.total_held     ?? 0),
      teacherCount:   Number(accts?.teacher_count  ?? 0),
      operationCount: Number(ops?.operation_count  ?? 0),
      refundCount:    Number(ops?.refund_count     ?? 0),
      topTools:       topToolsResult.rows,
    };
  },
};

// ─── Condition builder ────────────────────────────────────────────────────────

function buildTransactionConditions(filters: TransactionFilter) {
  const parts: ReturnType<typeof eq>[] = [];
  if (filters.teacherId) parts.push(eq(creditTransactionsTable.teacherId, filters.teacherId));
  if (filters.type)      parts.push(eq(creditTransactionsTable.type, filters.type));
  if (filters.toolKey)   parts.push(eq(creditTransactionsTable.toolKey, filters.toolKey));
  if (filters.status)    parts.push(eq(creditTransactionsTable.status, filters.status));
  if (filters.fromDate)  parts.push(sql`${creditTransactionsTable.createdAt} >= ${filters.fromDate}`);
  if (filters.toDate)    parts.push(sql`${creditTransactionsTable.createdAt} <= ${filters.toDate}`);
  return parts.length > 0 ? and(...(parts as [any, ...any[]])) : undefined;
}
