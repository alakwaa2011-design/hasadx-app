import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { WhiteboardCanvas, type Stroke } from "@/components/whiteboard-canvas";
import { getSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, ArrowLeft, Lock, Unlock, Trash2, X, Maximize2, Users, Radio, Pen } from "lucide-react";

interface StudentBoard {
  id: string;
  name: string;
  studentClass: string;
  strokes: Stroke[];
  locked: boolean;
}

export default function WhiteboardMonitor() {
  const params = useParams<{ assignmentId: string; questionId: string }>();
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const assignmentId = parseInt(params.assignmentId || "0");
  const questionId = parseInt(params.questionId || "0");

  const [students, setStudents] = useState<Map<string, StudentBoard>>(new Map());
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [drawingOnStudent, setDrawingOnStudent] = useState<string | null>(null);
  const [boardStyle, setBoardStyle] = useState<"blank" | "lined">("blank");

  const searchParams = new URLSearchParams(window.location.search);
  const styleParam = searchParams.get("style");
  useEffect(() => {
    if (styleParam === "lined") setBoardStyle("lined");
  }, [styleParam]);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("whiteboard:teacher-join", { assignmentId, questionId });

    socket.on("whiteboard:room-state", (data: { students: StudentBoard[] }) => {
      const map = new Map<string, StudentBoard>();
      data.students.forEach(s => map.set(s.id, s));
      setStudents(map);
    });

    socket.on("whiteboard:student-joined", (data: StudentBoard) => {
      setStudents(prev => {
        const next = new Map(prev);
        next.set(data.id, data);
        return next;
      });
    });

    socket.on("whiteboard:student-left", (data: { studentId: string }) => {
      setStudents(prev => {
        const next = new Map(prev);
        next.delete(data.studentId);
        return next;
      });
    });

    socket.on("whiteboard:student-stroke", (data: { studentId: string; stroke: Stroke }) => {
      setStudents(prev => {
        const next = new Map(prev);
        const student = next.get(data.studentId);
        if (student) {
          next.set(data.studentId, {
            ...student,
            strokes: [...student.strokes, data.stroke],
          });
        }
        return next;
      });
    });

    socket.on("whiteboard:student-cleared", (data: { studentId: string }) => {
      setStudents(prev => {
        const next = new Map(prev);
        const student = next.get(data.studentId);
        if (student) {
          next.set(data.studentId, { ...student, strokes: [] });
        }
        return next;
      });
    });

    socket.on("whiteboard:student-lock-changed", (data: { studentId: string; locked: boolean }) => {
      setStudents(prev => {
        const next = new Map(prev);
        const student = next.get(data.studentId);
        if (student) {
          next.set(data.studentId, { ...student, locked: data.locked });
        }
        return next;
      });
    });

    socket.on("whiteboard:student-strokes-updated", (data: { studentId: string; strokes: Stroke[] }) => {
      setStudents(prev => {
        const next = new Map(prev);
        const student = next.get(data.studentId);
        if (student) {
          next.set(data.studentId, { ...student, strokes: data.strokes });
        }
        return next;
      });
    });

    return () => {
      socket.off("whiteboard:room-state");
      socket.off("whiteboard:student-joined");
      socket.off("whiteboard:student-left");
      socket.off("whiteboard:student-stroke");
      socket.off("whiteboard:student-cleared");
      socket.off("whiteboard:student-lock-changed");
      socket.off("whiteboard:student-strokes-updated");
    };
  }, [assignmentId, questionId]);

  const handleClearStudent = useCallback((studentId: string) => {
    const socket = getSocket();
    socket.emit("whiteboard:teacher-clear-student", { assignmentId, questionId, studentId });
  }, [assignmentId, questionId]);

  const handleToggleLock = useCallback((studentId: string, locked: boolean) => {
    const socket = getSocket();
    socket.emit("whiteboard:teacher-lock", { assignmentId, questionId, studentId, locked: !locked });
  }, [assignmentId, questionId]);

  const handleTeacherStroke = useCallback((studentId: string, stroke: Stroke) => {
    const socket = getSocket();
    socket.emit("whiteboard:teacher-stroke", {
      assignmentId,
      questionId,
      studentId,
      stroke: { ...stroke, isTeacher: true },
    });
  }, [assignmentId, questionId]);

  const handleTeacherUndo = useCallback((studentId: string) => {
    const socket = getSocket();
    socket.emit("whiteboard:teacher-undo-student", { assignmentId, questionId, studentId });
  }, [assignmentId, questionId]);

  const handleTeacherClear = useCallback((studentId: string) => {
    handleClearStudent(studentId);
  }, [handleClearStudent]);

  const studentList = Array.from(students.values());
  const expanded = expandedStudent ? students.get(expandedStudent) : null;
  const isDrawing = drawingOnStudent !== null;
  const drawingStudent = drawingOnStudent ? students.get(drawingOnStudent) : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <button
          onClick={() => setLocation(`/teacher/assignment/${assignmentId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-4 transition-colors"
        >
          <BackArrowIcon className="w-4 h-4" />
          {t.assignmentDetail.backToDashboard}
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <Radio className="w-6 h-6 text-red-500 animate-pulse" />
              {t.whiteboard.studentBoards}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Users className="w-4 h-4" />
              {studentList.length} {lang === "ar" ? "طالب متصل" : "students connected"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {t.whiteboard.liveView}
            </span>
          </div>
        </div>

        {studentList.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">{t.whiteboard.noStudents}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {lang === "ar" ? "سيظهر الطلاب عند بدء الإجابة" : "Students will appear when they start answering"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentList.map(student => (
              <Card key={student.id} className={`p-3 space-y-2 ${student.locked ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm">{student.name}</span>
                    {student.studentClass && (
                      <span className="text-[11px] text-muted-foreground mr-2 ml-2">({student.studentClass})</span>
                    )}
                    {student.locked && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                        {t.whiteboard.locked}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setDrawingOnStudent(student.id)}
                      className="p-1.5 rounded text-muted-foreground hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title={t.whiteboard.drawOnStudent}
                    >
                      <Pen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedStudent(student.id)}
                      className="p-1.5 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      title={t.whiteboard.zoomIn}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleLock(student.id, student.locked)}
                      className={`p-1.5 rounded transition-colors ${student.locked ? "text-red-500 hover:bg-red-50" : "text-muted-foreground hover:bg-amber-50 hover:text-amber-600"}`}
                      title={student.locked ? t.whiteboard.unlockStudent : t.whiteboard.lockStudent}
                    >
                      {student.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleClearStudent(student.id)}
                      className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title={t.whiteboard.clearStudent}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <WhiteboardCanvas
                  boardStyle={boardStyle}
                  width={800}
                  height={500}
                  readOnly
                  strokes={student.strokes}
                  showToolbar={false}
                  thumbnailMode
                />
              </Card>
            ))}
          </div>
        )}

        {expanded && !isDrawing && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setExpandedStudent(null)}>
            <div className="bg-card rounded-2xl p-4 max-w-4xl w-full shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold">{expanded.name}</h3>
                  {expanded.studentClass && (
                    <span className="text-sm text-muted-foreground">{expanded.studentClass}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setExpandedStudent(null); setDrawingOnStudent(expanded.id); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Pen className="w-3.5 h-3.5" />
                    {t.whiteboard.drawOnStudent}
                  </button>
                  <button
                    onClick={() => handleToggleLock(expanded.id, expanded.locked)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${expanded.locked ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-amber-100 text-amber-600 hover:bg-amber-200"}`}
                  >
                    {expanded.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {expanded.locked ? t.whiteboard.unlockStudent : t.whiteboard.lockStudent}
                  </button>
                  <button
                    onClick={() => handleClearStudent(expanded.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.whiteboard.clearStudent}
                  </button>
                  <button
                    onClick={() => setExpandedStudent(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <WhiteboardCanvas
                boardStyle={boardStyle}
                width={800}
                height={500}
                readOnly
                strokes={expanded.strokes}
                showToolbar={false}
              />
            </div>
          </div>
        )}

        {drawingStudent && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDrawingOnStudent(null)}>
            <div className="bg-card rounded-2xl p-4 max-w-4xl w-full shadow-2xl border-2 border-blue-400" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                    <Pen className="w-3.5 h-3.5" />
                    {t.whiteboard.teacherDrawing}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{drawingStudent.name}</h3>
                    {drawingStudent.studentClass && (
                      <span className="text-sm text-muted-foreground">{drawingStudent.studentClass}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleClearStudent(drawingStudent.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t.whiteboard.clearStudent}
                  </button>
                  <button
                    onClick={() => setDrawingOnStudent(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {t.whiteboard.stopDrawing}
                  </button>
                </div>
              </div>
              <WhiteboardCanvas
                boardStyle={boardStyle}
                width={800}
                height={500}
                readOnly={false}
                strokes={drawingStudent.strokes}
                onStroke={(stroke) => handleTeacherStroke(drawingStudent.id, stroke)}
                onUndo={() => handleTeacherUndo(drawingStudent.id)}
                onClear={() => handleTeacherClear(drawingStudent.id)}
                showToolbar={true}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
