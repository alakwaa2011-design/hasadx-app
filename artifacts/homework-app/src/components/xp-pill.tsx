/**
 * XP Pill — compact navbar badge showing the teacher's current level and XP
 * progress. Clicking it navigates to the full achievements page.
 *
 * Design inspiration: Duolingo streak / GitHub contribution counter.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Flame } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface XpStats {
  totalXp: number;
  level: number;
  levelNameAr: string;
  nextLevelMinXp: number | null;
  xpToNext: number;
  currentStreakDays: number;
}

const LEVEL_ICONS = ["🌱", "📖", "✨", "🎯", "🚀", "🏆"];

function levelIcon(level: number) {
  return LEVEL_ICONS[Math.min(level - 1, LEVEL_ICONS.length - 1)];
}

function xpProgress(stats: XpStats): number {
  if (!stats.nextLevelMinXp) return 100;
  const levelStarts = [0, 250, 750, 2000, 5000, 12000];
  const currentLevelMin = levelStarts[Math.min(stats.level - 1, levelStarts.length - 1)] ?? 0;
  const span = stats.nextLevelMinXp - currentLevelMin;
  const earned = stats.totalXp - currentLevelMin;
  if (span <= 0) return 100;
  return Math.min(100, Math.round((earned / span) * 100));
}

export function XpPill() {
  const [, setLocation] = useLocation();

  const { data } = useQuery<XpStats>({
    queryKey: ["xp-pill"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/me/achievements`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("xp");
      const json = await res.json();
      return json.stats as XpStats;
    },
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  const pct = xpProgress(data);
  const icon = levelIcon(data.level);

  return (
    <button
      type="button"
      onClick={() => setLocation("/teacher/achievements")}
      title={`${data.levelNameAr} · ${data.totalXp} نقطة`}
      className="hidden lg:flex items-center gap-2 rounded-full px-2.5 py-1.5 transition-all hover:brightness-110 active:scale-95"
      style={{
        background: "rgba(201,160,80,0.12)",
        border: "1px solid rgba(201,160,80,0.45)",
      }}
    >
      {/* Level badge */}
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
        style={{
          background: "linear-gradient(135deg,#E8A80E,#C9A050)",
          color: "#1E4D35",
        }}
      >
        {data.level}
      </span>

      {/* Label + bar */}
      <span className="flex flex-col gap-0.5" style={{ minWidth: 72 }}>
        <span
          className="text-[10px] font-black leading-none whitespace-nowrap"
          style={{ color: "#F5C842" }}
        >
          {icon} {data.levelNameAr}
        </span>
        {/* Progress track */}
        <span
          className="block rounded-full overflow-hidden"
          style={{ height: 3, background: "rgba(255,255,255,0.12)", width: "100%" }}
        >
          <span
            className="block h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg,#E8A80E,#F5C842)",
            }}
          />
        </span>
      </span>

      {/* Streak flame — only if >0 */}
      {data.currentStreakDays > 0 && (
        <span
          className="flex items-center gap-0.5 text-[10px] font-black shrink-0"
          style={{ color: "#fb923c" }}
        >
          <Flame className="w-3 h-3" />
          {data.currentStreakDays}
        </span>
      )}
    </button>
  );
}
