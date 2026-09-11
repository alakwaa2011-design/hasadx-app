import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Coffee, ExternalLink, Pause, Play, Timer, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher, useListTeacherSchedule, getListTeacherScheduleQueryKey, type TeacherScheduleEntry } from "@workspace/api-client-react";
import { lessonNumberLabel } from "@/lib/schedule-labels";

type PictureInPictureManager = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

function getPictureInPictureManager() {
  return (window as Window & { documentPictureInPicture?: PictureInPictureManager }).documentPictureInPicture;
}

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
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function entryStart(entry: TeacherScheduleEntry) {
  return parseClockTime(entry.startTime);
}

function entryEnd(entry: TeacherScheduleEntry) {
  return entry.endTime ? parseClockTime(entry.endTime) : null;
}

function ActiveLessonPanel({
  entry,
  remainingMs,
  durationMs,
  isPaused,
  isAr,
  inPictureInPicture,
  onTogglePause,
  onHide,
  onOpenPictureInPicture,
  onClosePictureInPicture,
}: {
  entry: TeacherScheduleEntry;
  remainingMs: number;
  durationMs: number;
  isPaused: boolean;
  isAr: boolean;
  inPictureInPicture: boolean;
  onTogglePause: () => void;
  onHide: () => void;
  onOpenPictureInPicture: () => void;
  onClosePictureInPicture: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isBreak = entry.kind === "break";
  const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
  const urgent = remainingMs <= 5 * 60_000;
  const title = entry.title || (isBreak ? (isAr ? "استراحة / مناوبة" : "Break / Duty") : (isAr ? "الحصة الحالية" : "Current lesson"));
  const context = isBreak
    ? (isAr ? "مناوبة أو استراحة مجدولة" : "Scheduled break or duty")
    : entry.lessonNumber
      ? lessonNumberLabel(entry.lessonNumber, isAr)
      : (isAr ? "حصة مجدولة" : "Scheduled lesson");

  const brandColor = isBreak ? "#B27A00" : "#1E4D35";
  const brandBg = isBreak ? "#FFF4D6" : "#E7F1EA";
  const urgentColor = "#C44332";

  if (!isExpanded) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
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
          {isBreak ? <Coffee size={18} /> : <Timer size={18} />}
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
          <button
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
          </button>

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
          {isBreak ? <Coffee size={22} /> : <Timer size={22} />}
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
          {isPaused ? (isAr ? "متوقف مؤقتًا" : "Paused") : (isAr ? "المتبقي على النهاية" : "Time until end")}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {!inPictureInPicture && getPictureInPictureManager() && (
              <button
                type="button"
                onClick={onOpenPictureInPicture}
                title={isAr ? "فتح خارج التبويب" : "Open outside this tab"}
                aria-label={isAr ? "فتح المؤقت في نافذة عائمة" : "Open timer in a floating window"}
                style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid #D8E4DC", background: "#fff", color: "#1E4D35", display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.2s" }}
              >
                <ExternalLink size={20} />
              </button>
            )}
            {inPictureInPicture && (
              <button
                type="button"
                onClick={onClosePictureInPicture}
                title={isAr ? "إغلاق النافذة العائمة" : "Close floating window"}
                aria-label={isAr ? "إغلاق النافذة العائمة" : "Close floating window"}
                style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid #D8E4DC", background: "#fff", color: "#688075", display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.2s" }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <button
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
          </button>
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
          <span>{isAr ? `بدأت ${entry.startTime}` : `Started ${entry.startTime}`}</span>
          <span>{isAr ? `تنتهي ${entry.endTime}` : `Ends ${entry.endTime}`}</span>
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
  const [pictureInPictureWindow, setPictureInPictureWindow] = useState<Window | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const currentMinutesMs = (today.getHours() * 60 + today.getMinutes()) * 60_000 + today.getSeconds() * 1_000 + today.getMilliseconds();
  const activeEntry = useMemo(() => {
    const candidates = (scheduleQuery.data || [])
      .filter((entry) => (entry.kind === "weekly" || entry.kind === "break") && entry.dayOfWeek === today.getDay() && entry.endTime)
      .filter((entry) => {
        const start = entryStart(entry);
        const end = entryEnd(entry);
        return end != null && end > start && currentMinutesMs >= start && currentMinutesMs < end;
      })
      .sort((a, b) => entryStart(a) - entryStart(b));
    return candidates[candidates.length - 1] || null;
  }, [currentMinutesMs, scheduleQuery.data, today]);

  const activeKey = activeEntry ? `${dateKey(today)}:${activeEntry.id}` : null;
  const durationMs = activeEntry ? Math.max(1, (entryEnd(activeEntry) || 0) - entryStart(activeEntry)) : 1;
  const liveRemainingMs = activeEntry ? Math.max(0, (entryEnd(activeEntry) || 0) - currentMinutesMs) : 0;
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
    if (!pictureInPictureWindow) return;
    const onPageHide = () => setPictureInPictureWindow(null);
    pictureInPictureWindow.addEventListener("pagehide", onPageHide);
    return () => pictureInPictureWindow.removeEventListener("pagehide", onPageHide);
  }, [pictureInPictureWindow]);

  async function openPictureInPicture() {
    const manager = getPictureInPictureManager();
    if (!manager || !activeEntry) return;
    try {
      const pip = await manager.requestWindow({ width: 360, height: 230 });
      pip.document.title = isAr ? "عداد الحصة" : "Lesson countdown";
      pip.document.body.style.margin = "0";
      pip.document.body.style.padding = "12px";
      pip.document.body.style.background = "#F2F0EB";
      pip.document.body.style.display = "flex";
      pip.document.body.style.alignItems = "flex-start";
      pip.document.body.style.justifyContent = "center";
      setPictureInPictureWindow(pip);
    } catch {
      // Browser denied the user-initiated floating window; the in-page card remains available.
    }
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

  if (userLoading || !user || !activeEntry || !activeKey || hiddenKey === activeKey) return null;

  const panel = (
    <ActiveLessonPanel
      entry={activeEntry}
      remainingMs={remainingMs}
      durationMs={durationMs}
      isPaused={isPaused}
      isAr={isAr}
      inPictureInPicture={Boolean(pictureInPictureWindow)}
      onTogglePause={togglePause}
      onHide={() => {
        setHiddenKey(activeKey);
        setPictureInPictureWindow(null);
      }}
      onOpenPictureInPicture={openPictureInPicture}
      onClosePictureInPicture={() => pictureInPictureWindow?.close()}
    />
  );

  return (
    <>
      {!pictureInPictureWindow && (
        <div style={{ position: "fixed", zIndex: 60, bottom: "max(1rem, env(safe-area-inset-bottom, 1rem))", left: "max(1rem, env(safe-area-inset-left, 1rem))" }}>
          {panel}
        </div>
      )}
      {pictureInPictureWindow && createPortal(panel, pictureInPictureWindow.document.body)}
    </>
  );
}