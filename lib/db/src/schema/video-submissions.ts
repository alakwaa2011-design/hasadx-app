import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videoLessonsTable } from "./video-lessons";
import { studentsTable } from "./students";

export const videoSubmissionsTable = pgTable("video_submissions", {
  id: serial("id").primaryKey(),
  videoLessonId: integer("video_lesson_id").notNull().references(() => videoLessonsTable.id, { onDelete: "cascade" }),
  studentName: text("student_name").notNull(),
  studentClass: text("student_class").notNull().default(""),
  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),
  score: real("score").notNull(),
  earnedPoints: real("earned_points").notNull().default(0),
  totalPoints: real("total_points").notNull().default(0),
  totalQuestions: integer("total_questions").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertVideoSubmissionSchema = createInsertSchema(videoSubmissionsTable).omit({ id: true, submittedAt: true });
export type InsertVideoSubmission = z.infer<typeof insertVideoSubmissionSchema>;
export type VideoSubmission = typeof videoSubmissionsTable.$inferSelect;
