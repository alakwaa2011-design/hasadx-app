/** Browser- and server-safe source of truth for student avatar eligibility. */
export const kidsAvatarAgeBands = ["young", "middle", "secondary"] as const;
export type KidsAvatarAgeBand = typeof kidsAvatarAgeBands[number];

export const legacyKidsAvatarAgeBands = ["3-4", "4-5", "5-6"] as const;
export type LegacyKidsAvatarAgeBand = typeof legacyKidsAvatarAgeBands[number];
export type KidsAvatarAgeBandInput = KidsAvatarAgeBand | LegacyKidsAvatarAgeBand;

export const kidsAvatarAgeBandLabels: Record<KidsAvatarAgeBand, string> = {
  young: "الصغار",
  middle: "المتوسطة",
  secondary: "الثانوية",
};

export const kidsAvatarKeysByAgeBand = {
  young: ["kids/avatars/star", "kids/avatars/moon", "kids/avatars/rainbow"],
  middle: ["icon:rocket", "icon:gamepad", "icon:compass"],
  secondary: ["icon:target", "icon:trophy", "icon:award"],
} as const;

export const defaultKidsAvatarByAgeBand: Record<KidsAvatarAgeBand, string> = {
  young: "kids/avatars/star",
  middle: "icon:rocket",
  secondary: "icon:target",
};
export const defaultKidsAvatarAgeBand: KidsAvatarAgeBand = "young";

const legacyAgeBandMap: Record<LegacyKidsAvatarAgeBand, KidsAvatarAgeBand> = {
  "3-4": "young", "4-5": "young", "5-6": "young",
};

export function normalizeKidsAvatarAgeBand(value: unknown): KidsAvatarAgeBand | null {
  if (typeof value !== "string") return null;
  if ((kidsAvatarAgeBands as readonly string[]).includes(value)) return value as KidsAvatarAgeBand;
  return (legacyAgeBandMap as Record<string, KidsAvatarAgeBand | undefined>)[value] ?? null;
}

export function isKidsAvatarKeyForAgeBand(avatarKey: unknown, ageBand: unknown): avatarKey is string {
  const normalized = normalizeKidsAvatarAgeBand(ageBand);
  return typeof avatarKey === "string" && !!normalized
    && (kidsAvatarKeysByAgeBand[normalized] as readonly string[]).includes(avatarKey);
}

export function isKidsAvatarKey(avatarKey: unknown): avatarKey is string {
  return typeof avatarKey === "string"
    && Object.values(kidsAvatarKeysByAgeBand).some((keys) => (keys as readonly string[]).includes(avatarKey));
}