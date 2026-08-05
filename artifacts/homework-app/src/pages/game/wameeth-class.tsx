// ─────────────────────────────────────────────────────────────────────────────
// وميض الصف — split-screen classroom flash quiz.
//
// Two teams compete on the SAME screen (smart board). Each side is a fully
// independent flash panel: its own shuffled question order, its own timer and
// score. Touching the left panel never affects the right one.
//
// No sockets — everything runs locally via useReducer.
// ─────────────────────────────────────────────────────────────────────────────
import {
  useEffect, useReducer, useRef, useState, useCallback,
} from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX, X } from "lucide-react";
import {
  wameethClassReducer,
  createWameethClassState,
  currentWameethQuestion,
  type TeamId,
  type WameethTeamState,
  type WameethClassQuestion,
  type WameethClassState,
} from "@/lib/wameeth-class-engine";

// ─── Session-storage key (written by wameeth-create.tsx) ────────────────────
export const WAMEETH_CLASS_SETUP_KEY = "wameeth-class-setup";

interface WameethClassSetup {
  questions: WameethClassQuestion[];
  duration: number;
  title?: string;
}

function readSetup(): WameethClassSetup | null {
  try {
    const raw = sessionStorage.getItem(WAMEETH_CLASS_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WameethClassSetup>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 2) return null;
    return {
      questions: parsed.questions,
      duration: parsed.duration || 20,
      title: typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Colours ─────────────────────────────────────────────────────────────────
const TEAM_CONFIG = {
  blue: {
    rgb: "59,130,246",
    bg: "linear-gradient(160deg, #0a1e4a 0%, #0d2260 50%, #071640 100%)",
    border: "#3b82f6",
    label: { ar: "الفريق الأزرق", en: "Blue Team" },
    optionLetter: "rgba(59,130,246,0.85)",
  },
  red: {
    rgb: "239,68,68",
    bg: "linear-gradient(160deg, #4a0a0a 0%, #601010 50%, #380707 100%)",
    border: "#ef4444",
    label: { ar: "الفريق الأحمر", en: "Red Team" },
    optionLetter: "rgba(239,68,68,0.85)",
  },
} as const;

// Arabic / Latin option letters
const AR_LETTERS = ["أ", "ب", "ج", "د"];
const EN_LETTERS = ["A", "B", "C", "D"];

// ─── Minimal sound engine (Web Audio) ───────────────────────────────────────
class WameethClassSound {
  private ctx: AudioContext | null = null;
  muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private beep(freq: number, dur: number, vol = 0.18, type: OscillatorType = "sine") {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch { /* AudioContext may be blocked */ }
  }

  playCorrect() { this.beep(880, 0.12, 0.2); setTimeout(() => this.beep(1100, 0.18, 0.15), 80); }
  playWrong()   { this.beep(220, 0.25, 0.18, "sawtooth"); }
  playCountdown() { this.beep(660, 0.1, 0.2); }
  playStart()   { this.beep(880, 0.08, 0.22); setTimeout(() => this.beep(1100, 0.1, 0.22), 90); setTimeout(() => this.beep(1320, 0.22, 0.22), 180); }
  playWin()     {
    [0, 100, 200, 350].forEach((d, i) =>
      setTimeout(() => this.beep(880 + i * 110, 0.22, 0.2), d));
  }

  setMuted(v: boolean) { this.muted = v; }
  destroy() { this.ctx?.close(); this.ctx = null; }
}

// ─── Timer ring (progress arc) ───────────────────────────────────────────────
function TimerRing({ timeLeft, total, rgb }: { timeLeft: number; total: number; rgb: string }) {
  const pct = Math.max(0, timeLeft / total);
  const r = 18; const circ = 2 * Math.PI * r;
  const urgent = timeLeft <= 5;
  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
      <motion.circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke={urgent ? "#ef4444" : `rgb(${rgb})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform="rotate(-90 22 22)"
        animate={urgent ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
        transition={urgent ? { repeat: Infinity, duration: 0.55 } : undefined}
      />
      <text x="22" y="26" textAnchor="middle" fill="white" fontSize="11"
        fontWeight="900" style={{ fontVariantNumeric: "tabular-nums" }}>
        {timeLeft}
      </text>
    </svg>
  );
}

// ─── One team's question panel ────────────────────────────────────────────────
function TeamPanel({
  team, name, t, question, qTotal, duration, ar, onAnswer, pending,
}: {
  team: TeamId;
  name: string;
  t: WameethTeamState;
  question: WameethClassQuestion | null;
  qTotal: number;
  duration: number;
  ar: boolean;
  onAnswer: (idx: number) => void;
  pending: number | null;
}) {
  const cfg = TEAM_CONFIG[team];
  const rgb = cfg.rgb;
  const letters = ar ? AR_LETTERS : EN_LETTERS;
  const feedbackKey = `${team}-${t.qIndex}-fb`;

  // Option style based on feedback state
  const optStyle = (idx: number) => {
    if (t.phase !== "feedback" || t.selected === null && t.correct === null) {
      return { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)", dim: false };
    }
    if (idx === question?.correct) {
      return { bg: "rgba(34,197,94,0.25)", border: "rgba(34,197,94,0.7)", dim: false };
    }
    if (idx === t.selected && !t.correct) {
      return { bg: "rgba(239,68,68,0.25)", border: "rgba(239,68,68,0.7)", dim: false };
    }
    return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", dim: true };
  };

  return (
    <section
      className="relative flex flex-1 flex-col gap-2 overflow-hidden rounded-2xl p-3 sm:p-4"
      style={{ background: cfg.bg, border: `1.5px solid rgba(${rgb},0.3)` }}
    >
      {/* Corner glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: `inset 0 0 40px rgba(${rgb},0.08)` }}
      />

      {/* Header: team name + progress + score + timer */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span
            className="text-base font-black leading-tight sm:text-lg"
            style={{ color: `rgb(${rgb})`, textShadow: `0 0 14px rgba(${rgb},0.5)` }}
          >
            {name}
          </span>
          <span className="text-[11px] font-bold text-white/55">
            {t.phase === "exhausted"
              ? (ar ? "أنهى أسئلته ✓" : "Done ✓")
              : `${ar ? "س" : "Q"} ${Math.min(t.qIndex + 1, qTotal)} / ${qTotal}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Score */}
          <div className="relative">
            <span
              className="rounded-xl border px-3 py-1 text-xl font-black sm:text-2xl"
              style={{
                color: "#f7c948",
                borderColor: "rgba(247,201,72,0.3)",
                background: "rgba(0,0,0,0.4)",
                textShadow: "0 0 14px rgba(247,201,72,0.55)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.score}
            </span>
            <AnimatePresence>
              {t.phase === "feedback" && t.correct && t.lastGain > 0 && (
                <motion.span
                  key={feedbackKey}
                  initial={{ opacity: 1, y: 0, scale: 0.9 }}
                  animate={{ opacity: 0, y: -32, scale: 1.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.85, ease: "easeOut" }}
                  className="pointer-events-none absolute -top-1 -right-1 z-30 text-base font-black text-green-300 drop-shadow-lg"
                >
                  +{t.lastGain}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {/* Timer */}
          {t.phase === "question" && (
            <TimerRing timeLeft={t.timeLeft} total={duration} rgb={rgb} />
          )}
          {t.phase === "feedback" && (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              {t.correct ? "✓" : t.selected === null ? "⏰" : "✗"}
            </div>
          )}
          {t.phase === "exhausted" && (
            <div className="flex h-11 w-11 items-center justify-center rounded-full text-2xl"
              style={{ background: "rgba(0,0,0,0.3)" }}>
              🏁
            </div>
          )}
        </div>
      </div>

      {/* Streak badge */}
      {t.streak >= 3 && (
        <div className="relative z-10 flex justify-center">
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 0.65 }}
            className="inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-3 py-0.5 text-xs font-black text-white shadow-lg"
          >
            🔥 {t.streak}x
          </motion.span>
        </div>
      )}

      {/* Content area */}
      {t.phase === "exhausted" || !question ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <span className="text-5xl">🏁</span>
          <p className="text-lg font-black text-white">{ar ? "أنهيتم جميع الأسئلة!" : "All done!"}</p>
          <p className="text-sm font-bold text-white/60">
            {ar ? "انتظروا الفريق الآخر…" : "Waiting for the other team…"}
          </p>
        </div>
      ) : (
        <>
          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${team}-q-${t.qIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 rounded-xl border-2 bg-black/30 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-3.5"
              style={{ borderColor: `rgba(${rgb},0.28)` }}
            >
              <p
                className="text-center text-sm font-black leading-snug text-white sm:text-base lg:text-lg"
                dir={ar ? "rtl" : "ltr"}
              >
                {question.text}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Options 2×2 */}
          <div className="relative z-10 grid flex-1 grid-cols-2 content-start gap-1.5 sm:gap-2">
            {question.options.map((opt, idx) => {
              const s = optStyle(idx);
              const clickable = t.phase === "question" && t.selected === null && pending === null;
              const isPending = pending === idx;
              return (
                <motion.button
                  key={idx}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  animate={isPending ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={isPending ? { repeat: Infinity, duration: 0.36 } : { duration: 0.12 }}
                  onClick={() => clickable && onAnswer(idx)}
                  disabled={!clickable}
                  className="relative flex min-h-[48px] items-center gap-2 rounded-xl border px-2.5 py-2 text-start font-bold text-white transition-all sm:min-h-[52px] sm:px-3"
                  style={{
                    touchAction: "manipulation",
                    background: s.bg,
                    borderColor: isPending ? "rgba(255,255,255,0.85)" : s.border,
                    opacity: s.dim ? 0.38 : 1,
                    cursor: clickable ? "pointer" : "default",
                    boxShadow: isPending
                      ? `0 0 16px rgba(255,255,255,0.35), 0 3px 10px rgba(0,0,0,0.3)`
                      : "0 2px 8px rgba(0,0,0,0.25)",
                  }}
                >
                  {/* Letter badge */}
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-black leading-none sm:h-7 sm:w-7 sm:text-[13px]"
                    style={{
                      background: `rgba(${rgb},0.22)`,
                      borderColor: `rgba(${rgb},0.55)`,
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {letters[idx]}
                  </span>
                  <span
                    className="flex-1 text-xs font-black leading-snug sm:text-sm lg:text-base"
                    dir={ar ? "rtl" : "ltr"}
                  >
                    {opt}
                  </span>
                  {t.phase === "feedback" && idx === question.correct && (
                    <span className="text-lg text-green-400">✓</span>
                  )}
                  {t.phase === "feedback" && idx === t.selected && !t.correct && (
                    <span className="text-lg text-red-400">✗</span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Feedback strip */}
          <div className="relative z-10 h-6 text-center">
            {t.phase === "feedback" && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-black ${t.correct ? "text-green-300" : "text-red-300"}`}
              >
                {t.correct
                  ? (ar ? "ممتاز! ✨" : "Excellent! ✨")
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

// ─── Centre divider (VS + live scores) ───────────────────────────────────────
function CenterDivider({
  state, blueName, redName, ar,
}: {
  state: WameethClassState;
  blueName: string;
  redName: string;
  ar: boolean;
}) {
  const blueScore = state.teams.blue.score;
  const redScore  = state.teams.red.score;
  const leader: TeamId | null =
    blueScore > redScore ? "blue" : redScore > blueScore ? "red" : null;

  return (
    <div className="relative flex w-10 shrink-0 flex-col items-center justify-center gap-3 sm:w-14">
      {/* Vertical glow line */}
      <div
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{
          background: leader
            ? `linear-gradient(to bottom, transparent, rgba(${TEAM_CONFIG[leader].rgb},0.6) 40%, rgba(${TEAM_CONFIG[leader].rgb},0.6) 60%, transparent)`
            : "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.15) 60%, transparent)",
        }}
      />

      {/* VS badge */}
      <motion.div
        animate={{ scale: leader ? [1, 1.06, 1] : 1 }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-black text-white backdrop-blur-md sm:h-12 sm:w-12 sm:text-base"
        style={{
          borderColor: leader ? `rgba(${TEAM_CONFIG[leader].rgb},0.75)` : "rgba(255,255,255,0.25)",
          background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.14), rgba(10,10,30,0.92))",
          boxShadow: leader
            ? `0 0 18px rgba(${TEAM_CONFIG[leader].rgb},0.35)`
            : "none",
        }}
      >
        VS
      </motion.div>

      {/* Leading arrow */}
      <AnimatePresence mode="wait">
        {leader && (
          <motion.span
            key={leader}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: [1, 1.18, 1] }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ scale: { repeat: Infinity, duration: 0.9 } }}
            className="relative z-10 text-lg"
            style={{ color: `rgb(${TEAM_CONFIG[leader].rgb})` }}
          >
            {leader === "blue" ? "◀" : "▶"}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Countdown overlay ────────────────────────────────────────────────────────
function CountdownOverlay({ count, ar }: { count: number; ar: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-3xl border-2 border-amber-300/50 bg-black/70 px-10 py-6 text-white backdrop-blur-md"
        style={{ boxShadow: "0 0 50px rgba(247,201,72,0.35)" }}
      >
        <span className="text-sm font-black tracking-widest text-amber-200/90 sm:text-base">
          {ar ? "استعدوا…" : "Get ready…"}
        </span>
        <motion.span
          key={count}
          initial={{ scale: 1.8, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-7xl font-black text-amber-300 sm:text-8xl"
          style={{ textShadow: "0 0 30px rgba(247,201,72,0.8)", fontVariantNumeric: "tabular-nums" }}
        >
          {count}
        </motion.span>
      </motion.div>
    </div>
  );
}

// ─── Finished screen ──────────────────────────────────────────────────────────
function FinishedOverlay({
  state, blueName, redName, ar, onRematch, onExit,
}: {
  state: WameethClassState;
  blueName: string;
  redName: string;
  ar: boolean;
  onRematch: (swapSides: boolean) => void;
  onExit: () => void;
}) {
  const { winner } = state;
  const winnerName = winner === "blue" ? blueName : winner === "red" ? redName : null;
  const winnerRgb = winner && winner !== "draw" ? TEAM_CONFIG[winner].rgb : "247,201,72";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(247,201,72,0.2) 0%, rgba(0,0,0,0.85) 60%)" }}
      dir={ar ? "rtl" : "ltr"}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-lg rounded-3xl border border-amber-300/25 bg-[#0a1020]/96 p-6 text-center text-white shadow-2xl backdrop-blur-md"
      >
        {/* Trophy / draw icon */}
        {winner === "draw" ? (
          <>
            <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-amber-300/30 bg-white/8 text-4xl">🤝</div>
            <h2 className="mb-1 text-3xl font-black">{ar ? "تعادل رائع!" : "Great Draw!"}</h2>
          </>
        ) : (
          <>
            <motion.div
              animate={{ y: [0, -6, 0], scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-amber-300/45 bg-white/10 text-6xl shadow-[0_0_40px_rgba(217,165,33,0.4)]"
            >
              🏆
            </motion.div>
            <h2
              className="mb-1 text-4xl font-black leading-tight"
              style={{ color: `rgb(${winnerRgb})`, textShadow: `0 0 24px rgba(${winnerRgb},0.55)` }}
            >
              {winnerName}
            </h2>
            <p className="mb-3 text-lg font-black" style={{ color: "#f7c948" }}>
              {ar ? "🎉 يفوز بوميض الصف!" : "🎉 Wins Wameeth Class!"}
            </p>
          </>
        )}

        {/* Score cards */}
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {(["blue", "red"] as const).map((id) => {
            const won = state.winner === id;
            const cfg = TEAM_CONFIG[id];
            const tName = id === "blue" ? blueName : redName;
            const t = state.teams[id];
            return (
              <div
                key={id}
                className={`rounded-2xl p-3 text-center ${won ? "border-2 border-amber-300/55" : "border border-white/15"}`}
                style={{
                  background: won
                    ? `linear-gradient(145deg, rgba(${cfg.rgb},0.35), rgba(0,0,0,0.6))`
                    : `rgba(${cfg.rgb},0.1)`,
                  opacity: won ? 1 : 0.75,
                }}
              >
                <p className="mb-1 text-xs font-black text-white/85">{won ? "👑 " : ""}{tName}</p>
                <p
                  className="font-black text-white"
                  style={{ fontSize: won ? 40 : 32, textShadow: won ? "0 0 20px rgba(247,201,72,0.5)" : "none" }}
                >
                  {t.score}
                </p>
                <p className="mt-1 text-[11px] font-bold text-white/55">
                  {ar ? `${t.correctCount} صحيح` : `${t.correctCount} correct`}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mb-4 text-xs font-bold text-white/45">
          👏 {ar ? "منافسة رائعة — تصفيق للفريقين!" : "Great match — applause for both teams!"}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            onClick={() => onRematch(true)}
            className="w-full rounded-2xl py-3.5 text-base font-black"
            style={{
              background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
              color: "#1a2e1a",
              boxShadow: "0 12px 28px rgba(217,165,33,0.45)",
            }}
          >
            🔁 {ar ? "الجولة الثانية — تبادلوا الجهتين!" : "Round 2 — Swap Sides!"}
          </motion.button>
          <button
            onClick={() => onRematch(false)}
            className="w-full rounded-2xl border border-white/20 bg-white/8 py-3 text-sm font-black text-white/80"
          >
            🔄 {ar ? "العب مجدداً — نفس الجهتين" : "Play again, same sides"}
          </button>
          <button
            onClick={onExit}
            className="w-full rounded-2xl border border-white/12 py-2.5 text-sm font-bold text-white/50"
          >
            {ar ? "الخروج" : "Exit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Idle / pre-game screen ───────────────────────────────────────────────────
function IdleOverlay({
  setup, blueName, redName, blueOnRight, ar,
  onStart, onBlueName, onRedName,
}: {
  setup: WameethClassSetup;
  blueName: string;
  redName: string;
  blueOnRight: boolean;
  ar: boolean;
  onStart: () => void;
  onBlueName: (v: string) => void;
  onRedName: (v: string) => void;
}) {
  const title = setup.title || (ar ? "وميض الصف" : "Wameeth Class");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-3xl border border-amber-300/25 bg-[#080e24]/96 p-6 text-white shadow-2xl"
        dir={ar ? "rtl" : "ltr"}
      >
        <div className="mb-3 text-center text-5xl">⚡</div>
        <h1 className="mb-1 text-center text-2xl font-black">{ar ? "وميض الصف" : "Wameeth Class"}</h1>
        <p
          className="mx-auto mb-4 w-fit max-w-full truncate rounded-full border border-amber-300/30 bg-black/30 px-4 py-1 text-center text-sm font-black text-amber-200"
          title={title}
        >
          📖 {title}
        </p>

        {/* Team name inputs */}
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {(["blue", "red"] as const).map((id) => {
            const cfg = TEAM_CONFIG[id];
            const val = id === "blue" ? blueName : redName;
            const side = (id === "blue") === blueOnRight
              ? (ar ? "يمين" : "right")
              : (ar ? "يسار" : "left");
            return (
              <div key={id} className="flex flex-col gap-1">
                <span className="text-[11px] font-black" style={{ color: `rgb(${cfg.rgb})` }}>
                  {ar ? `الفريق — ${side} الشاشة` : `Team — ${side} side`}
                </span>
                <input
                  value={val}
                  onChange={(e) => id === "blue" ? onBlueName(e.target.value) : onRedName(e.target.value)}
                  maxLength={20}
                  className="w-full rounded-xl border bg-black/30 px-3 py-2 text-sm font-black text-white placeholder:text-white/30 focus:outline-none focus:ring-2"
                  style={{
                    borderColor: `rgba(${cfg.rgb},0.45)`,
                  }}
                  placeholder={cfg.label[ar ? "ar" : "en"]}
                  dir={ar ? "rtl" : "ltr"}
                />
              </div>
            );
          })}
        </div>

        {/* Info badges */}
        <div className="mb-4 flex flex-wrap justify-center gap-2 text-xs font-black text-white/65">
          <span className="rounded-full bg-white/10 px-3 py-1">
            📚 {setup.questions.length} {ar ? "سؤال لكل فريق" : "questions per team"}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">
            🔀 {ar ? "ترتيب عشوائي مختلف" : "different shuffle"}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">
            ⏱ {setup.duration} {ar ? "ث / سؤال" : "sec / Q"}
          </span>
        </div>

        <p className="mb-4 text-center text-sm font-bold leading-relaxed text-white/60">
          {ar
            ? "اعرض الشاشة أمام الصف — كل فريق يجيب على جانبه بشكل مستقل تماماً."
            : "Show this screen to the class — each team answers their side independently."}
        </p>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full rounded-2xl py-4 text-lg font-black"
          style={{
            background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
            color: "#1a2e1a",
            boxShadow: "0 12px 28px rgba(217,165,33,0.45), inset 0 2px 0 rgba(255,255,255,0.3)",
          }}
        >
          🚀 {ar ? "ابدأ اللعبة" : "Start Game"}
        </motion.button>
      </motion.div>
    </div>
  );
}

// ─── Main game component ──────────────────────────────────────────────────────
function WameethClassGame({
  setup, blueOnRight, onRematch, onExit,
}: {
  setup: WameethClassSetup;
  blueOnRight: boolean;
  onRematch: (swapSides: boolean) => void;
  onExit: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [state, dispatch] = useReducer(
    wameethClassReducer,
    undefined,
    () => createWameethClassState(setup.questions, setup.duration),
  );

  // Team names — editable in the idle overlay before the game starts
  const [blueName, setBlueName] = useState(ar ? "الفريق الأزرق" : "Blue Team");
  const [redName,  setRedName]  = useState(ar ? "الفريق الأحمر" : "Red Team");

  const [muted, setMuted] = useState(false);
  const soundRef = useRef<WameethClassSound | null>(null);
  const getSound = useCallback((): WameethClassSound => {
    if (!soundRef.current) soundRef.current = new WameethClassSound();
    return soundRef.current;
  }, []);
  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  // 1s tick drives both independent team timers
  useEffect(() => {
    if (state.status !== "countdown" && state.status !== "playing") return;
    const h = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(h);
  }, [state.status]);

  // Sound on countdown
  useEffect(() => {
    if (state.status === "countdown") getSound().playCountdown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.countdown]);

  // Sound on start / finish
  const prevStatus = useRef(state.status);
  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = state.status;
    if (prev === "countdown" && state.status === "playing") getSound().playStart();
    if (state.status === "finished") getSound().playWin();
  }, [state.status, getSound]);

  // Sound on answer impulse
  const lastImpulseId = useRef<number | null>(null);
  useEffect(() => {
    const imp = state.lastImpulse;
    if (!imp || imp.id === lastImpulseId.current) return;
    lastImpulseId.current = imp.id;
    if (imp.kind === "correct") getSound().playCorrect();
    else getSound().playWrong();
  }, [state.lastImpulse, getSound]);

  // Answer with a small brace delay (makes the tap feel physical)
  const [pending, setPending] = useState<Record<TeamId, number | null>>({ blue: null, red: null });
  const braceTimers = useRef<Record<TeamId, ReturnType<typeof setTimeout> | null>>({ blue: null, red: null });

  const handleAnswer = useCallback((team: TeamId, index: number) => {
    if (braceTimers.current[team] !== null) return;
    setPending((p) => ({ ...p, [team]: index }));
    braceTimers.current[team] = setTimeout(() => {
      braceTimers.current[team] = null;
      setPending((p) => ({ ...p, [team]: null }));
      dispatch({ type: "answer", team, index });
    }, 320);
  }, []);
  useEffect(() => () => {
    (["blue", "red"] as const).forEach((id) => {
      const h = braceTimers.current[id];
      if (h !== null) clearTimeout(h);
    });
  }, []);

  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
  };

  // Which physical side each team is on
  const blueTeam = (
    <TeamPanel
      team="blue" name={blueName} t={state.teams.blue}
      question={currentWameethQuestion(state, "blue")}
      qTotal={state.questions.length} duration={setup.duration}
      ar={ar} pending={pending.blue}
      onAnswer={(idx) => handleAnswer("blue", idx)}
    />
  );
  const redTeam = (
    <TeamPanel
      team="red" name={redName} t={state.teams.red}
      question={currentWameethQuestion(state, "red")}
      qTotal={state.questions.length} duration={setup.duration}
      ar={ar} pending={pending.red}
      onAnswer={(idx) => handleAnswer("red", idx)}
    />
  );

  const leftPanel  = blueOnRight ? redTeam  : blueTeam;
  const rightPanel = blueOnRight ? blueTeam : redTeam;

  return (
    <div
      className="flex min-h-screen select-none flex-col"
      style={{
        background:
          "radial-gradient(ellipse at 50% -5%, rgba(247,201,72,0.12) 0%, transparent 55%), " +
          "linear-gradient(160deg, #060b1a 0%, #0a1228 50%, #060b1a 100%)",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4"
        style={{ direction: ar ? "rtl" : "ltr" }}
      >
        <span
          className="truncate text-sm font-black text-amber-200/80 sm:text-base"
          title={setup.title}
        >
          ⚡ {setup.title || (ar ? "وميض الصف" : "Wameeth Class")}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="rounded-full border border-white/18 bg-black/35 p-2 text-white/70 backdrop-blur-sm"
            aria-label={muted ? "unmute" : "mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onExit}
            className="rounded-full border border-white/18 bg-black/35 p-2 text-white/70 backdrop-blur-sm"
            aria-label="exit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Split-screen arena */}
      <div
        className="flex flex-1 items-stretch gap-2 px-2 pb-2 sm:gap-3 sm:px-3 sm:pb-3"
        style={{ direction: "ltr" }}
      >
        {leftPanel}
        <CenterDivider state={state} blueName={blueName} redName={redName} ar={ar} />
        {rightPanel}
      </div>

      {/* Overlays */}
      {state.status === "countdown" && <CountdownOverlay count={state.countdown} ar={ar} />}
      {state.status === "finished" && (
        <FinishedOverlay
          state={state} blueName={blueName} redName={redName} ar={ar}
          onRematch={onRematch} onExit={onExit}
        />
      )}
      {/* Idle overlay — shown before game starts; teacher names the teams */}
      {state.status === "idle" && (
        <div className="fixed inset-0 z-50">
          <IdleOverlay
            setup={setup}
            blueName={blueName} redName={redName}
            blueOnRight={blueOnRight}
            ar={ar}
            onStart={() => dispatch({ type: "start" })}
            onBlueName={setBlueName}
            onRedName={setRedName}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function WameethClass() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const [setup] = useState<WameethClassSetup | null>(readSetup);
  const [round, setRound] = useState(0);
  const [swapped, setSwapped] = useState(false);
  // In Arabic, blue defaults to the RIGHT (RTL reading order).
  const blueOnRight = ar !== swapped;

  if (!setup) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-6xl">⚡</div>
          <h2 className="text-2xl font-black">{ar ? "وميض الصف" : "Wameeth Class"}</h2>
          <p className="max-w-sm text-muted-foreground">
            {ar
              ? "افتح صفحة إنشاء وميض، اختر واجباً ثم اضغط «وميض الصف»."
              : "Open the Wameeth create page, pick a quiz, then tap «Wameeth Class»."}
          </p>
          <button
            onClick={() => setLocation("/game/wameeth/create")}
            className="rounded-xl px-6 py-3 font-bold text-white"
            style={{ background: "linear-gradient(135deg,#f7c948,#d97706)", color: "#1a1008" }}
          >
            {ar ? "اختر مسابقة" : "Pick a quiz"}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* key=round remounts a fresh engine on rematch */}
      <WameethClassGame
        key={round}
        setup={setup}
        blueOnRight={blueOnRight}
        onRematch={(swapSides) => {
          if (swapSides) setSwapped((s) => !s);
          setRound((r) => r + 1);
        }}
        onExit={() => setLocation("/game/wameeth/create")}
      />
    </Layout>
  );
}
