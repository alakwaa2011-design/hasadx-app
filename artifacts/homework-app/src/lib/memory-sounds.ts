export class MemorySoundEngine {
  private ctx: AudioContext | null = null;
  private bgHandle: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem("memory-music-muted") === "1";
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

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem("memory-music-muted", m ? "1" : "0"); } catch (_) {}
    if (m) this.stopBackground();
  }

  startBackground() {
    if (this.started || this.muted) return;
    this.started = true;
    let step = 0;
    const scale = [262, 294, 330, 349, 392, 440, 494, 523];

    const playBeat = () => {
      if (!this.started) return;
      try {
        const bpm = 90;
        const beat = 60 / bpm;
        const b = step % 8;
        const bar = Math.floor(step / 8);

        if (b % 4 === 0) {
          this.tone(131, 0.3, "sine", 0.06);
        }

        const mi = (bar * 3 + b) % scale.length;
        if (b % 2 === 0) {
          this.tone(scale[mi], beat * 0.4, "triangle", 0.03);
        }
        if (b === 2 || b === 6) {
          this.tone(scale[(mi + 2) % scale.length], beat * 0.3, "sine", 0.02, beat * 0.25);
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

  playFlip() {
    if (this.muted) return;
    this.tone(800, 0.06, "sine", 0.15);
    this.tone(1200, 0.04, "sine", 0.08, 0.03);
  }

  playMatch() {
    if (this.muted) return;
    this.tone(523, 0.08, "sine", 0.2);
    this.tone(659, 0.08, "sine", 0.2, 0.06);
    this.tone(784, 0.1, "sine", 0.22, 0.12);
    this.tone(1047, 0.15, "sine", 0.18, 0.18);
  }

  playMismatch() {
    if (this.muted) return;
    this.tone(300, 0.12, "triangle", 0.08);
    this.tone(260, 0.15, "triangle", 0.06, 0.1);
  }

  playStreak() {
    if (this.muted) return;
    const notes = [523, 587, 659, 784, 880, 1047];
    notes.forEach((n, i) => {
      this.tone(n, 0.06, "sine", 0.14, i * 0.04);
    });
  }

  playLevelUp() {
    if (this.muted) return;
    this.tone(523, 0.08, "sine", 0.2);
    this.tone(659, 0.08, "sine", 0.2, 0.06);
    this.tone(784, 0.08, "sine", 0.2, 0.12);
    this.tone(1047, 0.1, "sine", 0.25, 0.18);
    this.tone(1319, 0.14, "sine", 0.2, 0.25);
    this.tone(1568, 0.18, "sine", 0.15, 0.33);
  }

  playGameOver() {
    if (this.muted) return;
    this.stopBackground();
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => {
      this.tone(n, 0.2, "sine", 0.18, i * 0.15);
    });
    this.tone(262, 0.5, "triangle", 0.1, 0.15 * notes.length);
  }

  playCountdown() {
    if (this.muted) return;
    this.tone(440, 0.12, "sine", 0.16);
  }

  destroy() {
    this.stopBackground();
    if (this.ctx) {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }
}

export const memorySound = new MemorySoundEngine();
