// ─────────────────────────────────────────────────────────────────────────────
// Tug-of-war "Class Mode" (وضع الصف): one screen for the whole class.
// The shared arena (scene, camera, impulses, power meter) sits in the middle;
// each team gets its OWN question panel on its physical side with a fully
// independent state slice driven by the pure reducer in tug-class-engine.ts.
// No sockets, no server — everything runs locally on the teacher's screen.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX } from "lucide-react";
import {
  TugSoundEngine, Confetti, PowerPullFlash, CountdownOverlay, TimerRing,
  TugArena, KAHOOT_SHAPES, WAMID_GRADIENT, WAMID_BORDER, type TugImpulse,
} from "@/components/game/tug-shared";
import {
  classReducer, createClassState, currentQuestion,
  type ClassQuestion, type ClassState, type TeamId, type TeamState,
} from "@/lib/tug-class-engine";

export const TUG_CLASS_SETUP_KEY = "tug-class-setup";

interface ClassSetup {
  questions: ClassQuestion[];
  duration: number;
}

function readSetup(): ClassSetup | null {
  try {
    const raw = sessionStorage.getItem(TUG_CLASS_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClassSetup>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;
    return { questions: parsed.questions, duration: parsed.duration || 20 };
  } catch {
    return null;
  }
}

// ── One team's question panel — renders ONLY its own state slice and can only
//    dispatch actions tagged with its own TeamId (isolation by construction). ──
function TeamPanel({
  team, name, t, question, duration, onAnswer, ar,
}: {
  team: TeamId;
  name: string;
  t: TeamState;
  question: ClassQuestion | null;
  duration: number;
  onAnswer: (index: number) => void;
  ar: boolean;
}) {
  const isBlue = team === "blue";
  const accent = isBlue ? "rgba(59,130,246," : "rgba(239,68,68,";

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
    <section
      className="flex min-h-0 flex-col gap-2 rounded-2xl border p-2.5 sm:p-3 select-none"
      style={{
        touchAction: "manipulation",
        borderColor: `${accent}0.4)`,
        background: isBlue
          ? "linear-gradient(160deg, rgba(7,42,113,0.5), rgba(13,27,62,0.72))"
          : "linear-gradient(160deg, rgba(127,29,29,0.5), rgba(62,13,27,0.72))",
        boxShadow: `0 14px 36px rgba(0,0,0,0.3), 0 0 20px ${accent}0.14)`,
      }}
    >
      {/* Header: team name · score · streak · timer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none">{isBlue ? "🔵" : "🔴"}</span>
          <span className="truncate text-sm sm:text-base font-black text-white">{name}</span>
          {t.streak >= 3 && (
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
              className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">
              🔥 {t.streak}x
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-xl bg-black/25 px-2.5 py-1 text-lg sm:text-xl font-black text-amber-300"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {t.score}
          </span>
          {t.phase === "question" && (
            <TimerRing timeLeft={t.timeLeft} total={duration} isUrgent={t.timeLeft <= 5} />
          )}
        </div>
      </div>

      {t.phase === "exhausted" || !question ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="text-4xl">🏁</span>
          <p className="font-black text-white text-base">
            {ar ? "أنهيتم جميع الأسئلة!" : "All questions done!"}
          </p>
          <p className="text-sm font-bold text-white/60">
            {ar ? "بانتظار الفريق الآخر…" : "Waiting for the other team…"}
          </p>
        </div>
      ) : (
        <>
          {/* Question card */}
          <div className="rounded-xl border-2 border-amber-300/25 bg-black/30 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-center text-sm sm:text-base lg:text-lg font-black leading-snug text-white">
              <span className="me-1.5 text-amber-300/80 text-xs font-black">
                {t.qIndex + 1}
              </span>
              {question.text}
            </p>
          </div>

          {/* Options 2×2 — Kahoot shapes + وميض gradients (same as online mode) */}
          <div className="grid flex-1 grid-cols-2 gap-1.5 sm:gap-2">
            {question.options.map((opt, idx) => {
              const s = optionStyle(idx);
              const clickable = t.phase === "question" && t.selected === null;
              return (
                <motion.button
                  key={idx}
                  whileTap={clickable ? { scale: 0.96 } : undefined}
                  onClick={() => clickable && onAnswer(idx)}
                  disabled={!clickable}
                  className="relative flex min-h-[52px] items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-start font-bold text-white transition-all"
                  style={{
                    touchAction: "manipulation",
                    background: s.bg,
                    borderColor: s.border,
                    opacity: s.dim ? 0.45 : 1,
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  <span className="text-base leading-none opacity-90">{KAHOOT_SHAPES[idx]}</span>
                  <span className={`flex-1 text-sm sm:text-base leading-snug ${s.crossed ? "line-through opacity-70" : ""}`}>
                    {opt}
                  </span>
                  {t.phase === "feedback" && idx === question.correct && <span className="text-lg">✓</span>}
                  {s.crossed && <span className="text-lg">✗</span>}
                </motion.button>
              );
            })}
          </div>

          {/* Feedback strip — independent per panel */}
          <div className="h-6 text-center">
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
    </section>
  );
}

// ── The running game (mounted fresh per round via key — replay = remount) ──
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

      {/* Physical LTR: blue is ALWAYS on the left to match the arena scene. */}
      <div className="flex flex-1 flex-col" style={{ direction: "ltr" }}>
        <TugArena
          ropePos={state.rope}
          blueScore={state.teams.blue.score}
          redScore={state.teams.red.score}
          blueCount={1}
          redCount={1}
          blueLabel={blueName}
          redLabel={redName}
          lang={lang}
          isPulling={isPulling}
          isUrgent={urgent}
          isCelebrating={state.status === "finished"}
          winnerSide={state.winner === "draw" ? null : state.winner}
          impulse={impulse}
        />

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
          /* Two fully isolated team panels — blue left, red right, matching the scene. */
          <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
            <TeamPanel
              team="blue" name={blueName} t={state.teams.blue}
              question={currentQuestion(state, "blue")}
              duration={setup.duration} ar={ar}
              onAnswer={(index) => dispatch({ type: "answer", team: "blue", index })}
            />
            <TeamPanel
              team="red" name={redName} t={state.teams.red}
              question={currentQuestion(state, "red")}
              duration={setup.duration} ar={ar}
              onAnswer={(index) => dispatch({ type: "answer", team: "red", index })}
            />
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
            <p className="mb-4 text-sm font-bold text-white/65 leading-relaxed">
              {ar
                ? "اعرض الشاشة أمام الصف وقسّم الطلاب لفريقين: الأزرق يسار الشاشة والأحمر يمينها. لكل فريق أسئلته ومؤقته الخاص!"
                : "Show this screen to the class and split students into two teams: blue on the left, red on the right. Each team gets its own questions and timer!"}
            </p>
            <div className="mb-4 flex items-center justify-center gap-3 text-xs font-black text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1">📚 {setup.questions.length} {ar ? "سؤال" : "questions"}</span>
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
              ? "جهّز الأسئلة أولاً من صفحة إنشاء شد الحبل ثم اختر «وضع الصف»."
              : "Prepare questions first from the tug create page, then choose Class Mode."}
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
