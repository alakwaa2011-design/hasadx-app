/**
 * /teacher/solo-challenges/new
 * إنشاء مسابقة وميض فردي جديدة:
 *   - من واجب موجود، أو
 *   - أسئلة جديدة بمساعدة الذكاء الاصطناعي + تعديل يدوي
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Sparkles, BookOpen, ChevronLeft, Plus, Trash2, Check,
  Loader2, Search, Clock, Trophy, FileText, Calendar, ChevronDown,
  Edit3, Save, X, AlertCircle, Settings,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "";

type Source = "assignment" | "ai";
type Difficulty = "easy" | "medium" | "hard";
type Correct = "A" | "B" | "C" | "D";

interface Question {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: Correct;
}

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  createdAt?: string;
}

function emptyQuestion(): Question {
  return { text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" };
}

function QuestionCard({
  q, index, onChange, onDelete,
}: {
  q: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(q.text === "");
  const opts: Correct[] = ["A", "B", "C", "D"];
  const labels = ["أ", "ب", "ج", "د"];

  if (!editing) {
    return (
      <div className="bg-card border border-border/60 rounded-xl p-4 group" dir="rtl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground mb-2">{index + 1}. {q.text}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {opts.map((opt, oi) => (
                <div
                  key={opt}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium",
                    q.correctAnswer === opt
                      ? "bg-green-500/15 text-green-700 border border-green-500/30"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="font-bold">{labels[oi]}.</span>
                  <span className="truncate">{q[`option${opt}` as keyof Question]}</span>
                  {q.correctAnswer === opt && <Check className="w-3 h-3 shrink-0 ms-auto" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-amber-500/40 rounded-xl p-4 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-amber-600">سؤال {index + 1}</span>
        <div className="flex gap-1">
          {q.text.trim() && (
            <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors">
              <Save className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <textarea
        value={q.text}
        onChange={e => onChange({ ...q, text: e.target.value })}
        placeholder="نص السؤال..."
        rows={2}
        className="w-full text-sm rounded-lg px-3 py-2 bg-muted border border-border focus:outline-none focus:border-amber-500 resize-none mb-3 text-foreground placeholder:text-muted-foreground"
      />
      <div className="grid grid-cols-2 gap-2 mb-3">
        {opts.map((opt, oi) => (
          <div key={opt} className="flex items-center gap-1.5">
            <button
              onClick={() => onChange({ ...q, correctAnswer: opt })}
              className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors",
                q.correctAnswer === opt
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-border text-muted-foreground hover:border-green-400",
              )}
            >
              {labels[oi]}
            </button>
            <input
              value={q[`option${opt}` as keyof Question] as string}
              onChange={e => onChange({ ...q, [`option${opt}`]: e.target.value })}
              placeholder={`الخيار ${labels[oi]}`}
              className="flex-1 text-xs rounded-lg px-2.5 py-1.5 bg-muted border border-border focus:outline-none focus:border-amber-500 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">اضغط على الدائرة لاختيار الإجابة الصحيحة</p>
    </div>
  );
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
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) setLocation("/login");
  }, [user, authLoading]);

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
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: (["A","B","C","D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
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

      // Apply settings if changed
      if (notes || expiresAt || timePerQuestion !== 20 || leaderboardDisplay !== "top20") {
        await fetch(`${API}/api/solo-challenges/${encodeURIComponent(data.slug)}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notes: notes || null, expiresAt: expiresAt || null, timePerQuestion, leaderboardDisplay }),
        });
      }

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
    const validQs = questions.filter(q => q.text.trim() && q.optionA && q.optionB && q.optionC && q.optionD);
    if (validQs.length === 0) { toast.error("أضف سؤالاً واحداً على الأقل بخياراته"); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/standalone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          questions: validQs,
          notes: notes || null,
          timePerQuestion,
          leaderboardDisplay,
          expiresAt: expiresAt || null,
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/60 bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/teacher/solo-challenges" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <h1 className="text-base font-black text-foreground">مسابقة وميض فردي جديدة</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Step 1: Source selection */}
        {!source && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">كيف تريد إنشاء المسابقة؟</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => setSource("assignment")}
                className="group p-6 bg-card border-2 border-border hover:border-blue-500/50 rounded-2xl text-right transition-all hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center mb-4 transition-colors">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-black text-foreground mb-1">من واجب موجود</h3>
                <p className="text-sm text-muted-foreground">اختر واجباً من مكتبتك وانشر رابط مسابقة فردية مباشرةً</p>
              </button>

              <button
                onClick={() => setSource("ai")}
                className="group p-6 bg-card border-2 border-border hover:border-amber-500/50 rounded-2xl text-right transition-all hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center mb-4 transition-colors">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="font-black text-foreground mb-1">أسئلة بالذكاء الاصطناعي</h3>
                <p className="text-sm text-muted-foreground">أنشئ أسئلة جديدة تلقائياً، عدّل عليها، وأضف ما تشاء</p>
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ ASSIGNMENT MODE ═══════════════ */}
        {source === "assignment" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setSource(null); setSelectedAssignment(null); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
              <h2 className="font-bold text-foreground">اختر واجباً</h2>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={assignSearch}
                onChange={e => setAssignSearch(e.target.value)}
                placeholder="ابحث في واجباتك..."
                className="w-full pe-10 ps-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:border-primary text-sm"
              />
            </div>

            {loadingAssignments ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredAssignments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد واجبات مطابقة</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {filteredAssignments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssignment(a)}
                    className={cn(
                      "w-full text-right px-4 py-3 rounded-xl border-2 transition-all",
                      selectedAssignment?.id === a.id
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-border bg-card hover:border-amber-500/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-foreground">{a.title}</p>
                      {selectedAssignment?.id === a.id && <Check className="w-4 h-4 text-amber-500" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedAssignment && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm font-medium text-amber-700">تم اختيار: <strong>{selectedAssignment.title}</strong></p>
              </div>
            )}

            {/* Settings */}
            <SettingsPanel
              notes={notes} onNotes={setNotes}
              timePerQuestion={timePerQuestion} onTime={setTimePerQuestion}
              leaderboardDisplay={leaderboardDisplay} onLd={setLeaderboardDisplay}
              expiresAt={expiresAt} onExpires={setExpiresAt}
            />

            <button
              onClick={createFromAssignment}
              disabled={!selectedAssignment || saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {saving ? "جاري الإنشاء..." : "إنشاء المسابقة"}
            </button>
          </motion.div>
        )}

        {/* ═══════════════ AI MODE ═══════════════ */}
        {source === "ai" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center gap-2">
              <button onClick={() => { setSource(null); setQuestions([]); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
              <h2 className="font-bold text-foreground">إنشاء أسئلة بالذكاء الاصطناعي</h2>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-1.5">عنوان المسابقة *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="مثال: مسابقة علوم الصف الخامس"
                className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>

            {/* AI Generator */}
            <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-foreground">مولّد الأسئلة بالذكاء الاصطناعي</h3>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">الموضوع *</label>
                  <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="مثال: الحرارة والمادة"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">المادة (اختياري)</label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="مثال: علوم، تاريخ، رياضيات"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">عدد الأسئلة</label>
                  <select
                    value={count}
                    onChange={e => setCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none text-sm"
                  >
                    {[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n} أسئلة</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">المستوى</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as Difficulty)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none text-sm"
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-l from-amber-500 to-orange-400 hover:from-amber-600 hover:to-orange-500 text-white transition-all disabled:opacity-50 shadow-sm"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />جاري التوليد...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />{questions.length > 0 ? "توليد المزيد" : "توليد الأسئلة"}</>
                )}
              </button>
            </div>

            {/* Questions list */}
            {questions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground">{questions.length} سؤال</h3>
                  <button
                    onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-amber-500 text-amber-600 hover:bg-amber-500/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة سؤال
                  </button>
                </div>
                <div className="space-y-2">
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

            {questions.length === 0 && (
              <button
                onClick={() => setQuestions([emptyQuestion()])}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-600 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                أضف سؤالاً يدوياً
              </button>
            )}

            {/* Settings */}
            <SettingsPanel
              notes={notes} onNotes={setNotes}
              timePerQuestion={timePerQuestion} onTime={setTimePerQuestion}
              leaderboardDisplay={leaderboardDisplay} onLd={setLeaderboardDisplay}
              expiresAt={expiresAt} onExpires={setExpiresAt}
            />

            {/* Create button */}
            <button
              onClick={createStandalone}
              disabled={saving || !title.trim() || questions.filter(q => q.text.trim() && q.optionA && q.optionB && q.optionC && q.optionD).length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {saving ? "جاري الإنشاء..." : `إنشاء المسابقة (${questions.filter(q => q.text.trim() && q.optionA && q.optionB && q.optionC && q.optionD).length} سؤال)`}
            </button>
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
}: {
  notes: string; onNotes: (v: string) => void;
  timePerQuestion: number; onTime: (v: number) => void;
  leaderboardDisplay: "top3" | "top20" | "all"; onLd: (v: "top3" | "top20" | "all") => void;
  expiresAt: string; onExpires: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          إعدادات المسابقة
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
            <div className="px-4 pb-4 space-y-4 border-t border-border/40">
              {/* Notes */}
              <div className="pt-4">
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  ملاحظات تظهر قبل المسابقة
                </label>
                <textarea
                  value={notes}
                  onChange={e => onNotes(e.target.value)}
                  placeholder="تعليمات أو رسالة للاعبين..."
                  rows={2}
                  maxLength={1000}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm resize-none"
                />
              </div>

              {/* Time per question */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  وقت كل سؤال: <span className="text-foreground">{timePerQuestion} ثانية</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={5} max={120} step={5}
                    value={timePerQuestion}
                    onChange={e => onTime(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <div className="flex gap-1">
                    {[10, 20, 30, 60].map(t => (
                      <button
                        key={t}
                        onClick={() => onTime(t)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold transition-colors",
                          timePerQuestion === t ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
                        )}
                      >
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leaderboard display */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  عرض لوحة المتصدرين
                </label>
                <div className="flex gap-2">
                  {[
                    { value: "top3", label: "أفضل 3" },
                    { value: "top20", label: "أفضل 20" },
                    { value: "all", label: "الكل" },
                  ].map(o => (
                    <button
                      key={o.value}
                      onClick={() => onLd(o.value as any)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold border transition-colors",
                        leaderboardDisplay === o.value
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "border-border text-muted-foreground hover:border-amber-500/40",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  موعد انتهاء المسابقة (اختياري)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={e => onExpires(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

