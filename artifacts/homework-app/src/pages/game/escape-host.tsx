// ─────────────────────────────────────────────────────────────────────────────
// «غرفة الهروب» — DEVICE MODE host screen (teacher).
// Lobby: PIN + QR + live joiner list. Playing: live escape leaderboard —
// every student's lock progress streams in via escape:progress snapshots.
// Standard host controls (Wameeth-style): join bar with PIN/link/QR always
// available, mute, and fullscreen.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, LogOut, Loader2, Users,
  Volume2, VolumeX, Maximize, Minimize,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { HostJoinBar } from "@/components/host-join-bar";
import { EscapeSoundEngine, VaultBackdrop, ESCAPE_BG, GOLD } from "@/components/game/escape-shared";

interface HostPlayer {
  name: string;
  locksOpen: number;
  lockCount: number;
  correct: number;
  wrong: number;
  score: number;
  timeLeft: number;
  status: "waiting" | "playing" | "won" | "lost";
  connected: boolean;
}

export default function EscapeHost() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/escape/host/:pin");
  const pin = params?.pin || "";

  const [phase, setPhase] = useState<"connecting" | "lobby" | "playing" | "results" | "error">("connecting");
  const [players, setPlayers] = useState<HostPlayer[]>([]);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const startedRef = useRef(false);

  const joinUrl = useMemo(() => `${window.location.origin}/game/escape/play?pin=${pin}`, [pin]);

  // ── Sound (ambient + music on the big screen, like other host pages) ──
  const soundRef = useRef<EscapeSoundEngine | null>(null);
  const getSound = useCallback(() => {
    if (!soundRef.current) soundRef.current = new EscapeSoundEngine();
    return soundRef.current;
  }, []);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("escape-muted") === "1"; } catch { return false; }
  });
  useEffect(() => () => { soundRef.current?.destroy(); }, []);
  useEffect(() => {
    const s = getSound();
    if (phase === "playing" && !s.muted) { s.startAmbient(); s.startMusic(); }
    else { s.stopAmbient(); s.stopMusic(); }
  }, [phase, getSound]);
  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
    if (!s.muted && phase === "playing") { s.startAmbient(); s.startMusic(); }
  };

  // ── Fullscreen (standard host control) ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    if (!pin) { setPhase("error"); return; }
    let token = "";
    try { token = sessionStorage.getItem(`escape-creator-${pin}`) || ""; } catch (_) { /* ignore */ }

    const socket = getSocket();

    const bind = () => {
      socket.emit("escape:host-join", { pin, creatorToken: token },
        (res: { ok?: boolean; error?: string; state?: string; players?: HostPlayer[] }) => {
          if (!res?.ok) { setPhase("error"); return; }
          startedRef.current = res.state === "playing";
          setPhase(res.state === "playing" ? "playing" : "lobby");
          if (Array.isArray(res.players)) setPlayers(res.players);
        });
    };

    const onPlayers = (data: { players?: HostPlayer[] }) => {
      if (Array.isArray(data?.players)) setPlayers(data.players);
    };
    const onStarted = () => { startedRef.current = true; setPhase("playing"); };
    const onEnded = () => {
      if (startedRef.current) setPhase("results");
    };

    socket.on("escape:players", onPlayers);
    socket.on("escape:started", onStarted);
    socket.on("escape:ended", onEnded);
    socket.on("connect", bind);
    if (socket.connected) bind();

    return () => {
      socket.off("escape:players", onPlayers);
      socket.off("escape:started", onStarted);
      socket.off("escape:ended", onEnded);
      socket.off("connect", bind);
    };
  }, [pin]);

  const startGame = () => {
    if (players.length === 0) {
      toast.error(ar ? "انتظر انضمام طالب واحد على الأقل" : "Wait for at least one student");
      return;
    }
    getSocket().emit("escape:start");
  };

  const exitGame = () => {
    if (phase !== "playing") {
      getSocket().emit("escape:end");
      setLocation("/teacher/games");
      return;
    }
    if (!window.confirm(ar ? "هل تريد إنهاء المسابقة وعرض النتائج؟" : "End the competition and show the results?")) return;
    getSocket().emit("escape:end");
    setPhase("results");
  };

  const escaped = players.filter(p => p.status === "won").length;
  const finished = players.filter(p => p.status === "won" || p.status === "lost").length;

  return (
    <Layout>
      <div className="relative flex min-h-screen flex-col text-white" dir={dir} style={{ background: ESCAPE_BG }}>
        <VaultBackdrop danger={false} />

        <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {/* Header */}
          <div className="mb-5 text-center">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-black sm:text-3xl" style={{ textShadow: "0 0 22px rgba(247,201,72,0.35)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {ar ? "غرفة الهروب" : "Escape Room"}
            </h1>
            {title && (
              <p className="mx-auto mt-1 flex w-fit max-w-[85vw] items-center justify-center gap-1.5 truncate rounded-full border border-amber-300/30 bg-black/35 px-4 py-1 text-sm font-black text-amber-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                <span className="truncate">{title}</span>
              </p>
            )}
          </div>

          {(phase === "lobby" || phase === "playing") && (
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/12 bg-black/35 p-2 backdrop-blur-md">
              <button onClick={toggleMute}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 text-xs font-black text-white/85 transition-colors hover:bg-white/15"
                aria-label={muted ? (ar ? "تشغيل الصوت" : "Unmute") : (ar ? "كتم الصوت" : "Mute")}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span>{muted ? (ar ? "تشغيل الصوت" : "Sound on") : (ar ? "الصوت" : "Sound")}</span>
              </button>
              <button onClick={exitGame}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-3 text-xs font-black text-red-200 transition-colors hover:bg-red-500/20"
                aria-label={ar ? "الخروج" : "Exit"}>
                <LogOut className="h-4 w-4" />
                <span>{ar ? "خروج" : "Exit"}</span>
              </button>
              <button onClick={toggleFullscreen}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 text-xs font-black text-white/85 transition-colors hover:bg-white/15"
                aria-label={isFullscreen ? (ar ? "إنهاء ملء الشاشة" : "Exit fullscreen") : (ar ? "ملء الشاشة" : "Fullscreen")}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                <span>{ar ? "الشاشة" : "Screen"}</span>
              </button>
            </div>
          )}

          {phase === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
              <p className="text-sm font-bold text-white/60">{ar ? "جاري الاتصال بالغرفة..." : "Connecting to the room..."}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="text-red-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-14 w-14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <p className="font-black">{ar ? "الغرفة غير موجودة أو انتهت صلاحيتها" : "Room not found or expired"}</p>
              <button onClick={() => setLocation("/game/escape/create")}
                className="rounded-xl bg-amber-600 px-6 py-3 font-bold text-white">
                {ar ? "إنشاء غرفة جديدة" : "Create a new room"}
              </button>
            </div>
          )}

          {/* ── LOBBY ── */}
          {phase === "lobby" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-3xl border border-amber-300/25 bg-black/40 p-5 text-center backdrop-blur-md sm:p-6">
                <p className="mb-1 text-xs font-black text-white/55">{ar ? "رمز الدخول للغرفة" : "Room entry PIN"}</p>
                <p className="text-5xl font-black tracking-[0.28em] sm:text-6xl" dir="ltr"
                  style={{ color: GOLD, textShadow: "0 0 26px rgba(247,201,72,0.55)", fontVariantNumeric: "tabular-nums" }}>
                  {pin}
                </p>
                <div className="mt-4 flex justify-center">
                  <HostJoinBar pin={pin} joinUrl={joinUrl} variant="dark" />
                </div>
              </div>

              {/* Joined players */}
              <div className="rounded-3xl border border-white/12 bg-black/30 p-5 backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-black">
                    <Users className="h-4 w-4 text-amber-300" />
                    {ar ? "المنضمون" : "Joined"} ({players.length})
                  </p>
                </div>
                {players.length === 0 ? (
                  <p className="py-6 text-center text-sm font-bold text-white/40">
                    {ar ? "بانتظار انضمام الطلاب عبر الرمز أو الباركود..." : "Waiting for students to join via PIN or QR..."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {players.map((p) => (
                        <motion.span key={p.name}
                          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                          className="flex items-center gap-1.5 rounded-full border border-amber-200/25 bg-white/8 px-3.5 py-1.5 text-sm font-black">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-white/70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {p.name}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={startGame}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-lg font-black text-[#1a2e1a]"
                style={{
                  background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                  boxShadow: "0 14px 32px rgba(217,165,33,0.45), inset 0 2px 0 rgba(255,255,255,0.32)",
                }}>
                <Play className="h-5 w-5" fill="currentColor" />
                {ar ? "أغلقوا الأبواب — ابدأ الهروب!" : "Seal the doors — start the escape!"}
              </motion.button>
            </motion.div>
          )}

          {/* ── LIVE BOARD ── */}
          {phase === "playing" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Join bar stays visible so late students can still enter */}
              <HostJoinBar pin={pin} joinUrl={joinUrl} variant="dark" />

              {/* Summary strip */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black">
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
                  <Users className="h-3 w-3" /> {players.length} {ar ? "لاعباً" : "players"}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-green-400/40 bg-green-500/15 px-3.5 py-1.5 text-green-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                  {escaped} {ar ? "هربوا" : "escaped"}
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  {finished}/{players.length} {ar ? "أنهوا" : "done"}
                </span>
              </div>

              <div className="space-y-2">
                {players.map((p, rank) => (
                  <motion.div key={p.name} layout
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md"
                    style={{
                      background: p.status === "won" ? "rgba(34,197,94,0.12)" : p.status === "lost" ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.05)",
                      borderColor: p.status === "won" ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.12)",
                      opacity: p.connected ? 1 : 0.55,
                    }}>
                    <span className="w-7 shrink-0 text-center text-lg font-black"
                      style={{ color: rank === 0 ? GOLD : rank === 1 ? "#cbd5e1" : rank === 2 ? "#d97706" : "rgba(255,255,255,0.35)" }}>
                      {rank + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">
                        {p.name}
                        {!p.connected && <span className="ms-2 text-[10px] font-bold text-white/40">({ar ? "انقطع" : "offline"})</span>}
                      </p>
                      {/* Lock progress dots */}
                      <div className="mt-1 flex items-center gap-1" style={{ direction: "ltr" }}>
                        {Array.from({ length: p.lockCount }).map((_, i) => (
                          <span key={i} className="flex h-4 w-4 items-center justify-center rounded text-[9px]"
                            style={{
                              background: i < p.locksOpen ? "rgba(247,201,72,0.3)" : "rgba(255,255,255,0.08)",
                              border: `1px solid ${i < p.locksOpen ? "rgba(247,201,72,0.6)" : "rgba(255,255,255,0.12)"}`,
                            }}>
                            {i < p.locksOpen ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5 text-amber-200"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5 opacity-50"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            )}
                          </span>
                        ))}
                        <span className="ms-2 text-[10px] font-bold text-white/45">✓{p.correct} ✗{p.wrong}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-base font-black" style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>{p.score}</p>
                      <p className="text-[10px] font-black flex justify-end mt-0.5">
                        {p.status === "won" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-green-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        ) : p.status === "lost" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-red-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-amber-200"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

            </motion.div>
          )}

          {phase === "results" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-3xl border border-amber-300/25 bg-black/40 p-6 text-center backdrop-blur-md">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                </div>
                <h2 className="text-2xl font-black text-amber-200">
                  {ar ? "انتهت المسابقة" : "Competition ended"}
                </h2>
                <p className="mt-1 text-sm font-bold text-white/55">
                  {ar ? "النتائج والوقت المتبقي عند لحظة الإنهاء" : "Results and remaining time when the competition ended"}
                </p>
              </div>

              <div className="space-y-2">
                {[...players].sort((a, b) => b.score - a.score).map((p, rank) => (
                  <div key={p.name}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 backdrop-blur-md">
                    <span className="w-7 text-center text-lg font-black" style={{ color: rank === 0 ? GOLD : "rgba(255,255,255,0.55)" }}>
                      {rank + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{p.name}</p>
                      <p className="text-[10px] font-bold text-white/45">✓ {p.correct} · ✗ {p.wrong}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-white/45">{ar ? "النتيجة" : "Score"}</p>
                      <p className="font-black text-amber-200">{p.score}</p>
                    </div>
                    <div className="text-center" dir="ltr">
                      <p className="text-[10px] font-bold text-white/45">{ar ? "الوقت" : "Time"}</p>
                      <p className="font-black text-white">{Math.floor(p.timeLeft / 60)}:{(p.timeLeft % 60).toString().padStart(2, "0")}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setLocation("/teacher/games")}
                className="mx-auto flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-white/15">
                <LogOut className="h-4 w-4" />
                {ar ? "العودة إلى الألعاب" : "Back to games"}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
