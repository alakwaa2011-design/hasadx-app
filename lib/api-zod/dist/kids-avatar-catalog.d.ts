/** Browser- and server-safe source of truth for student avatar eligibility. */
export declare const kidsAvatarAgeBands: readonly ["young", "middle", "secondary"];
export type KidsAvatarAgeBand = typeof kidsAvatarAgeBands[number];
export declare const legacyKidsAvatarAgeBands: readonly ["3-4", "4-5", "5-6"];
export type LegacyKidsAvatarAgeBand = typeof legacyKidsAvatarAgeBands[number];
export type KidsAvatarAgeBandInput = KidsAvatarAgeBand | LegacyKidsAvatarAgeBand;
export declare const kidsAvatarAgeBandLabels: Record<KidsAvatarAgeBand, string>;
export declare const kidsAvatarKeysByAgeBand: {
    readonly young: readonly ["kids/avatars/star", "kids/avatars/moon", "kids/avatars/rainbow"];
    readonly middle: readonly ["icon:rocket", "icon:gamepad", "icon:compass"];
    readonly secondary: readonly ["icon:target", "icon:trophy", "icon:award"];
};
export declare const defaultKidsAvatarByAgeBand: Record<KidsAvatarAgeBand, string>;
export declare const defaultKidsAvatarAgeBand: KidsAvatarAgeBand;
export declare function normalizeKidsAvatarAgeBand(value: unknown): KidsAvatarAgeBand | null;
export declare function isKidsAvatarKeyForAgeBand(avatarKey: unknown, ageBand: unknown): avatarKey is string;
export declare function isKidsAvatarKey(avatarKey: unknown): avatarKey is string;
//# sourceMappingURL=kids-avatar-catalog.d.ts.map