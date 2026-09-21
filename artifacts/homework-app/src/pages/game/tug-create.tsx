import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, Swords, ArrowRight, Link2, Users, ListChecks, Monitor, Smartphone, CircleCheck,
  Check, X, Loader2, FileText, BookOpen,
  GraduationCap, Trash2, Search, Gift, Snowflake,
  Timer, Copy, Settings2, ChevronDown
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { toast } from "@/components/ui/sonner";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { GameLibraryPublishChoice } from "@/components/game/game-library-publish-choice";
import { saveGameActivity, createSavedGamePlayLink, savedGamePlayUrl } from "@/lib/saved-game-activities";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { normalizeGameQuestion } from "@/lib/normalize-game-question";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BLUE = "#3b5bdb";
const INDIGO = "#4c6ef5";

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
  const [selectedSource, setSelectedSource] = useState<"bank" | "assignment" | null>(null);
  const [setupStep, setSetupStep] = useState<"questions" | "settings">("questions");
  const [readyOpen, setReadyOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLaunchOptions, setShowLaunchOptions] = useState(false);
  // Activity title carried into Class Mode's top banner (assignment title when known).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Layout>
        <div className="min-h-screen bg-[#faf8f0] px-4 py-8 sm:px-6 sm:py-10" dir={dir}>
          <div className="mx-auto mb-3 max-w-3xl">
            <GameFlowBackButton onBack={handleFlowBack} />
          </div>
          <UnifiedQuestionSourceFlow
            gameTitle={ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
            gameDescription={ar ? "حضّر الأسئلة أولاً، ثم اضبط المنافسة وابدأ اللعب." : "Prepare questions, configure the competition, then start."}
            gameIcon={<Swords className="h-8 w-8 text-[#0B4B35]" />}
            accentColor="#0B4B35"
            tugPresentation
            floatingAssignmentContinue
            header={
              <div className="rounded-3xl border border-[#0B4B35]/10 bg-white px-4 py-4 shadow-sm sm:px-6" dir={dir}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B4B35] text-white shadow-sm">
                      <Swords className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-[#0B4B35] sm:text-xl">{ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}</h1>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{ar ? "حضّر المنافسة في ثلاث خطوات قصيرة" : "Prepare the match in three quick steps"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#FAF8F0] px-3 py-2" style={{ direction: "ltr" }}>
                    <span className="flex items-center gap-1.5 text-xs font-black text-red-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-red-500" />{ar ? "الأحمر" : "Red"}</span>
                    <Swords className="h-4 w-4 text-slate-300" />
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
                setIsShared(savedActivity.isShared);
                const settings = savedSettings(savedActivity.settings);
                if (settings) {
                  if (settings.endMode === "time" || settings.endMode === "questions") {
                    setEndMode(settings.endMode);
                  }
                  if (typeof settings.matchDurationSeconds === "number") {
                    setMatchDurationMinutes(Math.max(1, Math.round(settings.matchDurationSeconds / 60)));
                  }
                  if ([10, 15, 20, 30].includes(settings.duration as number)) {
                    setDuration(settings.duration as number);
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#FAF8F0]" dir={dir}>
        <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
          <GameFlowBackButton onBack={handleFlowBack} />
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-5 sm:px-6">
          <div className="rounded-3xl border border-[#0B4B35]/10 bg-white px-4 py-4 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B4B35] text-white">
                  <Swords className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-[#0B4B35] sm:text-xl">{ar ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}</h1>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{ar ? "اضبط المنافسة ثم انتقل لبدء اللعب" : "Set the match, then get ready to start"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#FAF8F0] px-3 py-2" style={{ direction: "ltr" }}>
                <span className="flex items-center gap-1.5 text-xs font-black text-red-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-red-500" />{ar ? "الأحمر" : "Red"}</span>
                <Swords className="h-4 w-4 text-slate-300" />
                <span className="flex items-center gap-1.5 text-xs font-black text-blue-700" style={{ direction: dir }}><span className="h-2 w-2 rounded-full bg-blue-500" />{ar ? "الأزرق" : "Blue"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-5 pb-8 sm:px-6">
          <div className="mb-6 flex justify-center">
            <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-[#0B4B35]/10 bg-white p-1 shadow-sm">
              <span className="flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-bold text-[#0B4B35] sm:text-xs"><CircleCheck className="h-3.5 w-3.5" />{ar ? "الأسئلة" : "Questions"}</span>
              <span className="rounded-xl bg-[#0B4B35] px-2 py-2 text-center text-[11px] font-black text-white shadow-sm sm:text-xs">{ar ? "إعدادات اللعبة" : "Settings"}</span>
              <span className="rounded-xl px-2 py-2 text-center text-[11px] font-bold text-slate-400 sm:text-xs">{ar ? "الاستعداد والبدء" : "Ready"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 mb-5 max-w-3xl mx-auto">
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

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-bold text-gray-700">{ar ? "وقت السؤال الواحد" : "Time per question"}</span>
                <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1">
                  {[10, 15, 20, 30].map(s => (
                    <button key={s} onClick={() => setDuration(s)}
                      data-testid={`button-duration-${s}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${duration === s ? "bg-[#0B4B35] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      {s}{ar ? "ث" : "s"}
                    </button>
                  ))}
                </div>
              </div>
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

                      <div className="border border-gray-200 rounded-2xl p-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-800">{ar ? "الهدايا والمفاجآت" : "Gifts & Surprises"}</span>
                          <button onClick={() => setGiftsEnabled(!giftsEnabled)} data-testid="button-gifts-enabled" className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${giftsEnabled ? "bg-amber-500" : "bg-gray-300"}`}>
                            <motion.div animate={{ x: giftsEnabled ? (dir === 'rtl' ? -20 : 20) : (dir === 'rtl' ? -2 : 2) }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">{ar ? "تظهر هدايا للفريق أثناء اللعب مثل مضاعفة النقاط أو تجميد الفريق الآخر" : "Gifts like double points or freeze effect appear during play"}</p>

                        <AnimatePresence>
                          {giftsEnabled && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-3 border-t border-gray-100 flex flex-col gap-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-bold text-gray-600">{ar ? "ظهور الهدية كل:" : "Gift appears every:"}</span>
                                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                                    {[1, 2, 3].map(n => (
                                      <button key={n} onClick={() => setGiftEveryCorrect(n as 1|2|3)} data-testid={`button-gift-freq-${n}`} className={`px-2 py-1 rounded text-[11px] sm:text-xs font-black transition-colors ${giftEveryCorrect === n ? "bg-white shadow-sm text-amber-600" : "text-gray-500 hover:text-gray-700"}`}>
                                        {n} {ar ? "أسئلة" : "questions"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs font-bold text-gray-600">{ar ? "مدة تجميد الخصم:" : "Freeze duration:"}</span>
                                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                                    {[3, 5, 7, 10].map(s => (
                                      <button key={s} onClick={() => setFreezeDuration(s)} data-testid={`button-freeze-dur-${s}`} className={`px-2 py-1 rounded text-[11px] sm:text-xs font-black transition-colors ${freezeDuration === s ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                                        {s}{ar ? "ث" : "s"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Actions Card: Red vs Blue Launch */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-2 flex flex-col gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || copyingLink}
                data-testid="button-host-game"
                className="w-full bg-blue-500 text-white hover:bg-blue-600 p-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-70 font-black text-sm sm:text-base h-14 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-white" />}
                {ar ? "بدء المنافسة كمعلم" : "Host Match"}
              </button>

              <div className="bg-white rounded-3xl border border-[#0B4B35]/10 overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowLaunchOptions(!showLaunchOptions)}
                  data-testid="button-toggle-launch-options"
                  aria-expanded={showLaunchOptions}
                  aria-controls="tug-launch-options"
                  className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-gray-400" />
                    {ar ? "خيارات التشغيل والمشاركة" : "Launch & Share Options"}
                  </span>
                  <motion.div animate={{ rotate: showLaunchOptions ? (dir === 'rtl' ? 180 : -180) : 0 }} className="text-gray-400">
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showLaunchOptions && (
                    <motion.div id="tug-launch-options" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4 pt-0 bg-gray-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={startClassMode}
                          disabled={creating}
                          data-testid="button-start-class-mode"
                          className="relative overflow-hidden group bg-red-500 text-white p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-sm disabled:opacity-70 h-24"
                        >
                          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Monitor className="w-7 h-7" />
                          <span className="font-black text-sm">{ar ? "عرض على السبورة" : "Board Mode"}</span>
                        </button>
                        <button
                          onClick={handleCopyLink}
                          disabled={copyingLink || creating}
                          data-testid="button-copy-link"
                          className="bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-70 font-black text-sm h-24"
                        >
                          {copyingLink ? <Loader2 className="w-7 h-7 animate-spin" /> : <Link2 className="w-7 h-7" />}
                          <span>{ar ? "نسخ رابط اللعبة" : "Copy Game Link"}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
