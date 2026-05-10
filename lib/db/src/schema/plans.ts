import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Plan catalog. NULL on any limit column means "unlimited".
 * Prices stored as integers in fils (1 KWD = 1000 fils) for KNET/Stripe compatibility.
 */
export const plansTable = pgTable(
  "plans",
  {
    id: serial("id").primaryKey(),
    /** Stable code used by feature-access logic (e.g. "free", "basic", "pro", "school") */
    code: text("code").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    /** Price as integer minor unit. For KWD this is fils (1000 fils = 1 KWD). */
    priceMinor: integer("price_minor").notNull().default(0),
    /** ISO-4217 currency code. */
    currency: text("currency").notNull().default("KWD"),
    /** Billing period in days. 30 = monthly, 365 = yearly, 0 = lifetime/free. */
    billingPeriodDays: integer("billing_period_days").notNull().default(30),
    /** NULL = unlimited */
    maxStudents: integer("max_students"),
    /** NULL = unlimited */
    maxClasses: integer("max_classes"),
    /** NULL = unlimited */
    maxHomeworksPerMonth: integer("max_homeworks_per_month"),
    /** Daily AI message limit. NULL = unlimited */
    aiUsageDailyLimit: integer("ai_usage_daily_limit"),
    /** For school/team plans: extra teacher seats. NULL = unlimited */
    maxUsers: integer("max_users"),
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
