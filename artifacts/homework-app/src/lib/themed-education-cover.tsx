/**
 * أغلفة تعليمية مولّدة — CSS/SVG حسب getActivityCoverTheme.
 */
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookText,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Globe2,
  MoonStar,
  PenLine,
  Play,
  Presentation,
  Sparkles,
  Video,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityCoverTheme, CoverLayoutOverlay, CoverThemeId } from "@/lib/activity-cover-theme";
import { hashCoverSeed } from "@/lib/activity-cover-theme";
import { ArabicEducationCover, pickArabicPreset } from "@/lib/arabic-education-cover";

const PAPER_TEXTURE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
  opacity: 0.04,
  mixBlendMode: "overlay",
};

interface Palette {
  gradient: string;
  accent: string;
  ink: string;
  glyph: string;
  secondaryGlyph?: string;
}

const PALETTES: Record<CoverThemeId, Palette[]> = {
  english: [
    {
      gradient: "linear-gradient(148deg,#1e2a5e 0%,#3b4d8f 45%,#c7d2fe 100%)",
      accent: "rgba(167,139,250,0.3)",
      ink: "rgba(255,255,255,0.14)",
      glyph: "A",
      secondaryGlyph: "B",
    },
    {
      gradient: "linear-gradient(150deg,#312e81 0%,#5b21b6 50%,#e0e7ff 100%)",
      accent: "rgba(129,140,248,0.28)",
      ink: "rgba(255,255,255,0.12)",
      glyph: "E",
      secondaryGlyph: "C",
    },
  ],
  math: [
    {
      gradient: "linear-gradient(148deg,#0f2744 0%,#1e4a7a 42%,#d4af6a 100%)",
      accent: "rgba(96,165,250,0.32)",
      ink: "rgba(255,255,255,0.13)",
      glyph: "π",
      secondaryGlyph: "∑",
    },
    {
      gradient: "linear-gradient(152deg,#1e1b4b 0%,#3730a3 48%,#fbbf24 100%)",
      accent: "rgba(251,191,36,0.28)",
      ink: "rgba(255,255,255,0.11)",
      glyph: "÷",
      secondaryGlyph: "×",
    },
  ],
  science: [
    {
      gradient: "linear-gradient(148deg,#042f2e 0%,#0d5c56 40%,#38bdf8 100%)",
      accent: "rgba(52,211,153,0.3)",
      ink: "rgba(255,255,255,0.12)",
      glyph: "⌬",
      secondaryGlyph: "○",
    },
    {
      gradient: "linear-gradient(150deg,#0c2340 0%,#1d4ed8 55%,#6ee7b7 100%)",
      accent: "rgba(56,189,248,0.28)",
      ink: "rgba(255,255,255,0.1)",
      glyph: "○",
      secondaryGlyph: "◎",
    },
  ],
  islamic: [
    {
      gradient: "linear-gradient(148deg,#0f2d3d 0%,#1a4d5c 42%,#d4a63a 100%)",
      accent: "rgba(212,166,58,0.32)",
      ink: "rgba(255,255,255,0.11)",
      glyph: "☪",
      secondaryGlyph: "✦",
    },
    {
      gradient: "linear-gradient(152deg,#0a2e1a 0%,#14532d 50%,#1e3a5f 100%)",
      accent: "rgba(212,166,58,0.25)",
      ink: "rgba(255,255,255,0.1)",
      glyph: "❋",
      secondaryGlyph: "◆",
    },
  ],
  social: [
    {
      gradient: "linear-gradient(148deg,#3d2c1e 0%,#6b5344 45%,#d6cfc4 100%)",
      accent: "rgba(180,134,72,0.25)",
      ink: "rgba(255,255,255,0.12)",
      glyph: "⌖",
      secondaryGlyph: "◉",
    },
    {
      gradient: "linear-gradient(150deg,#334155 0%,#64748b 50%,#e7e5e4 100%)",
      accent: "rgba(148,163,184,0.3)",
      ink: "rgba(255,255,255,0.1)",
      glyph: "N",
      secondaryGlyph: "▣",
    },
  ],
  video: [
    {
      gradient: "linear-gradient(155deg,#0a0f1a 0%,#1a2744 40%,#334155 100%)",
      accent: "rgba(96,165,250,0.35)",
      ink: "rgba(255,255,255,0.08)",
      glyph: "▶",
    },
  ],
  presentation: [
    {
      gradient: "linear-gradient(148deg,#1e3a8a 0%,#3b82f6 50%,#faf8f3 100%)",
      accent: "rgba(191,219,254,0.35)",
      ink: "rgba(255,255,255,0.1)",
      glyph: "▤",
      secondaryGlyph: "▥",
    },
  ],
  quiz: [
    {
      gradient: "linear-gradient(148deg,#78350f 0%,#b45309 50%,#fef3c7 100%)",
      accent: "rgba(251,191,36,0.28)",
      ink: "rgba(58,46,36,0.12)",
      glyph: "✓",
    },
  ],
  homework: [
    {
      gradient: "linear-gradient(148deg,#0a4d26 0%,#1a6b42 55%,#e8f4ec 100%)",
      accent: "rgba(232,244,236,0.3)",
      ink: "rgba(255,255,255,0.12)",
      glyph: "≡",
    },
  ],
  live: [
    {
      gradient: "linear-gradient(155deg,#1a0a2e 0%,#4c1d95 40%,#7c3aed 75%,#d4a63a 100%)",
      accent: "rgba(212,166,58,0.4)",
      ink: "rgba(255,255,255,0.12)",
      glyph: "⚡",
    },
  ],
  interactive: [
    {
      gradient: "linear-gradient(148deg,#4c1d95 0%,#7c3aed 55%,#e9d5ff 100%)",
      accent: "rgba(233,213,255,0.35)",
      ink: "rgba(255,255,255,0.11)",
      glyph: "✦",
    },
  ],
  general: [
    {
      gradient: "linear-gradient(148deg,#0a4d26 0%,#1f6b47 50%,#e8f4ec 100%)",
      accent: "rgba(232,244,236,0.28)",
      ink: "rgba(255,255,255,0.11)",
      glyph: "ح",
    },
    {
      gradient: "linear-gradient(150deg,#1e293b 0%,#475569 55%,#f1f5f9 100%)",
      accent: "rgba(148,163,184,0.25)",
      ink: "rgba(255,255,255,0.1)",
      glyph: "◆",
    },
  ],
  arabic: [],
};

function pickPalette(themeId: CoverThemeId, seed: string): Palette {
  const list = PALETTES[themeId]?.length ? PALETTES[themeId] : PALETTES.general;
  return list[hashCoverSeed(seed) % list.length];
}

function MathGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.12]"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
        `,
        backgroundSize: "18px 18px",
      }}
      aria-hidden
    />
  );
}

function ChecklistOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 p-4 opacity-[0.2]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-2 flex items-center gap-2">
          <div className="h-3 w-3 rounded border border-white/60" />
          <div className="h-0.5 flex-1 max-w-[60%] rounded bg-white/50" />
        </div>
      ))}
    </div>
  );
}

function NotebookOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.14]"
      style={{
        backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent 13px, rgba(255,255,255,0.35) 13px, rgba(255,255,255,0.35) 14px)`,
        backgroundPosition: "0 20%",
      }}
      aria-hidden
    />
  );
}

function VideoFrame() {
  return (
    <div
      className="pointer-events-none absolute inset-3 rounded-lg border-2 border-white/20 shadow-inner"
      style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)" }}
      aria-hidden
    />
  );
}

function SlideStack() {
  return (
    <>
      <div className="pointer-events-none absolute right-[12%] top-[20%] h-14 w-20 rotate-6 rounded-md border border-white/25 bg-white/10 shadow-sm" />
      <div className="pointer-events-none absolute right-[18%] top-[26%] h-14 w-20 -rotate-3 rounded-md border border-white/30 bg-white/15 shadow-md" />
    </>
  );
}

function IslamicPattern({ id }: { id: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden>
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="none" stroke="rgba(212,166,58,0.6)" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function ScienceHelix() {
  return (
    <svg className="pointer-events-none absolute right-[8%] top-[15%] h-20 w-12 opacity-20" viewBox="0 0 40 80" aria-hidden>
      <path
        d="M20 4 Q32 20 20 36 Q8 52 20 68 Q32 84 20 76"
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="2"
      />
      <path
        d="M20 4 Q8 20 20 36 Q32 52 20 68"
        fill="none"
        stroke="rgba(52,211,153,0.6)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MapLines() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.15]" aria-hidden>
      <ellipse cx="55%" cy="45%" rx="28%" ry="22%" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
      <path d="M15% 60% Q40% 35% 75% 55%" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
      <circle cx="70%" cy="38%" r="3" fill="rgba(212,166,58,0.5)" />
    </svg>
  );
}

function LiveBolt() {
  return (
    <svg
      className="pointer-events-none absolute left-[18%] top-[28%] h-16 w-10 opacity-[0.35]"
      viewBox="0 0 24 40"
      fill="rgba(250,204,21,0.85)"
      aria-hidden
    >
      <path d="M14 2 L6 20 H12 L8 38 L20 14 H13 Z" />
    </svg>
  );
}

export interface ThemedEducationCoverProps {
  theme: ActivityCoverTheme;
  aspect?: "video" | "photo" | "thumb";
  premium?: boolean;
  livePulse?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ThemedEducationCover({
  theme,
  aspect = "video",
  premium = false,
  livePulse = false,
  className,
  children,
}: ThemedEducationCoverProps) {
  const patternId = useId().replace(/:/g, "");
  const { themeId, layout, seed, Icon } = theme;

  if (themeId === "arabic") {
    const preset = pickArabicPreset(seed);
    return (
      <ArabicEducationCover preset={preset} seed={seed} aspect={aspect} premium={premium} Icon={Icon} className={className}>
        {layout === "quiz" && <ChecklistOverlay />}
        {layout === "homework" && <NotebookOverlay />}
        {theme.coverKind === "video" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 shadow-md backdrop-blur-sm ring-1 ring-white/40">
              <Play className="h-5 w-5 fill-white text-white" />
            </div>
          </div>
        )}
        {livePulse && (
          <div
            className="pointer-events-none absolute right-[18%] top-[22%] z-[1] h-16 w-16 rounded-full blur-2xl"
            style={{ background: "rgba(212,166,58,0.25)", animation: "activity-cover-pulse 4.5s ease-in-out infinite" }}
          />
        )}
        {children}
      </ArabicEducationCover>
    );
  }

  const palette = pickPalette(themeId, seed);
  const iconSize = aspect === "thumb" ? "h-9 w-9" : premium ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20";
  const glyphSize = aspect === "thumb" ? "2.75rem" : "clamp(3.5rem, 22vw, 8rem)";

  const showMath = themeId === "math";
  const showScience = themeId === "science";
  const showIslamic = themeId === "islamic";
  const showSocial = themeId === "social";
  const showEnglish = themeId === "english";

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
      <div className="absolute inset-0" style={{ background: palette.gradient }} />

      <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full blur-3xl opacity-30" style={{ background: palette.accent }} />
      <div className="pointer-events-none absolute -bottom-10 -left-8 h-36 w-36 rounded-full blur-3xl opacity-25" style={{ background: palette.ink }} />

      {showMath && <MathGrid />}
      {showScience && <ScienceHelix />}
      {showIslamic && <IslamicPattern id={`islam-${patternId}`} />}
      {showSocial && <MapLines />}

      {themeId === "video" && <VideoFrame />}
      {themeId === "presentation" && <SlideStack />}
      {themeId === "live" && <LiveBolt />}

      {layout === "quiz" && <ChecklistOverlay />}
      {layout === "homework" && <NotebookOverlay />}

      {/* Typography glyph */}
      <span
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-bold"
        style={{ fontSize: glyphSize, color: palette.ink, opacity: 0.55, fontFamily: "Georgia, 'Times New Roman', serif" }}
        aria-hidden
      >
        {palette.glyph}
      </span>
      {palette.secondaryGlyph && (
        <span
          className="pointer-events-none absolute select-none font-semibold"
          style={{
            top: "14%",
            right: "10%",
            fontSize: aspect === "thumb" ? "1.25rem" : "clamp(1.5rem, 8vw, 3rem)",
            color: palette.ink,
            opacity: 0.35,
          }}
          aria-hidden
        >
          {palette.secondaryGlyph}
        </span>
      )}

      {showEnglish && (
        <span
          className="pointer-events-none absolute bottom-[18%] left-[12%] text-[10px] font-medium tracking-widest opacity-25 text-white"
          aria-hidden
        >
          read · write · learn
        </span>
      )}

      <div className="absolute inset-0" style={PAPER_TEXTURE} aria-hidden />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 75% 15%, ${palette.accent}, transparent 55%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 115% 95% at 50% 100%, rgba(0,0,0,0.32) 0%, transparent 52%), linear-gradient(180deg, transparent 42%, rgba(0,0,0,0.18) 100%)",
        }}
      />

      {premium && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 38%)" }}
        />
      )}

      {livePulse && (
        <div
          className="pointer-events-none absolute right-[20%] top-[24%] h-20 w-20 rounded-full blur-2xl"
          style={{ background: "rgba(212,166,58,0.22)", animation: "activity-cover-pulse 4.5s ease-in-out infinite" }}
        />
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.32]">
        <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur-[2px]">
          <CoverIcon themeId={themeId} Icon={Icon} className={cn(iconSize, "text-white drop-shadow-md")} />
        </div>
      </div>

      {themeId === "video" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/25 shadow-lg ring-2 ring-white/35 backdrop-blur-md">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      )}

      {(themeId === "live" || theme.coverKind === "featured-live") && (
        <>
          <div className="pointer-events-none absolute top-3 left-3 h-1 w-1 rounded-full bg-amber-200/90 shadow-[0_0_6px_1px_rgba(253,224,71,0.45)]" />
          <div className="pointer-events-none absolute top-8 right-10 h-px w-12 rotate-12 bg-gradient-to-r from-transparent via-amber-100/60 to-transparent" />
        </>
      )}

      {layout === "quiz" && (
        <CheckCircle2 className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/25" strokeWidth={1.5} />
      )}

      {children}
    </div>
  );
}

function CoverIcon({
  themeId,
  Icon,
  className,
}: {
  themeId: CoverThemeId;
  Icon: LucideIcon;
  className?: string;
}) {
  const Map: Partial<Record<CoverThemeId, LucideIcon>> = {
    math: Calculator,
    science: FlaskConical,
    islamic: MoonStar,
    social: Globe2,
    english: BookText,
    video: Video,
    presentation: Presentation,
    quiz: ClipboardList,
    homework: PenLine,
    live: Zap,
    interactive: Sparkles,
    general: BookText,
  };
  const I = Map[themeId] ?? Icon;
  return <I className={className} strokeWidth={1.15} />;
}
