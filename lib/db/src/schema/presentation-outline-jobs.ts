import { pgTable, serial, integer, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const presentationOutlineJobsTable = pgTable("presentation_outline_jobs", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  request: jsonb("request").notNull(),
  status: text("status").notNull().default("queued"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  creditRequestId: text("credit_request_id"),
  draftId: integer("draft_id"),
  claimToken: uuid("claim_token"),
  lockedAt: timestamp("locked_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PresentationOutlineJob = typeof presentationOutlineJobsTable.$inferSelect;