import { useRef, useCallback, useEffect, useState } from "react";

export function useTeamGameAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bgSchedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgGainRef = useRef<GainNode | null>(null);
  const bgRunningRef = useRef(false);
  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickingRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  function getCtx(): AudioContext {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
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

  const stopBg = useCallback(() => {
    bgRunningRef.current = false;
    if (bgSchedulerRef.current) { clearTimeout(bgSchedulerRef.current); bgSchedulerRef.current = null; }
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

      bgSchedulerRef.current = setTimeout(() => {
        if (bgRunningRef.current) scheduleLoop();
      }, bar * 1000 - 60);
    }
    scheduleLoop();
  }, []);

  const stopTickTock = useCallback(() => {
    tickingRef.current = false;
    if (tickTimeoutRef.current) { clearTimeout(tickTimeoutRef.current); tickTimeoutRef.current = null; }
  }, []);

  const startTickTock = useCallback((remainingSeconds: number) => {
    if (tickingRef.current) return;
    tickingRef.current = true;
    const ctx = getCtx();

    const totalSeconds = Math.max(1, remainingSeconds);
    let elapsed = 0;

    function tickOnce() {
      if (!tickingRef.current || mutedRef.current) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = elapsed % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.09);
    }

    function schedule() {
      if (!tickingRef.current) return;
      tickOnce();
      elapsed++;
      const progress = Math.min(elapsed / totalSeconds, 1);
      const delay = Math.round(1000 - progress * 500);
      tickTimeoutRef.current = setTimeout(schedule, delay);
    }

    schedule();
  }, [stopTickTock]);

  function note(ctx: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  const playCorrect = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      note(ctx, freq, t + i * 0.1, 0.4, 0.28, i < 3 ? "triangle" : "sine");
    });
  }, []);

  const playWrong = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [440, 370, 311, 261].forEach((freq, i) => {
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

  const playCelebration = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 880, 1046.5, 880, 783.99, 1046.5, 1318.5, 1568].forEach((freq, i) => {
      note(ctx, freq, t + i * 0.13, 0.55, 0.3, i % 2 === 0 ? "triangle" : "sine");
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

  const playVote = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.05);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.15);
  }, []);

  const playLifeline = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [440, 550, 660, 880].forEach((freq, i) => {
      note(ctx, freq, t + i * 0.1, 0.3, 0.2);
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

  const playSuspense = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].forEach((delay, i) => {
      note(ctx, 330 + i * 22, t + delay, 0.22, 0.18);
    });
  }, []);

  useEffect(() => {
    return () => {
      bgRunningRef.current = false;
      tickingRef.current = false;
      if (bgSchedulerRef.current) clearTimeout(bgSchedulerRef.current);
      if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current);
      if (ctxRef.current) void ctxRef.current.close();
    };
  }, []);

  return {
    muted,
    toggleMute,
    startBg,
    stopBg,
    playCorrect,
    playWrong,
    playCelebration,
    playVote,
    playLifeline,
    playFiftyFifty,
    playSuspense,
    startTickTock,
    stopTickTock,
  };
}
