import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Users, Copy, Check, Eye, Crown,
  Heart, Zap, Trophy, Wifi, WifiOff, BookOpen, MessageCircle, Play
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface PlayerData {
  name: string;
  score: number;
  level: number;
  lives: number;
  streak: number;
  solvedWords: number;
  totalWords: number;
  completionPct: number;
  status: "waiting" | "playing" | "gameover";
}

interface WordEntry {
  word: string;
  hint?: string;
  question?: string;
}

export default function ScrambleMonitor() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const params = new URLSearchParams(searchString);
  const pin = params.get("pin") || "";
  const title = params.get("title") || "";

  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordSet, setWordSet] = useState<{ title: string; words: WordEntry[] } | null>(null);
  const [showWords, setShowWords] = useState(false);
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    if (!pin) return;
    fetch(`${API_BASE}/api/word-sets/${pin}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.words) setWordSet({ title: d.title || "", words: d.words });
      })
      .catch(() => {});
  }, [pin]);

  useEffect(() => {
    if (!pin) return;

    const socket = getSocket();
    socketRef.current = socket;

    socket.emit("scramble:teacher-start", { pin, title });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("scramble:teacher-start", { pin, title });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("scramble:session-started", (data: { players: PlayerData[]; state: string }) => {
      setConnected(true);
      setPlayers(data.players);
      if (data.state === "playing") setGameState("playing");
    });

    socket.on("scramble:players-updated", (data: { players: PlayerData[] }) => {
      setPlayers(data.players);
    });

    return () => {
      socket.emit("scramble:teacher-end");
      socket.off("scramble:session-started");
      socket.off("scramble:players-updated");
    };
  }, [pin, title]);

  const handleStartGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || players.length === 0) return;
    socket.emit("scramble:game-start");
    setGameState("playing");
  }, [players.length]);

  const shareText = useCallback(() => {
    const url = `${window.location.origin}/game/scramble/play?pin=${pin}`;
    return lang === "ar"
      ? `🔤 الكلمات المبعثرة — ${title || "لعبة"}\n🔑 الرمز: ${pin}\n🔗 ${url}`
      : `🔤 Scrambled Words — ${title || "Game"}\n🔑 PIN: ${pin}\n🔗 ${url}`;
  }, [pin, title, lang]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [shareText]);

  const handleWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText())}`;
    window.open(url, "_blank");
  }, [shareText]);

  const activePlayers = players.filter(p => p.status === "playing");
  const finishedPlayers = players.filter(p => p.status === "gameover");
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-gray-950 py-6 px-4" dir={dir}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setLocation("/game/scramble")}
              className="p-2 rounded-xl bg-white/10 text-white/60 hover:text-white transition-colors">
              <BackArrow className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                {lang === "ar" ? "مراقبة مباشرة" : "Live Monitor"}
              </h1>
              {title && <p className="text-white/50 text-xs">{title}</p>}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
              {connected ? (
                <Wifi className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className="text-[10px] font-bold text-white/60">
                {connected ? (lang === "ar" ? "متصل" : "Connected") : (lang === "ar" ? "غير متصل" : "Disconnected")}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-white/40 text-[10px] font-bold mb-0.5">{lang === "ar" ? "رمز اللعبة" : "Game PIN"}</p>
                <p className="text-3xl font-black text-purple-400 tracking-[0.2em]" dir="ltr">{pin}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-purple-600/30 text-purple-300 font-bold text-xs flex items-center gap-1.5 hover:bg-purple-600/50 transition-all">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? (lang === "ar" ? "تم!" : "Copied!") : (lang === "ar" ? "نسخ" : "Copy")}
                </button>
                <button onClick={handleWhatsApp}
                  className="px-3 py-2 rounded-lg bg-green-600/30 text-green-300 font-bold text-xs flex items-center gap-1.5 hover:bg-green-600/50 transition-all">
                  <MessageCircle className="w-4 h-4" />
                  {lang === "ar" ? "واتساب" : "WhatsApp"}
                </button>
              </div>
            </div>
          </div>

          {wordSet && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
              <button onClick={() => setShowWords(!showWords)}
                className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span className="text-white/70 font-bold text-xs">
                    {lang === "ar" ? `الكلمات (${wordSet.words.length})` : `Words (${wordSet.words.length})`}
                  </span>
                </div>
                <span className="text-white/30 text-[10px]">{showWords ? "▲" : "▼"}</span>
              </button>
              {showWords && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {wordSet.words.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded-lg bg-white/3" dir={dir}>
                      <span className="text-[10px] text-white/30 font-bold w-5 shrink-0 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-xs">{w.word}</p>
                        {w.question && <p className="text-blue-300 text-[10px]">{w.question}</p>}
                        {w.hint && <p className="text-white/30 text-[10px]">{w.hint}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {gameState === "lobby" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-2 border-purple-500/30 rounded-xl p-5 mb-4 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-purple-500/30 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-purple-300" />
              </div>
              <p className="text-white font-bold text-sm mb-1">
                {lang === "ar"
                  ? `${players.length} ${players.length === 1 ? "طالب" : "طلاب"} في غرفة الانتظار`
                  : `${players.length} student${players.length !== 1 ? "s" : ""} in lobby`}
              </p>
              <p className="text-white/40 text-xs mb-4">
                {lang === "ar" ? "شارك الرمز مع طلابك ثم اضغط ابدأ" : "Share the PIN then press Start"}
              </p>
              <button
                onClick={handleStartGame}
                disabled={players.length === 0}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg shadow-lg shadow-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-6 h-6" />
                {lang === "ar" ? "ابدأ اللعبة!" : "Start Game!"}
              </button>
            </motion.div>
          )}

          {gameState === "playing" && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-black text-white">{players.length}</p>
                <p className="text-[10px] text-white/40 font-bold">{lang === "ar" ? "إجمالي اللاعبين" : "Total Players"}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Zap className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-black text-green-400">{activePlayers.length}</p>
                <p className="text-[10px] text-white/40 font-bold">{lang === "ar" ? "يلعبون الآن" : "Playing Now"}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-400">{finishedPlayers.length}</p>
                <p className="text-[10px] text-white/40 font-bold">{lang === "ar" ? "انتهوا" : "Finished"}</p>
              </div>
            </div>
          )}

          {gameState === "lobby" && players.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-white/40 text-xs font-bold mb-1">
                {lang === "ar" ? "الطلاب في غرفة الانتظار" : "Students in Lobby"}
              </p>
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div
                    key={player.name}
                    initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-purple-300 font-bold text-xs">{i + 1}</span>
                    </div>
                    <p className="font-bold text-white text-sm flex-1">{player.name}</p>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-bold animate-pulse">
                      {lang === "ar" ? "ينتظر" : "Waiting"}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {gameState === "playing" && players.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-white/60 font-bold text-sm mb-1">
                {lang === "ar" ? "في انتظار الطلاب..." : "Waiting for students..."}
              </p>
              <p className="text-white/30 text-xs">
                {lang === "ar" ? "شارك الرمز مع طلابك للانضمام" : "Share the PIN with your students to join"}
              </p>
            </motion.div>
          )}

          {gameState === "playing" && players.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-bold mb-1">
                {lang === "ar" ? "الترتيب حسب النقاط" : "Ranked by Score"}
              </p>
              <AnimatePresence>
                {sortedPlayers.map((player, i) => (
                  <motion.div
                    key={player.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      player.status === "gameover"
                        ? "bg-white/3 border-white/5 opacity-60"
                        : "bg-white/5 border-white/10"
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                      i === 0 ? "bg-amber-500 text-white" :
                      i === 1 ? "bg-gray-400 dark:bg-slate-600 text-gray-900 dark:text-slate-100" :
                      i === 2 ? "bg-orange-600 text-white" :
                      "bg-white/10 text-white/50"
                    }`}>
                      {i === 0 ? <Crown className="w-4 h-4" /> : i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-sm truncate">{player.name}</p>
                        {player.status === "playing" && (
                          <span className="px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[9px] font-bold animate-pulse">
                            {lang === "ar" ? "يلعب" : "Playing"}
                          </span>
                        )}
                        {player.status === "gameover" && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold">
                            {lang === "ar" ? "انتهى" : "Done"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-white/40">
                        <span className="flex items-center gap-0.5">
                          <Zap className="w-3 h-3" />
                          {lang === "ar" ? `المستوى ${player.level}` : `Lv ${player.level}`}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3 text-red-400" />
                          {player.lives}
                        </span>
                        {player.streak > 0 && (
                          <span className="text-orange-400">🔥{player.streak}</span>
                        )}
                        {player.totalWords > 0 && (
                          <span className="text-blue-300">
                            {lang === "ar" ? `${player.solvedWords}/${player.totalWords} كلمة` : `${player.solvedWords}/${player.totalWords} words`}
                          </span>
                        )}
                      </div>
                      {player.totalWords > 0 && (
                        <div className="w-full h-1.5 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              player.completionPct >= 100 ? "bg-green-400" :
                              player.completionPct >= 50 ? "bg-blue-400" : "bg-purple-400"
                            }`}
                            style={{ width: `${Math.min(player.completionPct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="text-end">
                      <p className="font-black text-purple-400 text-lg">{player.score}</p>
                      {player.totalWords > 0 && (
                        <p className="text-[10px] font-bold text-blue-300">{player.completionPct}%</p>
                      )}
                      <p className="text-[9px] text-white/30">{lang === "ar" ? "نقطة" : "pts"}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
