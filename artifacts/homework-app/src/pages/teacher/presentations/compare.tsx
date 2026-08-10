import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  GitCompare,
  TrendingDown,
  Users,
  Hourglass,
  Target,
  ExternalLink,
  Lightbulb,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

interface SessionCompareRow {
  id: number;
  pin: string;
  status: string;
  mode: "class" | "guest" | string;
  targetClassName: string | null;
  classSize: number | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  participantsCount: number;
  avgScorePct: number | null;
  participationPct: number | null;
  avgAnswerSec: number | null;
  hardest: { elementId: string; prompt: string; correctPct: number; answered: number; slideIndex: number } | null;
}

interface ComparePayload {
  deck: { id: number; title: string; language: "ar" | "en" } | null;
  sessions: SessionCompareRow[];
  repeatedHardest: { elementId: string; prompt: string; slideIndex: number; sessions: number } | null;
}

type ErrorCode = "invalid-id" | "forbidden" | "load";

// Cross-session comparison page for one deck. RTL/LTR + copy follow
// the deck's language to match the editor and sessions sibling pages.
export default function PresentationCompare() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const deckId = Number(params.id);

  const [data, setData] = useState<ComparePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  /* Independent deck-language probe so error states (forbidden / load
     failures of the compare endpoint) can still localize correctly
     for English decks, before/without a successful compare payload. */
  const [deckLangProbe, setDeckLangProbe] = useState<"ar" | "en" | null>(null);

  /* Resolution order: compare payload deck.language → side probe →
     Arabic default (the platform default). */
  const resolvedLang: "ar" | "en" = data?.deck?.language ?? deckLangProbe ?? "ar";
  const isAr = resolvedLang !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const Back = isAr ? ChevronRight : ChevronLeft;

  useEffect(() => {
    if (!Number.isFinite(deckId)) {
      setErrorCode("invalid-id");
      setLoading(false);
      return;
    }
    /* In parallel: a tiny side request for the deck language so the
       error-state copy can flip to English even when the main compare
       endpoint fails. Best-effort — silently ignored on failure. */
    fetch(`${API_BASE}/api/presentations/${deckId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && (j.language === "ar" || j.language === "en")) {
          setDeckLangProbe(j.language);
        }
      })
      .catch(() => { /* best-effort */ });

    fetch(`${API_BASE}/api/presentations/${deckId}/sessions/compare`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) throw new Error("auth");
        if (r.status === 403) throw new Error("forbidden");
        if (!r.ok) throw new Error("load");
        return r.json();
      })
      .then((j: ComparePayload) => setData(j))
      .catch((e: Error) => {
        if (e.message === "auth") {
          setLocation("/login");
          return;
        }
        const code: ErrorCode = e.message === "forbidden" ? "forbidden" : "load";
        setErrorCode(code);
        /* Toast fires synchronously on error; the side language
           probe may not have resolved yet. We accept the rare
           Arabic-default toast — the persistent error body still
           localizes via render-time resolution above. */
        toast.error(code === "forbidden"
          ? (isAr ? "لا تملك صلاحية الوصول" : "You don't have access")
          : (isAr ? "تعذّر تحميل المقارنة" : "Couldn't load the comparison"));
      })
      .finally(() => setLoading(false));
    // isAr intentionally omitted: it's only relevant for the toast,
    // and we don't want refetch on language flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, setLocation]);

  const errorText = (() => {
    if (!errorCode) return "";
    if (errorCode === "invalid-id") return isAr ? "معرّف غير صالح" : "Invalid id";
    if (errorCode === "forbidden") return isAr ? "لا تملك صلاحية الوصول" : "You don't have access";
    return isAr ? "تعذّر تحميل المقارنة" : "Couldn't load the comparison";
  })();

  return (
    <Layout>
      <div dir={dir} className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-6xl">
        <button
          onClick={() => setLocation(`/teacher/presentations/${deckId}/sessions`)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
        >
          <Back className="w-4 h-4" />
          {isAr ? "العودة إلى الجلسات السابقة" : "Back to past sessions"}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
            >
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                {isAr ? "مقارنة جلسات العرض" : "Compare presentation sessions"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.deck?.title ?? (isAr ? "العرض" : "Presentation")}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setLocation(`/teacher/presentations/${deckId}`)}
            variant="outline"
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" /> {isAr ? "فتح المحرّر" : "Open editor"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : errorCode ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            {errorText}
          </div>
        ) : !data || data.sessions.length === 0 ? (
          <EmptyCompare isAr={isAr} />
        ) : (
          <CompareBody data={data} isAr={isAr} onOpen={(id) => setLocation(`/p/results/${id}`)} />
        )}
      </div>
    </Layout>
  );
}

function EmptyCompare({ isAr }: { isAr: boolean }) {
  return (
    <div className="text-center py-16 px-6 rounded-2xl border-2 border-dashed border-border bg-muted/30">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
        style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
      >
        <GitCompare className="w-8 h-8" />
      </div>
      <h3 className="font-black text-lg mb-1">
        {isAr ? "لا توجد جلسات للمقارنة" : "No sessions to compare"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {isAr
          ? "تحتاج إلى جلستين على الأقل من نفس العرض لرؤية الاتجاهات والمقارنات."
          : "You need at least two sessions of the same deck to see trends and comparisons."}
      </p>
    </div>
  );
}

function CompareBody({ data, isAr, onOpen }: { data: ComparePayload; isAr: boolean; onOpen: (id: number) => void }) {
  const sessions = data.sessions;
  const numScored = sessions.filter((s) => s.avgScorePct != null).length;
  const sumScore = sessions.reduce((a, s) => a + (s.avgScorePct ?? 0), 0);
  const avgScore = numScored > 0 ? Math.round(sumScore / numScored) : null;

  const numPart = sessions.filter((s) => s.participationPct != null).length;
  const sumPart = sessions.reduce((a, s) => a + (s.participationPct ?? 0), 0);
  const avgPart = numPart > 0 ? Math.round(sumPart / numPart) : null;

  const numTime = sessions.filter((s) => s.avgAnswerSec != null).length;
  const sumTime = sessions.reduce((a, s) => a + (s.avgAnswerSec ?? 0), 0);
  const avgTime = numTime > 0 ? Math.round(sumTime / numTime) : null;

  const totalParticipants = sessions.reduce((a, s) => a + s.participantsCount, 0);

  const sparkPoints = sessions
    .map((s, i) => ({ x: i, y: s.avgScorePct }))
    .filter((p): p is { x: number; y: number } => p.y != null);

  const noTextLabel = isAr ? "(بدون نص)" : "(no text)";

  return (
    <div className="space-y-5">
      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={<GitCompare className="w-4 h-4" />} label={isAr ? "عدد الجلسات" : "Sessions"} value={String(sessions.length)} accent={BRAND_GREEN} />
        <StatTile icon={<Users className="w-4 h-4" />} label={isAr ? "إجمالي المشاركين" : "Total participants"} value={String(totalParticipants)} accent={BRAND_GREEN} />
        <StatTile icon={<Target className="w-4 h-4" />} label={isAr ? "متوسط النجاح" : "Average score"} value={avgScore != null ? `${avgScore}%` : "—"} accent={BRAND_GREEN} />
        <StatTile icon={<Hourglass className="w-4 h-4" />} label={isAr ? "متوسط زمن الإجابة" : "Avg answer time"} value={fmtSec(avgTime, isAr)} accent={BRAND_GOLD} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sparkline */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4" style={{ color: BRAND_GOLD }} />
              {isAr ? "تطوّر متوسط النجاح" : "Average score over time"}
            </h3>
            <div className="text-[11px] text-muted-foreground">
              {isAr
                ? `${sparkPoints.length} نقطة بيانية · زمنياً`
                : `${sparkPoints.length} data point${sparkPoints.length === 1 ? "" : "s"} · chronological`}
            </div>
          </div>
          <Sparkline
            points={sparkPoints}
            totalPoints={Math.max(2, sessions.length)}
            avgPart={avgPart}
            isAr={isAr}
          />
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{isAr ? "الجلسة الأقدم" : "Oldest session"}</span>
            <span>{isAr ? "الأحدث" : "Newest"}</span>
          </div>
        </div>

        {/* Repeated hardest Q */}
        <div
          className="rounded-2xl border-2 p-4"
          style={{ borderColor: data.repeatedHardest ? "#fda4af80" : "var(--border)", background: data.repeatedHardest ? "#fff5f5" : undefined }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <h3 className="font-black text-sm">
              {isAr ? "السؤال الأصعب المتكرر" : "Recurring hardest question"}
            </h3>
          </div>
          {data.repeatedHardest ? (
            <div>
              <div className="text-sm font-bold text-foreground break-words mb-2">
                {data.repeatedHardest.prompt || noTextLabel}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {isAr ? (
                  <>
                    ظهر كأصعب سؤال في <b className="text-rose-600">{data.repeatedHardest.sessions}</b> جلسات
                    {data.repeatedHardest.slideIndex >= 0 ? ` · شريحة ${data.repeatedHardest.slideIndex + 1}` : ""}
                  </>
                ) : (
                  <>
                    Hardest in <b className="text-rose-600">{data.repeatedHardest.sessions}</b> sessions
                    {data.repeatedHardest.slideIndex >= 0 ? ` · slide ${data.repeatedHardest.slideIndex + 1}` : ""}
                  </>
                )}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground bg-rose-50 rounded p-2 border border-rose-100">
                {isAr
                  ? "💡 ربما يستحق هذا السؤال إعادة صياغة أو شرحاً إضافياً."
                  : "💡 This question may be worth rewording or re-teaching."}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {isAr
                ? "لا يوجد سؤال أصعب يتكرر عبر الجلسات. كل جلسة لها تحدّياتها الخاصة."
                : "No recurring hardest question across sessions. Each session has its own challenges."}
            </div>
          )}
        </div>
      </div>

      {/* Sessions table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-sm">{isAr ? "تفاصيل الجلسات" : "Session details"}</h3>
          <div className="text-[11px] text-muted-foreground">
            {isAr ? "انقر على جلسة لرؤية النتائج الكاملة" : "Click a session to see full results"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b border-border bg-muted/30">
                <th className="text-start p-3 font-bold">PIN</th>
                <th className="text-start p-3 font-bold">{isAr ? "التاريخ" : "Date"}</th>
                <th className="text-start p-3 font-bold">{isAr ? "الفصل" : "Class"}</th>
                <th className="text-start p-3 font-bold tabular-nums">{isAr ? "مشاركون" : "Participants"}</th>
                <th className="text-start p-3 font-bold tabular-nums">{isAr ? "المشاركة" : "Participation"}</th>
                <th className="text-start p-3 font-bold tabular-nums">{isAr ? "المتوسط" : "Avg score"}</th>
                <th className="text-start p-3 font-bold tabular-nums">{isAr ? "زمن الإجابة" : "Answer time"}</th>
                <th className="text-start p-3 font-bold">{isAr ? "الأصعب" : "Hardest"}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  className="border-b border-border hover:bg-emerald-50/40 cursor-pointer transition-colors"
                >
                  <td className="p-3 font-bold tabular-nums" style={{ color: BRAND_GOLD }}>{s.pin}</td>
                  <td className="p-3 text-muted-foreground text-[12px] whitespace-nowrap">{fmtDate(s.startedAt, isAr)}</td>
                  <td className="p-3 text-foreground/85 text-[12px]">
                    {s.targetClassName ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px]">
                        {s.targetClassName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">{isAr ? "ضيوف" : "Guests"}</span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{s.participantsCount}{s.classSize ? ` / ${s.classSize}` : ""}</td>
                  <td className="p-3 tabular-nums">{s.participationPct != null ? `${s.participationPct}%` : "—"}</td>
                  <td className="p-3 tabular-nums">
                    {s.avgScorePct != null ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded font-bold text-[12px]"
                        style={
                          s.avgScorePct >= 70
                            ? { background: "#e0ede5", color: "#225739" }
                            : s.avgScorePct >= 40
                            ? { background: "#fef3c7", color: "#7a5a00" }
                            : { background: "#fee2e2", color: "#b91c1c" }
                        }
                      >
                        {s.avgScorePct}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3 tabular-nums text-[12px] text-foreground/75">{fmtSec(s.avgAnswerSec, isAr)}</td>
                  <td className="p-3 text-[12px] text-foreground/75 max-w-[220px]">
                    {s.hardest ? (
                      <div className="truncate" title={s.hardest.prompt}>
                        {s.hardest.prompt || noTextLabel}
                        <span className="text-rose-600 tabular-nums ms-1">· {s.hardest.correctPct}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, color: accent }}
        >
          {icon}
        </div>
        <div className="text-[11px] text-muted-foreground font-bold">{label}</div>
      </div>
      <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Sparkline({
  points,
  totalPoints,
  avgPart,
  isAr,
}: {
  points: { x: number; y: number }[];
  totalPoints: number;
  avgPart: number | null;
  isAr: boolean;
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
    ? `${path} L${projected[projected.length - 1].cx.toFixed(1)},${(padY + innerH).toFixed(1)} L${projected[0].cx.toFixed(1)},${(padY + innerH).toFixed(1)} Z`
    : null;

  const partLineY = avgPart != null ? padY + (1 - avgPart / 100) * innerH : null;

  if (points.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground">
        {isAr ? "لا توجد بيانات نتائج بعد." : "No score data yet."}
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" role="img" aria-label={isAr ? "رسم بياني لتطور النتائج" : "Score trend chart"}>
      {/* Gridlines at 0, 50, 100 */}
      {[0, 50, 100].map((g) => {
        const y = padY + (1 - g / 100) * innerH;
        return (
          <g key={g}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
            <text x={W - padX} y={y - 2} fontSize="9" fill="#94a3b8" textAnchor="end">{g}%</text>
          </g>
        );
      })}

      {/* Avg participation reference line */}
      {partLineY != null && (
        <g>
          <line x1={padX} y1={partLineY} x2={W - padX} y2={partLineY} stroke={BRAND_GOLD} strokeDasharray="2 3" strokeOpacity="0.5" />
          <text x={padX + 4} y={partLineY - 3} fontSize="9" fill={BRAND_GOLD}>
            {isAr ? "متوسط المشاركة" : "Avg participation"}
          </text>
        </g>
      )}

      {areaPath && <path d={areaPath} fill={BRAND_GREEN} fillOpacity="0.08" />}
      {projected.length > 1 && (
        <path d={path} fill="none" stroke={BRAND_GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {projected.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r="3.5" fill="white" stroke={BRAND_GREEN} strokeWidth="2" />
          <title>{`${points[i].y}%`}</title>
        </g>
      ))}
    </svg>
  );
}

function fmtSec(n: number | null, isAr: boolean): string {
  if (n == null) return "—";
  if (isAr) {
    if (n < 60) return `${n} ث`;
    return `${Math.floor(n / 60)} د ${n % 60} ث`;
  }
  if (n < 60) return `${n}s`;
  return `${Math.floor(n / 60)}m ${n % 60}s`;
}

function fmtDate(iso: string | null, isAr: boolean): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(isAr ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
