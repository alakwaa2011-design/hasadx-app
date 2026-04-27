import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { CartoonTugScene } from "@/components/game/cartoon-tug-scene";
import { AvatarDisplay } from "@/components/avatar-display";
import { QRModalButton } from "@/components/game-qr-code";

type Phase =
  | "connecting"
  | "lobby"
  | "countdown"
  | "question"
  | "answered"
  | "round-end"
  | "finished"
  | "paused";

interface PlayerInfo {
  name: string;
  avatar: string;
  team: "blue" | "red";
  score: number;
  streak?: number;
}

interface QuestionData {
  index: number;
  total: number;
  text: string;
  options: string[];
  duration: number;
  isPower?: boolean;
}

interface RoundEndData {
  correctIndex: number;
  ropePosition: number;
  blueScore: number;
  redScore: number;
  players: PlayerInfo[];
  isLast: boolean;
  questionIndex: number;
  total: number;
  isPower?: boolean;
  blueOnFire?: boolean;
  redOnFire?: boolean;
  autoAdvance?: boolean;
  autoAdvanceIn?: number | null;
}

interface GameEndData {
  winner: "blue" | "red" | "draw";
  ropePosition: number;
  players: PlayerInfo[];
}


const ENCOURAGE_CORRECT = [
  "ممتاز! 🌟", "عبقري! 🧠", "رائع جداً! ✨", "أحسنت! 💪", "مذهل! 🔥",
  "بطل! 🏆", "خارق! ⚡", "رهيب! 🎯", "استمر! 🚀", "لا يُهزم! 💎",
];
const ENCOURAGE_WRONG = [
  "لا تستسلم! 💪", "حاول مجدداً! 🎯", "قريب! 🔥", "المرة القادمة! ⭐",
];
const STREAK_MSGS = [
  "سلسلة إجابات! 🔥🔥", "على النار! 🔥🔥🔥", "لا يوقفه أحد! ⚡🔥",
];

type MusicStyle = "energetic" | "electronic" | "epic" | "chill" | "challenge";
const MUSIC_STYLES: { id: MusicStyle; icon: string; ar: string; en: string; descAr: string; descEn: string }[] = [
  { id: "challenge", icon: "🎶", ar: "تحدي مشوق", en: "Fun Challenge", descAr: "حماسي وناعم — مثالي للطلاب", descEn: "Energetic yet gentle" },
  { id: "energetic", icon: "🔥", ar: "حماسي", en: "Energetic", descAr: "إيقاع سريع وقوي", descEn: "Fast & powerful" },
  { id: "electronic", icon: "🎮", ar: "إلكتروني", en: "Electronic", descAr: "أسلوب ألعاب الفيديو", descEn: "Retro game style" },
  { id: "epic", icon: "⚔️", ar: "ملحمي", en: "Epic", descAr: "طبول وأوتار ضخمة", descEn: "Drums & big chords" },
  { id: "chill", icon: "🎵", ar: "هادئ", en: "Chill", descAr: "لحن هادئ وناعم", descEn: "Soft & melodic" },
];

class TugSoundEngine {
  private ctx: AudioContext | null = null;
  private started = false;
  private bgHandle: ReturnType<typeof setTimeout> | null = null;
  private urgent = false;
  musicStyle: MusicStyle = "challenge";
  muted = false;

  constructor() {
    try {
      const saved = localStorage.getItem("tug-music-style");
      if (saved && ["energetic", "electronic", "epic", "chill", "challenge"].includes(saved)) this.musicStyle = saved as MusicStyle;
      this.muted = localStorage.getItem("tug-music-muted") === "1";
    } catch (_) {}
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.13, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  }

  setUrgency(urgent: boolean) { this.urgent = urgent; }

  setMusicStyle(style: MusicStyle) {
    this.musicStyle = style;
    try { localStorage.setItem("tug-music-style", style); } catch (_) {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem("tug-music-muted", m ? "1" : "0"); } catch (_) {}
  }

  private noise(dur: number, vol: number, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const g = ctx.createGain(); src.connect(g); g.connect(ctx.destination);
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
      src.disconnect(); src.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(vol, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay); src.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  startBackground() {
    if (this.started) return;
    this.started = true;
    let step = 0;
    const penta = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
    const playBeat = () => {
      if (!this.started) return;
      try {
        const style = this.musicStyle;
        const baseBpm = style === "energetic" ? 170 : style === "electronic" ? 160 : style === "epic" ? 145 : style === "challenge" ? 138 : 125;
        const urgBpm  = style === "energetic" ? 210 : style === "electronic" ? 200 : style === "epic" ? 185 : style === "challenge" ? 172 : 155;
        const bpm = this.urgent ? urgBpm : baseBpm;
        const beat = 60 / bpm;
        const b = step % 8;
        const bar = Math.floor(step / 8);

        if (style === "energetic") {
          if (b % 2 === 0) {
            this.tone(this.urgent ? 110 : 82, 0.15, "sine", 0.28);
            this.tone(this.urgent ? 55 : 41, 0.2, "sine", 0.2, 0.02);
          }
          this.noise(0.03, b % 2 === 1 ? 0.14 : 0.06);
          if (b % 4 === 2) this.noise(0.06, 0.16);
          const bassArr = [131, 165, 147, 196];
          this.tone(bassArr[bar % 4], beat * 0.6, "sawtooth", 0.18);
          if (b % 2 === 1) this.tone(bassArr[bar % 4] * 2, beat * 0.3, "sawtooth", 0.08);
          const mi = (bar * 3 + b) % penta.length;
          const note = penta[mi] * 2;
          this.tone(note, beat * 0.5, "square", this.urgent ? 0.11 : 0.08);
          if (b % 2 === 0) {
            this.tone(note * 1.5, beat * 0.35, "square", 0.05, beat * 0.12);
            this.tone(note * 0.75, beat * 0.3, "triangle", 0.04, beat * 0.06);
          }
          if (b === 0) {
            const ch = penta[(bar * 2) % penta.length];
            this.tone(ch, beat * 2.5, "sawtooth", 0.06);
            this.tone(ch * 1.25, beat * 2.5, "sawtooth", 0.05, 0.03);
            this.tone(ch * 1.5, beat * 2.5, "sawtooth", 0.04, 0.06);
          }
          if (b === 6 || b === 7) {
            this.noise(0.04, 0.12);
            this.tone(this.urgent ? 150 : 120, 0.1, "sine", 0.15);
          }
        } else if (style === "electronic") {
          if (b % 4 === 0) {
            this.tone(this.urgent ? 100 : 80, 0.15, "square", 0.2);
            this.tone(this.urgent ? 50 : 40, 0.2, "square", 0.14, 0.01);
          }
          if (b % 2 === 1) this.noise(0.02, 0.08);
          if (b % 4 === 2) this.noise(0.05, 0.12);
          const chipNotes = [523, 659, 784, 988, 1047, 1319, 1568, 1976];
          const ci = (bar * 2 + Math.floor(b / 2)) % chipNotes.length;
          this.tone(chipNotes[ci], beat * 0.5, "square", this.urgent ? 0.08 : 0.06);
          if (b % 2 === 0) {
            this.tone(chipNotes[ci] / 2, beat * 0.7, "square", 0.05, beat * 0.2);
          }
          const chipBass = [131, 165, 196, 262];
          if (b % 2 === 0) this.tone(chipBass[bar % 4], beat * 1.2, "square", 0.1);
          if (b === 0 && bar % 2 === 0) {
            [1, 1.25, 1.5].forEach((m, i) =>
              this.tone(chipNotes[ci] * m, beat * 2, "square", 0.03, i * 0.04));
          }
        } else if (style === "epic") {
          if (b % 4 === 0) {
            this.tone(this.urgent ? 90 : 65, 0.4, "sine", 0.25);
            this.tone(this.urgent ? 45 : 33, 0.5, "sine", 0.18, 0.03);
            this.noise(0.08, 0.08, 0.02);
          }
          if (b % 4 === 2) {
            this.noise(0.1, 0.14);
            this.tone(200, 0.08, "sine", 0.06);
          }
          if (b % 2 === 1) this.noise(0.03, 0.05);
          const epicNotes = [196, 220, 262, 294, 330, 392, 440, 523];
          const ei = (bar + Math.floor(b / 4)) % epicNotes.length;
          if (b % 4 === 0) {
            const n = epicNotes[ei];
            this.tone(n, beat * 3, "triangle", 0.08);
            this.tone(n * 1.25, beat * 3, "triangle", 0.06, 0.05);
            this.tone(n * 1.5, beat * 3, "triangle", 0.05, 0.1);
          }
          if (b === 0) {
            this.tone(epicNotes[ei] * 2, beat * 1.5, "sawtooth", 0.06);
          }
          const epicBass = [65, 82, 98, 110];
          if (b % 2 === 0) this.tone(epicBass[bar % 4], beat * 1.5, "triangle", 0.12);
        } else if (style === "chill") {
          if (b % 4 === 0) {
            this.tone(this.urgent ? 110 : 82, 0.3, "sine", 0.18);
            this.tone(this.urgent ? 55 : 41, 0.35, "sine", 0.12, 0.02);
          }
          if (b % 4 === 2) this.noise(0.04, 0.06);
          const bassNotes = [131, 147, 165, 196];
          if (b % 2 === 0) this.tone(bassNotes[bar % 4], beat * 1.2, "triangle", 0.1);
          const mi = (bar * 2 + Math.floor(b / 2)) % penta.length;
          if (b % 2 === 0) {
            const note = penta[mi];
            const vol = this.urgent ? 0.07 : 0.05;
            this.tone(note, beat * 1.6, "sine", vol);
            this.tone(note * 1.5, beat * 1.2, "sine", vol * 0.5, beat * 0.3);
          }
          if (b === 0 && bar % 2 === 0) {
            const ch = penta[mi];
            this.tone(ch, beat * 2, "triangle", 0.03);
            this.tone(ch * 1.25, beat * 2, "triangle", 0.025, 0.05);
            this.tone(ch * 1.5, beat * 2, "triangle", 0.02, 0.1);
          }
        } else if (style === "challenge") {
          // ── تحدي مشوق: sine/triangle فقط — ناعم للطلاب ──────────────────
          // Soft kick — sine waves, no harsh noise
          if (b % 4 === 0) {
            this.tone(this.urgent ? 88 : 68, 0.22, "sine", 0.42);
            this.tone(this.urgent ? 44 : 34, 0.28, "sine", 0.30, 0.01);
          }
          if (b === 2 || b === 6) this.tone(60, 0.12, "sine", 0.18); // ghost beat

          // Soft clap — mid-freq sine (no noise)
          if (b % 4 === 2) {
            this.tone(320, 0.07, "sine", 0.11);
            this.tone(280, 0.06, "sine", 0.08, 0.012);
          }

          // Warm bass — G major pentatonic (sine)
          // G2=196 A2=220 B2=247 D3=294 E3=330
          const challengeBass = [196, 196, 220, 220, 247, 196, 220, 247];
          this.tone(challengeBass[b], beat * 1.5, "sine", 0.26);

          // Pad chords — triangle waves, one per bar
          if (b === 0) {
            const padChords = [[392, 494, 587], [330, 415, 494], [294, 370, 440], [440, 554, 659]];
            const chord = padChords[bar % 4];
            chord.forEach((f, i) => this.tone(f, beat * 7.5, "triangle", 0.05, i * 0.018));
          }

          // Xylophone melody — G major pentatonic
          // G4=392 A4=440 B4=494 D5=587 E5=659 G5=784 A5=880
          const melSeqs = [
            [587, 659, 784,   0, 880,   0, 784, 659],
            [587,   0, 659, 587, 494,   0, 587,   0],
            [392, 494, 587, 659, 784,   0, 659, 587],
            [  0, 880,   0,1047,   0, 880, 784,   0],
          ];
          const mel = melSeqs[bar % 4][b];
          if (mel) {
            this.tone(mel, beat * 1.4, "sine", this.urgent ? 0.16 : 0.13);
            this.tone(mel * 2, beat * 0.6, "triangle", 0.04, 0.008); // shimmer harmonic
          }

          // Sparkle high note on off-beats every other bar
          if (bar % 2 === 1 && (b === 1 || b === 3 || b === 5 || b === 7)) {
            this.tone(1319, 0.08, "sine", 0.035);
          }
        }

        step += 1;
        this.bgHandle = setTimeout(playBeat, beat * 1000);
      } catch (_) { this.bgHandle = setTimeout(playBeat, 500); }
    };
    playBeat();
  }

  stopBackground() {
    if (this.bgHandle !== null) { clearTimeout(this.bgHandle); this.bgHandle = null; }
    this.started = false; this.urgent = false;
  }

  playCorrect() {
    this.tone(659, 0.05, "square", 0.22);
    this.tone(880, 0.05, "square", 0.22, 0.04);
    this.tone(1047, 0.05, "square", 0.22, 0.08);
    this.tone(1319, 0.08, "square", 0.25, 0.12);
    this.tone(1568, 0.12, "square", 0.2, 0.16);
    this.tone(2093, 0.1, "sawtooth", 0.12, 0.18);
    this.noise(0.05, 0.15, 0.16);
  }
  playWrong() {
    this.tone(300, 0.06, "sawtooth", 0.2);
    this.tone(220, 0.08, "sawtooth", 0.2, 0.06);
    this.tone(160, 0.1, "sawtooth", 0.18, 0.12);
    this.tone(100, 0.15, "sawtooth", 0.15, 0.2);
    this.noise(0.08, 0.1);
  }
  playBoost() {
    [784, 988, 1175, 1319, 1568, 1976].forEach((f, i) =>
      this.tone(f, 0.06, "square", 0.16, i * 0.04));
    this.noise(0.06, 0.15, 0.2);
    this.tone(2093, 0.2, "sawtooth", 0.1, 0.24);
  }
  playTugPull() {
    this.tone(82, 0.25, "sawtooth", 0.28);
    this.tone(65, 0.25, "triangle", 0.22, 0.12);
    this.noise(0.06, 0.08);
  }
  playPowerPull() {
    this.tone(55, 0.3, "sawtooth", 0.35);
    this.tone(110, 0.25, "triangle", 0.3, 0.05);
    this.tone(41, 0.3, "triangle", 0.28, 0.15);
    this.noise(0.15, 0.2);
    this.tone(440, 0.08, "square", 0.15, 0.05);
    this.tone(880, 0.08, "square", 0.12, 0.1);
  }
  playCountdownBeep(n: number) {
    const isLast = n === 1;
    this.tone(isLast ? 1319 : 880, 0.1, "square", 0.28);
    this.tone(isLast ? 1568 : 1047, 0.08, "square", 0.18, 0.04);
    this.tone(isLast ? 1976 : 1319, 0.06, "square", 0.12, 0.08);
    this.noise(0.04, 0.12);
    if (n <= 3) {
      this.tone(isLast ? 2093 : 1568, 0.05, "sawtooth", 0.1, 0.1);
    }
  }
  playGoSignal() {
    [523, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, "square", 0.25, i * 0.06));
    this.tone(1568, 0.3, "sawtooth", 0.18, 0.24);
    this.noise(0.1, 0.15, 0.24);
    [523, 784, 1047].forEach((f, i) => this.tone(f, 0.08, "triangle", 0.12, 0.35 + i * 0.04));
  }
  playTickTock(beat: number, urgency: "normal" | "urgent") {
    if (urgency === "urgent") {
      this.tone(1047, 0.04, "square", 0.15);
      this.tone(1568, 0.03, "square", 0.08, 0.03);
      this.noise(0.02, 0.06);
      if (beat % 2 === 0) this.tone(1976, 0.02, "sawtooth", 0.05, 0.05);
    } else if (beat % 2 === 0) {
      this.tone(740, 0.03, "square", 0.07);
    }
  }
  playApplause() {
    for (let i = 0; i < 20; i++) {
      this.noise(0.15, 0.03 + Math.random() * 0.04, i * 0.03);
      this.tone(200 + Math.random() * 2000, 0.08, "sawtooth", 0.02, i * 0.03);
    }
  }
  playWin() {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.tone(f, 0.18, "square", 0.2, i * 0.12));
    [523, 784, 1047].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.12, i * 0.12));
    setTimeout(() => this.playApplause(), 800);
    setTimeout(() => this.playApplause(), 1200);
  }
  playPowerReveal() {
    [440, 554, 659, 880, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.12, "sawtooth", 0.14, i * 0.05));
    this.noise(0.1, 0.1, 0.3);
  }
  destroy() { this.stopBackground(); try { this.ctx?.close(); } catch (_) {} this.ctx = null; }
}

function Confetti({ color }: { color: string }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 100 }, (_, i) => (
        <motion.div key={i}
          initial={{ y: -30, x: `${Math.random() * 100}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: "115vh", rotate: Math.random() * 900 - 450, opacity: [1, 1, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 3, delay: Math.random() * 1.5, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: 8 + Math.random() * 10, height: 8 + Math.random() * 10,
            borderRadius: Math.random() > 0.4 ? "50%" : "2px",
            backgroundColor: [color, "#fbbf24", "#f9fafb", "#a78bfa", "#34d399", "#f472b6"][i % 6],
          }}
        />
      ))}
    </div>
  );
}

function PowerPullFlash({ team }: { team: "blue" | "red" }) {
  return (
    <motion.div initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }}
      className="fixed inset-0 pointer-events-none z-40"
      style={{ backgroundColor: team === "blue" ? "rgba(59,130,246,0.28)" : "rgba(239,68,68,0.28)" }}
    />
  );
}

function ScorePopup({ value, correct }: { value: string; correct: boolean }) {
  return (
    <motion.div initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -60, scale: 1.4 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={`absolute left-1/2 -translate-x-1/2 top-0 font-black text-2xl pointer-events-none z-30 drop-shadow-lg ${correct ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"}`}
    >
      {value}
    </motion.div>
  );
}

function CountdownOverlay({ count }: { count: number | "GO!" }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div key={String(count)}
          initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`text-9xl font-black drop-shadow-2xl select-none ${count === "GO!" ? "text-amber-300" : "text-white"}`}
          style={{ textShadow: "0 0 40px rgba(0,0,0,0.8)" }}
        >
          {count}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CheerMessage({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 1.1 }} transition={{ duration: 0.35 }}
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-400/95 text-black font-black px-5 py-2 rounded-2xl shadow-2xl text-base pointer-events-none"
    >
      {msg}
    </motion.div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  return (
    <motion.div
      initial={{ scale: 0 }} animate={{ scale: [1, 1.15, 1] }}
      transition={{ repeat: Infinity, duration: 0.6 }}
      className="inline-flex items-center gap-1 bg-orange-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg"
    >
      <span>🔥</span>
      <span>{streak}x</span>
    </motion.div>
  );
}

function TeacherPanel({
  isOpen, onClose, players, ropePos, phase, pin, lang,
  onSkip, onEndGame, onPause, onResume, isPaused,
}: {
  isOpen: boolean; onClose: () => void; players: PlayerInfo[];
  ropePos: number; phase: Phase; pin: string; lang: string;
  onSkip: () => void; onEndGame: () => void;
  onPause: () => void; onResume: () => void; isPaused: boolean;
}) {
  const blueTeam = [...players.filter((p) => p.team === "blue")].sort((a, b) => b.score - a.score);
  const redTeam = [...players.filter((p) => p.team === "red")].sort((a, b) => b.score - a.score);
  const blueTotal = blueTeam.reduce((s, p) => s + p.score, 0);
  const redTotal = redTeam.reduce((s, p) => s + p.score, 0);
  const canSkip = phase === "question" || phase === "countdown" || phase === "answered";
  const canEnd = phase !== "finished" && phase !== "lobby";
  const canPause = (phase === "question" || phase === "countdown" || phase === "answered") && !isPaused;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900 rounded-t-3xl border-t border-black/10 dark:border-white/10 max-h-[78vh] overflow-y-auto"
          >
            <div className="p-4 pb-safe">
              <div className="w-10 h-1.5 bg-black/20 dark:bg-white/20 rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm text-gray-500 dark:text-white/70 uppercase tracking-wide">
                  🎛️ {lang === "ar" ? "لوحة تحكم المعلم" : "Teacher Panel"}
                </h3>
                <span className="text-xs font-mono text-gray-400 dark:text-white/30 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-lg">#{pin}</span>
              </div>

              <div className={`rounded-xl p-2.5 mb-3 text-center text-sm font-black border ${
                ropePos < 45 ? "bg-blue-500/20 border-blue-400/30 text-blue-600 dark:text-blue-300"
                : ropePos > 55 ? "bg-red-500/20 border-red-400/30 text-red-600 dark:text-red-300"
                : "bg-black/10 dark:bg-white/10 border-black/10 dark:border-white/10 text-gray-500 dark:text-white/50"
              }`}>
                {ropePos < 42
                  ? (lang === "ar" ? "⬅️ الأزرق يتقدم بقوة!" : "⬅️ Blue is dominating!")
                  : ropePos < 47
                  ? (lang === "ar" ? "⬅️ الأزرق يتقدم قليلاً" : "⬅️ Blue is ahead")
                  : ropePos > 58
                  ? (lang === "ar" ? "➡️ الأحمر يتقدم بقوة!" : "➡️ Red is dominating!")
                  : ropePos > 53
                  ? (lang === "ar" ? "➡️ الأحمر يتقدم قليلاً" : "➡️ Red is ahead")
                  : (lang === "ar" ? "⚖️ تعادل تام" : "⚖️ Perfectly tied")}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-blue-500/15 rounded-xl p-2.5 border border-blue-400/25">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-600 dark:text-blue-300 text-[10px] font-black uppercase">
                      {lang === "ar" ? "أزرق" : "Blue"}
                    </p>
                    <span className="text-amber-600 dark:text-amber-300 font-black text-xs">{blueTotal}</span>
                  </div>
                  {blueTeam.length === 0
                    ? <p className="text-blue-400/30 text-xs text-center">—</p>
                    : blueTeam.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-1 py-0.5 border-b border-black/5 dark:border-white/5 last:border-0">
                        <span className="text-[10px] w-4">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                        <AvatarDisplay avatar={p.avatar} size="sm" />
                        <span className="text-blue-700 dark:text-blue-100 text-[10px] font-bold flex-1 truncate">{p.name}</span>
                        {(p.streak ?? 0) >= 3 && <span className="text-[9px]">🔥{p.streak}</span>}
                        <span className="text-amber-600 dark:text-amber-300 text-[10px] font-black">{p.score}</span>
                      </div>
                    ))
                  }
                </div>
                <div className="bg-red-500/15 rounded-xl p-2.5 border border-red-400/25">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-red-600 dark:text-red-300 text-[10px] font-black uppercase">
                      {lang === "ar" ? "أحمر" : "Red"}
                    </p>
                    <span className="text-amber-600 dark:text-amber-300 font-black text-xs">{redTotal}</span>
                  </div>
                  {redTeam.length === 0
                    ? <p className="text-red-400/30 text-xs text-center">—</p>
                    : redTeam.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-1 py-0.5 border-b border-black/5 dark:border-white/5 last:border-0">
                        <span className="text-[10px] w-4">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                        <AvatarDisplay avatar={p.avatar} size="sm" />
                        <span className="text-red-700 dark:text-red-100 text-[10px] font-bold flex-1 truncate">{p.name}</span>
                        {(p.streak ?? 0) >= 3 && <span className="text-[9px]">🔥{p.streak}</span>}
                        <span className="text-amber-600 dark:text-amber-300 text-[10px] font-black">{p.score}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="space-y-2">
                {isPaused && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onResume(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-green-500/20 border border-green-400/40 text-green-700 dark:text-green-300 font-black text-sm hover:bg-green-500/30 transition-colors"
                  >
                    ▶️ {lang === "ar" ? "استئناف اللعبة" : "Resume Game"}
                  </motion.button>
                )}
                {canPause && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onPause(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-yellow-500/20 border border-yellow-400/40 text-yellow-700 dark:text-yellow-300 font-black text-sm hover:bg-yellow-500/30 transition-colors"
                  >
                    ⏸️ {lang === "ar" ? "إيقاف مؤقت" : "Pause Game"}
                  </motion.button>
                )}
                {canSkip && !isPaused && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onSkip(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 font-black text-sm hover:bg-amber-500/30 transition-colors"
                  >
                    ⏭ {lang === "ar" ? "تخطي هذا السؤال" : "Skip This Question"}
                  </motion.button>
                )}
                {canEnd && (
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { onEndGame(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-700 dark:text-red-300 font-black text-sm hover:bg-red-500/30 transition-colors"
                  >
                    ⏹ {lang === "ar" ? "إنهاء اللعبة الآن" : "End Game Now"}
                  </motion.button>
                )}
              </div>

              <button onClick={onClose}
                className="w-full mt-3 py-2 text-gray-400 dark:text-white/25 text-sm font-bold hover:text-gray-600 dark:hover:text-white/50 transition-colors"
              >
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function RopeBar({ position, lang = "ar" }: { position: number; lang?: string }) {
  const pos = Math.max(5, Math.min(95, position));
  const inDanger = pos < 20 || pos > 80;
  const dangerTeam: "blue" | "red" = pos < 20 ? "blue" : "red";

  return (
    <div className="relative w-full select-none" style={{ height: 56 }}>
      {inDanger && (
        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 0.6 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 24px ${dangerTeam === "blue" ? "rgba(59,130,246,0.7)" : "rgba(239,68,68,0.7)"}` }}
        />
      )}
      <div className="absolute left-0 right-0 rounded-xl overflow-hidden shadow-inner" style={{ top: 10, height: 32 }}>
        <div className="h-full flex">
          <motion.div animate={{ width: `${100 - pos}%` }} transition={{ type: "spring", stiffness: 80, damping: 12 }}
            className="h-full bg-gradient-to-r from-blue-700 to-blue-500"
          />
          <motion.div animate={{ width: `${pos}%` }} transition={{ type: "spring", stiffness: 80, damping: 12 }}
            className="h-full bg-gradient-to-l from-red-700 to-red-500"
          />
        </div>
      </div>
      <div className="absolute left-0 right-0 pointer-events-none overflow-hidden rounded-xl" style={{ top: 12, height: 28 }}>
        <svg width="100%" height="28" preserveAspectRatio="none">
          {Array.from({ length: 28 }).map((_, i) => (
            <g key={i}>
              <line x1={`${(i / 28) * 100}%`} y1="0" x2={`${(i / 28 + 0.045) * 100}%`} y2="28"
                stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
              <line x1={`${(i / 28 + 0.022) * 100}%`} y1="0" x2={`${(i / 28 - 0.022) * 100}%`} y2="28"
                stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            </g>
          ))}
          <rect x="0" y="0" width="100%" height="5" fill="rgba(255,255,255,0.12)" />
          <rect x="0" y="23" width="100%" height="5" fill="rgba(0,0,0,0.18)" />
        </svg>
      </div>
      <div className="absolute left-1 top-2 w-2.5 h-12 rounded-full bg-blue-400/60 border border-blue-300/40" />
      <div className="absolute right-1 top-2 w-2.5 h-12 rounded-full bg-red-400/60 border border-red-300/40" />
      <div className="absolute z-20 flex flex-col items-center" style={{ left: "calc(50% - 1px)", top: 2, bottom: 2 }}>
        <div className="w-0.5 flex-1 bg-white/60" />
        <div className="w-3 h-3 rounded-sm bg-amber-400 border border-amber-300 shadow-md -my-0.5" />
        <div className="w-0.5 flex-1 bg-white/60" />
      </div>
      <motion.div
        animate={{ left: `${pos}%` }} transition={{ type: "spring", stiffness: 90, damping: 12 }}
        className="absolute -translate-x-1/2 z-30" style={{ left: `${pos}%`, top: 0 }}
      >
        <motion.div
          animate={inDanger ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 0.5 }}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-4"
          style={{ background: "radial-gradient(circle at 35% 35%, #d97706, #92400e)", borderColor: "#78350f" }}
        >
          <span className="text-2xl leading-none">🪢</span>
        </motion.div>
      </motion.div>
      <div className="absolute left-4 bottom-0 text-blue-600 dark:text-blue-300 text-[9px] font-black opacity-70">◀ {lang === "ar" ? "أزرق" : "Blue"}</div>
      <div className="absolute right-4 bottom-0 text-red-600 dark:text-red-300 text-[9px] font-black opacity-70">{lang === "ar" ? "أحمر" : "Red"} ▶</div>
    </div>
  );
}

function TimerRing({ timeLeft, total, isUrgent }: { timeLeft: number; total: number; isUrgent: boolean }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, timeLeft / total);
  const dashOffset = circ * (1 - frac);
  const urgent = frac <= 0.25;
  const color = frac > 0.5 ? "#22c55e" : frac > 0.25 ? "#f59e0b" : "#ef4444";
  return (
    <motion.div animate={urgent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: urgent ? Infinity : 0, duration: 0.5 }}
      className="relative w-16 h-16 flex items-center justify-center"
    >
      <svg width="60" height="60" className="-rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={dashOffset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
        />
      </svg>
      <span className={`absolute text-xl font-black ${isUrgent ? "animate-pulse" : ""}`} style={{ color }}>{timeLeft}</span>
    </motion.div>
  );
}

export default function TugPlay() {
  const { pin } = useParams<{ pin: string }>();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const sp = new URLSearchParams(searchStr);
  const playerName = sp.get("name") || "";
  const playerAvatar = sp.get("avatar") || "🦁";
  const isCreator = sp.get("creator") === "1";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [myTeam, setMyTeam] = useState<"blue" | "red" | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [ropePos, setRopePos] = useState(50);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [answerCorrectIndex, setAnswerCorrectIndex] = useState<number | null>(null);
  const [showBoost, setShowBoost] = useState(false);
  const [roundData, setRoundData] = useState<RoundEndData | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEndData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | "GO!" | null>(null);
  const [cheerMsg, setCheerMsg] = useState<string | null>(null);
  const [scorePopup, setScorePopup] = useState<{ value: string; correct: boolean } | null>(null);
  const [powerPullTeam, setPowerPullTeam] = useState<"blue" | "red" | null>(null);
  const [myStreak, setMyStreak] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTeacherPanel, setShowTeacherPanel] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPowerQ, setIsPowerQ] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [musicStyle, setMusicStyleState] = useState<MusicStyle>(() => {
    try {
      const s = localStorage.getItem("tug-music-style");
      if (s && ["energetic", "electronic", "epic", "chill", "challenge"].includes(s)) return s as MusicStyle;
    } catch (_) {}
    return "challenge";
  });
  const [isMuted, setIsMutedState] = useState(() => {
    try { return localStorage.getItem("tug-music-muted") === "1"; } catch (_) { return false; }
  });
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatRef = useRef(0);
  const soundRef = useRef<TugSoundEngine | null>(null);

  const getSound = useCallback((): TugSoundEngine => {
    if (!soundRef.current) {
      soundRef.current = new TugSoundEngine();
      setMusicStyleState(soundRef.current.musicStyle);
      setIsMutedState(soundRef.current.muted);
    }
    return soundRef.current;
  }, []);

  const handleMusicStyleChange = useCallback((style: MusicStyle) => {
    const s = getSound();
    s.setMusicStyle(style);
    setMusicStyleState(style);
    if (s.muted) { s.setMuted(false); setIsMutedState(false); }
  }, [getSound]);

  const handleToggleMute = useCallback(() => {
    const s = getSound();
    const next = !s.muted;
    s.setMuted(next);
    setIsMutedState(next);
  }, [getSound]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((duration: number) => {
    stopTimer();
    setTimeLeft(duration);
    setIsUrgent(false);
    beatRef.current = 0;
    getSound().setUrgency(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { stopTimer(); return 0; }
        beatRef.current += 1;
        const remaining = t - 1;
        const urgent = remaining <= 5;
        getSound().setUrgency(urgent);
        setIsUrgent(urgent);
        getSound().playTickTock(beatRef.current, urgent ? "urgent" : "normal");
        return remaining;
      });
    }, 1000);
  }, [stopTimer, getSound]);


  const stopAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
    setAutoAdvanceCountdown(null);
  }, []);

  const startAutoAdvance = useCallback((seconds: number) => {
    stopAutoAdvance();
    setAutoAdvanceCountdown(seconds);
    autoAdvanceRef.current = setInterval(() => {
      setAutoAdvanceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopAutoAdvance]);

  useEffect(() => {
    const socket = getTugSocket();

    const initSession = () => {
      if (isCreator) {
        const creatorToken = sessionStorage.getItem(`tug-creator-${pin}`);
        if (!creatorToken) { setPhase("lobby"); setMyTeam("blue"); return; }
        socket.emit("tug:reclaim-host", { pin, creatorToken },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res: any) => {
            if (res.error) { setError(res.error); return; }
            setPlayers(res.players ?? []);
            if (res.ropePosition !== undefined) setRopePos(res.ropePosition);
            setMyTeam("blue");
            const state = (res.state ?? "lobby") as Phase;
            setPhase(state);
            if (state === "question" && res.activeQuestion) {
              const aq = res.activeQuestion;
              setQuestion(aq);
              setIsPowerQ(!!aq.isPower);
              startTimer(aq.remainingSecs ?? aq.duration);
              getSound().startBackground();
            } else if (state === "round-end" && res.roundSummary) {
              setRoundData({ ...res.roundSummary, players: res.players ?? [] });
              if (res.activeQuestion) {
                setQuestion(res.activeQuestion);
                setIsPowerQ(!!res.activeQuestion.isPower);
              }
            } else if (state === "paused") {
              setIsPaused(true);
              if (res.activeQuestion) {
                setQuestion(res.activeQuestion);
                setIsPowerQ(!!res.activeQuestion.isPower);
              }
            }
          }
        );
      } else {
        socket.emit("tug:rejoin", { pin, name: playerName, avatar: playerAvatar },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rj: any) => {
            if (rj.success && rj.rejoined) {
              setMyTeam(rj.team ?? null);
              setPlayers(rj.players ?? []);
              if (rj.ropePosition !== undefined) setRopePos(rj.ropePosition);
              const state = (rj.state ?? "lobby") as Phase;
              setPhase(state);
              if (state === "question" && rj.activeQuestion) {
                const aq = rj.activeQuestion;
                setQuestion(aq);
                setIsPowerQ(!!aq.isPower);
                if (rj.hasAnswered) { setSelectedAnswer(-1); setPhase("answered"); }
                else startTimer(aq.remainingSecs ?? aq.duration);
                getSound().startBackground();
              } else if (state === "round-end" && rj.roundSummary) {
                setRoundData({ ...rj.roundSummary, players: rj.players ?? [] });
                if (rj.activeQuestion) {
                  setQuestion(rj.activeQuestion);
                  setIsPowerQ(!!rj.activeQuestion.isPower);
                }
              } else if (state === "paused") {
                setIsPaused(true);
                if (rj.activeQuestion) {
                  setQuestion(rj.activeQuestion);
                  setIsPowerQ(!!rj.activeQuestion.isPower);
                }
              }
              return;
            }
            socket.emit("tug:join", { pin, name: playerName, avatar: playerAvatar },
              (res: { success?: boolean; team?: "blue" | "red"; players?: PlayerInfo[]; error?: string }) => {
                if (res.error) { setError(res.error); return; }
                setMyTeam(res.team ?? null);
                setPlayers(res.players ?? []);
                setPhase("lobby");
              }
            );
          }
        );
      }
    };

    if (socket.connected) initSession();
    socket.on("connect", initSession);
    socket.on("tug:players-updated", (data: { players: PlayerInfo[] }) => setPlayers(data.players));

    socket.on("tug:countdown", (data: { isPower?: boolean; brief?: boolean }) => {
      setSelectedAnswer(null); setAnswerCorrect(null); setAnswerCorrectIndex(null);
      setShowBoost(false); setRoundData(null); setScorePopup(null); setCheerMsg(null);
      setIsPowerQ(!!data.isPower);
      setIsPaused(false);
      if (data.brief) {
        setPhase("countdown");
        setCountdownNum("GO!"); getSound().playGoSignal();
        setTimeout(() => { setCountdownNum(null); }, 600);
      } else {
        setPhase("countdown");
        setCountdownNum(3); getSound().playCountdownBeep(3);
        setTimeout(() => { setCountdownNum(2); getSound().playCountdownBeep(2); }, 1000);
        setTimeout(() => { setCountdownNum(1); getSound().playCountdownBeep(1); }, 2000);
        setTimeout(() => {
          setCountdownNum("GO!");
          if (data.isPower) getSound().playPowerReveal();
          else getSound().playGoSignal();
        }, 3000);
        setTimeout(() => { setCountdownNum(null); }, 3600);
      }
    });

    socket.on("tug:question", (data: QuestionData) => {
      setQuestion(data);
      setIsPowerQ(!!data.isPower);
      setIsPaused(false);
      setPhase("question");
      startTimer(data.duration);
      getSound().startBackground();
      getSound().playTugPull();
    });

    socket.on("tug:rope-update", (data: { ropePosition: number }) => {
      setRopePos((prev) => {
        const diff = Math.abs(data.ropePosition - prev);
        if (diff >= 5) {
          const movingTeam = data.ropePosition < prev ? "blue" : "red";
          setPowerPullTeam(movingTeam);
          setTimeout(() => setPowerPullTeam(null), 500);
          getSound().playPowerPull();
        }
        return data.ropePosition;
      });
    });

    socket.on("tug:round-end", (data: RoundEndData) => {
      stopTimer();
      setRopePos(data.ropePosition);
      setPlayers(data.players);
      setIsUrgent(false);
      setIsPowerQ(!!data.isPower);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setScorePopup(null);

      if (data.isLast) {
        setRoundData(data);
        setPhase("round-end");
      }
    });

    socket.on("tug:game-end", (data: GameEndData) => {
      stopTimer();
      setGameEnd(data);
      setRopePos(data.ropePosition);
      setPlayers(data.players);
      setPhase("finished");
      setIsUrgent(false);
      setIsPaused(false);
      getSound().stopBackground();
      getSound().playWin();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on("tug:paused", (_data: any) => {
      setIsPaused(true);
      setPhase("paused");
      stopTimer();
      getSound().stopBackground();
    });

    socket.on("tug:resumed", (data: { timeRemaining: number }) => {
      setIsPaused(false);
      setPhase("question");
      startTimer(data.timeRemaining);
      getSound().startBackground();
    });

    socket.on("tug:auto-advance-started", (adv: { autoAdvanceIn: number }) => {
      if (adv.autoAdvanceIn > 0) startAutoAdvance(adv.autoAdvanceIn);
    });

    socket.on("tug:auto-advance-cancelled", () => {
      stopAutoAdvance();
    });

    socket.on("tug:replayed", (data: { players: PlayerInfo[]; ropePosition: number }) => {
      setPlayers(data.players);
      setRopePos(data.ropePosition);
      setPhase("lobby");
      setGameEnd(null);
      setRoundData(null);
      setQuestion(null);
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setShowBoost(false);
      setScorePopup(null);
      setCheerMsg(null);
      setMyStreak(0);
      setIsUrgent(false);
      setIsPowerQ(false);
      setIsPaused(false);
      getSound().stopBackground();
    });

    return () => {
      socket.off("connect", initSession);
      socket.off("tug:players-updated");
      socket.off("tug:countdown");
      socket.off("tug:question");
      socket.off("tug:rope-update");
      socket.off("tug:round-end");
      socket.off("tug:game-end");
      socket.off("tug:paused");
      socket.off("tug:resumed");
      socket.off("tug:auto-advance-started");
      socket.off("tug:auto-advance-cancelled");
      socket.off("tug:replayed");
      stopTimer();
      stopAutoAdvance();
    };
  }, [pin, playerName, playerAvatar, isCreator, startTimer, stopTimer, getSound, startAutoAdvance, stopAutoAdvance, lang]);

  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  const handleStart = () => {
    if (startingGame) return;
    setStartingGame(true);
    getTugSocket().emit("tug:start", { pin }, (res: { success?: boolean; error?: string }) => {
      setStartingGame(false);
      if (res.error) setError(res.error);
    });
  };

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || phase !== "question") return;
    setSelectedAnswer(idx);
    getTugSocket().emit("tug:answer", { pin, answerIndex: idx },
      (res: { correct?: boolean; isBoost?: boolean; isPower?: boolean; streak?: number; correctIndex?: number; error?: string }) => {
        if (res.error) return;
        const correct = !!res.correct;
        setAnswerCorrect(correct);
        if (res.correctIndex !== undefined) setAnswerCorrectIndex(res.correctIndex);
        setPhase("answered");

        if (correct) {
          if (res.isBoost) { setShowBoost(true); setTimeout(() => setShowBoost(false), 1500); }
          const newStreak = res.streak ?? (myStreak + 1);
          setMyStreak(newStreak);
        } else {
          setMyStreak(0);
        }
      }
    );
  };

  const handleNext = () => {
    stopAutoAdvance();
    getTugSocket().emit("tug:next", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleToggleAutoAdvance = (enabled: boolean) => {
    getTugSocket().emit("tug:toggle-auto-advance", { pin, enabled }, (res: { success?: boolean; autoAdvance?: boolean; error?: string }) => {
      if (res.error) { setError(res.error); return; }
      setRoundData((prev) => prev ? { ...prev, autoAdvance: enabled } : prev);
      if (!enabled) stopAutoAdvance();
    });
  };

  const handleSkip = () => {
    getTugSocket().emit("tug:skip", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleEndGame = () => {
    getTugSocket().emit("tug:end-early", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handlePause = () => {
    getTugSocket().emit("tug:pause", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleResume = () => {
    getTugSocket().emit("tug:resume", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleReplay = () => {
    getTugSocket().emit("tug:replay", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleAddBots = (count: number) => {
    getTugSocket().emit("tug:add-bots", { pin, count }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const handleRemoveBots = () => {
    getTugSocket().emit("tug:remove-bots", { pin }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const blueTeam = players.filter((p) => p.team === "blue");
  const redTeam = players.filter((p) => p.team === "red");
  const isPulling = phase === "question" || phase === "answered";
  const KAHOOT_SHAPES = ["▲", "◆", "●", "■"];
  // Same gradients as وميض game (play.tsx OPTION_COLORS)
  const WAMID_GRADIENT = [
    "linear-gradient(160deg, #7A0A0A, #B01414)",  // A — أحمر
    "linear-gradient(160deg, #08386E, #1260A8)",  // B — أزرق
    "linear-gradient(160deg, #B8860B, #DAA520)",  // C — ذهبي
    "linear-gradient(160deg, #5A1A8A, #8B35C8)",  // D — بنفسجي
  ];
  const WAMID_BORDER = ["#7A0A0A", "#08386E", "#B8860B", "#5A1A8A"];

  const optionStyle = (idx: number): { className: string; bg: string; border: string; crossed?: boolean } => {
    const baseGrad   = WAMID_GRADIENT[idx] || WAMID_GRADIENT[0];
    const baseBorder = WAMID_BORDER[idx]   || WAMID_BORDER[0];
    const knownCorrect = roundData?.correctIndex ?? answerCorrectIndex;
    if ((phase === "round-end" || phase === "answered") && idx === knownCorrect)
      return { className: "text-white ring-2", bg: "#1a5c30", border: "#D9A521" };
    if (phase === "answered") {
      if (idx === selectedAnswer && !answerCorrect) return { className: "text-white/60", bg: "#5c1212", border: "#7A0A0A", crossed: true };
      if (idx === selectedAnswer) return { className: "text-white", bg: "#1a5c30", border: "#D9A521" };
    }
    if (isPowerQ) return { className: "text-white", bg: baseGrad, border: "#D9A521" };
    return { className: "text-white", bg: baseGrad, border: baseBorder };
  };

  const teamLabel = (t: "blue" | "red") =>
    t === "blue" ? (lang === "ar" ? "الفريق الأزرق" : "Blue Team") : (lang === "ar" ? "الفريق الأحمر" : "Red Team");

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/game/tug/join/${pin}` : "";

  if (error) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-6xl">😕</div>
          <h2 className="text-2xl font-black">{lang === "ar" ? "حدث خطأ" : "An error occurred"}</h2>
          <p className="text-muted-foreground text-center max-w-sm">{error}</p>
          <button onClick={() => setLocation("/game/tug/join")}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold">
            {lang === "ar" ? "ارجع وحاول مجدداً" : "Go back and try again"}
          </button>
        </div>
      </Layout>
    );
  }

  if (phase === "connecting") {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-12 h-12 rounded-full border-4 border-t-transparent"
            style={{ borderColor: "#225739", borderTopColor: "transparent" }} />
          <p className="font-bold" style={{ color: "#225739" }}>{lang === "ar" ? "جاري الاتصال..." : "Connecting..."}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex flex-col select-none text-gray-900 dark:text-white"
        style={{ direction: dir, background: "linear-gradient(135deg, #0f2318 0%, #1a3a28 50%, #0f2318 100%)" }}
      >
        {phase === "finished" && gameEnd && gameEnd.winner !== "draw" && <Confetti color={gameEnd.winner === "blue" ? "#3b82f6" : "#ef4444"} />}
        {countdownNum !== null && <CountdownOverlay count={countdownNum} />}
        <AnimatePresence>
          {showBoost && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-400 text-black font-black px-5 py-2 rounded-xl shadow-xl text-base"
            >
              ⚡ {lang === "ar" ? "إجابة سريعة! +بوست" : "Speed Boost! ⚡"}
            </motion.div>
          )}
        </AnimatePresence>

        {isPowerQ && (phase === "question" || phase === "answered" || phase === "countdown") && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: [0.15, 0.3, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ background: "radial-gradient(circle at center, rgba(251,191,36,0.35) 0%, transparent 70%)" }}
          />
        )}

        {isPaused && (
          <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center pointer-events-auto">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
              <div className="text-7xl mb-4">⏸️</div>
              <h2 className="text-3xl font-black text-white mb-2">{lang === "ar" ? "اللعبة متوقفة" : "Game Paused"}</h2>
              <p className="text-slate-300 dark:text-white/50 text-sm mb-4">{lang === "ar" ? "المعلم أوقف اللعبة مؤقتاً" : "Teacher paused the game"}</p>
              {isCreator && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleResume}
                  className="px-8 py-3 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-black text-lg shadow-xl"
                >
                  ▶️ {lang === "ar" ? "استئناف" : "Resume"}
                </motion.button>
              )}
            </motion.div>
          </div>
        )}

        {isCreator && (
          <TeacherPanel
            isOpen={showTeacherPanel} onClose={() => setShowTeacherPanel(false)}
            players={players} ropePos={ropePos} phase={phase} pin={pin ?? ""} lang={lang}
            onSkip={handleSkip} onEndGame={handleEndGame}
            onPause={handlePause} onResume={handleResume} isPaused={isPaused}
          />
        )}

        <div
          className="fixed top-2 left-2 z-40 flex items-center gap-2"
          style={{ direction: "ltr" }}
        >
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleToggleMute}
            aria-label={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
            title={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 shadow-xl transition-all ${
              isMuted
                ? "bg-red-500 hover:bg-red-400 border-red-200 text-white"
                : "bg-amber-400 hover:bg-amber-300 border-amber-100 text-black"
            }`}
          >
            {isMuted ? "🔇" : "🔊"}
          </motion.button>
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowMusicPicker(!showMusicPicker)}
              aria-label={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
              title={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border-2 shadow-xl transition-all ${
                isMuted
                  ? "bg-slate-300 hover:bg-slate-200 border-slate-100 text-slate-500"
                  : "bg-white hover:bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              🎵
            </motion.button>
            <AnimatePresence>
              {showMusicPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMusicPicker(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -5 }}
                    className="absolute top-14 left-0 z-50 w-56 bg-slate-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden"
                    style={{ direction: dir }}
                  >
                    <div className="p-1.5 space-y-0.5">
                      {MUSIC_STYLES.map((s) => (
                        <button key={s.id}
                          onClick={() => { handleMusicStyleChange(s.id); setShowMusicPicker(false); }}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${
                            musicStyle === s.id && !isMuted
                              ? "bg-amber-500/30 border border-amber-400/50 text-white"
                              : "hover:bg-slate-700/50 text-white/80"
                          }`}
                        >
                          <span className="text-base">{s.icon}</span>
                          <div className="text-start">
                            <div className="font-black">{lang === "ar" ? s.ar : s.en}</div>
                            <div className="text-[9px] opacity-60">{lang === "ar" ? s.descAr : s.descEn}</div>
                          </div>
                          {musicStyle === s.id && !isMuted && <span className="ms-auto text-amber-300">✓</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 dark:border-white/10 bg-black/20 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <div className="text-xs font-black opacity-50 uppercase tracking-wide">
              {lang === "ar" ? "شد الحبل" : "Tug of War"}
            </div>
            <div className="text-sm font-mono font-black bg-slate-700/80 dark:bg-white/10 px-2.5 py-0.5 rounded-lg">#{pin}</div>
            <QRModalButton url={joinUrl} pin={pin ?? ""} variant="dark" label="" />
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => { navigator.clipboard.writeText(joinUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${linkCopied ? "bg-green-500 text-white" : "bg-slate-700/80 dark:bg-white/15 text-slate-200 dark:text-white/70 hover:bg-slate-600/80 dark:hover:bg-white/25"}`}
            >
              {linkCopied ? "✓" : "📋"} {linkCopied ? (lang === "ar" ? "تم!" : "Done!") : (lang === "ar" ? "نسخ" : "Copy")}
            </motion.button>
          </div>
          <div className="flex items-center gap-2">
            {myTeam && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className={`flex items-center gap-1.5 font-black px-3 py-1 rounded-xl text-sm shadow-lg border ${
                  myTeam === "blue"
                    ? "bg-blue-500/50 text-blue-800 dark:text-blue-100 border-blue-400/50"
                    : "bg-red-500/50 text-red-800 dark:text-red-100 border-red-400/50"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${myTeam === "blue" ? "bg-blue-300" : "bg-red-300"}`} />
                {teamLabel(myTeam)}
                {myStreak >= 3 && <StreakBadge streak={myStreak} />}
              </motion.div>
            )}
            {isCreator && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setShowTeacherPanel(true)}
                className="w-9 h-9 rounded-xl bg-amber-500/30 border-2 border-amber-400/40 text-amber-600 dark:text-amber-300 flex items-center justify-center text-lg"
              >
                🎛️
              </motion.button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">

          <div className="px-2 pt-1 pb-0 shrink-0">
            <div className="mx-auto">
              <CartoonTugScene
                ropePos={ropePos}
                isPulling={isPulling}
                isUrgent={isUrgent}
                isCelebrating={phase === "finished"}
                winnerSide={gameEnd?.winner === "draw" ? null : gameEnd?.winner ?? null}
              />
              <div className="mt-1">
                <RopeBar position={ropePos} lang={lang} />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <AnimatePresence mode="wait">

              {phase === "lobby" && (
                <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">

                  {isCreator && (
                    <div className="bg-purple-500/10 rounded-2xl p-3 mb-4 border border-purple-400/30">
                      <div className="flex items-center justify-between">
                        <h3 className="text-purple-600 dark:text-purple-300 font-black text-sm flex items-center gap-2">
                          🤖 {lang === "ar" ? "لاعبون وهميون" : "Bot Players"}
                        </h3>
                        <div className="flex items-center gap-2">
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAddBots(2)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/30 border border-purple-400/40 text-purple-600 dark:text-purple-300 text-xs font-black hover:bg-purple-500/40 transition-colors"
                          >
                            {lang === "ar" ? "+2 روبوت" : "+2 Bots"}
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAddBots(4)}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/30 border border-purple-400/40 text-purple-600 dark:text-purple-300 text-xs font-black hover:bg-purple-500/40 transition-colors"
                          >
                            {lang === "ar" ? "+4 روبوت" : "+4 Bots"}
                          </motion.button>
                          {players.some(p => p.name.startsWith("روبوت")) && (
                            <motion.button whileTap={{ scale: 0.95 }} onClick={handleRemoveBots}
                              className="px-3 py-1.5 rounded-xl bg-red-500/30 border border-red-400/40 text-red-600 dark:text-red-300 text-xs font-black hover:bg-red-500/40 transition-colors"
                            >
                              {lang === "ar" ? "حذف الكل" : "Remove"}
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-500/15 rounded-2xl p-4 border-2 border-blue-400/30">
                      <h3 className="text-blue-600 dark:text-blue-300 font-black text-sm lg:text-base mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-400 inline-block shadow-lg shadow-blue-400/50" />
                        {teamLabel("blue")}
                        <span className="text-blue-400/50 font-normal text-xs">({blueTeam.length})</span>
                      </h3>
                      <div className="space-y-1.5">
                        {blueTeam.length === 0
                          ? <p className="text-blue-400/40 text-sm">{lang === "ar" ? "انتظار لاعبين..." : "Waiting..."}</p>
                          : blueTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-blue-500/10 border border-blue-400/20">
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-blue-700 dark:text-blue-100 font-bold text-sm lg:text-base truncate">{p.name}</span>
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                    <div className="bg-red-500/15 rounded-2xl p-4 border-2 border-red-400/30">
                      <h3 className="text-red-600 dark:text-red-300 font-black text-sm lg:text-base mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-400 inline-block shadow-lg shadow-red-400/50" />
                        {teamLabel("red")}
                        <span className="text-red-400/50 font-normal text-xs">({redTeam.length})</span>
                      </h3>
                      <div className="space-y-1.5">
                        {redTeam.length === 0
                          ? <p className="text-red-400/40 text-sm">{lang === "ar" ? "انتظار لاعبين..." : "Waiting..."}</p>
                          : redTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 border border-red-400/20">
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-red-700 dark:text-red-100 font-bold text-sm lg:text-base truncate">{p.name}</span>
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/70 dark:bg-white/10 rounded-2xl p-4 mb-4 border border-slate-600/50 dark:border-white/10 text-center">
                    <p className="text-slate-400 dark:text-white/40 text-xs mb-1">{lang === "ar" ? "شارك الرمز من الشريط العلوي ☝️" : "Share PIN from header bar ☝️"}</p>
                    <p className="text-4xl font-black tracking-[0.3em] text-amber-600 dark:text-amber-300">{pin}</p>
                  </div>

                  {isCreator ? (
                    <motion.button whileTap={{ scale: 0.96 }} onClick={handleStart}
                      disabled={startingGame || players.length < 1}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xl disabled:opacity-40 transition-all shadow-xl"
                    >
                      {startingGame ? "..." : (lang === "ar" ? "🪢 ابدأ اللعبة!" : "🪢 Start!")}
                    </motion.button>
                  ) : (
                    <div className="text-center py-4">
                      <motion.div animate={{ scale: [1, 1.12, 1], rotate: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 1.4 }}
                        className="text-5xl mb-2 inline-block">🪢</motion.div>
                      <p className="text-slate-300 dark:text-white/50 text-sm">{lang === "ar" ? "انتظر المنشئ ليبدأ..." : "Waiting for host..."}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {phase === "countdown" && (
                <motion.div key="countdown" className="px-4 py-6 text-center">
                  {isPowerQ && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black px-5 py-2 rounded-2xl shadow-xl text-lg mb-3"
                    >
                      ⚡ {lang === "ar" ? "سؤال القوة! نقاط مضاعفة!" : "POWER QUESTION! 2x Points!"}
                    </motion.div>
                  )}
                  <p className="text-slate-400 dark:text-white/30 text-lg font-black">{lang === "ar" ? "استعد للمنافسة..." : "Get ready..."}</p>
                </motion.div>
              )}

              {(phase === "question" || phase === "answered" || phase === "round-end") && question && (
                <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 lg:px-4 pt-2 pb-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm lg:text-base font-black px-3 py-1 rounded-xl text-white"
                        style={{
                          background: isPowerQ ? "rgba(217,165,33,0.3)" : "rgba(255,255,255,0.12)",
                          border: `1px solid ${isPowerQ ? "#D9A521" : "rgba(255,255,255,0.2)"}`,
                        }}>
                        {isPowerQ && "⚡ "}
                        {lang === "ar" ? `${question.index + 1} / ${question.total}` : `Q${question.index + 1}/${question.total}`}
                        {isPowerQ && " ×2"}
                      </span>
                      {isCreator && (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowTeacherPanel(true)}
                          className="text-amber-600/60 hover:text-amber-600 dark:text-amber-300/60 dark:hover:text-amber-300 text-lg transition-colors">
                          🎛️
                        </motion.button>
                      )}
                    </div>
                    {phase !== "round-end" && <TimerRing timeLeft={timeLeft} total={question.duration} isUrgent={isUrgent} />}
                    {phase === "round-end" && roundData && (
                      <div className="flex items-center gap-3 text-sm lg:text-base font-black">
                        <span className="text-blue-600 dark:text-blue-300 bg-blue-500/20 px-3 py-1 rounded-lg">{roundData.blueScore.toFixed(0)}</span>
                        <span className="text-slate-400 dark:text-white/30">vs</span>
                        <span className="text-red-600 dark:text-red-300 bg-red-500/20 px-3 py-1 rounded-lg">{roundData.redScore.toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  <div className={`rounded-2xl p-4 lg:p-5 mb-3 text-center border-2 text-white ${
                    phase === "round-end" && roundData
                      ? "border-[#D9A521]/60"
                      : isPowerQ
                        ? "border-[#D9A521]/70"
                        : "border-white/20"
                  }`} style={{
                    background: phase === "round-end" && roundData
                      ? "rgba(34,87,57,0.55)"
                      : isPowerQ
                        ? "rgba(180,120,10,0.25)"
                        : "rgba(255,255,255,0.08)",
                  }}>
                    {isPowerQ && phase !== "round-end" && (
                      <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1 }}
                        className="text-amber-600 dark:text-amber-300 text-xs lg:text-sm font-black mb-2 flex items-center justify-center gap-1"
                      >
                        ⚡ {lang === "ar" ? "سؤال القوة — نقاط مضاعفة!" : "POWER — 2x!"}
                      </motion.div>
                    )}
                    <p className="text-xl sm:text-2xl lg:text-3xl font-black leading-relaxed">{question.text}</p>
                    {phase === "round-end" && roundData && (
                      <p className="text-green-600 dark:text-green-300 text-sm lg:text-base font-bold mt-2">
                        ✅ {question.options[roundData.correctIndex]}
                      </p>
                    )}
                  </div>

                  <div className="relative grid grid-cols-2 gap-3 lg:gap-4 flex-1">
                    {question.options.map((opt, idx) => {
                      const os = optionStyle(idx);
                      return (
                        <button key={idx}
                          onClick={() => handleAnswer(idx)} disabled={selectedAnswer !== null || phase === "round-end"}
                          className={`relative flex items-center justify-center gap-3 p-4 lg:p-5 rounded-2xl text-center font-bold text-base sm:text-lg lg:text-xl border-2 overflow-hidden min-h-[70px] lg:min-h-[90px] shadow-lg touch-manipulation select-none transition-colors duration-150 ${os.className}`}
                          style={{ background: os.bg, borderColor: os.border }}
                        >
                          {os.crossed && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                              <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(239,68,68,0.7)" strokeWidth="3" />
                              <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(239,68,68,0.7)" strokeWidth="3" />
                            </svg>
                          )}
                          <span className="leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {phase === "answered" && (
                    <div className="text-center py-2 px-4 rounded-xl mt-3 font-bold text-base text-white"
                      style={{
                        background: answerCorrect ? "rgba(34,87,57,0.55)" : "rgba(122,28,28,0.55)",
                        border: `1.5px solid ${answerCorrect ? "#D9A521" : "#e05555"}`,
                      }}>
                      {answerCorrect
                        ? (lang === "ar" ? "✅ إجابة صحيحة" : "✅ Correct")
                        : (lang === "ar" ? "❌ إجابة خاطئة" : "❌ Wrong")}
                    </div>
                  )}

                  {phase === "round-end" && isCreator && (
                    <motion.button whileTap={{ scale: 0.96 }} onClick={handleNext}
                      className="w-full mt-3 py-3 lg:py-4 rounded-2xl font-black text-lg lg:text-xl shadow-xl text-white"
                      style={{ background: "#D9A521", color: "#1a2e1a" }}
                    >
                      {roundData?.isLast
                        ? (lang === "ar" ? "🏆 النتيجة النهائية!" : "🏆 Final Result!")
                        : (lang === "ar" ? "▶ التالي الآن" : "▶ Next Now")}
                    </motion.button>
                  )}
                </motion.div>
              )}

              {phase === "finished" && gameEnd && (
                <motion.div key="finished" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="px-4 py-6 text-center">
                  {gameEnd.winner === "draw" ? (
                    <>
                      <div className="text-7xl mb-2">🤝</div>
                      <h2 className="text-3xl lg:text-4xl font-black mb-1">{lang === "ar" ? "تعادل رائع!" : "Great Draw!"}</h2>
                      <p className="text-slate-400 dark:text-white/40 text-sm mb-4">{lang === "ar" ? "الفريقان متكافئان!" : "Both teams are equal!"}</p>
                    </>
                  ) : (
                    <>
                      <motion.div animate={{ scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
                        className="text-8xl mb-2 inline-block">🏆</motion.div>
                      <h2 className={`text-3xl lg:text-4xl font-black mb-1 ${gameEnd.winner === "blue" ? "text-blue-600 dark:text-blue-300" : "text-red-600 dark:text-red-300"}`}>
                        {teamLabel(gameEnd.winner)} {lang === "ar" ? "يفوز!" : "Wins!"}
                      </h2>
                      {myTeam === gameEnd.winner && (
                        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                          className="text-amber-600 dark:text-amber-300 font-black text-lg lg:text-xl mb-2">
                          🎉 {lang === "ar" ? "أنت في الفريق الفائز!" : "You're on the winning team!"}
                        </motion.div>
                      )}
                    </>
                  )}

                  <div className="rounded-2xl p-4 lg:p-5 mb-5 text-start max-h-72 overflow-y-auto text-white"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(217,165,33,0.3)" }}>
                    <h3 className="text-sm lg:text-base font-black text-slate-400 dark:text-white/50 mb-3">{lang === "ar" ? "🏅 الترتيب النهائي" : "🏅 Final Rankings"}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-blue-500/15 rounded-xl p-3 border border-blue-400/20 text-center">
                        <p className="text-blue-600 dark:text-blue-300 text-xs lg:text-sm font-black mb-1">{teamLabel("blue")}</p>
                        <p className="text-2xl lg:text-3xl font-black text-blue-700 dark:text-blue-200">
                          {[...gameEnd.players].filter(p => p.team === "blue").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                      <div className="bg-red-500/15 rounded-xl p-3 border border-red-400/20 text-center">
                        <p className="text-red-600 dark:text-red-300 text-xs lg:text-sm font-black mb-1">{teamLabel("red")}</p>
                        <p className="text-2xl lg:text-3xl font-black text-red-700 dark:text-red-200">
                          {[...gameEnd.players].filter(p => p.team === "red").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                    </div>
                    {[...gameEnd.players].sort((a, b) => b.score - a.score).map((p, i) => (
                      <motion.div key={p.name}
                        initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5 py-2.5 px-3 border-b border-slate-600/30 dark:border-white/10 last:border-0 rounded-lg hover:bg-slate-700/20 dark:hover:bg-white/5"
                      >
                        <span className={`w-7 text-center font-black text-base lg:text-lg ${i === 0 ? "text-amber-500 dark:text-amber-300" : i === 1 ? "text-slate-500 dark:text-slate-300" : i === 2 ? "text-orange-500 dark:text-orange-400" : "text-slate-500 dark:text-white/30"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                        <AvatarDisplay avatar={p.avatar} size="3xl" />
                        <span className={`flex-1 font-bold text-sm lg:text-base ${p.team === "blue" ? "text-blue-700 dark:text-blue-200" : "text-red-700 dark:text-red-200"}`}>{p.name}</span>
                        <span className={`text-xs lg:text-sm font-bold px-2 py-1 rounded-lg ${p.team === "blue" ? "bg-blue-500/25 text-blue-600 dark:text-blue-300" : "bg-red-500/25 text-red-600 dark:text-red-300"}`}>
                          {p.team === "blue" ? (lang === "ar" ? "أزرق" : "Blue") : (lang === "ar" ? "أحمر" : "Red")}
                        </span>
                        <span className="font-black text-amber-600 dark:text-amber-300 text-base lg:text-lg">{p.score}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setLocation("/")}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-colors"
                      style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {lang === "ar" ? "الرئيسية" : "Home"}
                    </button>
                    {isCreator ? (
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={handleReplay}
                        className="flex-1 py-3 rounded-xl font-black text-sm shadow-lg"
                        style={{ background: "#D9A521", color: "#1a2e1a" }}
                      >
                        {lang === "ar" ? "🔄 أعد اللعبة" : "🔄 Replay"}
                      </motion.button>
                    ) : (
                      <motion.button whileTap={{ scale: 0.96 }}
                        onClick={() => setLocation(`/game/tug/join/${pin}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(playerAvatar)}`)}
                        className="flex-1 py-3 rounded-xl font-black text-sm shadow-lg"
                        style={{ background: "#D9A521", color: "#1a2e1a" }}
                      >
                        {lang === "ar" ? "🔄 العب مجدداً" : "🔄 Play Again"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {(phase === "question" || phase === "answered" || phase === "round-end" || phase === "countdown") && players.length > 0 && (
          <div className="px-3 py-2 mt-auto border-t border-slate-200/80 dark:border-white/10 bg-black/10 dark:bg-black/30">
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-black text-blue-600/60 dark:text-blue-400/60 mb-1">{teamLabel("blue")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {blueTeam.map(p => (
                    <span key={p.name} className="text-xs text-blue-700 dark:text-blue-200 bg-blue-500/20 px-2 py-1 rounded-lg leading-tight font-bold border border-blue-400/20 flex items-center gap-1">
                      <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-px bg-slate-300/80 dark:bg-white/10" />
              <div className="flex-1">
                <div className="text-[10px] font-black text-red-600/60 dark:text-red-400/60 mb-1 text-end">{teamLabel("red")}</div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {redTeam.map(p => (
                    <span key={p.name} className="text-xs text-red-700 dark:text-red-200 bg-red-500/20 px-2 py-1 rounded-lg leading-tight font-bold border border-red-400/20 flex items-center gap-1">
                      <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
