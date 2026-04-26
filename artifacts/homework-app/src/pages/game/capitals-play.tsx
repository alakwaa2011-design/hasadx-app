import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trophy, RotateCcw, Home, Flame, Star, Target, Percent, Timer, Volume2, VolumeX, Crown, Medal, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";
import {
  type CapitalCountry, type CapitalQuestionMode, type CapitalQuestion,
  getCapitalsByTier, generateCapitalQuestions, CAPITAL_LEVELS, getFlagUrl,
} from "@/data/capitals";
import { flagSound } from "@/lib/flag-sounds";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface LbEntry {
  id: number;
  name: string;
  score: number;
  correct: number;
  total: number;
  tier: number;
}

type Phase = "answering" | "feedback" | "results";

const OPTION_COLORS = [
  { bg: "bg-red-500", hover: "hover:bg-red-600", selected: "bg-red-600 ring-4 ring-red-300", text: "text-white" },
  { bg: "bg-blue-500", hover: "hover:bg-blue-600", selected: "bg-blue-600 ring-4 ring-blue-300", text: "text-white" },
  { bg: "bg-amber-500", hover: "hover:bg-amber-600", selected: "bg-amber-600 ring-4 ring-amber-300", text: "text-white" },
  { bg: "bg-green-500", hover: "hover:bg-green-600", selected: "bg-green-600 ring-4 ring-green-300", text: "text-white" },
];

const OPTION_SHAPES = ["▲", "◆", "●", "■"];

interface RoundResult {
  country: CapitalCountry;
  correct: boolean;
  timeMs: number;
}

export default function CapitalsPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const { isArenaMode, myName, opponents, results: arenaResults, updateScore, finishArena } = useArena("capitals");

  const rawTier = parseInt(params.get("tier") || "1");
  const rawCount = parseInt(params.get("count") || "20");
  const rawDuration = parseInt(params.get("duration") || "7");
  const qmode = (params.get("qmode") || "mixed") as CapitalQuestionMode;
  const isMulti = !!params.get("pin");
  const tier = Math.min(4, Math.max(1, Number.isFinite(rawTier) ? rawTier : 1)) as 1 | 2 | 3 | 4;
  const count = Math.min(200, Math.max(5, Number.isFinite(rawCount) ? rawCount : 20));
  const duration = isMulti ? Math.max(1, Number.isFinite(rawDuration) ? rawDuration : 7) : 7;

  const levelInfo = CAPITAL_LEVELS.find(l => l.tier === tier) || CAPITAL_LEVELS[0];

  const [questions, setQuestions] = useState<CapitalQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [gameStartTime, setGameStartTime] = useState(Date.now());
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [feedbackType, setFeedbackType] = useState<"correct" | "wrong" | null>(null);
  const [timer, setTimer] = useState(duration);
  const [muted, setMuted] = useState(flagSound.muted);
  const [leaderboard, setLeaderboard] = useState<LbEntry[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicStarted = useRef(false);
  const phaseRef = useRef(phase);
  const currentIdxRef = useRef(currentIdx);
  const questionsRef = useRef(questions);
  const arenaFinishedRef = useRef(false);
  phaseRef.current = phase;
  currentIdxRef.current = currentIdx;
  questionsRef.current = questions;

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "results" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  useEffect(() => {
    const pool = getCapitalsByTier(tier);
    const qs = generateCapitalQuestions(pool, count, qmode);
    setQuestions(qs);
  }, [tier, count, qmode]);

  useEffect(() => {
    fetch(`${API_BASE}/api/capital-scores`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d.slice(0, 10) : []))
      .catch(() => {});
  }, []);

  const refreshLeaderboard = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/capital-scores`);
      if (r.ok) {
        const d = await r.json();
        setLeaderboard(Array.isArray(d) ? d.slice(0, 10) : []);
      }
    } catch {}
  };

  const handleSaveScore = async () => {
    if (!playerName.trim() || saving) return;
    setSaving(true);
    try {
      const totalTime = Date.now() - gameStartTime;
      const r = await fetch(`${API_BASE}/api/capital-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: playerName.trim(),
          score,
          correct: correctCount,
          total: results.length,
          tier,
          timeMs: totalTime,
        }),
      });
      if (r.ok) {
        setSaved(true);
        await refreshLeaderboard();
      }
    } catch {}
    setSaving(false);
  };

  useEffect(() => {
    if (!musicStarted.current && questions.length > 0) {
      musicStarted.current = true;
      flagSound.startBackground();
    }
    return () => {
      flagSound.stopBackground();
      musicStarted.current = false;
    };
  }, [questions.length]);

  const startTimer = useCallback(() => {
    setTimer(duration);
    setPhase("answering");
    setRoundStartTime(Date.now());
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimer(remaining);
      if (remaining <= 3 && remaining > 2.9) flagSound.playTick();
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleTimeUp();
      }
    }, 50);
  }, [duration]);

  useEffect(() => {
    if (questions.length > 0 && currentIdx < questions.length && phase === "answering") {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIdx, questions.length]);

  const handleTimeUp = () => {
    if (phaseRef.current !== "answering") return;
    const q = questionsRef.current[currentIdxRef.current];
    if (!q) return;
    flagSound.playWrong();
    setStreak(0);
    setFeedbackType("wrong");
    setResults(prev => [...prev, { country: q.country, correct: false, timeMs: duration * 1000 }]);
    setPhase("feedback");
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackType(null);
      advanceQuestion();
    }, 1000);
  };

  const advanceQuestion = () => {
    if (currentIdxRef.current + 1 >= questionsRef.current.length) {
      setPhase("results");
      flagSound.playGameOver();
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelected(null);
      setFeedbackType(null);
      setPointsEarned(null);
      setPhase("answering");
    }
  };

  const handleAnswer = (value: string) => {
    if (selected || phase !== "answering") return;
    setSelected(value);
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[currentIdx];
    const isCorrect = value === q.correctValue;
    const timeMs = Date.now() - roundStartTime;

    if (isCorrect) {
      const speedBonus = Math.max(0, Math.floor((1 - timeMs / (duration * 1000)) * 50));
      const points = 100 + speedBonus;
      setScore(prev => prev + points);
      setPointsEarned(points);
      setFeedbackType("correct");
      setStreak(prev => {
        const ns = prev + 1;
        setMaxStreak(ms => Math.max(ms, ns));
        if (ns >= 3) flagSound.playStreak();
        else flagSound.playCorrect();
        return ns;
      });
    } else {
      setStreak(0);
      setFeedbackType("wrong");
      flagSound.playWrong();
    }

    setResults(prev => [...prev, { country: q.country, correct: isCorrect, timeMs }]);
    setPhase("feedback");
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackType(null);
      setPointsEarned(null);
      advanceQuestion();
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    flagSound.setMuted(newMuted);
    if (!newMuted) flagSound.startBackground();
  };

  const q = questions[currentIdx];
  const correctCount = results.filter(r => r.correct).length;
  const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);
  const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

  if (questions.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 dark:from-teal-950/20 dark:via-cyan-950/20 dark:to-emerald-950/20">
          <div className="w-10 h-10 rounded-full border-4 border-teal-500/30 border-t-teal-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (phase === "results") {
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;
    const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;

    const handleReplay = () => {
      setCurrentIdx(0);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setResults([]);
      setSelected(null);
      setPhase("answering");
      setFeedbackType(null);
      setPointsEarned(null);
      setGameStartTime(Date.now());
      setSaved(false);
      setShowNameInput(false);
      const pool = getCapitalsByTier(tier);
      const qs = generateCapitalQuestions(pool, count, qmode);
      setQuestions(qs);
      flagSound.startBackground();
    };

    const leaderboardPanel = (
      <div className="bg-card border border-border/60 rounded-2xl p-3 shadow-md w-full">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-black text-foreground">{lang === "ar" ? "المتصدرون" : "Top Players"}</span>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-[10px] text-center py-2">{lang === "ar" ? "لا نتائج بعد" : "No scores yet"}</p>
        ) : (
          <div className="space-y-1">
            {leaderboard.map((e, i) => (
              <div key={e.id} className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-[10px] ${i === 0 ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[8px] shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 dark:bg-slate-600 text-white" : i === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"}`}>
                  {i === 0 ? <Crown className="w-2.5 h-2.5" /> : i < 3 ? <Medal className="w-2.5 h-2.5" /> : i + 1}
                </span>
                <span className="font-bold text-foreground/70 truncate flex-1 min-w-0">{e.name}</span>
                <span className="font-black text-amber-600 shrink-0">{e.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 dark:from-teal-950/20 dark:via-cyan-950/20 dark:to-emerald-950/20 py-8 px-4" dir={dir}>
          <div className="max-w-3xl mx-auto flex flex-col lg:flex-row gap-6">
            <div className="flex-1 max-w-lg mx-auto lg:mx-0 w-full">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="text-7xl mb-3"
                >
                  {accuracy >= 90 ? "🏆" : accuracy >= 70 ? "🎉" : accuracy >= 50 ? "👍" : "💪"}
                </motion.div>
                <h1 className="text-3xl font-black text-foreground mb-1">{lang === "ar" ? "النتيجة النهائية" : "Final Results"}</h1>
                <div className="flex justify-center gap-1 mt-2">
                  {[1, 2, 3].map(i => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15 }}>
                      <Star className={`w-9 h-9 ${i <= stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-gray-600"}`} />
                    </motion.div>
                  ))}
                </div>
                {stars === 3 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-sm font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                    {lang === "ar" ? "🌟 ممتاز! أداء مثالي!" : "🌟 Perfect performance!"}
                  </motion.p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border/60 rounded-2xl p-5 shadow-md mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-teal-50 dark:bg-teal-950/20 rounded-xl">
                    <Target className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                    <p className="text-2xl font-black text-teal-600">{score}</p>
                    <p className="text-xs text-muted-foreground font-medium">{lang === "ar" ? "النقاط" : "Score"}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-xl">
                    <Percent className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-black text-green-600">{accuracy}%</p>
                    <p className="text-xs text-muted-foreground font-medium">{lang === "ar" ? "الدقة" : "Accuracy"}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
                    <Flame className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                    <p className="text-2xl font-black text-orange-600">{maxStreak}</p>
                    <p className="text-xs text-muted-foreground font-medium">{lang === "ar" ? "أعلى سلسلة" : "Best Streak"}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl">
                    <Timer className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-2xl font-black text-purple-600">{timeStr}</p>
                    <p className="text-xs text-muted-foreground font-medium">{lang === "ar" ? "الوقت" : "Time"}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{lang === "ar" ? "إجابات صحيحة" : "Correct"}</span>
                    <span className="font-bold text-green-600">{correctCount} / {results.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{lang === "ar" ? "إجابات خاطئة" : "Wrong"}</span>
                    <span className="font-bold text-red-500">{results.length - correctCount}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${accuracy}%` }} transition={{ delay: 0.5, duration: 0.8 }} className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" />
                  </div>
                </div>
              </motion.div>

              {!saved && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/60 rounded-2xl p-4 shadow-md mb-4">
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
                        className="w-full text-center text-lg font-bold py-3 px-4 rounded-xl bg-muted/50 border-2 border-border text-foreground focus:border-amber-500 focus:outline-none transition-colors"
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
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-4 text-center">
                  <p className="text-green-600 font-bold text-sm">✓ {lang === "ar" ? "تم حفظ نتيجتك!" : "Score saved!"}</p>
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border/60 rounded-2xl p-4 shadow-md mb-4 max-h-60 overflow-y-auto">
                <p className="font-bold text-sm text-foreground mb-3">{lang === "ar" ? "تفاصيل الإجابات" : "Answer Details"}</p>
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-xl ${r.correct ? "bg-green-50 dark:bg-green-950/10" : "bg-red-50 dark:bg-red-950/10"}`}>
                      <img src={getFlagUrl(r.country.code, 40)} alt="" className="w-8 h-6 object-cover rounded shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-sm text-foreground block truncate">{lang === "ar" ? r.country.nameAr : r.country.nameEn}</span>
                        <span className="text-xs text-muted-foreground">{lang === "ar" ? r.country.capitalAr : r.country.capitalEn}</span>
                      </div>
                      {r.correct ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-500" />}
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col gap-3">
                <ShareButtons
                  text={lang === "ar"
                    ? `🏛️${playerName.trim() ? ` ${playerName.trim()} -` : ""} حصلت على ${score} نقطة في لعبة عواصم العالم! (${accuracy}% صحيحة)\n🔥 سلسلة ${maxStreak} | ⏱ ${timeStr}\nجرّب تتغلب عليّ!`
                    : `🏛️${playerName.trim() ? ` ${playerName.trim()} -` : ""} I scored ${score} in World Capitals Game! (${accuracy}% correct)\n🔥 Streak ${maxStreak} | ⏱ ${timeStr}\nTry to beat me!`}
                  url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/capitals"}
                />
                <button onClick={handleReplay} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  {lang === "ar" ? "إعادة اللعب" : "Play Again"}
                </button>
                <button onClick={() => setLocation("/game/capitals")} className="w-full py-3 rounded-2xl border border-border bg-background text-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors">
                  {lang === "ar" ? "تغيير المستوى" : "Change Level"}
                </button>
                <button onClick={() => setLocation("/")} className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
                  <Home className="w-4 h-4" />
                  {lang === "ar" ? "الرئيسية" : "Home"}
                </button>
              </motion.div>
            </div>

            <div className="w-full lg:w-56 shrink-0">
              {leaderboardPanel}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const progress = ((currentIdx) / questions.length) * 100;
  const isFeedback = phase === "feedback";
  const correctValue = q.correctValue;
  const timerPercent = (timer / duration) * 100;
  const isUrgent = timer <= 3;

  const questionText = q.questionMode === "country-to-capital"
    ? (lang === "ar" ? `ما عاصمة ${q.country.nameAr}؟` : `What is the capital of ${q.country.nameEn}?`)
    : (lang === "ar" ? `${q.country.capitalAr} هي عاصمة أي دولة؟` : `${q.country.capitalEn} is the capital of which country?`);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 py-4 px-4 relative overflow-hidden" dir={dir}>
        {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={arenaResults} isRtl={lang === "ar"} />}

        <AnimatePresence>
          {feedbackType && (
            <motion.div
              key={feedbackType + currentIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`absolute inset-0 pointer-events-none z-10 ${feedbackType === "correct" ? "bg-green-500/20" : "bg-red-500/20"}`}
            />
          )}
        </AnimatePresence>

        <div className="max-w-lg mx-auto relative z-20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-xl text-xs font-bold bg-gradient-to-r ${levelInfo.color} text-white`}>
                {levelInfo.icon} {lang === "ar" ? levelInfo.nameAr : levelInfo.nameEn}
              </div>
              <button onClick={toggleMute} className="p-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <AnimatePresence>
                {streak >= 3 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-1 text-orange-400 font-black">
                    <Flame className="w-4 h-4" /> {streak}🔥
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="font-black text-white">
                {score} <span className="text-xs text-white/50 font-medium">{lang === "ar" ? "نقطة" : "pts"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="text-xs font-bold text-white/50">{currentIdx + 1}/{questions.length}</span>
          </div>

          <div className={`h-2 rounded-full overflow-hidden mb-4 ${isUrgent ? "bg-red-900/50" : "bg-white/10"}`}>
            <motion.div
              className={`h-full rounded-full transition-colors duration-300 ${isUrgent ? "bg-red-500" : timer <= duration * 0.5 ? "bg-amber-400" : "bg-teal-400"}`}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`rounded-3xl shadow-2xl overflow-hidden mb-4 border-2 transition-colors duration-200 ${isFeedback ? (selected === correctValue ? "border-green-500/60" : "border-red-500/60") : "border-white/10"}`}>
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 p-6 flex flex-col items-center justify-center min-h-[180px]">
                  {q.questionMode === "country-to-capital" && (
                    <motion.img
                      key={q.country.code}
                      src={getFlagUrl(q.country.code, 320)}
                      alt=""
                      className="max-h-[90px] w-auto max-w-full rounded-xl shadow-xl object-contain mb-3"
                      loading="eager"
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    />
                  )}
                  {q.questionMode === "capital-to-country" && (
                    <div className="text-4xl mb-2">🌍</div>
                  )}
                  <p className="text-center font-black text-white text-xl leading-snug">{questionText}</p>
                  <div className={`absolute top-3 end-3 w-12 h-12 rounded-full flex items-center justify-center font-black text-base transition-all ${isUrgent ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50" : "bg-white/20 text-white"}`}>
                    {Math.ceil(timer)}
                  </div>

                  <AnimatePresence>
                    {isFeedback && selected === correctValue && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {["🎉", "⭐", "✨", "🌟", "💫"].map((e, i) => (
                          <motion.span key={i} initial={{ scale: 0, x: 0, y: 0 }} animate={{ scale: [0, 1.8, 0], x: (i - 2) * 55, y: [0, -70 - Math.random() * 40] }} transition={{ duration: 0.85, delay: i * 0.07 }} className="absolute text-2xl">
                            {e}
                          </motion.span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className={`py-2 px-4 text-center text-xs font-bold text-white/50 transition-colors ${isFeedback && selected === correctValue ? "bg-green-500/30" : isFeedback ? "bg-red-500/20" : "bg-white/5"}`}>
                  {q.questionMode === "country-to-capital"
                    ? (lang === "ar" ? "اختر العاصمة الصحيحة" : "Choose the correct capital")
                    : (lang === "ar" ? "اختر الدولة الصحيحة" : "Choose the correct country")}
                </div>
              </div>

              <AnimatePresence>
                {isFeedback && pointsEarned && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center justify-center gap-1.5 mb-3"
                  >
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-black text-base">+{pointsEarned}</span>
                    {streak >= 3 && <span className="text-orange-400 font-bold text-xs">🔥 {streak}</span>}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                {q.options.map((opt, idx) => {
                  const color = OPTION_COLORS[idx];
                  const isSelected = selected === opt.value;
                  const isCorrectOpt = opt.value === correctValue;

                  let btnClass = `${color.bg} ${color.hover} ${color.text} shadow-lg`;
                  if (isFeedback) {
                    if (isCorrectOpt) {
                      btnClass = "bg-green-500 text-white ring-4 ring-green-300 shadow-lg shadow-green-500/30";
                    } else if (isSelected && !isCorrectOpt) {
                      btnClass = "bg-red-700 text-white ring-4 ring-red-400 shadow-lg opacity-80";
                    } else {
                      btnClass = `${color.bg} ${color.text} opacity-30`;
                    }
                  }

                  const fbAnim = isFeedback
                    ? (isSelected && isCorrectOpt
                        ? "fb-correct"
                        : isSelected && !isCorrectOpt
                          ? "fb-wrong"
                          : isCorrectOpt
                            ? "fb-revealed"
                            : "")
                    : "";

                  return (
                    <motion.button
                      key={opt.value}
                      whileTap={isFeedback ? undefined : { scale: 0.92 }}
                      whileHover={isFeedback ? undefined : { scale: 1.03, y: -2 }}
                      disabled={!!selected}
                      onClick={() => handleAnswer(opt.value)}
                      className={`relative p-4 rounded-2xl transition-all text-center font-bold text-sm min-h-[72px] flex flex-col items-center justify-center gap-1 ${btnClass} ${fbAnim} disabled:cursor-default`}
                    >
                      <span className="text-lg opacity-50">{OPTION_SHAPES[idx]}</span>
                      <span className="text-sm font-black leading-tight">{lang === "ar" ? opt.labelAr : opt.label}</span>
                      {isFeedback && isCorrectOpt && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 end-2">
                          <Check className="w-5 h-5 text-white drop-shadow-md" />
                        </motion.div>
                      )}
                      {isFeedback && isSelected && !isCorrectOpt && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 end-2">
                          <X className="w-5 h-5 text-white drop-shadow-md" />
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
