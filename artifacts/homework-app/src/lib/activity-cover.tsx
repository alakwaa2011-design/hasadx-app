/**
 * Local cover presets for مكتبة الأنشطة — gradients, depth, icons, /arena-covers only.
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
import { ArabicEducationCover, pickArabicPreset } from "@/lib/arabic-education-cover";

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
  {
    theme: "arabic",
    keywords: [
      "عربي",
      "عربية",
      "اللغة العربية",
      "لغة عربية",
      "نحو",
      "صرف",
      "إملاء",
      "بلاغة",
      "أدب",
      "شعر",
      "arabic",
    ],
  },
  { theme: "islamic", keywords: ["إسلام", "اسلام", "قرآن", "فقه", "حديث", "islam", "quran"] },
  { theme: "social", keywords: ["اجتماع", "تاريخ", "جغراف", "مدني", "social", "history", "geo"] },
];

/** Arabic uses generated covers only — no photo assets */
const THEME_ASSETS: Partial<Record<SubjectTheme, string>> = {
  science: "/arena-covers/solar-system.webp",
  islamic: "/arena-covers/scholars-wisdom.webp",
  social: "/arena-covers/europe-capitals.webp",
  math: "/arena-covers/world-scientists.webp",
};

const THEME_STYLES: Record<SubjectTheme, { gradient: string; accent: string; Icon: LucideIcon }> = {
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
    gradient: "linear-gradient(152deg,#f7f3eb 0%,#ebe4d4 50%,#d9cdb8 100%)",
    accent: "rgba(196, 154, 88, 0.28)",
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
    gradient: "linear-gradient(155deg,#12081f 0%,#2e1065 28%,#5b21b6 55%,#7c3aed 78%,#a16207 100%)",
    accent: "rgba(212,166,58,0.5)",
    Icon: Zap,
    overlay: "radial-gradient(ellipse 70% 55% at 75% 18%,rgba(250,204,21,0.22),transparent 60%)",
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

/** Fine grain texture — CSS only, no external asset */
const TEXTURE_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
  opacity: 0.045,
  mixBlendMode: "overlay",
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

export function sanitizeCoverImageUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (/arabic-food/i.test(u)) return undefined;
  if (u.startsWith("/arena-covers/") || u.startsWith("/uploads/") || u.startsWith("/assets/")) return u;
  if (u.startsWith("data:image/")) return u;
  return undefined;
}

export function formatUseCount(n: number | undefined | null, unavailable?: boolean): string {
  if (unavailable) return "";
  if (n == null || Number.isNaN(n)) return "";
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
  aspect?: "video" | "photo" | "thumb";
  /** Featured / premium depth */
  premium?: boolean;
  /** Subtle live pulse for وميض */
  livePulse?: boolean;
  children?: React.ReactNode;
}

export function ActivityCover({
  kind,
  subject,
  title,
  imageUrl,
  thumbnailUrl,
  className,
  aspect = "video",
  premium = false,
  livePulse = false,
  children,
}: ActivityCoverProps) {
  const theme = resolveSubjectTheme(subject);
  const isArabicTheme = theme === "arabic";
  const themeStyle = THEME_STYLES[theme];
  const kindStyle = KIND_STYLES[kind];
  const useKindFirst =
    !isArabicTheme &&
    (kind === "live" ||
      kind === "featured-live" ||
      kind === "video" ||
      kind === "presentation" ||
      kind === "interactive");
  const base = useKindFirst ? kindStyle : themeStyle;
  const asset = !useKindFirst && !isArabicTheme ? THEME_ASSETS[theme] : undefined;
  const safeImage = sanitizeCoverImageUrl(imageUrl);
  const bgImage = thumbnailUrl || safeImage || asset;

  const coverSeed = `${subject ?? ""}|${title ?? ""}|${kind}`;
  const arabicIcon =
    kind === "video"
      ? Video
      : kind === "quiz" || kind === "live"
        ? ClipboardList
        : kind === "presentation"
          ? Presentation
          : Languages;

  if (isArabicTheme && !thumbnailUrl && !safeImage) {
    const preset = pickArabicPreset(coverSeed);
    return (
      <ArabicEducationCover
        preset={preset}
        seed={coverSeed}
        aspect={aspect}
        premium={premium}
        Icon={arabicIcon}
        className={className}
      >
        {kind === "video" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 shadow-md backdrop-blur-sm ring-1 ring-white/40">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
          </div>
        )}
        {livePulse && (
          <div
            className="pointer-events-none absolute right-[18%] top-[22%] z-[1] h-16 w-16 rounded-full blur-2xl"
            style={{
              background: "rgba(212, 166, 58, 0.25)",
              animation: "activity-cover-pulse 4.5s ease-in-out infinite",
            }}
          />
        )}
        {children}
      </ArabicEducationCover>
    );
  }

  const Icon = base.Icon;
  const iconSize = aspect === "thumb" ? "h-10 w-10" : premium ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        aspect === "video" && "aspect-video",
        aspect === "photo" && "aspect-[4/3]",
        aspect === "thumb" && "aspect-square",
        className,
      )}
    >
      <div className="absolute inset-0" style={{ background: base.gradient }} />
      {kindStyle.overlay && <div className="absolute inset-0" style={{ background: kindStyle.overlay }} />}

      {/* Soft background shapes */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full opacity-25 blur-2xl"
        style={{ background: base.accent }}
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-[40%] opacity-20 blur-3xl"
        style={{ background: "rgba(255,255,255,0.35)" }}
      />
      <div className="pointer-events-none absolute right-[18%] top-[42%] h-16 w-16 rotate-12 rounded-2xl border border-white/10 bg-white/5" />
      <div className="pointer-events-none absolute left-[12%] top-[22%] h-10 w-10 rounded-full border border-white/15 bg-white/5" />

      {bgImage && (
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-overlay"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div className="absolute inset-0" style={TEXTURE_STYLE} aria-hidden />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 95% 85% at 80% 12%, ${base.accent}, transparent 58%)`,
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(0,0,0,0.45) 0%, transparent 55%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.25) 100%)",
        }}
      />

      {premium && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 35%, rgba(0,0,0,0.12) 100%)",
          }}
        />
      )}

      {livePulse && (
        <div
          className="pointer-events-none absolute right-[20%] top-[25%] h-20 w-20 rounded-full bg-amber-200/20 blur-2xl"
          style={{ animation: "activity-cover-pulse 4.5s ease-in-out infinite" }}
        />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.22]",
          premium && "opacity-[0.28]",
        )}
      >
        <Icon className={cn(iconSize, "text-white drop-shadow-lg")} strokeWidth={1.15} />
      </div>

      {kind === "video" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 shadow-lg backdrop-blur-md ring-1 ring-white/35">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      )}

      {(kind === "live" || kind === "featured-live") && (
        <>
          <div className="pointer-events-none absolute top-3 left-3 h-1 w-1 rounded-full bg-amber-200/90 shadow-[0_0_6px_1px_rgba(253,224,71,0.5)]" />
          <div className="pointer-events-none absolute top-7 right-8 h-px w-10 rotate-12 bg-gradient-to-r from-transparent via-amber-100/70 to-transparent" />
        </>
      )}

      {children}
    </div>
  );
}
