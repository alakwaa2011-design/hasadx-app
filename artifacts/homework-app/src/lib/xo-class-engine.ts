// Local XO classroom engine. It deliberately has no browser or React dependency.
export type XoTeam = "x" | "o";
export type XoCell = XoTeam | null;

export interface XoClassQuestion {
  text: string;
  options: string[];
  correct: number;
  type?: "mcq" | "true_false";
  imageUrl?: string | null;
}

export interface XoClassState {
  status: "idle" | "countdown" | "playing" | "finished";
  countdown: number;
  questions: XoClassQuestion[];
  duration: number;
  board: XoCell[];
  activeTeam: XoTeam;
  answeredTeams: XoTeam[];
  phase: "question" | "placement";
  questionIndex: number;
  timeLeft: number;
  winner: XoTeam | "draw" | null;
  lastResult: "correct" | "wrong" | "timeout" | "skipped" | null;
}

export type XoClassAction =
  | { type: "start" }
  | { type: "restart" }
  | { type: "tick" }
  | { type: "answer"; team: XoTeam; index: number }
  | { type: "place"; team: XoTeam; cell: number }
  | { type: "skip-placement"; team: XoTeam };

export const PLACEMENT_SECONDS = 20;
const other = (team: XoTeam): XoTeam => team === "x" ? "o" : "x";

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffledIndexes(length: number, seed: string): number[] {
  return Array.from({ length }, (_, index) => index)
    .sort((a, b) => stableHash(`${seed}:${a}`) - stableHash(`${seed}:${b}`) || a - b);
}

function rotate<T>(items: T[], amount: number): T[] {
  if (items.length < 2) return items;
  const offset = amount % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function createXoClassState(questions: XoClassQuestion[], duration: number): XoClassState {
  return {
    status: "idle", countdown: 3, questions, duration: Math.max(1, duration || 20),
    board: Array(9).fill(null), activeTeam: "x", answeredTeams: [], phase: "question", questionIndex: 0,
    timeLeft: Math.max(1, duration || 20), winner: null, lastResult: null,
  };
}

export function currentXoClassQuestion(state: XoClassState): XoClassQuestion | null {
  return state.questions.length ? state.questions[state.questionIndex % state.questions.length] : null;
}

export function currentXoClassQuestionForTeam(state: XoClassState, team: XoTeam): XoClassQuestion | null {
  if (!state.questions.length) return null;
  const questionOrder = rotate(
    shuffledIndexes(state.questions.length, "xo-class-question-order"),
    team === "x" ? 0 : 1,
  );
  const sourceIndex = questionOrder[state.questionIndex % questionOrder.length];
  const sourceQuestion = state.questions[sourceIndex];
  const optionOrder = rotate(
    shuffledIndexes(sourceQuestion.options.length, `xo-class-options:${sourceIndex}`),
    team === "x" ? 0 : 1,
  );
  const correct = optionOrder.indexOf(sourceQuestion.correct);
  return {
    ...sourceQuestion,
    options: optionOrder.map((index) => sourceQuestion.options[index]),
    correct: correct >= 0 ? correct : sourceQuestion.correct,
  };
}

export function xoWinner(board: XoCell[]): XoTeam | "draw" | null {
  const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
  for (const [a, b, c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return board.every(Boolean) ? "draw" : null;
}

function nextQuestion(state: XoClassState, team = other(state.activeTeam), result: XoClassState["lastResult"] = null): XoClassState {
  return {
    ...state, activeTeam: team, phase: "question", questionIndex: state.questionIndex + 1,
    answeredTeams: [], timeLeft: state.duration, lastResult: result,
  };
}

export function xoClassReducer(state: XoClassState, action: XoClassAction): XoClassState {
  switch (action.type) {
    case "restart":
      return createXoClassState(state.questions, state.duration);
    case "start":
      return state.status === "idle" && state.questions.length
        ? { ...state, status: "countdown", countdown: 3 } : state;
    case "tick":
      if (state.status === "countdown") return state.countdown > 1
        ? { ...state, countdown: state.countdown - 1 }
        : { ...state, status: "playing", countdown: 0, timeLeft: state.duration };
      if (state.status !== "playing") return state;
      if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
      return state.phase === "placement"
        ? nextQuestion({ ...state, timeLeft: 0 }, other(state.activeTeam), "skipped")
        : nextQuestion({ ...state, timeLeft: 0 }, other(state.activeTeam), "timeout");
    case "answer": {
      if (state.status !== "playing" || state.phase !== "question") return state;
      const question = currentXoClassQuestionForTeam(state, action.team);
      if (!question || state.answeredTeams.includes(action.team) || action.index < 0 || action.index >= question.options.length) return state;
      return action.index === question.correct
        ? { ...state, activeTeam: action.team, phase: "placement", timeLeft: PLACEMENT_SECONDS, lastResult: "correct" }
        : state.answeredTeams.length === 1
          ? nextQuestion({ ...state, answeredTeams: [...state.answeredTeams, action.team] }, other(state.activeTeam), "wrong")
          : { ...state, answeredTeams: [...state.answeredTeams, action.team], lastResult: "wrong" };
    }
    case "place": {
      if (state.status !== "playing" || state.phase !== "placement" || action.team !== state.activeTeam
        || action.cell < 0 || action.cell > 8 || state.board[action.cell]) return state;
      const board = state.board.map((cell, index) => index === action.cell ? action.team : cell);
      const winner = xoWinner(board);
      return winner ? { ...state, board, status: "finished", winner, timeLeft: 0 } : nextQuestion({ ...state, board });
    }
    case "skip-placement":
      return state.status === "playing" && state.phase === "placement" && action.team === state.activeTeam
        ? nextQuestion(state, other(state.activeTeam), "skipped") : state;
    default: return state;
  }
}