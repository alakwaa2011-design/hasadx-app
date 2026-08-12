import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditHoldsTable = pgTable("credit_holds", {
  id:              serial("id").primaryKey(),
  teacherId:       integer("teacher_id").notNull(),
  toolKey:         text("tool_key").notNull(),
  creditsHeld:     integer("credits_held").notNull(),
  requestId:       text("request_id").notNull().unique(),
  /** pending | completed | refunded */
  status:          text("status").notNull().default("pending"),
  /** snapshot of timeout_seconds at hold time so admin changes don't affect in-flight holds */
  timeoutSeconds:  integer("timeout_seconds").notNull().default(60),
  /** breakdown of the hold across balance buckets — refunds restore to the same buckets */
  heldPromo:       integer("held_promo").notNull().default(0),
  heldEarned:      integer("held_earned").notNull().default(0),
  heldPaid:        integer("held_paid").notNull().default(0),
  createdAt:       timestamp("created_at").notNull().default(sql`NOW()`),
  completedAt:     timestamp("completed_at"),
  refundedAt:      timestamp("refunded_at"),
});

export type CreditHold = typeof creditHoldsTable.$inferSelect;
export type NewCreditHold = typeof creditHoldsTable.$inferInsert;
