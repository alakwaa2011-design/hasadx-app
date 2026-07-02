// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — CREATE page. Same conventions as tug-create:
//   • Question sources: assignments / question bank / presentation deep-link.
//   • Settings: escape time, lock count, hint keys.
//   • Launch: Class Mode (one screen, local) or Device Mode (PIN + QR room).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Check, X, Loader2, FileText, BookOpen, Trash2, Search, Lock, KeyRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { ESCAPE_CLASS_SETUP_KEY } from "@/lib/escape-engine";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GOLD = "#d9a521";

interface EscapeQuestion {
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

const bankToEscape = (bq: BankQuestion): EscapeQuestion => ({
  text: bq.text,
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
});

export default function EscapeCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<EscapeQuestion[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(10);
  const [lockCount, setLockCount] = useState(4);
  const [hints, setHints] = useState(2);
  const [creating, setCreating] = useState(false);
  const [selectedSource, setSelectedSource] = useState<"bank" | "assignment" | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  // Bank modal
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  // Assignments modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<{ id: number; title: string; subject: string; questionCount: number }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignImporting, setAssignImporting] = useState<number | null>(null);

  // Presentation / dashboard deep-link (?assignmentId=…)
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
          .map(q => bankToEscape({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null,
          } as BankQuestion))
          .slice(0, 30);
        if (qs.length > 0) {
          setQuestions(qs);
          setSelectedSource("assignment");
          if (typeof data.title === "string" && data.title.trim()) setSourceTitle(data.title.trim());
          toast.success(ar ? `تم تحميل ${qs.length} سؤال!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bank ──
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
    const merged = [...questions, ...selected.map(bankToEscape)].slice(0, 30);
    setQuestions(merged);
    setSelectedSource("bank");
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${selected.length} سؤال!` : `Imported ${selected.length} questions!`);
  };

  // ── Assignments ──
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
        .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; points: number }) => bankToEscape({
          id: q.id, subject: data.subject || "", text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: q.points || 1, tags: null,
        } as BankQuestion));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار متعدد في هذا الواجب" : "No MCQ questions found"); return; }
      setQuestions(qs.slice(0, 30));
      setSelectedSource("assignment");
      setSourceTitle(assignmentTitle);
      setAssignOpen(false);
      toast.success(ar ? `تم استيراد ${qs.length} سؤال من "${assignmentTitle}"` : `Imported ${qs.length} questions from "${assignmentTitle}"`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

  // ── Launchers ──
  const buildSetup = () => ({
    questions,
    totalTime: totalMinutes * 60,
    lockCount: Math.min(lockCount, questions.length),
    hints,
    title: sourceTitle || undefined,
  });

  const requireQuestions = () => {
    if (questions.length < 3) {
      toast.error(ar ? "قبو حصاد يحتاج 3 أسئلة على الأقل" : "The vault needs at least 3 questions");
      return false;
    }
    return true;
  };

  const startClassMode = () => {
    if (!requireQuestions()) return;
    try {
      sessionStorage.setItem(ESCAPE_CLASS_SETUP_KEY, JSON.stringify(buildSetup()));
    } catch { /* storage blocked — the class page will show the setup prompt */ }
    setLocation("/game/escape/class");
  };

  const startDeviceMode = () => {
    if (!requireQuestions()) return;
    setCreating(true);
    const socket = getSocket();
    socket.emit("escape:create", buildSetup(),
      (res: { pin?: string; creatorToken?: string; error?: string }) => {
        setCreating(false);
        if (res.error || !res.pin || !res.creatorToken) {
          toast.error(res.error || (ar ? "تعذّر إنشاء الغرفة" : "Failed to create room"));
          return;
        }
        try { sessionStorage.setItem(`escape-creator-${res.pin}`, res.creatorToken); } catch (_) { /* ignore */ }
        setLocation(`/game/escape/host/${res.pin}`);
      });
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
  const ready = questions.length >= 3;

  return (
    <Layout>
      <div className="min-h-screen" dir={dir} style={{ background: "#faf7ef" }}>

        {/* ══ HERO — vault door in warm darkness ══ */}
        <div className="relative overflow-hidden"
          style={{ background: "linear-gradient(180deg, #131c33 0%, #1b2742 55%, #faf7ef 100%)" }}>
          <div className="absolute top-0 left-1/2 h-72 w-[560px] -translate-x-1/2 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at top, rgba(247,201,72,0.22) 0%, transparent 65%)" }} />
          {/* Chains on the edges */}
          <svg className="absolute left-3 top-0 h-full w-8 opacity-15 pointer-events-none hidden sm:block" viewBox="0 0 20 160" preserveAspectRatio="none">
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse key={i} cx="10" cy={14 + i * 30} rx="7" ry="12" fill="none" stroke="#F7C948" strokeWidth="2.5" />
            ))}
          </svg>
          <svg className="absolute right-3 top-0 h-full w-8 opacity-15 pointer-events-none hidden sm:block" viewBox="0 0 20 160" preserveAspectRatio="none">
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse key={i} cx="10" cy={i % 2 === 0 ? 14 + i * 30 : 24 + i * 28} rx="7" ry="12" fill="none" stroke="#F7C948" strokeWidth="2.5" />
            ))}
          </svg>

          <div className="relative mx-auto max-w-[1100px] px-4 pt-8 pb-10 text-center sm:px-8">
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border-2 border-amber-300/40 text-5xl"
              style={{ background: "rgba(247,201,72,0.1)", boxShadow: "0 0 42px rgba(247,201,72,0.3)" }}>
              🔐
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-1 text-3xl font-black text-white sm:text-4xl"
              style={{ textShadow: "0 0 26px rgba(247,201,72,0.35)" }}>
              {ar ? "قبو حصاد" : "Hasad Vault"}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-sm font-bold text-amber-100/70 sm:text-base">
              {ar
                ? "غرفة هروب تعليمية: فكّكوا الأقفال بالإجابات الصحيحة واهربوا قبل انتهاء الوقت!"
                : "An educational escape room: break the locks with correct answers and escape before time runs out!"}
            </motion.p>
            {/* Lock types strip */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: "🔢", t: ar ? "قفل الأرقام" : "Number Lock" },
                { icon: "🔦", t: ar ? "شبكة الليزر" : "Laser Grid" },
                { icon: "🔌", t: ar ? "لوحة الأسلاك" : "Wire Panel" },
                { icon: "👑", t: ar ? "الخزنة الكبرى" : "Master Vault" },
              ].map((l) => (
                <span key={l.t} className="flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-black/25 px-3 py-1.5 text-xs font-black text-amber-100/85 backdrop-blur-sm">
                  <span className="text-sm">{l.icon}</span>{l.t}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ══ MAIN ══ */}
        <div className="mx-auto max-w-[1100px] px-4 py-6 pb-8 sm:px-6">
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">

            {/* ── SETTINGS ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="rounded-3xl bg-white p-6 sm:p-7"
              style={{ border: "1.5px solid #ece5d3", boxShadow: "0 2px 14px rgba(0,0,0,0.06)" }}>
              <h2 className="mb-5 text-base font-black text-gray-800">
                {ar ? "إعدادات القبو" : "Vault Settings"}
              </h2>

              {/* Escape time */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex shrink-0 items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">{ar ? "زمن الهروب" : "Escape time"}</span>
                </div>
                <div className="ms-3 flex gap-1 rounded-xl bg-gray-100 p-1">
                  {[5, 8, 10, 15].map(m => (
                    <button key={m} onClick={() => setTotalMinutes(m)}
                      className="rounded-lg px-3 py-1.5 text-xs font-black transition-all"
                      style={{
                        background: totalMinutes === m ? GOLD : "transparent",
                        color: totalMinutes === m ? "#fff" : "#6b7280",
                      }}>
                      {m}{ar ? "د" : "m"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lock count */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">{ar ? "عدد الأقفال" : "Locks"}</span>
                </div>
                <div className="ms-3 flex gap-1 rounded-xl bg-gray-100 p-1">
                  {[3, 4, 5].map(n => (
                    <button key={n} onClick={() => setLockCount(n)}
                      className="rounded-lg px-3.5 py-1.5 text-xs font-black transition-all"
                      style={{
                        background: lockCount === n ? GOLD : "transparent",
                        color: lockCount === n ? "#fff" : "#6b7280",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hint keys */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">{ar ? "مفاتيح المساعدة (50/50)" : "Hint keys (50/50)"}</span>
                </div>
                <div className="ms-3 flex gap-1 rounded-xl bg-gray-100 p-1">
                  {[0, 1, 2, 3].map(n => (
                    <button key={n} onClick={() => setHints(n)}
                      className="rounded-lg px-3 py-1.5 text-xs font-black transition-all"
                      style={{
                        background: hints === n ? GOLD : "transparent",
                        color: hints === n ? "#fff" : "#6b7280",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alarm rule reminder */}
              <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3"
                style={{ background: "#fef2f2", border: "1.5px solid #fecaca" }}>
                <span className="text-base">🚨</span>
                <p className="text-xs font-bold leading-relaxed text-red-700">
                  {ar
                    ? "كل إجابة خاطئة تُطلق الإنذار وتخصم 15 ثانية من وقت الهروب."
                    : "Every wrong answer trips the alarm and burns 15 seconds of escape time."}
                </p>
              </div>
            </motion.div>

            {/* ── SOURCE ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="flex flex-col rounded-3xl bg-white p-6 sm:p-7"
              style={{ border: "1.5px solid #ece5d3", boxShadow: "0 2px 14px rgba(0,0,0,0.06)" }}>
              <h2 className="mb-4 text-base font-black text-gray-800">
                {ar ? "اختر مصدر الأسئلة" : "Question Source"}
              </h2>

              {/* Assignment */}
              <button onClick={() => setAssignOpen(true)}
                className="mb-3 flex w-full items-center gap-4 rounded-[18px] border-2 p-4 text-start transition-all hover:shadow-md active:scale-[0.98]"
                style={{
                  background: selectedSource === "assignment" ? "#fffbeb" : "#fffdf7",
                  borderColor: selectedSource === "assignment" ? "#f59e0b" : "#fde8b4",
                  minHeight: 100,
                }}>
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                  <FileText className="h-7 w-7" style={{ color: "#d97706" }} />
                  {selectedSource === "assignment" && (
                    <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-800">{ar ? "من واجب" : "From Assignment"}</p>
                  <p className="mt-1 text-xs text-gray-400">{ar ? "الأسئلة من الواجبات" : "Questions from assignments"}</p>
                </div>
              </button>

              {/* Bank */}
              <button onClick={() => setBankOpen(true)}
                className="mb-4 flex w-full items-center gap-4 rounded-[18px] border-2 p-4 text-start transition-all hover:shadow-md active:scale-[0.98]"
                style={{
                  background: selectedSource === "bank" ? "#eff6ff" : "#f8fbff",
                  borderColor: selectedSource === "bank" ? "#3b82f6" : "#bfdbfe",
                  minHeight: 100,
                }}>
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #dbeafe, #bfdbfe)" }}>
                  <BookOpen className="h-7 w-7" style={{ color: "#2563eb" }} />
                  {selectedSource === "bank" && (
                    <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-800">{ar ? "بنك الأسئلة" : "Question Bank"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {bankQuestions.length > 0
                      ? `${bankQuestions.length} ${ar ? "سؤال متاح" : "available"}`
                      : (ar ? "الأسئلة من بنك الأسئلة" : "Questions from the bank")}
                  </p>
                </div>
              </button>

              {/* Loaded strip */}
              <AnimatePresence>
                {questions.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="mt-auto overflow-hidden">
                    <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                      style={{ background: "#fffbeb", border: "1.5px solid #fde68a" }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                        style={{ background: GOLD }}>
                        {questions.length}
                      </div>
                      <p className="flex-1 text-sm font-bold text-amber-700">
                        {ar ? `${questions.length} سؤال جاهز — القبو مستعد!` : `${questions.length} questions ready — the vault awaits!`}
                      </p>
                      <button
                        onClick={() => { setQuestions([]); setSelectedSource(null); setSourceTitle(null); }}
                        className="shrink-0 rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {questions.length === 0 && (
                <p className="mt-auto pt-2 text-center text-xs text-gray-400">
                  {ar ? "اختر مصدر الأسئلة أولاً (3 أسئلة على الأقل)" : "Pick a source first (min 3 questions)"}
                </p>
              )}
            </motion.div>
          </div>

          {/* ── LAUNCH: DEVICE MODE (primary) ── */}
          <div className="mb-4 flex justify-center">
            <motion.button
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
              whileTap={{ scale: 0.99 }}
              onClick={startDeviceMode}
              disabled={creating || !ready}
              className="flex items-center justify-center gap-3 text-lg font-black text-white transition-all"
              style={{
                width: "min(820px, 100%)",
                height: 64,
                borderRadius: 18,
                background: ready
                  ? "linear-gradient(135deg, #f7c948 0%, #d9a521 50%, #a16207 100%)"
                  : "#d1d5db",
                boxShadow: ready ? "0 6px 22px rgba(217,165,33,0.4)" : "none",
                cursor: ready ? "pointer" : "not-allowed",
              }}>
              {creating
                ? <><Loader2 className="h-5 w-5 animate-spin" /> {ar ? "جاري فتح القبو..." : "Opening the vault..."}</>
                : <>📱 {ar ? "وضع الأجهزة — كل طالب يهرب بجهازه (PIN + QR)" : "Device Mode — every student escapes on their device (PIN + QR)"}</>}
            </motion.button>
          </div>

          {/* ── LAUNCH: CLASS MODE ── */}
          <div className="mb-5 flex justify-center">
            <motion.button
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.99 }}
              onClick={startClassMode}
              disabled={!ready}
              className="flex items-center justify-center gap-3 text-base font-black transition-all"
              style={{
                width: "min(820px, 100%)",
                height: 56,
                borderRadius: 18,
                background: ready ? "#ffffff" : "#f1f5f9",
                border: ready ? "2px solid #131c33" : "2px solid #e2e8f0",
                color: ready ? "#131c33" : "#94a3b8",
                boxShadow: ready ? "0 4px 14px rgba(19,28,51,0.16)" : "none",
                cursor: ready ? "pointer" : "not-allowed",
              }}>
              🏫 {ar ? "وضع الصف — شاشة واحدة والصف كله فريق واحد" : "Class Mode — one screen, the whole class is one crew"}
            </motion.button>
          </div>

          {/* Info strip */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: "🤝", text: ar ? "أول لعبة تعاونية في حصاد" : "Hasad's first cooperative game" },
              { icon: "🗝️", text: ar ? "كل قفل يكشف رقماً من الرمز الأعظم" : "Each lock reveals a master-code digit" },
              { icon: "🚨", text: ar ? "الخطأ يطلق الإنذار ويحرق الوقت" : "Mistakes trip the alarm and burn time" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
                style={{ background: "#ffffff", border: "1.5px solid #ece5d3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <span className="text-base">{item.icon}</span>
                <span className="text-xs font-medium text-gray-500">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bank modal ── */}
      <AnimatePresence>
        {bankOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setBankOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
              dir={dir} onClick={e => e.stopPropagation()}>
              <div className="shrink-0 p-5 text-white" style={{ background: "linear-gradient(135deg, #0ea5e9, #3b82f6)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <h2 className="text-lg font-black">{ar ? "بنك الأسئلة" : "Question Bank"}</h2>
                  </div>
                  <button onClick={() => setBankOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="shrink-0 border-b p-4">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                    placeholder={ar ? "بحث..." : "Search..."}
                    className="w-full rounded-xl border-2 border-gray-200 py-2.5 ps-9 pe-3 text-sm text-gray-800 outline-none focus:border-blue-400 dark:bg-gray-800 dark:text-gray-200" />
                </div>
                {bankSelected.size > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">{ar ? `تم اختيار ${bankSelected.size}` : `${bankSelected.size} selected`}</span>
                    <button onClick={importBankSelected}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white">
                      <Check className="me-1 inline h-3 w-3" />
                      {ar ? "استيراد" : "Import"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {bankLoading && <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" /></div>}
                {!bankLoading && filteredBank.length === 0 && <p className="py-12 text-center text-sm text-gray-400">{ar ? "لا توجد أسئلة" : "No questions"}</p>}
                {Object.entries(groupedBank).map(([subject, subjectQs]) => (
                  <div key={subject}>
                    <div className="mb-2 rounded-lg bg-blue-50 px-2 py-1 dark:bg-blue-900/20">
                      <span className="text-xs font-black uppercase tracking-wide text-blue-600">{subject} ({subjectQs.length})</span>
                    </div>
                    <div className="space-y-2">
                      {subjectQs.map(bq => {
                        const checked = bankSelected.has(bq.id);
                        return (
                          <div key={bq.id} onClick={() => { const n = new Set(bankSelected); if (n.has(bq.id)) n.delete(bq.id); else n.add(bq.id); setBankSelected(n); }}
                            className="cursor-pointer rounded-xl border-2 p-3 transition-all"
                            style={{ borderColor: checked ? "#2563eb" : "#e5e7eb", background: checked ? "#eff6ff" : "#fff" }}>
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
                                style={{ borderColor: checked ? "#2563eb" : "#d1d5db", background: checked ? "#2563eb" : "#fff" }}>
                                {checked && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold leading-tight text-gray-800 dark:text-gray-200">{bq.text}</p>
                                <div className="mt-1.5 grid grid-cols-2 gap-1">
                                  {[bq.optionA, bq.optionB, bq.optionC, bq.optionD].map((opt, i) => (
                                    <span key={i} className="truncate rounded px-2 py-0.5 text-xs"
                                      style={{
                                        background: bq.correctAnswer === ["A", "B", "C", "D"][i] ? "#dcfce7" : "#f3f4f6",
                                        color: bq.correctAnswer === ["A", "B", "C", "D"][i] ? "#15803d" : "#6b7280",
                                        fontWeight: bq.correctAnswer === ["A", "B", "C", "D"][i] ? "700" : "400",
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
              <div className="flex shrink-0 gap-2 border-t p-4">
                <button onClick={() => setBankOpen(false)} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">{ar ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankSelected} disabled={bankSelected.size === 0}
                  className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white disabled:opacity-40">
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setAssignOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
              dir={dir} onClick={e => e.stopPropagation()}>
              <div className="shrink-0 p-5 text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <h2 className="text-lg font-black">{ar ? "اختر واجباً" : "Select Assignment"}</h2>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20"><X className="h-5 w-5" /></button>
                </div>
                <p className="mt-1 text-xs text-white/80">{ar ? "اضغط على الواجب لاستيراد جميع أسئلته مباشرة" : "Tap an assignment to import all its questions"}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {assignLoading && <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" /></div>}
                {!assignLoading && assignments.length === 0 && <p className="py-12 text-center text-sm text-gray-400">{ar ? "لا توجد واجبات" : "No assignments"}</p>}
                {assignments.map(a => (
                  <motion.button key={a.id} whileTap={{ scale: 0.97 }}
                    onClick={() => importAllFromAssignment(a.id, a.title)}
                    disabled={assignImporting !== null}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-start transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    style={{ borderColor: "#f59e0b", background: assignImporting === a.id ? "#fef3c7" : "#fff" }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                      {assignImporting === a.id
                        ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                        : <FileText className="h-5 w-5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-800 dark:text-gray-100">{a.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                    </div>
                    <Check className="h-5 w-5 shrink-0 text-amber-500" />
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
