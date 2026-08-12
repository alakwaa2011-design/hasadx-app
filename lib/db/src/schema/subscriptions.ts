import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { plansTable } from "./plans";

/**
 * Active subscription for a teacher. Exactly one row per teacher (UNIQUE).
 * Status: "active" | "canceled" | "expired" | "past_due".
 * Free plan has no expiresAt and no external subscription.
 */
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plansTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    /** NULL means no expiration (free plan) */
    expiresAt: timestamp("expires_at"),
    /** End of current paid billing period. Used for rollover and credit expiry. */
    currentPeriodEnd: timestamp("current_period_end"),
    /** Set when user requests cancellation. Subscription stays active until currentPeriodEnd. */
    cancelledAt: timestamp("cancelled_at"),
    /** Lemon Squeezy payment status: 'active' | 'past_due' | 'unpaid' */
    paymentStatus: text("payment_status").default("active"),
    /**
     * The currentPeriodEnd for which subscription credits were last granted.
     * Guards against double-granting the same period via both
     * subscription_payment_success AND subscription_payment_recovered.
     * All three steps (check, grant, record) run inside one locked transaction.
     */
    lastCreditedPeriodEnd: timestamp("last_credited_period_end"),
    paymentProvider: text("payment_provider"),
    externalSubscriptionId: text("external_subscription_id"),
    externalCustomerId: text("external_customer_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    teacherUnique: uniqueIndex("subscriptions_teacher_unique").on(t.teacherId),
    planIdx: index("subscriptions_plan_idx").on(t.planId),
  }),
);

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
