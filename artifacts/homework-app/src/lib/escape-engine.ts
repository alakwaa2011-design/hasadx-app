// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — Escape-room game engine (100% pure reducer, no side effects).
//
// One RUN of the vault: a chain of themed LOCKS, each powered by a slice of
// the teacher's MCQ questions. Correct answers unwind the lock; wrong answers
// trigger the alarm and burn precious seconds. Open every lock — including the
// final Master Vault — before the timer dies to escape.
//
// The same engine drives BOTH modes:
//   • Class mode  — one shared run on the classroom screen (cooperative).
//   • Device mode — each student runs their own instance on their phone.
//
// Lock types are purely presentational skins over the same MCQ mechanic; the
// UI renders each type differently (digit reveal / laser grid / wire cut /
// master vault dial) but the reducer only cares about progress.
// ─────────────────────────────────────────────────────────────────────────────

export interface EscapeQuestion {
  text: string;
  options: string[];
  correct: number;
  imageUrl?: string | null;
}

export type LockType = "digits" | "laser" | "wires" | "vault";

export interface LockState {
  type: LockType;
  /** Indices into state.questions consumed by this lock. */
  questionIdxs: number[];
  /** How many of this lock's questions are solved so far. */
  solved: number;
  /** Positions within questionIdxs already answered correctly. */
  solvedPositions: number[];
  open: boolean;
  /** The secret digit this lock contributes to the master code (0–9). */
  digit: number;
}

export interface EscapeSetupConfig {
  questions: EscapeQuestion[];
  /** Total escape time in seconds. */
  totalTime: number;
  /** Number of locks (final one is always the Master Vault). */
  lockCount: number;
  /** 50/50 hint keys available for the whole run. */
  hints: number;
  title?: string;
}

export type EscapePhase = "question" | "feedback" | "lock-open";

export interface EscapeState {
  status: "idle" | "playing" | "won" | "lost";
  timeLeft: number;
  totalTime: number;
  questions: EscapeQuestion[];
  locks: LockState[];
  /** Index of the lock currently being worked on. */
  lockIndex: number;
  /** Position within the current lock's questionIdxs. */
  qPos: number;
  phase: EscapePhase;
  selected: number | null;
  correct: boolean | null;
  /** Seconds remaining in the feedback pause. */
  feedbackLeft: number;
  /** Option indexes removed by the 50/50 hint for the CURRENT question. */
  removed: number[];
  hintsLeft: number;
  correctCount: number;
  wrongCount: number;
  /** Total seconds burned by wrong-answer penalties. */
  penalty: number;
  /** Bumps on every wrong answer — drives the alarm flash/sound. */
  alarmSeq: number;
  /** Bumps on every opened lock — drives the clunk/steam celebration. */
  unlockSeq: number;
}

export type EscapeAction =
  | { type: "start" }
  | { type: "tick" }
  | { type: "answer"; index: number }
  | { type: "fifty" }
  | { type: "continue" };

/** Seconds burned when the alarm trips (wrong answer). */
export const ESCAPE_PENALTY = 15;
/** sessionStorage key used to hand the setup from create → class mode. */
export const ESCAPE_CLASS_SETUP_KEY = "escape-class-setup";
/** Feedback pause after a correct / wrong answer (seconds). */
const FEEDBACK_CORRECT = 1;
const FEEDBACK_WRONG = 2;

/** Presentational skins cycled across the non-final locks. */
const LOCK_SKINS: LockType[] = ["digits", "laser", "wires"];

/**
 * Distribute the questions across `lockCount` locks as evenly as possible.
 * Earlier locks get the extras so the final Master Vault stays lean & tense.
 * The last lock is ALWAYS the Master Vault.
 */
export function buildLocks(
  questionCount: number,
  lockCount: number,
  rng: () => number = Math.random,
): LockState[] {
  // Never create more locks than questions (each lock needs ≥1 question).
  const count = Math.max(1, Math.min(lockCount, questionCount));
  const base = Math.floor(questionCount / count);
  const extra = questionCount % count;
  const locks: LockState[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0);
    const idxs = Array.from({ length: size }, (_, k) => cursor + k);
    cursor += size;
    locks.push({
      type: i === count - 1 ? "vault" : LOCK_SKINS[i % LOCK_SKINS.length],
      questionIdxs: idxs,
      solved: 0,
      solvedPositions: [],
      open: false,
      digit: Math.floor(rng() * 10),
    });
  }
  return locks;
}

export function createEscapeState(
  config: EscapeSetupConfig,
  rng: () => number = Math.random,
): EscapeState {
  return {
    status: "idle",
    timeLeft: config.totalTime,
    totalTime: config.totalTime,
    questions: config.questions,
    locks: buildLocks(config.questions.length, config.lockCount, rng),
    lockIndex: 0,
    qPos: 0,
    phase: "question",
    selected: null,
    correct: null,
    feedbackLeft: 0,
    removed: [],
    hintsLeft: config.hints,
    correctCount: 0,
    wrongCount: 0,
    penalty: 0,
    alarmSeq: 0,
    unlockSeq: 0,
  };
}

/** The question currently on screen, or null when the run is over. */
export function currentQuestion(state: EscapeState): EscapeQuestion | null {
  const lock = state.locks[state.lockIndex];
  if (!lock) return null;
  const qi = lock.questionIdxs[state.qPos];
  return state.questions[qi] ?? null;
}

/** Master-code digits revealed so far (one per opened lock, in order). */
export function revealedCode(state: EscapeState): number[] {
  return state.locks.filter((l) => l.open).map((l) => l.digit);
}

/** 0..1 overall progress across all questions (drives the door meter). */
export function escapeProgress(state: EscapeState): number {
  const total = state.locks.reduce((n, l) => n + l.questionIdxs.length, 0);
  const solved = state.locks.reduce((n, l) => n + l.solved, 0);
  return total > 0 ? solved / total : 0;
}

/** Final score: accuracy + speed. Win bonus keeps escapes above near-misses. */
export function escapeScore(state: EscapeState): number {
  const base = state.correctCount * 100;
  const speed = state.status === "won" ? state.timeLeft * 2 : 0;
  const bonus = state.status === "won" ? 500 : 0;
  return base + speed + bonus;
}

function advanceAfterFeedback(state: EscapeState): EscapeState {
  const lock = state.locks[state.lockIndex];
  // Lock fully solved → it swings open (interstitial or final victory).
  if (lock.solved >= lock.questionIdxs.length) {
    const locks = state.locks.map((l, i) =>
      i === state.lockIndex ? { ...l, open: true } : l,
    );
    const isFinal = state.lockIndex === state.locks.length - 1;
    if (isFinal) {
      return {
        ...state, locks, status: "won", phase: "lock-open",
        selected: null, correct: null, feedbackLeft: 0, removed: [],
        unlockSeq: state.unlockSeq + 1,
      };
    }
    return {
      ...state, locks, phase: "lock-open",
      selected: null, correct: null, feedbackLeft: 0, removed: [],
      unlockSeq: state.unlockSeq + 1,
    };
  }
  // Otherwise: move to the NEXT unsolved question in this lock. A missed
  // question is not a dead end — it rotates back around later, so the lock
  // can only ever open once every one of its questions has been answered
  // correctly (the time penalty is the price of the retry).
  const nextPos = nextUnsolvedPos(lock, state.qPos);
  return {
    ...state, qPos: nextPos, phase: "question",
    selected: null, correct: null, feedbackLeft: 0, removed: [],
  };
}

/** Rotating scan for the next position in the lock not yet answered correctly. */
function nextUnsolvedPos(lock: LockState, fromPos: number): number {
  const size = lock.questionIdxs.length;
  for (let step = 1; step <= size; step++) {
    const pos = (fromPos + step) % size;
    if (!lock.solvedPositions.includes(pos)) return pos;
  }
  return fromPos;
}

export function escapeReducer(state: EscapeState, action: EscapeAction): EscapeState {
  switch (action.type) {
    case "start": {
      if (state.status !== "idle") return state;
      return { ...state, status: "playing", phase: "question" };
    }

    case "tick": {
      if (state.status !== "playing") return state;
      // Feedback pause counts down first (timer keeps running regardless —
      // the vault never waits for anyone).
      let s = state;
      if (s.phase === "feedback") {
        const left = s.feedbackLeft - 1;
        s = left <= 0 ? advanceAfterFeedback({ ...s, feedbackLeft: 0 }) : { ...s, feedbackLeft: left };
        if (s.status === "won") return s;
      }
      const timeLeft = s.timeLeft - 1;
      if (timeLeft <= 0) {
        return { ...s, timeLeft: 0, status: "lost" };
      }
      return { ...s, timeLeft };
    }

    case "answer": {
      if (state.status !== "playing" || state.phase !== "question" || state.selected !== null) return state;
      const q = currentQuestion(state);
      if (!q || action.index < 0 || action.index >= q.options.length) return state;
      if (state.removed.includes(action.index)) return state;

      const correct = action.index === q.correct;
      if (correct) {
        const locks = state.locks.map((l, i) =>
          i === state.lockIndex
            ? { ...l, solved: l.solved + 1, solvedPositions: [...(l.solvedPositions ?? []), state.qPos] }
            : l,
        );
        return {
          ...state, locks,
          phase: "feedback", selected: action.index, correct: true,
          feedbackLeft: FEEDBACK_CORRECT,
          correctCount: state.correctCount + 1,
        };
      }
      // Alarm: burn time. If the penalty kills the clock the run is lost.
      const timeLeft = Math.max(0, state.timeLeft - ESCAPE_PENALTY);
      const base: EscapeState = {
        ...state,
        phase: "feedback", selected: action.index, correct: false,
        feedbackLeft: FEEDBACK_WRONG,
        wrongCount: state.wrongCount + 1,
        penalty: state.penalty + ESCAPE_PENALTY,
        alarmSeq: state.alarmSeq + 1,
        timeLeft,
      };
      if (timeLeft <= 0) return { ...base, status: "lost", timeLeft: 0 };
      return base;
    }

    case "fifty": {
      if (state.status !== "playing" || state.phase !== "question") return state;
      if (state.hintsLeft <= 0 || state.removed.length > 0) return state;
      const q = currentQuestion(state);
      if (!q || q.options.length < 3) return state;
      // Remove the two wrong options with the highest indexes (deterministic).
      const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correct);
      const removed = wrong.slice(-2);
      return { ...state, removed, hintsLeft: state.hintsLeft - 1 };
    }

    case "continue": {
      if (state.status !== "playing" || state.phase !== "lock-open") return state;
      return {
        ...state,
        lockIndex: state.lockIndex + 1,
        qPos: 0,
        phase: "question",
        selected: null, correct: null, feedbackLeft: 0, removed: [],
      };
    }

    default:
      return state;
  }
}
