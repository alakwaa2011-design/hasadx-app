import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { plansTable } from "./plans";

/** Authoritative checkout variants. A plan may have one monthly and one annual option. */
export const planBillingOptionsTable = pgTable("plan_billing_options", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  billingInterval: text("billing_interval").notNull(), // month | year
  lemonVariantId: text("lemon_variant_id").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  planIntervalUnique: uniqueIndex("plan_billing_options_plan_interval_unique").on(t.planId, t.billingInterval),
  variantUnique: uniqueIndex("plan_billing_options_variant_unique").on(t.lemonVariantId),
  planIdx: index("plan_billing_options_plan_idx").on(t.planId),
}));

export type PlanBillingOption = typeof planBillingOptionsTable.$inferSelect;