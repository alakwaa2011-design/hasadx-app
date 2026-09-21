import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, Swords, Link2, ListChecks, Monitor, Smartphone,
  Check, Loader2, Gift, Timer, Settings2, ChevronDown, Minus, Plus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { toast } from "@/components/ui/sonner";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { GameLibraryPublishChoice } from "@/components/game/game-library-publish-choice";
import { saveGameActivity, createSavedGamePlayLink, savedGamePlayUrl } from "@/lib/saved-game-activities";
import { normalizeGameQuestion } from "@/lib/normalize-game-question";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TugQuestion {
  text: string;
  options: string[];
  correct: number;
  imageUrl?: string | null;
}

const savedSettings = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export default function TugCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<TugQuestion[]>([]);
  const [endMode, setEndMode] = useState<"questions" | "time">("questions");
  const [matchDurationMinutes, setMatchDurationMinutes] = useState<number | "">(2);
  const [duration, setDuration] = useState(20);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [giftsEnabled, setGiftsEnabled] = useState(true);
  const [giftEveryCorrect, setGiftEveryCorrect] = useState<1 | 2 | 3>(3);
  const [freezeDuration, setFreezeDuration] = useState(5);
  const [creating, setCreating] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [setupStep, setSetupStep] = useState<"questions" | "settings">("questions");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceTitle, setSourceTitle] = useState<string | null>(null);

  const handleFlowBack = () => {
    if (setupStep === "settings") {
      setSetupStep("questions");
      return;
    }
    setLocation("/");
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-load from presentation deep-link
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
          .slice(0, 20);
        if (qs.length > 0) {
          setQuestions(qs);
          if (typeof data.title === "string" && data.title.trim()) setSourceTitle(data.title.trim());
          setSetupStep("settings");
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من العرض!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [ar]);

  const persistActivity = () => saveGameActivity({
    gameType: "tug",
    title: sourceTitle?.trim() || (ar ? "شد الحبل" : "Tug of War"),
    questions,
    settings: {
      duration,
      autoAdvance,
      targetClass: targetClass || null,
      giftsEnabled,
      giftEveryCorrect,
      freezeDuration,
      endMode,
      matchDurationSeconds: endMode === "time" ? (Number(matchDurationMinutes) || 2) * 60 : undefined,
    },
    source: "game-launch",
    isShared,
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
    socket.emit("tug:create", {
      questions, duration, autoAdvance, targetClass: targetClass || undefined,
      giftsEnabled, giftEveryCorrect, freezeDuration,
      endMode,
      matchDurationSeconds: endMode === "time" ? (Number(matchDurationMinutes) || 2) * 60 : undefined,
    },
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
        giftsEnabled,
        giftEveryCorrect,
        freezeDuration,
        title: sourceTitle || undefined,
        savedActivityId: activity.id,
        endMode,
        matchDurationSeconds: endMode === "time" ? (Number(matchDurationMinutes) || 2) * 60 : undefined,
      }));
    } catch {
      toast.error(ar ? "تعذّر حفظ اللعبة تلقائيًا. حاول مرة أخرى." : "Could not auto-save the game. Please try again.");
      return;
    }
    setLocation("/game/tug/class");
  };

  const handleCopyLink = async () => {
    if (questions.length < 2) {
      toast.error(ar ? "لعبة شد الحبل تحتاج سؤالين على الأقل" : "Tug of War requires at least 2 questions");
      return;
    }
    setCopyingLink(true);
    try {
      const activity = await persistActivity();
      const token = await createSavedGamePlayLink(activity.id);
      const link = savedGamePlayUrl(token);
      await navigator.clipboard.writeText(link);
      toast.success(ar ? "تم نسخ الرابط بنجاح! يمكن إرساله للطلاب الآن." : "Link copied! You can share it with students.");
    } catch {
      toast.error(ar ? "تعذّر إنشاء الرابط. حاول مرة أخرى." : "Could not create link. Please try again.");
    } finally {
      setCopyingLink(false);
    }
  };

  if (setupStep === "questions") {
    return (
      <div className="min-h-screen bg-[#faf8f0] pb-10" dir={dir}>
        <div className="border-b border-[#0B4B35]/10 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-3 sm:px-4 lg:max-w-6xl lg:gap-4 lg:px-8 lg:py-5">
            <GameFlowBackButton onBack={handleFlowBack} label={ar ? "العودة" : "Back"} />
            <div className="flex items-center gap-3 lg:gap-3.5">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#0B4B35] flex items-center justify-center shadow-inner">
                <Swords className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <h1 className="text-lg lg:text-xl font-black text-[#0B4B35] tracking-tight">{ar ? "شد الحبل" : "Tug of War"}</h1>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl px-3 sm:px-4 lg:max-w-6xl lg:px-8 lg:py-10 py-6 sm:py-8 space-y-6 lg:space-y-8">
          <div className="flex items-center gap-2 px-1">
            {[
              { key: "questions", label: ar ? "١. الأسئلة" : "1. Questions" },
              { key: "settings", label: ar ? "٢. الإعدادات والبدء" : "2. Settings & Ready" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-[#0B4B35]/20" />}
                <span className={cn("text-sm font-black transition-colors", setupStep === s.key ? "text-[#0B4B35]" : "text-slate-400")}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <UnifiedQuestionSourceFlow
            gameTitle={ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
            gameDescription={ar ? "حضّر الأسئلة أولاً، ثم اضبط المنافسة وابدأ اللعب." : "Prepare questions, configure the competition, then start."}
            gameIcon={<Swords className="h-8 w-8 text-[#0B4B35]" />}
            accentColor="#0B4B35"
            floatingAssignmentContinue
            minQuestions={2}
            maxQuestions={20}
            onComplete={({ questions: prepared, sourceTitle: title, source, savedActivity }) => {
              setQuestions(prepared);
              setQuestionCount(prepared.length);
              setSourceTitle(title);
              if (source === "saved" && savedActivity?.gameType === "tug") {
                setIsShared(savedActivity.isShared);
                const settings = savedSettings(savedActivity.settings);
                if (settings) {
                  if (settings.endMode === "time" || settings.endMode === "questions") {
                    setEndMode(settings.endMode as "questions" | "time");
                  }
                  if (typeof settings.matchDurationSeconds === "number") {
                    setMatchDurationMinutes(Math.max(1, Math.round(settings.matchDurationSeconds / 60)));
                  }
                  if (typeof settings.duration === "number" && Number.isFinite(settings.duration)) {
                    setDuration(Math.max(5, Math.min(60, Math.round(settings.duration))));
                  }
                  if (typeof settings.autoAdvance === "boolean") setAutoAdvance(settings.autoAdvance);
                  if (typeof settings.targetClass === "string") setTargetClass(settings.targetClass);
                  if (typeof settings.giftsEnabled === "boolean") setGiftsEnabled(settings.giftsEnabled);
                  if ([1, 2, 3].includes(settings.giftEveryCorrect as number)) {
                    setGiftEveryCorrect(settings.giftEveryCorrect as 1 | 2 | 3);
                  }
                  if ([3, 5, 7, 10].includes(settings.freezeDuration as number)) {
                    setFreezeDuration(settings.freezeDuration as number);
                  }
                }
              }
              setSetupStep("settings");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F0] pb-10" dir={dir}>
      <div className="border-b border-[#0B4B35]/10 bg-white/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-3 py-3 sm:px-4 lg:max-w-6xl lg:gap-4 lg:px-8 lg:py-5">
          <GameFlowBackButton onBack={handleFlowBack} label={ar ? "العودة" : "Back"} />
          <div className="flex items-center gap-3 lg:gap-3.5">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[#0B4B35] flex items-center justify-center shadow-inner">
              <Swords className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <h1 className="text-lg lg:text-xl font-black text-[#0B4B35] tracking-tight">{ar ? "شد الحبل" : "Tug of War"}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-3 sm:px-4 lg:max-w-6xl lg:px-8 lg:py-10 py-6 sm:py-8 space-y-6 lg:space-y-8">
        <div className="flex items-center gap-2 px-1 mb-8">
          {[
            { key: "questions", label: ar ? "١. الأسئلة" : "1. Questions" },
            { key: "settings", label: ar ? "٢. الإعدادات والبدء" : "2. Settings & Ready" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-[#0B4B35]/20" />}
              <span className={cn("text-sm font-black transition-colors", setupStep === s.key ? "text-[#0B4B35]" : "text-slate-400")}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
          {/* Left Column (or Right in RTL): Settings */}
          <div className="flex flex-col gap-5">
            {/* Top Summary Card */}
            <div className="bg-white rounded-2xl border border-[#0B4B35]/10 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-[#0B4B35]/5 flex items-center justify-center">
                     <ListChecks className="w-5 h-5 text-[#0B4B35]" />
                   </div>
                   <div>
                     <h3 className="font-bold text-sm text-gray-800">{sourceTitle || (ar ? 'أسئلة مخصصة' : 'Custom Questions')}</h3>
                     <p className="text-xs text-gray-500 font-medium">{questionCount} {ar ? 'سؤال' : 'Questions'}</p>
                   </div>
                </div>
                <button onClick={() => setSetupStep("questions")} data-testid="button-edit-questions" className="text-xs font-bold text-[#0B4B35] hover:text-emerald-700 transition-colors bg-[#0B4B35]/5 px-3 py-1.5 rounded-lg">
                  {ar ? 'تعديل' : 'Edit'}
                </button>
              </div>
            </div>

            {/* Main Settings Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#0B4B35]/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0B4B35]/[0.02] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-[#0B4B35]" />
                {ar ? "قواعد المنافسة" : "Match Rules"}
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() => setEndMode("questions")}
                  className={`relative p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${endMode === "questions" ? "border-[#0B4B35] bg-[#0B4B35]/5 text-[#0B4B35]" : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"}`}
                  data-testid="button-endmode-questions"
                >
                  {endMode === "questions" && <Check className="absolute top-2 right-2 w-4 h-4 text-[#0B4B35]" />}
                  <ListChecks className="h-5 w-5" />
                  <span className="text-xs font-bold">{ar ? "حتى انتهاء الأسئلة" : "Questions Finish"}</span>
                </button>
                <button
                  onClick={() => setEndMode("time")}
                  className={`relative p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${endMode === "time" ? "border-[#0B4B35] bg-[#0B4B35]/5 text-[#0B4B35]" : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"}`}
                  data-testid="button-endmode-time"
                >
                  {endMode === "time" && <Check className="absolute top-2 right-2 w-4 h-4 text-[#0B4B35]" />}
                  <Timer className="h-5 w-5" />
                  <span className="text-xs font-bold">{ar ? "وقت محدد للمباراة" : "Time Limit"}</span>
                </button>
              </div>

              <AnimatePresence>
                {endMode === "time" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-5"
                  >
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0B4B35]/5 border border-[#0B4B35]/10">
                      <span className="text-sm font-bold text-gray-700">
                        {ar ? "مدة اللعب (دقائق):" : "Match duration (minutes):"}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={matchDurationMinutes === "" ? "" : matchDurationMinutes}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMatchDurationMinutes(v === "" ? "" : Math.max(1, Math.min(60, Number(v))));
                        }}
                        onBlur={() => {
                          if (matchDurationMinutes === "") setMatchDurationMinutes(2);
                        }}
                        data-testid="input-match-duration"
                        className="w-16 rounded-xl border-2 border-[#0B4B35]/20 bg-white px-2 py-1 text-center text-sm font-black text-[#0B4B35] outline-none transition-colors focus:border-[#0B4B35]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#0B4B35]/10 bg-[#0B4B35]/[0.035] p-3.5">
                <div>
                  <span className="block text-sm font-bold text-gray-700">{ar ? "وقت السؤال الواحد" : "Time per question"}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                    {ar ? "الوقت المتاح للإجابة" : "Time allowed to answer"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#0B4B35]/10 bg-white p-1 shadow-sm" dir="ltr">
                  <button
                    type="button"
                    onClick={() => setDuration((current) => Math.max(5, current - 5))}
                    disabled={duration <= 5}
                    data-testid="button-duration-decrease"
                    aria-label={ar ? "تقليل وقت السؤال" : "Decrease question time"}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[#0B4B35] transition-colors hover:bg-[#0B4B35]/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <output
                    data-testid="question-duration-value"
                    aria-live="polite"
                    className="min-w-[4.5rem] text-center text-base font-black tabular-nums text-[#0B4B35]"
                  >
                    {duration} {ar ? "ثانية" : "sec"}
                  </output>
                  <button
                    type="button"
                    onClick={() => setDuration((current) => Math.min(60, current + 5))}
                    disabled={duration >= 60}
                    data-testid="button-duration-increase"
                    aria-label={ar ? "زيادة وقت السؤال" : "Increase question time"}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[#0B4B35] transition-colors hover:bg-[#0B4B35]/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-3xl border border-amber-200/70 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black text-gray-800">{ar ? "الهدايا والمفاجآت" : "Gifts & Surprises"}</span>
                    <span className="mt-0.5 block text-xs font-medium text-gray-500">
                      {ar ? "مكافآت وتحديات تظهر أثناء اللعب" : "Rewards and challenges during play"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGiftsEnabled(!giftsEnabled)}
                  data-testid="button-gifts-enabled"
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${giftsEnabled ? "bg-amber-500" : "bg-gray-300"}`}
                >
                  <motion.div
                    animate={{ x: giftsEnabled ? (dir === "rtl" ? -20 : 20) : (dir === "rtl" ? -2 : 2) }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              <AnimatePresence>
                {giftsEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex flex-col gap-4 border-t border-amber-100 pt-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-gray-600">{ar ? "ظهور الهدية كل:" : "Gift appears every:"}</span>
                        <div className="flex w-fit gap-1 rounded-lg bg-amber-50 p-1">
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setGiftEveryCorrect(n as 1 | 2 | 3)}
                              data-testid={`button-gift-freq-${n}`}
                              className={`rounded px-2 py-1 text-[11px] font-black transition-colors sm:text-xs ${giftEveryCorrect === n ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              {n} {ar ? "أسئلة" : "questions"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-gray-600">{ar ? "مدة تجميد الخصم:" : "Freeze duration:"}</span>
                        <div className="flex w-fit gap-1 rounded-lg bg-blue-50 p-1">
                          {[3, 5, 7, 10].map((seconds) => (
                            <button
                              key={seconds}
                              type="button"
                              onClick={() => setFreezeDuration(seconds)}
                              data-testid={`button-freeze-dur-${seconds}`}
                              className={`rounded px-2 py-1 text-[11px] font-black transition-colors sm:text-xs ${freezeDuration === seconds ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              {seconds}{ar ? "ث" : "s"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Advanced Settings */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-3xl border border-[#0B4B35]/10 overflow-hidden shadow-sm">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                data-testid="button-toggle-advanced"
                aria-expanded={showAdvanced}
                aria-controls="tug-advanced-settings"
                className="w-full flex items-center justify-between p-5 sm:p-6 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-gray-400" />
                  {ar ? "إعدادات متقدمة" : "Advanced Settings"}
                </span>
                <motion.div animate={{ rotate: showAdvanced ? (dir === 'rtl' ? 180 : -180) : 0 }} className="text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div id="tug-advanced-settings" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-5 sm:p-6 pt-0 flex flex-col gap-6 bg-gray-50/50">

                      {gradeLevels.length > 0 && (
                        <div>
                          <span className="block text-sm font-bold text-gray-700 mb-2">{ar ? "الفصل المستهدف (اختياري)" : "Target Class (Optional)"}</span>
                          <select value={targetClass} onChange={e => setTargetClass(e.target.value)} data-testid="select-target-class" className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700 outline-none focus:border-[#0B4B35] transition-colors appearance-none">
                            <option value="">{ar ? "بدون صف — دخول عام بالرابط" : "No Class — Public Link Access"}</option>
                            {gradeLevels.map(g => (
                              <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel} ({g.count})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="block text-sm font-bold text-gray-700">{ar ? "التقدم التلقائي" : "Auto Advance"}</span>
                          <span className="text-xs font-medium text-gray-500 mt-0.5 block">{ar ? "الانتقال للسؤال التالي بعد الإجابة مباشرة" : "Move to next question after answering"}</span>
                        </div>
                        <button onClick={() => setAutoAdvance(!autoAdvance)} data-testid="button-auto-advance" className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${autoAdvance ? "bg-[#0B4B35]" : "bg-gray-300"}`}>
                          <motion.div animate={{ x: autoAdvance ? (dir === 'rtl' ? -20 : 20) : (dir === 'rtl' ? -2 : 2) }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                        <div>
                          <span className="block text-sm font-bold text-gray-700">{ar ? "مشاركة اللعبة مع المعلمين" : "Share with teachers"}</span>
                          <span className="text-xs font-medium text-gray-500 mt-0.5 block">{ar ? "السماح للآخرين بنسخ هذه اللعبة" : "Allow others to copy this game"}</span>
                        </div>
                        <GameLibraryPublishChoice isShared={isShared} onChange={setIsShared} />
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Column (or Left in RTL): Launch Options */}
          <div className="flex flex-col gap-5">
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-[#0B4B35]/10 relative overflow-hidden">
               <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                 <Play className="w-4 h-4 text-[#0B4B35]" />
                 {ar ? "بدء المنافسة" : "Start Match"}
               </h2>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <button
                    onClick={startClassMode}
                    disabled={creating}
                    data-testid="button-launch-board"
                    className="relative overflow-hidden group bg-red-500 text-white p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-red-600 transition-all shadow-sm disabled:opacity-70 h-32"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Monitor className="w-8 h-8" />
                    <span className="font-black text-sm">{ar ? "على السبورة" : "On Board"}</span>
                  </button>

                  <button
                    onClick={handleCreate}
                    disabled={creating || copyingLink}
                    data-testid="button-launch-student-devices"
                    className="relative overflow-hidden group bg-blue-500 text-white p-4 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-sm disabled:opacity-70 h-32"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Smartphone className="w-8 h-8" />
                    <span className="font-black text-sm text-center px-1 leading-snug">{ar ? "على أجهزة الطلاب" : "On Student Devices"}</span>
                  </button>
               </div>

               <div className="pt-5 border-t border-[#0B4B35]/10">
                 <button
                   onClick={handleCopyLink}
                   disabled={copyingLink || creating}
                   data-testid="button-copy-link"
                   className="w-full bg-white border-2 border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200 p-3 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70 font-bold text-sm h-12"
                 >
                   {copyingLink ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
                   <span>{ar ? "نسخ رابط اللعبة للمشاركة لاحقاً" : "Copy Game Link for later"}</span>
                 </button>
               </div>
             </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
