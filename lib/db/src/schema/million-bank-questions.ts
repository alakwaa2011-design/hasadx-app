import { pgTable, serial, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const millionBankQuestionsTable = pgTable("million_bank_questions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  level: text("level").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("million_bank_correct_answer_check", sql`${t.correctAnswer} IN ('A','B','C','D')`),
  check("million_bank_level_check", sql`${t.level} IN ('easy','medium','hard')`),
  check("million_bank_category_check", sql`${t.category} IN ('culture','religion','language','inventions','countries','technology','science','geography','history','sports','mathematics','art','space','economics','animals','food','cinema','medicine','plants','nature','politics','energy','literature')`),
]);

export type MillionBankQuestion = typeof millionBankQuestionsTable.$inferSelect;
