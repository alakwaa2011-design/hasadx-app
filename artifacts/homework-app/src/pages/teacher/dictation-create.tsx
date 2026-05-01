import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
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
  ChevronRight,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const API_BASE = import.meta.env.VITE_API_URL || "";

const COLOR_BG = "#FAFAF8";
const COLOR_PRIMARY = "#14532D";
const COLOR_AMBER = "#D97706";
const COLOR_CARD_BORDER = "#E5E7EB";

const STUDENT_PROMPT_AR = "استمع جيداً ثم اكتب ما سمعته";
const INFO_BANNER_AR =
  "سيسمع الطالب النص الذي كتبته أدناه عبر الصوت. لن يرى النص المكتوب أثناء الإجابة";
const MAX_CHARS = 500;

interface GradingOpts {
  ignoreDiacritics: boolean;
  ignoreTanween: boolean;
  ignoreShadda: boolean;
  ignorePunctuation: boolean;
  allowErrors: boolean;
  tolerancePercent: number;
}

interface DictationItem {
  id: string;
  text: string;
  maxListens: number;
  speed: number;
  grading: GradingOpts;
}

const DEFAULT_GRADING: GradingOpts = {
  ignoreDiacritics: true,
  ignoreTanween: true,
  ignoreShadda: false,
  ignorePunctuation: true,
  allowErrors: true,
  tolerancePercent: 15,
};

const newItem = (): DictationItem => ({
  id: crypto.randomUUID(),
  text: "",
  maxListens: 3,
  speed: 0.85,
  grading: { ...DEFAULT_GRADING },
});

function speedLabelAr(v: number): string {
  if (v <= 0.72) return "بطيء جداً";
  if (v <= 0.82) return "بطيء";
  if (v <= 0.92) return "متوسط";
  return "سريع";
}

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

function useTtsPreview() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(
    async (itemId: string, text: string, speed: number) => {
      if (speakingId === itemId) {
        audioRef.current?.pause();
        audioRef.current = null;
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
        audio.onended = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch {
        setSpeakingId(null);
        toast.error("تعذّر تشغيل الصوت");
      }
    },
    [speakingId],
  );

  return { speakingId, play };
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
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 mt-0.5 data-[state=checked]:bg-[#14532D]" />
      <div dir="rtl" className="min-w-0 text-right">
        <p className="text-sm font-bold text-[#0f2918]">{label}</p>
        {hint && <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}

export default function DictationCreate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState("");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);

  const [items, setItems] = useState<DictationItem[]>([newItem()]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewPlayedByItem, setPreviewPlayedByItem] = useState<Record<string, number>>({});
  const { speakingId, play: previewTts } = useTtsPreview();

  const [isShared, setIsShared] = useState(false);
  const [accessMode, setAccessMode] = useState<"public" | "private">("public");

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/grade-levels`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setGradeLevels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1));
  }, [items.length, activeIndex]);

  const updateItem = (id: string, patch: Partial<DictationItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const updateGrading = (id: string, patch: Partial<GradingOpts>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, grading: { ...it.grading, ...patch } } : it)),
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const next = prev.filter((it) => it.id !== id);
      const out = next.length ? next : [newItem()];
      setActiveIndex((a) => {
        if (prev.length <= 1) return 0;
        if (idx === a) return Math.max(0, a - 1);
        if (idx < a) return a - 1;
        return Math.min(a, out.length - 1);
      });
      return out;
    });
  };

  const addItem = () => {
    setItems((prev) => {
      const next = [...prev, newItem()];
      setActiveIndex(next.length - 1);
      return next;
    });
  };

  const bumpPreviewPlay = (id: string) => {
    setPreviewPlayedByItem((m) => ({ ...m, [id]: (m[id] || 0) + 1 }));
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
      toast.success("تم نشر الإملاء بنجاح 🎉");
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
    const empty = items.findIndex((it) => !it.text.trim());
    if (empty !== -1) {
      toast.error(`الجملة ${empty + 1} فارغة — أدخل نص الإملاء`);
      setActiveIndex(empty);
      return false;
    }
    const long = items.findIndex((it) => it.text.length > MAX_CHARS);
    if (long !== -1) {
      toast.error(`الجملة ${long + 1} تتجاوز الحد (${MAX_CHARS} حرف)`);
      setActiveIndex(long);
      return false;
    }
    return true;
  };

  const goNextFromBasics = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const saveSentenceAndProceed = () => {
    if (!validateStep2()) return;
    setStep(3);
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
      questions: items.map((item, i) => ({
        text: STUDENT_PROMPT_AR,
        questionType: "dictation" as const,
        optionA: item.text.trim(),
        optionB: String(item.maxListens),
        optionC: item.grading.allowErrors ? "true" : "false",
        optionD: JSON.stringify({
          ignoreDiacritics: item.grading.ignoreDiacritics,
          ignoreShadda: item.grading.ignoreShadda,
          ignoreTanween: item.grading.ignoreTanween,
          ignorePunctuation: item.grading.ignorePunctuation,
          errorTolerancePercent: item.grading.tolerancePercent,
        }),
        correctAnswer: "",
        points: 1,
      })),
    });
  };

  const STEPS_LABELS = ["الأساسيات", "الجمل", "النشر"] as const;
  const activeItem = items[activeIndex] ?? items[0];
  const activePreviewPlayed = previewPlayedByItem[activeItem?.id] || 0;
  const listensLeft = Math.max(0, (activeItem?.maxListens ?? 3) - activePreviewPlayed);
  const isPreviewSpeakingTeacher = speakingId === `teacher-${activeItem?.id}`;
  const isPreviewSpeakingStudent = speakingId === `student-${activeItem?.id}`;

  const footerBack = () => {
    if (step === 1) setLocation("/teacher/new");
    else setStep(((step - 1) as 1 | 2 | 3));
  };

  const footerPrimaryAction = () => {
    if (step === 1) goNextFromBasics();
    else if (step === 2) saveSentenceAndProceed();
    else handleSubmitPublish();
  };

  return (
    <div className="min-h-[100dvh] pb-[88px]" style={{ backgroundColor: COLOR_BG }} dir="rtl">
      {/* Top step bar */}
      <header
        className="sticky top-0 z-30 shadow-sm border-b border-[#0a2815]/20"
        style={{ backgroundColor: COLOR_PRIMARY }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={footerBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white shrink-0 transition-colors"
            aria-label="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
            {STEPS_LABELS.map((label, idx) => {
              const sn = idx + 1;
              const done = step > sn;
              const current = step === sn;
              return (
                <div key={label} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-colors ${
                      current
                        ? "text-[#78350f] shadow-sm"
                        : done
                          ? "text-white/90"
                          : "text-white/45"
                    }`}
                    style={current ? { backgroundColor: COLOR_AMBER } : undefined}
                  >
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span>{sn}</span>}
                    <span className="whitespace-nowrap">{label}</span>
                  </div>
                  {idx < 2 && (
                    <span className={`mx-2 text-lg font-black ${done || current ? "text-white/55" : "text-white/30"}`}>
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="w-10 shrink-0" aria-hidden />
        </div>
      </header>

      {/* Page header zone (shown on step 2 per spec — also harmonize basics/publish titles) */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-3 flex-1 order-2 sm:order-1">
              <button
                type="button"
                className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border-2 border-[#14532D]/80 bg-[#ecfdf5] text-[#14532D] shadow-sm hover:bg-[#d1fae5] transition-colors"
                aria-hidden
              >
                <Mic className="w-8 h-8" strokeWidth={2} />
              </button>
              <div className="min-w-0 text-right flex-1">
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <h1 className="text-[1.65rem] font-black text-[#0f2918]">إملاء صوتي</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-[#92400e] bg-amber-100 border border-amber-200">
                    جديد
                  </span>
                </div>
                <p className="text-sm text-[#4b5563] mt-2 leading-relaxed font-medium">
                  يسمع الطالب النص ويكتبه — اختبار حقيقي للحفظ والإملاء
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 px-4 py-3 rounded-xl border border-[#bbf7d0] bg-[#ecfdf5] text-[#14532D] text-sm font-medium text-right shadow-sm leading-relaxed">
            {INFO_BANNER_AR}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-3xl mx-auto px-4 pt-8 space-y-5">
          <h2 className="text-xl font-black text-[#0f2918] text-right">الأساسيات</h2>
          <div className="space-y-1.5 text-right">
            <label className="text-sm font-bold text-[#0f2918]">عنوان النشاط *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: إملاء الدرس الأول"
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
                    <button type="button" onClick={() => setTargetClasses((p) => p.filter((x) => x !== c))}>
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

      {/* Step 2 — جمل */}
      {step === 2 && (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                {items.map((item, i) => (
                  <SortableItem key={item.id} id={item.id}>
                    <div
                      className={`p-5 pt-12 sm:pr-14 sm:ps-6 cursor-pointer ${activeIndex === i ? "ring-2 ring-[#D97706]/40" : ""}`}
                      role="presentation"
                      onClick={() => setActiveIndex(i)}
                    >
                      <div className="flex items-center gap-3 mb-4 justify-between">
                        <span className="text-sm font-bold text-[#64748B]">الجملة {i + 1}</span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              deleteItem(item.id);
                            }}
                            className="text-[#64748B] hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* نص الإملاء */}
                      <section className="mb-8 text-right border-b border-dashed border-[#E5E7EB] pb-6">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <Pencil className="w-4 h-4 text-[#64748B]" aria-hidden />
                          <h3 className="font-black text-[#0f2918]">نص الإملاء</h3>
                        </div>
                        <p className="text-[13px] text-[#64748B] mb-3 leading-relaxed">اكتب الجملة أو الفقرة التي سيسمعها الطالب</p>
                        <textarea
                          value={item.text}
                          dir="rtl"
                          onChange={(e) => updateItem(item.id, { text: e.target.value.slice(0, MAX_CHARS) })}
                          rows={4}
                          placeholder={`مثال: المعلم العربي أساس التقدم المعرفي.\n\nسيُطبَّع هذا النص ويتحقق بعد التصحيح من إعداداتك أدناه.`}
                          className="w-full px-4 py-3 rounded-[12px] bg-[#fdfdfd] border text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#14532D]/30 resize-none min-h-[7.5rem] text-[#111827]"
                          style={{ borderColor: COLOR_CARD_BORDER }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-3 items-end sm:items-end">
                          <button
                            type="button"
                            disabled={!item.text.trim()}
                            onClick={(e) => {
                              e.stopPropagation();
                              previewTts(`teacher-${item.id}`, item.text, item.speed);
                            }}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-black border-2 transition-colors shrink-0 ${
                              speakingId === `teacher-${item.id}`
                                ? "border-red-300 text-red-700 bg-red-50"
                                : "border-[#14532D] text-[#14532D] hover:bg-[#ecfdf5]"
                            } disabled:opacity-40`}
                          >
                            {speakingId === `teacher-${item.id}` ? (
                              <>
                                <Square className="w-4 h-4" /> إيقاف المعاينة
                              </>
                            ) : (
                              <>
                                استمع للمعاينة <Volume2 className="w-4 h-4" /> 🔊
                              </>
                            )}
                          </button>
                          <span className="text-xs font-bold text-[#64748B]">
                            {item.text.length} / {MAX_CHARS} حرف
                          </span>
                        </div>
                      </section>

                      {/* استماع */}
                      <section className="mb-8 pb-8 border-b border-dashed border-[#E5E7EB]" dir="rtl">
                        <h3 className="font-black text-[#0f2918] text-right mb-4">إعدادات الاستماع</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                          <div className="text-right space-y-2">
                            <p className="text-sm font-bold text-[#374151]">عدد مرات الاستماع</p>
                            <div className="inline-flex items-center gap-4 border rounded-[12px] px-2 py-2 bg-white" style={{ borderColor: COLOR_CARD_BORDER }}>
                              <button
                                type="button"
                                className="w-11 h-11 rounded-xl border flex items-center justify-center font-black text-xl text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                                aria-label="نقص"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateItem(item.id, { maxListens: Math.max(1, item.maxListens - 1) });
                                }}
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                              <span className="text-xl font-black text-[#0f2918] min-w-[2ch] tabular-nums text-center">{item.maxListens}</span>
                              <button
                                type="button"
                                className="w-11 h-11 rounded-xl border flex items-center justify-center font-black text-xl text-[#14532D] border-[#E5E7EB] hover:bg-[#F1F5F9]"
                                aria-label="زيادة"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateItem(item.id, { maxListens: Math.min(10, item.maxListens + 1) });
                                }}
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <div className="text-right space-y-3">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-sm font-bold text-[#374151]">سرعة الصوت</span>
                              <span className="text-sm font-black text-[#D97706]">{speedLabelAr(item.speed)}</span>
                            </div>
                            <Slider
                              value={[Math.round(item.speed * 100)]}
                              onValueChange={([v]) =>
                                updateItem(item.id, {
                                  speed: Math.min(1.05, Math.max(0.6, (v ?? 85) / 100)),
                                })
                              }
                              min={60}
                              max={105}
                              step={1}
                              className="w-full pt-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex justify-between text-[11px] font-bold text-[#94a3b8]">
                              <span>سريع</span>
                              <span>بطيء</span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* تصحيح */}
                      <section className="mb-8 pb-8 border-b border-dashed border-[#E5E7EB]" dir="rtl">
                        <h3 className="font-black text-[#0f2918] text-right mb-4">إعدادات التصحيح</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <ToggleCell
                            label="تجاهل الحركات"
                            hint="الفتحة، الضمة، الكسرة، السكون"
                            checked={item.grading.ignoreDiacritics}
                            onCheckedChange={(v) => updateGrading(item.id, { ignoreDiacritics: v })}
                          />
                          <ToggleCell
                            label="تجاهل التنوين"
                            hint="تنوين الضم، الفتح، الكسر"
                            checked={item.grading.ignoreTanween}
                            onCheckedChange={(v) => updateGrading(item.id, { ignoreTanween: v })}
                          />
                          <ToggleCell
                            label="تجاهل الشدة"
                            hint="مُدرِّس ≈ مدّرس"
                            checked={item.grading.ignoreShadda}
                            onCheckedChange={(v) => updateGrading(item.id, { ignoreShadda: v })}
                          />
                          <ToggleCell
                            label="تجاهل الترقيم"
                            hint="الفواصل، النقاط، علامات الاستفهام"
                            checked={item.grading.ignorePunctuation}
                            onCheckedChange={(v) => updateGrading(item.id, { ignorePunctuation: v })}
                          />
                        </div>
                        <div className="mt-5 space-y-3 text-right rounded-[12px] border bg-[#faf8f6] overflow-hidden" style={{ borderColor: COLOR_CARD_BORDER }}>
                          <label className="flex items-center justify-between gap-3 p-4 border-b bg-white" style={{ borderColor: COLOR_CARD_BORDER }}>
                            <span className="text-sm font-bold text-[#0f2918]">السماح بالأخطاء الإملائية البسيطة</span>
                            <Switch
                              checked={item.grading.allowErrors}
                              onCheckedChange={(v) => updateGrading(item.id, { allowErrors: v })}
                              className="data-[state=checked]:bg-[#14532D]"
                            />
                          </label>
                          {item.grading.allowErrors && (
                            <>
                              <div className="p-4 space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                  <span className="text-[#64748B]">نسبة التسامح في الأخطاء</span>
                                  <span className="text-[#D97706]">{item.grading.tolerancePercent}%</span>
                                </div>
                                <Slider
                                  value={[item.grading.tolerancePercent]}
                                  onValueChange={([v]) => updateGrading(item.id, { tolerancePercent: v ?? 0 })}
                                  max={30}
                                  step={1}
                                  className="pt-2"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex justify-between text-[10px] font-bold text-[#94a3b8]">
                                  <span>30%</span>
                                  <span>0%</span>
                                </div>
                              </div>
                              <div className="p-4 mx-4 mb-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/70 text-[#78350f] text-sm leading-relaxed">
                                <p className="font-black mb-2">مثال</p>
                                <p className="text-[13px]">
                                  لو النسبة 15٪ وفُعِّل السماح بالأخطاء، قد تقبل المنصّة كلمة واحدة مختلفة بحرف واحد تقريباً في جملة أقصر،
                                  ومزيدًا من التنويع أو الحذف/الإضافة في النص الطويل. يُقيَّم ذلك حسب عدد المحارف المتباينة بين إجابة الطالب
                                  والإملاء الأصلي (بعد تطبيق خيارات التجاهل أعلاه).
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </section>

                      {/* معاينة */}
                      <section dir="rtl" className="text-right">
                        {(() => {
                          const played = previewPlayedByItem[item.id] || 0;
                          const listensLeftUi = Math.max(0, item.maxListens - played);
                          const key = `student-${item.id}`;
                          const isStudentSpeaking = speakingId === key;
                          return (
                        <div className="rounded-[12px] p-6 text-white shadow-lg" style={{ backgroundColor: "#0c301c", border: `1px solid ${COLOR_PRIMARY}` }}>
                          <p className="text-sm font-black text-amber-200 text-right mb-4">معاينة — كيف يراها الطالب</p>
                          <p className="text-center text-sm font-black text-[#fcd34d] mb-6">
                            السؤال {i + 1} من {items.length}
                          </p>
                          <p className="text-center text-xl sm:text-2xl font-black leading-relaxed mb-6 px-2">{STUDENT_PROMPT_AR}</p>
                          <div className="flex flex-col items-center gap-2">
                            <button
                              type="button"
                              disabled={(listensLeftUi <= 0 && !isStudentSpeaking) || !item.text.trim()}
                              className={`w-full max-w-sm py-4 rounded-2xl text-lg font-black shadow-lg transition-transform active:scale-[0.98] border-solid ${
                                isStudentSpeaking
                                  ? "bg-orange-700 border-2 border-orange-500 text-white animate-pulse"
                                  : listensLeftUi <= 0
                                    ? "bg-[#475569] border-2 border-[#64748b] text-white/50 cursor-not-allowed"
                                    : "bg-orange-600 hover:bg-orange-500 border-2 border-orange-400 text-white"}
                              `}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!item.text.trim()) {
                                  toast.error("أضف نصاً لسماع المعاينة");
                                  return;
                                }
                                const wasPlaying = speakingId === key;
                                void previewTts(key, item.text, item.speed);
                                if (!wasPlaying) bumpPreviewPlay(item.id);
                              }}
                            >
                              {isStudentSpeaking ? "🔊 يتشغّل..." : "استمع 🔊"}
                            </button>
                            <span className="text-sm font-bold text-white/70">متبقي {listensLeftUi} استماع</span>
                          </div>
                          <input
                            type="text"
                            readOnly
                            placeholder="اكتب ما سمعته هنا..."
                            className="w-full mt-6 px-5 py-4 rounded-xl border-2 bg-white text-[#0f2918] font-bold text-center cursor-default border-white/70"
                          />
                        </div>
                          );
                        })()}
                      </section>
                    </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={addItem}
            className="w-full py-4 rounded-[12px] border-2 font-black text-[#14532D] hover:bg-[#ecfdf5] transition-colors bg-white shadow-sm flex items-center justify-center gap-2"
            style={{ borderColor: "#14532D" }}
          >
            <Plus className="w-5 h-5" /> + إضافة جملة جديدة
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
          <h2 className="text-xl font-black text-[#0f2918] text-right">النشر</h2>
          <div className="rounded-[12px] p-5 bg-white border text-right shadow-sm space-y-2" style={{ borderColor: COLOR_CARD_BORDER }}>
            <p className="font-black text-[#14532D]">{title}</p>
            <p className="text-xs text-[#64748B]">{items.length} جملة</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsShared(false)}
              className={`rounded-[12px] border-2 p-4 text-right ${!isShared ? "border-[#14532d] bg-[#ecfdf5]" : "bg-white opacity-95"}`}
              style={{ borderColor: COLOR_CARD_BORDER }}
            >
              <p className="font-black text-[#0f2918]">خاص</p>
              <p className="text-xs text-muted-foreground mt-1">لصفوفك ومتابعتك فقط</p>
            </button>
            <button
              type="button"
              onClick={() => setIsShared(true)}
              className={`rounded-[12px] border-2 p-4 text-right ${isShared ? "border-[#14532d] bg-[#ecfdf5]" : "bg-white opacity-95"}`}
              style={{ borderColor: COLOR_CARD_BORDER }}
            >
              <p className="font-black text-[#0f2918]">عام</p>
              <p className="text-xs text-muted-foreground mt-1">يظهر في استكشاف الطلاب</p>
            </button>
          </div>
        </div>
      )}

      {/* Fixed bottom */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3" style={{ borderColor: COLOR_CARD_BORDER }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 relative dir-rtl flex-row-reverse">
          <button
            type="button"
            onClick={footerPrimaryAction}
            disabled={step === 3 && createMutation.isPending}
            className="rounded-[12px] px-5 py-3 text-sm font-black text-white shrink-0 min-w-[8rem]"
            style={{ backgroundColor: COLOR_PRIMARY }}
          >
            {step === 3 ? (
              createMutation.isPending ? (
                "... جارٍ النشر"
              ) : (
              <>
                نشر الإملاء <span aria-hidden>🚀</span>
              </>
            )
            ) : step === 2 ? (
              "حفظ السؤال 💾"
            ) : (
              "التالي ›"
            )}
          </button>
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-black text-[#374151] whitespace-nowrap hidden sm:block">
            {step === 2 ? `السؤال ${activeIndex + 1} من ${items.length}` : step === 1 ? "" : `${items.length} جملات`}
          </p>
          <button type="button" onClick={footerBack} className="text-[#64748b] hover:text-[#14532d] font-bold text-sm flex items-center gap-1 shrink-0">
            رجوع <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
        {/* mobile center */}
        {step === 2 && (
          <p className="sm:hidden text-center text-xs font-black text-[#64748b] mt-2">السؤال {activeIndex + 1} من {items.length}</p>
        )}
      </footer>
    </div>
  );
}
