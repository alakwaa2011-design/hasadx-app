/**
 * CreditsChip — compact header chip showing the teacher's نقاط حصاد balance.
 * Clicking navigates to /teacher/credits (no checkout, no dialog).
 *
 * States:
 *   loading  → Sparkles icon + pulsing skeleton
 *   error    → Sparkles icon only (chip still links to /teacher/credits)
 *   success  → Sparkles icon + "400 نقطة"
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface BalanceSummary {
  balance: number;
}

/**
 * Shared balance source — same query key as the header chip, so the sidebar
 * badge and the chip share one cache entry (no duplicate requests).
 */
export function useCreditsBalance() {
  return useQuery<BalanceSummary | null, Error>({
    queryKey: ["credits-chip-balance"],
    queryFn: async (): Promise<BalanceSummary | null> => {
      const res = await fetch(`${API_BASE}/api/credits/me`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("credits");
      const json = await res.json();
      return { balance: typeof json.balance === "number" ? json.balance : 0 };
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function CreditsChip() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useCreditsBalance();

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <button
      type="button"
      onClick={() => setLocation("/teacher/credits")}
      aria-label="نقاط حصاد — انتقل إلى مركز النقاط"
      title="نقاط حصاد"
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{
        background: "rgba(34, 87, 57, 0.55)",
        border: "1px solid rgba(201, 160, 80, 0.45)",
      }}
    >
      {/* Icon */}
      <Sparkles
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: "#E8B84B" }}
        aria-hidden
      />

      {/* Balance or skeleton */}
      {isLoading ? (
        /* Pulsing skeleton — neutral, no zero shown */
        <span
          className="inline-block w-8 h-2.5 rounded-full animate-pulse"
          style={{ background: "rgba(255,255,255,0.18)" }}
          aria-hidden
        />
      ) : data != null ? (
        /* Success: number + label */
        <span
          className="flex items-baseline gap-0.5 leading-none"
          style={{ color: "#F5F5F0" }}
        >
          <span className="text-[11px] font-black tabular-nums" style={{ color: "#E8B84B" }}>
            {fmt(data.balance)}
          </span>
          {/* Label hidden on very small breakpoints, shown md+ */}
          <span className="hidden md:inline text-[10px] font-semibold opacity-75 ms-0.5">
            نقطة
          </span>
        </span>
      ) : null /* error: icon only, chip still clickable */}
    </button>
  );
}
