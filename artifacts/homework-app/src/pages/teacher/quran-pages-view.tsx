import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { QuranSearchDialog } from "./quran-search-dialog";

interface QComplexChapter {
  id: number;
  name: string;
}

interface QComplexPage {
  id: number;
  chapter_id: number;
  part_id: number;
}

interface QComplexVerse {
  number: number;
  chapter_id: number;
  page_id: number;
  part_id: number;
}

interface QComplexPart {
  id: number;
}

const FIRST_PAGE = 1;
const LAST_PAGE = 604;
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 180;

function pageImageUrl(page: number) {
  return `${import.meta.env.BASE_URL}quran/mushaf-hafs-1441/${String(page).padStart(3, "0")}.webp`;
}

export function QuranPagesView({
  initialSurah,
  initialAyah,
  startAyah,
  endAyah,
  mode,
}: {
  initialSurah: number;
  initialAyah: number;
  onNavigate: (location: { surah: number; ayah: number }) => void;
  isTaskAyah: (surah: number, ayah: number) => boolean;
  startAyah: number | null;
  endAyah: number | null;
  mode: string | null;
}) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const [chapters, setChapters] = useState<QComplexChapter[]>([]);
  const [pages, setPages] = useState<QComplexPage[]>([]);
  const [verses, setVerses] = useState<QComplexVerse[]>([]);
  const [parts, setParts] = useState<QComplexPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(FIRST_PAGE);
  const [quietMode, setQuietMode] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      import("@/data/quran/qcomplex/chapters.json"),
      import("@/data/quran/qcomplex/pages.json"),
      import("@/data/quran/qcomplex/verses.json"),
      import("@/data/quran/qcomplex/parts.json"),
    ]).then(([chapterData, pageData, verseData, partData]) => {
      if (!mounted) return;

      const loadedVerses = verseData.default as QComplexVerse[];
      setChapters(chapterData.default as QComplexChapter[]);
      setPages(pageData.default as QComplexPage[]);
      setVerses(loadedVerses);
      setParts(partData.default as QComplexPart[]);

      const initialVerse = loadedVerses.find(
        (verse) =>
          verse.chapter_id === initialSurah && verse.number === initialAyah,
      );
      setActivePage(initialVerse?.page_id ?? FIRST_PAGE);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [initialAyah, initialSurah]);

  useEffect(() => {
    if (loading) return;

    for (const page of [activePage - 2, activePage - 1, activePage + 1, activePage + 2]) {
      if (page < FIRST_PAGE || page > LAST_PAGE) continue;
      const image = new Image();
      image.src = pageImageUrl(page);
    }
  }, [activePage, loading]);

  const activePageMeta = pages.find((page) => page.id === activePage);
  const activeChapterId = activePageMeta?.chapter_id ?? FIRST_PAGE;

  const visiblePages = useMemo(() => {
    if (activePage % 2 === 0) {
      return {
        right: activePage > FIRST_PAGE ? activePage - 1 : activePage,
        left: activePage,
      };
    }

    return {
      right: activePage,
      left: activePage < LAST_PAGE ? activePage + 1 : null,
    };
  }, [activePage]);

  const goToPage = (page: number) => {
    setActivePage(Math.min(Math.max(page, FIRST_PAGE), LAST_PAGE));
  };

  const goToSurah = (chapterId: number) => {
    const firstVerse = verses.find(
      (verse) => verse.chapter_id === chapterId && verse.number === 1,
    );
    if (firstVerse) goToPage(firstVerse.page_id);
  };

  const goToJuz = (partId: number) => {
    const firstVerse = verses.find((verse) => verse.part_id === partId);
    if (firstVerse) goToPage(firstVerse.page_id);
  };

  const handleTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) goToPage(activePage + 1);
    if (distance < -50) goToPage(activePage - 1);
    setTouchStart(null);
    setTouchEnd(null);
  };

  const renderPage = (page: number) => {
    const failed = failedPages.has(page);

    return (
      <figure
        key={page}
        className="relative mx-auto w-full overflow-hidden rounded-[3px] bg-white shadow-[0_20px_60px_rgba(34,87,57,0.16)] ring-1 ring-black/10"
      >
        {failed ? (
          <div className="flex aspect-[382.677/547.086] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <ImageOff className="h-9 w-9" />
            <p className="text-sm font-bold">
              {lang === "ar"
                ? `تعذر تحميل صورة الصفحة ${page}`
                : `Page ${page} could not be loaded`}
            </p>
            <button
              type="button"
              onClick={() =>
                setFailedPages((current) => {
                  const next = new Set(current);
                  next.delete(page);
                  return next;
                })
              }
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
            >
              {lang === "ar" ? "إعادة المحاولة" : "Try again"}
            </button>
          </div>
        ) : (
          <img
            src={pageImageUrl(page)}
            alt={lang === "ar" ? `صفحة المصحف رقم ${page}` : `Mushaf page ${page}`}
            className="block h-auto w-full select-none bg-white"
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() =>
              setFailedPages((current) => new Set(current).add(page))
            }
          />
        )}
      </figure>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f4f1ea] dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#eeeae2] font-sans transition-colors duration-300 dark:bg-[#0a0c0b]"
      dir={dir}
    >
      {quietMode && (
        <button
          type="button"
          onClick={() => setQuietMode(false)}
          className="fixed bottom-6 end-6 z-50 rounded-full bg-emerald-800 p-3 text-white opacity-40 shadow-lg transition-opacity hover:opacity-100"
          aria-label={lang === "ar" ? "إظهار الأدوات" : "Show controls"}
        >
          <Eye className="h-6 w-6" />
        </button>
      )}

      {!quietMode && (
        <header className="sticky top-0 z-40 shrink-0 border-b border-border/60 bg-white/95 shadow-sm backdrop-blur-md dark:bg-card/95">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 md:px-4">
            <button
              type="button"
              onClick={() => setLocation("/teacher/quran-center?tab=mushaf")}
              className="flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <ChevronLeft className="h-5 w-5 rtl:hidden" />
              <ChevronRight className="h-5 w-5 ltr:hidden" />
              {lang === "ar" ? "العودة إلى المصحف" : "Back to Mushaf"}
            </button>

            <div className="order-3 flex w-full items-center justify-center gap-2 overflow-x-auto md:order-none md:w-auto md:flex-1">
              <select
                value={activeChapterId}
                onChange={(event) => goToSurah(Number(event.target.value))}
                className="min-w-32 cursor-pointer rounded-lg bg-muted/40 px-2 py-2 text-center text-sm font-black text-foreground outline-none transition-colors hover:bg-muted md:text-base"
                aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.id}.{" "}
                    {lang === "ar"
                      ? `سورة ${chapter.name}`
                      : `Surah ${chapter.name}`}
                  </option>
                ))}
              </select>

              <select
                value={activePageMeta?.part_id ?? FIRST_PAGE}
                onChange={(event) => goToJuz(Number(event.target.value))}
                className="cursor-pointer rounded-lg bg-muted/40 px-2 py-2 text-sm font-bold text-foreground outline-none hover:bg-muted"
                aria-label={lang === "ar" ? "اختيار الجزء" : "Choose juz"}
              >
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {lang === "ar" ? `الجزء ${part.id}` : `Juz ${part.id}`}
                  </option>
                ))}
              </select>

              <select
                value={activePage}
                onChange={(event) => goToPage(Number(event.target.value))}
                className="cursor-pointer rounded-lg bg-muted/40 px-2 py-2 text-sm font-bold text-foreground outline-none hover:bg-muted"
                aria-label={lang === "ar" ? "اختيار الصفحة" : "Choose page"}
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {lang === "ar" ? `صفحة ${page.id}` : `Page ${page.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 text-muted-foreground md:gap-2">
              <QuranSearchDialog onSelect={({ pageId }) => goToPage(pageId)} />
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 10))}
                disabled={zoom <= MIN_ZOOM}
                className="rounded-xl p-2 transition-colors hover:bg-muted disabled:opacity-35"
                aria-label={lang === "ar" ? "تصغير الصفحة" : "Zoom out"}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="hidden min-w-11 text-center text-xs font-bold sm:block">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 10))}
                disabled={zoom >= MAX_ZOOM}
                className="rounded-xl p-2 transition-colors hover:bg-muted disabled:opacity-35"
                aria-label={lang === "ar" ? "تكبير الصفحة" : "Zoom in"}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setQuietMode(true)}
                className="hidden rounded-xl p-2 transition-colors hover:bg-muted md:block"
                aria-label={lang === "ar" ? "وضع القراءة الهادئ" : "Quiet mode"}
              >
                <EyeOff className="h-5 w-5" />
              </button>
            </div>
          </div>

          {startAyah !== null && endAyah !== null && (
            <div className="border-y border-emerald-200/50 bg-emerald-100 px-4 py-2 text-center text-sm font-bold text-emerald-900 shadow-inner dark:border-emerald-800/50 dark:bg-emerald-900/50 dark:text-emerald-100">
              {lang === "ar"
                ? `مهمة ${mode === "memorization" ? "حفظ" : "مراجعة"}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === "memorization" ? "Memorization" : "Review"} task: ayahs ${startAyah}–${endAyah}`}
            </div>
          )}
        </header>
      )}

      <main
        className="flex flex-1 items-start overflow-auto px-3 py-5 pb-24 md:px-8 md:py-8"
        onTouchStart={(event) => {
          setTouchEnd(null);
          setTouchStart(event.targetTouches[0].clientX);
        }}
        onTouchMove={(event) => setTouchEnd(event.targetTouches[0].clientX)}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "mx-auto grid grid-cols-1 items-start gap-3 transition-[width,max-width] duration-200 lg:grid-cols-2 lg:gap-3",
          )}
          style={{
            width: `${zoom}%`,
            maxWidth: `${Math.round(10.32 * zoom)}px`,
          }}
        >
          <div className="hidden lg:block">{renderPage(visiblePages.right)}</div>
          <div className="lg:hidden">{renderPage(activePage)}</div>
          {visiblePages.left !== null && (
            <div className="hidden lg:block">{renderPage(visiblePages.left)}</div>
          )}
        </div>
      </main>

      {!quietMode && (
        <div
          dir="ltr"
          className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-between px-4 md:px-12"
        >
          <button
            type="button"
            onClick={() => goToPage(activePage + 1)}
            disabled={activePage >= LAST_PAGE}
            className="pointer-events-auto flex items-center justify-center rounded-full border border-border bg-white/90 p-4 shadow-lg backdrop-blur-sm transition-all hover:bg-muted disabled:opacity-0 dark:bg-card/90"
            aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => goToPage(activePage - 1)}
            disabled={activePage <= FIRST_PAGE}
            className="pointer-events-auto flex items-center justify-center rounded-full border border-border bg-white/90 p-4 shadow-lg backdrop-blur-sm transition-all hover:bg-muted disabled:opacity-0 dark:bg-card/90"
            aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}