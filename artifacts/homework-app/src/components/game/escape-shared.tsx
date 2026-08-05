// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — shared audio + visual building blocks for the escape room.
//
// Used by BOTH modes:
//   • escape-class.tsx — cooperative run on the classroom screen.
//   • escape-play.tsx  — individual run on each student's device.
//
// Identity: Hasaad gold (#F7C948 / #D9A521) glowing inside a deep midnight
// vault (#0b1220 → #131c33). Everything is SVG/CSS/Web Audio — no assets.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  currentQuestion, escapeProgress, revealedCode,
  type EscapeAction, type EscapeState, type LockState, type LockType,
} from "@/lib/escape-engine";

// ═════════════════════════════════════════════════════════════════════════════
// SOUND ENGINE — synthesized vault atmosphere (same pattern as TugSoundEngine)
// ═════════════════════════════════════════════════════════════════════════════
export class EscapeSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem("escape-muted") === "1"; } catch (_) {}
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private getDest(): AudioNode {
    const ctx = this.getCtx();
    if (!this.compressor) {
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.ratio.value = 5;
      this.compressor.connect(ctx.destination);
    }
    return this.compressor;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.13, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.getDest());
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  }

  private freqRamp(f0: number, f1: number, dur: number, type: OscillatorType = "sine", vol = 0.13, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.getDest());
      osc.type = type;
      osc.frequency.setValueAtTime(f0, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), ctx.currentTime + delay + dur);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  }

  private noise(dur: number, vol: number, delay = 0, lowpass?: number) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const size = Math.ceil(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = lowpass ? "lowpass" : "highpass";
      f.frequency.value = lowpass ?? 5000;
      src.connect(f); f.connect(g); g.connect(this.getDest());
      g.gain.setValueAtTime(vol, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay); src.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem("escape-muted", m ? "1" : "0"); } catch (_) {}
    if (m) { this.stopAmbient(); this.stopMusic(); }
  }

  // ── MUSIC: driving heist-style loop — pulsing minor bassline, urgent
  //    arpeggio and ticking hats. Doubles the pace in the final minute. ──
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicFast = false;

  /** 16-step pattern in E minor. One step ≈ a 16th note. */
  private playMusicStep(step: number) {
    if (this.muted) return;
    const s = step % 32;
    // Bass pulse — four-on-the-floor with an octave jump every second bar.
    if (s % 4 === 0) {
      const f = s >= 16 && s % 8 === 4 ? 82.4 * 2 : 82.4; // E2 / E3
      this.tone(f, 0.16, "square", 0.055);
      this.freqRamp(150, 60, 0.07, "sine", 0.09); // kick thump
    }
    // Ticking hats on off-beats.
    if (s % 2 === 0) this.noise(0.015, s % 8 === 6 ? 0.045 : 0.022);
    // Arpeggio: E minor riff cycling across two bars (heist tension).
    const riff = [164.8, 196, 246.9, 196, 164.8, 246.9, 329.6, 246.9]; // E3 G3 B3 … E4
    if (s % 2 === 1) {
      const note = riff[((s - 1) / 2) % riff.length];
      this.tone(note, 0.11, "triangle", 0.045);
    }
    // Rising sting at the top of every 2-bar loop.
    if (s === 0) this.freqRamp(660, 990, 0.18, "sine", 0.02);
  }

  private musicInterval(): number {
    return this.musicFast ? 95 : 130; // ≈158 / 115 BPM feel
  }

  startMusic() {
    if (this.muted || this.musicTimer !== null) return;
    try {
      this.getCtx(); // ensure the context is alive before scheduling
      this.musicStep = 0;
      this.musicTimer = window.setInterval(() => {
        this.playMusicStep(this.musicStep++);
      }, this.musicInterval());
    } catch (_) {}
  }

  /** Final-minute overdrive: restart the sequencer at the faster tempo. */
  setMusicFast(fast: boolean) {
    if (this.musicFast === fast) return;
    this.musicFast = fast;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = window.setInterval(() => {
        this.playMusicStep(this.musicStep++);
      }, this.musicInterval());
    }
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // ── AMBIENT: low vault drone + faint air hiss, loops forever ──────────────
  private droneOsc: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  startAmbient() {
    if (this.muted || this.droneOsc) return;
    try {
      const ctx = this.getCtx();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      const o1 = ctx.createOscillator();
      o1.type = "sine"; o1.frequency.value = 55;
      const o2 = ctx.createOscillator();
      o2.type = "triangle"; o2.frequency.value = 55.7; // slow beat against o1
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 220;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.getDest());
      o1.start(); o2.start();
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
      this.droneOsc = o1; this.droneOsc2 = o2; this.droneGain = g;
    } catch (_) {}
  }

  stopAmbient() {
    try { this.droneOsc?.stop(); this.droneOsc2?.stop(); this.droneGain?.disconnect(); } catch (_) {}
    this.droneOsc = null; this.droneOsc2 = null; this.droneGain = null;
  }

  // ── CLOCK TICK: dry mechanical tick; sharper double-tick when urgent ──────
  playTick(urgent: boolean) {
    if (urgent) {
      this.tone(1450, 0.03, "square", 0.055);
      this.noise(0.012, 0.05);
      this.tone(1080, 0.03, "square", 0.045, 0.10);
    } else {
      this.tone(980, 0.03, "square", 0.03);
      this.noise(0.008, 0.025);
    }
  }

  // ── CORRECT: mechanism click + warm ascending chime ───────────────────────
  playCorrect() {
    this.noise(0.02, 0.14);                          // click
    this.tone(660, 0.16, "triangle", 0.16, 0.02);
    this.tone(880, 0.2, "sine", 0.18, 0.1);
    this.tone(1320, 0.24, "sine", 0.1, 0.18);
  }

  // ── WRONG: klaxon alarm — two harsh falling blasts ────────────────────────
  playAlarm() {
    this.freqRamp(620, 340, 0.28, "sawtooth", 0.2);
    this.freqRamp(620, 340, 0.28, "sawtooth", 0.18, 0.34);
    this.noise(0.05, 0.1, 0, 900);
    this.tone(110, 0.4, "square", 0.08, 0.02);
  }

  // ── LOCK OPEN: heavy bolt clunk + steam hiss + reveal shimmer ─────────────
  playUnlock() {
    this.freqRamp(160, 42, 0.22, "sine", 0.4);       // heavy clunk
    this.noise(0.03, 0.22, 0, 500);
    this.noise(0.55, 0.09, 0.16);                    // steam hiss
    [880, 1108, 1318, 1760].forEach((f, i) =>
      this.tone(f, 0.22, "sine", 0.12 - i * 0.015, 0.3 + i * 0.09));
  }

  // ── DIGIT REVEAL: single crystal ping ─────────────────────────────────────
  playDigit() {
    this.tone(1567, 0.3, "sine", 0.14);
    this.tone(2093, 0.22, "sine", 0.07, 0.05);
  }

  // ── HINT: soft magical sweep ──────────────────────────────────────────────
  playHint() {
    this.freqRamp(420, 1680, 0.32, "sine", 0.1);
    this.tone(2093, 0.16, "sine", 0.06, 0.26);
  }

  // ── VAULT OPEN (WIN): rumble → triple bolt → triumphant fanfare ───────────
  playVaultOpen() {
    this.freqRamp(70, 28, 0.9, "sine", 0.3);         // rumble
    this.noise(0.7, 0.08, 0, 300);
    [0.25, 0.45, 0.65].forEach((d) => {              // three bolts
      this.freqRamp(200, 50, 0.14, "sine", 0.3, d);
      this.noise(0.02, 0.16, d, 600);
    });
    // Fanfare in C major
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.tone(f, 0.5, "triangle", 0.16, 0.95 + i * 0.12);
      this.tone(f * 2, 0.3, "sine", 0.06, 0.98 + i * 0.12);
    });
    this.tone(1568, 0.9, "sine", 0.1, 1.65);
  }

  // ── TIME UP (LOSE): deep slam + descending sad line ───────────────────────
  playTimeUp() {
    this.freqRamp(180, 30, 0.5, "sine", 0.38);
    this.noise(0.06, 0.2, 0, 400);
    [392, 349, 311, 262].forEach((f, i) =>
      this.tone(f, 0.4, "triangle", 0.13, 0.5 + i * 0.22));
  }

  // ── HEARTBEAT: final-minute dread ─────────────────────────────────────────
  playHeartbeat() {
    this.freqRamp(95, 42, 0.14, "sine", 0.3);
    this.freqRamp(80, 38, 0.12, "sine", 0.22, 0.18);
  }

  // ── START: door slam behind you + tension riser ───────────────────────────
  playStart() {
    this.freqRamp(150, 40, 0.3, "sine", 0.36);
    this.noise(0.04, 0.18, 0, 500);
    this.freqRamp(110, 440, 1.1, "sawtooth", 0.05, 0.35);
  }

  destroy() {
    this.stopAmbient();
    this.stopMusic();
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;
    this.compressor = null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// VISUAL VOCABULARY
// ═════════════════════════════════════════════════════════════════════════════
export const ESCAPE_BG = "radial-gradient(ellipse at 50% -10%, rgba(247,201,72,0.10) 0%, transparent 50%), linear-gradient(165deg, #0b1220 0%, #131c33 55%, #0b1220 100%)";
export const GOLD = "#F7C948";

export const LOCK_META: Record<LockType, { icon: string; ar: string; en: string; accent: string }> = {
  digits: { icon: "🔢", ar: "قفل الأرقام",   en: "Number Lock", accent: "34,211,238" },   // cyan
  laser:  { icon: "🔦", ar: "شبكة الليزر",   en: "Laser Grid",  accent: "248,113,113" },  // red
  wires:  { icon: "🔌", ar: "لوحة الأسلاك",  en: "Wire Panel",  accent: "74,222,128" },   // green
  vault:  { icon: "👑", ar: "الخزنة الكبرى", en: "Master Vault", accent: "247,201,72" },  // gold
};

// ── Vault room backdrop: stone gradient, torch glows, drifting dust ──────────
export function VaultBackdrop({ danger }: { danger: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Torch glows in the upper corners */}
      {[["8%", "rgba(247,201,72,0.16)"], ["92%", "rgba(247,201,72,0.14)"]].map(([x, c], i) => (
        <motion.div
          key={i}
          className="absolute top-0 h-64 w-64 -translate-x-1/2 rounded-full"
          style={{ left: x as string, background: `radial-gradient(circle, ${c}, transparent 65%)` }}
          animate={reduce ? undefined : { opacity: [0.7, 1, 0.8, 1, 0.7], scale: [1, 1.06, 0.98, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 3.4 + i, ease: "easeInOut" }}
        />
      ))}
      {/* Stone block seams */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05]" preserveAspectRatio="none" viewBox="0 0 100 100">
        {[18, 38, 58, 78].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#fff" strokeWidth="0.18" />
        ))}
        {[14, 34, 52, 70, 88].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={i % 2 === 0 ? 0 : 18} x2={x} y2={i % 2 === 0 ? 18 : 38} stroke="#fff" strokeWidth="0.18" />
            <line x1={(x + 10) % 100} y1={38} x2={(x + 10) % 100} y2={58} stroke="#fff" strokeWidth="0.18" />
          </g>
        ))}
      </svg>
      {/* Drifting dust motes */}
      {!reduce && [12, 30, 48, 66, 84].map((x, i) => (
        <motion.span
          key={x}
          className="absolute h-1 w-1 rounded-full bg-amber-100/40"
          style={{ left: `${x}%`, top: "30%" }}
          animate={{ y: [0, 90, 0], x: [0, i % 2 === 0 ? 14 : -14, 0], opacity: [0, 0.7, 0] }}
          transition={{ repeat: Infinity, duration: 7 + i * 1.4, delay: i * 0.9, ease: "easeInOut" }}
        />
      ))}
      {/* Danger vignette in the final stretch */}
      <AnimatePresence>
        {danger && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.25, 0.5, 0.25] }}
            exit={{ opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.1 }}
            className="absolute inset-0"
            style={{ boxShadow: "inset 0 0 140px rgba(220,38,38,0.55)" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Big LED countdown: gold normally, pulsing red in the final minute ────────
export function EscapeTimer({ timeLeft, urgent, big }: { timeLeft: number; urgent: boolean; big?: boolean }) {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={urgent ? { repeat: Infinity, duration: 1 } : undefined}
      className={`inline-flex items-center gap-1.5 rounded-2xl border-2 bg-black/60 font-black backdrop-blur-sm ${big ? "px-5 py-2 text-3xl sm:text-4xl" : "px-3.5 py-1.5 text-xl sm:text-2xl"}`}
      style={{
        fontVariantNumeric: "tabular-nums",
        direction: "ltr",
        color: urgent ? "#f87171" : GOLD,
        borderColor: urgent ? "rgba(248,113,113,0.6)" : "rgba(247,201,72,0.4)",
        textShadow: urgent ? "0 0 18px rgba(248,113,113,0.8)" : "0 0 14px rgba(247,201,72,0.55)",
      }}
    >
      ⏱ {m}:{s.toString().padStart(2, "0")}
    </motion.div>
  );
}

// ── Lock chain: the journey map across the top — closed / current / open ────
export function LockChain({ locks, currentIndex, ar }: { locks: LockState[]; currentIndex: number; ar: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5" style={{ direction: ar ? "rtl" : "ltr" }}>
      {locks.map((lock, i) => {
        const meta = LOCK_META[lock.type];
        const isCurrent = i === currentIndex && !lock.open;
        return (
          <div key={i} className="flex items-center gap-1.5 sm:gap-2.5">
            {i > 0 && (
              <div
                className="h-0.5 w-4 rounded-full sm:w-8"
                style={{ background: locks[i - 1].open ? GOLD : "rgba(255,255,255,0.15)" }}
              />
            )}
            <motion.div
              animate={isCurrent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={isCurrent ? { repeat: Infinity, duration: 1.4 } : undefined}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border-2 text-base sm:h-11 sm:w-11 sm:text-lg"
              style={{
                background: lock.open
                  ? "linear-gradient(145deg, rgba(247,201,72,0.3), rgba(180,130,20,0.2))"
                  : isCurrent ? `rgba(${meta.accent},0.16)` : "rgba(255,255,255,0.05)",
                borderColor: lock.open ? "rgba(247,201,72,0.7)" : isCurrent ? `rgba(${meta.accent},0.65)` : "rgba(255,255,255,0.14)",
                boxShadow: isCurrent ? `0 0 16px rgba(${meta.accent},0.4)` : lock.open ? "0 0 12px rgba(247,201,72,0.3)" : "none",
              }}
              title={ar ? meta.ar : meta.en}
            >
              {lock.open ? "🔓" : isCurrent ? meta.icon : "🔒"}
              {lock.open && (
                <span className="absolute -bottom-1.5 -end-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">✓</span>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ── Master code slots: one digit per lock, revealed as locks open ────────────
export function CodeSlots({ locks, ar }: { locks: LockState[]; ar: boolean }) {
  return (
    <div className="flex items-center gap-1.5" style={{ direction: "ltr" }} title={ar ? "الرمز الأعظم" : "Master code"}>
      <span className="me-0.5 text-xs">🗝️</span>
      {locks.map((lock, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={lock.open ? { scale: [1.5, 1], rotateY: [90, 0] } : {}}
          className="flex h-7 w-6 items-center justify-center rounded-md border font-black text-sm sm:h-8 sm:w-7 sm:text-base"
          style={{
            fontVariantNumeric: "tabular-nums",
            background: lock.open ? "rgba(247,201,72,0.18)" : "rgba(0,0,0,0.5)",
            borderColor: lock.open ? "rgba(247,201,72,0.6)" : "rgba(255,255,255,0.15)",
            color: lock.open ? GOLD : "rgba(255,255,255,0.25)",
            textShadow: lock.open ? "0 0 10px rgba(247,201,72,0.6)" : "none",
          }}
        >
          {lock.open ? lock.digit : "•"}
        </motion.span>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCK HERO VISUALS — one animated centrepiece per lock type
// ═════════════════════════════════════════════════════════════════════════════

function DigitsHero({ solved, total }: { solved: number; total: number }) {
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full">
      <rect x="30" y="8" width="140" height="94" rx="12" fill="#101a2e" stroke="rgba(34,211,238,0.35)" strokeWidth="2" />
      {/* Display strip: one glowing cell per question in this lock */}
      {Array.from({ length: total }).map((_, i) => {
        const w = Math.min(26, 120 / total);
        const x = 100 - (total * (w + 6) - 6) / 2 + i * (w + 6);
        const on = i < solved;
        return (
          <g key={i}>
            <rect x={x} y={22} width={w} height={30} rx={5}
              fill={on ? "rgba(34,211,238,0.25)" : "rgba(0,0,0,0.5)"}
              stroke={on ? "#22d3ee" : "rgba(255,255,255,0.12)"} strokeWidth="1.6" />
            {on && <text x={x + w / 2} y={42} textAnchor="middle" fill="#67e8f9" fontSize="16" fontWeight="900">✦</text>}
          </g>
        );
      })}
      {/* Keypad */}
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={70 + c * 22} y={60 + r * 13} width={18} height={10} rx={2.5}
          fill="rgba(255,255,255,0.07)" stroke="rgba(34,211,238,0.2)" strokeWidth="0.8" />
      )))}
      <motion.circle cx={165} cy={16} r={3.4}
        fill={solved >= total ? "#4ade80" : "#f87171"}
        animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
    </svg>
  );
}

function LaserHero({ solved, total }: { solved: number; total: number }) {
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full">
      <rect x="14" y="6" width="8" height="98" rx="3" fill="#1e293b" />
      <rect x="178" y="6" width="8" height="98" rx="3" fill="#1e293b" />
      {/* Door behind the beams */}
      <rect x="30" y="12" width="140" height="86" rx="8" fill="#0f172a" stroke="rgba(255,255,255,0.1)" />
      <text x="100" y="60" textAnchor="middle" fontSize="24" opacity="0.5">🚪</text>
      {Array.from({ length: total }).map((_, i) => {
        const y = 20 + (i * 76) / Math.max(1, total - 1 || 1);
        const off = i < solved;
        return (
          <g key={i}>
            <circle cx={20} cy={y} r={3} fill={off ? "#334155" : "#ef4444"} />
            <circle cx={180} cy={y} r={3} fill={off ? "#334155" : "#ef4444"} />
            {!off && (
              <motion.line x1={23} y1={y} x2={177} y2={y}
                stroke="#f87171" strokeWidth={2}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
                style={{ filter: "drop-shadow(0 0 4px rgba(248,113,113,0.9))" }} />
            )}
            {off && <line x1={23} y1={y} x2={177} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="3 5" />}
          </g>
        );
      })}
    </svg>
  );
}

function WiresHero({ solved, total }: { solved: number; total: number }) {
  const colors = ["#f87171", "#60a5fa", "#4ade80", "#facc15", "#c084fc", "#fb923c"];
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full">
      <rect x="24" y="10" width="152" height="90" rx="10" fill="#101a2e" stroke="rgba(74,222,128,0.3)" strokeWidth="2" />
      <rect x="34" y="18" width="20" height="74" rx="4" fill="rgba(255,255,255,0.06)" />
      <rect x="146" y="18" width="20" height="74" rx="4" fill="rgba(255,255,255,0.06)" />
      {Array.from({ length: total }).map((_, i) => {
        const y = 26 + (i * 58) / Math.max(1, total - 1 || 1);
        const cut = i < solved;
        const c = colors[i % colors.length];
        return (
          <g key={i}>
            <circle cx={44} cy={y} r={3.4} fill={c} />
            <circle cx={156} cy={y} r={3.4} fill={c} />
            {cut ? (
              <>
                <path d={`M47,${y} Q70,${y + 6} 88,${y + 10}`} stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
                <path d={`M153,${y} Q130,${y + 6} 112,${y + 10}`} stroke={c} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
                <text x={100} y={y + 12} textAnchor="middle" fontSize="9" fill="#4ade80">✂</text>
              </>
            ) : (
              <motion.path
                d={`M47,${y} Q100,${y + 5} 153,${y}`}
                stroke={c} strokeWidth={3} fill="none" strokeLinecap="round"
                animate={{ opacity: [0.75, 1, 0.75] }}
                transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.25 }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function VaultHero({ solved, total, open }: { solved: number; total: number; open: boolean }) {
  const seg = total > 0 ? solved / total : 0;
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full">
      {/* Vault door */}
      <circle cx={100} cy={55} r={48} fill="#1a2338" stroke="rgba(247,201,72,0.5)" strokeWidth="3" />
      <circle cx={100} cy={55} r={40} fill="none" stroke="rgba(247,201,72,0.2)" strokeWidth="1.4" strokeDasharray="4 5" />
      {/* Progress ring */}
      <motion.circle
        cx={100} cy={55} r={44} fill="none"
        stroke={GOLD} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${seg * 276} 276`}
        transform="rotate(-90 100 55)"
        style={{ filter: "drop-shadow(0 0 6px rgba(247,201,72,0.7))" }}
        initial={false}
        animate={{ strokeDasharray: `${seg * 276} 276` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {/* Spokes handle */}
      <motion.g
        style={{ transformOrigin: "100px 55px" }}
        animate={open ? { rotate: 240 } : { rotate: seg * 120 }}
        transition={{ duration: open ? 1.2 : 0.6, ease: "easeInOut" }}
      >
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a}
            x1={100 + Math.cos((a * Math.PI) / 180) * 8} y1={55 + Math.sin((a * Math.PI) / 180) * 8}
            x2={100 + Math.cos((a * Math.PI) / 180) * 30} y2={55 + Math.sin((a * Math.PI) / 180) * 30}
            stroke="#e5b93e" strokeWidth={5} strokeLinecap="round" />
        ))}
        <circle cx={100} cy={55} r={10} fill="#F7C948" stroke="#9A6A08" strokeWidth={2} />
      </motion.g>
      {/* Golden light spilling out when open */}
      {open && (
        <motion.circle cx={100} cy={55} r={48}
          fill="rgba(247,201,72,0.35)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.5] }}
          transition={{ duration: 1.4 }}
          style={{ filter: "blur(6px)" }}
        />
      )}
    </svg>
  );
}

export function LockHero({ lock, open }: { lock: LockState; open?: boolean }) {
  const total = lock.questionIdxs.length;
  switch (lock.type) {
    case "digits": return <DigitsHero solved={lock.solved} total={total} />;
    case "laser": return <LaserHero solved={lock.solved} total={total} />;
    case "wires": return <WiresHero solved={lock.solved} total={total} />;
    case "vault": return <VaultHero solved={lock.solved} total={total} open={!!open} />;
  }
}

// ── One-shot red alarm flash (mount keyed by alarmSeq) ───────────────────────
export function AlarmFlash() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0.1, 0.45, 0] }}
      transition={{ duration: 1.1, times: [0, 0.15, 0.4, 0.6, 1] }}
      style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(220,38,38,0.55) 100%)" }}
    >
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <span className="rounded-full border-2 border-red-400/70 bg-black/70 px-5 py-1.5 text-lg font-black text-red-300"
          style={{ textShadow: "0 0 16px rgba(248,113,113,0.9)" }}>
          🚨
        </span>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME VIEW — the full playing UI shared by class & device modes.
// Pages own the reducer + end screens; this component owns the run.
// ═════════════════════════════════════════════════════════════════════════════
const OPTION_LETTERS_AR = ["أ", "ب", "ج", "د"];
const OPTION_LETTERS_EN = ["A", "B", "C", "D"];
// Same gradients as وميض / شد الحبل option cards — Hasaad answer identity.
const OPTION_GRADIENT = [
  "linear-gradient(145deg, #1870C0, #08386E)",
  "linear-gradient(145deg, #C41818, #7A0A0A)",
  "linear-gradient(145deg, #DAA520, #9A6A08)",
  "linear-gradient(145deg, #9B40D8, #5A1A8A)",
];

export function EscapeGameView({
  state, dispatch, sound, ar, variant,
}: {
  state: EscapeState;
  dispatch: (a: EscapeAction) => void;
  sound: EscapeSoundEngine;
  ar: boolean;
  variant: "class" | "solo";
}) {
  const reduce = useReducedMotion();
  const lock = state.locks[state.lockIndex];
  const meta = LOCK_META[lock?.type ?? "digits"];
  const question = currentQuestion(state);
  const urgent = state.timeLeft <= 60;
  const letters = ar ? OPTION_LETTERS_AR : OPTION_LETTERS_EN;
  const big = variant === "class";

  // ── Option shuffling: a fresh random layout on EVERY question presentation
  //    (including when a missed question rotates back). shuffleSeq bumps each
  //    time the phase enters "question", which re-keys the card + options.
  const [shuffle, setShuffle] = useState<{ order: number[]; seq: number }>({ order: [], seq: 0 });
  useEffect(() => {
    if (state.phase !== "question" || !question) return;
    const idxs = question.options.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    setShuffle((s) => ({ order: idxs, seq: s.seq + 1 }));
    // Intentionally NOT depending on `question` (stable per lockIndex/qPos):
    // reshuffle exactly when a question presentation starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === "question", state.lockIndex, state.qPos]);
  const displayOrder = question && shuffle.order.length === question.options.length
    ? shuffle.order
    : (question ? question.options.map((_, i) => i) : []);
  const shuffleKey = `${state.lockIndex}-${state.qPos}-${shuffle.seq}`;

  // ── 1s master tick drives the engine clock ──
  useEffect(() => {
    if (state.status !== "playing") return;
    const h = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(h);
  }, [state.status, dispatch]);

  // ── Sounds bound to state transitions ──
  useEffect(() => {
    if (state.status === "playing") { sound.startAmbient(); sound.startMusic(); }
    else { sound.stopAmbient(); sound.stopMusic(); }
    // Cleanup covers unmount (e.g. the page swaps to the ceremony screen).
    return () => { sound.stopAmbient(); sound.stopMusic(); };
  }, [state.status, sound]);

  // Final-minute music overdrive.
  useEffect(() => {
    sound.setMusicFast(urgent && state.status === "playing");
  }, [urgent, state.status, sound]);

  const lastAlarm = useRef(state.alarmSeq);
  useEffect(() => {
    if (state.alarmSeq > lastAlarm.current) {
      sound.playAlarm();
      try { navigator.vibrate?.([80, 50, 120]); } catch (_) {}
    }
    lastAlarm.current = state.alarmSeq;
  }, [state.alarmSeq, sound]);

  // Intermediate lock-open clunk. The FINAL vault-open fanfare is played by
  // the page (this view unmounts on the same render that sets status "won",
  // so an effect here would never fire for it).
  const lastUnlock = useRef(state.unlockSeq);
  useEffect(() => {
    if (state.unlockSeq > lastUnlock.current && state.status === "playing") {
      sound.playUnlock();
      sound.playDigit();
      try { navigator.vibrate?.(60); } catch (_) {}
    }
    lastUnlock.current = state.unlockSeq;
  }, [state.unlockSeq, state.status, sound]);

  const prevCorrect = useRef<boolean | null>(null);
  useEffect(() => {
    if (state.phase === "feedback" && state.correct && prevCorrect.current !== true) {
      sound.playCorrect();
    }
    prevCorrect.current = state.phase === "feedback" ? state.correct : null;
  }, [state.phase, state.correct, sound]);

  // Ticking clock + heartbeat dread in the final minute.
  useEffect(() => {
    if (state.status !== "playing") return;
    if (state.timeLeft <= 10 || (urgent && state.timeLeft % 2 === 0)) sound.playTick(true);
    if (urgent && state.timeLeft % 4 === 0) sound.playHeartbeat();
  }, [state.timeLeft, state.status, urgent, sound]);

  const lost = state.status === "lost";
  if (!lock) return null;

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-2.5 px-3 pb-4 sm:gap-3.5"
      style={{ direction: ar ? "rtl" : "ltr" }}>

      {/* Alarm flash on wrong answers */}
      <AnimatePresence>
        {state.phase === "feedback" && state.correct === false && !reduce && (
          <AlarmFlash key={state.alarmSeq} />
        )}
      </AnimatePresence>

      {/* ── Header strip: lock chain · timer · code · hints ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <LockChain locks={state.locks} currentIndex={state.lockIndex} ar={ar} />
        <div className="flex items-center gap-2.5">
          <CodeSlots locks={state.locks} ar={ar} />
          <EscapeTimer timeLeft={state.timeLeft} urgent={urgent} big={big} />
        </div>
      </div>

      {/* ── Current lock hero ── */}
      <div
        className={`relative overflow-hidden rounded-3xl border-2 ${big ? "min-h-[150px] sm:min-h-[210px]" : "min-h-[120px] sm:min-h-[150px]"}`}
        style={{
          borderColor: `rgba(${meta.accent},0.35)`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.3))",
          boxShadow: `0 14px 40px rgba(0,0,0,0.4), inset 0 0 40px rgba(${meta.accent},0.05)`,
        }}
      >
        <div className="absolute start-3 top-2 z-10 flex items-center gap-2">
          <span className="text-xl sm:text-2xl">{meta.icon}</span>
          <div>
            <p className="text-sm font-black text-white sm:text-base">{ar ? meta.ar : meta.en}</p>
            <p className="text-[11px] font-bold" style={{ color: `rgb(${meta.accent})` }}>
              {lock.solved} / {lock.questionIdxs.length} {ar ? "حُلّ" : "solved"}
            </p>
          </div>
        </div>
        <div className={big ? "h-[150px] sm:h-[210px]" : "h-[120px] sm:h-[150px]"}>
          <LockHero lock={lock} open={state.status === "won"} />
        </div>
      </div>

      {/* ── Question + options / lock-open interstitial ── */}
      {state.phase === "lock-open" && state.status === "playing" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-amber-300/40 bg-black/40 p-5 text-center backdrop-blur-sm"
          style={{ boxShadow: "0 0 40px rgba(247,201,72,0.2)" }}
        >
          <motion.span
            className="text-5xl sm:text-6xl"
            initial={{ rotate: -12, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            🔓
          </motion.span>
          <h3 className={`font-black text-white ${big ? "text-2xl sm:text-3xl" : "text-xl"}`}>
            {ar ? "القفل انفتح!" : "Lock opened!"}
          </h3>
          <p className="flex items-center gap-2 text-sm font-bold text-white/70">
            {ar ? "حصلتم على رقم من الرمز الأعظم:" : "You earned a master-code digit:"}
            <motion.span
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="flex h-10 w-9 items-center justify-center rounded-lg border-2 border-amber-300/70 bg-amber-400/15 text-2xl font-black"
              style={{ color: GOLD, textShadow: "0 0 14px rgba(247,201,72,0.8)" }}
            >
              {lock.digit}
            </motion.span>
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            onClick={() => dispatch({ type: "continue" })}
            className={`rounded-2xl px-8 font-black text-[#1a2e1a] ${big ? "py-3.5 text-lg" : "py-3 text-base"}`}
            style={{
              background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
              boxShadow: "0 12px 28px rgba(217,165,33,0.45), inset 0 2px 0 rgba(255,255,255,0.3)",
            }}
          >
            {ar ? `⛓️ إلى ${LOCK_META[state.locks[state.lockIndex + 1]?.type ?? "vault"][ar ? "ar" : "en"]}` : "⛓️ Next lock"} ←
          </motion.button>
        </motion.div>
      ) : question && !lost && state.status === "playing" ? (
        <>
          {/* Question card — keyed by shuffleKey so a returning question
              (after a wrong answer) also exits and re-enters fresh */}
          <motion.div
            key={shuffleKey}
            initial={{ opacity: 0, y: 10 }}
            animate={state.phase === "feedback" && state.correct === false
              ? { opacity: 1, y: 0, x: [0, -8, 7, -5, 0] }
              : { opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border-2 bg-black/45 px-4 py-3 backdrop-blur-sm"
            style={{ borderColor: `rgba(${meta.accent},0.3)` }}
          >
            <p className={`text-center font-black leading-snug text-white ${big ? "text-lg sm:text-2xl" : "text-base sm:text-lg"}`}>
              {question.text}
            </p>
          </motion.div>

          {/* Options 2×2 with letter badges (Hasaad answer identity).
              Positions are RE-SHUFFLED on every presentation, so the correct
              answer never sits in a memorable spot. On a wrong answer the
              correct option is NOT revealed — the student must think. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
            {displayOrder.map((idx, pos) => {
              const opt = question.options[idx];
              const removedOpt = state.removed.includes(idx);
              const inFeedback = state.phase === "feedback";
              const isPick = inFeedback && idx === state.selected;
              const isCorrectPick = isPick && state.correct === true;
              const isWrongPick = isPick && state.correct === false;
              const clickable = state.phase === "question" && !removedOpt;
              return (
                <motion.button
                  key={`${shuffleKey}-${pos}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: removedOpt || (inFeedback && !isPick) ? 0.35 : 1, y: 0 }}
                  transition={{ duration: 0.25, delay: pos * 0.05 }}
                  whileTap={clickable ? { scale: 0.96 } : undefined}
                  onClick={() => clickable && dispatch({ type: "answer", index: idx })}
                  disabled={!clickable}
                  className={`relative flex items-center gap-2.5 rounded-xl border-2 px-3 text-start font-black text-white transition-all ${big ? "min-h-[58px] py-2.5 sm:min-h-[64px]" : "min-h-[52px] py-2"}`}
                  style={{
                    touchAction: "manipulation",
                    background: isCorrectPick ? "#1a5c30" : isWrongPick ? "#5c1212" : OPTION_GRADIENT[pos % 4],
                    borderColor: isCorrectPick ? "#4ade80" : isWrongPick ? "#f87171" : "rgba(255,255,255,0.18)",
                    cursor: clickable ? "pointer" : "default",
                    boxShadow: removedOpt ? "none" : "0 4px 14px rgba(0,0,0,0.35)",
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-black"
                    style={{ background: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.3)" }}>
                    {letters[pos]}
                  </span>
                  <span className={`flex-1 leading-snug ${big ? "text-base sm:text-lg" : "text-sm sm:text-base"} ${removedOpt ? "line-through" : ""}`}>
                    {opt}
                  </span>
                  {isCorrectPick && <span className="text-lg">✓</span>}
                  {isWrongPick && <span className="text-lg">✗</span>}
                  {removedOpt && <span className="text-lg">🚫</span>}
                </motion.button>
              );
            })}
          </div>

          {/* Bottom strip: hint key + feedback text */}
          <div className="flex items-center justify-between gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { sound.playHint(); dispatch({ type: "fifty" }); }}
              disabled={state.hintsLeft <= 0 || state.removed.length > 0 || state.phase !== "question"}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-black transition-all disabled:opacity-35"
              style={{
                background: "rgba(247,201,72,0.12)",
                borderColor: "rgba(247,201,72,0.4)",
                color: GOLD,
              }}
            >
              🗝️ {ar ? "مفتاح المساعدة" : "Hint key"} ×{state.hintsLeft}
            </motion.button>
            <div className="h-6 flex-1 text-center">
              {state.phase === "feedback" && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`text-sm font-black sm:text-base ${state.correct ? "text-green-300" : "text-red-300"}`}>
                  {state.correct
                    ? (ar ? "✓ الآلية تتحرك…" : "✓ The mechanism turns…")
                    : (ar ? `🚨 إنذار! خسرتم 15 ثانية` : "🚨 Alarm! −15 seconds")}
                </motion.p>
              )}
            </div>
            <span className="text-xs font-bold text-white/40" style={{ direction: "ltr" }}>
              ✓{state.correctCount} ✗{state.wrongCount}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// END-OF-RUN STATS CARD (shared by both modes' end screens)
// ═════════════════════════════════════════════════════════════════════════════
export function EscapeEndStats({ state, ar }: { state: EscapeState; ar: boolean }) {
  const opened = state.locks.filter((l) => l.open).length;
  const items = [
    { icon: "🔓", label: ar ? "أقفال فُتحت" : "Locks opened", value: `${opened} / ${state.locks.length}` },
    { icon: "✅", label: ar ? "إجابات صحيحة" : "Correct", value: `${state.correctCount}` },
    { icon: "🚨", label: ar ? "إنذارات" : "Alarms", value: `${state.wrongCount}` },
    {
      icon: "⏱", label: ar ? "الوقت المتبقي" : "Time left",
      value: `${Math.floor(state.timeLeft / 60)}:${(state.timeLeft % 60).toString().padStart(2, "0")}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it, i) => (
        <motion.div
          key={it.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.12 }}
          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-center"
        >
          <p className="text-lg">{it.icon}</p>
          <p className="text-[11px] font-bold text-white/55">{it.label}</p>
          <p className="text-lg font-black text-white" style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{it.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Golden treasure burst for the win screen ─────────────────────────────────
export function TreasureBurst() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: 26 }).map((_, i) => {
        const x = 8 + (i * 89) % 86;
        const d = 2.6 + (i % 5) * 0.5;
        const icons = ["🪙", "💎", "⭐", "🏆", "🪙"];
        return (
          <motion.span
            key={i}
            className="absolute text-xl sm:text-2xl"
            style={{ left: `${x}%`, top: "-6%" }}
            animate={{ y: ["0vh", "112vh"], rotate: [0, i % 2 === 0 ? 320 : -320], opacity: [1, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: d, delay: (i % 8) * 0.35, ease: "linear" }}
          >
            {icons[i % icons.length]}
          </motion.span>
        );
      })}
    </div>
  );
}

export { escapeProgress, revealedCode };
