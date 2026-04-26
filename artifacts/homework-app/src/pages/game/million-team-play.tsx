import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Trophy, Check, X, Snowflake, Phone, Scissors, RefreshCw } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useTeamGameAudio } from "./useTeamGameAudio";
import { HarvestCoin } from "@/components/harvest-coin";
import { ConfettiBurst } from "@/components/confetti-burst";
import { toast } from "@/components/ui/sonner";

type OptionKey = "A" | "B" | "C" | "D";
type TeamId = "A" | "B";
type GameStatus = "joining" | "waiting" | "playing" | "revealing" | "finished";

interface Question {
  id: number; text: string;
  optionA: string; optionB: string; optionC: string; optionD: string;
  imageUrl: string | null;
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
interface RevealData {
  correctAnswer: OptionKey;
  teamA: { answer: OptionKey | null; correct: boolean; points: number; prize: number };
  teamB: { answer: OptionKey | null; correct: boolean; points: number; prize: number };
  eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
  frozenTeam: TeamId | null;
  isLastQuestion: boolean;
  correctVotersA?: number;
  correctVotersB?: number;
}
interface GameOverData {
  winner: "A" | "B" | "draw";
  teamNames: { A: string; B: string };
  teamA: { points: number; prize: number };
  teamB: { points: number; prize: number };
  players: Array<{ name: string; team: TeamId; connected: boolean; correctCount: number; wrongCount: number }>;
  lastCorrectAnswer?: string | null;
}
interface PlayerLifelines {
  fifty: boolean;
  swap: boolean;
  callFriend: boolean;
  freeze: boolean;
}

function formatPrize(n: number) { return n.toLocaleString("en-US"); }

const STORAGE_KEY_NAME = "millionPlayerName";
const STORAGE_KEY_TEAM = "millionPlayerTeam";

function getRejoinTokenKey(pin: string) { return `millionRejoinToken:${pin}`; }

export default function MillionTeamPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const params = useParams<{ pin: string }>();
  const pin = params.pin;
  const audio = useTeamGameAudio();

  const [status, setStatus] = useState<GameStatus>("joining");
  const [joinStep, setJoinStep] = useState<1 | 2>(1);
  const [pinInput, setPinInput] = useState(pin || "");
  const [pinCheckLoading, setPinCheckLoading] = useState(false);
  const [pinCheckError, setPinCheckError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_NAME) || ""; } catch { return ""; }
  });
  const [nameError, setNameError] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(() => {
    try { return (localStorage.getItem(STORAGE_KEY_TEAM) as TeamId | null); } catch { return null; }
  });
  const [myTeam, setMyTeam] = useState<TeamId | null>(null);
  const [joining, setJoining] = useState(false);
  const [lifelineVote, setLifelineVote] = useState<{ team: TeamId; availableLifelines: string[] } | null>(null);
  const [myLifelineVote, setMyLifelineVote] = useState<string | null>(null);
  const [lifelineVoteResult, setLifelineVoteResult] = useState<{ winner: string; counts: Record<string, number> } | null>(null);
  const [teamLifelinesUsed, setTeamLifelinesUsed] = useState<Record<string, Record<string, boolean>>>({ A: {}, B: {} });
  const [callFriendHint, setCallFriendHint] = useState<{ team: TeamId; hint: string } | null>(null);
  const [myPlayerLifelinesUsed, setMyPlayerLifelinesUsed] = useState<PlayerLifelines>({ fifty: false, swap: false, callFriend: false, freeze: false });
  const [myEliminatedOptions, setMyEliminatedOptions] = useState<OptionKey[]>([]);
  const [myFrozenPersonally, setMyFrozenPersonally] = useState(false);
  const [myCallFriendHint, setMyCallFriendHint] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Array<{ name: string; team: TeamId; connected: boolean; frozenThisRound?: boolean; pendingFrozen?: boolean }>>([]);
  const [pendingGameOver, setPendingGameOver] = useState<GameOverData | null>(null);
  const [wrongRevealActive, setWrongRevealActive] = useState(false);
  const wrongRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [teamNames, setTeamNames] = useState({ A: lang === "ar" ? "الفريق أ" : "Team A", B: lang === "ar" ? "الفريق ب" : "Team B" });
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(15);
  const [myVote, setMyVote] = useState<OptionKey | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<{ A: OptionKey[]; B: OptionKey[] }>({ A: [], B: [] });
  const [voteUpdate, setVoteUpdate] = useState<VoteUpdate | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [points, setPoints] = useState({ A: 0, B: 0 });
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [frozenTeam, setFrozenTeam] = useState<TeamId | null>(null);
  const [pendingFreezeTeam, setPendingFreezeTeam] = useState<TeamId | null>(null);

  const socketRef = useRef(getSocket());
  const prevTimerRef = useRef(30);
  const tickingRef = useRef(false);

  useEffect(() => {
    const socket = socketRef.current;
    const rejoinToken = (() => { try { return localStorage.getItem(getRejoinTokenKey(pin)) || ""; } catch { return ""; } })();

    function attemptRejoin() {
      const token = (() => { try { return localStorage.getItem(getRejoinTokenKey(pin)) || ""; } catch { return ""; } })();
      if (!token) return;
      socket.emit("million-team:player-rejoin", { pin, rejoinToken: token }, (res: { success?: boolean; error?: string; name?: string; team?: TeamId; teamNames?: { A: string; B: string } }) => {
        if (res.success && res.name && res.team) {
          if (res.teamNames) setTeamNames(res.teamNames);
          setPlayerName(res.name);
          setMyTeam(res.team);
          setStatus(prev => (prev === "joining" ? "waiting" : prev));
        }
      });
    }

    if (rejoinToken) attemptRejoin();

    socket.on("connect", attemptRejoin);

    socket.on("million-team:players-updated", (data: { players: Array<{ name: string; team: TeamId; connected: boolean; frozenThisRound?: boolean }> }) => {
      if (data?.players) setAllPlayers(data.players);
    });

    socket.on("million-team:state-sync", (data: {
      status: GameStatus;
      question: Question | null;
      questionIndex: number;
      totalQuestions: number;
      prizeLevels: { A: number; B: number };
      points: { A: number; B: number };
      lifelinesUsed: Record<string, Record<string, boolean>>;
      teamNames: { A: string; B: string };
      timerSeconds: number;
      paused: boolean;
      eliminatedOptions: { A: OptionKey[]; B: OptionKey[] };
      frozenTeam: TeamId | null;
      lastRevealData: RevealData | null;
      myPlayerLifelinesUsed?: PlayerLifelines;
      myFrozenThisRound?: boolean;
    }) => {
      setStatus(data.status);
      if (data.question) setQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setPoints(data.points);
      if (data.teamNames) setTeamNames(data.teamNames);
      setEliminatedOptions(data.eliminatedOptions ?? { A: [], B: [] });
      setFrozenTeam(data.frozenTeam ?? null);
      setTimerSeconds(data.timerSeconds);
      setTimerPaused(data.paused);
      if (data.lifelinesUsed) setTeamLifelinesUsed(data.lifelinesUsed);
      if (data.myPlayerLifelinesUsed) setMyPlayerLifelinesUsed(data.myPlayerLifelinesUsed);
      if (data.myFrozenThisRound) setMyFrozenPersonally(true);
      if (data.status === "revealing" && data.lastRevealData) {
        setRevealData(data.lastRevealData);
      }
      if (data.status === "playing") audio.startBg();
    });

    socket.on("million-team:next-question", (data: {
      question: Question;
      questionIndex: number;
      totalQuestions: number;
      points: { A: number; B: number };
      teamNames?: { A: string; B: string };
      frozenTeam?: TeamId | null;
    }) => {
      setStatus("playing");
      setQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setPoints(data.points);
      if (data.teamNames) setTeamNames(data.teamNames);
      setMyVote(null);
      setEliminatedOptions({ A: [], B: [] });
      setMyEliminatedOptions([]);
      setVoteUpdate(null);
      setRevealData(null);
      setFrozenTeam(data.frozenTeam ?? null);
      setMyFrozenPersonally(false);
      setPendingFreezeTeam(null);
      setLifelineVote(null);
      setMyLifelineVote(null);
      setLifelineVoteResult(null);
      setCallFriendHint(null);
      setMyCallFriendHint(null);
      setShowFreezeModal(false);
      if (wrongRevealTimerRef.current) clearTimeout(wrongRevealTimerRef.current);
      setWrongRevealActive(false);
      setPendingGameOver(null);
      audio.stopTickTock();
      tickingRef.current = false;
      audio.startBg();
    });

    socket.on("million-team:timer", (data: { seconds: number; paused: boolean }) => {
      setTimerSeconds(data.seconds);
      setTimerPaused(data.paused);
    });

    socket.on("million-team:vote-update", (data: VoteUpdate) => {
      setVoteUpdate(data);
      if (data.frozenTeam !== undefined) setFrozenTeam(data.frozenTeam);
    });

    socket.on("million-team:question-revealed", (data: RevealData) => {
      setStatus("revealing");
      setRevealData(data);
      setEliminatedOptions(data.eliminatedOptions);
      setPoints({ A: data.teamA.points, B: data.teamB.points });
      if (data.frozenTeam !== undefined) setFrozenTeam(data.frozenTeam);
      audio.stopBg();
      audio.stopTickTock();
      tickingRef.current = false;
      if (data.teamA.correct || data.teamB.correct) audio.playCorrect();
      else audio.playWrong();
    });

    socket.on("million-team:lifeline-fifty-applied", (data: { eliminatedOptions: { A: OptionKey[]; B: OptionKey[] } }) => {
      setEliminatedOptions(data.eliminatedOptions);
    });

    socket.on("million-team:question-swapped", (data: { question: Question; eliminatedOptions: { A: OptionKey[]; B: OptionKey[] } }) => {
      setQuestion(data.question);
      setEliminatedOptions(data.eliminatedOptions);
      setMyVote(null);
      setVoteUpdate(null);
      setFrozenTeam(null);
    });

    socket.on("million-team:lifeline-freeze-applied", (data: { pendingFreezeTeam?: TeamId; frozenTeam?: TeamId }) => {
      if (data.pendingFreezeTeam !== undefined) setPendingFreezeTeam(data.pendingFreezeTeam);
      else if (data.frozenTeam !== undefined) setFrozenTeam(data.frozenTeam);
    });

    socket.on("million-team:game-over", (data: GameOverData) => {
      if (data.teamNames) setTeamNames(data.teamNames);
      audio.stopBg();
      audio.stopTickTock();
      tickingRef.current = false;
      setPendingGameOver(data);
      setWrongRevealActive(true);
      if (wrongRevealTimerRef.current) clearTimeout(wrongRevealTimerRef.current);
      wrongRevealTimerRef.current = setTimeout(() => {
        setWrongRevealActive(false);
        setStatus("finished");
        setGameOver(data);
        audio.playCelebration();
      }, 2500);
    });

    socket.on("million-team:teams-renamed", (data: { teamNames: { A: string; B: string } }) => {
      if (data.teamNames) setTeamNames(data.teamNames);
    });

    socket.on("million-team:lifeline-vote-started", (data: { team: TeamId; availableLifelines: string[] }) => {
      setLifelineVote(data);
      setMyLifelineVote(null);
      setLifelineVoteResult(null);
    });

    socket.on("million-team:lifeline-vote-result", (data: { team: TeamId; winner: string; counts: Record<string, number> }) => {
      setLifelineVoteResult({ winner: data.winner, counts: data.counts });
      setLifelineVote(null);
    });

    socket.on("million-team:call-friend-hint", (data: { team: TeamId; hint: string }) => {
      setCallFriendHint(data);
    });

    socket.on("million-team:player-fifty-applied", (data: { eliminatedOptions: OptionKey[] }) => {
      setMyEliminatedOptions(data.eliminatedOptions);
    });

    socket.on("million-team:player-call-friend-hint", (data: { hint: string }) => {
      setMyCallFriendHint(data.hint);
    });

    socket.on("million-team:you-are-frozen", () => {
      setMyFrozenPersonally(true);
    });

    return () => {
      socket.off("connect", attemptRejoin);
      socket.off("million-team:players-updated");
      socket.off("million-team:state-sync");
      socket.off("million-team:next-question");
      socket.off("million-team:timer");
      socket.off("million-team:vote-update");
      socket.off("million-team:question-revealed");
      socket.off("million-team:lifeline-fifty-applied");
      socket.off("million-team:question-swapped");
      socket.off("million-team:lifeline-freeze-applied");
      socket.off("million-team:game-over");
      socket.off("million-team:teams-renamed");
      socket.off("million-team:lifeline-vote-started");
      socket.off("million-team:lifeline-vote-result");
      socket.off("million-team:call-friend-hint");
      socket.off("million-team:player-fifty-applied");
      socket.off("million-team:player-call-friend-hint");
      socket.off("million-team:you-are-frozen");
      if (wrongRevealTimerRef.current) clearTimeout(wrongRevealTimerRef.current);
      audio.stopBg();
      audio.stopTickTock();
    };
  }, []);

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
      audio.stopTickTock(); tickingRef.current = false;
    }
    prevTimerRef.current = timerSeconds;
  }, [timerSeconds, status, timerPaused]);

  const handleJoin = useCallback(() => {
    const name = nameInput.trim();
    if (!name) { setNameError(lang === "ar" ? "أدخل اسمك أولاً" : "Enter your name"); return; }
    if (!selectedTeam) { setNameError(lang === "ar" ? "اختر فريقاً" : "Choose a team"); return; }
    setNameError("");
    setJoining(true);

    try { localStorage.setItem(STORAGE_KEY_NAME, name); } catch { /* ignore */ }
    try { localStorage.setItem(STORAGE_KEY_TEAM, selectedTeam); } catch { /* ignore */ }

    const socket = socketRef.current;
    const activePIN = pinInput.trim();
    socket.emit("million-team:join", { pin: activePIN, name, team: selectedTeam }, (res: { success?: boolean; error?: string; rejoinToken?: string; teamNames?: { A: string; B: string } }) => {
      if (res.error) {
        setNameError(res.error);
        setJoining(false);
        return;
      }
      if (res.rejoinToken) {
        try { localStorage.setItem(getRejoinTokenKey(activePIN), res.rejoinToken); } catch { /* ignore */ }
      }
      if (res.teamNames) setTeamNames(res.teamNames);
      setPlayerName(name);
      setMyTeam(selectedTeam);
      setStatus("waiting");
      setJoining(false);
    });
  }, [nameInput, selectedTeam, pinInput, lang]);

  const handleVote = useCallback((option: OptionKey) => {
    if (myVote || !question || status !== "playing") return;
    if (myEliminatedOptions.includes(option)) return;
    if (frozenTeam && frozenTeam === myTeam) return;
    if (myFrozenPersonally) return;
    setMyVote(option);
    socketRef.current.emit("million-team:vote", { pin: pinInput, option });
    audio.playVote();
  }, [myVote, question, status, eliminatedOptions, myEliminatedOptions, myTeam, pinInput, frozenTeam, myFrozenPersonally, audio]);

  const handlePlayerLifeline = useCallback((type: "fifty" | "swap" | "callFriend" | "freeze", targetPlayerName?: string) => {
    if (myPlayerLifelinesUsed[type]) return;
    setMyPlayerLifelinesUsed(prev => ({ ...prev, [type]: true }));
    socketRef.current.emit("million-team:player-lifeline", { type, targetPlayerName }, (res: { success?: boolean; error?: string }) => {
      if (res.error) {
        setMyPlayerLifelinesUsed(prev => ({ ...prev, [type]: false }));
        toast.error(res.error);
      }
    });
  }, [myPlayerLifelinesUsed]);

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

  const myTeamVotes = myTeam && voteUpdate ? (myTeam === "A" ? voteUpdate.teamA : voteUpdate.teamB) : null;
  const myTeamSize = myTeam && voteUpdate ? (myTeam === "A" ? voteUpdate.teamASize : voteUpdate.teamBSize) : 0;
  const myTeamVoted = myTeamVotes ? Object.values(myTeamVotes).reduce((a, b) => a + b, 0) : 0;
  const myTeamMajority = myTeam && voteUpdate ? voteUpdate.majority[myTeam].option : null;
  const amFrozen = (frozenTeam !== null && frozenTeam === myTeam) || myFrozenPersonally;
  const opponentTeam: TeamId | null = myTeam === "A" ? "B" : myTeam === "B" ? "A" : null;
  const opponentPlayers = opponentTeam ? allPlayers.filter(p => p.team === opponentTeam && p.connected && !p.frozenThisRound && !p.pendingFrozen) : [];
  const wrongRevealCorrectAnswer = pendingGameOver?.lastCorrectAnswer as OptionKey | undefined;

  const bgStyle = { background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" };
  const baseStyle = "min-h-screen flex flex-col py-6 px-4";

  if (status === "joining") {
    const savedTeam = selectedTeam;

    if (joinStep === 1) {
      const pinValid = /^\d{6}$/.test(pinInput.trim());
      return (
        <div className={baseStyle} style={bgStyle} dir={dir}>
          <div className="max-w-md mx-auto pt-16">
            <div className="text-center mb-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 40px rgba(245,158,11,0.4)" }}
              >
                <span className="text-4xl">🏆</span>
              </motion.div>
              <h1 className="text-3xl font-black text-white mb-2">
                {lang === "ar" ? "من سيحصد المليون؟" : "Who Wants to be a Millionaire?"}
              </h1>
              <p className="text-amber-400 text-sm font-bold">
                {lang === "ar" ? "فريق ضد فريق" : "Team vs Team"}
              </p>
            </div>

            <div
              className="rounded-2xl p-6 space-y-5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <div>
                <label className="text-blue-300 text-sm font-medium block mb-3 text-center">
                  {lang === "ar" ? "أدخل رمز الغرفة" : "Enter Room PIN"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={e => {
                    if (e.key === "Enter" && pinValid && !pinCheckLoading) {
                      setPinCheckError("");
                      setPinCheckLoading(true);
                      socketRef.current.emit("million-team:check-pin", { pin: pinInput.trim() }, (res: { valid: boolean; error?: string }) => {
                        setPinCheckLoading(false);
                        if (res.valid) setJoinStep(2);
                        else setPinCheckError(res.error || (lang === "ar" ? "رمز غير صحيح" : "Invalid PIN"));
                      });
                    }
                  }}
                  maxLength={6}
                  autoFocus
                  placeholder={lang === "ar" ? "123456" : "123456"}
                  className="w-full text-center text-4xl font-black tracking-[0.25em] px-4 py-4 rounded-2xl text-amber-400 placeholder-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ background: "rgba(255,255,255,0.07)", border: "2px solid rgba(245,158,11,0.4)", letterSpacing: "0.25em" }}
                />
                {pinInput.length > 0 && !pinValid && (
                  <p className="text-red-400 text-xs text-center mt-2">
                    {lang === "ar" ? "الرمز يجب أن يكون 6 أرقام" : "PIN must be 6 digits"}
                  </p>
                )}
              </div>

              {pinCheckError && (
                <p className="text-red-400 text-sm text-center font-bold">{pinCheckError}</p>
              )}
              <button
                onClick={() => {
                  if (!pinValid || pinCheckLoading) return;
                  setPinCheckError("");
                  setPinCheckLoading(true);
                  socketRef.current.emit("million-team:check-pin", { pin: pinInput.trim() }, (res: { valid: boolean; error?: string }) => {
                    setPinCheckLoading(false);
                    if (res.valid) {
                      setJoinStep(2);
                    } else {
                      setPinCheckError(res.error || (lang === "ar" ? "رمز غير صحيح" : "Invalid PIN"));
                    }
                  });
                }}
                disabled={!pinValid || pinCheckLoading}
                className="w-full py-4 rounded-2xl text-white font-black text-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:scale-100"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: pinValid ? "0 8px 30px rgba(245,158,11,0.35)" : "none" }}
              >
                {pinCheckLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (lang === "ar" ? "انضم!" : "Join!")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={baseStyle} style={bgStyle} dir={dir}>
        <div className="max-w-md mx-auto pt-10">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1">
              {lang === "ar" ? "فريق ضد فريق" : "Team vs Team"}
            </h1>
            <p className="text-blue-300 text-sm">PIN: <span className="font-black text-amber-400 tracking-widest">{pin}</span></p>
          </div>

          <div
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div>
              <label className="text-blue-300 text-sm font-medium block mb-1.5">
                {lang === "ar" ? "اسمك" : "Your Name"}
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                maxLength={40}
                autoFocus
                placeholder={lang === "ar" ? "مثال: أحمد" : "e.g. Ahmad"}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-blue-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
            </div>

            <div>
              <label className="text-blue-300 text-sm font-medium block mb-2">
                {lang === "ar" ? "اختر فريقك" : "Choose Your Team"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedTeam("A")}
                  className={`py-4 rounded-2xl font-black text-lg transition-all ${
                    savedTeam === "A" ? "border-2 border-blue-400" : "border border-white/10 hover:border-blue-400/50"
                  }`}
                  style={{ background: savedTeam === "A" ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.08)" }}
                >
                  <div className="text-blue-300 text-2xl mb-1">🔵</div>
                  <div className="text-white text-sm">{teamNames.A}</div>
                </button>
                <button
                  onClick={() => setSelectedTeam("B")}
                  className={`py-4 rounded-2xl font-black text-lg transition-all ${
                    savedTeam === "B" ? "border-2 border-red-400" : "border border-white/10 hover:border-red-400/50"
                  }`}
                  style={{ background: savedTeam === "B" ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.08)" }}
                >
                  <div className="text-red-300 text-2xl mb-1">🔴</div>
                  <div className="text-white text-sm">{teamNames.B}</div>
                </button>
              </div>
            </div>

            {nameError && <p className="text-red-400 text-sm text-center">{nameError}</p>}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-4 rounded-2xl text-white font-black text-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 30px rgba(59,130,246,0.3)" }}
            >
              {joining
                ? (lang === "ar" ? "جارٍ الانضمام..." : "Joining...")
                : (lang === "ar" ? "انضم!" : "Join!")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div className={baseStyle} style={bgStyle} dir={dir}>
        <div className="max-w-md mx-auto pt-16 text-center">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <div className="text-5xl mb-4">⏳</div>
          </motion.div>
          <h2 className="text-2xl font-black text-white mb-2">
            {lang === "ar" ? "في انتظار بدء اللعبة..." : "Waiting for game to start..."}
          </h2>
          <p className="text-blue-300 mb-4">{lang === "ar" ? "مرحباً" : "Welcome"}, <span className="text-white font-bold">{playerName}</span></p>
          <div
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xl ${myTeam === "A" ? "text-blue-300" : "text-red-300"}`}
            style={{
              background: myTeam === "A" ? "rgba(59,130,246,0.2)" : "rgba(239,68,68,0.2)",
              border: `2px solid ${myTeam === "A" ? "rgba(59,130,246,0.5)" : "rgba(239,68,68,0.5)"}`,
            }}
          >
            <div className={`w-3 h-3 rounded-full ${myTeam === "A" ? "bg-blue-400" : "bg-red-400"}`} />
            {myTeam ? teamNames[myTeam] : ""}
          </div>
          <p className="text-blue-500 text-sm mt-6">{lang === "ar" ? "ستبدأ اللعبة قريباً..." : "Game will start soon..."}</p>
        </div>
      </div>
    );
  }

  if (status === "finished" && gameOver) {
    const isMyTeamWinner = gameOver.winner === myTeam;
    const isDraw = gameOver.winner === "draw";

    const winnerIcon = isMyTeamWinner ? "🏆" : isDraw ? "🤝" : "😔";
    const winnerLabel = isMyTeamWinner
      ? (lang === "ar" ? "فريقك فاز! 🎉" : "Your team won! 🎉")
      : isDraw
        ? (lang === "ar" ? "تعادل!" : "Draw!")
        : (lang === "ar" ? "الفريق الآخر فاز" : "The other team won");

    const motivationalMsg = isMyTeamWinner
      ? (lang === "ar" ? "أداء رائع! استمروا في التألق 🌟" : "Amazing performance! Keep shining 🌟")
      : isDraw
        ? (lang === "ar" ? "لعبة رائعة من الجميع!" : "Great game from everyone!")
        : (lang === "ar" ? "لا تستسلموا، قاتلوا في المرة القادمة 💪" : "Don't give up, fight back next time 💪");

    const myPlayerStats = myTeam
      ? gameOver.players.find(p => p.name === playerName && p.team === myTeam)
      : null;

    return (
      <div className={baseStyle} style={bgStyle} dir={dir}>
        <ConfettiBurst active={isMyTeamWinner || isDraw} />
        <div className="max-w-md mx-auto pt-8 text-center space-y-5">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-6xl"
          >
            {winnerIcon}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-black text-white"
          >
            {winnerLabel}
          </motion.h1>
          <p className="text-blue-300 text-sm">{motivationalMsg}</p>

          {myPlayerStats && (
            <div
              className="mx-auto inline-flex items-center gap-4 px-5 py-3 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <div className="text-center">
                <div className="text-green-400 font-black text-xl">{myPlayerStats.correctCount}</div>
                <div className="text-xs text-green-300">{lang === "ar" ? "صحيح" : "Correct"}</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <div className="text-red-400 font-black text-xl">{myPlayerStats.wrongCount}</div>
                <div className="text-xs text-red-300">{lang === "ar" ? "خاطئ" : "Wrong"}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(["A", "B"] as const).map(team => {
              const d = team === "A" ? gameOver.teamA : gameOver.teamB;
              const isMe = team === myTeam;
              const isWinner = gameOver.winner === team;
              return (
                <motion.div
                  key={team}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + (team === "A" ? 0 : 0.1) }}
                  className={`p-4 rounded-xl border-2 ${isWinner ? "border-amber-400" : "border-white/10"}`}
                  style={{ background: isWinner ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center gap-1.5 mb-2 justify-center">
                    {isWinner && <Trophy className="w-4 h-4 text-amber-400" />}
                    <div className={`w-2 h-2 rounded-full ${team === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                    <span className={`text-xs font-bold ${team === "A" ? "text-blue-300" : "text-red-300"}`}>
                      {gameOver.teamNames[team]}
                    </span>
                    {isMe && <span className="text-amber-400 text-xs">{lang === "ar" ? "(أنت)" : "(you)"}</span>}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-white font-black text-lg">
                    <HarvestCoin size={16} />
                    {formatPrize(d.points)}
                  </div>
                  <div className="text-amber-400 text-xs">{lang === "ar" ? "نقطة" : "pts"}</div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-blue-400 text-sm">{lang === "ar" ? "شكراً للمشاركة!" : "Thanks for playing!"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={baseStyle} style={bgStyle} dir={dir}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${myTeam === "A" ? "text-blue-300 bg-blue-500/20" : "text-red-300 bg-red-500/20"}`}>
            <div className={`w-2 h-2 rounded-full ${myTeam === "A" ? "bg-blue-400" : "bg-red-400"}`} />
            {myTeam ? teamNames[myTeam] : ""}
          </div>
          <div className="text-blue-400 text-xs font-bold">
            {questionIndex + 1}/{totalQuestions}
          </div>
        </div>

        {amFrozen && status === "playing" && (
          <div
            className="mb-3 px-4 py-2.5 rounded-xl text-sm font-bold text-cyan-300 flex items-center justify-center gap-2"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)" }}
          >
            <Snowflake className="w-4 h-4 animate-pulse" />
            {lang === "ar" ? "أنت مجمَّد هذه الجولة!" : "You are frozen this round!"}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          {(["A", "B"] as const).map(team => (
            <div
              key={team}
              className={`text-center p-2 rounded-xl ${team === myTeam ? "border-2" : "border"} ${team === "A" ? "border-blue-500/50 bg-blue-500/10" : "border-red-500/50 bg-red-500/10"}`}
            >
              <div className={`text-xs font-bold flex items-center justify-center gap-1 ${team === "A" ? "text-blue-300" : "text-red-300"}`}>
                {teamNames[team]}
              </div>
              <div className="flex items-center justify-center gap-1 text-white font-black text-sm">
                <HarvestCoin size={12} />
                {formatPrize(points[team])}
              </div>
            </div>
          ))}
        </div>

        {status === "playing" && myTeam && !amFrozen && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {([
              { key: "fifty" as const, icon: <Scissors className="w-4 h-4" />, labelAr: "50/50", labelEn: "50/50" },
              { key: "swap" as const, icon: <RefreshCw className="w-4 h-4" />, labelAr: "استبدل", labelEn: "Swap" },
              { key: "callFriend" as const, icon: <Phone className="w-4 h-4" />, labelAr: "صديق", labelEn: "Friend" },
              { key: "freeze" as const, icon: <Snowflake className="w-4 h-4" />, labelAr: "جمّد", labelEn: "Freeze" },
            ]).map(l => {
              const used = myPlayerLifelinesUsed[l.key];
              return (
                <button
                  key={l.key}
                  onClick={() => {
                    if (used) return;
                    if (l.key === "freeze") { setShowFreezeModal(true); return; }
                    handlePlayerLifeline(l.key);
                  }}
                  disabled={used}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-bold transition-all ${used ? "opacity-40 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"}`}
                  style={{
                    background: used ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.15)",
                    border: `1px solid ${used ? "rgba(255,255,255,0.08)" : "rgba(245,158,11,0.4)"}`,
                    color: used ? "#64748b" : "#fbbf24",
                  }}
                >
                  {l.icon}
                  <span className="text-[10px] leading-none">{lang === "ar" ? l.labelAr : l.labelEn}</span>
                </button>
              );
            })}
          </div>
        )}

        {status === "playing" && (
          <motion.div
            className="flex justify-center mb-4"
            animate={timerSeconds <= 5 && !timerPaused ? { scale: [1, 1.08, 1] } : {}}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            <div
              className={`w-20 h-20 rounded-full flex flex-col items-center justify-center font-black shadow-lg transition-all ${
                timerSeconds <= 5 ? "text-red-400" : timerSeconds <= 10 ? "text-orange-400" : "text-white"
              }`}
              style={{
                background: timerSeconds <= 5
                  ? "radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.08) 100%)"
                  : timerSeconds <= 10
                  ? "radial-gradient(circle, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.06) 100%)"
                  : "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.04) 100%)",
                border: `3px solid ${timerSeconds <= 5 ? "rgba(239,68,68,0.6)" : timerSeconds <= 10 ? "rgba(249,115,22,0.5)" : "rgba(59,130,246,0.3)"}`,
              }}
            >
              {timerPaused
                ? <span className="text-2xl">⏸</span>
                : <span className="text-4xl leading-none">{timerSeconds}</span>
              }
              <span className="text-xs opacity-60 mt-0.5">{lang === "ar" ? "ثانية" : "sec"}</span>
            </div>
          </motion.div>
        )}

        {question && (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="rounded-2xl p-5 mb-4"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {question.imageUrl && (
                <img src={question.imageUrl} alt="" className="w-full max-h-40 object-contain rounded-xl mb-3" />
              )}
              <p className="text-white font-bold text-lg leading-relaxed text-center">{question.text}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["A", "B", "C", "D"] as OptionKey[]).map(key => {
                const eliminated = myEliminatedOptions.includes(key) || (myTeam ? eliminatedOptions[myTeam].includes(key) : false);
                const isMyVote = myVote === key;
                const isRevealCorrect = (status === "revealing" && revealData?.correctAnswer === key) || (wrongRevealActive && wrongRevealCorrectAnswer === key);
                const isRevealWrong = (status === "revealing" || wrongRevealActive) && myVote === key && (revealData?.correctAnswer ?? wrongRevealCorrectAnswer) !== key;

                let borderColor = "rgba(255,255,255,0.12)";
                let bgColor = "rgba(255,255,255,0.05)";
                if (isMyVote && status === "playing") { borderColor = "#f59e0b"; bgColor = "rgba(245,158,11,0.15)"; }
                if (isRevealCorrect) { borderColor = "#10b981"; bgColor = "rgba(16,185,129,0.2)"; }
                if (isRevealWrong && !isRevealCorrect) { borderColor = "#ef4444"; bgColor = "rgba(239,68,68,0.1)"; }

                const pct = myTeamVotes && myTeamSize > 0
                  ? Math.round((myTeamVotes[key] / myTeamSize) * 100) : 0;

                const canVote = !myVote && !eliminated && !amFrozen && status !== "revealing" && !wrongRevealActive;

                return (
                  <button
                    key={key}
                    onClick={() => canVote && handleVote(key)}
                    disabled={!!myVote || eliminated || status === "revealing" || amFrozen}
                    className={`p-3 rounded-xl text-start transition-all relative overflow-hidden ${eliminated ? "opacity-25" : canVote ? "hover:scale-[1.02] active:scale-95" : ""}`}
                    style={{ background: bgColor, border: `2px solid ${borderColor}` }}
                  >
                    {myTeamVotes && pct > 0 && (
                      <div
                        className="absolute inset-0 opacity-20 transition-all duration-300"
                        style={{
                          background: myTeam === "A" ? "#3b82f6" : "#ef4444",
                          width: `${pct}%`,
                        }}
                      />
                    )}
                    <div className="relative flex items-start gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black mt-0.5 ${
                          isRevealCorrect ? "bg-green-500 text-white"
                          : isRevealWrong ? "bg-red-500 text-white"
                          : isMyVote ? "bg-amber-500 text-white"
                          : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {optionLabel(key)}
                      </span>
                      <span className={`text-sm font-medium leading-tight ${
                        isRevealCorrect ? "text-green-200"
                        : isRevealWrong ? "text-red-300"
                        : "text-blue-100"
                      }`}>
                        {optionText(key)}
                      </span>
                      {isRevealCorrect && <Check className="w-4 h-4 text-green-400 ml-auto flex-shrink-0 mt-0.5" />}
                      {isRevealWrong && !isRevealCorrect && <X className="w-4 h-4 text-red-400 ml-auto flex-shrink-0 mt-0.5" />}
                    </div>
                    {myTeamVotes && myTeamSize > 0 && pct > 0 && (
                      <div className="relative text-right mt-1">
                        <span className="text-xs opacity-60">{pct}%</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {myVote && status === "playing" && !amFrozen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-2"
            >
              <div className="text-green-400 font-bold text-sm">
                {lang === "ar" ? `✓ صوّتَ على: ${optionLabel(myVote)}` : `✓ Voted: ${optionLabel(myVote)}`}
              </div>
              {myTeamVotes && myTeamSize > 0 && (
                <div className="text-blue-400 text-xs">
                  {lang === "ar" ? `${myTeamVoted} / ${myTeamSize} صوّتوا` : `${myTeamVoted} / ${myTeamSize} voted`}
                  {myTeamMajority && (
                    <span className="text-green-400 mr-2">
                      {" "}— {lang === "ar" ? `الأغلبية: ${optionLabel(myTeamMajority)}` : `Majority: ${optionLabel(myTeamMajority)}`}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {status === "revealing" && revealData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as TeamId[]).map(team => {
                const d = team === "A" ? revealData.teamA : revealData.teamB;
                const correctVoters = team === "A" ? (revealData.correctVotersA ?? 0) : (revealData.correctVotersB ?? 0);
                const isMe = team === myTeam;
                const isFrozen = revealData.frozenTeam === team;
                return (
                  <div
                    key={team}
                    className={`rounded-xl p-3 text-center ${isMe ? "ring-2" : ""} ${team === "A" ? "ring-blue-400" : "ring-red-400"}`}
                    style={{
                      background: isFrozen
                        ? "rgba(6,182,212,0.12)"
                        : d.correct
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(239,68,68,0.1)",
                      border: `1px solid ${isFrozen ? "rgba(6,182,212,0.4)" : d.correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`,
                    }}
                  >
                    <div className={`text-xs font-bold mb-1 ${team === "A" ? "text-blue-300" : "text-red-300"}`}>
                      {teamNames[team]} {isMe && (lang === "ar" ? "(أنت)" : "(you)")}
                    </div>
                    {isFrozen ? (
                      <div className="flex items-center justify-center gap-1 text-cyan-400 text-sm">
                        <Snowflake className="w-3 h-3" />
                        <span>{lang === "ar" ? "مجمّد" : "Frozen"}</span>
                      </div>
                    ) : (
                      <>
                        {d.answer ? (
                          <div className={`font-black text-base ${d.correct ? "text-green-400" : "text-red-400"}`}>
                            {d.correct ? "✓" : "✗"} {d.answer}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">{lang === "ar" ? "لم يجب" : "No answer"}</div>
                        )}
                        <div className="text-amber-400 text-xs mt-1 font-bold">
                          {lang === "ar"
                            ? `${correctVoters} لاعب أجاب صح (+${correctVoters})`
                            : `${correctVoters} correct (+${correctVoters} pts)`}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-blue-300 text-xs text-center">
              {lang === "ar" ? "في انتظار المعلم للسؤال التالي..." : "Waiting for teacher to continue..."}
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {wrongRevealActive && question && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
              style={{ background: "rgba(10,22,40,0.95)" }}
            >
              <div className="text-4xl mb-4">✅</div>
              <p className="text-white text-sm font-bold mb-4 text-center">
                {lang === "ar" ? "الإجابة الصحيحة كانت:" : "The correct answer was:"}
              </p>
              <div
                className="w-full max-w-sm p-4 rounded-2xl text-center"
                style={{ background: "rgba(16,185,129,0.2)", border: "2px solid rgba(16,185,129,0.6)" }}
              >
                <div className="text-green-400 font-black text-xl">
                  {wrongRevealCorrectAnswer && optionLabel(wrongRevealCorrectAnswer as OptionKey)} — {wrongRevealCorrectAnswer && optionText(wrongRevealCorrectAnswer as OptionKey)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lifelineVote && myTeam === lifelineVote.team && !myLifelineVote && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl p-4"
              style={{ background: "linear-gradient(135deg, #1e3a5f, #1d2d44)", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <p className="text-amber-400 font-black text-center mb-3">
                {lang === "ar" ? "صوّت: أي طوق إنقاذ تريد؟" : "Vote: Which lifeline do you want?"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "fifty", labelAr: "50/50", labelEn: "50/50", icon: "✂️" },
                  { key: "swap", labelAr: "استبدل السؤال", labelEn: "Swap Q", icon: "🔄" },
                  { key: "freeze", labelAr: "تجميد الخصم", labelEn: "Freeze", icon: "❄️" },
                  { key: "callFriend", labelAr: "اتصل بصديق", labelEn: "Call Friend", icon: "📞" },
                ] as { key: string; labelAr: string; labelEn: string; icon: string }[])
                  .filter(l => lifelineVote.availableLifelines.includes(l.key)).map(l => (
                  <button
                    key={l.key}
                    onClick={() => {
                      setMyLifelineVote(l.key);
                      socketRef.current.emit("million-team:lifeline-vote-cast", { pin: pinInput, lifeline: l.key });
                    }}
                    className="py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 active:scale-95"
                    style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.5)" }}
                  >
                    <div className="text-xl mb-0.5">{l.icon}</div>
                    {lang === "ar" ? l.labelAr : l.labelEn}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {myLifelineVote && lifelineVote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl p-4 text-center"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)" }}
            >
              <p className="text-green-400 font-bold">
                {lang === "ar" ? `✓ صوّتَ على: ${myLifelineVote}` : `✓ Voted for: ${myLifelineVote}`}
              </p>
              <p className="text-blue-400 text-xs mt-1">{lang === "ar" ? "في انتظار بقية الفريق..." : "Waiting for teammates..."}</p>
            </motion.div>
          )}

          {lifelineVoteResult && (
            <motion.div
              key="vote-result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl p-4 text-center"
              style={{ background: "rgba(245,158,11,0.18)", border: "2px solid rgba(245,158,11,0.6)" }}
            >
              <p className="text-amber-400 font-black text-lg">
                {lang === "ar" ? `قرار الفريق: ${lifelineVoteResult.winner}` : `Team decision: ${lifelineVoteResult.winner}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {callFriendHint && myTeam === callFriendHint.team && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl p-4"
              style={{ background: "linear-gradient(135deg, #1a2d1a, #1e3a1e)", border: "2px solid rgba(34,197,94,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-black text-sm">
                  {lang === "ar" ? "نصيحة الصديق:" : "Friend's hint:"}
                </p>
              </div>
              <p className="text-white text-sm leading-relaxed">{callFriendHint.hint}</p>
              <button
                onClick={() => setCallFriendHint(null)}
                className="mt-2 text-green-400 text-xs underline"
              >
                {lang === "ar" ? "إغلاق" : "Dismiss"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {myCallFriendHint && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="fixed bottom-6 left-4 right-4 z-50 rounded-2xl p-4"
              style={{ background: "linear-gradient(135deg, #1a2d1a, #1e3a1e)", border: "2px solid rgba(34,197,94,0.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-black text-sm">
                  {lang === "ar" ? "نصيحة الذكاء الاصطناعي:" : "AI hint:"}
                </p>
              </div>
              <p className="text-white text-sm leading-relaxed">{myCallFriendHint}</p>
              <button
                onClick={() => setMyCallFriendHint(null)}
                className="mt-2 text-green-400 text-xs underline"
              >
                {lang === "ar" ? "إغلاق" : "Dismiss"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFreezeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setShowFreezeModal(false)}
            >
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg, #0d1f3c, #1e3a5f)", border: "2px solid rgba(6,182,212,0.5)" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Snowflake className="w-5 h-5 text-cyan-400" />
                  <p className="text-cyan-300 font-black">
                    {lang === "ar" ? "اختر لاعباً لتجميده" : "Choose a player to freeze"}
                  </p>
                </div>
                {opponentPlayers.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center">
                    {lang === "ar" ? "لا يوجد لاعبون متاحون" : "No players available"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {opponentPlayers.map(p => (
                      <button
                        key={p.name}
                        onClick={() => {
                          handlePlayerLifeline("freeze", p.name);
                          setShowFreezeModal(false);
                        }}
                        className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 text-start"
                        style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)" }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${opponentTeam === "A" ? "bg-blue-400" : "bg-red-400"}`} />
                          {p.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowFreezeModal(false)}
                  className="mt-4 w-full text-gray-400 text-xs underline"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
