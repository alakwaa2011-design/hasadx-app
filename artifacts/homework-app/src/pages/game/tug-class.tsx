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
import { useEffect, useReducer, useRef, useState, useCallback, type CSSProperties } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { Volume2, VolumeX } from "lucide-react";
import {
  TugSoundEngine, PowerPullFlash, TimerRing,
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
// Broadcast ticker — a slim sports-news strip pinned under the arena. It
// auto-comments on the match (control shifts, streaks, danger, finishes) so
// the whole class reads the story like a live TV feed.
// ─────────────────────────────────────────────────────────────────────────────
interface TickerEvent { id: number; text: string; team: TeamId | null }

function BroadcastTicker({ event, ar }: { event: TickerEvent | null; ar: boolean }) {
  return (
    <div
      className="relative z-30 mx-auto flex h-8 w-full max-w-4xl items-center gap-2 overflow-hidden rounded-full border border-white/12 bg-black/55 px-2 backdrop-blur-md sm:h-9"
      style={{ direction: ar ? "rtl" : "ltr" }}
    >
      {/* LIVE chip */}
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white sm:text-[11px]">
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-white"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
        />
        {ar ? "مباشر" : "LIVE"}
      </span>
      <div className="relative h-full min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={event?.id ?? "idle"}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0 flex items-center truncate text-xs font-black sm:text-sm"
            style={{
              color: event?.team === "blue" ? "#93c5fd" : event?.team === "red" ? "#fca5a5" : "rgba(255,255,255,0.85)",
            }}
          >
            {event?.text ?? (ar ? "بث مباشر من ملعب شدّ الحبل…" : "Live from the tug-of-war stadium…")}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kickoff board — the countdown lives INSIDE the stadium (a jumbotron panel
// over the pitch) instead of a full-screen overlay, so the pre-match show
// (teams sprinting in, rope dropping) stays visible behind it.
// ─────────────────────────────────────────────────────────────────────────────
function KickoffBoard({ count, ar }: { count: number; ar: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center pt-14 sm:pt-16">
      <motion.div
        initial={{ opacity: 0, y: -18, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-amber-300/50 bg-black/60 px-7 py-2.5 backdrop-blur-md sm:px-9 sm:py-3"
        style={{ boxShadow: "0 0 44px rgba(247,201,72,0.35), inset 0 1px 0 rgba(255,255,255,0.18)" }}
      >
        <span className="text-[11px] font-black tracking-wide text-amber-200/90 sm:text-sm">
          {ar ? "استعدوا…" : "Get ready…"}
        </span>
        <motion.span
          key={count}
          initial={{ scale: 1.7, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="text-5xl font-black leading-none text-amber-300 sm:text-6xl"
          style={{ textShadow: "0 0 26px rgba(247,201,72,0.75)", fontVariantNumeric: "tabular-nums" }}
        >
          {count}
        </motion.span>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clutch mode — when the rope crosses ±80 the whole broadcast goes cinematic:
// letterbox bars crawl in and the dugouts desaturate, leaving the arena as the
// only full-colour thing on screen. "This moment is historic."
// ─────────────────────────────────────────────────────────────────────────────
function ClutchBars({ ar }: { ar: boolean }) {
  return (
    <>
      <motion.div
        initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex h-7 items-center justify-center bg-black sm:h-9"
      >
        <motion.span
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
          className="text-[11px] font-black tracking-widest text-amber-300 sm:text-sm"
        >
          ⚡ {ar ? "لحظة الحسم" : "CLUTCH TIME"} ⚡
        </motion.span>
      </motion.div>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-7 bg-black sm:h-9"
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comeback flare — a team that was one pull from losing strings 3 correct
// answers: their side of the screen ignites in team colour for ~2 seconds.
// The strongest emotion in competitive play is the comeback; celebrate it.
// ─────────────────────────────────────────────────────────────────────────────
function ComebackFlare({ team, fromRight, ar }: { team: TeamId; fromRight: boolean; ar: boolean }) {
  const rgb = TEAM_RGB[team];
  const edge = fromRight ? "88%" : "12%";
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {/* Side blaze */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 2.2, times: [0, 0.22, 1], ease: "easeOut" }}
        style={{ background: `radial-gradient(ellipse at ${edge} 60%, rgba(${rgb},0.5), transparent 52%)` }}
      />
      {/* Rising flame streaks on that side */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="absolute bottom-0 w-2 rounded-full"
          style={{
            [fromRight ? "right" : "left"]: `${5 + i * 5.5}%`,
            height: `${30 + (i % 3) * 14}%`,
            background: `linear-gradient(to top, rgba(${rgb},0.85), rgba(251,191,36,0.5), transparent)`,
            filter: "blur(3px)",
          } as CSSProperties}
          initial={{ opacity: 0, y: 90, scaleY: 0.4 }}
          animate={{ opacity: [0, 1, 0], y: [90, -50], scaleY: [0.4, 1.15] }}
          transition={{ duration: 1.7, delay: i * 0.09, ease: "easeOut" }}
        />
      ))}
      {/* Stamp */}
      <motion.div
        className="absolute top-1/3 flex -translate-y-1/2 items-center justify-center"
        style={{ [fromRight ? "right" : "left"]: "6%" } as CSSProperties}
        initial={{ opacity: 0, scale: 0.5, rotate: fromRight ? 6 : -6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.12, 1, 1] }}
        transition={{ duration: 2.1, times: [0, 0.2, 0.8, 1] }}
      >
        <span
          className="rounded-2xl border-2 bg-black/60 px-5 py-2 text-2xl font-black text-white backdrop-blur-md sm:text-4xl"
          style={{ borderColor: `rgba(${rgb},0.8)`, textShadow: `0 0 24px rgba(${rgb},0.9)` }}
        >
          🔥 {ar ? "عودة أسطورية!" : "COMEBACK!"}
        </span>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stadium fireworks — the celebration happens INSIDE the stadium sky (over the
// arena), not as page confetti: rockets burst in winner colour + gold.
// ─────────────────────────────────────────────────────────────────────────────
const FIREWORK_BURSTS = [
  { x: 20, y: 30, delay: 0.2, size: 52 },
  { x: 72, y: 22, delay: 0.95, size: 62 },
  { x: 45, y: 16, delay: 1.7, size: 56 },
  { x: 86, y: 34, delay: 2.45, size: 46 },
  { x: 10, y: 20, delay: 3.1, size: 50 },
];

function StadiumFireworks({ team }: { team: TeamId }) {
  const rgb = TEAM_RGB[team];
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {FIREWORK_BURSTS.map((b, bi) => (
        <div key={bi} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {/* Core flash */}
          <motion.span
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "#fff7d6", boxShadow: `0 0 18px rgba(${rgb},0.9)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.6, 0.6] }}
            transition={{ duration: 0.5, delay: b.delay, repeat: Infinity, repeatDelay: 3.4 }}
          />
          {/* Radial sparks */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const gold = i % 2 === 0;
            return (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{ background: gold ? "#FCD34D" : `rgb(${rgb})` }}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: [0, Math.cos(a) * b.size],
                  y: [0, Math.sin(a) * b.size + 14],
                  scale: [1, 1, 0.4],
                }}
                transition={{ duration: 1.15, delay: b.delay + 0.06, ease: "easeOut", repeat: Infinity, repeatDelay: 2.75 }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mega Pull — a 5-answer streak triggers the big cinematic: shock rings blast
// out from the arena and the whole class hears the slam.
// ─────────────────────────────────────────────────────────────────────────────
function MegaPullBlast({ team, ar }: { team: TeamId; ar: boolean }) {
  const rgb = TEAM_RGB[team];
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border-4"
          style={{ borderColor: `rgba(${rgb},0.7)` }}
          initial={{ width: 60, height: 60, opacity: 0.9 }}
          animate={{ width: "160vmax", height: "160vmax", opacity: 0 }}
          transition={{ duration: 1.1, delay: i * 0.15, ease: "easeOut" }}
        />
      ))}
      <motion.div
        initial={{ opacity: 0.5 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }}
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle, rgba(${rgb},0.35), transparent 60%)` }}
      />
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.18, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, times: [0, 0.2, 0.75, 1] }}
        className="rounded-3xl border-2 bg-black/65 px-8 py-3 text-3xl font-black text-white backdrop-blur-md sm:text-5xl"
        style={{ borderColor: `rgba(${rgb},0.85)`, textShadow: `0 0 30px rgba(${rgb},1)` }}
      >
        ⚡ {ar ? "الشدّة الكبرى!" : "MEGA PULL!"}
      </motion.span>
    </div>
  );
}

// The referee's whistle stamp — flashes over the pitch at kickoff.
function KickoffFlash({ ar }: { ar: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.15, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-3xl border-2 border-white/40 bg-black/55 px-9 py-3 backdrop-blur-md"
        style={{ boxShadow: "0 0 60px rgba(74,222,128,0.5)" }}
      >
        <span className="text-3xl font-black text-green-300 sm:text-5xl" style={{ textShadow: "0 0 30px rgba(74,222,128,0.8)" }}>
          {ar ? "🏁 انطلقوا!" : "🏁 GO!"}
        </span>
      </motion.div>
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
  team, name, t, question, qTotal, duration, inDanger, onAnswer, ar, side, pending,
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
  /** Index locked during the anticipation beat (team digging in), else null. */
  pending: number | null;
}) {
  const isBlue = team === "blue";
  const rgb = TEAM_RGB[team];
  const feedbackKey = `${t.qIndex}-${t.phase}`;
  const letters = ar ? OPTION_LETTERS_AR : OPTION_LETTERS_EN;
  const reduceMotion = useReducedMotion();
  // Idle beckon: nobody has answered for 8+ seconds → the zone waves for attention.
  const idle = t.phase === "question" && t.selected === null && pending === null && duration - t.timeLeft >= 8;
  const flameCount = t.streak >= 3 && !reduceMotion ? Math.min(7, 2 + t.streak) : 0;

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
      {/* Streak flames: 3+ correct in a row sets the dugout floor ablaze in
          team colour — the fire grows with the streak. */}
      {flameCount > 0 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-0 z-10 h-14 overflow-hidden">
          {Array.from({ length: flameCount }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute bottom-[-12px] rounded-full"
              style={{
                left: `${6 + (i * 88) / flameCount}%`,
                width: 22 + (i % 3) * 8,
                height: 40 + (i % 2) * 14,
                background: `radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.85), rgba(${rgb},0.55) 55%, transparent 75%)`,
                filter: "blur(5px)",
                transformOrigin: "bottom center",
              }}
              animate={{ scaleY: [0.7, 1.15, 0.85, 1.05, 0.7], opacity: [0.5, 0.9, 0.65, 0.85, 0.5] }}
              transition={{ repeat: Infinity, duration: 0.9 + (i % 3) * 0.25, delay: i * 0.11 }}
            />
          ))}
        </div>
      )}
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
            <p className="text-[11px] font-bold text-white/70">
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
            {/* Idle beckon — the zone waves at its team after 8 quiet seconds */}
            <AnimatePresence>
              {idle && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute -bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-0.5 text-[11px] font-black text-white shadow-lg"
                  style={{ background: `rgba(${rgb},0.92)`, borderColor: "rgba(255,255,255,0.35)" }}
                >
                  <motion.span animate={{ rotate: [0, 18, -8, 18, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
                    👋
                  </motion.span>
                  {ar ? "بانتظار إجابتكم!" : "Waiting for you!"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Options 2×2 — أ/ب/ج/د letter badges; the grid follows the zone's
              direction, so in Arabic options flow right → left naturally. */}
          <div className="relative z-20 grid flex-1 grid-cols-2 content-start gap-1.5 sm:gap-2">
            {question.options.map((opt, idx) => {
              const s = optionStyle(idx);
              const clickable = t.phase === "question" && t.selected === null && pending === null;
              const isPending = pending === idx;
              return (
                <motion.button
                  key={idx}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  animate={isPending ? { scale: [1, 1.045, 1] } : { scale: 1 }}
                  transition={isPending ? { repeat: Infinity, duration: 0.34 } : { duration: 0.15 }}
                  onClick={() => clickable && onAnswer(idx)}
                  disabled={!clickable}
                  className="relative flex min-h-[46px] items-center gap-2 rounded-lg border px-2 py-1.5 text-start font-bold text-white transition-all sm:min-h-[50px] sm:px-2.5"
                  style={{
                    touchAction: "manipulation",
                    background: s.bg,
                    borderColor: isPending ? "rgba(255,255,255,0.9)" : s.border,
                    opacity: s.dim || (pending !== null && !isPending) ? 0.4 : 1,
                    cursor: clickable ? "pointer" : "default",
                    boxShadow: isPending
                      ? "0 0 18px rgba(255,255,255,0.45), 0 3px 10px rgba(0,0,0,0.28)"
                      : s.dim ? "none" : "0 3px 10px rgba(0,0,0,0.28)",
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
            {pending !== null && t.phase === "question" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 0.4 }}
                className="text-sm font-black text-amber-200"
              >
                {ar ? "💪 يشدّون…" : "💪 Pulling…"}
              </motion.p>
            )}
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
  setup, blueName, redName, blueOnRight, onRematch,
}: {
  setup: ClassSetup;
  blueName: string;
  redName: string;
  /** Which PHYSICAL side blue plays on — flips on a swap-sides rematch. */
  blueOnRight: boolean;
  /** Restart; swapSides=true flips the two teams' physical sides (round 2 ritual). */
  onRematch: (swapSides: boolean) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const reduceMotion = useReducedMotion();
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

  // ── Broadcast ticker: auto-commentary on the match ──
  const [tickerEvent, setTickerEvent] = useState<TickerEvent | null>(null);
  const tickerSeq = useRef(0);
  const pushTicker = useCallback((text: string, team: TeamId | null = null) => {
    tickerSeq.current += 1;
    setTickerEvent({ id: tickerSeq.current, text, team });
  }, []);

  // Countdown beeps + kickoff whistle + background music + crowd bed.
  const prevStatusRef = useRef<ClassState["status"]>(state.status);
  useEffect(() => {
    if (state.status === "countdown") getSound().playCountdownBeep(state.countdown);
  }, [state.status, state.countdown, getSound]);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;
    if (prev === "countdown" && state.status === "playing") {
      // Referee whistle = kickoff. The crowd bed fades in with the match.
      getSound().playWhistle();
      getSound().startBackground();
      pushTicker(ar ? "🏁 انطلقت المباراة — شدّوا!" : "🏁 The match is ON — pull!");
      setGoFlash(true);
      const h = setTimeout(() => setGoFlash(false), 1000);
      return () => clearTimeout(h);
    }
    if (state.status === "finished") {
      getSound().stopBackground();
      if (state.winner === "draw") getSound().playApplause();
      else getSound().playWin();
    }
    return undefined;
  }, [state.status, state.winner, getSound, pushTicker, ar]);

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
  useEffect(() => { getSound().setUrgency(false); }, [getSound]);

  const teamNameOf = useCallback(
    (t: TeamId) => (t === "blue" ? blueName : redName),
    [blueName, redName],
  );

  // Ticker: control shifts (with hysteresis so it doesn't spam near centre).
  const controlRef = useRef<TeamId | null>(null);
  useEffect(() => {
    if (state.status !== "playing") return;
    const leader: TeamId | null = state.rope < 44 ? "blue" : state.rope > 56 ? "red" : controlRef.current;
    if (leader && leader !== controlRef.current) {
      const hadControl = controlRef.current !== null;
      controlRef.current = leader;
      pushTicker(
        hadControl
          ? (ar ? `⚡ ${teamNameOf(leader)} يخطف السيطرة!` : `⚡ ${teamNameOf(leader)} steals control!`)
          : (ar ? `💪 ${teamNameOf(leader)} يتقدّم!` : `💪 ${teamNameOf(leader)} takes the lead!`),
        leader,
      );
    }
  }, [state.rope, state.status, pushTicker, teamNameOf, ar]);

  // Ticker: hot streaks (3, 5, 7…) and finished question routes.
  const streakRef = useRef<Record<TeamId, number>>({ blue: 0, red: 0 });
  const exhaustedRef = useRef<Record<TeamId, boolean>>({ blue: false, red: false });
  useEffect(() => {
    (["blue", "red"] as const).forEach((id) => {
      const t = state.teams[id];
      const prevStreak = streakRef.current[id];
      streakRef.current[id] = t.streak;
      if (t.streak >= 3 && t.streak > prevStreak && t.streak % 2 === 1) {
        pushTicker(
          ar ? `🔥 سلسلة ${t.streak} إجابات صحيحة لـ${teamNameOf(id)}!` : `🔥 ${teamNameOf(id)} is on a ${t.streak}-answer streak!`,
          id,
        );
      }
      if (t.phase === "exhausted" && !exhaustedRef.current[id]) {
        exhaustedRef.current[id] = true;
        pushTicker(
          ar ? `🏁 ${teamNameOf(id)} أنهى جميع أسئلته!` : `🏁 ${teamNameOf(id)} finished all their questions!`,
          id,
        );
      }
    });
  }, [state.teams, pushTicker, teamNameOf, ar]);

  // Ticker: a team is one pull away from losing. Also arms the comeback flag —
  // if that team then strings 3 correct answers, their side ignites.
  const dangerRef = useRef<TeamId | null>(null);
  const comebackArmedRef = useRef<Record<TeamId, boolean>>({ blue: false, red: false });
  useEffect(() => {
    if (dangerSide && dangerSide !== dangerRef.current) {
      comebackArmedRef.current[dangerSide] = true;
      pushTicker(
        ar ? `😱 ${teamNameOf(dangerSide)} على حافة الخسارة!` : `😱 ${teamNameOf(dangerSide)} is on the edge!`,
        dangerSide,
      );
    }
    dangerRef.current = dangerSide;
  }, [dangerSide, pushTicker, teamNameOf, ar]);

  // ── Anticipation beat: tapping an answer LOCKS it, the team digs in for
  // ~450ms (crouch + creak + pulsing card), THEN the pull resolves. Charging
  // the moment makes the payoff hit much harder. The engine ignores any
  // dispatch that lands after a phase change, so the delay is safe.
  const [braces, setBraces] = useState<Record<TeamId, number | null>>({ blue: null, red: null });
  const braceTimers = useRef<Record<TeamId, ReturnType<typeof setTimeout> | null>>({ blue: null, red: null });
  const handleAnswer = useCallback((team: TeamId, index: number) => {
    if (braceTimers.current[team] !== null) return;
    setBraces((prev) => ({ ...prev, [team]: index }));
    getSound().playBrace();
    braceTimers.current[team] = setTimeout(() => {
      braceTimers.current[team] = null;
      setBraces((prev) => ({ ...prev, [team]: null }));
      dispatch({ type: "answer", team, index });
    }, 450);
  }, [getSound]);
  useEffect(() => () => {
    (["blue", "red"] as const).forEach((id) => {
      const h = braceTimers.current[id];
      if (h !== null) clearTimeout(h);
    });
  }, []);

  // Mega Pull: a streak of 5 → full-screen shock rings + slam.
  const [megaPull, setMegaPull] = useState<{ team: TeamId; id: number } | null>(null);
  const megaSeq = useRef(0);
  const megaPrevStreak = useRef<Record<TeamId, number>>({ blue: 0, red: 0 });
  useEffect(() => {
    (["blue", "red"] as const).forEach((id) => {
      const s = state.teams[id].streak;
      const prev = megaPrevStreak.current[id];
      megaPrevStreak.current[id] = s;
      if (s === 5 && prev < 5) {
        megaSeq.current += 1;
        setMegaPull({ team: id, id: megaSeq.current });
        getSound().playPowerPull();
        pushTicker(
          ar ? `⚡ الشدّة الكبرى! ${teamNameOf(id)} لا يُوقَف!` : `⚡ MEGA PULL! ${teamNameOf(id)} is unstoppable!`,
          id,
        );
      }
    });
  }, [state.teams, pushTicker, teamNameOf, getSound, ar]);
  useEffect(() => {
    if (!megaPull) return;
    const h = setTimeout(() => setMegaPull(null), 1700);
    return () => clearTimeout(h);
  }, [megaPull]);

  // Comeback flare: an armed team reaches a 3-streak → cinematic side blaze.
  const [comeback, setComeback] = useState<{ team: TeamId; id: number } | null>(null);
  const comebackSeq = useRef(0);
  useEffect(() => {
    if (state.status !== "playing") return;
    (["blue", "red"] as const).forEach((id) => {
      if (state.teams[id].streak >= 3 && comebackArmedRef.current[id]) {
        comebackArmedRef.current[id] = false;
        comebackSeq.current += 1;
        setComeback({ team: id, id: comebackSeq.current });
        getSound().playBoost();
        pushTicker(
          ar ? `🔥 عودة أسطورية من ${teamNameOf(id)}!` : `🔥 Legendary comeback by ${teamNameOf(id)}!`,
          id,
        );
      }
    });
  }, [state.teams, state.status, pushTicker, teamNameOf, getSound, ar]);
  useEffect(() => {
    if (!comeback) return;
    const h = setTimeout(() => setComeback(null), 2400);
    return () => clearTimeout(h);
  }, [comeback]);

  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
    if (s.muted) { s.stopBackground(); }
    else if (state.status === "playing") { s.startBackground(); }
  };

  // ── Match-star stats (presentational only; engine untouched): best streak
  // and correct-answer counts per team, shown as TV cards at the ceremony. ──
  const statsRef = useRef({ best: { blue: 0, red: 0 }, correct: { blue: 0, red: 0 } });
  const statsPrevPhase = useRef<Record<TeamId, TeamState["phase"]>>({ blue: "question", red: "question" });
  useEffect(() => {
    (["blue", "red"] as const).forEach((id) => {
      const t = state.teams[id];
      if (t.streak > statsRef.current.best[id]) statsRef.current.best[id] = t.streak;
      if (t.phase === "feedback" && statsPrevPhase.current[id] !== "feedback" && t.correct) {
        statsRef.current.correct[id] += 1;
      }
      statsPrevPhase.current[id] = t.phase;
    });
  }, [state.teams]);

  const impulse: TugImpulse | null = state.lastImpulse;
  const teamName = (t: TeamId) => (t === "blue" ? blueName : redName);
  const isPulling = state.status === "playing";
  const title = setup.title || (ar ? "مسابقة شدّ الحبل" : "Tug of War Match");

  // The base scene draws blue on the LEFT; mirror it whenever blue should play
  // on the physical RIGHT (Arabic reading order, or after a side swap).
  const mirror = blueOnRight ? { transform: "scaleX(-1)" as const } : undefined;

  const blueZone = (
    <TeamZone
      team="blue" name={blueName} t={state.teams.blue}
      question={currentQuestion(state, "blue")}
      qTotal={state.questions.length}
      duration={setup.duration} ar={ar}
      side={blueOnRight ? "right" : "left"}
      inDanger={dangerSide === "blue"}
      pending={braces.blue}
      onAnswer={(index) => handleAnswer("blue", index)}
    />
  );
  const redZone = (
    <TeamZone
      team="red" name={redName} t={state.teams.red}
      question={currentQuestion(state, "red")}
      qTotal={state.questions.length}
      duration={setup.duration} ar={ar}
      side={blueOnRight ? "left" : "right"}
      inDanger={dangerSide === "red"}
      pending={braces.red}
      onAnswer={(index) => handleAnswer("red", index)}
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
      {impulse?.kind === "win" && <PowerPullFlash key={impulse.id} team={impulse.team} />}
      {/* Cinematic letterbox while a team is one pull from the wall */}
      <AnimatePresence>{dangerSide && <ClutchBars ar={ar} />}</AnimatePresence>
      {comeback && (
        <ComebackFlare
          key={comeback.id}
          team={comeback.team}
          fromRight={comeback.team === "blue" ? blueOnRight : !blueOnRight}
          ar={ar}
        />
      )}
      {megaPull && <MegaPullBlast key={megaPull.id} team={megaPull.team} ar={ar} />}

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
          {/* Fireworks burst in the STADIUM sky — the party happens inside the
              game world, not as page confetti on top of it. */}
          {state.status === "finished" && state.winner && state.winner !== "draw" && !reduceMotion && (
            <StadiumFireworks team={state.winner as TeamId} />
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
                intro={state.status === "idle" ? "waiting" : state.status === "countdown" ? "run" : undefined}
                brace={braces.blue !== null ? "blue" : braces.red !== null ? "red" : null}
              />
            </div>
            <div className="pb-1" style={mirror}>
              <TugPowerMeter position={state.rope} />
            </div>
            {/* Broadcast ticker — live auto-commentary under the pitch */}
            {state.status !== "finished" && (
              <div className="pb-1.5 pt-1">
                <BroadcastTicker event={tickerEvent} ar={ar} />
              </div>
            )}
          </div>
          {/* In-stadium kickoff: countdown jumbotron + referee whistle stamp,
              shown over the pitch while the teams sprint in behind them. */}
          {state.status === "countdown" && <KickoffBoard count={state.countdown} ar={ar} />}
          {goFlash && <KickoffFlash ar={ar} />}
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

              {/* ── Match-star cards: every team leaves with a highlight, even
                    the losers — the TV cards flip in one after the other. ── */}
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                {(() => {
                  const { best, correct } = statsRef.current;
                  const streakTeam: TeamId = best.blue >= best.red ? "blue" : "red";
                  const streakVal = Math.max(best.blue, best.red);
                  const cards = [
                    {
                      icon: "🔥",
                      label: ar ? "أطول سلسلة" : "Longest streak",
                      value: streakVal > 1 ? `${teamName(streakTeam)} · ${streakVal}` : "—",
                      rgb: streakVal > 1 ? TEAM_RGB[streakTeam] : "255,255,255",
                    },
                    {
                      icon: "🎯",
                      label: ar ? "الإجابات الصحيحة" : "Correct answers",
                      value: ar
                        ? `الأزرق ${correct.blue} · الأحمر ${correct.red}`
                        : `Blue ${correct.blue} · Red ${correct.red}`,
                      rgb: "247,201,72",
                    },
                  ];
                  return cards.map((c, i) => (
                    <motion.div
                      key={c.label}
                      initial={{ opacity: 0, rotateY: -70 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: 0.5 + i * 0.22, duration: 0.5, ease: "easeOut" }}
                      className="rounded-2xl border px-3 py-2.5 text-center"
                      style={{
                        borderColor: `rgba(${c.rgb},0.4)`,
                        background: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(0,0,0,0.25))",
                      }}
                    >
                      <p className="text-lg leading-none">{c.icon}</p>
                      <p className="mt-1 text-[11px] font-black text-white/60">{c.label}</p>
                      <p className="mt-0.5 truncate text-sm font-black text-white">{c.value}</p>
                    </motion.div>
                  ));
                })()}
              </div>

              {/* Sportsmanship beat */}
              <p className="mb-3 text-xs font-bold text-white/50">
                👏 {ar ? "تصفيق للفريقين — منافسة رائعة!" : "A round of applause for both teams!"}
              </p>

              <div className="flex flex-col gap-2.5">
                {/* Round 2 ritual: same match, sides swapped — like every real sport */}
                <motion.button whileTap={{ scale: 0.97 }}
                  animate={{ scale: [1, 1.015, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  onClick={() => onRematch(true)}
                  className="w-full rounded-2xl py-3.5 text-base font-black"
                  style={{
                    background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
                    color: "#1a2e1a",
                    boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
                  }}>
                  🔁 {ar ? "الجولة الثانية — تبادلوا الجهتين!" : "Round 2 — Swap Sides!"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => onRematch(false)}
                  className="w-full rounded-2xl border border-white/25 bg-white/8 py-3 text-sm font-black text-white/85 backdrop-blur-sm">
                  🔄 {ar ? "العب مجدداً بنفس الجهتين" : "Play again, same sides"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── THE DUGOUTS: pinned to the far EDGES of the screen with a wide
                centre field between them, so two/three students can stand at
                each side of the board without crowding each other. Zone sides
                always match the (possibly mirrored) scene above. ── */
          <div
            className="flex w-full flex-1 items-stretch gap-2 px-2 pb-2 pt-2 sm:gap-3 sm:px-3 sm:pb-3"
            style={{
              // Clutch mode: the dugouts fall out of colour — every eye goes to
              // the arena, the only fully-saturated thing left on screen.
              filter: dangerSide ? "saturate(0.5) brightness(0.88)" : "none",
              transition: "filter 0.6s ease",
            }}
          >
            {/* Phones: zones flex to fit. sm+: fixed width pinned to the screen
                edges, with ALL remaining space becoming the centre field. */}
            <div className="flex min-w-0 flex-1 sm:flex-none sm:w-[clamp(300px,40vw,540px)]">
              {blueOnRight ? redZone : blueZone}
            </div>
            <div className="w-10 shrink-0 sm:w-auto sm:min-w-[60px] sm:flex-1">
              <CenterField rope={state.rope} blueOnRight={blueOnRight} />
            </div>
            <div className="flex min-w-0 flex-1 sm:flex-none sm:w-[clamp(300px,40vw,540px)]">
              {blueOnRight ? blueZone : redZone}
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
                ? `اعرض الشاشة أمام الصف وقسّم الطلاب لفريقين: الأزرق ${blueOnRight ? "يمين" : "يسار"} الشاشة والأحمر ${blueOnRight ? "يسارها" : "يمينها"}. كلا الفريقين يلعب كل الأسئلة، لكن بترتيب عشوائي مختلف ومؤقت ووتيرة مستقلة!`
                : `Show this screen to the class and split students into two teams: blue on the ${blueOnRight ? "right" : "left"}, red on the ${blueOnRight ? "left" : "right"}. Both teams play all the questions — each in its own random order, timer and pace!`}
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
  // In Arabic blue defaults to the physical RIGHT (RTL reading order); a
  // "Round 2 — swap sides" rematch flips both teams to the other side.
  const [swapped, setSwapped] = useState(false);
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
      {/* key = round → a rematch remounts a fresh engine with the same questions */}
      <ClassGame key={round} setup={setup} blueName={blueName} redName={redName}
        blueOnRight={ar !== swapped}
        onRematch={(swapSides) => {
          if (swapSides) setSwapped((s) => !s);
          setRound((r) => r + 1);
        }} />
    </Layout>
  );
}
