import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Plus, Trash2, Database, CheckCircle, Search, Filter, Download, Globe, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useGetCurrentTeacher, useListAssignments } from "@workspace/api-client-react";

const BASE = import.meta.env.VITE_API_URL || "";

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
  isShared: boolean;
  createdAt: string;
}

export default function QuestionBankPage() {
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const { data: user, error: userError } = useGetCurrentTeacher({ query: { retry: false } });
  const { data: assignments } = useListAssignments(
    user ? { teacherId: user.id } : undefined,
    { query: { enabled: !!user } }
  );

  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [newText, setNewText] = useState("");
  const [newOptionA, setNewOptionA] = useState("");
  const [newOptionB, setNewOptionB] = useState("");
  const [newOptionC, setNewOptionC] = useState("");
  const [newOptionD, setNewOptionD] = useState("");
  const [newCorrectAnswer, setNewCorrectAnswer] = useState("");
  const [newPoints, setNewPoints] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userError) setLocation("/login");
  }, [userError, setLocation]);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${BASE}/api/question-bank`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleAdd = async () => {
    if (!newText.trim()) {
      toast.error(lang === "ar" ? "يجب ملء نص السؤال" : "Question text is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/question-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: newSubject,
          text: newText,
          optionA: newOptionA || null,
          optionB: newOptionB || null,
          optionC: newOptionC || null,
          optionD: newOptionD || null,
          correctAnswer: newCorrectAnswer || null,
          points: newPoints,
        }),
      });
      if (res.ok) {
        const q = await res.json();
        setQuestions([q, ...questions]);
        setShowAddForm(false);
        resetForm();
        toast.success(lang === "ar" ? "تمت الإضافة بنجاح" : "Question added");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || (lang === "ar" ? "خطأ في الإضافة" : "Error adding question"));
      }
    } catch (e) {
      toast.error(lang === "ar" ? "خطأ في الإضافة" : "Error adding question");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qId: number) => {
    if (!confirm(t.questionBank.deleteConfirm)) return;
    try {
      const res = await fetch(`${BASE}/api/question-bank/${qId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== qId));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || (lang === "ar" ? "خطأ في الحذف" : "Error deleting"));
      }
    } catch (e) {
      toast.error(lang === "ar" ? "خطأ في الحذف" : "Error deleting");
    }
  };

  const handleToggleShare = async (qId: number, currentShared: boolean) => {
    try {
      const res = await fetch(`${BASE}/api/question-bank/${qId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isShared: !currentShared }),
      });
      if (res.ok) {
        setQuestions(questions.map(q => q.id === qId ? { ...q, isShared: !currentShared } : q));
        toast.success(!currentShared
          ? (lang === "ar" ? "تم مشاركة السؤال" : "Question shared")
          : (lang === "ar" ? "تم إلغاء المشاركة" : "Question unshared"));
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    }
  };

  const handleImportFromAssignment = async (assignmentId: number) => {
    try {
      const res = await fetch(`${BASE}/api/question-bank/import-from-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(t.questionBank.importSuccess.replace("{count}", String(data.count)));
        setShowImportModal(false);
        fetchQuestions();
      } else {
        const err = await res.json();
        toast.error(err.message || t.questionBank.importError);
      }
    } catch (e) {
      toast.error(t.questionBank.importError);
    }
  };

  const resetForm = () => {
    setNewSubject("");
    setNewText("");
    setNewOptionA("");
    setNewOptionB("");
    setNewOptionC("");
    setNewOptionD("");
    setNewCorrectAnswer("");
    setNewPoints(1);
  };

  const subjects = [...new Set(questions.map((q) => q.subject))];
  const filtered = questions.filter((q) => {
    if (filterSubject && q.subject !== filterSubject) return false;
    if (searchText && !q.text.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  if (userError) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <button onClick={() => setLocation("/teacher")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-6 transition-colors">
          <BackArrow className="w-5 h-5" />
          {t.questionBank.backToDashboard}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
              <Database className="w-8 h-8 text-indigo-600" />
              {t.questionBank.title}
            </h1>
            <p className="text-muted-foreground mt-1">{t.questionBank.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportModal(true)} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              {t.questionBank.importFromAssignment}
            </Button>
            <Button onClick={() => setShowAddForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t.questionBank.addQuestion}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-3 text-muted-foreground" style={{ [lang === "ar" ? "right" : "left"]: "12px" }} />
            <input
              type="text"
              placeholder={lang === "ar" ? "ابحث في الأسئلة..." : "Search questions..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full px-10 py-2.5 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-all"
            />
          </div>
          {subjects.length > 1 && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-all"
            >
              <option value="">{t.questionBank.allSubjects}</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} {t.questionBank.questionsCount}</p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 animate-pulse"><div className="h-5 w-3/4 bg-muted/60 rounded" /></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="py-16 text-center border-dashed">
            <Database className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">{t.questionBank.noQuestions}</h3>
            <p className="text-muted-foreground mb-6">{t.questionBank.noQuestionsDesc}</p>
            <Button onClick={() => setShowAddForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t.questionBank.addQuestion}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((q, i) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={`p-4 sm:p-5 hover:border-primary/30 transition-all ${lang === "ar" ? "border-r-4 border-r-indigo-500" : "border-l-4 border-l-indigo-500"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded">{q.subject}</span>
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-bold rounded">{q.points} {lang === "ar" ? "درجة" : "pts"}</span>
                        {q.correctAnswer && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {q.correctAnswer}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-foreground mb-2">{q.text}</p>
                      {(q.optionA || q.optionB) && (
                        <div className="grid grid-cols-2 gap-1.5 text-sm text-muted-foreground">
                          {q.optionA && <span className={q.correctAnswer === "A" ? "text-green-600 font-bold" : ""}>أ) {q.optionA}</span>}
                          {q.optionB && <span className={q.correctAnswer === "B" ? "text-green-600 font-bold" : ""}>ب) {q.optionB}</span>}
                          {q.optionC && <span className={q.correctAnswer === "C" ? "text-green-600 font-bold" : ""}>ج) {q.optionC}</span>}
                          {q.optionD && <span className={q.correctAnswer === "D" ? "text-green-600 font-bold" : ""}>د) {q.optionD}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleShare(q.id, q.isShared)}
                        className={`p-2 rounded-lg transition-colors ${q.isShared ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30" : "text-muted-foreground hover:bg-muted/50"}`}
                        title={q.isShared ? (lang === "ar" ? "إلغاء المشاركة" : "Unshare") : (lang === "ar" ? "مشاركة عامة" : "Share publicly")}
                      >
                        {q.isShared ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-black text-foreground mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                {t.questionBank.addQuestion}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold mb-1">{t.questionBank.subject}</label>
                  <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                    placeholder={t.questionBank.subjectPlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">{t.questionBank.questionText}</label>
                  <textarea value={newText} onChange={(e) => setNewText(e.target.value)}
                    placeholder={t.questionBank.questionPlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-all min-h-[80px] resize-y" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B", "C", "D"] as const).map((opt) => (
                    <div key={opt} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewCorrectAnswer(newCorrectAnswer === opt ? "" : opt)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border-2 transition-all ${
                          newCorrectAnswer === opt ? "bg-green-500 border-green-500 text-white" : "border-border text-muted-foreground hover:border-green-400"
                        }`}
                      >{opt}</button>
                      <input
                        type="text"
                        value={opt === "A" ? newOptionA : opt === "B" ? newOptionB : opt === "C" ? newOptionC : newOptionD}
                        onChange={(e) => {
                          if (opt === "A") setNewOptionA(e.target.value);
                          else if (opt === "B") setNewOptionB(e.target.value);
                          else if (opt === "C") setNewOptionC(e.target.value);
                          else setNewOptionD(e.target.value);
                        }}
                        placeholder={`${t.questionBank.optionPlaceholder} ${opt}`}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">{t.questionBank.points}</label>
                  <input type="number" min="0.5" step="0.5" value={newPoints} onChange={(e) => setNewPoints(parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 rounded-xl bg-background border-2 border-border text-center font-bold focus:outline-none focus:border-primary transition-all" />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors">
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={handleAdd} disabled={saving}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {saving ? t.questionBank.saving : t.questionBank.save}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowImportModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-black text-foreground mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-indigo-600" />
                {t.questionBank.importFromAssignment}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{t.questionBank.chooseAssignment}</p>

              {assignments && assignments.filter((a: any) => a.questionCount > 0).length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {assignments.filter((a: any) => a.questionCount > 0).map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => handleImportFromAssignment(a.id)}
                      className="w-full text-start p-3 rounded-xl border-2 border-border hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{a.subject}</span>
                          <p className="font-bold text-foreground mt-1">{a.title}</p>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{a.questionCount} {t.questionBank.questionsCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">{lang === "ar" ? "لا توجد واجبات" : "No assignments"}</p>
              )}

              <button onClick={() => setShowImportModal(false)}
                className="w-full mt-4 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors">
                {lang === "ar" ? "إغلاق" : "Close"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
