import { check } from "drizzle-orm/pg-core";
import { date, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";

export const quranWardsTable = pgTable("quran_wards", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  surahNumber: integer("surah_number").notNull(),
  surahName: text("surah_name").notNull(),
  startAyah: integer("start_ayah").notNull(),
  endAyah: integer("end_ayah").notNull(),
  assignedDate: date("assigned_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  notes: text("notes"),
  status: text("status").notNull().default("assigned"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  teacherStudentIdx: index("quran_wards_teacher_student_idx").on(table.teacherId, table.studentId),
  dueDateIdx: index("quran_wards_teacher_due_idx").on(table.teacherId, table.dueDate),
  modeValid: check("quran_wards_mode_valid", sql`${table.mode} IN ('memorization','review','recitation','assessment')`),
  statusValid: check("quran_wards_status_valid", sql`${table.status} IN ('assigned','in_progress','completed','needs_review')`),
  ayahRangeValid: check("quran_wards_ayah_range_valid", sql`${table.startAyah} > 0 AND ${table.endAyah} >= ${table.startAyah}`),
}));

export const insertQuranWardSchema = createInsertSchema(quranWardsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertQuranWard = z.infer<typeof insertQuranWardSchema>;
export type QuranWard = typeof quranWardsTable.$inferSelect;