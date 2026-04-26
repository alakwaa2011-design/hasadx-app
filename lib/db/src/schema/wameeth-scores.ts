import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { studentAccountsTable } from "./student-accounts";

export const wameethScoresTable = pgTable("wameeth_scores", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  assignmentTitle: text("assignment_title").notNull(),
  score: integer("score").notNull().default(0),
  position: integer("position").notNull().default(1),
  playerCount: integer("player_count").notNull().default(1),
  totalCorrect: integer("total_correct").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WameethScore = typeof wameethScoresTable.$inferSelect;
export type InsertWameethScore = typeof wameethScoresTable.$inferInsert;
