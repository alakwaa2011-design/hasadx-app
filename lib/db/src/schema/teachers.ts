import { pgTable, serial, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teachersTable = pgTable("teachers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash").notNull(),
  googleId: text("google_id").unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  // role: "teacher" | "organizer" | "admin"
  // - teacher: classroom teacher (default)
  // - organizer: events/competitions organizer; sees vibrant /organizer dashboard with teacher tools collapsed
  // - admin: super-admin; sees all UIs with a switcher; mirrors isAdmin=true
  role: text("role").notNull().default("teacher"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  aiTier: text("ai_tier").notNull().default("standard"),
  hasProDesign: boolean("has_pro_design").notNull().default(false),
  presentationsProEnabled: boolean("presentations_pro_enabled").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  // Google Classroom OAuth2 tokens
  classroomAccessToken: text("classroom_access_token"),
  classroomRefreshToken: text("classroom_refresh_token"),
  classroomTokenExpiry: timestamp("classroom_token_expiry"),
  // Microsoft Teams OAuth2 tokens
  teamsAccessToken: text("teams_access_token"),
  teamsRefreshToken: text("teams_refresh_token"),
  teamsTokenExpiry: timestamp("teams_token_expiry"),
  // Public profile / leaderboard fields (rewards system)
  displaySchool: text("display_school"),
  profileSlug: text("profile_slug").unique(),
  publicProfileEnabled: boolean("public_profile_enabled").notNull().default(false),
  showOnLeaderboard: boolean("show_on_leaderboard").notNull().default(true),
});

export const insertTeacherSchema = createInsertSchema(teachersTable).omit({ id: true, createdAt: true });
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachersTable.$inferSelect;
