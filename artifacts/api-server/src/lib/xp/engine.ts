/**
 * XP Engine — single entry point: awardXp().
 *
 * Architectural constraints (from task #605 plan, do NOT break):
 *  1. DB-level idempotency via UNIQUE(teacher_id, action_key, ref_id)
 *  2. All writes happen inside a single transaction (ledger + stats)
 *  3. Append-only ledger; reversals/admin tweaks insert NEGATIVE rows
 *  4. Daily/weekly caps enforced via cap_bucket (Asia/Riyadh tz)
 *  5. Closed-DSL JSON for badge/threshold rules — NO eval/Function
 *  6. Feature flag XP_ENGINE_ENABLED gates the whole pipeline
 *  7. Email outbox pattern (don't send inline — write a row)
 *  8. Debounced socket emit (handled at the caller / instrumentation layer)
 */
import {
  db,
  xpEventsTable,
  teacherStatsTable,
  badgesTable,
  teacherBadgesTable,
  xpRulesTable,
  questsTable,
  questProgressTable,
  xpAdjustmentsTable,
  thresholdRewardsTable,
  thresholdRewardGrantsTable,
  fulfillmentQueueTable,
  emailOutboxTable,
  seasonsTable,
  teachersTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { evaluateRule } from "./rules-engine";
import { LEVELS, levelForXp } from "./levels";
import { DEFAULT_XP_RULES } from "./defaults";
import { isTeacherXpRewardsEnabled } from "./teacher-xp-rewards-flag";
import { notifyEmailQueued } from "./email-worker";

/** Asia/Riyadh = UTC+3 (no DST). YYYY-MM-DD bucket. */
function riyadhDateString(d = new Date()): string {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const riyadh = new Date(utcMs + 3 * 3_600_000);
  const y = riyadh.getUTCFullYear();
  const m = String(riyadh.getUTCMonth() + 1).padStart(2, "0");
  const day = String(riyadh.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO week bucket (YYYY-Www) in Riyadh tz. */
function riyadhWeekString(d = new Date()): string {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const riyadh = new Date(utcMs + 3 * 3_600_000);
  const target = new Date(
    Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate()),
  );
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Escape user-controlled strings before embedding in email HTML bodies. */
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isXpEnabled(): boolean {
  // Default: enabled unless explicitly disabled
  return process.env.XP_ENGINE_ENABLED !== "false";
}

export interface AwardXpInput {
  teacherId: number;
  actionKey: string;
  /** Stable ref to enforce idempotency (e.g. assignment id, submission id). */
  refId?: string | number;
  /** Override default points for this rule (rare; usually omit). */
  pointsOverride?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AwardXpResult {
  awarded: boolean;
  delta: number;
  reason:
    | "ok"
    | "disabled"
    | "duplicate"
    | "rule_inactive"
    | "rule_missing"
    | "daily_cap"
    | "weekly_cap"
    | "no_teacher"
    | "error";
  /** The action key that generated this result — included for socket batching. */
  actionKey?: string;
  /** Never included in socket payload — client refetches /me/achievements for trusted state. */
  newTotalXp?: number;
  /** Never included in socket payload — client refetches /me/achievements for trusted state. */
  newLevel?: number;
  leveledUp?: boolean;
  newBadgeKeys?: string[];
  newGrantIds?: number[];
}

interface EffectiveRule {
  points: number;
  dailyCap: number | null;
  weeklyCap: number | null;
  isActive: boolean;
}

async function loadEffectiveRule(actionKey: string): Promise<EffectiveRule | null> {
  const [row] = await db
    .select()
    .from(xpRulesTable)
    .where(eq(xpRulesTable.actionKey, actionKey))
    .limit(1);
  if (row) {
    return {
      points: row.points,
      dailyCap: row.dailyCap ?? null,
      weeklyCap: row.weeklyCap ?? null,
      isActive: row.isActive,
    };
  }
  // Fallback to defaults if not seeded yet
  const def = DEFAULT_XP_RULES.find((r) => r.actionKey === actionKey);
  if (!def) return null;
  return {
    points: def.points,
    dailyCap: def.dailyCap ?? null,
    weeklyCap: def.weeklyCap ?? null,
    isActive: true,
  };
}

async function findActiveSeasonId(): Promise<number | null> {
  const [s] = await db
    .select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(eq(seasonsTable.status, "active"))
    .limit(1);
  return s?.id ?? null;
}

/**
 * A drizzle transaction handle, structurally compatible with `db` for the
 * subset of methods we use (insert/select/update). Callers that already own
 * an open transaction can pass it via `awardXp(input, { tx })` so the XP
 * ledger row is committed atomically with the originating action.
 */
export type XpTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type GrantOutcome =
  | { capped: "daily" | "weekly" }
  | { duplicate: true }
  | {
      duplicate: false;
      oldLevel: number;
      newLevel: number;
      newTotal: number;
      currentStreak: number;
      longestStreak: number;
    };

/**
 * Run the ledger insert + stats update on the given tx. Does NOT run the
 * post-grant side-effects (badges, threshold rewards, quests) — those must
 * happen after the outer transaction commits, via runAwardXpSideEffects().
 */
async function grantOnTx(
  tx: XpTx,
  input: AwardXpInput,
  rule: EffectiveRule,
  points: number,
  refId: string,
  dailyBucket: string,
  weeklyBucket: string,
  seasonId: number | null,
): Promise<GrantOutcome> {
  // 1. Lock the teacher row first. This serialises all awards for the
  //    same teacher across processes — every cap check below is read
  //    after this lock, so SUMs are stable for the duration of the tx.
  const todayDate = riyadhDateString();
  // Ensure the stats row exists exactly once, then lock it. Doing the
  // upsert first guarantees the FOR UPDATE select below always finds a
  // row, so we never hit a duplicate-PK insert later in the flow.
  await tx
    .insert(teacherStatsTable)
    .values({ teacherId: input.teacherId })
    .onConflictDoNothing({ target: teacherStatsTable.teacherId });
  const [existing] = await tx
    .select()
    .from(teacherStatsTable)
    .where(eq(teacherStatsTable.teacherId, input.teacherId))
    .limit(1)
    .for("update");

  // 2. Cap checks under the lock.
  //    Caps are enforced on EVENT COUNT (number of times the action was
  //    performed today/this week), NOT on XP sum, so "max 5 worksheets/day"
  //    means 5 events regardless of how many points each is worth.
  //    The SELECT runs inside the row-locked tx so the count is stable.
  let dayCnt = 0;
  let weekCnt = 0;
  if (rule.dailyCap != null) {
    const [{ cnt }] = await tx
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(xpEventsTable)
      .where(
        and(
          eq(xpEventsTable.teacherId, input.teacherId),
          eq(xpEventsTable.actionKey, input.actionKey),
          sql`${xpEventsTable.delta} > 0`,
          sql`${xpEventsTable.createdAt} >= (now() AT TIME ZONE 'Asia/Riyadh')::date AT TIME ZONE 'Asia/Riyadh'`,
        ),
      );
    dayCnt = cnt ?? 0;
    if (dayCnt >= rule.dailyCap) {
      return { capped: "daily" };
    }
  }
  if (rule.weeklyCap != null) {
    const [{ cnt }] = await tx
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(xpEventsTable)
      .where(
        and(
          eq(xpEventsTable.teacherId, input.teacherId),
          eq(xpEventsTable.actionKey, input.actionKey),
          sql`${xpEventsTable.delta} > 0`,
          sql`${xpEventsTable.createdAt} >= date_trunc('week', (now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh'`,
        ),
      );
    weekCnt = cnt ?? 0;
    if (weekCnt >= rule.weeklyCap) {
      return { capped: "weekly" };
    }
  }

  // 3. Insert ledger; if conflict on (teacher,action,ref_id) → duplicate.
  //    cap_bucket encodes the slot (count position) so the DB-level UNIQUE
  //    index on (teacher_id, action_key, cap_bucket) also prevents
  //    over-grant under concurrent burst writes — belt-and-suspenders.
  const capSlot = rule.weeklyCap != null ? weekCnt : dayCnt;
  const capBucketValue =
    rule.weeklyCap != null
      ? `${weeklyBucket}:${capSlot}`
      : rule.dailyCap != null
        ? `${dailyBucket}:${capSlot}`
        : null;

  const inserted = await tx
    .insert(xpEventsTable)
    .values({
      teacherId: input.teacherId,
      actionKey: input.actionKey,
      refId,
      delta: points,
      reason: input.reason,
      seasonId: seasonId ?? undefined,
      capBucket: capBucketValue,
      metadata: input.metadata,
    })
    // No-target: handles BOTH the idempotency unique index and the
    // cap_bucket unique index (belt-and-suspenders for burst concurrency).
    // Either conflict returns no rows → detected below.
    .onConflictDoNothing()
    .returning({ id: xpEventsTable.id });

  if (inserted.length === 0) {
    return { duplicate: true };
  }

  // Streak math
  let currentStreak = 1;
  let longestStreak = Math.max(1, existing?.longestStreakDays ?? 0);
  if (existing?.lastActiveDate) {
    const last = String(existing.lastActiveDate);
    if (last === todayDate) {
      currentStreak = existing.currentStreakDays;
    } else {
      // yesterday in Riyadh tz?
      const yest = riyadhDateString(new Date(Date.now() - 86_400_000));
      if (last === yest) {
        currentStreak = existing.currentStreakDays + 1;
      } else {
        currentStreak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  const oldTotal = existing?.totalXp ?? 0;
  const newTotal = oldTotal + points;
  const newSeasonXp = (existing?.seasonXp ?? 0) + (seasonId ? points : 0);
  const oldLevel = existing?.level ?? 1;
  const newLevel = levelForXp(newTotal).level;

  // Stats row is guaranteed to exist (upserted+locked above), so always
  // UPDATE — never INSERT a second time, which would raise PK conflict.
  await tx
    .update(teacherStatsTable)
    .set({
      totalXp: newTotal,
      seasonXp: newSeasonXp,
      level: newLevel,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      lastActiveDate: todayDate,
      updatedAt: new Date(),
    })
    .where(eq(teacherStatsTable.teacherId, input.teacherId));

  return {
    duplicate: false,
    oldLevel,
    newLevel,
    newTotal,
    currentStreak,
    longestStreak,
  };
}

/**
 * Run the post-grant side-effects (badges, threshold rewards, quests, level-up notification).
 * Each helper is idempotent. Intended to be called AFTER the originating
 * transaction commits so a downstream failure can't roll back the XP grant.
 */
export async function runAwardXpSideEffects(
  teacherId: number,
  actionKey: string,
  opts?: { leveledUp?: boolean; newLevel?: number },
): Promise<{ newBadgeKeys: string[]; newGrantIds: number[] }> {
  // Fire level-up notification (milestone — bypass debounce on socket side)
  if (opts?.leveledUp && opts.newLevel != null) {
    const lvl = LEVELS.find((l) => l.level === opts.newLevel);
    if (lvl) {
      void notifyLevelUp(teacherId, lvl.level, lvl.nameAr).catch((err) =>
        logger.error({ err, teacherId, newLevel: opts.newLevel }, "notifyLevelUp failed"),
      );
    }
  }

  const [newBadgeKeys, newGrantIds] = await Promise.all([
    evaluateAndAwardBadges(teacherId).catch((err) => {
      logger.error({ err, teacherId }, "badge eval failed");
      return [] as string[];
    }),
    evaluateAndGrantThresholdRewards(teacherId).catch((err) => {
      logger.error({ err, teacherId }, "threshold reward eval failed");
      return [] as number[];
    }),
  ]);

  void progressQuestsForAction(teacherId, actionKey).catch((err) =>
    logger.error({ err }, "quest progress failed"),
  );

  return { newBadgeKeys, newGrantIds };
}

/**
 * Award XP to a teacher. Safe to call multiple times with the same refId —
 * the unique index on (teacher_id, action_key, ref_id) makes it a no-op.
 *
 * When `opts.tx` is provided, the ledger insert + stats update run on the
 * caller's open transaction (atomic with the originating action). In that
 * mode this function does NOT run badge/threshold/quest side-effects — the
 * caller is responsible for invoking `runAwardXpSideEffects()` after their
 * transaction commits (typically via `awardXpInTxAndNotifyAfterCommit()`).
 */
export async function awardXp(
  input: AwardXpInput,
  opts?: { tx?: XpTx },
): Promise<AwardXpResult> {
  if (!isXpEnabled()) return { awarded: false, delta: 0, reason: "disabled" };
  if (!(await isTeacherXpRewardsEnabled()))
    return { awarded: false, delta: 0, reason: "disabled" };

  try {
    const rule = await loadEffectiveRule(input.actionKey);
    if (!rule) return { awarded: false, delta: 0, reason: "rule_missing" };
    if (!rule.isActive)
      return { awarded: false, delta: 0, reason: "rule_inactive" };

    const points = input.pointsOverride ?? rule.points;
    if (points === 0) return { awarded: false, delta: 0, reason: "ok" };

    // refId must be non-null for the unique idempotency index to apply.
    // When the caller doesn't supply one, synthesize a unique value so the
    // event is recorded but isn't deduplicated (intentional: caller chose
    // non-idempotent semantics).
    const refId =
      input.refId == null
        ? `auto:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
        : String(input.refId);
    const dailyBucket = `${riyadhDateString()}:${input.actionKey}`;
    const weeklyBucket = `${riyadhWeekString()}:${input.actionKey}`;
    const seasonId = await findActiveSeasonId();

    // Insert ledger row + update stats inside a transaction.
    // Cap checks happen INSIDE the tx, after we lock the teacher_stats row,
    // so concurrent awards for the same teacher are serialised and cannot
    // over-grant past the cap. When the caller supplied their own tx, reuse
    // it so the XP ledger row commits atomically with their action.
    const result: GrantOutcome = opts?.tx
      ? await grantOnTx(
          opts.tx,
          input,
          rule,
          points,
          refId,
          dailyBucket,
          weeklyBucket,
          seasonId,
        )
      : await db.transaction((tx) =>
          grantOnTx(
            tx,
            input,
            rule,
            points,
            refId,
            dailyBucket,
            weeklyBucket,
            seasonId,
          ),
        );

    if ("capped" in result) {
      return {
        awarded: false,
        delta: 0,
        reason: result.capped === "daily" ? "daily_cap" : "weekly_cap",
      };
    }
    if (result.duplicate) {
      return { awarded: false, delta: 0, reason: "duplicate" };
    }

    // Side-effects (badges, thresholds, quests) only run when we own the
    // transaction. When the caller passed their own tx, they must invoke
    // runAwardXpSideEffects() AFTER their tx commits — otherwise we'd
    // potentially mutate persisted state for a transaction that later rolls
    // back. The socket helper awardXpInTxAndNotifyAfterCommit() handles this.
    let newBadgeKeys: string[] = [];
    let newGrantIds: number[] = [];
    if (!opts?.tx) {
      const sideEffects = await runAwardXpSideEffects(
        input.teacherId,
        input.actionKey,
        {
          leveledUp: result.newLevel > result.oldLevel,
          newLevel: result.newLevel,
        },
      );
      newBadgeKeys = sideEffects.newBadgeKeys;
      newGrantIds = sideEffects.newGrantIds;
    }

    return {
      awarded: true,
      delta: points,
      reason: "ok",
      actionKey: input.actionKey,
      newTotalXp: result.newTotal,
      newLevel: result.newLevel,
      leveledUp: result.newLevel > result.oldLevel,
      newBadgeKeys,
      newGrantIds,
    };
  } catch (err) {
    logger.error({ err, input }, "awardXp failed");
    // When the caller passed their own tx, propagate so the outer
    // transaction rolls back — XP must commit atomically with the action.
    // For fire-and-forget callers (no tx), preserve the legacy soft-fail
    // behaviour so a transient XP failure can't break unrelated requests.
    if (opts?.tx) throw err;
    return { awarded: false, delta: 0, reason: "error" };
  }
}

/**
 * Reverse an earlier XP grant within the 5-minute protection window.
 * Spec §3: "insert a new event with xp_value = -original_value,
 * action_key = '<action>:reversed', ref_id pointing to the original event."
 *
 * @param teacherId  Teacher whose XP should be reversed.
 * @param actionKey  The original action key (e.g. "worksheet.generate").
 * @param refId      The ref_id used when the XP was originally granted.
 * @returns          Whether a reversal was inserted (false = outside window or no event found).
 */
export async function reverseXpIfWithinWindow(
  teacherId: number,
  actionKey: string,
  refId: string,
  windowMs = 5 * 60 * 1_000,
): Promise<boolean> {
  if (!isXpEnabled()) return false;
  if (!(await isTeacherXpRewardsEnabled())) return false;
  try {
    const [original] = await db
      .select({ id: xpEventsTable.id, delta: xpEventsTable.delta, createdAt: xpEventsTable.createdAt })
      .from(xpEventsTable)
      .where(
        and(
          eq(xpEventsTable.teacherId, teacherId),
          eq(xpEventsTable.actionKey, actionKey),
          eq(xpEventsTable.refId, refId),
          sql`${xpEventsTable.delta} > 0`,
        ),
      )
      .limit(1);

    if (!original) return false;

    const ageMs = Date.now() - new Date(original.createdAt).getTime();
    if (ageMs > windowMs) return false;

    const reversalDelta = -original.delta;
    const reversalRef = `rev:${original.id}`;
    const reversalActionKey = `${actionKey}:reversed`;

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(xpEventsTable)
        .values({
          teacherId,
          actionKey: reversalActionKey,
          refId: reversalRef,
          delta: reversalDelta,
          reason: `Reversed within 5-min window — original event #${original.id}`,
          seasonId: null,
          capBucket: null,
          metadata: { originalEventId: original.id, originalActionKey: actionKey },
        })
        .onConflictDoNothing({
          target: [xpEventsTable.teacherId, xpEventsTable.actionKey, xpEventsTable.refId],
        })
        .returning({ id: xpEventsTable.id });

      if (inserted.length === 0) return; // already reversed

      // Update stats aggregate (append-only sum)
      await tx
        .update(teacherStatsTable)
        .set({
          totalXp: sql`GREATEST(0, ${teacherStatsTable.totalXp} + ${reversalDelta})`,
          seasonXp: sql`GREATEST(0, ${teacherStatsTable.seasonXp} + ${reversalDelta})`,
          updatedAt: new Date(),
        })
        .where(eq(teacherStatsTable.teacherId, teacherId));
    });

    logger.info({ teacherId, actionKey, refId, reversalDelta }, "XP reversal applied");
    return true;
  } catch (err) {
    logger.error({ err, teacherId, actionKey, refId }, "reverseXpIfWithinWindow failed");
    return false;
  }
}

/* ------------------------------------------------------------------------ */
/* Badges                                                                   */
/* ------------------------------------------------------------------------ */

async function buildStatLookup(
  teacherId: number,
  statsRow: typeof teacherStatsTable.$inferSelect,
  earnedBadges: Array<{ badgeId: number; key: string }>,
  activeSeason: { id: number } | null,
): Promise<Record<string, number>> {
  // Base stats from teacher_stats row (camelCase keys for backward compat)
  const lookup: Record<string, number> = {
    totalXp: statsRow.totalXp,
    seasonXp: statsRow.seasonXp,
    level: statsRow.level,
    currentStreakDays: statsRow.currentStreakDays,
    longestStreakDays: statsRow.longestStreakDays,
    badgeCount: statsRow.badgeCount,
    questsCompleted: statsRow.questsCompleted,
    // snake_case aliases for DSL predicate nodes
    total_xp: statsRow.totalXp,
    season_xp: statsRow.seasonXp,
    current_streak_days: statsRow.currentStreakDays,
    longest_streak_days: statsRow.longestStreakDays,
    badge_count: statsRow.badgeCount,
    quests_completed: statsRow.questsCompleted,
  };

  // has_badge:{key} → 1 if earned, 0 otherwise
  for (const b of earnedBadges) {
    lookup[`has_badge:${b.key}`] = 1;
  }

  // count_action:{action} and count_action:{action}:season
  const actionCounts = await db
    .select({
      actionKey: xpEventsTable.actionKey,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(xpEventsTable)
    .where(
      and(
        eq(xpEventsTable.teacherId, teacherId),
        sql`${xpEventsTable.delta} > 0`,
      ),
    )
    .groupBy(xpEventsTable.actionKey);

  for (const row of actionCounts) {
    lookup[`count_action:${row.actionKey}`] = row.count;
  }

  if (activeSeason) {
    const seasonActionCounts = await db
      .select({
        actionKey: xpEventsTable.actionKey,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(xpEventsTable)
      .where(
        and(
          eq(xpEventsTable.teacherId, teacherId),
          eq(xpEventsTable.seasonId, activeSeason.id),
          sql`${xpEventsTable.delta} > 0`,
        ),
      )
      .groupBy(xpEventsTable.actionKey);

    for (const row of seasonActionCounts) {
      lookup[`count_action:${row.actionKey}:season`] = row.count;
    }

    // seasonal_rank: how many teachers have MORE season XP than this teacher.
    // teacher_stats is one row per teacher (no season_id column); seasonXp
    // is reset/snapshotted at season boundaries by the season-close job.
    const [rankRow] = await db
      .select({ rank: sql<number>`COUNT(*)::int` })
      .from(teacherStatsTable)
      .where(sql`${teacherStatsTable.seasonXp} > ${statsRow.seasonXp}`);
    lookup["seasonal_rank"] = (rankRow?.rank ?? 0) + 1;
  }

  return lookup;
}

async function evaluateAndAwardBadges(teacherId: number): Promise<string[]> {
  const [stats] = await db
    .select()
    .from(teacherStatsTable)
    .where(eq(teacherStatsTable.teacherId, teacherId))
    .limit(1);
  if (!stats) return [];

  const [activeSeason] = await db
    .select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(
      and(
        sql`${seasonsTable.startsAt} <= NOW()`,
        sql`${seasonsTable.endsAt} > NOW()`,
      ),
    )
    .limit(1);

  const all = await db
    .select()
    .from(badgesTable)
    .where(eq(badgesTable.isActive, true));
  const earned = await db
    .select({ badgeId: teacherBadgesTable.badgeId, key: badgesTable.key })
    .from(teacherBadgesTable)
    .innerJoin(badgesTable, eq(teacherBadgesTable.badgeId, badgesTable.id))
    .where(eq(teacherBadgesTable.teacherId, teacherId));
  const earnedSet = new Set(earned.map((r) => r.badgeId));

  const lookup = await buildStatLookup(
    teacherId,
    stats,
    earned,
    activeSeason ?? null,
  );

  const newKeys: string[] = [];
  for (const badge of all) {
    if (earnedSet.has(badge.id)) continue;
    if (!evaluateRule(badge.unlockRule, lookup)) continue;
    const inserted = await db
      .insert(teacherBadgesTable)
      .values({ teacherId, badgeId: badge.id })
      .onConflictDoNothing({
        target: [teacherBadgesTable.teacherId, teacherBadgesTable.badgeId],
      })
      .returning({ id: teacherBadgesTable.id });
    if (inserted.length === 0) continue;
    newKeys.push(badge.key);

    // Apply functional unlock if specified
    const fn = badge.functionalUnlock;
    if (fn && typeof fn === "object") {
      await applyFeaturePayload(teacherId, fn as Record<string, unknown>);
    }

    // Queue email + in-app notification
    await queueBadgeEmail(teacherId, badge.id, badge.nameAr);
    void notifyBadgeEarned(teacherId, badge.id, badge.nameAr, badge.icon ?? "🏅").catch(
      (err) => logger.error({ err, teacherId, badgeId: badge.id }, "notifyBadgeEarned failed"),
    );
  }

  if (newKeys.length > 0) {
    await db
      .update(teacherStatsTable)
      .set({ badgeCount: sql`${teacherStatsTable.badgeCount} + ${newKeys.length}` })
      .where(eq(teacherStatsTable.teacherId, teacherId));
  }
  return newKeys;
}

/* ------------------------------------------------------------------------ */
/* Threshold rewards                                                        */
/* ------------------------------------------------------------------------ */

async function evaluateAndGrantThresholdRewards(
  teacherId: number,
): Promise<number[]> {
  const [stats] = await db
    .select()
    .from(teacherStatsTable)
    .where(eq(teacherStatsTable.teacherId, teacherId))
    .limit(1);
  if (!stats) return [];

  const value = (m: string): number => {
    switch (m) {
      case "level":
        return stats.level;
      case "totalXp":
        return stats.totalXp;
      case "badgeCount":
        return stats.badgeCount;
      case "questsCompleted":
        return stats.questsCompleted;
      case "streak":
        return stats.longestStreakDays;
      default:
        return 0;
    }
  };

  const rewards = await db
    .select()
    .from(thresholdRewardsTable)
    .where(eq(thresholdRewardsTable.isActive, true));

  const granted = await db
    .select({ rewardId: thresholdRewardGrantsTable.rewardId })
    .from(thresholdRewardGrantsTable)
    .where(eq(thresholdRewardGrantsTable.teacherId, teacherId));
  const grantedSet = new Set(granted.map((r) => r.rewardId));

  const newGrants: number[] = [];
  for (const r of rewards) {
    if (grantedSet.has(r.id)) continue;
    if (value(r.metric) < r.threshold) continue;

    const inserted = await db
      .insert(thresholdRewardGrantsTable)
      .values({
        teacherId,
        rewardId: r.id,
        autoApplied: r.autoApply,
      })
      .onConflictDoNothing({
        target: [
          thresholdRewardGrantsTable.teacherId,
          thresholdRewardGrantsTable.rewardId,
        ],
      })
      .returning({ id: thresholdRewardGrantsTable.id });
    if (inserted.length === 0) continue;
    newGrants.push(r.id);

    // Auto-apply payload if requested + payload makes sense
    if (r.autoApply && r.prizePayload) {
      await applyFeaturePayload(
        teacherId,
        r.prizePayload as Record<string, unknown>,
      );
    }

    // Shipped/manual prizes go to fulfillment queue
    if (r.prizeKind === "shipped_item") {
      await db.insert(fulfillmentQueueTable).values({
        teacherId,
        source: "threshold",
        sourceId: r.id,
        prizeLabel: r.prizeLabelAr,
        prizeDescription: r.prizeDescriptionAr ?? null,
      });
    }

    await queueThresholdEmail(teacherId, r.id, r.prizeLabelAr);
  }
  return newGrants;
}

/** Whitelist of teacher columns a feature unlock may flip on. */
const ALLOWED_FEATURE_FIELDS = new Set([
  "presentationsProEnabled",
  "hasProDesign",
  "aiTier",
]);

async function applyFeaturePayload(
  teacherId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const feature = payload.feature;
  const value = payload.value;
  if (typeof feature !== "string" || !ALLOWED_FEATURE_FIELDS.has(feature)) {
    return;
  }
  // Only allow boolean toggles or string aiTier values
  const update: Record<string, unknown> = {};
  if (feature === "aiTier" && typeof value === "string") {
    if (!["standard", "pro", "claude"].includes(value)) return;
    update.aiTier = value;
  } else if (typeof value === "boolean") {
    update[feature] = value;
  } else {
    return;
  }
  await db.update(teachersTable).set(update).where(eq(teachersTable.id, teacherId));
}

/* ------------------------------------------------------------------------ */
/* Quests                                                                   */
/* ------------------------------------------------------------------------ */

async function progressQuestsForAction(
  teacherId: number,
  actionKey: string,
): Promise<void> {
  const now = new Date();
  const active = await db
    .select()
    .from(questsTable)
    .where(eq(questsTable.isActive, true));

  for (const q of active) {
    if (q.startsAt > now || q.endsAt < now) continue;
    if (q.progressRule.actionKey !== actionKey) continue;

    // Upsert progress row
    const [row] = await db
      .insert(questProgressTable)
      .values({ teacherId, questId: q.id, progress: 1 })
      .onConflictDoUpdate({
        target: [questProgressTable.teacherId, questProgressTable.questId],
        set: { progress: sql`${questProgressTable.progress} + 1`, updatedAt: new Date() },
      })
      .returning();

    if (row && row.progress >= q.progressRule.count && !row.completedAt) {
      await db
        .update(questProgressTable)
        .set({ completedAt: new Date() })
        .where(eq(questProgressTable.id, row.id));
      // Award reward XP (idempotent via questId ref)
      const out = await awardXp({
        teacherId,
        actionKey: "quest.complete",
        refId: `quest:${q.id}`,
        pointsOverride: q.rewardXp,
        reason: `quest:${q.key}`,
      });
      if (out.awarded) {
        await db
          .update(questProgressTable)
          .set({ rewardedAt: new Date() })
          .where(eq(questProgressTable.id, row.id));
        await db
          .update(teacherStatsTable)
          .set({ questsCompleted: sql`${teacherStatsTable.questsCompleted} + 1` })
          .where(eq(teacherStatsTable.teacherId, teacherId));
        // In-app notification + email (fire-and-forget — quest XP already committed)
        void notifyQuestComplete(teacherId, q.id, q.titleAr, q.rewardXp).catch((err) =>
          logger.error({ err, teacherId, questId: q.id }, "notifyQuestComplete failed"),
        );
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Email outbox helpers                                                     */
/* ------------------------------------------------------------------------ */

async function queueBadgeEmail(
  teacherId: number,
  badgeId: number,
  badgeName: string,
): Promise<void> {
  const [t] = await db
    .select({ email: teachersTable.email, name: teachersTable.name })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!t?.email) return;
  await db
    .insert(emailOutboxTable)
    .values({
      toEmail: t.email,
      subject: `🏅 ${badgeName} — شارة جديدة في حصاد`,
      htmlBody: `<div dir="rtl"><p>مرحباً ${escHtml(t.name)}،</p><p>تهانينا! حصلت على شارة <strong>${escHtml(badgeName)}</strong> على منصة حصاد.</p></div>`,
      textBody: `تهانينا ${t.name}! حصلت على شارة ${badgeName}.`,
      kind: "badge_awarded",
      refKey: `${teacherId}:${badgeId}`,
    })
    .onConflictDoNothing({
      target: [emailOutboxTable.kind, emailOutboxTable.refKey],
    });
  notifyEmailQueued();
}

async function queueThresholdEmail(
  teacherId: number,
  rewardId: number,
  label: string,
): Promise<void> {
  const [t] = await db
    .select({ email: teachersTable.email, name: teachersTable.name })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!t?.email) return;
  await db
    .insert(emailOutboxTable)
    .values({
      toEmail: t.email,
      subject: `🎁 جائزة جديدة في حصاد: ${label}`,
      htmlBody: `<div dir="rtl"><p>مرحباً ${escHtml(t.name)}،</p><p>تهانينا! بلغت أحد العتبات في حصاد وفُتحت لك جائزة: <strong>${escHtml(label)}</strong>.</p></div>`,
      textBody: `تهانينا ${t.name}! جائزة جديدة: ${label}.`,
      kind: "threshold_granted",
      refKey: `${teacherId}:${rewardId}`,
    })
    .onConflictDoNothing({
      target: [emailOutboxTable.kind, emailOutboxTable.refKey],
    });
  notifyEmailQueued();
}

/**
 * Write in-app notification + email for a level-up milestone.
 * Idempotent: ref_key on email_outbox prevents duplicate emails.
 */
async function notifyLevelUp(
  teacherId: number,
  newLevel: number,
  levelNameAr: string,
): Promise<void> {
  const [t] = await db
    .select({ email: teachersTable.email, name: teachersTable.name })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!t) return;

  // In-app notification
  await db
    .insert(notificationsTable)
    .values({
      teacherId,
      type: "level_up",
      title: `ترقّيت إلى المستوى ${newLevel}!`,
      body: `مبروك! أصبحت الآن "${levelNameAr}". استمر لتفتح مزايا جديدة.`,
      isRead: false,
    })
    .onConflictDoNothing();

  // Email (outbox pattern — no inline SMTP)
  if (t.email) {
    await db
      .insert(emailOutboxTable)
      .values({
        toEmail: t.email,
        subject: `🎉 ترقّيت إلى مستوى ${levelNameAr} في حصاد`,
        htmlBody: `<div dir="rtl"><p>مرحباً ${escHtml(t.name)}،</p><p>تهانينا! لقد ترقّيت إلى المستوى <strong>${newLevel} — ${escHtml(levelNameAr)}</strong> في منصة حصاد.</p><p>افتح منصة حصاد لاكتشاف المزايا الجديدة.</p></div>`,
        textBody: `مرحباً ${t.name}، ترقّيت إلى المستوى ${newLevel} — ${levelNameAr}.`,
        kind: "level_up",
        refKey: `${teacherId}:level:${newLevel}`,
      })
      .onConflictDoNothing({
        target: [emailOutboxTable.kind, emailOutboxTable.refKey],
      });
    notifyEmailQueued();
  }
}

/**
 * Write in-app notification + email for badge earning.
 * Called alongside queueBadgeEmail so both channels fire.
 */
async function notifyBadgeEarned(
  teacherId: number,
  badgeId: number,
  badgeNameAr: string,
  badgeIcon: string,
): Promise<void> {
  await db
    .insert(notificationsTable)
    .values({
      teacherId,
      type: "badge_earned",
      title: `${badgeIcon} حصلت على شارة: ${badgeNameAr}`,
      body: `تهانينا! أنجزت معياراً جديداً وحصلت على شارة "${badgeNameAr}".`,
      isRead: false,
    })
    .onConflictDoNothing();
  // Email queued separately by queueBadgeEmail — no duplication needed here.
  void badgeId; // referenced to avoid unused-var lint warning
}

/**
 * Write in-app notification + email for a quest completion.
 */
async function notifyQuestComplete(
  teacherId: number,
  questId: number,
  questNameAr: string,
  rewardXp: number,
): Promise<void> {
  const [t] = await db
    .select({ email: teachersTable.email, name: teachersTable.name })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!t) return;

  // In-app notification
  await db
    .insert(notificationsTable)
    .values({
      teacherId,
      type: "quest_complete",
      title: `✅ أكملت مهمة: ${questNameAr}`,
      body: `أحسنت! حصلت على ${rewardXp} نقطة مكافأة على إتمام المهمة.`,
      isRead: false,
    })
    .onConflictDoNothing();

  // Email outbox
  if (t.email) {
    await db
      .insert(emailOutboxTable)
      .values({
        toEmail: t.email,
        subject: `✅ أكملت مهمة أسبوعية في حصاد: ${questNameAr}`,
        htmlBody: `<div dir="rtl"><p>مرحباً ${escHtml(t.name)}،</p><p>أكملت المهمة <strong>${escHtml(questNameAr)}</strong> وحصلت على <strong>${rewardXp} نقطة</strong> مكافأة.</p></div>`,
        textBody: `${t.name}، أكملت مهمة "${questNameAr}" وحصلت على ${rewardXp} نقطة.`,
        kind: "quest_complete",
        refKey: `${teacherId}:quest:${questId}`,
      })
      .onConflictDoNothing({
        target: [emailOutboxTable.kind, emailOutboxTable.refKey],
      });
    notifyEmailQueued();
  }
}

/* ------------------------------------------------------------------------ */
/* Manual admin adjustment                                                  */
/* ------------------------------------------------------------------------ */

export async function applyAdminAdjustment(args: {
  teacherId: number;
  adminId: number;
  delta: number;
  reason: string;
}): Promise<{ ok: boolean; newTotal?: number }> {
  if (!Number.isInteger(args.delta) || args.delta === 0) return { ok: false };
  const seasonId = await findActiveSeasonId();
  return await db.transaction(async (tx) => {
    const [evt] = await tx
      .insert(xpEventsTable)
      .values({
        teacherId: args.teacherId,
        actionKey: "admin.adjustment",
        refId: `adj:${Date.now()}:${args.adminId}:${Math.random().toString(36).slice(2, 8)}`,
        delta: args.delta,
        reason: args.reason,
        seasonId: seasonId ?? undefined,
      })
      .returning({ id: xpEventsTable.id });
    const [existing] = await tx
      .select()
      .from(teacherStatsTable)
      .where(eq(teacherStatsTable.teacherId, args.teacherId))
      .limit(1);
    // Append-only ledger: aggregate must match SUM(delta), so we do NOT
    // clamp to zero. If a deduction would take totals negative, reject the
    // adjustment and roll back the inserted ledger row to keep the invariant
    // sum(xp_events.delta) == teacher_stats.total_xp intact.
    const oldTotal = existing?.totalXp ?? 0;
    const newTotal = oldTotal + args.delta;
    const newSeasonXp =
      (existing?.seasonXp ?? 0) + (seasonId ? args.delta : 0);
    if (newTotal < 0 || newSeasonXp < 0) {
      throw new Error("adjustment_would_make_total_negative");
    }
    const newLevel = levelForXp(newTotal).level;
    if (existing) {
      await tx
        .update(teacherStatsTable)
        .set({
          totalXp: newTotal,
          seasonXp: newSeasonXp,
          level: newLevel,
          updatedAt: new Date(),
        })
        .where(eq(teacherStatsTable.teacherId, args.teacherId));
    } else {
      await tx.insert(teacherStatsTable).values({
        teacherId: args.teacherId,
        totalXp: newTotal,
        seasonXp: newSeasonXp,
        level: newLevel,
      });
    }
    await tx.insert(xpAdjustmentsTable).values({
      teacherId: args.teacherId,
      delta: args.delta,
      reason: args.reason,
      adminId: args.adminId,
      xpEventId: evt?.id ?? null,
    });
    return { ok: true, newTotal };
  });
}
