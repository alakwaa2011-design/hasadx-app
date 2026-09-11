export const ILLUSTRATED_AVATARS = [
  { value: "/avatars/adventurer-boy.webp", label: "المستكشف الصغير", category: "مغامرات" },
  { value: "/avatars/adventurer-girl.webp", label: "مستكشفة النجوم", category: "مغامرات" },
  { value: "/avatars/space-boy.webp", label: "رائد الفضاء", category: "مغامرات" },
  { value: "/avatars/space-girl.webp", label: "رائدة الفضاء", category: "مغامرات" },
  { value: "/avatars/science-girl.webp", label: "عالمة المستقبل", category: "مغامرات" },
  { value: "/avatars/nature-boy.webp", label: "حارس الطبيعة", category: "مغامرات" },
  { value: "/avatars/ocean-girl.webp", label: "مستكشفة المحيط", category: "مغامرات" },
  { value: "/avatars/hero-boy.webp", label: "بطل الحكاية", category: "مغامرات" },
  { value: "/avatars/junior-archaeologist.webp", label: "باحث الآثار الصغير", category: "مغامرات" },
  { value: "/avatars/hijabi-stargazer.webp", label: "راصدة النجوم", category: "مغامرات" },
  { value: "/avatars/teen-inventor.webp", label: "مخترع المستقبل", category: "مغامرات" },
  { value: "/avatars/hijabi-navigator.webp", label: "دليلة الصحراء", category: "مغامرات" },
  { value: "/avatars/wise-explorer.webp", label: "حكيم الرحلة", category: "مغامرات" },
  { value: "/avatars/oryx-companion.webp", label: "رفيق المها", category: "حيوانات" },
  { value: "/avatars/falcon-guide.webp", label: "صقر الدروب", category: "حيوانات" },
  { value: "/avatars/desert-fox.webp", label: "ثعلب الصحراء", category: "حيوانات" },
  { value: "/avatars/arabian-horse.webp", label: "الجواد العربي", category: "حيوانات" },
  { value: "/avatars/gulf-boy-thobe.webp", label: "فارس الديرة", category: "خليجي" },
  { value: "/avatars/gulf-girl-abaya.webp", label: "لؤلؤة الخليج", category: "خليجي" },
  { value: "/avatars/gulf-boy-bisht.webp", label: "سفير الرحلة", category: "خليجي" },
  { value: "/avatars/arab-formal-boy.webp", label: "القائد الصغير", category: "رسمي" },
  { value: "/avatars/arab-formal-girl.webp", label: "رائدة الغد", category: "رسمي" },
  { value: "/avatars/arab-formal-hijabi.webp", label: "ملهمة المستقبل", category: "رسمي" },
  { value: "/avatars/casual-curly-boy.webp", label: "صاحب الأفكار", category: "كاجوال" },
  { value: "/avatars/casual-braids-girl.webp", label: "صانعة الأثر", category: "كاجوال" },
  { value: "/avatars/casual-bob-girl.webp", label: "روح الإبداع", category: "كاجوال" },
] as const;

export const NORMAL_AVATARS: string[] = [
  ...ILLUSTRATED_AVATARS.map((avatar) => avatar.value),
];

export const HACK_ICONS: string[] = [...NORMAL_AVATARS];

export const DEFAULT_AVATAR: string = ILLUSTRATED_AVATARS[0].value;

export function isAvatarUrl(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith("/avatars/") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}
