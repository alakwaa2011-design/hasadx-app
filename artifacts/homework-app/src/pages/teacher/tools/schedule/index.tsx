import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Calendar, Coffee, Clock3, Trash2, Pencil, Image as ImageIcon, Plus, 
  UploadCloud, AlertTriangle, FileWarning, Loader2, ArrowRight, ArrowLeft,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { creditAwareFetch, isInsufficientCreditsResponse } from "@/lib/credit-aware-fetch";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import {
  getListTeacherScheduleQueryKey,
  useListTeacherSchedule,
  useCreateTeacherScheduleEntry,
  useBulkCreateTeacherSchedule,
  useUpdateTeacherScheduleEntry,
  useDeleteTeacherSchedule,
  useDeleteTeacherScheduleEntry,
  type TeacherScheduleEntry,
  type TeacherScheduleEntryInput,
  type TeacherScheduleBulkInput,
} from "@workspace/api-client-react";

const BASE = (import.meta as any).env?.VITE_API_URL || "";

const C = {
  green: "#1E4D35",
  greenPale: "rgba(30,77,53,0.07)",
  gold: "#C9920A",
  goldBright: "#E8A80E",
  goldPale: "rgba(201,146,10,0.10)",
  bg: "#F2F0EB",
  surface: "#F7F5F1",
  card: "#FFFFFF",
  border: "rgba(20,35,25,0.07)",
  text: "#13201A",
  text2: "#3D4A42",
  muted: "#6E7B73",
  subtle: "#A3ADA7",
};

const SHADOW = {
  card: "0 1px 2px rgba(19,32,26,0.045), 0 12px 32px -20px rgba(19,32,26,0.22)",
};

const schedulePrimaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "9px 14px",
  background: C.green,
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
};

const scheduleSecondaryButton: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "8px 12px",
  background: C.surface,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const scheduleIconButton: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: C.subtle,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const SCHEDULE_DAYS = [
  { value: 0, ar: "الأحد", en: "Sun" },
  { value: 1, ar: "الاثنين", en: "Mon" },
  { value: 2, ar: "الثلاثاء", en: "Tue" },
  { value: 3, ar: "الأربعاء", en: "Wed" },
  { value: 4, ar: "الخميس", en: "Thu" },
  { value: 5, ar: "الجمعة", en: "Fri" },
  { value: 6, ar: "السبت", en: "Sat" },
];

function getApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = (error as any).data;
  if (!data || typeof data !== "object" || !("message" in data)) return null;
  return typeof data.message === "string" ? data.message : null;
}

type ScheduleConflictDetails = {
  dayOfWeek?: number | null;
  lessonNumber?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  conflictingTitle?: string | null;
  conflictingStartTime?: string | null;
  conflictingEndTime?: string | null;
};

function getScheduleConflict(error: unknown): ScheduleConflictDetails | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = (error as any).data;
  if (!data || typeof data !== "object" || !("conflict" in data)) return null;
  const conflict = data.conflict;
  return conflict && typeof conflict === "object"
    ? conflict as ScheduleConflictDetails
    : null;
}

const ARABIC_LESSON_NUMBERS = [
  "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة",
  "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة",
];

function lessonNumberLabel(number: number | null | undefined, isAr: boolean) {
  if (!number) return isAr ? "حصة" : "Lesson";
  return isAr
    ? `الحصة ${ARABIC_LESSON_NUMBERS[number - 1] || number}`
    : `Lesson ${number}`;
}

function breakPositionLabel(number: number | null | undefined, isAr: boolean) {
  if (number === 0) return "";
  if (number == null) return isAr ? "الموقع في الجدول" : "Schedule position";
  return isAr
    ? `الفترة ${ARABIC_LESSON_NUMBERS[number - 1] || number}`
    : `Period ${number}`;
}

function schedulePosition(entry: TeacherScheduleEntry) {
  return entry.kind === "break"
    ? (entry.breakAfterLesson ?? 0) + 0.5
    : (entry.lessonNumber ?? 99);
}

function scheduleDateLabel(date: string, isAr: boolean) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat(isAr ? "ar-KW" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function getLocalDateInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

type ScheduleFormValues = {
  kind: "weekly" | "appointment" | "break";
  title: string;
  subject: string;
  className: string;
  dayOfWeek: string;
  lessonNumber: string;
  breakAfterLesson: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

const emptyScheduleForm = (): ScheduleFormValues => ({
  kind: "weekly",
  title: "",
  subject: "",
  className: "",
  dayOfWeek: String(new Date().getDay()),
  lessonNumber: "1",
  breakAfterLesson: "1",
  appointmentDate: getLocalDateInput(),
  startTime: "08:00",
  endTime: "09:00",
  location: "",
  notes: "",
});

type BulkScheduleFormValues = {
  lessons: Array<{
    lessonNumber: number;
    title: string;
    subject: string;
    className: string;
    startTime: string;
    endTime: string;
    confidence?: "high" | "medium" | "low";
  }>;
};

type BulkBreakDraft = {
  title: string;
  breakAfterLesson: number;
  startTime: string;
  endTime: string | null;
  confidence: "high" | "medium" | "low";
};

type ExtractedScheduleDay = {
  dayOfWeek: number;
  lessons: Array<{
    lessonNumber: number;
    title: string;
    subject: string | null;
    className: string | null;
    startTime: string;
    endTime: string | null;
    confidence: "high" | "medium" | "low";
  }>;
  breaks?: BulkBreakDraft[];
};

function emptyBulkLessons(count = 5): BulkScheduleFormValues["lessons"] {
  return Array.from({ length: count }, (_, index) => ({
    lessonNumber: index + 1,
    title: "",
    subject: "",
    className: "",
    startTime: `${String(8 + index).padStart(2, "0")}:00`,
    endTime: `${String(9 + index).padStart(2, "0")}:00`,
  }));
}

function normalizeImportedDaySchedules(daySchedules: ExtractedScheduleDay[]) {
  const schedules: Record<number, BulkScheduleFormValues["lessons"]> = {};
  const breaks: Record<number, BulkBreakDraft[]> = {};
  let hasNumberingGaps = false;

  daySchedules.forEach((daySchedule) => {
    const lessonsByNumber = [...daySchedule.lessons].sort((left, right) => left.lessonNumber - right.lessonNumber);
    if (lessonsByNumber.some((lesson, index) => lesson.lessonNumber !== index + 1)) {
      hasNumberingGaps = true;
    }
    schedules[daySchedule.dayOfWeek] = [...daySchedule.lessons]
      .sort((left, right) => left.startTime.localeCompare(right.startTime))
      .map((extracted) => ({
      lessonNumber: extracted.lessonNumber,
      title: extracted.title || extracted.subject || extracted.className || "",
      subject: extracted.subject || "",
      className: extracted.className || "",
      startTime: extracted.startTime,
      endTime: extracted.endTime || "",
      confidence: extracted.confidence,
    }));
    breaks[daySchedule.dayOfWeek] = [...(daySchedule.breaks || [])]
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  });

  return { schedules, breaks, hasNumberingGaps };
}

function buildTeacherScheduleBulkInput(
  schedules: Record<number, BulkScheduleFormValues["lessons"]>,
  isAr: boolean,
  breaks: Record<number, BulkBreakDraft[]> = {},
): TeacherScheduleBulkInput {
  return {
    daySchedules: Object.entries(schedules)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([day, lessons]) => ({
        dayOfWeek: Number(day),
        lessons: lessons.map((lesson) => ({
          lessonNumber: lesson.lessonNumber,
          title: lesson.title.trim()
            || lesson.subject.trim()
            || lesson.className.trim()
            || (lesson.confidence ? "" : lessonNumberLabel(lesson.lessonNumber, isAr)),
          subject: lesson.subject.trim() || null,
          className: lesson.className.trim() || null,
          startTime: lesson.startTime,
          endTime: lesson.endTime || null,
        })),
        breaks: (breaks[Number(day)] || []).map((entry) => ({
          title: entry.title.trim(),
          breakAfterLesson: entry.breakAfterLesson,
          startTime: entry.startTime,
          endTime: entry.endTime || null,
        })),
      })),
  };
}

function ScheduleEntryRow({
  entry,
  isAr,
  isLast,
  onEdit,
  onDelete,
}: {
  entry: TeacherScheduleEntry;
  isAr: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-testid={`schedule-entry-${entry.id}`}
      data-schedule-kind={entry.kind}
      data-schedule-day={entry.dayOfWeek ?? undefined}
      data-schedule-position={schedulePosition(entry)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "10px 0",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: entry.kind === "appointment" ? C.goldPale : entry.kind === "break" ? "#FFF4D6" : C.greenPale,
          color: entry.kind === "appointment" ? C.gold : entry.kind === "break" ? C.gold : C.green,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {entry.kind === "appointment"
          ? <Calendar style={{ width: 19, height: 19 }} />
          : entry.kind === "break"
            ? <Coffee style={{ width: 19, height: 19 }} />
            : <Clock3 style={{ width: 19, height: 19 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 850, color: C.text }}>{entry.title}</span>
          {entry.kind === "break" && Boolean(entry.breakAfterLesson) && (
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 850 }}>
              {breakPositionLabel(entry.breakAfterLesson, isAr)}
            </span>
          )}
          {entry.kind === "weekly" && entry.lessonNumber && (
            <span style={{ fontSize: 11, color: C.green, fontWeight: 850 }}>
              {lessonNumberLabel(entry.lessonNumber, isAr)}
            </span>
          )}
          {entry.kind === "appointment" && entry.appointmentDate && (
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 800 }}>
              {scheduleDateLabel(entry.appointmentDate, isAr)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.subtle, marginTop: 4, display: "flex", gap: 7, flexWrap: "wrap" }}>
          <span>{entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ""}</span>
          {entry.className && <span>• {entry.className}</span>}
          {entry.location && <span>• {entry.location}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={isAr ? "تعديل" : "Edit"}
          style={scheduleIconButton}
        >
          <Pencil style={{ width: 15, height: 15 }} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={isAr ? "حذف" : "Delete"}
          style={{ ...scheduleIconButton, color: "#B42318" }}
        >
          <Trash2 style={{ width: 15, height: 15 }} />
        </button>
      </div>
    </div>
  );
}

export default function ScheduleManagementPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [bulkLessonCount, setBulkLessonCount] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (importPreview) URL.revokeObjectURL(importPreview);
    };
  }, [importPreview]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(isAr ? "استخدم صورة JPG أو PNG أو WebP" : "Use a JPG, PNG, or WebP image");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? "حجم الصورة يجب أن لا يتجاوز 10 ميجابايت" : "Image size must not exceed 10MB");
      e.target.value = "";
      return;
    }
    setImportFile(file);
    const url = URL.createObjectURL(file);
    setImportPreview(url);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleExtract() {
    if (!importFile) return;
    setIsExtracting(true);
    const formData = new FormData();
    formData.append("files", importFile);
    formData.append("language", isAr ? "ar" : "en");

    try {
      const res = await creditAwareFetch(`${BASE}/api/teacher/schedule/ai/extract`, {
        method: "POST",
        headers: {
          "X-Idempotency-Key": crypto.randomUUID(),
        },
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) {
          return;
        }
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : isAr ? "تعذر استخراج الجدول" : "Could not extract schedule",
        );
      }

      const data = await res.json() as { daySchedules?: ExtractedScheduleDay[]; warnings?: unknown[] };
      if (!Array.isArray(data.daySchedules) || data.daySchedules.length === 0) {
        throw new Error(isAr ? "لم يتم العثور على حصص واضحة في الصورة" : "No clear lessons were found in the image");
      }

      const firstDay = data.daySchedules?.[0]?.dayOfWeek ?? new Date().getDay();
      const {
        schedules: newSchedules,
        breaks: newBreaks,
        hasNumberingGaps,
      } = normalizeImportedDaySchedules(data.daySchedules);

      setBulkDaySchedules(newSchedules);
      setBulkDayBreaks(newBreaks);
      setActiveBulkDay(firstDay);
      const lessons = newSchedules[firstDay] || emptyBulkLessons(5);
      setBulkLessonCount(lessons.length);
      bulkForm.reset({ lessons });
      setImportWarnings([
        ...(Array.isArray(data.warnings) ? data.warnings.filter((warning: unknown) => typeof warning === "string") : []),
        ...(hasNumberingGaps
          ? [isAr
              ? "حُفظت أرقام الحصص كما ظهرت في الصورة، بما فيها الفترات الفارغة بين الحصص."
              : "Lesson numbers were preserved as shown, including free periods between lessons."]
          : []),
      ]);
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setBulkDialogOpen(true);

      toast.success(isAr ? "تم الاستخراج — راجع الجدول قبل الحفظ" : "Extracted — review the schedule before saving");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isAr ? "تعذر استخراج الجدول" : "Could not extract schedule",
      );
    } finally {
      refreshCreditsBalance();
      setIsExtracting(false);
    }
  }

  const [activeBulkDay, setActiveBulkDay] = useState(() => new Date().getDay());
  const [bulkDaySchedules, setBulkDaySchedules] = useState<Record<number, BulkScheduleFormValues["lessons"]>>({});
  const [bulkDayBreaks, setBulkDayBreaks] = useState<Record<number, BulkBreakDraft[]>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const form = useForm<ScheduleFormValues>({
    defaultValues: emptyScheduleForm(),
  });
  const bulkForm = useForm<BulkScheduleFormValues>({
    defaultValues: {
      lessons: emptyBulkLessons(),
    },
  });
  const bulkLessonFields = useFieldArray({
    control: bulkForm.control,
    name: "lessons",
  });
  const selectedKind = form.watch("kind");
  
  const scheduleQuery = useListTeacherSchedule({
    query: {
      queryKey: getListTeacherScheduleQueryKey(),
    },
  });
  const refreshCreditsBalance = useRefreshCreditsBalance();
  const createMutation = useCreateTeacherScheduleEntry();
  const bulkMutation = useBulkCreateTeacherSchedule();
  const updateMutation = useUpdateTeacherScheduleEntry();
  const deleteAllMutation = useDeleteTeacherSchedule();
  const deleteMutation = useDeleteTeacherScheduleEntry();
  const entries = scheduleQuery.data || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isBulkSaving = bulkMutation.isPending;

  const weeklyEntries = useMemo(
    () =>
      entries
        .filter((entry) => (entry.kind === "weekly" || entry.kind === "break") && entry.dayOfWeek === selectedDay)
        .sort((a, b) =>
          a.startTime.localeCompare(b.startTime) ||
          schedulePosition(a) - schedulePosition(b),
        ),
    [entries, selectedDay],
  );
  const weeklyGroups = useMemo(
    () =>
      SCHEDULE_DAYS.map((day) => ({
        day,
        entries: entries
          .filter((entry) => (entry.kind === "weekly" || entry.kind === "break") && entry.dayOfWeek === day.value)
          .sort((a, b) =>
            a.startTime.localeCompare(b.startTime) ||
            schedulePosition(a) - schedulePosition(b),
          ),
      })).filter((group) => group.entries.length > 0),
    [entries],
  );

  const appointments = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.kind === "appointment" &&
            Boolean(entry.appointmentDate),
        )
        .sort((a, b) => {
          const dateOrder = (a.appointmentDate || "").localeCompare(b.appointmentDate || "");
          return dateOrder || a.startTime.localeCompare(b.startTime);
        }),
    [entries],
  );

  const refreshSchedule = () =>
    queryClient.invalidateQueries({ queryKey: getListTeacherScheduleQueryKey() });

  function openCreate(kind: ScheduleFormValues["kind"] = "weekly") {
    const defaults = emptyScheduleForm();
    form.reset({
      ...defaults,
      kind,
      title: "",
    });
    setEditingId(null);
    setDialogOpen(true);
  }

  function openBulkCreate() {
    const currentDay = new Date().getDay();
    const lessons = emptyBulkLessons(5);
    setBulkLessonCount(5);
    setActiveBulkDay(currentDay);
    setBulkDaySchedules({ [currentDay]: lessons });
    setBulkDayBreaks({});
    setImportWarnings([]);
    bulkForm.reset({
      lessons,
    });
    setBulkDialogOpen(true);
  }

  function changeBulkLessonCount(nextCount: number) {
    const currentLessons = bulkForm.getValues("lessons");
    const currentCount = currentLessons.length;
    if (nextCount > currentCount) {
      const usedNumbers = new Set(currentLessons.map((lesson) => lesson.lessonNumber));
      const availableNumbers = Array.from({ length: 30 }, (_, index) => index + 1)
        .filter((number) => !usedNumbers.has(number))
        .slice(0, nextCount - currentCount);
      const addedLessons = availableNumbers.map((lessonNumber) => ({
        ...emptyBulkLessons(lessonNumber)[lessonNumber - 1],
        lessonNumber,
      }));
      bulkLessonFields.replace(
        [...currentLessons, ...addedLessons].sort((left, right) => left.lessonNumber - right.lessonNumber),
      );
    } else if (nextCount < currentCount) {
      bulkLessonFields.replace(
        [...currentLessons]
          .sort((left, right) => left.lessonNumber - right.lessonNumber)
          .slice(0, nextCount),
      );
    }
    setBulkLessonCount(nextCount);
  }

  function selectBulkDay(day: number) {
    if (day === activeBulkDay) return;
    const currentLessons = bulkForm.getValues("lessons");
    const nextLessons = bulkDaySchedules[day] || emptyBulkLessons(5);
    setBulkDaySchedules((current) => ({
      ...current,
      [activeBulkDay]: currentLessons,
      [day]: current[day] || nextLessons,
    }));
    setActiveBulkDay(day);
    setBulkLessonCount(nextLessons.length);
    bulkForm.reset({ lessons: nextLessons });
  }

  function selectAllBulkDays() {
    const currentLessons = bulkForm.getValues("lessons");
    setBulkDaySchedules((current) => {
      const next = { ...current, [activeBulkDay]: currentLessons };
      SCHEDULE_DAYS.forEach(({ value }) => {
        next[value] ||= emptyBulkLessons(5);
      });
      return next;
    });
  }

  function removeActiveBulkDay() {
    const configuredDays = Object.keys(bulkDaySchedules).map(Number);
    if (configuredDays.length <= 1) return;
    const nextDay = configuredDays.find((day) => day !== activeBulkDay)!;
    const nextSchedules = { ...bulkDaySchedules };
    delete nextSchedules[activeBulkDay];
    setBulkDayBreaks((current) => {
      const next = { ...current };
      delete next[activeBulkDay];
      return next;
    });
    const nextLessons = nextSchedules[nextDay];
    setBulkDaySchedules(nextSchedules);
    setActiveBulkDay(nextDay);
    setBulkLessonCount(nextLessons.length);
    bulkForm.reset({ lessons: nextLessons });
  }

  function updateBulkBreak(index: number, patch: Partial<BulkBreakDraft>) {
    setBulkDayBreaks((current) => ({
      ...current,
      [activeBulkDay]: (current[activeBulkDay] || []).map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  }

  function addBulkBreak() {
    if ((bulkDayBreaks[activeBulkDay] || []).length >= 50) return;
    const lessons = bulkForm.getValues("lessons");
    const afterLesson = lessons[Math.max(0, Math.floor(lessons.length / 2) - 1)]?.lessonNumber || 1;
    setBulkDayBreaks((current) => ({
      ...current,
      [activeBulkDay]: [
        ...(current[activeBulkDay] || []),
        {
          title: "",
          breakAfterLesson: Math.min(afterLesson, 30),
          startTime: "",
          endTime: null,
          confidence: "high",
        },
      ],
    }));
  }

  function removeBulkBreak(index: number) {
    setBulkDayBreaks((current) => ({
      ...current,
      [activeBulkDay]: (current[activeBulkDay] || []).filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function openEdit(entry: TeacherScheduleEntry) {
    form.reset({
      kind: entry.kind,
      title: entry.title,
      subject: entry.subject || "",
      className: entry.className || "",
      dayOfWeek: entry.dayOfWeek == null ? String(new Date().getDay()) : String(entry.dayOfWeek),
      lessonNumber: entry.lessonNumber == null ? "1" : String(entry.lessonNumber),
      breakAfterLesson: entry.breakAfterLesson == null ? "1" : String(entry.breakAfterLesson),
      appointmentDate: entry.appointmentDate || getLocalDateInput(),
      startTime: entry.startTime,
      endTime: entry.endTime || "",
      location: entry.location || "",
      notes: entry.notes || "",
    });
    setEditingId(entry.id);
    setDialogOpen(true);
  }

  function submitSchedule(values: ScheduleFormValues) {
    const fallbackTitle = values.kind === "weekly"
      ? lessonNumberLabel(Number(values.lessonNumber), isAr)
      : values.kind === "break"
        ? (isAr ? "فترة" : "Period")
        : (isAr ? "موعد" : "Appointment");
    const payload: TeacherScheduleEntryInput = {
      kind: values.kind,
      title: values.title.trim() || fallbackTitle,
      subject: values.subject.trim() || null,
      className: values.className.trim() || null,
      dayOfWeek: values.kind === "appointment" ? null : Number(values.dayOfWeek),
      lessonNumber: values.kind === "weekly" ? Number(values.lessonNumber) : null,
      breakAfterLesson: values.kind === "break" ? Number(values.breakAfterLesson) : null,
      appointmentDate: values.kind === "appointment" ? values.appointmentDate : null,
      startTime: values.startTime,
      endTime: values.endTime || null,
      location: values.location.trim() || null,
      notes: values.notes.trim() || null,
    };

    const onSuccess = () => {
      setDialogOpen(false);
      setEditingId(null);
      form.reset(emptyScheduleForm());
      refreshSchedule();
      toast.success(isAr ? "تم حفظ الجدول" : "Schedule saved");
    };
    const onError = (error: Error) => {
      const message = getApiErrorMessage(error);
      if (getScheduleConflict(error)) {
        const fieldMessage = message || (isAr ? "هذا الوقت متعارض مع إدخال آخر" : "This time overlaps another entry");
        form.setError("startTime", { type: "server", message: fieldMessage });
        form.setError("endTime", { type: "server", message: fieldMessage });
      }
      toast.error(
        message
        || (isAr ? "تعذر حفظ الجدول. صحح البيانات وحاول مجددًا" : "Could not save the schedule. Correct the details and try again"),
      );
    };

    if (editingId != null) {
      updateMutation.mutate({ id: editingId, data: payload }, { onSuccess, onError });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess, onError });
    }
  }

  function submitBulkSchedule(values: BulkScheduleFormValues) {
    const schedules = {
      ...bulkDaySchedules,
      [activeBulkDay]: values.lessons,
    };
    for (const [day, lessons] of Object.entries(schedules)) {
      const invalidIndex = lessons.findIndex((lesson) =>
        (!(lesson.title.trim() || lesson.subject.trim() || lesson.className.trim()) && Boolean(lesson.confidence))
        || !lesson.startTime
        || (Boolean(lesson.endTime) && lesson.endTime <= lesson.startTime),
      );
      if (invalidIndex >= 0) {
        const targetDay = Number(day);
        const targetLessons = schedules[targetDay];
        const invalidLesson = targetLessons[invalidIndex];
        const hasVisibleName = Boolean(
          invalidLesson.title.trim()
          || invalidLesson.subject.trim()
          || invalidLesson.className.trim()
          || !invalidLesson.confidence,
        );
        const fieldName = !hasVisibleName ? "title" : !invalidLesson.startTime ? "startTime" : "endTime";
        const fieldMessage = !hasVisibleName
          ? (isAr ? "اكتب الاسم الموجود في الجدول" : "Enter the name shown in the schedule")
          : !invalidLesson.startTime
          ? (isAr ? "حدد وقت بداية هذه الحصة" : "Enter this lesson's start time")
          : (isAr ? "وقت النهاية يجب أن يكون بعد وقت البداية" : "End time must be after start time");
        setBulkDaySchedules(schedules);
        setActiveBulkDay(targetDay);
        setBulkLessonCount(targetLessons.length);
        bulkForm.reset({ lessons: targetLessons });
        bulkForm.setError(`lessons.${invalidIndex}.${fieldName}`, { type: "validate", message: fieldMessage });
        toast.error(
          isAr
            ? `راجع ${SCHEDULE_DAYS.find((item) => item.value === targetDay)?.ar} — ${lessonNumberLabel(invalidLesson.lessonNumber, true)}`
            : `Check ${SCHEDULE_DAYS.find((item) => item.value === targetDay)?.en} — ${lessonNumberLabel(invalidLesson.lessonNumber, false)}`,
        );
        return;
      }
    }
    for (const [day, breaks] of Object.entries(bulkDayBreaks)) {
      const invalidBreak = breaks.find((entry) =>
        !entry.title.trim()
        || !entry.startTime
        || (Boolean(entry.endTime) && entry.endTime! <= entry.startTime),
      );
      if (invalidBreak) {
        const targetDay = Number(day);
        const currentLessons = bulkForm.getValues("lessons");
        const schedulesWithCurrentDay = {
          ...bulkDaySchedules,
          [activeBulkDay]: currentLessons,
        };
        const targetLessons = schedulesWithCurrentDay[targetDay] || [];
        setBulkDaySchedules(schedulesWithCurrentDay);
        setActiveBulkDay(targetDay);
        setBulkLessonCount(targetLessons.length);
        bulkForm.reset({ lessons: targetLessons });
        toast.error(
          isAr
            ? "راجع اسم الفترة ووقتها كما يظهران في الجدول"
            : "Check the period name and time as shown in the schedule",
        );
        return;
      }
    }
    const payload = buildTeacherScheduleBulkInput(schedules, isAr, bulkDayBreaks);

    bulkMutation.mutate(
      { data: payload },
      {
        onSuccess: (created) => {
          setBulkDialogOpen(false);
          refreshSchedule();
          toast.success(
            isAr
              ? `تمت إضافة ${created.length} فترة في الجدول`
              : `${created.length} periods added to the schedule`,
          );
        },
        onError: (error) => {
          const message = getApiErrorMessage(error);
          const conflict = getScheduleConflict(error);
          if (conflict?.dayOfWeek != null && conflict.lessonNumber != null) {
            const currentLessons = bulkForm.getValues("lessons");
            const schedules = {
              ...bulkDaySchedules,
              [activeBulkDay]: currentLessons,
            };
            const targetLessons = schedules[conflict.dayOfWeek];
            const targetIndex = targetLessons?.findIndex((lesson) => lesson.lessonNumber === conflict.lessonNumber) ?? -1;
            if (targetLessons?.[targetIndex]) {
              const conflictingTime = [conflict.conflictingStartTime, conflict.conflictingEndTime]
                .filter(Boolean)
                .join("–");
              const fieldMessage = isAr
                ? `يتعارض مع ${conflict.conflictingTitle || "إدخال آخر"}${conflictingTime ? ` (${conflictingTime})` : ""}`
                : `Overlaps ${conflict.conflictingTitle || "another entry"}${conflictingTime ? ` (${conflictingTime})` : ""}`;
              setBulkDaySchedules(schedules);
              setActiveBulkDay(conflict.dayOfWeek);
              setBulkLessonCount(targetLessons.length);
              bulkForm.reset({ lessons: targetLessons });
              bulkForm.setError(`lessons.${targetIndex}.startTime`, { type: "server", message: fieldMessage });
              bulkForm.setError(`lessons.${targetIndex}.endTime`, { type: "server", message: fieldMessage });
            }
          }
          toast.error(
            message
            || (isAr ? "تعذر حفظ الجدول الكامل. صحح الأوقات وحاول مجددًا" : "Could not save the full schedule. Correct the times and try again"),
          );
        },
      },
    );
  }

  function removeEntry(entry: TeacherScheduleEntry) {
    const confirmed = window.confirm(
      isAr
        ? `حذف "${entry.title}" من الجدول؟`
        : `Remove "${entry.title}" from the schedule?`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(
      { id: entry.id },
      {
        onSuccess: () => {
          refreshSchedule();
          toast.success(isAr ? "تم حذف الإدخال" : "Schedule entry deleted");
        },
        onError: () => toast.error(isAr ? "تعذر حذف الإدخال" : "Could not delete the entry"),
      },
    );
  }

  function removeWholeSchedule() {
    deleteAllMutation.mutate(undefined, {
      onSuccess: ({ deletedCount }) => {
        setDeleteAllDialogOpen(false);
        refreshSchedule();
        toast.success(
          isAr
            ? `تم حذف الجدول كاملًا (${deletedCount} إدخال)`
            : `Full schedule deleted (${deletedCount} entries)`,
        );
      },
      onError: () => toast.error(isAr ? "تعذر حذف الجدول" : "Could not delete the schedule"),
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    height: 42,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    padding: "0 12px",
    outline: "none",
    fontSize: 14,
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl" dir={isAr ? "rtl" : "ltr"}>
        <div className="mb-8">
          <Link href="/teacher?tab=tools" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <BackArrow className="w-4 h-4 mr-2 ml-2" />
            {isAr ? "العودة للأدوات" : "Back to tools"}
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-green-50 text-green-700 shadow-sm border border-green-100/50">
                <Calendar className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-foreground">{isAr ? "إدارة الجدول" : "Schedule Management"}</h1>
                <p className="text-sm font-semibold text-muted-foreground mt-1">
                  {isAr ? "أضف حصصك الأسبوعية ومواعيدك بسهولة" : "Add your weekly classes and appointments easily"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleImageSelect}
              />
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteAllDialogOpen(true)}
                  data-testid="button-delete-whole-schedule"
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-bold border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2 ml-2" />
                  {isAr ? "حذف الجدول" : "Delete schedule"}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-import-schedule-image"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-bold border border-border bg-card hover:bg-muted/50 transition-colors shadow-sm"
              >
                <ImageIcon className="w-4 h-4 mr-2 ml-2 text-green-600" />
                {isAr ? "استيراد صورة" : "Import image"}
              </button>
              <button
                type="button"
                onClick={openBulkCreate}
                data-testid="button-add-bulk-schedule"
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-bold border border-border bg-card hover:bg-muted/50 transition-colors shadow-sm text-green-700"
              >
                {isAr ? "جدول كامل" : "Full table"}
              </button>
              <button
                type="button"
                onClick={() => openCreate()}
                data-testid="button-add-schedule-entry"
                className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-bold bg-green-700 text-white hover:bg-green-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2 ml-2" />
                {isAr ? "إضافة للإدخالات" : "Add entry"}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
          {scheduleQuery.isLoading ? (
            <div className="p-16 flex justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : scheduleQuery.isError ? (
            <div className="p-16 text-center text-muted-foreground font-semibold">
              {isAr ? "تعذر تحميل الجدول" : "Could not load the schedule"}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-foreground mb-2">
                {isAr ? "ابدأ بإضافة جدولك" : "Start building your schedule"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 font-semibold">
                {isAr 
                  ? "قم ببناء جدول حصصك الأسبوعية وتحديد فترات الاستراحة والمواعيد الفردية، لتبقى دائمًا على اطلاع بمهامك." 
                  : "Build your weekly class schedule, mark break periods, and add one-time appointments to stay on top of your day."}
              </p>
              
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openCreate("weekly")}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-bold bg-green-700 text-white hover:bg-green-800 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2 ml-2" />
                  {isAr ? "إضافة حصة أسبوعية" : "Add weekly class"}
                </button>
                <button
                  type="button"
                  onClick={openBulkCreate}
                  className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-bold border-2 border-green-700/20 text-green-700 bg-green-50/50 hover:bg-green-50 transition-colors"
                >
                  {isAr ? "إدخال جدول كامل" : "Enter full table"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="p-4 flex items-center justify-between border-b border-border/60 bg-muted/20">
                <span className="text-sm font-black text-muted-foreground px-2">
                  {isAr ? "طريقة العرض" : "View"}
                </span>
                <div className="flex gap-2 p-1 bg-card border border-border/60 rounded-xl shadow-sm">
                  {(["day", "week"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className="px-4 py-1.5 rounded-lg text-xs font-black transition-colors"
                      style={{
                        background: viewMode === mode ? C.greenPale : "transparent",
                        color: viewMode === mode ? C.green : C.subtle,
                      }}
                    >
                      {mode === "day" ? (isAr ? "عرض يومي" : "Daily view") : (isAr ? "عرض أسبوعي" : "Weekly view")}
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === "day" ? (
                <>
                   <div
                     className="grid grid-cols-4 gap-2 border-b border-border/60 bg-card p-3 sm:grid-cols-7 sm:p-4"
                     data-testid="schedule-management-day-selector"
                   >
                    {SCHEDULE_DAYS.map((day) => {
                      const count = entries.filter(
                        (entry) =>
                          (entry.kind === "weekly" || entry.kind === "break") &&
                          entry.dayOfWeek === day.value,
                      ).length;
                      const active = selectedDay === day.value;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setSelectedDay(day.value)}
                           className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-colors sm:p-3"
                          style={{
                            borderColor: active ? C.green : C.border,
                            background: active ? C.green : C.surface,
                            color: active ? "#fff" : C.subtle,
                          }}
                        >
                           <div className="min-w-0 text-xs font-black sm:text-sm">
                             <span className="sm:hidden">{isAr ? day.ar.slice(0, 3) : day.en}</span>
                             <span className="hidden sm:inline">{isAr ? day.ar : day.en}</span>
                          </div>
                          <div className="text-[10px] font-bold opacity-80 bg-black/10 px-2 py-0.5 rounded-full">
                             {count}<span className="hidden sm:inline"> {isAr ? "إدخال" : "entries"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-6 min-h-[300px]">
                    <div className="text-base font-black text-foreground mb-6 flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-green-600 rounded-full" />
                      {isAr ? SCHEDULE_DAYS[selectedDay].ar : SCHEDULE_DAYS[selectedDay].en}
                    </div>
                    
                    {weeklyEntries.length === 0 ? (
                      <div className="py-12 text-center text-sm font-semibold text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl">
                        {isAr ? "لا توجد حصة أو فترة مسجلة في هذا اليوم" : "No class or period registered on this day"}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {weeklyEntries.map((entry, index) => (
                          <ScheduleEntryRow
                            key={entry.id}
                            entry={entry}
                            isAr={isAr}
                            isLast={index === weeklyEntries.length - 1}
                            onEdit={() => openEdit(entry)}
                            onDelete={() => removeEntry(entry)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6">
                  {weeklyGroups.length === 0 ? (
                    <div className="py-12 text-center text-sm font-semibold text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl">
                      {isAr ? "لا توجد حصص أسبوعية مسجلة بعد" : "No weekly classes registered yet"}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {weeklyGroups.map(({ day, entries: dayEntries }) => (
                        <div key={day.value} className="bg-surface/30 rounded-2xl p-5 border border-border/40">
                          <div className="text-base font-black text-green-700 mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-green-500 rounded-full" />
                            {isAr ? day.ar : day.en}
                          </div>
                          <div className="space-y-1 bg-card rounded-xl p-2 border border-border/60 shadow-sm">
                            {dayEntries.map((entry, index) => (
                              <ScheduleEntryRow
                                key={entry.id}
                                entry={entry}
                                isAr={isAr}
                                isLast={index === dayEntries.length - 1}
                                onEdit={() => openEdit(entry)}
                                onDelete={() => removeEntry(entry)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {appointments.length > 0 && (
                <div className="p-6 border-t border-border/80 bg-amber-50/30">
                  <div className="text-base font-black text-foreground mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                    {isAr ? "جميع المواعيد" : "All appointments"}
                  </div>
                  <div className="space-y-1 bg-card rounded-xl p-2 border border-amber-200 shadow-sm">
                    {appointments.map((entry, index) => (
                      <ScheduleEntryRow
                        key={entry.id}
                        entry={entry}
                        isAr={isAr}
                        isLast={index === appointments.length - 1}
                        onEdit={() => openEdit(entry)}
                        onDelete={() => removeEntry(entry)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- ALL DIALOGS (kept exactly same, just rendered here) --- */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "حذف الجدول كاملًا؟" : "Delete the full schedule?"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-6" style={{ color: C.subtle }}>
            {isAr
              ? "سيتم حذف جميع الحصص والفترات غير الصفية والمواعيد المحفوظة. لا يمكن التراجع عن هذه العملية."
              : "All saved classes, non-lesson periods, and appointments will be deleted. This cannot be undone."}
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDeleteAllDialogOpen(false)}
              disabled={deleteAllMutation.isPending}
              style={scheduleSecondaryButton}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={removeWholeSchedule}
              disabled={deleteAllMutation.isPending}
              data-testid="button-confirm-delete-whole-schedule"
              style={{
                ...schedulePrimaryButton,
                background: "#B42318",
                opacity: deleteAllMutation.isPending ? 0.65 : 1,
              }}
            >
              {deleteAllMutation.isPending && <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />}
              {isAr ? "نعم، احذف الجدول" : "Yes, delete schedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
        <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col overflow-hidden rounded-3xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingId ? (isAr ? "تعديل الإدخال" : "Edit schedule entry") : (isAr ? "إضافة إلى الجدول" : "Add to schedule")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitSchedule)} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2 pe-1" data-testid="schedule-entry-scroll-region">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isAr ? "نوع الإدخال" : "Entry type"}</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-3 gap-2">
                        {(["weekly", "break", "appointment"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => field.onChange(kind)}
                            className="rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
                            style={{
                              borderColor: field.value === kind ? C.green : C.border,
                              background: field.value === kind ? C.greenPale : C.surface,
                              color: field.value === kind ? C.green : C.text,
                            }}
                          >
                            {kind === "weekly"
                              ? isAr ? "حصة أسبوعية" : "Weekly class"
                              : kind === "break"
                                ? isAr ? "فترة غير صفية" : "Non-lesson period"
                                : isAr ? "موعد منفرد" : "Appointment"}
                          </button>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{isAr ? "العنوان (اختياري)" : "Title (optional)"}</FormLabel>
                      <FormControl>
                        <input {...field} placeholder={isAr ? "سيُستخدم اسم تلقائي عند تركه فارغًا" : "An automatic title will be used if left blank"} style={fieldStyle} data-testid="input-schedule-title" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {selectedKind !== "appointment" ? (
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    rules={{ required: isAr ? "اختر اليوم" : "Choose a day" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "اليوم" : "Day"}</FormLabel>
                        <FormControl>
                          <select {...field} style={fieldStyle}>
                            {SCHEDULE_DAYS.map((day) => (
                              <option key={day.value} value={day.value}>{isAr ? day.ar : day.en}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="appointmentDate"
                    rules={{ required: isAr ? "اختر التاريخ" : "Choose a date" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "التاريخ" : "Date"}</FormLabel>
                        <FormControl>
                          <input {...field} type="date" style={fieldStyle} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {selectedKind === "weekly" && (
                  <FormField
                    control={form.control}
                    name="lessonNumber"
                    rules={{ required: isAr ? "اختر رقم الحصة" : "Choose the lesson number" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "رقم الحصة" : "Lesson number"}</FormLabel>
                        <FormControl>
                          <select {...field} style={fieldStyle}>
                            {Array.from({ length: 30 }, (_, index) => index + 1).map((number) => (
                              <option key={number} value={number}>
                                {lessonNumberLabel(number, isAr)}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {selectedKind === "break" && (
                  <FormField
                    control={form.control}
                    name="breakAfterLesson"
                    rules={{ required: isAr ? "اختر الحصة السابقة للاستراحة" : "Choose the preceding lesson" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "موقع الفترة في الجدول" : "Period position"}</FormLabel>
                        <FormControl>
                          <select {...field} style={fieldStyle}>
                            {Array.from({ length: 31 }, (_, index) => index).map((number) => (
                              <option key={number} value={number}>
                                {number === 0
                                  ? (isAr ? "بدون رقم ظاهر" : "No visible number")
                                  : breakPositionLabel(number, isAr)}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="startTime"
                    rules={{ required: isAr ? "مطلوب" : "Required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "من" : "From"}</FormLabel>
                        <FormControl><input {...field} type="time" style={fieldStyle} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isAr ? "إلى" : "To"}</FormLabel>
                        <FormControl><input {...field} type="time" style={fieldStyle} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isAr ? "المادة (اختياري)" : "Subject (optional)"}</FormLabel>
                      <FormControl><input {...field} style={fieldStyle} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="className"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isAr ? "الصف (اختياري)" : "Class (optional)"}</FormLabel>
                      <FormControl><input {...field} style={fieldStyle} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isAr ? "المكان (اختياري)" : "Location (optional)"}</FormLabel>
                      <FormControl><input {...field} style={fieldStyle} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</FormLabel>
                      <FormControl><textarea {...field} rows={2} style={{ ...fieldStyle, height: "auto", paddingTop: 9, paddingBottom: 9, resize: "vertical" }} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              </div>
              <DialogFooter className="shrink-0 border-t pt-3" style={{ borderColor: C.border, background: C.card }} data-testid="schedule-entry-fixed-actions">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  style={{ ...scheduleSecondaryButton, color: C.text }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  data-testid="button-save-schedule-entry"
                  style={{
                    ...schedulePrimaryButton,
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />}
                  {editingId ? (isAr ? "حفظ التعديل" : "Save changes") : (isAr ? "إضافة" : "Add entry")}
                </button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col overflow-hidden rounded-3xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{isAr ? "إدخال جدول كامل" : "Enter a full schedule"}</DialogTitle>
          </DialogHeader>
          {importWarnings.length > 0 && (
            <div
              className="max-h-[20dvh] shrink-0 overflow-y-auto flex items-start gap-3 rounded-2xl border p-3 text-xs leading-relaxed"
              style={{ borderColor: "rgba(217,119,6,0.3)", background: "#FFFBEB", color: "#92400E" }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-black">{isAr ? "ملاحظات من قراءة الصورة" : "Image-reading notes"}</div>
                <ul className="mt-1 list-inside list-disc space-y-1 font-semibold">
                  {importWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </div>
            </div>
          )}
          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(submitBulkSchedule)} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-2 pe-1" data-testid="bulk-schedule-scroll-region">
                <div className="rounded-2xl border p-3" style={{ borderColor: C.border, background: C.surface }}>
                  <div style={{ color: C.text, fontSize: 12, fontWeight: 900, marginBottom: 4 }}>
                    {isAr ? "الأيام" : "Days"}
                  </div>
                  <div style={{ color: C.subtle, fontSize: 10.5, marginBottom: 10 }}>
                    {isAr ? "اضغط على كل يوم وأدخل حصصه بشكل مستقل. العلامة الخضراء تعني أن اليوم سيُحفظ." : "Open each day and enter its lessons independently. A green mark means the day will be saved."}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllBulkDays}
                      className="rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        borderColor: Object.keys(bulkDaySchedules).length === 7 ? C.green : C.border,
                        background: Object.keys(bulkDaySchedules).length === 7 ? C.greenPale : C.card,
                        color: Object.keys(bulkDaySchedules).length === 7 ? C.green : C.text,
                      }}
                    >
                      {isAr ? "كل الأيام" : "Every day"}
                    </button>
                    {SCHEDULE_DAYS.map((day) => {
                      const configured = day.value in bulkDaySchedules;
                      const active = day.value === activeBulkDay;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => selectBulkDay(day.value)}
                          data-testid={`button-bulk-day-${day.value}`}
                          className="rounded-xl border px-3 py-2 text-xs font-bold"
                          style={{
                            borderColor: active || configured ? C.green : C.border,
                            background: active ? C.green : configured ? C.greenPale : C.card,
                            color: active ? "#fff" : configured ? C.green : C.text,
                          }}
                        >
                          {isAr ? day.ar : day.en}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div style={{ color: C.green, fontSize: 11, fontWeight: 850 }}>
                      {isAr
                        ? `تعدّل الآن: ${SCHEDULE_DAYS.find((day) => day.value === activeBulkDay)?.ar}`
                        : `Editing: ${SCHEDULE_DAYS.find((day) => day.value === activeBulkDay)?.en}`}
                    </div>
                    {Object.keys(bulkDaySchedules).length > 1 && (
                      <button
                        type="button"
                        onClick={removeActiveBulkDay}
                        data-testid="button-remove-active-bulk-day"
                        className="text-xs font-bold text-destructive"
                      >
                        {isAr ? "إزالة هذا اليوم" : "Remove this day"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div style={{ color: C.text, fontSize: 12, fontWeight: 900 }}>
                      {isAr ? "عدد الحصص" : "Number of lessons"}
                    </div>
                    <div style={{ color: C.subtle, fontSize: 10.5, marginTop: 3 }}>
                      {isAr ? "يمكنك إضافة العدد الموجود في جدولك حتى ٣٠ حصة مرقمة" : "Add the numbered lessons in your schedule, up to 30"}
                    </div>
                  </div>
                  <select
                    value={bulkLessonCount}
                    onChange={(event) => changeBulkLessonCount(Number(event.target.value))}
                    style={{ ...fieldStyle, width: 170 }}
                    data-testid="select-bulk-lesson-count"
                  >
                    {Array.from({ length: 31 }, (_, index) => index).map((number) => (
                      <option key={number} value={number}>
                        {number === 0
                          ? (isAr ? "لا توجد حصص مرقمة" : "No numbered lessons")
                          : isAr
                            ? `${number} ${number === 1 ? "حصة" : "حصص"}`
                            : `${number} ${number === 1 ? "lesson" : "lessons"}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor: C.border, background: C.card }}>
                  {bulkLessonFields.fields.map((lesson, index) => {
                    const isLowConfidence = lesson.confidence === "low";

                    return (
                      <div
                        key={lesson.id}
                        className="grid grid-cols-1 gap-3 rounded-2xl border p-3 sm:grid-cols-12"
                        style={{
                          borderColor: isLowConfidence ? "#F59E0B" : C.border,
                          background: isLowConfidence ? "#FEF3C7" : C.surface
                        }}
                      >
                        <div className="flex items-center gap-2 sm:col-span-2 sm:flex-col sm:items-start sm:justify-center relative">
                          {isLowConfidence && (
                            <div className="absolute -top-1 -right-1 text-amber-600" title={isAr ? "يرجى التحقق من هذه البيانات" : "Please verify these details"}>
                              <AlertTriangle className="h-4 w-4" />
                            </div>
                          )}
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              display: "grid",
                              placeItems: "center",
                              background: isLowConfidence ? "#FDE68A" : C.greenPale,
                              color: isLowConfidence ? "#D97706" : C.green,
                              fontWeight: 900,
                              fontSize: 14,
                            }}
                          >
                          {lesson.lessonNumber}
                          </div>
                          <div style={{ color: C.text, fontSize: 11, fontWeight: 900 }}>
                            {lessonNumberLabel(lesson.lessonNumber, isAr)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              bulkLessonFields.remove(index);
                              setBulkLessonCount((count) => Math.max(0, count - 1));
                            }}
                            className="text-[10px] font-bold text-destructive disabled:opacity-40"
                          >
                            {isAr ? "حذف" : "Delete"}
                          </button>
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-bold">{isAr ? "اسم الحصة (اختياري)" : "Lesson title (optional)"}</label>
                          <input
                            {...bulkForm.register(`lessons.${index}.title` as const)}
                            placeholder={isAr ? `الافتراضي: ${lessonNumberLabel(lesson.lessonNumber, true)}` : `Default: ${lessonNumberLabel(lesson.lessonNumber, false)}`}
                            style={{ ...fieldStyle, background: isLowConfidence ? "#FFFBEB" : C.surface }}
                            data-testid={`input-bulk-lesson-title-${index + 1}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "من" : "From"}</label>
                            <input
                              {...bulkForm.register(`lessons.${index}.startTime` as const, {
                                required: isAr ? "حدد وقت البداية" : "Enter a start time",
                              })}
                              type="time"
                              style={{
                                ...fieldStyle,
                                background: isLowConfidence ? "#FFFBEB" : C.surface,
                                borderColor: bulkForm.formState.errors.lessons?.[index]?.startTime ? "#B42318" : C.border,
                              }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "إلى" : "To"}</label>
                            <input
                              {...bulkForm.register(`lessons.${index}.endTime` as const)}
                              type="time"
                              style={{
                                ...fieldStyle,
                                background: isLowConfidence ? "#FFFBEB" : C.surface,
                                borderColor: bulkForm.formState.errors.lessons?.[index]?.endTime ? "#B42318" : C.border,
                              }}
                            />
                          </div>
                          {(bulkForm.formState.errors.lessons?.[index]?.startTime?.message
                            || bulkForm.formState.errors.lessons?.[index]?.endTime?.message) && (
                            <div className="col-span-2 text-xs font-bold text-destructive">
                              {bulkForm.formState.errors.lessons?.[index]?.startTime?.message
                                || bulkForm.formState.errors.lessons?.[index]?.endTime?.message}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "المادة" : "Subject"}</label>
                            <input
                              {...bulkForm.register(`lessons.${index}.subject` as const)}
                              style={{ ...fieldStyle, background: isLowConfidence ? "#FFFBEB" : C.surface }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "الصف" : "Class"}</label>
                            <input
                              {...bulkForm.register(`lessons.${index}.className` as const)}
                              style={{ ...fieldStyle, background: isLowConfidence ? "#FFFBEB" : C.surface }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs font-black" style={{ color: C.text }}>
                      <Coffee className="h-4 w-4" style={{ color: C.gold }} />
                      {isAr ? "الفترات غير الصفية" : "Non-lesson periods"}
                    </div>
                    <button
                      type="button"
                      onClick={addBulkBreak}
                       data-testid="button-add-bulk-period"
                      disabled={(bulkDayBreaks[activeBulkDay] || []).length >= 50}
                      className="rounded-xl border px-3 py-2 text-xs font-bold"
                      style={{
                        borderColor: C.border,
                        color: C.green,
                        background: C.surface,
                        opacity: (bulkDayBreaks[activeBulkDay] || []).length >= 50 ? 0.5 : 1,
                      }}
                    >
                      {isAr ? "إضافة فترة" : "Add period"}
                    </button>
                  </div>
                  {(bulkDayBreaks[activeBulkDay] || []).map((entry, index) => {
                    const lowConfidence = entry.confidence === "low";
                    return (
                      <div
                        key={`${activeBulkDay}-${index}`}
                        className="grid grid-cols-1 gap-3 rounded-2xl border p-3 sm:grid-cols-12"
                        style={{
                          borderColor: lowConfidence ? "#F59E0B" : "rgba(190,140,30,0.35)",
                          background: lowConfidence ? "#FEF3C7" : "#FFFBEB",
                        }}
                      >
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-bold">{isAr ? "الاسم" : "Name"}</label>
                          <input
                            value={entry.title}
                            onChange={(event) => updateBulkBreak(index, { title: event.target.value })}
                            style={{ ...fieldStyle, background: "#fff" }}
                            data-testid={`input-bulk-period-title-${activeBulkDay}-${index}`}
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-bold">{isAr ? "رقم الفترة الظاهر" : "Visible period number"}</label>
                          <select
                            value={entry.breakAfterLesson}
                            onChange={(event) => updateBulkBreak(index, { breakAfterLesson: Number(event.target.value) })}
                            style={{ ...fieldStyle, background: "#fff" }}
                          >
                            {Array.from({ length: 31 }, (_, lessonIndex) => lessonIndex).map((number) => (
                              <option key={number} value={number}>
                                {number === 0
                                  ? (isAr ? "بدون رقم ظاهر" : "No visible number")
                                  : breakPositionLabel(number, isAr)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:col-span-4">
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "من" : "From"}</label>
                            <input
                              type="time"
                              value={entry.startTime}
                              onChange={(event) => updateBulkBreak(index, { startTime: event.target.value })}
                              style={{ ...fieldStyle, background: "#fff" }}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "إلى" : "To"}</label>
                            <input
                              type="time"
                              value={entry.endTime || ""}
                              onChange={(event) => updateBulkBreak(index, { endTime: event.target.value || null })}
                              style={{ ...fieldStyle, background: "#fff" }}
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-end sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => removeBulkBreak(index)}
                            className="rounded-xl px-3 py-2 text-xs font-bold text-destructive"
                          >
                            {isAr ? "إزالة" : "Remove"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t pt-3" style={{ borderColor: C.border, background: C.card }} data-testid="bulk-schedule-fixed-actions">
                <button type="button" onClick={() => setBulkDialogOpen(false)} style={{ ...scheduleSecondaryButton, color: C.text }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" disabled={isBulkSaving} data-testid="button-save-bulk-schedule" style={{ ...schedulePrimaryButton, opacity: isBulkSaving ? 0.65 : 1 }}>
                  {isBulkSaving && <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />}
                  {isAr ? "حفظ الجدول كاملًا" : "Save full schedule"}
                </button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!isExtracting) { setImportDialogOpen(open); if (!open) { setImportFile(null); setImportPreview(null); } } }}>
        <DialogContent className="max-w-md rounded-3xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "استيراد جدول معلم" : "Import Teacher Schedule"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl border p-4 text-center" style={{ borderColor: C.border, background: C.surface }}>
              {importPreview ? (
                <div className="relative mb-3 flex justify-center">
                  <img src={importPreview} alt={isAr ? "معاينة صورة الجدول" : "Schedule image preview"} className="max-h-60 rounded-xl object-contain border shadow-sm" />
                  {!isExtracting && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={isAr ? "اختيار صورة أخرى" : "Choose another image"}
                      className="absolute bottom-2 right-2 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors hover:bg-black/5"
                  style={{ borderColor: C.border }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="mb-2 h-8 w-8" style={{ color: C.green }} />
                  <p className="text-sm font-bold" style={{ color: C.text }}>
                    {isAr ? "انقر لاختيار صورة من جهازك أو الكاميرا" : "Click to select an image from your device or camera"}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: C.subtle }}>
                    {isAr ? "JPG أو PNG أو WebP — حتى ١٠ ميجابايت" : "JPG, PNG, or WebP — up to 10MB"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-2xl p-3 text-xs leading-relaxed" style={{ background: C.goldPale, color: C.goldBright }}>
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-black">{isAr ? "قراءة تجريبية بالذكاء الاصطناعي" : "Experimental AI reading"}</div>
                <div className="mt-0.5" style={{ color: "#8a6407" }}>
                  {isAr ? "ستراجع الجدول وتعدله قبل حفظه. الجداول المكتوبة بوضوح تعطي نتائج أفضل." : "You will review and edit the schedule before saving. Clear tables give better results."}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <button
              type="button"
              onClick={() => setImportDialogOpen(false)}
              disabled={isExtracting}
              style={scheduleSecondaryButton}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleExtract}
              disabled={!importFile || isExtracting}
              data-testid="button-confirm-extract-schedule"
              style={{
                ...schedulePrimaryButton,
                opacity: (!importFile || isExtracting) ? 0.65 : 1,
              }}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 ml-2 animate-spin" />
                  {isAr ? "جاري الاستخراج..." : "Extracting..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 ml-2" />
                  {isAr ? "استخراج الجدول" : "Extract Schedule"}
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
