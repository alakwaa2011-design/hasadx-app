import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const wordSetsTable = pgTable("word_sets", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id"),
  title: text("title").notNull(),
  gradeLevel: text("grade_level"),
  words: jsonb("words").notNull().default([]),
  pin: text("pin").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
