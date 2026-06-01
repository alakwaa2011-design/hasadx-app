import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { useGetAssignment, useListSubmissions, useDeleteAssignment, useUpdateSubmission, useGetSubmissionDetails, useUpdateAnswerGrade } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
import { ArrowRight, ArrowLeft, Trash2, Users, FileText, CheckCircle, Star, Image, Lock, Globe, GraduationCap, Copy, Eye, EyeOff, Pencil, Save, X, MessageSquare, Gamepad2, Plus, Minus, Download, Calendar, BarChart3, TrendingUp, Award, User, UsersRound, CopyPlus, Database, Brain, Printer, UserX, AlertCircle, Loader2, Zap, Check, Trophy, Clock, Medal } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { fileToBase64 } from "@/lib/utils";
import { getSuggestions } from "@/lib/suggestions";

const BASE = import.meta.env.VITE_API_URL || "";

interface EditQuestion {
  id?: number;
  text: string;
  questionType: "mcq" | "true_false" | "fill_blank" | "whiteboard";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points: number;
  imageUrl?: string | null;
}

export default function TeacherAssignmentDetail() {
  const [, params] = useRoute("/teacher/assignment/:id");
  const id = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, lang } = useI18n();
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [showGameSetup, setShowGameSetup] = useState(false);
  const [gameMode, setGameMode] = useState<"solo" | "teams">("solo");
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>(["", "", "", "", "", ""]);
  const [gameTargetClass, setGameTargetClass] = useState<string>(() => getRememberedTargetClass());

  const { data: assignment, isLoading: isAssignmentLoading } = useGetAssignment(id);
  const { data: submissions, isLoading: isSubmissionsLoading } = useListSubmissions(id);

  const [activeDetailTab, setActiveDetailTab] = useState<"questions" | "results">("questions");
  const [resultsSearch, setResultsSearch] = useState("");
  const [resultsScoreFilter, setResultsScoreFilter] = useState<"all" | "below50" | "50to69" | "70to84" | "85to100">("all");
  const [assignmentShared, setAssignmentShared] = useState(false);
  const [adaptiveReport, setAdaptiveReport] = useState<Record<string, unknown> | null>(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [questionStats, setQuestionStats] = useState<{ totalSubmissions: number; questions: Array<{ id: number; text: string; questionType: string; totalAnswers: number; correctCount: number; correctRate: number }> } | null>(null);
  const [questionStatsLoading, setQuestionStatsLoading] = useState(false);
  /* Class roster — used to compute the "pending students" list (those
     in the target classes who haven't submitted, or submitted with no
     answers). Lives next to questionStats since both feed the
     Results tab. */
  const [classRoster, setClassRoster] = useState<Array<{ id: number; name: string; gradeLevel: string | null }> | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Solo challenge link state
  const [soloChallenge, setSoloChallenge] = useState<{ slug: string; playCount: number; assignmentTitle: string; notes?: string | null; expiresAt?: string | null } | null | undefined>(undefined);
  const [soloCreating, setSoloCreating] = useState(false);
  const [soloCopied, setSoloCopied] = useState(false);
  const [soloNotes, setSoloNotes] = useState("");
  const [soloNotesSaving, setSoloNotesSaving] = useState(false);
  const [soloNotesOpen, setSoloNotesOpen] = useState(false);
  // Leaderboard
  const [soloLeaderboardOpen, setSoloLeaderboardOpen] = useState(false);
  const [soloParticipants, setSoloParticipants] = useState<Array<{ playerName: string; score: number; correctCount: number; timeTaken: number | null; playedAt: string }>>([]);
  const [soloParticipantsLoading, setSoloParticipantsLoading] = useState(false);
  // Deadline
  const [soloDeadlineOpen, setSoloDeadlineOpen] = useState(false);
  const [soloDeadline, setSoloDeadline] = useState("");
  const [soloDeadlineSaving, setSoloDeadlineSaving] = useState(false);

  // Fetch existing solo challenge link on mount
  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/solo-challenges/by-assignment/${id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setSoloChallenge(data);
        if (data?.notes) setSoloNotes(data.notes);
        if (data?.expiresAt) {
          // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
          setSoloDeadline(new Date(data.expiresAt).toISOString().slice(0, 16));
        }
      })
      .catch(() => setSoloChallenge(null));
  }, [id]);

  const loadParticipants = async () => {
    if (!soloChallenge?.slug) return;
    setSoloParticipantsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/solo-challenges/${soloChallenge.slug}/participants`, { credentials: "include" });
      const data = await res.json();
      setSoloParticipants(Array.isArray(data) ? data : []);
    } catch {
      toast.error(lang === "ar" ? "تعذّر تحميل المشاركين" : "Failed to load");
    } finally {
      setSoloParticipantsLoading(false);
    }
  };

  const saveDeadline = async () => {
    if (!soloChallenge?.slug) return;
    setSoloDeadlineSaving(true);
    try {
      const expiresAt = soloDeadline ? new Date(soloDeadline).toISOString() : null;
      const res = await fetch(`${BASE}/api/solo-challenges/${soloChallenge.slug}/deadline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ expiresAt }),
      });
      if (!res.ok) throw new Error();
      setSoloChallenge(prev => prev ? { ...prev, expiresAt } : prev);
      setSoloDeadlineOpen(false);
      toast.success(expiresAt
        ? (lang === "ar" ? "تم تحديد وقت الإنهاء" : "Deadline set!")
        : (lang === "ar" ? "تم إزالة وقت الإنهاء" : "Deadline cleared!"));
    } catch {
      toast.error(lang === "ar" ? "تعذّر الحفظ" : "Failed to save");
    } finally {
      setSoloDeadlineSaving(false);
    }
  };

  const saveSoloNotes = async () => {
    if (!soloChallenge?.slug) return;
    setSoloNotesSaving(true);
    try {
      const res = await fetch(`${BASE}/api/solo-challenges/${soloChallenge.slug}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: soloNotes.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setSoloChallenge(prev => prev ? { ...prev, notes: soloNotes.trim() || null } : prev);
      setSoloNotesOpen(false);
      toast.success(lang === "ar" ? "تم حفظ الملاحظات" : "Notes saved!");
    } catch {
      toast.error(lang === "ar" ? "تعذّر الحفظ" : "Failed to save");
    } finally {
      setSoloNotesSaving(false);
    }
  };

  const handleCreateSoloChallenge = async () => {
    setSoloCreating(true);
    try {
      const res = await fetch(`${BASE}/api/solo-challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignmentId: id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "خطأ"); return; }
      setSoloChallenge(data);
      const url = `${window.location.origin}/solo/${data.slug}`;
      navigator.clipboard.writeText(url);
      toast.success(lang === "ar" ? "تم إنشاء الرابط ونسخه!" : "Link created and copied!");
    } catch {
      toast.error(lang === "ar" ? "تعذّر الإنشاء" : "Failed to create");
    } finally {
      setSoloCreating(false);
    }
  };

  const copySoloLink = () => {
    if (!soloChallenge) return;
    const url = `${window.location.origin}/solo/${soloChallenge.slug}`;
    navigator.clipboard.writeText(url);
    setSoloCopied(true);
    setTimeout(() => setSoloCopied(false), 2000);
    toast.success(lang === "ar" ? "تم نسخ رابط اللعب الفردي" : "Solo play link copied!");
  };

  useEffect(() => {
    if ((assignment as any)?.isShared !== undefined) setAssignmentShared((assignment as any).isShared);
  }, [assignment]);

  useEffect(() => {
    if (!id || activeDetailTab !== "results") return;
    setQuestionStatsLoading(true);
    fetch(`${BASE}/api/assignments/${id}/question-stats`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setQuestionStats(data); })
      .catch(() => {})
      .finally(() => setQuestionStatsLoading(false));
  }, [id, activeDetailTab, submissions]);

  /* Pull the class roster as soon as the page mounts so the PDF export
     can include the pending-students section even when the teacher
     exports without first opening the Results tab. */
  useEffect(() => {
    if (!id) return;
    setRosterLoading(true);
    fetch(`${BASE}/api/assignments/${id}/class-students`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ id: number; name: string; gradeLevel: string | null }>) => {
        setClassRoster(Array.isArray(data) ? data : []);
      })
      .catch(() => setClassRoster([]))
      .finally(() => setRosterLoading(false));
  }, [id]);

  useEffect(() => {
    if (!(assignment as any)?.isAdaptive || !id) return;
    setAdaptiveLoading(true);
    fetch(`${BASE}/api/adaptive/report/${id}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAdaptiveReport(data); })
      .catch(() => {})
      .finally(() => setAdaptiveLoading(false));
  }, [assignment, id]);

  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTargetClass, setEditTargetClass] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [editQuestions, setEditQuestions] = useState<EditQuestion[]>([]);
  const deleteMutation = useDeleteAssignment({
    mutation: {
      onSuccess: () => setLocation("/teacher")
    }
  });
  const updateSubmission = useUpdateSubmission({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}/submissions`] });
        setEditingSubId(null);
      }
    }
  });

  const [detailSubId, setDetailSubId] = useState<number | null>(null);
  const detailQuery = useGetSubmissionDetails(detailSubId ?? 0, { query: { enabled: detailSubId !== null } } as any);
  const updateAnswerGrade = useUpdateAnswerGrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/submissions/${detailSubId}/details`] });
        queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}/submissions`] });
      }
    }
  });

  /* Pending = students from the target-class roster who don't appear
     in the submissions list at all. Students who submitted but scored
     0 are still "submitters" — they show up in the regular results
     table with a 0% pill, which is a more accurate signal than trying
     to infer "answered nothing" from earned-points alone (a student
     who answered everything wrong would also show 0/0, so we don't
     conflate the two). The list-submissions endpoint does not return
     studentId, so we match on a normalized student name — fine in
     practice since a teacher's class roster has unique names. */
  const pendingStudents = useMemo<Array<{ id: number; name: string; gradeLevel: string | null }>>(() => {
    if (!classRoster || classRoster.length === 0) return [];
    const subs = submissions || [];
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const submittedNames = new Set<string>();
    for (const s of subs) {
      if (s.studentName) submittedNames.add(norm(s.studentName));
    }
    const pending = classRoster.filter((stu) => !submittedNames.has(norm(stu.name)));
    pending.sort((a, b) => a.name.localeCompare(b.name, lang === "ar" ? "ar" : "en"));
    return pending;
  }, [classRoster, submissions, lang]);

  const sortedFilteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    const query = resultsSearch.trim().toLowerCase();
    const filtered = submissions.filter((sub) => {
      if (query) {
        const hay = `${sub.studentName || ""} ${sub.studentClass || ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (resultsScoreFilter !== "all") {
        const s = sub.score;
        if (resultsScoreFilter === "below50" && !(s < 50)) return false;
        if (resultsScoreFilter === "50to69" && !(s >= 50 && s < 70)) return false;
        if (resultsScoreFilter === "70to84" && !(s >= 70 && s < 85)) return false;
        if (resultsScoreFilter === "85to100" && !(s >= 85)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => a.studentName.localeCompare(b.studentName, "ar"));
  }, [submissions, resultsSearch, resultsScoreFilter]);

  const detailIndex = detailSubId !== null ? sortedFilteredSubmissions.findIndex(s => s.id === detailSubId) : -1;
  const goToOffsetSub = (delta: number) => {
    if (detailIndex < 0) return;
    const next = sortedFilteredSubmissions[detailIndex + delta];
    if (next) setDetailSubId(next.id);
  };

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const res = await fetch(`${BASE}/api/assignments/${id}/questions/${questionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || (lang === "ar" ? "خطأ في حذف السؤال" : "Error deleting question"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}`] });
      toast.success(lang === "ar" ? "تم حذف السؤال" : "Question deleted");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/assignments/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t.assignmentDetail.duplicateError);
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast.success(t.assignmentDetail.duplicateSuccess);
      setLocation(`/teacher/assignment/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || t.assignmentDetail.duplicateError);
    },
  });

  const saveToBankMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/question-bank/import-from-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignmentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t.assignmentDetail.savedToBank);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const toggleShareMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/assignments/${id}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isShared: !assignmentShared }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setAssignmentShared(data.isShared);
      toast.success(data.isShared
        ? (lang === "ar" ? "تم مشاركة الواجب" : "Assignment shared")
        : (lang === "ar" ? "تم إلغاء المشاركة" : "Assignment unshared"));
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${BASE}/api/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t.assignmentDetail.updateError);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      setIsEditingAssignment(false);
      toast.success(lang === "ar" ? "تم تحديث الواجب بنجاح" : "Assignment updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || t.assignmentDetail.updateError);
    },
  });

  const startEditingAssignment = () => {
    if (!assignment) return;
    // إذا كان نشاط استماع، وجّه لصفحة التعديل الخاصة به
    if ((assignment as any).activityType === "listening") {
      setLocation(`/teacher/new/dictation?edit=${assignment.id}`);
      return;
    }
    setEditTitle(assignment.title);
    setEditSubject(assignment.subject ?? "");
    setEditDescription(assignment.description || "");
    setEditTargetClass(assignment.targetClass || "");
    fetch(`${BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setGradeLevels)
      .catch(() => {});
    setEditQuestions(
      assignment.questions.map((q) => ({
        id: q.id,
        text: q.text,
        questionType: (q.questionType || "mcq") as EditQuestion["questionType"],
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: q.correctAnswer || "",
        points: q.points,
        imageUrl: (q as any).imageUrl || null,
      }))
    );
    setIsEditingAssignment(true);
  };

  const addNewQuestion = () => {
    setEditQuestions([
      ...editQuestions,
      { text: "", questionType: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", points: 1 },
    ]);
  };

  const handleEditQuestionTypeChange = (index: number, newType: "mcq" | "true_false" | "fill_blank" | "whiteboard" | "whiteboard_blank") => {
    setEditQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[index] };
      q.questionType = newType === "whiteboard_blank" ? "whiteboard" : newType;
      q.optionA = "";
      q.optionB = "";
      q.optionC = "";
      q.optionD = "";
      if (newType === "true_false") {
        q.correctAnswer = "true";
      } else if (newType === "fill_blank") {
        q.correctAnswer = "";
      } else if (newType === "whiteboard") {
        q.optionA = "lined";
        q.correctAnswer = "";
      } else if (newType === "whiteboard_blank") {
        q.optionA = "blank";
        q.correctAnswer = "";
      } else {
        q.correctAnswer = "";
      }
      updated[index] = q;
      return updated;
    });
  };

  const removeQuestion = (index: number) => {
    setEditQuestions(editQuestions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof EditQuestion, value: string | number) => {
    const updated = [...editQuestions];
    (updated[index] as any)[field] = value;
    setEditQuestions(updated);
  };

  const saveAssignment = () => {
    if (!editTitle.trim()) {
      toast.error(t.assignmentDetail.titleRequired);
      return;
    }
    if (editQuestions.length === 0) {
      toast.error(t.assignmentDetail.questionRequired);
      return;
    }
    for (const q of editQuestions) {
      if (!q.text.trim()) {
        toast.error(t.assignmentDetail.questionTextRequired);
        return;
      }
    }

    updateAssignmentMutation.mutate({
      title: editTitle,
      subject: editSubject.trim() || undefined,
      description: editDescription || undefined,
      targetClass: editTargetClass || null,
      questions: editQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType || "mcq",
        optionA: q.optionA || null,
        optionB: q.optionB || null,
        optionC: q.optionC || null,
        optionD: q.optionD || null,
        correctAnswer: q.correctAnswer || null,
        points: q.points || 1,
        imageUrl: q.imageUrl || null,
      })),
    });
  };

  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const exportToPDF = () => {
    if (!assignment) return;
    const subs = submissions || [];
    const scores = subs.map(s => {
      const pts = s.teacherAdjustedPoints !== null && s.teacherAdjustedPoints !== undefined ? s.teacherAdjustedPoints : s.earnedPoints;
      return s.totalPoints > 0 ? (pts / s.totalPoints) * 100 : 0;
    });
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length ? Math.max(...scores) : 0;
    const lowest = scores.length ? Math.min(...scores) : 0;
    const passed = scores.filter(s => s >= 50).length;
    const passRate = subs.length ? Math.round((passed / subs.length) * 100) : 0;
    const isAr = lang === "ar";
    const dir = isAr ? "rtl" : "ltr";
    const fontFamily = isAr ? "'Cairo', 'Tajawal', 'Segoe UI', system-ui, sans-serif" : "'Inter', 'Segoe UI', system-ui, sans-serif";
    const today = new Date().toLocaleDateString(locale);

    const escapeHtml = (s: string) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

    const sortedSubs = [...subs].sort((a, b) => {
      const sa = a.totalPoints > 0 ? ((a.teacherAdjustedPoints ?? a.earnedPoints) / a.totalPoints) * 100 : 0;
      const sb = b.totalPoints > 0 ? ((b.teacherAdjustedPoints ?? b.earnedPoints) / b.totalPoints) * 100 : 0;
      return sb - sa;
    });

    /* Pending students section — only meaningful when a class roster
       exists. We render an explicit "no pending" line if everyone in
       the roster has submitted, so the report covers all students. */
    const hasRoster = (classRoster?.length ?? 0) > 0;
    const pendingRowsHtml = pendingStudents.map((p, i) => {
      const statusLabel = t.assignmentDetail.pendingStatusNotSubmitted;
      return `
        <tr>
          <td class="rank">${i + 1}</td>
          <td class="name">${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.gradeLevel || "—")}</td>
          <td><span class="status-pill status-missing">${escapeHtml(statusLabel)}</span></td>
        </tr>`;
    }).join("");
    const pendingHtml = !hasRoster ? "" : `
      <h2 class="section">${escapeHtml(t.assignmentDetail.pdfPendingSection)} (${pendingStudents.length})</h2>
      ${pendingStudents.length === 0 ? `<div class="empty">${escapeHtml(t.assignmentDetail.pdfPendingNone)}</div>` : `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${escapeHtml(t.assignmentDetail.pdfStudentName)}</th>
            <th>${escapeHtml(t.assignmentDetail.pdfClass)}</th>
            <th>${escapeHtml(t.assignmentDetail.pdfPendingStatus)}</th>
          </tr>
        </thead>
        <tbody>${pendingRowsHtml}</tbody>
      </table>`}`;

    const rowsHtml = sortedSubs.map((s, i) => {
      const pts = s.teacherAdjustedPoints !== null && s.teacherAdjustedPoints !== undefined ? s.teacherAdjustedPoints : s.earnedPoints;
      const pct = s.totalPoints > 0 ? Math.round((pts / s.totalPoints) * 100) : 0;
      const cls = pct >= 80 ? "score-good" : pct >= 50 ? "score-mid" : "score-low";
      return `
        <tr>
          <td class="rank">${i + 1}</td>
          <td class="name">${escapeHtml(s.studentName)}</td>
          <td>${escapeHtml(s.studentClass || "—")}</td>
          <td>${pts}/${s.totalPoints}</td>
          <td><span class="score-pill ${cls}">${pct}%</span></td>
          <td>${new Date(s.submittedAt).toLocaleDateString(locale)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(assignment.title)} — ${escapeHtml(t.assignmentDetail.pdfReportTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: ${fontFamily}; color: #1f2937; background: #f8fafc; }
  .page { max-width: 880px; margin: 0 auto; padding: 32px; }
  .toolbar { display: flex; gap: 12px; justify-content: ${isAr ? "flex-start" : "flex-end"}; margin-bottom: 16px; }
  .btn { background: #4f46e5; color: #fff; border: none; padding: 10px 18px; font-size: 14px; font-weight: 700; border-radius: 10px; cursor: pointer; font-family: inherit; }
  .btn.secondary { background: #e5e7eb; color: #374151; }
  .btn:hover { opacity: 0.9; }
  .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; padding: 28px 32px; border-radius: 16px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 8px; font-size: 26px; font-weight: 900; }
  .header .meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; opacity: 0.95; }
  .header .meta span { background: rgba(255,255,255,0.18); padding: 4px 12px; border-radius: 999px; font-weight: 700; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; }
  .stat .label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat .value { font-size: 28px; font-weight: 900; margin-top: 6px; color: #111827; }
  .stat.avg .value { color: #4f46e5; }
  .stat.high .value { color: #16a34a; }
  .stat.low .value { color: #ef4444; }
  .stat.pass .value { color: #0891b2; }
  .pass-bar { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; }
  .pass-bar .row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #374151; }
  .pass-bar .track { height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
  .pass-bar .fill { height: 100%; background: linear-gradient(90deg, #22c55e, #14b8a6); border-radius: 999px; }
  h2.section { font-size: 16px; font-weight: 800; color: #111827; margin: 24px 0 12px; display: flex; align-items: center; gap: 8px; }
  h2.section::before { content: ""; display: inline-block; width: 4px; height: 18px; background: #4f46e5; border-radius: 2px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  thead { background: #f9fafb; }
  th { text-align: ${isAr ? "right" : "left"}; padding: 12px 14px; font-size: 12px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; }
  td { padding: 12px 14px; font-size: 13px; color: #374151; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  td.rank { font-weight: 900; color: #4f46e5; width: 40px; }
  td.name { font-weight: 700; color: #111827; }
  .score-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 12px; }
  .score-good { background: #dcfce7; color: #15803d; }
  .score-mid { background: #fef3c7; color: #b45309; }
  .score-low { background: #fee2e2; color: #b91c1c; }
  .status-pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 12px; }
  .status-missing { background: #fee2e2; color: #b91c1c; }
  .status-empty { background: #fef3c7; color: #b45309; }
  .empty { background: #fff; border: 1px dashed #d1d5db; padding: 40px; text-align: center; border-radius: 14px; color: #6b7280; font-weight: 600; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { padding: 0; max-width: 100%; }
    .header { box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stat, .pass-bar, table, .score-pill, .status-pill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 16mm; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="toolbar">
    <button class="btn" onclick="window.print()">${escapeHtml(t.assignmentDetail.pdfPrint)}</button>
    <button class="btn secondary" onclick="window.close()">${escapeHtml(t.assignmentDetail.pdfClose)}</button>
  </div>
  <div class="header">
    <div style="font-size: 12px; opacity: 0.85; font-weight: 700; margin-bottom: 4px;">${escapeHtml(t.assignmentDetail.pdfReportTitle)}</div>
    <h1>${escapeHtml(assignment.title)}</h1>
    <div class="meta">
      ${assignment.subject ? `<span>${escapeHtml(assignment.subject)}</span>` : ""}
      ${assignment.targetClass ? `<span>${escapeHtml(assignment.targetClass)}</span>` : ""}
      <span>${escapeHtml(t.assignmentDetail.pdfGeneratedOn)} ${today}</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat avg"><div class="label">${escapeHtml(t.assignmentDetail.average)}</div><div class="value">${Math.round(avg)}%</div></div>
    <div class="stat high"><div class="label">${escapeHtml(t.assignmentDetail.highest)}</div><div class="value">${Math.round(highest)}%</div></div>
    <div class="stat low"><div class="label">${escapeHtml(t.assignmentDetail.lowest)}</div><div class="value">${Math.round(lowest)}%</div></div>
    <div class="stat pass"><div class="label">${escapeHtml(t.assignmentDetail.passed)}</div><div class="value">${passed}/${subs.length}</div></div>
  </div>

  <div class="pass-bar">
    <div class="row"><span>${escapeHtml(t.assignmentDetail.passRate)}</span><span>${passRate}%</span></div>
    <div class="track"><div class="fill" style="width: ${passRate}%;"></div></div>
  </div>

  <h2 class="section">${escapeHtml(t.assignmentDetail.studentSubmissions)} (${subs.length})</h2>
  ${subs.length === 0 ? `<div class="empty">${escapeHtml(t.assignmentDetail.pdfNoSubmissions)}</div>` : `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${escapeHtml(t.assignmentDetail.pdfStudentName)}</th>
        <th>${escapeHtml(t.assignmentDetail.pdfClass)}</th>
        <th>${escapeHtml(t.assignmentDetail.pdfPoints)}</th>
        <th>${escapeHtml(t.assignmentDetail.pdfScore)}</th>
        <th>${escapeHtml(t.assignmentDetail.pdfDate)}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>`}

  ${pendingHtml}

  <div class="footer">${escapeHtml(assignment.title)} • ${today}</div>
</div>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() {
      try { window.focus(); } catch(e) {}
    }, 100);
  });
</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast.error(isAr ? "يرجى السماح بالنوافذ المنبثقة" : "Please allow popups");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  if (isAssignmentLoading) return <Layout><div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div></Layout>;
  if (!assignment) return <Layout><div className="text-center p-20">{t.assignmentDetail.notFound}</div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button 
          onClick={() => setLocation("/teacher")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-6 transition-colors"
        >
          <BackArrowIcon className="w-5 h-5" />
          {t.assignmentDetail.backToDashboard}
        </button>

        {isEditingAssignment ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-black text-foreground">{t.assignmentDetail.editAssignment}</h1>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setIsEditingAssignment(false)}
                  variant="outline"
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  {t.assignmentDetail.cancelEdit}
                </Button>
                <Button
                  onClick={saveAssignment}
                  disabled={updateAssignmentMutation.isPending}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  {updateAssignmentMutation.isPending ? t.assignmentDetail.savingChanges : t.assignmentDetail.saveChanges}
                </Button>
              </div>
            </div>

            {updateAssignmentMutation.isError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-red-700 dark:text-red-300 font-bold text-sm">
                {(updateAssignmentMutation.error as Error).message}
              </div>
            )}

            <Card className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5">{t.assignmentDetail.assignmentTitleLabel}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1.5">{t.assignmentDetail.subjectLabel}</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5">{t.assignmentDetail.descriptionLabel}</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {lang === "ar" ? "الصف" : "Class"}
                  </label>
                  {gradeLevels.length > 0 ? (
                    <select
                      value={editTargetClass}
                      onChange={e => setEditTargetClass(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="">{lang === "ar" ? "— بدون صف —" : "— No class —"}</option>
                      {gradeLevels.map(g => (
                        <option key={g.gradeLevel} value={g.gradeLevel}>
                          {g.gradeLevel} ({g.count} {lang === "ar" ? "طالب" : "students"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={editTargetClass}
                        onChange={e => setEditTargetClass(e.target.value)}
                        placeholder={lang === "ar" ? "مثال: الصف الخامس" : "e.g. Grade 5"}
                        className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        list="edit-class-suggestions"
                      />
                      <datalist id="edit-class-suggestions">
                        {getSuggestions("classes").map((c, i) => <option key={i} value={c} />)}
                      </datalist>
                    </>
                  )}
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                {t.assignmentDetail.questionsCount} ({editQuestions.length})
              </h2>
              <Button onClick={addNewQuestion} className="gap-2">
                <Plus className="w-4 h-4" />
                {t.assignmentDetail.addQuestion}
              </Button>
            </div>

            <div className="space-y-4">
              {editQuestions.map((q, idx) => (
                <Card key={idx} className={`p-5 ${lang === "ar" ? "border-r-4 border-r-primary" : "border-l-4 border-l-primary"}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm">{idx + 1}</span>
                      <h3 className="font-bold text-lg">{t.assignmentDetail.questionLabel} {idx + 1}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-muted-foreground">{t.assignmentDetail.gradeLabel}</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={q.points}
                          onChange={(e) => updateQuestion(idx, "points", parseFloat(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 rounded-lg bg-background border-2 border-border text-center font-bold text-sm focus:outline-none focus:border-primary transition-all"
                        />
                      </div>
                      {editQuestions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(idx)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t.assignmentDetail.deleteQuestion}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">{t.assignmentDetail.questionText}</label>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                        placeholder={t.assignmentDetail.questionPlaceholder}
                        className="w-full px-3 py-2.5 rounded-lg bg-background border-2 border-border font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        list={`edit-question-suggestions-${idx}`}
                      />
                      <datalist id={`edit-question-suggestions-${idx}`}>
                        {getSuggestions("questions").map((s, i) => <option key={i} value={s} />)}
                      </datalist>
                      <div className="mt-2 flex items-center gap-2">
                        {q.imageUrl ? (
                          <div className="relative inline-block">
                            <img src={q.imageUrl} alt="" className="max-h-20 rounded-lg border border-border object-contain" />
                            <button
                              type="button"
                              onClick={() => updateQuestion(idx, "imageUrl", "")}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer">
                            <Image className="w-3.5 h-3.5" />
                            {lang === "ar" ? "إضافة صورة" : "Add image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const base64 = await fileToBase64(file);
                                  updateQuestion(idx, "imageUrl", base64);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-bold text-muted-foreground mb-1">{t.createAssignment.questionTypeLabel}</label>
                      <select
                        value={q.questionType === "whiteboard" ? (q.optionA === "lined" ? "whiteboard" : "whiteboard_blank") : (q.questionType || "mcq")}
                        onChange={(e) => handleEditQuestionTypeChange(idx, e.target.value as any)}
                        className="w-full sm:w-48 px-3 py-2 rounded-lg bg-background border-2 border-border text-sm font-bold focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="mcq">{t.createAssignment.questionTypeMcq}</option>
                        <option value="true_false">{t.createAssignment.questionTypeTrueFalse}</option>
                        <option value="fill_blank">{t.createAssignment.questionTypeFillBlank}</option>
                        <option value="whiteboard_blank">{t.createAssignment.questionTypeWhiteboardBlank}</option>
                        <option value="whiteboard">{t.createAssignment.questionTypeWhiteboard}</option>
                      </select>
                    </div>

                    {(q.questionType || "mcq") === "mcq" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(["A", "B", "C", "D"] as const).map((opt) => (
                            <div key={opt} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuestion(idx, "correctAnswer", q.correctAnswer === opt ? "" : opt)}
                                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border-2 transition-all ${
                                  q.correctAnswer === opt
                                    ? "bg-green-500 border-green-500 text-white"
                                    : "border-border text-muted-foreground hover:border-green-400 hover:text-green-600"
                                }`}
                                title={q.correctAnswer === opt ? t.assignmentDetail.unmarkCorrect : t.assignmentDetail.markCorrect}
                              >
                                {opt}
                              </button>
                              <input
                                type="text"
                                value={q[`option${opt}` as keyof EditQuestion] as string}
                                onChange={(e) => updateQuestion(idx, `option${opt}` as keyof EditQuestion, e.target.value)}
                                placeholder={`${t.assignmentDetail.optionPlaceholder} ${opt}`}
                                className="flex-1 px-3 py-2 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          ))}
                        </div>
                        {q.correctAnswer && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t.assignmentDetail.correctAnswer} {q.correctAnswer}
                          </p>
                        )}
                      </>
                    )}

                    {q.questionType === "true_false" && (
                      <div className="flex gap-3">
                        {[
                          { val: "true", label: lang === "ar" ? "صح ✓" : "True ✓" },
                          { val: "false", label: lang === "ar" ? "خطأ ✗" : "False ✗" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => updateQuestion(idx, "correctAnswer", opt.val)}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                              q.correctAnswer === opt.val
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-border text-muted-foreground hover:border-green-400"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.questionType === "fill_blank" && (
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          {lang === "ar" ? "الإجابة الصحيحة" : "Correct Answer"}
                        </label>
                        <input
                          type="text"
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(idx, "correctAnswer", e.target.value)}
                          placeholder={lang === "ar" ? "اكتب الإجابة الصحيحة..." : "Type the correct answer..."}
                          className="w-full px-3 py-2.5 rounded-lg bg-background border-2 border-border font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    )}

                    {q.questionType === "whiteboard" && (
                      <div className="bg-muted/30 rounded-xl p-4 text-center">
                        <p className="text-sm text-muted-foreground font-bold">
                          {q.optionA === "lined" ? `📝 ${t.createAssignment.whiteboardLined}` : `🎨 ${t.createAssignment.whiteboardBlank}`}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-center">
              <Button onClick={addNewQuestion} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                {t.assignmentDetail.addNewQuestion}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-2xl overflow-hidden mb-6 shadow-lg"
            >
              <div className="relative bg-gradient-to-br from-primary via-primary to-emerald-700 text-white p-5 sm:p-7 overflow-hidden">
                <div className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -start-12 w-48 h-48 rounded-full bg-amber-300/15 blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                      {assignment.subject}
                    </span>
                    {assignment.targetClass && (
                      <span className="px-3 py-1 bg-white/15 backdrop-blur-sm text-white text-xs font-bold rounded-full flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        {assignment.targetClass}
                      </span>
                    )}
                    <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 backdrop-blur-sm ${assignment.accessMode === "private" ? "bg-amber-400/30 text-amber-50" : "bg-emerald-400/30 text-emerald-50"}`}>
                      {assignment.accessMode === "private" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                      {assignment.accessMode === "private" ? t.assignmentDetail.privateAccess : t.assignmentDetail.publicAccess}
                    </span>
                    {assignment.deadline && (
                      <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1 backdrop-blur-sm ${new Date(assignment.deadline) < new Date() ? "bg-red-400/30 text-red-50" : "bg-white/15 text-white"}`}>
                        <Calendar className="w-3 h-3" />
                        {new Date(assignment.deadline) < new Date() ? t.assignmentDetail.deadlineExpired : new Date(assignment.deadline).toLocaleDateString(locale)}
                      </span>
                    )}
                    <span className="text-white/70 text-xs ms-1">
                      {new Date(assignment.createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 leading-tight">{assignment.title}</h1>
                  {assignment.description && (
                    <p className="text-sm text-white/85 mt-1 max-w-2xl">{assignment.description}</p>
                  )}
                  {assignment.accessMode === "private" && assignment.accessCode && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-3 py-2">
                      <Lock className="w-3.5 h-3.5 text-amber-200 flex-shrink-0" />
                      <span className="text-xs font-bold text-white">{t.assignmentDetail.accessCodeLabel}</span>
                      <span className="font-mono text-base tracking-widest text-amber-100" dir="ltr">{assignment.accessCode}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(assignment.accessCode || "")}
                        className="p-1 rounded-lg hover:bg-white/15 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-100" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-4 flex-wrap mt-4">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm text-white flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span>{assignment.questions.length}</span>
                      <span className="text-white/75 font-normal text-xs">{t.assignmentDetail.questions}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <div className="w-7 h-7 rounded-lg bg-amber-300/30 backdrop-blur-sm text-amber-100 flex items-center justify-center">
                        <Star className="w-3.5 h-3.5" />
                      </div>
                      <span>{assignment.totalPoints}</span>
                      <span className="text-white/75 font-normal text-xs">{t.assignmentDetail.gradeUnit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <div className="w-7 h-7 rounded-lg bg-orange-300/30 backdrop-blur-sm text-orange-100 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span>{submissions?.length || 0}</span>
                      <span className="text-white/75 font-normal text-xs">{t.assignmentDetail.studentSubmissions}</span>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${assignment.showResults ? "bg-emerald-400/30 text-emerald-50" : "bg-orange-400/30 text-orange-50"}`}>
                      {assignment.showResults ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {assignment.showResults ? t.assignmentDetail.resultsVisible : t.assignmentDetail.resultsHidden}
                    </span>
                  </div>
                </div>
              </div>
              <div className="border-t border-border/50 bg-card px-5 sm:px-7 py-3 flex items-center gap-2 flex-wrap">
                {assignment.questions && assignment.questions.some((q) => q.optionA && q.optionB) && (
                  <Button
                    onClick={() => { setGameMode("solo"); setTeamCount(2); setShowGameSetup(true); }}
                    disabled={isCreatingGame}
                    className="gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 border-0 shadow-md shadow-purple-500/20"
                  >
                    <Gamepad2 className="w-4 h-4" />
                    {isCreatingGame ? t.assignmentDetail.creatingGame : t.assignmentDetail.liveGame}
                  </Button>
                )}
                <Button onClick={startEditingAssignment} variant="outline" className="gap-1.5 px-4 py-2 text-sm">
                  <Pencil className="w-3.5 h-3.5" />
                  {t.assignmentDetail.editBtn}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/solve/${id}`); toast.success(t.assignmentDetail.linkCopied); }}
                  className="gap-1.5 px-4 py-2 text-sm"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t.assignmentDetail.copyLink}
                </Button>

                {/* ── Solo Play Link ─────────────────────────────── */}
                {soloChallenge && soloChallenge.slug ? (
                  /* Already created — show slug + action buttons */
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-sm font-bold border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-mono truncate max-w-[90px]">/solo/{soloChallenge.slug}</span>
                      <span className="text-xs opacity-55 hidden md:inline ms-0.5">• {soloChallenge.playCount} {lang === "ar" ? "لاعب" : "plays"}</span>
                      {/* Copy */}
                      <button onClick={copySoloLink} className="ms-0.5 p-1 rounded hover:bg-amber-500/20 transition-colors" title={lang === "ar" ? "نسخ الرابط" : "Copy link"}>
                        {soloCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {/* Notes */}
                      <button onClick={() => { setSoloNotesOpen(v => !v); setSoloDeadlineOpen(false); setSoloNotes(soloChallenge.notes ?? ""); }} className="p-1 rounded hover:bg-amber-500/20 transition-colors" title={lang === "ar" ? "ملاحظات" : "Notes"}>
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      {/* Deadline */}
                      <button onClick={() => { setSoloDeadlineOpen(v => !v); setSoloNotesOpen(false); }} className={`p-1 rounded hover:bg-amber-500/20 transition-colors ${soloChallenge.expiresAt ? "text-red-500" : ""}`} title={lang === "ar" ? "وقت الإنهاء" : "Set deadline"}>
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      {/* Leaderboard */}
                      <button
                        onClick={() => { setSoloLeaderboardOpen(true); loadParticipants(); }}
                        className="p-1 rounded hover:bg-amber-500/20 transition-colors"
                        title={lang === "ar" ? "قائمة المتصدرين" : "Leaderboard"}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Deadline status badge */}
                    {soloChallenge.expiresAt && (
                      <div className="text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1" style={{ color: new Date(soloChallenge.expiresAt) < new Date() ? "#dc2626" : "#92400e", background: new Date(soloChallenge.expiresAt) < new Date() ? "#fee2e2" : "#fef3c7" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(soloChallenge.expiresAt) < new Date()
                          ? (lang === "ar" ? "المسابقة منتهية" : "Closed")
                          : (lang === "ar" ? `تنتهي: ${new Date(soloChallenge.expiresAt).toLocaleString("ar-SA")}` : `Closes: ${new Date(soloChallenge.expiresAt).toLocaleString()}`)}
                      </div>
                    )}

                    {/* Notes panel */}
                    {soloNotesOpen && (
                      <div className="mt-1 rounded-lg border border-amber-400/40 bg-amber-50/70 dark:bg-amber-900/20 p-2.5 flex flex-col gap-2">
                        <label className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {lang === "ar" ? "ملاحظات تظهر للطالب قبل البدء" : "Notes shown to student before starting"}
                        </label>
                        <textarea
                          value={soloNotes}
                          onChange={e => setSoloNotes(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          placeholder={lang === "ar" ? "مثال: اقرأ الأسئلة بعناية، الوقت ٣٠ ثانية لكل سؤال..." : "e.g. Read each question carefully..."}
                          className="w-full rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs resize-none focus:outline-none bg-white dark:bg-gray-800"
                          dir="rtl"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setSoloNotesOpen(false)} className="px-3 py-1 text-xs rounded-lg border font-bold hover:bg-gray-50">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                          <button onClick={saveSoloNotes} disabled={soloNotesSaving} className="px-3 py-1 text-xs rounded-lg font-bold text-white inline-flex items-center gap-1 disabled:opacity-50" style={{ background: "#C9930A" }}>
                            {soloNotesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {lang === "ar" ? "حفظ" : "Save"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Deadline panel */}
                    {soloDeadlineOpen && (
                      <div className="mt-1 rounded-lg border border-red-300/50 bg-red-50/70 dark:bg-red-900/10 p-2.5 flex flex-col gap-2">
                        <label className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {lang === "ar" ? "تاريخ ووقت إنهاء المسابقة" : "Challenge closes at"}
                        </label>
                        <input
                          type="datetime-local"
                          value={soloDeadline}
                          onChange={e => setSoloDeadline(e.target.value)}
                          className="w-full rounded-lg border border-red-300 px-2.5 py-1.5 text-xs focus:outline-none bg-white dark:bg-gray-800"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setSoloDeadlineOpen(false)} className="px-3 py-1 text-xs rounded-lg border font-bold hover:bg-gray-50">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                          {soloChallenge.expiresAt && (
                            <button onClick={() => { setSoloDeadline(""); saveDeadline(); }} className="px-3 py-1 text-xs rounded-lg border font-bold text-red-600 hover:bg-red-50">{lang === "ar" ? "إزالة" : "Clear"}</button>
                          )}
                          <button onClick={saveDeadline} disabled={soloDeadlineSaving} className="px-3 py-1 text-xs rounded-lg font-bold text-white inline-flex items-center gap-1 disabled:opacity-50" style={{ background: "#dc2626" }}>
                            {soloDeadlineSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {lang === "ar" ? "حفظ" : "Save"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Not created yet — show create button (even while loading) */
                  <Button
                    variant="outline"
                    onClick={handleCreateSoloChallenge}
                    disabled={soloCreating || soloChallenge === undefined}
                    className="gap-1.5 px-4 py-2 text-sm font-bold border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                  >
                    {soloCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {lang === "ar" ? "رابط لعب فردي" : "Solo Play Link"}
                  </Button>
                )}

                <Button onClick={() => window.open(`${BASE}/api/assignments/${id}/export-csv`, "_blank")} variant="outline" className="gap-1.5 px-4 py-2 text-sm">
                  <Download className="w-3.5 h-3.5" />
                  {t.assignmentDetail.exportCSV}
                </Button>
                <Button onClick={exportToPDF} variant="outline" className="gap-1.5 px-4 py-2 text-sm">
                  <Printer className="w-3.5 h-3.5" />
                  {t.assignmentDetail.exportPDF}
                </Button>
                <Button onClick={() => duplicateMutation.mutate()} disabled={duplicateMutation.isPending} variant="outline" className="gap-1.5 px-4 py-2 text-sm">
                  <CopyPlus className="w-3.5 h-3.5" />
                  {duplicateMutation.isPending ? t.assignmentDetail.duplicating : t.assignmentDetail.duplicateAssignment}
                </Button>
                <Button onClick={() => saveToBankMutation.mutate()} disabled={saveToBankMutation.isPending} variant="outline" className="gap-1.5 px-4 py-2 text-sm">
                  <Database className="w-3.5 h-3.5" />
                  {t.assignmentDetail.saveToBankBtn}
                </Button>
                <Button
                  onClick={() => toggleShareMutation.mutate()}
                  disabled={toggleShareMutation.isPending}
                  variant="outline"
                  className={`gap-1.5 px-4 py-2 text-sm ${assignmentShared ? "text-cyan-600 border-cyan-300 dark:border-cyan-700" : ""}`}
                >
                  {assignmentShared ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {assignmentShared ? (lang === "ar" ? "مشترك ✓" : "Shared ✓") : (lang === "ar" ? "مشاركة عامة" : "Share")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { if (confirm(t.assignmentDetail.confirmDelete)) deleteMutation.mutate({ id }); }}
                  disabled={deleteMutation.isPending}
                  className="gap-1.5 px-3 py-2 text-sm ms-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
            <div className="flex gap-2 mb-6">
              {[
                { id: "questions" as const, label: lang === "ar" ? "الأسئلة" : "Questions", icon: <FileText className="w-4 h-4" />, count: assignment.questions.length },
                { id: "results" as const, label: lang === "ar" ? "النتائج" : "Results", icon: <BarChart3 className="w-4 h-4" />, count: submissions?.length ?? 0 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                    activeDetailTab === tab.id
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${activeDetailTab === tab.id ? "bg-primary-foreground/20" : "bg-muted"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeDetailTab === "questions" ? (
                <motion.div key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      {t.assignmentDetail.questions}
                      <span className="text-sm font-normal text-muted-foreground">({assignment.questions.length})</span>
                    </h2>
                    <button
                      onClick={startEditingAssignment}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t.assignmentDetail.editQuestions}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {assignment.questions.map((q, idx) => {
                      const typeConfig: Record<string, { label: string; color: string }> = {
                        mcq: { label: lang === "ar" ? "اختيار متعدد" : "MCQ", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
                        true_false: { label: lang === "ar" ? "صح / خطأ" : "True/False", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
                        fill_blank: { label: lang === "ar" ? "إملأ الفراغ" : "Fill Blank", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
                        whiteboard: { label: lang === "ar" ? "لوحة" : "Board", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
                      };
                      const tc = typeConfig[q.questionType || "mcq"] || typeConfig.mcq;
                      return (
                        <motion.div
                          key={q.id}
                          initial={{ opacity: 0, x: lang === "ar" ? 10 : -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                        >
                          <Card className={`p-4 hover:shadow-md transition-shadow ${lang === "ar" ? "border-r-4 border-r-primary/60" : "border-l-4 border-l-primary/60"}`}>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <p className="font-bold text-sm sm:text-base text-foreground leading-snug">{q.text}</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-black bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                                      <Star className="w-3 h-3" />{q.points}
                                    </span>
                                    <button
                                      onClick={() => { if (confirm(lang === "ar" ? "هل تريد حذف هذا السؤال؟" : "Delete this question?")) deleteQuestionMutation.mutate(q.id); }}
                                      disabled={deleteQuestionMutation.isPending}
                                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${tc.color}`}>
                                  {tc.label}
                                </span>
                                {(q as any).imageUrl && (
                                  <div className="mb-2">
                                    <img src={(q as any).imageUrl} alt={q.text} className="max-h-36 rounded-xl border border-border object-contain" />
                                  </div>
                                )}
                                {q.questionType === "whiteboard" ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs font-bold rounded-lg">
                                      {q.optionA === "lined" ? (lang === "ar" ? "سبورة بخطوط" : "Lined Board") : (lang === "ar" ? "سبورة بيضاء" : "Blank Board")}
                                    </span>
                                    <button
                                      onClick={() => setLocation(`/teacher/whiteboard/${assignment.id}/${q.id}?style=${q.optionA || "blank"}`)}
                                      className="px-2.5 py-1 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-red-200 transition-colors"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                      {lang === "ar" ? "مراقبة مباشرة" : "Live Monitor"}
                                    </button>
                                  </div>
                                ) : q.questionType === "true_false" ? (
                                  <div className="flex gap-2 mt-1">
                                    {[{ value: "true", label: lang === "ar" ? "صح ✓" : "True ✓" }, { value: "false", label: lang === "ar" ? "خطأ ✗" : "False ✗" }].map(opt => (
                                      <span key={opt.value} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                        q.correctAnswer === opt.value
                                          ? opt.value === "true" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                                          : "bg-muted text-muted-foreground opacity-50"
                                      }`}>{opt.label}</span>
                                    ))}
                                  </div>
                                ) : q.questionType === "fill_blank" ? (
                                  <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>{q.correctAnswer}</span>
                                  </div>
                                ) : (
                                  <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {(["A", "B", "C", "D"] as const).map(opt => (
                                      q[`option${opt}` as keyof typeof q] ? (
                                        <li key={opt} className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                                          q.correctAnswer === opt
                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-bold border border-green-200 dark:border-green-800/50"
                                            : "bg-muted/50 text-muted-foreground"
                                        }`}>
                                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${q.correctAnswer === opt ? "bg-green-500 text-white" : "bg-muted"}`}>{opt}</span>
                                          <span>{q[`option${opt}` as keyof typeof q]}</span>
                                          {q.correctAnswer === opt && <CheckCircle className="w-3.5 h-3.5 ms-auto" />}
                                        </li>
                                      ) : null
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {submissions && submissions.length > 0 && (() => {
                    const scores = submissions.map(s => {
                      const pts = s.teacherAdjustedPoints !== null && s.teacherAdjustedPoints !== undefined ? s.teacherAdjustedPoints : s.earnedPoints;
                      return s.totalPoints > 0 ? (pts / s.totalPoints) * 100 : 0;
                    });
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    const highest = Math.max(...scores);
                    const lowest = Math.min(...scores);
                    const passed = scores.filter(s => s >= 50).length;

                    const buckets = [
                      { label: "0-49", min: 0, max: 49, color: "#ef4444" },
                      { label: "50-69", min: 50, max: 69, color: "#f97316" },
                      { label: "70-84", min: 70, max: 84, color: "#eab308" },
                      { label: "85-100", min: 85, max: 100, color: "#22c55e" },
                    ];
                    const chartData = buckets.map(b => ({
                      label: b.label,
                      count: scores.filter(s => s >= b.min && s <= b.max).length,
                      color: b.color,
                    }));

                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                          {[
                            { label: t.assignmentDetail.average, value: `${Math.round(avg)}%`, icon: <TrendingUp className="w-4 h-4" />, color: "from-primary/20 to-primary/5 text-primary" },
                            { label: t.assignmentDetail.highest, value: `${Math.round(highest)}%`, icon: <Award className="w-4 h-4" />, color: "from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400" },
                            { label: t.assignmentDetail.lowest, value: `${Math.round(lowest)}%`, icon: <TrendingUp className="w-4 h-4 rotate-180" />, color: "from-red-500/20 to-red-500/5 text-red-500" },
                            { label: t.assignmentDetail.passed, value: `${passed}/${submissions.length}`, icon: <CheckCircle className="w-4 h-4" />, color: "from-secondary/20 to-secondary/5 text-secondary" },
                          ].map((stat, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                              <Card className={`p-4 bg-gradient-to-br ${stat.color} border-0`}>
                                <div className="flex items-center gap-2 mb-1 opacity-70">{stat.icon}<span className="text-[11px] font-bold">{stat.label}</span></div>
                                <p className="text-2xl font-black">{stat.value}</p>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                        <div className="mb-5">
                          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                            <span className="text-muted-foreground">{lang === "ar" ? "نسبة النجاح" : "Pass rate"}</span>
                            <span className="text-foreground">{Math.round((passed / submissions.length) * 100)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(passed / submissions.length) * 100}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className="h-2.5 rounded-full bg-gradient-to-r from-green-500 to-teal-500"
                            />
                          </div>
                        </div>
                        <Card className="p-4 mb-5">
                          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            {lang === "ar" ? "توزيع الدرجات" : "Score Distribution"}
                          </h3>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={chartData} barCategoryGap="25%">
                              <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,.1)", fontSize: 12 }}
                                formatter={(val: number) => [val, lang === "ar" ? "طلاب" : "students"]}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={index} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>
                      </>
                    );
                  })()}
                  {(assignment as any)?.isAdaptive && (
                    <Card className="p-4 space-y-3 border-violet-200 dark:border-violet-800 mb-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-violet-700 dark:text-violet-300">
                          <Brain className="w-4 h-4" />
                          {lang === "ar" ? "تقرير التمايز التكيّفي" : "Adaptive Differentiation Report"}
                        </h3>
                        {adaptiveReport && (adaptiveReport.students as Array<Record<string, unknown>>)?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const students = adaptiveReport.students as Array<Record<string, unknown>>;
                              const skills = adaptiveReport.skills as string[];
                              let csv = `${lang === "ar" ? "الطالب" : "Student"},${lang === "ar" ? "الصف" : "Class"},${lang === "ar" ? "المستوى" : "Level"},${lang === "ar" ? "الصحيحة" : "Correct"},${lang === "ar" ? "الإجمالي" : "Total"}`;
                              if (skills?.length) csv += `,${skills.join(",")}`;
                              csv += "\n";
                              students.forEach((s: Record<string, unknown>) => {
                                const sa = s.skillAbilities as Record<string, { ability: number; correct: number; total: number }> || {};
                                let row = `${s.studentName},${s.studentClass || ""},${s.finalLevel},${s.correctCount},${s.answeredCount}`;
                                if (skills?.length) row += `,${skills.map(sk => sa[sk] ? Math.round((sa[sk].correct / Math.max(1, sa[sk].total)) * 100) + "%" : "—").join(",")}`;
                                csv += row + "\n";
                              });
                              navigator.clipboard.writeText(csv);
                              toast.success(lang === "ar" ? "تم نسخ التقرير" : "Report copied");
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 transition-colors flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            {lang === "ar" ? "نسخ CSV" : "Copy CSV"}
                          </button>
                        )}
                      </div>
                      {adaptiveLoading ? (
                        <div className="animate-pulse h-20 bg-violet-50 dark:bg-violet-950/20 rounded-xl" />
                      ) : adaptiveReport ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                              <p className="text-lg font-black text-orange-600">{(adaptiveReport.levelDistribution as Record<string, number>)?.beginner || 0}</p>
                              <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "🌱 مبتدئ" : "🌱 Beginner"}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                              <p className="text-lg font-black text-blue-600">{(adaptiveReport.levelDistribution as Record<string, number>)?.intermediate || 0}</p>
                              <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "⭐ متوسط" : "⭐ Intermediate"}</p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
                              <p className="text-lg font-black text-emerald-600">{(adaptiveReport.levelDistribution as Record<string, number>)?.advanced || 0}</p>
                              <p className="text-[10px] text-muted-foreground">{lang === "ar" ? "🏆 متقدم" : "🏆 Advanced"}</p>
                            </div>
                          </div>
                          {(adaptiveReport.skills as string[])?.length > 0 && (
                            <div className="space-y-2">
                              {(adaptiveReport.skills as string[]).map((skill: string) => {
                                const sa = (adaptiveReport.skillAverages as Record<string, { avgAbility: number; avgCorrectRate: number }>)?.[skill];
                                const pct = sa ? Math.round(sa.avgCorrectRate * 100) : 0;
                                const lvl = sa ? (sa.avgAbility < 1.5 ? "beginner" : sa.avgAbility <= 2.5 ? "intermediate" : "advanced") : "intermediate";
                                const color = lvl === "beginner" ? "from-orange-400 to-orange-600" : lvl === "intermediate" ? "from-blue-400 to-blue-600" : "from-emerald-400 to-emerald-600";
                                return (
                                  <div key={skill}>
                                    <div className="flex items-center justify-between text-xs mb-0.5">
                                      <span className="font-bold">{skill}</span>
                                      <span className="text-muted-foreground">{pct}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          {lang === "ar" ? "لا توجد بيانات" : "No data"}
                        </p>
                      )}
                    </Card>
                  )}
                  {submissions && submissions.length > 0 && (
                    <Card className="p-4 mb-5">
                      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        {lang === "ar" ? "تحليل الأسئلة" : "Question Analysis"}
                        <span className="text-[10px] font-medium text-muted-foreground ms-1">
                          {lang === "ar" ? "(من الأصعب إلى الأسهل)" : "(hardest to easiest)"}
                        </span>
                      </h3>
                      {questionStatsLoading && !questionStats ? (
                        <div className="animate-pulse h-20 bg-muted/50 rounded-xl" />
                      ) : questionStats && questionStats.questions.filter(q => q.totalAnswers > 0).length > 0 ? (
                        <div className="space-y-2.5">
                          {[...questionStats.questions]
                            .filter(q => q.totalAnswers > 0)
                            .sort((a, b) => a.correctRate - b.correctRate)
                            .map((q) => {
                              const pct = Math.round(q.correctRate * 100);
                              const origIdx = assignment.questions.findIndex(qq => qq.id === q.id);
                              const color = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
                              const textColor = pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
                              return (
                                <div key={q.id} className="flex items-start gap-3">
                                  <span className="w-6 h-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                                    {origIdx >= 0 ? origIdx + 1 : "?"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className="text-xs font-bold text-foreground line-clamp-2 leading-snug">{q.text}</p>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`text-xs font-black ${textColor}`}>{pct}%</span>
                                        <span className="text-[10px] text-muted-foreground">
                                          ({q.correctCount}/{q.totalAnswers})
                                        </span>
                                      </div>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className={`h-full rounded-full ${color}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          {lang === "ar" ? "لا توجد بيانات للأسئلة" : "No question data yet"}
                        </p>
                      )}
                    </Card>
                  )}
                  {/* Pending students — those in the target classes who
                      either haven't submitted at all or submitted with no
                      answers. Mirrored in the PDF export so the report
                      covers every assigned student, not just submitters. */}
                  {rosterLoading ? (
                    <Card className="p-4 mb-4 animate-pulse h-16 bg-muted/40" />
                  ) : classRoster && classRoster.length === 0 ? (
                    <Card className="p-4 mb-4 border-2 border-dashed border-border bg-muted/20">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {t.assignmentDetail.pendingStudentsNoRoster}
                        </p>
                      </div>
                    </Card>
                  ) : classRoster && classRoster.length > 0 ? (
                    <Card className={`p-4 mb-4 ${lang === "ar" ? "border-r-4" : "border-l-4"} ${pendingStudents.length > 0 ? "border-amber-400" : "border-emerald-400"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-bold flex items-center gap-2 text-foreground text-sm">
                          <UserX className={`w-4 h-4 ${pendingStudents.length > 0 ? "text-amber-600" : "text-emerald-600"}`} />
                          {t.assignmentDetail.pendingStudents}
                          <span className="text-xs text-muted-foreground font-bold">
                            ({pendingStudents.length}/{classRoster.length})
                          </span>
                        </h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-3">
                        {t.assignmentDetail.pendingStudentsHint}
                      </p>
                      {pendingStudents.length === 0 ? (
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          ✓ {t.assignmentDetail.pendingStudentsNone}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {pendingStudents.map((p) => (
                            <span
                              key={`pending-${p.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                              title={t.assignmentDetail.pendingStatusNotSubmitted}
                            >
                              {p.name}
                              {p.gradeLevel ? <span className="opacity-60">· {p.gradeLevel}</span> : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </Card>
                  ) : null}

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold flex items-center gap-2 text-foreground">
                      <Users className="w-4 h-4 text-primary" />
                      {t.assignmentDetail.studentSubmissions} ({submissions?.length || 0})
                    </h3>
                  </div>

                  {submissions && submissions.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <input
                        type="text"
                        value={resultsSearch}
                        onChange={(e) => setResultsSearch(e.target.value)}
                        placeholder={lang === "ar" ? "بحث باسم الطالب أو الصف..." : "Search by student name or class..."}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-background border-2 border-border text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <select
                        value={resultsScoreFilter}
                        onChange={(e) => setResultsScoreFilter(e.target.value as typeof resultsScoreFilter)}
                        className="px-3 py-2.5 rounded-xl bg-background border-2 border-border text-sm font-bold focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="all">{lang === "ar" ? "كل الدرجات" : "All scores"}</option>
                        <option value="below50">{lang === "ar" ? "أقل من 50%" : "Below 50%"}</option>
                        <option value="50to69">50–69%</option>
                        <option value="70to84">70–84%</option>
                        <option value="85to100">85–100%</option>
                      </select>
                    </div>
                  )}

                  {isSubmissionsLoading ? (
                    <div className="animate-pulse h-20 bg-muted/50 rounded-xl" />
                  ) : submissions && submissions.length > 0 ? (sortedFilteredSubmissions.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-sm text-muted-foreground font-medium">
                        {lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching results"}
                      </p>
                      <button
                        onClick={() => { setResultsSearch(""); setResultsScoreFilter("all"); }}
                        className="mt-2 text-xs font-bold text-primary hover:underline"
                      >
                        {lang === "ar" ? "مسح عوامل التصفية" : "Clear filters"}
                      </button>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {sortedFilteredSubmissions.map((sub) => {
                        const isEditing = editingSubId === sub.id;
                        const finalPoints = sub.teacherAdjustedPoints !== null && sub.teacherAdjustedPoints !== undefined ? sub.teacherAdjustedPoints : sub.earnedPoints;
                        const scorePct = Math.round(sub.score);
                        const scoreColor = sub.score >= 80 ? "text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200" : sub.score >= 50 ? "text-secondary bg-secondary/10 border-secondary/20" : "text-destructive bg-red-50 dark:bg-red-900/20 border-red-200";
                        return (
                          <Card key={sub.id} className={`p-4 hover:shadow-md transition-shadow ${lang === "ar" ? "border-r-4 border-r-primary/50" : "border-l-4 border-l-primary/50"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                                  {sub.studentName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-sm sm:text-base truncate">{sub.studentName}</h3>
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                    {sub.studentClass && (
                                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{sub.studentClass}</span>
                                    )}
                                    <span>{new Date(sub.submittedAt).toLocaleDateString(locale)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-center hidden sm:block">
                                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "النقاط" : "Points"}</p>
                                  <p className="font-black text-sm">{finalPoints}/{sub.totalPoints}</p>
                                </div>
                                <span className={`font-black text-sm px-3 py-1.5 rounded-xl border ${scoreColor}`}>
                                  {scorePct}%
                                </span>
                              </div>
                            </div>

                            {sub.teacherNote && !isEditing && (
                              <div className="mt-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2 flex items-start gap-1.5">
                                <MessageSquare className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-blue-700 dark:text-blue-300">{sub.teacherNote}</p>
                              </div>
                            )}

                            {sub.aiFeedback && !isEditing && (
                              <div className="mt-2 bg-primary/5 rounded-xl px-3 py-2 flex items-start gap-1.5">
                                <Star className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground line-clamp-2">{sub.aiFeedback}</p>
                              </div>
                            )}

                            {isEditing ? (
                              <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-bold whitespace-nowrap">{t.assignmentDetail.adjustedGrade}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={sub.totalPoints}
                                    step="0.5"
                                    value={editPoints}
                                    onChange={e => setEditPoints(e.target.value)}
                                    className="w-20 px-2 py-1.5 rounded-lg bg-background border-2 border-primary/30 text-center font-bold text-sm focus:outline-none focus:border-primary transition-all"
                                  />
                                  <span className="text-xs text-muted-foreground">/ {sub.totalPoints}</span>
                                </div>
                                <textarea
                                  value={editNote}
                                  onChange={e => setEditNote(e.target.value)}
                                  placeholder={t.assignmentDetail.teacherNotePlaceholder}
                                  className="w-full px-2 py-1.5 rounded-lg bg-background border-2 border-border text-xs focus:outline-none focus:border-primary transition-all min-h-[40px] resize-y"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => setEditingSubId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const pts = parseFloat(editPoints);
                                      updateSubmission.mutate({ submissionId: sub.id, data: { teacherAdjustedPoints: isNaN(pts) ? null : pts, teacherNote: editNote || null } });
                                    }}
                                    disabled={updateSubmission.isPending}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Save className="w-3 h-3" />
                                    {lang === "ar" ? "حفظ" : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 flex justify-end gap-2">
                                <button
                                  onClick={() => setDetailSubId(sub.id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-1 border border-border"
                                >
                                  <Eye className="w-3 h-3" />
                                  {lang === "ar" ? "عرض الإجابات" : "View answers"}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingSubId(sub.id);
                                    setEditPoints(sub.teacherAdjustedPoints !== null && sub.teacherAdjustedPoints !== undefined ? String(sub.teacherAdjustedPoints) : String(sub.earnedPoints));
                                    setEditNote(sub.teacherNote || "");
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 border border-primary/20"
                                >
                                  <Pencil className="w-3 h-3" />
                                  {t.assignmentDetail.editGrade}
                                </button>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )) : (
                    <Card className="p-8 text-center border-dashed">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-bold mb-1">{t.assignmentDetail.noSubmissions}</h3>
                      <p className="text-sm text-muted-foreground">{t.assignmentDetail.noSubmissionsDesc}</p>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {showGameSetup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowGameSetup(false)}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-6">
                <Gamepad2 className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                <h3 className="text-xl font-black text-foreground">{t.teacherGame.gameMode}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setGameMode("solo")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "solo" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}>
                  <User className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.soloMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">{t.teacherGame.soloModeDesc}</p>
                </button>
                <button onClick={() => setGameMode("teams")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "teams" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}>
                  <UsersRound className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.teamMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">{t.teacherGame.teamModeDesc}</p>
                </button>
              </div>

              {gameMode === "teams" && (
                <div className="mb-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">{t.teacherGame.teamCount}</label>
                    <div className="flex justify-center gap-2">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button key={n} onClick={() => setTeamCount(n)}
                          className={`w-10 h-10 rounded-xl font-black text-base transition-all ${teamCount === n ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">
                      {lang === "ar" ? "أسماء الفرق (اختياري)" : "Team Names (optional)"}
                    </label>
                    <div className="space-y-2">
                      {Array.from({ length: teamCount }).map((_, i) => {
                        const defaults = lang === "ar"
                          ? ["الأذكياء", "المتميزون", "الفائقون", "المبدعون", "الرائعون", "الرياديون"]
                          : ["Champions", "Stars", "Warriors", "Innovators", "Legends", "Pioneers"];
                        return (
                          <input
                            key={i}
                            type="text"
                            value={customTeamNames[i] || ""}
                            onChange={(e) => {
                              const next = [...customTeamNames];
                              next[i] = e.target.value;
                              setCustomTeamNames(next);
                            }}
                            placeholder={defaults[i]}
                            maxLength={20}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-bold focus:outline-none focus:border-purple-400 transition-colors"
                            dir={lang === "ar" ? "rtl" : "ltr"}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      {lang === "ar" ? "اتركها فارغة للاستخدام الافتراضي" : "Leave blank to use defaults"}
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <ClassSelector
                  value={gameTargetClass}
                  onChange={setGameTargetClass}
                  accent="#a855f7"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowGameSetup(false)}
                  className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors">
                  {t.teacherGame.cancelGame}
                </button>
                <button onClick={() => {
                  setShowGameSetup(false);
                  setIsCreatingGame(true);
                  const socket = getSocket();
                  const validCustomNames = gameMode === "teams"
                    ? customTeamNames.slice(0, teamCount).map(n => n.trim())
                    : [];
                  const hasCustomNames = validCustomNames.some(n => n.length > 0);
                  socket.emit("teacher:create-game", {
                    assignmentId: id,
                    gameMode,
                    teamCount: gameMode === "teams" ? teamCount : undefined,
                    customTeamNames: hasCustomNames ? validCustomNames : undefined,
                    targetClass: gameTargetClass || undefined,
                  }, (res: { pin?: string; error?: string }) => {
                    setIsCreatingGame(false);
                    if (res.error) {
                      toast.error(res.error);
                      disconnectSocket();
                      return;
                    }
                    setLocation(`/teacher/game/${res.pin}`);
                  });
                }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  {t.teacherGame.startGame}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailSubId !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setDetailSubId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const det: any = detailQuery.data;
                const sub = det?.submission;
                const answers: any[] = det?.answers || [];
                const correctCnt = answers.filter(a => a.isCorrect).length;
                const wrongCnt = answers.length - correctCnt;
                const formatDur = (sec: number | null | undefined) => {
                  if (!sec || sec <= 0) return lang === "ar" ? "غير متوفر" : "N/A";
                  const m = Math.floor(sec / 60);
                  const s = sec % 60;
                  return m > 0 ? `${m}${lang === "ar" ? " د " : "m "}${s}${lang === "ar" ? " ث" : "s"}` : `${s}${lang === "ar" ? " ث" : "s"}`;
                };
                return (
                  <>
                    <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
                      <button
                        onClick={() => goToOffsetSub(lang === "ar" ? 1 : -1)}
                        disabled={detailIndex < 0 || (lang === "ar" ? detailIndex >= sortedFilteredSubmissions.length - 1 : detailIndex <= 0)}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={lang === "ar" ? "السابق" : "Previous"}
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                      <div className="text-center min-w-0 flex-1">
                        <h3 className="font-black text-base truncate">{sub?.studentName || ""}</h3>
                        <p className="text-xs text-muted-foreground">
                          {sub?.studentClass ? `${sub.studentClass} · ` : ""}
                          {detailIndex >= 0 ? `${detailIndex + 1} / ${sortedFilteredSubmissions.length}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => goToOffsetSub(lang === "ar" ? -1 : 1)}
                        disabled={detailIndex < 0 || (lang === "ar" ? detailIndex <= 0 : detailIndex >= sortedFilteredSubmissions.length - 1)}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={lang === "ar" ? "التالي" : "Next"}
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <button onClick={() => setDetailSubId(null)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="overflow-y-auto p-4 space-y-4">
                      {detailQuery.isLoading || !sub ? (
                        <div className="animate-pulse space-y-3">
                          <div className="h-16 bg-muted/50 rounded-xl" />
                          <div className="h-32 bg-muted/50 rounded-xl" />
                          <div className="h-32 bg-muted/50 rounded-xl" />
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
                              <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "الدرجة" : "Score"}</p>
                              <p className="font-black text-base text-primary">{Math.round(sub.score)}%</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                              <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "صحيحة" : "Correct"}</p>
                              <p className="font-black text-base text-green-600">{correctCnt}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                              <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "خاطئة" : "Wrong"}</p>
                              <p className="font-black text-base text-red-600">{wrongCnt}</p>
                            </div>
                            <div className="bg-muted/40 border border-border rounded-xl p-3 text-center">
                              <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "الوقت" : "Time"}</p>
                              <p className="font-black text-base">{formatDur(sub.durationSeconds)}</p>
                            </div>
                          </div>

                          {answers.map((a, i) => {
                            const isOpenResp = a.questionType === "fill_blank" || a.questionType === "whiteboard" || a.questionType === "dictation" || a.questionType === "open" || a.questionType === "listening_open";
                            const optionsList = [a.optionA, a.optionB, a.optionC, a.optionD].filter(Boolean);
                            const earnedPts = a.teacherPoints !== null && a.teacherPoints !== undefined ? a.teacherPoints : (a.isCorrect ? a.points : 0);
                            return (
                              <div key={a.id} className={`rounded-xl border-2 p-3 ${a.isCorrect ? "border-green-200 bg-green-50/50 dark:bg-green-900/10" : "border-red-200 bg-red-50/50 dark:bg-red-900/10"}`}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <span className="shrink-0 w-6 h-6 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center justify-center">{i + 1}</span>
                                    <p className="text-sm font-bold leading-snug">{a.questionText}</p>
                                  </div>
                                  <span className={`shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md ${a.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                                    {earnedPts}/{a.points}
                                  </span>
                                </div>

                                {optionsList.length > 0 && !isOpenResp && (
                                  <div className="grid gap-1.5 mb-2">
                                    {optionsList.map((opt: string, idx: number) => {
                                      const letter = ["A", "B", "C", "D"][idx];
                                      const selected = a.selectedAnswer === letter || a.selectedAnswer === opt;
                                      const isRight = a.correctAnswer === letter || a.correctAnswer === opt;
                                      return (
                                        <div key={idx} className={`text-xs rounded-lg px-2.5 py-1.5 flex items-center gap-2 ${isRight ? "bg-green-100 dark:bg-green-900/30 border border-green-300" : selected ? "bg-red-100 dark:bg-red-900/30 border border-red-300" : "bg-muted/30 border border-border"}`}>
                                          <span className="font-black w-4">{letter}.</span>
                                          <span className="flex-1">{opt}</span>
                                          {selected && <span className="text-[10px] font-bold">{lang === "ar" ? "اختيار الطالب" : "student"}</span>}
                                          {isRight && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {isOpenResp && (
                                  <div className="space-y-1.5 mb-2">
                                    <div className="bg-background/60 border border-border rounded-lg px-2.5 py-2">
                                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">{lang === "ar" ? "إجابة الطالب" : "Student answer"}</p>
                                      <p className="text-sm whitespace-pre-wrap break-words">{a.selectedAnswer || <span className="text-muted-foreground italic">{lang === "ar" ? "(فارغة)" : "(empty)"}</span>}</p>
                                    </div>
                                    {a.correctAnswer && (
                                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg px-2.5 py-2">
                                        <p className="text-[10px] font-bold text-green-700 dark:text-green-300 mb-0.5">{lang === "ar" ? "الإجابة المرجعية" : "Reference"}</p>
                                        <p className="text-sm whitespace-pre-wrap break-words">{a.correctAnswer}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex items-end gap-2 pt-2 border-t border-border/60">
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">{lang === "ar" ? "ضبط الدرجة" : "Adjust grade"}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={a.points}
                                      step="0.5"
                                      defaultValue={String(earnedPts)}
                                      onBlur={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (isNaN(v)) return;
                                        if (v === earnedPts) return;
                                        updateAnswerGrade.mutate({ answerId: a.id, data: { teacherPoints: v } });
                                      }}
                                      className="w-full px-2 py-1.5 rounded-lg bg-background border-2 border-border text-sm font-bold text-center focus:outline-none focus:border-primary transition-all"
                                    />
                                  </div>
                                  <div className="flex-[2]">
                                    <label className="block text-[10px] font-bold text-muted-foreground mb-1">{lang === "ar" ? "ملاحظة" : "Note"}</label>
                                    <input
                                      type="text"
                                      defaultValue={a.teacherNote || ""}
                                      onBlur={(e) => {
                                        const v = e.target.value;
                                        if (v === (a.teacherNote || "")) return;
                                        updateAnswerGrade.mutate({ answerId: a.id, data: { teacherNote: v || null } });
                                      }}
                                      placeholder={lang === "ar" ? "اختياري" : "optional"}
                                      className="w-full px-2 py-1.5 rounded-lg bg-background border-2 border-border text-xs focus:outline-none focus:border-primary transition-all"
                                    />
                                  </div>
                                </div>
                                {a.teacherPoints !== null && a.teacherPoints !== undefined && (
                                  <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                                    <Pencil className="w-2.5 h-2.5" /> {lang === "ar" ? "مُصححة يدوياً" : "Manually graded"}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Solo Challenge Leaderboard Modal ─────────────────── */}
      <AnimatePresence>
        {soloLeaderboardOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSoloLeaderboardOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                <Trophy className="w-6 h-6 text-white" />
                <div className="flex-1">
                  <h2 className="text-base font-black text-white">{lang === "ar" ? "قائمة المتصدرين" : "Leaderboard"}</h2>
                  <p className="text-xs text-white/80">{lang === "ar" ? `وميض حر · ${soloChallenge?.slug}` : `Solo · ${soloChallenge?.slug}`}</p>
                </div>
                <button onClick={() => setSoloLeaderboardOpen(false)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Column headers */}
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-muted-foreground">
                <span className="w-7 shrink-0">#</span>
                <span className="flex-1">{lang === "ar" ? "الاسم" : "Name"}</span>
                <span className="w-10 text-center">{lang === "ar" ? "صحيح" : "✓"}</span>
                <span className="w-14 text-center">{lang === "ar" ? "الوقت" : "Time"}</span>
                <span className="w-16 text-end">{lang === "ar" ? "النقاط" : "Points"}</span>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-3">
                {soloParticipantsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  </div>
                ) : soloParticipants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="w-10 h-10 mx-auto mb-2 opacity-25" />
                    <p className="text-sm font-bold">{lang === "ar" ? "لا يوجد مشاركون بعد" : "No participants yet"}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {soloParticipants.map((p, i) => {
                      const isTop3 = i < 3;
                      const medalColors = ["#f59e0b", "#9ca3af", "#b45309"];
                      const fmtTime = (s: number | null) => {
                        if (!s) return "—";
                        const m = Math.floor(s / 60), sec = s % 60;
                        return `${m}:${String(sec).padStart(2, "0")}`;
                      };
                      return (
                        <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isTop3 ? "border-amber-200 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/40" : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}>
                          {/* Rank badge */}
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: isTop3 ? medalColors[i] : "#e5e7eb", color: isTop3 ? "white" : "#6b7280" }}>
                            {isTop3 ? ["🥇","🥈","🥉"][i] : i + 1}
                          </div>
                          {/* Name + date */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{p.playerName}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(p.playedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                          </div>
                          {/* Correct count */}
                          <div className="w-10 text-center">
                            <span className={`text-sm font-black ${p.correctCount > 0 ? "text-green-600" : "text-gray-400"}`}>{p.correctCount}</span>
                          </div>
                          {/* Time */}
                          <div className="w-14 text-center">
                            <span className="text-xs font-bold text-blue-500">{fmtTime(p.timeTaken)}</span>
                          </div>
                          {/* Score / points */}
                          <div className="w-16 text-end">
                            <span className={`text-sm font-black ${isTop3 ? "text-amber-600" : "text-gray-700 dark:text-gray-300"}`}>{p.score > 0 ? p.score.toLocaleString() : "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {soloParticipants.length} {lang === "ar" ? "مشارك" : "participants"}
                </span>
                <button onClick={loadParticipants} disabled={soloParticipantsLoading} className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
                  <Loader2 className={`w-3 h-3 ${soloParticipantsLoading ? "animate-spin" : "opacity-0"}`} />
                  {lang === "ar" ? "تحديث" : "Refresh"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
