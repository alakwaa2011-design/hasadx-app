import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trophy, Flame, Home, Volume2, VolumeX, Crown, Medal, Users, Zap, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { flagSound } from "@/lib/flag-sounds";
import { io as ioClient, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "";

const OPTION_COLORS = [
  { bg: "bg-red-500", text: "text-white" },
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-green-500", text: "text-white" },
];
const OPTION_SHAPES = ["▲", "◆", "●", "■"];

type Phase = "connecting" | "waiting" | "countdown" | "question" | "feedback" | "leaderboard" | "finished";

interface LeaderboardEntry {
  name: string;
  score: number;
  streak: number;
  rank: number;
}

export default function CapitalsMultiPlay() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const pin = params.get("pin") || "";
  const isHost = params.get("host") === "1";
  const playerName = params.get("name") || "";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [countdownNum, setCountdownNum] = useState(3);
  const [question, setQuestion] = useState<{
    countryCode: string;
    countryNameAr: string;
    countryNameEn: string;
    capitalAr: string;
    capitalEn: string;
    questionMode: "country-to-capital" | "capital-to-country";
    options: { label: string; labelAr: string; value: string }[];
    correctValue: string;
  } | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [duration, setDuration] = useState(7);
  const [timer, setTimer] = useState(7);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; score: number; streak: number; correctAnswer: string } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [finalResults, setFinalResults] = useState<{ players: { name: string; score: number; streak: number; correctCount: number; totalQuestions: number; rank: number }[] } | null>(null);
  const [muted, setMuted] = useState(flagSound.muted);
  const [error, setError] = useState("");
  const [feedbackType, setFeedbackType] = useState<"correct" | "wrong" | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myName = isHost ? "Host" : playerName;

  useEffect(() => {
    const socket = ioClient(API_BASE || window.location.origin, {
      path: "/api/socket.io",
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (isHost) {
        socket.emit("capital:rejoin-host", { pin }, (res: { error?: string }) => {
          if (res?.error) { setError(res.error); return; }
          setPhase("countdown");
        });
      } else {
        socket.emit("capital:join-game", { pin, name: playerName }, (res: { error?: string; questionCount?: number }) => {
          if (res.error) { setError(res.error); setPhase("connecting"); return; }
          setTotalQuestions(res.questionCount || 0);
          setPhase("waiting");
        });
      }
    });

    socket.on("capital:countdown", (data: { seconds: number }) => {
      setPhase("countdown");
      setCountdownNum(data.seconds);
      let c = data.seconds;
      const interval = setInterval(() => {
        c--;
        setCountdownNum(c);
        flagSound.playCountdown();
        if (c <= 0) clearInterval(interval);
      }, 1000);
    });

    socket.on("capital:question", (data: { question: typeof question; questionIdx: number; totalQuestions: number; duration: number }) => {
      setPhase("question");
      setQuestion(data.question);
      setQuestionIdx(data.questionIdx);
      setTotalQuestions(data.totalQuestions);
      setDuration(data.duration);
      setTimer(data.duration);
      setSelected(null);
      setFeedback(null);
      setFeedbackType(null);
      setAnsweredCount(0);

      if (timerRef.current) clearInterval(timerRef.current);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        const remaining = Math.max(0, data.duration - elapsed);
        setTimer(remaining);
        if (remaining <= 3 && remaining > 2.9) flagSound.playTick();
        if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
      }, 50);

      flagSound.startBackground();
    });

    socket.on("capital:answer-update", (data: { answeredCount: number; totalPlayers: number }) => {
      setAnsweredCount(data.answeredCount);
      setTotalPlayers(data.totalPlayers);
    });

    socket.on("capital:question-ended", (data: { leaderboard: LeaderboardEntry[] }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setLeaderboard(data.leaderboard || []);
      setPhase("leaderboard");
    });

    socket.on("capital:game-finished", (data: typeof finalResults) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setFinalResults(data);
      setPhase("finished");
      flagSound.playGameOver();
    });

    socket.on("capital:game-ended", () => {
      setError(lang === "ar" ? "انتهت اللعبة" : "Game ended");
      setPhase("finished");
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.disconnect();
    };
  }, [pin, isHost, playerName]);

  const handleAnswer = (value: string) => {
    if (selected || phase !== "question" || !socketRef.current) return;
    setSelected(value);
    if (timerRef.current) clearInterval(timerRef.current);

    socketRef.current.emit("capital:submit-answer", { pin, answer: value }, (res: { error?: string; correct?: boolean; score?: number; streak?: number; correctAnswer?: string }) => {
      if (res.error) return;
      setFeedback({ correct: res.correct!, score: res.score!, streak: res.streak!, correctAnswer: res.correctAnswer! });
      setMyScore(res.score!);
      setMyStreak(res.streak!);
      setFeedbackType(res.correct ? "correct" : "wrong");
      setPhase("feedback");
      if (res.correct) {
        if (res.streak! >= 3) flagSound.playStreak();
        else flagSound.playCorrect();
      } else {
        flagSound.playWrong();
      }
    });
  };

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    flagSound.setMuted(newMuted);
    if (!newMuted) flagSound.startBackground();
  };

  const timerPercent = (timer / duration) * 100;
  const isUrgent = timer <= 3;
  const progress = totalQuestions > 0 ? ((questionIdx) / totalQuestions) * 100 : 0;

  if (phase === "connecting") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950" dir={dir}>
          {error ? (
            <div className="text-center px-6">
              <div className="text-5xl mb-4">😕</div>
              <p className="text-red-500 dark:text-red-400 font-bold text-lg mb-4">{error}</p>
              <button onClick={() => setLocation("/game/capitals")} className="px-6 py-3 rounded-xl bg-teal-600 text-white font-bold">{lang === "ar" ? "العودة" : "Go Back"}</button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-teal-500/30 border-t-teal-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-white/70 font-medium">{lang === "ar" ? "جاري الاتصال..." : "Connecting..."}</p>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (phase === "waiting") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950" dir={dir}>
          <div className="text-center px-6">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-5">🏛️</motion.div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{lang === "ar" ? "أنت في اللعبة!" : "You're in!"}</h2>
            <div className="bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-2xl px-6 py-4 mb-4 shadow-sm dark:shadow-none">
              <p className="text-teal-600 dark:text-teal-400 font-black text-xl">{playerName}</p>
            </div>
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }} className="flex items-center justify-center gap-2 text-gray-500 dark:text-white/50 text-sm">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              {lang === "ar" ? "في انتظار بدء اللعبة من المضيف..." : "Waiting for host to start..."}
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "countdown") {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950 relative overflow-hidden" dir={dir}>
          <AnimatePresence mode="wait">
            <motion.div
              key={countdownNum}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="text-center relative z-10"
            >
              <div className={`text-9xl font-black mb-4 ${countdownNum <= 0 ? "text-teal-600 dark:text-teal-400" : "text-gray-900 dark:text-white"}`}>
                {countdownNum > 0 ? countdownNum : "🚀"}
              </div>
              <p className="text-gray-500 dark:text-white/60 text-xl font-bold">
                {countdownNum > 0 ? (lang === "ar" ? "استعد!" : "Get Ready!") : (lang === "ar" ? "انطلق!" : "GO!")}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </Layout>
    );
  }

  if (phase === "finished") {
    const players = finalResults?.players || [];
    const myResult = players.find(p => p.name === myName);
    const myFinalRank = myResult?.rank || 0;

    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950 py-8 px-4" dir={dir}>
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 150, delay: 0.1 }}
                className="text-7xl mb-3"
              >
                {myFinalRank === 1 ? "🏆" : myFinalRank === 2 ? "🥈" : myFinalRank === 3 ? "🥉" : "🎮"}
              </motion.div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">{lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}</h1>
              {myResult && (
                <p className="text-gray-500 dark:text-white/60 text-sm">
                  {lang === "ar" ? `ترتيبك: #${myFinalRank} | النقاط: ${myResult.score}` : `Your rank: #${myFinalRank} | Score: ${myResult.score}`}
                </p>
              )}
            </motion.div>

            {players.length > 0 && (
              <div className="mb-5">
                {players[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-r from-yellow-500/25 to-amber-500/25 border-2 border-yellow-500/40 rounded-2xl p-4 mb-3 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-yellow-700 dark:text-yellow-300 text-base">{players[0].name}</p>
                      <p className="text-xs text-gray-500 dark:text-white/50">{players[0].correctCount}/{players[0].totalQuestions} {lang === "ar" ? "صحيح" : "correct"}</p>
                    </div>
                    <p className="font-black text-yellow-600 dark:text-yellow-400 text-2xl">{players[0].score}</p>
                  </motion.div>
                )}

                <div className="space-y-2">
                  {players.slice(1, 10).map((p, i) => {
                    const rank = i + 2;
                    const isMe = p.name === myName;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.08 }}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? "bg-teal-500/20 border-teal-500/40" : rank === 2 ? "bg-white dark:bg-white/10 border-gray-200 dark:border-white/15" : rank === 3 ? "bg-orange-500/10 border-orange-500/20" : "bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5"}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${rank === 2 ? "bg-gray-300 dark:bg-slate-600 text-gray-800 dark:text-slate-100" : rank === 3 ? "bg-orange-600 text-white" : "bg-gray-200 dark:bg-white/20 text-gray-700 dark:text-white"}`}>
                          {rank === 2 ? <Medal className="w-4 h-4" /> : rank === 3 ? <Medal className="w-4 h-4" /> : rank}
                        </div>
                        <div className="flex-1">
                          <p className={`font-black text-sm ${isMe ? "text-teal-600 dark:text-teal-300" : "text-gray-900 dark:text-white"}`}>{p.name}{isMe && " 👈"}</p>
                          <p className="text-xs text-gray-400 dark:text-white/40">{p.correctCount}/{p.totalQuestions} {lang === "ar" ? "صحيح" : "correct"}</p>
                        </div>
                        <div className="text-end">
                          <p className={`font-black text-base ${isMe ? "text-teal-600 dark:text-teal-400" : "text-gray-800 dark:text-white/80"}`}>{p.score}</p>
                          {p.streak > 0 && <p className="text-xs text-orange-400">🔥 {p.streak}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={() => setLocation("/game/capitals")} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" />
                {lang === "ar" ? "لعبة جديدة" : "New Game"}
              </button>
              <button onClick={() => setLocation("/")} className="w-full py-2.5 text-sm font-medium text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white transition-colors flex items-center justify-center gap-1.5">
                <Home className="w-4 h-4" />
                {lang === "ar" ? "الرئيسية" : "Home"}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "leaderboard") {
    const myLbEntry = leaderboard.find(l => l.name === myName);
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950 py-8 px-4" dir={dir}>
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <p className="text-gray-500 dark:text-white/50 text-sm font-bold">{lang === "ar" ? "سؤال" : "Question"} {questionIdx + 1}/{totalQuestions}</p>
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">{lang === "ar" ? "الترتيب الحالي" : "Current Standings"}</h2>
              {myLbEntry && (
                <div className="mt-2 inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 rounded-full">
                  <span className="text-teal-600 dark:text-teal-300 font-bold text-sm">{lang === "ar" ? `أنت: #${myLbEntry.rank}` : `You: #${myLbEntry.rank}`}</span>
                  <span className="text-gray-500 dark:text-white/60 text-xs">{myLbEntry.score} {lang === "ar" ? "نقطة" : "pts"}</span>
                </div>
              )}
            </motion.div>

            <div className="space-y-2 mb-6">
              {leaderboard.slice(0, 8).map((entry, i) => {
                const isMe = entry.name === myName;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isMe ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? "bg-teal-500/20 border-teal-500/40 shadow-lg shadow-teal-500/10" : i === 0 ? "bg-yellow-500/10 border-yellow-500/20" : "bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5"}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${i === 0 ? "bg-yellow-500 text-white" : i === 1 ? "bg-gray-300 dark:bg-slate-600 text-gray-800 dark:text-slate-100" : i === 2 ? "bg-orange-600 text-white" : "bg-gray-200 dark:bg-white/15 text-gray-700 dark:text-white"}`}>
                      {i === 0 ? <Crown className="w-4 h-4" /> : entry.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-bold text-sm truncate block ${isMe ? "text-teal-600 dark:text-teal-300" : "text-gray-900 dark:text-white"}`}>{entry.name}{isMe && " 👈"}</span>
                      {entry.streak >= 3 && <span className="text-orange-400 text-xs">🔥 {entry.streak}</span>}
                    </div>
                    <span className={`font-black text-base ${isMe ? "text-teal-600 dark:text-teal-400" : "text-gray-800 dark:text-white/80"}`}>{entry.score}</span>
                  </motion.div>
                );
              })}
            </div>

            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-center">
              <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-white/40 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                {lang === "ar" ? "السؤال التالي قادم..." : "Next question coming..."}
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  const questionText = question?.questionMode === "country-to-capital"
    ? (lang === "ar" ? `ما عاصمة ${question?.countryNameAr}؟` : `What is the capital of ${question?.countryNameEn}?`)
    : (lang === "ar" ? `${question?.capitalAr} هي عاصمة أي دولة؟` : `${question?.capitalEn} is the capital of which country?`);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-100 dark:from-gray-900 dark:via-slate-900 dark:to-gray-950 py-4 px-4 relative overflow-hidden" dir={dir}>
        <AnimatePresence>
          {feedbackType && (
            <motion.div
              key={feedbackType + questionIdx}
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
              <span className="text-xs font-bold text-gray-500 dark:text-white/50 bg-gray-200/80 dark:bg-white/10 px-2.5 py-1 rounded-lg">{questionIdx + 1}/{totalQuestions}</span>
              <button onClick={toggleMute} className="p-1.5 rounded-lg bg-gray-200/80 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <AnimatePresence>
                {myStreak >= 3 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-1 text-orange-400 font-black">
                    <Flame className="w-4 h-4" /> {myStreak}🔥
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="font-black text-gray-900 dark:text-white">{myScore} <span className="text-xs text-gray-500 dark:text-white/50">{lang === "ar" ? "نقطة" : "pts"}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
            {answeredCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-white/40">
                <Users className="w-3 h-3" />
                <span>{answeredCount}/{totalPlayers}</span>
              </div>
            )}
          </div>

          <div className={`h-2 rounded-full overflow-hidden mb-4 ${isUrgent ? "bg-red-100 dark:bg-red-900/50" : "bg-gray-200 dark:bg-white/10"}`}>
            <motion.div
              className={`h-full rounded-full transition-colors duration-300 ${isUrgent ? "bg-red-500" : timer <= duration * 0.5 ? "bg-amber-400" : "bg-teal-400"}`}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {question && (
            <AnimatePresence mode="wait">
              <motion.div key={questionIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                <div className={`rounded-3xl shadow-xl overflow-hidden mb-4 border-2 transition-colors ${phase === "feedback" ? (feedback?.correct ? "border-green-500/60" : "border-red-500/60") : "border-gray-200 dark:border-white/10"}`}>
                  <div className="relative bg-white dark:bg-gradient-to-br dark:from-white/10 dark:to-white/5 p-6 flex flex-col items-center justify-center min-h-[160px]">
                    {question.questionMode === "capital-to-country" && (
                      <div className="text-4xl mb-2">🌍</div>
                    )}
                    <p className="text-center font-black text-gray-900 dark:text-white text-xl leading-snug">{questionText}</p>
                    <div className={`absolute top-3 end-3 w-12 h-12 rounded-full flex items-center justify-center font-black text-base ${isUrgent ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50" : "bg-gray-100 dark:bg-white/20 text-gray-700 dark:text-white"}`}>
                      {Math.ceil(timer)}
                    </div>
                    <AnimatePresence>
                      {phase === "feedback" && feedback?.correct && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {["🎉", "⭐", "✨", "🌟", "💫"].map((e, i) => (
                            <motion.span key={i} initial={{ scale: 0, x: 0, y: 0 }} animate={{ scale: [0, 1.8, 0], x: (i - 2) * 55, y: [0, -70] }} transition={{ duration: 0.85, delay: i * 0.07 }} className="absolute text-2xl">
                              {e}
                            </motion.span>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={`py-2 px-4 text-center text-xs font-bold text-gray-500 dark:text-white/50 ${phase === "feedback" && feedback?.correct ? "bg-green-500/30" : phase === "feedback" ? "bg-red-500/20" : "bg-gray-50 dark:bg-white/5"}`}>
                    {question.questionMode === "country-to-capital"
                      ? (lang === "ar" ? "اختر العاصمة الصحيحة" : "Choose the correct capital")
                      : (lang === "ar" ? "اختر الدولة الصحيحة" : "Choose the correct country")}
                  </div>
                </div>

                <AnimatePresence>
                  {phase === "feedback" && feedback && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2 mb-3">
                      {feedback.correct ? (
                        <>
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-500 dark:text-yellow-400 font-black">+100</span>
                          {feedback.streak >= 3 && <span className="text-orange-400 font-bold text-xs">🔥 {feedback.streak}</span>}
                        </>
                      ) : (
                        <span className="text-red-500 dark:text-red-400 font-bold text-sm">❌ {lang === "ar" ? "خطأ!" : "Wrong!"}</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-3">
                  {question.options.map((opt, idx) => {
                    const color = OPTION_COLORS[idx];
                    const isSelected = selected === opt.value;
                    const isFb = phase === "feedback" && feedback;
                    const isCorrectOpt = feedback?.correctAnswer === opt.value;

                    let btnClass = `${color.bg} ${color.text} shadow-lg`;
                    if (isFb) {
                      if (isCorrectOpt) {
                        btnClass = "bg-green-500 text-white ring-4 ring-green-300 shadow-lg shadow-green-500/30";
                      } else if (isSelected && !isCorrectOpt) {
                        btnClass = "bg-red-700 text-white ring-4 ring-red-400 shadow-lg opacity-80";
                      } else {
                        btnClass = `${color.bg} ${color.text} opacity-30`;
                      }
                    }

                    return (
                      <motion.button
                        key={opt.value}
                        whileTap={isFb ? undefined : { scale: 0.92 }}
                        whileHover={isFb ? undefined : { scale: 1.03, y: -2 }}
                        disabled={!!selected}
                        onClick={() => handleAnswer(opt.value)}
                        className={`relative p-4 rounded-2xl transition-all text-center font-bold text-sm min-h-[72px] flex flex-col items-center justify-center gap-1 ${btnClass} disabled:cursor-default`}
                      >
                        <span className="text-lg opacity-50">{OPTION_SHAPES[idx]}</span>
                        <span className="text-sm font-black leading-tight">{lang === "ar" ? opt.labelAr : opt.label}</span>
                        {isFb && isCorrectOpt && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 end-2">
                            <Check className="w-5 h-5 text-white drop-shadow-md" />
                          </motion.div>
                        )}
                        {isFb && isSelected && !isCorrectOpt && (
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
          )}
        </div>
      </div>
    </Layout>
  );
}
