import { pgTable, serial, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Teacher-owned mind maps.
 *
 * Shape of `map` (jsonb):
 *   {
 *     center: string;          // central node label (non-empty)
 *     branches: Array<{
 *       label:    string;      // branch label (non-empty)
 *       icon:     string;      // emoji or icon identifier
 *       color:    string;      // CSS colour string (e.g. "#4F46E5")
 *       children: string[];    // leaf labels
 *     }>;
 *   }
 */
export const mindMapsTable = pgTable(
  "mind_maps",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    clientRequestId: text("client_request_id"),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    language: text("language").notNull().default("ar"),
    depth: text("depth").notNull().default("standard"),
    map: jsonb("map").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("mind_maps_teacher_idx").on(table.teacherId, table.updatedAt),
    uniqueIndex("mind_maps_teacher_client_request_uidx").on(
      table.teacherId,
      table.clientRequestId,
    ),
  ],
);

export const insertMindMapSchema = createInsertSchema(mindMapsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMindMap = z.infer<typeof insertMindMapSchema>;
export type MindMap = typeof mindMapsTable.$inferSelect;
