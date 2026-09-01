import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, Swords, ArrowRight, Link2, Users, ListChecks, Monitor, Smartphone, CircleCheck,
  Check, X, Loader2, FileText, BookOpen,
  GraduationCap, Trash2, Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { toast } from "@/components/ui/sonner";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { saveGameActivity } from "@/lib/saved-game-activities";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BLUE = "#3b5bdb";
const INDIGO = "#4c6ef5";

interface TugQuestion {
  text: string;
  options: string[];
  correct: number;
  imageUrl?: string | null;
}

interface BankQuestion {
  id: number;
  subject: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
  tags: string | null;
  imageUrl?: string | null;
}

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToTug = (bq: BankQuestion): TugQuestion => ({
  text: bq.text,
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
  imageUrl: bq.imageUrl || null,
});

const savedSettings = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export default function TugCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<TugQuestion[]>([]);
  const [duration, setDuration] = useState(20);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [creating, setCreating] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedSource, setSelectedSource] = useState<"bank" | "assignment" | null>(null);
  const [setupStep, setSetupStep] = useState<"questions" | "settings">("questions");
  const [readyOpen, setReadyOpen] = useState(false);
  // Activity title carried into Class Mode's top banner (assignment title when known).
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  // Bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  // Assignments
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<{ id: number; title: string; subject: string; questionCount: number; isOwn?: boolean; ownerName?: string | null }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignImporting, setAssignImporting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-load from presentation deep-link
  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get("assignmentId");
    if (!aid) return;
    const parsedId = parseInt(aid, 10);
    if (Number.isNaN(parsedId)) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/assignments/${parsedId}`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        type RawQ = { questionType?: string; text?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string; imageUrl?: string | null };
        const qs = ((data.questions || []) as RawQ[])
          .filter(q => q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map(q => bankToTug({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null, imageUrl: q.imageUrl || null,
          } as BankQuestion))
          .slice(0, 20);
        if (qs.length > 0) {
          setQuestions(qs);
          if (typeof data.title === "string" && data.title.trim()) setSourceTitle(data.title.trim());
          setSetupStep("settings");
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من العرض!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistActivity = () => saveGameActivity({
    gameType: "tug",
    title: sourceTitle?.trim() || (ar ? "شد الحبل" : "Tug of War"),
    questions,
    settings: { duration, autoAdvance, targetClass: targetClass || null },
    source: "game-launch",
  });

  const handleCreate = async () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف أسئلة أولاً (من بنك الأسئلة أو من واجب)" : "Add questions first");
      return;
    }
    setCreating(true);
    try {
      await persistActivity();
    } catch {
      setCreating(false);
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
    const socket = getTugSocket();
    socket.emit("tug:create", { questions, duration, autoAdvance, targetClass: targetClass || undefined },
      (res: { pin?: string; creatorToken?: string; error?: string }) => {
        setCreating(false);
        if (res.error) { toast.error(res.error); return; }
        if (res.pin && res.creatorToken) {
          sessionStorage.setItem(`tug-creator-${res.pin}`, res.creatorToken);
          setLocation(`/game/tug/play/${res.pin}?creator=1`);
        }
      });
  };

  const startClassMode = async () => {
    if (questions.length < 2) {
      toast.error(ar ? "وضع السبورة يحتاج سؤالين على الأقل" : "Board mode needs at least 2 questions");
      return;
    }
    try {
      const activity = await persistActivity();
      sessionStorage.setItem("tug-class-setup", JSON.stringify({
        questions,
        duration,
        title: sourceTitle || undefined,
        savedActivityId: activity.id,
      }));
    } catch {
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
    setLocation("/game/tug/class");
  };

  // Bank
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) { toast.error(ar ? "يجب تسجيل الدخول أولاً" : "Please log in first"); setBankOpen(false); return; }
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data.filter((q: BankQuestion) => q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer));
      }
    } catch { /* ignore */ } finally { setBankLoading(false); }
  }, [ar]);

  useEffect(() => {
    if (bankOpen) { loadBank(); setBankSelected(new Set()); setBankSearch(""); }
  }, [bankOpen, loadBank]);

  const importBankSelected = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    if (selected.length === 0) return;
    const merged = [...questions, ...selected.map(bankToTug)].slice(0, 20);
    setQuestions(merged);
    setQuestionCount(merged.length);
    setSelectedSource("bank");
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${selected.length} سؤال!` : `Imported ${selected.length} questions!`);
  };

  // Assignments
  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!meRes.ok) { toast.error(ar ? "يجب تسجيل الدخول أولاً" : "Please log in first"); setAssignOpen(false); return; }
      const me = await meRes.json();
      const teacherId = me.teacherId || me.id;
      const res = await fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}&include=shared`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.filter((a: { questionCount: number }) => a.questionCount > 0));
      }
    } catch { /* ignore */ } finally { setAssignLoading(false); }
  }, [ar]);


  useEffect(() => {
    if (assignOpen) { loadAssignments(); }
  }, [assignOpen, loadAssignments]);

  const importAllFromAssignment = async (assignmentId: number, assignmentTitle: string) => {
    setAssignImporting(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const qs = (data.questions || [])
        .filter((q: { questionType?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string }) =>
          q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)
        .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; points: number; imageUrl?: string | null }) => bankToTug({
          id: q.id, subject: data.subject || "", text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: q.points || 1, tags: null, imageUrl: q.imageUrl || null,
        } as BankQuestion));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار متعدد في هذا الواجب" : "No MCQ questions found"); return; }
      const sliced = qs.slice(0, 20);
      setQuestions(sliced);
      setQuestionCount(sliced.length);
      setSelectedSource("assignment");
      setSourceTitle(assignmentTitle);
      setAssignOpen(false);
      toast.success(ar ? `تم استيراد ${qs.length} سؤال من "${assignmentTitle}"` : `Imported ${qs.length} questions from "${assignmentTitle}"`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.includes(bankSearch) || q.subject.includes(bankSearch) || (q.tags && q.tags.includes(bankSearch)))
    : bankQuestions;

  const groupedBank = filteredBank.reduce<Record<string, BankQuestion[]>>((acc, q) => {
    const key = q.subject || (ar ? "بدون مادة" : "No subject");
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const optionLetters = ["أ", "ب", "ج", "د"];

  if (setupStep === "questions") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#faf8f0] px-4 py-8 sm:px-6 sm:py-10" dir={dir}>
          <UnifiedQuestionSourceFlow
            gameTitle={ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
            gameDescription={ar ? "حضّر الأسئلة أولاً، ثم اضبط المنافسة وابدأ اللعب." : "Prepare questions, configure the competition, then start."}
            gameIcon={<Link2 className="h-8 w-8 text-[#0B4B35]" />}
            accentColor="#0B4B35"
            tugPresentation
            header={
              <div className="rounded-3xl border border-[#0B4B35]/10 bg-white px-4 py-4 shadow-sm sm:px-6" dir={dir}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B4B35] text-white shadow-sm">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-[#0B4B35] sm:text-xl">{ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}</h1>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{ar ? "حضّر المنافسة في ثلاث خطوات قصيرة" : "Prepare the match in three quick steps"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#FAF8F0] px-3 py-2" style={{ direction: "ltr" }}>
                    <span className="flex items-center gap-1.5 text-xs font-black text-red-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-red-500" />{ar ? "الأحمر" : "Red"}</span>
                    <Link2 className="h-4 w-4 text-[#D9AA25]" />
                    <span className="flex items-center gap-1.5 text-xs font-black text-blue-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-blue-500" />{ar ? "الأزرق" : "Blue"}</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-[#FAF8F0] p-1">
                  {[
                    { label: ar ? "الأسئلة" : "Questions", active: true },
                    { label: ar ? "إعدادات اللعبة" : "Settings", active: false },
                    { label: ar ? "الاستعداد والبدء" : "Ready", active: false },
                  ].map((step) => (
                    <div key={step.label} className={`flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-bold sm:text-xs ${step.active ? "bg-[#0B4B35] text-white shadow-sm" : "text-slate-400"}`}>
                      {step.active && <CircleCheck className="h-3.5 w-3.5 shrink-0" />}{step.label}
                    </div>
                  ))}
                </div>
              </div>
            }
            minQuestions={2}
            maxQuestions={20}
            onComplete={({ questions: prepared, sourceTitle: title, source, savedActivity }) => {
              setQuestions(prepared);
              setQuestionCount(prepared.length);
              setSourceTitle(title);
              setSelectedSource(source === "bank" ? "bank" : "assignment");
              if (source === "saved" && savedActivity?.gameType === "tug") {
                const settings = savedSettings(savedActivity.settings);
                if (settings) {
                  if ([10, 15, 20, 30].includes(settings.duration as number)) {
                    setDuration(settings.duration as number);
                  }
                  if (typeof settings.autoAdvance === "boolean") setAutoAdvance(settings.autoAdvance);
                  if (typeof settings.targetClass === "string") setTargetClass(settings.targetClass);
                }
              }
              setSetupStep("settings");
            }}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
        <div className="min-h-screen bg-[#FAF8F0]" dir={dir}>
          <div className="mx-auto max-w-3xl px-4 pb-2 pt-5 sm:px-6">
            <div className="rounded-3xl border border-[#0B4B35]/10 bg-white px-4 py-4 shadow-sm sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B4B35] text-white">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-black text-[#0B4B35] sm:text-xl">{ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}</h1>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">{ar ? "اضبط المنافسة ثم انتقل لبدء اللعب" : "Set the match, then get ready to start"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#FAF8F0] px-3 py-2" style={{ direction: "ltr" }}>
                  <span className="flex items-center gap-1.5 text-xs font-black text-red-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-red-500" />{ar ? "الأحمر" : "Red"}</span>
                  <Link2 className="h-4 w-4 text-[#D9AA25]" />
                  <span className="flex items-center gap-1.5 text-xs font-black text-blue-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-blue-500" />{ar ? "الأزرق" : "Blue"}</span>
                </div>
              </div>
            </div>
          </div>
        {/* ══════════════════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════════════════ */}
          <div className="mx-auto max-w-3xl px-4 py-5 pb-8 sm:px-6">
          <div className="mb-6 flex justify-center">
              <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-[#0B4B35]/10 bg-white p-1 shadow-sm">
                <span className="flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-bold text-[#0B4B35] sm:text-xs"><CircleCheck className="h-3.5 w-3.5" />{ar ? "الأسئلة" : "Questions"}</span>
                <span className="rounded-xl bg-[#0B4B35] px-2 py-2 text-center text-[11px] font-black text-white shadow-sm sm:text-xs">{ar ? "إعدادات اللعبة" : "Settings"}</span>
                <span className="rounded-xl px-2 py-2 text-center text-[11px] font-bold text-slate-400 sm:text-xs">{ar ? "الاستعداد والبدء" : "Ready"}</span>
            </div>
          </div>

          {/* Two-column grid.
              In RTL: first child → physical RIGHT (Settings), second → physical LEFT (Source).
              This matches the reference image layout. */}
          <div className="grid grid-cols-1 gap-5 mb-5 max-w-3xl mx-auto">

            {/* ── SETTINGS CARD — first child (RIGHT in RTL) ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="bg-white rounded-3xl p-6 sm:p-7"
              style={{ border: "1.5px solid #e5eee9", boxShadow: "0 2px 14px rgba(0,0,0,0.06)" }}>

              <h2 className="text-base font-black text-gray-800 mb-5">
                {ar ? "إعدادات اللعبة" : "Game Settings"}
              </h2>

              {/* Duration row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">{ar ? "وقت السؤال" : "Time per question"}</span>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 ms-3">
                  {[10, 15, 20, 30].map(s => (
                    <button key={s} onClick={() => setDuration(s)}
                      className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                      style={{
                        background: duration === s ? "#16a34a" : "transparent",
                        color: duration === s ? "#fff" : "#6b7280",
                      }}>
                      {s}{ar ? "ث" : "s"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto advance row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex-1 min-w-0 me-4">
                  <p className="text-sm font-bold text-gray-700">
                    {ar ? "التقدم التلقائي بعد كل سؤال" : "Auto-advance after each question"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ar ? "الانتقال تلقائياً للسؤال التالي بعد الإجابة" : "Move to next question automatically"}
                  </p>
                </div>
                <button onClick={() => setAutoAdvance(!autoAdvance)}
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                  style={{ background: autoAdvance ? "#16a34a" : "#d1d5db" }}>
                  <motion.div
                    animate={{ x: autoAdvance ? (dir === "rtl" ? -19 : 19) : 2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                    style={{ [dir === "rtl" ? "right" : "left"]: 2 }}
                  />
                </button>
              </div>

              {/* Question count row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">{ar ? "عدد الأسئلة" : "Question count"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuestionCount(c => Math.max(1, c - 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-gray-600 transition-colors hover:bg-gray-100"
                    style={{ border: "1.5px solid #d1d5db" }}>
                    −
                  </button>
                  <span className="w-9 text-center text-lg font-black text-gray-900 tabular-nums">{questionCount}</span>
                  <button onClick={() => setQuestionCount(c => Math.min(20, c + 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-gray-600 transition-colors hover:bg-gray-100"
                    style={{ border: "1.5px solid #d1d5db" }}>
                    +
                  </button>
                </div>
              </div>

              {/* Target class — only when grades exist */}
              {gradeLevels.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-700">{ar ? "الصف المستهدف" : "Target class"}</span>
                  </div>
                  <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none ms-3"
                    style={{ minWidth: 130 }}>
                    <option value="">{ar ? "— جميع الصفوف —" : "— All —"}</option>
                    {gradeLevels.map(g => (
                      <option key={g.gradeLevel} value={g.gradeLevel}>
                        {g.gradeLevel} ({g.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-3xl bg-white p-4 sm:p-5"
              style={{ border: "1.5px solid #e5eee9", boxShadow: "0 2px 14px rgba(0,0,0,0.05)" }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-[#225739]">
                    {questions.length}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-800">{ar ? "الأسئلة جاهزة للإعداد" : "Questions ready for setup"}</p>
                    <p className="truncate text-xs text-gray-500">{sourceTitle || (ar ? "مجموعة أسئلة مختارة" : "Prepared question set")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSetupStep("questions")}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#225739]/25 px-4 text-sm font-bold text-[#225739] transition-colors hover:bg-emerald-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  {ar ? "تغيير المصدر" : "Change source"}
                </button>
              </div>
            </motion.div>

            {/* ── SOURCE CARD — second child (LEFT in RTL) ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="hidden bg-white rounded-3xl p-6 sm:p-7 flex flex-col"
              style={{ border: "1.5px solid #e5eee9", boxShadow: "0 2px 14px rgba(0,0,0,0.06)" }}>

              <h2 className="text-base font-black text-gray-800 mb-4">
                {ar ? "اختر مصدر الأسئلة" : "Question Source"}
              </h2>

              {/* Assignment source card */}
              <button onClick={() => setAssignOpen(true)}
                className="w-full flex items-center gap-4 p-4 rounded-[18px] mb-3 border-2 text-start transition-all hover:shadow-md active:scale-[0.98]"
                style={{
                  background: selectedSource === "assignment" ? "#fffbeb" : "#fffdf7",
                  borderColor: selectedSource === "assignment" ? "#f59e0b" : "#fde8b4",
                  minHeight: 110,
                }}>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                  <FileText className="w-7 h-7" style={{ color: "#d97706" }} />
                  {selectedSource === "assignment" && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-amber-500">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-800">{ar ? "من واجب" : "From Assignment"}</p>
                  <p className="text-xs text-gray-400 mt-1">{ar ? "الأسئلة من الواجبات" : "Questions from assignments"}</p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: selectedSource === "assignment" ? "#f59e0b" : "#d1d5db" }}>
                  {selectedSource === "assignment" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  )}
                </div>
              </button>

              {/* Bank source card */}
              <button onClick={() => setBankOpen(true)}
                className="w-full flex items-center gap-4 p-4 rounded-[18px] mb-4 border-2 text-start transition-all hover:shadow-md active:scale-[0.98]"
                style={{
                  background: selectedSource === "bank" ? "#eff6ff" : "#f8fbff",
                  borderColor: selectedSource === "bank" ? "#3b82f6" : "#bfdbfe",
                  minHeight: 110,
                }}>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #dbeafe, #bfdbfe)" }}>
                  <BookOpen className="w-7 h-7" style={{ color: "#2563eb" }} />
                  {selectedSource === "bank" && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-blue-600">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-800">{ar ? "بنك الأسئلة" : "Question Bank"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {bankQuestions.length > 0
                      ? `${bankQuestions.length} ${ar ? "سؤال متاح" : "available"}`
                      : (ar ? "الأسئلة من بنك الأسئلة" : "Questions from the bank")}
                  </p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: selectedSource === "bank" ? "#3b82f6" : "#d1d5db" }}>
                  {selectedSource === "bank" && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
              </button>

              {/* Questions loaded strip */}
              <AnimatePresence>
                {questions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-auto">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                      style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: "#16a34a" }}>
                        {questions.length}
                      </div>
                      <p className="text-sm font-bold text-green-700 flex-1">
                        {ar ? `${questions.length} سؤال محمّل جاهز للانطلاق!` : `${questions.length} questions ready!`}
                      </p>
                      <button
                        onClick={() => { setQuestions([]); setSelectedSource(null); setSourceTitle(null); setQuestionCount(10); }}
                        className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-red-400 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {questions.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-auto pt-2">
                  {ar ? "اختر مصدر الأسئلة أولاً لتفعيل الزر" : "Pick a source first"}
                </p>
              )}
            </motion.div>
          </div>

          {/* ── Ready checkpoint — launch is still deferred to the next action. ── */}
          <div className="flex justify-center mb-5">
            <motion.button
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setReadyOpen(true)}
              disabled={creating || questions.length === 0}
              className="flex items-center justify-center gap-3 font-black text-lg text-white transition-all"
              style={{
                width: "min(820px, 100%)",
                height: 64,
                borderRadius: 18,
                background: questions.length > 0
                  ? "#0B4B35"
                  : "#d1d5db",
                boxShadow: questions.length > 0 ? "0 6px 20px rgba(11,75,53,0.2)" : "none",
                cursor: questions.length > 0 ? "pointer" : "not-allowed",
              }}
            >
              {creating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {ar ? "جاري الإنشاء..." : "Creating..."}</>
              ) : (
                <>
                  <Play className="w-5 h-5" fill="currentColor" />
                  {ar
                    ? questions.length > 0 ? "إلى الاستعداد والبدء" : "أضف أسئلة أولاً"
                    : questions.length > 0 ? "Continue to ready" : "Add questions first"}
                </>
              )}
            </motion.button>
          </div>

          {/* ── BOTTOM INFO STRIP ── */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: <Users className="h-4 w-4" />, text: ar ? "تتحدد الفرق عند الدخول" : "Teams are set when players join" },
              { icon: <Swords className="h-4 w-4" />, text: ar ? "يفوز من يصل للنهاية أولاً" : "First team to finish wins" },
              { icon: <Link2 className="h-4 w-4" />, text: ar ? "يُنشأ الرابط بعد البدء" : "A share link is created when you start" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                style={{
                  background: "#ffffff",
                  border: "1.5px solid #e5eee9",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                <span className="text-[#0B4B35]">{item.icon}</span>
                <span className="text-xs font-medium text-gray-500">{item.text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      <Dialog open={readyOpen} onOpenChange={setReadyOpen}>
        <DialogContent className="max-w-xl overflow-hidden rounded-3xl border-0 p-0" dir={dir}>
          <DialogTitle className="sr-only">{ar ? "طريقة اللعب" : "How to play"}</DialogTitle>
          <DialogDescription className="sr-only">{ar ? "اختر طريقة بدء منافسة شد الحبل." : "Choose how to start the tug-of-war match."}</DialogDescription>
          <div className="bg-[#0B4B35] px-6 py-6 text-white">
            <h2 className="text-2xl font-black">{ar ? "طريقة اللعب" : "How to play"}</h2>
            <p className="mt-1 text-sm font-medium text-white/75">{ar ? "اختر طريقة بدء المنافسة." : "Choose how to start the match."}</p>
          </div>

          <div className="bg-[#FAF8F0] p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startClassMode}
                disabled={creating}
                className="flex min-h-[7.25rem] flex-col items-start justify-center gap-2 rounded-2xl bg-[#0B4B35] px-5 text-start text-white shadow-sm transition-colors hover:bg-[#083d2c] disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-base font-black">
                  <Monitor className="h-5 w-5" />
                  {ar ? "على السبورة" : "On the board"}
                </span>
                <span className="text-xs font-medium text-white/75">
                  {ar ? "فريقان يتنافسان على السبورة نفسها" : "Two teams compete on the same board"}
                </span>
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex min-h-[7.25rem] flex-col items-start justify-center gap-2 rounded-2xl border-2 border-[#0B4B35]/20 bg-white px-5 text-start text-[#0B4B35] transition-colors hover:bg-[#0B4B35]/5 disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-base font-black">
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Smartphone className="h-5 w-5" />}
                  {creating ? (ar ? "جاري الإنشاء..." : "Creating...") : (ar ? "على الأجهزة" : "On devices")}
                </span>
                {!creating && (
                  <span className="text-xs font-medium text-slate-500">
                    {ar
                      ? "شارك الرابط أو رمز الدخول أو QR لينضم المشاركون من أجهزتهم."
                      : "Share the link, access code, or QR so players can join from their devices."}
                  </span>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bank modal ── */}
      <AnimatePresence>
        {bankOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBankOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
              dir={dir} onClick={e => e.stopPropagation()}>
              <div className="p-5 shrink-0 text-white"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #3b82f6)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    <h2 className="font-black text-lg">{ar ? "بنك الأسئلة" : "Question Bank"}</h2>
                  </div>
                  <button onClick={() => setBankOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-4 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                    placeholder={ar ? "بحث..." : "Search..."}
                    className="w-full text-sm py-2.5 ps-9 pe-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 outline-none text-gray-800 dark:text-gray-200 dark:bg-gray-800" />
                </div>
                {bankSelected.size > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">{ar ? `تم اختيار ${bankSelected.size}` : `${bankSelected.size} selected`}</span>
                    <button onClick={importBankSelected}
                      className="py-1.5 px-4 rounded-lg text-white text-xs font-bold"
                      style={{ background: BLUE }}>
                      <Check className="w-3 h-3 inline me-1" />
                      {ar ? "استيراد" : "Import"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {bankLoading && <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>}
                {!bankLoading && filteredBank.length === 0 && <p className="text-center py-12 text-sm text-gray-400">{ar ? "لا توجد أسئلة" : "No questions"}</p>}
                {Object.entries(groupedBank).map(([subject, subjectQs]) => (
                  <div key={subject}>
                    <div className="py-1 px-2 mb-2 rounded-lg" style={{ background: `${BLUE}15` }}>
                      <span className="text-xs font-black uppercase tracking-wide" style={{ color: BLUE }}>{subject} ({subjectQs.length})</span>
                    </div>
                    <div className="space-y-2">
                      {subjectQs.map(bq => {
                        const checked = bankSelected.has(bq.id);
                        return (
                          <div key={bq.id} onClick={() => { const n = new Set(bankSelected); if (n.has(bq.id)) n.delete(bq.id); else n.add(bq.id); setBankSelected(n); }}
                            className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                            style={{ borderColor: checked ? BLUE : "#e5e7eb", background: checked ? `${BLUE}10` : "#fff" }}>
                            <div className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                                style={{ borderColor: checked ? BLUE : "#d1d5db", background: checked ? BLUE : "#fff" }}>
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{bq.text}</p>
                                <div className="mt-1.5 grid grid-cols-2 gap-1">
                                  {[bq.optionA, bq.optionB, bq.optionC, bq.optionD].map((opt, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded truncate"
                                      style={{
                                        background: bq.correctAnswer === ["A","B","C","D"][i] ? "#dcfce7" : "#f3f4f6",
                                        color: bq.correctAnswer === ["A","B","C","D"][i] ? "#15803d" : "#6b7280",
                                        fontWeight: bq.correctAnswer === ["A","B","C","D"][i] ? "700" : "400",
                                      }}>
                                      {optionLetters[i]}) {opt || "—"}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t shrink-0 flex gap-2">
                <button onClick={() => setBankOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm">{ar ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankSelected} disabled={bankSelected.size === 0}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                  style={{ background: BLUE }}>
                  {ar ? `استيراد (${bankSelected.size})` : `Import (${bankSelected.size})`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Assignments modal ── */}
      <AnimatePresence>
        {assignOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
              dir={dir} onClick={e => e.stopPropagation()}>
              <div className="p-5 shrink-0 text-white"
                style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <h2 className="font-black text-lg">{ar ? "اختر واجباً" : "Select Assignment"}</h2>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-white/80 text-xs mt-1">{ar ? "اضغط على الواجب لاستيراد جميع أسئلته مباشرة" : "Tap an assignment to import all its questions"}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading && <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" /></div>}
                {!assignLoading && assignments.length === 0 && <p className="text-center py-12 text-sm text-gray-400">{ar ? "لا توجد واجبات" : "No assignments"}</p>}
                {assignments.map(a => (
                  <motion.button key={a.id} whileTap={{ scale: 0.97 }}
                    onClick={() => importAllFromAssignment(a.id, a.title)}
                    disabled={assignImporting !== null}
                    className="w-full p-4 rounded-2xl border-2 flex items-center gap-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-start"
                    style={{ borderColor: "#f59e0b", background: assignImporting === a.id ? "#fef3c7" : "#fff" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                      {assignImporting === a.id
                        ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                        : <FileText className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-800 dark:text-gray-100 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                    </div>
                    <Check className="w-5 h-5 text-amber-500 shrink-0" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
