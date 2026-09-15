import { check } from "drizzle-orm/pg-core";
import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";
import { quranWardsTable } from "./quran-wards";

export const quranRecitationsTable = pgTable("quran_recitations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  wardId: integer("ward_id").notNull().references(() => quranWardsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  memorizationScore: integer("memorization_score"),
  recitationScore: integer("recitation_score"),
  mistakeCounts: jsonb("mistake_counts").$type<Record<string, number> | null>(),
  teacherNote: text("teacher_note"),
  recitedDate: date("recited_date", { mode: "string" }).notNull(),
  progressApplied: boolean("progress_applied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  wardIdx: index("quran_recitations_ward_idx").on(table.teacherId, table.wardId),
  studentDateIdx: index("quran_recitations_student_date_idx").on(table.teacherId, table.studentId, table.recitedDate),
  wardDateUnique: uniqueIndex("quran_recitations_teacher_ward_date_uq").on(table.teacherId, table.wardId, table.recitedDate),
  statusValid: check("quran_recitations_status_valid", sql`${table.status} IN ('completed','needs_review','absent','not_recited')`),
  memorizationScoreValid: check("quran_recitations_memorization_score_valid", sql`${table.memorizationScore} IS NULL OR ${table.memorizationScore} BETWEEN 0 AND 100`),
  recitationScoreValid: check("quran_recitations_recitation_score_valid", sql`${table.recitationScore} IS NULL OR ${table.recitationScore} BETWEEN 0 AND 100`),
}));

export const insertQuranRecitationSchema = createInsertSchema(quranRecitationsTable).omit({ id: true, createdAt: true });
export type InsertQuranRecitation = z.infer<typeof insertQuranRecitationSchema>;
export type QuranRecitation = typeof quranRecitationsTable.$inferSelect;