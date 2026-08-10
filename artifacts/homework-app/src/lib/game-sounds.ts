let audioCtx: AudioContext | null = null;
let bgOscillators: OscillatorNode[] = [];
let bgGains: GainNode[] = [];
let masterGain: GainNode | null = null;
let isMuted = false;
const HACK_MUSIC_MUTED_KEY = "hack_music_muted";
let isHackMusicMuted = (() => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(HACK_MUSIC_MUTED_KEY) === "1";
  } catch { return false; }
})();
let isPlaying = false;
let beatInterval: ReturnType<typeof setInterval> | null = null;

let engineOsc1: OscillatorNode | null = null;
let engineOsc2: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function getMaster(): GainNode {
  const ctx = getCtx();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.3;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

export function startEngineSound() {
  if (engineOsc1) return;
  try {
    const ctx = getCtx();
    const master = getMaster();

    engineGain = ctx.createGain();
    engineGain.gain.value = isMuted ? 0 : 0.06;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 500;

    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = "sawtooth";
    engineOsc1.frequency.value = 58;
    engineOsc1.connect(engineFilter);

    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = "square";
    engineOsc2.frequency.value = 116;
    engineOsc2.connect(engineFilter);

    engineFilter.connect(engineGain);
    engineGain.connect(master);

    engineOsc1.start();
    engineOsc2.start();
  } catch {}
}

export function updateEnginePitch(speed: number, maxSpeed: number) {
  if (!engineOsc1 || !engineOsc2 || !engineGain || isMuted) return;
  try {
    const ctx = getCtx();
    const ratio = Math.min(speed / maxSpeed, 1);
    const freq1 = 55 + ratio * 250;
    const freq2 = freq1 * 2.03;
    const vol = 0.04 + ratio * 0.09;
    engineOsc1.frequency.setTargetAtTime(freq1, ctx.currentTime, 0.08);
    engineOsc2.frequency.setTargetAtTime(freq2, ctx.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.08);
  } catch {}
}

export function stopEngineSound() {
  try {
    engineOsc1?.stop();
    engineOsc2?.stop();
  } catch {}
  engineOsc1 = null;
  engineOsc2 = null;
  engineGain = null;
  engineFilter = null;
}

export function playLaunchSound() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(master);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 1.0);
    g.gain.setValueAtTime(0.0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.18, ctx.currentTime + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.25);

    const bufSize = ctx.sampleRate * 0.6;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    src.connect(ng);
    ng.connect(master);
    ng.gain.value = 0.18;
    src.start(ctx.currentTime);
  } catch {}
}

export function playNitroSound() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(master);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2);
    g2.connect(master);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.4);
    g2.gain.setValueAtTime(0.0, ctx.currentTime + 0.1);
    g2.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.65);
  } catch {}
}

export function playCorrectSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  osc.type = "sine";
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
}

/**
 * Solo challenge end — a brief, gentle 3-note ascending chime (~1.1s).
 * Soft enough not to startle, clear enough to feel like a reward.
 */
export function playSoloVictory() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.38 }, // C5
      { freq: 659.25, time: 0.28, dur: 0.38 }, // E5
      { freq: 783.99, time: 0.56, dur: 0.55 }, // G5
    ];
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + time;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.025);
      gain.gain.setValueAtTime(0.18, t + dur - 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });
  } catch {/* AudioContext blocked or unavailable */}
}

export function playWrongSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

export function playGiftSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

export function playTickSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

// Low, urgent "danger" alert — used in hack mode in the final 30s
// to signal that time is running out. `urgent=true` plays a higher,
// more piercing variant for the last 10 seconds.
export function playHackDanger(urgent: boolean = false) {
  if (isMuted) return;
  if (isHackMusicMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const t = ctx.currentTime;

  // Low square-wave alarm tone with a quick descending pitch
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  osc.type = "square";
  const startFreq = urgent ? 440 : 280;
  const endFreq = urgent ? 330 : 200;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);
  const peak = urgent ? 0.22 : 0.16;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
  osc.start(t);
  osc.stop(t + 0.2);

  // Sub-bass thump for "danger" feel
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.connect(subGain);
  subGain.connect(master);
  sub.type = "sine";
  sub.frequency.setValueAtTime(90, t);
  sub.frequency.exponentialRampToValueAtTime(50, t + 0.15);
  subGain.gain.setValueAtTime(0.18, t);
  subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
  sub.start(t);
  sub.stop(t + 0.2);
}

export function playStealSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  osc.type = "square";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.35);
}

export function playVictoryFanfare() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;

    // Warm sine note with smooth attack/release — no harsh edges
    function note(freq: number, t: number, dur: number, vol: number, type: OscillatorType = "sine") {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 80; // cut sub-bass to avoid boom
        osc.connect(hp); hp.connect(gain); gain.connect(master);
        osc.type = type;
        osc.frequency.value = freq;
        const at = now + t;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(vol, at + 0.03);
        gain.gain.setValueAtTime(vol, at + Math.max(dur - 0.10, 0.02));
        gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
        osc.start(at); osc.stop(at + dur + 0.03);
      } catch {}
    }

    function chord(freqs: number[], t: number, dur: number, vol: number, type: OscillatorType = "sine") {
      freqs.forEach(f => note(f, t, dur, vol, type));
    }

    // Light sparkle tick — replaces all heavy drums
    function tick(t: number, vol = 0.10) {
      try {
        const bufSize = Math.ceil(ctx.sampleRate * 0.04);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++)
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 5);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 3500; bp.Q.value = 1.0;
        const g = ctx.createGain();
        src.connect(bp); bp.connect(g); g.connect(master);
        g.gain.setValueAtTime(vol, now + t);
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.05);
        src.start(now + t); src.stop(now + t + 0.06);
      } catch {}
    }

    // ── Warm "results reveal" chime (~3s total) ─────────────────────────
    // Design goals: celebratory but gentle — a soft rising phrase that
    // settles into a warm major-chord swell, finished with two quiet bells.
    // No drums, no long cascades, everything fades naturally.

    // Phase 1 (0 – 0.75s): gentle 3-note pickup — G4 → C5 → E5
    note(392, 0.00, 0.24, 0.16, "sine");   // G4
    note(523, 0.24, 0.24, 0.18, "sine");   // C5
    note(659, 0.48, 0.30, 0.20, "sine");   // E5
    // soft octave glow under the pickup
    note(196, 0.00, 0.78, 0.06, "triangle");

    tick(0.24, 0.05); tick(0.48, 0.06);

    // Phase 2 (0.78 – 2.6s): warm C-major swell — slow attack, long release
    function swell(freq: number, t: number, dur: number, vol: number, type: OscillatorType) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 2400; // round off any edge
        osc.connect(lp); lp.connect(gain); gain.connect(master);
        osc.type = type;
        osc.frequency.value = freq;
        const at = now + t;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(vol, at + 0.28);        // slow, soft attack
        gain.gain.setValueAtTime(vol, at + dur * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.001, at + dur);  // long natural fade
        osc.start(at); osc.stop(at + dur + 0.05);
      } catch {}
    }
    swell(262, 0.78, 1.9, 0.09, "triangle"); // C4
    swell(330, 0.78, 1.9, 0.08, "triangle"); // E4
    swell(392, 0.78, 1.9, 0.08, "triangle"); // G4
    swell(523, 0.78, 1.9, 0.10, "sine");     // C5
    swell(784, 0.82, 1.7, 0.05, "sine");     // G5 shimmer, slightly delayed

    // Melody resolution riding softly on the swell: E5 → G5 → C6 (held)
    note(659,  0.86, 0.24, 0.16, "sine");
    note(784,  1.12, 0.24, 0.16, "sine");
    note(1047, 1.38, 1.10, 0.17, "sine"); // C6 — gentle held finish

    // Phase 3: two quiet celebratory bells, well-spaced, low volume
    note(1568, 1.42, 0.35, 0.045, "sine"); // G6
    note(2093, 1.75, 0.45, 0.035, "sine"); // C7
  } catch {}
}

export function playHackerVictory() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const now = ctx.currentTime;

  function tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType = "square") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.type = type;
    osc.frequency.value = freq;
    const at = now + t;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.01);
    gain.gain.setValueAtTime(vol, at + dur - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function blip(t: number, freq: number, dur = 0.045, vol = 0.18) {
    tone(freq, t, dur, vol, "square");
  }

  function dataChirp(t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(master);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, now + t);
    osc.frequency.exponentialRampToValueAtTime(2400, now + t + 0.18);
    gain.gain.setValueAtTime(0, now + t);
    gain.gain.linearRampToValueAtTime(0.14, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2);
    osc.start(now + t);
    osc.stop(now + t + 0.22);
  }

  // Phase 1 (0 - 0.6s): rapid "decoding" data blips, pleasant ascending pattern
  const decodeSeq = [880, 988, 1109, 988, 1175, 1319, 1175, 1397];
  decodeSeq.forEach((f, i) => blip(i * 0.07, f, 0.05, 0.16));

  // Phase 2 (0.6 - 1.4s): "ACCESS GRANTED" arpeggio — major chord rolling up
  const arpeggio = [523, 659, 784, 1047, 1319, 1568];
  arpeggio.forEach((f, i) => tone(f, 0.65 + i * 0.08, 0.18, 0.22, "triangle"));

  // Phase 3 (1.4 - 2.4s): triumphant sustained chord with synth pad feel
  const padChord = [523, 659, 784, 1047];
  padChord.forEach(f => tone(f, 1.45, 0.95, 0.16, "triangle"));
  padChord.forEach(f => tone(f / 2, 1.45, 0.95, 0.1, "sine"));

  // Phase 4 (2.4 - 3.2s): celebratory data-stream cascade + final chime
  for (let i = 0; i < 12; i++) {
    blip(2.45 + i * 0.05, 1500 + Math.random() * 1200, 0.035, 0.1);
  }
  dataChirp(2.5);
  dataChirp(2.75);
  dataChirp(3.0);

  // Final "chime"
  tone(2093, 3.05, 0.5, 0.22, "triangle");
  tone(2637, 3.05, 0.5, 0.18, "sine");
  tone(1568, 3.05, 0.6, 0.14, "triangle");
}

export function playHackerAccessGranted() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const now = ctx.currentTime;

  // Short modem-handshake style ascent then a confirmation tone
  const seq = [
    { f: 660, t: 0.0, d: 0.08 },
    { f: 880, t: 0.09, d: 0.08 },
    { f: 1175, t: 0.18, d: 0.08 },
    { f: 1568, t: 0.27, d: 0.18 },
  ];
  seq.forEach(({ f, t, d }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 3200;
    osc.connect(filt); filt.connect(g); g.connect(master);
    osc.type = "square"; osc.frequency.value = f;
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.16, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + d);
    osc.start(now + t); osc.stop(now + t + d + 0.02);
  });
}

export function playClapSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();

  for (let i = 0; i < 8; i++) {
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufferSize, 3);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000 + Math.random() * 2000;
    const gain = ctx.createGain();
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    const t = ctx.currentTime + i * 0.25 + Math.random() * 0.05;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    source.start(t);
    source.stop(t + 0.1);
  }
}

export function playFireworkSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();

  for (let i = 0; i < 5; i++) {
    const t = ctx.currentTime + i * 0.6 + Math.random() * 0.3;

    const riseOsc = ctx.createOscillator();
    const riseGain = ctx.createGain();
    riseOsc.connect(riseGain);
    riseGain.connect(master);
    riseOsc.type = "sine";
    riseOsc.frequency.setValueAtTime(300, t);
    riseOsc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    riseGain.gain.setValueAtTime(0.1, t);
    riseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    riseOsc.start(t);
    riseOsc.stop(t + 0.35);

    const bufSize = ctx.sampleRate * 0.15;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let j = 0; j < bufSize; j++) {
      ch[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 2000 + Math.random() * 3000;
    bpf.Q.value = 0.5;
    const g = ctx.createGain();
    src.connect(bpf);
    bpf.connect(g);
    g.connect(master);
    const popT = t + 0.3;
    g.gain.setValueAtTime(0.25, popT);
    g.gain.exponentialRampToValueAtTime(0.01, popT + 0.15);
    src.start(popT);
    src.stop(popT + 0.2);
  }
}

export function playGameStartSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();

  const notes = [
    { freq: 392, time: 0, dur: 0.12 },
    { freq: 440, time: 0.12, dur: 0.12 },
    { freq: 523, time: 0.24, dur: 0.12 },
    { freq: 659, time: 0.36, dur: 0.12 },
    { freq: 784, time: 0.48, dur: 0.2 },
    { freq: 1047, time: 0.7, dur: 0.35 },
  ];
  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + time;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.setValueAtTime(0.35, t + dur - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  });

  [523, 659, 784].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = ctx.currentTime + 1.1;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
    gain.gain.setValueAtTime(0.15, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
    osc.start(t);
    osc.stop(t + 0.85);
  });
}

export function playTimeUpSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(master);
  osc1.type = "square";
  osc1.frequency.setValueAtTime(880, ctx.currentTime);
  osc1.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
  osc1.frequency.setValueAtTime(440, ctx.currentTime + 0.3);
  gain1.gain.setValueAtTime(0.2, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.5);

  const bufSize = ctx.sampleRate * 0.1;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  src.connect(g);
  g.connect(master);
  const t2 = ctx.currentTime + 0.35;
  g.gain.setValueAtTime(0.15, t2);
  g.gain.exponentialRampToValueAtTime(0.01, t2 + 0.15);
  src.start(t2);
  src.stop(t2 + 0.2);
}

export function startBackgroundBeat() {
  if (isPlaying) return;
  isPlaying = true;
  const ctx = getCtx();
  const master = getMaster();

  let beatCount = 0;
  const bpm = 128;
  const interval = (60 / bpm) * 1000;

  function playBeat() {
    if (!isPlaying || isMuted) return;
    const ctx2 = getCtx();
    const t = ctx2.currentTime;

    const kick = ctx2.createOscillator();
    const kickGain = ctx2.createGain();
    kick.connect(kickGain);
    kickGain.connect(master);
    kick.type = "sine";
    kick.frequency.setValueAtTime(150, t);
    kick.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    kickGain.gain.setValueAtTime(0.3, t);
    kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    kick.start(t);
    kick.stop(t + 0.15);

    if (beatCount % 2 === 1) {
      const hi = ctx2.createOscillator();
      const hiGain = ctx2.createGain();
      hi.connect(hiGain);
      hiGain.connect(master);
      hi.type = "square";
      hi.frequency.value = 800 + Math.random() * 200;
      hiGain.gain.setValueAtTime(0.08, t);
      hiGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      hi.start(t);
      hi.stop(t + 0.05);
    }

    if (beatCount % 4 === 0) {
      const bass = ctx2.createOscillator();
      const bassGain = ctx2.createGain();
      bass.connect(bassGain);
      bassGain.connect(master);
      bass.type = "sine";
      const bassNotes = [65, 82, 73, 98];
      bass.frequency.value = bassNotes[Math.floor(beatCount / 4) % bassNotes.length];
      bassGain.gain.setValueAtTime(0.15, t);
      bassGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      bass.start(t);
      bass.stop(t + 0.35);
    }

    beatCount++;
  }

  playBeat();
  beatInterval = setInterval(playBeat, interval);
}

export function stopBackgroundBeat() {
  isPlaying = false;
  if (beatInterval) {
    clearInterval(beatInterval);
    beatInterval = null;
  }
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3;
  }
  if (engineGain) {
    engineGain.gain.value = isMuted ? 0 : 0.06;
  }
  return isMuted;
}

export function getIsMuted(): boolean {
  return isMuted;
}

export function toggleHackMusicMuted(): boolean {
  isHackMusicMuted = !isHackMusicMuted;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(HACK_MUSIC_MUTED_KEY, isHackMusicMuted ? "1" : "0");
    }
  } catch {}
  if (isHackMusicMuted) stopHackMarathonLoop();
  return isHackMusicMuted;
}

export function getIsHackMusicMuted(): boolean {
  return isHackMusicMuted;
}

export function playBoostSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(master);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  setTimeout(() => {
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(master);
    o2.type = "sine";
    o2.frequency.value = 1000;
    g2.gain.setValueAtTime(0.06, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o2.start();
    o2.stop(ctx.currentTime + 0.2);
  }, 200);
}

export function playHitSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const bufSize = ctx.sampleRate * 0.15;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  src.connect(g);
  g.connect(master);
  g.gain.value = 0.35;
  src.start();
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.connect(og);
  og.connect(master);
  osc.type = "sine";
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
  og.gain.setValueAtTime(0.2, ctx.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

export function playNotificationSound() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();

    const freqs = [880, 1108];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.setValueAtTime(0.18, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {}
}

export function playNotificationChime() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const notes = [1046.5, 880, 698.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.17;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.03);
      g.gain.setValueAtTime(0.22, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2);
      g2.connect(master);
      osc2.type = "triangle";
      osc2.frequency.value = freq * 2;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.06, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc2.start(t);
      osc2.stop(t + 0.35);
    });
  } catch {}
}

export function playNotificationBell() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const partials = [1, 2.756, 5.405, 8.458];
    const base = 523.25;
    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = base * ratio;
      const vol = [0.3, 0.12, 0.06, 0.03][i];
      const decay = [0.8, 0.5, 0.35, 0.2][i];
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + decay);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    });
  } catch {}
}

export function playNotificationBeep() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    [0, 0.18].forEach((delay) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "square";
      osc.frequency.value = 1000;
      const t = now + delay;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  } catch {}
}

export type NotificationSoundType = "ping" | "chime" | "bell" | "beep";

export function playNotificationSoundByType(type: NotificationSoundType) {
  switch (type) {
    case "chime": playNotificationChime(); break;
    case "bell": playNotificationBell(); break;
    case "beep": playNotificationBeep(); break;
    default: playNotificationSound(); break;
  }
}

export function playWorldTransitionSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(master);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 0.6);
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  osc.start();
  osc.stop(ctx.currentTime + 0.7);
  setTimeout(() => {
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(master);
    o2.type = "sine";
    o2.frequency.setValueAtTime(2500, ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.4);
    g2.gain.setValueAtTime(0.05, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o2.start();
    o2.stop(ctx.currentTime + 0.5);
  }, 300);
}

export function playLaneSwitchSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(master);
  osc.type = "sine";
  osc.frequency.value = 600;
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playGameOverSound() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  [400, 350, 280, 200].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(master);
    osc.type = "sawtooth";
    osc.frequency.value = f;
    const t = ctx.currentTime + i * 0.25;
    g.gain.setValueAtTime(0.15 - i * 0.03, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}

export function playEngineHum() {
  if (isMuted) return;
  const ctx = getCtx();
  const master = getMaster();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(master);
  osc.type = "sawtooth";
  osc.frequency.value = 65;
  g.gain.setValueAtTime(0.015, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

export function playCountdownBeep(n: 3 | 2 | 1) {
  try {
    const ctx = getCtx();
    const master = getMaster();

    const freq = n === 3 ? 440 : n === 2 ? 550 : 880;
    const duration = n === 1 ? 0.25 : 0.18;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(master);
    osc.type = "square";
    osc.frequency.value = freq;
    const vol = isMuted ? 0 : 0.4;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function playCountdownGo() {
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "square";
      osc.frequency.value = freq;
      const vol = isMuted ? 0 : 0.35;
      const t = now + i * 0.09;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {}
}

export function playPowerUpEarned() {
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      const vol = isMuted ? 0 : 0.3;
      const t = now + i * 0.1;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  } catch {}
}

export function playShieldActivate() {
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    [880, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "sine";
      osc.frequency.value = freq;
      const vol = isMuted ? 0 : 0.25;
      const t = now + i * 0.12;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {}
}

export function playHackerType() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const taps = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < taps; i++) {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "square";
      osc.frequency.value = 200 + Math.random() * 300;
      const vol = isMuted ? 0 : 0.12;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.start(t); osc.stop(t + 0.04);
    }
  } catch {}
}

export function playHackSuccess() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const notes = [330, 415, 523, 659, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "square";
      osc.frequency.value = freq;
      const t = now + i * 0.07;
      const vol = isMuted ? 0 : 0.22;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
    });
  } catch {}
}

export function playHackFail() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const notes = [440, 330, 220, 150];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = now + i * 0.1;
      const vol = isMuted ? 0 : 0.2;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    });
  } catch {}
}

export function playBoxSelect() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(master);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
    const vol = isMuted ? 0 : 0.25;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now); osc.stop(now + 0.12);
  } catch {}
}

// ───── Mystery box reveal (صندوق المفاجآت يظهر) ─────────────────────────────
export function playMysteryBoxReveal() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;

    function note(freq: number, t: number, dur: number, vol: number) {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(master);
        osc.type = "sine";
        osc.frequency.value = freq;
        const at = now + t;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        osc.start(at); osc.stop(at + dur + 0.02);
      } catch {}
    }

    // Magical 4-note ascending shimmer: D5→F#5→A5→D6
    note(587,  0.00, 0.22, 0.28);
    note(740,  0.16, 0.22, 0.28);
    note(880,  0.32, 0.22, 0.30);
    note(1175, 0.50, 0.60, 0.32);

    // Soft harmony
    note(880,  0.50, 0.55, 0.10);
    note(1047, 0.50, 0.55, 0.08);

    // Sparkle bells
    [0.00, 0.16, 0.32, 0.50, 0.68].forEach(t => {
      note(2349 + Math.random() * 300, t, 0.18, 0.06);
      note(2793 + Math.random() * 200, t + 0.04, 0.14, 0.04);
    });
  } catch {}
}

// ───── Power-up button sounds (4 distinct tones) ─────────────────────────────

/** freeze 🥶 — icy descending tinkle */
export function playPowerUpFreeze() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const freqs = [1319, 1047, 880, 698]; // E6→C6→A5→F5
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "triangle";
      osc.frequency.value = f;
      const at = now + i * 0.11;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.24, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.20);
      osc.start(at); osc.stop(at + 0.22);
    });
    // Cold shimmer
    [0, 0.11, 0.22, 0.33].forEach(t => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "sine";
      osc.frequency.value = 2637 + Math.random() * 400;
      const at = now + t;
      g.gain.setValueAtTime(0.06, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
      osc.start(at); osc.stop(at + 0.14);
    });
  } catch {}
}

/** shield 🛡️ — solid protective thunk + metallic ring */
export function playPowerUpShield() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    // Firm mid thunk
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(master);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.15);
    g.gain.setValueAtTime(0.30, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    osc.start(now); osc.stop(now + 0.32);
    // Metallic ring above
    const ring = ctx.createOscillator();
    const rg = ctx.createGain();
    ring.connect(rg); rg.connect(master);
    ring.type = "sine";
    ring.frequency.value = 1760; // A6
    rg.gain.setValueAtTime(0, now + 0.05);
    rg.gain.linearRampToValueAtTime(0.18, now + 0.08);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    ring.start(now + 0.05); ring.stop(now + 0.57);
  } catch {}
}

/** mystery 🎁 — curious rising 3-note chime */
export function playPowerUpMystery() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    // G5→B5→D6 (G major triad ascending)
    [784, 988, 1175].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "sine";
      osc.frequency.value = f;
      const at = now + i * 0.14;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.26, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
      osc.start(at); osc.stop(at + 0.30);
    });
    // Soft sparkle at the top
    const sp = ctx.createOscillator();
    const sg = ctx.createGain();
    sp.connect(sg); sg.connect(master);
    sp.type = "sine"; sp.frequency.value = 2349;
    sg.gain.setValueAtTime(0, now + 0.42);
    sg.gain.linearRampToValueAtTime(0.08, now + 0.45);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    sp.start(now + 0.42); sp.stop(now + 0.67);
  } catch {}
}

/** steal 💰 — sneaky quick descending staccato */
export function playPowerUpSteal() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    // Quick playful descending: C6→A5→G5→E5
    [1047, 880, 784, 659].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = "sine";
      osc.frequency.value = f;
      const at = now + i * 0.09;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.22, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
      osc.start(at); osc.stop(at + 0.16);
    });
    // Sneaky low pluck accent
    const pluck = ctx.createOscillator();
    const pg = ctx.createGain();
    pluck.connect(pg); pg.connect(master);
    pluck.type = "triangle"; pluck.frequency.value = 330;
    pg.gain.setValueAtTime(0.18, now + 0.36);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    pluck.start(now + 0.36); pluck.stop(now + 0.57);
  } catch {}
}

// ===== Hack mode (energetic electro/synth) =====
let hackLoopIntervalId: ReturnType<typeof setInterval> | null = null;
let hackLoopGain: GainNode | null = null;
let hackLoopFilter: BiquadFilterNode | null = null;
let hackPadOsc: OscillatorNode | null = null;

export function playHackMarathonLoop() {
  if (isMuted) return;
  if (isHackMusicMuted) return;
  if (hackLoopIntervalId) return;
  try {
    const ctx = getCtx();
    const master = getMaster();

    // Sub bass / pad layer
    hackLoopGain = ctx.createGain();
    hackLoopGain.gain.value = 0.07;
    hackLoopFilter = ctx.createBiquadFilter();
    hackLoopFilter.type = "lowpass";
    hackLoopFilter.frequency.value = 1100;
    hackLoopFilter.Q.value = 6;
    hackPadOsc = ctx.createOscillator();
    hackPadOsc.type = "sawtooth";
    hackPadOsc.frequency.value = 55;
    hackPadOsc.connect(hackLoopFilter);
    hackLoopFilter.connect(hackLoopGain);
    hackLoopGain.connect(master);
    hackPadOsc.start();

    // Arp/beat sequence
    const root = 220; // A3
    const seq = [0, 7, 12, 7, 3, 10, 14, 10]; // semitones
    let step = 0;
    const stepMs = 200;

    hackLoopIntervalId = setInterval(() => {
      if (isMuted || isHackMusicMuted) return;
      try {
        const now = ctx.currentTime;
        const semis = seq[step % seq.length];
        const freq = root * Math.pow(2, semis / 12);
        // Pluck note
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(freq, now);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(2400, now);
        f.frequency.exponentialRampToValueAtTime(600, now + 0.18);
        o.connect(f); f.connect(g); g.connect(master);
        g.gain.setValueAtTime(0.0, now);
        g.gain.linearRampToValueAtTime(0.10, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        o.start(now); o.stop(now + 0.2);

        // Kick on every 4th step
        if (step % 4 === 0) {
          const ko = ctx.createOscillator();
          const kg = ctx.createGain();
          ko.type = "sine";
          ko.frequency.setValueAtTime(110, now);
          ko.frequency.exponentialRampToValueAtTime(40, now + 0.12);
          kg.gain.setValueAtTime(0.18, now);
          kg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          ko.connect(kg); kg.connect(master);
          ko.start(now); ko.stop(now + 0.2);
        }
        // (Noisy hi-hat removed to eliminate the "whisper" layer.)
        step++;
      } catch {}
    }, stepMs);
  } catch {}
}

export function stopHackMarathonLoop() {
  try {
    if (hackLoopIntervalId) { clearInterval(hackLoopIntervalId); hackLoopIntervalId = null; }
    if (hackPadOsc) { try { hackPadOsc.stop(); } catch {} hackPadOsc = null; }
    if (hackLoopGain) { try { hackLoopGain.disconnect(); } catch {} hackLoopGain = null; }
    if (hackLoopFilter) { try { hackLoopFilter.disconnect(); } catch {} hackLoopFilter = null; }
  } catch {}
}

export function playHackCorrectChime() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const notes = [880, 1320];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, now + i * 0.08);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, now + i * 0.08);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.08 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
      o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.25);
    });
  } catch {}
}

export function playHackWrongBuzz() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 800;
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.45);
    o.connect(f); f.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    o.start(now); o.stop(now + 0.55);
  } catch {}
}

export function playHackVictoryFanfare() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;
    // Major triad arpeggio + sustained pad
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093]; // C5..C7
    notes.forEach((f, i) => {
      const t = now + i * 0.13;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, t);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.42);
    });
    // Sustained pad
    const padO = ctx.createOscillator();
    const padG = ctx.createGain();
    padO.type = "sawtooth";
    padO.frequency.setValueAtTime(130.8, now); // C3
    padO.connect(padG); padG.connect(master);
    padG.gain.setValueAtTime(0, now);
    padG.gain.linearRampToValueAtTime(0.12, now + 0.3);
    padG.gain.setValueAtTime(0.12, now + 1.6);
    padG.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
    padO.start(now); padO.stop(now + 2.5);
  } catch {}
}

// Cheerful 8-bit / chiptune victory jingle — bright major arpeggio with
// sparkly bell overtones and a punchy bass. Used at the end of a hack-mode
// game instead of the older multi-layer hacker fanfares.
export function playCyberWinTune() {
  if (isMuted) return;
  try {
    const ctx = getCtx();
    const master = getMaster();
    const now = ctx.currentTime;

    // Lead melody: C E G C E G C — bright C-major run, then a sustained high C.
    const lead = [
      { f: 523.25, t: 0.00, d: 0.14 }, // C5
      { f: 659.25, t: 0.12, d: 0.14 }, // E5
      { f: 783.99, t: 0.24, d: 0.14 }, // G5
      { f: 1046.5, t: 0.36, d: 0.14 }, // C6
      { f: 1318.5, t: 0.48, d: 0.14 }, // E6
      { f: 1568.0, t: 0.60, d: 0.14 }, // G6
      { f: 2093.0, t: 0.72, d: 0.55 }, // C7 (held)
    ];
    lead.forEach(({ f, t, d }) => {
      const start = now + t;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, start);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.16, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, start + d);
      o.start(start); o.stop(start + d + 0.02);
    });

    // Bass plucks on root + fifth.
    [
      { f: 130.81, t: 0.00 }, // C3
      { f: 196.00, t: 0.36 }, // G3
      { f: 130.81, t: 0.72 }, // C3
    ].forEach(({ f, t }) => {
      const start = now + t;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, start);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      o.start(start); o.stop(start + 0.34);
    });

    // Sparkle: a couple of high bell notes on top of the held C7.
    [
      { f: 2637.0, t: 0.85 }, // E7
      { f: 3136.0, t: 1.00 }, // G7
      { f: 4186.0, t: 1.18 }, // C8
    ].forEach(({ f, t }) => {
      const start = now + t;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, start);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.10, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      o.start(start); o.stop(start + 0.52);
    });
  } catch {}
}

export function cleanupAudio() {
  stopBackgroundBeat();
  stopHackMarathonLoop();
  stopEngineSound();
  bgOscillators.forEach((o) => { try { o.stop(); } catch {} });
  bgOscillators = [];
  bgGains = [];
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    masterGain = null;
  }
}
