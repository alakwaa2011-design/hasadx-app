import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { categoriesTable } from "./categories";

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject"),
  description: text("description"),
  submissionMode: text("submission_mode").notNull().default("both"),
  accessMode: text("access_mode").notNull().default("public"),
  accessCode: text("access_code"),
  targetClass: text("target_class"),
  targetClasses: text("target_classes").array(),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  showResults: boolean("show_results").notNull().default(true),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  modelImageBase64: text("model_image_base64"),
  totalPoints: real("total_points").notNull().default(0),
  displayTotalPoints: real("display_total_points"),
  deadline: timestamp("deadline"),
  examMode: boolean("exam_mode").notNull().default(false),
  examDurationMinutes: integer("exam_duration_minutes"),
  resultsReleaseMode: text("results_release_mode").notNull().default("immediate"),
  aiGradingInstructions: text("ai_grading_instructions"),
  isShared: boolean("is_shared").notNull().default(false),
  isShareApproved: boolean("is_share_approved").notNull().default(false),
  isAdaptive: boolean("is_adaptive").notNull().default(false),
  adaptiveConfig: text("adaptive_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true });
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
