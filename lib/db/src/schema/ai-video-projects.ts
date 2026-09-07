import { pgTable, serial, text, timestamp, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const aiVideoProjectsTable = pgTable("ai_video_projects", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  brief: jsonb("brief").notNull(),
  storyboard: jsonb("storyboard"),
  outputUrl: text("output_url"),
  errorMessage: text("error_message"),
  storyboardIdempotencyKey: text("storyboard_idempotency_key").notNull(),
  storyboardLeaseId: text("storyboard_lease_id"),
  storyboardLeaseExpiresAt: timestamp("storyboard_lease_expires_at", { withTimezone: true }),
  renderIdempotencyKey: text("render_idempotency_key"),
  renderLeaseId: text("render_lease_id"),
  renderLeaseExpiresAt: timestamp("render_lease_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ai_video_projects_storyboard_idempotency_uq").on(table.storyboardIdempotencyKey),
  index("ai_video_projects_teacher_updated_idx").on(table.teacherId, table.updatedAt),
]);

export type AiVideoProject = typeof aiVideoProjectsTable.$inferSelect;
export type InsertAiVideoProject = typeof aiVideoProjectsTable.$inferInsert;