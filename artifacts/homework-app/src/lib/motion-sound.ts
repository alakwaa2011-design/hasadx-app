/* Sound effects for presentation motion, synthesized in the browser (no audio files).
   The set mirrors the lesson videos' effect palette: soft pop, bell "ding", sparkle glints, paper swish,
   chalk scratch, zip, bonk and wind. Which one plays depends on what appears: a card with a star or a
   trophy sparkles, a book or a pencil swishes like paper, a warning bonks, chalk decks scratch, and plain
   text cards pop on a rising scale so consecutive cards sound different. Quiet by design. */

export type MotionSoundStyle = "calm" | "playful";
export type MotionSoundKind =
  | "pop" | "ding" | "glints" | "swish" | "chalk" | "zip" | "bonk" | "wind" | "slide" | "count";

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

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** C-major pentatonic ladder (MIDI) so consecutive cards climb pleasantly */
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88];

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, start: number, dur: number, peak: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function noiseBurst(
  c: AudioContext, start: number, dur: number, f0: number, f1: number, q: number, peak: number,
  shape: (u: number) => number = (u) => Math.sin(u * Math.PI),
) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.max(0, shape(i / len));
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = q;
  band.frequency.setValueAtTime(f0, start);
  band.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(band);
  band.connect(g);
  g.connect(c.destination);
  src.start(start);
}

/** A bell: a sine with inharmonic overtones, exponential decay. */
function bell(c: AudioContext, midi: number, start: number, peak: number, decay = 0.5) {
  const f = mtof(midi);
  [[1, 1], [2.756, 0.45], [5.404, 0.2]].forEach(([mult, amp]) => {
    tone(c, "sine", f * mult, f * mult * 0.998, start, decay, peak * amp);
  });
}

export function playMotionSound(kind: MotionSoundKind, style: MotionSoundStyle, degree = 0): void {
  const c = audio();
  if (!c) return;
  try {
    const now = c.currentTime;
    const pl = style === "playful";
    const v = pl ? 1 : 0.7; // calm is quieter
    const note = SCALE[Math.abs(degree) % SCALE.length];
    switch (kind) {
      case "pop":
        tone(c, "sine", mtof(note - 7), mtof(note + 5), now, 0.13, 0.1 * v);
        if (pl) tone(c, "triangle", mtof(note + 12), mtof(note + 17), now + 0.06, 0.12, 0.05);
        break;
      case "ding":
        bell(c, note + 12, now, 0.09 * v, pl ? 0.55 : 0.42);
        break;
      case "glints": {
        for (let i = 0; i < (pl ? 7 : 4); i++) {
          const f = 5200 + Math.random() * 3800;
          tone(c, "sine", f, f * 0.98, now + Math.random() * 0.3, 0.07, 0.035 * v);
        }
        bell(c, note + 12, now + 0.02, 0.05 * v, 0.35);
        break;
      }
      case "swish":
        noiseBurst(c, now, 0.28, 1800, 5200, 0.8, 0.06 * v);
        break;
      case "chalk":
        noiseBurst(c, now, 0.42, 3400, 4600, 1.6, 0.05 * v, (u) => Math.sin(u * Math.PI) * (0.55 + 0.45 * Math.sin(u * 0.42 * 2 * Math.PI * 22)));
        break;
      case "zip":
        noiseBurst(c, now, 0.22, 900, 4200, 2.4, 0.06 * v);
        break;
      case "bonk":
        tone(c, "sine", 210, 120, now, 0.32, 0.15 * v);
        noiseBurst(c, now, 0.08, 400, 120, 1, 0.07 * v);
        break;
      case "wind":
        noiseBurst(c, now, 0.7, 380, 620, 0.9, 0.05 * v, (u) => Math.pow(Math.sin(u * Math.PI), 1.5));
        break;
      case "slide":
        noiseBurst(c, now, 0.28, 380, pl ? 2200 : 1500, 1.2, (pl ? 0.07 : 0.045), (u) => 1 - u);
        break;
      case "count":
        for (let i = 0; i < 5; i++) tone(c, "triangle", 620 + i * 90, 700 + i * 90, now + i * 0.17, 0.07, pl ? 0.06 : 0.04);
        bell(c, 88, now + 0.95, 0.07 * v, 0.4);
        break;
    }
  } catch {
    /* sound is decoration; never block the presentation */
  }
}

/** Which effect fits a drawing (the name comes from the art key, e.g. "star", "book", "tap"). */
export function soundForArt(key: string | null | undefined): MotionSoundKind | null {
  const k = (key ?? "").toLowerCase();
  if (!k) return null;
  if (/^(star|medal|award|trophy|idea|check|crescent|moon|sun|lantern|heart|target|rainbow|flower)$/.test(k)) return "glints";
  if (/^(book|scroll|letters|pencil|quran|blackboard|history|calendar|mail|paperplane|chat|bubble|code|laptop)$/.test(k)) return "swish";
  if (/^(question|puzzle|calculator|plusminus|chart|arrowup|gear|bolt|rocket|plane|car|traffic)$/.test(k)) return "zip";
  if (/^(cross|handstop|battle|fort|lock|balance|volcano|flame)$/.test(k)) return "bonk";
  if (/^(drop|tap|cloud|wind|boat|fish|mountain|globe|map|compass|tree|leaf|sprout)$/.test(k)) return "wind";
  if (/^(bell|microphone|sound|music|beads|dates|kaaba|prayerrug|mosque|handshake)$/.test(k)) return "ding";
  return null;
}
