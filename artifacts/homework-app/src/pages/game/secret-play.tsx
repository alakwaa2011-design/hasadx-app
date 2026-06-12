import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { io as socketIO, Socket } from "socket.io-client";
import { Eye, RefreshCw, Trophy, AlertTriangle, Check, X, HelpCircle, QrCode, RotateCcw, ChevronRight } from "lucide-react";
import QRCode from "react-qr-code";

type Phase = "waiting_scan" | "playing" | "guessing" | "ended";
type Team = "A" | "B";

interface TeamState {
  name: string;
  color: string;
  scanned: boolean;
  questionCount: number;
  penalty: boolean;
}
interface GameState {
  pin: string;
  teams: { A: TeamState; B: TeamState };
  currentAsker: Team;
  totalQuestions: number;
  maxQuestions: number;
  phase: Phase;
  winner: Team | null;
}

interface EndData {
  winner: Team;
  winnerName: string;
  secrets: { A: { name: string; image: string | null }; B: { name: string; image: string | null } };
}

const BASE = typeof window !== "undefined" ? window.location.origin : "";

function QRPanel({ token, teamName, teamColor, label }: { token: string; teamName: string; teamColor: string; label: string }) {
  const url = `${BASE}/game/secret/reveal?token=${encodeURIComponent(token)}`;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 p-4 rounded-2xl border"
      style={{ background: `${teamColor}15`, borderColor: `${teamColor}40` }}>
      <p className="text-sm font-bold" style={{ color: teamColor }}>{teamName}</p>
      <p className="text-white/40 text-xs">{label}</p>
      <div className="bg-white p-2 rounded-xl">
        <QRCode value={url} size={140} />
      </div>
      <p className="text-white/30 text-[10px] break-all max-w-[160px] text-center" dir="ltr">{url.slice(0, 50)}…</p>
    </motion.div>
  );
}

function BubbleCounter({ count, max, color }: { count: number; max: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={i === count - 1 ? { scale: 1.4 } : {}}
          animate={{ scale: 1 }}
          className="w-5 h-5 rounded-full border-2 transition-all"
          style={{
            background: i < count ? color : "transparent",
            borderColor: i < count ? color : `${color}40`,
          }}
        />
      ))}
    </div>
  );
}

function TeamCard({ team, state, isAsking, isAnswering, onYes, onNo, onGuess, onAnswer, showAnswerBtns }: {
  team: Team; state: TeamState; isAsking: boolean; isAnswering: boolean;
  onYes: () => void; onNo: () => void; onGuess: () => void; onAnswer: (a: "yes" | "no") => void;
  showAnswerBtns: boolean;
}) {
  return (
    <motion.div
      layout
      className="rounded-2xl p-4 border-2 flex flex-col gap-3"
      style={{
        background: `${state.color}12`,
        borderColor: isAsking ? state.color : isAnswering ? `${state.color}80` : `${state.color}30`,
        boxShadow: isAsking ? `0 0 20px ${state.color}30` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
            style={{ background: state.color, color: "white" }}>
            {team}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{state.name}</p>
            {state.penalty && <p className="text-red-400 text-xs font-bold">⏳ عقوبة 30ث</p>}
          </div>
        </div>
        {isAsking && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="text-xs font-black px-2 py-1 rounded-lg"
            style={{ background: state.color, color: "white" }}
          >
            يسأل الآن
          </motion.span>
        )}
        {isAnswering && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="text-xs font-black px-2 py-1 rounded-lg bg-white/10 text-white/70"
          >
            يجيب
          </motion.span>
        )}
      </div>

      <BubbleCounter count={state.questionCount} max={5} color={state.color} />
      <p className="text-white/40 text-xs text-center">{state.questionCount} سؤال تم طرحه</p>

      {showAnswerBtns && isAnswering && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mt-1">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onYes}
            className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 bg-green-500/20 border border-green-500/50 text-green-300 hover:bg-green-500/30 transition-all">
            <Check className="w-4 h-4" /> نعم
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={onNo}
            className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30 transition-all">
            <X className="w-4 h-4" /> لا
          </motion.button>
        </motion.div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onGuess}
        disabled={state.penalty}
        className="w-full py-2.5 rounded-xl font-black text-sm border transition-all disabled:opacity-30"
        style={{ borderColor: `${state.color}60`, color: state.color, background: `${state.color}10` }}
      >
        🎯 عرفت! أنا أعرف السر
      </motion.button>
    </motion.div>
  );
}

export default function SecretPlay() {
  const [, setLocation] = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const pin = sessionStorage.getItem("secret_game_pin") ?? "";
  const tokenA = sessionStorage.getItem("secret_game_tokenA") ?? "";
  const tokenB = sessionStorage.getItem("secret_game_tokenB") ?? "";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [endData, setEndData] = useState<EndData | null>(null);
  const [lastAnswer, setLastAnswer] = useState<{ answer: "yes" | "no"; team: Team } | null>(null);
  const [guessTeam, setGuessTeam] = useState<Team | null>(null);
  const [guessText, setGuessText] = useState("");
  const [guessLoading, setGuessLoading] = useState(false);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [newTokenA, setNewTokenA] = useState<string | null>(null);
  const [newTokenB, setNewTokenB] = useState<string | null>(null);

  useEffect(() => {
    if (!pin) { setLocation("/game/secret"); return; }
    const socket = socketIO({ path: "/api/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("secret:get_state", { pin }, (res: { state?: GameState; error?: string }) => {
        if (res.state) setGameState(res.state);
      });
    });

    socket.on("secret:state", (s: GameState) => setGameState(s));
    socket.on("secret:started", (s: GameState) => setGameState(s));
    socket.on("secret:question_asked", (s: GameState) => { setGameState(s); setLastAnswer(null); });
    socket.on("secret:answered", ({ answer, state }: { answer: "yes" | "no"; state: GameState }) => {
      setGameState(state);
      setLastAnswer({ answer, team: state.currentAsker });
      setTimeout(() => setLastAnswer(null), 3000);
    });
    socket.on("secret:game_over", (data: { winner: Team; winnerName: string; secrets: EndData["secrets"]; state: GameState }) => {
      setGameState(data.state);
      setEndData({ winner: data.winner, winnerName: data.winnerName, secrets: data.secrets });
    });
    socket.on("secret:wrong_guess", ({ team, state }: { team: Team; state: GameState }) => {
      setGameState(state);
      setWrongMsg(`${state.teams[team].name}: إجابة خاطئة! عقوبة 30 ثانية`);
      setTimeout(() => setWrongMsg(null), 4000);
    });
    socket.on("secret:new_round", (data: { tokenA: string; tokenB: string } & GameState) => {
      setGameState(data);
      setNewTokenA(data.tokenA);
      setNewTokenB(data.tokenB);
      setEndData(null);
      setGuessTeam(null);
      setGuessText("");
      setShowQR(true);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [pin, setLocation]);

  const emitQuestion = useCallback(() => {
    socketRef.current?.emit("secret:question", { pin });
  }, [pin]);

  const emitAnswer = useCallback((answer: "yes" | "no") => {
    socketRef.current?.emit("secret:answer", { pin, answer });
  }, [pin]);

  const submitGuess = useCallback(() => {
    if (!guessTeam || !guessText.trim()) return;
    setGuessLoading(true);
    socketRef.current?.emit("secret:guess", { pin, team: guessTeam, guess: guessText.trim() }, (res: { correct?: boolean; error?: string }) => {
      setGuessLoading(false);
      if (res.error) { setWrongMsg(res.error); setGuessText(""); }
      if (res.correct === false) { setGuessTeam(null); setGuessText(""); }
    });
  }, [pin, guessTeam, guessText]);

  const handleNextRound = useCallback(() => {
    setNextRoundLoading(true);
    socketRef.current?.emit("secret:next_round", { pin }, (res: { tokenA?: string; tokenB?: string; error?: string }) => {
      setNextRoundLoading(false);
      if (res.error) { setWrongMsg(res.error); return; }
      if (res.tokenA) sessionStorage.setItem("secret_game_tokenA", res.tokenA);
      if (res.tokenB) sessionStorage.setItem("secret_game_tokenB", res.tokenB);
    });
  }, [pin]);

  if (!pin) return null;

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d1a" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const effectiveTokenA = newTokenA ?? tokenA;
  const effectiveTokenB = newTokenB ?? tokenB;
  const { teams, currentAsker, phase, winner, maxQuestions } = gameState;
  const answerTeam: Team = currentAsker === "A" ? "B" : "A";

  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg,#0d0d1a 0%,#120d1f 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-400" />
          <span className="text-white font-black text-lg">اكشف السر</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-white/50 text-sm font-mono" dir="ltr">{pin}</div>
          <button onClick={() => setShowQR(!showQR)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QR Panel */}
      <AnimatePresence>
        {(showQR || phase === "waiting_scan") && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-white/10">
            <div className="p-4">
              <p className="text-center text-white/60 text-sm mb-4">
                {phase === "waiting_scan" ? "🔍 انتظار مسح الباركود من قائدَي الفريقين" : "باركودات الجولة الجديدة"}
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <QRPanel token={effectiveTokenA} teamName={teams.A.name} teamColor={teams.A.color} label={teams.A.scanned ? "✅ تم المسح" : "امسح الباركود"} />
                <QRPanel token={effectiveTokenB} teamName={teams.B.name} teamColor={teams.B.color} label={teams.B.scanned ? "✅ تم المسح" : "امسح الباركود"} />
              </div>
              {phase === "waiting_scan" && (
                <div className="flex justify-center mt-4">
                  <button onClick={() => socketRef.current?.emit("secret:force_start", { pin })}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors">
                    بدء اللعبة فوراً
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over */}
      <AnimatePresence>
        {endData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-3xl p-6 text-center border-2"
              dir="rtl"
              style={{ background: "linear-gradient(160deg,#1a0e2e,#0d0720)", borderColor: teams[endData.winner].color }}>
              <Trophy className="w-14 h-14 mx-auto mb-3" style={{ color: teams[endData.winner].color }} />
              <h2 className="text-3xl font-black text-white mb-1">{endData.winnerName}</h2>
              <p className="text-white/50 mb-5">فاز باللعبة!</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(["A", "B"] as Team[]).map((t) => (
                  <div key={t} className="rounded-2xl p-3 border" style={{ background: `${teams[t].color}15`, borderColor: `${teams[t].color}40` }}>
                    <p className="text-xs font-bold mb-2" style={{ color: teams[t].color }}>{teams[t].name} كان سرّه:</p>
                    {endData.secrets[t].image && (
                      <img src={endData.secrets[t].image!} alt={endData.secrets[t].name} className="w-full h-20 object-cover rounded-xl mb-2" />
                    )}
                    <p className="text-white font-black text-lg">{endData.secrets[t].name}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handleNextRound} disabled={nextRoundLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                  {nextRoundLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  جولة جديدة
                </button>
                <button onClick={() => setLocation("/game/secret")}
                  className="flex-1 py-3 rounded-xl font-bold bg-white/10 text-white border border-white/20 transition-all hover:bg-white/20">
                  إنهاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guess Modal */}
      <AnimatePresence>
        {guessTeam && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              className="w-full max-w-sm rounded-2xl p-5 border-2"
              dir="rtl"
              style={{ background: "#1a0e2e", borderColor: teams[guessTeam].color }}>
              <h3 className="text-white font-black text-lg mb-1">{teams[guessTeam].name} يخمّن!</h3>
              <p className="text-white/50 text-sm mb-4">ما هو سرّ الفريق الآخر؟</p>
              <input
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                autoFocus
                placeholder="اكتب تخمينك..."
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 mb-4 focus:outline-none"
                style={{ borderColor: `${teams[guessTeam].color}60` }}
              />
              <div className="flex gap-3">
                <button onClick={submitGuess} disabled={!guessText.trim() || guessLoading}
                  className="flex-1 py-3 rounded-xl font-black text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: teams[guessTeam].color }}>
                  {guessLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  تأكيد
                </button>
                <button onClick={() => { setGuessTeam(null); setGuessText(""); }}
                  className="flex-1 py-3 rounded-xl font-bold bg-white/10 text-white">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <div className="flex-1 p-4 space-y-4">
        {/* Wrong/Error Banner */}
        <AnimatePresence>
          {wrongMsg && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-3 rounded-xl text-sm font-bold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {wrongMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last Answer Badge */}
        <AnimatePresence>
          {lastAnswer && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex justify-center">
              <div className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-lg border-2 ${
                lastAnswer.answer === "yes"
                  ? "bg-green-500/20 border-green-400 text-green-300"
                  : "bg-red-500/20 border-red-400 text-red-300"
              }`}>
                {lastAnswer.answer === "yes" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                {lastAnswer.answer === "yes" ? "نعم" : "لا"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Turn Indicator */}
        {phase === "playing" && (
          <motion.div layout className="text-center py-2">
            <p className="text-white/60 text-sm">
              <span className="font-bold" style={{ color: teams[currentAsker].color }}>{teams[currentAsker].name}</span>
              {" "}يسأل ←{" "}
              <span className="font-bold" style={{ color: teams[answerTeam].color }}>{teams[answerTeam].name}</span>
              {" "}يجيب
            </p>
            <p className="text-white/30 text-xs mt-0.5">إجمالي الأسئلة: {gameState.totalQuestions} / {maxQuestions * 2}</p>
          </motion.div>
        )}

        {/* Team Cards */}
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as Team[]).map((t) => (
            <TeamCard
              key={t}
              team={t}
              state={teams[t]}
              isAsking={phase === "playing" && currentAsker === t}
              isAnswering={phase === "playing" && answerTeam === t}
              showAnswerBtns={phase === "playing"}
              onYes={() => emitAnswer("yes")}
              onNo={() => emitAnswer("no")}
              onGuess={() => setGuessTeam(t)}
              onAnswer={emitAnswer}
            />
          ))}
        </div>

        {/* Add Question Button */}
        {phase === "playing" && (
          <motion.button
            layout
            whileTap={{ scale: 0.97 }}
            onClick={emitQuestion}
            className="w-full py-3.5 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all border-2"
            style={{
              background: `${teams[currentAsker].color}20`,
              borderColor: teams[currentAsker].color,
              color: teams[currentAsker].color,
            }}
          >
            <HelpCircle className="w-5 h-5" />
            تسجيل سؤال — {teams[currentAsker].name}
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
