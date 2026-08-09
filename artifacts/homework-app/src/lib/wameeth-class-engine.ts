// ─────────────────────────────────────────────────────────────────────────────
// وميض الصف — Class-mode engine (pure reducer, no network, no React).
// ─────────────────────────────────────────────────────────────────────────────

export type TeamId = "blue" | "red";

/**
 * Only "mystery" boxes appear in the team inventory now.
 * When opened, the team chooses one of GiftChoiceType options.
 */
export type GiftType = "mystery";

/** The 4 actions a team can choose from when they open a gift box. */
export type GiftChoiceType = "freeze" | "steal" | "bonus" | "shield";

export interface WameethClassQuestion {
  text: string;
  options: string[];
  correct: number; // 0-based index
  imageUrl?: string | null;
}

/**
 * State while a team is choosing from their opened gift box.
 * Timer is paused until the team picks (revealed === null).
 */
export interface MysteryPickState {
  choices: GiftChoiceType[];   // always ["freeze","steal","bonus","shield"]
  revealed: number | null;     // index of the chosen option; null = not yet picked
  bonusAmount: number;         // pre-rolled bonus if they choose "bonus"
}

export interface WameethTeamState {
  questionOrder: number[];
  qIndex: number;
  selected: number | null;
  correct: boolean | null;
  phase: "question" | "feedback" | "exhausted";
  timeLeft: number;
  feedbackLeft: number;
  score: number;
  streak: number;
  lastGain: number;
  correctCount: number;
  /** Correct answers since last gift box earned (gift every 3rd correct). */
  correctSinceGift: number;
  /** Gift box inventory (max 2 boxes). */
  gifts: GiftType[];
  /** Passive shield — auto-blocks next incoming freeze or steal. */
  shield: boolean;
  /** Frozen — team cannot answer; timer already snapped to freezeDuration. */
  frozen: boolean;
  /** Non-null while the team is choosing from a gift box. */
  mysteryPicking: MysteryPickState | null;
}

export interface WameethClassState {
  status: "idle" | "countdown" | "playing" | "finished";
  countdown: number;
  questions: WameethClassQuestion[];
  duration: number;
  /** When false, no gift boxes are ever awarded (engine-level). */
  giftsEnabled: boolean;
  /**
   * How many seconds the opponent's timer is capped to when freeze is applied.
   * Configurable by the teacher before the game starts.
   */
  freezeDuration: number;
  teams: Record<TeamId, WameethTeamState>;
  winner: TeamId | "draw" | null;
  lastImpulse: {
    team: TeamId;
    kind: "correct" | "wrong" | "gift";
    gift?: GiftChoiceType | "mystery";
    id: number;
  } | null;
  impulseSeq: number;
}

export type WameethClassAction =
  | { type: "start" }
  | { type: "tick" }
  | { type: "answer"; team: TeamId; index: number }
  | { type: "use-gift"; fromTeam: TeamId; gift: GiftType }
  | { type: "pick-mystery"; team: TeamId; idx: number }
  | { type: "dismiss-mystery"; team: TeamId };

// ── Tuning ────────────────────────────────────────────────────────────────────
const SCORE_BASE         = 1000;
const SCORE_MIN_FACTOR   = 0.30;
const SCORE_STREAK_BONUS = 100;
const FEEDBACK_SECS      = 2;
const GIFT_EVERY_N       = 3;   // earn a box every 3 correct answers
const GIFT_MAX_HELD      = 2;
const STEAL_AMOUNT       = 300;
const DEFAULT_FREEZE_DUR = 10;  // seconds (teacher can override)

/** Bonus prize pool (used when the team picks "bonus" from the gift box). */
const BONUS_POOL = [100, 150, 200, 250, 300, 400, 500];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildWameethQuestionOrders(
  count: number,
  rng: () => number = Math.random,
): Record<TeamId, number[]> {
  const blue = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blue[i], blue[j]] = [blue[j], blue[i]];
  }
  const shift = Math.max(1, Math.floor(count / 2));
  const red = blue.map((_, i) => blue[(i + shift) % count]);
  return { blue, red };
}

function calcPoints(timeLeft: number, duration: number, streak: number): number {
  const speed = Math.max(SCORE_MIN_FACTOR, timeLeft / duration);
  const base  = Math.round(SCORE_BASE * speed);
  const bonus = Math.max(0, streak) * SCORE_STREAK_BONUS;
  return base + bonus;
}

function pickBonus(rng: () => number = Math.random): number {
  return BONUS_POOL[Math.floor(rng() * BONUS_POOL.length)];
}

/** The 4 choices always shown in the gift picker (order is fixed for clarity). */
const GIFT_CHOICES: GiftChoiceType[] = ["freeze", "steal", "bonus", "shield"];

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
    correctSinceGift: 0,
    gifts: [],
    shield: false,
    frozen: false,
    mysteryPicking: null,
  };
}

export interface WameethClassOptions {
  giftsEnabled?: boolean;
  freezeDuration?: number;
  rng?: () => number;
}

export function createWameethClassState(
  questions: WameethClassQuestion[],
  duration: number,
  optionsOrRng: WameethClassOptions | (() => number) = {},
): WameethClassState {
  const opts: WameethClassOptions =
    typeof optionsOrRng === "function" ? { rng: optionsOrRng } : optionsOrRng;
  const rng          = opts.rng ?? Math.random;
  const giftsEnabled = opts.giftsEnabled ?? true;
  const freezeDuration = opts.freezeDuration ?? DEFAULT_FREEZE_DUR;

  const orders = buildWameethQuestionOrders(questions.length, rng);
  return {
    status: "idle",
    countdown: 3,
    questions,
    duration,
    giftsEnabled,
    freezeDuration,
    teams: {
      blue: freshTeam(duration, orders.blue),
      red:  freshTeam(duration, orders.red),
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

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveEnd(state: WameethClassState): WameethClassState {
  const { blue, red } = state.teams;
  if (blue.phase === "exhausted" && red.phase === "exhausted") {
    const winner: TeamId | "draw" =
      blue.score > red.score ? "blue"
        : red.score > blue.score ? "red"
        : "draw";
    return { ...state, status: "finished", winner };
  }
  return state;
}

function advanceTeam(state: WameethClassState, id: TeamId): WameethClassState {
  const t = state.teams[id];
  const nextIndex = t.qIndex + 1;
  const next: WameethTeamState =
    nextIndex >= t.questionOrder.length
      ? { ...t, qIndex: nextIndex, phase: "exhausted",
          selected: null, correct: null, feedbackLeft: 0,
          frozen: false, mysteryPicking: null }
      : { ...t, qIndex: nextIndex, phase: "question",
          selected: null, correct: null,
          timeLeft: state.duration, feedbackLeft: 0,
          frozen: false, mysteryPicking: null };
  return resolveEnd({ ...state, teams: { ...state.teams, [id]: next } });
}

function tickTeam(state: WameethClassState, id: TeamId): WameethClassState {
  const t = state.teams[id];

  // Mystery picker open and not yet resolved: pause timer
  if (t.mysteryPicking !== null && t.mysteryPicking.revealed === null) return state;

  if (t.phase === "question") {
    // Frozen: timer already snapped to freezeDuration on freeze application;
    // just let it drain normally (team cannot answer while frozen).
    if (t.timeLeft > 1) {
      return { ...state, teams: { ...state.teams, [id]: { ...t, timeLeft: t.timeLeft - 1 } } };
    }
    // Timeout
    const timedOut: WameethTeamState = {
      ...t, timeLeft: 0, phase: "feedback",
      selected: null, correct: false,
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

  return state;
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
      return tickTeam(tickTeam(state, "blue"), "red");

    case "answer": {
      if (state.status !== "playing") return state;
      const t = state.teams[action.team];
      if (t.phase !== "question" || t.selected !== null || t.frozen) return state;
      const q = state.questions[t.questionOrder[t.qIndex]];
      if (!q || action.index < 0 || action.index >= q.options.length) return state;

      const correct = action.index === q.correct;
      const gain    = correct ? calcPoints(t.timeLeft, state.duration, t.streak) : 0;
      const seq     = state.impulseSeq + 1;

      const newCorrectSinceGift = correct ? t.correctSinceGift + 1 : t.correctSinceGift;
      const earnBox = state.giftsEnabled && correct
        && newCorrectSinceGift >= GIFT_EVERY_N
        && t.gifts.length < GIFT_MAX_HELD;

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
        correctSinceGift: earnBox ? 0 : newCorrectSinceGift,
        // Gift box (mystery) is the only type ever awarded
        gifts: earnBox ? [...t.gifts, "mystery" as GiftType] : t.gifts,
      };

      return resolveEnd({
        ...state,
        teams: { ...state.teams, [action.team]: answered },
        lastImpulse: { team: action.team, kind: correct ? "correct" : "wrong", id: seq },
        impulseSeq: seq,
      });
    }

    case "use-gift": {
      if (state.status !== "playing") return state;
      const { fromTeam, gift } = action;
      const selfTeam = state.teams[fromTeam];
      if (!selfTeam.gifts.includes(gift)) return state;

      const giftIdx  = selfTeam.gifts.indexOf(gift);
      const newGifts = [...selfTeam.gifts];
      newGifts.splice(giftIdx, 1);

      const seq = state.impulseSeq + 1;

      // Opening the mystery box: generate choices and pause timer
      const newSelf: WameethTeamState = {
        ...selfTeam,
        gifts: newGifts,
        mysteryPicking: {
          choices: [...GIFT_CHOICES],
          revealed: null,
          bonusAmount: pickBonus(),
        },
      };

      return {
        ...state,
        teams: { ...state.teams, [fromTeam]: newSelf },
        lastImpulse: { team: fromTeam, kind: "gift", gift: "mystery", id: seq },
        impulseSeq: seq,
      };
    }

    case "pick-mystery": {
      if (state.status !== "playing") return state;
      const t = state.teams[action.team];
      if (!t.mysteryPicking || t.mysteryPicking.revealed !== null) return state;
      if (action.idx < 0 || action.idx >= t.mysteryPicking.choices.length) return state;

      const mp      = t.mysteryPicking;
      const choice  = mp.choices[action.idx];
      const opposite: TeamId = action.team === "blue" ? "red" : "blue";
      const seq = state.impulseSeq + 1;

      // Mark as revealed first
      let newSelf: WameethTeamState = {
        ...t,
        mysteryPicking: { ...mp, revealed: action.idx },
      };
      let newOpponent = { ...state.teams[opposite] };

      // Apply effect
      if (choice === "freeze") {
        if (newOpponent.shield) {
          // Shield absorbs the freeze
          newOpponent = { ...newOpponent, shield: false };
        } else {
          // Cap opponent's remaining time to freezeDuration so they feel the pressure
          newOpponent = {
            ...newOpponent,
            frozen: true,
            timeLeft: Math.min(newOpponent.timeLeft, state.freezeDuration),
          };
        }
      } else if (choice === "steal") {
        if (newOpponent.shield) {
          newOpponent = { ...newOpponent, shield: false };
        } else {
          const stolen = Math.min(STEAL_AMOUNT, newOpponent.score);
          newOpponent = { ...newOpponent, score: newOpponent.score - stolen };
          newSelf = { ...newSelf, score: newSelf.score + stolen, lastGain: stolen };
        }
      } else if (choice === "bonus") {
        newSelf = { ...newSelf, score: newSelf.score + mp.bonusAmount, lastGain: mp.bonusAmount };
      } else if (choice === "shield") {
        newSelf = { ...newSelf, shield: true };
      }

      return {
        ...state,
        teams: { ...state.teams, [action.team]: newSelf, [opposite]: newOpponent },
        lastImpulse: { team: action.team, kind: "gift", gift: choice, id: seq },
        impulseSeq: seq,
      };
    }

    case "dismiss-mystery": {
      const t = state.teams[action.team];
      if (!t.mysteryPicking) return state;
      return {
        ...state,
        teams: {
          ...state.teams,
          [action.team]: { ...t, mysteryPicking: null },
        },
      };
    }

    default:
      return state;
  }
}
