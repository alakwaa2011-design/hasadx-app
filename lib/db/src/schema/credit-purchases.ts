import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * عمليات شراء الرصيد عبر Lemon Squeezy.
 * لا يمثل رصيداً — الرصيد يُضاف في credit_accounts/credit_transactions بعد Webhook موثّق فقط.
 */
export const creditPurchasesTable = pgTable("credit_purchases", {
  id:                serial("id").primaryKey(),
  purchaseIntentId:  text("purchase_intent_id").notNull().unique(),
  teacherId:         integer("teacher_id").notNull(),
  packageId:         integer("package_id").notNull(),
  lemonOrderId:      text("lemon_order_id").unique(),
  lemonVariantId:    text("lemon_variant_id").notNull(),
  amountCents:       integer("amount_cents").notNull(),
  currency:          text("currency").notNull().default("USD"),
  creditsAmount:     integer("credits_amount").notNull(),
  /** Snapshot وقت إنشاء Checkout — لا يتأثر بتعديل الباقة لاحقاً */
  packageNameSnapshot:    text("package_name_snapshot").notNull(),
  packagePriceSnapshot:   integer("package_price_snapshot").notNull(),
  packageCreditsSnapshot: integer("package_credits_snapshot").notNull(),
  /** pending_checkout | completed | partially_refunded | refunded | refund_adjustment_required | failed */
  paymentStatus:       text("payment_status").notNull().default("pending_checkout"),
  refundedAmountCents:   integer("refunded_amount_cents").notNull().default(0),
  refundedCreditsAmount: integer("refunded_credits_amount").notNull().default(0),
  /** none | needs_review | reviewed */
  refundReviewStatus:  text("refund_review_status").notNull().default("none"),
  refundReviewNote:    text("refund_review_note"),
  purchasedAt:       timestamp("purchased_at"),
  processedAt:       timestamp("processed_at"),
  refundProcessedAt: timestamp("refund_processed_at"),
  createdAt:         timestamp("created_at").notNull().default(sql`NOW()`),
  updatedAt:         timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type CreditPurchase = typeof creditPurchasesTable.$inferSelect;
export type NewCreditPurchase = typeof creditPurchasesTable.$inferInsert;
