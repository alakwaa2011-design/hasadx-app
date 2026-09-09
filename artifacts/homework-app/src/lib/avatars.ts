export const ILLUSTRATED_AVATARS = [
  { value: "/avatars/adventurer-boy.webp", label: "المستكشف الصغير" },
  { value: "/avatars/adventurer-girl.webp", label: "مستكشفة النجوم" },
  { value: "/avatars/space-boy.webp", label: "رائد الفضاء" },
  { value: "/avatars/space-girl.webp", label: "رائدة الفضاء" },
  { value: "/avatars/science-girl.webp", label: "عالمة المستقبل" },
  { value: "/avatars/nature-boy.webp", label: "حارس الطبيعة" },
  { value: "/avatars/ocean-girl.webp", label: "مستكشفة المحيط" },
  { value: "/avatars/hero-boy.webp", label: "بطل الحكاية" },
  { value: "/avatars/junior-archaeologist.webp", label: "باحث الآثار الصغير" },
  { value: "/avatars/hijabi-stargazer.webp", label: "راصدة النجوم" },
  { value: "/avatars/teen-inventor.webp", label: "مخترع المستقبل" },
  { value: "/avatars/hijabi-navigator.webp", label: "دليلة الصحراء" },
  { value: "/avatars/wise-explorer.webp", label: "حكيم الرحلة" },
  { value: "/avatars/oryx-companion.webp", label: "رفيق المها" },
] as const;

export const NORMAL_AVATARS: string[] = [
  ...ILLUSTRATED_AVATARS.map((avatar) => avatar.value),
  "🧕🏽",
  "👳🏽‍♂️",
  "🤵🏽‍♂️",
  "👰🏽‍♀️",
  "👨🏽‍🎓",
  "👩🏽‍🎓",
  "👨🏽‍🏫",
  "👩🏽‍🏫",
  "👨🏽‍💼",
  "👩🏽‍💼",
  "👨🏽‍⚕️",
  "👩🏽‍⚕️",
  "👨🏽‍💻",
  "👩🏽‍💻",
  "🧑🏽‍🚀",
  "🧑🏽‍🔬",
  "🏃🏽‍♂️",
  "🏃🏽‍♀️",
  "⛹🏽‍♂️",
  "🤸🏽‍♀️",
  "👦🏽",
  "👧🏽",
  "🧒🏽",
  "🧑🏽",
  "👨🏽",
  "👩🏽",
  "🦁", "🐯", "🦊", "🐻", "🐼", "🐸", "🦄", "🐨", "🐺", "🦅",
];

export const HACK_ICONS: string[] = [
  "⬛", "░", "▒", "▓", "█", "01", "10", "//",
  "##", ">>", "<<", "[]", "{}", "()", "$$", "&&",
  "||", "!!", "??", "::", ";;", "**", "++", "--",
];

export const DEFAULT_AVATAR = "🧒🏽";

export function isAvatarUrl(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith("/avatars/") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}
