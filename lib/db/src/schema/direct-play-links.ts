import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";
import { wheelTemplatesTable } from "./wheel-templates";
import { savedGameActivitiesTable } from "./saved-game-activities";

/**
 * One stable share-link per supported activity (assignment, wheel template,
 * or a teacher's saved game).
 * The token is a 32-char random hex string — not guessable from the assignment ID.
 * Anyone with the token can start a solo game; no login required.
 * Supported gameType values: "wameeth" | "wameeth_class" | "rocket_race" | "wheel"
 */
export const directPlayLinksTable = pgTable(
  "direct_play_links",
  {
    id: serial("id").primaryKey(),
    /** 32-char random hex, used in the public URL /play/:token */
    token: text("token").notNull().unique(),
    assignmentId: integer("assignment_id")
      .references(() => assignmentsTable.id, { onDelete: "cascade" }),
    wheelTemplateId: integer("wheel_template_id")
      .references(() => wheelTemplatesTable.id, { onDelete: "cascade" }),
    savedGameActivityId: integer("saved_game_activity_id")
      .references(() => savedGameActivitiesTable.id, { onDelete: "cascade" }),
    gameType: text("game_type").notNull(), // "wameeth" | "wameeth_class" | "rocket_race" | "wheel"
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    assignmentGameTypeIdx: index("direct_play_links_assignment_game_idx").on(
      t.assignmentId,
      t.gameType,
    ),
    wheelTemplateGameTypeIdx: index("direct_play_links_wheel_template_game_idx").on(
      t.wheelTemplateId,
      t.gameType,
    ),
  }),
);
