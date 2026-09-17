import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  Menu,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { QuranSearchDialog } from "./quran-search-dialog";
import {
  getGetQuranJourneyQueryKey,
  useRecordMyQuranIndependentSession,
  useUpdateMyQuranIndependentPosition,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QuranMadaniPageRenderer } from "./quran-madani-page";
import { QuranAudioPlayer } from "@/components/quran/quran-audio-player";
import { QuranEducationPanel } from "@/components/quran/quran-education-panel";
import type { QuranSurahParsed } from "@/lib/quran-parser";
import { useQuranReaderState } from "@/components/quran/use-quran-reader-state";
import { QuranBookmarkToggle } from "@/components/quran/quran-bookmark-toggle";
import { useQuranMemoSession } from "@/components/quran/use-quran-memo-session";
import { useQuranWordAudio } from "@/components/quran/use-quran-word-audio";

interface QComplexChapter {
  id: number;
  name: string;
}

interface QComplexPage {
  id: number;
  chapter_id: number;
  part_id: number;
}

export interface QComplexVerse {
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

function plainArabicSurahName(name: string) {
  return name
    .replace(/\u0671/g, "ا")
    .replace(/\u0670/g, "ا")
    .replace(/\u0640/g, "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, "");
}

export function QuranPagesView({
  initialSurah,
  initialAyah,
  initialPage,
  onNavigate,
  startAyah,
  endAyah,
  mode,
  readerBasePath = "/teacher/quran-reader",
  backHref = "/teacher/quran-center?tab=mushaf",
  backLabel,
  embedded = false,
  onSwitchToText,
  isIndependentPractice = false,
}: {
  initialSurah: number;
  initialAyah: number;
  initialPage?: number;
  onNavigate: (location: { surah: number; ayah: number; page?: number }) => void;
  isTaskAyah: (surah: number, ayah: number) => boolean;
  startAyah: number | null;
  endAyah: number | null;
  mode: string | null;
  readerBasePath?: string;
  backHref?: string;
  backLabel?: { ar: string; en: string };
  embedded?: boolean;
  onSwitchToText?: (location: { surah: number; ayah: number; page?: number }) => void;
  isIndependentPractice?: boolean;
}) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const savePosition = useUpdateMyQuranIndependentPosition();
  const recordSession = useRecordMyQuranIndependentSession();
  const lastSavedPositionRef = useRef<number | null>(null);
  const [chapters, setChapters] = useState<QComplexChapter[]>([]);
  const [pages, setPages] = useState<QComplexPage[]>([]);
  const [verses, setVerses] = useState<QComplexVerse[]>([]);
  const [parts, setParts] = useState<QComplexPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(FIRST_PAGE);
  const [quietMode, setQuietMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const didSwipeRef = useRef(false);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);

  const { savePosition: saveMainPosition, toggleBookmark, bookmarksMap, isMutatingBookmark } = useQuranReaderState({
    enabled: !isIndependentPractice && mode === null,
  });

  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);
  const [educationSelection, setEducationSelection] = useState<{
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
  } | null>(null);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [playingWordPosition, setPlayingWordPosition] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { playWord, stopWordAudio } = useQuranWordAudio();

  useEffect(() => {
    stopWordAudio();
  }, [activePage, stopWordAudio]);

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
      setActivePage(initialPage ?? initialVerse?.page_id ?? FIRST_PAGE);
      setSelectedVerseKey(
        initialVerse ? `${initialVerse.chapter_id}:${initialVerse.number}` : null,
      );
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [initialAyah, initialPage, initialSurah]);

  useEffect(() => {
    if (loading) return;

    for (const page of [activePage - 2, activePage - 1, activePage + 1, activePage + 2]) {
      if (page < FIRST_PAGE || page > LAST_PAGE) continue;
      const image = new Image();
      image.src = pageImageUrl(page);
    }
  }, [activePage, loading]);

  useEffect(() => {
    if (!isIndependentPractice || loading) return;
    if (lastSavedPositionRef.current === activePage) return;
    lastSavedPositionRef.current = activePage;
    savePosition.mutate({ data: { pageNumber: activePage } });
  }, [activePage, isIndependentPractice, loading, savePosition]);

  const recordIndependentPractice = async () => {
    try {
      await recordSession.mutateAsync({ data: {} });
      await queryClient.invalidateQueries({ queryKey: getGetQuranJourneyQueryKey() });
      toast.success(lang === "ar" ? "تم تسجيل جلسة التدريب" : "Practice session recorded");
    } catch {
      toast.error(lang === "ar" ? "تعذر تسجيل الجلسة" : "Could not record the session");
    }
  };

  const activePageMeta = pages.find((page) => page.id === activePage);
  const activeChapterId = activePageMeta?.chapter_id ?? FIRST_PAGE;

  const audioSurahs = useMemo<QuranSurahParsed[]>(() => {
    if (!chapters.length || !verses.length) return [];
    return chapters.map((chapter) => {
      const chapterVerses = verses.filter(v => v.chapter_id === chapter.id);
      return {
        index: chapter.id,
        name: chapter.name,
        ayahs: Array.from({ length: chapterVerses.length }, (_, i) => ({
          index: i + 1,
          text: '',
          bismillah: undefined
        }))
      };
    });
  }, [chapters, verses]);

  const fallbackVerse = useMemo(() => {
    return verses.find((verse) => verse.page_id === activePage && verse.chapter_id === activeChapterId) ||
           verses.find((verse) => verse.page_id === activePage) ||
           verses[0];
  }, [activePage, activeChapterId, verses]);

  const selectedSurah = selectedVerseKey
    ? Number(selectedVerseKey.split(":")[0])
    : (fallbackVerse?.chapter_id ?? activeChapterId);

  const selectedAyah = selectedVerseKey
    ? Number(selectedVerseKey.split(":")[1])
    : (fallbackVerse?.number ?? initialAyah);

  const { 
    memoSession, setMemoSession, 
    memoView, setMemoView, 
    isAyahConcealed, toggleReveal, resetReveal,
    startSession, endSession
  } = useQuranMemoSession(selectedSurah, selectedAyah, startAyah, endAyah, mode);

  const selectedVerse = useMemo(
    () => verses.find((verse) => verse.chapter_id === selectedSurah && verse.number === selectedAyah) ?? fallbackVerse,
    [fallbackVerse, selectedAyah, selectedSurah, verses],
  );

  const canonicalPage = selectedVerse?.page_id ?? activePage;

  useEffect(() => {
    if (isIndependentPractice || mode !== null || loading || !selectedVerse) return;
    saveMainPosition(selectedVerse.chapter_id, selectedVerse.number, selectedVerse.page_id);
  }, [isIndependentPractice, loading, mode, saveMainPosition, selectedVerse]);

  const playingSurah = playingVerseKey
    ? Number(playingVerseKey.split(":")[0])
    : selectedSurah;

  const playingAyahNum = playingVerseKey
    ? Number(playingVerseKey.split(":")[1])
    : null;

  const handlePlayingAyahChange = (ayahNum: number | null) => {
    if (ayahNum === null) {
      setPlayingVerseKey(null);
    } else {
      const newKey = `${playingSurah}:${ayahNum}`;
      setPlayingVerseKey(newKey);
      setSelectedVerseKey(newKey); // Also sync selection so UI follows playback

      const playingVerse = verses.find(v => v.chapter_id === playingSurah && v.number === ayahNum);
      if (playingVerse && playingVerse.page_id !== activePage) {
        goToPage(playingVerse.page_id);
      }
    }
  };

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

  // Clear selection if navigating away from the page, unless we are currently playing.
  useEffect(() => {
    if (!selectedVerseKey || isPlaying) return;
    const [s, a] = selectedVerseKey.split(":").map(Number);
    const selectedVerse = verses.find(v => v.chapter_id === s && v.number === a);
    if (!selectedVerse) return;

    const p = selectedVerse.page_id;
    if (visiblePages.left !== p && visiblePages.right !== p && activePage !== p) {
      setSelectedVerseKey(null);
      setEducationSelection(null);
    }
  }, [activePage, visiblePages, selectedVerseKey, verses, isPlaying]);

  const currentSpreadStart = activePage % 2 === 0 ? activePage - 1 : activePage;
  const canGoToNextSpread = currentSpreadStart + 2 <= LAST_PAGE;
  const canGoToPreviousSpread = currentSpreadStart > FIRST_PAGE;

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, FIRST_PAGE), LAST_PAGE);
    if (nextPage === activePage) return;
    const nextVerse = verses.find((verse) => verse.page_id === nextPage);
    setTurnDirection(nextPage > activePage ? "next" : "previous");
    setActivePage(nextPage);
    if (nextVerse) {
      onNavigate({
        surah: nextVerse.chapter_id,
        ayah: nextVerse.number,
        page: nextPage,
      });
    }
  };

  const goToSpread = (direction: "next" | "previous") => {
    goToPage(
      direction === "next"
        ? currentSpreadStart + 2
        : currentSpreadStart - 2,
    );
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
    if (distance > 50) {
      didSwipeRef.current = true;
      goToSpread("next");
    }
    if (distance < -50) {
      didSwipeRef.current = true;
      goToSpread("previous");
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const renderPage = (page: number, physicalPage: "left" | "right" | "single") => {
    const failed = failedPages.has(page);

    return (
      <figure
        key={page}
        className="relative mx-auto w-full overflow-hidden rounded-[3px] bg-white shadow-[0_20px_60px_rgba(34,87,57,0.16)] ring-1 ring-black/10"
        onClick={(event) => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          const target = event.target;
          if (target instanceof Element && target.closest("button,a,input,select,textarea,[role='button']")) return;

          const clickedSide = physicalPage === "single"
            ? (event.clientX < event.currentTarget.getBoundingClientRect().left
              + event.currentTarget.getBoundingClientRect().width / 2 ? "left" : "right")
            : physicalPage;
          if (clickedSide === "left" && canGoToNextSpread) goToSpread("next");
          if (clickedSide === "right" && canGoToPreviousSpread) goToSpread("previous");
        }}
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
          <QuranMadaniPageRenderer
            pageNumber={page}
            isLastVerse={(chapterId, verseNumber) => {
              return !verses.some(
                (v) => v.chapter_id === chapterId && v.number === verseNumber + 1
              );
            }}
            fallbackImageUrl={pageImageUrl(page)}
            onFallbackError={() =>
              setFailedPages((current) => new Set(current).add(page))
            }
            selectedVerseKey={selectedVerseKey}
            selectedWordId={educationSelection?.wordId}
            playingVerseKey={playingVerseKey}
            playingWordPosition={playingWordPosition}
            isAyahConcealed={(chapterId, verseNumber) => isAyahConcealed(chapterId, verseNumber, playingAyahNum)}
            onVerseClick={(selection) => {
               const verseKey = selection.verseKey;
               const chapterId = Number(verseKey.split(":")[0]);
               const verseNumber = Number(verseKey.split(":")[1]);

               if (isAyahConcealed(chapterId, verseNumber, playingAyahNum)) {
                 toggleReveal(chapterId, verseNumber);
                 return;
               }

               setSelectedVerseKey(verseKey);
               setEducationSelection(selection);
              if (selection.wordPosition !== null) {
                playWord(chapterId, verseNumber, selection.wordPosition);
                return;
              }
              if (isPlaying && playingVerseKey) {
                // If a different surah is clicked while playing, we need to stop or update the playing track
                // Since quran-audio-player only handles playing within one surah (via surahNumber prop),
                // we'll stop playback when jumping surahs, or seek when jumping ayahs in the same surah.
                const clickedSurah = Number(verseKey.split(":")[0]);
                if (clickedSurah === playingSurah) {
                   handlePlayingAyahChange(Number(verseKey.split(":")[1]));
                } else {
                   setIsPlaying(false);
                   setPlayingVerseKey(null);
                }
              }
            }}
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
      className={cn(
        "flex flex-col bg-[#eeeae2] font-sans transition-colors duration-300 dark:bg-[#0a0c0b]",
         embedded ? "h-full overflow-hidden" : "h-[100dvh] overflow-hidden",
      )}
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:px-4 md:py-3">
            {!embedded && (
              <button
                type="button"
                onClick={() => setLocation(backHref)}
                className="flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <ChevronLeft className="h-5 w-5 rtl:hidden" />
                <ChevronRight className="h-5 w-5 ltr:hidden" />
                <span className="hidden md:inline">
                  {backLabel
                    ? (lang === "ar" ? backLabel.ar : backLabel.en)
                    : (lang === "ar" ? "العودة إلى حصاد القرآن" : "Back to Hasaad Quran")}
                </span>
              </button>
            )}

            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 md:hidden">
              <span className="truncate text-sm font-black text-emerald-900 dark:text-emerald-100">
                {chapters.find((chapter) => chapter.id === activeChapterId)?.name
                  ? plainArabicSurahName(chapters.find((chapter) => chapter.id === activeChapterId)!.name)
                  : (lang === "ar" ? "المصحف" : "Mushaf")}
              </span>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {lang === "ar" ? `ص ${activePage}` : `p. ${activePage}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileToolsOpen((open) => !open)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-background text-foreground shadow-sm md:hidden"
              aria-expanded={mobileToolsOpen}
              aria-label={lang === "ar" ? "أدوات المصحف" : "Mushaf tools"}
            >
              {mobileToolsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

              <div className={cn(
                "order-3 w-full flex-wrap items-center justify-center gap-2 md:order-none md:flex md:w-auto md:flex-1",
                mobileToolsOpen ? "flex" : "hidden",
              )}>
                {isIndependentPractice && (
                  <button
                    type="button"
                    onClick={() => void recordIndependentPractice()}
                    disabled={recordSession.isPending}
                    className="shrink-0 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    {lang === "ar" ? "سجلت جلسة تدريب" : "Record practice"}
                  </button>
                )}
                
                <button 
                  type="button"
                  onClick={() => memoSession.isActive ? endSession() : startSession()}
                  className={cn("shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-colors border", memoSession.isActive ? "bg-amber-100 border-amber-300 text-amber-900 shadow-sm dark:bg-amber-900/50 dark:border-amber-800 dark:text-amber-100" : "bg-muted/40 border-transparent hover:bg-muted text-foreground")}
                >
                  {memoSession.isActive ? (lang === "ar" ? "إنهاء الحفظ" : "End Memo") : (lang === "ar" ? "جلسة حفظ" : "Memo Session")}
                </button>

               <button
                 type="button"
                 onClick={() => {
                   const location = {
                     surah: activeChapterId,
                     ayah: verses.find((verse) => verse.page_id === activePage && verse.chapter_id === activeChapterId)?.number ?? initialAyah,
                     page: activePage,
                   };
                   if (embedded && onSwitchToText) {
                     onSwitchToText(location);
                    } else if (isIndependentPractice) {
                      setLocation(`${readerBasePath}/${activeChapterId}?view=reader`);
                   } else {
                     setLocation(`${readerBasePath}/${location.surah}?ayah=${location.ayah}&view=reader`);
                   }
                 }}
                 className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60 md:text-sm"
               >
                 {lang === "ar" ? "نص القرآن" : "Quran Text"}
               </button>
               <span
                 aria-current="page"
                 className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 dark:bg-amber-900/50 dark:text-amber-100 md:text-sm"
               >
                 {lang === "ar" ? "مصحف المدينة QCF V2" : "Madani Mushaf QCF V2"}
               </span>
              <select
                value={activeChapterId}
                onChange={(event) => goToSurah(Number(event.target.value))}
                className="min-w-32 cursor-pointer rounded-lg bg-muted/40 px-2 py-2 text-center text-sm font-black text-foreground outline-none transition-colors hover:bg-muted md:text-base"
                aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.id}. {lang === "ar" ? plainArabicSurahName(chapter.name) : chapter.name}
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

              {!isIndependentPractice && mode === null && fallbackVerse && (
                <div className="ms-1 border-s border-border/50 ps-1 sm:ms-2 sm:ps-2">
                  <QuranBookmarkToggle
                    surahNumber={selectedSurah}
                    ayahNumber={selectedAyah}
                    pageNumber={canonicalPage}
                    isBookmarked={bookmarksMap.has(`${selectedSurah}:${selectedAyah}`)}
                    onToggle={toggleBookmark}
                    disabled={isMutatingBookmark}
                  />
                </div>
              )}
            </div>

            <div className={cn(
              "order-4 w-full items-center justify-center gap-1 text-muted-foreground md:order-none md:flex md:w-auto md:gap-2",
              mobileToolsOpen ? "flex" : "hidden",
            )}>
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
        className="flex min-h-0 flex-1 flex-col items-start overflow-auto px-3 py-5 pb-8 md:px-8 md:py-8"
        onTouchStart={(event) => {
           const target = event.target;
           if (target instanceof Element && target.closest("button,a,input,select,textarea,[role='button']")) {
             setTouchStart(null);
             setTouchEnd(null);
             return;
           }
           didSwipeRef.current = false;
          setTouchEnd(null);
          setTouchStart(event.targetTouches[0].clientX);
        }}
        onTouchMove={(event) => setTouchEnd(event.targetTouches[0].clientX)}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={activePage}
          className={cn(
            "mx-auto grid grid-cols-1 items-start gap-3 transition-[width,max-width] duration-200 lg:grid-cols-2 lg:gap-3",
            turnDirection === "next" ? "quran-page-turn-next" : "quran-page-turn-previous",
          )}
          style={{
            width: `${zoom}%`,
            maxWidth: `${Math.round(10.32 * zoom)}px`,
          }}
        >
          <div className="hidden lg:block">{renderPage(visiblePages.right, "right")}</div>
          <div className="lg:hidden">{renderPage(activePage, "single")}</div>
          {visiblePages.left !== null && (
            <div className="hidden lg:block">{renderPage(visiblePages.left, "left")}</div>
          )}
        </div>

        <nav
          dir={dir}
          aria-label={lang === "ar" ? "التنقل بين صفحات المصحف" : "Mushaf page navigation"}
          className="mx-auto mt-3 flex w-full max-w-[1032px] items-center justify-between gap-2 border-t border-emerald-900/10 px-1 pt-3 dark:border-white/10 md:mt-6 md:gap-3 md:pt-5"
          style={{ width: `${zoom}%` }}
        >
          <button
            type="button"
            onClick={() => goToSpread("previous")}
            disabled={!canGoToPreviousSpread}
            className="group inline-flex min-h-10 items-center gap-1.5 rounded-full border border-emerald-900/15 bg-white/70 px-3 py-2 text-xs font-bold text-emerald-900 shadow-sm transition-colors hover:border-emerald-400 hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-35 dark:border-emerald-700/60 dark:bg-card/70 dark:text-emerald-100 dark:hover:bg-emerald-950/60 md:min-h-12 md:gap-2 md:rounded-2xl md:px-5 md:py-2.5 md:text-sm md:font-black"
            aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180 md:h-5 md:w-5" />
            <span className="md:hidden">{lang === "ar" ? "السابق" : "Previous"}</span>
            <span className="hidden md:inline">{lang === "ar" ? "الصفحة السابقة" : "Previous page"}</span>
          </button>

          <span className="hidden text-xs font-bold text-muted-foreground sm:block">
            {lang === "ar" ? `صفحة ${activePage} من ${LAST_PAGE}` : `Page ${activePage} of ${LAST_PAGE}`}
          </span>

          <button
            type="button"
            onClick={() => goToSpread("next")}
            disabled={!canGoToNextSpread}
            className="group inline-flex min-h-10 items-center gap-1.5 rounded-full border border-emerald-700/25 bg-emerald-700/10 px-3 py-2 text-xs font-bold text-emerald-900 shadow-sm transition-colors hover:border-emerald-500 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-35 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-900/50 md:min-h-12 md:gap-2 md:rounded-2xl md:bg-emerald-700 md:px-5 md:py-2.5 md:text-sm md:font-black md:text-white md:shadow-md md:shadow-emerald-900/15 md:hover:bg-emerald-800 dark:md:bg-emerald-600 dark:md:hover:bg-emerald-500"
            aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
          >
            <span className="md:hidden">{lang === "ar" ? "التالي" : "Next"}</span>
            <span className="hidden md:inline">{lang === "ar" ? "الصفحة التالية" : "Next page"}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180 md:h-5 md:w-5" />
          </button>
        </nav>
      </main>

      {!quietMode && (educationSelection || (selectedVerseKey && audioSurahs.length > 0)) && (
        <div
          className="relative z-40 flex max-h-[58dvh] w-full shrink-0 flex-col"
          data-testid="quran-bottom-dock"
        >
          {educationSelection && (
            <QuranEducationPanel
              key={`${educationSelection.verseKey}:${educationSelection.wordPosition ?? 0}`}
              selection={educationSelection}
              onClose={() => setEducationSelection(null)}
            />
          )}
          {selectedVerseKey && audioSurahs.length > 0 && (
            <div className="z-40 w-full shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <QuranAudioPlayer
                surahs={audioSurahs}
                surahNumber={playingSurah}
                startAyah={startAyah}
                endAyah={endAyah}
                selectedAyah={selectedAyah}
                playingAyah={playingAyahNum}
                onPlayingAyahChange={handlePlayingAyahChange}
                isPlaying={isPlaying}
                onIsPlayingChange={setIsPlaying}
                memoSession={memoSession}
                onMemoSessionChange={setMemoSession}
                memoView={memoView}
                onMemoViewChange={setMemoView}
                onPlayingWordChange={setPlayingWordPosition}
                onClose={() => {
                  setIsPlaying(false);
                  setPlayingVerseKey(null);
                  setSelectedVerseKey(null);
                  setEducationSelection(null);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
