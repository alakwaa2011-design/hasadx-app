import { useRef, useCallback, useEffect, useState } from "react";

export function useGameAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgGainRef = useRef<GainNode | null>(null);
  const bgRunningRef = useRef(false);
  const tickIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  function getCtx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      if (bgGainRef.current && ctxRef.current) {
        bgGainRef.current.gain.setTargetAtTime(next ? 0 : 0.05, ctxRef.current.currentTime, 0.3);
      }
      return next;
    });
  }, []);

  function scheduleNote(ctx: AudioContext, masterGain: GainNode, freq: number, startTime: number, duration: number, volume: number, type: OscillatorType = "triangle") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.setValueAtTime(volume, startTime + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  const stopBg = useCallback(() => {
    bgRunningRef.current = false;
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (bgGainRef.current && ctxRef.current) {
      bgGainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.3);
    }
    setTimeout(() => { bgGainRef.current = null; }, 500);
  }, []);

  const startBg = useCallback(() => {
    if (bgRunningRef.current) return;
    bgRunningRef.current = true;
    const ctx = getCtx();

    const masterGain = ctx.createGain();
    masterGain.gain.value = mutedRef.current ? 0 : 0.06;
    masterGain.connect(ctx.destination);
    bgGainRef.current = masterGain;

    const BPM = 72;
    const beat = 60 / BPM;
    const bar = beat * 4;

    function drum(t: number, vol: number) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.26);
    }

    function arp(t: number, freq: number, vol: number) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.42);
    }

    function scheduleLoop() {
      if (!bgRunningRef.current) return;
      const now = ctx.currentTime + 0.05;

      drum(now, 0.75);
      drum(now + beat * 2, 0.55);

      const notes = [220, 247, 294, 330, 370, 415, 440, 494];
      notes.forEach((freq, i) => {
        arp(now + i * (beat / 2), freq, 0.14);
      });

      const accent = [523, 494, 440, 415];
      accent.forEach((freq, i) => {
        arp(now + beat * 2 + i * (beat / 2), freq, 0.1);
      });

      schedulerRef.current = setTimeout(() => {
        if (bgRunningRef.current) scheduleLoop();
      }, bar * 1000 - 60);
    }

    scheduleLoop();
  }, []);

  const stopTickTock = useCallback(() => {
    if (tickIntervalRef.current) {
      clearTimeout(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const startTickTock = useCallback((seconds: number) => {
    if (mutedRef.current) return;
    stopTickTock();
    const ctx = getCtx();
    const baseInterval = 1000;
    const minInterval = 300;
    const step = Math.max(0, (baseInterval - minInterval) / Math.max(1, seconds));

    let elapsed = 0;
    let currentInterval = baseInterval;

    function tick() {
      if (mutedRef.current) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = elapsed % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.1);
    }

    function schedule() {
      tick();
      elapsed++;
      currentInterval = Math.max(minInterval, baseInterval - step * elapsed);
      tickIntervalRef.current = setTimeout(schedule, currentInterval);
    }

    tickIntervalRef.current = setTimeout(schedule, 0);
  }, [stopTickTock]);

  const playSelect = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.18);
  }, []);

  const playSuspense = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 330 + i * 22;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.18, t + delay + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + delay); osc.stop(t + delay + 0.25);
    });
  }, []);

  const playCorrect = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i < 3 ? "triangle" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.28, t + i * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.45);
    });
  }, []);

  const playWrong = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const notes = [440, 370, 311, 261];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t + i * 0.16);
      osc.frequency.linearRampToValueAtTime(freq * 0.85, t + i * 0.16 + 0.15);
      gain.gain.setValueAtTime(0.22, t + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.16 + 0.38);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.16); osc.stop(t + i * 0.16 + 0.4);
    });
  }, []);

  const playPhoneRing = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    for (let ring = 0; ring < 3; ring++) {
      const rs = t + ring * 1.1;
      for (let pulse = 0; pulse < 2; pulse++) {
        const ps = rs + pulse * 0.35;
        [480, 620].forEach((freq, fi) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ps + fi * 0.01);
          gain.gain.linearRampToValueAtTime(0.15, ps + fi * 0.01 + 0.02);
          gain.gain.setValueAtTime(0.15, ps + fi * 0.01 + 0.28);
          gain.gain.exponentialRampToValueAtTime(0.001, ps + fi * 0.01 + 0.32);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(ps + fi * 0.01); osc.stop(ps + fi * 0.01 + 0.35);
        });
      }
    }
  }, []);

  const playAudience = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const bufSize = ctx.sampleRate * 1.8;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = 1400; filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.25);
    gain.gain.setValueAtTime(0.22, t + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(t); source.stop(t + 1.9);

    [0.05, 0.18, 0.35, 0.55, 0.75, 0.95].forEach(d => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600 + Math.random() * 600, t + d);
      osc.frequency.exponentialRampToValueAtTime(150, t + d + 0.07);
      g.gain.setValueAtTime(0.08, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.09);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + d); osc.stop(t + d + 0.1);
    });
  }, []);

  const playFiftyFifty = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.32);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.42);
  }, []);

  const playSafeHaven = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const chimes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1046.5];
    chimes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.13);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.13 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.7);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.13); osc.stop(t + i * 0.13 + 0.8);
    });
  }, []);

  const playMillion = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const fanfare = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 1046.5];
    fanfare.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i < 5 ? "triangle" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.7);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.8);
    });
    [0, 0.5, 1.0, 1.5, 2.0].forEach(d => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const bd = buf.getChannelData(0);
      for (let i = 0; i < bd.length; i++) bd[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.1);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(t + d); src.stop(t + d + 0.12);
    });
  }, []);

  const playWalkAway = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [392, 349.23, 293.66, 261.63].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.2 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.5);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.2); osc.stop(t + i * 0.2 + 0.55);
    });
  }, []);

  const playPickStudent = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const drumFreqs = [200, 180, 160, 140, 120];
    drumFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 2, t + i * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq, t + i * 0.06 + 0.05);
      gain.gain.setValueAtTime(0.2, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.12);
    });
    const finalOsc = ctx.createOscillator();
    const finalGain = ctx.createGain();
    finalOsc.type = "triangle";
    finalOsc.frequency.value = 880;
    finalGain.gain.setValueAtTime(0.001, t + 0.35);
    finalGain.gain.linearRampToValueAtTime(0.25, t + 0.4);
    finalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    finalOsc.connect(finalGain); finalGain.connect(ctx.destination);
    finalOsc.start(t + 0.35); finalOsc.stop(t + 0.75);
  }, []);

  const playCelebration = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 880, 1046.5, 880, 783.99, 1046.5, 1318.5, 1568];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.13);
      gain.gain.linearRampToValueAtTime(0.32, t + i * 0.13 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.55);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.13); osc.stop(t + i * 0.13 + 0.6);
    });
    for (let b = 0; b < 6; b++) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
      const bd = buf.getChannelData(0);
      for (let i = 0; i < bd.length; i++) bd[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 4000;
      const g = ctx.createGain();
      const offset = b * 0.25;
      g.gain.setValueAtTime(0.2, t + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start(t + offset); src.stop(t + offset + 0.1);
    }
  }, []);

  const playCountdownBeep = useCallback((second: number) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const freq = second <= 1 ? 1760 : second === 2 ? 1320 : second === 3 ? 1100 : second === 4 ? 880 : 660;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(second <= 2 ? 0.35 : 0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (second <= 1 ? 0.6 : 0.3));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + (second <= 1 ? 0.65 : 0.35));
  }, []);

  const playLifeline = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [440, 550, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.35);
    });
  }, []);

  useEffect(() => {
    return () => {
      bgRunningRef.current = false;
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
      if (ctxRef.current) void ctxRef.current.close();
    };
  }, []);

  return {
    muted,
    toggleMute,
    startBg,
    stopBg,
    playSelect,
    playSuspense,
    playCorrect,
    playWrong,
    playPhoneRing,
    playAudience,
    playFiftyFifty,
    playSafeHaven,
    playMillion,
    playWalkAway,
    playPickStudent,
    playCelebration,
    playLifeline,
    startTickTock,
    stopTickTock,
    playCountdownBeep,
  };
}
