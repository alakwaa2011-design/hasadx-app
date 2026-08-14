/**
 * HasadCreditsSystem — الصفحة الإدارية الموحدة «نظام نقاط حصاد».
 * تستبدل تبويب «الباقات والإيرادات» القديم وتوحّد إدارة النظام المعتمد:
 *   Free: 50 نقطة ترحيبية · Basic: $4.99/250/rollover 500 · Pro: $9.99/600/rollover 1200 + خصم 20%
 *   حزم لمرة واحدة: 100/$2.99 · 300/$6.99 · 600/$11.99 (لا تنتهي)
 *
 * الأقسام: الخطط | حزم النقاط | أسعار أدوات الذكاء | اشتراكات المعلمين | الإعدادات | السجل
 * مصادر البيانات: endpoints الحالية فقط (plans / credit_packages / platform_settings /
 * credit_purchases / webhook_events) — لا تغيير خلفي.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Coins, Crown, Users, Package, Settings, ScrollText, Save, Loader2, Search,
  CheckCircle2, AlertCircle, X, Eye, EyeOff, Sparkles, ShieldAlert,
} from "lucide-react";
import { Card, Button, Input } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import { useI18n } from "@/lib/i18n";
import {
  ToolPricesPanel, PackagesPanel, CreditSettingsPanel, BalancesPanel, TransactionsPanel,
} from "@/components/admin/credits-tab";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Plan = {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  priceMinor: number;
  currency: string;
  billingPeriodDays: number;
  isActive: boolean;
  subscriberCount: number;
  activeCount: number;
  lemonVariantId: string | null;
  lemonProductId: string | null;
  monthlyCredits: number | null;
  rolloverCap: number | null;
};

type Overview = {
  plans: Plan[];
  paymentsEnabled: boolean;
  pricingPageVisible: boolean;
};

type SubscriberRow = {
  subscriptionId: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  teacherPhone: string | null;
  isAdmin: boolean;
  planCode: string;
  planNameAr: string;
  status: string;
  startedAt: string;
};

/* ─── Pricing Visibility Control (منقول من billing-tab) ─────────────────── */
export function PricingVisibilityControl() {
  const { t } = useI18n();
  const b = t.billingAdmin;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/billing/admin/overview`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((data: Overview) => setVisible(data.pricingPageVisible === true))
      .catch(() => toast.error(b.visibilityLoadError));
  }, []);

  if (visible === null) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{b.loadingVisibility}</span>
      </Card>
    );
  }

  const nextValue = !visible;
  return (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div className="flex items-start gap-3">
        {visible ? (
          <Eye className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" />
        ) : (
          <EyeOff className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
        )}
        <div>
          <h3 className="font-bold">{b.visibilityTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {visible ? b.visibleDesc : b.hiddenDesc}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant={visible ? "outline" : "default"}
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            const r = await fetch(`${API_BASE}/api/admin/platform-settings`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pricingPageVisible: nextValue }),
            });
            if (!r.ok) throw new Error("update failed");
            setVisible(nextValue);
            toast.success(nextValue ? b.showSuccess : b.hideSuccess);
          } catch {
            toast.error(b.visibilityError);
          } finally {
            setSaving(false);
          }
        }}
        className="shrink-0"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : visible ? b.hideBtn : b.showBtn}
      </Button>
    </Card>
  );
}

/* ─── القسم 1: الخطط ─────────────────────────────────────────────────────── */

function usdLabel(priceMinor: number) {
  // priceMinor بوحدة السنت (USD cents) — كما في seedPlans وصفحة الأسعار العامة
  return `$${(priceMinor / 100).toFixed(2)}`;
}

function PlansSection({ overview, onReload }: { overview: Overview; onReload: () => void }) {
  const [editing, setEditing] = useState<Plan | null>(null);
  // ترتيب ثابت: free → basic → pro؛ أي خطط أخرى تُعرض بعدها
  const order = ["free", "basic", "pro"];
  const plans = [...overview.plans].sort(
    (a, b) => (order.indexOf(a.code) + 99 * Number(order.indexOf(a.code) < 0)) - (order.indexOf(b.code) + 99 * Number(order.indexOf(b.code) < 0))
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((p) => {
          const editable = p.code === "basic" || p.code === "pro";
          return (
            <Card key={p.id} className={`p-4 flex flex-col ${p.code === "pro" ? "border-primary/40" : ""}`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-extrabold text-lg">{p.nameAr}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{p.code}</p>
                </div>
                {!editable && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">للعرض فقط</span>
                )}
              </div>
              <div className="my-2">
                <span className="text-2xl font-black text-primary tabular-nums" dir="ltr">
                  {p.priceMinor === 0 ? "مجاني" : usdLabel(p.priceMinor)}
                </span>
                {p.priceMinor > 0 && <span className="text-xs text-muted-foreground mr-1">/ شهريًا</span>}
              </div>
              <ul className="text-xs space-y-1.5 mb-3 text-muted-foreground">
                {p.code === "free" ? (
                  <li className="flex justify-between">
                    <span>نقاط ترحيبية (مرة واحدة)</span>
                    <span className="font-bold text-foreground">50</span>
                  </li>
                ) : (
                  <>
                    <li className="flex justify-between">
                      <span>النقاط الشهرية</span>
                      <span className="font-bold text-foreground tabular-nums">{p.monthlyCredits ?? "—"}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>سقف الترحيل (rollover)</span>
                      <span className="font-bold text-foreground tabular-nums">{p.rolloverCap ?? "—"}</span>
                    </li>
                  </>
                )}
                {p.code === "pro" && (
                  <li className="flex justify-between">
                    <span>خصم أدوات AI</span>
                    <span className="font-bold text-emerald-600">20%</span>
                  </li>
                )}
                <li className="flex justify-between" dir="ltr">
                  <span className="font-mono text-[10px]">Lemon Product / Variant</span>
                  <span className="font-mono text-[10px] text-foreground">
                    {p.lemonProductId || "—"} / {p.lemonVariantId || "—"}
                  </span>
                </li>
              </ul>
              <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{p.subscriberCount} مشترك</span>
                {editable && (
                  <Button variant="outline" onClick={() => setEditing(p)} className="text-xs h-8 px-3">تعديل</Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <PlanEditModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onReload(); }}
        />
      )}
    </div>
  );
}

function PlanEditModal({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  const [priceMajor, setPriceMajor] = useState((plan.priceMinor / 100).toString());
  const [monthlyCredits, setMonthlyCredits] = useState(plan.monthlyCredits == null ? "" : String(plan.monthlyCredits));
  const [rolloverCap, setRolloverCap] = useState(plan.rolloverCap == null ? "" : String(plan.rolloverCap));
  const [lemonProductId, setLemonProductId] = useState(plan.lemonProductId ?? "");
  const [lemonVariantId, setLemonVariantId] = useState(plan.lemonVariantId ?? "");
  const [saving, setSaving] = useState(false);

  const parseIntOrNull = (s: string): number | null => {
    const t = s.trim();
    if (t === "") return null;
    const n = Math.floor(Number(t));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const parseId = (s: string): string | null => (s.trim() === "" ? null : s.trim());

  const save = async () => {
    const priceNum = Number(priceMajor);
    if (!Number.isFinite(priceNum) || priceNum < 0) { toast.error("سعر غير صالح"); return; }
    const lsP = parseId(lemonProductId);
    const lsV = parseId(lemonVariantId);
    if (lsP !== null && !/^\d+$/.test(lsP)) { toast.error("Lemon Product ID يجب أن يكون رقمًا صحيحًا"); return; }
    if (lsV !== null && !/^\d+$/.test(lsV)) { toast.error("Lemon Variant ID يجب أن يكون رقمًا صحيحًا"); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/billing/admin/plans/${plan.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceMinor: Math.round(priceNum * 100),
          monthlyCredits: parseIntOrNull(monthlyCredits),
          rolloverCap: parseIntOrNull(rolloverCap),
          lemonProductId: lsP,
          lemonVariantId: lsV,
        }),
      });
      if (r.ok) { toast.success("تم حفظ الخطة"); onSaved(); }
      else {
        const d = await r.json().catch(() => ({}));
        toast.error((d as any).message || "فشل الحفظ");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{plan.nameAr}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-muted-foreground block mb-1">السعر الشهري (USD)</span>
            <Input type="number" step="0.01" min="0" value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} dir="ltr" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-muted-foreground block mb-1">النقاط الشهرية</span>
              <Input type="number" min="0" step="1" value={monthlyCredits} onChange={(e) => setMonthlyCredits(e.target.value)} dir="ltr" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-muted-foreground block mb-1">سقف الترحيل (rollover)</span>
              <Input type="number" min="0" step="1" value={rolloverCap} onChange={(e) => setRolloverCap(e.target.value)} dir="ltr" />
            </label>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground mb-2">🍋 Lemon Squeezy — أرقام فقط، اتركه فارغًا لفك الربط</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground block mb-1">Lemon Product ID</span>
                <Input value={lemonProductId} onChange={(e) => setLemonProductId(e.target.value)} placeholder="e.g. 448058" dir="ltr" inputMode="numeric" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground block mb-1">Lemon Variant ID</span>
                <Input value={lemonVariantId} onChange={(e) => setLemonVariantId(e.target.value)} placeholder="e.g. 2017697" dir="ltr" inputMode="numeric" />
              </label>
            </div>
          </div>
          {plan.subscriberCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>التغييرات تسري فورًا على {plan.subscriberCount} مشتركًا في هذه الخطة.</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── القسم 4: اشتراكات المعلمين (تعيين يدوي) ───────────────────────────── */

function AssignSection({ plans }: { plans: Plan[] }) {
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [assigning, setAssigning] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (planFilter) params.set("planCode", planFilter);
      if (debounced) params.set("q", debounced);
      params.set("limit", "200");
      const r = await fetch(`${API_BASE}/api/billing/admin/subscriptions?${params}`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } else toast.error("فشل تحميل الاشتراكات");
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [planFilter, debounced]);

  const assignPlan = async (teacherId: number, planCode: string) => {
    setAssigning(teacherId);
    try {
      const r = await fetch(`${API_BASE}/api/billing/admin/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, planCode }),
      });
      if (r.ok) { toast.success("تم تحديث الخطة"); load(); }
      else {
        const d = await r.json().catch(() => ({}));
        toast.error((d as any).message || "فشل تحديث الخطة");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setAssigning(null);
    }
  };

  const planOptions = useMemo(() => plans.filter((p) => p.isActive), [plans]);

  return (
    <div className="space-y-3" dir="rtl">
      <Card className="p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم أو بريد…" className="ps-9" />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold min-w-[160px]"
        >
          <option value="">كل الخطط</option>
          {planOptions.map((p) => <option key={p.id} value={p.code}>{p.nameAr}</option>)}
        </select>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{total}</span>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">—</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-bold text-muted-foreground">
                <tr>
                  <th className="text-start px-3 py-2.5">المعلم</th>
                  <th className="text-start px-3 py-2.5 hidden md:table-cell">التواصل</th>
                  <th className="text-start px-3 py-2.5">الخطة</th>
                  <th className="text-start px-3 py-2.5 hidden lg:table-cell">الحالة</th>
                  <th className="text-start px-3 py-2.5">تعيين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.subscriptionId} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-bold flex items-center gap-1.5">
                        {r.teacherName}
                        {r.isAdmin && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">#{r.teacherId}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                      {r.teacherEmail && <div dir="ltr">{r.teacherEmail}</div>}
                      {r.teacherPhone && <div dir="ltr">{r.teacherPhone}</div>}
                    </td>
                    <td className="px-3 py-2.5 font-bold">{r.planNameAr}</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" : "bg-muted text-muted-foreground"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.planCode}
                        disabled={assigning === r.teacherId}
                        onChange={(e) => assignPlan(r.teacherId, e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-bold"
                      >
                        {planOptions.map((p) => <option key={p.id} value={p.code}>{p.nameAr}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── القسم 6: سجل المدفوعات والأحداث ──────────────────────────────────── */

function LogsSection() {
  const [view, setView] = useState<"purchases" | "webhooks">("purchases");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const path = view === "purchases" ? "/api/admin/credits/purchases?pageSize=50" : "/api/admin/credits/webhook-events?pageSize=50";
    fetch(`${API_BASE}${path}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (view === "purchases") setPurchases(d.rows ?? []);
        else setEvents(Array.isArray(d) ? d : []);
      })
      .catch(() => toast.error("فشل تحميل السجل"))
      .finally(() => setLoading(false));
  }, [view]);

  const statusColor: Record<string, string> = {
    paid: "text-green-600", processed: "text-green-600",
    pending_checkout: "text-yellow-600", pending: "text-yellow-600",
    failed: "text-red-500", refunded: "text-blue-600",
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex gap-2">
        {([["purchases", "المشتريات"], ["webhooks", "أحداث Webhook"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${view === k ? "bg-primary text-primary-foreground font-semibold" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : view === "purchases" ? (
        purchases.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد مشتريات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-3">#</th>
                  <th className="text-right py-2 px-3">المعلم</th>
                  <th className="text-right py-2 px-3">الباقة</th>
                  <th className="text-right py-2 px-3">المبلغ</th>
                  <th className="text-right py-2 px-3">النقاط</th>
                  <th className="text-right py-2 px-3">الحالة</th>
                  <th className="text-right py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 text-xs text-muted-foreground">{p.id}</td>
                    <td className="py-2 px-3">
                      <p className="font-medium">{p.teacher_name ?? p.teacher_id}</p>
                      {p.teacher_email && <p className="text-xs text-muted-foreground" dir="ltr">{p.teacher_email}</p>}
                    </td>
                    <td className="py-2 px-3 text-xs">{p.package_name_snapshot ?? "—"}</td>
                    <td className="py-2 px-3 tabular-nums" dir="ltr">${((p.amount_cents ?? 0) / 100).toFixed(2)}</td>
                    <td className="py-2 px-3 font-semibold tabular-nums">{p.credits_amount ?? p.package_credits_snapshot ?? "—"}</td>
                    <td className={`py-2 px-3 text-xs font-medium ${statusColor[p.payment_status] ?? ""}`}>{p.payment_status}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleString("ar-SA") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : events.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا توجد أحداث بعد</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-right py-2 px-3">#</th>
                <th className="text-right py-2 px-3">الحدث</th>
                <th className="text-right py-2 px-3">المزوّد</th>
                <th className="text-right py-2 px-3">الحالة</th>
                <th className="text-right py-2 px-3">محاولات</th>
                <th className="text-right py-2 px-3">الخطأ</th>
                <th className="text-right py-2 px-3">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-3 text-xs text-muted-foreground">{e.id}</td>
                  <td className="py-2 px-3 font-mono text-xs" dir="ltr">{e.event_name}</td>
                  <td className="py-2 px-3 text-xs">{e.provider}</td>
                  <td className={`py-2 px-3 text-xs font-medium ${statusColor[e.status] ?? ""}`}>{e.status}</td>
                  <td className="py-2 px-3 text-xs tabular-nums">{e.attempts}</td>
                  <td className="py-2 px-3 text-xs text-red-500 max-w-[200px] truncate" dir="ltr">{e.error_message ?? "—"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleString("ar-SA") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── الصفحة الموحدة ─────────────────────────────────────────────────────── */

type Section = "plans" | "packages" | "tools" | "assign" | "balances" | "transactions" | "settings" | "logs";

export function HasadCreditsSystem() {
  const [section, setSection] = useState<Section>("plans");
  const [overview, setOverview] = useState<Overview | null>(null);

  const loadOverview = () => {
    fetch(`${API_BASE}/api/billing/admin/overview`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOverview)
      .catch(() => toast.error("فشل تحميل بيانات الخطط"));
  };
  useEffect(() => { loadOverview(); }, []);

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "plans",    label: "الخطط",              icon: <Crown size={15} /> },
    { key: "packages", label: "حزم النقاط",          icon: <Package size={15} /> },
    { key: "tools",    label: "أسعار أدوات الذكاء",  icon: <Coins size={15} /> },
    { key: "assign",   label: "اشتراكات المعلمين",   icon: <Users size={15} /> },
    { key: "balances",     label: "أرصدة المعلمين",  icon: <Coins size={15} /> },
    { key: "transactions", label: "حركات الرصيد",    icon: <ScrollText size={15} /> },
    { key: "settings", label: "إعدادات النظام",      icon: <Settings size={15} /> },
    { key: "logs",     label: "السجل",               icon: <ScrollText size={15} /> },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            نظام نقاط حصاد
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة موحدة للخطط وحزم النقاط وأسعار الأدوات والإعدادات
          </p>
        </div>
        {overview && (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            overview.paymentsEnabled
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}>
            {overview.paymentsEnabled ? "المدفوعات مفعّلة" : "المدفوعات غير مفعّلة"}
          </span>
        )}
      </div>

      {/* Section bar */}
      <div className="flex gap-2 flex-wrap">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
              section === s.key
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div>
        {section === "plans" && (
          overview
            ? <PlansSection overview={overview} onReload={loadOverview} />
            : <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
        )}

        {section === "packages" && <PackagesPanel />}

        {section === "tools" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
              <Sparkles className="w-4 h-4 shrink-0 text-primary" />
              <span>مشتركو <strong>Pro</strong> يستهلكون تلقائيًا <strong>80%</strong> من السعر المعروض (خصم 20% مطبَّق في الخادم).</span>
            </div>
            <ToolPricesPanel />
          </div>
        )}

        {section === "assign" && (
          overview
            ? <AssignSection plans={overview.plans} />
            : <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
        )}

        {section === "balances" && <BalancesPanel />}

        {section === "transactions" && <TransactionsPanel />}

        {section === "settings" && (
          <div className="space-y-4">
            {/* حالة المدفوعات — قراءة فقط، محمية عمدًا */}
            <Card className="p-4 max-w-lg">
              <div className="flex items-start gap-3">
                <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${overview?.paymentsEnabled ? "text-emerald-600" : "text-amber-500"}`} />
                <div>
                  <h3 className="font-bold">حالة المدفوعات (PAYMENTS_ENABLED)</h3>
                  <p className="text-sm mt-1">
                    {overview?.paymentsEnabled ? (
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> مفعّلة — أزرار الشراء والترقية تعمل
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300 font-semibold">غير مفعّلة — كل مسارات الدفع محجوبة</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    هذا الإعداد متغيّر بيئي على الخادم ولا يُفعَّل من هذه الصفحة عمدًا — التفعيل يتطلب ضبط
                    <code className="font-mono mx-1" dir="ltr">PAYMENTS_ENABLED=true</code>
                    مع اكتمال ربط Lemon Squeezy وتأكيدًا صريحًا.
                  </p>
                </div>
              </div>
            </Card>

            {/* ظهور صفحة الباقات للمعلمين */}
            <div className="max-w-lg">
              <PricingVisibilityControl />
            </div>

            {/* إعدادات النقاط: التفعيل + نقاط الترحيب + وضع الاختبار */}
            <CreditSettingsPanel onChanged={loadOverview} />
          </div>
        )}

        {section === "logs" && <LogsSection />}
      </div>
    </div>
  );
}
