import { pgTable, serial, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

export const gameHistoryTable = pgTable("game_history", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id),
  assignmentTitle: text("assignment_title").notNull(),
  pin: text("pin").notNull(),
  gameRunId: text("game_run_id").notNull().default(sql`('legacy:' || gen_random_uuid()::text)`),
  playerCount: integer("player_count").notNull().default(0),
  questionCount: integer("question_count").notNull().default(0),
  winnerName: text("winner_name"),
  winnerAvatar: text("winner_avatar"),
  winnerScore: integer("winner_score"),
  topPlayers: jsonb("top_players"),
  gameMode: text("game_mode").notNull().default("solo"),
  detailedResults: jsonb("detailed_results"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  teacherCreatedIdx: index("game_history_teacher_created_idx").on(t.teacherId, t.createdAt),
  assignmentIdx: index("game_history_assignment_idx").on(t.assignmentId),
  gameRunUnique: uniqueIndex("game_history_game_run_uq").on(t.gameRunId),
}));
