import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Users,
  Download,
  Target,
  TrendingDown,
  BarChart3,
  Trophy,
  Clock,
  History,
  X,
  MinusCircle,
  Printer,
  Lightbulb,
  Activity,
  Hourglass,
  GitCompare,
  TrendingUp,
  UserMinus,
  Maximize2,
  LineChart,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

interface ResponseRow {
  studentKey: string;
  studentName: string;
  answerIndex: number | null;
  answerText: string | null;
  isCorrect: boolean | null;
  createdAt: string;
  aggregateOnly?: boolean;
  answeredCount?: number;
  correctCount?: number;
  responseSec?: number | null;
}

export interface ActivityResult {
  elementId: string;
  slideIndex: number;
  activityKind: string;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  counts: Record<string, number>;
  answered: number;
  correct: number;
  correctPct: number | null;
  skipped: number;
  avgResponseSec: number | null;
  responses: ResponseRow[];
}

interface InsightsPayload {
  hardestQ: HardestRow | null;
  mostEngagedSlide: { slideIndex: number; participants: number } | null;
  participationPct: number | null;
  nonResponders: { id: number; name: string }[];
  avgAnswerSec: number | null;
  successPct: number | null;
  lowestParticipants: { studentKey: string; name: string; pct: number | null; correct: number; answered: number; totalActivities: number }[];
  classAvgPct: number | null;
}

export interface StudentRow {
  studentKey: string;
  name: string;
  answered: number;
  correct: number;
  totalScorable: number;
  pct: number | null;
  kind: "class" | "guest";
  classStudentId?: number | null;
}

interface HardestRow {
  elementId: string;
  slideIndex: number;
  prompt: string;
  answered: number;
  correct: number;
  correctPct: number | null;
}

interface Summary {
  participantsCount: number;
  classSize: number | null;
  participationPct: number | null;
  avgScorePct: number | null;
  scorableActivities: number;
  totalActivities: number;
  totalAnswers: number;
  durationMin: number | null;
}

interface ResultsPayload {
  session: {
    id: number;
    pin: string;
    status: string;
    mode: "class" | "guest";
    startedAt: string | null;
    endedAt: string | null;
    targetClassId: number | null;
    targetClassName: string | null;
  };
  deck: { id: number; title: string; language: "ar" | "en" };
  participantsCount: number;
  classSize: number | null;
  summary: Summary;
  hardestActivities: HardestRow[];
  students: StudentRow[];
  activities: ActivityResult[];
  insights: InsightsPayload;
}

/* Owner-only results dashboard for an ended (or in-progress) live
   presentation session. Lists every activity that exists on the deck
   with answer counts, % correct, and a per-student response table. */
export default function PresentationResults() {
  const { lang, dir, t } = useI18n();
  const r = t.presentation.results;
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sid = Number(params.sessionId);

  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    fetch(`${API_BASE}/api/presentations/sessions/${sid}/results`, { credentials: "include" })
      .then((r) => {
        if (r.status === 403) throw new Error("forbidden");
        if (!r.ok) throw new Error("load");
        return r.json();
      })
      .then((j: ResultsPayload) => setData(j))
      .catch((e: Error) => {
        if (e.message === "forbidden") setError(r.forbidden);
        else setError(t.presentation.loadError);
        toast.error(t.presentation.loadError);
      })
      .finally(() => setLoading(false));
  }, [sid, r.forbidden, t.presentation.loadError]);

  if (loading) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (error || !data) {
    return (
      <div dir={dir} className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div>{error ?? t.presentation.loadError}</div>
        <Button onClick={() => setLocation("/teacher/presentations")} variant="outline">{t.presentation.back}</Button>
      </div>
    );
  }

  const startedAt = data.session.startedAt ? new Date(data.session.startedAt) : null;
  const endedAt = data.session.endedAt ? new Date(data.session.endedAt) : null;
  const durationMin = data.summary.durationMin ?? (startedAt && endedAt ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : null);

  return (
    <div dir={dir} className="min-h-screen bg-slate-950 text-white p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <button
                onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/sessions`)}
                className="text-xs sm:text-sm text-white/60 hover:text-white inline-flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" /> {r.allSessions}
              </button>
              <span className="text-white/30">·</span>
              <button
                onClick={() => setLocation(`/teacher/presentations/${data.deck.id}`)}
                className="text-xs sm:text-sm text-white/60 hover:text-white"
              >
                {r.editor}
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{data.deck.title}</h1>
            <div className="text-xs sm:text-sm text-white/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>PIN <span className="tabular-nums" style={{ color: BRAND_GOLD }}>{data.session.pin}</span></span>
              <span>·</span>
              <span>{data.session.status === "ended" ? r.ended : r.inProgress}</span>
              {durationMin != null && (<><span>·</span><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{durationMin} {r.minutes}</span></>)}
              {data.session.targetClassName && (<><span>·</span><span>{r.class} {data.session.targetClassName}</span></>)}
              {data.session.mode === "guest" && (<><span>·</span><span>{r.guestMode}</span></>)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => { window.location.href = `${API_BASE}/api/presentations/sessions/${sid}/results.csv`; }}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Download className="w-4 h-4 ml-1" />
              {r.answersCsv}
            </Button>
            <Button
              onClick={() => { window.location.href = `${API_BASE}/api/presentations/sessions/${sid}/students.csv`; }}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Download className="w-4 h-4 ml-1" />
              {r.studentsCsv}
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/sessions`)}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <History className="w-4 h-4 ml-1" />
              {r.previous}
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/compare`)}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <GitCompare className="w-4 h-4 ml-1" />
              {r.compare}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <SummaryCard summary={data.summary} />

        {/* Educational insights — quiet, calm, no AI */}
        <InsightsSection insights={data.insights} activities={data.activities} />

        {/* Hardest questions */}
        {data.hardestActivities.length > 0 && (
          <HardestSection rows={data.hardestActivities} />
        )}

        {/* Students table */}
        {data.students.length > 0 && (
          <StudentsCard students={data.students} onSelect={setSelectedStudentKey} />
        )}

        {/* Per-activity breakdown */}
        <div className="flex items-center gap-2 text-sm text-white/70 pt-2">
          <BarChart3 className="w-4 h-4" />
          <span className="font-bold">{r.activityDetails} ({data.activities.length})</span>
        </div>
        {data.activities.length === 0 ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-10 text-center text-white/70">
            {r.noActivities}
          </div>
        ) : (
          data.activities.map((a, i) => (
            <ActivityCard key={a.elementId} activity={a} index={i + 1} />
          ))
        )}
      </div>

      {selectedStudentKey && (
        <StudentDetailModal
          studentKey={selectedStudentKey}
          students={data.students}
          activities={data.activities}
          sessionStartedAt={data.session.startedAt}
          deckTitle={data.deck.title}
          sessionPin={data.session.pin}
          sessionId={sid}
          classAvgPct={data.insights.classAvgPct}
          onClose={() => setSelectedStudentKey(null)}
        />
      )}
    </div>
  );
}

// ─── Summary card with the 4 main numbers ─────────────────────────────
function SummaryCard({ summary }: { summary: Summary }) {
  const { t } = useI18n();
  const r = t.presentation.results;
  const tile = (icon: React.ReactNode, label: string, value: string, sub?: string, accent?: string) => (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: accent ? `${accent}25` : "rgba(255,255,255,0.06)", color: accent ?? "white" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-white/60">{label}</div>
        <div className="text-xl sm:text-2xl font-black tabular-nums">{value}</div>
        {sub && <div className="text-[10px] text-white/50 mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {tile(
        <Users className="w-5 h-5" />,
        r.participants,
        String(summary.participantsCount),
        summary.classSize != null ? `${r.outOf} ${summary.classSize}` : r.guestMode,
        "#6ba184",
      )}
      {tile(
        <Target className="w-5 h-5" />,
        r.participationRate,
        summary.participationPct != null ? `${summary.participationPct}%` : "—",
        summary.classSize != null ? `${summary.participantsCount} / ${summary.classSize}` : r.unavailable,
        BRAND_GOLD,
      )}
      {tile(
        <Trophy className="w-5 h-5" />,
        r.averageCorrectness,
        summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—",
        `${summary.scorableActivities} ${r.scoredActivities}`,
        "#6ba184",
      )}
      {tile(
        <BarChart3 className="w-5 h-5" />,
        r.totalAnswers,
        String(summary.totalAnswers),
        `${summary.totalActivities} ${r.activity} · ${summary.durationMin ?? "—"} ${r.minutes}`,
        "#a78bfa",
      )}
    </div>
  );
}

// ─── Educational insights — quiet 8-tile layer over existing data ────
function InsightsSection({
  insights,
  activities,
}: {
  insights: InsightsPayload;
  activities: ActivityResult[];
}) {
  const { t } = useI18n();
  const r = t.presentation.results;
  const fmtSec = (n: number | null) => {
    if (n == null) return "—";
    if (n < 60) return `${n} ${r.seconds}`;
    return `${Math.floor(n / 60)} ${r.minutes} ${n % 60} ${r.seconds}`;
  };

  const tile = (icon: React.ReactNode, label: string, body: React.ReactNode, accent?: string) => (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accent ? `${accent}20` : "rgba(255,255,255,0.06)", color: accent ?? "white" }}
        >
          {icon}
        </div>
        <div className="text-[11px] text-white/55 font-bold">{label}</div>
      </div>
      <div className="text-sm text-white/85">{body}</div>
    </div>
  );

  /* Resolve hardestQ + mostEngagedSlide labels off the activities
     payload so we don't duplicate slide/prompt text from the insights
     blob (keeps the API surface lean). */
  const hardest = insights.hardestQ;
  const eng = insights.mostEngagedSlide;
  const slideAnswers = eng != null
    ? activities.filter((a) => a.slideIndex === eng.slideIndex).reduce((s, a) => s + a.answered, 0)
    : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/40 border border-emerald-500/10 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4" style={{ color: BRAND_GOLD }} />
        <h2 className="font-bold text-sm">{r.educationalInsights}</h2>
        <span className="text-[10px] text-white/40">{r.insightsSubtitle}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {tile(
          <TrendingDown className="w-4 h-4" />,
          r.hardestQuestion,
          hardest ? (
            <div>
              <div className="font-bold text-white/95 break-words text-[13px] line-clamp-2">{hardest.prompt || "—"}</div>
              <div className="text-[11px] text-white/55 mt-1 tabular-nums">
                {hardest.correctPct}% {r.correct} · {r.slide} {hardest.slideIndex + 1}
              </div>
            </div>
          ) : <div className="text-white/50 text-[12px]">{r.noData}</div>,
          "#fda4af",
        )}

        {tile(
          <Activity className="w-4 h-4" />,
          r.mostEngagedSlide,
          eng ? (
            <div>
              <div className="font-bold text-white/95 tabular-nums">{r.slide} {eng.slideIndex + 1}</div>
              <div className="text-[11px] text-white/55 mt-1 tabular-nums">
                {eng.participants} {r.student} · {slideAnswers} {r.answer}
              </div>
            </div>
          ) : <div className="text-white/50 text-[12px]">{r.noData}</div>,
          "#6ba184",
        )}

        {tile(
          <Target className="w-4 h-4" />,
          r.participationRate,
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: BRAND_GOLD }}>
              {insights.participationPct != null ? `${insights.participationPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">
              {insights.participationPct != null ? r.classStudents : r.guestMode}
            </div>
          </div>,
          BRAND_GOLD,
        )}

        {tile(
          <Trophy className="w-4 h-4" />,
          r.successRate,
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: "#99c1ab" }}>
              {insights.successPct != null ? `${insights.successPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">{r.averageCorrectAnswers}</div>
          </div>,
          "#6ba184",
        )}

        {tile(
          <Hourglass className="w-4 h-4" />,
          r.averageAnswerTime,
          <div>
            <div className="font-black text-2xl tabular-nums">{fmtSec(insights.avgAnswerSec)}</div>
            <div className="text-[11px] text-white/55 mt-1">{r.perQuestionEstimate}</div>
          </div>,
          "#a78bfa",
        )}

        {tile(
          <BarChart3 className="w-4 h-4" />,
          r.classAverage,
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: BRAND_GOLD }}>
              {insights.classAvgPct != null ? `${insights.classAvgPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">{r.individualComparisonReference}</div>
          </div>,
          BRAND_GOLD,
        )}

        {tile(
          <UserMinus className="w-4 h-4" />,
          r.didNotParticipate,
          insights.nonResponders.length === 0 ? (
            <div className="text-white/55 text-[12px]">{insights.participationPct != null ? r.everyoneParticipated : "—"}</div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] text-white/55 tabular-nums">
                {insights.nonResponders.length} {r.student}
              </div>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                {insights.nonResponders.slice(0, 6).map((r) => (
                  <span
                    key={r.id}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-200/90 break-words"
                  >
                    {r.name}
                  </span>
                ))}
                {insights.nonResponders.length > 6 && (
                  <span className="text-[10px] text-white/40">+{insights.nonResponders.length - 6}</span>
                )}
              </div>
            </div>
          ),
          BRAND_GOLD,
        )}

        {tile(
          <TrendingDown className="w-4 h-4" />,
          r.lowestParticipation,
          insights.lowestParticipants.length === 0 ? (
            <div className="text-white/55 text-[12px]">{insights.participationPct === 100 && insights.nonResponders.length === 0 ? r.everyoneFullyParticipated : r.noData}</div>
          ) : (
            <div className="space-y-1">
              {insights.lowestParticipants.map((s) => (
                <div key={s.studentKey} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-white/85">{s.name}</span>
                  <span className="tabular-nums text-rose-300/90 font-bold flex-shrink-0">
                    {s.answered}/{s.totalActivities || "—"}
                  </span>
                </div>
              ))}
            </div>
          ),
          "#fda4af",
        )}
      </div>
    </div>
  );
}

// ─── Hardest activities (top 3 by error rate) ─────────────────────────
function HardestSection({ rows }: { rows: HardestRow[] }) {
  const { t } = useI18n();
  const r = t.presentation.results;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-rose-300" />
        <h2 className="font-bold">{r.hardestQuestions}</h2>
        <span className="text-xs text-white/50">({rows.length})</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((r, i) => (
          <div key={r.elementId} className="p-3 sm:p-4 flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-sm"
              style={{ background: "rgba(244,63,94,0.15)", color: "#fda4af" }}
            >
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-white/50 mb-0.5">
                {r.slideIndex >= 0 ? `${t.presentation.results.slide} ${r.slideIndex + 1}` : t.presentation.results.deletedActivity}
              </div>
              <div className="font-bold text-white/95 break-words text-sm">{r.prompt || t.presentation.results.noText}</div>
            </div>
            <div className="text-end flex-shrink-0">
              <div className="text-lg font-black tabular-nums" style={{ color: "#fda4af" }}>
                {r.correctPct}%
              </div>
              <div className="text-[10px] text-white/50">
                {r.correct}/{r.answered} {t.presentation.results.correct}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Students table — one row per studentKey ──────────────────────────
function StudentsCard({ students, onSelect }: { students: StudentRow[]; onSelect: (studentKey: string) => void }) {
  const { t } = useI18n();
  const r = t.presentation.results;
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-300" />
          <h2 className="font-bold">{r.students}</h2>
          <span className="text-xs text-white/50">({students.length})</span>
        </div>
        <div className="text-[11px] text-white/50">{r.selectStudentHint}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60 text-xs">
            <tr>
              <th className="text-start p-2 px-3 sm:px-4">{r.student}</th>
              <th className="text-start p-2">{r.type}</th>
              <th className="text-start p-2 tabular-nums">{r.answers}</th>
              <th className="text-start p-2 tabular-nums">{r.correctAnswers}</th>
              <th className="text-start p-2 tabular-nums">{r.percentage}</th>
              <th className="text-start p-2"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr
                key={s.studentKey}
                onClick={() => onSelect(s.studentKey)}
                className="border-t border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <td className="p-2 px-3 sm:px-4 font-medium break-words max-w-[14rem]">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect(s.studentKey); }}
                    aria-label={r.viewStudentAnswers.replace("{name}", s.name)}
                    className="text-start hover:text-emerald-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                  >
                    {s.name}
                  </button>
                </td>
                <td className="p-2">
                  {s.kind === "class" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300">
                      {r.fromClass}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300">
                      {r.guest}
                    </span>
                  )}
                </td>
                <td className="p-2 tabular-nums">{s.answered}<span className="text-white/40"> / {s.totalScorable}</span></td>
                <td className="p-2 tabular-nums">{s.correct}</td>
                <td className="p-2">
                  {s.pct == null ? (
                    <span className="text-white/40">—</span>
                  ) : (
                    <span
                      className="inline-block px-2 py-0.5 rounded font-black tabular-nums text-xs"
                      style={
                        s.pct >= 70
                          ? { background: "rgba(52,211,153,0.15)", color: "#99c1ab" }
                          : s.pct >= 40
                          ? { background: "rgba(217,165,33,0.18)", color: BRAND_GOLD }
                          : { background: "rgba(244,63,94,0.15)", color: "#fda4af" }
                      }
                    >
                      {s.pct}%
                    </span>
                  )}
                </td>
                <td className="p-2 text-white/40">
                  <ChevronLeft className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Per-activity card (existing structure preserved) ─────────────────
function ActivityCard({ activity, index }: { activity: ActivityResult; index: number }) {
  const { lang, t } = useI18n();
  const tr = t.presentation.results;
  const { prompt, options, correctIndex, counts, answered, correct, correctPct, responses, slideIndex, skipped, avgResponseSec } = activity;
  const maxCount = Math.max(1, ...Object.values(counts));
  const wrong = correctIndex != null ? Math.max(0, answered - correct) : 0;
  /* Slim "calm" progress bar — three-segment view of green/red/grey
     so the teacher can read the activity at a glance without expanding. */
  const total = Math.max(1, answered + skipped);
  const correctW = correctIndex != null ? (correct / total) * 100 : 0;
  const wrongW = correctIndex != null ? (wrong / total) * 100 : (answered / total) * 100;
  const skipW = (skipped / total) * 100;

  const fmtSec = (n: number | null) => {
    if (n == null) return "—";
    if (n < 60) return `${n} ${tr.seconds}`;
    return `${Math.floor(n / 60)} ${tr.minutes} ${n % 60} ${tr.seconds}`;
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white/50 mb-1">
            {tr.activity} {index}{slideIndex >= 0 ? ` · ${tr.slide} ${slideIndex + 1}` : ""}
          </div>
          <div className="font-bold text-white/95 break-words">{prompt || tr.noText}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg bg-white/5 px-3 py-1.5">
            <span className="text-white/60">{tr.answers}:</span> <b>{answered}</b>
          </div>
          {correctPct != null && (
            <div className="rounded-lg bg-emerald-500/10 text-emerald-300 px-3 py-1.5">
              {correctPct}% {tr.correct} ({correct}/{answered})
            </div>
          )}
        </div>
      </div>

      {/* Mini analytics — slim 3-tone progress + correct/wrong/skip + avg time */}
      <div className="px-4 pt-3">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/5">
          {correctW > 0 && <div className="h-full bg-emerald-500/70" style={{ width: `${correctW}%` }} title={tr.correct} />}
          {wrongW > 0 && <div className="h-full bg-rose-500/60" style={{ width: `${wrongW}%` }} title={tr.incorrect} />}
          {skipW > 0 && <div className="h-full bg-white/15" style={{ width: `${skipW}%` }} title={tr.noAnswer} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
            <span className="tabular-nums">{correct} {tr.correct}</span>
          </span>
          {correctIndex != null && (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500/60 inline-block" />
              <span className="tabular-nums">{wrong} {tr.incorrect}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white/30 inline-block" />
            <span className="tabular-nums">{skipped} {tr.noAnswer}</span>
          </span>
          <span className="inline-flex items-center gap-1 mr-auto">
            <Hourglass className="w-3 h-3" />
            <span className="tabular-nums">{tr.averageTime}: {fmtSec(avgResponseSec)}</span>
          </span>
        </div>
      </div>

      {options.length > 0 && (
        <div className="p-4 space-y-2 border-b border-white/10">
          {options.map((opt, i) => {
            const c = counts[String(i)] ?? 0;
            const pct = answered > 0 ? Math.round((c / answered) * 100) : 0;
            const isCorrect = correctIndex === i;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span className={isCorrect ? "text-emerald-300 font-bold" : "text-white/85"}>{opt}</span>
                  </div>
                  <div className="text-white/60 tabular-nums">{c} · {pct}%</div>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={isCorrect ? "h-full bg-emerald-500/70" : "h-full bg-amber-400/60"}
                    style={{ width: `${(c / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {responses.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-xs">
              <tr>
                <th className="text-start p-2 px-4">{tr.student}</th>
                <th className="text-start p-2">{tr.answer}</th>
                <th className="text-start p-2">{tr.status}</th>
                <th className="text-start p-2 px-4">{tr.time}</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => {
                const ans = r.aggregateOnly ? `${r.answeredCount ?? 0} ${tr.answer} · ${r.correctCount ?? 0} ${tr.correct}` : r.answerText
                  ?? (r.answerIndex != null && options[r.answerIndex] != null ? options[r.answerIndex] : (r.answerIndex != null ? `#${r.answerIndex + 1}` : "—"));
                return (
                  <tr key={r.studentKey + r.createdAt} className="border-t border-white/5">
                    <td className="p-2 px-4 font-medium">{r.studentName}</td>
                    <td className="p-2 text-white/85 break-words max-w-xs">{ans}</td>
                    <td className="p-2">
                      {r.isCorrect === true ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> {tr.correct}</span>
                      ) : r.isCorrect === false ? (
                        <span className="inline-flex items-center gap-1 text-rose-300"><XCircle className="w-4 h-4" /> {tr.incorrect}</span>
                      ) : (
                        <span className="text-white/50">—</span>
                      )}
                    </td>
                    <td className="p-2 px-4 text-white/50 tabular-nums">
                      {new Date(r.createdAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-center text-white/50 text-sm">{tr.noActivityAnswers}</div>
      )}
    </div>
  );
}

// ─── Per-student detail modal ─────────────────────────────────────────
interface StudentActivityRow {
  elementId: string;
  slideIndex: number;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  correctText: string | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  answeredAt: Date | null;
  responseSec: number | null;
}

export function StudentDetailModal({
  studentKey,
  students,
  activities,
  sessionStartedAt,
  deckTitle,
  sessionPin,
  sessionId,
  classAvgPct,
  onClose,
}: {
  studentKey: string;
  students: StudentRow[];
  activities: ActivityResult[];
  sessionStartedAt: string | null;
  deckTitle: string;
  sessionPin: string;
  sessionId?: number;
  classAvgPct: number | null;
  onClose: () => void;
}) {
  const { lang, dir, t } = useI18n();
  const r = t.presentation.results;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const student = students.find((s) => s.studentKey === studentKey);

  // Build per-activity rows for this student, sorted by slide order then activity order.
  const sorted = [...activities].sort((a, b) => {
    if (a.slideIndex !== b.slideIndex) return a.slideIndex - b.slideIndex;
    return 0;
  });

  // Track previous answeredAt per-student to compute response time (gap since prior answer).
  let prevAnsweredAt: Date | null = sessionStartedAt ? new Date(sessionStartedAt) : null;

  const rows: StudentActivityRow[] = sorted.map((a) => {
    const r = [...a.responses].reverse().find((x) => x.studentKey === studentKey) ?? null;
    const correctText =
      a.correctIndex != null && a.options[a.correctIndex] != null
        ? a.options[a.correctIndex]
        : null;
    let studentAnswer: string | null = null;
    if (r) {
      studentAnswer = r.aggregateOnly ? `${r.answeredCount ?? 0} ${t.presentation.results.answer} · ${r.correctCount ?? 0} ${t.presentation.results.correct}` :
        r.answerText ??
        (r.answerIndex != null && a.options[r.answerIndex] != null
          ? a.options[r.answerIndex]
          : r.answerIndex != null
          ? `#${r.answerIndex + 1}`
          : null);
    }
    const answeredAt = r ? new Date(r.createdAt) : null;
    let responseSec: number | null = r?.responseSec ?? null;
    if (responseSec == null && answeredAt && prevAnsweredAt && !r?.aggregateOnly) {
      const diff = Math.round((answeredAt.getTime() - prevAnsweredAt.getTime()) / 1000);
      if (diff >= 0 && diff < 60 * 60) responseSec = diff;
    }
    if (answeredAt) prevAnsweredAt = answeredAt;
    return {
      elementId: a.elementId,
      slideIndex: a.slideIndex,
      prompt: a.prompt,
      options: a.options,
      correctIndex: a.correctIndex,
      correctText,
      studentAnswer,
      isCorrect: r?.isCorrect ?? null,
      answeredAt,
      responseSec,
    };
  });

  const answered = student?.answered ?? rows.filter((r) => r.studentAnswer != null).length;
  const correct = student?.correct ?? rows.filter((r) => r.isCorrect === true).length;
  const total = rows.length;
  const pct = student?.pct ?? null;
  const studentName = student?.name ?? r.student;

  const handlePrint = () => {
    const esc = (s: string | null | undefined) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
    const fmtResp = (n: number | null) =>
      n == null ? "—" : n < 60 ? `${n} ${r.seconds}` : `${Math.floor(n / 60)} ${r.minutes} ${n % 60} ${r.seconds}`;
    const statusCell = (r: StudentActivityRow) => {
      if (r.studentAnswer == null) return `<span style="color:#94a3b8">${t.presentation.results.noAnswer}</span>`;
      if (r.isCorrect === true) return `<span style="color:#225739;font-weight:bold">${t.presentation.results.correct} ✓</span>`;
      if (r.isCorrect === false) return `<span style="color:#b91c1c;font-weight:bold">${t.presentation.results.incorrect} ✗</span>`;
      return "—";
    };
    const rowsHtml = rows
      .map(
        (r, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${r.slideIndex >= 0 ? `${t.presentation.results.slide} ${r.slideIndex + 1}` : "—"}</td>
          <td class="prompt">${esc(r.prompt) || t.presentation.results.noText}</td>
          <td>${r.studentAnswer == null ? '<span style="color:#94a3b8">—</span>' : esc(r.studentAnswer)}</td>
          <td>${esc(r.correctText) || '<span style="color:#94a3b8">—</span>'}</td>
          <td>${statusCell(r)}</td>
          <td class="num">${fmtTime(r.answeredAt)}</td>
          <td class="num">${fmtResp(r.responseSec)}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
<title>${esc(studentName)} — ${esc(deckTitle)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; color: ${BRAND_GREEN}; }
  .meta { font-size: 12px; color: #475569; margin-bottom: 4px; }
  .meta b { color: #0f172a; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0 14px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 12px; }
  .stat b { display: block; font-size: 16px; color: ${BRAND_GREEN}; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: ${BRAND_GREEN}; color: #fff; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: start; vertical-align: top; }
  td.num { text-align: center; white-space: nowrap; tabular-nums: 1; }
  td.prompt { max-width: 220px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .footer { margin-top: 10px; font-size: 10px; color: #64748b; text-align: center; }
  @media print { .noprint { display: none !important; } }
  .noprint { position: fixed; top: 8px; left: 8px; }
  .noprint button { font: inherit; padding: 6px 12px; border: 1px solid ${BRAND_GREEN}; background: ${BRAND_GREEN}; color: #fff; border-radius: 6px; cursor: pointer; }
</style></head><body>
    <div class="noprint"><button onclick="window.print()">${r.print}</button></div>
<h1>${r.studentDetails}</h1>
<div class="meta"><b>${r.student}:</b> ${esc(studentName)}</div>
<div class="meta"><b>${r.deck}:</b> ${esc(deckTitle)} · <b>PIN:</b> ${esc(sessionPin)}</div>
<div class="summary">
  <div class="stat">${r.answered}<b>${answered} / ${total}</b></div>
  <div class="stat">${r.correctAnswers}<b>${correct}</b></div>
  <div class="stat">${r.percentage}<b>${pct != null ? pct + "%" : "—"}</b></div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>${r.slide}</th><th>${r.hardestQuestion}</th><th>${r.studentAnswer}</th>
      <th>${r.correctAnswers}</th><th>${r.status}</th><th>${r.time}</th><th>${r.responseTimeEstimate}</th>
    </tr>
  </thead>
  <tbody>${rowsHtml || `<tr><td colspan="8" style="text-align:center;color:#64748b">${r.noActivities}</td></tr>`}</tbody>
</table>
<div class="footer">Hasad · ${new Date().toLocaleString(lang)}</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error(r.printPopupError);
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const handleDownloadCsv = () => {
    const esc = (s: string | null | undefined) => {
      const v = String(s ?? "");
      return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const status = (r: StudentActivityRow) =>
      r.studentAnswer == null ? t.presentation.results.noAnswer : r.isCorrect === true ? t.presentation.results.correct : r.isCorrect === false ? t.presentation.results.incorrect : "";
    const headerLines = [
      `# ${r.student}: ${studentName}`,
      `# ${r.deck}: ${deckTitle}`,
      `# PIN: ${sessionPin}`,
      `# ${r.correctAnswers}: ${r.correctSummary.replace("{correct}", String(correct)).replace("{answered}", String(answered)).replace("{total}", String(total))}${pct != null ? ` · ${r.percentage} ${pct}%` : ""}`,
      "",
    ];
    const cols = ["#", r.slide, r.question, r.studentAnswer, r.correctAnswer, r.status, r.time, r.responseTimeSeconds];
    const dataLines = rows.map((r, i) =>
      [
        i + 1,
        r.slideIndex >= 0 ? r.slideIndex + 1 : "",
        r.prompt,
        r.studentAnswer ?? "",
        r.correctText ?? "",
        status(r),
        fmtTime(r.answeredAt),
        r.responseSec ?? "",
      ]
        .map((v) => esc(String(v)))
        .join(","),
    );
    const csv = "\uFEFF" + [...headerLines, cols.map(esc).join(","), ...dataLines].join("\r\n");
    const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim() || "student";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe(studentName)}-${safe(deckTitle)}-${sessionPin}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-none sm:rounded-2xl w-full sm:max-w-3xl max-h-screen sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <button
              onClick={onClose}
              className="text-xs text-white/60 hover:text-white inline-flex items-center gap-1 mb-1"
            >
              <ChevronRight className="w-4 h-4" /> {r.closeResults}
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-white break-words">
              {student?.name ?? r.student}
            </h2>
            <div className="text-xs text-white/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {student?.kind === "class" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300">
                  {r.fromClass}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300">
                  {r.guest}
                </span>
              )}
              <span>·</span>
              <span className="tabular-nums">
                {r.answeredSummary.replace("{correct}", String(correct)).replace("{answered}", String(answered)).replace("{total}", String(total))}
              </span>
              {pct != null && (
                <>
                  <span>·</span>
                  <span
                    className="inline-block px-2 py-0.5 rounded font-black tabular-nums text-[11px]"
                    style={
                      pct >= 70
                        ? { background: "rgba(52,211,153,0.15)", color: "#99c1ab" }
                        : pct >= 40
                        ? { background: "rgba(217,165,33,0.18)", color: BRAND_GOLD }
                        : { background: "rgba(244,63,94,0.15)", color: "#fda4af" }
                    }
                  >
                    {pct}%
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              aria-label={r.printDetails}
              title={r.print}
              className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white inline-flex items-center gap-1 text-xs font-bold"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{r.print}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              aria-label={r.downloadDetailsCsv}
              title={r.downloadCsv}
              className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white inline-flex items-center gap-1 text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            {sessionId != null && (
              <a
                href={`/p/results/${sessionId}/students/${encodeURIComponent(studentKey)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.expandedViewAria}
                title={r.expandedView}
                className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white inline-flex items-center gap-1 text-xs font-bold"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">{r.expandedView}</span>
              </a>
            )}
            {student?.kind === "class" && student?.classStudentId != null ? (
              <a
                href={`/teacher/students/${student.classStudentId}/timeline`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.progressHistoryAria}
                title={r.progressHistory}
                className="h-9 px-2.5 rounded-lg border inline-flex items-center gap-1 text-xs font-bold"
                style={{ background: "rgba(217,165,33,0.15)", borderColor: "rgba(217,165,33,0.4)", color: BRAND_GOLD }}
              >
                <LineChart className="w-4 h-4" />
                <span className="hidden sm:inline">📈 {r.progressHistory}</span>
              </a>
            ) : student?.kind === "guest" ? (
              <span
                title={r.guestsNoHistory}
                className="h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-white/40 inline-flex items-center gap-1 text-xs font-bold cursor-not-allowed"
              >
                <LineChart className="w-4 h-4" />
                <span className="hidden sm:inline">{r.guestsNoHistory}</span>
              </span>
            ) : null}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
              aria-label={r.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* Strengths / weaknesses / class comparison — Phase 1 student insights.
              Strengths = correctly answered prompts (top 3 shown), weaknesses
              = wrongly answered prompts (top 3). Comparison bars stack the
              student's % above the class average so divergence is obvious. */}
          {rows.length > 0 && (
            <div className="p-3 sm:p-4 border-b border-white/10 bg-emerald-950/10">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4" style={{ color: BRAND_GOLD }} />
                <h3 className="text-sm font-bold text-white/90">{r.studentInsights}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Comparison bars */}
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                  <div className="text-[11px] text-white/55 font-bold mb-2">{r.comparedToClassAverage}</div>
                  {(() => {
                    const stuPct = pct ?? 0;
                    const cls = classAvgPct ?? 0;
                    const gap = pct != null && classAvgPct != null ? stuPct - cls : null;
                    return (
                      <div className="space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-white/70">{studentName}</span>
                            <span className="tabular-nums font-bold text-white/95">{pct != null ? `${pct}%` : "—"}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${stuPct}%`, background: BRAND_GREEN }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-white/70">{r.classAverage}</span>
                            <span className="tabular-nums font-bold text-white/95">{classAvgPct != null ? `${classAvgPct}%` : "—"}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${cls}%`, background: BRAND_GOLD }} />
                          </div>
                        </div>
                        {gap != null && (
                          <div className="text-[11px] text-white/60 flex items-center gap-1">
                            {gap >= 0 ? (
                              <>
                                <TrendingUp className="w-3 h-3 text-emerald-300" />
                                <span className="text-emerald-300/90 tabular-nums font-bold">+{gap}</span>
                                <span>{r.pointsAboveAverage}</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3 text-rose-300" />
                                <span className="text-rose-300/90 tabular-nums font-bold">{gap}</span>
                                <span>{r.pointsBelowAverage}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Strengths + weaknesses */}
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3">
                    <div className="text-[11px] text-emerald-300 font-bold mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {r.strengths}
                      <span className="text-white/40 font-normal">· {r.quickCorrectAnswers}</span>
                    </div>
                    {(() => {
                      const strengths = rows
                        .filter((r) => r.isCorrect === true)
                        .slice()
                        .sort((a, b) => {
                          const ax = a.responseSec ?? Number.POSITIVE_INFINITY;
                          const bx = b.responseSec ?? Number.POSITIVE_INFINITY;
                          return ax - bx;
                        })
                        .slice(0, 3);
                      if (strengths.length === 0) {
                        return <div className="text-[11px] text-white/45">{r.noCorrectAnswers}</div>;
                      }
                      return (
                        <ul className="space-y-1">
                          {strengths.map((r) => (
                            <li key={r.elementId} className="text-[12px] text-white/85 flex items-center gap-2" title={r.prompt}>
                              <span className="truncate flex-1">· {r.prompt || t.presentation.results.noText}</span>
                              {r.responseSec != null && (
                                <span className="tabular-nums text-emerald-300/80 text-[10px] flex-shrink-0">
                                  {r.responseSec < 60 ? `${r.responseSec}${t.presentation.results.seconds}` : `${Math.floor(r.responseSec / 60)}${t.presentation.results.minutes}`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                  <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/15 p-3">
                    <div className="text-[11px] text-rose-300 font-bold mb-1.5 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> {r.improvements}
                      <span className="text-white/40 font-normal">· {r.slowestFirst}</span>
                    </div>
                    {(() => {
                      const weak = rows
                        .filter((r) => r.isCorrect === false)
                        .slice()
                        .sort((a, b) => (b.responseSec ?? 0) - (a.responseSec ?? 0))
                        .slice(0, 3);
                      if (weak.length === 0) {
                        return <div className="text-[11px] text-white/45">{r.noIncorrectAnswers}</div>;
                      }
                      return (
                        <ul className="space-y-1">
                          {weak.map((r) => (
                            <li key={r.elementId} className="text-[12px] text-white/85 flex items-center gap-2" title={r.prompt}>
                              <span className="truncate flex-1">· {r.prompt || t.presentation.results.noText}</span>
                              {r.responseSec != null && (
                                <span className="tabular-nums text-rose-300/80 text-[10px] flex-shrink-0">
                                  {r.responseSec < 60 ? `${r.responseSec}${t.presentation.results.seconds}` : `${Math.floor(r.responseSec / 60)}${t.presentation.results.minutes}`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="p-10 text-center text-white/60 text-sm">{r.noActivities}</div>
          ) : (
            <ol className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <li key={r.elementId} className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 text-white/70 flex items-center justify-center flex-shrink-0 text-xs font-black tabular-nums">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="text-[11px] text-white/50 mb-0.5">
                        {r.slideIndex >= 0 ? `${t.presentation.results.slide} ${r.slideIndex + 1}` : t.presentation.results.deletedActivity}
                      </div>
                      <div className="font-bold text-white/95 break-words text-sm">
                        {r.prompt || t.presentation.results.noText}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                        <div className="text-white/50 mb-1">{t.presentation.results.studentAnswer}</div>
                        {r.studentAnswer == null ? (
                          <div className="inline-flex items-center gap-1 text-white/50">
                            <MinusCircle className="w-4 h-4" /> {t.presentation.results.noAnswer}
                          </div>
                        ) : (
                          <div
                            className={
                              r.isCorrect === true
                                ? "inline-flex items-start gap-1 text-emerald-300 font-bold break-words"
                                : r.isCorrect === false
                                ? "inline-flex items-start gap-1 text-rose-300 font-bold break-words"
                                : "inline-flex items-start gap-1 text-white/85 break-words"
                            }
                          >
                            {r.isCorrect === true && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                            {r.isCorrect === false && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                            <span className="break-words">{r.studentAnswer}</span>
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                        <div className="text-white/50 mb-1">{t.presentation.results.correctAnswer}</div>
                        {r.correctText != null ? (
                          <div className="inline-flex items-start gap-1 text-emerald-300 font-bold break-words">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="break-words">{r.correctText}</span>
                          </div>
                        ) : (
                          <span className="text-white/50">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                      {r.answeredAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {r.answeredAt.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      )}
                      {r.responseSec != null && (
                        <span className="tabular-nums" title={t.presentation.results.responseTimeHint}>
                          {t.presentation.results.responseTimeEstimate}: {r.responseSec < 60 ? `${r.responseSec} ${t.presentation.results.seconds}` : `${Math.floor(r.responseSec / 60)} ${t.presentation.results.minutes} ${r.responseSec % 60} ${t.presentation.results.seconds}`}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 flex justify-end flex-shrink-0">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            {r.closeResults}
          </Button>
        </div>
      </div>
    </div>
  );
}
