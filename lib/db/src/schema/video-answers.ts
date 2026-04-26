import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videoSubmissionsTable } from "./video-submissions";
import { videoQuestionsTable } from "./video-questions";

export const videoAnswersTable = pgTable("video_answers", {
  id: serial("id").primaryKey(),
  videoSubmissionId: integer("video_submission_id").notNull().references(() => videoSubmissionsTable.id, { onDelete: "cascade" }),
  videoQuestionId: integer("video_question_id").notNull().references(() => videoQuestionsTable.id, { onDelete: "cascade" }),
  selectedAnswer: text("selected_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
});

export const insertVideoAnswerSchema = createInsertSchema(videoAnswersTable).omit({ id: true });
export type InsertVideoAnswer = z.infer<typeof insertVideoAnswerSchema>;
export type VideoAnswer = typeof videoAnswersTable.$inferSelect;
