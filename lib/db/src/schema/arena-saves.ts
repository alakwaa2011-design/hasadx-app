import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const arenaSavesTable = pgTable("arena_saves", {
  teacherId: integer("teacher_id").primaryKey().references(() => teachersTable.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

export type ArenaSaveRow = typeof arenaSavesTable.$inferSelect;
