import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, VolumeX, Loader2, Trophy, Play, Copy, Check,
  Users, RefreshCw, Home, X, Rocket,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const GREEN = "#225739";
const GOLD = "#D9A521";
const SPACE_BG = "linear-gradient(180deg, #0a0e27 0%, #1a1740 50%, #2d1b4e 100%)";

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
}

function RocketIcon({ color, size = 30 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96">
      <motion.g animate={{ scaleY: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.3 }} style={{ originX: "30px", originY: "78px" }}>
        <path d="M22 78 Q30 96 38 78 Q34 86 30 88 Q26 86 22 78 Z" fill="#ff6b1a" opacity="0.95" />
        <path d="M25 78 Q30 88 35 78 Q32 84 30 85 Q28 84 25 78 Z" fill="#ffd54f" opacity="0.95" />
      </motion.g>
      <path d="M30 4 L42 28 L42 70 Q42 78 30 78 Q18 78 18 70 L18 28 Z" fill={color} />
      <circle cx="30" cy="38" r="7" fill="#e0f2fe" stroke="#fff" strokeWidth="2" />
      <circle cx="30" cy="38" r="4" fill="#0284c7" opacity="0.6" />
      <path d="M18 60 L8 78 L18 76 Z" fill={color} opacity="0.85" />
      <path d="M42 60 L52 78 L42 76 Z" fill={color} opacity="0.85" />
      <path d="M30 4 L26 14 L34 14 Z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

function StarField() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 3,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map(s => (
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
            boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
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
  const reclaimedRef = useRef(false);

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

    const reclaim = () => {
      if (reclaimedRef.current) return;
      reclaimedRef.current = true;
      socket.emit("rocket:reclaim-host", { pin, creatorToken: token }, (res: {
        success?: boolean; error?: string;
        state?: string; players?: Player[]; totalQuestions?: number; duration?: number; title?: string;
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
          if (res.state === "lobby") setPhase("lobby");
          else if (res.state === "racing" || res.state === "countdown") setPhase("racing");
          else if (res.state === "finished") setPhase("finished");
        }
      });
    };

    if (!token) {
      toast.error(ar ? "لا توجد صلاحية المعلم. أعد إنشاء السباق." : "No host token. Re-create the race.");
      setLocation("/game/rocket/create");
      return;
    }

    if (socket.connected) reclaim();
    else socket.once("connect", reclaim);

    socket.on("rocket:players-updated", (data: { players: Player[] }) => setPlayers(data.players));
    socket.on("rocket:countdown", () => { setPhase("racing"); playLaunchSound(); });
    socket.on("rocket:race-start", () => setPhase("racing"));
    socket.on("rocket:leaderboard", (data: { players: Player[] }) => setPlayers(data.players));
    socket.on("rocket:game-end", (data: { players: Player[] }) => {
      setPhase("finished");
      setPlayers(data.players);
    });
    socket.on("rocket:replay", (data: { players: Player[] }) => {
      setPhase("lobby");
      setPlayers(data.players);
    });

    return () => {
      socket.off("rocket:players-updated");
      socket.off("rocket:countdown");
      socket.off("rocket:race-start");
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
      <StarField />

      {/* Top bar */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px",
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff" }}>
          <Rocket size={22} color={GOLD} />
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>
              {ar ? "سباق الصواريخ" : "Rocket Race"}
              {title && <span style={{ marginInlineStart: 8, opacity: 0.7, fontWeight: 600 }}>· {title}</span>}
            </p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
              {ar ? "أنت المعلم" : "Host"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            background: "rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: 24,
            border: "1.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 24, alignItems: "center" }}>
              {/* Left: pin */}
              <div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700 }}>
                  {ar ? "للانضمام، ادخلوا على:" : "Join at:"}
                </p>
                <p style={{ margin: "4px 0", color: "#fff", fontSize: 16, fontWeight: 700, opacity: 0.9 }} dir="ltr">
                  {window.location.host}/game/rocket/join
                </p>
                <div style={{
                  marginTop: 12,
                  background: GOLD,
                  borderRadius: 18,
                  padding: "16px 24px",
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontSize: 48,
                  fontWeight: 900,
                  color: "#000",
                  letterSpacing: "0.15em",
                  fontFamily: "monospace",
                  boxShadow: `0 12px 32px -8px ${GOLD}80`,
                }} dir="ltr">
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
                padding: "10px 20px",
                borderRadius: 14, border: "none",
                background: players.length === 0
                  ? "rgba(255,255,255,0.15)"
                  : `linear-gradient(135deg, ${GOLD}, #c89212)`,
                color: "#fff",
                fontWeight: 900, fontSize: 16,
                cursor: players.length === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: players.length > 0 ? `0 10px 24px -8px ${GOLD}80` : "none",
                opacity: players.length === 0 ? 0.5 : 1,
              }}
            >
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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 480px) 1fr", gap: 16 }}>
            {/* Race track */}
            <div style={{
              position: "relative",
              height: "calc(100dvh - 100px)",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
              padding: "16px 8px",
            }}>
              <div style={{
                position: "absolute", top: 16, left: 0, right: 0, height: 4,
                background: `repeating-linear-gradient(90deg, ${GOLD} 0 12px, #fff 12px 24px)`,
                boxShadow: `0 0 16px ${GOLD}80`,
              }} />
              <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>
                🏁 {ar ? "خط النهاية" : "FINISH"}
              </div>

              {sortedPlayers.map((p, idx) => {
                const xPos = (idx / Math.max(1, sortedPlayers.length - 1)) * 80 + 10;
                return (
                  <motion.div
                    key={p.name}
                    animate={{ bottom: `${p.altitude}%`, left: `${xPos}%` }}
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
                      whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {p.avatar} {p.name}{p.finished && p.finishRank ? ` 🏆${p.finishRank}` : ""}
                    </span>
                    <RocketIcon color={p.rocketColor} size={26} />
                  </motion.div>
                );
              })}

              <div style={{
                position: "absolute", left: 4, top: 16, bottom: 8, width: 16,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700,
              }}>
                {[100, 75, 50, 25, 0].map(v => <span key={v}>{v}%</span>)}
              </div>
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
                      background: idx < 3 ? `${GOLD}15` : "rgba(255,255,255,0.05)",
                      borderRadius: 14,
                      border: idx < 3 ? `1.5px solid ${GOLD}40` : "1px solid rgba(255,255,255,0.08)",
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
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              borderRadius: 24,
              padding: 28,
              border: `2px solid ${GOLD}`,
              textAlign: "center",
            }}
          >
            <Trophy size={70} color={GOLD} style={{ margin: "0 auto 12px" }} />
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

const btnSmall: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36,
  borderRadius: 999,
  border: "1.5px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
};

const btnAction = (bg: string): React.CSSProperties => ({
  padding: "10px 18px",
  borderRadius: 12,
  border: "none",
  background: bg,
  color: "#fff",
  fontWeight: 800, fontSize: 14,
  cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 8,
});
