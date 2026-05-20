/**
 * اختيار غلاف النشاط — مادة + نوع + عنوان + وسوم.
 */
import type { LucideIcon } from "lucide-react";
import {
  BookText,
  ClipboardList,
  Video,
  Presentation,
  Zap,
  FlaskConical,
  Calculator,
  Globe2,
  MoonStar,
  Languages,
  Sparkles,
  CheckCircle2,
  PenLine,
  Play,
} from "lucide-react";

export type ActivityCoverKind =
  | "homework"
  | "quiz"
  | "live"
  | "video"
  | "presentation"
  | "interactive"
  | "featured-live";

/** هوية المادة / الغلاف الأساسي */
export type CoverThemeId =
  | "arabic"
  | "english"
  | "math"
  | "science"
  | "islamic"
  | "social"
  | "video"
  | "presentation"
  | "quiz"
  | "homework"
  | "live"
  | "interactive"
  | "general";

export type CoverLayoutOverlay = "default" | "quiz" | "homework" | "interactive";

export interface ActivityCoverInput {
  subject?: string | null;
  title?: string | null;
  /** submissionMode أو questionType */
  type?: string | null;
  tags?: string | null;
  activityKind?: "assignment" | "video" | "question";
  featuredLive?: boolean;
}

export interface ActivityCoverTheme {
  themeId: CoverThemeId;
  layout: CoverLayoutOverlay;
  coverKind: ActivityCoverKind;
  seed: string;
  /** أغلفة مولّدة — بدون صور arena عشوائية */
  useGeneratedCover: boolean;
  Icon: LucideIcon;
}

export function hashCoverSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function norm(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SUBJECT_RULES: { id: CoverThemeId; keywords: string[]; priority: number }[] = [
  {
    id: "english",
    priority: 10,
    keywords: [
      "إنجليزي",
      "انجليزي",
      "إنجليزية",
      "اللغة الإنجليزية",
      "لغة إنجليزية",
      "english",
      "esl",
      "efl",
    ],
  },
  {
    id: "arabic",
    priority: 10,
    keywords: [
      "عربي",
      "عربية",
      "اللغة العربية",
      "لغة عربية",
      "نحو",
      "صرف",
      "إملاء",
      "بلاغة",
      "أدب عربي",
      "شعر",
      "arabic",
    ],
  },
  {
    id: "math",
    priority: 9,
    keywords: ["رياضيات", "حساب", "هندسة", "جبر", "math", "algebra", "geometry", "calculus"],
  },
  {
    id: "science",
    priority: 9,
    keywords: [
      "علوم",
      "كيمياء",
      "فيزياء",
      "أحياء",
      "بيولوج",
      "فضاء",
      "science",
      "physics",
      "chemistry",
      "biology",
      "lab",
      "مختبر",
    ],
  },
  {
    id: "islamic",
    priority: 9,
    keywords: [
      "إسلام",
      "اسلام",
      "إسلامية",
      "قرآن",
      "فقه",
      "حديث",
      "سيرة",
      "تربية إسلامية",
      "islam",
      "quran",
    ],
  },
  {
    id: "social",
    priority: 8,
    keywords: [
      "اجتماع",
      "تاريخ",
      "جغراف",
      "مدني",
      "وطنية",
      "جغرافيا",
      "social",
      "history",
      "geography",
      "civics",
    ],
  },
];

export function resolveSubjectThemeId(
  subject?: string | null,
  title?: string | null,
  tags?: string | null,
): CoverThemeId {
  const blob = norm(subject, title, tags);
  if (!blob) return "general";

  let best: { id: CoverThemeId; priority: number } | null = null;
  for (const rule of SUBJECT_RULES) {
    if (rule.keywords.some((k) => blob.includes(k))) {
      if (!best || rule.priority > best.priority) best = { id: rule.id, priority: rule.priority };
    }
  }
  return best?.id ?? "general";
}

export function resolveCoverKind(input: ActivityCoverInput): ActivityCoverKind {
  if (input.featuredLive) return "featured-live";
  if (input.activityKind === "video") return "video";
  if (input.activityKind === "question") return "interactive";
  const t = (input.type || "").toLowerCase();
  if (t === "mcq") return "live";
  if (t === "true_false" || t === "mixed") return "quiz";
  return "homework";
}

function resolveLayout(coverKind: ActivityCoverKind): CoverLayoutOverlay {
  if (coverKind === "quiz") return "quiz";
  if (coverKind === "homework") return "homework";
  if (coverKind === "interactive") return "interactive";
  return "default";
}

const THEME_ICONS: Record<CoverThemeId, LucideIcon> = {
  arabic: Languages,
  english: BookText,
  math: Calculator,
  science: FlaskConical,
  islamic: MoonStar,
  social: Globe2,
  video: Video,
  presentation: Presentation,
  quiz: ClipboardList,
  homework: PenLine,
  live: Zap,
  interactive: Sparkles,
  general: BookText,
};

/**
 * يختار غلاف النشاط حسب المادة ونوع النشاط والعنوان والوسوم.
 */
export function getActivityCoverTheme(activity: ActivityCoverInput): ActivityCoverTheme {
  const seed = norm(activity.subject, activity.title, activity.type, activity.tags) || "hasadx";
  const coverKind = resolveCoverKind(activity);
  const layout = resolveLayout(coverKind);
  const subjectTheme = resolveSubjectThemeId(activity.subject, activity.title, activity.tags);

  // أنواع النشاط ذات هوية بصرية خاصة (تتغلب على المادة)
  if (coverKind === "featured-live" || coverKind === "live") {
    return {
      themeId: "live",
      layout: "default",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: Zap,
    };
  }
  if (coverKind === "video") {
    return {
      themeId: "video",
      layout: "default",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: Video,
    };
  }
  if (coverKind === "presentation") {
    return {
      themeId: "presentation",
      layout: "default",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: Presentation,
    };
  }

  // اختبار / واجب / تفاعلي: المادة + طبقة النوع
  if (coverKind === "quiz") {
    return {
      themeId: subjectTheme === "general" ? "quiz" : subjectTheme,
      layout: "quiz",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: ClipboardList,
    };
  }
  if (coverKind === "homework") {
    return {
      themeId: subjectTheme === "general" ? "homework" : subjectTheme,
      layout: "homework",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: PenLine,
    };
  }
  if (coverKind === "interactive") {
    return {
      themeId: subjectTheme === "general" ? "interactive" : subjectTheme,
      layout: "interactive",
      coverKind,
      seed,
      useGeneratedCover: true,
      Icon: Sparkles,
    };
  }

  return {
    themeId: subjectTheme,
    layout,
    coverKind,
    seed,
    useGeneratedCover: true,
    Icon: THEME_ICONS[subjectTheme],
  };
}

/** @deprecated — للتوافق مع الكود القديم */
export type SubjectTheme = "science" | "math" | "arabic" | "islamic" | "social" | "general";

export function resolveSubjectTheme(
  subject?: string | null,
  title?: string | null,
  tags?: string | null,
): SubjectTheme {
  const id = resolveSubjectThemeId(subject, title, tags);
  if (id === "english") return "general";
  if (id === "arabic" || id === "math" || id === "science" || id === "islamic" || id === "social") return id;
  return "general";
}

export function resolveCoverKindLegacy(
  activityKind: "assignment" | "video" | "question",
  submissionType?: string,
  opts?: { featuredLive?: boolean },
): ActivityCoverKind {
  return resolveCoverKind({
    activityKind,
    type: submissionType,
    featuredLive: opts?.featuredLive,
  });
}

export { Play, CheckCircle2 };
