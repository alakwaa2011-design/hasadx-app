// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — CLASS MODE: one cooperative run on the classroom screen.
// The whole class is ONE crew locked inside the vault; the teacher (or a
// nominated student) taps the agreed answer. No sockets — everything local.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  createEscapeState, escapeReducer, escapeScore, ESCAPE_CLASS_SETUP_KEY,
  type EscapeQuestion, type EscapeState,
} from "@/lib/escape-engine";
import {
  EscapeSoundEngine, EscapeGameView, EscapeEndStats, VaultBackdrop,
  TreasureBurst, ESCAPE_BG, GOLD, LOCK_META,
} from "@/components/game/escape-shared";

export interface EscapeSetup {
  questions: EscapeQuestion[];
  totalTime: number;
  lockCount: number;
  hints: number;
  title?: string;
}

function readSetup(): EscapeSetup | null {
  try {
    const raw = sessionStorage.getItem(ESCAPE_CLASS_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EscapeSetup>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) return null;
    return {
      questions: parsed.questions,
      totalTime: parsed.totalTime || 600,
      lockCount: parsed.lockCount || 4,
      hints: parsed.hints ?? 2,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function ClassRun({ setup, onReplay }: { setup: EscapeSetup; onReplay: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const [state, dispatch] = useReducer(
    escapeReducer,
    undefined,
    () => createEscapeState({
      questions: setup.questions,
      totalTime: setup.totalTime,
      lockCount: setup.lockCount,
      hints: setup.hints,
    }),
  );
  const [muted, setMuted] = useState(false);

  const soundRef = useRef<EscapeSoundEngine | null>(null);
  const getSound = useCallback((): EscapeSoundEngine => {
    if (!soundRef.current) soundRef.current = new EscapeSoundEngine();
    return soundRef.current;
  }, []);
  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  // End-of-run stings (EscapeGameView unmounts on the same render, so the
  // page owns both the victory fanfare and the time-up slam).
  const prevStatus = useRef<EscapeState["status"]>(state.status);
  useEffect(() => {
    if (prevStatus.current === "playing" && state.status === "won") {
      getSound().playVaultOpen();
      try { navigator.vibrate?.([60, 40, 60, 40, 120]); } catch (_) { /* ignore */ }
    }
    if (prevStatus.current === "playing" && state.status === "lost") getSound().playTimeUp();
    prevStatus.current = state.status;
  }, [state.status, getSound]);

  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
    if (!s.muted && state.status === "playing") s.startAmbient();
  };

  const title = setup.title || (ar ? "قبو حصاد" : "Hasad Vault");
  const minutes = Math.round(setup.totalTime / 60);
  const danger = state.status === "playing" && state.timeLeft <= 60;

  return (
    <div className="relative flex min-h-screen flex-col select-none text-white" style={{ background: ESCAPE_BG }}>
      <VaultBackdrop danger={danger} />
      {state.status === "won" && <TreasureBurst />}

      {/* Mute */}
      <button onClick={toggleMute}
        className="fixed top-3 z-50 rounded-full border border-white/20 bg-black/35 p-2 text-white/80 backdrop-blur-sm"
        style={{ insetInlineEnd: 12 }}
        aria-label={muted ? "unmute" : "mute"}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Title banner */}
      <div className="relative z-10 flex justify-center pt-3">
        <p className="w-fit max-w-[80vw] truncate rounded-full border border-amber-300/40 bg-black/50 px-6 py-1.5 text-center text-sm font-black text-amber-100 backdrop-blur-md sm:text-lg"
          style={{ direction: ar ? "rtl" : "ltr", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
          title={title}>
          🔐 {title}
        </p>
      </div>

      {(state.status === "playing") && (
        <EscapeGameView state={state} dispatch={dispatch} sound={getSound()} ar={ar} variant="class" />
      )}

      {/* ── WIN / LOSE ceremony ── */}
      {(state.status === "won" || state.status === "lost") && (
        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
          style={{ direction: ar ? "rtl" : "ltr" }}>
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }} className="w-full">
            {state.status === "won" ? (
              <>
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-amber-300/50 bg-white/10 text-6xl shadow-[0_0_48px_rgba(217,165,33,0.5)] backdrop-blur-md"
                >
                  🏆
                </motion.div>
                <h2 className="mb-1 text-3xl font-black sm:text-4xl" style={{ color: GOLD, textShadow: "0 0 26px rgba(247,201,72,0.6)" }}>
                  {ar ? "هربتم من القبو!" : "You escaped the vault!"}
                </h2>
                <p className="mb-4 text-base font-bold text-white/70">
                  {ar ? "فريق واحد… عقول كثيرة… كنز المعرفة صار لكم 🎉" : "One crew, many minds — the treasure is yours 🎉"}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/20 bg-white/5 text-6xl backdrop-blur-md">
                  ⛓️
                </div>
                <h2 className="mb-1 text-3xl font-black text-red-300 sm:text-4xl" style={{ textShadow: "0 0 22px rgba(248,113,113,0.5)" }}>
                  {ar ? "انتهى الوقت — القبو أُغلق!" : "Time's up — the vault sealed!"}
                </h2>
                <p className="mb-4 text-base font-bold text-white/70">
                  {ar ? "كنتم قريبين جداً… جولة أخرى وستهربون حتماً 💪" : "So close! One more run and you'll make it 💪"}
                </p>
              </>
            )}

            {/* Score medallion */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
              className="mx-auto mb-4 w-fit rounded-2xl border-2 border-amber-300/45 bg-black/50 px-8 py-2.5"
            >
              <p className="text-[11px] font-black text-white/55">{ar ? "نقاط الفريق" : "Crew score"}</p>
              <p className="text-4xl font-black" style={{ color: GOLD, fontVariantNumeric: "tabular-nums", textShadow: "0 0 18px rgba(247,201,72,0.55)" }}>
                {escapeScore(state)}
              </p>
            </motion.div>

            <div className="mb-5"><EscapeEndStats state={state} ar={ar} /></div>

            <div className="flex flex-col gap-2.5">
              <motion.button whileTap={{ scale: 0.97 }}
                animate={{ scale: [1, 1.015, 1] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                onClick={onReplay}
                className="w-full rounded-2xl py-3.5 text-base font-black text-[#1a2e1a]"
                style={{
                  background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                  boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
                }}>
                🔄 {ar ? (state.status === "won" ? "قبو جديد بنفس الأسئلة" : "حاولوا مرة أخرى") : (state.status === "won" ? "New vault, same questions" : "Try again")}
              </motion.button>
              <button onClick={() => setLocation("/game/escape/create")}
                className="w-full rounded-2xl border border-white/25 bg-white/8 py-3 text-sm font-black text-white/85 backdrop-blur-sm">
                🛠 {ar ? "العودة للإعداد" : "Back to setup"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Briefing overlay (idle) — mission story before the door slams ── */}
      {state.status === "idle" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-amber-300/25 bg-[#0d1626]/95 p-6 text-center shadow-2xl"
            style={{ direction: ar ? "rtl" : "ltr" }}>
            <div className="mb-2 text-5xl">🔐</div>
            <h1 className="mb-1 text-2xl font-black">{ar ? "قبو حصاد — وضع الصف" : "Hasad Vault — Class Mode"}</h1>
            <p className="mx-auto mb-3 w-fit max-w-full truncate rounded-full border border-amber-300/35 bg-black/30 px-4 py-1 text-sm font-black text-amber-200" title={title}>
              📖 {title}
            </p>
            <p className="mb-3 text-sm font-bold leading-relaxed text-white/70">
              {ar
                ? `الباب أُغلق خلفكم وأمامكم ${setup.lockCount} أقفال تحرس كنز المعرفة. أجيبوا صحيحاً لتفكيك كل قفل — وكل خطأ يُطلق الإنذار ويسرق 15 ثانية! لديكم ${minutes} دقائق فقط… الصف كله فريق واحد.`
                : `The door just sealed behind you. ${setup.lockCount} locks guard the treasure of knowledge. Answer right to break each lock — every mistake trips the alarm and steals 15 seconds! You have ${minutes} minutes. The whole class is one crew.`}
            </p>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs font-black text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1">📚 {setup.questions.length} {ar ? "سؤالاً" : "questions"}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">🔒 {setup.lockCount} {ar ? "أقفال" : "locks"}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">⏱ {minutes} {ar ? "دقيقة" : "min"}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">🗝️ {setup.hints} {ar ? "مفاتيح مساعدة" : "hint keys"}</span>
            </div>
            {/* Lock preview chain */}
            <div className="mb-4 flex items-center justify-center gap-2 text-lg">
              {state.locks.map((l, i) => (
                <span key={i} title={ar ? LOCK_META[l.type].ar : LOCK_META[l.type].en}>{LOCK_META[l.type].icon}</span>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { getSound().playStart(); dispatch({ type: "start" }); }}
              className="w-full rounded-2xl py-3.5 text-lg font-black text-[#1a2e1a]"
              style={{
                background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
              }}>
              🚪 {ar ? "أغلقوا الباب — ابدأوا الهروب!" : "Seal the door — start the escape!"}
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function EscapeClass() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const [setup] = useState<EscapeSetup | null>(readSetup);
  const [round, setRound] = useState(0);

  if (!setup) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-6xl">🔐</div>
          <h2 className="text-2xl font-black">{ar ? "قبو حصاد" : "Hasad Vault"}</h2>
          <p className="max-w-sm text-muted-foreground">
            {ar
              ? "جهّز 3 أسئلة على الأقل من صفحة إنشاء قبو حصاد ثم اختر «وضع الصف»."
              : "Prepare at least 3 questions from the vault create page, then choose Class Mode."}
          </p>
          <button onClick={() => setLocation("/game/escape/create")}
            className="rounded-xl bg-amber-600 px-6 py-3 font-bold text-white">
            {ar ? "إعداد الأسئلة" : "Set up questions"}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* key = round → replay remounts a fresh engine (new lock digits too) */}
      <ClassRun key={round} setup={setup} onReplay={() => setRound((r) => r + 1)} />
    </Layout>
  );
}
