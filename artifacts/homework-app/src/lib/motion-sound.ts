/* Small synthesized sound effects for presentation motion (no audio files): a soft pop when a card
   appears, a swoosh between slides, a rising tick while a number counts up. Quiet by design; the calm
   style uses fewer, lower notes than the playful one. Everything fails silently if audio is unavailable. */

export type MotionSoundKind = "reveal" | "slide" | "count";
export type MotionSoundStyle = "calm" | "playful";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, start: number, dur: number, peak: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playMotionSound(kind: MotionSoundKind, style: MotionSoundStyle): void {
  const c = audio();
  if (!c) return;
  try {
    const now = c.currentTime;
    const playful = style === "playful";
    if (kind === "reveal") {
      tone(c, "sine", playful ? 480 : 420, playful ? 820 : 640, now, 0.14, playful ? 0.11 : 0.07);
      if (playful) tone(c, "triangle", 880, 1320, now + 0.07, 0.16, 0.07);
    } else if (kind === "slide") {
      const len = Math.floor(c.sampleRate * 0.28);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const band = c.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.2;
      band.frequency.setValueAtTime(380, now);
      band.frequency.exponentialRampToValueAtTime(playful ? 2200 : 1500, now + 0.26);
      const g = c.createGain();
      g.gain.setValueAtTime(playful ? 0.07 : 0.045, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      src.connect(band);
      band.connect(g);
      g.connect(c.destination);
      src.start(now);
    } else {
      for (let i = 0; i < 5; i++) {
        tone(c, "triangle", 620 + i * 90, 700 + i * 90, now + i * 0.17, 0.07, playful ? 0.06 : 0.04);
      }
    }
  } catch {
    /* sound is decoration; never block the presentation */
  }
}
