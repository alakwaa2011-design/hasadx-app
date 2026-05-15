import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui-elements";
import {
  Activity, Users, GraduationCap, BookOpen, Gamepad2, Sparkles,
  ScrollText, MousePointerClick, Wand2, RefreshCcw, ShieldCheck, FileText, Layers,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
type Lang = "ar" | "en";

interface RealtimeData {
  online: {
    total: number;
    teachers: number;
    students: number;
    admins: number;
    visitors: number;
    breakdown: Record<string, number>;
  };
  liveGamesNow: number;
  lastHour: {
    eventCount: number;
    recent: Array<{
      id: number; action: string; userName: string | null; userRole: string;
      eventCategory: string | null; pageUrl: string | null; createdAt: string;
      details: Record<string, unknown> | null;
    }>;
  };
  today: { assignmentsCreated: number; aiUses: number };
  topPages: Array<{ pageUrl: string; count: number }>;
  topClicks: Array<{ action: string; count: number }>;
  topFeatures: Array<{ action: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  generatedAt: string;
}

const ACTION_AR: Record<string, string> = {
  view: "عرض صفحة",
  create_homework: "إنشاء واجب",
  assignment_created_success: "إنشاء واجب — نجاح",
  assignment_created_failed: "إنشاء واجب — فشل",
  create_assignment_clicked: "ضغط إنشاء واجب",
  start_game: "بدء مسابقة",
  live_game_started: "مسابقة بدأت",
  start_live_game_clicked: "ضغط بدء مسابقة",
  game_completed: "انتهاء مسابقة",
  join_game: "دخول لعبة",
  student_joined_game: "طالب التحق",
  ai_use: "استخدام الذكاء",
  ai_generation_requested: "طلب توليد ذكي",
  ai_generation_completed: "توليد ذكي — نجاح",
  ai_generation_failed: "توليد ذكي — فشل",
  ai_generator_opened: "فتح مولّد الذكاء",
  arena_opened: "فتح الميدان",
  login: "تسجيل دخول",
  login_clicked: "ضغط تسجيل دخول",
  login_success: "تسجيل دخول — نجاح",
  login_failed: "تسجيل دخول — فشل",
};
function actionLabel(a: string, lang: Lang) {
  if (lang === "ar") return ACTION_AR[a] ?? a;
  return a.replace(/_/g, " ");
}
const CATEGORY_AR: Record<string, string> = {
  navigation: "تنقّل", assignment: "واجبات", game: "ألعاب", arena: "ميدان",
  ai: "ذكاء اصطناعي", presentation: "عروض", auth: "مصادقة", library: "مكتبة",
  settings: "إعدادات", feedback: "ملاحظات", system: "نظام", uncategorized: "غير مصنّف",
};
const ROLE_AR: Record<string, string> = {
  teacher: "معلّم", organizer: "منظّم", student: "طالب", admin: "مسؤول", visitor: "زائر",
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
  color: string;
  pulse?: boolean;
}
function StatCard({ icon, label, value, bg, color, pulse }: StatCardProps) {
  return (
    <Card className="p-4 text-center">
      <div className={`relative w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center mx-auto mb-2`}>
        {icon}
        {pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
      </div>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground font-bold mt-1">{label}</p>
    </Card>
  );
}

export function RealtimeTab({ lang }: { lang: Lang }) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/analytics/realtime`, { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      setData(await r.json());
      setError(null);
    } catch {
      setError(lang === "ar" ? "تعذّر جلب الإحصائيات" : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, [load, paused]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          {lang === "ar" ? "الإحصائيات اللحظية" : "Realtime Analytics"}
          {!paused && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {lang === "ar" ? "مباشر" : "LIVE"}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setPaused((p) => !p)} className="text-muted-foreground hover:text-foreground">
            {paused ? (lang === "ar" ? "استئناف" : "Resume") : (lang === "ar" ? "إيقاف" : "Pause")}
          </button>
          <button onClick={load} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <RefreshCcw className="w-4 h-4" />
            {lang === "ar" ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Online now stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label={lang === "ar" ? "متصلون الآن" : "Online Now"}
          value={loading ? "—" : data?.online.total ?? 0}
          bg="bg-emerald-100 dark:bg-emerald-900/30"
          color="text-emerald-600"
          pulse={!paused}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label={lang === "ar" ? "معلّمون متصلون" : "Teachers Online"}
          value={loading ? "—" : data?.online.teachers ?? 0}
          bg="bg-blue-100 dark:bg-blue-900/30"
          color="text-blue-600"
        />
        <StatCard
          icon={<GraduationCap className="w-5 h-5" />}
          label={lang === "ar" ? "طلاب متصلون" : "Students Online"}
          value={loading ? "—" : data?.online.students ?? 0}
          bg="bg-amber-100 dark:bg-amber-900/30"
          color="text-amber-600"
        />
        <StatCard
          icon={<Gamepad2 className="w-5 h-5" />}
          label={lang === "ar" ? "ألعاب مباشرة" : "Live Games"}
          value={loading ? "—" : data?.liveGamesNow ?? 0}
          bg="bg-purple-100 dark:bg-purple-900/30"
          color="text-purple-600"
        />
      </div>

      {/* Today / hour stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label={lang === "ar" ? "واجبات اليوم" : "Assignments Today"}
          value={loading ? "—" : data?.today.assignmentsCreated ?? 0}
          bg="bg-indigo-100 dark:bg-indigo-900/30"
          color="text-indigo-600"
        />
        <StatCard
          icon={<Sparkles className="w-5 h-5" />}
          label={lang === "ar" ? "استخدامات الذكاء اليوم" : "AI Uses Today"}
          value={loading ? "—" : data?.today.aiUses ?? 0}
          bg="bg-pink-100 dark:bg-pink-900/30"
          color="text-pink-600"
        />
        <StatCard
          icon={<ScrollText className="w-5 h-5" />}
          label={lang === "ar" ? "أحداث آخر ساعة" : "Events Last Hour"}
          value={loading ? "—" : data?.lastHour.eventCount ?? 0}
          bg="bg-cyan-100 dark:bg-cyan-900/30"
          color="text-cyan-600"
        />
        <StatCard
          icon={<ShieldCheck className="w-5 h-5" />}
          label={lang === "ar" ? "مسؤولون متصلون" : "Admins Online"}
          value={loading ? "—" : data?.online.admins ?? 0}
          bg="bg-rose-100 dark:bg-rose-900/30"
          color="text-rose-600"
        />
      </div>

      {/* Top breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" />
            {lang === "ar" ? "أكثر الصفحات استخدامًا (٢٤س)" : "Top Pages (24h)"}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {(!data || data.topPages.length === 0) && <li className="text-muted-foreground text-xs">—</li>}
            {data?.topPages.map((p) => (
              <li key={p.pageUrl} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-mono">{p.pageUrl}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{p.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-amber-500" />
            {lang === "ar" ? "أكثر الأزرار ضغطًا (٢٤س)" : "Top Clicks (24h)"}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {(!data || data.topClicks.length === 0) && <li className="text-muted-foreground text-xs">—</li>}
            {data?.topClicks.map((c) => (
              <li key={c.action} className="flex items-center justify-between gap-2">
                <span className="truncate">{actionLabel(c.action, lang)}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-purple-500" />
            {lang === "ar" ? "أكثر الميزات استخدامًا (٢٤س)" : "Top Features (24h)"}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {(!data || data.topFeatures.length === 0) && <li className="text-muted-foreground text-xs">—</li>}
            {data?.topFeatures.map((f) => (
              <li key={f.action} className="flex items-center justify-between gap-2">
                <span className="truncate">{actionLabel(f.action, lang)}</span>
                <span className="text-xs font-bold text-primary tabular-nums">{f.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-500" />
            {lang === "ar" ? "تصنيفات الأحداث (٢٤س)" : "Event Categories (24h)"}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {(!data || data.topCategories.length === 0) && <li className="text-muted-foreground text-xs">—</li>}
            {data?.topCategories.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {lang === "ar" ? (CATEGORY_AR[c.category] ?? c.category) : c.category}
                </span>
                <span className="text-xs font-bold text-primary tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recent live activity feed */}
      <Card className="p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-500" />
          {lang === "ar" ? "آخر الأنشطة (آخر ساعة)" : "Live Activity Feed (last hour)"}
        </h3>
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-start font-bold">{lang === "ar" ? "الوقت" : "Time"}</th>
                <th className="px-2 py-1.5 text-start font-bold">{lang === "ar" ? "المستخدم" : "User"}</th>
                <th className="px-2 py-1.5 text-start font-bold">{lang === "ar" ? "الحدث" : "Event"}</th>
                <th className="px-2 py-1.5 text-start font-bold">{lang === "ar" ? "التصنيف" : "Category"}</th>
                <th className="px-2 py-1.5 text-start font-bold">{lang === "ar" ? "الصفحة" : "Page"}</th>
              </tr>
            </thead>
            <tbody>
              {(!data || data.lastHour.recent.length === 0) && (
                <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">—</td></tr>
              )}
              {data?.lastHour.recent.map((r) => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs tabular-nums">
                    {new Date(r.createdAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US")}
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    {r.userName ?? "—"}{" "}
                    <span className="text-muted-foreground">({lang === "ar" ? (ROLE_AR[r.userRole] ?? r.userRole) : r.userRole})</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs font-bold">{actionLabel(r.action, lang)}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">
                    {r.eventCategory
                      ? (lang === "ar" ? (CATEGORY_AR[r.eventCategory] ?? r.eventCategory) : r.eventCategory)
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-mono truncate max-w-[200px]" title={r.pageUrl ?? ""}>
                    {r.pageUrl ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.generatedAt && (
          <p className="text-[11px] text-muted-foreground text-end mt-2">
            {lang === "ar" ? "آخر تحديث: " : "Last updated: "}
            {new Date(data.generatedAt).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US")}
          </p>
        )}
      </Card>
    </div>
  );
}
