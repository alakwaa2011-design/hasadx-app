import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { plansTable } from "./plans";

/**
 * Active subscription for a teacher. Exactly one row per teacher (UNIQUE).
 * Status: "active" | "canceled" | "expired" | "trialing".
 * expiresAt = NULL means perpetual (free plan or lifetime).
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
    /** NULL means no expiration */
    expiresAt: timestamp("expires_at"),
    /** Future KNET/Stripe integration: provider name + external subscription/customer id */
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
