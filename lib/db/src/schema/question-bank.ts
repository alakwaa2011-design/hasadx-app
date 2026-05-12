import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { categoriesTable } from "./categories";

export const questionBankTable = pgTable("question_bank", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  questionType: text("question_type").notNull().default("mcq"),
  text: text("text").notNull(),
  optionA: text("option_a"),
  optionB: text("option_b"),
  optionC: text("option_c"),
  optionD: text("option_d"),
  correctAnswer: text("correct_answer"),
  points: real("points").notNull().default(1),
  tags: text("tags"),
  imageUrl: text("image_url"),
  isShared: boolean("is_shared").notNull().default(true),
  hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
  hiddenAt: timestamp("hidden_at"),
  hiddenById: integer("hidden_by_id").references(() => teachersTable.id, { onDelete: "set null" }),
  hideReason: text("hide_reason"),
  allowMultipleAnswers: boolean("allow_multiple_answers").notNull().default(false),
  repeatQuestion: boolean("repeat_question").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuestionBankSchema = createInsertSchema(questionBankTable).omit({ id: true, createdAt: true });
export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;
export type QuestionBank = typeof questionBankTable.$inferSelect;
