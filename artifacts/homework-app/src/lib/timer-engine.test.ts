import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { timerStore, TimerState } from "./timer-store";
import { calculateTimerStateCore } from "./use-timer-engine";

describe("Timer Core Calculations", () => {
  it("should calculate countdown correctly before zero", () => {
    const state = {
      mode: "countdown", targetMs: 10000, accumulatedMs: 2000, isRunning: true, startTimestamp: 1000, overtimeEnabled: false
    } as TimerState;
    const { elapsed, remainingMs, isOvertime, isFinished, hasCrossedZero } = calculateTimerStateCore(state, 4000);
    // elapsed = 2000 + (4000 - 1000) = 5000
    // remaining = 10000 - 5000 = 5000
    expect(elapsed).toBe(5000);
    expect(remainingMs).toBe(5000);
    expect(isOvertime).toBe(false);
    expect(isFinished).toBe(false);
    expect(hasCrossedZero).toBe(false);
  });

  it("should handle countdown zero crossing without overtime", () => {
    const state = {
      mode: "countdown", targetMs: 10000, accumulatedMs: 0, isRunning: true, startTimestamp: 1000, overtimeEnabled: false
    } as TimerState;
    const { elapsed, remainingMs, isOvertime, isFinished, hasCrossedZero } = calculateTimerStateCore(state, 15000); // 14000 elapsed
    expect(elapsed).toBe(14000);
    expect(remainingMs).toBe(0);
    expect(isOvertime).toBe(false);
    expect(isFinished).toBe(true);
    expect(hasCrossedZero).toBe(true);
  });

  it("should handle countdown zero crossing with overtime", () => {
    const state = {
      mode: "countdown", targetMs: 10000, accumulatedMs: 0, isRunning: true, startTimestamp: 1000, overtimeEnabled: true
    } as TimerState;
    const { elapsed, remainingMs, isOvertime, isFinished, hasCrossedZero } = calculateTimerStateCore(state, 15000); // 14000 elapsed
    expect(elapsed).toBe(14000);
    expect(remainingMs).toBe(4000); // 14000 - 10000 = 4000 overtime
    expect(isOvertime).toBe(true);
    expect(isFinished).toBe(false);
    expect(hasCrossedZero).toBe(true);
  });
  
  it("should calculate stopwatch hundredths accurately", () => {
    const state = {
      mode: "stopwatch", accumulatedMs: 500, isRunning: true, startTimestamp: 1000, targetMs: 0, overtimeEnabled: false
    } as TimerState;
    const { elapsed } = calculateTimerStateCore(state, 1123); // elapsed = 500 + 123 = 623
    expect(elapsed).toBe(623);
  });
});

describe("Timer Store & User Init", () => {
  beforeEach(() => {
    localStorage.clear();
    timerStore.clearUser();
    timerStore.hardReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not persist or allow state changes before initialization", () => {
    timerStore.setState({ targetMs: 999 });
    const state = timerStore.getState();
    expect(state.targetMs).not.toBe(999);
    expect(state.initializedUserId).toBe(null);
  });

  it("should initialize for user, keeping previous local storage state", () => {
    localStorage.setItem("hasad_timer_state_v1_1", JSON.stringify({ mode: "stopwatch", targetMs: 555 }));
    timerStore.initForUser(1);
    const state = timerStore.getState();
    expect(state.initializedUserId).toBe(1);
    expect(state.mode).toBe("stopwatch");
    expect(state.targetMs).toBe(555);
  });

  it("should clear user cleanly without destroying data and avoid leaking state", () => {
    timerStore.initForUser(1);
    timerStore.setState({ targetMs: 777 });
    
    // Switch to unauthenticated/loading (e.g., Auth A -> loading)
    timerStore.clearUser();
    
    // Memory is reset for the interim
    expect(timerStore.getState().initializedUserId).toBe(null);
    expect(timerStore.getState().targetMs).not.toBe(777); // should be default
    
    // Storage is preserved for User 1
    const stored = JSON.parse(localStorage.getItem("hasad_timer_state_v1_1")!);
    expect(stored.targetMs).toBe(777);
    
    // Switch to User 2
    timerStore.initForUser(2);
    expect(timerStore.getState().initializedUserId).toBe(2);
    expect(timerStore.getState().targetMs).not.toBe(777); // should be default since User 2 has no data
  });
});

describe("Timer Action Semantics", () => {
  beforeEach(() => {
    localStorage.clear();
    timerStore.clearUser();
    timerStore.hardReset();
    timerStore.initForUser(1);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test the core logic behind useTimerEngine's start without rendering hook since it requires React setup
  it("start should not reset completedHandled if timer is already in overtime", () => {
    timerStore.setState({
      targetMs: 5000,
      accumulatedMs: 6000, 
      completedHandled: true,
      overtimeEnabled: true
    });

    const stateBefore = timerStore.getState();
    const currentElapsed = stateBefore.accumulatedMs; 
    
    timerStore.setState({
      isRunning: true,
      startTimestamp: Date.now(),
      ...(currentElapsed < stateBefore.targetMs ? { completedHandled: false } : {})
    });

    const stateAfter = timerStore.getState();
    expect(stateAfter.isRunning).toBe(true);
    expect(stateAfter.completedHandled).toBe(true); // Retained true
  });

  it("start should reset completedHandled if timer is started from before target", () => {
    timerStore.setState({
      targetMs: 5000,
      accumulatedMs: 3000,
      completedHandled: true 
    });

    const stateBefore = timerStore.getState();
    const currentElapsed = stateBefore.accumulatedMs; 
    
    timerStore.setState({
      isRunning: true,
      startTimestamp: Date.now(),
      ...(currentElapsed < stateBefore.targetMs ? { completedHandled: false } : {})
    });

    const stateAfter = timerStore.getState();
    expect(stateAfter.isRunning).toBe(true);
    expect(stateAfter.completedHandled).toBe(false); // Reset to false
  });
});
