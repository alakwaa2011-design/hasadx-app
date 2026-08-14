import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
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
  AlertCircle
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

const API = import.meta.env.VITE_API_URL || "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

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

const PLAN_ICONS: Record<string, any> = {
  free:  BadgeDollarSign,
  basic: Star,
  pro:   Zap,
};

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const { t, lang, dir } = useI18n();
  const p = t.pricing;
  const [plans, setPlans]             = useState<Plan[]>([]);
  const [currentSub, setCurrentSub]   = useState<CurrentSub | null>(null);
  const [pricingPageVisible, setPricingPageVisible] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading]         = useState(true);
  
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [cancelling, setCancelling]   = useState(false);

  // Keep Arabic copy/RTL, but always render numeric values with Latin digits.
  const fmt = (n: number) => n.toLocaleString("en-US");
  const dateLocale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  // Per-plan differentiating features only (price section already shows credits + rollover)
  const PLAN_FEATURES: Record<string, string[]> = {
    free:  [p.freeAiNote],
    basic: [p.basicReports, p.basicParents],
    pro:   [],
  };
  type ProFeatureItem = { text: string; highlight?: boolean; tooltip?: { title: string; body: string } };
  const PRO_FEATURES: ProFeatureItem[] = [
    { text: p.proSavings20, highlight: true, tooltip: { title: p.proSavingsTooltipTitle, body: p.proSavingsTooltipBody } },
    { text: p.proBasicAll },
  ];

  useEffect(() => {
    Promise.all([
      apiFetch("/api/subscriptions/plans").then((r) => r.json()),
      apiFetch("/api/subscriptions/me").then((r) => r.json()),
    ])
      .then(([plansData, subData]) => {
        setPlans(plansData.plans ?? []);
        setPricingPageVisible(plansData.pricingPageVisible === true);
        setPaymentsEnabled(plansData.paymentsEnabled === true);
        setCurrentSub(subData.subscription ?? null);
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

  const currentPlanCode = currentSub?.plan_code ?? "free";
  const isActive        = currentSub?.status === "active" && currentSub?.payment_status === "active";
  const ChevronIcon     = dir === "rtl" ? ChevronLeft : ChevronRight;

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

  return (
    <Layout>
      <div dir={dir} className="max-w-5xl mx-auto space-y-12 pb-20 pt-6">
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-bold px-4 py-1.5 rounded-full mb-2 shadow-sm">
            <Sparkles size={16} className="text-[#E8B84B]" />
            {p.pageTitle}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-emerald-950">{p.pageHeading}</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">{p.pageSubtitle}</p>
        </div>

        {/* Plan cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[1, 2, 3].map(i => <div key={i} className="h-[500px] rounded-3xl bg-muted/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {orderedPlans.map((plan) => {
              const Icon      = PLAN_ICONS[plan.code] ?? Sparkles;
              const isCurrent = plan.code === currentPlanCode && isActive;
              const isPro     = plan.code === "pro";
              const isFree    = plan.code === "free";
              const priceUSD  = (plan.priceMinor / 100).toFixed(2);
              const features  = PLAN_FEATURES[plan.code] ?? [];
              const planName  = lang === "ar" ? plan.nameAr : plan.nameEn;

              return (
                <div
                  key={plan.code}
                  className={[
                    "relative flex flex-col p-8 rounded-[2rem] transition-all duration-300",
                    isPro
                      ? "border-2 border-emerald-800 shadow-2xl bg-emerald-900 text-white transform md:-translate-y-4 md:hover:-translate-y-5"
                      : isCurrent
                      ? "border-2 border-emerald-500 shadow-lg bg-white"
                      : "border border-border/80 shadow-sm bg-white/60 hover:border-emerald-200 hover:bg-white hover:shadow-md",
                  ].join(" ")}
                >
                  {isPro && (
                    <div className="absolute -top-4 right-0 left-0 flex justify-center">
                      <span className="bg-[#E8B84B] text-amber-950 text-sm font-extrabold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                        <Zap size={14} className="shrink-0" fill="currentColor" />
                        {p.proSavingsBadge}
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

                  {/* Plan name + icon */}
                  <div className="flex flex-col items-center text-center mb-6 mt-2">
                    <div
                      className={[
                        "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-inner",
                        isPro ? "bg-white/10 border border-white/20" : "bg-emerald-50 border border-emerald-100",
                      ].join(" ")}
                    >
                      <Icon size={28} className={isPro ? "text-[#E8B84B]" : "text-emerald-700"} />
                    </div>
                    <h3 className={["font-extrabold text-2xl mb-1", isPro ? "text-white" : "text-emerald-950"].join(" ")}>
                      {planName}
                    </h3>
                  </div>

                  {/* Price */}
                  <div className="text-center mb-8 pb-8 border-b border-dashed border-border/50" style={{ borderColor: isPro ? 'rgba(255,255,255,0.15)' : undefined }}>
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
                    
                    <div className={["mt-3 text-sm font-medium", isPro ? "text-emerald-200" : "text-emerald-700"].join(" ")}>
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

                  {/* Features list */}
                  <TooltipProvider delayDuration={100}>
                    <ul className="space-y-3.5 flex-1 mb-8">
                      {isPro
                        ? PRO_FEATURES.map((f, i) => (
                            <li
                              key={i}
                              className={[
                                "flex items-start gap-3",
                                f.highlight
                                  ? "text-[#E8B84B] font-bold text-[15px] bg-white/5 rounded-xl p-3 border border-white/10 -mx-3"
                                  : "text-[15px] font-medium",
                              ].join(" ")}
                            >
                              {f.highlight
                                ? <Zap size={18} className="shrink-0 mt-0.5 text-[#E8B84B]" fill="currentColor" />
                                : <Check size={18} className="shrink-0 mt-0.5 text-[#E8B84B]" />
                              }
                              <span className={f.highlight ? "text-[#E8B84B] flex items-center gap-1.5 flex-wrap" : "text-white/90 flex items-center gap-1.5 flex-wrap"}>
                                <span>{f.text}</span>
                                {f.tooltip && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-help"><Info size={15} className={f.highlight ? "text-[#E8B84B]/60 hover:text-[#E8B84B] shrink-0" : "text-white/50 hover:text-white/90 shrink-0"} /></span>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="bottom"
                                      className="max-w-[260px] p-4 bg-emerald-950 border-emerald-800 text-white shadow-xl rounded-xl"
                                      dir={dir}
                                    >
                                      <p className="font-bold text-sm mb-1.5 text-[#E8B84B]">{f.tooltip.title}</p>
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

                  {/* CTA */}
                  <div className="mt-auto pt-4">
                    {isCurrent && isFree ? (
                      /* Free is current plan — just show a label */
                      <Button variant="outline" className="w-full bg-emerald-50/50 text-emerald-800 border-emerald-200" disabled>
                        <Check size={16} className="mr-2 rtl:ml-2 rtl:mr-0" /> {p.starterPlan}
                      </Button>
                    ) : isCurrent ? (
                      /* Paid plan is current */
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
                      /* Non-current free plan slot */
                      <Button variant="outline" className="w-full bg-muted/30" disabled>
                        {p.starterPlan}
                      </Button>
                    ) : !paymentsEnabled ? (
                      /* Payments disabled */
                      <div className="w-full text-center p-3 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground font-medium flex items-center justify-center gap-2">
                        <AlertCircle size={16} className="opacity-70" />
                        {p.paymentsDisabled}
                      </div>
                    ) : (
                      <Button
                        variant={isPro ? "outline" : "default"}
                        className={["w-full group", isPro ? "bg-white text-emerald-950 border-white hover:bg-emerald-50 hover:text-emerald-950" : ""].join(" ")}
                        onClick={() => handleUpgrade(plan.code)}
                        disabled={checkingOut !== null}
                      >
                        {checkingOut === plan.code ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" /> {p.redirecting}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 font-bold text-[15px]">
                            {p.upgradePrefix} {planName}
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

      </div>

    </Layout>
  );
}
