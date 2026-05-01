import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trophy, ArrowRight, ArrowLeft, RotateCcw, Save, CheckCircle, Star, Flame, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";
import { LevelUpSplash } from "@/components/level-up-splash";

const API_BASE = import.meta.env.VITE_API_URL || "";

const DEFAULT_COLORS = [
  { word: "أحمر", color: "#ef4444", options: ["#ef4444", "#3b82f6", "#22c55e", "#eab308"] },
  { word: "أزرق", color: "#3b82f6", options: ["#3b82f6", "#ef4444", "#22c55e", "#eab308"] },
  { word: "أخضر", color: "#22c55e", options: ["#22c55e", "#ef4444", "#3b82f6", "#eab308"] },
  { word: "أصفر", color: "#eab308", options: ["#eab308", "#ef4444", "#3b82f6", "#22c55e"] },
  { word: "برتقالي", color: "#f97316", options: ["#f97316", "#ef4444", "#3b82f6", "#22c55e"] },
  { word: "بنفسجي", color: "#a855f7", options: ["#a855f7", "#ef4444", "#3b82f6", "#22c55e"] },
  { word: "رمادي", color: "#6b7280", options: ["#6b7280", "#ef4444", "#3b82f6", "#eab308"] },
  { word: "أسود", color: "#1f2937", options: ["#1f2937", "#ef4444", "#3b82f6", "#22c55e"] },
];

const COLOR_NAMES: Record<string, string> = {
  "#ef4444": "أحمر",
  "#3b82f6": "أزرق",
  "#22c55e": "أخضر",
  "#eab308": "أصفر",
  "#f97316": "برتقالي",
  "#a855f7": "بنفسجي",
  "#6b7280": "رمادي",
  "#1f2937": "أسود",
  "#ec4899": "زهري",
  "#6366f1": "نيلي",
};

interface ColorItem {
  word: string;
  color: string;
  options: string[];
}

type GamePhase = "playing" | "gameover";

interface Question {
  displayWord: string;
  inkColor: string;
  inkColorName: string;
  choices: Array<{ color: string; label: string }>;
}

const LEVEL_UP_EVERY = 5;
const BASE_TIMER_MS = 10000;
const TIMER_DECREMENT_MS = 200;
const MIN_TIMER_MS = 1000;

function getColorLabel(color: string, wordMap: Record<string, string>): string {
  return wordMap[color] || COLOR_NAMES[color] || color;
}

function generateQuestion(colors: ColorItem[], wordMap: Record<string, string>): Question {
  const inkIdx = Math.floor(Math.random() * colors.length);
  let wordIdx = Math.floor(Math.random() * colors.length);
  if (colors.length > 1) {
    while (wordIdx === inkIdx) {
      wordIdx = Math.floor(Math.random() * colors.length);
    }
  }
  const inkItem = colors[inkIdx];
  const displayWord = colors[wordIdx].word;

  const optionColors = inkItem.options.length >= 2 ? inkItem.options : (() => {
    const set = new Set<string>([inkItem.color]);
    for (const c of colors) {
      if (set.size >= 4) break;
      set.add(c.color);
    }
    return Array.from(set);
  })();

  const shuffled = [...optionColors].sort(() => Math.random() - 0.5);
  const choices = shuffled.map(c => ({
    color: c,
    label: getColorLabel(c, wordMap),
  }));

  return {
    displayWord,
    inkColor: inkItem.color,
    inkColorName: getColorLabel(inkItem.color, wordMap),
    choices,
  };
}

function getTimerDuration(level: number): number {
  return Math.max(MIN_TIMER_MS, BASE_TIMER_MS - level * TIMER_DECREMENT_MS);
}

function getScoreForCorrect(level: number, combo: number, timeLeft: number, totalTime: number): number {
  const base = 100 + level * 20;
  const timeFactor = 1 + (timeLeft / totalTime) * 0.5;
  const comboBonus = combo >= 3 ? 1 + (combo - 2) * 0.25 : 1;
  return Math.round(base * timeFactor * comboBonus);
}

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playBeep(freq: number, type: OscillatorType, duration: number, vol = 0.25) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* ignore audio errors */ }
}

function soundCorrect() {
  playBeep(880, "sine", 0.12, 0.2);
  setTimeout(() => playBeep(1100, "sine", 0.1, 0.15), 80);
}

function soundWrong() {
  playBeep(200, "square", 0.18, 0.25);
}

function soundLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playBeep(f, "sine", 0.15, 0.25), i * 80));
}

function soundGameOver() {
  [400, 350, 280, 220].forEach((f, i) => setTimeout(() => playBeep(f, "sawtooth", 0.2, 0.25), i * 100));
}

interface CircleTimerProps {
  pct: number;
  color: string;
  size?: number;
}

function CircleTimer({ pct, color, size = 72 }: CircleTimerProps) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.06s linear, stroke 0.3s" }}
      />
    </svg>
  );
}

export default function StroopPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("stroop");

  const [colors, setColors] = useState<ColorItem[]>(DEFAULT_COLORS);
  const [wordMap, setWordMap] = useState<Record<string, string>>({});
  const [customTitle, setCustomTitle] = useState<string | null>(null);

  const [phase, setPhase] = useState<GamePhase>("playing");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [splashLevel, setSplashLevel] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [correctInLevel, setCorrectInLevel] = useState(0);
  const [startMs] = useState(() => Date.now());

  const [playerName, setPlayerName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rank, setRank] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeringRef = useRef(false);
  const colorsRef = useRef<ColorItem[]>(colors);
  const wordMapRef = useRef<Record<string, string>>(wordMap);
  const levelRef = useRef(0);
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "gameover" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  useEffect(() => {
    colorsRef.current = colors;
    wordMapRef.current = wordMap;
  }, [colors, wordMap]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get("pin");
    if (pin) {
      fetch(`${API_BASE}/api/stroop-sets/${pin}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && Array.isArray(data.items) && data.items.length >= 4) {
            const loaded: ColorItem[] = data.items.map((item: { word: string; color: string; options?: string[] }) => ({
              word: item.word,
              color: item.color,
              options: Array.isArray(item.options) && item.options.length >= 2
                ? item.options
                : [item.color],
            }));
            setColors(loaded);
            const map: Record<string, string> = {};
            for (const c of loaded) map[c.color] = c.word;
            setWordMap(map);
            setCustomTitle(data.title);
          }
        })
        .catch(() => {});
    } else {
      const map: Record<string, string> = {};
      for (const c of DEFAULT_COLORS) map[c.color] = c.word;
      setWordMap(map);
    }

    fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.displayName) setPlayerName(data.displayName); })
      .catch(() => {});
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (feedbackRef.current) { clearTimeout(feedbackRef.current); feedbackRef.current = null; }
  }, []);

  const nextQuestion = useCallback((currentLevel: number) => {
    answeringRef.current = false;
    setFeedback(null);
    setWrongChoice(null);
    const q = generateQuestion(colorsRef.current, wordMapRef.current);
    setQuestion(q);
    const duration = getTimerDuration(currentLevel);
    setTotalTime(duration);
    setTimeLeft(duration);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 60) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          if (!answeringRef.current) {
            answeringRef.current = true;
            soundWrong();
            setCombo(0);
            setCorrectInLevel(0);
            setWrongCount(w => w + 1);
            setLives(l => {
              const next = l - 1;
              if (next <= 0) {
                soundGameOver();
                setPhase("gameover");
              } else {
                feedbackRef.current = setTimeout(() => nextQuestion(levelRef.current), 600);
              }
              return next;
            });
          }
          return 0;
        }
        return prev - 60;
      });
    }, 60);
  }, []);

  useEffect(() => {
    nextQuestion(0);
    return () => clearTimers();
  }, []);

  const handleSaveScore = useCallback(async () => {
    if (saveStatus === "saving" || saveStatus === "saved") return;
    const name = playerName.trim();
    if (!name) return;
    setSaveStatus("saving");
    try {
      const elapsed = Date.now() - startMs;
      const res = await fetch(`${API_BASE}/api/stroop-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          score,
          level,
          correctCount,
          wrongCount,
          timeMs: elapsed,
        }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        const allRes = await fetch(`${API_BASE}/api/stroop-scores`);
        if (allRes.ok) {
          const all = await allRes.json();
          const sorted = (all as { score: number }[]).sort((a, b) => b.score - a.score);
          const pos = sorted.findIndex(s => s.score <= score);
          setRank(pos >= 0 ? pos + 1 : sorted.length + 1);
        }
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [saveStatus, playerName, score, level, correctCount, wrongCount, startMs]);

  const handleAnswer = useCallback((choiceColor: string) => {
    if (!question || answeringRef.current) return;
    answeringRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const isCorrect = choiceColor === question.inkColor;

    if (isCorrect) {
      soundCorrect();
      setFeedback("correct");
      setCorrectCount(prev => prev + 1);
      setCorrectInLevel(prev => {
        const newVal = prev + 1;
        if (newVal >= LEVEL_UP_EVERY) {
          setLevel(lv => {
            const newLevel = lv + 1;
            soundLevelUp();
            setSplashLevel(newLevel);
            setTimeout(() => setSplashLevel(null), 1300);
            feedbackRef.current = setTimeout(() => nextQuestion(newLevel), 500);
            return newLevel;
          });
          return 0;
        }
        feedbackRef.current = setTimeout(() => nextQuestion(levelRef.current), 400);
        return newVal;
      });
      setCombo(prev => {
        const newCombo = prev + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setScore(s => {
        return s + getScoreForCorrect(levelRef.current, combo + 1, timeLeft, totalTime);
      });
    } else {
      soundWrong();
      setFeedback("wrong");
      setWrongChoice(choiceColor);
      setCombo(0);
      setCorrectInLevel(0);
      setWrongCount(w => w + 1);
      setLives(l => {
        const next = l - 1;
        if (next <= 0) {
          soundGameOver();
          feedbackRef.current = setTimeout(() => setPhase("gameover"), 700);
        } else {
          feedbackRef.current = setTimeout(() => nextQuestion(levelRef.current), 600);
        }
        return next;
      });
    }
  }, [question, combo, timeLeft, totalTime, nextQuestion]);

  const handleRestart = () => {
    clearTimers();
    setScore(0);
    setLevel(0);
    levelRef.current = 0;
    setCombo(0);
    setMaxCombo(0);
    setLives(3);
    setQuestion(null);
    setFeedback(null);
    setCorrectCount(0);
    setWrongCount(0);
    setCorrectInLevel(0);
    setSaveStatus("idle");
    setRank(null);
    answeringRef.current = false;
    setPhase("playing");
    nextQuestion(0);
  };

  if (phase === "gameover") {
    const accuracy = correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 flex items-center justify-center p-4" dir={dir}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="text-7xl mb-3"
            >
              {score > 2000 ? "🏆" : score > 800 ? "🥈" : score > 300 ? "🎉" : "🎮"}
            </motion.div>
            <h1 className="text-3xl font-black text-foreground mb-2">
              {lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}
            </h1>

            <div className="flex justify-center gap-1.5 mb-4">
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = score > 2000 ? 5 : score > 1200 ? 4 : score > 600 ? 3 : score > 200 ? 2 : 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 300 }}
                  >
                    <Star className={`w-6 h-6 ${i < filled ? "text-amber-500 fill-amber-400 drop-shadow" : "text-muted-foreground/30"}`} />
                  </motion.div>
                );
              })}
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{lang === "ar" ? "النقاط" : "Score"}</span>
                <span className="font-black text-2xl text-foreground">{score.toLocaleString(lang === "ar" ? "ar-EG" : "en")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{lang === "ar" ? "المستوى" : "Level"}</span>
                <span className="font-bold text-foreground">{level}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{lang === "ar" ? "صحيح / خطأ" : "Correct / Wrong"}</span>
                <span className="font-bold">
                  <span className="text-green-600">{correctCount}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-red-500">{wrongCount}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{lang === "ar" ? "الدقة" : "Accuracy"}</span>
                <span className="font-bold text-blue-600">{accuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">{lang === "ar" ? "أعلى كومبو" : "Best Combo"}</span>
                <span className="font-bold text-orange-600">×{maxCombo}</span>
              </div>
              {rank && saveStatus === "saved" && (
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <span className="text-muted-foreground text-sm">{lang === "ar" ? "ترتيبك" : "Your Rank"}</span>
                  <span className="font-black text-yellow-600">#{rank}</span>
                </div>
              )}
            </div>

            {saveStatus !== "saved" && (
              <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm mb-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">
                  {lang === "ar" ? "أدخل اسمك لحفظ نتيجتك في المتصدرين العشرة (اختياري)" : "Enter your name to save score in top 10 (optional)"}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                    placeholder={lang === "ar" ? "اسمك..." : "Your name..."}
                    maxLength={30}
                    autoFocus
                    className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-colors"
                  />
                  <button
                    onClick={handleSaveScore}
                    disabled={saveStatus === "saving" || !playerName.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-sm disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {saveStatus === "saving" ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : saveStatus === "error" ? (
                      lang === "ar" ? "أعد" : "Retry"
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {lang === "ar" ? "احفظ" : "Save"}
                      </>
                    )}
                  </button>
                </div>
                {saveStatus === "error" && (
                  <p className="text-xs text-destructive mt-1">{lang === "ar" ? "حدث خطأ، حاول مجدداً" : "Error, try again"}</p>
                )}
              </div>
            )}

            {saveStatus === "saved" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 py-3 text-green-600 font-bold text-sm mb-4"
              >
                <CheckCircle className="w-5 h-5" />
                {lang === "ar" ? "تم حفظ نتيجتك!" : "Score saved!"}
              </motion.div>
            )}

            <ShareButtons
              text={lang === "ar"
                ? `🎨${playerName.trim() ? ` ${playerName.trim()} -` : ""} حصلت على ${score} نقطة في لعبة ستروب! (${accuracy}% دقة)\n🏆 المستوى ${level} | ×${maxCombo} أعلى كومبو\nجرّب تتغلب عليّ!`
                : `🎨${playerName.trim() ? ` ${playerName.trim()} -` : ""} I scored ${score} points in Stroop Game! (${accuracy}% accuracy)\n🏆 Level ${level} | ×${maxCombo} best combo\nTry to beat me!`}
              url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/stroop"}
            />
            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={handleRestart}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-base shadow-lg flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                {lang === "ar" ? "العب مجدداً" : "Play Again"}
              </button>
              <button
                onClick={() => setLocation("/game/stroop")}
                className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {lang === "ar" ? "العودة للقائمة" : "Back to Menu"}
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 100;
  const timerColor = timerPct > 60 ? "#22c55e" : timerPct > 30 ? "#eab308" : "#ef4444";
  const levelProgress = (correctInLevel / LEVEL_UP_EVERY) * 100;

  return (
    <Layout>
      <LevelUpSplash show={splashLevel !== null} level={splashLevel ?? 0} theme="orange" />
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20" dir={dir}>
        <div className="max-w-sm mx-auto px-4 py-4">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={lang === "ar"} />}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={i >= lives ? { scale: [1, 1.3, 0.8, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${i < lives ? "text-red-500 fill-red-500" : "text-muted-foreground/20"}`}
                    />
                  </motion.div>
                ))}
              </div>
              <AnimatePresence>
                {combo >= 3 && (
                  <motion.div
                    initial={{ scale: 0, x: -10 }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/40"
                  >
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">×{combo}</span>
                    <span className="text-sm">🔥</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground font-medium">
                {customTitle || (lang === "ar" ? "ارتباك" : "Stroop")} · {lang === "ar" ? "م" : "Lv"}{level}
              </p>
              <p className="text-xl font-black text-foreground">{score.toLocaleString(lang === "ar" ? "ar-EG" : "en")}</p>
            </div>
          </div>

          <div className="mb-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>{lang === "ar" ? "تقدم المستوى" : "Level progress"}</span>
              <span>{correctInLevel}/{LEVEL_UP_EVERY}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center my-4">
            <div className="relative">
              <motion.div
                animate={{ scale: timerPct < 30 ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 0.4, repeat: timerPct < 30 ? Infinity : 0 }}
              >
                <CircleTimer pct={timerPct} color={timerColor} size={80} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-foreground">
                    {Math.ceil(timeLeft / 1000)}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {lang === "ar" ? "ث" : "s"}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border/40 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-xs font-bold text-muted-foreground">
                {lang === "ar" ? "اضغط على لون الحبر — ليس معنى الكلمة" : "Click the ink color — not the word"}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {question && (
              <motion.div
                key={`q-${level}-${correctCount}-${wrongCount}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.15 }}
                className="mb-6"
              >
                <div
                  className={`flex items-center justify-center h-32 rounded-3xl border-2 mb-5 shadow-xl transition-all relative overflow-hidden ${
                    feedback === "correct"
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                      : feedback === "wrong"
                        ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                        : "border-border/40 bg-card"
                  }`}
                >
                  {feedback === "correct" && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 4, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="absolute w-8 h-8 rounded-full bg-green-400"
                    />
                  )}
                  <motion.span
                    key={`word-${correctCount}-${wrongCount}`}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-6xl font-black select-none relative z-10"
                    style={{
                      color: question.inkColor,
                      textShadow: `0 0 30px ${question.inkColor}50, 0 2px 8px rgba(0,0,0,0.15)`,
                    }}
                  >
                    {question.displayWord}
                  </motion.span>
                  {feedback === "correct" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-white text-sm font-black">✓</span>
                    </motion.div>
                  )}
                  {feedback === "wrong" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-white text-sm font-black">✗</span>
                    </motion.div>
                  )}
                </div>

                <div className={`grid gap-3 ${question.choices.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {question.choices.map((choice, idx) => {
                    const isInk = choice.color === question.inkColor;
                    const fbAnim = feedback === "correct" && isInk
                      ? "fb-correct"
                      : feedback === "wrong" && choice.color === wrongChoice
                        ? "fb-wrong"
                        : feedback === "wrong" && isInk
                          ? "fb-revealed"
                          : "";
                    return (
                    <motion.button
                      key={choice.color}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleAnswer(choice.color)}
                      disabled={!!feedback}
                      className={`h-16 rounded-2xl font-black text-white text-lg shadow-lg transition-all disabled:cursor-not-allowed hover:brightness-110 active:scale-95 select-none relative overflow-hidden ${fbAnim}`}
                      style={{
                        backgroundColor: choice.color,
                        boxShadow: `0 6px 20px ${choice.color}60, 0 2px 6px rgba(0,0,0,0.2)`,
                      }}
                    >
                      <div
                        className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
                        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                      />
                      <span className="relative z-10 drop-shadow">{choice.label}</span>
                    </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {feedback === "correct" && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center mb-3"
              >
                <span className="text-xl font-black text-green-600">
                  +{getScoreForCorrect(level, combo, timeLeft, totalTime)} ✓
                  {combo >= 3 && " 🔥"}
                </span>
              </motion.div>
            )}
            {feedback === "wrong" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center mb-3"
              >
                <span className="text-lg font-black text-red-500">
                  ✗ {lang === "ar" ? "لون الحبر كان:" : "Ink was:"}{" "}
                  <span style={{ color: question?.inkColor }}>{question?.inkColorName}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between items-center mt-2">
            <button
              onClick={() => { clearTimers(); setPhase("gameover"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <BackArrow className="w-3.5 h-3.5" />
              {lang === "ar" ? "إنهاء" : "End"}
            </button>
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs text-muted-foreground">{correctCount}✓ {wrongCount}✗</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
