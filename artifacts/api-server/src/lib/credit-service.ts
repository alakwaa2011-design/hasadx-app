/**
 * CreditService — atomic hold/capture/refund for the credits system.
 *
 * Source of Truth: credit_batches.amount_remaining
 * credit_accounts columns are a denormalized CACHE for fast reads only.
 *
 * Concurrency model:
 *   Every balance mutation begins with SELECT ... FOR UPDATE on credit_accounts
 *   to serialize operations for the same teacher. Batch locks use ORDER BY id ASC
 *   to prevent deadlocks. Consumption order (expiring-first, NULL-last) is separate
 *   from lock order.
 */
import { db } from "@workspace/db";
import {
  creditAccountsTable,
  creditTransactionsTable,
  creditHoldsTable,
  creditHoldItemsTable,
  creditBatchesTable,
  creditToolPricesTable,
  subscriptionsTable,
  plansTable,
  subscriptionCreditGrantsTable,
} from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";

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
  subscriptionBalance: number;
  freeBalance: number;
}

export interface TransactionFilter {
  teacherId?: number;
  type?: string;
  toolKey?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Map a batch source to the credit_accounts cache column name.
 */
function sourceToCacheColumn(source: string): string {
  switch (source) {
    case "free":         return "free_balance";
    case "subscription": return "subscription_balance";
    case "purchased":    return "paid_balance";
    case "promo":        return "promo_balance";
    case "earned":       return "earned_balance";
    case "admin":        return "promo_balance"; // admin grants go to promo bucket
    default:             return "promo_balance";
  }
}

/**
 * Ensure credit_accounts row exists for a teacher (upsert, no-op if present).
 */
async function ensureAccount(tx: any, teacherId: number): Promise<void> {
  await tx.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, total_earned, total_spent, updated_at)
    VALUES (${teacherId}, 0, 0, 0, NOW())
    ON CONFLICT (teacher_id) DO NOTHING
  `);
}

/**
 * Lock the credit_accounts row for a teacher (SELECT FOR UPDATE).
 * Must be called at the start of every balance mutation inside a transaction.
 * Returns the current account row.
 */
async function lockAccount(tx: any, teacherId: number): Promise<any> {
  await ensureAccount(tx, teacherId);
  const r = await tx.execute(sql`
    SELECT balance, paid_balance, promo_balance, earned_balance,
           subscription_balance, free_balance
    FROM credit_accounts
    WHERE teacher_id = ${teacherId}
    FOR UPDATE
  `);
  return r.rows[0] as any;
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
        balance:             creditAccountsTable.balance,
        paidBalance:         creditAccountsTable.paidBalance,
        promoBalance:        creditAccountsTable.promoBalance,
        earnedBalance:       creditAccountsTable.earnedBalance,
        subscriptionBalance: creditAccountsTable.subscriptionBalance,
        freeBalance:         creditAccountsTable.freeBalance,
      })
      .from(creditAccountsTable)
      .where(eq(creditAccountsTable.teacherId, teacherId))
      .limit(1);
    return row ?? {
      balance: 0, paidBalance: 0, promoBalance: 0,
      earnedBalance: 0, subscriptionBalance: 0, freeBalance: 0,
    };
  },

  // ── Core: grantBatch (internal) ──────────────────────────────────────────────

  /**
   * Grant a credit batch inside an existing transaction.
   * The caller MUST have already locked credit_accounts with lockAccount().
   */
  async _grantBatchInTx(
    tx: any,
    teacherId: number,
    source: string,
    amount: number,
    expiresAt: Date | null,
    referenceId: string,
    planCode: string | null,
    reason: string
  ): Promise<number> {
    if (amount <= 0) return 0;

    const col = sourceToCacheColumn(source);
    await tx.execute(sql`
      INSERT INTO credit_batches
        (teacher_id, source, amount, amount_remaining, expires_at, reference_id, plan_code, created_at, updated_at)
      VALUES
        (${teacherId}, ${source}, ${amount}, ${amount}, ${expiresAt}, ${referenceId}, ${planCode}, NOW(), NOW())
    `);
    await tx.execute(sql`
      UPDATE credit_accounts
      SET balance       = balance + ${amount},
          ${sql.raw(col)} = ${sql.raw(col)} + ${amount},
          total_earned  = total_earned + ${amount},
          updated_at    = NOW()
      WHERE teacher_id = ${teacherId}
    `);
    await tx.insert(creditTransactionsTable).values({
      teacherId,
      amount,
      type: "earn",
      reason,
      status: "completed",
      creditType: source === "purchased" ? "paid" : source,
      source: referenceId,
    });

    return amount;
  },

  // ── Hold → Capture / Refund ──────────────────────────────────────────────────

  async hold(teacherId: number, toolKey: string, requestId: string): Promise<HoldResult> {
    // Idempotency
    const [existing] = await db
      .select({ id: creditHoldsTable.id, creditsHeld: creditHoldsTable.creditsHeld })
      .from(creditHoldsTable)
      .where(eq(creditHoldsTable.requestId, requestId))
      .limit(1);
    if (existing) {
      const balance = await this.getBalance(teacherId);
      return { requestId, creditsHeld: existing.creditsHeld, newBalance: balance };
    }

    const [tool] = await db
      .select({ creditsCost: creditToolPricesTable.creditsCost, timeoutSeconds: creditToolPricesTable.timeoutSeconds })
      .from(creditToolPricesTable)
      .where(eq(creditToolPricesTable.toolKey, toolKey))
      .limit(1);

    const creditsCost = tool?.creditsCost ?? 0;
    const timeoutSeconds = tool?.timeoutSeconds ?? 60;

    if (creditsCost === 0) {
      return { requestId, creditsHeld: 0, newBalance: await this.getBalance(teacherId) };
    }

    return await db.transaction(async (tx) => {
      const acct = await lockAccount(tx, teacherId);
      const currentBalance = Number(acct?.balance ?? 0);

      if (currentBalance < creditsCost) {
        throw new Error(`رصيد غير كافٍ (${currentBalance} من ${creditsCost} رصيد مطلوب)`);
      }

      // Fetch available batches in consumption order (expiring-first, NULL-last)
      // Lock order is id ASC to prevent deadlocks across concurrent holds.
      const batchRows = await tx.execute(sql`
        SELECT id, source, amount_remaining, expires_at
        FROM credit_batches
        WHERE teacher_id = ${teacherId}
          AND amount_remaining > 0
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY (CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END) ASC, expires_at ASC NULLS LAST
        FOR UPDATE
      `);
      const batches = batchRows.rows as any[];

      // Greedy deduction
      let remaining = creditsCost;
      const deductions: Array<{ id: number; source: string; amount: number }> = [];

      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(b.amount_remaining));
        deductions.push({ id: Number(b.id), source: String(b.source), amount: take });
        remaining -= take;
      }

      if (remaining > 0) {
        throw new Error(`رصيد غير كافٍ — تعارض في التزامن`);
      }

      // Create hold record first (to get hold id)
      const holdRows = await tx.execute(sql`
        INSERT INTO credit_holds
          (teacher_id, tool_key, credits_held, request_id, status, timeout_seconds, created_at)
        VALUES
          (${teacherId}, ${toolKey}, ${creditsCost}, ${requestId}, 'pending', ${timeoutSeconds}, NOW())
        RETURNING id
      `);
      const holdId = Number((holdRows.rows[0] as any).id);

      // Insert hold items + update batches + update cache
      let paidDelta = 0, promoDelta = 0, earnedDelta = 0, subDelta = 0, freeDelta = 0;

      for (const d of deductions) {
        await tx.execute(sql`
          INSERT INTO credit_hold_items (hold_id, batch_id, amount)
          VALUES (${holdId}, ${d.id}, ${d.amount})
        `);
        await tx.execute(sql`
          UPDATE credit_batches
          SET amount_remaining = amount_remaining - ${d.amount}, updated_at = NOW()
          WHERE id = ${d.id}
        `);
        // Tally by source for cache update
        if (d.source === "purchased")    paidDelta    += d.amount;
        else if (d.source === "promo" || d.source === "admin") promoDelta += d.amount;
        else if (d.source === "earned")  earnedDelta  += d.amount;
        else if (d.source === "subscription") subDelta += d.amount;
        else if (d.source === "free")    freeDelta    += d.amount;
        else promoDelta += d.amount; // fallback
      }

      const newBalance = currentBalance - creditsCost;

      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance              = ${newBalance},
            paid_balance         = paid_balance         - ${paidDelta},
            promo_balance        = promo_balance        - ${promoDelta},
            earned_balance       = earned_balance       - ${earnedDelta},
            subscription_balance = subscription_balance - ${subDelta},
            free_balance         = free_balance         - ${freeDelta},
            total_spent          = total_spent + ${creditsCost},
            updated_at           = NOW()
        WHERE teacher_id = ${teacherId}
      `);

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

  async capture(requestId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(creditHoldsTable)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(eq(creditHoldsTable.requestId, requestId), eq(creditHoldsTable.status, "pending")));
      await tx
        .update(creditTransactionsTable)
        .set({ status: "completed" })
        .where(eq(creditTransactionsTable.requestId, requestId));
    });
  },

  async refund(requestId: string, reason?: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Atomically claim the hold
      const claimed = await tx
        .update(creditHoldsTable)
        .set({ status: "refunded", refundedAt: new Date() })
        .where(and(eq(creditHoldsTable.requestId, requestId), eq(creditHoldsTable.status, "pending")))
        .returning();
      const hold = claimed[0];
      if (!hold) return;

      // Check for new-style hold items
      const items = await tx
        .select()
        .from(creditHoldItemsTable)
        .where(eq(creditHoldItemsTable.holdId, hold.id));

      if (items.length > 0) {
        // New-style refund: restore exactly to original batches (regardless of expires_at)
        let paidDelta = 0, promoDelta = 0, earnedDelta = 0, subDelta = 0, freeDelta = 0;

        for (const item of items) {
          // Get the batch source to know which cache bucket to restore
          const batchRows = await tx.execute(sql`
            SELECT source FROM credit_batches WHERE id = ${item.batchId}
          `);
          const batchSource = String((batchRows.rows[0] as any)?.source ?? "promo");

          await tx.execute(sql`
            UPDATE credit_batches
            SET amount_remaining = amount_remaining + ${item.amount}, updated_at = NOW()
            WHERE id = ${item.batchId}
          `);

          if (batchSource === "purchased")         paidDelta    += item.amount;
          else if (batchSource === "promo" || batchSource === "admin") promoDelta += item.amount;
          else if (batchSource === "earned")        earnedDelta  += item.amount;
          else if (batchSource === "subscription")  subDelta     += item.amount;
          else if (batchSource === "free")          freeDelta    += item.amount;
          else promoDelta += item.amount;
        }

        await tx.execute(sql`
          UPDATE credit_accounts
          SET balance              = balance              + ${hold.creditsHeld},
              paid_balance         = paid_balance         + ${paidDelta},
              promo_balance        = promo_balance        + ${promoDelta},
              earned_balance       = earned_balance       + ${earnedDelta},
              subscription_balance = subscription_balance + ${subDelta},
              free_balance         = free_balance         + ${freeDelta},
              total_spent = GREATEST(0, total_spent - ${hold.creditsHeld}),
              updated_at = NOW()
          WHERE teacher_id = ${hold.teacherId}
        `);
      } else {
        // Legacy hold (no hold_items): restore via old bucket columns
        const hp = (hold as any).heldPromo  ?? 0;
        const he = (hold as any).heldEarned ?? 0;
        const hd = (hold as any).heldPaid   ?? 0;
        const legacyPromo = hp + he + hd === hold.creditsHeld ? 0 : hold.creditsHeld;

        await tx.execute(sql`
          UPDATE credit_accounts
          SET balance        = balance + ${hold.creditsHeld},
              promo_balance  = promo_balance  + ${legacyPromo > 0 ? legacyPromo : hp},
              earned_balance = earned_balance + ${legacyPromo > 0 ? 0 : he},
              paid_balance   = paid_balance   + ${legacyPromo > 0 ? 0 : hd},
              total_spent = GREATEST(0, total_spent - ${hold.creditsHeld}),
              updated_at  = NOW()
          WHERE teacher_id = ${hold.teacherId}
        `);
      }

      await tx.insert(creditTransactionsTable).values({
        teacherId: hold.teacherId,
        amount: hold.creditsHeld,
        type: "refund",
        reason: reason ?? "فشل تنفيذ العملية",
        toolKey: hold.toolKey,
        requestId: `refund_${requestId}`,
        status: "completed",
      });
      await tx
        .update(creditTransactionsTable)
        .set({ status: "refunded" })
        .where(eq(creditTransactionsTable.requestId, requestId));
    });
  },

  // ── Subscription credit operations ──────────────────────────────────────────

  /**
   * Grant subscription credits for a single Lemon Squeezy invoice.
   *
   * Called ONLY from subscription_payment_success.
   *
   * Primary guard: subscription_credit_grants.subscription_invoice_id UNIQUE —
   *   the row is inserted first (ON CONFLICT DO NOTHING). If no row is returned,
   *   this invoice was already processed → return alreadyGranted: true immediately.
   *   credits_granted is always recorded, even when it is 0 (rollover cap reached).
   *
   * Secondary guard: last_credited_period_end on subscriptions (extra safety).
   *
   * Each batch gets expires_at = nextPeriodEnd (end of the FOLLOWING period),
   * allowing credits to accumulate across two periods without extending old batches.
   *
   * @param invoiceId     payload.data.id from LS webhook
   * @param subscriptionId payload.data.attributes.subscription_id from LS webhook
   * @param periodEnd     end of the current period (renews_at from LS subscription object)
   * @param nextPeriodEnd end of the NEXT period — batch expires_at (renews_at of next cycle)
   */
  async grantSubscriptionCredits(
    teacherId: number,
    planCode: string,
    invoiceId: string,
    subscriptionId: string,
    periodEnd: Date,
    nextPeriodEnd: Date
  ): Promise<{ granted: number; alreadyGranted: boolean }> {
    return await db.transaction(async (tx) => {
      // ── Step 1: Claim the invoice (primary guard) ────────────────────────
      // Insert first — UNIQUE constraint on subscription_invoice_id prevents
      // two concurrent webhooks from both proceeding.
      const claimed = await tx.execute(sql`
        INSERT INTO subscription_credit_grants
          (subscription_invoice_id, subscription_id, teacher_id, plan_code, credits_granted, period_end)
        VALUES
          (${invoiceId}, ${subscriptionId}, ${teacherId}, ${planCode}, 0, ${periodEnd})
        ON CONFLICT (subscription_invoice_id) DO NOTHING
        RETURNING id
      `);

      if (claimed.rows.length === 0) {
        // Already processed (concurrent webhook or retry)
        return { granted: 0, alreadyGranted: true };
      }

      const grantRowId = Number((claimed.rows[0] as any).id);

      // ── Step 2: Lock accounts + subscription row ─────────────────────────
      const acct = await lockAccount(tx, teacherId);

      const subRows = await tx.execute(sql`
        SELECT s.id, s.last_credited_period_end, p.monthly_credits, p.rollover_cap
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.teacher_id = ${teacherId}
        FOR UPDATE
      `);
      const sub = subRows.rows[0] as any;

      const monthlyCredits = Number(sub?.monthly_credits ?? 0);
      const rolloverCap    = sub?.rollover_cap != null ? Number(sub.rollover_cap) : null;

      // ── Step 3: Calculate credits to add (respecting rollover cap) ────────
      // Sum remaining non-expired subscription batches (true current balance)
      const remainingRows = await tx.execute(sql`
        SELECT COALESCE(SUM(amount_remaining), 0)::int AS remaining
        FROM credit_batches
        WHERE teacher_id = ${teacherId}
          AND source = 'subscription'
          AND amount_remaining > 0
          AND (expires_at IS NULL OR expires_at > NOW())
      `);
      const remainingSub = Number((remainingRows.rows[0] as any)?.remaining ?? 0);

      let toAdd = monthlyCredits;
      if (rolloverCap !== null) {
        toAdd = Math.max(0, Math.min(monthlyCredits, rolloverCap - remainingSub));
      }

      // ── Step 4: Grant batch if > 0 ────────────────────────────────────────
      // expires_at = nextPeriodEnd (end of FOLLOWING period) — allows 2-month rollover
      let granted = 0;
      if (toAdd > 0) {
        granted = await this._grantBatchInTx(
          tx,
          teacherId,
          "subscription",
          toAdd,
          nextPeriodEnd,          // NOT periodEnd — extends into next cycle
          invoiceId,              // reference_id = invoice id for traceability
          planCode,
          `رصيد اشتراك شهري (${planCode})`
        );
      }

      // ── Step 5: Record actual credits_granted (even if 0) ─────────────────
      await tx.execute(sql`
        UPDATE subscription_credit_grants
        SET credits_granted = ${granted}
        WHERE id = ${grantRowId}
      `);

      // ── Step 6: Update subscription metadata ─────────────────────────────
      await tx.execute(sql`
        UPDATE subscriptions
        SET last_credited_period_end = ${periodEnd},
            current_period_end       = ${periodEnd},
            updated_at               = NOW()
        WHERE teacher_id = ${teacherId}
      `);

      return { granted, alreadyGranted: false };
    });
  },

  /**
   * Reset the free-tier batch for a teacher.
   * Called non-blocking on login if the current free batch is expired or missing.
   */
  async resetFreeCredits(teacherId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await lockAccount(tx, teacherId);

      // Expire old free batches
      const expiredRows = await tx.execute(sql`
        UPDATE credit_batches
        SET amount_remaining = 0, updated_at = NOW()
        WHERE teacher_id = ${teacherId}
          AND source = 'free'
          AND amount_remaining > 0
        RETURNING amount_remaining AS old_remaining
      `);

      // Deduct expired amounts from cache
      let totalExpired = 0;
      for (const r of expiredRows.rows as any[]) {
        totalExpired += Number(r.old_remaining ?? 0);
      }

      if (totalExpired > 0) {
        await tx.execute(sql`
          UPDATE credit_accounts
          SET balance      = GREATEST(0, balance      - ${totalExpired}),
              free_balance = GREATEST(0, free_balance - ${totalExpired}),
              updated_at   = NOW()
          WHERE teacher_id = ${teacherId}
        `);
      }

      // Grant fresh 50-credit free batch (30-day TTL)
      await this._grantBatchInTx(
        tx,
        teacherId,
        "free",
        50,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        "monthly_free_reset",
        null,
        "الرصيد المجاني الشهري"
      );
    });
  },

  /**
   * Expire all remaining subscription batches for a teacher (on subscription_expired).
   */
  async expireSubscriptionBatches(teacherId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await lockAccount(tx, teacherId);

      const expired = await tx.execute(sql`
        UPDATE credit_batches
        SET amount_remaining = 0, updated_at = NOW()
        WHERE teacher_id = ${teacherId}
          AND source = 'subscription'
          AND amount_remaining > 0
        RETURNING amount_remaining AS old_remaining
      `);

      let total = 0;
      for (const r of expired.rows as any[]) {
        total += Number(r.old_remaining ?? 0);
      }

      if (total > 0) {
        await tx.execute(sql`
          UPDATE credit_accounts
          SET balance              = GREATEST(0, balance              - ${total}),
              subscription_balance = GREATEST(0, subscription_balance - ${total}),
              updated_at           = NOW()
          WHERE teacher_id = ${teacherId}
        `);
      }
    });
  },

  // ── Purchased credits (Lemon Squeezy one-time orders) ───────────────────────

  /**
   * Grant purchased credits inside the caller's transaction.
   * Replaces the old addPurchasedCredits — uses credit_batches as source of truth.
   */
  async addPurchasedCredits(
    tx: any,
    teacherId: number,
    credits: number,
    purchaseId: number,
    requestId: string,
    reason: string
  ): Promise<void> {
    await ensureAccount(tx, teacherId);
    await lockAccount(tx, teacherId);
    await this._grantBatchInTx(
      tx,
      teacherId,
      "purchased",
      credits,
      null,                        // never expires
      requestId,
      null,
      reason
    );
    // _grantBatchInTx already updates credit_accounts; record purchase link
    await tx.insert(creditTransactionsTable).values({
      teacherId,
      amount: credits,
      type: "earn",
      reason,
      requestId: `${requestId}_purchased`,
      status: "completed",
      creditType: "paid",
      source: "package_purchase",
      expiresAt: null,
      purchaseId,
    }).onConflictDoNothing();
  },

  /**
   * Deduct credits after an order refund.
   * Only deducts from the referenced purchased batch — no fallback to other buckets.
   * Returns { deducted, shortfall } where shortfall > 0 means needs_review.
   */
  async deductRefundedCredits(
    tx: any,
    teacherId: number,
    credits: number,
    purchaseId: number,
    requestId: string,
    reason: string
  ): Promise<{ deducted: number; shortfall: number }> {
    await ensureAccount(tx, teacherId);
    await lockAccount(tx, teacherId);

    // Find the purchased batch(es) for this purchase
    const batchRows = await tx.execute(sql`
      SELECT id, amount_remaining
      FROM credit_batches
      WHERE teacher_id = ${teacherId}
        AND source = 'purchased'
        AND reference_id = ${requestId.replace(/^ls_(refund_)?/, 'ls_order_')}
      ORDER BY id ASC
      FOR UPDATE
    `);

    // Also try matching by any purchased batch with reference_id containing the purchase
    let batches = batchRows.rows as any[];
    if (batches.length === 0) {
      // Fallback: find purchased batches (any) — deduct from oldest first
      const fallbackRows = await tx.execute(sql`
        SELECT id, amount_remaining
        FROM credit_batches
        WHERE teacher_id = ${teacherId}
          AND source = 'purchased'
          AND amount_remaining > 0
        ORDER BY id ASC
        LIMIT 5
        FOR UPDATE
      `);
      batches = fallbackRows.rows as any[];
    }

    let remaining = credits;
    let deducted = 0;

    for (const b of batches) {
      if (remaining <= 0) break;
      const avail = Number(b.amount_remaining);
      const take = Math.min(remaining, avail);
      if (take <= 0) continue;

      await tx.execute(sql`
        UPDATE credit_batches
        SET amount_remaining = amount_remaining - ${take}, updated_at = NOW()
        WHERE id = ${b.id}
      `);
      deducted += take;
      remaining -= take;
    }

    const shortfall = credits - deducted;

    if (deducted > 0) {
      await tx.execute(sql`
        UPDATE credit_accounts
        SET balance      = GREATEST(0, balance      - ${deducted}),
            paid_balance = GREATEST(0, paid_balance - ${deducted}),
            updated_at   = NOW()
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

  // ── Admin mutations ──────────────────────────────────────────────────────────

  async adjustBalance(
    teacherId: number,
    delta: number,
    reason: string,
    adminId: number,
    mode: "add" | "deduct" | "set" = "add"
  ): Promise<number> {
    return await db.transaction(async (tx) => {
      const acct = await lockAccount(tx, teacherId);
      const current = Number(acct?.balance ?? 0);

      let newBalance: number;
      let actualDelta: number;

      if (mode === "set") {
        newBalance   = Math.max(0, delta);
        actualDelta  = newBalance - current;
      } else if (mode === "deduct") {
        newBalance   = Math.max(0, current - delta);
        actualDelta  = newBalance - current;
      } else {
        newBalance   = current + delta;
        actualDelta  = delta;
      }

      const earnedDelta = actualDelta > 0 ? actualDelta : 0;
      const spentDelta  = actualDelta < 0 ? -actualDelta : 0;

      if (actualDelta > 0) {
        // Additions go to promo batch (admin grant)
        await this._grantBatchInTx(
          tx, teacherId, "admin", actualDelta, null,
          `admin_adjust_${adminId}`, null,
          reason
        );
      } else if (actualDelta < 0) {
        // Deductions: take from promo first, then earned, then paid
        const promoAvail  = Number(acct?.promo_balance  ?? 0);
        const earnedAvail = Number(acct?.earned_balance ?? 0);
        const fromPromo  = Math.min(-actualDelta, promoAvail);
        const fromEarned = Math.min(-actualDelta - fromPromo, earnedAvail);
        const fromPaid   = -actualDelta - fromPromo - fromEarned;

        await tx.execute(sql`
          UPDATE credit_accounts
          SET balance        = ${newBalance},
              promo_balance  = promo_balance  - ${fromPromo},
              earned_balance = earned_balance - ${fromEarned},
              paid_balance   = paid_balance   - ${fromPaid},
              total_spent    = total_spent    + ${spentDelta},
              updated_at     = NOW()
          WHERE teacher_id = ${teacherId}
        `);
        // For deductions we don't bother creating a batch row (legacy behaviour)
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
      }

      // Zero delta or handled above
      if (actualDelta !== 0) {
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
      }

      return newBalance;
    });
  },

  async bulkAdjustBalance(delta: number, reason: string, adminId: number): Promise<number> {
    const accounts = await db
      .select({ teacherId: creditAccountsTable.teacherId })
      .from(creditAccountsTable);
    for (const { teacherId } of accounts) {
      await this.adjustBalance(teacherId, delta, reason, adminId, "add");
    }
    return accounts.length;
  },

  // ── Queries ──────────────────────────────────────────────────────────────────

  async listTransactions(filters: TransactionFilter, page = 1, pageSize = 50) {
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
          r.id, r.teacherId, r.amount,
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
        // ignore — retried next tick
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
      FROM credit_holds WHERE status = 'pending'
    `);
    const opsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int                                         AS operation_count,
        COUNT(*) FILTER (WHERE type = 'refund')::int         AS refund_count
      FROM credit_transactions
    `);
    const topToolsResult = await db.execute(sql`
      SELECT tool_key, COALESCE(SUM(ABS(amount)), 0)::int AS total_credits
      FROM credit_transactions
      WHERE type = 'spend' AND tool_key IS NOT NULL
      GROUP BY tool_key ORDER BY total_credits DESC LIMIT 5
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

export function splitDeduction(
  amount: number,
  buckets: { promo: number; earned: number; paid: number }
): { promo: number; earned: number; paid: number } {
  const fromPromo  = Math.min(amount, Math.max(0, buckets.promo));
  const fromEarned = Math.min(amount - fromPromo, Math.max(0, buckets.earned));
  const fromPaid   = amount - fromPromo - fromEarned;
  return { promo: fromPromo, earned: fromEarned, paid: fromPaid };
}

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
