import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee, ExternalLink, Pause, Play, Timer, X } from "lucide-react";
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
  const isBreak = entry.kind === "break";
  const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
  const urgent = remainingMs <= 5 * 60_000;
  const title = entry.title || (isBreak ? (isAr ? "استراحة / مناوبة" : "Break / Duty") : (isAr ? "الحصة الحالية" : "Current lesson"));
  const context = isBreak
    ? (isAr ? "مناوبة أو استراحة مجدولة" : "Scheduled break or duty")
    : entry.lessonNumber
      ? lessonNumberLabel(entry.lessonNumber, isAr)
      : (isAr ? "حصة مجدولة" : "Scheduled lesson");

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{
        width: "min(340px, calc(100vw - 24px))",
        border: `1px solid ${isBreak ? "rgba(201,146,10,.32)" : "rgba(30,77,53,.24)"}`,
        borderRadius: 18,
        padding: 14,
        background: "rgba(255,255,255,.97)",
        color: "#19352A",
        boxShadow: "0 18px 45px rgba(15,61,40,.18)",
        fontFamily: "'Tajawal', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              background: isBreak ? "#FFF4D6" : "#E7F1EA",
              color: isBreak ? "#B27A00" : "#1E4D35",
            }}
          >
            {isBreak ? <Coffee size={17} /> : <Timer size={17} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </div>
            <div style={{ color: "#688075", fontSize: 10.5, marginTop: 2 }}>{context}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onHide}
          title={isAr ? "إخفاء حتى نهاية الفترة" : "Hide until this period ends"}
          aria-label={isAr ? "إخفاء العداد" : "Hide countdown"}
          style={{ border: 0, background: "transparent", color: "#7A8B83", cursor: "pointer", padding: 5 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ color: "#688075", fontSize: 10.5, fontWeight: 800 }}>
            {isPaused ? (isAr ? "متوقف مؤقتًا" : "Paused") : (isAr ? "المتبقي على النهاية" : "Time until end")}
          </div>
          <div
            style={{
              color: urgent ? "#B42318" : isBreak ? "#B27A00" : "#1E4D35",
              fontSize: 34,
              lineHeight: 1,
              fontWeight: 950,
              letterSpacing: "-0.06em",
              fontVariantNumeric: "tabular-nums",
              direction: "ltr",
              marginTop: 5,
            }}
          >
            {formatRemaining(remainingMs)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onTogglePause}
            title={isPaused ? (isAr ? "متابعة العد" : "Resume countdown") : (isAr ? "إيقاف العد" : "Pause countdown")}
            aria-label={isPaused ? (isAr ? "متابعة العد" : "Resume countdown") : (isAr ? "إيقاف العد" : "Pause countdown")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 0,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              background: isPaused ? "#1E4D35" : "#E7F1EA",
              color: isPaused ? "#fff" : "#1E4D35",
            }}
          >
            {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
          </button>
          {!inPictureInPicture && getPictureInPictureManager() && (
            <button
              type="button"
              onClick={onOpenPictureInPicture}
              title={isAr ? "فتح خارج التبويب" : "Open outside this tab"}
              aria-label={isAr ? "فتح العداد في نافذة عائمة" : "Open countdown in floating window"}
              style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid #D8E4DC", background: "#fff", color: "#1E4D35", display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <ExternalLink size={16} />
            </button>
          )}
          {inPictureInPicture && (
            <button
              type="button"
              onClick={onClosePictureInPicture}
              title={isAr ? "إغلاق النافذة العائمة" : "Close floating window"}
              aria-label={isAr ? "إغلاق النافذة العائمة" : "Close floating window"}
              style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid #D8E4DC", background: "#fff", color: "#688075", display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 7, borderRadius: 99, background: "#E7EEE9", overflow: "hidden", marginTop: 12 }}>
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            borderRadius: 99,
            background: urgent ? "#C44332" : isBreak ? "#C9920A" : "#1E4D35",
            transition: "width .4s linear",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#789087", fontSize: 10, marginTop: 7 }}>
        <span>{isAr ? `بدأت ${entry.startTime}` : `Started ${entry.startTime}`}</span>
        <span>{isAr ? `تنتهي ${entry.endTime}` : `Ends ${entry.endTime}`}</span>
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