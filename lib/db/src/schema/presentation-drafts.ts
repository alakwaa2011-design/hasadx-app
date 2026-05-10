import { pgTable, serial, text, timestamp, integer, jsonb, bigint } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { presentationsTable } from "./presentations";

/* AI Presentation Builder — Phase 1A storage.
   A "draft" represents one assistive outline run: brief inputs (Step 1)
   plus the validated outline (Step 2) the teacher reviewed/edited. The
   `presentationId` foreign key is filled by Phase 1B once the outline
   is built into a real deck — it stays NULL during Phase 1A.

   `status` lifecycle:
     draft          — outline not yet approved by teacher (still editing)
     outline_ready  — teacher approved; ready for Phase 1B build
     building       — Phase 1B in progress (reserved)
     built          — Phase 1B done; `presentationId` populated
     failed         — generation/build failed; `errorMessage` set
*/
export const presentationDraftsTable = pgTable("presentation_drafts", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  presentationId: integer("presentation_id").references(
    () => presentationsTable.id,
    { onDelete: "set null" },
  ),
  /* Step 1 — Brief inputs the teacher submitted. Stored as JSONB so we
     can evolve the brief shape (toggles, density modes, future fields)
     without per-field migrations. Sanitized before insert by the route. */
  brief: jsonb("brief").notNull(),
  /* Step 2 — Validated outline. Same shape as Zod `outlineSchema` in the
     ai-presentations route. May be edited by the teacher via PATCH. */
  outline: jsonb("outline").notNull(),
  status: text("status").notNull().default("draft"),
  /* Phase 1B build progress. Reserved here so the Phase 1B task can
     stream `{ current, total }` without another migration. */
  buildProgress: jsonb("build_progress"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  costMicroUsd: bigint("cost_micro_usd", { mode: "number" }).default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PresentationDraft = typeof presentationDraftsTable.$inferSelect;
export type InsertPresentationDraft = typeof presentationDraftsTable.$inferInsert;
