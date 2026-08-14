import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import {
  Coins, Sparkles, Gift, Award, ShoppingCart, Loader2,
  CheckCircle2, Clock, ReceiptText, ShieldCheck,
  CalendarClock, AlertCircle, CreditCard, ChevronLeft, ChevronRight
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function TeacherCreditsPage() {
  const [, setLocation] = useLocation();
  const { t, lang, dir } = useI18n();
  const c = t.credits;

  const fmt = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US");

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
  const [loading,          setLoading]          = useState(true);
  
  const [confirmingPkg,    setConfirmingPkg]    = useState<Pkg | null>(null);
  const [buyingId,         setBuyingId]         = useState<number | null>(null);

  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [intentStatus,  setIntentStatus]  = useState<"waiting" | "confirmed" | "timeout" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = () => {
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
      setConfirmingPkg(null);
    }
  };

  const isFreeOrNoSub = !subscription || subscription.plan_code === "free";
  const renewalDate   = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(
        lang === "ar" ? "ar-SA" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : null;
  const payStatusInfo = paymentStatusLabel[subscription?.payment_status ?? ""] ?? null;
  const planName      = subscription
    ? (lang === "ar" ? subscription.plan_name_ar : subscription.plan_name_en)
    : "";

  const ChevronIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

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

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 bg-white/10 p-6 rounded-3xl backdrop-blur-md border border-white/15 w-full md:w-auto shrink-0 shadow-inner">
              {!isFreeOrNoSub ? (
                <div>
                  <p className="text-xs font-medium text-emerald-200 mb-1.5 flex items-center gap-1.5">
                    <CreditCard size={14} className="opacity-80" /> {c.breakdownSub}
                  </p>
                  <p className="font-bold text-xl text-white">{loading ? "…" : fmt(balance?.subscriptionBalance ?? 0)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-emerald-200 mb-1.5 flex items-center gap-1.5">
                    <Gift size={14} className="opacity-80" /> {c.breakdownWelcome}
                  </p>
                  <p className="font-bold text-xl text-white">{loading ? "…" : fmt(balance?.freeBalance ?? 0)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-emerald-200 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="opacity-80" /> {c.breakdownPaid}
                </p>
                <p className="font-bold text-xl text-[#E8B84B] drop-shadow-sm">{loading ? "…" : fmt(balance?.paidBalance ?? 0)}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-white/10">
                <p className="text-xs font-medium text-emerald-200 mb-1.5 flex items-center gap-1.5">
                  <Award size={14} className="opacity-80" /> {c.breakdownEarned}
                </p>
                <p className="font-bold text-xl text-white">{loading ? "…" : fmt(balance?.earnedBalance ?? 0)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Current Plan / Upgrade Section */}
        <section>
          {!isFreeOrNoSub && subscription ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white border border-emerald-100 rounded-2xl shadow-sm gap-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 shadow-inner">
                  <CreditCard size={26} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-emerald-950 flex items-center flex-wrap gap-2">
                    {c.planPrefix} {planName}
                    {subscription.cancelled_at && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                        {c.cancelledNote}
                      </span>
                    )}
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
                  {renewalDate && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <CalendarClock size={13} className="opacity-70" />
                      {subscription.cancelled_at ? c.expiresOn : c.renewsOn} <span className="font-medium text-foreground">{renewalDate}</span>
                    </p>
                  )}
                </div>
              </div>
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
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 sm:p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl shadow-sm gap-6">
              <div className="flex-1">
                <h3 className="font-bold text-lg text-emerald-950 mb-1.5 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#E8B84B]" />
                  {c.upgradePrompt}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{c.upgradeDesc}</p>
              </div>
              <Button onClick={() => setLocation("/teacher/pricing")} className="w-full sm:w-auto shrink-0 group">
                {c.viewPackages}
                <ChevronIcon size={16} className="ml-2 group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1" />
              </Button>
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
                      <h3 className="font-bold text-lg mb-1 text-emerald-950">{pkg.name || `${c.packagePrefix} ${fmt(pkg.credits)}`}</h3>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mb-4 min-h-[2.5rem]">{pkg.description}</p>
                      )}
                      <div className="flex items-baseline gap-1.5 mb-2 mt-4">
                        <span className={`text-4xl font-black tracking-tight ${isRecommended ? "text-emerald-800" : "text-emerald-700"}`}>
                          {fmt(pkg.credits)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">{c.pointsLabel}</span>
                      </div>
                      <p className="text-sm font-medium text-emerald-900/70 mb-6 bg-emerald-50 inline-block px-2.5 py-1 rounded-md">
                        ${(pkg.priceUsdCents / 100).toFixed(2)} — {c.neverExpires}
                      </p>
                      <Button
                        variant={isRecommended ? "default" : "outline"}
                        className={`w-full ${!isRecommended && "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`}
                        onClick={() => setConfirmingPkg(pkg)}
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
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-emerald-950">{p.packageName}</td>
                        <td className="py-3.5 px-5 font-medium text-emerald-800">{fmt(p.credits)}</td>
                        <td className="py-3.5 px-5 text-muted-foreground">${(p.amountCents / 100).toFixed(2)}</td>
                        <td className="py-3.5 px-5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColor[p.paymentStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
                            {statusLabel[p.paymentStatus] ?? p.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-muted-foreground">
                          {new Date(p.purchasedAt ?? p.createdAt).toLocaleDateString(
                            lang === "ar" ? "ar-EG" : "en-US",
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

      {/* Checkout Confirmation Dialog */}
      <AlertDialog open={!!confirmingPkg} onOpenChange={(o) => !o && setConfirmingPkg(null)}>
        <AlertDialogContent dir={dir} className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">{c.checkoutConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-base mt-2 leading-relaxed">
              {c.checkoutConfirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="mt-0">{c.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); confirmingPkg && buy(confirmingPkg); }}
              disabled={buyingId !== null}
              className="bg-emerald-700 hover:bg-emerald-800 text-white min-w-[140px]"
            >
              {buyingId !== null ? <Loader2 size={16} className="animate-spin" /> : c.checkoutConfirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
