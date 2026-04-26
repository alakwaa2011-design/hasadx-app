import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Plus, Trash2, Save, Copy, Check,
  Sparkles, LogIn, ChevronDown, ChevronUp, Loader2, X, Pencil,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface MCQQuestion {
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
}

interface Stage {
  num: number;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  questions: MCQQuestion[];
}

function makeEmptyQuestion(): MCQQuestion {
  return { text: "", options: ["", "", "", ""], correct: 0 };
}

function makeEmptyStage(num: number): Stage {
  return { num, name: "", difficulty: "easy", questions: [makeEmptyQuestion()] };
}

const DIFFICULTY_COLORS = {
  easy: "from-green-500 to-emerald-600",
  medium: "from-amber-500 to-orange-600",
  hard: "from-red-500 to-rose-600",
};

const DIFFICULTY_LABELS_AR = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export default function MaraquiCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const editId = params.get("edit") ? parseInt(params.get("edit")!, 10) : null;
  const isEditMode = editId !== null && !isNaN(editId);
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [stages, setStages] = useState<Stage[]>([makeEmptyStage(1)]);
  const [expandedStage, setExpandedStage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ pin: string; title: string; isEdit?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiLoadingStage, setAiLoadingStage] = useState<number | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState("5");
  const [showAiFor, setShowAiFor] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => {
        setIsLoggedIn(r.ok);
        if (r.ok && isEditMode) loadEditPath();
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  const loadEditPath = async () => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-path-by-id/${editId}`, { credentials: "include" });
      if (!res.ok) throw new Error("لم يُعثر على المسار");
      const data = await res.json() as Record<string, unknown>;
      setTitle(String(data.title || ""));
      setDescription(String(data.description || ""));
      setIsPublic(data.is_public === true);
      if (Array.isArray(data.stages)) {
        setStages(data.stages as Stage[]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "حدث خطأ في تحميل المسار";
      toast.error(msg);
    } finally {
      setLoadingEdit(false);
    }
  };

  if (isLoggedIn === null || (isEditMode && loadingEdit)) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 px-4" dir={dir}>
          <div className="max-w-md w-full text-center bg-white/90 dark:bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-xl border border-teal-100 dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 text-3xl">🪜</div>
            <h2 className="text-2xl font-black text-foreground mb-2">{isRtl ? "تسجيل الدخول مطلوب" : "Login Required"}</h2>
            <p className="text-muted-foreground mb-6">{isRtl ? "يجب تسجيل الدخول كمعلم" : "You must be logged in as a teacher"}</p>
            <button onClick={() => setLocation("/login")} className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-lg flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" />
              {isRtl ? "تسجيل الدخول" : "Log In"}
            </button>
            <button onClick={() => setLocation("/game/maraqui")} className="w-full py-2 mt-3 text-sm text-muted-foreground hover:text-foreground">
              {isRtl ? "العودة للعبة مَراقي" : "Back to Maraqui"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const addStage = () => {
    if (stages.length >= 10) return;
    const newStage = makeEmptyStage(stages.length + 1);
    setStages([...stages, newStage]);
    setExpandedStage(stages.length);
  };

  const removeStage = (idx: number) => {
    if (stages.length <= 1) return;
    const newStages = stages.filter((_, i) => i !== idx).map((s, i) => ({ ...s, num: i + 1 }));
    setStages(newStages);
    setExpandedStage(Math.min(expandedStage, newStages.length - 1));
  };

  const updateStage = (idx: number, field: keyof Stage, value: Stage[keyof Stage]) => {
    setStages(stages.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addQuestion = (stageIdx: number) => {
    const s = stages[stageIdx];
    if (s.questions.length >= 20) return;
    updateStage(stageIdx, "questions", [...s.questions, makeEmptyQuestion()]);
  };

  const removeQuestion = (stageIdx: number, qIdx: number) => {
    const s = stages[stageIdx];
    if (s.questions.length <= 1) return;
    updateStage(stageIdx, "questions", s.questions.filter((_, i) => i !== qIdx));
  };

  const updateQuestion = (stageIdx: number, qIdx: number, q: Partial<MCQQuestion>) => {
    const s = stages[stageIdx];
    const newQuestions = s.questions.map((old, i) => i === qIdx ? { ...old, ...q } : old);
    updateStage(stageIdx, "questions", newQuestions);
  };

  const updateOption = (stageIdx: number, qIdx: number, optIdx: number, value: string) => {
    const q = stages[stageIdx].questions[qIdx];
    const newOptions: [string, string, string, string] = [...q.options] as [string, string, string, string];
    newOptions[optIdx] = value;
    updateQuestion(stageIdx, qIdx, { options: newOptions });
  };

  const generateAI = async (stageIdx: number) => {
    if (!aiTopic.trim()) { toast.error(isRtl ? "أدخل موضوع الأسئلة" : "Enter a topic"); return; }
    setAiLoadingStage(stageIdx);
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: aiTopic,
          count: Math.min(Math.max(parseInt(aiCount) || 5, 1), 15),
          difficulty: stages[stageIdx].difficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error");
      const converted: MCQQuestion[] = data.questions.map((q: {
        text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string;
      }) => ({
        text: q.text,
        options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
        correct: (["A", "B", "C", "D"].indexOf(q.correctAnswer) as 0 | 1 | 2 | 3) || 0,
      }));
      updateStage(stageIdx, "questions", [...stages[stageIdx].questions.filter(q => q.text.trim()), ...converted]);
      setShowAiFor(null);
      toast.success(isRtl ? `تم توليد ${converted.length} سؤال` : `Generated ${converted.length} questions`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (isRtl ? "حدث خطأ" : "An error occurred");
      toast.error(msg);
    } finally {
      setAiLoadingStage(null);
    }
  };

  const isValid = () => {
    if (!title.trim()) return false;
    if (stages.length === 0) return false;
    for (const s of stages) {
      if (!s.name.trim()) return false;
      if (s.questions.length === 0) return false;
      for (const q of s.questions) {
        if (!q.text.trim()) return false;
        if (q.options.some(o => !o.trim())) return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!isValid() || saving) return;
    setSaving(true);
    try {
      const url = isEditMode
        ? `${API_BASE}/api/maraqui-paths/${editId}`
        : `${API_BASE}/api/maraqui-paths`;
      const method = isEditMode ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: title.trim(), description: description.trim(), stages, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ pin: data.pin, title: data.title, isEdit: isEditMode });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (isRtl ? "حدث خطأ" : "An error occurred");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (result) {
    const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL || "/"}game/maraqui?pin=${result.pin}`;
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 py-8 px-4" dir={dir}>
          <div className="max-w-md mx-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="text-7xl mb-4">
                {result.isEdit ? "✏️" : "🎉"}
              </motion.div>
              <h1 className="text-2xl font-black text-foreground mb-2">
                {result.isEdit
                  ? (isRtl ? "تم تحديث المسار!" : "Path Updated!")
                  : (isRtl ? "تم إنشاء المسار!" : "Path Created!")}
              </h1>
              <p className="text-muted-foreground text-sm mb-6">{result.title}</p>

              <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-lg mb-5">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-5xl font-black text-teal-600 tracking-widest" dir="ltr">{result.pin}</span>
                  <button onClick={handleCopy} className="p-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors">
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{isRtl ? "كود المسار — شاركه مع الطلاب" : "Path PIN — share with students"}</p>
                <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-xl p-2">
                  <p className="text-xs font-mono text-foreground flex-1 truncate" dir="ltr">{shareUrl}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setLocation(`/game/maraqui?pin=${result.pin}`)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-base shadow-lg flex items-center justify-center gap-2"
                >
                  🪜 {isRtl ? "شاهد المسار" : "View Path"}
                </button>
                <button
                  onClick={() => setLocation("/game/maraqui")}
                  className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isRtl ? "إدارة المسارات" : "Manage Paths"}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
            <button onClick={() => setLocation("/game/maraqui")} className="p-2 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-colors text-muted-foreground">
              <BackArrow className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                {isEditMode && <Pencil className="w-5 h-5 text-teal-500" />}
                {isEditMode
                  ? (isRtl ? "تعديل مسار مَراقي" : "Edit Maraqui Path")
                  : (isRtl ? "إنشاء مسار مَراقي" : "Create Maraqui Path")}
              </h1>
              <p className="text-muted-foreground text-xs">{isRtl ? "أسئلة متدرجة — يُكمل اللاعب مرحلة بمرحلة" : "Staged questions — player completes stage by stage"}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
              <div>
                <label className="text-sm font-bold text-foreground block mb-1.5">{isRtl ? "عنوان المسار *" : "Path Title *"}</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={isRtl ? "مثال: الصحابة الكرام، القرآن الكريم..." : "e.g. Companions of the Prophet..."}
                  maxLength={100}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground block mb-1.5">{isRtl ? "وصف مختصر (اختياري)" : "Short Description (optional)"}</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={isRtl ? "صف المسار للاعبين..." : "Describe the path to players..."}
                  maxLength={300}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-teal-500" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white dark:bg-slate-100 rounded-full shadow transition-all ${isPublic ? (isRtl ? "right-1" : "left-6") : (isRtl ? "right-6" : "left-1")}`} />
                </button>
                <span className="text-sm text-muted-foreground">
                  {isPublic
                    ? (isRtl ? "طلب مشاركة عامة (يحتاج موافقة المسؤول)" : "Request public sharing (needs admin approval)")
                    : (isRtl ? "مسار خاص (بـ PIN فقط)" : "Private path (PIN only)")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-foreground">{isRtl ? `المراحل (${stages.length}/10)` : `Stages (${stages.length}/10)`}</h2>
                <button
                  onClick={addStage}
                  disabled={stages.length >= 10}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold disabled:opacity-40 hover:bg-teal-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isRtl ? "مرحلة جديدة" : "Add Stage"}
                </button>
              </div>

              {stages.map((stage, stageIdx) => (
                <motion.div
                  key={stageIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedStage(expandedStage === stageIdx ? -1 : stageIdx)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${DIFFICULTY_COLORS[stage.difficulty]} flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md`}>
                      {stage.num}
                    </div>
                    <div className="flex-1 text-start">
                      <p className="font-bold text-foreground text-sm">
                        {stage.name.trim() || (isRtl ? `المرحلة ${stage.num}` : `Stage ${stage.num}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRtl ? DIFFICULTY_LABELS_AR[stage.difficulty] : stage.difficulty} • {stage.questions.filter(q => q.text.trim()).length} {isRtl ? "سؤال" : "questions"}
                      </p>
                    </div>
                    {stages.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); removeStage(stageIdx); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expandedStage === stageIdx ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {expandedStage === stageIdx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-bold text-muted-foreground block mb-1">{isRtl ? "اسم المرحلة *" : "Stage Name *"}</label>
                              <input
                                type="text"
                                value={stage.name}
                                onChange={e => updateStage(stageIdx, "name", e.target.value)}
                                placeholder={isRtl ? "مثال: أبو بكر الصديق" : "e.g. Easy level..."}
                                maxLength={60}
                                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-muted-foreground block mb-1">{isRtl ? "الصعوبة" : "Difficulty"}</label>
                              <div className="flex gap-1">
                                {(["easy", "medium", "hard"] as const).map(d => (
                                  <button
                                    key={d}
                                    onClick={() => updateStage(stageIdx, "difficulty", d)}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${stage.difficulty === d ? `bg-gradient-to-br ${DIFFICULTY_COLORS[d]} text-white shadow-md` : "bg-muted text-muted-foreground"}`}
                                  >
                                    {isRtl ? DIFFICULTY_LABELS_AR[d] : d}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-foreground">{isRtl ? `الأسئلة (${stage.questions.length}/20)` : `Questions (${stage.questions.length}/20)`}</p>
                              <button
                                onClick={() => setShowAiFor(showAiFor === stageIdx ? null : stageIdx)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 text-xs font-bold hover:bg-purple-500/20 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                                {isRtl ? "توليد AI" : "AI Generate"}
                              </button>
                            </div>

                            <AnimatePresence>
                              {showAiFor === stageIdx && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3 space-y-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={aiTopic}
                                        onChange={e => setAiTopic(e.target.value)}
                                        placeholder={isRtl ? "موضوع الأسئلة..." : "Topic..."}
                                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
                                      />
                                      <input
                                        type="number"
                                        value={aiCount}
                                        onChange={e => setAiCount(e.target.value)}
                                        min={1} max={15}
                                        className="w-14 px-2 py-2 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 text-center"
                                      />
                                      <button
                                        onClick={() => generateAI(stageIdx)}
                                        disabled={aiLoadingStage === stageIdx}
                                        className="px-3 py-2 rounded-lg bg-purple-500 text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1"
                                      >
                                        {aiLoadingStage === stageIdx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        {isRtl ? "ولّد" : "Gen"}
                                      </button>
                                    </div>
                                    <p className="text-xs text-purple-600 dark:text-purple-400">
                                      {isRtl ? "* ستُضاف الأسئلة للمرحلة الحالية" : "* Questions will be added to this stage"}
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {stage.questions.map((q, qIdx) => (
                              <div key={qIdx} className="border border-border/40 rounded-xl p-3 space-y-2 bg-background/50">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 text-[10px] font-black flex items-center justify-center shrink-0">{qIdx + 1}</span>
                                  <input
                                    type="text"
                                    value={q.text}
                                    onChange={e => updateQuestion(stageIdx, qIdx, { text: e.target.value })}
                                    placeholder={isRtl ? "نص السؤال *" : "Question text *"}
                                    maxLength={300}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors"
                                  />
                                  <button
                                    onClick={() => removeQuestion(stageIdx, qIdx)}
                                    disabled={stage.questions.length <= 1}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => updateQuestion(stageIdx, qIdx, { correct: optIdx as 0 | 1 | 2 | 3 })}
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${q.correct === optIdx ? "border-teal-500 bg-teal-500" : "border-muted-foreground/40"}`}
                                      >
                                        {q.correct === optIdx && <Check className="w-3 h-3 text-white" />}
                                      </button>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => updateOption(stageIdx, qIdx, optIdx, e.target.value)}
                                        placeholder={`${isRtl ? "خيار" : "Option"} ${optIdx + 1}`}
                                        maxLength={200}
                                        className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            <button
                              onClick={() => addQuestion(stageIdx)}
                              disabled={stage.questions.length >= 20}
                              className="w-full py-2 rounded-xl border border-dashed border-teal-300 text-teal-600 text-xs font-bold hover:bg-teal-50 dark:hover:bg-teal-950/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {isRtl ? "سؤال جديد" : "Add Question"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            <motion.button
              onClick={handleSave}
              disabled={!isValid() || saving}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-base shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
            >
              {saving
                ? <><Loader2 className="w-5 h-5 animate-spin" />{isRtl ? "جاري الحفظ..." : "Saving..."}</>
                : isEditMode
                  ? <><Pencil className="w-5 h-5" />{isRtl ? "حفظ التعديلات" : "Save Changes"}</>
                  : <><Save className="w-5 h-5" />{isRtl ? "إنشاء المسار" : "Create Path"}</>
              }
            </motion.button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
