/**
 * CreditsTab — Admin-only panel for the credits system.
 * 5 sub-tabs: أسعار الأدوات | أرصدة المعلمين | سجل الحركات | الباقات | الإعدادات
 * Sits inside /teacher/admin under the "إدارة الرصيد" section.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Coins, Settings, Package, Users, BarChart2, Pencil, RotateCcw, X, Check,
  Download, Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  RefreshCw, Search,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Card, Button, Input } from "@/components/ui-elements";

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
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string | null;
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

interface Summary {
  totalEarned: number;
  totalSpent: number;
  totalHeld: number;
  teacherCount: number;
  operationCount: number;
  refundCount: number;
  topTools: { tool_key: string; total_credits: number }[];
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
          <p className="text-sm font-semibold mb-3">أكثر الأدوات استهلاكاً للرصيد</p>
          <div className="flex flex-wrap gap-2">
            {(summary?.topTools ?? []).map((t: any, i) => (
              <span key={t.tool_key} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                {i + 1}. {t.tool_key} — {fmt(t.total_credits)} رصيد
              </span>
            ))}
          </div>
        </Card>
      )}

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

function ToolPricesPanel() {
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
                    <button onClick={() => toggleEnabled(row)} className="text-primary hover:opacity-70">
                      {row.isCreditEnabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
                    </button>
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
                <label className="text-sm text-muted-foreground block mb-1">تكلفة الرصيد</label>
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

function BalancesPanel() {
  const [rows, setRows] = useState<TeacherBalance[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
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

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/admin/credits/teachers?page=${page}&pageSize=30${q ? `&q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows); setTotal(d.total); })
      .catch(() => toast("فشل تحميل الأرصدة", { className: "text-red-500" }))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const saveAdjust = async () => {
    if (!adjusting || !reason.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/credits/teachers/${adjusting.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta: parseInt(delta), reason, mode }),
      });
      toast("تم تعديل الرصيد");
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

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
          <Input className="pr-8" placeholder="بحث باسم أو بريد…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
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
                  <th className="text-right py-2 px-3">الرصيد</th>
                  <th className="text-right py-2 px-3">المكتسب</th>
                  <th className="text-right py-2 px-3">المُنفَق</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </td>
                    <td className="py-2 px-3 font-bold text-primary">{fmt(row.balance)}</td>
                    <td className="py-2 px-3 text-green-600">{fmt(row.totalEarned)}</td>
                    <td className="py-2 px-3 text-red-500">{fmt(row.totalSpent)}</td>
                    <td className="py-2 px-3">
                      <button onClick={() => { setAdjusting(row); setDelta(""); setReason(""); setMode("add"); }} className="text-muted-foreground hover:text-primary">
                        <Pencil size={14} />
                      </button>
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

      {/* Adjust modal */}
      {adjusting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdjusting(null)}>
          <div className="bg-background rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="font-semibold mb-4">تعديل رصيد: {adjusting.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">الرصيد الحالي: <strong>{fmt(adjusting.balance)}</strong></p>
            <div className="flex gap-2 mb-3">
              {(["add", "deduct", "set"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {m === "add" ? "إضافة" : m === "deduct" ? "خصم" : "تعيين"}
                </button>
              ))}
            </div>
            <Input type="number" placeholder="المبلغ" value={delta} onChange={(e) => setDelta(e.target.value)} className="mb-2" />
            <Input placeholder="السبب (مطلوب)" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-4" />
            <div className="flex gap-2">
              <Button variant="default" className="flex-1" onClick={saveAdjust} disabled={saving || !reason.trim()}>
                {saving ? "جارٍ الحفظ…" : "تطبيق"}
              </Button>
              <Button variant="ghost" onClick={() => setAdjusting(null)}>إلغاء</Button>
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

function TransactionsPanel() {
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

function PackagesPanel() {
  const [rows, setRows] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPkg, setNewPkg] = useState({ priceUsdCents: "", credits: "", sortOrder: "0" });
  const [adding, setAdding] = useState(false);

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
    if (!newPkg.priceUsdCents || !newPkg.credits) return;
    setAdding(true);
    try {
      await apiFetch("/api/admin/credits/packages", {
        method: "POST",
        body: JSON.stringify({ priceUsdCents: parseInt(newPkg.priceUsdCents), credits: parseInt(newPkg.credits), sortOrder: parseInt(newPkg.sortOrder) }),
      });
      toast("تمت الإضافة");
      setNewPkg({ priceUsdCents: "", credits: "", sortOrder: "0" });
      load();
    } catch (err: any) {
      toast(err.message, { className: "text-red-500" });
    } finally {
      setAdding(false);
    }
  };

  const toggleVisible = async (pkg: CreditPackage) => {
    await apiFetch(`/api/admin/credits/packages/${pkg.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isVisible: !pkg.isVisible }),
    });
    setRows((prev) => prev.map((p) => (p.id === pkg.id ? { ...p, isVisible: !p.isVisible } : p)));
  };

  const deletePkg = async (id: number) => {
    if (!confirm("حذف هذه الباقة؟")) return;
    await apiFetch(`/api/admin/credits/packages/${id}`, { method: "DELETE" });
    setRows((prev) => prev.filter((p) => p.id !== id));
    toast("تم الحذف");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold mb-3">إضافة باقة جديدة</p>
        <div className="flex gap-2 flex-wrap">
          <Input type="number" placeholder="السعر (سنت USD)" className="w-36"
            value={newPkg.priceUsdCents} onChange={(e) => setNewPkg((p) => ({ ...p, priceUsdCents: e.target.value }))} />
          <Input type="number" placeholder="عدد النقاط" className="w-36"
            value={newPkg.credits} onChange={(e) => setNewPkg((p) => ({ ...p, credits: e.target.value }))} />
          <Input type="number" placeholder="الترتيب" className="w-24"
            value={newPkg.sortOrder} onChange={(e) => setNewPkg((p) => ({ ...p, sortOrder: e.target.value }))} />
          <Button variant="default" onClick={addPkg} disabled={adding || !newPkg.priceUsdCents || !newPkg.credits}>
            <Plus size={14} className="ml-1" />{adding ? "جارٍ…" : "إضافة"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-right py-2 px-3">السعر (سنت)</th>
                <th className="text-right py-2 px-3">النقاط</th>
                <th className="text-right py-2 px-3">الترتيب</th>
                <th className="text-right py-2 px-3">مرئي</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pkg) => (
                <tr key={pkg.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-3">${(pkg.priceUsdCents / 100).toFixed(2)}</td>
                  <td className="py-2 px-3 font-semibold">{fmt(pkg.credits)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{pkg.sortOrder}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => toggleVisible(pkg)}>
                      {pkg.isVisible ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => deletePkg(pkg.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function CreditSettingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<CreditSettings>({ creditsEnabled: false, welcomeCredits: 120, adminCreditTestMode: false });
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
            <p className="font-semibold">تفعيل نظام الرصيد</p>
            <p className="text-sm text-muted-foreground">عند التعطيل: لا تُخصَم أي نقاط ولا يرى أي مستخدم الرصيد</p>
          </div>
          <button
            onClick={() => save({ creditsEnabled: !settings.creditsEnabled })}
            disabled={saving}
            className="text-primary"
          >
            {settings.creditsEnabled
              ? <ToggleRight size={36} className="text-green-500" />
              : <ToggleLeft size={36} className="text-muted-foreground" />}
          </button>
        </div>

        {/* Welcome credits */}
        <div>
          <p className="font-semibold mb-2">رصيد الترحيب</p>
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
            <p className="text-sm text-muted-foreground">تفعيل الرصيد لحساب المسؤول فقط دون تغيير الإعداد العام</p>
          </div>
          <button
            onClick={() => save({ adminCreditTestMode: !settings.adminCreditTestMode })}
            disabled={saving}
          >
            {settings.adminCreditTestMode
              ? <ToggleRight size={36} className="text-blue-500" />
              : <ToggleLeft size={36} className="text-muted-foreground" />}
          </button>
        </div>
      </Card>

      <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>ملاحظة:</strong> نظام الرصيد حالياً في وضع البنية التحتية — لا يرى المعلمون أو الطلاب أي تغيير حتى يتم تفعيل النظام رسمياً.
          الجداول جاهزة، وأسعار الأدوات محفوظة في قاعدة البيانات ويمكن تعديلها في أي وقت.
        </p>
      </Card>
    </div>
  );
}
