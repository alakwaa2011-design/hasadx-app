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
} from "lucide-react";
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
  maxStudents: number | null;
  maxClasses: number | null;
  isActive: boolean;
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

// ─── Free items included in EVERY plan (always shown first) ──────────────────
const FREE_FOR_ALL = [
  "إنشاء الفصول وإضافة الطلاب مجاناً",
  "وصول كامل لجميع الألعاب والتحكم بها",
  "إنشاء أسئلة وأنشطة واختبارات يدوياً",
  "مشاركة الأنشطة مع الطلاب بلا حدود",
];

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    // FREE_FOR_ALL يُضاف تلقائياً في وقت العرض
    "أدوات الذكاء الاصطناعي تستهلك من رصيدك الشهري",
  ],
  basic: [
    // FREE_FOR_ALL يُضاف تلقائياً في وقت العرض
    "جميع أدوات الذكاء الاصطناعي",
    "تقارير تفصيلية للطلاب",
    "مراسلة أولياء الأمور ومتابعتهم",
  ],
  pro: [
    // FREE_FOR_ALL يُضاف تلقائياً في وقت العرض
    "جميع مميزات الأساسي",
    "مراسلة أولياء الأمور ومتابعتهم",
    "أولوية في المعالجة",
    "دعم متقدم",
  ],
};

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [pricingPageVisible, setPricingPageVisible] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState(false);

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
      .catch(() => toast("فشل تحميل بيانات الاشتراكات", { className: "text-red-500" }))
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
        throw new Error((err as any).message || "تعذر إنشاء رابط الدفع");
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
        throw new Error((err as any).message || "تعذر إلغاء الاشتراك");
      }
      toast("تم إلغاء الاشتراك. ستبقى مشتركاً حتى نهاية الدورة المدفوعة الحالية.");
      // Reload subscription state
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
        <div dir="rtl" className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
            <Sparkles className="mx-auto mb-4 text-emerald-700" size={30} />
            <h1 className="text-2xl font-extrabold">الباقات غير متاحة حالياً</h1>
            <p className="mt-3 text-muted-foreground">
              سيتم الإعلان عن الباقات وخيارات الاشتراك عند تفعيلها من إدارة المنصة.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // Ensure deterministic order: free → basic → pro
  const orderedPlans = ["free", "basic", "pro"]
    .map((code) => plans.find((p) => p.code === code))
    .filter(Boolean) as Plan[];

  return (
    <Layout>
      <div dir="rtl" className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="inline-flex items-center gap-2 bg-emerald-800/10 text-emerald-800 text-sm font-medium px-4 py-1.5 rounded-full mb-2">
            <Sparkles size={15} />
            باقات حصاد
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">اختر الباقة المناسبة لك</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            نقاط شهرية لاستخدام أدوات الذكاء الاصطناعي — تتراكم النقاط غير المستخدمة حتى الشهر التالي
          </p>
        </div>

        {/* Plan cards */}
        {loading ? (
          <p className="text-center text-muted-foreground py-12">جارٍ التحميل…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {orderedPlans.map((plan) => {
              const Icon       = PLAN_ICONS[plan.code] ?? Sparkles;
              const isCurrent  = plan.code === currentPlanCode && isActive;
              const isPro      = plan.code === "pro";
              const isFree     = plan.code === "free";
              const priceUSD   = (plan.priceMinor / 100).toFixed(2);
              const features   = [...FREE_FOR_ALL, ...(PLAN_FEATURES[plan.code] ?? [])];

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
                      الأفضل قيمة
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -top-3.5 right-5 bg-emerald-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                      باقتك الحالية
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
                      <Icon
                        size={20}
                        className={isPro ? "text-[#E8B84B]" : "text-emerald-700"}
                      />
                    </div>
                    <div>
                      <p className={["font-bold text-lg", isPro ? "text-white" : ""].join(" ")}>
                        {plan.nameAr}
                      </p>
                      <p className={["text-xs", isPro ? "text-white/70" : "text-muted-foreground"].join(" ")}>
                        {plan.nameEn}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    {isFree ? (
                      <p className="text-3xl font-extrabold">مجاناً</p>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className={["text-3xl font-extrabold", isPro ? "text-white" : "text-emerald-800"].join(" ")}>
                          ${priceUSD}
                        </span>
                        <span className={isPro ? "text-white/70 text-sm" : "text-muted-foreground text-sm"}>
                          / شهر
                        </span>
                      </div>
                    )}
                    <p className={["text-sm mt-0.5", isPro ? "text-white/70" : "text-muted-foreground"].join(" ")}>
                      {plan.monthlyCredits} نقطة شهرياً
                      {plan.rolloverCap ? ` · تتراكم حتى ${plan.rolloverCap}` : " (بدون تراكم)"}
                    </p>
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check
                          size={15}
                          className={[
                            "shrink-0 mt-0.5",
                            isPro ? "text-[#E8B84B]" : "text-emerald-700",
                          ].join(" ")}
                        />
                        <span className={isPro ? "text-white/90" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-auto space-y-2">
                    {isCurrent ? (
                      <>
                        <Button
                          variant={isPro ? "secondary" : "outline"}
                          className="w-full"
                          onClick={() => setLocation("/teacher/credits")}
                        >
                          إدارة الاشتراك
                        </Button>
                        {/* Cancel — only for paid plans not already cancelled */}
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
                                إلغاء الاشتراك
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إلغاء الاشتراك</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2 text-right">
                                  <span className="block">
                                    {currentSub?.current_period_end
                                      ? `ستبقى مشتركاً حتى ${new Date(currentSub.current_period_end).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}.`
                                      : "ستبقى مشتركاً حتى نهاية الدورة المدفوعة الحالية."}
                                  </span>
                                  <span className="block">
                                    لن تحصل على نقاط اشتراك جديدة بعد هذا التاريخ. نقاطك الحالية ونقاط الشراء لن تتأثر.
                                  </span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>رجوع</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleCancel}
                                  disabled={cancelling}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  {cancelling ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 size={14} className="animate-spin" />
                                      جارٍ الإلغاء…
                                    </span>
                                  ) : "تأكيد الإلغاء"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    ) : isFree ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled
                      >
                        باقة البداية
                      </Button>
                    ) : (
                      <Button
                        variant={isPro ? "secondary" : "default"}
                        className={[
                          "w-full",
                          isPro ? "bg-white text-emerald-900 hover:bg-white/90" : "",
                        ].join(" ")}
                        onClick={() => handleUpgrade(plan.code)}
                        disabled={checkingOut !== null}
                      >
                        {checkingOut === plan.code ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin" />
                            جارٍ التحويل…
                          </span>
                        ) : (
                          `الترقية إلى ${plan.nameAr}`
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
          <p className="font-medium">نقاط إضافية (دفعة واحدة · لا تنتهي أبداً)</p>
          <p>100 نقطة · $2.99 &nbsp;|&nbsp; 300 نقطة · $6.99 &nbsp;|&nbsp; 600 نقطة · $11.99</p>
          <button
            type="button"
            onClick={() => setLocation("/teacher/credits")}
            className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800 mt-1"
          >
            شراء نقاط إضافية ←
          </button>
        </div>
      </div>
    </Layout>
  );
}
