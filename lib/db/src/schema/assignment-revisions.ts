import { pgTable, serial, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { assignmentsTable } from "./assignments";
import { teachersTable } from "./teachers";

/** Immutable, point-in-time assignment snapshots. Questions are intentionally
 * embedded so deleting/reordering questions cannot destroy history. */
export const assignmentRevisionsTable = pgTable("assignment_revisions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  sourceVersion: integer("source_version").notNull(),
  settings: jsonb("settings").notNull(),
  questions: jsonb("questions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  assignmentCreatedIdx: index("assignment_revisions_assignment_created_idx").on(t.assignmentId, t.createdAt),
  ownerIdx: index("assignment_revisions_teacher_idx").on(t.teacherId),
}));

export type AssignmentRevision = typeof assignmentRevisionsTable.$inferSelect;