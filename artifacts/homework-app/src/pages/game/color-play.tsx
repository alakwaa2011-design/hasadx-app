import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Volume2, VolumeX, RotateCcw, Trophy, Flame, Star, Crown, Medal, Heart, Eye } from "lucide-react";
import { ConfettiBurst } from "@/components/confetti-burst";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { generateLevel, getBaseColor, getDiffColor, calculateScore, getRoundTime, type ColorLevel } from "@/lib/color-engine";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";
import { colorSound } from "@/lib/color-sounds";
import { LevelUpSplash } from "@/components/level-up-splash";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Phase = "playing" | "correct" | "revealing" | "gameover";

interface LbEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  timeMs?: number;
}

export default function ColorPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("color");

  const [phase, setPhase] = useState<Phase>("playing");
  const [level, setLevel] = useState(1);
  const [splashLevel, setSplashLevel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<ColorLevel | null>(null);
  const [muted, setMuted] = useState(colorSound.muted);
  const [timer, setTimer] = useState(10);
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const [wrongClickIndex, setWrongClickIndex] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LbEntry[]>([]);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [autoSaveMsg, setAutoSaveMsg] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundStartRef = useRef(0);
  const gameOverPlayedRef = useRef(false);
  const gameStartTimeRef = useRef(Date.now());
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "gameover" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/color-scores`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d.slice(0, 10) : []))
      .catch(() => {});
  }, []);

  const refreshLeaderboard = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/color-scores`);
      if (r.ok) {
        const d = await r.json();
        setLeaderboard(Array.isArray(d) ? d.slice(0, 10) : []);
      }
    } catch {}
  };

  const getRoundTime = (lvl: number) => {
    if (lvl <= 4) return 10;
    if (lvl <= 8) return 12;
    if (lvl <= 12) return 14;
    if (lvl <= 16) return 16;
    return Math.min(20, 16 + Math.floor((lvl - 16) / 4) * 2);
  };

  const startRound = useCallback((lvl: number) => {
    const newLevel = generateLevel(lvl);
    const roundTime = getRoundTime(lvl);
    setCurrentLevel(newLevel);
    setPhase("playing");
    setTimer(roundTime);
    setRevealIndex(null);
    setWrongClickIndex(null);
    roundStartRef.current = Date.now();

    clearTimer();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - roundStartRef.current) / 1000;
      const remaining = Math.max(0, roundTime - elapsed);
      setTimer(remaining);
      if (remaining <= 3 && remaining > 2.9) colorSound.playTick();
      if (remaining <= 0) {
        clearTimer();
        setRevealIndex(newLevel.diffIndex);
        setWrongClickIndex(null);
        setTotalTimeMs(Date.now() - gameStartTimeRef.current);
        setPhase("revealing");
        colorSound.playWrong();
      }
    }, 50);
  }, []);

  useEffect(() => {
    colorSound.startBackground();
    startRound(1);
    return () => { clearTimer(); };
  }, [startRound]);

  useEffect(() => {
    return () => { colorSound.stopBackground(); };
  }, []);

  const handleCellClick = (index: number) => {
    if (phase !== "playing" || !currentLevel) return;
    clearTimer();
    const timeMs = Math.max(0, Date.now() - roundStartRef.current);

    if (index === currentLevel.diffIndex) {
      const pts = calculateScore(level, timeMs);
      setScore(prev => prev + pts);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      setPhase("correct");
      if (newStreak >= 3) colorSound.playLevelUp();
      else colorSound.playCorrect();
      setTimeout(() => {
        const nextLvl = level + 1;
        setLevel(nextLvl);
        if (nextLvl % 5 === 0) {
          setSplashLevel(nextLvl);
          setTimeout(() => setSplashLevel(null), 1300);
        }
        startRound(nextLvl);
      }, 600);
    } else {
      setRevealIndex(currentLevel.diffIndex);
      setWrongClickIndex(index);
      setTotalTimeMs(Date.now() - gameStartTimeRef.current);
      setPhase("revealing");
      colorSound.playWrong();
      colorSound.stopBackground();
    }
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    colorSound.setMuted(newMuted);
    if (!newMuted && phase === "playing") colorSound.startBackground();
  };

  useEffect(() => {
    if (phase !== "revealing") return;
    const timeout = setTimeout(() => {
      setPhase("gameover");
    }, 2000);
    return () => clearTimeout(timeout);
  }, [phase]);

  const handleRestart = () => {
    setLevel(1);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setTotalTimeMs(0);
    setSaved(false);
    setShowNameInput(false);
    setIsNewRecord(false);
    setAutoSaveMsg("");
    setWrongClickIndex(null);
    gameOverPlayedRef.current = false;
    gameStartTimeRef.current = Date.now();
    colorSound.startBackground();
    startRound(1);
  };

  const handleSaveScore = async () => {
    if (!playerName.trim() || saving) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/color-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim(), score, level, timeMs: totalTimeMs }),
      });
      setSaved(true);
      await refreshLeaderboard();

      const lowestLb = leaderboard.length >= 10 ? leaderboard[leaderboard.length - 1]?.score ?? 0 : 0;
      if (score > lowestLb || leaderboard.length < 10) {
        setIsNewRecord(true);
        if (lang === "ar") {
          setAutoSaveMsg("عينك حادة جداً! أنت بطل حقيقي 🏆 واصل التطوير!");
        } else {
          setAutoSaveMsg("Sharp eyes! You're a true champion 🏆 Keep improving!");
        }
      }
    } catch {}
    setSaving(false);
  };

  const currentRoundTime = getRoundTime(level);
  const timerPercent = (timer / currentRoundTime) * 100;
  const isUrgent = timer <= 3;

  const leaderboardPanel = (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-black text-white/80">{lang === "ar" ? "المتصدرون" : "Top Players"}</span>
      </div>
      {leaderboard.length === 0 ? (
        <p className="text-white/30 text-[10px] text-center py-2">{lang === "ar" ? "لا نتائج بعد" : "No scores yet"}</p>
      ) : (
        <div className="space-y-1">
          {leaderboard.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-[10px] ${i === 0 ? "bg-amber-500/10" : ""}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[8px] shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 dark:bg-slate-600 text-white" : i === 2 ? "bg-orange-600 text-white" : "bg-white/10 text-white/50"}`}>
                {i === 0 ? <Crown className="w-2.5 h-2.5" /> : i < 3 ? <Medal className="w-2.5 h-2.5" /> : i + 1}
              </span>
              <span className="font-bold text-white/70 truncate flex-1 min-w-0">{e.name}</span>
              <span className="font-black text-amber-400 shrink-0">{e.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (phase === "gameover" && !gameOverPlayedRef.current) {
    gameOverPlayedRef.current = true;
    colorSound.playGameOver();
  }

  if (phase === "gameover") {
    const finalLevel = level;
    const stars = finalLevel >= 10 ? 5 : finalLevel >= 7 ? 4 : finalLevel >= 4 ? 3 : finalLevel >= 2 ? 2 : 1;
    const timeSec = Math.floor(totalTimeMs / 1000);
    const timeStr = `${Math.floor(timeSec / 60)}:${String(timeSec % 60).padStart(2, "0")}`;

    const lowestLbScore = leaderboard.length >= 10 ? leaderboard[leaderboard.length - 1]?.score ?? 0 : 0;
    const beatLeaderboard = score > lowestLbScore || leaderboard.length < 10;
    const showCelebration = finalLevel >= 5;

    return (
      <Layout>
        <ConfettiBurst active={showCelebration} />
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex items-center justify-center px-4 py-6" dir={dir}>
          <div className="max-w-md mx-auto w-full">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-5">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="text-6xl mb-3"
              >
                {stars >= 4 ? "🏆" : stars >= 3 ? "🎉" : stars >= 2 ? "😤" : "😢"}
              </motion.div>
              <h1 className="text-2xl font-black text-white mb-2">{lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}</h1>

              <div className="flex justify-center gap-1.5 my-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 300 }}
                  >
                    <Star className={`w-7 h-7 ${i < stars ? "text-amber-400 fill-amber-400 drop-shadow-lg" : "text-white/20"}`} />
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3 bg-white/5 rounded-2xl p-3">
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-bold mb-0.5">{lang === "ar" ? "النقاط" : "Score"}</p>
                  <p className="text-lg font-black text-amber-400">{score}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-bold mb-0.5">{lang === "ar" ? "المستوى" : "Level"}</p>
                  <p className="text-lg font-black text-emerald-400">{finalLevel}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-bold mb-0.5">{lang === "ar" ? "الوقت" : "Time"}</p>
                  <p className="text-lg font-black text-sky-400" dir="ltr">{timeStr}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-bold mb-0.5">{lang === "ar" ? "سلسلة" : "Streak"}</p>
                  <p className="text-lg font-black text-orange-400">{maxStreak}🔥</p>
                </div>
              </div>
            </motion.div>

            {beatLeaderboard && !saved && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
                <p className="text-center text-amber-400 font-black text-sm mb-3">
                  🎉 {lang === "ar" ? "نتيجة مميزة! سجّل اسمك في لوحة المتصدرين!" : "Amazing score! Save your name to the leaderboard!"}
                </p>
                <input
                  type="text"
                  maxLength={20}
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                  className="w-full text-center text-lg font-bold py-3 px-4 rounded-xl bg-white/10 border-2 border-amber-500/30 text-white focus:border-amber-500 focus:outline-none transition-colors mb-3"
                  onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                  autoFocus
                />
                <button onClick={handleSaveScore} disabled={!playerName.trim() || saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-lg disabled:opacity-50">
                  {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "سجّل نتيجتك" : "Save Score")}
                </button>
              </motion.div>
            )}

            {!beatLeaderboard && !saved && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                {!showNameInput ? (
                  <button onClick={() => setShowNameInput(true)} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2">
                    <Trophy className="w-5 h-5" />
                    {lang === "ar" ? "سجّل نتيجتك في لوحة المتصدرين" : "Save to Leaderboard"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      maxLength={20}
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                      className="w-full text-center text-lg font-bold py-3 px-4 rounded-xl bg-white/10 border-2 border-white/20 text-white focus:border-amber-500 focus:outline-none transition-colors"
                      onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                      autoFocus
                    />
                    <button onClick={handleSaveScore} disabled={!playerName.trim() || saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-lg disabled:opacity-50">
                      {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ" : "Save")}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {saved && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
                {isNewRecord ? (
                  <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                    <div className="text-4xl mb-2">🧠✨</div>
                    <p className="text-emerald-400 font-black text-base mb-1">{autoSaveMsg}</p>
                    <p className="text-white/50 text-xs">{lang === "ar" ? "تم حفظ نتيجتك في لوحة المتصدرين!" : "Your score has been saved to the leaderboard!"}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-emerald-400 font-bold text-sm">✓ {lang === "ar" ? "تم حفظ نتيجتك!" : "Score saved!"}</p>
                  </div>
                )}
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={handleRestart} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" />
                {lang === "ar" ? "حاول مرة أخرى" : "Try Again"}
              </button>
              <ShareButtons
                text={lang === "ar"
                  ? `🎨${playerName.trim() ? ` ${playerName.trim()} -` : ""} حصلت على ${score} نقطة ووصلت للمستوى ${finalLevel} في لعبة "لعبة الألوان"!\n⏱ ${timeStr} | 🔥 سلسلة ${maxStreak}\nجرّب تتغلب عليّ!`
                  : `🎨${playerName.trim() ? ` ${playerName.trim()} -` : ""} I scored ${score} points and reached level ${finalLevel} in Color Game!\n⏱ ${timeStr} | 🔥 Streak ${maxStreak}\nTry to beat me!`}
                url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/color"}
              />
              <button onClick={() => setLocation("/game/color")} className="w-full py-2 text-sm font-medium text-white/50 hover:text-white transition-colors flex items-center justify-center gap-1.5">
                <Home className="w-4 h-4" />
                {lang === "ar" ? "العودة" : "Back"}
              </button>
            </div>

            {beatLeaderboard && (
              <div className="mt-4">
                {leaderboardPanel}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <LevelUpSplash show={splashLevel !== null} level={splashLevel ?? 0} theme="fuchsia" />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 flex flex-col items-center justify-center px-3 py-4" dir={dir}>
        <div className="w-full max-w-sm mx-auto">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={lang === "ar"} />}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
                <Eye className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-black text-violet-300">
                  {lang === "ar" ? `م${level}` : `Lv${level}`}
                </span>
              </div>
              <button onClick={toggleMute} className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <AnimatePresence>
                {streak >= 3 && (
                  <motion.div
                    initial={{ scale: 0, x: 10 }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-black text-orange-300">{streak}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                <span className="font-black text-white text-sm">{score}</span>
                <span className="text-white/40 text-[10px] ms-1">{lang === "ar" ? "نقطة" : "pts"}</span>
              </div>
            </div>
          </div>

          <div className={`h-2 rounded-full overflow-hidden mb-4 relative ${isUrgent ? "bg-red-900/40" : "bg-white/10"}`}>
            <motion.div
              className={`h-full rounded-full transition-colors duration-500 ${isUrgent ? "bg-gradient-to-r from-red-600 to-rose-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.1 }}
            />
            {isUrgent && (
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-red-500/20"
              />
            )}
          </div>

          <AnimatePresence mode="wait">
            {currentLevel && (
                <motion.div key={level} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}>
                  <div className={`backdrop-blur-sm rounded-2xl shadow-2xl p-3 sm:p-4 mb-4 overflow-hidden transition-all border ${
                    phase === "correct"
                      ? "bg-emerald-500/10 border-emerald-500/40 shadow-emerald-500/20"
                      : phase === "revealing"
                        ? "bg-red-500/10 border-red-500/40 shadow-red-500/20"
                        : "bg-white/5 border-white/10"
                  }`}>
                    <p className={`text-center text-sm font-bold mb-3 ${phase === "revealing" ? "text-red-400" : phase === "correct" ? "text-emerald-400" : "text-white/60"}`}>
                      {phase === "revealing"
                        ? (lang === "ar" ? "المربع الصحيح هنا! ✓" : "The correct tile is here! ✓")
                        : phase === "correct"
                          ? (lang === "ar" ? "أحسنت! 🎯" : "Nice find! 🎯")
                          : (lang === "ar" ? "ابحث عن المربع المختلف!" : "Find the different color!")}
                    </p>
                    <div
                      className="grid mx-auto w-full"
                      style={{
                        gridTemplateColumns: `repeat(${currentLevel.gridSize}, 1fr)`,
                        gap: currentLevel.gridSize <= 3 ? "6px" : currentLevel.gridSize <= 5 ? "4px" : "3px",
                        maxWidth: "100%",
                      }}
                    >
                      {Array.from({ length: currentLevel.gridSize * currentLevel.gridSize }).map((_, i) => {
                        const isDiff = i === currentLevel.diffIndex;
                        const showReveal = phase === "correct" && isDiff;
                        const isRevealing = phase === "revealing";
                        const isRevealCorrect = isRevealing && isDiff;
                        const isRevealWrong = isRevealing && i === wrongClickIndex;
                        return (
                          <motion.button
                            key={i}
                            whileTap={phase === "playing" ? { scale: 0.9 } : undefined}
                            onClick={() => handleCellClick(i)}
                            disabled={isRevealing}
                            className={`aspect-square rounded transition-all ${isRevealing ? "cursor-default" : "cursor-pointer hover:brightness-110"} ${showReveal ? "ring-2 ring-white shadow-lg shadow-white/20" : ""} ${isRevealCorrect ? "ring-4 ring-emerald-400 shadow-lg shadow-emerald-400/40 z-10 fb-correct" : ""} ${isRevealWrong ? "ring-4 ring-red-500 shadow-lg shadow-red-500/40 fb-wrong" : ""}`}
                            style={{ backgroundColor: isDiff ? getDiffColor(currentLevel) : getBaseColor(currentLevel) }}
                          >
                            {isRevealWrong && (
                              <span className="text-red-500 font-black text-lg drop-shadow-lg">✕</span>
                            )}
                            {isRevealCorrect && (
                              <span className="text-white font-black text-lg drop-shadow-lg">✓</span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-white/30 text-xs">
                      {lang === "ar" ? `${currentLevel.gridSize}×${currentLevel.gridSize} شبكة` : `${currentLevel.gridSize}×${currentLevel.gridSize} grid`}
                    </p>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function FillBlankInput({
  isAr,
  disabled,
  onSubmit,
}: {
  isAr: boolean;
  disabled: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex gap-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isAr ? "اكتب الإجابة..." : "Type your answer..."}
        className="flex-1 text-lg font-bold px-4 py-3 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-primary"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
        }}
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        className="px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-50"
      >
        {isAr ? "إرسال" : "Submit"}
      </button>
    </div>
  );
}
