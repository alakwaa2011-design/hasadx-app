/**
 * صفحة «الرصيد والباقات» للمعلم.
 * - ملخص الرصيد (اشتراك / مجاني / مشترى / مكتسب)
 * - بطاقة الاشتراك الشهري الحالي مع تاريخ التجديد وحالة الدفع
 * - شراء رصيد إضافي (دفعة واحدة)
 * - سجل المشتريات
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import {
  Coins, Sparkles, Gift, Award, ShoppingCart, Loader2,
  CheckCircle2, Clock, ReceiptText, ShieldCheck,
  CalendarClock, AlertCircle, CreditCard,
} from "lucide-react";

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

const fmt = (n: number) => n.toLocaleString("ar-EG");

const statusLabel: Record<string, string> = {
  pending_checkout:    "بانتظار الدفع",
  completed:           "مكتملة",
  partially_refunded:  "استرجاع جزئي",
  refunded:            "مسترجعة",
  failed:              "فاشلة",
};
const statusColor: Record<string, string> = {
  pending_checkout:    "text-amber-600 bg-amber-50",
  completed:           "text-emerald-700 bg-emerald-50",
  partially_refunded:  "text-orange-600 bg-orange-50",
  refunded:            "text-red-500 bg-red-50",
  failed:              "text-red-500 bg-red-50",
};

const paymentStatusLabel: Record<string, { label: string; color: string }> = {
  active:      { label: "نشط",          color: "text-emerald-700 bg-emerald-50" },
  past_due:    { label: "دفعة متأخرة",  color: "text-amber-600 bg-amber-50" },
  unpaid:      { label: "غير مدفوع",    color: "text-red-500 bg-red-50" },
  cancelled:   { label: "ملغى",         color: "text-muted-foreground bg-muted" },
  expired:     { label: "منتهي",        color: "text-muted-foreground bg-muted" },
};

export default function TeacherCreditsPage() {
  const [, setLocation] = useLocation();

  const [balance,          setBalance]          = useState<BalanceDetail | null>(null);
  const [subscription,     setSubscription]     = useState<SubInfo | null>(null);
  const [packages,         setPackages]         = useState<Pkg[]>([]);
  const [purchasesEnabled, setPurchasesEnabled] = useState(true);
  const [purchases,        setPurchases]        = useState<Purchase[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [buyingId,         setBuyingId]         = useState<number | null>(null);

  // حالة العودة من الدفع (?intent=...)
  const [pendingIntent,  setPendingIntent]  = useState<string | null>(null);
  const [intentStatus,   setIntentStatus]   = useState<"waiting" | "confirmed" | "timeout" | null>(null);
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
      .catch(() => toast("فشل تحميل بيانات الرصيد", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    if (intent) {
      setPendingIntent(intent);
      setIntentStatus("waiting");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Polling لحالة العملية بعد العودة من الدفع
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
        throw new Error((err as any).message || "تعذر إنشاء صفحة الدفع");
      }
      const { checkoutUrl } = await r.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
      setBuyingId(null);
    }
  };

  const isFreeOrNoSub = !subscription || subscription.plan_code === "free";
  const renewalDate   = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("ar-SA", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;
  const payStatusInfo = paymentStatusLabel[subscription?.payment_status ?? ""] ?? null;

  return (
    <Layout>
      <div dir="rtl" className="max-w-5xl mx-auto space-y-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center">
              <Coins size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">نقاط حصاد</h1>
              <p className="text-sm text-muted-foreground">أدوات الذكاء الاصطناعي في حصاد</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setLocation("/teacher/pricing")}>
            <Sparkles size={15} className="ml-1 text-[#E8B84B]" />
            عرض الباقات الشهرية
          </Button>
        </div>

        {/* إشعار العودة من الدفع */}
        {intentStatus === "waiting" && (
          <Card className="p-4 border-amber-200 bg-amber-50 flex items-center gap-3">
            <Loader2 size={20} className="text-amber-600 animate-spin shrink-0" />
            <p className="text-sm text-amber-800">تم استلام طلب الدفع. ستظهر النقاط بعد تأكيد العملية.</p>
          </Card>
        )}
        {intentStatus === "confirmed" && (
          <Card className="p-4 border-emerald-200 bg-emerald-50 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-700 shrink-0" />
            <p className="text-sm text-emerald-800">تمت العملية بنجاح وأُضيفت النقاط إلى حسابك.</p>
          </Card>
        )}
        {intentStatus === "timeout" && (
          <Card className="p-4 border-orange-200 bg-orange-50 flex items-center gap-3">
            <Clock size={20} className="text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800">
              تعذر تأكيد العملية حاليًا. لم تُحتسب النقاط مرتين. تحقق من سجل العمليات أو تواصل مع الدعم.
            </p>
          </Card>
        )}

        {/* بطاقة الاشتراك الشهري */}
        {!isFreeOrNoSub && subscription && (
          <Card className="p-5 border-emerald-200 bg-emerald-50/60">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center shrink-0">
                  <CreditCard size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900">
                    باقة {subscription.plan_name_ar}
                    {subscription.cancelled_at && (
                      <span className="mr-2 text-xs font-normal text-amber-600">· ملغى في نهاية الدورة</span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {payStatusInfo && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payStatusInfo.color}`}>
                        {payStatusInfo.label}
                      </span>
                    )}
                    {renewalDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarClock size={12} />
                        {subscription.cancelled_at ? "ينتهي" : "يتجدد"} في {renewalDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className="text-sm text-muted-foreground">
                  {subscription.monthly_credits} نقطة شهرياً
                  {subscription.rollover_cap ? ` · تتراكم حتى ${subscription.rollover_cap}` : ""}
                </p>
                <Button variant="outline" className="text-xs h-8 mt-1" onClick={() => setLocation("/teacher/pricing")}>
                  إدارة الاشتراك
                </Button>
              </div>
            </div>
            {subscription.payment_status === "past_due" && (
              <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <p>يوجد دفعة متأخرة. قد تتوقف النقاط الشهرية حتى إتمام الدفع.</p>
              </div>
            )}
          </Card>
        )}

        {/* تفصيل الرصيد */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-emerald-800 text-white border-0">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={16} className="text-[#E8B84B]" />
              <span className="text-xs opacity-80">إجمالي النقاط</span>
            </div>
            <p className="text-2xl font-bold">{loading ? "…" : fmt(balance?.balance ?? 0)}</p>
          </Card>

          {!isFreeOrNoSub ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-emerald-700" />
                <span className="text-xs text-muted-foreground">نقاط الاشتراك</span>
              </div>
              <p className="text-2xl font-bold text-emerald-800">
                {loading ? "…" : fmt(balance?.subscriptionBalance ?? 0)}
              </p>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gift size={16} className="text-amber-600" />
                <span className="text-xs text-muted-foreground">مجاني</span>
              </div>
              <p className="text-2xl font-bold">{loading ? "…" : fmt(balance?.freeBalance ?? 0)}</p>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-emerald-700" />
              <span className="text-xs text-muted-foreground">مدفوع (دائم)</span>
            </div>
            <p className="text-2xl font-bold text-emerald-800">{loading ? "…" : fmt(balance?.paidBalance ?? 0)}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award size={16} className="text-sky-600" />
              <span className="text-xs text-muted-foreground">مكتسب</span>
            </div>
            <p className="text-2xl font-bold">{loading ? "…" : fmt(balance?.earnedBalance ?? 0)}</p>
          </Card>
        </div>

        {/* ترقية من الباقة المجانية */}
        {isFreeOrNoSub && (
          <Card className="p-5 border-dashed border-emerald-600/40 bg-emerald-50/40 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-emerald-800">هل تريد المزيد من النقاط الشهرية؟</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Basic: 250 نقطة/شهر · Pro: 600 نقطة/شهر — تتراكم النقاط غير المستخدمة
              </p>
            </div>
            <Button onClick={() => setLocation("/teacher/pricing")}>
              <Sparkles size={15} className="ml-1" />
              عرض الباقات
            </Button>
          </Card>
        )}

        {/* باقات الرصيد الإضافي (دفعة واحدة) */}
        <div>
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Sparkles size={17} className="text-[#E8B84B]" />
            نقاط إضافية — دفعة واحدة
          </h2>
          {!purchasesEnabled && (
            <Card className="p-4 mb-3 bg-muted/40">
              <p className="text-sm text-muted-foreground">الشراء غير متاح حالياً — سيتوفر قريباً.</p>
            </Card>
          )}
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
          ) : packages.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">لا توجد باقات متاحة حالياً.</Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`p-5 relative flex flex-col ${pkg.isFeatured ? "border-2 border-[#E8B84B] shadow-md" : ""}`}
                >
                  {pkg.isFeatured && (
                    <span className="absolute -top-3 right-4 bg-[#E8B84B] text-emerald-950 text-xs font-bold px-3 py-0.5 rounded-full">
                      الأكثر قيمة
                    </span>
                  )}
                  <p className="font-bold mb-1">{pkg.name || `باقة ${fmt(pkg.credits)}`}</p>
                  {pkg.description && (
                    <p className="text-xs text-muted-foreground mb-2">{pkg.description}</p>
                  )}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-extrabold text-emerald-800">{fmt(pkg.credits)}</span>
                    <span className="text-sm text-muted-foreground">نقطة</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    ${(pkg.priceUsdCents / 100).toFixed(2)} — لا تنتهي صلاحيته
                  </p>
                  <Button
                    variant="default"
                    onClick={() => buy(pkg)}
                    disabled={!purchasesEnabled || buyingId !== null}
                  >
                    {buyingId === pkg.id
                      ? <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> جارٍ التحويل…</span>
                      : <span className="flex items-center gap-2"><ShoppingCart size={15} /> شراء النقاط</span>}
                  </Button>
                </Card>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            النقاط المدفوعة لا تنتهي صلاحيتها أبداً. تُخصم نقاط الاشتراك أولاً عند الاستخدام.
          </p>
        </div>

        {/* سجل المشتريات */}
        <div>
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <ReceiptText size={17} className="text-emerald-700" />
            سجل المشتريات
          </h2>
          {purchases.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">لا توجد مشتريات بعد.</Card>
          ) : (
            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right py-2.5 px-4">الباقة</th>
                    <th className="text-right py-2.5 px-4">الرصيد</th>
                    <th className="text-right py-2.5 px-4">المبلغ</th>
                    <th className="text-right py-2.5 px-4">الحالة</th>
                    <th className="text-right py-2.5 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-medium">{p.packageName}</td>
                      <td className="py-2.5 px-4">{fmt(p.credits)}</td>
                      <td className="py-2.5 px-4">${(p.amountCents / 100).toFixed(2)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.paymentStatus] ?? "bg-muted"}`}>
                          {statusLabel[p.paymentStatus] ?? p.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {new Date(p.purchasedAt ?? p.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
