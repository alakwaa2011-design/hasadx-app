import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock,
  Check, X, Loader2, FileText, BookOpen,
  GraduationCap, Trash2, Search,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BLUE = "#3b5bdb";
const INDIGO = "#4c6ef5";

interface TugQuestion {
  text: string;
  options: string[];
  correct: number;
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
}

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToTug = (bq: BankQuestion): TugQuestion => ({
  text: bq.text,
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
});

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
        type RawQ = { questionType?: string; text?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string };
        const qs = ((data.questions || []) as RawQ[])
          .filter(q => q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map(q => bankToTug({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null,
          } as BankQuestion))
          .slice(0, 20);
        if (qs.length > 0) {
          setQuestions(qs);
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من العرض!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف أسئلة أولاً (من بنك الأسئلة أو من واجب)" : "Add questions first");
      return;
    }
    setCreating(true);
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
        .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; points: number }) => bankToTug({
          id: q.id, subject: data.subject || "", text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: q.points || 1, tags: null,
        } as BankQuestion));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار متعدد في هذا الواجب" : "No MCQ questions found"); return; }
      const sliced = qs.slice(0, 20);
      setQuestions(sliced);
      setQuestionCount(sliced.length);
      setSelectedSource("assignment");
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

  return (
    <Layout>
      {/* Deep game-arena background — dark green atmosphere */}
      <div className="min-h-screen relative overflow-hidden" dir={dir}
        style={{ background: "linear-gradient(160deg, #071c0e 0%, #0a2e17 50%, #0c3520 100%)" }}>

        {/* Subtle stadium ceiling glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 90% 35% at 50% 0%, rgba(34,197,94,0.11) 0%, transparent 65%)" }} />
        {/* Side arena glows */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 30% 60% at 0% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 30% 60% at 100% 50%, rgba(239,68,68,0.06) 0%, transparent 70%)" }} />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-10">

          {/* ── HERO: Team VS Banner ── */}
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl overflow-hidden mb-5"
            style={{
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 4px 32px rgba(0,0,0,0.35)",
            }}>
            <div className="px-6 sm:px-10 py-6 flex items-center gap-4">

              {/* Blue team side */}
              <div className="flex-1 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <motion.div
                  animate={{ x: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 6px 20px -4px rgba(37,99,235,0.55)" }}>
                  💪
                </motion.div>
                <div className="text-center sm:text-start">
                  <p className="text-blue-400 font-black text-base sm:text-lg leading-tight">
                    {ar ? "الفريق الأزرق" : "Blue Team"}
                  </p>
                  <p className="text-white/30 text-xs">{ar ? "المنافس الأول" : "Team 1"}</p>
                </div>
              </div>

              {/* Center rope + VS */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-2 sm:px-4">
                <motion.div
                  animate={{ rotate: [0, -3, 3, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                  <span className="text-4xl sm:text-5xl">🪢</span>
                </motion.div>
                <div className="px-3 py-1 rounded-full text-[10px] font-black text-white/50 uppercase tracking-widest"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  VS
                </div>
              </div>

              {/* Red team side */}
              <div className="flex-1 flex flex-col items-center gap-2 sm:flex-row-reverse sm:items-center sm:gap-3">
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: 0.3 }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", boxShadow: "0 6px 20px -4px rgba(239,68,68,0.55)" }}>
                  💪
                </motion.div>
                <div className="text-center sm:text-end">
                  <p className="text-red-400 font-black text-base sm:text-lg leading-tight">
                    {ar ? "الفريق الأحمر" : "Red Team"}
                  </p>
                  <p className="text-white/30 text-xs">{ar ? "المنافس الثاني" : "Team 2"}</p>
                </div>
              </div>
            </div>

            {/* Title bar at bottom of hero */}
            <div className="px-6 py-4 text-center"
              style={{ background: "rgba(0,0,0,0.20)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
              </h1>
              <p className="text-xs sm:text-sm text-white/45 mt-0.5">
                {ar ? "فريقان يتنافسان بالإجابة على الأسئلة" : "Two teams compete by answering questions"}
              </p>
            </div>
          </motion.div>

          {/* ── Two-column layout on desktop ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

            {/* LEFT: Settings card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.11)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
              }}>

              <div className="px-4 py-3 border-b"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
                <p className="text-xs font-black text-white/45 uppercase tracking-widest">
                  {ar ? "إعدادات اللعبة" : "Game settings"}
                </p>
              </div>

              {/* Duration */}
              <div className="px-5 py-4 flex items-center gap-4">
                <Clock className="w-5 h-5 shrink-0 text-emerald-400" />
                <span className="text-sm font-bold text-white/80 flex-1">
                  {ar ? "وقت السؤال" : "Time per question"}
                </span>
                <div className="flex gap-1.5 shrink-0 bg-black/20 rounded-xl p-1">
                  {[10, 15, 20, 30].map(s => (
                    <button key={s} onClick={() => setDuration(s)}
                      className="px-3.5 py-2 rounded-lg text-xs font-black transition-all"
                      style={{
                        background: duration === s ? "#16a34a" : "transparent",
                        color: duration === s ? "#fff" : "rgba(255,255,255,0.45)",
                        boxShadow: duration === s ? "0 2px 8px rgba(22,163,74,0.4)" : "none",
                      }}>
                      {s}{ar ? "ث" : "s"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

              {/* Auto advance */}
              <div className="px-5 py-4 flex items-center gap-4">
                <span className="text-lg shrink-0">⏭</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white/80">
                    {ar ? "التقدم التلقائي بعد كل سؤال" : "Auto-advance after each question"}
                  </p>
                  <p className="text-[11px] text-white/35">
                    {ar ? "الانتقال تلقائياً للسؤال التالي بعد الإجابة" : "Move to next question automatically"}
                  </p>
                </div>
                <button onClick={() => setAutoAdvance(!autoAdvance)}
                  className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                  style={{ background: autoAdvance ? "#16a34a" : "rgba(255,255,255,0.2)" }}>
                  <motion.div
                    animate={{ x: autoAdvance ? (dir === "rtl" ? -20 : 20) : 2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                    style={{ [dir === "rtl" ? "right" : "left"]: 2 }}
                  />
                </button>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

              {/* Question count */}
              <div className="px-5 py-4 flex items-center gap-4">
                <span className="text-lg shrink-0">📋</span>
                <span className="text-sm font-bold text-white/80 flex-1">
                  {ar ? "عدد الأسئلة" : "Question count"}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => setQuestionCount(c => Math.max(1, c - 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white/70 transition-all hover:bg-white/10 active:scale-90"
                    style={{ border: "1.5px solid rgba(255,255,255,0.18)" }}>
                    −
                  </button>
                  <span className="w-10 text-center text-lg font-black text-white tabular-nums">
                    {questionCount}
                  </span>
                  <button onClick={() => setQuestionCount(c => Math.min(20, c + 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold text-white/70 transition-all hover:bg-white/10 active:scale-90"
                    style={{ border: "1.5px solid rgba(255,255,255,0.18)" }}>
                    +
                  </button>
                </div>
              </div>

              {gradeLevels.length > 0 && (
                <>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
                  <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
                    <GraduationCap className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span className="text-sm font-bold text-white/80 flex-1 min-w-0">
                      {ar ? "الصف المستهدف" : "Target class"}
                    </span>
                    <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-gray-800 bg-white/90 border-0 outline-none shrink-0"
                      style={{ minWidth: 140 }}>
                      <option value="">{ar ? "— جميع الصفوف —" : "— All classes —"}</option>
                      {gradeLevels.map(g => (
                        <option key={g.gradeLevel} value={g.gradeLevel}>
                          {g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </motion.div>

            {/* RIGHT: Source cards + status + button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}
              className="flex flex-col gap-3">

              {/* Source label */}
              <p className="text-[11px] font-black text-white/40 uppercase tracking-widest px-1">
                {ar ? "مصدر الأسئلة" : "Question source"}
              </p>

              {/* Assignment card */}
              <motion.button
                whileHover={{ y: -2, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-colors text-start"
                style={{
                  background: selectedSource === "assignment"
                    ? "rgba(245,158,11,0.14)"
                    : "rgba(255,255,255,0.06)",
                  borderColor: selectedSource === "assignment" ? "#f59e0b" : "rgba(255,255,255,0.12)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                }}>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" }}>
                  <FileText className="w-6 h-6 text-white" />
                  {selectedSource === "assignment" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center bg-amber-400">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-white">{ar ? "من واجب" : "Assignment"}</p>
                  <p className="text-xs text-white/45 mt-0.5">{ar ? "الأسئلة من الواجبات" : "Questions from assignments"}</p>
                </div>
              </motion.button>

              {/* Bank card */}
              <motion.button
                whileHover={{ y: -2, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setBankOpen(true)}
                className="flex items-center gap-4 px-5 py-5 rounded-2xl border-2 transition-colors text-start"
                style={{
                  background: selectedSource === "bank"
                    ? "rgba(59,91,219,0.18)"
                    : "rgba(255,255,255,0.06)",
                  borderColor: selectedSource === "bank" ? BLUE : "rgba(255,255,255,0.12)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                }}>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, #0ea5e9 0%, ${BLUE} 100%)` }}>
                  <BookOpen className="w-6 h-6 text-white" />
                  {selectedSource === "bank" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: BLUE }}>
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-white">{ar ? "بنك الأسئلة" : "Question Bank"}</p>
                  <p className="text-xs text-white/45 mt-0.5">
                    {bankQuestions.length > 0
                      ? `${bankQuestions.length} ${ar ? "سؤال متاح" : "questions available"}`
                      : (ar ? "الأسئلة من بنك الأسئلة" : "Questions from the bank")}
                  </p>
                </div>
              </motion.button>

              {/* Questions loaded strip */}
              <AnimatePresence>
                {questions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.30)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
                        style={{ background: "#16a34a" }}>
                        {questions.length}
                      </div>
                      <p className="text-sm font-bold text-green-300 flex-1">
                        {ar ? `${questions.length} سؤال محمّل — جاهز!` : `${questions.length} questions ready!`}
                      </p>
                      <button
                        onClick={() => { setQuestions([]); setSelectedSource(null); setQuestionCount(10); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors text-red-400 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Create Room button */}
              <motion.button
                whileHover={questions.length > 0 ? { scale: 1.02 } : {}}
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={creating || questions.length === 0}
                className="w-full py-5 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all mt-auto"
                style={{
                  background: questions.length > 0
                    ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                    : "rgba(255,255,255,0.09)",
                  boxShadow: questions.length > 0 ? "0 10px 28px -6px rgba(22,163,74,0.5)" : "none",
                  cursor: questions.length > 0 ? "pointer" : "not-allowed",
                  opacity: questions.length > 0 ? 1 : 0.4,
                  border: questions.length > 0 ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {creating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {ar ? "جاري الإنشاء..." : "Creating..."}</>
                ) : (
                  <>
                    <Play className="w-5 h-5" fill="currentColor" />
                    {ar
                      ? questions.length > 0 ? `أنشئ الغرفة (${questions.length} أسئلة)` : "أنشئ الغرفة"
                      : questions.length > 0 ? `Create Room · ${questions.length} Qs` : "Create Room"}
                  </>
                )}
              </motion.button>

              {questions.length === 0 && (
                <p className="text-center text-xs text-white/28">
                  {ar ? "اختر مصدر الأسئلة أولاً لتفعيل الزر" : "Pick a question source first"}
                </p>
              )}

            </motion.div>
          </div>

        </div>
      </div>

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
