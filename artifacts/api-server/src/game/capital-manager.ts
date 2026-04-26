export interface CapitalPlayer {
  id: string;
  name: string;
  score: number;
  streak: number;
  maxStreak: number;
  answers: { questionIdx: number; answer: string; correct: boolean; timeMs: number }[];
  connected: boolean;
}

export interface CapitalQuestion {
  countryCode: string;
  countryNameAr: string;
  countryNameEn: string;
  capitalAr: string;
  capitalEn: string;
  questionMode: "country-to-capital" | "capital-to-country";
  options: { label: string; labelAr: string; value: string }[];
  correctValue: string;
}

export type CapitalGameState = "lobby" | "countdown" | "question" | "leaderboard" | "finished";

export interface CapitalGame {
  pin: string;
  hostId: string;
  state: CapitalGameState;
  tier: 1 | 2 | 3 | 4;
  questionDuration: number;
  questions: CapitalQuestion[];
  currentQuestionIdx: number;
  players: Map<string, CapitalPlayer>;
  questionTimeout: ReturnType<typeof setTimeout> | null;
  questionStartTime: number;
  answeredCount: number;
  createdAt: number;
}

const games = new Map<string, CapitalGame>();

export function generateCapitalPin(): string {
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games.has(pin));
  return pin;
}

export function createCapitalGame(
  hostId: string,
  tier: 1 | 2 | 3 | 4,
  questionDuration: number,
  questions: CapitalQuestion[]
): CapitalGame {
  const pin = generateCapitalPin();
  const game: CapitalGame = {
    pin,
    hostId,
    state: "lobby",
    tier,
    questionDuration,
    questions,
    currentQuestionIdx: -1,
    players: new Map(),
    questionTimeout: null,
    questionStartTime: 0,
    answeredCount: 0,
    createdAt: Date.now(),
  };
  games.set(pin, game);
  return game;
}

export function getCapitalGame(pin: string): CapitalGame | undefined {
  return games.get(pin);
}

export function deleteCapitalGame(pin: string) {
  const game = games.get(pin);
  if (game?.questionTimeout) clearTimeout(game.questionTimeout);
  games.delete(pin);
}

export function addCapitalPlayer(pin: string, socketId: string, name: string): CapitalPlayer | null {
  const game = games.get(pin);
  if (!game || game.state !== "lobby") return null;
  for (const [, p] of game.players) {
    if (p.name === name && !p.connected) {
      p.id = socketId;
      p.connected = true;
      return p;
    }
    if (p.name === name) return null;
  }
  const player: CapitalPlayer = {
    id: socketId,
    name,
    score: 0,
    streak: 0,
    maxStreak: 0,
    answers: [],
    connected: true,
  };
  game.players.set(socketId, player);
  return player;
}

export function removeCapitalPlayer(pin: string, socketId: string) {
  const game = games.get(pin);
  if (!game) return;
  const player = game.players.get(socketId);
  if (player) {
    player.connected = false;
  }
}

export function getCapitalPlayerList(pin: string): { name: string; score: number; streak: number; connected: boolean }[] {
  const game = games.get(pin);
  if (!game) return [];
  return Array.from(game.players.values()).map(p => ({
    name: p.name,
    score: p.score,
    streak: p.streak,
    connected: p.connected,
  }));
}

export function getActiveCapitalPlayerCount(pin: string): number {
  const game = games.get(pin);
  if (!game) return 0;
  return Array.from(game.players.values()).filter(p => p.connected).length;
}

export function nextCapitalQuestion(pin: string): CapitalQuestion | null {
  const game = games.get(pin);
  if (!game) return null;
  game.currentQuestionIdx++;
  if (game.currentQuestionIdx >= game.questions.length) {
    game.state = "finished";
    return null;
  }
  game.state = "question";
  game.questionStartTime = Date.now();
  game.answeredCount = 0;
  return game.questions[game.currentQuestionIdx];
}

export function submitCapitalAnswer(
  pin: string,
  socketId: string,
  answer: string
): { correct: boolean; score: number; streak: number; speedBonus: number; allAnswered: boolean } | null {
  const game = games.get(pin);
  if (!game || game.state !== "question") return null;
  const player = game.players.get(socketId);
  if (!player) return null;
  if (player.answers.some(a => a.questionIdx === game.currentQuestionIdx)) return null;

  const q = game.questions[game.currentQuestionIdx];
  const correct = answer === q.correctValue;
  const timeMs = Date.now() - game.questionStartTime;
  const speedBonus = correct ? Math.max(0, Math.floor((1 - timeMs / (game.questionDuration * 1000)) * 50)) : 0;
  const points = correct ? 100 + speedBonus : 0;

  player.score += points;
  if (correct) {
    player.streak++;
    if (player.streak > player.maxStreak) player.maxStreak = player.streak;
    if (player.streak >= 3) {
      player.score += 20;
    }
  } else {
    player.streak = 0;
  }

  player.answers.push({ questionIdx: game.currentQuestionIdx, answer, correct, timeMs });
  game.answeredCount++;

  const activeCount = Array.from(game.players.values()).filter(p => p.connected).length;
  const allAnswered = game.answeredCount >= activeCount;

  return { correct, score: player.score, streak: player.streak, speedBonus, allAnswered };
}

export function getCapitalLeaderboard(pin: string): { name: string; score: number; streak: number; rank: number }[] {
  const game = games.get(pin);
  if (!game) return [];
  const sorted = Array.from(game.players.values())
    .sort((a, b) => b.score - a.score);
  return sorted.map((p, i) => ({
    name: p.name,
    score: p.score,
    streak: p.streak,
    rank: i + 1,
  }));
}

export function clearCapitalQuestionTimeout(pin: string) {
  const game = games.get(pin);
  if (game?.questionTimeout) {
    clearTimeout(game.questionTimeout);
    game.questionTimeout = null;
  }
}

export function findCapitalGameByHost(socketId: string): CapitalGame | undefined {
  for (const [, game] of games) {
    if (game.hostId === socketId) return game;
  }
  return undefined;
}

export function findCapitalGameByPlayer(socketId: string): CapitalGame | undefined {
  for (const [, game] of games) {
    if (game.players.has(socketId)) return game;
  }
  return undefined;
}

export function getCapitalResults(pin: string) {
  const game = games.get(pin);
  if (!game) return null;
  const players = Array.from(game.players.values())
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      name: p.name,
      score: p.score,
      streak: p.maxStreak,
      correctCount: p.answers.filter(a => a.correct).length,
      totalQuestions: game.questions.length,
      rank: i + 1,
    }));
  return { players, totalQuestions: game.questions.length };
}
