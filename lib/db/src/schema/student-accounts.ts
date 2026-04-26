import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const studentAccountsTable = pgTable("student_accounts", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"),
  email: text("email").unique(),
  googleId: text("google_id").unique(),
  totalScore: integer("total_score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StudentAccount = typeof studentAccountsTable.$inferSelect;
export type InsertStudentAccount = typeof studentAccountsTable.$inferInsert;
