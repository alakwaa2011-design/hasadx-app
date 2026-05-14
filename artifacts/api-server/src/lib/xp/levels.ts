/**
 * 6-level progression with Arabic titles. Each level has a totalXp threshold;
 * level is computed as the highest level whose threshold ≤ totalXp.
 */
export interface Level {
  level: number;
  nameAr: string;
  minXp: number;
}

// Titles aligned with the Hasad rewards catalog (task #605 plan).
export const LEVELS: readonly Level[] = [
  { level: 1, nameAr: "معلّم مبتدئ", minXp: 0 },
  { level: 2, nameAr: "معلّم نشط", minXp: 250 },
  { level: 3, nameAr: "معلّم ملهم", minXp: 750 },
  { level: 4, nameAr: "خبير حصاد", minXp: 2000 },
  { level: 5, nameAr: "سفير حصاد", minXp: 5000 },
  { level: 6, nameAr: "أسطورة حصاد", minXp: 12000 },
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
