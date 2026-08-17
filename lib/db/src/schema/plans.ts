import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Plan catalog. NULL on any limit column means "unlimited".
 * Prices stored as integers in cents USD for Lemon Squeezy compatibility.
 */
export const plansTable = pgTable(
  "plans",
  {
    id: serial("id").primaryKey(),
    /** Stable code used by feature-access logic (e.g. "free", "basic", "pro") */
    code: text("code").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    /** Price as integer minor unit (cents USD). 0 for free. */
    priceMinor: integer("price_minor").notNull().default(0),
    /** ISO-4217 currency code. */
    currency: text("currency").notNull().default("USD"),
    /** Billing period in days. 30 = monthly, 0 = free. */
    billingPeriodDays: integer("billing_period_days").notNull().default(30),
    /** NULL = unlimited */
    maxStudents: integer("max_students"),
    /** NULL = unlimited */
    maxClasses: integer("max_classes"),
    /** For school/team plans: extra teacher seats. NULL = unlimited */
    maxUsers: integer("max_users"),
    /** Credits granted each billing period (renewal). NULL = no credits. */
    monthlyCredits: integer("monthly_credits"),
    /** Max accumulated subscription credits. NULL = no rollover allowed (free). */
    rolloverCap: integer("rollover_cap"),
    /** Lemon Squeezy subscription variant ID for checkout. NULL for free plan. */
    lemonVariantId: text("lemon_variant_id"),
    /** Lemon Squeezy product ID. NULL for free plan. */
    lemonProductId: text("lemon_product_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    codeUnique: uniqueIndex("plans_code_unique").on(t.code),
  }),
);

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = typeof plansTable.$inferInsert;
