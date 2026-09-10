export type TimerMode = "countdown" | "stopwatch";
export type TimerPresentation = "digital" | "circular" | "bar";

export interface TimerLap {
  id: string;
  name: string;
  splitMs: number;
  totalMs: number;
}

export interface TimerState {
  initializedUserId: number | null;
  isActive: boolean; // If true, the timer tool is "started/open" and should show floating if not on page
  isMinimized: boolean;
  mode: TimerMode;
  isRunning: boolean;
  startTimestamp: number | null;
  accumulatedMs: number;
  targetMs: number;
  overtimeEnabled: boolean;
  presentation: TimerPresentation;
  taskName: string;
  laps: TimerLap[];
  studentDisplayActive: boolean;
  soundSelection: string;
  soundVolume: number;
  soundMuted: boolean;
  notifyBrowser: boolean;
  completedHandled: boolean; // to trigger sound only once
}

const DEFAULT_STATE: TimerState = {
  initializedUserId: null,
  isActive: false,
  isMinimized: false,
  mode: "countdown",
  isRunning: false,
  startTimestamp: null,
  accumulatedMs: 0,
  targetMs: 5 * 60 * 1000,
  overtimeEnabled: false,
  presentation: "circular",
  taskName: "",
  laps: [],
  studentDisplayActive: false,
  soundSelection: "bell",
  soundVolume: 0.8,
  soundMuted: false,
  notifyBrowser: false,
  completedHandled: false,
};

let state: TimerState = { ...DEFAULT_STATE };
const listeners = new Set<() => void>();
let currentUserId: number | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function getStorageKey() {
  return currentUserId ? `hasad_timer_state_v1_${currentUserId}` : null;
}

function saveToStorage() {
  if (!state.initializedUserId) return; // Don't save if not initialized or logged out
  const key = getStorageKey();
  if (!key) return;
  try {
    // Only save the data, strip initializedUserId
    const toSave = { ...state, initializedUserId: undefined };
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch (e) {}
}

export const timerStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setState: (partial: Partial<TimerState> | ((prev: TimerState) => Partial<TimerState>)) => {
    if (!state.initializedUserId && typeof partial === "object" && !("initializedUserId" in partial)) return; // No updates before init
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    emit();
    saveToStorage();
  },
  reset: () => {
    if (!state.initializedUserId) return;
    state = { 
      ...DEFAULT_STATE,
      initializedUserId: state.initializedUserId,
      isActive: state.isActive, 
      isMinimized: state.isMinimized,
      mode: state.mode,
      presentation: state.presentation,
      taskName: state.taskName,
      targetMs: state.targetMs,
      overtimeEnabled: state.overtimeEnabled,
      soundSelection: state.soundSelection,
      soundVolume: state.soundVolume,
      soundMuted: state.soundMuted,
      notifyBrowser: state.notifyBrowser,
    };
    emit();
    saveToStorage();
  },
  hardReset: () => {
    state = { ...DEFAULT_STATE, initializedUserId: state.initializedUserId };
    emit();
    saveToStorage();
  },
  initForUser: (userId: number) => {
    if (currentUserId === userId && state.initializedUserId === userId) return;
    currentUserId = userId;
    const key = getStorageKey();
    if (!key) return;
    try {
      const str = localStorage.getItem(key);
      if (str) {
        state = { ...DEFAULT_STATE, ...JSON.parse(str), initializedUserId: userId };
        emit();
      } else {
        state = { ...DEFAULT_STATE, initializedUserId: userId };
        emit();
      }
    } catch (e) {
      state = { ...DEFAULT_STATE, initializedUserId: userId };
      emit();
    }
  },
  clearUser: () => {
    currentUserId = null;
    state = { ...DEFAULT_STATE, initializedUserId: null };
    emit();
  }
};
