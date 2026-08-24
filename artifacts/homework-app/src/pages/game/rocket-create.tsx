import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, ChevronDown, ChevronUp, Plus, Sparkles, PenLine, Wand2,
  Check, X, Loader2, FileText, FolderOpen,
  GraduationCap, Trash2, BookOpen, Rocket, Copy,
  ExternalLink, Users, Database,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getRocketSocket } from "@/lib/rocket-socket";
import { creditAwareFetch, isInsufficientCreditsResponse } from "@/lib/credit-aware-fetch";
import { toast } from "@/components/ui/sonner";
import QRCode from "react-qr-code";

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
  imageUrl?: string | null;
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
  imageUrl?: string | null;
}

const correctAnswerToIndex = (ca: string | null): number => {
  if (!ca) return 0;
  return { A: 0, B: 1, C: 2, D: 3 }[ca.toUpperCase()] ?? 0;
};

const bankToRocket = (bq: BankQuestion): RocketQuestion => ({
  text: bq.text,
  type: "mcq",
  options: [bq.optionA || "", bq.optionB || "", bq.optionC || "", bq.optionD || ""],
  correct: correctAnswerToIndex(bq.correctAnswer),
  imageUrl: bq.imageUrl || null,
});

function StarField() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 3,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 + s.delay, delay: s.delay }}
          style={{
            position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
            boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.6)`,
          }}
        />
      ))}
    </div>
  );
}

export default function RocketCreate() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const ar = lang === "ar";
  const [, setLocation] = useLocation();

  const [questions, setQuestions] = useState<RocketQuestion[]>([]);
  const [questionsEditorOpen, setQuestionsEditorOpen] = useState(false);
  const [step, setStep] = useState<"questions" | "settings">("questions");
  const [duration, setDuration] = useState(20);
  // Race timer: 1-15 minutes; defaults to 5. Race auto-ends when timer hits zero.
  const [gameDurationMins, setGameDurationMins] = useState(5);
  const [advanceMode, setAdvanceMode] = useState<"per_player" | "host_sync">("per_player");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
  const [targetClass, setTargetClass] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Game created state
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Bank
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());

  // Assignments
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignments, setAssignments] = useState<{ id: number; title: string; subject: string; questionCount: number }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignImporting, setAssignImporting] = useState<number | null>(null);

  // Templates
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ id: number; title: string; questions: RocketQuestion[]; duration: number; isOwn?: boolean; fromAdmin?: boolean }[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

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
        type RawQ = { questionType?: string; text?: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string; imageUrl?: string | null };
        const qs = ((data.questions || []) as RawQ[])
          .filter(q => q.questionType === "mcq" && !!q.optionA && !!q.optionB && !!q.optionC && !!q.optionD && !!q.correctAnswer)
          .map(q => bankToRocket({
            id: 0, subject: data.subject || "", text: q.text || "",
            optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
            correctAnswer: q.correctAnswer || "A", points: 1, tags: null, imageUrl: q.imageUrl || null,
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

  const handleCreate = () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف أسئلة أولاً" : "Add questions first");
      return;
    }
    if (questions.some(q => !q.text.trim() || q.options.some(option => !option.trim()))) {
      toast.error(ar ? "أكمل نص كل سؤال وخياراته الأربعة أولاً" : "Complete each question and its four options first");
      return;
    }
    setCreating(true);
    const socket = getRocketSocket();
    socket.emit("rocket:create", {
      questions, duration,
      // Race timer in seconds (1-15 min selectable on this screen).
      totalDurationSecs: Math.max(1, Math.min(15, gameDurationMins)) * 60,
      targetClass: targetClass || undefined,
      title: title.trim() || undefined,
      advanceMode,
    }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
      setCreating(false);
      if (res.error) { toast.error(res.error); return; }
      if (res.pin && res.creatorToken) {
        sessionStorage.setItem(`rocket-creator-${res.pin}`, res.creatorToken);
        // Go directly to host panel — no intermediate PIN page
        setLocation(`/game/rocket/host/${res.pin}`);
      }
    });
  };

  const hasCompleteQuestions = questions.length > 0
    && !questions.some(q => !q.text.trim() || q.options.some(option => !option.trim()));

  const handleNextToSettings = () => {
    if (questions.length === 0) {
      toast.error(ar ? "أضف سؤالاً واحداً على الأقل أولاً" : "Add at least one question first");
      return;
    }
    if (!hasCompleteQuestions) {
      toast.error(ar ? "أكمل نص كل سؤال وخياراته الأربعة أولاً" : "Complete each question and its four options first");
      setQuestionsEditorOpen(true);
      return;
    }
    setStep("settings");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addManualQuestion = () => {
    if (questions.length >= 30) {
      toast.error(ar ? "الحد الأقصى هو 30 سؤالاً للسباق" : "The race supports up to 30 questions");
      return;
    }
    setQuestions(previous => [...previous, {
      text: "",
      type: "mcq",
      options: ["", "", "", ""],
      correct: 0,
    }]);
    setQuestionsEditorOpen(true);
    setAiOpen(false);
  };

  const updateQuestion = (index: number, patch: Partial<RocketQuestion>) => {
    setQuestions(previous => previous.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...patch } : question,
    ));
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions(previous => previous.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const generateWithAI = async () => {
    if (!aiTopic.trim()) {
      toast.error(ar ? "أدخل موضوع السباق أولاً" : "Enter a topic first");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await creditAwareFetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subject: aiSubject.trim(),
          count: aiCount,
          difficulty: aiDifficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(data.message || (ar ? "فشل التوليد" : "Generation failed"));
      }
      const generated: RocketQuestion[] = (data.questions || []).map((question: any) => ({
        text: question.text || "",
        type: "mcq" as const,
        options: [question.optionA || "", question.optionB || "", question.optionC || "", question.optionD || ""],
        correct: ["A", "B", "C", "D"].indexOf(question.correctAnswer) >= 0
          ? ["A", "B", "C", "D"].indexOf(question.correctAnswer)
          : 0,
      }));
      setQuestions(previous => [...previous, ...generated].slice(0, 30));
      setQuestionsEditorOpen(true);
      setAiOpen(false);
      if (!title.trim()) setTitle(aiTopic.trim());
      toast.success(ar ? `تم توليد ${generated.length} سؤال` : `Generated ${generated.length} questions`);
    } catch (error: any) {
      toast.error(error.message || (ar ? "حدث خطأ في التوليد" : "Generation error"));
    } finally {
      setAiGenerating(false);
    }
  };

  const joinUrl = gamePin ? `${window.location.origin}/game/rocket/join/${gamePin}` : "";

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(ar ? "تم نسخ الرابط!" : "Link copied!");
    } catch {
      toast.error(ar ? "فشل النسخ" : "Copy failed");
    }
  };

  // Bank
  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.status === 401) { toast.error(ar ? "يجب تسجيل الدخول أولاً" : "Please log in first"); setBankOpen(false); return; }
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
    const merged = [...questions, ...selected.map(bankToRocket)].slice(0, 30);
    setQuestions(merged);
    setBankOpen(false);
    toast.success(ar ? `تم استيراد ${selected.length} سؤال` : `Imported ${selected.length}`);
  };

  // Assignments
  const loadAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!meRes.ok) { toast.error(ar ? "يجب تسجيل الدخول" : "Please log in"); setAssignOpen(false); return; }
      const me = await meRes.json();
      const teacherId = me.teacherId || me.id;
      const res = await fetch(`${API_BASE}/api/assignments?teacherId=${teacherId}&include=shared`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.filter((a: { questionCount: number }) => a.questionCount > 0));
      }
    } catch { /* ignore */ } finally { setAssignLoading(false); }
  }, [ar]);

  useEffect(() => {
    if (assignOpen) { loadAssignments(); }
  }, [assignOpen, loadAssignments]);

  const importAllFromAssignment = async (assignmentId: number, assignmentTitle: string) => {
    setAssignImporting(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const qs = (data.questions || [])
        .filter((q: { questionType?: string; optionA?: string; correctAnswer?: string }) =>
          q.questionType === "mcq" && q.optionA && q.correctAnswer)
        .map((q: { id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; imageUrl?: string | null }) => bankToRocket({
          id: q.id, subject: data.subject || "", text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: 1, tags: null, imageUrl: q.imageUrl || null,
        } as BankQuestion));
      if (qs.length === 0) { toast.error(ar ? "لا توجد أسئلة اختيار متعدد" : "No MCQ questions found"); return; }
      setQuestions(qs.slice(0, 30));
      if (data.title) setTitle(data.title);
      setAssignOpen(false);
      toast.success(ar ? `تم استيراد ${qs.length} سؤال من "${assignmentTitle}"` : `Imported ${qs.length} questions from "${assignmentTitle}"`);
    } catch { toast.error(ar ? "حدث خطأ" : "Error"); }
    finally { setAssignImporting(null); }
  };

  // Templates
  const loadTemplates = async () => {
    setSavedLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rocket-templates`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "خطأ في تحميل القوالب" : "Error loading templates"); return; }
      const data = await res.json();
      setSavedTemplates(Array.isArray(data) ? data : []);
    } finally { setSavedLoading(false); }
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
    ? bankQuestions.filter(q => q.text.includes(bankSearch) || q.subject.includes(bankSearch))
    : bankQuestions;

  // ── Game Created Screen ────────────────────────────────────────────────────
  if (gamePin) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100dvh",
          background: "linear-gradient(180deg, #0a0e27 0%, #1a1740 50%, #2d1b4e 100%)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
        }}
      >
        <StarField />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 520 }}
        >
          {/* Rocket icon */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <motion.div
              animate={{ y: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              style={{ display: "inline-block" }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 16px 40px -8px ${BRAND_PRIMARY}88`,
                margin: "0 auto",
              }}>
                <Rocket size={40} color="#fff" />
              </div>
            </motion.div>
            <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 22, margin: "14px 0 4px" }}>
               {ar ? "سباق الصواريخ جاهز للانطلاق!" : "Rocket Race is Ready!"}
            </h1>
            {title && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>{title}</p>
            )}
          </div>

          {/* PIN Card */}
          <div style={{
            background: "rgba(255,255,255,0.07)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 24,
            padding: 28,
            backdropFilter: "blur(12px)",
            marginBottom: 16,
          }}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, margin: "0 0 8px", textAlign: "center" }}>
              {ar ? "للانضمام، ادخل على الموقع واكتب الكود:" : "Join at the website and enter the code:"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600, margin: "0 0 14px", textAlign: "center", direction: "ltr" }}>
              {window.location.host}/game/rocket/join
            </p>

            {/* Big PIN */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              style={{
                background: BRAND_GOLD,
                borderRadius: 20,
                padding: "20px 32px",
                textAlign: "center",
                fontSize: 64,
                fontWeight: 900,
                color: "#000",
                letterSpacing: "0.18em",
                fontFamily: "monospace",
                direction: "ltr",
                boxShadow: `0 16px 40px -8px ${BRAND_GOLD}80`,
                marginBottom: 20,
              }}
            >
              {gamePin}
            </motion.div>

            {/* QR + info */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: 10, flexShrink: 0 }}>
                <QRCode value={joinUrl} size={120} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 12,
                  fontWeight: 600,
                  direction: "ltr",
                  wordBreak: "break-all",
                }}>
                  {joinUrl}
                </div>
                <button
                  onClick={copyLink}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "none",
                    background: copied
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)`,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s",
                    boxShadow: `0 8px 20px -4px ${BRAND_PRIMARY}60`,
                  }}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? (ar ? "✓ تم النسخ!" : "✓ Copied!") : (ar ? "نسخ الرابط" : "Copy Link")}
                </button>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={13} />
                  {ar ? `${questions.length} سؤال · ${duration} ث لكل سؤال` : `${questions.length} questions · ${duration}s each`}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setGamePin(null); setQuestions([]); }}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 16,
                border: "1.5px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.8)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
               {ar ? "سباق صواريخ جديد" : "New Rocket Race"}
            </button>
            <button
              onClick={() => setLocation(`/game/rocket/host/${gamePin}`)}
              style={{
                flex: 2,
                padding: "14px 16px",
                borderRadius: 16,
                border: "none",
                background: `linear-gradient(135deg, ${BRAND_GOLD}, #c89212)`,
                color: "#000",
                fontWeight: 900,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: `0 12px 28px -8px ${BRAND_GOLD}80`,
              }}
            >
              <ExternalLink size={18} />
              {ar ? "ابدأ بإدارة اللعبة" : "Start Game Management"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Create Screen ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        dir={dir}
        className="min-h-screen py-8 px-4"
        style={{ background: "linear-gradient(180deg, #FCFAF8 0%, #F4EBD9 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
              style={{ background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, #2d6a45 100%)`, boxShadow: `0 12px 32px -8px ${BRAND_PRIMARY}66` }}
            >
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black mb-1" style={{ color: BRAND_PRIMARY }}>
              {ar ? "أنشئ سباق الصواريخ" : "Create Rocket Race"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ar ? "كلما كانت الإجابة أسرع وأصح، ارتفع الصاروخ أكثر!" : "Faster, more accurate answers send rockets higher!"}
            </p>
          </motion.div>

          {/* Two-step progress */}
          <div className="flex items-center justify-center gap-2 mb-5" aria-label={ar ? "خطوات إعداد السباق" : "Race setup steps"}>
            <div className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black" style={{ background: step === "questions" ? BRAND_PRIMARY : `${BRAND_PRIMARY}12`, color: step === "questions" ? "#fff" : BRAND_PRIMARY }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: step === "questions" ? "rgba(255,255,255,.2)" : `${BRAND_PRIMARY}20` }}>1</span>
              {ar ? "تجهيز الأسئلة" : "Prepare questions"}
            </div>
            <div className="w-8 h-px" style={{ background: `${BRAND_PRIMARY}35` }} />
            <div className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black" style={{ background: step === "settings" ? BRAND_PRIMARY : `${BRAND_PRIMARY}12`, color: step === "settings" ? "#fff" : BRAND_PRIMARY }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: step === "settings" ? "rgba(255,255,255,.2)" : `${BRAND_PRIMARY}20` }}>2</span>
              {ar ? "إعدادات السباق" : "Race settings"}
            </div>
          </div>

          {step === "settings" && (
            <>
            {/* Compact settings panel */}
           <Card className="p-4 sm:p-5 mb-4 border-primary/15 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
               <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${BRAND_PRIMARY}12`, color: BRAND_PRIMARY }}><Rocket className="w-4 h-4" /></span>
               <div>
                 <h2 className="font-black text-base" style={{ color: BRAND_PRIMARY }}>{ar ? "تفاصيل سباق الصواريخ" : "Rocket race details"}</h2>
                 <p className="text-xs text-muted-foreground mt-0.5">{ar ? "اضبط القيم الأساسية قبل الانطلاق" : "Set the essentials before launch"}</p>
               </div>
             </div>
             <div className="space-y-3">
               <div>
                 <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "اسم السباق" : "Race name"}</label>
                 <input
                   value={title}
                   onChange={e => setTitle(e.target.value)}
                   placeholder={ar ? "مثال: مراجعة الوحدة الأولى" : "e.g. Unit 1 review"}
                   className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
                   maxLength={60}
                 />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" style={{ color: BRAND_PRIMARY }} />{ar ? "وقت كل سؤال" : "Time per question"}</label>
                   <select value={duration} onChange={e => setDuration(parseInt(e.target.value, 10))} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     {[10, 15, 20, 30, 45].map(seconds => <option key={seconds} value={seconds}>{seconds} {ar ? "ثانية" : "seconds"}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "مدة السباق" : "Race duration"}</label>
                   <select value={gameDurationMins} onChange={e => setGameDurationMins(parseInt(e.target.value, 10))} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     {Array.from({ length: 15 }, (_, index) => index + 1).map(minutes => <option key={minutes} value={minutes}>{minutes} {ar ? "دقيقة" : "minutes"}</option>)}
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-xs font-bold text-foreground mb-1.5">{ar ? "طريقة تقدّم الأسئلة" : "Question pacing"}</label>
                   <select value={advanceMode} onChange={e => setAdvanceMode(e.target.value as typeof advanceMode)} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                     <option value="per_player">{ar ? "تلقائي — لكل طالب" : "Auto — per student"}</option>
                     <option value="host_sync">{ar ? "يدوي — سؤال واحد للجميع" : "Teacher sync — one question for all"}</option>
                   </select>
                 </div>
                 {gradeLevels.length > 0 && (
                   <div>
                     <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" style={{ color: BRAND_PRIMARY }} />{ar ? "الصف المستهدف" : "Target class"}</label>
                     <select value={targetClass} onChange={e => setTargetClass(e.target.value)} className="w-full bg-background border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
                       <option value="">{ar ? "جميع الصفوف" : "All classes"}</option>
                       {gradeLevels.map(g => <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel} ({g.count} {ar ? "طالب" : "students"})</option>)}
                     </select>
                   </div>
                 )}
               </div>
             </div>
           </Card>
            <button type="button" onClick={() => { setStep("questions"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mb-4 px-3 py-2 rounded-xl text-xs font-bold border border-primary/25 text-primary hover:bg-primary/5 flex items-center gap-1.5">
              {ar ? "السابق: تجهيز الأسئلة" : "Back: prepare questions"}
            </button>
            </>
          )}

          {step === "questions" && (
          <>
           {/* Prepared questions */}
           <AnimatePresence>
             {questions.length > 0 && (
               <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                 <Card className="p-4 mb-3 border-primary/15">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                     <div className="flex items-center gap-2.5">
                       <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white" style={{ background: BRAND_PRIMARY }}>{questions.length}</div>
                       <div><h2 className="font-black text-sm" style={{ color: BRAND_PRIMARY }}>{ar ? "أسئلة سباق الصواريخ جاهزة" : "Rocket Race questions are ready"}</h2><p className="text-xs text-muted-foreground mt-0.5">{ar ? "راجعها أو أضف سؤالاً جديداً قبل البدء." : "Review them or add a new question before starting."}</p></div>
                     </div>
                     <div className="flex flex-wrap gap-2">
                       <button type="button" onClick={() => setQuestionsEditorOpen(open => !open)} className="px-3 py-2 rounded-xl text-xs font-bold border border-primary/25 text-primary hover:bg-primary/5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />{questionsEditorOpen ? (ar ? "إخفاء الأسئلة" : "Hide questions") : (ar ? "معاينة وتعديل" : "Review & edit")}</button>
                       <button type="button" onClick={addManualQuestion} className="px-3 py-2 rounded-xl text-xs font-bold border border-primary/25 text-primary hover:bg-primary/5 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{ar ? "إضافة سؤال" : "Add question"}</button>
                       <button onClick={() => { setQuestions([]); setQuestionsEditorOpen(false); }} className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors" title={ar ? "مسح الأسئلة" : "Clear questions"}><Trash2 className="w-4 h-4" /></button>
                     </div>
                   </div>
                 </Card>
                 {questionsEditorOpen && (
                   <Card className="p-3 sm:p-4 mb-3 space-y-3">
                     {questions.map((question, index) => (
                       <div key={index} className="rounded-2xl border border-border p-3 sm:p-4">
                         <div className="flex items-center gap-2 mb-2.5"><span className="w-7 h-7 rounded-lg text-white text-xs font-black flex items-center justify-center" style={{ background: BRAND_PRIMARY }}>{index + 1}</span><span className="text-xs font-bold text-muted-foreground">{ar ? "سؤال اختيار متعدد" : "Multiple-choice question"}</span><button type="button" onClick={() => setQuestions(previous => previous.filter((_, questionIndex) => questionIndex !== index))} className="ms-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button></div>
                         <input value={question.text} onChange={e => updateQuestion(index, { text: e.target.value })} placeholder={ar ? "نص السؤال" : "Question text"} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary" />
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">{question.options.map((option, optionIndex) => <input key={optionIndex} value={option} onChange={e => updateQuestionOption(index, optionIndex, e.target.value)} placeholder={`${String.fromCharCode(65 + optionIndex)}. ${ar ? "الخيار" : "Option"}`} className="px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary" />)}</div>
                         <div className="mt-2 flex items-center gap-2"><label className="text-xs font-bold text-muted-foreground">{ar ? "الإجابة الصحيحة" : "Correct answer"}</label><select value={question.correct} onChange={e => updateQuestion(index, { correct: parseInt(e.target.value, 10) })} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold outline-none focus:border-primary">{["A", "B", "C", "D"].map((letter, optionIndex) => <option key={letter} value={optionIndex}>{letter}</option>)}</select></div>
                       </div>
                     ))}
                   </Card>
                 )}
               </motion.div>
             )}
           </AnimatePresence>

           {/* Question sources */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white shadow-sm border border-primary/10 shrink-0">
                  <Rocket className="w-6 h-6" style={{ color: BRAND_PRIMARY }} />
                </div>
                <div>
                  <h2 className="font-black text-base sm:text-lg text-foreground">{ar ? "كيف تريد تجهيز أسئلة السباق؟" : "How would you like to prepare the race?"}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{ar ? "اختر مصدراً للأسئلة، ويمكنك مراجعتها وتعديلها قبل البدء." : "Choose a question source. You can review and edit everything before starting."}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
                <button type="button" onClick={() => setAssignOpen(true)} className="group relative min-h-[172px] overflow-hidden rounded-2xl border-2 border-blue-500/20 bg-card p-6 sm:p-7 text-start transition-all hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-blue-500/10 border border-blue-500/20 shadow-sm"><BookOpen className="w-6 h-6 text-blue-500" /></div>
                  <h3 className="font-bold text-foreground text-lg mb-1.5">{ar ? "من واجب موجود" : "From an assignment"}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{ar ? "استورد أسئلة واجبك السابق في ثوانٍ" : "Import questions from an existing assignment"}</p>
                </button>
                <button type="button" onClick={() => { setAiOpen(open => !open); setQuestionsEditorOpen(false); }} className="group relative min-h-[172px] overflow-hidden rounded-2xl border-2 border-amber-500/20 bg-card p-6 sm:p-7 text-start transition-all hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-lg">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-amber-500/10 border border-amber-500/20 shadow-sm"><Sparkles className="w-6 h-6 text-amber-500" /></div>
                  <h3 className="font-bold text-foreground text-lg mb-1.5">{ar ? "بالذكاء الاصطناعي" : "With AI"}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{ar ? "ولّد أسئلة مناسبة لموضوعك تلقائياً" : "Generate questions for your topic automatically"}</p>
                </button>
                <button type="button" onClick={addManualQuestion} className="group relative min-h-[172px] overflow-hidden rounded-2xl border-2 border-emerald-500/20 bg-card p-6 sm:p-7 text-start transition-all hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/10 border border-emerald-500/20 shadow-sm"><PenLine className="w-6 h-6 text-emerald-600" /></div>
                  <h3 className="font-bold text-foreground text-lg mb-1.5">{ar ? "إضافة يدوية" : "Add manually"}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{ar ? "اكتب أسئلتك وخيارات الإجابة بنفسك" : "Write your own questions and answer choices"}</p>
                </button>
                <button type="button" onClick={() => setBankOpen(true)} className="group relative min-h-[172px] overflow-hidden rounded-2xl border-2 border-purple-500/20 bg-card p-6 sm:p-7 text-start transition-all hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-lg">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-purple-500/10 border border-purple-500/20 shadow-sm"><Database className="w-6 h-6 text-purple-500" /></div>
                  <h3 className="font-bold text-foreground text-lg mb-1.5">{ar ? "بنك الأسئلة" : "Question bank"}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{ar ? "اختر من أسئلتك المحفوظة في بنك حصاد" : "Pick from your saved questions in Hasad"}</p>
                </button>
              </div>
              <button type="button" onClick={() => { setSavedOpen(true); loadTemplates(); }} className="mt-4 w-full min-h-11 rounded-xl text-sm font-bold border border-primary/25 bg-card text-primary hover:bg-primary/5 flex items-center justify-center gap-2 transition-colors"><FolderOpen className="w-4 h-4" />{ar ? "سباقات الصواريخ المحفوظة" : "Saved Rocket Races"}</button>
            </div>

           <AnimatePresence>
             {aiOpen && (
               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                 <Card className="p-4 mb-4 border-amber-500/25">
                   <div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4" style={{ color: BRAND_GOLD }} /><div><h2 className="font-black text-sm">{ar ? "توليد أسئلة للسباق" : "Generate race questions"}</h2><p className="text-xs text-muted-foreground mt-0.5">{ar ? "ستتمكن من مراجعة الأسئلة وتعديلها بعد التوليد." : "You can review and edit the questions after generation."}</p></div></div>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={ar ? "الموضوع — مثال: الكواكب" : "Topic — e.g. planets"} className="sm:col-span-3 px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary" /><input value={aiSubject} onChange={e => setAiSubject(e.target.value)} placeholder={ar ? "المادة (اختياري)" : "Subject (optional)"} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary" /><select value={aiCount} onChange={e => setAiCount(parseInt(e.target.value, 10))} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-bold outline-none focus:border-primary">{[5, 10, 15, 20].map(count => <option key={count} value={count}>{count} {ar ? "أسئلة" : "questions"}</option>)}</select><select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as typeof aiDifficulty)} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm font-bold outline-none focus:border-primary"><option value="easy">{ar ? "سهل" : "Easy"}</option><option value="medium">{ar ? "متوسط" : "Medium"}</option><option value="hard">{ar ? "صعب" : "Hard"}</option></select></div>
                   <button type="button" disabled={aiGenerating} onClick={generateWithAI} className="mt-3 px-4 py-2.5 rounded-xl text-white text-sm font-black flex items-center gap-2 disabled:opacity-60" style={{ background: BRAND_PRIMARY }}>{aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />{ar ? "جارٍ التوليد…" : "Generating…"}</> : <><Wand2 className="w-4 h-4" />{ar ? "ولّد الأسئلة" : "Generate questions"}</>}</button>
                 </Card>
               </motion.div>
             )}
           </AnimatePresence>

            <motion.button type="button" whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }} onClick={handleNextToSettings} disabled={!hasCompleteQuestions} className="w-full py-3.5 rounded-2xl font-black text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: hasCompleteQuestions ? `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)` : "#e5e7eb", boxShadow: hasCompleteQuestions ? `0 14px 28px -8px ${BRAND_PRIMARY}70` : "none", color: hasCompleteQuestions ? "#fff" : "#9ca3af" }}><span>{ar ? "التالي: إعدادات السباق" : "Next: race settings"}</span><span aria-hidden="true">{ar ? "←" : "→"}</span></motion.button>
            {questions.length === 0 && <p className="text-center text-xs text-muted-foreground mt-3">{ar ? "اختر مصدراً للأسئلة أولاً ثم انتقل إلى الإعدادات." : "Choose a question source first, then continue to settings."}</p>}
           </>
           )}

           {step === "settings" && (
             <motion.button type="button" whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }} onClick={handleCreate} disabled={creating || !hasCompleteQuestions} className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ background: hasCompleteQuestions ? `linear-gradient(135deg, ${BRAND_PRIMARY}, #2d6a45)` : "#e5e7eb", boxShadow: hasCompleteQuestions ? `0 14px 28px -8px ${BRAND_PRIMARY}70` : "none", color: hasCompleteQuestions ? "#fff" : "#9ca3af" }}>{creating ? <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جارٍ الإنشاء…" : "Creating…"}</> : <><Rocket className="w-5 h-5" />{ar ? "ابدأ سباق الصواريخ" : "Start Rocket Race"}</>}</motion.button>
           )}
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
                <button onClick={() => setBankOpen(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
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
                {bankLoading && <div className="text-center py-8 text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /></div>}
                {!bankLoading && filteredBank.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد أسئلة" : "No questions"}</div>}
                {filteredBank.map(q => {
                  const checked = bankSelected.has(q.id);
                  return (
                    <div key={q.id} onClick={() => { const n = new Set(bankSelected); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); setBankSelected(n); }}
                      className="p-3 rounded-xl border-2 cursor-pointer transition-all"
                      style={{ borderColor: checked ? BRAND_PRIMARY : "#e5e7eb", background: checked ? `${BRAND_PRIMARY}10` : "#fff" }}>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center"
                          style={{ borderColor: checked ? BRAND_PRIMARY : "#d1d5db", background: checked ? BRAND_PRIMARY : "#fff" }}>
                          {checked && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold line-clamp-2">{q.text}</p>
                          {q.subject && <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>{q.subject}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t flex gap-2" style={{ borderColor: "#e5e7eb" }}>
                <button onClick={() => setBankOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 font-bold text-sm">{ar ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankSelected} disabled={bankSelected.size === 0}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                  style={{ background: BRAND_PRIMARY }}>
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
              <div className="p-5 border-b" style={{ background: "linear-gradient(135deg, #225739, #1a4a2e)", borderColor: "#e5e7eb" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {ar ? "اختر واجباً" : "Select Assignment"}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5">{ar ? "اضغط على الواجب لاستيراد جميع أسئلته" : "Tap to import all questions"}</p>
                  </div>
                  <button onClick={() => setAssignOpen(false)} className="p-2 rounded-xl hover:bg-white/20 text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {assignLoading && <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
                {!assignLoading && assignments.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد واجبات" : "No assignments"}</div>}
                {assignments.map(a => (
                  <motion.button key={a.id} whileTap={{ scale: 0.97 }}
                    onClick={() => importAllFromAssignment(a.id, a.title)}
                    disabled={assignImporting !== null}
                    className="w-full p-4 rounded-2xl border-2 flex items-center gap-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-start"
                    style={{ borderColor: BRAND_PRIMARY, background: assignImporting === a.id ? "#f0fdf4" : "#fff" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #225739, #388e3c)" }}>
                      {assignImporting === a.id
                        ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                        : <FileText className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-800 dark:text-gray-100 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.subject} · {a.questionCount} {ar ? "سؤال" : "questions"}</p>
                    </div>
                    <Check className="w-5 h-5 shrink-0" style={{ color: BRAND_PRIMARY }} />
                  </motion.button>
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
                  {ar ? "سباقات الصواريخ المحفوظة" : "Saved Rocket Races"}
                </h3>
                <button onClick={() => setSavedOpen(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {savedLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
                {!savedLoading && savedTemplates.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد سباقات صواريخ محفوظة" : "No saved Rocket Races"}</p>
                )}
                {savedTemplates.map(t => (
                  <div key={t.id} className="rounded-xl border-2 p-3 flex items-center gap-3" style={{ borderColor: "#e5e7eb" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.questions.length} {ar ? "سؤال" : "questions"}
                        {t.fromAdmin && <span className="ml-2 px-2 py-0.5 rounded" style={{ background: `${BRAND_GOLD}25`, color: "#7c4a06" }}>{ar ? "من المنصة" : "Platform"}</span>}
                      </p>
                    </div>
                    <button onClick={() => handleLoadTemplate(t)} className="px-3 py-1.5 rounded-lg text-white font-bold text-xs" style={{ background: BRAND_PRIMARY }}>
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
