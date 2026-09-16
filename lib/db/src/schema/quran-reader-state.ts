import { bigint, check, integer, pgTable, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { teachersTable } from "./teachers";
import { studentAccountsTable } from "./student-accounts";

export const quranReaderPositionsTable = pgTable("quran_reader_positions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  studentAccountId: integer("student_account_id").references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  surahNumber: integer("surah_number").notNull(),
  ayahNumber: integer("ayah_number").notNull(),
  pageNumber: integer("page_number").notNull(),
  revision: bigint("revision", { mode: "number" }).notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerCheck: check("quran_reader_positions_exactly_one_owner", sql`num_nonnulls(${table.teacherId}, ${table.studentAccountId}) = 1`),
  teacherUnique: uniqueIndex("quran_reader_positions_teacher_uq").on(table.teacherId).where(sql`${table.teacherId} IS NOT NULL`),
  studentUnique: uniqueIndex("quran_reader_positions_student_account_uq").on(table.studentAccountId).where(sql`${table.studentAccountId} IS NOT NULL`),
}));

export const quranBookmarksTable = pgTable("quran_bookmarks", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  studentAccountId: integer("student_account_id").references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  surahNumber: integer("surah_number").notNull(),
  ayahNumber: integer("ayah_number").notNull(),
  pageNumber: integer("page_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerCheck: check("quran_bookmarks_exactly_one_owner", sql`num_nonnulls(${table.teacherId}, ${table.studentAccountId}) = 1`),
  teacherVerseUnique: uniqueIndex("quran_bookmarks_teacher_verse_uq").on(table.teacherId, table.surahNumber, table.ayahNumber).where(sql`${table.teacherId} IS NOT NULL`),
  studentVerseUnique: uniqueIndex("quran_bookmarks_student_verse_uq").on(table.studentAccountId, table.surahNumber, table.ayahNumber).where(sql`${table.studentAccountId} IS NOT NULL`),
}));

export type QuranReaderPosition = typeof quranReaderPositionsTable.$inferSelect;
export type QuranBookmark = typeof quranBookmarksTable.$inferSelect;