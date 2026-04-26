import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Play, ArrowRight, Clock, ChevronDown, ChevronUp, Sparkles, BookOpen, Search, Check, X, Loader2, FileText, Save, FolderOpen, GraduationCap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getTugSocket } from "@/lib/tug-socket";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TugQuestion {
  text: string;
  options: string[];
  correct: number;
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

const BLANK_QUESTION = (): TugQuestion => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
});

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToTug = (bq: BankQuestion): TugQuestion => ({
  text: bq.text,
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
});

export default function TugCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<TugQuestion[]>([BLANK_QUESTION()]);
  const [duration, setDuration] = useState(20);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiLoading, setAiLoading] = useState(false);

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
  const [savedTemplates, setSavedTemplates] = useState<{ id: number; title: string; questions: TugQuestion[]; duration: number; createdAt: string; isOwn?: boolean; ownerName?: string | null; fromAdmin?: boolean }[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGradeLevels(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  /* Deep-link auto-load from a presentation-launched assignment.
     Reads ?assignmentId=N from URL and fills the questions list. */
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
          .filter((q) =>
            q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map((q) =>
            bankToTug({
              id: 0, subject: data.subject || "", text: q.text || "",
              optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
              correctAnswer: q.correctAnswer || "A", points: 1, tags: null,
            } as BankQuestion))
          .slice(0, 20);
        if (qs.length > 0) {
          setQuestions(qs);
          if (data.title) {
            toast.success(lang === "ar"
              ? `تم تحميل ${qs.length} سؤال من العرض!`
              : `Loaded ${qs.length} questions from presentation!`);
          }
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tug-templates`, { credentials: "include" });
      if (res.status === 401) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول أولاً" : "Please log in first");
        return;
      }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } catch {
      toast.error(lang === "ar" ? "خطأ في تحميل القوالب" : "Error loading templates");
    } finally {
      setSavedLoading(false);
    }
  };

  const handleSave = async () => {
    if (!saveTitle.trim()) {
      toast.error(lang === "ar" ? "أدخل اسم اللعبة" : "Enter a name");
      return;
    }
    if (!isValid) {
      toast.error(lang === "ar" ? "يرجى ملء جميع الأسئلة والخيارات أولاً" : "Fill all questions first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/tug-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: saveTitle.trim(), questions, duration }),
      });
      if (res.status === 401) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول أولاً" : "Please log in first");
        return;
      }
      if (!res.ok) throw new Error();
      toast.success(lang === "ar" ? "تم حفظ اللعبة بنجاح!" : "Game saved!");
      setSaveTitle("");
      setShowSaveInput(false);
    } catch {
      toast.error(lang === "ar" ? "خطأ في الحفظ" : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = (t: typeof savedTemplates[0]) => {
    setQuestions(t.questions as TugQuestion[]);
    setDuration(t.duration);
    setSavedOpen(false);
    toast.success(lang === "ar" ? `تم تحميل "${t.title}"` : `Loaded "${t.title}"`);
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/tug-templates/${id}`, { method: "DELETE", credentials: "include" });
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    } catch {
      toast.error(lang === "ar" ? "خطأ في الحذف" : "Delete error");
    }
  };

  const addQuestion = () => {
    if (questions.length >= 20) return;
    const newQ = BLANK_QUESTION();
    setQuestions((q) => [...q, newQ]);
    setExpandedIdx(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((q) => q.filter((_, i) => i !== idx));
    setExpandedIdx(Math.max(0, idx - 1));
  };

  const updateQuestion = (idx: number, field: keyof TugQuestion, value: string | number | string[]) => {
    setQuestions((q) =>
      q.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((q) =>
      q.map((item, i) => {
        if (i !== qIdx) return item;
        const opts = [...item.options];
        opts[oIdx] = value;
        return { ...item, options: opts };
      })
    );
  };

  const isValid = questions.every(
    (q) => q.text.trim() && q.options.every((o) => o.trim())
  );

  const handleCreate = () => {
    if (!isValid) {
      toast.error(lang === "ar" ? "يرجى ملء جميع الأسئلة والخيارات." : "Please fill all questions and options.");
      return;
    }
    setCreating(true);
    const socket = getTugSocket();
    socket.emit("tug:create", { questions, duration, autoAdvance, targetClass: targetClass || undefined }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.pin && res.creatorToken) {
        sessionStorage.setItem(`tug-creator-${res.pin}`, res.creatorToken);
        setLocation(`/game/tug/play/${res.pin}?creator=1`);
      }
    });
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      toast.error(lang === "ar" ? "اكتب موضوع الأسئلة أولاً" : "Enter a topic first");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: aiTopic.trim(), count: aiCount, difficulty: aiDifficulty }),
      });
      if (res.status === 401) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول أولاً لاستخدام هذه الميزة" : "Please log in first to use this feature");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || (lang === "ar" ? "خطأ في التوليد" : "Generation error"));
        return;
      }
      const generated: TugQuestion[] = (data.questions || []).map((q: {
        text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string;
      }) => ({
        text: q.text,
        options: [q.optionA, q.optionB, q.optionC, q.optionD],
        correct: correctAnswerToIndex(q.correctAnswer),
      }));
      if (generated.length === 0) {
        toast.error(lang === "ar" ? "لم يتم توليد أسئلة" : "No questions generated");
        return;
      }
      const hasEmpty = questions.length === 1 && !questions[0].text.trim();
      const newQuestions = hasEmpty ? generated : [...questions, ...generated];
      setQuestions(newQuestions.slice(0, 20));
      setAiOpen(false);
      setAiTopic("");
      toast.success(lang === "ar" ? `تم إضافة ${generated.length} سؤال بنجاح!` : `Added ${generated.length} questions!`);
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setAiLoading(false);
    }
  };

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول أولاً لاستخدام بنك الأسئلة" : "Please log in first to use the question bank");
        setBankOpen(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data.filter((q: BankQuestion) => q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer));
      }
    } catch { /* ignore */ } finally { setBankLoading(false); }
  }, [lang]);

  useEffect(() => {
    if (bankOpen) { loadBank(); setBankSelected(new Set()); setBankSearch(""); }
  }, [bankOpen, loadBank]);

  const toggleBankSelect = (id: number) => {
    setBankSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const importSelected = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    if (selected.length === 0) return;
    const converted = selected.map(bankToTug);
    const hasEmpty = questions.length === 1 && !questions[0].text.trim();
    const newQuestions = hasEmpty ? converted : [...questions, ...converted];
    setQuestions(newQuestions.slice(0, 20));
    setBankOpen(false);
    toast.success(lang === "ar" ? `تم استيراد ${converted.length} سؤال!` : `Imported ${converted.length} questions!`);
  };

  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (meRes.status === 401 || !meRes.ok) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول أولاً" : "Please log in first");
        setAssignOpen(false);
        return;
      }
      const me = await meRes.json();
      const teacherId = me.teacherId || me.id;
      if (!teacherId) {
        toast.error(lang === "ar" ? "يجب تسجيل الدخول كمعلم" : "Must be logged in as teacher");
        setAssignOpen(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}&include=shared`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(
          data
            .filter((a: { questionCount: number }) => a.questionCount > 0)
            .map((a: { id: number; title: string; subject: string; questionCount: number; isOwn?: boolean; ownerName?: string | null }) => ({
              id: a.id,
              title: a.title,
              subject: a.subject || "",
              questionCount: a.questionCount,
              isOwn: a.isOwn,
              ownerName: a.ownerName,
            })),
        );
      }
    } catch { /* ignore */ } finally { setAssignLoading(false); }
  }, [lang]);

  const loadAssignmentQuestions = useCallback(async (assignmentId: number) => {
    setAssignQLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const qs = (data.questions || [])
          .filter((q: { questionType?: string; optionA?: string; correctAnswer?: string }) =>
            q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer
          )
          .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; points: number }) => ({
            id: q.id, subject: data.subject || "", text: q.text,
            optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
            correctAnswer: q.correctAnswer, points: q.points || 1, tags: null,
          } as BankQuestion));
        setAssignQuestions(qs);
      }
    } catch { /* ignore */ } finally { setAssignQLoading(false); }
  }, []);

  useEffect(() => {
    if (assignOpen) { loadAssignments(); setAssignSelected(new Set()); setAssignExpandedId(null); setAssignQuestions([]); }
  }, [assignOpen, loadAssignments]);

  const handleExpandAssignment = (id: number) => {
    if (assignExpandedId === id) { setAssignExpandedId(null); return; }
    setAssignExpandedId(id);
    setAssignSelected(new Set());
    loadAssignmentQuestions(id);
  };

  const toggleAssignSelect = (id: number) => {
    setAssignSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const importAssignSelected = () => {
    const selected = assignQuestions.filter(q => assignSelected.has(q.id));
    if (selected.length === 0) return;
    const converted = selected.map(bankToTug);
    const hasEmpty = questions.length === 1 && !questions[0].text.trim();
    const newQuestions = hasEmpty ? converted : [...questions, ...converted];
    setQuestions(newQuestions.slice(0, 20));
    setAssignOpen(false);
    toast.success(lang === "ar" ? `تم استيراد ${converted.length} سؤال من الواجب!` : `Imported ${converted.length} questions from assignment!`);
  };

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q =>
      q.text.includes(bankSearch) || q.subject.includes(bankSearch) || (q.tags && q.tags.includes(bankSearch))
    )
    : bankQuestions;

  const groupedBank = filteredBank.reduce<Record<string, BankQuestion[]>>((acc, q) => {
    const key = q.subject || (lang === "ar" ? "بدون مادة" : "No subject");
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const optionLetters = ["أ", "ب", "ج", "د"];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-2xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/40 mb-4">
              <span className="text-4xl">🪢</span>
            </div>
            <h1 className="text-3xl font-black text-foreground mb-1">
              {lang === "ar" ? "أنشئ لعبة شد الحبل" : "Create Tug of War"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {lang === "ar" ? "أضف الأسئلة وابدأ المنافسة بين الفريقين!" : "Add questions and let the teams compete!"}
            </p>
          </motion.div>

          <Card className="p-4 mb-4 flex items-center gap-4 flex-wrap">
            <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
            <span className="font-bold text-sm text-foreground flex-1">
              {lang === "ar" ? "وقت كل سؤال" : "Time per question"}
            </span>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30].map((s) => (
                <button
                  key={s}
                  onClick={() => setDuration(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    duration === s
                      ? "bg-indigo-600 text-white shadow-lg"
                      : "bg-background border border-border text-muted-foreground hover:border-indigo-400"
                  }`}
                >
                  {s}{lang === "ar" ? "ث" : "s"}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 mb-4 flex items-center gap-4">
            <span className="text-lg">⏭</span>
            <span className="font-bold text-sm text-foreground flex-1">
              {lang === "ar" ? "تقدم تلقائي بعد كل سؤال" : "Auto-advance after each question"}
            </span>
            <button
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                autoAdvance ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <motion.div
                animate={{ x: autoAdvance ? 20 : 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-100 shadow"
              />
            </button>
          </Card>

          {gradeLevels.length > 0 && (
            <Card className="p-4 mb-4 flex items-center gap-4 flex-wrap">
              <GraduationCap className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="font-bold text-sm text-foreground flex-1">
                {lang === "ar" ? "الصف المستهدف" : "Target class"}
              </span>
              <select
                value={targetClass}
                onChange={e => setTargetClass(e.target.value)}
                className="min-w-[160px] max-w-[260px] rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{lang === "ar" ? "— جميع الصفوف —" : "— All classes —"}</option>
                {gradeLevels.map(g => (
                  <option key={g.gradeLevel} value={g.gradeLevel}>
                    {g.gradeLevel} ({g.count} {lang === "ar" ? "طالب" : "students"})
                  </option>
                ))}
              </select>
            </Card>
          )}

          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setAiOpen(true)}
              className="flex-1 min-w-[120px] py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {lang === "ar" ? "توليد AI" : "AI Generate"}
            </button>
            <button
              onClick={() => setBankOpen(true)}
              className="flex-1 min-w-[120px] py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {lang === "ar" ? "بنك الأسئلة" : "Question Bank"}
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="flex-1 min-w-[120px] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {lang === "ar" ? "استيراد من واجب" : "From Assignment"}
            </button>
            <button
              onClick={() => { setSavedOpen(true); loadTemplates(); }}
              className="flex-1 min-w-[120px] py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all flex items-center justify-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              {lang === "ar" ? "ألعاب محفوظة" : "Saved Games"}
            </button>
          </div>

          <div className="space-y-3 mb-4">
            <AnimatePresence>
              {questions.map((q, qIdx) => (
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
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0">
                        {qIdx + 1}
                      </div>
                      <span className="flex-1 text-start text-sm font-bold text-foreground truncate">
                        {q.text || (lang === "ar" ? "سؤال جديد..." : "New question...")}
                      </span>
                      <div className="flex items-center gap-2">
                        {questions.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeQuestion(qIdx); }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                            <div>
                              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                {lang === "ar" ? "نص السؤال" : "Question text"}
                              </label>
                              <textarea
                                value={q.text}
                                onChange={(e) => updateQuestion(qIdx, "text", e.target.value)}
                                placeholder={lang === "ar" ? "اكتب السؤال هنا..." : "Write your question here..."}
                                rows={2}
                                className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 border-border focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">
                                {lang === "ar" ? "الخيارات (اضغط للتحديد كإجابة صحيحة)" : "Options (click to mark as correct)"}
                              </label>
                              <div className="grid grid-cols-1 gap-2">
                                {q.options.map((opt, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${
                                      q.correct === oIdx
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                        : "border-border hover:border-indigo-300"
                                    }`}
                                    onClick={() => updateQuestion(qIdx, "correct", oIdx)}
                                  >
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                      q.correct === oIdx
                                        ? "bg-green-500 text-white"
                                        : "bg-muted text-muted-foreground"
                                    }`}>
                                      {optionLetters[oIdx]}
                                    </span>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => { e.stopPropagation(); updateOption(qIdx, oIdx, e.target.value); }}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder={lang === "ar" ? `الخيار ${optionLetters[oIdx]}` : `Option ${["A","B","C","D"][oIdx]}`}
                                      className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                                    />
                                    {q.correct === oIdx && (
                                      <span className="text-green-600 text-xs font-bold shrink-0">
                                        {lang === "ar" ? "✓ صحيح" : "✓ Correct"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {questions.length < 20 && (
            <button
              onClick={addQuestion}
              className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-500 dark:text-indigo-400 font-bold text-sm hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2 mb-6"
            >
              <Plus className="w-4 h-4" />
              {lang === "ar" ? "أضف سؤالاً" : "Add question"}
              <span className="text-xs text-muted-foreground font-normal">({questions.length}/20)</span>
            </button>
          )}

          <AnimatePresence>
            {showSaveInput && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                <div className="flex gap-2">
                  <input
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder={lang === "ar" ? "اسم اللعبة المحفوظة..." : "Saved game name..."}
                    className="flex-1 text-sm py-2.5 px-3 rounded-xl bg-background border-2 border-border focus:border-cyan-500 outline-none"
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                  <button onClick={handleSave} disabled={saving}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {lang === "ar" ? "حفظ" : "Save"}
                  </button>
                  <button onClick={() => setShowSaveInput(false)} className="py-2.5 px-3 rounded-xl bg-muted text-muted-foreground hover:bg-muted/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowSaveInput(true)}
              disabled={!isValid}
              className="py-4 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {lang === "ar" ? "حفظ" : "Save"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleCreate}
              disabled={creating || !isValid}
              className="flex-1 py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {lang === "ar" ? "جاري الإنشاء..." : "Creating..."}
                </span>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  {lang === "ar" ? "أنشئ الغرفة وابدأ!" : "Create Room & Start!"}
                  <ArrowRight className={`w-5 h-5 ${lang === "ar" ? "rotate-180" : ""}`} />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !aiLoading && setAiOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              dir={dir}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <h2 className="font-black text-lg">
                      {lang === "ar" ? "توليد أسئلة بالذكاء الاصطناعي" : "AI Question Generator"}
                    </h2>
                  </div>
                  <button onClick={() => !aiLoading && setAiOpen(false)} className="p-1 rounded-lg hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                    {lang === "ar" ? "الموضوع" : "Topic"}
                  </label>
                  <textarea
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder={lang === "ar" ? "مثال: الكسور العشرية للصف الخامس..." : "e.g., Fractions for 5th grade..."}
                    rows={2}
                    className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 border-border focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                      {lang === "ar" ? "العدد" : "Count"}
                    </label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 border-border focus:border-purple-500 outline-none"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">
                      {lang === "ar" ? "الصعوبة" : "Difficulty"}
                    </label>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value as "easy" | "medium" | "hard")}
                      className="w-full text-sm py-2.5 px-3 rounded-xl bg-background border-2 border-border focus:border-purple-500 outline-none"
                    >
                      <option value="easy">{lang === "ar" ? "سهل" : "Easy"}</option>
                      <option value="medium">{lang === "ar" ? "متوسط" : "Medium"}</option>
                      <option value="hard">{lang === "ar" ? "صعب" : "Hard"}</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiTopic.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {lang === "ar" ? "جاري التوليد..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {lang === "ar" ? "توليد الأسئلة" : "Generate Questions"}
                    </>
                  )}
                </button>

                {questions.length > 0 && questions[0].text.trim() && (
                  <p className="text-xs text-muted-foreground text-center">
                    {lang === "ar"
                      ? `سيتم إضافة الأسئلة الجديدة إلى الحالية (${questions.length}/20)`
                      : `New questions will be added to existing (${questions.length}/20)`}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bankOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBankOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              dir={dir}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    <h2 className="font-black text-lg">
                      {lang === "ar" ? "استيراد من بنك الأسئلة" : "Import from Question Bank"}
                    </h2>
                  </div>
                  <button onClick={() => setBankOpen(false)} className="p-1 rounded-lg hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder={lang === "ar" ? "بحث في بنك الأسئلة..." : "Search question bank..."}
                    className="w-full text-sm py-2.5 px-3 pe-10 rounded-xl bg-background border-2 border-border focus:border-teal-500 outline-none"
                  />
                </div>
                {bankSelected.size > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-teal-600 font-bold">
                      {lang === "ar" ? `تم اختيار ${bankSelected.size} سؤال` : `${bankSelected.size} selected`}
                    </span>
                    <button
                      onClick={importSelected}
                      className="py-1.5 px-4 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      {lang === "ar" ? "استيراد المحدد" : "Import Selected"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {bankLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  </div>
                ) : filteredBank.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {lang === "ar" ? "لا توجد أسئلة في البنك" : "No questions in bank"}
                  </div>
                ) : (
                  Object.entries(groupedBank).map(([subject, subjectQuestions]) => (
                    <div key={subject} className="mb-3">
                      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 px-2 mb-1.5 rounded-lg border border-border/50">
                        <span className="text-xs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wide">{subject}</span>
                        <span className="text-[10px] text-muted-foreground ms-2">({subjectQuestions.length})</span>
                      </div>
                      <div className="space-y-2">
                        {subjectQuestions.map((bq) => (
                          <div
                            key={bq.id}
                            onClick={() => toggleBankSelect(bq.id)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              bankSelected.has(bq.id)
                                ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                                : "border-border hover:border-teal-300"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                bankSelected.has(bq.id)
                                  ? "border-teal-500 bg-teal-500 text-white"
                                  : "border-border"
                              }`}>
                                {bankSelected.has(bq.id) && <Check className="w-3 h-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">{bq.text}</p>
                                {bq.tags && (
                                  <div className="mt-1">
                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{bq.tags}</span>
                                  </div>
                                )}
                                <div className="mt-1.5 grid grid-cols-2 gap-1">
                                  {[bq.optionA, bq.optionB, bq.optionC, bq.optionD].map((opt, i) => (
                                    <span
                                      key={i}
                                      className={`text-[11px] px-2 py-0.5 rounded-md truncate ${
                                        bq.correctAnswer === ["A","B","C","D"][i]
                                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold"
                                          : "bg-muted/60 text-muted-foreground"
                                      }`}
                                    >
                                      {optionLetters[i]}) {opt || "—"}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {assignOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              dir={dir}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <h2 className="font-black text-lg">
                      {lang === "ar" ? "استيراد من واجب" : "Import from Assignment"}
                    </h2>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="p-1 rounded-lg hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {assignSelected.size > 0 && (
                <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                  <span className="text-xs text-amber-600 font-bold">
                    {lang === "ar" ? `تم اختيار ${assignSelected.size} سؤال` : `${assignSelected.size} selected`}
                  </span>
                  <button
                    onClick={importAssignSelected}
                    className="py-1.5 px-4 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    {lang === "ar" ? "استيراد المحدد" : "Import Selected"}
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {lang === "ar" ? "لا توجد واجبات" : "No assignments found"}
                  </div>
                ) : (
                  (() => {
                    const own = assignments.filter(a => a.isOwn !== false);
                    const shared = assignments.filter(a => a.isOwn === false);
                    const renderItem = (a: typeof assignments[number]) => (
                      <div key={a.id} className="border rounded-xl overflow-hidden">
                        <button
                          onClick={() => handleExpandAssignment(a.id)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-start"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{a.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {a.subject && `${a.subject} · `}{a.questionCount} {lang === "ar" ? "سؤال" : "questions"}
                              {a.isOwn === false && a.ownerName ? ` (${a.ownerName})` : ""}
                            </p>
                          </div>
                          {assignExpandedId === a.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                        </button>

                      <AnimatePresence>
                        {assignExpandedId === a.id && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-3 pt-0 space-y-1.5">
                              {assignQLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                </div>
                              ) : assignQuestions.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                  {lang === "ar" ? "لا توجد أسئلة اختيار متعدد صالحة (4 خيارات)" : "No valid MCQ questions (4 options required)"}
                                </p>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      if (assignSelected.size === assignQuestions.length) {
                                        setAssignSelected(new Set());
                                      } else {
                                        setAssignSelected(new Set(assignQuestions.map(q => q.id)));
                                      }
                                    }}
                                    className="text-[10px] text-amber-600 font-bold hover:underline"
                                  >
                                    {assignSelected.size === assignQuestions.length
                                      ? (lang === "ar" ? "إلغاء تحديد الكل" : "Deselect All")
                                      : (lang === "ar" ? "تحديد الكل" : "Select All")}
                                  </button>
                                  {assignQuestions.map((q) => (
                                    <div
                                      key={q.id}
                                      onClick={() => toggleAssignSelect(q.id)}
                                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                                        assignSelected.has(q.id)
                                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                                          : "border-border hover:border-amber-300"
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                                          assignSelected.has(q.id)
                                            ? "border-amber-500 bg-amber-500 text-white"
                                            : "border-border"
                                        }`}>
                                          {assignSelected.has(q.id) && <Check className="w-2.5 h-2.5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold leading-tight">{q.text}</p>
                                          <div className="mt-1 grid grid-cols-2 gap-1">
                                            {[q.optionA, q.optionB, q.optionC, q.optionD].map((opt, i) => (
                                              <span
                                                key={i}
                                                className={`text-[10px] px-1.5 py-0.5 rounded truncate ${
                                                  q.correctAnswer === ["A","B","C","D"][i]
                                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold"
                                                    : "bg-muted/60 text-muted-foreground"
                                                }`}
                                              >
                                                {optionLetters[i]}) {opt || "—"}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      </div>
                    );
                    return (
                      <>
                        {own.length > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide pt-1">
                            {lang === "ar" ? "── واجباتي ──" : "── My Assignments ──"}
                          </div>
                        )}
                        {own.map(renderItem)}
                        {shared.length > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide pt-3">
                            {lang === "ar" ? "── واجبات مشتركة ──" : "── Shared Assignments ──"}
                          </div>
                        )}
                        {shared.map(renderItem)}
                      </>
                    );
                  })()
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {savedOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSavedOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              dir={dir}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    <h2 className="font-black text-lg">
                      {lang === "ar" ? "ألعاب محفوظة" : "Saved Games"}
                    </h2>
                  </div>
                  <button onClick={() => setSavedOpen(false)} className="p-1 rounded-lg hover:bg-white/20">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {savedLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                  </div>
                ) : savedTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    {lang === "ar" ? "لا توجد ألعاب محفوظة بعد" : "No saved games yet"}
                  </div>
                ) : (
                  (() => {
                    const own = savedTemplates.filter(t => t.isOwn !== false);
                    const fromAdmin = savedTemplates.filter(t => t.fromAdmin);
                    const renderRow = (t: typeof savedTemplates[0]) => (
                      <div key={t.id} className="border rounded-xl p-4 hover:border-cyan-400 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.fromAdmin ? "bg-amber-100 dark:bg-amber-900/40" : "bg-cyan-100 dark:bg-cyan-900/40"}`}>
                            <Play className={`w-5 h-5 ${t.fromAdmin ? "text-amber-600" : "text-cyan-600"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-sm truncate">{t.title}</p>
                              {t.fromAdmin && (
                                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                  {lang === "ar" ? "من المسؤول" : "Admin"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {(t.questions as TugQuestion[]).length} {lang === "ar" ? "سؤال" : "questions"} · {t.duration}{lang === "ar" ? "ث" : "s"}
                              {t.fromAdmin && t.ownerName ? ` · ${t.ownerName}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleLoadTemplate(t)}
                              className="py-1.5 px-3 rounded-lg bg-cyan-500 text-white text-xs font-bold hover:bg-cyan-600 transition-colors"
                            >
                              {lang === "ar" ? "تحميل" : "Load"}
                            </button>
                            {!t.fromAdmin && (
                              <button
                                onClick={() => handleDeleteTemplate(t.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <>
                        {own.map(renderRow)}
                        {fromAdmin.length > 0 && (
                          <div className="pt-3 mt-2 border-t border-border/40">
                            <p className="text-xs font-bold text-muted-foreground mb-2 px-1">
                              {lang === "ar" ? "مشترك من المسؤول" : "Shared by admin"}
                            </p>
                            <div className="space-y-2">
                              {fromAdmin.map(renderRow)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
