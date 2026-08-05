import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { ConfettiBurst } from "@/components/confetti-burst";
import {
  Brain,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  GraduationCap,
  Lock,
  AlertCircle,
  Loader2,
  BarChart3,
  Target,
  FileText,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;
const OPTION_COLORS = [
  "from-blue-500 to-blue-600",
  "from-violet-500 to-violet-600",
  "from-amber-500 to-amber-600",
  "from-emerald-500 to-emerald-600",
];

function getDeviceFingerprint(): string {
  const key = "hw_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(key, fp);
  }
  return fp;
}

function ScoreRing({ score, size = 148 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={10} stroke="currentColor" fill="none" className="text-muted/30" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={10} stroke={color} fill="none"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - filled }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScoreStars({ score }: { score: number }) {
  const stars = score >= 90 ? 3 : score >= 60 ? 2 : score >= 30 ? 1 : 0;
  return (
    <div className="flex items-center justify-center gap-1 my-2">
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: i <= stars ? 1 : 0.7, rotate: 0 }}
          transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 260 }}
        >
          <Star className={`w-8 h-8 ${i <= stars ? "text-amber-400 fill-amber-400" : "text-muted/30"}`} />
        </motion.div>
      ))}
    </div>
  );
}

interface AdaptiveQuestion {
  id: number;
  text: string;
  questionType: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  imageUrl: string | null;
  difficulty: number | null;
  skill: string | null;
}

interface SkillAbility {
  ability: number;
  correct: number;
  total: number;
}

interface ResultAnswer {
  questionId: number;
  questionText: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean | null;
  difficulty: number;
  skill: string;
  points: number;
}

export default function AdaptiveSolve() {
  const [, params] = useRoute("/solve/adaptive/:id");
  const assignmentId = parseInt(params?.id || "0");
  const { lang } = useI18n();
  const BackIcon = lang === "ar" ? ChevronLeft : ChevronRight;

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentLevel, setCurrentLevel] = useState("intermediate");
  const [submitting, setSubmitting] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0);
  const [levelChanged, setLevelChanged] = useState<null | "up" | "down">(null);
  const [prevLevel, setPrevLevel] = useState("intermediate");

  const [done, setDone] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    score: number;
    earnedPoints: number;
    totalPoints: number;
    correctAnswers: number;
    finalLevel: string;
    currentAbility: number;
    skillAbilities: Record<string, SkillAbility>;
    submissionId: number;
  } | null>(null);

  const [detailResults, setDetailResults] = useState<ResultAnswer[]>([]);

  // Persist a verified access code in sessionStorage so the student doesn't
  // re-enter it after a refresh in the same tab.
  const accessCodeStorageKey = `hw_access_code_${assignmentId}`;
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<string>(() => {
    if (typeof window === "undefined" || !assignmentId) return "";
    try { return sessionStorage.getItem(accessCodeStorageKey) || ""; } catch { return ""; }
  });
  const [accessCodeGate, setAccessCodeGate] = useState<{ title?: string } | null>(null);
  const [pendingAccessCode, setPendingAccessCode] = useState("");
  const [accessCodePromptError, setAccessCodePromptError] = useState("");

  useEffect(() => {
    if (!assignmentId) return;
    setLoading(true);
    setAccessCodeGate(null);
    const headers: Record<string, string> = {};
    if (verifiedAccessCode) headers["X-Access-Code"] = verifiedAccessCode;
    fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include", headers })
      .then(async r => {
        if (r.status === 403) {
          const body = await r.json().catch(() => null);
          if (body && body.requiresAccessCode) {
            setAccessCodeGate({ title: body.title });
            return null;
          }
        }
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (data) {
          setAssignment(data);
          // Keep the legacy `accessCode` state in sync so the existing submit
          // payload still includes the code on /adaptive/start.
          if (verifiedAccessCode) setAccessCode(verifiedAccessCode);
        } else if (!accessCodeGate) {
          setError(lang === "ar" ? "الواجب غير موجود" : "Assignment not found");
        }
      })
      .catch(() => setError(lang === "ar" ? "خطأ في الاتصال" : "Connection error"))
      .finally(() => setLoading(false));
    // accessCodeGate intentionally omitted — re-running on its change would
    // cause loops; we only refetch when the assignment id or verified code
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, lang, verifiedAccessCode]);

  const submitAccessCodePrompt = async () => {
    const code = pendingAccessCode.trim();
    if (!code) {
      setAccessCodePromptError(lang === "ar" ? "أدخل رمز الوصول" : "Enter the access code");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
        credentials: "include",
        headers: { "X-Access-Code": code },
      });
      if (!r.ok) {
        setAccessCodePromptError(lang === "ar" ? "رمز الوصول غير صحيح" : "Incorrect access code");
        return;
      }
      try { sessionStorage.setItem(accessCodeStorageKey, code); } catch {}
      setVerifiedAccessCode(code);
      setAccessCodePromptError("");
    } catch {
      setAccessCodePromptError(lang === "ar" ? "تعذّر التحقق من الرمز" : "Could not verify the code");
    }
  };

  const handleStart = async () => {
    if (!studentName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assignmentId,
          studentName: studentName.trim(),
          studentClass: studentClass.trim(),
          deviceFingerprint: getDeviceFingerprint(),
          accessCode: accessCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSessionId(data.sessionId);
      setTotalQuestions(data.totalQuestions);
      setAnsweredCount(data.answeredCount);
      setCurrentLevel(data.currentLevel);
      setPrevLevel(data.currentLevel);
      setCurrentQuestion(data.question);
      setStarted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = async () => {
    if (!sessionId || !currentQuestion || !selectedAnswer) return;
    setSubmitting(true);
    setLastCorrect(null);
    try {
      const res = await fetch(`${API_BASE}/api/adaptive/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          selectedAnswer,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setLastCorrect(data.isCorrect);
      setAnsweredCount(data.answeredCount);

      if (data.isCorrect) setStreak(s => s + 1);
      else setStreak(0);

      const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 } as const;
      const oldL = levelOrder[prevLevel as keyof typeof levelOrder] ?? 1;
      const newL = levelOrder[data.currentLevel as keyof typeof levelOrder] ?? 1;
      if (newL > oldL) setLevelChanged("up");
      else if (newL < oldL) setLevelChanged("down");
      else setLevelChanged(null);
      setPrevLevel(data.currentLevel);
      setCurrentLevel(data.currentLevel);

      if (data.done) {
        setDone(true);
        setFinalResult({
          score: data.score,
          earnedPoints: data.earnedPoints,
          totalPoints: data.totalPoints,
          correctAnswers: data.correctAnswers,
          finalLevel: data.currentLevel,
          currentAbility: data.currentAbility,
          skillAbilities: data.skillAbilities,
          submissionId: data.submissionId,
        });

        const detailRes = await fetch(`${API_BASE}/api/adaptive/results/${sessionId}?fp=${encodeURIComponent(getDeviceFingerprint())}`, { credentials: "include" });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setDetailResults(detail.answers || []);
        }
      } else {
        setTimeout(() => {
          setCurrentQuestion(data.question);
          setSelectedAnswer("");
          setLastCorrect(null);
          setLevelChanged(null);
        }, 1100);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const levelConfig = {
    beginner: {
      label: lang === "ar" ? "مبتدئ" : "Beginner",
      color: "text-orange-600 dark:text-orange-300",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      border: "border-orange-300",
      icon: "🌱",
      gradient: "from-orange-400 to-orange-600",
    },
    intermediate: {
      label: lang === "ar" ? "متوسط" : "Intermediate",
      color: "text-blue-600 dark:text-blue-300",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-300",
      icon: "⭐",
      gradient: "from-blue-400 to-blue-600",
    },
    advanced: {
      label: lang === "ar" ? "متقدم" : "Advanced",
      color: "text-emerald-600 dark:text-emerald-300",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      border: "border-emerald-300",
      icon: "🏆",
      gradient: "from-emerald-400 to-emerald-600",
    },
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (accessCodeGate) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 p-6 bg-card border-2 rounded-2xl space-y-4">
          <h2 className="text-lg font-bold">
            {accessCodeGate.title || (lang === "ar" ? "واجب مغلق" : "Private assignment")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "هذا الواجب يتطلّب رمز وصول. اطلبه من معلمك."
              : "This assignment requires an access code from your teacher."}
          </p>
          <input
            type="text"
            value={pendingAccessCode}
            onChange={e => { setPendingAccessCode(e.target.value); setAccessCodePromptError(""); }}
            onKeyDown={e => { if (e.key === "Enter") void submitAccessCodePrompt(); }}
            placeholder={lang === "ar" ? "أدخل رمز الوصول" : "Enter access code"}
            className="w-full p-3 rounded-xl border-2 font-mono tracking-widest text-center"
            dir="ltr"
            autoFocus
          />
          {accessCodePromptError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
              {accessCodePromptError}
            </div>
          )}
          <button
            onClick={() => void submitAccessCodePrompt()}
            className="w-full py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600 transition-colors"
          >
            {lang === "ar" ? "متابعة" : "Continue"}
          </button>
        </div>
      </Layout>
    );
  }

  if (!assignment) {
    return (
      <Layout>
        <div className="text-center p-20 text-xl font-bold">{error || (lang === "ar" ? "الواجب غير موجود" : "Not found")}</div>
      </Layout>
    );
  }

  if (done && finalResult) {
    const lc = levelConfig[finalResult.finalLevel as keyof typeof levelConfig] || levelConfig.intermediate;
    const skills = Object.entries(finalResult.skillAbilities);
    const score = Math.round(finalResult.score);
    const isGreat = score >= 80;
    const isOk = score >= 50;
    const celebMsg = isGreat
      ? (lang === "ar" ? "🎉 عمل رائع! أنت متميز!" : "🎉 Excellent work! You're a star!")
      : isOk
        ? (lang === "ar" ? "💪 جيد! استمر في التحسن!" : "💪 Good job! Keep improving!")
        : (lang === "ar" ? "📚 لا بأس، المحاولة تستحق!" : "📚 Nice try, keep practicing!");

    return (
      <Layout>
        <ConfettiBurst active={isGreat} />
        <div className="min-h-screen bg-gradient-to-b from-violet-500/10 to-background">
          <div className="container mx-auto px-4 py-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden mb-6">
                <div className={`h-2 w-full ${isGreat ? 'bg-gradient-to-r from-green-400 to-emerald-500' : isOk ? 'bg-gradient-to-r from-amber-400 to-yellow-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
                <div className="p-8 text-center">
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl mb-1"
                  >
                    {celebMsg}
                  </motion.p>

                  <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl md:text-3xl font-black mb-1 mt-2"
                  >
                    {lang === "ar" ? "أحسنت" : "Well done"} {studentName}!
                  </motion.h1>

                  {studentClass && (
                    <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mb-2">
                      <GraduationCap className="w-4 h-4" />
                      {studentClass}
                    </p>
                  )}

                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45, type: "spring", stiffness: 220 }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${lc.bg} ${lc.color} font-bold text-base mt-2`}
                  >
                    <Brain className="w-4 h-4" />
                    {lang === "ar" ? "مستواك:" : "Your Level:"} <span className="text-lg">{lc.icon}</span> {lc.label}
                  </motion.div>

                  <div className="flex items-center justify-center my-6">
                    <div className="relative inline-flex items-center justify-center">
                      <ScoreRing score={score} size={148} />
                      <div className="absolute text-center">
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8 }}
                          className={`text-4xl font-black ${isGreat ? 'text-green-500' : isOk ? 'text-amber-500' : 'text-red-500'}`}
                        >
                          {score}%
                        </motion.p>
                      </div>
                    </div>
                  </div>

                  <ScoreStars score={score} />

                  <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto">
                    {finalResult.finalLevel === "advanced"
                      ? (lang === "ar" ? "مستواك متقدم — أنت نجم! واصل التفوق وساعد زملاءك 🌟" : "You're at an advanced level — you're a star! Keep excelling and help your peers 🌟")
                      : finalResult.finalLevel === "intermediate"
                      ? (lang === "ar" ? "أداء جيد! أنت في المسار الصحيح — استمر في التدريب وستصل للمستوى المتقدم قريباً 💪" : "Good job! You're on the right track — keep practicing and you'll reach advanced soon 💪")
                      : (lang === "ar" ? "بداية رائعة! كل خطوة تقربك من التقدم — لا تستسلم وحاول مرة أخرى 🌱" : "Great start! Every step brings you closer — don't give up and try again 🌱")}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto mt-6 mb-2">
                    <div className="bg-muted/40 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-muted-foreground mb-1">{lang === "ar" ? "النتيجة" : "Grade"}</p>
                      <p className="text-2xl font-black">{finalResult.earnedPoints}</p>
                      <p className="text-xs text-muted-foreground">/ {finalResult.totalPoints}</p>
                    </div>
                    <div className="bg-muted/40 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-muted-foreground mb-1">{lang === "ar" ? "الإجابات الصحيحة" : "Correct"}</p>
                      <p className="text-2xl font-black text-green-500">{finalResult.correctAnswers}</p>
                      <p className="text-xs text-muted-foreground">/ {totalQuestions}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 bg-muted/40 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-muted-foreground mb-1">{lang === "ar" ? "النسبة" : "Percentage"}</p>
                      <p className={`text-2xl font-black ${isGreat ? 'text-green-500' : isOk ? 'text-amber-500' : 'text-red-500'}`}>{score}%</p>
                      <p className="text-xs text-muted-foreground">&nbsp;</p>
                    </div>
                  </div>

                  {skills.length > 0 && (
                    <div className={`${lang === "ar" ? "text-right" : "text-left"} space-y-3 mt-6 bg-muted/20 rounded-2xl p-5 border border-border`}>
                      <h3 className="font-bold text-sm text-muted-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {lang === "ar" ? "تحليل المهارات" : "Skills Analysis"}
                      </h3>
                      {skills.map(([skill, data]) => {
                        const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                        const slc = levelConfig[
                          data.ability < 1.5 ? "beginner" : data.ability <= 2.5 ? "intermediate" : "advanced"
                        ];
                        return (
                          <div key={skill} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-bold">{skill}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${slc.bg} ${slc.color}`}>
                                {slc.label} — {pct}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.3, duration: 0.8 }}
                                className={`h-full rounded-full bg-gradient-to-r ${slc.gradient}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {detailResults.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-500" />
                    {lang === "ar" ? "تفاصيل الإجابات" : "Answer Details"}
                  </h2>
                  {detailResults.map((ans, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: lang === "ar" ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                    >
                      <div className={`bg-card rounded-2xl border-2 overflow-hidden ${ans.isCorrect ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
                        <div className={`flex items-center gap-3 px-4 py-3 ${ans.isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ans.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {ans.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <p className="font-bold text-sm flex-1">{lang === "ar" ? "سؤال" : "Q"} {i + 1}: {ans.questionText}</p>
                          <div className="flex gap-1.5 shrink-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ans.difficulty === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : ans.difficulty === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                              {ans.difficulty === 1 ? (lang === "ar" ? "سهل" : "Easy") : ans.difficulty === 2 ? (lang === "ar" ? "متوسط" : "Med") : (lang === "ar" ? "صعب" : "Hard")}
                            </span>
                            {ans.skill && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{ans.skill}</span>}
                          </div>
                        </div>
                        <div className="px-4 py-3 flex flex-wrap gap-4 text-sm">
                          <div className="w-full">
                            <span className="text-muted-foreground text-xs font-medium">{lang === "ar" ? "إجابتك:" : "Your answer:"} </span>
                            {ans.selectedAnswer?.startsWith("data:image") ? (
                              <img
                                src={ans.selectedAnswer}
                                alt={lang === "ar" ? "رسمتك" : "Your drawing"}
                                className="max-w-full rounded-xl border border-border mt-1"
                              />
                            ) : (
                              <span className={`font-bold ${ans.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {ans.selectedAnswer || "—"}
                              </span>
                            )}
                          </div>
                          {!ans.isCorrect && (
                            <div>
                              <span className="text-muted-foreground text-xs font-medium">{lang === "ar" ? "الصحيحة:" : "Correct:"} </span>
                              <span className="font-bold text-green-600 dark:text-green-400">{ans.correctAnswer}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-8 text-center">
                <Link href="/">
                  <Button variant="outline" className="px-8">
                    <BackIcon className="w-4 h-4 me-1" />
                    {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  if (started && currentQuestion) {
    const lc = levelConfig[currentLevel as keyof typeof levelConfig] || levelConfig.intermediate;
    const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
    const qt = currentQuestion.questionType || "mcq";
    const questionNumber = answeredCount + 1;

    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-violet-500/8 via-background to-background">
          <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border shadow-sm">
            <div className="container mx-auto px-4 max-w-3xl py-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4" />
                  </div>
                  <span className="font-black text-sm truncate">{assignment.title as string}</span>
                </div>
                <motion.div
                  key={currentLevel}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${lc.bg} ${lc.color} flex items-center gap-1`}
                >
                  <span>{lc.icon}</span>
                  <span>{lc.label}</span>
                </motion.div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-muted-foreground shrink-0">
                  {answeredCount} / {totalQuestions} {lang === "ar" ? "سؤال" : "answered"}
                </p>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 100 }}
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  {Array.from({ length: Math.min(totalQuestions, 12) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < answeredCount ? 'bg-violet-500' : i === answeredCount ? 'bg-violet-300 ring-2 ring-violet-300/40' : 'bg-muted-foreground/25'}`}
                    />
                  ))}
                  {totalQuestions > 12 && <span className="text-xs text-muted-foreground">+{totalQuestions - 12}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-6 max-w-3xl">
            <AnimatePresence mode="wait">
              {lastCorrect !== null && (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`mb-4 p-3.5 rounded-2xl text-center font-bold text-sm flex items-center justify-center gap-2 ${lastCorrect ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-2 border-green-300/50' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-2 border-red-300/50'}`}
                >
                  {lastCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  {lastCorrect
                    ? (lang === "ar" ? "إجابة صحيحة!" : "Correct!")
                    : (lang === "ar" ? "إجابة خاطئة" : "Incorrect")}
                  {lastCorrect && streak >= 2 && (
                    <span className="ms-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 text-xs">
                      <Sparkles className="w-3 h-3" /> {streak} {lang === "ar" ? "متتالية" : "streak"}
                    </span>
                  )}
                  {levelChanged === "up" && (
                    <span className="ms-1 px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-200 text-xs font-bold">
                      ⬆ {lang === "ar" ? "ترقية للمستوى" : "Level up"}
                    </span>
                  )}
                  {levelChanged === "down" && (
                    <span className="ms-1 px-2 py-0.5 rounded-full bg-orange-200/80 text-orange-800 dark:bg-orange-500/30 dark:text-orange-200 text-xs font-bold">
                      ⬇ {lang === "ar" ? "تخفيف الصعوبة" : "Easier next"}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: lang === "ar" ? -30 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-card rounded-2xl border-2 border-border shadow-lg overflow-hidden">
                <div className="p-5 md:p-6 pb-0">
                  <div className="flex gap-3 items-start mb-4">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm">
                      {questionNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-muted-foreground mb-1">
                        {lang === "ar" ? "سؤال" : "Question"} {questionNumber} / {totalQuestions}
                      </p>
                      <h2 className="text-lg md:text-xl font-black leading-snug">{currentQuestion.text}</h2>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {currentQuestion.difficulty && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentQuestion.difficulty === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : currentQuestion.difficulty === 2 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                          {currentQuestion.difficulty === 1 ? (lang === "ar" ? "سهل" : "Easy") : currentQuestion.difficulty === 2 ? (lang === "ar" ? "متوسط" : "Medium") : (lang === "ar" ? "صعب" : "Hard")}
                        </span>
                      )}
                      {currentQuestion.skill && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 max-w-[120px] truncate">
                          {currentQuestion.skill}
                        </span>
                      )}
                    </div>
                  </div>

                  {currentQuestion.imageUrl && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-border">
                      <img src={currentQuestion.imageUrl} alt="" className="max-h-56 w-full object-contain bg-muted/20" />
                    </div>
                  )}
                </div>

                <div className="p-5 md:p-6 pt-2">
                  {qt === "mcq" && (
                    <div className="space-y-2.5">
                      {OPTION_LABELS.map((opt, oi) => {
                        const optText = currentQuestion[`option${opt}` as "optionA" | "optionB" | "optionC" | "optionD"];
                        if (!optText) return null;
                        const isSelected = selectedAnswer === opt;
                        return (
                          <motion.label
                            key={opt}
                            whileTap={{ scale: 0.985 }}
                            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${isSelected ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm' : 'border-border bg-background hover:border-violet-300 hover:bg-muted/40'} ${submitting ? 'pointer-events-none opacity-80' : ''}`}
                          >
                            <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black transition-all duration-200 ${isSelected ? `bg-gradient-to-br ${OPTION_COLORS[oi]} text-white shadow-sm` : 'bg-muted text-muted-foreground'}`}>
                              {opt}
                            </span>
                            <input
                              type="radio"
                              name={`q-${currentQuestion.id}`}
                              value={opt}
                              checked={isSelected}
                              onChange={() => setSelectedAnswer(opt)}
                              className="sr-only"
                              disabled={submitting}
                            />
                            <span className="font-medium text-sm flex-1 leading-snug">{optText}</span>
                            <AnimatePresence>
                              {isSelected && (
                                <motion.span
                                  key="check"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="text-violet-500 shrink-0"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.label>
                        );
                      })}
                    </div>
                  )}

                  {qt === "true_false" && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "true", label: lang === "ar" ? "صح" : "True", icon: "✓", cls: "green" },
                        { value: "false", label: lang === "ar" ? "خطأ" : "False", icon: "✗", cls: "red" },
                      ].map(opt => (
                        <motion.button
                          key={opt.value}
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          disabled={submitting}
                          onClick={() => setSelectedAnswer(opt.value)}
                          className={`py-5 rounded-xl border-2 font-black text-base transition-all duration-200 flex flex-col items-center gap-1.5 ${
                            selectedAnswer === opt.value
                              ? opt.cls === "green"
                                ? 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-md shadow-green-100 dark:shadow-green-900/20'
                                : 'border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-md shadow-red-100 dark:shadow-red-900/20'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                          }`}
                        >
                          <span className="text-2xl">{opt.icon}</span>
                          <span>{opt.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {qt === "fill_blank" && (
                    <div className="relative">
                      <Input
                        value={selectedAnswer}
                        onChange={e => setSelectedAnswer(e.target.value)}
                        placeholder={lang === "ar" ? "اكتب إجابتك هنا..." : "Type your answer here..."}
                        className="text-base py-3 border-2 rounded-xl focus:border-violet-500"
                        disabled={submitting}
                      />
                      {selectedAnswer && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "left-3" : "right-3"}`}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleAnswer}
                      disabled={!selectedAnswer || submitting}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                    >
                      {submitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Target className="w-5 h-5" />
                          {answeredCount + 1 === totalQuestions
                            ? (lang === "ar" ? "إنهاء الاختبار" : "Finish Test")
                            : (lang === "ar" ? "تأكيد والتالي" : "Confirm & Next")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  const isPrivate = assignment.accessMode === "private";

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-violet-500/8 via-background to-background">
        <div className="bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-700 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="container relative z-10 mx-auto px-4 max-w-4xl py-8 md:py-12">
            <Link href="/" className="inline-flex items-center gap-1 text-white/70 hover:text-white mb-5 text-sm font-semibold transition-colors">
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "العودة" : "Back"}
            </Link>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full inline-block mb-1">
                  {lang === "ar" ? "اختبار تكيّفي" : "Adaptive Test"}
                </div>
                <h1 className="text-2xl md:text-4xl font-black leading-tight">{assignment.title as string}</h1>
              </div>
            </div>
            {assignment.description ? <p className="text-white/80 text-base max-w-2xl mb-4">{assignment.description as string}</p> : null}
            <div className="mt-2 flex items-center gap-2 text-sm font-medium flex-wrap">
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                <Brain className="w-4 h-4" />
                {lang === "ar" ? "تكيّفي" : "Adaptive"}
              </span>
              {assignment.subject ? (
                <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                  <Star className="w-4 h-4" /> {assignment.subject as string}
                </span>
              ) : null}
              {isPrivate && (
                <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                  <Lock className="w-3.5 h-3.5" /> {lang === "ar" ? "كود مطلوب" : "Code required"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Card className="p-6 md:p-8 shadow-xl border border-border rounded-2xl">
            <div className="max-w-md mx-auto space-y-5">
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220 }}
                  className="text-5xl mb-3"
                >
                  🧠
                </motion.div>
                <h2 className="text-xl font-black mb-2">
                  {lang === "ar" ? "اختبار تكيّفي ذكي" : "Smart Adaptive Test"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar"
                    ? "سيتكيّف الاختبار مع مستواك — إذا أجبت صحيحاً ستزداد الصعوبة، وإذا أخطأت ستقل"
                    : "The test adapts to your level — correct answers increase difficulty, wrong answers decrease it"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 my-4">
                {(["beginner", "intermediate", "advanced"] as const).map(lv => {
                  const c = levelConfig[lv];
                  return (
                    <div key={lv} className={`flex flex-col items-center gap-1 p-2 rounded-xl border ${c.bg} border-border`}>
                      <span className="text-xl">{c.icon}</span>
                      <span className={`text-[11px] font-bold ${c.color}`}>{c.label}</span>
                    </div>
                  );
                })}
              </div>

              <div>
                <Label className="text-sm font-bold mb-1.5 block">{lang === "ar" ? "اسمك" : "Your Name"}</Label>
                <Input
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder={lang === "ar" ? "ادخل اسمك الكامل" : "Enter your full name"}
                  className="text-base border-2"
                />
              </div>
              <div>
                <Label className="text-sm font-bold mb-1.5 block">{lang === "ar" ? "الصف" : "Class"}</Label>
                <Input
                  value={studentClass}
                  onChange={e => setStudentClass(e.target.value)}
                  placeholder={lang === "ar" ? "مثال: 3/أ" : "e.g. 3/A"}
                  className="text-base border-2"
                />
              </div>

              {isPrivate && (
                <div>
                  <Label className="text-sm font-bold mb-1.5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-violet-600" />
                    {lang === "ar" ? "كود الدخول" : "Access Code"}
                  </Label>
                  <Input
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value)}
                    placeholder="XXXXXX"
                    className="font-mono tracking-widest text-base border-2"
                    dir="ltr"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleStart}
                disabled={!studentName.trim() || submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Brain className="w-5 h-5" />
                    {lang === "ar" ? "ابدأ الاختبار التكيّفي" : "Start Adaptive Test"}
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
