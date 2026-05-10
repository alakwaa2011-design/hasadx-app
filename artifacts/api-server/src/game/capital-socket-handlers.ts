import { Server, Socket } from "socket.io";
import {
  createCapitalGame,
  getCapitalGame,
  deleteCapitalGame,
  addCapitalPlayer,
  removeCapitalPlayer,
  getCapitalPlayerList,
  getActiveCapitalPlayerCount,
  nextCapitalQuestion,
  submitCapitalAnswer,
  getCapitalLeaderboard,
  clearCapitalQuestionTimeout,
  findCapitalGameByHost,
  findCapitalGameByPlayer,
  getCapitalResults,
  type CapitalQuestion,
} from "./capital-manager";
import { logger } from "../lib/logger";

const hostDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setupCapitalSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("capital:create-game", (data: {
      tier: 1 | 2 | 3 | 4;
      questionDuration: number;
      questions: CapitalQuestion[];
      questionCount: number;
    }, cb?: (res: { pin?: string; error?: string }) => void) => {
      try {
        const questions = data.questions.slice(0, data.questionCount);
        if (questions.length === 0) {
          cb?.({ error: "No questions provided" });
          return;
        }
        const game = createCapitalGame(socket.id, data.tier, data.questionDuration, questions);
        socket.join(`capital:${game.pin}`);
        logger.info(`Capital game created: ${game.pin} by ${socket.id} (${questions.length} questions, tier ${data.tier})`);
        cb?.({ pin: game.pin });
      } catch (err) {
        logger.error({ err }, "Error creating capital game:");
        cb?.({ error: "Failed to create game" });
      }
    });

    socket.on("capital:rejoin-host", (data: { pin: string }, cb?: (res: { success?: boolean; error?: string }) => void) => {
      try {
        const game = getCapitalGame(data.pin);
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
        socket.join(`capital:${data.pin}`);
        logger.info(`Host rejoined capital game ${data.pin} as ${socket.id}`);
        cb?.({ success: true });
      } catch (err) {
        logger.error({ err }, "Error rejoining capital game:");
        cb?.({ error: "Failed to rejoin" });
      }
    });

    socket.on("capital:join-game", (data: { pin: string; name: string }, cb?: (res: {
      success?: boolean;
      questionCount?: number;
      tier?: number;
      players?: ReturnType<typeof getCapitalPlayerList>;
      error?: string;
    }) => void) => {
      try {
        const game = getCapitalGame(data.pin);
        if (!game) {
          cb?.({ error: "Game not found" });
          return;
        }
        /* Late-join policy: only block once the game has fully ended.
           A student who joins during countdown / mid-question /
           leaderboard is added with a fresh 0-score and immediately
           catches up to the live question. Mirrors the Flag-Quiz
           handler — same rationale. */
        if (game.state === "finished") {
          cb?.({ error: "Game already finished" });
          return;
        }
        const player = addCapitalPlayer(data.pin, socket.id, data.name.trim());
        if (!player) {
          cb?.({ error: "Name already taken" });
          return;
        }
        socket.join(`capital:${data.pin}`);
        const players = getCapitalPlayerList(data.pin);
        io.to(`capital:${data.pin}`).emit("capital:player-joined", { players, name: data.name.trim() });
        logger.info(`Player ${data.name} joined capital game ${data.pin} (state=${game.state})`);
        cb?.({
          success: true,
          questionCount: game.questions.length,
          tier: game.tier,
          players,
        });
        /* Catch-up: send current question only to the joining socket
           with the remaining duration so their countdown timer is in
           sync with the rest of the room. */
        if (game.state === "question" && game.currentQuestionIdx >= 0) {
          const q = game.questions[game.currentQuestionIdx];
          if (q) {
            const elapsedMs = Date.now() - game.questionStartTime;
            const remaining = Math.max(1, Math.ceil((game.questionDuration * 1000 - elapsedMs) / 1000));
            socket.emit("capital:question", {
              questionIdx: game.currentQuestionIdx,
              totalQuestions: game.questions.length,
              question: q,
              duration: remaining,
            });
          }
        }
      } catch (err) {
        logger.error({ err }, "Error joining capital game:");
        cb?.({ error: "Failed to join" });
      }
    });

    socket.on("capital:start-game", (data: { pin: string }, cb?: (res: { error?: string }) => void) => {
      try {
        const game = getCapitalGame(data.pin);
        if (!game || game.hostId !== socket.id) {
          cb?.({ error: "Not authorized" });
          return;
        }
        if (getActiveCapitalPlayerCount(data.pin) < 1) {
          cb?.({ error: "Need at least 1 player" });
          return;
        }

        game.state = "countdown";
        io.to(`capital:${data.pin}`).emit("capital:countdown", { seconds: 3 });

        setTimeout(() => {
          sendNextCapitalQuestion(io, data.pin);
        }, 3000);

        cb?.({});
      } catch (err) {
        logger.error({ err }, "Error starting capital game:");
        cb?.({ error: "Failed to start" });
      }
    });

    socket.on("capital:submit-answer", (data: { pin: string; answer: string }, cb?: (res: {
      correct?: boolean;
      score?: number;
      streak?: number;
      speedBonus?: number;
      correctAnswer?: string;
      error?: string;
    }) => void) => {
      try {
        const game = getCapitalGame(data.pin);
        if (!game) {
          cb?.({ error: "Game not found" });
          return;
        }
        const result = submitCapitalAnswer(data.pin, socket.id, data.answer);
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
          correctAnswer: q.correctValue,
        });

        io.to(`capital:${data.pin}`).emit("capital:answer-update", {
          answeredCount: game.answeredCount,
          totalPlayers: getActiveCapitalPlayerCount(data.pin),
        });

        if (result.allAnswered) {
          clearCapitalQuestionTimeout(data.pin);
          setTimeout(() => {
            showCapitalLeaderboardAndNext(io, data.pin);
          }, 800);
        }
      } catch (err) {
        logger.error({ err }, "Error submitting capital answer:");
        cb?.({ error: "Failed to submit" });
      }
    });

    socket.on("capital:next-question", (data: { pin: string }) => {
      const game = getCapitalGame(data.pin);
      if (!game || game.hostId !== socket.id) return;
      sendNextCapitalQuestion(io, data.pin);
    });

    socket.on("disconnect", () => {
      const hostGame = findCapitalGameByHost(socket.id);
      if (hostGame) {
        const grace = setTimeout(() => {
          const game = getCapitalGame(hostGame.pin);
          if (game && game.hostId === socket.id) {
            io.to(`capital:${hostGame.pin}`).emit("capital:game-ended", { reason: "host-disconnected" });
            deleteCapitalGame(hostGame.pin);
          }
          hostDisconnectTimers.delete(hostGame.pin);
        }, 10000);
        hostDisconnectTimers.set(hostGame.pin, grace);
        return;
      }
      const playerGame = findCapitalGameByPlayer(socket.id);
      if (playerGame) {
        removeCapitalPlayer(playerGame.pin, socket.id);
        const players = getCapitalPlayerList(playerGame.pin);
        io.to(`capital:${playerGame.pin}`).emit("capital:player-left", { players });
      }
    });
  });
}

function sendNextCapitalQuestion(io: Server, pin: string) {
  const q = nextCapitalQuestion(pin);
  const game = getCapitalGame(pin);
  if (!game) return;

  if (!q) {
    game.state = "finished";
    const results = getCapitalResults(pin);
    io.to(`capital:${pin}`).emit("capital:game-finished", results);
    return;
  }

  io.to(`capital:${pin}`).emit("capital:question", {
    questionIdx: game.currentQuestionIdx,
    totalQuestions: game.questions.length,
    question: q,
    duration: game.questionDuration,
  });

  game.questionTimeout = setTimeout(() => {
    showCapitalLeaderboardAndNext(io, pin);
  }, game.questionDuration * 1000 + 500);
}

function showCapitalLeaderboardAndNext(io: Server, pin: string) {
  const game = getCapitalGame(pin);
  if (!game) return;

  clearCapitalQuestionTimeout(pin);
  const q = game.questions[game.currentQuestionIdx];
  const leaderboard = getCapitalLeaderboard(pin);

  game.state = "leaderboard";
  io.to(`capital:${pin}`).emit("capital:question-ended", {
    correctAnswer: q.correctValue,
    correctCapitalAr: q.capitalAr,
    correctCapitalEn: q.capitalEn,
    correctCountryAr: q.countryNameAr,
    correctCountryEn: q.countryNameEn,
    leaderboard,
    questionIdx: game.currentQuestionIdx,
    totalQuestions: game.questions.length,
  });

  setTimeout(() => {
    if (game.currentQuestionIdx + 1 >= game.questions.length) {
      game.state = "finished";
      const results = getCapitalResults(pin);
      io.to(`capital:${pin}`).emit("capital:game-finished", results);
    } else {
      sendNextCapitalQuestion(io, pin);
    }
  }, 2500);
}
