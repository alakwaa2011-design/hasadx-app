import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Trophy,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Crown,
  Medal,
  Award,
  Flame,
  Users,
  Gift,
  Snowflake,
  Sparkles,
  Heart,
  Volume2,
  VolumeX,
  UsersRound,
  Share2,
  Copy,
  Check,
  Pause,
  Bell,
  Music2,
  Loader2,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import RaceTrack from "@/components/race-track";
import {
  playCorrectSound,
  playWrongSound,
  playGiftSound,
  playTickSound,
  playStealSound,
  startBackgroundBeat,
  stopBackgroundBeat,
  playHackDanger,
  playVictoryFanfare,
  playClapSound,
  playFireworkSound,
  playSoloVictory,
  playHackerVictory,
  playHackerAccessGranted,
  playCyberWinTune,
  toggleMute,
  getIsMuted,
  toggleHackMusicMuted,
  getIsHackMusicMuted,
  cleanupAudio,
  playCountdownBeep,
  playCountdownGo,
  playPowerUpEarned,
  playShieldActivate,
  playHackerType,
  playHackSuccess,
  playHackFail,
  playBoxSelect,
  playHackMarathonLoop,
  stopHackMarathonLoop,
  playHackCorrectChime,
  playHackWrongBuzz,
  playHackVictoryFanfare,
  playNotificationSoundByType,
  type NotificationSoundType,
  playMysteryBoxReveal,
  playPowerUpFreeze,
  playPowerUpShield,
  playPowerUpMystery,
  playPowerUpSteal,
} from "@/lib/game-sounds";
import { useI18n } from "@/lib/i18n";
import { AvatarDisplay } from "@/components/avatar-display";
import { SoloChallengeResults } from "@/components/game/solo-challenge-results";
const API_BASE = import.meta.env.VITE_API_URL || "";

const WOOMEEZ_FLASH_STYLES = `
  @keyframes successFlash { 0% { box-shadow: 0 0 10px rgba(0,255,0,0); } 50% { box-shadow: 0 0 50px rgba(0,255,0,0.9); } 100% { box-shadow: 0 0 10px rgba(0,255,0,0); } }
  @keyframes errorFlash { 0% { box-shadow: 0 0 10px rgba(255,0,0,0); } 50% { box-shadow: 0 0 50px rgba(255,0,0,0.9); } 100% { box-shadow: 0 0 10px rgba(255,0,0,0); } }
  .woomeez-correct { animation: successFlash 0.8s ease-out !important; background-color: rgba(0,255,0,0.1) !important; }
  .woomeez-wrong { animation: errorFlash 0.7s ease-out !important; background-color: rgba(255,0,0,0.1) !important; }
`;

class WoomeezFlashEffects {
  isAnimating = false;
  showCorrectAnswer(el: HTMLElement, cb?: () => void) {
    if (this.isAnimating) return;
    this.isAnimating = true;
    el.classList.add("woomeez-correct");
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => {
      el.classList.remove("woomeez-correct");
      this.isAnimating = false;
      if (cb) cb();
    }, 800);
  }
  showWrongAnswer(el: HTMLElement, cb?: () => void) {
    if (this.isAnimating) return;
    this.isAnimating = true;
    el.classList.add("woomeez-wrong");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => {
      el.classList.remove("woomeez-wrong");
      this.isAnimating = false;
      if (cb) cb();
    }, 700);
  }
}
const woomeezEffects = new WoomeezFlashEffects();
// Solo challenge: muted, elegant palette — lower saturation, deeper tones.
// Premium-minimal aesthetic (Quizizz/Duolingo modern). Letter circles in
// the button itself receive a brighter shade of the same hue.
const SOLO_OPTION_COLORS: Array<{
  bgStyle: React.CSSProperties;
  circleStyle: React.CSSProperties;
  arLabel: string;
  enLabel: string;
}> = [
  {
    arLabel: "أ",
    enLabel: "A",
    bgStyle: {
      background: "linear-gradient(135deg, rgba(125,45,58,0.92) 0%, rgba(90,31,42,0.92) 100%)",
      border: "1px solid rgba(220,120,140,0.18)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
    },
    circleStyle: { background: "rgba(255,255,255,0.14)", color: "#FFD4DC" },
  },
  {
    arLabel: "ب",
    enLabel: "B",
    bgStyle: {
      background: "linear-gradient(135deg, rgba(30,58,95,0.92) 0%, rgba(21,38,61,0.92) 100%)",
      border: "1px solid rgba(120,170,230,0.18)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
    },
    circleStyle: { background: "rgba(255,255,255,0.14)", color: "#C8DCFF" },
  },
  {
    arLabel: "ج",
    enLabel: "C",
    bgStyle: {
      background: "linear-gradient(135deg, rgba(139,107,46,0.92) 0%, rgba(107,79,31,0.92) 100%)",
      border: "1px solid rgba(232,184,75,0.22)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
    },
    circleStyle: { background: "rgba(255,255,255,0.14)", color: "#FFE5A8" },
  },
  {
    arLabel: "د",
    enLabel: "D",
    bgStyle: {
      background: "linear-gradient(135deg, rgba(74,49,99,0.92) 0%, rgba(50,33,70,0.92) 100%)",
      border: "1px solid rgba(180,140,220,0.18)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
    },
    circleStyle: { background: "rgba(255,255,255,0.14)", color: "#E4D0FF" },
  },
];

const OPTION_COLORS: Array<{
  bg: string;
  hover: string;
  text: string;
  label: string;
  style: React.CSSProperties;
}> = [
  {
    bg: "",
    hover: "hover:brightness-110",
    text: "text-white",
    label: "A",
    style: {
      background: "linear-gradient(160deg, #7A0A0A, #B01414)",
      boxShadow: "0 6px 24px rgba(176,20,20,0.45)",
    },
  },
  {
    bg: "",
    hover: "hover:brightness-110",
    text: "text-white",
    label: "B",
    style: {
      background: "linear-gradient(160deg, #08386E, #1260A8)",
      boxShadow: "0 6px 24px rgba(18,96,168,0.45)",
    },
  },
  {
    bg: "",
    hover: "hover:brightness-110",
    text: "text-white",
    label: "C",
    style: {
      background: "linear-gradient(160deg, #B8860B, #DAA520)",
      boxShadow: "0 6px 24px rgba(218,165,32,0.45)",
    },
  },
  {
    bg: "",
    hover: "hover:brightness-110",
    text: "text-white",
    label: "D",
    style: {
      background: "linear-gradient(160deg, #5A1A8A, #8B35C8)",
      boxShadow: "0 6px 24px rgba(139,53,200,0.45)",
    },
  },
];

interface Question {
  index: number;
  total: number;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  points: number;
  duration: number;
  questionType?: string;
  imageUrl?: string | null;
}

interface AnswerResult {
  correct: boolean;
  points: number;
  streak: number;
  totalScore: number;
  giftEarned?: boolean;
  frozen?: boolean;
  correctAnswerText?: string | null;
  selectedAnswer?: string | null;
}

interface LeaderboardEntry {
  name: string;
  avatar?: string;
  score: number;
  streak: number;
  lastAnswer?: { correct: boolean; points: number };
}

interface OtherPlayer {
  name: string;
  avatar: string;
  score: number;
}

interface GiftNotification {
  message: string;
  pointsChanged: number;
}

type GiftType = "freeze" | "mystery" | "give" | "shield" | "steal";
type Phase =
  | "connecting"
  | "lobby"
  | "countdown"
  | "question"
  | "answered"
  | "leaderboard"
  | "gift-round"
  | "finished"
  | "error";

const POWER_UP_TYPES: GiftType[] = ["freeze", "shield", "mystery", "steal"];
const POWER_UP_INFO: Record<
  GiftType,
  { icon: string; nameAr: string; descAr: string; color: string }
> = {
  freeze: {
    icon: "🥶",
    nameAr: "تجميد لاعب",
    descAr: "جمّد أي لاعب لسؤال واحد (مرة واحدة)",
    color: "from-blue-600 to-cyan-700",
  },
  shield: {
    icon: "🛡️",
    nameAr: "درع الحماية",
    descAr: "يحميك من التجميد أو سحب النقاط",
    color: "from-yellow-600 to-amber-600",
  },
  mystery: {
    icon: "🎁",
    nameAr: "صندوق المفاجآت",
    descAr: "نقاط إضافية أو مكافأة مفاجئة",
    color: "from-purple-600 to-pink-600",
  },
  give: {
    icon: "💝",
    nameAr: "إهداء نقاط",
    descAr: "أهدِ نقاطك لأحد اللاعبين",
    color: "from-green-600 to-emerald-600",
  },
  steal: {
    icon: "💰",
    nameAr: "سحب النقاط",
    descAr: "اسحب نقاط من لاعب آخر",
    color: "from-orange-600 to-red-600",
  },
};

const ENCOURAGEMENT_MSGS: Record<number, string[]> = {
  2: ["أحسنت! استمر 🔥", "رائع! إجابتان صحيحتان 💪"],
  3: ["ثلاث متتاليات! أنت في قمة نشاطك 🔥🔥", "لا يُصدق! ثلاث صح! ⚡"],
  4: ["أربع إجابات صحيحة! أنت لا يُوقف! 🚀", "أسطوري! أربع متتاليات! 👑"],
  5: ["خمس متتاليات! أنت البطل المطلق! 👑🔥", "لا يُصدق! خمسة صح! ⭐⭐⭐"],
};

function HackRulesTerminal({ lang }: { lang: string }) {
  const lines =
    lang === "ar"
      ? [
          "$ ./hack_init.sh --agent",
          "[OK] الاتصال بالخادم...",
          "[OK] تحميل قواعد الاختراق:",
          " > أجب بسرعة لتحصل على نقاط أكثر",
          " > الإجابة الصحيحة تفتح صندوقاً غامضاً",
          " > 📦 صندوق المفاجأة = سرقة نقاط!",
          " > 🎯 خمن كلمة مرور من 3 خيارات",
          " > 🎁 صندوق فارغ = لا شيء يحدث",
          ' > ✨ "مكافأة" = نقاط إضافية',
          " > ×2 = مضاعفة رصيدك",
          "[!] احذر، ليس كل شيء كما يبدو...",
          "$ awaiting_teacher_signal_",
        ]
      : [
          "$ ./hack_init.sh --agent",
          "[OK] Connecting to server...",
          "[OK] Loading hack rules:",
          "  > Answer fast to score more",
          "  > Correct answers open a mystery box",
          "  > 🔐 Hack box = steal points from a player",
          "  > Guess their password from 3 options",
          "  > 📭 Empty box = nothing happens",
          "  > 🎉 Bonus = extra points",
          "  > ✖2 = double your score",
          "[!] Protect your secret password!",
          "$ awaiting_teacher_signal_",
        ];
  const [shown, setShown] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let lineIdx = 0;
    let charIdx = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (lineIdx >= lines.length) {
        setDone(true);
        return;
      }
      const current = lines[lineIdx];
      if (charIdx <= current.length) {
        setTyping(current.slice(0, charIdx));
        charIdx += 1;
        setTimeout(tick, 18 + Math.random() * 22);
      } else {
        setShown((prev) => [...prev, current]);
        setTyping("");
        lineIdx += 1;
        charIdx = 0;
        setTimeout(tick, 220);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div
      className="bg-black border border-green-700 rounded-xl p-3 mb-4 font-mono text-left shadow-[0_0_25px_rgba(34,197,94,0.15)]"
      dir="ltr"
    >
      <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-green-900">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <span className="text-green-700 text-[10px] ml-2">
          /usr/bin/hasad-hack
        </span>
      </div>
      <div className="text-green-400 text-[11px] leading-5 min-h-[260px] max-h-[260px] overflow-hidden">
        {shown.map((l, i) => (
          <div
            key={i}
            className={
              l.startsWith("[!]")
                ? "text-yellow-300"
                : l.startsWith("[OK]")
                  ? "text-green-300"
                  : l.startsWith("$")
                    ? "text-green-500"
                    : "text-green-400/90"
            }
          >
            {l}
          </div>
        ))}
        {!done && (
          <div
            className={
              typing.startsWith("[!]")
                ? "text-yellow-300"
                : typing.startsWith("[OK]")
                  ? "text-green-300"
                  : typing.startsWith("$")
                    ? "text-green-500"
                    : "text-green-400/90"
            }
          >
            {typing}
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-1.5 h-3 bg-green-400 ml-0.5 align-middle"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MatrixBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-10">
      {Array.from({ length: 14 }).map((_, col) => (
        <motion.div
          key={col}
          initial={{ y: -200 }}
          animate={{ y: "110vh" }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
          className="absolute top-0 text-green-500 font-mono text-xs leading-5 whitespace-nowrap"
          style={{ left: `${(col / 14) * 100}%` }}
        >
          {"01XH4K!@#$NETT0R9V3".split("").map((c, i) => (
            <div key={i}>{c}</div>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

function HackPasswordPickerScreen({
  lang,
  dir,
  myName,
  passwordChoices,
  passwordTakenMsg,
  isLateJoiner,
  onPick,
  onRequestChoices,
}: {
  lang: string;
  dir: string;
  myName: string;
  passwordChoices: string[];
  passwordTakenMsg: boolean;
  isLateJoiner: boolean;
  onPick: (word: string) => void;
  onRequestChoices: () => void;
}) {
  const [waiting, setWaiting] = useState(passwordChoices.length === 0);
  useEffect(() => {
    if (passwordChoices.length > 0) {
      setWaiting(false);
      return;
    }
    setWaiting(true);
    const t = setTimeout(() => onRequestChoices(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordChoices.length]);

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden"
      dir={dir}
    >
      <MatrixBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg w-full relative z-10"
      >
        {isLateJoiner && (
          <motion.div
            animate={{ opacity: [1, 0.55, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="mb-3"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/60 bg-red-950/40 font-mono text-[11px] tracking-[0.3em] text-red-300">
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="w-2 h-2 rounded-full bg-red-500 inline-block"
              />
              {lang === "ar" ? "الاختراق جارٍ" : "HACK IN PROGRESS"}
            </div>
          </motion.div>
        )}

        <motion.div
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-4"
        >
          <div className="text-6xl font-black text-green-400 font-mono tracking-widest">
            [H4CK]
          </div>
        </motion.div>

        <h1 className="text-3xl sm:text-4xl font-black text-green-300 font-mono leading-tight mb-3">
          {lang === "ar"
            ? "اختر كلمة سرّك"
            : "CHOOSE YOUR PASSWORD"}
        </h1>
        <p className="text-green-400/90 text-base sm:text-lg font-mono leading-relaxed mb-6 px-2">
          {lang === "ar"
            ? "كلمة سرك ستحمي نقاطك من الاختراق. اخترها بحكمة!"
            : "Your password protects your score from being hacked. Choose wisely!"}
        </p>

        <div className="bg-green-950/40 border border-green-800 rounded-xl px-4 py-3 mb-5 font-mono inline-block">
          <span className="text-green-600 text-xs">AGENT: </span>
          <span className="text-green-300 font-black text-base">{myName}</span>
        </div>

        {passwordChoices.length > 0 ? (
          <div className="bg-black border-2 border-green-600/80 rounded-2xl p-5 font-mono shadow-[0_0_40px_rgba(34,197,94,0.25)]">
            <p className="text-green-400 text-sm sm:text-base font-bold text-center mb-4 tracking-wider">
              {">"}{" "}
              {lang === "ar"
                ? "اضغط على الكلمة لاختيارها"
                : "TAP A PASSWORD TO CLAIM IT"}
            </p>
            {passwordTakenMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 text-center text-sm font-bold text-red-300 bg-red-950/60 border border-red-700 rounded-lg py-2 px-3"
              >
                ⚠️{" "}
                {lang === "ar"
                  ? "هذه الكلمة محجوزة، اختر أخرى"
                  : "Password taken — pick another"}
              </motion.div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {passwordChoices.map((word) => (
                <motion.button
                  key={word}
                  whileHover={{ scale: 1.03, x: 6 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onPick(word)}
                  className="w-full py-4 sm:py-5 bg-green-950/60 hover:bg-green-800/80 border-2 border-green-700 hover:border-green-300 text-green-100 font-black tracking-[0.2em] rounded-xl transition-all text-lg sm:text-xl text-left px-5"
                >
                  <span className="text-green-500 mr-2">$</span>
                  {word}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-black border border-green-900 rounded-xl p-6 text-center font-mono">
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-green-400 text-base mb-3"
            >
              {">"}{" "}
              {lang === "ar"
                ? "جاري إنشاء كلمات السر..."
                : "GENERATING_PASSWORDS..."}
            </motion.p>
            {waiting && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onRequestChoices}
                className="mt-2 px-4 py-2 bg-green-900/60 border border-green-600 text-green-200 text-sm font-bold rounded-lg hover:bg-green-800/80 transition-all"
              >
                {lang === "ar" ? "إعادة المحاولة" : "RETRY"}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function HackInstructionsScreen({
  lang,
  dir,
  myName,
  myPassword,
  gameTitle,
  players,
  gameMode,
  myTeam,
}: {
  lang: string;
  dir: string;
  myName: string;
  myPassword: string;
  gameTitle: string;
  players: { name: string; score: number; avatar?: string }[];
  gameMode: string;
  myTeam: string | null;
}) {
  const rules =
    lang === "ar"
      ? [
          {
            icon: "⚡",
            title: "أجب بسرعة",
            text: "كلما أجبت أسرع، حصلت على نقاط أكثر.",
          },
          {
            icon: "📦",
            title: "افتح الصناديق",
            text: "كل إجابة صحيحة تفتح صندوقاً غامضاً قد يحوي نقاطاً أو مفاجأة.",
          },
          {
            icon: "🔐",
            title: "اخترق زملاءك",
            text: "اختر صندوق الاختراق، ثم خمّن كلمة سر لاعب آخر لسرقة نقاطه.",
          },
          {
            icon: "🛡️",
            title: "احمِ كلمة سرك",
            text: "كلمة سرك السرية فوقها 👈، لا تشاركها مع أحد!",
          },
        ]
      : [
          {
            icon: "⚡",
            title: "Answer fast",
            text: "Faster answers earn more points.",
          },
          {
            icon: "📦",
            title: "Open mystery boxes",
            text: "Every correct answer unlocks a mystery box — could be points or a twist.",
          },
          {
            icon: "🔐",
            title: "Hack other players",
            text: "Pick the hack box, then guess another player's password to steal their points.",
          },
          {
            icon: "🛡️",
            title: "Protect your password",
            text: "Your secret password is shown above 👆 — never share it!",
          },
        ];

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden"
      dir={dir}
    >
      <MatrixBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-xl w-full relative z-10"
      >
        <motion.div
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mb-3"
        >
          <div className="text-5xl sm:text-6xl font-black text-green-400 font-mono tracking-widest">
            [H4CK]
          </div>
        </motion.div>

        <h1 className="text-2xl sm:text-3xl font-black text-green-300 mb-1 font-mono">
          {gameTitle}
        </h1>
        <p className="text-green-600 text-sm mb-5 font-mono">
          {">"}{" "}
          {lang === "ar"
            ? "كلمة سرك جاهزة. انتظر بدء العملية..."
            : "Password locked. Awaiting mission start..."}
        </p>

        {gameMode === "teams" && myTeam && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-3 px-5 py-2.5 bg-green-950/60 border border-green-700 rounded-xl inline-block"
          >
            <div className="flex items-center justify-center gap-2">
              <UsersRound className="w-5 h-5 text-green-400" />
              <span className="text-green-300 font-black text-base font-mono">
                {myTeam}
              </span>
            </div>
          </motion.div>
        )}

        <div className="bg-gradient-to-b from-green-950/80 to-black border-2 border-green-400 rounded-2xl p-5 mb-5 text-center font-mono shadow-[0_0_50px_rgba(34,197,94,0.3)]">
          <p className="text-green-500 text-xs sm:text-sm mb-2 tracking-widest">
            {">"}{" "}
            {lang === "ar"
              ? "كلمة سرّك السرية"
              : "YOUR SECRET PASSWORD"}
          </p>
          <motion.p
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-green-300 font-black text-3xl sm:text-4xl tracking-[0.3em] leading-tight"
          >
            {myPassword}
          </motion.p>
          <p className="text-green-700 text-xs sm:text-sm mt-2">
            {lang === "ar"
              ? "⚠️ لا تشاركها مع أحد!"
              : "⚠️ Don't share it!"}
          </p>
        </div>

        <div className="bg-black/80 border border-green-700 rounded-2xl p-4 sm:p-5 mb-4 font-mono text-left shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-900">
            <span className="text-green-400 text-base font-black tracking-wider">
              {">"} {lang === "ar" ? "تعليمات اللعبة" : "MISSION_BRIEFING"}
            </span>
          </div>
          <div className="space-y-3">
            {rules.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.12 }}
                className="flex items-start gap-3 bg-green-950/30 border border-green-900 rounded-xl p-3"
              >
                <div className="text-2xl sm:text-3xl shrink-0 leading-none">
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-200 font-black text-base sm:text-lg leading-snug">
                    {r.title}
                  </p>
                  <p className="text-green-400/90 text-sm sm:text-base leading-relaxed mt-0.5">
                    {r.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-green-950/30 border border-green-900 rounded-xl p-3 font-mono">
          <p className="text-green-600 text-xs mb-1.5">
            {">"} CONNECTED AGENTS ({players.length})
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {players.slice(0, 24).map((p, i) => (
              <motion.span
                key={p.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`px-2.5 py-1 rounded-md font-bold text-xs ${p.name === myName ? "bg-green-500/20 text-green-200 border border-green-500" : "bg-green-950/40 text-green-600 border border-green-900"}`}
              >
                {p.name}
              </motion.span>
            ))}
          </div>
        </div>

        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="text-green-500 text-sm font-mono mt-4"
        >
          {">"}{" "}
          {lang === "ar"
            ? "في انتظار إشارة بدء العملية..."
            : "AWAITING MISSION START..."}
        </motion.p>
      </motion.div>
    </div>
  );
}

function ReconnectingBanner({
  show,
  message,
  hint,
  dir,
}: {
  show: boolean;
  message: string;
  hint: string;
  dir: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="reconnecting-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
          dir={dir}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur"
            style={{
              background: "rgba(20, 24, 28, 0.92)",
              border: "1px solid rgba(245, 158, 11, 0.45)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              className="inline-block w-4 h-4 rounded-full border-2 border-amber-300 border-t-transparent"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-amber-200">
                {message}
              </span>
              <span className="text-[11px] text-amber-100/70">{hint}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function GamePlay() {
  const [, params] = useRoute("/game/play/:pin");
  const pin = params?.pin || "";
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const nameParam = searchParams.get("name") || "";
  const avatarParam = searchParams.get("avatar") || "🦁";
  const studentIdParam = searchParams.get("studentId");
  const studentAccountIdParam = searchParams.get("studentAccountId");
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gameTitle, setGameTitle] = useState("");
  const [players, setPlayers] = useState<
    { name: string; score: number; avatar?: string }[]
  >([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const selectedAnswerRef = useRef<string | null>(null);
  const [fillBlankInput, setFillBlankInput] = useState("");
  const [dictationInput, setDictationInput] = useState("");
  const [dictationListenCount, setDictationListenCount] = useState(0);
  const [dictationSpeaking, setDictationSpeaking] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [muted, setMuted] = useState(getIsMuted());
  const [hackMusicMuted, setHackMusicMuted] = useState(getIsHackMusicMuted());
  const [notifSound, setNotifSound] = useState<NotificationSoundType>(
    () =>
      (localStorage.getItem("notifSound") as NotificationSoundType | null) ??
      "ping",
  );
  const [showSoundPicker, setShowSoundPicker] = useState(false);

  const [giftStep, setGiftStep] = useState<
    "choose" | "selectStealAmount" | "selectPlayer"
  >("choose");
  const [chosenGiftType, setChosenGiftType] = useState<GiftType | null>(null);
  const [stealAmount, setStealAmount] = useState<number>(30);
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);
  const [giftResult, setGiftResult] = useState<string | null>(null);
  const [giftNotification, setGiftNotification] =
    useState<GiftNotification | null>(null);

  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<any>(null);
  const [encouragementMsg, setEncouragementMsg] = useState<string | null>(null);
  const [shieldNotification, setShieldNotification] = useState<string | null>(
    null,
  );

  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<"solo" | "teams">("solo");
  const [teamLeaderboard, setTeamLeaderboard] = useState<
    {
      teamName: string;
      totalScore: number;
      playerTotal: number;
      adjustment: number;
      members: number;
    }[]
  >([]);
  const [isDoublePoints, setIsDoublePoints] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [giftsEnabled, setGiftsEnabled] = useState(true);
  const [giftsNotification, setGiftsNotification] = useState<string | null>(
    null,
  );
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenNotification, setFrozenNotification] = useState<string | null>(
    null,
  );
  const [hasShield, setHasShield] = useState(false);
  const [freezeUsed, setFreezeUsed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameTtsEnabled, setGameTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [giftRoundTimeLeft, setGiftRoundTimeLeft] = useState(0);
  const [giftRoundChosen, setGiftRoundChosen] = useState(false);
  const [usedGiftTypes, setUsedGiftTypes] = useState<Set<string>>(new Set());
  const giftRoundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hackMode, setHackMode] = useState(false);
  const [hackDeadline, setHackDeadline] = useState<number | null>(null);
  const [hackRemainingMs, setHackRemainingMs] = useState<number | null>(null);
  const [hackPersonalAnswered, setHackPersonalAnswered] = useState(0);
  const [hackTotalUnique, setHackTotalUnique] = useState(0);
  const [hackCycle, setHackCycle] = useState(0);
  const hackCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [passwordChoices, setPasswordChoices] = useState<string[]>([]);
  const [myPassword, setMyPassword] = useState<string | null>(null);
  const [passwordTakenMsg, setPasswordTakenMsg] = useState(false);
  const [showMysteryBoxes, setShowMysteryBoxes] = useState(false);
  const [openedBoxIndex, setOpenedBoxIndex] = useState<number | null>(null);
  const [boxResult, setBoxResult] = useState<{
    type: string;
    amount?: number;
    newScore?: number;
  } | null>(null);
  const [hackStep, setHackStep] = useState<
    "targets" | "passwords" | "result" | null
  >(null);
  const [hackTargets, setHackTargets] = useState<
    { name: string; avatar: string }[]
  >([]);
  const [hackPasswordData, setHackPasswordData] = useState<{
    targetName: string;
    choices: string[];
  } | null>(null);
  const [hackResult, setHackResult] = useState<{
    success: boolean;
    stolenAmount?: number;
    targetName?: string;
    newScore?: number;
  } | null>(null);
  const [hackPickError, setHackPickError] = useState<string | null>(null);
  const [hackNotification, setHackNotification] = useState<{
    fromPlayer: string;
    fromAvatar: string;
    stolenAmount: number;
  } | null>(null);
  const hackNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hackWaitingForNext, setHackWaitingForNext] = useState(false);
  const [hackNextCountdown, setHackNextCountdown] = useState(4);
  const hackNextCountdownRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [teacherMessage, setTeacherMessage] = useState<string | null>(null);
  const teacherMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedRef = useRef(false);
  const hasJoinedOnceRef = useRef(false);
  const tickPlayedRef = useRef(false);
  const pendingQuestionRef = useRef<any>(null);
  // Echoed back on student:submit-answer so the server can reject stale submits
  // (cause of "correct visual choice marked wrong" race in hack mode).
  const hackQuestionInstanceRef = useRef<number | null>(null);
  const myPasswordRef = useRef<string | null>(null);
  const hackWrongAnswerRef = useRef(false);
  const hackModeRef = useRef(false);
  const hackStepRef = useRef<string | null>(null);

  /* ── Solo challenge mode ──────────────────────────────────────────
     When the player came in via /solo/:slug, sessionStorage carries
     the solo flag. We capture it ONCE at mount via a ref so all socket
     handlers and render branches can short-circuit competitive UI
     (countdown, race track, gift round, mystery boxes, intermediate
     leaderboard, "wait for teacher", "all players", PIN share, etc.)
     without touching live/multiplayer/classroom flows.
     `solo-challenge-results.tsx` clears the sessionStorage key on
     mount, but the ref keeps the value stable for this game session. */
  const isSoloRef = useRef(
    typeof window !== "undefined" &&
      !!sessionStorage.getItem("solo_challenge_slug"),
  );
  const soloTotalQuestionsRef = useRef<number>(0);
  const [soloCorrectCount, setSoloCorrectCount] = useState(0);

  useEffect(() => {
    myPasswordRef.current = myPassword;
  }, [myPassword]);
  useEffect(() => {
    hackModeRef.current = hackMode;
  }, [hackMode]);
  useEffect(() => {
    hackStepRef.current = hackStep;
  }, [hackStep]);

  const myName = nameParam;
  const myRank = leaderboard.findIndex((e) => e.name === myName) + 1;

  const handleToggleHackMusic = useCallback(() => {
    const newMuted = toggleHackMusicMuted();
    setHackMusicMuted(newMuted);
    if (newMuted) {
      stopHackMarathonLoop();
    } else if (hackModeRef.current && !getIsMuted()) {
      playHackMarathonLoop();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const newMuted = toggleMute();
    setMuted(newMuted);
    // Hack mode never plays the continuous background beat — only the
    // danger alarm in the final 30s of the marathon timer.
    if (!newMuted && !hackModeRef.current) startBackgroundBeat();
    else {
      stopBackgroundBeat();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text: string, isAr: boolean) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isAr ? "ar-SA" : "en-US";
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();

    const doJoin = () => {
      socket.emit(
        "student:join-game",
        {
          pin,
          name: myName,
          avatar: avatarParam,
          studentId: studentIdParam ? parseInt(studentIdParam) : undefined,
          studentAccountId: studentAccountIdParam
            ? parseInt(studentAccountIdParam)
            : undefined,
        },
        (res: any) => {
          if (res.error) {
            const isMissingGameError =
              res.error === "كود اللعبة غير صحيح" ||
              res.error === "اللعبة انتهت بالفعل";
            const friendlyError =
              hasJoinedOnceRef.current && isMissingGameError
                ? t.gamePlay.gameEndedByTeacher
                : res.error;
            setError(friendlyError);
            setPhase("error");
            setIsReconnecting(false);
            return;
          }
          hasJoinedOnceRef.current = true;
          setIsReconnecting(false);
          setGameTitle(res.title);
          setPlayers(res.players);
          if (res.gameMode) setGameMode(res.gameMode);
          if (res.myTeam) setMyTeam(res.myTeam);
          if (res.myScore !== undefined) setMyScore(res.myScore);
          if (res.myStreak !== undefined) setMyStreak(res.myStreak);
          if (res.hackMode) setHackMode(true);
          if (res.myPassword) setMyPassword(res.myPassword);
          if (res.hackMarathon) {
            if (typeof res.hackMarathon.deadline === "number")
              setHackDeadline(res.hackMarathon.deadline);
            if (typeof res.hackMarathon.totalUnique === "number")
              setHackTotalUnique(res.hackMarathon.totalUnique);
          }

          if (res.gameState === "question" && res.currentQuestion) {
            const q = res.currentQuestion;
            setQuestion(q);
            setPhase("question");
            const startTime = q.timeRemaining ?? q.duration;
            setTimeLeft(startTime);
            setAnswerResult(null);
            setCorrectAnswer(null);
            setSelectedAnswer(null);
            selectedAnswerRef.current = null;
            setFillBlankInput("");
            setDictationInput("");
            setDictationListenCount(0);
            setDictationSpeaking(false);
            window.speechSynthesis?.cancel();
            setShowConfetti(false);
            tickPlayedRef.current = false;
            setIsDoublePoints(!!q.isDoublePoints);
            const frozenOnJoin = !!q.frozen;
            setIsFrozen(frozenOnJoin);
            if (q.pointsEnabled !== undefined)
              setPointsEnabled(q.pointsEnabled);
            if (q.giftsEnabled !== undefined) setGiftsEnabled(q.giftsEnabled);
            if (frozenOnJoin) {
              socket.emit("student:submit-answer", { pin, answer: "" });
            }
            if (!res.hackMode) startBackgroundBeat();
            else playHackMarathonLoop();
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              setTimeLeft((prev: number) => {
                if (prev <= 0.1) {
                  clearInterval(timerRef.current!);
                  return 0;
                }
                return prev - 0.1;
              });
            }, 100);
          } else if (res.gameState === "gift-round") {
            setPhase("gift-round");
            setGiftRoundChosen(false);
            setGiftStep("choose");
            setChosenGiftType(null);
          } else if (res.gameState === "leaderboard") {
            setPhase("lobby");
          } else {
            setPhase("lobby");
          }
        },
      );
    };

    doJoin();

    socket.on("connect", doJoin);

    const handleDisconnect = (reason: string) => {
      if (!hasJoinedOnceRef.current) return;
      if (reason === "io client disconnect") return;
      setIsReconnecting(true);
    };

    const handleReconnect = () => {
      setIsReconnecting(true);
    };

    socket.on("disconnect", handleDisconnect);
    socket.io.on("reconnect_attempt", handleReconnect);

    socket.on("game:players-updated", (data: any) => {
      setPlayers(data.players);
      if (data.gameMode) setGameMode(data.gameMode);
      if (data.players && myName) {
        const me = data.players.find((p: any) => p.name === myName);
        if (me?.teamName) setMyTeam(me.teamName);
      }
    });

    socket.on("game:question", (q: any) => {
      // Solo challenge: track total/correct for the simplified results card.
      if (isSoloRef.current && typeof q?.total === "number") {
        soloTotalQuestionsRef.current = q.total;
      }
      setAnswerResult(null);
      setCorrectAnswer(null);
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setFillBlankInput("");
      setDictationInput("");
      setDictationListenCount(0);
      setDictationSpeaking(false);
      window.speechSynthesis?.cancel();
      setShowConfetti(false);
      tickPlayedRef.current = false;
      setIsDoublePoints(!!q.isDoublePoints);
      if (q.pointsEnabled !== undefined) setPointsEnabled(q.pointsEnabled);
      if (q.giftsEnabled !== undefined) setGiftsEnabled(q.giftsEnabled);
      if (q.gameTtsEnabled !== undefined) setGameTtsEnabled(!!q.gameTtsEnabled);
      if (q.hasShield !== undefined) setHasShield(!!q.hasShield);
      if (q.freezeUsed !== undefined) setFreezeUsed(!!q.freezeUsed);
      if (timerRef.current) clearInterval(timerRef.current);
      setEncouragementMsg(null);
      stopSpeech();
      pendingQuestionRef.current = q;
      setPendingQuestion(q);
      if (isSoloRef.current) {
        // Solo: no per-question countdown — jump straight to the question.
        // The countdown effect handles setCountdownVal(0) → setPhase("question").
        setCountdownVal(0);
      } else {
        setPhase("countdown");
        setCountdownVal(3);
      }
    });

    socket.on("game:hack-marathon-ended", () => {
      if (hackCountdownRef.current) clearInterval(hackCountdownRef.current);
      setHackRemainingMs(0);
    });

    socket.on("game:hack-marathon-started", (data: any) => {
      setHackMode(true);
      if (typeof data?.hackDeadline === "number")
        setHackDeadline(data.hackDeadline);
      if (typeof data?.totalUnique === "number")
        setHackTotalUnique(data.totalUnique);
      setHackPersonalAnswered(0);
      setHackCycle(0);
    });

    socket.on("game:player-question", (q: any) => {
      setHackWaitingForNext(false);
      setHackNextCountdown(4);
      if (hackNextCountdownRef.current) {
        clearInterval(hackNextCountdownRef.current);
        hackNextCountdownRef.current = null;
      }
      hackWrongAnswerRef.current = false;
      setAnswerResult(null);
      setCorrectAnswer(null);
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setFillBlankInput("");
      setDictationInput("");
      setDictationListenCount(0);
      setDictationSpeaking(false);
      setShowConfetti(false);
      tickPlayedRef.current = false;
      setIsDoublePoints(false);
      // For hack boxes: clear overlay immediately (the 3s safety timer already
      // handles the result screen, and the next question should show right away).
      // For regular mystery boxes (bonus/double/nothing): let boxDismissRef handle
      // the 1-second delay so the student can read their reward — don't clear now.
      if (hackStepRef.current) {
        setShowMysteryBoxes(false);
        setBoxResult(null);
        setHackStep(null);
        setHackResult(null);
        setOpenedBoxIndex(null);
      }
      if (q.pointsEnabled !== undefined) setPointsEnabled(q.pointsEnabled);
      if (q.giftsEnabled !== undefined) setGiftsEnabled(q.giftsEnabled);
      if (q.gameTtsEnabled !== undefined) setGameTtsEnabled(!!q.gameTtsEnabled);
      if (typeof q.personalAnswered === "number")
        setHackPersonalAnswered(q.personalAnswered);
      if (typeof q.cycle === "number") setHackCycle(q.cycle);
      if (typeof q.totalUnique === "number") setHackTotalUnique(q.totalUnique);
      if (typeof q.hackDeadline === "number") setHackDeadline(q.hackDeadline);
      if (typeof q.hackRemainingMs === "number")
        setHackRemainingMs(q.hackRemainingMs);
      hackQuestionInstanceRef.current =
        typeof q.questionInstanceId === "number" ? q.questionInstanceId : null;
      if (timerRef.current) clearInterval(timerRef.current);
      setEncouragementMsg(null);
      stopSpeech();
      pendingQuestionRef.current = q;
      setPendingQuestion(q);
      // Hack mode: no per-question countdown — go straight to the question.
      // The overall marathon timer is the only timer that runs.
      setCountdownVal(0);
    });

    socket.on("game:tts-toggled", (data: any) => {
      setGameTtsEnabled(!!data.enabled);
    });

    socket.on(
      "game:answer-result",
      (result: AnswerResult & { correctAnswer?: string }) => {
        stopSpeech();
        setAnswerResult(result);
        setMyScore(result.totalScore);
        setMyStreak(result.streak);
        if (result.correctAnswer) setCorrectAnswer(result.correctAnswer);
        // Keep the question screen visible briefly so the player sees the
        // green/red feedback animations on the option buttons before the
        // results screen takes over. Hack mode renders both screens together,
        // so it doesn't need the delay.
        if (hackModeRef.current) {
          setPhase("answered");
        } else if (isSoloRef.current) {
          // Solo: STAY on "question" phase — feedback (✅/❌ button colours +
          // inline banner) is rendered directly on the question screen.
          // No intermediate full-screen "answered" card at all.
          // Transition happens only when the server sends game:question next.
        } else {
          setTimeout(() => {
            // Only switch if we're still on the question screen — the server
            // may have already pushed the next question/countdown.
            setPhase((prev) => (prev === "question" ? "answered" : prev));
          }, 1400);
        }
        if (result.correct) {
          if (isSoloRef.current) setSoloCorrectCount((n) => n + 1);
          if (hackModeRef.current) {
            playHackCorrectChime();
            playHackMarathonLoop();
          } else {
            playCorrectSound();
          }
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2000);
          const streak = result.streak;
          const msgs =
            streak >= 5
              ? ENCOURAGEMENT_MSGS[5]
              : ENCOURAGEMENT_MSGS[streak] || null;
          if (msgs) {
            const msg = msgs[Math.floor(Math.random() * msgs.length)];
            setEncouragementMsg(msg);
            setTimeout(() => setEncouragementMsg(null), 2800);
          }
        } else {
          if (hackModeRef.current) {
            playHackWrongBuzz();
            playHackMarathonLoop();
          } else {
            playWrongSound();
          }
          hackWrongAnswerRef.current = hackModeRef.current;
        }
      },
    );

    socket.on(
      "game:gift-result",
      (result: { success: boolean; message: string }) => {
        if (result.message) setGiftResult(result.message);
      },
    );

    socket.on("game:shield-blocked", (data: { message: string }) => {
      playShieldActivate();
      setHasShield(false);
      setShieldNotification(data.message);
      setTimeout(() => setShieldNotification(null), 3500);
    });

    socket.on("game:gift-notification", (data: GiftNotification) => {
      playStealSound();
      setGiftNotification(data);
      setTimeout(() => setGiftNotification(null), 3000);
      if (data.pointsChanged) setMyScore((prev) => prev + data.pointsChanged);
    });

    socket.on("game:frozen", (data: { message: string }) => {
      playStealSound();
      setFrozenNotification(data.message);
      setTimeout(() => setFrozenNotification(null), 4000);
    });

    socket.on("game:points-toggled", (data: { enabled: boolean }) => {
      setPointsEnabled(data.enabled);
    });

    socket.on("game:gifts-toggled", (data: { enabled: boolean }) => {
      setGiftsEnabled(data.enabled);
      const msg = data.enabled
        ? (t.teacherGame.giftsEnabledNotice ?? "🎁 الهدايا مفعّلة!")
        : (t.teacherGame.giftsDisabledNotice ?? "🚫 الهدايا موقوفة");
      setGiftsNotification(msg);
      setTimeout(() => setGiftsNotification(null), 4000);
    });

    socket.on("game:scores-updated", (data: any) => {
      setLeaderboard(data.leaderboard);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      const me = data.leaderboard.find((e: any) => e.name === myName);
      if (me) setMyScore(me.score);
    });

    socket.on("game:question-ended", (data: any) => {
      stopSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
      setLeaderboard(data.leaderboard);
      setCorrectAnswer(data.correctAnswer);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      if (data.gameMode) setGameMode(data.gameMode);
      const me = data.leaderboard?.find((e: any) => e.name === myName);
      if (me) setMyScore(me.score);
      // Solo: if the player didn't answer before time ran out, treat it as a
      // wrong answer — play the wrong sound and reveal the correct option so
      // the player learns from the miss.
      if (isSoloRef.current && !selectedAnswerRef.current) {
        playWrongSound();
        setAnswerResult({
          correct: false,
          points: 0,
          streak: 0,
          totalScore: 0,
          correctAnswerText: data.correctAnswerText ?? null,
        });
      }
      // Solo: stay in "answered" phase (✅/❌ feedback visible) instead of
      // jumping to the intermediate leaderboard/spinner while the server
      // prepares the next question. Transition happens when game:question
      // arrives — exactly like Duolingo / Kahoot Challenge mode.
      if (!isSoloRef.current) {
        setPhase("leaderboard");
      }
      stopBackgroundBeat();
    });

    socket.on("game:finished", (data: any) => {
      stopSpeech();
      if (timerRef.current) clearInterval(timerRef.current);
      setLeaderboard(data.leaderboard);
      setPhase("finished");
      stopBackgroundBeat();
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      if (data.gameMode) setGameMode(data.gameMode);
      const me = data.leaderboard?.find((e: any) => e.name === myName);
      if (me) setMyScore(me.score);
      // Solo: play a brief gentle chime instead of the full victory cascade.
      if (isSoloRef.current) { playSoloVictory(); return; }
      if (hackModeRef.current) {
        stopHackMarathonLoop();
        // Energetic Blooket-style victory cascade.
        playHackerVictory();
      } else {
        playVictoryFanfare();
        setTimeout(() => playClapSound(), 500);
        setTimeout(() => playFireworkSound(), 1000);
      }
    });

    socket.on("game:teacher-disconnected", () => {
      setError(t.gamePlay.teacherLeft);
      setPhase("error");
      stopBackgroundBeat();
    });

    socket.on("game:kicked", (data: any) => {
      setError(data?.message || t.gamePlay.teacherLeft);
      setPhase("error");
      stopBackgroundBeat();
    });

    socket.on("game:paused", () => {
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("game:resumed", () => {
      setIsPaused(false);
    });

    socket.on("game:teacher-message", (data: { message: string }) => {
      if (teacherMsgTimerRef.current) clearTimeout(teacherMsgTimerRef.current);
      setTeacherMessage(data.message);
      playNotificationSoundByType(
        (localStorage.getItem("notifSound") as NotificationSoundType | null) ??
          "ping",
      );
      teacherMsgTimerRef.current = setTimeout(
        () => setTeacherMessage(null),
        8000,
      );
    });

    socket.on(
      "game:gift-round",
      (data: {
        players?: OtherPlayer[];
        duration: number;
        usedGiftTypes?: string[];
      }) => {
        // Solo: no surprise/gift round between questions.
        if (isSoloRef.current) return;
        if (data.players) setOtherPlayers(data.players);
        if (data.usedGiftTypes) setUsedGiftTypes(new Set(data.usedGiftTypes));
        setGiftRoundChosen(false);
        setGiftResult(null);
        setChosenGiftType(null);
        setGiftStep("choose");
        setGiftRoundTimeLeft(Math.ceil(data.duration));
        setPhase("gift-round");
        playPowerUpEarned();
        if (giftRoundTimerRef.current) clearInterval(giftRoundTimerRef.current);
        giftRoundTimerRef.current = setInterval(() => {
          setGiftRoundTimeLeft((prev) => {
            if (prev <= 1) {
              if (giftRoundTimerRef.current)
                clearInterval(giftRoundTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      },
    );

    socket.on("game:gift-round-ended", (data: any) => {
      if (giftRoundTimerRef.current) clearInterval(giftRoundTimerRef.current);
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        const me = data.leaderboard.find((e: any) => e.name === myName);
        if (me) setMyScore(me.score);
      }
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
    });

    socket.on("game:replay", (data: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (giftRoundTimerRef.current) clearInterval(giftRoundTimerRef.current);
      setPlayers(data.players || []);
      if (data.gameMode) setGameMode(data.gameMode);
      setMyScore(0);
      setLeaderboard([]);
      setTeamLeaderboard([]);
      setQuestion(null);
      setAnswerResult(null);
      setCorrectAnswer(null);
      setSelectedAnswer(null);
      selectedAnswerRef.current = null;
      setFillBlankInput("");
      setShowConfetti(false);
      setTimeLeft(0);
      setIsDoublePoints(false);
      setIsFrozen(false);
      setHasShield(false);
      setGiftRoundChosen(false);
      setChosenGiftType(null);
      setGiftStep("choose");
      setMyPassword(null);
      setPasswordChoices([]);
      setShowMysteryBoxes(false);
      setOpenedBoxIndex(null);
      setBoxResult(null);
      setHackStep(null);
      setHackResult(null);
      setHackPasswordData(null);
      setHackTargets([]);
      if (hackNotifTimerRef.current) clearTimeout(hackNotifTimerRef.current);
      setHackNotification(null);
      stopBackgroundBeat();
      setPhase("lobby");
    });

    socket.on("game:hack-mode-toggled", (data: any) => {
      setHackMode(!!data.enabled);
    });

    socket.on("game:password-choices", (data: any) => {
      if (myPasswordRef.current) return;
      setPasswordChoices(data.choices ?? []);
      if (data.taken) {
        setPasswordTakenMsg(true);
        setTimeout(() => setPasswordTakenMsg(false), 2500);
      }
    });

    socket.on("game:password-set", (data: any) => {
      setMyPassword(data.word);
      setPasswordChoices([]);
    });

    socket.on("game:mystery-boxes", () => {
      // Solo: no surprise/bonus mystery boxes.
      if (isSoloRef.current) return;
      playMysteryBoxReveal();
      setShowMysteryBoxes(true);
      setOpenedBoxIndex(null);
      setBoxResult(null);
      setHackStep(null);
      setHackResult(null);
      setHackPasswordData(null);
    });

    socket.on("game:mystery-boxes-clear", () => {
      setShowMysteryBoxes(false);
      setOpenedBoxIndex(null);
      setBoxResult(null);
      setHackStep(null);
      setHackResult(null);
      setHackPasswordData(null);
    });

    socket.on("game:box-opened", (data: any) => {
      setOpenedBoxIndex(data.boxIndex ?? 0);
      const box = data.box ?? {};
      setBoxResult({
        type: box.type,
        amount: box.amount,
        newScore: data.newScore,
      });
      if (data.newScore !== undefined) setMyScore(data.newScore);
      // Ensure the overlay is visible even if game:mystery-boxes was missed
      setShowMysteryBoxes(true);
    });

    socket.on("game:hack-targets", (data: any) => {
      const targets = data.targets ?? [];
      setTimeout(() => {
        if (targets.length > 0) {
          // Ensure overlay is open even if game:mystery-boxes was missed earlier
          setShowMysteryBoxes(true);
          setHackStep("targets");
          setHackTargets(targets);
          playHackerType();
        } else {
          setTimeout(() => setShowMysteryBoxes(false), 1000);
        }
      }, 1200);
    });

    socket.on("game:hack-password-choices", (data: any) => {
      if (data.error || !Array.isArray(data.choices)) {
        setHackStep("targets");
        setHackPickError(
          lang === "ar"
            ? "هذا اللاعب لم يختر كلمة سر بعد!"
            : "This player has no password yet!",
        );
        setTimeout(() => setHackPickError(null), 3000);
        return;
      }
      setHackStep("passwords");
      setHackPasswordData({
        targetName: data.targetName,
        choices: data.choices,
      });
      playHackerType();
    });

    socket.on("game:hack-result", (data: any) => {
      setHackStep("result");
      setHackResult({
        success: data.success,
        stolenAmount: data.stolenAmount,
        targetName: data.targetName,
      });
      if (data.newScore !== undefined) setMyScore(data.newScore);
      if (data.success) playHackSuccess();
      else playHackFail();
      // Safety: always close the overlay after 3s regardless of boxDismissRef
      setTimeout(() => {
        setShowMysteryBoxes(false);
        setBoxResult(null);
        setHackStep(null);
        setHackResult(null);
        setOpenedBoxIndex(null);
      }, 3000);
    });

    socket.on("game:hack-notification", (data: any) => {
      setHackNotification({
        fromPlayer: data.fromPlayer,
        fromAvatar: data.fromAvatar ?? "💀",
        stolenAmount: data.stolenAmount,
      });
      if (hackNotifTimerRef.current) clearTimeout(hackNotifTimerRef.current);
      hackNotifTimerRef.current = setTimeout(
        () => setHackNotification(null),
        10000,
      );
      if (data.newScore !== undefined) setMyScore(data.newScore);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (giftRoundTimerRef.current) clearInterval(giftRoundTimerRef.current);
      if (hackNotifTimerRef.current) clearTimeout(hackNotifTimerRef.current);
      if (teacherMsgTimerRef.current) clearTimeout(teacherMsgTimerRef.current);
      socket.off("connect", doJoin);
      socket.off("disconnect", handleDisconnect);
      socket.io.off("reconnect_attempt", handleReconnect);
      socket.off("game:players-updated");
      socket.off("game:question");
      socket.off("game:answer-result");
      socket.off("game:gift-available");
      socket.off("game:gift-result");
      socket.off("game:gift-notification");
      socket.off("game:gifts-toggled");
      socket.off("game:scores-updated");
      socket.off("game:question-ended");
      socket.off("game:finished");
      socket.off("game:teacher-disconnected");
      socket.off("game:kicked");
      socket.off("game:frozen");
      socket.off("game:points-toggled");
      socket.off("game:shield-blocked");
      socket.off("game:tts-toggled");
      socket.off("game:paused");
      socket.off("game:resumed");
      socket.off("game:gift-round");
      socket.off("game:gift-round-ended");
      socket.off("game:replay");
      socket.off("game:hack-mode-toggled");
      socket.off("game:password-choices");
      socket.off("game:password-set");
      socket.off("game:mystery-boxes");
      socket.off("game:mystery-boxes-clear");
      socket.off("game:box-opened");
      socket.off("game:hack-targets");
      socket.off("game:hack-password-choices");
      socket.off("game:hack-result");
      socket.off("game:hack-notification");
      socket.off("game:teacher-message");
      if (typeof window !== "undefined" && window.speechSynthesis)
        window.speechSynthesis.cancel();
      cleanupAudio();
      disconnectSocket();
    };
  }, [pin, myName]);

  useEffect(() => {
    if (countdownVal === null) return;
    if (countdownVal > 0) {
      // Hack mode never uses the per-question countdown.
      if (hackModeRef.current) {
        setCountdownVal(0);
        return;
      }
      playCountdownBeep(countdownVal as 3 | 2 | 1);
      const timer = setTimeout(() => {
        setCountdownVal((prev) =>
          prev !== null && prev > 0 ? prev - 1 : null,
        );
      }, 900);
      return () => clearTimeout(timer);
    } else {
      // Suppress the "go" sound in hack mode — no per-question audio cues.
      if (!hackModeRef.current) playCountdownGo();
      const q = pendingQuestionRef.current ?? pendingQuestion;
      if (q) {
        pendingQuestionRef.current = null;
        setPendingQuestion(null);
        setQuestion(q);
        setPhase("question");
        setTimeLeft(q.duration);
        const frozen = !!q.frozen;
        setIsFrozen(frozen);
        if (frozen) {
          const socket = getSocket();
          socket.emit("student:submit-answer", { pin, answer: "" });
        }
        if ((q.gameTtsEnabled || q.readAloud) && !getIsMuted()) {
          speakText(q.text, lang === "ar");
        }
        // Hack mode: no continuous background beat — danger alarm in the
        // marathon countdown takes its place during the final 30 seconds.
        if (!hackModeRef.current) startBackgroundBeat();
        if (timerRef.current) clearInterval(timerRef.current);
        // Hack mode runs only the overall marathon timer — skip per-question timer entirely.
        if (!hackModeRef.current) {
          const startTime = Date.now();
          timerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, q.duration - elapsed);
            setTimeLeft(remaining);
            if (
              remaining <= 5 &&
              remaining > 0 &&
              Math.ceil(remaining) !== Math.ceil(remaining + 0.1)
            )
              playTickSound();
            if (remaining <= 0 && timerRef.current)
              clearInterval(timerRef.current);
          }, 100);
        }
      }
      setCountdownVal(null);
      return;
    }
  }, [countdownVal]);

  useEffect(() => {
    if (hackCountdownRef.current) {
      clearInterval(hackCountdownRef.current);
      hackCountdownRef.current = null;
    }
    if (!hackMode || !hackDeadline) return;
    // Track which integer second we last fired the danger alert on, so the
    // 500ms tick interval doesn't double-trigger within the same second.
    let lastDangerSec = -1;
    const tick = () => {
      const remaining = Math.max(0, hackDeadline - Date.now());
      setHackRemainingMs(remaining);

      // Danger alarm in the last 30 seconds. Last 10s = urgent, faster cadence
      // (every 0.5s using the half-second tick); 30s..10s = once per second.
      if (remaining > 0 && remaining <= 10000) {
        // Fire on every tick (≈ every 500ms) for urgency.
        // The 30s..10s warning is intentionally silent now.
        playHackDanger(true);
      }

      if (remaining <= 0 && hackCountdownRef.current) {
        clearInterval(hackCountdownRef.current);
        hackCountdownRef.current = null;
      }
    };
    tick();
    hackCountdownRef.current = setInterval(tick, 500);
    return () => {
      if (hackCountdownRef.current) clearInterval(hackCountdownRef.current);
    };
  }, [hackMode, hackDeadline]);

  const boxDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (boxDismissRef.current) clearTimeout(boxDismissRef.current);
    if (!boxResult || hackStep === "targets" || hackStep === "passwords")
      return;
    boxDismissRef.current = setTimeout(() => {
      setShowMysteryBoxes(false);
      setBoxResult(null);
      setHackStep(null);
      setHackResult(null);
    }, 1000);
    return () => {
      if (boxDismissRef.current) clearTimeout(boxDismissRef.current);
    };
  }, [boxResult, hackStep]);

  useEffect(() => {
    if (
      phase === "answered" &&
      hackMode &&
      answerResult &&
      !answerResult.correct &&
      !answerResult.frozen
    ) {
      // Wrong answer in hack mode: keep the reveal on screen with a visible
      // countdown + "Got it" button. The next question only loads when the
      // student clicks Got it OR the countdown reaches 0.
      setHackWaitingForNext(true);
      setHackNextCountdown(4);
      if (hackNextCountdownRef.current) {
        clearInterval(hackNextCountdownRef.current);
        hackNextCountdownRef.current = null;
      }
      hackNextCountdownRef.current = setInterval(() => {
        setHackNextCountdown((c) => {
          if (c <= 1) {
            if (hackNextCountdownRef.current) {
              clearInterval(hackNextCountdownRef.current);
              hackNextCountdownRef.current = null;
            }
            const socket = getSocket();
            socket.emit("student:ready-for-next", { pin });
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => {
        if (hackNextCountdownRef.current) {
          clearInterval(hackNextCountdownRef.current);
          hackNextCountdownRef.current = null;
        }
      };
    } else {
      setHackWaitingForNext(false);
      if (hackNextCountdownRef.current) {
        clearInterval(hackNextCountdownRef.current);
        hackNextCountdownRef.current = null;
      }
    }
    return () => {
      if (hackNextCountdownRef.current) {
        clearInterval(hackNextCountdownRef.current);
        hackNextCountdownRef.current = null;
      }
    };
  }, [phase, hackMode, answerResult, pin]);

  const submitAnswer = useCallback(
    (answer: string) => {
      if (selectedAnswerRef.current) return;
      selectedAnswerRef.current = answer;
      setSelectedAnswer(answer);
      const socket = getSocket();
      socket.emit("student:submit-answer", {
        pin,
        answer,
        questionInstanceId: hackQuestionInstanceRef.current ?? undefined,
      });

      // 🎨 تأثيرات وميض
      setTimeout(() => {
        const buttons = document.querySelectorAll("button");
        for (const btn of Array.from(buttons)) {
          if (btn.textContent?.trim().includes(answer)) {
            const el = btn as HTMLElement;
            if (answerResult?.correct) {
              woomeezEffects.showCorrectAnswer(el);
            } else {
              woomeezEffects.showWrongAnswer(el);
            }
            break;
          }
        }
      }, 500);
    },
    [pin, answerResult],
  );

  const NOTIF_SOUND_OPTIONS: {
    value: NotificationSoundType;
    labelAr: string;
    labelEn: string;
  }[] = [
    { value: "ping", labelAr: "نبضة", labelEn: "Ping" },
    { value: "chime", labelAr: "رنين", labelEn: "Chime" },
    { value: "bell", labelAr: "جرس", labelEn: "Bell" },
    { value: "beep", labelAr: "صفارة", labelEn: "Beep" },
  ];

  const handleSelectNotifSound = (value: NotificationSoundType) => {
    setNotifSound(value);
    localStorage.setItem("notifSound", value);
    setShowSoundPicker(false);
    playNotificationSoundByType(value);
  };

  const MuteButton = () => (
    <>
      <button
        onClick={handleToggleMute}
        className={`fixed top-4 ${lang === "ar" ? "left-4" : "right-4"} z-50 p-3 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 border border-white/20 transition-colors`}
      >
        {muted ? (
          <VolumeX className="w-5 h-5 text-white/60" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>
      {hackMode && (
        <button
          onClick={handleToggleHackMusic}
          title={
            lang === "ar"
              ? hackMusicMuted
                ? "تشغيل موسيقى الاختراق"
                : "كتم موسيقى الاختراق"
              : hackMusicMuted
                ? "Unmute hack music"
                : "Mute hack music"
          }
          aria-label={
            lang === "ar" ? "كتم/تشغيل موسيقى الاختراق" : "Toggle hack music"
          }
          className={`fixed top-28 ${lang === "ar" ? "left-4" : "right-4"} z-50 p-3 rounded-full backdrop-blur-sm border border-white/20 transition-colors relative ${hackMusicMuted ? "bg-black/40 hover:bg-black/50" : "bg-green-500/30 hover:bg-green-500/45"}`}
        >
          <Music2
            className={`w-5 h-5 ${hackMusicMuted ? "text-white/50" : "text-green-300"}`}
          />
          {hackMusicMuted && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="block w-7 h-0.5 bg-red-400 rotate-45 rounded-full" />
            </span>
          )}
        </button>
      )}
    </>
  );

  const SoundPickerButton = () => {
    // Solo challenge: bell/notification picker is irrelevant — hide it entirely.
    if (isSoloRef.current) return null;
    return (
    <div
      className={`fixed top-16 ${lang === "ar" ? "left-4" : "right-4"} z-50`}
    >
      <button
        onClick={() => setShowSoundPicker((v) => !v)}
        className="p-3 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 border border-white/20 transition-colors"
        title={lang === "ar" ? "صوت الإشعار" : "Notification sound"}
      >
        <Bell className="w-5 h-5 text-white" />
      </button>
      <AnimatePresence>
        {showSoundPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-14 ${lang === "ar" ? "left-0" : "right-0"} bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-black/10 dark:border-white/10 overflow-hidden min-w-[140px]`}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5">
              {lang === "ar" ? "صوت الإشعار" : "Alert sound"}
            </div>
            {NOTIF_SOUND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelectNotifSound(opt.value)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${lang === "ar" ? "flex-row-reverse text-right" : "text-left"} ${
                  notifSound === opt.value
                    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                {notifSound === opt.value && (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                )}
                {notifSound !== opt.value && (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                {lang === "ar" ? opt.labelAr : opt.labelEn}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    );
  };

  const reconnectBanner = (
    <ReconnectingBanner
      show={isReconnecting && phase !== "error" && phase !== "connecting"}
      message={t.gamePlay.reconnecting}
      hint={t.gamePlay.reconnectingHint}
      dir={dir}
    />
  );

  if (phase === "error") {
    return (
      <>
        {reconnectBanner}
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
          dir={dir}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <XCircle className="w-20 h-20 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-black text-white mb-2">
              {error}
            </h1>
            <button
              onClick={() => setLocation("/game/join")}
              className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
            >
              {t.gamePlay.goBack}
            </button>
          </motion.div>
        </div>
      </>
    );
  }

  if (phase === "connecting") {
    return (
      <>
        {reconnectBanner}
        <div
          className={`min-h-screen flex items-center justify-center ${hackMode ? "bg-black" : ""}`}
          style={hackMode ? undefined : { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
          dir={dir}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            {hackMode ? (
              <span className="text-5xl font-black text-green-400 font-mono">
                [..]
              </span>
            ) : (
              <Gamepad2 className="w-16 h-16 text-amber-300" />
            )}
          </motion.div>
        </div>
      </>
    );
  }

  // Hack mode password gate: ANY phase where the player needs to pick a
  // password should show the full-screen picker. This guarantees that no
  // matter when the student joined (before, during, or after the teacher
  // started the marathon), they always see the password picker and can play.
  if (
    hackMode &&
    !myPassword &&
    (phase === "lobby" ||
      phase === "question" ||
      phase === "answered" ||
      phase === "countdown")
  ) {
    return (
      <>
        {reconnectBanner}
        <MuteButton />
        <SoundPickerButton />
        <HackPasswordPickerScreen
          lang={lang}
          dir={dir}
          myName={myName}
          passwordChoices={passwordChoices}
          passwordTakenMsg={passwordTakenMsg}
          isLateJoiner={phase !== "lobby"}
          onPick={(word) => {
            const socket = getSocket();
            socket.emit("student:set-password", { pin, word });
          }}
          onRequestChoices={() => {
            const socket = getSocket();
            socket.emit("student:request-password-choices", { pin });
          }}
        />
      </>
    );
  }

  if (phase === "lobby") {
    if (hackMode) {
      return (
        <>
          {reconnectBanner}
          <MuteButton />
          <SoundPickerButton />
          <HackInstructionsScreen
            lang={lang}
            dir={dir}
            myName={myName}
            myPassword={myPassword!}
            gameTitle={gameTitle}
            players={players}
            gameMode={gameMode}
            myTeam={myTeam}
          />
        </>
      );
    }

    return (
      <>
        {reconnectBanner}
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mb-6"
          >
            <Gamepad2 className="w-16 h-16 text-amber-300 mx-auto" />
          </motion.div>
          <h1 className="text-3xl font-black text-white mb-2">
            {gameTitle}
          </h1>
          <p className="text-amber-200 text-lg mb-4">
            {t.gamePlay.waitingForTeacher}
          </p>
          {gameMode === "teams" && myTeam && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mb-4 px-5 py-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-2xl"
            >
              <div className="flex items-center justify-center gap-2">
                <UsersRound className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-yellow-700 dark:text-yellow-300 font-black text-lg">
                  {myTeam}
                </span>
              </div>
            </motion.div>
          )}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="w-5 h-5 text-amber-300" />
              <p className="text-amber-200 font-bold">
                {t.gamePlay.players} ({players.length})
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {players.map((p, i) => (
                <motion.span
                  key={p.name}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1 ${p.name === myName ? "bg-amber-500 text-white" : "bg-white/20 text-gray-800 dark:text-white"}`}
                >
                  <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                </motion.span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 bg-black/5 dark:bg-white/5 rounded-xl p-3">
            <span className="text-amber-300 font-bold">
              {t.gamePlay.yourNameLabel}
            </span>
            <span className="text-white font-black text-lg">
              {myName}
            </span>
          </div>
        </motion.div>
      </div>
      </>
    );
  }

  if (phase === "countdown") {
    const info = pendingQuestion;
    return (
      <>
        {reconnectBanner}
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
          dir={dir}
        >
          <MuteButton />
          <SoundPickerButton />
          <div className="text-center">
            {info && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <span className="text-amber-300 font-bold text-lg tracking-widest drop-shadow-md">
                  {(info.index ?? 0) + 1} / {info.total}
                </span>
              </motion.div>
            )}
            <AnimatePresence mode="wait">
              {countdownVal !== null && countdownVal > 0 && (
                <motion.div
                  key={countdownVal}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-[140px] font-black leading-none select-none ${
                    countdownVal === 3
                      ? "text-yellow-400"
                      : countdownVal === 2
                        ? "text-orange-400"
                        : "text-red-400"
                  }`}
                  style={{ textShadow: "0 0 40px currentColor" }}
                >
                  {countdownVal}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </>
    );
  }

  // For hack mode, the answer reveal is rendered INLINE on the question screen
  // (Blooket-style green/red card highlight + correct-answer-text banner),
  // so we skip this separate "answered" full-screen view.
  // Solo never enters this block — it stays on "question" phase with inline feedback.
  if (phase === "answered" && !showMysteryBoxes && !hackMode && !isSoloRef.current) {
    return (
      <>
        {reconnectBanner}
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-6 ${hackMode ? "bg-black" : ""}`}
        style={hackMode ? undefined : { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />
        {hackMode ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center font-mono max-w-xs w-full"
          >
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-5xl mb-5"
            >
              {answerResult?.correct ? "✅" : "❌"}
            </motion.div>
            <p
              className={`font-black text-2xl mb-2 ${answerResult?.correct ? "text-green-400" : "text-amber-100"}`}
            >
              {answerResult?.correct
                ? lang === "ar"
                  ? "إجابة صحيحة!"
                  : "CORRECT!"
                : lang === "ar"
                  ? "إجابة خاطئة"
                  : "WRONG!"}
            </p>
            {answerResult?.correct && pointsEnabled && (
              <p className="text-green-600 font-mono text-lg mb-3">
                +{answerResult.points} PTS
              </p>
            )}
            {!answerResult?.correct && correctAnswer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 mb-4 px-4 py-3 bg-green-950/80 border border-green-500 rounded-xl"
              >
                <p className="text-green-600 text-xs font-mono mb-1">
                  {lang === "ar" ? "الإجابة الصحيحة:" : "CORRECT_ANSWER:"}
                </p>
                <p className="text-green-300 font-black text-lg tracking-wide">
                  {correctAnswer}
                </p>
              </motion.div>
            )}
            <motion.p
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-green-800 text-sm"
            >
              {">"}{" "}
              {lang === "ar"
                ? "جارٍ تحميل السؤال التالي..."
                : "LOADING_NEXT_QUESTION..."}
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-5">
              {answerResult?.correct ? "✅" : "❌"}
            </div>
            <p
              className={`font-black text-2xl mb-2 ${answerResult?.correct ? "text-green-600 dark:text-green-400" : "text-amber-100"}`}
            >
              {answerResult?.correct
                ? lang === "ar"
                  ? "إجابة صحيحة!"
                  : "Correct!"
                : lang === "ar"
                  ? "إجابة خاطئة"
                  : "Wrong!"}
            </p>
            {answerResult?.correct && pointsEnabled && (
              <p className="text-yellow-600 dark:text-yellow-400 font-black text-lg mb-3">
                +{answerResult.points} {t.gamePlay.points}
              </p>
            )}
            {!answerResult?.correct && correctAnswer && (
              <div className="mt-3 mb-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-[11px] text-white/50 font-bold mb-0.5">
                  {lang === "ar" ? "الإجابة الصحيحة" : "Correct Answer"}
                </p>
                <p className="text-white font-black text-base">{correctAnswer}</p>
              </div>
            )}
            <motion.p
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-white/80 text-sm font-bold"
            >
              {isSoloRef.current
                ? lang === "ar"
                  ? "جارٍ تحضير السؤال التالي..."
                  : "Next question coming..."
                : lang === "ar"
                  ? "انتظار اللاعبين الآخرين..."
                  : "Waiting for others..."}</motion.p>
          </motion.div>
        )}
      </div>
      </>
    );
  }

  if (
    phase === "question" ||
    showMysteryBoxes ||
    (phase === "answered" && hackMode)
  ) {
    const qType = question?.questionType || "mcq";
    const options =
      qType === "true_false"
        ? [
            { key: "true", text: lang === "ar" ? "صح ✓" : "True ✓" },
            { key: "false", text: lang === "ar" ? "خطأ ✗" : "False ✗" },
          ]
        : qType === "fill_blank" || qType === "dictation"
          ? []
          : [
              { key: "A", text: question?.optionA },
              { key: "B", text: question?.optionB },
              { key: "C", text: question?.optionC },
              { key: "D", text: question?.optionD },
            ].filter((o) => o.text);

    const timerPercent = question ? (timeLeft / question.duration) * 100 : 0;
    const isUrgent = timeLeft <= 5;

    return (
      <>
        {reconnectBanner}
      <div
        className={`min-h-screen flex flex-col relative overflow-hidden ${hackMode ? "bg-black" : ""}`}
        style={
          hackMode
            ? undefined
            : isSoloRef.current
              ? {
                  // Solo challenge — Wameedh dark emerald with a soft gold
                  // shimmer overlay. Matches the HasadX signature identity:
                  // editorial dark green base + warm gold accents from the
                  // top-center, exactly like the وميض theme family.
                  background: [
                    "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(217,165,33,0.14) 0%, transparent 65%)",
                    "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(232,184,75,0.05) 0%, transparent 70%)",
                    "linear-gradient(165deg, #07150F 0%, #0D2118 25%, #143828 55%, #0F2A1C 80%, #081710 100%)",
                  ].join(", "),
                }
              : { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }
        }
        dir={dir}
      >
        {/* HasadX signature for solo — slim premium gold progress bar at
            the very top edge + faint Arabic-geometric pattern overlay.
            Both are decorative and don't affect layout. */}
        {!hackMode && isSoloRef.current && (
          <>
            <div className="absolute top-0 inset-x-0 h-[3px] bg-white/5 z-30 pointer-events-none">
              <motion.div
                className="h-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(232,184,75,0.4) 0%, rgba(232,184,75,0.95) 50%, rgba(232,184,75,0.4) 100%)",
                  boxShadow: "0 0 10px rgba(232,184,75,0.55)",
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${(((question?.index ?? 0) + 1) / Math.max(1, question?.total ?? 1)) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-soft-light"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='%23E8B84B' stroke-width='0.6'><path d='M40 4 L76 40 L40 76 L4 40 Z'/><path d='M40 20 L60 40 L40 60 L20 40 Z'/><circle cx='40' cy='40' r='4'/></g></svg>\")",
                backgroundSize: "120px 120px",
              }}
            />
          </>
        )}
        <MuteButton />
        <SoundPickerButton />
        {hackMode &&
          hackRemainingMs !== null &&
          (() => {
            const totalSec = Math.max(0, Math.ceil(hackRemainingMs / 1000));
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            const urgent = totalSec <= 30;
            return (
              <div
                className={`fixed top-2 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full border font-mono text-sm font-bold shadow-lg ${
                  urgent
                    ? "bg-red-950 border-red-500 text-red-300 animate-pulse"
                    : "bg-zinc-950 border-green-700 text-green-300"
                }`}
              >
                <span className="opacity-70 me-2">⏱</span>
                {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                <span className="opacity-50 mx-2">|</span>
                <span className="text-green-400">
                  Q{hackPersonalAnswered + 1}
                  {hackTotalUnique ? ` / ${hackTotalUnique}` : ""}
                </span>
                {hackCycle > 0 && (
                  <span className="ms-2 text-amber-400">×{hackCycle + 1}</span>
                )}
              </div>
            );
          })()}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  y: -20,
                  x: Math.random() * window.innerWidth,
                  opacity: 1,
                }}
                animate={{
                  y: window.innerHeight + 20,
                  opacity: 0,
                  rotate: Math.random() * 720,
                }}
                transition={{
                  duration: 1.5 + Math.random(),
                  delay: Math.random() * 0.5,
                }}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: [
                    "#f59e0b",
                    "#10b981",
                    "#3b82f6",
                    "#ef4444",
                    "#8b5cf6",
                    "#ec4899",
                  ][i % 6],
                }}
              />
            ))}
          </div>
        )}
        <AnimatePresence>
          {teacherMessage && (
            <motion.div
              key="teacher-msg"
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.95 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] max-w-[90vw] w-full sm:w-auto sm:min-w-[320px]"
              style={{ pointerEvents: "all" }}
            >
              <div
                className="relative rounded-2xl px-5 py-4 shadow-2xl"
                style={{
                  background: "linear-gradient(135deg, #000 0%, #0d1f0d 100%)",
                  border: "1.5px solid #00ff41",
                  boxShadow: "0 0 24px rgba(0,255,65,0.25)",
                }}
              >
                <div className="flex items-start gap-3">
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="text-green-400 font-mono font-black text-base shrink-0 mt-0.5"
                  >
                    📡
                  </motion.span>
                  <div className="flex-1 min-w-0">
                    <p className="text-green-600 font-mono text-[10px] tracking-widest mb-1">
                      {lang === "ar" ? "رسالة من المعلم" : "MSG_FROM_TEACHER"}
                    </p>
                    <p className="text-green-200 font-mono text-sm leading-relaxed break-words">
                      {teacherMessage}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (teacherMsgTimerRef.current)
                        clearTimeout(teacherMsgTimerRef.current);
                      setTeacherMessage(null);
                    }}
                    className="shrink-0 text-green-800 hover:text-green-400 font-mono text-lg leading-none transition-colors mt-0.5"
                  >
                    ×
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hackNotification && (
            <motion.div
              key="hack-notif"
              initial={{ y: -100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -100, opacity: 0, scale: 0.9 }}
              onClick={() => {
                if (hackNotifTimerRef.current)
                  clearTimeout(hackNotifTimerRef.current);
                setHackNotification(null);
              }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[99] cursor-pointer bg-gradient-to-b from-red-950 to-black border-2 border-red-500 text-white px-8 py-5 rounded-3xl shadow-2xl shadow-red-500/50 text-center min-w-[300px] max-w-[90vw]"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: 3, duration: 0.4 }}
                className="text-5xl mb-2"
              >
                💀
              </motion.div>
              <p className="font-black text-red-400 text-xl mb-2">
                {lang === "ar" ? "⚠️ تعرضت للاختراق!" : "⚠️ You Got Hacked!"}
              </p>
              <p className="text-white/80 text-base leading-relaxed">
                <span className="text-2xl">{hackNotification.fromAvatar}</span>{" "}
                <span className="font-bold text-white text-lg">
                  {hackNotification.fromPlayer}
                </span>
                <br />
                {lang === "ar" ? "سرق منك" : "stole"}{" "}
                <span className="text-red-400 font-black text-2xl">
                  {hackNotification.stolenAmount}
                </span>{" "}
                {lang === "ar" ? "نقطة! 😱" : "pts! 😱"}
              </p>
              <p className="text-white/30 text-xs mt-3">
                {lang === "ar" ? "اضغط للإغلاق" : "tap to dismiss"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMysteryBoxes && (
            <motion.div
              key="mystery-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/95 flex flex-col items-center justify-center p-6"
            >
              {hackStep === "targets" ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-sm"
                >
                  <p className="text-green-400 font-black text-xl text-center mb-6">
                    💀{" "}
                    {lang === "ar"
                      ? "اختر هدفك للاختراق"
                      : "Pick Your Hack Target"}
                  </p>
                  <AnimatePresence>
                    {hackPickError && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-4 px-4 py-2 bg-red-950 border border-red-500 text-red-300 text-center rounded-xl text-sm font-bold"
                      >
                        ⚠️ {hackPickError}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex flex-col gap-3">
                    {hackTargets.map((target) => (
                      <motion.button
                        key={target.name}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          const socket = getSocket();
                          socket.emit("student:pick-hack-target", {
                            pin,
                            targetName: target.name,
                          });
                        }}
                        className="flex items-center gap-4 w-full bg-green-950/60 hover:bg-green-900/80 border border-green-600/40 hover:border-green-400 px-5 py-4 rounded-2xl transition-all"
                      >
                        <AvatarDisplay avatar={target.avatar} size="3xl" fallback="🧑" />
                        <span className="text-white font-black text-lg">
                          {target.name}
                        </span>
                        <span className="ml-auto text-green-400 text-xl">
                          →
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : hackStep === "passwords" && hackPasswordData ? (
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-full max-w-sm"
                >
                  <p className="text-green-400 font-black text-xl text-center mb-2">
                    🔐 {lang === "ar" ? "اختر كلمة" : "Guess the Password"}
                  </p>
                  <p className="text-white/50 text-sm text-center mb-6">
                    {hackPasswordData.targetName}
                  </p>
                  <div className="flex flex-col gap-3">
                    {(hackPasswordData.choices ?? []).map((word) => (
                      <motion.button
                        key={word}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          const socket = getSocket();
                          socket.emit("student:guess-hack-password", {
                            pin,
                            targetName: hackPasswordData.targetName,
                            guess: word,
                          });
                        }}
                        className="w-full py-4 bg-green-950/60 hover:bg-green-900/80 border border-green-600/40 hover:border-green-400 text-green-200 font-black text-xl tracking-widest rounded-2xl transition-all"
                      >
                        {word}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : hackStep === "result" && hackResult ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  {hackResult.success ? (
                    <>
                      <div className="text-7xl mb-4">💰</div>
                      <p className="text-green-400 font-black text-2xl mb-2">
                        {lang === "ar" ? "اختراق ناجح!" : "Hack Successful!"}
                      </p>
                      <p className="text-white/70">
                        {lang === "ar" ? "سرقت من" : "Stole from"}{" "}
                        {hackResult.targetName}
                      </p>
                      <p className="text-green-300 font-black text-4xl mt-2">
                        +{hackResult.stolenAmount}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-7xl mb-4">❌</div>
                      <p className="text-red-400 font-black text-2xl mb-2">
                        {lang === "ar" ? "اختراق فاشل!" : "Hack Failed!"}
                      </p>
                      <p className="text-white/50 text-sm">
                        {lang === "ar" ? "كلمة خاطئة" : "Wrong password"}
                      </p>
                    </>
                  )}
                </motion.div>
              ) : boxResult ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  {boxResult.type === "double" && (
                    <>
                      <div className="text-7xl mb-4">⚡</div>
                      <p className="text-yellow-400 font-black text-2xl">
                        {lang === "ar"
                          ? "×2 ضاعفت رصيدك!"
                          : "×2 Score Doubled!"}
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-3">
                        <span className="text-white/40 font-black text-2xl line-through">
                          {boxResult.amount}
                        </span>
                        <span className="text-yellow-400 text-2xl">→</span>
                        <span className="text-yellow-300 font-black text-3xl">
                          {boxResult.newScore}
                        </span>
                      </div>
                    </>
                  )}
                  {boxResult.type === "bonus" && (
                    <>
                      <div className="text-7xl mb-4">🎉</div>
                      <p className="text-amber-400 font-black text-2xl">
                        {lang === "ar" ? "مكافأة!" : "Bonus!"}
                      </p>
                      <p className="text-green-300 font-black text-4xl mt-2">
                        +{boxResult.amount}
                      </p>
                    </>
                  )}
                  {boxResult.type === "nothing" && (
                    <>
                      <div className="text-7xl mb-4">📭</div>
                      <p className="text-gray-300 font-black text-2xl">
                        {lang === "ar" ? "لا شيء!" : "Nothing!"}
                      </p>
                      <p className="text-white/60 text-sm mt-2">
                        {lang === "ar"
                          ? "صندوق فارغ — حظ أوفر"
                          : "Empty box — better luck next time"}
                      </p>
                    </>
                  )}
                  {boxResult.type === "hack" && (
                    <>
                      <div className="text-7xl mb-4">🔐</div>
                      <p className="text-green-400 font-black text-2xl">
                        {lang === "ar" ? "صندوق الاختراق!" : "Hack Box!"}
                      </p>
                      <motion.p
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="text-green-600 text-sm mt-2"
                      >
                        {lang === "ar" ? "جاري التحميل..." : "Loading..."}
                      </motion.p>
                    </>
                  )}
                </motion.div>
              ) : (
                <>
                  <p className="text-green-400 font-black text-2xl mb-2">
                    🎁 {lang === "ar" ? "اختر صندوقك!" : "Pick Your Box!"}
                  </p>
                  <p className="text-white/40 text-sm mb-8">
                    {lang === "ar" ? "صندوق واحد فقط" : "One box only"}
                  </p>
                  <div className="grid grid-cols-3 gap-5">
                    {[0, 1, 2].map((i) => (
                      <motion.button
                        key={i}
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={
                          openedBoxIndex === null ? { scale: 1.08, y: -4 } : {}
                        }
                        whileTap={
                          openedBoxIndex === null ? { scale: 0.95 } : {}
                        }
                        disabled={openedBoxIndex !== null}
                        onClick={() => {
                          if (openedBoxIndex !== null) return;
                          playBoxSelect();
                          const socket = getSocket();
                          socket.emit("student:open-box", { pin, boxIndex: i });
                        }}
                        className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl font-black transition-all
                          ${
                            openedBoxIndex === i
                              ? "border-green-400 bg-green-900/60 scale-110 shadow-[0_0_20px_rgba(74,222,128,0.5)]"
                              : openedBoxIndex !== null
                                ? "border-green-900/30 bg-green-950/20 opacity-30"
                                : "border-green-500/60 bg-green-950/40 hover:border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.3)] cursor-pointer"
                          }`}
                      >
                        {openedBoxIndex === i ? "✨" : "?"}
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="fixed bottom-24 right-4 z-50 flex flex-col-reverse gap-2 max-w-[200px]"
          dir="rtl"
        >
          <AnimatePresence>
            {frozenNotification && (
              <motion.div
                key="frozen-notif"
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 80, opacity: 0 }}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-2.5 rounded-xl shadow-xl font-bold text-sm"
              >
                <div className="flex items-center gap-1.5">
                  <Snowflake className="w-4 h-4 shrink-0" />
                  <p>{frozenNotification}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {giftNotification && (
              <motion.div
                key="gift-notif"
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 80, opacity: 0 }}
                className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-3 py-2.5 rounded-xl shadow-xl font-bold text-sm"
              >
                <p className="text-xs">{giftNotification.message}</p>
                <p
                  className={`font-black mt-0.5 ${giftNotification.pointsChanged < 0 ? "text-red-200" : "text-green-200"}`}
                >
                  {giftNotification.pointsChanged > 0 ? "+" : ""}
                  {giftNotification.pointsChanged} {t.gamePlay.points}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {shieldNotification && (
              <motion.div
                key="shield-notif"
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 80, opacity: 0 }}
                className="bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-3 py-2.5 rounded-xl shadow-xl font-bold text-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span>🛡️</span>
                  <p>{shieldNotification}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isPaused && (
            <motion.div
              key="paused-banner"
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl font-black text-base flex items-center gap-2 border border-orange-300/30"
            >
              <Pause className="w-5 h-5" />
              <span>اللعبة متوقفة مؤقتاً</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {giftsNotification && (
            <motion.div
              key="gifts-notif"
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2 border border-amber-300/30"
            >
              <span>{giftsNotification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {encouragementMsg && (
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -60, opacity: 0, scale: 0.8 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-black text-xl text-center max-w-[320px]"
            >
              {encouragementMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solo challenge — premium HasadX top bar:
            spacer-left (MuteButton/SoundPickerButton are fixed-positioned),
            brand-center, counter-right. The standard multi-player header
            (Q count + streak + score) is hidden for solo via the
            !isSoloRef.current guard below. */}
        {isSoloRef.current && !hackMode && (
          <div className="px-4 pt-4 pb-2 flex items-center justify-between relative z-10">
            <div className="w-20" />
            {/* Platform brand identity — logo icon + "حصاد" wordmark,
                matching the global layout/auth/home brand block.
                Clicking returns the player to the home page. */}
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex flex-col items-center group rounded-lg px-2 py-1 -mx-2 hover:bg-white/[0.04] active:scale-95 transition-all duration-150"
              aria-label="العودة للصفحة الرئيسية"
            >
              <div className="flex items-center gap-2">
                <img
                  src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                  alt="حصاد"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover ring-1 ring-white/15 group-hover:ring-[#E8B84B]/40 transition"
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.35)" }}
                />
                <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">
                  حصاد
                </span>
              </div>
              <span className="text-white/45 group-hover:text-white/65 text-[10px] sm:text-xs mt-1 transition">تجربة تفاعلية ذكية</span>
            </button>
            <span className="w-20 text-end text-white/70 font-semibold text-sm sm:text-base tabular-nums">
              {(question?.index ?? 0) + 1} / {question?.total}
            </span>
          </div>
        )}

        <div className={`p-4 flex items-center justify-between ${isSoloRef.current && !hackMode ? "hidden" : ""}`}>
          <div className="flex items-center gap-3">
            <span className="bg-white/15 border border-white/25 text-white font-bold text-sm px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
              {(question?.index ?? 0) + 1} / {question?.total}
            </span>
            {myStreak >= 2 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-bold"
              >
                <Flame className="w-4 h-4" /> {myStreak}x
              </motion.span>
            )}
            {gameMode === "teams" && myTeam && (
              <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm font-bold">
                <UsersRound className="w-3.5 h-3.5" /> {myTeam}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDoublePoints && pointsEnabled && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-black"
              >
                {t.gamePlay.doublePoints}
              </motion.span>
            )}
            {hasShield && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1 bg-yellow-500/30 border border-yellow-400/50 px-3 py-1.5 rounded-full text-yellow-300 font-bold text-sm"
              >
                🛡️ محمي
              </motion.div>
            )}
            {/* Solo: hide score display entirely — results use correct-count, not points. */}
            {pointsEnabled && !isSoloRef.current &&
              (hackMode ? (
                <div className="flex items-center gap-2 bg-green-950/60 border border-green-800 px-4 py-2 rounded-full font-mono">
                  <span className="text-green-700 text-xs">PTS</span>
                  <span className="text-green-300 font-black">{myScore}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span className="text-white font-black">
                    {myScore}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div className="px-4 mb-2">
          {hackMode || isSoloRef.current ? null : ( // Solo: no timer display (no time-based scoring). Hack mode: marathon timer at top only.
            <>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isUrgent ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ width: `${timerPercent}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <div className="flex items-center justify-center mt-2 gap-1.5 bg-white/15 border border-white/25 rounded-full px-4 py-1 w-fit mx-auto backdrop-blur-sm shadow-sm">
                <Clock
                  className={`w-4 h-4 ${isUrgent ? "text-red-300" : "text-white"}`}
                />
                <span
                  className={`font-mono font-bold text-lg ${isUrgent ? "text-red-300" : "text-white"}`}
                >
                  {Math.ceil(timeLeft)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={`flex-shrink-0 ${isSoloRef.current && !hackMode ? "pt-4 pb-0" : "px-4 py-6"}`}>
          {isDoublePoints && pointsEnabled && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex justify-center mb-3"
            >
              {/* Quiet dark-glass chip — gold border, no red, no loud glow */}
              <div
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold text-[#E8B84B]/90"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(232,184,75,0.35)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                }}
              >
                <span className="text-sm">⚡</span>
                <span>نقاط مضاعفة</span>
              </div>
            </motion.div>
          )}
          {isSpeaking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center mb-2"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-2xl bg-white/15 border border-white/25 rounded-full px-3 py-1 backdrop-blur-sm shadow-sm"
              >
                🔊
              </motion.span>
            </motion.div>
          )}
          {hackMode ? (
            <motion.div
              key={question?.index}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="text-center bg-black/60 backdrop-blur-sm border-2 border-green-900/70 rounded-3xl px-5 py-6 sm:py-8 mx-1 shadow-[0_0_40px_rgba(34,197,94,0.18)]"
            >
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="text-green-500 font-mono text-[10px] tracking-[0.3em]">
                  [ Q{(question?.index ?? 0) + 1} ]
                </span>
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"
                />
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-relaxed">
                {question?.text}
              </h2>
            </motion.div>
          ) : isSoloRef.current ? (
            // Solo challenge — premium floating glass card. Corner shine
            // ornaments + a top "سؤال X من Y" pill + a diamond divider at
            // the bottom give it the HasadX signature look.
            <motion.div
              key={question?.index}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-[96%] max-w-[960px] mx-auto rounded-3xl px-5 sm:px-8 pt-4 sm:pt-5 pb-4 sm:pb-5 relative"
              style={{
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.052) 0%, rgba(20,56,40,0.30) 100%)",
                backdropFilter: "blur(16px) saturate(150%)",
                WebkitBackdropFilter: "blur(16px) saturate(150%)",
                border: "1px solid rgba(232,184,75,0.28)",
                boxShadow:
                  "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(232,184,75,0.08)",
              }}
            >
              {/* Corner shine ornaments — subtle gold accents */}
              <span
                aria-hidden
                className="absolute top-0 start-0 w-16 h-16 rounded-tl-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at top left, rgba(232,184,75,0.22) 0%, transparent 70%)",
                }}
              />
              <span
                aria-hidden
                className="absolute top-0 end-0 w-16 h-16 rounded-tr-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at top right, rgba(120,170,230,0.16) 0%, transparent 70%)",
                }}
              />
              {/* "سؤال X من Y" pill */}
              <div className="flex justify-center mb-3 sm:mb-4">
                <span className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/10 rounded-full px-3 py-1 text-white/65 text-xs sm:text-sm font-medium backdrop-blur-sm">
                  <span className="w-3.5 h-3.5 rounded-full border border-white/30 inline-flex items-center justify-center text-[9px] font-bold text-white/60">؟</span>
                  سؤال {(question?.index ?? 0) + 1} من {question?.total}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl md:text-[26px] font-bold text-white/95 text-center leading-[1.9] sm:leading-[1.75] tracking-wide">
                {question?.text}
              </h2>
              {/* Bottom diamond divider — HasadX signature */}
              <div className="flex items-center justify-center gap-2 mt-4 sm:mt-5">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-white/15" />
                <span
                  className="w-2 h-2 rotate-45 bg-[#E8B84B]/60"
                  style={{ boxShadow: "0 0 8px rgba(232,184,75,0.4)" }}
                />
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-white/15" />
              </div>
            </motion.div>
          ) : (
            <motion.h2
              key={question?.index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-black text-white text-center leading-relaxed"
            >
              {question?.text}
            </motion.h2>
          )}
          {question?.imageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center mt-3"
            >
              <img
                src={question.imageUrl}
                alt=""
                className="max-h-64 sm:max-h-80 w-full rounded-2xl border-2 border-white/20 object-contain shadow-lg"
                style={{ maxWidth: "min(100%, 600px)" }}
              />
            </motion.div>
          )}
        </div>

        {/* Feedback banner: shown in the standard "answered" phase for multiplayer,
            OR inline on "question" phase for solo (no separate answered screen). */}
        {((phase === "answered" && !isSoloRef.current) ||
          (isSoloRef.current && phase === "question" && !!answerResult)) &&
          answerResult &&
          !showMysteryBoxes &&
          (hackMode ? (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`mx-4 mb-3 px-4 py-3 rounded-2xl text-center font-black ${answerResult.correct ? "bg-green-500/15 border-2 border-green-400/60 text-green-300 shadow-[0_0_24px_rgba(74,222,128,0.25)]" : "bg-red-500/15 border-2 border-red-400/60 text-red-300"}`}
            >
              {answerResult.correct ? (
                <div className="flex items-center justify-center gap-3 flex-wrap text-lg">
                  <CheckCircle className="w-6 h-6" />
                  <span>{lang === "ar" ? "إجابة صحيحة!" : "Correct!"}</span>
                  {pointsEnabled && (
                    <span className="text-yellow-300">
                      +{answerResult.points}
                    </span>
                  )}
                  {answerResult.streak >= 3 && (
                    <span className="text-orange-300 flex items-center gap-1">
                      <Flame className="w-4 h-4" /> {answerResult.streak}x
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="flex items-center justify-center gap-2 text-lg">
                    <XCircle className="w-6 h-6" />
                    <span>{lang === "ar" ? "إجابة خاطئة" : "Wrong"}</span>
                  </div>
                  {(answerResult.correctAnswerText || correctAnswer) && (
                    <div className="bg-green-500 text-black px-4 py-2 rounded-xl text-base font-black inline-flex items-center gap-2 shadow-[0_0_18px_rgba(74,222,128,0.5)] max-w-full">
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span className="truncate">
                        {lang === "ar" ? "الإجابة الصحيحة: " : "Correct: "}
                        {answerResult.correctAnswerText ||
                          (correctAnswer === "true"
                            ? lang === "ar"
                              ? "صح"
                              : "True"
                            : correctAnswer === "false"
                              ? lang === "ar"
                                ? "خطأ"
                                : "False"
                              : question?.questionType === "fill_blank"
                                ? correctAnswer
                                : correctAnswer === "A"
                                  ? question?.optionA
                                  : correctAnswer === "B"
                                    ? question?.optionB
                                    : correctAnswer === "C"
                                      ? question?.optionC
                                      : correctAnswer === "D"
                                        ? question?.optionD
                                        : correctAnswer)}
                      </span>
                    </div>
                  )}
                  {hackWaitingForNext && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setHackWaitingForNext(false);
                        if (hackNextCountdownRef.current) {
                          clearInterval(hackNextCountdownRef.current);
                          hackNextCountdownRef.current = null;
                        }
                        const socket = getSocket();
                        socket.emit("student:ready-for-next", { pin });
                      }}
                      className="px-6 py-2.5 bg-white text-black hover:bg-green-100 font-black text-base rounded-xl flex items-center gap-2 shadow-lg transition-colors"
                    >
                      <span>{lang === "ar" ? "فهمت ←" : "Got it →"}</span>
                      <span className="text-green-700 font-mono text-sm">
                        {hackNextCountdown}s
                      </span>
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mx-4 mb-3 px-4 py-3 rounded-2xl text-center font-black text-lg ${answerResult.frozen ? "bg-blue-500/20 border-2 border-blue-500/50 text-blue-400" : answerResult.correct ? "bg-green-500/20 border-2 border-green-500/50 text-green-400" : "bg-red-500/20 border-2 border-red-500/50 text-red-400"}`}
            >
              {answerResult.frozen ? (
                <div className="flex items-center justify-center gap-2">
                  <Snowflake className="w-6 h-6" />
                  <span>{t.gamePlay.youAreFrozen}</span>
                </div>
              ) : answerResult.correct ? (
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <CheckCircle className="w-6 h-6" />
                  <span>{t.gamePlay.correctAnswer}</span>
                  {pointsEnabled && (
                    <span className="text-yellow-400">
                      +{answerResult.points}
                    </span>
                  )}
                  {answerResult.streak >= 3 && (
                    <span className="text-orange-400 flex items-center gap-1">
                      <Flame className="w-4 h-4" /> {answerResult.streak}x
                    </span>
                  )}
                  {answerResult.giftEarned && (
                    <span className="text-yellow-300 flex items-center gap-1">
                      <Gift className="w-4 h-4" /> {t.gamePlay.gift}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="w-6 h-6" />
                    <span>{t.gamePlay.wrongAnswer}</span>
                  </div>
                  {correctAnswer && (
                    <div className="flex items-center justify-center gap-2 text-green-400 text-base">
                      <CheckCircle className="w-5 h-5" />
                      <span>
                        {t.gamePlay.correctAnswerIs}{" "}
                        {correctAnswer === "true"
                          ? lang === "ar"
                            ? "صح ✓"
                            : "True ✓"
                          : correctAnswer === "false"
                            ? lang === "ar"
                              ? "خطأ ✗"
                              : "False ✗"
                            : question?.questionType === "fill_blank"
                              ? correctAnswer
                              : correctAnswer === "A"
                                ? question?.optionA
                                : correctAnswer === "B"
                                  ? question?.optionB
                                  : correctAnswer === "C"
                                    ? question?.optionC
                                    : correctAnswer === "D"
                                      ? question?.optionD
                                      : correctAnswer}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}

        {isFrozen && phase === "question" ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Snowflake className="w-24 h-24 text-blue-400 mx-auto mb-4" />
              </motion.div>
              <h3 className="text-3xl font-black text-blue-600 dark:text-blue-300 mb-2">
                {t.gamePlay.youAreFrozen}
              </h3>
              <p className="text-blue-700/70 dark:text-blue-200/70 text-lg">
                {t.gamePlay.frozenDesc}
              </p>
            </motion.div>
          </div>
        ) : qType === "dictation" ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-4">
            {!selectedAnswer ? (
              <>
                {/* Listen button */}
                <div className="flex flex-col items-center gap-2">
                  {(() => {
                    const maxListens = parseInt(question?.optionB || "3") || 3;
                    const remaining = maxListens - dictationListenCount;
                    const canListen = remaining > 0 && !dictationSpeaking;
                    const playDictation = async () => {
                      if (!canListen || !question?.optionA) return;
                      setDictationSpeaking(true);
                      setDictationListenCount(c => c + 1);
                      try {
                        const res = await fetch(`${API_BASE}/api/tts`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ text: question.optionA, voice: "nova", speed: 0.85 }),
                        });
                        if (!res.ok) throw new Error("tts failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        audio.onended = () => { setDictationSpeaking(false); URL.revokeObjectURL(url); };
                        audio.onerror = () => { setDictationSpeaking(false); URL.revokeObjectURL(url); };
                        await audio.play();
                      } catch {
                        setDictationSpeaking(false);
                        // fallback to Web Speech API
                        if ("speechSynthesis" in window) {
                          const utt = new SpeechSynthesisUtterance(question.optionA);
                          utt.lang = "ar-SA"; utt.rate = 0.85;
                          utt.onend = () => setDictationSpeaking(false);
                          window.speechSynthesis.speak(utt);
                          setDictationSpeaking(true);
                        }
                      }
                    };
                    return (
                      <>
                        <button
                          onClick={playDictation}
                          disabled={!canListen}
                          className={`flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 touch-manipulation ${dictationSpeaking ? "bg-teal-400/20 border-2 border-teal-300 text-teal-200 animate-pulse" : canListen ? "bg-teal-500 hover:bg-teal-400 text-white" : "bg-white/10 text-white/40 cursor-not-allowed"}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                          </svg>
                          {dictationSpeaking
                            ? (lang === "ar" ? "جارٍ الاستماع..." : "Listening...")
                            : (lang === "ar" ? "استمع" : "Listen")}
                        </button>
                        <p className="text-white/50 text-sm">
                          {lang === "ar"
                            ? `${remaining} مرة متبقية من ${maxListens}`
                            : `${remaining} listen${remaining !== 1 ? "s" : ""} remaining of ${maxListens}`}
                        </p>
                      </>
                    );
                  })()}
                </div>
                {/* Dictation input */}
                <input
                  type="text"
                  value={dictationInput}
                  onChange={(e) => setDictationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && dictationInput.trim())
                      submitAnswer(dictationInput.trim());
                  }}
                  placeholder={lang === "ar" ? "اكتب ما سمعته..." : "Type what you heard..."}
                  className="w-full max-w-lg px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/30 text-white text-xl font-bold text-center placeholder:text-white/40 focus:outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-400/30"
                  dir="auto"
                  autoFocus={dictationListenCount > 0}
                />
                <button
                  onClick={() => {
                    if (dictationInput.trim()) submitAnswer(dictationInput.trim());
                  }}
                  disabled={!dictationInput.trim()}
                  className="px-10 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-2xl font-black text-lg shadow-lg disabled:opacity-40 active:scale-95 transition-transform duration-75 touch-manipulation"
                >
                  {t.gamePlay.submit}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className={`text-center text-2xl font-black ${answerResult?.correct ? "text-green-400" : "text-red-400"}`}>
                  {selectedAnswer}
                </div>
                {!answerResult?.correct && correctAnswer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 bg-green-500/20 border-2 border-green-400/60 px-5 py-3 rounded-2xl"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span className="text-green-300 font-black text-lg">{correctAnswer}</span>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        ) : qType === "fill_blank" ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-4">
            {!selectedAnswer ? (
              <>
                <input
                  type="text"
                  value={fillBlankInput}
                  onChange={(e) => setFillBlankInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && fillBlankInput.trim())
                      submitAnswer(fillBlankInput.trim());
                  }}
                  placeholder={t.gamePlay.fillBlankPlaceholder}
                  className="w-full max-w-lg px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/30 text-white text-xl font-bold text-center placeholder:text-white/40 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/30"
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (fillBlankInput.trim())
                      submitAnswer(fillBlankInput.trim());
                  }}
                  disabled={!fillBlankInput.trim()}
                  className="px-10 py-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-2xl font-black text-lg shadow-lg disabled:opacity-40 active:scale-95 transition-transform duration-75 touch-manipulation"
                >
                  {t.gamePlay.submit}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`text-center text-2xl font-black ${answerResult?.correct ? "text-green-400" : "text-red-400"}`}
                >
                  {selectedAnswer}
                </div>
                {!answerResult?.correct && correctAnswer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 bg-green-500/20 border-2 border-green-400/60 px-5 py-3 rounded-2xl"
                  >
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    <span className="text-green-300 font-black text-lg">
                      {correctAnswer}
                    </span>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`grid ${qType === "true_false" ? "flex-1 grid-cols-2" : hackMode ? "flex-1 grid-cols-1 sm:grid-cols-2" : isSoloRef.current ? "flex-1 grid-cols-1 w-[94%] max-w-[920px] mx-auto auto-rows-fr" : "flex-1 grid-cols-2"} ${hackMode ? "gap-2" : isSoloRef.current && qType !== "true_false" ? "gap-[12px] sm:gap-[14px]" : "gap-3"} ${isSoloRef.current && qType !== "true_false" ? "pt-2 pb-3" : "px-4 pb-8"} ${isSoloRef.current && qType !== "true_false" ? "" : "auto-rows-fr"}`}
          >
            {options.map((opt, i) => {
              const isSelected = selectedAnswer === opt.key;
              // In hack mode MCQ options are shuffled per-player, so the server's
              // `correctAnswer` letter (original ordering) won't match this card's key.
              // Match by text via `correctAnswerText`. For true/false the server
              // sends raw "صح"/"خطأ" while the client labels include ✓/✗ marks,
              // so strip non-letters before comparing.
              const normalize = (s: string) =>
                s.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
              const isCorrectOpt = hackMode
                ? answerResult?.correctAnswerText
                  ? qType === "true_false"
                    ? normalize(answerResult.correctAnswerText) ===
                      normalize(opt.text ?? "")
                    : answerResult.correctAnswerText === opt.text
                  : correctAnswer === opt.key
                : correctAnswer === opt.key;
              const isWrongSelected =
                isSelected && answerResult && !answerResult.correct;
              const showCorrectHighlight =
                isCorrectOpt && answerResult && !answerResult.correct;

              let btnClass: string;
              if (hackMode) {
                // Blooket-style: large green tiles, no A>/B> prefixes, full answer text inside
                if (answerResult) {
                  if (isSelected && answerResult.correct)
                    btnClass =
                      "bg-green-400 border-4 border-green-200 text-black shadow-[0_0_28px_rgba(74,222,128,0.85)] scale-[1.03]";
                  else if (isWrongSelected)
                    btnClass = "bg-red-600 border-4 border-red-300 text-white";
                  else if (showCorrectHighlight)
                    btnClass =
                      "bg-green-500 border-4 border-green-200 text-black shadow-[0_0_32px_rgba(74,222,128,0.9)]";
                  else
                    btnClass =
                      "bg-green-900/40 border-4 border-green-900/60 text-green-200/40";
                } else {
                  btnClass =
                    "bg-green-500 hover:bg-green-400 border-4 border-black text-white hover:shadow-[0_0_20px_rgba(74,222,128,0.55)] active:scale-[0.97]";
                }
                const fbHackClass = isSelected && answerResult?.correct
                  ? "fb-correct"
                  : isWrongSelected
                    ? "fb-wrong"
                    : showCorrectHighlight
                      ? "fb-revealed"
                      : "";
                return (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    onClick={() => submitAnswer(opt.key)}
                    disabled={!!selectedAnswer}
                    className={`${btnClass} ${fbHackClass} rounded-xl px-2 py-1.5 font-black text-sm sm:text-base md:text-lg flex items-center justify-center text-center min-h-[40px] sm:min-h-[48px] relative transition-all duration-150 touch-manipulation select-none`}
                  >
                    <span className="leading-snug break-words">{opt.text}</span>
                    {isSelected && answerResult?.correct && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`absolute top-1.5 ${lang === "ar" ? "right-1.5" : "left-1.5"}`}
                      >
                        <CheckCircle
                          className="w-5 h-5 text-black drop-shadow"
                          strokeWidth={3}
                        />
                      </motion.div>
                    )}
                    {isWrongSelected && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className={`absolute top-1.5 ${lang === "ar" ? "right-1.5" : "left-1.5"}`}
                      >
                        <XCircle
                          className="w-6 h-6 text-white drop-shadow"
                          strokeWidth={3}
                        />
                      </motion.div>
                    )}
                    {showCorrectHighlight && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        className={`absolute top-1.5 ${lang === "ar" ? "right-1.5" : "left-1.5"}`}
                      >
                        <CheckCircle
                          className="w-6 h-6 text-black drop-shadow"
                          strokeWidth={3}
                        />
                      </motion.div>
                    )}
                  </motion.button>
                );
              }

              const tfColors: Array<{ bg: string; hover: string; text: string; style?: React.CSSProperties }> = [
                {
                  bg: "bg-green-500",
                  hover: "hover:bg-green-600",
                  text: "text-white",
                },
                {
                  bg: "bg-red-500",
                  hover: "hover:bg-red-600",
                  text: "text-white",
                },
              ];
              // Solo challenge — swap to muted/elegant palette for MCQ.
              // True/false keeps the standard green/red for clarity.
              const useSoloPalette =
                isSoloRef.current && qType !== "true_false";
              const soloColor = useSoloPalette ? SOLO_OPTION_COLORS[i] : null;
              const color =
                qType === "true_false" ? tfColors[i] : OPTION_COLORS[i];
              let btnStyle: React.CSSProperties = soloColor
                ? soloColor.bgStyle
                : color.style || {};
              btnClass = soloColor
                ? "text-white"
                : `${color.bg || ""} ${color.hover || ""} ${color.text}`.trim();
              if (answerResult) {
                if (isSelected && answerResult.correct) {
                  btnClass =
                    "bg-green-500 text-white ring-4 ring-green-300 scale-105";
                  btnStyle = {};
                } else if (isWrongSelected) {
                  btnClass =
                    "bg-red-600 text-white ring-4 ring-red-400 opacity-80";
                  btnStyle = {};
                } else if (showCorrectHighlight) {
                  btnClass =
                    "bg-green-400 text-white ring-[6px] ring-green-200 scale-110 shadow-[0_0_20px_rgba(74,222,128,0.7)]";
                  btnStyle = {};
                } else if (!isSelected) {
                  btnClass = `${color.bg || ""} ${color.text} opacity-30`.trim();
                  // keep btnStyle to keep gradient visible (dimmed by opacity-30)
                }
              } else if (isSelected) {
                // Instant visual feedback the moment the player taps — before
                // the server's answer-result arrives. Without this the button
                // looks identical to its non-tapped state for 100-500ms, and
                // the player thinks their tap was lost and re-taps repeatedly.
                btnClass = `${btnClass} ring-4 ring-white/80 scale-[1.02] brightness-110`;
              } else if (selectedAnswer) {
                // Once any answer is tapped, dim the others immediately so the
                // player gets clear "you tapped X" feedback without waiting.
                btnClass = `${btnClass} opacity-50`;
              }

              const fbAnimClass = isSelected && answerResult?.correct
                ? "fb-correct"
                : isWrongSelected
                  ? "fb-wrong"
                  : showCorrectHighlight
                    ? "fb-revealed"
                    : "";

              return (
                <button
                  key={opt.key}
                  onPointerDown={(e) => {
                    // Fire on pointer-down — the tap is registered the instant
                    // the player's finger touches the screen, eliminating the
                    // delay between touch and visual feedback. Also prevents
                    // a stray onClick from re-firing.
                    if (selectedAnswerRef.current) return;
                    e.preventDefault();
                    submitAnswer(opt.key);
                  }}
                  onClick={() => {
                    // Fallback for mouse / keyboard / older browsers where
                    // PointerEvent is not delivered first.
                    if (selectedAnswerRef.current) return;
                    submitAnswer(opt.key);
                  }}
                  disabled={!!selectedAnswer}
                  style={btnStyle}
                  className={`${btnClass} ${fbAnimClass} ${soloColor ? "w-full rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4 font-semibold text-base sm:text-lg flex items-center gap-4 sm:gap-5 text-start min-h-[72px] sm:min-h-[82px] hover:brightness-110 hover:-translate-y-[1px]" : `rounded-2xl px-3 py-2 font-bold text-lg sm:text-xl flex items-center justify-center text-center shadow-md ${isSoloRef.current ? "min-h-[60px] sm:min-h-[70px]" : "min-h-[54px] sm:min-h-[64px]"}`} relative active:scale-[0.985] transition-all duration-150 ease-out touch-manipulation select-none cursor-pointer`}
                >
                  {soloColor && (
                    <span
                      className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-sm sm:text-base"
                      style={{
                        ...soloColor.circleStyle,
                        border: "1.5px solid rgba(255,255,255,0.18)",
                        backdropFilter: "blur(6px)",
                        boxShadow:
                          "0 0 14px rgba(255,255,255,0.12), 0 2px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.28)",
                      }}
                    >
                      {lang === "ar" ? soloColor.arLabel : soloColor.enLabel}
                    </span>
                  )}
                  <span
                    className={
                      soloColor
                        ? "flex-1 leading-snug text-white text-base sm:text-lg font-semibold"
                        : "leading-snug"
                    }
                  >
                    {opt.text}
                  </span>
                  {soloColor && !answerResult && (
                    <ChevronLeft
                      className={`flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 opacity-50 ${lang === "ar" ? "" : "rotate-180"}`}
                      style={{ color: soloColor.circleStyle.color as string }}
                      strokeWidth={2.5}
                    />
                  )}
                  {isSelected && answerResult?.correct && (
                    <CheckCircle
                      className={`absolute top-2 ${lang === "ar" ? "right-2" : "left-2"} w-6 h-6 text-white`}
                    />
                  )}
                  {isWrongSelected && (
                    <XCircle
                      className={`absolute top-2 ${lang === "ar" ? "right-2" : "left-2"} w-6 h-6 text-white`}
                    />
                  )}
                  {showCorrectHighlight && (
                    <CheckCircle
                      className={`absolute top-2 ${lang === "ar" ? "right-2" : "left-2"} w-7 h-7 text-white drop-shadow`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {/* HasadX signature bottom bar — solo only.
            "Powered by HasadX" branding + soft action buttons. Pure UI,
            actions are visual-only stubs (no logic changes). */}
        {isSoloRef.current && !hackMode && (
          <div
            className="mt-auto flex items-center justify-between px-4 py-3 sm:py-3.5 border-t border-white/[0.06] backdrop-blur-sm relative z-10"
            style={{ background: "rgba(8,11,20,0.45)" }}
          >
            {/* Footer brand — same logo + name as the platform header,
                clickable to hasadx.com with a short tagline. */}
            <a
              href="https://hasadx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/45 hover:text-white/80 active:scale-95 transition-all duration-150 group"
              aria-label="حصاد"
            >
              <img
                src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
                alt=""
                aria-hidden
                className="w-4 h-4 rounded object-cover opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <span className="text-[11px] sm:text-xs font-medium">
                أنشئ مسابقاتك التفاعلية
                <span className="text-white/25 mx-1.5">•</span>
                Powered by <span className="font-bold">حصاد X</span>
              </span>
            </a>
            <div className="flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => setLocation("/feedback")}
                className="flex items-center gap-1.5 text-white/45 hover:text-white/80 active:scale-95 transition-all duration-150 text-[11px] sm:text-xs font-medium"
                aria-label="ملاحظات واقتراحات"
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={2} />
                <span>ملاحظات واقتراحات</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  // Primary share action — opens native share sheet on mobile
                  // (WhatsApp, Telegram, etc. appear automatically in the sheet).
                  // Falls back to clipboard copy on desktop browsers.
                  const shareUrl = "https://hasadx.com";
                  const shareText = "جرّب هذا التحدي التفاعلي على حصاد X ✨";
                  if (navigator.share) {
                    navigator.share({ title: "حصاد X", text: shareText, url: shareUrl }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
                  }
                }}
                className="flex items-center gap-1.5 bg-white/[0.07] hover:bg-white/[0.13] border border-white/15 hover:border-[#E8B84B]/40 text-white/75 hover:text-white active:scale-95 transition-all duration-150 text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 rounded-full"
                aria-label="مشاركة"
              >
                <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={2.5} />
                <span>مشاركة</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  if (phase === "gift-round") {
    const giftRoundSelectGift = (type: GiftType) => {
      // Play a distinct sound for each power-up button
      if (type === "freeze")  playPowerUpFreeze();
      else if (type === "shield")  playPowerUpShield();
      else if (type === "mystery") playPowerUpMystery();
      else if (type === "steal")   playPowerUpSteal();

      setChosenGiftType(type);
      if (type === "mystery" || type === "shield") {
        const socket = getSocket();
        socket.emit("student:use-gift", { pin, giftType: type });
        setUsedGiftTypes((prev) => new Set([...prev, type]));
        setGiftRoundChosen(true);
      } else if (type === "steal") {
        setGiftStep("selectStealAmount");
      } else {
        setGiftStep("selectPlayer");
      }
    };

    const giftRoundSelectStealAmount = (amount: number) => {
      setStealAmount(amount);
      setGiftStep("selectPlayer");
    };

    const giftRoundSelectTarget = (targetName: string) => {
      if (!chosenGiftType) return;
      const socket = getSocket();
      const payload: {
        pin: string;
        giftType: GiftType;
        targetName: string;
        stealAmount?: number;
      } = { pin, giftType: chosenGiftType, targetName };
      if (chosenGiftType === "steal") payload.stealAmount = stealAmount;
      socket.emit("student:use-gift", payload);
      setUsedGiftTypes((prev) => new Set([...prev, chosenGiftType]));
      setGiftRoundChosen(true);
    };

    return (
      <>
        {reconnectBanner}
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-4 ${hackMode ? "bg-black" : ""}`}
        style={hackMode ? undefined : { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-sm w-full"
        >
          <div className="text-center mb-6">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-7xl mb-3"
            >
              🎁
            </motion.div>
            <h2
              className={`text-3xl font-black mb-2 ${hackMode ? "text-green-300 font-mono" : "text-white"}`}
            >
              {hackMode ? "[BONUS_POWER]" : "صندوق المفاجآت!"}
            </h2>
            <p
              className={`font-bold ${hackMode ? "text-green-700 font-mono" : "text-white/75"}`}
            >
              {hackMode ? "> SELECT_UPGRADE" : "اختر قوتك الخاصة"}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-black text-xl">
                {giftRoundTimeLeft}
              </span>
            </div>
          </div>

          {giftRoundChosen ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center py-8"
            >
              <div className="text-6xl mb-4">✅</div>
              <p className="text-2xl font-black text-green-600 dark:text-green-400">
                تم الاختيار!
              </p>
              {giftResult && (
                <p className="text-yellow-600 dark:text-yellow-300 font-bold mt-2">
                  {giftResult}
                </p>
              )}
              <p className="text-white/70 mt-4 font-bold">
                انتظر بقية اللاعبين...
              </p>
            </motion.div>
          ) : giftStep === "selectStealAmount" && chosenGiftType === "steal" ? (
            <div>
              <p className="text-white font-black text-center mb-4 text-lg">
                💰 كم نقطة تريد سحبها؟
              </p>
              <div className="space-y-3">
                {[30, 50, 75].map((amount) => (
                  <motion.button
                    key={amount}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => giftRoundSelectStealAmount(amount)}
                    className="w-full p-4 rounded-xl bg-gradient-to-r from-orange-600/80 to-red-600/80 hover:from-orange-500 hover:to-red-500 text-white font-black text-xl flex items-center justify-center gap-3 border border-white/20 shadow-lg"
                  >
                    <span className="text-2xl">💰</span>
                    <span>{amount} نقطة</span>
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => {
                  setGiftStep("choose");
                  setChosenGiftType(null);
                }}
                className="w-full mt-3 p-2 text-white/65 font-bold text-sm"
              >
                رجوع
              </button>
            </div>
          ) : giftStep === "selectPlayer" && chosenGiftType ? (
            <div>
              <p className="text-white font-black text-center mb-4 text-lg">
                {chosenGiftType === "steal"
                  ? `💰 اختر اللاعب لسحب ${stealAmount} نقطة`
                  : "🥶 اختر اللاعب الذي تريد تجميده"}
              </p>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {otherPlayers.map((p) => (
                  <motion.button
                    key={p.name}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => giftRoundSelectTarget(p.name)}
                    className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-3"
                  >
                    <AvatarDisplay avatar={p.avatar} size="2xl" />
                    <span className="flex-1 text-right">{p.name}</span>
                    <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                      {p.score}
                    </span>
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (chosenGiftType === "steal") {
                    setGiftStep("selectStealAmount");
                  } else {
                    setGiftStep("choose");
                    setChosenGiftType(null);
                  }
                }}
                className="w-full mt-3 p-2 text-white/65 font-bold text-sm"
              >
                رجوع
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {POWER_UP_TYPES.map((type) => {
                const reusable = type === "steal" || type === "mystery";
                const alreadyUsed = usedGiftTypes.has(type) && !reusable;
                return (
                  <motion.button
                    key={type}
                    whileTap={alreadyUsed ? undefined : { scale: 0.92 }}
                    whileHover={alreadyUsed ? undefined : { scale: 1.05 }}
                    disabled={alreadyUsed}
                    onClick={() => giftRoundSelectGift(type)}
                    className={`relative bg-gradient-to-br ${POWER_UP_INFO[type].color} p-5 rounded-2xl text-center shadow-xl border-2 border-white/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale`}
                  >
                    <div className="text-4xl mb-2">
                      {POWER_UP_INFO[type].icon}
                    </div>
                    <p className="text-white font-black text-sm">
                      {POWER_UP_INFO[type].nameAr}
                    </p>
                    {alreadyUsed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                        <span className="text-white/80 font-black text-xs">
                          تم الاستخدام ✓
                        </span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
      </>
    );
  }

  // Solo: no intermediate leaderboard / race-track / "your rank 1 of 1" — wait silently for the next question.
  if (phase === "leaderboard" && isSoloRef.current) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (phase === "leaderboard" && showMysteryBoxes) {
    return (
      <>
        {reconnectBanner}
      <div
        className={`min-h-screen ${hackMode ? "bg-black" : ""}`}
        {...(hackMode ? {} : { style: { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" } })}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />
        <AnimatePresence>
          <motion.div
            key="mystery-overlay-lb"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/95 flex flex-col items-center justify-center p-6"
          >
            {hackStep === "targets" ? (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm"
              >
                <p className="text-green-400 font-black text-xl text-center mb-6">
                  💀{" "}
                  {lang === "ar"
                    ? "اختر هدفك للاختراق"
                    : "Pick Your Hack Target"}
                </p>
                <div className="flex flex-col gap-3">
                  {hackTargets.map((target) => (
                    <motion.button
                      key={target.name}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const socket = getSocket();
                        socket.emit("student:pick-hack-target", {
                          pin,
                          targetName: target.name,
                        });
                      }}
                      className="flex items-center gap-4 w-full bg-green-950/60 hover:bg-green-900/80 border border-green-600/40 hover:border-green-400 px-5 py-4 rounded-2xl transition-all"
                    >
                      <AvatarDisplay avatar={target.avatar} size="3xl" fallback="🧑" />
                      <span className="text-white font-black text-lg">
                        {target.name}
                      </span>
                      <span className="ml-auto text-green-400 text-xl">→</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : hackStep === "passwords" && hackPasswordData ? (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm"
              >
                <p className="text-green-400 font-black text-xl text-center mb-2">
                  🔐 {lang === "ar" ? "اختر كلمة" : "Guess the Password"}
                </p>
                <p className="text-white/50 text-sm text-center mb-6">
                  {hackPasswordData.targetName}
                </p>
                <div className="flex flex-col gap-3">
                  {(hackPasswordData.choices ?? []).map((word) => (
                    <motion.button
                      key={word}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const socket = getSocket();
                        socket.emit("student:guess-hack-password", {
                          pin,
                          targetName: hackPasswordData.targetName,
                          guess: word,
                        });
                      }}
                      className="w-full py-4 bg-green-950/60 hover:bg-green-900/80 border border-green-600/40 hover:border-green-400 text-green-200 font-black text-xl tracking-widest rounded-2xl transition-all"
                    >
                      {word}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : hackStep === "result" && hackResult ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                {hackResult.success ? (
                  <>
                    <div className="text-7xl mb-4">💰</div>
                    <p className="text-green-400 font-black text-2xl mb-2">
                      {lang === "ar" ? "اختراق ناجح!" : "Hack Successful!"}
                    </p>
                    <p className="text-white/70">
                      {lang === "ar" ? "سرقت من" : "Stole from"}{" "}
                      {hackResult.targetName}
                    </p>
                    <p className="text-green-300 font-black text-4xl mt-2">
                      +{hackResult.stolenAmount}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-7xl mb-4">❌</div>
                    <p className="text-red-400 font-black text-2xl mb-2">
                      {lang === "ar" ? "اختراق فاشل!" : "Hack Failed!"}
                    </p>
                    <p className="text-white/50 text-sm">
                      {lang === "ar" ? "كلمة خاطئة" : "Wrong password"}
                    </p>
                  </>
                )}
              </motion.div>
            ) : boxResult ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                {boxResult.type === "double" && (
                  <>
                    <div className="text-7xl mb-4">⚡</div>
                    <p className="text-yellow-400 font-black text-2xl">
                      {lang === "ar" ? "×2 ضاعفت رصيدك!" : "×2 Score Doubled!"}
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <span className="text-white/40 font-black text-2xl line-through">
                        {boxResult.amount}
                      </span>
                      <span className="text-yellow-400 text-2xl">→</span>
                      <span className="text-yellow-300 font-black text-3xl">
                        {boxResult.newScore}
                      </span>
                    </div>
                  </>
                )}
                {boxResult.type === "bonus" && (
                  <>
                    <div className="text-7xl mb-4">🎉</div>
                    <p className="text-amber-400 font-black text-2xl">
                      {lang === "ar" ? "مكافأة!" : "Bonus!"}
                    </p>
                    <p className="text-green-300 font-black text-4xl mt-2">
                      +{boxResult.amount}
                    </p>
                  </>
                )}
                {boxResult.type === "nothing" && (
                  <>
                    <div className="text-7xl mb-4">📭</div>
                    <p className="text-gray-300 font-black text-2xl">
                      {lang === "ar" ? "لا شيء!" : "Nothing!"}
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                      {lang === "ar"
                        ? "صندوق فارغ — حظ أوفر"
                        : "Empty box — better luck next time"}
                    </p>
                  </>
                )}
                {boxResult.type === "hack" && (
                  <>
                    <div className="text-7xl mb-4">🔐</div>
                    <p className="text-green-400 font-black text-2xl">
                      {lang === "ar" ? "صندوق الاختراق!" : "Hack Box!"}
                    </p>
                    <motion.p
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="text-green-600 text-sm mt-2"
                    >
                      {lang === "ar" ? "جاري التحميل..." : "Loading..."}
                    </motion.p>
                  </>
                )}
              </motion.div>
            ) : (
              <>
                <p className="text-green-400 font-black text-2xl mb-2">
                  🎁 {lang === "ar" ? "اختر صندوقك!" : "Pick Your Box!"}
                </p>
                <p className="text-white/40 text-sm mb-8">
                  {lang === "ar" ? "صندوق واحد فقط" : "One box only"}
                </p>
                <div className="grid grid-cols-3 gap-5">
                  {[0, 1, 2].map((i) => (
                    <motion.button
                      key={i}
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={
                        openedBoxIndex === null ? { scale: 1.08, y: -4 } : {}
                      }
                      whileTap={openedBoxIndex === null ? { scale: 0.95 } : {}}
                      disabled={openedBoxIndex !== null}
                      onClick={() => {
                        if (openedBoxIndex !== null) return;
                        playBoxSelect();
                        const socket = getSocket();
                        socket.emit("student:open-box", { pin, boxIndex: i });
                      }}
                      className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl font-black transition-all
                        ${
                          openedBoxIndex === i
                            ? "border-green-400 bg-green-900/60 scale-110 shadow-[0_0_20px_rgba(74,222,128,0.5)]"
                            : openedBoxIndex !== null
                              ? "border-green-900/30 bg-green-950/20 opacity-30"
                              : "border-green-500/60 bg-green-950/40 hover:border-green-400 hover:shadow-[0_0_15px_rgba(74,222,128,0.3)] cursor-pointer"
                        }`}
                    >
                      {openedBoxIndex === i ? "✨" : "?"}
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </>
    );
  }

  if (phase === "leaderboard") {
    if (hackMode) {
      return (
        <>
          {reconnectBanner}
        <div
          className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden"
          dir={dir}
        >
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-5">
            {Array.from({ length: 10 }).map((_, col) => (
              <motion.div
                key={col}
                initial={{ y: -200 }}
                animate={{ y: "110vh" }}
                transition={{
                  duration: 5 + col * 0.7,
                  repeat: Infinity,
                  delay: col * 0.4,
                  ease: "linear",
                }}
                className="absolute top-0 text-green-500 font-mono text-xs leading-5"
                style={{ left: `${(col / 10) * 100}%` }}
              >
                {"10XH4K!#NETT0".split("").map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </motion.div>
            ))}
          </div>
          <MuteButton />
          <SoundPickerButton />
          <AnimatePresence>
            {giftNotification && (
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-500 text-red-200 px-6 py-4 rounded-xl font-bold text-center font-mono"
              >
                <p>{giftNotification.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-center font-mono"
          >
            <p className="text-green-500 text-xs">{">"} SYSTEM_LEADERBOARD</p>
            {correctAnswer && (
              <p className="text-green-400 font-bold text-sm mt-1">
                CORRECT: <span className="text-green-200">{correctAnswer}</span>
              </p>
            )}
          </motion.div>

          <div className="w-full max-w-sm space-y-2 relative z-10">
            {leaderboard.slice(0, 8).map((entry, i) => (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border font-mono text-sm
                  ${
                    entry.name === myName
                      ? "bg-green-950/70 border-green-500 text-green-200"
                      : "bg-black border-green-900/50 text-green-600"
                  }`}
              >
                <span className="w-6 text-center font-black text-green-500">
                  {i === 0
                    ? "01"
                    : i === 1
                      ? "02"
                      : i === 2
                        ? "03"
                        : `${String(i + 1).padStart(2, "0")}`}
                </span>
                <span className="flex-1 truncate">{entry.name}</span>
                {entry.lastAnswer?.correct && (
                  <span className="text-green-400 text-xs">
                    +{entry.lastAnswer.points}
                  </span>
                )}
                <span
                  className={`font-black text-base ${entry.name === myName ? "text-green-300" : "text-green-700"}`}
                >
                  {entry.score}
                </span>
              </motion.div>
            ))}
          </div>

          {myRank > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 font-mono text-center"
            >
              <span className="text-green-700 text-xs">YOUR_RANK: </span>
              <span className="text-green-300 font-black text-xl">
                {String(myRank).padStart(2, "0")}
              </span>
              <span className="text-green-700 text-xs">
                {" "}
                / {leaderboard.length}
              </span>
            </motion.div>
          )}

          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="mt-4 text-green-700 text-xs font-mono"
          >
            {">"} AWAITING_NEXT_ROUND...
          </motion.p>
        </div>
        </>
      );
    }

    return (
      <>
        {reconnectBanner}
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />
        <AnimatePresence>
          {giftNotification && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-center"
            >
              <p>{giftNotification.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {correctAnswer && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <p className="font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t.gamePlay.correctAnswerIs}{" "}
              <span className="text-lg" style={{ color: "#E8B84B" }}>
                {correctAnswer}
              </span>
            </p>
          </motion.div>
        )}

        <div className="w-full max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <RaceTrack players={leaderboard} myName={myName} />
          </motion.div>
        </div>

        {myRank > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-white font-bold"
          >
            {t.gamePlay.yourRank}{" "}
            <span className="text-white font-black text-2xl">
              {myRank}
            </span>{" "}
            {t.gamePlay.of} {leaderboard.length}
          </motion.p>
        )}

        {gameMode === "teams" && teamLeaderboard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-lg mt-5 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <UsersRound className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-white font-black">
                {t.teacherGame.teamRanking}
              </h3>
            </div>
            <div className="space-y-2">
              {teamLeaderboard.map((team, i) => (
                <div
                  key={team.teamName}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${team.teamName === myTeam ? "bg-yellow-500/20 border border-yellow-500/40" : "bg-black/5 dark:bg-white/5"}`}
                >
                  <span className="text-xl font-black text-white/70 w-6 text-center">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-black text-white">
                    {team.teamName}
                  </span>
                  <span className="text-yellow-600 dark:text-yellow-400 font-black">
                    {team.totalScore}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <p className="mt-3 text-white/90 text-sm animate-pulse">
          {t.gamePlay.waitingNextQuestion}
        </p>
      </div>
      </>
    );
  }

  if (phase === "finished") {
    // Solo challenge: render only the simplified solo results page.
    // No podium, no "all players", no PIN-share, no "wait for teacher".
    if (isSoloRef.current) {
      return (
        <SoloChallengeResults
          myScore={myScore}
          myName={myName}
          lang={lang}
          correctCount={soloCorrectCount}
          totalQuestions={soloTotalQuestionsRef.current}
          dir={dir}
        />
      );
    }

    const top3 = leaderboard.slice(0, 3);
    const winner = top3[0];
    const second = top3[1];
    const third = top3[2];

    return (
      <>
        {reconnectBanner}
      <div
        className="min-h-screen p-4 sm:p-8"
        style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        dir={dir}
      >
        <MuteButton />
        <SoundPickerButton />

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={`confetti-${i}`}
              initial={{
                y: -20,
                x:
                  Math.random() *
                  (typeof window !== "undefined" ? window.innerWidth : 500),
                opacity: 1,
              }}
              animate={{
                y:
                  (typeof window !== "undefined" ? window.innerHeight : 800) +
                  20,
                opacity: 0,
                rotate: Math.random() * 720,
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
              }}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: [
                  "#fbbf24",
                  "#f59e0b",
                  "#fcd34d",
                  "#fde68a",
                  "#d946ef",
                  "#a855f7",
                ][i % 6],
              }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, burstIdx) => {
            const cx = 15 + Math.random() * 70;
            const cy = 10 + Math.random() * 50;
            const colors = [
              "#ef4444",
              "#f59e0b",
              "#10b981",
              "#3b82f6",
              "#8b5cf6",
              "#ec4899",
            ];
            return Array.from({ length: 12 }).map((_, j) => {
              const angle = (j / 12) * Math.PI * 2;
              const dist = 60 + Math.random() * 80;
              return (
                <motion.div
                  key={`fw-${burstIdx}-${j}`}
                  initial={{ x: `${cx}%`, y: `${cy}%`, scale: 0, opacity: 1 }}
                  animate={{
                    x: `calc(${cx}% + ${Math.cos(angle) * dist}px)`,
                    y: `calc(${cy}% + ${Math.sin(angle) * dist}px)`,
                    scale: [0, 1.5, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.2,
                    delay: burstIdx * 0.5 + 0.5,
                    repeat: Infinity,
                    repeatDelay: 3 + Math.random() * 2,
                  }}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: colors[(burstIdx + j) % colors.length],
                    boxShadow: `0 0 6px ${colors[(burstIdx + j) % colors.length]}`,
                  }}
                />
              );
            });
          })}
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`glow-${i}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0.6, 0], scale: [0, 1, 0] }}
              transition={{
                duration: 1.5,
                delay: i * 0.7 + 0.3,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="absolute rounded-full"
              style={{
                left: `${15 + Math.random() * 70}%`,
                top: `${10 + Math.random() * 50}%`,
                width: 120,
                height: 120,
                background: `radial-gradient(circle, ${["rgba(251,191,36,0.4)", "rgba(236,72,153,0.4)", "rgba(139,92,246,0.4)", "rgba(16,185,129,0.4)"][i]} 0%, transparent 70%)`,
              }}
            />
          ))}
        </div>

        <div className="max-w-4xl mx-auto relative z-10">

          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">
              {lang === "ar" ? "انتهت اللعبة" : "Game Over"}
            </h1>
            <p className="text-amber-300 text-lg">
              {t.gamePlay.yourScore}{" "}
              <span className="font-black text-white">{myScore}</span>
              {myRank > 0 && (
                <> — {t.gamePlay.rank} <span className="font-black text-white">{myRank}</span></>
              )}
            </p>
          </motion.div>

          {gameMode === "teams" && teamLeaderboard.length > 0 && (() => {
            const teamFirst = teamLeaderboard[0];
            const teamSecond = teamLeaderboard[1];
            const teamThird = teamLeaderboard[2];
            return (
              <>
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                  className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/50 rounded-2xl p-6 mb-6 text-center">
                  <h2 className="text-2xl font-black text-yellow-400 mb-2">🏆 {t.teacherGame.winningTeam}</h2>
                  <p className="text-4xl sm:text-5xl font-black text-white mb-1">{teamFirst?.teamName}</p>
                  <p className="text-yellow-300 font-bold">{teamFirst?.totalScore} {t.teacherGame.pointsLabel} • {teamFirst?.members} {t.teacherGame.teamMembers}</p>
                </motion.div>
                <div className="flex items-end justify-center gap-3 sm:gap-6 mb-10 max-w-2xl mx-auto">
                  {teamSecond && (
                    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1">
                      <span className="text-white font-black text-base sm:text-lg mb-1 max-w-full truncate text-center" title={teamSecond.teamName}
                        style={{ color: teamSecond.teamName === myTeam ? "#E8B84B" : "white" }}>{teamSecond.teamName}</span>
                      <span className="text-gray-300 font-black text-2xl mb-2">{teamSecond.totalScore}</span>
                      <div className="w-full h-32 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-2xl flex flex-col items-center justify-center shadow-lg shadow-gray-500/20 border-t-4 border-gray-300">
                        <span className="text-5xl">🥈</span>
                        <span className="text-white/80 font-black text-sm mt-1">{t.teacherGame.secondPlace}</span>
                      </div>
                    </motion.div>
                  )}
                  {teamFirst && (
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1 -mt-6">
                      <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="relative mb-1">
                        <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
                      </motion.div>
                      <span className="text-white font-black text-lg sm:text-xl mb-0.5 max-w-full truncate text-center" title={teamFirst.teamName}
                        style={{ color: teamFirst.teamName === myTeam ? "#E8B84B" : "white" }}>{teamFirst.teamName}</span>
                      <span className="text-yellow-400 font-black text-3xl mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">{teamFirst.totalScore}</span>
                      <div className="w-full h-44 bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-400 rounded-t-2xl flex flex-col items-center justify-center shadow-xl shadow-yellow-500/30 border-t-4 border-yellow-300 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                        <span className="text-7xl relative z-10">🥇</span>
                        <span className="text-white font-black text-base mt-1 relative z-10">{t.teacherGame.champion}</span>
                      </div>
                    </motion.div>
                  )}
                  {teamThird && (
                    <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.3, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1">
                      <span className="text-white font-black text-base sm:text-lg mb-1 max-w-full truncate text-center" title={teamThird.teamName}
                        style={{ color: teamThird.teamName === myTeam ? "#E8B84B" : "white" }}>{teamThird.teamName}</span>
                      <span className="text-amber-400 font-black text-2xl mb-2">{teamThird.totalScore}</span>
                      <div className="w-full h-24 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-2xl flex flex-col items-center justify-center shadow-lg shadow-amber-700/20 border-t-4 border-amber-500">
                        <span className="text-5xl">🥉</span>
                        <span className="text-white/80 font-black text-xs mt-0.5">{t.teacherGame.thirdPlace}</span>
                      </div>
                    </motion.div>
                  )}
                </div>
                {teamLeaderboard.length > 3 && (
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-4 mb-8 max-w-2xl mx-auto">
                    <div className="space-y-2">
                      {teamLeaderboard.slice(3).map((team, i) => (
                        <div key={team.teamName} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                          style={team.teamName === myTeam ? { background: "rgba(232,184,75,0.12)", border: "1px solid rgba(232,184,75,0.35)" } : { background: "rgba(255,255,255,0.05)" }}>
                          <span className="text-white/60 font-black w-6 text-center">{i + 4}</span>
                          <span className="flex-1 font-bold truncate" style={{ color: team.teamName === myTeam ? "#E8B84B" : "white" }}>{team.teamName}</span>
                          <span className="text-yellow-400 font-black">{team.totalScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {gameMode !== "teams" && top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 sm:gap-6 mb-10 max-w-lg mx-auto">
              {second && (
                <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1">
                  <AvatarDisplay avatar={second.avatar} size="4xl" className="mb-1" />
                  <span className="text-white font-bold text-sm mb-1 max-w-[100px] truncate">{second.name}</span>
                  <span className="text-gray-300 font-black text-xl mb-2">{second.score}</span>
                  <div className="w-full h-32 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-2xl flex flex-col items-center justify-center shadow-lg shadow-gray-500/20 border-t-4 border-gray-300">
                    <span className="text-5xl">🥈</span>
                    <span className="text-white/70 font-black text-sm mt-1">{t.teacherGame.secondPlace}</span>
                  </div>
                </motion.div>
              )}
              {winner && (
                <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1 -mt-6">
                  <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="relative">
                    <AvatarDisplay avatar={winner.avatar} size="4xl" className="drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      className={`absolute -top-4 ${lang === "ar" ? "-left-3" : "-right-3"}`}>
                      <span className="text-3xl">👑</span>
                    </motion.div>
                  </motion.div>
                  <span className="text-white font-black text-lg mt-1 mb-0.5 max-w-[120px] truncate">{winner.name}</span>
                  <span className="text-yellow-400 font-black text-3xl mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">{winner.score}</span>
                  <div className="w-full h-44 bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-400 rounded-t-2xl flex flex-col items-center justify-center shadow-xl shadow-yellow-500/30 border-t-4 border-yellow-300 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                    <span className="text-7xl relative z-10">🥇</span>
                    <span className="text-white font-black text-base mt-1 relative z-10">{t.teacherGame.champion}</span>
                  </div>
                </motion.div>
              )}
              {third && (
                <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.3, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1">
                  <AvatarDisplay avatar={third.avatar} size="4xl" className="mb-1" />
                  <span className="text-white font-bold text-sm mb-1 max-w-[100px] truncate">{third.name}</span>
                  <span className="text-amber-400 font-black text-xl mb-2">{third.score}</span>
                  <div className="w-full h-24 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-2xl flex flex-col items-center justify-center shadow-lg shadow-amber-700/20 border-t-4 border-amber-500">
                    <span className="text-5xl">🥉</span>
                    <span className="text-white/70 font-black text-xs mt-0.5">{t.teacherGame.thirdPlace}</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 mb-6 max-h-[250px] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">
                {lang === "ar" ? "جميع اللاعبين" : "All Players"} ({leaderboard.length})
              </h2>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <motion.div key={entry.name}
                    initial={{ opacity: 0, x: lang === "ar" ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2 + i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${entry.name === myName ? "bg-yellow-500/15 border border-yellow-500/40" : i < 3 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5"}`}>
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-sm text-white/70 shrink-0">
                      {i === 0 ? <Crown className="w-5 h-5 text-yellow-400" /> : i === 1 ? <Medal className="w-5 h-5 text-gray-300" /> : i === 2 ? <Award className="w-5 h-5 text-amber-500" /> : i + 1}
                    </span>
                    <AvatarDisplay avatar={entry.avatar} size="xl" />
                    <span className={`font-bold flex-1 truncate ${entry.name === myName ? "text-amber-300" : "text-white/80"}`}>{entry.name}</span>
                    {entry.teamName && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 font-bold">{entry.teamName}</span>}
                    <span className="font-black text-yellow-400">{entry.score}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Solo challenge has its own dedicated finished screen above
              (rendered before the multiplayer JSX), so nothing extra here. */}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
            className="mb-4">
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
              <p className="text-xs text-center mb-3 font-medium text-white/75">
                {lang === "ar" ? "📤 شارك رابط اللعبة مع أصدقائك!" : "📤 Share the game link with friends!"}
              </p>
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3 ${lang === "ar" ? "flex-row-reverse" : ""}`}
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-xs flex-1 truncate font-mono text-white/70" dir="ltr">
                  {`${window.location.origin}/game/join/${pin}`}
                </span>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/game/join/${pin}`)
                      .then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); });
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-bold transition-all"
                  style={{ background: "linear-gradient(135deg, #1A3A28, #2D6A44)", boxShadow: "0 2px 12px rgba(26,58,40,0.4)" }}>
                  {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {shareCopied ? (lang === "ar" ? "تم النسخ!" : "Copied!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}
                </button>
                {typeof navigator.share === "function" && (
                  <button
                    onClick={() => navigator.share({ title: lang === "ar" ? "انضم إلى المسابقة!" : "Join the game!", text: lang === "ar" ? `انضم إلى اللعبة باستخدام الرمز: ${pin}` : `Join the game with PIN: ${pin}`, url: `${window.location.origin}/game/join/${pin}` }).catch(() => {})}
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg, #C9960C, #E8B84B)", boxShadow: "0 2px 12px rgba(201,150,12,0.4)" }}>
                    <Share2 className="w-4 h-4" />
                    {lang === "ar" ? "مشاركة" : "Share"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
            className="flex justify-center gap-3 flex-wrap">
            <p className="w-full text-center text-sm font-bold text-white/70 mb-1">
              {lang === "ar" ? "انتظر المعلم لإعادة اللعبة..." : "Waiting for teacher to replay..."}
            </p>
            <button
              onClick={() => setLocation("/")}
              className="px-8 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/20 transition-colors border border-white/20">
              {t.gamePlay.backToHome}
            </button>
          </motion.div>

        </div>
      </div>
      </>
    );
  }

  return null;
}
