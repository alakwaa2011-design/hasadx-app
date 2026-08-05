import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Loader2, CheckCircle2, XCircle, Send, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D9A521";
const CYAN = "#54d8ff";
const SPACE_BG = "radial-gradient(120% 85% at 50% 0%, #131f5e 0%, #090e33 48%, #030514 100%)";

/* Cinematic keyframes — injected once at root. GPU-friendly transforms/opacity only. */
const RR_KEYFRAMES = `
@keyframes rrShakeSoft{0%,100%{transform:translate3d(0,0,0) scale(1.015)}20%{transform:translate3d(-3px,2px,0) scale(1.015)}40%{transform:translate3d(3px,-2px,0) scale(1.015)}60%{transform:translate3d(-2px,-2px,0) scale(1.015)}80%{transform:translate3d(2px,2px,0) scale(1.015)}}
@keyframes rrShakeHard{0%,100%{transform:translate3d(0,0,0) scale(1.03)}10%{transform:translate3d(-9px,5px,0) scale(1.03)}25%{transform:translate3d(8px,-5px,0) scale(1.03)}40%{transform:translate3d(-6px,-6px,0) scale(1.03)}55%{transform:translate3d(6px,4px,0) scale(1.03)}70%{transform:translate3d(-4px,3px,0) scale(1.03)}85%{transform:translate3d(2px,-2px,0) scale(1.03)}}
@keyframes rrSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes rrShine{0%{transform:translateX(-140%) skewX(-18deg)}100%{transform:translateX(240%) skewX(-18deg)}}
@keyframes rrScan{0%{top:-25%}100%{top:125%}}
@keyframes rrFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes rrPulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes rrRing{0%{transform:translate(-50%,-50%) scale(.25);opacity:.95}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
@keyframes rrWrongShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px)}35%{transform:translateX(6px)}55%{transform:translateX(-4px)}75%{transform:translateX(3px)}}
@keyframes rrGateShimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
`;

// Pre-generated star data for consistent scrolling (module-level = stable positions)
const STAR_LAYERS = [
  // Far layer — tiny, slow
  Array.from({ length: 110 }, (_, i) => ({
    id: i, x: ((i * 73 + 17) % 100), y: ((i * 91 + 33) % 200),
    size: 0.5 + (i % 3) * 0.45, twinkle: i % 4 === 0,
  })),
  // Mid layer
  Array.from({ length: 70 }, (_, i) => ({
    id: i + 200, x: ((i * 57 + 41) % 100), y: ((i * 113 + 11) % 200),
    size: 1.1 + (i % 3) * 0.6, twinkle: i % 3 === 0,
  })),
  // Near layer — bigger, fastest (strongest parallax)
  Array.from({ length: 42 }, (_, i) => ({
    id: i + 400, x: ((i * 37 + 7) % 100), y: ((i * 131 + 23) % 200),
    size: 1.8 + (i % 3) * 0.8, twinkle: i % 2 === 0,
  })),
];
const PHASE_BACKGROUNDS = [
  "radial-gradient(140% 95% at 50% -10%, #1a2a7a 0%, #0d1445 38%, #060930 62%, #02040f 100%)", // Deep Space
  "radial-gradient(140% 95% at 50% -10%, #64270a 0%, #3d1404 40%, #1d0801 70%, #0b0300 100%)", // Asteroid Field
  "radial-gradient(140% 95% at 50% -10%, #045d63 0%, #023a46 40%, #011f2c 70%, #000c14 100%)", // Crystal Planet
];
// Ambient dust motes drifting over everything (module-level = stable)
const DUST_MOTES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: ((i * 53 + 29) % 100),
  size: 2 + (i % 3) * 1.5,
  dur: 9 + (i % 5) * 3,
  delay: (i * 1.7) % 8,
  drift: (i % 2 === 0 ? 1 : -1) * (18 + (i % 4) * 12),
}));

type QType = "mcq" | "true_false" | "fill_blank";

interface Question {
  index: number;
  text: string;
  type: QType;
  options: string[];
  duration: number;
}

interface Player {
  name: string;
  avatar: string;
  rocketColor: string;
  altitude: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  finished: boolean;
  finishRank?: number;
  streak: number;
  currentQuestionIdx: number;
  /** Server-driven cruise velocity (1 = base, peaks at ~4-6 right after a correct answer). */
  velocity?: number;
}

/** من هذا العدد فما فوق نعرض مسارًا أفقيًا قابلًا للتمرير (صفوف طويلة) */
/** When class size is consistently above ~15 racers, prefer horizontal scrolling lanes */
const ROCKET_HORIZONTAL_LANES_MIN = 16;

// ─── Arabic encouragement messages ────────────────────────────────────────────
const CORRECT_AR = [
  "🔥 عبقري! سفينتك تنطلق!",
  "⚡ مذهل! الصدارة لك!",
  "🚀 صعودٌ! واصل الرحلة!",
  "💫 ممتاز جداً!",
  "🌟 رائع! سرعتك لا تُضاهى!",
  "🎯 دقيق! هكذا تُكتشف المجرات!",
  "🏆 أنت نجم الفضاء!",
  "⭐ إجابة صحيحة! مداركَ آخر!",
];
const CORRECT_EN = [
  "🔥 Genius! Rocket launching!",
  "⚡ Amazing! Take the lead!",
  "🚀 Altitude gained!",
  "💫 Excellent!",
  "🌟 Fantastic speed!",
  "🎯 Spot on!",
  "🏆 Space star!",
  "⭐ Up you go!",
];
const WRONG_AR = [
  "💪 ركّز! السؤال سيعود!",
  "⚡ لا تستسلم! التالي لك!",
  "🌙 اقترب أكثر! حاول مجدداً!",
  "🛸 الخطأ يُعلّم، استعد!",
];
const WRONG_EN = [
  "💪 Focus! Question returns!",
  "⚡ Don't give up!",
  "🌙 Almost! Try again!",
  "🛸 Learn and retry!",
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

// ─── Space Sound Engine ───────────────────────────────────────────────────────
class RocketSoundEngine {
  ctx: AudioContext | null = null;
  muted = false;
  bgInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    try {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { /* ignore */ }
    try { this.muted = localStorage.getItem("rocket-music-muted") === "1"; } catch { /* ignore */ }
  }

  setMuted(m: boolean, currentMode?: "lobby" | "race1" | "race2" | "race3") {
    this.muted = m;
    try { localStorage.setItem("rocket-music-muted", m ? "1" : "0"); } catch { /* ignore */ }
    if (m) this.stopBackground();
    else {
      const mode = currentMode ?? (this.bgMode === "off" ? "lobby" : this.bgMode as "lobby" | "race1" | "race2" | "race3");
      this.startBackground(mode);
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12, delay = 0, decay = 0.9) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 3000;
    osc.type = type; osc.frequency.value = freq;
    const now = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur * decay);
    osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + dur + 0.05);
  }

  private bgMode: "lobby" | "race1" | "race2" | "race3" | "off" = "off";
  private bgBeat = 0;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;

  private kick(delay = 0, vol = 0.5) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = "sine";
      const t = this.ctx.currentTime + delay;
      osc.frequency.setValueAtTime(160, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g); g.connect(this.ctx.destination); osc.start(t); osc.stop(t + 0.25);
    } catch { /* ignore */ }
  }

  private hihat(delay = 0, vol = 0.05) {
    if (!this.ctx || this.muted) return;
    try {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.035, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const filt = this.ctx.createBiquadFilter(); filt.type = "highpass"; filt.frequency.value = 8000;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + delay;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(filt); filt.connect(g); g.connect(this.ctx.destination); src.start(t); src.stop(t + 0.05);
    } catch { /* ignore */ }
  }

  // ── LOBBY: Mysterious space ambient — 80 BPM
  private lobbyStep() {
    if (this.bgMode !== "lobby" || !this.ctx || this.muted) return;
    const b = this.bgBeat % 8; const beat = 750;
    if (b === 0 || b === 4) { this.tone(55, 0.3, "sine", 0.06); this.tone(55, 0.15, "sine", 0.04, 0.25); }
    const arp = [131, 155, 196, 233, 261, 311, 392, 311];
    this.tone(arp[b], 0.35, "sine", 0.05, 0.08);
    if (b === 3 || b === 7) this.tone(1200 + b * 80, 0.04, "square", 0.025, 0.15);
    if (b === 0) { this.tone(65, 2.8, "sine", 0.035); this.tone(98, 2.8, "triangle", 0.025); }
    else if (b === 4) { this.tone(58, 2.8, "sine", 0.035); this.tone(87, 2.8, "triangle", 0.025); }
    this.bgBeat++;
    this.bgTimer = setTimeout(() => this.lobbyStep(), beat);
  }

  // ── RACE 1 (Deep Space): Fast space battle — 140 BPM
  private race1Step() {
    if (this.bgMode !== "race1" || !this.ctx || this.muted) return;
    const b = this.bgBeat % 16; const beat = 428;
    if (b % 4 === 0) this.kick();
    if (b === 10) this.kick();
    this.hihat(0, 0.06);
    if (b === 2 || b === 6 || b === 14) this.hihat(0, 0.11);
    const bass = [73, 73, 87, 73, 98, 73, 87, 98, 73, 73, 82, 73, 98, 87, 73, 87];
    this.tone(bass[b], 0.25, "sawtooth", 0.07);
    const mel = [293, 349, 392, 440, 392, 349, 293, 261, 293, 392, 440, 349, 392, 293, 440, 349];
    if (b % 2 === 0) this.tone(mel[b], 0.14, "square", 0.04);
    if (b === 0) { this.tone(146, 0.55, "sine", 0.03); this.tone(220, 0.55, "triangle", 0.025); }
    else if (b === 8) { this.tone(130, 0.55, "sine", 0.03); this.tone(196, 0.55, "triangle", 0.025); }
    if (b === 15) { for (let i = 0; i < 5; i++) this.tone(400 + i * 120, 0.1, "sine", 0.025, i * 0.06); }
    this.bgBeat++;
    this.bgTimer = setTimeout(() => this.race1Step(), beat);
  }

  // ── RACE 2 (Asteroid Field): Aggressive heavy — 160 BPM
  private race2Step() {
    if (this.bgMode !== "race2" || !this.ctx || this.muted) return;
    const b = this.bgBeat % 16; const beat = 375;
    if (b % 2 === 0) this.kick(0, 0.6);
    if (b === 1 || b === 5 || b === 9 || b === 13) this.kick(0, 0.35);
    this.hihat(0, 0.09);
    const bass = [82, 82, 82, 87, 82, 82, 98, 82, 82, 110, 82, 82, 98, 87, 82, 82];
    this.tone(bass[b], 0.22, "sawtooth", 0.10);
    this.tone(bass[b] * 0.5, 0.22, "sawtooth", 0.05);
    const mel = [330, 370, 392, 415, 440, 415, 392, 370, 349, 392, 440, 494, 523, 494, 440, 392];
    if (b % 2 === 0) this.tone(mel[b], 0.12, "square", 0.05);
    if (b === 4 || b === 12) { this.tone(220, 0.18, "sawtooth", 0.06); this.tone(233, 0.18, "sawtooth", 0.05); }
    if (b === 14) { for (let i = 0; i < 4; i++) this.tone(600 + i * 200, 0.08, "square", 0.04, i * 0.05); }
    this.bgBeat++;
    this.bgTimer = setTimeout(() => this.race2Step(), beat);
  }

  // ── RACE 3 (Crystal Planet): Epic orchestral triumph — 175 BPM
  private race3Step() {
    if (this.bgMode !== "race3" || !this.ctx || this.muted) return;
    const b = this.bgBeat % 32; const beat = 343;
    if (b % 4 === 0) this.kick(0, 0.7);
    if (b === 6 || b === 14 || b === 22 || b === 30) this.kick(0, 0.45);
    if (b % 2 === 0) this.hihat(0, 0.08);
    const bass = [65,65,65,73,65,65,82,65, 65,65,87,65,73,65,65,73,
                  98,98,98,110,98,98,87,98, 98,98,82,98,87,82,98,73];
    this.tone(bass[b], 0.28, "sawtooth", 0.08);
    const mel = [523,587,659,698,784,698,659,587,
                 523,587,659,784,880,784,659,587,
                 523,659,784,880,1047,880,784,659,
                 523,784,1047,784,659,587,523,587];
    if (b % 2 === 0) this.tone(mel[b], 0.18, "sine", 0.07);
    if (b === 0) { [523,659,784].forEach((f,i) => this.tone(f,0.4,"triangle",0.05,i*0.02)); }
    if (b === 8) { [440,523,659].forEach((f,i) => this.tone(f,0.4,"triangle",0.05,i*0.02)); }
    if (b === 16) { [523,659,784,1047].forEach((f,i) => this.tone(f,0.5,"sine",0.06,i*0.025)); }
    if (b === 24) { [392,523,659,784].forEach((f,i) => this.tone(f,0.4,"triangle",0.05,i*0.02)); }
    if (b === 0 || b === 16) this.hihat(0, 0.14);
    this.bgBeat++;
    this.bgTimer = setTimeout(() => this.race3Step(), beat);
  }

  startBackground(mode: "lobby" | "race1" | "race2" | "race3" = "lobby") {
    if (this.muted || !this.ctx) return;
    this.stopBackground();
    this.bgMode = mode;
    this.bgBeat = 0;
    if (mode === "lobby") this.lobbyStep();
    else if (mode === "race1") this.race1Step();
    else if (mode === "race2") this.race2Step();
    else this.race3Step();
  }

  stopBackground() {
    this.bgMode = "off";
    if (this.bgTimer) { clearTimeout(this.bgTimer); this.bgTimer = null; }
    if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
  }

  // Warp transition sound between phases
  playPhaseTransition() {
    if (!this.ctx || this.muted) return;
    for (let i = 0; i < 12; i++) this.tone(200 + i * 150, 0.15, "sawtooth", 0.07, i * 0.04);
    this.tone(60, 0.5, "sine", 0.15, 0.3);
    this.tone(30, 0.7, "sine", 0.10, 0.35);
    this.tone(1046.5, 0.3, "sine", 0.12, 0.5);
    this.tone(1318.5, 0.4, "sine", 0.10, 0.65);
    this.tone(1567.98, 0.5, "sine", 0.08, 0.8);
  }

  playLaunch() {
    for (let i = 0; i < 6; i++) this.tone(60 + i * 15, 0.18, "sawtooth", 0.08, i * 0.05);
    this.tone(200, 0.4, "sawtooth", 0.1, 0.1);
    this.tone(500, 0.6, "sine", 0.1, 0.3);
    this.tone(1000, 0.5, "sine", 0.08, 0.6);
  }

  /** Filtered noise burst — used for impacts, explosions and steam hisses. */
  private noiseBurst(dur: number, vol = 0.2, delay = 0, freq = 1200, type: BiquadFilterType = "lowpass") {
    if (!this.ctx || this.muted) return;
    try {
      const buf = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * dur)), this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const filt = this.ctx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + delay;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
      src.start(t); src.stop(t + dur + 0.05);
    } catch { /* ignore */ }
  }

  playCorrect() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, 0.18, "sine", 0.15, i * 0.07));
    notes.forEach((f, i) => this.tone(f, 0.25, "sine", 0.07, i * 0.07 + 0.5));
    // Sparkle shimmer on top
    [2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.12, "sine", 0.05, 0.3 + i * 0.06));
  }

  playWrong() {
    // Metallic impact + engine sputter + steam hiss
    this.noiseBurst(0.22, 0.28, 0, 900);
    this.tone(250, 0.1, "sawtooth", 0.12);
    this.tone(200, 0.12, "sawtooth", 0.1, 0.05);
    this.tone(150, 0.15, "triangle", 0.1, 0.1);
    this.tone(80, 0.3, "sine", 0.16, 0.02);
    this.noiseBurst(0.4, 0.06, 0.18, 4500, "highpass");
  }

  playBoost() {
    for (let i = 0; i < 10; i++) this.tone(300 + i * 100, 0.07, "sine", 0.12, i * 0.035);
    for (let i = 0; i < 5; i++) this.tone(80 + i * 20, 0.05, "sawtooth", 0.06, i * 0.02);
  }

  playWin() {
    const melody = [523.25, 659.25, 783.99, 659.25, 1046.5, 1318.5];
    melody.forEach((f, i) => {
      this.tone(f, 0.35, "sine", 0.18, i * 0.15);
      this.tone(f * 0.5, 0.35, "triangle", 0.08, i * 0.15);
    });
  }

  playCountdown() { this.tone(880, 0.2, "sine", 0.22); }
  playGo() {
    this.tone(523.25, 0.15, "sine", 0.25);
    this.tone(659.25, 0.2, "sine", 0.25, 0.1);
    this.tone(1046.5, 0.35, "sine", 0.22, 0.22);
  }
  playTick() { this.tone(1200, 0.04, "square", 0.06); }

  destroy() {
    this.stopBackground();
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}

// ─── Confetti — glowing stars, streamers & sparks ────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 110 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#D9A521", "#ff5d5d", "#54d8ff", "#4ade80", "#c084fc", "#fb923c", "#f472b6", "#facc15"][
      Math.floor(Math.random() * 8)
    ],
    delay: Math.random() * 2.5,
    dur: 2.6 + Math.random() * 2.2,
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 720,
    sway: (Math.random() - 0.5) * 120,
    shape: i % 5 === 0 ? "star" : i % 3 === 0 ? "streamer" : i % 2 === 0 ? "rect" : "circle",
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -40, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            y: "112vh",
            x: [`${p.x}vw`, `calc(${p.x}vw + ${p.sway}px)`, `${p.x}vw`],
            opacity: [1, 1, 0.85, 0],
            rotate: p.rotation + 720,
            scale: [1, 0.9, 0.7],
          }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: p.shape === "streamer" ? p.size * 0.35 : p.size,
            height: p.shape === "streamer" ? p.size * 2.2 : p.shape === "rect" ? p.size * 0.45 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
            clipPath: p.shape === "star"
              ? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
              : undefined,
            boxShadow: p.shape === "star" || p.shape === "circle" ? `0 0 ${p.size}px ${p.color}90` : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ─── Boost burst — shockwave ring + radial spark storm + speed streaks ───────
const BOOST_SPARKS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  angle: (i / 22) * 360 + (i % 3) * 7,
  dist: 120 + (i % 5) * 55,
  size: 3 + (i % 4) * 2.2,
  hue: i % 3 === 0 ? "#ffe14d" : i % 3 === 1 ? "#54d8ff" : "#ffffff",
  delay: (i % 6) * 0.025,
}));
function BoostParticles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 150, overflow: "hidden" }}>
      {/* Expanding shockwave rings */}
      {[0, 0.12].map((d, i) => (
        <div
          key={`ring-${i}`}
          style={{
            position: "absolute", left: "50%", top: "45%",
            width: 180, height: 180, borderRadius: "50%",
            border: `${3 - i}px solid ${i === 0 ? "rgba(255,225,77,0.9)" : "rgba(84,216,255,0.8)"}`,
            boxShadow: `0 0 30px ${i === 0 ? "rgba(255,225,77,0.5)" : "rgba(84,216,255,0.45)"}`,
            animation: `rrRing 0.75s ease-out ${d}s forwards`,
            opacity: 0,
          }}
        />
      ))}
      {/* Radial spark storm from centre */}
      {BOOST_SPARKS.map(s => {
        const rad = (s.angle * Math.PI) / 180;
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(rad) * s.dist,
              y: Math.sin(rad) * s.dist,
              scale: 0.2,
            }}
            transition={{ duration: 0.65, delay: s.delay, ease: "easeOut" }}
            style={{
              position: "absolute", left: "50%", top: "45%",
              width: s.size, height: s.size, borderRadius: "50%",
              background: s.hue,
              boxShadow: `0 0 ${s.size * 3}px ${s.hue}`,
            }}
          />
        );
      })}
      {/* Vertical speed streaks racing past */}
      {[12, 28, 46, 62, 80, 92].map((x, i) => (
        <motion.div
          key={`streak-${i}`}
          initial={{ opacity: 0, y: "-15vh" }}
          animate={{ opacity: [0, 0.9, 0], y: "115vh" }}
          transition={{ duration: 0.5, delay: i * 0.05, ease: "easeIn" }}
          style={{
            position: "absolute", left: `${x}%`, top: 0,
            width: 2.5, height: "22vh",
            background: "linear-gradient(180deg, transparent, rgba(84,216,255,0.95), transparent)",
            borderRadius: 2,
          }}
        />
      ))}
      {/* Golden flash vignette */}
      <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 45%, rgba(255,225,77,0.28) 0%, rgba(84,216,255,0.08) 45%, transparent 75%)",
        }}
      />
    </div>
  );
}

// ─── Premium spaceship — layered hull, glass cockpit, nav lights, tri-flame ──
function RocketIcon({
  color, isPlayer, size = 50, boosted = false, mega = false,
}: {
  color: string; isPlayer?: boolean; size?: number; boosted?: boolean; mega?: boolean;
}) {
  const uid = `${color.replace("#", "")}${mega ? "m" : ""}${boosted ? "b" : ""}`;
  const flameOuter = mega ? "#42fff4" : boosted ? "#ffe14d" : "#ff7a1a";
  const flameMid = mega ? "#b7fff9" : boosted ? "#fff3a8" : "#ffc247";
  const glowStrength = mega ? 22 : isPlayer ? 13 : 6;
  const smallShip = size < 26; // skip fine detail on tiny rockets for perf + clarity
  return (
    <motion.div
      animate={boosted
        ? { y: [-5, 5, -5], rotate: [-2, 2, -2] }
        : { y: [-3, 3, -3], rotate: [-0.8, 0.8, -0.8] }}
      transition={{ repeat: Infinity, duration: boosted ? 0.22 : 2.4, ease: "easeInOut" }}
      style={{ willChange: "transform" }}
    >
      <svg
        width={size}
        height={size * 1.6}
        viewBox="0 0 60 96"
        style={{
          overflow: "visible",
          filter: isPlayer
            ? `drop-shadow(0 0 ${glowStrength}px ${color}) drop-shadow(0 4px 22px rgba(255,255,255,0.35))`
            : `drop-shadow(0 2px 8px ${color}80)`,
        }}
      >
        <defs>
          {/* Metallic hull: dark edge → tint → light streak → tint → dark edge */}
          <linearGradient id={`rrHull-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
            <stop offset="26%" stopColor={color} stopOpacity="0.25" />
            <stop offset="46%" stopColor="#fff" stopOpacity="0.65" />
            <stop offset="58%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id={`rrGlass-${uid}`} cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor="#e6ffff" />
            <stop offset="45%" stopColor={mega ? "#4de8e0" : "#5ec9ff"} />
            <stop offset="100%" stopColor={mega ? "#014d4d" : "#014a7c"} />
          </radialGradient>
          <radialGradient id={`rrEngineGlow-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={flameMid} stopOpacity="0.9" />
            <stop offset="100%" stopColor={flameOuter} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Mega aura ring */}
        {mega && (
          <motion.circle cx="30" cy="50" r="30"
            animate={{ opacity: [0.15, 0.45, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.1 }}
            fill="none" stroke="#42fff4" strokeWidth="1.5" strokeDasharray="4 6" />
        )}

        {/* Speed trail when boosted — streaks trailing behind the exhaust */}
        {boosted && (
          <motion.g
            animate={{ opacity: [0.9, 0.35, 0.9] }}
            transition={{ repeat: Infinity, duration: 0.18 }}
          >
            <rect x="21" y="82" width="2" height="18" rx="1" fill={CYAN} opacity="0.75" />
            <rect x="29" y="86" width="2.5" height="24" rx="1" fill="#fff" opacity="0.8" />
            <rect x="37" y="82" width="2" height="18" rx="1" fill={CYAN} opacity="0.75" />
          </motion.g>
        )}

        {/* Engine glow halo behind flame */}
        <motion.circle
          cx="30" cy="80" r={boosted ? 15 : 10}
          fill={`url(#rrEngineGlow-${uid})`}
          animate={{ opacity: boosted ? [0.9, 1, 0.9] : [0.55, 0.85, 0.55] }}
          transition={{ repeat: Infinity, duration: boosted ? 0.15 : 0.5 }}
        />

        {/* Tri-layer exhaust flame */}
        <motion.g
          animate={{ scaleY: boosted ? [1, 1.7, 0.85, 1.5, 1] : mega ? [1, 1.45, 0.85, 1.3, 1] : [1, 1.22, 0.9, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: boosted ? 0.11 : mega ? 0.18 : 0.26 }}
          style={{ originX: "30px", originY: "77px" }}
        >
          {(mega || boosted) && (
            <path d="M14 79 Q30 112 46 79 Q40 99 30 103 Q20 99 14 79 Z" fill={mega ? "#7fffff" : "#ffd34d"} opacity="0.4" />
          )}
          <path d="M19 78 Q30 102 41 78 Q36 91 30 94 Q24 91 19 78 Z" fill={flameOuter} opacity="0.95" />
          <path d="M23 78 Q30 92 37 78 Q33 87 30 89 Q27 87 23 78 Z" fill={flameMid} opacity="0.95" />
          <path d="M26.5 78 Q30 85 33.5 78 Q32 82.5 30 83.5 Q28 82.5 26.5 78 Z" fill="#fff" opacity="0.95" />
        </motion.g>

        {/* Rear thruster housing */}
        <path d="M21 72 L39 72 L37 79 L23 79 Z" fill="#1a1d29" />
        <rect x="24" y="74" width="12" height="2.2" rx="1.1" fill={flameMid} opacity="0.8" />

        {/* Wing fins — swept, with edge light */}
        <path d="M17 46 L2 76 L17 70 Z" fill={color} />
        <path d="M17 46 L2 76 L17 70 Z" fill="#000" opacity="0.35" />
        <path d="M43 46 L58 76 L43 70 Z" fill={color} />
        <path d="M43 46 L58 76 L43 70 Z" fill="#fff" opacity="0.14" />
        {/* Fin edge glow strips */}
        <path d="M6 68 L2 76 L8 73.5 Z" fill={CYAN} opacity="0.85" />
        <path d="M54 68 L58 76 L52 73.5 Z" fill={CYAN} opacity="0.85" />

        {/* Mega extra canards */}
        {mega && <>
          <path d="M18 34 L6 50 L18 48 Z" fill={color} opacity="0.75" />
          <path d="M42 34 L54 50 L42 48 Z" fill={color} opacity="0.75" />
        </>}

        {/* Main hull — sleek teardrop */}
        <path d="M30 2 Q45 22 44 46 L44 66 Q44 74 30 75 Q16 74 16 66 L16 46 Q15 22 30 2 Z" fill={color} />
        <path d="M30 2 Q45 22 44 46 L44 66 Q44 74 30 75 Q16 74 16 66 L16 46 Q15 22 30 2 Z" fill={`url(#rrHull-${uid})`} />

        {/* Panel seams */}
        {!smallShip && <>
          <path d="M17 50 L43 50" stroke="#000" strokeWidth="0.8" opacity="0.28" />
          <path d="M18 60 L42 60" stroke="#000" strokeWidth="0.8" opacity="0.22" />
          <path d="M22 12 Q21 30 21 48" stroke="#fff" strokeWidth="0.7" opacity="0.22" fill="none" />
        </>}

        {/* Racing stripe */}
        <path d="M28 6 L32 6 L33 72 L27 72 Z" fill="#fff" opacity="0.22" />

        {/* Nose cone — polished tip */}
        <path d="M30 2 Q37 12 38 22 L22 22 Q23 12 30 2 Z" fill="#fff" opacity="0.85" />
        <path d="M30 2 Q34 8 35.5 15 L24.5 15 Q26 8 30 2 Z" fill={GOLD} opacity="0.9" />

        {/* Glass cockpit with reflection */}
        <circle cx="30" cy="38" r="8.5" fill="#0a0e1a" opacity="0.9" />
        <circle cx="30" cy="38" r="7.2" fill={`url(#rrGlass-${uid})`} />
        <ellipse cx="27.4" cy="35.4" rx="3" ry="2" fill="#fff" opacity="0.75" />
        {!smallShip && <circle cx="30" cy="38" r="8.5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.5" />}

        {/* Blinking nav lights on fin tips */}
        <motion.circle cx="4" cy="74" r="1.8" fill="#ff5d5d"
          animate={{ opacity: [1, 0.15, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
        <motion.circle cx="56" cy="74" r="1.8" fill="#4ade80"
          animate={{ opacity: [0.15, 1, 0.15] }} transition={{ repeat: Infinity, duration: 1.4 }} />

        {/* Engine intake lights along the hull */}
        {!smallShip && (
          <motion.g animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.9 }}>
            <rect x="18.5" y="54" width="2.2" height="5" rx="1.1" fill={CYAN} opacity="0.9" />
            <rect x="39.3" y="54" width="2.2" height="5" rx="1.1" fill={CYAN} opacity="0.9" />
          </motion.g>
        )}

        {/* Player crown badge */}
        {isPlayer && (
          <g>
            <circle cx="30" cy="8" r={mega ? 7 : 5.5} fill={GOLD} opacity="0.95" />
            <path d="M27 9.5 L27 6.5 L28.5 8 L30 6 L31.5 8 L33 6.5 L33 9.5 Z" fill="#fff" />
          </g>
        )}
      </svg>
    </motion.div>
  );
}

// ─── Warp speed lines — shoot from centre outward, 3-D depth illusion ────────
const WARP_CONFIGS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  angle: i * 18,
  len: 40 + (i % 5) * 14,
  dur: 0.85 + (i % 6) * 0.15,
  delay: (i * 0.13) % 1.8,
}));

function WarpField({ boosting }: { boosting: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 2 }}>
      <div style={{ position: "absolute", left: "50%", top: "42%" }}>
        {WARP_CONFIGS.map(w => (
          <motion.div
            key={w.id}
            animate={{
              scaleX: [0.02, 1],
              opacity: [0, boosting ? 0.85 : 0.24, 0],
            }}
            transition={{
              duration: boosting ? w.dur * 0.4 : w.dur,
              delay: w.delay,
              repeat: Infinity,
              ease: "easeIn",
            }}
            style={{
              position: "absolute",
              left: 0, top: -1,
              width: `${w.len}vw`,
              height: boosting ? 3.5 : 1.5,
              transformOrigin: "left center",
              transform: `rotate(${w.angle}deg)`,
              background: boosting
                ? "linear-gradient(90deg, rgba(80,200,255,0.01) 0%, rgba(160,230,255,0.55) 70%, #ffffff 100%)"
                : "linear-gradient(90deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.75) 100%)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Comet — glowing head + long ion tail ─────────────────────────────────────
function ShootingStar({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], x: -190, y: 95 }}
      transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 6 + delay * 2, ease: "easeOut" }}
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, pointerEvents: "none" }}
    >
      <div style={{ position: "relative", transform: "rotate(26deg)" }}>
        <div style={{
          width: 110, height: 2,
          background: "linear-gradient(90deg, rgba(84,216,255,0.9), rgba(255,255,255,0.35), transparent)",
          borderRadius: 2,
        }} />
        <div style={{
          width: 70, height: 1,
          marginTop: -4,
          background: "linear-gradient(90deg, rgba(255,255,255,0.5), transparent)",
          borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 0 12px 4px rgba(160,230,255,0.9)",
        }} />
      </div>
    </motion.div>
  );
}

// ─── Distant spiral galaxy + ringed planet + moon (per-phase dressing) ────────
function PlanetScape({ phase }: { phase: number }) {
  if (phase === 1) {
    // Molten planet looming on the horizon
    return (
      <>
        <div style={{
          position: "absolute", bottom: "-16%", left: "-8%",
          width: "52vmin", height: "52vmin", borderRadius: "50%",
          background: "radial-gradient(circle at 34% 30%, #ff9a3d 0%, #d94f10 34%, #7a2404 62%, #3d0f00 100%)",
          boxShadow: "0 0 90px 22px rgba(255,110,20,0.30), inset -18px -22px 60px rgba(0,0,0,0.65)",
          opacity: 0.85,
        }} />
        <motion.div
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ repeat: Infinity, duration: 4 }}
          style={{
            position: "absolute", bottom: "-16%", left: "-8%",
            width: "52vmin", height: "52vmin", borderRadius: "50%",
            background: "radial-gradient(circle at 60% 20%, transparent 55%, rgba(255,140,40,0.35) 78%, transparent 92%)",
          }} />
      </>
    );
  }
  if (phase === 2) {
    // Frozen crystal planet + small moon
    return (
      <>
        <div style={{
          position: "absolute", top: "6%", right: "-10%",
          width: "44vmin", height: "44vmin", borderRadius: "50%",
          background: "radial-gradient(circle at 36% 32%, #c9fff8 0%, #4fd8cc 30%, #0a7a86 60%, #033040 100%)",
          boxShadow: "0 0 70px 16px rgba(60,220,210,0.22), inset -16px -20px 55px rgba(0,10,20,0.6)",
          opacity: 0.8,
        }} />
        <div style={{
          position: "absolute", top: "22%", right: "12%",
          width: "9vmin", height: "9vmin", borderRadius: "50%",
          background: "radial-gradient(circle at 38% 34%, #e8fbff 0%, #9dd4e0 40%, #33606e 100%)",
          boxShadow: "inset -6px -7px 16px rgba(0,10,20,0.55)",
          opacity: 0.7,
        }} />
      </>
    );
  }
  // Phase 0 — gas giant with tilted ring + tiny moon + spiral galaxy
  return (
    <>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 240, ease: "linear" }}
        style={{
          position: "absolute", top: "8%", left: "6%",
          width: "34vmin", height: "34vmin",
          background: "conic-gradient(from 0deg, transparent 0%, rgba(150,120,255,0.35) 12%, transparent 26%, rgba(84,216,255,0.28) 42%, transparent 58%, rgba(190,120,255,0.3) 74%, transparent 92%)",
          borderRadius: "50%",
          filter: "blur(9px)",
          opacity: 0.55,
        }} />
      <div style={{
        position: "absolute", top: "20.5%", left: "18.5%",
        width: "6vmin", height: "6vmin", borderRadius: "50%",
        background: "radial-gradient(circle at 40% 35%, #fff 0%, #cbb8ff 45%, #4a3d8f 100%)",
        boxShadow: "0 0 24px 8px rgba(180,150,255,0.5)",
        opacity: 0.8,
      }} />
      {/* Ringed gas giant near horizon */}
      <div style={{ position: "absolute", bottom: "2%", right: "-6%", width: "36vmin", height: "36vmin", opacity: 0.75 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #a7c4ff 0%, #4a67d4 35%, #22307a 65%, #0c1030 100%)",
          boxShadow: "0 0 55px 12px rgba(90,130,255,0.25), inset -15px -18px 50px rgba(0,0,20,0.65)",
        }} />
        <div style={{
          position: "absolute", left: "-26%", top: "40%", width: "152%", height: "18%",
          borderRadius: "50%",
          border: "2.5px solid rgba(180,200,255,0.4)",
          borderTopColor: "transparent",
          transform: "rotate(-14deg)",
          boxShadow: "0 3px 14px rgba(140,170,255,0.25)",
        }} />
      </div>
      <div style={{
        position: "absolute", top: "38%", right: "20%",
        width: "3.4vmin", height: "3.4vmin", borderRadius: "50%",
        background: "radial-gradient(circle at 38% 34%, #f5f7ff 0%, #b8c2d9 45%, #3d4763 100%)",
        boxShadow: "inset -4px -5px 10px rgba(0,0,20,0.5)",
        opacity: 0.65,
      }} />
    </>
  );
}

// ─── Ambient dust motes drifting upward everywhere ────────────────────────────
function AmbientDust({ tint }: { tint: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 3 }}>
      {DUST_MOTES.map(m => (
        <motion.div
          key={m.id}
          animate={{ y: ["104vh", "-6vh"], x: [0, m.drift], opacity: [0, 0.55, 0.55, 0] }}
          transition={{ duration: m.dur, delay: m.delay, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", left: `${m.x}%`, top: 0,
            width: m.size, height: m.size, borderRadius: "50%",
            background: tint,
            boxShadow: `0 0 ${m.size * 2.5}px ${tint}`,
            filter: "blur(0.4px)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Deep parallax space backdrop: nebulae, galaxy, planets, 3 star layers ────
function StarField({ phase = 0 }: { phase?: number }) {
  const starColor = phase === 0 ? "#fff" : phase === 1 ? "#ffb992" : "#9dffee";
  const glowColor = phase === 0 ? "rgba(180,160,255,0.20)" : phase === 1 ? "rgba(255,110,20,0.18)" : "rgba(0,230,205,0.17)";
  const nebulaA = phase === 0 ? "rgba(110,20,200,0.22)" : phase === 1 ? "rgba(230,75,0,0.20)" : "rgba(0,215,190,0.18)";
  const nebulaB = phase === 0 ? "rgba(20,70,220,0.18)" : phase === 1 ? "rgba(170,30,0,0.16)" : "rgba(0,140,240,0.16)";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Planets / galaxy per phase */}
      <PlanetScape phase={phase} />
      {/* Breathing nebula clouds */}
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1], x: [-8, 8, -8] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        style={{ position: "absolute", top: "8%", left: "2%", width: "48vmin", height: "34vmin", filter: "blur(6px)", background: `radial-gradient(ellipse, ${nebulaA} 0%, transparent 70%)` }}
      />
      <motion.div
        animate={{ opacity: [0.5, 0.95, 0.5], scale: [1, 1.07, 1], x: [10, -10, 10] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut", delay: 2 }}
        style={{ position: "absolute", top: "46%", right: "0%", width: "42vmin", height: "30vmin", filter: "blur(6px)", background: `radial-gradient(ellipse, ${nebulaB} 0%, transparent 70%)` }}
      />
      <motion.div
        animate={{ opacity: [0.3, 0.75, 0.3] }}
        transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 4 }}
        style={{ position: "absolute", bottom: "12%", left: "18%", width: "38vmin", height: "26vmin", filter: "blur(8px)", background: `radial-gradient(ellipse, ${glowColor} 0%, transparent 70%)` }}
      />
      {/* Far stars — slowest (deepest layer) */}
      <motion.div
        animate={{ y: ["0%", "-50%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%", willChange: "transform" }}
      >
        {STAR_LAYERS[0].map(s => (
          <motion.div
            key={s.id}
            animate={s.twinkle ? { opacity: [0.2, 1, 0.3, 0.9, 0.2] } : { opacity: [0.35, 0.8, 0.35] }}
            transition={{ repeat: Infinity, duration: 2 + (s.id % 5), delay: (s.id % 7) * 0.3 }}
            style={{
              position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: starColor,
            }}
          />
        ))}
      </motion.div>
      {/* Mid stars */}
      <motion.div
        animate={{ y: ["0%", "-50%"] }}
        transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%", willChange: "transform" }}
      >
        {STAR_LAYERS[1].map(s => (
          <motion.div
            key={s.id}
            animate={s.twinkle ? { opacity: [0.3, 1, 0.3] } : { opacity: [0.5, 0.95, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 + (s.id % 4) * 0.5, delay: (s.id % 5) * 0.4 }}
            style={{
              position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: starColor,
              boxShadow: s.size > 1.4 ? `0 0 ${s.size * 3}px ${starColor}aa` : undefined,
            }}
          />
        ))}
      </motion.div>
      {/* Near stars — fastest (strongest parallax, brightest) */}
      <motion.div
        animate={{ y: ["0%", "-50%"] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: "200%", willChange: "transform" }}
      >
        {STAR_LAYERS[2].map(s => (
          <motion.div
            key={s.id}
            animate={s.twinkle ? { opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] } : { opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2 + (s.id % 4) * 0.4, delay: (s.id % 5) * 0.35 }}
            style={{
              position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: starColor,
              boxShadow: `0 0 ${s.size * 4}px ${starColor}cc`,
            }}
          />
        ))}
      </motion.div>
      {/* Comets */}
      {[{ x: 80, y: 8, delay: 4 }, { x: 55, y: 3, delay: 11 }, { x: 92, y: 18, delay: 18 }].map((s, i) => (
        <ShootingStar key={i} x={s.x} y={s.y} delay={s.delay} />
      ))}
    </div>
  );
}

// ─── Phase 2: Asteroid Field background ──────────────────────────────────────
const ASTEROID_CONFIGS = [
  { id:0, x:8, size:36, rot:1.2, dur:8, delay:0 },
  { id:1, x:75, size:24, rot:-1.8, dur:6, delay:1.5 },
  { id:2, x:22, size:48, rot:0.9, dur:11, delay:3 },
  { id:3, x:60, size:20, rot:-2.2, dur:5, delay:0.5 },
  { id:4, x:88, size:30, rot:1.6, dur:9, delay:4 },
  { id:5, x:42, size:40, rot:-1.0, dur:12, delay:2 },
  { id:6, x:15, size:22, rot:2.0, dur:7, delay:5 },
  { id:7, x:70, size:28, rot:-0.8, dur:10, delay:1 },
];
function AsteroidField() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Scrolling asteroids — cratered rocks with rim light + molten cracks */}
      {ASTEROID_CONFIGS.map(a => (
        <motion.div key={a.id}
          animate={{ y: ["-10%", "110%"], rotate: [0, a.rot * 360] }}
          transition={{ y: { duration: a.dur, delay: a.delay, repeat: Infinity, ease: "linear" }, rotate: { duration: a.dur, delay: a.delay, repeat: Infinity, ease: "linear" } }}
          style={{ position: "absolute", left: `${a.x}%`, top: 0 }}>
          <svg width={a.size} height={a.size * 0.85} viewBox="0 0 60 50" opacity={0.6} style={{ filter: "drop-shadow(0 0 6px rgba(255,120,30,0.35))" }}>
            <defs>
              <radialGradient id={`rrAst-${a.id}`} cx="0.32" cy="0.28" r="1">
                <stop offset="0%" stopColor="#b07040" />
                <stop offset="55%" stopColor="#6e3a18" />
                <stop offset="100%" stopColor="#2c1305" />
              </radialGradient>
            </defs>
            <path d="M10 12 L20 4 L38 2 L52 14 L58 28 L50 42 L34 46 L18 44 L6 32 L8 18 Z"
              fill={`url(#rrAst-${a.id})`} stroke="#e8823a" strokeWidth="1.4" strokeOpacity="0.6" />
            {/* Craters with inner shadow */}
            <ellipse cx="26" cy="17" rx="7" ry="5.5" fill="rgba(0,0,0,0.45)" />
            <ellipse cx="25" cy="16" rx="5" ry="3.8" fill="rgba(120,60,25,0.55)" />
            <ellipse cx="41" cy="33" rx="5.5" ry="4.5" fill="rgba(0,0,0,0.4)" />
            <ellipse cx="40" cy="32" rx="3.8" ry="3" fill="rgba(110,55,22,0.5)" />
            <ellipse cx="15" cy="30" rx="3.5" ry="3" fill="rgba(0,0,0,0.35)" />
            {/* Molten crack glow */}
            <path d="M34 44 L38 36 L45 32" stroke="#ff8c2e" strokeWidth="1.3" fill="none" opacity="0.8" />
            <path d="M12 20 L17 24 L15 30" stroke="#ff8c2e" strokeWidth="1" fill="none" opacity="0.6" />
            {/* Rim light (sun side) */}
            <path d="M20 4 L38 2 L52 14" stroke="#ffc27a" strokeWidth="1.6" fill="none" opacity="0.75" />
          </svg>
        </motion.div>
      ))}
      {/* Fire embers drifting */}
      {[...Array(10)].map((_, i) => (
        <motion.div key={`ember-${i}`}
          animate={{ y: ["-5vh", "105vh"], opacity: [0, 0.9, 0.9, 0], x: [0, (i % 2 === 0 ? 1 : -1) * 36] }}
          transition={{ duration: 3 + i * 0.45, delay: i * 0.7, repeat: Infinity, ease: "easeIn" }}
          style={{
            position: "absolute", top: 0, left: `${6 + i * 9.5}%`,
            width: 5 + (i % 3), height: 5 + (i % 3), borderRadius: "50%",
            background: `hsl(${15 + i * 9}, 100%, ${58 + (i % 3) * 6}%)`,
            boxShadow: `0 0 14px hsl(${15 + i * 9}, 100%, 60%)`,
          }} />
      ))}
      {/* Heat haze bands */}
      <motion.div animate={{ opacity: [0.15, 0.4, 0.15], y: [0, -18, 0] }} transition={{ repeat: Infinity, duration: 5 }}
        style={{ position: "absolute", bottom: "8%", left: 0, right: 0, height: "16%", background: "linear-gradient(180deg, transparent, rgba(255,90,10,0.14), transparent)", filter: "blur(10px)" }} />
      {/* Ambient fire nebulae */}
      <motion.div animate={{ opacity: [0.7, 1, 0.7], x: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 8 }}
        style={{ position: "absolute", top: "15%", left: "10%", width: "44vmin", height: "30vmin", filter: "blur(7px)", background: "radial-gradient(ellipse, rgba(230,60,0,0.20) 0%, transparent 70%)" }} />
      <motion.div animate={{ opacity: [0.5, 0.9, 0.5], x: [10, -10, 10] }} transition={{ repeat: Infinity, duration: 10, delay: 3 }}
        style={{ position: "absolute", bottom: "10%", right: "5%", width: "38vmin", height: "26vmin", filter: "blur(7px)", background: "radial-gradient(ellipse, rgba(255,110,0,0.16) 0%, transparent 70%)" }} />
    </div>
  );
}

// ─── Phase 3: Crystal Planet background ──────────────────────────────────────
function CrystalField() {
  const crystals = Array.from({ length: 14 }, (_, i) => ({
    id: i, x: (i / 14) * 88 + 3,
    height: 38 + (i % 4) * 24,
    width: 9 + (i % 3) * 6,
    hue: 160 + (i * 17) % 60,
    delay: (i * 0.4) % 3.5,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* Aurora curtain */}
      <motion.div
        animate={{ opacity: [0.25, 0.55, 0.25], x: [-24, 24, -24] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
        style={{
          position: "absolute", top: 0, left: "10%", width: "80%", height: "42%",
          background: "linear-gradient(180deg, rgba(80,255,220,0.16) 0%, rgba(90,140,255,0.10) 45%, transparent 100%)",
          filter: "blur(14px)",
          borderRadius: "0 0 50% 50%",
        }} />
      {/* Vertical light beams rising from the crystal surface */}
      {[16, 38, 64, 84].map((x, i) => (
        <motion.div key={`beam-${i}`}
          animate={{ opacity: [0.1, 0.42, 0.1] }}
          transition={{ repeat: Infinity, duration: 3.5 + i, delay: i * 0.8 }}
          style={{
            position: "absolute", bottom: 0, left: `${x}%`,
            width: 22, height: "48%",
            background: `linear-gradient(0deg, hsla(${168 + i * 12},100%,70%,0.34), transparent)`,
            filter: "blur(7px)",
            transform: `skewX(${i % 2 === 0 ? -4 : 4}deg)`,
          }} />
      ))}
      {/* Faceted crystals with inner shine */}
      {crystals.map(c => (
        <motion.div key={c.id}
          animate={{ y: [0, -12, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5 + c.delay, delay: c.delay, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", bottom: `${4 + (c.id % 4) * 5}%`, left: `${c.x}%`,
            width: c.width, height: c.height,
            background: `linear-gradient(160deg, hsl(${c.hue},100%,88%) 0%, hsl(${c.hue},85%,60%) 38%, hsl(${c.hue},70%,42%) 62%, hsl(${c.hue},60%,26%) 100%)`,
            clipPath: "polygon(50% 0%, 80% 30%, 100% 80%, 60% 100%, 40% 100%, 0% 80%, 20% 30%)",
            filter: `drop-shadow(0 0 8px hsl(${c.hue},100%,72%))`,
          }}>
          <div style={{
            position: "absolute", left: "28%", top: "8%", width: "16%", height: "70%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.85), transparent)",
            transform: "skewX(-6deg)",
          }} />
        </motion.div>
      ))}
      {/* Floating rotating shards */}
      {[...Array(6)].map((_, i) => (
        <motion.div key={`shard-${i}`}
          animate={{ y: [0, -30, 0], rotate: [0, 180, 360], opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 6 + i * 1.2, delay: i * 0.9, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", left: `${12 + i * 15}%`, bottom: `${30 + (i % 3) * 12}%`,
            width: 7 + (i % 3) * 3, height: 12 + (i % 3) * 5,
            background: `linear-gradient(160deg, hsl(${170 + i * 10},100%,85%), hsl(${170 + i * 10},75%,45%))`,
            clipPath: "polygon(50% 0%, 100% 40%, 65% 100%, 20% 78%)",
            filter: `drop-shadow(0 0 5px hsl(${170 + i * 10},100%,70%))`,
          }} />
      ))}
      {/* Rising sparkles */}
      {[...Array(8)].map((_, i) => (
        <motion.div key={`crystal-spark-${i}`}
          animate={{ y: [0, -65, 0], opacity: [0, 1, 0], scale: [0.5, 1.5, 0] }}
          transition={{ duration: 1.4 + i * 0.25, delay: i * 0.7, repeat: Infinity }}
          style={{
            position: "absolute", left: `${8 + i * 11}%`, bottom: `${12 + (i % 3) * 8}%`,
            width: 4, height: 4, borderRadius: "50%",
            background: `hsl(${170 + i * 8}, 100%, 78%)`,
            boxShadow: `0 0 10px hsl(${170 + i * 8}, 100%, 75%)`,
          }} />
      ))}
      <div style={{ position: "absolute", top: "10%", left: "10%", width: "46vmin", height: "34vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(0,225,200,0.13) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "5%", width: "36vmin", height: "26vmin", filter: "blur(8px)", background: "radial-gradient(ellipse, rgba(0,150,255,0.11) 0%, transparent 70%)" }} />
    </div>
  );
}

// ─── Phase Transition Overlay ────────────────────────────────────────────────
function PhaseTransitionOverlay({ gamePhase, show }: { gamePhase: number; show: boolean }) {
  if (!show) return null;
  const phases = [
    { icon: "🚀", name: "الفضاء العميق", nameEn: "Deep Space", color: "#6b21a8", label: "المرحلة الأولى" },
    { icon: "☄️", name: "حقل الكويكبات", nameEn: "Asteroid Field", color: "#c2410c", label: "المرحلة الثانية 🔥" },
    { icon: "💎", name: "كوكب الكريستال", nameEn: "Crystal Planet", color: "#0e7490", label: "المرحلة الأخيرة ⚡" },
  ];
  const p = phases[gamePhase] || phases[0];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.8, times: [0, 0.2, 0.75, 1] }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(ellipse at center, ${p.color}cc 0%, #000000d9 100%)`,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Hyperspace tunnel streaks */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle = i * 15;
        const rad = (angle * Math.PI) / 180;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scaleX: 0.05 }}
            animate={{ opacity: [0, 0.85, 0], scaleX: [0.05, 1] }}
            transition={{ duration: 0.8, delay: (i % 8) * 0.07, repeat: 1, ease: "easeIn" }}
            style={{
              position: "absolute", left: "50%", top: "50%",
              width: "56vmax", height: i % 3 === 0 ? 3 : 1.8,
              transformOrigin: "left center",
              transform: `rotate(${angle}deg)`,
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 100%)`,
              borderRadius: 2,
              // Small radial offset so lines start away from centre
              marginLeft: Math.cos(rad) * 30,
              marginTop: Math.sin(rad) * 30,
            }}
          />
        );
      })}
      {/* Central flash */}
      <motion.div
        initial={{ opacity: 0.9, scale: 0.2 }}
        animate={{ opacity: 0, scale: 3.2 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{
          position: "absolute", width: "34vmin", height: "34vmin", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, transparent 70%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, times: [0, 0.3, 0.7, 1] }}
        style={{ textAlign: "center", position: "relative" }}
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.35, 1] }}
          transition={{ duration: 0.6, repeat: 2 }}
          style={{ fontSize: 64, marginBottom: 12, display: "inline-block", filter: `drop-shadow(0 0 24px ${p.color})` }}
        >
          {p.icon}
        </motion.div>
        <div style={{
          color: "#fff", fontSize: 30, fontWeight: 900, letterSpacing: 1,
          textShadow: `0 0 34px ${p.color}, 0 0 70px ${p.color}90, 0 2px 4px rgba(0,0,0,0.8)`,
        }}>
          {p.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginTop: 4, letterSpacing: 4, textTransform: "uppercase" }}>{p.nameEn}</div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -8] }}
          transition={{ duration: 1.8, times: [0.2, 0.35, 0.7, 1] }}
          style={{
            marginTop: 18, color: "#fff", fontSize: 16, fontWeight: 800,
            background: `linear-gradient(135deg, ${p.color}b3, ${p.color}66)`,
            padding: "9px 28px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.5)",
            boxShadow: `0 0 26px ${p.color}80, inset 0 1px 0 rgba(255,255,255,0.35)`,
            display: "inline-block",
            backdropFilter: "blur(6px)",
          }}
        >
          {p.label}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Many players: horizontally scrollable vertical lanes ─────────────────────
function HorizontalRocketLanesStrip({
  trackPlayers,
  queryName,
  displayAltitude,
  gamePhase,
  boostFlash,
  variant,
  ar,
}: {
  trackPlayers: Player[];
  queryName: string;
  displayAltitude: (p: Player) => number;
  gamePhase: number;
  boostFlash: boolean;
  variant: "mobile" | "desktop";
  ar: boolean;
}) {
  const n = Math.max(1, trackPlayers.length);
  const laneW =
    variant === "mobile"
      ? n >= 24 ? 34 : n >= 18 ? 38 : n >= 12 ? 42 : 44
      : n >= 24 ? 40 : n >= 18 ? 46 : 52;

  const laneBg =
    gamePhase === 0
      ? "linear-gradient(180deg, rgba(84,120,255,0.10), rgba(255,255,255,0.04))"
      : gamePhase === 1
        ? "linear-gradient(180deg, rgba(230,90,10,0.16), rgba(120,40,0,0.08))"
        : "linear-gradient(180deg, rgba(0,220,190,0.13), rgba(0,90,90,0.06))";

  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        display: "flex",
        flexDirection: "row",
        gap: variant === "mobile" ? 4 : 8,
        alignItems: "stretch",
        padding: variant === "mobile" ? "4px 4px 6px 2px" : "6px 8px",
        scrollbarGutter: "stable",
        width: "100%",
        height: variant === "mobile" ? "min(160px, 32vh)" : "100%",
        maxHeight: variant === "desktop" ? "100%" : undefined,
        boxSizing: "border-box",
      }}
      title={ar ? "مرّر أفقياً لرؤية جميع المتسابقين" : "Scroll sideways to see all racers"}
    >
      {trackPlayers.map((p, idx) => {
        const isMe = p.name === queryName;
        const isMega = isMe && gamePhase === 2;
        const medals = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
        const alt = displayAltitude(p); // raw altitude (continuous)
        const orbit = 0;
        const rz =
          isMega ? (variant === "mobile" ? 36 : 40)
          : laneW <= 38 ? (isMe ? 26 : 20)
          : laneW <= 42 ? (isMe ? 30 : 24)
          : isMe ? (variant === "mobile" ? 32 : 34) : variant === "mobile" ? 26 : 24;
        const headerH = variant === "mobile" ? 26 : 30;
        const shortName =
          p.name.length > 14 ? `${p.name.slice(0, 11)}…` : p.name;
        return (
          <div
            key={p.name}
            style={{
              width: laneW,
              minWidth: laneW,
              flexShrink: 0,
              position: "relative",
              alignSelf: "stretch",
              minHeight: variant === "mobile" ? 148 : undefined,
              height: variant === "desktop" ? "100%" : undefined,
              borderRadius: variant === "mobile" ? 9 : 12,
              background: laneBg,
              border: isMe ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.12)",
              boxSizing: "border-box",
            }}
          >
            <div style={{
              height: headerH,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "2px 2px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: variant === "mobile" ? 8 : 9,
              fontWeight: 900,
              color: "#fff",
              overflow: "hidden",
            }}>
              <span style={{ opacity: 0.9 }}>#{idx + 1}</span>
              {medals ? <span aria-hidden>{medals}</span> : null}
              {variant === "mobile"
                ? <span style={{ fontSize: 12 }} aria-hidden>{p.avatar}</span>
                : (
                  <span style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: laneW - 24,
                  }}
                  >
                    {shortName}
                  </span>
                )}
            </div>
            <div style={{
              position: "absolute",
              left: variant === "mobile" ? 2 : 3,
              top: headerH + 4,
              bottom: variant === "mobile" ? 22 : 28,
              width: 6,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "rgba(255,255,255,0.38)",
              fontSize: variant === "mobile" ? 6 : 7,
              fontWeight: 700,
            }}>
              {[100, 75, 50, 25, 0].map(v => (
                <span key={v} style={{ lineHeight: 1 }}>{v}</span>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                left: 10,
                right: variant === "mobile" ? 2 : 4,
                top: headerH + 4,
                bottom: variant === "mobile" ? 22 : 28,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 1,
                  transform: "translateX(-50%)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                  borderRadius: 1,
                  pointerEvents: "none",
                }}
              />
              <motion.div
                animate={{ bottom: `${alt}%` }}
                transition={{ type: "spring", stiffness: 54, damping: 16 }}
                initial={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  zIndex: 2,
                }}
              >
                <RocketIcon
                  color={p.rocketColor}
                  isPlayer={isMe}
                  size={rz}
                  boosted={isMe && boostFlash}
                  mega={isMega}
                />
              </motion.div>
            </div>
            <div style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 2,
              textAlign: "center",
              fontSize: variant === "mobile" ? 8 : 9,
              fontWeight: 800,
              color: isMe ? GOLD : "rgba(255,255,255,0.9)",
              lineHeight: 1.2,
            }}>
              <div>{orbit > 0 ? <span style={{ color: "#88ffee" }}>🌀{orbit} </span> : null}{Math.round(alt)}%</div>
              <div style={{ color: GOLD, fontSize: variant === "mobile" ? 7 : 8 }}>{p.score} pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Power-up tray (boost + multiplier) ───────────────────────────────────────
function PowerUpTray({
  ar,
  boostAvailable,
  multiplierAvailable,
  boostArmed,
  multiplierArmed,
  onUse,
}: {
  ar: boolean;
  boostAvailable: number;
  multiplierAvailable: number;
  boostArmed: boolean;
  multiplierArmed: boolean;
  onUse: (kind: "boost" | "multiplier") => void;
}) {
  // Hide the tray entirely until the player has earned at least one power-up.
  if (boostAvailable === 0 && multiplierAvailable === 0 && !boostArmed && !multiplierArmed) return null;
  return (
    <div
      style={{
        display: "flex", justifyContent: "center", gap: 10,
        padding: "8px 12px",
        background: "rgba(0,0,0,0.35)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <PowerButton
        kind="boost"
        ar={ar}
        count={boostAvailable}
        armed={boostArmed}
        onClick={() => onUse("boost")}
      />
      <PowerButton
        kind="multiplier"
        ar={ar}
        count={multiplierAvailable}
        armed={multiplierArmed}
        onClick={() => onUse("multiplier")}
      />
    </div>
  );
}

function PowerButton({
  kind, ar, count, armed, onClick,
}: { kind: "boost" | "multiplier"; ar: boolean; count: number; armed: boolean; onClick: () => void }) {
  const disabled = count === 0 && !armed;
  const label = kind === "boost"
    ? (ar ? "دفع ×٢ ارتفاع" : "Boost ×2 altitude")
    : (ar ? "مضاعف ×٢ نقاط" : "Multiplier ×2 score");
  const icon = kind === "boost" ? "🚀" : "⭐";
  const accent = kind === "boost" ? "#3aa3ff" : "#D9A521";
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      animate={armed ? { boxShadow: [`0 0 0 0 ${accent}80`, `0 0 18px 7px ${accent}50`, `0 0 0 0 ${accent}80`] } : {}}
      transition={{ repeat: armed ? Infinity : 0, duration: 1.1 }}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 999,
        background: armed
          ? `linear-gradient(135deg, ${accent}, ${accent}aa)`
          : disabled ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))`,
        color: armed ? "#fff" : disabled ? "rgba(255,255,255,0.35)" : "#fff",
        border: `1.5px solid ${armed ? "#fff" : disabled ? "rgba(255,255,255,0.08)" : `${accent}90`}`,
        fontWeight: 800, fontSize: 12, lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        backdropFilter: "blur(6px)",
      }}
      aria-pressed={armed}
      aria-label={label}
    >
      {!disabled && (
        <span aria-hidden style={{
          position: "absolute", top: 0, bottom: 0, width: "45%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
          animation: "rrShine 2.6s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}
      <span style={{ fontSize: 16, filter: `drop-shadow(0 0 6px ${accent})` }}>{icon}</span>
      <span>{label}</span>
      {count > 0 && (
        <span style={{
          background: armed ? "rgba(255,255,255,0.25)" : `${accent}30`,
          color: armed ? "#fff" : accent,
          padding: "2px 7px", borderRadius: 999,
          fontSize: 11, fontWeight: 900, fontVariantNumeric: "tabular-nums",
        }}>×{count}</span>
      )}
      {armed && (
        <span style={{
          position: "absolute", top: -6, insetInlineEnd: -6,
          background: "#fff", color: accent,
          fontSize: 9, fontWeight: 900,
          padding: "2px 6px", borderRadius: 999,
          border: `1.5px solid ${accent}`,
        }}>{ar ? "جاهز" : "ARMED"}</span>
      )}
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RocketPlay() {
  const params = useParams<{ pin: string }>();
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const queryName = sp.get("name") || "";
  const queryAvatar = sp.get("avatar") || "🦁";
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const pin = params.pin || "";

  const [muted, setMutedState] = useState(() => {
    try { return localStorage.getItem("rocket-music-muted") === "1"; } catch { return false; }
  });
  const soundRef = useRef<RocketSoundEngine | null>(null);
  if (!soundRef.current) soundRef.current = new RocketSoundEngine();

  const [phase, setPhase] = useState<"connecting" | "lobby" | "countdown" | "racing" | "finished">("connecting");
  const [myAltitude, setMyAltitude] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [myColor, setMyColor] = useState("#dc2626");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctIndex?: number; correctText?: string } | null>(null);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);
  const [countdownNum, setCountdownNum] = useState(3);
  const [fillAnswer, setFillAnswer] = useState("");
  const [boostFlash, setBoostFlash] = useState(false);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  /** Live cruise velocity for the local player (1 = base, peaks ~4× after a correct answer). */
  const [myVelocity, setMyVelocity] = useState(1);
  const [chosenWrongIdx, setChosenWrongIdx] = useState<number | null>(null); // display index of wrong choice
  const questionArrivalCountRef = useRef(0); // increments every time a new question arrives

  // Shuffled question display (options reordered each question)
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [optionMapping, setOptionMapping] = useState<number[]>([]); // displayIdx → originalIdx
  const wrongAutoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rank tracking
  const [myRank, setMyRank] = useState(0);
  const [title, setTitle] = useState("");
  const [encouragement, setEncouragement] = useState<string | null>(null);

  // Race timer (1-15 min, set by teacher; race auto-ends at 0)
  const [gameTimeLeft, setGameTimeLeft] = useState<number | null>(null);

  // Power-ups (server-validated): boost = ×2 altitude, multiplier = ×2 score on next correct answer
  const [boostAvailable, setBoostAvailable] = useState(0);
  const [multiplierAvailable, setMultiplierAvailable] = useState(0);
  const [boostArmed, setBoostArmed] = useState(false);
  const [multiplierArmed, setMultiplierArmed] = useState(false);
  const [powerToast, setPowerToast] = useState<{ kind: "boost" | "multiplier"; action: "earned" | "used"; key: number } | null>(null);

  // ─── Game Phase (0=Space, 1=Asteroids, 2=Crystal) — server-driven, monotonic ─
  const [gamePhase, setGamePhase] = useState(0);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const prevGamePhaseRef = useRef(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => { soundRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => () => { soundRef.current?.destroy(); }, []);

  // Track rank changes (announcements only after race ends — not during)
  useEffect(() => {
    if (phase !== "finished" || !queryName || players.length === 0) return;
    const sorted = [...players].sort((a, b) => b.score !== a.score ? b.score - a.score : b.altitude - a.altitude);
    const rank = sorted.findIndex(p => p.name === queryName) + 1;
    if (rank > 0) setMyRank(rank);
  }, [players, queryName, phase]);

  // Shuffle options on every new question arrival (not just by index, which
  // would repeat the same shuffle on the second cycle through questions).
  const [shuffleTick, setShuffleTick] = useState(0);
  /** per_player vs host_sync — same question for all until teacher advances */
  const [advanceMode, setAdvanceMode] = useState<"per_player" | "host_sync">("per_player");
  const phaseRef = useRef(phase);
  const advanceModeRef = useRef(advanceMode);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { advanceModeRef.current = advanceMode; }, [advanceMode]);
  useEffect(() => {
    if (!currentQ || currentQ.type === "fill_blank") {
      setShuffledOptions(currentQ?.options || []);
      setOptionMapping((currentQ?.options || []).map((_, i) => i));
      return;
    }
    const indices = currentQ.options.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledOptions(indices.map(i => currentQ.options[i]));
    setOptionMapping(indices);
  }, [shuffleTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Race timer — counts down once gameTimeLeft is set; race auto-ends server-side at 0.
  useEffect(() => {
    if (phase !== "racing" || gameTimeLeft === null) return;
    if (gameTimeLeft <= 0) return;
    const intv = setInterval(() => {
      setGameTimeLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(intv);
  }, [phase, gameTimeLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // (Phase derivation moved to server — driven by `phase` field on socket events.)
  // Connect & join
  useEffect(() => {
    if (!pin || !queryName) { setLocation(`/game/rocket/join/${pin}`); return; }
    const socket = getRocketSocket();

    const joinFlow = () => {
      socket.emit("rocket:rejoin", { pin, name: queryName, avatar: queryAvatar }, (res: {
        success?: boolean; error?: string;
        state?: string; altitude?: number; score?: number;
        totalQuestions?: number; rocketColor?: string; activeQuestion?: Question | null;
        finished?: boolean; finishRank?: number; title?: string;
        totalDurationSecs?: number;
        advanceMode?: "per_player" | "host_sync";
        phase?: number;
        boostAvailable?: number; multiplierAvailable?: number;
        boostArmed?: boolean; multiplierArmed?: boolean;
      }) => {
        if (res.error) { toast.error(res.error); setLocation(`/game/rocket/join/${pin}`); return; }
        if (res.success) {
          if (res.advanceMode) setAdvanceMode(res.advanceMode);
          setMyColor(res.rocketColor || "#dc2626");
          setTotalQuestions(res.totalQuestions || 0);
          if (res.title) setTitle(res.title);
          setMyAltitude(res.altitude ?? 0);
          setMyScore(res.score ?? 0);
          if (typeof res.phase === "number") {
            setGamePhase(res.phase);
            prevGamePhaseRef.current = res.phase;
          }
          if (typeof (res as { velocity?: number }).velocity === "number") {
            setMyVelocity((res as { velocity: number }).velocity);
          }
          setBoostAvailable(res.boostAvailable ?? 0);
          setMultiplierAvailable(res.multiplierAvailable ?? 0);
          setBoostArmed(!!res.boostArmed);
          setMultiplierArmed(!!res.multiplierArmed);
          const st = res.state;
          if (st === "countdown") {
            setPhase("countdown");
            setCountdownNum(3);
            soundRef.current?.startBackground("lobby");
          } else if (st === "racing") {
            setPhase("racing");
            soundRef.current?.startBackground("race1");
            if (typeof res.totalDurationSecs === "number") setGameTimeLeft(res.totalDurationSecs);
            if (res.activeQuestion) {
              setCurrentQ(res.activeQuestion);
              setQuestionStartTime(Date.now());
              setShuffleTick(c => c + 1);
            }
          } else if (st === "finished") {
            setPhase("finished");
          } else {
            setPhase("lobby");
            soundRef.current?.startBackground("lobby");
          }
        }
      });
    };

    if (socket.connected) joinFlow();
    socket.on("connect", joinFlow);

    socket.on("rocket:players-updated", (data: { players: Player[] }) => setPlayers(data.players));

    socket.on("rocket:countdown", () => {
      setPhase("countdown");
      setCountdownNum(3);
      soundRef.current?.startBackground("lobby");
    });

    socket.on("rocket:race-start", (data: {
      total: number;
      question: Question;
      advanceMode?: "per_player" | "host_sync";
      gameDuration?: number;
      totalDurationSecs?: number;
    }) => {
      setPhase("racing");
      setAdvanceMode(data.advanceMode ?? "per_player");
      soundRef.current?.startBackground("race1");
      setTotalQuestions(data.total);
      setCurrentQ(data.question);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setShuffleTick(c => c + 1);
      // Initialize race timer (race-wide). Server is authoritative; this is a UI countdown.
      const dur = data.totalDurationSecs ?? data.gameDuration ?? null;
      if (typeof dur === "number") setGameTimeLeft(dur);
      // Reset phase + power-ups for a fresh race.
      setGamePhase(0);
      prevGamePhaseRef.current = 0;
      setBoostAvailable(0);
      setMultiplierAvailable(0);
      setBoostArmed(false);
      setMultiplierArmed(false);
      setMyVelocity(1);
      soundRef.current?.playLaunch();
    });

    socket.on("rocket:next-question", (q: Question & { phase?: number }) => {
      questionArrivalCountRef.current += 1;
      setCurrentQ(q);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setFillAnswer("");
      setEncouragement(null);
      setChosenWrongIdx(null);
      setShuffleTick(c => c + 1);
      // Allow the player to answer again — even if the server re-served the
      // same question idx after a wrong answer (per_player phase replay).
      submittedQuestionIdxRef.current = null;
      submittingRef.current = false;
      if (typeof q.phase === "number" && q.phase !== prevGamePhaseRef.current) {
        prevGamePhaseRef.current = q.phase;
        setGamePhase(q.phase);
        setShowPhaseTransition(true);
        setTimeout(() => setShowPhaseTransition(false), 1800);
        soundRef.current?.playPhaseTransition();
        const modes = ["race1", "race2", "race3"] as const;
        soundRef.current?.startBackground(modes[Math.min(2, q.phase)]);
      }
    });

    socket.on("rocket:sync-question", (q: Question) => {
      questionArrivalCountRef.current += 1;
      setCurrentQ(q);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setFillAnswer("");
      setEncouragement(null);
      setChosenWrongIdx(null);
      setShuffleTick(c => c + 1);
      submittedQuestionIdxRef.current = null;
      submittingRef.current = false;
    });

    socket.on("rocket:leaderboard", (data: { players: Player[] }) => setPlayers(data.players));

    // Continuous cruise: server tick (every 1s) gives every rocket passive forward
    // motion. We update the leaderboard, our own altitude, and react to the
    // time-driven phase progression that all players share.
    socket.on("rocket:cruise", (data: { players: Player[]; phase: number; phaseChanged: boolean }) => {
      setPlayers(data.players);
      const me = data.players.find((p) => p.name === queryName);
      if (me) {
        setMyAltitude(me.altitude);
        if (typeof me.velocity === "number") setMyVelocity(me.velocity);
      }
      if (data.phase !== prevGamePhaseRef.current) {
        prevGamePhaseRef.current = data.phase;
        setGamePhase(data.phase);
        if (data.phaseChanged) {
          setShowPhaseTransition(true);
          setTimeout(() => setShowPhaseTransition(false), 1800);
          soundRef.current?.playPhaseTransition();
          const modes = ["race1", "race2", "race3"] as const;
          soundRef.current?.startBackground(modes[Math.min(2, data.phase)]);
        }
      }
    });

    socket.on("rocket:game-end", (data: { players: Player[] }) => {
      setPhase("finished");
      setGameTimeLeft(0);
      if (data.players) setPlayers(data.players);
      soundRef.current?.stopBackground();
      soundRef.current?.playWin();
    });

    socket.on("rocket:replay", () => {
      setMyAltitude(0); setMyScore(0); setMyStreak(0);
      setPhase("lobby");
      setAdvanceMode("per_player");
      setGamePhase(0);
      prevGamePhaseRef.current = 0;
      setBoostAvailable(0);
      setMultiplierAvailable(0);
      setBoostArmed(false);
      setMultiplierArmed(false);
      setMyVelocity(1);
      setGameTimeLeft(null);
    });

    return () => {
      socket.off("rocket:players-updated");
      socket.off("rocket:countdown");
      socket.off("rocket:race-start");
      socket.off("rocket:next-question");
      socket.off("rocket:sync-question");
      socket.off("rocket:leaderboard");
      socket.off("rocket:cruise");
      socket.off("rocket:game-end");
      socket.off("rocket:replay");
      socket.off("connect", joinFlow);
    };
  }, [pin, queryName, queryAvatar, setLocation]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    soundRef.current?.playCountdown();
    const intv = setInterval(() => {
      setCountdownNum(n => {
        if (n <= 1) { clearInterval(intv); soundRef.current?.playGo(); return 0; }
        soundRef.current?.playCountdown();
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(intv);
  }, [phase]);

  const submittingRef = useRef(false);
  const submittedQuestionIdxRef = useRef<number | null>(null);

  const submitAnswer = useCallback((answerIndex: number, answerText?: string) => {
    if (!currentQ) return;
    if (phaseRef.current !== "racing") return;
    // Per-question idempotency: ignore double clicks / late timer fires for the same question.
    if (submittingRef.current) return;
    if (submittedQuestionIdxRef.current === currentQ.index) return;
    submittingRef.current = true;
    const submittingFor = currentQ.index;
    const socket = getRocketSocket();
    socket.emit("rocket:answer", {
      pin, answerIndex, answerText,
      questionIdx: currentQ.index,
    }, (res: {
      success?: boolean; error?: string; skipped?: boolean;
      correct?: boolean; altitudeChange?: number;
      correctIndex?: number; correctText?: string;
      altitude?: number; score?: number; streak?: number;
      phase?: number; phaseAdvanced?: boolean;
      boostAvailable?: number; multiplierAvailable?: number;
      boostArmed?: boolean; multiplierArmed?: boolean;
      grantedPower?: "boost" | "multiplier" | null;
      consumedBoost?: "boost" | null;
      consumedMultiplier?: "multiplier" | null;
    }) => {
      submittingRef.current = false;
      if (res.error) { toast.error(res.error); return; }
      if (!res.success || res.skipped) return;
      submittedQuestionIdxRef.current = submittingFor;

      setFeedback({ correct: !!res.correct, correctIndex: res.correctIndex, correctText: res.correctText });
      if (typeof res.altitude === "number") setMyAltitude(res.altitude);
      if (typeof res.score === "number") setMyScore(res.score);
      if (typeof res.streak === "number") setMyStreak(res.streak);

      // Sync power-up state from server.
      if (typeof res.boostAvailable === "number") setBoostAvailable(res.boostAvailable);
      if (typeof res.multiplierAvailable === "number") setMultiplierAvailable(res.multiplierAvailable);
      if (typeof res.boostArmed === "boolean") setBoostArmed(res.boostArmed);
      if (typeof res.multiplierArmed === "boolean") setMultiplierArmed(res.multiplierArmed);

      // Show a brief toast when a new power-up is earned, or when one fires.
      const fired = res.consumedBoost ?? res.consumedMultiplier ?? null;
      if (res.grantedPower) {
        const k = Date.now();
        setPowerToast({ kind: res.grantedPower, action: "earned", key: k });
        setTimeout(() => setPowerToast((cur) => (cur && cur.key === k ? null : cur)), 1800);
      } else if (fired) {
        const k = Date.now();
        setPowerToast({ kind: fired, action: "used", key: k });
        setTimeout(() => setPowerToast((cur) => (cur && cur.key === k ? null : cur)), 1500);
      }

      // Phase changes are now broadcast by the server cruise loop — we only
      // sync the cached value here so it stays current without firing a
      // duplicate transition overlay/sound.
      if (typeof res.phase === "number" && res.phase !== prevGamePhaseRef.current) {
        prevGamePhaseRef.current = res.phase;
        setGamePhase(res.phase);
      }

      if (res.correct) {
        soundRef.current?.playCorrect();
        setEncouragement(ar ? pick(CORRECT_AR) : pick(CORRECT_EN));
        setBoostFlash(true);
        setTimeout(() => setBoostFlash(false), 900);
        setTimeout(() => soundRef.current?.playBoost(), 150);
      } else {
        soundRef.current?.playWrong();
        setEncouragement(ar ? pick(WRONG_AR) : pick(WRONG_EN));
        setPenaltyFlash(true);
        setTimeout(() => setPenaltyFlash(false), 900);
        if (answerIndex >= 0) {
          const displayIdx = optionMapping.indexOf(answerIndex);
          setChosenWrongIdx(displayIdx >= 0 ? displayIdx : null);
        }
      }

      if (wrongAutoRef.current) clearTimeout(wrongAutoRef.current);
      wrongAutoRef.current = setTimeout(() => {
        setFeedback(null);
        setFillAnswer("");
        setEncouragement(null);
        setChosenWrongIdx(null);
      }, 2000);
    });
  }, [currentQ, pin, ar, optionMapping]);

  // Per-question timer — auto-skip at 0 only in per_player (host advances in host_sync)
  useEffect(() => {
    if (phase !== "racing" || !currentQ) return;
    setTimeLeft(currentQ.duration);
    const startMs = Date.now();
    const qDur = currentQ.duration;
    const intv = setInterval(() => {
      if (advanceModeRef.current === "host_sync") {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        setTimeLeft(Math.max(0, qDur - elapsed));
        return;
      }
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const remaining = Math.max(0, qDur - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 3 && remaining > 0) soundRef.current?.playTick();
      if (remaining === 0) {
        clearInterval(intv);
        if (feedbackRef.current || phaseRef.current !== "racing") return;
        submitAnswer(-1);
      }
    }, 1000);
    return () => clearInterval(intv);
  }, [currentQ?.index, phase, advanceMode, submitAnswer]);

  /** Live altitude on track — raw value (no modulo, track scrolls continuously). */
  const displayAltitude = (p: Player) => {
    return p.name === queryName ? myAltitude : p.altitude;
  };
  /**
   * Desktop vertical track: camera follows the player so they sit ~30% from the
   * bottom; rivals are offset by their altitude difference. Track scrolls
   * continuously without a visual ceiling.
   */
  const trackBottomPct = (p: Player) => {
    const rawP = p.name === queryName ? myAltitude : p.altitude;
    const diff = rawP - myAltitude;
    return Math.max(2, Math.min(94, 30 + diff * 1.2));
  };
  /**
   * Mobile horizontal track: camera follows player so they're always at 30%
   * from the left, rivals offset by raw altitude difference × scale.
   */
  const trackLeftPct = (p: Player) => {
    const rawP = p.name === queryName ? myAltitude : p.altitude;
    const diff = rawP - myAltitude;
    return Math.max(5, Math.min(88, 30 + diff * 1.2));
  };

  // Map display index back to original index before submitting
  const handleMCQAnswer = (displayIdx: number) => {
    if (feedback) return;
    const originalIdx = optionMapping[displayIdx] ?? displayIdx;
    submitAnswer(originalIdx);
  };
  const handleFillSubmit = () => {
    if (!fillAnswer.trim() || feedback) return;
    submitAnswer(-1, fillAnswer.trim());
  };

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.altitude - a.altitude;
  });

  /** During race, show all rockets so everyone sees relative positions (sorted by score/altitude). */
  const trackPlayers = sortedPlayers;
  const crowdedRocketLanes =
    phase === "racing" && trackPlayers.length >= ROCKET_HORIZONTAL_LANES_MIN;

  // ─── Connecting ─────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div style={{ minHeight: "100dvh", background: SPACE_BG, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center" }}>
        <style>{RR_KEYFRAMES}</style>
        <StarField />
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 84, height: 84 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `2.5px solid transparent`, borderTopColor: GOLD, borderInlineEndColor: `${GOLD}60`,
              animation: "rrSpin 1s linear infinite",
            }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🚀</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700, fontSize: 13, letterSpacing: 1, animation: "rrPulse 1.6s ease-in-out infinite" }}>
            {ar ? "جارٍ الاتصال بالمحطة..." : "Connecting to station..."}
          </span>
        </div>
      </div>
    );
  }

  const dustTint = gamePhase === 0 ? "rgba(170,190,255,0.7)" : gamePhase === 1 ? "rgba(255,170,90,0.7)" : "rgba(110,255,230,0.7)";

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100dvh",
        background: PHASE_BACKGROUNDS[gamePhase],
        position: "relative", overflow: "hidden",
        transition: "background 2s ease",
        // Cinematic camera shake — hard judder on wrong answers, energetic rumble on boosts
        animation: penaltyFlash
          ? "rrShakeHard 0.55s ease-in-out"
          : boostFlash
            ? "rrShakeSoft 0.65s ease-in-out"
            : undefined,
      }}
    >
      <style>{RR_KEYFRAMES}</style>
      <StarField phase={gamePhase} />
      {gamePhase === 1 && <AsteroidField />}
      {gamePhase === 2 && <CrystalField />}
      <WarpField boosting={boostFlash} />
      <AmbientDust tint={dustTint} />
      <PhaseTransitionOverlay gamePhase={gamePhase} show={showPhaseTransition} />
      <BoostParticles active={boostFlash} />

      {/* Penalty impact (wrong answer) — red vignette + sparks + engine smoke */}
      <AnimatePresence>
        {penaltyFlash && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none", overflow: "hidden" }}
          >
            {/* Red alert vignette */}
            <motion.div
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 0.25, 0.5, 0] }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, rgba(220,38,38,0.30) 0%, rgba(160,0,0,0.42) 62%, rgba(120,0,0,0.6) 100%)",
              }}
            />
            {/* Electric sparks scattering */}
            {Array.from({ length: 14 }, (_, i) => {
              const angle = (i / 14) * 360 + 12;
              const rad = (angle * Math.PI) / 180;
              const dist = 90 + (i % 4) * 45;
              return (
                <motion.div
                  key={`spark-${i}`}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{ opacity: 0, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist + 40, scale: 0.15 }}
                  transition={{ duration: 0.55, delay: (i % 5) * 0.03, ease: "easeOut" }}
                  style={{
                    position: "absolute", left: "50%", top: "48%",
                    width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2,
                    background: i % 3 === 0 ? "#ffd166" : "#ff6b4a",
                    borderRadius: i % 2 === 0 ? "50%" : 1,
                    boxShadow: `0 0 8px ${i % 3 === 0 ? "#ffd166" : "#ff6b4a"}`,
                  }}
                />
              );
            })}
            {/* Engine failure smoke puffs drifting up */}
            {[42, 50, 58].map((x, i) => (
              <motion.div
                key={`smoke-${i}`}
                initial={{ opacity: 0.55, scale: 0.4, y: 0 }}
                animate={{ opacity: 0, scale: 1.9, y: -110 }}
                transition={{ duration: 0.95, delay: i * 0.09, ease: "easeOut" }}
                style={{
                  position: "absolute", left: `${x}%`, top: "56%",
                  width: 46, height: 46, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(90,90,100,0.75) 0%, rgba(60,60,70,0.4) 55%, transparent 80%)",
                  filter: "blur(3px)",
                }}
              />
            ))}
            {/* Warning stripes flash at edges */}
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: [0.8, 0, 0.6, 0] }}
              transition={{ duration: 0.8 }}
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 5,
                background: "repeating-linear-gradient(45deg, #ff3b3b 0, #ff3b3b 16px, #2b0000 16px, #2b0000 32px)",
              }}
            />
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: [0.8, 0, 0.6, 0] }}
              transition={{ duration: 0.8 }}
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 5,
                background: "repeating-linear-gradient(45deg, #ff3b3b 0, #ff3b3b 16px, #2b0000 16px, #2b0000 32px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top HUD bar */}
      <div style={{
        position: "relative", zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "linear-gradient(180deg, rgba(8,12,32,0.72), rgba(8,12,32,0.45))",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(120,160,255,0.16)",
        boxShadow: "0 1px 0 rgba(84,216,255,0.12), 0 8px 26px -14px rgba(0,0,0,0.85)",
        flexWrap: "wrap", gap: 8,
      }}>
        {/* Player info */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", minWidth: 0 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{queryAvatar}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{queryName}</p>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.75 }}>
              {ar ? "نقاط:" : "Score:"} <span style={{ color: GOLD, fontWeight: 700 }}>{myScore}</span>
              {myStreak >= 3 && <span style={{ marginInlineStart: 8, color: "#ff6b1a" }}>🔥 ×{myStreak}</span>}
            </p>
          </div>
          {/* Rank badge */}
          {myRank > 0 && phase === "finished" && (
            <motion.div
              key={myRank}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: myRank === 1 ? "linear-gradient(135deg,#D9A521,#c89212)"
                  : myRank === 2 ? "linear-gradient(135deg,#94a3b8,#64748b)"
                  : myRank === 3 ? "linear-gradient(135deg,#cd7f32,#a0522d)"
                  : "rgba(255,255,255,0.15)",
                borderRadius: 999, padding: "3px 10px",
                fontWeight: 900, fontSize: 13, color: myRank <= 3 ? "#000" : "#fff",
                border: myRank === 1 ? "1.5px solid #D9A521" : "1.5px solid transparent",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`}
            </motion.div>
          )}
        </div>

        {/* Speedometer + distance HUD — visible during the race so the player
            always feels their forward momentum, even between questions. */}
        {phase === "racing" && (
          <motion.div
            animate={myVelocity > 1.2 ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: myVelocity > 1.2 ? Infinity : 0, duration: 0.7 }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 12px", borderRadius: 999,
              background: myVelocity > 1.2
                ? "linear-gradient(135deg, rgba(58,163,255,0.35), rgba(217,165,33,0.35))"
                : "rgba(255,255,255,0.10)",
              border: `1.5px solid ${myVelocity > 1.2 ? "#3aa3ff" : "rgba(255,255,255,0.18)"}`,
              color: "#fff", fontWeight: 800, fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              boxShadow: myVelocity > 1.2 ? "0 0 14px rgba(58,163,255,0.45)" : "none",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
            aria-label={ar ? "لوحة السرعة" : "Speedometer"}
          >
            <span style={{ fontSize: 14 }}>🛰️</span>
            <span style={{ color: GOLD, fontWeight: 900 }}>
              {Math.round(myAltitude * 12).toLocaleString(ar ? "ar-EG" : "en-US")}
            </span>
            <span style={{ opacity: 0.75 }}>{ar ? "كم" : "km"}</span>
            <span style={{ opacity: 0.4, padding: "0 2px" }}>·</span>
            <span style={{ color: myVelocity > 1.2 ? "#3aa3ff" : "rgba(255,255,255,0.85)", fontWeight: 900 }}>
              ×{myVelocity.toFixed(1)}
            </span>
          </motion.div>
        )}

        {/* Race timer — appears once race is running */}
        {phase === "racing" && gameTimeLeft !== null && (
          (() => {
            const t = gameTimeLeft;
            const danger = t <= 30;
            const warn = !danger && t <= 60;
            const bg = danger ? "rgba(220,38,38,0.95)" : warn ? "rgba(217,165,33,0.95)" : "rgba(255,255,255,0.12)";
            const color = danger || warn ? "#fff" : "#fff";
            const mm = Math.floor(t / 60);
            const ss = t % 60;
            return (
              <motion.div
                animate={danger ? { scale: [1, 1.08, 1] } : {}}
                transition={{ repeat: danger ? Infinity : 0, duration: 0.6 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: bg, color,
                  border: `1.5px solid ${danger ? "#ff4040" : warn ? "#D9A521" : "rgba(255,255,255,0.2)"}`,
                  fontWeight: 900, fontSize: 14, fontVariantNumeric: "tabular-nums",
                  boxShadow: danger ? "0 0 18px rgba(255,40,40,0.5)" : warn ? "0 0 14px rgba(217,165,33,0.4)" : "none",
                  flexShrink: 0,
                }}
                aria-label={ar ? `الوقت المتبقي ${mm}:${String(ss).padStart(2,"0")}` : `Time left ${mm}:${String(ss).padStart(2,"0")}`}
              >
                <span style={{ fontSize: 16 }}>⏱️</span>
                <span>{mm}:{String(ss).padStart(2, "0")}</span>
              </motion.div>
            );
          })()
        )}

        {/* Mute */}
        <button
          onClick={() => setMutedState(m => !m)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 10px", borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff", fontWeight: 600, fontSize: 11,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? (ar ? "صامت" : "Muted") : (ar ? "صوت" : "Sound")}
        </button>
      </div>

      {title && (
        <div style={{ position: "relative", zIndex: 5, textAlign: "center", padding: "6px 16px", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700 }}>
          🚀 {title}
        </div>
      )}

      {/* ── Lobby — launch pad with orbit rings ── */}
      {phase === "lobby" && (
        <div style={{ position: "relative", zIndex: 5, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20, padding: 30 }}>
            {/* Rotating orbit rings around the ship */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1.5px dashed rgba(84,216,255,0.35)",
              animation: "rrSpin 14s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 14, borderRadius: "50%",
              border: `1px solid ${GOLD}40`,
              animation: "rrSpin 9s linear infinite reverse",
            }} />
            {/* Orbiting satellite dot */}
            <div style={{ position: "absolute", inset: 0, animation: "rrSpin 6s linear infinite" }}>
              <div style={{
                position: "absolute", top: -4, left: "50%", width: 9, height: 9, borderRadius: "50%",
                background: CYAN, boxShadow: `0 0 12px ${CYAN}`,
              }} />
            </div>
            {/* Launch pad glow beneath */}
            <div style={{
              position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
              width: 120, height: 26, borderRadius: "50%",
              background: `radial-gradient(ellipse, ${myColor}55 0%, transparent 70%)`,
              filter: "blur(6px)",
              animation: "rrPulse 2.4s ease-in-out infinite",
            }} />
            <motion.div
              animate={{ y: [-8, 8, -8] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              style={{ display: "inline-block", position: "relative" }}
            >
              <RocketIcon color={myColor} isPlayer size={90} />
            </motion.div>
          </div>
          <h1 style={{
            color: "#fff", fontSize: 27, fontWeight: 900, margin: "0 0 8px",
            textShadow: `0 0 30px ${GOLD}50, 0 2px 4px rgba(0,0,0,0.6)`,
          }}>
            {ar ? "في انتظار الانطلاق..." : "Awaiting Launch..."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", display: "inline-block", animation: "rrPulse 1.4s ease-in-out infinite" }} />
            {ar ? "سينطلق السباق عند بدء المعلم" : "Race starts when teacher launches"}
          </p>
          <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 600, marginInline: "auto" }}>
            {players.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, scale: 0.6, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 18 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: p.name === queryName
                    ? `linear-gradient(135deg, ${GOLD}45, ${GOLD}18)`
                    : "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
                  border: p.name === queryName ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.16)",
                  boxShadow: p.name === queryName ? `0 0 18px ${GOLD}40` : "0 2px 10px rgba(0,0,0,0.3)",
                  backdropFilter: "blur(6px)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                }}
              >
                <span>{p.avatar}</span>
                <span>{p.name}</span>
                {p.name === queryName && <span style={{ color: GOLD, fontSize: 11 }}>({ar ? "أنت" : "you"})</span>}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Countdown — cinematic ring + shockwave ── */}
      {phase === "countdown" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,6,20,0.9)", backdropFilter: "blur(10px)", overflow: "hidden" }}>
          {/* Converging warp lines behind the number */}
          {Array.from({ length: 16 }, (_, i) => (
            <motion.div
              key={`cd-line-${i}`}
              animate={{ opacity: [0, 0.4, 0], scaleX: [0.1, 1] }}
              transition={{ duration: 1.4, delay: (i % 6) * 0.2, repeat: Infinity, ease: "easeIn" }}
              style={{
                position: "absolute", left: "50%", top: "50%",
                width: "48vmax", height: 1.5,
                transformOrigin: "left center",
                transform: `rotate(${i * 22.5}deg)`,
                background: "linear-gradient(90deg, transparent, rgba(84,216,255,0.7))",
              }}
            />
          ))}
          <AnimatePresence mode="wait">
            <motion.div
              key={countdownNum}
              initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.4, type: "spring", stiffness: 260, damping: 20 }}
              style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {/* Shockwave ring per tick */}
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 190, height: 190, borderRadius: "50%",
                border: `2.5px solid ${countdownNum > 0 ? GOLD : "#4ade80"}`,
                boxShadow: `0 0 34px ${countdownNum > 0 ? GOLD : "#4ade80"}60`,
                animation: "rrRing 0.9s ease-out forwards",
              }} />
              {/* Pulsing outline ring */}
              {countdownNum > 0 && (
                <div style={{
                  position: "absolute", width: 220, height: 220, borderRadius: "50%",
                  border: "1.5px dashed rgba(217,165,33,0.4)",
                  animation: "rrSpin 5s linear infinite",
                }} />
              )}
              <div
                style={{
                  fontSize: countdownNum > 0 ? 150 : 72,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: countdownNum > 0 ? GOLD : "#4ade80",
                  textShadow: countdownNum > 0
                    ? `0 0 44px ${GOLD}, 0 0 90px ${GOLD}70`
                    : "0 0 44px #4ade80, 0 0 90px #4ade8070",
                  textAlign: "center",
                  padding: 40,
                }}
              >
                {countdownNum > 0 ? countdownNum : (ar ? "🚀 انطلق!" : "🚀 GO!")}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Floating power-up toast (earned / used). */}
      {phase === "racing" && powerToast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 64px)",
            left: 0, right: 0,
            display: "flex", justifyContent: "center",
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          <motion.div
            key={powerToast.key}
            initial={{ y: -20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            style={{
              background: powerToast.kind === "boost" ? "rgba(34,87,57,0.96)" : "rgba(217,165,33,0.96)",
              color: "#fff",
              padding: "8px 16px", borderRadius: 999,
              fontWeight: 900, fontSize: 14, letterSpacing: 0.2,
              boxShadow: "0 6px 24px rgba(0,0,0,0.4), 0 0 24px rgba(217,165,33,0.35)",
              border: "1.5px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{powerToast.kind === "boost" ? "🚀" : "⭐"}</span>
            <span>
              {powerToast.action === "earned"
                ? (ar
                    ? (powerToast.kind === "boost" ? "حصلت على دفعة!" : "حصلت على مضاعف نقاط!")
                    : (powerToast.kind === "boost" ? "Boost earned!" : "Multiplier earned!"))
                : (ar
                    ? (powerToast.kind === "boost" ? "دفعة ×٢ ارتفاع!" : "مضاعف ×٢ نقاط!")
                    : (powerToast.kind === "boost" ? "×2 altitude!" : "×2 score!"))}
            </span>
          </motion.div>
        </div>
      )}

      {/* ── Racing ── */}
      {phase === "racing" && (
        isMobile ? (
          // MOBILE: question panel on top, compact rocket leaderboard at bottom
          <div style={{ position: "relative", zIndex: 5, display: "flex", flexDirection: "column", height: "calc(100dvh - 56px)" }}>
            {/* Power-up tray */}
            <PowerUpTray
              ar={ar}
              boostAvailable={boostAvailable}
              multiplierAvailable={multiplierAvailable}
              boostArmed={boostArmed}
              multiplierArmed={multiplierArmed}
              onUse={(kind) => {
                const socket = getRocketSocket();
                socket.emit("rocket:use-power", { pin, kind }, (r: { error?: string; boostArmed?: boolean; multiplierArmed?: boolean }) => {
                  if (r?.error) { toast.error(r.error); return; }
                  if (typeof r?.boostArmed === "boolean") setBoostArmed(r.boostArmed);
                  if (typeof r?.multiplierArmed === "boolean") setMultiplierArmed(r.multiplierArmed);
                });
              }}
            />
            {/* Question + answers (top, takes most space) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {currentQ && <QuestionPanel
                currentQ={currentQ}
                timeLeft={timeLeft}
                totalQuestions={totalQuestions}
                feedback={feedback && {
                  ...feedback,
                  correctIndex: feedback.correctIndex !== undefined
                    ? optionMapping.indexOf(feedback.correctIndex)
                    : feedback.correctIndex,
                }}
                chosenWrongIdx={chosenWrongIdx}
                fillAnswer={fillAnswer}
                setFillAnswer={setFillAnswer}
                handleMCQAnswer={handleMCQAnswer}
                handleFillSubmit={handleFillSubmit}
                encouragement={encouragement}
                ar={ar}
                displayOptions={shuffledOptions}
              />}
            </div>
            {/* Mobile: horizontal race track — camera follows player, rockets face right */}
            <div style={{
              flex: "0 0 auto",
              background: "linear-gradient(180deg, rgba(6,10,28,0.82), rgba(4,6,18,0.9))",
              borderTop: `1.5px solid ${gamePhase === 0 ? "rgba(130,160,255,0.3)" : gamePhase === 1 ? "rgba(230,110,30,0.4)" : "rgba(0,220,200,0.35)"}`,
              boxShadow: `0 -1px 0 ${gamePhase === 0 ? "rgba(84,216,255,0.15)" : gamePhase === 1 ? "rgba(255,140,60,0.15)" : "rgba(0,255,220,0.15)"}, 0 -10px 26px -14px rgba(0,0,0,0.9)`,
              backdropFilter: "blur(10px)",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Scrolling stars background */}
              <motion.div
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 0, width: "200%", pointerEvents: "none" }}
              >
                {[...Array(30)].map((_, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    left: `${(i * 3.3 + 1) % 100}%`,
                    top: `${(i * 7.1 + 5) % 100}%`,
                    width: i % 5 === 0 ? 2.5 : 1.5, height: i % 5 === 0 ? 2.5 : 1.5,
                    borderRadius: "50%",
                    background: gamePhase === 2 ? "rgba(80,255,220,0.7)" : "rgba(255,255,255,0.6)",
                    opacity: 0.4 + (i % 3) * 0.2,
                  }} />
                ))}
              </motion.div>

              {/* Phase label */}
              <div style={{ position: "absolute", top: 4, left: 0, right: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: gamePhase === 0 ? "rgba(180,180,255,0.8)" : gamePhase === 1 ? "rgba(255,140,80,0.9)" : "rgba(80,255,220,0.9)", pointerEvents: "none", zIndex: 2 }}>
                {gamePhase === 0 ? "🌌 الفضاء العميق" : gamePhase === 1 ? "☄️ كويكبات" : "💎 كريستال"}
              </div>

              {/* Horizontal lanes — one per player */}
              <div style={{ paddingTop: 20, paddingBottom: 6 }}>
                {trackPlayers.map((p, idx) => {
                  const isMe = p.name === queryName;
                  const pOrbit = Math.floor(p.altitude / 100);
                  const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                  const leftPct = trackLeftPct(p);
                  return (
                    <div
                      key={p.name}
                      style={{
                        position: "relative",
                        height: isMe ? 36 : 28,
                        marginBottom: 2,
                        borderRadius: 8,
                        background: isMe
                          ? "linear-gradient(90deg, rgba(217,165,33,0.20), rgba(217,165,33,0.06) 55%, rgba(84,216,255,0.08))"
                          : "linear-gradient(90deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))",
                        border: isMe
                          ? "1px solid rgba(217,165,33,0.45)"
                          : "1px solid rgba(255,255,255,0.07)",
                        boxShadow: isMe ? "0 0 14px rgba(217,165,33,0.22), inset 0 1px 0 rgba(255,255,255,0.08)" : undefined,
                        overflow: "hidden",
                      }}
                    >
                      {/* Fixed rank+name on the left */}
                      <div style={{
                        position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)",
                        display: "flex", alignItems: "center", gap: 3, zIndex: 4, pointerEvents: "none",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: isMe ? GOLD : "rgba(255,255,255,0.75)" }}>
                          {rankEmoji}
                        </span>
                        <span style={{ fontSize: 9, color: isMe ? GOLD : "rgba(255,255,255,0.6)", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.avatar} {p.name}
                        </span>
                        {pOrbit > 0 && (
                          <span style={{ fontSize: 7, color: "#88ffee", fontWeight: 900 }}>🌀{pOrbit}</span>
                        )}
                      </div>
                      {/* Dashed centre line */}
                      <div style={{ position: "absolute", left: "20%", right: 4, top: "50%", height: 1, background: isMe ? `repeating-linear-gradient(90deg,${GOLD}44 0,${GOLD}44 4px,transparent 4px,transparent 8px)` : "repeating-linear-gradient(90deg,rgba(255,255,255,0.18) 0,rgba(255,255,255,0.18) 4px,transparent 4px,transparent 8px)" }} />
                      {/* Rocket — positioned by camera-follows-player, clipped to right side of name */}
                      <motion.div
                        key={p.name}
                        animate={{ left: `${Math.max(20, leftPct)}%` }}
                        initial={false}
                        transition={{ type: "spring", stiffness: 60, damping: 18 }}
                        style={{
                          position: "absolute",
                          top: "50%",
                          transform: "translateY(-50%) rotate(90deg)",
                          zIndex: 5,
                        }}
                      >
                        <RocketIcon
                          color={p.rocketColor}
                          isPlayer={isMe}
                          size={isMe ? 22 : 16}
                          boosted={isMe && boostFlash}
                          mega={false}
                        />
                      </motion.div>
                      {/* Score badge on the right */}
                      <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", fontSize: 8, fontWeight: 800, color: isMe ? GOLD : "rgba(255,255,255,0.5)", zIndex: 4 }}>
                        {p.score}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // DESKTOP: rockets panel left, question right
          <div style={{ position: "relative", zIndex: 5, display: "grid", gridTemplateColumns: "minmax(360px, 48%) 1fr", gap: 16, padding: "12px 16px", alignItems: "start", height: "calc(100dvh - 64px)" }}>
            {/* Race track */}
            <div style={{
              position: "relative", height: "100%",
              background: gamePhase === 0
                ? "linear-gradient(180deg, rgba(30,45,110,0.22), rgba(10,15,40,0.30))"
                : gamePhase === 1
                  ? "linear-gradient(180deg, rgba(120,45,5,0.22), rgba(45,15,0,0.30))"
                  : "linear-gradient(180deg, rgba(0,110,110,0.18), rgba(0,35,50,0.30))",
              borderRadius: 18,
              border: `1px solid ${gamePhase === 0 ? "rgba(130,160,255,0.22)" : gamePhase === 1 ? "rgba(230,110,30,0.32)" : "rgba(0,220,200,0.28)"}`,
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.35), 0 10px 30px -14px rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              overflow: "hidden", padding: "16px 8px",
              transition: "background 2s ease, border 2s ease",
            }}>
              {/* Orbit gate — shimmering energy line at the top of the visible track */}
              <div aria-hidden style={{
                position: "absolute", top: 10, left: "6%", right: "6%", height: 2.5,
                borderRadius: 2,
                background: `linear-gradient(90deg, transparent, ${CYAN}, ${GOLD}, ${CYAN}, transparent)`,
                backgroundSize: "200% 100%",
                animation: "rrGateShimmer 3s linear infinite",
                boxShadow: `0 0 12px ${CYAN}80`,
                opacity: 0.75,
              }} />
              {/* Phase indicator — no "lead zone" banner during race (shown on results screen) */}
              <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center", fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: gamePhase === 0 ? "rgba(190,195,255,0.85)" : gamePhase === 1 ? "rgba(255,150,90,0.9)" : "rgba(95,255,225,0.9)", textShadow: "0 0 10px currentColor" }}>
                {gamePhase === 0 ? "🌌 الفضاء العميق" : gamePhase === 1 ? "☄️ حقل الكويكبات" : "💎 كوكب الكريستال"}
              </div>

              {crowdedRocketLanes ? (
                <>
                  <div style={{
                    position: "absolute",
                    top: 50,
                    left: 12,
                    right: 12,
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.88)",
                  }}>
                    {ar ? "↔ مرّر أفقياً — عمود لكل متسابق" : "↔ Scroll sideways — one column per racer"}
                  </div>
                  <div style={{
                    position: "absolute",
                    top: 76,
                    left: 10,
                    right: 10,
                    bottom: 14,
                  }}>
                    <HorizontalRocketLanesStrip
                      trackPlayers={trackPlayers}
                      queryName={queryName || ""}
                      displayAltitude={displayAltitude}
                      gamePhase={gamePhase}
                      boostFlash={boostFlash}
                      variant="desktop"
                      ar={ar}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Background dots */}
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    {[...Array(12)].map((_, i) => (
                      <div key={i} style={{
                        position: "absolute",
                        left: `${10 + (i % 4) * 22}%`, top: `${10 + Math.floor(i / 4) * 28}%`,
                        width: 1.5, height: 1.5, borderRadius: "50%",
                        background: gamePhase === 2 ? "#00ffee60" : "#ffffff60",
                      }} />
                    ))}
                  </div>

                  {/* Player rockets */}
                  <div style={{ position: "relative", width: "100%", height: "100%", perspective: "600px" }}>
                    {trackPlayers.map((p, idx) => {
                      const isMe = p.name === queryName;
                      const lanes = Math.max(1, trackPlayers.length);
                      // Distribute rockets evenly, more spacing for few players
                      const spacing = lanes <= 4 ? 80 / lanes : 88 / lanes;
                      const xPos = (idx + 0.5) * spacing + (100 - spacing * lanes) / 2;
                      const isMega = isMe && gamePhase === 2;
                      const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                      const compact = lanes > 8;
                      // 3-D depth: rockets near bottom (low alt) look bigger/closer
                      const bottomPct = trackBottomPct(p);
                      const depthScale = 1.15 - (bottomPct / 88) * 0.25;
                      const pOrbit = Math.floor(p.altitude / 100);
                      return (
                        <motion.div
                          key={p.name}
                          animate={{ bottom: `${bottomPct}%`, left: `${Math.min(92, Math.max(4, xPos))}%` }}
                          initial={false}
                          transition={{ type: "spring", stiffness: 55, damping: 16 }}
                          style={{
                            position: "absolute",
                            transform: `translateX(-50%) scale(${depthScale})`,
                            transformOrigin: "bottom center",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                            zIndex: isMe ? 10 : 5,
                          }}
                        >
                          <span style={{
                            fontSize: isMe ? 10 : 9, fontWeight: 800,
                            color: isMe ? GOLD : "#fff",
                            background: isMe ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.55)",
                            padding: "2px 6px", borderRadius: 999, whiteSpace: "nowrap",
                            maxWidth: compact ? 72 : 80, overflow: "hidden", textOverflow: "ellipsis",
                            border: isMe ? `1.5px solid ${GOLD}` : "1px solid rgba(255,255,255,0.15)",
                          }}>
                            #{idx + 1}{lanes > 1 ? " " : ""}{rankEmoji}{p.avatar} {p.name}
                          </span>
                          {pOrbit > 0 && (
                            <span style={{ fontSize: 8, fontWeight: 900, color: "#88ffee", background: "rgba(0,200,180,0.25)", padding: "1px 5px", borderRadius: 999, border: "1px solid rgba(0,200,180,0.4)" }}>
                              🌀×{pOrbit}
                            </span>
                          )}
                          <RocketIcon
                            color={p.rocketColor}
                            isPlayer={isMe}
                            size={
                              isMega ? 50
                                : compact ? (isMe ? 36 : 24)
                                : isMe ? 42 : 30
                            }
                            boosted={isMe && boostFlash}
                            mega={isMega}
                          />
                          <span style={{
                            fontSize: isMe ? 9 : 8,
                            color: isMe ? GOLD : "rgba(255,255,255,0.55)",
                            fontWeight: 700, background: "rgba(0,0,0,0.4)",
                            padding: "1px 4px", borderRadius: 4,
                          }}>
                            {p.score}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Altitude markers */}
                  <div style={{ position: "absolute", left: 4, top: 16, bottom: 8, width: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "rgba(255,255,255,0.35)", fontSize: 8, fontWeight: 700 }}>
                    {[100, 75, 50, 25, 0].map(v => <span key={v}>{v}%</span>)}
                  </div>
                </>
              )}
            </div>

            {/* Question */}
            <div style={{ overflowY: "auto", maxHeight: "100%" }}>
              <PowerUpTray
                ar={ar}
                boostAvailable={boostAvailable}
                multiplierAvailable={multiplierAvailable}
                boostArmed={boostArmed}
                multiplierArmed={multiplierArmed}
                onUse={(kind) => {
                  const socket = getRocketSocket();
                  socket.emit("rocket:use-power", { pin, kind }, (r: { error?: string; boostArmed?: boolean; multiplierArmed?: boolean }) => {
                    if (r?.error) { toast.error(r.error); return; }
                    if (typeof r?.boostArmed === "boolean") setBoostArmed(r.boostArmed);
                    if (typeof r?.multiplierArmed === "boolean") setMultiplierArmed(r.multiplierArmed);
                  });
                }}
              />
              {currentQ && <QuestionPanel
                currentQ={currentQ}
                timeLeft={timeLeft}
                totalQuestions={totalQuestions}
                feedback={feedback && {
                  ...feedback,
                  correctIndex: feedback.correctIndex !== undefined
                    ? optionMapping.indexOf(feedback.correctIndex)
                    : feedback.correctIndex,
                }}
                chosenWrongIdx={chosenWrongIdx}
                fillAnswer={fillAnswer}
                setFillAnswer={setFillAnswer}
                handleMCQAnswer={handleMCQAnswer}
                handleFillSubmit={handleFillSubmit}
                encouragement={encouragement}
                ar={ar}
                displayOptions={shuffledOptions}
              />}
            </div>
          </div>
        )
      )}

      {/* ── Finished ── */}
      {phase === "finished" && (
        <FinishedScreen
          players={sortedPlayers}
          myName={queryName}
          myScore={myScore}
          ar={ar}
          onHome={() => setLocation("/")}
          pin={pin}
        />
      )}
    </div>
  );
}

// ─── Question Panel (shared mobile/desktop) ───────────────────────────────────
function QuestionPanel({
  currentQ, timeLeft, totalQuestions, feedback, chosenWrongIdx, fillAnswer, setFillAnswer,
  handleMCQAnswer, handleFillSubmit, encouragement, ar, displayOptions,
}: {
  currentQ: Question;
  timeLeft: number;
  totalQuestions: number;
  feedback: { correct: boolean; correctIndex?: number; correctText?: string } | null;
  chosenWrongIdx: number | null;
  fillAnswer: string;
  setFillAnswer: (v: string) => void;
  handleMCQAnswer: (i: number) => void;
  handleFillSubmit: () => void;
  encouragement: string | null;
  ar: boolean;
  displayOptions?: string[];
}) {
  const options = displayOptions && displayOptions.length > 0 ? displayOptions : currentQ.options;
  const MCQ_COLORS = [
    "linear-gradient(155deg, #8e1c2e, #d4304a)",
    "linear-gradient(155deg, #143d78, #2563eb)",
    "linear-gradient(155deg, #7a4a08, #e8930c)",
    "linear-gradient(155deg, #46187f, #8b45f7)",
  ];
  const MCQ_EDGE = ["#ff6b81", "#60a5fa", "#fbbf24", "#c084fc"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Timer row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 800,
          background: "linear-gradient(135deg, rgba(84,216,255,0.16), rgba(84,216,255,0.05))",
          border: "1px solid rgba(84,216,255,0.3)",
          padding: "5px 12px", borderRadius: 999,
          backdropFilter: "blur(6px)",
          letterSpacing: 0.3,
        }}>
          {ar ? "السؤال" : "Q"} {currentQ.index + 1}
          {currentQ.index + 1 > totalQuestions && (
            <span style={{ marginInlineStart: 6, color: GOLD }}>{ar ? "🔁 دورة+" : "🔁 Cycle+"}</span>
          )}
        </span>
        <motion.div
          animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 0.5 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 16px", borderRadius: 999,
            background: timeLeft <= 5
              ? "linear-gradient(135deg, rgba(220,38,38,0.65), rgba(150,10,10,0.5))"
              : timeLeft <= 10
                ? "linear-gradient(135deg, rgba(230,110,0,0.5), rgba(160,70,0,0.4))"
                : "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07))",
            border: `1.5px solid ${timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f97316" : "rgba(255,255,255,0.22)"}`,
            boxShadow: timeLeft <= 5 ? "0 0 18px rgba(239,68,68,0.55)" : "none",
            color: "#fff", fontWeight: 900, fontSize: 16,
            fontVariantNumeric: "tabular-nums",
            backdropFilter: "blur(6px)",
          }}
        >
          ⏱ {timeLeft}s
        </motion.div>
      </div>

      {/* Timer energy bar */}
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", position: "relative", border: "1px solid rgba(255,255,255,0.07)" }}>
        <motion.div
          animate={{ width: `${(timeLeft / currentQ.duration) * 100}%` }}
          transition={{ duration: 0.5 }}
          style={{
            height: "100%",
            background: timeLeft <= 5
              ? "linear-gradient(90deg, #7a1010, #ef4444)"
              : timeLeft <= 10
                ? "linear-gradient(90deg, #92400e, #f97316)"
                : `linear-gradient(90deg, ${GOLD}, #ffd76e, ${GOLD})`,
            boxShadow: timeLeft <= 5 ? "0 0 12px #ef4444" : `0 0 10px ${GOLD}70`,
            borderRadius: 3,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            width: "40%",
            animation: "rrShine 1.8s linear infinite",
          }} />
        </motion.div>
      </div>

      {/* Question console */}
      <div style={{
        position: "relative",
        background: "linear-gradient(160deg, rgba(20,28,64,0.78), rgba(10,14,38,0.68))",
        borderRadius: 20, padding: "20px 22px",
        border: "1px solid rgba(120,160,255,0.22)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 10px 34px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.09)",
        overflow: "hidden",
      }}>
        {/* Neon top edge */}
        <div style={{
          position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
          background: `linear-gradient(90deg, transparent, ${GOLD}, ${CYAN}, transparent)`,
          backgroundSize: "200% 100%",
          animation: "rrGateShimmer 3.5s linear infinite",
          borderRadius: 2,
        }} />
        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 8, insetInlineStart: 8, width: 14, height: 14, borderTop: `2px solid ${CYAN}66`, borderInlineStart: `2px solid ${CYAN}66`, borderStartStartRadius: 6 }} />
        <div style={{ position: "absolute", bottom: 8, insetInlineEnd: 8, width: 14, height: 14, borderBottom: `2px solid ${CYAN}66`, borderInlineEnd: `2px solid ${CYAN}66`, borderEndEndRadius: 6 }} />
        <p style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.65, textShadow: "0 1px 5px rgba(0,0,0,0.6)" }}>
          {currentQ.text}
        </p>
      </div>

      {/* Encouragement */}
      <AnimatePresence mode="wait">
        {encouragement && (
          <motion.div
            key={encouragement}
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              textAlign: "center", color: GOLD, fontWeight: 900, fontSize: 17,
              textShadow: `0 0 22px ${GOLD}`,
              background: "linear-gradient(135deg, rgba(217,165,33,0.16), rgba(0,0,0,0.35))",
              border: `1px solid ${GOLD}50`,
              boxShadow: `0 0 20px ${GOLD}25, inset 0 1px 0 rgba(255,255,255,0.12)`,
              padding: "9px 16px", borderRadius: 14,
              backdropFilter: "blur(6px)",
            }}
          >
            {encouragement}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MCQ options */}
      {currentQ.type === "mcq" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {options.map((opt, idx) => {
            const showCorrect = feedback && feedback.correctIndex === idx;
            const showWrong = feedback && !feedback.correct && chosenWrongIdx === idx;
            const dimmed = feedback && !showCorrect && !showWrong;
            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.95 }}
                whileHover={!feedback ? { scale: 1.025, y: -2 } : {}}
                disabled={!!feedback}
                onClick={() => handleMCQAnswer(idx)}
                style={{
                  position: "relative",
                  background: showCorrect
                    ? "linear-gradient(155deg, #10532c, #2ee06a)"
                    : showWrong
                      ? "linear-gradient(155deg, #7f1d1d, #ef2d2d)"
                      : MCQ_COLORS[idx % 4],
                  border: showCorrect
                    ? "2.5px solid #7dffab"
                    : showWrong
                      ? "2.5px solid #ff8080"
                      : "1.5px solid rgba(255,255,255,0.16)",
                  borderRadius: 18, padding: "18px 16px",
                  color: "#fff", fontSize: 15, fontWeight: 800,
                  textAlign: "start", minHeight: 74,
                  cursor: feedback ? "default" : "pointer",
                  opacity: dimmed ? 0.28 : 1,
                  transition: "opacity .2s",
                  display: "flex", alignItems: "center", gap: 12,
                  overflow: "hidden",
                  boxShadow: showCorrect
                    ? "0 0 28px #22c55e90, inset 0 1px 0 rgba(255,255,255,0.3)"
                    : showWrong
                      ? "0 0 24px #ef444470, inset 0 1px 0 rgba(255,255,255,0.2)"
                      : "0 6px 18px -6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -8px 18px -8px rgba(0,0,0,0.4)",
                  animation: showWrong ? "rrWrongShake 0.45s ease-in-out" : undefined,
                }}
              >
                {/* Side accent light */}
                {!feedback && (
                  <span aria-hidden style={{
                    position: "absolute", insetInlineStart: 0, top: "18%", bottom: "18%", width: 3.5,
                    borderRadius: 4,
                    background: MCQ_EDGE[idx % 4],
                    boxShadow: `0 0 10px ${MCQ_EDGE[idx % 4]}`,
                  }} />
                )}
                <span style={{
                  display: "inline-flex", width: 34, height: 34,
                  clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                  background: showCorrect || showWrong ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 14, flexShrink: 0,
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                }}>
                  {["أ", "ب", "ج", "د"][idx]}
                </span>
                <span style={{ lineHeight: 1.4, flex: 1, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{opt}</span>
                {showCorrect && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: [0, 1.5, 1], rotate: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ fontSize: 22, flexShrink: 0 }}
                  >✅</motion.span>
                )}
                {showWrong && <span style={{ fontSize: 22, flexShrink: 0 }}>❌</span>}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* True/False */}
      {currentQ.type === "true_false" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { idx: 0, label: ar ? "✓ صحيح" : "✓ True", color: "linear-gradient(155deg, #0f5132, #22b45e)", edge: "#4ade80", icon: <CheckCircle2 size={28} /> },
            { idx: 1, label: ar ? "✗ خطأ" : "✗ False", color: "linear-gradient(155deg, #7f1d1d, #e23a3a)", edge: "#ff8080", icon: <XCircle size={28} /> },
          ].map(o => {
            const showCorrect = feedback && feedback.correctIndex === o.idx;
            return (
              <motion.button
                key={o.idx}
                whileTap={{ scale: 0.96 }}
                whileHover={!feedback ? { scale: 1.02, y: -2 } : {}}
                disabled={!!feedback}
                onClick={() => handleMCQAnswer(o.idx)}
                style={{
                  background: o.color,
                  border: showCorrect ? "3px solid #7dffab" : "1.5px solid rgba(255,255,255,0.18)",
                  borderRadius: 18, padding: "24px 18px",
                  color: "#fff", fontSize: 20, fontWeight: 900,
                  cursor: feedback ? "default" : "pointer",
                  opacity: feedback && !showCorrect ? 0.35 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 90,
                  boxShadow: showCorrect
                    ? "0 0 30px #22c55e90, inset 0 1px 0 rgba(255,255,255,0.3)"
                    : `0 8px 22px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -10px 22px -10px rgba(0,0,0,0.45)`,
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              >
                <span style={{ filter: `drop-shadow(0 0 8px ${o.edge})`, display: "inline-flex" }}>{o.icon}</span>
                {o.label}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Fill blank */}
      {currentQ.type === "fill_blank" && (
        <div>
          <input
            value={fillAnswer}
            onChange={e => setFillAnswer(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleFillSubmit()}
            disabled={!!feedback}
            placeholder={ar ? "اكتب إجابتك هنا..." : "Type your answer..."}
            autoFocus
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "16px 18px", marginBottom: 12,
              background: "linear-gradient(160deg, rgba(20,28,64,0.7), rgba(10,14,38,0.6))",
              border: `2px solid ${feedback?.correct ? "#4ade80" : feedback?.correct === false ? "#ef4444" : "rgba(84,216,255,0.35)"}`,
              boxShadow: feedback?.correct
                ? "0 0 18px rgba(74,222,128,0.4)"
                : feedback?.correct === false
                  ? "0 0 18px rgba(239,68,68,0.4)"
                  : "inset 0 2px 8px rgba(0,0,0,0.4)",
              borderRadius: 14, color: "#fff", fontSize: 18, fontWeight: 700,
              outline: "none",
              backdropFilter: "blur(8px)",
            }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFillSubmit}
            disabled={!!feedback || !fillAnswer.trim()}
            style={{
              width: "100%", padding: "14px",
              background: feedback ? "rgba(255,255,255,0.15)" : `linear-gradient(135deg, #ffd76e, ${GOLD} 45%, #a87908)`,
              border: "none", borderRadius: 14,
              color: feedback ? "#fff" : "#221a02",
              fontSize: 16, fontWeight: 900,
              cursor: feedback ? "default" : "pointer",
              boxShadow: feedback ? "none" : `0 10px 26px -8px ${GOLD}90, inset 0 1px 0 rgba(255,255,255,0.5)`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: !fillAnswer.trim() ? 0.5 : 1,
            }}
          >
            <Send size={18} />
            {ar ? "إرسال" : "Submit"}
          </motion.button>
          {feedback && feedback.correctText && !feedback.correct && (
            <p style={{ marginTop: 10, color: GOLD, fontSize: 14, fontWeight: 700, textAlign: "center" }}>
              {ar ? "الإجابة الصحيحة:" : "Correct answer:"} {feedback.correctText}
            </p>
          )}
        </div>
      )}

      {/* Feedback banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            style={{
              padding: "11px 16px", borderRadius: 14,
              background: feedback.correct
                ? "linear-gradient(135deg, rgba(22,163,74,0.4), rgba(10,90,44,0.3))"
                : "linear-gradient(135deg, rgba(220,38,38,0.4), rgba(130,15,15,0.3))",
              border: `1.5px solid ${feedback.correct ? "#4ade80" : "#f87171"}`,
              boxShadow: feedback.correct ? "0 0 22px rgba(74,222,128,0.35)" : "0 0 22px rgba(248,113,113,0.3)",
              textAlign: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: 0, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              {feedback.correct
                ? (ar ? "🚀 صح! مضيٌّ قُدُماً!" : "🚀 Correct! Keep soaring!")
                : (ar ? "❌ خطأ — السؤال التالي قادم..." : "❌ Wrong — Next question soon...")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Finished Screen ──────────────────────────────────────────────────────────
function FinishedScreen({
  players, myName, myScore, ar, onHome, pin,
}: {
  players: Player[];
  myName: string;
  myScore: number;
  ar: boolean;
  onHome: () => void;
  pin: string;
}) {
  const myIdx = players.findIndex(p => p.name === myName);
  const myRank = myIdx + 1;
  const [showConfetti, setShowConfetti] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const motivationalText = () => {
    if (!ar) {
      if (myRank === 1) return "🏆 Champion of Space! You led the whole adventure!";
      if (myRank <= 3) return "🥈 Outstanding! You're among the best explorers!";
      if (myRank <= Math.ceil(players.length / 2)) return "🚀 Great adventure! Keep pushing higher!";
      return "⭐ You launched and explored — that's a win! Next time, aim higher!";
    }
    if (myRank === 1) return "🏆 أنت بطل الفضاء! قدتَ المغامرة وحلّقت أعلى الجميع!";
    if (myRank <= 3) return "🥈 أداء رائع! أنت من نخبة المتسابقين!";
    if (myRank <= Math.ceil(players.length / 2)) return "🚀 مغامرة ممتازة! استمر في التحسن والصعود!";
    return "⭐ المشاركة بحد ذاتها انتصار! في المرة القادمة ستطير أعلى!";
  };

  const handleSaveScores = async () => {
    setSaving(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_BASE}/api/rocket-games/${pin}/save-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scores: players.map((p, i) => ({
            name: p.name,
            score: p.score,
            rank: i + 1,
            correctCount: p.correctCount,
            wrongCount: p.wrongCount,
          })),
        }),
      });
      if (res.ok) { setSaved(true); }
      else { toast.error(ar ? "خطأ في الحفظ" : "Save failed"); }
    } catch { toast.error(ar ? "خطأ في الحفظ" : "Save failed"); }
    finally { setSaving(false); }
  };

  // Podium (positions 0,1,2 of sorted players)
  const podiumPlayers = [players[1], players[0], players[2]].filter(Boolean);
  const podiumHeights = [75, 100, 58]; // 2nd, 1st, 3rd

  return (
    <div style={{ position: "relative", zIndex: 5 }}>
      {showConfetti && <Confetti />}

      <div style={{ padding: "24px 16px", maxWidth: 640, marginInline: "auto" }}>
        {/* Motivational header — spotlight + rotating rays behind the medal */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          style={{ textAlign: "center", marginBottom: 24, position: "relative" }}
        >
          <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
            {/* Rotating light rays */}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              width: 190, height: 190,
              transform: "translate(-50%,-50%)",
              background: `conic-gradient(from 0deg, transparent 0deg, ${GOLD}38 14deg, transparent 30deg, transparent 60deg, ${GOLD}30 74deg, transparent 90deg, transparent 120deg, ${GOLD}38 134deg, transparent 150deg, transparent 180deg, ${GOLD}30 194deg, transparent 210deg, transparent 240deg, ${GOLD}38 254deg, transparent 270deg, transparent 300deg, ${GOLD}30 314deg, transparent 330deg)`,
              borderRadius: "50%",
              animation: "rrSpin 9s linear infinite",
              filter: "blur(1.5px)",
            }} />
            {/* Spotlight glow */}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              width: 150, height: 150, transform: "translate(-50%,-50%)",
              background: `radial-gradient(circle, ${GOLD}45 0%, transparent 70%)`,
              borderRadius: "50%",
              animation: "rrPulse 2.5s ease-in-out infinite",
            }} />
            <motion.div
              animate={{ rotate: [-5, 5, -5], scale: [1, 1.07, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ fontSize: 64, position: "relative", filter: `drop-shadow(0 0 26px ${GOLD})` }}
            >
              {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🚀"}
            </motion.div>
          </div>
          <h1 style={{
            color: "#fff", fontSize: 23, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.35,
            textShadow: `0 0 30px ${GOLD}45, 0 2px 4px rgba(0,0,0,0.6)`,
          }}>
            {ar ? "🎊 انتهت المغامرة — أحسنتم جميعاً! 🎊" : "🎊 Adventure Over — You All Flew High! 🎊"}
          </h1>
          <p style={{ color: GOLD, fontSize: 15, fontWeight: 800, margin: "0 0 10px", textShadow: `0 0 18px ${GOLD}60` }}>
            {motivationalText()}
          </p>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            color: "#fff", fontSize: 13, fontWeight: 800,
            background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 999, padding: "7px 18px",
            backdropFilter: "blur(8px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>
            <span>{ar ? `مرتبتك #${myRank}` : `Rank #${myRank}`}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: GOLD }}>{myScore} {ar ? "نقطة" : "pts"}</span>
          </span>
        </motion.div>

        {/* Podium — only if 2+ players */}
        {players.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              gap: 12, marginBottom: 24,
              padding: "20px 16px 0",
            }}
          >
            {podiumPlayers.map((p, podIdx) => {
              if (!p) return null;
              const ranks = [2, 1, 3];
              const rank = ranks[podIdx];
              const h = podiumHeights[podIdx];
              const rankColors: Record<number, string> = { 1: GOLD, 2: "#94a3b8", 3: "#cd7f32" };
              const rankEmoji: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
              const c = rankColors[rank];
              return (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + podIdx * 0.18, type: "spring", stiffness: 180, damping: 16 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: rank === 1 ? 1.2 : 1, maxWidth: 140, position: "relative" }}
                >
                  {/* Champion spotlight beam */}
                  {rank === 1 && (
                    <div style={{
                      position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                      width: "130%", height: h + 90,
                      background: `linear-gradient(0deg, ${GOLD}22, transparent 80%)`,
                      clipPath: "polygon(28% 0%, 72% 0%, 100% 100%, 0% 100%)",
                      pointerEvents: "none",
                      animation: "rrPulse 3s ease-in-out infinite",
                    }} />
                  )}
                  {rank === 1 && <span style={{ fontSize: 18, marginBottom: -4, filter: `drop-shadow(0 0 8px ${GOLD})`, position: "relative" }}>👑</span>}
                  <motion.span
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, delay: podIdx * 0.3 }}
                    style={{ fontSize: rank === 1 ? 30 : 24, position: "relative", filter: `drop-shadow(0 3px 8px rgba(0,0,0,0.5))` }}
                  >
                    {p.avatar}
                  </motion.span>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: rank === 1 ? 14 : 12, margin: "4px 0 2px", textAlign: "center", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                    {p.name}
                  </p>
                  <p style={{ color: c, fontWeight: 800, fontSize: 11, margin: "0 0 5px", position: "relative", textShadow: `0 0 12px ${c}80` }}>
                    {p.score} {ar ? "نق" : "pts"}
                  </p>
                  <div style={{
                    width: "100%",
                    height: h,
                    background: `linear-gradient(180deg, ${c}70 0%, ${c}30 55%, ${c}14 100%)`,
                    border: `1.5px solid ${c}90`,
                    borderBottom: "none",
                    borderRadius: "10px 10px 0 0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: rank === 1 ? 34 : 25,
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: `0 -4px 26px -6px ${c}60, inset 0 1px 0 ${c}aa`,
                    backdropFilter: "blur(4px)",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, insetInlineStart: "12%", width: "22%", height: "100%",
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)",
                      transform: "skewX(-14deg)",
                    }} />
                    <span style={{ filter: `drop-shadow(0 0 10px ${c})` }}>{rankEmoji[rank]}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Full player list */}
        <div style={{
          background: "linear-gradient(160deg, rgba(20,28,64,0.6), rgba(10,14,38,0.5))",
          borderRadius: 20, overflow: "hidden",
          border: "1px solid rgba(120,160,255,0.18)",
          boxShadow: "0 12px 36px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          marginBottom: 16,
        }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Trophy size={18} color={GOLD} style={{ display: "inline", marginInlineEnd: 8 }} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
              {ar ? "الترتيب النهائي" : "Final Rankings"}
            </span>
          </div>
          {players.map((p, idx) => {
            const isMe = p.name === myName;
            const rankMedal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: ar ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.05 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 18px",
                  borderBottom: idx < players.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
                  background: isMe ? `${GOLD}18` : undefined,
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                  background: idx === 0 ? GOLD : idx === 1 ? "#94a3b8" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.12)",
                  color: idx < 3 ? "#000" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: idx < 3 ? 13 : 12,
                }}>
                  {rankMedal || idx + 1}
                </span>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{p.avatar}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#fff", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {isMe && <span style={{ color: GOLD, fontSize: 10, flexShrink: 0 }}>({ar ? "أنت" : "you"})</span>}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
                    {ar ? "نقاط:" : "Score:"} {p.score} · {ar ? "صح:" : "✓"} {p.correctCount} · {ar ? "خطأ:" : "✗"} {p.wrongCount}
                  </p>
                </div>
                <span style={{ color: GOLD, fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                  {p.score}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleSaveScores}
            disabled={saving || saved}
            style={{
              flex: 1, minWidth: 140,
              padding: "13px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.18)",
              background: saved
                ? "linear-gradient(135deg, rgba(22,163,74,0.55), rgba(12,100,45,0.45))"
                : "linear-gradient(135deg, #3b76f6, #1d4ed8 60%, #14349b)",
              color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: saving || saved ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: saving ? 0.7 : 1,
              boxShadow: saved ? "0 0 18px rgba(34,197,94,0.35)" : "0 10px 26px -10px rgba(37,99,235,0.8), inset 0 1px 0 rgba(255,255,255,0.3)",
              textShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }}
          >
            {saved ? (ar ? "✓ تم الحفظ!" : "✓ Saved!") : saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "💾 حفظ النتائج" : "💾 Save Scores")}
          </button>
          <button
            onClick={onHome}
            style={{
              flex: 1, minWidth: 140,
              padding: "13px 16px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.35)",
              background: `linear-gradient(135deg, #ffd76e, ${GOLD} 45%, #a87908)`,
              color: "#221a02", fontWeight: 900, fontSize: 14,
              cursor: "pointer",
              position: "relative", overflow: "hidden",
              boxShadow: `0 10px 26px -10px ${GOLD}cc, inset 0 1px 0 rgba(255,255,255,0.55)`,
            }}
          >
            <span aria-hidden style={{
              position: "absolute", top: 0, bottom: 0, width: "40%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
              animation: "rrShine 2.8s ease-in-out infinite",
              pointerEvents: "none",
            }} />
            {ar ? "🏠 الرئيسية" : "🏠 Home"}
          </button>
        </div>
      </div>
    </div>
  );
}
