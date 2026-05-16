import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Plus,
  Trash2,
  GripVertical,
  Volume2,
  Square,
  Mic,
  Pencil,
  Check,
  Minus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Headphones,
  ListChecks,
  AlignLeft,
  Settings2,
  MoreVertical,
  Gauge,
  Save,
  Globe,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** منصة حصاد — أخضر غامق */
const BRAND = "#1E4D35";
const BRAND_MID = "#225739";
const PAGE_BG = "linear-gradient(to bottom, #f8faf8, #f3f7f4)";
const CARD_BORDER = "rgba(30, 77, 53, 0.08)";
const CARD_SHADOW = "0 1px 2px rgba(15, 40, 28, 0.04), 0 8px 24px rgba(15, 40, 28, 0.06)";
const DRAFT_KEY = "hasad-listening-wizard-draft-v1";

const TRANSITION = "transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";

/** أسماء متوافقة مع بقية الملف أثناء استبدال الواجهة */
const COLOR_CARD_BORDER = "rgba(30, 77, 53, 0.1)";
const COLOR_PRIMARY = BRAND;

const MAX_CHARS = 5000;
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

type QuestionType = "dictation" | "mcq" | "open" | "true_false";

interface QuestionItem {
  id: string;
  type: QuestionType;
  text: string; // question prompt
  // MCQ
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string; // mcq: A/B/C/D · true_false: "true"/"false" · open/dictation: free text
  // Dictation grading
  grading: GradingOpts;
  points: number;
  serverId?: number;
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
  showTranscript: false,
};

const defaultCorrectFor = (type: QuestionType): string => {
  if (type === "mcq") return "A";
  if (type === "true_false") return "true";
  return "";
};

const newQuestion = (type: QuestionType = "open"): QuestionItem => ({
  id: crypto.randomUUID(),
  type,
  text: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: defaultCorrectFor(type),
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

const SPEED_PRESETS = [0.75, 0.85, 0.9, 1, 1.1, 1.25] as const;

const LISTEN_SEGMENTS: { label: string; value: number }[] = [
  { label: "مرة واحدة", value: 1 },
  { label: "مرتان", value: 2 },
  { label: "3 مرات", value: 3 },
  { label: "غير محدود", value: 0 },
];

function speedLabelAr(v: number): string {
  if (v <= 0.76) return "بطيء جداً ٠.٧٥×";
  if (v <= 0.88) return "بطيء ٠.٨٥×";
  if (v <= 1.0) return "عادي ١×";
  if (v <= 1.13) return "سريع ١.١×";
  return "سريع جداً ١.٢٥×";
}

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "٠:٠٠";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function estimateReadSeconds(text: string, speed: number): number {
  const len = text.trim().length;
  if (!len || speed <= 0) return 0;
  const cps = 11;
  return Math.round(len / cps / speed);
}

// ===================== Hooks =====================

function useTtsPreview() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolumeState] = useState(1);
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
    setCurrentSec(0);
    setDurationSec(0);
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

  const setVolume = useCallback((v: number) => {
    const nv = Math.min(1, Math.max(0, v));
    setVolumeState(nv);
    if (audioRef.current) audioRef.current.volume = nv;
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
        audio.volume = volume;
        audioRef.current = audio;
        audio.onloadedmetadata = () => {
          setDurationSec(audio.duration || 0);
        };
        intervalRef.current = setInterval(() => {
          if (audio.duration) {
            setProgress((audio.currentTime / audio.duration) * 100);
            setCurrentSec(audio.currentTime);
            setDurationSec(audio.duration);
          }
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
    [speakingId, stopAudio, volume],
  );

  return { speakingId, progress, currentSec, durationSec, volume, play, stopAudio, seek, setSpeed, setVolume };
}

// ===================== Sub-components =====================

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-[24px] bg-white border min-w-0",
        TRANSITION,
        isDragging ? "ring-2 ring-[#1E4D35]/15 shadow-lg z-10 scale-[1.01]" : "shadow-sm",
      )}
      style={{
        borderColor: CARD_BORDER,
        boxShadow: isDragging ? undefined : CARD_SHADOW,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.95 : 1,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-4 end-3 z-10 cursor-grab active:cursor-grabbing p-2 rounded-xl text-[#64748B] hover:bg-[#f3f7f4]"
        aria-label="إعادة ترتيب"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      {children}
    </div>
  );
}

function ToggleCell({
  icon,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-[24px] bg-[#fafdfb] border min-h-[88px]",
        TRANSITION,
        "hover:border-[#1E4D35]/12",
      )}
      style={{ borderColor: CARD_BORDER }}
    >
      <span className="shrink-0 w-10 h-10 rounded-2xl bg-white border flex items-center justify-center text-[#1E4D35]" style={{ borderColor: CARD_BORDER }}>
        {icon}
      </span>
      <div dir="rtl" className="min-w-0 flex-1 text-right space-y-1">
        <p className="text-sm font-bold text-[#0f2918] leading-snug">{label}</p>
        {hint && <p className="text-[11px] text-[#64748B] leading-relaxed">{hint}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 mt-1 data-[state=checked]:bg-[#1E4D35]"
      />
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const map: Record<QuestionType, { label: string; className: string; icon: React.ReactNode }> = {
    mcq: { label: "اختيار متعدد", className: "bg-sky-50/90 text-sky-800 border-sky-100", icon: <ListChecks className="w-3.5 h-3.5" /> },
    dictation: { label: "إملاء", className: "bg-amber-50/90 text-amber-900 border-amber-100", icon: <Mic className="w-3.5 h-3.5" /> },
    open: { label: "إجابة مفتوحة", className: "bg-[#eef5f0] text-[#1E4D35] border-[#dce8e0]", icon: <AlignLeft className="w-3.5 h-3.5" /> },
    true_false: { label: "صح / خطأ", className: "bg-emerald-50/90 text-emerald-900 border-emerald-100", icon: <Check className="w-3.5 h-3.5" /> },
  };
  const { label, className, icon } = map[type];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border", className)}>
      {icon} {label}
    </span>
  );
}

// ===================== Main Component =====================

export default function DictationCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // ?edit=<assignmentId> — when set we hydrate state from the API and PUT on save.
  const editId = (() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search).get("edit");
    const n = p ? parseInt(p, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const isEditing = editId !== null;
  const [hydrated, setHydrated] = useState(!isEditing);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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

  useEffect(() => {
    if (!isEditing || hydrated) return;
    let cancelled = false;
    type RemoteQuestion = {
      id?: number;
      text?: string;
      questionType?: string;
      optionA?: string | null;
      optionB?: string | null;
      optionC?: string | null;
      optionD?: string | null;
      correctAnswer?: string | null;
      points?: number;
    };
    type RemoteAssignment = {
      title?: string;
      targetClass?: string | null;
      targetClasses?: string[] | null;
      listeningAudioText?: string | null;
      listeningVoice?: string | null;
      listeningSpeed?: string | null;
      listeningSettings?: Partial<ListeningSettings> | null;
      isShared?: boolean;
      accessMode?: string;
      questions?: RemoteQuestion[];
    };
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/assignments/${editId}`, { credentials: "include" });
        if (!res.ok) throw new Error("fetch failed");
        const a = (await res.json()) as RemoteAssignment;
        if (cancelled) return;
        setTitle(a.title || "");
        const tc: string[] = Array.isArray(a.targetClasses) && a.targetClasses.length > 0
          ? a.targetClasses
          : (a.targetClass ? [a.targetClass] : []);
        setTargetClasses(tc);
        setAudioText(a.listeningAudioText || "");
        setAudioVoice(a.listeningVoice || "shimmer");
        const sp = parseFloat(a.listeningSpeed || "0.9");
        setAudioSpeed(Number.isFinite(sp) ? sp : 0.9);
        if (a.listeningSettings && typeof a.listeningSettings === "object") {
          const merged = { ...DEFAULT_SETTINGS, ...a.listeningSettings };
          const ml = typeof merged.maxListens === "number" ? merged.maxListens : DEFAULT_SETTINGS.maxListens;
          merged.maxListens = [0, 1, 2, 3].includes(ml) ? ml : ml > 3 ? 3 : ml < 0 ? 0 : 1;
          setSettings(merged);
        }
        setIsShared(!!a.isShared);
        setAccessMode(a.accessMode === "private" ? "private" : "public");
        const qs: QuestionItem[] = (a.questions || []).map((q) => {
          const t = (q.questionType || "open") as QuestionType;
          let grading = { ...DEFAULT_GRADING };
          if (t === "dictation" && q.optionD) {
            try {
              const parsed = JSON.parse(q.optionD);
              grading = {
                ignoreDiacritics: parsed.ignoreDiacritics ?? grading.ignoreDiacritics,
                ignoreTanween: parsed.ignoreTanween ?? grading.ignoreTanween,
                ignoreShadda: parsed.ignoreShadda ?? grading.ignoreShadda,
                ignorePunctuation: parsed.ignorePunctuation ?? grading.ignorePunctuation,
                allowErrors: q.optionC === "true",
                tolerancePercent: parsed.tolerancePercent ?? grading.tolerancePercent,
              };
            } catch { /* keep defaults */ }
          }
          return {
            id: crypto.randomUUID(),
            serverId: q.id,
            type: t,
            text: q.text || "",
            optionA: t === "mcq" ? (q.optionA || "") : "",
            optionB: t === "mcq" ? (q.optionB || "") : "",
            optionC: t === "mcq" ? (q.optionC || "") : "",
            optionD: t === "mcq" ? (q.optionD || "") : "",
            correctAnswer: q.correctAnswer || (t === "mcq" ? "A" : t === "true_false" ? "true" : ""),
            grading,
            points: q.points || 1,
          };
        });
        setQuestions(qs.length > 0 ? qs : [newQuestion("open")]);
        setHydrated(true);
      } catch {
        toast.error("تعذّر تحميل الواجب للتعديل");
        setLocation("/teacher");
      }
    })();
    return () => { cancelled = true; };
  }, [editId, isEditing, hydrated, setLocation]);

  const {
    speakingId,
    progress,
    currentSec,
    durationSec,
    volume,
    play: previewTts,
    seek,
    setSpeed,
    setVolume,
  } = useTtsPreview();

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
      const url = isEditing
        ? `${API_BASE}/api/assignments/${editId}`
        : `${API_BASE}/api/assignments`;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "خطأ في الحفظ");
      const id: number = isEditing ? Number(editId) : Number(data.id);
      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}`] });
      toast.success(isEditing ? "تم تحديث نشاط الاستماع بنجاح" : "تم نشر نشاط الاستماع بنجاح 🎉");
      setLocation(`/teacher/assignment/${id}`);
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
    if (!validateStep1() || !validateStep2()) return;
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
      listeningSpeed: String(audioSpeed),
      listeningSettings: settings,
      questions: questions.map((q, i) => ({
        ...(q.serverId ? { id: q.serverId } : {}),
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
        correctAnswer: q.type === "mcq"
          ? q.correctAnswer
          : q.type === "true_false"
          ? (q.correctAnswer === "false" ? "false" : "true")
          : (q.correctAnswer || "").trim(),
        points: q.points,
        order: i + 1,
      })),
    });
  };

  const applyQuestionType = (q: QuestionItem, newType: QuestionType) => {
    const patch: Partial<QuestionItem> = { type: newType };
    if (newType === "true_false") patch.correctAnswer = q.correctAnswer === "false" ? "false" : "true";
    else if (newType === "mcq") patch.correctAnswer = ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A";
    else patch.correctAnswer = "";
    updateQuestion(q.id, patch);
  };

  const saveDraftLocal = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          step,
          title,
          targetClasses,
          audioText,
          audioVoice,
          audioSpeed,
          previewSpeed,
          questions,
          settings,
          isShared,
          accessMode,
        }),
      );
      toast.success("تم حفظ المسودة في هذا المتصفح");
    } catch {
      toast.error("تعذّر حفظ المسودة");
    }
  };

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const STEPS_META = [
    { num: 1 as const, label: "الأساسيات" },
    { num: 2 as const, label: "المحتوى والأسئلة" },
    { num: 3 as const, label: "إعدادات النشر" },
    { num: 4 as const, label: "مراجعة" },
  ];

  const footerBack = () => {
    if (step === 1) setLocation("/teacher/new");
    else setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  const goNextStep = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const footerPrimaryAction = () => {
    if (step === 4) handleSubmitPublish();
    else goNextStep();
  };

  const isAudioPlaying = speakingId === "main-audio";

  const selectUiClass =
    "w-full h-12 px-3 rounded-2xl bg-white border text-sm font-semibold text-[#0f2918] appearance-none focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/20 focus:border-[#1E4D35]/25 " +
    TRANSITION;

  const approxDurationSec = estimateReadSeconds(audioText, audioSpeed);

  const primaryClassLabel =
    targetClasses.length === 0 ? "بدون صف" : targetClasses.join("، ");

  const waveformBars = [4, 7, 5, 9, 6, 11, 8, 5, 10, 6, 8, 4, 9, 7, 6];

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden pb-[calc(6rem+env(safe-area-inset-bottom))]"
      style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
      dir="rtl"
    >
      <header
        className={cn("sticky top-0 z-40 border-b bg-[#fcfdfc]/90 backdrop-blur-xl", TRANSITION)}
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={footerBack}
            className={cn(
              "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl border bg-white text-[#1E4D35] hover:bg-[#f3f7f4]",
              TRANSITION,
            )}
            style={{ borderColor: CARD_BORDER }}
            aria-label="رجوع"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <nav
            className="flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-center sm:overflow-visible [-webkit-overflow-scrolling:touch]"
            aria-label="خطوات المعالج"
          >
            {STEPS_META.map((st, idx) => {
              const done = step > st.num;
              const current = step === st.num;
              const canJump = st.num < step;
              return (
                <div key={st.num} className="flex shrink-0 items-center">
                  {idx > 0 && (
                    <span
                      className={cn(
                        "mx-1 hidden text-[10px] font-bold sm:inline",
                        done ? "text-[#1E4D35]/35" : "text-[#1E4D35]/15",
                      )}
                    >
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!canJump && !current}
                    onClick={() => {
                      if (canJump) setStep(st.num);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold sm:text-xs",
                      TRANSITION,
                      current && "bg-[#1E4D35] text-white shadow-sm shadow-[#1E4D35]/15",
                      done && !current && "bg-[#eef5f0] text-[#1E4D35]",
                      !done && !current && "bg-transparent text-[#94a3ab]",
                      canJump && "cursor-pointer hover:bg-[#eef5f0]",
                    )}
                  >
                    <span className="tabular-nums">{st.num}</span>
                    <span className="max-w-[88px] truncate sm:max-w-none">{st.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="hidden w-11 shrink-0 sm:block" aria-hidden />
        </div>
      </header>

      {step === 1 && (
        <main className="mx-auto max-w-[1100px] space-y-7 px-4 py-7 sm:py-8">
          <section
            className={cn("rounded-[24px] border bg-white p-6 sm:p-8", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-[#f3f7f4] text-[#1E4D35]"
                  style={{ borderColor: CARD_BORDER }}
                >
                  <Headphones className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-right">
                  <h1 className="text-xl font-black leading-tight text-[#0f2918] sm:text-2xl">أساسيات نشاط الاستماع</h1>
                  <p className="text-sm leading-relaxed text-[#64748B]">ابدأ بتسمية النشاط وتحديد الصف عند الحاجة.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2 text-right">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#0f2918]" htmlFor="listening-title">
                    عنوان النشاط <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold tabular-nums text-[#94a3b8]">{title.length} / 120</span>
                </div>
                <input
                  id="listening-title"
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: قصة قصيرة — فهم المسموع والاستنتاج"
                  dir="auto"
                  className={cn(
                    "min-h-[52px] w-full rounded-2xl border bg-white px-4 py-3 text-base font-semibold text-[#111827] placeholder:text-[#94a3b8] focus:border-[#1E4D35]/30 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/15",
                    TRANSITION,
                  )}
                  style={{ borderColor: COLOR_CARD_BORDER }}
                />
              </div>

              <div className="text-right">
                <div
                  className={cn("rounded-[24px] border bg-[#fafdfb] p-5 sm:p-6", TRANSITION)}
                  style={{ borderColor: CARD_BORDER }}
                >
                  <div className="mb-4 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#94a3b8]">الصف الدراسي</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-[#0f2918]">{primaryClassLabel}</span>
                      {targetClasses.length > 0 && (
                        <Check className="h-4 w-4 text-[#1E4D35]" strokeWidth={3} aria-hidden />
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#64748B]">
                      {targetClasses.length === 0
                        ? "سيكون النشاط متاحاً بدون ربطه بصف محدد."
                        : "النشاط مرتبط بالصفوف التي اخترتها أدناه."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-sm font-bold text-[#1E4D35] hover:bg-[#f3f7f4]",
                            TRANSITION,
                          )}
                          style={{ borderColor: CARD_BORDER }}
                        >
                          {targetClasses.length === 0 ? "اختيار صف" : "تغيير"}
                          <ChevronDown className="h-4 w-4 opacity-60" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(100vw-2rem,320px)] rounded-2xl border p-2 shadow-lg" align="end" dir="rtl">
                        <p className="mb-2 px-2 text-[11px] font-bold text-[#94a3b8]">صفوفك المحفوظة</p>
                        <div className="max-h-[240px] overflow-y-auto">
                          {gradeLevels.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-[#64748B]">لا توجد صفوف محفوظة</p>
                          ) : (
                            gradeLevels.map((g) => {
                              const selected = targetClasses.includes(g.gradeLevel);
                              return (
                                <button
                                  key={g.gradeLevel}
                                  type="button"
                                  onClick={() => {
                                    setTargetClasses((prev) =>
                                      prev.includes(g.gradeLevel)
                                        ? prev.filter((x) => x !== g.gradeLevel)
                                        : [...prev, g.gradeLevel],
                                    );
                                  }}
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm font-bold transition-colors hover:bg-[#f3f7f4]",
                                    selected && "bg-[#eef5f0] text-[#1E4D35]",
                                  )}
                                >
                                  <span className="truncate">
                                    {g.gradeLevel}{" "}
                                    <span className="text-[11px] font-semibold text-[#94a3b8]">({g.count})</span>
                                  </span>
                                  {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {targetClasses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTargetClasses([])}
                        className="min-h-[44px] rounded-2xl px-3 text-sm font-bold text-[#64748B] underline-offset-4 hover:text-[#1E4D35] hover:underline"
                      >
                        إزالة الصف
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ══════════════════════════════════════════
          STEP 2 — المحتوى
      ══════════════════════════════════════════ */}
      {step === 2 && (
        <main className="mx-auto max-w-[1100px] space-y-7 px-4 py-7 sm:py-8">
          <section
            className={cn("rounded-[24px] border bg-white overflow-hidden", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="flex flex-col gap-2 border-b px-6 py-5 text-right sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: CARD_BORDER, background: "linear-gradient(180deg, #fafdfb 0%, #fff 100%)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E4D35] text-white shadow-sm shadow-[#1E4D35]/20">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0f2918]">النص الصوتي الرئيسي</h2>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#64748B]">اكتب النص الذي سيُقرَأ للطلاب بصوت واضح ومريح.</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2 text-right">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#0f2918]">نص التسجيل</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#94a3ab]">{audioText.length} / {MAX_CHARS}</span>
                </div>
                <textarea
                  value={audioText}
                  dir="rtl"
                  onChange={(e) => setAudioText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={`اكتب نصاً كاملاً للاستماع — قصة، حوار، أو تعليمات.\n\nمثال: كان يا ما كان في قديم الزمان قصةً علّمتنا الصبر والتفكير الناضج...`}
                  className={cn(
                    "min-h-[220px] w-full resize-y rounded-2xl border bg-[#fcfdfc] px-4 py-4 text-base leading-[1.75] text-[#111827] placeholder:text-[#94a3ab] focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/12",
                    TRANSITION,
                  )}
                  style={{ borderColor: COLOR_CARD_BORDER }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-[#64748B]">الصوت</label>
                  <div className="relative">
                    <select
                      value={audioVoice}
                      onChange={(e) => setAudioVoice(e.target.value)}
                      className={cn(selectUiClass, "px-4 pe-10")}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                    >
                      {VOICES.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-[#64748B]">سرعة القراءة (عند الإنشاء)</label>
                  <div className="relative">
                    <select
                      value={String(audioSpeed)}
                      onChange={(e) => setAudioSpeed(Number(e.target.value))}
                      className={cn(selectUiClass, "px-4 pe-10")}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                    >
                      {SPEED_PRESETS.map((sp) => (
                        <option key={sp} value={sp}>{speedLabelAr(sp)}</option>
                      ))}
                    </select>
                    <Gauge className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-[#64748B]">مدة القراءة التقريبية</label>
                  <div
                    className="flex h-12 items-center justify-between rounded-2xl border bg-[#f9faf9] px-4 text-sm font-bold text-[#374151]"
                    style={{ borderColor: COLOR_CARD_BORDER }}
                  >
                    <span className="tabular-nums">
                      {approxDurationSec < 60
                        ? `≈ ${approxDurationSec} ث`
                        : `≈ ${Math.floor(approxDurationSec / 60)} د ${approxDurationSec % 60} ث`}
                    </span>
                    <span className="text-[11px] font-semibold text-[#94a3ab]">وفق طول النص</span>
                  </div>
                </div>
              </div>

              <div
                className={cn("rounded-[24px] border bg-[#fafdfb] p-4 sm:p-5", TRANSITION)}
                style={{ borderColor: CARD_BORDER }}
              >
                <p className="mb-4 text-right text-xs font-bold text-[#64748B]">معاينة الصوت</p>

                <div className="mb-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!audioText.trim()}
                    onClick={() => previewTts("main-audio", audioText, audioSpeed, audioVoice)}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md",
                      TRANSITION,
                      "hover:opacity-95 active:scale-[0.98]",
                      isAudioPlaying ? "bg-red-500" : "bg-[#1E4D35]",
                    )}
                  >
                    {isAudioPlaying ? <Square className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <div className="relative min-h-[44px] min-w-0 flex-1">
                    <div className="flex h-10 items-end justify-between gap-px opacity-90">
                      {waveformBars.map((h, wi) => (
                        <div
                          key={wi}
                          className="w-[5px] rounded-full bg-[#dce8e0]"
                          style={{
                            height: `${h}px`,
                            opacity: isAudioPlaying && progress > (wi / waveformBars.length) * 100 ? 1 : 0.35,
                            backgroundColor: isAudioPlaying && progress > (wi / waveformBars.length) * 100 ? BRAND : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-full bg-[#e8ece9]">
                      <div
                        className={cn("h-full rounded-full bg-[#1E4D35]", TRANSITION)}
                        style={{ width: `${isAudioPlaying ? progress : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-left text-[11px] font-bold tabular-nums text-[#64748B]">
                    <div>{formatAudioTime(currentSec)}</div>
                    <div className="text-[#94a3ab]">{formatAudioTime(durationSec)}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: CARD_BORDER }}>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => seek(-10)}
                      disabled={!isAudioPlaying}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border bg-white text-[#1E4D35] disabled:opacity-30"
                      style={{ borderColor: COLOR_CARD_BORDER }}
                      title="رجوع ١٠ ثوانٍ"
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => seek(10)}
                      disabled={!isAudioPlaying}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border bg-white text-[#1E4D35] disabled:opacity-30"
                      style={{ borderColor: COLOR_CARD_BORDER }}
                      title="تقدم ١٠ ثوانٍ"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xs">
                    <label className="text-[11px] font-bold text-[#64748B] text-right">مستوى الصوت</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer accent-[#1E4D35]"
                    />
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {([0.75, 1, 1.25, 1.5] as const).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => {
                          setPreviewSpeed(sp);
                          setSpeed(sp);
                        }}
                        className={cn(
                          "min-h-[36px] rounded-full px-3 text-xs font-black",
                          TRANSITION,
                          previewSpeed === sp
                            ? "bg-[#1E4D35] text-white shadow-sm"
                            : "border bg-white text-[#374151] hover:bg-[#f3f7f4]",
                        )}
                        style={previewSpeed === sp ? undefined : { borderColor: COLOR_CARD_BORDER }}
                      >
                        ×{sp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={cn("rounded-[24px] border bg-white p-6 sm:p-8", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="mb-6 text-right">
              <h2 className="text-lg font-black text-[#0f2918]">إعدادات الاستماع للطالب</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">تحكم مختصر في تجربة الطالب أثناء الاستماع.</p>
            </div>

            <div className="mb-8 space-y-3 text-right">
              <p className="text-xs font-bold text-[#64748B]">عدد مرات الاستماع</p>
              <div className="flex flex-wrap gap-1 rounded-2xl border bg-[#fafdfb] p-1" style={{ borderColor: CARD_BORDER }}>
                {LISTEN_SEGMENTS.map((seg) => {
                  const active = settings.maxListens === seg.value;
                  return (
                    <button
                      key={seg.value}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, maxListens: seg.value }))}
                      className={cn(
                        "min-h-[44px] flex-1 rounded-xl px-2 text-[11px] font-black sm:text-xs",
                        TRANSITION,
                        active ? "bg-[#1E4D35] text-white shadow-sm" : "text-[#475569] hover:bg-white",
                      )}
                    >
                      {seg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ToggleCell
                icon={<Gauge className="h-4 w-4" />}
                label="التحكم بالسرعة"
                hint="الطالب يغيّر سرعة التشغيل أثناء الاستماع."
                checked={settings.allowSpeedControl}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSpeedControl: v }))}
              />
              <ToggleCell
                icon={<SkipForward className="h-4 w-4" />}
                label="الرجوع والتقديم"
                hint="تخطّي ±١٠ ثانية داخل التسجيل."
                checked={settings.allowSeek}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSeek: v }))}
              />
              <ToggleCell
                icon={<AlignLeft className="h-4 w-4" />}
                label="عرض النص بعد الإجابة"
                hint="إظهار النص الكامل للمراجعة بعد التسليم عندما يُسمح بذلك."
                checked={settings.showTranscript}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, showTranscript: v }))}
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-3 text-right sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#0f2918]">الأسئلة</h2>
                <p className="text-[12px] text-[#94a3ab]">اسحب المقبض لإعادة ترتيب الأسئلة.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-xs font-black text-[#1E4D35]">{questions.length} أسئلة</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex min-h-[44px] items-center gap-2 rounded-2xl border bg-white px-4 text-sm font-black text-[#1E4D35] hover:bg-[#f3f7f4]",
                        TRANSITION,
                      )}
                      style={{ borderColor: CARD_BORDER }}
                    >
                      <Plus className="h-4 w-4" />
                      إضافة سؤال
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52 rounded-2xl border p-1 shadow-lg" align="end" dir="rtl">
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("open")}>
                      إجابة مفتوحة
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("mcq")}>
                      اختيار متعدد
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("true_false")}>
                      صح وخطأ
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("dictation")}>
                      إملاء
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-5">
                  {questions.map((q, i) => (
                    <SortableItem key={q.id} id={q.id}>
                      <div
                        className={cn(
                          "cursor-pointer rounded-[24px] pt-12 sm:ps-6 sm:pe-5 sm:pb-6",
                          activeIndex === i && "ring-2 ring-[#1E4D35]/12",
                        )}
                        role="presentation"
                        onClick={() => setActiveIndex(i)}
                      >
                        <div className="mb-5 flex flex-col gap-3 border-b px-5 pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: CARD_BORDER }}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#f3f7f4] px-2.5 py-1 text-[11px] font-black text-[#1E4D35]">
                              سؤال {i + 1}
                            </span>
                            <QuestionTypeBadge type={q.type} />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border bg-white text-[#64748B] hover:bg-[#fafdfb]"
                                style={{ borderColor: COLOR_CARD_BORDER }}
                                aria-label="خيارات السؤال"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 rounded-2xl border p-1 shadow-lg" align="end" dir="rtl">
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "open")}>
                                تحويل إلى مفتوحة
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "mcq")}>
                                تحويل إلى متعدد
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "true_false")}>
                                تحويل إلى صح/خطأ
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "dictation")}>
                                تحويل إلى إملاء
                              </DropdownMenuItem>
                              {questions.length > 1 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="rounded-xl font-bold text-red-600 focus:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteQuestion(q.id);
                                    }}
                                  >
                                    حذف السؤال
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="space-y-5 px-5 pb-6">
                          <div className="space-y-2 text-right">
                            <label className="text-xs font-bold text-[#64748B]">صياغة السؤال</label>
                            <textarea
                              value={q.text}
                              dir="rtl"
                              onChange={(e) => updateQuestion(q.id, { text: e.target.value.slice(0, MAX_QUESTION_CHARS) })}
                              rows={3}
                              placeholder={
                                q.type === "dictation"
                                  ? "مثال: اكتب الجملة التي سمعتها بحرفية..."
                                  : q.type === "mcq"
                                    ? "مثال: ما الموضوع الرئيسي في المقطع؟"
                                    : "صِغ سؤالاً يقيّم فهماً صوتياً أو استنتاجاً من النص."
                              }
                              className="min-h-[100px] w-full resize-y rounded-2xl border bg-[#fcfdfc] px-4 py-3 text-sm leading-relaxed text-[#111827] placeholder:text-[#94a3ab] focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/10"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-[11px] tabular-nums text-[#94a3ab]">{q.text.length} / {MAX_QUESTION_CHARS}</p>
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

                        {/* صح / خطأ — اختيار الإجابة الصحيحة */}
                        {q.type === "true_false" && (
                          <div className="mb-4 grid grid-cols-2 gap-3" dir="rtl">
                            {[
                              { value: "true", label: "صح", icon: "✓" },
                              { value: "false", label: "خطأ", icon: "✗" },
                            ].map((opt) => {
                              const isCorrect = q.correctAnswer === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateQuestion(q.id, { correctAnswer: opt.value }); }}
                                  className={`py-3 rounded-xl border-2 font-black text-sm flex flex-col items-center gap-1 transition-colors ${
                                    isCorrect
                                      ? "border-[#14532D] bg-[#ecfdf5] text-[#14532D]"
                                      : "border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#14532D]/40"
                                  }`}
                                >
                                  <span className="text-xl">{opt.icon}</span>
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                            <p className="col-span-2 text-[11px] text-[#64748B] text-right">حدد الإجابة الصحيحة التي ستُستخدم في التصحيح التلقائي.</p>
                          </div>
                        )}

                        {/* إجابة نموذجية — Accordion */}
                        {(q.type === "open" || q.type === "dictation") && (
                          <Collapsible className="rounded-2xl border bg-[#fafdfb]" style={{ borderColor: CARD_BORDER }}>
                            <CollapsibleTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="flex w-full min-h-[48px] items-center justify-between gap-2 rounded-2xl px-4 py-3 text-right text-sm font-black text-[#1E4D35] hover:bg-[#f3f7f4] data-[state=open]:rounded-b-none data-[state=open]:[&_.chev-icon]:rotate-180"
                            >
                              إجابة نموذجية (اختياري)
                              <ChevronDown className="chev-icon h-4 w-4 shrink-0 opacity-60 transition-transform duration-200" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t px-4 pb-4 pt-2" style={{ borderColor: CARD_BORDER }}>
                              <textarea
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                rows={3}
                                placeholder={
                                  q.type === "dictation"
                                    ? "النص الصحيح المتوقع كما سيُصحَّح ضده الإملاء…"
                                    : "مرجع سريع للمعلم أثناء المراجعة — لا يُعرض للطالب تلقائياً."
                                }
                                className="w-full resize-y rounded-xl border bg-white px-3 py-3 text-sm leading-relaxed text-[#111827] focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/10"
                                style={{ borderColor: COLOR_CARD_BORDER }}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* إعدادات الإملاء */}
                        {q.type === "dictation" && (
                          <div className="mt-4 space-y-3 border-t border-dashed border-[#E5E7EB] pt-4" dir="rtl">
                            <p className="text-xs font-bold text-[#64748B]">إعدادات التصحيح</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <ToggleCell
                                icon={<Pencil className="h-4 w-4" />}
                                label="تجاهل الحركات"
                                checked={q.grading.ignoreDiacritics}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreDiacritics: v })}
                              />
                              <ToggleCell
                                icon={<Minus className="h-4 w-4" />}
                                label="تجاهل التنوين"
                                checked={q.grading.ignoreTanween}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreTanween: v })}
                              />
                              <ToggleCell
                                icon={<Mic className="h-4 w-4" />}
                                label="تجاهل الشدة"
                                checked={q.grading.ignoreShadda}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreShadda: v })}
                              />
                              <ToggleCell
                                icon={<AlignLeft className="h-4 w-4" />}
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
                        <div className="flex items-center justify-between gap-3 border-t border-dashed pt-4" style={{ borderColor: CARD_BORDER }}>
                          <span className="text-xs font-bold text-[#64748B]">الدرجة</span>
                          <div className="inline-flex items-center gap-1 rounded-2xl border bg-white p-1" style={{ borderColor: COLOR_CARD_BORDER }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuestion(q.id, { points: Math.max(1, q.points - 1) });
                              }}
                              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border text-[#1E4D35] hover:bg-[#f3f7f4]"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="min-w-[2ch] text-center text-base font-black tabular-nums text-[#0f2918]">{q.points}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuestion(q.id, { points: Math.min(20, q.points + 1) });
                              }}
                              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border text-[#1E4D35] hover:bg-[#f3f7f4]"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        </div>
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </main>
      )}

      {step === 3 && (
        <main className="mx-auto max-w-[1100px] space-y-7 px-4 py-7 sm:py-8">
          <div className="text-right space-y-2">
            <h2 className="text-xl font-black text-[#0f2918] sm:text-2xl">إعدادات النشر</h2>
            <p className="text-sm leading-relaxed text-[#64748B]">حدد طريقة وصول الطلاب إلى النشاط ومشاركته مع المعلمين.</p>
          </div>

          <section
            className={cn("rounded-[24px] border bg-white p-6 sm:p-8", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="mb-6 rounded-[20px] border bg-[#fafdfb] p-5 text-right space-y-3" style={{ borderColor: CARD_BORDER }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-black text-[#0f2918]">{title.trim() || "بدون عنوان"}</p>
                <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-[11px] font-black text-[#1E4D35]">مسودة</span>
              </div>
              <p className="text-sm text-[#64748B]">
                {questions.length} سؤال · {totalPoints} درجة · {audioText.length.toLocaleString("ar-SA")} حرف صوتي
              </p>
              <p className="text-[12px] leading-relaxed text-[#64748B]">
                الصف: {primaryClassLabel} · الاستماع:{" "}
                {settings.maxListens === 0 ? "غير محدود" : `${settings.maxListens} مرات`} · سرعة:{" "}
                {settings.allowSpeedControl ? "مسموح" : "مغلق"} · تخطي: {settings.allowSeek ? "مسموح" : "مغلق"} · النص:{" "}
                {settings.showTranscript ? "يُعرض بعد الإجابة" : "مخفى"}
              </p>
            </div>

            <div className="space-y-5">
              <div
                className="flex flex-col gap-4 rounded-[20px] border bg-[#fcfdfc] p-5 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: CARD_BORDER }}
              >
                <div className="text-right space-y-1">
                  <p className="text-sm font-black text-[#0f2918]">المشاركة في المكتبة العامة</p>
                  <p className="text-[12px] leading-relaxed text-[#64748B]">يتمكن المعلمون من استيراد النشاط إلى حساباتهم.</p>
                </div>
                <Switch checked={isShared} onCheckedChange={setIsShared} className="data-[state=checked]:bg-[#1E4D35]" />
              </div>

              <div className="space-y-2 text-right">
                <label className="text-xs font-bold text-[#64748B]">وضع الوصول</label>
                <div className="relative max-w-full sm:max-w-xs sm:ms-auto">
                  <select
                    value={accessMode}
                    onChange={(e) => setAccessMode(e.target.value as "public" | "private")}
                    className={cn(selectUiClass, "px-4 pe-10 font-bold")}
                    style={{ borderColor: COLOR_CARD_BORDER }}
                  >
                    <option value="public">عام — بالرابط للطلاب</option>
                    <option value="private">خاص — حسب إعدادات المنصة</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                </div>
                <p className="text-[11px] text-[#94a3ab] leading-relaxed">
                  «عام» يعني إتاحة الوصول للنشاط عبر الرابط وفق سياسات المنصة. «خاص» يقيّد الوصول حسب إعدادات حسابك.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}

      {step === 4 && (
        <main className="mx-auto max-w-[1100px] space-y-7 px-4 py-7 sm:py-8">
          <div className="text-right space-y-2">
            <h2 className="text-xl font-black text-[#0f2918] sm:text-2xl">مراجعة النشاط قبل النشر</h2>
            <p className="text-sm leading-relaxed text-[#64748B]">راجع النشاط وتأكد من جاهزيته قبل أن يصبح متاحاً للطلاب.</p>
          </div>

          <section
            className={cn("rounded-[24px] border bg-gradient-to-br from-[#1E4D35] via-[#225739] to-[#17382a] p-6 text-white shadow-lg sm:p-8", TRANSITION)}
            style={{ boxShadow: "0 12px 40px rgba(30, 77, 53, 0.25)" }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                  <Headphones className="h-7 w-7" />
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-xs font-bold text-white/70">نشاط استماع</p>
                  <h3 className="text-2xl font-black leading-snug">{title.trim() || "بدون عنوان"}</h3>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">{questions.length} أسئلة</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">{totalPoints} درجة</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
                      {settings.maxListens === 0 ? "استماع غير محدود" : `${settings.maxListens} استماع`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-right text-[11px] leading-relaxed backdrop-blur-sm">
                <p className="font-bold text-white/90">آخر مراجعة للمعالج</p>
                <p className="mt-1 text-white/75">{new Date().toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "النص الصوتي",
                desc: `${audioText.length.toLocaleString("ar-SA")} حرف · قراءة تقريبية ~${approxDurationSec} ث`,
                icon: <Volume2 className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: "إعدادات الاستماع",
                desc: LISTEN_SEGMENTS.find((s) => s.value === settings.maxListens)?.label ?? "—",
                icon: <Settings2 className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: "الأسئلة",
                desc: `${questions.length} سؤالًا · ${totalPoints} درجة`,
                icon: <ListChecks className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: "إعدادات النشر",
                desc: `${accessMode === "public" ? "وصول عام بالرابط" : "وصول خاص"} · ${isShared ? "مشاركة مع المكتبة" : "غير مشارَك"}`,
                icon: <Globe className="h-5 w-5" />,
                go: 3 as const,
              },
            ].map((card) => (
              <div
                key={card.title}
                className={cn("flex flex-col rounded-[24px] border bg-white p-5 text-right", TRANSITION)}
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3f7f4] text-[#1E4D35]">{card.icon}</div>
                <h4 className="font-black text-[#0f2918]">{card.title}</h4>
                <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[#64748B]">{card.desc}</p>
                <button
                  type="button"
                  onClick={() => setStep(card.go)}
                  className="mt-4 min-h-[44px] rounded-xl border border-[#1E4D35]/20 bg-white text-sm font-black text-[#1E4D35] hover:bg-[#eef5f0]"
                >
                  تعديل
                </button>
              </div>
            ))}
          </div>

          <section className={cn("rounded-[24px] border bg-white p-6 text-right", TRANSITION)} style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}>
            <h4 className="mb-4 font-black text-[#0f2918]">معاينة الأسئلة</h4>
            <div className="space-y-3">
              {questions.slice(0, 2).map((qq, idx) => (
                <div key={qq.id} className="rounded-2xl border bg-[#fafdfb] px-4 py-3" style={{ borderColor: CARD_BORDER }}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 justify-end">
                    <span className="text-[11px] font-bold text-[#94a3ab]">سؤال {idx + 1}</span>
                    <QuestionTypeBadge type={qq.type} />
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-[#111827] line-clamp-3">{qq.text || "—"}</p>
                </div>
              ))}
              {questions.length > 2 && (
                <p className="text-center text-[12px] text-[#94a3ab]">+ {questions.length - 2} أسئلة إضافية</p>
              )}
            </div>
          </section>

          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-center text-[13px] font-semibold text-amber-950">
            سيصبح النشاط متاحاً للطلاب فور نشره.
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-sm font-bold text-[#1E4D35] underline-offset-4 hover:underline"
            >
              العودة لتعديل إعدادات النشر
            </button>
          </div>
        </main>
      )}

      <footer
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 border-t bg-[#fcfdfc]/88 backdrop-blur-xl",
          TRANSITION,
        )}
        style={{ borderColor: CARD_BORDER }}
        dir="rtl"
      >
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-2 px-4 py-3 sm:justify-between sm:gap-3">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-1">
            <button
              type="button"
              onClick={footerBack}
              className={cn(
                "flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border bg-white px-4 text-sm font-black text-[#374151] hover:bg-[#f3f7f4] sm:flex-none",
                TRANSITION,
              )}
              style={{ borderColor: COLOR_CARD_BORDER }}
            >
              <ChevronRight className="h-4 w-4" /> رجوع
            </button>
            <button
              type="button"
              onClick={saveDraftLocal}
              className={cn(
                "flex min-h-[44px] flex-1 items-center justify-center rounded-2xl border border-dashed px-4 text-sm font-bold text-[#64748B] hover:border-[#1E4D35]/25 hover:text-[#1E4D35] sm:flex-none",
                TRANSITION,
              )}
              style={{ borderColor: CARD_BORDER }}
            >
              حفظ كمسودة
            </button>
          </div>
          <button
            type="button"
            onClick={footerPrimaryAction}
            disabled={createMutation.isPending}
            className={cn(
              "flex min-h-[44px] w-full min-w-[160px] flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black text-white shadow-md hover:opacity-[0.97] active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:flex-none",
              TRANSITION,
            )}
            style={{
              background: step === 4 ? `linear-gradient(90deg, ${BRAND} 0%, ${BRAND_MID} 100%)` : BRAND,
              boxShadow: "0 8px 24px rgba(30, 77, 53, 0.22)",
            }}
          >
            {step === 4 ? (
              createMutation.isPending ? (
                "جارٍ النشر..."
              ) : (
                <>
                  <Save className="h-4 w-4" /> نشر النشاط
                </>
              )
            ) : (
              <>
                التالي
                <ChevronLeft className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
