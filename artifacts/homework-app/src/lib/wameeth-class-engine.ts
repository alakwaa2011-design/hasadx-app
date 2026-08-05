// ─────────────────────────────────────────────────────────────────────────────
// وميض الصف — Class-mode engine (pure reducer, no network, no React).
//
// Two teams play ALL the questions in independent random orders on the SAME
// screen.  No rope — winner is decided by score alone when both sides exhaust
// their question bank.  Isolation is guaranteed by construction: every action
// that touches a team carries its TeamId, and the reducer only ever reads /
// writes state.teams[action.team].
// ─────────────────────────────────────────────────────────────────────────────

export type TeamId = "blue" | "red";

export interface WameethClassQuestion {
  text: string;
  options: string[];
  correct: number; // 0-based index
}

export interface WameethTeamState {
  /** Full permutation of question indices — independent per team. */
  questionOrder: number[];
  /** Position within questionOrder. */
  qIndex: number;
  selected: number | null;
  correct: boolean | null;
  phase: "question" | "feedback" | "exhausted";
  timeLeft: number;
  feedbackLeft: number;
  score: number;
  streak: number;
  /** Points earned on the last answer — drives the local +N popup. */
  lastGain: number;
  /** Total correct answers (for end stats). */
  correctCount: number;
}

export interface WameethClassState {
  status: "idle" | "countdown" | "playing" | "finished";
  countdown: number;
  questions: WameethClassQuestion[];
  duration: number;
  teams: Record<TeamId, WameethTeamState>;
  winner: TeamId | "draw" | null;
  lastImpulse: { team: TeamId; kind: "correct" | "wrong"; id: number } | null;
  impulseSeq: number;
}

export type WameethClassAction =
  | { type: "start" }
  | { type: "tick" }
  | { type: "answer"; team: TeamId; index: number };

// ── Tuning ───────────────────────────────────────────────────────────────────
const SCORE_BASE = 10;
const SCORE_SPEED_BONUS = 5;
const FEEDBACK_SECS = 2;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build two independent shuffled routes through the shared question list.
 * Blue = Fisher–Yates shuffle; Red = same list rotated by half its length so
 * teams never open on the same question.
 */
export function buildWameethQuestionOrders(
  count: number,
  rng: () => number = Math.random,
): Record<TeamId, number[]> {
  const blue = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blue[i], blue[j]] = [blue[j], blue[i]];
  }
  const shift = Math.floor(count / 2);
  const red = blue.map((_, i) => blue[(i + shift) % count]);
  return { blue, red };
}

function freshTeam(duration: number, questionOrder: number[]): WameethTeamState {
  return {
    questionOrder,
    qIndex: 0,
    selected: null,
    correct: null,
    phase: "question",
    timeLeft: duration,
    feedbackLeft: 0,
    score: 0,
    streak: 0,
    lastGain: 0,
    correctCount: 0,
  };
}

export function createWameethClassState(
  questions: WameethClassQuestion[],
  duration: number,
  rng: () => number = Math.random,
): WameethClassState {
  const orders = buildWameethQuestionOrders(questions.length, rng);
  return {
    status: "idle",
    countdown: 3,
    questions,
    duration,
    teams: {
      blue: freshTeam(duration, orders.blue),
      red: freshTeam(duration, orders.red),
    },
    winner: null,
    lastImpulse: null,
    impulseSeq: 0,
  };
}

export function currentWameethQuestion(
  state: WameethClassState,
  team: TeamId,
): WameethClassQuestion | null {
  const t = state.teams[team];
  if (t.qIndex >= t.questionOrder.length) return null;
  return state.questions[t.questionOrder[t.qIndex]] ?? null;
}

// ── Internal reducers ─────────────────────────────────────────────────────────

function resolveEnd(state: WameethClassState): WameethClassState {
  const { blue, red } = state.teams;
  if (blue.phase === "exhausted" && red.phase === "exhausted") {
    const winner: TeamId | "draw" =
      blue.score > red.score ? "blue" : red.score > blue.score ? "red" : "draw";
    return { ...state, status: "finished", winner };
  }
  return state;
}

function advanceTeam(state: WameethClassState, id: TeamId): WameethClassState {
  const t = state.teams[id];
  const nextIndex = t.qIndex + 1;
  const next: WameethTeamState =
    nextIndex >= t.questionOrder.length
      ? {
          ...t,
          qIndex: nextIndex,
          phase: "exhausted",
          selected: null,
          correct: null,
          feedbackLeft: 0,
        }
      : {
          ...t,
          qIndex: nextIndex,
          phase: "question",
          selected: null,
          correct: null,
          timeLeft: state.duration,
          feedbackLeft: 0,
        };
  return resolveEnd({ ...state, teams: { ...state.teams, [id]: next } });
}

function tickTeam(state: WameethClassState, id: TeamId): WameethClassState {
  const t = state.teams[id];
  if (t.phase === "question") {
    if (t.timeLeft > 1) {
      return {
        ...state,
        teams: { ...state.teams, [id]: { ...t, timeLeft: t.timeLeft - 1 } },
      };
    }
    // Timed out — no score, streak resets.
    const timedOut: WameethTeamState = {
      ...t,
      timeLeft: 0,
      phase: "feedback",
      selected: null,
      correct: false,
      streak: 0,
      feedbackLeft: FEEDBACK_SECS,
      lastGain: 0,
    };
    return { ...state, teams: { ...state.teams, [id]: timedOut } };
  }
  if (t.phase === "feedback") {
    if (t.feedbackLeft > 1) {
      return {
        ...state,
        teams: { ...state.teams, [id]: { ...t, feedbackLeft: t.feedbackLeft - 1 } },
      };
    }
    return advanceTeam(state, id);
  }
  return state; // exhausted
}

// ── Public reducer ────────────────────────────────────────────────────────────

export function wameethClassReducer(
  state: WameethClassState,
  action: WameethClassAction,
): WameethClassState {
  switch (action.type) {
    case "start":
      if (state.status !== "idle") return state;
      return { ...state, status: "countdown", countdown: 3 };

    case "tick":
      if (state.status === "countdown") {
        if (state.countdown > 1) return { ...state, countdown: state.countdown - 1 };
        return { ...state, status: "playing", countdown: 0 };
      }
      if (state.status !== "playing") return state;
      // Each team ticks independently — order irrelevant (no shared resource).
      return tickTeam(tickTeam(state, "blue"), "red");

    case "answer": {
      if (state.status !== "playing") return state;
      const t = state.teams[action.team];
      if (t.phase !== "question" || t.selected !== null) return state;
      const q = state.questions[t.questionOrder[t.qIndex]];
      if (!q || action.index < 0 || action.index >= q.options.length) return state;

      const correct = action.index === q.correct;
      const fast = t.timeLeft >= state.duration * 0.75;
      const gain = correct ? SCORE_BASE + (fast ? SCORE_SPEED_BONUS : 0) : 0;
      const seq = state.impulseSeq + 1;

      const answered: WameethTeamState = {
        ...t,
        selected: action.index,
        correct,
        phase: "feedback",
        feedbackLeft: FEEDBACK_SECS,
        score: t.score + gain,
        streak: correct ? t.streak + 1 : 0,
        lastGain: gain,
        correctCount: t.correctCount + (correct ? 1 : 0),
      };

      return resolveEnd({
        ...state,
        teams: { ...state.teams, [action.team]: answered },
        lastImpulse: {
          team: action.team,
          kind: correct ? "correct" : "wrong",
          id: seq,
        },
        impulseSeq: seq,
      });
    }

    default:
      return state;
  }
}
