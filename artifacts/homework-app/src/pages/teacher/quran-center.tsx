import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher, useListQuranSurahs } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Users, ClipboardCheck, Loader2, Bookmark, ChevronLeft, ChevronRight, X, Brain, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { QuranCircles } from "./quran-center/quran-circles";
import { QuranReviewQueue } from "./quran-center/quran-review-queue";
import { QuranSmartReview } from "./quran-center/quran-smart-review";
import { QuranPagesView } from "./quran-pages-view";
import { QuranBookmarksPanel } from "@/components/quran/quran-bookmarks-panel";
import { useQuranReaderState } from "@/components/quran/use-quran-reader-state";

export type QuranCenterTab = "mushaf" | "circles" | "queue" | "bookmarks" | "smart_review";

export default function QuranCenter({
  embedded = false,
  selectedTab,
  onSelectedTabChange,
}: {
  embedded?: boolean;
  selectedTab?: QuranCenterTab;
  onSelectedTabChange?: (tab: QuranCenterTab) => void;
}) {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const requestedTab = searchParams.get("tab");
  const tabFromQuery: QuranCenterTab = requestedTab === "circles" || requestedTab === "queue" || requestedTab === "bookmarks" || requestedTab === "smart_review"
    ? requestedTab
    : "mushaf";
  const [internalTab, setInternalTab] = useState<QuranCenterTab>(tabFromQuery);
  const activeTab = selectedTab ?? internalTab;
  const installUrl = `${window.location.origin}/quran`;
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [mushafLocation, setMushafLocation] = useState<{ surah: number; ayah: number; page?: number }>({ surah: 1, ayah: 1 });
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const hasExplicitMushafNavigation = useRef(false);

  const { readerState, isReaderStateLoading } = useQuranReaderState({ enabled: true });

  useEffect(() => {
    if (!hasRestoredPosition && !isReaderStateLoading) {
      if (readerState?.position && !hasExplicitMushafNavigation.current) {
        setMushafLocation({
          surah: readerState.position.surahNumber,
          ayah: readerState.position.ayahNumber,
          page: readerState.position.pageNumber,
        });
      }
      setHasRestoredPosition(true);
    }
  }, [hasRestoredPosition, isReaderStateLoading, readerState?.position]);

  const handleMushafNavigate = (location: { surah: number; ayah: number; page?: number }) => {
    hasExplicitMushafNavigation.current = true;
    setMushafLocation(location);
  };

  useEffect(() => {
    if (!embedded && tabFromQuery !== internalTab) {
      setInternalTab(tabFromQuery);
    }
  }, [embedded, internalTab, tabFromQuery]);

  const handleTabChange = (tab: QuranCenterTab) => {
    setInternalTab(tab);
    onSelectedTabChange?.(tab);
    setMobileSectionsOpen(false);
    if (!embedded) {
      setLocation(`/teacher/quran-center?tab=${tab}`);
    }
  };

  const copyInstallLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      toast.success(lang === "ar" ? "تم نسخ رابط المصحف" : "Quran link copied");
    } catch {
      toast.error(lang === "ar" ? "تعذر نسخ الرابط؛ يمكنك فتحه مباشرة" : "Could not copy the link; you can open it directly");
    }
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
    const loader = (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2
          className="h-8 w-8 animate-spin text-emerald-700"
          aria-label={lang === "ar" ? "جارٍ التحميل" : "Loading"}
        />
      </div>
    );
    return embedded ? loader : (
      <Layout>
        {loader}
      </Layout>
    );
  }

  if (!teacher) return null;

  const TABS = [
    { id: "mushaf", label: lang === "ar" ? "المصحف" : "Mushaf", icon: <BookOpen className="w-5 h-5" /> },
    { id: "bookmarks", label: lang === "ar" ? "العلامات" : "Bookmarks", icon: <Bookmark className="w-5 h-5" /> },
    { id: "circles", label: lang === "ar" ? "الحلقات والطلاب" : "Circles & Students", icon: <Users className="w-5 h-5" /> },
    { id: "queue", label: lang === "ar" ? "طابور المراجعة" : "Review Queue", icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: "smart_review", label: lang === "ar" ? "المراجعة الذكية" : "Smart Review", icon: <Brain className="w-5 h-5" /> },
  ] as const;

  const content = (
      <div className={cn(
        "quran-center-root flex min-h-0 w-full flex-col overflow-hidden bg-[#fcfaf8] md:flex-row dark:bg-background",
        embedded
          ? "h-[calc(100dvh-4rem)]"
          : activeTab === "mushaf"
            ? "h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-3.5rem)]"
            : "h-[calc(100vh-3.5rem)]",
      )}>
        {/* Sidebar */}
        <aside className={cn(
          "quran-center-sidebar w-full md:w-64 border-b md:border-b-0 md:border-e border-border/60 bg-white dark:bg-card md:flex md:flex-col shadow-sm z-10 shrink-0",
          embedded ? "!hidden" : activeTab === "mushaf" && !mobileSectionsOpen ? "hidden" : "flex",
        )}>
          <div className="p-4 md:p-6 flex items-center justify-between md:justify-start">
            <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-400 md:mb-2">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shadow-inner shrink-0">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <h1 className="font-black text-base md:text-lg leading-none tracking-tight">
                  {lang === "ar" ? "إسلاميات حصاد" : "Hasaad Islamic"}
                </h1>
                <p className="hidden md:block text-[11px] font-bold text-emerald-600/70 dark:text-emerald-500/70 mt-1">
                  {lang === "ar" ? "إدارة الحلقات والحفظ" : "Memorization & Circles"}
                </p>
              </div>
            </div>
            {!embedded && (
              <button
                type="button"
                onClick={() => setLocation("/teacher")}
                className="ms-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-background text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 md:h-8 md:w-8 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                aria-label={lang === "ar" ? "العودة إلى لوحة المعلم" : "Back to teacher dashboard"}
                title={lang === "ar" ? "العودة إلى لوحة المعلم" : "Back to teacher dashboard"}
                data-testid="button-quran-center-back"
              >
                <ChevronLeft className="h-4 w-4 rtl:hidden" />
                <ChevronRight className="h-4 w-4 ltr:hidden" />
              </button>
            )}
          </div>
          
          <nav className="flex md:flex-col flex-1 px-2 md:px-4 space-x-2 md:space-x-0 rtl:space-x-reverse md:space-y-1 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 items-center md:items-stretch">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as QuranCenterTab)}
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
        <main className={cn(
          "quran-center-main relative min-h-0 w-full flex-1 flex-col overflow-hidden md:flex",
          activeTab === "mushaf" && mobileSectionsOpen ? "hidden" : "flex",
        )}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn("absolute inset-0", activeTab === "mushaf" ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto")}
            >
              {activeTab === "mushaf" && (
                <>
                  <div data-testid="teacher-quran-install-link" className="flex shrink-0 items-center gap-2 border-b border-emerald-900/10 bg-[#fbfaf6] px-3 py-2 dark:border-white/10 dark:bg-[#151b18] sm:gap-3">
                    <img src="/icons/quran-hasaad.png" alt="" className="h-8 w-8 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100">{lang === "ar" ? "رابط تثبيت مصحف حصاد على الهاتف" : "Install Hasaad Quran on your phone"}</p>
                      <a href="/quran?install=1" target="_blank" rel="noopener noreferrer" data-testid="link-standalone-quran"
                        className="block break-all text-[11px] font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100">
                        {installUrl}
                      </a>
                    </div>
                    <button type="button" onClick={() => void copyInstallLink()} data-testid="button-copy-quran-install-link"
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-emerald-900/10 px-2 text-xs font-bold text-emerald-800 hover:bg-emerald-900/5 dark:border-white/10 dark:text-emerald-200 dark:hover:bg-white/10"
                      aria-label={lang === "ar" ? "نسخ رابط تثبيت المصحف" : "Copy Quran install link"}>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{lang === "ar" ? "نسخ" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <QuranPagesView
                      initialSurah={mushafLocation.surah}
                      initialAyah={mushafLocation.ayah}
                      initialPage={mushafLocation.page}
                      onNavigate={handleMushafNavigate}
                      isTaskAyah={() => false}
                      startAyah={null}
                      endAyah={null}
                      mode={null}
                      liveRecitationAvailable={false}
                      embedded
                      onExitEmbedded={() => setMobileSectionsOpen(true)}
                      onOpenBookmarks={() => setBookmarksOpen(true)}
                    />
                  </div>
                </>
              )}
              {activeTab === "circles" && <QuranCircles surahs={surahs || []} />}
              {activeTab === "queue" && <QuranReviewQueue surahs={surahs || []} />}
              {activeTab === "smart_review" && <QuranSmartReview surahs={surahs || []} />}
              {activeTab === "bookmarks" && (
                <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-50">
                        {lang === "ar" ? "العلامات المحفوظة" : "Saved Bookmarks"}
                      </h2>
                      <p className="mt-1 text-sm font-bold text-muted-foreground">
                        {lang === "ar" ? "الوصول السريع إلى مواضع القراءة المحفوظة" : "Quick access to your saved reading positions"}
                      </p>
                    </div>
                  </div>
                  <QuranBookmarksPanel
                    onNavigate={(loc) => {
                      handleMushafNavigate(loc);
                      setBookmarksOpen(false);
                      handleTabChange("mushaf");
                    }}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>
            {embedded && activeTab === "mushaf" && bookmarksOpen && (
              <>
                <motion.button
                  type="button"
                  aria-label={lang === "ar" ? "إغلاق العلامات" : "Close bookmarks"}
                  className="absolute inset-0 z-40 bg-emerald-950/10 backdrop-blur-[1px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setBookmarksOpen(false)}
                />
                <motion.aside
                  className="absolute inset-y-0 end-0 z-50 w-[min(92vw,380px)] overflow-y-auto border-s border-border/60 bg-white/98 p-4 shadow-2xl backdrop-blur-xl dark:bg-card/98 md:p-5"
                  initial={{ opacity: 0, x: lang === "ar" ? -24 : 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: lang === "ar" ? -24 : 24 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-emerald-900 dark:text-emerald-100">
                        {lang === "ar" ? "العلامات المحفوظة" : "Saved bookmarks"}
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {lang === "ar" ? "انتقل سريعًا إلى موضع محفوظ" : "Jump to a saved position"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookmarksOpen(false)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={lang === "ar" ? "إغلاق" : "Close"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <QuranBookmarksPanel
                    onNavigate={(loc) => {
                      handleMushafNavigate(loc);
                      setBookmarksOpen(false);
                    }}
                  />
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        </main>
      </div>
  );

  if (embedded) return content;

  return (
    <Layout noHeader={activeTab === "mushaf"} hideFooter={activeTab === "mushaf"}>
      {content}
    </Layout>
  );
}
