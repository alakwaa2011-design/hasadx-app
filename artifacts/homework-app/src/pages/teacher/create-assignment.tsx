import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateAssignment } from "@workspace/api-client-react";
import type { CreateQuestionBody } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import {
  Plus, Trash2, Save, ArrowRight, ArrowLeft, Image, CheckCircle2, X,
  Monitor, FileText, Layers, Globe, Lock, GraduationCap, Copy, Star,
  Eye, EyeOff, Sparkles, Wand2, Loader2, ChevronUp, ChevronDown,
  Calendar, Database, Clock, Settings, Settings2, Brain,
  Tag, Camera, Upload, ChevronRight, GripVertical, Volume2, Play, Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fileToBase64 } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSuggestions, addMultipleSuggestions, addSuggestion } from "@/lib/suggestions";

const API_BASE = import.meta.env.VITE_API_URL || "";

type SubmissionMode = "electronic" | "paper" | "both";
type AccessMode = "public" | "private";
type QuestionWithTts = CreateQuestionBody & {
  readAloud?: boolean;
  allowMultipleAnswers?: boolean;
  repeatQuestion?: boolean;
  correctAnswers?: string[];
  _clientId?: string;
};

let _qClientIdCounter = 0;
const nextClientId = () => `qcid-${++_qClientIdCounter}`;
const ensureClientIds = (qs: QuestionWithTts[]): QuestionWithTts[] =>
  qs.map(q => (q._clientId ? q : { ...q, _clientId: nextClientId() }));

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ══════════════════════════════════════════════
// القوالب
// ══════════════════════════════════════════════

interface AssignmentTemplate {
  id: string;
  emoji: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  color: string;
  bgColor: string;
  tags: string[];
  tagsEn: string[];
  defaults: {
    submissionMode: SubmissionMode;
    questionCount: number;
    pointsPerQuestion: number;
    questionType: "mcq" | "true_false" | "fill_blank" | "whiteboard";
    hasDeadline: boolean;
    examMode: boolean;
    examDurationMinutes: number;
  };
}

const TEMPLATES: AssignmentTemplate[] = [
  {
    id: "scratch",
    emoji: "✏️",
    title: "من الصفر",
    titleEn: "From Scratch",
    desc: "صفحة فارغة — أضف أسئلتك بحرية",
    descEn: "Blank page — add your questions freely",
    color: "#2d6a4f",
    bgColor: "#e8f5e9",
    tags: ["حر"],
    tagsEn: ["Free"],
    defaults: { submissionMode: "electronic", questionCount: 1, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: false, examMode: false, examDurationMinutes: 30 },
  },
  {
    id: "quiz",
    emoji: "📝",
    title: "اختبار قصير",
    titleEn: "Quick Quiz",
    desc: "10 أسئلة اختيار متعدد، درجة لكل سؤال",
    descEn: "10 multiple choice questions, 1 point each",
    color: "#0369a1",
    bgColor: "#e0f2fe",
    tags: ["10 أسئلة", "10 درجات"],
    tagsEn: ["10 questions", "10 pts"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: false, examMode: false, examDurationMinutes: 30 },
  },
  {
    id: "homework",
    emoji: "🏠",
    title: "واجب منزلي",
    titleEn: "Homework",
    desc: "5 أسئلة متنوعة مع موعد تسليم",
    descEn: "5 varied questions with a deadline",
    color: "#d97706",
    bgColor: "#fef3c7",
    tags: ["5 أسئلة", "موعد تسليم"],
    tagsEn: ["5 questions", "Deadline"],
    defaults: { submissionMode: "electronic", questionCount: 5, pointsPerQuestion: 2, questionType: "mcq", hasDeadline: true, examMode: false, examDurationMinutes: 30 },
  },
  {
    id: "shorttest",
    emoji: "⏱️",
    title: "اختبار قصير",
    titleEn: "Short Test",
    desc: "10 أسئلة بوقت محدد — مثالي للتقييم السريع",
    descEn: "10 questions with timer — perfect for quick assessment",
    color: "#7c3aed",
    bgColor: "#ede9fe",
    tags: ["10 أسئلة", "وقت محدد"],
    tagsEn: ["10 questions", "Timed"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: true, examMode: true, examDurationMinutes: 20 },
  },
  {
    id: "truefalse",
    emoji: "✅",
    title: "صح وخطأ",
    titleEn: "True & False",
    desc: "10 أسئلة صح/خطأ بسيطة وسريعة",
    descEn: "10 simple true/false questions",
    color: "#059669",
    bgColor: "#d1fae5",
    tags: ["10 أسئلة", "صح/خطأ"],
    tagsEn: ["10 questions", "True/False"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "true_false", hasDeadline: false, examMode: false, examDurationMinutes: 15 },
  },
  {
    id: "paper",
    emoji: "🖨️",
    title: "اختبار ورقي",
    titleEn: "Paper Exam",
    desc: "واجب ورقي مع تصحيح يدوي أو بالذكاء الاصطناعي",
    descEn: "Paper assignment with manual or AI grading",
    color: "#4b5563",
    bgColor: "#f3f4f6",
    tags: ["ورقي", "AI تصحيح"],
    tagsEn: ["Paper", "AI grading"],
    defaults: { submissionMode: "paper", questionCount: 1, pointsPerQuestion: 10, questionType: "mcq", hasDeadline: true, examMode: false, examDurationMinutes: 60 },
  },
];

const MATH_GROUPS = [
  { labelAr: "أساسي", labelEn: "Basic", symbols: ["×", "÷", "≠", "≈", "≤", "≥", "±", "∞"] },
  { labelAr: "قوى", labelEn: "Powers", symbols: ["²", "³", "⁴", "⁵", "⁶", "√", "∛", "∜"] },
  { labelAr: "كسور", labelEn: "Fractions", symbols: ["½", "⅓", "¼", "¾", "⅔", "⅕", "⅖", "⅗"] },
  { labelAr: "يونانية", labelEn: "Greek", symbols: ["π", "θ", "α", "β", "γ", "δ", "λ", "μ", "σ", "Σ", "φ", "Ω", "Δ", "ω"] },
  { labelAr: "هندسة", labelEn: "Geometry", symbols: ["°", "∠", "⊥", "∥", "△", "∡", "⊿"] },
  { labelAr: "حساب", labelEn: "Calculus", symbols: ["∫", "∂", "∑", "∏", "∈", "∉", "⊂", "∪", "∩"] },
];

// Typed lookup for MCQ option fields — avoids `as any` casts throughout the component
const MCQ_OPT = {
  A: "optionA",
  B: "optionB",
  C: "optionC",
  D: "optionD",
} as const satisfies Record<string, keyof CreateQuestionBody>;

const COLOR_THEMES = [
  { id: "green", label: "أخضر", labelEn: "Green", bg: "#2d6a4f", light: "#e8f5e9" },
  { id: "blue", label: "أزرق", labelEn: "Blue", bg: "#0369a1", light: "#e0f2fe" },
  { id: "purple", label: "بنفسجي", labelEn: "Purple", bg: "#7c3aed", light: "#ede9fe" },
  { id: "gold", label: "ذهبي", labelEn: "Gold", bg: "#d97706", light: "#fef3c7" },
  { id: "rose", label: "وردي", labelEn: "Rose", bg: "#e11d48", light: "#ffe4e6" },
];

// ══════════════════════════════════════════════
// Draft auto-save (localStorage)
// ══════════════════════════════════════════════
const DRAFT_KEY = "createAssignmentDraft:v1";

type WizardDraft = {
  v: 1;
  wizardStep: 1 | 2 | 3;
  selectedTemplateId: string | null;
  colorTheme: string;
  title: string;
  subject: string;
  description: string;
  targetClasses: string[];
  submissionMode: SubmissionMode;
  accessMode: AccessMode;
  accessCode: string;
  showResults: boolean;
  deadline: string;
  paperTotalPoints: number;
  examMode: boolean;
  examDurationMinutes: number;
  resultsReleaseMode: "immediate" | "after_deadline" | "manual";
  allowRetry: boolean;
  modelImage: string | null;
  aiGradingInstructions: string;
  isShared: boolean;
  categoryId: number | null;
  isAdaptive: boolean;
  adaptiveSkills: string[];
  adaptiveQuestionsPerSession: number;
  questions: QuestionWithTts[];
  savedAt: number;
};

function draftHasMeaningfulContent(d: WizardDraft, paperAnswerLabel: string): boolean {
  if (d.title.trim()) return true;
  if (d.subject.trim()) return true;
  if (d.description.trim()) return true;
  if (d.targetClasses.length > 0) return true;
  if (d.aiGradingInstructions.trim()) return true;
  if (d.modelImage) return true;
  if (d.questions.some(q => (q.text || "").trim() && q.text !== paperAnswerLabel)) return true;
  if (d.questions.some(q => (q.optionA || q.optionB || q.optionC || q.optionD || "").toString().trim())) return true;
  return false;
}

function readDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    return parsed as WizardDraft;
  } catch {
    return null;
  }
}

function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ══════════════════════════════════════════════
// Sortable wrapper for question cards (drag-and-drop reordering)
// ══════════════════════════════════════════════

function SortableQuestionWrapper({
  id,
  children,
}: {
  id: string;
  children: (handleProps: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

// ══════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════

export default function CreateAssignment() {
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  const BackArrowIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  // ── Wizard state ──
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [colorTheme, setColorTheme] = useState("green");

  // ── Basic info ──
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [classInput, setClassInput] = useState("");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("electronic");
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
  const [accessCode, setAccessCode] = useState(generateAccessCode());
  const [showResults, setShowResults] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [paperTotalPoints, setPaperTotalPoints] = useState<number>(10);
  const [examMode, setExamMode] = useState(false);
  const [examDurationMinutes, setExamDurationMinutes] = useState<number>(30);
  const [resultsReleaseMode, setResultsReleaseMode] = useState<"immediate" | "after_deadline" | "manual">("immediate");
  const [allowRetry, setAllowRetry] = useState(false);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const modelImageRef = useRef<HTMLInputElement>(null);
  const [aiGradingInstructions, setAiGradingInstructions] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const emptyElectronicQuestion: QuestionWithTts = {
    text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", points: 1,
    readAloud: false, allowMultipleAnswers: false, repeatQuestion: false, correctAnswers: ["A"],
  };

  const [questions, _setQuestionsRaw] = useState<QuestionWithTts[]>(() =>
    ensureClientIds([{ ...emptyElectronicQuestion }])
  );
  // Wrapped setter that auto-assigns stable _clientId to any question missing one.
  // Existing IDs are preserved so dnd-kit/React keys stay stable across reorder/edit.
  const setQuestions: React.Dispatch<React.SetStateAction<QuestionWithTts[]>> = (action) => {
    if (typeof action === "function") {
      _setQuestionsRaw(prev => ensureClientIds((action as (p: QuestionWithTts[]) => QuestionWithTts[])(prev)));
    } else {
      _setQuestionsRaw(ensureClientIds(action));
    }
  };

  // ── AI / image extract ──
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showImageExtract, setShowImageExtract] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [extractImages, setExtractImages] = useState<string[]>([]);
  const [extractCount] = useState(10);
  const [extractDifficulty, setExtractDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Date picker ──
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Bank ──
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSelected, setBankSelected] = useState<Set<number>>(new Set());
  const [bankFilterSubject, setBankFilterSubject] = useState("");

  // ── Admin / adaptive ──
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [adaptiveSkills, setAdaptiveSkills] = useState<string[]>([]);
  const [adaptiveSkillInput, setAdaptiveSkillInput] = useState("");
  const [adaptiveQuestionsPerSession, setAdaptiveQuestionsPerSession] = useState(10);

  // ── Per-question UI ──
  const [mathToolbarFor, setMathToolbarFor] = useState<number>(-1);
  const [imagePickerFor, setImagePickerFor] = useState<number>(-1);
  const [mathOptionFor, setMathOptionFor] = useState<{ qIdx: number; opt: string } | null>(null);

  // ── Draft auto-save ──
  const [draftReady, setDraftReady] = useState(false);
  const [draftSnapshot, setDraftSnapshot] = useState<WizardDraft | null>(null);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  const isPaper = submissionMode === "paper";
  const isMathSubject = subject.toLowerCase().includes("رياض") || subject.toLowerCase().includes("math");
  const totalPoints = isPaper ? paperTotalPoints : questions.reduce((sum, q) => sum + (q.points || 1), 0);

  // ── Apply template ──
  const applyTemplate = (template: AssignmentTemplate) => {
    const { defaults } = template;
    setSelectedTemplateId(template.id);
    setSubmissionMode(defaults.submissionMode);
    if (defaults.examMode) { setExamMode(true); setExamDurationMinutes(defaults.examDurationMinutes); }
    if (defaults.submissionMode === "paper") {
      const total = defaults.pointsPerQuestion * defaults.questionCount;
      setPaperTotalPoints(total);
      setQuestions([{ text: t.createAssignment.paperAnswer, points: total }]);
    } else {
      const newQs: QuestionWithTts[] = Array.from({ length: defaults.questionCount }, () => ({
        text: "", optionA: "", optionB: "", optionC: "", optionD: "",
        correctAnswer: defaults.questionType === "true_false" ? "true" : "A",
        points: defaults.pointsPerQuestion, questionType: defaults.questionType,
        readAloud: false, allowMultipleAnswers: false, repeatQuestion: false,
        correctAnswers: [defaults.questionType === "true_false" ? "true" : "A"],
      }));
      setQuestions(newQs);
    }
    if (defaults.hasDeadline) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setDeadline(nextWeek.toISOString().slice(0, 16));
    }
    if (template.id !== "scratch") {
      toast.success(lang === "ar" ? `تم تطبيق قالب "${template.title}" ✓` : `Template "${template.titleEn}" applied ✓`);
    }
    setWizardStep(2);
  };

  // ── AI generate ──
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true); setAiError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/generate-questions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ topic: aiTopic, count: aiCount, difficulty: aiDifficulty, subject: subject || undefined }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(t.createAssignment.connectionError); }
      if (!res.ok) throw new Error(data.message || t.createAssignment.generateError);
      if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error(t.createAssignment.noQuestionsGenerated);
      const generated = data.questions as CreateQuestionBody[];
      const hasRealQuestions = questions.length > 0 && questions.some(q => q.text && q.text !== t.createAssignment.paperAnswer);
      setQuestions(hasRealQuestions ? [...questions, ...generated] : generated);
      setShowAiPanel(false); setAiTopic("");
      toast.success(lang === "ar" ? `تم توليد ${generated.length} سؤال بنجاح` : `${generated.length} questions generated successfully`);
    } catch (err: any) { setAiError(err.message || t.common.error); } finally { setAiLoading(false); }
  };

  // ── Image extract ──
  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const toProcess = Array.from(files).slice(0, 5 - extractImages.length);
    const newImages: string[] = [];
    for (const file of toProcess) { if (!file.type.startsWith("image/")) continue; newImages.push(await fileToBase64(file)); }
    setExtractImages(prev => [...prev, ...newImages].slice(0, 5));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleExtractFromImage = async () => {
    if (extractImages.length === 0) return;
    setExtractLoading(true); setExtractError("");
    try {
      const res = await fetch(`${API_BASE}/api/ai/extract-questions-from-image`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ images: extractImages, count: extractCount, difficulty: extractDifficulty }),
      });
      let data: Record<string, unknown>;
      try { data = await res.json(); } catch { throw new Error(t.createAssignment.connectionError); }
      if (!res.ok) throw new Error((data.message as string) || t.createAssignment.generateError);
      if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error(t.createAssignment.noQuestionsGenerated);
      const generated = data.questions as CreateQuestionBody[];
      const hasRealQuestions = questions.length > 0 && questions.some(q => q.text && q.text !== t.createAssignment.paperAnswer);
      setQuestions(hasRealQuestions ? [...questions, ...generated] : generated);
      setShowImageExtract(false); setExtractImages([]);
      toast.success(lang === "ar" ? `تم استخراج ${generated.length} سؤال من الصور بنجاح` : `${generated.length} questions extracted from images`);
    } catch (err: unknown) {
      setExtractError(err instanceof Error ? err.message : t.common.error);
    } finally { setExtractLoading(false); }
  };

  const handleModeChange = (mode: SubmissionMode) => {
    setSubmissionMode(mode);
    if (mode === "electronic") setModelImage(null);
    if (mode === "paper") {
      setQuestions([{ text: t.createAssignment.paperAnswer, points: paperTotalPoints }]);
    } else if (mode === "electronic" || mode === "both") {
      setQuestions(questions.map(q => ({
        text: q.text === t.createAssignment.paperAnswer ? "" : q.text,
        optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "",
        correctAnswer: q.correctAnswer || "A", points: q.points || 1,
      })));
    }
  };

  const createMutation = useCreateAssignment({
    mutation: {
      onSuccess: () => {
        addMultipleSuggestions({ subjects: subject, classes: targetClasses.join(",") });
        questions.forEach(q => { if (q.text?.trim()) addSuggestion("questions", q.text.trim()); });
        clearDraft();
        toast.success(lang === "ar" ? "تم حفظ الواجب ونشره بنجاح" : "Assignment saved and published successfully");
        setLocation("/teacher");
      },
      onError: (err: any) => {
        toast.error(err.message || (lang === "ar" ? "حدث خطأ أثناء حفظ الواجب" : "Error saving assignment"));
      },
    }
  });

  const handleAddQuestion = () => setQuestions([...questions, { ...emptyElectronicQuestion }]);

  useEffect(() => {
    let consumedSeedOrDraft = false;
    try {
      const raw = sessionStorage.getItem("librarySeedQuestions");
      if (raw) {
        sessionStorage.removeItem("librarySeedQuestions");
        const parsed = JSON.parse(raw);
        const seed = Array.isArray(parsed?.questions) ? parsed.questions : [];
        if (seed.length > 0) {
          const seeded: QuestionWithTts[] = seed.map((q: any) => {
            const qt: "mcq" | "true_false" | "fill_blank" = q.questionType === "true_false" || q.questionType === "fill_blank" ? q.questionType : "mcq";
            let correctAnswer: string;
            if (qt === "true_false") correctAnswer = q.correctAnswer === "false" ? "false" : "true";
            else if (qt === "fill_blank") correctAnswer = typeof q.correctAnswer === "string" ? q.correctAnswer : "";
            else correctAnswer = ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A";
            return {
              text: String(q.text || ""), optionA: String(q.optionA || ""), optionB: String(q.optionB || ""),
              optionC: String(q.optionC || ""), optionD: String(q.optionD || ""), correctAnswer,
              points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
              questionType: qt, readAloud: false, allowMultipleAnswers: false, repeatQuestion: false, correctAnswers: [correctAnswer],
            };
          });
          // Library seed takes precedence over any saved draft
          clearDraft();
          setQuestions(seeded);
          setWizardStep(2);
          if (parsed?.subject && typeof parsed.subject === "string") setSubject(parsed.subject);
          if (parsed?.sourceFileName && typeof parsed.sourceFileName === "string") {
            const baseName = String(parsed.sourceFileName).replace(/\.[^.]+$/, "");
            setTitle(lang === "ar" ? `أسئلة من: ${baseName}` : `Questions from: ${baseName}`);
          }
          toast.success(lang === "ar" ? `تم تحميل ${seeded.length} سؤال من المكتبة` : `Loaded ${seeded.length} questions from library`);
          consumedSeedOrDraft = true;
          setDraftReady(true);
        }
      }
    } catch { /* ignore */ }

    // If no library seed, look for an auto-saved draft
    if (!consumedSeedOrDraft) {
      const draft = readDraft();
      if (draft && draftHasMeaningfulContent(draft, t.createAssignment.paperAnswer)) {
        setDraftSnapshot(draft);
        setDraftPromptOpen(true);
        // draftReady stays false until user picks Continue or Start fresh
      } else {
        if (draft) clearDraft();
        setDraftReady(true);
      }
    }

    fetch(`${API_BASE}/api/categories`, { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setAvailableCategories).catch(() => {});
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setGradeLevels).catch(() => {});
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" }).then(r => r.ok ? r.json() : null).then(data => { if (data?.isAdmin) setIsAdmin(true); }).catch(() => {});
  }, []);

  // ── Apply a saved draft snapshot back into wizard state ──
  const applyDraft = (d: WizardDraft) => {
    setWizardStep((Math.min(d.wizardStep ?? 1, 3) as 1 | 2 | 3));
    setSelectedTemplateId(d.selectedTemplateId);
    setColorTheme(d.colorTheme);
    setTitle(d.title);
    setSubject(d.subject);
    setDescription(d.description);
    setTargetClasses(d.targetClasses);
    setSubmissionMode(d.submissionMode);
    setAccessMode(d.accessMode);
    setAccessCode(/^\d{6}$/.test(d.accessCode || "") ? d.accessCode : generateAccessCode());
    setShowResults(d.showResults);
    setDeadline(d.deadline);
    setPaperTotalPoints(d.paperTotalPoints);
    setExamMode(d.examMode);
    setExamDurationMinutes(d.examDurationMinutes);
    setResultsReleaseMode(d.resultsReleaseMode);
    setAllowRetry(d.allowRetry);
    setModelImage(d.modelImage);
    setAiGradingInstructions(d.aiGradingInstructions);
    setIsShared(d.isShared);
    setCategoryId(d.categoryId);
    setIsAdaptive(d.isAdaptive);
    setAdaptiveSkills(d.adaptiveSkills);
    setAdaptiveQuestionsPerSession(d.adaptiveQuestionsPerSession);
    if (Array.isArray(d.questions) && d.questions.length > 0) setQuestions(d.questions);
  };

  const handleContinueDraft = () => {
    if (draftSnapshot) applyDraft(draftSnapshot);
    setDraftPromptOpen(false);
    setDraftReady(true);
  };

  const handleStartFresh = () => {
    clearDraft();
    setDraftSnapshot(null);
    setDraftPromptOpen(false);
    setDraftReady(true);
  };

  // ── Auto-save draft on every change (after the user has resolved any existing draft) ──
  useEffect(() => {
    if (!draftReady) return;
    const draft: WizardDraft = {
      v: 1,
      wizardStep,
      selectedTemplateId,
      colorTheme,
      title,
      subject,
      description,
      targetClasses,
      submissionMode,
      accessMode,
      accessCode,
      showResults,
      deadline,
      paperTotalPoints,
      examMode,
      examDurationMinutes,
      resultsReleaseMode,
      allowRetry,
      modelImage,
      aiGradingInstructions,
      isShared,
      categoryId,
      isAdaptive,
      adaptiveSkills,
      adaptiveQuestionsPerSession,
      questions,
      savedAt: Date.now(),
    };
    if (!draftHasMeaningfulContent(draft, t.createAssignment.paperAnswer)) {
      clearDraft();
      return;
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Quota exceeded or storage unavailable — silently ignore so the wizard keeps working
    }
  }, [
    draftReady,
    wizardStep, selectedTemplateId, colorTheme, title, subject, description,
    targetClasses, submissionMode, accessMode, accessCode, showResults, deadline,
    paperTotalPoints, examMode, examDurationMinutes, resultsReleaseMode, allowRetry,
    modelImage, aiGradingInstructions, isShared, categoryId, isAdaptive,
    adaptiveSkills, adaptiveQuestionsPerSession, questions,
    t.createAssignment.paperAnswer,
  ]);

  const openBankModal = async () => {
    setShowBankModal(true); setBankLoading(true); setBankSelected(new Set());
    try {
      const res = await fetch(`${API_BASE}/api/question-bank`, { credentials: "include" });
      if (res.ok) setBankQuestions(await res.json());
    } catch (e) { console.error(e); } finally { setBankLoading(false); }
  };

  const toggleBankQuestion = (id: number) => {
    const next = new Set(bankSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setBankSelected(next);
  };

  const importBankQuestions = () => {
    const selected = bankQuestions.filter(q => bankSelected.has(q.id));
    const imported: QuestionWithTts[] = selected.map(q => {
      const isMulti = !!q.allowMultipleAnswers;
      const rawCorrect: string = q.correctAnswer || "A";
      const correctAnswers: string[] = isMulti ? rawCorrect.split(",").map((s: string) => s.trim()).filter(Boolean) : [rawCorrect];
      return { text: q.text, optionA: q.optionA || "", optionB: q.optionB || "", optionC: q.optionC || "", optionD: q.optionD || "", correctAnswer: rawCorrect, correctAnswers, points: q.points || 1, imageUrl: q.imageUrl || null, readAloud: false, allowMultipleAnswers: isMulti, repeatQuestion: !!q.repeatQuestion };
    });
    if (questions.length === 1 && !questions[0].text) setQuestions(imported);
    else setQuestions([...questions, ...imported]);
    setShowBankModal(false);
    toast.success(t.questionBank.importSuccess.replace("{count}", String(imported.length)));
  };

  const handleRemoveQuestion = (index: number) => { if (questions.length > 1) setQuestions(questions.filter((_, i) => i !== index)); };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const newQs = [...questions];
    [newQs[index], newQs[newIndex]] = [newQs[newIndex], newQs[index]];
    setQuestions(newQs);
  };

  // ── Drag-and-drop reordering (dnd-kit) ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleQuestionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions(prev => {
      const fromIdx = prev.findIndex(q => q._clientId === active.id);
      const toIdx = prev.findIndex(q => q._clientId === over.id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      return arrayMove(prev, fromIdx, toIdx);
    });
    // Reset transient per-question UI state tied to indices
    setMathToolbarFor(-1);
    setImagePickerFor(-1);
    setMathOptionFor(null);
  };

  const handleQuestionChange = (index: number, field: keyof QuestionWithTts, value: string | number | boolean | null) => {
    setQuestions(prev => { const newQs = [...prev]; newQs[index] = { ...newQs[index], [field]: value }; return newQs; });
  };

  const handleQuestionTypeChange = (index: number, newType: "mcq" | "true_false" | "fill_blank" | "whiteboard" | "whiteboard_blank" | "dictation") => {
    setQuestions(prev => {
      const newQs = [...prev];
      const updates: Partial<CreateQuestionBody> = { questionType: newType === "whiteboard_blank" ? "whiteboard" : newType, optionA: '', optionB: '', optionC: '', optionD: '' };
      if (newType === "true_false") updates.correctAnswer = 'true';
      else if (newType === "fill_blank") updates.correctAnswer = '';
      else if (newType === "whiteboard") { updates.correctAnswer = ''; updates.optionA = 'lined'; }
      else if (newType === "whiteboard_blank") { updates.correctAnswer = ''; updates.optionA = 'blank'; }
      else if (newType === "dictation") { updates.correctAnswer = ''; updates.optionA = ''; updates.optionB = '3'; updates.optionC = 'true'; }
      else updates.correctAnswer = 'A';
      newQs[index] = { ...newQs[index], ...updates } as CreateQuestionBody;
      return newQs;
    });
  };

  const handleModelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const base64 = await fileToBase64(file); setModelImage(base64); }
  };

  const handlePublish = () => {
    if (!title.trim()) { toast.error(lang === "ar" ? "يجب إدخال عنوان الواجب" : "Assignment title is required"); setWizardStep(1); return; }
    if (!isPaper) {
      const emptyQ = questions.findIndex(q => !q.text?.trim());
      if (emptyQ !== -1) {
        toast.error(lang === "ar" ? `السؤال ${emptyQ + 1} فارغ — يرجى إدخال نص السؤال` : `Question ${emptyQ + 1} is empty — please enter question text`);
        setWizardStep(2); return;
      }
    }
    if (accessMode === "private" && !/^\d{6}$/.test(accessCode)) {
      toast.error(lang === "ar" ? "كود الدخول يجب أن يكون 6 أرقام" : "Access code must be exactly 6 digits");
      setShowAdvancedSettings(true); setWizardStep(3); return;
    }
    // Build description prefix: [theme:X][retry] — chain prefixes then user text
    let descPrefix = "";
    if (colorTheme !== "green") descPrefix += `[theme:${colorTheme}]`;
    if (allowRetry) descPrefix += `[retry]`;
    const themeDesc = descPrefix + description;
    createMutation.mutate({
      data: {
        title, subject: subject.trim() || undefined, description: themeDesc, submissionMode, accessMode,
        accessCode: accessMode === "private" ? accessCode : undefined,
        targetClass: targetClasses[0] || undefined,
        targetClasses: targetClasses.length > 0 ? targetClasses : undefined,
        showResults,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        modelImageBase64: modelImage || undefined,
        examMode: examMode || undefined,
        examDurationMinutes: examMode ? examDurationMinutes : undefined,
        resultsReleaseMode: resultsReleaseMode !== "immediate" ? resultsReleaseMode : undefined,
        aiGradingInstructions: aiGradingInstructions.trim() || undefined,
        isShared, categoryId: categoryId || undefined,
        isAdaptive: isAdaptive || undefined,
        adaptiveConfig: isAdaptive ? { questionsPerSession: adaptiveQuestionsPerSession, skills: adaptiveSkills } : undefined,
        questions: isPaper
          ? [{ text: t.createAssignment.paperAnswer, points: paperTotalPoints }]
          : questions.map(({ allowMultipleAnswers: _a, repeatQuestion: _r, correctAnswers: _ca, _clientId: _cid, ...apiQ }) => ({
              ...apiQ,
              difficulty: isAdaptive ? (apiQ.difficulty ?? 2) : undefined,
              skill: isAdaptive ? (apiQ.skill ?? "") : undefined,
            })),
      }
    });
  };

  const difficultyOptions = [
    { value: "easy" as const, label: t.createAssignment.aiEasy, color: "green" },
    { value: "medium" as const, label: t.createAssignment.aiMedium, color: "yellow" },
    { value: "hard" as const, label: t.createAssignment.aiHard, color: "red" },
  ];

  const goNext = () => {
    if (wizardStep === 1 && !title.trim()) { toast.error(lang === "ar" ? "يجب إدخال عنوان الواجب أولاً" : "Please enter an assignment title"); return; }
    if (wizardStep < 3) setWizardStep(s => (s + 1) as 1 | 2 | 3);
  };
  const goPrev = () => { if (wizardStep > 1) setWizardStep(s => (s - 1) as 1 | 2 | 3); };
  const goToPreview = () => {
    if (!title.trim()) { toast.error(lang === "ar" ? "يجب إدخال عنوان الواجب أولاً" : "Please enter an assignment title"); return; }
    setWizardStep(3);
  };

  const STEPS = [
    { num: 1, label: lang === "ar" ? "الأساسيات" : "Basics", icon: "📋" },
    { num: 2, label: lang === "ar" ? "الأسئلة" : "Questions", icon: "❓" },
    { num: 3, label: lang === "ar" ? "نشر" : "Publish", icon: "🚀" },
  ];

  // ── Math toolbar panel ──
  const MathPanel = ({ onInsert }: { onInsert: (sym: string) => void }) => (
    <div className="p-2.5 bg-muted/60 rounded-lg border border-primary/20 mt-1.5">
      {MATH_GROUPS.map(group => (
        <div key={group.labelEn} className="mb-1.5">
          <span className="text-[10px] font-bold text-primary/60 uppercase tracking-wider block mb-1">
            {lang === "ar" ? group.labelAr : group.labelEn}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.symbols.map(sym => (
              <button key={sym} type="button" onClick={() => onInsert(sym)}
                className="w-8 h-8 flex items-center justify-center rounded bg-background border border-border hover:bg-primary/10 hover:border-primary/50 text-sm font-mono transition-colors">
                {sym}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Dictation question editor ──
  const DictationQuestionEditor = ({
    text, maxListens, allowErrors, lang: l,
    onTextChange, onMaxListensChange, onAllowErrorsChange,
  }: {
    text: string; maxListens: number; allowErrors: boolean; lang: string;
    onTextChange: (v: string) => void;
    onMaxListensChange: (v: number) => void;
    onAllowErrorsChange: (v: boolean) => void;
  }) => {
    const [speaking, setSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewTts = async () => {
      if (!text.trim()) return;
      if (speaking) {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: text.trim(), voice: "nova", speed: 0.85 }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
      } catch {
        setSpeaking(false);
        toast.error(l === "ar" ? "تعذّر تشغيل الصوت" : "Could not play audio");
      }
    };
    return (
      <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
            {l === "ar" ? "نص الإملاء الصوتي" : "Dictation Text"}
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder={l === "ar" ? "اكتب الجملة أو الفقرة التي سيسمعها الطالب..." : "Write the sentence or paragraph the student will hear..."}
          rows={3}
          dir="auto"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 transition-colors"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={previewTts}
            disabled={!text.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${speaking ? "bg-red-100 text-red-700 border border-red-300" : "bg-teal-600 text-white hover:bg-teal-700"}`}
          >
            {speaking ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {speaking ? (l === "ar" ? "إيقاف" : "Stop") : (l === "ar" ? "استمع للمعاينة" : "Preview Audio")}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{l === "ar" ? "عدد الاستماع:" : "Max listens:"}</span>
            <select
              value={maxListens}
              onChange={e => onMaxListensChange(parseInt(e.target.value))}
              className="px-2 py-1 rounded-md bg-background border border-border text-xs font-bold focus:outline-none"
            >
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAllowErrorsChange(!allowErrors)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${allowErrors ? "bg-teal-500" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${allowErrors ? (l === "ar" ? "right-0.5" : "left-[18px]") : (l === "ar" ? "left-0.5" : "left-0.5")}`} />
            </button>
            <span className="text-xs text-muted-foreground">{l === "ar" ? "قبول الأخطاء الإملائية البسيطة" : "Allow minor spelling errors"}</span>
          </div>
        </div>
        <p className="text-[10px] text-teal-600/70 dark:text-teal-400/60">
          🎙 {l === "ar" ? "سيسمع الطالب النص ثم يكتب ما سمعه. يُصحَّح تلقائياً." : "Student hears the text then types what they heard. Auto-graded."}
        </p>
      </div>
    );
  };

  // ── Toggle helper ──
  const Toggle = ({ on, onChange, color = "green" }: { on: boolean; onChange: () => void; color?: string }) => (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${on ? `bg-${color}-500` : "bg-gray-300 dark:bg-gray-600"}`}
      style={on ? { backgroundColor: color === "green" ? "#22c55e" : color === "orange" ? "#f97316" : color === "cyan" ? "#06b6d4" : "#22c55e" } : {}}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${on ? (lang === "ar" ? "right-0.5" : "left-[22px]") : (lang === "ar" ? "left-0.5" : "left-0.5")}`} />
    </button>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50/70 via-background to-amber-50/40 dark:from-emerald-950/30 dark:via-background dark:to-amber-950/20">
      <div className="container mx-auto px-4 py-6 max-w-3xl">

        {/* ══ Hero Header ══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-700 text-white p-5 sm:p-7 shadow-lg mb-6"
        >
          <div className="absolute -top-16 -end-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -start-12 w-48 h-48 rounded-full bg-amber-300/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <button
              onClick={() => setLocation("/teacher")}
              className="inline-flex items-center gap-1 text-white/85 hover:text-white mb-4 text-sm font-semibold transition-colors"
            >
              <BackArrowIcon className="w-4 h-4" />
              {t.createAssignment.backToDashboard}
            </button>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black leading-tight">
                  {t.createAssignment.wizardHeroTitle}
                </h1>
                <p className="text-white/85 text-xs sm:text-sm mt-1">
                  {t.createAssignment.wizardStepProgress
                    .replace("{current}", String(wizardStep))
                    .replace("{total}", String(STEPS.length))
                    .replace("{label}", STEPS[wizardStep - 1].label)}
                </p>
              </div>
            </div>

            {/* ══ Progress Bar (inside hero) ══ */}
            <div className="mt-5">
              <div className="flex items-center">
                {STEPS.map((step, idx) => (
                  <div key={step.num} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => { if (step.num < wizardStep) setWizardStep(step.num as 1|2|3); }}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-black transition-all border-2 ${
                          wizardStep === step.num
                            ? "bg-white text-primary border-white shadow-lg shadow-black/10 scale-110"
                            : wizardStep > step.num
                            ? "bg-amber-300 text-emerald-900 border-amber-300 cursor-pointer hover:scale-105"
                            : "bg-white/10 text-white/70 border-white/30 cursor-not-allowed backdrop-blur-sm"
                        }`}
                      >
                        {wizardStep > step.num ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                      </button>
                      <span className={`text-[10px] font-bold mt-1 whitespace-nowrap ${wizardStep === step.num ? "text-white" : "text-white/75"}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors ${wizardStep > step.num ? "bg-amber-300" : "bg-white/20"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════ STEP 1 — الأساسيات ══════════════════════════════════ */}
        <AnimatePresence mode="wait">
              {wizardStep === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
                  <h2 className="text-xl font-black text-foreground">{lang === "ar" ? "معلومات الواجب" : "Assignment Details"}</h2>

                  <Card className="p-5 space-y-4">
                    <div>
                      <Label className="text-sm font-bold mb-1.5 block">{t.createAssignment.assignmentTitle} <span className="text-destructive">*</span></Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.createAssignment.titlePlaceholder} className="text-base" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-bold mb-1.5 block">{t.createAssignment.subjectLabel}</Label>
                        <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={t.createAssignment.subjectPlaceholder} list="subject-suggestions" />
                        <datalist id="subject-suggestions">{getSuggestions("subjects").map((s, i) => <option key={i} value={s} />)}</datalist>
                        {isMathSubject && <p className="text-[10px] text-purple-600 mt-1 font-bold">Σ {lang === "ar" ? "سيتم تفعيل شريط الرياضيات تلقائياً" : "Math toolbar will activate automatically"}</p>}
                      </div>
                      <div>
                        <Label className="text-sm font-bold mb-1.5 block flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5" />{t.createAssignment.targetClass}
                        </Label>
                        {targetClasses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {targetClasses.map(c => (
                              <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                                {c}
                                <button type="button" onClick={() => setTargetClasses(prev => prev.filter(x => x !== c))}><X className="w-3 h-3" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        {gradeLevels.length > 0 ? (
                          <select value="" onChange={e => { const v = e.target.value; if (v && !targetClasses.includes(v)) setTargetClasses(prev => [...prev, v]); }}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="">{lang === "ar" ? "+ أضف فصل" : "+ Add a class"}</option>
                            {gradeLevels.filter(g => !targetClasses.includes(g.gradeLevel)).map(g => <option key={g.gradeLevel} value={g.gradeLevel}>{g.gradeLevel} ({g.count})</option>)}
                          </select>
                        ) : (
                          <div className="flex gap-1.5">
                            <Input value={classInput} onChange={e => setClassInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && classInput.trim()) { e.preventDefault(); const v = classInput.trim(); if (!targetClasses.includes(v)) setTargetClasses(prev => [...prev, v]); setClassInput(""); } }}
                              placeholder={t.createAssignment.targetClassPlaceholder} className="text-sm flex-1" list="class-suggestions" />
                            <button type="button" onClick={() => { const v = classInput.trim(); if (v && !targetClasses.includes(v)) setTargetClasses(prev => [...prev, v]); setClassInput(""); }}
                              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90"><Plus className="w-4 h-4" /></button>
                            <datalist id="class-suggestions">{getSuggestions("classes").map((c, i) => <option key={i} value={c} />)}</datalist>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Templates */}
                  <div className="space-y-3">
                    {/* Primary CTA — Start from scratch */}
                    {(() => {
                      const scratch = TEMPLATES.find(t => t.id === "scratch")!;
                      return (
                        <button type="button" onClick={() => applyTemplate(scratch)}
                          className={`w-full relative text-start p-4 rounded-xl border-2 transition-all hover:shadow-lg active:scale-[0.98] overflow-hidden bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 ${selectedTemplateId === "scratch" ? "ring-2 ring-primary/60 ring-offset-2" : ""}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{scratch.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-black text-primary-foreground">{lang === "ar" ? scratch.title : scratch.titleEn}</p>
                              <p className="text-xs mt-0.5 text-primary-foreground/70">{lang === "ar" ? scratch.desc : scratch.descEn}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-primary-foreground/70 shrink-0" />
                          </div>
                        </button>
                      );
                    })()}

                    {/* Collapsible template picker */}
                    <div>
                      <button type="button" onClick={() => setShowTemplates(v => !v)}
                        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors w-full group">
                        {showTemplates
                          ? <ChevronUp className="w-4 h-4 group-hover:text-primary transition-colors" />
                          : <ChevronDown className="w-4 h-4 group-hover:text-primary transition-colors" />}
                        {lang === "ar" ? "تصفح القوالب الجاهزة" : "Browse ready-made templates"}
                        {!showTemplates && (
                          <span className="ms-1 text-[11px] bg-muted px-1.5 py-0.5 rounded-full">{TEMPLATES.length - 1}</span>
                        )}
                      </button>

                      <AnimatePresence initial={false}>
                        {showTemplates && (
                          <motion.div
                            key="templates-grid"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                              {TEMPLATES.filter(tmpl => tmpl.id !== "scratch").map((tmpl) => (
                                <button key={tmpl.id} type="button" onClick={() => applyTemplate(tmpl)}
                                  className={`relative text-start p-3.5 rounded-xl border-2 bg-background transition-all hover:shadow-md active:scale-[0.97] overflow-hidden ${selectedTemplateId === tmpl.id ? "border-primary shadow-md" : "border-border hover:border-primary/40"}`}>
                                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: tmpl.color }} />
                                  <div className="flex items-center gap-2.5 mt-0.5">
                                    <span className="text-xl">{tmpl.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate text-foreground">{lang === "ar" ? tmpl.title : tmpl.titleEn}</p>
                                      <p className="text-[11px] mt-0.5 line-clamp-1 text-muted-foreground">{lang === "ar" ? tmpl.desc : tmpl.descEn}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(lang === "ar" ? tmpl.tags : tmpl.tagsEn).map(tag => (
                                      <span key={tag} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tmpl.bgColor, color: tmpl.color }}>{tag}</span>
                                    ))}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ══════════════════════════════════ STEP 2 — الأسئلة ══════════════════════════════════ */}
              {wizardStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-foreground">{lang === "ar" ? "الأسئلة" : "Questions"}</h2>
                    <div className="flex items-center gap-2">
                      <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-xs font-bold">{totalPoints} {t.createAssignment.gradeUnit}</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{questions.length} {t.createAssignment.aiQuestions}</span>
                    </div>
                  </div>

                  {/* AI Generate */}
                  {!isPaper && (
                    <Card className="p-4 border-2 border-primary/20 bg-primary/5">
                      {!showAiPanel ? (
                        <button type="button" onClick={() => setShowAiPanel(true)} className="w-full flex items-center justify-center gap-3 py-2 text-primary hover:text-primary/80 transition-colors">
                          <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow"><Sparkles className="w-4 h-4" /></div>
                          <div className={lang === "ar" ? "text-right" : "text-left"}>
                            <span className="block text-sm font-bold">{t.createAssignment.aiGenerate}</span>
                            <span className="block text-xs text-muted-foreground">{t.createAssignment.aiGenerateDesc}</span>
                          </div>
                        </button>
                      ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Wand2 className="w-4 h-4" />{t.createAssignment.aiGenerate}</h3>
                            <button type="button" onClick={() => { setShowAiPanel(false); setAiError(""); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </div>
                          <Input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder={t.createAssignment.aiTopicPlaceholder} className="bg-background border-primary/20 focus-visible:border-primary text-sm" />
                          <div className="flex gap-2">
                            <select value={aiCount} onChange={e => setAiCount(parseInt(e.target.value))} className="flex-1 px-3 py-2 rounded-lg bg-background border-2 border-primary/20 text-sm focus:outline-none focus:border-primary">
                              {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} {t.createAssignment.aiQuestions}</option>)}
                            </select>
                            <div className="flex gap-1 flex-1">
                              {difficultyOptions.map(d => (
                                <button key={d.value} type="button" onClick={() => setAiDifficulty(d.value)}
                                  className={`flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-all ${aiDifficulty === d.value ? d.color === "green" ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700" : d.color === "yellow" ? "border-yellow-500 bg-yellow-100 text-yellow-700" : "border-red-500 bg-red-100 text-red-700" : "border-border bg-background text-muted-foreground"}`}>
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {aiError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-2 text-xs text-red-700 dark:text-red-300">{aiError}</div>}
                          <button type="button" onClick={handleAiGenerate} disabled={aiLoading || !aiTopic.trim()}
                            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t.createAssignment.aiGenerating}</> : <><Sparkles className="w-4 h-4" />{t.createAssignment.aiGenerateBtn} {aiCount}</>}
                          </button>
                        </motion.div>
                      )}
                    </Card>
                  )}

                  {/* Image Extract (admin) */}
                  {!isPaper && (
                    <Card className={`p-4 border-2 border-primary/20 bg-primary/5 ${!isAdmin ? "opacity-50" : ""}`}>
                      {!showImageExtract ? (
                        <button type="button" onClick={() => isAdmin && setShowImageExtract(true)} disabled={!isAdmin}
                          className="w-full flex items-center justify-center gap-3 py-2 text-primary hover:text-primary/80 transition-colors disabled:cursor-not-allowed">
                          <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow"><Camera className="w-4 h-4" /></div>
                          <div className={lang === "ar" ? "text-right" : "text-left"}>
                            <span className="block text-sm font-bold">{lang === "ar" ? "استخراج الأسئلة من ملف أو كتاب" : "Extract Questions from a File or Book"}</span>
                            <span className="block text-xs text-muted-foreground">{lang === "ar" ? "ارفع صفحات من ملف أو كتاب ويستخرج الذكاء الاصطناعي الأسئلة — يمكنك تعديلها بعد الاستخراج" : "Upload pages from a file or book — AI extracts questions you can edit afterward"}</span>
                            {!isAdmin && <span className="block text-[10px] text-amber-600 font-bold mt-0.5">{lang === "ar" ? "يحتاج موافقة المسؤول" : "Requires admin approval"}</span>}
                          </div>
                        </button>
                      ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Camera className="w-4 h-4" />{lang === "ar" ? "استخراج من صور" : "Extract from Images"}</h3>
                            <button type="button" onClick={() => { setShowImageExtract(false); setExtractError(""); setExtractImages([]); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                          </div>
                          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageFiles} className="hidden" />
                          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={extractImages.length >= 5}
                            className="w-full py-3 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-1.5 disabled:opacity-50">
                            <Upload className="w-5 h-5 text-primary" />
                            <span className="text-xs text-primary font-bold">{lang === "ar" ? "اضغط لرفع صور (حتى 5)" : "Click to upload (up to 5)"}</span>
                          </button>
                          {extractImages.length > 0 && (
                            <div className="grid grid-cols-5 gap-2">
                              {extractImages.map((img, i) => (
                                <div key={i} className="relative group">
                                  <img src={img} alt="" className="w-full aspect-square object-cover rounded-lg border-2 border-primary/20" />
                                  <button type="button" onClick={() => setExtractImages(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1">
                            {difficultyOptions.map(d => (
                              <button key={d.value} type="button" onClick={() => setExtractDifficulty(d.value)}
                                className={`flex-1 py-1.5 rounded border text-xs font-bold transition-all ${extractDifficulty === d.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                                {d.label}
                              </button>
                            ))}
                          </div>
                          {extractError && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">{extractError}</div>}
                          <button type="button" onClick={handleExtractFromImage} disabled={extractLoading || extractImages.length === 0}
                            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                            {extractLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{lang === "ar" ? "جاري الاستخراج..." : "Extracting..."}</> : <><Camera className="w-4 h-4" />{lang === "ar" ? "استخرج الأسئلة" : "Extract Questions"}</>}
                          </button>
                        </motion.div>
                      )}
                    </Card>
                  )}

                  {/* Paper mode */}
                  {isPaper ? (
                    <Card className="p-5 space-y-4">
                      <h2 className="text-base font-bold border-b border-border pb-3 flex items-center gap-2"><Star className="w-5 h-5 text-secondary" />{t.createAssignment.paperGrade}</h2>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300"><strong>{t.createAssignment.note}</strong> {t.createAssignment.paperNote}</div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t.createAssignment.totalGrade}</Label>
                        <input type="number" min="1" step="0.5" value={paperTotalPoints} onChange={e => setPaperTotalPoints(parseFloat(e.target.value) || 1)}
                          className="w-24 px-3 py-2 rounded-lg bg-secondary/10 border-2 border-secondary/30 text-center font-black text-xl text-secondary focus:outline-none focus:border-secondary transition-all" />
                        <span className="text-sm font-bold text-muted-foreground">{t.createAssignment.gradeUnit}</span>
                      </div>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleQuestionDragEnd}>
                        <SortableContext items={questions.map(q => q._clientId!)} strategy={verticalListSortingStrategy}>
                      <AnimatePresence>
                        {questions.map((q, qIndex) => (
                          <SortableQuestionWrapper key={q._clientId} id={q._clientId!}>
                            {({ attributes, listeners, isDragging }) => (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <Card className={`p-4 ${lang === "ar" ? "border-l-4 border-l-secondary" : "border-r-4 border-r-secondary"} relative group ${isDragging ? "ring-2 ring-primary/40 shadow-xl" : ""}`}>
                              {/* Question header controls */}
                              <div className={`absolute top-3 ${lang === "ar" ? "left-3" : "right-3"} flex items-center gap-0.5`}>
                                {questions.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      {...attributes}
                                      {...listeners}
                                      title={lang === "ar" ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
                                      aria-label={lang === "ar" ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
                                      className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors cursor-grab active:cursor-grabbing touch-none"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleMoveQuestion(qIndex, "up")} disabled={qIndex === 0} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                    <button type="button" onClick={() => handleMoveQuestion(qIndex, "down")} disabled={qIndex === questions.length - 1} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-4 h-4" /></button>
                                    <button type="button" onClick={() => handleRemoveQuestion(qIndex)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </>
                                )}
                              </div>

                              <div className="mb-3">
                                {/* Type + Points */}
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-xs font-bold text-muted-foreground">{t.createAssignment.questionLabel} {qIndex + 1}</span>
                                  <select value={q.questionType === "whiteboard" ? (q.optionA === "lined" ? "whiteboard" : "whiteboard_blank") : (q.questionType || "mcq")}
                                    onChange={e => {
                                    const v = e.target.value;
                                    if (v === "mcq" || v === "true_false" || v === "fill_blank" || v === "whiteboard" || v === "whiteboard_blank" || v === "dictation") handleQuestionTypeChange(qIndex, v);
                                  }}
                                    className="px-2 py-1 rounded-md bg-muted/50 border border-border text-[11px] font-bold focus:outline-none focus:border-primary transition-all">
                                    <option value="mcq">{t.createAssignment.questionTypeMcq}</option>
                                    <option value="true_false">{t.createAssignment.questionTypeTrueFalse}</option>
                                    <option value="fill_blank">{t.createAssignment.questionTypeFillBlank}</option>
                                    <option value="dictation">🎙 {lang === "ar" ? "إملاء صوتي" : "Dictation"}</option>
                                    <option value="whiteboard_blank">{t.createAssignment.questionTypeWhiteboardBlank}</option>
                                    <option value="whiteboard">{t.createAssignment.questionTypeWhiteboard}</option>
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <input type="number" min="0.5" step="0.5" value={q.points || 1} onChange={e => handleQuestionChange(qIndex, 'points', parseFloat(e.target.value) || 1)}
                                      className="w-14 px-2 py-1 rounded-md bg-secondary/10 border border-secondary/30 text-center text-xs font-bold text-secondary focus:outline-none focus:border-secondary transition-all" />
                                    <span className="text-[11px] text-muted-foreground">{t.createAssignment.gradeLabel}</span>
                                  </div>
                                </div>

                                {/* Question text */}
                                <Input required value={q.text} onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)} placeholder={t.createAssignment.questionPlaceholder} className="text-sm" />

                                {/* Math toolbar (auto-open if math subject, or manually toggled) */}
                                {(isMathSubject || mathToolbarFor === qIndex) && (
                                  <MathPanel onInsert={sym => handleQuestionChange(qIndex, 'text', (q.text || "") + sym)} />
                                )}

                                {/* Toolbar row */}
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  {/* Image button — single button with inline picker */}
                                  {q.imageUrl ? (
                                    <div className="relative inline-block">
                                      <img src={q.imageUrl} alt="" className="max-h-20 rounded border border-border object-contain" />
                                      <button type="button" onClick={() => handleQuestionChange(qIndex, 'imageUrl', null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <button type="button" onClick={() => setImagePickerFor(imagePickerFor === qIndex ? -1 : qIndex)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border border-dashed transition-colors ${imagePickerFor === qIndex ? "text-primary bg-primary/10 border-primary/50" : "text-muted-foreground hover:text-primary hover:bg-primary/10 border-border hover:border-primary/50"}`}>
                                        <Image className="w-3 h-3" />{lang === "ar" ? "صورة" : "Image"}
                                      </button>
                                      {imagePickerFor === qIndex && (
                                        <div className="absolute top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[160px]">
                                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
                                            <Upload className="w-4 h-4 text-primary" />{lang === "ar" ? "رفع من الجهاز" : "Upload from device"}
                                            <input type="file" accept="image/*" className="sr-only" onChange={async e => { const file = e.target.files?.[0]; if (file) { const b64 = await fileToBase64(file); handleQuestionChange(qIndex, 'imageUrl', b64); setImagePickerFor(-1); } e.target.value = ""; }} />
                                          </label>
                                          <button type="button" onClick={() => { const url = prompt(lang === "ar" ? "الصق رابط الصورة (URL):" : "Paste image URL:"); if (url?.trim()) { handleQuestionChange(qIndex, 'imageUrl', url.trim()); setImagePickerFor(-1); } }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                            🔗 {lang === "ar" ? "رابط URL" : "Paste URL"}
                                          </button>
                                          <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q.text || (lang === "ar" ? "صورة" : "image"))}`}
                                            target="_blank" rel="noopener noreferrer" onClick={() => setImagePickerFor(-1)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                                            🔍 {lang === "ar" ? "بحث Google" : "Google Images"}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Math toggle (only if NOT already auto-opened) */}
                                  {!isMathSubject && (
                                    <button type="button" onClick={() => setMathToolbarFor(mathToolbarFor === qIndex ? -1 : qIndex)}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border border-dashed transition-colors ${mathToolbarFor === qIndex ? "text-primary bg-primary/10 border-primary/50" : "text-muted-foreground hover:text-primary hover:bg-primary/10 border-border hover:border-primary/40"}`}>
                                      Σ {lang === "ar" ? "رياضيات" : "Math"}
                                    </button>
                                  )}

                                  {/* Read aloud */}
                                  <button type="button" onClick={() => handleQuestionChange(qIndex, 'readAloud', !q.readAloud)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.readAloud ? "bg-teal-50 border-teal-400 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" : "border-dashed border-border text-muted-foreground hover:text-teal-600 hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-900/20"}`}>
                                    🔊 {t.createAssignment.readAloud}
                                  </button>

                                  {/* Allow multiple answers (MCQ) */}
                                  {(q.questionType || "mcq") === "mcq" && (
                                    <button type="button" onClick={() => {
                                      const nextMulti = !q.allowMultipleAnswers;
                                      setQuestions(prev => prev.map((pq, pi) => {
                                        if (pi !== qIndex) return pq;
                                        if (nextMulti) {
                                          // Switching to multi — seed correctAnswers from existing single answer
                                          const seed = pq.correctAnswer && ["A","B","C","D"].includes(pq.correctAnswer) ? [pq.correctAnswer] : ["A"];
                                          return { ...pq, allowMultipleAnswers: true, correctAnswers: seed, correctAnswer: seed.join(",") };
                                        } else {
                                          // Switching to single — use first valid answer or "A"
                                          const cur = pq.correctAnswers || [];
                                          const first = cur.find(a => ["A","B","C","D"].includes(a)) || "A";
                                          return { ...pq, allowMultipleAnswers: false, correctAnswers: [first], correctAnswer: first };
                                        }
                                      }));
                                    }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.allowMultipleAnswers ? "bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-dashed border-border text-muted-foreground hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20"}`}>
                                      ☑️ {t.createAssignment.multiAnswer}
                                    </button>
                                  )}

                                  {/* Repeat */}
                                  <button type="button" onClick={() => handleQuestionChange(qIndex, 'repeatQuestion', !q.repeatQuestion)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${q.repeatQuestion ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : "border-dashed border-border text-muted-foreground hover:text-orange-600 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/20"}`}>
                                    🔁 {t.createAssignment.repeat}
                                  </button>
                                </div>
                              </div>

                              {/* MCQ options */}
                              {(q.questionType || "mcq") === "mcq" && (
                                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                                  {(["A", "B", "C", "D"] as const).map(opt => {
                                    const isCorrect = q.allowMultipleAnswers
                                      ? (q.correctAnswers || []).includes(opt)
                                      : q.correctAnswer === opt;
                                    const toggleCorrect = () => {
                                      if (q.allowMultipleAnswers) {
                                        const cur: string[] = q.correctAnswers || [];
                                        const next: string[] = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
                                        setQuestions(prev => prev.map((pq, pi) =>
                                          pi === qIndex ? { ...pq, correctAnswers: next, correctAnswer: next.join(",") } : pq
                                        ));
                                      } else {
                                        setQuestions(prev => prev.map((pq, pi) =>
                                          pi === qIndex ? { ...pq, correctAnswer: opt, correctAnswers: [opt] } : pq
                                        ));
                                      }
                                    };
                                    return (
                                      <div key={opt} className="flex items-center gap-2">
                                        <button type="button" onClick={toggleCorrect}
                                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all shrink-0 ${isCorrect ? "bg-green-500 border-green-500 text-white" : "border-border text-muted-foreground hover:border-green-400 hover:bg-green-50/50"}`}>
                                          {opt}
                                        </button>
                                        <div className="flex-1 relative">
                                          <Input value={q[MCQ_OPT[opt]] || ""} onChange={e => handleQuestionChange(qIndex, MCQ_OPT[opt], e.target.value)}
                                            placeholder={`${t.createAssignment.option} ${opt}`} className="text-sm pe-8" />
                                          {/* Math for option if math subject */}
                                          {isMathSubject && (
                                            <button type="button"
                                              onClick={() => setMathOptionFor(mathOptionFor?.qIdx === qIndex && mathOptionFor?.opt === opt ? null : { qIdx: qIndex, opt })}
                                              className="absolute end-2 top-1/2 -translate-y-1/2 text-purple-500 text-xs font-bold opacity-60 hover:opacity-100">Σ</button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {/* Math panel for option */}
                                  {isMathSubject && mathOptionFor?.qIdx === qIndex && (
                                    <MathPanel onInsert={sym => {
                                      const optKey = MCQ_OPT[mathOptionFor.opt as keyof typeof MCQ_OPT];
                                      if (optKey) {
                                        const cur = q[optKey] || "";
                                        handleQuestionChange(qIndex, optKey, cur + sym);
                                      }
                                    }} />
                                  )}
                                </div>
                              )}

                              {/* True/False */}
                              {q.questionType === "true_false" && (
                                <div className="flex gap-2">
                                  {[["true", lang === "ar" ? "✅ صح" : "✅ True"], ["false", lang === "ar" ? "❌ خطأ" : "❌ False"]].map(([val, label]) => (
                                    <button key={val} type="button" onClick={() => handleQuestionChange(qIndex, 'correctAnswer', val)}
                                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${q.correctAnswer === val ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "border-border bg-muted/30 text-muted-foreground hover:border-green-400"}`}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Fill blank */}
                              {q.questionType === "fill_blank" && (
                                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                                  <Label className="text-xs mb-1 block">{t.createAssignment.fillBlankAnswer}</Label>
                                  <div className="flex gap-2">
                                    <Input required value={q.correctAnswer?.split("|")[0] || ""}
                                      onChange={e => { const parts = (q.correctAnswer || "").split("|"); parts[0] = e.target.value; handleQuestionChange(qIndex, 'correctAnswer', parts.filter(Boolean).join("|")); }}
                                      placeholder={t.createAssignment.fillBlankPlaceholder} className="text-sm flex-1" />
                                  </div>
                                  {(q.correctAnswer || "").split("|").slice(1).map((alt: string, altIdx: number) => (
                                    <div key={altIdx} className="flex gap-2 items-center">
                                      <span className="text-xs text-muted-foreground shrink-0">{lang === "ar" ? "أو:" : "or:"}</span>
                                      <Input value={alt}
                                        onChange={e => { const parts = (q.correctAnswer || "").split("|"); parts[altIdx + 1] = e.target.value; handleQuestionChange(qIndex, 'correctAnswer', parts.filter((_, i) => i === 0 || Boolean(parts[i])).join("|")); }}
                                        placeholder={lang === "ar" ? "إجابة بديلة مقبولة" : "Alternative accepted answer"} className="text-sm flex-1" />
                                      <button type="button" onClick={() => { const parts = (q.correctAnswer || "").split("|"); parts.splice(altIdx + 1, 1); handleQuestionChange(qIndex, 'correctAnswer', parts.join("|")); }}
                                        className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => { const cur = q.correctAnswer || ""; handleQuestionChange(qIndex, 'correctAnswer', cur ? cur + "|" : "|"); }}
                                    className="text-xs text-primary/70 hover:text-primary flex items-center gap-1">
                                    <Plus className="w-3 h-3" />{lang === "ar" ? "أضف إجابة بديلة" : "Add alternative answer"}
                                  </button>
                                  {isMathSubject && (
                                    <MathPanel onInsert={sym => { const parts = (q.correctAnswer || "").split("|"); parts[0] = (parts[0] || "") + sym; handleQuestionChange(qIndex, 'correctAnswer', parts.join("|")); }} />
                                  )}
                                  <p className="text-[10px] text-muted-foreground/60">{lang === "ar" ? "ستُقبل أي من هذه الإجابات (غير حساسة للأحرف)" : "Any of these answers will be accepted (case-insensitive)"}</p>
                                </div>
                              )}

                              {/* Dictation question */}
                              {q.questionType === "dictation" && (
                                <DictationQuestionEditor
                                  text={q.optionA || ""}
                                  maxListens={parseInt(q.optionB || "3") || 3}
                                  allowErrors={q.optionC !== "false"}
                                  lang={lang}
                                  onTextChange={v => {
                                    handleQuestionChange(qIndex, "optionA", v);
                                    handleQuestionChange(qIndex, "correctAnswer", v);
                                  }}
                                  onMaxListensChange={v => handleQuestionChange(qIndex, "optionB", String(v))}
                                  onAllowErrorsChange={v => handleQuestionChange(qIndex, "optionC", v ? "true" : "false")}
                                />
                              )}

                              {q.questionType === "whiteboard" && (
                                <div className="bg-muted/30 p-2 rounded-lg">
                                  <span className="text-[11px] text-muted-foreground">{q.optionA === "lined" ? `📝 ${t.createAssignment.whiteboardLined}` : `🎨 ${t.createAssignment.whiteboardBlank}`}</span>
                                </div>
                              )}
                            </Card>
                          </motion.div>
                            )}
                          </SortableQuestionWrapper>
                        ))}
                      </AnimatePresence>
                        </SortableContext>
                      </DndContext>

                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={handleAddQuestion} className="flex-1 py-3 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-sm">
                          <Plus className={`w-4 h-4 ${lang === "ar" ? "ml-1.5" : "mr-1.5"}`} />{t.createAssignment.addQuestion}
                        </Button>
                        <Button type="button" variant="outline" onClick={openBankModal} className="flex-1 py-3 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary text-sm">
                          <Database className={`w-4 h-4 ${lang === "ar" ? "ml-1.5" : "mr-1.5"}`} />{t.questionBank.selectQuestions}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* AI Grading Instructions — only when paper submission OR fill_blank/whiteboard questions exist */}
                  {(submissionMode === "paper" || submissionMode === "both" || questions.some(q => q.questionType === "fill_blank" || q.questionType === "whiteboard")) && (
                    <Card className="p-4 border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                      <div className="flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-amber-600" /><h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">{t.createAssignment.aiGradingInstructions}</h2></div>
                      <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mb-2">{t.createAssignment.aiGradingInstructionsDesc}</p>
                      <textarea value={aiGradingInstructions} onChange={e => setAiGradingInstructions(e.target.value)} placeholder={t.createAssignment.aiGradingInstructionsPlaceholder}
                        className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-amber-700 bg-background text-sm resize-none focus:outline-none focus:border-amber-400 transition-colors" rows={2} />
                    </Card>
                  )}
                </motion.div>
              )}

              {/* ══════════════════════════════════ STEP 3 — معاينة ونشر ══════════════════════════════════ */}
              {wizardStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
                  <h2 className="text-xl font-black text-foreground">{lang === "ar" ? "معاينة ونشر" : "Preview & Publish"}</h2>

                  {/* Summary card */}
                  <Card className="p-5 bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0"
                        style={{ backgroundColor: COLOR_THEMES.find(c => c.id === colorTheme)?.light, color: COLOR_THEMES.find(c => c.id === colorTheme)?.bg }}>
                        📋
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-foreground truncate">{title || (lang === "ar" ? "بدون عنوان" : "Untitled")}</p>
                        {subject && <p className="text-sm text-muted-foreground">{subject}</p>}
                        {targetClasses.length > 0 && <p className="text-xs text-muted-foreground mt-0.5">{targetClasses.join("، ")}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{questions.length} {lang === "ar" ? "سؤال" : "questions"}</span>
                          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500" />{totalPoints} {lang === "ar" ? "درجة" : "pts"}</span>
                          <span className="flex items-center gap-1">
                            {submissionMode === "electronic" ? <Monitor className="w-3.5 h-3.5" /> : submissionMode === "paper" ? <FileText className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                            {submissionMode === "electronic" ? t.createAssignment.electronic : submissionMode === "paper" ? t.createAssignment.paper : t.createAssignment.electronicAndPaperShort}
                          </span>
                          {deadline && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{deadline.replace("T", " ")}</span>}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Access code */}
                  <Card className="p-5 space-y-3">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{lang === "ar" ? "كود الدخول" : "Access Code"}</h3>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex gap-1.5">
                        {accessCode.split("").map((ch, i) => (
                          <div key={i} className="w-10 h-12 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl font-black text-primary">
                            {ch}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(accessCode); toast.success(lang === "ar" ? "تم نسخ الكود" : "Code copied!"); }}
                        className="p-2.5 rounded-xl border border-border hover:bg-primary/10 hover:border-primary/40 transition-all">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">{lang === "ar" ? "يستخدمه الطلاب للوصول للواجب" : "Students use this to access the assignment"}</p>
                  </Card>

                  {/* Questions preview */}
                  <div>
                    <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2"><Eye className="w-4 h-4" />{lang === "ar" ? "معاينة الأسئلة (كما يراها الطالب)" : "Questions Preview (student view)"}</h3>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                      {questions.map((q, i) => (
                        <div key={i} className="rounded-xl border-2 border-border p-4 bg-background">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0 mt-0.5">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground leading-snug">{q.text || <span className="text-muted-foreground/50">{lang === "ar" ? "نص السؤال..." : "Question text..."}</span>}</p>
                              {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-36 rounded-lg border border-border object-contain" />}
                            </div>
                            <span className="text-xs font-bold text-secondary shrink-0">{q.points || 1} {lang === "ar" ? "د" : "pt"}</span>
                          </div>
                          {(q.questionType === "mcq" || !q.questionType) && (
                            <div className="grid grid-cols-2 gap-2">
                              {(["A", "B", "C", "D"] as const).map(opt => {
                                const text = q[MCQ_OPT[opt]];
                                if (!text) return null;
                                const isCorrect = q.correctAnswer === opt || (q.correctAnswers || []).includes(opt);
                                return (
                                  <div key={opt} className={`px-3 py-2 rounded-lg text-sm font-medium border-2 ${isCorrect ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border bg-muted/20 text-foreground"}`}>
                                    <span className="font-bold text-xs text-muted-foreground mr-1">{opt}.</span>{text}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {q.questionType === "true_false" && (
                            <div className="flex gap-2">
                              {[["true", lang === "ar" ? "صح" : "True"], ["false", lang === "ar" ? "خطأ" : "False"]].map(([val, label]) => (
                                <div key={val} className={`flex-1 py-2 rounded-lg text-center text-sm font-bold border-2 ${q.correctAnswer === val ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border bg-muted/20 text-muted-foreground"}`}>{label}</div>
                              ))}
                            </div>
                          )}
                          {q.questionType === "fill_blank" && (
                            <div>
                              <div className="px-3 py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground">{lang === "ar" ? "[ اكتب إجابتك هنا ]" : "[ Type your answer here ]"}</div>
                              {q.correctAnswer && <p className="text-xs text-green-600 mt-1 font-medium">{lang === "ar" ? "الإجابة: " : "Answer: "}{q.correctAnswer.split("|").join(" / ")}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced settings (collapsible) */}
                  <Card className="p-0 overflow-hidden">
                    <button type="button" onClick={() => setShowAdvancedSettings(v => !v)}
                      className="w-full px-5 py-4 flex items-center justify-between text-start hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-bold block">{lang === "ar" ? "إعدادات متقدمة" : "Advanced Settings"}</span>
                          <span className="text-[11px] text-muted-foreground">{lang === "ar" ? "طريقة التسليم، الكود، الموعد، الوضع التكيفي، وأكثر" : "Submission, code, deadline, adaptive, and more"}</span>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showAdvancedSettings && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border">
                  {/* Submission mode */}
                  <Card className="p-5 space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />{t.createAssignment.submissionMethod}</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "electronic" as SubmissionMode, label: t.createAssignment.electronicOnly, icon: <Monitor className="w-4 h-4" /> },
                        { value: "paper" as SubmissionMode, label: t.createAssignment.paperOnly, icon: <FileText className="w-4 h-4" /> },
                        { value: "both" as SubmissionMode, label: t.createAssignment.electronicAndPaper, icon: <Layers className="w-4 h-4" /> },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => handleModeChange(opt.value)}
                          className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center gap-2 transition-all ${submissionMode === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                          {opt.icon}{opt.label}
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Toggles */}
                  <Card className="p-5 divide-y divide-border space-y-0">
                    {/* Show results */}
                    <div className="flex items-center justify-between py-3 first:pt-0">
                      <div className="flex items-center gap-2.5">
                        {showResults ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-amber-500" />}
                        <div>
                          <span className="text-sm font-bold block">{t.createAssignment.showResults}</span>
                          <span className="text-[11px] text-muted-foreground">{showResults ? t.createAssignment.showResultsOn : t.createAssignment.showResultsOff}</span>
                        </div>
                      </div>
                      <Toggle on={showResults} onChange={() => setShowResults(!showResults)} color="green" />
                    </div>

                    {/* Results release mode — standalone (not exam-mode-only) */}
                    <div className="py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-bold">{t.createAssignment.resultsRelease}</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { v: "immediate", label: lang === "ar" ? "فوري" : "Immediate" },
                          { v: "after_deadline", label: lang === "ar" ? "بعد الموعد" : "After Deadline" },
                          { v: "manual", label: lang === "ar" ? "يدوي" : "Manual" },
                        ].map(({ v, label }) => (
                          <button key={v} type="button"
                            onClick={() => { if (v === "immediate" || v === "after_deadline" || v === "manual") setResultsReleaseMode(v); }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${resultsReleaseMode === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Allow retry */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-base ${allowRetry ? "opacity-100" : "opacity-40"}`}>🔁</span>
                        <div>
                          <span className="text-sm font-bold block">{lang === "ar" ? "السماح بإعادة المحاولة" : "Allow Retry"}</span>
                          <span className="text-[11px] text-muted-foreground">{allowRetry ? (lang === "ar" ? "يمكن للطلاب إعادة الواجب" : "Students can retake the assignment") : (lang === "ar" ? "محاولة واحدة فقط" : "One attempt only")}</span>
                        </div>
                      </div>
                      <Toggle on={allowRetry} onChange={() => setAllowRetry(!allowRetry)} color="green" />
                    </div>

                    {/* Share publicly */}
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2.5">
                        <Globe className={`w-4 h-4 ${isShared ? "text-cyan-500" : "text-muted-foreground"}`} />
                        <div>
                          <span className="text-sm font-bold block">{lang === "ar" ? "مشاركة عامة" : "Share Publicly"}</span>
                          <span className="text-[11px] text-muted-foreground">{isShared ? (lang === "ar" ? "مرئي للمعلمين الآخرين" : "Visible to other teachers") : (lang === "ar" ? "خاص بك فقط" : "Only visible to you")}</span>
                        </div>
                      </div>
                      <Toggle on={isShared} onChange={() => setIsShared(!isShared)} color="cyan" />
                    </div>

                    {/* Exam mode */}
                    {!isPaper && (
                      <div className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Clock className={`w-4 h-4 ${examMode ? "text-orange-500" : "text-muted-foreground"}`} />
                            <div>
                              <span className="text-sm font-bold block">{t.createAssignment.examMode}</span>
                              <span className="text-[11px] text-muted-foreground">{t.createAssignment.examModeDesc}</span>
                            </div>
                          </div>
                          <Toggle on={examMode} onChange={() => setExamMode(!examMode)} color="orange" />
                        </div>
                        <AnimatePresence>
                          {examMode && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="mt-3">
                                <Label className="text-xs">{t.createAssignment.examDuration}</Label>
                                <input type="number" min="1" max="300" value={examDurationMinutes} onChange={e => setExamDurationMinutes(parseInt(e.target.value) || 30)}
                                  className="w-32 px-3 py-2 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary mt-1" dir="ltr" />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Adaptive */}
                    <div className="py-3">
                      <div className={`flex items-center justify-between ${!isAdmin ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-2.5">
                          <Brain className={`w-4 h-4 ${isAdaptive ? "text-violet-500" : "text-muted-foreground"}`} />
                          <div>
                            <span className="text-sm font-bold block text-violet-700 dark:text-violet-300">{lang === "ar" ? "الوضع التكيّفي" : "Adaptive Mode"}</span>
                            <span className="text-[11px] text-muted-foreground">{lang === "ar" ? "كل طالب يحصل على أسئلة حسب مستواه" : "Each student gets questions matched to their level"}</span>
                            {!isAdmin && <span className="block text-[10px] text-amber-600 font-bold mt-0.5">{lang === "ar" ? "يحتاج موافقة المسؤول" : "Requires admin approval"}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => isAdmin && setIsAdaptive(!isAdaptive)} disabled={!isAdmin}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isAdaptive ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}>
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isAdaptive ? (lang === "ar" ? "right-0.5" : "left-[22px]") : (lang === "ar" ? "left-0.5" : "left-0.5")}`} />
                        </button>
                      </div>
                      <AnimatePresence>
                        {isAdaptive && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-3 p-3 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-3">
                              <div className="flex flex-wrap gap-1.5">
                                {adaptiveSkills.map((sk, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground text-xs font-bold">
                                    {sk}<button type="button" onClick={() => setAdaptiveSkills(adaptiveSkills.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input value={adaptiveSkillInput} onChange={e => setAdaptiveSkillInput(e.target.value)}
                                  placeholder={lang === "ar" ? "أضف مهارة" : "Add a skill"} className="text-sm flex-1"
                                  onKeyDown={e => { if (e.key === "Enter" && adaptiveSkillInput.trim()) { e.preventDefault(); if (!adaptiveSkills.includes(adaptiveSkillInput.trim())) setAdaptiveSkills([...adaptiveSkills, adaptiveSkillInput.trim()]); setAdaptiveSkillInput(""); } }} />
                                <button type="button" onClick={() => { if (adaptiveSkillInput.trim() && !adaptiveSkills.includes(adaptiveSkillInput.trim())) setAdaptiveSkills([...adaptiveSkills, adaptiveSkillInput.trim()]); setAdaptiveSkillInput(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold"><Plus className="w-4 h-4" /></button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs font-bold text-violet-700">{lang === "ar" ? "أسئلة لكل طالب:" : "Questions per student:"}</Label>
                                <Input type="number" min={3} max={50} value={adaptiveQuestionsPerSession} onChange={e => setAdaptiveQuestionsPerSession(parseInt(e.target.value) || 10)} className="w-24 text-sm" />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Card>

                  {/* Access mode */}
                  <Card className="p-5 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" />{t.createAssignment.accessMode}</h3>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAccessMode("public")}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${accessMode === "public" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        <Globe className="w-4 h-4" />{t.createAssignment.public}
                      </button>
                      <button type="button" onClick={() => setAccessMode("private")}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${accessMode === "private" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        <Lock className="w-4 h-4" />{t.createAssignment.privateCode}
                      </button>
                    </div>
                    <AnimatePresence>
                      {accessMode === "private" && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <Label className="text-sm">{t.createAssignment.accessCodeLabel}</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input value={accessCode} onChange={e => setAccessCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="font-mono tracking-widest text-center" dir="ltr" />
                            <button type="button" onClick={() => navigator.clipboard.writeText(accessCode)} className="p-2 rounded-lg border border-border hover:bg-primary/10 transition-all" title={t.createAssignment.copyCode}><Copy className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setAccessCode(generateAccessCode())} className="p-2 rounded-lg border border-border hover:bg-primary/10 transition-all text-xs whitespace-nowrap">{t.createAssignment.newCode}</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Deadline */}
                  <Card className="p-5 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" />{t.createAssignment.deadlineLabel}</h3>
                    {deadline ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground bg-muted px-3 py-1.5 rounded-lg flex-1" dir="ltr">{deadline.replace("T", " ")}</span>
                        <button type="button" onClick={() => { setDeadlineDraft(deadline); setShowDatePicker(true); }} className="px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10">{lang === "ar" ? "تعديل" : "Edit"}</button>
                        <button type="button" onClick={() => setDeadline("")} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setDeadlineDraft(""); setShowDatePicker(true); }}
                        className="px-4 py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-all">
                        {lang === "ar" ? "+ تحديد موعد التسليم" : "+ Set submission deadline"}
                      </button>
                    )}
                    <AnimatePresence>
                      {showDatePicker && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                            <input type="datetime-local" value={deadlineDraft} onChange={e => setDeadlineDraft(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border-2 border-border text-sm focus:outline-none focus:border-primary" dir="ltr" />
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => setShowDatePicker(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                              <button type="button" onClick={() => { setDeadline(deadlineDraft); setShowDatePicker(false); }} className="px-4 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">{lang === "ar" ? "تم" : "OK"}</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Color theme */}
                  <Card className="p-5 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">🎨 {lang === "ar" ? "لون الواجب" : "Assignment Color"}</h3>
                    <div className="flex gap-3 flex-wrap">
                      {COLOR_THEMES.map(ct => (
                        <button key={ct.id} type="button" onClick={() => setColorTheme(ct.id)}
                          className={`flex flex-col items-center gap-1.5 transition-all ${colorTheme === ct.id ? "scale-110" : "hover:scale-105 opacity-70 hover:opacity-100"}`}>
                          <div className={`w-10 h-10 rounded-xl border-4 transition-all ${colorTheme === ct.id ? "border-foreground shadow-lg" : "border-transparent"}`}
                            style={{ backgroundColor: ct.bg }} />
                          <span className="text-[10px] font-bold text-muted-foreground">{lang === "ar" ? ct.label : ct.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Categories */}
                  {availableCategories.length > 0 && (
                    <Card className="p-5 space-y-3">
                      <h3 className="text-sm font-bold flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground" />{lang === "ar" ? "التصنيف" : "Category"}</h3>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setCategoryId(null)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${!categoryId ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                          {lang === "ar" ? "بدون" : "None"}
                        </button>
                        {availableCategories.map((cat: any) => {
                          const colorMap: Record<string, string> = { teal: "#14b8a6", blue: "#3b82f6", violet: "#8b5cf6", green: "#22c55e", orange: "#f97316", red: "#ef4444", yellow: "#eab308", pink: "#ec4899", indigo: "#6366f1", rose: "#f43f5e" };
                          return (
                            <button key={cat.id} type="button" onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${categoryId === cat.id ? "bg-foreground text-background border-foreground" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorMap[cat.color] || "#14b8a6" }} />{cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Paper model answer */}
                  {(submissionMode === "paper" || submissionMode === "both") && (
                    <Card className="p-5 space-y-3">
                      <h3 className="text-sm font-bold flex items-center gap-2"><Image className="w-4 h-4 text-primary" />{t.createAssignment.modelAnswer}</h3>
                      <p className="text-muted-foreground text-xs">{t.createAssignment.modelAnswerDesc}</p>
                      <input type="file" accept="image/*" className="hidden" ref={modelImageRef} onChange={handleModelImageUpload} />
                      {modelImage ? (
                        <div className="relative rounded-lg overflow-hidden border border-primary/30">
                          <img src={modelImage} alt="" className="w-full max-h-[150px] object-contain bg-black/5" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 justify-between">
                            <span className="text-white text-xs font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" />{t.createAssignment.modelUploaded}</span>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => modelImageRef.current?.click()} className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-white text-[11px] font-bold hover:bg-white/30">{t.createAssignment.change}</button>
                              <button type="button" onClick={() => setModelImage(null)} className="p-0.5 bg-red-500/80 backdrop-blur-md rounded text-white hover:bg-red-500"><X className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => modelImageRef.current?.click()} className="w-full py-4 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all flex flex-col items-center gap-1.5">
                          <Image className="w-6 h-6 opacity-50" />
                          <span className="text-xs font-bold">{t.createAssignment.uploadModel}</span>
                          <span className="text-[10px] opacity-70">{t.createAssignment.imageFormats}</span>
                        </button>
                      )}
                    </Card>
                  )}

                  {/* Description */}
                  <Card className="p-5 space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{t.createAssignment.descriptionLabel}</h3>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.createAssignment.descriptionPlaceholder}
                      className="w-full px-3 py-2 rounded-lg bg-background border-2 border-border text-sm resize-none focus:outline-none focus:border-primary transition-all min-h-[70px]" />
                  </Card>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>


                  {/* Publish button */}
                  <button type="button" onClick={handlePublish} disabled={createMutation.isPending}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary via-primary to-emerald-700 hover:opacity-95 text-primary-foreground font-black text-base shadow-xl shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                    {createMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" />{t.createAssignment.savingAssignment}</> : <><Save className="w-5 h-5" />{lang === "ar" ? "نشر الواجب الآن 🚀" : "Publish Assignment 🚀"}</>}
                  </button>
                  {createMutation.isError && (
                    <p className="text-sm text-destructive text-center">{(createMutation.error as Error)?.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ══ Sticky Navigation ══ */}
            <div className="sticky bottom-4 z-20 mt-6">
              <div className="bg-background/90 backdrop-blur-xl border border-border rounded-2xl shadow-xl shadow-black/10 p-3 flex items-center justify-between gap-3">
                <button type="button" onClick={goPrev} disabled={wizardStep === 1}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  <BackArrowIcon className="w-4 h-4" />
                  {lang === "ar" ? "السابق" : "Previous"}
                </button>

                <div className="flex items-center gap-1">
                  {STEPS.map(step => (
                    <div key={step.num} className={`h-1.5 rounded-full transition-all ${wizardStep === step.num ? "w-6 bg-primary" : wizardStep > step.num ? "w-3 bg-emerald-400" : "w-3 bg-muted-foreground/30"}`} />
                  ))}
                </div>

                {wizardStep < 3 ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={goToPreview}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-primary/40 text-primary text-xs font-bold hover:bg-primary/10 transition-all">
                      <Eye className="w-4 h-4" />
                      {lang === "ar" ? "معاينة" : "Preview"}
                    </button>
                    <button type="button" onClick={goNext}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.97]">
                      {lang === "ar" ? "التالي" : "Next"}
                      {lang === "ar" ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={handlePublish} disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-700 text-primary-foreground text-sm font-bold hover:opacity-95 transition-all shadow-lg shadow-primary/25 disabled:opacity-60">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {lang === "ar" ? "نشر" : "Publish"}
                  </button>
                )}
              </div>
            </div>
      </div>

      {/* ══ Draft Prompt Modal ══ */}
      <AnimatePresence>
        {draftPromptOpen && draftSnapshot && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">📝</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-foreground leading-snug">{t.createAssignment.draftFoundTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{(() => {
                    const ms = Date.now() - (draftSnapshot.savedAt || Date.now());
                    const mins = Math.floor(ms / 60000);
                    const hrs = Math.floor(mins / 60);
                    const days = Math.floor(hrs / 24);
                    if (days >= 1) return t.createAssignment.draftSavedDaysAgo.replace("{n}", String(days));
                    if (hrs >= 1) return t.createAssignment.draftSavedHoursAgo.replace("{n}", String(hrs));
                    if (mins >= 1) return t.createAssignment.draftSavedMinutesAgo.replace("{n}", String(mins));
                    return t.createAssignment.draftSavedJustNow;
                  })()}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t.createAssignment.draftFoundDesc}</p>
              <div className="rounded-xl border border-border bg-muted/30 p-3 mb-5 space-y-1">
                <p className="text-sm font-bold text-foreground truncate">
                  {draftSnapshot.title?.trim() || (lang === "ar" ? "بدون عنوان" : "Untitled")}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                  {draftSnapshot.subject?.trim() && <span>{draftSnapshot.subject}</span>}
                  <span>{draftSnapshot.questions?.length || 0} {lang === "ar" ? "سؤال" : "questions"}</span>
                  <span>{lang === "ar" ? "الخطوة" : "Step"} {Math.min(draftSnapshot.wizardStep, 3)}/3</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleStartFresh}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all">
                  {t.createAssignment.startFresh}
                </button>
                <button type="button" onClick={handleContinueDraft}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {t.createAssignment.continueDraft}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Bank Modal ══ */}
      <AnimatePresence>
        {showBankModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowBankModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-border max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-black text-foreground mb-2 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-600" />{t.questionBank.selectQuestions}</h3>
              <p className="text-sm text-muted-foreground mb-4">{bankSelected.size} {t.questionBank.selectedCount}</p>
              {(() => {
                const subjects = [...new Set(bankQuestions.map((q: any) => q.subject))];
                return subjects.length > 1 ? (
                  <select value={bankFilterSubject} onChange={e => setBankFilterSubject(e.target.value)} className="mb-3 px-3 py-2 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary text-sm">
                    <option value="">{t.questionBank.allSubjects}</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : null;
              })()}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {bankLoading ? (
                  <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : bankQuestions.filter((q: any) => !bankFilterSubject || q.subject === bankFilterSubject).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{t.questionBank.noQuestions}</div>
                ) : (
                  bankQuestions.filter((q: any) => !bankFilterSubject || q.subject === bankFilterSubject).map((q: any) => (
                    <button key={q.id} type="button" onClick={() => toggleBankQuestion(q.id)} className={`w-full text-start p-3 rounded-xl border-2 transition-all ${bankSelected.has(q.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${bankSelected.has(q.id) ? "bg-primary border-primary text-white" : "border-border"}`}>
                          {bankSelected.has(q.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">{q.subject}</span>
                            <span className="text-[10px] text-muted-foreground">{q.points} {lang === "ar" ? "د" : "pts"}</span>
                          </div>
                          <p className="text-sm font-bold text-foreground leading-snug">{q.text}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex gap-3 mt-4 pt-3 border-t border-border">
                <button onClick={() => setShowBankModal(false)} type="button" className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80">{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                <button onClick={importBankQuestions} type="button" disabled={bankSelected.size === 0} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-black shadow-lg hover:bg-primary/90 disabled:opacity-50">{t.questionBank.addSelected} ({bankSelected.size})</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </Layout>
  );
}
