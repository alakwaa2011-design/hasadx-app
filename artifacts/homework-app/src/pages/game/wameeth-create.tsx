import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAssignments,
  useGetCurrentTeacher,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  ClassSelector,
  getRememberedTargetClass,
} from "@/components/teacher/class-selector";
import { WAMEETH_CLASS_SETUP_KEY } from "@/pages/game/wameeth-class";
import {
  QuestionCard, emptyQuestion, isValidQ, type Question, type Correct,
} from "@/components/game/question-editor";
import {
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Plus,
  Sparkles,
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
  const BackIcon = ar ? ChevronRight : ChevronLeft;

  const { data: user, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { data: assignments, isLoading: assignmentsLoading } = useListAssignments(
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

  // From existing assignment (single-select, like the solo-challenge creator)
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

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

  // If the organizer is not logged in, send them to the login page with a
  // post-login redirect back here so they don't lose their place.
  useEffect(() => {
    if (!authLoading && !user) {
      const backTo = encodeURIComponent("/game/wameeth/create");
      setLocation(`/login?redirect=${backTo}`);
    }
  }, [user, authLoading, setLocation]);

  const resetSource = () => {
    setSource(null);
    setQuestions([]);
    setTitle("");
    setSourceAssignmentId(null);
    setSelectedAssignment(null);
    setAssignSearch("");
    setAiTopic("");
    setAiSubject("");
  };

  const filteredAssignments = (assignments || []).filter((a: Assignment) => {
    if ((a.questionCount ?? 0) === 0) return false;
    if (!assignSearch.trim()) return true;
    return a.title.toLowerCase().includes(assignSearch.toLowerCase());
  });

  // Map one backend question row (mcq / true_false / fill_blank) into the
  // shared editable `Question` shape used across the review list.
  const fromBackendQuestion = (q: {
    text: string; questionType?: string;
    optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string;
  }): Question | null => {
    const qt = q.questionType || "mcq";
    if (qt === "true_false") {
      if (q.correctAnswer !== "true" && q.correctAnswer !== "false") return null;
      return { ...emptyQuestion("tf"), text: q.text, correctAnswer: q.correctAnswer === "true" ? "A" : "B" };
    }
    if (qt === "fill_blank") {
      if (!q.correctAnswer) return null;
      const parts = q.correctAnswer.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      return { ...emptyQuestion("fill_blank"), text: q.text, fillAnswer: parts[0], closeAnswers: parts.slice(1).join(", ") };
    }
    if (!(q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)) return null;
    return {
      ...emptyQuestion("mcq"),
      text: q.text,
      optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
      correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
    };
  };

  // Single-select an assignment (like the solo-challenge creator) and load its
  // full question set — the existing "from an assignment" service — into the
  // shared, editable review list.
  const handleSelectAssignment = async (a: Assignment) => {
    if (loadingAssignment) return;
    setSelectedAssignment(a);
    setLoadingAssignment(true);
    try {
      const res = await fetch(`${API}/api/assignments/${a.id}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const loaded = ((data.questions || []) as any[]).map(fromBackendQuestion).filter((q): q is Question => q !== null);
      if (loaded.length === 0) {
        toast.error(ar ? "لا توجد أسئلة مدعومة في هذا الواجب" : "No supported questions in this assignment");
        return;
      }
      setQuestions(loaded);
      setSourceAssignmentId(a.id);
      if (!title) setTitle(a.title);
      toast.success(ar ? `تم استيراد ${loaded.length} سؤال` : `Imported ${loaded.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "An error occurred");
    } finally {
      setLoadingAssignment(false);
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
        correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
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
  // وميض الصف only supports tap-to-pick options on screen — fill-in-the-blank
  // has no free-text input there, so it is excluded from that mode only.
  const classroomEligible = validQuestions.filter(q => q.type !== "fill_blank");

  // Start the chosen mode using the exact same prepared question set,
  // regardless of where the questions came from.
  const startGame = async () => {
    if (starting || !mode) return;
    if (validQuestions.length < 2) {
      toast.error(ar ? "أضف سؤالين صالحين على الأقل" : "Add at least 2 valid questions");
      return;
    }
    if (mode === "classroom" && classroomEligible.length < 2) {
      toast.error(ar
        ? "وميض الصف يدعم فقط اختيار متعدد وصح/خطأ — أضف سؤالين على الأقل من هذين النوعين"
        : "Class mode only supports MCQ and true/false — add at least 2 of those types");
      return;
    }
    setStarting(true);

    if (mode === "classroom") {
      const qs = classroomEligible.map(q => q.type === "tf"
        ? { text: q.text, options: [ar ? "صح" : "True", ar ? "خطأ" : "False"], correct: q.correctAnswer === "A" ? 0 : 1, imageUrl: null }
        : { text: q.text, options: [q.optionA, q.optionB, q.optionC, q.optionD], correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer), imageUrl: null });
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
            questions: validQuestions.map(q => {
              if (q.type === "fill_blank") {
                // Build pipe-separated accepted-answers string for the game engine
                const alternatives = q.closeAnswers.split(",").map(s => s.trim()).filter(Boolean);
                const allAnswers = [q.fillAnswer.trim(), ...alternatives].join("|");
                return { text: q.text, questionType: "fill_blank", correctAnswer: allAnswers, optionA: "", optionB: "", optionC: "", optionD: "" };
              }
              if (q.type === "tf") {
                // The classic game engine expects "true"/"false" (not "A"/"B") for true_false answers.
                return { text: q.text, questionType: "true_false", correctAnswer: q.correctAnswer === "A" ? "true" : "false", optionA: ar ? "صح" : "True", optionB: ar ? "خطأ" : "False", optionC: "", optionD: "" };
              }
              return { text: q.text, questionType: "mcq", optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctAnswer: q.correctAnswer };
            }),
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-4 lg:py-5 flex items-center gap-4">
          <Link href="/teacher/games" className="p-2 lg:p-2.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <BackIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </Link>
          <div className="flex items-center gap-3 lg:gap-3.5">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
              <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
            </div>
            <h1 className="text-lg lg:text-xl font-black text-foreground tracking-tight">{ar ? "وميض" : "Wameedh"}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
        {/* Step progress */}
        <div className="flex items-center gap-2 px-1">
          {[
            { key: "prepare", label: ar ? "١. الأسئلة" : "1. Questions" },
            { key: "mode", label: ar ? "٢. طريقة اللعب" : "2. Play mode" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <span className={cn(
                "text-[11px] lg:text-xs font-extrabold px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full border",
                step === s.key ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-transparent",
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {step === "prepare" ? (
          <>
            {/* Step 1a: choose how to build the question list */}
            <AnimatePresence mode="popLayout">
              {!source && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 lg:space-y-8 max-w-3xl lg:max-w-5xl mx-auto mt-4 lg:mt-6">
                  <div className="text-center space-y-2 lg:space-y-3 mb-2">
                    <h2 className="text-2xl lg:text-3xl font-black text-foreground">{ar ? "كيف تريد إضافة أسئلة وميض؟" : "How do you want to add Wameedh questions?"}</h2>
                    <p className="text-sm lg:text-base text-muted-foreground font-medium">{ar ? "اختر الطريقة الأنسب لتجهيز الأسئلة" : "Choose the best way to prepare your questions"}</p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 lg:gap-6">
                    <button
                      type="button"
                      onClick={() => setSource("assignment")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-primary/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-primary/10 shadow-sm relative z-10">
                        <BookOpen className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "من واجب موجود" : "From an assignment"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "اختر واجباً من مكتبتك واستورد أسئلته مباشرة" : "Pick an assignment from your library and import its questions"}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource("ai")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-amber-500/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-amber-500/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-amber-500/10 shadow-sm relative z-10">
                        <Sparkles className="w-6 h-6 lg:w-7 lg:h-7 text-amber-500" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "بالذكاء الاصطناعي" : "With AI"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "أنشئ أسئلة اختيار متعدد تلقائياً في أي موضوع" : "Auto-generate multiple-choice questions on any topic"}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource("manual")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-emerald-500/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-emerald-500/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-emerald-500/10 shadow-sm relative z-10">
                        <PenLine className="w-6 h-6 lg:w-7 lg:h-7 text-emerald-600" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "إضافة يدوية" : "Add manually"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "اكتب أسئلتك من الصفر — اختيار متعدد، صح وخطأ، أو أملأ الفراغ" : "Write your own questions — MCQ, true/false, or fill-in-the-blank"}</p>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 1b: source-specific input + unified review */}
            {source && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8">
                <div className="flex items-center gap-3 lg:gap-4 mb-2">
                  <button type="button" onClick={resetSource} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                  <div>
                    <h2 className="font-black text-xl lg:text-2xl text-foreground">
                      {source === "assignment" ? (ar ? "اختيار واجب" : "Choose an assignment")
                        : source === "ai" ? (ar ? "ذكاء اصطناعي" : "AI generation")
                        : (ar ? "إضافة يدوية" : "Add manually")}
                    </h2>
                    <p className="text-xs lg:text-sm text-muted-foreground font-medium">
                      {source === "assignment" ? (ar ? "سيتم استيراد أسئلة الواجب لتستخدمها في وميض" : "The assignment's questions will be imported for Wameedh")
                        : source === "ai" ? (ar ? "ولّد أسئلة جديدة تلقائياً ثم عدّلها كما تشاء" : "Generate new questions automatically, then edit as needed")
                        : (ar ? "اكتب الأسئلة والخيارات بنفسك خطوة بخطوة" : "Write the questions and options yourself, step by step")}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:gap-8 items-start">
                  {/* Main content */}
                  <div className="space-y-6 lg:space-y-7 order-2 md:order-1">
                    {source === "assignment" && (
                      <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden p-1">
                        <div className="p-4 lg:p-5 border-b border-border/40">
                          <div className="relative">
                            <Search className="absolute top-1/2 -translate-y-1/2 end-4 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground pointer-events-none" />
                            <input
                              value={assignSearch}
                              onChange={e => setAssignSearch(e.target.value)}
                              placeholder={ar ? "ابحث في واجباتك المحفوظة..." : "Search your saved assignments..."}
                              className="w-full pe-12 ps-4 py-3.5 lg:py-4 rounded-2xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/20 text-sm lg:text-base font-bold transition-all"
                            />
                          </div>
                        </div>
                        {assignmentsLoading ? (
                          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : filteredAssignments.length === 0 ? (
                          <p className="text-center text-muted-foreground py-16 text-sm lg:text-base font-medium">{ar ? "لا توجد واجبات مطابقة" : "No matching assignments"}</p>
                        ) : (
                          <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5 max-h-[400px] lg:max-h-[460px] overflow-y-auto">
                            {filteredAssignments.map((a: Assignment) => (
                              <button
                                key={a.id}
                                type="button"
                                disabled={loadingAssignment}
                                onClick={() => handleSelectAssignment(a)}
                                className={cn(
                                  "w-full text-start px-5 lg:px-6 py-4 lg:py-5 rounded-2xl border-2 transition-all group disabled:opacity-60",
                                  selectedAssignment?.id === a.id ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-background hover:bg-muted/50 hover:border-border",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className={cn("font-bold text-sm lg:text-base truncate", selectedAssignment?.id === a.id ? "text-primary" : "text-foreground group-hover:text-primary")}>{a.title}</p>
                                  {loadingAssignment && selectedAssignment?.id === a.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                                  ) : selectedAssignment?.id === a.id ? (
                                    <Check className="w-5 h-5 text-primary shrink-0" />
                                  ) : null}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {source === "ai" && (
                      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 sm:p-6 lg:p-8 shadow-sm">
                        <div className="flex items-center gap-2 lg:gap-3 mb-5 lg:mb-6">
                          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600" />
                          </div>
                          <h3 className="font-black text-base lg:text-lg text-amber-900 dark:text-amber-400">{ar ? "توليد الأسئلة" : "Generate questions"}</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "الموضوع *" : "Topic *"}</label>
                            <input
                              value={aiTopic}
                              onChange={e => setAiTopic(e.target.value)}
                              placeholder={ar ? "مثال: الجهاز الهضمي" : "e.g. Digestive system"}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "المادة (اختياري)" : "Subject (optional)"}</label>
                            <input
                              value={aiSubject}
                              onChange={e => setAiSubject(e.target.value)}
                              placeholder={ar ? "مثال: علوم" : "e.g. Science"}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:gap-5 mb-5 lg:mb-6">
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "العدد" : "Count"}</label>
                            <select
                              value={aiCount}
                              onChange={e => setAiCount(Number(e.target.value))}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                            >
                              {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} {ar ? "أسئلة" : "questions"}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "المستوى" : "Difficulty"}</label>
                            <select
                              value={aiDifficulty}
                              onChange={e => setAiDifficulty(e.target.value as Difficulty)}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                            >
                              <option value="easy">{ar ? "سهل" : "Easy"}</option>
                              <option value="medium">{ar ? "متوسط" : "Medium"}</option>
                              <option value="hard">{ar ? "صعب" : "Hard"}</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={generateWithAI}
                          disabled={aiGenerating || !aiTopic.trim()}
                          className="w-full flex items-center justify-center gap-2 py-3.5 lg:py-4 rounded-xl font-black text-sm lg:text-base bg-gradient-to-l from-amber-500 to-orange-400 hover:from-amber-600 hover:to-orange-500 text-white transition-all disabled:opacity-50 shadow-md hover:shadow-amber-500/25 active:scale-95"
                        >
                          {aiGenerating ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جاري التوليد..." : "Generating..."}</>
                          ) : (
                            <><Sparkles className="w-5 h-5" />{questions.length > 0 ? (ar ? "توليد أسئلة إضافية" : "Generate more") : (ar ? "توليد الأسئلة الآن" : "Generate questions")}</>
                          )}
                        </button>
                      </div>
                    )}

                    {source === "manual" && questions.length === 0 && (
                      <div
                        className="bg-card border-2 border-dashed border-border/60 rounded-3xl p-10 lg:p-14 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                        onClick={addManualQuestion}
                      >
                        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 lg:mb-5 group-hover:bg-primary/10 transition-colors">
                          <Plus className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <p className="font-bold text-foreground text-lg lg:text-xl mb-1 lg:mb-1.5 group-hover:text-primary">{ar ? "أضف سؤالك الأول" : "Add your first question"}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground">{ar ? "اضغط هنا للبدء في إضافة الأسئلة يدوياً" : "Click here to start adding questions manually"}</p>
                      </div>
                    )}

                    {/* Unified review list — edit/delete before choosing a play mode */}
                    {questions.length > 0 && (
                      <div className="space-y-4 lg:space-y-5">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="font-black text-lg lg:text-xl text-foreground flex items-center gap-2">
                            {ar ? "أسئلة وميض" : "Wameedh questions"}
                            <span className="bg-muted px-2.5 py-0.5 rounded-md text-sm">{questions.length}</span>
                          </h3>
                          <button
                            type="button"
                            onClick={addManualQuestion}
                            className="flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            {ar ? "سؤال جديد" : "New question"}
                          </button>
                        </div>
                        <div className="space-y-3 lg:space-y-4">
                          {questions.map((q, i) => (
                            <QuestionCard
                              key={i}
                              q={q}
                              index={i}
                              showDifficulty={false}
                              showAudio={false}
                              onChange={updated => updateQuestion(i, updated)}
                              onDelete={() => deleteQuestion(i)}
                            />
                          ))}
                        </div>
                        {questions.length > 2 && (
                          <button
                            type="button"
                            onClick={addManualQuestion}
                            className="w-full py-5 lg:py-6 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors font-bold lg:text-base flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5" /> {ar ? "أضف سؤالاً آخر" : "Add another question"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="order-1 md:order-2 space-y-5 md:sticky md:top-24">
                    <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-5 lg:space-y-6">
                      <div>
                        <label className="block text-sm lg:text-base font-bold text-foreground mb-2 lg:mb-2.5">{ar ? "عنوان (اختياري)" : "Title (optional)"}</label>
                        <input
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder={ar ? "يظهر في شاشة اللعبة..." : "Shown on the game screen..."}
                          className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all shadow-inner"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("mode")}
                        disabled={validQuestions.length < 2}
                        className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 active:scale-95 disabled:opacity-50"
                      >
                        <Check className="w-5 h-5" />
                        {ar ? "التالي: اختر طريقة اللعب" : "Next: choose play mode"}
                      </button>
                      {validQuestions.length < 2 && (
                        <p className="text-[10px] lg:text-xs text-center text-muted-foreground font-medium px-2">
                          {ar ? "أضف سؤالين صالحين على الأقل قبل المتابعة" : "Add at least 2 valid questions to continue"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          /* ─── Step 2: play mode ─────────────────────────────────────── */
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8 max-w-3xl lg:max-w-4xl mx-auto">
            <div className="flex items-center gap-3 lg:gap-4 mb-2">
              <button type="button" onClick={() => setStep("prepare")} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <BackIcon className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div>
                <h2 className="font-black text-xl lg:text-2xl text-foreground">{ar ? "اختر طريقة اللعب" : "Choose play mode"}</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">{ar ? `${validQuestions.length} سؤال جاهز` : `${validQuestions.length} questions ready`}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 lg:gap-6">
              <button
                type="button"
                onClick={() => setMode("solo")}
                className={cn(
                  "p-5 lg:p-7 rounded-2xl border-2 text-center transition-all",
                  mode === "solo" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm" : "border-border bg-card hover:border-blue-300",
                )}
              >
                <User className={cn("w-7 h-7 lg:w-8 lg:h-8 mx-auto mb-2 lg:mb-3", mode === "solo" ? "text-blue-600" : "text-muted-foreground")} />
                <p className="font-black text-foreground text-sm lg:text-base">{ar ? "فردي" : "Solo"}</p>
                <p className="text-[11px] lg:text-xs text-muted-foreground mt-0.5 lg:mt-1">{ar ? "كل طالب يتنافس بمفرده" : "Every student competes alone"}</p>
              </button>

              <button
                type="button"
                onClick={() => setMode("teams")}
                className={cn(
                  "p-5 lg:p-7 rounded-2xl border-2 text-center transition-all",
                  mode === "teams" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm" : "border-border bg-card hover:border-purple-300",
                )}
              >
                <UsersRound className={cn("w-7 h-7 lg:w-8 lg:h-8 mx-auto mb-2 lg:mb-3", mode === "teams" ? "text-purple-600" : "text-muted-foreground")} />
                <p className="font-black text-foreground text-sm lg:text-base">{ar ? "فرق" : "Teams"}</p>
                <p className="text-[11px] lg:text-xs text-muted-foreground mt-0.5 lg:mt-1">{ar ? "الطلاب يتوزعون على فرق" : "Students split into teams"}</p>
              </button>

              <button
                type="button"
                onClick={() => classroomEligible.length >= 2 && setMode("classroom")}
                disabled={classroomEligible.length < 2}
                className={cn(
                  "p-5 lg:p-7 rounded-2xl border-2 text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  mode === "classroom" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm" : "border-border bg-card hover:border-emerald-300",
                )}
              >
                <School className={cn("w-7 h-7 lg:w-8 lg:h-8 mx-auto mb-2 lg:mb-3", mode === "classroom" ? "text-emerald-600" : "text-muted-foreground")} />
                <p className="font-black text-foreground text-sm lg:text-base">{ar ? "وميض الصف" : "Class mode"}</p>
                <p className="text-[11px] lg:text-xs text-muted-foreground mt-0.5 lg:mt-1">
                  {classroomEligible.length < 2
                    ? (ar ? "يحتاج سؤالي اختيار متعدد/صح وخطأ" : "Needs 2 MCQ/true-false questions")
                    : (ar ? "فريقان على شاشتين بالسبورة" : "Two teams, split-screen board")}
                </p>
              </button>
            </div>

            {mode === "teams" && (
              <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-4 lg:space-y-5">
                <div>
                  <label className="block text-xs lg:text-sm font-bold text-foreground mb-2 lg:mb-3 text-center">{ar ? "عدد الفرق" : "Number of teams"}</label>
                  <div className="flex justify-center gap-2 lg:gap-3">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTeamCount(n)}
                        className={cn(
                          "w-10 h-10 lg:w-12 lg:h-12 rounded-xl font-black text-sm lg:text-base transition-all",
                          teamCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs lg:text-sm font-bold text-foreground mb-2 lg:mb-3 text-center">{ar ? "أسماء الفرق (اختياري)" : "Team names (optional)"}</label>
                  <div className="space-y-2 lg:space-y-2.5">
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
                        className="w-full px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(mode === "solo" || mode === "teams") && (
              <ClassSelector value={targetClass} onChange={setTargetClass} accent="#a855f7" />
            )}

            <button
              type="button"
              onClick={startGame}
              disabled={!mode || starting}
              className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 active:scale-95 disabled:opacity-50"
            >
              {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" fill="currentColor" />}
              {ar ? "ابدأ اللعبة" : "Start game"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
