// Shared visual + audio building blocks for ALL tug-of-war game modes
// (online multiplayer in tug-play.tsx, class mode in tug-class.tsx).
// Extracted verbatim from tug-play.tsx — behaviour is identical.
import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CartoonTugScene, type TugImpulse } from "@/components/game/cartoon-tug-scene";

interface QuestionData {
  index: number;
  total: number;
  text: string;
  options: string[];
  duration: number;
  isPower?: boolean;
}

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

  // ── BACKGROUND MUSIC ─────────────────────────────────────────────────────
  // Sports-arena competitive track — 4/4, 8th-note steps
  // Key: G minor  |  Normal: 126 BPM  |  Urgent: 152 BPM
  // Layers: kick · snare · hi-hats · bass · chord stabs · lead melody
  startBackground() {
    if (this.started) return;
    this.started = true;
    let step = 0;

    const play = () => {
      if (!this.started) return;
      try {
        const bpm = this.urgent ? 152 : 126;
        const t8  = (60 / bpm) / 2;           // one 8th-note in seconds
        const b   = step % 8;
        const bar = Math.floor(step / 8);

        // ── KICK: beats 1 & 3 (steps 0 & 4) ──────────────────────
        if (b === 0 || b === 4) {
          this.freqRamp(115, 38, 0.11, "sine", 0.52);
          this.noiseLow(0.013, 0.20);
          this.noise(0.007, 0.18);
        }
        // ghost kick for urgency
        if (this.urgent && b === 3) {
          this.freqRamp(88, 34, 0.07, "sine", 0.28, t8 * 0.5);
        }

        // ── SNARE: beats 2 & 4 (steps 2 & 6) ─────────────────────
        if (b === 2 || b === 6) {
          this.noise(0.080, 0.20);
          this.tone(190, 0.07, "triangle", 0.17);
          this.tone(242, 0.05, "sine",     0.09, 0.007);
        }

        // ── HI-HATS ───────────────────────────────────────────────
        if (b % 2 === 0) {
          this.noise(0.026, 0.042);           // closed — on-beat
        } else {
          this.noise(0.072, 0.027);           // open — off-beat
        }
        if (this.urgent && b % 2 === 0) {    // 16th subdivisions when urgent
          setTimeout(() => { if (this.started) this.noise(0.016, 0.022); }, t8 * 500);
        }

        // ── BASS LINE (Gm pentatonic) ─────────────────────────────
        // G2=98 A2=110 Bb2=117 C3=131 D3=147 Eb3=156 F3=175 G3=196
        const bassGrid = [
          [ 98,   0,  98, 117, 131, 117,  98,   0],  // bar 0 – Gm
          [131,   0, 131, 147, 156, 147, 131, 117],  // bar 1 – Cm
          [117,   0, 117, 131, 147, 131, 117,   0],  // bar 2 – Bb
          [147,   0, 147, 156, 175, 156, 147,  98],  // bar 3 – Dm cadence
        ];
        const bn = bassGrid[bar % 4][b];
        if (bn > 0) {
          this.tone(bn,       t8 * 0.85, "sawtooth", 0.17);
          this.tone(bn * 0.5, t8 * 0.90, "sine",     0.09);
        }

        // ── CHORD STABS (beat 1 of each bar) ─────────────────────
        if (b === 0) {
          const chords = [
            [196, 233, 294],   // Gm  G3–Bb3–D4
            [131, 156, 196],   // Cm  C3–Eb3–G3
            [117, 147, 175],   // Bb  Bb2–D3–F3
            [147, 175, 220],   // Dm  D3–F3–A3
          ];
          chords[bar % 4].forEach((f, i) =>
            this.tone(f, t8 * 3.0, "triangle", 0.055, i * 0.007));
        }
        // Extra accent on beat 3 for bars 1–2
        if (b === 4 && (bar % 4 === 1 || bar % 4 === 2)) {
          const acc = [[156, 196, 247], [131, 156, 196]];
          acc[(bar % 4) - 1].forEach((f, i) =>
            this.tone(f, t8 * 1.6, "triangle", 0.040, i * 0.006));
        }

        // ── LEAD MELODY (bars 0–1 of every 4-bar phrase) ─────────
        // G minor: G4=392 A4=440 Bb4=466 C5=523 D5=587 Eb5=622 F5=698
        const hooks = [
          [0, 466, 0, 587, 622, 587, 523,   0],  // bar 0: Bb–D–Eb–D–C
          [466, 0, 523, 0, 440, 392,   0,   0],  // bar 1: Bb–C–A–G
        ];
        if (bar % 4 < 2) {
          const n = hooks[bar % 2][b];
          if (n > 0) {
            this.tone(n,         t8 * 0.80, "square",   0.060);
            this.tone(n * 1.007, t8 * 0.76, "triangle", 0.028, 0.005);
          }
        }

        // ── COUNTER-MELODY / FILL (bar 3) ─────────────────────────
        if (bar % 4 === 3) {
          const fill = [0, 0, 784, 0, 698, 622, 587, 523];
          const fn = fill[b];
          if (fn > 0) this.tone(fn, t8 * 0.65, "triangle", 0.042);
        }

        step++;
        this.bgHandle = setTimeout(play, t8 * 1000);
      } catch (_) { this.bgHandle = setTimeout(play, 400); }
    };

    play();
  }

  stopBackground() {
    if (this.bgHandle !== null) { clearTimeout(this.bgHandle); this.bgHandle = null; }
    this.started = false;
    this.urgent  = false;
  }

  // ── REFEREE WHISTLE: short trill then a long blast (class-mode kickoff) ───
  playWhistle() {
    for (let i = 0; i < 5; i++)
      this.tone(i % 2 === 0 ? 2350 : 2120, 0.05, "square", 0.15, i * 0.045);
    this.noise(0.04, 0.05);
    for (let i = 0; i < 11; i++)
      this.tone(i % 2 === 0 ? 2350 : 2120, 0.05, "square", 0.17, 0.38 + i * 0.045);
    this.noise(0.05, 0.05, 0.38);
  }

  // ── LIVE CROWD BED ────────────────────────────────────────────────────────
  // A looping band-passed noise "stadium murmur" whose energy follows the
  // match (rope distance from centre + streaks). Continuous, so it lives in
  // dedicated nodes instead of the one-shot helpers above.
  private crowdSrc: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdLfo: OscillatorNode | null = null;

  startCrowd() {
    if (this.muted || this.crowdSrc) return;
    try {
      const ctx = this.getCtx();
      const dur = 2.4;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 820; bp.Q.value = 0.55;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      // Slow swell LFO so the murmur breathes like a real crowd.
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.21; lfoGain.gain.value = 0.010;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(bp); bp.connect(g); g.connect(this.getDest());
      src.start(); lfo.start();
      g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.2);
      this.crowdSrc = src; this.crowdGain = g; this.crowdFilter = bp; this.crowdLfo = lfo;
    } catch (_) {}
  }

  /** 0 = quiet murmur … 1 = roaring crowd. Eased over ~0.6s. */
  setCrowdExcitement(x: number) {
    if (!this.crowdGain || !this.crowdFilter) return;
    try {
      const ctx = this.getCtx();
      const level = Math.max(0, Math.min(1, x));
      this.crowdGain.gain.cancelScheduledValues(ctx.currentTime);
      this.crowdGain.gain.linearRampToValueAtTime(0.03 + level * 0.085, ctx.currentTime + 0.6);
      this.crowdFilter.frequency.linearRampToValueAtTime(700 + level * 950, ctx.currentTime + 0.6);
    } catch (_) {}
  }

  stopCrowd() {
    try {
      this.crowdSrc?.stop(); this.crowdLfo?.stop();
      this.crowdSrc?.disconnect(); this.crowdGain?.disconnect();
      this.crowdFilter?.disconnect(); this.crowdLfo?.disconnect();
    } catch (_) {}
    this.crowdSrc = null; this.crowdGain = null; this.crowdFilter = null; this.crowdLfo = null;
  }

  // ── HEARTBEAT: low "lub-dub" while the rope sits in the danger zone ──────
  playHeartbeat() {
    this.freqRamp(95, 42, 0.14, "sine", 0.32);
    this.noiseLow(0.02, 0.09);
    this.freqRamp(80, 38, 0.12, "sine", 0.24, 0.18);
    this.noiseLow(0.016, 0.06, 0.18);
  }

  // ── CORRECT ANSWER: bright ascending chime C5–E5–G5–C6 ───────────────────
  playCorrect() {
    [[523, 0.00], [659, 0.09], [784, 0.18], [1047, 0.27]].forEach(([f, d]) => {
      this.tone(f,         0.38, "sine",     0.28, d);
      this.tone(f * 1.501, 0.22, "triangle", 0.06, d + 0.008);
    });
    this.tone(2093, 0.18, "sine", 0.10, 0.30);  // sparkle tip
    this.tone(2637, 0.13, "sine", 0.06, 0.35);
    this.noise(0.016, 0.12, 0.012);
  }

  // ── WRONG ANSWER: short descending buzzer ─────────────────────────────────
  playWrong() {
    this.noiseLow(0.018, 0.24);
    this.freqRamp(300, 148, 0.22, "sine",     0.24);
    this.tone(165, 0.20, "square",   0.14, 0.04);
    this.tone(180, 0.17, "triangle", 0.08, 0.06);
  }

  // ── SPEED BOOST ───────────────────────────────────────────────────────────
  playBoost() {
    [784, 988, 1175, 1319, 1568].forEach((f, i) =>
      this.tone(f, 0.08, "triangle", 0.17 - i * 0.01, i * 0.030));
    this.noise(0.032, 0.12, 0.12);
    this.tone(2093, 0.28, "sine", 0.13, 0.16);
  }

  // ── BRACE: low rope creak while a team digs in before the pull resolves ──
  playBrace() {
    this.freqRamp(140, 88, 0.30, "sawtooth", 0.055);
    this.freqRamp(96, 70, 0.34, "triangle", 0.07, 0.03);
    this.noiseLow(0.10, 0.05, 0.02);
  }

  // ── ROPE PULL IMPACT ──────────────────────────────────────────────────────
  playTugPull() {
    this.freqRamp(155, 44, 0.18, "sine",     0.48);
    this.noiseLow(0.016, 0.22);
    this.noise(0.020, 0.14);
    this.tone(52, 0.26, "triangle", 0.16, 0.03);
  }

  // ── POWER PULL: rising charge → massive slam ──────────────────────────────
  playPowerPull() {
    this.freqRamp(85,  265, 0.14, "sawtooth", 0.30);
    this.freqRamp(42,  130, 0.18, "sine",     0.24, 0.02);
    this.noise(0.09, 0.28, 0.10);
    this.noiseLow(0.07, 0.20, 0.11);
    this.tone(48, 0.42, "sine",     0.34, 0.10);
    this.freqRamp(820, 155, 0.24, "sawtooth", 0.07, 0.09);
  }

  // ── COUNTDOWN BEEP: escalating pitch 5→1 ─────────────────────────────────
  playCountdownBeep(n: number) {
    const baseFreq: Record<number, number> = { 5: 523, 4: 622, 3: 740, 2: 880, 1: 1047 };
    const f    = baseFreq[n] ?? 523;
    const vol  = n === 1 ? 0.42 : n <= 3 ? 0.30 : 0.20;
    const last = n === 1;
    this.tone(f,       0.12, "sine", vol,        0);
    this.tone(f * 1.5, 0.09, "sine", vol * 0.38, 0.008);
    if (n <= 3) this.tone(f * 2, 0.06, "sine", vol * 0.18, 0.014);
    if (last) {
      this.tone(f * 1.26, 0.11, "triangle", 0.22, 0.02);
      this.tone(f * 1.5,  0.14, "sine",     0.16, 0.04);
      this.noise(0.010, 0.18, 0.010);
    }
  }

  // ── GO! SIGNAL: rising fanfare → bright stab ──────────────────────────────
  playGoSignal() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.11, "triangle", 0.28 - i * 0.02, i * 0.046));
    this.tone(1568, 0.52, "triangle", 0.26, 0.23);
    this.tone(784,  0.50, "sine",     0.18, 0.24);
    this.noise(0.055, 0.18, 0.21);
    this.tone(2093, 0.16, "sine", 0.08, 0.38);
  }

  // ── TIMER TICK ────────────────────────────────────────────────────────────
  playTickTock(beat: number, urgency: "normal" | "urgent") {
    if (urgency === "urgent") {
      this.tone(1047, 0.022, "square", 0.26);
      this.noise(0.009, 0.15);
      this.tone(880,  0.024, "sine",   0.10, 0.016);
      if (beat % 2 === 0) this.tone(1568, 0.016, "sine", 0.09, 0.022);
    } else if (beat % 2 === 0) {
      this.tone(784, 0.024, "sine", 0.09);
      this.noise(0.006, 0.036);
    }
  }

  // ── CROWD APPLAUSE ────────────────────────────────────────────────────────
  playApplause() {
    for (let i = 0; i < 28; i++) {
      this.noise(0.10 + Math.random() * 0.13, 0.016 + Math.random() * 0.028,
                 i * 0.022 + Math.random() * 0.012);
    }
    [340, 400, 480, 560, 290, 625, 270, 430].forEach((f, i) =>
      this.tone(f + Math.random() * 55, 0.20 + Math.random() * 0.12, "triangle",
                0.010 + Math.random() * 0.005, i * 0.042 + Math.random() * 0.020));
    for (let i = 0; i < 6; i++)
      this.tone(1200 + Math.random() * 800, 0.06, "sine",
                0.006, i * 0.072 + Math.random() * 0.020);
  }

  // ── WIN FANFARE: chord stab → rising arpeggio → triumph → crowd ──────────
  playWin() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.35 - i * 0.02, "triangle", 0.38 - i * 0.04, i * 0.006));
    this.noise(0.014, 0.26);
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
      this.tone(f,        0.16, "triangle", 0.22 - i * 0.01, 0.12 + i * 0.09);
      this.tone(f * 1.26, 0.10, "sine",     0.07,            0.12 + i * 0.09 + 0.018);
    });
    setTimeout(() => {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        this.tone(f, 1.5, "triangle", 0.28 - i * 0.03, i * 0.010));
      this.noise(0.034, 0.18);
    }, 780);
    setTimeout(() => this.playApplause(), 920);
    setTimeout(() => this.playApplause(), 1320);
    setTimeout(() => this.playApplause(), 1720);
  }

  // ── LOSE: dignified minor descent ─────────────────────────────────────────
  playLose() {
    this.tone(440, 0.38, "triangle", 0.20);
    this.tone(523, 0.34, "triangle", 0.16, 0.02);
    this.tone(622, 0.30, "triangle", 0.12, 0.05);        // Eb — minor colour
    this.freqRamp(440, 220, 0.55, "sine",     0.22, 0.12);
    this.freqRamp(330, 165, 0.48, "sine",     0.14, 0.18);
    this.tone(196, 0.72, "triangle", 0.16, 0.46);
    this.tone(220, 0.68, "triangle", 0.09, 0.52);
    for (let i = 0; i < 10; i++)
      this.noiseLow(0.24, 0.010 + Math.random() * 0.012, i * 0.068);
  }

  // ── POWER QUESTION REVEAL ─────────────────────────────────────────────────
  playPowerReveal() {
    [440, 554, 659, 880, 1047, 1319].forEach((f, i) =>
      this.tone(f, 0.12, "triangle", 0.16, i * 0.044));
    this.freqRamp(440, 1760, 0.30, "sawtooth", 0.07, 0.06);
    this.noise(0.072, 0.14, 0.27);
    this.tone(2637, 0.22, "sine",     0.14, 0.30);
    this.tone(1319, 0.20, "triangle", 0.12, 0.30);
  }
  destroy() {
    this.stopBackground();
    this.stopCrowd();
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;
    this.compressor = null;
  }
}

function Confetti({ color }: { color: string }) {
  const palette = [color, "#D9A521", "#F7C948", "#fef3c7", "#34d399", "#ffffff"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {Array.from({ length: 80 }, (_, i) => {
        const left = Math.random() * 100;
        const size = 5 + Math.random() * 8;
        const isStrip = Math.random() > 0.55;
        const sway = (Math.random() - 0.5) * 14;
        return (
          <motion.div key={i}
            initial={{ y: -28, opacity: 0.95, rotate: 0 }}
            animate={{ y: "106vh", x: [`0vw`, `${sway}vw`, `0vw`], rotate: Math.random() * 540 - 270, opacity: [0.95, 0.85, 0] }}
            transition={{ duration: 2.8 + Math.random() * 2, delay: Math.random() * 1.4, ease: "easeIn", x: { duration: 1.4 + Math.random(), repeat: Infinity, ease: "easeInOut" } }}
            style={{
              position: "absolute",
              left: `${left}vw`,
              width: isStrip ? size * 0.45 : size,
              height: isStrip ? size * 1.3 : size,
              borderRadius: isStrip ? "1px" : Math.random() > 0.5 ? "50%" : "2px",
              backgroundColor: palette[i % palette.length],
              boxShadow: i % 5 === 0 ? "0 0 6px rgba(247,201,72,0.6)" : "none",
            }}
          />
        );
      })}
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
        /* Impact screen shake — win hits harder than a losing recoil */
        @keyframes tugShakeWin {
          0%, 100% { transform: translate3d(0, 0, 0); }
          15% { transform: translate3d(-5px, 2px, 0); }
          35% { transform: translate3d(4px, -3px, 0); }
          55% { transform: translate3d(-3px, -1px, 0); }
          75% { transform: translate3d(2px, 2px, 0); }
        }
        @keyframes tugShakeLose {
          0%, 100% { transform: translate3d(0, 0, 0); }
          25% { transform: translate3d(3px, 1px, 0); }
          55% { transform: translate3d(-2px, -1px, 0); }
          80% { transform: translate3d(1px, 1px, 0); }
        }
        .tug-shake-win { animation: tugShakeWin .38s cubic-bezier(.36,.07,.19,.97) both; will-change: transform; }
        .tug-shake-lose { animation: tugShakeLose .3s cubic-bezier(.36,.07,.19,.97) both; will-change: transform; }
        /* Danger-zone vignette pulse */
        @keyframes tugDangerPulse {
          0%, 100% { opacity: .5; }
          50% { opacity: 1; }
        }
        .tug-danger-vignette { animation: tugDangerPulse 1s ease-in-out infinite; }
        /* Motion-sensitive users: no shakes, and the vignette holds steady
           (the information stays, the pulsing goes). */
        @media (prefers-reduced-motion: reduce) {
          .tug-shake-win, .tug-shake-lose { animation: none; }
          .tug-danger-vignette { animation: none; opacity: .6; }
        }
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
  impulse,
  intro,
  brace,
}: {
  ropePos: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  winnerSide: "blue" | "red" | null;
  impulse: TugImpulse | null;
  /** Pre-match choreography (class mode): teams off-screen → sprint in. */
  intro?: "waiting" | "run";
  /** Anticipation: this team locked an answer and digs in before it resolves. */
  brace?: "blue" | "red" | null;
}) {
  // Screen-shake restart without remounting the scene: drop the class for one
  // frame, then re-apply it so the CSS animation replays on every impulse.
  // Throttled: with a full class answering, impulses can arrive in bursts —
  // capping shakes to one per 450ms keeps it punchy instead of nauseating.
  const [shake, setShake] = useState<"win" | "lose" | null>(null);
  const lastShakeAtRef = useRef(0);
  useEffect(() => {
    if (!impulse) return;
    const now = performance.now();
    if (now - lastShakeAtRef.current < 450) return;
    lastShakeAtRef.current = now;
    setShake(null);
    const raf = requestAnimationFrame(() => setShake(impulse.kind === "win" ? "win" : "lose"));
    return () => cancelAnimationFrame(raf);
  }, [impulse]);

  return (
    <motion.div
      animate={isPulling ? { scale: [1.2, 1.215, 1.2], x: [0, ropePos < 50 ? -5 : 5, 0] } : { scale: 1.2, x: 0 }}
      transition={{ repeat: isPulling ? Infinity : 0, duration: 0.58 }}
      className="tug-idle-float relative mx-auto w-full max-w-5xl origin-center drop-shadow-[0_24px_22px_rgba(0,0,0,0.45)]"
    >
      <div className={shake === "win" ? "tug-shake-win" : shake === "lose" ? "tug-shake-lose" : undefined}>
        <CartoonTugScene
          ropePos={ropePos}
          isPulling={isPulling}
          isUrgent={isUrgent}
          isCelebrating={isCelebrating}
          winnerSide={winnerSide}
          impulse={impulse}
          intro={intro}
          brace={brace}
        />
      </div>
      {/* ── Cloth ribbon marker: two slim fabric tails hanging from the rope centre ──
          Hidden during the pre-match show (no rope on the field yet). */}
      <motion.div
        className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
        style={{
          top: "64%", transformOrigin: "center top",
          opacity: intro === "waiting" ? 0 : 1,
          transition: intro === "run" ? "opacity 0.4s ease 1.25s" : "opacity 0.3s ease",
        }}
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
  // Leading team = whichever fill is larger. Drives a soft directional glow so
  // the bar communicates who currently controls the rope.
  const leader: "blue" | "red" | null = pos < 48 ? "blue" : pos > 52 ? "red" : null;
  const leadStrength = Math.min(1, Math.abs(pos - 50) / 35);
  return (
    <div className="relative mx-auto w-full max-w-3xl px-2">
      {/* Directional control glow for the leading team */}
      {leader && (
        <motion.div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 w-1/3 rounded-[1.2rem] blur-xl ${leader === "blue" ? "left-0" : "right-0"}`}
          animate={{ opacity: [0.25 + leadStrength * 0.2, 0.45 + leadStrength * 0.3, 0.25 + leadStrength * 0.2] }}
          transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          style={{ background: leader === "blue" ? "rgba(59,130,246,0.55)" : "rgba(239,68,68,0.55)" }}
        />
      )}
      <div
        className="relative h-8 sm:h-10 lg:h-12 rounded-[1.2rem] border border-white/25 bg-black/35 p-1 sm:p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        style={{
          boxShadow: leader === "blue"
            ? "0 18px 50px rgba(0,0,0,0.38), 0 0 22px rgba(59,130,246,0.35), inset 0 2px 8px rgba(255,255,255,0.12), inset 0 -10px 18px rgba(0,0,0,0.3)"
            : leader === "red"
              ? "0 18px 50px rgba(0,0,0,0.38), 0 0 22px rgba(239,68,68,0.35), inset 0 2px 8px rgba(255,255,255,0.12), inset 0 -10px 18px rgba(0,0,0,0.3)"
              : "0 18px 50px rgba(0,0,0,0.38), inset 0 2px 8px rgba(255,255,255,0.12), inset 0 -10px 18px rgba(0,0,0,0.3)",
          transition: "box-shadow 0.55s ease",
        }}
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
  impulse,
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
  impulse: TugImpulse | null;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-b-[2rem] border-b border-white/10 px-3 pb-1 sm:pb-2 pt-1 shadow-[0_18px_56px_rgba(0,0,0,0.32)] sm:px-5">
      <StadiumBackdrop active={isPulling} />
      {/* On finish, fade the lower field into the page so the eye is pulled down
          to the results card — the celebration above still shows through. */}
      {isCelebrating && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2"
          style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(13,27,62,0.55) 70%, rgba(13,27,62,0.9) 100%)" }}
        />
      )}
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="min-h-[185px] sm:min-h-[290px] lg:min-h-[360px]">
          <TugCharacters
            ropePos={ropePos}
            isPulling={isPulling}
            isUrgent={isUrgent}
            isCelebrating={isCelebrating}
            winnerSide={winnerSide}
            impulse={impulse}
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

// ── Answer-grid styling shared by both modes (Kahoot shapes + وميض gradients) ──
export const KAHOOT_SHAPES = ["▲", "◆", "●", "■"];
// Same gradients as وميض game (play.tsx OPTION_COLORS)
export const WAMID_GRADIENT = [
  "linear-gradient(160deg, #7A0A0A, #B01414)",  // A — أحمر
  "linear-gradient(160deg, #08386E, #1260A8)",  // B — أزرق
  "linear-gradient(160deg, #B8860B, #DAA520)",  // C — ذهبي
  "linear-gradient(160deg, #5A1A8A, #8B35C8)",  // D — بنفسجي
];
export const WAMID_BORDER = ["#7A0A0A", "#08386E", "#B8860B", "#5A1A8A"];

export {
  TugSoundEngine, MUSIC_STYLES, Confetti, PowerPullFlash, CountdownOverlay,
  TimerRing, StadiumBackdrop, TugCharacters, TugPowerMeter, TeamScoreCard, TugArena,
};
export type { QuestionData, MusicStyle, TugImpulse };
