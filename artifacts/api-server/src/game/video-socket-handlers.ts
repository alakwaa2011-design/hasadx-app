import { Server, Socket } from "socket.io";
import {
  db,
  videoLessonsTable,
  videoQuestionsTable,
  videoSubmissionsTable,
  videoAnswersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

interface VideoQuestion {
  id: number;
  timestampSeconds: number;
  questionType: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
}

interface StudentEntry {
  participantId: string;
  socketId: string;
  name: string;
  studentClass: string;
  studentId: number | null;
  answers: Map<number, { selectedAnswer: string; isCorrect: boolean }>;
}

interface SkipSegment {
  start: number;
  end: number;
}

interface VideoRoom {
  roomCode: string;
  lessonId: number;
  lessonTitle: string;
  videoUrl: string;
  videoType: string;
  teacherId: number;
  teacherSocketId: string;
  students: Map<string, StudentEntry>;
  participants: Map<string, StudentEntry>;
  nextParticipantId: number;
  questions: VideoQuestion[];
  skipSegments: SkipSegment[];
  activeQuestionId: number | null;
  answeredQuestions: Set<number>;
  videoState: "paused" | "playing";
  currentTime: number;
  createdAt: number;
  ending: boolean;
}

const rooms = new Map<string, VideoRoom>();
const teacherRooms = new Map<string, string>();
const teacherDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function getTeacherIdFromSocket(socket: Socket): number | null {
  const session = (
    (socket.request as unknown) as Express.Request & { session?: { teacherId?: number } }
  ).session;
  return session?.teacherId ?? null;
}

async function getTeacherIdFromSocketAsync(socket: Socket): Promise<number | null> {
  const session = (
    (socket.request as unknown) as Express.Request & { session?: { teacherId?: number; reload?: (cb: (err?: unknown) => void) => void } }
  ).session;
  if (!session) return null;
  if (typeof session.reload === "function") {
    await new Promise<void>((resolve) => session.reload!((err) => {
      if (err) logger.warn({ err }, "Session reload error");
      resolve();
    }));
  }
  return session.teacherId ?? null;
}

function getAnswerStats(room: VideoRoom, questionId: number) {
  let total = 0;
  let correct = 0;
  const distribution: Record<string, number> = {};

  for (const student of room.participants.values()) {
    const ans = student.answers.get(questionId);
    if (ans) {
      total++;
      if (ans.isCorrect) correct++;
      distribution[ans.selectedAnswer] =
        (distribution[ans.selectedAnswer] || 0) + 1;
    }
  }

  return { total, correct, wrong: total - correct, distribution, studentCount: room.participants.size };
}

export function setupVideoSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on(
      "video:create-room",
      async (
        data: { lessonId: number },
        callback: (res: {
          roomCode?: string;
          lesson?: { title: string; videoUrl: string; videoType: string; questions: VideoQuestion[]; skipSegments: SkipSegment[] };
          error?: string;
        }) => void,
      ) => {
        try {
          const teacherId = await getTeacherIdFromSocketAsync(socket);
          if (!teacherId) {
            callback({ error: "يجب تسجيل الدخول أولاً. يرجى إعادة تحميل الصفحة وتسجيل الدخول." });
            return;
          }

          const existingCode = teacherRooms.get(socket.id);
          if (existingCode) {
            const existing = rooms.get(existingCode);
            if (existing) {
              if (existing.lessonId === data.lessonId) {
                // Same lesson — return the existing room (page refresh / reconnect)
                callback({
                  roomCode: existingCode,
                  lesson: {
                    title: existing.lessonTitle,
                    videoUrl: existing.videoUrl,
                    videoType: existing.videoType,
                    questions: existing.questions,
                    skipSegments: existing.skipSegments,
                  },
                });
                return;
              } else {
                // Different lesson — end the old session so students aren't stranded,
                // then fall through to create a fresh room for the new lesson.
                logger.info({ oldCode: existingCode, newLessonId: data.lessonId }, "Teacher switching to a different lesson — ending old room");
                existing.ending = true;
                io.to(`vroom:${existingCode}`).emit("video:session-ended", { message: "انتهت الجلسة" });
                rooms.delete(existingCode);
                teacherRooms.delete(socket.id);
              }
            }
          }

          // Terminate any stale room(s) this teacher owns for a DIFFERENT lesson.
          // This covers the case where the teacher closed the tab (new socket ID)
          // and then opens a different video — teacherRooms.get(socket.id) is empty
          // in that case, so we must do a teacherId-based scan here.
          for (const [staleCode, staleRoom] of rooms) {
            if (
              staleRoom.teacherId === teacherId &&
              staleRoom.lessonId !== data.lessonId &&
              !staleRoom.ending
            ) {
              logger.info({ staleCode, newLessonId: data.lessonId }, "Teacher opened different lesson — ending stale room by teacherId");
              staleRoom.ending = true;
              io.to(`vroom:${staleCode}`).emit("video:session-ended", { message: "انتهت الجلسة" });
              const staleOldSocket = staleRoom.teacherSocketId;
              const pendingTimer = teacherDisconnectTimers.get(staleOldSocket);
              if (pendingTimer) {
                clearTimeout(pendingTimer);
                teacherDisconnectTimers.delete(staleOldSocket);
              }
              teacherRooms.delete(staleOldSocket);
              rooms.delete(staleCode);
            }
          }

          for (const [code, existingRoom] of rooms) {
            if (existingRoom.teacherId === teacherId && existingRoom.lessonId === data.lessonId && !existingRoom.ending) {
              const oldSocketId = existingRoom.teacherSocketId;
              const pendingTimer = teacherDisconnectTimers.get(oldSocketId);
              if (pendingTimer) {
                clearTimeout(pendingTimer);
                teacherDisconnectTimers.delete(oldSocketId);
              }
              existingRoom.teacherSocketId = socket.id;
              teacherRooms.set(socket.id, code);
              socket.join(`vroom:${code}`);

              // Notify students the teacher is back
              socket.to(`vroom:${code}`).emit("video:teacher-reconnected");

              // Re-send current video state so students sync immediately
              socket.to(`vroom:${code}`).emit("video:sync-state", {
                state: existingRoom.activeQuestionId !== null ? "paused" : existingRoom.videoState,
                currentTime: existingRoom.currentTime,
              });

              // If a question was active when teacher disconnected, re-send it
              if (existingRoom.activeQuestionId !== null) {
                const q = existingRoom.questions.find(qq => qq.id === existingRoom.activeQuestionId);
                if (q) {
                  socket.to(`vroom:${code}`).emit("video:question", {
                    id: q.id,
                    text: q.text,
                    questionType: q.questionType,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    points: q.points,
                  });
                }
              }

              callback({
                roomCode: code,
                lesson: {
                  title: existingRoom.lessonTitle,
                  videoUrl: existingRoom.videoUrl,
                  videoType: existingRoom.videoType,
                  questions: existingRoom.questions,
                  skipSegments: existingRoom.skipSegments,
                },
              });
              return;
            }
          }

          const [lesson] = await db
            .select()
            .from(videoLessonsTable)
            .where(eq(videoLessonsTable.id, data.lessonId))
            .limit(1);

          if (!lesson) {
            callback({ error: "درس غير موجود" });
            return;
          }

          if (lesson.teacherId !== teacherId) {
            callback({ error: "غير مصرح" });
            return;
          }

          const questions = await db
            .select()
            .from(videoQuestionsTable)
            .where(eq(videoQuestionsTable.videoLessonId, data.lessonId))
            .orderBy(videoQuestionsTable.timestampSeconds);

          const roomCode = generateRoomCode();

          let parsedSkipSegments: SkipSegment[] = [];
          if (lesson.skipSegments) {
            try {
              const raw = JSON.parse(lesson.skipSegments);
              if (Array.isArray(raw)) parsedSkipSegments = raw;
            } catch {}
          }

          const room: VideoRoom = {
            roomCode,
            lessonId: data.lessonId,
            lessonTitle: lesson.title,
            videoUrl: lesson.videoUrl,
            videoType: lesson.videoType || "youtube",
            teacherId,
            teacherSocketId: socket.id,
            students: new Map(),
            participants: new Map(),
            nextParticipantId: 1,
            questions: questions.map((q) => ({
              id: q.id,
              timestampSeconds: q.timestampSeconds,
              questionType: q.questionType || "mcq",
              text: q.text,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              correctAnswer: q.correctAnswer,
              points: q.points,
            })),
            skipSegments: parsedSkipSegments,
            activeQuestionId: null,
            answeredQuestions: new Set(),
            videoState: "paused",
            currentTime: 0,
            createdAt: Date.now(),
            ending: false,
          };

          rooms.set(roomCode, room);
          teacherRooms.set(socket.id, roomCode);
          socket.join(`vroom:${roomCode}`);

          logger.info({ roomCode, lessonId: data.lessonId, teacherId }, "Video room created");

          callback({
            roomCode,
            lesson: {
              title: lesson.title,
              videoUrl: lesson.videoUrl,
              videoType: lesson.videoType || "youtube",
              questions: room.questions,
              skipSegments: room.skipSegments,
            },
          });
        } catch (err) {
          logger.error({ err }, "Error creating video room");
          callback({ error: "خطأ في إنشاء الغرفة" });
        }
      },
    );

    socket.on(
      "video:join-room",
      (
        data: { roomCode: string; name: string; studentClass?: string; studentId?: number; existingParticipantId?: string },
        callback: (res: {
          success?: boolean;
          participantId?: string;
          lesson?: { title: string; videoUrl: string; videoType: string; skipSegments: SkipSegment[] };
          videoState?: string;
          currentTime?: number;
          activeQuestion?: {
            id: number;
            text: string;
            questionType: string;
            optionA: string | null;
            optionB: string | null;
            optionC: string | null;
            optionD: string | null;
            points: number;
          } | null;
          error?: string;
        }) => void,
      ) => {
        const code = (data.roomCode || "").trim().toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          callback({ error: "الغرفة غير موجودة" });
          return;
        }

        const name = (data.name || "").trim();
        if (!name) {
          callback({ error: "يرجى إدخال الاسم" });
          return;
        }

        // ── Reconnect path: student already has a participantId from a previous join ──
        if (data.existingParticipantId) {
          const existing = room.participants.get(data.existingParticipantId);
          if (existing) {
            // Remove old socket mapping (if still there)
            room.students.delete(existing.socketId);
            // Update to new socket
            existing.socketId = socket.id;
            room.students.set(socket.id, existing);
            socket.join(`vroom:${code}`);

            io.to(room.teacherSocketId).emit("video:student-joined", {
              participantId: existing.participantId,
              name: existing.name,
              studentCount: room.students.size,
              students: Array.from(room.students.values()).map((s) => ({
                participantId: s.participantId,
                name: s.name,
                studentClass: s.studentClass,
              })),
            });

            let activeQuestion: {
              id: number; text: string; questionType: string;
              optionA: string | null; optionB: string | null;
              optionC: string | null; optionD: string | null; points: number;
            } | null = null;
            if (room.activeQuestionId !== null) {
              const q = room.questions.find((qq) => qq.id === room.activeQuestionId);
              if (q) {
                activeQuestion = { id: q.id, text: q.text, questionType: q.questionType,
                  optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, points: q.points };
              }
            }

            callback({
              success: true,
              participantId: existing.participantId,
              lesson: { title: room.lessonTitle, videoUrl: room.videoUrl, videoType: room.videoType, skipSegments: room.skipSegments },
              videoState: room.activeQuestionId !== null ? "paused" : room.videoState,
              currentTime: room.currentTime,
              activeQuestion,
            });
            logger.info({ roomCode: code, name, participantId: existing.participantId }, "Student reconnected to video room");
            return;
          }
        }

        // ── New join path ──
        const participantId = `p${room.nextParticipantId++}`;
        const student: StudentEntry = {
          participantId,
          socketId: socket.id,
          name,
          studentClass: data.studentClass || "",
          studentId: data.studentId ?? null,
          answers: new Map(),
        };

        room.students.set(socket.id, student);
        room.participants.set(participantId, student);
        socket.join(`vroom:${code}`);

        io.to(room.teacherSocketId).emit("video:student-joined", {
          participantId,
          name,
          studentCount: room.students.size,
          students: Array.from(room.students.values()).map((s) => ({
            participantId: s.participantId,
            name: s.name,
            studentClass: s.studentClass,
          })),
        });

        let activeQuestion: {
          id: number;
          text: string;
          questionType: string;
          optionA: string | null;
          optionB: string | null;
          optionC: string | null;
          optionD: string | null;
          points: number;
        } | null = null;

        if (room.activeQuestionId !== null) {
          const q = room.questions.find((qq) => qq.id === room.activeQuestionId);
          if (q) {
            activeQuestion = {
              id: q.id,
              text: q.text,
              questionType: q.questionType,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              points: q.points,
            };
          }
        }

        callback({
          success: true,
          participantId,
          lesson: {
            title: room.lessonTitle,
            videoUrl: room.videoUrl,
            videoType: room.videoType,
            skipSegments: room.skipSegments,
          },
          videoState: room.activeQuestionId !== null ? "paused" : room.videoState,
          currentTime: room.currentTime,
          activeQuestion,
        });

        logger.info({ roomCode: code, name }, "Student joined video room");
      },
    );

    socket.on("video:sync-state", (data: { roomCode: string; state: "playing" | "paused"; currentTime: number }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.teacherSocketId !== socket.id) return;

      room.videoState = data.state;
      room.currentTime = data.currentTime;

      // While a question is active, always tell students to stay paused
      // so that async React state lag on the teacher side doesn't accidentally resume students
      const broadcastState: "playing" | "paused" =
        room.activeQuestionId !== null ? "paused" : data.state;

      socket.to(`vroom:${data.roomCode}`).emit("video:sync-state", {
        state: broadcastState,
        currentTime: data.currentTime,
      });
    });

    socket.on(
      "video:show-question",
      (
        data: { roomCode: string; questionId: number },
        callback?: (res: { success?: boolean; error?: string }) => void,
      ) => {
        const room = rooms.get(data.roomCode);
        if (!room || room.teacherSocketId !== socket.id) {
          callback?.({ error: "غير مصرح" });
          return;
        }

        const question = room.questions.find((q) => q.id === data.questionId);
        if (!question) {
          callback?.({ error: "سؤال غير موجود" });
          return;
        }

        room.activeQuestionId = data.questionId;
        room.videoState = "paused";

        socket.to(`vroom:${data.roomCode}`).emit("video:question", {
          id: question.id,
          text: question.text,
          questionType: question.questionType,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          points: question.points,
        });

        io.to(room.teacherSocketId).emit("video:question-active", {
          questionId: data.questionId,
          stats: getAnswerStats(room, data.questionId),
        });

        callback?.({ success: true });
      },
    );

    socket.on(
      "video:student-answer",
      (
        data: { roomCode: string; questionId: number; answer: string },
        callback?: (res: {
          isCorrect?: boolean;
          correctAnswer?: string | null;
          points?: number;
          error?: string;
        }) => void,
      ) => {
        const room = rooms.get(data.roomCode);
        if (!room) {
          callback?.({ error: "الغرفة غير موجودة" });
          return;
        }

        const student = room.students.get(socket.id);
        if (!student) {
          callback?.({ error: "لست في الغرفة" });
          return;
        }

        if (room.activeQuestionId !== data.questionId) {
          callback?.({ error: "السؤال غير نشط حالياً" });
          return;
        }

        if (student.answers.has(data.questionId)) {
          callback?.({ error: "تم الإجابة مسبقاً" });
          return;
        }

        const question = room.questions.find((q) => q.id === data.questionId);
        if (!question) {
          callback?.({ error: "سؤال غير موجود" });
          return;
        }

        const studentAns = (data.answer || "").trim().toLowerCase();
        const correctAns = (question.correctAnswer || "").trim().toLowerCase();
        const isCorrect = studentAns === correctAns;

        student.answers.set(data.questionId, {
          selectedAnswer: data.answer,
          isCorrect,
        });

        callback?.({
          isCorrect,
          correctAnswer: question.correctAnswer,
          points: isCorrect ? question.points : 0,
        });

        const stats = getAnswerStats(room, data.questionId);
        io.to(room.teacherSocketId).emit("video:answer-update", {
          questionId: data.questionId,
          participantId: student.participantId,
          studentName: student.name,
          selectedAnswer: data.answer,
          isCorrect,
          stats,
        });
      },
    );

    socket.on("video:resume", (data: { roomCode: string; currentTime?: number }) => {
      const room = rooms.get(data.roomCode);
      if (!room || room.teacherSocketId !== socket.id) return;

      if (room.activeQuestionId !== null) {
        room.answeredQuestions.add(room.activeQuestionId);
      }
      room.activeQuestionId = null;
      room.videoState = "playing";
      if (typeof data.currentTime === "number") {
        room.currentTime = data.currentTime;
      }

      io.to(`vroom:${data.roomCode}`).emit("video:resume", {
        currentTime: room.currentTime,
      });
    });

    socket.on(
      "video:end-session",
      async (
        data: { roomCode: string },
        callback?: (res: { success?: boolean; error?: string }) => void,
      ) => {
        const room = rooms.get(data.roomCode);
        if (!room || room.teacherSocketId !== socket.id) {
          callback?.({ error: "غير مصرح" });
          return;
        }

        if (room.ending) {
          callback?.({ success: true });
          return;
        }
        room.ending = true;

        try {
          for (const student of room.participants.values()) {
            let correctCount = 0;
            let earnedPoints = 0;
            const totalPoints = room.questions.reduce((s, q) => s + q.points, 0);

            for (const q of room.questions) {
              const ans = student.answers.get(q.id);
              if (ans?.isCorrect) {
                correctCount++;
                earnedPoints += q.points;
              }
            }

            const score =
              room.questions.length > 0
                ? (correctCount / room.questions.length) * 100
                : 0;

            const [submission] = await db
              .insert(videoSubmissionsTable)
              .values({
                videoLessonId: room.lessonId,
                studentName: student.name,
                studentClass: student.studentClass,
                studentId: student.studentId,
                score,
                earnedPoints,
                totalPoints,
                totalQuestions: room.questions.length,
                correctAnswers: correctCount,
              })
              .returning();

            const answerRows: {
              videoSubmissionId: number;
              videoQuestionId: number;
              selectedAnswer: string;
              isCorrect: boolean;
            }[] = [];

            for (const q of room.questions) {
              const ans = student.answers.get(q.id);
              answerRows.push({
                videoSubmissionId: submission.id,
                videoQuestionId: q.id,
                selectedAnswer: ans?.selectedAnswer || "",
                isCorrect: ans?.isCorrect || false,
              });
            }

            if (answerRows.length > 0) {
              await db.insert(videoAnswersTable).values(answerRows);
            }
          }

          const summaryStudents = Array.from(room.participants.values()).map((s) => {
            let correct = 0;
            let earned = 0;
            const totalPts = room.questions.reduce((sum, q) => sum + q.points, 0);
            for (const q of room.questions) {
              const a = s.answers.get(q.id);
              if (a?.isCorrect) {
                correct++;
                earned += q.points;
              }
            }
            return {
              name: s.name,
              studentClass: s.studentClass,
              correctAnswers: correct,
              totalQuestions: room.questions.length,
              earnedPoints: earned,
              totalPoints: totalPts,
              score: room.questions.length > 0 ? Math.round((correct / room.questions.length) * 100) : 0,
            };
          });

          io.to(room.teacherSocketId).emit("video:session-ended", {
            message: "انتهت الجلسة",
            summary: {
              studentCount: summaryStudents.length,
              students: summaryStudents,
              totalQuestions: room.questions.length,
            },
          });

          socket.to(`vroom:${data.roomCode}`).emit("video:session-ended", {
            message: "انتهت الجلسة",
          });

          rooms.delete(data.roomCode);
          teacherRooms.delete(socket.id);

          logger.info({ roomCode: data.roomCode }, "Video session ended and saved");
          callback?.({ success: true });
        } catch (err) {
          logger.error({ err }, "Error ending video session");
          callback?.({ error: "خطأ في حفظ النتائج" });
        }
      },
    );

    socket.on("disconnect", () => {
      const teacherCode = teacherRooms.get(socket.id);
      if (teacherCode) {
        const room = rooms.get(teacherCode);
        if (room) {
          const gracePeriodTimer = setTimeout(() => {
            teacherDisconnectTimers.delete(socket.id);
            const stillExists = rooms.get(teacherCode);
            if (!stillExists || stillExists.teacherSocketId !== socket.id) return;
            io.to(`vroom:${teacherCode}`).emit("video:teacher-disconnected");
            // Give teacher 10 minutes to reconnect before ending session
            setTimeout(() => {
              const finalCheck = rooms.get(teacherCode);
              if (finalCheck && finalCheck.teacherSocketId === socket.id) {
                io.to(`vroom:${teacherCode}`).emit("video:session-ended", {
                  message: "انقطع اتصال المعلم",
                });
                rooms.delete(teacherCode);
              }
            }, 600000);
          }, 30000); // 30-second grace before students see "teacher disconnected"
          teacherDisconnectTimers.set(socket.id, gracePeriodTimer);
        }
        teacherRooms.delete(socket.id);
      }

      for (const [, room] of rooms) {
        const student = room.students.get(socket.id);
        if (student) {
          room.students.delete(socket.id);
          io.to(room.teacherSocketId).emit("video:student-left", {
            participantId: student.participantId,
            name: student.name,
            studentCount: room.students.size,
            students: Array.from(room.students.values()).map((s) => ({
              participantId: s.participantId,
              name: s.name,
              studentClass: s.studentClass,
            })),
          });
        }
      }
    });
  });
}
