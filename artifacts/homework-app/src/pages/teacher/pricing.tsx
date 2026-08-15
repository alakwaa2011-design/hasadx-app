import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { toast } from "@/components/ui/sonner";
import {
  BadgeCheck,
  ChevronDown,
  Crown,
  Gift,
  Info,
  Loader2,
  MessageSquareText,
  Sparkles,
  WalletCards,
  Zap,
  AlertCircle,
  Gamepad2,
  BrainCircuit,
  Presentation,
  Video,
  UsersRound,
  Image as ImageIcon,
  MessageCircleMore,
  WandSparkles,
  BarChart3,
  FileOutput,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/* أنماط البطاقات الثلاث — مطابقة للمرجع البصري */
const planStyles: Record<string, { card: string; eyebrow: string; icon: string; button: string }> = {
  free: {
    card: "border-[#dce6dc] bg-white text-[#163a2b]",
    eyebrow: "text-[#8b782d]",
    icon: "bg-[#edf4ee] text-[#0b4b35]",
    button: "border border-[#c9dbcd] bg-white text-[#0b4b35] hover:bg-[#eff6f0]",
  },
  basic: {
    card: "border-[#dfe8de] bg-[#fbfdf9] text-[#163a2b] shadow-[0_16px_32px_rgba(13,68,46,0.08)]",
    eyebrow: "text-[#9b7622]",
    icon: "bg-[#fff4d4] text-[#a77610]",
    button: "bg-[#0b4b35] text-white hover:bg-[#083d2b]",
  },
  pro: {
    card: "border-[#0b4b35] bg-[#0b4b35] text-white shadow-[0_20px_45px_rgba(9,62,42,0.26)]",
    eyebrow: "text-[#f3cd60]",
    icon: "bg-white/10 text-[#f6d776]",
    button: "bg-[#f2c856] text-[#163a2b] hover:bg-[#f8d772]",
  },
};

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
  const [showComparison, setShowComparison] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  // Shared react-query cache with the header CreditsChip — no duplicate request.
  const { data: creditsData } = useCreditsBalance();
  const balance = creditsData?.balance ?? null;

  // Keep Arabic copy/RTL, but always render numeric values with Latin digits.
  const fmt = (n: number) => n.toLocaleString("en-US");
  const dateLocale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

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

  const scrollToPoints = () =>
    document.getElementById("points-center")?.scrollIntoView({ behavior: "smooth", block: "center" });

  const openCompare = () => {
    setShowComparison(true);
    setTimeout(() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const currentPlanCode = currentSub?.plan_code ?? "free";
  const isActive = currentSub?.status === "active" && currentSub?.payment_status === "active";

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

  const packNote = (pkg: Pkg): string | null => {
    if (pkg.credits === 100) return p.packNote100;
    if (pkg.credits === 300) return p.packNote300;
    if (pkg.credits === 600) return p.packNote600;
    return pkg.description;
  };
  const packBadge = (pkg: Pkg): string | null => {
    if (pkg.credits === 300) return p.badgeBalanced;
    if (pkg.credits === 600) return p.badgeBestRate;
    return null;
  };

  /* محتوى البطاقات — النصوص من الترجمة، الأرقام حية من الـAPI */
  const PLAN_META: Record<string, { eyebrow: string; badge?: string; description: string; cta: string; icon: LucideIcon; features: { label: string; icon: LucideIcon }[] }> = {
    free: {
      eyebrow: p.freeEyebrow,
      description: p.freeTagline,
      cta: p.freeCta,
      icon: Gift,
      features: [
        { label: p.freeF1, icon: Gamepad2 },
        { label: p.freeF2, icon: BrainCircuit },
        { label: p.freeF3, icon: Presentation },
        { label: p.freeF4, icon: Video },
        { label: p.freeF5, icon: UsersRound },
      ],
    },
    basic: {
      eyebrow: p.basicEyebrow,
      badge: p.basicBadge,
      description: p.basicTagline,
      cta: p.basicCta,
      icon: Zap,
      features: [
        { label: p.basicF1, icon: Zap },
        { label: p.basicF2, icon: UsersRound },
        { label: p.basicF3, icon: Presentation },
        { label: p.basicF4, icon: Video },
        { label: p.basicF5, icon: ImageIcon },
        { label: p.basicF6, icon: MessageCircleMore },
      ],
    },
    pro: {
      eyebrow: p.proKicker,
      badge: p.proSavingsBadge,
      description: p.proTagline,
      cta: p.proCta,
      icon: Crown,
      features: [
        { label: p.proSavings20, icon: Zap }, // أول ميزة — تُعرض بمعاملة خاصة أدناه
        { label: p.proF2, icon: Zap },
        { label: p.proF3, icon: WandSparkles },
        { label: p.proF4, icon: BarChart3 },
        { label: p.proF5, icon: FileOutput },
      ],
    },
  };

  return (
    <Layout>
      <div dir={dir} className="max-w-[1500px] mx-auto pb-20 pt-6 px-4 text-[#153a2b]">
        {/* ── 1) الهيدر الأخضر ── */}
        <section className="relative overflow-hidden rounded-[30px] bg-[#0b4b35] px-6 py-5 text-white shadow-[0_22px_50px_rgba(9,57,39,0.18)] sm:px-8 lg:px-10">
          <div className="absolute -end-20 -top-24 size-72 rounded-full border-[38px] border-[#1b6148] opacity-45" />
          <div className="absolute bottom-[-80px] end-1/3 size-52 rounded-full border-[30px] border-[#0f7050] opacity-25" />
          <div className="relative grid gap-4 lg:grid-cols-[1fr_235px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#f4d978]">
                <Sparkles className="size-3.5" />
                {p.pageTitle}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{p.heroTitle}</h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#cfe3d4]">{p.heroSubtitle}</p>
              <button
                type="button"
                onClick={() => setShowComparison((c) => !c)}
                aria-expanded={showComparison}
                className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-[#f4d978] hover:text-white"
                data-testid="compare-toggle"
              >
                {p.compareAll}
                <ChevronDown className={`size-4 transition-transform ${showComparison ? "rotate-180" : ""}`} />
              </button>
            </div>
            {/* بطاقة الرصيد المصغرة */}
            <button
              type="button"
              onClick={() => setLocation("/teacher/credits")}
              data-testid="pricing-balance-line"
              className="rounded-[20px] border border-white/15 bg-white/10 p-3.5 text-start transition-all duration-300 hover:-translate-y-1 hover:bg-white/15 hover:border-[#f4d978]/40 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center justify-between text-[#cde0d1]">
                <span className="text-xs font-bold">{p.availablePointsLabel}</span>
                <WalletCards className="size-4 text-[#f4d978]" />
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-black tabular-nums">{balance != null ? fmt(balance) : "—"}</span>
                <span className="mb-1 text-xs font-bold text-[#f4d978]">{p.balancePointsWord}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#cde0d1]">
                {creditsData != null && creditsData.freeBalance > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-1">{fmt(creditsData.freeBalance)} {p.balanceChipWelcome}</span>
                )}
                {creditsData != null && creditsData.paidBalance > 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-1">{fmt(creditsData.paidBalance)} {p.balanceChipPaid}</span>
                )}
              </div>
            </button>
          </div>
        </section>

        {/* ── 2) بطاقات الباقات ── */}
        <section className="mt-8">
          <div className="mb-5">
            <p className="text-xs font-bold text-[#a17d28]">{p.plansKicker}</p>
            <h2 className="mt-1 text-2xl font-black text-[#173b2c]">{p.plansHeading}</h2>
          </div>

          {loading ? (
            <div className="grid gap-5 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[550px] rounded-[28px] bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-3">
              {orderedPlans.map((plan) => {
                const meta = PLAN_META[plan.code];
                const style = planStyles[plan.code] ?? planStyles.free;
                const isCurrent = plan.code === currentPlanCode && (plan.code === "free" ? currentPlanCode === "free" : isActive);
                const isPro = plan.code === "pro";
                const isFree = plan.code === "free";
                const priceUSD = (plan.priceMinor / 100).toFixed(2);
                const planName = lang === "ar" ? plan.nameAr : plan.nameEn;
                const Icon = meta?.icon ?? Sparkles;

                return (
                  <article
                    key={plan.code}
                    className={`group relative flex min-h-[550px] flex-col overflow-hidden rounded-[28px] border p-5 sm:p-6 transition-all duration-300 ease-out hover:-translate-y-1.5 ${
                      plan.code === "pro"
                        ? "hover:shadow-[0_30px_60px_rgba(9,62,42,0.38)] hover:border-[#f2c856]/60"
                        : "hover:shadow-[0_24px_48px_rgba(13,68,46,0.16)] hover:border-[#9dbfa6]"
                    } ${style.card}`}
                  >
                    {/* شريط الشارة العلوي */}
                    {meta?.badge && (
                      <div
                        className={`-mx-5 -mt-5 mb-5 flex items-center gap-2 px-5 py-3 text-xs font-black sm:-mx-6 sm:-mt-6 sm:px-6 ${
                          isPro ? "bg-[#f1c657] text-[#163a2b]" : "bg-[#fff4d7] text-[#8e6a17]"
                        }`}
                      >
                        <Zap className="size-3.5 fill-current" />
                        {isPro ? (
                          <span>
                            {p.proSavingsBadge.split("20%")[0]}
                            <span className="font-black">20%</span>
                            {p.proSavingsBadge.split("20%")[1]}
                          </span>
                        ) : (
                          meta.badge
                        )}
                      </div>
                    )}

                    {/* الرأس — في المنتصف */}
                    <div className="flex flex-col items-center text-center">
                      <div className={`grid size-11 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${style.icon}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="mt-3">
                        <p className={`text-xs font-black ${style.eyebrow}`}>{meta?.eyebrow}</p>
                        <h3 className="mt-1 text-2xl font-black">{planName}</h3>
                        {isCurrent && (
                          <span
                            className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-black ${
                              isPro ? "bg-white/10 text-[#f4d978]" : "bg-[#e7f1e9] text-[#0b4b35]"
                            }`}
                          >
                            <BadgeCheck className="size-3.5" />
                            {p.currentPlan}
                          </span>
                        )}
                      </div>
                    </div>
                    {isPro && (
                      <p className="mt-3 text-center text-xs font-extrabold text-[#dbece0]">
                        {fmt(plan.monthlyCredits)} {p.pointsMonthly}
                      </p>
                    )}
                    <p className={`mt-4 min-h-12 text-center text-sm font-semibold leading-6 ${isPro ? "text-[#cfe3d4]" : "text-[#6d7e74]"}`}>
                      {meta?.description}
                    </p>

                    {/* السعر والنقاط — حية من الـAPI */}
                    <div className={`mt-5 border-y py-5 text-center ${isPro ? "border-white/10" : "border-[#e9efea]"}`}>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-3xl font-black tracking-tight">
                          {isFree ? p.freePlanLabel : `$${priceUSD}`}
                        </span>
                        {!isFree && (
                          <span className={`mb-1 text-sm font-bold ${isPro ? "text-[#cfe3d4]" : "text-[#73837a]"}`}>{p.perMonth}</span>
                        )}
                      </div>
                      <div className={`mt-2 flex items-center justify-center gap-3 text-xs font-bold ${isPro ? "text-[#f4d978]" : "text-[#a17d28]"}`}>
                        {isFree ? (
                          <>
                            <span>{fmt(plan.monthlyCredits)} {p.welcomePointsShort}</span>
                            <span>{p.welcomeOnce}</span>
                          </>
                        ) : (
                          <>
                            <span>{fmt(plan.monthlyCredits)} {p.pointsMonthly}</span>
                            {plan.rolloverCap != null && (
                              <span>{p.rolloverUntil} {fmt(plan.rolloverCap)} {p.balancePointsWord}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* المزايا — RTL لليمين */}
                    <ul className="mt-5 flex-1 space-y-3 text-start">
                      {meta?.features.map((f, idx) => {
                        const FIcon = f.icon;
                        const isProSaving = isPro && idx === 0;
                        return (
                          <li
                            key={f.label}
                            className={`flex items-start gap-2.5 text-sm font-bold leading-6 transition-transform duration-200 hover:translate-x-[-3px] rtl:hover:translate-x-[3px] ${
                              isProSaving ? "rounded-xl border border-[#f4d978]/30 bg-[#f1c657]/10 px-2.5 py-1.5 hover:bg-[#f1c657]/20" : ""
                            }`}
                          >
                            <span
                              className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105 ${
                                isPro ? "bg-white/10 text-[#f4d978]" : "bg-[#eaf3eb] text-[#0b4b35]"
                              }`}
                            >
                              <FIcon className="size-3.5" />
                            </span>
                            {isProSaving ? (
                              <span className="inline-flex flex-wrap items-center gap-1">
                                ⚡ {p.proSavings20.split("20%")[0]}
                                <em className="font-black not-italic text-[#f4d978]">20%</em>
                                {p.proSavings20.split("20%")[1]}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={p.proSavingsTooltipTitle}
                                      className="ms-1 inline-grid size-5 place-items-center rounded-full border border-[#f4d978]/70 text-[#f4d978] hover:bg-white/10"
                                    >
                                      <Info className="size-3.5" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    dir={dir}
                                    side="top"
                                    className="w-72 border-[#d6b34c] bg-[#fffdf6] p-4 text-start text-[#234535]"
                                  >
                                    <p className="text-xs font-bold mb-1 text-[#9b7622]">{p.proSavingsTooltipTitle}</p>
                                    <p className="text-xs font-medium leading-5">{p.proSavingsTooltipBody}</p>
                                    <p className="mt-2 rounded-lg bg-[#f7efd7] px-3 py-2 text-xs font-bold leading-5">
                                      {p.proSavingsTooltipExample}
                                    </p>
                                  </PopoverContent>
                                </Popover>
                              </span>
                            ) : (
                              <span>{f.label}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA */}
                    <div className="mt-6">
                      {isCurrent && isFree ? (
                        <button
                          type="button"
                          disabled
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d5e1d6] bg-[#eff4ef] font-extrabold text-[#688076]"
                        >
                          <BadgeCheck className="size-4" />
                          {p.currentPlan}
                        </button>
                      ) : isCurrent ? (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => setLocation("/teacher/credits")}
                            className={`h-12 w-full rounded-xl font-extrabold transition-transform active:scale-[0.97] ${
                              isPro
                                ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                                : "border border-[#c9dbcd] bg-white text-[#0b4b35] hover:bg-[#eff6f0]"
                            }`}
                          >
                            {p.manageSubscription}
                          </button>
                          {!currentSub?.cancelled_at && (
                            <div className="text-center">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    type="button"
                                    className={`text-sm underline underline-offset-4 transition-colors font-medium ${
                                      isPro ? "text-white/50 hover:text-white/90" : "text-muted-foreground hover:text-red-600"
                                    }`}
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
                        <button
                          type="button"
                          disabled
                          className="h-12 w-full rounded-xl border border-[#d5e1d6] bg-[#eff4ef] font-extrabold text-[#688076]"
                        >
                          {p.starterPlan}
                        </button>
                      ) : !paymentsEnabled ? (
                        <div className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground font-medium">
                          <AlertCircle size={16} className="opacity-70" />
                          {p.paymentsDisabled}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgrade(plan.code)}
                          disabled={checkingOut !== null}
                          className={`h-12 w-full rounded-xl font-extrabold transition-transform active:scale-[0.97] disabled:opacity-60 ${style.button}`}
                        >
                          {checkingOut === plan.code ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 size={18} className="animate-spin" /> {p.redirecting}
                            </span>
                          ) : (
                            meta?.cta
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 3) جدول المقارنة ── */}
        {!loading && showComparison && orderedPlans.length > 0 && (
          <section ref={compareRef} className="mt-6 overflow-hidden rounded-[24px] border border-[#dce7dd] bg-white scroll-mt-24" data-testid="compare-table">
            <div className="flex items-center justify-between border-b border-[#e8eee8] px-5 py-4">
              <div>
                <p className="text-xs font-bold text-[#a17d28]">{p.compareKicker}</p>
                <h2 className="mt-1 text-lg font-black text-[#183c2d]">{p.compareTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowComparison(false)}
                className="text-xs font-bold text-[#628073] hover:text-[#0b4b35]"
              >
                {p.compareHide}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-start">
                <thead className="bg-[#f7faf6] text-xs text-[#6d8074]">
                  <tr>
                    <th className="px-5 py-3.5 font-black text-start">{p.compareFeatureCol}</th>
                    {orderedPlans.map((pl) => (
                      <th key={pl.code} className={`px-5 py-3.5 font-black text-start ${pl.code === "pro" ? "text-[#0b4b35]" : ""}`}>
                        {lang === "ar" ? pl.nameAr : pl.nameEn}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ed] text-sm font-semibold text-[#425f50]">
                  {(() => {
                    const byCode = Object.fromEntries(orderedPlans.map((pl) => [pl.code, pl]));
                    const rows: { label: string; values: Record<string, string> }[] = [
                      {
                        label: p.comparePointsRow,
                        values: {
                          free: byCode.free ? `${fmt(byCode.free.monthlyCredits)} ${p.comparePointsFreeSuffix}` : "—",
                          basic: byCode.basic ? `${fmt(byCode.basic.monthlyCredits)} ${p.comparePointsPaidSuffix}` : "—",
                          pro: byCode.pro ? `${fmt(byCode.pro.monthlyCredits)} ${p.comparePointsPaidSuffix}` : "—",
                        },
                      },
                      {
                        label: p.compareRolloverRow,
                        values: {
                          free: byCode.free?.rolloverCap ? `${p.compareRolloverUpTo} ${fmt(byCode.free.rolloverCap)}` : "—",
                          basic: byCode.basic?.rolloverCap ? `${p.compareRolloverUpTo} ${fmt(byCode.basic.rolloverCap)}` : "—",
                          pro: byCode.pro?.rolloverCap ? `${p.compareRolloverUpTo} ${fmt(byCode.pro.rolloverCap)}` : "—",
                        },
                      },
                      { label: p.compareAiRow, values: { free: p.compareAiNormal, basic: p.compareAiNormal, pro: p.compareAiPro } },
                      { label: p.compareSlidesRow, values: { free: p.compareSlidesFree, basic: p.compareSlidesBasic, pro: p.compareSlidesPro } },
                      { label: p.compareVideoRow, values: { free: p.compareVideoFree, basic: p.compareVideoBasic, pro: p.compareVideoPro } },
                      { label: p.compareClassRow, values: { free: p.compareClassFree, basic: p.compareClassBasic, pro: p.compareClassPro } },
                      { label: p.compareReportsRow, values: { free: p.compareReportsFree, basic: p.compareReportsBasic, pro: p.compareReportsPro } },
                    ];
                    return rows.map((row) => (
                      <tr key={row.label}>
                        <td className="px-5 py-4 font-extrabold text-[#214636]">{row.label}</td>
                        {orderedPlans.map((pl) => (
                          <td key={pl.code} className={`px-5 py-4 ${pl.code === "pro" ? "text-[#0b4b35]" : ""}`}>
                            {row.values[pl.code] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── 4) مركز نقاط حصاد ── */}
        {!loading && orderedPacks.length > 0 && (
          <section
            id="points-center"
            className="mt-8 scroll-mt-24 rounded-[28px] border border-[#eadfca] bg-[#fbf8f1] p-5 sm:p-7"
            data-testid="packs-section"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#a17d28]">
                <WalletCards className="size-4" />
                {p.packsCenterChip}
              </div>
              <h2 className="mt-2 text-2xl font-black text-[#173b2c]">{p.packsTitle}</h2>
              <p className="mt-2 text-sm font-semibold text-[#718177]">{p.packsSubtitle}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {orderedPacks.map((pkg) => {
                const badge = packBadge(pkg);
                const featured = pkg.credits === 300 || pkg.isFeatured;
                return (
                  <article
                    key={pkg.id}
                    className={`relative flex min-h-[210px] flex-col items-center rounded-[22px] border bg-white p-3.5 text-center transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_18px_36px_rgba(13,68,46,0.12)] ${
                      featured
                        ? "border-[#d2a52d] shadow-[0_10px_22px_rgba(204,157,34,0.10)]"
                        : "border-[#dce7dd] hover:border-[#b8cdbb]"
                    }`}
                  >
                    {badge && (
                      <span
                        className={`absolute -top-2.5 start-4 rounded-full px-2.5 py-1 text-[10px] font-black ${
                          featured ? "bg-[#f1c657] text-[#163a2b]" : "bg-[#e4eee5] text-[#427052]"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                    <div>
                      <p className="text-[44px] font-black leading-none tracking-tight text-[#0b4b35] sm:text-5xl tabular-nums">
                        {fmt(pkg.credits)}
                      </p>
                      <p className="mt-1 text-lg font-black text-[#294a3a]">{p.packPointUnit}</p>
                    </div>
                    {packNote(pkg) && (
                      <p className="mt-1 max-w-[245px] text-[13px] font-semibold leading-4 text-[#73837a]">{packNote(pkg)}</p>
                    )}
                    <div className="mt-auto w-full border-t border-[#e5ece5] pt-1">
                      <span className="text-3xl font-black tracking-tight text-[#0b4b35] tabular-nums">
                        ${(pkg.priceUsdCents / 100).toFixed(2)}
                      </span>
                    </div>
                    {!paymentsEnabled || !purchasesEnabled ? (
                      <div className="mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground font-medium">
                        <AlertCircle size={14} className="opacity-70" />
                        {p.paymentsDisabled}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBuyPack(pkg)}
                        disabled={buyingId !== null}
                        className={`mt-1.5 h-10 w-full rounded-xl border text-base font-extrabold transition-transform active:scale-[0.97] disabled:opacity-60 ${
                          featured
                            ? "border-[#d8b448] bg-[#fff7dc] text-[#695118] hover:bg-[#fdf0bf]"
                            : "border-[#c6d8c8] bg-white text-[#0b4b35] hover:bg-[#eff6f0]"
                        }`}
                      >
                        {buyingId === pkg.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 size={15} className="animate-spin" /> {p.redirecting}
                          </span>
                        ) : (
                          `${p.packBuyWord} ${fmt(pkg.credits)} ${p.packPointsWord}`
                        )}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-center text-xs font-semibold leading-6 text-[#72827a]" data-testid="packs-policy">
              {p.packsPolicy}
            </p>
          </section>
        )}

        {/* ── 5) الدعوة الختامية ── */}
        {!loading && (
          <section className="mt-8 flex flex-col justify-between gap-5 rounded-[24px] border border-dashed border-[#c8d9ca] bg-[#f9fbf8] px-5 py-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff2c9] text-[#a27612]">
                <MessageSquareText className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#264536]">{p.notSureTitle}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-[#76877d]">{p.notSureBody}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCompare}
              className="shrink-0 rounded-xl border border-[#c9d9cb] bg-white px-4 py-2.5 text-sm font-extrabold text-[#0b4b35] hover:bg-[#f0f7f1]"
            >
              {p.notSureCta}
            </button>
          </section>
        )}
      </div>
    </Layout>
  );
}
