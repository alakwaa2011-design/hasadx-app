type MusicStyle = "adventure" | "quiz" | "intense";

export class FlagSoundEngine {
  private ctx: AudioContext | null = null;
  private started = false;
  private bgHandle: ReturnType<typeof setTimeout> | null = null;
  muted = false;
  musicStyle: MusicStyle = "quiz";

  constructor() {
    try {
      this.muted = localStorage.getItem("flag-music-muted") === "1";
    } catch (_) {}
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  }

  private noise(dur: number, vol: number, delay = 0) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;
      src.connect(hp);
      hp.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(vol, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.start(ctx.currentTime + delay);
      src.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (_) {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem("flag-music-muted", m ? "1" : "0");
    } catch (_) {}
    if (m) this.stopBackground();
  }

  startBackground() {
    if (this.started || this.muted) return;
    this.started = true;
    let step = 0;
    const scale = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];

    const playBeat = () => {
      if (!this.started) return;
      try {
        const bpm = 140;
        const beat = 60 / bpm;
        const b = step % 8;
        const bar = Math.floor(step / 8);

        if (b % 2 === 0) {
          this.tone(82, 0.15, "sine", 0.18);
          this.tone(41, 0.2, "sine", 0.12, 0.02);
        }
        this.noise(0.025, b % 2 === 1 ? 0.08 : 0.04);
        if (b % 4 === 2) this.noise(0.04, 0.1);

        const bassNotes = [131, 165, 147, 175];
        this.tone(bassNotes[bar % 4], beat * 0.5, "sawtooth", 0.1);

        const mi = (bar * 3 + b) % scale.length;
        const note = scale[mi];
        if (b % 2 === 0) {
          this.tone(note * 2, beat * 0.4, "square", 0.05);
        }
        if (b === 0 || b === 4) {
          this.tone(scale[(mi + 2) % scale.length] * 2, beat * 0.3, "triangle", 0.06, beat * 0.5);
        }

        step++;
        this.bgHandle = setTimeout(playBeat, beat * 1000);
      } catch (_) {}
    };
    playBeat();
  }

  stopBackground() {
    this.started = false;
    if (this.bgHandle) {
      clearTimeout(this.bgHandle);
      this.bgHandle = null;
    }
  }

  playCorrect() {
    if (this.muted) return;
    this.tone(523, 0.12, "sine", 0.2);
    this.tone(659, 0.12, "sine", 0.2, 0.08);
    this.tone(784, 0.15, "sine", 0.22, 0.16);
    this.tone(1047, 0.2, "sine", 0.18, 0.24);
  }

  playWrong() {
    if (this.muted) return;
    this.tone(300, 0.2, "sawtooth", 0.15);
    this.tone(250, 0.25, "sawtooth", 0.12, 0.15);
    this.tone(200, 0.35, "sawtooth", 0.1, 0.3);
  }

  playStreak() {
    if (this.muted) return;
    this.tone(523, 0.08, "sine", 0.2);
    this.tone(659, 0.08, "sine", 0.2, 0.06);
    this.tone(784, 0.08, "sine", 0.2, 0.12);
    this.tone(1047, 0.12, "sine", 0.25, 0.18);
    this.tone(1319, 0.15, "sine", 0.2, 0.26);
  }

  playCountdown() {
    if (this.muted) return;
    this.tone(440, 0.15, "sine", 0.18);
  }

  playGameOver() {
    if (this.muted) return;
    this.stopBackground();
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => {
      this.tone(n, 0.2, "sine", 0.2, i * 0.15);
    });
    this.tone(262, 0.4, "triangle", 0.12, 0.15 * notes.length);
    this.tone(131, 0.5, "sine", 0.1, 0.15 * notes.length + 0.1);
  }

  playTick() {
    if (this.muted) return;
    this.tone(1200, 0.05, "sine", 0.08);
  }

  playJoin() {
    if (this.muted) return;
    this.tone(440, 0.1, "sine", 0.15);
    this.tone(554, 0.1, "sine", 0.15, 0.08);
    this.tone(659, 0.12, "sine", 0.18, 0.16);
  }

  destroy() {
    this.stopBackground();
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }
}

export const flagSound = new FlagSoundEngine();
