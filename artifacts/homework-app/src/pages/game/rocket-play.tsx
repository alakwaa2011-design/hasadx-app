import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Loader2, CheckCircle2, XCircle, Send, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D9A521";
const SPACE_BG = "linear-gradient(180deg, #050818 0%, #0d1230 40%, #1a0f2e 100%)";
const PHASE_BACKGROUNDS = [
  "linear-gradient(180deg, #050818 0%, #0d1230 40%, #1a0f2e 100%)", // Phase 1: Deep Space
  "linear-gradient(180deg, #150505 0%, #2d0a00 40%, #3d1000 100%)", // Phase 2: Asteroid Field
  "linear-gradient(180deg, #020f15 0%, #003028 40%, #001a20 100%)", // Phase 3: Crystal Planet
];

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
}

// ─── Arabic encouragement messages ────────────────────────────────────────────
const CORRECT_AR = [
  "🔥 عبقري! صاروخك ينطلق!",
  "⚡ مذهل! الصدارة لك!",
  "🚀 ارتفعت! استمر!",
  "💫 ممتاز جداً!",
  "🌟 رائع! سرعتك لا تُضاهى!",
  "🎯 دقيق! هكذا تُكسب السباقات!",
  "🏆 أنت نجم الفضاء!",
  "⭐ إجابة صحيحة! صعودٌ آخر!",
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

  playCorrect() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, 0.18, "sine", 0.15, i * 0.07));
    notes.forEach((f, i) => this.tone(f, 0.25, "sine", 0.07, i * 0.07 + 0.5));
  }

  playWrong() {
    this.tone(250, 0.1, "sawtooth", 0.12);
    this.tone(200, 0.12, "sawtooth", 0.1, 0.05);
    this.tone(150, 0.15, "triangle", 0.1, 0.1);
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

// ─── Confetti ────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 90 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#D9A521", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#ec4899", "#06b6d4"][
      Math.floor(Math.random() * 8)
    ],
    delay: Math.random() * 2.5,
    dur: 2.5 + Math.random() * 2,
    size: 7 + Math.random() * 8,
    rotation: Math.random() * 360,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -30, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ y: "110vh", opacity: [1, 1, 0.7, 0], rotate: p.rotation + 540, scale: [1, 0.8, 0.6] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.shape === "rect" ? p.size * 0.45 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}

// ─── Boost particles ─────────────────────────────────────────────────────────
function BoostParticles({ active }: { active: boolean }) {
  if (!active) return null;
  const emojis = ["⚡", "🔥", "✨", "💫", "🚀", "⭐"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 150, overflow: "hidden" }}>
      {emojis.map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, y: "50vh", x: `${15 + i * 14}vw` }}
          animate={{ opacity: 0, y: "5vh" }}
          transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
          style={{ position: "absolute", fontSize: 26 + i * 2 }}
        >
          {e}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Enhanced Rocket SVG with continuous motion ───────────────────────────────
function RocketIcon({
  color, isPlayer, size = 50, boosted = false, mega = false,
}: {
  color: string; isPlayer?: boolean; size?: number; boosted?: boolean; mega?: boolean;
}) {
  const flameColor = mega ? "#00ffff" : boosted ? "#fff176" : "#ff6b1a";
  const glowStrength = mega ? 20 : isPlayer ? 12 : 6;
  return (
    <motion.div
      animate={{ y: boosted ? [-4, 4, -4] : [-3, 3, -3] }}
      transition={{ repeat: Infinity, duration: boosted ? 0.25 : 0.8, ease: "easeInOut" }}
    >
      <svg
        width={size}
        height={size * 1.6}
        viewBox="0 0 60 96"
        style={{
          filter: isPlayer
            ? `drop-shadow(0 0 ${glowStrength}px ${color}) drop-shadow(0 4px 20px rgba(255,255,255,0.4))`
            : `drop-shadow(0 2px 8px ${color}80)`,
        }}
      >
        {/* Mega glow ring */}
        {mega && (
          <motion.circle cx="30" cy="78" r="24"
            animate={{ opacity: [0.2, 0.5, 0.2], r: [22, 26, 22] }}
            transition={{ repeat: Infinity, duration: 1.0 }}
            fill="none" stroke={color} strokeWidth="2" />
        )}
        {/* Exhaust flame */}
        <motion.g
          animate={{ scaleY: boosted ? [1, 1.6, 0.8, 1.4, 1] : mega ? [1, 1.4, 0.85, 1.3, 1] : [1, 1.2, 0.9, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: boosted ? 0.12 : mega ? 0.18 : 0.25 }}
          style={{ originX: "30px", originY: "78px" }}
        >
          {mega && <path d="M14 80 Q30 110 46 80 Q40 97 30 100 Q20 97 14 80 Z" fill="#7fffff" opacity="0.5" />}
          <path d="M20 78 Q30 100 40 78 Q35 90 30 92 Q25 90 20 78 Z" fill={flameColor} opacity="0.95" />
          <path d="M23 78 Q30 90 37 78 Q33 86 30 88 Q27 86 23 78 Z" fill={mega ? "#b2ffff" : "#ffd54f"} opacity="0.95" />
          <path d="M26 78 Q30 84 34 78 Q32 82 30 83 Q28 82 26 78 Z" fill="#fff9c4" opacity="0.9" />
        </motion.g>
        {/* Body */}
        <defs>
          <linearGradient id={`rg-${color.replace("#","")}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill={color} />
        <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill={`url(#rg-${color.replace("#","")})`} />
        {/* Window */}
        <circle cx="30" cy="40" r="8" fill={mega ? "#80ffff" : "#b3e5fc"} stroke="#fff" strokeWidth="2.5" opacity="0.95" />
        <circle cx="30" cy="40" r="5" fill={mega ? "#008080" : "#0288d1"} opacity="0.7" />
        <circle cx="28" cy="38" r="2" fill="#fff" opacity="0.5" />
        {/* Standard fins */}
        <path d="M16 62 L4 82 L16 78 Z" fill={color} opacity="0.9" />
        <path d="M44 62 L56 82 L44 78 Z" fill={color} opacity="0.9" />
        {/* Mega extra wing fins */}
        {mega && <>
          <path d="M16 50 L0 68 L16 66 Z" fill={color} opacity="0.65" />
          <path d="M44 50 L60 68 L44 66 Z" fill={color} opacity="0.65" />
          <rect x="20" y="44" width="20" height="2" fill="#7fffff" opacity="0.55" rx="1" />
          <rect x="20" y="66" width="20" height="3" fill="#7fffff" opacity="0.55" rx="1" />
        </>}
        {/* Nose */}
        <path d="M30 4 L24 16 L36 16 Z" fill="#fff" opacity="0.9" />
        {/* Stripes */}
        <rect x="20" y="50" width="20" height="3" fill="#fff" opacity="0.35" rx="1" />
        <rect x="20" y="58" width="20" height="2" fill="#fff" opacity="0.25" rx="1" />
        {/* Player badge */}
        {isPlayer && <circle cx="30" cy="8" r={mega ? 7 : 5} fill={GOLD} opacity="0.9" />}
      </svg>
    </motion.div>
  );
}

// ─── Shooting star (decorative) ───────────────────────────────────────────────
function ShootingStar({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 0, y: 0, scaleX: 0 }}
      animate={{ opacity: [0, 1, 0], x: -120, y: 60, scaleX: [0, 1, 0.5] }}
      transition={{ duration: 1.2, delay, repeat: Infinity, repeatDelay: 5 + delay * 2 }}
      style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: 80, height: 1.5, background: "linear-gradient(90deg, transparent, #fff, #fff9)",
        borderRadius: 2, pointerEvents: "none",
      }}
    />
  );
}

// ─── Stars background ──────────────────────────────────────────────────────
function StarField({ phase = 0 }: { phase?: number }) {
  const stars = Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    delay: Math.random() * 4,
    twinkle: Math.random() > 0.6,
  }));
  const shooters = [{ x: 80, y: 10, delay: 3 }, { x: 60, y: 5, delay: 8 }, { x: 90, y: 20, delay: 15 }];
  const starColor = phase === 0 ? "#fff" : phase === 1 ? "#ff9966" : "#88ffee";
  const nebulaA = phase === 0 ? "rgba(80,0,120,0.15)" : phase === 1 ? "rgba(180,50,0,0.13)" : "rgba(0,200,180,0.12)";
  const nebulaB = phase === 0 ? "rgba(0,40,120,0.12)" : phase === 1 ? "rgba(120,20,0,0.10)" : "rgba(0,100,200,0.10)";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map(s => (
        <motion.div
          key={s.id}
          animate={s.twinkle ? { opacity: [0.2, 1, 0.2], scale: [1, 1.3, 1] } : { opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 + s.delay, delay: s.delay * 0.3 }}
          style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%", background: starColor,
            boxShadow: s.size > 1.5 ? `0 0 ${s.size * 3}px ${starColor}cc` : undefined,
          }}
        />
      ))}
      {shooters.map((s, i) => (<ShootingStar key={i} x={s.x} y={s.y} delay={s.delay} />))}
      <div style={{ position: "absolute", top: "15%", left: "10%", width: 300, height: 200, background: `radial-gradient(ellipse, ${nebulaA} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", right: "5%", width: 250, height: 180, background: `radial-gradient(ellipse, ${nebulaB} 0%, transparent 70%)`, pointerEvents: "none" }} />
    </div>
  );
}

// ─── Phase 2: Asteroid Field background ──────────────────────────────────────
function AsteroidField() {
  const asteroids = [
    { id:0, x:8, y:12, size:32, rot:1.2, dur:14, delay:0, drift:25 },
    { id:1, x:75, y:8, size:22, rot:-0.9, dur:10, delay:2, drift:-18 },
    { id:2, x:45, y:30, size:42, rot:0.7, dur:18, delay:1, drift:15 },
    { id:3, x:90, y:55, size:18, rot:-1.5, dur:9, delay:3, drift:-12 },
    { id:4, x:20, y:65, size:28, rot:1.0, dur:12, delay:0.5, drift:20 },
    { id:5, x:60, y:75, size:35, rot:-0.6, dur:16, delay:4, drift:-22 },
    { id:6, x:5, y:85, size:20, rot:1.4, dur:11, delay:1.5, drift:14 },
    { id:7, x:85, y:88, size:26, rot:-1.1, dur:13, delay:2.5, drift:-16 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {asteroids.map(a => (
        <motion.div key={a.id}
          animate={{ rotate: [0, a.rot * 360], x: [0, a.drift, 0], y: [0, a.drift * 0.4, 0] }}
          transition={{ duration: a.dur, delay: a.delay, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%` }}>
          <svg width={a.size} height={a.size * 0.85} viewBox="0 0 60 50" opacity={0.35}>
            <path d="M10 12 L20 4 L38 2 L52 14 L58 28 L50 42 L34 46 L18 44 L6 32 L8 18 Z"
              fill="#7c3a1a" stroke="#c0601a" strokeWidth="1.5" />
            <path d="M20 15 L28 10 L36 16 L32 26 L22 24 Z" fill="rgba(0,0,0,0.3)" />
            <path d="M38 28 L46 32 L42 40 L34 36 Z" fill="rgba(0,0,0,0.2)" />
            <path d="M12 22 L18 20 L16 28 L10 26 Z" fill="rgba(255,120,50,0.2)" />
          </svg>
        </motion.div>
      ))}
      {[...Array(6)].map((_, i) => (
        <motion.div key={`ember-${i}`}
          animate={{ y: [-10, -70], opacity: [0, 0.9, 0], x: [0, (i % 2 === 0 ? 1 : -1) * 20] }}
          transition={{ duration: 1.8 + i * 0.4, delay: i * 1.0, repeat: Infinity }}
          style={{
            position: "absolute", bottom: `${8 + i * 14}%`, left: `${12 + i * 14}%`,
            width: 5, height: 5, borderRadius: "50%",
            background: `hsl(${20 + i * 12}, 100%, 60%)`,
            boxShadow: `0 0 10px hsl(${20 + i * 12}, 100%, 60%)`,
          }} />
      ))}
      <div style={{ position: "absolute", top: "20%", left: "15%", width: 350, height: 250, background: "radial-gradient(ellipse, rgba(200,50,0,0.12) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "8%", width: 280, height: 200, background: "radial-gradient(ellipse, rgba(255,100,0,0.08) 0%, transparent 70%)" }} />
    </div>
  );
}

// ─── Phase 3: Crystal Planet background ──────────────────────────────────────
function CrystalField() {
  const crystals = Array.from({ length: 14 }, (_, i) => ({
    id: i, x: (i / 14) * 88 + 3,
    height: 35 + (i % 4) * 22,
    width: 8 + (i % 3) * 5,
    hue: 160 + (i * 17) % 60,
    delay: (i * 0.4) % 3.5,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {crystals.map(c => (
        <motion.div key={c.id}
          animate={{ y: [0, -12, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.5 + c.delay, delay: c.delay, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", bottom: `${4 + (c.id % 4) * 5}%`, left: `${c.x}%`,
            width: c.width, height: c.height,
            background: `linear-gradient(180deg, hsl(${c.hue},100%,85%) 0%, hsl(${c.hue},80%,55%) 50%, hsl(${c.hue},60%,30%) 100%)`,
            clipPath: "polygon(50% 0%, 80% 30%, 100% 80%, 60% 100%, 40% 100%, 0% 80%, 20% 30%)",
            filter: `drop-shadow(0 0 6px hsl(${c.hue},100%,75%))`,
          }} />
      ))}
      {[...Array(8)].map((_, i) => (
        <motion.div key={`crystal-spark-${i}`}
          animate={{ y: [0, -55, 0], opacity: [0, 1, 0], scale: [0.5, 1.5, 0] }}
          transition={{ duration: 1.4 + i * 0.25, delay: i * 0.7, repeat: Infinity }}
          style={{
            position: "absolute", left: `${8 + i * 11}%`, bottom: `${12 + (i % 3) * 8}%`,
            width: 4, height: 4, borderRadius: "50%",
            background: `hsl(${170 + i * 8}, 100%, 75%)`,
            boxShadow: `0 0 8px hsl(${170 + i * 8}, 100%, 75%)`,
          }} />
      ))}
      <div style={{ position: "absolute", top: "10%", left: "10%", width: 400, height: 300, background: "radial-gradient(ellipse, rgba(0,210,190,0.11) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "5%", width: 300, height: 220, background: "radial-gradient(ellipse, rgba(0,130,255,0.09) 0%, transparent 70%)" }} />
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
        background: `radial-gradient(ellipse at center, ${p.color}bb 0%, #000000bb 100%)`,
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.8, times: [0, 0.3, 0.7, 1] }}
        style={{ textAlign: "center" }}
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 0.6, repeat: 2 }}
          style={{ fontSize: 60, marginBottom: 12, display: "inline-block" }}
        >
          {p.icon}
        </motion.div>
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, textShadow: `0 0 30px ${p.color}, 0 0 60px ${p.color}80` }}>
          {p.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginTop: 4 }}>{p.nameEn}</div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -8] }}
          transition={{ duration: 1.8, times: [0.2, 0.35, 0.7, 1] }}
          style={{
            marginTop: 18, color: "#fff", fontSize: 16, fontWeight: 800,
            background: `${p.color}80`, padding: "8px 24px",
            borderRadius: 999, border: `2px solid ${p.color}`,
            display: "inline-block",
          }}
        >
          {p.label}
        </motion.div>
      </motion.div>
    </motion.div>
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
  const [countdownNum, setCountdownNum] = useState(3);
  const [fillAnswer, setFillAnswer] = useState("");
  const [boostFlash, setBoostFlash] = useState(false);

  // Shuffled question display (options reordered each question)
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [optionMapping, setOptionMapping] = useState<number[]>([]); // displayIdx → originalIdx
  const wrongAutoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState("");
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(0);
  const [gameTimeMax, setGameTimeMax] = useState(300);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndTimeRef = useRef<number>(0);

  // ─── Game Phase (0=Space, 1=Asteroids, 2=Crystal) ─────────────────────────
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

  // Shuffle options whenever a new question arrives
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
  }, [currentQ?.index]);

  // Game timer countdown (client-side)
  const startGameTimer = useCallback((durationSecs: number) => {
    const endTime = Date.now() + durationSecs * 1000;
    gameEndTimeRef.current = endTime;
    setGameTimeMax(durationSecs);
    setGameTimeLeft(durationSecs);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    gameTimerRef.current = setInterval(() => {
      const rem = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setGameTimeLeft(rem);
      if (rem <= 10 && rem > 0) soundRef.current?.playTick();
      if (rem === 0) {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      }
    }, 500);
  }, []);

  useEffect(() => () => { if (gameTimerRef.current) clearInterval(gameTimerRef.current); }, []);

  // Detect phase transitions based on altitude
  useEffect(() => {
    if (phase !== "racing") return;
    const newPhase = myAltitude >= 67 ? 2 : myAltitude >= 34 ? 1 : 0;
    if (newPhase !== prevGamePhaseRef.current) {
      prevGamePhaseRef.current = newPhase;
      setGamePhase(newPhase);
      setShowPhaseTransition(true);
      setTimeout(() => setShowPhaseTransition(false), 1800);
      soundRef.current?.playPhaseTransition();
      const modes = ["race1", "race2", "race3"] as const;
      soundRef.current?.startBackground(modes[newPhase]);
    }
  }, [myAltitude, phase]);

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
      }) => {
        if (res.error) { toast.error(res.error); setLocation(`/game/rocket/join/${pin}`); return; }
        if (res.success) {
          setMyColor(res.rocketColor || "#dc2626");
          setTotalQuestions(res.totalQuestions || 0);
          if (res.title) setTitle(res.title);
          setMyAltitude(res.altitude || 0);
          setMyScore(res.score || 0);
          if (res.state === "racing" && res.activeQuestion) {
            setCurrentQ(res.activeQuestion);
            setQuestionStartTime(Date.now());
            setPhase("racing");
            if (res.totalDurationSecs) startGameTimer(res.totalDurationSecs);
          } else if (res.state === "finished") {
            setPhase("finished");
          } else {
            setPhase("lobby");
            soundRef.current?.startBackground("lobby");
          }
        }
      });
    };

    if (socket.connected) joinFlow(); else socket.once("connect", joinFlow);

    socket.on("rocket:players-updated", (data: { players: Player[] }) => setPlayers(data.players));

    socket.on("rocket:countdown", () => {
      setPhase("countdown");
      setCountdownNum(3);
      soundRef.current?.startBackground("lobby");
    });

    socket.on("rocket:race-start", (data: { total: number; gameDuration?: number; question: Question }) => {
      setPhase("racing");
      soundRef.current?.startBackground("race1");
      setTotalQuestions(data.total);
      setCurrentQ(data.question);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      soundRef.current?.playLaunch();
      if (data.gameDuration) startGameTimer(data.gameDuration);
    });

    socket.on("rocket:next-question", (q: Question) => {
      setCurrentQ(q);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setFillAnswer("");
      setEncouragement(null);
    });

    socket.on("rocket:leaderboard", (data: { players: Player[] }) => setPlayers(data.players));

    socket.on("rocket:game-end", (data: { players: Player[] }) => {
      setPhase("finished");
      if (data.players) setPlayers(data.players);
      soundRef.current?.stopBackground();
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      setGameTimeLeft(0);
    });

    socket.on("rocket:replay", () => {
      setMyAltitude(0); setMyScore(0); setMyStreak(0);
      setPhase("lobby");
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      setGameTimeLeft(0);
    });

    return () => {
      socket.off("rocket:players-updated");
      socket.off("rocket:countdown");
      socket.off("rocket:race-start");
      socket.off("rocket:next-question");
      socket.off("rocket:leaderboard");
      socket.off("rocket:game-end");
      socket.off("rocket:replay");
    };
  }, [pin, queryName, queryAvatar, setLocation, startGameTimer]);

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

  // Per-question timer
  useEffect(() => {
    if (phase !== "racing" || !currentQ || feedback) return;
    setTimeLeft(currentQ.duration);
    const startMs = Date.now();
    const intv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const remaining = Math.max(0, currentQ.duration - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 3 && remaining > 0) soundRef.current?.playTick();
      if (remaining === 0) { clearInterval(intv); submitAnswer(-1); }
    }, 1000);
    return () => clearInterval(intv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.index, phase]);

  const submitAnswer = useCallback((answerIndex: number, answerText?: string) => {
    if (!currentQ) return;
    const socket = getRocketSocket();
    socket.emit("rocket:answer", { pin, answerIndex, answerText }, (res: {
      success?: boolean; error?: string;
      correct?: boolean; correctIndex?: number; correctText?: string;
      altitude?: number; score?: number; streak?: number;
    }) => {
      if (res.error) { toast.error(res.error); return; }
      if (res.success) {
        setFeedback({ correct: !!res.correct, correctIndex: res.correctIndex, correctText: res.correctText });
        const prevAlt = myAltitude;
        if (typeof res.altitude === "number") setMyAltitude(res.altitude);
        if (typeof res.score === "number") setMyScore(res.score);
        if (typeof res.streak === "number") setMyStreak(res.streak);
        if (res.correct) {
          soundRef.current?.playCorrect();
          setEncouragement(ar ? pick(CORRECT_AR) : pick(CORRECT_EN));
          if (typeof res.altitude === "number" && res.altitude - prevAlt > 10) {
            setBoostFlash(true);
            setTimeout(() => setBoostFlash(false), 900);
            setTimeout(() => soundRef.current?.playBoost(), 150);
          }
        } else {
          soundRef.current?.playWrong();
          setEncouragement(ar ? pick(WRONG_AR) : pick(WRONG_EN));
          // Auto-advance to next question after 1 second on wrong answer
          if (wrongAutoRef.current) clearTimeout(wrongAutoRef.current);
          wrongAutoRef.current = setTimeout(() => {
            setFeedback(null);
            setFillAnswer("");
            setEncouragement(null);
            // Submit -1 to server so it sends rocket:next-question
            const sock = getRocketSocket();
            sock.emit("rocket:answer", { pin, answerIndex: -1, skipToNext: true }, () => {});
          }, 1000);
        }
      }
    });
  }, [currentQ, myAltitude, pin, ar]);

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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ─── Connecting ─────────────────────────────────────────────────────────
  if (phase === "connecting") {
    return (
      <div style={{ minHeight: "100dvh", background: SPACE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <StarField />
        <Loader2 size={44} color={GOLD} className="animate-spin" style={{ position: "relative", zIndex: 10 }} />
      </div>
    );
  }

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: PHASE_BACKGROUNDS[gamePhase], position: "relative", overflow: "hidden", transition: "background 2s ease" }}>
      <StarField phase={gamePhase} />
      {gamePhase === 1 && <AsteroidField />}
      {gamePhase === 2 && <CrystalField />}
      <PhaseTransitionOverlay gamePhase={gamePhase} show={showPhaseTransition} />
      <BoostParticles active={boostFlash} />

      {/* Top bar */}
      <div style={{
        position: "relative", zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
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
        </div>

        {/* Game timer */}
        {phase === "racing" && gameTimeMax > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            borderRadius: 999,
            background: gameTimeLeft <= 30 ? "rgba(220,38,38,0.35)" : gameTimeLeft <= 60 ? "rgba(217,165,33,0.3)" : "rgba(255,255,255,0.1)",
            border: `1.5px solid ${gameTimeLeft <= 30 ? "#ef4444" : gameTimeLeft <= 60 ? GOLD : "rgba(255,255,255,0.2)"}`,
            color: "#fff", fontWeight: 800, fontSize: 15,
          }}>
            {gameTimeLeft <= 30 ? "⚠️" : "🕐"} {formatTime(gameTimeLeft)}
          </div>
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

      {/* ── Lobby ── */}
      {phase === "lobby" && (
        <div style={{ position: "relative", zIndex: 5, padding: "40px 20px", textAlign: "center" }}>
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            style={{ display: "inline-block", marginBottom: 20 }}
          >
            <RocketIcon color={myColor} isPlayer size={90} />
          </motion.div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 900, margin: "0 0 8px" }}>
            {ar ? "في انتظار الانطلاق..." : "Awaiting Launch..."}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, margin: 0 }}>
            {ar ? "سينطلق السباق عند بدء المعلم" : "Race starts when teacher launches"}
          </p>
          <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 600, marginInline: "auto" }}>
            {players.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: p.name === queryName ? `${GOLD}30` : "rgba(255,255,255,0.08)",
                  border: p.name === queryName ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.15)",
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

      {/* ── Countdown ── */}
      {phase === "countdown" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,8,24,0.88)", backdropFilter: "blur(10px)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={countdownNum}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                fontSize: countdownNum > 0 ? 160 : 80,
                fontWeight: 900,
                color: GOLD,
                textShadow: `0 0 40px ${GOLD}, 0 0 80px ${GOLD}60`,
                textAlign: "center",
              }}
            >
              {countdownNum > 0 ? countdownNum : (ar ? "🚀 انطلق!" : "🚀 GO!")}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Racing ── */}
      {phase === "racing" && (
        isMobile ? (
          // MOBILE: question panel on top, compact rocket leaderboard at bottom
          <div style={{ position: "relative", zIndex: 5, display: "flex", flexDirection: "column", height: "calc(100dvh - 56px)" }}>
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
                fillAnswer={fillAnswer}
                setFillAnswer={setFillAnswer}
                handleMCQAnswer={handleMCQAnswer}
                handleFillSubmit={handleFillSubmit}
                encouragement={encouragement}
                ar={ar}
                displayOptions={shuffledOptions}
              />}
            </div>
            {/* Compact rocket leaderboard (bottom strip) */}
            <div style={{
              height: 110,
              background: "rgba(0,0,0,0.5)",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              padding: "8px 12px",
              overflowX: "auto",
              display: "flex", alignItems: "flex-end", gap: 12,
              position: "relative",
            }}>
              {sortedPlayers.map((p) => {
                const isMe = p.name === queryName;
                const barH = Math.max(20, (p.altitude / 100) * 80);
                return (
                  <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: isMe ? 9 : 8, color: isMe ? GOLD : "rgba(255,255,255,0.6)", fontWeight: 700, whiteSpace: "nowrap", maxWidth: 50, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.avatar}
                    </span>
                    <div style={{ position: "relative", height: barH, width: 24 }}>
                      <RocketIcon color={p.rocketColor} isPlayer={isMe} size={isMe ? 28 : 22} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // DESKTOP: rockets panel left, question right
          <div style={{ position: "relative", zIndex: 5, display: "grid", gridTemplateColumns: "minmax(260px, 300px) 1fr", gap: 14, padding: "14px 16px", alignItems: "start", height: "calc(100dvh - 70px)" }}>
            {/* Race track */}
            <div style={{
              position: "relative", height: "100%",
              background: gamePhase === 0 ? "rgba(255,255,255,0.04)"
                : gamePhase === 1 ? "rgba(180,60,0,0.08)"
                : "rgba(0,200,180,0.06)",
              borderRadius: 18,
              border: `1px solid ${gamePhase === 0 ? "rgba(255,255,255,0.09)" : gamePhase === 1 ? "rgba(200,80,0,0.3)" : "rgba(0,200,180,0.25)"}`,
              overflow: "hidden", padding: "16px 8px",
              transition: "background 2s ease, border 2s ease",
            }}>
              {/* Finish line */}
              <div style={{
                position: "absolute", top: 16, left: 0, right: 0, height: 4,
                background: `repeating-linear-gradient(90deg, ${GOLD} 0 12px, #fff 12px 24px)`,
                boxShadow: `0 0 18px ${GOLD}90`,
              }} />
              <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 2 }}>
                🏁 {ar ? "خط النهاية" : "FINISH"}
              </div>

              {/* Phase indicator inside track */}
              <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", fontSize: 9, fontWeight: 700, color: gamePhase === 0 ? "rgba(180,180,255,0.6)" : gamePhase === 1 ? "rgba(255,140,80,0.7)" : "rgba(80,255,220,0.7)" }}>
                {gamePhase === 0 ? "🌌 الفضاء" : gamePhase === 1 ? "☄️ الكويكبات" : "💎 الكريستال"}
              </div>

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
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {sortedPlayers.map((p, idx) => {
                  const isMe = p.name === queryName;
                  const lanes = Math.max(1, sortedPlayers.length);
                  const xPos = (idx / Math.max(1, lanes - 1)) * 76 + 12;
                  const isMega = isMe && gamePhase === 2;
                  return (
                    <motion.div
                      key={p.name}
                      animate={{ bottom: `${Math.min(90, p.altitude)}%`, left: `${xPos}%` }}
                      initial={false}
                      transition={{ type: "spring", stiffness: 60, damping: 18 }}
                      style={{
                        position: "absolute",
                        transform: "translateX(-50%)",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        zIndex: isMe ? 10 : 5,
                      }}
                    >
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: isMe ? GOLD : "#fff",
                        background: "rgba(0,0,0,0.6)",
                        padding: "1px 5px", borderRadius: 999, whiteSpace: "nowrap",
                        maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis",
                        border: isMe ? `1px solid ${GOLD}` : "none",
                      }}>
                        {p.avatar} {p.name}
                      </span>
                      <RocketIcon
                        color={p.rocketColor}
                        isPlayer={isMe}
                        size={isMega ? 46 : isMe ? 38 : 28}
                        boosted={isMe && boostFlash}
                        mega={isMega}
                      />
                      <span style={{ fontSize: 8, color: isMe ? GOLD : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
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
            </div>

            {/* Question */}
            <div style={{ overflowY: "auto", maxHeight: "100%" }}>
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
  currentQ, timeLeft, totalQuestions, feedback, fillAnswer, setFillAnswer,
  handleMCQAnswer, handleFillSubmit, encouragement, ar, displayOptions,
}: {
  currentQ: Question;
  timeLeft: number;
  totalQuestions: number;
  feedback: { correct: boolean; correctIndex?: number; correctText?: string } | null;
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
    "linear-gradient(155deg, #7f1d1d, #b91c1c)",
    "linear-gradient(155deg, #1e3a5f, #1d4ed8)",
    "linear-gradient(155deg, #713f12, #d97706)",
    "linear-gradient(155deg, #4a1d96, #7c3aed)",
  ];

  return (
    <div>
      {/* Progress + timer row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700 }}>
            {ar ? "السؤال" : "Q"} {currentQ.index + 1} / {totalQuestions}
          </span>
          {currentQ.index + 1 > totalQuestions && (
            <span style={{ fontSize: 10, color: GOLD, fontWeight: 700, background: "rgba(217,165,33,0.15)", padding: "2px 8px", borderRadius: 999, border: `1px solid ${GOLD}50` }}>
              {ar ? "دورة ثانية" : "Cycle 2+"}
            </span>
          )}
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 14px", borderRadius: 999,
          background: timeLeft <= 5 ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.1)",
          border: `1.5px solid ${timeLeft <= 5 ? "#dc2626" : "rgba(255,255,255,0.2)"}`,
          color: "#fff", fontWeight: 800, fontSize: 14,
          animation: timeLeft <= 5 ? "pulse 0.5s infinite" : undefined,
        }}>
          ⏱ {timeLeft}s
        </div>
      </div>

      {/* Question text */}
      <div style={{
        background: "rgba(255,255,255,0.07)",
        borderRadius: 18, padding: "18px 18px", marginBottom: 12,
        border: `1.5px solid rgba(217,165,33,0.3)`,
        backdropFilter: "blur(4px)",
      }}>
        <p style={{ color: "#fff", fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.55 }}>
          {currentQ.text}
        </p>
      </div>

      {/* MCQ options */}
      {currentQ.type === "mcq" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {options.map((opt, idx) => {
            const showCorrect = feedback && feedback.correctIndex === idx;
            const showWrong = feedback && !feedback.correct && idx === (feedback.correctIndex ?? -99) - 9999;
            void showWrong;
            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.96 }}
                disabled={!!feedback}
                onClick={() => handleMCQAnswer(idx)}
                style={{
                  background: showCorrect ? "linear-gradient(155deg, #15803d, #22c55e)" : MCQ_COLORS[idx % 4],
                  border: showCorrect ? `2.5px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.12)",
                  borderRadius: 16, padding: "15px 14px",
                  color: "#fff", fontSize: 15, fontWeight: 800,
                  textAlign: "start", minHeight: 66,
                  cursor: feedback ? "default" : "pointer",
                  opacity: feedback && !showCorrect ? 0.38 : 1,
                  transition: "opacity .2s",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span style={{
                  display: "inline-flex", width: 28, height: 28, borderRadius: 8,
                  background: "rgba(255,255,255,0.22)",
                  alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 13, flexShrink: 0,
                }}>
                  {["أ", "ب", "ج", "د"][idx]}
                </span>
                <span style={{ lineHeight: 1.3 }}>{opt}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* True/False */}
      {currentQ.type === "true_false" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { idx: 0, label: ar ? "✓ صحيح" : "✓ True", color: "linear-gradient(155deg, #14532d, #16a34a)", icon: <CheckCircle2 size={28} /> },
            { idx: 1, label: ar ? "✗ خطأ" : "✗ False", color: "linear-gradient(155deg, #7f1d1d, #dc2626)", icon: <XCircle size={28} /> },
          ].map(o => {
            const showCorrect = feedback && feedback.correctIndex === o.idx;
            return (
              <motion.button
                key={o.idx}
                whileTap={{ scale: 0.96 }}
                disabled={!!feedback}
                onClick={() => handleMCQAnswer(o.idx)}
                style={{
                  background: o.color, border: showCorrect ? `3px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.15)",
                  borderRadius: 18, padding: "24px 18px",
                  color: "#fff", fontSize: 20, fontWeight: 900,
                  cursor: feedback ? "default" : "pointer",
                  opacity: feedback && !showCorrect ? 0.38 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 90,
                }}
              >
                {o.icon} {o.label}
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
              background: "rgba(255,255,255,0.1)",
              border: `2px solid ${feedback?.correct ? "#16a34a" : feedback?.correct === false ? "#dc2626" : "rgba(255,255,255,0.25)"}`,
              borderRadius: 14, color: "#fff", fontSize: 18, fontWeight: 700,
              outline: "none",
            }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleFillSubmit}
            disabled={!!feedback || !fillAnswer.trim()}
            style={{
              width: "100%", padding: "14px",
              background: feedback ? "rgba(255,255,255,0.15)" : `linear-gradient(135deg, ${GOLD}, #b8860b)`,
              border: "none", borderRadius: 14,
              color: "#fff", fontSize: 16, fontWeight: 900,
              cursor: feedback ? "default" : "pointer",
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

      {/* Feedback banner + encouragement */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              marginTop: 12, padding: "14px 18px", borderRadius: 16,
              background: feedback.correct ? "rgba(22,163,74,0.28)" : "rgba(220,38,38,0.28)",
              border: `2px solid ${feedback.correct ? "#22c55e" : "#dc2626"}`,
              textAlign: "center",
            }}
          >
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 17, margin: "0 0 4px" }}>
              {encouragement || (feedback.correct
                ? (ar ? "🚀 إجابة صحيحة! ارتفع صاروخك!" : "🚀 Correct! Rocket boosted!")
                : (ar ? "❌ إجابة خاطئة، السؤال سيعود!" : "❌ Wrong! Question will return!"))}
            </p>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: 0 }}>
              {feedback.correct
                ? (ar ? "السؤال التالي يأتيك تلقائياً..." : "Next question coming...")
                : (ar ? "ستحصل على فرصة أخرى لهذا السؤال" : "You'll get another chance at this")}
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
      if (myRank === 1) return "🏆 Champion of Space! You dominated the race!";
      if (myRank <= 3) return "🥈 Outstanding! You're among the best!";
      if (myRank <= Math.ceil(players.length / 2)) return "🚀 Great race! Keep pushing higher!";
      return "⭐ You showed up and launched — that's a win! Next time, aim higher!";
    }
    if (myRank === 1) return "🏆 أنت بطل الفضاء! سيطرت على السباق وحلّقت أعلى الجميع!";
    if (myRank <= 3) return "🥈 أداء رائع! أنت من نخبة المتسابقين!";
    if (myRank <= Math.ceil(players.length / 2)) return "🚀 سباق ممتاز! استمر في التحسن والصعود!";
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
        {/* Motivational header */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          style={{ textAlign: "center", marginBottom: 24 }}
        >
          <motion.div
            animate={{ rotate: [-5, 5, -5], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ fontSize: 60, marginBottom: 8 }}
          >
            {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🚀"}
          </motion.div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.3 }}>
            {ar ? "🎊 انتهى السباق — أحسنتم جميعاً! 🎊" : "🎊 Race Over — You All Flew High! 🎊"}
          </h1>
          <p style={{ color: GOLD, fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>
            {motivationalText()}
          </p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0 }}>
            {ar ? `مرتبتك: #${myRank} · نقاطك: ${myScore}` : `Your rank: #${myRank} · Score: ${myScore}`}
          </p>
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
              return (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + podIdx * 0.15, type: "spring", stiffness: 200 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: rank === 1 ? 1.2 : 1, maxWidth: 140 }}
                >
                  <span style={{ fontSize: 22 }}>{p.avatar}</span>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: rank === 1 ? 14 : 12, margin: "4px 0 2px", textAlign: "center", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </p>
                  <p style={{ color: rankColors[rank], fontWeight: 700, fontSize: 11, margin: "0 0 4px" }}>
                    {p.score} {ar ? "نق" : "pts"}
                  </p>
                  <div style={{
                    width: "100%",
                    height: h,
                    background: `linear-gradient(180deg, ${rankColors[rank]}50, ${rankColors[rank]}20)`,
                    border: `2px solid ${rankColors[rank]}80`,
                    borderRadius: "8px 8px 0 0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: rank === 1 ? 32 : 24,
                  }}>
                    {rankEmoji[rank]}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Full player list */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 20, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
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
              borderRadius: 14, border: "none",
              background: saved ? "rgba(22,163,74,0.4)" : `linear-gradient(135deg, #1d4ed8, #2563eb)`,
              color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: saving || saved ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saved ? (ar ? "✓ تم الحفظ!" : "✓ Saved!") : saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "💾 حفظ النتائج" : "💾 Save Scores")}
          </button>
          <button
            onClick={onHome}
            style={{
              flex: 1, minWidth: 140,
              padding: "13px 16px",
              borderRadius: 14, border: "none",
              background: `linear-gradient(135deg, ${GOLD}, #b8860b)`,
              color: "#000", fontWeight: 900, fontSize: 14,
              cursor: "pointer",
            }}
          >
            {ar ? "🏠 الرئيسية" : "🏠 Home"}
          </button>
        </div>
      </div>
    </div>
  );
}
