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
  Clock, Check, X, Loader2, FileText, BookOpen, Trash2, Search, Lock, KeyRound, LockKeyhole, Monitor, Smartphone, ChevronUp, ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { ESCAPE_CLASS_SETUP_KEY } from "@/lib/escape-engine";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { GameLibraryPublishChoice } from "@/components/game/game-library-publish-choice";
import { saveGameActivity } from "@/lib/saved-game-activities";
import { normalizeGameQuestion } from "@/lib/normalize-game-question";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GOLD = "#d9a521";

interface EscapeQuestion {
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
  questionType?: string | null;
}

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToEscape = (bq: BankQuestion): EscapeQuestion => ({
  text: bq.text,
  options: bq.questionType === "true_false"
    ? ["صح", "خطأ"]
    : [bq.optionA, bq.optionB, bq.optionC, bq.optionD].filter((option): option is string => !!option?.trim()),
  correct: bq.questionType === "true_false"
    ? (bq.correctAnswer === "false" || bq.correctAnswer === "B" ? 1 : 0)
    : correctAnswerToIndex(bq.correctAnswer),
  imageUrl: bq.imageUrl || null,
});

const savedSettings = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

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
  const [isShared, setIsShared] = useState(false);
  const [selectedSource, setSelectedSource] = useState<"bank" | "assignment" | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<"questions" | "settings">("questions");

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
    let active = true;
    const aid = new URLSearchParams(window.location.search).get("assignmentId");
    if (!aid) return () => { active = false; };
    const parsedId = parseInt(aid, 10);
    if (Number.isNaN(parsedId)) return () => { active = false; };
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/assignments/${parsedId}`, { credentials: "include" });
        if (!active || !r.ok) return;
        const data = await r.json();
        if (!active) return;
        const qs = ((data.questions || []) as any[])
          .flatMap(q => {
            const normalized = normalizeGameQuestion(q, { trueLabel: ar ? "صح" : "True", falseLabel: ar ? "خطأ" : "False" });
            return normalized ? [{
              text: normalized.text,
              options: normalized.options,
              correct: normalized.correct,
              imageUrl: normalized.imageUrl,
            }] : [];
          })
          .slice(0, 30);
        if (qs.length > 0) {
          setQuestions(qs);
          setSelectedSource("assignment");
          if (typeof data.title === "string" && data.title.trim()) setSourceTitle(data.title.trim());
          setSetupStep("settings");
          toast.success(ar ? `تم تحميل ${qs.length} سؤال!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
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
        setBankQuestions(data.filter((q: BankQuestion) =>
          !!q.correctAnswer && (
            q.questionType === "true_false"
            || [q.optionA, q.optionB, q.optionC, q.optionD].filter(option => !!option?.trim()).length >= 2
          )));
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
      const qs = (data.questions || []).flatMap((q: any) => {
        const normalized = normalizeGameQuestion(q, { trueLabel: ar ? "صح" : "True", falseLabel: ar ? "خطأ" : "False" });
        return normalized ? [{
          text: normalized.text,
          options: normalized.options,
          correct: normalized.correct,
          imageUrl: normalized.imageUrl,
        }] : [];
      });
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار أو صح وخطأ في هذا الواجب" : "No choice or true/false questions found"); return; }
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

  const persistActivity = () => saveGameActivity({
    gameType: "escape",
    title: sourceTitle?.trim() || (ar ? "غرفة الهروب" : "Escape Room"),
    questions,
    settings: {
      totalTime: totalMinutes * 60,
      lockCount: Math.min(lockCount, questions.length),
      hints,
    },
    source: selectedSource || "game-launch",
    isShared,
  });

  const requireQuestions = () => {
    if (questions.length < 3) {
      toast.error(ar ? "غرفة الهروب تحتاج 3 أسئلة على الأقل" : "The escape room needs at least 3 questions");
      return false;
    }
    return true;
  };

  const startClassMode = async () => {
    if (!requireQuestions()) return;
    try {
      await persistActivity();
      sessionStorage.setItem(ESCAPE_CLASS_SETUP_KEY, JSON.stringify(buildSetup()));
    } catch {
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
    setLocation("/game/escape/class");
  };

  const startDeviceMode = async () => {
    if (!requireQuestions()) return;
    setCreating(true);
    try {
      await persistActivity();
    } catch {
      setCreating(false);
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
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

  if (setupStep === "questions") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#faf8f0] px-4 py-8 sm:px-6 sm:py-10" dir={dir}>
          <div className="mx-auto mb-4 max-w-5xl">
            <GameFlowBackButton onBack={() => setLocation("/")} />
          </div>
          <UnifiedQuestionSourceFlow
            gameTitle={ar ? "أنشئ غرفة الهروب" : "Create Escape Room"}
            gameDescription={ar ? "حضّر الأسئلة أولاً، ثم اضبط الغرفة وابدأ التحدي." : "Prepare questions, configure the room, then start."}
            gameIcon={<LockKeyhole className="h-8 w-8 text-[#8a6515]" />}
            accentColor="#8a6515"
            floatingAssignmentContinue
            minQuestions={3}
            maxQuestions={30}
            onComplete={({ questions: prepared, sourceTitle: title, source, savedActivity }) => {
              setQuestions(prepared);
              setSourceTitle(title);
              setSelectedSource(source === "bank" ? "bank" : "assignment");
              if (source === "saved" && savedActivity?.gameType === "escape") {
                const settings = savedSettings(savedActivity.settings);
                if (settings) {
                  if (typeof settings.totalTime === "number"
                    && Number.isInteger(settings.totalTime / 60)
                    && settings.totalTime >= 2 * 60
                    && settings.totalTime <= 30 * 60) {
                    setTotalMinutes(settings.totalTime / 60);
                  }
                  if ([2, 3, 4, 5, 6].includes(settings.lockCount as number)) {
                    setLockCount(settings.lockCount as number);
                  }
                  if ([0, 1, 2, 3].includes(settings.hints as number)) {
                    setHints(settings.hints as number);
                  }
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
      <div className="min-h-screen" dir={dir} style={{ background: "#faf7ef" }}>

        {/* ══ HERO — vault door in warm darkness ══ */}
        <div className="relative overflow-hidden"
          style={{ background: "linear-gradient(180deg, #131c33 0%, #1b2742 55%, #faf7ef 100%)" }}>
          <div className="absolute start-4 top-4 z-10 sm:start-8">
            <GameFlowBackButton
              onBack={() => setSetupStep("questions")}
              className="border-white/20 bg-white/95 text-slate-700 hover:bg-white"
            />
          </div>
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
              className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border-2 border-amber-300/40 text-amber-300"
              style={{ background: "rgba(247,201,72,0.1)", boxShadow: "0 0 42px rgba(247,201,72,0.3)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-1 text-3xl font-black text-white sm:text-4xl"
              style={{ textShadow: "0 0 26px rgba(247,201,72,0.35)" }}>
              {ar ? "غرفة الهروب" : "Escape Room"}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-sm font-bold text-amber-100/70 sm:text-base">
              {ar
                ? "غرفة هروب تعليمية: فكّكوا الأقفال بالإجابات الصحيحة واهربوا قبل انتهاء الوقت!"
                : "An educational escape room: break the locks with correct answers and escape before time runs out!"}
            </motion.p>
            {sourceTitle && (
              <p className="mt-2 text-sm font-black text-white">
                {sourceTitle} · {questions.length} {ar ? "أسئلة" : "questions"}
              </p>
            )}
            {/* Lock types strip */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01"/></svg>, t: ar ? "قفل الأرقام" : "Number Lock" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>, t: ar ? "شبكة الليزر" : "Laser Grid" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M4 9a2 2 0 0 1-2-2V4h6v3a2 2 0 0 1-2 2Z"/><path d="M4 15a2 2 0 0 0-2 2v3h6v-3a2 2 0 0 0-2-2Z"/><path d="M18 9a2 2 0 0 0 2-2V4h-6v3a2 2 0 0 0 2 2Z"/><path d="M18 15a2 2 0 0 1 2 2v3h-6v-3a2 2 0 0 1 2-2Z"/><path d="M8 5.5h8"/><path d="M8 18.5h8"/><path d="M6 9v6"/><path d="M18 9v6"/></svg>, t: ar ? "لوحة الأسلاك" : "Wire Panel" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M10 2h4M12 14v4M12 22v-2M18 20V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16Z"/><circle cx="12" cy="10" r="3"/></svg>, t: ar ? "بوابة الخروج" : "Exit Door" },
              ].map((l) => (
                <span key={l.t} className="flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-black/25 px-3 py-1.5 text-xs font-black text-amber-100/85 backdrop-blur-sm">
                  <span className="text-sm">{l.icon}</span>{l.t}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ══ MAIN ══ */}
        <div className="mx-auto max-w-3xl px-4 py-7 pb-10 sm:px-6">
          <div className="mb-6 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-2xl border border-[#0B4B35]/10 bg-white px-3 py-2 shadow-sm">
              <span className="rounded-xl px-3 py-1.5 text-xs font-bold text-[#0B4B35]">{ar ? "الأسئلة" : "Questions"}</span>
              <span className="h-px w-4 bg-[#0B4B35]/20" />
              <span className="rounded-xl bg-[#0B4B35]/10 px-3 py-1.5 text-xs font-black text-[#0B4B35] ring-1 ring-[#0B4B35]/20">{ar ? "الإعدادات" : "Settings"}</span>
              <span className="h-px w-4 bg-[#0B4B35]/20" />
              <span className="rounded-xl px-3 py-1.5 text-xs font-bold text-gray-400">{ar ? "البدء" : "Start"}</span>
            </div>
          </div>

          <div className="space-y-5">
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="rounded-3xl border border-[#0B4B35]/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h2 className="text-lg font-black text-gray-900">{ar ? "إعدادات غرفة الهروب" : "Escape Room settings"}</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">{ar ? "اختر إعدادات الجولة بما يناسب صفك." : "Set up the round to suit your class."}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <section className="rounded-2xl border border-[#0B4B35]/10 bg-[#0B4B35]/[0.025] p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B4B35]/10 text-[#0B4B35]"><Clock className="h-4 w-4" /></span>
                    <div>
                      <h3 className="text-sm font-black text-gray-800">{ar ? "زمن الهروب" : "Escape time"}</h3>
                      <p className="text-xs font-medium text-gray-500">{ar ? "الوقت الكلي للجولة" : "Total time for the round"}</p>
                    </div>
                  </div>
                  <div className="flex min-h-11 overflow-hidden rounded-xl border border-[#0B4B35]/15 bg-white text-[#0B4B35] focus-within:border-[#0B4B35] focus-within:ring-2 focus-within:ring-[#0B4B35]/15">
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={totalMinutes}
                      onChange={e => {
                        const value = e.target.valueAsNumber;
                        if (Number.isFinite(value)) setTotalMinutes(value);
                      }}
                      onBlur={() => setTotalMinutes(current => Math.max(2, Math.min(30, current)))}
                      className="min-w-0 flex-1 bg-transparent px-3 text-center text-sm font-black outline-none"
                      aria-label={ar ? "زمن الهروب بالدقائق" : "Escape time in minutes"}
                    />
                    <div className="flex w-10 shrink-0 flex-col border-s border-[#0B4B35]/15">
                      <button type="button" onClick={() => setTotalMinutes(current => Math.min(30, current + 1))}
                        disabled={totalMinutes >= 30}
                        className="flex flex-1 items-center justify-center border-b border-[#0B4B35]/15 transition hover:bg-[#0B4B35]/5 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={ar ? "زيادة الوقت" : "Increase time"}>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setTotalMinutes(current => Math.max(2, current - 1))}
                        disabled={totalMinutes <= 2}
                        className="flex flex-1 items-center justify-center transition hover:bg-[#0B4B35]/5 disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={ar ? "تقليل الوقت" : "Decrease time"}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="flex items-center border-s border-[#0B4B35]/15 px-3 text-xs font-bold text-[#0B4B35]/70">{ar ? "دقيقة" : "min"}</span>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#0B4B35]/10 bg-white p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d9a521]/15 text-[#8a6515]"><Lock className="h-4 w-4" /></span>
                    <div>
                      <h3 className="text-sm font-black text-gray-800">{ar ? "عدد الأقفال" : "Locks"}</h3>
                      <p className="text-xs font-medium text-gray-500">{ar ? "مراحل الهروب" : "Escape stages"}</p>
                    </div>
                  </div>
                  <select value={lockCount} onChange={e => setLockCount(Number(e.target.value))}
                    className="min-h-11 w-full rounded-xl border border-[#0B4B35]/15 bg-white px-3 text-sm font-black text-[#0B4B35] outline-none transition focus:border-[#0B4B35] focus:ring-2 focus:ring-[#0B4B35]/15"
                    aria-label={ar ? "عدد الأقفال" : "Lock count"}>
                    {[2, 3, 4, 5, 6].map(count => (
                      <option key={count} value={count}>{count} {ar ? "أقفال" : "locks"}</option>
                    ))}
                  </select>
                </section>

                <section className="rounded-2xl border border-[#0B4B35]/10 bg-white p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><KeyRound className="h-4 w-4" /></span>
                    <div>
                      <h3 className="text-sm font-black text-gray-800">{ar ? "مفاتيح المساعدة" : "Hint keys"}</h3>
                        <p className="text-xs font-medium text-gray-500">{ar ? "تزيل حتى خيارين خاطئين" : "Removes up to two wrong answers"}</p>
                    </div>
                  </div>
                  <select value={hints} onChange={e => setHints(Number(e.target.value))}
                    className="min-h-11 w-full rounded-xl border border-[#0B4B35]/15 bg-white px-3 text-sm font-black text-[#0B4B35] outline-none transition focus:border-[#0B4B35] focus:ring-2 focus:ring-[#0B4B35]/15"
                    aria-label={ar ? "مفاتيح المساعدة" : "Hint keys"}>
                    {[0, 1, 2, 3].map(count => (
                      <option key={count} value={count}>{count} {ar ? "مفاتيح" : "keys"}</option>
                    ))}
                  </select>
                </section>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <span className="mt-0.5 text-base">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-red-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </span>
                <p className="text-xs font-bold leading-relaxed">{ar ? "كل إجابة خاطئة تُطلق الإنذار وتخصم 15 ثانية من وقت الهروب." : "Every wrong answer trips the alarm and burns 15 seconds of escape time."}</p>
              </div>
            </motion.section>

            <GameLibraryPublishChoice isShared={isShared} onChange={setIsShared} />
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <div className="mb-3">
                <h2 className="text-lg font-black text-gray-900">{ar ? "طريقة اللعب" : "How to play"}</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">{ar ? "اختر كيف سيخوض طلابك التحدي." : "Choose how your students will take on the challenge."}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={startClassMode} disabled={!ready}
                  className="group relative flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-3xl bg-[#0B4B35] p-6 text-center text-white shadow-[0_12px_28px_rgba(11,75,53,0.25)] transition hover:bg-[#083d2c] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="absolute -end-4 -top-5 h-24 w-24 text-white/[0.08]"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white"><Monitor className="h-5 w-5" /></span>
                  <span className="mt-3 max-w-xs">
                    <span className="block text-lg font-black">{ar ? "وضع الصف" : "Class mode"}</span>
                    <span className="mt-1 block text-sm font-medium leading-relaxed text-white/80">{ar ? "شاشة واحدة، والصف كله يتعاون للإجابة." : "One display, with the whole class answering together."}</span>
                  </span>
                </motion.button>

                <motion.button type="button" whileTap={{ scale: 0.99 }} onClick={startDeviceMode} disabled={creating || !ready}
                  className="flex min-h-44 flex-col items-center justify-center rounded-3xl border-2 border-[#0B4B35]/15 bg-white p-6 text-center text-[#0B4B35] shadow-sm transition hover:border-[#0B4B35]/35 hover:bg-[#0B4B35]/[0.025] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B4B35]/10"><Smartphone className="h-5 w-5" /></span>
                  <span className="mt-3 max-w-xs">
                    <span className="flex items-center justify-center gap-2 text-lg font-black">{creating && <Loader2 className="h-4 w-4 animate-spin" />}{creating ? (ar ? "جاري إنشاء الغرفة..." : "Creating room...") : (ar ? "وضع الأجهزة" : "Device mode")}</span>
                    <span className="mt-1 block text-sm font-medium leading-relaxed text-slate-500">{ar ? "كل طالب يلعب ويجيب على الأسئلة من جهازه." : "Each student plays and answers from their own device."}</span>
                  </span>
                </motion.button>
              </div>
            </motion.section>
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
