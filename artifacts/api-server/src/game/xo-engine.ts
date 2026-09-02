/**
 * Stateless rules for the educational tic-tac-toe game.  Socket code owns
 * identities and timers; this module only accepts an already-authorized move.
 */
export type XoTeam = "x" | "o";
export type XoCell = XoTeam | null;
export type XoPhase = "question" | "placement" | "finished";

export interface XoQuestion {
  text: string;
  options: string[];
  correct: number;
  duration: number;
  type?: "mcq" | "true_false";
  imageUrl?: string | null;
}

export interface ClientXoQuestion {
  text: string;
  options: string[];
  duration: number;
  type?: "mcq" | "true_false";
  imageUrl: string | null;
}

export interface XoState {
  board: XoCell[];
  turn: XoTeam;
  phase: XoPhase;
  questionIndex: number;
  placementPlayerId: string | null;
  winner: XoTeam | "draw" | null;
}

export type XoResult =
  | { ok: true; state: XoState; correct?: boolean; winner?: XoState["winner"] }
  | { ok: false; error: string; state: XoState };

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function otherTeam(team: XoTeam): XoTeam {
  return team === "x" ? "o" : "x";
}

export function createXoState(): XoState {
  return { board: Array<XoCell>(9).fill(null), turn: "x", phase: "question", questionIndex: 0, placementPlayerId: null, winner: null };
}

export function clientQuestion(question: XoQuestion): ClientXoQuestion {
  return {
    text: question.text,
    options: [...question.options],
    duration: question.duration,
    ...(question.type === "true_false" ? { type: "true_false" as const } : {}),
    imageUrl: question.imageUrl ?? null,
  };
}

export function getWinner(board: readonly XoCell[]): XoTeam | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? "draw" : null;
}

function advanceQuestion(state: XoState, questionsLength: number): XoState {
  return {
    ...state,
    turn: otherTeam(state.turn),
    phase: "question",
    placementPlayerId: null,
    questionIndex: (state.questionIndex + 1) % questionsLength,
  };
}

/** Applies an answer from a player on the team whose turn it is. */
export function answerXoQuestion(
  state: XoState,
  questions: readonly XoQuestion[],
  playerId: string,
  team: XoTeam,
  answerIndex: number,
): XoResult {
  if (!questions.length) return { ok: false, error: "لا توجد أسئلة.", state };
  if (state.phase !== "question") return { ok: false, error: "لا يوجد سؤال نشط.", state };
  if (team !== state.turn) return { ok: false, error: "ليس دور فريقك.", state };
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= questions[state.questionIndex].options.length) {
    return { ok: false, error: "إجابة غير صالحة.", state };
  }
  const correct = answerIndex === questions[state.questionIndex].correct;
  if (!correct) return { ok: true, correct, state: advanceQuestion(state, questions.length) };
  return { ok: true, correct, state: { ...state, phase: "placement", placementPlayerId: playerId } };
}

/** Applies the one board placement earned by a correct responder. */
export function placeXoMark(state: XoState, playerId: string, team: XoTeam, cell: number, questionsLength: number): XoResult {
  if (state.phase !== "placement") return { ok: false, error: "يجب الإجابة بشكل صحيح أولاً.", state };
  if (state.placementPlayerId !== playerId) return { ok: false, error: "هذه الفرصة للاعب الذي أجاب صحيحاً.", state };
  if (team !== state.turn) return { ok: false, error: "ليس دور فريقك.", state };
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { ok: false, error: "خانة غير صالحة.", state };
  if (state.board[cell]) return { ok: false, error: "هذه الخانة مشغولة.", state };

  const board = [...state.board];
  board[cell] = team;
  const winner = getWinner(board);
  if (winner) {
    return { ok: true, winner, state: { ...state, board, phase: "finished", placementPlayerId: null, winner } };
  }
  return { ok: true, state: advanceQuestion({ ...state, board }, questionsLength) };
}

/** A timeout forfeits the active team's question and moves to the next team. */
export function timeoutXoQuestion(state: XoState, questionsLength: number): XoResult {
  if (state.phase !== "question") return { ok: false, error: "لا يوجد سؤال نشط.", state };
  if (questionsLength < 1) return { ok: false, error: "لا توجد أسئلة.", state };
  return { ok: true, state: advanceQuestion(state, questionsLength) };
}

export function validateXoQuestions(value: unknown, defaultDuration = 20): XoQuestion[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const duration = Math.max(5, Math.min(120, Math.floor(defaultDuration)));
  const questions: XoQuestion[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const q = raw as Partial<XoQuestion>;
    const text = typeof q.text === "string" ? q.text.trim() : "";
    const options = Array.isArray(q.options) ? q.options.map((option) => typeof option === "string" ? option.trim() : "") : [];
    if (!text || options.length < 2 || options.length > 4 || options.some((option) => !option)) return null;
    if (!Number.isInteger(q.correct) || q.correct! < 0 || q.correct! >= options.length) return null;
    questions.push({
      text: text.slice(0, 2000),
      options: options.map((option) => option.slice(0, 1000)),
      correct: q.correct!,
      duration: Number.isFinite(q.duration) ? Math.max(5, Math.min(120, Math.floor(q.duration!))) : duration,
      ...(q.type === "true_false" ? { type: "true_false" as const } : {}),
      imageUrl: typeof q.imageUrl === "string" ? q.imageUrl.slice(0, 2000) : null,
    });
  }
  return questions;
}