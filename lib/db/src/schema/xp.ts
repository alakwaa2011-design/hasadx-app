import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  boolean,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { teachersTable } from "./teachers";

/* =========================================================================
 * Append-only XP ledger. Negative deltas allowed (reversals/adjustments).
 * Idempotency: composite UNIQUE(teacher_id, action_key, ref_id) when refId
 * is provided. Daily/weekly caps enforced via partial unique index using
 * cap_bucket (e.g. "2026-05-14:assignment.create").
 * ========================================================================= */
export const xpEventsTable = pgTable(
  "xp_events",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    actionKey: text("action_key").notNull(),
    refId: text("ref_id"),
    delta: integer("delta").notNull(),
    reason: text("reason"),
    seasonId: integer("season_id"),
    capBucket: text("cap_bucket"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    teacherIdx: index("xp_events_teacher_idx").on(t.teacherId, t.createdAt),
    seasonIdx: index("xp_events_season_idx").on(t.seasonId, t.teacherId),
    actionIdx: index("xp_events_action_idx").on(t.actionKey),
  }),
);

export type XpEvent = typeof xpEventsTable.$inferSelect;

/* =========================================================================
 * Incrementally-maintained per-teacher counters. Updated inside same tx
 * as the ledger insert. The leaderboard reads from here (cached).
 * ========================================================================= */
export const teacherStatsTable = pgTable("teacher_stats", {
  teacherId: integer("teacher_id")
    .primaryKey()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0),
  seasonXp: integer("season_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentStreakDays: integer("current_streak_days").notNull().default(0),
  longestStreakDays: integer("longest_streak_days").notNull().default(0),
  lastActiveDate: date("last_active_date"),
  badgeCount: integer("badge_count").notNull().default(0),
  questsCompleted: integer("quests_completed").notNull().default(0),
  /** When set (1–7), achievements UI shows this tier instead of XP-derived level. */
  displayLevelOverride: integer("display_level_override"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TeacherStats = typeof teacherStatsTable.$inferSelect;

/* =========================================================================
 * Badge catalog. unlock_rule is a closed-DSL JSON expression evaluated by
 * the rules engine (NO eval/Function). Examples:
 *   { "stat": "totalXp", "op": ">=", "value": 1000 }
 *   { "all": [ {stat:"questsCompleted",op:">=",value:5},
 *              {stat:"longestStreakDays",op:">=",value:7} ] }
 * ========================================================================= */
export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  descriptionAr: text("description_ar").notNull(),
  icon: text("icon").notNull(),
  tier: text("tier").notNull().default("bronze"), // bronze|silver|gold|legendary
  unlockRule: jsonb("unlock_rule").$type<Record<string, unknown>>().notNull(),
  functionalUnlock: jsonb("functional_unlock").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Badge = typeof badgesTable.$inferSelect;

export const teacherBadgesTable = pgTable(
  "teacher_badges",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    badgeId: integer("badge_id")
      .notNull()
      .references(() => badgesTable.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqTeacherBadge: uniqueIndex("teacher_badges_uniq").on(
      t.teacherId,
      t.badgeId,
    ),
    teacherIdx: index("teacher_badges_teacher_idx").on(t.teacherId),
  }),
);

export type TeacherBadge = typeof teacherBadgesTable.$inferSelect;

/* =========================================================================
 * Seasons (e.g. "ربيع ١٤٤٧"). One active at a time.
 * On close, snapshot top-N into season_results then reset season_xp.
 * ========================================================================= */
export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming|active|closed
  prizesConfig: jsonb("prizes_config").$type<{
    /** Ranked prizes: index 0 → 1st, 1 → 2nd, ... */
    ranks?: Array<{ label: string; description?: string }>;
    /** Tier prizes: any teacher whose final XP ≥ minXp gets this prize */
    tiers?: Array<{ minXp: number; label: string; description?: string }>;
  }>(),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Season = typeof seasonsTable.$inferSelect;

export const seasonResultsTable = pgTable(
  "season_results",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasonsTable.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    finalXp: integer("final_xp").notNull(),
    prizeLabel: text("prize_label"),
    fulfilled: boolean("fulfilled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqSeasonTeacher: uniqueIndex("season_results_uniq").on(
      t.seasonId,
      t.teacherId,
    ),
    seasonIdx: index("season_results_season_idx").on(t.seasonId, t.rank),
  }),
);

/* =========================================================================
 * Weekly quests catalog. progress_rule is closed DSL describing what counts.
 * Per-teacher progress lives in quest_progress.
 * ========================================================================= */
export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  titleAr: text("title_ar").notNull(),
  descriptionAr: text("description_ar").notNull(),
  /** e.g. { actionKey: "assignment.create", count: 3 } */
  progressRule: jsonb("progress_rule").$type<{
    actionKey: string;
    count: number;
  }>().notNull(),
  rewardXp: integer("reward_xp").notNull().default(50),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Quest = typeof questsTable.$inferSelect;

export const questProgressTable = pgTable(
  "quest_progress",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    questId: integer("quest_id")
      .notNull()
      .references(() => questsTable.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull().default(0),
    completedAt: timestamp("completed_at"),
    rewardedAt: timestamp("rewarded_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqTeacherQuest: uniqueIndex("quest_progress_uniq").on(
      t.teacherId,
      t.questId,
    ),
  }),
);

/* =========================================================================
 * XP rules table — admin-editable point values (and caps) per action.
 * If a row is missing for an actionKey the engine uses defaults from code.
 * Caps:  daily_cap / weekly_cap (per action) — both optional.
 * ========================================================================= */
export const xpRulesTable = pgTable("xp_rules", {
  id: serial("id").primaryKey(),
  actionKey: text("action_key").notNull().unique(),
  labelAr: text("label_ar").notNull(),
  points: integer("points").notNull(),
  dailyCap: integer("daily_cap"),
  weeklyCap: integer("weekly_cap"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type XpRule = typeof xpRulesTable.$inferSelect;

/* Manual XP adjustments by admins (bonus/penalty), audited. */
export const xpAdjustmentsTable = pgTable("xp_adjustments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  // admin_id is nullable so the FK ON DELETE SET NULL is consistent —
  // historical adjustments outlive the admin who made them.
  adminId: integer("admin_id").references(() => teachersTable.id, {
    onDelete: "set null",
  }),
  xpEventId: integer("xp_event_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* =========================================================================
 * Threshold Rewards Builder — admin-defined no-code rules:
 *   "When teacher reaches LEVEL >= N"  OR  "totalXp >= N"
 *   automatically grant prize: { kind, label, description, ... }.
 * Grants table records each granted prize and its fulfillment status.
 * ========================================================================= */
export const thresholdRewardsTable = pgTable("threshold_rewards", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  /** "level" | "totalXp" | "badgeCount" | "questsCompleted" | "streak" */
  metric: text("metric").notNull(),
  threshold: integer("threshold").notNull(),
  prizeKind: text("prize_kind").notNull(), // "feature_unlock" | "shipped_item" | "title" | "perk"
  prizeLabelAr: text("prize_label_ar").notNull(),
  prizeDescriptionAr: text("prize_description_ar"),
  /** Optional payload (e.g. {"feature":"presentations_pro_enabled","value":true}) */
  prizePayload: jsonb("prize_payload").$type<Record<string, unknown>>(),
  /** If true, automatically apply prizePayload (e.g. flip a teacher flag) */
  autoApply: boolean("auto_apply").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ThresholdReward = typeof thresholdRewardsTable.$inferSelect;

export const thresholdRewardGrantsTable = pgTable(
  "threshold_reward_grants",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    rewardId: integer("reward_id")
      .notNull()
      .references(() => thresholdRewardsTable.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    autoApplied: boolean("auto_applied").notNull().default(false),
    fulfilled: boolean("fulfilled").notNull().default(false),
  },
  (t) => ({
    uniqGrant: uniqueIndex("threshold_reward_grants_uniq").on(
      t.teacherId,
      t.rewardId,
    ),
    teacherIdx: index("threshold_reward_grants_teacher_idx").on(t.teacherId),
  }),
);

/* Fulfillment queue (shipping/delivery for physical/manual prizes). */
export const fulfillmentQueueTable = pgTable("fulfillment_queue", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // "season" | "threshold" | "badge" | "quest"
  sourceId: integer("source_id"),
  prizeLabel: text("prize_label").notNull(),
  prizeDescription: text("prize_description"),
  status: text("status").notNull().default("pending"), // pending|in_progress|delivered|cancelled
  notes: text("notes"),
  shippingAddress: text("shipping_address"),
  trackingRef: text("tracking_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* Email outbox — write rows on awardXp / threshold-grant; a worker (or
 * admin-triggered route) sends them via Resend later. */
export const emailOutboxTable = pgTable(
  "email_outbox",
  {
    id: serial("id").primaryKey(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body"),
    /** Idempotency key — only one row per (kind, refKey) is inserted. */
    kind: text("kind").notNull(),
    refKey: text("ref_key").notNull(),
    status: text("status").notNull().default("pending"), // pending|sent|failed|skipped
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at"),
    nextAttemptAt: timestamp("next_attempt_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqKindRef: uniqueIndex("email_outbox_uniq_kind_ref").on(t.kind, t.refKey),
    statusIdx: index("email_outbox_status_idx").on(t.status, t.nextAttemptAt),
  }),
);

/* Public profile follows. */
export const teacherFollowersTable = pgTable(
  "teacher_followers",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    followerId: integer("follower_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqFollow: uniqueIndex("teacher_followers_uniq").on(
      t.teacherId,
      t.followerId,
    ),
  }),
);

/* =========================================================================
 * SQL helper: raw migration string applied at server startup.
 * Includes the partial unique indexes that enforce idempotency + caps,
 * which Drizzle doesn't easily express without raw SQL.
 * ========================================================================= */
export const XP_MIGRATION_SQL = sql`
-- Extend teachers with public-profile + streak columns
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS display_school TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS xp_events (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  action_key  TEXT NOT NULL,
  ref_id      TEXT,
  delta       INTEGER NOT NULL,
  reason      TEXT,
  season_id   INTEGER,
  cap_bucket  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_events_teacher_idx ON xp_events(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS xp_events_season_idx  ON xp_events(season_id, teacher_id);
CREATE INDEX IF NOT EXISTS xp_events_action_idx  ON xp_events(action_key);
-- Idempotency: a given (teacher, action, ref_id) is only ever recorded once.
-- Drop any prior partial variant so the conflict target can match.
DROP INDEX IF EXISTS xp_events_idem_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_idem_uniq
  ON xp_events(teacher_id, action_key, ref_id);

-- DB-level cap enforcement: cap_bucket encodes the slot number
-- (e.g. "2026-05-14:assignment.create:0", ":1", ":2"...).
-- A concurrent request that wins the row-lock race and receives the same
-- slot will hit this UNIQUE violation, ensuring no burst over-grant even
-- when two requests interleave between count-check and insert.
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_cap_bucket_uniq
  ON xp_events(teacher_id, action_key, cap_bucket)
  WHERE cap_bucket IS NOT NULL;

CREATE TABLE IF NOT EXISTS teacher_stats (
  teacher_id            INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  total_xp              INTEGER NOT NULL DEFAULT 0,
  season_xp             INTEGER NOT NULL DEFAULT 0,
  level                 INTEGER NOT NULL DEFAULT 1,
  current_streak_days   INTEGER NOT NULL DEFAULT 0,
  longest_streak_days   INTEGER NOT NULL DEFAULT 0,
  last_active_date      DATE,
  badge_count           INTEGER NOT NULL DEFAULT 0,
  quests_completed      INTEGER NOT NULL DEFAULT 0,
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE teacher_stats ADD COLUMN IF NOT EXISTS display_level_override INTEGER;

CREATE TABLE IF NOT EXISTS badges (
  id                  SERIAL PRIMARY KEY,
  key                 TEXT NOT NULL UNIQUE,
  name_ar             TEXT NOT NULL,
  description_ar      TEXT NOT NULL,
  icon                TEXT NOT NULL,
  tier                TEXT NOT NULL DEFAULT 'bronze',
  unlock_rule         JSONB NOT NULL,
  functional_unlock   JSONB,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_badges (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  badge_id    INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_badges_uniq ON teacher_badges(teacher_id, badge_id);
CREATE INDEX IF NOT EXISTS teacher_badges_teacher_idx ON teacher_badges(teacher_id);

CREATE TABLE IF NOT EXISTS seasons (
  id              SERIAL PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  status          TEXT NOT NULL DEFAULT 'upcoming',
  prizes_config   JSONB,
  closed_at       TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS season_results (
  id           SERIAL PRIMARY KEY,
  season_id    INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  rank         INTEGER NOT NULL,
  final_xp     INTEGER NOT NULL,
  prize_label  TEXT,
  fulfilled    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS season_results_uniq ON season_results(season_id, teacher_id);
CREATE INDEX IF NOT EXISTS season_results_season_idx ON season_results(season_id, rank);

CREATE TABLE IF NOT EXISTS quests (
  id              SERIAL PRIMARY KEY,
  key             TEXT NOT NULL,
  title_ar        TEXT NOT NULL,
  description_ar  TEXT NOT NULL,
  progress_rule   JSONB NOT NULL,
  reward_xp       INTEGER NOT NULL DEFAULT 50,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_progress (
  id            SERIAL PRIMARY KEY,
  teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  quest_id      INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  progress      INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMP,
  rewarded_at   TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quest_progress_uniq ON quest_progress(teacher_id, quest_id);

CREATE TABLE IF NOT EXISTS xp_rules (
  id           SERIAL PRIMARY KEY,
  action_key   TEXT NOT NULL UNIQUE,
  label_ar     TEXT NOT NULL,
  points       INTEGER NOT NULL,
  daily_cap    INTEGER,
  weekly_cap   INTEGER,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xp_adjustments (
  id            SERIAL PRIMARY KEY,
  teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  admin_id      INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  xp_event_id   INTEGER,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threshold_rewards (
  id                    SERIAL PRIMARY KEY,
  name_ar               TEXT NOT NULL,
  metric                TEXT NOT NULL,
  threshold             INTEGER NOT NULL,
  prize_kind            TEXT NOT NULL,
  prize_label_ar        TEXT NOT NULL,
  prize_description_ar  TEXT,
  prize_payload         JSONB,
  auto_apply            BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threshold_reward_grants (
  id            SERIAL PRIMARY KEY,
  teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  reward_id     INTEGER NOT NULL REFERENCES threshold_rewards(id) ON DELETE CASCADE,
  granted_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  auto_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  fulfilled     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS threshold_reward_grants_uniq ON threshold_reward_grants(teacher_id, reward_id);
CREATE INDEX IF NOT EXISTS threshold_reward_grants_teacher_idx ON threshold_reward_grants(teacher_id);

CREATE TABLE IF NOT EXISTS fulfillment_queue (
  id                  SERIAL PRIMARY KEY,
  teacher_id          INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  source              TEXT NOT NULL,
  source_id           INTEGER,
  prize_label         TEXT NOT NULL,
  prize_description   TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  notes               TEXT,
  shipping_address    TEXT,
  tracking_ref        TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id           SERIAL PRIMARY KEY,
  to_email     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  html_body    TEXT NOT NULL,
  text_body    TEXT,
  kind         TEXT NOT NULL,
  ref_key      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  sent_at      TIMESTAMP,
  next_attempt_at TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP;
UPDATE email_outbox SET next_attempt_at = created_at WHERE next_attempt_at IS NULL AND status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_uniq_kind_ref ON email_outbox(kind, ref_key);
DROP INDEX IF EXISTS email_outbox_status_idx;
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON email_outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS teacher_followers (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  follower_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_followers_uniq ON teacher_followers(teacher_id, follower_id);
`;
