import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { timerStore, TimerState } from "./timer-store";
import { playControlSound, playLapSound } from "./timer-sounds";

export type MilestoneType = "warning" | "tick";

export const MILESTONES: { sec: number; type: MilestoneType }[] = [
  { sec: 60, type: "warning" },
  { sec: 10, type: "warning" },
  { sec: 5, type: "tick" },
  { sec: 4, type: "tick" },
  { sec: 3, type: "tick" },
  { sec: 2, type: "tick" },
  { sec: 1, type: "tick" },
];

export function evaluateMilestones(
  remainingMs: number,
  targetMs: number,
  fired: Record<number, boolean>
) {
  const crossed: number[] = [];
  let soundToPlay: { sec: number; type: MilestoneType } | null = null;
  let minSec = Infinity;

  for (const m of MILESTONES) {
    if (targetMs >= m.sec * 1000 && remainingMs <= m.sec * 1000 && !fired[m.sec]) {
      crossed.push(m.sec);
      if (m.sec < minSec) {
        minSec = m.sec;
        soundToPlay = m;
      }
    }
  }

  return { crossed, soundToPlay };
}

export function useTimerState(): TimerState {
  return useSyncExternalStore(timerStore.subscribe, timerStore.getState);
}

export function calculateTimerStateCore(state: TimerState, now: number) {
  let elapsed = state.accumulatedMs;
  if (state.isRunning && state.startTimestamp) {
    elapsed += (now - state.startTimestamp);
  }

  let remainingMs = 0;
  let isOvertime = false;
  let isFinished = false;
  let hasCrossedZero = false;

  if (state.mode === "countdown") {
    const rawRemaining = state.targetMs - elapsed;
    
    if (elapsed >= state.targetMs) {
      hasCrossedZero = true; // Signal completion transition
    }

    if (rawRemaining <= 0) {
      if (state.overtimeEnabled) {
        isOvertime = true;
        remainingMs = Math.abs(rawRemaining); // Positive overtime display
      } else {
        remainingMs = 0;
        isFinished = true;
      }
    } else {
      remainingMs = rawRemaining;
    }
  }

  return { elapsed, remainingMs, isOvertime, isFinished, hasCrossedZero };
}

export function useTimerEngine() {
  const state = useTimerState();
  const [now, setNow] = useState(Date.now());

  // Use a requestAnimationFrame loop to update the current time when running
  useEffect(() => {
    if (!state.isRunning) return;
    let animationFrameId: number;
    const tick = () => {
      setNow(Date.now());
      animationFrameId = requestAnimationFrame(tick);
    };
    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [state.isRunning]);

  // Derived calculations
  const calculateElapsed = useCallback(() => {
    return calculateTimerStateCore(state, Date.now()).elapsed;
  }, [state]);

  const { elapsed: elapsedMs, remainingMs, isOvertime, isFinished, hasCrossedZero } = calculateTimerStateCore(state, now);

  // Auto-stop and handle completion if countdown finishes without overtime
  useEffect(() => {
    if (state.mode === "countdown" && state.isRunning && !state.overtimeEnabled) {
      const currentElapsed = calculateElapsed();
      if (currentElapsed >= state.targetMs) {
        timerStore.setState({
          isRunning: false,
          accumulatedMs: state.targetMs,
          startTimestamp: null
        });
      }
    }
  }, [state.mode, state.isRunning, state.overtimeEnabled, state.targetMs, calculateElapsed]);

  // Actions
  const start = useCallback(() => {
    if (state.isRunning) return;
    const currentElapsed = calculateElapsed();
    timerStore.setState({
      isRunning: true,
      startTimestamp: Date.now(),
      // Only clear completedHandled if we are actually starting a timer that hasn't finished yet
      ...(currentElapsed < state.targetMs ? { completedHandled: false } : {})
    });
    if (!state.soundMuted && state.soundControlsEnabled) {
      playControlSound("start", state.soundVolume);
    }
  }, [state.isRunning, state.targetMs, calculateElapsed, state.soundMuted, state.soundControlsEnabled, state.soundVolume]);

  const pause = useCallback(() => {
    if (!state.isRunning) return;
    const currentElapsed = calculateElapsed();
    timerStore.setState({
      isRunning: false,
      accumulatedMs: currentElapsed,
      startTimestamp: null
    });
    if (!state.soundMuted && state.soundControlsEnabled) {
      playControlSound("pause", state.soundVolume);
    }
  }, [state.isRunning, calculateElapsed, state.soundMuted, state.soundControlsEnabled, state.soundVolume]);

  const reset = useCallback(() => {
    timerStore.reset();
  }, []);

  const addTime = useCallback((ms: number) => {
    timerStore.setState((prev) => ({
      targetMs: prev.targetMs + ms,
      completedHandled: false,
      milestonesFired: {}
    }));
  }, []);

  const addLap = useCallback((name?: string) => {
    if (state.mode !== "stopwatch") return;
    const currentElapsed = calculateElapsed();
    timerStore.setState((prev) => {
      const lastLapMs = prev.laps.length > 0 ? prev.laps[0].totalMs : 0;
      const splitMs = currentElapsed - lastLapMs;
      const newLap = {
        id: Math.random().toString(36).substring(2, 9),
        name: name || `Lap ${prev.laps.length + 1}`,
        splitMs,
        totalMs: currentElapsed
      };
      return { laps: [newLap, ...prev.laps] };
    });
    if (!state.soundMuted && state.soundLapEnabled) {
      playLapSound(state.soundVolume);
    }
  }, [state.mode, calculateElapsed, state.soundMuted, state.soundLapEnabled, state.soundVolume]);

  const updateLapName = useCallback((id: string, name: string) => {
    timerStore.setState((prev) => ({
      laps: prev.laps.map(l => l.id === id ? { ...l, name } : l)
    }));
  }, []);

  const setMode = useCallback((mode: "countdown" | "stopwatch") => {
    timerStore.setState({ mode });
    reset();
  }, [reset]);

  const setTarget = useCallback((ms: number) => {
    timerStore.setState({ targetMs: ms, accumulatedMs: 0, completedHandled: false, milestonesFired: {} });
  }, []);

  const openTool = useCallback(() => {
    timerStore.setState({ isActive: true, isMinimized: false });
  }, []);

  const closeTool = useCallback(() => {
    timerStore.setState({ isActive: false, isRunning: false, studentDisplayActive: false });
  }, []);

  return {
    state,
    elapsedMs,
    remainingMs,
    isOvertime,
    isFinished,
    hasCrossedZero,
    start,
    pause,
    reset,
    addTime,
    addLap,
    updateLapName,
    setMode,
    setTarget,
    openTool,
    closeTool
  };
}
