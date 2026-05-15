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

/**
 * XP values and daily caps match the spec table in task #605 exactly.
 * Streak milestones and one-shot events have no cap (undefined = unlimited,
 * but idempotency via ref_id prevents double-award).
 */
export const DEFAULT_XP_RULES: readonly XpRuleSeed[] = [
  // ── Core daily activity ─────────────────────────────────────────────────
  { actionKey: "login.daily",              labelAr: "تسجيل دخول يومي",                   points: 5,    dailyCap: 1  },

  // ── Assignments ─────────────────────────────────────────────────────────
  { actionKey: "assignment.create",        labelAr: "إنشاء واجب جديد",                  points: 25,   dailyCap: 5  },
  { actionKey: "submission.graded",        labelAr: "تصحيح تسليم طالب",                 points: 2,    dailyCap: 50 },

  // ── Live sessions / presentations ───────────────────────────────────────
  { actionKey: "presentation.session_created", labelAr: "بدء جلسة عرض تفاعلي",         points: 30,   dailyCap: 5  },
  { actionKey: "session.min_10_students",  labelAr: "جلسة بـ١٠+ طلاب",                  points: 50   },

  // ── Arena ────────────────────────────────────────────────────────────────
  { actionKey: "arena.category.create",   labelAr: "إنشاء فئة تحدّي حصاد",             points: 40,   dailyCap: 5  },
  { actionKey: "arena.question.create",   labelAr: "إضافة سؤال للأرينا",               points: 5,    dailyCap: 30 },
  { actionKey: "arena.game.host",         labelAr: "تشغيل تحدّي حصاد",                 points: 35,   dailyCap: 5  },

  // ── AI tools ─────────────────────────────────────────────────────────────
  { actionKey: "worksheet.generate",      labelAr: "توليد ورقة عمل",                    points: 15,   dailyCap: 5  },
  { actionKey: "lesson_plan.generate",    labelAr: "توليد خطة درس",                     points: 20,   dailyCap: 5  },

  // ── Video lessons ────────────────────────────────────────────────────────
  { actionKey: "video_lesson.create",     labelAr: "إنشاء درس فيديو",                   points: 50,   dailyCap: 3  },

  // ── Mini-games ───────────────────────────────────────────────────────────
  { actionKey: "mini_game.host",          labelAr: "استضافة لعبة تفاعلية",              points: 25,   dailyCap: 5  },

  // ── Student management ───────────────────────────────────────────────────
  { actionKey: "students.bulk_import",    labelAr: "استيراد ١٠+ طلاب دفعةً واحدة",     points: 30,   dailyCap: 1  },

  // ── Streak milestones (one-shot; idempotency via ref_id) ─────────────────
  { actionKey: "streak.milestone_7",      labelAr: "سلسلة ٧ أيام متواصلة",             points: 100  },
  { actionKey: "streak.milestone_30",     labelAr: "سلسلة ٣٠ يومًا",                   points: 500  },
  { actionKey: "streak.milestone_100",    labelAr: "سلسلة ١٠٠ يوم",                    points: 2000 },

  // ── Shared content ───────────────────────────────────────────────────────
  { actionKey: "content.shared_approved", labelAr: "محتوى مشارك معتمد من الإدارة",      points: 100  },
  { actionKey: "content.plays_50",        labelAr: "٥٠ لعبة لمحتوى مشترك",              points: 75   },
  { actionKey: "content.plays_250",       labelAr: "٢٥٠ لعبة لمحتوى مشترك",             points: 75   },
  { actionKey: "content.plays_1000",      labelAr: "١٠٠٠ لعبة لمحتوى مشترك",            points: 75   },
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
  {
    key: "content_creator",
    nameAr: "صانع المحتوى",
    descriptionAr: "بلغ المستوى الثالث (معلّم ملهم)",
    icon: "⚡",
    tier: "silver",
    unlockRule: { stat: "level", op: ">=", value: 3 },
    sortOrder: 90,
  },
  {
    key: "expert",
    nameAr: "الخبير",
    descriptionAr: "بلغ المستوى الرابع (خبير حصاد)",
    icon: "🎓",
    tier: "gold",
    unlockRule: { stat: "level", op: ">=", value: 4 },
    sortOrder: 100,
  },
  {
    key: "ambassador",
    nameAr: "السفير",
    descriptionAr: "بلغ المستوى الخامس (سفير حصاد)",
    icon: "🪪",
    tier: "legendary",
    unlockRule: { stat: "level", op: ">=", value: 5 },
    sortOrder: 110,
  },
  {
    key: "myth",
    nameAr: "الأسطورة الكبرى",
    descriptionAr: "بلغ المستوى السادس (أسطورة حصاد)",
    icon: "🏆",
    tier: "legendary",
    unlockRule: { stat: "level", op: ">=", value: 6 },
    sortOrder: 120,
  },
  {
    key: "season_warrior",
    nameAr: "محارب الموسم",
    descriptionAr: "اجمع 1500 نقطة في الموسم الحالي",
    icon: "⚔️",
    tier: "silver",
    unlockRule: { stat: "seasonXp", op: ">=", value: 1500 },
    sortOrder: 130,
  },
  {
    key: "season_champion",
    nameAr: "بطل الموسم",
    descriptionAr: "اجمع 5000 نقطة في الموسم الحالي",
    icon: "🥇",
    tier: "gold",
    unlockRule: { stat: "seasonXp", op: ">=", value: 5000 },
    sortOrder: 140,
  },
  {
    key: "marathoner",
    nameAr: "العدّاء الطويل",
    descriptionAr: "حافظ على سلسلة 60 يومًا",
    icon: "🏃",
    tier: "legendary",
    unlockRule: { stat: "longestStreakDays", op: ">=", value: 60 },
    sortOrder: 150,
  },
  {
    key: "century",
    nameAr: "السلسلة المئوية",
    descriptionAr: "حافظ على سلسلة 100 يوم متواصل",
    icon: "💯",
    tier: "legendary",
    unlockRule: { stat: "longestStreakDays", op: ">=", value: 100 },
    sortOrder: 160,
  },
  {
    key: "quest_hunter",
    nameAr: "صيّاد المهام",
    descriptionAr: "أكمل 25 مهمة أسبوعية",
    icon: "🎯",
    tier: "gold",
    unlockRule: { stat: "questsCompleted", op: ">=", value: 25 },
    sortOrder: 170,
  },
  {
    key: "quest_legend",
    nameAr: "بطل المهام",
    descriptionAr: "أكمل 50 مهمة أسبوعية",
    icon: "🏹",
    tier: "legendary",
    unlockRule: { stat: "questsCompleted", op: ">=", value: 50 },
    sortOrder: 180,
  },
  {
    key: "fully_decorated",
    nameAr: "المُتوّج",
    descriptionAr: "احصل على 12 شارة مختلفة",
    icon: "👑",
    tier: "legendary",
    unlockRule: { stat: "badgeCount", op: ">=", value: 12 },
    sortOrder: 190,
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
