import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { CartoonTugScene } from "@/components/game/cartoon-tug-scene";
import { AvatarDisplay } from "@/components/avatar-display";
import { QRModalButton } from "@/components/game-qr-code";
import { Volume2, VolumeX } from "lucide-react";

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
  private compressor: DynamicsCompressorNode | null = null;
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

  /** Master audio chain: dynamics compressor → destination. Prevents clipping and balances loudness. */
  private getDest(): AudioNode {
    const ctx = this.getCtx();
    if (!this.compressor) {
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value     = 8;
      this.compressor.ratio.value    = 4;
      this.compressor.attack.value   = 0.003;
      this.compressor.release.value  = 0.15;
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
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  }

  /** Smooth frequency glide from startFreq → endFreq over dur seconds. */
  private freqRamp(startFreq: number, endFreq: number, dur: number, type: OscillatorType = "sine", vol = 0.13, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(this.getDest());
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), ctx.currentTime + delay + dur);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.006);
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
      const bufferSize = Math.ceil(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const g = ctx.createGain();
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
      src.connect(hp); hp.connect(g); g.connect(this.getDest());
      g.gain.setValueAtTime(vol, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay); src.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  /** Low-passed noise burst for soft thuds/impacts. */
  private noiseLow(dur: number, vol: number, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const bufferSize = Math.ceil(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400;
      src.connect(lp); lp.connect(g); g.connect(this.getDest());
      g.gain.setValueAtTime(vol, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay); src.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  startBackground() {
    // Background music disabled
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _startBackgroundUnused() {
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
    // no-op (background music disabled)
    if (this.bgHandle !== null) { clearTimeout(this.bgHandle); this.bgHandle = null; }
    this.started = false; this.urgent = false;
  }

  // ── Correct answer: punchy chord stab + rising sparkle trail ─────────────
  playCorrect() {
    this.noise(0.012, 0.26);                              // snappy attack transient
    this.tone(523,  0.10, "triangle", 0.36, 0.005);      // C5 root
    this.tone(659,  0.12, "triangle", 0.30, 0.008);      // E5
    this.tone(784,  0.14, "triangle", 0.24, 0.012);      // G5
    this.tone(1047, 0.18, "sine",     0.22, 0.03);       // C6 sparkle
    this.tone(1319, 0.15, "sine",     0.16, 0.07);       // E6
    this.tone(1568, 0.12, "sine",     0.11, 0.11);       // G6
    this.tone(2093, 0.10, "sine",     0.07, 0.14);       // C7 tip
    this.noise(0.035, 0.08, 0.05);                        // air shimmer
  }

  // ── Wrong answer: soft falling tone — emotional, not annoying ─────────────
  playWrong() {
    this.noiseLow(0.025, 0.20);                           // muffled thud
    this.freqRamp(440, 220, 0.25, "sine",     0.22);     // falling A4→A3
    this.freqRamp(330, 165, 0.22, "sine",     0.15, 0.04);
    this.tone(150, 0.30, "triangle", 0.10, 0.12);        // low soft finish
    this.tone(175, 0.25, "triangle", 0.07, 0.18);        // subtle dissonance
  }

  // ── Speed boost: rapid ascending charge + bright resolution ──────────────
  playBoost() {
    [784, 988, 1175, 1319, 1568, 1976].forEach((f, i) =>
      this.tone(f, 0.07, "triangle", 0.18 - i * 0.01, i * 0.032));
    this.noise(0.04, 0.13, 0.16);
    this.tone(2637, 0.26, "sine",     0.16, 0.2);
    this.tone(1319, 0.25, "triangle", 0.10, 0.2);
    this.tone(1047, 0.22, "sine",     0.07, 0.22);
  }

  // ── Rope pull impact: low physical thud + tension whoosh ─────────────────
  playTugPull() {
    this.freqRamp(180, 58, 0.28, "sine",     0.32);      // weighted thud
    this.tone(62,    0.22, "triangle", 0.20, 0.04);      // sub body
    this.noise(0.032, 0.18);                              // impact transient
    this.freqRamp(260, 90, 0.18, "sawtooth", 0.06, 0.02); // brief rope-creak
  }

  // ── Power pull: rising charge + slam impact + whoosh tail ────────────────
  playPowerPull() {
    this.freqRamp(80,  260, 0.16, "sawtooth", 0.28);     // power charge up
    this.freqRamp(40,  130, 0.20, "sine",     0.22, 0.02);
    this.noise(0.11, 0.26, 0.12);                         // hard impact
    this.tone(48,    0.38, "sine",     0.32, 0.12);      // deep bass slam
    this.tone(96,    0.32, "triangle", 0.24, 0.14);
    this.freqRamp(900, 180, 0.22, "sawtooth", 0.07, 0.1); // whoosh
    this.noiseLow(0.08, 0.14, 0.28);                      // rumble tail
  }

  // ── Countdown beep: escalating tension 5→1, metallic + harmonic ──────────
  playCountdownBeep(n: number) {
    const freqs: Record<number, number> = { 5: 880, 4: 1047, 3: 1175, 2: 1319, 1: 1568 };
    const baseFreq = freqs[n] ?? 880;
    const isLast   = n === 1;
    const isClose  = n <= 3;
    const vol = isLast ? 0.40 : isClose ? 0.30 : 0.20;

    this.noise(0.012, isLast ? 0.22 : 0.12);              // sharp metallic click
    this.tone(baseFreq,       0.12, "sine", vol, 0);
    this.tone(baseFreq * 1.5, 0.08, "sine", vol * 0.42, 0.01);
    if (isClose) this.tone(baseFreq * 2, 0.06, "sine", vol * 0.22, 0.02);
    if (isLast) {
      this.tone(baseFreq * 2, 0.10, "sine", 0.18, 0.05); // extra harmonic
      this.tone(baseFreq * 3, 0.07, "sine", 0.12, 0.08);
      this.noise(0.014, 0.18, 0.1);
    }
  }

  // ── GO! signal: rising fanfare → big bright stab ─────────────────────────
  playGoSignal() {
    [523, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.tone(f, 0.10, "triangle", 0.28 - i * 0.02, i * 0.052));
    this.tone(2093, 0.38, "triangle", 0.22, 0.27);
    this.tone(1047, 0.35, "sine",     0.16, 0.27);
    this.noise(0.08, 0.16, 0.26);
    this.tone(2637, 0.12, "sine",     0.08, 0.36);        // sparkle cap
  }

  // ── Timer tick: sharp metallic; rises to sharp alarm in urgent mode ───────
  playTickTock(beat: number, urgency: "normal" | "urgent") {
    if (urgency === "urgent") {
      this.tone(1175, 0.022, "square", 0.22);             // cutting metallic tick
      this.noise(0.010, 0.14);
      this.tone(880,  0.025, "sine",  0.10, 0.018);       // tension pulse
      if (beat % 2 === 0) this.tone(1568, 0.018, "sine", 0.08, 0.026); // high ping
    } else if (beat % 2 === 0) {
      this.tone(740, 0.022, "sine", 0.07);                 // soft normal tick
      this.noise(0.006, 0.035);
    }
  }

  // ── Crowd applause: layered noise + vocal tones + shimmer ────────────────
  playApplause() {
    for (let i = 0; i < 34; i++) {
      this.noise(0.10 + Math.random() * 0.14, 0.020 + Math.random() * 0.036, i * 0.018 + Math.random() * 0.010);
    }
    [350, 420, 500, 580, 300, 650, 280, 450, 545, 380].forEach((f, i) => {
      this.tone(f + Math.random() * 70, 0.18 + Math.random() * 0.14, "triangle",
        0.012 + Math.random() * 0.006, i * 0.036 + Math.random() * 0.022);
    });
    for (let i = 0; i < 8; i++) {
      this.tone(1200 + Math.random() * 900, 0.05, "sine", 0.007, i * 0.065 + Math.random() * 0.02);
    }
  }

  // ── Win: fanfare stab → ascending arpeggio → triumphant chord + crowd ────
  playWin() {
    // Phase 1: Fanfare chord stab
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.26 - i * 0.02, "triangle", 0.36 - i * 0.04, i * 0.007));
    this.noise(0.018, 0.28);
    // Phase 2: Ascending victory arpeggio
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
      this.tone(f,       0.15, "square",   0.20 - i * 0.01, 0.10 + i * 0.09);
      this.tone(f * 1.5, 0.10, "triangle", 0.06,            0.10 + i * 0.09 + 0.03);
    });
    // Phase 3: Triumphant sustained chord
    setTimeout(() => {
      this.tone(1047, 0.9, "triangle", 0.32);
      this.tone(1319, 0.8, "triangle", 0.26, 0.04);
      this.tone(784,  0.9, "triangle", 0.22, 0.08);
      this.tone(523,  0.9, "triangle", 0.18, 0.12);
      this.noise(0.06, 0.22);
    }, 750);
    // Phase 4: Crowd celebration
    setTimeout(() => this.playApplause(), 900);
    setTimeout(() => this.playApplause(), 1350);
    setTimeout(() => this.playApplause(), 1800);
  }

  // ── Lose: soft minor descent + quiet crowd disappointment (NOT comedic) ───
  playLose() {
    // Descending minor chords
    this.tone(440, 0.30, "triangle", 0.18);               // A4
    this.tone(523, 0.28, "triangle", 0.15, 0.04);         // C5 (minor 3rd)
    this.tone(659, 0.24, "triangle", 0.11, 0.08);         // E5
    // Falling glide pairs — the "deflation" feeling
    this.freqRamp(440, 275, 0.42, "sine",     0.18, 0.10);
    this.freqRamp(330, 195, 0.36, "sine",     0.12, 0.16);
    // Low soft dissonance
    this.tone(200, 0.50, "triangle", 0.10, 0.30);
    this.tone(218, 0.45, "triangle", 0.07, 0.36);         // minor 2nd — uneasy
    // Quiet crowd disappointment murmur
    for (let i = 0; i < 16; i++) {
      this.noiseLow(0.22, 0.011 + Math.random() * 0.014, i * 0.055 + Math.random() * 0.035);
    }
    [255, 280, 220, 295].forEach((f, i) =>
      this.tone(f + Math.random() * 25, 0.4, "triangle", 0.009, i * 0.08 + 0.30 + Math.random() * 0.03));
  }

  // ── Power question reveal: rising sweep + bright stab ────────────────────
  playPowerReveal() {
    [440, 554, 659, 880, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.12, "triangle", 0.16, i * 0.044));
    this.freqRamp(440, 1760, 0.30, "sawtooth", 0.07, 0.06);
    this.noise(0.08, 0.14, 0.28);
    this.tone(2637, 0.22, "sine",     0.14, 0.30);
    this.tone(1319, 0.20, "triangle", 0.12, 0.30);
  }
  destroy() {
    this.stopBackground();
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;
    this.compressor = null;
  }
}

function Confetti({ color }: { color: string }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 42 }, (_, i) => (
        <motion.div key={i}
          initial={{ y: -24, x: `${Math.random() * 100}vw`, opacity: 0.85, rotate: 0 }}
          animate={{ y: "105vh", rotate: Math.random() * 420 - 210, opacity: [0.85, 0.75, 0] }}
          transition={{ duration: 3.2 + Math.random() * 1.6, delay: Math.random() * 1.1, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: 5 + Math.random() * 7, height: 5 + Math.random() * 7,
            borderRadius: Math.random() > 0.4 ? "50%" : "2px",
            backgroundColor: [color, "#D9A521", "#fef3c7", "#34d399"][i % 4],
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

function StadiumBackdrop({ active }: { active: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-b-[2rem]">
      <style>{`
        @keyframes tugLightSweep {
          0%, 100% { transform: translateX(-8%) rotate(-18deg); opacity: .58; }
          50% { transform: translateX(6%) rotate(-14deg); opacity: .82; }
        }
        @keyframes tugLightSweepRight {
          0%, 100% { transform: translateX(8%) rotate(18deg); opacity: .58; }
          50% { transform: translateX(-6%) rotate(14deg); opacity: .82; }
        }
        @keyframes tugParticleFloat {
          0% { transform: translate3d(0, 18px, 0) scale(.65); opacity: 0; }
          25% { opacity: .55; }
          100% { transform: translate3d(var(--particle-x, 12px), -58px, 0) scale(1); opacity: 0; }
        }
        @keyframes tugMeterShine {
          0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          35% { opacity: .65; }
          100% { transform: translateX(230%) skewX(-18deg); opacity: 0; }
        }
        @keyframes tugIdleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes tugRopeTension {
          0%, 100% { transform: scaleX(1); opacity: .94; }
          50% { transform: scaleX(1.018); opacity: 1; }
        }
        .tug-light-left { animation: tugLightSweep 5.5s ease-in-out infinite; }
        .tug-light-right { animation: tugLightSweepRight 5.8s ease-in-out infinite; }
        .tug-particle { animation: tugParticleFloat var(--particle-duration, 5s) ease-in-out infinite; animation-delay: var(--particle-delay, 0s); }
        .tug-meter-shine { animation: tugMeterShine 2.9s ease-in-out infinite; }
        .tug-idle-float { animation: tugIdleFloat 2.8s ease-in-out infinite; }
        .tug-rope-tension { animation: tugRopeTension .58s ease-in-out infinite; transform-origin: center; }
        .tug-action-button { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; }
        .tug-action-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 24px rgba(247,201,72,0.42), 0 16px 38px rgba(0,0,0,0.36), inset 0 2px 0 rgba(255,255,255,0.34) !important;
          filter: saturate(1.06);
        }
        .tug-action-button:active:not(:disabled) { transform: translateY(1px) scale(.95); }
      `}</style>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #031b12 0%, #062d1b 52%, #0a4d26 100%)" }} />
      <div className="absolute inset-x-0 top-0 h-44 opacity-55"
        style={{ background: "radial-gradient(ellipse at center, rgba(10,20,18,0.2), rgba(0,0,0,0.75))" }}
      />
      <div className="absolute -left-10 top-8 h-72 w-72 rounded-full blur-3xl opacity-50" style={{ background: "rgba(59,130,246,0.45)" }} />
      <div className="absolute -right-10 top-8 h-72 w-72 rounded-full blur-3xl opacity-50" style={{ background: "rgba(239,68,68,0.45)" }} />
      <div className="tug-light-left absolute left-8 top-12 h-56 w-40 opacity-75"
        style={{ background: "radial-gradient(ellipse at top, rgba(219,234,254,0.9), rgba(147,197,253,0.18) 42%, transparent 74%)" }}
      />
      <div className="tug-light-right absolute right-8 top-12 h-56 w-40 opacity-75"
        style={{ background: "radial-gradient(ellipse at top, rgba(254,226,226,0.9), rgba(248,113,113,0.18) 42%, transparent 74%)" }}
      />
      {[10, 22, 36, 48, 62, 74, 88].map((left, i) => (
        <span
          key={`particle-${left}`}
          className="tug-particle absolute h-1.5 w-1.5 rounded-full bg-white/45"
          style={{
            left: `${left}%`,
            bottom: `${18 + (i % 3) * 12}%`,
            ["--particle-x" as string]: `${i % 2 === 0 ? 16 : -16}px`,
            ["--particle-duration" as string]: `${4.2 + i * 0.35}s`,
            ["--particle-delay" as string]: `${i * 0.45}s`,
            boxShadow: "0 0 10px rgba(255,255,255,0.45)",
          }}
        />
      ))}

      <div className="absolute inset-x-0 top-20 h-24 opacity-60">
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <pattern id="tug-crowd" width="28" height="22" patternUnits="userSpaceOnUse">
              <circle cx="6" cy="8" r="3" fill="rgba(255,255,255,0.26)" />
              <circle cx="18" cy="7" r="3" fill="rgba(96,165,250,0.28)" />
              <circle cx="25" cy="13" r="2.6" fill="rgba(248,113,113,0.26)" />
              <rect x="3" y="12" width="8" height="7" rx="3" fill="rgba(255,255,255,0.12)" />
              <rect x="15" y="11" width="8" height="7" rx="3" fill="rgba(255,255,255,0.1)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tug-crowd)" />
        </svg>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[48%]"
        style={{ background: "linear-gradient(180deg, rgba(7,54,31,0.05), rgba(10,77,38,0.9) 35%, rgba(3,27,18,0.98))" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 opacity-60"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 54px)" }}
      />

      {active && (
        <>
          <motion.div className="absolute left-10 bottom-24 h-20 w-48 rounded-full blur-2xl"
            animate={{ opacity: [0.16, 0.32, 0.16], x: [0, 12, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
            style={{ background: "rgba(203,213,225,0.45)" }}
          />
          <motion.div className="absolute right-10 bottom-24 h-20 w-48 rounded-full blur-2xl"
            animate={{ opacity: [0.14, 0.3, 0.14], x: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 3.4 }}
            style={{ background: "rgba(203,213,225,0.42)" }}
          />
          {[12, 31, 68, 84].map((left, i) => (
            <motion.span key={left}
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-300"
              style={{ left: `${left}%`, top: `${34 + (i % 2) * 18}%`, boxShadow: "0 0 12px rgba(251,191,36,0.9)" }}
              animate={{ opacity: [0, 1, 0], y: [0, -12, -24], scale: [0.8, 1.25, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.8 + i * 0.25, delay: i * 0.35 }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function TugCharacters({
  ropePos,
  isPulling,
  isUrgent,
  isCelebrating,
  winnerSide,
}: {
  ropePos: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  winnerSide: "blue" | "red" | null;
}) {
  return (
    <motion.div
      animate={isPulling ? { scale: [1.2, 1.215, 1.2], x: [0, ropePos < 50 ? -5 : 5, 0] } : { scale: 1.2, x: 0 }}
      transition={{ repeat: isPulling ? Infinity : 0, duration: 0.58 }}
      className="tug-idle-float relative mx-auto w-full max-w-5xl origin-center drop-shadow-[0_24px_22px_rgba(0,0,0,0.45)]"
    >
      <CartoonTugScene
        ropePos={ropePos}
        isPulling={isPulling}
        isUrgent={isUrgent}
        isCelebrating={isCelebrating}
        winnerSide={winnerSide}
      />
      {/* ── Cloth ribbon marker: two slim fabric tails hanging from the rope centre ── */}
      <motion.div
        className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
        style={{ top: "64%", transformOrigin: "center top" }}
        animate={{ rotate: isPulling ? [-5, 4, -4, 5, -5] : [-2, 2, -2] }}
        transition={{ repeat: Infinity, duration: isPulling ? 1.3 : 3.5, ease: "easeInOut" }}
      >
        <svg width="12" height="18" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="tugCloth" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0"    stopColor="#7a1e1e"/>
              <stop offset="0.32" stopColor="#af3535"/>
              <stop offset="0.64" stopColor="#963030"/>
              <stop offset="1"    stopColor="#601818"/>
            </linearGradient>
          </defs>

          {/* Compressed tie — where the fabric cinches around the rope */}
          <rect x="0.5" y="0" width="11" height="1.5" rx="0.6" fill="#4d0f0f" opacity="0.8"/>

          {/* Left tail */}
          <path d="M0.5,1.5 C0,5.5 -0.2,10 0.4,15 Q0.8,17 2,16.5 L3.8,15 C3.3,10 3.6,5.5 4.5,1.5 Z"
                fill="url(#tugCloth)"/>
          <path d="M1.5,3 C1.3,7.5 1.3,11.5 1.6,14.5"
                stroke="rgba(210,120,120,0.22)" strokeWidth="0.4" fill="none"/>
          <path d="M3.1,2.8 C2.9,7.5 3,11.5 3.3,14"
                stroke="rgba(40,5,5,0.26)" strokeWidth="0.35" fill="none"/>

          {/* Right tail */}
          <path d="M11.5,1.5 C12,5.5 12.2,10 11.6,15 Q11.2,17 10,16.5 L8.2,15 C8.7,10 8.4,5.5 7.5,1.5 Z"
                fill="url(#tugCloth)"/>
          <path d="M10.5,3 C10.7,7.5 10.7,11.5 10.4,14.5"
                stroke="rgba(210,120,120,0.22)" strokeWidth="0.4" fill="none"/>
          <path d="M8.9,2.8 C9.1,7.5 9,11.5 8.7,14"
                stroke="rgba(40,5,5,0.26)" strokeWidth="0.35" fill="none"/>

          {/* Centre gap — depth shadow between tails */}
          <path d="M4.5,1.5 L5,15 Q6,17 7,15 L7.5,1.5 Z" fill="rgba(30,0,0,0.16)"/>
        </svg>
      </motion.div>
      <div className="pointer-events-none absolute left-1/2 top-[76%] h-24 w-1 -translate-x-1/2 rounded-full bg-white/85 shadow-[0_0_18px_rgba(255,255,255,0.8)]" />
      {isPulling && (
        <>
          <motion.div className="absolute left-[20%] bottom-[18%] h-8 w-28 rounded-full bg-slate-200/25 blur-md"
            animate={{ opacity: [0.1, 0.35, 0.1], scaleX: [0.8, 1.15, 0.8] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
          />
          <motion.div className="absolute right-[20%] bottom-[18%] h-8 w-28 rounded-full bg-slate-200/25 blur-md"
            animate={{ opacity: [0.1, 0.35, 0.1], scaleX: [0.8, 1.15, 0.8] }}
            transition={{ repeat: Infinity, duration: 0.7, delay: 0.15 }}
          />
        </>
      )}
    </motion.div>
  );
}

function TugPowerMeter({ position }: { position: number }) {
  const pos = Math.max(7, Math.min(93, position));
  const inDanger = pos < 20 || pos > 80;
  return (
    <div className="relative mx-auto w-full max-w-3xl px-2">
      <div
        className="relative h-8 sm:h-10 lg:h-12 rounded-[1.2rem] border border-white/25 bg-black/35 p-1 sm:p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.38), inset 0 2px 8px rgba(255,255,255,0.12), inset 0 -10px 18px rgba(0,0,0,0.3)" }}
      >
        <div className="relative h-full overflow-hidden rounded-2xl">
          {/* Blue fills left — shrinks as red wins, grows as blue wins */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#082f8f] via-[#1d4ed8] to-[#60a5fa]"
            style={{ width: `${100 - pos}%`, transition: "width 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" }}
          />
          {/* Red fills right — shrinks as blue wins, grows as red wins */}
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#7f1d1d] via-[#dc2626] to-[#fb7185]"
            style={{ width: `${pos}%`, transition: "width 0.55s cubic-bezier(0.25,0.46,0.45,0.94)" }}
          />
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.85) 0 8px, transparent 8px 18px)" }}
          />
          <div className="tug-meter-shine absolute inset-y-0 w-24 bg-white/35 blur-sm" />
          <div className="absolute inset-0 shadow-[inset_0_2px_7px_rgba(255,255,255,0.28),inset_0_-8px_16px_rgba(0,0,0,0.35)]" />
          <div className="absolute inset-y-0 left-0 w-12 bg-blue-300/35 blur-lg" />
          <div className="absolute inset-y-0 right-0 w-12 bg-red-300/35 blur-lg" />
        </div>
        <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/70" />
        <motion.div
          animate={{ left: `${pos}%`, scale: inDanger ? [1, 1.08, 1] : 1 }}
          transition={{ type: "spring", stiffness: 95, damping: 16 }}
          className="absolute top-1/2 z-20 h-6 w-6 sm:h-8 sm:w-8 lg:h-9 lg:w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-200/80 shadow-[0_0_14px_rgba(247,201,72,0.65)]"
          style={{
            background: "radial-gradient(circle at 32% 24%, #fff7cc 0%, #f7c948 28%, #d97706 62%, #7c3f09 100%)",
            boxShadow: "0 0 18px rgba(247,201,72,0.62), inset 0 2px 5px rgba(255,255,255,0.58), inset 0 -5px 10px rgba(95,45,8,0.5)",
          }}
        >
          <div className="flex h-full w-full items-center justify-center text-xs sm:text-sm lg:text-base drop-shadow-sm">🪢</div>
        </motion.div>
      </div>
    </div>
  );
}

function TeamScoreCard({
  team,
  label,
  score,
  playersCount,
  lang,
}: {
  team: "blue" | "red";
  label: string;
  score: number;
  playersCount: number;
  lang: string;
}) {
  const isBlue = team === "blue";
  return (
    <div
      className={`rounded-[18px] border px-3 py-2 text-white backdrop-blur-md ${isBlue ? "border-blue-300/40" : "border-red-300/40"}`}
      style={{
        background: isBlue
          ? "linear-gradient(145deg, rgba(7,42,113,0.96), rgba(29,78,216,0.82))"
          : "linear-gradient(145deg, rgba(127,29,29,0.96), rgba(220,38,38,0.82))",
        boxShadow: isBlue
          ? "0 12px 32px rgba(29,78,216,0.28), 0 0 18px rgba(59,130,246,0.16), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "0 12px 32px rgba(220,38,38,0.28), 0 0 18px rgba(248,113,113,0.16), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-white/82 sm:text-[11px]">👥 {label}</p>
        <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] font-black text-white/75">{playersCount}</span>
      </div>
      <p
        className="rounded-xl bg-black/20 px-2 py-1 text-center text-2xl font-black leading-none tracking-tight sm:text-3xl"
        style={{ textShadow: "0 2px 10px rgba(0,0,0,0.38)", fontVariantNumeric: "tabular-nums" }}
      >
        {score}
      </p>
      <p className="mt-1 text-center text-[9px] font-bold text-white/64">
        {playersCount > 0
          ? (lang === "ar" ? "نقاط القوة" : "Power points")
          : (lang === "ar" ? "بانتظار اللاعبين" : "Waiting for players")}
      </p>
    </div>
  );
}

function TugActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !onClick}
      className="tug-action-button relative mx-auto flex min-h-[42px] w-full max-w-xs items-center justify-center rounded-[1.1rem] px-5 text-base font-black text-white disabled:cursor-default disabled:opacity-80"
      style={{
        background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
        color: "#fff7ed",
        boxShadow: "0 0 10px rgba(247,201,72,0.22), 0 8px 18px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.28)",
        textShadow: "0 2px 10px rgba(90,43,6,0.55)",
      }}
    >
      <span className="absolute inset-1 rounded-[1.1rem] border border-white/18" />
      <span className="relative z-10">⚡ {label}</span>
    </motion.button>
  );
}

/** Compact team status row shown on mobile/tablet (hidden lg+) replacing the large TeamScoreCards */
function MobileTeamStatusRow({
  blueScore,
  redScore,
  blueLabel,
  redLabel,
}: {
  blueScore: number;
  redScore: number;
  blueLabel: string;
  redLabel: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 lg:hidden"
      style={{ direction: "ltr" }}
    >
      {/* Blue score pill — physical left */}
      <div
        className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 flex-1 min-w-0"
        style={{ background: "rgba(29,78,216,0.25)", border: "1px solid rgba(59,130,246,0.4)" }}
      >
        <span className="text-base leading-none">🔵</span>
        <span className="text-white font-black text-base tabular-nums">{blueScore}</span>
        <span className="text-blue-200/60 text-[10px] font-bold truncate hidden sm:inline">{blueLabel}</span>
      </div>
      {/* Center rope icon */}
      <span className="text-2xl shrink-0 leading-none">🪢</span>
      {/* Red score pill — physical right */}
      <div
        className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 flex-1 min-w-0"
        style={{ background: "rgba(220,38,38,0.25)", border: "1px solid rgba(248,113,113,0.4)" }}
      >
        <span className="text-red-200/60 text-[10px] font-bold truncate hidden sm:inline">{redLabel}</span>
        <span className="text-white font-black text-base tabular-nums">{redScore}</span>
        <span className="text-base leading-none">🔴</span>
      </div>
    </div>
  );
}

function TugArena({
  ropePos,
  blueScore,
  redScore,
  blueCount,
  redCount,
  blueLabel,
  redLabel,
  lang,
  isPulling,
  isUrgent,
  isCelebrating,
  winnerSide,
  children,
}: {
  ropePos: number;
  blueScore: number;
  redScore: number;
  blueCount: number;
  redCount: number;
  blueLabel: string;
  redLabel: string;
  lang: string;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  winnerSide: "blue" | "red" | null;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-b-[2rem] border-b border-white/10 px-3 pb-1 sm:pb-2 pt-1 shadow-[0_18px_56px_rgba(0,0,0,0.32)] sm:px-5">
      <StadiumBackdrop active={isPulling} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="min-h-[185px] sm:min-h-[290px] lg:min-h-[360px]">
          <TugCharacters
            ropePos={ropePos}
            isPulling={isPulling}
            isUrgent={isUrgent}
            isCelebrating={isCelebrating}
            winnerSide={winnerSide}
          />
        </div>
        <div className="grid items-end gap-1.5 lg:grid-cols-[170px_minmax(0,1fr)_170px] lg:gap-2">
          {/* Hidden on mobile/tablet — replaced by MobileTeamStatusRow below the arena */}
          <div className="hidden lg:block">
            <TeamScoreCard team="blue" label={blueLabel} score={blueScore} playersCount={blueCount} lang={lang} />
          </div>
          <div className="space-y-1 sm:space-y-1.5">
            <TugPowerMeter position={ropePos} />
            {children}
          </div>
          <div className="hidden lg:block">
            <TeamScoreCard team="red" label={redLabel} score={redScore} playersCount={redCount} lang={lang} />
          </div>
        </div>
      </div>
    </section>
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
  // ref so socket closures always see current myTeam without re-binding
  const myTeamRef = useRef<"blue" | "red" | null>(null);
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

  // Keep the ref in sync so socket closures always read current myTeam
  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);

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
              (res: { success?: boolean; team?: "blue" | "red"; players?: PlayerInfo[]; error?: string; gameState?: string; ropePosition?: number; activeQuestion?: QuestionData & { remainingSecs?: number }; roundSummary?: RoundEndData }) => {
                if (res.error) { setError(res.error); return; }
                setMyTeam(res.team ?? null);
                setPlayers(res.players ?? []);
                if (res.ropePosition !== undefined) setRopePos(res.ropePosition);
                const gs = (res.gameState ?? "lobby") as Phase;
                setPhase(gs);
                if (gs === "question" && res.activeQuestion) {
                  const aq = res.activeQuestion;
                  setQuestion(aq);
                  setIsPowerQ(!!aq.isPower);
                  startTimer(aq.remainingSecs ?? aq.duration);
                  getSound().startBackground();
                } else if (gs === "paused" && res.activeQuestion) {
                  setIsPaused(true);
                  setQuestion(res.activeQuestion);
                  setIsPowerQ(!!res.activeQuestion.isPower);
                } else if (gs === "round-end" && res.roundSummary && res.activeQuestion) {
                  setRoundData({ ...res.roundSummary, players: res.players ?? [] });
                  setQuestion(res.activeQuestion);
                  setIsPowerQ(!!res.activeQuestion.isPower);
                }
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
      setSelectedAnswer(null);
      setAnswerCorrect(null);
      setAnswerCorrectIndex(null);
      setRoundData(null);
      setScorePopup(null);
      setCheerMsg(null);
      setShowBoost(false);
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
      // Winning team (or teacher/draw) hears triumph; losing team hears defeat
      const team = myTeamRef.current;
      if (data.winner === "draw" || !team || team === data.winner) {
        getSound().playWin();
      } else {
        getSound().playLose();
      }
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
    const selectedText = question?.options[idx];
    getTugSocket().emit("tug:answer", { pin, answerIndex: idx, answerText: selectedText },
      (res: { correct?: boolean; isBoost?: boolean; isPower?: boolean; streak?: number; correctIndex?: number; error?: string }) => {
        if (res.error) {
          setSelectedAnswer(null);
          setError(res.error);
          return;
        }
        const serverCorrectIndex = typeof res.correctIndex === "number" ? res.correctIndex : undefined;
        const serverCorrectText = serverCorrectIndex !== undefined ? question?.options[serverCorrectIndex] : undefined;
        const correct = !!res.correct || (!!selectedText && !!serverCorrectText && selectedText === serverCorrectText);
        setAnswerCorrect(correct);
        if (serverCorrectIndex !== undefined) setAnswerCorrectIndex(serverCorrectIndex);
        setPhase("answered");

        if (correct) {
          if (res.isBoost) {
            getSound().playBoost();
            setShowBoost(true);
            setTimeout(() => setShowBoost(false), 1500);
          } else {
            getSound().playCorrect();
          }
          const newStreak = res.streak ?? (myStreak + 1);
          setMyStreak(newStreak);
        } else {
          getSound().playWrong();
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

  const handleMovePlayer = (playerName: string, team: "blue" | "red") => {
    getTugSocket().emit("tug:move-player", { pin, playerName, team }, (res: { success?: boolean; error?: string }) => {
      if (res.error) setError(res.error);
    });
  };

  const blueTeam = players.filter((p) => p.team === "blue");
  const redTeam = players.filter((p) => p.team === "red");
  const blueTotal = blueTeam.reduce((sum, player) => sum + player.score, 0);
  const redTotal = redTeam.reduce((sum, player) => sum + player.score, 0);
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
        <div className="min-h-screen flex flex-col select-none text-gray-900"
        style={{
          direction: dir,
          background: phase === "finished"
            ? "radial-gradient(circle at 50% 8%, rgba(217,165,33,0.22), transparent 34%), linear-gradient(135deg, #031b12 0%, #062d1b 54%, #0a4d26 100%)"
            : "linear-gradient(135deg, #0f2318 0%, #1a3a28 50%, #0f2318 100%)",
        }}
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

        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 dark:border-white/10 bg-black/20 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <div className="text-xs font-black text-white/60 uppercase tracking-wide">
              {lang === "ar" ? "شد الحبل" : "Tug of War"}
            </div>
            <div className="text-sm font-mono font-black bg-white/20 text-white px-2.5 py-0.5 rounded-lg">#{pin}</div>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => { navigator.clipboard.writeText(joinUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${linkCopied ? "bg-green-500 text-white" : "bg-slate-700/80 dark:bg-white/15 text-slate-200 dark:text-white/70 hover:bg-slate-600/80 dark:hover:bg-white/25"}`}
            >
              {linkCopied ? "✓" : "📋"} {linkCopied ? (lang === "ar" ? "تم!" : "Done!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}
            </motion.button>
          </div>
          <div className="flex items-center gap-2">
            {/* زر الصوت واضح في أعلى اللعبة لكل من المعلم والطالب */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleToggleMute}
              aria-label={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
              title={lang === "ar" ? (isMuted ? "تشغيل الصوت" : "كتم الصوت") : (isMuted ? "Unmute" : "Mute")}
              className={`h-10 rounded-xl flex items-center gap-2 px-3 border shadow-lg transition-all ${
                isMuted
                  ? "bg-red-600 border-red-300 text-white hover:bg-red-500"
                  : "bg-white border-amber-300 text-slate-900 hover:bg-amber-50"
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="hidden sm:inline text-xs font-black whitespace-nowrap">
                {isMuted
                  ? (lang === "ar" ? "مكتوم" : "Muted")
                  : (lang === "ar" ? "الصوت" : "Sound")}
              </span>
            </motion.button>

            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowMusicPicker(!showMusicPicker)}
                aria-label={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
                title={lang === "ar" ? "اختيار الموسيقى" : "Music style"}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border shadow-lg transition-all ${
                  isMuted
                    ? "bg-slate-300 border-slate-100 text-slate-500 hover:bg-slate-200"
                    : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
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
                      className="absolute top-12 end-0 z-50 w-56 bg-slate-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden"
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

            {myTeam && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 font-black px-2.5 py-1 rounded-xl shadow-lg shrink-0"
                style={{
                  background: myTeam === "blue" ? "#1D4ED8" : "#DC2626",
                  color: "#ffffff",
                  border: `2px solid ${myTeam === "blue" ? "#93c5fd" : "#fca5a5"}`,
                }}
              >
                <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />
                <span className="text-[10px] sm:text-xs whitespace-nowrap">
                  {lang === "ar"
                    ? `أنت في ${teamLabel(myTeam)}`
                    : `You're on ${teamLabel(myTeam)}`}
                </span>
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

        <div className="flex-1 flex flex-col mx-auto w-full">

          <TugArena
            ropePos={ropePos}
            blueScore={blueTotal}
            redScore={redTotal}
            blueCount={blueTeam.length}
            redCount={redTeam.length}
            blueLabel={teamLabel("blue")}
            redLabel={teamLabel("red")}
            lang={lang}
            isPulling={isPulling}
            isUrgent={isUrgent}
            isCelebrating={phase === "finished"}
            winnerSide={gameEnd?.winner === "draw" ? null : gameEnd?.winner ?? null}
          >
            {phase === "lobby" && isCreator && (
              <TugActionButton
                label={startingGame ? "..." : (lang === "ar" ? "ابدأ اللعبة!" : "Start Game!")}
                onClick={handleStart}
                disabled={startingGame || players.length < 1}
              />
            )}
            {phase === "lobby" && !isCreator && (
              <div className="text-center">
                <TugActionButton label={lang === "ar" ? "انتظر المعلم" : "Waiting for host"} disabled />
              </div>
            )}
            {(phase === "question" || phase === "answered") && (
              <div className="flex justify-center py-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-bold text-white/55 backdrop-blur-sm">
                  {phase === "answered"
                    ? (lang === "ar" ? "✓ تم الإجابة" : "✓ Answered")
                    : (lang === "ar" ? "⚡ اضغط الآن" : "⚡ Press Now")}
                </span>
              </div>
            )}
          </TugArena>

          {/* Mobile/tablet compact team status row — replaces the large TeamScoreCards hidden below lg */}
          <MobileTeamStatusRow
            blueScore={blueTotal}
            redScore={redTotal}
            blueLabel={teamLabel("blue")}
            redLabel={teamLabel("red")}
          />

          {/* On desktop lg+, keep the slight overlap with the arena (-mt-3).
              On mobile, the status row sits between; no overlap needed. */}
          <div className="flex-1 flex flex-col min-w-0 max-w-4xl mx-auto w-full lg:-mt-3">
            <AnimatePresence mode="wait">

              {phase === "lobby" && (
                <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4 py-4">

                  {/* Team grids — Red left, Blue right, fixed LTR so position is always consistent */}
                  <div className="grid grid-cols-2 gap-2 mb-3" style={{ direction: "ltr" }}>
                    {/* Red Team — left panel */}
                    <div className="rounded-xl border-2 border-red-500 overflow-hidden" style={{ background: "#ffffff" }}>
                      <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: "#dc2626" }}>
                        <span className="text-white font-black text-xs" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                          🔴 {teamLabel("red")} ({redTeam.length})
                        </span>
                      </div>
                      <div className="p-2 space-y-1 max-h-40 overflow-y-auto" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                        {redTeam.length === 0
                          ? <p className="text-red-400 text-xs text-center py-2">{lang === "ar" ? "انتظار..." : "Waiting..."}</p>
                          : redTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-1 py-1 px-1.5 rounded-lg border border-red-200" style={{ background: "#fef2f2" }}>
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-red-900 font-bold text-[11px] flex-1 truncate">{p.name}</span>
                              {isCreator && (
                                <button onClick={() => handleMovePlayer(p.name, "blue")}
                                  className="text-blue-700 hover:text-blue-900 text-[9px] font-black px-1 py-0.5 rounded transition-colors shrink-0" style={{ background: "#dbeafe" }}>
                                  🔵
                                </button>
                              )}
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                    {/* Blue Team — right panel */}
                    <div className="rounded-xl border-2 border-blue-500 overflow-hidden" style={{ background: "#ffffff" }}>
                      <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: "#1d4ed8" }}>
                        <span className="text-white font-black text-xs" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                          🔵 {teamLabel("blue")} ({blueTeam.length})
                        </span>
                      </div>
                      <div className="p-2 space-y-1 max-h-40 overflow-y-auto" style={{ direction: lang === "ar" ? "rtl" : "ltr" }}>
                        {blueTeam.length === 0
                          ? <p className="text-blue-400 text-xs text-center py-2">{lang === "ar" ? "انتظار..." : "Waiting..."}</p>
                          : blueTeam.map((p) => (
                            <motion.div key={p.name} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                              className="flex items-center gap-1 py-1 px-1.5 rounded-lg border border-blue-200" style={{ background: "#eff6ff" }}>
                              <AvatarDisplay avatar={p.avatar} size="2xl" />
                              <span className="text-blue-900 font-bold text-[11px] flex-1 truncate">{p.name}</span>
                              {isCreator && (
                                <button onClick={() => handleMovePlayer(p.name, "red")}
                                  className="text-red-700 hover:text-red-900 text-[9px] font-black px-1 py-0.5 rounded transition-colors shrink-0" style={{ background: "#fee2e2" }}>
                                  🔴
                                </button>
                              )}
                            </motion.div>
                          ))
                        }
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <p className="text-white/70 text-sm font-bold">{lang === "ar" ? "استعدوا للمنافسة داخل الملعب" : "Get ready for the arena battle"}</p>
                  </div>
                </motion.div>
              )}

              {phase === "countdown" && (
                <motion.div key="countdown" className="px-4 py-4 text-center">
                  {isPowerQ && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 0.8 }}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black px-4 py-1.5 rounded-2xl shadow-lg text-base mb-2"
                    >
                      ⚡ {lang === "ar" ? "سؤال القوة! نقاط مضاعفة!" : "POWER QUESTION! 2x Points!"}
                    </motion.div>
                  )}
                  <p className="text-slate-400 dark:text-white/30 text-lg font-black">{lang === "ar" ? "استعد للمنافسة..." : "Get ready..."}</p>
                </motion.div>
              )}

              {(phase === "question" || phase === "answered" || phase === "round-end") && question && (
                <motion.div key="question" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-2 lg:px-3 pt-0.5 lg:pt-1 pb-1 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-0.5 lg:mb-1">
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

                  <div className={`mx-auto w-full max-w-3xl rounded-2xl p-2 lg:p-3 mb-1 lg:mb-1.5 text-center border text-white shadow-md ${
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
                    <p className="text-base sm:text-lg lg:text-xl font-black leading-snug">{question.text}</p>
                    {phase === "round-end" && roundData && (
                      <p className="text-green-600 dark:text-green-300 text-sm lg:text-base font-bold mt-2">
                        ✅ {question.options[roundData.correctIndex]}
                      </p>
                    )}
                  </div>

                  <div className="relative grid grid-cols-2 gap-2 flex-1">
                    {question.options.map((opt, idx) => {
                      const os = optionStyle(idx);
                      return (
                        <button key={idx}
                          onClick={() => handleAnswer(idx)} disabled={selectedAnswer !== null || phase === "round-end"}
                          className={`relative flex items-center justify-center gap-2 p-2 lg:p-3 rounded-2xl text-center font-bold text-sm lg:text-base border-2 overflow-hidden min-h-[48px] lg:min-h-[62px] shadow-md touch-manipulation select-none transition-colors duration-150 ${os.className}`}
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

                  {phase === "answered" && answerCorrect !== null && (
                    <div className="text-center py-1 px-3 rounded-xl mt-1.5 font-bold text-sm text-white"
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
                      className="w-full mt-1.5 py-2 lg:py-2.5 rounded-2xl font-black text-base shadow-lg text-white"
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
                <motion.div
                  key="finished"
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="relative px-4 py-3 text-center text-white"
                >
                  <div className="pointer-events-none absolute inset-x-4 -top-2 h-40 rounded-full blur-3xl" style={{ background: "rgba(217,165,33,0.14)" }} />
                  {gameEnd.winner === "draw" ? (
                    <>
                      <div className="relative mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-amber-300/30 bg-white/8 text-4xl shadow-[0_0_24px_rgba(217,165,33,0.18)] backdrop-blur-md">🤝</div>
                      <h2 className="text-3xl lg:text-4xl font-black mb-1.5 text-white">{lang === "ar" ? "تعادل رائع!" : "Great Draw!"}</h2>
                      <p className="font-bold text-sm mb-3" style={{ color: "#D9A521" }}>{lang === "ar" ? "الفريقان متكافئان!" : "Both teams are equal!"}</p>
                    </>
                  ) : (
                    <>
                      <motion.div
                        animate={{ y: [0, -6, 0], scale: [1, 1.04, 1] }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                        className="relative mx-auto mb-2.5 flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-[2rem] border border-amber-300/36 bg-white/10 text-7xl shadow-[0_0_28px_rgba(217,165,33,0.26),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-md"
                      >
                        🏆
                      </motion.div>
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.35 }}
                        className={`text-3xl lg:text-5xl font-black mb-1.5 drop-shadow-sm ${gameEnd.winner === "blue" ? "text-blue-200" : "text-red-200"}`}
                      >
                        {teamLabel(gameEnd.winner)} {lang === "ar" ? "يفوز!" : "Wins!"}
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16, duration: 0.35 }}
                        className="mb-2.5 text-sm lg:text-base font-bold text-amber-100/85"
                      >
                        {lang === "ar" ? "أحسنتم! لقد سيطرتم على الحبل" : "Well done! You controlled the rope"}
                      </motion.p>
                      {myTeam === gameEnd.winner && (
                        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                          className="text-amber-300 font-black text-base lg:text-lg mb-2">
                          🎉 {lang === "ar" ? "أنت في الفريق الفائز!" : "You're on the winning team!"}
                        </motion.div>
                      )}
                    </>
                  )}

                  <div className="relative rounded-3xl p-3 lg:p-4 mb-3 text-start max-h-64 overflow-y-auto text-white shadow-xl"
                    style={{ background: "rgba(3,27,18,0.74)", border: "1.5px solid rgba(217,165,33,0.24)", boxShadow: "0 22px 50px rgba(0,0,0,0.28)" }}>
                    <h3 className="text-sm lg:text-base font-black text-amber-200 mb-2">{lang === "ar" ? "🏅 الترتيب النهائي" : "🏅 Final Rankings"}</h3>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div
                        className={`rounded-2xl text-center transition-all ${gameEnd.winner === "blue" ? "p-3 scale-[1.015] border-2 border-amber-300/55" : "p-2.5 scale-[0.97] border border-blue-200/18 opacity-70"}`}
                        style={{
                          background: gameEnd.winner === "blue" ? "linear-gradient(145deg, rgba(29,78,216,0.42), rgba(15,47,122,0.72))" : "rgba(29,78,216,0.14)",
                          boxShadow: gameEnd.winner === "blue" ? "0 18px 38px rgba(217,165,33,0.18), 0 0 22px rgba(59,130,246,0.18)" : "none",
                        }}
                      >
                        <p className="text-blue-100 text-xs lg:text-sm font-black mb-1">{teamLabel("blue")}</p>
                        <p className="text-2xl lg:text-4xl font-black text-white">
                          {[...gameEnd.players].filter(p => p.team === "blue").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                      <div
                        className={`rounded-2xl text-center transition-all ${gameEnd.winner === "red" ? "p-3 scale-[1.015] border-2 border-amber-300/55" : "p-2.5 scale-[0.97] border border-red-200/18 opacity-70"}`}
                        style={{
                          background: gameEnd.winner === "red" ? "linear-gradient(145deg, rgba(220,38,38,0.42), rgba(127,29,29,0.72))" : "rgba(220,38,38,0.14)",
                          boxShadow: gameEnd.winner === "red" ? "0 18px 38px rgba(217,165,33,0.18), 0 0 22px rgba(248,113,113,0.18)" : "none",
                        }}
                      >
                        <p className="text-red-100 text-xs lg:text-sm font-black mb-1">{teamLabel("red")}</p>
                        <p className="text-2xl lg:text-4xl font-black text-white">
                          {[...gameEnd.players].filter(p => p.team === "red").reduce((s, p) => s + p.score, 0)}
                        </p>
                      </div>
                    </div>
                    {[...gameEnd.players].sort((a, b) => b.score - a.score).map((p, i) => (
                      <motion.div key={p.name}
                        initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-2.5 py-2 px-3 border border-white/10 last:border rounded-xl mb-1.5 last:mb-0 bg-white/6 hover:bg-white/10"
                      >
                        <span className={`w-7 text-center font-black text-base lg:text-lg ${i === 0 ? "text-amber-600" : i === 1 ? "text-slate-600" : i === 2 ? "text-orange-600" : "text-slate-500"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </span>
                        <AvatarDisplay avatar={p.avatar} size="3xl" />
                        <span className={`flex-1 font-bold text-sm lg:text-base ${p.team === "blue" ? "text-blue-100" : "text-red-100"}`}>{p.name}</span>
                        <span className={`text-xs lg:text-sm font-bold px-2 py-1 rounded-lg border ${p.team === "blue" ? "bg-blue-500/18 text-blue-100 border-blue-200/20" : "bg-red-500/18 text-red-100 border-red-200/20"}`}>
                          {p.team === "blue" ? (lang === "ar" ? "أزرق" : "Blue") : (lang === "ar" ? "أحمر" : "Red")}
                        </span>
                        <span className="font-black text-amber-300 text-base lg:text-lg">{p.score}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setLocation("/")}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-800 transition-colors"
                      style={{ background: "#ffffff", border: "1px solid rgba(148,163,184,0.45)" }}>
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
          <div className="px-3 py-2 mt-auto border-t-2 border-gray-200" style={{ background: "#ffffff" }}>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-black text-blue-700 mb-1">{teamLabel("blue")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {blueTeam.map(p => (
                    <span key={p.name} className="text-xs text-blue-800 px-2 py-0.5 rounded-lg leading-tight font-bold border border-blue-300 flex items-center gap-1" style={{ background: "#dbeafe" }}>
                      <AvatarDisplay avatar={p.avatar} size="sm" /> {p.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-px bg-gray-200" />
              <div className="flex-1">
                <div className="text-[10px] font-black text-red-700 mb-1 text-end">{teamLabel("red")}</div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {redTeam.map(p => (
                    <span key={p.name} className="text-xs text-red-800 px-2 py-0.5 rounded-lg leading-tight font-bold border border-red-300 flex items-center gap-1" style={{ background: "#fee2e2" }}>
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
