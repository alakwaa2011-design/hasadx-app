import { Server, Socket } from "socket.io";

interface ScramblePlayer {
  socketId: string;
  name: string;
  score: number;
  level: number;
  lives: number;
  streak: number;
  solvedWords: number;
  totalWords: number;
  status: "waiting" | "playing" | "gameover";
  joinedAt: number;
}

interface ScrambleSession {
  pin: string;
  teacherSocketId: string;
  title: string;
  state: "lobby" | "playing";
  players: Map<string, ScramblePlayer>;
  createdAt: number;
}

const sessions = new Map<string, ScrambleSession>();

// TTL sweeper: scramble sessions live in memory and were never reaped before,
// so a server with continuous traffic would slowly accumulate stale lobbies.
// Drop sessions older than 3 hours regardless of state — teachers always
// recreate after that long anyway.
const SCRAMBLE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [pin, s] of sessions.entries()) {
    if (now - s.createdAt > SCRAMBLE_SESSION_TTL_MS) {
      sessions.delete(pin);
    }
  }
}, 10 * 60 * 1000).unref();

function getSessionByTeacher(socketId: string): ScrambleSession | undefined {
  for (const s of sessions.values()) {
    if (s.teacherSocketId === socketId) return s;
  }
  return undefined;
}

function getSessionByPlayer(socketId: string): ScrambleSession | undefined {
  for (const s of sessions.values()) {
    if (s.players.has(socketId)) return s;
  }
  return undefined;
}

function serializePlayers(session: ScrambleSession) {
  return Array.from(session.players.values()).map(p => ({
    name: p.name,
    score: p.score,
    level: p.level,
    lives: p.lives,
    streak: p.streak,
    solvedWords: p.solvedWords,
    totalWords: p.totalWords,
    completionPct: p.totalWords > 0 ? Math.round((p.solvedWords / p.totalWords) * 100) : 0,
    status: p.status,
  }));
}

export function getScrambleSession(pin: string): ScrambleSession | undefined {
  return sessions.get(pin);
}

export function setupScrambleSocket(io: Server) {
  io.on("connection", (socket: Socket) => {

    socket.on("scramble:teacher-start", (data: { pin: string; title: string }) => {
      const reqSession = ((socket.request as unknown) as Record<string, unknown>).session as { teacherId?: number } | undefined;
      if (!reqSession?.teacherId) {
        socket.emit("scramble:error", { message: "Authentication required" });
        return;
      }

      const { pin, title } = data;
      if (!pin) return;

      const existing = sessions.get(pin);
      if (existing && existing.teacherSocketId !== socket.id) {
        socket.emit("scramble:error", { message: "Session already active" });
        return;
      }

      const session: ScrambleSession = {
        pin,
        teacherSocketId: socket.id,
        title: title || existing?.title || "",
        state: existing?.state || "lobby",
        players: existing?.players || new Map(),
        createdAt: existing?.createdAt || Date.now(),
      };
      sessions.set(pin, session);
      socket.join(`scramble:${pin}`);
      socket.emit("scramble:session-started", {
        pin,
        state: session.state,
        players: serializePlayers(session),
      });

      // Notify any students who were already waiting before the teacher joined
      for (const [playerSocketId, player] of session.players.entries()) {
        if (playerSocketId !== socket.id) {
          io.to(playerSocketId).emit("scramble:joined-lobby", {
            pin,
            title: session.title,
            playerCount: session.players.size,
          });
        }
      }

      io.to(`scramble:${pin}`).emit("scramble:teacher-connected");
    });

    socket.on("scramble:student-join", (data: { pin: string; name: string }) => {
      const { pin, name } = data;
      if (!pin || !name) return;

      // Allow students to join before teacher — create a waiting lobby
      let session = sessions.get(pin);
      if (!session) {
        session = {
          pin,
          teacherSocketId: "",   // teacher not connected yet
          title: "",
          state: "lobby",
          players: new Map(),
          createdAt: Date.now(),
        };
        sessions.set(pin, session);
      }

      const trimmedName = name.trim().slice(0, 30);

      const existingByName = Array.from(session.players.values()).find(
        p => p.name === trimmedName
      );
      if (existingByName) {
        session.players.delete(existingByName.socketId);
      }

      const player: ScramblePlayer = {
        socketId: socket.id,
        name: trimmedName,
        score: 0,
        level: 1,
        lives: 3,
        streak: 0,
        solvedWords: 0,
        totalWords: 0,
        status: session.state === "lobby" ? "waiting" : "playing",
        joinedAt: Date.now(),
      };
      session.players.set(socket.id, player);
      socket.join(`scramble:${pin}`);

      if (!session.teacherSocketId) {
        // Teacher not yet connected — student waits
        socket.emit("scramble:waiting-for-teacher", { pin });
      } else if (session.state === "lobby") {
        socket.emit("scramble:joined-lobby", {
          pin,
          title: session.title,
          playerCount: session.players.size,
        });
      } else {
        socket.emit("scramble:joined-playing", {
          pin,
          title: session.title,
        });
      }

      // Notify teacher if already connected
      if (session.teacherSocketId) {
        io.to(session.teacherSocketId).emit("scramble:players-updated", {
          players: serializePlayers(session),
        });
      }

      io.to(`scramble:${pin}`).emit("scramble:lobby-count", {
        count: session.players.size,
      });
    });

    socket.on("scramble:game-start", () => {
      const reqSession = ((socket.request as unknown) as Record<string, unknown>).session as { teacherId?: number } | undefined;
      if (!reqSession?.teacherId) return;

      const session = getSessionByTeacher(socket.id);
      if (!session || session.state !== "lobby") return;

      session.state = "playing";
      for (const player of session.players.values()) {
        player.status = "playing";
      }

      io.to(`scramble:${session.pin}`).emit("scramble:game-started", {
        pin: session.pin,
        title: session.title,
      });

      socket.emit("scramble:players-updated", {
        players: serializePlayers(session),
      });
    });

    socket.on("scramble:update-progress", (data: {
      score: number;
      level: number;
      lives: number;
      streak: number;
      solvedWords: number;
      totalWords: number;
      status: string;
    }) => {
      const session = getSessionByPlayer(socket.id);
      if (!session) return;

      const player = session.players.get(socket.id);
      if (!player) return;

      if (typeof data.score === "number") player.score = Math.max(0, Math.min(data.score, 999999));
      if (typeof data.level === "number") player.level = Math.max(1, Math.min(data.level, 100));
      if (typeof data.lives === "number") player.lives = Math.max(0, Math.min(data.lives, 3));
      if (typeof data.streak === "number") player.streak = Math.max(0, Math.min(data.streak, 500));
      if (typeof data.solvedWords === "number") player.solvedWords = Math.max(0, Math.min(data.solvedWords, 500));
      if (typeof data.totalWords === "number") player.totalWords = Math.max(0, Math.min(data.totalWords, 500));
      if (data.status === "gameover") player.status = "gameover";

      io.to(session.teacherSocketId).emit("scramble:player-progress", {
        name: player.name,
        score: player.score,
        level: player.level,
        lives: player.lives,
        streak: player.streak,
        status: player.status,
      });

      io.to(session.teacherSocketId).emit("scramble:players-updated", {
        players: serializePlayers(session),
      });
    });

    socket.on("scramble:teacher-end", () => {
      const reqSession = ((socket.request as unknown) as Record<string, unknown>).session as { teacherId?: number } | undefined;
      if (!reqSession?.teacherId) return;

      const session = getSessionByTeacher(socket.id);
      if (!session) return;

      io.to(`scramble:${session.pin}`).emit("scramble:session-ended");
      sessions.delete(session.pin);
    });

    socket.on("disconnect", () => {
      const teacherSession = getSessionByTeacher(socket.id);
      if (teacherSession) {
        // Mark teacher as disconnected but keep session alive for 5 min so students can still wait
        teacherSession.teacherSocketId = "";
        io.to(`scramble:${teacherSession.pin}`).emit("scramble:waiting-for-teacher", { pin: teacherSession.pin });
        // Actually end session after 5 minutes if teacher doesn't reconnect
        setTimeout(() => {
          const s = sessions.get(teacherSession.pin);
          if (s && !s.teacherSocketId) {
            io.to(`scramble:${s.pin}`).emit("scramble:session-ended");
            sessions.delete(s.pin);
          }
        }, 5 * 60 * 1000);
        return;
      }

      const playerSession = getSessionByPlayer(socket.id);
      if (playerSession) {
        playerSession.players.delete(socket.id);
        io.to(playerSession.teacherSocketId).emit("scramble:players-updated", {
          players: serializePlayers(playerSession),
        });
        io.to(`scramble:${playerSession.pin}`).emit("scramble:lobby-count", {
          count: playerSession.players.size,
        });
      }
    });
  });
}
