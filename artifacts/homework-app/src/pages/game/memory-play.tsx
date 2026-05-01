import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Volume2, VolumeX, RotateCcw, Trophy, Flame, Star, Crown, Medal, Heart, Brain, Sparkles } from "lucide-react";
import { ConfettiBurst } from "@/components/confetti-burst";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { generateCards, getLevelConfig, calculateScore, type MemoryCard } from "@/lib/memory-engine";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";
import { memorySound } from "@/lib/memory-sounds";
import { LevelUpSplash } from "@/components/level-up-splash";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Phase = "countdown" | "preview" | "playing" | "levelup" | "gameover";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
}

interface LbEntry {
  id: number;
  name: string;
  score: number;
  level: number;
}

function MatchParticles({ particles }: { particles: Particle[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
          animate={{
            x: p.x + (Math.random() - 0.5) * 200,
            y: p.y - Math.random() * 200 - 50,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

const BACK_THEMES = [
  {
    gradient: "from-indigo-600 via-purple-600 to-pink-600",
    hover: "group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500",
    glyph: "✦",
    pattern: (size: number) =>
      `repeating-linear-gradient(45deg, transparent, transparent ${size}px, rgba(255,255,255,0.12) ${size}px, rgba(255,255,255,0.12) ${size * 2}px)`,
    accent: "bg-white/20 border-white/25",
  },
  {
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    hover: "group-hover:from-emerald-500 group-hover:via-teal-500 group-hover:to-cyan-500",
    glyph: "❖",
    pattern: (size: number) =>
      `radial-gradient(circle at center, rgba(255,255,255,0.18) 1.5px, transparent 2px), radial-gradient(circle at center, rgba(255,255,255,0.12) 1px, transparent 1.5px)`,
    accent: "bg-white/20 border-white/30",
  },
  {
    gradient: "from-amber-500 via-orange-600 to-rose-600",
    hover: "group-hover:from-amber-400 group-hover:via-orange-500 group-hover:to-rose-500",
    glyph: "✺",
    pattern: (size: number) =>
      `repeating-linear-gradient(0deg, transparent, transparent ${size}px, rgba(255,255,255,0.12) ${size}px, rgba(255,255,255,0.12) ${size + 1}px), repeating-linear-gradient(90deg, transparent, transparent ${size}px, rgba(255,255,255,0.12) ${size}px, rgba(255,255,255,0.12) ${size + 1}px)`,
    accent: "bg-white/25 border-white/30",
  },
  {
    gradient: "from-fuchsia-600 via-violet-600 to-sky-600",
    hover: "group-hover:from-fuchsia-500 group-hover:via-violet-500 group-hover:to-sky-500",
    glyph: "✸",
    pattern: (size: number) =>
      `repeating-linear-gradient(135deg, transparent, transparent ${size}px, rgba(255,255,255,0.14) ${size}px, rgba(255,255,255,0.14) ${size * 2}px)`,
    accent: "bg-white/20 border-white/30",
  },
  {
    gradient: "from-yellow-500 via-rose-600 to-slate-900",
    hover: "group-hover:from-yellow-400 group-hover:via-rose-500 group-hover:to-slate-800",
    glyph: "♛",
    pattern: (size: number) =>
      `radial-gradient(circle at 25% 25%, rgba(255,215,0,0.25) 1.5px, transparent 2px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.18) 1.5px, transparent 2px)`,
    accent: "bg-amber-300/25 border-amber-200/40",
  },
];

function getBackTheme(level: number) {
  const idx = Math.min(Math.floor((level - 1) / 2), BACK_THEMES.length - 1);
  return BACK_THEMES[idx];
}

function GameCard({
  card,
  onClick,
  disabled,
  gridCols,
  level,
  isWrong,
}: {
  card: MemoryCard;
  onClick: (e: React.MouseEvent) => void;
  disabled: boolean;
  gridCols: number;
  level: number;
  isWrong?: boolean;
}) {
  const isSmall = gridCols >= 6;
  const textSize = card.content.length > 4
    ? (isSmall ? "text-sm" : "text-lg")
    : (isSmall ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl");
  const isTextContent = card.content.length > 2;
  const theme = getBackTheme(level);
  const patternSize = isSmall ? 8 : 10;

  return (
    <motion.button
      layout
      onClick={onClick}
      disabled={disabled || card.isMatched || card.isFlipped}
      className={`relative w-full aspect-square cursor-pointer disabled:cursor-default group ${card.isMatched ? "fb-correct" : isWrong ? "fb-wrong" : ""}`}
      style={{ perspective: "1000px" }}
      whileTap={!disabled && !card.isMatched && !card.isFlipped ? { scale: 0.92 } : {}}
    >
      <motion.div
        animate={{
          rotateY: card.isFlipped || card.isMatched ? 0 : 180,
          z: card.isFlipped || card.isMatched ? 0 : 0,
        }}
        transition={{ duration: 0.6, type: "spring", stiffness: 180, damping: 18 }}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* FRONT (face) */}
        <div
          className={`absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br ${card.color} shadow-lg transition-shadow duration-300 ${
            card.isMatched
              ? "ring-2 ring-emerald-300 shadow-emerald-400/50 shadow-2xl"
              : isWrong
                ? "ring-2 ring-red-400 shadow-red-500/60 shadow-2xl"
                : ""
          }`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* gloss highlight */}
          <div
            className="absolute inset-0 pointer-events-none opacity-70"
            style={{
              background:
                "radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)",
            }}
          />
          {/* inner ring */}
          <div className="absolute inset-1 rounded-lg sm:rounded-xl border border-white/25 pointer-events-none" />
          {/* decorative corners */}
          <div className="absolute top-1.5 left-1.5 w-1 h-1 rounded-full bg-white/40" />
          <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-white/40" />
          <div className="absolute bottom-1.5 left-1.5 w-1 h-1 rounded-full bg-white/40" />
          <div className="absolute bottom-1.5 right-1.5 w-1 h-1 rounded-full bg-white/40" />

          {/* wrong tint overlay */}
          {isWrong && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0.4, 0.55, 0.3] }}
              transition={{ duration: 0.55, ease: "easeInOut" }}
              className="absolute inset-0 pointer-events-none bg-red-500/40 mix-blend-multiply"
            />
          )}

          {/* wrong X badge */}
          {isWrong && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-md z-10 ring-2 ring-white/60"
            >
              <span className="text-white text-[10px] font-black">✕</span>
            </motion.div>
          )}

          {/* matched check badge */}
          {card.isMatched && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center shadow-md z-10 ring-2 ring-white/60"
            >
              <span className="text-white text-[10px] font-black">✓</span>
            </motion.div>
          )}

          {/* sparkle burst on match */}
          {card.isMatched && (
            <div className="absolute inset-0 pointer-events-none overflow-visible">
              {[0, 1, 2, 3, 4, 5].map(i => {
                const angle = (i / 6) * Math.PI * 2;
                const dist = 28;
                return (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist,
                      opacity: 0,
                      scale: 1.2,
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 text-amber-200 text-sm drop-shadow"
                    style={{ transform: "translate(-50%, -50%)" }}
                  >
                    ✦
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* content */}
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              animate={card.isMatched ? { scale: [1, 1.25, 1], rotate: [0, -6, 6, 0] } : {}}
              transition={{ duration: 0.5 }}
              className={`${textSize} ${isTextContent ? "font-bold px-1.5 text-center leading-tight" : ""} text-white drop-shadow-lg select-none`}
            >
              {card.content}
            </motion.div>
          </div>
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className={`w-full h-full bg-gradient-to-br ${theme.gradient} ${theme.hover} flex items-center justify-center relative transition-all duration-300`}>
            {/* pattern */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: theme.pattern(patternSize),
                backgroundSize: `${patternSize * 2}px ${patternSize * 2}px`,
              }}
            />
            {/* gloss */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(110% 50% at 50% -10%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%)",
              }}
            />
            {/* inner border */}
            <div className="absolute inset-1 rounded-lg sm:rounded-xl border border-white/20 pointer-events-none" />
            {/* corner glyphs */}
            <span className="absolute top-1 left-1.5 text-white/40 text-[8px] sm:text-[10px] font-black">{theme.glyph}</span>
            <span className="absolute bottom-1 right-1.5 text-white/40 text-[8px] sm:text-[10px] font-black">{theme.glyph}</span>

            <div className="relative">
              <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${theme.accent} backdrop-blur-sm flex items-center justify-center border shadow-inner`}>
                <span className="text-white/85 text-base sm:text-lg font-black drop-shadow">{theme.glyph}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.button>
  );
}

function NewCardBackReveal({ level, lang }: { level: number; lang: string }) {
  const theme = getBackTheme(level);
  const patternSize = 8;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.18, type: "spring", stiffness: 380, damping: 22 }}
      className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-sm shadow-lg"
    >
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.7, type: "spring", stiffness: 160, damping: 16 }}
        style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
        className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden shadow-xl ring-1 ring-black/10 dark:ring-white/20"
      >
        <div className={`w-full h-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center relative`}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: theme.pattern(patternSize),
              backgroundSize: `${patternSize * 2}px ${patternSize * 2}px`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(110% 50% at 50% -10%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%)",
            }}
          />
          <div className="absolute inset-1 rounded-md sm:rounded-lg border border-white/20 pointer-events-none" />
          <div className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-md ${theme.accent} backdrop-blur-sm flex items-center justify-center border shadow-inner`}>
            <span className="text-white/90 text-xs sm:text-sm font-black drop-shadow">{theme.glyph}</span>
          </div>
        </div>
      </motion.div>
      <div className="text-start">
        <div className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wide leading-tight">
          {lang === "ar" ? "✨ ستايل جديد" : "✨ New style unlocked"}
        </div>
        <div className="text-[11px] sm:text-xs text-gray-600 dark:text-white/70 leading-tight">
          {lang === "ar" ? "تصميم بطاقة جديد" : "New card back design"}
        </div>
      </div>
    </motion.div>
  );
}

export default function MemoryPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const params = useParams<{ setId?: string }>();
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("memory");

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdownNum, setCountdownNum] = useState(3);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [wrongIds, setWrongIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [muted, setMuted] = useState(memorySound.muted);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LbEntry[]>([]);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [customPairs, setCustomPairs] = useState<{ q: string; a: string }[] | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customLoaded, setCustomLoaded] = useState(!params.setId);
  const [customNotFound, setCustomNotFound] = useState(false);

  const gameStartRef = useRef(Date.now());
  const levelStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const gameOverPlayedRef = useRef(false);
  const particleIdRef = useRef(0);
  const checkingRef = useRef(false);
  const customPairsRef = useRef<{ q: string; a: string }[] | null>(null);
  const countdownStartedRef = useRef(false);
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "gameover" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  useEffect(() => {
    fetch(`${API_BASE}/api/memory-scores`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLeaderboard(Array.isArray(d) ? d.slice(0, 10) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (params.setId) {
      fetch(`${API_BASE}/api/memory-card-sets/${params.setId}`)
        .then(r => {
          if (!r.ok) { setCustomNotFound(true); return null; }
          return r.json();
        })
        .then(d => {
          if (d?.pairs) {
            const p = d.pairs as { q: string; a: string }[];
            setCustomPairs(p);
            customPairsRef.current = p;
            setCustomTitle(d.title || "");
          }
          setCustomLoaded(true);
        })
        .catch(() => { setCustomNotFound(true); setCustomLoaded(true); });
    }
  }, [params.setId]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - levelStartRef.current) / 1000));
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startLevel = useCallback((lvl: number) => {
    const cp = customPairsRef.current || undefined;
    const newCards = generateCards(lvl, cp);
    setCards(newCards);
    setFlippedIds([]);
    setMoves(0);
    checkingRef.current = false;

    setPhase("preview");
    setCards(newCards.map(c => ({ ...c, isFlipped: true })));

    const previewTime = 10000 + (lvl - 1) * 5000;
    setTimeout(() => {
      setCards(prev => prev.map(c => ({ ...c, isFlipped: false })));
      setPhase("playing");
      levelStartRef.current = Date.now();
      startTimer();
    }, previewTime);
  }, [startTimer]);

  useEffect(() => {
    if (!customLoaded || countdownStartedRef.current) return;
    countdownStartedRef.current = true;

    let c = 3;
    setCountdownNum(c);
    const interval = setInterval(() => {
      c--;
      setCountdownNum(c);
      memorySound.playCountdown();
      if (c <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          memorySound.startBackground();
          gameStartRef.current = Date.now();
          startLevel(1);
        }, 400);
      }
    }, 800);
    return () => { clearInterval(interval); stopTimer(); };
  }, [customLoaded, startLevel, stopTimer]);

  useEffect(() => {
    return () => { memorySound.stopBackground(); };
  }, []);

  const spawnParticles = (x: number, y: number) => {
    const colors = ["#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#ef4444"];
    const newParticles: Particle[] = Array.from({ length: 12 }, () => ({
      id: particleIdRef.current++,
      x,
      y,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 8,
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, 1000);
  };

  const handleCardClick = (cardId: number, e: React.MouseEvent) => {
    if (phase !== "playing" || checkingRef.current) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    memorySound.playFlip();
    const newFlipped = [...flippedIds, cardId];
    setFlippedIds(newFlipped);
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));

    if (newFlipped.length === 2) {
      checkingRef.current = true;
      setMoves(m => m + 1);
      const [firstId, secondId] = newFlipped;
      const first = cards.find(c => c.id === firstId)!;
      const second = cards.find(c => c.id === secondId)!;

      if (first.pairId === second.pairId) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);

        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > maxStreak) setMaxStreak(newStreak);

        if (newStreak >= 3) memorySound.playStreak();
        else memorySound.playMatch();

        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: true } : c
          ));
          setFlippedIds([]);
          checkingRef.current = false;

          const timeMs = Date.now() - levelStartRef.current;
          const pts = calculateScore(level, newStreak, timeMs, moves + 1);
          setScore(prev => prev + pts);

          setCards(prev => {
            const updated = prev.map(c =>
              c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: true } : c
            );
            if (updated.every(c => c.isMatched)) {
              stopTimer();
              memorySound.playLevelUp();
              setPhase("levelup");
              setTimeout(() => {
                const nextLvl = level + 1;
                setLevel(nextLvl);
                setStreak(0);
                startLevel(nextLvl);
              }, 1500);
            }
            return updated;
          });
        }, 300);
      } else {
        setStreak(0);
        memorySound.playMismatch();
        setWrongIds(newFlipped);

        setTimeout(() => {
          setWrongIds([]);
          setCards(prev => prev.map(c =>
            newFlipped.includes(c.id) ? { ...c, isFlipped: false } : c
          ));
          setFlippedIds([]);
          checkingRef.current = false;

          const newLives = lives - 1;
          setLives(newLives);
          if (newLives <= 0) {
            stopTimer();
            setTotalTimeMs(Date.now() - gameStartRef.current);
            setPhase("gameover");
            memorySound.stopBackground();
          }
        }, 800);
      }
    }
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    memorySound.setMuted(newMuted);
    if (!newMuted && phase === "playing") memorySound.startBackground();
  };

  const handleRestart = () => {
    setLevel(1);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setLives(3);
    setWrongIds([]);
    setTotalTimeMs(0);
    setSaved(false);
    setIsNewRecord(false);
    setElapsedSec(0);
    gameOverPlayedRef.current = false;
    gameStartRef.current = Date.now();
    setPhase("countdown");
    let c = 3;
    setCountdownNum(c);
    const interval = setInterval(() => {
      c--;
      setCountdownNum(c);
      memorySound.playCountdown();
      if (c <= 0) {
        clearInterval(interval);
        setTimeout(() => {
          memorySound.startBackground();
          startLevel(1);
        }, 400);
      }
    }, 800);
  };

  const handleSaveScore = async () => {
    if (!playerName.trim() || saving) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/memory-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim(), score, level, timeMs: totalTimeMs }),
      });
      setSaved(true);
      const freshRes = await fetch(`${API_BASE}/api/memory-scores`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        const freshLb = Array.isArray(freshData) ? freshData.slice(0, 10) : [];
        setLeaderboard(freshLb);
        if (freshLb.some((e: LbEntry) => e.name === playerName.trim() && e.score === score)) {
          setIsNewRecord(true);
        }
      }
    } catch {}
    setSaving(false);
  };

  const config = getLevelConfig(level);

  if (customNotFound) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 px-4" dir={dir}>
          <div className="max-w-md w-full text-center bg-black/5 dark:bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-black/10 dark:border-white/10">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
              {lang === "ar" ? "لم يتم العثور على البطاقات" : "Card Set Not Found"}
            </h2>
            <p className="text-gray-500 dark:text-white/50 mb-6">
              {lang === "ar" ? "الرمز المدخل غير صحيح أو منتهي الصلاحية" : "The PIN is invalid or the card set no longer exists"}
            </p>
            <button
              onClick={() => setLocation("/game/memory")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg"
            >
              {lang === "ar" ? "العودة للعبة الذاكرة" : "Back to Memory Game"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "countdown") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950" dir={dir}>
          <div className="text-center relative">
            <motion.div
              key={countdownNum}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="absolute inset-0 w-44 h-44 rounded-full bg-indigo-500/20 blur-2xl"
                style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
              />
              <div className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl shadow-purple-700/50 flex items-center justify-center mb-6 border border-indigo-400/30">
                {countdownNum > 0 ? (
                  <span className="text-7xl font-black text-white drop-shadow-lg">{countdownNum}</span>
                ) : (
                  <Brain className="w-16 h-16 text-white drop-shadow-lg" />
                )}
              </div>
            </motion.div>
            <motion.p
              key={`label-${countdownNum}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-gray-700 dark:text-white/80 text-xl font-black tracking-wide"
            >
              {countdownNum > 0 ? (lang === "ar" ? "استعد!" : "Get Ready!") : (lang === "ar" ? "انطلق!" : "GO!")}
            </motion.p>
            <p className="text-indigo-500 dark:text-indigo-300/60 text-sm mt-2 font-medium">
              {lang === "ar" ? "لعبة الذاكرة" : "Memory Match"}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "gameover") {
    if (!gameOverPlayedRef.current) {
      gameOverPlayedRef.current = true;
      memorySound.playGameOver();
    }

    const stars = level >= 8 ? 5 : level >= 6 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1;
    const timeSec = Math.floor(totalTimeMs / 1000);
    const timeStr = `${Math.floor(timeSec / 60)}:${String(timeSec % 60).padStart(2, "0")}`;
    const lowestLbScore = leaderboard.length >= 10 ? leaderboard[leaderboard.length - 1]?.score ?? 0 : 0;
    const beatLeaderboard = score > lowestLbScore || leaderboard.length < 10;
    const showCelebration = level >= 4;

    return (
      <Layout>
        <ConfettiBurst active={showCelebration} />
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 py-8 px-4" dir={dir}>
          <div className="max-w-3xl mx-auto flex flex-col lg:flex-row gap-6">
            <div className="flex-1 max-w-md mx-auto lg:mx-0 w-full flex flex-col">
              <div>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="text-6xl mb-3"
                  >
                    {stars >= 4 ? "🏆" : stars >= 3 ? "🎉" : stars >= 2 ? "😤" : "😢"}
                  </motion.div>
                  <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}</h1>
                  {customTitle && <p className="text-purple-600 dark:text-purple-300 text-sm mb-2">{customTitle}</p>}

                  <div className="flex justify-center gap-1.5 my-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 300 }}
                      >
                        <Star className={`w-7 h-7 ${i < stars ? "text-amber-400 fill-amber-400 drop-shadow-lg" : "text-gray-300 dark:text-white/20"}`} />
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-3 mt-4 bg-black/5 dark:bg-white/5 rounded-2xl p-4">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "النقاط" : "Score"}</p>
                      <p className="text-xl font-black text-amber-500 dark:text-amber-400">{score}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "المستوى" : "Level"}</p>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{level}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "الوقت" : "Time"}</p>
                      <p className="text-xl font-black text-sky-600 dark:text-sky-400" dir="ltr">{timeStr}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "أعلى سلسلة" : "Best Streak"}</p>
                      <p className="text-xl font-black text-orange-500 dark:text-orange-400">{maxStreak}🔥</p>
                    </div>
                  </div>
                </motion.div>

                <div className="flex flex-col gap-3 mb-5">
                  <button onClick={handleRestart} className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-black text-lg shadow-lg flex items-center justify-center gap-2">
                    <RotateCcw className="w-6 h-6" />
                    {lang === "ar" ? "حاول مرة أخرى" : "Try Again"}
                  </button>
                  <ShareButtons
                    text={lang === "ar"
                      ? `🧠${playerName.trim() ? ` ${playerName.trim()} -` : ""} حصلت على ${score} نقطة ووصلت للمستوى ${level} في لعبة الذاكرة!\n⏱ ${timeStr} | 🔥 سلسلة ${maxStreak}\nجرّب تتغلب عليّ!`
                      : `🧠${playerName.trim() ? ` ${playerName.trim()} -` : ""} I scored ${score} points and reached level ${level} in Memory Match!\n⏱ ${timeStr} | 🔥 Streak ${maxStreak}\nTry to beat me!`}
                    url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/memory"}
                  />
                  <button onClick={() => setLocation("/game/memory")} className="w-full py-2.5 text-sm font-medium text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center gap-1.5">
                    <Home className="w-4 h-4" />
                    {lang === "ar" ? "العودة" : "Back"}
                  </button>
                </div>
              </div>

              <div className="mt-auto">
                {beatLeaderboard && !saved && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <p className="text-center text-amber-600 dark:text-amber-400 font-black text-sm mb-3">
                      🎉 {lang === "ar" ? "نتيجة مميزة! سجّل اسمك في لوحة المتصدرين!" : "Amazing score! Save your name to the leaderboard!"}
                    </p>
                    <input
                      type="text"
                      maxLength={20}
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                      className="w-full text-center text-lg font-bold py-3 px-4 rounded-xl bg-black/10 dark:bg-white/10 border-2 border-amber-500/30 text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none transition-colors mb-3"
                      onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                    />
                    <button onClick={handleSaveScore} disabled={!playerName.trim() || saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-lg disabled:opacity-50">
                      {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "سجّل نتيجتك" : "Save Score")}
                    </button>
                  </motion.div>
                )}

                {!beatLeaderboard && !saved && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4">
                    <input
                      type="text"
                      maxLength={20}
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      placeholder={lang === "ar" ? "أدخل اسمك..." : "Enter your name..."}
                      className="w-full text-center text-lg font-bold py-3 px-4 rounded-xl bg-black/10 dark:bg-white/10 border-2 border-black/20 dark:border-white/20 text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none transition-colors mb-3"
                      onKeyDown={e => e.key === "Enter" && handleSaveScore()}
                    />
                    <button onClick={handleSaveScore} disabled={!playerName.trim() || saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm shadow-lg disabled:opacity-50">
                      {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "سجّل نتيجتك" : "Save Score")}
                    </button>
                  </motion.div>
                )}

                {saved && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    {isNewRecord ? (
                      <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                        <div className="text-4xl mb-2">🧠✨</div>
                        <p className="text-emerald-600 dark:text-emerald-400 font-black text-base mb-1">{lang === "ar" ? "ذاكرتك خارقة! أنت بطل حقيقي 🏆" : "Super memory! You're a true champion 🏆"}</p>
                        <p className="text-gray-500 dark:text-white/50 text-xs">{lang === "ar" ? "تم حفظ نتيجتك في لوحة المتصدرين!" : "Your score has been saved to the leaderboard!"}</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">✓ {lang === "ar" ? "تم حفظ نتيجتك!" : "Score saved!"}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-56 shrink-0">
              <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-3 w-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-gray-700 dark:text-white/80">{lang === "ar" ? "المتصدرون" : "Top Players"}</span>
                </div>
                {leaderboard.length === 0 ? (
                  <p className="text-gray-400 dark:text-white/30 text-[10px] text-center py-2">{lang === "ar" ? "لا نتائج بعد" : "No scores yet"}</p>
                ) : (
                  <div className="space-y-1">
                    {leaderboard.map((e, i) => (
                      <div key={e.id} className={`flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-[10px] ${i === 0 ? "bg-amber-500/10" : ""}`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center font-black text-[8px] shrink-0 ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 dark:bg-slate-600 text-white" : i === 2 ? "bg-orange-600 text-white" : "bg-black/10 dark:bg-white/10 text-gray-500 dark:text-white/50"}`}>
                          {i === 0 ? <Crown className="w-2.5 h-2.5" /> : i < 3 ? <Medal className="w-2.5 h-2.5" /> : i + 1}
                        </span>
                        <span className="font-bold text-gray-600 dark:text-white/70 truncate flex-1 min-w-0">{e.name}</span>
                        <span className="font-black text-amber-500 dark:text-amber-400 shrink-0">{e.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const matchedCount = cards.filter(c => c.isMatched).length / 2;
  const totalPairs = config.pairs;
  const progress = totalPairs > 0 ? (matchedCount / totalPairs) * 100 : 0;
  const timeStr = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`;

  return (
    <Layout>
      <MatchParticles particles={particles} />

      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-indigo-950 dark:to-gray-950 flex items-center justify-center px-4" dir={dir}>
        <div className="max-w-2xl mx-auto w-full">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={lang === "ar"} />}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30">
                <Brain className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" />
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-200">
                  {lang === "ar" ? `م${level}` : `Lv${level}`}
                </span>
              </div>
              <button onClick={toggleMute} className="p-1.5 rounded-lg bg-black/10 dark:bg-white/10 text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Heart key={i} className={`w-3.5 h-3.5 transition-all ${i < lives ? "text-red-400 fill-red-400" : "text-gray-300 dark:text-white/15"}`} />
                ))}
              </div>
              <AnimatePresence>
                {streak >= 2 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-500 dark:text-orange-300 font-black text-xs">{streak}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
                <span className="font-black text-gray-900 dark:text-white text-xs">{score}</span>
                <span className="text-gray-400 dark:text-white/40 text-[10px] ms-1">{lang === "ar" ? "ن" : "pt"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, type: "spring" }}
              />
            </div>
            <span className="text-gray-500 dark:text-white/50 text-[10px] font-bold" dir="ltr">{timeStr}</span>
            <span className="text-gray-400 dark:text-white/40 text-[10px]">{matchedCount}/{totalPairs}</span>
          </div>

          <LevelUpSplash show={phase === "levelup"} level={level + 1} theme="indigo" />

          <AnimatePresence mode="wait">
            {phase === "preview" && (
              <motion.div
                key="preview-banner"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-center mb-3"
              >
                <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-700 dark:text-purple-200 text-sm font-black shadow-lg shadow-purple-500/10">
                  <Brain className="w-4 h-4" />
                  {lang === "ar" ? "احفظ البطاقات! 🧠" : "Memorize the cards! 🧠"}
                </span>
              </motion.div>
            )}

            {phase === "levelup" && (
              <motion.div
                key="levelup-banner"
                initial={{ opacity: 0, scale: 0.7, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="text-center mb-3 flex flex-col items-center gap-2"
              >
                <span className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-200 text-sm font-black shadow-lg shadow-emerald-500/10">
                  <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  {lang === "ar" ? `مستوى جديد! ${level + 1} 🎉` : `New Level! ${level + 1} 🎉`}
                  <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                </span>
                {getBackTheme(level + 1) !== getBackTheme(level) && (
                  <NewCardBackReveal level={level + 1} lang={lang} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout
            className="grid gap-2 sm:gap-3 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
              maxWidth: Math.min(config.cols * 90, 500),
            }}
          >
            {cards.map(card => (
              <GameCard
                key={card.id}
                card={card}
                onClick={(e) => handleCardClick(card.id, e)}
                disabled={phase !== "playing"}
                gridCols={config.cols}
                level={level}
                isWrong={wrongIds.includes(card.id)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
