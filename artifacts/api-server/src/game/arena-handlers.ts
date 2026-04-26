import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArenaPlayer {
  socketId: string;
  name: string;
  score: number;
  finished: boolean;
  isBot: boolean;
}

interface ArenaRoom {
  pin: string;
  gameId: string;
  players: Map<string, ArenaPlayer>; // key: socketId (or "bot" for bots)
  createdAt: number;
  started: boolean;
  noBot?: boolean;
  hostSocketId?: string;
  botTimer?: ReturnType<typeof setTimeout>;
  botScoreInterval?: ReturnType<typeof setInterval>;
}

// ── State ─────────────────────────────────────────────────────────────────────

const arenaRooms = new Map<string, ArenaRoom>();
// matchmaking queue: gameId → socket info
const matchQueue = new Map<string, { socketId: string; name: string; joinedAt: number }>();
// reverse: socketId → arena pin (for disconnect cleanup)
const socketToPin = new Map<string, string>();
// reverse: socketId → gameId (for queue cleanup on disconnect)
const socketToQueue = new Map<string, string>();
// bot fallback timers for queued players: socketId → timer
const queueBotTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function genPin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pin = "";
  for (let i = 0; i < 6; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure at least one letter (always true with this charset, but make sure)
  return pin;
}

function makeUniquePin(): string {
  let pin = genPin();
  while (arenaRooms.has(pin)) {
    pin = genPin();
  }
  return pin;
}

function getRoomChannel(pin: string): string {
  return `arena:${pin}`;
}

function getPlayersArray(room: ArenaRoom): Array<{ name: string; score: number; finished: boolean; isBot: boolean }> {
  return Array.from(room.players.values()).map(p => ({
    name: p.name,
    score: p.score,
    finished: p.finished,
    isBot: p.isBot,
  }));
}

function startBot(io: Server, room: ArenaRoom, delayMs = 10000) {
  if (room.botTimer) { clearTimeout(room.botTimer); }
  // Bot joins after delayMs (ms) if room still has only 1 human player
  room.botTimer = setTimeout(() => {
    const humanCount = Array.from(room.players.values()).filter(p => !p.isBot).length;
    if (humanCount >= 2) return; // already matched

    const botNames = ["روبوت الذكاء", "تحدي الآلة", "المتحدي", "النظام", "الخصم الرقمي"];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];

    const bot: ArenaPlayer = {
      socketId: "bot",
      name: botName,
      score: 0,
      finished: false,
      isBot: true,
    };

    room.players.set("bot", bot);
    room.started = true;

    // Notify all human players
    io.to(getRoomChannel(room.pin)).emit("arena:player_joined", { playerCount: room.players.size });
    io.to(getRoomChannel(room.pin)).emit("arena:game_start", {
      pin: room.pin,
      players: getPlayersArray(room),
    });

    logger.info({ pin: room.pin }, "Arena bot joined");

    // Bot sends incremental score updates every 3-5s
    let botScore = 0;
    room.botScoreInterval = setInterval(() => {
      if (!arenaRooms.has(room.pin)) {
        clearInterval(room.botScoreInterval);
        return;
      }
      const botPlayer = room.players.get("bot");
      if (!botPlayer || botPlayer.finished) {
        clearInterval(room.botScoreInterval);
        return;
      }
      const gain = Math.floor(Math.random() * 30) + 10;
      botScore += gain;
      botPlayer.score = botScore;

      io.to(getRoomChannel(room.pin)).emit("arena:opponent_update", {
        name: botName,
        score: botScore,
        isBot: true,
      });
    }, 3000 + Math.random() * 2000);
  }, delayMs);
}

function botFinish(io: Server, room: ArenaRoom) {
  const bot = room.players.get("bot");
  if (!bot || bot.finished) return;
  if (room.botScoreInterval) { clearInterval(room.botScoreInterval); }
  // Bot finishes with a score close to the human's
  const humanScores = Array.from(room.players.values())
    .filter(p => !p.isBot && p.finished)
    .map(p => p.score);
  const humanMax = humanScores.length > 0 ? Math.max(...humanScores) : 100;
  const variance = 0.7 + Math.random() * 0.6; // 70%-130% of human score
  bot.score = Math.round(humanMax * variance);
  bot.finished = true;
  room.players.set("bot", bot);
  io.to(getRoomChannel(room.pin)).emit("arena:opponent_finished", {
    name: bot.name,
    score: bot.score,
    isBot: true,
  });
}

function emitResults(io: Server, room: ArenaRoom) {
  const rankings = Array.from(room.players.values())
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, isBot: p.isBot }));

  io.to(getRoomChannel(room.pin)).emit("arena:results", { rankings });
  logger.info({ pin: room.pin, rankings }, "Arena results emitted");
}

function cleanupRoom(room: ArenaRoom) {
  if (room.botTimer) { clearTimeout(room.botTimer); }
  if (room.botScoreInterval) { clearInterval(room.botScoreInterval); }
  // Clean up socketToPin references for this room
  room.players.forEach((player) => {
    if (player.socketId !== "bot") {
      socketToPin.delete(player.socketId);
    }
  });
  arenaRooms.delete(room.pin);
  logger.info({ pin: room.pin }, "Arena room cleaned up");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setupArenaSocket(io: Server) {
  // Stale room cleanup every 30 minutes (rooms older than 2h)
  setInterval(() => {
    const now = Date.now();
    for (const [pin, room] of arenaRooms.entries()) {
      if (now - room.createdAt > 2 * 60 * 60 * 1000) {
        cleanupRoom(room);
      }
    }
  }, 30 * 60 * 1000);

  io.on("connection", (socket: Socket) => {

    // ── Create room ────────────────────────────────────────────────────────
    socket.on("arena:create", (
      data: { gameId: string; playerName: string; noBot?: boolean },
      cb?: (res: { pin?: string; joinUrl?: string; error?: string }) => void
    ) => {
      try {
        const pin = makeUniquePin();
        const room: ArenaRoom = {
          pin,
          gameId: data.gameId,
          players: new Map(),
          createdAt: Date.now(),
          started: false,
          noBot: data.noBot === true,
          hostSocketId: socket.id,
        };
        const player: ArenaPlayer = {
          socketId: socket.id,
          name: data.playerName || "لاعب",
          score: 0,
          finished: false,
          isBot: false,
        };
        room.players.set(socket.id, player);
        arenaRooms.set(pin, room);
        socketToPin.set(socket.id, pin);
        socket.join(getRoomChannel(pin));

        // Only start bot countdown for non-friend-challenge rooms
        if (!room.noBot) {
          startBot(io, room);
        }

        logger.info({ pin, gameId: data.gameId, player: player.name, noBot: room.noBot }, "Arena room created");
        const joinUrl = `${process.env.FRONTEND_URL || ""}/arena/join?pin=${pin}`;
        cb?.({ pin, joinUrl });

        socket.emit("arena:waiting", { pin });
      } catch (err) {
        logger.error(err, "arena:create error");
        cb?.({ error: "Failed to create room" });
      }
    });

    // ── Request bot immediately ────────────────────────────────────────────
    socket.on("arena:request_bot", (
      _data: unknown,
      cb?: (res: { ok?: boolean; error?: string }) => void
    ) => {
      try {
        const pin = socketToPin.get(socket.id);
        if (!pin) { cb?.({ error: "Not in a room" }); return; }
        const room = arenaRooms.get(pin);
        if (!room) { cb?.({ error: "Room not found" }); return; }
        if (room.started) { cb?.({ ok: true }); return; }
        startBot(io, room, 0);
        logger.info({ pin }, "Arena bot requested immediately");
        cb?.({ ok: true });
      } catch (err) {
        logger.error(err, "arena:request_bot error");
        cb?.({ error: "Failed to add bot" });
      }
    });

    // ── Join room by PIN ───────────────────────────────────────────────────
    socket.on("arena:join", (
      data: { pin: string; playerName: string },
      cb?: (res: { success?: boolean; gameId?: string; players?: ReturnType<typeof getPlayersArray>; isHost?: boolean; error?: string }) => void
    ) => {
      try {
        const room = arenaRooms.get(data.pin.toUpperCase());
        if (!room) {
          cb?.({ error: "Room not found" });
          return;
        }

        // Idempotent: if this socket is already in the room, return current snapshot
        if (room.players.has(socket.id)) {
          cb?.({ success: true, gameId: room.gameId, players: getPlayersArray(room), isHost: room.hostSocketId === socket.id });
          return;
        }

        // noBot (friend) rooms allow up to 8 players before start; others keep 2-player limit
        const maxPlayers = room.noBot ? 8 : 2;
        const humanCount = Array.from(room.players.values()).filter(p => !p.isBot).length;
        if (humanCount >= maxPlayers) {
          cb?.({ error: "Room is full" });
          return;
        }

        // For queue rooms: cancel bot timer since we have a real player
        if (!room.noBot && room.botTimer) { clearTimeout(room.botTimer); room.botTimer = undefined; }

        const player: ArenaPlayer = {
          socketId: socket.id,
          name: data.playerName || "لاعب",
          score: 0,
          finished: false,
          isBot: false,
        };
        room.players.set(socket.id, player);
        socketToPin.set(socket.id, data.pin.toUpperCase());
        socket.join(getRoomChannel(room.pin));

        const players = getPlayersArray(room);

        if (room.noBot) {
          // Friend room: notify everyone of new player — host decides when to start
          io.to(getRoomChannel(room.pin)).emit("arena:player_joined", { players, playerCount: room.players.size });
          logger.info({ pin: room.pin, player: player.name }, "Arena friend joined, waiting for host start");
          cb?.({ success: true, gameId: room.gameId, players, isHost: false });
        } else {
          // Queue room: start immediately (2 players)
          room.started = true;
          io.to(getRoomChannel(room.pin)).emit("arena:player_joined", { players, playerCount: room.players.size });
          io.to(getRoomChannel(room.pin)).emit("arena:game_start", { pin: room.pin, players });
          logger.info({ pin: room.pin, player: player.name }, "Arena player joined, game starting");
          cb?.({ success: true, gameId: room.gameId, players, isHost: false });
        }
      } catch (err) {
        logger.error(err, "arena:join error");
        cb?.({ error: "Failed to join room" });
      }
    });

    // ── Host starts the game ───────────────────────────────────────────────
    socket.on("arena:host_start", (
      _data: unknown,
      cb?: (res: { ok?: boolean; error?: string }) => void
    ) => {
      try {
        const pin = socketToPin.get(socket.id);
        if (!pin) { cb?.({ error: "Not in a room" }); return; }
        const room = arenaRooms.get(pin);
        if (!room) { cb?.({ error: "Room not found" }); return; }
        if (room.hostSocketId !== socket.id) { cb?.({ error: "Only the host can start" }); return; }
        if (room.started) { cb?.({ ok: true }); return; }
        room.started = true;
        const players = getPlayersArray(room);
        io.to(getRoomChannel(room.pin)).emit("arena:game_start", { pin: room.pin, players });
        logger.info({ pin, playerCount: room.players.size }, "Arena host started game");
        cb?.({ ok: true });
      } catch (err) {
        logger.error(err, "arena:host_start error");
        cb?.({ error: "Failed to start game" });
      }
    });

    // ── Random matchmaking ─────────────────────────────────────────────────
    socket.on("arena:queue", (
      data: { gameId: string; playerName: string },
      cb?: (res: { queued?: boolean; error?: string }) => void
    ) => {
      try {
        const gameId = data.gameId;
        const existing = matchQueue.get(gameId);

        if (existing && existing.socketId !== socket.id) {
          // Match found! Create a room for both players
          matchQueue.delete(gameId);
          socketToQueue.delete(existing.socketId);
          // Cancel the waiting player's bot fallback timer
          const existingBotTimer = queueBotTimers.get(existing.socketId);
          if (existingBotTimer) { clearTimeout(existingBotTimer); queueBotTimers.delete(existing.socketId); }

          const pin = makeUniquePin();
          const room: ArenaRoom = {
            pin,
            gameId,
            players: new Map(),
            createdAt: Date.now(),
            started: true,
          };

          const p1: ArenaPlayer = {
            socketId: existing.socketId,
            name: existing.name,
            score: 0,
            finished: false,
            isBot: false,
          };
          const p2: ArenaPlayer = {
            socketId: socket.id,
            name: data.playerName || "لاعب",
            score: 0,
            finished: false,
            isBot: false,
          };

          room.players.set(existing.socketId, p1);
          room.players.set(socket.id, p2);
          arenaRooms.set(pin, room);
          socketToPin.set(existing.socketId, pin);
          socketToPin.set(socket.id, pin);

          const existingSocket = io.sockets.sockets.get(existing.socketId);
          if (existingSocket) {
            existingSocket.join(getRoomChannel(pin));
          }
          socket.join(getRoomChannel(pin));

          const players = getPlayersArray(room);
          io.to(getRoomChannel(pin)).emit("arena:game_start", { pin, players });

          // Notify each player individually with their opponent info
          io.to(existing.socketId).emit("arena:matched", { pin, opponent: { name: p2.name, score: 0 } });
          socket.emit("arena:matched", { pin, opponent: { name: p1.name, score: 0 } });

          logger.info({ pin, gameId, p1: p1.name, p2: p2.name }, "Arena players matched");
          cb?.({ queued: true });
        } else {
          // Join queue
          if (existing?.socketId === socket.id) {
            cb?.({ queued: true }); // already queued
            return;
          }
          const playerName = data.playerName || "لاعب";
          matchQueue.set(gameId, { socketId: socket.id, name: playerName, joinedAt: Date.now() });
          socketToQueue.set(socket.id, gameId);
          cb?.({ queued: true });
          socket.emit("arena:waiting", { queued: true });
          logger.info({ gameId, player: playerName }, "Arena player queued");

          // Bot fallback: after 10s with no human match, create room + bot
          const botFallbackTimer = setTimeout(() => {
            queueBotTimers.delete(socket.id);
            // Check player is still in queue (not matched)
            const stillQueued = matchQueue.get(gameId);
            if (!stillQueued || stillQueued.socketId !== socket.id) return;
            matchQueue.delete(gameId);
            socketToQueue.delete(socket.id);

            const pin = makeUniquePin();
            const room: ArenaRoom = {
              pin,
              gameId,
              players: new Map(),
              createdAt: Date.now(),
              started: false,
            };
            const human: ArenaPlayer = {
              socketId: socket.id,
              name: playerName,
              score: 0,
              finished: false,
              isBot: false,
            };
            room.players.set(socket.id, human);
            arenaRooms.set(pin, room);
            socketToPin.set(socket.id, pin);
            socket.join(getRoomChannel(pin));

            // Start bot immediately (0ms delay) since we already waited 10s in queue
            startBot(io, room, 0);
            logger.info({ pin, gameId, player: playerName }, "Arena bot fallback triggered for queued player");
          }, 10000);

          queueBotTimers.set(socket.id, botFallbackTimer);
        }
      } catch (err) {
        logger.error(err, "arena:queue error");
        cb?.({ error: "Failed to queue" });
      }
    });

    // ── Score update ───────────────────────────────────────────────────────
    socket.on("arena:score", (data: { score: number }) => {
      const pin = socketToPin.get(socket.id);
      if (!pin) return;
      const room = arenaRooms.get(pin);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      player.score = data.score;

      // Broadcast to others in room
      socket.to(getRoomChannel(pin)).emit("arena:opponent_update", {
        name: player.name,
        score: data.score,
        isBot: false,
      });
    });

    // ── Player finished ────────────────────────────────────────────────────
    socket.on("arena:finish", (data: { finalScore: number }) => {
      const pin = socketToPin.get(socket.id);
      if (!pin) return;
      const room = arenaRooms.get(pin);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      player.score = data.finalScore;
      player.finished = true;

      socket.to(getRoomChannel(pin)).emit("arena:opponent_finished", {
        name: player.name,
        score: data.finalScore,
        isBot: false,
      });

      // If bot is present, make it finish too
      if (room.players.has("bot")) {
        setTimeout(() => botFinish(io, room), 1000 + Math.random() * 3000);
      }

      // Check if all non-bot players finished
      const allHumansFinished = Array.from(room.players.values())
        .filter(p => !p.isBot)
        .every(p => p.finished);

      if (allHumansFinished) {
        // Give bot time to finish, then emit results
        const delay = room.players.has("bot") ? 4000 : 500;
        setTimeout(() => {
          const r = arenaRooms.get(pin);
          if (r) emitResults(io, r);
        }, delay);

        // Cleanup after 30s
        setTimeout(() => {
          const r = arenaRooms.get(pin);
          if (r) cleanupRoom(r);
        }, 30000);
      }

      logger.info({ pin, player: player.name, score: data.finalScore }, "Arena player finished");
    });

    // ── Leave room / cancel queue ───────────────────────────────────────────
    socket.on("arena:leave", () => {
      // Also remove from queue if waiting
      const queuedGame = socketToQueue.get(socket.id);
      if (queuedGame) {
        const qEntry = matchQueue.get(queuedGame);
        if (qEntry?.socketId === socket.id) matchQueue.delete(queuedGame);
        socketToQueue.delete(socket.id);
      }
      // Cancel any pending bot fallback timer
      const bt = queueBotTimers.get(socket.id);
      if (bt) { clearTimeout(bt); queueBotTimers.delete(socket.id); }
      handleLeave(socket);
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Remove from queue if queued
      const queuedGame = socketToQueue.get(socket.id);
      if (queuedGame) {
        const qEntry = matchQueue.get(queuedGame);
        if (qEntry?.socketId === socket.id) {
          matchQueue.delete(queuedGame);
        }
        socketToQueue.delete(socket.id);
      }
      // Cancel any pending bot fallback timer
      const bt = queueBotTimers.get(socket.id);
      if (bt) { clearTimeout(bt); queueBotTimers.delete(socket.id); }
      handleLeave(socket);
    });
  });

  function handleLeave(socket: Socket) {
    const pin = socketToPin.get(socket.id);
    if (!pin) return;
    socketToPin.delete(socket.id);
    const room = arenaRooms.get(pin);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      room.players.delete(socket.id);
      socket.to(getRoomChannel(pin)).emit("arena:player_left", { name: player.name });
    }

    // If room empty, clean up
    const humanCount = Array.from(room.players.values()).filter(p => !p.isBot).length;
    if (humanCount === 0) {
      cleanupRoom(room);
    }
  }
}
