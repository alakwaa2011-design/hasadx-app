/**
 * CreditsChip — compact header chip showing the teacher's نقاط حصاد balance.
 * Clicking navigates to /teacher/credits (no checkout, no dialog).
 *
 * States:
 *   loading  → Sparkles icon + pulsing skeleton
 *   error    → Sparkles icon only (chip still links to /teacher/credits)
 *   success  → Sparkles icon + "400 نقطة"
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface BalanceSummary {
  balance: number;
  freeBalance: number;
  paidBalance: number;
  promoBalance: number;
  earnedBalance: number;
  subscriptionBalance: number;
}

/** Single query key for the teacher's Hasad credits balance — every surface
 *  (header chip, credits page, activity creator) must read through it. */
export const CREDITS_BALANCE_QUERY_KEY = ["credits-chip-balance"] as const;

const num = (v: unknown) => (typeof v === "number" ? v : 0);

/**
 * Shared balance source — same query key as the header chip, so the sidebar
 * badge and the chip share one cache entry (no duplicate requests).
 */
export function useCreditsBalance() {
  return useQuery<BalanceSummary | null, Error>({
    queryKey: CREDITS_BALANCE_QUERY_KEY,
    queryFn: async (): Promise<BalanceSummary | null> => {
      const res = await fetch(`${API_BASE}/api/credits/me`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("credits");
      const json = await res.json();
      return {
        balance: num(json.balance),
        freeBalance: num(json.freeBalance),
        paidBalance: num(json.paidBalance),
        promoBalance: num(json.promoBalance),
        earnedBalance: num(json.earnedBalance),
        subscriptionBalance: num(json.subscriptionBalance),
      };
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Central refresh: invalidates the shared balance query so every mounted
 * surface refetches from the server. Call after any AI operation settles
 * (success OR failure — refunds change the balance too). The server is the
 * only source of truth; never compute a deduction client-side.
 */
export function useRefreshCreditsBalance() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CREDITS_BALANCE_QUERY_KEY });
  }, [queryClient]);
}

export function CreditsChip() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const { data, isLoading } = useCreditsBalance();

  const fmt = (n: number) => n.toLocaleString(isAr ? "ar-EG-u-nu-latn" : "en-US");

  return (
    <button
      type="button"
      onClick={() => setLocation("/teacher/credits")}
      aria-label={isAr ? "نقاط حصاد — انتقل إلى مركز النقاط" : "Hasad credits — go to the credits center"}
      title={isAr ? "نقاط حصاد" : "Hasad credits"}
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
            {isAr ? "نقطة" : "credits"}
          </span>
        </span>
      ) : null /* error: icon only, chip still clickable */}
    </button>
  );
}
