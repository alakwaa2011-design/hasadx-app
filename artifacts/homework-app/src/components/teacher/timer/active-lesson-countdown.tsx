import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation } from "wouter";
import { CalendarClock, ChevronDown, ChevronUp, Coffee, Pause, Play, Timer, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher, useListTeacherSchedule, getListTeacherScheduleQueryKey, type TeacherScheduleEntry } from "@workspace/api-client-react";
import { lessonNumberLabel } from "@/lib/schedule-labels";
import {
  useScheduleCountdownPreferences,
} from "@/lib/schedule-countdown-preferences";
import { playTimerSound } from "@/lib/timer-sounds";

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

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function entryStart(entry: TeacherScheduleEntry) {
  return parseClockTime(entry.startTime);
}

function entryEnd(entry: TeacherScheduleEntry) {
  return entry.endTime ? parseClockTime(entry.endTime) : null;
}

export function selectVisibleScheduleEntry(
  entries: TeacherScheduleEntry[],
  now: Date,
  alertMinutes: number,
) {
  const currentTimeMs =
    (now.getHours() * 60 + now.getMinutes()) * 60_000
    + now.getSeconds() * 1_000
    + now.getMilliseconds();
  const todayKey = dateKey(now);
  const todayEntries = entries
    .filter((entry) => {
      if (entry.kind === "appointment") {
        return entry.appointmentDate === todayKey;
      }
      return (entry.kind === "weekly" || entry.kind === "break")
        && entry.dayOfWeek === now.getDay();
    })
    .sort((a, b) => entryStart(a) - entryStart(b));

  const activeCandidates = todayEntries.filter((entry) => {
    const start = entryStart(entry);
    const end = entryEnd(entry);
    return end != null && end > start && currentTimeMs >= start && currentTimeMs < end;
  });
  const active = activeCandidates[activeCandidates.length - 1] || null;
  if (active) return { visibleEntry: active, isBeforeStart: false, currentTimeMs };

  const alertWindowMs = Math.max(1, alertMinutes) * 60_000;
  const upcoming = todayEntries.find((entry) => {
    const untilStart = entryStart(entry) - currentTimeMs;
    return untilStart > 0 && untilStart <= alertWindowMs;
  }) || null;
  return { visibleEntry: upcoming, isBeforeStart: Boolean(upcoming), currentTimeMs };
}

function ActiveLessonPanel({
  entry,
  remainingMs,
  durationMs,
  isPaused,
  isBeforeStart,
  isAr,
  onTogglePause,
  onHide,
  onDragStart,
}: {
  entry: TeacherScheduleEntry;
  remainingMs: number;
  durationMs: number;
  isPaused: boolean;
  isBeforeStart: boolean;
  isAr: boolean;
  onTogglePause: () => void;
  onHide: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isBreak = entry.kind === "break";
  const isAppointment = entry.kind === "appointment";
  const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
  const urgent = !isBeforeStart && remainingMs <= 5 * 60_000;
  const title = entry.title || (
    isBreak
      ? (isAr ? "استراحة / مناوبة" : "Break / Duty")
      : isAppointment
        ? (isAr ? "الموعد الحالي" : "Current appointment")
        : (isAr ? "الحصة الحالية" : "Current lesson")
  );
  const context = isBreak
    ? (isAr ? "مناوبة أو استراحة مجدولة" : "Scheduled break or duty")
    : isAppointment
      ? (isAr ? "موعد مجدول" : "Scheduled appointment")
    : entry.lessonNumber
      ? lessonNumberLabel(entry.lessonNumber, isAr)
      : (isAr ? "حصة مجدولة" : "Scheduled lesson");

  const brandColor = isBreak ? "#B27A00" : isAppointment ? "#8A5A12" : "#1E4D35";
  const brandBg = isBreak ? "#FFF4D6" : isAppointment ? "#FFF7E8" : "#E7F1EA";
  const urgentColor = "#C44332";

  if (!isExpanded) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        onPointerDown={onDragStart}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: `1px solid ${isBreak ? "rgba(201,146,10,.32)" : "rgba(30,77,53,.24)"}`,
          borderRadius: 99,
          padding: "8px 12px 8px 8px",
          background: "rgba(255,255,255,.98)",
          color: "#19352A",
          boxShadow: "0 8px 32px rgba(15,61,40,.12)",
          fontFamily: "'Tajawal', sans-serif",
          backdropFilter: "blur(12px)",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          width: "max-content",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            background: brandBg,
            color: brandColor,
          }}
        >
          {isBreak ? <Coffee size={18} /> : isAppointment ? <CalendarClock size={18} /> : <Timer size={18} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 64 }}>
          <div
            style={{
              color: urgent ? urgentColor : brandColor,
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              fontVariantNumeric: "tabular-nums",
              direction: "ltr",
              textAlign: isAr ? "right" : "left",
            }}
          >
            {formatRemaining(remainingMs)}
          </div>
          <div style={{ height: 4, borderRadius: 99, background: "#E7EEE9", overflow: "hidden", marginTop: 4, width: "100%" }}>
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                borderRadius: 99,
                background: urgent ? urgentColor : brandColor,
                transition: "width .4s linear",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: isAr ? 0 : 8, marginRight: isAr ? 8 : 0 }}>
          {!isBeforeStart && <button
            type="button"
            onClick={onTogglePause}
            title={isPaused ? (isAr ? "متابعة العد" : "Resume") : (isAr ? "إيقاف العد" : "Pause")}
            aria-label={isPaused ? (isAr ? "متابعة العد" : "Resume countdown") : (isAr ? "إيقاف العد" : "Pause countdown")}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: 0,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              background: isPaused ? brandColor : "transparent",
              color: isPaused ? "#fff" : brandColor,
              transition: "all 0.2s",
            }}
          >
            {isPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
          </button>}

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            title={isAr ? "تكبير البطاقة" : "Expand card"}
            aria-label={isAr ? "تكبير بطاقة المؤقت" : "Expand timer card"}
            style={{ width: 32, height: 32, borderRadius: "50%", border: 0, background: "transparent", color: "#688075", display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.2s" }}
          >
            <ChevronUp size={20} />
          </button>
          <button
            type="button"
            onClick={onHide}
            title={isAr ? "الخروج من التوقيت" : "Close this countdown"}
            aria-label={isAr ? "الخروج من توقيت الفترة الحالية" : "Close the current countdown"}
            style={{ width: 32, height: 32, borderRadius: "50%", border: 0, background: "transparent", color: "#8C4740", display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.2s" }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      onPointerDown={onDragStart}
      style={{
        width: "min(380px, calc(100vw - 24px))",
        border: `1px solid ${isBreak ? "rgba(201,146,10,.32)" : "rgba(30,77,53,.24)"}`,
        borderRadius: 24,
        padding: 20,
        background: "rgba(255,255,255,.98)",
        color: "#19352A",
        boxShadow: "0 18px 45px rgba(15,61,40,.18)",
        fontFamily: "'Tajawal', sans-serif",
        backdropFilter: "blur(12px)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        cursor: "grab",
        touchAction: "none",
      }}
    >
      {/* Top Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "76px minmax(0, 1fr) 76px", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            justifySelf: "start",
            background: brandBg,
            color: brandColor,
          }}
        >
            {isBreak ? <Coffee size={22} /> : isAppointment ? <CalendarClock size={22} /> : <Timer size={22} />}
        </div>
        <div style={{ minWidth: 0, textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#11261E" }}>
            {title}
          </div>
          <div style={{ color: "#688075", fontSize: 13, marginTop: 3, fontWeight: 600 }}>{context}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            title={isAr ? "تصغير البطاقة" : "Shrink card"}
            aria-label={isAr ? "تصغير بطاقة المؤقت" : "Shrink timer card"}
            style={{ border: 0, background: "transparent", color: "#7A8B83", cursor: "pointer", padding: 8, borderRadius: "50%", display: "grid", placeItems: "center" }}
          >
            <ChevronDown size={20} />
          </button>
          <button
            type="button"
            onClick={onHide}
            title={isAr ? "الخروج من التوقيت" : "Close this countdown"}
            aria-label={isAr ? "الخروج من توقيت الفترة الحالية" : "Close the current countdown"}
            style={{ border: 0, background: "transparent", color: "#8C4740", cursor: "pointer", padding: 8, borderRadius: "50%", display: "grid", placeItems: "center" }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 28 }}>
        <div style={{ color: "#688075", fontSize: 13, fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {isBeforeStart
            ? isAppointment
              ? (isAr ? "يبدأ الموعد بعد" : "Appointment starts in")
              : isBreak
                ? (isAr ? "تبدأ الفترة بعد" : "Period starts in")
                : (isAr ? "تبدأ الحصة بعد" : "Lesson starts in")
            : isPaused
              ? (isAr ? "متوقف مؤقتًا" : "Paused")
              : (isAr ? "المتبقي على النهاية" : "Time until end")}
        </div>
        <div
          style={{
            color: urgent ? urgentColor : brandColor,
            fontSize: 64,
            lineHeight: 1,
            fontWeight: 950,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
            textShadow: urgent ? "0 4px 24px rgba(196, 67, 50, 0.2)" : "0 4px 24px rgba(30, 77, 53, 0.15)",
          }}
        >
          {formatRemaining(remainingMs)}
        </div>
      </div>

      {/* Bottom Controls & Progress */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
          {!isBeforeStart && <button
            type="button"
            onClick={onTogglePause}
            title={isPaused ? (isAr ? "متابعة العد" : "Resume countdown") : (isAr ? "إيقاف العد" : "Pause countdown")}
            aria-label={isPaused ? (isAr ? "متابعة العد" : "Resume countdown") : (isAr ? "إيقاف العد" : "Pause countdown")}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 14,
              border: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              background: isPaused ? brandColor : brandBg,
              color: isPaused ? "#fff" : brandColor,
              fontWeight: 800,
              fontSize: 14,
              transition: "all 0.2s",
            }}
          >
            {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
            <span>{isPaused ? (isAr ? "متابعة" : "Resume") : (isAr ? "إيقاف" : "Pause")}</span>
          </button>}
        </div>

        <div style={{ height: 8, borderRadius: 99, background: "#E7EEE9", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              borderRadius: 99,
              background: urgent ? urgentColor : brandColor,
              transition: "width .4s linear",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#789087", fontSize: 11, marginTop: 8, fontWeight: 600 }}>
          <span>
            {isBeforeStart
              ? isAr ? `يبدأ ${entry.startTime}` : `Starts ${entry.startTime}`
              : isAr ? `بدأ ${entry.startTime}` : `Started ${entry.startTime}`}
          </span>
          {entry.endTime && <span>{isAr ? `ينتهي ${entry.endTime}` : `Ends ${entry.endTime}`}</span>}
        </div>
      </div>
    </div>
  );
}

export function GlobalActiveLessonCountdown() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const { data: user, isLoading: userLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const scheduleQuery = useListTeacherSchedule({
    query: {
      enabled: Boolean(user),
      queryKey: getListTeacherScheduleQueryKey(),
      refetchInterval: 60_000,
    } as any,
  });
  const [now, setNow] = useState(() => Date.now());
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);
  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(0);
  const { preferences, setPreferences, updatePreferences } = useScheduleCountdownPreferences(user?.id, lang);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const soundedKeyRef = useRef<string | null>(null);
  const endSoundedKeyRef = useRef<string | null>(null);

  // Hide floating countdown on the schedule page because it's integrated inline there
  const [location] = useLocation();
  const isSchedulePage = location === "/teacher/tools/schedule";

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const { visibleEntry, isBeforeStart, currentTimeMs } = useMemo(
    () => selectVisibleScheduleEntry(scheduleQuery.data || [], today, preferences.alertMinutes),
    [preferences.alertMinutes, scheduleQuery.data, today],
  );

  const activeKey = visibleEntry ? `${dateKey(today)}:${visibleEntry.id}:${isBeforeStart ? "before" : "active"}` : null;
  const durationMs = visibleEntry
    ? isBeforeStart
      ? preferences.alertMinutes * 60_000
      : Math.max(1, (entryEnd(visibleEntry) || 0) - entryStart(visibleEntry))
    : 1;
  const liveRemainingMs = visibleEntry
    ? Math.max(0, (isBeforeStart ? entryStart(visibleEntry) : (entryEnd(visibleEntry) || 0)) - currentTimeMs)
    : 0;
  const isPaused = activeKey != null && pausedKey === activeKey;
  const remainingMs = isPaused ? pausedRemainingMs : liveRemainingMs;

  useEffect(() => {
    if (!activeKey) {
      setHiddenKey(null);
      setPausedKey(null);
      setPausedRemainingMs(0);
      return;
    }
    setHiddenKey((previous) => previous === activeKey ? previous : null);
    setPausedKey((previous) => previous === activeKey ? previous : null);
  }, [activeKey]);

  useEffect(() => {
    if (!preferences.enabled || !activeKey || !isBeforeStart || !preferences.soundEnabled || soundedKeyRef.current === activeKey) return;
    soundedKeyRef.current = activeKey;
    playTimerSound(preferences.soundId, 0.55);
  }, [activeKey, isBeforeStart, preferences.enabled, preferences.soundEnabled, preferences.soundId]);

  useEffect(() => {
    if (
      !preferences.enabled
      || !activeKey
      || isBeforeStart
      || !preferences.soundEnabled
      || preferences.endAlertMinutes <= 0
      || remainingMs <= 0
      || remainingMs > preferences.endAlertMinutes * 60_000
      || endSoundedKeyRef.current === activeKey
    ) return;
    endSoundedKeyRef.current = activeKey;
    playTimerSound(preferences.soundId, 0.48);
  }, [
    activeKey,
    isBeforeStart,
    preferences.enabled,
    preferences.endAlertMinutes,
    preferences.soundEnabled,
    preferences.soundId,
    remainingMs,
  ]);

  useEffect(() => {
    function keepInsideViewport() {
      if (!preferences.position || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const next = {
        x: Math.max(8, Math.min(preferences.position.x, window.innerWidth - rect.width - 8)),
        y: Math.max(8, Math.min(preferences.position.y, window.innerHeight - rect.height - 8)),
      };
      if (next.x !== preferences.position.x || next.y !== preferences.position.y) {
        updatePreferences({ position: next });
      }
    }
    window.addEventListener("resize", keepInsideViewport);
    keepInsideViewport();
    return () => window.removeEventListener("resize", keepInsideViewport);
  }, [preferences.position]);

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, label")) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    let latest = { x: rect.left, y: rect.top };

    const move = (moveEvent: PointerEvent) => {
      const currentRect = wrapper.getBoundingClientRect();
      latest = {
        x: Math.max(8, Math.min(moveEvent.clientX - offsetX, window.innerWidth - currentRect.width - 8)),
        y: Math.max(8, Math.min(moveEvent.clientY - offsetY, window.innerHeight - currentRect.height - 8)),
      };
      setPreferences((current) => ({ ...current, position: latest }));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      updatePreferences({ position: latest });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  function togglePause() {
    if (!activeKey) return;
    if (isPaused) {
      setPausedKey(null);
      setPausedRemainingMs(0);
    } else {
      setPausedKey(activeKey);
      setPausedRemainingMs(liveRemainingMs);
    }
  }

  if (!preferences.enabled || userLoading || !user || !visibleEntry || !activeKey || hiddenKey === activeKey || isSchedulePage) return null;

  const panel = (
    <ActiveLessonPanel
      entry={visibleEntry}
      remainingMs={remainingMs}
      durationMs={durationMs}
      isPaused={isPaused}
      isBeforeStart={isBeforeStart}
      isAr={isAr}
      onTogglePause={togglePause}
      onHide={() => {
        setHiddenKey(activeKey);
      }}
      onDragStart={startDragging}
    />
  );

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "fixed",
        zIndex: 60,
        left: preferences.position ? preferences.position.x : "max(1rem, env(safe-area-inset-left, 1rem))",
        top: preferences.position ? preferences.position.y : undefined,
        bottom: preferences.position ? undefined : "max(1rem, env(safe-area-inset-bottom, 1rem))",
      }}
    >
      {panel}
    </div>
  );
}