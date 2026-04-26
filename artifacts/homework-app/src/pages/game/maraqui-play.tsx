import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, RotateCcw, Trophy,
  CheckCircle2, XCircle, Share2, Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface MCQQuestion {
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
}

interface MaraquiStage {
  num: number;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  questions: MCQQuestion[];
}

interface MaraquiPath {
  id: number;
  title: string;
  stages: MaraquiStage[];
  pin: string;
}

interface ProgressRow {
  id: number;
  path_id: number;
  player_name: string;
  completed_stages: number;
  attempts: number;
  is_complete: boolean;
  completed_at: string | null;
}

type GamePhase = "loading" | "playing" | "stage_clear" | "complete" | "stage_fail";

const BTN_COLORS = [
  { bg: "bg-red-500 hover:bg-red-400 active:bg-red-600", text: "text-white" },
  { bg: "bg-blue-500 hover:bg-blue-400 active:bg-blue-600", text: "text-white" },
  { bg: "bg-green-500 hover:bg-green-400 active:bg-green-600", text: "text-white" },
  { bg: "bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500", text: "text-gray-900" },
];

const SHAPE_ICONS = ["▲", "■", "●", "✦"];
const STAGE_EMOJIS = ["⭐", "🌟", "💫", "🏅", "🎯", "🔥", "👑", "💎"];

const PRAISE_MESSAGES = [
  "أحسنت! 👏 لقد أتقنت هذه المرحلة بامتياز",
  "رائع جداً! 🌟 إجاباتك كلها صحيحة",
  "ممتاز! 💪 عقلك حاد وسريع",
  "بارك الله فيك! 🎯 واصل هكذا",
  "تألقت! ✨ لا يوقفك شيء",
  "مبدع! 🚀 أنت في القمة",
  "أبهرتنا! 🎉 ما شاء الله عليك",
  "قوي جداً! 💥 هكذا يكون التميز",
];

const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const DIFF_COLOR: Record<string, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

// ── Timer duration by stage + difficulty ─────────────────────────────────────
function getTimerDuration(stageNum: number, difficulty: string): number {
  const baseByDiff = difficulty === "hard" ? 14 : difficulty === "medium" ? 18 : 22;
  const reduction = Math.min(6, (stageNum - 1) * 1.5);
  return Math.max(8, Math.round(baseByDiff - reduction));
}

// ── Level system ──────────────────────────────────────────────────────────────
interface LevelInfo { label: string; icon: string; color: string; next: number | null }
function getLevel(score: number): LevelInfo {
  if (score >= 500) return { label: "خبير", icon: "👑", color: "text-purple-600 dark:text-purple-400", next: null };
  if (score >= 250) return { label: "متقدم", icon: "🔥", color: "text-orange-600 dark:text-orange-400", next: 500 };
  if (score >= 100) return { label: "متوسط", icon: "⚡", color: "text-amber-600 dark:text-amber-400", next: 250 };
  return { label: "مبتدئ", icon: "🌱", color: "text-green-600 dark:text-green-400", next: 100 };
}

// ── Audio ─────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
function playBeep(freq: number, type: OscillatorType, duration: number, vol = 0.2) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
  } catch { /* ignore */ }
}
function soundCorrect() {
  playBeep(880, "sine", 0.1, 0.25);
  setTimeout(() => playBeep(1320, "sine", 0.12, 0.22), 90);
}
function soundWrong() {
  playBeep(220, "sawtooth", 0.15, 0.22);
  setTimeout(() => playBeep(175, "sawtooth", 0.12, 0.28), 130);
}
function soundTick() {
  playBeep(660, "sine", 0.05, 0.07);
}
function soundTimeUp() {
  playBeep(330, "sawtooth", 0.22, 0.18);
  setTimeout(() => playBeep(265, "sawtooth", 0.2, 0.2), 130);
  setTimeout(() => playBeep(210, "sawtooth", 0.28, 0.35), 270);
}
function soundStreakMilestone() {
  [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => playBeep(f, "sine", 0.13, 0.28), i * 65));
}
function soundStageClear() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playBeep(f, "sine", 0.24, 0.32), i * 95));
}
function soundComplete() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playBeep(f, "sine", 0.26, 0.36), i * 100));
  setTimeout(() => {
    [784, 1047, 1319, 1047, 1319].forEach((f, i) => setTimeout(() => playBeep(f, "sine", 0.22, 0.3), i * 80));
  }, 600);
}

// ── Timer Ring ────────────────────────────────────────────────────────────────

function TimerRing({ timeLeft, maxTime }: { timeLeft: number; maxTime: number }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, timeLeft / maxTime);
  const offset = circ * (1 - pct);
  const isRed = timeLeft <= 4;
  const isAmber = !isRed && timeLeft <= 8;
  const color = isRed ? "#ef4444" : isAmber ? "#f59e0b" : "#10b981";
  return (
    <div className={`relative w-14 h-14 flex items-center justify-center ${isRed ? "animate-pulse" : ""}`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="4.5" className="text-gray-200 dark:text-gray-700" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.92s linear, stroke 0.4s ease" }}
        />
      </svg>
      <span className={`relative text-sm font-black ${isRed ? "text-red-500" : isAmber ? "text-amber-500" : "text-emerald-600"}`}>
        {timeLeft}
      </span>
    </div>
  );
}

// ── Particle Burst (confetti) ─────────────────────────────────────────────────

function ParticleBurst() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 450,
      y: (Math.random() - 0.5) * 550,
      color: ["#fbbf24", "#34d399", "#60a5fa", "#f87171", "#a78bfa", "#fb7185", "#fcd34d", "#6ee7b7"][i % 8],
      size: 7 + Math.random() * 12,
      rotate: Math.random() * 720 - 360,
      delay: Math.random() * 0.35,
      shape: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%",
    }))
  , []);

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-40">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.2 }}
          transition={{ duration: 1.5, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ── Streak Badge ──────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  const icon = streak >= 7 ? "🌟" : streak >= 5 ? "⚡" : "🔥";
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={streak}
        initial={{ scale: 0, y: -10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0, opacity: 0 }}
        className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-full px-3 py-1 shadow-sm"
      >
        <span className="text-xl leading-none">{icon}</span>
        <span className="font-black text-orange-600 dark:text-orange-400 text-base leading-none">{streak}×</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MaraquiPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("maraqui");

  const [path, setPath] = useState<MaraquiPath | null>(null);
  const [currentStageNum, setCurrentStageNum] = useState(1);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [stageAttempts, setStageAttempts] = useState(1);
  const [totalAttempts, setTotalAttempts] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongReachedQ, setWrongReachedQ] = useState(0);
  const [completedStages, setCompletedStages] = useState(0);
  const [error, setError] = useState("");

  const [timeLeft, setTimeLeft] = useState(20);
  const [timerKey, setTimerKey] = useState(0);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [stageScore, setStageScore] = useState(0);
  const [lastPointGain, setLastPointGain] = useState<number | null>(null);
  const [autoAdvanceSec, setAutoAdvanceSec] = useState(5);
  const [endLeaderboard, setEndLeaderboard] = useState<ProgressRow[]>([]);
  const [endLbLoading, setEndLbLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedStage, setCopiedStage] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [stageWrongCount, setStageWrongCount] = useState(0);

  const playerNameRef = useRef("");
  const pinRef = useRef("");
  const pathIdRef = useRef(0);
  const answeringRef = useRef(false);
  const stageWrongCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shuffledOptionsRef = useRef<{ text: string; originalIdx: number }[]>([]);
  const arenaFinishedRef = useRef(false);

  const handleTimeUpRef = useRef<() => void>(() => {});
  const goNextStageFnRef = useRef<() => void>(() => {});

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "complete" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  // ── Load path ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get("pin") || "";
    const stageParam = parseInt(params.get("stage") || "1", 10);
    const name = params.get("name") || "";
    pinRef.current = pin;
    playerNameRef.current = name || ("ضيف-" + Math.random().toString(36).slice(2, 6).toUpperCase());

    if (!pin) { setError(isRtl ? "PIN غير موجود" : "No PIN provided"); return; }

    fetch(`${API_BASE}/api/maraqui-paths/${pin}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: MaraquiPath | null) => {
        if (!data) { setError(isRtl ? "المسار غير موجود" : "Path not found"); return; }
        setPath(data);
        pathIdRef.current = data.id;
        const clampedStage = Math.min(Math.max(stageParam, 1), data.stages.length);
        setCurrentStageNum(clampedStage);
        setCurrentQIdx(0);
        setPhase("playing");

        if (name) {
          fetch(`${API_BASE}/api/maraqui-progress-me/${data.id}?playerName=${encodeURIComponent(name)}`)
            .then(r => r.ok ? r.json() : null)
            .then(prog => {
              const savedCompleted = prog?.completed_stages || 0;
              const savedAttempts = prog?.attempts || 1;
              const isComplete = prog?.is_complete || false;
              setCompletedStages(savedCompleted);
              setTotalAttempts(savedAttempts);
              // Completed players: respect URL stage param (allow replay from any stage)
              // In-progress players: always resume from saved stage (ignore URL, prevent skipping)
              const enforcedStage = isComplete
                ? clampedStage
                : Math.min(savedCompleted + 1, data.stages.length);
              setCurrentStageNum(enforcedStage);
            })
            .catch(() => {});
        }
      })
      .catch(() => setError(isRtl ? "حدث خطأ في تحميل المسار" : "Error loading path"));
  }, []);

  // ── Save progress ──────────────────────────────────────────────────────────

  const saveProgress = useCallback(async (completedCount: number, attempts: number, isComplete: boolean) => {
    if (!pathIdRef.current || !playerNameRef.current) return;
    try {
      localStorage.setItem(`maraqui_progress_${pathIdRef.current}`, String(completedCount));
    } catch { /* ignore */ }
    try {
      await fetch(`${API_BASE}/api/maraqui-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pathId: pathIdRef.current,
          playerName: playerNameRef.current,
          completedStages: completedCount,
          attempts,
          isComplete,
        }),
      });
    } catch { /* ignore */ }
  }, []);

  // ── Keep handleTimeUp ref fresh ────────────────────────────────────────────

  useEffect(() => {
    handleTimeUpRef.current = () => {
      if (answeringRef.current) return;
      answeringRef.current = true;
      soundTimeUp();
      setTimedOut(true);
      setSelected(-1);
      setWrongReachedQ(currentQIdx + 1);
      setStreak(0);
      setStageAttempts(prev => prev + 1);
      setTotalAttempts(prev => {
        saveProgress(completedStages, prev + 1, false);
        return prev + 1;
      });
      const newWrongsCount = stageWrongCountRef.current + 1;
      stageWrongCountRef.current = newWrongsCount;
      setStageWrongCount(newWrongsCount);
      if (newWrongsCount >= 3) {
        setTimeout(() => setPhase("stage_fail"), 900);
      } else {
        setTimeout(() => {
          setCurrentQIdx(0);
          setSelected(null);
          setStreak(0);
          setTimedOut(false);
          setStageScore(0);
          setTimerKey(prev => prev + 1);
          setPhase("playing");
          answeringRef.current = false;
        }, 1500);
      }
    };
  }, [currentQIdx, completedStages, saveProgress]);

  // ── Keep goNextStage ref fresh ─────────────────────────────────────────────

  useEffect(() => {
    goNextStageFnRef.current = () => {
      if (!path) return;
      const nextNum = currentStageNum + 1;
      if (nextNum > path.stages.length) { setPhase("complete"); return; }
      setCurrentStageNum(nextNum);
      setCurrentQIdx(0);
      setSelected(null);
      setStageAttempts(1);
      setStreak(0);
      setTimedOut(false);
      setStageScore(0);
      stageWrongCountRef.current = 0;
      setStageWrongCount(0);
      setPhase("playing");
      answeringRef.current = false;
    };
  }, [path, currentStageNum]);

  // ── Timer effect ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    const difficulty = path?.stages[currentStageNum - 1]?.difficulty;
    const duration = getTimerDuration(currentStageNum, difficulty || "easy");
    setTimeLeft(duration);
    answeringRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          handleTimeUpRef.current();
          return 0;
        }
        if (prev <= 5) soundTick();
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [phase, currentQIdx, currentStageNum, path, timerKey]);

  // ── Auto-advance on stage clear ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "stage_clear" || !path) return;
    const isLast = currentStageNum >= path.stages.length;
    if (isLast) return;
    setAutoAdvanceSec(5);
    const interval = setInterval(() => setAutoAdvanceSec(p => Math.max(0, p - 1)), 1000);
    const timeout = setTimeout(() => goNextStageFnRef.current(), 5100);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [phase]);

  // ── Fetch end-screen leaderboard ───────────────────────────────────────────

  useEffect(() => {
    if (phase !== "complete" || !pathIdRef.current) return;
    setEndLbLoading(true);
    fetch(`${API_BASE}/api/maraqui-progress/${pathIdRef.current}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ProgressRow[]) => setEndLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setEndLbLoading(false));
  }, [phase]);

  // ── Page visibility guard ──────────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && phase === "playing") {
        // Reset question state; increment timerKey to force timer restart on return
        // (even if currentQIdx was already 0, timerKey change re-triggers the timer effect)
        setCurrentQIdx(0);
        setSelected(null);
        setTimedOut(false);
        setStreak(0);
        setStageScore(0);
        setTimerKey(prev => prev + 1);
        answeringRef.current = false;
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase]);

  // ── Handle answer ──────────────────────────────────────────────────────────

  const handleAnswer = (shuffledIdx: number) => {
    if (!path || phase !== "playing" || answeringRef.current) return;
    answeringRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSelected(shuffledIdx);
    setTimedOut(false);

    const stage = path.stages[currentStageNum - 1];
    if (!stage) return;
    const q = stage.questions[currentQIdx];
    if (!q) return;

    const originalIdx = shuffledOptionsRef.current[shuffledIdx]?.originalIdx ?? shuffledIdx;
    const isCorrect = originalIdx === q.correct;

    if (isCorrect) {
      soundCorrect();
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak === 3 || newStreak === 5 || newStreak === 7) {
        setTimeout(() => soundStreakMilestone(), 160);
      }

      const diffPts = stage.difficulty === "hard" ? 20 : stage.difficulty === "medium" ? 15 : 10;
      const mult = Math.min(3, 1 + Math.floor(newStreak / 3) * 0.5);
      const gained = Math.round(diffPts * mult);
      setScore(prev => prev + gained);
      setStageScore(prev => prev + gained);
      setLastPointGain(gained);
      setTimeout(() => setLastPointGain(null), 950);

      const nextQIdx = currentQIdx + 1;
      if (nextQIdx >= stage.questions.length) {
        soundStageClear();
        const newCompleted = completedStages + 1;
        setCompletedStages(newCompleted);
        if (newCompleted >= path.stages.length) {
          setPhase("stage_clear");
          setTimeout(async () => {
            soundComplete();
            await saveProgress(newCompleted, totalAttempts, true);
            setPhase("complete");
          }, 1800);
        } else {
          setPhase("stage_clear");
          saveProgress(newCompleted, totalAttempts, false);
        }
      } else {
        setTimeout(() => {
          setSelected(null);
          setCurrentQIdx(nextQIdx);
          answeringRef.current = false;
        }, 600);
      }
    } else {
      soundWrong();
      setStreak(0);
      setWrongReachedQ(currentQIdx + 1);
      const newAttempts = totalAttempts + 1;
      setStageAttempts(prev => prev + 1);
      setTotalAttempts(newAttempts);
      saveProgress(completedStages, newAttempts, false);
      const newWrongsCount = stageWrongCountRef.current + 1;
      stageWrongCountRef.current = newWrongsCount;
      setStageWrongCount(newWrongsCount);
      if (newWrongsCount >= 3) {
        setTimeout(() => setPhase("stage_fail"), 700);
      } else {
        setTimeout(() => {
          setCurrentQIdx(0);
          setSelected(null);
          setStreak(0);
          setTimedOut(false);
          setStageScore(0);
          setTimerKey(prev => prev + 1);
          setPhase("playing");
          answeringRef.current = false;
        }, 1200);
      }
    }
  };

  // ── Restart / Next ─────────────────────────────────────────────────────────

  const restartStage = () => {
    stageWrongCountRef.current = 0;
    setStageWrongCount(0);
    setCurrentQIdx(0);
    setSelected(null);
    setStreak(0);
    setTimedOut(false);
    setStageScore(0);
    setPhase("playing");
    answeringRef.current = false;
  };

  const handleExit = useCallback(() => {
    saveProgress(completedStages, totalAttempts, false);
    setLocation("/game/maraqui");
  }, [completedStages, totalAttempts, saveProgress]);

  const goNextStage = () => goNextStageFnRef.current();

  // ── Share ──────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!path) return;
    const url = `${window.location.origin}/game/maraqui?pin=${pinRef.current}`;
    const text = `أكملت مَراقي "${path.title}" بـ ${totalAttempts} محاولة! 🏆 جرّبها: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: `مَراقي — ${path.title}`, text }); return; } catch { /* fallback */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Share stage (wrong / stage_clear) ─────────────────────────────────────

  const handleShareStage = async (type: "wrong" | "stage_clear") => {
    if (!path) return;
    const url = `${window.location.origin}/game/maraqui?pin=${pinRef.current}`;
    const text = type === "wrong"
      ? `وصلت للمرحلة ${currentStageNum} في مَراقي "${path.title}"! هل يمكنك التفوق عليّ؟ 🪜 ${url}`
      : `أكملت المرحلة ${currentStageNum}/${path.stages.length} في مَراقي "${path.title}"! انضم الآن 🏆 ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: `مَراقي — ${path.title}`, text }); return; } catch { /* fallback */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStage(true);
      setTimeout(() => setCopiedStage(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Leaderboard helpers ────────────────────────────────────────────────────

  const completedLb = endLeaderboard.filter(r => r.is_complete);
  const playerRankIdx = completedLb.findIndex(r => r.player_name === playerNameRef.current);
  const playerRank = playerRankIdx >= 0 ? playerRankIdx + 1 : null;

  // ── Shuffled options (must be before any early return) ────────────────────

  const { shuffledOptions, shuffledCorrectIdx } = useMemo(() => {
    const q = path?.stages[currentStageNum - 1]?.questions[currentQIdx];
    if (!q) {
      shuffledOptionsRef.current = [];
      return { shuffledOptions: [] as { text: string; originalIdx: number }[], shuffledCorrectIdx: 0 };
    }
    const opts = q.options.map((text, i) => ({ text, originalIdx: i }));
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    shuffledOptionsRef.current = opts;
    const correctIdx = opts.findIndex(o => o.originalIdx === q.correct);
    return { shuffledOptions: opts, shuffledCorrectIdx: correctIdx };
  }, [currentStageNum, currentQIdx, path]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Loading / Error
  if (phase === "loading") {
    if (error) {
      return (
        <Layout>
          <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 flex items-center justify-center p-4" dir={dir}>
            <div className="text-center">
              <p className="text-destructive font-bold text-lg mb-4">{error}</p>
              <button onClick={() => setLocation("/game/maraqui")} className="px-5 py-2.5 rounded-xl bg-teal-500 text-white font-bold">
                {isRtl ? "عودة" : "Back"}
              </button>
            </div>
          </div>
        </Layout>
      );
    }
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/30 dark:via-emerald-950/30 dark:to-cyan-950/30 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  // ── Complete screen ────────────────────────────────────────────────────────

  if (phase === "complete" && path) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 flex items-center justify-center p-4" dir={dir}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center"
          >
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={isRtl} />}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="text-8xl mb-3"
            >
              🏆
            </motion.div>

            <h1 className="text-3xl font-black text-foreground mb-1">
              {isRtl ? "أتقنت المراقي!" : "Mastery Complete!"}
            </h1>
            <p className="text-muted-foreground text-sm mb-4">{path.title}</p>

            {/* Rank badge */}
            {playerRank && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-2 mb-4"
              >
                <span className="text-2xl">
                  {playerRank === 1 ? "🥇" : playerRank === 2 ? "🥈" : playerRank === 3 ? "🥉" : "🏅"}
                </span>
                <span className="font-black text-amber-700 dark:text-amber-300 text-base">
                  {isRtl
                    ? `المرتبة #${playerRank} من أصل ${completedLb.length} لاعب`
                    : `Rank #${playerRank} of ${completedLb.length}`}
                </span>
              </motion.div>
            )}

            {/* Score + Level card */}
            {(() => {
              const lvl = getLevel(score);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-200 dark:border-teal-800/50 rounded-2xl p-5 shadow-md mb-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-teal-700 dark:text-teal-300">{isRtl ? "مجموع نقاطك" : "Your Total Score"}</span>
                    <span className="text-2xl font-black text-teal-600 dark:text-teal-400">{score} نقطة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{lvl.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-foreground">{isRtl ? `مستواك: ${lvl.label}` : `Level: ${lvl.label}`}</p>
                      {lvl.next && (
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (score / lvl.next) * 100).toFixed(0)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {lvl.next && (
                      <span className="text-xs text-muted-foreground font-bold">{lvl.next - score} للمستوى التالي</span>
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {/* Stats card */}
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{isRtl ? "المراحل المكتملة" : "Stages Completed"}</span>
                <span className="font-black text-xl text-teal-600">{path.stages.length}/{path.stages.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{isRtl ? "إجمالي المحاولات" : "Total Attempts"}</span>
                <span className="font-bold text-foreground">{totalAttempts}</span>
              </div>
              <div className="flex justify-center gap-2 pt-1">
                {path.stages.map(s => <span key={s.num} className="text-2xl">⭐</span>)}
              </div>
            </div>

            <div className="mb-4">
              <ShareButtons
                text={isRtl
                  ? `🏆${playerNameRef.current ? ` ${playerNameRef.current} -` : ""} أكملت لعبة المراقي "${path.title}" بنتيجة ${score} نقطة!\nجرّب تتغلب عليّ!`
                  : `🏆${playerNameRef.current ? ` ${playerNameRef.current} -` : ""} I completed Maraqui "${path.title}" with ${score} pts!\nTry to beat me!`}
                url={typeof window !== "undefined" ? window.location.href : ""}
              />
            </div>

            {/* Mini leaderboard */}
            {endLbLoading ? (
              <div className="flex justify-center py-3 mb-4">
                <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
              </div>
            ) : completedLb.length > 0 && (
              <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm mb-4">
                <h3 className="text-sm font-black text-foreground mb-2.5 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  {isRtl ? "المتصدرون" : "Leaderboard"}
                </h3>
                <div className="space-y-1.5">
                  {completedLb.slice(0, 5).map((row, i) => {
                    const isMe = row.player_name === playerNameRef.current;
                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl ${
                          isMe
                            ? "bg-teal-50 dark:bg-teal-900/25 border border-teal-200 dark:border-teal-700"
                            : ""
                        }`}
                      >
                        <span className="w-6 text-center text-sm font-black shrink-0">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                        </span>
                        <span className={`flex-1 text-sm font-bold truncate ${isMe ? "text-teal-700 dark:text-teal-300" : "text-foreground"}`}>
                          {row.player_name}
                          {isMe && <span className="text-xs font-normal text-teal-500 ms-1">← {isRtl ? "أنت" : "you"}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{row.attempts}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleShare}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-lg flex items-center justify-center gap-2 transition-opacity active:opacity-90"
              >
                <Share2 className="w-5 h-5" />
                {copied
                  ? (isRtl ? "تم النسخ! ✓" : "Copied! ✓")
                  : (isRtl ? "شارك نتيجتك" : "Share Result")}
              </button>
              <button
                onClick={() => setLocation(`/game/maraqui?pin=${pinRef.current}`)}
                className="w-full py-3 rounded-2xl bg-card border border-border text-foreground font-bold flex items-center justify-center gap-2"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                {isRtl ? "قائمة المتصدرين الكاملة" : "Full Leaderboard"}
              </button>
              <button
                onClick={() => setLocation("/game/maraqui")}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isRtl ? "استعرض مسارات أخرى" : "Browse other paths"}
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Stage clear screen ─────────────────────────────────────────────────────

  if (phase === "stage_clear" && path) {
    const stage = path.stages[currentStageNum - 1];
    const isLast = currentStageNum >= path.stages.length;
    const nextStage = !isLast ? path.stages[currentStageNum] : null;
    const emoji = STAGE_EMOJIS[(currentStageNum - 1) % STAGE_EMOJIS.length];
    const praise = PRAISE_MESSAGES[(currentStageNum + stageAttempts) % PRAISE_MESSAGES.length];

    return (
      <Layout>
        <ParticleBurst />
        <div
          className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 flex items-center justify-center p-4 relative z-10"
          dir={dir}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center"
          >
            {/* Big emoji */}
            <motion.div
              initial={{ scale: 0, y: -30 }}
              animate={{ scale: [0, 1.35, 1], y: 0 }}
              transition={{ type: "spring", stiffness: 160, duration: 0.65 }}
              className="text-8xl mb-4"
            >
              {emoji}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-3xl font-black text-teal-600 mb-1"
            >
              {isRtl ? "أتقنت المرحلة!" : "Stage Cleared!"}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-base font-bold text-foreground mb-4"
            >
              {stage?.name || (isRtl ? `المرحلة ${currentStageNum}` : `Stage ${currentStageNum}`)}
            </motion.p>

            {/* Praise message */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-3.5 mb-5"
            >
              <p className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-300 leading-relaxed">
                {praise}
              </p>
            </motion.div>

            {/* Next stage announcement */}
            {nextStage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-card border border-border/60 rounded-2xl p-4 mb-5 text-start"
              >
                <p className="text-xs text-muted-foreground mb-1 text-center">
                  {isRtl ? "المرحلة القادمة" : "Next Stage"}
                </p>
                <p className="text-lg font-black text-foreground text-center mb-2">
                  🎉{" "}
                  {isRtl
                    ? `المرحلة ${currentStageNum + 1} — ${nextStage.name}`
                    : `Stage ${currentStageNum + 1} — ${nextStage.name}`}
                </p>
                <div className="flex justify-center">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${DIFF_COLOR[nextStage.difficulty] || "bg-muted text-muted-foreground"}`}>
                    {DIFF_LABEL[nextStage.difficulty] || nextStage.difficulty}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Stage progress bar */}
            <div className="flex justify-center gap-1.5 mb-5">
              {path.stages.map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                    i < currentStageNum ? "bg-teal-500" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Stage score earned */}
            {stageScore > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
              >
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300">{isRtl ? "نقاط هذه المرحلة" : "Stage points"}</span>
                <span className="text-xl font-black text-teal-600 dark:text-teal-400">+{stageScore} ⭐</span>
              </motion.div>
            )}

            {!isLast && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                onClick={goNextStage}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-lg shadow-xl shadow-teal-500/30 transition-opacity active:opacity-90 mb-3"
              >
                {isRtl
                  ? `المرحلة التالية (${autoAdvanceSec})`
                  : `Next Stage (${autoAdvanceSec})`}
              </motion.button>
            )}

            {isLast && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center py-4"
              >
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}

            {!isLast && (
              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                onClick={() => handleShareStage("stage_clear")}
                className="w-full py-2.5 rounded-2xl bg-card border border-border text-foreground text-sm font-bold flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-teal-500" />
                {copiedStage
                  ? (isRtl ? "تم النسخ! ✓" : "Copied! ✓")
                  : (isRtl ? "شارك إنجازك 📤" : "Share Achievement 📤")}
              </motion.button>
            )}
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Stage Fail screen ──────────────────────────────────────────────────────

  if (phase === "stage_fail" && path) {
    const stageFail = path.stages[currentStageNum - 1];
    return (
      <Layout>
        <div
          className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-yellow-950/20 flex items-center justify-center p-4"
          dir={dir}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: 10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-8xl mb-4"
            >
              💪
            </motion.div>

            <h1 className="text-3xl font-black text-foreground mb-2">
              {isRtl ? "حاول مرة أخرى!" : "Try Again!"}
            </h1>
            <p className="text-base text-muted-foreground mb-5">
              {isRtl
                ? `${stageFail?.name || `المرحلة ${currentStageNum}`} — ٣ أخطاء في هذه المرحلة`
                : `${stageFail?.name || `Stage ${currentStageNum}`} — 3 mistakes in this stage`}
            </p>

            {completedStages > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/40 rounded-2xl p-4 mb-5"
              >
                <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
                  {isRtl ? `✅ أكملت ${completedStages} مراحل حتى الآن` : `✅ You've cleared ${completedStages} stages so far`}
                </p>
              </motion.div>
            )}

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={restartStage}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-lg shadow-lg flex items-center justify-center gap-2 mb-3"
            >
              <RotateCcw className="w-5 h-5" />
              {isRtl ? "أعد المرحلة 🔄" : "Retry Stage 🔄"}
            </motion.button>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={handleExit}
              className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isRtl ? "العودة للقائمة" : "Back to menu"}
            </motion.button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── Playing screen ─────────────────────────────────────────────────────────

  if (!path) return null;
  const stage = path.stages[currentStageNum - 1];
  if (!stage) return null;
  const question = stage.questions[currentQIdx];
  if (!question) return null;

  const progressPct = (currentQIdx / stage.questions.length) * 100;
  const timerDuration = getTimerDuration(currentStageNum, stage.difficulty);
  const lvlNow = getLevel(score);

  return (
    <Layout>
      <div
        className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 flex flex-col"
        dir={dir}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            onClick={handleExit}
            className="p-2 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors text-muted-foreground"
          >
            <BackArrow className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-xs font-bold text-muted-foreground">
              {stage.name || (isRtl ? `المرحلة ${stage.num}` : `Stage ${stage.num}`)}
            </p>
            <p className="text-sm font-black text-foreground">{path.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Score + level badge */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base leading-none">{lvlNow.icon}</span>
              <span className={`text-xs font-black ${lvlNow.color}`}>{score}</span>
              <span className="text-[10px] text-muted-foreground">{isRtl ? "نقطة" : "pts"}</span>
            </div>
            {/* Lives indicator — 3 per stage */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground">{isRtl ? "الأرواح" : "Lives"}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`text-xs leading-none ${i < (3 - stageWrongCount) ? "opacity-100" : "opacity-20"}`}>❤️</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              {currentQIdx + 1}/{stage.questions.length}
            </span>
          </div>
          <div className="flex gap-0.5 mt-1.5">
            {path.stages.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i < completedStages ? "bg-teal-500" : i === currentStageNum - 1 ? "bg-teal-300" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main play area */}
        <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-6 px-4 pb-6 gap-4 max-w-lg mx-auto w-full">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={isRtl} />}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentStageNum}-${currentQIdx}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="w-full"
            >
              {/* Timer + Streak + Point gain row */}
              <div className="flex items-center justify-between mb-3 px-1 relative">
                <TimerRing timeLeft={timeLeft} maxTime={timerDuration} />
                <div className="flex-1 flex justify-center px-2">
                  <StreakBadge streak={streak} />
                </div>
                <div className="w-14 relative flex justify-end">
                  <AnimatePresence>
                    {lastPointGain && (
                      <motion.span
                        key={lastPointGain + "-" + currentQIdx}
                        initial={{ opacity: 1, y: 0, scale: 1 }}
                        animate={{ opacity: 0, y: -32, scale: 1.3 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                        className="absolute top-0 right-0 text-sm font-black text-green-600 dark:text-green-400 pointer-events-none select-none"
                      >
                        +{lastPointGain}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Question card */}
              <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl text-center mb-5 min-h-[130px] flex items-center justify-center">
                <p className="text-2xl sm:text-3xl font-black text-foreground leading-relaxed">
                  {question.text}
                </p>
              </div>

              {/* Answer buttons — shuffled */}
              <div className="grid grid-cols-2 gap-3">
                {shuffledOptions.map((opt, i) => {
                  const isSelected = selected === i;
                  const isCorrect = i === shuffledCorrectIdx;
                  const showResult = selected !== null;
                  const isTimeUp = selected === -1;
                  const fbAnim = showResult
                    ? (isSelected && isCorrect
                        ? "fb-correct"
                        : isSelected && !isCorrect && !isTimeUp
                          ? "fb-wrong"
                          : isCorrect
                            ? "fb-revealed"
                            : "")
                    : "";
                  return (
                    <motion.button
                      key={opt.originalIdx}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleAnswer(i)}
                      disabled={selected !== null}
                      className={`relative rounded-2xl text-center transition-all shadow-md min-h-[80px] sm:min-h-[90px] p-4 sm:p-5 flex flex-col items-center justify-center gap-1.5 ${fbAnim} ${
                        showResult
                          ? isCorrect
                            ? "bg-green-500 text-white ring-4 ring-green-300"
                            : isSelected && !isTimeUp
                              ? "bg-red-500 text-white ring-4 ring-red-300"
                              : `${BTN_COLORS[i].bg} ${BTN_COLORS[i].text} opacity-40`
                          : `${BTN_COLORS[i].bg} ${BTN_COLORS[i].text}`
                      }`}
                    >
                      <span className="text-2xl font-bold opacity-70 leading-none">{SHAPE_ICONS[i]}</span>
                      <span className="font-black text-lg sm:text-xl leading-tight">{opt.text}</span>

                      {showResult && isCorrect && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-card rounded-full flex items-center justify-center shadow"
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </motion.div>
                      )}
                      {showResult && isSelected && !isCorrect && !isTimeUp && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-card rounded-full flex items-center justify-center shadow"
                        >
                          <XCircle className="w-5 h-5 text-red-500" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
