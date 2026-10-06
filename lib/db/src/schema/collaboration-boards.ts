import { pgTable, uuid, integer, varchar, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const collaborationBoardsTable = pgTable("collaboration_boards", {
  id: uuid("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull(),
  pin: varchar("pin", { length: 8 }).notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  pinUnique: uniqueIndex("collaboration_boards_pin_unique").on(t.pin),
  retryUnique: uniqueIndex("collaboration_boards_retry_unique").on(t.teacherId, t.clientId),
  teacherIdx: index("collaboration_boards_teacher_idx").on(t.teacherId),
}));
