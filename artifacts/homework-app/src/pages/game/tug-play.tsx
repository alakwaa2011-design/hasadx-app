import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { type TugImpulse } from "@/components/game/cartoon-tug-scene";
import { AvatarDisplay } from "@/components/avatar-display";
import { QRModalButton } from "@/components/game-qr-code";
import { Volume2, VolumeX } from "lucide-react";
import {
  TugSoundEngine, MUSIC_STYLES, Confetti, PowerPullFlash, CountdownOverlay,
  TimerRing, TugArena, KAHOOT_SHAPES, WAMID_GRADIENT, WAMID_BORDER,
  type QuestionData, type MusicStyle,
} from "@/components/game/tug-shared";

type Phase =
  | "connecting"
  | "lobby"
  | "countdown"
  | "question"
  | "answered"
  | "round-end"
  | "finished"
  | "paused";

interface PlayerInfo {
  name: string;
  avatar: string;
  team: "blue" | "red";
  score: number;
  streak?: number;
}

interface RoundEndData {
  correctIndex: number;
  ropePosition: number;
  blueScore: number;
  redScore: number;
  players: PlayerInfo[];
  isLast: boolean;
  questionIndex: number;
  total: number;
  isPower?: boolean;
  blueOnFire?: boolean;
  redOnFire?: boolean;
  autoAdvance?: boolean;
  autoAdvanceIn?: number | null;
}

interface GameEndData {
  winner: "blue" | "red" | "draw";
  ropePosition: number;
  players: PlayerInfo[];
}

const ENCOURAGE_CORRECT = [
  "ممتاز! 🌟", "عبقري! 🧠", "رائع جداً! ✨", "أحسنت! 💪", "مذهل! 🔥",
  "بطل! 🏆", "خارق! ⚡", "رهيب! 🎯", "استمر! 🚀", "لا يُهزم! 💎",
];
const ENCOURAGE_WRONG = [
  "لا تستسلم! 💪", "حاول مجدداً! 🎯", "قريب! 🔥", "المرة القادمة! ⭐",
];
const STREAK_MSGS = [
  "سلسلة إجابات! 🔥🔥", "على النار! 🔥🔥🔥", "لا يوقفه أحد! ⚡🔥",
];

function ScorePopup({ value, correct }: { value: string; correct: boolean }) {
  return (
    <motion.div initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -60, scale: 1.4 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={`absolute left-1/2 -translate-x-1/2 top-0 font-black text-2xl pointer-events-none z-30 drop-shadow-lg ${correct ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"}`}
    >
      {value}
    </motion.div>
  );
}

function CheerMessage({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 1.1 }} transition={{ duration: 0.35 }}
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-400/95 text-black font-black px-5 py-2 rounded-2xl shadow-2xl text-base pointer-events-none"
    >
      {msg}
    </motion.div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  return (
    <motion.div
      initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }}
      transition={{ repeat: Infinity, duration: 0.6 }}
      className="inline-flex items-center gap-1 bg-orange-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg"
    >
      <span>🔥</span>
      <span>{streak}x</span>
    </motion.div>
  );
}

function TeacherPanel({
  isOpen, onClose, players, ropePos, phase, pin, lang,
  onSkip, onEndGame, onPause, onResume, isPaused,
}: {
  isOpen: boolean; onClose: () => void; players: PlayerInfo[];
  ropePos: number; phase: Phase; pin: string; lang: string;
  onSkip: () => void; onEndGame: () => void;
  onPause: () => void; onResume: () => void; isPaused: boolean;
}) {
  const blueTeam = [...players.filter((p) => p.team === "blue")].sort((a, b) => b.score - a.score);
  const redTeam = [...players.filter((p) => p.team === "red")].sort((a, b) => b.score - a.score);
  const blueTotal = blueTeam.reduce((s, p) => s + p.score, 0);
  const redTotal = redTeam.reduce((s, p) => s + p.score, 0);
  const canSkip = phase === "question" || phase === "countdown" || phase === "answered";
  const canEnd = phase !== "finished" && phase !== "lobby";
  const canPause = (phase === "question" || phase === "countdown" || phase === "answered") && !isPaused;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900 rounded-t-3xl border-t border-black/10 dark:border-white/10 max-h-[78vh] overflow-y-auto"
          >
            <div className="p-4 pb-safe">
              <div className="w-10 h-1.5 bg-black/20 dark:bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm text-gray-500 dark:text-white/70 uppercase tracking-wide">
                  🎛️ {lang === "ar" ? "لوحة تحكم المعلم" : "Teacher Panel"}
                </h3>
                <span className="text-xs font-mono text-gray-400 dark:text-white/30 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-lg">#{pin}</span>
              </div>

              <div className={`rounded-xl p-2.5 mb-3 text-center text-sm font-black border ${
                ropePos < 45 ? "bg-blue-500/20 border-blue-400/30 text-blue-600 dark:text-blue-300"
                : ropePos > 55 ? "bg-red-500/20 border-red-400/30 text-red-600 dark:text-red-300"
                : "bg-black/10 dark:bg-white/10 border-black/10 dark:border-white/10 text-gray-500 dark:text-white/50"
              }`}>
                {ropePos < 42
                  ? (lang === "ar" ? "⬅️ الأزرق يتقدم بقوة!" : "⬅️ Blue is dominating!")
                  : ropePos < 47
                  ? (lang === "ar" ? "⬅️ الأزرق يتقدم قليلاً" : "⬅️ Blue is ahead")
                  : ropePos > 58
                  ? (lang === "ar" ? "➡️ الأحمر يتقدم بقوة!" : "➡️ Red is dominating!")
                  : ropePos > 53
                  ? (lang === "ar" ? "➡️ الأحمر يتقدم قليلاً" : "➡️ Red is ahead")
                  : (lang === "ar" ? "⚖️ تعادل تام" : "⚖️ Perfectly tied")}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-blue-500/15 rounded-xl p-2.5 border border-blue-400/25">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-600 dark:text-blue-300 text-[10px] font-black uppercase">
                      {lang === "ar" ? "أزرق" : "Blue"}
                    </p>
                    <span className="text-amber-600 dark:text-amber-300 font-black text-xs">{blueTotal}</span>
                  </div>
                  {blueTeam.length === 0
                    ? <p className="text-blue-400/30 text-xs text-center">—</p>
                    : blueTeam.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-1 py-0.5 border-b border-black/5 dark:border-white/5 last:border-0">
                        <span className="text-[10px] w-4">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                        <AvatarDisplay avatar={p.avatar} size="sm" />
                        <span className="text-blue-700 dark:text-blue-100 text-[10px] font-bold flex-1 truncate">{p.name}</span>
                        {(p.streak ?? 0) >= 3 && <span className="text-[9px]">🔥{p.streak}</span>}
                        <span className="text-amber-600 dark:text-amber-300 text-[10px] font-black">{p.score}</span>
                      </div>
                    ))
                  }
                </div>
                <div className="bg-red-500/15 rounded-xl p-2.5 border border-red-400/25">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-600 dark:text-red-300 text-[10px] font-black uppercase">
                      {lang === "ar" ? "أحمر" : "Red"}
                    </p>
                    <span className="text-amber-600 dark:text-amber-300 font-black text-xs">{redTotal}</span>
                  </div>
                  {redTeam.length === 0
                    ? <p className="text-red-400/30 text-xs text-center">—</p>
                    : redTeam.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-1 py-0.5 border-b border-black/5 dark:border-white/5 last:border-0">
                        <span className="text-[10px] w-4">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                        <AvatarDisplay avatar={p.avatar} size="sm" />
                        <span className="text-red-700 dark:text-red-100 text-[10px] font-bold flex-1 truncate">{p.name}</span>
                        {(p.streak ?? 0) >= 3 && <span className="text-[9px]">🔥{p.streak}</span>}
                        <span className="text-amber-600 dark:text-amber-300 text-[10px] font-black">{p.score}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="space-y-2">
                {isPaused && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onResume(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-green-500/20 border border-green-400/40 text-green-700 dark:text-green-300 font-black text-sm hover:bg-green-500/30 transition-colors"
                  >
                    ▶️ {lang === "ar" ? "استئناف اللعبة" : "Resume Game"}
                  </motion.button>
                )}
                {canPause && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onPause(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-yellow-500/20 border border-yellow-400/40 text-yellow-700 dark:text-yellow-300 font-black text-sm hover:bg-yellow-500/30 transition-colors"
                  >
                    ⏸️ {lang === "ar" ? "إيقاف مؤقت" : "Pause Game"}
                  </motion.button>
                )}
                {canSkip && !isPaused && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onSkip(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 font-black text-sm hover:bg-amber-500/30 transition-colors"
                  >
                    ⏭ {lang === "ar" ? "تخطي هذا السؤال" : "Skip This Question"}
                  </motion.button>
                )}
                {canEnd && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onEndGame(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-700 dark:text-red-300 font-black text-sm hover:bg-red-500/30 transition-colors"
                  >
                    ⏹ {lang === "ar" ? "إنهاء اللعبة الآن" : "End Game Now"}
                  </motion.button>
                )}
              </div>

              <button onClick={onClose}
                className="w-full mt-3 py-2 text-gray-400 dark:text-white/25 text-sm font-bold hover:text-gray-600 dark:hover:text-white/50 transition-colors"
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function RopeBar({ position, lang = "ar" }: { position: number; lang?: string }) {
  const pos = Math.max(5, Math.min(95, position));
  const inDanger = pos < 20 || pos > 80;
  const dangerTeam: "blue" | "red" = pos < 20 ? "blue" : "red";

  return (
    <div className="relative w-full select-none" style={{ height: 56 }}>
      {inDanger && (
        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 24px ${dangerTeam === "blue" ? "rgba(59,130,246,0.7)" : "rgba(239,68,68,0.7)"}` }}
        />
      )}
      <div className="absolute left-0 right-0 rounded-xl overflow-hidden shadow-inner" style={{ top: 10, height: 32 }}>
        <div className="h-full flex">
          <motion.div animate={{ width: `${100 - pos}%` }} transition={{ type: "spring", stiffness: 80, damping: 12 }}
            className="h-full bg-gradient-to-r from-blue-700 to-blue-500"
          />
          <motion.div animate={{ width: `${pos}%` }} transition={{ type: "spring", stiffness: 80, damping: 12 }}
            className="h-full bg-gradient-to-l from-red-700 to-red-500"
          />
        </div>
      </div>
      <div className="absolute left-0 right-0 pointer-events-none overflow-hidden rounded-xl" style={{ top: 12, height: 28 }}>
        <svg width="100%" height="28" preserveAspectRatio="none">
          {Array.from({ length: 28 }).map((_, i) => (
            <g key={i}>
              <line x1={`${(i / 28) * 100}%`} y1="0" x2={`${(i / 28 + 0.045) * 100}%`} y2="28"
                stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
              <line x1={`${(i / 28 + 0.022) * 100}%`} y1="0" x2={`${(i / 28 - 0.022) * 100}%`} y2="28"
                stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            </g>
          ))}
          <rect x="0" y="0" width="100%" height="5" fill="rgba(255,255,255,0.12)" />
          <rect x="0" y="23" width="100%" height="5" fill="rgba(0,0,0,0.18)" />
        </svg>
      </div>
      <div className="absolute left-1 top-2 w-2.5 h-12 rounded-full bg-blue-400/60 border border-blue-300/40" />
      <div className="absolute right-1 top-2 w-2.5 h-12 rounded-full bg-red-400/60 border border-red-300/40" />
      <div className="absolute z-20 flex flex-col items-center" style={{ left: "calc(50% - 1px)", top: 2, bottom: 2 }}>
        <div className="w-0.5 flex-1 bg-white/60" />
        <div className="w-3 h-3 rounded-sm bg-amber-400 border border-amber-300 shadow-md -my-0.5" />
        <div className="w-0.5 flex-1 bg-white/60" />
      </div>
      <motion.div
        animate={{ left: `${pos}%` }} transition={{ type: "spring", stiffness: 90, damping: 12 }}
        className="absolute -translate-x-1/2 z-30" style={{ left: `${pos}%`, top: 0 }}
      >
        <motion.div
          animate={inDanger ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 0.5 }}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-4"
          style={{ background: "radial-gradient(circle at 35% 35%, #d97706, #92400e)", borderColor: "#78350f" }}
        >
          <span className="text-2xl leading-none">🪢</span>
        </motion.div>
      </motion.div>
      <div className="absolute left-4 bottom-0 text-blue-600 dark:text-blue-300 text-[9px] font-black opacity-70">◀ {lang === "ar" ? "أزرق" : "Blue"}</div>
      <div className="absolute right-4 bottom-0 text-red-600 dark:text-red-300 text-[9px] font-black opacity-70">{lang === "ar" ? "أحمر" : "Red"} ▶</div>
    </div>
  );
}

function TugActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !onClick}
      className="tug-action-button relative mx-auto flex min-h-[42px] w-full max-w-xs items-center justify-center rounded-[1.1rem] px-5 text-base font-black text-white disabled:cursor-default disabled:opacity-80"
      style={{
        background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
        color: "#fff7ed",
        boxShadow: "0 0 10px rgba(247,201,72,0.22), 0 8px 18px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.28)",
        textShadow: "0 2px 10px rgba(90,43,6,0.55)",
      }}
    >
      <span className="absolute inset-1 rounded-[1.1rem] border border-white/18" />
      <span className="relative z-10">⚡ {label}</span>
    </motion.button>
  );
}

/** Compact team status row shown on mobile/tablet (hidden lg+) replacing the large TeamScoreCards */
function MobileTeamStatusRow({
  blueScore,
  redScore,
  blueLabel,
  redLabel,
}: {
  blueScore: number;
  redScore: number;
  blueLabel: string;
  redLabel: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 lg:hidden"
      style={{ direction: "ltr" }}
    >
      {/* Blue score pill — physical left */}
      <div
        className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 flex-1 min-w-0"
        style={{ background: "rgba(29,78,216,0.25)", border: "1px solid rgba(59,130,246,0.4)" }}
      >
        <span className="text-base leading-none">🔵</span>
        <span className="text-white font-black text-base tabular-nums">{blueScore}</span>
        <span className="text-blue-200/60 text-[10px] font-bold truncate hidden sm:inline">{blueLabel}</span>
      </div>
      {/* Center rope icon */}
      <span className="text-2xl shrink-0 leading-none">🪢</span>
      {/* Red score pill — physical right */}
      <div
        className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 flex-1 min-w-0"
        style={{ background: "rgba(220,38,38,0.25)", border: "1px solid rgba(248,113,113,0.4)" }}
      >
        <span className="text-red-200/60 text-[10px] font-bold truncate hidden sm:inline">{redLabel}</span>
        <span className="text-white font-black text-base tabular-nums">{redScore}</span>
        <span className="text-base leading-none">🔴</span>
      </div>
    </div>
  );
}

export default function TugPlay() {
  const { pin } = useParams<{ pin: string }>();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const sp = new URLSearchParams(searchStr);
  const playerName = sp.get("name") || "";
  const playerAvatar = sp.get("avatar") || "🦁";
  const isCreator = sp.get("creator") === "1";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [myTeam, setMyTeam] = useState<"blue" | "red" | null>(null);
  // ref so socket closures always see current myTeam without re-binding
  const myTeamRef = useRef<"blue" | "red" | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [ropePos, setRopePos] = useState(50);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [answerCorrectIndex, setAnswerCorrectIndex] = useState<number | null>(null);
  const [showBoost, setShowBoost] = useState(false);
  const [roundData, setRoundData] = useState<RoundEndData | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEndData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | "GO!" | null>(null);
  const [cheerMsg, setCheerMsg] = useState<string | null>(null);
  const [scorePopup, setScorePopup] = useState<{ value: string; correct: boolean } | null>(null);
  const [powerPullTeam, setPowerPullTeam] = useState<"blue" | "red" | null>(null);
  // Transient reactive nudge for the cartoon scene (lunge/recoil + dust + shake).
  const [sceneImpulse, setSceneImpulse] = useState<TugImpulse | null>(null);
  const [myStreak, setMyStreak] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPowerQ, setIsPowerQ] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [musicStyle, setMusicStyleState] = useState<MusicStyle>(() => {
    try {
      const s = localStorage.getItem("tug-music-style");
      if (s && ["energetic", "electronic", "epic", "chill", "challenge"].includes(s)) return s as MusicStyle;
    } catch (_) {}
    return "challenge";
  });
  const [isMuted, setIsMutedState] = useState(() => {
    try { return localStorage.getItem("tug-music-muted") === "1"; } catch (_) { return false; }
  });
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);
  const soundRef = useRef<TugSoundEngine | null>(null);

  // Keep the ref in sync so socket closures always read current myTeam
  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);

  const getSound = useCallback((): TugSoundEngine => {
    if (!soundRef.current) {
      soundRef.current = new TugSoundEngine();
      setMusicStyleState(soundRef.current.musicStyle);
      setIsMutedState(soundRef.current.muted);
    }
    return soundRef.current;
  }, []);

  const handleMusicStyleChange = useCallback((style: MusicStyle) => {
    const s = getSound();
    s.setMusicStyle(style);
    setMusicStyleState(style);
    if (s.muted) { s.setMuted(false); setIsMutedState(false); }
  }, [getSound]);

  const handleToggleMute = useCallback(() => {
    const s = getSound();
    const next = !s.muted;
    s.setMuted(next);
    setIsMutedState(next);
  }, [getSound]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((duration: number) => {
    stopTimer();
    setTimeLeft(duration);
    setIsUrgent(false);
    beatRef.current = 0;
    getSound().setUrgency(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { stopTimer(); return 0; }
        beatRef.current += 1;
        const remaining = t - 1;
        const urgent = remaining <= 5;
        getSound().setUrgency(urgent);
        setIsUrgent(urgent);
        getSound().playTickTock(beatRef.current, urgent ? "urgent" : "normal");
        return remaining;
      });
    }, 1000);
  }, [stopTimer, getSound]);

  const stopAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
    setAutoAdvanceCountdown(null);
  }, []);

  const startAutoAdvance = useCallback((seconds: number) => {
    stopAutoAdvance();
    setAutoAdvanceCountdown(seconds);
    autoAdvanceRef.current = setInterval(() => {
      setAutoAdvanceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopAutoAdvance]);

  useEffect(() => {
    const socket = getTugSocket();

    const initSession = () => {
      if (isCreator) {
        const creatorToken = sessionStorage.getItem(`tug-creator-${pin}`);
        if (!creatorToken) { setPhase("lobby"); setMyTeam("blue"); return; }
        socket.emit("tug:reclaim-host", { pin, creatorToken },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res: any) => {
            if (res.error) { setError(res.error); return; }
            setPlayers(res.players ?? []);
            if (res.ropePosition !== undefined) setRopePos(res.ropePosition);
            setMyTeam("blue");
            const state = (res.state ?? "lobby") as Phase;
            setPhase(state);
            if (state === "question" && res.activeQuestion) {
              const aq = res.activeQuestion;
              setQuestion(aq);
              setIsPowerQ(!!aq.isPower);
              startTimer(aq.remainingSecs ?? aq.duration);
              getSound().startBackground();
            } else if (state === "round-end" && res.roundSummary) {
              setRoundData({ ...res.roundSummary, players: res.players ?? [] });
              if (res.activeQuestion) {
                setQuestion(res.activeQuestion);
                setIsPowerQ(!!res.activeQuestion.isPower);
              }
            } else if (state === "paused") {
              setIsPaused(true);
              if (res.activeQuestion) {
                setQuestion(res.activeQuestion);
                setIsPowerQ(!!res.activeQuestion.isPower);
              }
            }
          }
        );
      } else {
        socket.emit("tug:rejoin", { pin, name: playerName, avatar: playerAvatar },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rj: any) => {
            if (rj.success && rj.rejoined) {
              setMyTeam(rj.team ?? null);
              setPlayers(rj.players ?? []);
              if (rj.ropePosition !== undefined) setRopePos(rj.ropePosition);
              const state = (rj.state ?? "lobby") as Phase;
              setPhase(state);
              if (state === "question" && rj.activeQuestion) {
                const aq = rj.activeQuestion;
                setQuestion(aq);
                setIsPowerQ(!!aq.isPower);
                if (rj.hasAnswered) { setSelectedAnswer(-1); setPhase("answered"); }
                else startTimer(aq.remainingSecs ?? aq.duration);
                getSound().startBackground();
              } else if (state === "round-end" && rj.roundSummary) {
                setRoundData({ ...rj.roundSummary, players: rj.players ?? [] });
                if (rj.activeQuestion) {
                  setQuestion(rj.activeQuestion);
                  setIsPowerQ(!!rj.activeQuestion.isPower);
                }
              } else if (state === "paused") {
                setIsPaused(true);
                if (rj.activeQuestion) {
                  setQuestion(rj.activeQuestion);
                  setIsPowerQ(!!rj.activeQuestion.isPower);
                }
              }
              return;
            }
            socket.emit("tug:join", { pin, name: playerName, avatar: playerAvatar },
              (res: { success?: boolean; team?: "blue" | "red"; players?: PlayerInfo[]; error?: string; gameState?: string; ropePosition?: number; activeQuestion?: QuestionData & { remainingSecs?: number }; roundSummary?: RoundEndData }) => {
                if (res.error) { setError(res.error); return; }
                setMyTeam(res.team ?? null);
                setPlayers(res.players ?? []);
                if (res.ropePosition !== undefined) setRopePos(res.ropePosition);
                const gs = (res.gameState ?? "lobby") as Phase;
                setPhase(gs);
                if (gs === "question" && res.activeQuestion) {
                  const aq = res.activeQuestion;
                  setQuestion(aq);
                  setIsPowerQ(!!aq.isPower);
                  startTimer(aq.remainingSecs ?? aq.duration);
                  getSound().startBackground();
                } else if (gs === "paused" && res.activeQuestion) {
                  setIsPaused(true);
                  setQuestion(res.activeQuestion);
                  setIsPowerQ(!!res.activeQuestion.isPower);
                } else if (gs === "round-end" && res.roundSummary && res.activeQuestion) {
                  setRoundData({ ...res.roundSummary, players: res.players ?? [] });
                  setQuestion(res.activeQuestion);
                  setIsPowerQ(!!res.activeQuestion.isPower);
                }
              }
            );
          }
        );
      }
    };

    if (socket.connected) initSession();
    socket.on("connect", initSession);
    socket.on("tug:players-updated", (data: { players: PlayerInfo[] }) => setPlayers(data.players));

    socket.on("tug:countdown", (data: { isPower?: boolean; brief?: boolean }) => {
      setSelectedAnswer(null); setAnswerCorrect(null); setAnswerCorrectIndex(null);
      setShowBoost(false); setRoundData(null); setScorePopup(null); setCheerMsg(null);
      setIsPowerQ(!!data.isPower);
      setIsPaused(false);
      if (data.brief) {
        setPhase("countdown");
        setCountdownNum("GO!"); getSound().playGoSignal();
        setTimeout(() => { setCountdownNum(null); }, 600);
      } else {
        setPhase("countdown");
        setCountdownNum(3); getSound().playCountdownBeep(3);
        setTimeout(() => { setCountdownNum(2); getSound().playCountdownBeep(2); }, 1000);
        setTimeout(() => { setCountdownNum(1); getSound().playCountdownBeep(1); }, 2000);
        setTimeout(() => {
          setCountdownNum("GO!");
          if (data.isPower) getSound().playPowerReveal();
          else getSound().playGoSignal();
        }, 3000);
        setTimeout(() => { setCountdownNum(null); }, 3600);
      }
    });

    socket.on("tug:question", (data: QuestionData) => {
      setQuestion(data);
      setIsPowerQ(!!data.isPower);
      setIsPaused(false);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setAnswerCorrectIndex(null);
      setRoundData(null);
      setScorePopup(null);
      setCheerMsg(null);
      setShowBoost(false);
      setPhase("question");
      startTimer(data.duration);
      getSound().startBackground();
      getSound().playTugPull();
    });

    socket.on("tug:rope-update", (data: { ropePosition: number }) => {
      setRopePos((prev) => {
        const diff = Math.abs(data.ropePosition - prev);
        if (diff >= 5) {
          const movingTeam = data.ropePosition < prev ? "blue" : "red";
          setPowerPullTeam(movingTeam);
          setSceneImpulse({ team: movingTeam, kind: "win", id: Date.now() });
          setTimeout(() => setPowerPullTeam(null), 500);
          getSound().playPowerPull();
        }
        return data.ropePosition;
      });
    });

    socket.on("tug:round-end", (data: RoundEndData) => {
      stopTimer();
      setRopePos(data.ropePosition);
      setPlayers(data.players);
      setIsUrgent(false);
      setIsPowerQ(!!data.isPower);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setScorePopup(null);

      if (data.isLast) {
        setRoundData(data);
        setPhase("round-end");
      }
    });

    socket.on("tug:game-end", (data: GameEndData) => {
      stopTimer();
      setGameEnd(data);
      setRopePos(data.ropePosition);
      setPlayers(data.players);
      setPhase("finished");
      setIsUrgent(false);
      setIsPaused(false);
      getSound().stopBackground();
      // Winning team (or teacher/draw) hears triumph; losing team hears defeat
      const team = myTeamRef.current;
      if (data.winner === "draw" || !team || team === data.winner) {
        getSound().playWin();
      } else {
        getSound().playLose();
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("tug:paused", (_data: any) => {
      setIsPaused(true);
      setPhase("paused");
      stopTimer();
      getSound().stopBackground();
    });

    socket.on("tug:resumed", (data: { timeRemaining: number }) => {
      setIsPaused(false);
      setPhase("question");
      startTimer(data.timeRemaining);
      getSound().startBackground();
    });

    socket.on("tug:auto-advance-started", (adv: { autoAdvanceIn: number }) => {
      if (adv.autoAdvanceIn > 0) startAutoAdvance(adv.autoAdvanceIn);
    });

    socket.on("tug:auto-advance-cancelled", () => {
      stopAutoAdvance();
    });

    socket.on("tug:replayed", (data: { players: PlayerInfo[]; ropePosition: number }) => {
      setPlayers(data.players);
      setRopePos(data.ropePosition);
      setPhase("lobby");
      setGameEnd(null);
      setRoundData(null);
      setQuestion(null);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setShowBoost(false);
      setScorePopup(null);
      setCheerMsg(null);
      setMyStreak(0);
      setIsUrgent(false);
      setIsPowerQ(false);
      setIsPaused(false);
      getSound().stopBackground();
    });

    return () => {
      socket.off("connect", initSession);
      socket.off("tug:players-updated");
      socket.off("tug:countdown");
      socket.off("tug:question");
      socket.off("tug:rope-update");
      socket.off("tug:round-end");
      socket.off("tug:game-end");
      socket.off("tug:paused");
      socket.off("tug:resumed");
      socket.off("tug:auto-advance-started");
      socket.off("tug:auto-advance-cancelled");
      socket.off("tug:replayed");
      stopTimer();
      stopAutoAdvance();
    };
  }, [pin, playerName, playerAvatar, isCreator, startTimer, stopTimer, getSound, startAutoAdvance, stopAutoAdvance, lang]);

  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  // ── Danger zone ──
  // When the rope crosses the last stretch (≤20 blue is about to win, ≥80 red
  // is), the threatened team's colour pulses at the screen edges, a heartbeat
  // layer starts, and phones get one short haptic tap. Presentational only.
  // Hysteresis: enter at 20/80 but only exit past 25/75, so a rope hovering on
  // the line can't rapid-fire the vibration + heartbeat on/off.
  const dangerHystRef = useRef<"blue" | "red" | null>(null);
  {
    if (!(phase === "question" || phase === "answered")) dangerHystRef.current = null;
    else if (ropePos <= 20) dangerHystRef.current = "red";
    else if (ropePos >= 80) dangerHystRef.current = "blue";
    else if (ropePos > 25 && ropePos < 75) dangerHystRef.current = null;
  }
  const dangerSide = dangerHystRef.current;

  useEffect(() => {
    if (!dangerSide) return;
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    getSound().playHeartbeat();
    const h = setInterval(() => getSound().playHeartbeat(), 900);
    return () => clearInterval(h);
  }, [dangerSide, getSound]);

  const handleStart = () => {
    if (startingGame) return;
    setStartingGame(true);
    getTugSocket().emit("tug:start", { pin }, (res: { success?: boolean; error?: string }) => {
      setStartingGame(false);
      if (res.error) setError(res.error);
    });
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || phase !== "question") return;
    setSelectedAnswer(idx);
    const selectedText = question?.options[idx];
    getTugSocket().emit("tug:answer", { pin, answerIndex: idx, answerText: selectedText },
      (res: { correct?: boolean; isBoost?: boolean; isPower?: boolean; streak?: number; correctIndex?: number; error?: string }) => {
        if (res.error) {
          // Never hard-fail the whole screen on an answer error. The usual cause
          // is a transient reconnect (new socket.id) where the server hasn't
          // re-attached our record yet. Silently re-join to re-key our socket,
          // re-enable the options, and let the student tap again — no fatal page.
          setSelectedAnswer(null);
          getTugSocket().emit("tug:rejoin", { pin, name: playerName, avatar: playerAvatar }, () => {});
          return;
        }
        const serverCorrectIndex = typeof res.correctIndex === "number" ? res.correctIndex : undefined;
        const serverCorrectText = serverCorrectIndex !== undefined ? question?.options[serverCorrectIndex] : undefined;
        const correct = !!res.correct || (!!selectedText && !!serverCorrectText && selectedText === serverCorrectText);
        // Haptic tap: one short pulse for a hit, a double buzz for a miss.
        if (navigator.vibrate) navigator.vibrate(correct ? 35 : [55, 50, 55]);
        setAnswerCorrect(correct);
        if (serverCorrectIndex !== undefined) setAnswerCorrectIndex(serverCorrectIndex);
        setPhase("answered");

        // Reactive scene nudge: lunge forward on a correct answer, recoil on a
        // wrong one. Purely visual; never alters score or rope state.
        const myTeamNow = myTeamRef.current;
        if (myTeamNow) {
          setSceneImpulse({ team: myTeamNow, kind: correct ? "win" : "lose", id: Date.now() });
          if (correct) {
            setPowerPullTeam(myTeamNow);
            setTimeout(() => setPowerPullTeam((t) => (t === myTeamNow ? null : t)), 500);
          }
        }

        if (correct) {
          if (res.isBoost) {
            getSound().playBoost();
            setShowBoost(true);
            setTimeout(() => setShowBoost(false), 1500);
          } else {
            getSound().playCorrect();
          }
          const newStreak = res.streak ?? (myStreak + 1);
          setMyStreak(newStreak);
        } else {
          getSound().playWrong();
          setMyStreak(0);
        }
      }
    );
  };

  const handleNext = () => {
    stopAutoAdvance();
    getTugSocket().emit("tug:next", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleToggleAutoAdvance = (enabled: boolean) => {
    getTugSocket().emit("tug:toggle-auto-advance", { pin, enabled }, (res: { success?: boolean; autoAdvance?: boolean; error?: string }) => {
      if (res.error) { setError(res.error); return; }
      setRoundData((prev) => prev ? { ...prev, autoAdvance: enabled } : prev);
      if (!enabled) stopAutoAdvance();
    });
  };

  const handleSkip = () => {
    getTugSocket().emit("tug:skip", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleEndGame = () => {
    getTugSocket().emit("tug:end-early", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handlePause = () => {
    getTugSocket().emit("tug:pause", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleResume = () => {
    getTugSocket().emit("tug:resume", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleReplay = () => {
    getTugSocket().emit("tug:replay", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleMovePlayer = (playerName: string, team: "blue" | "red") => {
    getTugSocket().emit("tug:move-player", { pin, playerName, team }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const blueTeam = players.filter((p) => p.team === "blue");
  const redTeam = players.filter((p) => p.team === "red");
  const blueTotal = blueTeam.reduce((sum, player) => sum + player.score, 0);
  const redTotal = redTeam.reduce((sum, player) => sum + player.score, 0);
  const isPulling = phase === "question" || phase === "answered";

  const optionStyle = (idx: number): { className: string; bg: string; border: string; crossed?: boolean } => {
    const baseGrad   = WAMID_GRADIENT[idx] || WAMID_GRADIENT[0];
    const baseBorder = WAMID_BORDER[idx]   || WAMID_BORDER[0];
    const knownCorrect = roundData?.correctIndex ?? answerCorrectIndex;
    if ((phase === "round-end" || phase === "answered") && idx === knownCorrect)
      return { className: "text-white ring-2", bg: "#1a5c30", border: "#D9A521" };
    if (phase === "answered") {
      if (idx === selectedAnswer && !answerCorrect) return { className: "text-white/60", bg: "#5c1212", border: "#7A0A0A", crossed: true };
      if (idx === selectedAnswer) return { className: "text-white", bg: "#1a5c30", border: "#D9A521" };
    }
    if (isPowerQ) return { className: "text-white", bg: baseGrad, border: "#D9A521" };
    return { className: "text-white", bg: baseGrad, border: baseBorder };
  };

  const teamLabel = (t: "blue" | "red") =>
    t === "blue" ? (lang === "ar" ? "الفريق الأزرق" : "Blue Team") : (lang === "ar" ? "الفريق الأحمر" : "Red Team");

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/game/tug/join/${pin}` : "";

  if (error) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-6xl">😕</div>
          <h2 className="text-2xl font-black">{lang === "ar" ? "حدث خطأ" : "An error occurred"}</h2>
          <p className="text-muted-foreground text-center max-w-sm">{error}</p>
          <button onClick={() => setLocation("/game/tug/join")}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold">
            {lang === "ar" ? "ارجع وحاول مجدداً" : "Go back and try again"}
          </button>
        </div>
      </Layout>
    );
  }

  if (phase === "connecting") {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 rounded-full border-4 border-t-transparent"
            style={{ borderColor: "#225739", borderTopColor: "transparent" }} />
          <p className="font-bold" style={{ color: "#225739" }}>{lang === "ar" ? "جاري الاتصال..." : "Connecting..."}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
        <div className="min-h-screen flex flex-col select-none text-gray-900"
        style={{
          direction: dir,
          background: phase === "finished"
            ? "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.28) 0%, transparent 45%), radial-gradient(ellipse at 20% 100%, rgba(59,130,246,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(239,68,68,0.18) 0%, transparent 50%), linear-gradient(160deg, #0d1b3e 0%, #1e1040 50%, #0d1b3e 100%)"
            : "radial-gradient(ellipse at 50% -10%, rgba(251,191,36,0.15) 0%, transparent 55%), radial-gradient(ellipse at 15% 100%, rgba(59,130,246,0.14) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(239,68,68,0.14) 0%, transparent 55%), linear-gradient(160deg, #0d1b3e 0%, #1a1050 50%, #0d1b3e 100%)",
        }}
      >
        {phase === "finished" && gameEnd && gameEnd.winner !== "draw" && <Confetti color={gameEnd.winner === "blue" ? "#3b82f6" : "#ef4444"} />}
        {/* Danger-zone vignette: pulses in the threatened team's colour */}
        {dangerSide && (
          <div
            className="tug-danger-vignette pointer-events-none fixed inset-0 z-40"
            style={{
              boxShadow: dangerSide === "blue"
                ? "inset 0 0 90px 26px rgba(59,130,246,0.55)"
                : "inset 0 0 90px 26px rgba(239,68,68,0.55)",
            }}
          />
        )}
        {countdownNum !== null && <CountdownOverlay count={countdownNum} />}
        {/* Soft directional power flash on a winning pull (keyed so it replays). */}
        {sceneImpulse?.kind === "win" && <PowerPullFlash key={sceneImpulse.id} team={sceneImpulse.team} />}
        <AnimatePresence>
          {showBoost && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-black font-black px-5 py-2 rounded-xl shadow-xl text-base"
            >
              ⚡ {lang === "ar" ? "إجابة سريعة! +بوست" : "Speed Boost! ⚡"}
            </motion.div>
          )}
        </AnimatePresence>

        {isPowerQ && (phase === "question" || phase === "answered" || phase === "countdown") && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: [0.15, 0.3, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ background: "radial-gradient(circle at center, rgba(251,191,36,0.35) 0%, transparent 70%)" }}
          />
        )}

        {isPaused && (
          <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center pointer-events-auto">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
              <div className="text-7xl mb-4">⏸️</div>
              <h2 className="text-3xl font-black text-white mb-2">{lang === "ar" ? "اللعبة متوقفة" : "Game Paused"}</h2>
              <p className="text-slate-300 dark:text-white/50 text-sm mb-4">{lang === "ar" ? "المعلم أوقف اللعبة مؤقتاً" : "Teacher paused the game"}</p>
              {isCreator && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleResume}
                  className="px-8 py-3 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-black text-lg shadow-xl"
                >
                  ▶️ {lang === "ar" ? "استئناف" : "Resume"}
                </motion.button>
              )}
            </motion.div>
          </div>
        )}

        {isCreator && (
          <TeacherPanel
            isOpen={showTeacherPanel} onClose={() => setShowTeacherPanel(false)}
            players={players} ropePos={ropePos} phase={phase} pin={pin ?? ""} lang={lang}
            onSkip={handleSkip} onEndGame={handleEndGame}
            onPause={handlePause} onResume={handleResume} isPaused={isPaused}
          />
        )}

        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 dark:border-white/10 bg-black/20 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <div className="text-xs font-black text-white/60 uppercase tracking-wide">
              {lang === "ar" ? "شد الحبل" : "Tug of War"}
            </div>
            <div className="text-sm font-mono font-black bg-white/20 text-white px-2.5 py-0.5 rounded-lg">#{pin}</div>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => { navigator.clipboard.writeText(joinUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${linkCopied ? "bg-green-500 text-white" : "bg-slate-700/80 dark:bg-white/15 text-slate-200 dark:text-white/70 hover:bg-slate-600/80 dark:hover:bg-white/25"}`}
            >
              {linkCopied ? "✓" : "📋"} {linkCopied ? (lang === "ar" ? "تم!" : "Done!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}
            </motion.button>
          </div>
          <div className="flex items-center gap-2">
            {/* زر الصوت واضح في أعلى اللعبة لكل من المعلم والطالب */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleToggleMute}
              aria-label={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
              title={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
              className={`h-10 rounded-xl flex items-center gap-2 px-3 border shadow-lg transition-all ${
                isMuted
                  ? "bg-red-600 border-red-300 text-white hover:bg-red-500"
                  : "bg-white border-amber-300 text-slate-900 hover:bg-amber-50"
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="hidden sm:inline text-xs font-black whitespace-nowrap">
                {isMuted
                  ? (lang === "ar" ? "مكتوم" : "Muted")
                  : (lang === "ar" ? "الصوت" : "Sound")}
              </span>
            </motion.button>

            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowMusicPicker(!showMusicPicker)}
                aria-label={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
                title={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border shadow-lg transition-all ${
                  isMuted
                    ? "bg-slate-300 border-slate-100 text-slate-500 hover:bg-slate-200"
                    : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
                }`}
              >
                🎵
              </motion.button>
              <AnimatePresence>
                {showMusicPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMusicPicker(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                      className="absolute top-12 end-0 z-50 w-56 bg-slate-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden"
                      style={{ direction: dir }}
                    >
                      <div className="p-1.5 space-y-0.5">
                        {MUSIC_STYLES.map((s) => (
                          <button key={s.id}
                            onClick={() => { handleMusicStyleChange(s.id); setShowMusicPicker(false); }}
                            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                              musicStyle === s.id && !isMuted
                                ? "bg-amber-500/30 border border-amber-400/50 text-white"
                                : "hover:bg-slate-700/50 text-white/80"
                            }`}
                          >
                            <span className="text-base">{s.icon}</span>
                            <div className="text-start">
                              <div className="font-black">{lang === "ar" ? s.ar : s.en}</div>
                              <div className="text-[9px] opacity-60">{lang === "ar" ? s.descAr : s.descEn}</div>
                            </div>
                            {musicStyle === s.id && !isMuted && <span className="ms-auto text-amber-300">✓</span>}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {myTeam && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 font-black px-2.5 py-1 rounded-xl shadow-lg shrink-0"
                style={{
                  background: myTeam === "blue" ? "#1D4ED8" : "#DC2626",
                  color: "#ffffff",
                  border: `2px solid ${myTeam === "blue" ? "#93c5fd" : "#fca5a5"}`,
                }}
              >
                <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />
                <span className="text-[10px] sm:text-xs whitespace-nowrap">
                  {lang === "ar"
                    ? `أنت في ${teamLabel(myTeam)}`
                    : `You're on ${teamLabel(myTeam)}`}
                </span>
                {myStreak >= 3 && <StreakBadge streak={myStreak} />}
              </motion.div>
            )}
            {isCreator && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setShowTeacherPanel(true)}
                className="w-9 h-9 rounded-xl bg-amber-500/30 border-2 border-amber-400/40 text-amber-600 dark:text-amber-300 flex items-center justify-center text-lg"
              >
                🎛️
              </motion.button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col mx-auto w-full">

          <TugArena
            ropePos={ropePos}
            blueScore={blueTotal}
            redScore={redTotal}
            blueCount={blueTeam.length}
            redCount={redTeam.length}
            blueLabel={teamLabel("blue")}
            redLabel={teamLabel("red")}
            lang={lang}
            isPulling={isPulling}
            isUrgent={isUrgent}
            isCelebrating={phase === "finished"}
            winnerSide={gameEnd?.winner === "draw" ? null : gameEnd?.winner ?? null}
            impulse={sceneImpulse}
          >
            {phase === "lobby" && isCreator && (
              <TugActionButton
                label={startingGame ? "..." : (lang === "ar" ? "ابدأ اللعبة!" : "Start Game!")}
                onClick={handleStart}
                disabled={startingGame || players.length < 1}
              />
            )}
            {phase === "lobby" && !isCreator && (
              <div className="text-center">
                <TugActionButton label={lang === "ar" ? "انتظر المعلم" : "Waiting for host"} disabled />
              </div>
            )}
            {/* Only the useful confirmation remains; the redundant "press now"
                call-to-action was removed (timer + options already signal it). */}
            {phase === "answered" && (
              <div className="flex justify-center py-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-bold text-white/55 backdrop-blur-sm">
                  {lang === "ar" ? "✓ تم الإجابة" : "✓ Answered"}
                </span>
              </div>
            )}
          </TugArena>

          {/* Mobile/tablet compact team status row — replaces the large TeamScoreCards hidden below lg */}
          <MobileTeamStatusRow
            blueScore={blueTotal}
            redScore={redTotal}
            blueLabel={teamLabel("blue")}
            redLabel={teamLabel("red")}
          />

          {/* On desktop lg+, keep the slight overlap with the arena (-mt-3).
              On mobile, the status row sits between; no overlap needed. */}
          <div className="flex-1 flex flex-col min-w-0 max-w-4xl mx-auto w-full lg:-mt-3">
            <AnimatePresence mode="wait">

              {phase === "lobby" && (
                <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">

                  {/* Team grids — Red left, Blue right, fixed LTR so position is always consistent */}
                  <div className="grid grid-cols-2 gap-2 mb-3" style={{ direction: "ltr" }}>
                    {/* Red Team — left panel */}
                    <div className="rounded-xl border-2 border-red-500 overflow-hidden" style={{ background: "#ffffff" }}>
                      <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: "#dc2626" }}>
                        <span className="text-white font-black text-xs" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                          🔴 {teamLabel("red")} ({redTeam.length})
                        </span>
                      </div>
                      <div className="p-2 space-y-1 max-h-40 overflow-y-auto" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                        {redTeam.length === 0
                          ? <p className="text-red-400 text-xs text-center py-2">{lang === "ar" ? "انتظار..." : "Waiting..."}</p>
                          : redTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-1 py-1 px-1.5 rounded-lg border border-red-200" style={{ background: "#fef2f2" }}>
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-red-900 font-bold text-[11px] flex-1 truncate">{p.name}</span>
                              {isCreator && (
                                <button onClick={() => handleMovePlayer(p.name, "blue")}
                                  className="text-blue-700 hover:text-blue-900 text-[9px] font-black px-1 py-0.5 rounded transition-colors shrink-0" style={{ background: "#dbeafe" }}>
                                  🔵
                                </button>
                              )}
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                    {/* Blue Team — right panel */}
                    <div className="rounded-xl border-2 border-blue-500 overflow-hidden" style={{ background: "#ffffff" }}>
                      <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: "#1d4ed8" }}>
                        <span className="text-white font-black text-xs" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                          🔵 {teamLabel("blue")} ({blueTeam.length})
                        </span>
                      </div>
                      <div className="p-2 space-y-1 max-h-40 overflow-y-auto" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                        {blueTeam.length === 0
                          ? <p className="text-blue-400 text-xs text-center py-2">{lang === "ar" ? "انتظار..." : "Waiting..."}</p>
                          : blueTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-1 py-1 px-1.5 rounded-lg border border-blue-200" style={{ background: "#eff6ff" }}>
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-blue-900 font-bold text-[11px] flex-1 truncate">{p.name}</span>
                              {isCreator && (
                                <button onClick={() => handleMovePlayer(p.name, "red")}
                                  className="text-red-700 hover:text-red-900 text-[9px] font-black px-1 py-0.5 rounded transition-colors shrink-0" style={{ background: "#fee2e2" }}>
                                  🔴
                                </button>
                              )}
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <p className="text-white/70 text-sm font-bold">{lang === "ar" ? "استعدوا للمنافسة داخل الملعب" : "Get ready for the arena battle"}</p>
                  </div>
                </motion.div>
              )}

              {phase === "countdown" && (
                <motion.div key="countdown" className="px-4 py-4 text-center">
                  {isPowerQ && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black px-4 py-1.5 rounded-2xl shadow-lg text-base mb-2"
                    >
                      ⚡ {lang === "ar" ? "سؤال القوة! نقاط مضاعفة!" : "POWER QUESTION! 2x Points!"}
                    </motion.div>
                  )}
                  <p className="text-slate-400 dark:text-white/30 text-lg font-black">{lang === "ar" ? "استعد للمنافسة..." : "Get ready..."}</p>
                </motion.div>
              )}

              {(phase === "question" || phase === "answered" || phase === "round-end") && question && (
                <motion.div key="question" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-2 lg:px-3 pt-0.5 lg:pt-1 pb-1 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-0.5 lg:mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm lg:text-base font-black px-3 py-1 rounded-xl text-white"
                        style={{
                          background: isPowerQ ? "rgba(217,165,33,0.3)" : "rgba(255,255,255,0.12)",
                          border: `1px solid ${isPowerQ ? "#D9A521" : "rgba(255,255,255,0.2)"}`,
                        }}>
                        {isPowerQ && "⚡ "}
                        {lang === "ar" ? `${question.index + 1} / ${question.total}` : `Q${question.index + 1}/${question.total}`}
                        {isPowerQ && " ×2"}
                      </span>
                      {isCreator && (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowTeacherPanel(true)}
                          className="text-amber-600/60 hover:text-amber-600 dark:text-amber-300/60 dark:hover:text-amber-300 text-lg transition-colors">
                          🎛️
                        </motion.button>
                      )}
                    </div>
                    {phase !== "round-end" && <TimerRing timeLeft={timeLeft} total={question.duration} isUrgent={isUrgent} />}
                    {phase === "round-end" && roundData && (
                      <div className="flex items-center gap-3 text-sm lg:text-base font-black">
                        <span className="text-blue-600 dark:text-blue-300 bg-blue-500/20 px-3 py-1 rounded-lg">{roundData.blueScore.toFixed(0)}</span>
                        <span className="text-slate-400 dark:text-white/30">vs</span>
                        <span className="text-red-600 dark:text-red-300 bg-red-500/20 px-3 py-1 rounded-lg">{roundData.redScore.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  <div className={`mx-auto w-full max-w-3xl rounded-2xl p-3 lg:p-4 mb-1.5 lg:mb-2 text-center border-2 text-white shadow-lg backdrop-blur-sm ${
                    phase === "round-end" && roundData
                      ? "border-[#D9A521]/60"
                      : isPowerQ
                        ? "border-[#D9A521]/70"
                        : "border-white/25"
                  }`} style={{
                    background: phase === "round-end" && roundData
                      ? "rgba(34,87,57,0.55)"
                      : isPowerQ
                        ? "rgba(180,120,10,0.25)"
                        : "rgba(255,255,255,0.08)",
                  }}>
                    {isPowerQ && phase !== "round-end" && (
                      <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1 }}
                        className="text-amber-600 dark:text-amber-300 text-xs lg:text-sm font-black mb-2 flex items-center justify-center gap-1"
                      >
                        ⚡ {lang === "ar" ? "سؤال القوة — نقاط مضاعفة!" : "POWER — 2x!"}
                      </motion.div>
                    )}
                    <p className="text-lg sm:text-xl lg:text-2xl font-black leading-snug">{question.text}</p>
                    {question.imageUrl && (
                      <div className="flex justify-center mt-2">
                        <img src={question.imageUrl} alt="" className="rounded-lg object-contain" style={{ maxHeight: "clamp(80px,16vh,160px)", maxWidth: "80%" }} />
                      </div>
                    )}
                    {phase === "round-end" && roundData && (
                      <p className="text-green-600 dark:text-green-300 text-sm lg:text-base font-bold mt-2">
                        ✅ {question.options[roundData.correctIndex]}
                      </p>
                    )}
                  </div>

                  <div className="relative grid grid-cols-2 gap-2 flex-1">
                    {question.options.map((opt, idx) => {
                      const os = optionStyle(idx);
                      return (
                        <button key={idx}
                          onClick={() => handleAnswer(idx)} disabled={selectedAnswer !== null || phase === "round-end"}
                          className={`relative flex items-center justify-center gap-2 p-2 lg:p-3 rounded-2xl text-center font-bold text-base lg:text-lg border-2 overflow-hidden min-h-[48px] lg:min-h-[62px] shadow-md touch-manipulation select-none transition-colors duration-150 ${os.className}`}
                          style={{ background: os.bg, borderColor: os.border }}
                        >
                          {os.crossed && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                              <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(239,68,68,0.7)" strokeWidth="3" />
                              <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(239,68,68,0.7)" strokeWidth="3" />
                            </svg>
                          )}
                          <span className="leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {phase === "answered" && answerCorrect !== null && (
                    <div className="text-center py-1 px-3 rounded-xl mt-1.5 font-bold text-sm text-white"
                      style={{
                        background: answerCorrect ? "rgba(34,87,57,0.55)" : "rgba(122,28,28,0.55)",
                        border: `1.5px solid ${answerCorrect ? "#D9A521" : "#e05555"}`,
                      }}>
                      {answerCorrect
                        ? (lang === "ar" ? "✅ إجابة صحيحة" : "✅ Correct")
                        : (lang === "ar" ? "❌ إجابة خاطئة" : "❌ Wrong")}
                    </div>
                  )}

                  {phase === "round-end" && isCreator && (
                    <motion.button whileTap={{ scale: 0.96 }} onClick={handleNext}
                      className="w-full mt-1.5 py-2 lg:py-2.5 rounded-2xl font-black text-base shadow-lg text-white"
                      style={{ background: "#D9A521", color: "#1a2e1a" }}
                    >
                      {roundData?.isLast
                        ? (lang === "ar" ? "🏆 النتيجة النهائية!" : "🏆 Final Result!")
                        : (lang === "ar" ? "▶ التالي الآن" : "▶ Next Now")}
                    </motion.button>
                  )}
                </motion.div>
              )}

              {phase === "finished" && gameEnd && (
                <motion.div
                  key="finished"
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="relative px-4 py-3 text-center text-white"
                >
                  <div className="pointer-events-none absolute inset-x-4 -top-2 h-40 rounded-full blur-3xl" style={{ background: "rgba(217,165,33,0.14)" }} />
                  {gameEnd.winner === "draw" ? (
                    <>
                      <div className="relative mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-amber-300/30 bg-white/8 text-4xl shadow-[0_0_24px_rgba(217,165,33,0.18)] backdrop-blur-md">🤝</div>
                      <h2 className="text-3xl lg:text-4xl font-black mb-1.5 text-white">{lang === "ar" ? "تعادل رائع!" : "Great Draw!"}</h2>
                      <p className="font-bold text-sm mb-3" style={{ color: "#D9A521" }}>{lang === "ar" ? "الفريقان متكافئان!" : "Both teams are equal!"}</p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        animate={{ y: [0, -7, 0], scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                        className="relative mx-auto mb-2 flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-[2rem] border border-amber-300/45 bg-white/10 text-7xl shadow-[0_0_42px_rgba(217,165,33,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md"
                      >
                        🏆
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05, duration: 0.3 }}
                        className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] lg:text-xs font-black uppercase tracking-[0.22em]"
                        style={{
                          background: "linear-gradient(90deg, rgba(217,165,33,0.18), rgba(247,201,72,0.3), rgba(217,165,33,0.18))",
                          border: "1px solid rgba(247,201,72,0.5)",
                          color: "#FCE08A",
                        }}
                      >
                        ✦ {lang === "ar" ? "الفريق الفائز" : "Winner"} ✦
                      </motion.div>
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.35 }}
                        className="mb-1 text-4xl lg:text-6xl font-black leading-tight"
                        style={{
                          color: gameEnd.winner === "blue" ? "#bfdbfe" : "#fecaca",
                          textShadow: gameEnd.winner === "blue"
                            ? "0 0 26px rgba(59,130,246,0.6), 0 2px 8px rgba(0,0,0,0.4)"
                            : "0 0 26px rgba(239,68,68,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                        }}
                      >
                        {teamLabel(gameEnd.winner)}
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16, duration: 0.35 }}
                        className="mb-2.5 text-base lg:text-xl font-black"
                        style={{ color: "#F7C948", textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
                      >
                        {lang === "ar" ? "🎉 يفوز بشدّ الحبل!" : "🎉 Wins the tug of war!"}
                      </motion.p>
                      {myTeam === gameEnd.winner && (
                        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                          className="text-amber-300 font-black text-base lg:text-lg mb-2">
                          🎉 {lang === "ar" ? "أنت في الفريق الفائز!" : "You're on the winning team!"}
                        </motion.div>
                      )}
                    </>
                  )}

                  <div className="relative rounded-3xl p-3 lg:p-4 mb-3 text-start max-h-64 overflow-y-auto text-white shadow-xl"
                    style={{ background: "rgba(3,27,18,0.74)", border: "1.5px solid rgba(217,165,33,0.24)", boxShadow: "0 22px 50px rgba(0,0,0,0.28)" }}>
                    <h3 className="text-sm lg:text-base font-black text-amber-200 mb-2">{lang === "ar" ? "🏅 الترتيب النهائي" : "🏅 Final Rankings"}</h3>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div
                        className={`rounded-2xl text-center transition-all ${gameEnd.winner === "blue" ? "p-3 scale-[1.015] border-2 border-amber-300/55" : "p-2.5 scale-[0.97] border border-blue-200/18 opacity-70"}`}
                        style={{
                          background: gameEnd.winner === "blue" ? "linear-gradient(145deg, rgba(29,78,216,0.42), rgba(15,47,122,0.72))" : "rgba(29,78,216,0.14)",
                          boxShadow: gameEnd.winner === "blue" ? "0 18px 38px rgba(217,165,33,0.18), 0 0 22px rgba(59,130,246,0.18)" : "none",
                        }}
                      >
                        <p className="text-blue-100 text-xs lg:text-sm font-black mb-1">{gameEnd.winner === "blue" ? "👑 " : ""}{teamLabel("blue")}</p>
                        <p className={`font-black text-white ${gameEnd.winner === "blue" ? "text-3xl lg:text-5xl" : "text-2xl lg:text-4xl"}`}
                          style={gameEnd.winner === "blue" ? { textShadow: "0 0 20px rgba(247,201,72,0.55)" } : undefined}>
                          {[...gameEnd.players].filter(p => p.team === "blue").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                      <div
                        className={`rounded-2xl text-center transition-all ${gameEnd.winner === "red" ? "p-3 scale-[1.015] border-2 border-amber-300/55" : "p-2.5 scale-[0.97] border border-red-200/18 opacity-70"}`}
                        style={{
                          background: gameEnd.winner === "red" ? "linear-gradient(145deg, rgba(220,38,38,0.42), rgba(127,29,29,0.72))" : "rgba(220,38,38,0.14)",
                          boxShadow: gameEnd.winner === "red" ? "0 18px 38px rgba(217,165,33,0.18), 0 0 22px rgba(248,113,113,0.18)" : "none",
                        }}
                      >
                        <p className="text-red-100 text-xs lg:text-sm font-black mb-1">{gameEnd.winner === "red" ? "👑 " : ""}{teamLabel("red")}</p>
                        <p className={`font-black text-white ${gameEnd.winner === "red" ? "text-3xl lg:text-5xl" : "text-2xl lg:text-4xl"}`}
                          style={gameEnd.winner === "red" ? { textShadow: "0 0 20px rgba(247,201,72,0.55)" } : undefined}>
                          {[...gameEnd.players].filter(p => p.team === "red").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                    </div>
                    {[...gameEnd.players].sort((a, b) => b.score - a.score).map((p, i) => (
                      <motion.div key={p.name}
                        initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5 py-2 px-3 border border-white/10 last:border rounded-xl mb-1.5 last:mb-0 bg-white/6 hover:bg-white/10"
                      >
                        <span className={`w-7 text-center font-black text-base lg:text-lg ${i === 0 ? "text-amber-600" : i === 1 ? "text-slate-600" : i === 2 ? "text-orange-600" : "text-slate-500"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                        <AvatarDisplay avatar={p.avatar} size="3xl" />
                        <span className={`flex-1 font-bold text-sm lg:text-base ${p.team === "blue" ? "text-blue-100" : "text-red-100"}`}>{p.name}</span>
                        <span className={`text-xs lg:text-sm font-bold px-2 py-1 rounded-lg border ${p.team === "blue" ? "bg-blue-500/18 text-blue-100 border-blue-200/20" : "bg-red-500/18 text-red-100 border-red-200/20"}`}>
                          {p.team === "blue" ? (lang === "ar" ? "أزرق" : "Blue") : (lang === "ar" ? "أحمر" : "Red")}
                        </span>
                        <span className="font-black text-amber-300 text-base lg:text-lg">{p.score}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Primary CTA = Play Again / Replay; Home is the quieter secondary action. */}
                  <div className="flex flex-col gap-2.5">
                    <motion.button whileTap={{ scale: 0.97 }}
                      animate={{ scale: [1, 1.015, 1] }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                      onClick={isCreator
                        ? handleReplay
                        : () => setLocation(`/game/tug/join/${pin}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(playerAvatar)}`)}
                      className="w-full py-3.5 rounded-2xl font-black text-base lg:text-lg"
                      style={{
                        background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                        color: "#1a2e1a",
                        boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
                      }}
                    >
                      🔄 {isCreator
                        ? (lang === "ar" ? "أعد اللعبة" : "Replay")
                        : (lang === "ar" ? "العب مجدداً" : "Play Again")}
                    </motion.button>
                    <button onClick={() => setLocation("/")}
                      className="w-full py-2.5 rounded-xl font-bold text-sm transition-colors hover:bg-white/15"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.72)" }}>
                      {lang === "ar" ? "الرئيسية" : "Home"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {(phase === "question" || phase === "answered" || phase === "round-end" || phase === "countdown") && players.length > 0 && (
          <div className="px-3 py-2 mt-auto border-t-2 border-gray-200" style={{ background: "#ffffff" }}>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-black text-blue-700 mb-1">{teamLabel("blue")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {blueTeam.map(p => (
                    <span key={p.name} className="text-xs text-blue-800 px-2 py-0.5 rounded-lg leading-tight font-bold border border-blue-300 flex items-center gap-1" style={{ background: "#dbeafe" }}>
                      <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="flex-1">
                <div className="text-[10px] font-black text-red-700 mb-1 text-end">{teamLabel("red")}</div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {redTeam.map(p => (
                    <span key={p.name} className="text-xs text-red-800 px-2 py-0.5 rounded-lg leading-tight font-bold border border-red-300 flex items-center gap-1" style={{ background: "#fee2e2" }}>
                      <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
