import { and, eq, sql } from "drizzle-orm";
import {
  db,
  plansTable,
  subscriptionsTable,
  subscriptionUsageTable,
  teachersTable,
  studentsTable,
  teacherClassesTable,
  aiUsageDaily,
} from "@workspace/db";
import { TtlCache } from "./cache";
import type { Feature, FeatureAccessResult, SubscriptionView } from "./types";

/**
 * Singleton feature-access service. Centralised gating + atomic usage tracking.
 *
 * Design contract:
 * - `check(teacherId, feature, opts?)` is read-only. It tells you if the
 *   action is allowed and how much budget is left.
 * - `increment(teacherId, feature)` is the write half. It returns
 *   `{ allowed, ... }` after attempting an atomic increment. On race
 *   conditions where the DB row was at the limit, `allowed` will be false
 *   and nothing was incremented.
 * - When PAYMENTS_ENABLED is false we still record usage but return
 *   `allowed: true` so the data is ready when billing is flipped on.
 * - Admins always bypass.
 * - NULL on any plan limit means unlimited.
 */

const CACHE_TTL_MS = 60_000;

type CachedSubscription = SubscriptionView & { isAdmin: boolean };

class FeatureAccessService {
  private subscriptionCache = new TtlCache<number, CachedSubscription>(CACHE_TTL_MS);

  private get paymentsEnabled(): boolean {
    return process.env.PAYMENTS_ENABLED === "true";
  }

  private currentMonth(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Public: invalidate cache when a subscription is changed. */
  invalidate(teacherId: number): void {
    this.subscriptionCache.delete(teacherId);
  }

  /** Public: invalidate everyone (e.g. when a plan's limits change). */
  invalidateAll(): void {
    this.subscriptionCache.clear();
  }

  /**
   * Returns the teacher's current plan + subscription view. Auto-creates a
   * Free subscription if none exists.
   */
  async getSubscription(teacherId: number): Promise<CachedSubscription> {
    const cached = this.subscriptionCache.get(teacherId);
    if (cached) return cached;

    const view = await this.loadSubscription(teacherId);
    this.subscriptionCache.set(teacherId, view);
    return view;
  }

  private async loadSubscription(teacherId: number): Promise<CachedSubscription> {
    const [teacher] = await db
      .select({ id: teachersTable.id, isAdmin: teachersTable.isAdmin })
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .limit(1);
    if (!teacher) throw new Error(`teacher ${teacherId} not found`);

    let row = await this.fetchSubscriptionRow(teacherId);
    if (!row) {
      await this.ensureFreeSubscription(teacherId);
      row = await this.fetchSubscriptionRow(teacherId);
      if (!row) throw new Error(`failed to provision subscription for teacher ${teacherId}`);
    }

    return {
      subscriptionId: row.subscriptionId,
      planId: row.planId,
      planCode: row.planCode,
      planNameAr: row.planNameAr,
      planNameEn: row.planNameEn,
      priceMinor: row.priceMinor,
      currency: row.currency,
      status: row.status,
      expiresAt: row.expiresAt,
      limits: {
        maxStudents: row.maxStudents,
        maxClasses: row.maxClasses,
        maxHomeworksPerMonth: row.maxHomeworksPerMonth,
        aiUsageDailyLimit: row.aiUsageDailyLimit,
        maxUsers: row.maxUsers,
      },
      isAdmin: !!teacher.isAdmin,
    };
  }

  private async fetchSubscriptionRow(teacherId: number) {
    const rows = await db
      .select({
        subscriptionId: subscriptionsTable.id,
        planId: plansTable.id,
        planCode: plansTable.code,
        planNameAr: plansTable.nameAr,
        planNameEn: plansTable.nameEn,
        priceMinor: plansTable.priceMinor,
        currency: plansTable.currency,
        status: subscriptionsTable.status,
        expiresAt: subscriptionsTable.expiresAt,
        maxStudents: plansTable.maxStudents,
        maxClasses: plansTable.maxClasses,
        maxHomeworksPerMonth: plansTable.maxHomeworksPerMonth,
        aiUsageDailyLimit: plansTable.aiUsageDailyLimit,
        maxUsers: plansTable.maxUsers,
      })
      .from(subscriptionsTable)
      .innerJoin(plansTable, eq(plansTable.id, subscriptionsTable.planId))
      .where(eq(subscriptionsTable.teacherId, teacherId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Idempotently subscribe a teacher to the Free plan. */
  async ensureFreeSubscription(teacherId: number): Promise<void> {
    await db.execute(sql`
      INSERT INTO subscriptions (teacher_id, plan_id, status, started_at, created_at, updated_at)
      SELECT ${teacherId}, p.id, 'active', NOW(), NOW(), NOW()
      FROM plans p
      WHERE p.code = 'free' AND p.is_active = true
      ON CONFLICT (teacher_id) DO NOTHING
    `);
    this.invalidate(teacherId);
  }

  /** Read-only check. Does not consume any quota. */
  async check(teacherId: number, feature: Feature): Promise<FeatureAccessResult> {
    const sub = await this.getSubscription(teacherId);
    if (sub.isAdmin) return unlimited();

    const { limit, used } = await this.measure(teacherId, feature, sub);
    return resultFor(limit, used, this.paymentsEnabled);
  }

  /**
   * Atomically increment usage for `feature`. When the limit is non-NULL the
   * increment is conditional and returns null when the limit would be
   * exceeded; in that case the caller is denied.
   *
   * Resource-style features (add_student, create_class) are not stored in
   * subscription_usage — they're counted from their own tables — so for those
   * we simply re-check after the caller has inserted the row. To keep the API
   * uniform, callers should:
   *   1) call increment() BEFORE inserting flow-style rows (homework, ai)
   *   2) call check() BEFORE inserting resource-style rows (student, class)
   * Both produce the same FeatureAccessResult shape.
   */
  async increment(teacherId: number, feature: Feature): Promise<FeatureAccessResult> {
    const sub = await this.getSubscription(teacherId);
    if (sub.isAdmin) return unlimited();

    // Flow counters live in subscription_usage. Resource counters are derived,
    // so we just delegate to check().
    if (feature === "create_homework") {
      return this.atomicMonthlyIncrement(teacherId, "homeworks_count", sub.limits.maxHomeworksPerMonth);
    }
    if (feature === "use_ai") {
      return this.atomicDailyAiIncrement(teacherId, sub.limits.aiUsageDailyLimit);
    }
    if (feature === "add_student") {
      // Atomic increment of monthly counter (informational); enforcement is on totals.
      await this.bumpMonthly(teacherId, "students_added_count");
      return this.check(teacherId, feature);
    }
    if (feature === "create_class") {
      await this.bumpMonthly(teacherId, "classes_created_count");
      return this.check(teacherId, feature);
    }
    return this.check(teacherId, feature);
  }

  private async measure(
    teacherId: number,
    feature: Feature,
    sub: CachedSubscription,
  ): Promise<{ limit: number | null; used: number }> {
    switch (feature) {
      case "create_homework": {
        const limit = sub.limits.maxHomeworksPerMonth;
        const period = this.currentMonth();
        const rows = await db
          .select({ c: subscriptionUsageTable.homeworksCount })
          .from(subscriptionUsageTable)
          .where(
            and(
              eq(subscriptionUsageTable.teacherId, teacherId),
              eq(subscriptionUsageTable.periodMonth, period),
            ),
          )
          .limit(1);
        return { limit, used: rows[0]?.c ?? 0 };
      }
      case "use_ai": {
        const limit = sub.limits.aiUsageDailyLimit;
        const day = this.todayUtc();
        const rows = await db
          .select({ c: aiUsageDaily.messageCount })
          .from(aiUsageDaily)
          .where(and(eq(aiUsageDaily.teacherId, teacherId), eq(aiUsageDaily.day, day)))
          .limit(1);
        return { limit, used: rows[0]?.c ?? 0 };
      }
      case "add_student": {
        const limit = sub.limits.maxStudents;
        const rows = await db
          .select({ c: sql<number>`COUNT(*)::int` })
          .from(studentsTable)
          .where(eq(studentsTable.teacherId, teacherId));
        return { limit, used: rows[0]?.c ?? 0 };
      }
      case "create_class": {
        const limit = sub.limits.maxClasses;
        const rows = await db
          .select({ c: sql<number>`COUNT(*)::int` })
          .from(teacherClassesTable)
          .where(eq(teacherClassesTable.teacherId, teacherId));
        return { limit, used: rows[0]?.c ?? 0 };
      }
      case "add_user": {
        // Future: count seats under a school account. For now treat as unlimited.
        return { limit: sub.limits.maxUsers, used: 0 };
      }
    }
  }

  /**
   * Atomically increments subscription_usage.homeworks_count. If `limit` is
   * non-null the UPDATE is gated by `< limit`, so the row count tells us if
   * the increment succeeded.
   */
  private async atomicMonthlyIncrement(
    teacherId: number,
    column: "homeworks_count",
    limit: number | null,
  ): Promise<FeatureAccessResult> {
    const period = this.currentMonth();
    const colSql = sql.raw(column);
    const result = limit === null
      ? await db.execute(sql`
          INSERT INTO subscription_usage (teacher_id, period_month, ${colSql}, created_at, updated_at)
          VALUES (${teacherId}, ${period}, 1, NOW(), NOW())
          ON CONFLICT (teacher_id, period_month) DO UPDATE
            SET ${colSql} = subscription_usage.${colSql} + 1, updated_at = NOW()
          RETURNING ${colSql} AS new_count
        `)
      : await db.execute(sql`
          INSERT INTO subscription_usage (teacher_id, period_month, ${colSql}, created_at, updated_at)
          VALUES (${teacherId}, ${period}, 1, NOW(), NOW())
          ON CONFLICT (teacher_id, period_month) DO UPDATE
            SET ${colSql} = subscription_usage.${colSql} + 1, updated_at = NOW()
            WHERE subscription_usage.${colSql} < ${limit}
          RETURNING ${colSql} AS new_count
        `);
    const rows = (result as any).rows ?? result;
    const newCount = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).new_count) : null;
    if (newCount === null || !Number.isFinite(newCount)) {
      // Race: limit reached. Compute current `used` for the response.
      const currentRows = await db
        .select({ c: subscriptionUsageTable.homeworksCount })
        .from(subscriptionUsageTable)
        .where(and(eq(subscriptionUsageTable.teacherId, teacherId), eq(subscriptionUsageTable.periodMonth, period)))
        .limit(1);
      return resultFor(limit, currentRows[0]?.c ?? limit ?? 0, this.paymentsEnabled, /*denied*/ true);
    }
    return resultFor(limit, newCount, this.paymentsEnabled);
  }

  private async atomicDailyAiIncrement(
    teacherId: number,
    limit: number | null,
  ): Promise<FeatureAccessResult> {
    const day = this.todayUtc();
    const result = limit === null
      ? await db.execute(sql`
          INSERT INTO ai_usage_daily (teacher_id, day, message_count, tokens_in, tokens_out, cost_micro_usd)
          VALUES (${teacherId}, ${day}, 1, 0, 0, 0)
          ON CONFLICT (teacher_id, day) DO UPDATE
            SET message_count = ai_usage_daily.message_count + 1
          RETURNING message_count AS new_count
        `)
      : await db.execute(sql`
          INSERT INTO ai_usage_daily (teacher_id, day, message_count, tokens_in, tokens_out, cost_micro_usd)
          VALUES (${teacherId}, ${day}, 1, 0, 0, 0)
          ON CONFLICT (teacher_id, day) DO UPDATE
            SET message_count = ai_usage_daily.message_count + 1
            WHERE ai_usage_daily.message_count < ${limit}
          RETURNING message_count AS new_count
        `);
    const rows = (result as any).rows ?? result;
    const newCount = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).new_count) : null;
    if (newCount === null || !Number.isFinite(newCount)) {
      const cur = await db
        .select({ c: aiUsageDaily.messageCount })
        .from(aiUsageDaily)
        .where(and(eq(aiUsageDaily.teacherId, teacherId), eq(aiUsageDaily.day, day)))
        .limit(1);
      return resultFor(limit, cur[0]?.c ?? limit ?? 0, this.paymentsEnabled, /*denied*/ true);
    }
    return resultFor(limit, newCount, this.paymentsEnabled);
  }

  /** Unconditional monthly counter bump (no limit check). */
  private async bumpMonthly(
    teacherId: number,
    column: "students_added_count" | "classes_created_count",
  ): Promise<void> {
    const period = this.currentMonth();
    const colSql = sql.raw(column);
    await db.execute(sql`
      INSERT INTO subscription_usage (teacher_id, period_month, ${colSql}, created_at, updated_at)
      VALUES (${teacherId}, ${period}, 1, NOW(), NOW())
      ON CONFLICT (teacher_id, period_month) DO UPDATE
        SET ${colSql} = subscription_usage.${colSql} + 1, updated_at = NOW()
    `);
  }

  /** Refund a previously incremented flow counter (e.g. AI call failed upstream). */
  async refund(teacherId: number, feature: Feature): Promise<void> {
    if (feature === "use_ai") {
      const day = this.todayUtc();
      await db.execute(sql`
        UPDATE ai_usage_daily
        SET message_count = GREATEST(message_count - 1, 0)
        WHERE teacher_id = ${teacherId} AND day = ${day}
      `);
    } else if (feature === "create_homework") {
      const period = this.currentMonth();
      await db.execute(sql`
        UPDATE subscription_usage
        SET homeworks_count = GREATEST(homeworks_count - 1, 0)
        WHERE teacher_id = ${teacherId} AND period_month = ${period}
      `);
    }
  }
}

function resultFor(
  limit: number | null,
  used: number,
  paymentsEnabled: boolean,
  forceDeny = false,
): FeatureAccessResult {
  if (limit === null) {
    return { allowed: true, remaining: null, limit: null, used, reason: null };
  }
  const remaining = Math.max(limit - used, 0);
  if (forceDeny || used >= limit) {
    return {
      allowed: !paymentsEnabled,
      remaining: 0,
      limit,
      used,
      reason: paymentsEnabled ? "limit_reached" : null,
    };
  }
  return { allowed: true, remaining, limit, used, reason: null };
}

function unlimited(): FeatureAccessResult {
  return { allowed: true, remaining: null, limit: null, used: 0, reason: null };
}

export const featureAccess: FeatureAccessService = new FeatureAccessService();
export type { FeatureAccessService };
