import { check } from "drizzle-orm/pg-core";
import { date, integer, pgTable, serial, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";

export const quranProfilesTable = pgTable("quran_profiles", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  currentSurahNumber: integer("current_surah_number"),
  currentAyah: integer("current_ayah"),
  progressPercent: integer("progress_percent").notNull().default(0),
  masteredAyahCount: integer("mastered_ayah_count").notNull().default(0),
  lastRecitedDate: date("last_recited_date", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerStudentUnique: uniqueIndex("quran_profiles_teacher_student_uq").on(table.teacherId, table.studentId),
  studentIdx: index("quran_profiles_student_idx").on(table.studentId),
  progressRange: check("quran_profiles_progress_range", sql`${table.progressPercent} BETWEEN 0 AND 100`),
  masteredRange: check("quran_profiles_mastered_nonnegative", sql`${table.masteredAyahCount} >= 0`),
}));

export const insertQuranProfileSchema = createInsertSchema(quranProfilesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertQuranProfile = z.infer<typeof insertQuranProfileSchema>;
export type QuranProfile = typeof quranProfilesTable.$inferSelect;