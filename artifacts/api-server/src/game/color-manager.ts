export interface ColorLevel {
  gridSize: number;
  baseHue: number;
  baseSat: number;
  baseLit: number;
  diffIndex: number;
  diffHue: number;
  diffSat: number;
  diffLit: number;
}

export function generateLevel(level: number): ColorLevel {
  const gridSize = Math.min(Math.floor((level - 1) / 2) + 2, 12);
  const baseHue = Math.floor(Math.random() * 360);
  const baseSat = 50 + Math.floor(Math.random() * 30);
  const baseLit = 35 + Math.floor(Math.random() * 25);
  const maxDiff = Math.max(3, 35 - level * 2.5);
  const litShift = (Math.random() > 0.5 ? 1 : -1) * maxDiff;
  const hueShift = (Math.random() > 0.5 ? 1 : -1) * Math.max(1, maxDiff * 0.4);
  const satShift = (Math.random() > 0.5 ? 1 : -1) * Math.max(1, maxDiff * 0.3);
  const totalCells = gridSize * gridSize;
  const diffIndex = Math.floor(Math.random() * totalCells);
  return {
    gridSize, baseHue, baseSat, baseLit, diffIndex,
    diffHue: baseHue + hueShift,
    diffSat: Math.max(10, Math.min(90, baseSat + satShift)),
    diffLit: Math.max(15, Math.min(75, baseLit + litShift)),
  };
}

export function getRoundTime(level: number): number {
  if (level <= 4) return 10;
  if (level <= 8) return 12;
  if (level <= 12) return 14;
  if (level <= 16) return 16;
  return Math.min(20, 16 + Math.floor((level - 16) / 4) * 2);
}

export interface ColorPlayer {
  id: string;
  name: string;
  score: number;
  level: number;
  alive: boolean;
  connected: boolean;
  lastAnswerTime: number;
}

export type ColorGameState = "lobby" | "countdown" | "playing" | "finished";

export interface ColorGame {
  pin: string;
  hostId: string;
  hostToken: string;
  state: ColorGameState;
  players: Map<string, ColorPlayer>;
  currentLevel: ColorLevel | null;
  currentLevelNum: number;
  roundStartTime: number;
  roundTimeout: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

const games = new Map<string, ColorGame>();

const GAME_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [pin, game] of games) {
    if (game.state === "finished" && now - game.createdAt > GAME_TTL_MS) {
      if (game.roundTimeout) clearTimeout(game.roundTimeout);
      games.delete(pin);
    }
  }
}, 60 * 1000);

export function generateColorPin(): string {
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (games.has(pin));
  return pin;
}

function generateHostToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export function createColorGame(hostId: string): ColorGame {
  const pin = generateColorPin();
  const hostToken = generateHostToken();
  const game: ColorGame = {
    pin,
    hostId,
    hostToken,
    state: "lobby",
    players: new Map(),
    currentLevel: null,
    currentLevelNum: 0,
    roundStartTime: 0,
    roundTimeout: null,
    createdAt: Date.now(),
  };
  games.set(pin, game);
  return game;
}

export function getColorGame(pin: string): ColorGame | undefined {
  return games.get(pin);
}

export function deleteColorGame(pin: string) {
  const game = games.get(pin);
  if (game?.roundTimeout) clearTimeout(game.roundTimeout);
  games.delete(pin);
}

export function addColorPlayer(pin: string, socketId: string, name: string): ColorPlayer | null {
  const game = games.get(pin);
  if (!game || game.state !== "lobby") return null;
  for (const [oldKey, p] of game.players) {
    if (p.name === name && !p.connected) {
      game.players.delete(oldKey);
      p.id = socketId;
      p.connected = true;
      game.players.set(socketId, p);
      return p;
    }
    if (p.name === name) return null;
  }
  const player: ColorPlayer = {
    id: socketId,
    name,
    score: 0,
    level: 0,
    alive: true,
    connected: true,
    lastAnswerTime: 0,
  };
  game.players.set(socketId, player);
  return player;
}

export function removeColorPlayer(pin: string, socketId: string) {
  const game = games.get(pin);
  if (!game) return;
  const player = game.players.get(socketId);
  if (player) player.connected = false;
}

export function getColorPlayerList(pin: string): { name: string; score: number; connected: boolean }[] {
  const game = games.get(pin);
  if (!game) return [];
  return Array.from(game.players.values()).map(p => ({
    name: p.name,
    score: p.score,
    connected: p.connected,
  }));
}

export function getActiveColorPlayerCount(pin: string): number {
  const game = games.get(pin);
  if (!game) return 0;
  return Array.from(game.players.values()).filter(p => p.connected && p.alive).length;
}

export function getAlivePlayerCount(pin: string): number {
  const game = games.get(pin);
  if (!game) return 0;
  return Array.from(game.players.values()).filter(p => p.connected && p.alive).length;
}

export function eliminateAfkPlayers(pin: string): void {
  const game = games.get(pin);
  if (!game) return;
  for (const [, p] of game.players) {
    if (p.connected && p.alive && p.lastAnswerTime === 0) {
      p.alive = false;
    }
  }
}

export function nextColorRound(pin: string): ColorLevel | null {
  const game = games.get(pin);
  if (!game) return null;
  game.currentLevelNum++;
  const level = generateLevel(game.currentLevelNum);
  game.currentLevel = level;
  game.roundStartTime = Date.now();
  game.state = "playing";
  for (const [, p] of game.players) {
    p.lastAnswerTime = 0;
  }
  return level;
}

export function submitColorAnswer(
  pin: string,
  socketId: string,
  cellIndex: number
): { correct: boolean; score: number; level: number; allAnswered: boolean } | null {
  const game = games.get(pin);
  if (!game || game.state !== "playing" || !game.currentLevel) return null;
  const player = game.players.get(socketId);
  if (!player || !player.alive || player.lastAnswerTime > 0) return null;

  const correct = cellIndex === game.currentLevel.diffIndex;
  const timeMs = Date.now() - game.roundStartTime;
  player.lastAnswerTime = timeMs;

  if (correct) {
    const basePoints = 100 + game.currentLevelNum * 20;
    const roundTimeMs = getRoundTime(game.currentLevelNum) * 1000;
    const speedBonus = Math.max(0, Math.floor((1 - timeMs / roundTimeMs) * 50));
    player.score += basePoints + speedBonus;
    player.level = game.currentLevelNum;
  } else {
    player.alive = false;
  }

  const alivePlayers = Array.from(game.players.values()).filter(p => p.connected && p.alive);
  const allAnswered = alivePlayers.every(p => p.lastAnswerTime > 0);

  return { correct, score: player.score, level: player.level, allAnswered };
}

export function getColorLeaderboard(pin: string): { name: string; score: number; level: number; alive: boolean; rank: number }[] {
  const game = games.get(pin);
  if (!game) return [];
  const sorted = Array.from(game.players.values())
    .sort((a, b) => b.score - a.score || b.level - a.level);
  return sorted.map((p, i) => ({
    name: p.name,
    score: p.score,
    level: p.level,
    alive: p.alive,
    rank: i + 1,
  }));
}

export function getColorResults(pin: string) {
  const game = games.get(pin);
  if (!game) return null;
  const players = Array.from(game.players.values())
    .sort((a, b) => b.score - a.score || b.level - a.level)
    .map((p, i) => ({
      name: p.name,
      score: p.score,
      level: p.level,
      rank: i + 1,
    }));
  return { players, maxLevel: game.currentLevelNum };
}

export function clearColorRoundTimeout(pin: string) {
  const game = games.get(pin);
  if (game?.roundTimeout) {
    clearTimeout(game.roundTimeout);
    game.roundTimeout = null;
  }
}

export function findColorGameByHost(socketId: string): ColorGame | undefined {
  for (const [, game] of games) {
    if (game.hostId === socketId) return game;
  }
  return undefined;
}

export function findColorGameByPlayer(socketId: string): ColorGame | undefined {
  for (const [, game] of games) {
    if (game.players.has(socketId)) return game;
  }
  return undefined;
}
