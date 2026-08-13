/**
 * صفحة الاشتراكات الشهرية — /teacher/pricing
 *
 * تعرض بطاقات الباقات الثلاث (مجانية / Basic / Pro) مع أزرار الترقية.
 * الشراء عبر Lemon Squeezy checkout.
 */
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
  const { t, lang }     = useI18n();
  const p               = t.pricing;

  const [plans, setPlans]             = useState<Plan[]>([]);
  const [currentSub, setCurrentSub]   = useState<CurrentSub | null>(null);
  const [pricingPageVisible, setPricingPageVisible] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [cancelling, setCancelling]   = useState(false);

  // Feature lists built from locale keys
  const FREE_FOR_ALL = [p.freeCreate, p.freeGames, p.freeActivities, p.freeShare];
  const PLAN_FEATURES: Record<string, string[]> = {
    free:  [p.freeAiNote],
    basic: [p.basicAiTools, p.basicReports, p.basicParents],
    pro:   [], // Pro rendered separately via PRO_FEATURES with tooltip support
  };
  type ProFeatureItem = { text: string; tooltip?: { title: string; body: string; example: string } };
  const PRO_FEATURES: ProFeatureItem[] = [
    { text: p.proBasicAll },
    { text: p.proCredits600 },
    { text: p.proRollover1200 },
    { text: p.proSavings20, tooltip: { title: p.proSavingsTooltipTitle, body: p.proSavingsTooltipBody, example: p.proSavingsTooltipExample } },
    { text: p.proAdvancedReports },
  ];

  useEffect(() => {
    Promise.all([
      apiFetch("/api/subscriptions/plans").then((r) => r.json()),
      apiFetch("/api/subscriptions/me").then((r) => r.json()),
    ])
      .then(([plansData, subData]) => {
        setPlans(plansData.plans ?? []);
        setPricingPageVisible(plansData.pricingPageVisible === true);
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
    } finally {
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
      toast(p.cancelSuccess);
      const subData = await apiFetch("/api/subscriptions/me").then((r) => r.json());
      setCurrentSub(subData.subscription ?? null);
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setCancelling(false);
    }
  };

  const currentPlanCode = currentSub?.plan_code ?? "free";
  const isActive        = currentSub?.status === "active" && currentSub?.payment_status === "active";

  if (!loading && !pricingPageVisible) {
    return (
      <Layout>
        <div dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <Sparkles className="mx-auto mb-4 text-emerald-700" size={30} />
            <h1 className="text-2xl font-extrabold">{p.unavailableTitle}</h1>
            <p className="mt-3 text-muted-foreground">{p.unavailableBody}</p>
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
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center gap-2 bg-emerald-800/10 text-emerald-800 text-sm font-medium px-4 py-1.5 rounded-full mb-2">
            <Sparkles size={15} />
            {p.pageTitle}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{p.pageHeading}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{p.pageSubtitle}</p>
        </div>

        {/* Plan cards */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">{p.loading}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {orderedPlans.map((plan) => {
              const Icon      = PLAN_ICONS[plan.code] ?? Sparkles;
              const isCurrent = plan.code === currentPlanCode && isActive;
              const isPro     = plan.code === "pro";
              const isFree    = plan.code === "free";
              const priceUSD  = (plan.priceMinor / 100).toFixed(2);
              const features  = [...FREE_FOR_ALL, ...(PLAN_FEATURES[plan.code] ?? [])];
              const planName  = lang === "ar" ? plan.nameAr : plan.nameEn;

              return (
                <Card
                  key={plan.code}
                  className={[
                    "relative flex flex-col p-6 gap-4",
                    isPro
                      ? "border-2 border-emerald-700 shadow-lg bg-emerald-800 text-white"
                      : isCurrent
                      ? "border-2 border-emerald-600/50"
                      : "",
                  ].join(" ")}
                >
                  {isPro && (
                    <span className="absolute -top-3.5 right-5 bg-[#E8B84B] text-emerald-950 text-xs font-bold px-3 py-0.5 rounded-full">
                      {p.bestValue}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3.5 right-5 bg-emerald-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                      {p.currentPlan}
                    </span>
                  )}

                  {/* Plan name + icon */}
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isPro ? "bg-white/15" : "bg-emerald-800/10",
                      ].join(" ")}
                    >
                      <Icon size={20} className={isPro ? "text-[#E8B84B]" : "text-emerald-700"} />
                    </div>
                    <div>
                      <p className={["font-bold text-lg", isPro ? "text-white" : ""].join(" ")}>
                        {planName}
                      </p>
                      <p className={["text-xs", isPro ? "text-white/70" : "text-muted-foreground"].join(" ")}>
                        {lang === "ar" ? plan.nameEn : plan.nameAr}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    {isFree ? (
                      <p className="text-3xl font-extrabold">{p.freePlanLabel}</p>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className={["text-3xl font-extrabold", isPro ? "text-white" : "text-emerald-800"].join(" ")}>
                          ${priceUSD}
                        </span>
                        <span className={isPro ? "text-white/70 text-sm" : "text-muted-foreground text-sm"}>
                          {p.perMonth}
                        </span>
                      </div>
                    )}
                    <p className={["text-sm mt-0.5", isPro ? "text-white/70" : "text-muted-foreground"].join(" ")}>
                      {isFree
                        ? `${plan.monthlyCredits} ${p.freeWelcomePoints}`
                        : plan.rolloverCap
                          ? `${plan.monthlyCredits} ${p.pointsMonthly} · ${p.rolloverUntil} ${plan.rolloverCap}`
                          : `${plan.monthlyCredits} ${p.pointsMonthly} (${p.noRollover})`}
                    </p>
                  </div>

                  {/* Features list */}
                  <TooltipProvider delayDuration={100}>
                    <ul className="space-y-2 flex-1">
                      {isPro
                        ? PRO_FEATURES.map((f) => (
                            <li key={f.text} className="flex items-start gap-2 text-sm">
                              <Check size={15} className="shrink-0 mt-0.5 text-[#E8B84B]" />
                              <span className="text-white/90 flex items-center gap-1.5">
                                {f.text}
                                {f.tooltip && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info size={13} className="text-white/50 hover:text-white/90 cursor-help shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="bottom"
                                      className="max-w-[240px] p-3"
                                      dir={lang === "ar" ? "rtl" : "ltr"}
                                    >
                                      <p className="font-bold text-sm mb-1">{f.tooltip.title}</p>
                                      <p className="text-xs text-muted-foreground">{f.tooltip.body}</p>
                                      <p className="text-xs text-emerald-600 font-medium mt-1">{f.tooltip.example}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </span>
                            </li>
                          ))
                        : features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm">
                              <Check size={15} className="shrink-0 mt-0.5 text-emerald-700" />
                              <span>{f}</span>
                            </li>
                          ))}
                    </ul>
                  </TooltipProvider>

                  {/* CTA */}
                  <div className="mt-auto space-y-2">
                    {isCurrent && isFree ? (
                      /* Free is current plan — just show a label, no manage/cancel */
                      <Button variant="outline" className="w-full" disabled>
                        {p.currentPlan}
                      </Button>
                    ) : isCurrent ? (
                      /* Paid plan is current */
                      <>
                        <Button
                          variant="outline"
                          className={["w-full", isPro ? "bg-white/15 text-white border-white/30 hover:bg-white/25" : ""].join(" ")}
                          onClick={() => setLocation("/teacher/credits")}
                        >
                          {p.manageSubscription}
                        </Button>
                        {!currentSub?.cancelled_at && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className={[
                                  "w-full text-xs underline underline-offset-2 transition-colors",
                                  isPro
                                    ? "text-white/50 hover:text-white/80"
                                    : "text-muted-foreground hover:text-red-600",
                                ].join(" ")}
                              >
                                {p.cancelSubscription}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{p.confirmCancelTitle}</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2 text-right">
                                  <span className="block">
                                    {currentSub?.current_period_end
                                      ? `${p.cancelledUntil} ${new Date(currentSub.current_period_end).toLocaleDateString(
                                          lang === "ar" ? "ar-SA" : "en-US",
                                          { year: "numeric", month: "long", day: "numeric" }
                                        )}.`
                                      : p.cancelledFallback}
                                  </span>
                                  <span className="block">{p.cancelNote}</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{p.back}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleCancel}
                                  disabled={cancelling}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  {cancelling ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 size={14} className="animate-spin" />
                                      {p.cancelling}
                                    </span>
                                  ) : p.confirmCancel}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    ) : isFree ? (
                      /* Non-current free plan slot (shouldn't normally appear, but guard it) */
                      <Button variant="outline" className="w-full" disabled>
                        {p.starterPlan}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        className={["w-full", isPro ? "bg-white text-emerald-900 hover:bg-white/90" : ""].join(" ")}
                        onClick={() => handleUpgrade(plan.code)}
                        disabled={checkingOut !== null}
                      >
                        {checkingOut === plan.code ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin" />
                            {p.redirecting}
                          </span>
                        ) : (
                          `${p.upgradePrefix} ${planName}`
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Extra credits note */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p className="font-medium">{p.extraCreditsTitle}</p>
          <p>{p.extraCreditsPricing}</p>
          <button
            type="button"
            onClick={() => setLocation("/teacher/credits")}
            className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800 mt-1"
          >
            {p.buyExtraCredits}
          </button>
        </div>
      </div>
    </Layout>
  );
}
