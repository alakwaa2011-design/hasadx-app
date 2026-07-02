// ─────────────────────────────────────────────────────────────────────────────
// Tug-of-war "Class Mode" engine — a 100% pure reducer, no React, no network.
//
// One shared resource (the rope) + two FULLY independent team states. Every
// action that touches a team carries its TeamId, and the reducer only ever
// reads/writes `state.teams[action.team]` — isolation is guaranteed by
// construction: a tap on the right panel cannot affect the left one.
//
// Rope semantics match the online mode: 0..100, blue wins at 0, red at 100.
// ─────────────────────────────────────────────────────────────────────────────

export type TeamId = "blue" | "red";

export interface ClassQuestion {
  text: string;
  options: string[];
  correct: number;
}

export interface TeamState {
  /**
   * This team's OWN random route through the SHARED question list: a full
   * permutation of indices into `state.questions`. Every team sees every
   * question — only the order differs.
   */
  questionOrder: number[];
  /** Position within questionOrder (NOT a question id). */
  qIndex: number;
  selected: number | null;
  correct: boolean | null;
  phase: "question" | "feedback" | "exhausted";
  timeLeft: number;
  feedbackLeft: number;
  score: number;
  streak: number;
  /** Points earned by the LAST answer — drives the zone-local score popup. */
  lastGain: number;
}

export interface ClassImpulse {
  team: TeamId;
  kind: "win" | "lose";
  id: number;
}

export interface ClassState {
  status: "idle" | "countdown" | "playing" | "finished";
  countdown: number;
  rope: number; // 0..100 — the only shared resource
  /** The single shared question source — both teams play ALL of these. */
  questions: ClassQuestion[];
  duration: number; // seconds per question
  teams: Record<TeamId, TeamState>;
  winner: TeamId | "draw" | null;
  winKind: "rope" | "exhausted" | null;
  lastImpulse: ClassImpulse | null;
  impulseSeq: number;
}

export type ClassAction =
  | { type: "start" }
  | { type: "tick" } // one 1-second pulse; advances BOTH team timers independently
  | { type: "answer"; team: TeamId; index: number };

// Tuning
const ROPE_STEP = 5;        // rope pull per correct answer
const ROPE_SPEED_BONUS = 2; // extra pull when answered in the fastest 25%
const SCORE_BASE = 10;
const SCORE_SPEED_BONUS = 5;
const FEEDBACK_SECS = 2;    // how long each panel shows its own feedback

const freshTeam = (duration: number, questionOrder: number[]): TeamState => ({
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
});

/**
 * Build the two independent routes through the same question list.
 * Both are FULL permutations of 0..count-1 — no question is ever dropped.
 *
 * Blue gets a Fisher–Yates shuffle; red gets the SAME shuffle rotated by
 * half the list. The rotation guarantees that at any equal position the two
 * teams look at different questions (for count ≥ 2) — so they never open on
 * the same question, and a collision can only happen when their paces drift.
 */
export function buildQuestionOrders(
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

export function createClassState(
  questions: ClassQuestion[],
  duration: number,
  rng: () => number = Math.random,
): ClassState {
  const orders = buildQuestionOrders(questions.length, rng);
  return {
    status: "idle",
    countdown: 3,
    rope: 50,
    questions,
    duration,
    teams: {
      blue: freshTeam(duration, orders.blue),
      red: freshTeam(duration, orders.red),
    },
    winner: null,
    winKind: null,
    lastImpulse: null,
    impulseSeq: 0,
  };
}

export function currentQuestion(state: ClassState, team: TeamId): ClassQuestion | null {
  const t = state.teams[team];
  if (t.qIndex >= t.questionOrder.length) return null;
  return state.questions[t.questionOrder[t.qIndex]] ?? null;
}

const clampRope = (r: number) => Math.max(0, Math.min(100, r));

/** Rope-wall win beats everything; otherwise both teams must be exhausted. */
function resolveEnd(state: ClassState): ClassState {
  if (state.rope <= 0) return { ...state, status: "finished", winner: "blue", winKind: "rope" };
  if (state.rope >= 100) return { ...state, status: "finished", winner: "red", winKind: "rope" };
  const { blue, red } = state.teams;
  if (blue.phase === "exhausted" && red.phase === "exhausted") {
    const winner: TeamId | "draw" = state.rope < 50 ? "blue" : state.rope > 50 ? "red" : "draw";
    return { ...state, status: "finished", winner, winKind: "exhausted" };
  }
  return state;
}

/** Move one team forward after its feedback window closes. */
function advanceTeam(state: ClassState, id: TeamId): ClassState {
  const t = state.teams[id];
  const nextIndex = t.qIndex + 1;
  const next: TeamState =
    nextIndex >= t.questionOrder.length
      ? { ...t, qIndex: nextIndex, phase: "exhausted", selected: null, correct: null, feedbackLeft: 0 }
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

/** One second passes for a single team (question countdown or feedback). */
function tickTeam(state: ClassState, id: TeamId): ClassState {
  const t = state.teams[id];
  if (t.phase === "question") {
    if (t.timeLeft > 1) {
      return { ...state, teams: { ...state.teams, [id]: { ...t, timeLeft: t.timeLeft - 1 } } };
    }
    // Time out ⇒ counts as a miss: no rope movement, streak resets.
    const timedOut: TeamState = {
      ...t, timeLeft: 0, phase: "feedback", selected: null, correct: false,
      streak: 0, feedbackLeft: FEEDBACK_SECS, lastGain: 0,
    };
    return { ...state, teams: { ...state.teams, [id]: timedOut } };
  }
  if (t.phase === "feedback") {
    if (t.feedbackLeft > 1) {
      return { ...state, teams: { ...state.teams, [id]: { ...t, feedbackLeft: t.feedbackLeft - 1 } } };
    }
    return advanceTeam(state, id);
  }
  return state; // exhausted — nothing to tick
}

export function classReducer(state: ClassState, action: ClassAction): ClassState {
  switch (action.type) {
    case "start": {
      if (state.status !== "idle") return state;
      return { ...state, status: "countdown", countdown: 3 };
    }

    case "tick": {
      if (state.status === "countdown") {
        if (state.countdown > 1) return { ...state, countdown: state.countdown - 1 };
        return { ...state, status: "playing", countdown: 0 };
      }
      if (state.status !== "playing") return state;
      // Each team ticks independently — order is irrelevant because tickTeam
      // only touches its own team slice (rope only moves on answers).
      return tickTeam(tickTeam(state, "blue"), "red");
    }

    case "answer": {
      if (state.status !== "playing") return state;
      const t = state.teams[action.team];
      if (t.phase !== "question" || t.selected !== null) return state;
      const q = state.questions[t.questionOrder[t.qIndex]];
      if (!q || action.index < 0 || action.index >= q.options.length) return state;

      const correct = action.index === q.correct;
      const fast = t.timeLeft >= state.duration * 0.75;
      const pull = correct ? ROPE_STEP + (fast ? ROPE_SPEED_BONUS : 0) : 0;
      // Blue pulls the rope toward 0, red toward 100.
      const rope = clampRope(state.rope + (action.team === "blue" ? -pull : pull));

      const gain = correct ? SCORE_BASE + (fast ? SCORE_SPEED_BONUS : 0) : 0;
      const answered: TeamState = {
        ...t,
        selected: action.index,
        correct,
        phase: "feedback",
        feedbackLeft: FEEDBACK_SECS,
        score: t.score + gain,
        streak: correct ? t.streak + 1 : 0,
        lastGain: gain,
      };
      const impulseSeq = state.impulseSeq + 1;
      const next: ClassState = {
        ...state,
        rope,
        teams: { ...state.teams, [action.team]: answered },
        lastImpulse: { team: action.team, kind: correct ? "win" : "lose", id: impulseSeq },
        impulseSeq,
      };
      return resolveEnd(next);
    }

    default:
      return state;
  }
}
