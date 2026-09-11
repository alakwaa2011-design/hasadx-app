import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Calendar, Coffee, Clock3, Trash2, Pencil, Image as ImageIcon, Plus, 
  UploadCloud, AlertTriangle, FileWarning, Loader2, ArrowRight, ArrowLeft,
  Sparkles, Bell, Volume2, VolumeX, Timer, CalendarClock, RefreshCw, MoreHorizontal, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  useGetCurrentTeacher,
  type TeacherScheduleEntry,
  type TeacherScheduleEntryInput,
} from "@workspace/api-client-react";
import {
  SCHEDULE_DAYS,
  breakPositionLabel,
  buildTeacherScheduleBulkInput,
  emptyBulkLessons,
  emptyScheduleForm,
  getApiErrorMessage,
  getLocalDateInput,
  getScheduleConflict,
  lessonNumberLabel,
  normalizeImportedDaySchedules,
  scheduleDateLabel,
  schedulePosition,
  type BulkBreakDraft,
  type BulkScheduleFormValues,
  type ExtractedScheduleDay,
  type ScheduleFormValues,
} from "@/lib/schedule-labels";
import { TIMER_SOUNDS, playTimerSound, initAudioContext } from "@/lib/timer-sounds";
import {
  useScheduleCountdownPreferences,
  type ScheduleCountdownPreferences,
} from "@/lib/schedule-countdown-preferences";
import { selectVisibleScheduleEntry } from "@/components/teacher/timer/active-lesson-countdown";

const BASE = (import.meta as any).env?.VITE_API_URL || "";

function parseClockTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * 60 + minutes) * 60_000;
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ActiveTimerDisplay({
  visibleEntry,
  isBeforeStart,
  currentTimeMs,
  isAr,
  alertMinutes,
}: {
  visibleEntry: TeacherScheduleEntry;
  isBeforeStart: boolean;
  currentTimeMs: number;
  isAr: boolean;
  alertMinutes: number;
}) {
  const startMs = parseClockTime(visibleEntry.startTime);
  const endMs = visibleEntry.endTime ? parseClockTime(visibleEntry.endTime) : null;

  const durationMs = isBeforeStart
    ? alertMinutes * 60_000
    : Math.max(1, (endMs || 0) - startMs);

  const remainingMs = Math.max(0, (isBeforeStart ? startMs : (endMs || 0)) - currentTimeMs);
  const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
  const urgent = !isBeforeStart && remainingMs <= 5 * 60_000;

  return (
    <div className={`relative overflow-hidden rounded-2xl border shadow-sm ${urgent ? "border-destructive/30 bg-destructive/5" : "border-emerald-700/20 bg-emerald-700/5"}`}>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/5">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${urgent ? "bg-destructive" : "bg-emerald-500"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex flex-col items-center justify-between gap-6 p-4 sm:p-5 md:flex-row">
        <div className="flex w-full items-center gap-5 md:w-auto">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-destructive/10 text-destructive" : "bg-emerald-700 text-white shadow-sm shadow-emerald-900/10"}`}>
            {visibleEntry.kind === "break"
              ? <Coffee className="h-6 w-6" />
              : visibleEntry.kind === "appointment"
                ? <CalendarClock className="h-6 w-6" />
                : <Timer className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-xs font-bold text-muted-foreground/80">
              {isBeforeStart
                ? (isAr ? "يبدأ قريبًا:" : "Starting soon:")
                : (isAr ? "جارٍ الآن:" : "Current:")}
            </div>
            <div className={`truncate text-lg font-black sm:text-xl ${urgent ? "text-destructive" : "text-emerald-900 dark:text-emerald-100"}`}>
              {visibleEntry.title}
              {visibleEntry.className && <span className="ms-2 text-sm font-bold opacity-70">• {visibleEntry.className}</span>}
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col items-center gap-4 rounded-xl border border-white/60 bg-white/80 px-5 py-2.5 backdrop-blur-sm dark:border-white/10 dark:bg-black/40 sm:flex-row md:w-auto">
          <div className="text-xs font-bold text-muted-foreground">
            {isBeforeStart
              ? (isAr ? "متبقي للبداية" : "Starts in")
              : (isAr ? "متبقي للنهاية" : "Ends in")}
          </div>
          <div
            className={`font-mono text-2xl font-black tracking-tighter sm:text-3xl ${urgent ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
            dir="ltr"
            aria-live="off"
          >
            {formatRemaining(remainingMs)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimerAndAlertsSection({
  entries,
  isAr,
  preferences,
  updatePreferences,
}: {
  entries: TeacherScheduleEntry[];
  isAr: boolean;
  preferences: ScheduleCountdownPreferences;
  updatePreferences: (patch: Partial<ScheduleCountdownPreferences>) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const today = useMemo(() => new Date(now), [now]);

  const { visibleEntry, isBeforeStart, currentTimeMs } = useMemo(
    () => selectVisibleScheduleEntry(entries, today, preferences.alertMinutes),
    [entries, today, preferences.alertMinutes],
  );

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-[2rem] border border-emerald-900/10 bg-emerald-900/5 p-5 dark:border-emerald-500/20 dark:bg-emerald-900/10 sm:p-6"
      aria-labelledby="schedule-timer-settings-title"
      data-testid="schedule-timer-alerts"
    >
      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-emerald-900/10 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Timer className="h-5 w-5" />
          </div>
          <div>
          <h2 id="schedule-timer-settings-title" className="mb-1 flex items-center gap-2 text-lg font-black text-foreground">
            {isAr ? "المؤقت والتنبيهات" : "Timer & alerts"}
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            {!preferences.enabled
              ? (isAr
                ? "متوقف حاليًا — لن تظهر تنبيهات الحصص أو المواعيد"
                : "Currently off — lesson and appointment alerts will not appear")
              : isAr
              ? "يدير العد التنازلي للحصص والفترات والمواعيد الفردية تلقائيًا"
              : "Automatically manages countdowns for lessons, breaks, and single appointments"}
          </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={preferences.enabled}
          onClick={() => updatePreferences({ enabled: !preferences.enabled })}
          className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-xs font-black transition-colors sm:min-w-[150px] ${
            preferences.enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-border bg-card text-muted-foreground"
          }`}
          data-testid="button-schedule-alerts-enabled"
        >
          <span>{preferences.enabled ? (isAr ? "التنبيهات مفعّلة" : "Alerts on") : (isAr ? "التنبيهات متوقفة" : "Alerts off")}</span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${preferences.enabled ? "bg-emerald-700" : "bg-muted-foreground/35"}`} aria-hidden="true">
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${preferences.enabled ? "start-6" : "start-1"}`} />
          </span>
        </button>
        </div>

        {preferences.enabled && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${visibleEntry ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
            <div>
              <div className="text-xs font-black text-foreground">
                {visibleEntry
                  ? (isBeforeStart ? (isAr ? "تنبيه نشط" : "Alert active") : (isAr ? "العد التنازلي نشط" : "Countdown active"))
                  : (isAr ? "لا يوجد تنبيه حالي" : "No active alert")}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {isAr ? "حالة الجدول الآن" : "Current schedule status"}
              </div>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Bell className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <span className="block text-xs font-black text-foreground">{isAr ? "تنبيه قبل البدء" : "Before start"}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">{isAr ? "ظهور العداد" : "Show countdown"}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <select
                value={preferences.alertMinutes}
                onChange={(event) => updatePreferences({ alertMinutes: Number(event.target.value) })}
                className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-background px-1 text-center text-sm font-black text-foreground"
                dir="ltr"
                aria-label={isAr ? "مدة ظهور التنبيه قبل البدء" : "Alert lead time before start"}
                data-testid="select-schedule-alert-minutes"
              >
                {[1, 2, 5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}
              </select>
              <span className="text-[11px] font-bold text-muted-foreground">{isAr ? "د" : "m"}</span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Timer className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <span className="block text-xs font-black text-foreground">{isAr ? "تنبيه قبل الانتهاء" : "Before end"}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">{isAr ? "للحصة أو الموعد" : "Lesson or appointment"}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <select
                value={preferences.endAlertMinutes}
                onChange={(event) => updatePreferences({ endAlertMinutes: Number(event.target.value) })}
                className="h-8 w-14 cursor-pointer rounded-lg border border-border bg-background px-1 text-center text-sm font-black text-foreground"
                dir="ltr"
                aria-label={isAr ? "مدة التنبيه قبل انتهاء الحصة أو الموعد" : "Alert lead time before lesson or appointment ends"}
                data-testid="select-schedule-end-alert-minutes"
              >
                <option value={0}>{isAr ? "لا" : "Off"}</option>
                {[1, 2, 5, 10, 15].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}
              </select>
              {preferences.endAlertMinutes > 0 && <span className="text-[11px] font-bold text-muted-foreground">{isAr ? "د" : "m"}</span>}
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="flex min-w-0 items-center gap-2">
              {preferences.soundEnabled ? <Volume2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span>
                <span className="block text-xs font-black text-foreground">{isAr ? "الصوت" : "Sound"}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">{preferences.soundEnabled ? (isAr ? "مفعّل" : "Enabled") : (isAr ? "متوقف" : "Off")}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => updatePreferences({ soundEnabled: !preferences.soundEnabled })}
                className={`rounded-lg p-1.5 transition-colors ${preferences.soundEnabled ? "bg-emerald-100 text-emerald-700" : "text-muted-foreground hover:bg-muted"}`}
                title={isAr ? "تشغيل أو إيقاف الصوت" : "Toggle sound"}
                aria-label={isAr ? "تشغيل أو إيقاف صوت التنبيه" : "Toggle alert sound"}
                aria-pressed={preferences.soundEnabled}
                data-testid="button-schedule-alert-sound"
              >
                {preferences.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <select
                value={preferences.soundId}
                onChange={(event) => {
                  const soundId = event.target.value as ScheduleCountdownPreferences["soundId"];
                  updatePreferences({ soundId, soundEnabled: true });
                  initAudioContext();
                  playTimerSound(soundId, 0.38);
                }}
                className="h-8 max-w-[100px] rounded-lg border border-border bg-background px-1.5 text-xs font-bold text-foreground"
                aria-label={isAr ? "اختيار صوت التنبيه ومعاينته" : "Choose and preview alert sound"}
                data-testid="select-schedule-alert-sound"
              >
                {TIMER_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{isAr ? sound.labelAr : sound.labelEn}</option>)}
              </select>
            </span>
          </div>
        </div>
        )}

      </div>

      {preferences.enabled && visibleEntry && (
        <div className="mt-5 border-t border-emerald-900/10 pt-5 dark:border-emerald-500/20">
          <ActiveTimerDisplay
            visibleEntry={visibleEntry}
            isBeforeStart={isBeforeStart}
            currentTimeMs={currentTimeMs}
            isAr={isAr}
            alertMinutes={preferences.alertMinutes}
          />
        </div>
      )}
    </section>
  );
}

const SCHEDULE_COLORS = [
  { value: "#D1FAE5", label: "أخضر", class: "bg-emerald-100", textClass: "text-emerald-950", borderClass: "border-emerald-300" },
  { value: "#FEF3C7", label: "أصفر", class: "bg-amber-100", textClass: "text-amber-950", borderClass: "border-amber-300" },
  { value: "#FFEDD5", label: "خوخي", class: "bg-orange-100", textClass: "text-orange-950", borderClass: "border-orange-300" },
  { value: "#DBEAFE", label: "أزرق", class: "bg-blue-100", textClass: "text-blue-950", borderClass: "border-blue-300" },
  { value: "#F3E8FF", label: "بنفسجي", class: "bg-purple-100", textClass: "text-purple-950", borderClass: "border-purple-300" },
  { value: "#FCE7F3", label: "وردي", class: "bg-pink-100", textClass: "text-pink-950", borderClass: "border-pink-300" },
  { value: "#F1F5F9", label: "رمادي", class: "bg-slate-100", textClass: "text-slate-900", borderClass: "border-slate-300" },
];

type ScheduleTableTheme = "classic" | "soft" | "notebook";

const SCHEDULE_TABLE_THEMES = [
  { id: "classic" as const, ar: "الجدول المترابط", en: "Connected table", swatches: ["#FFFFFF", "#D1FAE5", "#FEF3C7"] },
  { id: "soft" as const, ar: "بطاقات هادئة", en: "Soft cards", swatches: ["#F8FAFC", "#DBEAFE", "#F3E8FF"] },
  { id: "notebook" as const, ar: "دفتر", en: "Notebook", swatches: ["#FFFBEB", "#FFEDD5", "#E7E5E4"] },
];

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
  const isBreak = entry.kind === "break";
  const isAppointment = entry.kind === "appointment";

  const iconBg = isBreak ? "bg-amber-100/50" : isAppointment ? "bg-amber-100" : "bg-emerald-50";
  const iconColor = isBreak ? "text-amber-700" : isAppointment ? "text-amber-800" : "text-emerald-700";
  const IconComponent = isAppointment ? Calendar : isBreak ? Coffee : Clock3;

  return (
    <div
      data-testid={`schedule-entry-${entry.id}`}
      data-schedule-kind={entry.kind}
      data-schedule-day={entry.dayOfWeek ?? undefined}
      data-schedule-position={schedulePosition(entry)}
      className={`flex items-center gap-4 py-4 ${!isLast ? 'border-b border-border/60' : ''} group`}
    >
      <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
         <IconComponent className="w-[22px] h-[22px]" />
       </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[15px] font-bold text-foreground leading-tight">{entry.title}</span>
          {entry.kind === "break" && Boolean(entry.breakAfterLesson) && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-md">
              {breakPositionLabel(entry.breakAfterLesson, isAr)}
            </span>
          )}
          {entry.kind === "weekly" && entry.lessonNumber && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {lessonNumberLabel(entry.lessonNumber, isAr)}
            </span>
          )}
          {entry.kind === "appointment" && entry.appointmentDate && (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              {scheduleDateLabel(entry.appointmentDate, isAr)}
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-muted-foreground/80">
          <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ""}</span>
          {entry.className && <span>• {entry.className}</span>}
          {entry.location && <span>• {entry.location}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          title={isAr ? "تعديل" : "Edit"}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Pencil className="w-[18px] h-[18px]" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title={isAr ? "حذف" : "Delete"}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}

export default function ScheduleManagementPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  const { data: user } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { preferences, updatePreferences } = useScheduleCountdownPreferences(user?.id);

  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [viewMode, setViewMode] = useState<"day" | "week-list" | "week-grid">("week-grid");
  const [timerSettingsOpen, setTimerSettingsOpen] = useState(false);
  const [tableTheme, setTableTheme] = useState<ScheduleTableTheme>("classic");
  const [tableDirection, setTableDirection] = useState<"rtl" | "ltr">("rtl");
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>({});
  const [editingColumnLabel, setEditingColumnLabel] = useState<{ key: string; defaultLabel: string } | null>(null);
  const [columnLabelDraft, setColumnLabelDraft] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const saved = localStorage.getItem(`hasaad_schedule_table_theme_v1_${user.id}`);
    if (saved === "classic" || saved === "soft" || saved === "notebook") {
      setTableTheme(saved);
    }
    const savedDirection = localStorage.getItem(`hasaad_schedule_table_direction_v1_${user.id}`);
    if (savedDirection === "rtl" || savedDirection === "ltr") {
      setTableDirection(savedDirection);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`hasaad_schedule_column_labels_v1_${user.id}`) || "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setColumnLabels(
          Object.fromEntries(
            Object.entries(saved).filter(([, value]) => typeof value === "string" && value.trim()),
          ) as Record<string, string>,
        );
      }
    } catch {
      setColumnLabels({});
    }
  }, [user?.id]);

  function openColumnLabelEditor(key: string, defaultLabel: string) {
    setEditingColumnLabel({ key, defaultLabel });
    setColumnLabelDraft(columnLabels[key] || defaultLabel);
  }

  function saveColumnLabel() {
    if (!editingColumnLabel || !user?.id) return;
    const value = columnLabelDraft.trim().slice(0, 40);
    const next = { ...columnLabels };
    if (!value || value === editingColumnLabel.defaultLabel) {
      delete next[editingColumnLabel.key];
    } else {
      next[editingColumnLabel.key] = value;
    }
    setColumnLabels(next);
    localStorage.setItem(`hasaad_schedule_column_labels_v1_${user.id}`, JSON.stringify(next));
    setEditingColumnLabel(null);
  }

  function chooseTableTheme(theme: ScheduleTableTheme) {
    setTableTheme(theme);
    if (user?.id) {
      localStorage.setItem(`hasaad_schedule_table_theme_v1_${user.id}`, theme);
    }
  }

  function chooseTableDirection(direction: "rtl" | "ltr") {
    setTableDirection(direction);
    if (user?.id) {
      localStorage.setItem(`hasaad_schedule_table_direction_v1_${user.id}`, direction);
    }
  }
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [bulkLessonCount, setBulkLessonCount] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (importPreview) URL.revokeObjectURL(importPreview);
    };
  }, [importPreview]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isHeic = ["image/heic", "image/heif"].includes(file.type)
      || /\.(heic|heif)$/i.test(file.name);
    const isSupported = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      || /\.(jpe?g|png|webp)$/i.test(file.name)
      || isHeic;
    if (!isSupported) {
      toast.error(isAr ? "استخدم صورة JPG أو PNG أو WebP أو HEIC" : "Use a JPG, PNG, WebP, or HEIC image");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isAr ? "حجم الصورة يجب أن لا يتجاوز 10 ميجابايت" : "Image size must not exceed 10MB");
      e.target.value = "";
      return;
    }
    if (importPreview) URL.revokeObjectURL(importPreview);
    setImportFile(file);
    setImportPreview(null);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!isHeic) {
      setImportPreview(URL.createObjectURL(file));
      return;
    }

    setIsPreparingImage(true);
    try {
      const { default: heic2any } = await import("heic2any");
      const result = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });
      const jpegBlob = Array.isArray(result) ? result[0] : result;
      const converted = new File(
        [jpegBlob],
        file.name.replace(/\.(heic|heif)$/i, "") + ".jpg",
        { type: "image/jpeg", lastModified: file.lastModified },
      );
      if (converted.size > 10 * 1024 * 1024) {
        throw new Error("converted-file-too-large");
      }
      setImportFile(converted);
      setImportPreview(URL.createObjectURL(converted));
    } catch (error) {
      setImportFile(null);
      toast.error(
        error instanceof Error && error.message === "converted-file-too-large"
          ? (isAr ? "حجم الصورة بعد التحويل يتجاوز 10 ميجابايت" : "The converted image exceeds 10MB")
          : (isAr ? "تعذر قراءة صورة HEIC. جرّب حفظها بصيغة JPG" : "Could not read the HEIC image. Try saving it as JPG"),
      );
    } finally {
      setIsPreparingImage(false);
    }
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
  const paperScheduleDays = useMemo(
    () =>
      SCHEDULE_DAYS.slice(0, 5).map((day) => ({
        day,
        entries: entries
          .filter((entry) => (entry.kind === "weekly" || entry.kind === "break") && entry.dayOfWeek === day.value)
          .sort((a, b) => a.startTime.localeCompare(b.startTime) || schedulePosition(a) - schedulePosition(b)),
      })),
    [entries],
  );
  const paperLessonNumbers = useMemo(() => {
    const highestLesson = entries.reduce(
      (highest, entry) =>
        entry.kind === "weekly" && entry.lessonNumber
          ? Math.max(highest, entry.lessonNumber)
          : highest,
      0,
    );
    return Array.from({ length: highestLesson }, (_, index) => index + 1);
  }, [entries]);
  const paperBreakPositions = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.kind === "break" && entry.breakAfterLesson != null && entry.breakAfterLesson > 0)
          .map((entry) => entry.breakAfterLesson as number),
      ),
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
    const defaultDays = [0, 1, 2, 3, 4];
    const initialDaySchedules = Object.fromEntries(
      defaultDays.map((day) => [day, emptyBulkLessons(5)]),
    );
    setBulkLessonCount(5);
    setActiveBulkDay(defaultDays[0]);
    setBulkDaySchedules(initialDaySchedules);
    setBulkDayBreaks({});
    setImportWarnings([]);
    bulkForm.reset({
      lessons: initialDaySchedules[defaultDays[0]],
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
      color: entry.color || "",
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
      color: values.kind === "weekly" ? values.color || null : null,
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
      <div className="mx-auto max-w-[1500px] p-4 font-sans animate-in fade-in duration-500 md:p-8" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-8">
          {/* Header Area */}
           <div className="flex flex-col items-start justify-between gap-6 xl:flex-row xl:items-center">
             <div className="flex flex-col gap-1">
               <Link href="/teacher?tab=tools" className="mb-2 inline-flex items-center text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
                 <BackArrow className="mr-1 ml-1 h-3.5 w-3.5" />
                 {isAr ? "العودة للأدوات" : "Back to tools"}
               </Link>
               <h1 className="font-display text-3xl font-black text-foreground">{isAr ? "جدول المعلم" : "Teacher Schedule"}</h1>
               <p className="text-sm font-medium text-muted-foreground">{isAr ? "حصص وفترات غير صفية ومواعيد منفردة" : "Manage lessons, breaks, and single appointments"}</p>
             </div>

             <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
               <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" data-testid="input-import-schedule-image" />

               <button type="button" onClick={() => fileInputRef.current?.click()} data-testid="button-import-schedule-image" className="flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-muted/50">
                 <ImageIcon className="h-4 w-4 text-muted-foreground" />
                 {isAr ? "استيراد صورة" : "Import"}
               </button>

               <details className="group relative">
                 <summary className="flex h-11 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white shadow-sm shadow-emerald-900/10 transition-colors hover:bg-emerald-800 list-none [&::-webkit-details-marker]:hidden">
                   <Plus className="h-4 w-4" />
                   {isAr ? "إضافة" : "Add"}
                 </summary>
                 <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex w-56 flex-col overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95">
                   <button type="button" onClick={() => { document.body.click(); openCreate("weekly"); }} data-testid="button-add-schedule-entry" className="flex items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted">
                     <Clock3 className="h-4 w-4 text-emerald-600" />
                     {isAr ? "حصة أو موعد جديد" : "New lesson or appointment"}
                   </button>
                   <button type="button" onClick={() => { document.body.click(); openBulkCreate(); }} data-testid="button-add-bulk-schedule" className="flex items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted">
                     <Calendar className="h-4 w-4 text-emerald-600" />
                     {isAr ? "إضافة جدول كامل يدويًا" : "Add full schedule manually"}
                   </button>
                 </div>
               </details>

               {entries.length > 0 && (
                 <details className="group relative">
                   <summary
                     data-testid="button-schedule-management-menu"
                     className="flex h-11 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-3 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground list-none [&::-webkit-details-marker]:hidden"
                   >
                     <MoreHorizontal className="h-4 w-4" />
                     <span className="hidden sm:inline">{isAr ? "إدارة" : "Manage"}</span>
                   </summary>
                   <div className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95">
                     <button
                       type="button"
                       onClick={() => { document.body.click(); setDeleteAllDialogOpen(true); }}
                       data-testid="button-delete-whole-schedule"
                       className="flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
                     >
                       <Trash2 className="h-4 w-4" />
                       {isAr ? "حذف الجدول كاملًا" : "Delete full schedule"}
                     </button>
                   </div>
                 </details>
               )}
             </div>
           </div>

          {/* Main Content Area */}
          <div className="bg-card rounded-[2rem] border border-border/60 shadow-sm p-4 sm:p-6 md:p-8 relative min-h-[400px]">
            {scheduleQuery.isLoading || (scheduleQuery.isError && scheduleQuery.isFetching) ? (
              <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm z-10 rounded-[2rem]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
              </div>
            ) : scheduleQuery.isError ? (
              <div
                className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center"
                data-testid="status-schedule-load-error"
              >
                <Calendar className="mb-4 h-10 w-10 text-destructive/70" />
                <h3 className="mb-2 text-lg font-black text-foreground">
                  {isAr ? "تعذر تحميل الجدول" : "Could not load the schedule"}
                </h3>
                <p className="mb-6 text-sm font-medium text-muted-foreground">
                  {isAr ? "تحقق من اتصالك ثم حاول مرة أخرى." : "Check your connection and try again."}
                </p>
                <button
                  type="button"
                  onClick={() => void scheduleQuery.refetch()}
                  disabled={scheduleQuery.isFetching}
                  data-testid="button-retry-schedule"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${scheduleQuery.isFetching ? "animate-spin" : ""}`} />
                  {isAr ? "إعادة المحاولة" : "Try again"}
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                  <Calendar className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-3">
                  {isAr ? "الجدول فارغ" : "Empty Schedule"}
                </h3>
                <p className="text-base text-muted-foreground max-w-sm mx-auto mb-10 font-medium leading-relaxed text-balance">
                  {isAr
                    ? "قم ببناء جدول حصصك الأسبوعية وتحديد الفترات والمواعيد الفردية، لتظهر تنبيهاتها بوضوح أثناء الدرس."
                    : "Build your weekly schedule and set break periods to see automatic alerts during classes."}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => openCreate("weekly")}
                    data-testid="button-add-schedule-entry-empty"
                    className="flex items-center justify-center h-12 px-6 rounded-xl text-sm font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-sm hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4 mr-2 ml-2" />
                    {isAr ? "إضافة للإدخالات" : "Add an entry"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-import-schedule-image-empty"
                    className="flex items-center justify-center h-12 px-6 rounded-xl text-sm font-bold border-2 border-emerald-700/20 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 transition-colors hover:scale-105 active:scale-95"
                  >
                    <ImageIcon className="w-4 h-4 mr-2 ml-2" />
                    {isAr ? "استيراد من صورة" : "Import from image"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col animate-in fade-in duration-300">
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/20 p-2">
                  <details className="group relative">
                    <summary className="flex h-10 cursor-pointer select-none items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-black text-foreground shadow-sm list-none [&::-webkit-details-marker]:hidden">
                      <Calendar className="h-4 w-4 text-emerald-700" />
                      {isAr ? "العرض" : "View"}
                    </summary>
                    <div className="absolute start-0 top-[calc(100%+0.5rem)] z-40 flex w-52 flex-col rounded-2xl border border-border bg-card p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => { setViewMode("day"); document.body.click(); }}
                        data-testid="button-schedule-view-day"
                        className={`rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors ${viewMode === "day" ? "bg-emerald-50 text-emerald-800" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {isAr ? "يومي" : "Daily"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setViewMode("week-list"); document.body.click(); }}
                        data-testid="button-schedule-view-week-list"
                        className={`rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors ${viewMode === "week-list" ? "bg-emerald-50 text-emerald-800" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {isAr ? "قائمة أسبوعية" : "Weekly list"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setViewMode("week-grid"); document.body.click(); }}
                        data-testid="button-schedule-view-week-grid"
                        className={`rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors ${viewMode === "week-grid" ? "bg-emerald-50 text-emerald-800" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {isAr ? "شبكة أسبوعية" : "Weekly grid"}
                      </button>
                    </div>
                  </details>

                  {viewMode === "week-grid" && (
                    <details className="group relative shrink-0" data-testid="schedule-table-theme-picker">
                      <summary className="flex h-10 cursor-pointer select-none items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-black text-foreground shadow-sm list-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
                          {isAr ? "مظهر الجدول" : "Table appearance"}
                        </span>
                      </summary>
                      <div className="absolute end-0 top-[calc(100%+0.5rem)] z-40 flex w-[min(34rem,calc(100vw-3rem))] flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-xl">
                        <span className="me-1 text-xs font-black text-muted-foreground">
                          {isAr ? "مظهر الجدول" : "Table style"}
                        </span>
                        {SCHEDULE_TABLE_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => chooseTableTheme(theme.id)}
                            aria-pressed={tableTheme === theme.id}
                            data-testid={`button-schedule-theme-${theme.id}`}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                              tableTheme === theme.id
                                ? "border-emerald-700 bg-emerald-50 text-emerald-900 shadow-sm"
                                : "border-border bg-card text-muted-foreground hover:border-emerald-300"
                            }`}
                          >
                            <span className="flex -space-x-1 rtl:space-x-reverse" aria-hidden="true">
                              {theme.swatches.map((swatch) => (
                                <span key={swatch} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: swatch }} />
                              ))}
                            </span>
                            {isAr ? theme.ar : theme.en}
                          </button>
                        ))}
                        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
                        <span className="text-xs font-black text-muted-foreground">
                          {isAr ? "بداية الجدول" : "Table direction"}
                        </span>
                        <div className="flex rounded-xl bg-muted/50 p-1">
                          <button
                            type="button"
                            onClick={() => chooseTableDirection("rtl")}
                            aria-pressed={tableDirection === "rtl"}
                            data-testid="button-schedule-direction-rtl"
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              tableDirection === "rtl" ? "bg-card text-emerald-800 shadow-sm" : "text-muted-foreground"
                            }`}
                          >
                            {isAr ? "الأحد من اليمين" : "Sunday on right"}
                          </button>
                          <button
                            type="button"
                            onClick={() => chooseTableDirection("ltr")}
                            aria-pressed={tableDirection === "ltr"}
                            data-testid="button-schedule-direction-ltr"
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              tableDirection === "ltr" ? "bg-card text-emerald-800 shadow-sm" : "text-muted-foreground"
                            }`}
                          >
                            {isAr ? "الأحد من اليسار" : "Sunday on left"}
                          </button>
                        </div>
                      </div>
                    </details>
                  )}

                  <button
                    type="button"
                    onClick={() => setTimerSettingsOpen((open) => !open)}
                    aria-expanded={timerSettingsOpen}
                    data-testid="button-toggle-schedule-timer-settings"
                    className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-black shadow-sm transition-colors ${
                      timerSettingsOpen
                        ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                        : "border-border/70 bg-card text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Timer className="h-4 w-4 text-emerald-700" />
                    {isAr ? "المؤقت والتنبيهات" : "Timer & alerts"}
                  </button>

                  {/* Horizontal day selector for Day mode */}
                  {viewMode === "day" && (
                    <div className="flex w-full gap-2 overflow-x-auto border-t border-border/50 pt-2 scrollbar-none snap-x" data-testid="schedule-management-day-selector">
                      {SCHEDULE_DAYS.map(day => {
                        const count = entries.filter(e => (e.kind === "weekly" || e.kind === "break") && e.dayOfWeek === day.value).length;
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setSelectedDay(day.value)}
                            data-testid={`button-management-schedule-day-${day.value}`}
                            className={`shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${
                              selectedDay === day.value
                                ? 'bg-emerald-700 border-emerald-700 text-white shadow-md shadow-emerald-900/10 font-black'
                                : 'bg-transparent border-transparent text-muted-foreground font-bold hover:bg-muted/50'
                            }`}
                          >
                            <span>{isAr ? day.ar : day.en}</span>
                            {count > 0 && selectedDay !== day.value && (
                              <span className="w-5 h-5 flex items-center justify-center rounded-md bg-muted text-[10px] font-black">{count}</span>
                            )}
                            {count > 0 && selectedDay === day.value && (
                              <span className="w-5 h-5 flex items-center justify-center rounded-md bg-white/20 text-[10px] font-black">{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {timerSettingsOpen && (
                  <TimerAndAlertsSection entries={entries} isAr={isAr} preferences={preferences} updatePreferences={updatePreferences} />
                )}

                {/* Schedule List */}
                {viewMode === "day" && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {weeklyEntries.length > 0 ? (
                      <div className="flex flex-col">
                        {weeklyEntries.map((entry, idx) => (
                          <ScheduleEntryRow
                            key={entry.id}
                            entry={entry}
                            isAr={isAr}
                            isLast={idx === weeklyEntries.length - 1}
                            onEdit={() => openEdit(entry)}
                            onDelete={() => removeEntry(entry)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 bg-muted/10 border border-dashed border-border/60 rounded-3xl">
                        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold text-lg mb-1">{isAr ? "يوم فارغ" : "Empty Day"}</p>
                        <p className="text-muted-foreground/70 text-sm font-medium">{isAr ? "لا توجد حصص مجدولة في هذا اليوم." : "No lessons scheduled for this day."}</p>
                      </div>
                    )}
                  </div>
                  )}

                {viewMode === "week-list" && (
                  <div
                    className="h-[min(68vh,560px)] overflow-y-auto snap-y snap-mandatory rounded-3xl border border-border/60 bg-muted/5 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    data-testid="schedule-week-list-scroll"
                  >
                    {weeklyGroups.length > 0 ? (
                      weeklyGroups.map(group => (
                        <section key={group.day.value} className="relative min-h-full snap-start snap-always py-6">
                          <h3 className="sticky top-0 z-10 mb-4 flex items-center gap-3 bg-card/95 py-3 text-base font-bold text-foreground backdrop-blur-sm">
                            <span className="w-2.5 h-6 bg-emerald-500 rounded-full" />
                            {isAr ? group.day.ar : group.day.en}
                          </h3>
                          <div className="flex flex-col rounded-3xl border border-border/50 bg-card px-4 py-2 sm:px-6">
                            {group.entries.map((entry, idx) => (
                              <ScheduleEntryRow
                                key={entry.id}
                                entry={entry}
                                isAr={isAr}
                                isLast={idx === group.entries.length - 1}
                                onEdit={() => openEdit(entry)}
                                onDelete={() => removeEntry(entry)}
                              />
                            ))}
                          </div>
                        </section>
                      ))
                    ) : (
                      <div className="text-center py-16 bg-muted/10 border border-dashed border-border/60 rounded-3xl">
                        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold text-lg mb-1">{isAr ? "لا توجد حصص أسبوعية" : "No Weekly Classes"}</p>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "week-grid" && (
                  <div
                    data-testid="schedule-week-grid"
                    data-table-theme={tableTheme}
                    className={`w-full overflow-x-auto rounded-3xl pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                      tableTheme === "soft"
                        ? "bg-slate-50/80 p-3 dark:bg-slate-900/30"
                        : tableTheme === "notebook"
                          ? "bg-amber-50/70 p-3 dark:bg-stone-900/30"
                          : ""
                    }`}
                  >
                    {weeklyGroups.length > 0 ? (
                      <table
                        dir={tableDirection}
                        data-table-direction={tableDirection}
                        className={`w-full table-fixed overflow-hidden text-center ${
                          tableTheme === "classic"
                            ? "border-collapse rounded-xl border border-border"
                            : tableTheme === "notebook"
                              ? "border-separate border-spacing-1"
                              : "border-separate border-spacing-2"
                        }`}
                        style={{ minWidth: `${Math.max(760, (paperLessonNumbers.length + paperBreakPositions.size + 2) * 112)}px` }}
                      >
                        <thead>
                          <tr>
                            <th className={`sticky start-0 z-20 w-28 px-2 py-3 ${tableTheme === "classic" ? "border border-border bg-emerald-800" : ""}`}></th>
                            {paperLessonNumbers.map((lessonNumber) => (
                              <Fragment key={lessonNumber}>
                                <th className={`px-2 py-3 text-sm font-black uppercase tracking-wider ${
                                  tableTheme === "classic"
                                    ? "border border-border bg-emerald-800 text-white"
                                    : "text-emerald-900/60 dark:text-emerald-100/60"
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() => openColumnLabelEditor(`lesson-${lessonNumber}`, lessonNumberLabel(lessonNumber, isAr))}
                                    className="w-full rounded-lg px-1 py-1 transition-colors hover:bg-white/15"
                                    title={isAr ? "تغيير اسم العمود" : "Rename column"}
                                    data-testid={`button-rename-lesson-column-${lessonNumber}`}
                                  >
                                    {columnLabels[`lesson-${lessonNumber}`] || lessonNumberLabel(lessonNumber, isAr)}
                                  </button>
                                </th>
                                {paperBreakPositions.has(lessonNumber) && (
                                  <th
                                    className={`w-28 px-2 py-3 text-xs font-black ${
                                      tableTheme === "classic"
                                        ? "border border-border bg-amber-700 text-white"
                                        : "text-amber-900/70 dark:text-amber-100/70"
                                    }`}
                                    data-testid={`schedule-break-column-${lessonNumber}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const defaultLabel = isAr
                                          ? `بعد ${lessonNumberLabel(lessonNumber, true).replace("الحصة ", "")}`
                                          : `After lesson ${lessonNumber}`;
                                        openColumnLabelEditor(`break-${lessonNumber}`, defaultLabel);
                                      }}
                                      className="w-full rounded-lg px-1 py-1 transition-colors hover:bg-white/15"
                                      title={isAr ? "تغيير اسم العمود" : "Rename column"}
                                      data-testid={`button-rename-break-column-${lessonNumber}`}
                                    >
                                      {columnLabels[`break-${lessonNumber}`] || (isAr
                                        ? `بعد ${lessonNumberLabel(lessonNumber, true).replace("الحصة ", "")}`
                                        : `After lesson ${lessonNumber}`)}
                                    </button>
                                  </th>
                                )}
                              </Fragment>
                            ))}
                            <th className={`px-2 py-3 text-sm font-black uppercase tracking-wider ${
                              tableTheme === "classic"
                                ? "border border-border bg-amber-700 text-white"
                                : "text-amber-900/60 dark:text-amber-100/60"
                            }`}>
                              <button
                                type="button"
                                onClick={() => openColumnLabelEditor("other-periods", isAr ? "فترات أخرى" : "Other periods")}
                                className="w-full rounded-lg px-1 py-1 transition-colors hover:bg-white/15"
                                title={isAr ? "تغيير اسم العمود" : "Rename column"}
                                data-testid="button-rename-other-periods-column"
                              >
                                {columnLabels["other-periods"] || (isAr ? "فترات أخرى" : "Other periods")}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paperScheduleDays.map(({ day, entries: dayEntries }) => {
                            const unplacedBreaks = dayEntries.filter(
                              (entry) => entry.kind === "break" && !entry.breakAfterLesson,
                            );
                            return (
                              <tr key={day.value} data-testid={`schedule-paper-day-${day.value}`} className="align-top group">
                                <th className={`sticky start-0 z-10 ${tableTheme === "classic" ? "border border-border p-0" : "p-2"}`}>
                                   <div className={`h-full min-h-[5rem] w-full flex items-center justify-center text-sm font-black transition-colors ${
                                     tableTheme === "soft"
                                       ? "rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                       : tableTheme === "notebook"
                                         ? "rounded-lg border border-amber-200 bg-amber-100/80 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                                         : "rounded-none border-0 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300"
                                   }`}>
                                    {isAr ? day.ar : day.en}
                                  </div>
                                </th>
                                {paperLessonNumbers.map((lessonNumber) => {
                                  const cellEntries = dayEntries.filter(
                                    (entry) =>
                                      entry.kind === "weekly" && entry.lessonNumber === lessonNumber,
                                  );
                                  const breakEntries = dayEntries.filter(
                                    (entry) => entry.kind === "break" && entry.breakAfterLesson === lessonNumber,
                                  );
                                  return (
                                    <Fragment key={lessonNumber}>
                                      <td className={`relative ${tableTheme === "classic" ? "border border-border p-0" : "p-2"}`}>
                                         <div className={`flex min-h-[5rem] h-full flex-col gap-2 border p-1.5 ${
                                           tableTheme === "soft"
                                             ? "rounded-2xl border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/70"
                                             : tableTheme === "notebook"
                                               ? "rounded-lg border-amber-200 bg-white/75 shadow-[inset_0_-1px_0_rgba(120,113,108,.12)] dark:border-stone-700 dark:bg-stone-900/60"
                                               : "rounded-none border-0 bg-white dark:bg-black/20"
                                         }`}>
                                          {cellEntries.length === 0 && (
                                            <div className="absolute inset-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                type="button"
                                                onClick={() => { document.body.click(); openCreate("weekly"); }}
                                                className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center hover:scale-110 hover:bg-emerald-100 transition-all border border-emerald-200/50"
                                              >
                                                <Plus className="w-5 h-5" />
                                              </button>
                                            </div>
                                          )}
                                          {cellEntries.map((entry) => {
                                            const colorConfig = SCHEDULE_COLORS.find(c => c.value === entry.color);
                                            const baseClasses = colorConfig
                                              ? `${colorConfig.class} ${colorConfig.textClass} ${colorConfig.borderClass} border shadow-sm`
                                              : "bg-muted/10 border border-border/50 text-foreground hover:border-emerald-300";
                                            return (
                                              <button
                                                key={entry.id}
                                                type="button"
                                                onClick={() => openEdit(entry)}
                                                className={`w-full rounded-xl px-2 py-2.5 text-center transition-all hover:-translate-y-0.5 z-10 ${baseClasses}`}
                                              >
                                                <span className={`block text-xs sm:text-sm font-black leading-tight ${colorConfig ? "opacity-90" : ""}`}>{entry.title}</span>
                                                {(entry.startTime || entry.endTime) && (
                                                  <span className={`mt-1 block text-[10px] sm:text-xs font-bold ${colorConfig ? "opacity-70" : "text-muted-foreground"}`} dir="ltr">
                                                    {entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ""}
                                                  </span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </td>
                                      {paperBreakPositions.has(lessonNumber) && (
                                        <td className={`relative ${tableTheme === "classic" ? "border border-border bg-amber-50/50 p-0 dark:bg-amber-900/10" : "p-2"}`}>
                                          <div className={`flex h-full min-h-[5rem] flex-col gap-2 p-1.5 ${
                                            tableTheme === "classic" ? "" : "rounded-2xl border border-amber-100/60 bg-amber-50/40"
                                          }`}>
                                            {breakEntries.map((entry) => {
                                              const colorConfig = SCHEDULE_COLORS.find(c => c.value === entry.color);
                                              const baseClasses = colorConfig
                                                ? `${colorConfig.class} ${colorConfig.textClass} ${colorConfig.borderClass} border shadow-sm`
                                                : "border border-amber-200 bg-amber-100 text-amber-900 shadow-sm";
                                              return (
                                                <button
                                                  key={entry.id}
                                                  type="button"
                                                  onClick={() => openEdit(entry)}
                                                  className={`z-10 w-full rounded-xl px-2 py-2.5 text-center transition-all hover:-translate-y-0.5 ${baseClasses}`}
                                                >
                                                  <span className="block text-xs font-black leading-tight">{entry.title}</span>
                                                  <span className="mt-1 block text-[10px] font-bold opacity-70" dir="ltr">
                                                    {entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ""}
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </td>
                                      )}
                                    </Fragment>
                                  );
                                })}
                                <td className={`relative ${tableTheme === "classic" ? "border border-border p-0" : "p-2"}`}>
                                  <div className={`flex min-h-[5rem] h-full flex-col gap-2 p-1.5 ${
                                    tableTheme === "classic"
                                      ? "rounded-none border-0 bg-amber-50/60 dark:bg-amber-900/10"
                                      : "rounded-2xl border border-amber-100/50 bg-amber-50/30 shadow-sm dark:border-amber-900/20 dark:bg-amber-900/10"
                                  }`}>
                                    {unplacedBreaks.length === 0 && (
                                      <div className="absolute inset-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={() => { document.body.click(); openCreate("break"); }}
                                          className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center hover:scale-110 hover:bg-amber-100 transition-all border border-amber-200/50"
                                        >
                                          <Plus className="w-5 h-5" />
                                        </button>
                                      </div>
                                    )}
                                    {unplacedBreaks.map((entry) => {
                                      const colorConfig = SCHEDULE_COLORS.find(c => c.value === entry.color);
                                      const baseClasses = colorConfig
                                        ? `${colorConfig.class} ${colorConfig.textClass} ${colorConfig.borderClass} border shadow-sm`
                                        : "bg-amber-100 text-amber-900 border border-amber-200 shadow-sm";
                                      return (
                                        <button
                                          key={entry.id}
                                          type="button"
                                          onClick={() => openEdit(entry)}
                                          className={`w-full rounded-xl px-2 py-2.5 text-center transition-all hover:-translate-y-0.5 z-10 ${baseClasses}`}
                                        >
                                          <span className="block text-xs sm:text-sm font-black leading-tight opacity-90">{entry.title}</span>
                                          {(entry.startTime || entry.endTime) && (
                                            <span className={`mt-1 block text-[10px] sm:text-xs font-bold ${colorConfig ? 'opacity-70' : 'text-amber-900/70'}`} dir="ltr">{entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ""}</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-16 bg-muted/10 border border-dashed border-border/60 rounded-3xl">
                        <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold text-lg mb-1">{isAr ? "لا توجد حصص أسبوعية" : "No Weekly Classes"}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Appointments Section */}
                {appointments.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-border/60 animate-in fade-in">
                    <h3 className="font-bold text-lg text-foreground mb-6 flex items-center gap-3">
                      <span className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-amber-200/50">
                        <CalendarClock className="w-5 h-5" />
                      </span>
                      {isAr ? "المواعيد" : "Appointments"}
                    </h3>
                    <div className="flex flex-col bg-amber-50/20 border border-amber-100/50 rounded-3xl px-4 sm:px-6 py-2">
                      {appointments.map((entry, idx) => (
                        <ScheduleEntryRow
                          key={entry.id}
                          entry={entry}
                          isAr={isAr}
                          isLast={idx === appointments.length - 1}
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
      </div>

      {/* --- ALL DIALOGS (kept exactly same, just rendered here) --- */}
      <Dialog open={Boolean(editingColumnLabel)} onOpenChange={(open) => { if (!open) setEditingColumnLabel(null); }}>
        <DialogContent className="max-w-sm rounded-3xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "تغيير اسم العمود" : "Rename column"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "اكتب الاسم الذي تريد ظهوره في رأس الجدول. لن يتغير ترتيب الحصص."
                : "Enter the label shown in the table header. Lesson order will not change."}
            </DialogDescription>
          </DialogHeader>
          <input
            value={columnLabelDraft}
            onChange={(event) => setColumnLabelDraft(event.target.value)}
            maxLength={40}
            autoFocus
            style={fieldStyle}
            data-testid="input-schedule-column-label"
          />
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                if (!editingColumnLabel) return;
                setColumnLabelDraft(editingColumnLabel.defaultLabel);
              }}
              style={scheduleSecondaryButton}
              data-testid="button-reset-schedule-column-label"
            >
              {isAr ? "الاسم الافتراضي" : "Default name"}
            </button>
            <button
              type="button"
              onClick={saveColumnLabel}
              style={schedulePrimaryButton}
              data-testid="button-save-schedule-column-label"
            >
              {isAr ? "حفظ الاسم" : "Save name"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogDescription className="sr-only">
              {isAr ? "أدخل تفاصيل الحصة أو الموعد لإضافته إلى جدولك." : "Enter the lesson or appointment details to add it to your schedule."}
            </DialogDescription>
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
                            data-testid={`button-schedule-kind-${kind}`}
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
                          <input {...field} type="date" style={fieldStyle} data-testid="input-schedule-appointment-date" />
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
                        <FormControl><input {...field} type="time" style={fieldStyle} data-testid="input-schedule-start-time" /></FormControl>
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
                        <FormControl><input {...field} type="time" style={fieldStyle} data-testid="input-schedule-end-time" /></FormControl>
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
                {selectedKind === "weekly" && <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{isAr ? "لون البطاقة (اختياري)" : "Card color (optional)"}</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-3 p-1">
                          <button
                            type="button"
                            onClick={() => field.onChange("")}
                            className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center bg-muted/20 ${!field.value ? 'border-foreground shadow-md scale-110' : 'border-transparent hover:scale-105'}`}
                            title={isAr ? "الافتراضي" : "Default"}
                          >
                            {!field.value && <div className="w-2 h-2 rounded-full bg-foreground" />}
                          </button>
                          {SCHEDULE_COLORS.map((color, colorIndex) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              data-testid={`button-schedule-color-${colorIndex}`}
                              className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${color.class} ${field.value === color.value ? 'border-foreground shadow-md scale-110' : 'border-transparent hover:scale-105'}`}
                              title={color.label}
                            >
                              {field.value === color.value && <div className={`w-2 h-2 rounded-full ${color.textClass}`} />}
                            </button>
                          ))}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />}
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
            <DialogDescription className="sr-only">
              {isAr ? "أدخل حصص الأسبوع وأوقاتها لحفظ الجدول كاملًا." : "Enter the week's lessons and times to save the full schedule."}
            </DialogDescription>
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
                    {isAr ? "الأيام المفعّلة" : "Active days"}
                  </div>
                  <div style={{ color: C.subtle, fontSize: 10.5, marginBottom: 10 }}>
                    {isAr ? "اضغط على كل يوم وأدخل حصصه بشكل مستقل. العلامة الخضراء تعني أن اليوم سيُحفظ." : "Open each day and enter its lessons independently. A green mark means the day will be saved."}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllBulkDays}
                      className="rounded-xl border px-3 py-2 text-xs font-bold transition-all relative overflow-hidden group"
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
                          className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all relative shadow-sm ${active ? 'scale-105 z-10' : 'hover:-translate-y-0.5'}`}
                          style={{
                            borderColor: active ? C.green : configured ? C.green : C.border,
                            background: active ? C.green : configured ? C.greenPale : C.card,
                            color: active ? "#fff" : configured ? C.green : C.text,
                            boxShadow: active ? '0 8px 20px -8px rgba(30,77,53,0.5)' : 'none'
                          }}
                        >
                          {active && (
                            <motion.div
                              layoutId="activeBulkDayPill"
                              className="absolute inset-0 rounded-xl bg-emerald-700 -z-10"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                          <span className="relative z-10">{isAr ? day.ar : day.en}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 bg-white dark:bg-black/20 p-3 rounded-xl border border-border/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <div className="text-sm font-black text-emerald-900 dark:text-emerald-400">
                        {isAr
                          ? `تعدّل الآن: ${SCHEDULE_DAYS.find((day) => day.value === activeBulkDay)?.ar}`
                          : `Editing: ${SCHEDULE_DAYS.find((day) => day.value === activeBulkDay)?.en}`}
                      </div>
                    </div>
                    {Object.keys(bulkDaySchedules).length > 1 && (
                      <button
                        type="button"
                        onClick={removeActiveBulkDay}
                        data-testid="button-remove-active-bulk-day"
                        className="text-xs font-bold text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isAr ? "إيقاف هذا اليوم" : "Disable this day"}
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

                <motion.div
                  className="space-y-3 rounded-2xl border p-3"
                  style={{ borderColor: C.border, background: C.card }}
                  animate={{ opacity: [0.82, 1], y: [3, 0] }}
                  transition={{ duration: 0.16 }}
                >
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
                            data-testid={`button-remove-bulk-lesson-${lesson.lessonNumber}`}
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
                              data-testid={`input-bulk-lesson-start-${index + 1}`}
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
                              data-testid={`input-bulk-lesson-end-${index + 1}`}
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
                        <div className="sm:col-span-12 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                          <span className="text-[10px] font-bold text-muted-foreground mr-2 ml-2 whitespace-nowrap">{isAr ? "لون البطاقة:" : "Color:"}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => bulkForm.setValue(`lessons.${index}.color`, "")}
                              className={`w-6 h-6 rounded-full border flex items-center justify-center bg-muted/20 ${!bulkForm.watch(`lessons.${index}.color`) ? 'border-foreground shadow-sm scale-110' : 'border-transparent hover:scale-110'}`}
                              title={isAr ? "الافتراضي" : "Default"}
                            >
                              {!bulkForm.watch(`lessons.${index}.color`) && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
                            </button>
                            {SCHEDULE_COLORS.map((color, colorIndex) => {
                              const selectedColor = bulkForm.watch(`lessons.${index}.color`);
                              return (
                                <button
                                  key={color.value}
                                  type="button"
                                  onClick={() => bulkForm.setValue(`lessons.${index}.color`, color.value)}
                                  data-testid={`button-bulk-lesson-color-${index + 1}-${colorIndex}`}
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center ${color.class} ${selectedColor === color.value ? 'border-foreground shadow-sm scale-110' : 'border-transparent hover:scale-110'}`}
                                  title={color.label}
                                >
                                  {selectedColor === color.value && <div className={`w-1.5 h-1.5 rounded-full ${color.textClass}`} />}
                                </button>
                              );
                            })}
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
                          <label className="mb-1 block text-xs font-bold">{isAr ? "موقع الفترة في الجدول" : "Period position"}</label>
                          <select
                            value={entry.breakAfterLesson}
                            onChange={(event) => updateBulkBreak(index, { breakAfterLesson: Number(event.target.value) })}
                            style={{ ...fieldStyle, background: "#fff" }}
                            data-testid={`select-bulk-period-position-${activeBulkDay}-${index}`}
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
                              data-testid={`input-bulk-period-start-${activeBulkDay}-${index}`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold">{isAr ? "إلى" : "To"}</label>
                            <input
                              type="time"
                              value={entry.endTime || ""}
                              onChange={(event) => updateBulkBreak(index, { endTime: event.target.value || null })}
                              style={{ ...fieldStyle, background: "#fff" }}
                              data-testid={`input-bulk-period-end-${activeBulkDay}-${index}`}
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
                </motion.div>
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

      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!isExtracting && !isPreparingImage) { setImportDialogOpen(open); if (!open) { setImportFile(null); setImportPreview(null); } } }}>
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
              ) : importFile ? (
                <div className="relative flex flex-col items-center justify-center rounded-xl border p-5" style={{ borderColor: C.border }}>
                  <ImageIcon className="mb-2 h-9 w-9" style={{ color: C.green }} />
                  <div className="max-w-full truncate text-sm font-black" style={{ color: C.text }}>{importFile.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: C.subtle }}>
                    {isPreparingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {isPreparingImage
                        ? (isAr ? "جارٍ تحويل صورة الآيفون إلى JPG…" : "Converting the iPhone image to JPG…")
                        : (isAr ? "الصورة جاهزة للاستخراج" : "The image is ready for extraction")}
                    </span>
                  </div>
                  {!isExtracting && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold"
                      style={{ borderColor: C.border, color: C.green, background: C.card }}
                    >
                      {isAr ? "اختيار صورة أخرى" : "Choose another image"}
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
                    {isAr ? "JPG أو PNG أو WebP أو HEIC — حتى ١٠ ميجابايت" : "JPG, PNG, WebP, or HEIC — up to 10MB"}
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
              disabled={isExtracting || isPreparingImage}
              style={scheduleSecondaryButton}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleExtract}
              disabled={!importFile || isExtracting || isPreparingImage}
              data-testid="button-confirm-extract-schedule"
              style={{
                ...schedulePrimaryButton,
                opacity: (!importFile || isExtracting || isPreparingImage) ? 0.65 : 1,
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
