import { timerStore } from "./timer-store";

const API_BASE = import.meta.env.VITE_API_URL || "";

type ServerTimerState = {
  status: "running" | "paused" | "cancelled" | "completed";
  endAt: string | null;
  remainingMs: number;
  taskName: string;
  clientHandled: boolean;
  runId: string | null;
  version: number;
};

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}/api/teacher/timer-state${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
}

let pendingWrite: Promise<void> = Promise.resolve();
let syncUserId: number | null = null;
let knownVersion = 0;
let localMutationCounter = 0;

function enqueueWrite(
  path: string,
  getBody: () => Record<string, unknown>,
  sameRunId?: string | null,
): void {
  pendingWrite = pendingWrite
    .catch(() => undefined)
    .then(async () => {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await request(path, {
            method: path ? "POST" : "PUT",
            body: JSON.stringify(getBody()),
          });
          if (response.status === 409 && sameRunId) {
            const current = await request("");
            if (!current.ok) throw new Error("Unable to refresh timer version");
            const remote = await current.json() as ServerTimerState;
            if (remote.runId !== sameRunId || remote.status === "completed") return;
            knownVersion = remote.version;
            await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
            continue;
          }
          if (response.status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            continue;
          }
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      if (!response) throw new Error("Timer sync failed");
      if (response.status === 409) {
        const userId = timerStore.getState().initializedUserId;
        if (userId) await restoreTimerFromServer(userId);
        return;
      }
      if (!response.ok) throw new Error(`Timer sync failed with ${response.status}`);
      const result = await response.json() as { version?: number };
      if (typeof result.version === "number") {
        knownVersion = result.version;
        timerStore.setState({ serverVersion: result.version });
      }
    });
}

export async function restoreTimerFromServer(userId: number): Promise<void> {
  if (syncUserId !== userId) {
    syncUserId = userId;
    knownVersion = 0;
    pendingWrite = Promise.resolve();
  }
  const mutationAtStart = localMutationCounter;
  const response = await request("");
  if (!response.ok || timerStore.getState().initializedUserId !== userId) return;
  const remote = await response.json() as ServerTimerState;
  if (mutationAtStart !== localMutationCounter) return;
  knownVersion = remote.version;
  if (timerStore.getState().initializedUserId !== userId) return;

  if (remote.status === "running" && remote.endAt) {
    const remainingMs = Math.max(0, new Date(remote.endAt).getTime() - Date.now());
    timerStore.setState({
      isActive: true,
      mode: "countdown",
      isRunning: remainingMs > 0,
      startTimestamp: remainingMs > 0 ? Date.now() : null,
      accumulatedMs: 0,
      targetMs: remainingMs,
      taskName: remote.taskName,
      completedHandled: remote.clientHandled,
      milestonesFired: {},
      serverRunId: remote.runId,
      serverVersion: remote.version,
    });
    if (remainingMs === 0 && !remote.clientHandled && remote.runId) markTimerHandled(remote.runId);
  } else if (remote.status === "paused") {
    timerStore.setState({
      isActive: true,
      mode: "countdown",
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
      targetMs: remote.remainingMs,
      taskName: remote.taskName,
      completedHandled: false,
      milestonesFired: {},
      serverRunId: remote.runId,
      serverVersion: remote.version,
    });
  } else if (remote.status === "completed") {
    timerStore.setState({
      isActive: true,
      mode: "countdown",
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
      targetMs: 0,
      taskName: remote.taskName,
      completedHandled: true,
      milestonesFired: {},
      serverRunId: remote.runId,
      serverVersion: remote.version,
    });
  } else {
    timerStore.setState({
      isRunning: false,
      startTimestamp: null,
      accumulatedMs: 0,
      completedHandled: true,
      milestonesFired: {},
      serverRunId: remote.runId,
      serverVersion: remote.version,
    });
  }
}

export function syncRunningTimer(endAt: number, taskName: string, startNewRun = false): void {
  localMutationCounter += 1;
  const state = timerStore.getState();
  const runId = startNewRun || !state.serverRunId ? crypto.randomUUID() : state.serverRunId;
  if (runId !== state.serverRunId) timerStore.setState({ serverRunId: runId });
  enqueueWrite("", () => ({
    status: "running", runId, expectedVersion: knownVersion,
    endAt: new Date(endAt).toISOString(), taskName,
  }), startNewRun ? undefined : runId);
}

export function syncPausedTimer(remainingMs: number, taskName: string): void {
  localMutationCounter += 1;
  const state = timerStore.getState();
  if (!state.serverRunId) return;
  const runId = state.serverRunId;
  enqueueWrite("", () => ({
    status: "paused", runId, expectedVersion: knownVersion,
    remainingMs: Math.max(0, Math.round(remainingMs)), taskName,
  }), runId);
}

export function cancelServerTimer(): void {
  localMutationCounter += 1;
  const state = timerStore.getState();
  const runId = state.serverRunId;
  enqueueWrite("", () => ({
    status: "cancelled", runId, expectedVersion: knownVersion,
  }), runId);
}

export function markTimerHandled(runId: string): void {
  enqueueWrite("/handled", () => ({ runId }));
}

export async function claimLocalTimerSound(runId: string): Promise<boolean> {
  const key = `hasaad_timer_sound_${runId}`;
  const claim = () => {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  };
  if (navigator.locks) {
    return navigator.locks.request(`hasaad-timer-sound-${runId}`, { mode: "exclusive" }, claim);
  }
  return claim();
}