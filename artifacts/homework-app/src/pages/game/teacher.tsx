import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { Gamepad2, Trophy, Users, Play, SkipForward, StopCircle, Crown, Medal, Award, BarChart3, Copy, CheckCircle, XCircle, Clock, Zap, Gift, Link2, User, UsersRound, Ban, ToggleLeft, ToggleRight, Pause, Save, Loader2, Activity, Share2, Home, Languages, DoorOpen, PlayCircle, Mic, Lock, Unlock, ArrowRightLeft, GraduationCap } from "lucide-react";
import { ClassSelector } from "@/components/teacher/class-selector";
import RaceTrack from "@/components/race-track";
import { playVictoryFanfare, playClapSound, playFireworkSound, playGameStartSound, playTimeUpSound, playHackMarathonLoop, stopHackMarathonLoop, toggleHackMusicMuted, getIsHackMusicMuted, getIsMuted } from "@/lib/game-sounds";
import { useI18n } from "@/lib/i18n";
import { InlineQR } from "@/components/game-qr-code";
import { AvatarDisplay } from "@/components/avatar-display";
import { WameethWaitingRoomUI } from "./wameeth-waiting-room-ui";

interface GiftEvent {
  id: number;
  playerName: string;
  playerAvatar: string;
  giftType: string;
  message: string;
  affectedPlayer?: string;
}

interface HackLogEntry {
  id: number;
  hackerName: string;
  hackerAvatar: string;
  targetName: string;
  stolenAmount: number;
  timestamp: number;
}

interface LeaderboardEntry {
  name: string;
  avatar?: string;
  score: number;
  streak: number;
  teamName?: string | null;
  lastAnswer?: { correct: boolean; points: number };
  personalAnsweredCount?: number;
  personalCycle?: number;
  personalQuestionIndex?: number;
}

interface TeamLeaderboardEntry {
  teamName: string;
  totalScore: number;
  playerTotal: number;
  adjustment: number;
  members: number;
  avgScore: number;
  totalCorrect: number;
}

interface Question {
  index: number;
  total: number;
  text: string;
  questionType?: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  points: number;
  duration: number;
  isDoublePoints?: boolean;
  imageUrl?: string | null;
}

type Phase = "lobby" | "question" | "leaderboard" | "gift-round" | "finished";
type GameMode = "solo" | "teams";

export default function TeacherGame() {
  const [, params] = useRoute("/teacher/game/:pin");
  const pin = params?.pin || "";
  const [, setLocation] = useLocation();
  const { t, lang, setLang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [phase, setPhase] = useState<Phase>("lobby");
  const [players, setPlayers] = useState<{ name: string; score: number; avatar?: string; teamName?: string | null; isBot?: boolean; hasPassword?: boolean }[]>([]);
  const [roomLocked, setRoomLocked] = useState(false);
  const [lockedTeams, setLockedTeams] = useState<string[]>([]);
  const [targetClass, setTargetClass] = useState<string>("");
  const [targetClassEditing, setTargetClassEditing] = useState(false);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [hackLog, setHackLog] = useState<HackLogEntry[]>([]);
  const hackLogIdRef = useRef(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [botCount, setBotCount] = useState(4);
  const [isAddingBots, setIsAddingBots] = useState(false);
  const [currentGameMode, setCurrentGameMode] = useState<GameMode>("solo");
  const [pointsEnabled, setPointsEnabled] = useState(true);
  const [giftsEnabled, setGiftsEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [hackMode, setHackMode] = useState(false);
  const hackModeRef = useRef(false);
  useEffect(() => { hackModeRef.current = hackMode; }, [hackMode]);
  const [hackMusicMuted, setHackMusicMuted] = useState<boolean>(() => getIsHackMusicMuted());
  const [hackDurationMin, setHackDurationMin] = useState<number>(7);
  const [hackCustomMin, setHackCustomMin] = useState<string>("");
  const [hackMarathonActive, setHackMarathonActive] = useState(false);
  const [hackMarathonDeadline, setHackMarathonDeadline] = useState<number | null>(null);
  const [hackMarathonRemainingMs, setHackMarathonRemainingMs] = useState<number | null>(null);
  const hackMarathonTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [studentStats, setStudentStats] = useState<Map<string, { name: string; avatar: string; correct: number; wrong: number; score: number; personalAnsweredCount?: number; personalCycle?: number; personalQuestionIndex?: number }>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [sentMessages, setSentMessages] = useState<{ id: number; text: string; timestamp: number }[]>([]);
  const sentMsgIdRef = useRef(0);
  const giftIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const doReconnect = () => {
      socket.emit("teacher:reconnect-game", { pin }, (res: any) => {
        if (res.success) {
          setPlayers(res.players || []);
          setTotalPlayers(res.players?.length || 0);
          if (res.gameMode) setCurrentGameMode(res.gameMode);
          if (Array.isArray(res.teamNames)) setTeamNames(res.teamNames);
          if (typeof res.roomLocked === "boolean") setRoomLocked(res.roomLocked);
          if (Array.isArray(res.lockedTeams)) setLockedTeams(res.lockedTeams);
          if (typeof res.targetClass === "string" || res.targetClass === null) {
            setTargetClass(res.targetClass || "");
          }
          if (res.leaderboard) setLeaderboard(res.leaderboard);
          if (res.teamLeaderboard) setTeamLeaderboard(res.teamLeaderboard);
          if (res.pointsEnabled !== undefined) setPointsEnabled(res.pointsEnabled);
          if (res.giftsEnabled !== undefined) setGiftsEnabled(res.giftsEnabled);
          if (res.ttsEnabled !== undefined) setTtsEnabled(!!res.ttsEnabled);
          if (res.hackMode !== undefined) setHackMode(!!res.hackMode);

          if (res.state === "question") {
            setPhase("question");
            // Hack-mode marathon: restore the host monitoring view (countdown
            // + per-student stats) instead of the generic question UI.
            if (res.hackMode && res.hackMarathon?.active) {
              setHackMarathonActive(true);
              if (typeof res.hackMarathon.deadline === "number") {
                setHackMarathonDeadline(res.hackMarathon.deadline);
                setHackMarathonRemainingMs(
                  res.hackMarathon.remainingMs ??
                    Math.max(0, res.hackMarathon.deadline - Date.now()),
                );
              }
              if (Array.isArray(res.hackStudentStats)) {
                const snapshot = new Map<string, { name: string; avatar: string; correct: number; wrong: number; score: number; personalAnsweredCount?: number; personalCycle?: number; personalQuestionIndex?: number }>();
                for (const s of res.hackStudentStats) {
                  snapshot.set(s.name, s);
                }
                setStudentStats(snapshot);
              }
              if (!getIsMuted() && !getIsHackMusicMuted()) {
                playHackMarathonLoop();
              }
            } else if (res.currentQuestion) {
              setQuestion(res.currentQuestion);
              setAnsweredCount(res.answeredCount || 0);
              setTotalPlayers(res.totalPlayers || res.players?.length || 0);
              const remaining = res.currentQuestion.timeRemaining ?? res.currentQuestion.duration;
              setTimeLeft(remaining);
              if (timerRef.current) clearInterval(timerRef.current);
              const startTime = Date.now();
              timerRef.current = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const r = Math.max(0, remaining - elapsed);
                setTimeLeft(r);
                if (r <= 0 && timerRef.current) clearInterval(timerRef.current);
              }, 100);
            }
          } else if (res.state === "leaderboard") {
            setPhase("leaderboard");
            if (res.distribution) setDistribution(res.distribution);
            if (res.correctAnswer) setCorrectAnswer(res.correctAnswer);
          } else if (res.state === "gift-round") {
            setPhase("gift-round");
          } else if (res.state === "finished") {
            setPhase("finished");
          }
        }
      });
    };

    doReconnect();

    socket.on("connect", doReconnect);

    socket.on("game:players-updated", (data: any) => {
      setPlayers(data.players);
      setTotalPlayers(data.players.length);
      if (data.gameMode) setCurrentGameMode(data.gameMode);
      if (Array.isArray(data.teamNames)) setTeamNames(data.teamNames);
      if (typeof data.roomLocked === "boolean") setRoomLocked(data.roomLocked);
      if (Array.isArray(data.lockedTeams)) setLockedTeams(data.lockedTeams);
    });

    socket.on("game:gift-used", (data: any) => {
      giftIdRef.current++;
      const evt: GiftEvent = {
        id: giftIdRef.current,
        playerName: data.playerName,
        playerAvatar: data.playerAvatar,
        giftType: data.giftType,
        message: data.message,
        affectedPlayer: data.affectedPlayer,
      };
      setGiftEvents((prev) => [evt, ...prev].slice(0, 10));
    });

    socket.on("game:scores-updated", (data: any) => {
      setLeaderboard(data.leaderboard);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      if (data.gameMode) setCurrentGameMode(data.gameMode);
    });

    socket.on("game:points-toggled", (data: any) => {
      setPointsEnabled(data.enabled);
    });

    socket.on("game:gifts-toggled", (data: any) => {
      setGiftsEnabled(data.enabled);
    });

    socket.on("game:tts-toggled", (data: any) => {
      setTtsEnabled(!!data.enabled);
    });

    socket.on("game:hack-broadcast", (data: any) => {
      hackLogIdRef.current++;
      const entry: HackLogEntry = {
        id: hackLogIdRef.current,
        hackerName: data.hackerName || "",
        hackerAvatar: data.hackerAvatar || "",
        targetName: data.targetName || "",
        stolenAmount: data.stolenAmount || 0,
        timestamp: data.timestamp || Date.now(),
      };
      setHackLog(prev => [entry, ...prev].slice(0, 30));
    });

    socket.on("game:hack-mode-toggled", (data: any) => {
      setHackMode(!!data.enabled);
      if (data.enabled) setGiftsEnabled(false);
    });

    socket.on("game:hack-marathon-started", (data: any) => {
      setHackMarathonActive(true);
      setStudentStats(new Map());
      if (typeof data?.deadline === "number") {
        setHackMarathonDeadline(data.deadline);
        setHackMarathonRemainingMs(Math.max(0, data.deadline - Date.now()));
      }
    });

    socket.on("game:hack-marathon-ended", () => {
      setHackMarathonActive(false);
      if (hackMarathonTimerRef.current) {
        clearInterval(hackMarathonTimerRef.current);
        hackMarathonTimerRef.current = null;
      }
    });

    socket.on("hack:student-stats", (data: { name: string; avatar: string; correct: number; wrong: number; score: number; personalAnsweredCount?: number; personalCycle?: number; personalQuestionIndex?: number }) => {
      setStudentStats(prev => {
        const next = new Map(prev);
        next.set(data.name, data);
        return next;
      });
    });

    socket.on("game:paused", () => {
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on("game:resumed", () => {
      setIsPaused(false);
    });

    socket.on("game:question", (q: Question) => {
      setQuestion(q);
      setPhase("question");
      setAnsweredCount(0);
      setTimeLeft(q.duration);
      if (hackModeRef.current && !getIsMuted() && !getIsHackMusicMuted()) {
        playHackMarathonLoop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, q.duration - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
      }, 100);
    });

    socket.on("game:answer-received", (data) => {
      setAnsweredCount(data.answeredCount);
      setTotalPlayers(data.totalPlayers);
    });

    socket.on("game:question-ended", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      playTimeUpSound();
      setLeaderboard(data.leaderboard);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      if (data.gameMode) setCurrentGameMode(data.gameMode);
      setDistribution(data.distribution);
      setCorrectAnswer(data.correctAnswer);
      setPhase("leaderboard");
    });

    socket.on("game:gift-round", () => {
      setPhase("gift-round");
    });

    socket.on("game:gift-round-ended", (data: any) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
    });

    socket.on("game:finished", (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopHackMarathonLoop();
      setLeaderboard(data.leaderboard);
      if (data.teamLeaderboard) setTeamLeaderboard(data.teamLeaderboard);
      if (data.gameMode) setCurrentGameMode(data.gameMode);
      setHackMarathonActive(false);
      if (hackMarathonTimerRef.current) {
        clearInterval(hackMarathonTimerRef.current);
        hackMarathonTimerRef.current = null;
      }
      setPhase("finished");
      playVictoryFanfare();
      setTimeout(() => playClapSound(), 500);
      setTimeout(() => playFireworkSound(), 1000);
    });

    socket.on("game:replay", (data: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayers(data.players || []);
      setTotalPlayers(data.players?.length || 0);
      if (data.gameMode) setCurrentGameMode(data.gameMode);
      if (Array.isArray(data.teamNames)) setTeamNames(data.teamNames);
      if (typeof data.roomLocked === "boolean") setRoomLocked(data.roomLocked);
      if (Array.isArray(data.lockedTeams)) setLockedTeams(data.lockedTeams);
      setLeaderboard([]);
      setTeamLeaderboard([]);
      setQuestion(null);
      setAnsweredCount(0);
      setTimeLeft(0);
      setCorrectAnswer(null);
      setDistribution({});
      setIsPaused(false);
      setHackMarathonActive(false);
      setStudentStats(new Map());
      setHackLog([]);
      setSentMessages([]);
      if (hackMarathonTimerRef.current) {
        clearInterval(hackMarathonTimerRef.current);
        hackMarathonTimerRef.current = null;
      }
      setPhase("lobby");
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (hackMarathonTimerRef.current) clearInterval(hackMarathonTimerRef.current);
      socket.off("connect", doReconnect);
      socket.off("game:players-updated");
      socket.off("game:question");
      socket.off("game:answer-received");
      socket.off("game:question-ended");
      socket.off("game:finished");
      socket.off("game:replay");
      socket.off("game:gift-used");
      socket.off("game:scores-updated");
      socket.off("game:points-toggled");
      socket.off("game:gifts-toggled");
      socket.off("game:tts-toggled");
      socket.off("game:hack-broadcast");
      socket.off("game:hack-mode-toggled");
      socket.off("game:hack-marathon-started");
      socket.off("game:hack-marathon-ended");
      socket.off("hack:student-stats");
      socket.off("game:paused");
      socket.off("game:resumed");
      socket.off("game:gift-round");
      socket.off("game:gift-round-ended");
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (hackMarathonTimerRef.current) {
      clearInterval(hackMarathonTimerRef.current);
      hackMarathonTimerRef.current = null;
    }
    if (!hackMarathonActive || !hackMarathonDeadline) return;
    const tick = () => {
      const remaining = Math.max(0, hackMarathonDeadline - Date.now());
      setHackMarathonRemainingMs(remaining);
      if (remaining <= 0 && hackMarathonTimerRef.current) {
        clearInterval(hackMarathonTimerRef.current);
        hackMarathonTimerRef.current = null;
      }
    };
    tick();
    hackMarathonTimerRef.current = setInterval(tick, 500);
    return () => {
      if (hackMarathonTimerRef.current) clearInterval(hackMarathonTimerRef.current);
    };
  }, [hackMarathonActive, hackMarathonDeadline]);

  const startGame = () => {
    playGameStartSound();
    const socket = getSocket();
    let hackDurationMinutes: number | undefined;
    if (hackMode) {
      const custom = hackCustomMin ? parseInt(hackCustomMin, 10) : NaN;
      hackDurationMinutes = !isNaN(custom) && custom > 0 && custom <= 120 ? custom : hackDurationMin;
    }
    socket.emit("teacher:start-game", { pin, autoAdvance, ttsEnabled, hackDurationMinutes });
  };

  const nextQ = () => {
    const socket = getSocket();
    socket.emit("teacher:next-question", { pin });
  };

  const skipQuestion = () => {
    const socket = getSocket();
    socket.emit("teacher:skip-question", { pin });
  };

  const replayGame = () => {
    const socket = getSocket();
    socket.emit("teacher:replay-game", { pin });
    setSaveStatus("idle");
  };

  const handleToggleHackMusic = () => {
    const newMuted = toggleHackMusicMuted();
    setHackMusicMuted(newMuted);
    if (newMuted) {
      stopHackMarathonLoop();
    } else if (hackModeRef.current && !getIsMuted()) {
      playHackMarathonLoop();
    }
  };

  const endGame = () => {
    stopHackMarathonLoop();
    const socket = getSocket();
    socket.emit("teacher:end-game", { pin });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const kickPlayer = (playerName: string) => {
    if (!confirm(`${t.teacherGame.kickConfirm} "${playerName}"?`)) return;
    const socket = getSocket();
    socket.emit("teacher:kick-player", { pin, playerName }, (res: any) => {
      if (res?.success) {
        import("@/components/ui/sonner").then(({ toast }) => {
          toast.success(`${t.teacherGame.kickedSuccess}: ${playerName}`);
        });
      }
    });
  };

  const updateTargetClass = (next: string) => {
    setTargetClass(next);
    const socket = getSocket();
    const ar = lang === "ar";
    socket.emit(
      "teacher:set-target-class",
      { pin, targetClass: next || null },
      (res: { success?: boolean; error?: string; targetClass?: string | null }) => {
        import("@/components/ui/sonner").then(({ toast }) => {
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success(
            res?.targetClass
              ? (ar ? `تم تحديد الصف: ${res.targetClass}` : `Class set: ${res.targetClass}`)
              : (ar ? "تم إزالة تحديد الصف" : "Class targeting cleared"),
          );
        });
      },
    );
  };

  const toggleRoomLock = () => {
    const socket = getSocket();
    const newVal = !roomLocked;
    socket.emit("teacher:toggle-room-lock", { pin, locked: newVal }, (res: any) => {
      if (res?.success) setRoomLocked(newVal);
    });
  };

  const toggleTeamLock = (teamName: string) => {
    const socket = getSocket();
    const isLocked = lockedTeams.includes(teamName);
    socket.emit("teacher:toggle-team-lock", { pin, teamName, locked: !isLocked });
  };

  const movePlayer = (playerName: string, teamName: string) => {
    const socket = getSocket();
    socket.emit("teacher:move-player", { pin, playerName, teamName }, (res: any) => {
      if (!res?.success && res?.error) {
        import("@/components/ui/sonner").then(({ toast }) => {
          toast.error(res.error);
        });
      }
    });
  };

  const togglePoints = () => {
    const socket = getSocket();
    const newVal = !pointsEnabled;
    socket.emit("teacher:toggle-points", { pin, enabled: newVal }, (res: any) => {
      if (res?.success) {
        setPointsEnabled(newVal);
      }
    });
  };

  const toggleGifts = () => {
    const socket = getSocket();
    const newVal = !giftsEnabled;
    socket.emit("teacher:toggle-gifts", { pin, enabled: newVal }, (res: any) => {
      if (res?.success) {
        setGiftsEnabled(newVal);
      }
    });
  };

  const toggleHackMode = () => {
    const socket = getSocket();
    const newVal = !hackMode;
    socket.emit("teacher:toggle-hack-mode", { pin, enabled: newVal }, (res: any) => {
      if (res?.success) {
        setHackMode(newVal);
        if (newVal) setGiftsEnabled(false);
      }
    });
  };

  const toggleTts = () => {
    const socket = getSocket();
    const newVal = !ttsEnabled;
    socket.emit("teacher:toggle-tts", { pin, enabled: newVal }, (res: any) => {
      if (res?.success) {
        setTtsEnabled(newVal);
      }
    });
  };

  const addBots = () => {
    const socket = getSocket();
    setIsAddingBots(true);
    socket.emit("teacher:add-bots", { pin, count: botCount }, (res: any) => {
      setIsAddingBots(false);
      if (res?.error) {
        import("@/components/ui/sonner").then(({ toast }) => toast.error(res.error));
      } else {
        import("@/components/ui/sonner").then(({ toast }) => toast.success(t.teacherGame.botsAdded || (lang === "ar" ? "تم إضافة اللاعبين الوهميين" : "Bot players added")));
      }
    });
  };

  const pauseGame = () => {
    const socket = getSocket();
    socket.emit("teacher:pause-game", { pin });
  };

  const resumeGame = () => {
    const socket = getSocket();
    socket.emit("teacher:resume-game", { pin });
  };

  const sendBroadcast = () => {
    const msg = broadcastMessage.trim();
    if (!msg) return;
    const socket = getSocket();
    socket.emit("teacher:broadcast-message", { pin, message: msg });
    sentMsgIdRef.current++;
    setSentMessages(prev => [{ id: sentMsgIdRef.current, text: msg, timestamp: Date.now() }, ...prev].slice(0, 50));
    setBroadcastSent(true);
    setBroadcastMessage("");
    setTimeout(() => setBroadcastSent(false), 2500);
  };

  const copyLink = () => {
    const baseUrl = window.location.origin + import.meta.env.BASE_URL;
    const link = `${baseUrl}game/join/${pin}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      import("@/components/ui/sonner").then(({ toast }) =>
        toast.success(lang === "ar" ? "تم نسخ رابط الانضمام!" : "Join link copied!")
      );
    }).catch(() => {
      import("@/components/ui/sonner").then(({ toast }) =>
        toast.error(lang === "ar" ? "تعذّر نسخ الرابط" : "Could not copy link")
      );
    });
  };

  const teamsByName = currentGameMode === "teams" ? (() => {
    const groups: Record<string, typeof players> = {};
    for (const p of players) {
      const tn = p.teamName || "—";
      if (!groups[tn]) groups[tn] = [];
      groups[tn].push(p);
    }
    return groups;
  })() : {};

  if (hackMarathonActive) {
    const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);
    const totalRemainSec = hackMarathonRemainingMs !== null ? Math.max(0, Math.ceil(hackMarathonRemainingMs / 1000)) : null;
    const mm = totalRemainSec !== null ? Math.floor(totalRemainSec / 60) : null;
    const ss = totalRemainSec !== null ? totalRemainSec % 60 : null;
    const urgent = totalRemainSec !== null && totalRemainSec <= 30;

    return (
      <Layout>
        <div className="min-h-screen bg-black p-4" dir={dir}>
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-green-400 font-mono font-black text-lg tracking-widest">
                  [H4CK_M4R4TH0N]
                </motion.span>
                {totalRemainSec !== null && mm !== null && ss !== null && (
                  <span className={`font-mono font-black text-xl px-4 py-1.5 rounded-full border ${urgent ? "text-red-300 border-red-500 bg-red-950 animate-pulse" : "text-green-300 border-green-700 bg-zinc-950"}`}>
                    ⏱ {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={endGame}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-950/60 text-red-400 border border-red-900 hover:bg-red-950 font-mono transition-colors"
                >
                  {lang === "ar" ? "إنهاء الجلسة" : "END SESSION"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Student Stats Table */}
              <div className="lg:col-span-2 bg-zinc-950 border border-green-900 rounded-2xl p-4">
                <h2 className="text-green-400 font-mono font-black text-sm mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {lang === "ar" ? "إحصائيات الطلاب" : "STUDENT_STATS"}
                  <span className="text-green-800 font-normal">({players.filter(p => !p.isBot).length})</span>
                </h2>
                {players.filter(p => !p.isBot).length === 0 ? (
                  <p className="text-green-900 font-mono text-sm text-center py-8">{lang === "ar" ? "لا يوجد طلاب..." : "NO_AGENTS..."}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="text-green-700 text-xs border-b border-green-900">
                          <th className="text-start pb-2 font-bold">{lang === "ar" ? "الطالب" : "AGENT"}</th>
                          <th className="text-center pb-2 font-bold">✅</th>
                          <th className="text-center pb-2 font-bold">❌</th>
                          <th className="text-center pb-2 font-bold">{lang === "ar" ? "تقدم" : "PROGRESS"}</th>
                          <th className="text-end pb-2 font-bold">🏆</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.filter(p => !p.isBot).map((p) => {
                          const stat = studentStats.get(p.name);
                          const qInCycle = (stat?.personalQuestionIndex ?? 0) + 1;
                          const cycle = stat?.personalCycle ?? 0;
                          const progressLabel = stat
                            ? (cycle > 0 ? `C${cycle + 1}/Q${qInCycle}` : `Q${qInCycle}`)
                            : "—";
                          return (
                            <motion.tr
                              key={p.name}
                              layout
                              className="border-b border-green-950 hover:bg-green-950/20 transition-colors"
                            >
                              <td className="py-2.5 flex items-center gap-2">
                                <AvatarDisplay avatar={p.avatar} size="md" fallback="🧑" />
                                <span className="text-green-200 font-bold">{p.name}</span>
                              </td>
                              <td className="text-center text-green-400 font-black">
                                {stat ? stat.correct : "—"}
                              </td>
                              <td className="text-center text-red-400 font-black">
                                {stat ? stat.wrong : "—"}
                              </td>
                              <td className="text-center">
                                <span className="text-xs text-green-600 border border-green-900 rounded px-1.5 py-0.5 font-mono">{progressLabel}</span>
                              </td>
                              <td className="text-end text-yellow-300 font-black">
                                {stat ? stat.score.toLocaleString() : (p.score > 0 ? p.score.toLocaleString() : "—")}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right column: leaderboard + hack log */}
              <div className="flex flex-col gap-4">
                {/* Live Leaderboard */}
                <div className="bg-zinc-950 border border-green-900 rounded-2xl p-4">
                  <h2 className="text-green-400 font-mono font-black text-sm mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    {lang === "ar" ? "المتصدرون" : "LEADERBOARD"}
                  </h2>
                  {sortedLeaderboard.length === 0 ? (
                    <p className="text-green-900 font-mono text-xs text-center py-4">{lang === "ar" ? "لا يوجد..." : "EMPTY..."}</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedLeaderboard.slice(0, 8).map((entry, idx) => (
                        <motion.div key={entry.name} layout className="flex items-center gap-2">
                          <span className={`text-xs font-black font-mono w-5 text-center ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-amber-600" : "text-green-800"}`}>
                            {idx + 1}
                          </span>
                          <AvatarDisplay avatar={entry.avatar} size="sm" fallback="🧑" />
                          <span className="text-green-200 font-bold text-xs flex-1 truncate">{entry.name}</span>
                          <span className="text-yellow-300 font-black text-xs font-mono">{entry.score.toLocaleString()}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hack Log */}
                <div className="bg-zinc-950 border border-green-900 rounded-2xl p-4 flex-1">
                  <h2 className="text-green-400 font-mono font-black text-sm mb-3 flex items-center gap-2">
                    💀 {lang === "ar" ? "سجل الاختراق" : "HACK_LOG"}
                  </h2>
                  {hackLog.length === 0 ? (
                    <p className="text-green-900 font-mono text-xs text-center py-4">{lang === "ar" ? "لا اختراقات بعد..." : "NO_HACKS_YET..."}</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <AnimatePresence>
                        {hackLog.map((entry) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xs font-mono flex items-center gap-2 py-1 border-b border-green-950"
                          >
                            <span className="text-green-800 shrink-0">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                            </span>
                            <span>{entry.hackerAvatar}</span>
                            <span className="text-green-300 font-bold">{entry.hackerName}</span>
                            <span className="text-green-700">→</span>
                            <span className="text-red-400">{entry.targetName}</span>
                            <span className="text-yellow-400 font-black ms-auto">-{entry.stolenAmount}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "lobby") {
    const isAr = lang === "ar";
    return (
      <WameethWaitingRoomUI
        dir={dir}
        isAr={isAr}
        pin={pin}
        players={players}
        teamNames={teamNames}
        lockedTeams={lockedTeams}
        currentGameMode={currentGameMode}
        autoAdvance={autoAdvance}
        giftsEnabled={giftsEnabled}
        hackMode={hackMode}
        ttsEnabled={ttsEnabled}
        roomLocked={roomLocked}
        targetClass={targetClass}
        targetClassEditing={targetClassEditing}
        botCount={botCount}
        isAddingBots={isAddingBots}
        copied={copied}
        linkCopied={linkCopied}
        hackDurationMin={hackDurationMin}
        hackCustomMin={hackCustomMin}
        broadcastMessage={broadcastMessage}
        broadcastSent={broadcastSent}
        sentMessages={sentMessages}
        t={t}
        onHome={() => { endGame(); setLocation("/teacher"); }}
        onToggleLang={() => setLang(isAr ? "en" : "ar")}
        onEndGame={() => { endGame(); setLocation("/teacher"); }}
        onStartGame={startGame}
        onCopyPin={copyPin}
        onCopyLink={copyLink}
        onSetAutoAdvance={setAutoAdvance}
        onToggleGifts={toggleGifts}
        onToggleHackMode={toggleHackMode}
        onToggleTts={toggleTts}
        onToggleRoomLock={toggleRoomLock}
        onSetTargetClassEditing={setTargetClassEditing}
        onUpdateTargetClass={updateTargetClass}
        onSetBotCount={setBotCount}
        onAddBots={addBots}
        onSetHackDurationMin={setHackDurationMin}
        onSetHackCustomMin={setHackCustomMin}
        onKickPlayer={kickPlayer}
        onToggleTeamLock={toggleTeamLock}
        onMovePlayer={movePlayer}
        onBroadcastMessageChange={setBroadcastMessage}
        onSendBroadcast={sendBroadcast}
        onClearSentMessages={() => setSentMessages([])}
        onRemoveSentMessage={(id) => setSentMessages((prev) => prev.filter((m) => m.id !== id))}
      />
    );
  }


  if (phase === "question") {
    const timerPercent = question ? (timeLeft / question.duration) * 100 : 0;
    const isUrgent = timeLeft <= 5;
    const isDouble = question?.isDoublePoints;

    return (
      <div className="min-h-screen p-3 sm:p-6 overflow-x-hidden" style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }} dir={dir}>
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col gap-3" style={{ background: "rgba(13,33,24,0.55)", border: "1px solid rgba(232,184,75,0.18)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white font-bold text-sm sm:text-base order-1 mr-auto">
                {t.teacherGame.questionOf} {(question?.index ?? 0) + 1} {t.teacherGame.from} {question?.total}
              </span>
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 h-9 rounded-xl order-2">
                <span className="text-white/60 text-xs">{t.teacherGame.gameCode}:</span>
                <span className="text-white font-mono font-black text-sm tracking-wider">{pin}</span>
              </div>
              <div className="order-3"><InlineQR url={`${window.location.origin}${import.meta.env.BASE_URL}game/join/${pin}`} pin={pin} /></div>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 px-3 h-9 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-colors order-4"
              >
                {linkCopied ? <CheckCircle className="w-3.5 h-3.5 text-green-300" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>{linkCopied ? (lang === "ar" ? "تم النسخ!" : "Copied!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <div className={`flex items-center justify-center gap-2 h-10 rounded-xl ${isPaused ? "bg-orange-500/25 border border-orange-400/40" : isUrgent ? "bg-red-500/25 border border-red-400/40" : "bg-white/10 border border-white/20"}`}>
                <Clock className={`w-4 h-4 ${isUrgent ? "text-red-200" : "text-white"}`} />
                <span className={`font-mono font-black text-lg ${isUrgent ? "text-red-100" : "text-white"}`}>{Math.ceil(timeLeft)}</span>
              </div>

              <div className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white/10 border border-white/20">
                <Users className="w-4 h-4 text-blue-300" />
                <span className="text-white font-black text-sm">{answeredCount}/{totalPlayers}</span>
                <span className="text-white/70 text-xs hidden sm:inline">{t.teacherGame.answered}</span>
              </div>

              <button onClick={toggleTts} className={`flex items-center justify-center gap-1.5 h-10 rounded-xl border transition-colors ${ttsEnabled ? "bg-teal-500/25 hover:bg-teal-500/35 border-teal-400/40" : "bg-white/10 hover:bg-white/20 border-white/20"}`}>
                {ttsEnabled ? <ToggleRight className="w-4 h-4 text-teal-200" /> : <ToggleLeft className="w-4 h-4 text-white/80" />}
                <span className={`text-xs font-bold ${ttsEnabled ? "text-teal-100" : "text-white"}`}>{t.teacherGame.ttsToggle}</span>
              </button>

              {autoAdvance ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={isPaused ? resumeGame : pauseGame}
                  className={`flex items-center justify-center gap-1.5 h-10 rounded-xl font-bold text-xs border transition-colors ${isPaused ? "bg-green-500/30 hover:bg-green-500/40 text-green-100 border-green-400/50" : "bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 border-amber-400/40"}`}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  <span>{isPaused ? t.teacherGame.resume : t.teacherGame.pause}</span>
                </motion.button>
              ) : (
                <div className="hidden sm:block" />
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={skipQuestion}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-orange-500/25 hover:bg-orange-500/35 text-orange-100 border border-orange-400/40 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="text-xs font-bold">{lang === "ar" ? "تخطي" : "Skip"}</span>
              </motion.button>
            </div>

            {(isDouble || hackMode) && (
              <div className="flex flex-wrap items-center gap-2">
                {isDouble && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                    className="flex items-center gap-1.5 bg-yellow-500/25 border border-yellow-400/50 px-3 h-9 rounded-xl">
                    <Zap className="w-4 h-4 text-yellow-200" />
                    <span className="text-yellow-100 font-black text-xs">{t.teacherGame.doublePoints}</span>
                  </motion.div>
                )}
                {hackMode && (
                  <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-green-500/25 border border-green-400/50">
                    <span className="text-xs font-black text-green-100">🔐 {lang === "ar" ? "وضع الاختراق" : "Hack Mode"}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-8">
            <motion.div
              className={`h-full rounded-full ${isDouble ? "bg-yellow-500" : isUrgent ? "bg-red-500" : ""}`}
              style={{
                width: `${timerPercent}%`,
                ...(isDouble || isUrgent
                  ? {}
                  : { background: "linear-gradient(90deg, #E8B84B 0%, #C9960C 100%)" }),
              }}
              transition={{ duration: 0.1 }}
            />
          </div>

          <motion.div key={question?.index} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 mb-8">
            <h2 className="text-3xl font-black text-white text-center leading-relaxed">{question?.text}</h2>
            {question?.imageUrl && (
              <div className="flex justify-center mt-4">
                <img src={question.imageUrl} alt="" className="max-h-48 rounded-xl border-2 border-white/20 object-contain" />
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-4">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-bold">{isDouble ? `${(question?.points || 0)} × 2` : question?.points} {t.teacherGame.pointsLabel}</span>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {(question?.questionType === "true_false") ? (
              <>
                <div className="bg-green-500 rounded-2xl p-5 text-white font-bold text-lg text-center">
                  {lang === "ar" ? "صح ✓" : "True ✓"}
                </div>
                <div className="bg-red-500 rounded-2xl p-5 text-white font-bold text-lg text-center">
                  {lang === "ar" ? "خطأ ✗" : "False ✗"}
                </div>
              </>
            ) : (question?.questionType === "fill_blank") ? (
              <div className="col-span-2 bg-gray-700 rounded-2xl p-5 text-white font-bold text-lg text-center">
                {lang === "ar" ? "✏️ إجابة كتابية" : "✏️ Text Answer"}
              </div>
            ) : (
              [
                { key: "A", text: question?.optionA, style: { background: "linear-gradient(160deg, #7A0A0A, #B01414)", boxShadow: "0 6px 24px rgba(176,20,20,0.45)" } },
                { key: "B", text: question?.optionB, style: { background: "linear-gradient(160deg, #08386E, #1260A8)", boxShadow: "0 6px 24px rgba(18,96,168,0.45)" } },
                { key: "C", text: question?.optionC, style: { background: "linear-gradient(160deg, #B8860B, #DAA520)", boxShadow: "0 6px 24px rgba(218,165,32,0.45)" } },
                { key: "D", text: question?.optionD, style: { background: "linear-gradient(160deg, #5A1A8A, #8B35C8)", boxShadow: "0 6px 24px rgba(139,53,200,0.45)" } },
              ].filter((o) => o.text).map((opt) => (
                <div key={opt.key} style={opt.style as React.CSSProperties} className="rounded-2xl p-5 text-white font-bold text-lg text-center">
                  <span className={`opacity-60 ${lang === "ar" ? "ml-2" : "mr-2"}`}>{opt.key})</span>
                  {opt.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gift-round") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }} dir={dir}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-8xl mb-4">🎁</motion.div>
          <h2 className="text-4xl font-black text-white mb-3">جولة المفاجآت!</h2>
          <p className="text-white/60 font-bold text-xl">الطلاب يختارون قواهم الخاصة...</p>
        </motion.div>
      </div>
    );
  }

  if (phase === "leaderboard") {
    const maxDist = Math.max(...Object.values(distribution), 1);
    const qType = question?.questionType || "mcq";
    const distColors: Record<string, string> = qType === "true_false"
      ? { true: "bg-green-500", false: "bg-red-500" }
      : { A: "bg-red-500", B: "bg-blue-500", C: "bg-yellow-500", D: "bg-green-500" };
    const distKeys = qType === "true_false"
      ? ["true", "false"]
      : qType === "fill_blank"
        ? Object.keys(distribution)
        : ["A", "B", "C", "D"];
    const distKeyLabels: Record<string, string> = qType === "true_false"
      ? { true: lang === "ar" ? "صح" : "True", false: lang === "ar" ? "خطأ" : "False" }
      : {};

    return (
      <Layout noHeader>
        <div
          className={`min-h-screen overflow-x-hidden ${hackMode ? "bg-black" : ""}`}
          style={hackMode ? undefined : { background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }}
        >
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
          {hackMode && (
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              className="text-center font-mono text-green-500 text-xs mb-4 tracking-widest">
              ══ HACK_RESULTS ══ ROUND_COMPLETE ══ SCORES_UPDATED ══
            </motion.div>
          )}
          <div className="rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col gap-3" style={hackMode ? { background: "rgba(0,0,0,0.6)", border: "1px solid rgba(34,197,94,0.3)" } : { background: "rgba(13,33,24,0.55)", border: "1px solid rgba(232,184,75,0.18)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border ${hackMode ? "bg-black border-green-800" : "bg-white/10 border-white/20"}`}>
                <span className={`text-xs font-bold ${hackMode ? "text-green-700 font-mono" : "text-white/60"}`}>{hackMode ? "PIN:" : `${t.teacherGame.gameCode}:`}</span>
                <span className={`font-mono font-black text-sm tracking-wider ${hackMode ? "text-green-400" : "text-white"}`}>{pin}</span>
              </div>
              <InlineQR
                url={`${window.location.origin}${import.meta.env.BASE_URL}game/join/${pin}`}
                pin={pin}
              />
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 px-3 h-9 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {linkCopied ? <CheckCircle className="w-3.5 h-3.5 text-green-300" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>{linkCopied ? (lang === "ar" ? "تم النسخ!" : "Copied!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}</span>
              </button>
              {hackMode && (
                <div className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold bg-green-500/25 text-green-100 border border-green-400/40">
                  🔐 {lang === "ar" ? "وضع الاختراق" : "Hack Mode"}
                </div>
              )}
            </div>

            <div className={`grid gap-2 ${autoAdvance ? "grid-cols-2 sm:grid-cols-4" : hackMode ? "grid-cols-2" : "grid-cols-2"}`}>
              {autoAdvance ? (
                <>
                  {!isPaused ? (
                    <div className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs px-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                        <Clock className="w-4 h-4" />
                      </motion.div>
                      <span className="truncate">{t.teacherGame.autoNext}</span>
                    </div>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={nextQ}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-black text-xs shadow-lg active:scale-95 transition-transform px-2"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span className="truncate">{lang === "ar" ? "تقدم الآن" : "Advance Now"}</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={isPaused ? resumeGame : pauseGame}
                    className={`flex items-center justify-center gap-1.5 h-11 rounded-xl font-bold text-xs px-2 transition-colors ${isPaused ? "bg-green-500/30 text-green-100 border border-green-400/50" : "bg-amber-500/25 text-amber-100 border border-amber-400/40"}`}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    <span className="truncate">{isPaused ? t.teacherGame.resume : t.teacherGame.pause}</span>
                  </motion.button>
                  <button onClick={endGame} className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30 font-bold text-xs px-2 transition-colors">
                    <StopCircle className="w-4 h-4" />
                    <span className="truncate">{t.teacherGame.endGame}</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={nextQ} className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-black text-sm shadow-lg active:scale-95 transition-transform px-2">
                    <SkipForward className="w-4 h-4" />
                    <span className="truncate">{t.teacherGame.nextQuestion}</span>
                  </button>
                  <button onClick={endGame} className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30 font-bold text-sm px-2 transition-colors">
                    <StopCircle className="w-4 h-4" />
                    <span className="truncate">{t.teacherGame.endGame}</span>
                  </button>
                </>
              )}
            </div>

            {hackMode && (
              <button
                onClick={handleToggleHackMusic}
                className={`flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-colors ${hackMusicMuted ? "bg-white/10 text-white/80 border border-white/20" : "bg-green-500/25 text-green-100 border border-green-400/40"}`}
                title={hackMusicMuted ? (lang === "ar" ? "تشغيل الموسيقى" : "Unmute music") : (lang === "ar" ? "كتم الموسيقى" : "Mute music")}
              >
                {hackMusicMuted ? "🔇" : "🎵"}
                <span>{hackMusicMuted ? (lang === "ar" ? "تشغيل الموسيقى" : "Unmute music") : (lang === "ar" ? "كتم الموسيقى" : "Mute music")}</span>
              </button>
            )}
          </div>
          <div className="mb-8">
            <h2 className={`text-2xl font-bold flex items-center gap-2 mb-4 ${hackMode ? "text-green-400 font-mono" : "text-white"}`}>
              {hackMode ? <span className="text-green-500 text-lg">▶</span> : <Trophy className="w-6 h-6 text-yellow-400" />}
              {hackMode ? "AGENT_RANKING" : t.teacherGame.raceTrack}
            </h2>
            <RaceTrack players={leaderboard} hackMode={hackMode} />
          </div>

          {currentGameMode === "teams" && teamLeaderboard.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
                <UsersRound className="w-6 h-6 text-amber-400" />
                {t.teacherGame.teamRanking}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamLeaderboard.map((team, i) => (
                  <motion.div key={team.teamName} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className={`p-5 ${i === 0 ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                        <span className="font-black text-lg flex-1">{team.teamName}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{team.members} {t.teacherGame.teamMembers}</span>
                        <span className="font-black text-primary text-xl">{team.totalScore}</span>
                      </div>
                      {team.adjustment !== 0 && (
                        <div className={`text-xs mt-1 font-bold ${team.adjustment > 0 ? "text-green-600" : "text-red-500"}`}>
                          {team.adjustment > 0 ? `+${team.adjustment}` : team.adjustment} {t.teacherGame.teamBonus || "نقاط إضافية"}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">{t.teacherGame.teamAvgScore}: {team.avgScore}</div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* RIGHT column in RTL: answer distribution (normal) OR hack log (hack mode) */}
            <div>
              {hackMode ? (
                <>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-3 text-green-400 font-mono">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>⚡</motion.span>
                    HACK_LOG
                    {hackLog.length > 0 && <span className="text-xs text-green-700 font-mono">{hackLog.length} EVENTS</span>}
                  </h2>
                  <div
                    className="rounded-xl overflow-hidden h-full min-h-[200px]"
                    style={{ background: "#000", border: "1px solid #00ff4120", boxShadow: "0 0 30px #00ff4106" }}
                  >
                    <div className="px-4 py-2 border-b border-green-900/50 flex items-center gap-2">
                      <motion.div className="w-2 h-2 rounded-full bg-green-500" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                      <span className="text-xs font-mono text-green-600 tracking-widest">LIVE INTRUSION MONITOR</span>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-80 overflow-y-auto">
                      {hackLog.length === 0 ? (
                        <motion.p animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
                          className="text-center text-green-900 font-mono text-xs py-6">
                          AWAITING_INTRUSION_EVENTS...
                        </motion.p>
                      ) : (
                        <AnimatePresence initial={false}>
                          {hackLog.map((entry) => (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm"
                              style={{ background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.10)" }}
                            >
                              <span className="text-green-800 text-xs shrink-0">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                              </span>
                              <span className="text-base leading-none shrink-0">{entry.hackerAvatar || "💻"}</span>
                              <span className="text-green-400 font-black truncate">{entry.hackerName}</span>
                              <span className="text-green-800 text-xs shrink-0 mx-0.5">اخترق</span>
                              <span className="text-red-500 font-black truncate">{entry.targetName}</span>
                              <span className="text-green-300 font-black shrink-0 mr-auto">+{entry.stolenAmount}</span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                    <div className="px-3 pb-3 pt-2 border-t border-green-900/50">
                      <p className="text-green-800 font-mono text-xs mb-2 tracking-widest">
                        📡 {lang === "ar" ? "إرسال رسالة للجميع" : "BROADCAST_TRANSMISSION"}
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={broadcastMessage}
                          onChange={e => setBroadcastMessage(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && sendBroadcast()}
                          placeholder={lang === "ar" ? "اكتب تلميحاً أو رسالة للطلاب..." : "Type a hint or message to all students..."}
                          className="flex-1 px-3 py-2 bg-zinc-950 border border-green-900 rounded-lg text-green-300 font-mono text-xs focus:outline-none focus:border-green-500 placeholder:text-green-900 min-w-0"
                        />
                        <button
                          onClick={sendBroadcast}
                          disabled={!broadcastMessage.trim()}
                          className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono font-black text-xs rounded-lg transition-colors shrink-0"
                        >
                          {broadcastSent
                            ? (lang === "ar" ? "✓ أُرسل" : "✓ SENT")
                            : (lang === "ar" ? "بث للجميع" : "BROADCAST")}
                        </button>
                      </div>
                      {sentMessages.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-green-900 font-mono text-xs tracking-widest">
                              📜 {lang === "ar" ? "سجل الرسائل المُرسلة" : "SENT_LOG"}
                              <span className="text-green-900/60 ml-1">({sentMessages.length})</span>
                            </p>
                            <button
                              onClick={() => setSentMessages([])}
                              className="text-green-900/70 hover:text-red-400 font-mono text-xs transition-colors px-1.5 py-0.5 rounded hover:bg-red-400/10"
                              title={lang === "ar" ? "مسح السجل" : "Clear log"}
                            >
                              {lang === "ar" ? "✕ مسح" : "✕ CLEAR"}
                            </button>
                          </div>
                          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                            <AnimatePresence initial={false}>
                              {sentMessages.map(msg => (
                                <motion.div
                                  key={msg.id}
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="group flex items-start gap-2 px-2 py-1 rounded font-mono text-xs"
                                  style={{ background: "rgba(0,255,65,0.03)", border: "1px solid rgba(0,255,65,0.08)" }}
                                >
                                  <span className="text-green-900 shrink-0 mt-px">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                                  </span>
                                  <span className="text-green-400 break-all flex-1">{msg.text}</span>
                                  <button
                                    onClick={() => setSentMessages(prev => prev.filter(m => m.id !== msg.id))}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-green-900 hover:text-red-400 transition-all leading-none mt-px"
                                    title={lang === "ar" ? "حذف الرسالة" : "Delete message"}
                                  >
                                    ×
                                  </button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold flex items-center gap-2 mb-4 text-white">
                    <BarChart3 className="w-6 h-6 text-yellow-400" />
                    {t.teacherGame.answerDistribution}
                  </h2>
                  <div className="rounded-2xl p-6 border border-white/10" style={{ background: "rgba(13,33,24,0.55)" }}>
                    {correctAnswer && (
                      <p className="text-center mb-4 font-bold text-white">
                        {t.teacherGame.correctAnswerIs} <span className="text-green-300 text-lg">{correctAnswer}</span>
                      </p>
                    )}
                    <div className="space-y-3">
                      {distKeys.map((key) => {
                        const label = distKeyLabels[key] || key;
                        const color = distColors[key] || "bg-amber-500";
                        const isCorrect = correctAnswer && key.toLowerCase() === correctAnswer.toLowerCase();
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className={`min-w-8 h-8 px-2 rounded-lg flex items-center justify-center text-white font-bold text-sm ${color}`}>{label}</span>
                            <div className="flex-1 h-8 bg-white/10 rounded-lg overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${((distribution[key] || 0) / maxDist) * 100}%` }}
                                className={`h-full ${color} ${isCorrect ? "opacity-100" : "opacity-40"} flex items-center justify-end px-2`}>
                                <span className="text-white font-bold text-xs">{distribution[key] || 0}</span>
                              </motion.div>
                            </div>
                            {isCorrect && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div>
              <h2 className={`text-xl font-bold flex items-center gap-2 mb-3 ${hackMode ? "text-green-400 font-mono" : "text-white"}`}>
                {hackMode ? <span className="text-green-500">[</span> : <Trophy className="w-6 h-6 text-yellow-400" />}
                {hackMode ? "LEADERBOARD" : t.teacherGame.playerRanking}
                {hackMode && <span className="text-green-500">]</span>}
              </h2>
              {hackMode ? (
                <div className="bg-black border border-green-900 rounded-xl p-3 font-mono space-y-1.5">
                  {leaderboard.slice(0, 10).map((entry, i) => {
                    const qInCycle = (entry.personalQuestionIndex ?? 0) + 1;
                    const cycle = entry.personalCycle ?? 0;
                    const progressLabel = entry.personalAnsweredCount !== undefined
                      ? (cycle > 0 ? `C${cycle + 1}/Q${qInCycle}` : `Q${qInCycle}`)
                      : "—";
                    return (
                    <motion.div key={entry.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm
                        ${i === 0 ? "border-green-500 bg-green-950/50 text-green-200" : i < 3 ? "border-green-900 bg-green-950/20 text-green-600" : "border-transparent bg-transparent text-green-800"}`}>
                      <span className="w-7 text-center font-black text-green-500 text-xs">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 truncate">{entry.name}</span>
                      {entry.teamName && <span className="text-xs text-green-700">[{entry.teamName}]</span>}
                      <span className="text-xs text-green-700 border border-green-900 rounded px-1.5 py-0.5 shrink-0">{progressLabel}</span>
                      {entry.lastAnswer?.correct
                        ? <span className="text-green-400 text-xs">+{entry.lastAnswer.points}</span>
                        : entry.lastAnswer && <span className="text-red-700 text-xs">✗</span>}
                      <span className={`font-black ${i === 0 ? "text-green-300 text-base" : "text-green-700 text-sm"}`}>{entry.score}</span>
                    </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl p-4 border border-white/10" style={{ background: "rgba(13,33,24,0.55)" }}>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 10).map((entry, i) => (
                      <motion.div key={entry.name} initial={{ opacity: 0, x: lang === "ar" ? 30 : -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <span className="w-8 h-8 rounded-full bg-yellow-400/15 text-yellow-200 flex items-center justify-center font-black text-sm shrink-0">
                          {i === 0 ? <Crown className="w-5 h-5 text-yellow-400" /> : i === 1 ? <Medal className="w-5 h-5 text-gray-300" /> : i === 2 ? <Award className="w-5 h-5 text-amber-500" /> : i + 1}
                        </span>
                        <AvatarDisplay avatar={entry.avatar} size="xl" />
                        <span className="font-bold flex-1 truncate text-white">{entry.name}</span>
                        {entry.teamName && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-bold shrink-0">{entry.teamName}</span>}
                        {entry.lastAnswer && (
                          entry.lastAnswer.correct
                            ? <span className="text-green-300 text-sm font-bold">+{entry.lastAnswer.points}</span>
                            : <XCircle className="w-4 h-4 text-red-300" />
                        )}
                        <span className="font-black text-yellow-300 text-lg">{entry.score}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Answer distribution moved to bottom in hack mode, with hacker styling */}
          {hackMode && (
            <div className="mt-8">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-green-400 font-mono">
                <BarChart3 className="w-5 h-5 text-green-500" />
                ANSWER_DISTRIBUTION
              </h2>
              <div
                className="rounded-xl p-5"
                style={{ background: "#000", border: "1px solid #00ff4115", boxShadow: "0 0 20px #00ff4105" }}
              >
                {correctAnswer && (
                  <p className="text-center mb-4 font-mono text-sm text-green-600">
                    CORRECT_KEY: <span className="text-green-300 font-black text-lg">{correctAnswer}</span>
                  </p>
                )}
                <div className="space-y-3">
                  {distKeys.map((key) => {
                    const label = distKeyLabels[key] || key;
                    const isCorrect = correctAnswer && key.toLowerCase() === correctAnswer.toLowerCase();
                    const count = distribution[key] || 0;
                    const pct = maxDist > 0 ? (count / maxDist) * 100 : 0;
                    return (
                      <div key={key} className="flex items-center gap-3 font-mono">
                        <span className={`min-w-8 h-8 px-2 rounded-lg flex items-center justify-center font-black text-sm border ${isCorrect ? "border-green-500 text-green-300 bg-green-950/50" : "border-green-900 text-green-800 bg-transparent"}`}>
                          {label}
                        </span>
                        <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ background: "rgba(0,255,65,0.04)", border: "1px solid rgba(0,255,65,0.08)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            className="h-full flex items-center justify-end px-2"
                            style={{ background: isCorrect ? "rgba(0,255,65,0.35)" : "rgba(0,255,65,0.10)" }}
                          >
                            <span className="text-green-300 font-bold text-xs">{count}</span>
                          </motion.div>
                        </div>
                        {isCorrect && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {giftEvents.length > 0 && !hackMode && (
            <div className="mt-8">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Gift className="w-6 h-6 text-yellow-500" />
                {t.teacherGame.giftEvents}
              </h2>
              <Card className="p-4">
                <div className="space-y-2">
                  {giftEvents.map((evt) => (
                    <motion.div key={evt.id} initial={{ opacity: 0, x: lang === "ar" ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <span className="text-xl">{evt.playerAvatar}</span>
                      <span className="font-bold text-sm flex-1">{evt.message}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 font-bold">
                        {evt.giftType === "freeze" ? "🥶" : evt.giftType === "mystery" ? "🎲" : evt.giftType === "shield" ? "🛡️" : evt.giftType === "steal" ? "💰" : "🎁"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>
          )}

        </div>
        </div>
      </Layout>
    );
  }

  if (phase === "finished") {
    const top3 = leaderboard.slice(0, 3);
    const winner = top3[0];
    const second = top3[1];
    const third = top3[2];
    const winningTeam = teamLeaderboard.length > 0 ? teamLeaderboard[0] : null;

    return (
      <div className="min-h-screen p-4 sm:p-8" style={{ background: "linear-gradient(160deg, #0D2118 0%, #1A3A28 50%, #0F2A1C 100%)" }} dir={dir}>
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div key={`confetti-${i}`}
              initial={{ y: -20, x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 500), opacity: 1 }}
              animate={{ y: (typeof window !== "undefined" ? window.innerHeight : 800) + 20, opacity: 0, rotate: Math.random() * 720 }}
              transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
              className="absolute w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a", "#d946ef", "#a855f7"][i % 6] }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, burstIdx) => {
            const cx = 15 + Math.random() * 70;
            const cy = 10 + Math.random() * 50;
            const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
            return Array.from({ length: 12 }).map((_, j) => {
              const angle = (j / 12) * Math.PI * 2;
              const dist = 80 + Math.random() * 100;
              return (
                <motion.div key={`fw-${burstIdx}-${j}`}
                  initial={{ x: `${cx}%`, y: `${cy}%`, scale: 0, opacity: 1 }}
                  animate={{ x: `calc(${cx}% + ${Math.cos(angle) * dist}px)`, y: `calc(${cy}% + ${Math.sin(angle) * dist}px)`, scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.2, delay: burstIdx * 0.5 + 0.5, repeat: Infinity, repeatDelay: 3 + Math.random() * 2 }}
                  className="absolute w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors[(burstIdx + j) % colors.length], boxShadow: `0 0 8px ${colors[(burstIdx + j) % colors.length]}` }}
                />
              );
            });
          })}
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div key={`glow-${i}`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 0.6, 0], scale: [0, 1, 0] }}
              transition={{ duration: 1.5, delay: i * 0.7 + 0.3, repeat: Infinity, repeatDelay: 3 }}
              className="absolute rounded-full"
              style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 50}%`, width: 150, height: 150,
                background: `radial-gradient(circle, ${["rgba(251,191,36,0.4)", "rgba(236,72,153,0.4)", "rgba(139,92,246,0.4)", "rgba(16,185,129,0.4)", "rgba(59,130,246,0.4)"][i]} 0%, transparent 70%)` }}
            />
          ))}
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <motion.div animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
            </motion.div>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">{t.teacherGame.finalResults}</h1>
            <p className="text-amber-300 text-lg">{leaderboard.length} {t.teacherGame.playersParticipated}</p>
          </motion.div>

          {currentGameMode === "teams" && winningTeam && (() => {
            const teamFirst = teamLeaderboard[0];
            const teamSecond = teamLeaderboard[1];
            const teamThird = teamLeaderboard[2];
            return (
              <>
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                  className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/50 rounded-2xl p-6 mb-6 text-center">
                  <h2 className="text-2xl font-black text-yellow-400 mb-2">🏆 {t.teacherGame.winningTeam}</h2>
                  <p className="text-4xl sm:text-5xl font-black text-white mb-1">{winningTeam.teamName}</p>
                  <p className="text-yellow-300 font-bold">{winningTeam.totalScore} {t.teacherGame.pointsLabel} • {winningTeam.members} {t.teacherGame.teamMembers}</p>
                </motion.div>

                <div className="flex items-end justify-center gap-3 sm:gap-6 mb-10 max-w-2xl mx-auto">
                  {teamSecond && (
                    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, type: "spring", bounce: 0.4 }} className="flex flex-col items-center flex-1">
                      <span className="text-white font-black text-base sm:text-lg mb-1 max-w-full truncate text-center" title={teamSecond.teamName}>{teamSecond.teamName}</span>
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
                      <span className="text-white font-black text-lg sm:text-xl mb-0.5 max-w-full truncate text-center" title={teamFirst.teamName}>{teamFirst.teamName}</span>
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
                      <span className="text-white font-black text-base sm:text-lg mb-1 max-w-full truncate text-center" title={teamThird.teamName}>{teamThird.teamName}</span>
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
                        <div key={team.teamName} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
                          <span className="text-white/60 font-black w-6 text-center">{i + 4}</span>
                          <span className="flex-1 font-bold text-white truncate">{team.teamName}</span>
                          <span className="text-yellow-400 font-black">{team.totalScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {currentGameMode !== "teams" && top3.length > 0 && (
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
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className={`absolute -top-4 ${lang === "ar" ? "-left-3" : "-right-3"}`}>
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
              <h2 className="text-xl font-bold text-white mb-4">{t.teacherGame.allPlayers} ({leaderboard.length})</h2>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <motion.div key={entry.name} initial={{ opacity: 0, x: lang === "ar" ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2 + i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${i < 3 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5"}`}>
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-sm text-white/70 shrink-0">
                      {i === 0 ? <Crown className="w-5 h-5 text-yellow-400" /> : i === 1 ? <Medal className="w-5 h-5 text-gray-300" /> : i === 2 ? <Award className="w-5 h-5 text-amber-500" /> : i + 1}
                    </span>
                    <AvatarDisplay avatar={entry.avatar} size="xl" />
                    <span className="font-bold flex-1 text-white/80 truncate">{entry.name}</span>
                    {entry.teamName && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 font-bold">{entry.teamName}</span>}
                    <span className="font-black text-yellow-400">{entry.score}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => {
                if (saveStatus === "saved") return;
                setSaveStatus("saving");
                const BASE = import.meta.env.VITE_API_URL || "";
                fetch(`${BASE}/api/game-history/save/${pin}`, { method: "POST", credentials: "include" })
                  .then(r => r.json())
                  .then(data => {
                    if (data.success) {
                      setSaveStatus("saved");
                      import("@/components/ui/sonner").then(({ toast }) =>
                        toast.success(data.message === "already_saved"
                          ? (lang === "ar" ? "النتائج محفوظة مسبقاً" : "Results already saved")
                          : (lang === "ar" ? "تم حفظ النتائج بنجاح" : "Results saved successfully")));
                    } else {
                      setSaveStatus("error");
                      import("@/components/ui/sonner").then(({ toast }) => toast.error(lang === "ar" ? "فشل حفظ النتائج" : "Failed to save results"));
                    }
                  })
                  .catch(() => {
                    setSaveStatus("error");
                    import("@/components/ui/sonner").then(({ toast }) => toast.error(lang === "ar" ? "فشل حفظ النتائج" : "Failed to save results"));
                  });
              }}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
              className={`px-8 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 transition-colors ${saveStatus === "saved" ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" : saveStatus === "saving" ? "bg-white/20 text-white/70" : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"} disabled:cursor-not-allowed`}>
              {saveStatus === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : saveStatus === "saved" ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {saveStatus === "saved" ? (lang === "ar" ? "تم الحفظ ✓" : "Saved ✓") : saveStatus === "saving" ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ النتائج" : "Save Results")}
            </button>
            <button onClick={replayGame}
              className="px-8 py-3 bg-gradient-to-r from-teal-500 to-green-500 text-white rounded-xl font-black hover:from-teal-600 hover:to-green-600 transition-colors shadow-lg">
              🔄 {lang === "ar" ? "العب مرة أخرى" : "Play Again"}
            </button>
            <button onClick={() => setLocation("/teacher")} className="px-8 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/20 transition-colors border border-white/20">
              {t.teacherGame.backToDashboard}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}
