import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import {
  Sparkles,
  Check,
  Loader2,
  Star,
  Zap,
  BadgeDollarSign,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  ShoppingCart,
  Coins,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { useCreditsBalance } from "@/components/credits-chip";

const API = import.meta.env.VITE_API_URL || "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

/* هوية حصاد للصفحة — أخضر داكن وذهبي هادئ */
const HASAD_GREEN = "#0b4b35";
const HASAD_GOLD = "#f1c657";

interface Plan {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  priceMinor: number;
  currency: string;
  billingPeriodDays: number;
  monthlyCredits: number;
  rolloverCap: number | null;
}

interface CurrentSub {
  plan_code: string;
  status: string;
  payment_status: string;
  current_period_end: string | null;
  cancelled_at: string | null;
}

interface Pkg {
  id: number;
  name: string;
  description: string | null;
  priceUsdCents: number;
  currency: string;
  credits: number;
  isFeatured: boolean;
}

const PLAN_ICONS: Record<string, any> = {
  free: BadgeDollarSign,
  basic: Star,
  pro: Zap,
};

/** يعرض نص الميزة مع إبراز "20%" بالذهبي */
function GoldHighlight({ text }: { text: string }) {
  const parts = text.split("20%");
  if (parts.length === 1) return <span>{text}</span>;
  return (
    <span>
      {parts[0]}
      <span className="font-black" style={{ color: HASAD_GOLD }}>20%</span>
      {parts[1]}
    </span>
  );
}

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { t, lang, dir } = useI18n();
  const p = t.pricing;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [pricingPageVisible, setPricingPageVisible] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [purchasesEnabled, setPurchasesEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  // Shared react-query cache with the header CreditsChip — no duplicate request.
  const { data: creditsData } = useCreditsBalance();
  const balance = creditsData?.balance ?? null;

  // Keep Arabic copy/RTL, but always render numeric values with Latin digits.
  const fmt = (n: number) => n.toLocaleString("en-US");
  const dateLocale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  // Value-first copy: short taglines + only actually-implemented facts.
  const PLAN_TAGLINES: Record<string, string> = {
    basic: p.basicTagline,
    pro: p.proTagline,
  };
  const PLAN_FEATURES: Record<string, string[]> = {
    free: [p.freeAlwaysFree],
    basic: [p.basicSmartSlides, p.basicVideo, p.basicClasses],
    pro: [],
  };
  type ProFeatureItem = { text: string; highlight?: boolean; tooltip?: { title: string; body: string } };
  const PRO_FEATURES: ProFeatureItem[] = [
    { text: p.proSavings20, highlight: true, tooltip: { title: p.proSavingsTooltipTitle, body: p.proSavingsTooltipBody } },
    { text: p.proBasicAll },
    { text: p.proSlidesAdvanced },
    { text: p.proAdvancedReports },
    { text: p.proExport },
  ];

  useEffect(() => {
    Promise.all([
      apiFetch("/api/subscriptions/plans").then((r) => r.json()),
      apiFetch("/api/subscriptions/me").then((r) => r.json()),
      apiFetch("/api/credits/packages").then((r) => r.json()).catch(() => ({ packages: [] })),
    ])
      .then(([plansData, subData, pkgs]) => {
        setPlans(plansData.plans ?? []);
        setPricingPageVisible(plansData.pricingPageVisible === true);
        setPaymentsEnabled(plansData.paymentsEnabled === true);
        setCurrentSub(subData.subscription ?? null);
        setPackages(pkgs.packages ?? []);
        setPurchasesEnabled(pkgs.purchasesEnabled !== false);
      })
      .catch(() => toast(p.loadError, { className: "text-red-500" }))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planCode: string) => {
    setCheckingOut(planCode);
    try {
      const r = await apiFetch("/api/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).message || p.checkoutError);
      }
      const { checkoutUrl } = await r.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
      setCheckingOut(null);
    }
  };

  const handleBuyPack = async (pkg: Pkg) => {
    setBuyingId(pkg.id);
    try {
      const r = await apiFetch("/api/credits/checkout", {
        method: "POST",
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).message || p.checkoutError);
      }
      const { checkoutUrl } = await r.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
      setBuyingId(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const r = await apiFetch("/api/subscriptions/cancel", { method: "POST" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).message || p.cancelError);
      }
      toast.success(p.cancelSuccess);
      const subData = await apiFetch("/api/subscriptions/me").then((r) => r.json());
      setCurrentSub(subData.subscription ?? null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const openCompare = () => {
    setCompareOpen(true);
    // بعد الفتح، مرّر إلى الجدول
    setTimeout(() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const currentPlanCode = currentSub?.plan_code ?? "free";
  const isActive = currentSub?.status === "active" && currentSub?.payment_status === "active";
  const ChevronIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  if (!loading && !pricingPageVisible) {
    return (
      <Layout>
        <div dir={dir} className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="rounded-[2rem] border border-border/60 bg-white p-12 shadow-sm">
            <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="text-emerald-700" size={30} />
            </div>
            <h1 className="text-2xl font-extrabold text-emerald-950">{p.unavailableTitle}</h1>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-md mx-auto">{p.unavailableBody}</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Ensure deterministic order: free → basic → pro
  const orderedPlans = ["free", "basic", "pro"]
    .map((code) => plans.find((pl) => pl.code === code))
    .filter(Boolean) as Plan[];

  const orderedPacks = [...packages].sort((a, b) => a.credits - b.credits);

  const packBadge = (pkg: Pkg): string | null => {
    if (pkg.credits === 300) return p.badgeBalanced;
    if (pkg.credits === 600) return p.badgeBestRate;
    return null;
  };

  return (
    <Layout>
      <div dir={dir} className="max-w-5xl mx-auto space-y-10 pb-20 pt-6 px-4">
        {/* ── 1) هيدر أخضر مختصر ── */}
        <header
          className="rounded-[2rem] px-6 py-7 md:px-10 md:py-8 shadow-lg text-white flex flex-col md:flex-row md:items-center gap-6"
          style={{ backgroundColor: HASAD_GREEN }}
        >
          <div className="flex-1 space-y-3">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{p.heroTitle}</h1>
            <p className="text-white/75 text-sm md:text-base leading-relaxed">{p.heroSubtitle}</p>
            <button
              type="button"
              onClick={openCompare}
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {p.compareAll}
              <ChevronDown size={15} className={compareOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
          {/* بطاقة الرصيد المصغرة */}
          <button
            type="button"
            onClick={() => setLocation("/teacher/credits")}
            data-testid="pricing-balance-line"
            className="shrink-0 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition-colors px-5 py-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-white/70">
              <Coins size={15} style={{ color: HASAD_GOLD }} />
              {p.availablePointsLabel}
            </span>
            <span className="mt-1 block text-2xl font-black tabular-nums" style={{ color: HASAD_GOLD }}>
              {balance != null ? fmt(balance) : "—"}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold text-white/60 underline underline-offset-4">
              {p.managePoints}
            </span>
          </button>
        </header>

        {/* ── 2) بطاقات الاشتراك ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[480px] rounded-3xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4">
            {orderedPlans.map((plan) => {
              const Icon = PLAN_ICONS[plan.code] ?? Sparkles;
              const isCurrent = plan.code === currentPlanCode && isActive;
              const isPro = plan.code === "pro";
              const isBasic = plan.code === "basic";
              const isFree = plan.code === "free";
              const priceUSD = (plan.priceMinor / 100).toFixed(2);
              const features = PLAN_FEATURES[plan.code] ?? [];
              const planName = lang === "ar" ? plan.nameAr : plan.nameEn;

              return (
                <div
                  key={plan.code}
                  className={[
                    "relative flex flex-col p-8 rounded-[2rem] transition-all duration-300",
                    isPro
                      ? "shadow-2xl text-white transform md:-translate-y-4 md:hover:-translate-y-5 border-2"
                      : isCurrent
                      ? "border-2 border-emerald-500 shadow-lg bg-white"
                      : isBasic
                      ? "border border-amber-100/80 shadow-sm bg-[#fffdf6] hover:border-amber-200 hover:shadow-md"
                      : "border border-border/80 shadow-sm bg-white hover:border-emerald-200 hover:shadow-md",
                  ].join(" ")}
                  style={isPro ? { backgroundColor: HASAD_GREEN, borderColor: "#0a3f2d" } : undefined}
                >
                  {isPro && (
                    <div className="absolute -top-4 right-0 left-0 flex justify-center">
                      <span
                        className="text-sm font-extrabold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-md"
                        style={{ backgroundColor: HASAD_GOLD, color: "#3d2e00" }}
                      >
                        <Zap size={14} className="shrink-0" fill="currentColor" />
                        <span>
                          {p.proSavingsBadge.split("20%")[0]}
                          <span className="font-black">20%</span>
                          {p.proSavingsBadge.split("20%")[1]}
                        </span>
                      </span>
                    </div>
                  )}
                  {isCurrent && !isPro && (
                    <div className="absolute -top-4 right-0 left-0 flex justify-center">
                      <span className="bg-emerald-600 text-white text-sm font-extrabold px-4 py-1.5 rounded-full shadow-md">
                        {p.currentPlan}
                      </span>
                    </div>
                  )}

                  {/* رأس البطاقة — في المنتصف */}
                  <div className="flex flex-col items-center text-center mb-6 mt-2">
                    <div
                      className={[
                        "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-inner",
                        isPro ? "bg-white/10 border border-white/20" : "bg-emerald-50 border border-emerald-100",
                      ].join(" ")}
                    >
                      <Icon size={28} style={isPro ? { color: HASAD_GOLD } : undefined} className={isPro ? "" : "text-emerald-700"} />
                    </div>
                    {isPro && (
                      <span className="text-[12px] font-bold tracking-wide mb-1" style={{ color: HASAD_GOLD }}>
                        {p.proKicker}
                      </span>
                    )}
                    <h3 className={["font-extrabold text-2xl mb-1", isPro ? "text-white" : "text-emerald-950"].join(" ")}>
                      {planName}
                    </h3>
                    {isCurrent && isPro && (
                      <span className="mt-1 mb-1 inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 text-white/90 text-[11px] font-bold px-3 py-0.5">
                        <Check size={12} style={{ color: HASAD_GOLD }} />
                        {p.currentPlan}
                      </span>
                    )}
                    {PLAN_TAGLINES[plan.code] && (
                      <p className={["text-sm font-medium leading-snug", isPro ? "text-white/70" : "text-muted-foreground"].join(" ")}>
                        {PLAN_TAGLINES[plan.code]}
                      </p>
                    )}
                  </div>

                  {/* السعر — في المنتصف */}
                  <div
                    className="text-center mb-8 pb-8 border-b border-dashed border-border/50"
                    style={{ borderColor: isPro ? "rgba(255,255,255,0.15)" : undefined }}
                  >
                    {isFree ? (
                      <div className="h-[48px] flex items-center justify-center">
                        <span className="text-4xl font-black">{p.freePlanLabel}</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-center gap-1.5 h-[48px]">
                        <span className="text-2xl font-bold opacity-60 self-start mt-1">$</span>
                        <span className={["text-5xl font-black tracking-tight", isPro ? "text-white" : "text-emerald-900"].join(" ")}>
                          {priceUSD}
                        </span>
                        <span className={isPro ? "text-white/60 font-medium" : "text-muted-foreground font-medium"}>
                          {p.perMonth}
                        </span>
                      </div>
                    )}

                    <div className={["mt-3 text-sm font-medium", isPro ? "text-emerald-100" : "text-emerald-700"].join(" ")}>
                      {isFree ? (
                        <span>{fmt(plan.monthlyCredits)} {p.freeWelcomePoints}</span>
                      ) : plan.rolloverCap ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{fmt(plan.monthlyCredits)} {p.pointsMonthly}</span>
                          <span className={isPro ? "text-white/50 text-xs" : "text-muted-foreground text-xs"}>
                            {p.rolloverUntil} {fmt(plan.rolloverCap)}
                          </span>
                        </div>
                      ) : (
                        <span>{fmt(plan.monthlyCredits)} {p.pointsMonthly} ({p.noRollover})</span>
                      )}
                    </div>
                  </div>

                  {/* قائمة المزايا — RTL محاذاة لليمين */}
                  <TooltipProvider delayDuration={100}>
                    <ul className="space-y-3.5 flex-1 mb-8 text-start">
                      {isPro
                        ? PRO_FEATURES.map((f, i) => (
                            <li
                              key={i}
                              className={[
                                "flex items-start gap-3",
                                f.highlight
                                  ? "font-bold text-[15px] bg-white/5 rounded-xl p-3 border border-white/10 -mx-3"
                                  : "text-[15px] font-medium",
                              ].join(" ")}
                            >
                              {f.highlight ? (
                                <Zap size={18} className="shrink-0 mt-0.5" style={{ color: HASAD_GOLD }} fill="currentColor" />
                              ) : (
                                <Check size={18} className="shrink-0 mt-0.5" style={{ color: HASAD_GOLD }} />
                              )}
                              <span className="text-white/90 flex items-center gap-1.5 flex-wrap">
                                <GoldHighlight text={f.text} />
                                {f.tooltip && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help" tabIndex={0}>
                                        <Info size={15} className="text-white/50 hover:text-white/90 shrink-0" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="bottom"
                                      className="max-w-[270px] p-4 bg-emerald-950 border-emerald-800 text-white shadow-xl rounded-xl"
                                      dir={dir}
                                    >
                                      <p className="font-bold text-sm mb-1.5" style={{ color: HASAD_GOLD }}>{f.tooltip.title}</p>
                                      <p className="text-xs leading-relaxed opacity-90">{f.tooltip.body}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </span>
                            </li>
                          ))
                        : features.map((f, i) => (
                            <li key={i} className="flex items-start gap-3 text-[15px] font-medium text-foreground/80">
                              <Check size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                              <span className="leading-snug">{f}</span>
                            </li>
                          ))}
                    </ul>
                  </TooltipProvider>

                  {/* CTA — في المنتصف */}
                  <div className="mt-auto pt-4">
                    {isCurrent && isFree ? (
                      <Button variant="outline" className="w-full bg-emerald-50/50 text-emerald-800 border-emerald-200" disabled>
                        <Check size={16} className="mr-2 rtl:ml-2 rtl:mr-0" /> {p.starterPlan}
                      </Button>
                    ) : isCurrent ? (
                      <div className="space-y-3">
                        <Button
                          variant={isPro ? "outline" : "default"}
                          className={["w-full", isPro ? "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white" : ""].join(" ")}
                          onClick={() => setLocation("/teacher/credits")}
                        >
                          {p.manageSubscription}
                        </Button>
                        {!currentSub?.cancelled_at && (
                          <div className="text-center">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className={[
                                    "text-sm underline underline-offset-4 transition-colors font-medium",
                                    isPro ? "text-white/50 hover:text-white/90" : "text-muted-foreground hover:text-red-600",
                                  ].join(" ")}
                                >
                                  {p.cancelSubscription}
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir={dir} className="sm:max-w-md">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-xl text-red-600">{p.confirmCancelTitle}</AlertDialogTitle>
                                  <AlertDialogDescription className="text-base mt-2 space-y-3 leading-relaxed">
                                    <span className="block font-medium text-foreground">
                                      {currentSub?.current_period_end
                                        ? `${p.cancelledUntil} ${new Date(currentSub.current_period_end).toLocaleDateString(
                                            dateLocale,
                                            { year: "numeric", month: "long", day: "numeric" }
                                          )}.`
                                        : p.cancelledFallback}
                                    </span>
                                    <span className="block text-sm">{p.cancelNote}</span>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-3">
                                  <AlertDialogCancel className="mt-0">{p.back}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => { e.preventDefault(); handleCancel(); }}
                                    disabled={cancelling}
                                    className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]"
                                  >
                                    {cancelling ? <Loader2 size={16} className="animate-spin" /> : p.confirmCancel}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    ) : isFree ? (
                      <Button variant="outline" className="w-full bg-muted/30" disabled>
                        {p.starterPlan}
                      </Button>
                    ) : !paymentsEnabled ? (
                      <div className="w-full text-center p-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground font-medium flex items-center justify-center gap-2">
                        <AlertCircle size={16} className="opacity-70" />
                        {p.paymentsDisabled}
                      </div>
                    ) : (
                      <Button
                        variant="default"
                        className={["w-full group font-bold", isPro ? "border-0 hover:opacity-90" : ""].join(" ")}
                        style={isPro ? { backgroundColor: HASAD_GOLD, color: "#3d2e00" } : undefined}
                        onClick={() => handleUpgrade(plan.code)}
                        disabled={checkingOut !== null}
                      >
                        {checkingOut === plan.code ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> {p.redirecting}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 font-bold text-[15px]">
                            {plan.code === "basic" ? p.basicCta : p.proCta}
                            <ChevronIcon size={16} className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 3) جدول المقارنة (قابل للفتح/الإغلاق) ── */}
        {!loading && orderedPlans.length > 0 && (
          <div ref={compareRef} className="scroll-mt-24">
            <div className="text-center">
              <button
                type="button"
                onClick={() => setCompareOpen((o) => !o)}
                aria-expanded={compareOpen}
                data-testid="compare-toggle"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900 border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 rounded-xl px-5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {p.compareAll}
                <ChevronDown size={16} className={["transition-transform", compareOpen ? "rotate-180" : ""].join(" ")} />
              </button>
            </div>
            {compareOpen && (
              <div className="mt-6 bg-white rounded-2xl border border-border shadow-sm overflow-hidden" data-testid="compare-table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead style={{ backgroundColor: HASAD_GREEN }} className="text-white">
                      <tr>
                        <th className="py-3.5 px-5 font-bold text-start">{p.compareFeatureCol}</th>
                        {orderedPlans.map((pl) => (
                          <th key={pl.code} className="py-3.5 px-5 font-bold text-center">
                            {lang === "ar" ? pl.nameAr : pl.nameEn}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      <tr>
                        <td className="py-3.5 px-5 font-semibold text-start">{p.comparePriceRow}</td>
                        {orderedPlans.map((pl) => (
                          <td key={pl.code} className="py-3.5 px-5 text-center font-bold tabular-nums">
                            {pl.priceMinor === 0 ? p.freePlanLabel : `$${(pl.priceMinor / 100).toFixed(2)}`}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3.5 px-5 font-semibold text-start">{p.comparePointsRow}</td>
                        {orderedPlans.map((pl) => (
                          <td key={pl.code} className="py-3.5 px-5 text-center tabular-nums">
                            {pl.code === "free"
                              ? `${fmt(pl.monthlyCredits)} (${p.freeWelcomePoints})`
                              : fmt(pl.monthlyCredits)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3.5 px-5 font-semibold text-start">{p.compareRolloverRow}</td>
                        {orderedPlans.map((pl) => (
                          <td key={pl.code} className="py-3.5 px-5 text-center tabular-nums">
                            {pl.rolloverCap ? `${p.rolloverUntil} ${fmt(pl.rolloverCap)}` : "—"}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3.5 px-5 font-semibold text-start">{p.compareSavingsRow}</td>
                        {orderedPlans.map((pl) => (
                          <td key={pl.code} className="py-3.5 px-5 text-center">
                            {pl.code === "pro" ? (
                              <Check size={18} className="inline text-emerald-600" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4) مركز نقاط حصاد ── */}
        {!loading && orderedPacks.length > 0 && (
          <section
            className="rounded-[2rem] border border-amber-100/70 px-6 py-10 md:px-10"
            style={{ backgroundColor: "#fdfaf1" }}
            data-testid="packs-section"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-emerald-950">{p.packsTitle}</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{p.packsSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {orderedPacks.map((pkg) => {
                const badge = packBadge(pkg);
                return (
                  <div
                    key={pkg.id}
                    className="relative flex flex-col items-center text-center bg-white rounded-2xl border border-border/70 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all px-6 pt-8 pb-6"
                  >
                    {badge && (
                      <span className="absolute -top-3 inline-flex items-center rounded-full bg-emerald-600 text-white text-[11px] font-extrabold px-3 py-1 shadow">
                        {badge}
                      </span>
                    )}
                    <span className="text-5xl font-black tracking-tight text-emerald-900 tabular-nums">{fmt(pkg.credits)}</span>
                    <span className="mt-1 text-sm font-bold text-emerald-700">{p.packPointUnit}</span>
                    {pkg.description && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{pkg.description}</p>
                    )}
                    <span className="mt-4 text-2xl font-extrabold text-emerald-950 tabular-nums">
                      ${(pkg.priceUsdCents / 100).toFixed(2)}
                    </span>
                    <div className="mt-5 w-full">
                      {!paymentsEnabled || !purchasesEnabled ? (
                        <div className="w-full text-center p-2.5 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
                          <AlertCircle size={14} className="opacity-70" />
                          {p.paymentsDisabled}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50 font-bold"
                          onClick={() => handleBuyPack(pkg)}
                          disabled={buyingId !== null}
                        >
                          {buyingId === pkg.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 size={15} className="animate-spin" /> {p.redirecting}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <ShoppingCart size={15} />
                              {p.packBuyWord} {fmt(pkg.credits)} {p.packPointsWord}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-8 text-center text-sm font-medium text-muted-foreground leading-relaxed" data-testid="packs-policy">
              {p.packsPolicy}
            </p>
          </section>
        )}

        {/* ── 5) دعوة ختامية خفيفة ── */}
        {!loading && (
          <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-3 flex-wrap">
            <span className="font-semibold">{p.notSureTitle}</span>
            <button
              type="button"
              onClick={openCompare}
              className="underline underline-offset-4 font-bold text-emerald-800 hover:text-emerald-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
            >
              {p.notSureCta}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
