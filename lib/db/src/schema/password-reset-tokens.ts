import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    teacherIdx: index("password_reset_tokens_teacher_idx").on(t.teacherId),
  }),
);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
