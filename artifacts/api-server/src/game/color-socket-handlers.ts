import { Server, Socket } from "socket.io";
import {
  createColorGame,
  getColorGame,
  deleteColorGame,
  addColorPlayer,
  removeColorPlayer,
  getColorPlayerList,
  getActiveColorPlayerCount,
  getAlivePlayerCount,
  nextColorRound,
  submitColorAnswer,
  getColorLeaderboard,
  clearColorRoundTimeout,
  findColorGameByHost,
  findColorGameByPlayer,
  getColorResults,
  eliminateAfkPlayers,
  getRoundTime,
} from "./color-manager";
import { logger } from "../lib/logger";

const hostDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setupColorSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("color:create-game", (_data: any, cb?: (res: { pin?: string; hostToken?: string; error?: string }) => void) => {
      try {
        const game = createColorGame(socket.id);
        socket.join(`color:${game.pin}`);
        logger.info(`Color game created: ${game.pin} by ${socket.id}`);
        cb?.({ pin: game.pin, hostToken: game.hostToken });
      } catch (err) {
        logger.error({ err }, "Error creating color game:");
        cb?.({ error: "Failed to create game" });
      }
    });

    socket.on("color:rejoin-host", (data: { pin: string; hostToken: string }, cb?: (res: { success?: boolean; error?: string }) => void) => {
      try {
        const game = getColorGame(data.pin);
        if (!game) { cb?.({ error: "Game not found" }); return; }
        if (game.hostToken !== data.hostToken) { cb?.({ error: "Not authorized" }); return; }
        const timer = hostDisconnectTimers.get(data.pin);
        if (timer) { clearTimeout(timer); hostDisconnectTimers.delete(data.pin); }
        game.hostId = socket.id;
        socket.join(`color:${data.pin}`);
        logger.info(`Host rejoined color game ${data.pin} as ${socket.id}`);
        cb?.({ success: true });
      } catch (err) {
        logger.error({ err }, "Error rejoining color game:");
        cb?.({ error: "Failed to rejoin" });
      }
    });

    socket.on("color:join-game", (data: { pin: string; name: string }, cb?: (res: {
      success?: boolean;
      players?: ReturnType<typeof getColorPlayerList>;
      error?: string;
    }) => void) => {
      try {
        const game = getColorGame(data.pin);
        if (!game) { cb?.({ error: "Game not found" }); return; }
        /* Late-join policy: only block once the game has fully ended.
           Color rounds are short, so late-joiners may miss the very
           first round but will be in for the next one. If a round is
           live right now we send it directly to the joining socket. */
        if (game.state === "finished") { cb?.({ error: "Game already finished" }); return; }
        const player = addColorPlayer(data.pin, socket.id, data.name.trim());
        if (!player) { cb?.({ error: "Name already taken" }); return; }
        socket.join(`color:${data.pin}`);
        const players = getColorPlayerList(data.pin);
        io.to(`color:${data.pin}`).emit("color:player-joined", { players, name: data.name.trim() });
        logger.info(`Player ${data.name} joined color game ${data.pin} (state=${game.state})`);
        cb?.({ success: true, players });
        if (game.state === "playing" && game.currentLevel) {
          socket.emit("color:round", {
            levelNum: game.currentLevelNum,
            level: game.currentLevel,
            aliveCount: getActiveColorPlayerCount(data.pin),
            roundTimeSec: getRoundTime(game.currentLevelNum),
          });
        }
      } catch (err) {
        logger.error({ err }, "Error joining color game:");
        cb?.({ error: "Failed to join" });
      }
    });

    socket.on("color:start-game", (data: { pin: string }, cb?: (res: { error?: string }) => void) => {
      try {
        const game = getColorGame(data.pin);
        if (!game || game.hostId !== socket.id) { cb?.({ error: "Not authorized" }); return; }
        if (getActiveColorPlayerCount(data.pin) < 1) { cb?.({ error: "Need at least 1 player" }); return; }

        game.state = "countdown";
        io.to(`color:${data.pin}`).emit("color:countdown", { seconds: 3 });

        setTimeout(() => {
          sendNextColorRound(io, data.pin);
        }, 3000);

        cb?.({});
      } catch (err) {
        logger.error({ err }, "Error starting color game:");
        cb?.({ error: "Failed to start" });
      }
    });

    socket.on("color:submit-answer", (data: { pin: string; cellIndex: number }, cb?: (res: {
      correct?: boolean;
      score?: number;
      level?: number;
      correctIndex?: number;
      error?: string;
    }) => void) => {
      try {
        const game = getColorGame(data.pin);
        if (!game) { cb?.({ error: "Game not found" }); return; }
        const result = submitColorAnswer(data.pin, socket.id, data.cellIndex);
        if (!result) { cb?.({ error: "Cannot submit" }); return; }

        cb?.({
          correct: result.correct,
          score: result.score,
          level: result.level,
          correctIndex: game.currentLevel?.diffIndex,
        });

        const alive = getAlivePlayerCount(data.pin);
        io.to(`color:${data.pin}`).emit("color:answer-update", {
          aliveCount: alive,
          totalPlayers: getActiveColorPlayerCount(data.pin),
        });

        if (result.allAnswered) {
          clearColorRoundTimeout(data.pin);
          setTimeout(() => {
            showColorLeaderboardAndNext(io, data.pin);
          }, 800);
        }
      } catch (err) {
        logger.error({ err }, "Error submitting color answer:");
        cb?.({ error: "Failed to submit" });
      }
    });

    socket.on("disconnect", () => {
      const hostGame = findColorGameByHost(socket.id);
      if (hostGame) {
        const grace = setTimeout(() => {
          const game = getColorGame(hostGame.pin);
          if (game && game.hostId === socket.id) {
            io.to(`color:${hostGame.pin}`).emit("color:game-ended", { reason: "host-disconnected" });
            deleteColorGame(hostGame.pin);
          }
          hostDisconnectTimers.delete(hostGame.pin);
        }, 10000);
        hostDisconnectTimers.set(hostGame.pin, grace);
        return;
      }
      const playerGame = findColorGameByPlayer(socket.id);
      if (playerGame) {
        removeColorPlayer(playerGame.pin, socket.id);
        const players = getColorPlayerList(playerGame.pin);
        io.to(`color:${playerGame.pin}`).emit("color:player-left", { players });
      }
    });
  });
}

function sendNextColorRound(io: Server, pin: string) {
  const level = nextColorRound(pin);
  const game = getColorGame(pin);
  if (!game) return;

  const alive = getAlivePlayerCount(pin);
  if (alive === 0) {
    game.state = "finished";
    const results = getColorResults(pin);
    io.to(`color:${pin}`).emit("color:game-finished", results);
    return;
  }

  if (!level) return;

  const roundMs = getRoundTime(game.currentLevelNum) * 1000;

  io.to(`color:${pin}`).emit("color:round", {
    levelNum: game.currentLevelNum,
    level,
    aliveCount: alive,
    roundTimeSec: roundMs / 1000,
  });
  game.roundTimeout = setTimeout(() => {
    showColorLeaderboardAndNext(io, pin);
  }, roundMs);
}

function showColorLeaderboardAndNext(io: Server, pin: string) {
  const game = getColorGame(pin);
  if (!game) return;

  clearColorRoundTimeout(pin);
  eliminateAfkPlayers(pin);
  const leaderboard = getColorLeaderboard(pin);

  io.to(`color:${pin}`).emit("color:round-ended", {
    leaderboard,
    levelNum: game.currentLevelNum,
    correctIndex: game.currentLevel?.diffIndex,
  });

  const alive = getAlivePlayerCount(pin);
  setTimeout(() => {
    if (alive === 0) {
      game.state = "finished";
      const results = getColorResults(pin);
      io.to(`color:${pin}`).emit("color:game-finished", results);
    } else {
      sendNextColorRound(io, pin);
    }
  }, 2500);
}
