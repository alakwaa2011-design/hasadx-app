import { pgTable, serial, integer, index } from "drizzle-orm/pg-core";

/**
 * Credit Hold Items — maps each hold to the exact batches it drew from.
 *
 * When a hold needs credits from multiple batches, one row per batch is
 * inserted here. Refunds use these rows to restore to the exact same batches.
 *
 * Replaces the per-bucket columns (held_promo / held_earned / held_paid) for
 * new-style holds. Legacy holds (no items) continue using those columns.
 */
export const creditHoldItemsTable = pgTable(
  "credit_hold_items",
  {
    id:      serial("id").primaryKey(),
    holdId:  integer("hold_id").notNull(),
    batchId: integer("batch_id").notNull(),
    amount:  integer("amount").notNull(),
  },
  (t) => ({
    holdIdx:  index("credit_hold_items_hold_idx").on(t.holdId),
    batchIdx: index("credit_hold_items_batch_idx").on(t.batchId),
  }),
);

export type CreditHoldItem    = typeof creditHoldItemsTable.$inferSelect;
export type NewCreditHoldItem = typeof creditHoldItemsTable.$inferInsert;
