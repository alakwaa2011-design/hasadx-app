import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui-elements";
import { Activity, Download, Filter, Search, AlertTriangle, Users, Eye, BarChart3, RefreshCcw } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Lang = "ar" | "en";

interface LogRow {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string;
  action: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  pageUrl: string | null;
  createdAt: string;
}

interface ListResponse {
  items: LogRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface StatsResponse {
  activeUsersToday: number;
  topPages: Array<{ pageUrl: string; count: number }>;
  topUsers: Array<{ userId: number; userName: string | null; userRole: string; count: number }>;
  recent: LogRow[];
  totals: { all: number; today: number };
}

interface AlertsResponse {
  highRate: Array<{ userId: number; userName: string | null; userRole: string; count: number }>;
  concurrentLogins: Array<{ userId: number; userName: string | null; userRole: string; ips: string[] }>;
  unauthorized: LogRow[];
}

const ACTION_LABELS_AR: Record<string, string> = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  create_homework: "إنشاء واجب",
  edit_homework: "تعديل واجب",
  delete_homework: "حذف واجب",
  start_game: "بدء مسابقة",
  end_game: "انتهاء مسابقة",
  join_game: "دخول لعبة",
  create_quiz: "إنشاء اختبار",
  view: "عرض صفحة",
  ai_use: "استخدام الذكاء",
  settings_change: "تغيير إعدادات",
  unauthorized_access: "محاولة وصول غير مصرح",
  delete: "حذف",
  edit: "تعديل",
};

const ROLE_LABELS_AR: Record<string, string> = {
  teacher: "معلم",
  organizer: "منظّم",
  student: "طالب",
  admin: "مسؤول",
  visitor: "زائر",
};

function actionLabel(a: string, lang: Lang) {
  if (lang === "ar") return ACTION_LABELS_AR[a] ?? a;
  return a.replace(/_/g, " ");
}
function roleLabel(r: string, lang: Lang) {
  if (lang === "ar") return ROLE_LABELS_AR[r] ?? r;
  return r;
}

export function ActivityTab({ lang }: { lang: Lang }) {
  const [items, setItems] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);

  const [filterRole, setFilterRole] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (filterRole) p.set("userRole", filterRole);
    if (filterAction) p.set("action", filterAction);
    if (filterUserId) p.set("userId", filterUserId);
    if (filterFrom) p.set("from", filterFrom);
    if (filterTo) p.set("to", filterTo);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [page, pageSize, filterRole, filterAction, filterUserId, filterFrom, filterTo, search]);

  async function loadList() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/activity-logs?${queryString}`, { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      const data: ListResponse = await r.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast.error(lang === "ar" ? "تعذّر جلب السجل" : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const r = await fetch(`${API_BASE}/api/admin/activity-logs/stats`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch { /* ignore */ }
  }

  async function loadAlerts() {
    try {
      const r = await fetch(`${API_BASE}/api/admin/activity-alerts`, { credentials: "include" });
      if (r.ok) setAlerts(await r.json());
    } catch { /* ignore */ }
  }

  useEffect(() => { loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [queryString]);
  useEffect(() => { loadStats(); loadAlerts(); }, []);

  const onExport = () => {
    const url = `${API_BASE}/api/admin/activity-logs/export?${queryString}`;
    window.open(url, "_blank");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          {lang === "ar" ? "سجل النشاط" : "Activity Log"}
        </h2>
        <button
          onClick={() => { loadList(); loadStats(); loadAlerts(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="w-4 h-4" />
          {lang === "ar" ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black">{stats?.activeUsersToday ?? "—"}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "نشطون اليوم" : "Active Today"}</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mx-auto mb-2">
            <Eye className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black">{stats?.totals.today ?? "—"}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "أنشطة اليوم" : "Events Today"}</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mx-auto mb-2">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black">{stats?.totals.all ?? "—"}</p>
          <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "إجمالي السجل" : "Total Logged"}</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black">
            {(alerts?.highRate.length ?? 0) + (alerts?.concurrentLogins.length ?? 0) + (alerts?.unauthorized.length ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "تنبيهات" : "Alerts"}</p>
        </Card>
      </div>

      {/* Top pages + Top users */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3">{lang === "ar" ? "أكثر الصفحات زيارةً (٧ أيام)" : "Top Pages (7 days)"}</h3>
            <ul className="space-y-1.5 text-sm">
              {stats.topPages.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
              {stats.topPages.map((p) => (
                <li key={p.pageUrl} className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-mono">{p.pageUrl}</span>
                  <span className="text-xs font-bold text-primary">{p.count}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-3">{lang === "ar" ? "أكثر المستخدمين نشاطاً" : "Top Active Users"}</h3>
            <ul className="space-y-1.5 text-sm">
              {stats.topUsers.length === 0 && <li className="text-muted-foreground text-xs">—</li>}
              {stats.topUsers.map((u) => (
                <li key={u.userId} className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.userName ?? `#${u.userId}`} <span className="text-xs text-muted-foreground">({roleLabel(u.userRole, lang)})</span></span>
                  <span className="text-xs font-bold text-primary">{u.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {alerts && (alerts.highRate.length || alerts.concurrentLogins.length || alerts.unauthorized.length) ? (
        <Card className="p-4 border-rose-200 dark:border-rose-900/50">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" />
            {lang === "ar" ? "تنبيهات مشبوهة" : "Suspicious Alerts"}
          </h3>
          <div className="space-y-3 text-sm">
            {alerts.highRate.length > 0 && (
              <div>
                <p className="font-bold text-xs mb-1">{lang === "ar" ? "أكثر من 100 إجراء/ساعة:" : "Over 100 actions/hour:"}</p>
                <ul className="space-y-1">
                  {alerts.highRate.map((u) => (
                    <li key={u.userId} className="text-xs">{u.userName ?? `#${u.userId}`} ({roleLabel(u.userRole, lang)}) — {u.count}</li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.concurrentLogins.length > 0 && (
              <div>
                <p className="font-bold text-xs mb-1">{lang === "ar" ? "تسجيل دخول متزامن من أجهزة متعددة:" : "Concurrent logins from multiple IPs:"}</p>
                <ul className="space-y-1">
                  {alerts.concurrentLogins.map((u) => (
                    <li key={u.userId} className="text-xs">{u.userName ?? `#${u.userId}`} ({roleLabel(u.userRole, lang)}) — {u.ips.join(", ")}</li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.unauthorized.length > 0 && (
              <div>
                <p className="font-bold text-xs mb-1">{lang === "ar" ? "محاولات وصول غير مصرح بها (آخر 20):" : "Unauthorized access attempts (last 20):"}</p>
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {alerts.unauthorized.map((r) => (
                    <li key={r.id} className="text-xs">
                      {new Date(r.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} — {r.userName ?? "—"} → {r.pageUrl ?? ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-bold">{lang === "ar" ? "تصفية" : "Filters"}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <select className="border rounded-lg px-2 py-1.5 text-sm bg-background" value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}>
            <option value="">{lang === "ar" ? "كل الأدوار" : "All Roles"}</option>
            <option value="teacher">{roleLabel("teacher", lang)}</option>
            <option value="organizer">{roleLabel("organizer", lang)}</option>
            <option value="student">{roleLabel("student", lang)}</option>
            <option value="admin">{roleLabel("admin", lang)}</option>
            <option value="visitor">{roleLabel("visitor", lang)}</option>
          </select>
          <select className="border rounded-lg px-2 py-1.5 text-sm bg-background" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
            <option value="">{lang === "ar" ? "كل الأنواع" : "All Actions"}</option>
            {Object.keys(ACTION_LABELS_AR).map((k) => (
              <option key={k} value={k}>{actionLabel(k, lang)}</option>
            ))}
          </select>
          <input
            className="border rounded-lg px-2 py-1.5 text-sm bg-background"
            placeholder={lang === "ar" ? "معرّف المستخدم" : "User ID"}
            value={filterUserId}
            onChange={(e) => { setFilterUserId(e.target.value.replace(/\D/g, "")); setPage(1); }}
          />
          <input
            type="date"
            className="border rounded-lg px-2 py-1.5 text-sm bg-background"
            value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            className="border rounded-lg px-2 py-1.5 text-sm bg-background"
            value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
          />
          <div className="relative">
            <Search className="w-4 h-4 absolute top-2 start-2 text-muted-foreground pointer-events-none" />
            <input
              className="w-full border rounded-lg ps-8 pe-2 py-1.5 text-sm bg-background"
              placeholder={lang === "ar" ? "بحث" : "Search"}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            <Download className="w-4 h-4" />
            {lang === "ar" ? "تصدير CSV" : "Export CSV"}
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "الوقت" : "Time"}</th>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "المستخدم" : "User"}</th>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "الدور" : "Role"}</th>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "الإجراء" : "Action"}</th>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "الصفحة" : "Page"}</th>
                <th className="px-3 py-2 text-start font-bold">{lang === "ar" ? "الجهاز" : "Device"}</th>
                <th className="px-3 py-2 text-start font-bold">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">{lang === "ar" ? "جاري التحميل…" : "Loading…"}</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">{lang === "ar" ? "لا توجد سجلات" : "No records"}</td></tr>
              )}
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</td>
                  <td className="px-3 py-2 text-xs">{r.userName ?? (r.userId ? `#${r.userId}` : "—")}</td>
                  <td className="px-3 py-2 text-xs">{roleLabel(r.userRole, lang)}</td>
                  <td className="px-3 py-2 text-xs font-bold">{actionLabel(r.action, lang)}</td>
                  <td className="px-3 py-2 text-xs font-mono truncate max-w-[200px]" title={r.pageUrl ?? ""}>{r.pageUrl ?? ""}</td>
                  <td className="px-3 py-2 text-xs">{[r.device, r.browser].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-xs font-mono">{r.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 text-xs">
          <span>
            {lang === "ar"
              ? `عرض ${items.length} من ${total.toLocaleString("ar-EG")}`
              : `${items.length} of ${total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded border disabled:opacity-50"
            >
              {lang === "ar" ? "السابق" : "Prev"}
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2 py-1 rounded border disabled:opacity-50"
            >
              {lang === "ar" ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
