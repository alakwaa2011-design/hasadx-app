import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Volume2,
  Square,
  Play,
  Mic,
  ChevronRight,
  ChevronLeft,
  Check,
  GraduationCap,
  BookOpen,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ── Types ──────────────────────────────────────────────────────────────────

interface GradingOpts {
  ignoreDiacritics: boolean;
  ignoreShadda: boolean;
  ignoreTanween: boolean;
  allowErrors: boolean;
  tolerance: number; // 0-3
}

interface DictationItem {
  id: string;
  text: string;
  instruction: string;
  maxListens: number;
  speed: number; // 0.6 / 0.85 / 1.0
  grading: GradingOpts;
}

const DEFAULT_GRADING: GradingOpts = {
  ignoreDiacritics: true,
  ignoreShadda: true,
  ignoreTanween: true,
  allowErrors: true,
  tolerance: 1,
};

const newItem = (): DictationItem => ({
  id: crypto.randomUUID(),
  text: "",
  instruction: "",
  maxListens: 3,
  speed: 0.85,
  grading: { ...DEFAULT_GRADING },
});

// ── Sortable item wrapper ─────────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`relative rounded-2xl border-2 bg-card transition-shadow ${isDragging ? "shadow-2xl border-teal-400" : "border-border shadow-sm"}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-4 end-4 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 touch-manipulation"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </div>
  );
}

// ── TTS preview hook ──────────────────────────────────────────────────────

function useTtsPreview() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async (itemId: string, text: string, speed: number) => {
    if (speakingId === itemId) {
      audioRef.current?.pause();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(itemId);
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: text.trim(), voice: "shimmer", speed }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      setSpeakingId(null);
      toast.error("تعذّر تشغيل الصوت");
    }
  }, [speakingId]);

  return { speakingId, play };
}

// ── Dictation item editor ─────────────────────────────────────────────────

function DictationItemEditor({
  item,
  index,
  total,
  isAr,
  onUpdate,
  onDelete,
  speakingId,
  onPreview,
}: {
  item: DictationItem;
  index: number;
  total: number;
  isAr: boolean;
  onUpdate: (id: string, patch: Partial<DictationItem>) => void;
  onDelete: (id: string) => void;
  speakingId: string | null;
  onPreview: (id: string, text: string, speed: number) => void;
}) {
  const isSpeaking = speakingId === item.id;
  const [showGrading, setShowGrading] = useState(false);

  const speeds = [
    { value: 0.65, label: isAr ? "بطيء جداً" : "Very Slow" },
    { value: 0.85, label: isAr ? "بطيء" : "Slow" },
    { value: 1.0, label: isAr ? "طبيعي" : "Normal" },
  ];

  return (
    <div className="p-5 pt-4">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4 pe-6">
        <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-700 dark:text-teal-300 text-xs font-black shrink-0">
          {index + 1}
        </div>
        <span className="text-sm font-bold text-muted-foreground">
          {isAr ? `الجملة ${index + 1}` : `Sentence ${index + 1}`}
        </span>
        {total > 1 && (
          <button
            onClick={() => onDelete(item.id)}
            className="ms-auto text-muted-foreground hover:text-red-500 transition-colors p-1"
            title={isAr ? "حذف" : "Delete"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dictation text */}
      <textarea
        value={item.text}
        onChange={(e) => onUpdate(item.id, { text: e.target.value })}
        placeholder={
          isAr
            ? "اكتب الجملة أو الفقرة التي سيسمعها الطالب..."
            : "Write the sentence or paragraph the student will hear..."
        }
        rows={3}
        dir="auto"
        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 transition-colors mb-3"
      />

      {/* Optional instruction text */}
      <input
        type="text"
        value={item.instruction}
        onChange={(e) => onUpdate(item.id, { instruction: e.target.value })}
        placeholder={
          isAr
            ? "تعليمات للطالب (اختياري) — مثال: استمع وأكتب"
            : "Student instructions (optional) — e.g. Listen and write"
        }
        dir="auto"
        className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-xs resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 transition-colors mb-3"
      />

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* TTS preview */}
        <button
          type="button"
          onClick={() => item.text.trim() && onPreview(item.id, item.text, item.speed)}
          disabled={!item.text.trim()}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 ${
            isSpeaking
              ? "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300"
              : "bg-teal-600 text-white hover:bg-teal-700"
          }`}
        >
          {isSpeaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {isSpeaking
            ? (isAr ? "إيقاف" : "Stop")
            : (isAr ? "استمع للمعاينة" : "Preview Audio")}
        </button>

        {/* Speed */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{isAr ? "السرعة:" : "Speed:"}</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {speeds.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onUpdate(item.id, { speed: s.value })}
                className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  item.speed === s.value
                    ? "bg-teal-600 text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max listens */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{isAr ? "عدد الاستماع:" : "Max listens:"}</span>
          <select
            value={item.maxListens}
            onChange={(e) => onUpdate(item.id, { maxListens: parseInt(e.target.value) })}
            className="px-2 py-1 rounded-lg bg-background border border-border text-xs font-bold focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grading options toggle */}
      <button
        type="button"
        onClick={() => setShowGrading((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showGrading
          ? (isAr ? "إخفاء خيارات التصحيح ▲" : "Hide grading options ▲")
          : (isAr ? "خيارات التصحيح ▼" : "Grading options ▼")}
      </button>

      {showGrading && (
        <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {/* Allow minor errors */}
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  onUpdate(item.id, {
                    grading: { ...item.grading, allowErrors: !item.grading.allowErrors },
                  })
                }
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  item.grading.allowErrors
                    ? "bg-teal-600 border-teal-600"
                    : "bg-background border-border"
                }`}
              >
                {item.grading.allowErrors && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span className="text-xs text-foreground">{isAr ? "قبول أخطاء إملائية بسيطة" : "Allow minor spelling errors"}</span>
            </label>

            {/* Ignore diacritics */}
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  onUpdate(item.id, {
                    grading: { ...item.grading, ignoreDiacritics: !item.grading.ignoreDiacritics },
                  })
                }
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  item.grading.ignoreDiacritics
                    ? "bg-teal-600 border-teal-600"
                    : "bg-background border-border"
                }`}
              >
                {item.grading.ignoreDiacritics && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span className="text-xs text-foreground">{isAr ? "تجاهل التشكيل" : "Ignore diacritics"}</span>
            </label>

            {/* Ignore shadda */}
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  onUpdate(item.id, {
                    grading: { ...item.grading, ignoreShadda: !item.grading.ignoreShadda },
                  })
                }
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  item.grading.ignoreShadda
                    ? "bg-teal-600 border-teal-600"
                    : "bg-background border-border"
                }`}
              >
                {item.grading.ignoreShadda && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span className="text-xs text-foreground">{isAr ? "تجاهل الشدة" : "Ignore shadda"}</span>
            </label>

            {/* Ignore tanween */}
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  onUpdate(item.id, {
                    grading: { ...item.grading, ignoreTanween: !item.grading.ignoreTanween },
                  })
                }
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  item.grading.ignoreTanween
                    ? "bg-teal-600 border-teal-600"
                    : "bg-background border-border"
                }`}
              >
                {item.grading.ignoreTanween && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span className="text-xs text-foreground">{isAr ? "تجاهل التنوين" : "Ignore tanween"}</span>
            </label>
          </div>

          {/* Tolerance slider */}
          {item.grading.allowErrors && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{isAr ? "مستوى التسامح:" : "Error tolerance:"}</span>
                <span className="text-xs font-bold text-teal-600">
                  {["دقيق", "بسيط", "معتدل", "متسامح"][item.grading.tolerance] ||
                    ["Exact", "Slight", "Moderate", "Loose"][item.grading.tolerance]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={item.grading.tolerance}
                onChange={(e) =>
                  onUpdate(item.id, {
                    grading: { ...item.grading, tolerance: parseInt(e.target.value) },
                  })
                }
                className="w-full accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{isAr ? "دقيق" : "Exact"}</span>
                <span>{isAr ? "متسامح" : "Loose"}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DictationCreate() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const queryClient = useQueryClient();

  // Steps: 1=basics, 2=sentences, 3=publish
  const [step, setStep] = useState(1);

  // Basics
  const [title, setTitle] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  // Sentences
  const [items, setItems] = useState<DictationItem[]>([newItem()]);
  const { speakingId, play: previewTts } = useTtsPreview();

  // Publish
  const [isShared, setIsShared] = useState(false);
  const [accessMode, setAccessMode] = useState<"public" | "private">("public");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setGradeLevels)
      .catch(() => {});
  }, []);

  const updateItem = (id: string, patch: Partial<DictationItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [...prev, newItem()]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((it) => it.id === active.id);
        const newIndex = prev.findIndex((it) => it.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await fetch(`${API_BASE}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في الحفظ");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success(isAr ? "تم نشر الإملاء بنجاح 🎉" : "Dictation published successfully 🎉");
      setLocation(`/teacher/assignment/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const validateAndNext = () => {
    if (step === 1) {
      if (!title.trim()) {
        toast.error(isAr ? "الرجاء إدخال عنوان للنشاط" : "Please enter an activity title");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const empty = items.findIndex((it) => !it.text.trim());
      if (empty !== -1) {
        toast.error(
          isAr
            ? `الجملة ${empty + 1} فارغة — يرجى كتابة النص`
            : `Sentence ${empty + 1} is empty — please write the text`,
        );
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = () => {
    const questions = items.map((item, i) => ({
      text: item.instruction.trim() || (isAr ? `استمع وأكتب — الجملة ${i + 1}` : `Listen and write — Sentence ${i + 1}`),
      questionType: "dictation" as const,
      optionA: item.text.trim(),
      optionB: String(item.maxListens),
      optionC: item.grading.allowErrors ? "true" : "false",
      optionD: JSON.stringify({
        ignoreDiacritics: item.grading.ignoreDiacritics,
        ignoreShadda: item.grading.ignoreShadda,
        ignoreTanween: item.grading.ignoreTanween,
        tolerance: item.grading.tolerance,
      }),
      correctAnswer: "",
      points: 1,
    }));

    createMutation.mutate({
      title: title.trim(),
      submissionMode: "electronic",
      accessMode,
      targetClass: targetClasses[0] || undefined,
      targetClasses: targetClasses.length > 0 ? targetClasses : undefined,
      isShared,
      showResults: true,
      questions,
    });
  };

  const STEPS = [
    { n: 1, label: isAr ? "الأساسيات" : "Basics", icon: <BookOpen className="w-4 h-4" /> },
    { n: 2, label: isAr ? "الجمل" : "Sentences", icon: <Mic className="w-4 h-4" /> },
    { n: 3, label: isAr ? "النشر" : "Publish", icon: <Send className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : setLocation("/teacher/new"))}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors shrink-0"
          >
            {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-1 flex-1">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => s.n < step && setStep(s.n)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    step === s.n
                      ? "bg-teal-600 text-white"
                      : s.n < step
                      ? "text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.n < step ? <Check className="w-3 h-3" /> : s.icon}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 rounded ${s.n < step ? "bg-teal-300" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ── Step 1: Basics ─────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-xl font-black text-foreground mb-1">
                {isAr ? "الأساسيات" : "Basics"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAr ? "أدخل عنوان الإملاء والصف الدراسي" : "Enter the dictation title and target class"}
              </p>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">
                {isAr ? "عنوان النشاط" : "Activity Title"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isAr ? "مثال: إملاء الدرس الأول" : "e.g. Lesson 1 Dictation"}
                dir="auto"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Target classes */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <GraduationCap className="w-4 h-4 text-teal-600" />
                {isAr ? "الصف الدراسي (اختياري)" : "Target Class (optional)"}
              </label>
              {targetClasses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {targetClasses.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 text-xs font-bold"
                    >
                      {c}
                      <button
                        onClick={() => setTargetClasses((prev) => prev.filter((x) => x !== c))}
                        className="hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && !targetClasses.includes(v))
                    setTargetClasses((prev) => [...prev, v]);
                }}
                className="px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none"
              >
                <option value="">{isAr ? "+ أضف صفاً" : "+ Add a class"}</option>
                {gradeLevels
                  .filter((g) => !targetClasses.includes(g.gradeLevel))
                  .map((g) => (
                    <option key={g.gradeLevel} value={g.gradeLevel}>
                      {g.gradeLevel} ({g.count})
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        {/* ── Step 2: Sentences ──────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-xl font-black text-foreground mb-1">
                {isAr ? "الجمل الصوتية" : "Dictation Sentences"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "أضف الجمل التي سيسمعها الطالب ويكتبها"
                  : "Add sentences the student will hear and write"}
              </p>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {items.map((item, i) => (
                    <SortableItem key={item.id} id={item.id}>
                      <DictationItemEditor
                        item={item}
                        index={i}
                        total={items.length}
                        isAr={isAr}
                        onUpdate={updateItem}
                        onDelete={deleteItem}
                        speakingId={speakingId}
                        onPreview={previewTts}
                      />
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add sentence */}
            <button
              onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 font-bold text-sm hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isAr ? "إضافة جملة جديدة" : "Add New Sentence"}
            </button>
          </>
        )}

        {/* ── Step 3: Publish ────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-xl font-black text-foreground mb-1">
                {isAr ? "النشر" : "Publish"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAr ? "اختر كيف تريد نشر هذا النشاط" : "Choose how to share this activity"}
              </p>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-bold text-teal-800 dark:text-teal-200">{title}</span>
              </div>
              <p className="text-xs text-teal-700 dark:text-teal-400 ps-6">
                {items.length} {isAr ? "جملة" : "sentence(s)"}
                {targetClasses.length > 0 && ` · ${targetClasses.join(", ")}`}
              </p>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">
                {isAr ? "الظهور" : "Visibility"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: false, label: isAr ? "خاص" : "Private", desc: isAr ? "للمدرسين فقط" : "Teachers only" },
                  { val: true, label: isAr ? "عام" : "Public", desc: isAr ? "يظهر للطلاب" : "Visible to students" },
                ].map(({ val, label, desc }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setIsShared(val)}
                    className={`p-4 rounded-xl border-2 text-start transition-all ${
                      isShared === val
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="text-sm font-bold">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {isAr ? `${items.length} جملة` : `${items.length} sentence(s)`}
          </span>

          {step < 3 ? (
            <Button
              onClick={validateAndNext}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {isAr ? "التالي" : "Next"}
              {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isAr ? "جارٍ النشر..." : "Publishing..."}
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {isAr ? "نشر الإملاء" : "Publish Dictation"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
