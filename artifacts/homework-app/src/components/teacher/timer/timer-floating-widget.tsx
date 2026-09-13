import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTimerEngine, evaluateMilestones } from "@/lib/use-timer-engine";
import { Play, Pause, X, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { timerStore } from "@/lib/timer-store";
import { playTimerSound, playMilestoneSound, initAudioContext } from "@/lib/timer-sounds";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { shouldShowFloatingTimer, shouldAutoMinimizeTimer, handleTimerAuthTransition } from "@/lib/timer-policies";
import { StableReadout } from "./timer-widget-core";
import { claimLocalTimerSound, markTimerHandled, restoreTimerFromServer } from "@/lib/timer-server-sync";
import { enableCurrentDevicePushNotifications } from "@/components/push-notifications";
import { toast } from "@/components/ui/sonner";

let timerNotificationPromptAttempted = false;

export function GlobalTeacherTimer() {
  const [location, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  
  const { data: user, isLoading } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });

  const { state, elapsedMs, remainingMs, isOvertime, hasCrossedZero, start, pause, reset, closeTool } = useTimerEngine();

  useEffect(() => {
    handleTimerAuthTransition(
      isLoading,
      user?.id,
      (id) => {
        timerStore.initForUser(id);
        void restoreTimerFromServer(id);
      },
      () => timerStore.clearUser()
    );
  }, [user?.id, isLoading]);

  // Handle completion sound
  useEffect(() => {
    if (!state.initializedUserId || state.initializedUserId !== user?.id) return;
    if (state.mode === "countdown" && hasCrossedZero && state.isActive && !state.completedHandled) {
      if (!state.soundMuted && state.serverRunId) {
        void claimLocalTimerSound(state.serverRunId).then((claimed) => {
          if (claimed) playTimerSound(state.soundSelection, state.soundVolume);
        });
      }
      timerStore.setState({ completedHandled: true });
      if (state.serverRunId) markTimerHandled(state.serverRunId);
    }
  }, [hasCrossedZero, state.mode, state.isActive, state.completedHandled, state.soundMuted, state.soundSelection, state.soundVolume, state.initializedUserId, user?.id]);

  // Handle milestones
  useEffect(() => {
    if (!state.initializedUserId || state.initializedUserId !== user?.id) return;
    if (state.mode !== "countdown" || !state.isRunning) return;
    if (state.soundMuted || !state.soundMilestonesEnabled) return;

    const { crossed, soundToPlay } = evaluateMilestones(remainingMs, state.targetMs, state.milestonesFired);

    if (crossed.length > 0) {
      if (soundToPlay) {
        playMilestoneSound(soundToPlay.type, state.soundVolume);
      }
      
      timerStore.setState(prev => {
        const newFired = { ...prev.milestonesFired };
        crossed.forEach(sec => newFired[sec] = true);
        return { milestonesFired: newFired };
      });
    }

  }, [remainingMs, state.mode, state.isRunning, state.soundMuted, state.soundMilestonesEnabled, state.milestonesFired, state.targetMs, state.initializedUserId, user?.id, state.soundVolume]);

  const pathOnly = location.split("?")[0].split("#")[0];
  const shouldShow = shouldShowFloatingTimer(pathOnly);
  const shouldAutoMinimize = shouldAutoMinimizeTimer(pathOnly);
  const isActuallyMinimized = state.isMinimized || shouldAutoMinimize;

  if (isLoading || !user || state.initializedUserId !== user.id || !state.isActive || !shouldShow) return null;

  const handleClose = () => {
    if (state.isRunning) {
      const msg = isAr ? "المؤقت يعمل حالياً. هل أنت متأكد من الإغلاق؟" : "Timer is running. Are you sure you want to close?";
      if (!confirm(msg)) return;
    }
    reset(); 
    closeTool();
  };

  const handleExpandToFull = () => {
    setLocation("/teacher/tools/timer");
  };
  
  const toggleMinimize = () => {
    timerStore.setState({ isMinimized: !state.isMinimized });
  };

  const handlePlayPause = () => {
    initAudioContext(); 
    if (state.isRunning) {
      pause();
    } else {
      if (state.mode === "countdown" && !timerNotificationPromptAttempted) {
        timerNotificationPromptAttempted = true;
        void enableCurrentDevicePushNotifications(lang)
          .then(() => {
            toast.success(isAr
              ? "تم تفعيل تنبيه انتهاء المؤقت على هذا الجهاز"
              : "Timer completion alerts are enabled on this device");
          })
          .catch((error) => {
            toast.error(error instanceof Error
              ? error.message
              : (isAr ? "تعذّر تفعيل تنبيه المؤقت" : "Could not enable timer alerts"));
          });
      }
      start();
    }
  };

  const displayMs = state.mode === "countdown" ? remainingMs : elapsedMs;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={`fixed z-50 flex bg-card border border-border shadow-2xl transition-all duration-300 ${isActuallyMinimized ? "items-center rounded-full px-4 py-2 gap-3" : "flex-col rounded-2xl p-4 min-w-[240px] gap-4"}`}
        style={{ 
          direction: isAr ? "rtl" : "ltr",
          bottom: isActuallyMinimized ? "max(5rem, env(safe-area-inset-bottom, 5rem))" : "max(1rem, env(safe-area-inset-bottom, 1rem))",
          right: "max(1rem, env(safe-area-inset-right, 1rem))"
        }}
      >
        {isActuallyMinimized ? (
          <>
            {/* Minimized Pill View */}
            <div className="flex flex-col items-start min-w-[65px] cursor-pointer" onClick={toggleMinimize} aria-label={isAr ? "توسيع البطاقة" : "Expand card"}>
              <StableReadout 
                ms={displayMs}
                showMs={state.mode === "stopwatch"}
                isOvertime={isOvertime}
                className="text-lg font-black tracking-tight"
              />
              {state.taskName && (
                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[120px] mt-0.5">
                  {state.taskName}
                </span>
              )}
            </div>

            <div className="w-px h-6 bg-border mx-1" />

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePlayPause}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${state.isRunning ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-muted text-foreground'}`}
                aria-label={state.isRunning ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
              >
                {state.isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              
              <button
                onClick={handleExpandToFull}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
                title={isAr ? "فتح الأداة بالكامل" : "Open full tool"}
                aria-label={isAr ? "فتح الأداة بالكامل" : "Open full tool"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title={isAr ? "إغلاق" : "Close"}
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Expanded Card View */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {state.mode === "countdown" ? (isAr ? "مؤقت تنازلي" : "Countdown") : (isAr ? "ساعة إيقاف" : "Stopwatch")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleMinimize}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                  title={isAr ? "تصغير" : "Minimize"}
                  aria-label={isAr ? "تصغير" : "Minimize"}
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleExpandToFull}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                  title={isAr ? "فتح الأداة بالكامل" : "Open full tool"}
                  aria-label={isAr ? "فتح الأداة بالكامل" : "Open full tool"}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title={isAr ? "إغلاق" : "Close"}
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center py-2">
              <StableReadout 
                ms={displayMs}
                showMs={state.mode === "stopwatch"}
                isOvertime={isOvertime}
                className="text-5xl font-black tracking-tighter"
              />
              {state.taskName && (
                <span className="text-sm font-bold text-muted-foreground truncate w-full text-center mt-2">
                  {state.taskName}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={reset}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                title={isAr ? "إعادة ضبط" : "Reset"}
                aria-label={isAr ? "إعادة ضبط" : "Reset"}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              <button
                onClick={handlePlayPause}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${state.isRunning ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                aria-label={state.isRunning ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
              >
                {state.isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
