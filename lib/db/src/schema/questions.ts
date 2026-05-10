import { pgTable, serial, text, integer, real, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assignmentsTable } from "./assignments";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  questionType: text("question_type").notNull().default("mcq"),
  text: text("text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctAnswer: text("correct_answer"),
  points: real("points").notNull().default(1),
  imageUrl: text("image_url"),
  readAloud: boolean("read_aloud").notNull().default(false),
  difficulty: integer("difficulty"),
  skill: text("skill"),
  allowMultipleAnswers: boolean("allow_multiple_answers").notNull().default(false),
  repeatQuestion: boolean("repeat_question").notNull().default(false),
}, (t) => ({
  assignmentIdx: index("questions_assignment_idx").on(t.assignmentId),
}));

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
