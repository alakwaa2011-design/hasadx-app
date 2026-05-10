import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import {
  GraduationCap, ArrowRight, ArrowLeft, Users, BookOpen,
  ClipboardCopy, Check, Plus, X, Loader2, PaintBucket, Columns3,
  Pencil, RotateCcw, Eraser,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Student = { id: number; name: string };
type Assignment = {
  id: number;
  title: string;
  subject: string;
  totalPoints: number | null;
  displayTotalPoints: number | null;
};
type Submission = {
  id: number;
  assignmentId: number;
  studentName: string;
  studentId: number | null;
  earnedPoints: number;
  totalPoints: number;
  teacherAdjustedPoints: number | null;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
};
/** Some gradebook rows are synthesized client-side (e.g. games) and may lack a persisted submission id. */
type SubmissionRow = Submission & { id?: number };
type CustomColumn = { id: number; name: string; appliedTo: string };
type GradeMap = Record<string, string>; // `${studentId}_${columnId}` -> value
type FillTarget = { kind: "custom"; id: number } | { kind: "assignment"; id: number };

export default function ClassGrades() {
  const [, params] = useRoute("/teacher/class-grades/:gradeLevel");
  const gradeLevel = decodeURIComponent(params?.gradeLevel || "");
  const { lang, dir } = useI18n();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  /* ── custom columns state ── */
  const [customCols, setCustomCols] = useState<CustomColumn[]>([]);
  const [grades, setGrades] = useState<GradeMap>({});
  const [colsLoading, setColsLoading] = useState(true);

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [savingCol, setSavingCol] = useState(false);

  /* fill-all: custom column id or assignment id */
  const [fillOpen, setFillOpen] = useState<FillTarget | null>(null);
  const [fillValue, setFillValue] = useState("");

  /* copy-column feedback: "c:123" custom, "a:456" assignment */
  const [copiedColKey, setCopiedColKey] = useState<string | null>(null);

  /* assignment display-total override */
  const [editTotalFor, setEditTotalFor] = useState<number | null>(null);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [savingTotal, setSavingTotal] = useState(false);

  /* inline grade editing: key = `${studentId}_${assignmentId}` */
  type GradeEditKey = string;
  const [editingGrade, setEditingGrade] = useState<GradeEditKey | null>(null);
  const [editingGradeValue, setEditingGradeValue] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);

  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gradeTableRef = useRef<HTMLTableElement>(null);
  /** Avoid duplicate PUT when arrow-key save unmounts the assignment grade input (blur fires). */
  const suppressAssignmentGradeBlurSave = useRef(false);

  const gradeKey = (studentId: number, columnId: number) => `${studentId}_${columnId}`;

  /* ── Load assignment grades ── */
  useEffect(() => {
    if (!gradeLevel) return;
    setLoading(true);
    fetch(`${API_BASE}/api/class-grades/${encodeURIComponent(gradeLevel)}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setStudents(data.students || []);
        setAssignments(data.assignments || []);
        setSubmissions(data.submissions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gradeLevel]);

  /* ── Load custom columns & grades ── */
  const loadCustom = useCallback(async () => {
    if (!gradeLevel) return;
    setColsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/custom-grades/${encodeURIComponent(gradeLevel)}`,
        { credentials: "include", cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setCustomCols(data.columns || []);
      const map: GradeMap = {};
      for (const g of (data.grades || [])) map[gradeKey(g.studentId, g.columnId)] = g.value;
      setGrades(map);
    } finally {
      setColsLoading(false);
    }
  }, [gradeLevel]);

  useEffect(() => { loadCustom(); }, [loadCustom]);

  /* ── Helpers ── */
  const getSubmission = (studentId: number, studentName: string, assignmentId: number): SubmissionRow | undefined => {
    const byId = submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
    if (byId) return byId as SubmissionRow;
    const nameNorm = studentName.trim().toLowerCase();
    return submissions.find(s =>
      s.assignmentId === assignmentId && !s.studentId &&
      s.studentName.trim().toLowerCase() === nameNorm
    ) as SubmissionRow | undefined;
  };

  const refetchClassGrades = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/class-grades/${encodeURIComponent(gradeLevel)}`, { credentials: "include" });
    if (!r.ok) return;
    const data = await r.json();
    setStudents(data.students || []);
    setAssignments(data.assignments || []);
    setSubmissions(data.submissions || []);
  }, [gradeLevel]);

  const getStudentAverage = (student: Student) => {
    const subs = assignments.map(a => getSubmission(student.id, student.name, a.id)).filter(Boolean) as Submission[];
    if (!subs.length) return 0;
    const earned = subs.reduce((s, x) => s + (x.teacherAdjustedPoints ?? x.earnedPoints), 0);
    const max = subs.reduce((s, x) => s + x.totalPoints, 0);
    return max > 0 ? Math.round((earned / max) * 100) : 0;
  };

  const getScoreColor = (pct: number) =>
    pct >= 80 ? "text-green-600 dark:text-green-400" :
    pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

  const getAvgBg = (pct: number) =>
    pct >= 80 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
    pct >= 50 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const totalGradeCols = assignments.length + customCols.length;

  const isGradeCellNavigable = (rowIdx: number, colIdx: number) => {
    if (rowIdx < 0 || rowIdx >= sortedStudents.length || colIdx < 0 || colIdx >= totalGradeCols) return false;
    if (colIdx < assignments.length) {
      const a = assignments[colIdx];
      const st = sortedStudents[rowIdx];
      return !!getSubmission(st.id, st.name, a.id);
    }
    return true;
  };

  const focusGradeCell = (rowIdx: number, colIdx: number) => {
    gradeTableRef.current
      ?.querySelector<HTMLElement>(`[data-grade-nav="${rowIdx}-${colIdx}"]`)
      ?.focus();
  };

  /** Arrow keys: move between students (up/down) and columns (left/right). */
  const handleGradeGridKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    opts?: { onLeaveAssignmentEdit?: () => Promise<boolean> }
  ) => {
    const key = e.key;
    if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return false;

    let dRow = 0;
    let dCol = 0;
    if (key === "ArrowUp") dRow = -1;
    else if (key === "ArrowDown") dRow = 1;
    // Horizontal arrows follow *visual* direction: in RTL, adjacent grade columns run right→higher index (visually leftward).
    else if (key === "ArrowLeft") dCol = dir === "rtl" ? 1 : -1;
    else if (key === "ArrowRight") dCol = dir === "rtl" ? -1 : 1;

    const findNext = (): { r: number; c: number } | null => {
      let r = rowIdx + dRow;
      let c = colIdx + dCol;
      const maxR = sortedStudents.length - 1;
      const maxC = totalGradeCols - 1;
      const maxSteps = Math.max(sortedStudents.length, totalGradeCols) * 2 + 10;
      let steps = 0;
      while (steps++ < maxSteps) {
        if (r < 0 || r > maxR || c < 0 || c > maxC) return null;
        if (isGradeCellNavigable(r, c)) return { r, c };
        if (dRow !== 0) r += dRow > 0 ? 1 : -1;
        else if (dCol !== 0) c += dCol > 0 ? 1 : -1;
        else return null;
      }
      return null;
    };

    const next = findNext();
    if (!next) return false;

    e.preventDefault();

    const finish = () => {
      requestAnimationFrame(() => focusGradeCell(next.r, next.c));
    };

    if (opts?.onLeaveAssignmentEdit) {
      void opts.onLeaveAssignmentEdit().then(ok => {
        if (ok) finish();
      });
      return true;
    }

    finish();
    return true;
  };

  /* ── Copy full sheet to Excel ── */
  const handleCopyExcel = () => {
    const header = [
      "#",
      lang === "ar" ? "الطالب" : "Student",
      ...assignments.map(a => a.title),
      ...customCols.map(c => c.name),
      lang === "ar" ? "المعدل %" : "Avg %",
    ].join("\t");

    const rows = sortedStudents.map((student, idx) => {
      const assignGrades = assignments.map(a => {
        const sub = getSubmission(student.id, student.name, a.id);
        // Output plain numbers so Excel never misreads fractions as dates
        return sub ? String(sub.teacherAdjustedPoints ?? sub.earnedPoints) : "-";
      });
      const customGrades = customCols.map(c => grades[gradeKey(student.id, c.id)] ?? "");
      return [idx + 1, student.name, ...assignGrades, ...customGrades, `${getStudentAverage(student)}%`].join("\t");
    });

    navigator.clipboard.writeText([header, ...rows].join("\n")).then(() => {
      setCopied(true);
      toast.success(lang === "ar" ? "تم النسخ! الصقه في الإكسل" : "Copied! Paste it into Excel");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Copy a single custom column (values only, no names) ── */
  const handleCopyColumn = (col: CustomColumn) => {
    const lines = sortedStudents.map(s => grades[gradeKey(s.id, col.id)] ?? "");
    const key = `c-${col.id}`;
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedColKey(key);
      toast.success(`تم نسخ عمود "${col.name}" — الصقه في الإكسل`);
      setTimeout(() => setCopiedColKey(null), 2000);
    });
  };

  const handleCopyAssignmentColumn = (assignmentId: number, title: string) => {
    const lines = sortedStudents.map(s => {
      const sub = getSubmission(s.id, s.name, assignmentId);
      return sub ? String(sub.teacherAdjustedPoints ?? sub.earnedPoints) : "";
    });
    const key = `a-${assignmentId}`;
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedColKey(key);
      toast.success(lang === "ar" ? `تم نسخ عمود «${title}»` : `Copied "${title}" column`);
      setTimeout(() => setCopiedColKey(null), 2000);
    });
  };

  /** Clear teacher adjustments for this assignment column (restore auto/earned grades). */
  const handleClearAssignmentColumn = async (assignmentId: number, title: string) => {
    const msg =
      lang === "ar"
        ? `مسح الدرجات المعدّلة للجميع في «${title}»؟\n\nتعود كل خانة لدرجة التصحيح الأصلية (ولن يُحذف الواجب).`
        : `Clear adjusted grades for every student in "${title}"?\n\nEach cell will revert to the score from grading (the assignment is not deleted).`;
    if (!confirm(msg)) return;
    let cleared = 0;
    for (const s of sortedStudents) {
      const sub = getSubmission(s.id, s.name, assignmentId);
      if (!sub?.id) continue;
      if (sub.teacherAdjustedPoints == null) continue;
      const res = await fetch(`${API_BASE}/api/submissions/${sub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teacherAdjustedPoints: null }),
      });
      if (res.ok) {
        cleared++;
        setSubmissions(prev => prev.map(x => (x.id === sub.id ? { ...x, teacherAdjustedPoints: null } : x)));
      }
    }
    await refetchClassGrades();
    toast.success(
      lang === "ar"
        ? cleared > 0
          ? `تم مسح ${cleared} درجة معدّلة`
          : "لا توجد درجات معدّلة لمسحها في هذا العمود"
        : cleared > 0
          ? `Cleared ${cleared} adjusted grade(s)`
          : "No adjusted grades to clear in this column"
    );
  };

  const handleClearCustomColumn = async (colId: number, colName: string) => {
    const msg =
      lang === "ar"
        ? `مسح كل القيم في عمود «${colName}»؟\n\nلن يُحذف العمود نفسه.`
        : `Clear all values in column "${colName}"?\n\nThe column itself is not deleted.`;
    if (!confirm(msg)) return;
    const next = { ...grades };
    for (const s of sortedStudents) {
      next[gradeKey(s.id, colId)] = "";
    }
    setGrades(next);
    await Promise.all(
      sortedStudents.map(s =>
        fetch(`${API_BASE}/api/custom-grades`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ columnId: colId, studentId: s.id, value: "" }),
        })
      )
    );
    toast.success(lang === "ar" ? "تم مسح عمود الدرجات المخصصة" : "Custom column values cleared");
  };

  const handleHideAssignmentFromGradebook = async (assignmentId: number, title: string) => {
    const msg =
      lang === "ar"
        ? `إخفاء عمود «${title}» من كشف الدرجات؟\n\nلن يُحذف الواجب. يمكنك إظهاره مرة أخرى من صفحة الواجب → تعديل → خيار «إظهار في كشف الدرجات».`
        : `Hide "${title}" from the class grade sheet?\n\nThe assignment is not deleted. You can show it again from Edit assignment.`;
    if (!confirm(msg)) return;
    const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ hiddenFromGradebook: true }),
    });
    if (res.ok) {
      toast.success(lang === "ar" ? "تم إخفاء العمود من الكشف" : "Hidden from grade sheet");
      await refetchClassGrades();
      await loadCustom();
    } else {
      toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
    }
  };
  /* ── Add column ── */
  const handleAddColumn = async () => {
    if (!newColName.trim()) return;
    setSavingCol(true);
    try {
      const res = await fetch(`${API_BASE}/api/custom-columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newColName.trim(), applyToAll: applyAll, className: gradeLevel }),
      });
      if (res.ok) {
        setNewColName(""); setApplyAll(false); setShowAddCol(false);
        await loadCustom();
        toast.success("تم إضافة العمود");
      }
    } finally { setSavingCol(false); }
  };

  /* ── Delete column ── */
  const handleDeleteColumn = async (colId: number) => {
    if (!confirm("حذف هذا العمود وجميع درجاته؟")) return;
    await fetch(`${API_BASE}/api/custom-columns/${colId}`, { method: "DELETE", credentials: "include" });
    setCustomCols(prev => prev.filter(c => c.id !== colId));
    toast.success("تم حذف العمود");
  };

  /* ── Save assignment display-total override ── */
  const handleSaveDisplayTotal = async (assignmentId: number, value: number | null) => {
    setSavingTotal(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayTotalPoints: value }),
      });
      if (!res.ok) {
        toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
        return;
      }
      await refetchClassGrades();
      setEditTotalFor(null);
      setEditTotalValue("");
      toast.success(
        value === null
          ? (lang === "ar" ? "تمت إعادة الدرجة الأصلية" : "Reset to original")
          : (lang === "ar" ? "تم تحديث الدرجة المعروضة" : "Display total updated")
      );
    } finally {
      setSavingTotal(false);
    }
  };

  /* ── Save teacher grade override for an assignment submission ── */
  const handleSaveGrade = async (
    sub: Submission,
    rawValue: string,
    options?: { quiet?: boolean }
  ): Promise<boolean> => {
    const quiet = options?.quiet ?? false;
    const trimmed = rawValue.trim();
    if (trimmed === "") {
      // Clear override — restore earned points
      setSavingGrade(true);
      try {
        const res = await fetch(`${API_BASE}/api/submissions/${sub.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ teacherAdjustedPoints: null }),
        });
        if (!res.ok) {
          if (!quiet) toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
          return false;
        }
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, teacherAdjustedPoints: null } : s));
        if (!quiet) toast.success(lang === "ar" ? "تمت إزالة التعديل" : "Override cleared");
        setEditingGrade(null);
        return true;
      } catch {
        if (!quiet) toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
        return false;
      } finally {
        setSavingGrade(false);
      }
    }
    const num = parseFloat(trimmed.replace(",", "."));
    if (isNaN(num) || num < 0 || num > sub.totalPoints) {
      toast.error(lang === "ar" ? `أدخل رقماً بين 0 و ${sub.totalPoints}` : `Enter a number between 0 and ${sub.totalPoints}`);
      return false;
    }
    setSavingGrade(true);
    try {
      const r = await fetch(`${API_BASE}/api/submissions/${sub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teacherAdjustedPoints: num }),
      });
      if (r.ok) {
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, teacherAdjustedPoints: num } : s));
        if (!quiet) toast.success(lang === "ar" ? "تم تعديل الدرجة ✓" : "Grade updated ✓");
        setEditingGrade(null);
        return true;
      }
      if (!quiet) toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
      return false;
    } catch {
      if (!quiet) toast.error(lang === "ar" ? "خطأ" : "Error");
      return false;
    } finally {
      setSavingGrade(false);
    }
  };

  /* ── Cell edit (auto-save) ── */
  const handleCellChange = (studentId: number, columnId: number, value: string) => {
    const key = gradeKey(studentId, columnId);
    setGrades(prev => ({ ...prev, [key]: value }));
    clearTimeout(autoSaveTimers.current[key]);
    autoSaveTimers.current[key] = setTimeout(() => {
      fetch(`${API_BASE}/api/custom-grades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnId, studentId, value }),
      });
    }, 600);
  };

  /* ── Fill entire column (custom text or assignment numeric grades) ── */
  const closeFillModal = () => {
    setFillOpen(null);
    setFillValue("");
  };

  const applyFillAll = async () => {
    if (!fillOpen) return;
    if (fillOpen.kind === "custom") {
      const colId = fillOpen.id;
      const val = fillValue;
      const newGrades = { ...grades };
      for (const s of sortedStudents) {
        newGrades[gradeKey(s.id, colId)] = val;
      }
      setGrades(newGrades);
      closeFillModal();

      await Promise.all(sortedStudents.map(s =>
        fetch(`${API_BASE}/api/custom-grades`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ columnId: colId, studentId: s.id, value: val }),
        })
      ));
      toast.success(lang === "ar" ? "تم تعبئة العمود بالكامل" : "Column filled");
      return;
    }

    const assignmentId = fillOpen.id;
    const trimmed = fillValue.trim();
    if (trimmed === "") {
      toast.error(lang === "ar" ? "أدخل درجة رقمية" : "Enter a numeric grade");
      return;
    }
    const num = parseFloat(trimmed.replace(",", "."));
    if (isNaN(num) || num < 0) {
      toast.error(lang === "ar" ? "درجة غير صالحة" : "Invalid grade");
      return;
    }
    const a = assignments.find(x => x.id === assignmentId);
    const cap = a?.displayTotalPoints ?? a?.totalPoints ?? 0;
    if (cap > 0 && num > cap) {
      toast.error(lang === "ar" ? `الدرجة يجب ألا تتجاوز ${cap}` : `Grade must be ≤ ${cap}`);
      return;
    }
    closeFillModal();

    let updated = 0;
    let skippedNoId = 0;
    for (const s of sortedStudents) {
      const sub = getSubmission(s.id, s.name, assignmentId);
      if (!sub?.id) {
        if (sub) skippedNoId++;
        continue;
      }
      if (num > sub.totalPoints) continue;
      const r = await fetch(`${API_BASE}/api/submissions/${sub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ teacherAdjustedPoints: num }),
      });
      if (r.ok) updated++;
    }
    await refetchClassGrades();
    toast.success(
      lang === "ar"
        ? `تم تحديث ${updated} طالباً${skippedNoId ? ` (تُرك ${skippedNoId} بلا سجل تسليم محفوظ)` : ""}`
        : `Updated ${updated} student(s).`
    );
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-[95vw] space-y-6">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-700 text-white p-6 sm:p-8 shadow-lg"
        >
          <div className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -start-12 w-48 h-48 rounded-full bg-amber-300/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <Link href="/teacher/students" className="inline-flex items-center gap-1 text-white/85 hover:text-white mb-4 text-sm font-semibold transition-colors">
              <BackIcon className="w-4 h-4" />
              {lang === "ar" ? "العودة للطلاب" : "Back to Students"}
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black">{gradeLevel}</h1>
                </div>
                <p className="text-white/85 text-sm sm:text-base">
                  {lang === "ar" ? "كشف درجات الفصل" : "Class Grade Sheet"}
                </p>
              </div>
              {students.length > 0 && (
                <button
                  onClick={handleCopyExcel}
                  className="bg-white text-primary hover:bg-white/95 font-bold shadow-lg shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
                  {copied ? (lang === "ar" ? "تم النسخ ✓" : "Copied ✓") : (lang === "ar" ? "نسخ الجدول كاملاً" : "Copy full sheet")}
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-4 text-xs flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full font-semibold">
                <Users className="w-3.5 h-3.5" /> {students.length} {lang === "ar" ? "طالب" : "students"}
              </span>
              <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full font-semibold">
                <BookOpen className="w-3.5 h-3.5" /> {assignments.length} {lang === "ar" ? "واجب" : "assignments"}
              </span>
            </div>
          </div>
        </motion.div>

        {students.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-amber-50 via-white to-amber-50/30 border border-amber-200/60">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">{lang === "ar" ? "لا يوجد طلاب" : "No students"}</h2>
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "أضف طلاباً إلى هذا الصف لتظهر درجاتهم هنا" : "Add students to this class to see their grades here"}
            </p>
          </Card>
        ) : (
          <>
            {/* ── Main table ── */}
            <Card className="overflow-x-auto p-0">
              <table ref={gradeTableRef} className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    {/* # */}
                    <th className="sticky start-0 z-20 bg-muted/60 px-3 py-3 text-start font-bold text-foreground whitespace-nowrap text-xs w-8">#</th>
                    {/* Name */}
                    <th className="sticky start-8 z-20 bg-muted/60 px-4 py-3 text-start font-bold text-foreground whitespace-nowrap min-w-[140px]">
                      {lang === "ar" ? "الطالب" : "Student"}
                    </th>
                    {/* Assignment columns */}
                    {assignments.map(a => {
                      const originalTotal = a.totalPoints ?? 0;
                      const effectiveTotal = a.displayTotalPoints ?? originalTotal;
                      const isOverridden = a.displayTotalPoints != null;
                      return (
                        <th key={a.id} className="px-2 py-2 text-center font-semibold text-foreground whitespace-nowrap border-r border-primary/15 bg-primary/5 dark:bg-primary/10 min-w-[110px]">
                          <div className="flex flex-col items-center gap-1">
                            <Link href={`/teacher/assignment/${a.id}`} className="hover:text-primary transition-colors">
                              <span className="block text-xs font-bold leading-tight max-w-[100px] truncate mx-auto" title={a.title}>{a.title}</span>
                              {a.subject && <span className="block text-[10px] text-muted-foreground font-normal">{a.subject}</span>}
                            </Link>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isOverridden
                                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground"
                                }`}
                                title={
                                  isOverridden
                                    ? (lang === "ar" ? `الأصلي: ${originalTotal}` : `Original: ${originalTotal}`)
                                    : (lang === "ar" ? "درجة الواجب" : "Assignment total")
                                }
                              >
                                {lang === "ar" ? "من" : "/"} {effectiveTotal}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditTotalFor(a.id);
                                  setEditTotalValue(String(effectiveTotal));
                                }}
                                className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-600 transition-colors"
                                title={lang === "ar" ? "ضبط الدرجة المعروضة" : "Set displayed total"}
                              >
                                <Pencil size={11} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap justify-center">
                              <button
                                type="button"
                                onClick={() => { setFillOpen({ kind: "assignment", id: a.id }); setFillValue(""); }}
                                className="p-1 rounded hover:bg-primary/15 text-primary hover:text-primary transition-colors"
                                title={lang === "ar" ? "تعبئة العمود (درجة رقمية لمن لديهم تسليم)" : "Fill column (numeric, students with submissions)"}
                              >
                                <PaintBucket size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyAssignmentColumn(a.id, a.title)}
                                className="p-1 rounded hover:bg-primary/15 text-primary transition-colors"
                                title={lang === "ar" ? "نسخ العمود" : "Copy column"}
                              >
                                {copiedColKey === `a-${a.id}` ? <Check size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleClearAssignmentColumn(a.id, a.title)}
                                className="p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 text-primary/80 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                                title={lang === "ar" ? "مسح الدرجات المعدّلة (العودة لدرجة التصحيح)" : "Clear adjusted grades (revert to graded score)"}
                              >
                                <Eraser size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleHideAssignmentFromGradebook(a.id, a.title)}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-primary/70 hover:text-red-500 transition-colors"
                                title={lang === "ar" ? "إخفاء العمود من الكشف" : "Hide column from sheet"}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                    {/* Custom columns */}
                    {customCols.map(col => (
                      <th key={col.id} className="px-2 py-2 text-center font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap border-r border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 min-w-[110px]">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold">{col.name}</span>
                            {col.appliedTo === "*" && (
                              <span className="text-[9px] text-violet-400 bg-violet-100 dark:bg-violet-900/40 rounded px-1">كل الصفوف</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            <button
                              type="button"
                              onClick={() => { setFillOpen({ kind: "custom", id: col.id }); setFillValue(""); }}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500 hover:text-violet-700 transition-colors"
                              title={lang === "ar" ? "تعبئة العمود كله بنفس القيمة" : "Fill entire column with one value"}
                            >
                              <PaintBucket size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyColumn(col)}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500 hover:text-violet-700 transition-colors"
                              title={lang === "ar" ? "نسخ العمود كاملاً" : "Copy entire column"}
                            >
                              {copiedColKey === `c-${col.id}` ? <Check size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleClearCustomColumn(col.id, col.name)}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500 hover:text-violet-800 dark:hover:text-violet-200 transition-colors"
                              title={lang === "ar" ? "مسح قيم العمود (بدون حذف العمود)" : "Clear all cells (column stays)"}
                            >
                              <Eraser size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-violet-400 hover:text-red-500 transition-colors"
                              title={lang === "ar" ? "حذف العمود نهائياً" : "Delete column permanently"}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    {/* Add column button */}
                    <th className="px-2 py-3 text-center bg-violet-50/50 dark:bg-violet-950/10 border-r border-violet-100 dark:border-violet-900/30">
                      <button
                        onClick={() => setShowAddCol(true)}
                        className="flex items-center gap-1 mx-auto px-2 py-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-800/30 rounded-lg transition-colors whitespace-nowrap"
                        title="إضافة عمود مخصص"
                      >
                        <Plus size={13} />
                        <span>عمود جديد</span>
                      </button>
                    </th>
                    {/* Average */}
                    <th className="px-4 py-3 text-center font-bold text-foreground whitespace-nowrap bg-muted/80">
                      {lang === "ar" ? "المعدل" : "Avg"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, idx) => {
                    const avg = getStudentAverage(student);
                    return (
                      <tr key={student.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="sticky start-0 z-10 bg-card px-3 py-2.5 text-muted-foreground text-xs font-bold">{idx + 1}</td>
                        <td className="sticky start-8 z-10 bg-card px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">{student.name}</td>
                        {assignments.map((a, ac) => {
                          const sub = getSubmission(student.id, student.name, a.id);
                          if (!sub) {
                            return (
                              <td key={a.id} className="px-3 py-2.5 text-center border-r border-primary/10 bg-primary/[0.03]">
                                <span className="text-xs text-muted-foreground/50">—</span>
                              </td>
                            );
                          }
                          const earned = sub.teacherAdjustedPoints ?? sub.earnedPoints;
                          const pct = sub.totalPoints > 0 ? Math.round((earned / sub.totalPoints) * 100) : 0;
                          const cellKey = `${student.id}_${a.id}`;
                          const isEditing = editingGrade === cellKey;
                          const navCol = ac;
                          return (
                            <td key={a.id} className="px-1 py-1 text-center border-r border-primary/10 bg-primary/[0.03] dark:bg-primary/5">
                              {isEditing ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    autoFocus
                                    type="number"
                                    min={0}
                                    max={sub.totalPoints}
                                    step="0.5"
                                    data-grade-nav={`${idx}-${navCol}`}
                                    defaultValue={earned}
                                    onKeyDown={e => {
                                      const inputEl = e.currentTarget;
                                      if (e.key === "Enter") void handleSaveGrade(sub, inputEl.value);
                                      if (e.key === "Escape") setEditingGrade(null);
                                      if (
                                        handleGradeGridKeyDown(e, idx, navCol, {
                                          onLeaveAssignmentEdit: async () => {
                                            suppressAssignmentGradeBlurSave.current = true;
                                            const ok = await handleSaveGrade(sub, inputEl.value, { quiet: true });
                                            if (!ok) suppressAssignmentGradeBlurSave.current = false;
                                            return ok;
                                          },
                                        })
                                      ) return;
                                    }}
                                    onBlur={e => {
                                      if (suppressAssignmentGradeBlurSave.current) {
                                        suppressAssignmentGradeBlurSave.current = false;
                                        return;
                                      }
                                      void handleSaveGrade(sub, e.target.value);
                                    }}
                                    className="w-14 text-center px-1 py-0.5 rounded border border-primary/50 text-xs font-bold bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                                    disabled={savingGrade}
                                  />
                                  <span className="text-[10px] text-muted-foreground">/{sub.totalPoints}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  title={lang === "ar" ? "انقر للتعديل" : "Click to edit"}
                                  data-grade-nav={`${idx}-${navCol}`}
                                  onClick={() => { setEditingGrade(cellKey); setEditingGradeValue(String(earned)); }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setEditingGrade(cellKey);
                                      setEditingGradeValue(String(earned));
                                      return;
                                    }
                                    handleGradeGridKeyDown(e, idx, navCol);
                                  }}
                                  className={`group inline-flex items-center gap-1 font-bold text-xs ${getScoreColor(pct)} hover:ring-1 hover:ring-primary/40 rounded px-1.5 py-0.5 transition-all`}
                                >
                                  {sub.teacherAdjustedPoints != null && (
                                    <span title={lang === "ar" ? "درجة معدّلة" : "Adjusted"} className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  )}
                                  {earned}/{sub.totalPoints}
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 shrink-0" />
                                </button>
                              )}
                            </td>
                          );
                        })}
                        {/* Custom grade cells */}
                        {customCols.map((col, cc) => (
                          <td key={col.id} className="px-1 py-1 text-center border-r border-violet-100 dark:border-violet-900/20 bg-violet-50/30 dark:bg-violet-950/10">
                            <input
                              type="text"
                              data-grade-nav={`${idx}-${assignments.length + cc}`}
                              value={grades[gradeKey(student.id, col.id)] ?? ""}
                              onChange={e => handleCellChange(student.id, col.id, e.target.value)}
                              onKeyDown={e => handleGradeGridKeyDown(e, idx, assignments.length + cc)}
                              className="w-full text-center px-2 py-1.5 rounded-lg bg-transparent border border-transparent hover:border-violet-300 focus:border-violet-500 focus:bg-card outline-none text-xs transition-all font-medium placeholder:text-muted-foreground/40"
                              placeholder="—"
                            />
                          </td>
                        ))}
                        {/* Add-col placeholder cell */}
                        <td className="bg-violet-50/20 dark:bg-violet-950/5 border-r border-violet-100 dark:border-violet-900/20" />
                        {/* Average */}
                        <td className="px-4 py-2.5 text-center bg-muted/10">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-black min-w-[48px] ${getAvgBg(avg)}`}>
                            {avg}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Empty custom cols hint */}
            {!colsLoading && customCols.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                اضغط <span className="font-bold text-violet-600">+ عمود جديد</span> لإضافة أعمدة مخصصة (شفهي، مشاركة، سلوك...)
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Display-Total Override Modal ── */}
      {editTotalFor !== null && (() => {
        const a = assignments.find(x => x.id === editTotalFor);
        if (!a) return null;
        const originalTotal = a.totalPoints ?? 0;
        const isOverridden = a.displayTotalPoints != null;
        const parsedValue = parseFloat(editTotalValue);
        const valueValid = !isNaN(parsedValue) && parsedValue > 0;
        const close = () => { setEditTotalFor(null); setEditTotalValue(""); };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={close}>
            <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-amber-200 dark:border-amber-800" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-1">
                <Pencil className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold">{lang === "ar" ? "ضبط الدرجة المعروضة" : "Set displayed total"}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {lang === "ar" ? (
                  <>
                    الواجب <span className="font-bold text-foreground">"{a.title}"</span> درجته الأصلية <span className="font-bold text-foreground">{originalTotal}</span>.
                    اكتب الدرجة التي تريد عرضها في الكشف، وستُعدَّل درجات الطلاب تلقائياً بنفس النسبة.
                  </>
                ) : (
                  <>
                    Original total: <span className="font-bold text-foreground">{originalTotal}</span>.
                    Enter the value you want shown in the gradebook — student grades will rescale automatically.
                  </>
                )}
              </p>
              <label className="block text-xs font-bold text-muted-foreground mb-1">
                {lang === "ar" ? "اعرض الدرجات من:" : "Display grades out of:"}
              </label>
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.5"
                value={editTotalValue}
                onChange={e => setEditTotalValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && valueValid) handleSaveDisplayTotal(a.id, parsedValue);
                  if (e.key === "Escape") close();
                }}
                placeholder={lang === "ar" ? "مثال: 5" : "e.g. 5"}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-amber-400/40 mb-4"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => valueValid && handleSaveDisplayTotal(a.id, parsedValue)}
                  disabled={savingTotal || !valueValid}
                  className="w-full py-2 text-sm font-bold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {savingTotal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check size={15} />}
                  {lang === "ar" ? "حفظ" : "Save"}
                </button>
                <div className="flex gap-2">
                  {isOverridden && (
                    <button
                      onClick={() => handleSaveDisplayTotal(a.id, null)}
                      disabled={savingTotal}
                      className="flex-1 py-2 text-xs rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 flex items-center justify-center gap-1"
                      title={lang === "ar" ? `إعادة العرض إلى ${originalTotal}` : `Reset display to ${originalTotal}`}
                    >
                      <RotateCcw size={13} />
                      {lang === "ar" ? `إعادة للأصلي (${originalTotal})` : `Reset to original (${originalTotal})`}
                    </button>
                  )}
                  <button
                    onClick={close}
                    className="flex-1 py-2 text-xs rounded-xl bg-muted text-muted-foreground hover:bg-muted/80"
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Fill-All Modal ── */}
      {fillOpen !== null && (() => {
        if (fillOpen.kind === "custom") {
          const col = customCols.find(c => c.id === fillOpen.id);
          if (!col) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeFillModal}>
              <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-violet-200 dark:border-violet-800" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-1">
                  <PaintBucket className="w-5 h-5 text-violet-500" />
                  <h2 className="text-base font-bold">{lang === "ar" ? "تعبئة العمود كله" : "Fill entire column"}</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {lang === "ar" ? (
                    <>ستُطبَّق هذه القيمة على جميع الطلاب في عمود <span className="font-bold text-violet-600">"{col.name}"</span> ({sortedStudents.length} طالب)</>
                  ) : (
                    <>Applied to all students in column <span className="font-bold text-violet-600">"{col.name}"</span>.</>
                  )}
                </p>
                <input
                  autoFocus
                  value={fillValue}
                  onChange={e => setFillValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void applyFillAll(); if (e.key === "Escape") closeFillModal(); }}
                  placeholder={lang === "ar" ? "أدخل القيمة... مثال: 10 أو ممتاز" : "Value..."}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-violet-400/40 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void applyFillAll()}
                    className="flex-1 py-2 text-sm font-bold bg-violet-500 text-white rounded-xl hover:bg-violet-600 flex items-center justify-center gap-1"
                  >
                    <PaintBucket size={14} />
                    {lang === "ar" ? "تعبئة الكل" : "Fill all"}
                  </button>
                  <button type="button" onClick={closeFillModal} className="flex-1 py-2 text-sm rounded-xl bg-muted text-muted-foreground hover:bg-muted/80">
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          );
        }
        const a = assignments.find(x => x.id === fillOpen.id);
        if (!a) return null;
        const eff = a.displayTotalPoints ?? a.totalPoints ?? 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeFillModal}>
            <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-primary/30" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-1">
                <PaintBucket className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold">{lang === "ar" ? "تعبئة درجات الواجب" : "Fill assignment grades"}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {lang === "ar" ? (
                  <>
                    واجب <span className="font-bold text-foreground">«{a.title}»</span> — درجة رقمية (0–{eff || "…"}) تُطبَّق كدرجة معدّلة لكل طالب <span className="font-semibold">لديه تسليم محفوظ</span>.
                  </>
                ) : (
                  <>
                    Assignment <span className="font-bold">"{a.title}"</span> — one numeric grade (0–{eff || "…"}) for each student with a stored submission.
                  </>
                )}
              </p>
              <input
                autoFocus
                type="number"
                min={0}
                max={eff || undefined}
                step="0.5"
                value={fillValue}
                onChange={e => setFillValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void applyFillAll(); if (e.key === "Escape") closeFillModal(); }}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-primary/40 mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void applyFillAll()}
                  className="flex-1 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 flex items-center justify-center gap-1"
                >
                  <PaintBucket size={14} />
                  {lang === "ar" ? "تعبئة" : "Apply"}
                </button>
                <button type="button" onClick={closeFillModal} className="flex-1 py-2 text-sm rounded-xl bg-muted text-muted-foreground hover:bg-muted/80">
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Column Modal ── */}
      {showAddCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddCol(false)}>
          <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-violet-200 dark:border-violet-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Columns3 className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-bold">إضافة عمود مخصص</h2>
            </div>
            <input
              autoFocus
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddCol(false); }}
              placeholder="مثال: شفهي، سلوك، مشاركة..."
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-violet-400/40 mb-3"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none mb-4">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={e => setApplyAll(e.target.checked)}
                className="rounded"
              />
              تطبيق على جميع الصفوف (ليس هذا الصف فقط)
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleAddColumn}
                disabled={savingCol || !newColName.trim()}
                className="flex-1 py-2 text-sm font-bold bg-violet-500 text-white rounded-xl hover:bg-violet-600 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {savingCol ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={15} />}
                إضافة
              </button>
              <button
                onClick={() => { setShowAddCol(false); setNewColName(""); }}
                className="flex-1 py-2 text-sm rounded-xl bg-muted text-muted-foreground hover:bg-muted/80"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
