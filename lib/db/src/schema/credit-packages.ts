import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditPackagesTable = pgTable("credit_packages", {
  id:           serial("id").primaryKey(),
  priceUsdCents:integer("price_usd_cents").notNull(),
  credits:      integer("credits").notNull(),
  sortOrder:    integer("sort_order").notNull().default(0),
  isVisible:    boolean("is_visible").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().default(sql`NOW()`),
});

export type CreditPackage = typeof creditPackagesTable.$inferSelect;
export type NewCreditPackage = typeof creditPackagesTable.$inferInsert;
