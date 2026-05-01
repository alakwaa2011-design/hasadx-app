import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  /** present | absent | late | excused */
  status: text("status").notNull().default("present"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Attendance = typeof attendanceTable.$inferSelect;
