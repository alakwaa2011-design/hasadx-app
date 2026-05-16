import { LEVELS, levelForXp, nextLevelTarget } from "./levels";

export interface AchievementStatsPayload {
  totalXp: number;
  seasonXp: number;
  level: number;
  levelNameAr: string;
  nextLevelMinXp: number | null;
  nextLevelNameAr: string | null;
  xpToNext: number;
  /** Admin-set display tier (1–7); null = follow XP. */
  displayLevelOverride: number | null;
  /** XP-derived tier — used for badge rule lookup only (API exposes separately). */
  derivedLevel: number;
  /** True when display tier is pinned by admin — hide ambiguous XP progress bar. */
  levelPinnedByAdmin: boolean;
  currentStreakDays: number;
  longestStreakDays: number;
  badgeCount: number;
  questsCompleted: number;
}

export function buildAchievementStatsPayload(params: {
  totalXp: number;
  seasonXp: number;
  currentStreakDays: number;
  longestStreakDays: number;
  badgeCount: number;
  questsCompleted: number;
  displayLevelOverride: number | null;
}): AchievementStatsPayload {
  const derivedLevel = levelForXp(params.totalXp).level;
  const xpProgress = nextLevelTarget(params.totalXp);
  const ov = params.displayLevelOverride;
  const useOverride =
    ov != null && Number.isInteger(ov) && ov >= 1 && ov <= LEVELS.length;
  const displayLevel = useOverride ? ov! : derivedLevel;
  const levelMeta = LEVELS[displayLevel - 1] ?? LEVELS[0];
  const levelNameAr = levelMeta.nameAr;

  let nextLevelMinXp: number | null;
  let nextLevelNameAr: string | null;
  let xpToNext: number;
  let levelPinnedByAdmin = false;

  if (useOverride) {
    levelPinnedByAdmin = true;
    nextLevelMinXp = null;
    nextLevelNameAr = null;
    xpToNext = 0;
  } else {
    nextLevelMinXp = xpProgress.next?.minXp ?? null;
    nextLevelNameAr = xpProgress.next?.nameAr ?? null;
    xpToNext = xpProgress.toGo;
  }

  return {
    totalXp: params.totalXp,
    seasonXp: params.seasonXp,
    level: displayLevel,
    levelNameAr,
    nextLevelMinXp,
    nextLevelNameAr,
    xpToNext,
    displayLevelOverride: useOverride ? ov : null,
    derivedLevel,
    levelPinnedByAdmin,
    currentStreakDays: params.currentStreakDays,
    longestStreakDays: params.longestStreakDays,
    badgeCount: params.badgeCount,
    questsCompleted: params.questsCompleted,
  };
}
