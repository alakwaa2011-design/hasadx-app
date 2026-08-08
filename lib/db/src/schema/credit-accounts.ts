import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditAccountsTable = pgTable("credit_accounts", {
  teacherId:   integer("teacher_id").primaryKey(),
  balance:     integer("balance").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  totalSpent:  integer("total_spent").notNull().default(0),
  updatedAt:   timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type CreditAccount = typeof creditAccountsTable.$inferSelect;
export type NewCreditAccount = typeof creditAccountsTable.$inferInsert;
