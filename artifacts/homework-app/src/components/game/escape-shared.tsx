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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { resolveImageUrl } from "@/lib/image-url";
import { MathText } from "@/components/math-text";
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

export const LOCK_META: Record<LockType, { icon: React.ReactNode; ar: string; en: string; accent: string }> = {
  digits: {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01"/></svg>,
    ar: "قفل الأرقام", en: "Number Lock", accent: "34,211,238"
  },
  laser: {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg>,
    ar: "شبكة الليزر", en: "Laser Grid", accent: "248,113,113"
  },
  wires: {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M4 9a2 2 0 0 1-2-2V4h6v3a2 2 0 0 1-2 2Z"/><path d="M4 15a2 2 0 0 0-2 2v3h6v-3a2 2 0 0 0-2-2Z"/><path d="M18 9a2 2 0 0 0 2-2V4h-6v3a2 2 0 0 0 2 2Z"/><path d="M18 15a2 2 0 0 1 2 2v3h-6v-3a2 2 0 0 1 2-2Z"/><path d="M8 5.5h8"/><path d="M8 18.5h8"/><path d="M6 9v6"/><path d="M18 9v6"/></svg>,
    ar: "لوحة الأسلاك", en: "Wire Panel", accent: "74,222,128"
  },
  vault: {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M10 2h4M12 14v4M12 22v-2M18 20V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16Z"/><circle cx="12" cy="10" r="3"/></svg>,
    ar: "بوابة الخروج", en: "Exit Door", accent: "247,201,72"
  },
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={big ? "h-6 w-6" : "h-5 w-5"}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      {m}:{s.toString().padStart(2, "0")}
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
              {lock.open ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:h-5 sm:w-5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              ) : isCurrent ? (
                meta.icon
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 sm:h-5 sm:w-5 opacity-40"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              )}
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
      <span className="me-0.5 text-xs text-white/50">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
      </span>
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
    <svg viewBox="0 0 200 110" className="h-full w-full" style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.6))" }}>
      <defs>
        <linearGradient id="dh-case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="dh-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
        <filter id="dh-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="dh-button" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>

      {/* Outer Case */}
      <rect x="20" y="5" width="160" height="100" rx="8" fill="url(#dh-case)" stroke="#334155" strokeWidth="2" />
      {/* Inner shadow/bevel */}
      <rect x="23" y="8" width="154" height="94" rx="5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />

      {/* Screws */}
      <circle cx="28" cy="13" r="2" fill="#020617" />
      <circle cx="172" cy="13" r="2" fill="#020617" />
      <circle cx="28" cy="97" r="2" fill="#020617" />
      <circle cx="172" cy="97" r="2" fill="#020617" />

      {/* Screen Area Bevel */}
      <rect x="35" y="15" width="130" height="38" rx="4" fill="#020617" />
      {/* Actual Screen */}
      <rect x="38" y="18" width="124" height="32" rx="2" fill="url(#dh-screen)" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />

      {/* Display strip */}
      {Array.from({ length: total }).map((_, i) => {
        const w = Math.min(24, 110 / total);
        const gap = 4;
        const x = 100 - (total * (w + gap) - gap) / 2 + i * (w + gap);
        const on = i < solved;
        return (
          <g key={i}>
            <rect x={x} y={23} width={w} height={22} rx="2"
              fill={on ? "#10b981" : "rgba(4,47,46,0.8)"}
              stroke={on ? "#34d399" : "rgba(6,78,59,0.5)"} strokeWidth="1"
              style={on ? { filter: "url(#dh-glow)" } : {}} />
            {on && (
              <text x={x + w / 2} y={39} textAnchor="middle" fill="#ecfdf5" fontSize="16" fontFamily="monospace" fontWeight="900" style={{ filter: "drop-shadow(0 0 3px #fff)" }}>
                *
              </text>
            )}
          </g>
        );
      })}

      {/* Status LED */}
      <motion.circle cx="170" cy="34" r="3"
        fill={solved >= total ? "#4ade80" : "#ef4444"}
        animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
        style={{ filter: `drop-shadow(0 0 4px ${solved >= total ? "#4ade80" : "#ef4444"})` }} />

      {/* Keypad Grid */}
      <g transform="translate(42, 60)">
        {[0, 1].map((r) => [0, 1, 2, 3, 4].map((c) => {
          const btnX = c * 24;
          const btnY = r * 20;
          return (
            <g key={`${r}${c}`}>
              {/* Button Shadow */}
              <rect x={btnX} y={btnY + 2} width="20" height="14" rx="3" fill="#020617" />
              {/* Button Surface */}
              <rect x={btnX} y={btnY} width="20" height="14" rx="3" fill="url(#dh-button)" stroke="#64748b" strokeWidth="0.5" />
              {/* Button Highlight */}
              <line x1={btnX + 2} y1={btnY + 1} x2={btnX + 18} y2={btnY + 1} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" />
            </g>
          );
        }))}
      </g>
    </svg>
  );
}

function LaserHero({ solved, total }: { solved: number; total: number }) {
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full" style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.6))" }}>
      <defs>
        <radialGradient id="lh-tunnel" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <filter id="lh-glow" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="lh-bright-glow" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Deep perspective tunnel */}
      <rect x="0" y="0" width="200" height="110" fill="url(#lh-tunnel)" />

      {/* Floor and ceiling perspective lines */}
      <path d="M 0 110 L 80 80 M 200 110 L 120 80 M 0 0 L 80 30 M 200 0 L 120 30" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
      {/* Back wall */}
      <rect x="80" y="30" width="40" height="50" fill="#020617" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />

      {/* Left/Right metallic mounting frames */}
      <rect x="10" y="5" width="20" height="100" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="170" y="5" width="20" height="100" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="20" y="5" width="10" height="100" fill="#1e293b" />
      <rect x="170" y="5" width="10" height="100" fill="#1e293b" />

      {Array.from({ length: total }).map((_, i) => {
        const y = 20 + (i * 70) / Math.max(1, total - 1 || 1);
        const off = i < solved;
        return (
          <g key={i}>
            {/* Emitters */}
            <path d={`M 25 ${y-6} L 32 ${y-4} L 32 ${y+4} L 25 ${y+6} Z`} fill="#475569" stroke="#1e293b" strokeWidth="1" />
            <path d={`M 175 ${y-6} L 168 ${y-4} L 168 ${y+4} L 175 ${y+6} Z`} fill="#475569" stroke="#1e293b" strokeWidth="1" />

            {/* Emitting lenses */}
            <ellipse cx="30" cy={y} rx="1.5" ry="3" fill={off ? "#1e293b" : "#fca5a5"} style={off ? {} : { filter: "url(#lh-glow)" }} />
            <ellipse cx="170" cy={y} rx="1.5" ry="3" fill={off ? "#1e293b" : "#fca5a5"} style={off ? {} : { filter: "url(#lh-glow)" }} />

            {!off && (
              <>
                <motion.line x1="32" y1={y} x2="168" y2={y}
                  stroke="#ef4444" strokeWidth="3"
                  animate={{ opacity: [0.7, 1, 0.7], strokeWidth: [2, 4, 2] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
                  style={{ filter: "url(#lh-bright-glow)" }} />
                <motion.line x1="32" y1={y} x2="168" y2={y}
                  stroke="#fca5a5" strokeWidth="1.5"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 + 0.5 }}
                  style={{ filter: "url(#lh-glow)" }} />
                <line x1="32" y1={y} x2="168" y2={y} stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
              </>
            )}

            {off && (
              <line x1="32" y1={y} x2="168" y2={y} stroke="#475569" strokeWidth="1" strokeDasharray="2 6" opacity="0.4" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function WiresHero({ solved, total }: { solved: number; total: number }) {
  const colors = ["#ef4444", "#0ea5e9", "#22c55e", "#eab308", "#d946ef", "#f97316"];
  return (
    <svg viewBox="0 0 200 110" className="h-full w-full" style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.6))" }}>
      <defs>
        <linearGradient id="wh-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1917" />
          <stop offset="100%" stopColor="#0c0a09" />
        </linearGradient>
        <pattern id="wh-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
        <filter id="wh-spark" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="wh-terminal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>

      {/* Box interior */}
      <rect x="15" y="5" width="170" height="100" rx="4" fill="url(#wh-bg)" stroke="#292524" strokeWidth="2" />
      <rect x="15" y="5" width="170" height="100" rx="4" fill="url(#wh-grid)" />

      {/* Caution tape / details */}
      <path d="M 15 5 L 45 5 L 15 35 Z" fill="#b45309" opacity="0.3" />
      <path d="M 185 105 L 155 105 L 185 75 Z" fill="#b45309" opacity="0.3" />

      {/* Side Terminals */}
      <rect x="25" y="10" width="20" height="90" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
      <rect x="155" y="10" width="20" height="90" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
      <rect x="38" y="12" width="5" height="86" fill="url(#wh-terminal)" />
      <rect x="157" y="12" width="5" height="86" fill="url(#wh-terminal)" />

      {Array.from({ length: total }).map((_, i) => {
        const y = 22 + (i * 66) / Math.max(1, total - 1 || 1);
        const cut = i < solved;
        const c = colors[i % colors.length];
        return (
          <g key={i}>
            {/* Terminal Connectors */}
            <circle cx="32" cy={y} r="3.5" fill="#0f172a" />
            <circle cx="32" cy={y} r="2" fill="#cbd5e1" />
            <line x1="30.5" y1={y} x2="33.5" y2={y} stroke="#334155" strokeWidth="0.8" />

            <circle cx="168" cy={y} r="3.5" fill="#0f172a" />
            <circle cx="168" cy={y} r="2" fill="#cbd5e1" />
            <line x1="166.5" y1={y} x2="169.5" y2={y} stroke="#334155" strokeWidth="0.8" />

            {/* Shadow for depth */}
            {!cut && (
              <path d={`M 45 ${y+3} Q 100 ${y+16} 155 ${y+3}`} stroke="rgba(0,0,0,0.6)" strokeWidth="6" fill="none" strokeLinecap="round" />
            )}

            {cut ? (
              <>
                {/* Cut wires drooping */}
                <path d={`M 43 ${y} Q 60 ${y+12} 80 ${y+20}`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d={`M 43 ${y} Q 60 ${y+12} 80 ${y+20}`} stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d={`M 157 ${y} Q 140 ${y+12} 120 ${y+20}`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d={`M 157 ${y} Q 140 ${y+12} 120 ${y+20}`} stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" strokeLinecap="round" />

                {/* Copper exposed ends */}
                <circle cx="80" cy={y+20} r="2" fill="#fbbf24" />
                <circle cx="120" cy={y+20} r="2" fill="#fbbf24" />

                {/* Active sparks if just cut */}
                {i === solved - 1 && (
                  <motion.g style={{ filter: "url(#wh-spark)" }}
                    animate={{ opacity: [0, 1, 0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, times: [0, 0.1, 0.2, 0.3, 1] }}
                  >
                    <circle cx="80" cy={y+20} r="3" fill="#fef08a" />
                    <circle cx="120" cy={y+20} r="3" fill="#fef08a" />
                  </motion.g>
                )}
              </>
            ) : (
              <motion.g>
                <path d={`M 43 ${y} Q 100 ${y+12} 157 ${y}`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d={`M 43 ${y-1} Q 100 ${y+10} 157 ${y-1}`} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </motion.g>
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
      <circle cx={100} cy={55} r={48} fill="#1a2338" stroke="rgba(247,201,72,0.5)" strokeWidth="3" />
      <circle cx={100} cy={55} r={40} fill="none" stroke="rgba(247,201,72,0.2)" strokeWidth="1.4" strokeDasharray="4 5" />
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
      <motion.g
        style={{ transformOrigin: "100px 55px" }}
        animate={open ? { rotate: 240 } : { rotate: seg * 120 }}
        transition={{ duration: open ? 1.2 : 0.6, ease: "easeInOut" }}
      >
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line
            key={angle}
            x1={100 + Math.cos((angle * Math.PI) / 180) * 8}
            y1={55 + Math.sin((angle * Math.PI) / 180) * 8}
            x2={100 + Math.cos((angle * Math.PI) / 180) * 30}
            y2={55 + Math.sin((angle * Math.PI) / 180) * 30}
            stroke="#e5b93e"
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}
        <circle cx={100} cy={55} r={10} fill="#F7C948" stroke="#9A6A08" strokeWidth={2} />
      </motion.g>
      {open && (
        <motion.circle
          cx={100} cy={55} r={48}
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
        <span className="rounded-full border-2 border-red-400/70 bg-black/70 p-2 text-red-300"
          style={{ textShadow: "0 0 16px rgba(248,113,113,0.9)", filter: "drop-shadow(0 0 10px rgba(248,113,113,0.8))" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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
  state, dispatch, sound, ar, variant, headerAction,
}: {
  state: EscapeState;
  dispatch: (a: EscapeAction) => void;
  sound: EscapeSoundEngine;
  ar: boolean;
  variant: "class" | "solo";
  headerAction?: ReactNode;
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
          {headerAction}
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
            className="text-5xl sm:text-6xl text-amber-300"
            initial={{ rotate: -12, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-16 w-16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
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
            className={`flex items-center gap-2 rounded-2xl px-8 font-black text-[#1a2e1a] ${big ? "py-3.5 text-lg" : "py-3 text-base"}`}
            style={{
              background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
              boxShadow: "0 12px 28px rgba(217,165,33,0.45), inset 0 2px 0 rgba(255,255,255,0.3)",
            }}
          >
            {ar ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 rotate-180"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                {`إلى ${LOCK_META[state.locks[state.lockIndex + 1]?.type ?? "vault"].ar}`}
              </>
            ) : (
              <>
                {`Next lock: ${LOCK_META[state.locks[state.lockIndex + 1]?.type ?? "vault"].en}`}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </>
            )}
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
              <MathText text={question.text} fallbackDirection={ar ? "rtl" : "ltr"} />
            </p>
            {question.imageUrl && (
              <div className="flex justify-center mt-2">
                <img src={resolveImageUrl(question.imageUrl) ?? ""} alt="" className="rounded-lg object-contain" style={{ maxHeight: big ? "clamp(90px,18vh,180px)" : "clamp(70px,14vh,140px)", maxWidth: "80%" }} />
              </div>
            )}
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
                  <MathText
                    text={opt}
                    fallbackDirection={ar ? "rtl" : "ltr"}
                    className={`flex-1 leading-snug ${big ? "text-base sm:text-lg" : "text-sm sm:text-base"} ${removedOpt ? "line-through" : ""}`}
                  />
                  {isCorrectPick && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5 shrink-0"><path d="M20 6 9 17l-5-5"/></svg>}
                  {isWrongPick && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5 shrink-0"><path d="M18 6 6 18M6 6l12 12"/></svg>}
                  {removedOpt && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-white/50"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
              {ar ? "مفتاح المساعدة" : "Hint key"} ×{state.hintsLeft}
            </motion.button>
            <div className="h-6 flex-1 text-center">
              {state.phase === "feedback" && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-center gap-1.5 text-sm font-black sm:text-base ${state.correct ? "text-green-300" : "text-red-300"}`}>
                  {state.correct ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M20 6 9 17l-5-5"/></svg>
                      {ar ? "الآلية تتحرك…" : "The mechanism turns…"}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {ar ? "إنذار! خسرتم 15 ثانية" : "Alarm! −15 seconds"}
                    </>
                  )}
                </motion.p>
              )}
            </div>
            <span className="flex items-center gap-2 text-xs font-bold text-white/40" style={{ direction: "ltr" }}>
              <span className="flex items-center gap-0.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-green-400"><path d="M20 6 9 17l-5-5"/></svg> {state.correctCount}</span>
              <span className="flex items-center gap-0.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3 w-3 text-red-400"><path d="M18 6 6 18M6 6l12 12"/></svg> {state.wrongCount}</span>
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
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label: ar ? "أقفال فُتحت" : "Locks opened", value: `${opened} / ${state.locks.length}` },
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>, label: ar ? "إجابات صحيحة" : "Correct", value: `${state.correctCount}` },
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: ar ? "إنذارات" : "Alarms", value: `${state.wrongCount}` },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: ar ? "الوقت المتبقي" : "Time left",
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
          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-center flex flex-col items-center"
        >
          <div className="mb-1">{it.icon}</div>
          <p className="text-[11px] font-bold text-white/55">{it.label}</p>
          <p className="text-lg font-black text-white" style={{ fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{it.value}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ── Golden treasure burst for the win screen ─────────────────────────────────
export function EscapeBurst() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => {
        const x = 5 + (i * 89) % 90;
        const d = 2.0 + (i % 5) * 0.4;
        const width = 4 + (i % 4) * 2;
        const height = 12 + (i % 3) * 8;
        const color = ["#fde047", "#facc15", "#38bdf8", "#4ade80", "#c084fc"][i % 5];
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`, top: "-10%",
              width: `${width}px`, height: `${height}px`,
              background: color,
              boxShadow: `0 0 10px ${color}`
            }}
            animate={{
              y: ["0vh", "120vh"],
              rotate: [0, (i % 2 === 0 ? 1 : -1) * (180 + (i * 30) % 180)],
              opacity: [1, 1, 0]
            }}
            transition={{ repeat: Infinity, duration: d, delay: (i % 8) * 0.25, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}

export { escapeProgress, revealedCode };
