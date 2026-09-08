import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { studentAccountsTable } from "./student-accounts";
import { teachersTable } from "./teachers";

/** Isolated early-learning domain. It deliberately does not alter game scores or student XP. */
export const kidsProfilesTable = pgTable("kids_profiles", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().unique().references(() => studentAccountsTable.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key").notNull().default("kids/avatars/star"),
  ageBand: text("age_band").notNull().default("4-5"),
  locale: text("locale").notNull().default("ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kidsCatalogVersionsTable = pgTable("kids_catalog_versions", {
  version: text("version").primaryKey(),
  seededAt: timestamp("seeded_at").notNull().defaultNow(),
});

export const kidsWorldsTable = pgTable("kids_worlds", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  iconKey: text("icon_key").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isPublished: boolean("is_published").notNull().default(true),
});

export const kidsSkillsTable = pgTable("kids_skills", {
  id: serial("id").primaryKey(),
  worldId: integer("world_id").notNull().references(() => kidsWorldsTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const kidsActivitiesTable = pgTable("kids_activities", {
  id: serial("id").primaryKey(),
  skillId: integer("skill_id").notNull().references(() => kidsSkillsTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  activityType: text("activity_type").notNull(),
  content: jsonb("content").notNull(),
  assetKey: text("asset_key").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isPublished: boolean("is_published").notNull().default(true),
});

export const kidsActivitySessionsTable = pgTable("kids_activity_sessions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  activityId: integer("activity_id").notNull().references(() => kidsActivitiesTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  score: integer("score"),
  status: text("status").notNull().default("started"),
}, (t) => ({ profileRequestUnique: uniqueIndex("kids_sessions_profile_request_uq").on(t.profileId, t.idempotencyKey) }));

export const kidsAttemptsTable = pgTable("kids_attempts", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => kidsActivitySessionsTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  itemKey: text("item_key").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  response: jsonb("response"),
  activityType: text("activity_type").notNull().default("matching"),
  exampleId: text("example_id").notNull().default(""),
  correctWeight: integer("correct_weight").notNull().default(0),
  possibleWeight: integer("possible_weight").notNull().default(1),
  errors: jsonb("errors").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ sessionRequestUnique: uniqueIndex("kids_attempts_session_request_uq").on(t.sessionId, t.idempotencyKey) }));

export const kidsMasteryTable = pgTable("kids_mastery", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  skillId: integer("skill_id").notNull().references(() => kidsSkillsTable.id, { onDelete: "cascade" }),
  correctCount: integer("correct_count").notNull().default(0),
  attemptCount: integer("attempt_count").notNull().default(0),
  masteryPercent: integer("mastery_percent").notNull().default(0),
  state: text("state").notNull().default("not_started"),
  reviewDueAt: timestamp("review_due_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ profileSkillUnique: uniqueIndex("kids_mastery_profile_skill_uq").on(t.profileId, t.skillId) }));

export const kidsAdventureStatesTable = pgTable("kids_adventure_states", {
  profileId: integer("profile_id").primaryKey().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  stars: integer("stars").notNull().default(0),
  currentWorldSlug: text("current_world_slug").notNull().default("arabic-letters"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kidsDailyAdventuresTable = pgTable("kids_daily_adventures", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  adventureDate: text("adventure_date").notNull(),
  activityIds: jsonb("activity_ids").notNull(),
  completedIds: jsonb("completed_ids").notNull().default([]),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ profileDateUnique: uniqueIndex("kids_daily_adventure_profile_date_uq").on(t.profileId, t.adventureDate) }));

export const kidsRewardGrantsTable = pgTable("kids_reward_grants", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").unique().references(() => kidsActivitySessionsTable.id, { onDelete: "cascade" }),
  rewardKey: text("reward_key").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
});

export const kidsAdultGatesTable = pgTable("kids_adult_gates", {
  profileId: integer("profile_id").primaryKey().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const kidsBoardSessionsTable = pgTable("kids_board_sessions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "restrict" }),
  joinCode: text("join_code").unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});
export const kidsBoardEventsTable = pgTable("kids_board_events", {
  id: serial("id").primaryKey(),
  boardSessionId: integer("board_session_id").notNull().references(() => kidsBoardSessionsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").references(() => kidsProfilesTable.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kidsTeacherAssignmentsTable = pgTable("kids_teacher_assignments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  activityId: integer("activity_id").notNull().references(() => kidsActivitiesTable.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ assignmentUnique: uniqueIndex("kids_teacher_assignment_uq").on(t.teacherId, t.profileId, t.activityId) }));

/** A separate, teacher-supervised motivation currency. It is never game score, XP, or AI credit. */
export const studentMotivationProfilesTable = pgTable("student_motivation_profiles", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().unique().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const studentMotivationLedgerTable = pgTable("student_motivation_ledger", {
  id: serial("id").primaryKey(),
  motivationProfileId: integer("motivation_profile_id").notNull().references(() => studentMotivationProfilesTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: integer("reference_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdByTeacherId: integer("created_by_teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const motivationBadgeDefinitionsTable = pgTable("motivation_badge_definitions", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  iconKey: text("icon_key").notNull().default("motivation/badges/star"),
  ruleCategory: text("rule_category").notNull(),
  threshold: integer("threshold").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const motivationBadgeGrantsTable = pgTable("motivation_badge_grants", {
  id: serial("id").primaryKey(),
  badgeDefinitionId: integer("badge_definition_id").notNull().references(() => motivationBadgeDefinitionsTable.id, { onDelete: "restrict" }),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  grantedByTeacherId: integer("granted_by_teacher_id").notNull().references(() => teachersTable.id, { onDelete: "restrict" }),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (t) => ({ uniqueBadgeGrant: uniqueIndex("motivation_badge_grant_uq").on(t.badgeDefinitionId, t.profileId) }));

export const motivationRewardsTable = pgTable("motivation_rewards", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  cost: integer("cost").notNull(),
  availability: integer("availability"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const motivationRedemptionsTable = pgTable("motivation_redemptions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => kidsProfilesTable.id, { onDelete: "cascade" }),
  rewardId: integer("reward_id").notNull().references(() => motivationRewardsTable.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("requested"),
  requestKey: text("request_key").notNull(),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  decidedAt: timestamp("decided_at"),
  decidedByTeacherId: integer("decided_by_teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  deliveredAt: timestamp("delivered_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (t) => ({ uniqueRedemptionRequest: uniqueIndex("motivation_redemption_request_uq").on(t.profileId, t.requestKey) }));

export type StudentMotivationProfile = typeof studentMotivationProfilesTable.$inferSelect;
export type StudentMotivationLedgerEntry = typeof studentMotivationLedgerTable.$inferSelect;
export type MotivationBadgeDefinition = typeof motivationBadgeDefinitionsTable.$inferSelect;
export type MotivationBadgeGrant = typeof motivationBadgeGrantsTable.$inferSelect;
export type MotivationReward = typeof motivationRewardsTable.$inferSelect;
export type MotivationRedemption = typeof motivationRedemptionsTable.$inferSelect;