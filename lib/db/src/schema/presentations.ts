import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";

export const presentationsTable = pgTable("presentations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  subject: text("subject"),
  gradeLevel: text("grade_level"),
  language: text("language").notNull().default("ar"),
  theme: text("theme").notNull().default("harvest"),
  pattern: text("pattern").notNull().default("solid"),
  /* Legacy reveal.js fields, kept nullable so the deletion of the V1
     feature doesn't break existing rows. New code ignores them. */
  mode: text("mode").default("professional"),
  template: text("template").default("educational"),
  coverEmoji: text("cover_emoji").default("📚"),
  description: text("description"),
  /* Slide payload — see the Zod `slideSchema` in
     `artifacts/api-server/src/routes/presentations.ts` for the full
     element discriminated union (text/image/icon/shape). */
  slides: jsonb("slides").notNull().default([]),
  /* Lifecycle. `status` drives whether the deck is visible at the
     public `/p/:id` route. `publishedAt` is set whenever status flips
     to "published" so we can sort/filter recent publishes. */
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  isShared: boolean("is_shared").notNull().default(false),
  /* Phase 2A linking — optional pointer to an existing Hasad activity
     (assignment) so a deck can launch / be associated with a graded
     activity. NULL = standalone deck. `kind` is a free-form text tag
     (`"assignment"` for now) to allow future activity types without a
     migration. Both columns are NULLable and have no FK so deletion
     cascade behavior of the linked activity is intentionally decoupled
     — we just clear the pointer at read-time if the assignment is gone. */
  linkedActivityId: text("linked_activity_id"),
  linkedActivityKind: text("linked_activity_kind"),
  lastPresentedAt: timestamp("last_presented_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPresentationSchema = createInsertSchema(presentationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPresentation = z.infer<typeof insertPresentationSchema>;
export type Presentation = typeof presentationsTable.$inferSelect;

/* Tracks every uploaded asset attached to a presentation so we can
   enforce per-presentation image / file caps in T7's tier system
   without having to walk the slides JSONB. `kind` is a simple text
   enum (`image` | `file`) — kept as text rather than pg enum so we
   can extend it later without a migration. */
export const presentationAssetsTable = pgTable("presentation_assets", {
  id: serial("id").primaryKey(),
  presentationId: integer("presentation_id").notNull().references(() => presentationsTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PresentationAsset = typeof presentationAssetsTable.$inferSelect;
