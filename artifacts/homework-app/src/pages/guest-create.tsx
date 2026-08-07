import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Save, Check, ArrowRight, ArrowLeft,
  PenLine, UserPlus, CheckCircle2, ChevronDown,
  Sparkles, Loader2, X, Zap, Copy, Play,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { toast } from "@/components/ui/sonner";
import {
  loadGuestDraft, saveGuestDraft,
  makeDefaultQuestion,
  type GuestDraft, type GuestQuestion, type GuestQuestionType,
} from "@/lib/guest-draft";

const API_BASE = import.meta.env.VITE_API_URL || "";
const GUEST_AI_COUNT_KEY = "guestAiUsageCount";
const MAX_GUEST_AI_USES = 3;
const QUESTION_TYPES: GuestQuestionType[] = ["mcq", "true_false", "fill_blank"];

function getGuestAiUsage(): number {
  try { return parseInt(localStorage.getItem(GUEST_AI_COUNT_KEY) || "0", 10); } catch { return 0; }
}
function incrementGuestAiUsage(): void {
  localStorage.setItem(GUEST_AI_COUNT_KEY, String(getGuestAiUsage() + 1));
}

function buildApiQuestions(questions: GuestQuestion[]) {
  return questions
    .filter((q) => q.text.trim())
    .map((q) => {
      if (q.type === "mcq") {
        return {
          text: q.text.trim(),
          questionType: "mcq",
          optionA: q.options[0]?.trim() || "",
          optionB: q.options[1]?.trim() || "",
          optionC: q.options[2]?.trim() || "",
          optionD: q.options[3]?.trim() || "",
          correctAnswer: (["A", "B", "C", "D"] as const)[q.correct] ?? "A",
          points: 1,
        };
      } else if (q.type === "true_false") {
        return {
          text: q.text.trim(),
          questionType: "true_false",
          correctAnswer: q.correct === 0 ? "true" : "false",
          points: 1,
        };
      } else {
        return {
          text: q.text.trim(),
          questionType: "fill_blank",
          correctAnswer: q.fillAnswer.trim(),
          points: 1,
        };
      }
    })
    .filter((q) => q.correctAnswer);
}

function AuthGateOverlay({
  onClose,
  dir,
  children,
}: {
  onClose: () => void;
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      dir={dir}
    >
      {children}
    </motion.div>
  );
}

export default function GuestCreatePage() {
  useSeo({
    title: "أنشئ نشاطاً بدون تسجيل | منصة حصاد",
    description: "أنشئ مسابقة أو واجباً تعليمياً بسرعة بدون الحاجة لحساب. شارك الرابط مع طلابك مباشرةً وابدأ في ثوانٍ.",
    canonicalPath: "/guest/create",
    ogImage: "/opengraph.jpg",
  });
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const [draft, setDraft] = useState<GuestDraft>(() => {
    const existing = loadGuestDraft();
    return existing ?? { title: "", subject: "", questions: [] };
  });

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiType, setAiType] = useState<GuestQuestionType>("mcq");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiUsage, setAiUsage] = useState(getGuestAiUsage());
  const [pendingAiQuestions, setPendingAiQuestions] = useState<GuestQuestion[] | null>(null);

  const [gameResult, setGameResult] = useState<{ pin: string; title: string; questionCount: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateReason, setAuthGateReason] = useState<"ai" | "publish">("publish");

  const { data: currentUser, isLoading: userLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const [autoResumed, setAutoResumed] = useState(false);

  useEffect(() => {
    return () => {
      if (draft.title.trim()) saveGuestDraft(draft);
    };
  }, [draft]);

  useEffect(() => {
    if (autoResumed) return;
    if (userLoading) return;
    if (!currentUser) return;
    let pending = false;
    try { pending = localStorage.getItem("pending_publish_after_auth") === "1"; } catch {}
    if (!pending) return;
    if (!draft.title.trim()) return;
    if (buildApiQuestions(draft.questions).length === 0) return;
    try { localStorage.removeItem("pending_publish_after_auth"); } catch {}
    setAutoResumed(true);
    toast.success(lang === "ar" ? "إكمال نشر مسابقتك..." : "Resuming your quiz publish...");
    setTimeout(() => { handleCreateGame(); }, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userLoading, draft.title, draft.questions.length, autoResumed]);

  const updateDraft = (partial: Partial<GuestDraft>) => setDraft(d => ({ ...d, ...partial }));

  const addQuestion = () => updateDraft({ questions: [...draft.questions, makeDefaultQuestion()] });

  const deleteQuestion = (id: string) =>
    updateDraft({ questions: draft.questions.filter(q => q.id !== id) });

  const updateQuestion = (id: string, partial: Partial<GuestQuestion>) =>
    updateDraft({ questions: draft.questions.map(q => q.id === id ? { ...q, ...partial } : q) });

  const updateOption = (qid: string, idx: number, val: string) =>
    updateDraft({
      questions: draft.questions.map(q => {
        if (q.id !== qid) return q;
        const options = [...q.options] as GuestQuestion["options"];
        options[idx] = val;
        return { ...q, options };
      }),
    });

  const changeQuestionType = (id: string, type: GuestQuestionType) =>
    updateQuestion(id, { type, correct: 0 });

  const qtypeLabel = (type: GuestQuestionType): string => {
    if (type === "mcq") return t.guestCreate.typeMcq;
    if (type === "true_false") return t.guestCreate.typeTrueFalse;
    return t.guestCreate.typeFillBlank;
  };

  const handleAiGenerate = async () => {
    // AI generation requires a logged-in account
    if (!currentUser) {
      saveGuestDraft(draft);
      setAuthGateReason("ai");
      setShowAuthGate(true);
      return;
    }
    if (aiUsage >= MAX_GUEST_AI_USES) {
      toast.error(t.guestCreate.aiGenLimitReached);
      return;
    }
    if (!aiTopic.trim()) {
      toast.error(lang === "ar" ? "أدخل الموضوع" : "Enter a topic");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-challenge/guest-ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount, difficulty: aiDifficulty, questionType: aiType }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) setAiUsage(MAX_GUEST_AI_USES);
        toast.error(data.message || t.guestCreate.aiGenError);
        return;
      }

      const mapped: GuestQuestion[] = (data.questions as any[]).map((q: any) => {
        const qtype: GuestQuestionType =
          q.questionType === "true_false" ? "true_false" :
          q.questionType === "fill_blank" ? "fill_blank" : "mcq";

        let correct = 0;
        let fillAnswer = "";
        if (qtype === "mcq") {
          const idx = ["A", "B", "C", "D"].indexOf(q.correctAnswer);
          correct = idx >= 0 ? idx : 0;
        } else if (qtype === "true_false") {
          correct = q.correctAnswer === "true" ? 0 : 1;
        } else {
          fillAnswer = q.correctAnswer || "";
        }

        return {
          ...makeDefaultQuestion(),
          type: qtype,
          text: q.text || "",
          options: [q.optionA || "", q.optionB || "", q.optionC || "", q.optionD || ""] as [string, string, string, string],
          correct,
          fillAnswer,
        };
      });

      if (mapped.length === 0) throw new Error(t.guestCreate.aiGenError);

      incrementGuestAiUsage();
      setAiUsage(getGuestAiUsage());

      if (draft.questions.some(q => q.text.trim())) {
        setPendingAiQuestions(mapped);
      } else {
        updateDraft({ questions: mapped });
        setShowAiPanel(false);
        toast.success(t.guestCreate.aiGenSuccess.replace("{n}", String(mapped.length)));
      }
      if (!draft.title && aiTopic) updateDraft({ title: aiTopic });
    } catch (err: any) {
      toast.error(err.message || t.guestCreate.aiGenError);
    } finally {
      setAiGenerating(false);
    }
  };

  const applyPendingAi = (mode: "append" | "replace") => {
    if (!pendingAiQuestions) return;
    if (mode === "replace") {
      updateDraft({ questions: pendingAiQuestions });
    } else {
      updateDraft({ questions: [...draft.questions.filter(q => q.text.trim()), ...pendingAiQuestions] });
    }
    toast.success(t.guestCreate.aiGenSuccess.replace("{n}", String(pendingAiQuestions.length)));
    setPendingAiQuestions(null);
    setShowAiPanel(false);
  };

  const handleSave = () => {
    if (!draft.title.trim()) {
      toast.error(lang === "ar" ? "أدخل عنوان المسابقة" : "Enter a competition title");
      return;
    }
    saveGuestDraft(draft);
    setSaved(true);
    toast.success(t.guestCreate.draftSaved);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCreateGame = async () => {
    const apiQs = buildApiQuestions(draft.questions);
    if (!draft.title.trim()) {
      toast.error(lang === "ar" ? "أدخل عنوان المسابقة" : "Enter title");
      return;
    }
    if (apiQs.length === 0) {
      toast.error(t.guestCreate.minQuestions);
      return;
    }

    if (userLoading) {
      toast.message(lang === "ar" ? "جاري التحقق..." : "Verifying...");
      return;
    }
    if (!currentUser) {
      saveGuestDraft(draft);
      try { localStorage.setItem("pending_publish_after_auth", "1"); } catch {}
      setAuthGateReason("publish");
      setShowAuthGate(true);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-challenge/create-from-questions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          subject: draft.subject.trim() || undefined,
          questions: apiQs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.limitReached) {
          saveGuestDraft(draft);
          setAuthGateReason("publish");
          setShowAuthGate(true);
          return;
        }
        throw new Error(data.message || "خطأ");
      }
      setGameResult(data);
      saveGuestDraft(draft);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (!gameResult) return;
    setStarting(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-challenge/start/${gameResult.pin}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setStarted(true);
      } else {
        const d = await res.json();
        toast.error(d.message || "لا يمكن بدء اللعبة");
      }
    } finally {
      setStarting(false);
    }
  };

  const handleCopyPin = () => {
    if (!gameResult) return;
    navigator.clipboard.writeText(gameResult.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canSave = !!draft.title.trim();
  const validCount = draft.questions.filter(q => q.text.trim()).length;
  const canCreate = canSave && validCount > 0;

  if (gameResult) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex items-center justify-center p-4" dir={dir}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-purple-950 to-indigo-950 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/10 text-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl mb-4">🎮</motion.div>
            <h2 className="text-2xl font-black text-white mb-1">
              {lang === "ar" ? "المسابقة جاهزة!" : "Competition Ready!"}
            </h2>
            <p className="text-white/60 text-sm mb-5">
              {gameResult.title} • {gameResult.questionCount} {lang === "ar" ? "أسئلة" : "questions"}
            </p>

            <div className="bg-white/10 rounded-2xl p-5 mb-5">
              <p className="text-white/50 text-xs mb-2">PIN</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-black text-yellow-400 tracking-widest" dir="ltr">
                  {gameResult.pin}
                </span>
                <button onClick={handleCopyPin} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!started ? (
              <div className="space-y-3">
                <p className="text-white/50 text-xs">
                  {lang === "ar" ? "شارك الرمز مع اللاعبين ثم ابدأ اللعبة" : "Share the code then start the game"}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartGame}
                  disabled={starting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                  {starting ? (lang === "ar" ? "جارٍ البدء..." : "Starting...") : (lang === "ar" ? "ابدأ اللعبة!" : "Start Game!")}
                </motion.button>
              </div>
            ) : (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-400 text-lg font-bold">
                  <Check className="w-6 h-6" />
                  {lang === "ar" ? "اللعبة بدأت!" : "Game Started!"}
                </div>
                <button
                  onClick={() => setLocation(`/game/join/${gameResult.pin}`)}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                >
                  {lang === "ar" ? "انضم كلاعب" : "Join as Player"}
                </button>
              </motion.div>
            )}

            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-white/40 text-xs mb-3">{t.guestCreate.draftBannerDesc}</p>
              <Link href="/register" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors">
                {t.guestCreate.registerToPublish}
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AnimatePresence>
        {showAuthGate && (
          <AuthGateOverlay onClose={() => setShowAuthGate(false)} dir={dir}>
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 8 }}
              className="bg-white dark:bg-card rounded-2xl p-7 max-w-sm w-full shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
              dir={dir}
              role="dialog"
              aria-modal="true"
              aria-labelledby="guest-auth-gate-title"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                {authGateReason === "ai"
                  ? <Sparkles className="w-7 h-7 text-primary" />
                  : <Save className="w-7 h-7 text-primary" />
                }
              </div>
              <h3 id="guest-auth-gate-title" className="text-xl font-black text-foreground mb-2">
                {authGateReason === "ai"
                  ? (lang === "ar" ? "سجّل الدخول لاستخدام الذكاء الاصطناعي" : "Log in to use AI")
                  : (lang === "ar" ? "احفظ مسابقتك للأبد" : "Save your quiz forever")
                }
              </h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {authGateReason === "ai"
                  ? (lang === "ar"
                      ? "توليد الأسئلة بالذكاء الاصطناعي متاح للأعضاء فقط. أنشئ حساباً مجانياً في ثوانٍ."
                      : "AI question generation is available to members only. Create a free account in seconds.")
                  : (lang === "ar"
                      ? "أنشئ حساباً مجانياً (10 ثوانٍ) لنشر مسابقتك وتشغيلها للاعبين. مسودّتك محفوظة بالفعل."
                      : "Create a free account (10 seconds) to publish and play your quiz. Your draft is already saved.")
                }
              </p>
              <div className="flex flex-col gap-2.5">
                <Link
                  href="/register"
                  className="w-full py-3 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {lang === "ar" ? "أنشئ حساباً مجانياً" : "Create Free Account"}
                </Link>
                <Link
                  href="/login?google=1"
                  className="w-full py-2.5 px-5 rounded-xl border-2 border-[#4285F4]/35 hover:border-[#4285F4]/70 hover:bg-[#4285F4]/5 text-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {lang === "ar" ? "المتابعة عبر جوجل" : "Continue with Google"}
                </Link>
                <Link
                  href="/login"
                  className="w-full py-2.5 px-5 rounded-xl border border-border hover:bg-muted text-foreground font-bold text-sm transition-colors"
                >
                  {lang === "ar" ? "لديّ حساب — تسجيل الدخول" : "I have an account — Login"}
                </Link>
                <button
                  onClick={() => setShowAuthGate(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 py-1"
                >
                  {lang === "ar" ? "متابعة التحرير" : "Keep editing"}
                </button>
              </div>
            </motion.div>
          </AuthGateOverlay>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl" dir={dir}>
        <Link href="/" className="text-primary hover:underline font-bold flex items-center gap-1 mb-6 w-fit">
          <BackArrow className="w-4 h-4" />
          {t.publicGames.backHome}
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <PenLine className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t.guestCreate.title}</h1>
            <p className="text-sm text-muted-foreground">{t.guestCreate.subtitle}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-foreground text-base">{t.guestCreate.competitionInfo}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">{t.guestCreate.competitionTitle} *</label>
                <input
                  value={draft.title}
                  onChange={e => updateDraft({ title: e.target.value })}
                  placeholder={t.guestCreate.titlePlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">{t.guestCreate.subjectLabel}</label>
                <input
                  value={draft.subject}
                  onChange={e => updateDraft({ subject: e.target.value })}
                  placeholder={t.guestCreate.subjectPlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border border-violet-200/70 dark:border-violet-700/40 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAiPanel(v => !v)}
              className="w-full flex items-center justify-between gap-3 p-4 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/15 text-violet-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-start">
                  <p className="font-extrabold text-sm text-foreground">{t.guestCreate.aiGenTitle}</p>
                  <p className="text-xs text-muted-foreground">{t.guestCreate.aiGenDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-bold">
                  {t.guestCreate.aiGenRemaining.replace("{n}", String(Math.max(0, MAX_GUEST_AI_USES - aiUsage)))}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showAiPanel ? "rotate-180" : ""}`} />
              </div>
            </button>

            <AnimatePresence>
              {showAiPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-violet-200/60 dark:border-violet-700/30 pt-3">
                    {pendingAiQuestions ? (
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-foreground">{t.guestCreate.aiGenReplaceConfirm}</p>
                        <div className="flex gap-2">
                          <button onClick={() => applyPendingAi("append")} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors">
                            {t.guestCreate.aiGenAppend}
                          </button>
                          <button onClick={() => applyPendingAi("replace")} className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 border-violet-400 text-violet-700 hover:bg-violet-100 transition-colors">
                            {t.guestCreate.aiGenReplace}
                          </button>
                          <button onClick={() => setPendingAiQuestions(null)} className="px-3 py-2.5 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-bold text-foreground mb-1.5 block">{t.guestCreate.aiGenTopicLabel} *</label>
                          <input
                            value={aiTopic}
                            onChange={e => setAiTopic(e.target.value)}
                            placeholder={t.guestCreate.aiGenTopicPlaceholder}
                            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-foreground"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">{t.guestCreate.aiGenCountLabel}</label>
                            <div className="flex items-center gap-1 border border-border rounded-xl overflow-hidden bg-background">
                              <button type="button" onClick={() => setAiCount(c => Math.max(1, c - 1))} className="px-2.5 py-2 text-base font-bold hover:bg-muted transition-colors">−</button>
                              <span className="flex-1 text-center text-sm font-bold text-foreground py-2">{aiCount}</span>
                              <button type="button" onClick={() => setAiCount(c => Math.min(10, c + 1))} className="px-2.5 py-2 text-base font-bold hover:bg-muted transition-colors">+</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">{t.guestCreate.aiGenDifficultyLabel}</label>
                            <select
                              value={aiDifficulty}
                              onChange={e => setAiDifficulty(e.target.value as "easy" | "medium" | "hard")}
                              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
                            >
                              <option value="easy">{t.guestCreate.aiGenDiffEasy}</option>
                              <option value="medium">{t.guestCreate.aiGenDiffMedium}</option>
                              <option value="hard">{t.guestCreate.aiGenDiffHard}</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-foreground mb-1.5 block">
                              {lang === "ar" ? "النوع" : "Type"}
                            </label>
                            <select
                              value={aiType}
                              onChange={e => setAiType(e.target.value as GuestQuestionType)}
                              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
                            >
                              {QUESTION_TYPES.map(qt => (
                                <option key={qt} value={qt}>{qtypeLabel(qt)}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={handleAiGenerate}
                          disabled={aiGenerating || !aiTopic.trim() || aiUsage >= MAX_GUEST_AI_USES}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {aiGenerating ? t.guestCreate.aiGenGenerating : t.guestCreate.aiGenBtn}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence mode="popLayout">
            {draft.questions.map((q, qi) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="bg-card border border-border rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                    {lang === "ar" ? `سؤال ${qi + 1}` : `Q${qi + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={q.type}
                        onChange={e => changeQuestionType(q.id, e.target.value as GuestQuestionType)}
                        className="text-xs font-bold text-foreground bg-muted border border-border rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
                      >
                        {QUESTION_TYPES.map(qt => (
                          <option key={qt} value={qt}>{qtypeLabel(qt)}</option>
                        ))}
                      </select>
                      <ChevronDown className={`w-3 h-3 text-muted-foreground absolute top-1/2 -translate-y-1/2 pointer-events-none ${lang === "ar" ? "left-2" : "right-2"}`} />
                    </div>
                    <button onClick={() => deleteQuestion(q.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title={t.guestCreate.deleteQuestion}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={q.text}
                  onChange={e => updateQuestion(q.id, { text: e.target.value })}
                  placeholder={t.guestCreate.questionPlaceholder}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />

                {q.type === "mcq" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correct === oi}
                          onChange={() => updateQuestion(q.id, { correct: oi })}
                          className="accent-primary shrink-0 w-4 h-4"
                        />
                        <input
                          value={opt}
                          onChange={e => updateOption(q.id, oi, e.target.value)}
                          placeholder={`${t.guestCreate.optionPlaceholder} ${String.fromCharCode(0x41 + oi)}`}
                          className={`flex-1 px-3 py-1.5 rounded-lg border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors ${
                            q.correct === oi ? "border-primary/50 bg-primary/5" : "border-border bg-background"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {q.type === "true_false" && (
                  <div className="flex gap-3">
                    {[
                      { label: t.guestCreate.trueLabel, value: 0 },
                      { label: t.guestCreate.falseLabel, value: 1 },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateQuestion(q.id, { correct: opt.value })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                          q.correct === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === "fill_blank" && (
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1 block">{t.guestCreate.fillAnswerLabel}</label>
                    <input
                      value={q.fillAnswer}
                      onChange={e => updateQuestion(q.id, { fillAnswer: e.target.value })}
                      placeholder={t.guestCreate.fillAnswerPlaceholder}
                      className="w-full px-3 py-2 rounded-xl border border-primary/40 bg-primary/5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.guestCreate.addQuestion}
          </motion.button>

          <div className="flex flex-col sm:flex-row gap-3 pb-4">
            <button
              onClick={handleCreateGame}
              disabled={creating || !canCreate}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {creating
                ? (lang === "ar" ? "جارٍ الإنشاء..." : "Creating...")
                : (lang === "ar" ? "أنشئ لعبة مباشرة" : "Create Live Game")}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground font-bold text-sm transition-colors border border-border"
            >
              {saved ? <Check className="w-4 h-4 text-green-500" /> : <Save className="w-4 h-4" />}
              {saved ? t.guestCreate.draftSaved : t.guestCreate.saveDraft}
            </button>
          </div>

          <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/30 rounded-xl p-4">
            <p className="text-sm text-teal-700 dark:text-teal-300 mb-3">{t.guestCreate.draftBannerDesc}</p>
            <div className="flex gap-2">
              <Link href="/register" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors">
                <UserPlus className="w-3.5 h-3.5" />
                {t.guestCreate.registerToPublish}
              </Link>
              <Link href="/login" className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors">
                {lang === "ar" ? "تسجيل الدخول" : "Login"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
