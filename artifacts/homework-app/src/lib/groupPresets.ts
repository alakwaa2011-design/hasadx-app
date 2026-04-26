export interface GroupPreset {
  id: string;
  name: string;
  nameEn: string;
  keywords: string[];
  gradient: string;
  emoji: string;
  coverImageUrl: string;
  description: string;
}

export const GROUP_PRESETS: GroupPreset[] = [
  {
    id: "islamic",
    name: "مسابقات إسلامية",
    nameEn: "Islamic Competitions",
    keywords: ["إسلام", "إسلامية", "إسلامي", "قرآن", "قرآنية", "حديث", "نبوي", "سيرة", "فقه", "عقيدة", "صلاة", "رمضان", "islamic", "quran", "muslim", "ramadan"],
    gradient: "from-emerald-600 via-emerald-700 to-teal-900",
    emoji: "🕌",
    coverImageUrl: "https://images.unsplash.com/photo-1564769625392-651b2c3a3a76?auto=format&fit=crop&w=600&q=80",
    description: "مسابقات وأنشطة في القرآن الكريم والسنة النبوية والثقافة الإسلامية",
  },
  {
    id: "math",
    name: "الرياضيات",
    nameEn: "Mathematics",
    keywords: ["رياض", "حساب", "جبر", "هندس", "أرقام", "math", "algebra", "geometry", "numbers"],
    gradient: "from-blue-600 via-indigo-600 to-purple-700",
    emoji: "📐",
    coverImageUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80",
    description: "تمارين ومسابقات في الرياضيات والحساب والهندسة",
  },
  {
    id: "science",
    name: "العلوم",
    nameEn: "Science",
    keywords: ["علوم", "كيمياء", "فيزياء", "أحياء", "تجارب", "science", "physics", "chemistry", "biology"],
    gradient: "from-cyan-500 via-sky-600 to-blue-800",
    emoji: "🔬",
    coverImageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80",
    description: "تجارب ومسائل في العلوم الطبيعية",
  },
  {
    id: "arabic",
    name: "اللغة العربية",
    nameEn: "Arabic Language",
    keywords: ["عربي", "عربية", "نحو", "صرف", "إملاء", "بلاغة", "أدب", "شعر", "arabic"],
    gradient: "from-amber-600 via-orange-700 to-red-800",
    emoji: "📖",
    coverImageUrl: "https://images.unsplash.com/photo-1594732832278-abd644401426?auto=format&fit=crop&w=600&q=80",
    description: "نشاطات في اللغة العربية والأدب والشعر",
  },
  {
    id: "english",
    name: "English",
    nameEn: "English Language",
    keywords: ["إنجليزي", "إنجليزية", "english", "vocab", "grammar"],
    gradient: "from-rose-500 via-pink-600 to-fuchsia-700",
    emoji: "🔤",
    coverImageUrl: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80",
    description: "English vocabulary, grammar, and reading challenges",
  },
  {
    id: "history",
    name: "التاريخ والجغرافيا",
    nameEn: "History & Geography",
    keywords: ["تاريخ", "جغراف", "حضار", "history", "geography"],
    gradient: "from-stone-600 via-amber-800 to-orange-900",
    emoji: "🗺️",
    coverImageUrl: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80",
    description: "رحلات في التاريخ والجغرافيا والحضارات",
  },
  {
    id: "games",
    name: "ألعاب ومسابقات",
    nameEn: "Games & Quizzes",
    keywords: ["ألعاب", "لعبة", "مسابق", "تحدي", "game", "quiz", "challenge"],
    gradient: "from-violet-600 via-purple-700 to-fuchsia-800",
    emoji: "🎮",
    coverImageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80",
    description: "ألعاب ممتعة ومسابقات تفاعلية",
  },
  {
    id: "general",
    name: "ثقافة عامة",
    nameEn: "General Knowledge",
    keywords: ["ثقاف", "عامة", "معلومات", "general", "knowledge"],
    gradient: "from-slate-600 via-gray-700 to-zinc-900",
    emoji: "💡",
    coverImageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=600&q=80",
    description: "معلومات عامة وتنوع ثقافي",
  },
];

/**
 * Match a group name to the closest preset based on keywords.
 * Returns null if no clear match.
 */
export function matchPreset(name: string): GroupPreset | null {
  if (!name?.trim()) return null;
  const lower = name.toLowerCase().trim();
  for (const p of GROUP_PRESETS) {
    if (p.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return p;
    }
  }
  return null;
}
