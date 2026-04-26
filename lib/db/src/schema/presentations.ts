import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

export const presentationsTable = pgTable("presentations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subject: text("subject"),
  gradeLevel: text("grade_level"),
  language: text("language").notNull().default("ar"),
  theme: text("theme").notNull().default("harvest"),
  pattern: text("pattern").notNull().default("solid"),
  coverEmoji: text("cover_emoji").default("📚"),
  description: text("description"),
  slides: jsonb("slides").notNull().default([]),
  isShared: boolean("is_shared").notNull().default(false),
  lastPresentedAt: timestamp("last_presented_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPresentationSchema = createInsertSchema(presentationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPresentation = z.infer<typeof insertPresentationSchema>;
export type Presentation = typeof presentationsTable.$inferSelect;
