import { useEffect, useMemo, useState } from "react";
import {
  CreditCard, Crown, Users, TrendingUp, Save, Loader2, Search,
  Infinity as InfinityIcon, CheckCircle2, AlertCircle, X, Eye, EyeOff,
} from "lucide-react";
import { Card, Button, Input } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Plan = {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  priceMinor: number;
  currency: string;
  billingPeriodDays: number;
  maxStudents: number | null;
  maxClasses: number | null;
  maxHomeworksPerMonth: number | null;
  aiUsageDailyLimit: number | null;
  maxUsers: number | null;
  sortOrder: number;
  isActive: boolean;
  subscriberCount: number;
  activeCount: number;
  lemonVariantId: string | null;
  lemonProductId: string | null;
};

type Overview = {
  plans: Plan[];
  totals: {
    plans: number;
    totalSubscribers: number;
    activeSubscribers: number;
    mrrFils: number;
    currency: string;
  };
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
  planId: number;
  planCode: string;
  planNameAr: string;
  priceMinor: number;
  currency: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
};

type SubView = "overview" | "plans" | "subscribers";

function formatPrice(minor: number, currency: string) {
  const major = (minor / 1000).toFixed(3);
  return `${major} ${currency}`;
}

function limitLabel(v: number | null) {
  return v === null ? "∞" : String(v);
}

/* ─── Pricing Visibility Control ─────────────────────────────────────────── */
export function PricingVisibilityControl() {
  const { t } = useI18n();
  const b = t.billingAdmin;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/billing/admin/overview`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("load failed")))
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

/* ─── BillingTab ─────────────────────────────────────────────────────────── */
export function BillingTab() {
  const { t, lang } = useI18n();
  const b = t.billingAdmin;

  const [view, setView]               = useState<SubView>("overview");
  const [overview, setOverview]       = useState<Overview | null>(null);
  const [loading, setLoading]         = useState(true);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/billing/admin/overview`, { credentials: "include" });
      if (r.ok) setOverview(await r.json());
      else toast.error(b.loadError);
    } catch {
      toast.error(b.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOverview(); }, []);

  if (loading && !overview) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin inline-block ml-2" />
      </div>
    );
  }
  if (!overview) {
    return <div className="text-center py-12 text-muted-foreground">—</div>;
  }

  const editing = editingPlanId != null
    ? overview.plans.find((p) => p.id === editingPlanId) ?? null
    : null;

  const subViews: { key: SubView; label: string; icon: any }[] = [
    { key: "overview",     label: b.overview,     icon: TrendingUp },
    { key: "plans",        label: b.plans,        icon: Crown },
    { key: "subscribers",  label: b.subscribers,  icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex flex-wrap items-center gap-2">
        {subViews.map((s) => (
          <button
            key={s.key}
            onClick={() => setView(s.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              view === s.key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
        <span className={`mr-auto text-xs font-bold px-3 py-1.5 rounded-full ${
          overview.paymentsEnabled
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        }`}>
          {overview.paymentsEnabled ? b.paymentsEnabled : b.testMode}
        </span>
      </div>

      {view === "overview" && <OverviewView overview={overview} lang={lang} b={b} />}
      {view === "plans" && (
        <PlansView
          plans={overview.plans}
          onEdit={(id) => setEditingPlanId(id)}
          lang={lang}
          b={b}
        />
      )}
      {view === "subscribers" && (
        <SubscribersView plans={overview.plans} onChanged={loadOverview} lang={lang} b={b} />
      )}

      {editing && (
        <PlanEditModal
          plan={editing}
          b={b}
          onClose={() => setEditingPlanId(null)}
          onSaved={() => { setEditingPlanId(null); loadOverview(); }}
        />
      )}
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────────────────────── */
function OverviewView({
  overview, lang, b,
}: { overview: Overview; lang: string; b: any }) {
  const { totals, plans } = overview;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Crown}        label={b.kpiPlans}   value={totals.plans}              tone="emerald" />
        <KpiCard icon={Users}        label={b.kpiTotal}   value={totals.totalSubscribers}   tone="blue" />
        <KpiCard icon={CheckCircle2} label={b.kpiActive}  value={totals.activeSubscribers}  tone="amber" />
        <KpiCard icon={TrendingUp}   label={b.kpiMrr}     value={formatPrice(totals.mrrFils, totals.currency)} tone="green" />
      </div>

      <Card className="p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          {b.subscribers}
        </h3>
        <div className="space-y-2">
          {plans.map((p) => {
            const pct = totals.totalSubscribers === 0
              ? 0
              : Math.round((p.subscriberCount / totals.totalSubscribers) * 100);
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-32 text-sm font-bold">
                  {lang === "ar" ? p.nameAr : p.nameEn}
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-24 text-end text-xs text-muted-foreground tabular-nums">
                  {p.subscriberCount} ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number | string; tone: "emerald" | "blue" | "amber" | "green" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600",
    blue:    "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
    amber:   "bg-amber-100 dark:bg-amber-900/30 text-amber-600",
    green:   "bg-primary/10 text-primary",
  };
  return (
    <Card className="p-4 text-center">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground font-bold mt-1">{label}</p>
    </Card>
  );
}

/* ─── Plans ──────────────────────────────────────────────────────────────── */
function PlansView({
  plans, onEdit, lang, b,
}: { plans: Plan[]; onEdit: (id: number) => void; lang: string; b: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {plans.map((p) => {
        const periodLabel = p.billingPeriodDays === 0
          ? b.free
          : p.billingPeriodDays === 30
          ? b.month
          : p.billingPeriodDays === 365
          ? b.year
          : `${p.billingPeriodDays} ${b.day}`;

        return (
          <Card key={p.id} className="p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-extrabold text-lg">{lang === "ar" ? p.nameAr : p.nameEn}</h3>
                <p className="text-[11px] text-muted-foreground font-mono">{p.code}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                p.isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                {p.isActive ? "✓" : "✗"}
              </span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black text-primary tabular-nums">{(p.priceMinor / 1000).toFixed(3)}</span>
              <span className="text-xs text-muted-foreground mr-1">{p.currency} / {periodLabel}</span>
            </div>
            <ul className="text-xs space-y-1 mb-3 text-muted-foreground">
              <li className="flex justify-between"><span>{b.monthlyAssignments}</span><span className="font-bold text-foreground">{limitLabel(p.maxHomeworksPerMonth)}</span></li>
              <li className="flex justify-between"><span>{b.dailyAiMessages}</span><span className="font-bold text-foreground">{limitLabel(p.aiUsageDailyLimit)}</span></li>
              <li className="flex justify-between"><span>{b.maxStudents}</span><span className="font-bold text-foreground">{limitLabel(p.maxStudents)}</span></li>
              <li className="flex justify-between"><span>{b.maxClasses}</span><span className="font-bold text-foreground">{limitLabel(p.maxClasses)}</span></li>
              <li className="flex justify-between"><span>{b.maxTeachers}</span><span className="font-bold text-foreground">{limitLabel(p.maxUsers)}</span></li>
            </ul>
            <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{p.subscriberCount}</span>
              <Button variant="outline" onClick={() => onEdit(p.id)} className="text-xs h-8 px-3">✎</Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Plan Edit Modal ────────────────────────────────────────────────────── */
function PlanEditModal({
  plan, onClose, onSaved, b,
}: { plan: Plan; onClose: () => void; onSaved: () => void; b: any }) {
  const [nameAr, setNameAr]               = useState(plan.nameAr);
  const [nameEn, setNameEn]               = useState(plan.nameEn);
  const [priceMajor, setPriceMajor]       = useState((plan.priceMinor / 1000).toString());
  const [billingPeriodDays, setBillingPeriodDays] = useState(plan.billingPeriodDays);
  const [isActive, setIsActive]           = useState(plan.isActive);
  const [maxStudents, setMaxStudents]     = useState<string>(plan.maxStudents == null ? "" : String(plan.maxStudents));
  const [maxClasses, setMaxClasses]       = useState<string>(plan.maxClasses == null ? "" : String(plan.maxClasses));
  const [maxHw, setMaxHw]                 = useState<string>(plan.maxHomeworksPerMonth == null ? "" : String(plan.maxHomeworksPerMonth));
  const [aiDaily, setAiDaily]             = useState<string>(plan.aiUsageDailyLimit == null ? "" : String(plan.aiUsageDailyLimit));
  const [maxUsers, setMaxUsers]           = useState<string>(plan.maxUsers == null ? "" : String(plan.maxUsers));
  const [lemonVariantId, setLemonVariantId] = useState<string>(plan.lemonVariantId ?? "");
  const [lemonProductId, setLemonProductId] = useState<string>(plan.lemonProductId ?? "");
  const [saving, setSaving]               = useState(false);

  const parseLimit = (s: string): number | null => {
    const trimmed = s.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  /** Returns trimmed string or null for empty; undefined (skip) never returned */
  const parseLemonId = (s: string): string | null => {
    const trimmed = s.trim();
    return trimmed === "" ? null : trimmed;
  };

  const save = async () => {
    const priceNum = Number(priceMajor);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error(b.invalidPrice);
      return;
    }
    // Validate Lemon Squeezy IDs — digits only if provided
    const lsVariant = parseLemonId(lemonVariantId);
    const lsProduct = parseLemonId(lemonProductId);
    if (lsVariant !== null && !/^\d+$/.test(lsVariant)) {
      toast.error("Lemon Squeezy Variant ID يجب أن يكون رقماً صحيحاً");
      return;
    }
    if (lsProduct !== null && !/^\d+$/.test(lsProduct)) {
      toast.error("Lemon Squeezy Product ID يجب أن يكون رقماً صحيحاً");
      return;
    }
    setSaving(true);
    try {
      const body = {
        nameAr, nameEn,
        priceMinor: Math.round(priceNum * 1000),
        billingPeriodDays: Number(billingPeriodDays),
        isActive,
        maxStudents: parseLimit(maxStudents),
        maxClasses: parseLimit(maxClasses),
        maxHomeworksPerMonth: parseLimit(maxHw),
        aiUsageDailyLimit: parseLimit(aiDaily),
        maxUsers: parseLimit(maxUsers),
        lemonVariantId: lsVariant,
        lemonProductId: lsProduct,
      };
      const r = await fetch(`${API_BASE}/api/billing/admin/plans/${plan.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        toast.success(b.savePlanSuccess);
        onSaved();
      } else {
        const data = await r.json().catch(() => ({}));
        toast.error(data.message || b.savePlanError);
      }
    } catch {
      toast.error(b.networkError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">{plan.nameAr} / {plan.nameEn}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={b.planNameAr}>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </Field>
            <Field label={b.planNameEn}>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
            </Field>
            <Field label={`Price (${plan.currency})`}>
              <Input type="number" step="0.001" min="0" value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} dir="ltr" />
            </Field>
            <Field label={b.planDuration}>
              <select
                value={billingPeriodDays}
                onChange={(e) => setBillingPeriodDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
              >
                <option value={0}>Free / lifetime</option>
                <option value={30}>30 days (monthly)</option>
                <option value={90}>90 days (quarterly)</option>
                <option value={365}>365 days (annual)</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
              <InfinityIcon className="w-3 h-3" />
              Leave blank for unlimited
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={b.monthlyAssignments}>
                <Input type="number" min="0" placeholder="∞" value={maxHw} onChange={(e) => setMaxHw(e.target.value)} dir="ltr" />
              </Field>
              <Field label={b.dailyAiMessages}>
                <Input type="number" min="0" placeholder="∞" value={aiDaily} onChange={(e) => setAiDaily(e.target.value)} dir="ltr" />
              </Field>
              <Field label={b.maxStudents}>
                <Input type="number" min="0" placeholder="∞" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} dir="ltr" />
              </Field>
              <Field label={b.maxClasses}>
                <Input type="number" min="0" placeholder="∞" value={maxClasses} onChange={(e) => setMaxClasses(e.target.value)} dir="ltr" />
              </Field>
              <Field label={b.maxTeachers}>
                <Input type="number" min="0" placeholder="∞" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} dir="ltr" />
              </Field>
            </div>
          </div>

          {/* ── Lemon Squeezy Integration ─────────────────────────── */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
              🍋 Lemon Squeezy
              <span className="font-normal opacity-70 ms-1">— digits only, leave blank to unlink</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Lemon Squeezy Variant ID">
                <Input
                  value={lemonVariantId}
                  onChange={(e) => setLemonVariantId(e.target.value)}
                  placeholder="e.g. 2017697"
                  dir="ltr"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Lemon Squeezy Product ID">
                <Input
                  value={lemonProductId}
                  onChange={(e) => setLemonProductId(e.target.value)}
                  placeholder="e.g. 448058"
                  dir="ltr"
                  inputMode="numeric"
                />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm font-bold">Active (shown on pricing page)</span>
          </label>

          {plan.subscriberCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>New limits will apply immediately to {plan.subscriberCount} subscribers in this plan.</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ─── Subscribers ────────────────────────────────────────────────────────── */
function SubscribersView({
  plans, onChanged, lang, b,
}: { plans: Plan[]; onChanged: () => void; lang: string; b: any }) {
  const [rows, setRows]               = useState<SubscriberRow[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [planFilter, setPlanFilter]   = useState<string>("");
  const [search, setSearch]           = useState("");
  const [debounced, setDebounced]     = useState("");
  const [assigning, setAssigning]     = useState<number | null>(null);

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
      const r = await fetch(
        `${API_BASE}/api/billing/admin/subscriptions?${params.toString()}`,
        { credentials: "include" }
      );
      if (r.ok) {
        const data = await r.json();
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } else {
        toast.error(b.subscribersLoadError);
      }
    } catch {
      toast.error(b.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [planFilter, debounced]);

  const assignPlan = async (teacherId: number, planCode: string) => {
    setAssigning(teacherId);
    try {
      const r = await fetch(`${API_BASE}/api/billing/admin/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, planCode }),
      });
      if (r.ok) {
        toast.success(b.updatePlanSuccess);
        load();
        onChanged();
      } else {
        const d = await r.json().catch(() => ({}));
        toast.error(d.message || b.updatePlanError);
      }
    } catch {
      toast.error(b.networkError);
    } finally {
      setAssigning(null);
    }
  };

  const planOptions = useMemo(() => plans.filter((p) => p.isActive), [plans]);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={b.searchPlaceholder}
            className="ps-9"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold min-w-[160px]"
        >
          <option value="">All plans</option>
          {planOptions.map((p) => (
            <option key={p.id} value={p.code}>{lang === "ar" ? p.nameAr : p.nameEn}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {total}
        </span>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin inline-block ml-2" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">—</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-bold text-muted-foreground">
                <tr>
                  <th className="text-start px-3 py-2.5">Teacher</th>
                  <th className="text-start px-3 py-2.5 hidden md:table-cell">Contact</th>
                  <th className="text-start px-3 py-2.5">Plan</th>
                  <th className="text-start px-3 py-2.5 hidden lg:table-cell">Status</th>
                  <th className="text-start px-3 py-2.5 hidden lg:table-cell">Since</th>
                  <th className="text-start px-3 py-2.5">Action</th>
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
                      <div className="text-[11px] text-muted-foreground font-mono">#{r.teacherId}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-xs text-muted-foreground">
                      {r.teacherEmail && <div>{r.teacherEmail}</div>}
                      {r.teacherPhone && <div dir="ltr">{r.teacherPhone}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold">{lang === "ar" ? r.planNameAr : r.planNameAr}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatPrice(r.priceMinor, r.currency)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        r.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                          : "bg-muted text-muted-foreground"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {new Date(r.startedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.planCode}
                        disabled={assigning === r.teacherId}
                        onChange={(e) => assignPlan(r.teacherId, e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-bold"
                      >
                        {planOptions.map((p) => (
                          <option key={p.id} value={p.code}>{lang === "ar" ? p.nameAr : p.nameEn}</option>
                        ))}
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
