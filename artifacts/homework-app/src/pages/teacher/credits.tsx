import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import {
  Sparkles, Gift, Award, ShoppingCart, Loader2,
  CheckCircle2, Clock, ShieldCheck, Star, Zap, Check,
  CalendarClock, AlertCircle, CreditCard, ChevronLeft, ChevronRight
} from "lucide-react";
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

interface Pkg {
  id: number;
  name: string;
  description: string | null;
  priceUsdCents: number;
  currency: string;
  credits: number;
  isFeatured: boolean;
}

interface Purchase {
  id: number;
  packageName: string;
  amountCents: number;
  currency: string;
  credits: number;
  paymentStatus: string;
  purchasedAt: string | null;
  createdAt: string;
}

interface SubInfo {
  plan_code: string;
  plan_name_ar: string;
  plan_name_en: string;
  status: string;
  payment_status: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  monthly_credits: number;
  rollover_cap: number | null;
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

const PLAN_ICONS: Record<string, any> = { basic: Star, pro: Zap };

export default function TeacherCreditsPage() {
  const [, setLocation] = useLocation();
  const { t, lang, dir } = useI18n();
  const c = t.credits;
  const p = t.pricing;

  // Keep Arabic copy/RTL, but always render numeric values with Latin digits.
  const fmt = (n: number) => n.toLocaleString("en-US");
  const dateLocale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  const statusLabel: Record<string, string> = {
    pending_checkout:   c.statusPendingCheckout,
    completed:          c.statusCompleted,
    partially_refunded: c.statusPartialRefund,
    refunded:           c.statusRefunded,
    failed:             c.statusFailed,
  };
  
  const statusColor: Record<string, string> = {
    pending_checkout:   "text-amber-700 bg-amber-50 border-amber-200",
    completed:          "text-emerald-700 bg-emerald-50 border-emerald-200",
    partially_refunded: "text-orange-700 bg-orange-50 border-orange-200",
    refunded:           "text-red-700 bg-red-50 border-red-200",
    failed:             "text-red-700 bg-red-50 border-red-200",
  };

  const paymentStatusLabel: Record<string, { label: string; color: string }> = {
    active:    { label: c.payStatusActive,    color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    past_due:  { label: c.payStatusPastDue,   color: "text-amber-700 bg-amber-50 border-amber-200" },
    unpaid:    { label: c.payStatusUnpaid,    color: "text-red-700 bg-red-50 border-red-200" },
    cancelled: { label: c.payStatusCancelled, color: "text-muted-foreground bg-muted border-border" },
    expired:   { label: c.payStatusExpired,   color: "text-muted-foreground bg-muted border-border" },
  };

  /* Central balance source — same react-query cache as the header chip, so
     the hero number here always matches the chip and updates when any AI
     operation invalidates the shared query. */
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useCreditsBalance();
  const [subscription,     setSubscription]     = useState<SubInfo | null>(null);
  const [packages,         setPackages]         = useState<Pkg[]>([]);
  const [purchasesEnabled, setPurchasesEnabled] = useState(true);
  const [purchases,        setPurchases]        = useState<Purchase[]>([]);
  const [plans,            setPlans]            = useState<Plan[]>([]);
  const [paymentsEnabled,  setPaymentsEnabled]  = useState(false);
  const [loading,          setLoading]          = useState(true);

  const [buyingId,     setBuyingId]     = useState<number | null>(null);
  const [checkingOut,  setCheckingOut]  = useState<string | null>(null);

  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [intentStatus,  setIntentStatus]  = useState<"waiting" | "confirmed" | "timeout" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = () => {
    // بيانات الترقية مستقلة: فشلها لا يمنع عرض الرصيد والحزم والسجل
    apiFetch("/api/subscriptions/plans")
      .then((r) => r.json())
      .then((plansData) => {
        setPlans(plansData.plans ?? []);
        setPaymentsEnabled(plansData.paymentsEnabled === true);
      })
      .catch(() => toast(t.pricing.loadError, { className: "text-red-500" }));

    /* Balance itself comes from the shared react-query source. */
    void refetchBalance();

    Promise.all([
      apiFetch("/api/credits/packages").then((r) => r.json()),
      apiFetch("/api/credits/purchases").then((r) => r.json()),
      apiFetch("/api/subscriptions/me").then((r) => r.json()),
    ])
      .then(([pkgs, purch, sub]) => {
        setPackages(pkgs.packages ?? []);
        setPurchasesEnabled(pkgs.purchasesEnabled !== false);
        setPurchases(Array.isArray(purch) ? purch : []);
        setSubscription(sub.subscription ?? null);
      })
      .catch(() => toast(c.loadError, { className: "text-red-500" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    const subscribed = params.get("subscribed");
    
    if (intent) {
      setPendingIntent(intent);
      setIntentStatus("waiting");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (subscribed === "1") {
      // Just show a success toast or set a confirmed state visually
      toast.success(c.paymentConfirmed || "Subscription successful!");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!pendingIntent || intentStatus !== "waiting") return;
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const r = await apiFetch(`/api/credits/purchases/${pendingIntent}/status`);
        if (r.ok) {
          const data = await r.json();
          if (data.paymentStatus === "completed") {
            setIntentStatus("confirmed");
            clearInterval(pollRef.current!);
            loadAll();
            return;
          }
        }
      } catch { /* retry */ }
      if (tries >= 20) {
        setIntentStatus("timeout");
        clearInterval(pollRef.current!);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pendingIntent, intentStatus]);

  const buy = async (pkg: Pkg) => {
    setBuyingId(pkg.id);
    try {
      const r = await apiFetch("/api/credits/checkout", {
        method: "POST",
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).message || c.checkoutError);
      }
      const { checkoutUrl } = await r.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
      setBuyingId(null);
    }
  };

  const upgrade = async (planCode: string) => {
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

  const isFreeOrNoSub = !subscription || subscription.plan_code === "free";
  const renewalDate   = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(
        dateLocale,
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;
  const payStatusInfo = paymentStatusLabel[subscription?.payment_status ?? ""] ?? null;
  const planName      = subscription
    ? (lang === "ar" ? subscription.plan_name_ar : subscription.plan_name_en)
    : "";

  const ChevronIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  // Which paid plans are actual upgrades from the current plan?
  // الاشتراك الملغى لا يُعرض عليه أي ترقية — فقط توضيح استمرار الوصول
  const currentPlanCode = isFreeOrNoSub ? "free" : subscription!.plan_code;
  const upgradeCodes = subscription?.cancelled_at ? [] :
    currentPlanCode === "free"  ? ["basic", "pro"] :
    currentPlanCode === "basic" ? ["pro"] : [];
  const upgradePlans = upgradeCodes
    .map((code) => plans.find((pl) => pl.code === code))
    .filter(Boolean) as Plan[];

  // Balance breakdown: only show non-zero sources (total stays the hero number)
  const breakdownEntries = balance
    ? ([
        { key: "sub",     label: c.breakdownSub,     value: balance.subscriptionBalance, icon: CreditCard, gold: false },
        { key: "welcome", label: c.breakdownWelcome, value: balance.freeBalance,         icon: Gift,       gold: false },
        { key: "paid",    label: c.breakdownPaid,    value: balance.paidBalance,         icon: ShieldCheck, gold: true },
        { key: "earned",  label: c.breakdownEarned,  value: balance.earnedBalance,       icon: Award,      gold: false },
      ] as const).filter((e) => e.value > 0)
    : [];

  return (
    <Layout>
      <div dir={dir} className="max-w-6xl mx-auto space-y-7 pb-12 pt-4">
        
        {/* Payment return banners */}
        {intentStatus && (
          <div className="animate-in fade-in slide-in-from-top-2">
            {intentStatus === "waiting" && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-3 shadow-sm">
                <Loader2 size={20} className="text-amber-600 animate-spin shrink-0" />
                <p className="text-sm font-medium text-amber-800">{c.paymentWaiting}</p>
              </div>
            )}
            {intentStatus === "confirmed" && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center gap-3 shadow-sm">
                <CheckCircle2 size={20} className="text-emerald-700 shrink-0" />
                <p className="text-sm font-medium text-emerald-800">{c.paymentConfirmed}</p>
              </div>
            )}
            {intentStatus === "timeout" && (
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex items-center gap-3 shadow-sm">
                <Clock size={20} className="text-orange-600 shrink-0" />
                <p className="text-sm font-medium text-orange-800">{c.paymentTimeout}</p>
              </div>
            )}
          </div>
        )}

        {/* Hero Section — compact header */}
        <section className="bg-emerald-950 text-white rounded-2xl px-6 py-5 md:px-8 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-24 -left-24 w-[18rem] h-[18rem] bg-emerald-500 rounded-full blur-[80px] mix-blend-screen" />
            <div className="absolute top-1/2 right-0 w-[12rem] h-[12rem] bg-[#E8B84B] rounded-full blur-[60px] mix-blend-screen" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white">{c.pageTitle}</h1>
              <p className="text-emerald-100/80 text-xs md:text-sm flex items-center gap-1.5 font-medium mt-1">
                <Sparkles size={14} className="text-[#E8B84B]" fill="currentColor" />
                {c.aiToolsOnly}
              </p>
            </div>

            <div className="flex items-center gap-5 flex-wrap">
              {/* المصادر غير الصفرية — تظهر فقط عند تعدد المصادر حتى لا يتكرر الرقم */}
              {!balanceLoading && breakdownEntries.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {breakdownEntries.map(({ key, label, value, icon: Icon, gold }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
                        gold ? "bg-[#E8B84B]/15 border-[#E8B84B]/30 text-[#E8B84B]" : "bg-white/10 border-white/15 text-emerald-100"
                      }`}
                    >
                      <Icon size={13} className="opacity-80" />
                      {label}: {fmt(value)}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">
                  {balanceLoading ? "…" : fmt(balance?.balance ?? 0)}
                </span>
                <span className="text-base md:text-lg font-medium text-emerald-200">{c.pointsLabel}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Monthly plan — integrated section */}
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-extrabold text-emerald-950">{c.yourPlanTitle}</h2>
          </div>

          {loading ? (
            <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />
          ) : (
            <div className="space-y-5">
              {/* Current plan status — compact */}
              {!isFreeOrNoSub && subscription ? (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white border border-emerald-100 rounded-2xl shadow-sm gap-5">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 shadow-inner">
                      <CreditCard size={26} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-950 flex items-center flex-wrap gap-2">
                        {c.planPrefix} {planName}
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          {p.currentPlan}
                        </span>
                      </h3>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{fmt(subscription.monthly_credits)} {c.pointsMonthly}</span>
                        {subscription.rollover_cap ? (
                          <>
                            <span className="opacity-40">•</span>
                            <span>{c.rolloverUntil} {fmt(subscription.rollover_cap)}</span>
                          </>
                        ) : null}
                      </div>
                      {subscription.cancelled_at ? (
                        <p className="text-xs text-amber-800 mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 w-fit">
                          <CalendarClock size={13} className="opacity-70 shrink-0" />
                          {c.cancelledAccessNote}{renewalDate ? ` ${renewalDate}` : ""}
                        </p>
                      ) : renewalDate ? (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                          <CalendarClock size={13} className="opacity-70" />
                          {c.renewsOn} <span className="font-medium text-foreground">{renewalDate}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {!subscription.cancelled_at && (
                    <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto shrink-0">
                      <Button variant="outline" className="w-full md:w-auto bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200" onClick={() => setLocation("/teacher/pricing")}>
                        {c.manageSubscription}
                      </Button>
                      {subscription.payment_status === "past_due" && (
                        <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                          <AlertCircle size={14}/> {payStatusInfo?.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <p className="font-bold text-emerald-950 flex items-center gap-2">
                    <Gift size={15} className="text-emerald-700 shrink-0" strokeWidth={1.75} />
                    {c.freePlanCurrent}
                  </p>
                  <p className="text-muted-foreground mt-1">{c.freePlanCurrentDesc}</p>
                </div>
              )}

              {/* Upgrade options — only real upgrades from the current plan */}
              {upgradePlans.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {upgradePlans.map((plan) => {
                    const Icon = PLAN_ICONS[plan.code] ?? Sparkles;
                    const isPro = plan.code === "pro";
                    const priceUSD = (plan.priceMinor / 100).toFixed(2);
                    const upPlanName = lang === "ar" ? plan.nameAr : plan.nameEn;
                    return (
                      <Card
                        key={plan.code}
                        className={`flex flex-col p-4 sm:p-5 transition-all duration-300 ${
                          isPro
                            ? "border-2 border-emerald-800 bg-emerald-900 text-white shadow-lg"
                            : "border border-border/60 bg-white hover:border-emerald-200 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPro ? "bg-white/10 border border-white/20" : "bg-emerald-50 border border-emerald-100"}`}>
                            <Icon size={18} className={isPro ? "text-[#E8B84B]" : "text-emerald-700"} />
                          </div>
                          <h3 className={`font-extrabold ${isPro ? "text-white" : "text-emerald-950"}`}>{upPlanName}</h3>
                          <span className={`ms-auto text-sm font-bold ${isPro ? "text-white/85" : "text-emerald-800"}`}>
                            ${priceUSD} {p.perMonth}
                          </span>
                        </div>

                        {/* سطر مواصفات مدمج */}
                        <div className={`flex items-center gap-x-2 gap-y-1 flex-wrap text-[13px] font-medium mb-3 ${isPro ? "text-white/85" : "text-foreground/75"}`}>
                          <span>{fmt(plan.monthlyCredits)} {p.pointsMonthly}</span>
                          {plan.rolloverCap ? (
                            <>
                              <span className="opacity-40">·</span>
                              <span>{p.rolloverUntil} {fmt(plan.rolloverCap)}</span>
                            </>
                          ) : null}
                        </div>
                        {isPro && (
                          <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#E8B84B] mb-3">
                            <Zap size={14} className="shrink-0" fill="currentColor" />
                            {c.proSavingsCompact}
                          </p>
                        )}

                        {!paymentsEnabled ? (
                          <div className={`w-full mt-auto text-center p-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isPro ? "bg-white/10 text-white/70 border border-white/15" : "bg-muted/50 text-muted-foreground border border-border"}`}>
                            <AlertCircle size={16} className="opacity-70" />
                            {p.paymentsDisabled}
                          </div>
                        ) : (
                          <Button
                            variant={isPro ? "outline" : "default"}
                            className={`w-full mt-auto group ${isPro ? "bg-white text-emerald-950 border-white hover:bg-emerald-50 hover:text-emerald-950" : ""}`}
                            onClick={() => upgrade(plan.code)}
                            disabled={checkingOut !== null}
                          >
                            {checkingOut === plan.code ? (
                              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {c.redirecting}</span>
                            ) : (
                              <span className="flex items-center gap-2 font-bold">
                                {p.upgradePrefix} {upPlanName}
                                <ChevronIcon size={16} className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                              </span>
                            )}
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* One-time packages */}
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-extrabold text-emerald-950">{c.oneTimeTitle}</h2>
            <p className="text-sm text-muted-foreground mt-1">{c.paidPointsNote}</p>
          </div>
          
          {!purchasesEnabled && (
            <div className="p-4 mb-6 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle size={16} className="opacity-70" />
              {c.purchasesDisabled}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => <div key={i} className="h-[220px] rounded-2xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : packages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm border rounded-2xl border-dashed">
              {c.noPackages}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
              {packages.map((pkg) => {
                const isRecommended = pkg.credits === 300 || pkg.isFeatured;
                return (
                  <Card
                    key={pkg.id}
                    className={`relative flex flex-col p-6 overflow-hidden transition-all duration-300 ${
                      isRecommended 
                        ? "border-2 border-[#E8B84B] shadow-xl shadow-[#E8B84B]/10 -translate-y-2 bg-white" 
                        : "border border-border/60 hover:border-emerald-200 hover:shadow-md bg-white/60"
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute top-0 right-0 left-0 bg-[#E8B84B] text-amber-950 text-xs font-bold py-1.5 text-center shadow-sm">
                        {c.mostValue}
                      </div>
                    )}
                    <div className={isRecommended ? "mt-4" : ""}>
                      <div className="flex items-baseline gap-1.5 mb-2 mt-2">
                        <span className={`text-4xl font-black tracking-tight ${isRecommended ? "text-emerald-800" : "text-emerald-700"}`}>
                          {fmt(pkg.credits)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">{c.pointsLabel}</span>
                      </div>
                      <p className="text-sm font-medium text-emerald-900/70 mb-6 bg-emerald-50 inline-block px-2.5 py-1 rounded-md">
                        ${(pkg.priceUsdCents / 100).toFixed(2)}
                      </p>
                      <Button
                        variant={isRecommended ? "default" : "outline"}
                        className={`w-full ${!isRecommended && "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`}
                        onClick={() => buy(pkg)}
                        disabled={!purchasesEnabled || buyingId !== null}
                      >
                        {buyingId === pkg.id ? (
                          <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {c.redirecting}</span>
                        ) : (
                          <span className="flex items-center gap-2 font-bold"><ShoppingCart size={16} /> {c.buyPoints}</span>
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Purchase history */}
        <section>
          <h2 className="text-xl font-extrabold text-emerald-950 mb-4">{c.historyTitle}</h2>
          {loading ? (
            <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm border rounded-2xl border-dashed">
              {c.noPurchases}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right whitespace-nowrap">
                  <thead className="bg-muted/30">
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="py-3 px-5 font-semibold">{c.colPackage}</th>
                      <th className="py-3 px-5 font-semibold">{c.colAmount}</th>
                      <th className="py-3 px-5 font-semibold">{c.colStatus}</th>
                      <th className="py-3 px-5 font-semibold">{c.colDate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {purchases.map((p2) => (
                      <tr key={p2.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-emerald-950">{fmt(p2.credits)} {c.pointsLabel}</td>
                        <td className="py-3.5 px-5 text-muted-foreground">${(p2.amountCents / 100).toFixed(2)}</td>
                        <td className="py-3.5 px-5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColor[p2.paymentStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
                            {statusLabel[p2.paymentStatus] ?? p2.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-muted-foreground">
                          {new Date(p2.purchasedAt ?? p2.createdAt).toLocaleDateString(
                            dateLocale,
                            { year: "numeric", month: "short", day: "numeric" }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}
