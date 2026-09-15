import { integer, pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { teacherClassesTable } from "./teacher-classes";
import { studentsTable } from "./students";

export const quranCirclesTable = pgTable("quran_circles", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  teacherClassId: integer("teacher_class_id").references(() => teacherClassesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  teacherIdx: index("quran_circles_teacher_idx").on(table.teacherId),
}));

export const quranCircleMembersTable = pgTable("quran_circle_members", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id").notNull().references(() => quranCirclesTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  circleStudentUnique: uniqueIndex("quran_circle_members_circle_student_uq").on(table.circleId, table.studentId),
  studentIdx: index("quran_circle_members_student_idx").on(table.studentId),
}));

export const insertQuranCircleSchema = createInsertSchema(quranCirclesTable).omit({ id: true, createdAt: true });
export type InsertQuranCircle = z.infer<typeof insertQuranCircleSchema>;
export type QuranCircle = typeof quranCirclesTable.$inferSelect;
export type QuranCircleMember = typeof quranCircleMembersTable.$inferSelect;