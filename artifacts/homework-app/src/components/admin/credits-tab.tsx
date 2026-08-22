/**
 * CreditsTab — Admin-only panel for the credits system.
 * 5 sub-tabs: أسعار الأدوات | أرصدة المعلمين | سجل الحركات | الباقات | الإعدادات
 * Sits inside /teacher/admin under the "إدارة الرصيد" section.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Coins, Settings, Package, Users, BarChart2, Pencil, RotateCcw, X, Check,
  Download, Plus, Trash2, ChevronDown, ChevronUp,
  RefreshCw, Search, Infinity, Minus, AlertTriangle, Gift,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Card, Button, Input } from "@/components/ui-elements";
import { Switch } from "@/components/ui/switch";

const API = import.meta.env.VITE_API_URL || "";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("ar-SA");
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as any).message ?? r.statusText);
  }
  return r;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolPrice {
  toolKey: string;
  toolNameAr: string;
  category: string;
  creditsCost: number;
  defaultCreditsCost: number;
  isCreditEnabled: boolean;
  timeoutSeconds: number;
  updatedAt: string;
}

interface TeacherBalance {
  id: number;
  name: string;
  email: string | null;
  unlimitedCredits: boolean;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string | null;
  planCode: string | null;
  planNameAr: string | null;
  subscriptionStatus: string | null;
  planExpiresAt: string | null;
}

/** تسميات عربية لحالة الاشتراك — القيم الداخلية لا تُعرض للمستخدم */
const STATUS_AR: Record<string, string> = {
  active: "نشطة",
  canceled: "ملغاة",
  cancelled: "ملغاة",
  expired: "منتهية",
  past_due: "متأخرة السداد",
};

interface GrantablePlan {
  code: string;
  nameAr: string;
  monthlyCredits: number | null;
}

interface Transaction {
  id: number;
  teacherId: number;
  amount: number;
  type: string;
  reason: string | null;
  toolKey: string | null;
  status: string;
  adminId: number | null;
  createdAt: string;
}

interface CreditPackage {
  id: number;
  priceUsdCents: number;
  credits: number;
  sortOrder: number;
  isVisible: boolean;
}

interface CreditSettings {
  creditsEnabled: boolean;
  welcomeCredits: number;
  adminCreditTestMode: boolean;
}

interface MissingTeacher {
  id: number;
  name: string;
  email: string | null;
  created_at: string;
}

interface Summary {
  totalEarned: number;
  totalSpent: number;
  totalHeld: number;
  teacherCount: number;
  operationCount: number;
  refundCount: number;
  topTools: { tool_key: string; total_credits: number }[];
}

// ─── Missing Welcome Credits Alert ────────────────────────────────────────────

function MissingWelcomeAlert() {
  const [rows, setRows]           = useState<MissingTeacher[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(false);
  const [grantingAll, setGrantingAll] = useState(false);
  const [grantingId, setGrantingId]   = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/admin/credits/missing-welcome?pageSize=200")
      .then((r) => r.json())
      .then((d) => { setRows(d.rows); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const grantOne = async (id: number) => {
    setGrantingId(id);
    try {
      await apiFetch(`/api/admin/credits/missing-welcome/grant/${id}`, { method: "POST" });
      toast("تم منح نقاط الترحيب");
      load();
    } catch (err: any) {
      toast(err.message ?? "فشل المنح", { className: "text-red-500" });
    } finally {
      setGrantingId(null);
    }
  };

  const grantAll = async () => {
    if (!window.confirm(`منح نقاط الترحيب لـ ${total} معلم؟`)) return;
    setGrantingAll(true);
    try {
      const r = await apiFetch("/api/admin/credits/missing-welcome/grant-all", { method: "POST" });
      const d = await r.json();
      toast(d.message);
      load();
    } catch (err: any) {
      toast(err.message ?? "فشل المنح الجماعي", { className: "text-red-500" });
    } finally {
      setGrantingAll(false);
    }
  };

  // While loading the first time — show nothing to avoid flash
  if (loading && total === 0) return null;
  // No missing teachers — no alert needed
  if (!loading && total === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="font-semibold text-sm">
            {total} معلم{total !== 1 ? "ين" : ""} بلا نقاط ترحيبية
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400">
            (فشل المنح التلقائي عند تسجيل الدخول)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={load}
            className="text-xs h-7 px-2 text-amber-700 dark:text-amber-300"
          >
            <RefreshCw size={12} />
          </Button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
          >
            {expanded ? "إخفاء القائمة" : "عرض القائمة"}
          </button>
          <Button
            onClick={grantAll}
            disabled={grantingAll}
            className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Gift size={12} />
            {grantingAll ? "جارٍ المنح…" : `منح الجميع (${total})`}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-amber-200 dark:border-amber-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200 text-right">
                <th className="py-2 px-3 font-medium">المعلم</th>
                <th className="py-2 px-3 font-medium">البريد الإلكتروني</th>
                <th className="py-2 px-3 font-medium">تاريخ التسجيل</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10">
                  <td className="py-2 px-3 font-medium">{r.name}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs">{r.email ?? "—"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground" dir="ltr">
                    {new Date(r.created_at).toLocaleDateString("ar", { numberingSystem: "latn" })}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => grantOne(r.id)}
                      disabled={grantingId === r.id}
                      className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50"
                    >
                      <Gift size={11} />
                      {grantingId === r.id ? "جارٍ…" : "منح"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > rows.length && (
            <p className="text-xs text-center text-muted-foreground py-2">
              يُعرض {rows.length} من {total} — استخدم "منح الجميع" لمعالجة الكامل
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main CreditsTab ──────────────────────────────────────────────────────────

type SubTab = "prices" | "balances" | "transactions" | "packages" | "settings";

export function CreditsTab() {
  const [sub, setSub] = useState<SubTab>("prices");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/credits/summary")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: "prices",       label: "أسعار الأدوات",   icon: <Coins size={15} /> },
    { key: "balances",     label: "أرصدة المعلمين",  icon: <Users size={15} /> },
    { key: "transactions", label: "سجل الحركات",     icon: <BarChart2 size={15} /> },
    { key: "packages",     label: "الباقات",          icon: <Package size={15} /> },
    { key: "settings",     label: "الإعدادات",        icon: <Settings size={15} /> },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "إجمالي المكتسب",   value: fmt(summary.totalEarned) },
            { label: "إجمالي المُنفَق",   value: fmt(summary.totalSpent) },
            { label: "قيد التنفيذ",       value: fmt(summary.totalHeld) },
            { label: "المعلمون",          value: fmt(summary.teacherCount) },
            { label: "العمليات",          value: fmt(summary.operationCount) },
            { label: "المُستردّات",       value: fmt(summary.refundCount) },
          ].map((c) => (
            <Card key={c.label} className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Top-5 tools */}
      {(summary?.topTools?.length ?? 0) > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">أكثر الأدوات استهلاكاً للنقاط</p>
          <div className="flex flex-wrap gap-2">
            {(summary?.topTools ?? []).map((t: any, i) => (
              <span key={t.tool_key} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {i + 1}. {t.tool_key} — {fmt(t.total_credits)} نقطة
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Alert: teachers missing welcome credits */}
      <MissingWelcomeAlert />

      {/* Sub-tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
              sub === t.key
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div>
        {sub === "prices"       && <ToolPricesPanel />}
        {sub === "balances"     && <BalancesPanel />}
        {sub === "transactions" && <TransactionsPanel />}
        {sub === "packages"     && <PackagesPanel />}
        {sub === "settings"     && <CreditSettingsPanel onChanged={() => {
          apiFetch("/api/admin/credits/summary").then((r) => r.json()).then(setSummary).catch(() => {});
        }} />}
      </div>
    </div>
  );
}

// ─── Tool Prices Panel ────────────────────────────────────────────────────────

export function ToolPricesPanel() {
  const [rows, setRows] = useState<ToolPrice[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ToolPrice | null>(null);
  const [editCost, setEditCost] = useState("");
  const [editTimeout, setEditTimeout] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/admin/credits/tool-prices${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => toast("فشل تحميل الأسعار", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row: ToolPrice) => {
    setEditing(row);
    setEditCost(String(row.creditsCost));
    setEditTimeout(String(row.timeoutSeconds));
  };

  const saveEdit = async (reset = false) => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = reset
        ? { reset: true }
        : { creditsCost: parseInt(editCost), timeoutSeconds: parseInt(editTimeout) };
      const r = await apiFetch(`/api/admin/credits/tool-prices/${editing.toolKey}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const updated = await r.json();
      setRows((prev) => prev.map((p) => (p.toolKey === updated.toolKey ? updated : p)));
      setEditing(null);
      toast("تم الحفظ");
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row: ToolPrice) => {
    try {
      const r = await apiFetch(`/api/admin/credits/tool-prices/${row.toolKey}`, {
        method: "PATCH",
        body: JSON.stringify({ isCreditEnabled: !row.isCreditEnabled }),
      });
      const updated = await r.json();
      setRows((prev) => prev.map((p) => (p.toolKey === updated.toolKey ? updated : p)));
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    }
  };

  const categories: Record<string, string> = { ai: "أدوات AI", game: "الألعاب", tool: "أدوات عامة" };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
          <Input
            className="pr-8"
            placeholder="بحث عن أداة..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="ghost" onClick={load}><RefreshCw size={14} /></Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-right py-2 px-3">الأداة</th>
                <th className="text-right py-2 px-3">التصنيف</th>
                <th className="text-right py-2 px-3">الرصيد</th>
                <th className="text-right py-2 px-3">المهلة (ث)</th>
                <th className="text-right py-2 px-3">مفعّل</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.toolKey} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-medium">
                    <span className="font-mono text-xs text-muted-foreground ml-1">{row.toolKey}</span>
                    <span>{row.toolNameAr}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {categories[row.category] ?? row.category}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold">{row.creditsCost}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.timeoutSeconds}ث</td>
                  <td className="py-2 px-3">
                    <Switch
                      checked={row.isCreditEnabled}
                      onCheckedChange={() => toggleEnabled(row)}
                      labelVariant="none"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => openEdit(row)} className="text-muted-foreground hover:text-primary">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">تعديل: {editing.toolNameAr}</h3>
              <button onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">تكلفة النقاط</label>
                <Input type="number" min="0" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">الافتراضي: {editing.defaultCreditsCost}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">المهلة (ثانية)</label>
                <Input type="number" min="1" value={editTimeout} onChange={(e) => setEditTimeout(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="default" className="flex-1" onClick={() => saveEdit(false)} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : <><Check size={14} className="ml-1" />حفظ</>}
              </Button>
              <Button variant="ghost" onClick={() => saveEdit(true)} disabled={saving} title="إعادة التعيين للقيمة الافتراضية">
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Balances Panel ───────────────────────────────────────────────────────────

export function BalancesPanel() {
  const [rows, setRows] = useState<TeacherBalance[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [adjusting, setAdjusting] = useState<TeacherBalance | null>(null);
  const [delta, setDelta] = useState("");
  const [mode, setMode] = useState<"add" | "deduct" | "set">("add");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDelta, setBulkDelta] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [unlimitedModal, setUnlimitedModal] = useState<TeacherBalance | null>(null);
  const [unlimitedReason, setUnlimitedReason] = useState("");
  const [unlimitedSaving, setUnlimitedSaving] = useState(false);
  const [grantModal, setGrantModal] = useState<TeacherBalance | null>(null);
  const [grantPlanCode, setGrantPlanCode] = useState<"basic" | "pro" | "">("");
  const [grantId, setGrantId] = useState("");
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantablePlans, setGrantablePlans] = useState<GrantablePlan[]>([]);

  useEffect(() => {
    apiFetch("/api/billing/plans")
      .then((r) => r.json())
      .then((plans: any[]) =>
        setGrantablePlans(
          plans
            .filter((p) => p.code === "basic" || p.code === "pro")
            .map((p) => ({ code: p.code, nameAr: p.nameAr, monthlyCredits: p.monthlyCredits })),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/admin/credits/teachers?pageSize=all${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows); setTotal(d.total); })
      .catch(() => toast("فشل تحميل الأرصدة", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const saveAdjust = async () => {
    if (!adjusting || !reason.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/credits/teachers/${adjusting.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta: parseInt(delta), reason, mode }),
      });
      toast("تم تعديل النقاط");
      setAdjusting(null);
      setDelta(""); setReason(""); setMode("add");
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setSaving(false);
    }
  };

  const saveBulk = async () => {
    if (!bulkReason.trim()) return;
    setBulkSaving(true);
    try {
      const res = await apiFetch("/api/admin/credits/teachers/bulk-adjust", {
        method: "POST",
        body: JSON.stringify({ delta: parseInt(bulkDelta), reason: bulkReason }),
      });
      const d = await res.json();
      toast(d.message);
      setBulkOpen(false); setBulkDelta(""); setBulkReason("");
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setBulkSaving(false);
    }
  };

  const saveToggleUnlimited = async () => {
    if (!unlimitedModal || !unlimitedReason.trim()) return;
    setUnlimitedSaving(true);
    try {
      const res = await apiFetch(`/api/admin/credits/teachers/${unlimitedModal.id}/toggle-unlimited`, {
        method: "POST",
        body: JSON.stringify({ reason: unlimitedReason }),
      });
      const d = await res.json();
      toast(d.unlimitedCredits ? "تم تفعيل الاستخدام غير المحدود" : "تم إلغاء الاستخدام غير المحدود");
      setUnlimitedModal(null);
      setUnlimitedReason("");
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setUnlimitedSaving(false);
    }
  };

  const openGrantModal = (row: TeacherBalance) => {
    setGrantModal(row);
    setGrantPlanCode("");
    // grantId ثابت لكل فتح للحوار — يمنع النقر المزدوج/إعادة الطلب من مضاعفة المنح
    setGrantId(crypto.randomUUID());
  };

  const saveGrantPlan = async () => {
    if (!grantModal || !grantPlanCode || !grantId) return;
    setGrantSaving(true);
    try {
      const res = await apiFetch("/api/billing/admin/grant-plan", {
        method: "POST",
        body: JSON.stringify({ teacherId: grantModal.id, planCode: grantPlanCode, grantId }),
      });
      const d = await res.json();
      const expiry = d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("ar", { numberingSystem: "latn" }) : "—";
      toast(`تم منح باقة ${d.planNameAr} — ${fmt(d.granted)} نقطة اشتراك، تنتهي في ${expiry}`);
      setGrantModal(null);
      setGrantPlanCode("");
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setGrantSaving(false);
    }
  };

  const planBadge = (row: TeacherBalance) => {
    const code = row.planCode ?? "free";
    const label = row.planNameAr ?? "مجانية";
    const cls =
      code === "pro"
        ? "bg-primary/10 text-primary"
        : code === "basic"
          ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          : "bg-muted text-muted-foreground";
    return (
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
        {label}
        {row.subscriptionStatus && row.subscriptionStatus !== "active" && (
          <span className="opacity-70"> · {STATUS_AR[row.subscriptionStatus] ?? row.subscriptionStatus}</span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
          <Input className="pr-8" placeholder="بحث باسم أو بريد…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="self-center text-xs text-muted-foreground">{total} معلّمًا</span>
        <Button variant="ghost" onClick={load}><RefreshCw size={14} /></Button>
        <Button variant="ghost" onClick={() => setBulkOpen(true)}>تعديل جماعي</Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-3">المعلم</th>
                  <th className="text-right py-2 px-3">باقة حصاد</th>
                  <th className="text-right py-2 px-3">النقاط</th>
                  <th className="text-right py-2 px-3">المكتسب</th>
                  <th className="text-right py-2 px-3">المُنفَق</th>
                  <th className="text-right py-2 px-3">غير محدود</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`border-b hover:bg-muted/30 ${row.unlimitedCredits ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        {row.unlimitedCredits && <Infinity size={12} className="text-amber-500 shrink-0" />}
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        {planBadge(row)}
                        <button
                          onClick={() => openGrantModal(row)}
                          className="text-[11px] font-bold text-primary hover:underline whitespace-nowrap"
                          title="منح باقة حصاد يدوياً مع نقاط الاشتراك"
                        >
                          منح باقة
                        </button>
                      </div>
                      {row.planExpiresAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                          {new Date(row.planExpiresAt).toLocaleDateString("ar", { numberingSystem: "latn" })}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3 font-bold text-primary">{fmt(row.balance)}</td>
                    <td className="py-2 px-3 text-green-600">{fmt(row.totalEarned)}</td>
                    <td className="py-2 px-3 text-red-500">{fmt(row.totalSpent)}</td>
                    <td className="py-2 px-3">
                      <Switch
                        checked={Boolean(row.unlimitedCredits)}
                        onCheckedChange={() => { setUnlimitedModal(row); setUnlimitedReason(""); }}
                        labelVariant="none"
                        title={row.unlimitedCredits ? "إلغاء الاستخدام غير المحدود" : "تفعيل الاستخدام غير المحدود"}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <button onClick={() => { setAdjusting(row); setDelta(""); setReason(""); setMode("add"); }} className="text-muted-foreground hover:text-primary" title="تعديل رصيد يدوي">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Adjust modal */}
      {adjusting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdjusting(null)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">تعديل نقاط يدوياً</h3>
                <p className="text-sm text-muted-foreground">{adjusting.name}</p>
              </div>
              <button onClick={() => setAdjusting(null)}><X size={16} /></button>
            </div>
            <div className="bg-muted/40 rounded-lg px-4 py-2 mb-4 text-sm">
              النقاط الحالية: <strong className="text-primary">{fmt(adjusting.balance)}</strong> نقطة
              {adjusting.unlimitedCredits && (
                <span className="mr-2 text-amber-600 text-xs flex items-center gap-1 inline-flex">
                  <Infinity size={12} /> استخدام غير محدود مفعّل
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">نوع العملية</p>
            <div className="flex gap-2 mb-3">
              {(["add", "deduct", "set"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {m === "add" ? <><Plus size={12} />إضافة</> : m === "deduct" ? <><Minus size={12} />خصم</> : "تعيين"}
                </button>
              ))}
            </div>
            <Input type="number" placeholder="المبلغ (نقطة)" value={delta} onChange={(e) => setDelta(e.target.value)} className="mb-2" />
            <Input placeholder="السبب — يُسجَّل في السجل المالي (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-1" />
            <p className="text-xs text-muted-foreground mb-4">تُسجَّل العملية باسمك ووقتها في credit_transactions (المصدر: admin_adjustment)</p>
            <div className="flex gap-2">
              <Button variant="default" className="flex-1" onClick={saveAdjust} disabled={saving || !reason.trim() || !delta}>
                {saving ? "جارٍ الحفظ…" : "تطبيق التعديل"}
              </Button>
              <Button variant="ghost" onClick={() => setAdjusting(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual plan grant modal */}
      {grantModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setGrantModal(null)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">منح باقة حصاد</h3>
                <p className="text-sm text-muted-foreground">{grantModal.name}</p>
              </div>
              <button onClick={() => setGrantModal(null)}><X size={16} /></button>
            </div>
            <div className="bg-muted/40 rounded-lg px-4 py-2 mb-4 text-sm space-y-1">
              <p>الباقة الحالية: {planBadge(grantModal)}</p>
              <p>الرصيد الحالي: <strong className="text-primary">{fmt(grantModal.balance)}</strong> نقطة</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">اختر الباقة الممنوحة</p>
            <div className="flex flex-col gap-2 mb-3">
              {grantablePlans.map((p) => (
                <button
                  key={p.code}
                  onClick={() => setGrantPlanCode(p.code as "basic" | "pro")}
                  className={`flex items-center justify-between text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                    grantPlanCode === p.code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="font-bold">{p.nameAr}</span>
                  <span className="text-xs">{fmt(p.monthlyCredits)} نقطة اشتراك</span>
                </button>
              ))}
              {grantablePlans.length === 0 && (
                <p className="text-xs text-muted-foreground">جارٍ تحميل الباقات…</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              المنح اليدوي يفعّل الباقة لمدة دورة الباقة المحددة (حالياً شهر واحد)، ولا ينشئ تجديداً أو دفعة في Lemon Squeezy.
            </p>
            <div className="flex gap-2">
              <Button variant="default" className="flex-1" onClick={saveGrantPlan} disabled={grantSaving || !grantPlanCode}>
                {grantSaving ? "جارٍ التنفيذ…" : "تأكيد منح الباقة"}
              </Button>
              <Button variant="ghost" onClick={() => setGrantModal(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {/* Unlimited credits toggle modal */}
      {unlimitedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUnlimitedModal(null)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Infinity size={18} className="text-amber-500" />
                  {unlimitedModal.unlimitedCredits ? "إلغاء" : "تفعيل"} الاستخدام غير المحدود
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{unlimitedModal.name}</p>
              </div>
              <button onClick={() => setUnlimitedModal(null)}><X size={16} /></button>
            </div>

            {unlimitedModal.unlimitedCredits ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 text-sm text-amber-800 dark:text-amber-200">
                هذا المعلم يستخدم جميع الأدوات حالياً بدون خصم نقاط. إلغاء التفعيل يُعيده فوراً لنظام النقاط الطبيعي.
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-800 dark:text-blue-200">
                بعد التفعيل، يستطيع هذا المعلم استخدام جميع الأدوات المدفوعة دون خصم رصيده. يُسجَّل كل استخدام للإحصائيات بمبلغ 0.
              </div>
            )}

            <Input
              placeholder="سبب التغيير — يُسجَّل مع اسمك ووقته (مطلوب)"
              value={unlimitedReason}
              onChange={(e) => setUnlimitedReason(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button
                variant="default"
                className={`flex-1 ${unlimitedModal.unlimitedCredits ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                onClick={saveToggleUnlimited}
                disabled={unlimitedSaving || !unlimitedReason.trim()}
              >
                {unlimitedSaving ? "جارٍ الحفظ…" : unlimitedModal.unlimitedCredits ? "إلغاء التفعيل" : "تفعيل"}
              </Button>
              <Button variant="ghost" onClick={() => setUnlimitedModal(null)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk adjust modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBulkOpen(false)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="font-semibold mb-4">تعديل جماعي لجميع المعلمين</h3>
            <Input type="number" placeholder="المبلغ (موجب = إضافة، سالب = خصم)" value={bulkDelta} onChange={(e) => setBulkDelta(e.target.value)} className="mb-2" />
            <Input placeholder="السبب (مطلوب)" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} className="mb-4" />
            <div className="flex gap-2">
              <Button variant="default" className="flex-1" onClick={saveBulk} disabled={bulkSaving || !bulkReason.trim()}>
                {bulkSaving ? "جارٍ التطبيق…" : "تطبيق على الكل"}
              </Button>
              <Button variant="ghost" onClick={() => setBulkOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Transactions Panel ───────────────────────────────────────────────────────

export function TransactionsPanel() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ type: "", status: "", toolKey: "" });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filters.type)    params.set("type",    filters.type);
    if (filters.status)  params.set("status",  filters.status);
    if (filters.toolKey) params.set("toolKey", filters.toolKey);
    apiFetch(`/api/admin/credits/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows); setTotal(d.total); })
      .catch(() => toast("فشل تحميل السجل", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (filters.type)    params.set("type",    filters.type);
    if (filters.status)  params.set("status",  filters.status);
    if (filters.toolKey) params.set("toolKey", filters.toolKey);
    window.open(`${API}/api/admin/credits/transactions/export.csv?${params}`, "_blank");
  };

  const typeLabel: Record<string, string> = { earn: "اكتساب", spend: "إنفاق", adjust: "تعديل", refund: "استرداد" };
  const statusLabel: Record<string, string> = { pending: "قيد التنفيذ", completed: "مكتمل", refunded: "مُسترَد" };
  const statusColor: Record<string, string> = { pending: "text-yellow-600", completed: "text-green-600", refunded: "text-blue-600" };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select className="text-sm border rounded-lg px-2 py-1.5 bg-background"
          value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">كل الأنواع</option>
          <option value="earn">اكتساب</option>
          <option value="spend">إنفاق</option>
          <option value="adjust">تعديل</option>
          <option value="refund">استرداد</option>
        </select>
        <select className="text-sm border rounded-lg px-2 py-1.5 bg-background"
          value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">كل الحالات</option>
          <option value="pending">قيد التنفيذ</option>
          <option value="completed">مكتمل</option>
          <option value="refunded">مُسترَد</option>
        </select>
        <Input placeholder="مفتاح الأداة…" className="w-36"
          value={filters.toolKey} onChange={(e) => setFilters((f) => ({ ...f, toolKey: e.target.value }))} />
        <Button variant="ghost" onClick={load}><RefreshCw size={14} /></Button>
        <Button variant="ghost" onClick={exportCsv}><Download size={14} className="ml-1" />CSV</Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-right py-2 px-3">#</th>
                  <th className="text-right py-2 px-3">المعلم</th>
                  <th className="text-right py-2 px-3">المبلغ</th>
                  <th className="text-right py-2 px-3">النوع</th>
                  <th className="text-right py-2 px-3">الأداة</th>
                  <th className="text-right py-2 px-3">الحالة</th>
                  <th className="text-right py-2 px-3">السبب</th>
                  <th className="text-right py-2 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground text-xs">{row.id}</td>
                    <td className="py-2 px-3">{row.teacherId}</td>
                    <td className={`py-2 px-3 font-semibold ${row.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {row.amount >= 0 ? "+" : ""}{row.amount}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{typeLabel[row.type] ?? row.type}</span>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{row.toolKey ?? "—"}</td>
                    <td className={`py-2 px-3 text-xs font-medium ${statusColor[row.status] ?? ""}`}>
                      {statusLabel[row.status] ?? row.status}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground max-w-[180px] truncate">{row.reason ?? "—"}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2 justify-center">
              <Button variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
              <span className="text-sm self-center">{page} / {totalPages}</span>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Packages Panel ───────────────────────────────────────────────────────────

export function PackagesPanel() {
  const [rows, setRows] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPkg, setNewPkg] = useState({ name: "", priceUsdCents: "", credits: "", sortOrder: "0", lemonProductId: "", lemonVariantId: "" });
  const [adding, setAdding] = useState(false);
  const [editLemon, setEditLemon] = useState<{ id: number; productId: string; variantId: string } | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/api/admin/credits/packages")
      .then((r) => r.json())
      .then(setRows)
      .catch(() => toast("فشل تحميل الباقات", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addPkg = async () => {
    if (!newPkg.name || !newPkg.priceUsdCents || !newPkg.credits) return;
    setAdding(true);
    try {
      await apiFetch("/api/admin/credits/packages", {
        method: "POST",
        body: JSON.stringify({
          name: newPkg.name,
          priceUsdCents: parseInt(newPkg.priceUsdCents),
          credits: parseInt(newPkg.credits),
          sortOrder: parseInt(newPkg.sortOrder),
          lemonProductId: newPkg.lemonProductId || null,
          lemonVariantId: newPkg.lemonVariantId || null,
        }),
      });
      toast("تمت الإضافة");
      setNewPkg({ name: "", priceUsdCents: "", credits: "", sortOrder: "0", lemonProductId: "", lemonVariantId: "" });
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setAdding(false);
    }
  };

  const patchPkg = async (id: number, patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/admin/credits/packages/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    }
  };

  const archivePkg = async (pkg: CreditPackage) => {
    const archived = Boolean((pkg as any).archivedAt);
    try {
      await apiFetch(`/api/admin/credits/packages/${pkg.id}/${archived ? "unarchive" : "archive"}`, { method: "POST" });
      toast(archived ? "أُلغيت الأرشفة" : "تمت الأرشفة");
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    }
  };

  const deletePkg = async (id: number) => {
    if (!confirm("حذف هذه الباقة نهائياً؟ (الباقات المرتبطة بمشتريات لا تُحذف — تُؤرشف)")) return;
    try {
      await apiFetch(`/api/admin/credits/packages/${id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast("تم الحذف");
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">إضافة باقة جديدة</p>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="اسم الباقة" className="w-40"
            value={newPkg.name} onChange={(e) => setNewPkg((p) => ({ ...p, name: e.target.value }))} />
          <Input type="number" placeholder="السعر (سنت USD)" className="w-36"
            value={newPkg.priceUsdCents} onChange={(e) => setNewPkg((p) => ({ ...p, priceUsdCents: e.target.value }))} />
          <Input type="number" placeholder="عدد النقاط" className="w-32"
            value={newPkg.credits} onChange={(e) => setNewPkg((p) => ({ ...p, credits: e.target.value }))} />
          <Input type="number" placeholder="الترتيب" className="w-24"
            value={newPkg.sortOrder} onChange={(e) => setNewPkg((p) => ({ ...p, sortOrder: e.target.value }))} />
          <Input placeholder="Lemon Product ID" className="w-40" dir="ltr"
            value={newPkg.lemonProductId} onChange={(e) => setNewPkg((p) => ({ ...p, lemonProductId: e.target.value }))} />
          <Input placeholder="Lemon Variant ID" className="w-40" dir="ltr"
            value={newPkg.lemonVariantId} onChange={(e) => setNewPkg((p) => ({ ...p, lemonVariantId: e.target.value }))} />
          <Button variant="default" onClick={addPkg} disabled={adding || !newPkg.name || !newPkg.priceUsdCents || !newPkg.credits}>
            <Plus size={14} className="ml-1" />{adding ? "جارٍ…" : "إضافة"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Product ID وVariant ID من لوحة Lemon Squeezy — بدون Variant ID لا يمكن شراء الباقة.</p>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-right py-2 px-3">الاسم</th>
                <th className="text-right py-2 px-3">السعر</th>
                <th className="text-right py-2 px-3">النقاط</th>
                <th className="text-right py-2 px-3">Lemon (Product / Variant)</th>
                <th className="text-right py-2 px-3">الترتيب</th>
                <th className="text-right py-2 px-3">موصى بها</th>
                <th className="text-right py-2 px-3">مرئي</th>
                <th className="text-right py-2 px-3">الحالة</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pkg) => {
                const archived = Boolean((pkg as any).archivedAt);
                return (
                <tr key={pkg.id} className={`border-b hover:bg-muted/30 ${archived ? "opacity-50" : ""}`}>
                  <td className="py-2 px-3 font-medium">{(pkg as any).name || "—"}</td>
                  <td className="py-2 px-3">${(pkg.priceUsdCents / 100).toFixed(2)}</td>
                  <td className="py-2 px-3 font-semibold">{fmt(pkg.credits)}</td>
                  <td className="py-2 px-3" dir="ltr">
                    {editLemon?.id === pkg.id ? (
                      <span className="flex gap-1 items-center">
                        <Input className="w-28 h-7 text-xs" dir="ltr" placeholder="Product ID" value={editLemon.productId}
                          onChange={(e) => setEditLemon({ ...editLemon, productId: e.target.value })} />
                        <Input className="w-28 h-7 text-xs" dir="ltr" placeholder="Variant ID" value={editLemon.variantId}
                          onChange={(e) => setEditLemon({ ...editLemon, variantId: e.target.value })} />
                        <Button variant="ghost" onClick={async () => {
                          await patchPkg(pkg.id, {
                            lemonProductId: editLemon.productId.trim() || null,
                            lemonVariantId: editLemon.variantId.trim() || null,
                          });
                          setEditLemon(null);
                        }}>حفظ</Button>
                      </span>
                    ) : (
                      <button className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
                        onClick={() => setEditLemon({ id: pkg.id, productId: (pkg as any).lemonProductId ?? "", variantId: (pkg as any).lemonVariantId ?? "" })}>
                        {((pkg as any).lemonProductId || (pkg as any).lemonVariantId)
                          ? `${(pkg as any).lemonProductId || "—"} / ${(pkg as any).lemonVariantId || "—"}`
                          : "ربط"}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{pkg.sortOrder}</td>
                  <td className="py-2 px-3">
                    <Switch
                      checked={Boolean((pkg as any).isFeatured)}
                      onCheckedChange={() => patchPkg(pkg.id, { isFeatured: !(pkg as any).isFeatured })}
                      labelVariant="none"
                      title="باقة موصى بها واحدة فقط"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Switch
                      checked={pkg.isVisible}
                      onCheckedChange={() => patchPkg(pkg.id, { isVisible: !pkg.isVisible })}
                      labelVariant="visibility"
                    />
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <button onClick={() => archivePkg(pkg)} className={archived ? "text-orange-500" : "text-muted-foreground hover:text-foreground"}>
                      {archived ? "مؤرشفة — استعادة" : "أرشفة"}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => deletePkg(pkg.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

export function CreditSettingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<CreditSettings>({ creditsEnabled: false, welcomeCredits: 50, adminCreditTestMode: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/credits/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<CreditSettings>) => {
    setSaving(true);
    try {
      const r = await apiFetch("/api/admin/credits/settings", { method: "PATCH", body: JSON.stringify(patch) });
      const updated = await r.json();
      setSettings(updated);
      onChanged?.();
      toast("تم الحفظ");
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4 max-w-lg" dir="rtl">
      <Card className="p-5 space-y-5">
        {/* Global toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">تفعيل نظام النقاط</p>
            <p className="text-sm text-muted-foreground">عند التعطيل: لا تُخصَم أي نقاط ولا يرى أي مستخدم النقاط</p>
          </div>
          <Switch
            checked={settings.creditsEnabled}
            onCheckedChange={(v) => save({ creditsEnabled: v })}
            disabled={saving}
          />
        </div>

        {/* Welcome credits */}
        <div>
          <p className="font-semibold mb-2">نقاط الترحيب</p>
          <p className="text-sm text-muted-foreground mb-2">النقاط المُمنوحة تلقائياً عند التسجيل (يُطبَّق عند تفعيل النظام)</p>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              value={settings.welcomeCredits}
              onChange={(e) => setSettings((s) => ({ ...s, welcomeCredits: parseInt(e.target.value) || 0 }))}
              className="w-32"
            />
            <Button variant="default" onClick={() => save({ welcomeCredits: settings.welcomeCredits })} disabled={saving}>
              حفظ
            </Button>
          </div>
        </div>

        {/* Admin test mode */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">وضع الاختبار للمسؤول</p>
            <p className="text-sm text-muted-foreground">تفعيل النقاط لحساب المسؤول فقط دون تغيير الإعداد العام</p>
          </div>
          <Switch
            checked={settings.adminCreditTestMode}
            onCheckedChange={(v) => save({ adminCreditTestMode: v })}
            disabled={saving}
          />
        </div>
      </Card>

      <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>ملاحظة:</strong> نظام النقاط حالياً في وضع البنية التحتية — لا يرى المعلمون أو الطلاب أي تغيير حتى يتم تفعيل النظام رسمياً.
          الجداول جاهزة، وأسعار الأدوات محفوظة في قاعدة البيانات ويمكن تعديلها في أي وقت.
        </p>
      </Card>
    </div>
  );
}
