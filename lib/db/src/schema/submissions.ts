import { pgTable, serial, text, integer, real, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assignmentsTable } from "./assignments";
import { studentsTable } from "./students";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull().default(""),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  studentIdentityVerified: boolean("student_identity_verified").notNull().default(false),
  deviceFingerprint: text("device_fingerprint"),
  score: real("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  earnedPoints: real("earned_points").notNull().default(0),
  totalPoints: real("total_points").notNull().default(0),
  teacherAdjustedPoints: real("teacher_adjusted_points"),
  teacherNote: text("teacher_note"),
  aiFeedback: text("ai_feedback"),
  repeatAttempted: boolean("repeat_attempted").notNull().default(false),
  startedAt: timestamp("started_at"),
  durationSeconds: integer("duration_seconds"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (t) => ({
  assignmentIdx: index("submissions_assignment_idx").on(t.assignmentId),
  studentIdx: index("submissions_student_idx").on(t.studentId),
  assignmentSubmittedIdx: index("submissions_assignment_submitted_idx").on(t.assignmentId, t.submittedAt),
}));

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, submittedAt: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;

export const submissionImagesTable = pgTable("submission_images", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  submissionPageIdx: uniqueIndex("submission_images_submission_page_uq").on(t.submissionId, t.pageNumber),
  submissionIdx: index("submission_images_submission_idx").on(t.submissionId),
}));

export const insertSubmissionImageSchema = createInsertSchema(submissionImagesTable).omit({ id: true, createdAt: true });
export type InsertSubmissionImage = z.infer<typeof insertSubmissionImageSchema>;
export type SubmissionImage = typeof submissionImagesTable.$inferSelect;
