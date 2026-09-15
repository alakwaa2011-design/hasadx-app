import { date, integer, pgTable, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentAccountsTable } from "./student-accounts";

export const quranIndependentPositionsTable = pgTable("quran_independent_positions", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  textSurahNumber: integer("text_surah_number"),
  textAyah: integer("text_ayah"),
  pageNumber: integer("page_number"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerUnique: uniqueIndex("quran_independent_positions_account_uq").on(table.studentAccountId),
}));

export const quranIndependentSessionsTable = pgTable("quran_independent_sessions", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  practicedDate: date("practiced_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountDateUnique: uniqueIndex("quran_independent_sessions_account_date_uq").on(table.studentAccountId, table.practicedDate),
}));

export const insertQuranIndependentPositionSchema = createInsertSchema(quranIndependentPositionsTable).omit({
  id: true, updatedAt: true,
});
export const insertQuranIndependentSessionSchema = createInsertSchema(quranIndependentSessionsTable).omit({
  id: true, createdAt: true,
});
export type InsertQuranIndependentPosition = z.infer<typeof insertQuranIndependentPositionSchema>;
export type InsertQuranIndependentSession = z.infer<typeof insertQuranIndependentSessionSchema>;
export type QuranIndependentPosition = typeof quranIndependentPositionsTable.$inferSelect;
export type QuranIndependentSession = typeof quranIndependentSessionsTable.$inferSelect;