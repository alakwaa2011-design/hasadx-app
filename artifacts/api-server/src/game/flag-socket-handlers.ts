import { Server, Socket } from "socket.io";
import {
  createFlagGame,
  getFlagGame,
  deleteFlagGame,
  addFlagPlayer,
  removeFlagPlayer,
  getFlagPlayerList,
  getActiveFlagPlayerCount,
  nextFlagQuestion,
  submitFlagAnswer,
  getFlagLeaderboard,
  clearFlagQuestionTimeout,
  findFlagGameByHost,
  findFlagGameByPlayer,
  getFlagResults,
  type FlagQuestion,
} from "./flag-manager";
import { logger } from "../lib/logger";

const hostDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setupFlagSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("flag:create-game", (data: {
      tier: 1 | 2 | 3 | 4;
      questionDuration: number;
      questions: FlagQuestion[];
      questionCount: number;
    }, cb?: (res: { pin?: string; error?: string }) => void) => {
      try {
        const questions = data.questions.slice(0, data.questionCount);
        if (questions.length === 0) {
          cb?.({ error: "No questions provided" });
          return;
        }
        const game = createFlagGame(socket.id, data.tier, data.questionDuration, questions);
        socket.join(`flag:${game.pin}`);
        logger.info(`Flag game created: ${game.pin} by ${socket.id} (${questions.length} questions, tier ${data.tier})`);
        cb?.({ pin: game.pin });
      } catch (err) {
        logger.error({ err }, "Error creating flag game:");
        cb?.({ error: "Failed to create game" });
      }
    });

    socket.on("flag:rejoin-host", (data: { pin: string }, cb?: (res: { success?: boolean; error?: string }) => void) => {
      try {
        const game = getFlagGame(data.pin);
        if (!game) {
          cb?.({ error: "Game not found" });
          return;
        }
        const timer = hostDisconnectTimers.get(data.pin);
        if (timer) {
          clearTimeout(timer);
          hostDisconnectTimers.delete(data.pin);
        }
        game.hostId = socket.id;
        socket.join(`flag:${data.pin}`);
        logger.info(`Host rejoined flag game ${data.pin} as ${socket.id}`);
        cb?.({ success: true });
      } catch (err) {
        logger.error({ err }, "Error rejoining flag game:");
        cb?.({ error: "Failed to rejoin" });
      }
    });

    socket.on("flag:join-game", (data: { pin: string; name: string }, cb?: (res: {
      success?: boolean;
      questionCount?: number;
      tier?: number;
      players?: ReturnType<typeof getFlagPlayerList>;
      error?: string;
    }) => void) => {
      try {
        const game = getFlagGame(data.pin);
        if (!game) {
          cb?.({ error: "Game not found" });
          return;
        }
        if (game.state !== "lobby") {
          cb?.({ error: "Game already started" });
          return;
        }
        const player = addFlagPlayer(data.pin, socket.id, data.name.trim());
        if (!player) {
          cb?.({ error: "Name already taken" });
          return;
        }
        socket.join(`flag:${data.pin}`);
        const players = getFlagPlayerList(data.pin);
        io.to(`flag:${data.pin}`).emit("flag:player-joined", { players, name: data.name.trim() });
        logger.info(`Player ${data.name} joined flag game ${data.pin}`);
        cb?.({
          success: true,
          questionCount: game.questions.length,
          tier: game.tier,
          players,
        });
      } catch (err) {
        logger.error({ err }, "Error joining flag game:");
        cb?.({ error: "Failed to join" });
      }
    });

    socket.on("flag:start-game", (data: { pin: string }, cb?: (res: { error?: string }) => void) => {
      try {
        const game = getFlagGame(data.pin);
        if (!game || game.hostId !== socket.id) {
          cb?.({ error: "Not authorized" });
          return;
        }
        if (getActiveFlagPlayerCount(data.pin) < 1) {
          cb?.({ error: "Need at least 1 player" });
          return;
        }

        game.state = "countdown";
        io.to(`flag:${data.pin}`).emit("flag:countdown", { seconds: 3 });

        setTimeout(() => {
          sendNextFlagQuestion(io, data.pin);
        }, 3000);

        cb?.({});
      } catch (err) {
        logger.error({ err }, "Error starting flag game:");
        cb?.({ error: "Failed to start" });
      }
    });

    socket.on("flag:submit-answer", (data: { pin: string; answer: string }, cb?: (res: {
      correct?: boolean;
      score?: number;
      streak?: number;
      speedBonus?: number;
      correctAnswer?: string;
      error?: string;
    }) => void) => {
      try {
        const game = getFlagGame(data.pin);
        if (!game) {
          cb?.({ error: "Game not found" });
          return;
        }
        const result = submitFlagAnswer(data.pin, socket.id, data.answer);
        if (!result) {
          cb?.({ error: "Cannot submit" });
          return;
        }
        const q = game.questions[game.currentQuestionIdx];
        cb?.({
          correct: result.correct,
          score: result.score,
          streak: result.streak,
          speedBonus: result.speedBonus,
          correctAnswer: q.countryCode,
        });

        io.to(`flag:${data.pin}`).emit("flag:answer-update", {
          answeredCount: game.answeredCount,
          totalPlayers: getActiveFlagPlayerCount(data.pin),
        });

        if (result.allAnswered) {
          clearFlagQuestionTimeout(data.pin);
          setTimeout(() => {
            showFlagLeaderboardAndNext(io, data.pin);
          }, 800);
        }
      } catch (err) {
        logger.error({ err }, "Error submitting flag answer:");
        cb?.({ error: "Failed to submit" });
      }
    });

    socket.on("flag:next-question", (data: { pin: string }) => {
      const game = getFlagGame(data.pin);
      if (!game || game.hostId !== socket.id) return;
      sendNextFlagQuestion(io, data.pin);
    });

    socket.on("disconnect", () => {
      const hostGame = findFlagGameByHost(socket.id);
      if (hostGame) {
        const grace = setTimeout(() => {
          const game = getFlagGame(hostGame.pin);
          if (game && game.hostId === socket.id) {
            io.to(`flag:${hostGame.pin}`).emit("flag:game-ended", { reason: "host-disconnected" });
            deleteFlagGame(hostGame.pin);
          }
          hostDisconnectTimers.delete(hostGame.pin);
        }, 10000);
        hostDisconnectTimers.set(hostGame.pin, grace);
        return;
      }
      const playerGame = findFlagGameByPlayer(socket.id);
      if (playerGame) {
        removeFlagPlayer(playerGame.pin, socket.id);
        const players = getFlagPlayerList(playerGame.pin);
        io.to(`flag:${playerGame.pin}`).emit("flag:player-left", { players });
      }
    });
  });
}

function sendNextFlagQuestion(io: Server, pin: string) {
  const q = nextFlagQuestion(pin);
  const game = getFlagGame(pin);
  if (!game) return;

  if (!q) {
    game.state = "finished";
    const results = getFlagResults(pin);
    io.to(`flag:${pin}`).emit("flag:game-finished", results);
    return;
  }

  io.to(`flag:${pin}`).emit("flag:question", {
    questionIdx: game.currentQuestionIdx,
    totalQuestions: game.questions.length,
    question: q,
    duration: game.questionDuration,
  });

  game.questionTimeout = setTimeout(() => {
    showFlagLeaderboardAndNext(io, pin);
  }, game.questionDuration * 1000 + 500);
}

function showFlagLeaderboardAndNext(io: Server, pin: string) {
  const game = getFlagGame(pin);
  if (!game) return;

  clearFlagQuestionTimeout(pin);
  const q = game.questions[game.currentQuestionIdx];
  const leaderboard = getFlagLeaderboard(pin);

  game.state = "leaderboard";
  io.to(`flag:${pin}`).emit("flag:question-ended", {
    correctAnswer: q.countryCode,
    correctNameAr: q.countryNameAr,
    correctNameEn: q.countryNameEn,
    leaderboard,
    questionIdx: game.currentQuestionIdx,
    totalQuestions: game.questions.length,
  });

  setTimeout(() => {
    if (game.currentQuestionIdx + 1 >= game.questions.length) {
      game.state = "finished";
      const results = getFlagResults(pin);
      io.to(`flag:${pin}`).emit("flag:game-finished", results);
    } else {
      sendNextFlagQuestion(io, pin);
    }
  }, 2500);
}
