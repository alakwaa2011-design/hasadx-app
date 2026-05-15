import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  teachersTable,
  teacherStatsTable,
  badgesTable,
  teacherBadgesTable,
  questsTable,
  questProgressTable,
  xpEventsTable,
  xpRulesTable,
  thresholdRewardsTable,
  thresholdRewardGrantsTable,
  fulfillmentQueueTable,
  xpAdjustmentsTable,
  seasonsTable,
  seasonResultsTable,
  emailOutboxTable,
  teacherFollowersTable,
} from "@workspace/db";
import { and, desc, eq, sql, inArray, isNull, gte } from "drizzle-orm";
import { z } from "zod";
import { applyAdminAdjustment } from "../lib/xp/engine";
import { LEVELS, levelForXp, nextLevelTarget } from "../lib/xp/levels";
import { evaluateRule } from "../lib/xp/rules-engine";

const router: IRouter = Router();

/* ──────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

async function requireTeacher(req: Request, res: Response): Promise<number | null> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return null;
  }
  return req.session.teacherId;
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [t] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!t?.isAdmin) {
    res.status(403).json({ message: "غير مصرح" });
    return false;
  }
  return true;
}

interface LeaderboardRow {
  rank: number;
  teacherId: number;
  displayName: string;
  avatarInitials: string;
  city: string | null;
  school: string | null;
  level: number;
  levelTitle: string;
  seasonXp: number;
  badgeCount: number;
}

interface CachedLeaderboard {
  rows: LeaderboardRow[];
  expiresAt: number;
  seasonId: number | null;
}
let leaderboardCache: CachedLeaderboard | null = null;
const LEADERBOARD_TTL_MS = 10 * 60 * 1000;

async function getActiveSeasonId(): Promise<number | null> {
  const [s] = await db
    .select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(eq(seasonsTable.status, "active"))
    .limit(1);
  return s?.id ?? null;
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Teacher-facing                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

router.get("/me/achievements", async (req, res) => {
  try {
    const teacherId = await requireTeacher(req, res);
    if (!teacherId) return;
    const [stats] = await db
      .select()
      .from(teacherStatsTable)
      .where(eq(teacherStatsTable.teacherId, teacherId))
      .limit(1);
    const totalXp = stats?.totalXp ?? 0;
    const lvl = nextLevelTarget(totalXp);

    const [allBadges, earned, grants, allRewards] = await Promise.all([
      db.select().from(badgesTable).where(eq(badgesTable.isActive, true)),
      db
        .select({
          badgeId: teacherBadgesTable.badgeId,
          awardedAt: teacherBadgesTable.awardedAt,
        })
        .from(teacherBadgesTable)
        .where(eq(teacherBadgesTable.teacherId, teacherId)),
      db
        .select()
        .from(thresholdRewardGrantsTable)
        .where(eq(thresholdRewardGrantsTable.teacherId, teacherId)),
      db
        .select()
        .from(thresholdRewardsTable)
        .where(eq(thresholdRewardsTable.isActive, true)),
    ]);

    const earnedMap = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));
    const lookup: Record<string, number> = {
      totalXp,
      seasonXp: stats?.seasonXp ?? 0,
      level: stats?.level ?? 1,
      currentStreakDays: stats?.currentStreakDays ?? 0,
      longestStreakDays: stats?.longestStreakDays ?? 0,
      badgeCount: stats?.badgeCount ?? 0,
      questsCompleted: stats?.questsCompleted ?? 0,
    };

    const grantedMap = new Map(grants.map((g) => [g.rewardId, g]));

    res.json({
      stats: {
        totalXp,
        seasonXp: stats?.seasonXp ?? 0,
        level: stats?.level ?? 1,
        levelNameAr: lvl.current.nameAr,
        nextLevelMinXp: lvl.next?.minXp ?? null,
        nextLevelNameAr: lvl.next?.nameAr ?? null,
        xpToNext: lvl.toGo,
        currentStreakDays: stats?.currentStreakDays ?? 0,
        longestStreakDays: stats?.longestStreakDays ?? 0,
        badgeCount: stats?.badgeCount ?? 0,
        questsCompleted: stats?.questsCompleted ?? 0,
      },
      levels: LEVELS,
      badges: allBadges
        .map((b) => ({
          id: b.id,
          key: b.key,
          nameAr: b.nameAr,
          descriptionAr: b.descriptionAr,
          icon: b.icon,
          tier: b.tier,
          earned: earnedMap.has(b.id),
          earnedAt: earnedMap.get(b.id) ?? null,
          isAchievable: evaluateRule(b.unlockRule, lookup),
          sortOrder: b.sortOrder,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      rewards: allRewards.map((r) => {
        const g = grantedMap.get(r.id);
        return {
          id: r.id,
          nameAr: r.nameAr,
          metric: r.metric,
          threshold: r.threshold,
          prizeKind: r.prizeKind,
          prizeLabelAr: r.prizeLabelAr,
          prizeDescriptionAr: r.prizeDescriptionAr,
          granted: !!g,
          autoApplied: g?.autoApplied ?? false,
          fulfilled: g?.fulfilled ?? false,
          progress: lookup[r.metric] ?? 0,
        };
      }),
    });
  } catch (err) {
    req.log.error(err, "GET /me/achievements failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/me/quests", async (req, res) => {
  try {
    const teacherId = await requireTeacher(req, res);
    if (!teacherId) return;
    const now = new Date();
    const quests = await db
      .select()
      .from(questsTable)
      .where(
        and(
          eq(questsTable.isActive, true),
          gte(questsTable.endsAt, now),
        ),
      );
    if (quests.length === 0) {
      res.json({ quests: [] });
      return;
    }
    const progress = await db
      .select()
      .from(questProgressTable)
      .where(
        and(
          eq(questProgressTable.teacherId, teacherId),
          inArray(
            questProgressTable.questId,
            quests.map((q) => q.id),
          ),
        ),
      );
    const pmap = new Map(progress.map((p) => [p.questId, p]));
    res.json({
      quests: quests.map((q) => {
        const p = pmap.get(q.id);
        return {
          id: q.id,
          key: q.key,
          titleAr: q.titleAr,
          descriptionAr: q.descriptionAr,
          target: q.progressRule.count,
          progress: p?.progress ?? 0,
          completed: !!p?.completedAt,
          rewardXp: q.rewardXp,
          startsAt: q.startsAt,
          endsAt: q.endsAt,
        };
      }),
    });
  } catch (err) {
    req.log.error(err, "GET /me/quests failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/me/xp-history", async (req, res) => {
  try {
    const teacherId = await requireTeacher(req, res);
    if (!teacherId) return;
    const rows = await db
      .select({
        id: xpEventsTable.id,
        actionKey: xpEventsTable.actionKey,
        delta: xpEventsTable.delta,
        reason: xpEventsTable.reason,
        createdAt: xpEventsTable.createdAt,
      })
      .from(xpEventsTable)
      .where(eq(xpEventsTable.teacherId, teacherId))
      .orderBy(desc(xpEventsTable.createdAt))
      .limit(50);
    res.json({ events: rows });
  } catch (err) {
    req.log.error(err, "GET /me/xp-history failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/me/privacy", async (req, res) => {
  try {
    const teacherId = await requireTeacher(req, res);
    if (!teacherId) return;
    const slugSchema = z
      .string()
      .min(3)
      .max(40)
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "صيغة المعرّف غير صالحة");
    const schema = z.object({
      publicProfileEnabled: z.boolean().optional(),
      showOnLeaderboard: z.boolean().optional(),
      displaySchool: z.string().max(120).nullable().optional(),
      profileSlug: slugSchema.nullable().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة",
      });
      return;
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.publicProfileEnabled !== undefined)
      update.publicProfileEnabled = parsed.data.publicProfileEnabled;
    if (parsed.data.showOnLeaderboard !== undefined)
      update.showOnLeaderboard = parsed.data.showOnLeaderboard;
    if (parsed.data.displaySchool !== undefined)
      update.displaySchool = parsed.data.displaySchool;
    if (parsed.data.profileSlug !== undefined)
      update.profileSlug = parsed.data.profileSlug;
    if (Object.keys(update).length === 0) {
      res.json({ ok: true });
      return;
    }
    // If slug is being set, ensure it isn't taken by someone else.
    if (parsed.data.profileSlug) {
      const [taken] = await db
        .select({ id: teachersTable.id })
        .from(teachersTable)
        .where(eq(teachersTable.profileSlug, parsed.data.profileSlug))
        .limit(1);
      if (taken && taken.id !== teacherId) {
        res.status(409).json({ message: "المعرّف مستخدم من قبل معلم آخر" });
        return;
      }
    }
    try {
      await db
        .update(teachersTable)
        .set(update)
        .where(eq(teachersTable.id, teacherId));
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        res.status(409).json({ message: "المعرّف مستخدم من قبل معلم آخر" });
        return;
      }
      throw err;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "PATCH /me/privacy failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Public leaderboard (cached)                                              */
/* ──────────────────────────────────────────────────────────────────────── */

router.get("/leaderboard", async (req, res) => {
  try {
    const seasonId = await getActiveSeasonId();
    const now = Date.now();
    if (
      leaderboardCache &&
      leaderboardCache.expiresAt > now &&
      leaderboardCache.seasonId === seasonId
    ) {
      res.json({ season: seasonId, rows: leaderboardCache.rows, cached: true });
      return;
    }
    const xpCol = seasonId ? teacherStatsTable.seasonXp : teacherStatsTable.totalXp;
    const rows = await db
      .select({
        teacherId: teachersTable.id,
        name: teachersTable.name,
        displaySchool: teachersTable.displaySchool,
        profileSlug: teachersTable.profileSlug,
        xp: xpCol,
        level: teacherStatsTable.level,
        badgeCount: teacherStatsTable.badgeCount,
      })
      .from(teacherStatsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, teacherStatsTable.teacherId))
      .where(
        and(
          eq(teachersTable.showOnLeaderboard, true),
          eq(teachersTable.isBlocked, false),
        ),
      )
      .orderBy(desc(xpCol))
      .limit(100);
    const withRank = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    leaderboardCache = {
      rows: withRank,
      expiresAt: now + LEADERBOARD_TTL_MS,
      seasonId,
    };
    res.json({ season: seasonId, rows: withRank, cached: false });
  } catch (err) {
    req.log.error(err, "GET /leaderboard failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/** Public profile by slug or numeric id. Mounted at both /profile/:idOrSlug
 *  and /t/:idOrSlug per the spec; the latter is the canonical short path
 *  shared on social. */
async function publicProfileHandler(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  try {
    const idOrSlug = String(req.params.idOrSlug ?? "");
    const isNumeric = /^\d+$/.test(idOrSlug);
    const [t] = await db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        displaySchool: teachersTable.displaySchool,
        profileSlug: teachersTable.profileSlug,
        publicProfileEnabled: teachersTable.publicProfileEnabled,
      })
      .from(teachersTable)
      .where(
        isNumeric
          ? eq(teachersTable.id, Number(idOrSlug))
          : eq(teachersTable.profileSlug, idOrSlug),
      )
      .limit(1);
    if (!t || !t.publicProfileEnabled) {
      res.status(404).json({ message: "الملف غير موجود أو غير عام" });
      return;
    }
    const viewerId: number | null =
      typeof req.session?.teacherId === "number"
        ? req.session.teacherId
        : null;
    const isOwner = viewerId !== null && viewerId === t.id;

    const [stats] = await db
      .select()
      .from(teacherStatsTable)
      .where(eq(teacherStatsTable.teacherId, t.id))
      .limit(1);
    const totalXp = stats?.totalXp ?? 0;
    const lvl = levelForXp(totalXp);
    const earned = await db
      .select({
        nameAr: badgesTable.nameAr,
        icon: badgesTable.icon,
        tier: badgesTable.tier,
        awardedAt: teacherBadgesTable.awardedAt,
      })
      .from(teacherBadgesTable)
      .innerJoin(badgesTable, eq(badgesTable.id, teacherBadgesTable.badgeId))
      .where(eq(teacherBadgesTable.teacherId, t.id))
      .orderBy(desc(teacherBadgesTable.awardedAt));

    const [{ count: followerCount }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teacherFollowersTable)
      .where(eq(teacherFollowersTable.teacherId, t.id));

    let isFollowing = false;
    if (viewerId !== null && !isOwner) {
      const [f] = await db
        .select({ id: teacherFollowersTable.id })
        .from(teacherFollowersTable)
        .where(
          and(
            eq(teacherFollowersTable.teacherId, t.id),
            eq(teacherFollowersTable.followerId, viewerId),
          ),
        )
        .limit(1);
      isFollowing = !!f;
    }

    let followers:
      | Array<{
          id: number;
          name: string;
          profileSlug: string | null;
          displaySchool: string | null;
          followedAt: Date;
        }>
      | undefined;
    if (isOwner) {
      followers = await db
        .select({
          id: teachersTable.id,
          name: teachersTable.name,
          profileSlug: teachersTable.profileSlug,
          displaySchool: teachersTable.displaySchool,
          followedAt: teacherFollowersTable.createdAt,
        })
        .from(teacherFollowersTable)
        .innerJoin(
          teachersTable,
          eq(teachersTable.id, teacherFollowersTable.followerId),
        )
        .where(eq(teacherFollowersTable.teacherId, t.id))
        .orderBy(desc(teacherFollowersTable.createdAt))
        .limit(100);
    }

    res.json({
      teacher: {
        id: t.id,
        name: t.name,
        displaySchool: t.displaySchool,
        profileSlug: t.profileSlug,
      },
      stats: {
        totalXp,
        level: stats?.level ?? 1,
        levelNameAr: lvl.nameAr,
        currentStreakDays: stats?.currentStreakDays ?? 0,
        longestStreakDays: stats?.longestStreakDays ?? 0,
        badgeCount: stats?.badgeCount ?? 0,
      },
      badges: earned,
      followerCount,
      isOwner,
      isFollowing,
      canFollow: viewerId !== null && !isOwner,
      ...(followers ? { followers } : {}),
    });
  } catch (err) {
    req.log.error(err, "GET /profile/:idOrSlug failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
}
router.get("/profile/:idOrSlug", publicProfileHandler);
router.get("/t/:idOrSlug", publicProfileHandler);

/** Resolve a profile id-or-slug to a teacher id, ensuring the profile is
 *  public. Used by the follow/unfollow endpoints. */
async function resolvePublicTeacherId(
  idOrSlug: string,
): Promise<number | null> {
  const isNumeric = /^\d+$/.test(idOrSlug);
  const [t] = await db
    .select({
      id: teachersTable.id,
      publicProfileEnabled: teachersTable.publicProfileEnabled,
    })
    .from(teachersTable)
    .where(
      isNumeric
        ? eq(teachersTable.id, Number(idOrSlug))
        : eq(teachersTable.profileSlug, idOrSlug),
    )
    .limit(1);
  if (!t || !t.publicProfileEnabled) return null;
  return t.id;
}

router.post("/profile/:idOrSlug/follow", async (req, res) => {
  try {
    const followerId = await requireTeacher(req, res);
    if (!followerId) return;
    const targetId = await resolvePublicTeacherId(String(req.params.idOrSlug ?? ""));
    if (!targetId) {
      res.status(404).json({ message: "الملف غير موجود أو غير عام" });
      return;
    }
    if (targetId === followerId) {
      res.status(400).json({ message: "لا يمكنك متابعة نفسك" });
      return;
    }
    await db
      .insert(teacherFollowersTable)
      .values({ teacherId: targetId, followerId })
      .onConflictDoNothing();
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teacherFollowersTable)
      .where(eq(teacherFollowersTable.teacherId, targetId));
    res.json({ ok: true, isFollowing: true, followerCount: count });
  } catch (err) {
    req.log.error(err, "POST /profile/:idOrSlug/follow failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/profile/:idOrSlug/follow", async (req, res) => {
  try {
    const followerId = await requireTeacher(req, res);
    if (!followerId) return;
    const targetId = await resolvePublicTeacherId(String(req.params.idOrSlug ?? ""));
    if (!targetId) {
      res.status(404).json({ message: "الملف غير موجود أو غير عام" });
      return;
    }
    if (targetId === followerId) {
      res.status(400).json({ message: "لا يمكنك إلغاء متابعة نفسك" });
      return;
    }
    await db
      .delete(teacherFollowersTable)
      .where(
        and(
          eq(teacherFollowersTable.teacherId, targetId),
          eq(teacherFollowersTable.followerId, followerId),
        ),
      );
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teacherFollowersTable)
      .where(eq(teacherFollowersTable.teacherId, targetId));
    res.json({ ok: true, isFollowing: false, followerCount: count });
  } catch (err) {
    req.log.error(err, "DELETE /profile/:idOrSlug/follow failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Admin console                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

/* XP rules CRUD */
router.get("/admin/xp-rules", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rules = await db.select().from(xpRulesTable).orderBy(xpRulesTable.actionKey);
    res.json(rules);
  } catch (err) {
    req.log.error(err, "GET /admin/xp-rules failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/xp-rules/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }
    const schema = z.object({
      points: z.number().int().min(-10000).max(10000).optional(),
      dailyCap: z.number().int().min(0).max(100000).nullable().optional(),
      weeklyCap: z.number().int().min(0).max(1000000).nullable().optional(),
      isActive: z.boolean().optional(),
      labelAr: z.string().min(1).max(120).optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    await db
      .update(xpRulesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(xpRulesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "PATCH /admin/xp-rules/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Badges CRUD */
router.get("/admin/badges", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const all = await db.select().from(badgesTable).orderBy(badgesTable.sortOrder);
    res.json(all);
  } catch (err) {
    req.log.error(err, "GET /admin/badges failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/badges", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      key: z.string().min(1).max(40),
      nameAr: z.string().min(1).max(80),
      descriptionAr: z.string().min(1).max(280),
      icon: z.string().min(1).max(20),
      tier: z.enum(["bronze", "silver", "gold", "legendary"]),
      unlockRule: z.record(z.string(), z.unknown()),
      functionalUnlock: z.record(z.string(), z.unknown()).nullable().optional(),
      sortOrder: z.number().int().min(0).max(10000).default(100),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    const [created] = await db
      .insert(badgesTable)
      .values({
        key: parsed.data.key,
        nameAr: parsed.data.nameAr,
        descriptionAr: parsed.data.descriptionAr,
        icon: parsed.data.icon,
        tier: parsed.data.tier,
        unlockRule: parsed.data.unlockRule,
        functionalUnlock: parsed.data.functionalUnlock ?? null,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "POST /admin/badges failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/badges/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }
    const schema = z.object({
      nameAr: z.string().min(1).max(80).optional(),
      descriptionAr: z.string().min(1).max(280).optional(),
      icon: z.string().min(1).max(20).optional(),
      tier: z.enum(["bronze", "silver", "gold", "legendary"]).optional(),
      unlockRule: z.record(z.string(), z.unknown()).optional(),
      functionalUnlock: z.record(z.string(), z.unknown()).nullable().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
      isActive: z.boolean().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    await db.update(badgesTable).set(parsed.data).where(eq(badgesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "PATCH /admin/badges/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/admin/badges/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    await db.delete(badgesTable).where(eq(badgesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "DELETE /admin/badges/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Threshold rewards (no-code Builder) */
router.get("/admin/threshold-rewards", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const all = await db
      .select()
      .from(thresholdRewardsTable)
      .orderBy(thresholdRewardsTable.metric, thresholdRewardsTable.threshold);
    res.json(all);
  } catch (err) {
    req.log.error(err, "GET /admin/threshold-rewards failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

const ThresholdRewardSchema = z.object({
  nameAr: z.string().min(1).max(120),
  metric: z.enum(["level", "totalXp", "badgeCount", "questsCompleted", "streak"]),
  threshold: z.number().int().min(1).max(1_000_000),
  prizeKind: z.enum(["feature_unlock", "shipped_item", "title", "perk"]),
  prizeLabelAr: z.string().min(1).max(120),
  prizeDescriptionAr: z.string().max(500).nullable().optional(),
  prizePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  autoApply: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).strict();

router.post("/admin/threshold-rewards", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const parsed = ThresholdRewardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة", errors: parsed.error.issues });
      return;
    }
    const [created] = await db
      .insert(thresholdRewardsTable)
      .values({
        nameAr: parsed.data.nameAr,
        metric: parsed.data.metric,
        threshold: parsed.data.threshold,
        prizeKind: parsed.data.prizeKind,
        prizeLabelAr: parsed.data.prizeLabelAr,
        prizeDescriptionAr: parsed.data.prizeDescriptionAr ?? null,
        prizePayload: parsed.data.prizePayload ?? null,
        autoApply: parsed.data.autoApply,
        isActive: parsed.data.isActive,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "POST /admin/threshold-rewards failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/threshold-rewards/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    const parsed = ThresholdRewardSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    await db.update(thresholdRewardsTable).set(parsed.data).where(eq(thresholdRewardsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "PATCH /admin/threshold-rewards/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/admin/threshold-rewards/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    await db.delete(thresholdRewardsTable).where(eq(thresholdRewardsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "DELETE /admin/threshold-rewards/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Manual XP adjustment */
router.post("/admin/xp-adjustments", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const adminId = req.session.teacherId as number;
    const schema = z.object({
      teacherId: z.number().int().positive(),
      delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0),
      reason: z.string().min(1).max(500),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    const result = await applyAdminAdjustment({
      teacherId: parsed.data.teacherId,
      adminId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
    });
    if (!result.ok) {
      res.status(400).json({ message: "تعذّر التطبيق" });
      return;
    }
    res.json({ ok: true, newTotalXp: result.newTotal });
  } catch (err) {
    req.log.error(err, "POST /admin/xp-adjustments failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/xp-adjustments", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await db
      .select({
        id: xpAdjustmentsTable.id,
        teacherId: xpAdjustmentsTable.teacherId,
        teacherName: teachersTable.name,
        delta: xpAdjustmentsTable.delta,
        reason: xpAdjustmentsTable.reason,
        adminId: xpAdjustmentsTable.adminId,
        createdAt: xpAdjustmentsTable.createdAt,
      })
      .from(xpAdjustmentsTable)
      .leftJoin(teachersTable, eq(teachersTable.id, xpAdjustmentsTable.teacherId))
      .orderBy(desc(xpAdjustmentsTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "GET /admin/xp-adjustments failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Fulfillment queue */
router.get("/admin/fulfillment-queue", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await db
      .select({
        id: fulfillmentQueueTable.id,
        teacherId: fulfillmentQueueTable.teacherId,
        teacherName: teachersTable.name,
        teacherEmail: teachersTable.email,
        source: fulfillmentQueueTable.source,
        prizeLabel: fulfillmentQueueTable.prizeLabel,
        prizeDescription: fulfillmentQueueTable.prizeDescription,
        status: fulfillmentQueueTable.status,
        notes: fulfillmentQueueTable.notes,
        trackingRef: fulfillmentQueueTable.trackingRef,
        createdAt: fulfillmentQueueTable.createdAt,
      })
      .from(fulfillmentQueueTable)
      .leftJoin(teachersTable, eq(teachersTable.id, fulfillmentQueueTable.teacherId))
      .orderBy(desc(fulfillmentQueueTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err, "GET /admin/fulfillment-queue failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/fulfillment-queue/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    const schema = z.object({
      status: z.enum(["pending", "in_progress", "delivered", "cancelled"]).optional(),
      notes: z.string().max(1000).nullable().optional(),
      trackingRef: z.string().max(200).nullable().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    await db
      .update(fulfillmentQueueTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(fulfillmentQueueTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "PATCH /admin/fulfillment-queue/:id failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Seasons */
router.get("/admin/seasons", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.startsAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err, "GET /admin/seasons failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/seasons", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const schema = z.object({
      nameAr: z.string().min(1).max(120),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      prizesConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    const [created] = await db
      .insert(seasonsTable)
      .values({
        nameAr: parsed.data.nameAr,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        prizesConfig: parsed.data.prizesConfig ?? null,
        status: "upcoming",
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "POST /admin/seasons failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/** Close active season — snapshot top-100 + reset season_xp + queue prizes. */
router.post("/admin/seasons/:id/close", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    const [season] = await db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.id, id))
      .limit(1);
    if (!season) {
      res.status(404).json({ message: "الموسم غير موجود" });
      return;
    }
    if (season.status === "closed") {
      res.status(400).json({ message: "الموسم مغلق بالفعل" });
      return;
    }

    const top = await db
      .select({
        teacherId: teacherStatsTable.teacherId,
        finalXp: teacherStatsTable.seasonXp,
      })
      .from(teacherStatsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, teacherStatsTable.teacherId))
      .where(eq(teachersTable.isBlocked, false))
      .orderBy(desc(teacherStatsTable.seasonXp))
      .limit(100);

    const ranks = season.prizesConfig?.ranks ?? [];
    const tiers = season.prizesConfig?.tiers ?? [];

    await db.transaction(async (tx) => {
      let r = 1;
      for (const row of top) {
        if (row.finalXp <= 0) break;
        let prizeLabel: string | null = null;
        if (r - 1 < ranks.length) prizeLabel = ranks[r - 1].label;
        else {
          const tier = tiers
            .filter((t) => row.finalXp >= t.minXp)
            .sort((a, b) => b.minXp - a.minXp)[0];
          if (tier) prizeLabel = tier.label;
        }
        await tx
          .insert(seasonResultsTable)
          .values({
            seasonId: id,
            teacherId: row.teacherId,
            rank: r,
            finalXp: row.finalXp,
            prizeLabel,
          })
          .onConflictDoNothing({
            target: [seasonResultsTable.seasonId, seasonResultsTable.teacherId],
          });
        if (prizeLabel) {
          await tx.insert(fulfillmentQueueTable).values({
            teacherId: row.teacherId,
            source: "season",
            sourceId: id,
            prizeLabel,
            prizeDescription: ranks[r - 1]?.description ?? null,
          });
        }
        r++;
      }
      await tx
        .update(seasonsTable)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(seasonsTable.id, id));
      // Reset season_xp on all teachers
      await tx.update(teacherStatsTable).set({ seasonXp: 0 });
    });

    leaderboardCache = null;
    res.json({ ok: true, ranked: top.length });
  } catch (err) {
    req.log.error(err, "POST /admin/seasons/:id/close failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/** Email outbox view + manual flush trigger (worker-lite). */
router.get("/admin/email-outbox", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const rows = await db
      .select()
      .from(emailOutboxTable)
      .orderBy(desc(emailOutboxTable.createdAt))
      .limit(200);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "GET /admin/email-outbox failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/season-results/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    const rows = await db
      .select({
        rank: seasonResultsTable.rank,
        teacherId: seasonResultsTable.teacherId,
        teacherName: teachersTable.name,
        finalXp: seasonResultsTable.finalXp,
        prizeLabel: seasonResultsTable.prizeLabel,
        fulfilled: seasonResultsTable.fulfilled,
      })
      .from(seasonResultsTable)
      .leftJoin(teachersTable, eq(teachersTable.id, seasonResultsTable.teacherId))
      .where(eq(seasonResultsTable.seasonId, id))
      .orderBy(seasonResultsTable.rank);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "GET /admin/season-results failed");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
