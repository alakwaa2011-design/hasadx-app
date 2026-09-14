// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — CLASS MODE: one cooperative run on the classroom screen.
// The whole class is ONE crew locked inside the vault; the teacher (or a
// nominated student) taps the agreed answer. No sockets — everything local.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, LogOut, Maximize, Minimize, Square, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSmartBack } from "@/lib/nav-history";
import {
  createEscapeState, escapeReducer, escapeScore, ESCAPE_CLASS_SETUP_KEY,
  type EscapeQuestion, type EscapeState,
} from "@/lib/escape-engine";
import {
  EscapeSoundEngine, EscapeGameView, EscapeEndStats, VaultBackdrop,
  TreasureBurst, ESCAPE_BG, GOLD,
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
  const { lang, t, dir } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const goBack = useSmartBack("/teacher/games");
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
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    if (!s.muted && state.status === "playing") { s.startAmbient(); s.startMusic(); }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  const stopGame = () => {
    if (!window.confirm(ar ? "هل تريد إيقاف الجولة الحالية والعودة إلى الإعداد؟" : "Stop this round and return to setup?")) return;
    getSound().stopAmbient();
    getSound().stopMusic();
    setLocation("/game/escape/create");
  };

  const exitGame = () => {
    if (!window.confirm(ar ? "هل تريد الخروج من غرفة الهروب؟" : "Exit the escape room?")) return;
    getSound().stopAmbient();
    getSound().stopMusic();
    setLocation("/teacher/dashboard");
  };

  const title = setup.title || t.escapeClass.defaultTitle;
  const minutes = Math.round(setup.totalTime / 60);
  const danger = state.status === "playing" && state.timeLeft <= 60;

  return (
    <div className="relative flex min-h-screen flex-col select-none text-white" style={{ background: ESCAPE_BG }}>
      <VaultBackdrop danger={danger} />
      {state.status === "won" && <TreasureBurst />}

      {/* In-game title and controls */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-3 pt-3" style={{ direction: dir }}>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-black/35 p-2.5 backdrop-blur-md sm:flex-row sm:justify-between">
          <p className="max-w-full truncate rounded-xl border border-amber-300/30 bg-black/30 px-4 py-2 text-center text-sm font-black text-amber-100 sm:max-w-[48%] sm:text-base"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
            title={title}>
            🔐 {title}
          </p>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
            <button onClick={goBack}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/10 px-2.5 text-xs font-black text-amber-100 transition-colors hover:bg-amber-300/20"
              aria-label={ar ? "رجوع" : "Back"}>
              {ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              <span>{ar ? "رجوع" : "Back"}</span>
            </button>
            <button onClick={toggleMute}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-2.5 text-xs font-black text-white/85 transition-colors hover:bg-white/15"
              aria-label={muted ? t.escapeClass.unmute : t.escapeClass.mute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{muted ? (ar ? "تشغيل الصوت" : "Sound on") : (ar ? "الصوت" : "Sound")}</span>
            </button>
            <button onClick={toggleFullscreen}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-2.5 text-xs font-black text-white/85 transition-colors hover:bg-white/15"
              aria-label={isFullscreen ? (ar ? "إنهاء ملء الشاشة" : "Exit fullscreen") : (ar ? "ملء الشاشة" : "Fullscreen")}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              <span>{ar ? "ملء الشاشة" : "Fullscreen"}</span>
            </button>
            {state.status === "playing" && (
              <button onClick={stopGame}
                className="flex min-h-9 items-center gap-1.5 rounded-xl border border-orange-300/25 bg-orange-400/10 px-2.5 text-xs font-black text-orange-200 transition-colors hover:bg-orange-400/20"
                aria-label={ar ? "إيقاف اللعبة" : "Stop game"}>
                <Square className="h-4 w-4" fill="currentColor" />
                <span>{ar ? "إيقاف" : "Stop"}</span>
              </button>
            )}
            <button onClick={exitGame}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-red-300/25 bg-red-500/10 px-2.5 text-xs font-black text-red-200 transition-colors hover:bg-red-500/20"
              aria-label={ar ? "الخروج" : "Exit"}>
              <LogOut className="h-4 w-4" />
              <span>{ar ? "خروج" : "Exit"}</span>
            </button>
          </div>
        </div>
      </div>

      {(state.status === "playing") && (
        <EscapeGameView state={state} dispatch={dispatch} sound={getSound()} ar={ar} variant="class" />
      )}

      {/* ── WIN / LOSE ceremony ── */}
      {(state.status === "won" || state.status === "lost") && (
        <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center"
          style={{ direction: dir }}>
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
                  {t.escapeClass.escapedTitle}
                </h2>
                <p className="mb-4 text-base font-bold text-white/70">
                  {t.escapeClass.escapedDescription}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/20 bg-white/5 text-6xl backdrop-blur-md">
                  ⛓️
                </div>
                <h2 className="mb-1 text-3xl font-black text-red-300 sm:text-4xl" style={{ textShadow: "0 0 22px rgba(248,113,113,0.5)" }}>
                  {t.escapeClass.timeUpTitle}
                </h2>
                <p className="mb-4 text-base font-bold text-white/70">
                  {t.escapeClass.timeUpDescription}
                </p>
              </>
            )}

            {/* Score medallion */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
              className="mx-auto mb-4 w-fit rounded-2xl border-2 border-amber-300/45 bg-black/50 px-8 py-2.5"
            >
              <p className="text-[11px] font-black text-white/55">{t.escapeClass.crewScore}</p>
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
                🔄 {state.status === "won" ? t.escapeClass.newVault : t.escapeClass.tryAgain}
              </motion.button>
              <button onClick={() => setLocation("/game/escape/create")}
                className="w-full rounded-2xl border border-white/25 bg-white/8 py-3 text-sm font-black text-white/85 backdrop-blur-sm">
                🛠 {t.escapeClass.backToSetup}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Class start gate — also provides the tap needed to unlock sound ── */}
      {state.status === "idle" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-[#101c2b]/95 p-5 text-center shadow-2xl sm:p-6"
            style={{ direction: dir }}>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B4B35] text-3xl shadow-lg">🏫</div>
            <p className="mb-1 text-sm font-black text-emerald-200">{t.escapeClass.classMode}</p>
            <h1 className="mb-2 text-2xl font-black text-white">{t.escapeClass.getReady}</h1>
            <p className="mx-auto mb-4 max-w-sm text-sm font-bold leading-relaxed text-white/70">
              {t.escapeClass.startDescription}
            </p>
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs font-black text-white/75">
              <span className="rounded-full bg-white/10 px-3 py-1.5">📚 {setup.questions.length} {t.escapeClass.questions}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">🔒 {setup.lockCount} {t.escapeClass.locks}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">⏱ {minutes} {t.escapeClass.minutes}</span>
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { getSound().playStart(); dispatch({ type: "start" }); }}
              className="w-full rounded-2xl bg-[#0B4B35] py-3.5 text-lg font-black text-white shadow-[0_12px_28px_rgba(11,75,53,0.36)] transition-colors hover:bg-[#083d2c]"
              style={{
                boxShadow: "0 12px 28px rgba(11,75,53,0.36)",
              }}>
              {t.escapeClass.startChallenge}
            </motion.button>
            <p className="mt-3 text-xs font-medium text-white/45">{t.escapeClass.wrongAnswerPenalty}</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function EscapeClass() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [setup] = useState<EscapeSetup | null>(readSetup);
  const [round, setRound] = useState(0);

  if (!setup) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-6xl">🔐</div>
          <h2 className="text-2xl font-black">{t.escapeClass.defaultTitle}</h2>
          <p className="max-w-sm text-muted-foreground">
            {t.escapeClass.setupRequiredDescription}
          </p>
          <button onClick={() => setLocation("/game/escape/create")}
            className="rounded-xl bg-amber-600 px-6 py-3 font-bold text-white">
            {t.escapeClass.setupQuestions}
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
