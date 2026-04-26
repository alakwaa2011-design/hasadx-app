import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const tugTemplatesTable = pgTable("tug_templates", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  title: text("title").notNull(),
  questions: jsonb("questions").notNull(),
  duration: integer("duration").notNull().default(20),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
