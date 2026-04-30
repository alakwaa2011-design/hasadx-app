import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Single-row table — the admin edits this to inject extra context into every AI chat session. */
export const aiCustomInstructionsTable = pgTable("ai_custom_instructions", {
  id: serial("id").primaryKey(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
