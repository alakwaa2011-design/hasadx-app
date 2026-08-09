import { Server } from "socket.io";
import { logger } from "../lib/logger";
import { randomBytes } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HotSeatPhase =
  | "lobby"
  | "picking"
  | "asking"
  | "answering"
  | "voting"
  | "result"
  | "ended";

export interface HotSeatStudent {
  socketId: string;
  uid: string;
  name: string;
  avatar: string;
  color: string;
  score: number;
  hasVoted: boolean;
  isOnSeat: boolean;
  roundsOnSeat: number;
}

export interface HotSeatQuestion {
  id: string;
  text: string;
  isPreset: boolean;
  authorUid: string;   // "teacher" | student uid — only teacher sees uid
  likes: number;
  likedBy: string[];
  imageUrl?: string | null;
}

interface HotSeatGame {
  pin: string;
  creatorSocketId: string;
  creatorToken: string;
  teacherName: string;
  grade: string;
  subject: string;
  topic?: string;
  timerDuration: number;   // seconds per answering round
  phase: HotSeatPhase;
  students: Record<string, HotSeatStudent>;  // keyed by uid
  uidBySocket: Record<string, string>;        // socketId → uid
  currentSeatUid?: string;
  currentQuestion?: string;
  currentQuestionId?: string;
  currentQuestionImageUrl?: string | null;
  timerVal: number;
  timerInterval?: ReturnType<typeof setInterval>;
  timerStartedAt?: number;
  votes: { yes: number; no: number };
  rounds: number;
  questions: Record<string, HotSeatQuestion>;
  questionCountByUid: Record<string, number>;  // uid → how many questions sent this round
  maxQuestionsPerStudent: number;
  lastResult?: { convincingPct: number; pointsAwarded: number; speedBonus: boolean };
}

// ─── State ────────────────────────────────────────────────────────────────────

const games = new Map<string, HotSeatGame>();

const STUDENT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
  "#10b981", "#6366f1",
];

const POINTS = {
  convincing: 10,
  neutral: 5,
  notConvincing: 2,
  goodQuestion: 3,
  speedBonus: 5,
};

function generatePin(): string {
  let pin: string;
  do {
    // 6-digit numeric PIN (100000–999999)
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (games.has(pin));
  return pin;
}

function pickColor(game: HotSeatGame): string {
  const used = new Set(Object.values(game.students).map(s => s.color));
  for (const c of STUDENT_COLORS) if (!used.has(c)) return c;
  return STUDENT_COLORS[Math.floor(Math.random() * STUDENT_COLORS.length)];
}

function getPublicStudent(s: HotSeatStudent) {
  return {
    uid: s.uid, name: s.name, avatar: s.avatar, color: s.color,
    score: s.score, isOnSeat: s.isOnSeat, roundsOnSeat: s.roundsOnSeat,
  };
}

function getPublicStudents(game: HotSeatGame) {
  return Object.values(game.students).map(getPublicStudent);
}

function getPublicQuestions(game: HotSeatGame) {
  return Object.values(game.questions).map(q => ({
    id: q.id, text: q.text, isPreset: q.isPreset, likes: q.likes, imageUrl: q.imageUrl ?? null,
  }));
}

/** For the host only — includes authorName so teacher can see who sent each question */
function getHostQuestions(game: HotSeatGame) {
  return Object.values(game.questions).map(q => ({
    id: q.id,
    text: q.text,
    isPreset: q.isPreset,
    likes: q.likes,
    imageUrl: q.imageUrl ?? null,
    authorName: q.authorUid === "teacher" ? "المعلم" : (game.students[q.authorUid]?.name ?? "طالب"),
  }));
}

function baseState(game: HotSeatGame) {
  return {
    pin: game.pin,
    phase: game.phase,
    teacherName: game.teacherName,
    grade: game.grade,
    subject: game.subject,
    topic: game.topic,
    timerDuration: game.timerDuration,
    timerVal: game.timerVal,
    currentSeatUid: game.currentSeatUid,
    currentQuestion: game.currentQuestion,
    currentQuestionImageUrl: game.currentQuestionImageUrl ?? null,
    votes: game.votes,
    rounds: game.rounds,
    lastResult: game.lastResult,
    students: getPublicStudents(game),
    questions: getPublicQuestions(game),
  };
}

function stopTimer(game: HotSeatGame) {
  if (game.timerInterval) { clearInterval(game.timerInterval); game.timerInterval = undefined; }
}

function cleanupGame(pin: string) {
  const game = games.get(pin);
  if (game) stopTimer(game);
  games.delete(pin);
}

export function getHotSeatGame(pin: string): HotSeatGame | undefined {
  return games.get(pin);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupHotSeatSocket(io: Server) {
  const ns = io.of("/hotseat");

  ns.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "HotSeat socket connected");

    // ── Create ──────────────────────────────────────────────────────────────
    socket.on("hotseat:create", (data: {
      teacherName: string;
      grade: string;
      subject: string;
      topic?: string;
      timerDuration?: number;
      seedQuestions?: Array<{ id: string; text: string; type?: string; options?: string[]; correct?: string; imageUrl?: string | null }>;
    }, cb: (r: object) => void) => {
      try {
        const pin = generatePin();
        const creatorToken = randomBytes(16).toString("hex");

        // Pre-populate questions from seedQuestions (from assignment / question bank)
        const presetQuestions: Record<string, HotSeatQuestion> = {};
        if (Array.isArray(data.seedQuestions)) {
          data.seedQuestions.slice(0, 40).forEach((q) => {
            const id = q.id || String(Date.now() + Math.random());
            presetQuestions[id] = {
              id,
              text: q.text,
              isPreset: true,
              authorUid: "teacher",
              likes: 0,
              likedBy: [],
              imageUrl: typeof q.imageUrl === "string" ? q.imageUrl.slice(0, 2000) : null,
            };
          });
        }

        const game: HotSeatGame = {
          pin, creatorSocketId: socket.id, creatorToken,
          teacherName: (data.teacherName || "المعلم").trim(),
          grade: (data.grade || "").trim(),
          subject: (data.subject || "").trim(),
          topic: data.topic?.trim() || undefined,
          timerDuration: Math.max(10, Math.min(120, data.timerDuration ?? 30)),
          phase: "lobby",
          students: {}, uidBySocket: {},
          timerVal: 0, votes: { yes: 0, no: 0 }, rounds: 0,
          questions: presetQuestions,
          questionCountByUid: {},
          maxQuestionsPerStudent: 2,
        };
        games.set(pin, game);
        socket.join(`hotseat:${pin}`);

        // Auto-cleanup after 12 hours
        setTimeout(() => cleanupGame(pin), 12 * 60 * 60 * 1000);

        logger.info({ pin }, "HotSeat game created");
        cb({ pin, creatorToken });
      } catch (err) {
        logger.error(err, "hotseat:create error");
        cb({ error: "حدث خطأ في الإنشاء" });
      }
    });

    // ── Reclaim host ─────────────────────────────────────────────────────────
    socket.on("hotseat:reclaim", (data: { pin: string; creatorToken: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorToken !== data.creatorToken) return cb({ error: "رمز غير صحيح." });
      game.creatorSocketId = socket.id;
      socket.join(`hotseat:${game.pin}`);
      cb({ success: true, state: baseState(game) });
    });

    // ── Student join ─────────────────────────────────────────────────────────
    socket.on("hotseat:join", (data: {
      pin: string; name: string; avatar?: string;
    }, cb: (r: object) => void) => {
      try {
        const game = games.get(data.pin);
        if (!game) return cb({ error: "لم يتم العثور على غرفة بهذا الكود." });
        if (game.phase === "ended") return cb({ error: "انتهت الجلسة." });

        const trimmedName = (data.name || "").trim();
        if (!trimmedName) return cb({ error: "يرجى إدخال اسمك." });
        if (trimmedName.length > 30) return cb({ error: "الاسم طويل جداً." });

        // Check for duplicate name
        const existingByName = Object.values(game.students).find(
          s => s.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (existingByName) {
          // Rejoin: update socket
          delete game.uidBySocket[existingByName.socketId];
          existingByName.socketId = socket.id;
          game.uidBySocket[socket.id] = existingByName.uid;
          socket.join(`hotseat:${game.pin}`);
          ns.to(`hotseat:${game.pin}`).emit("hotseat:players-updated", {
            students: getPublicStudents(game),
          });
          return cb({
            success: true, uid: existingByName.uid, color: existingByName.color,
            state: baseState(game),
          });
        }

        const uid = randomBytes(8).toString("hex");
        const student: HotSeatStudent = {
          socketId: socket.id, uid, name: trimmedName,
          avatar: data.avatar || "😀", color: pickColor(game),
          score: 0, hasVoted: false, isOnSeat: false, roundsOnSeat: 0,
        };
        game.students[uid] = student;
        game.uidBySocket[socket.id] = uid;
        socket.join(`hotseat:${game.pin}`);

        ns.to(`hotseat:${game.pin}`).emit("hotseat:players-updated", {
          students: getPublicStudents(game),
        });
        cb({ success: true, uid, color: student.color, state: baseState(game) });
      } catch (err) {
        logger.error(err, "hotseat:join error");
        cb({ error: "حدث خطأ" });
      }
    });

    // ── Start game (teacher) ──────────────────────────────────────────────────
    socket.on("hotseat:start", (data: { pin: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      if (Object.keys(game.students).length < 1) return cb({ error: "لا يوجد طلاب." });
      game.phase = "picking";
      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", { phase: "picking", state: baseState(game) });
      cb({ success: true });
    });

    // ── Pick seat (teacher) ───────────────────────────────────────────────────
    socket.on("hotseat:pick-seat", (data: { pin: string; uid: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });

      const student = game.students[data.uid];
      if (!student) return cb({ error: "الطالب غير موجود." });

      // Clear old seat
      for (const s of Object.values(game.students)) s.isOnSeat = false;
      student.isOnSeat = true;
      student.roundsOnSeat++;
      game.currentSeatUid = data.uid;
      game.phase = "asking";
      game.questions = {};
      game.votes = { yes: 0, no: 0 };
      game.currentQuestion = undefined;
      game.currentQuestionId = undefined;
      game.currentQuestionImageUrl = null;
      game.questionCountByUid = {}; // reset per-student question counts
      game.rounds++;

      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
        phase: "asking",
        state: baseState(game),
        seatStudent: getPublicStudent(student),
      });
      cb({ success: true });
    });

    // ── Submit question (student) ─────────────────────────────────────────────
    socket.on("hotseat:send-question", (data: { pin: string; text: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.phase !== "asking") return cb({ error: "ليس وقت الأسئلة الآن." });

      const uid = game.uidBySocket[socket.id];
      const text = (data.text || "").trim();
      if (!text || text.length > 200) return cb({ error: "نص السؤال غير صالح." });

      // Don't let the person on the seat submit
      if (game.currentSeatUid === uid) return cb({ error: "لا يمكنك إرسال سؤال لنفسك." });

      // Enforce per-student question limit
      const sent = game.questionCountByUid[uid || "anon"] ?? 0;
      if (sent >= game.maxQuestionsPerStudent) {
        return cb({ error: `وصلت للحد الأقصى (${game.maxQuestionsPerStudent} أسئلة لكل طالب).` });
      }

      const id = randomBytes(6).toString("hex");
      game.questions[id] = { id, text, isPreset: false, authorUid: uid || "anon", likes: 0, likedBy: [] };
      game.questionCountByUid[uid || "anon"] = sent + 1;

      // Broadcast to all students (anonymous)
      ns.to(`hotseat:${game.pin}`).emit("hotseat:questions-updated", {
        questions: getPublicQuestions(game),
      });
      // Send host-enriched version to creator only
      const creatorSocket = ns.sockets.get(game.creatorSocketId);
      if (creatorSocket) {
        creatorSocket.emit("hotseat:host-questions-updated", {
          questions: getHostQuestions(game),
        });
      }
      cb({ success: true, id, sentCount: sent + 1, maxAllowed: game.maxQuestionsPerStudent });
    });

    // ── Like question ─────────────────────────────────────────────────────────
    socket.on("hotseat:like-question", (data: { pin: string; questionId: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      const uid = game.uidBySocket[socket.id] || socket.id;
      const q = game.questions[data.questionId];
      if (!q) return cb({ error: "السؤال غير موجود." });
      if (q.likedBy.includes(uid)) {
        // Toggle: unlike
        q.likedBy = q.likedBy.filter(u => u !== uid);
        q.likes = q.likedBy.length;
      } else {
        q.likedBy.push(uid);
        q.likes = q.likedBy.length;
      }
      ns.to(`hotseat:${game.pin}`).emit("hotseat:questions-updated", {
        questions: getPublicQuestions(game),
      });
      cb({ success: true });
    });

    // ── Add preset question (teacher) ─────────────────────────────────────────
    socket.on("hotseat:add-preset", (data: { pin: string; text: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      const text = (data.text || "").trim();
      if (!text) return cb({ error: "نص فارغ." });
      const id = randomBytes(6).toString("hex");
      game.questions[id] = { id, text, isPreset: true, authorUid: "teacher", likes: 0, likedBy: [] };
      ns.to(`hotseat:${game.pin}`).emit("hotseat:questions-updated", {
        questions: getPublicQuestions(game),
      });
      cb({ success: true, id });
    });

    // ── Pick question and start round (teacher) ───────────────────────────────
    socket.on("hotseat:pick-question", (data: {
      pin: string; questionId?: string; customText?: string;
    }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });
      if (game.phase !== "asking") return cb({ error: "المرحلة غير صحيحة." });

      let questionText = "";
      let questionId = "";
      let questionImageUrl: string | null = null;

      if (data.customText) {
        questionText = data.customText.trim();
        questionId = "custom_" + randomBytes(4).toString("hex");
      } else if (data.questionId && game.questions[data.questionId]) {
        const q = game.questions[data.questionId];
        questionText = q.text;
        questionId = data.questionId;
        questionImageUrl = q.imageUrl ?? null;
        // Award points to question author
        if (!q.isPreset && q.authorUid && q.authorUid !== "teacher") {
          const author = Object.values(game.students).find(s => s.uid === q.authorUid);
          if (author) author.score += POINTS.goodQuestion;
        }
      } else {
        return cb({ error: "لم يتم تحديد سؤال." });
      }

      game.currentQuestion = questionText;
      game.currentQuestionId = questionId;
      game.currentQuestionImageUrl = questionImageUrl;
      game.phase = "answering";
      game.timerVal = game.timerDuration;
      game.timerStartedAt = Date.now();

      // Reset votes
      game.votes = { yes: 0, no: 0 };
      for (const s of Object.values(game.students)) s.hasVoted = false;

      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
        phase: "answering",
        state: baseState(game),
      });

      // Server-side countdown
      stopTimer(game);
      game.timerInterval = setInterval(() => {
        game.timerVal--;
        ns.to(`hotseat:${game.pin}`).emit("hotseat:timer-tick", {
          timerVal: game.timerVal,
        });
        if (game.timerVal <= 0) {
          stopTimer(game);
          // Auto-advance to voting
          game.phase = "voting";
          ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
            phase: "voting",
            state: baseState(game),
          });
        }
      }, 1000);

      cb({ success: true });
    });

    // ── Vote (student) ────────────────────────────────────────────────────────
    socket.on("hotseat:vote", (data: { pin: string; vote: "yes" | "no" }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.phase !== "voting") return cb({ error: "ليس وقت التصويت." });

      const uid = game.uidBySocket[socket.id];
      if (!uid) return cb({ error: "غير مسجل." });
      if (uid === game.currentSeatUid) return cb({ error: "لا يمكنك التصويت على نفسك." });

      const student = game.students[uid];
      if (!student) return cb({ error: "الطالب غير موجود." });
      if (student.hasVoted) return cb({ error: "لقد صوّتت بالفعل." });

      student.hasVoted = true;
      if (data.vote === "yes") game.votes.yes++;
      else game.votes.no++;

      ns.to(`hotseat:${game.pin}`).emit("hotseat:vote-update", {
        votes: game.votes,
        totalVoters: Object.values(game.students).filter(s => !s.isOnSeat).length,
      });
      cb({ success: true });
    });

    // ── Show result (teacher) ─────────────────────────────────────────────────
    socket.on("hotseat:show-result", (data: { pin: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });

      stopTimer(game);

      const total = game.votes.yes + game.votes.no;
      const convincingPct = total > 0 ? Math.round((game.votes.yes / total) * 100) : 0;

      let points = POINTS.notConvincing;
      if (convincingPct > 60) points = POINTS.convincing;
      else if (convincingPct >= 40) points = POINTS.neutral;

      // Speed bonus: if timer ended with > (timerDuration - 10) seconds remaining
      const elapsed = game.timerStartedAt ? (Date.now() - game.timerStartedAt) / 1000 : game.timerDuration;
      const speedBonus = elapsed < 10;
      if (speedBonus) points += POINTS.speedBonus;

      // Award to seat student
      const seatStudent = game.currentSeatUid ? game.students[game.currentSeatUid] : null;
      if (seatStudent) seatStudent.score += points;

      game.lastResult = { convincingPct, pointsAwarded: points, speedBonus };
      game.phase = "result";

      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
        phase: "result",
        state: baseState(game),
        result: game.lastResult,
      });
      cb({ success: true });
    });

    // ── Next round (teacher: back to picking) ─────────────────────────────────
    socket.on("hotseat:next-round", (data: { pin: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });

      stopTimer(game);
      for (const s of Object.values(game.students)) s.isOnSeat = false;
      game.currentSeatUid = undefined;
      game.currentQuestion = undefined;
      game.currentQuestionId = undefined;
      game.currentQuestionImageUrl = null;
      game.questions = {};
      game.votes = { yes: 0, no: 0 };
      game.phase = "picking";

      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
        phase: "picking",
        state: baseState(game),
      });
      cb({ success: true });
    });

    // ── End session (teacher) ─────────────────────────────────────────────────
    socket.on("hotseat:end", (data: { pin: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      if (!game) return cb({ error: "الغرفة غير موجودة." });
      if (game.creatorSocketId !== socket.id) return cb({ error: "غير مصرح." });

      stopTimer(game);
      game.phase = "ended";

      const sorted = Object.values(game.students).sort((a, b) => b.score - a.score);
      ns.to(`hotseat:${game.pin}`).emit("hotseat:phase-change", {
        phase: "ended",
        state: baseState(game),
        finalRanking: sorted.map((s, i) => ({ ...getPublicStudent(s), rank: i + 1 })),
      });
      cb({ success: true });

      setTimeout(() => cleanupGame(game.pin), 30 * 60 * 1000);
    });

    // ── Check room exists (HTTP-style via socket) ─────────────────────────────
    socket.on("hotseat:check", (data: { pin: string }, cb: (r: object) => void) => {
      const game = games.get(data.pin);
      cb({ exists: !!game && game.phase !== "ended", phase: game?.phase });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Players remain in game state for rejoin; don't delete them
      logger.debug({ socketId: socket.id }, "HotSeat socket disconnected");
    });
  });
}
