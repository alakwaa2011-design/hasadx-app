import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

export const arenaCategoriesTable = pgTable("arena_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎯"),
  coverImageUrl: text("cover_image_url"),
  coverColor: text("cover_color").notNull().default("#1E4D35"),
  coverGradient: text("cover_gradient"),
  description: text("description"),
  parentId: integer("parent_id"),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const arenaActivitiesTable = pgTable("arena_activities", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => arenaCategoriesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("text"),
  difficulty: integer("difficulty").notNull().default(200),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  hint: text("hint"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  payload: jsonb("payload"),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  isPublic: boolean("is_public").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArenaCategorySchema = createInsertSchema(arenaCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertArenaActivitySchema = createInsertSchema(arenaActivitiesTable).omit({ id: true, createdAt: true });
export type InsertArenaCategory = z.infer<typeof insertArenaCategorySchema>;
export type InsertArenaActivity = z.infer<typeof insertArenaActivitySchema>;
export type ArenaCategoryRow = typeof arenaCategoriesTable.$inferSelect;
export type ArenaActivityRow = typeof arenaActivitiesTable.$inferSelect;
