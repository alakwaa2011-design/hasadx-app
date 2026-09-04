import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Subscription Credit Grants — one row per Lemon Squeezy invoice.
 *
 * This is the primary guard against granting credits for the same
 * invoice more than once. credits_granted may be 0 (e.g. when the
 * user is already at the rollover cap) — the row is always inserted
 * so the invoice cannot be reprocessed later.
 *
 * Flow (inside one locked transaction):
 *   1. INSERT this row (ON CONFLICT subscription_invoice_id DO NOTHING → RETURNING)
 *   2. If no row returned → already processed → return alreadyGranted: true
 *   3. Calculate credits to grant
 *   4. INSERT credit_batch (if > 0)
 *   5. UPDATE credits_granted = actual amount
 */
export const subscriptionCreditGrantsTable = pgTable(
  "subscription_credit_grants",
  {
    id:                    serial("id").primaryKey(),
    /** Lemon Squeezy invoice object ID (payload.data.id) */
    subscriptionInvoiceId: text("subscription_invoice_id").notNull(),
    /** Lemon Squeezy subscription ID (payload.data.attributes.subscription_id) */
    subscriptionId:        text("subscription_id").notNull(),
    teacherId:             integer("teacher_id").notNull(),
    planCode:              text("plan_code").notNull(),
    /** Actual credits granted (0 = rollover cap reached) */
    creditsGranted:        integer("credits_granted").notNull().default(0),
    periodEnd:             timestamp("period_end").notNull(),
    /** Stable annual monthly-release key; NULL for legacy monthly invoice grants. */
    creditCycleKey:         text("credit_cycle_key"),
    createdAt:             timestamp("created_at").notNull().default(sql`NOW()`),
  },
  (t) => ({
    invoiceUniq:    uniqueIndex("scg_invoice_uniq").on(t.subscriptionInvoiceId),
    teacherIdx:     index("scg_teacher_idx").on(t.teacherId),
    subscriptionIdx: index("scg_subscription_idx").on(t.subscriptionId),
    cycleUniq:      uniqueIndex("scg_credit_cycle_uniq").on(t.creditCycleKey),
  }),
);

export type SubscriptionCreditGrant    = typeof subscriptionCreditGrantsTable.$inferSelect;
export type NewSubscriptionCreditGrant = typeof subscriptionCreditGrantsTable.$inferInsert;
