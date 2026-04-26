import { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";

interface StrokeData {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser" | "text";
  text?: string;
  fontSize?: number;
  isTeacher?: boolean;
}

interface WhiteboardRoom {
  assignmentId: number;
  questionId: number;
  teacherSocketId: string | null;
  students: Map<string, {
    socketId: string;
    name: string;
    studentClass: string;
    strokes: StrokeData[];
    locked: boolean;
  }>;
}

const whiteboardRooms = new Map<string, WhiteboardRoom>();

function getRoomKey(assignmentId: number, questionId: number) {
  return `wb:${assignmentId}:${questionId}`;
}

export function setupWhiteboardSocket(io: Server) {
  io.on("connection", (socket: Socket) => {

    socket.on("whiteboard:teacher-join", (data: {
      assignmentId: number;
      questionId: number;
    }) => {
      const session = (socket.request as any).session;
      if (!session?.teacherId) {
        socket.emit("whiteboard:error", { message: "Unauthorized" });
        return;
      }

      const key = getRoomKey(data.assignmentId, data.questionId);
      let room = whiteboardRooms.get(key);
      if (!room) {
        room = {
          assignmentId: data.assignmentId,
          questionId: data.questionId,
          teacherSocketId: socket.id,
          students: new Map(),
        };
        whiteboardRooms.set(key, room);
      } else {
        room.teacherSocketId = socket.id;
      }

      socket.join(key);
      logger.info({ key, teacherId: session.teacherId }, "Teacher joined whiteboard room");

      const studentList = Array.from(room.students.entries()).map(([id, s]) => ({
        id,
        name: s.name,
        studentClass: s.studentClass,
        strokes: s.strokes,
        locked: s.locked,
      }));
      socket.emit("whiteboard:room-state", { students: studentList });
    });

    socket.on("whiteboard:student-join", (data: {
      assignmentId: number;
      questionId: number;
      studentName: string;
      studentClass: string;
    }) => {
      const key = getRoomKey(data.assignmentId, data.questionId);
      let room = whiteboardRooms.get(key);
      if (!room) {
        room = {
          assignmentId: data.assignmentId,
          questionId: data.questionId,
          teacherSocketId: null,
          students: new Map(),
        };
        whiteboardRooms.set(key, room);
      }

      room.students.set(socket.id, {
        socketId: socket.id,
        name: data.studentName,
        studentClass: data.studentClass,
        strokes: [],
        locked: false,
      });

      socket.join(key);
      logger.info({ key, student: data.studentName }, "Student joined whiteboard room");

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("whiteboard:student-joined", {
          id: socket.id,
          name: data.studentName,
          studentClass: data.studentClass,
          strokes: [],
          locked: false,
        });
      }

      const student = room.students.get(socket.id);
      if (student?.locked) {
        socket.emit("whiteboard:lock-state", { locked: true });
      }
    });

    socket.on("whiteboard:stroke", (data: {
      assignmentId: number;
      questionId: number;
      stroke: StrokeData;
    }) => {
      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room) return;

      const student = room.students.get(socket.id);
      if (!student || student.locked) return;

      student.strokes.push(data.stroke);

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("whiteboard:student-stroke", {
          studentId: socket.id,
          stroke: data.stroke,
        });
      }
    });

    socket.on("whiteboard:teacher-stroke", (data: {
      assignmentId: number;
      questionId: number;
      studentId: string;
      stroke: StrokeData;
    }) => {
      const session = (socket.request as any).session;
      if (!session?.teacherId) return;

      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room || room.teacherSocketId !== socket.id) return;

      const student = room.students.get(data.studentId);
      if (!student) return;

      const teacherStroke = { ...data.stroke, isTeacher: true };
      student.strokes.push(teacherStroke);

      io.to(data.studentId).emit("whiteboard:teacher-drew", {
        stroke: teacherStroke,
        assignmentId: data.assignmentId,
        questionId: data.questionId,
      });

      io.to(room.teacherSocketId).emit("whiteboard:student-stroke", {
        studentId: data.studentId,
        stroke: teacherStroke,
      });
    });

    socket.on("whiteboard:teacher-undo-student", (data: {
      assignmentId: number;
      questionId: number;
      studentId: string;
    }) => {
      const session = (socket.request as any).session;
      if (!session?.teacherId) return;

      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room || room.teacherSocketId !== socket.id) return;

      const student = room.students.get(data.studentId);
      if (!student || student.strokes.length === 0) return;

      student.strokes.pop();

      io.to(data.studentId).emit("whiteboard:teacher-undo", {
        assignmentId: data.assignmentId,
        questionId: data.questionId,
        strokes: student.strokes,
      });

      io.to(room.teacherSocketId).emit("whiteboard:student-strokes-updated", {
        studentId: data.studentId,
        strokes: student.strokes,
      });
    });

    socket.on("whiteboard:student-clear", (data: {
      assignmentId: number;
      questionId: number;
    }) => {
      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room) return;

      const student = room.students.get(socket.id);
      if (!student || student.locked) return;

      student.strokes = [];

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("whiteboard:student-cleared", {
          studentId: socket.id,
        });
      }
    });

    socket.on("whiteboard:teacher-clear-student", (data: {
      assignmentId: number;
      questionId: number;
      studentId: string;
    }) => {
      const session = (socket.request as any).session;
      if (!session?.teacherId) return;

      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room || room.teacherSocketId !== socket.id) return;

      const student = room.students.get(data.studentId);
      if (!student) return;

      student.strokes = [];
      io.to(data.studentId).emit("whiteboard:cleared-by-teacher", {
        assignmentId: data.assignmentId,
        questionId: data.questionId,
      });

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("whiteboard:student-cleared", {
          studentId: data.studentId,
        });
      }
    });

    socket.on("whiteboard:teacher-lock", (data: {
      assignmentId: number;
      questionId: number;
      studentId: string;
      locked: boolean;
    }) => {
      const session = (socket.request as any).session;
      if (!session?.teacherId) return;

      const key = getRoomKey(data.assignmentId, data.questionId);
      const room = whiteboardRooms.get(key);
      if (!room || room.teacherSocketId !== socket.id) return;

      const student = room.students.get(data.studentId);
      if (!student) return;

      student.locked = data.locked;
      io.to(data.studentId).emit("whiteboard:lock-state", {
        locked: data.locked,
        assignmentId: data.assignmentId,
        questionId: data.questionId,
      });

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("whiteboard:student-lock-changed", {
          studentId: data.studentId,
          locked: data.locked,
        });
      }
    });

    socket.on("disconnect", () => {
      for (const [key, room] of whiteboardRooms.entries()) {
        if (room.teacherSocketId === socket.id) {
          room.teacherSocketId = null;
        }
        if (room.students.has(socket.id)) {
          const student = room.students.get(socket.id)!;
          room.students.delete(socket.id);
          if (room.teacherSocketId) {
            io.to(room.teacherSocketId).emit("whiteboard:student-left", {
              studentId: socket.id,
              name: student.name,
            });
          }
        }
        if (!room.teacherSocketId && room.students.size === 0) {
          whiteboardRooms.delete(key);
        }
      }
    });
  });
}
