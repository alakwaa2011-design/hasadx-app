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

/** The four possible effects in a team mystery box. */
export type MysteryGift = "power-pull" | "freeze" | "time-boost" | "shield";
/** Alias for consumers that describe a picker entry as a gift choice. */
export type GiftChoiceType = MysteryGift;

/**
 * Kept in state so a UI can render the fixed picker and the outcome without
 * needing to generate or retain any game data of its own.
 */
export interface MysteryPickState {
  choices: readonly MysteryGift[];
  /** Null until a choice is made; then the index in `choices`. */
  revealed: number | null;
}

/** Optional teacher-controlled class-mode settings. */
export interface ClassGameOptions {
  giftsEnabled?: boolean;
  /** Correct answers required per box, constrained to 1..3. */
  giftEveryCorrect?: number;
  /** Seconds an unshielded opponent is frozen, constrained to 3..10. */
  freezeDuration?: number;
  /** Retained here to keep configuration and deterministic route generation together. */
  rng?: () => number;
}
/** Backward-friendly name for the teacher's class-mode setup. */
export type ClassSetup = ClassGameOptions;

export interface ClassQuestion {
  text: string;
  options: string[];
  correct: number;
  imageUrl?: string | null;
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
  /** Unopened mystery boxes. Never exceeds two. */
  boxes: number;
  /** Correct answers accumulated toward the next mystery box. */
  correctSinceGift: number;
  /** Absorbs one incoming freeze, then is consumed. */
  shield: boolean;
  /** Remaining seconds during which this team cannot answer or lose question time. */
  frozenSeconds: number;
  /** Doubles this team's next correct-answer rope pull. */
  powerPullReady: boolean;
  /** Non-null while the latest box's choices/outcome should be displayed. */
  mysteryPicking: MysteryPickState | null;
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
  giftsEnabled: boolean;
  giftEveryCorrect: number;
  freezeDuration: number;
  teams: Record<TeamId, TeamState>;
  winner: TeamId | "draw" | null;
  winKind: "rope" | "exhausted" | null;
  lastImpulse: ClassImpulse | null;
  impulseSeq: number;
}

export type ClassAction =
  | { type: "start" }
  | { type: "tick" } // one 1-second pulse; advances BOTH team timers independently
  | { type: "answer"; team: TeamId; index: number }
  | { type: "open-box"; team: TeamId }
  | { type: "pick-mystery"; team: TeamId; index: number }
  | { type: "pick-mystery"; team: TeamId; idx: number }
  | { type: "dismiss-mystery"; team: TeamId };

// Tuning
const ROPE_STEP = 5;        // rope pull per correct answer
const ROPE_SPEED_BONUS = 2; // extra pull when answered in the fastest 25%
const SCORE_BASE = 10;
const SCORE_SPEED_BONUS = 5;
const FEEDBACK_SECS = 2;    // how long each panel shows its own feedback
const MAX_BOXES = 2;
const GIFT_CHOICES: readonly MysteryGift[] = ["power-pull", "freeze", "time-boost", "shield"];

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
  boxes: 0,
  correctSinceGift: 0,
  shield: false,
  frozenSeconds: 0,
  powerPullReady: false,
  mysteryPicking: null,
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
  optionsOrRng: ClassGameOptions | (() => number) = {},
): ClassState {
  // Accepting the former third-argument RNG keeps existing callers deterministic.
  const options: ClassGameOptions =
    typeof optionsOrRng === "function" ? { rng: optionsOrRng } : optionsOrRng;
  const rng = options.rng ?? Math.random;
  const orders = buildQuestionOrders(questions.length, rng);
  return {
    status: "idle",
    countdown: 3,
    rope: 50,
    questions,
    duration,
    giftsEnabled: options.giftsEnabled ?? true,
    giftEveryCorrect: clampSetting(options.giftEveryCorrect, 3, 1, 3),
    freezeDuration: clampSetting(options.freezeDuration, 5, 3, 10),
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
const clampSetting = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value as number) : fallback));

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
    // Freezes consume real time but explicitly do not consume question time.
    if (t.frozenSeconds > 0) {
      return {
        ...state,
        teams: { ...state.teams, [id]: { ...t, frozenSeconds: t.frozenSeconds - 1 } },
      };
    }
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
      if (t.phase !== "question" || t.selected !== null || t.frozenSeconds > 0) return state;
      const q = state.questions[t.questionOrder[t.qIndex]];
      if (!q || action.index < 0 || action.index >= q.options.length) return state;

      const correct = action.index === q.correct;
      const fast = t.timeLeft >= state.duration * 0.75;
      const normalPull = ROPE_STEP + (fast ? ROPE_SPEED_BONUS : 0);
      const pull = correct ? normalPull * (t.powerPullReady ? 2 : 1) : 0;
      // Blue pulls the rope toward 0, red toward 100.
      const rope = clampRope(state.rope + (action.team === "blue" ? -pull : pull));

      const gain = correct ? SCORE_BASE + (fast ? SCORE_SPEED_BONUS : 0) : 0;
      const progress = correct && state.giftsEnabled ? t.correctSinceGift + 1 : t.correctSinceGift;
      const hitsGiftCadence = state.giftsEnabled && correct && progress >= state.giftEveryCorrect;
      const earnsBox = hitsGiftCadence && t.boxes < MAX_BOXES;
      const answered: TeamState = {
        ...t,
        selected: action.index,
        correct,
        phase: "feedback",
        feedbackLeft: FEEDBACK_SECS,
        score: t.score + gain,
        streak: correct ? t.streak + 1 : 0,
        lastGain: gain,
        powerPullReady: correct ? false : t.powerPullReady,
        // Reset at every cadence even when inventory is full, so consuming a
        // box cannot retroactively turn a previous correct answer into a gift.
        correctSinceGift: hitsGiftCadence ? 0 : progress,
        boxes: earnsBox ? t.boxes + 1 : t.boxes,
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

    case "open-box": {
      if (state.status !== "playing" || !state.giftsEnabled) return state;
      const t = state.teams[action.team];
      if (t.boxes < 1) return state;
      const opened: TeamState = {
        ...t,
        boxes: t.boxes - 1,
        mysteryPicking: { choices: GIFT_CHOICES, revealed: null },
      };
      return { ...state, teams: { ...state.teams, [action.team]: opened } };
    }

    case "pick-mystery": {
      if (state.status !== "playing" || !state.giftsEnabled) return state;
      const t = state.teams[action.team];
      const picker = t.mysteryPicking;
      const choiceIndex = "index" in action ? action.index : action.idx;
      if (!picker || picker.revealed !== null || choiceIndex < 0 || choiceIndex >= picker.choices.length) {
        return state;
      }
      const gift = picker.choices[choiceIndex];
      const opponentId: TeamId = action.team === "blue" ? "red" : "blue";
      let self: TeamState = { ...t, mysteryPicking: { ...picker, revealed: choiceIndex } };
      let opponent = state.teams[opponentId];

      if (gift === "power-pull") {
        self = { ...self, powerPullReady: true };
      } else if (gift === "time-boost") {
        self = { ...self, timeLeft: Math.min(state.duration + 5, self.timeLeft + 5) };
      } else if (gift === "shield") {
        self = { ...self, shield: true };
      } else if (opponent.shield) {
        opponent = { ...opponent, shield: false };
      } else {
        opponent = { ...opponent, frozenSeconds: state.freezeDuration };
      }
      return {
        ...state,
        teams: { ...state.teams, [action.team]: self, [opponentId]: opponent },
      };
    }

    case "dismiss-mystery": {
      const t = state.teams[action.team];
      if (!t.mysteryPicking) return state;
      return { ...state, teams: { ...state.teams, [action.team]: { ...t, mysteryPicking: null } } };
    }

    default:
      return state;
  }
}
