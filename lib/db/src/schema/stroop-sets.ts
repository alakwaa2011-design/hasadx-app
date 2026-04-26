import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export interface StroopItem {
  word: string;
  color: string;
  options?: string[];
}

export const stroopSetsTable = pgTable("stroop_sets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  pin: text("pin").notNull().unique(),
  gradeLevel: text("grade_level"),
  items: jsonb("items").$type<StroopItem[]>().notNull().default([]),
  creatorId: integer("creator_id").references(() => teachersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
