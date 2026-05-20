/**
 * هوية بصرية تعليمية عربية — أغلفة مولّدة (CSS/SVG فقط، بدون صور خارجية).
 */
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Languages, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArabicCoverVariant = "typography" | "manuscript" | "letters" | "geometric";

export interface ArabicCoverPreset {
  variant: ArabicCoverVariant;
  gradient: string;
  accent: string;
  letter: string;
  secondaryLetter: string;
  ink: string;
  gold: string;
}

const ARABIC_LETTERS = ["ض", "ن", "ق", "ع", "ر", "ب", "ل", "ف", "م", "ح", "خ", "ش", "د", "ك", "و"] as const;

const PALETTES: Omit<ArabicCoverPreset, "variant" | "letter" | "secondaryLetter">[] = [
  {
    gradient: "linear-gradient(152deg, #f7f3eb 0%, #ebe4d4 38%, #d9cdb8 100%)",
    accent: "rgba(180, 134, 72, 0.28)",
    ink: "rgba(58, 46, 36, 0.14)",
    gold: "rgba(196, 154, 88, 0.35)",
  },
  {
    gradient: "linear-gradient(148deg, #0f3d2e 0%, #1a5c45 42%, #e8e4d6 100%)",
    accent: "rgba(232, 220, 196, 0.32)",
    ink: "rgba(255, 255, 255, 0.12)",
    gold: "rgba(212, 166, 58, 0.28)",
  },
  {
    gradient: "linear-gradient(155deg, #3d2f24 0%, #5c4636 45%, #c4b5a0 100%)",
    accent: "rgba(245, 237, 224, 0.22)",
    ink: "rgba(255, 255, 255, 0.1)",
    gold: "rgba(214, 180, 120, 0.3)",
  },
  {
    gradient: "linear-gradient(150deg, #1a2744 0%, #2c3e5c 50%, #d4cfc4 100%)",
    accent: "rgba(191, 219, 254, 0.2)",
    ink: "rgba(255, 255, 255, 0.11)",
    gold: "rgba(180, 160, 120, 0.25)",
  },
  {
    gradient: "linear-gradient(148deg, #4a2030 0%, #6b3348 40%, #e8dfd4 100%)",
    accent: "rgba(255, 240, 230, 0.25)",
    ink: "rgba(255, 255, 255, 0.1)",
    gold: "rgba(212, 166, 58, 0.22)",
  },
  {
    gradient: "linear-gradient(150deg, #faf6ef 0%, #f0e6d2 55%, #d4c4a8 100%)",
    accent: "rgba(160, 120, 60, 0.2)",
    ink: "rgba(74, 58, 42, 0.12)",
    gold: "rgba(184, 148, 72, 0.32)",
  },
];

const VARIANTS: ArabicCoverVariant[] = ["typography", "manuscript", "letters", "geometric"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic preset per activity title / subject / id */
export function pickArabicPreset(seed: string): ArabicCoverPreset {
  const h = hashString(seed || "عربي");
  const palette = PALETTES[h % PALETTES.length];
  const variant = VARIANTS[h % VARIANTS.length];
  const letter = ARABIC_LETTERS[h % ARABIC_LETTERS.length];
  const secondaryLetter = ARABIC_LETTERS[(h + 5) % ARABIC_LETTERS.length];
  return { variant, letter, secondaryLetter, ...palette };
}

const PAPER_TEXTURE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
  opacity: 0.035,
  mixBlendMode: "multiply",
};

function GeometricPattern({ ink, gold, patternId }: { ink: string; gold: string; patternId: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 120 80"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z"
            fill="none"
            stroke={gold}
            strokeWidth="0.35"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} opacity="0.55" />
      <circle cx="100" cy="12" r="28" fill="none" stroke={ink} strokeWidth="0.5" opacity="0.5" />
      <circle cx="18" cy="68" r="20" fill="none" stroke={ink} strokeWidth="0.4" opacity="0.35" />
    </svg>
  );
}

function ManuscriptLines() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.14]"
      style={{
        backgroundImage: `repeating-linear-gradient(
          180deg,
          transparent,
          transparent 11px,
          rgba(58, 46, 36, 0.22) 11px,
          rgba(58, 46, 36, 0.22) 12px
        )`,
        backgroundPosition: "0 18%",
      }}
      aria-hidden
    />
  );
}

function CornerOrnament({ side }: { side: "tl" | "br" }) {
  const flip = side === "br";
  return (
    <div
      className={cn(
        "pointer-events-none absolute h-14 w-14 opacity-[0.18]",
        flip ? "bottom-2 left-2" : "right-2 top-2",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="h-full w-full">
        <path
          d="M4 20 Q20 4 36 20 Q20 36 4 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          className="text-[#8b7355]"
        />
        <circle cx="20" cy="20" r="3" fill="currentColor" className="text-[#b8965a]" opacity="0.6" />
      </svg>
    </div>
  );
}

export interface ArabicEducationCoverProps {
  preset: ArabicCoverPreset;
  seed: string;
  aspect?: "video" | "photo" | "thumb";
  premium?: boolean;
  Icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}

export function ArabicEducationCover({
  preset,
  seed,
  aspect = "video",
  premium = false,
  Icon = Languages,
  className,
  children,
}: ArabicEducationCoverProps) {
  const patternId = useId().replace(/:/g, "");
  const { variant, gradient, accent, letter, secondaryLetter, ink, gold } = preset;
  const iconSize =
    aspect === "thumb" ? "h-9 w-9" : premium ? "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20" : "h-16 w-16 sm:h-[4.25rem] sm:w-[4.25rem]";
  const isLightBg = variant === "typography" || (hashString(seed) % 2 === 0 && variant === "manuscript");
  const iconColor = isLightBg ? "text-[#3d4a3a]" : "text-white/90";

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
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Ink wash */}
      <div
        className="pointer-events-none absolute -right-[20%] -top-[30%] h-[70%] w-[55%] rounded-full blur-3xl"
        style={{ background: accent }}
      />
      <div
        className="pointer-events-none absolute -bottom-[25%] -left-[15%] h-[55%] w-[45%] rounded-full blur-3xl"
        style={{ background: gold }}
      />

      {variant === "geometric" && <GeometricPattern ink={ink} gold={gold} patternId={patternId} />}
      {variant === "manuscript" && <ManuscriptLines />}
      <CornerOrnament side="tl" />
      <CornerOrnament side="br" />

      {/* Giant Arabic letter(s) */}
      {variant === "typography" && (
        <span
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-serif leading-none"
          style={{
            fontSize: aspect === "thumb" ? "5.5rem" : "clamp(5rem, 28vw, 11rem)",
            color: ink,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
          aria-hidden
        >
          {letter}
        </span>
      )}

      {variant === "manuscript" && (
        <>
          <span
            className="pointer-events-none absolute select-none font-serif"
            style={{
              top: "12%",
              right: "8%",
              fontSize: aspect === "thumb" ? "3.5rem" : "clamp(3rem, 18vw, 7rem)",
              color: ink,
              fontWeight: 600,
              opacity: 0.85,
            }}
            aria-hidden
          >
            {letter}
          </span>
          <PenLine
            className={cn(
              "pointer-events-none absolute opacity-[0.2]",
              iconColor,
              aspect === "thumb" ? "bottom-2 left-2 h-6 w-6" : "bottom-4 left-5 h-9 w-9",
            )}
            strokeWidth={1.25}
          />
        </>
      )}

      {variant === "letters" && (
        <>
          {[
            { ch: letter, top: "8%", left: "6%", size: "clamp(2.5rem, 14vw, 5rem)", rot: -8 },
            { ch: secondaryLetter, top: "42%", right: "5%", size: "clamp(2rem, 11vw, 4rem)", rot: 6 },
            { ch: "ع", bottom: "10%", left: "28%", size: "clamp(1.75rem, 9vw, 3.25rem)", rot: -4 },
          ].map((item, i) => (
            <span
              key={i}
              className="pointer-events-none absolute select-none font-serif font-bold"
              style={{
                top: item.top,
                left: item.left,
                right: (item as { right?: string }).right,
                bottom: (item as { bottom?: string }).bottom,
                fontSize: item.size,
                color: ink,
                transform: `rotate(${item.rot}deg)`,
                opacity: 0.55 - i * 0.08,
              }}
              aria-hidden
            >
              {item.ch}
            </span>
          ))}
        </>
      )}

      {variant === "geometric" && (
        <span
          className="pointer-events-none absolute select-none font-serif font-bold"
          style={{
            bottom: "14%",
            right: "10%",
            fontSize: aspect === "thumb" ? "2.75rem" : "clamp(2.5rem, 14vw, 5rem)",
            color: ink,
            opacity: 0.7,
          }}
          aria-hidden
        >
          {letter}
        </span>
      )}

      {/* Soft geometric tiles */}
      <div className="pointer-events-none absolute left-[10%] top-[55%] h-8 w-8 rotate-45 border border-white/15 bg-white/5" />
      <div className="pointer-events-none absolute right-[14%] top-[28%] h-5 w-5 rounded-full border border-white/20 bg-white/5" />

      <div className="absolute inset-0" style={PAPER_TEXTURE} aria-hidden />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 90% 75% at 72% 18%, ${gold}, transparent 52%)`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 115% 95% at 50% 100%, rgba(42,32,24,0.28) 0%, transparent 52%), linear-gradient(180deg, transparent 45%, rgba(42,32,24,0.15) 100%)",
        }}
      />

      {premium && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(0,0,0,0.08) 100%)",
          }}
        />
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center",
          variant === "manuscript" ? "opacity-0" : "opacity-[0.35]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl backdrop-blur-[2px]",
            isLightBg ? "bg-white/25 ring-1 ring-[#8b7355]/15" : "bg-white/10 ring-1 ring-white/20",
            aspect === "thumb" ? "p-2" : "p-3.5",
          )}
        >
          <Icon className={cn(iconSize, iconColor, "drop-shadow-sm")} strokeWidth={1.2} />
        </div>
      </div>

      {variant === "manuscript" && (
        <div className="pointer-events-none absolute bottom-3 right-3 opacity-30">
          <BookOpen className={cn(iconColor, aspect === "thumb" ? "h-5 w-5" : "h-7 w-7")} strokeWidth={1.25} />
        </div>
      )}

      {children}
    </div>
  );
}
