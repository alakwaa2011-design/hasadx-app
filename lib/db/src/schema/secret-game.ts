import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const secretGameCategoriesTable = pgTable("secret_game_categories", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  icon: text("icon").notNull().default("🎯"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isCustom: boolean("is_custom").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const secretGameItemsTable = pgTable("secret_game_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => secretGameCategoriesTable.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(),
  imageUrl: text("image_url"),
  difficulty: text("difficulty").notNull().default("medium"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SecretGameCategory = typeof secretGameCategoriesTable.$inferSelect;
export type SecretGameItem = typeof secretGameItemsTable.$inferSelect;
