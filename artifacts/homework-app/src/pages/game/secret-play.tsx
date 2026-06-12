import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { io as socketIO, Socket } from "socket.io-client";
import { Eye, RefreshCw, Trophy, AlertTriangle, Check, X, QrCode, RotateCcw, Plus } from "lucide-react";
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
  winner: Team | null;
  winnerName: string;
  secrets: { A: { name: string; image: string | null }; B: { name: string; image: string | null } };
}

const BASE = typeof window !== "undefined" ? window.location.origin : "";

function playSound(type: "question" | "win" | "answer") {
  try {
    const ctx = new AudioContext();
    if (type === "question") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 660; osc.type = "sine";
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
    } else if (type === "win") {
      [440, 554, 659, 880].forEach((freq, i) => {
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          osc2.connect(g2); g2.connect(ctx.destination);
          osc2.frequency.value = freq; osc2.type = "sine";
          g2.gain.setValueAtTime(0.3, ctx.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.3);
        }, i * 130);
      });
    } else if (type === "answer") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 440; osc.type = "sine";
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    }
    setTimeout(() => ctx.close(), 2000);
  } catch { /* ignore if AudioContext blocked */ }
}

function QRPanel({ token, teamName, teamColor, scanned }: { token: string; teamName: string; teamColor: string; scanned: boolean }) {
  const url = `${BASE}/game/secret/reveal?token=${encodeURIComponent(token)}`;
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl border"
      style={{ background: `${teamColor}10`, borderColor: `${teamColor}40` }}>
      <p className="text-xs font-black" style={{ color: teamColor }}>{teamName}</p>
      <div className="bg-white p-1.5 rounded-lg">
        <QRCode value={url} size={110} />
      </div>
      <p className="text-[10px] font-bold" style={{ color: scanned ? "#22c55e" : teamColor }}>
        {scanned ? "✅ تم المسح" : "امسح الباركود"}
      </p>
    </div>
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
  const [lastAnswer, setLastAnswer] = useState<"yes" | "no" | null>(null);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [nextRoundLoading, setNextRoundLoading] = useState(false);
  const [newTokenA, setNewTokenA] = useState<string | null>(null);
  const [newTokenB, setNewTokenB] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);

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
    socket.on("secret:question_asked", (s: GameState) => {
      setGameState(s);
      setLastAnswer(null);
      playSound("question");
    });
    socket.on("secret:answered", ({ answer, state }: { answer: "yes" | "no"; state: GameState }) => {
      setGameState(state);
      setLastAnswer(answer);
      playSound("answer");
      setTimeout(() => setLastAnswer(null), 3500);
    });
    socket.on("secret:game_over", (data: { winner: Team | null; winnerName: string; secrets: EndData["secrets"]; state: GameState }) => {
      setGameState(data.state);
      setEndData({ winner: data.winner, winnerName: data.winnerName, secrets: data.secrets });
      if (data.winner) playSound("win");
    });
    socket.on("secret:wrong_guess", ({ state }: { state: GameState }) => {
      setGameState(state);
    });
    socket.on("secret:new_round", (data: { tokenA: string; tokenB: string } & GameState) => {
      setGameState(data);
      setNewTokenA(data.tokenA);
      setNewTokenB(data.tokenB);
      setEndData(null);
      setLastAnswer(null);
      setShowQR(true);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [pin, setLocation]);

  const emitQuestion = useCallback(() => {
    if (questionLoading) return;
    setQuestionLoading(true);
    socketRef.current?.emit("secret:question", { pin }, (res: { ok?: boolean; error?: string }) => {
      setQuestionLoading(false);
      if (res?.error) { setWrongMsg(res.error); setTimeout(() => setWrongMsg(null), 3000); }
    });
  }, [pin, questionLoading]);

  const emitAnswer = useCallback((answer: "yes" | "no") => {
    socketRef.current?.emit("secret:answer", { pin, answer });
  }, [pin]);

  const emitGuess = useCallback((team: Team) => {
    socketRef.current?.emit("secret:guess", { pin, team }, (res: { correct?: boolean; error?: string }) => {
      if (res?.error) { setWrongMsg(res.error); setTimeout(() => setWrongMsg(null), 3000); }
    });
  }, [pin]);

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
  const { teams, phase, maxQuestions, totalQuestions } = gameState;
  const pct = maxQuestions > 0 ? (totalQuestions / maxQuestions) * 100 : 0;

  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg,#0d0d1a 0%,#120d1f 100%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-400" />
          <span className="text-white font-black text-lg">اكتشف السر</span>
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
              <p className="text-center text-white/60 text-xs mb-3">
                {phase === "waiting_scan" ? "🔍 في انتظار مسح الباركود من قائدَي الفريقين" : "باركودات الجولة الجديدة"}
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                <QRPanel token={effectiveTokenA} teamName={teams.A.name} teamColor={teams.A.color} scanned={teams.A.scanned} />
                <QRPanel token={effectiveTokenB} teamName={teams.B.name} teamColor={teams.B.color} scanned={teams.B.scanned} />
              </div>
              {phase === "waiting_scan" && (
                <div className="flex justify-center mt-3">
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

      {/* Game Over Modal */}
      <AnimatePresence>
        {endData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
            <motion.div initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-3xl p-6 text-center border-2"
              dir="rtl"
              style={{ background: "linear-gradient(160deg,#1a0e2e,#0d0720)", borderColor: endData.winner ? teams[endData.winner].color : "#6b7280" }}>
              <Trophy className="w-14 h-14 mx-auto mb-3" style={{ color: endData.winner ? teams[endData.winner].color : "#9ca3af" }} />
              <h2 className="text-3xl font-black text-white mb-1">{endData.winnerName}</h2>
              <p className="text-white/50 mb-5">{endData.winner ? "عرف السر وفاز!" : "انتهى الحد الأقصى للأسئلة — تعادل"}</p>
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
                  className="flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                  {nextRoundLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  جولة جديدة
                </button>
                <button onClick={() => setLocation("/game/secret")}
                  className="flex-1 py-3 rounded-xl font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20">
                  إنهاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Error Banner */}
        <AnimatePresence>
          {wrongMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 px-4 py-2.5 rounded-xl text-sm font-bold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {wrongMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Shared Question Counter ─── */}
        {phase === "playing" && (
          <motion.div layout className="rounded-2xl border border-white/10 p-5 flex flex-col items-center gap-3"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-white/40 text-xs font-bold tracking-widest uppercase">عدد الأسئلة</p>

            {/* Big number */}
            <motion.div key={totalQuestions}
              initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-7xl font-black text-white">
              {totalQuestions}
            </motion.div>
            <p className="text-white/30 text-sm">من {maxQuestions}</p>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full"
                animate={{ width: `${pct}%` }}
                style={{ background: pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#a855f7" }}
                transition={{ type: "spring", stiffness: 80 }}
              />
            </div>

            {/* Last Answer Badge */}
            <AnimatePresence>
              {lastAnswer && (
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-xl border-2 ${
                    lastAnswer === "yes"
                      ? "bg-green-500/20 border-green-400 text-green-300"
                      : "bg-red-500/20 border-red-400 text-red-300"
                  }`}>
                  {lastAnswer === "yes" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  {lastAnswer === "yes" ? "نعم ✓" : "لا ✗"}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── Yes / No Answer Buttons ─── */}
        {phase === "playing" && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => emitAnswer("yes")}
              className="py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-green-500/15 border-2 border-green-500/50 text-green-300 hover:bg-green-500/25 transition-all">
              <Check className="w-5 h-5" /> نعم
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => emitAnswer("no")}
              className="py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-red-500/15 border-2 border-red-500/50 text-red-300 hover:bg-red-500/25 transition-all">
              <X className="w-5 h-5" /> لا
            </motion.button>
          </div>
        )}

        {/* ─── New Question Button ─── */}
        {phase === "playing" && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={emitQuestion}
            disabled={questionLoading || totalQuestions >= maxQuestions}
            className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 border-2 border-purple-500"
            style={{ background: "rgba(168,85,247,0.15)", color: "#d8b4fe" }}
          >
            {questionLoading
              ? <RefreshCw className="w-5 h-5 animate-spin" />
              : <Plus className="w-6 h-6" />
            }
            سؤال جديد
          </motion.button>
        )}

        {/* ─── Team Guess Buttons ─── */}
        {phase === "playing" && (
          <div className="grid grid-cols-2 gap-3">
            {(["A", "B"] as Team[]).map((t) => (
              <motion.button
                key={t}
                whileTap={{ scale: 0.96 }}
                onClick={() => emitGuess(t)}
                className="py-4 rounded-2xl font-black text-sm border-2 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  borderColor: teams[t].color,
                  background: `${teams[t].color}15`,
                  color: teams[t].color,
                }}
              >
                <span className="text-xl">🎯</span>
                <span>{teams[t].name}</span>
                <span className="text-[10px] opacity-70">عرف السر!</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
