import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2, Users, Swords, Link2, Search, MessageCircle, User, Play, Bot, RotateCcw } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { ConfettiBurst } from "@/components/confetti-burst";
import type { ArenaOpponent } from "@/lib/use-arena";

const NAME_KEY = "arena_player_name";

function getStoredName(): string {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
function setStoredName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
}

interface Props {
  gameId: string;
  gameTitle: string;
  playUrl: string;
  playerName: string;
  onClose: () => void;
}

type LobbyPhase = "name_input" | "menu" | "creating" | "waiting_host" | "waiting_guest" | "joining" | "queueing" | "matched";

export function MultiplayerLobby({ gameId, gameTitle, playUrl, playerName: propName, onClose }: Props) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();

  const initName = propName.trim() || getStoredName();
  const [playerNameInput, setPlayerNameInput] = useState(initName);
  const [nameConfirmed, setNameConfirmed] = useState(!!initName);

  const [phase, setPhase] = useState<LobbyPhase>(initName ? "menu" : "name_input");
  const [pin, setPin] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [queueCountdown, setQueueCountdown] = useState(10);

  const socketListenersAttached = useRef(false);
  const matchedRef = useRef(false);
  const autoJoinTriggered = useRef(false);
  const pendingArenaPinRef = useRef<string | null>(null);

  const myName = playerNameInput.trim() || (isRtl ? "لاعب" : "Player");

  // Auto-detect arenaPin from URL → auto-join immediately (no menu shown to friend)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const arenaPin = params.get("arenaPin");
    if (!arenaPin) return;

    const p = arenaPin.toUpperCase();
    setJoinPin(p);

    if (!nameConfirmed) {
      pendingArenaPinRef.current = p;
      setPhase("name_input");
      return;
    }

    if (autoJoinTriggered.current) return;
    autoJoinTriggered.current = true;

    setPhase("joining");
    const socket = getSocket();
    socket.emit("arena:join", { pin: p, playerName: myName }, (res: { success?: boolean; gameId?: string; players?: Array<{ name: string }>; error?: string }) => {
      if (res?.error || !res?.success) {
        autoJoinTriggered.current = false;
        setJoinError(isRtl ? "الغرفة غير موجودة أو امتلأت" : "Room not found or full");
        setPhase("menu");
        return;
      }
      if (res.gameId && res.gameId !== gameId) {
        autoJoinTriggered.current = false;
        setJoinError(isRtl ? "هذا الرمز لعبة مختلفة" : "This PIN is for a different game");
        socket.emit("arena:leave", {});
        setPhase("menu");
        return;
      }
      setPin(p);
      if (res.players) setLobbyPlayers(res.players.map(pl => pl.name));
      setPhase("waiting_guest");
    });
  }, [nameConfirmed, myName, isRtl, gameId]);

  // Attach socket listeners once
  useEffect(() => {
    if (socketListenersAttached.current) return;
    socketListenersAttached.current = true;

    const socket = getSocket();

    socket.on("arena:player_joined", (data: { players?: Array<{ name: string }> }) => {
      if (data.players) setLobbyPlayers(data.players.map(p => p.name));
    });

    socket.on("arena:game_start", (data: { pin: string; players: Array<{ name: string; isBot: boolean }> }) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      setPin(data.pin);
      if (data.players) setLobbyPlayers(data.players.map(p => p.name));
      setPhase("matched");
    });

    socket.on("arena:matched", (data: { pin: string; opponent: { name: string } }) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      setPin(data.pin);
      setPhase("matched");
    });

    socket.on("arena:waiting", () => {});

    return () => {
      socket.off("arena:player_joined");
      socket.off("arena:game_start");
      socket.off("arena:matched");
      socket.off("arena:waiting");
      socketListenersAttached.current = false;
      matchedRef.current = false;
    };
  }, [myName, isRtl]);

  // Queue countdown
  useEffect(() => {
    if (phase !== "queueing") return;
    setQueueCountdown(10);
    const interval = setInterval(() => {
      setQueueCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Countdown after match → navigate to game
  useEffect(() => {
    if (phase !== "matched") return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          const separator = playUrl.includes("?") ? "&" : "?";
          const arenaUrl = `${playUrl}${separator}arena=${pin}&arenaName=${encodeURIComponent(myName)}`;
          setLocation(arenaUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, pin, playUrl, myName, setLocation]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const confirmName = () => {
    if (!playerNameInput.trim()) return;
    setStoredName(playerNameInput.trim());
    setNameConfirmed(true);

    const pending = pendingArenaPinRef.current;
    if (pending) {
      pendingArenaPinRef.current = null;
      // Will re-trigger the auto-join effect
    } else {
      setPhase("menu");
    }
  };

  const handleCreateFriend = () => {
    setPhase("creating");
    const socket = getSocket();
    socket.emit("arena:create", { gameId, playerName: myName, noBot: true }, (res: { pin?: string; error?: string }) => {
      if (res?.error || !res?.pin) {
        toast.error(isRtl ? "فشل إنشاء الغرفة" : "Failed to create room");
        setPhase("menu");
        return;
      }
      setPin(res.pin);
      setLobbyPlayers([myName]);
      setPhase("waiting_host");
    });
  };

  const handleCreateVsAI = () => {
    setPhase("creating");
    const socket = getSocket();
    socket.emit("arena:create", { gameId, playerName: myName, noBot: true }, (res: { pin?: string; error?: string }) => {
      if (res?.error || !res?.pin) {
        toast.error(isRtl ? "فشل إنشاء الغرفة" : "Failed to create room");
        setPhase("menu");
        return;
      }
      setPin(res.pin);
      socket.emit("arena:request_bot", {}, () => {});
    });
  };

  const handleRequestBot = () => {
    getSocket().emit("arena:request_bot", {}, () => {});
  };

  const handleHostStart = () => {
    getSocket().emit("arena:host_start", {}, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) toast.error(isRtl ? "فشل بدء اللعبة" : "Failed to start game");
    });
  };

  const handleJoin = () => {
    const p = joinPin.trim().toUpperCase();
    if (!p || p.length < 4) {
      setJoinError(isRtl ? "أدخل PIN الغرفة" : "Enter the room PIN");
      return;
    }
    setJoinError("");
    setPhase("joining");
    const socket = getSocket();
    socket.emit("arena:join", { pin: p, playerName: myName }, (res: { success?: boolean; gameId?: string; players?: Array<{ name: string }>; error?: string }) => {
      if (res?.error || !res?.success) {
        setJoinError(isRtl ? "الغرفة غير موجودة أو امتلأت" : "Room not found or full");
        setPhase("menu");
        return;
      }
      if (res.gameId && res.gameId !== gameId) {
        setJoinError(isRtl ? "هذا الرمز لعبة مختلفة" : "This PIN is for a different game");
        socket.emit("arena:leave", {});
        setPhase("menu");
        return;
      }
      setPin(p);
      if (res.players) setLobbyPlayers(res.players.map(pl => pl.name));
      setPhase("waiting_guest");
    });
  };

  const handleQueue = () => {
    setPhase("queueing");
    getSocket().emit("arena:queue", { gameId, playerName: myName }, () => {});
  };

  const handleCopyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error(isRtl ? "فشل النسخ" : "Copy failed"); }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?arenaPin=${pin}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(isRtl ? "تم نسخ الرابط" : "Link copied!");
    } catch { toast.error(isRtl ? "فشل النسخ" : "Copy failed"); }
  };

  const handleWhatsApp = () => {
    const url = `${window.location.origin}${window.location.pathname}?arenaPin=${pin}`;
    const msg = isRtl
      ? `تحدّيتك في ${gameTitle}! انضم باستخدام الرمز: ${pin}\n${url}`
      : `I challenge you in ${gameTitle}! Join with PIN: ${pin}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleCancel = () => {
    getSocket().emit("arena:leave", {});
    setPhase("menu");
    matchedRef.current = false;
  };

  // ── Players list widget (used in both host and guest waiting) ──────────────
  const PlayersList = ({ players }: { players: string[] }) => (
    <div className="rounded-2xl bg-muted/40 border border-border/60 p-3 space-y-1.5">
      <p className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-2">
        <Users className="w-3.5 h-3.5" />
        {isRtl ? `اللاعبون (${players.length})` : `Players (${players.length})`}
      </p>
      {players.map((name, i) => (
        <div key={name} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${name === myName ? "bg-primary/15 text-primary" : "bg-background/60 text-foreground"}`}>
          <span className="w-5 text-center">{i === 0 ? "👑" : `${i + 1}.`}</span>
          <span className="truncate">{name}</span>
          {name === myName && <span className="text-[10px] opacity-60 mr-auto">{isRtl ? "(أنت)" : "(you)"}</span>}
        </div>
      ))}
    </div>
  );

  // ── Share / PIN block ──────────────────────────────────────────────────────
  const ShareBlock = () => (
    <div className="rounded-2xl bg-muted/50 border border-border p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{isRtl ? "رمز الغرفة" : "Room PIN"}</p>
      <p className="text-3xl font-black tracking-widest text-primary mb-3">{pin}</p>
      <div className="flex gap-2 mb-2">
        <button onClick={handleCopyPin} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/15 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {isRtl ? "نسخ PIN" : "Copy PIN"}
        </button>
        <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/15 transition-colors">
          <Link2 className="w-3.5 h-3.5" />
          {isRtl ? "نسخ الرابط" : "Copy Link"}
        </button>
      </div>
      <button onClick={handleWhatsApp} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold hover:bg-green-500/20 transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
        {isRtl ? "شارك عبر واتساب" : "Share on WhatsApp"}
      </button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir={isRtl ? "rtl" : "ltr"}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <h2 className="font-black text-foreground text-base">
              {isRtl ? `تحدي في ${gameTitle}` : `${gameTitle} Challenge`}
            </h2>
          </div>
          {(phase === "name_input" || phase === "menu" || phase === "matched") && (
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">

            {/* ── Name Input ── */}
            {phase === "name_input" && (
              <motion.div key="name_input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-black text-foreground mb-1">{isRtl ? "ما اسمك؟" : "What's your name?"}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? "سيُعرض اسمك على منافسيك" : "Your opponents will see this name"}</p>
                </div>
                <input
                  type="text"
                  value={playerNameInput}
                  onChange={e => setPlayerNameInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmName()}
                  placeholder={isRtl ? "اسمك هنا..." : "Your name here..."}
                  maxLength={20}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground font-bold text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground placeholder:font-normal placeholder:text-sm"
                />
                <button
                  onClick={confirmName}
                  disabled={!playerNameInput.trim()}
                  className="w-full py-3 rounded-xl bg-primary disabled:opacity-40 text-white font-black text-sm transition-colors hover:opacity-90"
                >
                  {isRtl ? "تأكيد ومتابعة" : "Confirm & Continue"}
                </button>
              </motion.div>
            )}

            {/* ── Menu ── */}
            {phase === "menu" && (
              <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 border border-border/60 mb-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{isRtl ? "لاعب بصفتك:" : "Playing as:"}</span>
                    <span className="text-xs font-black text-foreground">{myName}</span>
                  </div>
                  <button onClick={() => setPhase("name_input")} className="text-[10px] text-primary hover:underline font-bold">
                    {isRtl ? "تغيير" : "Change"}
                  </button>
                </div>

                <button onClick={handleCreateFriend} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all text-start">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <Link2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm">{isRtl ? "تحدِّ أصدقاءك" : "Challenge Friends"}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? "أنشئ غرفة وأرسل الرابط — حتى 8 لاعبين" : "Create a room & share the link — up to 8 players"}</p>
                  </div>
                </button>

                <button onClick={handleCreateVsAI} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-violet-500/10 border border-violet-400/30 hover:bg-violet-500/15 transition-all text-start">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm">{isRtl ? "ضد الذكاء الاصطناعي" : "vs Artificial Intelligence"}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? "العب فوراً ضد خصم رقمي" : "Play instantly against an AI opponent"}</p>
                  </div>
                </button>

                <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 space-y-2">
                  <p className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {isRtl ? "انضم بـ PIN" : "Join by PIN"}
                  </p>
                  <input
                    type="text"
                    value={joinPin}
                    onChange={e => { setJoinPin(e.target.value.toUpperCase()); setJoinError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleJoin()}
                    placeholder={isRtl ? "أدخل الـ PIN..." : "Enter PIN..."}
                    maxLength={8}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-bold text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  />
                  {joinError && <p className="text-red-500 text-xs">{joinError}</p>}
                  <button onClick={handleJoin} disabled={!joinPin.trim()} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black text-sm transition-colors">
                    {isRtl ? "انضم" : "Join"}
                  </button>
                </div>

                <button onClick={handleQueue} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-all text-start">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm">{isRtl ? "منافسة عشوائية" : "Quick Match"}</p>
                    <p className="text-xs text-muted-foreground">{isRtl ? "ابحث عن منافس بشري — ذكاء اصطناعي بعد 10ث" : "Find a human — AI fallback after 10s"}</p>
                  </div>
                </button>

                <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-sm font-bold">
                  <Play className="w-3.5 h-3.5" />
                  {isRtl ? "العب بمفردك" : "Play Solo"}
                </button>
              </motion.div>
            )}

            {/* ── Creating ── */}
            {phase === "creating" && (
              <motion.div key="creating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                <p className="font-bold text-foreground">{isRtl ? "جاري إنشاء الغرفة..." : "Creating room..."}</p>
              </motion.div>
            )}

            {/* ── Waiting as HOST ── */}
            {phase === "waiting_host" && (
              <motion.div key="waiting_host" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center">
                  <p className="font-black text-foreground mb-1">{isRtl ? "غرفتك جاهزة 🎮" : "Your room is ready 🎮"}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? "شارك الرابط وابدأ عندما يكون الجميع جاهزاً" : "Share the link and start when everyone is ready"}</p>
                </div>

                <ShareBlock />

                <PlayersList players={lobbyPlayers} />

                {/* Start Game button — enabled when ≥ 2 players */}
                <button
                  onClick={handleHostStart}
                  disabled={lobbyPlayers.length < 2}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {lobbyPlayers.length < 2
                    ? (isRtl ? "في انتظار لاعب آخر..." : "Waiting for players...")
                    : (isRtl ? `ابدأ اللعبة (${lobbyPlayers.length} لاعبين)` : `Start Game (${lobbyPlayers.length} players)`)
                  }
                </button>

                <button onClick={handleRequestBot} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 border border-violet-400/30 text-violet-600 dark:text-violet-400 text-sm font-bold hover:bg-violet-500/15 transition-colors">
                  <Bot className="w-4 h-4" />
                  {isRtl ? "أضف الذكاء الاصطناعي" : "Add AI player"}
                </button>

                <button onClick={handleCancel} className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-muted transition-colors">
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </motion.div>
            )}

            {/* ── Waiting as GUEST ── */}
            {phase === "waiting_guest" && (
              <motion.div key="waiting_guest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
                  </div>
                  <p className="font-black text-foreground mb-1">{isRtl ? "انضممت بنجاح! ✅" : "Joined successfully! ✅"}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? "في انتظار المضيف ليبدأ اللعبة..." : "Waiting for the host to start the game..."}</p>
                </div>

                <PlayersList players={lobbyPlayers} />

                <button onClick={handleCancel} className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-bold hover:bg-muted transition-colors">
                  {isRtl ? "مغادرة" : "Leave"}
                </button>
              </motion.div>
            )}

            {/* ── Joining (transition only) ── */}
            {phase === "joining" && (
              <motion.div key="joining" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 space-y-3">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="font-bold text-foreground">{isRtl ? "جاري الانضمام..." : "Joining..."}</p>
              </motion.div>
            )}

            {/* ── Queueing ── */}
            {phase === "queueing" && (
              <motion.div key="queueing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8 space-y-3">
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <Loader2 className="w-16 h-16 text-amber-500 animate-spin absolute" />
                  <Search className="w-6 h-6 text-amber-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="font-bold text-foreground">{isRtl ? "نبحث عن منافس..." : "Searching for opponent..."}</p>
                <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-2 inline-block">
                  {queueCountdown > 0 ? (
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {isRtl ? `ذكاء اصطناعي خلال ${queueCountdown}ث` : `AI fallback in ${queueCountdown}s`}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {isRtl ? "جاري إضافة الذكاء الاصطناعي..." : "Adding AI opponent..."}
                    </p>
                  )}
                </div>
                <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </motion.div>
            )}

            {/* ── Matched ── */}
            {phase === "matched" && (
              <motion.div key="matched" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6 space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="text-5xl">
                  ⚔️
                </motion.div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {isRtl
                      ? `سيتنافس ${lobbyPlayers.length} لاعبين`
                      : `${lobbyPlayers.length} players will compete`}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {lobbyPlayers.map((name, i) => (
                      <span key={name} className={`text-sm font-black px-3 py-1 rounded-full ${name === myName ? "bg-primary/20 text-primary" : "bg-muted text-foreground"}`}>
                        {i === 0 ? "👑 " : ""}{name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4">
                  <p className="text-sm font-bold text-foreground mb-1">{isRtl ? "تبدأ اللعبة خلال" : "Game starts in"}</p>
                  <p className="text-4xl font-black text-primary">{countdown}</p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ── Arena Bar (shown in play pages) ──────────────────────────────────────────

const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

interface ArenaBarProps {
  myName: string;
  myScore: number;
  opponents: ArenaOpponent[];
  results: Array<{ rank: number; name: string; score: number; isBot?: boolean }> | null;
  isRtl?: boolean;
  onReplay?: () => void;
}

export function ArenaBar({ myName, myScore, opponents, results, isRtl = true, onReplay }: ArenaBarProps) {
  const prevLeadingRef = useRef<string>("");
  const [flash, setFlash] = useState(false);

  const allPlayers = [
    { name: myName, score: myScore, finished: false, isBot: false },
    ...opponents,
  ].sort((a, b) => b.score - a.score);

  const leadingName = allPlayers[0]?.name ?? myName;
  const myRankLive = allPlayers.findIndex(p => p.name === myName) + 1;

  const maxScore = Math.max(...allPlayers.map(p => p.score), 100);

  useEffect(() => {
    if (results) return;
    if (prevLeadingRef.current && prevLeadingRef.current !== leadingName) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      prevLeadingRef.current = leadingName;
      return () => clearTimeout(t);
    }
    prevLeadingRef.current = leadingName;
  }, [leadingName, results]);

  // ── Results screen ──────────────────────────────────────────────────────────
  if (results) {
    const myResult = results.find(r => r.name === myName);
    const myRank = myResult?.rank ?? results.length;
    const won = myRank === 1;

    const shareResult = () => {
      const summary = results.map(r => `${MEDAL[r.rank - 1] ?? `${r.rank}.`} ${r.name}: ${r.score}`).join("\n");
      const msg = isRtl
        ? `نتيجة المنافسة:\n${summary}\n${won ? "🎉 فزت!" : "💪 حاول مجدداً!"}`
        : `Arena Result:\n${summary}\n${won ? "🎉 I won!" : "💪 Try again!"}`;
      if (navigator.share) {
        navigator.share({ text: msg }).catch(() => {});
      } else {
        navigator.clipboard.writeText(msg).catch(() => {});
      }
    };

    return (
      <>
        <ConfettiBurst active={won} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.35 }}
          className={`w-full rounded-2xl px-4 py-4 mb-4 shadow-xl ${
            won
              ? "bg-gradient-to-br from-yellow-400/25 to-amber-500/15 border border-yellow-400/50"
              : "bg-gradient-to-br from-slate-500/15 to-slate-600/10 border border-slate-400/40"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.6, delay: 0.1 }} className="text-3xl">
                {MEDAL[myRank - 1] ?? `${myRank}.`}
              </motion.span>
              <div>
                <p className="font-black text-foreground text-base leading-tight">
                  {won ? (isRtl ? "🎉 فزت!" : "🎉 You won!") : (isRtl ? `المرتبة ${myRank}` : `Rank #${myRank}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? `من أصل ${results.length} لاعبين` : `out of ${results.length} players`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onReplay && (
                <button onClick={onReplay} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary transition-colors">
                  <RotateCcw className="w-3 h-3" />
                  {isRtl ? "أعد" : "Replay"}
                </button>
              )}
              <button onClick={shareResult} className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                {isRtl ? "شارك" : "Share"}
              </button>
            </div>
          </div>

          {/* Full scoreboard */}
          <div className="space-y-1.5">
            {results.map((r) => {
              const isMe = r.name === myName;
              const resultMax = Math.max(...results.map(x => x.score), 1);
              const barPct = Math.round((r.score / resultMax) * 100);
              return (
                <div
                  key={r.name}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs ${isMe ? "bg-primary/15 dark:bg-primary/20 ring-1 ring-primary/40" : "bg-muted/40 dark:bg-muted/30"}`}
                >
                  <span className="text-base w-6 text-center shrink-0">{MEDAL[r.rank - 1] ?? `${r.rank}.`}</span>
                  <span className={`font-black truncate w-20 ${isMe ? "text-foreground" : "text-muted-foreground"}`}>
                    {r.isBot ? "🤖 " : ""}{r.name}
                  </span>
                  <div className="flex-1 bg-black/10 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                      className={`h-full rounded-full ${r.rank === 1 ? "bg-yellow-400" : r.rank === 2 ? "bg-slate-400" : "bg-amber-600"}`}
                    />
                  </div>
                  <span className={`font-black w-10 text-right shrink-0 ${isMe ? "text-foreground" : "text-muted-foreground"}`}>{r.score}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </>
    );
  }

  // ── Live leaderboard bar ──────────────────────────────────────────────────

  const statusText = myRankLive === 1
    ? (isRtl ? "🔥 أنت في المقدمة!" : "🔥 You're leading!")
    : myRankLive === allPlayers.length
      ? (isRtl ? "⚡ تسارع للحاق!" : "⚡ Speed up!")
      : (isRtl ? `⚠️ المرتبة ${myRankLive}` : `⚠️ Rank #${myRankLive}`);

  const statusCls = myRankLive === 1
    ? "text-emerald-600 dark:text-emerald-400"
    : myRankLive === allPlayers.length
      ? "text-blue-500 dark:text-blue-400"
      : "text-orange-500 dark:text-orange-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full rounded-2xl px-4 py-3 mb-4 shadow-lg border transition-all duration-300 ${
        flash ? "bg-primary/20 border-primary/50" : "bg-card border-border/60"
      }`}
    >
      <p className={`text-xs font-black text-center mb-2 transition-all duration-300 ${statusCls}`}>
        {statusText}
      </p>

      {allPlayers.map((p, i) => {
        const isMe = p.name === myName;
        const pct = Math.round((p.score / maxScore) * 100);
        return (
          <div key={p.name} className={`flex items-center gap-2 ${i < allPlayers.length - 1 ? "mb-1.5" : ""}`}>
            <span className="text-xs w-4 shrink-0 text-center">{MEDAL[i] ?? `${i + 1}.`}</span>
            <span className={`text-[11px] w-14 truncate text-right shrink-0 ${isMe ? "font-black text-foreground" : "font-medium text-muted-foreground"}`}>
              {p.isBot ? "🤖" : ""}{p.name}{p.finished ? " ✓" : ""}
            </span>
            <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isMe ? "bg-emerald-500" : "bg-rose-400"}`}
                style={{ width: `${pct}%` }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <span className={`text-xs font-black w-8 text-left shrink-0 ${isMe ? "text-foreground" : "text-muted-foreground"}`}>
              {p.score}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
