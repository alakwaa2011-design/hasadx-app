/**
 * 6-level progression with Arabic titles.
 * Thresholds from task #605 plan (non-negotiable):
 * 0 → 500 → 2000 → 6000 → 15000 → 35000 → 75000 XP
 */
export interface Level {
  level: number;
  nameAr: string;
  minXp: number;
}

export const LEVELS: readonly Level[] = [
  { level: 1, nameAr: "معلّم مبتدئ", minXp: 0 },
  { level: 2, nameAr: "معلّم نشط", minXp: 500 },
  { level: 3, nameAr: "معلّم ملهم", minXp: 2000 },
  { level: 4, nameAr: "خبير حصاد", minXp: 6000 },
  { level: 5, nameAr: "سفير حصاد", minXp: 15000 },
  { level: 6, nameAr: "أسطورة حصاد", minXp: 35000 },
];

export function levelForXp(totalXp: number): Level {
  let result = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.minXp) result = l;
    else break;
  }
  return result;
}

export function nextLevelTarget(
  totalXp: number,
): { current: Level; next: Level | null; toGo: number } {
  const current = levelForXp(totalXp);
  const next = LEVELS.find((l) => l.minXp > current.minXp) ?? null;
  const toGo = next ? Math.max(0, next.minXp - totalXp) : 0;
  return { current, next, toGo };
}
