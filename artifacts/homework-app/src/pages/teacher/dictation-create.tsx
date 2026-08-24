import { useState, useRef, useEffect, useCallback } from "react";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
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
import { useI18n } from "@/lib/i18n";

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
/** حد معقول للواجهة — الـ API يقبل min(0) فقط */
const MAX_QUESTION_POINTS = 100;
const POINT_STEP = 0.5;

type AccessFlavor = "general" | "link" | "private";

function clampQuestionPoints(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_QUESTION_POINTS, Math.round(n * 100) / 100);
}

/** Logical field alignment; entered content selects its own direction. */
const FIELD_CLASS = "text-start placeholder:text-start placeholder:text-[#94a3ab]";

const PREVIEW_SPEEDS = [0.75, 1, 1.25, 1.5] as const;

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

const SPEED_PRESETS = [0.75, 0.85, 0.9, 1, 1.1, 1.25] as const;

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
  const { t } = useI18n();
  const refreshCreditsBalance = useRefreshCreditsBalance();
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
        refreshCreditsBalance();
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
        toast.error(t.dictationCreate.audioError);
      }
    },
    [speakingId, stopAudio, volume, t.dictationCreate.audioError],
  );

  return { speakingId, progress, currentSec, durationSec, volume, play, stopAudio, seek, setSpeed, setVolume };
}

// ===================== Sub-components =====================

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { t } = useI18n();
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
        aria-label={t.dictationCreate.reorderQuestions}
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
  const { dir } = useI18n();
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
      <div dir={dir} className="min-w-0 flex-1 text-start space-y-1">
        <p className="text-sm font-bold text-[#0f2918] leading-snug">{label}</p>
        {hint && <p className="text-[11px] text-[#64748B] leading-relaxed">{hint}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        labelVariant="none"
        className="shrink-0 mt-1"
      />
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const { t } = useI18n();
  const map: Record<QuestionType, { label: string; className: string; icon: React.ReactNode }> = {
    mcq: { label: t.dictationCreate.multipleChoice, className: "bg-sky-50/90 text-sky-800 border-sky-100", icon: <ListChecks className="w-3.5 h-3.5" /> },
    dictation: { label: t.dictationCreate.dictation, className: "bg-amber-50/90 text-amber-900 border-amber-100", icon: <Mic className="w-3.5 h-3.5" /> },
    open: { label: t.dictationCreate.openAnswer, className: "bg-[#eef5f0] text-[#1E4D35] border-[#dce8e0]", icon: <AlignLeft className="w-3.5 h-3.5" /> },
    true_false: { label: t.dictationCreate.trueFalse, className: "bg-emerald-50/90 text-emerald-900 border-emerald-100", icon: <Check className="w-3.5 h-3.5" /> },
  };
  const { label, className, icon } = map[type];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border", className)}>
      {icon} {label}
    </span>
  );
}

function ListeningOptionCard({
  icon,
  title,
  hint,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  footer: React.ReactNode;
}) {
  const { dir } = useI18n();
  return (
    <div
      className={cn("flex min-h-[148px] flex-col rounded-[20px] border bg-[#fafdfb] p-4", TRANSITION)}
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="flex flex-1 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-[#1E4D35]"
          style={{ borderColor: CARD_BORDER }}
        >
          {icon}
        </div>
        <div dir={dir} className="min-w-0 flex-1 space-y-1 text-start">
          <p className="text-sm font-bold text-[#0f2918]">{title}</p>
          <p className="text-[11px] leading-relaxed text-[#64748B]">{hint}</p>
        </div>
      </div>
      <div className="mt-auto border-t pt-3" style={{ borderColor: CARD_BORDER }}>
        {footer}
      </div>
    </div>
  );
}

// ===================== Main Component =====================

export default function DictationCreate() {
  const { t, lang, dir } = useI18n();
  const c = t.dictationCreate;
  const speedLabel = (v: number): string => {
    const label = v <= 0.76 ? c.speedVerySlow : v <= 0.88 ? c.speedSlow : v <= 1 ? c.speedNormal : v <= 1.13 ? c.speedFast : c.speedVeryFast;
    return `${label} ${v}×`;
  };
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
  const [accessFlavor, setAccessFlavor] = useState<AccessFlavor>("general");

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
        setAccessFlavor(a.accessMode === "private" ? "private" : "general");
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
        toast.error(c.loadError);
        setLocation("/teacher");
      }
    })();
    return () => { cancelled = true; };
  }, [editId, isEditing, hydrated, setLocation, c.loadError]);

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
    setPreviewSpeed((ps) => ((PREVIEW_SPEEDS as readonly number[]).includes(ps) ? ps : 1));
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
      if (!res.ok) throw new Error(data.message || c.saveError);
      const id: number = isEditing ? Number(editId) : Number(data.id);
      return { id };
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${id}`] });
      toast.success(isEditing ? c.updateSuccess : c.publishSuccess);
      setLocation(`/teacher/assignment/${id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const validateStep1 = () => {
    if (!title.trim()) {
      toast.error(c.titleRequired);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!audioText.trim()) {
      toast.error(c.audioRequired);
      return false;
    }
    const emptyQ = questions.findIndex((q) => !q.text.trim());
    if (emptyQ !== -1) {
      toast.error(c.questionRequired.replace("{n}", String(emptyQ + 1)));
      setActiveIndex(emptyQ);
      return false;
    }
    for (const q of questions) {
      if (q.type === "mcq") {
        if (!q.optionA.trim() || !q.optionB.trim()) {
          toast.error(c.mcqRequired);
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
      accessMode: accessFlavor === "private" ? "private" : "public",
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
          accessFlavor,
        }),
      );
      toast.success(c.draftSaved);
    } catch {
      toast.error(c.draftError);
    }
  };

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const STEPS_META = [
    { num: 1 as const, label: c.basics },
    { num: 2 as const, label: c.contentQuestions },
    { num: 3 as const, label: c.publishingSettings },
    { num: 4 as const, label: c.review },
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
     FIELD_CLASS +
    " " +
    TRANSITION;

  const approxDurationSec = estimateReadSeconds(audioText, audioSpeed);

  const primaryClassLabel =
    targetClasses.length === 0 ? c.noClass : targetClasses.join(lang === "ar" ? "، " : ", ");

  const accessFlavorLabel =
    accessFlavor === "private" ? c.accessPrivate : accessFlavor === "link" ? c.accessLink : c.accessGeneral;

  const formattedApproxDuration =
    approxDurationSec < 60
      ? `≈ ${approxDurationSec} ${c.secondsShort}`
      : `≈ ${Math.floor(approxDurationSec / 60)} ${c.minutesShort} ${approxDurationSec % 60} ${c.secondsShort}`;

  /** سطر مختصر لإعدادات الاستماع — للنشر والمراجعة */
  const listeningSettingsSummary =
    `${settings.maxListens === 0 ? c.unlimitedListening : `${settings.maxListens} ${c.times}`}` +
    ` · ${c.speedControl}: ${settings.allowSpeedControl ? c.allowed : c.disabled}` +
    ` · ${c.seek}: ${settings.allowSeek ? c.allowed : c.disabled}` +
    ` · ${c.showTranscript}: ${settings.showTranscript ? c.afterAnswer : c.hidden}`;
  const accessFlavorOptions: { id: AccessFlavor; label: string; hint: string }[] = [
    { id: "general", label: c.accessGeneral, hint: c.accessGeneralHint },
    { id: "link", label: c.accessLink, hint: c.accessLinkHint },
    { id: "private", label: c.accessPrivate, hint: c.accessPrivateHint },
  ];

  const waveformBars = [5, 9, 6, 11, 8, 7, 10, 6];

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden pb-[calc(7.25rem+env(safe-area-inset-bottom))]"
      style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
      dir={dir}
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
            aria-label={c.back}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <nav
            className="flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-center sm:overflow-visible [-webkit-overflow-scrolling:touch]"
            aria-label={c.wizardSteps}
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
                <div className="space-y-1 text-start">
                  <h1 className="text-xl font-black leading-tight text-[#0f2918] sm:text-2xl">{c.basicsTitle}</h1>
                  <p className="text-sm leading-relaxed text-[#64748B]">{c.basicsDescription}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2 text-start">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[#0f2918]" htmlFor="listening-title">
                    {c.activityTitle} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold tabular-nums text-[#94a3b8]">{title.length} / 120</span>
                </div>
                <input
                  id="listening-title"
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={c.titlePlaceholder}
                  dir="auto"
                  autoComplete="off"
                  className={cn(
                    "min-h-[52px] w-full rounded-2xl border bg-white px-4 py-3 text-base font-semibold text-[#111827]",
                    FIELD_CLASS,
                    "focus:border-[#1E4D35]/30 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/15",
                    TRANSITION,
                  )}
                  style={{ borderColor: COLOR_CARD_BORDER }}
                />
              </div>

              <div className="text-start">
                <div
                  className={cn("rounded-[24px] border bg-[#fafdfb] p-5 sm:p-6", TRANSITION)}
                  style={{ borderColor: CARD_BORDER }}
                >
                  <div className="mb-4 flex flex-col gap-1">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#94a3b8]">{c.grade}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-[#0f2918]">{primaryClassLabel}</span>
                      {targetClasses.length > 0 && (
                        <Check className="h-4 w-4 text-[#1E4D35]" strokeWidth={3} aria-hidden />
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#64748B]">
                      {targetClasses.length === 0
                        ? c.noClassDescription
                        : c.classDescription}
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
                          {targetClasses.length === 0 ? c.selectClass : c.change}
                          <ChevronDown className="h-4 w-4 opacity-60" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(100vw-2rem,320px)] rounded-2xl border p-2 shadow-lg text-start" align="end" dir={dir}>
                        <p className="mb-2 px-2 text-[11px] font-bold text-[#94a3b8]">{c.savedClasses}</p>
                        <div className="max-h-[240px] overflow-y-auto">
                          {gradeLevels.length === 0 ? (
                            <p className="px-2 py-6 text-center text-sm text-[#64748B]">{c.noSavedClasses}</p>
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
                                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors hover:bg-[#f3f7f4]",
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
                        {c.removeClass}
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
            <div className="flex flex-col gap-2 border-b px-6 py-5 text-start sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: CARD_BORDER, background: "linear-gradient(180deg, #fafdfb 0%, #fff 100%)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E4D35] text-white shadow-sm shadow-[#1E4D35]/20">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0f2918]">{c.audioTitle}</h2>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#64748B]">{c.audioDescription}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2 text-start">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#0f2918]">{c.recordingText}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#94a3ab]">{audioText.length} / {MAX_CHARS}</span>
                </div>
                <textarea
                  value={audioText}
                  dir="auto"
                  onChange={(e) => setAudioText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={c.audioPlaceholder}
                  className={cn(
                    "min-h-[220px] w-full resize-y rounded-2xl border bg-[#fcfdfc] px-4 py-4 text-base leading-[1.75] text-[#111827]",
                    FIELD_CLASS,
                    "focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/12",
                    TRANSITION,
                  )}
                  style={{ borderColor: COLOR_CARD_BORDER }}
                />
              </div>

              {/* صف ١: الصوت + سرعة الإنشاء │ صف ٢: المدة + معاينة (مدمجة) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-bold text-[#64748B]">{c.voice}</label>
                  <div className="relative">
                    <select
                      value={audioVoice}
                      onChange={(e) => setAudioVoice(e.target.value)}
                      className={cn(selectUiClass, "px-4 pe-10")}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                    >
                      {(["shimmer", "nova", "alloy", "echo", "onyx"] as const).map((voice) => (
                        <option key={voice} value={voice}>{c[`voice${voice.charAt(0).toUpperCase()}${voice.slice(1)}` as "voiceShimmer" | "voiceNova" | "voiceAlloy" | "voiceEcho" | "voiceOnyx"]}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                  </div>
                </div>
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-bold text-[#64748B]">{c.readingSpeed}</label>
                  <div className="relative">
                    <select
                      value={String(audioSpeed)}
                      onChange={(e) => setAudioSpeed(Number(e.target.value))}
                      className={cn(selectUiClass, "px-4 pe-10")}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                    >
                      {SPEED_PRESETS.map((sp) => (
                        <option key={sp} value={sp}>{speedLabel(sp)}</option>
                      ))}
                    </select>
                    <Gauge className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                  </div>
                </div>

                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-bold text-[#64748B]">{c.approximateDuration}</label>
                  <div
                    className="flex h-12 items-center justify-between rounded-2xl border bg-[#f9faf9] px-4 text-sm font-bold text-[#374151]"
                    style={{ borderColor: COLOR_CARD_BORDER }}
                  >
                    <span className="tabular-nums">
                      {approxDurationSec < 60
                        ? `≈ ${approxDurationSec} ${c.secondsShort}`
                        : `≈ ${Math.floor(approxDurationSec / 60)} ${c.minutesShort} ${approxDurationSec % 60} ${c.secondsShort}`}
                    </span>
                    <span className="text-[11px] font-semibold text-[#94a3ab]">{c.basedOnTextLength}</span>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col gap-2 rounded-[20px] border bg-[#fafdfb] p-3 sm:p-3.5",
                    TRANSITION,
                  )}
                  style={{ borderColor: CARD_BORDER }}
                >
                  <p className="text-start text-xs font-bold text-[#64748B]">{c.audioPreview}</p>

                  {/* صف تحكم يلتف تلقائياً إذا ضاقت الخلية */}
                  <div className="flex flex-wrap items-center justify-start gap-1.5">
                    <button
                      type="button"
                      disabled={!audioText.trim()}
                      onClick={() => previewTts("main-audio", audioText, audioSpeed, audioVoice)}
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-full text-white shadow-md",
                        TRANSITION,
                        "h-10 w-10 max-md:min-h-[44px] max-md:min-w-[44px] md:h-9 md:w-9 hover:opacity-95 active:scale-[0.98]",
                        isAudioPlaying ? "bg-red-500" : "bg-[#1E4D35]",
                      )}
                      aria-label={isAudioPlaying ? c.stop : c.play}
                    >
                      {isAudioPlaying ? <Square className="h-4 w-4 md:h-3.5 md:w-3.5" /> : <Volume2 className="h-4 w-4 md:h-3.5 md:w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => seek(-10)}
                      disabled={!isAudioPlaying}
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-lg border bg-white text-[#1E4D35] disabled:opacity-30",
                        "h-10 w-10 max-md:min-h-[44px] max-md:min-w-[44px] md:h-9 md:w-9",
                      )}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                      title={c.backTenSeconds}
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => seek(10)}
                      disabled={!isAudioPlaying}
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-lg border bg-white text-[#1E4D35] disabled:opacity-30",
                        "h-10 w-10 max-md:min-h-[44px] max-md:min-w-[44px] md:h-9 md:w-9",
                      )}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                      title={c.forwardTenSeconds}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>

                    <div className="relative min-w-[5.5rem] shrink-0">
                      <select
                        value={String(previewSpeed)}
                        onChange={(e) => {
                          const sp = Number(e.target.value);
                          setPreviewSpeed(sp);
                          setSpeed(sp);
                        }}
                        className={cn(
                          "h-9 w-full rounded-lg border bg-white px-2 py-1 text-[11px] font-black text-[#374151]",
                          FIELD_CLASS,
                          "appearance-none pe-7 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/15",
                          TRANSITION,
                        )}
                        style={{ borderColor: COLOR_CARD_BORDER }}
                        aria-label={c.previewSpeed}
                      >
                        {PREVIEW_SPEEDS.map((sp) => (
                          <option key={sp} value={sp}>×{sp}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#94a3ab]" />
                    </div>

                    <div className="flex min-h-[36px] min-w-[min(100%,8rem)] flex-1 basis-[7rem] items-center gap-1.5 md:max-w-[10rem]">
                      <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#94a3ab]" aria-hidden />
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="h-1 min-w-0 flex-1 cursor-pointer accent-[#1E4D35]"
                        aria-label={c.volume}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex h-6 items-end justify-start gap-px overflow-hidden">
                      {waveformBars.map((h, wi) => (
                        <div
                          key={wi}
                          className="w-0.5 shrink-0 rounded-full bg-[#dce8e0] sm:w-px"
                          style={{
                            height: `${Math.round(h * 0.65)}px`,
                            opacity: isAudioPlaying && progress > (wi / waveformBars.length) * 100 ? 1 : 0.35,
                            backgroundColor: isAudioPlaying && progress > (wi / waveformBars.length) * 100 ? BRAND : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative h-0.5 overflow-hidden rounded-full bg-[#e8ece9]">
                      <div
                        className={cn("h-full rounded-full bg-[#1E4D35]", TRANSITION)}
                        style={{ width: `${isAudioPlaying ? progress : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold tabular-nums text-[#64748B]">
                      <span>{formatAudioTime(currentSec)}</span>
                      <span className="text-[#94a3ab]">{formatAudioTime(durationSec)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className={cn("rounded-[24px] border bg-white p-6 sm:p-8", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="mb-6 text-start">
              <h2 className="text-lg font-black text-[#0f2918]">{c.studentListeningSettings}</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">{c.studentListeningSettingsDescription}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ListeningOptionCard
                icon={<Gauge className="h-4 w-4" />}
                title={c.speedControl}
                hint={c.speedControlHint}
                footer={
                  <div className="flex justify-start">
                    <Switch
                      checked={settings.allowSpeedControl}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSpeedControl: v }))}
                      labelVariant="none"
                    />
                  </div>
                }
              />
              <ListeningOptionCard
                icon={<SkipForward className="h-4 w-4" />}
                title={c.seek}
                hint={c.seekHint}
                footer={
                  <div className="flex justify-start">
                    <Switch
                      checked={settings.allowSeek}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, allowSeek: v }))}
                      labelVariant="none"
                    />
                  </div>
                }
              />
              <ListeningOptionCard
                icon={<AlignLeft className="h-4 w-4" />}
                title={c.showTranscript}
                hint={c.showTranscriptHint}
                footer={
                  <div className="flex justify-start">
                    <Switch
                      checked={settings.showTranscript}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, showTranscript: v }))}
                      labelVariant="none"
                    />
                  </div>
                }
              />
              <ListeningOptionCard
                icon={<Headphones className="h-4 w-4" />}
                title={c.listenCount}
                hint={c.listenCountHint}
                footer={
                  <div className="relative w-full max-w-full">
                    <select
                      value={settings.maxListens}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, maxListens: Number(e.target.value) }))
                      }
                      className={cn(
                        "h-10 w-full rounded-xl border bg-white px-3 py-2 text-xs font-black text-[#374151]",
                        FIELD_CLASS,
                        "appearance-none pe-9 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/15",
                        TRANSITION,
                      )}
                      style={{ borderColor: COLOR_CARD_BORDER }}
                      aria-label={c.listenCount}
                    >
                      {[1, 2, 3, 0].map((count) => (
                        <option key={count} value={count}>
                          {count === 0 ? c.unlimitedListening : count === 1 ? c.once : count === 2 ? c.twice : `${count} ${c.times}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3ab]" />
                  </div>
                }
              />
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-3 text-start sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#0f2918]">{c.questions}</h2>
                <p className="text-[12px] text-[#94a3ab]">{c.reorderQuestions}</p>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-2">
                <span className="rounded-full bg-[#eef5f0] px-3 py-1 text-xs font-black text-[#1E4D35]">{questions.length} {c.questions}</span>
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
                      {c.addQuestion}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52 rounded-2xl border p-1 shadow-lg text-start" align="end">
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("open")}>
                      {c.openAnswer}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("mcq")}>
                      {c.multipleChoice}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("true_false")}>
                      {c.trueFalse}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl py-2.5 font-bold" onClick={() => addQuestion("dictation")}>
                      {c.dictation}
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
                              {c.question} {i + 1}
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
                                aria-label={c.questionOptions}
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 rounded-2xl border p-1 shadow-lg text-start" align="end">
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "open")}>
                                {c.convertOpen}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "mcq")}>
                                {c.convertMcq}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "true_false")}>
                                {c.convertTrueFalse}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl font-bold" onClick={() => applyQuestionType(q, "dictation")}>
                                {c.convertDictation}
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
                                    {c.deleteQuestion}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="space-y-5 px-5 pb-6">
                          <div className="space-y-2 text-start">
                            <label className="text-xs font-bold text-[#64748B]">{c.questionWording}</label>
                            <textarea
                              value={q.text}
                              dir="auto"
                              onChange={(e) => updateQuestion(q.id, { text: e.target.value.slice(0, MAX_QUESTION_CHARS) })}
                              rows={3}
                              placeholder={
                                q.type === "dictation"
                                  ? c.dictationQuestionPlaceholder
                                  : q.type === "mcq"
                                     ? c.mcqQuestionPlaceholder
                                    : c.questionPlaceholder
                              }
                              className={cn(
                                "min-h-[100px] w-full resize-y rounded-2xl border bg-[#fcfdfc] px-4 py-3 text-sm leading-relaxed text-[#111827]",
                                FIELD_CLASS,
                                "focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/10",
                              )}
                              style={{ borderColor: COLOR_CARD_BORDER }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-[11px] tabular-nums text-[#94a3ab]">{q.text.length} / {MAX_QUESTION_CHARS}</p>
                          </div>

                        {/* خيارات MCQ */}
                        {q.type === "mcq" && (
                          <div className="space-y-3 mb-4" dir={dir}>
                            <p className="text-xs font-bold text-[#64748B]">{c.optionsHint}</p>
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
                                        ? "bg-[#1E4D35] border-[#1E4D35] text-white"
                                        : "border-[#D1D5DB] text-[#D1D5DB] hover:border-[#1E4D35]"
                                    }`}
                                  >
                                    {isCorrect ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span className="text-xs font-black">{letter}</span>}
                                  </button>
                                  <input
                                    type="text"
                                    dir="auto"
                                    value={q[field] as string}
                                    onChange={(e) => updateQuestion(q.id, { [field]: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                    placeholder={`${c.option} ${letter}`}
                                    className={cn(
                                      "flex-1 rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/20",
                                    FIELD_CLASS,
                                    )}
                                    style={{ borderColor: isCorrect ? "#1E4D35" : COLOR_CARD_BORDER }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* صح / خطأ — اختيار الإجابة الصحيحة */}
                        {q.type === "true_false" && (
                          <div className="mb-4 grid grid-cols-2 gap-3" dir={dir}>
                            {[
                              { value: "true", label: c.true, icon: "✓" },
                              { value: "false", label: c.false, icon: "✗" },
                            ].map((opt) => {
                              const isCorrect = q.correctAnswer === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateQuestion(q.id, { correctAnswer: opt.value }); }}
                                  className={`py-3 rounded-xl border-2 font-black text-sm flex flex-col items-center gap-1 transition-colors ${
                                    isCorrect
                                      ? "border-[#1E4D35] bg-[#ecfdf5] text-[#1E4D35]"
                                      : "border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#1E4D35]/40"
                                  }`}
                                >
                                  <span className="text-xl">{opt.icon}</span>
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                            <p className="col-span-2 text-[11px] text-[#64748B] text-start">{c.trueFalseHint}</p>
                          </div>
                        )}

                        {/* إجابة نموذجية — Accordion */}
                        {(q.type === "open" || q.type === "dictation") && (
                          <Collapsible className="rounded-2xl border bg-[#fafdfb]" style={{ borderColor: CARD_BORDER }}>
                            <CollapsibleTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="flex w-full min-h-[48px] items-center justify-between gap-2 rounded-2xl px-4 py-3 text-start text-sm font-black text-[#1E4D35] hover:bg-[#f3f7f4] data-[state=open]:rounded-b-none data-[state=open]:[&_.chev-icon]:rotate-180"
                            >
                              {c.sampleAnswer}
                              <ChevronDown className="chev-icon h-4 w-4 shrink-0 opacity-60 transition-transform duration-200" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t px-4 pb-4 pt-2" style={{ borderColor: CARD_BORDER }}>
                              <textarea
                                dir="auto"
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                                onClick={(e) => e.stopPropagation()}
                                rows={3}
                                placeholder={
                                  q.type === "dictation"
                                    ? c.dictationAnswerPlaceholder
                                    : c.answerPlaceholder
                                }
                                className={cn(
                                  "w-full resize-y rounded-xl border bg-white px-3 py-3 text-sm leading-relaxed text-[#111827]",
                                  FIELD_CLASS,
                                  "focus:border-[#1E4D35]/25 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/10",
                                )}
                                style={{ borderColor: COLOR_CARD_BORDER }}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* إعدادات الإملاء */}
                        {q.type === "dictation" && (
                          <div className="mt-4 space-y-3 border-t border-dashed border-[#E5E7EB] pt-4" dir={dir}>
                            <p className="text-xs font-bold text-[#64748B]">{c.gradingSettings}</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <ToggleCell
                                icon={<Pencil className="h-4 w-4" />}
                                label={c.ignoreDiacritics}
                                checked={q.grading.ignoreDiacritics}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreDiacritics: v })}
                              />
                              <ToggleCell
                                icon={<Minus className="h-4 w-4" />}
                                label={c.ignoreTanween}
                                checked={q.grading.ignoreTanween}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreTanween: v })}
                              />
                              <ToggleCell
                                icon={<Mic className="h-4 w-4" />}
                                label={c.ignoreShadda}
                                checked={q.grading.ignoreShadda}
                                onCheckedChange={(v) => updateGrading(q.id, { ignoreShadda: v })}
                              />
                              <ToggleCell
                                icon={<AlignLeft className="h-4 w-4" />}
                                label={c.ignorePunctuation}
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
                              <p className="text-xs font-bold text-[#0f2918] text-start">{c.tolerance}</p>
                            </div>
                          </div>
                        )}

                        {/* الدرجة */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-4" style={{ borderColor: CARD_BORDER }}>
                          <span className="text-xs font-bold text-[#64748B]">{c.points}</span>
                          <div
                            className="inline-flex items-center gap-1 rounded-2xl border bg-white p-1"
                            style={{ borderColor: COLOR_CARD_BORDER }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuestion(q.id, {
                                  points: clampQuestionPoints(q.points - POINT_STEP),
                                });
                              }}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border text-[#1E4D35] hover:bg-[#f3f7f4]"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                              aria-label={c.decreasePoints}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              step={0.01}
                              min={0}
                              max={MAX_QUESTION_POINTS}
                              value={Number.isFinite(q.points) ? q.points : 0}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (e.target.value === "" || Number.isNaN(v)) return;
                                updateQuestion(q.id, { points: clampQuestionPoints(v) });
                              }}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                updateQuestion(q.id, {
                                  points: clampQuestionPoints(
                                    e.target.value === "" || Number.isNaN(v) ? q.points : v,
                                  ),
                                });
                              }}
                              className={cn(
                                "h-10 w-[4.25rem] rounded-xl border bg-[#fafdfb] text-center text-sm font-black tabular-nums text-[#0f2918]",
                                FIELD_CLASS,
                                "focus:border-[#1E4D35]/35 focus:outline-none focus:ring-2 focus:ring-[#1E4D35]/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                              )}
                              style={{ borderColor: COLOR_CARD_BORDER }}
                              aria-label={c.pointsValue}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuestion(q.id, {
                                  points: clampQuestionPoints(q.points + POINT_STEP),
                                });
                              }}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border text-[#1E4D35] hover:bg-[#f3f7f4]"
                              style={{ borderColor: COLOR_CARD_BORDER }}
                              aria-label={c.increasePoints}
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
          <div className="text-start space-y-2">
            <h2 className="text-xl font-black text-[#0f2918] sm:text-2xl">{c.publishingSettings}</h2>
            <p className="text-sm leading-relaxed text-[#64748B]">{c.publishingDescription}</p>
          </div>

          <section
            className={cn("rounded-[24px] border bg-white p-6 sm:p-8", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="mb-6 space-y-4 text-start">
              <div
                className="rounded-[20px] border bg-[#fafdfb] p-5 sm:p-6"
                style={{ borderColor: CARD_BORDER }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-bold text-[#94a3ab]">{c.activityName}</p>
                    <p className="text-lg font-black leading-snug text-[#0f2918] sm:text-xl">
                      {title.trim() || c.untitled}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eef5f0] px-3 py-1 text-[11px] font-black text-[#1E4D35]">
                    {c.draft}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    k: "questions",
                    label: c.questions,
                    value: `${questions.length} ${c.questions} · ${totalPoints} ${c.points}`,
                  },
                  {
                    k: "duration",
                    label: c.approximateDuration,
                    value: formattedApproxDuration,
                  },
                  {
                    k: "class",
                    label: c.grade,
                    value: primaryClassLabel,
                  },
                  {
                    k: "listening",
                    label: c.studentListeningSettings,
                    value: listeningSettingsSummary,
                    wide: true,
                  },
                ].map((cell) => (
                  <div
                    key={cell.k}
                    className={cn(
                      "rounded-2xl border bg-[#fcfdfc] p-4 text-start",
                      cell.wide && "sm:col-span-2",
                    )}
                    style={{ borderColor: CARD_BORDER }}
                  >
                    <p className="text-[11px] font-bold text-[#94a3ab]">{cell.label}</p>
                    <p className="mt-1 text-sm font-black leading-relaxed text-[#0f2918]">{cell.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-[11px] tabular-nums text-[#94a3ab]">
                {c.audioCharacterCount.replace("{n}", audioText.length.toLocaleString(lang === "ar" ? "ar-SA" : "en-US"))}
              </p>
            </div>

            <div className="space-y-5">
              <div
                className="rounded-[20px] border bg-[#fcfdfc] p-5 sm:flex sm:items-center sm:justify-between sm:gap-4"
                style={{ borderColor: CARD_BORDER }}
              >
                <div className="mb-4 text-start sm:mb-0 sm:min-w-0 sm:flex-1 sm:space-y-1">
                  <p className="text-sm font-black text-[#0f2918]">{c.publicLibrary}</p>
                  <p className="text-[12px] leading-relaxed text-[#64748B]">
                    {c.publicLibraryHint}
                  </p>
                </div>
                <div className="flex justify-start sm:shrink-0">
                  <Switch checked={isShared} onCheckedChange={setIsShared}  />
                </div>
              </div>

              <div className="space-y-3 text-start">
                <label className="text-xs font-bold text-[#64748B]">{c.accessMode}</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {accessFlavorOptions.map((opt) => {
                    const active = accessFlavor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccessFlavor(opt.id)}
                        className={cn(
                          "min-h-[44px] rounded-2xl border px-3 py-2.5 text-start transition-colors",
                          active
                            ? "border-[#1E4D35] bg-[#eef5f0] shadow-sm shadow-[#1E4D35]/10"
                            : "border-transparent bg-[#f9faf9] hover:border-[#1E4D35]/15 hover:bg-[#fafdfb]",
                          TRANSITION,
                        )}
                        style={{ borderColor: active ? BRAND : CARD_BORDER }}
                      >
                        <span className="block text-sm font-black text-[#0f2918]">{opt.label}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-[#64748B]">
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-[#94a3ab]">
                  {accessFlavorOptions.find((option) => option.id === accessFlavor)?.hint}
                </p>
              </div>
            </div>
          </section>
        </main>
      )}

      {step === 4 && (
        <main className="mx-auto max-w-[1100px] space-y-7 px-4 py-7 sm:py-8">
          <div className="text-start space-y-2">
            <h2 className="text-xl font-black text-[#0f2918] sm:text-2xl">{c.reviewTitle}</h2>
            <p className="text-sm leading-relaxed text-[#64748B]">{c.reviewDescription}</p>
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
                <div className="space-y-2 text-start">
                  <p className="text-xs font-bold text-white/70">{c.listeningActivity}</p>
                  <h3 className="text-2xl font-black leading-snug">{title.trim() || c.untitled}</h3>
                  <div className="flex flex-wrap gap-2 justify-start">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">{questions.length} {c.questions}</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">{totalPoints} {c.points}</span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
                      {settings.maxListens === 0 ? c.unlimitedListening : `${settings.maxListens} ${c.listens}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-start text-[11px] leading-relaxed backdrop-blur-sm">
                <p className="font-bold text-white/90">{c.lastReview}</p>
                <p className="mt-1 text-white/75">{new Date().toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: c.audioText,
                desc: `${audioText.length.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")} ${c.charactersApprox} ~${approxDurationSec} ${c.secondsShort}`,
                icon: <Volume2 className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: c.studentListeningSettings,
                desc: listeningSettingsSummary,
                icon: <Settings2 className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: c.questions,
                desc: `${questions.length} ${c.questions} · ${totalPoints} ${c.points}`,
                icon: <ListChecks className="h-5 w-5" />,
                go: 2 as const,
              },
              {
                title: c.publishingSettings,
                desc: `${accessFlavorLabel} · ${isShared ? c.publicLibrary : c.notShared}`,
                icon: <Globe className="h-5 w-5" />,
                go: 3 as const,
              },
            ].map((card) => (
              <div
                key={card.title}
                className={cn("flex flex-col rounded-[24px] border bg-white p-5 text-start", TRANSITION)}
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
                  {c.edit}
                </button>
              </div>
            ))}
          </div>

          <section className={cn("rounded-[24px] border bg-white p-6 text-start", TRANSITION)} style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}>
            <h4 className="mb-4 font-black text-[#0f2918]">{c.questionsPreview}</h4>
            <div className="space-y-3">
              {questions.slice(0, 2).map((qq, idx) => (
                <div key={qq.id} className="rounded-2xl border bg-[#fafdfb] px-4 py-3" style={{ borderColor: CARD_BORDER }}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 justify-start">
                    <span className="text-[11px] font-bold text-[#94a3ab]">{c.question} {idx + 1}</span>
                    <QuestionTypeBadge type={qq.type} />
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-[#111827] line-clamp-3">{qq.text || "—"}</p>
                </div>
              ))}
              {questions.length > 2 && (
                <p className="text-center text-[12px] text-[#94a3ab]">+ {questions.length - 2} {c.additionalQuestions}</p>
              )}
            </div>
          </section>

          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-center text-[13px] font-semibold text-amber-950">
            {c.publishNotice}
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-sm font-bold text-[#1E4D35] underline-offset-4 hover:underline"
            >
              {c.returnToPublishing}
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
        dir={dir}
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
              <ChevronRight className="h-4 w-4" /> {c.back}
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
              {c.saveDraft}
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
                c.publishing
              ) : (
                <>
                  <Save className="h-4 w-4" /> {c.publish}
                </>
              )
            ) : (
              <>
                {c.next}
                <ChevronLeft className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
