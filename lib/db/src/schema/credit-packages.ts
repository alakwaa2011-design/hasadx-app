import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const creditPackagesTable = pgTable("credit_packages", {
  id:            serial("id").primaryKey(),
  name:          text("name").notNull().default(""),
  slug:          text("slug").unique(),
  description:   text("description"),
  lemonProductId: text("lemon_product_id"),
  lemonVariantId: text("lemon_variant_id").unique(),
  priceUsdCents: integer("price_usd_cents").notNull(),
  currency:      text("currency").notNull().default("USD"),
  credits:       integer("credits").notNull(),
  sortOrder:     integer("sort_order").notNull().default(0),
  isVisible:     boolean("is_visible").notNull().default(true),
  isFeatured:    boolean("is_featured").notNull().default(false),
  archivedAt:    timestamp("archived_at"),
  createdAt:     timestamp("created_at").notNull().default(sql`NOW()`),
  updatedAt:     timestamp("updated_at").notNull().default(sql`NOW()`),
});

export type CreditPackage = typeof creditPackagesTable.$inferSelect;
export type NewCreditPackage = typeof creditPackagesTable.$inferInsert;
