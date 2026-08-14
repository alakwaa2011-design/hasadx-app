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

const API = import.meta.env.VITE_API_URL || "";
async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

interface BalanceDetail {
  balance: number;
  paidBalance: number;
  promoBalance: number;
  earnedBalance: number;
  subscriptionBalance: number;
  freeBalance: number;
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

  const [balance,          setBalance]          = useState<BalanceDetail | null>(null);
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

    Promise.all([
      apiFetch("/api/credits/me").then((r) => r.json()),
      apiFetch("/api/credits/packages").then((r) => r.json()),
      apiFetch("/api/credits/purchases").then((r) => r.json()),
      apiFetch("/api/subscriptions/me").then((r) => r.json()),
    ])
      .then(([bal, pkgs, purch, sub]) => {
        setBalance(bal);
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
      <div dir={dir} className="max-w-4xl mx-auto space-y-10 pb-16 pt-4">
        
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

        {/* Hero Section */}
        <section className="bg-emerald-950 text-white rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] bg-emerald-500 rounded-full blur-[100px] mix-blend-screen" />
            <div className="absolute top-1/2 right-0 w-[20rem] h-[20rem] bg-[#E8B84B] rounded-full blur-[80px] mix-blend-screen" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-5 flex-1">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold mb-2 text-white">{c.pageTitle}</h1>
                <p className="text-emerald-100/90 text-sm md:text-base flex items-center gap-2 font-medium">
                  <Sparkles size={16} className="text-[#E8B84B]" fill="currentColor" />
                  {c.aiToolsOnly}
                </p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-6xl md:text-7xl font-black tracking-tight drop-shadow-sm">
                  {loading ? "…" : fmt(balance?.balance ?? 0)}
                </span>
                <span className="text-xl md:text-2xl font-medium text-emerald-200">{c.pointsLabel}</span>
              </div>
            </div>

            {/* Breakdown — only non-zero sources */}
            {!loading && breakdownEntries.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 bg-white/10 p-6 rounded-3xl backdrop-blur-md border border-white/15 w-full md:w-auto shrink-0 shadow-inner">
                {breakdownEntries.map(({ key, label, value, icon: Icon, gold }) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-emerald-200 mb-1.5 flex items-center gap-1.5">
                      <Icon size={14} className="opacity-80" /> {label}
                    </p>
                    <p className={`font-bold text-xl ${gold ? "text-[#E8B84B] drop-shadow-sm" : "text-white"}`}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Monthly plan — integrated section */}
        <section>
          <div className="mb-5">
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
                <div className="flex items-center gap-4 p-5 bg-white border border-border/60 rounded-2xl shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <Gift size={22} className="text-emerald-700" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-950">{c.freePlanCurrent}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.freePlanCurrentDesc}</p>
                  </div>
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
                        className={`flex flex-col p-6 transition-all duration-300 ${
                          isPro
                            ? "border-2 border-emerald-800 bg-emerald-900 text-white shadow-xl"
                            : "border border-border/60 bg-white hover:border-emerald-200 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isPro ? "bg-white/10 border border-white/20" : "bg-emerald-50 border border-emerald-100"}`}>
                            <Icon size={22} className={isPro ? "text-[#E8B84B]" : "text-emerald-700"} />
                          </div>
                          <div>
                            <h3 className={`font-extrabold text-lg ${isPro ? "text-white" : "text-emerald-950"}`}>{upPlanName}</h3>
                            <p className={`text-sm font-medium ${isPro ? "text-white/70" : "text-muted-foreground"}`}>
                              ${priceUSD} {p.perMonth}
                            </p>
                          </div>
                        </div>

                        <ul className={`space-y-2.5 text-sm mb-6 flex-1 ${isPro ? "text-white/90" : "text-foreground/80"}`}>
                          <li className="flex items-start gap-2.5">
                            <Check size={16} className={`shrink-0 mt-0.5 ${isPro ? "text-[#E8B84B]" : "text-emerald-600"}`} />
                            <span>{fmt(plan.monthlyCredits)} {p.pointsMonthly}</span>
                          </li>
                          {plan.rolloverCap ? (
                            <li className="flex items-start gap-2.5">
                              <Check size={16} className={`shrink-0 mt-0.5 ${isPro ? "text-[#E8B84B]" : "text-emerald-600"}`} />
                              <span>{p.rolloverUntil} {fmt(plan.rolloverCap)}</span>
                            </li>
                          ) : null}
                          {isPro && (
                            <li className="flex items-start gap-2.5 font-bold text-[#E8B84B]">
                              <Zap size={16} className="shrink-0 mt-0.5" fill="currentColor" />
                              <span>{p.proSavings20}</span>
                            </li>
                          )}
                        </ul>

                        {!paymentsEnabled ? (
                          <div className={`w-full text-center p-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${isPro ? "bg-white/10 text-white/70 border border-white/15" : "bg-muted/50 text-muted-foreground border border-border"}`}>
                            <AlertCircle size={16} className="opacity-70" />
                            {p.paymentsDisabled}
                          </div>
                        ) : (
                          <Button
                            variant={isPro ? "outline" : "default"}
                            className={`w-full group ${isPro ? "bg-white text-emerald-950 border-white hover:bg-emerald-50 hover:text-emerald-950" : ""}`}
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
          <div className="mb-5">
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
                      <th className="py-3 px-5 font-semibold">{c.colPoints}</th>
                      <th className="py-3 px-5 font-semibold">{c.colAmount}</th>
                      <th className="py-3 px-5 font-semibold">{c.colStatus}</th>
                      <th className="py-3 px-5 font-semibold">{c.colDate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {purchases.map((p2) => (
                      <tr key={p2.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-emerald-950">{p2.packageName}</td>
                        <td className="py-3.5 px-5 font-medium text-emerald-800">{fmt(p2.credits)}</td>
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
