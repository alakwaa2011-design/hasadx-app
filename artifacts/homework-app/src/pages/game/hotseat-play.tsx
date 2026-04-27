import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getHotSeatSocket, disconnectHotSeatSocket } from "@/lib/hotseat-socket";
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

// ── Sound Engine ─────────────────────────────────────────────────────────────
function createAudioCtx() {
  try { return new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
}

function playTone(ctx: AudioContext, freq: number, dur: number, vol = 0.3, type: OscillatorType = "sine") {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* ignore */ }
}

function playVoteSound(ctx: AudioContext) {
  playTone(ctx, 880, 0.15, 0.3); 
  setTimeout(() => playTone(ctx, 1100, 0.15, 0.3), 100);
}

function playCorrectSound(ctx: AudioContext) {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(ctx, f, 0.2, 0.4), i * 80));
}

function playTimerBeep(ctx: AudioContext, urgent: boolean) {
  playTone(ctx, urgent ? 880 : 660, 0.1, urgent ? 0.5 : 0.25);
}

function playVictoryFanfare(ctx: AudioContext) {
  const notes = [523, 659, 784, 880, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => {
      playTone(ctx, f, 0.35, 0.6, "triangle");
      playTone(ctx, f * 1.5, 0.2, 0.3, "sine");
    }, i * 120);
  });
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: [FIRE, FIRE2, GOLD, "#22c55e", "#3b82f6", "#ec4899"][Math.floor(Math.random() * 6)],
    delay: Math.random() * 2,
    dur: 2 + Math.random() * 3,
    size: 6 + Math.random() * 10,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100 }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1 }}
          animate={{ y: "110vh", opacity: 0, rotate: 360 * 3 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "fixed", top: 0,
            width: p.size, height: p.size,
            background: p.color, borderRadius: Math.random() > 0.5 ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}

// ── Fire Seat Card ────────────────────────────────────────────────────────────
function HotSeatCard({ student }: { student: Student }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Animated fire ring */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.08 + i * 0.04, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5 + i * 0.3, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: -(12 + i * 8),
            borderRadius: "50%",
            border: `3px solid ${i % 2 === 0 ? FIRE : FIRE2}`,
            opacity: 0.5,
          }}
        />
      ))}
      <motion.div
        animate={{ y: [-2, 2, -2] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        style={{
          width: 96, height: 96, borderRadius: "50%",
          background: `radial-gradient(circle, ${FIRE2}30, ${FIRE}50)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 52, border: `3px solid ${FIRE}`,
          boxShadow: `0 0 40px ${FIRE}80, 0 0 80px ${FIRE}40`,
          position: "relative", zIndex: 2,
        }}
      >
        {student.avatar}
      </motion.div>
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function CircleTimer({ val, max, size = 100 }: { val: number; max: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, val / max);
  const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? FIRE2 : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transition={{ duration: 0.6 }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x={size/2} y={size/2}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
        fill={color} fontSize={size * 0.3} fontWeight={900} fontFamily="monospace">
        {val}
      </text>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HotSeatPlay() {
  const { pin } = useParams<{ pin: string }>();
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  const myName = sp.get("name") || "";
  const myAvatar = sp.get("avatar") || "😀";
  const myUid = sp.get("uid") || "";

  const [state, setState] = useState<GameState | null>(null);
  const [timerVal, setTimerVal] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [questionText, setQuestionText] = useState("");
  const [questionSent, setQuestionSent] = useState(false);
  const [myVote, setMyVote] = useState<"yes" | "no" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPointsPopup, setShowPointsPopup] = useState<number | null>(null);
  const [likedQuestions, setLikedQuestions] = useState<Set<string>>(new Set());

  const audioCtx = useRef<AudioContext | null>(null);
  const muted = useRef(false);

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (muted.current) return;
    if (!audioCtx.current) audioCtx.current = createAudioCtx();
    const ctx = audioCtx.current;
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().then(() => fn(ctx));
      else fn(ctx);
    }
  }, []);

  const amOnSeat = state?.currentSeatUid === myUid;

  useEffect(() => {
    if (!pin || !myName) {
      setLocation(`/game/hotseat/join/${pin || ""}`);
      return;
    }
    const socket = getHotSeatSocket();

    const doJoin = () => {
      socket.emit("hotseat:join", { pin, name: myName, avatar: myAvatar }, (res: {
        success?: boolean; uid?: string; color?: string; state?: GameState; error?: string;
      }) => {
        if (res.error) { toast.error(res.error); setLocation("/game/hotseat/join"); return; }
        if (res.state) {
          setState(res.state);
          setTimerVal(res.state.timerVal);
          const me = res.state.students.find(s => s.uid === myUid || s.name === myName);
          if (me) setMyScore(me.score);
        }
      });
    };

    if (socket.connected) doJoin(); else socket.once("connect", doJoin);

    socket.on("hotseat:phase-change", (data: { phase: Phase; state: GameState }) => {
      setState(data.state);
      setTimerVal(data.state.timerVal);
      setMyVote(null);
      setQuestionSent(false);
      setQuestionText("");
      const me = data.state.students.find(s => s.uid === myUid || s.name === myName);
      if (me) setMyScore(me.score);

      if (data.phase === "ended") {
        play(playVictoryFanfare);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
    });

    socket.on("hotseat:players-updated", (data: { students: Student[] }) => {
      setState(prev => {
        if (!prev) return prev;
        const me = data.students.find(s => s.uid === myUid || s.name === myName);
        if (me) {
          if (me.score > myScore) {
            const diff = me.score - myScore;
            setShowPointsPopup(diff);
            setTimeout(() => setShowPointsPopup(null), 2000);
            play(playCorrectSound);
          }
          setMyScore(me.score);
        }
        return { ...prev, students: data.students };
      });
    });

    socket.on("hotseat:questions-updated", (data: { questions: Question[] }) => {
      setState(prev => prev ? { ...prev, questions: data.questions } : prev);
    });

    socket.on("hotseat:timer-tick", (data: { timerVal: number }) => {
      setTimerVal(data.timerVal);
      if (data.timerVal <= 5 && data.timerVal > 0) play(ctx => playTimerBeep(ctx, data.timerVal <= 3));
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
  }, [pin, myName, myAvatar, myUid, ar, setLocation, play, myScore]);

  const emit = (event: string, data: object, cb?: (r: { error?: string }) => void) => {
    const socket = getHotSeatSocket();
    socket.emit(event, { pin, ...data }, cb || ((r: { error?: string }) => {
      if (r.error) toast.error(r.error);
    }));
  };

  const sendQuestion = () => {
    const txt = questionText.trim();
    if (!txt) return;
    emit("hotseat:send-question", { text: txt }, (r) => {
      if (r.error) { toast.error(r.error); return; }
      setQuestionSent(true);
      setQuestionText("");
      play(playVoteSound);
      toast.success(ar ? "تم إرسال سؤالك! 🎯" : "Question sent! 🎯");
    });
  };

  const vote = (v: "yes" | "no") => {
    if (myVote) return;
    emit("hotseat:vote", { vote: v }, (r) => {
      if (r.error) { toast.error(r.error); return; }
      setMyVote(v);
      play(playVoteSound);
    });
  };

  const likeQuestion = (qId: string) => {
    emit("hotseat:like-question", { questionId: qId }, (r) => {
      if (r.error) return;
      setLikedQuestions(prev => {
        const next = new Set(prev);
        if (next.has(qId)) next.delete(qId); else next.add(qId);
        return next;
      });
    });
  };

  if (!state) {
    return (
      <div style={{ minHeight: "100dvh", background: DARK_BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <span style={{ fontSize: 56 }}>🔥</span>
        </motion.div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          {ar ? "جاري الاتصال..." : "Connecting..."}
        </p>
      </div>
    );
  }

  const { phase, students, questions, votes, currentSeatUid, currentQuestion, timerDuration, lastResult } = state;
  const seatStudent = currentSeatUid ? students.find(s => s.uid === currentSeatUid) : null;
  const sortedStudents = [...students].sort((a, b) => b.score - a.score);
  const myRank = sortedStudents.findIndex(s => s.uid === myUid || s.name === myName) + 1;
  const totalVoters = students.filter(s => !s.isOnSeat).length;
  const votesCast = votes.yes + votes.no;

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: DARK_BG, position: "relative", overflow: "hidden" }}>
      {showConfetti && <Confetti />}

      {/* Points popup */}
      <AnimatePresence>
        {showPointsPopup !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: -40, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 200, background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
              borderRadius: 20, padding: "12px 24px", pointerEvents: "none",
            }}
          >
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 24, margin: 0 }}>
              +{showPointsPopup} {ar ? "نقطة!" : "pts!"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        padding: "8px 14px",
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,107,43,0.2)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{myAvatar}</span>
          <div>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 13, margin: 0 }}>{myName}</p>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 11, margin: 0 }}>
              {myScore} {ar ? "نقطة" : "pts"} · #{myRank || "—"}
            </p>
          </div>
        </div>
        <div style={{
          padding: "4px 12px", borderRadius: 999,
          background: `${FIRE}20`, border: `1px solid ${FIRE}40`,
          color: FIRE2, fontWeight: 800, fontSize: 13, fontFamily: "monospace",
        }}>
          {pin}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          <span>👥</span> {students.length}
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 500, marginInline: "auto" }}>

        {/* ── LOBBY / WAITING ─────────────────────────────── */}
        {(phase === "lobby" || phase === "picking") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", paddingTop: 40 }}>
            <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <span style={{ fontSize: 64 }}>⏳</span>
            </motion.div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "16px 0 8px" }}>
              {phase === "lobby"
                ? (ar ? "في انتظار المعلم..." : "Waiting for teacher...")
                : (ar ? "المعلم يختار من يجلس على الكرسي..." : "Teacher is picking the hot seat...")}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              {ar ? `أنت: ${myAvatar} ${myName}` : `You: ${myAvatar} ${myName}`}
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              {ar ? `${students.length} طالب في الجلسة` : `${students.length} students in session`}
            </p>
            {/* Mini student grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {students.map(s => (
                <div key={s.uid} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                  borderRadius: 999, background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${s.color}40`, fontSize: 13,
                }}>
                  <span>{s.avatar}</span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ON THE SEAT (you are chosen) ────────────────── */}
        {phase === "asking" && amOnSeat && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ textAlign: "center", paddingTop: 20 }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{
                display: "inline-block", marginBottom: 20,
                background: `linear-gradient(135deg, #1a0800, #2d0f00)`,
                borderRadius: 24, padding: "20px 30px",
                border: `2px solid ${FIRE}`,
                boxShadow: `0 0 60px ${FIRE}60`,
              }}
            >
              <div style={{ fontSize: 16, color: FIRE, fontWeight: 900, marginBottom: 12 }}>
                🔥🔥 {ar ? "أنت على الكرسي الساخن!" : "You're on the Hot Seat!"} 🔥🔥
              </div>
              <HotSeatCard student={{ uid: myUid, name: myName, avatar: myAvatar, color: FIRE, score: myScore, isOnSeat: true, roundsOnSeat: 1 }} />
            </motion.div>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
              {ar ? "زملاؤك يرسلون أسئلة الآن..." : "Your classmates are sending questions..."}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              {ar ? "المعلم سيختار أفضل سؤال ليسألك إياه!" : "The teacher will pick the best question!"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 20 }}>
              {[...Array(3)].map((_, i) => (
                <motion.p
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.5 }}
                  style={{ color: FIRE2, fontSize: 24, margin: 0 }}
                >
                  🔥
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ASKING (not on seat) — send question ──────── */}
        {phase === "asking" && !amOnSeat && seatStudent && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {/* Seat person banner */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, justifyContent: "center",
              padding: "14px 20px", borderRadius: 20, marginBottom: 20,
              background: `${FIRE}20`, border: `2px solid ${FIRE}50`,
            }}>
              <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ fontSize: 32 }}>
                {seatStudent.avatar}
              </motion.span>
              <div>
                <p style={{ color: FIRE, fontSize: 11, fontWeight: 700, margin: 0 }}>
                  {ar ? "🔥 على الكرسي" : "🔥 On the Seat"}
                </p>
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: 0 }}>
                  {seatStudent.name}
                </p>
              </div>
            </div>

            {/* Question input */}
            {!questionSent ? (
              <div style={{
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,107,43,0.25)", borderRadius: 20, padding: 20,
                marginBottom: 16,
              }}>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                  {ar ? "📩 أرسل سؤالاً مجهولاً:" : "📩 Send an anonymous question:"}
                </p>
                <textarea
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(); } }}
                  placeholder={ar ? "اكتب سؤالاً لـ " + seatStudent.name + "..." : `Ask ${seatStudent.name} something...`}
                  maxLength={200}
                  rows={3}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 14,
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: 14, outline: "none", resize: "none",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={sendQuestion}
                  disabled={!questionText.trim()}
                  style={{
                    marginTop: 10, width: "100%", padding: "12px",
                    borderRadius: 14, border: "none",
                    background: questionText.trim()
                      ? `linear-gradient(135deg, ${FIRE}, ${FIRE2})`
                      : "rgba(255,255,255,0.1)",
                    color: "#fff", fontWeight: 900, fontSize: 15, cursor: questionText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {ar ? "✈️ أرسل سؤالاً" : "✈️ Send Question"}
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                style={{
                  background: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.4)",
                  borderRadius: 20, padding: 20, textAlign: "center", marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 40 }}>✅</span>
                <p style={{ color: "#22c55e", fontWeight: 900, fontSize: 16, margin: "8px 0 0" }}>
                  {ar ? "تم إرسال سؤالك بنجاح!" : "Question sent!"}
                </p>
                <button
                  onClick={() => setQuestionSent(false)}
                  style={{
                    marginTop: 10, padding: "8px 20px", borderRadius: 12,
                    background: "rgba(255,255,255,0.1)", border: "none",
                    color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer",
                  }}
                >
                  {ar ? "أرسل سؤالاً آخر" : "Send another"}
                </button>
              </motion.div>
            )}

            {/* Suggested quick questions */}
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>
              {ar ? "أو اختر سؤالاً جاهزاً:" : "Or pick a ready question:"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ar ? "اشرح الفكرة بكلامك" : "Explain in your own words",
                ar ? "ما أصعب جزء في الدرس؟" : "What's the hardest part?",
                ar ? "كيف تطبقه في الحياة؟" : "How to apply it in life?",
              ].map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestionText(t); setQuestionSent(false); }}
                  style={{
                    padding: "10px 14px", borderRadius: 12,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", textAlign: "start" as const,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Questions with likes */}
            {questions.filter(q => !q.isPreset).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>
                  {ar ? "أسئلة مُرسلة — أعطِ إعجابك للأفضل:" : "Sent questions — like the best:"}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {questions.filter(q => !q.isPreset).map(q => (
                    <div key={q.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 12,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <p style={{ flex: 1, color: "#fff", fontSize: 13, margin: 0 }}>{q.text}</p>
                      <button
                        onClick={() => likeQuestion(q.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "5px 10px", borderRadius: 8, border: "none",
                          background: likedQuestions.has(q.id) ? `${FIRE}40` : "rgba(255,255,255,0.08)",
                          color: likedQuestions.has(q.id) ? FIRE2 : "rgba(255,255,255,0.6)",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        👍 {q.likes}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── ANSWERING — you are on seat ─────────────────── */}
        {phase === "answering" && amOnSeat && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ textAlign: "center" }}
          >
            <div style={{
              background: `linear-gradient(135deg, ${FIRE}30, ${FIRE2}15)`,
              border: `3px solid ${FIRE}`,
              borderRadius: 28, padding: "28px 24px",
              boxShadow: `0 0 80px ${FIRE}50`,
              marginBottom: 20,
            }}>
              <p style={{ color: FIRE2, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
                🔥🔥 {ar ? "الجميع يستمع!" : "Everyone is listening!"} 🔥🔥
              </p>
              <div style={{
                background: "rgba(0,0,0,0.4)", borderRadius: 18, padding: "16px 18px",
                marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: 0, lineHeight: 1.5 }}>
                  "{currentQuestion}"
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <CircleTimer val={timerVal} max={timerDuration} size={120} />
              </div>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                {ar ? "تحدّث بثقة وأقنعهم! 💪" : "Speak confidently and convince them! 💪"}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── ANSWERING — watching ─────────────────────────── */}
        {phase === "answering" && !amOnSeat && seatStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 12 }}>
              {ar ? "👂 استمع جيداً!" : "👂 Listen carefully!"}
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 14, justifyContent: "center",
              padding: "16px 20px", borderRadius: 20, marginBottom: 16,
              background: `${FIRE}15`, border: `2px solid ${FIRE}40`,
            }}>
              <span style={{ fontSize: 36 }}>{seatStudent.avatar}</span>
              <div style={{ textAlign: "start" }}>
                <p style={{ color: FIRE, fontSize: 11, fontWeight: 700, margin: 0 }}>{ar ? "يجيب الآن" : "Answering"}</p>
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, margin: 0 }}>{seatStudent.name}</p>
              </div>
            </div>
            <div style={{
              background: "rgba(0,0,0,0.3)", borderRadius: 18, padding: "16px 18px",
              marginBottom: 16, border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
                "{currentQuestion}"
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <CircleTimer val={timerVal} max={timerDuration} size={90} />
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              {ar ? "ستُسأل عن رأيك بعد قليل!" : "You'll vote soon!"}
            </p>
          </motion.div>
        )}

        {/* ── VOTING ────────────────────────────────────────── */}
        {phase === "voting" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {amOnSeat ? (
              <div style={{ textAlign: "center", paddingTop: 20 }}>
                <span style={{ fontSize: 56 }}>🗳️</span>
                <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 900, margin: "12px 0 6px" }}>
                  {ar ? "الجميع يصوّت الآن!" : "Everyone is voting!"}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                  {ar ? `${votesCast} / ${totalVoters} صوّتوا حتى الآن` : `${votesCast} / ${totalVoters} voted so far`}
                </p>
                {/* Live vote bar */}
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 16 }}>
                  <motion.div
                    animate={{ width: `${votesCast > 0 ? Math.round((votes.yes / votesCast) * 100) : 0}%` }}
                    style={{ height: "100%", background: "#22c55e", borderRadius: 999 }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginBottom: 14 }}>
                  {ar ? "🗳️ هل الإجابة مقنعة؟" : "🗳️ Was the answer convincing?"}
                </p>
                {seatStudent && (
                  <div style={{
                    background: "rgba(0,0,0,0.3)", borderRadius: 18, padding: "14px 18px",
                    marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "0 0 6px" }}>
                      {seatStudent.name} {ar ? "قال:" : "said:"}
                    </p>
                    <p style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.5 }}>
                      "{currentQuestion}"
                    </p>
                  </div>
                )}
                {!myVote ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => vote("yes")}
                      style={{
                        padding: "24px 16px", borderRadius: 20,
                        background: "linear-gradient(135deg, rgba(34,197,94,0.3), rgba(16,185,129,0.2))",
                        border: "2px solid rgba(34,197,94,0.5)",
                        cursor: "pointer", display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 8,
                      } as React.CSSProperties}
                    >
                      <span style={{ fontSize: 48 }}>👍</span>
                      <span style={{ color: "#22c55e", fontWeight: 900, fontSize: 16 }}>
                        {ar ? "مقنعة" : "Convincing"}
                      </span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => vote("no")}
                      style={{
                        padding: "24px 16px", borderRadius: 20,
                        background: "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(220,38,38,0.2))",
                        border: "2px solid rgba(239,68,68,0.5)",
                        cursor: "pointer", display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 8,
                      } as React.CSSProperties}
                    >
                      <span style={{ fontSize: 48 }}>👎</span>
                      <span style={{ color: "#ef4444", fontWeight: 900, fontSize: 16 }}>
                        {ar ? "غير مقنعة" : "Not convincing"}
                      </span>
                    </motion.button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    style={{
                      textAlign: "center", padding: "24px 20px", borderRadius: 20,
                      background: myVote === "yes" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      border: `2px solid ${myVote === "yes" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                    }}
                  >
                    <span style={{ fontSize: 48 }}>{myVote === "yes" ? "👍" : "👎"}</span>
                    <p style={{ color: "#fff", fontWeight: 900, fontSize: 16, margin: "8px 0 0" }}>
                      {ar ? "تم تصويتك!" : "Vote recorded!"}
                    </p>
                  </motion.div>
                )}

                {/* Live vote count */}
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                    {votesCast} / {totalVoters} {ar ? "صوّتوا" : "voted"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── RESULT ────────────────────────────────────────── */}
        {phase === "result" && seatStudent && lastResult && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ textAlign: "center" }}
          >
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: `2px solid ${lastResult.convincingPct > 60 ? "#22c55e" : FIRE}50`,
              borderRadius: 24, padding: "28px 20px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>
                {lastResult.convincingPct > 60 ? "🎉" : lastResult.convincingPct >= 40 ? "😐" : "😬"}
              </div>
              <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 6px" }}>
                {amOnSeat
                  ? (lastResult.convincingPct > 60
                    ? (ar ? "أقنعتهم! رائع 🏆" : "You convinced them! 🏆")
                    : lastResult.convincingPct >= 40
                    ? (ar ? "إجابة محايدة..." : "Neutral answer...")
                    : (ar ? "لم تقنع الأغلبية هذه المرة" : "Didn't convince most"))
                  : (lastResult.convincingPct > 60
                    ? (ar ? `أقنعكم ${seatStudent.name}! 🎉` : `${seatStudent.name} convinced you! 🎉`)
                    : (ar ? "لم يكن مقنعاً للأغلبية" : "Not very convincing"))}
              </h2>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, margin: "14px 0" }}>
                <div>
                  <p style={{ color: GOLD, fontWeight: 900, fontSize: 36, margin: 0 }}>{lastResult.convincingPct}%</p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>
                    {ar ? "مقنعة" : "Convincing"}
                  </p>
                </div>
                {amOnSeat && (
                  <div>
                    <p style={{ color: FIRE2, fontWeight: 900, fontSize: 36, margin: 0 }}>+{lastResult.pointsAwarded}</p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>{ar ? "نقطة" : "pts"}</p>
                  </div>
                )}
              </div>
              {lastResult.speedBonus && amOnSeat && (
                <p style={{ color: FIRE, fontSize: 14, fontWeight: 700 }}>⚡ {ar ? "مكافأة السرعة!" : "Speed bonus!"}</p>
              )}
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              {ar ? "انتظر المعلم للجولة التالية..." : "Waiting for teacher to start next round..."}
            </p>
          </motion.div>
        )}

        {/* ── ENDED ─────────────────────────────────────────── */}
        {phase === "ended" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
              <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 6px" }}>
                {ar ? "انتهت الجلسة!" : "Session Complete!"}
              </h1>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                {state.grade} · {state.subject}{state.topic && ` · ${state.topic}`}
              </p>
              {/* My result */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "12px 24px", borderRadius: 999, marginTop: 14,
                background: `${GOLD}20`, border: `2px solid ${GOLD}50`,
              }}>
                <span style={{ fontSize: 24 }}>{myAvatar}</span>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>{myName}</span>
                <span style={{ color: GOLD, fontWeight: 900, fontSize: 18 }}>{myScore} {ar ? "نق" : "pts"}</span>
                <span style={{ fontSize: 18 }}>
                  {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`}
                </span>
              </div>
            </div>

            {/* Full ranking */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
              {sortedStudents.map((s, i) => {
                const isMe = s.uid === myUid || s.name === myName;
                return (
                  <div key={s.uid} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: i < sortedStudents.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                    background: isMe ? `${GOLD}15` : i === 0 ? `${FIRE}10` : undefined,
                  }}>
                    <span style={{ fontSize: 18, width: 28 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <span style={{ fontSize: 26 }}>{s.avatar}</span>
                    <span style={{ flex: 1, color: "#fff", fontWeight: isMe ? 900 : 700, fontSize: 15 }}>
                      {s.name} {isMe && <span style={{ color: FIRE2, fontSize: 11 }}> ({ar ? "أنت" : "you"})</span>}
                    </span>
                    <span style={{ color: GOLD, fontWeight: 900, fontSize: 17 }}>{s.score}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { disconnectHotSeatSocket(); setLocation("/"); }}
              style={{
                width: "100%", padding: "14px", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg, ${FIRE}, ${FIRE2})`,
                color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
              }}
            >
              🏠 {ar ? "العودة للرئيسية" : "Go Home"}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
