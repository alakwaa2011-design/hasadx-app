import { db, platformSettingsTable } from "@workspace/db";

let cached: { value: boolean; expiresAt: number } | null = null;
const TTL_MS = 15_000;

export function invalidateTeacherXpRewardsCache(): void {
  cached = null;
}

/** Platform-wide gate: when false, teachers do not earn XP / badges / quest XP. */
export async function isTeacherXpRewardsEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.value;
  try {
    const [row] = await db
      .select({ on: platformSettingsTable.teacherXpRewardsEnabled })
      .from(platformSettingsTable)
      .limit(1);
    const value = row?.on ?? true;
    cached = { value, expiresAt: now + TTL_MS };
    return value;
  } catch {
    return true;
  }
}
