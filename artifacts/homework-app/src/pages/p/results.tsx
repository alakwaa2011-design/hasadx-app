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
        if (e.message === "forbidden") setError("هذه النتائج مخصّصة لصاحب الجلسة فقط");
        else setError("تعذّر تحميل النتائج");
        toast.error("تعذّر تحميل النتائج");
      })
      .finally(() => setLoading(false));
  }, [sid]);

  if (loading) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (error || !data) {
    return (
      <div dir="rtl" className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div>{error ?? "تعذّر تحميل النتائج"}</div>
        <Button onClick={() => setLocation("/teacher/presentations")} variant="outline">العودة للعروض</Button>
      </div>
    );
  }

  const startedAt = data.session.startedAt ? new Date(data.session.startedAt) : null;
  const endedAt = data.session.endedAt ? new Date(data.session.endedAt) : null;
  const durationMin = data.summary.durationMin ?? (startedAt && endedAt ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)) : null);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <button
                onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/sessions`)}
                className="text-xs sm:text-sm text-white/60 hover:text-white inline-flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" /> كل الجلسات
              </button>
              <span className="text-white/30">·</span>
              <button
                onClick={() => setLocation(`/teacher/presentations/${data.deck.id}`)}
                className="text-xs sm:text-sm text-white/60 hover:text-white"
              >
                المحرّر
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{data.deck.title}</h1>
            <div className="text-xs sm:text-sm text-white/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>PIN <span className="tabular-nums" style={{ color: BRAND_GOLD }}>{data.session.pin}</span></span>
              <span>·</span>
              <span>{data.session.status === "ended" ? "منتهية" : "قيد التشغيل"}</span>
              {durationMin != null && (<><span>·</span><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{durationMin} د</span></>)}
              {data.session.targetClassName && (<><span>·</span><span>صف {data.session.targetClassName}</span></>)}
              {data.session.mode === "guest" && (<><span>·</span><span>وضع الضيوف</span></>)}
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
              CSV الإجابات
            </Button>
            <Button
              onClick={() => { window.location.href = `${API_BASE}/api/presentations/sessions/${sid}/students.csv`; }}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Download className="w-4 h-4 ml-1" />
              CSV الطلاب
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/sessions`)}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <History className="w-4 h-4 ml-1" />
              السابقة
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/presentations/${data.deck.id}/compare`)}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <GitCompare className="w-4 h-4 ml-1" />
              مقارنة
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
          <span className="font-bold">تفاصيل الأنشطة ({data.activities.length})</span>
        </div>
        {data.activities.length === 0 ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-10 text-center text-white/70">
            لا توجد أنشطة في هذا العرض.
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
        "المشاركون",
        String(summary.participantsCount),
        summary.classSize != null ? `من أصل ${summary.classSize}` : "وضع الضيوف",
        "#34d399",
      )}
      {tile(
        <Target className="w-5 h-5" />,
        "نسبة المشاركة",
        summary.participationPct != null ? `${summary.participationPct}%` : "—",
        summary.classSize != null ? `${summary.participantsCount} / ${summary.classSize}` : "غير متاح",
        BRAND_GOLD,
      )}
      {tile(
        <Trophy className="w-5 h-5" />,
        "متوسط الصحة",
        summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—",
        `${summary.scorableActivities} نشاط مُقَيَّم`,
        "#34d399",
      )}
      {tile(
        <BarChart3 className="w-5 h-5" />,
        "إجمالي الإجابات",
        String(summary.totalAnswers),
        `${summary.totalActivities} نشاط · ${summary.durationMin ?? "—"} د`,
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
  const fmtSec = (n: number | null) => {
    if (n == null) return "—";
    if (n < 60) return `${n} ث`;
    return `${Math.floor(n / 60)} د ${n % 60} ث`;
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
        <h2 className="font-bold text-sm">رؤى تربوية</h2>
        <span className="text-[10px] text-white/40">قراءة هادئة لأداء الجلسة</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {tile(
          <TrendingDown className="w-4 h-4" />,
          "السؤال الأصعب",
          hardest ? (
            <div>
              <div className="font-bold text-white/95 break-words text-[13px] line-clamp-2">{hardest.prompt || "—"}</div>
              <div className="text-[11px] text-white/55 mt-1 tabular-nums">
                {hardest.correctPct}% صحيح · شريحة {hardest.slideIndex + 1}
              </div>
            </div>
          ) : <div className="text-white/50 text-[12px]">لا يوجد بيانات</div>,
          "#fda4af",
        )}

        {tile(
          <Activity className="w-4 h-4" />,
          "الشريحة الأكثر تفاعلاً",
          eng ? (
            <div>
              <div className="font-bold text-white/95 tabular-nums">شريحة {eng.slideIndex + 1}</div>
              <div className="text-[11px] text-white/55 mt-1 tabular-nums">
                {eng.participants} طالب · {slideAnswers} إجابة
              </div>
            </div>
          ) : <div className="text-white/50 text-[12px]">لا يوجد</div>,
          "#34d399",
        )}

        {tile(
          <Target className="w-4 h-4" />,
          "نسبة المشاركة",
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: BRAND_GOLD }}>
              {insights.participationPct != null ? `${insights.participationPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">
              {insights.participationPct != null ? "من طلاب الفصل" : "وضع الضيوف"}
            </div>
          </div>,
          BRAND_GOLD,
        )}

        {tile(
          <Trophy className="w-4 h-4" />,
          "نسبة النجاح",
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: "#6ee7b7" }}>
              {insights.successPct != null ? `${insights.successPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">متوسط الإجابات الصحيحة</div>
          </div>,
          "#34d399",
        )}

        {tile(
          <Hourglass className="w-4 h-4" />,
          "متوسط زمن الإجابة",
          <div>
            <div className="font-black text-2xl tabular-nums">{fmtSec(insights.avgAnswerSec)}</div>
            <div className="text-[11px] text-white/55 mt-1">لكل سؤال (تقديري)</div>
          </div>,
          "#a78bfa",
        )}

        {tile(
          <BarChart3 className="w-4 h-4" />,
          "متوسط الفصل",
          <div>
            <div className="font-black text-2xl tabular-nums" style={{ color: BRAND_GOLD }}>
              {insights.classAvgPct != null ? `${insights.classAvgPct}%` : "—"}
            </div>
            <div className="text-[11px] text-white/55 mt-1">مرجع للمقارنة الفردية</div>
          </div>,
          BRAND_GOLD,
        )}

        {tile(
          <UserMinus className="w-4 h-4" />,
          "لم يشاركوا",
          insights.nonResponders.length === 0 ? (
            <div className="text-white/55 text-[12px]">{insights.participationPct != null ? "شارك الجميع 🌱" : "—"}</div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] text-white/55 tabular-nums">
                {insights.nonResponders.length} طالب
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
          "أقل ٣ مشاركة",
          insights.lowestParticipants.length === 0 ? (
            <div className="text-white/55 text-[12px]">شارك الجميع بالكامل 🌱</div>
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
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-rose-300" />
        <h2 className="font-bold">الأسئلة الأصعب</h2>
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
                {r.slideIndex >= 0 ? `شريحة ${r.slideIndex + 1}` : "نشاط محذوف"}
              </div>
              <div className="font-bold text-white/95 break-words text-sm">{r.prompt || "(بدون نص)"}</div>
            </div>
            <div className="text-end flex-shrink-0">
              <div className="text-lg font-black tabular-nums" style={{ color: "#fda4af" }}>
                {r.correctPct}%
              </div>
              <div className="text-[10px] text-white/50">
                {r.correct}/{r.answered} صحيح
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
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-300" />
          <h2 className="font-bold">الطلاب</h2>
          <span className="text-xs text-white/50">({students.length})</span>
        </div>
        <div className="text-[11px] text-white/50">اضغط على اسم طالب لعرض تفاصيله</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/60 text-xs">
            <tr>
              <th className="text-start p-2 px-3 sm:px-4">الطالب</th>
              <th className="text-start p-2">النوع</th>
              <th className="text-start p-2 tabular-nums">الإجابات</th>
              <th className="text-start p-2 tabular-nums">الصحيحة</th>
              <th className="text-start p-2 tabular-nums">النسبة</th>
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
                    aria-label={`عرض تفاصيل إجابات ${s.name}`}
                    className="text-start hover:text-emerald-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                  >
                    {s.name}
                  </button>
                </td>
                <td className="p-2">
                  {s.kind === "class" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300">
                      من الفصل
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300">
                      ضيف
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
                          ? { background: "rgba(52,211,153,0.15)", color: "#6ee7b7" }
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
    if (n < 60) return `${n} ث`;
    return `${Math.floor(n / 60)} د ${n % 60} ث`;
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white/50 mb-1">
            النشاط {index}{slideIndex >= 0 ? ` · شريحة ${slideIndex + 1}` : ""}
          </div>
          <div className="font-bold text-white/95 break-words">{prompt || "(بدون نص)"}</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg bg-white/5 px-3 py-1.5">
            <span className="text-white/60">إجابات:</span> <b>{answered}</b>
          </div>
          {correctPct != null && (
            <div className="rounded-lg bg-emerald-500/10 text-emerald-300 px-3 py-1.5">
              {correctPct}% صحيح ({correct}/{answered})
            </div>
          )}
        </div>
      </div>

      {/* Mini analytics — slim 3-tone progress + correct/wrong/skip + avg time */}
      <div className="px-4 pt-3">
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/5">
          {correctW > 0 && <div className="h-full bg-emerald-500/70" style={{ width: `${correctW}%` }} title="صحيح" />}
          {wrongW > 0 && <div className="h-full bg-rose-500/60" style={{ width: `${wrongW}%` }} title="خطأ" />}
          {skipW > 0 && <div className="h-full bg-white/15" style={{ width: `${skipW}%` }} title="لم يجب" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-white/55">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
            <span className="tabular-nums">{correct} صحيح</span>
          </span>
          {correctIndex != null && (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500/60 inline-block" />
              <span className="tabular-nums">{wrong} خطأ</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white/30 inline-block" />
            <span className="tabular-nums">{skipped} لم يجب</span>
          </span>
          <span className="inline-flex items-center gap-1 mr-auto">
            <Hourglass className="w-3 h-3" />
            <span className="tabular-nums">متوسط الزمن: {fmtSec(avgResponseSec)}</span>
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
                <th className="text-start p-2 px-4">الطالب</th>
                <th className="text-start p-2">الإجابة</th>
                <th className="text-start p-2">الحالة</th>
                <th className="text-start p-2 px-4">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => {
                const ans = r.answerText
                  ?? (r.answerIndex != null && options[r.answerIndex] != null ? options[r.answerIndex] : (r.answerIndex != null ? `#${r.answerIndex + 1}` : "—"));
                return (
                  <tr key={r.studentKey + r.createdAt} className="border-t border-white/5">
                    <td className="p-2 px-4 font-medium">{r.studentName}</td>
                    <td className="p-2 text-white/85 break-words max-w-xs">{ans}</td>
                    <td className="p-2">
                      {r.isCorrect === true ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> صحيح</span>
                      ) : r.isCorrect === false ? (
                        <span className="inline-flex items-center gap-1 text-rose-300"><XCircle className="w-4 h-4" /> خطأ</span>
                      ) : (
                        <span className="text-white/50">—</span>
                      )}
                    </td>
                    <td className="p-2 px-4 text-white/50 tabular-nums">
                      {new Date(r.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 text-center text-white/50 text-sm">لا توجد إجابات على هذا النشاط</div>
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
    const r = a.responses.find((x) => x.studentKey === studentKey) ?? null;
    const correctText =
      a.correctIndex != null && a.options[a.correctIndex] != null
        ? a.options[a.correctIndex]
        : null;
    let studentAnswer: string | null = null;
    if (r) {
      studentAnswer =
        r.answerText ??
        (r.answerIndex != null && a.options[r.answerIndex] != null
          ? a.options[r.answerIndex]
          : r.answerIndex != null
          ? `#${r.answerIndex + 1}`
          : null);
    }
    const answeredAt = r ? new Date(r.createdAt) : null;
    let responseSec: number | null = null;
    if (answeredAt && prevAnsweredAt) {
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

  const answered = rows.filter((r) => r.studentAnswer != null).length;
  const correct = rows.filter((r) => r.isCorrect === true).length;
  const total = rows.length;
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : null;
  const studentName = student?.name ?? "طالب";

  const handlePrint = () => {
    const esc = (s: string | null | undefined) =>
      String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
    const fmtResp = (n: number | null) =>
      n == null ? "—" : n < 60 ? `${n} ث` : `${Math.floor(n / 60)} د ${n % 60} ث`;
    const statusCell = (r: StudentActivityRow) => {
      if (r.studentAnswer == null) return '<span style="color:#94a3b8">لم يُجِب</span>';
      if (r.isCorrect === true) return '<span style="color:#047857;font-weight:bold">صحيح ✓</span>';
      if (r.isCorrect === false) return '<span style="color:#b91c1c;font-weight:bold">خطأ ✗</span>';
      return "—";
    };
    const rowsHtml = rows
      .map(
        (r, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${r.slideIndex >= 0 ? `شريحة ${r.slideIndex + 1}` : "—"}</td>
          <td class="prompt">${esc(r.prompt) || "(بدون نص)"}</td>
          <td>${r.studentAnswer == null ? '<span style="color:#94a3b8">—</span>' : esc(r.studentAnswer)}</td>
          <td>${esc(r.correctText) || '<span style="color:#94a3b8">—</span>'}</td>
          <td>${statusCell(r)}</td>
          <td class="num">${fmtTime(r.answeredAt)}</td>
          <td class="num">${fmtResp(r.responseSec)}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
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
<div class="noprint"><button onclick="window.print()">طباعة</button></div>
<h1>تفاصيل إجابات الطالب</h1>
<div class="meta"><b>الطالب:</b> ${esc(studentName)}</div>
<div class="meta"><b>العرض:</b> ${esc(deckTitle)} · <b>PIN:</b> ${esc(sessionPin)}</div>
<div class="summary">
  <div class="stat">المُجابة<b>${answered} / ${total}</b></div>
  <div class="stat">الصحيحة<b>${correct}</b></div>
  <div class="stat">النسبة<b>${pct != null ? pct + "%" : "—"}</b></div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>الشريحة</th><th>السؤال</th><th>إجابة الطالب</th>
      <th>الإجابة الصحيحة</th><th>الحالة</th><th>الوقت</th><th>زمن الاستجابة (تقديري)</th>
    </tr>
  </thead>
  <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#64748b">لا توجد أنشطة.</td></tr>'}</tbody>
</table>
<div class="footer">حصاد · ${new Date().toLocaleString("ar")}</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("فشل فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.");
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
      d ? d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const status = (r: StudentActivityRow) =>
      r.studentAnswer == null ? "لم يُجِب" : r.isCorrect === true ? "صحيح" : r.isCorrect === false ? "خطأ" : "";
    const headerLines = [
      `# الطالب: ${studentName}`,
      `# العرض: ${deckTitle}`,
      `# PIN: ${sessionPin}`,
      `# الصحيحة: ${correct} من ${answered} مُجابة (من أصل ${total})${pct != null ? ` · النسبة ${pct}%` : ""}`,
      "",
    ];
    const cols = ["#", "الشريحة", "السؤال", "إجابة الطالب", "الإجابة الصحيحة", "الحالة", "الوقت", "زمن الاستجابة (ث)"];
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
      dir="rtl"
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
              <ChevronRight className="w-4 h-4" /> العودة لنتائج الجلسة
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-white break-words">
              {student?.name ?? "طالب"}
            </h2>
            <div className="text-xs text-white/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {student?.kind === "class" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300">
                  من الفصل
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300">
                  ضيف
                </span>
              )}
              <span>·</span>
              <span className="tabular-nums">
                <b>{correct}</b> صحيح من <b>{answered}</b> مُجابة (من أصل {total})
              </span>
              {pct != null && (
                <>
                  <span>·</span>
                  <span
                    className="inline-block px-2 py-0.5 rounded font-black tabular-nums text-[11px]"
                    style={
                      pct >= 70
                        ? { background: "rgba(52,211,153,0.15)", color: "#6ee7b7" }
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
              aria-label="طباعة تفاصيل الطالب"
              title="طباعة"
              className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white inline-flex items-center gap-1 text-xs font-bold"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              aria-label="تنزيل تفاصيل الطالب بصيغة CSV"
              title="تنزيل CSV"
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
                aria-label="عرض موسّع في صفحة مستقلة"
                title="عرض موسّع"
                className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white inline-flex items-center gap-1 text-xs font-bold"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden sm:inline">عرض موسّع</span>
              </a>
            )}
            {student?.kind === "class" && student?.classStudentId != null ? (
              <a
                href={`/teacher/students/${student.classStudentId}/timeline`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="سجل تطور الطالب عبر العروض"
                title="سجل تطور الطالب"
                className="h-9 px-2.5 rounded-lg border inline-flex items-center gap-1 text-xs font-bold"
                style={{ background: "rgba(217,165,33,0.15)", borderColor: "rgba(217,165,33,0.4)", color: BRAND_GOLD }}
              >
                <LineChart className="w-4 h-4" />
                <span className="hidden sm:inline">📈 سجل تطور الطالب</span>
              </a>
            ) : student?.kind === "guest" ? (
              <span
                title="الضيوف بلا سجل دائم"
                className="h-9 px-2.5 rounded-lg bg-white/5 border border-white/10 text-white/40 inline-flex items-center gap-1 text-xs font-bold cursor-not-allowed"
              >
                <LineChart className="w-4 h-4" />
                <span className="hidden sm:inline">الضيوف بلا سجل دائم</span>
              </span>
            ) : null}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
              aria-label="إغلاق"
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
                <h3 className="text-sm font-bold text-white/90">رؤى عن الطالب</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Comparison bars */}
                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                  <div className="text-[11px] text-white/55 font-bold mb-2">مقارنة بمتوسط الفصل</div>
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
                            <span className="text-white/70">متوسط الفصل</span>
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
                                <span>نقطة فوق المتوسط</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3 text-rose-300" />
                                <span className="text-rose-300/90 tabular-nums font-bold">{gap}</span>
                                <span>نقطة تحت المتوسط</span>
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
                      <CheckCircle2 className="w-3 h-3" /> نقاط القوة
                      <span className="text-white/40 font-normal">· إجابات سريعة وصحيحة</span>
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
                        return <div className="text-[11px] text-white/45">لا توجد إجابات صحيحة بعد</div>;
                      }
                      return (
                        <ul className="space-y-1">
                          {strengths.map((r) => (
                            <li key={r.elementId} className="text-[12px] text-white/85 flex items-center gap-2" title={r.prompt}>
                              <span className="truncate flex-1">· {r.prompt || "(بدون نص)"}</span>
                              {r.responseSec != null && (
                                <span className="tabular-nums text-emerald-300/80 text-[10px] flex-shrink-0">
                                  {r.responseSec < 60 ? `${r.responseSec}ث` : `${Math.floor(r.responseSec / 60)}د`}
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
                      <XCircle className="w-3 h-3" /> نقاط للتحسين
                      <span className="text-white/40 font-normal">· الأبطأ أولاً</span>
                    </div>
                    {(() => {
                      const weak = rows
                        .filter((r) => r.isCorrect === false)
                        .slice()
                        .sort((a, b) => (b.responseSec ?? 0) - (a.responseSec ?? 0))
                        .slice(0, 3);
                      if (weak.length === 0) {
                        return <div className="text-[11px] text-white/45">لا توجد إجابات خاطئة 🌱</div>;
                      }
                      return (
                        <ul className="space-y-1">
                          {weak.map((r) => (
                            <li key={r.elementId} className="text-[12px] text-white/85 flex items-center gap-2" title={r.prompt}>
                              <span className="truncate flex-1">· {r.prompt || "(بدون نص)"}</span>
                              {r.responseSec != null && (
                                <span className="tabular-nums text-rose-300/80 text-[10px] flex-shrink-0">
                                  {r.responseSec < 60 ? `${r.responseSec}ث` : `${Math.floor(r.responseSec / 60)}د`}
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
            <div className="p-10 text-center text-white/60 text-sm">لا توجد أنشطة في هذا العرض.</div>
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
                        {r.slideIndex >= 0 ? `شريحة ${r.slideIndex + 1}` : "نشاط محذوف"}
                      </div>
                      <div className="font-bold text-white/95 break-words text-sm">
                        {r.prompt || "(بدون نص)"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                        <div className="text-white/50 mb-1">إجابة الطالب</div>
                        {r.studentAnswer == null ? (
                          <div className="inline-flex items-center gap-1 text-white/50">
                            <MinusCircle className="w-4 h-4" /> لم يُجِب
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
                        <div className="text-white/50 mb-1">الإجابة الصحيحة</div>
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
                        <span className="tabular-nums" title="محسوب من الفارق الزمني عن الإجابة السابقة">
                          زمن الاستجابة (تقديري): {r.responseSec < 60 ? `${r.responseSec} ث` : `${Math.floor(r.responseSec / 60)} د ${r.responseSec % 60} ث`}
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
            العودة لنتائج الجلسة
          </Button>
        </div>
      </div>
    </div>
  );
}
