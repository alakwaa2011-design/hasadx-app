/**
 * Default XP rules / badges / quests / threshold rewards.
 * Seeded into DB if tables are empty. After seeding admins can edit freely
 * via the "التحفيز والمكافآت" console.
 */

export interface XpRuleSeed {
  actionKey: string;
  labelAr: string;
  points: number;
  dailyCap?: number;
  weeklyCap?: number;
}

export const DEFAULT_XP_RULES: readonly XpRuleSeed[] = [
  { actionKey: "login.daily", labelAr: "تسجيل دخول يومي", points: 5, dailyCap: 5 },
  { actionKey: "streak.day", labelAr: "يوم متواصل في السلسلة", points: 10, dailyCap: 10 },
  { actionKey: "assignment.create", labelAr: "إنشاء واجب جديد", points: 25, dailyCap: 100 },
  { actionKey: "assignment.share", labelAr: "مشاركة واجب", points: 15 },
  { actionKey: "assignment.import", labelAr: "استيراد واجب من المكتبة", points: 5, dailyCap: 25 },
  { actionKey: "submission.graded", labelAr: "تصحيح تسليم طالب", points: 3, dailyCap: 60 },
  { actionKey: "presentation.create", labelAr: "إنشاء عرض تفاعلي", points: 30 },
  { actionKey: "presentation.host", labelAr: "تشغيل جلسة عرض حية", points: 20, dailyCap: 60 },
  { actionKey: "arena.host", labelAr: "تشغيل تحدّي حصاد", points: 25, dailyCap: 75 },
  { actionKey: "arena.question.create", labelAr: "إضافة سؤال للأرينا", points: 4, dailyCap: 40 },
  { actionKey: "worksheet.generate", labelAr: "توليد ورقة عمل", points: 15, dailyCap: 60 },
  { actionKey: "lesson_plan.generate", labelAr: "توليد خطة درس", points: 20, dailyCap: 60 },
  { actionKey: "video_lesson.create", labelAr: "إنشاء درس فيديو", points: 25 },
  { actionKey: "student.add", labelAr: "إضافة طالب جديد", points: 2, dailyCap: 50 },
  { actionKey: "feedback.submit", labelAr: "إرسال ملاحظة للمنصة", points: 10, weeklyCap: 30 },
];

export interface BadgeSeed {
  key: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  unlockRule: Record<string, unknown>;
  functionalUnlock?: Record<string, unknown>;
  sortOrder: number;
}

export const DEFAULT_BADGES: readonly BadgeSeed[] = [
  {
    key: "first_steps",
    nameAr: "الخطوة الأولى",
    descriptionAr: "احصل على أول 100 نقطة خبرة",
    icon: "🌱",
    tier: "bronze",
    unlockRule: { stat: "totalXp", op: ">=", value: 100 },
    sortOrder: 10,
  },
  {
    key: "rising_star",
    nameAr: "نجم صاعد",
    descriptionAr: "اجمع 1000 نقطة خبرة",
    icon: "⭐",
    tier: "silver",
    unlockRule: { stat: "totalXp", op: ">=", value: 1000 },
    sortOrder: 20,
  },
  {
    key: "scholar",
    nameAr: "العلّامة",
    descriptionAr: "اجمع 5000 نقطة خبرة",
    icon: "📚",
    tier: "gold",
    unlockRule: { stat: "totalXp", op: ">=", value: 5000 },
    sortOrder: 30,
  },
  {
    key: "legend",
    nameAr: "أسطورة",
    descriptionAr: "اجمع 12000 نقطة خبرة",
    icon: "👑",
    tier: "legendary",
    unlockRule: { stat: "totalXp", op: ">=", value: 12000 },
    functionalUnlock: { feature: "presentations_pro_enabled", value: true },
    sortOrder: 40,
  },
  {
    key: "consistent",
    nameAr: "المثابر",
    descriptionAr: "حافظ على سلسلة 7 أيام متواصلة",
    icon: "🔥",
    tier: "silver",
    unlockRule: { stat: "longestStreakDays", op: ">=", value: 7 },
    sortOrder: 50,
  },
  {
    key: "ironclad",
    nameAr: "الراسخ",
    descriptionAr: "حافظ على سلسلة 30 يومًا",
    icon: "💎",
    tier: "gold",
    unlockRule: { stat: "longestStreakDays", op: ">=", value: 30 },
    sortOrder: 60,
  },
  {
    key: "questmaster",
    nameAr: "صائد المهام",
    descriptionAr: "أكمل 10 مهام أسبوعية",
    icon: "🎯",
    tier: "silver",
    unlockRule: { stat: "questsCompleted", op: ">=", value: 10 },
    sortOrder: 70,
  },
  {
    key: "decorated",
    nameAr: "المُزدان",
    descriptionAr: "احصل على 5 شارات",
    icon: "🏅",
    tier: "gold",
    unlockRule: { stat: "badgeCount", op: ">=", value: 5 },
    sortOrder: 80,
  },
];

export interface ThresholdRewardSeed {
  nameAr: string;
  metric: "level" | "totalXp" | "badgeCount" | "questsCompleted" | "streak";
  threshold: number;
  prizeKind: "feature_unlock" | "shipped_item" | "title" | "perk";
  prizeLabelAr: string;
  prizeDescriptionAr?: string;
  prizePayload?: Record<string, unknown>;
  autoApply: boolean;
}

export const DEFAULT_THRESHOLD_REWARDS: readonly ThresholdRewardSeed[] = [
  {
    nameAr: "تفعيل العروض الاحترافية تلقائياً",
    metric: "level",
    threshold: 4,
    prizeKind: "feature_unlock",
    prizeLabelAr: "العروض الاحترافية مجاناً",
    prizeDescriptionAr: "يفتح لك ميزات العروض التفاعلية الاحترافية",
    prizePayload: { feature: "presentationsProEnabled", value: true },
    autoApply: true,
  },
  {
    nameAr: "شهادة تقدير حصاد",
    metric: "level",
    threshold: 5,
    prizeKind: "shipped_item",
    prizeLabelAr: "شهادة تقدير ورقية",
    prizeDescriptionAr: "شهادة موقّعة من إدارة حصاد ترسل بالبريد",
    autoApply: false,
  },
];
