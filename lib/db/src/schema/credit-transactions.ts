import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditTransactionsTable = pgTable("credit_transactions", {
  id:        serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  amount:    integer("amount").notNull(),
  /** earn | spend | adjust | refund */
  type:      text("type").notNull(),
  reason:    text("reason"),
  toolKey:   text("tool_key"),
  requestId: text("request_id").unique(),
  /** pending | completed | refunded */
  status:    text("status").notNull().default("completed"),
  adminId:   integer("admin_id"),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
export type NewCreditTransaction = typeof creditTransactionsTable.$inferInsert;
