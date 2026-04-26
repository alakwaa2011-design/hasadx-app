import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Volume2, VolumeX, Trophy, Crown, Medal, RotateCcw, Home, Flame, Zap, Star, Clock } from "lucide-react";
import { generateQuestion, getRoundTime, calculateScore, getStreakMultiplier, getLevelLabel, getDifficultyLabel } from "@/lib/multiply-engine";
import type { MultiplyQuestion, Difficulty, GameSettings } from "@/lib/multiply-engine";
import { multiplySound } from "@/lib/multiply-sounds";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Phase = "countdown" | "playing" | "correct" | "revealing" | "gameover";

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  streak: number;
}

function getStarRating(level: number): number {
  if (level >= 13) return 5;
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

function StarRating({ stars, lang }: { stars: number; lang: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div key={i} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200 }}>
            <Star className={`w-7 h-7 ${i < stars ? "text-amber-400 fill-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {lang === "ar" ? `${stars} من ٥ نجوم` : `${stars} of 5 stars`}
      </p>
    </div>
  );
}

const VALID_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "challenge"];

function parseSettings(search: string): { table: number | null; difficulty: Difficulty } {
  const params = new URLSearchParams(search);
  const tableParam = params.get("table");
  const diffParam = params.get("difficulty");
  const parsedTable = tableParam ? parseInt(tableParam, 10) : NaN;
  const validTable = !isNaN(parsedTable) && parsedTable >= 2 && parsedTable <= 12 ? parsedTable : null;
  const validDiff = (diffParam && VALID_DIFFICULTIES.includes(diffParam as Difficulty)) ? diffParam as Difficulty : "medium";
  return { table: validTable, difficulty: validDiff };
}

export default function MultiplyPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("multiply");
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const parsed = useMemo(() => parseSettings(searchString), [searchString]);
  const tableRef = useRef(parsed.table);
  const diffRef = useRef(parsed.difficulty);
  tableRef.current = parsed.table;
  diffRef.current = parsed.difficulty;

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countVal, setCountVal] = useState(3);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [question, setQuestion] = useState<MultiplyQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(100);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [muted, setMuted] = useState(multiplySound.muted);
  const [showScorePopup, setShowScorePopup] = useState<number | null>(null);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [totalTimeMs, setTotalTimeMs] = useState(0);

  const roundStart = useRef(0);
  const gameStart = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenAtRef = useRef(0);
  const pendingTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "gameover" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem("multiply-player-name") || ""; } catch { return ""; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimeouts.current.delete(id);
      fn();
    }, ms);
    pendingTimeouts.current.add(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    pendingTimeouts.current.forEach(id => clearTimeout(id));
    pendingTimeouts.current.clear();
  }, []);

  const getSettings = useCallback((): GameSettings => ({
    table: tableRef.current,
    difficulty: diffRef.current,
  }), []);

  const startRound = useCallback((lvl: number) => {
    clearTimer();
    const s = getSettings();
    const q = generateQuestion(lvl, s);
    setQuestion(q);
    setSelectedIdx(null);
    setTimeLeft(100);
    setPhase("playing");
    roundStart.current = Date.now();
    if (gameStart.current === 0) gameStart.current = Date.now();
    multiplySound.startBackground();

    const totalMs = getRoundTime(lvl, s.difficulty) * 1000;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundStart.current;
      const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
      const remainingMs = totalMs - elapsed;
      setTimeLeft(pct);
      if (remainingMs <= 3000 && remainingMs > 2950) multiplySound.playTick();
      if (remainingMs <= 2000 && remainingMs > 1950) multiplySound.playTick();
      if (remainingMs <= 1000 && remainingMs > 950) multiplySound.playTick();
      if (pct <= 0) {
        clearTimer();
        multiplySound.playWrong();
        setTotalTimeMs(Date.now() - gameStart.current);
        setPhase("revealing");
        safeTimeout(() => {
          multiplySound.playGameOver();
          setPhase("gameover");
        }, 2000);
      }
    }, 50);
  }, [clearTimer, getSettings, safeTimeout]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        clearTimer();
      } else if (hiddenAtRef.current > 0) {
        const away = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = 0;
        if (away > 0) {
          roundStart.current += away;
          if (gameStart.current > 0) gameStart.current += away;
        }
        if (phase === "playing" && question) {
          const s = getSettings();
          const totalMs = getRoundTime(level, s.difficulty) * 1000;
          timerRef.current = setInterval(() => {
            const elapsed = Date.now() - roundStart.current;
            const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
            const remainingMs = totalMs - elapsed;
            setTimeLeft(pct);
            if (remainingMs <= 3000 && remainingMs > 2950) multiplySound.playTick();
            if (remainingMs <= 2000 && remainingMs > 1950) multiplySound.playTick();
            if (remainingMs <= 1000 && remainingMs > 950) multiplySound.playTick();
            if (pct <= 0) {
              clearTimer();
              multiplySound.playWrong();
              setTotalTimeMs(Date.now() - gameStart.current);
              setPhase("revealing");
              safeTimeout(() => {
                multiplySound.playGameOver();
                setPhase("gameover");
              }, 2000);
            }
          }, 50);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, level, question, clearTimer, getSettings, safeTimeout]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "countdown" && countVal > 0) {
      t = setTimeout(() => setCountVal(c => c - 1), 800);
    } else if (phase === "countdown" && countVal === 0) {
      t = setTimeout(() => startRound(1), 400);
    }
    return () => clearTimeout(t);
  }, [phase, countVal, startRound]);

  useEffect(() => {
    return () => {
      clearTimer();
      clearAllTimeouts();
      multiplySound.stopBackground();
    };
  }, [clearTimer, clearAllTimeouts]);

  const handleChoice = (choiceIdx: number) => {
    if (phase !== "playing" || !question || selectedIdx !== null) return;
    setSelectedIdx(choiceIdx);
    clearTimer();
    const elapsed = Date.now() - roundStart.current;
    const chosen = question.choices[choiceIdx];
    const diff = diffRef.current;

    if (chosen === question.answer) {
      const newStreak = streak + 1;
      const pts = calculateScore(level, elapsed, newStreak, diff);
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setScore(s => s + pts);
      setShowScorePopup(pts);
      multiplySound.playCorrect();

      if (newStreak > 0 && (newStreak === 5 || newStreak === 10 || newStreak === 15 || newStreak === 20)) {
        setStreakMilestone(newStreak);
        safeTimeout(() => {
          multiplySound.playStreak();
          safeTimeout(() => setStreakMilestone(null), 1500);
        }, 200);
      }

      setPhase("correct");
      const newLevel = level + 1;
      if (newLevel === 4 || newLevel === 8 || newLevel === 13) {
        safeTimeout(() => multiplySound.playLevelUp(), 300);
      }

      safeTimeout(() => {
        setShowScorePopup(null);
        setLevel(newLevel);
        startRound(newLevel);
      }, 1000);
    } else {
      multiplySound.playWrong();
      setTotalTimeMs(Date.now() - gameStart.current);
      setPhase("revealing");
      safeTimeout(() => {
        multiplySound.playGameOver();
        setPhase("gameover");
      }, 2000);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    multiplySound.setMuted(next);
    if (!next && phase === "playing") {
      multiplySound.startBackground();
    }
  };

  const handleRestart = () => {
    clearTimer();
    clearAllTimeouts();
    multiplySound.stopBackground();
    setPhase("countdown");
    setCountVal(3);
    setLevel(1);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSelectedIdx(null);
    setQuestion(null);
    setSaved(false);
    setTotalTimeMs(0);
    gameStart.current = 0;
  };

  const handleSave = async () => {
    if (!playerName.trim() || saving || saved) return;
    setSaving(true);
    try {
      localStorage.setItem("multiply-player-name", playerName.trim());
    } catch {}
    try {
      const res = await fetch(`${API_BASE}/api/multiply-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName.trim(),
          score,
          level,
          streak: bestStreak,
          timeMs: totalTimeMs,
          difficulty: diffRef.current,
        }),
      });
      if (res.ok) {
        setSaved(true);
        const lb = await fetch(`${API_BASE}/api/multiply-scores?difficulty=${diffRef.current}`);
        if (lb.ok) {
          const data = await lb.json();
          setLeaderboard(Array.isArray(data) ? data : []);
        }
      }
    } catch {}
    setSaving(false);
  };

  useEffect(() => {
    if (phase === "gameover") {
      fetch(`${API_BASE}/api/multiply-scores?difficulty=${diffRef.current}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setLeaderboard(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [phase]);

  const streakMult = getStreakMultiplier(streak);
  const timerColor = timeLeft > 50 ? "bg-green-500" : timeLeft > 25 ? "bg-yellow-500" : "bg-red-500";

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  }

  const settingsBadge = parsed.table
    ? (lang === "ar" ? `جدول ${parsed.table}` : `×${parsed.table}`)
    : (lang === "ar" ? "عشوائي" : "Random");

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-yellow-950/20 py-4 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={lang === "ar"} />}
          {phase !== "gameover" && (
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { clearTimer(); multiplySound.stopBackground(); setLocation("/game/multiply"); }}
                className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
                <BackArrow className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                {phase === "playing" && streak >= 3 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">{streak}</span>
                    <span className="text-[10px] text-orange-500">{"\u00d7"}{streakMult}</span>
                  </motion.div>
                )}
                <div className="px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">{settingsBadge}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-card border border-border/60">
                  <span className="text-xs font-bold text-muted-foreground">
                    {lang === "ar" ? `المستوى ${level}` : `Lvl ${level}`}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <span className="text-sm font-black text-orange-600 dark:text-orange-400">{score}</span>
                </div>
              </div>
              <button onClick={handleToggleMute}
                className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {phase === "countdown" && (
              <motion.div key="cd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[60vh]">
                <motion.div key={countVal} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  className="text-8xl font-black text-orange-500">{countVal || (lang === "ar" ? "ابدأ!" : "GO!")}</motion.div>
                <p className="text-muted-foreground mt-4 text-sm font-bold">{lang === "ar" ? "استعد..." : "Get ready..."}</p>
                {parsed.table && (
                  <p className="text-orange-500 mt-2 text-lg font-black">
                    {lang === "ar" ? `جدول ${parsed.table}` : `Table ${parsed.table}`}
                  </p>
                )}
              </motion.div>
            )}

            {(phase === "playing" || phase === "correct" || phase === "revealing") && question && (
              <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
                {phase === "playing" && (
                  <div className="w-full h-2 bg-muted rounded-full mb-6 overflow-hidden">
                    <motion.div className={`h-full rounded-full ${timerColor} transition-colors duration-300`}
                      style={{ width: `${timeLeft}%` }} />
                  </div>
                )}

                {phase === "revealing" && (
                  <div className="w-full h-2 bg-red-200 dark:bg-red-900/30 rounded-full mb-6" />
                )}

                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  className="bg-card border border-border/60 rounded-3xl p-8 shadow-xl mb-6 text-center relative overflow-hidden">
                  <p className="text-muted-foreground text-xs font-bold mb-2">
                    {lang === "ar" ? getLevelLabel(level, "ar") : getLevelLabel(level, "en")}
                  </p>
                  <div className="text-5xl font-black text-foreground mb-2" dir="ltr">
                    {question.a} {"\u00d7"} {question.b}
                  </div>
                  <p className="text-muted-foreground text-sm">= ?</p>

                  <AnimatePresence>
                    {showScorePopup !== null && (
                      <motion.div initial={{ y: 0, opacity: 1, scale: 1 }} animate={{ y: -40, opacity: 0, scale: 1.3 }}
                        transition={{ duration: 0.8 }} className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span className="text-lg font-black text-orange-500">+{showScorePopup}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <div className="grid grid-cols-2 gap-3">
                  {question.choices.map((choice, idx) => {
                    const isCorrect = choice === question.answer;
                    const isSelected = selectedIdx === idx;
                    const isRevealPhase = phase === "revealing";
                    const isCorrectPhase = phase === "correct";

                    let bg = "bg-card border-border/60 hover:border-orange-400/60 hover:shadow-lg active:scale-95";
                    let ring = "";
                    let icon = "";

                    if (isCorrectPhase && isSelected && isCorrect) {
                      bg = "bg-green-50 dark:bg-green-950/30 border-green-500";
                      ring = "ring-4 ring-green-400/50";
                      icon = "\u2713";
                    } else if (isRevealPhase) {
                      if (isSelected && !isCorrect) {
                        bg = "bg-red-50 dark:bg-red-950/30 border-red-500";
                        ring = "ring-4 ring-red-400/50";
                        icon = "\u2717";
                      } else if (isCorrect) {
                        bg = "bg-green-50 dark:bg-green-950/30 border-green-500";
                        ring = "ring-4 ring-green-400/50 animate-pulse";
                        icon = "\u2713";
                      }
                    }

                    return (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleChoice(idx)}
                        disabled={phase !== "playing" || selectedIdx !== null}
                        className={`relative border rounded-2xl p-5 shadow-md transition-all ${bg} ${ring} disabled:cursor-default`}
                      >
                        <span className="text-2xl font-black text-foreground">{choice}</span>
                        {icon && (
                          <span className={`absolute top-2 ${isRtl ? "left-2" : "right-2"} text-lg font-black ${icon === "\u2713" ? "text-green-500" : "text-red-500"}`}>
                            {icon}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {phase === "playing" && streak >= 3 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                        {lang === "ar" ? `سلسلة ${streak}` : `${streak} streak`} {"\ud83d\udd25"}
                      </span>
                      <span className="text-xs text-orange-500">{"\u00d7"}{streakMult}</span>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {streakMilestone !== null && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                    >
                      <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl px-8 py-6 shadow-2xl text-center">
                        <p className="text-5xl mb-2">{"\ud83d\udd25"}</p>
                        <p className="text-white font-black text-2xl">
                          {lang === "ar" ? `سلسلة ${streakMilestone}!` : `${streakMilestone} Streak!`}
                        </p>
                        <p className="text-white/80 text-sm font-bold mt-1">
                          {"\u00d7"}{getStreakMultiplier(streakMilestone)} {lang === "ar" ? "مضاعف" : "multiplier"}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {phase === "gameover" && (
              <motion.div key="go" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="min-h-[60vh]">
                <div className="text-center mb-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-2xl shadow-orange-500/40 mb-4">
                    <Trophy className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-black text-foreground mb-3">{lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}</h2>

                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold">
                      {parsed.table ? (lang === "ar" ? `جدول ${parsed.table}` : `Table ${parsed.table}`) : (lang === "ar" ? "عشوائي" : "Random")}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                      {getDifficultyLabel(parsed.difficulty, lang)}
                    </span>
                  </div>

                  <StarRating stars={getStarRating(level)} lang={lang} />

                  <div className="flex items-center justify-center gap-3 mt-4">
                    <div className="text-center">
                      <p className="text-3xl font-black text-orange-500">{score}</p>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? "النقاط" : "Score"}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <p className="text-3xl font-black text-foreground">{level}</p>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? "المستوى" : "Level"}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <p className="text-3xl font-black text-amber-500">{bestStreak}</p>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? "أفضل سلسلة" : "Best Streak"}</p>
                    </div>
                    <div className="w-px h-10 bg-border" />
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xl font-black text-foreground" dir="ltr">{formatTime(totalTimeMs)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? "الوقت" : "Time"}</p>
                    </div>
                  </div>
                </div>

                {!saved && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-card border border-border/60 rounded-2xl p-4 shadow-lg mb-4">
                    <p className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "سجّل نتيجتك" : "Save your score"}</p>
                    <div className="flex gap-2">
                      <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
                        placeholder={lang === "ar" ? "اسمك" : "Your name"} maxLength={30}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm font-bold placeholder:text-muted-foreground focus:outline-none focus:border-orange-400" />
                      <button onClick={handleSave} disabled={saving || !playerName.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black text-sm disabled:opacity-50 transition-all">
                        {saving ? "..." : (lang === "ar" ? "حفظ" : "Save")}
                      </button>
                    </div>
                  </motion.div>
                )}

                {saved && (
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    className="bg-green-50 dark:bg-green-950/20 border border-green-500/30 rounded-2xl p-3 text-center mb-4">
                    <p className="text-green-600 dark:text-green-400 font-bold text-sm">
                      {lang === "ar" ? "\u2713 تم حفظ النتيجة!" : "\u2713 Score saved!"}
                    </p>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-4 flex justify-center">
                  <ShareButtons
                    text={lang === "ar"
                      ? `🧮${playerName.trim() ? ` ${playerName.trim()} -` : ""} حصلت على ${score} نقطة في جدول الضرب!\n📊 ${parsed.table ? `جدول ${parsed.table}` : "عشوائي"} • ${getDifficultyLabel(parsed.difficulty, lang)}\n⭐ ${getStarRating(level)} نجوم | المستوى ${level} | 🔥 سلسلة ${bestStreak} | ⏱ ${formatTime(totalTimeMs)}\nالعب الآن!`
                      : `🧮${playerName.trim() ? ` ${playerName.trim()} -` : ""} I scored ${score} points in Multiplication!\n📊 ${parsed.table ? `Table ${parsed.table}` : "Random"} • ${getDifficultyLabel(parsed.difficulty, lang)}\n⭐ ${getStarRating(level)} stars | Level ${level} | 🔥 Streak ${bestStreak} | ⏱ ${formatTime(totalTimeMs)}\nPlay now!`}
                    url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/multiply"}
                  />
                </motion.div>

                {leaderboard.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-card border border-border/60 rounded-2xl p-4 shadow-lg mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <h3 className="font-black text-foreground text-sm">{lang === "ar" ? "لوحة المتصدرين" : "Leaderboard"}</h3>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        {getDifficultyLabel(parsed.difficulty, lang)}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                      {leaderboard.map((entry, i) => (
                        <div key={entry.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl ${i === 0 ? "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20" : i < 3 ? "bg-muted/50" : ""}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"}`}>
                            {i === 0 ? <Crown className="w-3.5 h-3.5" /> : i < 3 ? <Medal className="w-3.5 h-3.5" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground text-xs truncate">{entry.name}</p>
                          </div>
                          <span className="font-black text-orange-600 dark:text-orange-400 text-xs">{entry.score}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleRestart}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black shadow-lg">
                    <RotateCcw className="w-5 h-5" />
                    {lang === "ar" ? "العب مرة أخرى" : "Play Again"}
                  </button>
                  <button onClick={() => { multiplySound.stopBackground(); setLocation("/game/multiply"); }}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-card border border-border/60 text-foreground font-bold">
                    <Home className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
