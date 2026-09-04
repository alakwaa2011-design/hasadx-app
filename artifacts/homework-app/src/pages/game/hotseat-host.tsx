import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ThumbsUp, ThumbsDown, Send, Flame, Users, SkipForward, XCircle, Copy, Volume2, VolumeX, Hash, Share2, Smartphone, Medal, Award, User, Sparkles, Meh, Frown, CheckCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";
import { HotSeatIcon } from "@/components/game-icons";

const FIRE = "#FF6B2B";
const FIRE2 = "#FF9F43";
const GOLD = "#D9A521";
const DARK_BG = "linear-gradient(180deg, #050818 0%, #0d1230 50%, #1a0800 100%)";

type Phase = "lobby"|"picking"|"asking"|"answering"|"voting"|"result"|"ended";

interface Student { uid: string; name: string; avatar: string; color: string; score: number; isOnSeat: boolean; roundsOnSeat: number; }
interface Question { id: string; text: string; isPreset: boolean; likes: number; authorName?: string; }
interface GameState {
  pin: string; phase: Phase; teacherName: string; grade: string; subject: string; topic?: string;
  timerDuration: number; timerVal: number; currentSeatUid?: string; currentQuestion?: string;
  votes: { yes: number; no: number }; rounds: number;
  students: Student[]; questions: Question[];
  questionMode: "students" | "assignment" | "mixed";
  lastResult?: { convincingPct: number; pointsAwarded: number; speedBonus: boolean };
}

// Circular countdown SVG
function CircleTimer({ val, max, size = 160 }: { val: number; max: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, val / max);
  const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? FIRE2 : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transition={{ duration: 0.5 }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
      <text
        x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}
        fill={color} fontSize={size * 0.28} fontWeight={900} fontFamily="monospace"
      >
        {val}
      </text>
    </svg>
  );
}

export default function HotSeatHost() {
  const { pin } = useParams<{ pin: string }>();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  const [state, setState] = useState<GameState | null>(null);
  const [timerVal, setTimerVal] = useState(0);
  const [customQuestion, setCustomQuestion] = useState("");
  const [ending, setEnding] = useState(false);
  const [connected, setConnected] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const stateRef = useRef<GameState | null>(null);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("hotseat-muted") === "1"; } catch { return false; }
  });
  const toggleMute = () => setMuted(prev => {
    const next = !prev;
    try { localStorage.setItem("hotseat-muted", next ? "1" : "0"); } catch {}
    return next;
  });

  useEffect(() => {
    if (!pin) return;
    const token = sessionStorage.getItem(`hotseat-creator-${pin}`);
    if (!token) { toast.error(ar ? "رمز المضيف غير موجود" : "Host token missing"); setLocation("/game/hotseat/create"); return; }

    const socket = getHotSeatSocket();

    const reclaim = () => {
      setConnected(true);
      socket.emit("hotseat:reclaim", { pin, creatorToken: token }, (res: { success?: boolean; state?: GameState; error?: string }) => {
        if (res.error) { toast.error(res.error); return; }
        if (res.state) { setState(res.state); stateRef.current = res.state; setTimerVal(res.state.timerVal); }
      });
    };

    const handleDisconnect = () => setConnected(false);
    const handleConnect = () => reclaim();

    // Reclaim immediately if already connected, and on every subsequent reconnect
    if (socket.connected) reclaim();
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    socket.on("hotseat:phase-change", (data: { phase: Phase; state: GameState }) => {
      setState(data.state); stateRef.current = data.state;
      setTimerVal(data.state.timerVal);
    });
    socket.on("hotseat:players-updated", (data: { students: Student[] }) => {
      setState(prev => prev ? { ...prev, students: data.students } : prev);
    });
    socket.on("hotseat:questions-updated", (data: { questions: Question[] }) => {
      setState(prev => prev ? { ...prev, questions: data.questions } : prev);
    });
    // Host-only event includes authorName
    socket.on("hotseat:host-questions-updated", (data: { questions: Question[] }) => {
      setState(prev => prev ? { ...prev, questions: data.questions } : prev);
    });
    socket.on("hotseat:timer-tick", (data: { timerVal: number }) => {
      setTimerVal(data.timerVal);
    });
    socket.on("hotseat:vote-update", (data: { votes: { yes: number; no: number } }) => {
      setState(prev => prev ? { ...prev, votes: data.votes } : prev);
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("hotseat:phase-change");
      socket.off("hotseat:players-updated");
      socket.off("hotseat:questions-updated");
      socket.off("hotseat:timer-tick");
      socket.off("hotseat:vote-update");
    };
  }, [pin, ar, setLocation]);

  const emit = (event: string, data: object, cb?: (r: object) => void) => {
    const socket = getHotSeatSocket();
    socket.emit(event, { pin, ...data }, cb || ((r: { error?: string }) => {
      if (r.error) toast.error(r.error);
    }));
  };

  if (!state) {
    return (
      <div style={{ minHeight: "100dvh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
          <HotSeatIcon size={64} />
        </motion.div>
      </div>
    );
  }

  const { phase, students, questions, votes, currentSeatUid, currentQuestion, timerDuration, lastResult } = state;
  const seatStudent = currentSeatUid ? students.find(s => s.uid === currentSeatUid) : null;
  const sortedStudents = [...students].sort((a, b) => b.score - a.score);
  const totalVoters = students.filter(s => !s.isOnSeat).length;
  const votesCast = votes.yes + votes.no;
  const joinUrl = `${window.location.origin}/game/hotseat/join/${state.pin}`;

  // ── LOBBY VIEW ─────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    const pinDigits = state.pin.split("");
    const shareWhatsApp = () => {
      const text = ar
        ? `[الكرسي الساخن]\n${state.grade} · ${state.subject}${state.topic ? ` · ${state.topic}` : ""}\n\nرمز الدخول: ${state.pin}\n${joinUrl}`
        : `[HotSeat Game]\n${state.grade} · ${state.subject}\n\nCode: ${state.pin}\n${joinUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };
    return (
      <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative" }}>
        <div style={{ padding: "20px 16px", maxWidth: 560, marginInline: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={toggleMute} style={{
              padding: "7px 12px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.07)",
              color: muted ? "#ef4444" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700,
            }}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              {muted ? (ar ? "الصوت مكتوم" : "Muted") : (ar ? "صوت" : "Sound")}
            </button>
          </div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="inline-flex justify-center mb-4">
              <HotSeatIcon size={72} />
            </motion.div>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "8px 0 4px" }}>
              {ar ? "الكرسي الساخن — انتظر الطلاب" : "HotSeat — Waiting for Students"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
              {[state.grade, state.subject, state.topic].filter(Boolean).join(" · ") || ""}
            </p>
          </div>

          {/* Big PIN display */}
          <div style={{
            background: "rgba(0,0,0,0.5)", border: `1px solid rgba(255,255,255,0.15)`,
            borderRadius: 24, padding: "24px 16px", marginBottom: 14,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`,
            backdropFilter: "blur(12px)"
          }}>
            <div className="flex justify-center gap-2 items-center mb-4">
              <Hash size={16} color="rgba(255,255,255,0.6)" />
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 800, textAlign: "center", letterSpacing: "0.15em", margin: 0 }}>
                {ar ? "شارك هذا الرمز مع طلابك" : "SHARE THIS CODE WITH STUDENTS"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, direction: "ltr" }}>
              {pinDigits.map((d, i) => (
                <div key={i} style={{
                  width: 54, height: 68,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid rgba(255,255,255,0.15)`,
                  borderRadius: 14, fontSize: 40, fontWeight: 900, color: "#fff", fontFamily: "monospace",
                  boxShadow: `inset 0 2px 0 rgba(255,255,255,0.1)`
                }}>{d}</div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mb-5 opacity-60">
              <Smartphone size={14} color="#fff" />
              <p style={{ color: "#fff", fontSize: 11, textAlign: "center", margin: 0, direction: "ltr" }}>
                {joinUrl.replace("https://", "")}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(joinUrl); toast.success(ar ? "تم النسخ!" : "Copied!"); } catch { toast.error("Error"); }
                }}
                style={{
                  padding: "12px", borderRadius: 14, border: "none",
                  background: "rgba(255,255,255,0.08)", color: "#fff",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
                }}
              >
                <Copy size={16} /> {ar ? "نسخ الرابط" : "Copy Link"}
              </button>
              <button
                onClick={shareWhatsApp}
                style={{
                  padding: "12px", borderRadius: 14, border: "none",
                  background: "rgba(37,211,102,0.15)", color: "#25D366",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
                }}
              >
                <Share2 size={16} /> {ar ? "مشاركة" : "Share"}
              </button>
            </div>
          </div>

          {/* Students */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24, padding: "20px 20px", marginBottom: 16, backdropFilter: "blur(12px)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Users size={16} color={FIRE2} />
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 700 }}>
                {ar ? "الطلاب المنضمون" : "Students"}
              </span>
              <span style={{
                marginInlineStart: "auto",
                background: "rgba(255,255,255,0.1)",
                color: "#fff", fontWeight: 900, fontSize: 14, padding: "2px 10px", borderRadius: 999,
              }}>{students.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 40 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div key={s.uid} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 999,
                      background: "rgba(255,255,255,0.08)", border: `1px solid ${s.color}60`,
                    }}>
                    <span style={{ fontSize: 16 }}>{s.avatar}</span>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <motion.p animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0, fontWeight: 600, width: "100%", textAlign: "center", padding: "10px 0" }}>
                  {ar ? "في انتظار الطلاب..." : "Waiting for students..."}
                </motion.p>
              )}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => {
              if (students.length === 0) { toast.error(ar ? "لا يوجد طلاب بعد" : "No students yet"); return; }
              emit("hotseat:start", {}, (r: { error?: string; success?: boolean }) => {
                if (r.error) toast.error(r.error);
              });
            }}
            style={{
              width: "100%", padding: "18px", borderRadius: 24, border: "none",
              background: students.length === 0
                ? "rgba(255,255,255,0.06)"
                : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: students.length === 0 ? "rgba(255,255,255,0.3)" : "#fff",
              fontWeight: 900, fontSize: 18, cursor: students.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: students.length > 0 ? `0 12px 36px rgba(255,107,43,0.35)` : undefined,
              transition: "all 0.2s"
            }}
          >
            <Flame size={22} />
            {ar ? "بدء الجلسة" : "Start Session"}
          </button>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", marginTop: 12, fontWeight: 600 }}>
              {ar ? "انتظر حتى ينضم طالب واحد على الأقل" : "At least 1 student must join first"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
      {/* Ambient hot glow */}
      <div style={{ position: "fixed", bottom: -200, left: "50%", transform: "translateX(-50%)",
        width: 800, height: 400, background: `radial-gradient(ellipse, ${FIRE}15 0%, transparent 70%)`,
        pointerEvents: "none", zIndex: 0 }} />

      {/* Top bar */}
      <div style={{
        position: "relative", zIndex: 20, padding: "10px 16px",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap",
      }}>
        {/* Left: title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HotSeatIcon size={32} />
          <div>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 14, margin: 0 }}>
              {ar ? "الكرسي الساخن" : "HotSeat"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0 }}>
              {[state.grade, state.subject, state.topic].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {/* Center: PIN + copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Connection badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: connected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${connected ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: connected ? "#4ade80" : "#f87171",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block" }} />
            {connected ? (ar ? "متصل" : "Live") : (ar ? "انقطع..." : "Reconnecting")}
          </div>

          {/* PIN pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 10,
            background: `${FIRE}20`, border: `1px solid ${FIRE}45`,
          }}>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700 }}>PIN</span>
            <span style={{ color: FIRE2, fontWeight: 900, fontSize: 15, fontFamily: "monospace", letterSpacing: "0.1em" }}>{state.pin}</span>
          </div>

          {/* Copy link button */}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(joinUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2500);
              } catch { toast.error("Error"); }
            }}
            style={{
              padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer",
              background: linkCopied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
              color: linkCopied ? "#4ade80" : "rgba(255,255,255,0.75)",
              fontWeight: 700, fontSize: 11,
              display: "flex", alignItems: "center", gap: 4, transition: "all .2s",
            }}
          >
            <Copy size={12} />
            {linkCopied ? (ar ? "✓ تم!" : "✓ Done!") : (ar ? "نسخ الرابط" : "Copy Link")}
          </button>
        </div>

        {/* Right: student count, mute, end */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={13} /> {students.length}
          </div>
          <button onClick={toggleMute} style={{
            padding: "5px 9px", borderRadius: 9,
            border: `1px solid ${muted ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.15)"}`,
            background: muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
            color: muted ? "#ef4444" : "rgba(255,255,255,0.7)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
          }}>
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={() => {
              if (!confirm(ar ? "إنهاء الجلسة نهائياً؟" : "End session permanently?")) return;
              setEnding(true);
              emit("hotseat:end", {}, () => {});
            }}
            style={{ padding: "5px 10px", borderRadius: 9, border: "1px solid rgba(220,38,38,0.4)",
              background: "rgba(220,38,38,0.15)", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            {ending ? "..." : (ar ? "إنهاء" : "End")}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, padding: "16px" }}>

        {/* ── PICKING ─────────────────────────────────────── */}
        {phase === "picking" && (
          <div>
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <HotSeatIcon size={40} />
              </div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, textAlign: "center", margin: "0 0 6px" }}>
                {ar ? "اختر من يجلس على الكرسي" : "Pick the Hot Seat student"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", margin: "0 0 20px" }}>
                {ar ? `الجولة ${state.rounds + 1}` : `Round ${state.rounds + 1}`}
              </p>
            </div>

            {/* Leaderboard mini */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 24, paddingBottom: 8 }} className="scrollbar-hide">
              {sortedStudents.slice(0, 5).map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 16px", borderRadius: 16,
                  background: i === 0 ? "rgba(217, 165, 33, 0.15)" : "rgba(255,255,255,0.04)",
                  border: i === 0 ? `1px solid ${GOLD}` : "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0, minWidth: 90
                }}>
                  <span style={{ fontSize: 24 }}>{s.avatar}</span>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 14 }}>{s.score}</span>
                  {i === 0 && <Trophy size={16} color={GOLD} className="mt-1" />}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {students.map(s => (
                <motion.button
                  key={s.uid}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => emit("hotseat:pick-seat", { uid: s.uid })}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "20px 12px", borderRadius: 20,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid rgba(255,255,255,0.1)`,
                    cursor: "pointer", transition: "background 0.2s"
                  }}
                  className="hover:bg-white/10"
                >
                  <span style={{ fontSize: 40 }}>{s.avatar}</span>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>
                    {s.score} {ar ? "نقاط" : "pts"}
                  </span>
                  {s.roundsOnSeat > 0 && (
                    <span style={{ color: FIRE2, fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "rgba(255,159,67,0.15)", padding: "2px 8px", borderRadius: 12 }}>
                      <Flame size={12} /> ×{s.roundsOnSeat}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ── ASKING ──────────────────────────────────────── */}
        {phase === "asking" && seatStudent && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 12,
                  padding: "14px 28px", borderRadius: 999,
                  background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                  boxShadow: `0 8px 32px rgba(255,107,43,0.4)`,
                }}
              >
                <span style={{ fontSize: 32 }}>{seatStudent.avatar}</span>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>
                  {seatStudent.name}
                </span>
                <HotSeatIcon size={24} />
              </motion.div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: "8px 0 0" }}>
                {state.questionMode === "assignment"
                  ? (ar ? "اختر سؤالًا من الواجب..." : "Choose an assignment question...")
                  : state.questionMode === "students"
                    ? (ar ? "الطلاب يرسلون أسئلة مجهولة..." : "Students are sending anonymous questions...")
                    : (ar ? "اختر من أسئلة الواجب أو الطلاب..." : "Choose from assignment or student questions...")}
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: state.questionMode === "mixed" ? "1fr 1fr" : "1fr",
              gap: 14,
            }}>
              {/* Student questions */}
              {state.questionMode !== "assignment" && <div>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  {ar ? "أسئلة الطلاب" : "Student Questions"}
                  {questions.filter(q => !q.isPreset).length > 0 && (
                    <span style={{ color: FIRE, marginInlineStart: 6 }}>
                      ({questions.filter(q => !q.isPreset).length})
                    </span>
                  )}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {questions.filter(q => !q.isPreset).sort((a, b) => b.likes - a.likes).map(q => (
                    <QuestionCard key={q.id} q={q} ar={ar} onPick={() => emit("hotseat:pick-question", { questionId: q.id })} />
                  ))}
                  {questions.filter(q => !q.isPreset).length === 0 && (
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontStyle: "italic" }}>
                      {ar ? "لا أسئلة بعد..." : "No questions yet..."}
                    </p>
                  )}
                </div>
              </div>}

              {/* Preset / custom */}
              {state.questionMode !== "students" && <div>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  {ar ? "أسئلة جاهزة" : "Ready Questions"}
                  {questions.filter(q => q.isPreset).length > 0 && (
                    <span style={{ color: FIRE2, marginInlineStart: 6 }}>
                      ({questions.filter(q => q.isPreset).length})
                    </span>
                  )}
                </p>
                {/* Imported questions from assignment (isPreset = true) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 220, overflowY: "auto" }}>
                  {questions.filter(q => q.isPreset).length > 0 ? (
                    questions.filter(q => q.isPreset).map(q => (
                      <button
                        key={q.id}
                        onClick={() => emit("hotseat:pick-question", { questionId: q.id })}
                        style={{
                          padding: "10px 14px", borderRadius: 12,
                          border: `1.5px solid rgba(255,165,0,0.3)`,
                          background: "rgba(255,130,0,0.1)", color: "#fff",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "start",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        }}
                      >
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{q.text}</span>
                        <Send size={13} color={FIRE2} />
                      </button>
                    ))
                  ) : null}
                </div>

                {/* Custom question */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={customQuestion}
                    onChange={e => setCustomQuestion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && customQuestion.trim())
                        emit("hotseat:pick-question", { customText: customQuestion.trim() }, () => setCustomQuestion(""));
                    }}
                    placeholder={ar ? "+ اكتب سؤالاً مخصصاً" : "+ Custom question"}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 12,
                      background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.15)",
                      color: "#fff", fontSize: 12, outline: "none",
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customQuestion.trim())
                        emit("hotseat:pick-question", { customText: customQuestion.trim() }, () => setCustomQuestion(""));
                    }}
                    style={{
                      padding: "10px 14px", borderRadius: 12, border: "none",
                      background: customQuestion.trim() ? `linear-gradient(135deg, ${FIRE}, ${FIRE2})` : "rgba(255,255,255,0.1)",
                      color: customQuestion.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                      cursor: customQuestion.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>}
            </div>
          </div>
        )}

        {/* ── ANSWERING ───────────────────────────────────── */}
        {(phase === "answering" || phase === "voting") && seatStudent && (
          <div style={{ maxWidth: 600, marginInline: "auto" }}>
            <motion.div
              animate={phase === "answering" ? { boxShadow: [`0 0 20px rgba(255,107,43,0.4)`, `0 0 60px rgba(255,107,43,0.8)`, `0 0 20px rgba(255,107,43,0.4)`] } : undefined}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{
                background: `linear-gradient(135deg, rgba(255,107,43,0.2), rgba(255,159,67,0.1))`,
                border: `1px solid rgba(255,107,43,0.6)`, borderRadius: 24, padding: 24, textAlign: "center", marginBottom: 16, backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 44 }}>{seatStudent.avatar}</span>
                <div style={{ textAlign: "start" }}>
                  <p style={{ color: "#fff", fontWeight: 900, fontSize: 22, margin: 0 }}>{seatStudent.name}</p>
                  <p style={{ color: FIRE2, fontSize: 13, margin: 0, fontWeight: 700 }}>
                    {phase === "answering" ? (ar ? "يجيب الآن..." : "Answering now...") : (ar ? "انتهى الوقت" : "Time's up")}
                  </p>
                </div>
                {phase === "answering" && <HotSeatIcon size={24} />}
              </div>

              <div style={{
                background: "rgba(0,0,0,0.4)", borderRadius: 16, padding: "20px 24px",
                marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
                  "{currentQuestion}"
                </p>
              </div>

              {phase === "answering" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <CircleTimer val={timerVal} max={timerDuration} size={150} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => emit("hotseat:show-result", {})}
                      style={{
                        padding: "10px 18px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s"
                      }}
                      className="hover:bg-white/20"
                    >
                      <SkipForward size={15} /> {ar ? "انتهى — للتصويت" : "Done — Vote"}
                    </button>
                  </div>
                </div>
              )}

              {phase === "voting" && (
                <div>
                  <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: 800, marginBottom: 16 }}>
                    {ar ? `التصويت: ${votesCast} / ${totalVoters}` : `Votes: ${votesCast} / ${totalVoters}`}
                  </p>
                  <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 16 }}>
                    <div style={{ textAlign: "center", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", padding: "16px 24px", borderRadius: 20 }}>
                      <div style={{ color: "#22c55e", marginBottom: 8, display: "flex", justifyContent: "center" }}><ThumbsUp size={36} /></div>
                      <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 32 }}>{votes.yes}</div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{ar ? "مقنعة" : "Convincing"}</div>
                    </div>
                    <div style={{ textAlign: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "16px 24px", borderRadius: 20 }}>
                      <div style={{ color: "#ef4444", marginBottom: 8, display: "flex", justifyContent: "center" }}><ThumbsDown size={36} /></div>
                      <div style={{ color: "#ef4444", fontWeight: 900, fontSize: 32 }}>{votes.no}</div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{ar ? "غير مقنعة" : "Not convincing"}</div>
                    </div>
                  </div>
                  {/* Vote bar */}
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 20 }}>
                    <motion.div
                      animate={{ width: `${votesCast > 0 ? Math.round((votes.yes / votesCast) * 100) : 0}%` }}
                      style={{ height: "100%", background: "#22c55e", borderRadius: 999 }}
                    />
                  </div>
                  <button
                    onClick={() => emit("hotseat:show-result", {})}
                    style={{
                      padding: "14px 28px", borderRadius: 16, border: "none",
                      background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                      color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, marginInline: "auto", transition: "all 0.2s"
                    }}
                    className="hover:scale-[1.02]"
                  >
                    <Trophy size={20} /> {ar ? "عرض النتيجة" : "Show Result"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ── RESULT ──────────────────────────────────────── */}
        {phase === "result" && seatStudent && lastResult && (
          <div style={{ maxWidth: 560, marginInline: "auto" }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: "rgba(255,255,255,0.04)", border: `1px solid ${lastResult.convincingPct > 60 ? "#22c55e" : lastResult.convincingPct >= 40 ? GOLD : "#ef4444"}`,
                borderRadius: 24, padding: "32px 24px", textAlign: "center", marginBottom: 16, backdropFilter: "blur(12px)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                {lastResult.convincingPct > 60 ? <div className="p-4 rounded-full bg-green-500/20 text-green-500"><ThumbsUp size={48} /></div>
                  : lastResult.convincingPct >= 40 ? <div className="p-4 rounded-full bg-amber-500/20 text-amber-500"><Meh size={48} /></div>
                  : <div className="p-4 rounded-full bg-red-500/20 text-red-500"><ThumbsDown size={48} /></div>}
              </div>
              <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>
                {lastResult.convincingPct > 60 ? (ar ? "إجابة مقنعة!" : "Convincing!")
                  : lastResult.convincingPct >= 40 ? (ar ? "إجابة محايدة" : "Neutral")
                  : (ar ? "غير مقنع للأغلبية" : "Not very convincing")}
              </h2>
              <div style={{ display: "flex", gap: 24, justifyContent: "center", margin: "20px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: lastResult.convincingPct > 60 ? "#22c55e" : lastResult.convincingPct >= 40 ? GOLD : "#ef4444", fontWeight: 900, fontSize: 40, margin: 0 }}>
                    {lastResult.convincingPct}%
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, margin: 0 }}>{ar ? "نسبة الإقناع" : "Convincing rate"}</p>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: FIRE2, fontWeight: 900, fontSize: 40, margin: 0 }}>+{lastResult.pointsAwarded}</p>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {ar ? "نقطة لـ " : "pts for "}{seatStudent.name}
                  </p>
                </div>
              </div>
              {lastResult.speedBonus && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,107,43,0.15)", padding: "6px 12px", borderRadius: 12, marginTop: 8 }}>
                  <Sparkles size={16} color={FIRE} />
                  <span style={{ color: FIRE, fontSize: 13, fontWeight: 800 }}>
                    {ar ? "مكافأة السرعة!" : "Speed bonus!"}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button
                  onClick={() => emit("hotseat:next-round", {})}
                  style={{
                    flex: 1, padding: "16px", borderRadius: 16, border: "none",
                    background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                    color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
                  }}
                  className="hover:scale-[1.02]"
                >
                  <SkipForward size={18} /> {ar ? "جولة جديدة" : "Next Round"}
                </button>
              </div>
            </motion.div>

            {/* Leaderboard */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
              {sortedStudents.map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
                  borderBottom: i < sortedStudents.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: s.uid === currentSeatUid ? `rgba(255,107,43,0.15)` : undefined,
                }}>
                  <span style={{ color: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#b45309" : "rgba(255,255,255,0.3)", fontWeight: 900, fontSize: 16, width: 28, display: "flex", justifyContent: "center" }}>
                    {i < 3 ? <Medal size={20} /> : i + 1}
                  </span>
                  <span style={{ fontSize: 24 }}>{s.avatar}</span>
                  <span style={{ flex: 1, color: "#fff", fontWeight: 800, fontSize: 15 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 16 }}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ENDED ───────────────────────────────────────── */}
        {phase === "ended" && (
          <div style={{ maxWidth: 560, marginInline: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "inline-flex", padding: "20px", borderRadius: "50%", background: "rgba(217, 165, 33, 0.15)", marginBottom: 16 }}>
                <Trophy size={64} color={GOLD} />
              </div>
              <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>
                {ar ? "انتهت الجلسة!" : "Session Complete!"}
              </h1>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: 700 }}>
                {state.grade} · {state.subject} · {state.rounds} {ar ? "جولات" : "rounds"}
              </p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
              {sortedStudents.map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                  borderBottom: i < sortedStudents.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: i === 0 ? `rgba(217, 165, 33, 0.15)` : undefined,
                }}>
                  <span style={{ color: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#b45309" : "rgba(255,255,255,0.3)", fontWeight: 900, fontSize: 20, width: 36, display: "flex", justifyContent: "center" }}>
                    {i < 3 ? <Medal size={24} /> : i + 1}
                  </span>
                  <span style={{ fontSize: 32 }}>{s.avatar}</span>
                  <span style={{ flex: 1, color: "#fff", fontWeight: 800, fontSize: 18 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 22 }}>{s.score}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/game/hotseat/create")}
              style={{
                width: "100%", padding: "16px", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
              }}
              className="hover:scale-[1.02]"
            >
              <HotSeatIcon size={20} /> {ar ? "جلسة جديدة" : "New Session"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, ar, onPick }: { q: Question; ar: boolean; onPick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderRadius: 16,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ color: "#fff", fontSize: 14, fontWeight: 800, margin: 0, lineHeight: 1.4 }}>{q.text}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
          {q.authorName && (
            <span style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              <User size={12} /> {q.authorName}
            </span>
          )}
          {q.likes > 0 && (
            <span style={{ color: FIRE2, fontSize: 11, display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
              <ThumbsUp size={12} /> {q.likes}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onPick}
        style={{
          padding: "8px 16px", borderRadius: 12, border: "none",
          background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
          color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s"
        }}
        className="hover:scale-105"
      >
        <Send size={14} /> {ar ? "اختر" : "Pick"}
      </button>
    </motion.div>
  );
}
