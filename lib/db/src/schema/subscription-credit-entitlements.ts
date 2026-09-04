import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

/**
 * Immutable record of what a provider invoice bought.  subscriptions remains a
 * current-state projection; release workers must use this snapshot instead.
 */
export const subscriptionCreditEntitlementsTable = pgTable(
  "subscription_credit_entitlements",
  {
    id: serial("id").primaryKey(),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    providerOrderId: text("provider_order_id"),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    planCode: text("plan_code").notNull(),
    monthlyCreditsSnapshot: integer("monthly_credits_snapshot").notNull(),
    rolloverCapSnapshot: integer("rollover_cap_snapshot"),
    billingInterval: text("billing_interval").notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    releaseThrough: timestamp("release_through").notNull(),
    status: text("status").notNull().default("active"),
    refundReviewStatus: text("refund_review_status").notNull().default("none"),
    refundReviewNote: text("refund_review_note"),
    providerEventAt: timestamp("provider_event_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    invoiceUnique: uniqueIndex("sce_provider_invoice_uniq").on(t.providerInvoiceId),
    subscriptionStatusIdx: index("sce_subscription_status_idx").on(t.subscriptionId, t.status),
    dueIdx: index("sce_due_release_idx").on(t.status, t.releaseThrough),
    orderIdx: index("sce_provider_order_idx").on(t.providerOrderId),
  }),
);

export type SubscriptionCreditEntitlement = typeof subscriptionCreditEntitlementsTable.$inferSelect;