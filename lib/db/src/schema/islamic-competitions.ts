import { pgTable, serial, text, timestamp, boolean, integer, real, unique, jsonb, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const islamicSectionsTable = pgTable("islamic_sections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isVisible: boolean("is_visible").notNull().default(true),
  order: integer("order").notNull().default(0),
  ownerId: integer("owner_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const islamicCategoriesTable = pgTable("islamic_categories", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => islamicSectionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  level: text("level").notNull().default("mixed"),
  isVisible: boolean("is_visible").notNull().default(true),
  order: integer("order").notNull().default(0),
  ownerId: integer("owner_id").references(() => teachersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const islamicQuestionsTable = pgTable("islamic_questions", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => islamicCategoriesTable.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  audioUrl: text("audio_url"),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  difficulty: text("difficulty").notNull().default("medium"),
  createdBy: integer("created_by").references(() => teachersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const islamicProgressTable = pgTable("islamic_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => islamicCategoriesTable.id, { onDelete: "cascade" }),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  starsEarned: integer("stars_earned").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  certificatesEarned: integer("certificates_earned").notNull().default(0),
  completedAt: timestamp("completed_at"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
}, (t) => ({
  uniqUserCategory: unique().on(t.userId, t.categoryId),
}));

export const islamicChallengesTable = pgTable("islamic_challenges", {
  id: serial("id").primaryKey(),
  pin: text("pin").notNull().unique(),
  creatorId: integer("creator_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  opponentId: integer("opponent_id").references(() => teachersTable.id, { onDelete: "set null" }),
  opponentName: text("opponent_name"),
  categoryId: integer("category_id").notNull().references(() => islamicCategoriesTable.id, { onDelete: "cascade" }),
  questionIds: text("question_ids").notNull(),
  status: text("status").notNull().default("waiting"),
  creatorScore: integer("creator_score").notNull().default(0),
  creatorTimeMs: integer("creator_time_ms").notNull().default(0),
  creatorCorrect: integer("creator_correct").notNull().default(0),
  opponentScore: integer("opponent_score").notNull().default(0),
  opponentTimeMs: integer("opponent_time_ms").notNull().default(0),
  opponentCorrect: integer("opponent_correct").notNull().default(0),
  winnerId: integer("winner_id").references(() => teachersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const islamicPermissionsTable = pgTable("islamic_permissions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }).unique(),
  grantedBy: integer("granted_by").references(() => teachersTable.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const islamicDailyVisitsTable = pgTable("islamic_daily_visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  visitDate: text("visit_date").notNull(),
  pointsAwarded: integer("points_awarded").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqUserDate: unique().on(t.userId, t.visitDate),
}));

export const islamicCertificatesTable = pgTable("islamic_certificates", {
  id: serial("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  userId: integer("user_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  categoryId: integer("category_id").notNull().references(() => islamicCategoriesTable.id, { onDelete: "cascade" }),
  categoryName: text("category_name").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  totalStars: integer("total_stars").notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});

export const islamicEventsTable = pgTable(
  "islamic_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => teachersTable.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    questionId: integer("question_id").references(() => islamicQuestionsTable.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => islamicCategoriesTable.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    timeTaken: real("time_taken"),
    isCorrect: boolean("is_correct"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byUser: index("islamic_events_user_idx").on(t.userId, t.createdAt),
    bySession: index("islamic_events_session_idx").on(t.sessionId),
    byType: index("islamic_events_type_idx").on(t.eventType, t.createdAt),
    byCategory: index("islamic_events_category_idx").on(t.categoryId, t.createdAt),
  }),
);

export const islamicTournamentsTable = pgTable("islamic_tournaments", {
  id: serial("id").primaryKey(),
  pin: text("pin").notNull().unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull().references(() => islamicCategoriesTable.id, { onDelete: "cascade" }),
  creatorId: integer("creator_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  teamNames: text("team_names").array().notNull().default([]),
  teamTokens: jsonb("team_tokens").$type<Record<string, string>>().notNull().default({}),
  teamScores: jsonb("team_scores").$type<Record<string, { score: number; correct: number; timeMs: number; status: "waiting" | "playing" | "done" }>>().notNull().default({}),
  questionIds: text("question_ids").notNull().default(""),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IslamicEvent = typeof islamicEventsTable.$inferSelect;
export type IslamicSection = typeof islamicSectionsTable.$inferSelect;
export type IslamicCategory = typeof islamicCategoriesTable.$inferSelect;
export type IslamicQuestion = typeof islamicQuestionsTable.$inferSelect;
export type IslamicProgress = typeof islamicProgressTable.$inferSelect;
export type IslamicChallenge = typeof islamicChallengesTable.$inferSelect;
export type IslamicPermission = typeof islamicPermissionsTable.$inferSelect;
export type IslamicCertificate = typeof islamicCertificatesTable.$inferSelect;
export type IslamicTournament = typeof islamicTournamentsTable.$inferSelect;
