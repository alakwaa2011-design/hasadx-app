import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const dismissedSharedTable = pgTable("dismissed_shared", {
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  itemType: text("item_type", { enum: ["assignment", "question", "game"] }).notNull(),
  itemId: integer("item_id").notNull(),
  dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.teacherId, t.itemType, t.itemId] }),
}));

export type DismissedShared = typeof dismissedSharedTable.$inferSelect;
