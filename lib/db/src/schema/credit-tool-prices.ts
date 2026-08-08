import { pgTable, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditToolPricesTable = pgTable("credit_tool_prices", {
  toolKey:           text("tool_key").primaryKey(),
  toolNameAr:        text("tool_name_ar").notNull(),
  category:          text("category").notNull().default("ai"),
  creditsCost:       integer("credits_cost").notNull().default(0),
  defaultCreditsCost:integer("default_credits_cost").notNull().default(0),
  isCreditEnabled:   boolean("is_credit_enabled").notNull().default(true),
  timeoutSeconds:    integer("timeout_seconds").notNull().default(60),
  estimatedApiCostUsd: numeric("estimated_api_cost_usd", { precision: 10, scale: 6 }),
  updatedBy:         integer("updated_by"),
  updatedAt:         timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type CreditToolPrice = typeof creditToolPricesTable.$inferSelect;
export type NewCreditToolPrice = typeof creditToolPricesTable.$inferInsert;
