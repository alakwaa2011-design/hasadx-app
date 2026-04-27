import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, ChevronDown, ChevronUp,
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
  const [assignExpandedId, setAssignExpandedId] = useState<number | null>(null);
  const [assignQuestions, setAssignQuestions] = useState<BankQuestion[]>([]);
  const [assignQLoading, setAssignQLoading] = useState(false);
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());

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
    setQuestions(prev => [...prev, ...selected.map(bankToTug)].slice(0, 20));
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

  const loadAssignmentQuestions = useCallback(async (assignmentId: number) => {
    setAssignQLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const qs = (data.questions || [])
          .filter((q: { questionType?: string; optionA?: string; correctAnswer?: string }) =>
            q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)
          .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; points: number }) => ({
            id: q.id, subject: data.subject || "", text: q.text,
            optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
            correctAnswer: q.correctAnswer, points: q.points || 1, tags: null,
          } as BankQuestion));
        setAssignQuestions(qs);
      }
    } catch { /* ignore */ } finally { setAssignQLoading(false); }
  }, []);

  useEffect(() => {
    if (assignOpen) { loadAssignments(); setAssignSelected(new Set()); setAssignExpandedId(null); setAssignQuestions([]); }
  }, [assignOpen, loadAssignments]);

  const importAssignSelected = () => {
    const selected = assignQuestions.filter(q => assignSelected.has(q.id));
    if (selected.length === 0) return;
    setQuestions(prev => [...prev, ...selected.map(bankToTug)].slice(0, 20));
    setAssignOpen(false);
    toast.success(ar ? `تم استيراد ${selected.length} سؤال من الواجب!` : `Imported ${selected.length} questions!`);
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
      {/* pb-28 to leave room for sticky button */}
      <div className="min-h-screen py-8 px-4 pb-28" dir={dir}
        style={{ background: "linear-gradient(180deg, #eff6ff 0%, #eef2ff 100%)" }}>
        <div className="max-w-2xl mx-auto">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${INDIGO} 100%)`, boxShadow: `0 12px 32px -8px ${BLUE}66` }}>
              <span className="text-4xl">🪢</span>
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: BLUE }}>
              {ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
            </h1>
            <p className="text-sm text-gray-500">
              {ar ? "فريقان يتنافسان بالإجابة على الأسئلة!" : "Two teams compete by answering questions!"}
            </p>
          </motion.div>

          {/* Duration */}
          <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
            <Clock className="w-5 h-5 shrink-0" style={{ color: BLUE }} />
            <span className="font-bold text-sm text-gray-800 dark:text-gray-200 flex-1">
              {ar ? "وقت كل سؤال" : "Time per question"}
            </span>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30].map(s => (
                <button key={s} onClick={() => setDuration(s)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all border"
                  style={{
                    background: duration === s ? BLUE : "#fff",
                    color: duration === s ? "#fff" : "#374151",
                    borderColor: duration === s ? BLUE : "#d1d5db",
                  }}>
                  {s}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Auto advance */}
          <Card className="p-4 mb-3 flex items-center gap-4">
            <span className="text-xl shrink-0">⏭</span>
            <span className="font-bold text-sm text-gray-800 dark:text-gray-200 flex-1">
              {ar ? "تقدم تلقائي بعد كل سؤال" : "Auto-advance after each question"}
            </span>
            <button onClick={() => setAutoAdvance(!autoAdvance)}
              className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
              style={{ background: autoAdvance ? "#16a34a" : "#d1d5db" }}>
              <motion.div
                animate={{ x: autoAdvance ? (dir === "rtl" ? -20 : 20) : 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow"
                style={{ [dir === "rtl" ? "right" : "left"]: 2 }}
              />
            </button>
          </Card>

          {/* Target class */}
          {gradeLevels.length > 0 && (
            <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
              <GraduationCap className="w-5 h-5 shrink-0" style={{ color: "#10b981" }} />
              <span className="font-bold text-sm text-gray-800 dark:text-gray-200 flex-1">
                {ar ? "الصف المستهدف" : "Target class"}
              </span>
              <select value={targetClass} onChange={e => setTargetClass(e.target.value)}
                className="min-w-[160px] max-w-[260px] rounded-lg border bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-200"
                style={{ borderColor: "#d1d5db" }}>
                <option value="">{ar ? "— جميع الصفوف —" : "— All classes —"}</option>
                {gradeLevels.map(g => (
                  <option key={g.gradeLevel} value={g.gradeLevel}>
                    {g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})
                  </option>
                ))}
              </select>
            </Card>
          )}

          {/* Questions counter */}
          <AnimatePresence>
            {questions.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <Card className="p-4 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
                      style={{ background: BLUE }}>
                      {questions.length}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                        {ar ? "سؤال محمّل" : "questions loaded"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ar ? "جاهز للانطلاق!" : "Ready to go!"}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setQuestions([])}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={ar ? "مسح الأسئلة" : "Clear"}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => setBankOpen(true)}
              className="py-5 rounded-2xl text-white font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: `linear-gradient(135deg, #0ea5e9, #3b82f6)`, boxShadow: "0 8px 20px -6px rgba(59,130,246,0.5)" }}>
              <BookOpen className="w-6 h-6" />
              <span>{ar ? "بنك الأسئلة" : "Question Bank"}</span>
              {bankQuestions.length > 0 && (
                <span className="text-xs opacity-80">({bankQuestions.length})</span>
              )}
            </button>
            <button onClick={() => setAssignOpen(true)}
              className="py-5 rounded-2xl text-white font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 8px 20px -6px rgba(245,158,11,0.5)" }}>
              <FileText className="w-6 h-6" />
              <span>{ar ? "من واجب" : "From Assignment"}</span>
            </button>
          </div>

          {questions.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-2">
              {ar ? "اختر مصدر الأسئلة أولاً ثم أنشئ الغرفة" : "Pick a question source, then create room"}
            </p>
          )}
        </div>
      </div>

      {/* ── Sticky floating "Create Room" button ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "12px 16px",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderTop: "1.5px solid rgba(59,130,246,0.15)",
          boxShadow: "0 -8px 24px -4px rgba(59,130,246,0.15)",
        }}
        dir={dir}
      >
        <div className="max-w-2xl mx-auto">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={handleCreate}
            disabled={creating || questions.length === 0}
            className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all"
            style={{
              background: questions.length > 0
                ? `linear-gradient(135deg, ${BLUE} 0%, ${INDIGO} 100%)`
                : "#d1d5db",
              boxShadow: questions.length > 0 ? `0 12px 28px -8px ${BLUE}80` : "none",
              cursor: questions.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {creating ? (
              <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جاري الإنشاء..." : "Creating..."}</>
            ) : (
              <>
                <Play className="w-6 h-6" fill="currentColor" />
                {ar
                  ? questions.length > 0 ? `أنشئ الغرفة (${questions.length} سؤال)` : "أنشئ الغرفة"
                  : questions.length > 0 ? `Create Room (${questions.length} Qs)` : "Create Room"}
              </>
            )}
          </motion.button>
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
                    <h2 className="font-black text-lg">{ar ? "استيراد من واجب" : "Import from Assignment"}</h2>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20"><X className="w-5 h-5" /></button>
                </div>
              </div>
              {assignSelected.size > 0 && (
                <div className="p-3 border-b shrink-0 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600">{ar ? `تم اختيار ${assignSelected.size}` : `${assignSelected.size} selected`}</span>
                  <button onClick={importAssignSelected}
                    className="py-1.5 px-4 rounded-lg text-white text-xs font-bold"
                    style={{ background: "#f59e0b" }}>
                    {ar ? "استيراد" : "Import"}
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading && <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" /></div>}
                {!assignLoading && assignments.length === 0 && <p className="text-center py-12 text-sm text-gray-400">{ar ? "لا توجد واجبات" : "No assignments"}</p>}
                {assignments.map(a => (
                  <div key={a.id} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
                    <button
                      onClick={() => {
                        if (assignExpandedId === a.id) { setAssignExpandedId(null); return; }
                        setAssignExpandedId(a.id);
                        setAssignSelected(new Set());
                        loadAssignmentQuestions(a.id);
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-amber-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "#fef3c7" }}>
                        <FileText className="w-4 h-4" style={{ color: "#d97706" }} />
                      </div>
                      <div className="flex-1 text-start">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{a.title}</p>
                        <p className="text-xs text-gray-500">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                      </div>
                      {assignExpandedId === a.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    <AnimatePresence>
                      {assignExpandedId === a.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="p-3 border-t space-y-2" style={{ borderColor: "#fde68a" }}>
                            {assignQLoading && <Loader2 className="w-4 h-4 animate-spin mx-auto text-amber-500" />}
                            {!assignQLoading && assignQuestions.length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-3">{ar ? "لا توجد أسئلة اختيار متعدد" : "No MCQ questions"}</p>
                            )}
                            {assignQuestions.length > 0 && (
                              <button
                                onClick={() => setAssignSelected(
                                  assignSelected.size === assignQuestions.length
                                    ? new Set()
                                    : new Set(assignQuestions.map(q => q.id))
                                )}
                                className="text-xs font-bold hover:underline"
                                style={{ color: "#d97706" }}>
                                {assignSelected.size === assignQuestions.length
                                  ? (ar ? "إلغاء تحديد الكل" : "Deselect All")
                                  : (ar ? "تحديد الكل" : "Select All")}
                              </button>
                            )}
                            {assignQuestions.map(q => {
                              const checked = assignSelected.has(q.id);
                              return (
                                <div key={q.id}
                                  onClick={() => { const n = new Set(assignSelected); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); setAssignSelected(n); }}
                                  className="p-2.5 rounded-lg border-2 cursor-pointer transition-all"
                                  style={{ borderColor: checked ? "#f59e0b" : "#e5e7eb", background: checked ? "#fef9e7" : "#fff" }}>
                                  <div className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                                      style={{ borderColor: checked ? "#f59e0b" : "#d1d5db", background: checked ? "#f59e0b" : "#fff" }}>
                                      {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-gray-800 leading-tight">{q.text}</p>
                                      <div className="mt-1 grid grid-cols-2 gap-1">
                                        {[q.optionA, q.optionB, q.optionC, q.optionD].map((opt, i) => (
                                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded truncate"
                                            style={{
                                              background: q.correctAnswer === ["A","B","C","D"][i] ? "#dcfce7" : "#f3f4f6",
                                              color: q.correctAnswer === ["A","B","C","D"][i] ? "#15803d" : "#6b7280",
                                              fontWeight: q.correctAnswer === ["A","B","C","D"][i] ? "700" : "400",
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
                            {assignQuestions.length > 0 && (
                              <button onClick={importAssignSelected} disabled={assignSelected.size === 0}
                                className="w-full py-2 rounded-xl text-white font-bold text-sm disabled:opacity-40"
                                style={{ background: "#f59e0b" }}>
                                {ar ? `استيراد (${assignSelected.size})` : `Import (${assignSelected.size})`}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
