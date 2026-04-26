import { useState, useEffect, useRef } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Trophy, Copy, Check, ArrowRight, ArrowLeft, Crown, Medal,
  Loader2, Users, Star, Wifi, WifiOff,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Player {
  name: string;
  playerToken: string;
  level: number;
  prize: number;
  correctCount: number;
  status: "playing" | "won" | "wrong" | "quit";
  connected: boolean;
  totalTimeMs: number;
  lifelinesUsed: number;
  score: number;
}

function formatTime(ms: number): string {
  if (!ms) return "--";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function formatPrize(n: number): string {
  return n.toLocaleString("en-US");
}

const STATUS_LABEL: Record<Player["status"], { ar: string; en: string; color: string }> = {
  playing: { ar: "يلعب", en: "Playing", color: "#60a5fa" },
  won: { ar: "فاز! 🏆", en: "Won! 🏆", color: "#f59e0b" },
  wrong: { ar: "خرج ✗", en: "Out ✗", color: "#f87171" },
  quit: { ar: "ودّع 👋", en: "Quit 👋", color: "#94a3b8" },
};

export default function MillionClassHost() {
  const { pin } = useParams<{ pin: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const urlParams = new URLSearchParams(search);
  const hostToken = urlParams.get("token") || "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(getSocket());

  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}game/million/join/${pin}`;

  useEffect(() => {
    if (!pin || !hostToken) {
      toast.error(lang === "ar" ? "بيانات غير صحيحة" : "Invalid session data");
      setLocation("/game/million");
      return;
    }

    const socket = socketRef.current;

    socket.emit("million-class:create", { pin, hostToken }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) {
        toast.error(res.error);
        setLocation("/game/million");
        return;
      }
      setConnected(true);
    });

    socket.on("million-class:leaderboard", (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("million-class:create", { pin, hostToken }, () => {});
    });

    return () => {
      socket.off("million-class:leaderboard");
      socket.off("disconnect");
      socket.off("connect");
    };
  }, [pin, hostToken, lang, setLocation]);

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied!");
    });
  }

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-400" />;
    if (i === 1) return <Medal className="w-4 h-4 text-slate-400" />;
    if (i === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-bold text-slate-500">{i + 1}</span>;
  };

  const activePlayers = players.filter(p => p.status === "playing").length;
  const finishedPlayers = players.filter(p => p.status !== "playing").length;

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-6 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-[#0a1628] dark:via-[#0d1f3c] dark:to-[#0a1628]"
        dir={dir}
      >
        <div className="max-w-5xl mx-auto">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => setLocation("/game/million")}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition-colors"
            >
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "الألعاب" : "Games"}
            </button>
            <div className="flex items-center gap-2 text-xs font-medium">
              {connected
                ? <><Wifi className="w-4 h-4 text-green-400" /><span className="text-green-400">{lang === "ar" ? "متصل" : "Connected"}</span></>
                : <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400">{lang === "ar" ? "غير متصل" : "Disconnected"}</span></>
              }
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-1">
              {lang === "ar" ? "منافسة صفية — من سيحصد المليون؟" : "Class Competition — Who Wants a Million?"}
            </h1>
            <p className="text-blue-600 dark:text-blue-300 text-sm">
              {lang === "ar"
                ? `${activePlayers} يلعب الآن · ${finishedPlayers} أنهى`
                : `${activePlayers} playing · ${finishedPlayers} finished`}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="md:col-span-1 rounded-2xl p-5 flex flex-col items-center gap-4 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10"
            >
              <div className="bg-white dark:bg-gray-100 rounded-2xl p-3">
                <QRCodeSVG value={joinUrl} size={160} level="H" />
              </div>

              <div className="text-center">
                <p className="text-blue-500 dark:text-blue-400 text-xs mb-1">
                  {lang === "ar" ? "رمز الغرفة" : "Room Code"}
                </p>
                <p className="text-gray-900 dark:text-white font-black text-4xl tracking-widest">{pin}</p>
              </div>

              <button
                onClick={copyLink}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 border ${copied ? "bg-green-500/20 border-green-500/40" : "bg-blue-500/20 border-blue-500/30"}`}
              >
                {copied ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <Copy className="w-4 h-4 text-blue-600 dark:text-blue-300" />}
                <span className={copied ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-300"}>
                  {copied
                    ? (lang === "ar" ? "تم النسخ!" : "Copied!")
                    : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}
                </span>
              </button>

              <p className="text-blue-600 dark:text-blue-500 text-xs text-center break-all">{joinUrl}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="md:col-span-2 rounded-2xl p-5 bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10"
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-amber-400" />
                <h2 className="text-gray-900 dark:text-white font-bold text-lg">
                  {lang === "ar" ? "لوحة المنافسة" : "Competition Board"}
                </h2>
                <span className="ms-auto text-blue-500 dark:text-blue-400 text-sm font-medium">{players.length} {lang === "ar" ? "طالب" : "students"}</span>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin mx-auto mb-3" />
                  <p className="text-blue-500 dark:text-blue-400 text-sm">
                    {lang === "ar" ? "في انتظار انضمام الطلاب..." : "Waiting for students to join..."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {players.map((player, i) => {
                      const statusInfo = STATUS_LABEL[player.status];
                      return (
                        <motion.div
                          key={player.playerToken}
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${i === 0 ? "bg-amber-500/12 border-amber-500/30" : "bg-gray-100 dark:bg-white/4 border-gray-200 dark:border-white/8"}`}
                        >
                          <span className="w-5 flex-shrink-0">{rankIcon(i)}</span>
                          <span className="text-gray-900 dark:text-white font-bold text-sm flex-1 truncate">{player.name}</span>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(player.level, 15) }, (_, j) => (
                              <div
                                key={j}
                                className={`w-1.5 h-4 rounded-full ${j < player.level ? "bg-amber-500" : "bg-gray-300 dark:bg-white/10"}`}
                              />
                            ))}
                          </div>

                          <div className="text-center min-w-[80px]">
                            <p className="text-amber-400 font-black text-sm leading-tight">
                              {formatPrize(player.prize)}
                            </p>
                            <p className="text-blue-500 dark:text-blue-400 text-[10px]">
                              {lang === "ar" ? "ر.س" : "pts"}
                            </p>
                          </div>

                          {player.totalTimeMs > 0 && (
                            <div className="text-center min-w-[40px]">
                              <p className="text-cyan-300 font-bold text-xs leading-tight">
                                {formatTime(player.totalTimeMs)}
                              </p>
                              <p className="text-blue-600 dark:text-blue-500 text-[9px]">
                                {lang === "ar" ? "وقت" : "time"}
                              </p>
                            </div>
                          )}

                          {player.lifelinesUsed > 0 && (
                            <span className="text-[10px] text-orange-400 font-bold" title={lang === "ar" ? "مساعدات استخدمها" : "lifelines used"}>
                              💡{player.lifelinesUsed}
                            </span>
                          )}

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: statusInfo.color, background: `${statusInfo.color}20` }}>
                            {lang === "ar" ? statusInfo.ar : statusInfo.en}
                          </span>

                          <span className="text-[10px] text-blue-500 dark:text-blue-400">
                            ✓{player.correctCount}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>

          <div className="text-center">
            <p className="text-blue-600 dark:text-blue-500 text-xs">
              {lang === "ar"
                ? "📱 اطلب من الطلاب فتح الرابط أو مسح الباركود للانضمام"
                : "📱 Ask students to open the link or scan QR code to join"}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
