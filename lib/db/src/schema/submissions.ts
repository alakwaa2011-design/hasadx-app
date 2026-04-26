import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
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
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, submittedAt: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
