import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Credit Batches — each row is an individual credit grant.
 *
 * This is the SOURCE OF TRUTH for credit balances.
 * credit_accounts columns are a denormalized cache for fast reads.
 *
 * source values:
 *   'free'         — monthly free-tier reset (expires in 30 days)
 *   'subscription' — from Basic/Pro plan renewal (expires at period end)
 *   'purchased'    — one-time Lemon Squeezy purchase (never expires)
 *   'promo'        — admin-granted promotional credits
 *   'earned'       — referrals / rewards
 *   'admin'        — manual admin adjustment
 *
 * Deduction order: sort by expires_at ASC NULLS LAST (expiring first, never-expiring last).
 */
export const creditBatchesTable = pgTable(
  "credit_batches",
  {
    id:              serial("id").primaryKey(),
    teacherId:       integer("teacher_id").notNull(),
    /** 'free' | 'subscription' | 'purchased' | 'promo' | 'earned' | 'admin' */
    source:          text("source").notNull(),
    /** Original amount when granted */
    amount:          integer("amount").notNull(),
    /** Remaining amount — decremented on hold, restored on refund */
    amountRemaining: integer("amount_remaining").notNull(),
    /** NULL = never expires. free/subscription batches have a concrete date. */
    expiresAt:       timestamp("expires_at"),
    /** purchase_id, subscription webhook event id, admin note, etc. */
    referenceId:     text("reference_id"),
    /** For subscription batches: the plan code that generated this batch */
    planCode:        text("plan_code"),
    createdAt:       timestamp("created_at").notNull().default(sql`NOW()`),
    updatedAt:       timestamp("updated_at").notNull().default(sql`NOW()`),
  },
  (t) => ({
    teacherIdx:  index("credit_batches_teacher_idx").on(t.teacherId),
    expiresIdx:  index("credit_batches_expires_idx").on(t.teacherId, t.expiresAt),
    sourceIdx:   index("credit_batches_source_idx").on(t.teacherId, t.source),
  }),
);

export type CreditBatch    = typeof creditBatchesTable.$inferSelect;
export type NewCreditBatch = typeof creditBatchesTable.$inferInsert;
