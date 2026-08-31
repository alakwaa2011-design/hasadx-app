import { useCallback, useEffect, useRef } from "react";

/**
 * Shared wheel audio used by the challenge wheel and the standalone
 * student-selection wheel. The tick interval follows the wheel's slowdown.
 */
export function useWheelAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getCtx = () => {
    if (!ctxRef.current && typeof window !== "undefined") {
      const audioWindow = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
      if (AudioContextConstructor) ctxRef.current = new AudioContextConstructor();
    }
    if (ctxRef.current?.state === "suspended" && enabled) {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const playTick = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }, [enabled]);

  const startTicking = useCallback((durationMs: number) => {
    if (!enabled) return;
    if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);

    let elapsed = 0;
    let interval = 80;
    const step = () => {
      playTick();
      elapsed += interval;
      interval = 80 + Math.min(1, elapsed / durationMs) * 200;
      if (elapsed < durationMs) {
        tickIntervalRef.current = setTimeout(step, interval);
      }
    };
    step();
  }, [enabled, playTick]);

  const stopTicking = useCallback(() => {
    if (tickIntervalRef.current) {
      clearTimeout(tickIntervalRef.current as unknown as number);
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const playWin = useCallback(() => {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const start = ctx.currentTime;
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = frequency;
      const time = start + index * 0.12;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.55);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) stopTicking();
    return () => {
      stopTicking();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [enabled, stopTicking]);

  return { startTicking, stopTicking, playWin };
}