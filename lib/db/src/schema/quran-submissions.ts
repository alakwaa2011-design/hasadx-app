import { check } from "drizzle-orm/pg-core";
import { integer, jsonb, pgTable, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";
import { studentAccountsTable } from "./student-accounts";
import { quranWardsTable } from "./quran-wards";

/**
 * Audio submitted by a student for a Quran ward. This is deliberately
 * separate from quran_recitations: a submission is unreviewed evidence,
 * while quran_recitations remains the teacher-entered evaluation record.
 */
export const quranSubmissionsTable = pgTable("quran_submissions", {
  id: serial("id").primaryKey(),
  wardId: integer("ward_id").notNull().references(() => quranWardsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  clientRequestId: text("client_request_id").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("submitted"),
  memorizationScore: integer("memorization_score"),
  recitationScore: integer("recitation_score"),
  mistakeCounts: jsonb("mistake_counts").$type<Record<string, number> | null>(),
  feedback: text("feedback"),
  reviewedByTeacherId: integer("reviewed_by_teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerRequestUnique: uniqueIndex("quran_submissions_owner_request_uq").on(table.studentAccountId, table.clientRequestId),
  teacherStatusIdx: index("quran_submissions_teacher_status_idx").on(table.teacherId, table.status, table.createdAt),
  studentWardIdx: index("quran_submissions_student_ward_idx").on(table.studentId, table.wardId, table.createdAt),
  statusValid: check("quran_submissions_status_valid", sql`${table.status} IN ('submitted','reviewed','needs_resubmission')`),
  contentTypeValid: check("quran_submissions_content_type_valid", sql`${table.contentType} IN ('audio/webm','audio/mp4','audio/mpeg','audio/ogg')`),
  fileSizeValid: check("quran_submissions_file_size_valid", sql`${table.fileSize} > 0 AND ${table.fileSize} <= 31457280`),
  memorizationScoreValid: check("quran_submissions_memorization_score_valid", sql`${table.memorizationScore} IS NULL OR ${table.memorizationScore} BETWEEN 0 AND 100`),
  recitationScoreValid: check("quran_submissions_recitation_score_valid", sql`${table.recitationScore} IS NULL OR ${table.recitationScore} BETWEEN 0 AND 100`),
}));

export const insertQuranSubmissionSchema = createInsertSchema(quranSubmissionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertQuranSubmission = z.infer<typeof insertQuranSubmissionSchema>;
export type QuranSubmission = typeof quranSubmissionsTable.$inferSelect;