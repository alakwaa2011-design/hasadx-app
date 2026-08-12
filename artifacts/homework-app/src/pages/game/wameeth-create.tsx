import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAssignments,
  useGetCurrentTeacher,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import {
  ClassSelector,
  getRememberedTargetClass,
} from "@/components/teacher/class-selector";
import { WAMEETH_CLASS_SETUP_KEY } from "@/pages/game/wameeth-class";
import {
  QuestionCard, emptyQuestion, isValidQ, type Question,
} from "@/components/game/question-editor";
import {
  Zap,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  Plus,
  Sparkles,
  Link2,
  QrCode,
  Hash,
  School,
  PenLine,
  BookOpen,
  Check,
  X,
  User,
  UsersRound,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  subject?: string | null;
  targetClass?: string | null;
}

type QuestionSource = "assignment" | "ai" | "manual";
type Difficulty = "easy" | "medium" | "hard";
type PlayMode = "solo" | "teams" | "classroom";

// Wameedh entry point: prepare a set of questions (from an assignment, AI, or
// written manually), review it, then pick how to play — solo / teams / class
// mode — all three consuming the exact same prepared question list.
export default function WameethCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  const { data: user } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { data: assignments, isLoading } = useListAssignments(
    user ? { teacherId: user.id, include: "shared" } : undefined,
    { query: { enabled: !!user } as any },
  );

  // ─── Step 1: build & review the shared question set ─────────────────────
  const [step, setStep] = useState<"prepare" | "mode">("prepare");
  const [source, setSource] = useState<QuestionSource | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState("");
  // When the whole list still matches one untouched assignment, we can reuse
  // that assignment directly instead of persisting a new one at start time.
  const [sourceAssignmentId, setSourceAssignmentId] = useState<number | null>(null);

  // From existing assignment
  const [assignSearch, setAssignSearch] = useState("");
  const [loadingAssignmentId, setLoadingAssignmentId] = useState<number | null>(null);

  // AI generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ─── Step 2: play mode ────────────────────────────────────────────────────
  const [mode, setMode] = useState<PlayMode | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>(["", "", "", "", "", ""]);
  const [targetClass, setTargetClass] = useState<string>(() => getRememberedTargetClass());
  const [starting, setStarting] = useState(false);

  const resetSource = () => {
    setSource(null);
    setQuestions([]);
    setTitle("");
    setSourceAssignmentId(null);
    setAssignSearch("");
    setAiTopic("");
    setAiSubject("");
  };

  const filteredAssignments = (assignments || []).filter((a: Assignment) => {
    if ((a.questionCount ?? 0) === 0) return false;
    if (!assignSearch.trim()) return true;
    return a.title.toLowerCase().includes(assignSearch.toLowerCase());
  });

  // Fetch one assignment's questions, keep MCQ-complete ones only, and append
  // them (as editable rows) to the shared review list — the existing service.
  const addQuestionsFromAssignment = async (assignmentId: number, assignmentTitle: string) => {
    if (loadingAssignmentId !== null) return;
    const wasEmpty = questions.length === 0;
    setLoadingAssignmentId(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const added: Question[] = (data.questions || [])
        .filter((q: { questionType?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string }) =>
          q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)
        .map((q: { text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }) => ({
          ...emptyQuestion("mcq"),
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Question["correctAnswer"],
        }));
      if (added.length === 0) {
        toast.error(ar ? "لا توجد أسئلة اختيار متعدد صالحة في هذا الواجب" : "No valid MCQ questions in this assignment");
        return;
      }
      setQuestions(prev => [...prev, ...added]);
      setSourceAssignmentId(wasEmpty ? assignmentId : null);
      if (!title) setTitle(assignmentTitle);
      toast.success(ar ? `تمت إضافة ${added.length} سؤال` : `Added ${added.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "An error occurred");
    } finally {
      setLoadingAssignmentId(null);
    }
  };

  // Same AI endpoint used by the solo-challenge creator — always returns MCQ.
  const generateWithAI = async () => {
    if (!aiTopic.trim()) { toast.error(ar ? "أدخل الموضوع أولاً" : "Enter a topic first"); return; }
    setAiGenerating(true);
    try {
      const res = await fetch(`${API}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: aiTopic.trim(), subject: aiSubject.trim(), count: aiCount, difficulty: aiDifficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || (ar ? "فشل التوليد" : "Generation failed"));
      const generated: Question[] = (data.questions || []).map((q: any) => ({
        ...emptyQuestion("mcq"),
        text: q.text || "",
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Question["correctAnswer"],
      }));
      setQuestions(prev => [...prev, ...generated]);
      setSourceAssignmentId(null);
      if (!title) setTitle(aiTopic.trim());
      toast.success(ar ? `تم توليد ${generated.length} سؤال` : `Generated ${generated.length} questions`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "خطأ في التوليد" : "Generation error"));
    } finally {
      setAiGenerating(false);
    }
  };

  const addManualQuestion = () => {
    setQuestions(prev => [...prev, emptyQuestion("mcq")]);
    setSourceAssignmentId(null);
  };

  const updateQuestion = (i: number, updated: Question) => {
    setQuestions(prev => prev.map((x, j) => j === i ? updated : x));
    setSourceAssignmentId(null);
  };

  const deleteQuestion = (i: number) => {
    setQuestions(prev => prev.filter((_, j) => j !== i));
    setSourceAssignmentId(null);
  };

  const validQuestions = questions.filter(isValidQ);

  // Start the chosen mode using the exact same prepared question set,
  // regardless of where the questions came from.
  const startGame = async () => {
    if (starting || !mode) return;
    if (validQuestions.length < 2) {
      toast.error(ar ? "يحتاج سؤالين اختيار متعدد صالحين على الأقل" : "Needs at least 2 valid MCQ questions");
      return;
    }
    setStarting(true);

    if (mode === "classroom") {
      const qs = validQuestions.map(q => ({
        text: q.text,
        options: [q.optionA, q.optionB, q.optionC, q.optionD],
        correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer),
        imageUrl: null,
      }));
      sessionStorage.setItem(WAMEETH_CLASS_SETUP_KEY, JSON.stringify({ questions: qs, duration: 20, title: title || undefined }));
      setLocation("/game/wameeth/class");
      return;
    }

    // Solo / teams run on the classic PIN engine, which requires a real
    // assignmentId. Reuse the original one when untouched; otherwise persist
    // the current (edited/AI-generated/manual) set as a private assignment
    // first — same create-assignment API used across the app — so the
    // unchanged game-creation flow can pick it up exactly as it always has.
    try {
      let assignmentId = sourceAssignmentId;
      if (assignmentId == null) {
        const res = await fetch(`${API}/api/assignments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: title.trim() || (ar ? "وميض" : "Wameeth"),
            isShared: false,
            contentKind: "competition",
            questions: validQuestions.map(q => ({
              text: q.text,
              questionType: "mcq",
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctAnswer: q.correctAnswer,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || (ar ? "تعذّر تجهيز الأسئلة" : "Failed to prepare questions"));
        assignmentId = data.id;
      }

      const socket = getSocket();
      const validCustomNames = mode === "teams" ? customTeamNames.slice(0, teamCount).map(n => n.trim()) : undefined;
      const hasCustomNames = validCustomNames && validCustomNames.some(n => n.length > 0);
      socket.emit(
        "teacher:create-game",
        {
          assignmentId,
          gameMode: mode,
          teamCount: mode === "teams" ? teamCount : undefined,
          customTeamNames: hasCustomNames ? validCustomNames : undefined,
          targetClass: targetClass || undefined,
        },
        (res: { pin?: string; error?: string }) => {
          setStarting(false);
          if (res?.error || !res?.pin) {
            toast.error(res?.error || (ar ? "تعذّر بدء اللعبة" : "Failed to start the game"));
            disconnectSocket();
            return;
          }
          setLocation(`/teacher/game/${res.pin}`);
        },
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "An error occurred"));
      setStarting(false);
    }
  };

  // If the organizer is not logged in, send them to the login page with a
  // post-login redirect back here so they don't lose their place.
  useEffect(() => {
    if (!user && !isLoading) {
      const backTo = encodeURIComponent("/game/wameeth/create");
      setLocation(`/login?redirect=${backTo}`);
    }
  }, [user, isLoading, setLocation]);

  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-[calc(100vh-4rem)] py-8 sm:py-12"
        style={{
          background:
            "linear-gradient(180deg, #000503 0%, #010907 38%, #02140c 100%)",
        }}
      >
        <div className="container mx-auto px-4 max-w-3xl">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-bold mb-5 transition-colors"
          >
            <BackIcon className="w-4 h-4" />
            {ar ? "لوحة المنظّم" : "Organizer dashboard"}
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(10,58,34,0.9) 0%, rgba(4,30,18,0.95) 60%, rgba(2,14,9,1) 100%)",
              border: "1px solid rgba(212,166,58,0.35)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,166,58,0.08) inset",
            }}
          >
            {/* Gold glow orb */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: -80,
                [dir === "rtl" ? "left" : "right"]: -80,
                width: 260,
                height: 260,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(212,166,58,0.18) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(212,166,58,0.15)",
                  border: "1px solid rgba(212,166,58,0.45)",
                  boxShadow: "0 0 20px rgba(212,166,58,0.12)",
                }}
              >
                <Zap className="w-7 h-7" style={{ color: "#f4c95d" }} />
              </div>
              <div className="flex-1">
                <div
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full mb-2"
                  style={{
                    background: "rgba(212,166,58,0.12)",
                    border: "1px solid rgba(212,166,58,0.35)",
                  }}
                >
                  <Sparkles className="w-3 h-3" style={{ color: "#f4c95d" }} />
                  <span
                    className="text-[10px] font-bold tracking-wide"
                    style={{ color: "#f4c95d" }}
                  >
                    {ar ? "اللعبة الافتراضية" : "Default game"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {ar ? "وميض — لعبة مباشرة" : "Wameedh — Live Game"}
                </h1>
                <p className="text-white/75 text-sm mt-2 leading-relaxed">
                  {ar
                    ? "جهّز أسئلتك، ثم اختر طريقة اللعب: فردي أو فرق أو وميض الصف."
                    : "Prepare your questions, then pick how to play: solo, teams, or class mode."}
                </p>
                {/* Join method badges */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {[
                    { icon: Link2,  label: ar ? "رابط مباشر" : "Direct link" },
                    { icon: QrCode, label: ar ? "مسح الباركود" : "Scan QR" },
                    { icon: Hash,   label: ar ? "رمز PIN" : "PIN code" },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(244,201,93,0.10)",
                        border: "1px solid rgba(244,201,93,0.30)",
                      }}
                    >
                      <Icon className="w-3 h-3 shrink-0" style={{ color: "#f4c95d" }} />
                      <span
                        className="text-[11px] font-semibold tracking-wide"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Step progress */}
          <div className="flex items-center gap-2 mb-5 px-1">
            {[
              { key: "prepare", label: ar ? "١. الأسئلة" : "1. Questions" },
              { key: "mode", label: ar ? "٢. طريقة اللعب" : "2. Play mode" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px" style={{ background: "rgba(212,166,58,0.3)" }} />}
                <span
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                  style={
                    step === s.key
                      ? { background: "rgba(212,166,58,0.18)", color: "#f4c95d", border: "1px solid rgba(212,166,58,0.4)" }
                      : { color: "rgba(255,255,255,0.4)" }
                  }
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {step === "prepare" ? (
            <div className="pb-4">
              {/* Step 1a: choose how to build the question list */}
              <AnimatePresence mode="popLayout">
                {!source && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                  >
                    <p className="text-white/75 text-sm font-medium mb-4 text-center">
                      {ar ? "كيف تريد إضافة أسئلة وميض؟" : "How do you want to add questions?"}
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setSource("assignment")}
                        className="group p-5 rounded-2xl text-start transition-all hover:-translate-y-0.5"
                        style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.22)" }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(212,166,58,0.15)", border: "1px solid rgba(212,166,58,0.35)" }}>
                          <BookOpen className="w-5 h-5" style={{ color: "#f4c95d" }} />
                        </div>
                        <h3 className="font-black text-white text-sm mb-1">{ar ? "من واجب موجود" : "From an assignment"}</h3>
                        <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                          {ar ? "اختر واجباً وأضف أسئلته تلقائياً" : "Pick an assignment and add its questions"}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSource("ai")}
                        className="group p-5 rounded-2xl text-start transition-all hover:-translate-y-0.5"
                        style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.22)" }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(212,166,58,0.15)", border: "1px solid rgba(212,166,58,0.35)" }}>
                          <Sparkles className="w-5 h-5" style={{ color: "#f4c95d" }} />
                        </div>
                        <h3 className="font-black text-white text-sm mb-1">{ar ? "بالذكاء الاصطناعي" : "With AI"}</h3>
                        <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                          {ar ? "ولّد أسئلة اختيار متعدد تلقائياً" : "Auto-generate multiple-choice questions"}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSource("manual")}
                        className="group p-5 rounded-2xl text-start transition-all hover:-translate-y-0.5"
                        style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.22)" }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(212,166,58,0.15)", border: "1px solid rgba(212,166,58,0.35)" }}>
                          <PenLine className="w-5 h-5" style={{ color: "#f4c95d" }} />
                        </div>
                        <h3 className="font-black text-white text-sm mb-1">{ar ? "إضافة يدوية" : "Add manually"}</h3>
                        <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                          {ar ? "اكتب أسئلة اختيار متعدد من الصفر" : "Write multiple-choice questions from scratch"}
                        </p>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 1b: source-specific input + unified review */}
              {source && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetSource}
                      className="p-2 rounded-xl transition-colors text-white/70 hover:text-white"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <h2 className="font-black text-white text-base">
                      {source === "assignment"
                        ? (ar ? "من واجب موجود" : "From an assignment")
                        : source === "ai"
                          ? (ar ? "بالذكاء الاصطناعي" : "With AI")
                          : (ar ? "إضافة يدوية" : "Add manually")}
                    </h2>
                  </div>

                  {source === "assignment" && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,58,34,0.25)", border: "1px solid rgba(212,166,58,0.18)" }}>
                      <div className="relative p-3">
                        <Search
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                          style={{ [dir === "rtl" ? "right" : "left"]: 22 } as React.CSSProperties}
                        />
                        <input
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          placeholder={ar ? "ابحث في واجباتك…" : "Search your assignments…"}
                          className="w-full rounded-xl py-2.5 text-sm font-medium text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
                          style={{
                            background: "rgba(10,58,34,0.35)",
                            border: "1px solid rgba(212,166,58,0.18)",
                            paddingInlineStart: 36,
                            paddingInlineEnd: 12,
                          }}
                        />
                      </div>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-10 text-white/70">
                          <Loader2 className="w-5 h-5 animate-spin me-2" />
                          {ar ? "جاري التحميل…" : "Loading…"}
                        </div>
                      ) : filteredAssignments.length === 0 ? (
                        <p className="text-center text-white/60 py-10 text-sm font-medium">
                          {ar ? "لا توجد واجبات مطابقة" : "No matching assignments"}
                        </p>
                      ) : (
                        <div className="p-2 space-y-1.5 max-h-[340px] overflow-y-auto">
                          {filteredAssignments.map((a: Assignment) => (
                            <button
                              key={a.id}
                              type="button"
                              disabled={loadingAssignmentId !== null}
                              onClick={() => addQuestionsFromAssignment(a.id, a.title)}
                              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                              style={{ background: "rgba(255,255,255,0.04)" }}
                            >
                              <span className="text-sm font-bold text-white truncate">{a.title}</span>
                              {loadingAssignmentId === a.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-white/70 shrink-0" />
                              ) : (
                                <Plus className="w-4 h-4 shrink-0" style={{ color: "#f4c95d" }} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {source === "ai" && (
                    <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(10,58,34,0.25)", border: "1px solid rgba(212,166,58,0.18)" }}>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-white/80 mb-1.5">{ar ? "الموضوع *" : "Topic *"}</label>
                          <input
                            value={aiTopic}
                            onChange={e => setAiTopic(e.target.value)}
                            placeholder={ar ? "مثال: الجهاز الهضمي" : "e.g. Digestive system"}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
                            style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white/80 mb-1.5">{ar ? "المادة (اختياري)" : "Subject (optional)"}</label>
                          <input
                            value={aiSubject}
                            onChange={e => setAiSubject(e.target.value)}
                            placeholder={ar ? "مثال: علوم" : "e.g. Science"}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
                            style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-white/80 mb-1.5">{ar ? "العدد" : "Count"}</label>
                          <select
                            value={aiCount}
                            onChange={e => setAiCount(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white outline-none"
                            style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                          >
                            {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n} className="text-black">{n} {ar ? "أسئلة" : "questions"}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white/80 mb-1.5">{ar ? "المستوى" : "Difficulty"}</label>
                          <select
                            value={aiDifficulty}
                            onChange={e => setAiDifficulty(e.target.value as Difficulty)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white outline-none"
                            style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                          >
                            <option value="easy" className="text-black">{ar ? "سهل" : "Easy"}</option>
                            <option value="medium" className="text-black">{ar ? "متوسط" : "Medium"}</option>
                            <option value="hard" className="text-black">{ar ? "صعب" : "Hard"}</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={generateWithAI}
                        disabled={aiGenerating || !aiTopic.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)", color: "#1a1008" }}
                      >
                        {aiGenerating ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />{ar ? "جاري التوليد..." : "Generating..."}</>
                        ) : (
                          <><Sparkles className="w-4 h-4" />{questions.length > 0 ? (ar ? "توليد أسئلة إضافية" : "Generate more") : (ar ? "توليد الأسئلة الآن" : "Generate questions")}</>
                        )}
                      </button>
                    </div>
                  )}

                  {source === "manual" && questions.length === 0 && (
                    <div
                      className="rounded-2xl p-8 text-center transition-all cursor-pointer hover:brightness-110"
                      style={{ background: "rgba(10,58,34,0.25)", border: "1px dashed rgba(212,166,58,0.3)" }}
                      onClick={addManualQuestion}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(212,166,58,0.15)" }}>
                        <Plus className="w-6 h-6" style={{ color: "#f4c95d" }} />
                      </div>
                      <p className="font-bold text-white text-sm mb-1">{ar ? "أضف سؤالك الأول" : "Add your first question"}</p>
                      <p className="text-[11px] text-white/60">{ar ? "اضغط هنا للبدء" : "Click here to start"}</p>
                    </div>
                  )}

                  {/* Unified review list — edit/delete before choosing a play mode */}
                  {questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="font-black text-sm text-white flex items-center gap-2">
                          {ar ? "أسئلة وميض" : "Wameeth questions"}
                          <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: "rgba(212,166,58,0.18)", color: "#f4c95d" }}>{questions.length}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={addManualQuestion}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                          style={{ background: "rgba(212,166,58,0.15)", color: "#f4c95d" }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {ar ? "سؤال جديد" : "New question"}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <QuestionCard
                            key={i}
                            q={q}
                            index={i}
                            allowedTypes={["mcq"]}
                            showDifficulty={false}
                            showAudio={false}
                            onChange={updated => updateQuestion(i, updated)}
                            onDelete={() => deleteQuestion(i)}
                          />
                        ))}
                      </div>

                      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(10,58,34,0.3)", border: "1px solid rgba(212,166,58,0.22)" }}>
                        <div>
                          <label className="block text-xs font-bold text-white/80 mb-1.5">{ar ? "عنوان (اختياري)" : "Title (optional)"}</label>
                          <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={ar ? "يظهر في شاشة اللعبة..." : "Shown on the game screen..."}
                            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
                            style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep("mode")}
                          disabled={validQuestions.length < 2}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: "linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)", color: "#1a1008" }}
                        >
                          <Check className="w-4 h-4" />
                          {ar ? "التالي: اختر طريقة اللعب" : "Next: choose play mode"}
                        </button>
                        {validQuestions.length < 2 && (
                          <p className="text-[10px] text-center text-white/50 font-medium">
                            {ar ? "يحتاج سؤالين اختيار متعدد صالحين على الأقل" : "Needs at least 2 valid MCQ questions"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ) : (
            /* ─── Step 2: play mode ─────────────────────────────────────── */
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("prepare")}
                  className="p-2 rounded-xl transition-colors text-white/70 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <BackIcon className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-black text-white text-base">{ar ? "اختر طريقة اللعب" : "Choose play mode"}</h2>
                  <p className="text-[11px] text-white/50">
                    {ar ? `${validQuestions.length} سؤال جاهز` : `${validQuestions.length} questions ready`}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("solo")}
                  className="p-5 rounded-2xl text-center transition-all"
                  style={
                    mode === "solo"
                      ? { background: "rgba(212,166,58,0.18)", border: "2px solid #f4c95d" }
                      : { background: "rgba(10,58,34,0.35)", border: "2px solid rgba(212,166,58,0.22)" }
                  }
                >
                  <User className="w-7 h-7 mx-auto mb-2" style={{ color: "#f4c95d" }} />
                  <p className="font-black text-white text-sm">{ar ? "فردي" : "Solo"}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{ar ? "كل طالب يتنافس بمفرده" : "Every student competes alone"}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("teams")}
                  className="p-5 rounded-2xl text-center transition-all"
                  style={
                    mode === "teams"
                      ? { background: "rgba(212,166,58,0.18)", border: "2px solid #f4c95d" }
                      : { background: "rgba(10,58,34,0.35)", border: "2px solid rgba(212,166,58,0.22)" }
                  }
                >
                  <UsersRound className="w-7 h-7 mx-auto mb-2" style={{ color: "#f4c95d" }} />
                  <p className="font-black text-white text-sm">{ar ? "فرق" : "Teams"}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{ar ? "الطلاب يتوزعون على فرق" : "Students split into teams"}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("classroom")}
                  className="p-5 rounded-2xl text-center transition-all"
                  style={
                    mode === "classroom"
                      ? { background: "rgba(212,166,58,0.18)", border: "2px solid #f4c95d" }
                      : { background: "rgba(10,58,34,0.35)", border: "2px solid rgba(212,166,58,0.22)" }
                  }
                >
                  <School className="w-7 h-7 mx-auto mb-2" style={{ color: "#f4c95d" }} />
                  <p className="font-black text-white text-sm">{ar ? "وميض الصف" : "Class mode"}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{ar ? "فريقان على شاشتين بالسبورة" : "Two teams, split-screen board"}</p>
                </button>
              </div>

              {mode === "teams" && (
                <div className="rounded-2xl p-4 space-y-4" style={{ background: "rgba(10,58,34,0.25)", border: "1px solid rgba(212,166,58,0.18)" }}>
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-2 text-center">{ar ? "عدد الفرق" : "Number of teams"}</label>
                    <div className="flex justify-center gap-2">
                      {[2, 3, 4, 5, 6].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTeamCount(n)}
                          className="w-10 h-10 rounded-xl font-black text-sm transition-all"
                          style={
                            teamCount === n
                              ? { background: "#f4c95d", color: "#1a1008" }
                              : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/80 mb-2 text-center">{ar ? "أسماء الفرق (اختياري)" : "Team names (optional)"}</label>
                    <div className="space-y-2">
                      {Array.from({ length: teamCount }).map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          value={customTeamNames[i] || ""}
                          onChange={(e) => {
                            const next = [...customTeamNames];
                            next[i] = e.target.value;
                            setCustomTeamNames(next);
                          }}
                          placeholder={`${ar ? "الفريق" : "Team"} ${i + 1}`}
                          maxLength={20}
                          className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#f4c95d]/50"
                          style={{ background: "rgba(10,58,34,0.35)", border: "1px solid rgba(212,166,58,0.18)" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(mode === "solo" || mode === "teams") && (
                <ClassSelector
                  value={targetClass}
                  onChange={setTargetClass}
                  accent="#f4c95d"
                />
              )}

              <button
                type="button"
                onClick={startGame}
                disabled={!mode || starting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)", color: "#1a1008" }}
              >
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" fill="currentColor" />}
                {ar ? "ابدأ اللعبة" : "Start game"}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
