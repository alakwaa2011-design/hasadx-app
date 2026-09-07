const kidsAssetFiles = {
  "kids/activities/arabic-order-01-20": "kids/activities/arabic-order-01-20.svg",
  "kids/activities/arabic-match-21-28": "kids/activities/arabic-match-21-28.svg",
  "kids/activities/arabic-trace-alif": "kids/activities/arabic-trace-alif.svg",
  "kids/activities/english-order-a-t": "kids/activities/english-order-a-t.svg",
  "kids/activities/english-match-u-z": "kids/activities/english-match-u-z.svg",
  "kids/activities/english-sound-a": "kids/activities/english-sound-a.svg",
  "kids/activities/numbers-order-0-19": "kids/activities/numbers-order-0-19.svg",
  "kids/activities/numbers-count-20": "kids/activities/numbers-count-20.svg",
  "kids/activities/numbers-choose-zero": "kids/activities/numbers-choose-zero.svg",
  "kids/audio/numbers/zero-prompt-ar": "kids/audio/numbers/zero-prompt-ar.mp3",
  "kids/audio/phonics/a-prompt": "kids/audio/phonics/a-prompt.mp3",
  "kids/avatars/moon": "kids/avatars/moon.svg",
  "kids/avatars/rainbow": "kids/avatars/rainbow.svg",
  "kids/avatars/star": "kids/avatars/star.svg",
  "kids/images/letters/a": "kids/images/letters/a.svg",
  "kids/images/letters/e": "kids/images/letters/e.svg",
  "kids/images/numbers/one": "kids/images/numbers/one.svg",
  "kids/images/numbers/zero": "kids/images/numbers/zero.svg",
  "kids/worlds/arabic-letters": "kids/worlds/arabic-letters.svg",
  "kids/worlds/english-phonics": "kids/worlds/english-phonics.svg",
  "kids/worlds/numbers": "kids/worlds/numbers.svg",
} as const;

export type KidsAssetKey = keyof typeof kidsAssetFiles;

export function resolveKidsAsset(assetKey: string): string | null {
  const path = kidsAssetFiles[assetKey as KidsAssetKey];
  return path ? `${import.meta.env.BASE_URL}${path}` : null;
}

export const kidsAssetKeys = Object.freeze(Object.keys(kidsAssetFiles) as KidsAssetKey[]);