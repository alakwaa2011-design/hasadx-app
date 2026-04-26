import { pgTable, serial, text, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videoLessonsTable } from "./video-lessons";

export const videoQuestionsTable = pgTable("video_questions", {
  id: serial("id").primaryKey(),
  videoLessonId: integer("video_lesson_id").notNull().references(() => videoLessonsTable.id, { onDelete: "cascade" }),
  timestampSeconds: integer("timestamp_seconds").notNull(),
  questionType: text("question_type").notNull().default("mcq"),
  text: text("text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctAnswer: text("correct_answer"),
  points: real("points").notNull().default(1),
  questionOrder: integer("question_order").notNull().default(0),
});

export const insertVideoQuestionSchema = createInsertSchema(videoQuestionsTable).omit({ id: true });
export type InsertVideoQuestion = z.infer<typeof insertVideoQuestionSchema>;
export type VideoQuestion = typeof videoQuestionsTable.$inferSelect;
