/**
 * /teacher/solo-challenges/new
 * إنشاء مسابقة مسابقة ذاتية جديدة:
 *   - من واجب موجود، أو
 *   - أسئلة جديدة بمساعدة الذكاء الاصطناعي + تعديل يدوي
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Sparkles, BookOpen, ChevronLeft, Plus, Trash2, Check,
  Loader2, Search, Clock, Trophy, FileText, Calendar, ChevronDown,
  X, Settings, Layers, PenLine, Users, XCircle
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuestionCard, emptyQuestion, isValidQ, type Question, type Correct } from "@/components/game/question-editor";

const API = import.meta.env.VITE_API_URL || "";

type Source = "assignment" | "ai" | "manual";
type Difficulty = "easy" | "medium" | "hard";

interface ChallengeLevel {
  name: string;
  questionCount: number;
  timePerQuestion: number;
}

type DiffDistribution = { easy: number; medium: number; hard: number };

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  createdAt?: string;
}

export default function SoloChallengeCreatePage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });

  const [source, setSource] = useState<Source | null>(null);
  const [saving, setSaving] = useState(false);

  // === Assignment mode ===
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // === AI mode ===
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  // === Common settings ===
  const [notes, setNotes] = useState("");
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [leaderboardDisplay, setLeaderboardDisplay] = useState<"top3" | "top20" | "all">("top20");
  const [expiresAt, setExpiresAt] = useState("");
  const [questionsPerParticipant, setQuestionsPerParticipant] = useState<number | "">("");
  const [allowedClasses, setAllowedClasses] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);

  // === Multi-level + difficulty distribution ===
  const [isMultiLevel, setIsMultiLevel] = useState(false);
  const [challengeLevels, setChallengeLevels] = useState<ChallengeLevel[]>([
    { name: "المرحلة الأولى", questionCount: 5, timePerQuestion: 25 },
  ]);
  const [diffDistribution, setDiffDistribution] = useState<DiffDistribution | null>(null);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading]);

  // Fetch teacher classes for class restriction picker
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/teacher/classes`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ name: string; group_name?: string }>) => {
        const names = data.map(c => c.group_name ? `${c.name} - ${c.group_name}` : c.name);
        setTeacherClasses([...new Set(names)]);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (source !== "assignment") return;
    setLoadingAssignments(true);
    fetch(`${API}/api/assignments?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.assignments) ? data.assignments : []);
        setAssignments(list);
      })
      .catch(() => {})
      .finally(() => setLoadingAssignments(false));
  }, [source]);

  const filteredAssignments = assignments.filter(a =>
    a.title.toLowerCase().includes(assignSearch.toLowerCase()) ||
    assignSearch === ""
  );

  const generateWithAI = async () => {
    if (!topic.trim()) { toast.error("أدخل الموضوع أولاً"); return; }
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: topic.trim(), subject: subject.trim(), count, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل التوليد");
      const generated: Question[] = (data.questions || []).map((q: any) => ({
        text: q.text || "",
        type: "mcq" as const,
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: (["A","B","C","D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
        fillAnswer: "",
        closeAnswers: "",
        difficulty: null,
        audioUrl: null,
      }));
      setQuestions(prev => [...prev, ...generated]);
      if (!title) setTitle(topic.trim());
      toast.success(`تم توليد ${generated.length} سؤال`);
    } catch (err: any) {
      toast.error(err.message || "خطأ في التوليد");
    } finally {
      setGenerating(false);
    }
  };

  const createFromAssignment = async () => {
    if (!selectedAssignment) { toast.error("اختر واجباً أولاً"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignmentId: selectedAssignment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Apply settings
      await fetch(`${API}/api/solo-challenges/${encodeURIComponent(data.slug)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: notes || null,
          expiresAt: expiresAt || null,
          timePerQuestion,
          leaderboardDisplay,
          questionsPerParticipant: diffDistribution ? null : (questionsPerParticipant === "" ? null : questionsPerParticipant),
          difficultyDistribution: diffDistribution,
          isMultiLevel,
          levels: isMultiLevel ? challengeLevels : null,
          allowedClasses,
        }),
      });

      toast.success("تم إنشاء المسابقة");
      setLocation(`/teacher/solo-challenges/${data.slug}`);
    } catch (err: any) {
      toast.error(err.message || "خطأ في الإنشاء");
    } finally {
      setSaving(false);
    }
  };

  const createStandalone = async () => {
    if (!title.trim()) { toast.error("أدخل عنوان المسابقة"); return; }
    const validQs = questions.filter(isValidQ);
    if (validQs.length === 0) { toast.error("أضف سؤالاً واحداً على الأقل"); return; }

    const sendQs = validQs.map(q => {
      if (q.type === "fill_blank") {
        // Build pipe-separated accepted-answers string for the game engine
        const alternatives = q.closeAnswers.split(",").map(s => s.trim()).filter(Boolean);
        const allAnswers = [q.fillAnswer.trim(), ...alternatives].join("|");
        return { text: q.text, questionType: "fill_blank", correctAnswer: allAnswers, optionA: "", optionB: "", optionC: "", optionD: "", difficulty: q.difficulty ?? null, audioUrl: q.audioUrl ?? null };
      }
      if (q.type === "tf") return { ...q, questionType: "true_false", optionA: "صح", optionB: "خطأ", optionC: "", optionD: "" };
      return { ...q, questionType: "mcq" };
    });

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/standalone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          questions: sendQs,
          notes: notes || null,
          timePerQuestion,
          leaderboardDisplay,
          expiresAt: expiresAt || null,
          questionsPerParticipant: diffDistribution ? null : (questionsPerParticipant === "" ? null : questionsPerParticipant),
          difficultyDistribution: diffDistribution,
          isMultiLevel,
          levels: isMultiLevel ? challengeLevels : null,
          allowedClasses,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("تم إنشاء المسابقة");
      setLocation(`/teacher/solo-challenges/${data.slug}`);
    } catch (err: any) {
      toast.error(err.message || "خطأ في الإنشاء");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-4 lg:py-5 flex items-center gap-4">
          <Link href="/teacher/solo-challenges" className="p-2 lg:p-2.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground group">
            <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="flex items-center gap-3 lg:gap-3.5">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
              <Target className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
            </div>
            <h1 className="text-lg lg:text-xl font-black text-foreground tracking-tight">مسابقة ذاتية جديدة</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">

        {/* Step 1: Source selection */}
        <AnimatePresence mode="popLayout">
          {!source && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 lg:space-y-8 max-w-3xl lg:max-w-5xl mx-auto mt-4 lg:mt-6">
              <div className="text-center space-y-2 lg:space-y-3 mb-8 lg:mb-10">
                <h2 className="text-2xl lg:text-3xl font-black text-foreground">كيف تريد إنشاء المسابقة؟</h2>
                <p className="text-sm lg:text-base text-muted-foreground font-medium">اختر الطريقة الأنسب لبدء التحدي</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 lg:gap-6">
                <button
                  onClick={() => setSource("assignment")}
                  className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-primary/50 rounded-3xl text-right transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/10 transition-colors" />
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-primary/10 shadow-sm relative z-10">
                    <BookOpen className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                  </div>
                  <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">من واجب موجود</h3>
                  <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">اختر واجباً من مكتبتك وانشر رابط مسابقة فردية مباشرةً بمحتواه</p>
                </button>

                <button
                  onClick={() => setSource("ai")}
                  className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-amber-500/50 rounded-3xl text-right transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-amber-500/10 transition-colors" />
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-amber-500/10 shadow-sm relative z-10">
                    <Sparkles className="w-6 h-6 lg:w-7 lg:h-7 text-amber-500" />
                  </div>
                  <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">بالذكاء الاصطناعي</h3>
                  <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">أنشئ أسئلة جديدة تلقائياً في أي موضوع، عدّل عليها، وانشرها</p>
                </button>

                <button
                  onClick={() => setSource("manual")}
                  className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-emerald-500/50 rounded-3xl text-right transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-emerald-500/10 transition-colors" />
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-emerald-500/10 shadow-sm relative z-10">
                    <PenLine className="w-6 h-6 lg:w-7 lg:h-7 text-emerald-600" />
                  </div>
                  <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">إضافة يدوية</h3>
                  <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">اكتب أسئلتك من الصفر — اختيار متعدد أو صح وخطأ بنفسك</p>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ ASSIGNMENT MODE ═══════════════ */}
        {source === "assignment" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8 max-w-3xl lg:max-w-4xl mx-auto">
            <div className="flex items-center gap-3 lg:gap-4 mb-2">
              <button onClick={() => { setSource(null); setSelectedAssignment(null); }} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div>
                <h2 className="font-black text-xl lg:text-2xl text-foreground">اختيار واجب</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">سيتم تحويل أسئلة الواجب إلى مسابقة ذاتية</p>
              </div>
            </div>

            <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden p-1">
              <div className="p-4 lg:p-5 border-b border-border/40">
                <div className="relative">
                  <Search className="absolute top-1/2 -translate-y-1/2 end-4 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground pointer-events-none" />
                  <input
                    value={assignSearch}
                    onChange={e => setAssignSearch(e.target.value)}
                    placeholder="ابحث في واجباتك المحفوظة..."
                    className="w-full pe-12 ps-4 py-3.5 lg:py-4 rounded-2xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/20 text-sm lg:text-base font-bold transition-all"
                  />
                </div>
              </div>

              {loadingAssignments ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
              ) : filteredAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-16 text-sm lg:text-base font-medium">لا توجد واجبات مطابقة</p>
              ) : (
                <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5 max-h-[400px] lg:max-h-[460px] overflow-y-auto">
                  {filteredAssignments.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssignment(a)}
                      className={cn(
                        "w-full text-right px-5 lg:px-6 py-4 lg:py-5 rounded-2xl border-2 transition-all group",
                        selectedAssignment?.id === a.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-transparent bg-background hover:bg-muted/50 hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className={cn("font-bold text-sm lg:text-base", selectedAssignment?.id === a.id ? "text-primary" : "text-foreground group-hover:text-primary")}>{a.title}</p>
                        {selectedAssignment?.id === a.id && <Check className="w-5 h-5 text-primary" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {selectedAssignment && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <div className="space-y-6">
                    <SettingsPanel
                      notes={notes} onNotes={setNotes}
                      timePerQuestion={timePerQuestion} onTime={setTimePerQuestion}
                      leaderboardDisplay={leaderboardDisplay} onLd={setLeaderboardDisplay}
                      expiresAt={expiresAt} onExpires={setExpiresAt}
                      questionsPerParticipant={questionsPerParticipant} onQpp={setQuestionsPerParticipant}
                      maxQuestions={selectedAssignment?.questionCount}
                      diffDistribution={diffDistribution} onDiffDistribution={setDiffDistribution}
                      isMultiLevel={isMultiLevel} onIsMultiLevel={setIsMultiLevel}
                      challengeLevels={challengeLevels} onChallengeLevels={setChallengeLevels}
                      allowedClasses={allowedClasses} onAllowedClasses={setAllowedClasses}
                      teacherClasses={teacherClasses}
                    />

                    <button
                      onClick={createFromAssignment}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                      {saving ? "جاري الإنشاء..." : "إنشاء المسابقة وبدء النشر"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══════════════ AI MODE ═══════════════ */}
        {source === "ai" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8">
            <div className="flex items-center gap-3 lg:gap-4 mb-2 max-w-3xl lg:max-w-none mx-auto">
              <button onClick={() => { setSource(null); setQuestions([]); }} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div>
                <h2 className="font-black text-xl lg:text-2xl text-foreground">ذكاء اصطناعي</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">ولّد أسئلة جديدة تلقائياً ثم عدّلها كما تشاء</p>
              </div>
            </div>

            <div className="grid md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:gap-8 items-start">
              {/* Main Content Area */}
              <div className="space-y-6 lg:space-y-7 order-2 md:order-1">
                {/* AI Generator Box */}
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 sm:p-6 lg:p-8 shadow-sm">
                  <div className="flex items-center gap-2 lg:gap-3 mb-5 lg:mb-6">
                    <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600" />
                    </div>
                    <h3 className="font-black text-base lg:text-lg text-amber-900 dark:text-amber-400">توليد الأسئلة</h3>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
                    <div>
                      <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">الموضوع *</label>
                      <input
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="مثال: الجهاز الهضمي"
                        className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">المادة (اختياري)</label>
                      <input
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="مثال: علوم"
                        className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:gap-5 mb-5 lg:mb-6">
                    <div>
                      <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">العدد</label>
                      <select
                        value={count}
                        onChange={e => setCount(Number(e.target.value))}
                        className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                      >
                        {[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n} أسئلة</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">المستوى</label>
                      <select
                        value={difficulty}
                        onChange={e => setDifficulty(e.target.value as Difficulty)}
                        className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                      >
                        <option value="easy">سهل</option>
                        <option value="medium">متوسط</option>
                        <option value="hard">صعب</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={generateWithAI}
                    disabled={generating || !topic.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 lg:py-4 rounded-xl font-black text-sm lg:text-base bg-gradient-to-l from-amber-500 to-orange-400 hover:from-amber-600 hover:to-orange-500 text-white transition-all disabled:opacity-50 shadow-md hover:shadow-amber-500/25 active:scale-95"
                  >
                    {generating ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />جاري التوليد...</>
                    ) : (
                      <><Sparkles className="w-5 h-5" />{questions.length > 0 ? "توليد أسئلة إضافية" : "توليد الأسئلة الآن"}</>
                    )}
                  </button>
                </div>

                {/* Questions list */}
                {questions.length > 0 && (
                  <div className="space-y-4 lg:space-y-5 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="font-black text-lg lg:text-xl text-foreground flex items-center gap-2">
                        أسئلة المسابقة
                        <span className="bg-muted px-2.5 py-0.5 rounded-md text-sm">{questions.length}</span>
                      </h3>
                      <button
                        onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                        className="flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        سؤال جديد
                      </button>
                    </div>
                    <div className="space-y-3 lg:space-y-4">
                      {questions.map((q, i) => (
                        <QuestionCard
                          key={i}
                          q={q}
                          index={i}
                          onChange={updated => setQuestions(prev => prev.map((x, j) => j === i ? updated : x))}
                          onDelete={() => setQuestions(prev => prev.filter((_, j) => j !== i))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Area */}
              <div className="order-1 md:order-2 space-y-5 md:sticky md:top-24">
                <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-5 lg:space-y-6">
                  <div>
                    <label className="block text-sm lg:text-base font-bold text-foreground mb-2 lg:mb-2.5">عنوان المسابقة النهائي *</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="يظهر للطلاب..."
                      className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all shadow-inner"
                    />
                  </div>
                  
                  <SettingsPanel
                    notes={notes} onNotes={setNotes}
                    timePerQuestion={timePerQuestion} onTime={setTimePerQuestion}
                    leaderboardDisplay={leaderboardDisplay} onLd={setLeaderboardDisplay}
                    expiresAt={expiresAt} onExpires={setExpiresAt}
                    questionsPerParticipant={questionsPerParticipant} onQpp={setQuestionsPerParticipant}
                    maxQuestions={questions.filter(q => q.text.trim() && q.optionA && q.optionB && q.optionC && q.optionD).length}
                    diffDistribution={diffDistribution} onDiffDistribution={setDiffDistribution}
                    isMultiLevel={isMultiLevel} onIsMultiLevel={setIsMultiLevel}
                    challengeLevels={challengeLevels} onChallengeLevels={setChallengeLevels}
                    allowedClasses={allowedClasses} onAllowedClasses={setAllowedClasses}
                    teacherClasses={teacherClasses}
                  />

                  <button
                    onClick={createStandalone}
                    disabled={saving || !title.trim() || questions.filter(isValidQ).length === 0}
                    className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                    إنشاء المسابقة
                  </button>
                  {questions.length === 0 && (
                    <p className="text-[10px] lg:text-xs text-center text-muted-foreground font-medium px-2">يجب توليد أو إضافة سؤال واحد على الأقل قبل الإنشاء</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ MANUAL MODE ═══════════════ */}
        {source === "manual" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8">
            <div className="flex items-center gap-3 lg:gap-4 mb-2 max-w-3xl lg:max-w-none mx-auto">
              <button onClick={() => { setSource(null); setQuestions([]); }} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div>
                <h2 className="font-black text-xl lg:text-2xl text-foreground">إضافة يدوية</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">اكتب الأسئلة والخيارات بنفسك خطوة بخطوة</p>
              </div>
            </div>

            <div className="grid md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:gap-8 items-start">
              {/* Main Content Area */}
              <div className="space-y-6 lg:space-y-7 order-2 md:order-1">
                {/* Questions list */}
                <div className="space-y-4 lg:space-y-5">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-lg lg:text-xl text-foreground flex items-center gap-2">
                      أسئلة المسابقة
                      <span className="bg-muted px-2.5 py-0.5 rounded-md text-sm">{questions.length}</span>
                    </h3>
                    {questions.length > 0 && (
                      <button
                        onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                        className="flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        سؤال جديد
                      </button>
                    )}
                  </div>
                  
                  {questions.length === 0 ? (
                    <div className="bg-card border-2 border-dashed border-border/60 rounded-3xl p-10 lg:p-14 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                         onClick={() => setQuestions([emptyQuestion()])}>
                      <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 lg:mb-5 group-hover:bg-primary/10 transition-colors">
                        <Plus className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="font-bold text-foreground text-lg lg:text-xl mb-1 lg:mb-1.5 group-hover:text-primary">أضف سؤالك الأول</p>
                      <p className="text-xs lg:text-sm text-muted-foreground">اضغط هنا للبدء في إضافة الأسئلة يدوياً</p>
                    </div>
                  ) : (
                    <div className="space-y-4 lg:space-y-5">
                      {questions.map((q, i) => (
                        <QuestionCard
                          key={i}
                          q={q}
                          index={i}
                          onChange={updated => setQuestions(prev => prev.map((x, j) => j === i ? updated : x))}
                          onDelete={() => setQuestions(prev => prev.filter((_, j) => j !== i))}
                        />
                      ))}
                      
                      {questions.length > 2 && (
                         <button
                          onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                          className="w-full py-5 lg:py-6 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors font-bold lg:text-base flex items-center justify-center gap-2"
                        >
                          <Plus className="w-5 h-5" /> أضف سؤالاً آخر
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Area */}
              <div className="order-1 md:order-2 space-y-5 md:sticky md:top-24">
                <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-5 lg:space-y-6">
                  <div>
                    <label className="block text-sm lg:text-base font-bold text-foreground mb-2 lg:mb-2.5">عنوان المسابقة *</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="مثال: اختبار الوحدة الأولى"
                      className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all shadow-inner"
                    />
                  </div>
                  
                  <SettingsPanel
                    notes={notes} onNotes={setNotes}
                    timePerQuestion={timePerQuestion} onTime={setTimePerQuestion}
                    leaderboardDisplay={leaderboardDisplay} onLd={setLeaderboardDisplay}
                    expiresAt={expiresAt} onExpires={setExpiresAt}
                    questionsPerParticipant={questionsPerParticipant} onQpp={setQuestionsPerParticipant}
                    maxQuestions={questions.filter(isValidQ).length}
                    diffDistribution={diffDistribution} onDiffDistribution={setDiffDistribution}
                    isMultiLevel={isMultiLevel} onIsMultiLevel={setIsMultiLevel}
                    challengeLevels={challengeLevels} onChallengeLevels={setChallengeLevels}
                    allowedClasses={allowedClasses} onAllowedClasses={setAllowedClasses}
                    teacherClasses={teacherClasses}
                  />

                  <button
                    onClick={createStandalone}
                    disabled={saving || !title.trim() || questions.filter(isValidQ).length === 0}
                    className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                    إنشاء المسابقة
                  </button>
                  {questions.length === 0 && (
                    <p className="text-[10px] lg:text-xs text-center text-muted-foreground font-medium px-2">يجب إضافة سؤال واحد على الأقل قبل الإنشاء</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  notes, onNotes,
  timePerQuestion, onTime,
  leaderboardDisplay, onLd,
  expiresAt, onExpires,
  questionsPerParticipant, onQpp,
  maxQuestions,
  diffDistribution, onDiffDistribution,
  isMultiLevel, onIsMultiLevel,
  challengeLevels, onChallengeLevels,
  allowedClasses, onAllowedClasses,
  teacherClasses,
}: {
  notes: string; onNotes: (v: string) => void;
  timePerQuestion: number; onTime: (v: number) => void;
  leaderboardDisplay: "top3" | "top20" | "all"; onLd: (v: "top3" | "top20" | "all") => void;
  expiresAt: string; onExpires: (v: string) => void;
  questionsPerParticipant: number | ""; onQpp: (v: number | "") => void;
  maxQuestions?: number;
  diffDistribution: DiffDistribution | null; onDiffDistribution: (v: DiffDistribution | null) => void;
  isMultiLevel: boolean; onIsMultiLevel: (v: boolean) => void;
  challengeLevels: ChallengeLevel[]; onChallengeLevels: (v: ChallengeLevel[]) => void;
  allowedClasses: string[]; onAllowedClasses: (v: string[]) => void;
  teacherClasses: string[];
}) {
  const [open, setOpen] = useState(false);

  const updateLevel = (i: number, patch: Partial<ChallengeLevel>) => {
    onChallengeLevels(challengeLevels.map((l, j) => j === i ? { ...l, ...patch } : l));
  };
  const removeLevel = (i: number) => {
    if (challengeLevels.length <= 1) return;
    onChallengeLevels(challengeLevels.filter((_, j) => j !== i));
  };
  const addLevel = () => {
    if (challengeLevels.length >= 10) return;
    const arabicOrdinal = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة","الثامنة","التاسعة","العاشرة"];
    onChallengeLevels([...challengeLevels, {
      name: `المرحلة ${arabicOrdinal[challengeLevels.length] ?? challengeLevels.length + 1}`,
      questionCount: 5,
      timePerQuestion: 20,
    }]);
  };

  const adjustDist = (key: keyof DiffDistribution, delta: number) => {
    if (!diffDistribution) return;
    onDiffDistribution({ ...diffDistribution, [key]: Math.max(0, diffDistribution[key] + delta) });
  };
  const distTotal = diffDistribution ? diffDistribution.easy + diffDistribution.medium + diffDistribution.hard : 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 lg:px-5 py-3.5 lg:py-4 text-sm lg:text-base font-bold text-foreground hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          إعدادات إضافية
          {(diffDistribution || isMultiLevel) && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              {isMultiLevel ? `${challengeLevels.length} مراحل` : `${distTotal} مخصص`}
            </span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border/40 pb-2">

               {/* ── Participant instructions ── */}
               <div className="px-4 py-4 hover:bg-muted/10 transition-colors">
                 <label className="flex items-center gap-2 text-xs font-bold text-foreground mb-2.5">
                   <FileText className="w-4 h-4 text-primary" />
                   تعليمات أو ملاحظات للمشاركين
                 </label>
                 <textarea
                   value={notes} onChange={e => onNotes(e.target.value)}
                   placeholder="تعليمات أو رسالة تظهر قبل البدء..."
                   rows={2} maxLength={1000}
                   className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary text-xs font-medium resize-none shadow-sm transition-colors"
                 />
               </div>

              {/* ── Multi-level toggle ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-muted/10 transition-colors">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  مراحل متعددة
                </label>
                <button
                  onClick={() => onIsMultiLevel(!isMultiLevel)}
                  className={cn("relative w-10 h-6 rounded-full transition-colors flex-shrink-0 border-2 self-start sm:self-auto", isMultiLevel ? "bg-emerald-500 border-emerald-500" : "bg-muted border-transparent")}
                >
                  <span className={cn("absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", isMultiLevel ? "start-[18px]" : "start-[2px]")} />
                </button>
              </div>
              {isMultiLevel && (
                <div className="px-4 py-4 bg-muted/20 space-y-3">
                  <p className="text-[11px] font-medium text-muted-foreground">قسّم المسابقة إلى مراحل، بخصائص مستقلة لكل مرحلة.</p>
                  <div className="space-y-2">
                    {challengeLevels.map((lv, i) => (
                      <div key={i} className="bg-card rounded-xl p-3 border border-border/60 shadow-sm relative group">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-6 h-6 rounded-md bg-muted text-muted-foreground text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                          <input value={lv.name} onChange={e => updateLevel(i, { name: e.target.value })} placeholder={`المرحلة ${i + 1}`} maxLength={50}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 focus:outline-none focus:border-emerald-500 text-sm font-bold shadow-inner" />
                          {challengeLevels.length > 1 && (
                            <button onClick={() => removeLevel(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                            <span className="block text-[10px] font-bold text-muted-foreground mb-1.5 text-center">عدد الأسئلة</span>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => updateLevel(i, { questionCount: Math.max(1, lv.questionCount - 1) })} className="w-6 h-6 rounded-md bg-background border shadow-sm font-black text-xs flex items-center justify-center hover:bg-muted">−</button>
                              <span className="w-6 text-center text-xs font-black">{lv.questionCount}</span>
                              <button onClick={() => updateLevel(i, { questionCount: Math.min(200, lv.questionCount + 1) })} className="w-6 h-6 rounded-md bg-background border shadow-sm font-black text-xs flex items-center justify-center hover:bg-muted">+</button>
                            </div>
                          </div>
                          <div className="bg-muted/30 p-2 rounded-lg border border-border/40">
                            <span className="block text-[10px] font-bold text-muted-foreground mb-1.5 text-center">الوقت (ثواني)</span>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => updateLevel(i, { timePerQuestion: Math.max(5, lv.timePerQuestion - 5) })} className="w-6 h-6 rounded-md bg-background border shadow-sm font-black text-xs flex items-center justify-center hover:bg-muted">−</button>
                              <span className="w-6 text-center text-xs font-black">{lv.timePerQuestion}</span>
                              <button onClick={() => updateLevel(i, { timePerQuestion: Math.min(120, lv.timePerQuestion + 5) })} className="w-6 h-6 rounded-md bg-background border shadow-sm font-black text-xs flex items-center justify-center hover:bg-muted">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {challengeLevels.length < 10 && (
                    <button onClick={addLevel} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 transition-colors text-xs font-bold">
                      <Plus className="w-4 h-4" /> إضافة مرحلة
                    </button>
                  )}
                  <div className="text-center pt-1">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      الإجمالي: {challengeLevels.reduce((s, l) => s + l.questionCount, 0)} سؤال عبر {challengeLevels.length} مراحل
                    </span>
                  </div>
                </div>
              )}

              {/* ── Time per question ── */}
              {!isMultiLevel && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-muted/10 transition-colors">
                  <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Clock className="w-4 h-4 text-amber-500" />
                    وقت كل سؤال
                  </label>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/50 p-1 rounded-xl border border-border/50">
                    <button onClick={() => onTime(Math.max(5, timePerQuestion - 5))} className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors shadow-sm border border-border/50">−</button>
                    <span className="w-12 text-center text-xs font-black tabular-nums text-foreground">{timePerQuestion} ث</span>
                    <button onClick={() => onTime(Math.min(120, timePerQuestion + 5))} className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors shadow-sm border border-border/50">+</button>
                  </div>
                </div>
              )}

              {/* ── Difficulty distribution ── */}
              {!isMultiLevel && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-muted/10 transition-colors">
                    <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Target className="w-4 h-4 text-primary" />
                      توزيع الصعوبة
                    </label>
                    <button
                      onClick={() => onDiffDistribution(diffDistribution ? null : { easy: 4, medium: 4, hard: 2 })}
                      className={cn("relative w-10 h-6 rounded-full transition-colors flex-shrink-0 border-2 self-start sm:self-auto", diffDistribution ? "bg-primary border-primary" : "bg-muted border-transparent")}
                    >
                      <span className={cn("absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", diffDistribution ? "start-[18px]" : "start-[2px]")} />
                    </button>
                  </div>
                  {diffDistribution && (
                    <div className="px-4 py-4 bg-primary/5 space-y-3 mx-2 mb-2 rounded-xl border border-primary/10">
                      <p className="text-[10px] font-bold text-primary/80">خصص عدد أسئلة كل مستوى (صنّف الأسئلة أولاً)</p>
                      <div className="grid gap-2">
                        {([
                          { key: "easy" as const, label: "سهل", color: "bg-emerald-500" },
                          { key: "medium" as const, label: "متوسط", color: "bg-amber-500" },
                          { key: "hard" as const, label: "صعب", color: "bg-red-500" },
                        ]).map(({ key, label, color }) => (
                          <div key={key} className="flex items-center justify-between bg-card px-2 py-1.5 rounded-lg border shadow-sm">
                            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded text-white w-14 text-center", color)}>{label}</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => adjustDist(key, -1)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 font-black text-sm flex items-center justify-center">−</button>
                              <span className="w-6 text-center font-black text-xs">{diffDistribution[key]}</span>
                              <button onClick={() => adjustDist(key, +1)} className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 font-black text-sm flex items-center justify-center">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between border-t border-primary/10 pt-2 px-1">
                        <span className="text-[10px] font-bold text-primary">الإجمالي:</span>
                        <span className="text-xs font-black text-primary">{distTotal}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Questions per participant ── */}
              {!isMultiLevel && !diffDistribution && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-muted/10 transition-colors">
                  <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Target className="w-4 h-4 text-emerald-500" />
                    أسئلة لكل متسابق
                  </label>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/50 p-1 rounded-xl border border-border/50">
                    <button
                      onClick={() => {
                        if (questionsPerParticipant === "" || (questionsPerParticipant as number) <= 1) onQpp("");
                        else onQpp((questionsPerParticipant as number) - 1);
                      }}
                      className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors shadow-sm border border-border/50"
                    >−</button>
                    <span className="w-12 text-center text-xs font-black text-foreground">
                      {questionsPerParticipant === "" ? "الكل" : String(questionsPerParticipant)}
                    </span>
                    <button
                      onClick={() => {
                        const cur = questionsPerParticipant === "" ? 0 : (questionsPerParticipant as number);
                        const next = cur + 1;
                        if (maxQuestions && next > maxQuestions) return;
                        onQpp(next);
                      }}
                      className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors shadow-sm border border-border/50"
                    >+</button>
                  </div>
                </div>
              )}

              {/* ── Leaderboard ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-muted/10 transition-colors">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  المتصدرين
                </label>
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
                  {([
                    { value: "top3" as const, label: "أفضل 3" },
                    { value: "top20" as const, label: "أفضل 20" },
                    { value: "all" as const, label: "الكل" },
                  ]).map((o) => {
                    const active = leaderboardDisplay === o.value;
                    return (
                      <button key={o.value} onClick={() => onLd(o.value)}
                        className={cn(
                          "px-3 py-1.5 text-[11px] font-bold transition-all rounded-lg relative",
                           active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="relative z-10">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Expiry ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3 hover:bg-muted/10 transition-colors">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground shrink-0">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  انتهاء المسابقة
                </label>
                <div className="flex items-center gap-2 self-start sm:self-auto min-w-0">
                  <span dir="ltr">
                    <input type="datetime-local" lang="en" value={expiresAt} onChange={e => onExpires(e.target.value)}
                      className="text-[11px] font-bold px-3 py-2 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary shadow-sm min-w-0" />
                  </span>
                  {expiresAt && (
                    <button onClick={() => onExpires("")} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20" title="إزالة">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Class restriction ── */}
              <div className="px-4 py-4 hover:bg-muted/10 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Users className="w-4 h-4 text-emerald-600" />
                    تقييد بالصف
                  </label>
                  {allowedClasses.length > 0 && (
                    <span className="text-[10px] font-black text-primary-foreground bg-primary px-2 py-0.5 rounded-md">
                      {allowedClasses.length} صف
                    </span>
                  )}
                </div>
                {teacherClasses.length === 0 ? (
                   <p className="text-[10px] font-bold text-amber-600 bg-amber-500/10 p-2 rounded-lg">لا توجد صفوف بحسابك.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {teacherClasses.map(cls => {
                      const sel = allowedClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          onClick={() => onAllowedClasses(sel ? allowedClasses.filter(c => c !== cls) : [...allowedClasses, cls])}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1",
                            sel
                              ? "bg-primary border-primary text-primary-foreground shadow-sm"
                              : "bg-card border-border/60 text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          {sel && <Check className="w-3 h-3" />}
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}