/**
 * تقرير نتائج التصحيح الورقي لورقة عمل — /teacher/worksheets/:id/report
 * المالك فقط. يُحسب بالكامل من نتائج التصحيح المحفوظة (لا استدعاء AI).
 * يركّز على ما يفيد المعلم فعلاً: مستوى الصف، من يحتاج متابعة، وأصعب الأسئلة.
 */
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowRight, Loader2, XCircle, CheckCircle2, User, Users,
  TrendingUp, TrendingDown, AlertTriangle, X, Printer, UserPen,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

type ReportData = {
  worksheetId: number;
  worksheetTitle: string;
  summary: {
    studentCount: number;
    gradedPapersCount?: number;
    avgPercent: number | null;
    maxPercent: number | null;
    minPercent: number | null;
    passRate: number | null;
    totalPoints: number;
  };
  questions: Array<{
    questionId: number;
    order: number;
    text: string;
    points: number;
    correctCount: number;
    wrongCount: number;
    answeredCount: number;
    correctPercent: number | null;
  }>;
  students: Array<{
    submissionId: number;
    studentName: string;
    studentClass: string | null;
    registered: boolean;
    earnedPoints: number;
    totalPoints: number;
    percent: number;
    attempts: number;
    submittedAt: string;
  }>;
};

// شكل استجابة /api/submissions/:id/details الفعلي: { submission, answers }
type SubmissionDetails = {
  submission: {
    id: number;
    studentName: string;
    earnedPoints: number | null;
    totalPoints: number | null;
    teacherAdjustedPoints: number | null;
    aiFeedback: string | null;
  };
  answers: Array<{
    questionText: string;
    points: number;
    selectedAnswer: string | null;
    correctAnswer?: string | null;
    isCorrect: boolean;
    teacherPoints: number | null;
  }>;
};

export default function WorksheetReport() {
  const [, params] = useRoute("/teacher/worksheets/:id/report");
  const [, setLocation] = useLocation();
  const worksheetId = params?.id;

  const [data, setData] = useState<ReportData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [details, setDetails] = useState<SubmissionDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // تصحيح اسم ورقة «غير معروف» وربطها بطالب من قائمة المعلم
  const [fixTarget, setFixTarget] = useState<{ submissionId: number } | null>(null);
  const [fixName, setFixName] = useState("");
  const [fixClass, setFixClass] = useState("");
  const [fixSaving, setFixSaving] = useState(false);
  const [roster, setRoster] = useState<Array<{ id: number; name: string; studentClass: string | null }> | null>(null);

  const loadReport = async (silent = false) => {
    if (!worksheetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/worksheets/${worksheetId}/report`, { credentials: "include" });
      if (res.status === 401) {
        setLocation(`/login?returnTo=${encodeURIComponent(`/teacher/worksheets/${worksheetId}/report`)}`);
        return;
      }
      if (res.status === 403) { setLoadState("forbidden"); return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
      setLoadState("ready");
    } catch {
      toast.error("تعذّر تحميل التقرير");
      if (!silent) setLoadState("error");
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetId]);

  const openFixName = (submissionId: number) => {
    setFixTarget({ submissionId });
    setFixName("");
    setFixClass("");
    if (roster === null) {
      fetch(`${API_BASE}/api/students`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setRoster(Array.isArray(list) ? list : []))
        .catch(() => setRoster([]));
    }
  };

  const saveFixName = async () => {
    if (!fixTarget) return;
    const name = fixName.trim();
    if (name.length < 2) { toast.error("اكتب اسم الطالب (حرفان على الأقل)"); return; }
    setFixSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/${fixTarget.submissionId}/student-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentName: name,
          ...(fixClass.trim() ? { studentClass: fixClass.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message || "تعذّر تحديث الاسم");
        return;
      }
      const updated = await res.json();
      toast.success(
        updated.matchedStudentId
          ? `تم ربط الورقة بالطالب «${updated.studentName}»`
          : `تم تحديث الاسم إلى «${updated.studentName}»`,
      );
      setFixTarget(null);
      // يعاد تحميل التقرير فتندمج المحاولات المكررة تلقائياً
      await loadReport(true);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setFixSaving(false);
    }
  };

  const openDetails = async (submissionId: number) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/${submissionId}/details`, { credentials: "include" });
      if (!res.ok) { toast.error("تعذّر تحميل تفاصيل الورقة"); return; }
      setDetails(await res.json());
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loadState === "loading") {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (loadState !== "ready" || !data) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <XCircle className="w-12 h-12 text-rose-500" />
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
          {loadState === "forbidden" ? "هذا التقرير خاص بمالك ورقة العمل فقط" : "تعذّر تحميل التقرير"}
        </p>
        <button
          onClick={() => setLocation("/teacher/worksheets/create")}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
        >
          الذهاب لأوراق العمل
        </button>
      </div>
    );
  }

  const { summary, students } = data;
  // ترتيب الأسئلة من الأصعب (أقل نسبة صحيح) إلى الأسهل
  const sortedQuestions = [...data.questions].sort(
    (a, b) => (a.correctPercent ?? 101) - (b.correctPercent ?? 101),
  );
  const hardQuestions = sortedQuestions.filter((q) => q.correctPercent !== null && q.correctPercent < 50);
  const needFollowUp = students.filter((s) => s.percent < 50);

  const fmtPct = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 print:bg-white">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 print:hidden">
        <button
          onClick={() => setLocation(`/teacher/worksheets/${data.worksheetId}/grade`)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="رجوع للتصحيح"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-extrabold text-slate-800 dark:text-slate-100 truncate">تقرير نتائج التصحيح</h1>
          <p className="text-xs text-slate-500 truncate">{data.worksheetTitle}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          aria-label="طباعة التقرير"
        >
          <Printer className="w-5 h-5" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        {summary.studentCount === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-600 dark:text-slate-300">لم تُصحَّح أي ورقة بعد</p>
            <button
              onClick={() => setLocation(`/teacher/worksheets/${data.worksheetId}/grade`)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
            >
              الذهاب للتصحيح
            </button>
          </div>
        ) : (
          <>
            {/* الملخص */}
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="col-span-2 sm:col-span-1 bg-emerald-600 text-white rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold"><Users className="w-4 h-4" /> الطلاب المصححون</div>
                <p className="text-3xl font-extrabold mt-1">{summary.studentCount}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs font-bold text-slate-500">متوسط الدرجات</p>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{fmtPct(summary.avgPercent)}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-xs font-bold text-slate-500">نسبة النجاح (٥٠٪+)</p>
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">{fmtPct(summary.passRate)}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> أعلى درجة</div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{fmtPct(summary.maxPercent)}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> أقل درجة</div>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{fmtPct(summary.minPercent)}</p>
              </div>
            </section>

            {/* الأسئلة الأصعب */}
            {hardQuestions.length > 0 && (
              <section className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 p-4 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  {hardQuestions.length === 1 ? "سؤال واجه فيه الطلاب صعوبة" : "أسئلة واجه فيها الطلاب صعوبة"}
                </div>
                <ul className="space-y-1.5">
                  {hardQuestions.map((q) => (
                    <li key={q.questionId} className="text-sm text-amber-900 dark:text-amber-200">
                      <span className="font-bold">س{q.order}:</span> {q.text}
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400"> — أخطأ فيه {q.wrongCount} من {q.answeredCount} ({100 - (q.correctPercent ?? 0)}٪)</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-400">قد تحتاج هذه النقاط إلى إعادة شرح للصف.</p>
              </section>
            )}

            {/* تحليل الأسئلة — من الأصعب للأسهل */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100">تحليل الأسئلة <span className="text-xs font-bold text-slate-400">(من الأصعب إلى الأسهل)</span></h2>
              <ul className="space-y-3">
                {sortedQuestions.map((q) => {
                  const pctVal = q.correctPercent;
                  const hard = pctVal !== null && pctVal < 50;
                  return (
                    <li key={q.questionId} className="space-y-1">
                      <div className="flex items-start justify-between gap-2 text-sm">
                        <p className="min-w-0 text-slate-700 dark:text-slate-200">
                          <span className="font-bold">س{q.order}:</span> {q.text}
                        </p>
                        <span className={`shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                          hard
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        }`}>
                          {pctVal === null ? "—" : `${pctVal}٪ صحيح`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${hard ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${pctVal ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        أجاب صحيحاً {q.correctCount} • أخطأ {q.wrongCount}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* من يحتاج متابعة */}
            {needFollowUp.length > 0 && (
              <section className="bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 p-4">
                <p className="font-extrabold text-rose-800 dark:text-rose-300 text-sm mb-1.5">
                  {needFollowUp.length === 1 ? "طالب واحد يحتاج متابعة (تحت ٥٠٪)" : `${needFollowUp.length} طلاب يحتاجون متابعة (تحت ٥٠٪)`}
                </p>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {needFollowUp.map((s) => s.studentName).join("، ")}
                </p>
              </section>
            )}

            {/* قائمة الطلاب */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 mb-2">الطلاب والدرجات</h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((s) => {
                  const isUnknown = s.studentName === "غير معروف";
                  return (
                    <li key={s.submissionId}>
                      <div className="w-full py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg px-1.5 -mx-1.5">
                        <button onClick={() => openDetails(s.submissionId)} className="min-w-0 flex-1 text-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{s.studentName}</p>
                            {!s.registered && !isUnknown && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">غير مسجل</span>
                            )}
                            {s.attempts > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">{s.attempts} محاولات — الأحدث</span>
                            )}
                          </div>
                          {s.studentClass && <p className="text-xs text-slate-500">{s.studentClass}</p>}
                        </button>
                        {isUnknown && (
                          <button
                            onClick={() => openFixName(s.submissionId)}
                            className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950 print:hidden"
                          >
                            <UserPen className="w-3.5 h-3.5" />
                            تصحيح الاسم
                          </button>
                        )}
                        <button onClick={() => openDetails(s.submissionId)} className="shrink-0 text-end">
                          <p className={`font-extrabold text-sm ${s.percent < 50 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {s.earnedPoints} / {s.totalPoints}
                          </p>
                          <p className="text-[11px] text-slate-500">{Math.round(s.percent)}٪</p>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>

      {/* نافذة تصحيح اسم ورقة «غير معروف» */}
      {fixTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden"
          onClick={() => { if (!fixSaving) setFixTarget(null); }}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-extrabold text-slate-800 dark:text-slate-100">
                <UserPen className="w-4 h-4 text-amber-600" />
                تصحيح اسم الطالب
              </div>
              <button
                onClick={() => { if (!fixSaving) setFixTarget(null); }}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              اكتب اسم الطالب أو اختره من قائمتك — سيُربط تلقائياً بسجل الطالب إن وُجد وتُحدَّث الإحصاءات فوراً.
            </p>
            <div className="space-y-2">
              <input
                value={fixName}
                onChange={(e) => setFixName(e.target.value)}
                list="fix-name-roster"
                placeholder="اسم الطالب"
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="fix-name-roster">
                {(roster ?? []).map((st) => (
                  <option key={st.id} value={st.name}>{st.studentClass ?? ""}</option>
                ))}
              </datalist>
              <input
                value={fixClass}
                onChange={(e) => setFixClass(e.target.value)}
                placeholder="الصف (اختياري)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {roster && roster.length > 0 && (
              <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
                {roster
                  .filter((st) => !fixName.trim() || st.name.includes(fixName.trim()))
                  .slice(0, 30)
                  .map((st) => (
                    <button
                      key={st.id}
                      onClick={() => { setFixName(st.name); if (st.studentClass) setFixClass(st.studentClass); }}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        fixName.trim() === st.name
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
                      }`}
                    >
                      {st.name}
                    </button>
                  ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveFixName}
                disabled={fixSaving || fixName.trim().length < 2}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {fixSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                حفظ وربط
              </button>
              <button
                onClick={() => { if (!fixSaving) setFixTarget(null); }}
                disabled={fixSaving}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل تصحيح طالب */}
      {(details || loadingDetails) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden"
          onClick={() => { if (!loadingDetails) setDetails(null); }}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
          >
            {loadingDetails || !details ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 truncate">{details.submission.studentName}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      {details.submission.teacherAdjustedPoints ?? details.submission.earnedPoints ?? 0} / {details.submission.totalPoints ?? 0}
                    </span>
                    <button onClick={() => setDetails(null)} aria-label="إغلاق" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {details.submission.aiFeedback && (
                  <p className="text-sm text-slate-700 dark:text-slate-300">{details.submission.aiFeedback}</p>
                )}
                {Array.isArray(details.answers) && details.answers.length > 0 && (
                  <ul className="space-y-1.5">
                    {details.answers.map((a, i) => {
                      // مراجعة المعلم اليدوية (إن وُجدت) تتقدم على حكم التصحيح الآلي
                      const effCorrect = a.teacherPoints != null ? a.teacherPoints > 0 : a.isCorrect;
                      return (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                          {effCorrect
                            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                            : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                          <span className="min-w-0">
                            <span className="font-semibold">س{i + 1}:</span> {a.questionText}
                            <span className="block text-xs text-slate-500">
                              إجابته: {a.selectedAnswer || "—"}
                              {!effCorrect && a.correctAnswer ? ` • الصحيحة: ${a.correctAnswer}` : ""}
                              {a.teacherPoints != null ? ` • درجة المعلم: ${a.teacherPoints}/${a.points}` : ""}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
