import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { useTimerEngine } from "@/lib/use-timer-engine";
import { timerStore } from "@/lib/timer-store";
import { TimerWidgetCore } from "@/components/teacher/timer/timer-widget-core";
import { useGetCurrentTeacher } from "@workspace/api-client-react";

export default function TimerToolPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();
  const { state, openTool } = useTimerEngine();
  const { data: user, isLoading } = useGetCurrentTeacher({ query: { retry: false } as any });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);
  
  useEffect(() => {
    // Only open if the global store has been initialized with the current user
    if (state.initializedUserId === user?.id && user?.id) {
      openTool();
      timerStore.setState({ isMinimized: false, studentDisplayActive: false });
    }
  }, [openTool, state.initializedUserId, user?.id]);

  if (isLoading || !user || state.initializedUserId !== user.id) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl overflow-hidden">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          {isAr ? "المؤقت وساعة الإيقاف" : "Timer & Stopwatch"}
        </h1>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-0 sm:p-6 min-h-[600px] flex flex-col w-full">
          <TimerWidgetCore isFullPage={true} />
        </div>
      </div>
    </Layout>
  );
}
