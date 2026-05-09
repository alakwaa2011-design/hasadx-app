import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
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
  Plus,
  Trash2,
  GripVertical,
  Volume2,
  Square,
  Mic,
  Pencil,
  Check,
  GraduationCap,
  Minus,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Headphones,
  ListChecks,
  AlignLeft,
  Settings2,
  Infinity,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const API_BASE = import.meta.env.VITE_API_URL || "";

const COLOR_BG = "#FAFAF8";
const COLOR_PRIMARY = "#14532D";
const COLOR_AMBER = "#D97706";
const COLOR_CARD_BORDER = "#E5E7EB";

const MAX_CHARS = 1500;
const MAX_QUESTION_CHARS = 300;

// ===================== Types =====================

interface GradingOpts {
  ignoreDiacritics: boolean;
  ignoreTanween: boolean;
  ignoreShadda: boolean;
  ignorePunctuation: boolean;
  allowErrors: boolean;
  tolerancePercent: number;
}

type QuestionType = "dictation" | "mcq" | "open";

interface QuestionItem {
  id: string;
  type: QuestionType;
  text: string; // question prompt
  // MCQ
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string; // "A" | "B" | "C" | "D"
  // Dictation grading
  grading: GradingOpts;
  points: number;
}

interface ListeningSettings {
  maxListens: number; // 0 = infinite
  allowSpeedControl: boolean;
  allowSeek: boolean;
  showTranscript: boolean;
}

const DEFAULT_GRADING: GradingOpts = {
  ignoreDiacritics: true,
  ignoreTanween: true,
  ignoreShadda: false,
  ignorePunctuation: true,
  allowErrors: true,
  tolerancePercent: 15,
};

const DEFAULT_SETTINGS: ListeningSettings = {
  maxListens: 0,
  allowSpeedControl: true,
  allowSeek: true,
  showTranscript: true,
};

const newQuestion = (type: QuestionType = "open"): QuestionItem => ({
  id: crypto.randomUUID(),
  type,
  text: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  grading: { ...DEFAULT_GRADING },
  points: 1,
});

const VOICES = [
  { id: "shimmer", label: "شيمر — نسائي هادئ" },
  { id: "nova", label: "نوفا — نسائي واضح" },
  { id: "alloy", label: "ألوي — محايد" },
  { id: "echo", label: "إيكو — رجالي ناعم" },
  { id: "onyx", label: "أونيكس — رجالي عميق" },
];

function speedLabelAr(v: number): string {
  if (v <= 0.76) return "بطيء جداً ٠.٧٥×";
  if (v <= 0.88) return "بطيء ٠.٨٥×";
  if (v <= 1.0) return "عادي ١×";
  if (v <= 1.13) return "سريع ١.١×";
  return "سريع جداً ١.٢٥×";
}

// ===================== Hooks =====================

function useTtsPreview() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSpeakingId(null);
    setProgress(0);
  }, []);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds),
      );
    }
  }, []);

  const setSpeed = useCallback((speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const play = useCallback(
    async (itemId: string, text: string, speed: number, voice = "shimmer") => {
      if (speakingId === itemId) {
        stopAudio();
        return;
      }
      stopAudio();
      setSpeakingId(itemId);
      try {
        const res = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: text.trim(), voice, speed }),
        });
        if (!res.ok) throw new Error("tts failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = speed;
        audioRef.current = audio;
        intervalRef.current = setInterval(() => {
          if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
        }, 200);
        audio.onended = () => {
          stopAudio();
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          stopAudio();
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch {
        stopAudio();
        toast.error("تعذّر تشغيل الصوت");
      }
    },
    [speakingId, stopAudio],
  );

  return { speakingId, progress, play, stopAudio, seek, setSpeed };
}

// ===================== Sub-components =====================

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-[12px] border bg-white shadow-sm ${isDragging ? "ring-2 ring-amber-200 shadow-lg z-10" : ""}`}
      style={{
        borderColor: COLOR_CARD_BORDER,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.92 : 1,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-4 end-3 z-10 cursor-grab active:cursor-grabbing p-1 rounded text-[#64748B] hover:bg-[#F1F5F9]"
        aria-label="إعادة ترتيب"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      {children}
    </div>
  );
}

function ToggleCell({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-[#E8EDE9]">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 mt-0.5 data-[state=checked]:bg-[#14532D]"
      />
      <div dir="rtl" className="min-w-0 text-right">
        <p className="text-sm font-bold text-[#0f2918]">{label}</p>
        {hint && <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const map: Record<QuestionType, { label: string; color: string; icon: React.ReactNode }> = {
    mcq: { label: "اختيار متعدد", color: "bg-blue-50 text-blue-700 border-blue-200", icon: <ListChecks className="w-3.5 h-3.5" /> },
    dictation: { label: "إملاء", color: "bg-amber-50 text-amber-700 border-amber-200", icon: <Mic className="w-3.5 h-3.5" /> },
    open: { label: "إجابة مفتوحة", color: "bg-purple-50 text-purple-700 border-purple-200", icon: <AlignLeft className="w-3.5 h-3.5" /> },
  };
  const { label, color, icon } = map[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      {icon} {label}
    </span>
  );
}

// ===================== Main Component =====================

export default function DictationCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  // Audio source
  const [audioText, setAudioText] = useState("");
  const [audioVoice, setAudioVoice] = useState("shimmer");
  const [audioSpeed, setAudioSpeed] = useState(0.9);
  const [previewSpeed, setPreviewSpeed] = useState(1.0);

  // Questions
  const [questions, setQuestions] = useState<QuestionItem[]>([newQuestion("open")]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Settings
  const [settings, setSettings] = useState<ListeningSettings>(DEFAULT_SETTINGS);

  const [isShared, setIsShared] = useState(false);
  const [accessMode, setAccessMode] = useState<"public" | "private">("public");

  const { speakingId, progress, play: previewTts, seek, setSpeed } = useTtsPreview();

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

  useEffect(() => {
    if (activeIndex >= questions.length) setActiveIndex(Math.max(0, questions.length - 1));
  }, [questions.length, activeIndex]);

  const updateQuestion = (id: string, patch: Partial<QuestionItem>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const updateGrading = (id: string, patch: Partial<GradingOpts>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, grading: { ...q.grading, ...patch } } : q)),
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      const next = prev.filter((q) => q.id !== id);
      const out = next.length ? next : [newQuestion("open")];
      setActiveIndex((a) => {
        if (prev.length <= 1) return 0;
        if (idx === a) return Math.max(0, a - 1);
        if (idx < a) return a - 1;
        return Math.min(a, out.length - 1);
      });
      return out;
    });
  };

  const addQuestion = (type: QuestionType) => {
    setQuestions((prev) => {
      const next = [...prev, newQuestion(type)];
      setActiveIndex(next.length - 1);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQuestions((prev) => {
        const oldIndex = prev.findIndex((q) => q.id === active.id);
        const newIndex = prev.findIndex((q) => q.id === over.id);
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
      toast.success("تم نشر نشاط الاستماع بنجاح 🎉");
      setLocation(`/teacher/assignment/${data.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const validateStep1 = () => {
    if (!title.trim()) {
      toast.error("الرجاء إدخال عنوان النشاط");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!audioText.trim()) {
      toast.error("الرجاء إدخال نص الاستماع الرئيسي");
      return false;
    }
    const emptyQ = questions.findIndex((q) => !q.text.trim());
    if (emptyQ !== -1) {
      toast.error(`السؤال ${emptyQ + 1} فارغ — أدخل نص السؤال`);
      setActiveIndex(emptyQ);
      return false;
    }
    for (const q of questions) {
      if (q.type === "mcq") {
        if (!q.optionA.trim() || !q.optionB.trim()) {
          toast.error("أدخل خيارَين على الأقل في أسئلة الاختيار المتعدد");
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmitPublish = () => {
    createMutation.mutate({
      title: title.trim(),
      submissionMode: "electronic",
      accessMode,
      targetClass: targetClasses[0] || undefined,
      targetClasses: targetClasses.length > 0 ? targetClasses : undefined,
      isShared,
      showResults: true,
      activityType: "listening",
      listeningAudioText: audioText.trim(),
      listeningVoice: audioVoice,
      listeningSpeed: audioSpeed,
      listeningSettings: settings,
      questions: questions.map((q, i) => ({
        text: q.text.trim(),
        questionType: q.type,
        optionA: q.type === "mcq" ? q.optionA : q.type === "dictation" ? audioText.trim() : "",
        optionB: q.type === "mcq" ? q.optionB : q.type === "dictation" ? String(settings.maxListens) : "",
        optionC: q.type === "mcq" ? q.optionC : q.type === "dictation" ? (q.grading.allowErrors ? "true" : "false") : "",
        optionD: q.type === "mcq"
          ? q.optionD
          : q.type === "dictation"
          ? JSON.stringify({
              ignoreDiacritics: q.grading.ignoreDiacritics,
              ignoreShadda: q.grading.ignoreShadda,
              ignoreTanween: q.grading.ignoreTanween,
              ignorePunctuation: q.grading.ignorePunctuation,
              tolerancePercent: q.grading.tolerancePercent,
              voice: audioVoice,
              speed: audioSpeed,
              allowSpeedControl: settings.allowSpeedControl,
              allowSeek: settings.allowSeek,
              showTranscript: settings.showTranscript,
            })
          : "",
        correctAnswer: q.type === "mcq" ? q.correctAnswer : "",
        points: q.points,
        order: i + 1,
      })),
    });
  };

  const STEPS_LABELS = ["الأساسيات", "المحتوى", "النشر"] as const;

  const footerBack = () => {
    if (step === 1) setLocation("/teacher/new");
    else setStep(((step - 1) as 1 | 2 | 3));
  };

  const footerPrimaryAction = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    } else {
      handleSubmitPublish();
    }
  };

  const isAudioPlaying = speakingId === "main-audio";

  return (
    <div className="min-h-[100dvh] pb-[88px]" style={{ backgroundColor: COLOR_BG }} dir="rtl">

      {/* ── Header / Step Bar ── */}
      <header
        className="sticky top-0 z-30 shadow-sm border-b border-[#0a2815]/20"
        style={{ backgroundColor: COLOR_PRIMARY }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 shrink-0" aria-hidden />
          <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
            {STEPS_LABELS.map((label, idx) => {
              const sn = idx + 1;
              const done = step > sn;
              const current = step === sn;
              return (
                <div key={label} className="flex items-center">
                  {idx < 2 && (
                    <span className={`mx-2 text-lg font-black ${done || current ? "text-white/55" : "text-white/30"}`}>
                      ←
                    </span>
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-colors ${
                      current ? "text-[#78350f] shadow-sm" : done ? "text-white/90" : "text-white/45"
                    }`}
                    style={current ? { backgroundColor: COLOR_AMBER } : undefined}
                  >
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span>{sn}</span>}
                    <span className="whitespace-nowrap">{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={footerBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white shrink-0 transition-colors"
            aria-label="رجوع"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          STEP 1 — الأساسيات
      ══════════════════════════════════════════ */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto px-4 pt-8 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#ecfdf5] border-2 border-[#14532D]/60 text-[#14532D]">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0f2918]">نشاط الاستماع</h1>
              <p className="text-sm text-[#4b5563] font-medium">الطالب يستمع ثم يجيب على الأسئلة</p>
            </div>
          </div>

          <div className="space-y-1.5 text-right">
            <label className="text-sm font-bold text-[#0f2918]">عنوان النشاط *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: قصة الأرنب والسلحفاة — فهم المسموع"
              dir="auto"
              className="w-full px-4 py-3 rounded-[12px] bg-white border text-sm focus:outline-none focus:ring-2 focus:ring-[#14532D]/35"
              style={{ borderColor: COLOR_CARD_BORDER }}
            />
          </div>

          <div className="space-y-2 text-right">
            <label className="flex items-center justify-end gap-2 text-sm font-bold text-[#0f2918]">
              <GraduationCap className="w-4 h-4 text-[#14532D]" />
              الصف الدراسي (اختياري)
            </label>
            {targetClasses.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {targetClasses.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ecfdf5] text-[#14532d] text-xs font-bold border border-emerald-200">
                    {c}
                    <button type="button" onClick={() => setTargetClasses((p) => p.filter((x) => x !== c))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v && !targetClasses.includes(v)) setTargetClasses((prev) => [...prev, v]);
              }}
              className="px-3 py-2 rounded-[12px] bg-white border w-full max-w-xs ms-auto block text-sm"
              style={{ borderColor: COLOR_CARD_BORDER }}
            >
              <option value="">+ أضف صفاً</option>
              {gradeLevels
                .filter((g) => !targetClasses.includes(g.gradeLevel))
                .map((g) => (
                  <option key={g.gradeLevel} value={g.gradeLevel}>
                    {g.gradeLevel} ({g.count})
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 2 — المحتوى
      ══════════════════════════════════════════ */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

          {/* ── قسم النص الصوتي الرئيسي ── */}
          <div className="rounded-2xl border-2 border-[#14532D]/20 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#f0fdf4] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#14532D] flex items-center justify-center text-white shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-[#0f2918] text-base">النص الصوتي الرئيسي</h2>
                <p className="text-xs text-[#4b5563] mt-0.5">اكتب القصة أو الحوار أو النص الذي سيستمع إليه الطالب</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                value={audioText}
                dir="rtl"
                onChange={(e) => setAudioText(e.target.value.slice(0, MAX_CHARS))}
                rows={6}
                placeholder={`مثال:\nكان يا ما كان، في قديم الزمان، أرنبٌ سريع وسلحفاةٌ بطيئة...\n\nيمكنك كتابة قصة كاملة أو حوار أو نص تعليمي.`}
                className="w-full px-4 py-3 rounded-[12px] bg-[#fdfdfd] border text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#14532D]/30 resize-none text-[#111827]"
                style={{ borderColor: COLOR_CARD_BORDER }}
              />
              <div className="flex justify-between items-center text-xs font-bold text-[#94a3b8]">
                <span>{audioText.length} / {MAX_CHARS} حرف</span>
              </div>

              {/* إعدادات الصوت */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#374151]">الصوت</label>
                  <select
                    value={audioVoice}
                    onChange={(e) => setAudioVoice(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-[10px] bg-white border text-sm focus:outline-none focus:ring-2 focus:ring-[#14532D]/30"
                    style={{ borderColor: COLOR_CARD_BORDER }}
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#374151]">سرعة القراءة</span>
                    <span className="text-xs font-black text-[#D97706]">{speedLabelAr(audioSpeed)}</span>
                  </div>
                  <Slider
                    value={[Math.round(audioSpeed * 100)]}
                    onValueChange={([v]) => setAudioSpeed(Math.min(1.25, Math.max(0.6, (v ?? 90) / 100)))}
                    min={60}
                    max={125}
                    step={5}
                    className="w-full pt-1"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-[#94a3b8]">
                    <span>سريع</span>
                    <span>بطيء</span>
                  </div>
                </div>
              </div>

              {/* مشغّل المعاينة */}
              <div className="rounded-xl border bg-[#F8FAF9] p-4 space-y-3" style={{ borderColor: COLOR_CARD_BORDER }}>
                <p className="text-xs font-bold text-[#64748B] text-right">معاينة الصوت للمعلم</p>

                {/* شريط التقدم */}
                <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${isAudioPlaying ? progress : 0}%`, backgroundColor: COLOR_PRIMARY }}
                  />
                </div>

                {/* أزرار التحكم */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => seek(-10)}
                    disabled={!isAudioPlaying}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center text-[#14532D] border-[#E5E7EB] hover:bg-[#ecfdf5] disabled:opacity-30"
                    title="رجوع ١٠ ثوانٍ"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!audioText.trim()}
                    onClick={() => previewTts("main-audio", audioText, audioSpeed, audioVoice)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-md transition-colors disabled:opacity-40 ${
                      isAudioPlaying ? "bg-red-500 hover:bg-red-600" : "bg-[#14532D] hover:bg-[#166534]"
                    }`}
                  >
                    {isAudioPlaying ? <Square className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => seek(10)}
                    disabled={!isAudioPlaying}
                    className="w-10 h-10 rounded-xl border flex items-center justify-center text-[#14532D] border-[#E5E7EB] hover:bg-[#ecfdf5] disabled:opacity-30"
                    title="تقدم ١٠ ثوانٍ"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* تحكم السرعة للمعاينة */}
                <div className="flex items-center justify-center gap-2">
                  {[0.75, 1, 1.25, 1.5].map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => { setPreviewSpeed(sp); setSpeed(sp); }}
                      className={`px-3 py-1 rounded-lg text-xs font-black border transition-colors ${
                        previewSpeed === sp
                          ? "bg-[#14532D] text-white border-[#14532D]"
                          : "bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                      }`}
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── إعدادات الاستماع ── */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#fffbeb] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D97706] flex items-center justify-center text-white shrink-0">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-black text-[#0f2918] text-base">إعدادات الاستماع للطالب</h2>
                <p className="text-xs text-[#4b5563] mt-0.5">تحكم في ما يستطيع الطالب فعله أثناء الاستماع</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* عدد مرات الاستماع */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[#F8FAF9] border border-[#E8EDE9]">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0f2918]">عدد مرات الاستماع</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">٠ = بلا حد</p>
                </div>
                <div className="inline-flex items-center gap-3 border rounded-[12px] px-2 py-1.5 bg-white" style={{ borderColor: COLOR_CARD_BORDER }}>
                  <button
                    type="button"
                    className="w-9 h-9 rounded-xl border flex items-center justify-center font-black text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                    onClick={() => setSettings((s) => ({ ...s, maxListens: Math.max(0, s.maxListens - 1) }))}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-black text-[#0f2918] min-w-[2.5ch] text-center tabular-nums">
                    {settings.maxListens === 0 ? "∞" : settings.maxListens}
                  </span>
                  <button
                    type="button"
                    className="w-9 h-9 rounded-xl border flex items-center justify-center font-black text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                    onClick={() => setSettings((s) => ({ ...s, maxListens: Math.min(20, s.maxListens + 1) }))}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ToggleCell
                  label="تحكم السرعة"
                  hint="الطالب يختار ٠.٧٥× أو ١× أو ١.٢٥× أو ١.٥×"
                  checked={settings.allowSpeedControl}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSpeedControl: v }))}
                />
                <ToggleCell
                  label="رجوع / تقدم ١٠ ثوانٍ"
                  hint="الطالب يتنقل داخل التسجيل"
                  checked={settings.allowSeek}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSeek: v }))}
                />
                <ToggleCell
                  label="عرض النص بعد الإجابة"
                  hint="الطالب يرى النص الأصلي للمراجعة"
                  checked={settings.showTranscript}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, showTranscript: v }))}
                />
              </div>
            </div>
          </div>

          {/* ── الأسئلة ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-[#0f2918] text-lg">الأسئلة</h2>
              <span className="text-sm text-[#64748B] font-bold">{questions.length} سؤال</span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <SortableItem key={q.id} id={q.id}>
                      <div
                        className={`p-5 pt-10 sm:pr-14 sm:ps-6 cursor-pointer ${activeIndex === i ? "ring-2 ring-[#D97706]/40 rounded-[12px]" : ""}`}
                        role="presentation"
                        onClick={() => setActiveIndex(i)}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4 justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#64748B]">السؤال {i + 1}</span>
                            <QuestionTypeBadge type={q.type} />
                          </div>
                          <div className="flex items-center gap-2">
                            {/* تغيير النوع */}
                            <select
                              value={q.type}
                              onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuestionType })}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs px-2 py-1 rounded-lg border bg-white text-[#374151] focus:outline-none"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                            >
                              <option value="open">إجابة مفتوحة</option>
                              <option value="mcq">اختيار متعدد</option>
                              <option value="dictation">إملاء</option>
                            </select>
                            {questions.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                                className="text-[#64748B] hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* نص السؤال */}
                        <div className="mb-4">
                          <textarea
                            value={q.text}
                            dir="rtl"
                            onChange={(e) => updateQuestion(q.id, { text: e.target.value.slice(0, MAX_QUESTION_CHARS) })}
                            rows={2}
                            placeholder={
                              q.type === "dictation"
                                ? "مثال: اكتب ما سمعته في الجملة الأولى"
                                : q.type === "mcq"
                                ? "مثال: من هو بطل القصة؟"
                                : "مثال: ما الدرس المستفاد من القصة؟"
                            }
                            className="w-full px-4 py-3 rounded-[12px] bg-[#fdfdfd] border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#14532D]/30 resize-none text-[#111827]"
                            style={{ borderColor: COLOR_CARD_BORDER }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        {/* خيارات MCQ */}
                        {q.type === "mcq" && (
                          <div className="space-y-3 mb-4" dir="rtl">
                            <p className="text-xs font-bold text-[#64748B]">الخيارات (اضغط على الدائرة لتحديد الإجابة الصحيحة)</p>
                            {(["A", "B", "C", "D"] as const).map((letter, li) => {
                              const field = `option${letter}` as keyof QuestionItem;
                              const isCorrect = q.correctAnswer === letter;
                              return (
                                <div key={letter} className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); updateQuestion(q.id, { correctAnswer: letter }); }}
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                      isCorrect
                                        ? "bg-[#14532D] border-[#14532D] text-white"
                                        : "border-[#D1D5DB] text-[#D1D5DB] hover:border-[#14532D]"
                                    }`}
                                  >
                                    {isCorrect ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span className="text-xs font-black">{letter}</span>}
                                  </button>
                                  <input
                                    type="text"
                                    value={q[field] as string}
                                    onChange={(e) => updateQuestion(q.id, { [field]: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder={`الخيار ${letter}`}
                                    className="flex-1 px-3 py-2 rounded-[10px] border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14532D]/25"
                                    style={{ borderColor: isCorrect ? "#14532D" : COLOR_CARD_BORDER }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* إعدادات الإملاء */}
                        {q.type === "dictation" && (
                          <div className="mt-4 space-y-3 border-t border-dashed border-[#E5E7EB] pt-4" dir="rtl">
                            <p className="text-xs font-bold text-[#64748B]">إعدادات التصحيح</p>
                            <div className="grid grid-cols-2 gap-2">
                              <ToggleCell
                                label="تجاهل الحركات"
                                checked={q.grading.ignoreDiacritics}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreDiacritics: v })}
                              />
                              <ToggleCell
                                label="تجاهل التنوين"
                                checked={q.grading.ignoreTanween}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreTanween: v })}
                              />
                              <ToggleCell
                                label="تجاهل الشدة"
                                checked={q.grading.ignoreShadda}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreShadda: v })}
                              />
                              <ToggleCell
                                label="تجاهل الترقيم"
                                checked={q.grading.ignorePunctuation}
                                onCheckedChange={(v) => updateGrading(q.id, { ignorePunctuation: v })}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAF9] border border-[#E8EDE9]">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[#D97706]">{q.grading.tolerancePercent}%</span>
                                <Slider
                                  value={[q.grading.tolerancePercent]}
                                  onValueChange={([v]) => updateGrading(q.id, { tolerancePercent: v ?? 0 })}
                                  max={30}
                                  step={1}
                                  className="w-28"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <p className="text-xs font-bold text-[#0f2918] text-right">نسبة التسامح</p>
                            </div>
                          </div>
                        )}

                        {/* الدرجة */}
                        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
                          <span className="text-xs font-bold text-[#64748B]">الدرجة</span>
                          <div className="inline-flex items-center gap-2 border rounded-[10px] px-2 py-1 bg-white" style={{ borderColor: COLOR_CARD_BORDER }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateQuestion(q.id, { points: Math.max(1, q.points - 1) }); }}
                              className="w-7 h-7 rounded-lg border flex items-center justify-center text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-black text-[#0f2918] min-w-[1.5ch] text-center">{q.points}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); updateQuestion(q.id, { points: Math.min(20, q.points + 1) }); }}
                              className="w-7 h-7 rounded-lg border flex items-center justify-center text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* أزرار إضافة سؤال */}
            <div className="mt-5 flex flex-wrap gap-3 justify-center">
              {(["open", "mcq", "dictation"] as QuestionType[]).map((type) => {
                const labels: Record<QuestionType, string> = {
                  open: "+ إجابة مفتوحة",
                  mcq: "+ اختيار متعدد",
                  dictation: "+ إملاء",
                };
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addQuestion(type)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] border-2 border-dashed text-sm font-black text-[#14532D] border-[#14532D]/40 hover:bg-[#ecfdf5] transition-colors"
                  >
                    {labels[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STEP 3 — النشر
      ══════════════════════════════════════════ */}
      {step === 3 && (
        <div className="max-w-3xl mx-auto px-4 pt-8 space-y-5">
          <h2 className="text-xl font-black text-[#0f2918] text-right">إعدادات النشر</h2>

          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: COLOR_CARD_BORDER }}>
            <div className="p-5 space-y-4">
              {/* ملخص */}
              <div className="p-4 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] text-right space-y-2">
                <p className="font-black text-[#0f2918]">{title}</p>
                <p className="text-sm text-[#4b5563]">
                  {questions.length} سؤال · {audioText.length} حرف في النص الصوتي
                </p>
                <p className="text-xs text-[#64748B]">
                  مرات الاستماع: {settings.maxListens === 0 ? "بلا حد" : settings.maxListens} ·
                  تحكم السرعة: {settings.allowSpeedControl ? "✓" : "✗"} ·
                  رجوع/تقدم: {settings.allowSeek ? "✓" : "✗"} ·
                  عرض النص بعد الإجابة: {settings.showTranscript ? "✓" : "✗"}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAF9] border border-[#E8EDE9]">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0f2918]">مشاركة في المكتبة العامة</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">يستطيع المعلمون الآخرون استخدام هذا النشاط</p>
                </div>
                <Switch
                  checked={isShared}
                  onCheckedChange={setIsShared}
                  className="data-[state=checked]:bg-[#14532D]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#F8FAF9] border border-[#E8EDE9]">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#0f2918]">وضع الوصول</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">عام = أي طالب بالرابط · خاص = طلابك فقط</p>
                </div>
                <select
                  value={accessMode}
                  onChange={(e) => setAccessMode(e.target.value as "public" | "private")}
                  className="px-3 py-2 rounded-[10px] border text-sm bg-white focus:outline-none"
                  style={{ borderColor: COLOR_CARD_BORDER }}
                >
                  <option value="public">عام</option>
                  <option value="private">خاص</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 border-t border-[#E5E7EB] bg-white/95 backdrop-blur-sm"
        dir="rtl"
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={footerBack}
            className="flex items-center gap-2 px-5 py-3 rounded-[12px] border-2 border-[#E5E7EB] text-[#374151] font-black text-sm hover:bg-[#F9FAFB] transition-colors"
          >
            <ChevronRight className="w-4 h-4" /> رجوع
          </button>
          <button
            type="button"
            onClick={footerPrimaryAction}
            disabled={createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[12px] font-black text-sm text-white shadow-sm transition-colors disabled:opacity-50"
            style={{ backgroundColor: COLOR_PRIMARY }}
          >
            {step === 3 ? (
              createMutation.isPending ? "جارٍ النشر..." : "نشر النشاط"
            ) : (
              <>
                التالي <ChevronLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
