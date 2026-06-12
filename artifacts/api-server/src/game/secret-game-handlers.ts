import { Server, Socket } from "socket.io";
import { createHmac } from "crypto";
import { logger } from "../lib/logger";
import { db, secretGameCategoriesTable, secretGameItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for secret-game token signing");
}
const TOKEN_SECRET = process.env.SESSION_SECRET;
const TOKEN_TTL_SECS = 5 * 60; // 5 minutes

function jwtBase64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function generateRevealToken(pin: string, team: "A" | "B", itemId: number): string {
  const header = jwtBase64url({ alg: "HS256", typ: "JWT" });
  const iat = Math.floor(Date.now() / 1000);
  const payload = jwtBase64url({ pin, team, item_id: itemId, session_id: pin, iat, exp: iat + TOKEN_TTL_SECS });
  const sig = createHmac("sha256", TOKEN_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyRevealToken(token: string): { pin: string; team: "A" | "B"; itemId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payloadB64, sig] = parts;
  const expectedSig = createHmac("sha256", TOKEN_SECRET).update(`${header}.${payloadB64}`).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return { pin: payload.pin, team: payload.team, itemId: payload.item_id };
  } catch {
    return null;
  }
}

interface TeamState {
  name: string;
  color: string;
  secretId: number;
  secretName: string;
  secretImage: string | null;
  scanned: boolean;
  questionCount: number;
  penalty: boolean;
  penaltyUntil: number;
}

interface SecretRoom {
  pin: string;
  categoryId: number;
  teams: { A: TeamState; B: TeamState };
  currentAsker: "A" | "B";
  totalQuestions: number;
  maxQuestions: number;
  phase: "waiting_scan" | "playing" | "guessing" | "ended";
  winner: "A" | "B" | null;
  hostSocketId: string;
  createdAt: number;
}

const rooms = new Map<string, SecretRoom>();
const socketToPin = new Map<string, string>();

function genPin(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p = "";
  for (let i = 0; i < 6; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function uniquePin(): string {
  let p = genPin();
  while (rooms.has(p)) p = genPin();
  return p;
}

function getRoomState(room: SecretRoom) {
  return {
    pin: room.pin,
    teams: {
      A: { name: room.teams.A.name, color: room.teams.A.color, scanned: room.teams.A.scanned, questionCount: room.teams.A.questionCount, penalty: room.teams.A.penalty },
      B: { name: room.teams.B.name, color: room.teams.B.color, scanned: room.teams.B.scanned, questionCount: room.teams.B.questionCount, penalty: room.teams.B.penalty },
    },
    currentAsker: room.currentAsker,
    totalQuestions: room.totalQuestions,
    maxQuestions: room.maxQuestions,
    phase: room.phase,
    winner: room.winner,
  };
}

async function pickRandomItems(categoryId: number, count: number) {
  const items = await db
    .select()
    .from(secretGameItemsTable)
    .where(eq(secretGameItemsTable.categoryId, categoryId))
    .orderBy(sql`RANDOM()`)
    .limit(count);
  return items;
}

export function setupSecretGameSocket(io: Server) {
  setInterval(() => {
    const now = Date.now();
    for (const [pin, room] of rooms) {
      if (now - room.createdAt > 3 * 60 * 60 * 1000) {
        socketToPin.delete(room.hostSocketId);
        rooms.delete(pin);
      }
    }
  }, 30 * 60 * 1000);

  io.on("connection", (socket: Socket) => {
    socket.on("secret:create", async (
      data: { categoryId: number; teamAName: string; teamBName: string; teamAColor: string; teamBColor: string; maxQuestions?: number },
      cb?: (res: { pin?: string; tokenA?: string; tokenB?: string; error?: string }) => void,
    ) => {
      try {
        const items = await pickRandomItems(data.categoryId, 2);
        if (items.length < 2) {
          cb?.({ error: "لا توجد عناصر كافية في هذه الفئة" });
          return;
        }
        const pin = uniquePin();
        const [itemA, itemB] = items;
        const tokenA = generateRevealToken(pin, "A", itemA.id);
        const tokenB = generateRevealToken(pin, "B", itemB.id);
        const room: SecretRoom = {
          pin,
          categoryId: data.categoryId,
          teams: {
            A: { name: data.teamAName || "الفريق الأحمر", color: data.teamAColor || "#dc2626", secretId: itemA.id, secretName: itemA.nameAr, secretImage: itemA.imageUrl, scanned: false, questionCount: 0, penalty: false, penaltyUntil: 0 },
            B: { name: data.teamBName || "الفريق الأزرق", color: data.teamBColor || "#2563eb", secretId: itemB.id, secretName: itemB.nameAr, secretImage: itemB.imageUrl, scanned: false, questionCount: 0, penalty: false, penaltyUntil: 0 },
          },
          currentAsker: "B",
          totalQuestions: 0,
          maxQuestions: Math.min(data.maxQuestions ?? 10, 10),
          phase: "waiting_scan",
          winner: null,
          hostSocketId: socket.id,
          createdAt: Date.now(),
        };
        rooms.set(pin, room);
        socketToPin.set(socket.id, pin);
        socket.join(`secret:${pin}`);
        logger.info({ pin, catId: data.categoryId }, "Secret game room created");
        cb?.({ pin, tokenA, tokenB });
      } catch (err) {
        logger.error(err, "secret:create error");
        cb?.({ error: "فشل إنشاء الغرفة" });
      }
    });

    socket.on("secret:scan_confirm", (
      data: { pin: string; team: "A" | "B" },
      cb?: (res: { ok?: boolean; error?: string }) => void,
    ) => {
      const room = rooms.get(data.pin?.toUpperCase());
      if (!room) { cb?.({ error: "الغرفة غير موجودة" }); return; }
      room.teams[data.team].scanned = true;
      io.to(`secret:${room.pin}`).emit("secret:state", getRoomState(room));
      if (room.teams.A.scanned && room.teams.B.scanned && room.phase === "waiting_scan") {
        room.phase = "playing";
        io.to(`secret:${room.pin}`).emit("secret:started", getRoomState(room));
        logger.info({ pin: room.pin }, "Secret game started");
      }
      cb?.({ ok: true });
    });

    socket.on("secret:question", (
      data: { pin: string },
      cb?: (res: { ok?: boolean; error?: string }) => void,
    ) => {
      const pin = (data.pin ?? socketToPin.get(socket.id) ?? "").toUpperCase();
      const room = rooms.get(pin);
      if (!room) { cb?.({ error: "لا توجد غرفة" }); return; }
      if (room.phase !== "playing") { cb?.({ error: "اللعبة لم تبدأ بعد" }); return; }
      if (room.totalQuestions >= room.maxQuestions) {
        cb?.({ error: `وصلنا للحد الأقصى من الأسئلة (${room.maxQuestions})` });
        return;
      }

      room.totalQuestions += 1;
      const state = getRoomState(room);
      io.to(`secret:${room.pin}`).emit("secret:question_asked", state);

      if (room.totalQuestions >= room.maxQuestions) {
        room.phase = "ended";
        room.winner = null;
        io.to(`secret:${room.pin}`).emit("secret:game_over", {
          winner: null,
          winnerName: "تعادل",
          secrets: {
            A: { name: room.teams.A.secretName, image: room.teams.A.secretImage },
            B: { name: room.teams.B.secretName, image: room.teams.B.secretImage },
          },
          state: getRoomState(room),
        });
        logger.info({ pin: room.pin }, "Secret game ended — question limit reached (draw)");
      }

      cb?.({ ok: true });
    });

    socket.on("secret:answer", (
      data: { pin: string; answer: "yes" | "no" },
      cb?: (res: { ok?: boolean }) => void,
    ) => {
      const pin = (data.pin ?? socketToPin.get(socket.id) ?? "").toUpperCase();
      const room = rooms.get(pin);
      if (!room || room.phase !== "playing") { cb?.({ ok: false }); return; }
      io.to(`secret:${room.pin}`).emit("secret:answered", { answer: data.answer, state: getRoomState(room) });
      cb?.({ ok: true });
    });

    socket.on("secret:guess", (
      data: { pin: string; team: "A" | "B" },
      cb?: (res: { correct?: boolean; error?: string }) => void,
    ) => {
      const room = rooms.get((data.pin ?? "").toUpperCase());
      if (!room || room.phase === "ended") { cb?.({ error: "لا توجد غرفة" }); return; }

      room.phase = "ended";
      room.winner = data.team;
      io.to(`secret:${room.pin}`).emit("secret:game_over", {
        winner: data.team,
        winnerName: room.teams[data.team].name,
        secrets: {
          A: { name: room.teams.A.secretName, image: room.teams.A.secretImage },
          B: { name: room.teams.B.secretName, image: room.teams.B.secretImage },
        },
        state: getRoomState(room),
      });
      logger.info({ pin: room.pin, winner: data.team }, "Secret game ended — teacher confirmed guess");
      cb?.({ correct: true });
    });

    socket.on("secret:force_start", (
      data: { pin: string },
      cb?: (res: { ok?: boolean; error?: string }) => void,
    ) => {
      const room = rooms.get((data.pin ?? "").toUpperCase());
      if (!room) { cb?.({ error: "لا توجد غرفة" }); return; }
      if (room.hostSocketId !== socket.id) { cb?.({ error: "المضيف فقط يستطيع ذلك" }); return; }
      room.phase = "playing";
      io.to(`secret:${room.pin}`).emit("secret:started", getRoomState(room));
      cb?.({ ok: true });
    });

    socket.on("secret:next_round", async (
      data: { pin: string },
      cb?: (res: { tokenA?: string; tokenB?: string; error?: string }) => void,
    ) => {
      const room = rooms.get((data.pin ?? "").toUpperCase());
      if (!room) { cb?.({ error: "لا توجد غرفة" }); return; }
      if (room.hostSocketId !== socket.id) { cb?.({ error: "المضيف فقط يستطيع ذلك" }); return; }
      try {
        const items = await pickRandomItems(room.categoryId, 2);
        if (items.length < 2) { cb?.({ error: "لا توجد عناصر كافية" }); return; }
        const [itemA, itemB] = items;
        room.teams.A = { ...room.teams.A, secretId: itemA.id, secretName: itemA.nameAr, secretImage: itemA.imageUrl, scanned: false, questionCount: 0, penalty: false, penaltyUntil: 0 };
        room.teams.B = { ...room.teams.B, secretId: itemB.id, secretName: itemB.nameAr, secretImage: itemB.imageUrl, scanned: false, questionCount: 0, penalty: false, penaltyUntil: 0 };
        room.currentAsker = "B";
        room.totalQuestions = 0;
        room.phase = "waiting_scan";
        room.winner = null;
        const tokenA = generateRevealToken(room.pin, "A", itemA.id);
        const tokenB = generateRevealToken(room.pin, "B", itemB.id);
        io.to(`secret:${room.pin}`).emit("secret:new_round", { ...getRoomState(room), tokenA, tokenB });
        cb?.({ tokenA, tokenB });
      } catch (err) {
        logger.error(err, "secret:next_round error");
        cb?.({ error: "خطأ في إنشاء جولة جديدة" });
      }
    });

    socket.on("secret:get_state", (
      data: { pin: string },
      cb?: (res: { state?: ReturnType<typeof getRoomState>; error?: string }) => void,
    ) => {
      const room = rooms.get((data.pin ?? "").toUpperCase());
      if (!room) { cb?.({ error: "لا توجد غرفة" }); return; }
      socket.join(`secret:${room.pin}`);
      const prevHostConnected = io.sockets.sockets.has(room.hostSocketId);
      if (!prevHostConnected) {
        room.hostSocketId = socket.id;
        socketToPin.set(socket.id, room.pin);
      }
      cb?.({ state: getRoomState(room) });
    });

    socket.on("disconnect", () => {
      socketToPin.delete(socket.id);
    });
  });
}

export { rooms as secretGameRooms };
