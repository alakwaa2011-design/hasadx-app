/**
 * Idempotent seeders for XP rules / badges / threshold rewards / initial
 * season. Runs at server startup; safe to call repeatedly.
 */
import {
  db,
  xpRulesTable,
  badgesTable,
  thresholdRewardsTable,
  seasonsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import {
  DEFAULT_XP_RULES,
  DEFAULT_BADGES,
  DEFAULT_THRESHOLD_REWARDS,
} from "./defaults";

export async function seedXpDefaultsIfNeeded(): Promise<void> {
  try {
    // Rules
    for (const r of DEFAULT_XP_RULES) {
      await db
        .insert(xpRulesTable)
        .values({
          actionKey: r.actionKey,
          labelAr: r.labelAr,
          points: r.points,
          dailyCap: r.dailyCap ?? null,
          weeklyCap: r.weeklyCap ?? null,
        })
        .onConflictDoNothing({ target: xpRulesTable.actionKey });
    }
    // Also ensure quest.complete rule exists (used by engine internally)
    await db
      .insert(xpRulesTable)
      .values({
        actionKey: "quest.complete",
        labelAr: "إكمال مهمة أسبوعية",
        points: 50,
      })
      .onConflictDoNothing({ target: xpRulesTable.actionKey });

    // Badges
    for (const b of DEFAULT_BADGES) {
      await db
        .insert(badgesTable)
        .values({
          key: b.key,
          nameAr: b.nameAr,
          descriptionAr: b.descriptionAr,
          icon: b.icon,
          tier: b.tier,
          unlockRule: b.unlockRule,
          functionalUnlock: b.functionalUnlock ?? null,
          sortOrder: b.sortOrder,
        })
        .onConflictDoNothing({ target: badgesTable.key });
    }

    // Threshold rewards — only seed if table empty so admin edits aren't undone.
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(thresholdRewardsTable);
    if ((cnt ?? 0) === 0) {
      for (const r of DEFAULT_THRESHOLD_REWARDS) {
        await db.insert(thresholdRewardsTable).values({
          nameAr: r.nameAr,
          metric: r.metric,
          threshold: r.threshold,
          prizeKind: r.prizeKind,
          prizeLabelAr: r.prizeLabelAr,
          prizeDescriptionAr: r.prizeDescriptionAr ?? null,
          prizePayload: r.prizePayload ?? null,
          autoApply: r.autoApply,
        });
      }
    }

    // Active season — create one if none exists
    const [activeSeason] = await db
      .select({ id: seasonsTable.id })
      .from(seasonsTable)
      .where(eq(seasonsTable.status, "active"))
      .limit(1);
    if (!activeSeason) {
      const now = new Date();
      const ends = new Date(now.getTime() + 90 * 86_400_000);
      await db.insert(seasonsTable).values({
        nameAr: "الموسم الأول",
        startsAt: now,
        endsAt: ends,
        status: "active",
        prizesConfig: {
          ranks: [
            { label: "🥇 المركز الأول", description: "كأس حصاد + جائزة كبرى" },
            { label: "🥈 المركز الثاني", description: "ميدالية فضية + هدية" },
            { label: "🥉 المركز الثالث", description: "ميدالية برونزية + هدية" },
          ],
          tiers: [
            { minXp: 1000, label: "💎 شارة المشاركة المميزة" },
          ],
        },
      });
    }
  } catch (err) {
    logger.error({ err }, "seedXpDefaults failed");
  }
}
