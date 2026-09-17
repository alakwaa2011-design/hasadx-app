import { date, integer, pgTable, serial, timestamp, text, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentAccountsTable } from "./student-accounts";

export const quranGuidedMemorizationTable = pgTable("quran_guided_memorization", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  surahNumber: integer("surah_number").notNull(),
  ayahNumber: integer("ayah_number").notNull(),
  status: text("status").notNull().default("learning"),
  intervalDays: integer("interval_days").notNull().default(2),
  nextReviewDate: date("next_review_date", { mode: "string" }).notNull(),
  lastAssessedAt: timestamp("last_assessed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountAyahUnique: uniqueIndex("quran_guided_memorization_account_ayah_uq").on(table.studentAccountId, table.surahNumber, table.ayahNumber),
  dueIndex: index("quran_guided_memorization_due_idx").on(table.studentAccountId, table.nextReviewDate),
  statusCheck: check("quran_guided_memorization_status_valid", sql`status IN ('needs_review','learning','memorized')`),
  intervalCheck: check("quran_guided_memorization_interval_valid", sql`interval_days > 0 AND interval_days <= 90`),
}));

export const insertQuranGuidedMemorizationSchema = createInsertSchema(quranGuidedMemorizationTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertQuranGuidedMemorization = z.infer<typeof insertQuranGuidedMemorizationSchema>;
export type QuranGuidedMemorization = typeof quranGuidedMemorizationTable.$inferSelect;

export const quranGuidedMemorizationAssessmentReceiptsTable = pgTable("quran_guided_memorization_assessment_receipts", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  memorizationItemId: integer("memorization_item_id").notNull().references(() => quranGuidedMemorizationTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerRequestUnique: uniqueIndex("quran_guided_memorization_receipts_owner_request_uq").on(table.studentAccountId, table.requestId),
  itemIndex: index("quran_guided_memorization_receipts_item_idx").on(table.memorizationItemId),
}));