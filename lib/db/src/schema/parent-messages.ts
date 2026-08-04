import { pgTable, serial, text, integer, timestamp, boolean, index, unique } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { studentsTable } from "./students";

export const parentMessagesTable = pgTable("parent_messages", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull(),
  parentEmail: text("parent_email").notNull(),
  parentName: text("parent_name"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
  replyText: text("reply_text"),
  repliedAt: timestamp("replied_at"),
  replyToken: text("reply_token").notNull().unique(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  teacherIdx: index("parent_messages_teacher_idx").on(t.teacherId),
  studentIdx: index("parent_messages_student_idx").on(t.studentId),
  tokenUniq: unique("parent_messages_token_unique").on(t.replyToken),
}));

export type ParentMessage = typeof parentMessagesTable.$inferSelect;
export type InsertParentMessage = typeof parentMessagesTable.$inferInsert;
