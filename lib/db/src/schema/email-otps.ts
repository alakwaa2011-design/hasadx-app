import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const emailOtpsTable = pgTable("email_otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  otpHash: text("otp_hash").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailOtp = typeof emailOtpsTable.$inferSelect;
