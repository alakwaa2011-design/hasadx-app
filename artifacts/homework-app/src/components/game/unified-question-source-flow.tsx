import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Sparkles, PenLine, Database, ChevronLeft, ChevronRight,
  Search, Loader2, Check, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { creditAwareFetch, isInsufficientCreditsResponse } from "@/lib/credit-aware-fetch";
import { QuestionCard, emptyQuestion, isValidQ, type Question, type Correct } from "@/components/game/question-editor";
import { useGetCurrentTeacher, useListAssignments } from "@workspace/api-client-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface UnifiedQuestionSourceFlowProps {
  gameTitle: string;
  gameDescription: string;
  gameIcon: React.ReactNode;
  accentColor?: string;
  accentClass?: string;
  minQuestions: number;
  maxQuestions: number;
  onComplete: (data: {
    questions: Array<{ text: string; options: string[]; correct: number; imageUrl?: string | null }>;
    sourceTitle: string | null;
    source: "assignment" | "ai" | "manual" | "bank";
  }) => void;
}

type ViewState = "menu" | "assignment" | "bank" | "ai_form" | "editor";

export function UnifiedQuestionSourceFlow({
  gameTitle,
  gameDescription,
  gameIcon,
  accentColor,
  accentClass,
  minQuestions,
  maxQuestions,
  onComplete,
}: UnifiedQuestionSourceFlowProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const BackIcon = ar ? ChevronRight : ChevronLeft;

  const [viewState, setViewState] = useState<ViewState>("menu");
  const [editorSource, setEditorSource] = useState<"manual" | "ai">("manual");

  // ─── API Hooks ───
  const { data: user } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { data: assignments, isLoading: assignmentsLoading } = useListAssignments(
    user ? { teacherId: user.id, include: "shared" as const } : undefined,
    { query: { enabled: !!user } as any }
  );

  // ─── Source States ───
  // Assignment
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedAssignId, setSelectedAssignId] = useState<number | null>(null);
  // Continue is allowed only when the currently selected assignment itself
  // finished loading. This prevents a failed second selection from reusing
  // questions left over from a previously selected assignment.
  const [loadedAssignId, setLoadedAssignId] = useState<number | null>(null);
  const [selectedAssignQs, setSelectedAssignQs] = useState<any[]>([]);
  const [selectedAssignTitle, setSelectedAssignTitle] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Bank
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelectedIds, setBankSelectedIds] = useState<Set<number>>(new Set());
  const [bankLoading, setBankLoading] = useState(false);
  const [bankLoaded, setBankLoaded] = useState(false);

  // Editor (Manual & AI)
  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);
  const [aiQuestions, setAiQuestions] = useState<Question[]>([]);
  const [manualTitle, setManualTitle] = useState("");
  const [aiTitle, setAiTitle] = useState("");

  // AI Form
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ─── Helpers ───
  const goBack = () => setViewState("menu");

  const BackBtn = () => (
    <button
      type="button"
      onClick={goBack}
      className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 border border-transparent hover:border-border"
    >
      <BackIcon className="w-5 h-5 lg:w-6 lg:h-6" />
    </button>
  );

  // ─── Assignment Logic ───
  const wameethSourceAssignments = (assignments || []).filter((a: any) => {
    if (a.hiddenByAdmin && a.teacherId !== user?.id) return false;
    return true;
  });

  const filteredAssignments = wameethSourceAssignments.filter((a: any) => {
    if ((a.questionCount ?? 0) === 0) return false;
    if (!assignSearch.trim()) return true;
    return a.title.toLowerCase().includes(assignSearch.toLowerCase());
  });

  const handleSelectAssignment = async (a: any) => {
    if (assignLoading) return;
    setSelectedAssignId(a.id);
    setLoadedAssignId(null);
    setSelectedAssignQs([]);
    setSelectedAssignTitle("");
    setAssignLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${a.id}`, { credentials: "include" });
      if (!res.ok) {
        setSelectedAssignId(null);
        toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions");
        return;
      }
      const data = await res.json();
      const mcqs = (data.questions || []).filter((q: any) =>
        q.questionType === "mcq" && q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer
      );
      if (mcqs.length === 0) {
        toast.error(ar ? "لا توجد أسئلة اختيار متعدد مدعومة" : "No supported MCQ questions");
        setSelectedAssignId(null);
        return;
      }
      setSelectedAssignQs(mcqs);
      setSelectedAssignTitle(a.title);
      setLoadedAssignId(a.id);
      toast.success(ar ? `تم تحميل ${mcqs.length} سؤال` : `Loaded ${mcqs.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "Error");
      setSelectedAssignId(null);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignComplete = () => {
    if (selectedAssignId == null || selectedAssignId !== loadedAssignId || selectedAssignQs.length < minQuestions) {
      toast.error(ar ? `الحد الأدنى هو ${minQuestions} أسئلة` : `Minimum is ${minQuestions} questions`);
      return;
    }
    const qList = selectedAssignQs.map(q => ({
      text: q.text,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer) !== -1 ? ["A", "B", "C", "D"].indexOf(q.correctAnswer) : 0,
      imageUrl: q.imageUrl || null
    })).slice(0, maxQuestions);
    onComplete({ questions: qList, sourceTitle: selectedAssignTitle, source: "assignment" });
  };

  // ─── Bank Logic ───
  useEffect(() => {
    if (viewState === "bank" && !bankLoaded && !bankLoading) {
      setBankLoading(true);
      fetch(`${API_BASE}/api/question-bank`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("question-bank-unavailable");
          return res.json();
        })
        .then(data => {
          const mcqs = (data || []).filter((q: any) =>
            q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer
          );
          setBankQuestions(mcqs);
          setBankLoaded(true);
        })
        .catch(() => {
          // A signed-out or failed request must settle the loading state.
          // Otherwise the effect retries on every render and traps the teacher
          // in this view beneath an endless stream of error toasts.
          setBankLoaded(true);
          toast.error(ar ? "سجّل الدخول لعرض بنك الأسئلة" : "Sign in to view the question bank");
        })
        .finally(() => setBankLoading(false));
    }
  }, [viewState, bankLoaded, bankLoading, ar]);

  const filteredBank = bankSearch.trim()
    ? bankQuestions.filter(q => q.text.includes(bankSearch) || (q.subject && q.subject.includes(bankSearch)))
    : bankQuestions;

  const toggleBankQ = (id: number) => {
    const next = new Set(bankSelectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= maxQuestions) {
        toast.error(ar ? `الحد الأقصى هو ${maxQuestions} سؤال` : `Maximum is ${maxQuestions} questions`);
        return;
      }
      next.add(id);
    }
    setBankSelectedIds(next);
  };

  const handleBankComplete = () => {
    if (bankSelectedIds.size < minQuestions) {
      toast.error(ar ? `الحد الأدنى هو ${minQuestions} أسئلة` : `Minimum is ${minQuestions} questions`);
      return;
    }
    const selected = bankQuestions.filter(q => bankSelectedIds.has(q.id));
    const qList = selected.map(q => ({
      text: q.text,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer) !== -1 ? ["A", "B", "C", "D"].indexOf(q.correctAnswer) : 0,
      imageUrl: q.imageUrl || null
    })).slice(0, maxQuestions);
    onComplete({ questions: qList, sourceTitle: null, source: "bank" });
  };

  // ─── AI Logic ───
  const generateWithAI = async () => {
    if (!aiTopic.trim()) { toast.error(ar ? "أدخل الموضوع أولاً" : "Enter a topic first"); return; }
    setAiGenerating(true);
    try {
      const count = Math.min(aiCount, maxQuestions);
      const res = await creditAwareFetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: aiTopic.trim(), subject: aiSubject.trim(), count, difficulty: aiDifficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(data.message || (ar ? "فشل التوليد" : "Generation failed"));
      }
      const generated: Question[] = (data.questions || []).map((q: any) => ({
        ...emptyQuestion("mcq"),
        text: q.text || "",
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
      }));

      setAiQuestions(generated);
      setAiTitle(aiTopic.trim());
      setEditorSource("ai");
      setViewState("editor");
      toast.success(ar ? `تم توليد ${generated.length} سؤال` : `Generated ${generated.length} questions`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "خطأ في التوليد" : "Generation error"));
    } finally {
      setAiGenerating(false);
    }
  };

  // ─── Editor Logic (Manual + AI) ───
  const activeQs = editorSource === "ai" ? aiQuestions : manualQuestions;
  const activeTitle = editorSource === "ai" ? aiTitle : manualTitle;
  const setQs = editorSource === "ai" ? setAiQuestions : setManualQuestions;

  const validQs = activeQs.filter(isValidQ);
  const canCompleteEditor = validQs.length >= minQuestions;

  const handleEditorComplete = () => {
    if (!canCompleteEditor) {
      toast.error(ar ? `يجب إكمال ${minQuestions} أسئلة صالحة على الأقل` : `Complete at least ${minQuestions} valid questions`);
      return;
    }
    const qList = validQs.map(q => ({
      text: q.text,
      options: [q.optionA, q.optionB, q.optionC, q.optionD],
      correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer) !== -1 ? ["A", "B", "C", "D"].indexOf(q.correctAnswer) : 0,
      imageUrl: null
    })).slice(0, maxQuestions);
    onComplete({ questions: qList, sourceTitle: activeTitle || null, source: editorSource });
  };

  // ─── Shared UI Components ───
  const SubmitBtn = ({ onClick, disabled, label }: { onClick: () => void, disabled: boolean, label: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
        !accentColor && (accentClass || "bg-primary text-primary-foreground hover:bg-primary/90")
      )}
      style={accentColor ? { backgroundColor: accentColor, color: '#fff' } : {}}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-4xl lg:max-w-6xl mx-auto space-y-6 lg:space-y-8" dir={dir}>
      {/* Header & Step Indicator */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border/60 shadow-sm mb-4 text-foreground">
          {gameIcon}
        </div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight mb-2">{gameTitle}</h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto font-medium">{gameDescription}</p>

        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border/60 rounded-2xl shadow-sm">
            {[
              { label: ar ? "الأسئلة" : "Questions", active: true },
              { label: ar ? "إعدادات اللعبة" : "Game Settings", active: false },
              { label: ar ? "البدء" : "Start", active: false },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="w-4 h-px bg-border/60 mx-1" />}
                <div
                  className={cn(
                    "px-3 py-1.5 text-xs lg:text-sm font-bold rounded-xl transition-colors",
                    s.active ? "bg-muted/80 text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground"
                  )}
                  style={s.active && accentColor ? { backgroundColor: `${accentColor}15`, color: accentColor, borderColor: `${accentColor}40` } : {}}
                >
                  {s.label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewState}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {viewState === "menu" && (
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-6 max-w-3xl mx-auto">
              {[
                {
                  id: "assignment" as const,
                  icon: <BookOpen className="w-6 h-6 text-blue-500" />,
                  title: ar ? "من واجب موجود" : "From an assignment",
                  desc: ar ? "استيراد الأسئلة من واجباتك السابقة" : "Import questions from past assignments",
                  bg: "bg-blue-500/10",
                  border: "border-blue-500/20",
                  hoverBorder: "hover:border-blue-500/50"
                },
                {
                  id: "ai_form" as const,
                  icon: <Sparkles className="w-6 h-6 text-amber-500" />,
                  title: ar ? "بالذكاء الاصطناعي" : "With AI",
                  desc: ar ? "توليد أسئلة تلقائياً في أي موضوع" : "Generate questions on any topic",
                  bg: "bg-amber-500/10",
                  border: "border-amber-500/20",
                  hoverBorder: "hover:border-amber-500/50"
                },
                {
                  id: "editor" as const,
                  icon: <PenLine className="w-6 h-6 text-emerald-600" />,
                  title: ar ? "إضافة يدوية" : "Add manually",
                  desc: ar ? "كتابة الأسئلة من الصفر" : "Write questions from scratch",
                  bg: "bg-emerald-500/10",
                  border: "border-emerald-500/20",
                  hoverBorder: "hover:border-emerald-500/50"
                },
                {
                  id: "bank" as const,
                  icon: <Database className="w-6 h-6 text-purple-500" />,
                  title: ar ? "بنك الأسئلة" : "Question Bank",
                  desc: ar ? "اختيار أسئلة جاهزة من بنك حصاد" : "Select ready questions from the bank",
                  bg: "bg-purple-500/10",
                  border: "border-purple-500/20",
                  hoverBorder: "hover:border-purple-500/50"
                }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (opt.id === "editor") setEditorSource("manual");
                    setViewState(opt.id);
                  }}
                  className={cn(
                    "group p-6 lg:p-8 bg-card border-2 border-border/60 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden",
                    opt.hoverBorder
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors border shadow-sm", opt.bg, opt.border)}>
                    {opt.icon}
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1.5">{opt.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}

          {viewState === "assignment" && (
            <div className="bg-card border border-border/60 rounded-3xl p-5 lg:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <BackBtn />
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{ar ? "من واجب موجود" : "From an assignment"}</h2>
                    <p className="text-sm text-muted-foreground">{ar ? "اختر واجباً لاستيراد أسئلته" : "Select an assignment to import questions"}</p>
                  </div>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    placeholder={ar ? "ابحث في الواجبات..." : "Search assignments..."}
                    className="w-full bg-muted/50 border border-border/60 rounded-xl ps-9 pe-4 py-2 text-sm focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                    style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                  />
                </div>
              </div>

              <div className="h-[350px] overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar">
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : filteredAssignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm font-medium">
                    {ar ? "لا توجد واجبات مطابقة" : "No assignments found"}
                  </div>
                ) : (
                  filteredAssignments.map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAssignment(a)}
                      disabled={assignLoading}
                      className={cn(
                        "w-full text-start p-4 rounded-xl border-2 transition-all flex items-center justify-between group",
                        selectedAssignId === a.id
                          ? (!accentColor && "border-primary bg-primary/5")
                          : "border-border/40 bg-muted/20 hover:bg-muted hover:border-border/60"
                      )}
                      style={selectedAssignId === a.id && accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
                    >
                      <div>
                        <h3 className="font-bold text-foreground">{a.title}</h3>
                        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground mt-1.5">
                          <span className="bg-muted px-2 py-0.5 rounded-md border border-border/50">{ar ? "الأسئلة:" : "Questions:"} {a.questionCount || 0}</span>
                          {a.subject && (
                            <span className="bg-muted px-2 py-0.5 rounded-md border border-border/50">{a.subject}</span>
                          )}
                        </div>
                      </div>
                      {selectedAssignId === a.id && (
                        <div
                          className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", !accentColor && "bg-primary text-primary-foreground")}
                          style={accentColor ? { backgroundColor: accentColor, color: '#fff' } : {}}
                        >
                          {assignLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="flex justify-end pt-4 border-t border-border/60">
                <SubmitBtn
                  onClick={handleAssignComplete}
                  disabled={selectedAssignId == null || selectedAssignId !== loadedAssignId || selectedAssignQs.length < minQuestions || assignLoading}
                  label={ar ? "متابعة" : "Continue"}
                />
              </div>
            </div>
          )}

          {viewState === "bank" && (
            <div className="bg-card border border-border/60 rounded-3xl p-5 lg:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <BackBtn />
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{ar ? "بنك الأسئلة" : "Question Bank"}</h2>
                    <p className="text-sm text-muted-foreground">{ar ? `اختر من ${minQuestions} إلى ${maxQuestions} سؤال` : `Select ${minQuestions} to ${maxQuestions} questions`}</p>
                  </div>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={bankSearch}
                    onChange={e => setBankSearch(e.target.value)}
                    placeholder={ar ? "ابحث في البنك..." : "Search bank..."}
                    className="w-full bg-muted/50 border border-border/60 rounded-xl ps-9 pe-4 py-2 text-sm focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                    style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                  />
                </div>
              </div>

              <div className="h-[350px] overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar">
                {bankLoading ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : filteredBank.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm font-medium">
                    {ar ? "لا توجد أسئلة مطابقة" : "No questions found"}
                  </div>
                ) : (
                  filteredBank.map((q: any) => {
                    const isSelected = bankSelectedIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleBankQ(q.id)}
                        className={cn(
                          "w-full text-start p-4 rounded-xl border-2 transition-all flex items-start gap-4 group",
                          isSelected
                            ? (!accentColor && "border-primary bg-primary/5")
                            : "border-border/40 bg-muted/20 hover:bg-muted hover:border-border/60"
                        )}
                        style={isSelected && accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
                      >
                        <div
                          className={cn(
                            "mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                            isSelected
                              ? (!accentColor && "bg-primary border-primary text-primary-foreground")
                              : "border-muted-foreground/40 bg-background"
                          )}
                          style={isSelected && accentColor ? { backgroundColor: accentColor, borderColor: accentColor, color: '#fff' } : {}}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground text-sm leading-relaxed mb-1.5">{q.text}</h3>
                          <div className="flex items-center gap-2">
                            {q.subject && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted border border-border/50 text-muted-foreground">{q.subject}</span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted border border-border/50 text-muted-foreground">{ar ? "اختيار متعدد" : "MCQ"}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <div className="text-sm font-bold">
                  <span className={cn(bankSelectedIds.size < minQuestions ? "text-amber-500" : "text-emerald-600")}>
                    {bankSelectedIds.size}
                  </span>
                  <span className="text-muted-foreground"> / {maxQuestions} {ar ? "محدد" : "selected"}</span>
                </div>
                <SubmitBtn
                  onClick={handleBankComplete}
                  disabled={bankSelectedIds.size < minQuestions}
                  label={ar ? "متابعة" : "Continue"}
                />
              </div>
            </div>
          )}

          {viewState === "ai_form" && (
            <div className="bg-card border border-border/60 rounded-3xl p-5 lg:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6 lg:mb-8">
                <BackBtn />
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    {ar ? "بالذكاء الاصطناعي" : "With AI"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{ar ? "سيتم توليد أسئلة اختيار متعدد وتتمكن من مراجعتها" : "MCQ questions will be generated for your review"}</p>
                </div>
              </div>

              <div className="space-y-5 max-w-xl mx-auto">
                <div>
                  <label className="block text-sm font-bold mb-1.5">{ar ? "الموضوع" : "Topic"}</label>
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder={ar ? "مثال: الفضاء والمجموعة الشمسية" : "e.g. Solar System"}
                    className="w-full bg-muted/30 border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                    style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                    dir={ar ? "rtl" : "ltr"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1.5">{ar ? "المادة (اختياري)" : "Subject (optional)"}</label>
                  <input
                    value={aiSubject}
                    onChange={e => setAiSubject(e.target.value)}
                    placeholder={ar ? "مثال: علوم" : "e.g. Science"}
                    className="w-full bg-muted/30 border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                    style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                    dir={ar ? "rtl" : "ltr"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1.5">{ar ? "عدد الأسئلة" : "Count"}</label>
                    <select
                      value={aiCount}
                      onChange={e => setAiCount(Number(e.target.value))}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                      style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                    >
                      {Array.from({ length: maxQuestions - minQuestions + 1 }, (_, i) => minQuestions + i).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1.5">{ar ? "الصعوبة" : "Difficulty"}</label>
                    <select
                      value={aiDifficulty}
                      onChange={e => setAiDifficulty(e.target.value as any)}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:border-transparent transition-shadow"
                      style={accentColor ? { '--tw-ring-color': accentColor } as any : {}}
                    >
                      <option value="easy">{ar ? "سهل" : "Easy"}</option>
                      <option value="medium">{ar ? "متوسط" : "Medium"}</option>
                      <option value="hard">{ar ? "صعب" : "Hard"}</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={generateWithAI}
                    disabled={!aiTopic.trim() || aiGenerating}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {ar ? "توليد الأسئلة" : "Generate Questions"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewState === "editor" && (
            <div className="space-y-6">
              <div className="bg-card border border-border/60 rounded-3xl p-4 lg:p-6 shadow-sm sticky top-20 z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <BackBtn />
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {editorSource === "ai" ? (ar ? "مراجعة أسئلة الذكاء الاصطناعي" : "Review AI Questions") : (ar ? "إضافة يدوية" : "Add Manually")}
                      </h2>
                      <p className="text-sm text-muted-foreground">{ar ? "تأكد من صحة الأسئلة واكتمالها" : "Ensure questions are valid and complete"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold hidden sm:block">
                      <span className={cn(validQs.length < minQuestions ? "text-amber-500" : "text-emerald-600")}>
                        {validQs.length}
                      </span>
                      <span className="text-muted-foreground"> / {maxQuestions} {ar ? "سؤال صالح" : "valid"}</span>
                    </div>
                    <SubmitBtn
                      onClick={handleEditorComplete}
                      disabled={!canCompleteEditor}
                      label={ar ? "متابعة" : "Continue"}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {activeQs.map((q, i) => (
                  <QuestionCard
                    key={i}
                    q={q}
                    index={i}
                    allowedTypes={["mcq"]}
                    showDifficulty={false}
                    showAudio={false}
                    onChange={updated => {
                      const copy = [...activeQs];
                      copy[i] = updated;
                      setQs(copy);
                    }}
                    onDelete={() => {
                      const copy = [...activeQs];
                      copy.splice(i, 1);
                      setQs(copy);
                    }}
                  />
                ))}

                {activeQs.length < maxQuestions && (
                  <button
                    onClick={() => setQs([...activeQs, emptyQuestion("mcq")])}
                    className="w-full p-6 border-2 border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center group-hover:bg-muted mb-3 transition-colors border border-transparent group-hover:border-border/50">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm">{ar ? "إضافة سؤال جديد" : "Add new question"}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
