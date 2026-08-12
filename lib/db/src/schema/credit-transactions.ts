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
  /** paid | promo | earned — مصدر نوع الرصيد */
  creditType: text("credit_type").notNull().default("promo"),
  /** package_purchase | referral | profile_completion | admin_adjustment | refund_adjustment | tool_usage | welcome */
  source:     text("source"),
  /** الرصيد المدفوع لا ينتهي: NULL دائماً للمدفوع */
  expiresAt:  timestamp("expires_at"),
  /** ربط الحركة بعملية شراء */
  purchaseId: integer("purchase_id"),
  createdAt: timestamp("created_at").notNull().default(sql`NOW()`),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
export type NewCreditTransaction = typeof creditTransactionsTable.$inferInsert;
