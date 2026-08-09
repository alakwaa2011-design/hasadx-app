import { Server, Socket } from "socket.io";
import { randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — escape-room DEVICE MODE sessions.
//
// The teacher creates a session (questions + settings live in server memory,
// keyed by PIN). Students join with the PIN, receive the full room config
// when the teacher starts, then each runs the escape locally on their device
// and streams progress snapshots back so the teacher's monitor shows a live
// leaderboard. Same memory + TTL pattern as the scramble/tug sessions.
// ─────────────────────────────────────────────────────────────────────────────

interface EscapeQuestion {
  text: string;
  options: string[];
  correct: number;
  imageUrl?: string | null;
}

interface EscapeConfig {
  questions: EscapeQuestion[];
  totalTime: number;
  lockCount: number;
  hints: number;
  title?: string;
}

interface EscapePlayer {
  socketId: string;
  name: string;
  locksOpen: number;
  lockCount: number;
  correct: number;
  wrong: number;
  score: number;
  timeLeft: number;
  status: "waiting" | "playing" | "won" | "lost";
  connected: boolean;
  joinedAt: number;
}

interface EscapeSession {
  pin: string;
  hostSocketId: string;
  creatorToken: string;
  config: EscapeConfig;
  state: "lobby" | "playing";
  players: Map<string, EscapePlayer>; // keyed by player NAME (stable across reconnects)
  createdAt: number;
}

const sessions = new Map<string, EscapeSession>();

const ESCAPE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [pin, s] of sessions.entries()) {
    if (now - s.createdAt > ESCAPE_SESSION_TTL_MS) sessions.delete(pin);
  }
}, 10 * 60 * 1000).unref();

function generatePin(): string {
  let pin = "";
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (sessions.has(pin));
  return pin;
}

function sanitizeConfig(raw: unknown): EscapeConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.questions)) return null;
  const questions: EscapeQuestion[] = [];
  for (const q of r.questions.slice(0, 30)) {
    if (!q || typeof q !== "object") continue;
    const qq = q as Record<string, unknown>;
    if (typeof qq.text !== "string" || !Array.isArray(qq.options)) continue;
    const options = qq.options.filter((o): o is string => typeof o === "string").slice(0, 4).map((o) => o.slice(0, 200));
    const correct = typeof qq.correct === "number" ? qq.correct : 0;
    if (options.length < 2 || correct < 0 || correct >= options.length) continue;
    questions.push({
      text: qq.text.slice(0, 400),
      options,
      correct,
      imageUrl: typeof qq.imageUrl === "string" ? qq.imageUrl.slice(0, 2000) : null,
    });
  }
  if (questions.length < 3) return null;
  const totalTime = Math.max(120, Math.min(1800, Number(r.totalTime) || 600));
  const lockCount = Math.max(2, Math.min(6, Number(r.lockCount) || 4));
  const hintsRaw = Number(r.hints);
  const hints = Math.max(0, Math.min(3, Number.isFinite(hintsRaw) ? hintsRaw : 2));
  const title = typeof r.title === "string" ? r.title.slice(0, 120) : undefined;
  return { questions, totalTime, lockCount, hints, title };
}

function serializePlayers(session: EscapeSession) {
  return Array.from(session.players.values())
    .map((p) => ({
      name: p.name,
      locksOpen: p.locksOpen,
      lockCount: p.lockCount,
      correct: p.correct,
      wrong: p.wrong,
      score: p.score,
      timeLeft: p.timeLeft,
      status: p.status,
      connected: p.connected,
    }))
    .sort((a, b) => b.score - a.score || b.locksOpen - a.locksOpen);
}

function findSessionByHost(socketId: string): EscapeSession | undefined {
  for (const s of sessions.values()) if (s.hostSocketId === socketId) return s;
  return undefined;
}

function findPlayerBySocket(socketId: string): { session: EscapeSession; player: EscapePlayer } | undefined {
  for (const s of sessions.values()) {
    for (const p of s.players.values()) {
      if (p.socketId === socketId) return { session: s, player: p };
    }
  }
  return undefined;
}

export function setupEscapeSocket(io: Server) {
  io.on("connection", (socket: Socket) => {

    // ── Teacher creates the vault session ──
    socket.on("escape:create", (raw: unknown, cb?: (res: { pin?: string; creatorToken?: string; error?: string }) => void) => {
      const reqSession = ((socket.request as unknown) as Record<string, unknown>).session as { teacherId?: number } | undefined;
      if (!reqSession?.teacherId) { cb?.({ error: "Authentication required" }); return; }
      const config = sanitizeConfig(raw);
      if (!config) { cb?.({ error: "Invalid room config (need at least 3 valid MCQ questions)" }); return; }

      const pin = generatePin();
      const creatorToken = randomBytes(16).toString("hex");
      sessions.set(pin, {
        pin, hostSocketId: socket.id, creatorToken, config,
        state: "lobby", players: new Map(), createdAt: Date.now(),
      });
      socket.join(`escape:${pin}`);
      cb?.({ pin, creatorToken });
    });

    // ── Teacher (re)binds to the session — page reload / reconnect safe ──
    socket.on("escape:host-join", (data: { pin?: string; creatorToken?: string }, cb?: (res: { ok?: boolean; error?: string; state?: string; title?: string; players?: unknown[] }) => void) => {
      const session = data?.pin ? sessions.get(data.pin) : undefined;
      if (!session || session.creatorToken !== data?.creatorToken) {
        cb?.({ error: "Session not found" });
        return;
      }
      session.hostSocketId = socket.id;
      socket.join(`escape:${session.pin}`);
      cb?.({ ok: true, state: session.state, title: session.config.title, players: serializePlayers(session) });
    });

    // ── Student joins with PIN + name ──
    socket.on("escape:join", (data: { pin?: string; name?: string }, cb?: (res: { ok?: boolean; error?: string; title?: string; state?: string; config?: EscapeConfig }) => void) => {
      const session = data?.pin ? sessions.get(data.pin) : undefined;
      if (!session) { cb?.({ error: "not-found" }); return; }
      const name = (data?.name || "").trim().slice(0, 30);
      if (!name) { cb?.({ error: "name-required" }); return; }

      // Rejoin by name (reconnect keeps the same record & progress snapshot).
      const existing = session.players.get(name);
      if (existing) {
        existing.socketId = socket.id;
        existing.connected = true;
      } else {
        session.players.set(name, {
          socketId: socket.id, name,
          locksOpen: 0, lockCount: session.config.lockCount,
          correct: 0, wrong: 0, score: 0,
          timeLeft: session.config.totalTime,
          status: session.state === "playing" ? "playing" : "waiting",
          connected: true, joinedAt: Date.now(),
        });
      }
      socket.join(`escape:${session.pin}`);
      cb?.({
        ok: true,
        title: session.config.title,
        state: session.state,
        // Config ships immediately when the run is already live (late joiner).
        config: session.state === "playing" ? session.config : undefined,
      });
      io.to(session.hostSocketId).emit("escape:players", { players: serializePlayers(session) });
      io.to(`escape:${session.pin}`).emit("escape:lobby-count", { count: session.players.size });
    });

    // ── Teacher opens the vault for everyone ──
    socket.on("escape:start", () => {
      const session = findSessionByHost(socket.id);
      if (!session || session.state !== "lobby") return;
      session.state = "playing";
      for (const p of session.players.values()) p.status = "playing";
      io.to(`escape:${session.pin}`).emit("escape:started", { config: session.config });
      io.to(session.hostSocketId).emit("escape:players", { players: serializePlayers(session) });
    });

    // ── Student streams a progress snapshot ──
    socket.on("escape:progress", (data: {
      locksOpen?: number; correct?: number; wrong?: number;
      score?: number; timeLeft?: number; status?: string;
    }) => {
      const found = findPlayerBySocket(socket.id);
      if (!found) return;
      const { session, player } = found;
      if (typeof data.locksOpen === "number") player.locksOpen = Math.max(0, Math.min(data.locksOpen, 10));
      if (typeof data.correct === "number") player.correct = Math.max(0, Math.min(data.correct, 999));
      if (typeof data.wrong === "number") player.wrong = Math.max(0, Math.min(data.wrong, 999));
      if (typeof data.score === "number") player.score = Math.max(0, Math.min(data.score, 999999));
      if (typeof data.timeLeft === "number") player.timeLeft = Math.max(0, Math.min(data.timeLeft, 3600));
      if (data.status === "won" || data.status === "lost") player.status = data.status;
      io.to(session.hostSocketId).emit("escape:players", { players: serializePlayers(session) });
    });

    // ── Teacher ends the session for everyone ──
    socket.on("escape:end", () => {
      const session = findSessionByHost(socket.id);
      if (!session) return;
      io.to(`escape:${session.pin}`).emit("escape:ended");
      sessions.delete(session.pin);
    });

    socket.on("disconnect", () => {
      const hostSession = findSessionByHost(socket.id);
      if (hostSession) {
        hostSession.hostSocketId = "";
        // Grace window: the host reclaims via escape:host-join (creatorToken).
        setTimeout(() => {
          const s = sessions.get(hostSession.pin);
          if (s && !s.hostSocketId) {
            io.to(`escape:${s.pin}`).emit("escape:ended");
            sessions.delete(s.pin);
          }
        }, 10 * 60 * 1000).unref?.();
        return;
      }
      const found = findPlayerBySocket(socket.id);
      if (found) {
        const { session, player } = found;
        if (session.state === "lobby") {
          session.players.delete(player.name);
        } else {
          // Mid-run: keep the record so a reconnect (same name) resumes cleanly.
          player.connected = false;
        }
        io.to(session.hostSocketId).emit("escape:players", { players: serializePlayers(session) });
        io.to(`escape:${session.pin}`).emit("escape:lobby-count", { count: session.players.size });
      }
    });
  });
}
