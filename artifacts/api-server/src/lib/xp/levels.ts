/**
 * 6-level progression with Arabic titles. Each level has a totalXp threshold;
 * level is computed as the highest level whose threshold ≤ totalXp.
 */
export interface Level {
  level: number;
  nameAr: string;
  minXp: number;
}

export const LEVELS: readonly Level[] = [
  { level: 1, nameAr: "مبتدئ", minXp: 0 },
  { level: 2, nameAr: "ناشئ", minXp: 250 },
  { level: 3, nameAr: "متمرّس", minXp: 750 },
  { level: 4, nameAr: "خبير", minXp: 2000 },
  { level: 5, nameAr: "بطل", minXp: 5000 },
  { level: 6, nameAr: "أسطورة", minXp: 12000 },
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
