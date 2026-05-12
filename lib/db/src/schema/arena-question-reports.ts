import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { arenaCategoriesTable, arenaActivitiesTable } from "./arena-categories";

export const arenaQuestionReportsTable = pgTable("arena_question_reports", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => arenaCategoriesTable.id, { onDelete: "set null" }),
  activityId: integer("activity_id").references(() => arenaActivitiesTable.id, { onDelete: "set null" }),
  subCategoryId: text("sub_category_id"),
  difficulty: integer("difficulty"),
  questionType: text("question_type"),
  questionText: text("question_text").notNull(),
  currentAnswer: text("current_answer").notNull(),
  suggestedAnswer: text("suggested_answer"),
  note: text("note").notNull(),
  reporterTeacherId: integer("reporter_teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  reporterName: text("reporter_name"),
  status: text("status").notNull().default("open"),
  resolvedByTeacherId: integer("resolved_by_teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ArenaQuestionReportRow = typeof arenaQuestionReportsTable.$inferSelect;
