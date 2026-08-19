import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { assignmentsTable } from "./assignments";

/**
 * One stable share-link per (assignment, gameType) pair.
 * The token is a 32-char random hex string — not guessable from the assignment ID.
 * Anyone with the token can start a solo game; no login required.
 * Supported gameType values: "wameeth" | "wameeth_class" | "rocket_race"
 */
export const directPlayLinksTable = pgTable(
  "direct_play_links",
  {
    id: serial("id").primaryKey(),
    /** 32-char random hex, used in the public URL /play/:token */
    token: text("token").notNull().unique(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignmentsTable.id, { onDelete: "cascade" }),
    gameType: text("game_type").notNull(), // "wameeth" | "wameeth_class" | "rocket_race"
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
  }),
);
