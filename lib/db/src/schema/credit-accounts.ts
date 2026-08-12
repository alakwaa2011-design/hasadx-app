import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditAccountsTable = pgTable("credit_accounts", {
  teacherId:   integer("teacher_id").primaryKey(),
  /**
   * المجموع الكلي = free + subscription + promo + earned + paid
   * cache للأداء فقط — credit_batches هو Source of Truth
   */
  balance:     integer("balance").notNull().default(0),
  /** رصيد مدفوع (purchased) — لا ينتهي أبداً */
  paidBalance:         integer("paid_balance").notNull().default(0),
  /** رصيد مجاني/ترويجي */
  promoBalance:        integer("promo_balance").notNull().default(0),
  /** رصيد مكتسب (مكافآت/إحالات) */
  earnedBalance:       integer("earned_balance").notNull().default(0),
  /** رصيد الاشتراك الشهري — ينتهي بنهاية دورة الاشتراك */
  subscriptionBalance: integer("subscription_balance").notNull().default(0),
  /** رصيد مجاني شهري — يُستبدل كل 30 يوم */
  freeBalance:         integer("free_balance").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  totalSpent:  integer("total_spent").notNull().default(0),
  updatedAt:   timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type CreditAccount = typeof creditAccountsTable.$inferSelect;
export type NewCreditAccount = typeof creditAccountsTable.$inferInsert;
