import { date, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

export const teacherScheduleTable = pgTable("teacher_schedule", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("weekly"),
  title: text("title").notNull(),
  subject: text("subject"),
  className: text("class_name"),
  dayOfWeek: integer("day_of_week"),
  lessonNumber: integer("lesson_number"),
  appointmentDate: date("appointment_date", { mode: "string" }),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  teacherIdx: index("teacher_schedule_teacher_idx").on(table.teacherId),
  teacherDateIdx: index("teacher_schedule_teacher_date_idx").on(table.teacherId, table.appointmentDate),
}));

export const insertTeacherScheduleSchema = createInsertSchema(teacherScheduleTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeacherSchedule = z.infer<typeof insertTeacherScheduleSchema>;
export type TeacherSchedule = typeof teacherScheduleTable.$inferSelect;