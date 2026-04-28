import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ThumbsUp, ThumbsDown, Send, Flame, Users, SkipForward, XCircle, Copy, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket } from "@/lib/hotseat-socket";
import { toast } from "@/components/ui/sonner";

const FIRE = "#FF6B2B";
const FIRE2 = "#FF9F43";
const GOLD = "#D9A521";
const DARK_BG = "linear-gradient(180deg, #050818 0%, #0d1230 50%, #1a0800 100%)";

type Phase = "lobby"|"picking"|"asking"|"answering"|"voting"|"result"|"ended";

interface Student { uid: string; name: string; avatar: string; color: string; score: number; isOnSeat: boolean; roundsOnSeat: number; }
interface Question { id: string; text: string; isPreset: boolean; likes: number; }
interface GameState {
  pin: string; phase: Phase; teacherName: string; grade: string; subject: string; topic?: string;
  timerDuration: number; timerVal: number; currentSeatUid?: string; currentQuestion?: string;
  votes: { yes: number; no: number }; rounds: number;
  students: Student[]; questions: Question[];
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

const PRESET_QUESTIONS_AR = [
  "اشرح الفكرة بكلامك أنت",
  "ما أصعب جزء في هذا الموضوع؟",
  "كيف تطبق هذا في الحياة الواقعية؟",
  "ما الفرق بين... و...؟",
  "هل يمكنك إعطاء مثال آخر؟",
  "ماذا سيحدث لو...؟",
];

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
      socket.emit("hotseat:reclaim", { pin, creatorToken: token }, (res: { success?: boolean; state?: GameState; error?: string }) => {
        if (res.error) { toast.error(res.error); return; }
        if (res.state) { setState(res.state); stateRef.current = res.state; setTimerVal(res.state.timerVal); }
      });
    };

    if (socket.connected) reclaim(); else socket.once("connect", reclaim);

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
    socket.on("hotseat:timer-tick", (data: { timerVal: number }) => {
      setTimerVal(data.timerVal);
    });
    socket.on("hotseat:vote-update", (data: { votes: { yes: number; no: number } }) => {
      setState(prev => prev ? { ...prev, votes: data.votes } : prev);
    });

    return () => {
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
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ fontSize: 48 }}>🔥</motion.div>
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
        ? `🔥 الكرسي الساخن\n📍 ${state.grade} · ${state.subject}${state.topic ? ` · ${state.topic}` : ""}\n\n🔢 رمز الدخول: ${state.pin}\n🔗 ${joinUrl}`
        : `🔥 HotSeat Game\n📍 ${state.grade} · ${state.subject}\n\n🔢 Code: ${state.pin}\n🔗 ${joinUrl}`;
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
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <span style={{ fontSize: 52 }}>🔥</span>
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
            background: "rgba(0,0,0,0.5)", border: `2px solid ${FIRE}60`,
            borderRadius: 24, padding: "20px 16px", marginBottom: 14,
          }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800, textAlign: "center", letterSpacing: "0.15em", margin: "0 0 12px" }}>
              {ar ? "🔢 شارك هذا الرمز مع طلابك" : "🔢 Share this code with students"}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14, direction: "ltr" }}>
              {pinDigits.map((d, i) => (
                <div key={i} style={{
                  width: 50, height: 62,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${FIRE}25`, border: `2px solid ${FIRE}70`,
                  borderRadius: 12, fontSize: 38, fontWeight: 900, color: "#fff", fontFamily: "monospace",
                }}>{d}</div>
              ))}
            </div>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, textAlign: "center", margin: "0 0 12px", direction: "ltr", wordBreak: "break-all" }}>
              {joinUrl}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(joinUrl); toast.success(ar ? "تم النسخ!" : "Copied!"); } catch { toast.error("Error"); }
                }}
                style={{
                  padding: "10px", borderRadius: 12, border: "none",
                  background: "rgba(255,255,255,0.1)", color: "#fff",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Copy size={15} /> {ar ? "نسخ الرابط" : "Copy Link"}
              </button>
              <button
                onClick={shareWhatsApp}
                style={{
                  padding: "10px", borderRadius: 12, border: "1px solid rgba(37,211,102,0.3)",
                  background: "rgba(37,211,102,0.15)", color: "#25D366",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                📱 {ar ? "واتساب" : "WhatsApp"}
              </button>
            </div>
          </div>

          {/* Students */}
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={15} color={FIRE} />
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700 }}>
                {ar ? "الطلاب المنضمون" : "Students"}
              </span>
              <span style={{
                marginInlineStart: "auto",
                background: `${FIRE}30`, border: `1px solid ${FIRE}50`,
                color: FIRE2, fontWeight: 900, fontSize: 15, padding: "2px 12px", borderRadius: 999,
              }}>{students.length}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, minHeight: 36 }}>
              <AnimatePresence>
                {students.map(s => (
                  <motion.div key={s.uid} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 999,
                      background: "rgba(255,255,255,0.07)", border: `1.5px solid ${s.color}50`,
                    }}>
                    <span style={{ fontSize: 16 }}>{s.avatar}</span>
                    <span style={{ color: s.color, fontSize: 12, fontWeight: 800 }}>{s.name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {students.length === 0 && (
                <motion.p animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0, fontStyle: "italic" }}>
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
              width: "100%", padding: "16px", borderRadius: 18, border: "none",
              background: students.length === 0
                ? "rgba(255,107,43,0.2)"
                : `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              color: students.length === 0 ? "rgba(255,255,255,0.4)" : "#fff",
              fontWeight: 900, fontSize: 17, cursor: students.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: students.length > 0 ? `0 12px 36px ${FIRE}50` : undefined,
            }}
          >
            <Flame size={22} />
            {ar ? "ابدأ الجلسة 🔥" : "Start Session 🔥"}
            {students.length > 0 && (
              <span style={{ background: "rgba(0,0,0,0.25)", borderRadius: 999, padding: "2px 10px", fontSize: 13 }}>
                {students.length} {ar ? "طالب" : "students"}
              </span>
            )}
          </button>
          {students.length < 1 && (
            <p style={{ color: "rgba(255,107,43,0.6)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
              {ar ? "انتظر حتى ينضم طالب واحد على الأقل" : "At least 1 student must join first"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
      {/* Ambient fire glow */}
      <div style={{ position: "fixed", bottom: -100, left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300, background: `radial-gradient(ellipse, ${FIRE}20 0%, transparent 70%)`,
        pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{
        position: "relative", zIndex: 20, padding: "10px 16px",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,107,43,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <div>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 14, margin: 0 }}>
              {ar ? "الكرسي الساخن" : "HotSeat"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: 0 }}>
              {state.grade} · {state.subject}{state.topic && ` · ${state.topic}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            padding: "5px 14px", borderRadius: 999,
            background: `${FIRE}25`, border: `1px solid ${FIRE}50`,
            color: FIRE2, fontWeight: 800, fontSize: 13, fontFamily: "monospace",
          }}>
            {state.pin}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={14} /> {students.length}
          </div>
          <button onClick={toggleMute} style={{
            padding: "6px 10px", borderRadius: 10,
            border: `1px solid ${muted ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.15)"}`,
            background: muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
            color: muted ? "#ef4444" : "rgba(255,255,255,0.7)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12,
          }}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={() => {
              if (!confirm(ar ? "إنهاء الجلسة نهائياً؟" : "End session permanently?")) return;
              setEnding(true);
              emit("hotseat:end", {}, () => {});
            }}
            style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.4)",
              background: "rgba(220,38,38,0.15)", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {ending ? "..." : (ar ? "إنهاء" : "End")}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, padding: "16px" }}>

        {/* ── PICKING ─────────────────────────────────────── */}
        {phase === "picking" && (
          <div>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 900, textAlign: "center", margin: "0 0 6px" }}>
              {ar ? "🪑 اختر من يجلس على الكرسي" : "🪑 Pick the Hot Seat student"}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", margin: "0 0 20px" }}>
              {ar ? `الجولة ${state.rounds + 1}` : `Round ${state.rounds + 1}`}
            </p>

            {/* Leaderboard mini */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
              {sortedStudents.slice(0, 5).map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "8px 12px", borderRadius: 14,
                  background: "rgba(255,255,255,0.06)", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 20 }}>{s.avatar}</span>
                  <span style={{ color: s.color, fontWeight: 800, fontSize: 11 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 13 }}>{s.score}</span>
                  {i === 0 && <span style={{ fontSize: 14 }}>🥇</span>}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {students.map(s => (
                <motion.button
                  key={s.uid}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => emit("hotseat:pick-seat", { uid: s.uid })}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "18px 12px", borderRadius: 20,
                    background: "rgba(255,255,255,0.06)",
                    border: `2px solid ${s.color}50`,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 36 }}>{s.avatar}</span>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 700, fontSize: 12 }}>
                    {s.score} {ar ? "نق" : "pts"}
                  </span>
                  {s.roundsOnSeat > 0 && (
                    <span style={{ color: FIRE, fontSize: 11 }}>
                      🔥×{s.roundsOnSeat}
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
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "12px 24px", borderRadius: 999,
                  background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                  boxShadow: `0 8px 24px ${FIRE}60`,
                }}
              >
                <span style={{ fontSize: 28 }}>{seatStudent.avatar}</span>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>
                  {seatStudent.name} 🔥
                </span>
              </motion.div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: "8px 0 0" }}>
                {ar ? "الطلاب يرسلون أسئلة مجهولة..." : "Students are sending anonymous questions..."}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Student questions */}
              <div>
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
              </div>

              {/* Preset / custom */}
              <div>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  {ar ? "أسئلة جاهزة" : "Ready Questions"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {PRESET_QUESTIONS_AR.map((text, i) => (
                    <button
                      key={i}
                      onClick={() => emit("hotseat:pick-question", { customText: text })}
                      style={{
                        padding: "10px 14px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "start",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      }}
                    >
                      <span>{text}</span>
                      <Flame size={13} color={FIRE} />
                    </button>
                  ))}
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
                      background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                      color: "#fff", cursor: "pointer",
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANSWERING ───────────────────────────────────── */}
        {(phase === "answering" || phase === "voting") && seatStudent && (
          <div style={{ maxWidth: 600, marginInline: "auto" }}>
            <motion.div
              animate={phase === "answering" ? { boxShadow: [`0 0 20px ${FIRE}40`, `0 0 60px ${FIRE}80`, `0 0 20px ${FIRE}40`] } : undefined}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{
                background: `linear-gradient(135deg, ${FIRE}20, ${FIRE2}10)`,
                border: `2px solid ${FIRE}60`, borderRadius: 24, padding: 24, textAlign: "center", marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 36 }}>{seatStudent.avatar}</span>
                <div>
                  <p style={{ color: "#fff", fontWeight: 900, fontSize: 18, margin: 0 }}>{seatStudent.name}</p>
                  <p style={{ color: FIRE2, fontSize: 12, margin: 0 }}>
                    {phase === "answering" ? (ar ? "يجيب الآن..." : "Answering now...") : (ar ? "انتهى الوقت" : "Time's up")}
                  </p>
                </div>
              </div>

              <div style={{
                background: "rgba(0,0,0,0.3)", borderRadius: 16, padding: "16px 18px",
                marginBottom: 16, border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
                  "{currentQuestion}"
                </p>
              </div>

              {phase === "answering" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <CircleTimer val={timerVal} max={timerDuration} size={150} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => emit("hotseat:show-result", {})}
                      style={{
                        padding: "10px 18px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <SkipForward size={15} /> {ar ? "انتهى — للتصويت" : "Done — Vote"}
                    </button>
                  </div>
                </div>
              )}

              {phase === "voting" && (
                <div>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    {ar ? `التصويت: ${votesCast} / ${totalVoters}` : `Votes: ${votesCast} / ${totalVoters}`}
                  </p>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 14 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36 }}>👍</div>
                      <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 28 }}>{votes.yes}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{ar ? "مقنعة" : "Convincing"}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36 }}>👎</div>
                      <div style={{ color: "#ef4444", fontWeight: 900, fontSize: 28 }}>{votes.no}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{ar ? "غير مقنعة" : "Not convincing"}</div>
                    </div>
                  </div>
                  {/* Vote bar */}
                  <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 14 }}>
                    <motion.div
                      animate={{ width: `${votesCast > 0 ? Math.round((votes.yes / votesCast) * 100) : 0}%` }}
                      style={{ height: "100%", background: "#22c55e", borderRadius: 999 }}
                    />
                  </div>
                  <button
                    onClick={() => emit("hotseat:show-result", {})}
                    style={{
                      padding: "12px 28px", borderRadius: 14, border: "none",
                      background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                      color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, marginInline: "auto",
                    }}
                  >
                    <Trophy size={18} /> {ar ? "عرض النتيجة" : "Show Result"}
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
                background: "rgba(255,255,255,0.06)", border: `2px solid ${GOLD}`,
                borderRadius: 24, padding: 28, textAlign: "center", marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 8 }}>
                {lastResult.convincingPct > 60 ? "🎉" : lastResult.convincingPct >= 40 ? "😐" : "😬"}
              </div>
              <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 900, margin: "0 0 4px" }}>
                {lastResult.convincingPct > 60 ? (ar ? "إجابة مقنعة! 🔥" : "Convincing! 🔥")
                  : lastResult.convincingPct >= 40 ? (ar ? "إجابة محايدة" : "Neutral")
                  : (ar ? "غير مقنع للأغلبية" : "Not very convincing")}
              </h2>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "12px 0" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: GOLD, fontWeight: 900, fontSize: 36, margin: 0 }}>{lastResult.convincingPct}%</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>{ar ? "مقنعة" : "Convincing"}</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: FIRE2, fontWeight: 900, fontSize: 36, margin: 0 }}>+{lastResult.pointsAwarded}</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>
                    {ar ? "نقطة لـ " : "pts for "}{seatStudent.name}
                    {lastResult.speedBonus && " ⚡"}
                  </p>
                </div>
              </div>
              {lastResult.speedBonus && (
                <p style={{ color: FIRE, fontSize: 13, fontWeight: 700 }}>
                  ⚡ {ar ? "مكافأة السرعة!" : "Speed bonus!"}
                </p>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => emit("hotseat:next-round", {})}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                    color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <Flame size={18} /> {ar ? "جولة جديدة" : "Next Round"}
                </button>
              </div>
            </motion.div>

            {/* Leaderboard */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 18, overflow: "hidden" }}>
              {sortedStudents.map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                  borderBottom: i < sortedStudents.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: s.uid === currentSeatUid ? `${FIRE}15` : undefined,
                }}>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 14, width: 24 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span style={{ fontSize: 20 }}>{s.avatar}</span>
                  <span style={{ flex: 1, color: "#fff", fontWeight: 700, fontSize: 14 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 16 }}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ENDED ───────────────────────────────────────── */}
        {phase === "ended" && (
          <div style={{ maxWidth: 560, marginInline: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 60, marginBottom: 8 }}>🏆</div>
              <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 4px" }}>
                {ar ? "انتهت الجلسة!" : "Session Complete!"}
              </h1>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                {state.grade} · {state.subject} · {state.rounds} {ar ? "جولات" : "rounds"}
              </p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
              {sortedStudents.map((s, i) => (
                <div key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
                  borderBottom: i < sortedStudents.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: i === 0 ? `${GOLD}15` : undefined,
                }}>
                  <span style={{ fontSize: 20, width: 32 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span style={{ fontSize: 28 }}>{s.avatar}</span>
                  <span style={{ flex: 1, color: "#fff", fontWeight: 800, fontSize: 16 }}>{s.name}</span>
                  <span style={{ color: GOLD, fontWeight: 900, fontSize: 20 }}>{s.score}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation("/game/hotseat/create")}
              style={{
                width: "100%", padding: "14px", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
              }}
            >
              {ar ? "🔥 جلسة جديدة" : "🔥 New Session"}
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
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 14,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0 }}>{q.text}</p>
        {q.likes > 0 && (
          <p style={{ color: FIRE2, fontSize: 11, margin: "2px 0 0" }}>
            👍 {q.likes}
          </p>
        )}
      </div>
      <button
        onClick={onPick}
        style={{
          padding: "7px 12px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
          color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {ar ? "🔥 اختر" : "🔥 Pick"}
      </button>
    </motion.div>
  );
}
