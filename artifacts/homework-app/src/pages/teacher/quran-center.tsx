import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher, useListQuranSurahs } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, Users, LayoutDashboard, ClipboardCheck, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholders for the child views
import { QuranDashboard } from "./quran-center/quran-dashboard";
import { QuranCircles } from "./quran-center/quran-circles";
import { QuranReviewQueue } from "./quran-center/quran-review-queue";
import { QuranPagesView } from "./quran-pages-view";

type Tab = "dashboard" | "circles" | "queue" | "mushaf";

export default function QuranCenter() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const requestedTab = searchParams.get("tab");
  const tabFromQuery: Tab = requestedTab === "circles" || requestedTab === "queue" || requestedTab === "mushaf"
    ? requestedTab
    : "dashboard";
  const [activeTab, setActiveTab] = useState<Tab>(tabFromQuery);

  useEffect(() => {
    if (tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setLocation(`/teacher/quran-center?tab=${tab}`);
  };

  const { data: teacher, isLoading: authLoading } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });

  const { data: surahs } = useListQuranSurahs();

  useEffect(() => {
    if (!authLoading && !teacher) {
      setLocation(`/login?redirect=${encodeURIComponent("/teacher/quran-center")}`);
    }
  }, [authLoading, setLocation, teacher]);

  if (authLoading) {
    return (
      <Layout>
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2
            className="h-8 w-8 animate-spin text-emerald-700"
            aria-label={lang === "ar" ? "جارٍ التحميل" : "Loading"}
          />
        </div>
      </Layout>
    );
  }

  if (!teacher) return null;

  const TABS = [
    { id: "dashboard", label: lang === "ar" ? "الرئيسية" : "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "mushaf", label: lang === "ar" ? "المصحف" : "Mushaf", icon: <BookOpen className="w-5 h-5" /> },
    { id: "circles", label: lang === "ar" ? "الحلقات والطلاب" : "Circles & Students", icon: <Users className="w-5 h-5" /> },
    { id: "queue", label: lang === "ar" ? "طابور المراجعة" : "Review Queue", icon: <ClipboardCheck className="w-5 h-5" /> }
  ] as const;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] overflow-hidden bg-[#fcfaf8] dark:bg-background">
        {/* Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-e border-border/60 bg-white dark:bg-card flex md:flex-col shadow-sm z-10 shrink-0">
          <div className="p-4 md:p-6 flex items-center justify-between md:justify-start">
            <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-400 md:mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shadow-inner shrink-0">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <h1 className="font-black text-base md:text-lg leading-none tracking-tight">
                  {lang === "ar" ? "مركز القرآن" : "Quran Center"}
                </h1>
                <p className="hidden md:block text-[11px] font-bold text-emerald-600/70 dark:text-emerald-500/70 mt-1">
                  {lang === "ar" ? "إدارة الحلقات والحفظ" : "Memorization & Circles"}
                </p>
              </div>
            </div>
          </div>
          
          <nav className="flex md:flex-col flex-1 px-2 md:px-4 space-x-2 md:space-x-0 rtl:space-x-reverse md:space-y-1 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 items-center md:items-stretch">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as Tab)}
                  className={cn(
                    "flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all relative overflow-hidden shrink-0",
                    isActive 
                      ? "text-emerald-900 dark:text-emerald-50 bg-emerald-50 dark:bg-emerald-900/40 shadow-sm border border-emerald-100 dark:border-emerald-800" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                  )}
                >
                  {isActive && (
                    <span className="hidden md:block absolute start-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-e-full" />
                  )}
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto"
            >
              {activeTab === "dashboard" && <QuranDashboard surahs={surahs || []} onNavigate={handleTabChange} />}
              {activeTab === "mushaf" && (
                <QuranPagesView
                  initialSurah={1}
                  initialAyah={1}
                  onNavigate={() => {}}
                  isTaskAyah={() => false}
                  startAyah={null}
                  endAyah={null}
                  mode={null}
                  embedded
                />
              )}
              {activeTab === "circles" && <QuranCircles surahs={surahs || []} />}
              {activeTab === "queue" && <QuranReviewQueue surahs={surahs || []} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </Layout>
  );
}
