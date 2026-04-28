import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ConfettiBurst } from "@/components/confetti-burst";
import { ArrowLeft, ArrowRight, Volume2, VolumeX, RotateCcw, Trophy, Crown, Medal, Star, Flame, Zap, Lightbulb, Delete, Home, MessageSquare, UserRound, Users, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ShareButtons } from "@/components/share-buttons";
import { getSocket } from "@/lib/socket";
import { useArena } from "@/lib/use-arena";
import { ArenaBar } from "@/components/multiplayer-lobby";
import {
  getWordsByDifficulty,
  scrambleLetters,
  getRoundTime,
  calculateScore,
  getDifficultyLabel,
} from "@/lib/scramble-engine";
import type { ScrambleDifficulty, ScrambleWord } from "@/lib/scramble-engine";
import { scrambleSound } from "@/lib/scramble-sounds";
import { LevelUpSplash } from "@/components/level-up-splash";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Phase = "countdown" | "playing" | "correct" | "wrong" | "gameover";

interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  level: number;
  streak: number;
}

interface LetterTile {
  id: number;
  letter: string;
  used: boolean;
}

function getStarRating(level: number): number {
  if (level >= 13) return 5;
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

const VALID_DIFFICULTIES: ScrambleDifficulty[] = ["easy", "medium", "hard", "challenge"];

function parseSettings(search: string): { difficulty: ScrambleDifficulty; category: string | undefined; pin: string | undefined } {
  const params = new URLSearchParams(search);
  const diffParam = params.get("difficulty");
  const category = params.get("category") || undefined;
  const pin = params.get("pin") || undefined;
  const validDiff = (diffParam && VALID_DIFFICULTIES.includes(diffParam as ScrambleDifficulty)) ? diffParam as ScrambleDifficulty : "medium";
  return { difficulty: validDiff, category, pin };
}

export default function ScramblePlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;
  const { isArenaMode, myName, opponents, results, updateScore, finishArena } = useArena("scramble");

  const parsed = useMemo(() => parseSettings(searchString), [searchString]);
  const diffRef = useRef(parsed.difficulty);
  diffRef.current = parsed.difficulty;

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countVal, setCountVal] = useState(3);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [currentWord, setCurrentWord] = useState<ScrambleWord | null>(null);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(100);
  const [muted, setMuted] = useState(scrambleSound.muted);
  const [showScorePopup, setShowScorePopup] = useState<number | null>(null);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintText, setHintText] = useState("");
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);
  const [splashLevel, setSplashLevel] = useState<number | null>(null);

  const roundStart = useRef(0);
  const gameStart = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenAtRef = useRef(0);
  const pendingTimeouts = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const wordPoolRef = useRef<ScrambleWord[]>([]);
  const usedWordsRef = useRef<Set<string>>(new Set());
  const arenaFinishedRef = useRef(false);

  useEffect(() => { if (isArenaMode) updateScore(score); }, [score]);
  useEffect(() => {
    if (isArenaMode && phase === "gameover" && !arenaFinishedRef.current) {
      arenaFinishedRef.current = true;
      finishArena(score);
    }
  }, [phase]);

  const [customWords, setCustomWords] = useState<ScrambleWord[] | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customLoaded, setCustomLoaded] = useState(!parsed.pin);
  const [customNotFound, setCustomNotFound] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState(() => {
    try { return localStorage.getItem("scramble-player-name") || ""; } catch { return ""; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const socketJoinedRef = useRef(false);

  const needsName = parsed.pin && !playerName.trim();
  const [nameReady, setNameReady] = useState(!needsName);
  const [inLobby, setInLobby] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const waitRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleNameSubmit = () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;
    try { localStorage.setItem("scramble-player-name", trimmed); } catch {}
    setNameReady(true);
  };

  useEffect(() => {
    if (!parsed.pin || socketJoinedRef.current || !nameReady) return;
    const name = playerName.trim();
    if (!name) return;
    const socket = getSocket();
    socket.emit("scramble:student-join", { pin: parsed.pin, name });
    socketJoinedRef.current = true;

    socket.on("scramble:joined-lobby", (data: { playerCount: number }) => {
      setInLobby(true);
      setWaitingForTeacher(false);
      setLobbyCount(data.playerCount);
      if (waitRetryRef.current) {
        clearInterval(waitRetryRef.current);
        waitRetryRef.current = null;
      }
    });

    socket.on("scramble:joined-playing", () => {
      setInLobby(false);
      setWaitingForTeacher(false);
      setGameStarted(true);
      if (waitRetryRef.current) {
        clearInterval(waitRetryRef.current);
        waitRetryRef.current = null;
      }
    });

    const handleWaitForTeacher = () => {
      setWaitingForTeacher(true);
      if (!waitRetryRef.current) {
        waitRetryRef.current = setInterval(() => {
          socket.emit("scramble:student-join", { pin: parsed.pin, name });
        }, 3000);
      }
    };

    socket.on("scramble:no-session", handleWaitForTeacher);
    socket.on("scramble:waiting-for-teacher", handleWaitForTeacher);

    socket.on("scramble:teacher-connected", () => {
      // Teacher just connected — re-join to get proper lobby state
      socket.emit("scramble:student-join", { pin: parsed.pin, name });
    });

    socket.on("scramble:game-started", () => {
      setInLobby(false);
      setWaitingForTeacher(false);
      setGameStarted(true);
      if (waitRetryRef.current) {
        clearInterval(waitRetryRef.current);
        waitRetryRef.current = null;
      }
    });

    socket.on("scramble:lobby-count", (data: { count: number }) => {
      setLobbyCount(data.count);
    });

    socket.on("scramble:session-ended", () => {
      if (waitRetryRef.current) {
        clearInterval(waitRetryRef.current);
        waitRetryRef.current = null;
      }
    });

    return () => {
      socket.off("scramble:joined-lobby");
      socket.off("scramble:joined-playing");
      socket.off("scramble:no-session");
      socket.off("scramble:waiting-for-teacher");
      socket.off("scramble:teacher-connected");
      socket.off("scramble:game-started");
      socket.off("scramble:lobby-count");
      socket.off("scramble:session-ended");
      if (waitRetryRef.current) {
        clearInterval(waitRetryRef.current);
        waitRetryRef.current = null;
      }
    };
  }, [parsed.pin, nameReady, playerName]);

  const solvedWordsCount = level - 1;
  const totalWordsCount = wordPoolRef.current.length;

  useEffect(() => {
    if (!parsed.pin || !socketJoinedRef.current || !gameStarted) return;
    const socket = getSocket();
    socket.emit("scramble:update-progress", {
      score,
      level,
      lives,
      streak,
      solvedWords: solvedWordsCount,
      totalWords: totalWordsCount,
      status: phase === "gameover" ? "gameover" : "playing",
    });
  }, [score, level, lives, streak, phase, parsed.pin, gameStarted, solvedWordsCount, totalWordsCount]);

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

  useEffect(() => {
    if (parsed.pin) {
      fetch(`${API_BASE}/api/word-sets/${parsed.pin}`)
        .then(r => {
          if (!r.ok) { setCustomNotFound(true); setCustomLoaded(true); return null; }
          return r.json();
        })
        .then(d => {
          if (d?.words && Array.isArray(d.words)) {
            const w = (d.words as { word: string; hint?: string; question?: string }[]).map(item => ({
              word: item.word,
              hint: item.hint || "",
              category: "custom",
              question: item.question || "",
            }));
            setCustomWords(w);
            setCustomTitle(d.title || "");
            wordPoolRef.current = [...w].sort(() => Math.random() - 0.5);
          }
          setCustomLoaded(true);
        })
        .catch(() => { setCustomNotFound(true); setCustomLoaded(true); });
    } else {
      const pool = getWordsByDifficulty(parsed.difficulty, parsed.category);
      wordPoolRef.current = [...pool].sort(() => Math.random() - 0.5);
    }
  }, [parsed.pin, parsed.difficulty, parsed.category]);

  const pickNextWord = useCallback((): ScrambleWord | null => {
    const pool = wordPoolRef.current;
    const unused = pool.filter(w => !usedWordsRef.current.has(w.word));
    if (unused.length === 0) {
      usedWordsRef.current.clear();
      const reshuffled = [...pool].sort(() => Math.random() - 0.5);
      if (reshuffled.length === 0) return null;
      usedWordsRef.current.add(reshuffled[0].word);
      return reshuffled[0];
    }
    const pick = unused[Math.floor(Math.random() * unused.length)];
    usedWordsRef.current.add(pick.word);
    return pick;
  }, []);

  const startRound = useCallback((lvl: number) => {
    clearTimer();
    const word = pickNextWord();
    if (!word) return;
    setCurrentWord(word);
    setHintUsed(false);
    setHintText("");
    const scrambled = scrambleLetters(word.word);
    setTiles(scrambled.map((letter, i) => ({ id: i, letter, used: false })));
    setSelected([]);
    setTimeLeft(100);
    setPhase("playing");
    roundStart.current = Date.now();
    if (gameStart.current === 0) gameStart.current = Date.now();
    scrambleSound.startBackground();

    const totalMs = getRoundTime(diffRef.current, lvl) * 1000;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundStart.current;
      const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
      const remainingMs = totalMs - elapsed;
      setTimeLeft(pct);
      if (remainingMs <= 3000 && remainingMs > 2950) scrambleSound.playTick();
      if (remainingMs <= 2000 && remainingMs > 1950) scrambleSound.playTick();
      if (remainingMs <= 1000 && remainingMs > 950) scrambleSound.playTick();
      if (pct <= 0) {
        clearTimer();
        scrambleSound.playWrong();
        setLives(prev => {
          const newLives = prev - 1;
          livesRef.current = newLives;
          if (newLives <= 0) {
            setTotalTimeMs(Date.now() - gameStart.current);
            setPhase("wrong");
            safeTimeout(() => {
              scrambleSound.playGameOver();
              setPhase("gameover");
            }, 1500);
          } else {
            setStreak(0);
            setPhase("wrong");
            safeTimeout(() => startRound(lvl), 1500);
          }
          return newLives;
        });
      }
    }, 50);
  }, [clearTimer, pickNextWord, safeTimeout]);

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
        if (phase === "playing" && currentWord) {
          const totalMs = getRoundTime(diffRef.current, level) * 1000;
          timerRef.current = setInterval(() => {
            const elapsed = Date.now() - roundStart.current;
            const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
            setTimeLeft(pct);
            if (pct <= 0) {
              clearTimer();
              scrambleSound.playWrong();
              setLives(prev => {
                const newLives = prev - 1;
                if (newLives <= 0) {
                  setTotalTimeMs(Date.now() - gameStart.current);
                  setPhase("wrong");
                  safeTimeout(() => {
                    scrambleSound.playGameOver();
                    setPhase("gameover");
                  }, 1500);
                } else {
                  setStreak(0);
                  setPhase("wrong");
                  safeTimeout(() => startRound(level), 1500);
                }
                return newLives;
              });
            }
          }, 50);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, level, currentWord, clearTimer]);

  const shouldStartCountdown = parsed.pin
    ? (customLoaded && nameReady && gameStarted)
    : (customLoaded && nameReady);

  useEffect(() => {
    if (!shouldStartCountdown) return;
    let c = 3;
    setCountVal(c);
    setPhase("countdown");
    const interval = setInterval(() => {
      c--;
      setCountVal(c);
      if (c <= 0) {
        clearInterval(interval);
        safeTimeout(() => startRound(1), 400);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [shouldStartCountdown, startRound, safeTimeout]);

  useEffect(() => {
    return () => {
      clearTimer();
      clearAllTimeouts();
      if (countdownRef.current) clearInterval(countdownRef.current);
      scrambleSound.stopBackground();
    };
  }, [clearTimer, clearAllTimeouts]);

  const handleTileTap = (tileId: number) => {
    if (phase !== "playing" || !currentWord) return;
    const tile = tiles.find(t => t.id === tileId);
    if (!tile || tile.used) return;

    scrambleSound.playLetterTap();
    const newSelected = [...selected, tileId];
    setSelected(newSelected);
    setTiles(prev => prev.map(t => t.id === tileId ? { ...t, used: true } : t));

    const built = newSelected.map(id => tiles.find(t => t.id === id)!.letter).join("");

    if (built.length === currentWord.word.length) {
      clearTimer();
      if (built === currentWord.word) {
        const elapsed = Date.now() - roundStart.current;
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        const pts = calculateScore(level, newStreak, elapsed, diffRef.current, currentWord.word.length, hintUsed);
        setScore(s => s + pts);
        setShowScorePopup(pts);
        scrambleSound.playCorrect();

        if (newStreak >= 3 && (newStreak === 3 || newStreak === 5 || newStreak === 10)) {
          safeTimeout(() => scrambleSound.playStreak(), 200);
        }

        setPhase("correct");
        const nextLvl = level + 1;
        if (nextLvl % 3 === 0) {
          setSplashLevel(nextLvl);
          safeTimeout(() => setSplashLevel(null), 1300);
        }
        safeTimeout(() => {
          setShowScorePopup(null);
          setLevel(nextLvl);
          startRound(nextLvl);
        }, 1200);
      } else {
        scrambleSound.playWrong();
        setLives(prev => {
          const newLives = prev - 1;
          livesRef.current = newLives;
          setStreak(0);
          if (newLives <= 0) {
            setTotalTimeMs(Date.now() - gameStart.current);
            setPhase("wrong");
            safeTimeout(() => {
              scrambleSound.playGameOver();
              setPhase("gameover");
            }, 1500);
          } else {
            setPhase("wrong");
            safeTimeout(() => {
              startRound(level);
            }, 1000);
          }
          return newLives;
        });
      }
    }
  };

  const handleBackspace = () => {
    if (phase !== "playing" || selected.length === 0) return;
    scrambleSound.playBackspace();
    const lastId = selected[selected.length - 1];
    setSelected(prev => prev.slice(0, -1));
    setTiles(prev => prev.map(t => t.id === lastId ? { ...t, used: false } : t));
  };

  const handleHint = () => {
    if (phase !== "playing" || !currentWord || hintUsed) return;
    setHintUsed(true);
    setHintText(currentWord.hint || (lang === "ar" ? `يبدأ بـ "${currentWord.word[0]}"` : `Starts with "${currentWord.word[0]}"`));
    scrambleSound.playHint();
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    scrambleSound.setMuted(next);
    if (!next && phase === "playing") scrambleSound.startBackground();
  };

  const handleRestart = () => {
    clearTimer();
    clearAllTimeouts();
    scrambleSound.stopBackground();
    usedWordsRef.current.clear();
    setPhase("countdown");
    setCountVal(3);
    setLevel(1);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setLives(3);
    livesRef.current = 3;
    setSelected([]);
    setTiles([]);
    setSaved(false);
    setTotalTimeMs(0);
    gameStart.current = 0;

    if (countdownRef.current) clearInterval(countdownRef.current);
    let c = 3;
    setCountVal(c);
    countdownRef.current = setInterval(() => {
      c--;
      setCountVal(c);
      if (c <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        safeTimeout(() => startRound(1), 400);
      }
    }, 800);
  };

  const handleSave = async () => {
    if (!playerName.trim() || saving || saved) return;
    setSaving(true);
    try {
      localStorage.setItem("scramble-player-name", playerName.trim());
    } catch {}
    try {
      const res = await fetch(`${API_BASE}/api/scramble-scores`, {
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
        const lb = await fetch(`${API_BASE}/api/scramble-scores?difficulty=${diffRef.current}`);
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
      fetch(`${API_BASE}/api/scramble-scores?difficulty=${diffRef.current}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setLeaderboard(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [phase]);

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  }

  const timerColor = timeLeft > 50 ? "bg-green-500" : timeLeft > 25 ? "bg-yellow-500" : "bg-red-500";
  const builtWord = selected.map(id => tiles.find(t => t.id === id)?.letter || "").join("");

  if (parsed.pin && !nameReady) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-950 to-gray-950 px-4" dir={dir}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <UserRound className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {lang === "ar" ? "أدخل اسمك" : "Enter Your Name"}
            </h2>
            {customTitle && <p className="text-purple-300 text-sm mb-1">{customTitle}</p>}
            <p className="text-white/40 text-xs mb-5">
              {lang === "ar" ? "سيظهر اسمك للمعلم أثناء اللعب" : "Your name will be visible to the teacher during play"}
            </p>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value.slice(0, 30))}
              onKeyDown={e => { if (e.key === "Enter") handleNameSubmit(); }}
              placeholder={lang === "ar" ? "اكتب اسمك هنا..." : "Type your name here..."}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center font-bold text-lg placeholder:text-white/30 focus:outline-none focus:border-purple-400 mb-4"
              dir={dir}
              autoFocus
            />
            <button
              onClick={handleNameSubmit}
              disabled={!playerName.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black text-lg shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              {lang === "ar" ? "انضم للغرفة" : "Join Room"}
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (parsed.pin && nameReady && waitingForTeacher) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-950 to-gray-950 px-4" dir={dir}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {lang === "ar" ? "في انتظار المعلم..." : "Waiting for Teacher..."}
            </h2>
            {customTitle && <p className="text-purple-300 text-sm mb-1">{customTitle}</p>}
            <p className="text-white/40 text-xs mb-4">
              {lang === "ar" ? "الغرفة غير متاحة بعد — سيتم الانضمام تلقائياً عند فتحها" : "Room not available yet — you'll join automatically when it opens"}
            </p>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 inline-block">
              <p className="text-white/30 text-[10px] font-bold mb-0.5">{lang === "ar" ? "الرمز" : "PIN"}</p>
              <p className="text-xl font-black text-purple-400 tracking-widest" dir="ltr">{parsed.pin}</p>
            </div>
            <button onClick={() => setLocation("/game/scramble")}
              className="w-full mt-6 py-2.5 rounded-xl bg-white/10 text-white/60 font-bold text-sm hover:bg-white/15 transition-all">
              {lang === "ar" ? "العودة" : "Go Back"}
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (parsed.pin && nameReady && inLobby && !gameStarted) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-950 to-gray-950 px-4" dir={dir}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm w-full text-center bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">
              {lang === "ar" ? "أنت في غرفة الانتظار!" : "You're in the Lobby!"}
            </h2>
            {customTitle && <p className="text-purple-300 text-sm mb-1">{customTitle}</p>}
            <p className="text-white/40 text-xs mb-4">
              {lang === "ar" ? "ستبدأ اللعبة عندما يضغط المعلم \"ابدأ\"" : "The game will start when the teacher presses \"Start\""}
            </p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/30 text-[10px] font-bold mb-0.5">{lang === "ar" ? "اسمك" : "Your Name"}</p>
                <p className="text-sm font-bold text-white">{playerName}</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <p className="text-white/30 text-[10px] font-bold mb-0.5">{lang === "ar" ? "اللاعبون" : "Players"}</p>
                <p className="text-sm font-bold text-purple-400">{lobbyCount}</p>
              </div>
            </div>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center justify-center gap-2 text-white/50 text-sm"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {lang === "ar" ? "في انتظار بدء اللعبة..." : "Waiting for game to start..."}
            </motion.div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (customNotFound) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-950 to-gray-950 px-4" dir={dir}>
          <div className="max-w-md w-full text-center bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-2xl font-black text-white mb-2">
              {lang === "ar" ? "لم يتم العثور على الكلمات" : "Word Set Not Found"}
            </h2>
            <p className="text-white/50 mb-6">
              {lang === "ar" ? "الرمز المدخل غير صحيح أو منتهي الصلاحية" : "The PIN is invalid or the word set no longer exists"}
            </p>
            <button onClick={() => setLocation("/game/scramble")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-lg">
              {lang === "ar" ? "العودة للعبة" : "Back to Game"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "countdown") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-violet-950 to-purple-950" dir={dir}>
          <div className="text-center relative">
            <motion.div
              key={countVal}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="relative"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="absolute inset-0 w-40 h-40 rounded-full bg-violet-500/20 blur-2xl mx-auto"
              />
              <div className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-700 shadow-2xl shadow-violet-700/50 flex items-center justify-center mb-6 border border-violet-400/30">
                <span className="text-7xl font-black text-white drop-shadow-lg">
                  {countVal > 0 ? countVal : "🔤"}
                </span>
              </div>
            </motion.div>
            <motion.p
              key={`label-${countVal}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white/80 text-xl font-black tracking-wide"
            >
              {countVal > 0 ? (lang === "ar" ? "استعد!" : "Get Ready!") : (lang === "ar" ? "انطلق!" : "GO!")}
            </motion.p>
            {customTitle && <p className="text-violet-300/70 mt-2 text-sm font-medium">{customTitle}</p>}
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "gameover") {
    const stars = getStarRating(level);
    const timeStr = formatTime(totalTimeMs);
    const showCelebration = level >= 5;

    return (
      <Layout>
        <ConfettiBurst active={showCelebration} />
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-violet-950 to-purple-950 py-8 px-4" dir={dir}>
          <div className="max-w-3xl mx-auto flex flex-col lg:flex-row gap-6">
            <div className="flex-1 max-w-md mx-auto lg:mx-0 w-full">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="text-6xl mb-3"
                >
                  {stars >= 4 ? "🏆" : stars >= 3 ? "🎉" : stars >= 2 ? "😤" : "😢"}
                </motion.div>
                <h1 className="text-3xl font-black text-white mb-2">{lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}</h1>
                {customTitle && <p className="text-purple-300 text-sm mb-2">{customTitle}</p>}

                <div className="flex justify-center gap-1.5 my-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div key={i} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2 + i * 0.1, type: "spring", stiffness: 300 }}>
                      <Star className={`w-7 h-7 ${i < stars ? "text-amber-400 fill-amber-400 drop-shadow-lg" : "text-white/20"}`} />
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4 bg-white/5 rounded-2xl p-4">
                  <div className="text-center">
                    <p className="text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "النقاط" : "Score"}</p>
                    <p className="text-xl font-black text-amber-400">{score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "المستوى" : "Level"}</p>
                    <p className="text-xl font-black text-emerald-400">{level}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "الوقت" : "Time"}</p>
                    <p className="text-xl font-black text-sky-400" dir="ltr">{timeStr}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/50 text-[10px] font-bold mb-1">{lang === "ar" ? "أعلى سلسلة" : "Best Streak"}</p>
                    <p className="text-xl font-black text-orange-400">{bestStreak}🔥</p>
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-3 mb-5">
                <button onClick={handleRestart} className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black text-lg shadow-lg flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  {lang === "ar" ? "العب مرة أخرى" : "Play Again"}
                </button>
                <button onClick={() => setLocation("/game/scramble")}
                  className="w-full py-3 rounded-xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-1.5">
                  <Home className="w-4 h-4" />
                  {lang === "ar" ? "الرئيسية" : "Home"}
                </button>
              </div>

              <div className="mb-3">
                <ShareButtons
                  text={lang === "ar"
                    ? `🔤${playerName.trim() ? ` ${playerName.trim()} -` : ""} وصلت للمستوى ${level} بنتيجة ${score} في لعبة الكلمات المبعثرة!\n🔥 أفضل سلسلة ${bestStreak}\nجرّب تتغلب عليّ!`
                    : `🔤${playerName.trim() ? ` ${playerName.trim()} -` : ""} I reached level ${level} with score ${score} in Scrambled Words!\n🔥 Best streak ${bestStreak}\nTry to beat me!`}
                  url={window.location.origin + (import.meta.env.BASE_URL || "/") + "game/scramble"}
                />
              </div>

              {!parsed.pin && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-white/60 text-xs font-bold mb-2">{lang === "ar" ? "سجّل نتيجتك" : "Save your score"}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={playerName}
                      onChange={e => setPlayerName(e.target.value)}
                      placeholder={lang === "ar" ? "اسمك" : "Your name"}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm font-bold"
                      maxLength={30}
                      disabled={saved}
                    />
                    <button onClick={handleSave} disabled={!playerName.trim() || saving || saved}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm disabled:opacity-40">
                      {saved ? "✓" : saving ? "..." : (lang === "ar" ? "حفظ" : "Save")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!parsed.pin && leaderboard.length > 0 && (
              <div className="flex-1 max-w-md mx-auto lg:mx-0 w-full">
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <h2 className="font-black text-white text-base">{lang === "ar" ? "لوحة المتصدرين" : "Leaderboard"}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 ms-auto">
                      {getDifficultyLabel(parsed.difficulty, lang)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 10).map((entry, i) => (
                      <div key={entry.id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? "bg-amber-500/10 border border-amber-500/20" : i < 3 ? "bg-white/5" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 dark:bg-slate-600 text-gray-900 dark:text-slate-100" : i === 2 ? "bg-orange-600 text-white" : "bg-white/10 text-white/60"}`}>
                          {i === 0 ? <Crown className="w-3.5 h-3.5" /> : i < 3 ? <Medal className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{entry.name}</p>
                          <p className="text-[10px] text-white/40">
                            {lang === "ar" ? `المستوى ${entry.level}` : `Lvl ${entry.level}`}
                            {entry.streak > 0 && <span className="text-purple-400"> • 🔥{entry.streak}</span>}
                          </p>
                        </div>
                        <span className="font-black text-purple-400 text-sm">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <LevelUpSplash show={splashLevel !== null} level={splashLevel ?? 0} theme="violet" />
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-fuchsia-950/20 py-4 px-4" dir={dir}>
        <div className="max-w-lg mx-auto">
          {isArenaMode && <ArenaBar myName={myName} myScore={score} opponents={opponents} results={results} isRtl={lang === "ar"} />}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { clearTimer(); clearAllTimeouts(); scrambleSound.stopBackground(); setLocation("/game/scramble"); }}
              className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
              <BackArrow className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {streak >= 3 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-black text-orange-600 dark:text-orange-400">{streak}</span>
                </motion.div>
              )}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`text-sm ${i < lives ? "" : "opacity-20"}`}>❤️</span>
                ))}
              </div>
              <div className="px-3 py-1.5 rounded-full bg-card border border-border/60">
                <span className="text-xs font-bold text-muted-foreground">
                  {lang === "ar" ? `المستوى ${level}` : `Lvl ${level}`}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <span className="text-sm font-black text-purple-600 dark:text-purple-400">{score}</span>
              </div>
            </div>
            <button onClick={handleToggleMute}
              className="p-2 rounded-xl bg-card border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          {phase === "playing" && (
            <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
              <motion.div className={`h-full rounded-full ${timerColor} transition-colors duration-300`}
                style={{ width: `${timeLeft}%` }} />
            </div>
          )}

          {phase === "wrong" && (
            <div className="w-full h-2 bg-red-200 dark:bg-red-900/30 rounded-full mb-4" />
          )}

          <div className="relative">
            <AnimatePresence>
              {showScorePopup !== null && (
                <motion.div initial={{ y: 0, opacity: 1, scale: 1 }} animate={{ y: -40, opacity: 0, scale: 1.3 }}
                  transition={{ duration: 0.8 }} className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span className="text-lg font-black text-purple-500">+{showScorePopup}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-xl mb-4 text-center">
              {currentWord && (
                <>
                  {currentWord.question && (
                    <div className="flex items-center justify-center gap-1.5 mb-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300" dir="rtl">{currentWord.question}</p>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs font-bold mb-1">
                    {currentWord.category !== "custom" ? currentWord.category : customTitle}
                  </p>
                  <div className="min-h-[4rem] flex items-center justify-center gap-2 mb-4 flex-wrap" dir="rtl">
                    {currentWord.word.split("").map((_, i) => {
                      const letter = i < builtWord.length ? builtWord[i] : "";
                      const isCorrectSoFar = phase === "correct";
                      const isWrongPhase = phase === "wrong";
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{
                            scale: letter ? 1 : 0.9,
                            opacity: 1,
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 20, delay: letter ? 0 : i * 0.03 }}
                          className={`w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-2 flex items-center justify-center font-black text-xl sm:text-2xl transition-all ${
                            letter
                              ? isCorrectSoFar
                                ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 shadow-md shadow-green-500/20"
                                : isWrongPhase
                                  ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 shadow-md shadow-red-500/20"
                                  : "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 shadow-md shadow-violet-500/20"
                              : "border-dashed border-border/50 bg-muted/20 text-transparent"
                          }`}
                        >
                          {letter || <span className="text-border/40 text-base">·</span>}
                        </motion.div>
                      );
                    })}
                  </div>
                  {phase === "wrong" && currentWord && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-sm font-bold text-green-500 mb-2" dir="rtl">
                      {lang === "ar" ? `الإجابة: ${currentWord.word}` : `Answer: ${currentWord.word}`}
                    </motion.p>
                  )}
                  {hintText && (
                    <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                      💡 {hintText}
                    </motion.p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-5" dir="rtl">
            {tiles.map((tile, tileIdx) => (
              <motion.button
                key={tile.id}
                initial={{ scale: 0, rotate: (tileIdx % 2 === 0 ? -20 : 20), y: -20 }}
                animate={{
                  scale: tile.used ? 0.65 : 1,
                  rotate: 0,
                  y: 0,
                  opacity: tile.used ? 0.25 : 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 18, delay: tileIdx * 0.04 }}
                whileTap={!tile.used ? { scale: 0.85, rotate: -5 } : {}}
                onClick={() => handleTileTap(tile.id)}
                disabled={tile.used || phase !== "playing"}
                className={`relative w-14 h-16 sm:w-16 sm:h-[4.5rem] rounded-2xl font-black text-2xl sm:text-3xl transition-colors select-none ${
                  tile.used
                    ? "bg-muted text-muted-foreground cursor-default"
                    : phase === "correct"
                      ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white cursor-default"
                      : phase === "wrong"
                        ? "bg-gradient-to-br from-red-400 to-rose-600 text-white cursor-default"
                        : "bg-gradient-to-br from-violet-500 to-purple-700 text-white hover:from-violet-400 hover:to-purple-600 cursor-pointer"
                }`}
                style={!tile.used ? {
                  boxShadow: phase === "correct"
                    ? "0 6px 0 #16a34a, 0 8px 20px rgba(34,197,94,0.4)"
                    : phase === "wrong"
                      ? "0 6px 0 #dc2626, 0 8px 20px rgba(239,68,68,0.4)"
                      : "0 6px 0 #6d28d9, 0 8px 20px rgba(139,92,246,0.35)"
                } : {}}
              >
                <span className="drop-shadow-md">{tile.letter}</span>
              </motion.button>
            ))}
          </div>

          <div className="flex gap-2 justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleBackspace}
              disabled={selected.length === 0 || phase !== "playing"}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-card border border-border/60 text-foreground font-bold text-sm disabled:opacity-30 transition-all hover:bg-muted shadow-sm"
            >
              <Delete className="w-4 h-4" />
              {lang === "ar" ? "مسح" : "Undo"}
            </motion.button>
            {currentWord && currentWord.word.length > 5 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleHint}
                disabled={hintUsed || phase !== "playing"}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-bold text-sm disabled:opacity-30 transition-all hover:bg-amber-100 dark:hover:bg-amber-950/40 shadow-sm"
              >
                <Lightbulb className="w-4 h-4" />
                {lang === "ar" ? "تلميح" : "Hint"}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
