// ─────────────────────────────────────────────────────────────────────────────
// Tug-of-war "Class Mode" (وضع الصف) — Broadcast Stadium layout.
//
// The screen reads like a live match broadcast: the arena is the HERO on top
// (full width, stadium lighting), and below it two "team dugouts" face the
// field, separated by a glowing centre corridor that leans toward whichever
// team currently controls the rope. Each dugout has its own colour identity,
// floor lighting, local effects and a fully independent question ROUTE:
// both teams play ALL the prepared questions, but each in its own random
// order (questionOrder), so they never open on the same question.
// No sockets, no server — everything runs locally on the class screen.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX } from "lucide-react";
import {
  TugSoundEngine, Confetti, PowerPullFlash, CountdownOverlay, TimerRing,
  StadiumBackdrop, TugCharacters, TugPowerMeter,
  WAMID_GRADIENT, WAMID_BORDER, type TugImpulse,
} from "@/components/game/tug-shared";
import {
  classReducer, createClassState, currentQuestion,
  type ClassQuestion, type ClassState, type TeamId, type TeamState,
} from "@/lib/tug-class-engine";

export const TUG_CLASS_SETUP_KEY = "tug-class-setup";

interface ClassSetup {
  questions: ClassQuestion[];
  duration: number;
  /** Activity/assignment title shown at the top of the match screen. */
  title?: string;
}

function readSetup(): ClassSetup | null {
  try {
    const raw = sessionStorage.getItem(TUG_CLASS_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClassSetup>;
    // 2+ questions ⇒ the half-rotation guarantees different opening questions.
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 2) return null;
    return {
      questions: parsed.questions,
      duration: parsed.duration || 20,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
    };
  } catch {
    return null;
  }
}

const TEAM_RGB: Record<TeamId, string> = { blue: "59,130,246", red: "239,68,68" };

// ─────────────────────────────────────────────────────────────────────────────
// Centre field — the WIDE middle ground between the two dugouts. It reads as
// the pitch itself: perspective floor lines converging toward the arena, a
// central light beam, and a big VS medallion. Its colour and intensity follow
// whoever controls the rope, so the field itself tells the match story.
// ─────────────────────────────────────────────────────────────────────────────
function CenterField({ rope, blueOnRight }: { rope: number; blueOnRight: boolean }) {
  // rope 0 = blue wall, 100 = red wall. Blend the field colour accordingly.
  const t = rope / 100;
  const r = Math.round(59 + (239 - 59) * t);
  const g = Math.round(130 + (68 - 130) * t);
  const b = Math.round(246 + (68 - 246) * t);
  const strength = Math.min(1, Math.abs(rope - 50) / 40); // 0 tied → 1 near a wall
  const leader: TeamId | null = rope < 48 ? "blue" : rope > 52 ? "red" : null;
  // Physical direction of each team's side on screen.
  const arrowFor = (team: TeamId) =>
    (team === "blue") === blueOnRight ? "▶" : "◀";

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-start overflow-hidden">
      {/* Pitch floor: perspective lines converging up toward the arena centre */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-45" preserveAspectRatio="none" viewBox="0 0 100 100">
        {[8, 24, 40, 60, 76, 92].map((x) => (
          <line key={x} x1={x} y1="100" x2={50 + (x - 50) * 0.25} y2="0"
            stroke={`rgba(${r},${g},${b},0.30)`} strokeWidth="0.5" />
        ))}
        {[26, 50, 74].map((y) => (
          <line key={y} x1={50 - 42 * (y / 100)} y1={y} x2={50 + 42 * (y / 100)} y2={y}
            stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" />
        ))}
      </svg>
      {/* Central rising light beam */}
      <div
        className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 rounded-full"
        style={{
          background: `linear-gradient(to top, transparent, rgba(${r},${g},${b},${0.25 + strength * 0.55}) 40%, rgba(${r},${g},${b},${0.5 + strength * 0.5}))`,
          boxShadow: `0 0 ${18 + strength * 26}px rgba(${r},${g},${b},${0.35 + strength * 0.45})`,
        }}
      />
      {/* Walkway lights climbing the beam */}
      {[16, 36, 56, 76].map((top, i) => (
        <motion.span
          key={top}
          className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ top: `${top}%`, background: `rgba(${r},${g},${b},0.85)` }}
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.22 }}
        />
      ))}
      {/* Big VS medallion — the field's centrepiece */}
      <motion.div
        animate={{ scale: leader ? [1, 1.04, 1] : 1 }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="relative z-10 mt-3 flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-black text-white backdrop-blur-md sm:h-20 sm:w-20 sm:text-2xl"
        style={{
          borderColor: `rgba(${r},${g},${b},0.75)`,
          background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.16), rgba(10,16,40,0.92))",
          boxShadow: `0 0 ${16 + strength * 24}px rgba(${r},${g},${b},${0.3 + strength * 0.5}), inset 0 1px 0 rgba(255,255,255,0.2)`,
        }}
      >
        VS
      </motion.div>
      {/* Control chevron — physically points at the leading team's side */}
      <AnimatePresence mode="wait">
        {leader && (
          <motion.span
            key={leader}
            initial={{ opacity: 0, y: -4 }}
            animate={{
              opacity: 1, y: 0,
              x: arrowFor(leader) === "◀" ? [-3, -9, -3] : [3, 9, 3],
            }}
            exit={{ opacity: 0 }}
            transition={{ x: { repeat: Infinity, duration: 1.1 }, opacity: { duration: 0.3 } }}
            className="relative z-10 mt-2 text-2xl font-black"
            style={{ color: `rgb(${r},${g},${b})`, textShadow: `0 0 12px rgba(${r},${g},${b},0.8)` }}
          >
            {arrowFor(leader)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One team's dugout — its own colour identity, floor light, local effects.
// Renders ONLY its own state slice and can only dispatch actions tagged with
// its own TeamId (isolation by construction, made visible by design).
// ─────────────────────────────────────────────────────────────────────────────
const OPTION_LETTERS_AR = ["أ", "ب", "ج", "د"];
const OPTION_LETTERS_EN = ["A", "B", "C", "D"];

function TeamZone({
  team, name, t, question, qTotal, duration, inDanger, onAnswer, ar, side,
}: {
  team: TeamId;
  name: string;
  t: TeamState;
  question: ClassQuestion | null;
  qTotal: number;
  duration: number;
  inDanger: boolean;
  onAnswer: (index: number) => void;
  ar: boolean;
  /** Physical side of the SCREEN this zone sits on — drives the inward tilt. */
  side: "left" | "right";
}) {
  const isBlue = team === "blue";
  const rgb = TEAM_RGB[team];
  const feedbackKey = `${t.qIndex}-${t.phase}`;
  const letters = ar ? OPTION_LETTERS_AR : OPTION_LETTERS_EN;

  const optionStyle = (idx: number): { bg: string; border: string; dim: boolean; crossed: boolean } => {
    const baseGrad = WAMID_GRADIENT[idx] || WAMID_GRADIENT[0];
    const baseBorder = WAMID_BORDER[idx] || WAMID_BORDER[0];
    if (t.phase === "feedback" && question) {
      if (idx === question.correct) return { bg: "#1a5c30", border: "#D9A521", dim: false, crossed: false };
      if (idx === t.selected) return { bg: "#5c1212", border: "#7A0A0A", dim: false, crossed: true };
      return { bg: baseGrad, border: baseBorder, dim: true, crossed: false };
    }
    return { bg: baseGrad, border: baseBorder, dim: false, crossed: false };
  };

  return (
    <motion.section
      // Wrong answer → the WHOLE zone recoils; correct → a proud little lift.
      animate={
        t.phase === "feedback"
          ? t.correct
            ? { y: [0, -5, 0], transition: { duration: 0.4 } }
            : { x: [0, -7, 6, -4, 0], transition: { duration: 0.45 } }
          : { x: 0, y: 0 }
      }
      className="relative flex min-h-0 w-full flex-col gap-2 overflow-hidden rounded-3xl border-2 p-2.5 sm:p-3.5 select-none"
      style={{
        touchAction: "manipulation",
        // Text flows naturally for the language INSIDE the zone.
        direction: ar ? "rtl" : "ltr",
        // Perspective tilt: each dugout leans toward the field's centre line.
        transform: `perspective(1400px) rotateY(${side === "left" ? 2.5 : -2.5}deg)`,
        transformOrigin: side === "left" ? "right center" : "left center",
        borderColor: t.phase === "feedback"
          ? (t.correct ? "rgba(74,222,128,0.85)" : "rgba(248,113,113,0.8)")
          : `rgba(${rgb},0.4)`,
        background: isBlue
          ? "linear-gradient(165deg, rgba(9,32,84,0.88), rgba(7,17,48,0.95))"
          : "linear-gradient(195deg, rgba(84,14,20,0.88), rgba(44,8,14,0.95))",
        boxShadow: t.phase === "feedback" && t.correct
          ? `0 16px 44px rgba(0,0,0,0.35), 0 0 34px rgba(74,222,128,0.35)`
          : `0 16px 44px rgba(0,0,0,0.35), 0 0 24px rgba(${rgb},${inDanger ? 0.08 : 0.18})`,
        opacity: inDanger ? 0.96 : 1,
        transition: "border-color 0.35s ease, box-shadow 0.35s ease",
      }}
    >
      {/* Floor spotlight — every dugout has its own stage light */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{ background: `radial-gradient(ellipse at 50% 115%, rgba(${rgb},0.34), transparent 68%)` }}
      />
      {/* Crowd shimmer strip along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 8% 50%, rgba(${rgb},0.6) 1.5px, transparent 2px), radial-gradient(circle at 26% 30%, rgba(255,255,255,0.5) 1.2px, transparent 2px), radial-gradient(circle at 47% 60%, rgba(${rgb},0.55) 1.4px, transparent 2px), radial-gradient(circle at 66% 35%, rgba(255,255,255,0.45) 1.2px, transparent 2px), radial-gradient(circle at 88% 55%, rgba(${rgb},0.6) 1.5px, transparent 2px)`,
        }}
      />
      {/* Danger dimmer: the threatened side darkens and pulses a warning */}
      {inDanger && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
          animate={{ opacity: [0.16, 0.4, 0.16] }}
          transition={{ repeat: Infinity, duration: 1 }}
          style={{ background: "rgba(0,0,0,0.4)", boxShadow: "inset 0 0 44px rgba(239,68,68,0.5)" }}
        />
      )}
      {/* Correct answer → light pulse rushes UP toward the arena from this zone only */}
      <AnimatePresence>
        {t.phase === "feedback" && t.correct && (
          <motion.div
            key={feedbackKey}
            className="pointer-events-none absolute inset-x-8 top-0 z-10 h-full rounded-full"
            initial={{ opacity: 0.55, y: "60%", scaleY: 0.4 }}
            animate={{ opacity: 0, y: "-70%", scaleY: 1.1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ background: `linear-gradient(to top, transparent, rgba(${rgb},0.4), rgba(74,222,128,0.5))`, filter: "blur(14px)" }}
          />
        )}
      </AnimatePresence>

      {/* ── Banner header: crest · name · LED score · streak · timer ── */}
      <div className="relative z-20 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-11 sm:w-11"
            style={{ background: `rgba(${rgb},0.22)`, border: `1.5px solid rgba(${rgb},0.5)` }}
          >
            {isBlue ? "🔵" : "🔴"}
          </span>
          <div className="min-w-0">
            <p className="break-words text-base font-black leading-tight text-white sm:text-lg lg:text-xl">
              {name}
            </p>
            <p className="text-[11px] font-bold" style={{ color: `rgba(${rgb},0.9)` }}>
              {t.phase === "exhausted"
                ? (ar ? "أنهى أسئلته" : "Finished")
                : `${ar ? "سؤال" : "Q"} ${Math.min(t.qIndex + 1, qTotal)} / ${qTotal}`}
            </p>
          </div>
          {t.streak >= 3 && (
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">
              🔥 {t.streak}x
            </motion.span>
          )}
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          {/* LED-style scoreboard */}
          <span
            className="rounded-lg border px-2.5 py-1 text-lg sm:text-2xl font-black tracking-wider"
            style={{
              fontVariantNumeric: "tabular-nums",
              color: "#F7C948",
              borderColor: "rgba(247,201,72,0.35)",
              background: "rgba(0,0,0,0.55)",
              textShadow: "0 0 12px rgba(247,201,72,0.6)",
            }}
          >
            {t.score}
          </span>
          {/* Zone-local floating "+N" */}
          <AnimatePresence>
            {t.phase === "feedback" && t.correct && t.lastGain > 0 && (
              <motion.span
                key={feedbackKey}
                initial={{ opacity: 1, y: 0, scale: 0.9 }}
                animate={{ opacity: 0, y: -34, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="pointer-events-none absolute -top-2 right-8 z-30 text-xl font-black text-green-300 drop-shadow-lg"
              >
                +{t.lastGain}
              </motion.span>
            )}
          </AnimatePresence>
          {t.phase === "question" && (
            <TimerRing timeLeft={t.timeLeft} total={duration} isUrgent={t.timeLeft <= 5} />
          )}
        </div>
      </div>

      {t.phase === "exhausted" || !question ? (
        <div className="relative z-20 flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="text-4xl">🏁</span>
          <p className="text-base font-black text-white">{ar ? "أنهيتم جميع الأسئلة!" : "All questions done!"}</p>
          <p className="text-sm font-bold text-white/60">
            {ar ? "شجّعوا الحبل — النتيجة تتحدد الآن!" : "Cheer for the rope — it decides now!"}
          </p>
        </div>
      ) : (
        <>
          {/* Question card */}
          <div className="relative z-20 rounded-2xl border-2 bg-black/35 px-3 py-2.5 backdrop-blur-sm"
            style={{ borderColor: `rgba(${rgb},0.3)` }}>
            <p className="text-center text-sm sm:text-lg lg:text-xl font-black leading-snug text-white">
              {question.text}
            </p>
          </div>

          {/* Options 2×2 — أ/ب/ج/د letter badges; the grid follows the zone's
              direction, so in Arabic options flow right → left naturally. */}
          <div className="relative z-20 grid flex-1 grid-cols-2 content-start gap-1.5 sm:gap-2">
            {question.options.map((opt, idx) => {
              const s = optionStyle(idx);
              const clickable = t.phase === "question" && t.selected === null;
              return (
                <motion.button
                  key={idx}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  onClick={() => clickable && onAnswer(idx)}
                  disabled={!clickable}
                  className="relative flex min-h-[46px] items-center gap-2 rounded-lg border px-2 py-1.5 text-start font-bold text-white transition-all sm:min-h-[50px] sm:px-2.5"
                  style={{
                    touchAction: "manipulation",
                    background: s.bg,
                    borderColor: s.border,
                    opacity: s.dim ? 0.4 : 1,
                    cursor: clickable ? "pointer" : "default",
                    boxShadow: s.dim ? "none" : "0 3px 10px rgba(0,0,0,0.28)",
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-black leading-none sm:h-7 sm:w-7 sm:text-[13px]"
                    style={{
                      background: "rgba(255,255,255,0.16)",
                      borderColor: "rgba(255,255,255,0.3)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {letters[idx]}
                  </span>
                  <span className={`flex-1 text-sm font-black leading-snug sm:text-base lg:text-lg ${s.crossed ? "line-through opacity-70" : ""}`}>
                    {opt}
                  </span>
                  {t.phase === "feedback" && idx === question.correct && <span className="text-lg">✓</span>}
                  {s.crossed && <span className="text-lg">✗</span>}
                </motion.button>
              );
            })}
          </div>

          {/* Feedback strip — independent per zone */}
          <div className="relative z-20 h-6 text-center">
            {t.phase === "feedback" && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-black ${t.correct ? "text-green-300" : "text-red-300"}`}>
                {t.correct
                  ? (ar ? "إجابة صحيحة! 💪 شدّوا الحبل!" : "Correct! 💪 Pull!")
                  : t.selected === null
                    ? (ar ? "انتهى الوقت! ⏰" : "Time's up! ⏰")
                    : (ar ? "إجابة خاطئة 😔" : "Wrong answer 😔")}
              </motion.p>
            )}
          </div>
        </>
      )}
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The running game (mounted fresh per round via key — replay = remount)
// ─────────────────────────────────────────────────────────────────────────────
function ClassGame({
  setup, blueName, redName, onExit,
}: {
  setup: ClassSetup;
  blueName: string;
  redName: string;
  onExit: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [state, dispatch] = useReducer(
    classReducer,
    undefined,
    () => createClassState(setup.questions, setup.duration),
  );
  const [goFlash, setGoFlash] = useState(false);
  const [muted, setMuted] = useState(false);

  const soundRef = useRef<TugSoundEngine | null>(null);
  const getSound = useCallback((): TugSoundEngine => {
    if (!soundRef.current) soundRef.current = new TugSoundEngine();
    return soundRef.current;
  }, []);
  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  // Single 1s pulse drives BOTH independent team timers via the reducer.
  useEffect(() => {
    if (state.status !== "countdown" && state.status !== "playing") return;
    const h = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(h);
  }, [state.status]);

  // Countdown beeps + GO! flash + background music.
  const prevStatusRef = useRef<ClassState["status"]>(state.status);
  useEffect(() => {
    if (state.status === "countdown") getSound().playCountdownBeep(state.countdown);
  }, [state.status, state.countdown, getSound]);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;
    if (prev === "countdown" && state.status === "playing") {
      getSound().playGoSignal();
      getSound().startBackground();
      setGoFlash(true);
      const h = setTimeout(() => setGoFlash(false), 900);
      return () => clearTimeout(h);
    }
    if (state.status === "finished") {
      getSound().stopBackground();
      if (state.winner === "draw") getSound().playApplause();
      else getSound().playWin();
    }
    return undefined;
  }, [state.status, state.winner, getSound]);

  // Answer sounds follow the shared impulse stream.
  const lastSoundImpulse = useRef<number | null>(null);
  useEffect(() => {
    const imp = state.lastImpulse;
    if (!imp || imp.id === lastSoundImpulse.current) return;
    lastSoundImpulse.current = imp.id;
    if (imp.kind === "win") { getSound().playCorrect(); getSound().playTugPull(); }
    else getSound().playWrong();
  }, [state.lastImpulse, getSound]);

  // Danger heartbeat when the rope sits near a wall (like the online mode).
  const dangerSide: TeamId | null =
    state.status === "playing" ? (state.rope >= 80 ? "blue" : state.rope <= 20 ? "red" : null) : null;
  useEffect(() => {
    if (!dangerSide) return;
    getSound().playHeartbeat();
    const h = setInterval(() => getSound().playHeartbeat(), 900);
    return () => clearInterval(h);
  }, [dangerSide, getSound]);

  // Urgent music when either team is in its final 5 seconds.
  const urgent = state.status === "playing" && (["blue", "red"] as const).some((id) => {
    const t = state.teams[id];
    return t.phase === "question" && t.timeLeft <= 5;
  });
  useEffect(() => { getSound().setUrgency(urgent); }, [urgent, getSound]);

  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
    if (s.muted) s.stopBackground();
    else if (state.status === "playing") s.startBackground();
  };

  const impulse: TugImpulse | null = state.lastImpulse;
  const teamName = (t: TeamId) => (t === "blue" ? blueName : redName);
  const isPulling = state.status === "playing";
  const title = setup.title || (ar ? "مسابقة شدّ الحبل" : "Tug of War Match");

  // In Arabic the scene is mirrored so BLUE plays on the physical RIGHT —
  // the first team starts from the right, matching RTL reading order.
  const mirror = ar ? { transform: "scaleX(-1)" as const } : undefined;

  const blueZone = (
    <TeamZone
      team="blue" name={blueName} t={state.teams.blue}
      question={currentQuestion(state, "blue")}
      qTotal={state.questions.length}
      duration={setup.duration} ar={ar}
      side={ar ? "right" : "left"}
      inDanger={dangerSide === "blue"}
      onAnswer={(index) => dispatch({ type: "answer", team: "blue", index })}
    />
  );
  const redZone = (
    <TeamZone
      team="red" name={redName} t={state.teams.red}
      question={currentQuestion(state, "red")}
      qTotal={state.questions.length}
      duration={setup.duration} ar={ar}
      side={ar ? "left" : "right"}
      inDanger={dangerSide === "red"}
      onAnswer={(index) => dispatch({ type: "answer", team: "red", index })}
    />
  );

  return (
    <div
      className="flex min-h-screen flex-col select-none text-gray-900"
      style={{
        background: state.status === "finished"
          ? "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.28) 0%, transparent 45%), linear-gradient(160deg, #0d1b3e 0%, #1e1040 50%, #0d1b3e 100%)"
          : "radial-gradient(ellipse at 50% -10%, rgba(251,191,36,0.15) 0%, transparent 55%), linear-gradient(160deg, #0d1b3e 0%, #1a1050 50%, #0d1b3e 100%)",
      }}
    >
      {state.status === "finished" && state.winner && state.winner !== "draw" && (
        <Confetti color={state.winner === "blue" ? "#3b82f6" : "#ef4444"} />
      )}
      {state.status === "countdown" && <CountdownOverlay count={state.countdown} />}
      {goFlash && <CountdownOverlay count="GO!" />}
      {impulse?.kind === "win" && <PowerPullFlash key={impulse.id} team={impulse.team} />}

      {/* Mute toggle */}
      <button onClick={toggleMute}
        className="fixed top-3 z-50 rounded-full border border-white/20 bg-black/35 p-2 text-white/80 backdrop-blur-sm"
        style={{ insetInlineEnd: 12 }}
        aria-label={muted ? "unmute" : "mute"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Physical layout below is managed by hand. In Arabic the WHOLE match is
          mirrored: the scene flips so blue plays on the RIGHT of the screen
          (matching RTL reading order — first team starts far right), and the
          dugouts are pinned to the same physical sides as the scene. */}
      <div className="flex flex-1 flex-col" style={{ direction: "ltr" }}>

        {/* ── THE HERO: full-width arena + power meter, nothing competing with it ── */}
        <section className="relative overflow-hidden rounded-b-[2rem] border-b border-white/10 px-3 pb-2 pt-1 shadow-[0_18px_56px_rgba(0,0,0,0.32)] sm:px-5">
          <StadiumBackdrop active={isPulling} />
          {state.status === "finished" && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2"
              style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(13,27,62,0.55) 70%, rgba(13,27,62,0.9) 100%)" }}
            />
          )}
          {/* Activity title — visible for the whole match, centred over the field */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 w-full max-w-[72vw] -translate-x-1/2 sm:max-w-[56vw]">
            <p
              className="mx-auto w-fit max-w-full truncate rounded-full border border-amber-300/40 bg-black/50 px-5 py-1.5 text-center text-sm font-black text-amber-100 backdrop-blur-md sm:px-7 sm:py-2 sm:text-lg lg:text-xl"
              style={{ direction: ar ? "rtl" : "ltr", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
              title={title}
            >
              📖 {title}
            </p>
          </div>
          <div className="relative z-10 mx-auto max-w-6xl">
            {/* scaleX(-1) mirrors the whole SVG scene in Arabic — blue moves to
                the right side. The scene contains no text, so this is safe. */}
            <div className="min-h-[190px] sm:min-h-[300px] lg:min-h-[380px]" style={mirror}>
              <TugCharacters
                ropePos={state.rope}
                isPulling={isPulling}
                isUrgent={urgent}
                isCelebrating={state.status === "finished"}
                winnerSide={state.winner === "draw" ? null : state.winner}
                impulse={impulse}
              />
            </div>
            <div className="pb-1" style={mirror}>
              <TugPowerMeter position={state.rope} />
            </div>
          </div>
        </section>

        {state.status === "finished" ? (
          <div className="mx-auto w-full max-w-2xl px-4 py-4 text-center text-white" style={{ direction: ar ? "rtl" : "ltr" }}>
            <motion.div initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}>
              {state.winner === "draw" ? (
                <>
                  <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-amber-300/30 bg-white/8 text-4xl backdrop-blur-md">🤝</div>
                  <h2 className="mb-1 text-3xl font-black">{ar ? "تعادل رائع!" : "Great Draw!"}</h2>
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ y: [0, -7, 0], scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-amber-300/45 bg-white/10 text-6xl shadow-[0_0_42px_rgba(217,165,33,0.45)] backdrop-blur-md"
                  >
                    🏆
                  </motion.div>
                  <h2 className="mb-1 text-4xl font-black leading-tight"
                    style={{
                      color: state.winner === "blue" ? "#bfdbfe" : "#fecaca",
                      textShadow: state.winner === "blue"
                        ? "0 0 26px rgba(59,130,246,0.6)"
                        : "0 0 26px rgba(239,68,68,0.6)",
                    }}>
                    {teamName(state.winner as TeamId)}
                  </h2>
                  <p className="mb-2 text-lg font-black" style={{ color: "#F7C948" }}>
                    {state.winKind === "rope"
                      ? (ar ? "🎉 سحب الحبل حتى النهاية!" : "🎉 Pulled the rope all the way!")
                      : (ar ? "🎉 يفوز بشدّ الحبل!" : "🎉 Wins the tug of war!")}
                  </p>
                </>
              )}

              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {(["blue", "red"] as const).map((id) => {
                  const won = state.winner === id;
                  return (
                    <div key={id}
                      className={`rounded-2xl p-3 text-center ${won ? "border-2 border-amber-300/55" : "border border-white/15 opacity-70"}`}
                      style={{
                        background: id === "blue"
                          ? (won ? "linear-gradient(145deg, rgba(29,78,216,0.42), rgba(15,47,122,0.72))" : "rgba(29,78,216,0.14)")
                          : (won ? "linear-gradient(145deg, rgba(220,38,38,0.42), rgba(127,29,29,0.72))" : "rgba(220,38,38,0.14)"),
                      }}>
                      <p className="mb-1 text-xs font-black text-white/85">{won ? "👑 " : ""}{teamName(id)}</p>
                      <p className={`font-black text-white ${won ? "text-4xl" : "text-3xl"}`}
                        style={won ? { textShadow: "0 0 20px rgba(247,201,72,0.55)" } : undefined}>
                        {state.teams[id].score}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2.5">
                <motion.button whileTap={{ scale: 0.97 }}
                  animate={{ scale: [1, 1.015, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  onClick={onExit}
                  className="w-full rounded-2xl py-3.5 text-base font-black"
                  style={{
                    background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                    color: "#1a2e1a",
                    boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
                  }}>
                  🔄 {ar ? "العب مجدداً" : "Play Again"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── THE DUGOUTS: pinned to the far EDGES of the screen with a wide
                centre field between them, so two/three students can stand at
                each side of the board without crowding each other. Zone sides
                always match the (possibly mirrored) scene above. ── */
          <div className="flex w-full flex-1 items-stretch gap-2 px-2 pb-2 pt-2 sm:gap-3 sm:px-3 sm:pb-3">
            {/* Phones: zones flex to fit. sm+: fixed width pinned to the screen
                edges, with ALL remaining space becoming the centre field. */}
            <div className="flex min-w-0 flex-1 sm:flex-none sm:w-[clamp(280px,34vw,470px)]">
              {ar ? redZone : blueZone}
            </div>
            <div className="w-10 shrink-0 sm:w-auto sm:min-w-[110px] sm:flex-1">
              <CenterField rope={state.rope} blueOnRight={ar} />
            </div>
            <div className="flex min-w-0 flex-1 sm:flex-none sm:w-[clamp(280px,34vw,470px)]">
              {ar ? blueZone : redZone}
            </div>
          </div>
        )}
      </div>

      {/* Start overlay (idle) */}
      {state.status === "idle" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-amber-300/25 bg-[#0d1b3e]/95 p-6 text-center text-white shadow-2xl"
            style={{ direction: ar ? "rtl" : "ltr" }}>
            <div className="mb-2 text-5xl">🪢</div>
            <h1 className="mb-1 text-2xl font-black">{ar ? "وضع الصف" : "Class Mode"}</h1>
            <p className="mx-auto mb-2 w-fit max-w-full truncate rounded-full border border-amber-300/35 bg-black/30 px-4 py-1 text-sm font-black text-amber-200" title={title}>
              📖 {title}
            </p>
            <p className="mb-4 text-sm font-bold text-white/65 leading-relaxed">
              {ar
                ? "اعرض الشاشة أمام الصف وقسّم الطلاب لفريقين: الأزرق يمين الشاشة والأحمر يسارها. كلا الفريقين يلعب كل الأسئلة، لكن بترتيب عشوائي مختلف ومؤقت ووتيرة مستقلة!"
                : "Show this screen to the class and split students into two teams: blue on the left, red on the right. Both teams play all the questions — each in its own random order, timer and pace!"}
            </p>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs font-black text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1">
                📚 {state.questions.length} {ar ? "سؤالاً لكل فريق" : "questions per team"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                🔀 {ar ? "بترتيب عشوائي مختلف" : "different random order"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">⏱ {setup.duration} {ar ? "ثانية/سؤال" : "sec/question"}</span>
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => dispatch({ type: "start" })}
              className="w-full rounded-2xl py-3.5 text-lg font-black"
              style={{
                background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                color: "#1a2e1a",
                boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
              }}>
              🚀 {ar ? "ابدأ اللعبة" : "Start Game"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function TugClass() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const [setup] = useState<ClassSetup | null>(readSetup);
  const [round, setRound] = useState(0);
  const [blueName] = useState(ar ? "الفريق الأزرق" : "Blue Team");
  const [redName] = useState(ar ? "الفريق الأحمر" : "Red Team");

  if (!setup) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-6xl">🪢</div>
          <h2 className="text-2xl font-black">{ar ? "وضع الصف" : "Class Mode"}</h2>
          <p className="max-w-sm text-muted-foreground">
            {ar
              ? "جهّز سؤالين على الأقل من صفحة إنشاء شد الحبل ثم اختر «وضع الصف» — كل فريق يلعب كل الأسئلة بترتيبه العشوائي الخاص."
              : "Prepare at least two questions from the tug create page, then choose Class Mode — each team plays all questions in its own random order."}
          </p>
          <button onClick={() => setLocation("/game/tug/create")}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white">
            {ar ? "إعداد الأسئلة" : "Set up questions"}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* key = round → "Play Again" remounts a fresh engine with the same questions */}
      <ClassGame key={round} setup={setup} blueName={blueName} redName={redName}
        onExit={() => setRound((r) => r + 1)} />
    </Layout>
  );
}
