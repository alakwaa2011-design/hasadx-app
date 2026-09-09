import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertTriangle,
  Calendar,
  Activity,
  Target,
  Clock,
  Users,
  ExternalLink,
  LineChart as LineChartIcon,
  Send,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/lib/nav-history";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";
type TimelineT = ReturnType<typeof useI18n>["t"]["studentTimeline"];

interface KindRow {
  kind: string;
  answered: number;
  correct: number;
  correctPct: number | null;
  eligible: boolean;
}

interface SessionRow {
  sessionId: number;
  presentationId: number;
  presentationTitle: string;
  startedAt: string | null;
  scorePct: number | null;
  answered: number;
  correct: number;
  avgResponseSec: number | null;
}

interface RecentSession extends SessionRow {
  pin: string;
  endedAt: string | null;
}

interface TimelinePayload {
  student: {
    id: number;
    name: string;
    className: string | null;
    classId: number | null;
  };
  summary: {
    sessionsCount: number;
    totalAnswered: number;
    totalCorrect: number;
    avgScorePct: number | null;
    participationPct: number | null;
    avgResponseSec: number | null;
  };
  byKind: KindRow[];
  strongestKind: { kind: string; correctPct: number } | null;
  weakestKind: { kind: string; correctPct: number } | null;
  recentSessions: RecentSession[];
  trend: {
    direction: "improving" | "stable" | "declining" | null;
    slope: number | null;
    sample: number;
    reason?: "insufficient_data";
  };
  sessions: SessionRow[];
}

export default function StudentTimelinePage() {
  const { t, lang, dir } = useI18n();
  const params = useParams<{ classStudentId: string }>();
  const [, setLocation] = useLocation();
  const goBack = useSmartBack("/teacher/students");
  const sid = Number(params.classStudentId);

  const [data, setData] = useState<TimelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<"week" | "month">("week");
  const [summaryMessage, setSummaryMessage] = useState("");
  const [summaryPreview, setSummaryPreview] = useState<any>(null);
  const [selectedAchievements, setSelectedAchievements] = useState<number[]>([]);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  async function loadSummaryPreview(period = summaryPeriod, selected = selectedAchievements) {
    setSummaryBusy(true); setSummaryError("");
    try {
      const r = await fetch(`${API_BASE}/api/parent-messages/motivation-summary/preview`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: sid, period, selectedAchievementIds: selected, teacherMessage: summaryMessage }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "تعذر تحميل الملخص");
      setSummaryPreview(j);
    } catch (e: any) { setSummaryError(e.message); }
    finally { setSummaryBusy(false); }
  }

  async function sendSummary() {
    setSummaryBusy(true); setSummaryError("");
    try {
      const r = await fetch(`${API_BASE}/api/parent-messages/motivation-summary`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: sid,
          snapshot: summaryPreview.snapshot,
          previewExpiresAt: summaryPreview.previewExpiresAt,
          previewToken: summaryPreview.previewToken,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "تعذر إرسال الملخص");
      setShowSummary(false);
      alert("تم إرسال ملخص التحفيز بنجاح");
    } catch (e: any) { setSummaryError(e.message); }
    finally { setSummaryBusy(false); }
  }

  useEffect(() => {
    if (!Number.isFinite(sid)) {
      setError(t.studentTimeline.invalidId);
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/students/${sid}/timeline`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) throw new Error("auth");
        if (r.status === 403) throw new Error("forbidden");
        if (r.status === 404) throw new Error("notfound");
        if (!r.ok) throw new Error("load");
        return r.json() as Promise<TimelinePayload>;
      })
      .then((j) => setData(j))
      .catch((e: Error) => {
        if (e.message === "auth") setLocation("/login");
        else if (e.message === "forbidden") setError(t.studentTimeline.forbidden);
        else if (e.message === "notfound") setError(t.studentTimeline.notFound);
        else setError(t.studentTimeline.loadError);
      })
      .finally(() => setLoading(false));
  }, [sid, setLocation, t]);
  const fmtSec = (n: number | null) => n == null ? "—" : n < 60 ? `${n} ${t.studentTimeline.seconds}` : `${Math.floor(n / 60)} ${t.studentTimeline.minutes} ${n % 60} ${t.studentTimeline.seconds}`;
  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" }); } catch { return "—"; }
  };

  if (loading) {
    return (
      <div dir={dir} className="min-h-screen bg-slate-50 flex items-center justify-center" aria-label={t.presentationPublic.loading}>
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir={dir} className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <div className="text-slate-700">{error ?? t.studentTimeline.loadError}</div>
        <button onClick={goBack} className="text-sm text-slate-500 underline">{t.studentTimeline.back}</button>
      </div>
    );
  }

  const { student, summary, byKind, strongestKind, weakestKind, recentSessions, trend, sessions } = data;

  return (
    <div dir={dir} className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* Header */}
        <header className="space-y-3">
          <button
            onClick={goBack}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
          >
            {dir === "rtl" ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {t.studentTimeline.back}
          </button>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: BRAND_GOLD }}>
                <LineChartIcon className="w-4 h-4" />
                {t.studentTimeline.title}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black" style={{ color: BRAND_GREEN }}>
                {student.name}
              </h1>
              {student.className && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                  <Users className="w-3.5 h-3.5" />
                  {student.className}
                </div>
              )}
              <button onClick={() => { setShowSummary(true); loadSummaryPreview(); }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm"
                style={{ background: BRAND_GREEN }}>
                <Send className="w-4 h-4" /> إرسال ملخص التحفيز لولي الأمر
              </button>
            </div>
          </div>
        </header>

        {/* Empty state */}
        {summary.sessionsCount === 0 ? (
          <section className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <div className="text-lg font-bold text-slate-700">{t.studentTimeline.emptyTitle}</div>
            <div className="text-sm text-slate-500 mt-2">
              {t.studentTimeline.emptyBody}
            </div>
          </section>
        ) : (
          <>
            {/* Summary tiles */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile
                icon={<Calendar className="w-4 h-4" />}
                label={t.studentTimeline.sessionsCount}
                value={String(summary.sessionsCount)}
              />
              <Tile
                icon={<Target className="w-4 h-4" />}
                label={t.studentTimeline.averageScore}
                value={summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—"}
                tone={summary.avgScorePct != null ? scoreTone(summary.avgScorePct) : "neutral"}
              />
              <Tile
                icon={<Activity className="w-4 h-4" />}
                label={t.studentTimeline.averageParticipation}
                value={summary.participationPct != null ? `${summary.participationPct}%` : "—"}
              />
              <Tile
                icon={<Clock className="w-4 h-4" />}
                label={t.studentTimeline.averageResponseTime}
                value={fmtSec(summary.avgResponseSec)}
              />
            </section>

            {/* Trend card */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-500 mb-2">{t.studentTimeline.overallTrend}</div>
                  <div className="flex items-center gap-2">
                    <TrendBadge dir={trend.direction} t={t.studentTimeline} />
                    <span className="text-xs text-slate-500 tabular-nums">
                      {trend.sample > 0 ? t.studentTimeline.basedOnSessions.replace("{count}", String(trend.sample)) : t.studentTimeline.insufficientData}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-[260px]">
                    <Sparkline t={t.studentTimeline}
                    points={sessions
                      .map((s, i) => (s.scorePct != null ? { x: i, y: s.scorePct } : null))
                      .filter((p): p is { x: number; y: number } => p != null)}
                    totalPoints={Math.max(1, sessions.length)}
                  />
                </div>
              </div>
            </section>

            {/* Strengths / weaknesses */}
            {(strongestKind || weakestKind) && (
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {strongestKind && (
                  <KindCard
                    tone="strong"
                    title={t.studentTimeline.strongest}
                    kind={strongestKind.kind}
                    pct={strongestKind.correctPct}
                    sample={byKind.find((k) => k.kind === strongestKind.kind)?.answered ?? 0}
                    icon={<Award className="w-5 h-5" />}
                    t={t.studentTimeline}
                  />
                )}
                {weakestKind && (
                  <KindCard
                    tone="weak"
                    title={t.studentTimeline.needsImprovement}
                    kind={weakestKind.kind}
                    pct={weakestKind.correctPct}
                    sample={byKind.find((k) => k.kind === weakestKind.kind)?.answered ?? 0}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    t={t.studentTimeline}
                  />
                )}
              </section>
            )}

            {byKind.length > 0 && byKind.every((k) => !k.eligible) && (
              <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t.studentTimeline.insufficientAnswers}
              </div>
            )}

            {/* Recent sessions */}
            <section>
              <h2 className="text-sm font-bold text-slate-600 mb-3">{t.studentTimeline.recentSessions}</h2>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <a
                    key={s.sessionId}
                    href={`/p/results/${s.sessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800 truncate">{s.presentationTitle}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{fmtDate(s.startedAt)}</span>
                        <span>·</span>
                        <span className="tabular-nums">{s.correct} / {s.answered}</span>
                        {s.avgResponseSec != null && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">{fmtSec(s.avgResponseSec)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ScoreBadge pct={s.scorePct} />
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Full sessions sparkline */}
            {sessions.length > 5 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-600 mb-3">
                  {t.studentTimeline.fullResultsPath.replace("{count}", String(sessions.length))}
                </h2>
                <Sparkline t={t.studentTimeline}
                  points={sessions
                    .map((s, i) => (s.scorePct != null ? { x: i, y: s.scorePct } : null))
                    .filter((p): p is { x: number; y: number } => p != null)}
                  totalPoints={Math.max(1, sessions.length)}
                />
              </section>
            )}
          </>
        )}
        {showSummary && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-black text-emerald-900">ملخص التحفيز لولي الأمر</h2><p className="text-xs text-slate-500 mt-1">لن يظهر ترتيب الطالب أو أي بيانات لزملائه.</p></div>
                <button onClick={() => setShowSummary(false)} className="p-2 text-slate-500"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-5">
                {(["week", "month"] as const).map(p => <button key={p} onClick={() => { setSummaryPeriod(p); setSelectedAchievements([]); loadSummaryPreview(p, []); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold ${summaryPeriod === p ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200"}`}>{p === "week" ? "آخر أسبوع" : "آخر شهر"}</button>)}
              </div>
              {summaryBusy && !summaryPreview ? <Loader2 className="w-6 h-6 animate-spin mx-auto my-8" /> : summaryPreview && <>
                {!summaryPreview.student.parentEmail && <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">لا يوجد بريد ولي أمر صالح. أضفه من صفحة الطلاب قبل الإرسال.</div>}
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="text-xs font-bold text-emerald-800">المجموع خلال الفترة</div><div className="text-3xl font-black text-amber-600 mt-1">{summaryPreview.snapshot.totalPoints}</div>
                  <div className="flex flex-wrap gap-2 mt-3">{summaryPreview.snapshot.categories.map((c: any) => <span key={c.name} className="bg-white border rounded-full px-2.5 py-1 text-xs">{c.name} · {c.points}</span>)}</div>
                </div>
                <div className="mt-4"><div className="text-sm font-bold text-slate-700 mb-2">اختر إنجازات لإظهارها</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">{summaryPreview.selectableAchievements.map((a: any) => <label key={a.id} className="flex items-center gap-2 border rounded-lg p-2 text-sm"><input type="checkbox" checked={selectedAchievements.includes(a.id)} onChange={e => {
                    setSelectedAchievements(v => e.target.checked ? [...v, a.id].slice(0, 8) : v.filter(x => x !== a.id));
                    setSummaryPreview((prev: any) => prev ? { ...prev, previewToken: "" } : prev);
                  }} />⭐ {a.title} <b className="text-emerald-700">+{a.points}</b></label>)}</div>
                </div>
                <label className="block mt-4 text-sm font-bold text-slate-700">رسالة المعلم
                  <textarea value={summaryMessage} onChange={e => {
                    setSummaryMessage(e.target.value);
                    setSummaryPreview((prev: any) => prev ? { ...prev, previewToken: "" } : prev);
                  }} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 p-3 font-normal" placeholder="اكتب رسالة إيجابية مختصرة..." />
                </label>
              </>}
              {summaryError && <div className="mt-3 text-sm text-rose-700">{summaryError}</div>}
              <button onClick={() => summaryPreview?.previewToken ? sendSummary() : loadSummaryPreview(summaryPeriod, selectedAchievements)}
                disabled={summaryBusy || !summaryPreview?.student?.parentEmail}
                className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: BRAND_GREEN }}>
                {summaryBusy ? "جارٍ التنفيذ..." : summaryPreview?.previewToken ? "إرسال الملخص" : "تحديث المعاينة قبل الإرسال"}
              </button>
              <p className="text-[11px] text-slate-500 mt-2 text-center">الرابط صالح لمدة 30 يومًا ويمكن لولي الأمر الرد ضمن المحادثة الحالية.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────── small presentational helpers ────────────────── */

function scoreTone(pct: number): "good" | "ok" | "bad" {
  if (pct >= 70) return "good";
  if (pct >= 40) return "ok";
  return "bad";
}

function Tile({
  icon, label, value, tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "ok" | "bad";
}) {
  const valueColor = tone === "good" ? "text-emerald-700"
    : tone === "ok" ? "text-amber-700"
    : tone === "bad" ? "text-rose-700"
    : "text-slate-800";
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 inline-flex items-center gap-1.5">
        {icon}
        <span className="font-bold">{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}

function TrendBadge({ dir, t }: { dir: "improving" | "stable" | "declining" | null; t: TimelineT }) {
  if (dir == null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-500">
        <Minus className="w-4 h-4" /> {t.insufficientData}
      </span>
    );
  }
  if (dir === "improving") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700">
        <TrendingUp className="w-4 h-4" /> {t.improving}
      </span>
    );
  }
  if (dir === "declining") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-rose-100 text-rose-700">
        <TrendingDown className="w-4 h-4" /> {t.declining}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
      <Minus className="w-4 h-4" /> {t.stable}
    </span>
  );
}

function ScoreBadge({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-500 tabular-nums">—</span>;
  }
  const tone = scoreTone(pct);
  const cls = tone === "good" ? "bg-emerald-100 text-emerald-700"
    : tone === "ok" ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums ${cls}`}>{pct}%</span>;
}

function KindCard({
  tone, title, kind, pct, sample, icon, t,
}: {
  tone: "strong" | "weak";
  title: string;
  kind: string;
  pct: number;
  sample: number;
  icon: React.ReactNode;
  t: TimelineT;
}) {
  const palette = tone === "strong"
    ? { bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-700", value: "text-emerald-800" }
    : { bg: "bg-rose-50", border: "border-rose-200", title: "text-rose-700", value: "text-rose-800" };
  return (
    <div className={`rounded-2xl border p-5 ${palette.bg} ${palette.border}`}>
      <div className={`text-xs font-bold inline-flex items-center gap-1.5 ${palette.title}`}>
        {icon}
        <span>{title}</span>
      </div>
      <div className={`mt-2 text-xl font-black ${palette.value}`}>{t.kinds[kind as keyof typeof t.kinds] ?? kind}</div>
      <div className="mt-1 text-sm text-slate-600 tabular-nums">
        {t.accuracy} <b>{pct}%</b> · {t.basedOnAnswers.replace("{count}", String(sample))}
      </div>
    </div>
  );
}

function Sparkline({
  points, totalPoints, t,
}: {
  points: { x: number; y: number }[];
  totalPoints: number;
  t: TimelineT;
}) {
  const W = 600;
  const H = 140;
  const padX = 12;
  const padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const xMax = Math.max(1, totalPoints - 1);

  const proj = (p: { x: number; y: number }) => ({
    cx: padX + (p.x / xMax) * innerW,
    cy: padY + (1 - p.y / 100) * innerH,
  });
  const projected = points.map(proj);
  const path = projected
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(" ");
  const areaPath = projected.length > 1
    ? `${path} L${projected[projected.length - 1]!.cx.toFixed(1)},${(padY + innerH).toFixed(1)} L${projected[0]!.cx.toFixed(1)},${(padY + innerH).toFixed(1)} Z`
    : null;

  if (points.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-sm text-slate-400">
        {t.noResultsYet}
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]" role="img" aria-label={t.resultsChart}>
      {[0, 50, 100].map((g) => {
        const y = padY + (1 - g / 100) * innerH;
        return (
          <g key={g}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={W - padX} y={y - 2} fontSize="9" fill="#94a3b8" textAnchor="end">{g}%</text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} fill={BRAND_GREEN} fillOpacity="0.08" />}
      {projected.length > 1 && (
        <path d={path} fill="none" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {projected.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="3.5" fill="white" stroke={BRAND_GREEN} strokeWidth="2" />
          <title>{`${points[i]!.y}%`}</title>
        </g>
      ))}
    </svg>
  );
}
