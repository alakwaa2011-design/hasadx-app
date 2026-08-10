import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, VolumeX, Loader2, Trophy, Play, Copy, Check,
  Users, RefreshCw, Home, X, Rocket, Maximize2, ChevronRight,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const GREEN = "#225739";
const GOLD = "#D9A521";
const CYAN = "#54d8ff";
const SPACE_BG = "radial-gradient(140% 95% at 50% -10%, #1a2a7a 0%, #0d1445 38%, #060930 62%, #02040f 100%)";

const RRH_KEYFRAMES = `
@keyframes rrhSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes rrhShine{0%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(240%) skewX(-18deg)}}
@keyframes rrhPulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes rrhGate{0%{background-position:0% 50%}100%{background-position:200% 50%}}
`;

// Module-level star data — stable positions across re-renders
const HOST_STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: ((i * 73 + 17) % 100),
  y: ((i * 91 + 33) % 100),
  size: 0.6 + (i % 4) * 0.55,
  delay: (i % 7) * 0.45,
}));

interface Player {
  name: string;
  avatar: string;
  rocketColor: string;
  altitude: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  finished: boolean;
  finishRank?: number;
  streak: number;
  currentQuestionIdx: number;
  currentPhase?: number;
  boostAvailable?: number;
  multiplierAvailable?: number;
  boostArmed?: boolean;
  multiplierArmed?: boolean;
}

function RocketIcon({ color, size = 30 }: { color: string; size?: number }) {
  const uid = color.replace("#", "");
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" style={{ overflow: "visible", filter: `drop-shadow(0 2px 8px ${color}80)` }}>
      <defs>
        <linearGradient id={`rrhHull-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.5" />
          <stop offset="46%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {/* Layered engine flame */}
      <motion.g animate={{ scaleY: [1, 1.25, 0.9, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.24 }} style={{ originX: "30px", originY: "77px" }}>
        <path d="M20 78 Q30 100 40 78 Q35 90 30 93 Q25 90 20 78 Z" fill="#ff7a1a" opacity="0.95" />
        <path d="M24 78 Q30 90 36 78 Q33 85 30 87 Q27 85 24 78 Z" fill="#ffc247" opacity="0.95" />
        <path d="M27 78 Q30 84 33 78 Q31.5 81.5 30 82.5 Q28.5 81.5 27 78 Z" fill="#fff" opacity="0.95" />
      </motion.g>
      {/* Fins with edge light */}
      <path d="M18 48 L5 76 L18 71 Z" fill={color} />
      <path d="M18 48 L5 76 L18 71 Z" fill="#000" opacity="0.3" />
      <path d="M42 48 L55 76 L42 71 Z" fill={color} />
      <path d="M42 48 L55 76 L42 71 Z" fill="#fff" opacity="0.12" />
      {/* Hull */}
      <path d="M30 3 Q44 22 43 46 L43 66 Q43 74 30 75 Q17 74 17 66 L17 46 Q16 22 30 3 Z" fill={color} />
      <path d="M30 3 Q44 22 43 46 L43 66 Q43 74 30 75 Q17 74 17 66 L17 46 Q16 22 30 3 Z" fill={`url(#rrhHull-${uid})`} />
      {/* Nose */}
      <path d="M30 3 Q36 12 37.5 21 L22.5 21 Q24 12 30 3 Z" fill="#fff" opacity="0.85" />
      {/* Cockpit */}
      <circle cx="30" cy="38" r="8" fill="#0a0e1a" opacity="0.85" />
      <circle cx="30" cy="38" r="6.6" fill="#5ec9ff" />
      <ellipse cx="27.6" cy="35.6" rx="2.7" ry="1.8" fill="#fff" opacity="0.75" />
      {/* Nav lights */}
      <motion.circle cx="7" cy="74" r="1.7" fill="#ff5d5d" animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
      <motion.circle cx="53" cy="74" r="1.7" fill="#4ade80" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.4 }} />
    </svg>
  );
}

function StarField() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Nebula glows */}
      <motion.div
        animate={{ opacity: [0.5, 0.95, 0.5], x: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
        style={{ position: "absolute", top: "8%", left: "4%", width: "46vmin", height: "32vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(110,20,200,0.20) 0%, transparent 70%)" }}
      />
      <motion.div
        animate={{ opacity: [0.4, 0.85, 0.4], x: [10, -10, 10] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 3 }}
        style={{ position: "absolute", bottom: "10%", right: "2%", width: "40vmin", height: "28vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(20,70,220,0.18) 0%, transparent 70%)" }}
      />
      {/* Ringed planet on the horizon */}
      <div style={{ position: "absolute", bottom: "-6%", right: "-5%", width: "30vmin", height: "30vmin", opacity: 0.6 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #a7c4ff 0%, #4a67d4 35%, #22307a 65%, #0c1030 100%)",
          boxShadow: "0 0 45px 10px rgba(90,130,255,0.22), inset -12px -15px 40px rgba(0,0,20,0.65)",
        }} />
        <div style={{
          position: "absolute", left: "-26%", top: "40%", width: "152%", height: "18%",
          borderRadius: "50%",
          border: "2px solid rgba(180,200,255,0.35)",
          borderTopColor: "transparent",
          transform: "rotate(-14deg)",
        }} />
      </div>
      {HOST_STARS.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 + s.delay, delay: s.delay }}
          style={{
            position: "absolute",
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: s.size > 1.5 ? `0 0 ${s.size * 3}px rgba(200,225,255,0.8)` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function RocketHost() {
  const params = useParams<{ pin: string }>();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";

  const pin = params.pin || "";
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("rocket-music-muted") === "1"; } catch { return false; }
  });
  const [phase, setPhase] = useState<"connecting" | "lobby" | "racing" | "finished">("connecting");
  const [players, setPlayers] = useState<Player[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [advanceMode, setAdvanceMode] = useState<"per_player" | "host_sync">("per_player");
  const [hostQuestion, setHostQuestion] = useState<{ index: number; text: string; imageUrl?: string | null } | null>(null);
  // Race timer (seconds remaining). null = unknown / not started.
  const [gameTimeLeft, setGameTimeLeft] = useState<number | null>(null);

  // Race timer countdown (display only — server is authoritative).
  useEffect(() => {
    if (phase !== "racing" || gameTimeLeft === null) return;
    if (gameTimeLeft <= 0) return;
    const intv = setInterval(() => {
      setGameTimeLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(intv);
  }, [phase, gameTimeLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sound (host)
  const playLaunchSound = () => {
    if (muted) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [220, 330, 440, 660].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.1 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1); osc.stop(ctx.currentTime + i * 0.1 + 0.5);
      });
    } catch { /* ignore */ }
  };

  const toggleMute = () => {
    setMuted(m => {
      const n = !m;
      try { localStorage.setItem("rocket-music-muted", n ? "1" : "0"); } catch { /* ignore */ }
      return n;
    });
  };

  // Connect & reclaim
  useEffect(() => {
    if (!pin) return;
    const socket = getRocketSocket();
    const token = sessionStorage.getItem(`rocket-creator-${pin}`);
    if (!token) {
      toast.error(ar ? "لا توجد صلاحية المعلم. أعد إنشاء السباق." : "No host token. Re-create the race.");
      setLocation("/game/rocket/create");
      return;
    }

    const reclaim = () => {
      const tok = sessionStorage.getItem(`rocket-creator-${pin}`);
      if (!tok) return;
      socket.emit(
        "rocket:reclaim-host",
        { pin, creatorToken: tok },
        (res: {
          success?: boolean; error?: string;
          state?: string; players?: Player[]; totalQuestions?: number; duration?: number; title?: string;
          advanceMode?: "per_player" | "host_sync"; syncQuestionIdx?: number;
          currentQuestionPreview?: { index: number; text: string; imageUrl?: string | null };
        }) => {
          if (res.error) {
            toast.error(res.error);
            setLocation("/");
            return;
          }
          if (res.success) {
            setPlayers(res.players || []);
            setTotalQuestions(res.totalQuestions || 0);
            if (res.title) setTitle(res.title);
            if (res.advanceMode) setAdvanceMode(res.advanceMode);
            if (res.currentQuestionPreview) setHostQuestion(res.currentQuestionPreview);
            if (res.state === "lobby") setPhase("lobby");
            else if (res.state === "racing" || res.state === "countdown") setPhase("racing");
            else if (res.state === "finished") setPhase("finished");
          }
        },
      );
    };

    if (socket.connected) reclaim();
    socket.on("connect", reclaim);

    socket.on("rocket:players-updated", (data: { players: Player[] }) => setPlayers(data.players));
    socket.on("rocket:countdown", () => { setPhase("racing"); playLaunchSound(); });
    socket.on(
      "rocket:race-start",
      (data: {
        advanceMode?: "per_player" | "host_sync";
        question?: { index: number; text: string };
        gameDuration?: number;
        totalDurationSecs?: number;
      }) => {
        setPhase("racing");
        if (data.advanceMode) setAdvanceMode(data.advanceMode);
        if (data.question) setHostQuestion({ index: data.question.index, text: data.question.text, imageUrl: (data.question as { index: number; text: string; imageUrl?: string | null }).imageUrl ?? null });
        const dur = data.totalDurationSecs ?? data.gameDuration ?? null;
        if (typeof dur === "number") setGameTimeLeft(dur);
      },
    );
    socket.on("rocket:sync-question", (q: { index: number; text: string; imageUrl?: string | null }) => {
      setHostQuestion({ index: q.index, text: q.text, imageUrl: q.imageUrl ?? null });
    });
    socket.on("rocket:leaderboard", (data: { players: Player[] }) => setPlayers(data.players));
    socket.on("rocket:game-end", (data: { players: Player[] }) => {
      setPhase("finished");
      setPlayers(data.players);
      setHostQuestion(null);
    });
    socket.on("rocket:replay", (data: { players: Player[] }) => {
      setPhase("lobby");
      setPlayers(data.players);
      setAdvanceMode("per_player");
      setHostQuestion(null);
      setGameTimeLeft(null);
    });

    return () => {
      socket.off("connect", reclaim);
      socket.off("rocket:players-updated");
      socket.off("rocket:countdown");
      socket.off("rocket:race-start");
      socket.off("rocket:sync-question");
      socket.off("rocket:leaderboard");
      socket.off("rocket:game-end");
      socket.off("rocket:replay");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const joinUrl = `${window.location.origin}/game/rocket/join/${pin}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(ar ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(ar ? "فشل النسخ" : "Copy failed");
    }
  };

  const startRace = () => {
    if (players.length === 0) {
      toast.error(ar ? "لا يوجد متسابقون بعد" : "No racers yet");
      return;
    }
    const socket = getRocketSocket();
    socket.emit("rocket:start", { pin }, (res: { error?: string; success?: boolean }) => {
      if (res.error) toast.error(res.error);
    });
  };

  const endRace = () => {
    const socket = getRocketSocket();
    socket.emit("rocket:end", { pin }, () => { setConfirmEnd(false); });
  };

  const hostNextQuestion = () => {
    const socket = getRocketSocket();
    socket.emit("rocket:host-next", { pin }, (res: { error?: string }) => {
      if (res?.error) toast.error(res.error);
    });
  };

  const replay = () => {
    const socket = getRocketSocket();
    socket.emit("rocket:replay", { pin }, () => {});
  };

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return (a.finishRank || 99) - (b.finishRank || 99);
    return b.altitude - a.altitude;
  });

  if (phase === "connecting") {
    return (
      <div style={{ minHeight: "100dvh", background: SPACE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={40} color={GOLD} className="animate-spin" />
      </div>
    );
  }

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: SPACE_BG, position: "relative", overflow: "hidden" }}>
      <style>{RRH_KEYFRAMES}</style>
      <StarField />

      {/* Top bar — join code + mini QR + enlarge (teacher only in this route) */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 18px",
        background: "linear-gradient(180deg, rgba(8,12,32,0.7), rgba(8,12,32,0.42))",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(120,160,255,0.16)",
        boxShadow: "0 1px 0 rgba(84,216,255,0.12), 0 8px 26px -14px rgba(0,0,0,0.85)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", minWidth: 0 }}>
          <Rocket size={22} color={GOLD} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>
              {ar ? "سباق الصواريخ" : "Rocket Race"}
              {title && <span style={{ marginInlineStart: 8, opacity: 0.7, fontWeight: 600 }}>· {title}</span>}
            </p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
              {ar ? "أنت المعلم" : "Host"}
            </p>
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(0,0,0,0.28)",
          borderRadius: 14,
          padding: "6px 10px",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          <button
            type="button"
            onClick={() => setShowQR(true)}
            title={ar ? "تكبير الباركود" : "Enlarge QR"}
            style={{
              display: "flex",
              alignItems: "center",
              background: "#fff",
              border: "none",
              borderRadius: 10,
              padding: 4,
              cursor: "pointer",
            }}
          >
            <QRCode value={joinUrl} size={44} />
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>
              {ar ? "رمز الانضمام" : "Join code"}
            </span>
            <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 20, color: GOLD, letterSpacing: "0.12em", direction: "ltr" }}>
              {pin}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowQR(true)}
            style={{ ...btnSmall, flexShrink: 0 }}
            title={ar ? "عرض بحجم أكبر" : "View larger"}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginInlineStart: "auto" }}>
          <button onClick={toggleMute} style={btnSmall}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button onClick={() => setLocation("/")} style={btnSmall}>
            <Home size={14} />
          </button>
        </div>
      </div>

      {/* Lobby */}
      {phase === "lobby" && (
        <div style={{ position: "relative", zIndex: 5, padding: "24px 16px", maxWidth: 900, marginInline: "auto" }}>
          <div style={{
            position: "relative",
            background: "linear-gradient(160deg, rgba(20,28,64,0.72), rgba(10,14,38,0.62))",
            borderRadius: 24,
            padding: 24,
            border: "1px solid rgba(120,160,255,0.22)",
            boxShadow: "0 14px 40px -16px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.09)",
            backdropFilter: "blur(14px)",
            overflow: "hidden",
          }}>
            {/* Neon top edge */}
            <div aria-hidden style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
              background: `linear-gradient(90deg, transparent, ${GOLD}, ${CYAN}, transparent)`,
              backgroundSize: "200% 100%",
              animation: "rrhGate 3.5s linear infinite",
            }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 24, alignItems: "center" }}>
              {/* Left: pin */}
              <div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700 }}>
                  {ar ? "للانضمام اكتب الكود:" : "Join with code:"}
                </p>
                <div style={{
                  marginTop: 12,
                  position: "relative",
                  background: `linear-gradient(135deg, #ffd76e, ${GOLD} 45%, #b8860b)`,
                  borderRadius: 18,
                  padding: "16px 24px",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontSize: 48,
                  fontWeight: 900,
                  color: "#221a02",
                  letterSpacing: "0.15em",
                  fontFamily: "monospace",
                  overflow: "hidden",
                  boxShadow: `0 14px 36px -8px ${GOLD}90, inset 0 1px 0 rgba(255,255,255,0.55)`,
                }} dir="ltr">
                  <span aria-hidden style={{
                    position: "absolute", top: 0, bottom: 0, width: "40%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                    animation: "rrhShine 3s ease-in-out infinite",
                    pointerEvents: "none",
                  }} />
                  {pin}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button onClick={copyLink} style={btnAction(GREEN)}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ الرابط" : "Copy Link")}
                  </button>
                  <button onClick={() => setShowQR(true)} style={btnAction("#1d4ed8")}>
                    <Users size={16} />
                    {ar ? "عرض الباركود" : "Show QR"}
                  </button>
                </div>
              </div>

              {/* Right: small QR */}
              <div style={{ background: "#fff", borderRadius: 14, padding: 12 }}>
                <QRCode value={joinUrl} size={170} />
              </div>
            </div>
          </div>

          {/* Players list */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, color: "#fff" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} color={GOLD} />
              {ar ? "المتسابقون" : "Racers"} ({players.length})
            </h2>
            <button
              onClick={startRace}
              disabled={players.length === 0}
              style={{
                position: "relative",
                padding: "11px 22px",
                borderRadius: 14,
                border: players.length === 0 ? "none" : "1px solid rgba(255,255,255,0.35)",
                background: players.length === 0
                  ? "rgba(255,255,255,0.15)"
                  : `linear-gradient(135deg, #ffd76e, ${GOLD} 45%, #a87908)`,
                color: players.length === 0 ? "#fff" : "#221a02",
                fontWeight: 900, fontSize: 16,
                cursor: players.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                overflow: "hidden",
                boxShadow: players.length > 0 ? `0 12px 30px -8px ${GOLD}aa, inset 0 1px 0 rgba(255,255,255,0.5)` : "none",
                opacity: players.length === 0 ? 0.5 : 1,
              }}
            >
              {players.length > 0 && (
                <span aria-hidden style={{
                  position: "absolute", top: 0, bottom: 0, width: "40%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                  animation: "rrhShine 2.6s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              <Play size={18} fill="currentColor" />
              {ar ? "أطلق السباق!" : "Launch Race!"}
            </button>
          </div>

          {players.length === 0 ? (
            <div style={{
              padding: "40px 20px", textAlign: "center",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 18,
              border: "1px dashed rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
            }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                {ar ? "في انتظار انضمام المتسابقين..." : "Waiting for racers to join..."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {players.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{p.avatar}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, color: "#fff", fontSize: 13, fontWeight: 700,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.name}
                    </p>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.rocketColor }} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Racing — live monitor */}
      {phase === "racing" && (
        <div style={{ position: "relative", zIndex: 5, padding: 16, maxWidth: 1200, marginInline: "auto" }}>
          {(hostQuestion || advanceMode === "host_sync") && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 16px",
                borderRadius: 16,
                background: advanceMode === "host_sync" ? "rgba(217,165,33,0.12)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${advanceMode === "host_sync" ? GOLD : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: 0.5 }}>
                {advanceMode === "host_sync"
                  ? (ar ? "وضع المعلم: نفس السؤال للجميع — انتقل عند الانتهاء" : "Synced: same question for all — advance when ready")
                  : (ar ? "لمحة عن السؤال الحالي للطلاب" : "Approx. student question")}
              </p>
              {hostQuestion && (
                <div style={{ margin: 0 }}>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>
                    <span style={{ opacity: 0.65, marginInlineEnd: 8 }}>#{hostQuestion.index + 1}</span>
                    {hostQuestion.text}
                  </p>
                  {hostQuestion.imageUrl && (
                    <img
                      src={hostQuestion.imageUrl}
                      alt=""
                      style={{ marginTop: 8, maxHeight: 140, maxWidth: "100%", borderRadius: 10, objectFit: "contain", background: "rgba(0,0,0,0.2)" }}
                    />
                  )}
                </div>
              )}
              {advanceMode === "host_sync" && (
                <button
                  type="button"
                  onClick={hostNextQuestion}
                  style={{
                    marginTop: 12,
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: `1.5px solid ${GOLD}`,
                    background: `linear-gradient(135deg, ${GOLD}, #c89212)`,
                    color: "#000",
                    fontWeight: 900,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ChevronRight size={18} />
                  {ar ? "السؤال التالي للجميع" : "Next question (everyone)"}
                </button>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 480px) 1fr", gap: 16 }}>
            {/* Race track — camera follows the leader so the field always fits */}
            <div style={{
              position: "relative",
              height: "calc(100dvh - 100px)",
              background: "linear-gradient(180deg, rgba(30,45,110,0.20), rgba(10,15,40,0.32))",
              borderRadius: 18,
              border: "1px solid rgba(130,160,255,0.22)",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.35), 0 10px 30px -14px rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              overflow: "hidden",
              padding: "16px 8px",
            }}>
              {/* Orbit gate shimmer at the top */}
              <div aria-hidden style={{
                position: "absolute", top: 6, left: "6%", right: "6%", height: 2.5,
                borderRadius: 2,
                background: `linear-gradient(90deg, transparent, ${CYAN}, ${GOLD}, ${CYAN}, transparent)`,
                backgroundSize: "200% 100%",
                animation: "rrhGate 3s linear infinite",
                boxShadow: `0 0 12px ${CYAN}80`,
                opacity: 0.75,
              }} />
              {/* Race timer chip + leader-altitude label */}
              <div style={{
                position: "absolute", top: 12, left: 0, right: 0,
                display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
                pointerEvents: "none",
              }}>
                {gameTimeLeft !== null && (() => {
                  const t = gameTimeLeft;
                  const danger = t <= 30;
                  const warn = !danger && t <= 60;
                  const bg = danger ? "rgba(220,38,38,0.95)" : warn ? "rgba(217,165,33,0.95)" : "rgba(0,0,0,0.55)";
                  const mm = Math.floor(t / 60);
                  const ss = t % 60;
                  return (
                    <span style={{
                      padding: "4px 10px", borderRadius: 999,
                      background: bg, color: "#fff",
                      border: `1.5px solid ${danger ? "#ff4040" : warn ? GOLD : "rgba(255,255,255,0.2)"}`,
                      fontSize: 13, fontWeight: 900, fontVariantNumeric: "tabular-nums",
                      boxShadow: danger ? "0 0 14px rgba(255,40,40,0.5)" : "none",
                    }}>
                      ⏱️ {mm}:{String(ss).padStart(2, "0")}
                    </span>
                  );
                })()}
              </div>

              {(() => {
                // Camera follows the leader; map each player's altitude relative
                // to the leader so they sit between ~6%-92% on the visible track.
                const leaderAlt = sortedPlayers.length > 0
                  ? Math.max(...sortedPlayers.map(p => p.altitude))
                  : 0;
                const visibleSpan = 80; // altitude units that fit on screen
                return sortedPlayers.map((p, idx) => {
                  const xPos = (idx / Math.max(1, sortedPlayers.length - 1)) * 80 + 10;
                  const diff = p.altitude - leaderAlt; // <= 0
                  const bottomPct = Math.max(4, Math.min(92, 88 + (diff / visibleSpan) * 80));
                  const powerBadgeCount = (p.boostAvailable ?? 0) + (p.multiplierAvailable ?? 0);
                  return (
                    <motion.div
                      key={p.name}
                      animate={{ bottom: `${bottomPct}%`, left: `${xPos}%` }}
                      initial={false}
                      transition={{ type: "spring", stiffness: 50, damping: 20 }}
                      style={{
                        position: "absolute",
                        transform: "translateX(-50%)",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      }}
                    >
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "#fff",
                        background: "rgba(0,0,0,0.6)",
                        padding: "1px 5px", borderRadius: 999,
                        whiteSpace: "nowrap", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>
                        {p.avatar} {p.name}
                        {powerBadgeCount > 0 && <span style={{ color: GOLD, fontWeight: 900 }}>⚡{powerBadgeCount}</span>}
                        {p.finished && p.finishRank ? ` 🏆${p.finishRank}` : ""}
                      </span>
                      <RocketIcon color={p.rocketColor} size={26} />
                    </motion.div>
                  );
                });
              })()}
            </div>

            {/* Live leaderboard */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: "#fff", fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={18} color={GOLD} />
                  {ar ? "اللوحة المباشرة" : "Live Standings"}
                </h3>
                <button onClick={() => setConfirmEnd(true)} style={{
                  padding: "8px 14px", borderRadius: 12, border: "1.5px solid rgba(220,38,38,0.6)",
                  background: "rgba(220,38,38,0.15)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <X size={14} />
                  {ar ? "إنهاء" : "End"}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedPlayers.map((p, idx) => (
                  <motion.div
                    key={p.name}
                    layout
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      background: idx < 3
                        ? `linear-gradient(135deg, ${GOLD}28, ${GOLD}0d)`
                        : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                      borderRadius: 14,
                      border: idx < 3 ? `1.5px solid ${GOLD}55` : "1px solid rgba(255,255,255,0.09)",
                      boxShadow: idx < 3 ? `0 0 16px ${GOLD}22, inset 0 1px 0 rgba(255,255,255,0.1)` : "inset 0 1px 0 rgba(255,255,255,0.06)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 10,
                      background: idx === 0 ? GOLD : idx === 1 ? "#cbd5e1" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.15)",
                      color: idx < 3 ? "#000" : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: 12,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 20 }}>{p.avatar}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                        {p.streak >= 3 && <span style={{ marginInlineStart: 6, color: "#ff6b1a", fontSize: 11 }}>🔥{p.streak}</span>}
                      </p>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ color: GOLD, fontSize: 11, fontWeight: 700 }}>
                          {Math.round(p.altitude)}% · {p.score} pts
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                          ✓{p.correctCount} ✗{p.wrongCount}
                        </span>
                      </div>
                    </div>
                    {p.finished && (
                      <span style={{ fontSize: 18 }}>
                        {p.finishRank === 1 ? "🥇" : p.finishRank === 2 ? "🥈" : p.finishRank === 3 ? "🥉" : "🏁"}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finished */}
      {phase === "finished" && (
        <div style={{ position: "relative", zIndex: 5, padding: "30px 16px", maxWidth: 700, marginInline: "auto" }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              position: "relative",
              background: "linear-gradient(160deg, rgba(20,28,64,0.78), rgba(10,14,38,0.68))",
              backdropFilter: "blur(14px)",
              borderRadius: 24,
              padding: 28,
              border: `1.5px solid ${GOLD}90`,
              boxShadow: `0 20px 50px -18px rgba(0,0,0,0.85), 0 0 40px ${GOLD}18, inset 0 1px 0 rgba(255,255,255,0.1)`,
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            <div aria-hidden style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
              background: `linear-gradient(90deg, transparent, ${GOLD}, ${CYAN}, transparent)`,
              backgroundSize: "200% 100%",
              animation: "rrhGate 3.5s linear infinite",
            }} />
            <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
              <div style={{
                position: "absolute", left: "50%", top: "50%", width: 140, height: 140,
                transform: "translate(-50%,-50%)",
                background: `radial-gradient(circle, ${GOLD}40 0%, transparent 70%)`,
                borderRadius: "50%",
                animation: "rrhPulse 2.4s ease-in-out infinite",
              }} />
              <Trophy size={70} color={GOLD} style={{ position: "relative", filter: `drop-shadow(0 0 18px ${GOLD})` }} />
            </div>
            <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 900, margin: "0 0 4px" }}>
              {ar ? "انتهى السباق!" : "Race Complete!"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: 0 }}>
              {ar ? "شاهد النتائج النهائية" : "Final standings"}
            </p>

            <div style={{ marginTop: 24, textAlign: "start" }}>
              {sortedPlayers.slice(0, 10).map((p, idx) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", margin: "8px 0",
                    borderRadius: 14,
                    background: idx < 3 ? `${GOLD}25` : "rgba(255,255,255,0.06)",
                    border: idx < 3 ? `1.5px solid ${GOLD}` : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: idx === 0 ? GOLD : idx === 1 ? "#cbd5e1" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.15)",
                    color: idx < 3 ? "#000" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 900, fontSize: 16,
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: 28 }}>{p.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 16 }}>{p.name}</p>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                      {p.score} pts · {p.correctCount} ✓ · {Math.round(p.altitude)}%
                    </p>
                  </div>
                  {idx < 3 && <span style={{ fontSize: 28 }}>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>}
                </motion.div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={replay} style={btnAction(GREEN)}>
                <RefreshCw size={18} />
                {ar ? "أعد اللعب" : "Replay"}
              </button>
              <button onClick={() => setLocation("/")} style={btnAction(GOLD)}>
                <Home size={18} />
                {ar ? "الرئيسية" : "Home"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowQR(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            }}>
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 24, padding: 28,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                maxWidth: 360, width: "100%",
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <h3 style={{ margin: 0, color: GREEN, fontSize: 18, fontWeight: 900 }}>
                  {ar ? "باركود الانضمام" : "Join QR Code"}
                </h3>
                <button onClick={() => setShowQR(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ background: "#fff", padding: 16, border: "1px solid #f1f1f1", borderRadius: 14 }}>
                <QRCode value={joinUrl} size={240} />
              </div>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: GREEN, fontFamily: "monospace", letterSpacing: "0.2em" }} dir="ltr">
                {pin}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", wordBreak: "break-all", textAlign: "center" }}>
                {joinUrl}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm end modal */}
      <AnimatePresence>
        {confirmEnd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmEnd(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 18, padding: 24, maxWidth: 360, width: "100%" }}>
              <h3 style={{ margin: "0 0 8px", color: "#dc2626", fontSize: 18, fontWeight: 900 }}>
                {ar ? "إنهاء السباق؟" : "End the race?"}
              </h3>
              <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>
                {ar ? "سيتم إنهاء السباق فوراً ولن يتمكن المتسابقون من إكمال الأسئلة." : "The race will end now."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmEnd(false)} style={{ padding: "8px 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 700, cursor: "pointer" }}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={endRace} style={{ padding: "8px 16px", borderRadius: 12, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  {ar ? "إنهاء" : "End"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const btnSmall: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36,
  borderRadius: 999,
  border: "1.5px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
};

const btnAction = (bg: string): CSSProperties => ({
  padding: "10px 18px",
  borderRadius: 12,
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: 800, fontSize: 14,
  cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 8,
});
