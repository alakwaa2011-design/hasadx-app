/**
 * Maraqui paths / groups / progress — used via raw SQL in the API but must appear
 * in Drizzle schema so `drizzle-kit push` does not try to DROP these tables.
 */
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** No Drizzle FKs — table is managed historically via raw SQL; FKs avoided so push never fights legacy data */
export const maraquiGroupsTable = pgTable("maraqui_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  teacherId: integer("teacher_id").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const maraquiPathsTable = pgTable("maraqui_paths", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  description: varchar("description", { length: 300 }),
  pin: varchar("pin", { length: 16 }).notNull(),
  stages: jsonb("stages").notNull(),
  creatorId: integer("creator_id").notNull(),
  creatorType: varchar("creator_type", { length: 32 }).notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  groupId: integer("group_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const maraquiProgressTable = pgTable("maraqui_progress", {
  id: serial("id").primaryKey(),
  pathId: integer("path_id").notNull(),
  playerName: varchar("player_name", { length: 50 }).notNull(),
  studentAccountId: integer("student_account_id"),
  completedStages: integer("completed_stages").notNull().default(0),
  attempts: integer("attempts").notNull().default(1),
  isComplete: boolean("is_complete").notNull().default(false),
  completedAt: timestamp("completed_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type MaraquiPath = typeof maraquiPathsTable.$inferSelect;
export type MaraquiGroup = typeof maraquiGroupsTable.$inferSelect;
export type MaraquiProgressRow = typeof maraquiProgressTable.$inferSelect;
