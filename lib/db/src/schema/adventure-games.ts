import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

export const adventureGamesTable = pgTable("adventure_games", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  pin: text("pin").notNull().unique(),
  gameType: text("game_type").notNull().default("adventure"),
  status: text("status").notNull().default("active"),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adventureScoresTable = pgTable("adventure_scores", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => adventureGamesTable.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  completionTime: integer("completion_time").notNull(),
  correctAnswers: integer("correct_answers").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export type AdventureGame = typeof adventureGamesTable.$inferSelect;
export type AdventureScore = typeof adventureScoresTable.$inferSelect;
