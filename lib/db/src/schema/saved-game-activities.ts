import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

/**
 * A game activity is owned by a teacher.  The fingerprint deliberately covers
 * only the game type and game content; presentation metadata can be updated
 * without creating a second saved activity.
 */
export const savedGameActivitiesTable = pgTable(
  "saved_game_activities",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
    gameType: text("game_type").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").notNull(),
    settings: jsonb("settings").notNull().default({}),
    source: text("source").notNull().default("manual"),
    isShared: boolean("is_shared").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
    contentFingerprint: text("content_fingerprint").notNull(),
    questionCount: integer("question_count").notNull().default(0),
    playCount: integer("play_count").notNull().default(1),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("saved_game_activities_teacher_game_content_uq").on(
      table.teacherId,
      table.gameType,
      table.contentFingerprint,
    ),
    uniqueIndex("saved_game_activities_teacher_updated_idx").on(table.teacherId, table.updatedAt),
  ],
);

export const insertSavedGameActivitySchema = createInsertSchema(savedGameActivitiesTable)
  .omit({
    id: true, teacherId: true, publishedAt: true, hiddenByAdmin: true,
    contentFingerprint: true, playCount: true, lastPlayedAt: true, createdAt: true, updatedAt: true,
  });
export type InsertSavedGameActivity = z.infer<typeof insertSavedGameActivitySchema>;
export type SavedGameActivity = typeof savedGameActivitiesTable.$inferSelect;