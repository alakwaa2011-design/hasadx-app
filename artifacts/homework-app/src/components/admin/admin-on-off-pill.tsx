import { cn } from "@/lib/utils";

export type AdminLang = "ar" | "en";

interface AdminOnOffPillProps {
  on: boolean;
  lang: AdminLang;
  /** Shows amber “always on” — cannot be turned off from UI */
  lockedOn?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Clear ON/OFF badge for admin toggles (replaces ambiguous toggle icons).
 */
export function AdminOnOffPill({ on, lang, lockedOn, size = "md", className }: AdminOnOffPillProps) {
  const ar = lang === "ar";
  const active = lockedOn || on;
  const label = lockedOn
    ? ar
      ? "دائمًا مفعّل"
      : "Always on"
    : active
      ? ar
        ? "مفعّل"
        : "On"
      : ar
        ? "معطّل"
        : "Off";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-black shrink-0 tabular-nums select-none",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        lockedOn
          ? "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-100"
          : active
            ? "border-emerald-400 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
            : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          lockedOn ? "bg-amber-500" : active ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500",
        )}
      />
      {label}
    </span>
  );
}
