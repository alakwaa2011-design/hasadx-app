import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, ArrowRight, ArrowLeft, Play, Pause, SkipForward,
  Users, Timer, Shield, Shuffle, Zap, Check, X, Crown,
  Snowflake, Share2, Volume2, VolumeX, Star, Phone, Vote,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { useTeamGameAudio } from "./useTeamGameAudio";
import { HarvestCoin } from "@/components/harvest-coin";
import { ConfettiBurst } from "@/components/confetti-burst";
import { QRCodeSVG } from "qrcode.react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const SAFE_HAVEN_LEVELS = new Set([4, 9]);

type OptionKey = "A" | "B" | "C" | "D";
type TeamId = "A" | "B";
type GameStatus = "waiting" | "playing" | "revealing" | "finished";

interface Player {
  name: string;
  team: TeamId;
  connected: boolean;
  correctCount: number;
  wrongCount: number;
}
interface Question {
  id: number; text: string;
  optionA: string; optionB: string; optionC: string; optionD: string;
  imageUrl: string | null;
}
interface TeamResult {
  answer: OptionKey | null; correct: boolean;
  prizeLevel: number; points: number; prize: number; speedBonus: boolean;
}
interface VoteCounts { A: number; B: number; C: number; D: number; }
interface VoteUpdate {
  teamA: VoteCounts; teamB: VoteCounts;
  teamASize: number; teamBSize: number;
  majority: {
    A: { option: OptionKey | null; reachedAtSec: number | null };
    B: { option: OptionKey | null; reachedAtSec: number | null };
  };
  frozenTeam: TeamId | null;
}
interface TeamLifelines { fifty: boolean; swap: boolean; freeze: boolean; takePrize: boolean; callFriend: boolean; }
interface LifelinesUsed { A: TeamLifelines; B: TeamLifelines; }
interface RevealData {
  correctAnswer: OptionKey;
  teamA: TeamResult; teamB: TeamResult;
  eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
  frozenTeam: TeamId | null;
  isLastQuestion: boolean;
}
interface GameOverData {
  winner: "A" | "B" | "draw";
  teamNames: { A: string; B: string };
  teamA: { points: number; prizeLevel: number; prize: number };
  teamB: { points: number; prizeLevel: number; prize: number };
  players: Player[];
}

function formatPrize(n: number) { return n.toLocaleString("en-US"); }

const HOST_TOKEN_KEY = "millionTeamHostToken";

export default function MillionTeamHost() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const params = useParams<{ pin: string }>();
  const pin = params.pin;
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const audio = useTeamGameAudio();

  const [status, setStatus] = useState<GameStatus>("waiting");
  const [players, setPlayers] = useState<Player[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(15);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);
  const [eliminatedOptions, setEliminatedOptions] = useState<{ A: OptionKey[]; B: OptionKey[] }>({ A: [], B: [] });
  const [lifelinesUsed, setLifelinesUsed] = useState<LifelinesUsed>({
    A: { fifty: false, swap: false, freeze: false, takePrize: false, callFriend: false },
    B: { fifty: false, swap: false, freeze: false, takePrize: false, callFriend: false },
  });
  const [callFriendLoading, setCallFriendLoading] = useState<TeamId | null>(null);
  const [lifelineVoteActive, setLifelineVoteActive] = useState<TeamId | null>(null);
  const [lifelineVoteResult, setLifelineVoteResult] = useState<{ team: TeamId; winner: string; counts: Record<string, number> } | null>(null);
  const [voteUpdate, setVoteUpdate] = useState<VoteUpdate | null>(null);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [prizeLevels, setPrizeLevels] = useState({ A: -1, B: -1 });
  const [points, setPoints] = useState({ A: 0, B: 0 });
  const [swappingTeam, setSwappingTeam] = useState<TeamId | null>(null);
  const [teamNames, setTeamNames] = useState({ A: lang === "ar" ? "الفريق أ" : "Team A", B: lang === "ar" ? "الفريق ب" : "Team B" });
  const [frozenTeam, setFrozenTeam] = useState<TeamId | null>(null);
  const [pendingFreezeTeam, setPendingFreezeTeam] = useState<TeamId | null>(null);
  const [renameInput, setRenameInput] = useState({ A: "", B: "" });
  const [showRename, setShowRename] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useSearch();
  const socketRef = useRef(getSocket());
  const prevTimerRef = useRef(30);
  const tickingRef = useRef(false);
  const handleSwapRef = useRef<(team: TeamId) => Promise<void>>(async () => {});
  const handleCallFriendRef = useRef<(team: TeamId) => Promise<void>>(async () => {});

  const resolvedToken = (() => {
    const urlToken = new URLSearchParams(search).get("token");
    if (urlToken) {
      try { sessionStorage.setItem(`${HOST_TOKEN_KEY}:${pin}`, urlToken); } catch { /* ignore */ }
      return urlToken;
    }
    return sessionStorage.getItem(`${HOST_TOKEN_KEY}:${pin}`) || "";
  })();
  const hostToken = useRef<string>(resolvedToken);

  const teamACount = players.filter(p => p.team === "A").length;
  const teamBCount = players.filter(p => p.team === "B").length;
  const teamAConnected = players.filter(p => p.team === "A" && p.connected).length;
  const teamBConnected = players.filter(p => p.team === "B" && p.connected).length;

  useEffect(() => {
    const socket = socketRef.current;

    function doRejoinHost() {
      socket.emit("million-team:rejoin-host", { pin, hostToken: hostToken.current }, (res: { success?: boolean; error?: string }) => {
        if (res.error && res.error !== "الغرفة غير موجودة") {
          toast.error(res.error);
        }
      });
    }

    doRejoinHost();
    socket.on("connect", doRejoinHost);

    socket.on("million-team:state-sync", (data: {
      players: Player[];
      status: GameStatus;
      currentIndex: number;
      prizeLevels: { A: number; B: number };
      points: { A: number; B: number };
      lifelinesUsed: LifelinesUsed;
      teamNames: { A: string; B: string };
      question: Question | null;
      totalQuestions: number;
      timerSeconds: number;
      paused: boolean;
      eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
      frozenTeam: TeamId | null;
      lastRevealData: RevealData | null;
    }) => {
      setPlayers(data.players);
      setStatus(data.status);
      setQuestionIndex(data.currentIndex);
      setPrizeLevels(data.prizeLevels);
      setPoints(data.points);
      setLifelinesUsed(data.lifelinesUsed);
      if (data.teamNames) setTeamNames(data.teamNames);
      setQuestion(data.question);
      setTotalQuestions(data.totalQuestions);
      setTimerSeconds(data.timerSeconds);
      setTimerPaused(data.paused);
      setEliminatedOptions(data.eliminatedOptions ?? { A: [], B: [] });
      setFrozenTeam(data.frozenTeam ?? null);
      if (data.status === "revealing" && data.lastRevealData) {
        setRevealData(data.lastRevealData);
      }
      if (data.status === "playing") audio.startBg();
    });

    socket.on("million-team:players-updated", (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("million-team:next-question", (data: {
      question: Question;
      questionIndex: number;
      totalQuestions: number;
      prizeLevels: { A: number; B: number };
      points: { A: number; B: number };
      lifelinesUsed: LifelinesUsed;
      teamNames: { A: string; B: string };
      frozenTeam?: TeamId | null;
    }) => {
      setStatus("playing");
      setQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setPrizeLevels(data.prizeLevels);
      setPoints(data.points);
      setLifelinesUsed(data.lifelinesUsed);
      if (data.teamNames) setTeamNames(data.teamNames);
      setEliminatedOptions({ A: [], B: [] });
      setFrozenTeam(data.frozenTeam ?? null);
      setPendingFreezeTeam(null);
      setVoteUpdate(null);
      setRevealData(null);
      setLifelineVoteActive(null);
      setLifelineVoteResult(null);
      audio.startBg();
    });

    socket.on("million-team:timer", (data: { seconds: number; paused: boolean }) => {
      setTimerSeconds(data.seconds);
      setTimerPaused(data.paused);
    });

    socket.on("million-team:vote-update", (data: VoteUpdate) => {
      setVoteUpdate(data);
      if (data.frozenTeam !== undefined) setFrozenTeam(data.frozenTeam);
      audio.playVote();
    });

    socket.on("million-team:question-revealed", (data: RevealData) => {
      setStatus("revealing");
      setRevealData(data);
      setPrizeLevels({ A: data.teamA.prizeLevel, B: data.teamB.prizeLevel });
      setPoints({ A: data.teamA.points, B: data.teamB.points });
      setEliminatedOptions(data.eliminatedOptions);
      setFrozenTeam(null);
      audio.stopBg();
      if (data.teamA.correct || data.teamB.correct) {
        audio.playCorrect();
      } else {
        audio.playWrong();
      }
    });

    socket.on("million-team:lifeline-fifty-applied", (data: { team: TeamId; eliminatedOptions: { A: OptionKey[]; B: OptionKey[] }; lifelinesUsed: LifelinesUsed }) => {
      setEliminatedOptions(data.eliminatedOptions);
      setLifelinesUsed(data.lifelinesUsed);
      audio.playFiftyFifty();
    });

    socket.on("million-team:question-swapped", (data: { team: TeamId; question: Question; eliminatedOptions: { A: OptionKey[]; B: OptionKey[] }; lifelinesUsed: LifelinesUsed }) => {
      setQuestion(data.question);
      setEliminatedOptions(data.eliminatedOptions);
      setLifelinesUsed(data.lifelinesUsed);
      setVoteUpdate(null);
      setSwappingTeam(null);
      audio.playLifeline();
    });

    socket.on("million-team:lifeline-freeze-applied", (data: { pendingFreezeTeam?: TeamId; frozenTeam?: TeamId; lifelinesUsed: LifelinesUsed }) => {
      setLifelinesUsed(data.lifelinesUsed);
      const target = data.pendingFreezeTeam ?? data.frozenTeam;
      if (target) {
        setPendingFreezeTeam(target);
        audio.playLifeline();
        const tName = target === "A" ? teamNames.A : teamNames.B;
        toast.info(lang === "ar" ? `🧊 ${tName} سيُجمّد في السؤال القادم!` : `🧊 ${tName} will be frozen next round!`);
      }
    });

    socket.on("million-team:lifeline-take-prize-applied", (data: { team: TeamId; claimedPrize: number; lifelinesUsed: LifelinesUsed; points: { A: number; B: number } }) => {
      setLifelinesUsed(data.lifelinesUsed);
      setPoints(data.points);
      audio.playLifeline();
      toast.success(lang === "ar" ? `💰 ${data.team === "A" ? teamNames.A : teamNames.B} أخذ جائزة ${formatPrize(data.claimedPrize)}!` : `💰 Team ${data.team === "A" ? teamNames.A : teamNames.B} claimed ${formatPrize(data.claimedPrize)} prize!`);
    });

    socket.on("million-team:game-over", (data: GameOverData) => {
      setStatus("finished");
      setGameOver(data);
      if (data.teamNames) setTeamNames(data.teamNames);
      audio.stopBg();
      audio.playCelebration();
    });

    socket.on("million-team:teams-renamed", (data: { teamNames: { A: string; B: string } }) => {
      if (data.teamNames) setTeamNames(data.teamNames);
    });

    socket.on("million-team:lifeline-vote-started", (data: { team: TeamId }) => {
      setLifelineVoteActive(data.team);
      setLifelineVoteResult(null);
    });

    socket.on("million-team:lifeline-vote-result", (data: { team: TeamId; winner: string; counts: Record<string, number> }) => {
      setLifelineVoteResult(data);
      setLifelineVoteActive(null);
    });

    socket.on("million-team:lifeline-apply-needed", (data: { team: TeamId; lifeline: string }) => {
      if (data.lifeline === "swap") {
        void handleSwapRef.current(data.team);
      } else if (data.lifeline === "callFriend") {
        void handleCallFriendRef.current(data.team);
      }
    });

    return () => {
      socket.off("connect", doRejoinHost);
      socket.off("million-team:state-sync");
      socket.off("million-team:players-updated");
      socket.off("million-team:next-question");
      socket.off("million-team:timer");
      socket.off("million-team:vote-update");
      socket.off("million-team:question-revealed");
      socket.off("million-team:lifeline-fifty-applied");
      socket.off("million-team:question-swapped");
      socket.off("million-team:lifeline-freeze-applied");
      socket.off("million-team:lifeline-take-prize-applied");
      socket.off("million-team:game-over");
      socket.off("million-team:teams-renamed");
      socket.off("million-team:lifeline-vote-started");
      socket.off("million-team:lifeline-vote-result");
      socket.off("million-team:lifeline-apply-needed");
      audio.stopBg();
    };
  }, [pin, setLocation]);

  useEffect(() => {
    if (status !== "playing" || timerPaused) {
      if (tickingRef.current) { audio.stopTickTock(); tickingRef.current = false; }
      return;
    }
    if (timerSeconds <= 10 && !tickingRef.current) {
      tickingRef.current = true;
      audio.startTickTock(timerSeconds);
    }
    if (timerSeconds > 10 && tickingRef.current) {
      audio.stopTickTock();
      tickingRef.current = false;
    }
    prevTimerRef.current = timerSeconds;
  }, [timerSeconds, status, timerPaused]);

  const handleStart = useCallback(() => {
    socketRef.current.emit("million-team:start");
    audio.startBg();
  }, []);

  const handleReveal = useCallback(() => {
    socketRef.current.emit("million-team:reveal");
  }, []);

  const handleNext = useCallback(() => {
    socketRef.current.emit("million-team:next");
  }, []);

  const handlePause = useCallback(() => {
    if (timerPaused) {
      socketRef.current.emit("million-team:resume");
    } else {
      socketRef.current.emit("million-team:pause");
    }
  }, [timerPaused]);

  const handleExtend = useCallback(() => {
    socketRef.current.emit("million-team:extend");
  }, []);

  useEffect(() => {
    if (!revealData || !autoAdvance || revealData.isLastQuestion) return;
    autoAdvanceTimerRef.current = setTimeout(() => {
      socketRef.current.emit("million-team:next");
    }, 5000);
    return () => { if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current); };
  }, [revealData, autoAdvance]);

  const handleFifty = useCallback((team: TeamId) => {
    if (lifelinesUsed[team].fifty) return;
    socketRef.current.emit("million-team:lifeline-fifty", { team });
  }, [lifelinesUsed]);

  const handleSwap = useCallback(async (team: TeamId) => {
    if (lifelinesUsed[team].swap || swappingTeam || !question) return;
    setSwappingTeam(team);
    try {
      const usedIds = [question.id];
      const r = await fetch(`${API_BASE}/api/million/swap-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ usedIds }),
      });
      if (!r.ok) {
        const err = await r.json() as { message?: string };
        toast.error(err.message || (lang === "ar" ? "لا يوجد سؤال بديل" : "No replacement available"));
        setSwappingTeam(null);
        return;
      }
      const newQ = await r.json() as { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; imageUrl: string | null };
      socketRef.current.emit("million-team:swap-question", { team, newQuestion: newQ });
    } catch {
      toast.error(lang === "ar" ? "فشل تبديل السؤال" : "Failed to swap question");
      setSwappingTeam(null);
    }
  }, [lifelinesUsed, swappingTeam, question, lang]);

  const handleFreeze = useCallback((team: TeamId) => {
    if (lifelinesUsed[team].freeze) return;
    socketRef.current.emit("million-team:lifeline-freeze", { team });
  }, [lifelinesUsed]);

  const handleTakePrize = useCallback((team: TeamId) => {
    if (lifelinesUsed[team].takePrize) return;
    socketRef.current.emit("million-team:lifeline-take-prize", { team });
  }, [lifelinesUsed]);

  const handleEndGame = useCallback(() => {
    socketRef.current.emit("million-team:end-game");
  }, []);

  const handleCallFriend = useCallback(async (team: TeamId) => {
    if (lifelinesUsed[team].callFriend || callFriendLoading || !question) return;
    setCallFriendLoading(team);
    try {
      const r = await fetch(`${API_BASE}/api/million/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionText: question.text,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
        }),
      });
      if (!r.ok) {
        toast.error(lang === "ar" ? "لم يتمكن الصديق من المساعدة الآن" : "Friend couldn't help this time");
        setCallFriendLoading(null);
        return;
      }
      const data = await r.json() as { hint: string };
      socketRef.current.emit("million-team:call-friend-result", { team, hint: data.hint });
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    }
    setCallFriendLoading(null);
  }, [lifelinesUsed, callFriendLoading, question, lang]);

  useEffect(() => { handleSwapRef.current = handleSwap; }, [handleSwap]);
  useEffect(() => { handleCallFriendRef.current = handleCallFriend; }, [handleCallFriend]);

  const handleLifelineVote = useCallback((team: TeamId) => {
    const ownLevel = prizeLevels[team];
    const available = (["fifty", "swap", "freeze", "callFriend"] as (keyof TeamLifelines)[])
      .filter(k => {
        if (lifelinesUsed[team][k]) return false;
        if (k === "freeze" && (frozenTeam !== null || pendingFreezeTeam !== null)) return false;
        return true;
      });
    if (available.length === 0) return;
    socketRef.current.emit("million-team:lifeline-vote-start", { team, availableLifelines: available });
  }, [lifelinesUsed, prizeLevels, frozenTeam, pendingFreezeTeam]);

  const handleRenameTeams = useCallback(() => {
    const newA = renameInput.A.trim() || teamNames.A;
    const newB = renameInput.B.trim() || teamNames.B;
    socketRef.current.emit("million-team:rename-teams", { teamNames: { A: newA, B: newB } });
    setShowRename(false);
    setRenameInput({ A: "", B: "" });
  }, [renameInput, teamNames]);

  const joinUrl = `${window.location.origin}/game/million/team-play/${pin}`;

  const optionLabel = (key: OptionKey) => {
    const map: Record<OptionKey, string> = { A: "أ", B: "ب", C: "ج", D: "د" };
    return lang === "ar" ? map[key] : key;
  };

  const optionText = (key: OptionKey) => {
    if (!question) return "";
    const map: Record<OptionKey, string> = {
      A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD,
    };
    return map[key];
  };

  const getVoteBar = (team: TeamId, option: OptionKey) => {
    if (!voteUpdate) return 0;
    const counts = team === "A" ? voteUpdate.teamA : voteUpdate.teamB;
    const total = team === "A" ? voteUpdate.teamASize : voteUpdate.teamBSize;
    if (total === 0) return 0;
    return Math.round((counts[option] / total) * 100);
  };

  if (status === "finished" && gameOver) {
    const winnerLabel = gameOver.winner === "A"
      ? `🏆 ${teamNames.A}`
      : gameOver.winner === "B"
        ? `🏆 ${teamNames.B}`
        : (lang === "ar" ? "🤝 تعادل!" : "🤝 Draw!");

    const winnerMsg = gameOver.winner === "draw"
      ? (lang === "ar" ? "لعبة رائعة من كلا الفريقين!" : "Great game from both teams!")
      : (lang === "ar" ? "أداء مميز! استمروا في التألق 🌟" : "Outstanding performance! Keep shining 🌟");

    const loserMsg = lang === "ar" ? "لا تستسلموا، قاتلوا في المرة القادمة 💪" : "Don't give up, fight back next time 💪";

    const shareText = lang === "ar"
      ? `نتائج لعبة فريق ضد فريق:\n🔵 ${teamNames.A}: ${formatPrize(gameOver.teamA.points)} نقطة\n🟣 ${teamNames.B}: ${formatPrize(gameOver.teamB.points)} نقطة\nالفائز: ${winnerLabel}`
      : `Team vs Team Results:\n🔵 ${teamNames.A}: ${formatPrize(gameOver.teamA.points)} pts\n🟣 ${teamNames.B}: ${formatPrize(gameOver.teamB.points)} pts\nWinner: ${winnerLabel}`;

    const teamAPlayers = gameOver.players.filter(p => p.team === "A");
    const teamBPlayers = gameOver.players.filter(p => p.team === "B");

    return (
      <Layout>
        <ConfettiBurst active />
        <div
          className="min-h-screen flex flex-col py-8 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-[#0a1628] dark:via-[#0d1f3c] dark:to-[#0a1628]"
          dir={dir}
        >
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-8"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-7xl mb-4"
              >
                🏆
              </motion.div>
              <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">{winnerLabel}</h1>
              <p className="text-blue-600 dark:text-blue-300 text-sm">{winnerMsg}</p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {(["A", "B"] as const).map(team => {
                const d = team === "A" ? gameOver.teamA : gameOver.teamB;
                const isWinner = gameOver.winner === team;
                const teamPlayers = team === "A" ? teamAPlayers : teamBPlayers;
                return (
                  <motion.div
                    key={team}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: team === "A" ? 0.1 : 0.2 }}
                    className={`rounded-2xl p-5 border-2 ${isWinner ? "border-amber-400 bg-amber-500/10 dark:bg-amber-500/10" : "border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {isWinner && <Crown className="w-5 h-5 text-amber-400" />}
                      <div className={`w-3 h-3 rounded-full ${team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                      <span className={`font-black text-lg ${team === "A" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"}`}>
                        {teamNames[team]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <HarvestCoin size={20} />
                      <span className="text-2xl font-black text-gray-900 dark:text-white">{formatPrize(d.points)}</span>
                      <span className="text-blue-500 dark:text-blue-400 text-sm">{lang === "ar" ? "نقطة" : "pts"}</span>
                    </div>
                    {d.prizeLevel >= 0 && (
                      <div className="text-green-600 dark:text-green-400 text-sm mb-3">
                        {lang === "ar" ? "وصل إلى" : "Reached"}: 💰 {formatPrize(d.prize)}
                      </div>
                    )}
                    {!isWinner && gameOver.winner !== "draw" && (
                      <p className="text-blue-500 dark:text-blue-400 text-xs italic">{loserMsg}</p>
                    )}
                    <div className="mt-3 space-y-1">
                      {teamPlayers.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className={`w-1.5 h-1.5 rounded-full ${team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                          <span className="text-gray-900 dark:text-white font-medium">{p.name}</span>
                          <span className="text-green-400 mr-auto">✓{p.correctCount}</span>
                          <span className="text-red-400">✗{p.wrongCount}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareText).then(() => {
                    toast.success(lang === "ar" ? "تم نسخ النتائج ✓" : "Results copied ✓");
                    if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
                  });
                }}
                className="px-5 py-2.5 rounded-xl text-blue-700 dark:text-white font-bold flex items-center gap-2 transition-all hover:scale-105 bg-blue-500/20 border border-blue-500/40"
              >
                <Share2 className="w-4 h-4" />
                {lang === "ar" ? "شارك النتائج" : "Share Results"}
              </button>
              <button
                onClick={() => setLocation("/game/million")}
                className="px-8 py-2.5 rounded-xl text-white font-bold transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
              >
                {lang === "ar" ? "لعبة جديدة" : "New Game"}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const LifelineSection = ({ team }: { team: TeamId }) => {
    const teamLabel = teamNames[team];
    const isFrozen = frozenTeam === team;
    const isVoteActive = lifelineVoteActive === team;
    const isCalling = swappingTeam === team || callFriendLoading === team;

    const allLifelines: { key: keyof TeamLifelines; icon: string; label: string; labelAr: string }[] = [
      { key: "fifty", icon: "⚡", label: "50/50", labelAr: "50/50" },
      { key: "swap", icon: "🔄", label: "Swap", labelAr: "بدّل" },
      { key: "freeze", icon: "🧊", label: "Freeze", labelAr: "جمّد" },
      { key: "callFriend", icon: "📞", label: "Friend", labelAr: "صديق" },
    ];

    const availableCount = allLifelines.filter(l => !lifelinesUsed[team][l.key]).length;
    const noLifelinesLeft = availableCount === 0;

    return (
      <div
        className={`rounded-xl p-3 border ${team === "A" ? "border-blue-500/30 bg-blue-500/6" : "border-red-500/30 bg-red-500/6"} ${isVoteActive ? "ring-2 ring-amber-400/50" : ""}`}
      >
        <div className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${team === "A" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"}`}>
          <div className={`w-2 h-2 rounded-full ${team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
          {teamLabel}
          {isFrozen && <span className="text-cyan-400 text-xs">🧊 {lang === "ar" ? "مجمّد" : "Frozen"}</span>}
          {isVoteActive && <span className="text-amber-400 text-xs animate-pulse">🗳️ {lang === "ar" ? "تصويت..." : "Voting..."}</span>}
          {isCalling && <span className="text-green-400 text-xs animate-pulse">⏳</span>}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {allLifelines.map(l => (
            <span
              key={l.key}
              title={lang === "ar" ? l.labelAr : l.label}
              className={`text-xs px-1.5 py-0.5 rounded ${lifelinesUsed[team][l.key] ? "bg-gray-200 dark:bg-white/4 text-gray-400 dark:text-slate-500 line-through" : "bg-gray-100 dark:bg-white/12 text-gray-700 dark:text-slate-200"}`}
            >
              {l.icon} {lang === "ar" ? l.labelAr : l.label}
            </span>
          ))}
        </div>

        {lifelineVoteResult && lifelineVoteResult.team === team && (
          <div className="mb-2 px-2 py-1 rounded-lg text-xs text-amber-600 dark:text-amber-400 font-bold text-center bg-amber-500/15 border border-amber-500/30">
            ✅ {lang === "ar" ? `الفريق اختار: ${lifelineVoteResult.winner}` : `Team chose: ${lifelineVoteResult.winner}`}
          </div>
        )}

        <button
          onClick={() => handleLifelineVote(team)}
          disabled={status !== "playing" || isVoteActive || noLifelinesLeft}
          className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${status !== "playing" || isVoteActive || noLifelinesLeft ? "opacity-40 cursor-not-allowed" : "hover:scale-[1.01]"} ${isVoteActive ? "bg-amber-500/25 border-amber-500/50 text-amber-600 dark:text-amber-400" : "bg-purple-500/25 border-purple-500/50 text-purple-700 dark:text-purple-300"}`}
        >
          <Vote className="w-3 h-3" />
          {isVoteActive
            ? (lang === "ar" ? "🗳️ تصويت جارٍ (5 ث)..." : "🗳️ Vote in progress (5s)...")
            : (lang === "ar" ? "ابدأ تصويت الأطواق" : "Start Lifeline Vote")}
        </button>
      </div>
    );
  };

  const timerColor = timerSeconds <= 5 ? "text-red-500 dark:text-red-400" : timerSeconds <= 10 ? "text-orange-500 dark:text-orange-400" : "text-gray-900 dark:text-white";

  return (
    <Layout>
      <div
        className="min-h-screen flex flex-col py-3 px-3 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-[#0a1628] dark:via-[#0d1f3c] dark:to-[#0a1628]"
        dir={dir}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <button
              onClick={() => setLocation("/game/million")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
            >
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "إعداد" : "Setup"}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="px-3 py-1.5 rounded-xl text-gray-900 dark:text-white font-black text-base tracking-widest"
                style={{ background: "rgba(245,158,11,0.2)", border: "2px solid rgba(245,158,11,0.4)" }}
              >
                {pin}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white transition-colors flex items-center gap-1 border border-gray-300 dark:border-white/15"
              >
                <Share2 className="w-3 h-3" />
                {lang === "ar" ? "نسخ" : "Copy"}
              </button>
              <button
                onClick={audio.toggleMute}
                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white transition-colors border border-gray-300 dark:border-white/15"
              >
                {audio.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-3">
            <div className="space-y-3">
              <div className="rounded-2xl p-3 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <h3 className="text-gray-900 dark:text-white font-bold mb-2 flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  {lang === "ar" ? "اللاعبون" : "Players"}
                  <span className="text-blue-500 dark:text-blue-400 text-xs mr-auto">{players.length}</span>
                </h3>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center p-2 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <div className="text-blue-600 dark:text-blue-300 text-xs font-bold truncate">{teamNames.A}</div>
                    <div className="text-gray-900 dark:text-white font-black text-xl">{teamAConnected}/{teamACount}</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                    <div className="text-red-600 dark:text-red-300 text-xs font-bold truncate">{teamNames.B}</div>
                    <div className="text-gray-900 dark:text-white font-black text-xl">{teamBConnected}/{teamBCount}</div>
                  </div>
                </div>

                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {players.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${!p.connected ? "opacity-40" : ""}`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                      <span className="text-gray-900 dark:text-white font-medium truncate flex-1">{p.name}</span>
                      <span className="text-green-600 dark:text-green-400 text-[10px]">✓{p.correctCount}</span>
                      <span className="text-red-500 dark:text-red-400 text-[10px]">✗{p.wrongCount}</span>
                      {status === "waiting" && (
                        <button
                          onClick={() => {
                            const toTeam = p.team === "A" ? "B" : "A";
                            socketRef.current.emit("million-team:reassign-player", { playerName: p.name, toTeam }, (res: { success?: boolean; error?: string }) => {
                              if (res.error) toast.error(res.error);
                            });
                          }}
                          title={lang === "ar" ? "انقل إلى الفريق الآخر" : "Move to other team"}
                          className={`text-[10px] px-1 py-0.5 rounded transition-all hover:scale-110 shrink-0 border ${p.team === "A" ? "bg-red-500/25 text-red-500 border-red-500/40" : "bg-blue-500/25 text-blue-500 border-blue-500/40"}`}
                        >
                          {p.team === "A" ? "→ب" : "→أ"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {status === "waiting" && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={handleStart}
                      disabled={players.length === 0}
                      className="w-full py-2.5 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:scale-[1.02]"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                    >
                      <Play className="w-4 h-4" />
                      {lang === "ar" ? "ابدأ اللعبة" : "Start Game"}
                    </button>
                    <button
                      onClick={() => setAutoAdvance(v => !v)}
                      className={`w-full py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${autoAdvance ? "text-green-700 dark:text-green-300 bg-green-500/20 border-green-500/40" : "text-gray-600 dark:text-white/50 hover:text-gray-800 dark:hover:text-white/70 bg-gray-100 dark:bg-white/6 border-gray-300 dark:border-white/10"}`}
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      {lang === "ar" ? "التقدم التلقائي للسؤال التالي" : "Auto-advance to next question"}
                      <span className={`mr-auto text-[10px] px-1.5 py-0.5 rounded ${autoAdvance ? "bg-green-500/30 text-green-700 dark:text-green-300" : "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/40"}`}>
                        {autoAdvance ? (lang === "ar" ? "مفعّل" : "ON") : (lang === "ar" ? "معطّل" : "OFF")}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-3 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-2 flex items-center gap-1.5">
                  <HarvestCoin size={16} />
                  {lang === "ar" ? "النقاط" : "Score"}
                </h3>
                <div className="space-y-2">
                  {(["A", "B"] as const).map(team => {
                    const level = prizeLevels[team];
                    const prize = level >= 0 ? PRIZE_LADDER[level] ?? 0 : 0;
                    const isSafe = level >= 0 && SAFE_HAVEN_LEVELS.has(level);
                    return (
                      <div key={team} className={`p-2.5 rounded-xl ${team === "A" ? "bg-blue-500/15 border border-blue-500/30" : "bg-red-500/15 border border-red-500/30"}`}>
                        <div className={`text-xs font-bold mb-0.5 flex items-center gap-1 ${team === "A" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"}`}>
                          <div className={`w-2 h-2 rounded-full ${team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                          {teamNames[team]}
                          {isSafe && <span className="text-green-600 dark:text-green-400"> 🛡️</span>}
                        </div>
                        <div className="text-gray-900 dark:text-white font-black text-lg flex items-center gap-1">
                          <HarvestCoin size={16} />
                          {formatPrize(points[team])}
                        </div>
                        {prize > 0 && (
                          <div className="text-amber-600 dark:text-amber-400 text-xs">💰 {formatPrize(prize)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {status === "playing" && (
                <div className="space-y-2">
                  <h3 className="text-gray-900 dark:text-white font-bold text-xs flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400" />
                    {lang === "ar" ? "وسائل المساعدة" : "Help Tools"}
                  </h3>
                  <LifelineSection team="A" />
                  <LifelineSection team="B" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              {status === "waiting" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-8 text-center space-y-5 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                >
                  <div className="text-5xl">⏳</div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                    {lang === "ar" ? "في انتظار اللاعبين..." : "Waiting for players to join..."}
                  </h2>

                  <div>
                    <p className="text-blue-600 dark:text-blue-300 text-sm mb-3">
                      {lang === "ar" ? "شارك هذا الكود أو الرابط مع اللاعبين للانضمام:" : "Share this code or link with players to join:"}
                    </p>
                    <div
                      className="inline-block px-10 py-4 rounded-2xl font-black text-6xl text-gray-900 dark:text-white tracking-[0.25em] select-all bg-amber-500/20 border-2 border-amber-500/50"
                    >
                      {pin}
                    </div>
                  </div>

                  <div className="rounded-xl p-4 bg-blue-500/8 dark:bg-blue-500/8 border border-blue-500/20">

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-blue-600 dark:text-blue-300 text-xs mb-2 font-bold">
                          {lang === "ar" ? "🔗 الرابط المباشر:" : "🔗 Direct link:"}
                        </p>
                        <div className="flex items-center gap-2">
                          <code
                            className="flex-1 text-xs text-blue-700 dark:text-blue-200 bg-black/10 dark:bg-black/20 px-3 py-2 rounded-lg text-left overflow-hidden text-ellipsis whitespace-nowrap"
                            dir="ltr"
                          >
                            {joinUrl}
                          </code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success(lang === "ar" ? "تم نسخ الرابط ✓" : "Link copied ✓"); }}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shrink-0 flex items-center gap-1"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            {lang === "ar" ? "نسخ" : "Copy"}
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 p-2 rounded-xl bg-white dark:bg-gray-100">
                        <QRCodeSVG value={joinUrl} size={96} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl text-center bg-blue-500/10 border border-blue-500/20">
                      <div className="text-blue-600 dark:text-blue-300 font-bold mb-1">{teamNames.A}</div>
                      <div className="text-gray-900 dark:text-white font-black text-2xl">{teamACount}</div>
                    </div>
                    <div className="p-3 rounded-xl text-center bg-red-500/10 border border-red-500/20">
                      <div className="text-red-600 dark:text-red-300 font-bold mb-1">{teamNames.B}</div>
                      <div className="text-gray-900 dark:text-white font-black text-2xl">{teamBCount}</div>
                    </div>
                  </div>

                  {!showRename ? (
                    <button
                      onClick={() => { setShowRename(true); setRenameInput({ A: teamNames.A, B: teamNames.B }); }}
                      className="w-full py-2 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-300 transition-all hover:text-blue-700 dark:hover:text-white bg-blue-500/10 border border-dashed border-blue-500/30"
                    >
                      ✏️ {lang === "ar" ? "تغيير أسماء الفرق" : "Rename Teams"}
                    </button>
                  ) : (
                    <div className="rounded-xl p-3 space-y-2 bg-gray-100 dark:bg-white/6 border border-gray-300 dark:border-white/10">
                      <p className="text-gray-600 dark:text-white/60 text-xs font-bold text-center">{lang === "ar" ? "أسماء الفرق" : "Team Names"}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white font-bold bg-blue-100 dark:bg-blue-900/40 border border-blue-500/30 focus:outline-none focus:border-blue-400 text-center"
                          value={renameInput.A}
                          maxLength={20}
                          onChange={e => setRenameInput(prev => ({ ...prev, A: e.target.value }))}
                          placeholder={teamNames.A}
                          onKeyDown={e => e.key === "Enter" && handleRenameTeams()}
                        />
                        <input
                          className="rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white font-bold bg-red-100 dark:bg-red-900/40 border border-red-500/30 focus:outline-none focus:border-red-400 text-center"
                          value={renameInput.B}
                          maxLength={20}
                          onChange={e => setRenameInput(prev => ({ ...prev, B: e.target.value }))}
                          placeholder={teamNames.B}
                          onKeyDown={e => e.key === "Enter" && handleRenameTeams()}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRenameTeams}
                          className="flex-1 py-1.5 rounded-lg text-sm font-bold text-white transition-all hover:scale-105"
                          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                        >
                          {lang === "ar" ? "حفظ" : "Save"}
                        </button>
                        <button
                          onClick={() => setShowRename(false)}
                          className="flex-1 py-1.5 rounded-lg text-sm font-bold text-gray-600 dark:text-white/60 transition-all hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-white/8"
                        >
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {(status === "playing" || status === "revealing") && question && (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-blue-600 dark:text-blue-400 text-sm font-bold">
                        {lang === "ar" ? `سؤال ${questionIndex + 1} / ${totalQuestions}` : `Q ${questionIndex + 1} / ${totalQuestions}`}
                      </div>
                      {status === "playing" && (
                        <div
                          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-black text-xl transition-colors ${timerSeconds <= 5 ? "text-red-500 dark:text-red-400 bg-red-500/10" : timerSeconds <= 10 ? "text-orange-500 dark:text-orange-400 bg-red-500/10" : "text-gray-900 dark:text-white bg-black/5 dark:bg-white/5"}`}
                        >
                          <Timer className="w-4 h-4" />
                          {timerPaused ? <span className="text-blue-500 dark:text-blue-300">⏸</span> : timerSeconds}
                        </div>
                      )}
                    </div>

                    {frozenTeam && (
                      <div className="mb-2 px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-600 dark:text-cyan-300 flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-500/30">
                        <Snowflake className="w-3.5 h-3.5" />
                        {lang === "ar" ? `${frozenTeam === "A" ? teamNames.A : teamNames.B} مجمّد الآن` : `${frozenTeam === "A" ? teamNames.A : teamNames.B} is frozen this round`}
                      </div>
                    )}
                    {pendingFreezeTeam && !frozenTeam && (
                      <div className="mb-2 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-300 flex items-center gap-1.5 bg-blue-500/12 border border-blue-500/30">
                        <Snowflake className="w-3.5 h-3.5 opacity-60" />
                        {lang === "ar" ? `🧊 ${pendingFreezeTeam === "A" ? teamNames.A : teamNames.B} سيُجمّد في السؤال القادم` : `🧊 ${pendingFreezeTeam === "A" ? teamNames.A : teamNames.B} frozen next round`}
                      </div>
                    )}

                    {question.imageUrl && (
                      <img src={question.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl mb-3" />
                    )}

                    <p className="text-gray-900 dark:text-white text-2xl font-bold text-center leading-relaxed mb-4">
                      {question.text}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {(["A", "B", "C", "D"] as OptionKey[]).map(key => {
                        const eliminatedBoth = eliminatedOptions.A.includes(key) && eliminatedOptions.B.includes(key);
                        const isCorrect = status === "revealing" && revealData?.correctAnswer === key;
                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-xl text-sm font-bold border ${eliminatedBoth ? "opacity-25" : ""} ${isCorrect ? "bg-green-500/30 border-green-500" : "bg-gray-100 dark:bg-white/6 border-gray-200 dark:border-white/10"}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isCorrect ? "bg-green-500 text-white" : "bg-amber-500/30 text-amber-600 dark:text-amber-400"}`}
                              >
                                {optionLabel(key)}
                              </span>
                              <span className={isCorrect ? "text-green-700 dark:text-green-300" : "text-gray-800 dark:text-blue-200"}>{optionText(key)}</span>
                              {isCorrect && <Check className="w-4 h-4 text-green-500 dark:text-green-400 ml-auto" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {voteUpdate && (
                    <div className="rounded-2xl p-4 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-3">
                        {lang === "ar" ? "توزيع الأصوات" : "Vote Distribution"}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {(["A", "B"] as const).map(team => {
                          const counts = team === "A" ? voteUpdate.teamA : voteUpdate.teamB;
                          const size = team === "A" ? voteUpdate.teamASize : voteUpdate.teamBSize;
                          const voted = Object.values(counts).reduce((a, b) => a + b, 0);
                          const majorityOpt = voteUpdate.majority[team].option;
                          const isThisFrozen = frozenTeam === team;
                          return (
                            <div key={team}>
                              <div className={`text-xs font-bold mb-2 ${team === "A" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"} flex items-center gap-1`}>
                                {isThisFrozen && <Snowflake className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />}
                                {teamNames[team]}
                                <span className="text-gray-500 dark:text-white/40 mr-1">({voted}/{size})</span>
                                {majorityOpt && <span className="text-green-600 dark:text-green-400">✓ {optionLabel(majorityOpt)}</span>}
                              </div>
                              {(["A", "B", "C", "D"] as OptionKey[]).map(opt => {
                                const pct = getVoteBar(team, opt);
                                const eliminated = eliminatedOptions[team].includes(opt);
                                const isMajority = majorityOpt === opt;
                                return !eliminated ? (
                                  <div key={opt} className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-blue-600 dark:text-blue-300 w-4">{optionLabel(opt)}</span>
                                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-gray-200 dark:bg-white/6">
                                      <motion.div
                                        className="h-full rounded-full"
                                        style={{ background: isMajority ? "#10b981" : (team === "A" ? "#3b82f6" : "#ef4444") }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.3 }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-white/60 w-8">{pct}%</span>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {status === "revealing" && revealData && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl p-4 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                      >
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {(["A", "B"] as const).map(team => {
                            const d = team === "A" ? revealData.teamA : revealData.teamB;
                            const wasFrozen = revealData.frozenTeam === team;
                            return (
                              <div
                                key={team}
                                className={`p-3 rounded-xl text-center border ${
                                  wasFrozen ? "border-cyan-500/50 bg-cyan-500/10"
                                  : d.correct ? "border-green-500/50 bg-green-500/10"
                                  : "border-red-500/30 bg-red-500/5"
                                }`}
                              >
                                <div className={`text-xs font-bold mb-1 ${team === "A" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"}`}>
                                  {teamNames[team]}
                                </div>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  {wasFrozen ? (
                                    <Snowflake className="w-4 h-4 text-cyan-400" />
                                  ) : d.correct ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className={`font-bold text-sm ${wasFrozen ? "text-cyan-600 dark:text-cyan-300" : d.correct ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-300"}`}>
                                    {wasFrozen ? (lang === "ar" ? "مجمّد" : "Frozen") : (d.answer ? optionLabel(d.answer) : "—")}
                                  </span>
                                </div>
                                {d.correct && (
                                  <div className="flex items-center justify-center gap-1 text-amber-400 text-xs">
                                    <HarvestCoin size={12} />
                                    +{formatPrize(d.prize)}
                                  </div>
                                )}
                                {d.speedBonus && (
                                  <div className="text-yellow-400 text-xs font-bold">⚡ {lang === "ar" ? "بونص السرعة!" : "Speed Bonus!"}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleNext}
                            className="flex-1 py-3 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            style={{
                              background: revealData.isLastQuestion
                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                : "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                            }}
                          >
                            {revealData.isLastQuestion ? <Trophy className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
                            {revealData.isLastQuestion
                              ? (lang === "ar" ? "عرض النتائج النهائية" : "Show Final Results")
                              : (lang === "ar" ? "السؤال التالي" : "Next Question")}
                          </button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {status === "playing" && (
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() => setAutoAdvance(v => !v)}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border ${autoAdvance ? "text-green-700 dark:text-green-300 bg-green-500/20 border-green-500/50" : "text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-white/6 border-gray-200 dark:border-white/10"}`}
                        title={lang === "ar" ? "انتقال تلقائي" : "Auto-advance"}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        {lang === "ar" ? "تلقائي" : "Auto"}
                        <div className={`w-2 h-2 rounded-full ${autoAdvance ? "bg-green-400 animate-pulse" : "bg-slate-400"}`} />
                      </button>
                      <button
                        onClick={handlePause}
                        className="flex-1 py-2.5 rounded-xl text-gray-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-gray-200 dark:bg-white/8 border border-gray-300 dark:border-white/15"
                      >
                        {timerPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        {timerPaused ? (lang === "ar" ? "استأنف" : "Resume") : (lang === "ar" ? "إيقاف" : "Pause")}
                      </button>
                      <button
                        onClick={handleExtend}
                        className="flex-1 py-2.5 rounded-xl text-gray-900 dark:text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-gray-200 dark:bg-white/8 border border-gray-300 dark:border-white/15"
                      >
                        <Timer className="w-4 h-4" />
                        {lang === "ar" ? "+15 ث" : "+15s"}
                      </button>
                      <button
                        onClick={handleReveal}
                        className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-red-500/20 border border-red-500/40"
                      >
                        <Shield className="w-4 h-4" />
                        {lang === "ar" ? "اكشف" : "Reveal"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
