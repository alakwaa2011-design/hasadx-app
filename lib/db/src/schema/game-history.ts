import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

export const gameHistoryTable = pgTable("game_history", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id),
  assignmentTitle: text("assignment_title").notNull(),
  pin: text("pin").notNull(),
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
}));
