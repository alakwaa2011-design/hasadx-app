import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Loader2, Trophy, CheckCircle2, XCircle, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const GREEN = "#225739";
const GOLD = "#D9A521";
const SPACE_BG = "linear-gradient(180deg, #0a0e27 0%, #1a1740 50%, #2d1b4e 100%)";

type QType = "mcq" | "true_false" | "fill_blank";

interface Question {
  index: number;
  text: string;
  type: QType;
  options: string[];
  duration: number;
}

interface Player {
  name: string;
  avatar: string;
  rocketColor: string;
  altitude: number;
  score: number;
  finished: boolean;
  finishRank?: number;
  streak: number;
  currentQuestionIdx: number;
}

// ─── Sound Engine ────────────────────────────────────────────────────────────
class RocketSoundEngine {
  ctx: AudioContext | null = null;
  muted = false;
  bgGain: GainNode | null = null;
  bgInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    try { this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* ignore */ }
    try { this.muted = localStorage.getItem("rocket-music-muted") === "1"; } catch { /* ignore */ }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem("rocket-music-muted", m ? "1" : "0"); } catch { /* ignore */ }
    if (m) this.stopBackground();
    else if (this.bgInterval === null) this.startBackground();
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, delay = 0, filterFreq = 4000) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    osc.type = type;
    osc.frequency.value = freq;
    const now = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + dur + 0.05);
  }

  startBackground() {
    if (this.muted || !this.ctx || this.bgInterval !== null) return;
    // Soft, ambient space loop
    const playLoop = () => {
      const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
      notes.forEach((f, i) => this.tone(f, 0.55, "sine", 0.06, i * 0.5, 1800));
      // Bass pulse
      this.tone(65.41, 0.5, "triangle", 0.08, 0, 800);
      this.tone(82.41, 0.5, "triangle", 0.08, 1.5, 800);
    };
    playLoop();
    this.bgInterval = setInterval(playLoop, 3500);
  }

  stopBackground() {
    if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
  }

  playLaunch() {
    // Whoosh + ascending tone
    this.tone(220, 0.3, "sawtooth", 0.1, 0, 1200);
    this.tone(330, 0.3, "sawtooth", 0.08, 0.05, 1500);
    this.tone(440, 0.4, "sine", 0.12, 0.1, 2000);
    this.tone(660, 0.5, "sine", 0.1, 0.2, 2500);
  }

  playCorrect() {
    // Cheerful chime
    this.tone(523.25, 0.1, "sine", 0.18);
    this.tone(659.25, 0.12, "sine", 0.18, 0.08);
    this.tone(783.99, 0.18, "sine", 0.2, 0.16);
    this.tone(1046.50, 0.25, "sine", 0.16, 0.24);
  }

  playWrong() {
    this.tone(220, 0.18, "triangle", 0.15);
    this.tone(165, 0.22, "triangle", 0.15, 0.1);
  }

  playBoost() {
    // Speed boost - whoosh up
    for (let i = 0; i < 8; i++) {
      this.tone(440 + i * 80, 0.06, "sine", 0.1, i * 0.04);
    }
  }

  playWin() {
    // Victory fanfare
    const melody = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    melody.forEach((f, i) => this.tone(f, 0.3, "sine", 0.18, i * 0.12));
    melody.forEach((f, i) => this.tone(f * 2, 0.4, "triangle", 0.1, i * 0.12 + 0.6));
  }

  playCountdown() {
    this.tone(880, 0.18, "sine", 0.2);
  }

  playGo() {
    this.tone(523.25, 0.2, "sine", 0.22);
    this.tone(783.99, 0.3, "sine", 0.22, 0.15);
  }

  playTick() {
    this.tone(900, 0.04, "sine", 0.06);
  }

  destroy() {
    this.stopBackground();
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}

// ─── Rocket SVG ──────────────────────────────────────────────────────────────
function RocketIcon({ color, isPlayer, size = 50, boosted = false }: { color: string; isPlayer?: boolean; size?: number; boosted?: boolean }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 60 96" style={{ filter: isPlayer ? "drop-shadow(0 4px 16px rgba(255,255,255,0.5))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>
      {/* Flame */}
      <motion.g
        animate={{ scaleY: boosted ? [1, 1.4, 1] : [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: boosted ? 0.15 : 0.3 }}
        style={{ originX: "30px", originY: "78px" }}
      >
        <path d="M22 78 Q30 96 38 78 Q34 86 30 88 Q26 86 22 78 Z" fill={boosted ? "#ffeb3b" : "#ff6b1a"} opacity="0.95" />
        <path d="M25 78 Q30 88 35 78 Q32 84 30 85 Q28 84 25 78 Z" fill="#ffd54f" opacity="0.95" />
      </motion.g>
      {/* Body */}
      <path d="M30 4 L42 28 L42 70 Q42 78 30 78 Q18 78 18 70 L18 28 Z" fill={color} />
      {/* Window */}
      <circle cx="30" cy="38" r="7" fill="#e0f2fe" stroke="#fff" strokeWidth="2" />
      <circle cx="30" cy="38" r="4" fill="#0284c7" opacity="0.6" />
      {/* Fins */}
      <path d="M18 60 L8 78 L18 76 Z" fill={color} opacity="0.85" />
      <path d="M42 60 L52 78 L42 76 Z" fill={color} opacity="0.85" />
      {/* Tip */}
      <path d="M30 4 L26 14 L34 14 Z" fill="#fff" opacity="0.9" />
      {/* Highlight stripe */}
      <rect x="22" y="46" width="16" height="3" fill="#fff" opacity="0.4" />
      <rect x="22" y="54" width="16" height="2" fill="#fff" opacity="0.3" />
    </svg>
  );
}

// ─── Stars background ──────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
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

export default function RocketPlay() {
  const params = useParams<{ pin: string }>();
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const queryName = sp.get("name") || "";
  const queryAvatar = sp.get("avatar") || "🦁";
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";

  const pin = params.pin || "";
  const [muted, setMutedState] = useState(() => {
    try { return localStorage.getItem("rocket-music-muted") === "1"; } catch { return false; }
  });
  const soundRef = useRef<RocketSoundEngine | null>(null);
  if (!soundRef.current) soundRef.current = new RocketSoundEngine();

  const [phase, setPhase] = useState<"connecting" | "lobby" | "countdown" | "racing" | "finished">("connecting");
  const [myAltitude, setMyAltitude] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [myColor, setMyColor] = useState("#dc2626");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctIndex?: number; correctText?: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [finishRank, setFinishRank] = useState<number | null>(null);
  const [countdownNum, setCountdownNum] = useState(3);
  const [fillAnswer, setFillAnswer] = useState("");
  const [boostFlash, setBoostFlash] = useState(false);
  const [title, setTitle] = useState("");

  // Init mute on engine
  useEffect(() => {
    soundRef.current?.setMuted(muted);
  }, [muted]);

  // Cleanup
  useEffect(() => () => {
    soundRef.current?.destroy();
  }, []);

  // Connect / join
  useEffect(() => {
    if (!pin || !queryName) { setLocation(`/game/rocket/join/${pin}`); return; }
    const socket = getRocketSocket();

    const joinFlow = () => {
      socket.emit("rocket:rejoin", { pin, name: queryName, avatar: queryAvatar }, (res: {
        success?: boolean; error?: string;
        state?: string; altitude?: number; score?: number; currentQuestionIdx?: number;
        totalQuestions?: number; rocketColor?: string; activeQuestion?: Question | null;
        finished?: boolean; finishRank?: number; title?: string;
      }) => {
        if (res.error) { toast.error(res.error); setLocation(`/game/rocket/join/${pin}`); return; }
        if (res.success) {
          setMyColor(res.rocketColor || "#dc2626");
          setTotalQuestions(res.totalQuestions || 0);
          if (res.title) setTitle(res.title);
          setMyAltitude(res.altitude || 0);
          setMyScore(res.score || 0);
          setFinished(!!res.finished);
          if (res.finishRank) setFinishRank(res.finishRank);
          if (res.state === "racing" && res.activeQuestion) {
            setCurrentQ(res.activeQuestion);
            setQuestionStartTime(Date.now());
            setPhase("racing");
          } else if (res.state === "racing" && res.finished) {
            setPhase("racing");
          } else if (res.state === "finished") {
            setPhase("finished");
          } else {
            setPhase("lobby");
          }
        }
      });
    };

    if (socket.connected) joinFlow();
    else socket.once("connect", joinFlow);

    socket.on("rocket:players-updated", (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("rocket:countdown", () => {
      setPhase("countdown");
      setCountdownNum(3);
      soundRef.current?.startBackground();
    });

    socket.on("rocket:race-start", (data: { total: number; question: Question }) => {
      setPhase("racing");
      setTotalQuestions(data.total);
      setCurrentQ(data.question);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      soundRef.current?.playLaunch();
    });

    socket.on("rocket:next-question", (q: Question) => {
      setCurrentQ(q);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setFillAnswer("");
    });

    socket.on("rocket:leaderboard", (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("rocket:game-end", () => {
      setPhase("finished");
      soundRef.current?.stopBackground();
    });

    socket.on("rocket:replay", () => {
      setMyAltitude(0); setMyScore(0); setMyStreak(0);
      setFinished(false); setFinishRank(null);
      setPhase("lobby");
    });

    return () => {
      socket.off("rocket:players-updated");
      socket.off("rocket:countdown");
      socket.off("rocket:race-start");
      socket.off("rocket:next-question");
      socket.off("rocket:leaderboard");
      socket.off("rocket:game-end");
      socket.off("rocket:replay");
    };
  }, [pin, queryName, queryAvatar, setLocation]);

  // Countdown ticker
  useEffect(() => {
    if (phase !== "countdown") return;
    soundRef.current?.playCountdown();
    const intv = setInterval(() => {
      setCountdownNum(n => {
        if (n <= 1) {
          clearInterval(intv);
          soundRef.current?.playGo();
          return 0;
        }
        soundRef.current?.playCountdown();
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(intv);
  }, [phase]);

  // Question timer
  useEffect(() => {
    if (phase !== "racing" || !currentQ || finished) return;
    setTimeLeft(currentQ.duration);
    const startMs = Date.now();
    const intv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const remaining = Math.max(0, currentQ.duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 5 && remaining > 0) soundRef.current?.playTick();
      if (remaining === 0) {
        clearInterval(intv);
        // Auto-submit -1 (wrong)
        submitAnswer(-1);
      }
    }, 1000);
    return () => clearInterval(intv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.index, phase, finished]);

  const submitAnswer = useCallback((answerIndex: number, answerText?: string) => {
    if (!currentQ || finished) return;
    const socket = getRocketSocket();
    socket.emit("rocket:answer", { pin, answerIndex, answerText }, (res: {
      success?: boolean; error?: string;
      correct?: boolean; correctIndex?: number; correctText?: string;
      altitude?: number; score?: number; streak?: number;
      finished?: boolean; finishRank?: number;
    }) => {
      if (res.error) { toast.error(res.error); return; }
      if (res.success) {
        setFeedback({ correct: !!res.correct, correctIndex: res.correctIndex, correctText: res.correctText });
        const prevAlt = myAltitude;
        if (typeof res.altitude === "number") setMyAltitude(res.altitude);
        if (typeof res.score === "number") setMyScore(res.score);
        if (typeof res.streak === "number") setMyStreak(res.streak);
        if (res.correct) {
          soundRef.current?.playCorrect();
          if (typeof res.altitude === "number" && res.altitude - prevAlt > 12) {
            // Big jump = boost
            setBoostFlash(true);
            setTimeout(() => setBoostFlash(false), 800);
            setTimeout(() => soundRef.current?.playBoost(), 200);
          }
        } else {
          soundRef.current?.playWrong();
        }
        if (res.finished) {
          setFinished(true);
          if (res.finishRank) setFinishRank(res.finishRank);
          if (res.finishRank === 1) soundRef.current?.playWin();
        }
      }
    });
  }, [currentQ, finished, myAltitude, pin]);

  const handleMCQAnswer = (idx: number) => {
    if (feedback) return;
    submitAnswer(idx);
  };

  const handleFillSubmit = () => {
    if (!fillAnswer.trim() || feedback) return;
    submitAnswer(-1, fillAnswer.trim());
  };

  const me = players.find(p => p.name === queryName);
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return (a.finishRank || 99) - (b.finishRank || 99);
    return b.altitude - a.altitude;
  });

  // ─── RENDER ────────────────────────────────────────────────────────────
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
          <span style={{ fontSize: 22 }}>{queryAvatar}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{queryName}</p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
              {ar ? "نقاط:" : "Score:"} <span style={{ color: GOLD, fontWeight: 700 }}>{myScore}</span>
              {myStreak >= 3 && <span style={{ marginInlineStart: 8, color: "#ff6b1a" }}>🔥 {myStreak}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMutedState(m => !m)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            fontWeight: 600, fontSize: 12,
            cursor: "pointer",
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? (ar ? "صامت" : "Muted") : (ar ? "صوت" : "Sound")}
        </button>
      </div>

      {title && (
        <div style={{ position: "relative", zIndex: 5, textAlign: "center", padding: "8px 16px", color: "#fff", opacity: 0.8, fontSize: 13, fontWeight: 600 }}>
          🚀 {title}
        </div>
      )}

      {/* Lobby */}
      {phase === "lobby" && (
        <div style={{ position: "relative", zIndex: 5, padding: "40px 20px", textAlign: "center" }}>
          <motion.div
            animate={{ y: [-6, 6, -6] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            style={{ display: "inline-block", marginBottom: 20 }}
          >
            <RocketIcon color={myColor} isPlayer size={80} />
          </motion.div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 8px" }}>
            {ar ? "في انتظار الانطلاق..." : "Awaiting Launch..."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: 0 }}>
            {ar ? "سينطلق السباق عند بدء المعلم" : "Race will start when teacher launches"}
          </p>
          <div style={{
            marginTop: 28,
            display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
            maxWidth: 600, marginInline: "auto",
          }}>
            {players.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: p.name === queryName ? `${GOLD}30` : "rgba(255,255,255,0.1)",
                  border: p.name === queryName ? `1.5px solid ${GOLD}` : "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                }}
              >
                <span>{p.avatar}</span>
                <span>{p.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Countdown */}
      {phase === "countdown" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,14,39,0.85)", backdropFilter: "blur(8px)" }}>
          <motion.div
            key={countdownNum}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            style={{
              fontSize: 160,
              fontWeight: 900,
              color: GOLD,
              textShadow: `0 0 40px ${GOLD}, 0 0 80px ${GOLD}80`,
            }}
          >
            {countdownNum > 0 ? countdownNum : (ar ? "انطلق!" : "GO!")}
          </motion.div>
        </div>
      )}

      {/* Racing */}
      {phase === "racing" && (
        <div style={{ position: "relative", zIndex: 5, display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", gap: 16, padding: 16, alignItems: "start" }}>
          {/* Race track (left) */}
          <div style={{
            position: "relative",
            height: "calc(100dvh - 100px)",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
            padding: "16px 8px",
          }}>
            {/* Finish line */}
            <div style={{
              position: "absolute", top: 16, left: 0, right: 0,
              height: 4,
              background: `repeating-linear-gradient(90deg, ${GOLD} 0 12px, #fff 12px 24px)`,
              boxShadow: `0 0 16px ${GOLD}80`,
            }} />
            <div style={{
              position: "absolute", top: 22, left: 0, right: 0,
              textAlign: "center", color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 2,
            }}>
              🏁 {ar ? "خط النهاية" : "FINISH"}
            </div>

            {/* Player rockets */}
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {sortedPlayers.map((p, idx) => {
                const isMe = p.name === queryName;
                const xPos = (idx / Math.max(1, sortedPlayers.length - 1)) * 80 + 10;
                const yPos = 100 - p.altitude; // 0% altitude = bottom, 100% = top
                return (
                  <motion.div
                    key={p.name}
                    animate={{
                      bottom: `${p.altitude}%`,
                      left: `${xPos}%`,
                    }}
                    initial={false}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    style={{
                      position: "absolute",
                      transform: "translateX(-50%)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      zIndex: isMe ? 10 : 5 - Math.min(4, idx),
                      opacity: isMe ? 1 : 0.85,
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      color: isMe ? GOLD : "#fff",
                      background: "rgba(0,0,0,0.5)",
                      padding: "1px 6px", borderRadius: 999,
                      whiteSpace: "nowrap",
                      maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {p.avatar} {p.name}{p.finished && p.finishRank ? ` 🏆${p.finishRank}` : ""}
                    </span>
                    <RocketIcon color={p.rocketColor} isPlayer={isMe} size={isMe ? 36 : 28} boosted={isMe && boostFlash} />
                  </motion.div>
                );
              })}
            </div>

            {/* Altitude markers */}
            <div style={{ position: "absolute", left: 4, top: 16, bottom: 8, width: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 700 }}>
              {[100, 75, 50, 25, 0].map(v => <span key={v}>{v}%</span>)}
            </div>
          </div>

          {/* Question (right) */}
          <div>
            {finished ? (
              <div style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: 24, padding: 32,
                textAlign: "center",
                border: `2px solid ${GOLD}`,
              }}>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ fontSize: 80 }}
                >
                  {finishRank === 1 ? "🥇" : finishRank === 2 ? "🥈" : finishRank === 3 ? "🥉" : "🚀"}
                </motion.div>
                <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "12px 0 8px" }}>
                  {ar ? "وصلت للفضاء!" : "You Made It!"}
                </h2>
                <p style={{ color: GOLD, fontSize: 18, fontWeight: 800, margin: 0 }}>
                  {ar ? "ترتيبك:" : "Rank:"} #{finishRank}
                </p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "8px 0 0" }}>
                  {ar ? "نقاطك:" : "Score:"} {myScore}
                </p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: "16px 0 0" }}>
                  {ar ? "في انتظار باقي المتسابقين..." : "Waiting for others to finish..."}
                </p>
              </div>
            ) : currentQ ? (
              <div>
                {/* Header: progress + timer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 700 }}>
                    {ar ? "السؤال" : "Q"} {currentQ.index + 1} / {totalQuestions}
                  </span>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: timeLeft <= 5 ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.1)",
                    border: `1.5px solid ${timeLeft <= 5 ? "#dc2626" : "rgba(255,255,255,0.2)"}`,
                    color: "#fff",
                    fontWeight: 800, fontSize: 14,
                  }}>
                    ⏱ {timeLeft}s
                  </div>
                </div>

                {/* Question text */}
                <div style={{
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  padding: "20px 18px",
                  marginBottom: 14,
                  border: `1.5px solid ${GOLD}40`,
                  minHeight: 80,
                }}>
                  <p style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
                    {currentQ.text}
                  </p>
                </div>

                {/* Options */}
                {currentQ.type === "mcq" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {currentQ.options.map((opt, idx) => {
                      const COLORS = [
                        "linear-gradient(160deg, #7A0A0A, #B01414)",
                        "linear-gradient(160deg, #08386E, #1260A8)",
                        "linear-gradient(160deg, #B8860B, #DAA520)",
                        "linear-gradient(160deg, #5A1A8A, #8B35C8)",
                      ];
                      const showCorrect = feedback && feedback.correctIndex === idx;
                      return (
                        <motion.button
                          key={idx}
                          whileTap={{ scale: 0.97 }}
                          disabled={!!feedback}
                          onClick={() => handleMCQAnswer(idx)}
                          style={{
                            background: showCorrect ? "linear-gradient(160deg, #16a34a, #22c55e)" : COLORS[idx % 4],
                            border: showCorrect ? `2px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.15)",
                            borderRadius: 16,
                            padding: "16px 14px",
                            color: "#fff",
                            fontSize: 16, fontWeight: 800,
                            textAlign: "start",
                            minHeight: 70,
                            cursor: feedback ? "default" : "pointer",
                            opacity: feedback && !showCorrect ? 0.4 : 1,
                            transition: "opacity .25s",
                          }}
                        >
                          <span style={{
                            display: "inline-block", width: 26, height: 26, borderRadius: 8,
                            background: "rgba(255,255,255,0.25)",
                            color: "#fff", fontWeight: 900,
                            textAlign: "center", lineHeight: "26px", marginInlineEnd: 10,
                            fontSize: 13,
                          }}>
                            {["أ", "ب", "ج", "د"][idx]}
                          </span>
                          {opt}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === "true_false" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { idx: 0, label: ar ? "صحيح" : "True", color: "linear-gradient(160deg, #16a34a, #22c55e)", icon: <CheckCircle2 size={32} /> },
                      { idx: 1, label: ar ? "خطأ" : "False", color: "linear-gradient(160deg, #dc2626, #ef4444)", icon: <XCircle size={32} /> },
                    ].map(o => {
                      const showCorrect = feedback && feedback.correctIndex === o.idx;
                      return (
                        <motion.button
                          key={o.idx}
                          whileTap={{ scale: 0.97 }}
                          disabled={!!feedback}
                          onClick={() => handleMCQAnswer(o.idx)}
                          style={{
                            background: o.color,
                            border: showCorrect ? `3px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.15)",
                            borderRadius: 18,
                            padding: "26px 18px",
                            color: "#fff",
                            fontSize: 22, fontWeight: 900,
                            cursor: feedback ? "default" : "pointer",
                            opacity: feedback && !showCorrect ? 0.4 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                            minHeight: 100,
                          }}
                        >
                          {o.icon}
                          {o.label}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === "fill_blank" && (
                  <div>
                    <input
                      value={fillAnswer}
                      onChange={e => setFillAnswer(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleFillSubmit()}
                      disabled={!!feedback}
                      placeholder={ar ? "اكتب إجابتك هنا..." : "Type your answer..."}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "16px 18px",
                        background: "rgba(255,255,255,0.1)",
                        border: `2px solid ${feedback?.correct ? "#16a34a" : feedback?.correct === false ? "#dc2626" : "rgba(255,255,255,0.2)"}`,
                        borderRadius: 14,
                        color: "#fff",
                        fontSize: 18, fontWeight: 700,
                        outline: "none",
                        marginBottom: 12,
                      }}
                    />
                    <button
                      onClick={handleFillSubmit}
                      disabled={!!feedback || !fillAnswer.trim()}
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        background: feedback ? "rgba(255,255,255,0.15)" : `linear-gradient(135deg, ${GOLD}, #c89212)`,
                        border: "none",
                        borderRadius: 14,
                        color: "#fff",
                        fontSize: 16, fontWeight: 900,
                        cursor: feedback ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: !fillAnswer.trim() ? 0.5 : 1,
                      }}
                    >
                      <Send size={18} />
                      {ar ? "إرسال" : "Submit"}
                    </button>
                    {feedback && feedback.correctText && !feedback.correct && (
                      <p style={{ marginTop: 12, color: GOLD, fontSize: 14, fontWeight: 700, textAlign: "center" }}>
                        {ar ? "الإجابة الصحيحة:" : "Correct answer:"} {feedback.correctText}
                      </p>
                    )}
                  </div>
                )}

                {/* Feedback banner */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        marginTop: 14,
                        padding: "12px 16px",
                        borderRadius: 14,
                        background: feedback.correct ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)",
                        border: `2px solid ${feedback.correct ? "#16a34a" : "#dc2626"}`,
                        textAlign: "center",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      {feedback.correct
                        ? (ar ? "🚀 إجابة صحيحة! ارتفع صاروخك!" : "🚀 Correct! Rocket boosted!")
                        : (ar ? "❌ إجابة خاطئة" : "❌ Wrong answer")}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Finished */}
      {phase === "finished" && (
        <FinishedScreen
          players={sortedPlayers}
          myName={queryName}
          myScore={myScore}
          ar={ar}
          onHome={() => setLocation("/")}
        />
      )}

      {/* Indicator: my altitude (small float) */}
      {phase === "racing" && me && (
        <div style={{
          position: "fixed", bottom: 16, [ar ? "left" : "right"]: 16,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "8px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          border: `1.5px solid ${GOLD}`,
          backdropFilter: "blur(8px)",
        }}>
          🚀 {ar ? "ارتفاع:" : "Alt:"} <span style={{ color: GOLD }}>{Math.round(myAltitude)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Finished Screen ──────────────────────────────────────────────────────
function FinishedScreen({
  players, myName, myScore, ar, onHome,
}: {
  players: Player[];
  myName: string;
  myScore: number;
  ar: boolean;
  onHome: () => void;
}) {
  const myRank = players.findIndex(p => p.name === myName) + 1;
  return (
    <div style={{ position: "relative", zIndex: 5, padding: "30px 16px", maxWidth: 600, marginInline: "auto" }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
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
        <Trophy size={60} color={GOLD} style={{ margin: "0 auto 12px" }} />
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "0 0 4px" }}>
          {ar ? "انتهى السباق!" : "Race Complete!"}
        </h1>
        <p style={{ color: GOLD, fontSize: 16, fontWeight: 800, margin: 0 }}>
          {ar ? "ترتيبك:" : "Your Rank:"} #{myRank} · {ar ? "نقاطك:" : "Score:"} {myScore}
        </p>

        <div style={{ marginTop: 24, textAlign: "start" }}>
          {players.slice(0, 10).map((p, idx) => {
            const isMe = p.name === myName;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  margin: "6px 0",
                  borderRadius: 14,
                  background: isMe ? `${GOLD}25` : "rgba(255,255,255,0.06)",
                  border: isMe ? `1.5px solid ${GOLD}` : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: idx === 0 ? GOLD : idx === 1 ? "#cbd5e1" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.15)",
                  color: idx < 3 ? "#000" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 14,
                }}>
                  {idx + 1}
                </span>
                <span style={{ fontSize: 22 }}>{p.avatar}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 14 }}>
                    {p.name} {isMe && <span style={{ color: GOLD, fontSize: 11 }}>({ar ? "أنت" : "you"})</span>}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                    {ar ? "النقاط:" : "Score:"} {p.score}
                  </p>
                </div>
                {p.finished && p.finishRank && p.finishRank <= 3 && (
                  <span style={{ fontSize: 22 }}>{p.finishRank === 1 ? "🥇" : p.finishRank === 2 ? "🥈" : "🥉"}</span>
                )}
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={onHome}
          style={{
            marginTop: 24,
            padding: "12px 24px",
            background: `linear-gradient(135deg, ${GOLD}, #c89212)`,
            border: "none",
            borderRadius: 14,
            color: "#fff",
            fontSize: 15, fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {ar ? "الرئيسية" : "Home"}
        </button>
      </motion.div>
    </div>
  );
}
