import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import {
  GraduationCap, ArrowRight, ArrowLeft, Users, BookOpen,
  ClipboardCopy, Check, Plus, X, Loader2, PaintBucket, Columns3,
  Pencil, RotateCcw,
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
type CustomColumn = { id: number; name: string; appliedTo: string };
type GradeMap = Record<string, string>; // `${studentId}_${columnId}` -> value

export default function ClassGrades() {
  const [, params] = useRoute("/teacher/class-grades/:gradeLevel");
  const gradeLevel = decodeURIComponent(params?.gradeLevel || "");
  const { t, lang } = useI18n();
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

  /* fill-all state per column: columnId -> value being typed */
  const [fillOpen, setFillOpen] = useState<number | null>(null);
  const [fillValue, setFillValue] = useState("");

  /* copy-column feedback */
  const [copiedCol, setCopiedCol] = useState<number | null>(null);

  /* assignment display-total override */
  const [editTotalFor, setEditTotalFor] = useState<number | null>(null);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [savingTotal, setSavingTotal] = useState(false);

  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
  const getSubmission = (studentId: number, studentName: string, assignmentId: number): Submission | undefined => {
    const byId = submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
    if (byId) return byId;
    const nameNorm = studentName.trim().toLowerCase();
    return submissions.find(s =>
      s.assignmentId === assignmentId && !s.studentId &&
      s.studentName.trim().toLowerCase() === nameNorm
    );
  };

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

  /* ── Copy full sheet to Excel ── */
  const handleCopyExcel = () => {
    const header = [
      lang === "ar" ? "الطالب" : "Student",
      ...assignments.map(a => a.title),
      ...customCols.map(c => c.name),
      lang === "ar" ? "المعدل %" : "Avg %",
    ].join("\t");

    const rows = sortedStudents.map(student => {
      const assignGrades = assignments.map(a => {
        const sub = getSubmission(student.id, student.name, a.id);
        return sub ? `${sub.teacherAdjustedPoints ?? sub.earnedPoints}/${sub.totalPoints}` : "-";
      });
      const customGrades = customCols.map(c => grades[gradeKey(student.id, c.id)] ?? "");
      return [student.name, ...assignGrades, ...customGrades, `${getStudentAverage(student)}%`].join("\t");
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
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedCol(col.id);
      toast.success(`تم نسخ عمود "${col.name}" — الصقه في الإكسل`);
      setTimeout(() => setCopiedCol(null), 2000);
    });
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
      // Re-fetch the grade sheet so all cells refresh with the new ratio.
      const r = await fetch(`${API_BASE}/api/class-grades/${encodeURIComponent(gradeLevel)}`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setStudents(data.students || []);
        setAssignments(data.assignments || []);
        setSubmissions(data.submissions || []);
      }
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

  /* ── Fill entire column ── */
  const handleFillAll = async (colId: number) => {
    const val = fillValue;
    const newGrades = { ...grades };
    for (const s of sortedStudents) {
      newGrades[gradeKey(s.id, colId)] = val;
    }
    setGrades(newGrades);
    setFillOpen(null);
    setFillValue("");

    await Promise.all(sortedStudents.map(s =>
      fetch(`${API_BASE}/api/custom-grades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ columnId: colId, studentId: s.id, value: val }),
      })
    ));
    toast.success("تم تعبئة العمود بالكامل");
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
              <table className="w-full text-sm border-collapse">
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
                        <th key={a.id} className="px-3 py-3 text-center font-semibold text-foreground whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <Link href={`/teacher/assignment/${a.id}`} className="hover:text-primary transition-colors">
                              <span className="block text-xs leading-tight max-w-[100px] truncate mx-auto" title={a.title}>{a.title}</span>
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
                          <div className="flex items-center gap-1">
                            {/* Fill all button */}
                            <button
                              onClick={() => { setFillOpen(col.id); setFillValue(""); }}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500 hover:text-violet-700 transition-colors"
                              title="تعبئة العمود كله بنفس القيمة"
                            >
                              <PaintBucket size={12} />
                            </button>
                            {/* Copy column button */}
                            <button
                              onClick={() => handleCopyColumn(col)}
                              className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500 hover:text-violet-700 transition-colors"
                              title="نسخ العمود كاملاً"
                            >
                              {copiedCol === col.id ? <Check size={12} className="text-green-500" /> : <ClipboardCopy size={12} />}
                            </button>
                            {/* Delete column button */}
                            <button
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-violet-400 hover:text-red-500 transition-colors"
                              title="حذف العمود"
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
                        {assignments.map(a => {
                          const sub = getSubmission(student.id, student.name, a.id);
                          if (!sub) return <td key={a.id} className="px-3 py-2.5 text-center"><span className="text-xs text-muted-foreground/50">—</span></td>;
                          const earned = sub.teacherAdjustedPoints ?? sub.earnedPoints;
                          const pct = sub.totalPoints > 0 ? Math.round((earned / sub.totalPoints) * 100) : 0;
                          return (
                            <td key={a.id} className="px-3 py-2.5 text-center">
                              <span className={`font-bold text-xs ${getScoreColor(pct)}`}>{earned}/{sub.totalPoints}</span>
                            </td>
                          );
                        })}
                        {/* Custom grade cells */}
                        {customCols.map(col => (
                          <td key={col.id} className="px-1 py-1 text-center border-r border-violet-100 dark:border-violet-900/20 bg-violet-50/30 dark:bg-violet-950/10">
                            <input
                              type="text"
                              value={grades[gradeKey(student.id, col.id)] ?? ""}
                              onChange={e => handleCellChange(student.id, col.id, e.target.value)}
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
        const col = customCols.find(c => c.id === fillOpen);
        if (!col) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setFillOpen(null); setFillValue(""); }}>
            <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-violet-200 dark:border-violet-800" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-1">
                <PaintBucket className="w-5 h-5 text-violet-500" />
                <h2 className="text-base font-bold">تعبئة العمود كله</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                ستُطبَّق هذه القيمة على جميع الطلاب في عمود <span className="font-bold text-violet-600">"{col.name}"</span> ({sortedStudents.length} طالب)
              </p>
              <input
                autoFocus
                value={fillValue}
                onChange={e => setFillValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleFillAll(col.id); if (e.key === "Escape") { setFillOpen(null); setFillValue(""); } }}
                placeholder="أدخل القيمة... مثال: 10 أو ممتاز"
                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-card outline-none focus:ring-2 focus:ring-violet-400/40 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleFillAll(col.id)}
                  className="flex-1 py-2 text-sm font-bold bg-violet-500 text-white rounded-xl hover:bg-violet-600 flex items-center justify-center gap-1"
                >
                  <PaintBucket size={14} />
                  تعبئة الكل
                </button>
                <button
                  onClick={() => { setFillOpen(null); setFillValue(""); }}
                  className="flex-1 py-2 text-sm rounded-xl bg-muted text-muted-foreground hover:bg-muted/80"
                >
                  إلغاء
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
