// Levenshtein distance for fuzzy dictation grading
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

interface DictationGradingOpts {
  allowErrors?: boolean;
  ignoreDiacritics?: boolean;
  ignoreShadda?: boolean;
  ignoreTanween?: boolean;
  ignorePunctuation?: boolean;
  /** 0–30: max edit distance ratio */
  errorTolerancePercent?: number;
  /** Legacy: discrete 0–3 */
  tolerance?: number;
}

function stripArabicMarks(s: string, opts: DictationGradingOpts): string {
  let out = s;
  // Main vowel marks — not shadda / tanween (handled separately)
  if (opts.ignoreDiacritics) {
    out = out.replace(/[\u064E-\u0650\u0652\u0670]/g, "");
  }
  if (opts.ignoreTanween) {
    out = out.replace(/[\u064B\u064C\u064D]/g, "");
  }
  if (opts.ignoreShadda) {
    out = out.replace(/\u0651/g, "");
  }
  return out;
}

function stripPunctuationForGrade(s: string): string {
  return s
    .replace(/[\u060C\u061B\u061F\u066A\u066B\u066C٪٫٬.,;:!?…\-—–_/\\|[\]{}«»„‚""''‚'`´]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeDictation(studentAnswer: string, correctText: string, allowErrors: boolean, optionD?: string | null): boolean {
  let opts: DictationGradingOpts = { allowErrors };
  if (optionD) {
    try { opts = { allowErrors, ...JSON.parse(optionD) }; } catch { /* use defaults */ }
  }
  const norm = (raw: string) => {
    let t = raw.trim().replace(/\s+/g, " ").toLowerCase();
    if (opts.ignorePunctuation) t = stripPunctuationForGrade(t);
    t = stripArabicMarks(t, opts);
    return t;
  };
  const s = norm(studentAnswer);
  const c = norm(correctText);
  if (s === c) return true;
  if (!opts.allowErrors) return false;
  let rate: number;
  if (typeof opts.errorTolerancePercent === "number" && !Number.isNaN(opts.errorTolerancePercent)) {
    const p = Math.min(30, Math.max(0, opts.errorTolerancePercent));
    rate = p / 100;
  } else {
    const tol = typeof opts.tolerance === "number" ? opts.tolerance : 1;
    const legacyRates = [0.01, 0.15, 0.25, 0.35];
    rate = legacyRates[Math.min(tol, 3)];
  }
  const maxDist = Math.max(1, Math.floor(c.length * rate));
  return levenshtein(s, c) <= maxDist;
}

export interface GameQuestion {
  id: number;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
  imageUrl: string | null;
  questionType: string;
  readAloud: boolean;
}

export type GiftType = "freeze" | "mystery" | "give" | "shield" | "steal";

export interface PendingGift {
  type: GiftType | null;
  available: boolean;
}

export type GameMode = "solo" | "teams";

export type MysteryBoxType = "double" | "bonus" | "hack" | "nothing";

export interface MysteryBoxSlot {
  type: MysteryBoxType;
  amount: number;
}

export interface GamePlayer {
  socketId: string;
  name: string;
  avatar: string;
  studentId?: number | null;
  studentAccountId?: number | null;
  score: number;
  streak: number;
  totalCorrect: number;
  hackWrongCount: number;
  pendingGift: PendingGift;
  frozenForQuestion: number;
  hasShield: boolean;
  freezeUsed: boolean;
  frozenOnce: boolean;
  stolenOnce: boolean;
  stealTarget: string | null;
  freezeTarget: string | null;
  usedGiftTypes: Set<string>;
  answers: Map<number, { answer: string; time: number; correct: boolean; points: number }>;
  teamName: string | null;
  isBot: boolean;
  botAccuracy?: number;
  disconnected?: boolean;
  password?: string;
  passwordChoices?: string[];
  pendingMysteryBoxes?: MysteryBoxSlot[] | null;
  pendingHackSession?: {
    hackTargets: { name: string; avatar: string }[];
    targetName?: string;
    used: boolean;
  } | null;
  successfulHackCount?: number;
  // Per-player async question flow (used in hack mode marathon)
  personalQuestionOrder?: number[];
  personalQuestionIndex?: number;
  personalCurrentQuestionId?: number;
  personalCurrentQuestionStartTime?: number;
  personalAnsweredCount?: number;
  personalCycle?: number;
  personalShuffledCorrectAnswer?: string | null;
  personalShuffledOptions?: { optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null } | null;
  // Monotonic id incremented every time the server emits a new personal-question
  // event for this player. Echoed back by the client on submit-answer so the
  // server can reject stale submits that would otherwise be graded against the
  // wrong question's shuffled correct answer (cause of "correct marked wrong").
  personalQuestionInstanceId?: number;
  personalFinished?: boolean;
  personalPriorityQueue?: number[];
  hackReadyForNextTimerId?: ReturnType<typeof setTimeout> | null;
  mysteryBoxAutoPickTimerId?: ReturnType<typeof setTimeout> | null;
}

export type GameState = "lobby" | "question" | "leaderboard" | "gift-round" | "finished";

export interface Game {
  pin: string;
  assignmentId: number;
  assignmentTitle: string;
  teacherSocketId: string;
  teacherId: number;
  state: GameState;
  players: Map<string, GamePlayer>;
  questions: GameQuestion[];
  originalQuestions: GameQuestion[];
  currentQuestionIndex: number;
  questionStartTime: number;
  questionDuration: number;
  answeredCount: number;
  currentTimeoutId: ReturnType<typeof setTimeout> | null;
  maxRounds: number;
  autoAdvance: boolean;
  gameMode: GameMode;
  teamCount: number;
  teamNames: string[];
  doublePointsRounds: Set<number>;
  pointsEnabled: boolean;
  giftsEnabled: boolean;
  ttsEnabled: boolean;
  teamScoreAdjustments: Map<string, number>;
  paused: boolean;
  autoAdvanceTimerId: ReturnType<typeof setTimeout> | null;
  pausedAt: number | null;
  botTimers: ReturnType<typeof setTimeout>[];
  giftRoundPending: boolean;
  giftRoundChoices: Set<string>;
  giftRoundTimerId: ReturnType<typeof setTimeout> | null;
  finishDeleteTimerId: ReturnType<typeof setTimeout> | null;
  currentShuffledCorrectAnswer: string | null;
  currentShuffledOptions: { optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null } | null;
  targetClass: string | null;
  targetClasses: string[] | null;
  hackMode: boolean;
  takenPasswords: Set<string>;
  mysteryBoxRound: number;
  // Hack-mode marathon: total game duration (server-enforced) and end timer
  hackDurationMs: number | null;
  hackDeadline: number | null;
  hackEndTimerId: ReturnType<typeof setTimeout> | null;
  // Room/team locks — when locked, NEW students cannot join the room or that team.
  // The teacher can still manually move students into a locked team.
  roomLocked: boolean;
  lockedTeams: Set<string>;
}

const games = new Map<string, Game>();

// Hard cap to prevent OOM if a buggy or malicious client floods the server
// with new games. 5000 concurrent classroom games is well above realistic
// load (each game ~50KB) and still fits comfortably in 1GB RAM.
const MAX_CONCURRENT_GAMES = parseInt(process.env.MAX_CONCURRENT_GAMES || "5000", 10);

export function getActiveGameCount(): number {
  return games.size;
}

export function isAtGameCapacity(): boolean {
  return games.size >= MAX_CONCURRENT_GAMES;
}

const TEAM_NAMES_AR = ["الأذكياء", "المتميزون", "الفائقون", "المبدعون", "الرائعون", "الرياديون"];

function generatePin(): string {
  let pin: string;
  let attempts = 0;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
    if (attempts > 1000) break;
  } while (games.has(pin));
  return pin;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickDoublePointsRounds(totalRounds: number): Set<number> {
  if (totalRounds <= 3) return new Set();
  const count = Math.min(2, Math.floor(totalRounds / 5));
  if (count === 0) return new Set();
  const candidates = Array.from({ length: totalRounds }, (_, i) => i).filter(i => i > 0 && i < totalRounds - 1);
  const shuffled = shuffleArray(candidates);
  return new Set(shuffled.slice(0, count));
}

const MIN_QUESTION_DURATION = 5;
const MAX_QUESTION_DURATION = 120;
const LOBBY_TTL_MS = 30 * 60 * 1000;
const GIVE_POINTS = 50;
const STEAL_POINTS = 75;
const MYSTERY_OPTIONS = [
  { label: "ربحت 200 نقطة! 🎉", points: 200 },
  { label: "ربحت 100 نقطة! ✨", points: 100 },
  { label: "ربحت 50 نقطة! 🌟", points: 50 },
  { label: "ربحت 75 نقطة! 😎", points: 75 },
  { label: "ربحت 150 نقطة! 🔥", points: 150 },
  { label: "ربحت 120 نقطة! ⭐", points: 120 },
];
const GIFT_ROUND_INTERVAL = 3;
const GIFT_ROUND_DURATION_MS = 20_000;

export const HACK_PASSWORD_POOL = [
  "X@k3r!9z",  "Bl4ck_0ut#", "C0d3#99!",  "N30N_H4X$",  "R3D_B1T3@",
  "V0LT!42x",  "CYB3R$5!",   "D4RK.N3T#", "GH0ST_7@x",  "Z3R0.D4Y!",
  "H4CK_J0B#", "L33T!77@",   "M4TR1X_X$", "SK1LL#88!",  "SH4D0W@6x",
  "FL1P_C0D!", "5T34LTH#x",  "CR4CK_3R@", "5CR3T@0!",   "B1T_F1R3#",
  "W4V3.H4K$", "1NF1LT8R!",  "D3BUG_99@", "PR0XY_X#!",  "F0RC3!42$",
  "5N1P3R@Xz", "PH4NT0M_7!", "R00T_K1T#", "BYP455!9@",  "C0R3.D4T$",
  "K3YL0G!8x", "V1RU5@77#",  "3X3C_X9!",  "5Y5_R00T@",  "P4YL04D!#",
  "3XPL01T#z", "TR0J4N_6@",  "BR34CH_X!",  "CYPH3R@5#",  "0V3RL04D!",
  "D4T4_L33K$","WH1T3_H4T@", "BL4CK_H4T#","R3D.T34M!",  "N3TW0RK$x",
  "F1R3W4LL!", "3NCR1PT@9#", "D3CR1PT#$", "53CUR3_X!",  "H4CK3R_1@",
  "5PH3R3_0#", "N3X7.G3N!",  "5H4D0W_3X", "V1P3R_8@!",  "@RC4N3_99#",
  "5TR1K3!7x", "D3LT4_0V#",  "M1R4G3@5!", "0M3G4_K3Y$", "PHANT0M#8z",
];

export function createGame(
  assignmentId: number,
  assignmentTitle: string,
  teacherSocketId: string,
  teacherId: number,
  questions: GameQuestion[],
  questionDuration: number = 20,
  autoAdvance: boolean = false,
  gameMode: GameMode = "solo",
  teamCount: number = 2,
  customTeamNames?: string[],
  targetClass?: string | null,
  hackMode: boolean = false,
  targetClasses?: string[] | null
): Game {
  if (games.size >= MAX_CONCURRENT_GAMES) {
    throw new Error(
      `الخادم وصل إلى الحد الأقصى من المسابقات النشطة (${MAX_CONCURRENT_GAMES}). الرجاء المحاولة لاحقاً.`,
    );
  }
  const clampedDuration = Math.max(MIN_QUESTION_DURATION, Math.min(MAX_QUESTION_DURATION, questionDuration));
  const pin = generatePin();

  const shuffled = shuffleArray(questions);

  const clampedTeamCount = Math.max(2, Math.min(6, teamCount));
  const defaultNames = TEAM_NAMES_AR.slice(0, clampedTeamCount);
  const teamNames = customTeamNames && customTeamNames.length >= clampedTeamCount
    ? customTeamNames.slice(0, clampedTeamCount).map((n, i) => n?.trim() || defaultNames[i])
    : defaultNames;
  const doublePointsRounds = pickDoublePointsRounds(shuffled.length);

  const game: Game = {
    pin,
    assignmentId,
    assignmentTitle,
    teacherSocketId,
    teacherId,
    state: "lobby",
    players: new Map(),
    questions: shuffled,
    originalQuestions: questions,
    currentQuestionIndex: -1,
    questionStartTime: 0,
    questionDuration: clampedDuration,
    answeredCount: 0,
    currentTimeoutId: null,
    maxRounds: shuffled.length,
    autoAdvance,
    gameMode,
    teamCount: clampedTeamCount,
    teamNames,
    doublePointsRounds,
    pointsEnabled: true,
    giftsEnabled: true,
    ttsEnabled: false,
    teamScoreAdjustments: new Map(),
    paused: false,
    autoAdvanceTimerId: null,
    pausedAt: null,
    botTimers: [],
    giftRoundPending: false,
    giftRoundChoices: new Set(),
    giftRoundTimerId: null,
    finishDeleteTimerId: null,
    currentShuffledCorrectAnswer: null,
    currentShuffledOptions: null,
    targetClass: targetClass || null,
    targetClasses: (targetClasses && targetClasses.length > 0) ? targetClasses : (targetClass ? [targetClass] : null),
    hackMode: !!hackMode,
    takenPasswords: new Set(),
    mysteryBoxRound: 0,
    hackDurationMs: null,
    hackDeadline: null,
    hackEndTimerId: null,
    roomLocked: false,
    lockedTeams: new Set(),
  };
  games.set(pin, game);

  setTimeout(() => {
    const g = games.get(pin);
    if (g && g.state === "lobby") {
      deleteGame(pin);
    }
  }, LOBBY_TTL_MS);

  return game;
}

export function getGame(pin: string): Game | undefined {
  return games.get(pin);
}

export function findActiveGameByTeacher(teacherId: number): Game | undefined {
  for (const game of games.values()) {
    if (game.teacherId === teacherId && game.state !== "finished") {
      return game;
    }
  }
  return undefined;
}

export function deleteGame(pin: string): void {
  const game = games.get(pin);
  if (game?.currentTimeoutId) {
    clearTimeout(game.currentTimeoutId);
    game.currentTimeoutId = null;
  }
  if (game?.autoAdvanceTimerId) {
    clearTimeout(game.autoAdvanceTimerId);
    game.autoAdvanceTimerId = null;
  }
  if (game?.giftRoundTimerId) {
    clearTimeout(game.giftRoundTimerId);
    game.giftRoundTimerId = null;
  }
  if (game?.finishDeleteTimerId) {
    clearTimeout(game.finishDeleteTimerId);
    game.finishDeleteTimerId = null;
  }
  if (game?.botTimers) {
    for (const t of game.botTimers) clearTimeout(t);
    game.botTimers = [];
  }
  if (game?.hackEndTimerId) {
    clearTimeout(game.hackEndTimerId);
    game.hackEndTimerId = null;
  }
  games.delete(pin);
}

export function clearQuestionTimeout(game: Game): void {
  if (game.currentTimeoutId) {
    clearTimeout(game.currentTimeoutId);
    game.currentTimeoutId = null;
  }
}

export function resetGameToLobby(game: Game): void {
  clearQuestionTimeout(game);
  if (game.autoAdvanceTimerId) {
    clearTimeout(game.autoAdvanceTimerId);
    game.autoAdvanceTimerId = null;
  }
  if (game.giftRoundTimerId) {
    clearTimeout(game.giftRoundTimerId);
    game.giftRoundTimerId = null;
  }
  if (game.finishDeleteTimerId) {
    clearTimeout(game.finishDeleteTimerId);
    game.finishDeleteTimerId = null;
  }
  for (const t of game.botTimers) clearTimeout(t);
  game.botTimers = [];
  if (game.hackEndTimerId) {
    clearTimeout(game.hackEndTimerId);
    game.hackEndTimerId = null;
  }

  game.state = "lobby";
  game.currentQuestionIndex = -1;
  game.questionStartTime = 0;
  game.answeredCount = 0;
  game.paused = false;
  game.pausedAt = null;
  game.giftRoundPending = false;
  game.giftRoundChoices = new Set();
  game.currentShuffledCorrectAnswer = null;
  game.currentShuffledOptions = null;
  game.takenPasswords = new Set();
  game.mysteryBoxRound = 0;
  game.hackDeadline = null;

  const shuffled = shuffleArray(game.originalQuestions);
  game.questions = shuffled;
  game.maxRounds = shuffled.length;
  game.doublePointsRounds = pickDoublePointsRounds(shuffled.length);

  for (const [socketId, player] of game.players.entries()) {
    if (player.disconnected) {
      game.players.delete(socketId);
      continue;
    }
    if (player.isBot) continue;
    player.score = 0;
    player.streak = 0;
    player.totalCorrect = 0;
    player.hackWrongCount = 0;
    player.answers = new Map();
    player.pendingGift = { type: null, available: false };
    player.frozenForQuestion = -1;
    player.hasShield = false;
    player.freezeUsed = false;
    player.frozenOnce = false;
    player.stolenOnce = false;
    player.stealTarget = null;
    player.freezeTarget = null;
    player.usedGiftTypes = new Set();
    player.password = undefined;
    player.passwordChoices = undefined;
    player.pendingMysteryBoxes = null;
    player.pendingHackSession = null;
    player.successfulHackCount = 0;
    player.personalQuestionOrder = undefined;
    player.personalQuestionIndex = undefined;
    player.personalCurrentQuestionId = undefined;
    player.personalCurrentQuestionStartTime = undefined;
    player.personalAnsweredCount = undefined;
    player.personalCycle = undefined;
    player.personalShuffledCorrectAnswer = undefined;
    player.personalShuffledOptions = undefined;
    player.personalFinished = undefined;
  }

  const botsToRemove: string[] = [];
  for (const [socketId, player] of game.players.entries()) {
    if (player.isBot) botsToRemove.push(socketId);
  }
  for (const id of botsToRemove) game.players.delete(id);

  game.teamScoreAdjustments = new Map();
}

function getSmallestTeam(game: Game): string {
  const teamCounts = new Map<string, number>();
  for (const tn of game.teamNames) {
    teamCounts.set(tn, 0);
  }
  for (const player of game.players.values()) {
    if (player.teamName) {
      teamCounts.set(player.teamName, (teamCounts.get(player.teamName) || 0) + 1);
    }
  }
  // Prefer teams that are NOT locked. Fallback to all teams if every team is locked
  // (so addPlayer can still place the player somewhere rather than crashing).
  const unlocked = game.teamNames.filter((tn) => !game.lockedTeams.has(tn));
  const candidates = unlocked.length > 0 ? unlocked : game.teamNames;
  let minTeam = candidates[0];
  let minCount = Infinity;
  for (const tn of candidates) {
    const count = teamCounts.get(tn) ?? 0;
    if (count < minCount) {
      minCount = count;
      minTeam = tn;
    }
  }
  return minTeam;
}

// Assign players to teams using a balanced random distribution.
// We KEEP the team names already configured on the game (defaults from
// TEAM_NAMES_AR or customTeamNames provided by the teacher) — we no
// longer relabel teams using alphabetical first-letter chunks.
export function assignTeamsAlphabetically(game: Game): void {
  if (game.gameMode !== "teams" || game.players.size === 0) return;

  const playersList = shuffleArray(
    Array.from(game.players.values()).filter((p) => !p.disconnected),
  );
  if (playersList.length === 0) return;
  const allTeamNames = game.teamNames.length > 0
    ? game.teamNames
    : TEAM_NAMES_AR.slice(0, Math.max(2, Math.min(6, game.teamCount)));

  game.teamScoreAdjustments.clear();
  for (const tn of allTeamNames) {
    game.teamScoreAdjustments.set(tn, 0);
  }

  // Prefer unlocked teams; if all teams are locked, fall back to all teams
  // so we still produce a valid assignment.
  const eligibleTeams = allTeamNames.filter((tn) => !game.lockedTeams.has(tn));
  const targetTeams = eligibleTeams.length > 0 ? eligibleTeams : allTeamNames;

  // Round-robin assign so team sizes differ by at most 1.
  for (let i = 0; i < playersList.length; i++) {
    playersList[i].teamName = targetTeams[i % targetTeams.length];
  }

  game.teamNames = allTeamNames;
}

export function setRoomLocked(pin: string, locked: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  const wasLocked = game.roomLocked;
  game.roomLocked = !!locked;
  // When unlocking the lobby, purge any disconnected lobby player records
  // we held onto only to support reconnect-while-locked. They no longer
  // need protection and would otherwise linger as ghosts.
  if (wasLocked && !game.roomLocked && game.state === "lobby") {
    for (const [socketId, player] of Array.from(game.players.entries())) {
      if (player.disconnected && !player.isBot) {
        game.players.delete(socketId);
      }
    }
  }
  return true;
}

export function isRoomLocked(pin: string): boolean {
  const game = games.get(pin);
  return !!game?.roomLocked;
}

export function setTeamLocked(pin: string, teamName: string, locked: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  if (!game.teamNames.includes(teamName)) return false;
  if (locked) game.lockedTeams.add(teamName);
  else game.lockedTeams.delete(teamName);
  return true;
}

export function movePlayerToTeam(pin: string, playerName: string, teamName: string): { player: GamePlayer; oldTeam: string | null } | null {
  const game = games.get(pin);
  if (!game) return null;
  if (game.gameMode !== "teams") return null;
  if (!game.teamNames.includes(teamName)) return null;
  for (const p of game.players.values()) {
    if (p.name === playerName) {
      const oldTeam = p.teamName;
      p.teamName = teamName;
      return { player: p, oldTeam };
    }
  }
  return null;
}

export function addPlayer(pin: string, socketId: string, name: string, avatar: string = "🦁", studentId?: number | null, studentAccountId?: number | null): GamePlayer | null {
  const game = games.get(pin);
  if (!game || game.state === "finished") return null;

  const existingByName = Array.from(game.players.entries()).find(
    ([, p]) => p.name === name
  );
  if (existingByName) {
    const [oldSocketId, existingPlayer] = existingByName;
    if (existingPlayer.isBot) {
      game.players.delete(oldSocketId);
    } else {
      if (oldSocketId !== socketId) {
        game.players.delete(oldSocketId);
        existingPlayer.socketId = socketId;
        game.players.set(socketId, existingPlayer);
      }
      existingPlayer.disconnected = false;
      if (studentAccountId) existingPlayer.studentAccountId = studentAccountId;
      console.log(`[GAME ${pin}] Player "${name}" reconnected (score=${existingPlayer.score})`);
      return existingPlayer;
    }
  }

  const teamName = game.gameMode === "teams" ? getSmallestTeam(game) : null;

  const player: GamePlayer = {
    socketId,
    name,
    avatar,
    studentId: studentId || null,
    studentAccountId: studentAccountId || null,
    score: 0,
    streak: 0,
    totalCorrect: 0,
    hackWrongCount: 0,
    pendingGift: { type: null, available: false },
    frozenForQuestion: -1,
    hasShield: false,
    freezeUsed: false,
    frozenOnce: false,
    stolenOnce: false,
    stealTarget: null,
    freezeTarget: null,
    usedGiftTypes: new Set(),
    answers: new Map(),
    teamName,
    isBot: false,
  };
  game.players.set(socketId, player);
  return player;
}

export function removePlayer(pin: string, socketId: string): void {
  const game = games.get(pin);
  if (!game) return;
  // In lobby we normally drop the player record so the lobby reflects who's
  // really there. But if the room is locked, dropping the record would
  // prevent the same player from rejoining (the join handler relies on the
  // existing player record to detect a reconnect). Keep the record alive
  // while locked so reconnection works.
  if (game.state === "lobby" && !game.roomLocked) {
    game.players.delete(socketId);
  } else {
    const player = game.players.get(socketId);
    if (player) {
      player.disconnected = true;
      console.log(`[GAME ${pin}] Player "${player.name}" marked disconnected (score=${player.score})`);
    }
  }
}

export function kickPlayerByName(pin: string, playerName: string): { socketId: string; name: string } | null {
  const game = games.get(pin);
  if (!game) return null;
  for (const [socketId, player] of game.players.entries()) {
    if (player.name === playerName) {
      game.players.delete(socketId);
      return { socketId, name: player.name };
    }
  }
  return null;
}

export function setPointsEnabled(pin: string, enabled: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  game.pointsEnabled = enabled;
  return true;
}

export function setGiftsEnabled(pin: string, enabled: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  game.giftsEnabled = enabled;
  return true;
}

export function setTtsEnabled(pin: string, enabled: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  game.ttsEnabled = enabled;
  return true;
}

export function setHackMode(pin: string, enabled: boolean): boolean {
  const game = games.get(pin);
  if (!game) return false;
  game.hackMode = enabled;
  if (enabled) {
    game.giftsEnabled = false;
  }
  return true;
}

export function generatePasswordChoices(game: Game): string[] {
  const available = HACK_PASSWORD_POOL.filter(w => !game.takenPasswords.has(w));
  const shuffled = shuffleArray(available);
  return shuffled.slice(0, Math.min(5, shuffled.length));
}

export function claimPlayerPassword(game: Game, socketId: string, word: string): boolean {
  if (game.state !== "lobby" && game.state !== "question" && game.state !== "leaderboard") return false;
  const player = game.players.get(socketId);
  if (!player) return false;
  if (player.password) return false;
  if (!player.passwordChoices?.includes(word)) return false;
  if (game.takenPasswords.has(word)) return false;
  game.takenPasswords.add(word);
  player.password = word;
  player.passwordChoices = undefined;
  for (const p of game.players.values()) {
    if (p.socketId !== socketId && p.passwordChoices) {
      p.passwordChoices = p.passwordChoices.filter(w => w !== word);
    }
  }
  return true;
}

export function generateMysteryBoxes(game: Game, _questionPoints: number, hackerSocketId?: string): MysteryBoxSlot[] {
  const activePlayers = Array.from(game.players.values()).filter(p => !p.isBot && !p.disconnected);
  const enoughPlayers = activePlayers.length >= 3;
  // Cap each player at 3 successful hacks per game.
  const hacker = hackerSocketId ? game.players.get(hackerSocketId) : undefined;
  const underHackCap = !hacker || (hacker.successfulHackCount ?? 0) < 3;
  const canHack = enoughPlayers && underHackCap;

  // mysteryBoxRound is incremented once per question round (in nextQuestion),
  // before any answers arrive, so all players in the same round get the same pattern.
  //
  // 3 boxes every round. Hack is ALWAYS one of the three.
  // The other 2 rotate across 3 patterns to keep variety:
  //   Pattern 0: hack + bonus   + double
  //   Pattern 1: hack + nothing + bonus
  //   Pattern 2: hack + double  + nothing
  const pattern = game.mysteryBoxRound % 3;
  const randomBonus = () => Math.floor(Math.random() * 401) + 150;
  const hackSlot = (): MysteryBoxSlot =>
    canHack ? { type: "hack", amount: 0 } : { type: "bonus", amount: randomBonus() };

  let types: MysteryBoxSlot[];
  if (pattern === 0) {
    types = [
      hackSlot(),
      { type: "bonus", amount: randomBonus() },
      { type: "double", amount: 0 },
    ];
  } else if (pattern === 1) {
    types = [
      hackSlot(),
      { type: "nothing", amount: 0 },
      { type: "bonus", amount: randomBonus() },
    ];
  } else {
    types = [
      hackSlot(),
      { type: "double", amount: 0 },
      { type: "nothing", amount: 0 },
    ];
  }
  return shuffleArray(types);
}

export function applyMysteryBox(game: Game, socketId: string, boxIndex: number): {
  success: boolean;
  box?: MysteryBoxSlot;
  newScore?: number;
  hackTargets?: { name: string; avatar: string }[];
} {
  const player = game.players.get(socketId);
  if (!player || !player.pendingMysteryBoxes) return { success: false };
  const boxes = player.pendingMysteryBoxes;
  if (boxIndex < 0 || boxIndex >= boxes.length) return { success: false };
  let box = boxes[boxIndex];
  player.pendingMysteryBoxes = null;

  if (box.type === "double") {
    const before = player.score;
    player.score = before * 2;
    box = { ...box, amount: before }; // amount = original score for display
  } else if (box.type === "bonus") {
    player.score += box.amount;
  } else if (box.type === "nothing") {
    // No score change — empty box
  } else if (box.type === "hack") {
    // In team mode, only opposing-team players can be hacked (so a player can't
    // steal points from their own teammates). In solo mode, all other players
    // are valid targets. Targets must also already have a chosen password —
    // otherwise the hack flow soft-locks on the password-choices step.
    const hackTargets = Array.from(game.players.values())
      .filter(p =>
        !p.isBot &&
        !p.disconnected &&
        !!p.password &&
        p.socketId !== socketId &&
        (game.gameMode !== "teams" || !player.teamName || p.teamName !== player.teamName)
      )
      .map(p => ({ name: p.name, avatar: p.avatar }));
    if (hackTargets.length === 0) {
      // No valid hack targets right now (e.g. teammates only, opponents
      // disconnected, or no one has set a password yet). Downgrade to a
      // bonus box so the student isn't soft-locked waiting on a hack flow
      // that can never resolve.
      const bonusAmount = Math.floor(Math.random() * 401) + 150;
      const fallback: MysteryBoxSlot = { type: "bonus", amount: bonusAmount };
      player.score += bonusAmount;
      return { success: true, box: fallback, newScore: player.score };
    }
    player.pendingHackSession = { hackTargets, used: false };
    return { success: true, box, newScore: player.score, hackTargets };
  }

  return { success: true, box, newScore: player.score };
}

export function getHackPasswordChoices(game: Game, targetName: string, hackerSocketId: string): string[] | null {
  const target = Array.from(game.players.values()).find(p => p.name === targetName);
  if (!target || !target.password) return null;

  const realPassword = target.password;
  const otherPasswords = Array.from(game.players.values())
    .filter(p => p.password && p.password !== realPassword && p.socketId !== hackerSocketId && !p.isBot)
    .map(p => p.password as string);

  const fakes: string[] = [];
  const shuffledOthers = shuffleArray(otherPasswords);
  fakes.push(...shuffledOthers.slice(0, 2));

  while (fakes.length < 2) {
    const fallback = HACK_PASSWORD_POOL.filter(w => w !== realPassword && !fakes.includes(w));
    const picked = shuffleArray(fallback)[0];
    if (picked) fakes.push(picked);
    else break;
  }

  return shuffleArray([realPassword, ...fakes.slice(0, 2)]);
}

export function resolveHackAttempt(game: Game, hackerSocketId: string, targetName: string, guessedPassword: string): {
  success: boolean;
  stolenAmount?: number;
  hackerScore?: number;
  targetScore?: number;
  targetSocketId?: string;
} {
  const hacker = game.players.get(hackerSocketId);
  if (!hacker) return { success: false };

  const session = hacker.pendingHackSession;
  if (!session || session.used) return { success: false };
  if (session.targetName && session.targetName !== targetName) return { success: false };

  session.used = true;
  hacker.pendingHackSession = null;

  const target = Array.from(game.players.values()).find(p => p.name === targetName);
  if (!target) return { success: false };

  if (target.password !== guessedPassword) return { success: false };

  const desired = Math.max(50, Math.floor(target.score * 0.15));
  const stolenAmount = Math.min(target.score, desired);
  target.score -= stolenAmount;
  hacker.score += stolenAmount;
  hacker.successfulHackCount = (hacker.successfulHackCount ?? 0) + 1;

  return {
    success: true,
    stolenAmount,
    hackerScore: hacker.score,
    targetScore: target.score,
    targetSocketId: target.socketId,
  };
}

export function getActivePlayerCount(game: Game): number {
  let count = 0;
  for (const p of game.players.values()) {
    if (!p.disconnected) count++;
  }
  return count;
}

export function getPlayerList(game: Game) {
  return Array.from(game.players.values())
    .filter((p) => !p.disconnected)
    .map((p) => ({
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      teamName: p.teamName,
      isBot: p.isBot || false,
      hasPassword: game.hackMode ? !!p.password : undefined,
    }));
}

const BOT_NAMES = ["سالم", "نورة", "عبدالله", "فاطمة", "محمد", "منى", "خالد", "لطيفة", "أحمد", "مريم", "عمر", "هيا"];
const BOT_AVATARS = ["🐶", "🐱", "🦊", "🐸", "🐯", "🦁", "🐧", "🦋", "🌟", "🎯", "🚀", "🎮"];

export function addBotPlayers(game: Game, count: number): GamePlayer[] {
  const clampedCount = Math.max(1, Math.min(8, count));
  const added: GamePlayer[] = [];

  const usedNames = new Set(Array.from(game.players.values()).map(p => p.name));
  const availableNames = BOT_NAMES.filter(n => !usedNames.has(n));

  for (let i = 0; i < clampedCount; i++) {
    const nameIndex = i % availableNames.length;
    let name = availableNames[nameIndex] || `بوت ${i + 1}`;
    if (usedNames.has(name)) name = `${name} ${i + 1}`;
    usedNames.add(name);

    const avatar = BOT_AVATARS[i % BOT_AVATARS.length];
    const accuracy = 0.3 + Math.random() * 0.6;
    const socketId = `bot:${game.pin}:${Date.now()}:${i}`;
    const teamName = game.gameMode === "teams" ? getSmallestTeam(game) : null;

    const player: GamePlayer = {
      socketId,
      name,
      avatar,
      score: 0,
      streak: 0,
      totalCorrect: 0,
      hackWrongCount: 0,
      pendingGift: { type: null, available: false },
      frozenForQuestion: -1,
      hasShield: false,
      freezeUsed: false,
      frozenOnce: false,
      stolenOnce: false,
      stealTarget: null,
      freezeTarget: null,
      usedGiftTypes: new Set(),
      answers: new Map(),
      teamName,
      isBot: true,
      botAccuracy: accuracy,
    };

    game.players.set(socketId, player);
    added.push(player);
  }

  return added;
}

// ============================================================================
// Hack-mode "marathon" — per-player async question flow
// ============================================================================

export function initPersonalSequencesForHack(game: Game): void {
  if (!game.hackMode || game.questions.length === 0) return;
  const totalIndices = Array.from({ length: game.questions.length }, (_, i) => i);
  for (const player of game.players.values()) {
    if (player.isBot || player.disconnected) continue;
    player.personalQuestionOrder = shuffleArray(totalIndices);
    player.personalQuestionIndex = -1;
    player.personalAnsweredCount = 0;
    player.personalCycle = 0;
    player.personalCurrentQuestionId = undefined;
    player.personalCurrentQuestionStartTime = undefined;
    player.personalShuffledCorrectAnswer = null;
    player.personalShuffledOptions = null;
    player.personalFinished = false;
    player.personalPriorityQueue = [];
    player.answers = new Map();
  }
}

export function getNextPersonalQuestion(game: Game, player: GamePlayer): { question: GameQuestion; orderIndex: number; cycle: number } | null {
  if (!player.personalQuestionOrder || player.personalQuestionOrder.length === 0) return null;
  if (player.personalFinished) return null;

  let idx = (player.personalQuestionIndex ?? -1) + 1;
  if (idx >= player.personalQuestionOrder.length) {
    // Reshuffle for a new cycle. Avoid repeating the very last question first.
    const lastQ = player.personalCurrentQuestionId;
    let newOrder = shuffleArray(player.personalQuestionOrder);
    if (newOrder.length > 1 && newOrder[0] === lastQ) {
      [newOrder[0], newOrder[1]] = [newOrder[1], newOrder[0]];
    }
    // Prepend any priority questions from the previous cycle's boundary miss
    if (player.personalPriorityQueue && player.personalPriorityQueue.length > 0) {
      const priority = player.personalPriorityQueue;
      player.personalPriorityQueue = [];
      // Remove priority questions from their normal position first, then prepend
      const deduped = newOrder.filter((q) => !priority.includes(q));
      newOrder = [...priority, ...deduped];
    }
    player.personalQuestionOrder = newOrder;
    player.personalCycle = (player.personalCycle ?? 0) + 1;
    idx = 0;
  }

  const qIdx = player.personalQuestionOrder[idx];
  const question = game.questions[qIdx];
  player.personalQuestionIndex = idx;
  player.personalCurrentQuestionId = qIdx;
  player.personalCurrentQuestionStartTime = Date.now();
  return { question, orderIndex: qIdx, cycle: player.personalCycle ?? 0 };
}

export function setPersonalShuffledOptions(player: GamePlayer, opts: { optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null }, correct: string | null): number {
  player.personalShuffledOptions = opts;
  player.personalShuffledCorrectAnswer = correct;
  player.personalQuestionInstanceId = (player.personalQuestionInstanceId ?? 0) + 1;
  return player.personalQuestionInstanceId;
}

export function submitPersonalAnswer(
  game: Game,
  socketId: string,
  answer: string,
  questionInstanceId?: number
): { correct: boolean; points: number; streak: number; totalScore: number; questionId: number; correctAnswer: string | null } | null {
  const player = game.players.get(socketId);
  if (!player) return null;
  if (player.personalCurrentQuestionId === undefined) return null;
  // Reject stale submits whose instance id doesn't match the current question.
  // Without this, a slow submit can be graded against a NEWER question's
  // shuffled correct answer, causing a correct visual choice to be marked wrong.
  if (
    typeof questionInstanceId === "number" &&
    typeof player.personalQuestionInstanceId === "number" &&
    questionInstanceId !== player.personalQuestionInstanceId
  ) {
    return null;
  }
  const qIndex = player.personalCurrentQuestionId;
  const question = game.questions[qIndex];
  if (!question) return null;

  const startTime = player.personalCurrentQuestionStartTime ?? Date.now();
  const elapsed = (Date.now() - startTime) / 1000;
  const qType = question.questionType || "mcq";
  let correct = false;
  if (qType === "fill_blank") {
    const studentAns = (answer || "").trim().toLowerCase();
    const acceptedAnswers = (question.correctAnswer || "").split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
    correct = acceptedAnswers.length > 0 && acceptedAnswers.some(a => a === studentAns);
  } else if (qType === "dictation") {
    const allowErrors = question.optionC !== "false";
    correct = gradeDictation(answer || "", question.correctAnswer || question.optionA || "", allowErrors, question.optionD);
  } else if (qType === "mcq" && player.personalShuffledCorrectAnswer) {
    correct = answer === player.personalShuffledCorrectAnswer;
  } else {
    correct = answer === question.correctAnswer;
  }

  let points = 0;
  if (correct) {
    player.streak++;
    player.totalCorrect++;
    if (game.pointsEnabled) {
      const timeBonus = Math.max(0, 1 - elapsed / Math.max(5, game.questionDuration));
      const basePoints = question.points * 100;
      points = Math.round(basePoints * (0.5 + 0.5 * timeBonus));
      if (player.streak >= 3) {
        points = Math.round(points * (1 + (player.streak - 2) * 0.1));
      }
    }
  } else {
    player.streak = 0;
    player.hackWrongCount = (player.hackWrongCount ?? 0) + 1;
  }

  player.score += points;
  player.personalAnsweredCount = (player.personalAnsweredCount ?? 0) + 1;
  // Track answer in player.answers using a unique key per cycle so re-attempts don't collide
  const answerKey = (player.personalCycle ?? 0) * 10000 + qIndex;
  player.answers.set(answerKey, { answer, time: elapsed, correct, points });

  // Prioritize wrong questions: insert the question index twice more into the upcoming queue.
  // If at cycle boundary, defer to personalPriorityQueue so next cycle starts with this question.
  if (!correct && player.personalQuestionOrder) {
    const remaining = player.personalQuestionOrder.slice((player.personalQuestionIndex ?? 0) + 1);
    if (remaining.length > 0) {
      const insertAt1 = Math.floor(Math.random() * remaining.length);
      remaining.splice(insertAt1, 0, qIndex);
      const insertAt2 = 1 + Math.floor(Math.random() * remaining.length);
      remaining.splice(insertAt2, 0, qIndex);
      player.personalQuestionOrder = [
        ...player.personalQuestionOrder.slice(0, (player.personalQuestionIndex ?? 0) + 1),
        ...remaining,
      ];
    } else {
      // At cycle boundary — queue this question to appear early in the next cycle
      if (!player.personalPriorityQueue) player.personalPriorityQueue = [];
      if (!player.personalPriorityQueue.includes(qIndex)) {
        player.personalPriorityQueue.push(qIndex);
      }
    }
  }

  // Clear current question marker so subsequent submits don't re-score
  player.personalCurrentQuestionId = undefined;
  player.personalShuffledCorrectAnswer = null;
  player.personalShuffledOptions = null;

  return {
    correct,
    points,
    streak: player.streak,
    totalScore: player.score,
    questionId: qIndex,
    correctAnswer: question.correctAnswer,
  };
}

export function startHackTimer(game: Game, durationMs: number, onEnd: () => void): void {
  if (game.hackEndTimerId) {
    clearTimeout(game.hackEndTimerId);
    game.hackEndTimerId = null;
  }
  game.hackDurationMs = durationMs;
  game.hackDeadline = Date.now() + durationMs;
  game.hackEndTimerId = setTimeout(() => {
    game.hackEndTimerId = null;
    onEnd();
  }, durationMs);
}

export function markPlayerHackFinished(player: GamePlayer): void {
  player.personalFinished = true;
  player.personalCurrentQuestionId = undefined;
}

export function nextQuestion(game: Game): GameQuestion | null {
  game.currentQuestionIndex++;
  if (game.hackMode) {
    game.mysteryBoxRound += 1;
  }
  console.log(`[GAME ${game.pin}] nextQuestion: index=${game.currentQuestionIndex}, total=${game.questions.length}, state=${game.state}`);
  if (game.currentQuestionIndex >= game.questions.length) {
    game.state = "finished";
    console.log(`[GAME ${game.pin}] FINISHED: all ${game.questions.length} questions done`);
    return null;
  }
  game.state = "question";
  game.questionStartTime = Date.now();
  game.answeredCount = 0;
  return game.questions[game.currentQuestionIndex];
}

export function isDoublePointsRound(game: Game): boolean {
  return game.doublePointsRounds.has(game.currentQuestionIndex);
}

export function submitAnswer(
  game: Game,
  socketId: string,
  answer: string
): { correct: boolean; points: number; streak: number; totalScore: number; giftEarned: boolean; frozen?: boolean } | null {
  const player = game.players.get(socketId);
  if (!player || game.state !== "question") return null;

  const qIndex = game.currentQuestionIndex;
  if (player.answers.has(qIndex)) return null;

  if (player.frozenForQuestion === qIndex) {
    player.answers.set(qIndex, { answer: "", time: 0, correct: false, points: 0 });
    game.answeredCount++;
    return { correct: false, points: 0, streak: 0, totalScore: player.score, giftEarned: false, frozen: true };
  }

  const question = game.questions[qIndex];
  const elapsed = (Date.now() - game.questionStartTime) / 1000;
  const qType = question.questionType || "mcq";
  let correct = false;
  if (qType === "fill_blank") {
    const studentAns = (answer || "").trim().toLowerCase();
    const acceptedAnswers = (question.correctAnswer || "").split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
    correct = acceptedAnswers.length > 0 && acceptedAnswers.some(a => a === studentAns);
  } else if (qType === "dictation") {
    const allowErrors = question.optionC !== "false";
    correct = gradeDictation(answer || "", question.correctAnswer || question.optionA || "", allowErrors, question.optionD);
  } else if (qType === "mcq" && game.currentShuffledCorrectAnswer) {
    correct = answer === game.currentShuffledCorrectAnswer;
  } else {
    correct = answer === question.correctAnswer;
  }
  const isDouble = isDoublePointsRound(game);

  let points = 0;
  let giftEarned = false;

  if (correct) {
    player.streak++;
    player.totalCorrect++;

    if (game.pointsEnabled) {
      const timeBonus = Math.max(0, 1 - elapsed / game.questionDuration);
      const basePoints = question.points * 100;
      points = Math.round(basePoints * (0.5 + 0.5 * timeBonus));

      if (player.streak >= 3) {
        points = Math.round(points * (1 + (player.streak - 2) * 0.1));
      }

      if (isDouble) {
        points = points * 2;
      }
    }

  } else {
    player.streak = 0;
  }

  player.score += points;
  player.answers.set(qIndex, { answer, time: elapsed, correct, points });
  game.answeredCount++;

  return { correct, points, streak: player.streak, totalScore: player.score, giftEarned: false };
}

export function useGift(
  game: Game,
  socketId: string,
  giftType: GiftType,
  targetName?: string,
  stealAmount?: number
): { success: boolean; message: string; affectedPlayer?: string; affectedTeam?: string; pointsChanged?: number; froze?: boolean; shieldBlocked?: boolean; stolen?: boolean } {
  const player = game.players.get(socketId);
  if (!player || !player.pendingGift.available) {
    return { success: false, message: "لا توجد هدية متاحة" };
  }

  const reusableGifts: Set<string> = new Set(["steal", "mystery"]);
  if (player.usedGiftTypes.has(giftType) && !reusableGifts.has(giftType)) {
    return { success: false, message: "لقد استخدمت هذه القوة من قبل في هذه اللعبة" };
  }

  player.pendingGift = { type: null, available: false };

  if (!game.pointsEnabled) {
    return { success: false, message: "النقاط متوقفة حالياً" };
  }

  player.usedGiftTypes.add(giftType);

  if (giftType === "shield") {
    player.hasShield = true;
    return {
      success: true,
      message: "درع الحماية مفعّل! 🛡️ سيحميك من التجميد أو سحب النقاط",
    };
  }

  if (giftType === "freeze") {
    if (player.freezeUsed) {
      return { success: false, message: "لقد استخدمت التجميد مرة من قبل في هذه اللعبة" };
    }
    if (!targetName) return { success: false, message: "اختر لاعباً" };
    const target = Array.from(game.players.values()).find((p) => p.name === targetName);
    if (!target || target.socketId === socketId) return { success: false, message: "لاعب غير صالح" };

    if (game.gameMode === "teams" && player.teamName && target.teamName === player.teamName) {
      return { success: false, message: "لا يمكنك تجميد لاعب من فريقك" };
    }

    if (target.hasShield) {
      target.hasShield = false;
      return {
        success: false,
        message: `${targetName} لديه درع حماية! 🛡️ تم صد التجميد`,
        affectedPlayer: targetName,
        shieldBlocked: true,
      };
    }

    if (target.frozenOnce) {
      return { success: false, message: `${targetName} محصّن من التجميد` };
    }

    if (player.stealTarget === targetName) {
      return { success: false, message: `لا يمكنك تجميد ${targetName} بعد سحب نقاطه` };
    }

    player.freezeUsed = true;
    player.freezeTarget = targetName;
    target.frozenOnce = true;
    target.frozenForQuestion = game.currentQuestionIndex + 1;
    return {
      success: true,
      message: `جمّدت ${targetName} لسؤال واحد! 🥶`,
      affectedPlayer: targetName,
      froze: true,
    };
  }

  if (giftType === "steal") {
    if (!targetName) return { success: false, message: "اختر لاعباً" };
    const target = Array.from(game.players.values()).find((p) => p.name === targetName);
    if (!target || target.socketId === socketId) return { success: false, message: "لاعب غير صالح" };

    if (game.gameMode === "teams" && player.teamName && target.teamName === player.teamName) {
      return { success: false, message: "لا يمكنك سحب نقاط من فريقك" };
    }

    if (target.hasShield) {
      target.hasShield = false;
      return {
        success: false,
        message: `${targetName} لديه درع حماية! 🛡️ تم صد سحب النقاط`,
        affectedPlayer: targetName,
        shieldBlocked: true,
      };
    }

    if (target.stolenOnce) {
      return { success: false, message: `${targetName} محصّن من سحب النقاط` };
    }

    if (player.freezeTarget === targetName) {
      return { success: false, message: `لا يمكنك سحب نقاط ${targetName} بعد تجميده` };
    }

    const validAmounts = [30, 50, 75];
    const requestedAmount = stealAmount && validAmounts.includes(stealAmount) ? stealAmount : 30;
    const actualSteal = Math.min(requestedAmount, target.score);

    target.stolenOnce = true;
    player.stealTarget = targetName;
    target.score -= actualSteal;
    player.score += actualSteal;
    return {
      success: true,
      message: `سحبت ${actualSteal} نقطة! 💰`,
      affectedPlayer: targetName,
      pointsChanged: actualSteal,
      stolen: true,
    };
  }

  if (giftType === "mystery") {
    const outcome = MYSTERY_OPTIONS[Math.floor(Math.random() * MYSTERY_OPTIONS.length)];
    if (game.gameMode === "teams" && player.teamName && outcome.points < 0) {
      const opposingTeams = game.teamNames.filter(tn => tn !== player.teamName);
      if (opposingTeams.length > 0) {
        const targetTeam = opposingTeams[Math.floor(Math.random() * opposingTeams.length)];
        const current = game.teamScoreAdjustments.get(targetTeam) || 0;
        game.teamScoreAdjustments.set(targetTeam, current + outcome.points);
        return {
          success: true,
          message: `خُصم ${Math.abs(outcome.points)} نقطة من ${targetTeam}! 😈`,
          pointsChanged: outcome.points,
          affectedTeam: targetTeam,
        };
      }
    }
    if (game.gameMode === "teams" && player.teamName && outcome.points > 0) {
      const current = game.teamScoreAdjustments.get(player.teamName) || 0;
      game.teamScoreAdjustments.set(player.teamName, current + outcome.points);
      return {
        success: true,
        message: `ربح فريقك ${outcome.points} نقطة إضافية! 🎉`,
        pointsChanged: outcome.points,
        affectedTeam: player.teamName,
      };
    }
    player.score += Math.max(0, outcome.points);
    return {
      success: true,
      message: outcome.label,
      pointsChanged: Math.max(0, outcome.points),
    };
  }

  if (giftType === "give") {
    if (!targetName) return { success: false, message: "اختر لاعباً" };
    const target = Array.from(game.players.values()).find((p) => p.name === targetName);
    if (!target || target.socketId === socketId) return { success: false, message: "لاعب غير صالح" };

    if (game.gameMode === "teams" && player.teamName && target.teamName) {
      if (target.teamName === player.teamName) {
        return { success: false, message: "لا يمكنك إهداء نقاط لفريقك" };
      }
      const givenTeam = GIVE_POINTS;
      const current = game.teamScoreAdjustments.get(target.teamName) || 0;
      game.teamScoreAdjustments.set(target.teamName, current + givenTeam);
      return {
        success: true,
        message: `أهديت ${givenTeam} نقطة لـ ${target.teamName}! 🎁`,
        affectedPlayer: targetName,
        affectedTeam: target.teamName,
        pointsChanged: givenTeam,
      };
    }

    target.score += GIVE_POINTS;
    return {
      success: true,
      message: `أهديت ${GIVE_POINTS} نقطة لـ ${targetName}! 🎁`,
      affectedPlayer: targetName,
      pointsChanged: GIVE_POINTS,
    };
  }

  return { success: false, message: "نوع هدية غير معروف" };
}

export function getOtherPlayers(game: Game, socketId: string) {
  const currentPlayer = game.players.get(socketId);
  return Array.from(game.players.values())
    .filter((p) => {
      if (p.socketId === socketId) return false;
      if (p.disconnected) return false;
      if (game.gameMode === "teams" && currentPlayer?.teamName && p.teamName === currentPlayer.teamName) return false;
      return true;
    })
    .map((p) => ({ name: p.name, avatar: p.avatar, score: p.score, teamName: p.teamName }));
}

export function getLeaderboard(game: Game, limit?: number) {
  const players = Array.from(game.players.values())
    .map((p) => ({
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      teamName: p.teamName,
      lastAnswer: p.answers.get(game.currentQuestionIndex),
      personalAnsweredCount: p.personalAnsweredCount,
      personalCycle: p.personalCycle,
      personalQuestionIndex: p.personalQuestionIndex,
    }))
    .sort((a, b) => b.score - a.score);
  return limit ? players.slice(0, limit) : players;
}

export function getTeamLeaderboard(game: Game) {
  if (game.gameMode !== "teams") return [];

  const teamScores = new Map<string, { playerTotal: number; members: number; totalCorrect: number }>();
  for (const tn of game.teamNames) {
    teamScores.set(tn, { playerTotal: 0, members: 0, totalCorrect: 0 });
  }

  for (const player of game.players.values()) {
    if (player.teamName) {
      const ts = teamScores.get(player.teamName);
      if (ts) {
        ts.playerTotal += player.score;
        ts.members++;
        ts.totalCorrect += player.totalCorrect;
      }
    }
  }

  return Array.from(teamScores.entries())
    .map(([name, data]) => {
      const adjustment = game.teamScoreAdjustments.get(name) || 0;
      const totalScore = Math.max(0, data.playerTotal + adjustment);
      return {
        teamName: name,
        totalScore,
        playerTotal: data.playerTotal,
        adjustment,
        members: data.members,
        avgScore: data.members > 0 ? Math.round(data.playerTotal / data.members) : 0,
        totalCorrect: data.totalCorrect,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function getAnswerDistribution(game: Game) {
  const currentQ = game.questions[game.currentQuestionIndex];
  const qType = currentQ?.questionType || "mcq";

  let dist: Record<string, number>;
  if (qType === "true_false") {
    dist = { true: 0, false: 0 };
  } else if (qType === "fill_blank") {
    dist = {};
  } else {
    dist = { A: 0, B: 0, C: 0, D: 0 };
  }

  for (const player of game.players.values()) {
    const ans = player.answers.get(game.currentQuestionIndex);
    if (ans) {
      if (qType === "fill_blank") {
        const key = ans.answer.trim().toLowerCase() || "(empty)";
        dist[key] = (dist[key] || 0) + 1;
      } else if (dist[ans.answer] !== undefined) {
        dist[ans.answer]++;
      }
    }
  }
  return dist;
}

export function shouldStartGiftRound(game: Game): boolean {
  if (!game.giftsEnabled || game.hackMode) return false;
  const questionNumber = game.currentQuestionIndex + 1;
  if (questionNumber >= game.questions.length) return false;
  return questionNumber % GIFT_ROUND_INTERVAL === 0;
}

export function startGiftRound(game: Game): void {
  game.state = "gift-round";
  game.giftRoundPending = true;
  game.giftRoundChoices = new Set();
  for (const player of game.players.values()) {
    player.pendingGift = { type: null, available: true };
  }
}

export function recordGiftRoundChoice(game: Game, socketId: string): void {
  game.giftRoundChoices.add(socketId);
}

export function allPlayersChoseGift(game: Game): boolean {
  const humanPlayers = Array.from(game.players.values()).filter(p => !p.isBot);
  return humanPlayers.every(p => game.giftRoundChoices.has(p.socketId));
}

export function endGiftRound(game: Game): void {
  game.giftRoundPending = false;
  if (game.giftRoundTimerId) {
    clearTimeout(game.giftRoundTimerId);
    game.giftRoundTimerId = null;
  }
  for (const player of game.players.values()) {
    if (player.pendingGift.available) {
      player.pendingGift = { type: null, available: false };
    }
  }
}

export { GIFT_ROUND_DURATION_MS };

export function findGameByTeacher(socketId: string): Game | undefined {
  for (const game of games.values()) {
    if (game.teacherSocketId === socketId) return game;
  }
  return undefined;
}

export function findGameByPlayer(socketId: string): { game: Game; player: GamePlayer } | undefined {
  for (const game of games.values()) {
    const player = game.players.get(socketId);
    if (player) return { game, player };
  }
  return undefined;
}

export function getActiveGamesCount(): number {
  let count = 0;
  for (const game of games.values()) {
    if (game.state !== "finished") count++;
  }
  return count;
}
