import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Play, ArrowRight, Clock, ChevronDown, ChevronUp,
  Sparkles, BookOpen, Check, X, Loader2, FileText, Save, FolderOpen,
  GraduationCap, CheckCircle2, XCircle, Type, ListChecks, Rocket,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

type QType = "mcq" | "true_false" | "fill_blank";

interface RocketQuestion {
  text: string;
  type: QType;
  options: string[];
  correct: number;
  correctText?: string;
}

interface BankQuestion {
  id: number;
  subject: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
  tags: string | null;
}

const BLANK_MCQ = (): RocketQuestion => ({ text: "", type: "mcq", options: ["", "", "", ""], correct: 0 });
const BLANK_TF = (): RocketQuestion => ({ text: "", type: "true_false", options: ["صحيح", "خطأ"], correct: 0 });
const BLANK_FILL = (): RocketQuestion => ({ text: "", type: "fill_blank", options: [], correct: -1, correctText: "" });

const blankFor = (t: QType): RocketQuestion =>
  t === "mcq" ? BLANK_MCQ() : t === "true_false" ? BLANK_TF() : BLANK_FILL();

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToRocket = (bq: BankQuestion): RocketQuestion => ({
  text: bq.text,
  type: "mcq",
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
});

export default function RocketCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<RocketQuestion[]>([BLANK_MCQ()]);
  const [duration, setDuration] = useState(20);
  const [creating, setCreating] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const [title, setTitle] = useState("");

  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<{ id: number; title: string; subject: string; questionCount: number; isOwn?: boolean; ownerName?: string | null }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignExpandedId, setAssignExpandedId] = useState<number | null>(null);
  const [assignQuestions, setAssignQuestions] = useState<BankQuestion[]>([]);
  const [assignQLoading, setAssignQLoading] = useState(false);
  const [assignSelected, setAssignSelected] = useState<Set<number>>(new Set());

  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ id: number; title: string; questions: RocketQuestion[]; duration: number; createdAt: string; isOwn?: boolean; ownerName?: string | null; fromAdmin?: boolean }[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Auto-load from presentation deep-link
  useEffect(() => {
    const aid = new URLSearchParams(window.location.search).get("assignmentId");
    if (!aid) return;
    const parsedId = parseInt(aid, 10);
    if (Number.isNaN(parsedId)) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/assignments/${parsedId}`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        type RawQ = { questionType?: string; text?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string };
        const qs = ((data.questions || []) as RawQ[])
          .filter(q => q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map(q => bankToRocket({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null,
          } as BankQuestion))
          .slice(0, 30);
        if (qs.length > 0) {
          setQuestions(qs);
          if (data.title) setTitle(data.title);
          toast.success(ar ? `تم تحميل ${qs.length} سؤال من الواجب!` : `Loaded ${qs.length} questions!`);
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addQuestion = (type: QType = "mcq") => {
    if (questions.length >= 30) return;
    setQuestions(q => [...q, blankFor(type)]);
    setExpandedIdx(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(q => q.filter((_, i) => i !== idx));
    setExpandedIdx(Math.max(0, idx - 1));
  };

  const updateQuestion = (idx: number, patch: Partial<RocketQuestion>) => {
    setQuestions(q => q.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions(q => q.map((it, i) => {
      if (i !== qIdx) return it;
      const opts = [...it.options];
      opts[oIdx] = value;
      return { ...it, options: opts };
    }));
  };

  const changeType = (idx: number, newType: QType) => {
    setQuestions(q => q.map((it, i) => {
      if (i !== idx) return it;
      const text = it.text;
      const fresh = blankFor(newType);
      return { ...fresh, text };
    }));
  };

  const isValid = questions.every(q => {
    if (!q.text.trim()) return false;
    if (q.type === "mcq") return q.options.every(o => o.trim()) && q.correct >= 0 && q.correct < 4;
    if (q.type === "true_false") return true;
    if (q.type === "fill_blank") return !!(q.correctText && q.correctText.trim());
    return false;
  });

  const handleCreate = () => {
    if (!isValid) {
      toast.error(ar ? "يرجى ملء جميع الأسئلة بشكل صحيح" : "Please fill all questions correctly");
      return;
    }
    setCreating(true);
    const socket = getRocketSocket();
    socket.emit("rocket:create", {
      questions, duration,
      targetClass: targetClass || undefined,
      title: title.trim() || undefined,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        sessionStorage.setItem(`rocket-creator-${res.pin}`, res.creatorToken);
        setLocation(`/game/rocket/host/${res.pin}`);
      }
    });
  };

  // Bank
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) {
        toast.error(ar ? "يجب تسجيل الدخول أولاً" : "Please log in first");
        setBankOpen(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data.filter((q: BankQuestion) => q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer));
      }
    } catch { /* ignore */ } finally { setBankLoading(false); }
  }, [ar]);

  useEffect(() => {
    if (bankOpen) { loadBank(); setBankSelected(new Set()); setBankSearch(""); }
  }, [bankOpen, loadBank]);

  const importBankSelected = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    if (selected.length === 0) return;
    const converted = selected.map(bankToRocket);
    const hasEmpty = questions.length === 1 && !questions[0].text.trim();
    const merged = (hasEmpty ? converted : [...questions, ...converted]).slice(0, 30);
    setQuestions(merged);
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${converted.length} سؤال` : `Imported ${converted.length}`);
  };

  // Assignments
  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!meRes.ok) {
        toast.error(ar ? "يجب تسجيل الدخول" : "Please log in");
        setAssignOpen(false);
        return;
      }
      const me = await meRes.json();
      const teacherId = me.teacherId || me.id;
      const res = await fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}&include=shared`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.filter((a: { questionCount: number }) => a.questionCount > 0));
      }
    } catch { /* ignore */ } finally { setAssignLoading(false); }
  }, [ar]);

  const loadAssignmentQuestions = useCallback(async (assignmentId: number) => {
    setAssignQLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const qs = (data.questions || [])
          .filter((q: { questionType?: string; optionA?: string; correctAnswer?: string }) => q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)
          .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }) => ({
            id: q.id, subject: data.subject || "", text: q.text,
            optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
            correctAnswer: q.correctAnswer, points: 1, tags: null,
          } as BankQuestion));
        setAssignQuestions(qs);
      }
    } catch { /* ignore */ } finally { setAssignQLoading(false); }
  }, []);

  useEffect(() => {
    if (assignOpen) { loadAssignments(); setAssignSelected(new Set()); setAssignExpandedId(null); setAssignQuestions([]); }
  }, [assignOpen, loadAssignments]);

  const importAssignSelected = () => {
    const selected = assignQuestions.filter(q => assignSelected.has(q.id));
    if (selected.length === 0) return;
    const converted = selected.map(bankToRocket);
    const hasEmpty = questions.length === 1 && !questions[0].text.trim();
    const merged = (hasEmpty ? converted : [...questions, ...converted]).slice(0, 30);
    setQuestions(merged);
    setAssignOpen(false);
    toast.success(ar ? `تم استيراد ${converted.length} سؤال من الواجب` : `Imported ${converted.length} from assignment`);
  };

  // Templates
  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rocket-templates`, { credentials: "include" });
      if (!res.ok) {
        toast.error(ar ? "خطأ في تحميل القوالب" : "Error loading templates");
        return;
      }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } finally { setSavedLoading(false); }
  };

  const handleSave = async () => {
    if (!saveTitle.trim()) { toast.error(ar ? "أدخل اسم اللعبة" : "Enter a name"); return; }
    if (!isValid) { toast.error(ar ? "املأ جميع الأسئلة أولاً" : "Fill all questions first"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/rocket-templates`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: saveTitle.trim(), questions, duration }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم حفظ اللعبة!" : "Saved!");
      setSaveTitle(""); setShowSaveInput(false);
    } catch { toast.error(ar ? "خطأ في الحفظ" : "Save error"); }
    finally { setSaving(false); }
  };

  const handleLoadTemplate = (t: typeof savedTemplates[0]) => {
    setQuestions(t.questions);
    setDuration(t.duration);
    setSavedOpen(false);
    toast.success(ar ? `تم تحميل "${t.title}"` : `Loaded "${t.title}"`);
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/rocket-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch { toast.error(ar ? "خطأ في الحذف" : "Delete error"); }
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.includes(bankSearch) || q.subject.includes(bankSearch) || (q.tags && q.tags.includes(bankSearch)))
    : bankQuestions;

  const optionLetters = ["أ", "ب", "ج", "د"];

  const TYPE_LABELS: Record<QType, { ar: string; en: string; icon: typeof ListChecks }> = {
    mcq: { ar: "اختيار من متعدد", en: "Multiple Choice", icon: ListChecks },
    true_false: { ar: "صح أو خطأ", en: "True/False", icon: CheckCircle2 },
    fill_blank: { ar: "املأ الفراغ", en: "Fill Blank", icon: Type },
  };

  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-screen py-8 px-4"
        style={{
          background: "linear-gradient(180deg, #FCFAF8 0%, #F4EBD9 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{
                background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #2d6a45 100%)`,
                boxShadow: `0 12px 32px -8px ${BRAND_PRIMARY}66`,
              }}
            >
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: BRAND_PRIMARY }}>
              {ar ? "أنشئ سباق الصواريخ" : "Create Rocket Race"}
            </h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>
              {ar ? "كلما أجاب الطالب أسرع وأصح، صعد صاروخه أعلى!" : "Faster correct answers = higher rocket!"}
            </p>
          </motion.div>

          {/* Title */}
          <Card className="p-4 mb-3 flex items-center gap-3">
            <span className="text-xl">📛</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={ar ? "اسم السباق (اختياري)" : "Race title (optional)"}
              className="flex-1 bg-transparent outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground/60"
              maxLength={60}
            />
          </Card>

          {/* Duration */}
          <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
            <Clock className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
            <span className="font-bold text-sm flex-1">{ar ? "وقت كل سؤال" : "Time per question"}</span>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30, 45].map(s => (
                <button
                  key={s}
                  onClick={() => setDuration(s)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all border"
                  style={{
                    background: duration === s ? BRAND_PRIMARY : "#fff",
                    color: duration === s ? "#fff" : "#374151",
                    borderColor: duration === s ? BRAND_PRIMARY : "#e5e7eb",
                  }}
                >
                  {s}{ar ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          {/* Target class */}
          {gradeLevels.length > 0 && (
            <Card className="p-4 mb-3 flex items-center gap-4 flex-wrap">
              <GraduationCap className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
              <span className="font-bold text-sm flex-1">{ar ? "الصف المستهدف" : "Target class"}</span>
              <select
                value={targetClass}
                onChange={e => setTargetClass(e.target.value)}
                className="min-w-[160px] max-w-[260px] rounded-lg border bg-background px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: "#e5e7eb" }}
              >
                <option value="">{ar ? "— جميع الصفوف —" : "— All classes —"}</option>
                {gradeLevels.map(g => (
                  <option key={g.gradeLevel} value={g.gradeLevel}>
                    {g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})
                  </option>
                ))}
              </select>
            </Card>
          )}

          {/* Source buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setBankOpen(true)}
              className="py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: BRAND_PRIMARY }}
            >
              <BookOpen className="w-4 h-4" />
              {ar ? "بنك الأسئلة" : "Question Bank"}
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: BRAND_GOLD }}
            >
              <FileText className="w-4 h-4" />
              {ar ? "من واجب" : "From Assignment"}
            </button>
            <button
              onClick={() => { setSavedOpen(true); loadTemplates(); }}
              className="py-3 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center gap-2 col-span-2"
              style={{ background: "#fff", color: BRAND_PRIMARY, borderColor: BRAND_PRIMARY }}
            >
              <FolderOpen className="w-4 h-4" />
              {ar ? "السباقات المحفوظة" : "Saved Races"}
            </button>
          </div>

          {/* Question list */}
          <div className="space-y-3 mb-4">
            <AnimatePresence>
              {questions.map((q, qIdx) => {
                const Icon = TYPE_LABELS[q.type].icon;
                return (
                  <motion.div
                    key={qIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card className="overflow-hidden">
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === qIdx ? -1 : qIdx)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                          style={{ background: `${BRAND_PRIMARY}15`, color: BRAND_PRIMARY }}
                        >
                          {qIdx + 1}
                        </div>
                        <Icon className="w-4 h-4 shrink-0" style={{ color: BRAND_GOLD }} />
                        <span className="flex-1 text-start text-sm font-bold truncate">
                          {q.text || (ar ? "سؤال جديد..." : "New question...")}
                        </span>
                        <div className="flex items-center gap-2">
                          {questions.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeQuestion(qIdx); }}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {expandedIdx === qIdx ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedIdx === qIdx && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border"
                          >
                            <div className="p-4 space-y-4">
                              {/* Type chooser */}
                              <div className="flex gap-2 flex-wrap">
                                {(Object.keys(TYPE_LABELS) as QType[]).map(t => {
                                  const TIcon = TYPE_LABELS[t].icon;
                                  return (
                                    <button
                                      key={t}
                                      onClick={() => changeType(qIdx, t)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5"
                                      style={{
                                        background: q.type === t ? BRAND_PRIMARY : "#fff",
                                        color: q.type === t ? "#fff" : "#374151",
                                        borderColor: q.type === t ? BRAND_PRIMARY : "#e5e7eb",
                                      }}
                                    >
                                      <TIcon className="w-3.5 h-3.5" />
                                      {ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Text */}
                              <div>
                                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                  {ar ? "نص السؤال" : "Question text"}
                                </label>
                                <textarea
                                  value={q.text}
                                  onChange={e => updateQuestion(qIdx, { text: e.target.value })}
                                  placeholder={
                                    q.type === "fill_blank"
                                      ? (ar ? "اكتب السؤال واترك فراغاً للإجابة..." : "Write question with blank...")
                                      : (ar ? "اكتب السؤال هنا..." : "Write your question here...")
                                  }
                                  rows={2}
                                  className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 outline-none transition-all resize-none"
                                  style={{ borderColor: "#e5e7eb" }}
                                />
                              </div>

                              {/* MCQ options */}
                              {q.type === "mcq" && (
                                <div>
                                  <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                                    {ar ? "الخيارات (اضغط لتحديد الإجابة الصحيحة)" : "Options (click to mark correct)"}
                                  </label>
                                  <div className="grid grid-cols-1 gap-2">
                                    {q.options.map((opt, oIdx) => (
                                      <div
                                        key={oIdx}
                                        className="flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer"
                                        style={{
                                          borderColor: q.correct === oIdx ? BRAND_PRIMARY : "#e5e7eb",
                                          background: q.correct === oIdx ? `${BRAND_PRIMARY}10` : "#fff",
                                        }}
                                        onClick={() => updateQuestion(qIdx, { correct: oIdx })}
                                      >
                                        <span
                                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                                          style={{
                                            background: q.correct === oIdx ? BRAND_PRIMARY : "#f3f4f6",
                                            color: q.correct === oIdx ? "#fff" : "#6b7280",
                                          }}
                                        >
                                          {optionLetters[oIdx]}
                                        </span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={e => { e.stopPropagation(); updateOption(qIdx, oIdx, e.target.value); }}
                                          onClick={e => e.stopPropagation()}
                                          placeholder={ar ? `الخيار ${optionLetters[oIdx]}` : `Option ${["A", "B", "C", "D"][oIdx]}`}
                                          className="flex-1 text-sm bg-transparent outline-none"
                                        />
                                        {q.correct === oIdx && (
                                          <span className="text-xs font-bold shrink-0" style={{ color: BRAND_PRIMARY }}>
                                            ✓ {ar ? "صحيح" : "Correct"}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* True/False */}
                              {q.type === "true_false" && (
                                <div>
                                  <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                                    {ar ? "الإجابة الصحيحة" : "Correct answer"}
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { idx: 0, label: ar ? "صحيح" : "True", icon: CheckCircle2, color: "#16a34a" },
                                      { idx: 1, label: ar ? "خطأ" : "False", icon: XCircle, color: "#dc2626" },
                                    ].map(({ idx, label, icon: TFI, color }) => (
                                      <button
                                        key={idx}
                                        onClick={() => updateQuestion(qIdx, { correct: idx })}
                                        className="p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold"
                                        style={{
                                          borderColor: q.correct === idx ? color : "#e5e7eb",
                                          background: q.correct === idx ? `${color}10` : "#fff",
                                          color: q.correct === idx ? color : "#6b7280",
                                        }}
                                      >
                                        <TFI className="w-5 h-5" />
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Fill blank */}
                              {q.type === "fill_blank" && (
                                <div>
                                  <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                                    {ar ? "الإجابة الصحيحة" : "Correct answer"}
                                  </label>
                                  <input
                                    type="text"
                                    value={q.correctText || ""}
                                    onChange={e => updateQuestion(qIdx, { correctText: e.target.value })}
                                    placeholder={ar ? "الإجابة الصحيحة..." : "Correct answer..."}
                                    className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 outline-none mb-2"
                                    style={{ borderColor: "#e5e7eb" }}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    {ar ? "💡 تلميح: تستطيع كتابة إجابات بديلة في الخيارات (تفصلها بفواصل)" : "Tip: Add alternate answers in options"}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Add buttons */}
          {questions.length < 30 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(Object.keys(TYPE_LABELS) as QType[]).map(t => {
                const TIcon = TYPE_LABELS[t].icon;
                return (
                  <button
                    key={t}
                    onClick={() => addQuestion(t)}
                    className="py-3 rounded-xl border-2 border-dashed font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    style={{ borderColor: `${BRAND_PRIMARY}66`, color: BRAND_PRIMARY, background: "#fff" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <TIcon className="w-3.5 h-3.5" />
                    {ar ? TYPE_LABELS[t].ar : TYPE_LABELS[t].en}
                  </button>
                );
              })}
            </div>
          )}

          {/* Save input */}
          <AnimatePresence>
            {showSaveInput && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                <div className="flex gap-2">
                  <input
                    value={saveTitle}
                    onChange={e => setSaveTitle(e.target.value)}
                    placeholder={ar ? "اسم السباق المحفوظ..." : "Race name..."}
                    className="flex-1 text-sm py-2.5 px-3 rounded-xl bg-background border-2 outline-none"
                    style={{ borderColor: "#e5e7eb" }}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="py-2.5 px-5 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center gap-1.5"
                    style={{ background: BRAND_PRIMARY }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {ar ? "حفظ" : "Save"}
                  </button>
                  <button onClick={() => setShowSaveInput(false)} className="py-2.5 px-3 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowSaveInput(true)}
              disabled={!isValid}
              className="py-4 px-5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: BRAND_PRIMARY }}
            >
              <Save className="w-5 h-5" />
              {ar ? "حفظ" : "Save"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleCreate}
              disabled={creating || !isValid}
              className="flex-1 py-4 rounded-2xl font-black text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              style={{
                background: `linear-gradient(135deg, ${BRAND_GOLD} 0%, #c89212 100%)`,
                boxShadow: `0 12px 28px -8px ${BRAND_GOLD}80`,
              }}
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {ar ? "جاري الإنشاء..." : "Creating..."}
                </span>
              ) : (
                <>
                  <Rocket className="w-6 h-6" />
                  {ar ? "أطلق السباق!" : "Launch Race!"}
                  <ArrowRight className={`w-5 h-5 ${ar ? "rotate-180" : ""}`} />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Bank modal */}
      <AnimatePresence>
        {bankOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBankOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
                  <BookOpen className="w-5 h-5" />
                  {ar ? "بنك الأسئلة" : "Question Bank"}
                </h3>
                <button onClick={() => setBankOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <input
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  placeholder={ar ? "بحث..." : "Search..."}
                  className="w-full py-2 px-3 rounded-xl border-2 text-sm"
                  style={{ borderColor: "#e5e7eb" }}
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {bankLoading && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {ar ? "جاري التحميل..." : "Loading..."}
                  </div>
                )}
                {!bankLoading && filteredBank.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {ar ? "لا توجد أسئلة" : "No questions"}
                  </div>
                )}
                {filteredBank.map(q => {
                  const checked = bankSelected.has(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        const next = new Set(bankSelected);
                        if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                        setBankSelected(next);
                      }}
                      className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                      style={{
                        borderColor: checked ? BRAND_PRIMARY : "#e5e7eb",
                        background: checked ? `${BRAND_PRIMARY}10` : "#fff",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: checked ? BRAND_PRIMARY : "#d1d5db", background: checked ? BRAND_PRIMARY : "#fff" }}>
                          {checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold line-clamp-2">{q.text}</p>
                          {q.subject && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>
                              {q.subject}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t flex gap-2" style={{ borderColor: "#e5e7eb" }}>
                <button onClick={() => setBankOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 font-bold text-sm">
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={importBankSelected}
                  disabled={bankSelected.size === 0}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                  style={{ background: BRAND_PRIMARY }}
                >
                  {ar ? `استيراد (${bankSelected.size})` : `Import (${bankSelected.size})`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assignments modal */}
      <AnimatePresence>
        {assignOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BRAND_GOLD }}>
                  <FileText className="w-5 h-5" />
                  {ar ? "استيراد من واجب" : "Import from Assignment"}
                </h3>
                <button onClick={() => setAssignOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  </div>
                )}
                {!assignLoading && assignments.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {ar ? "لا توجد واجبات" : "No assignments"}
                  </div>
                )}
                {assignments.map(a => (
                  <div key={a.id} className="rounded-xl border-2 overflow-hidden" style={{ borderColor: "#e5e7eb" }}>
                    <button
                      onClick={() => {
                        if (assignExpandedId === a.id) { setAssignExpandedId(null); return; }
                        setAssignExpandedId(a.id);
                        setAssignSelected(new Set());
                        loadAssignmentQuestions(a.id);
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50"
                    >
                      <div className="flex-1 text-start">
                        <p className="text-sm font-bold">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                      </div>
                      {assignExpandedId === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {assignExpandedId === a.id && (
                      <div className="border-t p-3 space-y-2" style={{ borderColor: "#e5e7eb" }}>
                        {assignQLoading && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
                        {!assignQLoading && assignQuestions.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center">{ar ? "لا توجد أسئلة اختيار من متعدد" : "No MCQ questions"}</p>
                        )}
                        {assignQuestions.map(q => {
                          const checked = assignSelected.has(q.id);
                          return (
                            <div
                              key={q.id}
                              onClick={() => {
                                const next = new Set(assignSelected);
                                if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                                setAssignSelected(next);
                              }}
                              className="p-2 rounded-lg border-2 cursor-pointer flex items-start gap-2"
                              style={{
                                borderColor: checked ? BRAND_GOLD : "#e5e7eb",
                                background: checked ? `${BRAND_GOLD}15` : "#fff",
                              }}
                            >
                              <div className="w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                                style={{ borderColor: checked ? BRAND_GOLD : "#d1d5db", background: checked ? BRAND_GOLD : "#fff" }}>
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <p className="text-xs font-medium line-clamp-2 flex-1">{q.text}</p>
                            </div>
                          );
                        })}
                        {assignQuestions.length > 0 && (
                          <button
                            onClick={importAssignSelected}
                            disabled={assignSelected.size === 0}
                            className="w-full py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                            style={{ background: BRAND_GOLD }}
                          >
                            {ar ? `استيراد (${assignSelected.size})` : `Import (${assignSelected.size})`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved templates modal */}
      <AnimatePresence>
        {savedOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSavedOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: BRAND_PRIMARY }}>
                  <FolderOpen className="w-5 h-5" />
                  {ar ? "السباقات المحفوظة" : "Saved Races"}
                </h3>
                <button onClick={() => setSavedOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {savedLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                {!savedLoading && savedTemplates.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد سباقات محفوظة" : "No saved races"}</p>
                )}
                {savedTemplates.map(t => (
                  <div key={t.id} className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.questions.length} {ar ? "سؤال" : "questions"}
                        {t.fromAdmin && (
                          <span className="ml-2 px-2 py-0.5 rounded" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>
                            {ar ? "من المنصة" : "Platform"}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadTemplate(t)}
                      className="px-3 py-1.5 rounded-lg text-white font-bold text-xs"
                      style={{ background: BRAND_PRIMARY }}
                    >
                      {ar ? "تحميل" : "Load"}
                    </button>
                    {t.isOwn && (
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
