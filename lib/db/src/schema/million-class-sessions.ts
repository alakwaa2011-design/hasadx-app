import { pgTable, serial, varchar, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const millionClassSessionsTable = pgTable("million_class_sessions", {
  id: serial("id").primaryKey(),
  pin: varchar("pin", { length: 6 }).notNull().unique(),
  hostId: integer("host_id"),
  questionSource: text("question_source").notNull().default("bank"),
  assignmentId: integer("assignment_id"),
  bankLevel: text("bank_level"),
  bankCategory: text("bank_category"),
  mode: text("mode").notNull().default("individual"),
  broadcastMode: boolean("broadcast_mode").notNull().default(false),
  teamAName: text("team_a_name"),
  teamBName: text("team_b_name"),
  teamAMembers: jsonb("team_a_members"),
  teamBMembers: jsonb("team_b_members"),
  questionCount: integer("question_count"),
  pointsScheme: text("points_scheme"),
  basePoints: integer("base_points"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const millionClassResultsTable = pgTable("million_class_results", {
  id: serial("id").primaryKey(),
  sessionPin: varchar("session_pin", { length: 6 }).notNull(),
  playerToken: varchar("player_token", { length: 32 }).notNull(),
  playerName: text("player_name").notNull(),
  level: integer("level").notNull().default(0),
  prize: integer("prize").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  status: text("status").notNull().default("playing"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MillionClassSession = typeof millionClassSessionsTable.$inferSelect;
export type MillionClassResult = typeof millionClassResultsTable.$inferSelect;
