/**
 * Local cover presets for مكتبة الأنشطة — CSS gradients + icons + optional
 * bundled /public assets (no random external URLs).
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
  Play,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityCoverKind =
  | "homework"
  | "quiz"
  | "live"
  | "video"
  | "presentation"
  | "interactive"
  | "featured-live";

export type SubjectTheme =
  | "science"
  | "math"
  | "arabic"
  | "islamic"
  | "social"
  | "general";

const SUBJECT_RULES: { theme: SubjectTheme; keywords: string[] }[] = [
  { theme: "science", keywords: ["علوم", "كيمياء", "فيزياء", "أحياء", "science", "physics", "biology"] },
  { theme: "math", keywords: ["رياضيات", "حساب", "هندسة", "math", "algebra", "geometry"] },
  { theme: "arabic", keywords: ["عربي", "عربية", "نحو", "أدب", "شعر", "arabic", "لغة"] },
  { theme: "islamic", keywords: ["إسلام", "اسلام", "قرآن", "فقه", "حديث", "islam", "quran"] },
  { theme: "social", keywords: ["اجتماع", "تاريخ", "جغراف", "مدني", "social", "history", "geo"] },
];

/** Stable /public paths only — see public/arena-covers */
const THEME_ASSETS: Partial<Record<SubjectTheme, string>> = {
  science: "/arena-covers/solar-system.webp",
  islamic: "/arena-covers/scholars-wisdom.webp",
  social: "/arena-covers/europe-capitals.webp",
  arabic: "/arena-covers/arabic-food.webp",
  math: "/arena-covers/world-scientists.webp",
};

const THEME_STYLES: Record<
  SubjectTheme,
  { gradient: string; accent: string; Icon: LucideIcon }
> = {
  science: {
    gradient: "linear-gradient(145deg,#0c2340 0%,#134e6f 40%,#1a7a5c 100%)",
    accent: "rgba(56,189,248,0.35)",
    Icon: FlaskConical,
  },
  math: {
    gradient: "linear-gradient(145deg,#1e1b4b 0%,#3730a3 45%,#6366f1 100%)",
    accent: "rgba(167,139,250,0.35)",
    Icon: Calculator,
  },
  arabic: {
    gradient: "linear-gradient(145deg,#3d2817 0%,#78350f 50%,#b45309 100%)",
    accent: "rgba(251,191,36,0.3)",
    Icon: Languages,
  },
  islamic: {
    gradient: "linear-gradient(145deg,#0a2e1a 0%,#14532d 50%,#166534 100%)",
    accent: "rgba(212,166,58,0.35)",
    Icon: MoonStar,
  },
  social: {
    gradient: "linear-gradient(145deg,#1e293b 0%,#334155 50%,#475569 100%)",
    accent: "rgba(148,163,184,0.35)",
    Icon: Globe2,
  },
  general: {
    gradient: "linear-gradient(145deg,#0a4d26 0%,#1a6b42 50%,#2d8a5c 100%)",
    accent: "rgba(232,244,236,0.25)",
    Icon: BookText,
  },
};

const KIND_STYLES: Record<
  ActivityCoverKind,
  { gradient: string; accent: string; Icon: LucideIcon; overlay?: string }
> = {
  homework: {
    gradient: "linear-gradient(145deg,#0a4d26 0%,#1f6b47 55%,#3d9970 100%)",
    accent: "rgba(255,255,255,0.12)",
    Icon: BookText,
  },
  quiz: {
    gradient: "linear-gradient(145deg,#78350f 0%,#b45309 50%,#f59e0b 100%)",
    accent: "rgba(255,255,255,0.15)",
    Icon: ClipboardList,
  },
  live: {
    gradient: "linear-gradient(145deg,#312e81 0%,#5b21b6 40%,#7c3aed 85%,#d4a63a 100%)",
    accent: "rgba(250,204,21,0.35)",
    Icon: Zap,
  },
  "featured-live": {
    gradient: "linear-gradient(145deg,#1a0a2e 0%,#4c1d95 35%,#7c3aed 70%,#d4a63a 100%)",
    accent: "rgba(212,166,58,0.45)",
    Icon: Zap,
    overlay: "radial-gradient(ellipse 80% 60% at 70% 20%,rgba(250,204,21,0.25),transparent)",
  },
  video: {
    gradient: "linear-gradient(145deg,#0f172a 0%,#1e3a5f 50%,#2563eb 100%)",
    accent: "rgba(96,165,250,0.35)",
    Icon: Video,
  },
  presentation: {
    gradient: "linear-gradient(145deg,#1e3a8a 0%,#2563eb 50%,#60a5fa 100%)",
    accent: "rgba(191,219,254,0.3)",
    Icon: Presentation,
  },
  interactive: {
    gradient: "linear-gradient(145deg,#4c1d95 0%,#7c3aed 55%,#c4b5fd 100%)",
    accent: "rgba(233,213,255,0.35)",
    Icon: Sparkles,
  },
};

export function resolveSubjectTheme(subject?: string | null): SubjectTheme {
  const s = (subject || "").toLowerCase();
  if (!s) return "general";
  for (const rule of SUBJECT_RULES) {
    if (rule.keywords.some((k) => s.includes(k))) return rule.theme;
  }
  return "general";
}

export function resolveCoverKind(
  activityKind: "assignment" | "video" | "question",
  submissionType?: string,
  opts?: { featuredLive?: boolean },
): ActivityCoverKind {
  if (opts?.featuredLive) return "featured-live";
  if (activityKind === "video") return "video";
  if (activityKind === "question") return "interactive";
  if (submissionType === "mcq") return "live";
  if (submissionType === "true_false" || submissionType === "mixed") return "quiz";
  return "homework";
}

/** Only same-origin or known upload paths — blocks arbitrary hotlinks. */
export function sanitizeCoverImageUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("/arena-covers/") || u.startsWith("/uploads/") || u.startsWith("/assets/")) {
    return u;
  }
  if (u.startsWith("data:image/")) return u;
  return undefined;
}

export function formatUseCount(n: number | undefined | null, unavailable?: boolean): string {
  if (unavailable) return "—";
  if (n == null || Number.isNaN(n)) return "—";
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export interface ActivityCoverProps {
  kind: ActivityCoverKind;
  subject?: string | null;
  title?: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  className?: string;
  /** 16:9 default; photo = 4:3 */
  aspect?: "video" | "photo";
  children?: React.ReactNode;
}

export function ActivityCover({
  kind,
  subject,
  imageUrl,
  thumbnailUrl,
  className,
  aspect = "video",
  children,
}: ActivityCoverProps) {
  const theme = resolveSubjectTheme(subject);
  const themeStyle = THEME_STYLES[theme];
  const kindStyle = KIND_STYLES[kind];
  const useKindFirst = kind === "live" || kind === "featured-live" || kind === "video" || kind === "presentation" || kind === "interactive";
  const base = useKindFirst ? kindStyle : themeStyle;
  const asset = !useKindFirst ? THEME_ASSETS[theme] : undefined;
  const safeImage = sanitizeCoverImageUrl(imageUrl);
  const bgImage = thumbnailUrl || safeImage || asset;

  const Icon = base.Icon;
  const ThemeIcon = themeStyle.Icon;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        aspect === "video" ? "aspect-video" : "aspect-[4/3]",
        className,
      )}
    >
      <div className="absolute inset-0" style={{ background: base.gradient }} />
      {kindStyle.overlay && (
        <div className="absolute inset-0" style={{ background: kindStyle.overlay }} />
      )}
      {bgImage && (
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-overlay"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(ellipse 90% 80% at 85% 15%, ${base.accent}, transparent 55%)`,
        }}
      />
      <div
        className="absolute -left-6 -bottom-8 h-32 w-32 rounded-full opacity-30 blur-2xl"
        style={{ background: base.accent }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 opacity-[0.18]">
        <Icon className="h-20 w-20 text-white sm:h-24 sm:w-24" strokeWidth={1.25} />
        {!useKindFirst && theme !== "general" && (
          <ThemeIcon className="h-14 w-14 text-white/80 sm:h-16 sm:w-16" strokeWidth={1.25} />
        )}
      </div>
      {kind === "video" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/25 shadow-lg backdrop-blur-sm ring-2 ring-white/40">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      )}
      {(kind === "live" || kind === "featured-live") && (
        <>
          <div className="pointer-events-none absolute top-3 left-3 h-1 w-1 rounded-full bg-amber-300 shadow-[0_0_8px_2px_rgba(250,204,21,0.8)]" />
          <div className="pointer-events-none absolute top-8 right-6 h-0.5 w-8 rotate-12 bg-gradient-to-r from-transparent via-amber-200/80 to-transparent" />
        </>
      )}
      {children}
    </div>
  );
}
