import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  ImageOff,
  ListPlus,
  Bookmark,
  BookOpen,
  Volume2,
  Loader2,
  Menu,
  Mic2,
  Rows3,
  Cloud,
  CloudOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { QuranSearchDialog } from "./quran-search-dialog";
import {
  getGetQuranJourneyQueryKey,
  getGetQuranSurahContentQueryKey,
  getGetCurrentTeacherQueryKey,
  useGetCurrentTeacher,
  useGetQuranSurahContent,
  useRecordMyQuranIndependentSession,
  useUpdateMyQuranIndependentPosition,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QuranMadaniPageRenderer } from "./quran-madani-page";
import { QuranAudioPlayer } from "@/components/quran/quran-audio-player";
import { useQuranAudioHost } from "@/components/quran/quran-audio-host";
import {
  QuranGuidedMemorizationPanel,
  type GuidedMemorizationStage,
} from "@/components/quran/quran-guided-memorization-panel";
import { QuranEducationPanel } from "@/components/quran/quran-education-panel";
import type { QuranSurahParsed } from "@/lib/quran-parser";
import { useQuranReaderState } from "@/components/quran/use-quran-reader-state";
import { useQuranMemoSession } from "@/components/quran/use-quran-memo-session";
import { useQuranWordAudio } from "@/components/quran/use-quran-word-audio";

const LIVE_RECITATION_ENABLED = true;
const QURAN_EDUCATION_HIDDEN_KEY = "quran-education-hidden";

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

const CANONICAL_SURAH_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  3: "آل عمران",
  42: "الشورى",
  55: "الرحمن",
  92: "الليل",
  93: "الضحى",
};

function plainArabicSurahName(chapterId: number, name: string) {
  const canonicalName = CANONICAL_SURAH_NAME_OVERRIDES[chapterId];
  if (canonicalName) return canonicalName;
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
  standalone = false,
  onStandaloneSyncChange,
  isIndependentPractice = false,
  liveRecitationAvailable,
  onExitEmbedded,
  onOpenBookmarks,
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
  standalone?: boolean;
  onStandaloneSyncChange?: (enabled: boolean) => void;
  isIndependentPractice?: boolean;
  liveRecitationAvailable: boolean;
  onExitEmbedded?: () => void;
  onOpenBookmarks?: () => void;
}) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { audioRef } = useQuranAudioHost();
  const isTeacherReader = !standalone && readerBasePath.startsWith("/teacher/");
  const { data: currentTeacher } = useGetCurrentTeacher({
    query: {
      enabled: isTeacherReader,
      retry: false,
      queryKey: getGetCurrentTeacherQueryKey(),
    },
  });
  const isAdmin = Boolean(currentTeacher?.isAdmin) || currentTeacher?.role === "admin";
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
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidedStage, setGuidedStage] = useState<GuidedMemorizationStage>(0);
  const [guidedVerseKey, setGuidedVerseKey] = useState<string | null>(null);
  const [guidedRecitationRevealed, setGuidedRecitationRevealed] = useState(false);
  const [silentReadWordPosition, setSilentReadWordPosition] = useState<number | null>(null);
  const guidedPanelRef = useRef<HTMLElement | null>(null);
  const [guidedPanelHeight, setGuidedPanelHeight] = useState(0);
  const bottomDockRef = useRef<HTMLDivElement | null>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState(0);
  const toolsHeaderRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pageLayout, setPageLayout] = useState<"spread" | "single" | "continuous">(
    typeof window !== "undefined" && window.innerWidth < 768 ? "single" : "spread",
  );
  const preLandscapeLayoutRef = useRef<"spread" | "single" | "continuous" | null>(null);
  const [continuousStartPage, setContinuousStartPage] = useState(FIRST_PAGE);
  const [continuousEndPage, setContinuousEndPage] = useState(
    typeof window !== "undefined" && window.innerWidth < 768 ? Math.min(LAST_PAGE, FIRST_PAGE + 3) : FIRST_PAGE,
  );
  const continuousInitializedRef = useRef(false);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const swipeStartXRef = useRef<number | null>(null);
  const swipeLastXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const suppressSwipeClickRef = useRef(false);
  const readerMainRef = useRef<HTMLElement | null>(null);
  const continuousLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const didSwipeRef = useRef(false);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);

  const {
    readerState,
    localStatePosition,
    savePosition: saveMainPosition,
    toggleBookmark,
    bookmarksMap,
    isMutatingBookmark,
    canSync,
    syncEnabled,
    syncActive,
    isSyncing,
    setSyncEnabled,
  } = useQuranReaderState({
    enabled: !isIndependentPractice && mode === null,
    storage: standalone ? "optional" : "server",
  });

  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);
  const [educationSelection, setEducationSelection] = useState<{
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
  } | null>(null);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [audibleVerseKey, setAudibleVerseKey] = useState<string | null>(null);
  const [playingWordPosition, setPlayingWordPosition] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDockOpen, setAudioDockOpen] = useState(false);
  const [educationLocked, setEducationLocked] = useState(false);
  const [educationHidden, setEducationHidden] = useState(
    () => typeof window !== "undefined"
      && window.localStorage.getItem(QURAN_EDUCATION_HIDDEN_KEY) === "true",
  );
  const [copiedVerseKey, setCopiedVerseKey] = useState<string | null>(null);
  const [copyRange, setCopyRange] = useState<{
    surah: number;
    startAyah: number;
    endAyah: number;
  } | null>(null);
  const [copyActionsOpen, setCopyActionsOpen] = useState(false);
  const [bookmarkActionsOpen, setBookmarkActionsOpen] = useState(false);
  const { playWord, stopWordAudio } = useQuranWordAudio();

  useEffect(() => {
    type WakeLockSentinelLike = {
      released?: boolean;
      release: () => Promise<void>;
      addEventListener?: (type: "release", listener: () => void) => void;
    };
    const wakeLockNavigator = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    let sentinel: WakeLockSentinelLike | null = null;
    let requestPending = false;
    let mounted = true;

    const requestWakeLock = async () => {
      if (!mounted || requestPending || document.visibilityState !== "visible" || !wakeLockNavigator.wakeLock?.request) return;
      if (sentinel && sentinel.released !== true) return;
      requestPending = true;
      try {
        const nextSentinel = await wakeLockNavigator.wakeLock.request("screen");
        if (!mounted) {
          await nextSentinel.release().catch(() => undefined);
          return;
        }
        sentinel = nextSentinel;
        nextSentinel.addEventListener?.("release", () => {
          if (sentinel === nextSentinel) sentinel = null;
        });
      } catch {
        // Unsupported browsers and denied wake-lock requests remain usable.
      } finally {
        requestPending = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    const handleUserActivity = () => {
      if (!sentinel) void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pointerdown", handleUserActivity, { passive: true });
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pointerdown", handleUserActivity);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, []);

  useEffect(() => {
    if (educationHidden || educationLocked || guidedOpen || !isPlaying || !audibleVerseKey) return;
    setEducationSelection({
      verseKey: audibleVerseKey,
      wordId: null,
      wordPosition: null,
      wordText: null,
    });
  }, [audibleVerseKey, educationHidden, educationLocked, guidedOpen, isPlaying]);

  const hideEducation = () => {
    setEducationHidden(true);
    setEducationSelection(null);
    setEducationLocked(false);
    window.localStorage.setItem(QURAN_EDUCATION_HIDDEN_KEY, "true");
  };

  const showEducation = () => {
    setEducationHidden(false);
    window.localStorage.removeItem(QURAN_EDUCATION_HIDDEN_KEY);
    const verseKey = audibleVerseKey ?? selectedVerseKey;
    if (verseKey) {
      setEducationSelection({
        verseKey,
        wordId: null,
        wordPosition: null,
        wordText: null,
      });
    }
  };

  const handleStandaloneSyncToggle = async () => {
    const enabling = !syncEnabled;
    const changed = await setSyncEnabled(enabling);
    if (!changed) return;
    onStandaloneSyncChange?.(enabling);
    if (enabling && !localStatePosition && readerState?.position) {
      const syncedVerse = verses.find(
        (verse) =>
          verse.chapter_id === readerState.position?.surahNumber
          && verse.number === readerState.position.ayahNumber,
      );
      if (syncedVerse) {
        setSelectedVerseKey(`${syncedVerse.chapter_id}:${syncedVerse.number}`);
        setActivePage(syncedVerse.page_id);
      }
    }
  };

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!toolsHeaderRef.current?.contains(event.target as Node)) {
        setMobileToolsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [mobileToolsOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const landscapeQuery = window.matchMedia("(orientation: landscape) and (max-height: 600px)");
    const syncLandscapeLayout = () => {
      if (landscapeQuery.matches) {
        setPageLayout((current) => {
          if (preLandscapeLayoutRef.current === null) {
            preLandscapeLayoutRef.current = current;
          }
          return "single";
        });
        return;
      }
      if (preLandscapeLayoutRef.current !== null) {
        const previousLayout = preLandscapeLayoutRef.current;
        preLandscapeLayoutRef.current = null;
        setPageLayout(previousLayout);
      }
    };
    syncLandscapeLayout();
    landscapeQuery.addEventListener("change", syncLandscapeLayout);
    return () => landscapeQuery.removeEventListener("change", syncLandscapeLayout);
  }, []);

  useEffect(() => {
    stopWordAudio();
  }, [activePage, stopWordAudio]);

  useEffect(() => {
    const panel = guidedPanelRef.current;
    if (!guidedOpen || !panel) {
      setGuidedPanelHeight(0);
      return;
    }
    const updateHeight = () => setGuidedPanelHeight(panel.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [guidedOpen, guidedStage]);

  useEffect(() => {
    if (!guidedOpen || !guidedVerseKey) return;
    const frame = window.requestAnimationFrame(() => {
      const verseElement = Array.from(
        readerMainRef.current?.querySelectorAll<HTMLElement>("[data-verse-key]") ?? [],
      ).find((element) => element.dataset.verseKey === guidedVerseKey);
      if (!verseElement) return;
      verseElement.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [guidedOpen, guidedStage, guidedVerseKey]);

  useEffect(() => {
    if (!isPlaying || !audibleVerseKey) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const verseElement = Array.from(
          readerMainRef.current?.querySelectorAll<HTMLElement>("[data-verse-key]") ?? [],
        ).find((element) => element.dataset.verseKey === audibleVerseKey);
        if (!verseElement) return;

        const bounds = verseElement.getBoundingClientRect();
        const topReadingEdge = 88;
        const bottomReadingEdge = window.innerHeight - bottomDockHeight - 24;
        const isVisible =
          bounds.top >= topReadingEdge &&
          bounds.bottom <= Math.max(topReadingEdge + 80, bottomReadingEdge);
        if (!isVisible) {
          verseElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activePage, audibleVerseKey, bottomDockHeight, isPlaying, pageLayout]);

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
    if (loading || pageLayout !== "continuous" || continuousInitializedRef.current) return;
    continuousInitializedRef.current = true;
    setContinuousStartPage(activePage);
    setContinuousEndPage(Math.min(LAST_PAGE, activePage + 3));
  }, [activePage, loading, pageLayout]);

  useEffect(() => {
    if (loading || pageLayout !== "continuous" || continuousEndPage >= LAST_PAGE) return;
    const root = readerMainRef.current;
    const target = continuousLoadMoreRef.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setContinuousEndPage((current) => Math.min(LAST_PAGE, current + 3));
      },
      {
        root,
        rootMargin: "0px 0px 900px 0px",
        threshold: 0.01,
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [continuousEndPage, loading, pageLayout]);

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

  const bottomDockVisible = !quietMode
    && Boolean(
      educationSelection
      || ((audioDockOpen || isPlaying) && selectedVerseKey && audioSurahs.length > 0),
    );

  useEffect(() => {
    const dock = bottomDockRef.current;
    if (!bottomDockVisible || !dock) {
      setBottomDockHeight(0);
      return;
    }
    const updateHeight = () => setBottomDockHeight(dock.getBoundingClientRect().height);
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [bottomDockVisible, educationSelection, audioDockOpen, isPlaying]);

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
  const recitationBasePath = readerBasePath.startsWith("/student/")
    ? "/student/quran-recitation"
    : "/teacher/quran-recitation";
  const openLiveRecitation = () => {
    setLocation(`${recitationBasePath}/${selectedSurah}?ayah=${selectedAyah}`);
  };
  const { data: selectedSurahContent, isFetching: isFetchingSelectedSurah } = useGetQuranSurahContent(selectedSurah, {
    query: {
      queryKey: getGetQuranSurahContentQueryKey(selectedSurah),
      staleTime: Infinity,
    },
  });
  const selectedAyahText = selectedSurahContent?.ayahs.find((ayah) => ayah.index === selectedAyah)?.text;

  const copySelection = async () => {
    setCopyActionsOpen(false);
    if (!selectedSurahContent || !selectedVerseKey) return;
    const rangeStart = copyRange?.surah === selectedSurah
      ? Math.min(copyRange.startAyah, copyRange.endAyah)
      : selectedAyah;
    const rangeEnd = copyRange?.surah === selectedSurah
      ? Math.max(copyRange.startAyah, copyRange.endAyah)
      : selectedAyah;
    const ayahs = selectedSurahContent.ayahs.filter(
      (ayah) => ayah.index >= rangeStart && ayah.index <= rangeEnd,
    );
    if (!ayahs.length) return;
    const copiedKey = `${selectedSurah}:${rangeStart}-${rangeEnd}`;
    const copiedText = ayahs.length === 1
      ? ayahs[0].text
      : ayahs
          .map((ayah) => {
            const ayahNumber = String(ayah.index).replace(
              /\d/g,
              (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)],
            );
            return `${ayah.text} ﴿${ayahNumber}﴾`;
          })
          .join("\n");
    try {
      await navigator.clipboard.writeText(copiedText);
      setCopiedVerseKey(copiedKey);
      toast.success(lang === "ar"
        ? (ayahs.length > 1 ? `تم نسخ ${ayahs.length} آيات` : "تم نسخ الآية")
        : (ayahs.length > 1 ? `${ayahs.length} ayahs copied` : "Ayah copied"));
      window.setTimeout(
        () => setCopiedVerseKey((current) => current === copiedKey ? null : current),
        1800,
      );
    } catch {
      toast.error(lang === "ar" ? "تعذر نسخ الآيات" : "Could not copy ayahs");
    }
  };

  const toggleMultiCopy = () => {
    setCopyActionsOpen(false);
    if (copyRange) {
      setCopyRange(null);
      return;
    }
    setCopyRange({ surah: selectedSurah, startAyah: selectedAyah, endAyah: selectedAyah });
    toast.info(lang === "ar" ? "اضغط الآن على الآية الأخيرة" : "Now tap the last ayah");
  };

  const copyRangeStart = copyRange ? Math.min(copyRange.startAyah, copyRange.endAyah) : selectedAyah;
  const copyRangeEnd = copyRange ? Math.max(copyRange.startAyah, copyRange.endAyah) : selectedAyah;
  const copyCount = copyRangeEnd - copyRangeStart + 1;
  const currentCopyKey = `${selectedSurah}:${copyRangeStart}-${copyRangeEnd}`;
  const isCurrentBookmarked = bookmarksMap.has(`${selectedSurah}:${selectedAyah}`);
  const canToggleCurrentBookmark = !isIndependentPractice && mode === null && Boolean(fallbackVerse);

  const {
    memoSession, setMemoSession,
    memoView, setMemoView,
    isAyahConcealed, toggleReveal, resetReveal, randomizePartialHide,
    endSession
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
      setAudibleVerseKey(null);
    } else {
      const newKey = `${playingSurah}:${ayahNum}`;
      setPlayingVerseKey(newKey);
    }
  };

  const openAudioControls = () => {
    const targetVerse = selectedVerseKey
      ? verses.find((verse) => `${verse.chapter_id}:${verse.number}` === selectedVerseKey)
      : verses.find((verse) => verse.page_id === activePage);
    if (!targetVerse) return;
    setSelectedVerseKey(`${targetVerse.chapter_id}:${targetVerse.number}`);
    setEducationSelection(null);
    setAudioDockOpen(true);
  };

  const closeGuidedMemorization = () => {
    audioRef.current?.pause();
    setGuidedOpen(false);
    setGuidedStage(0);
    setGuidedVerseKey(null);
    setGuidedRecitationRevealed(false);
    setSilentReadWordPosition(null);
    setAudibleVerseKey(null);
    setIsPlaying(false);
    setPlayingVerseKey(null);
    endSession();
  };

  const setGuidedStageAndPlayback = (stage: GuidedMemorizationStage) => {
    setGuidedStage(stage);
    setGuidedRecitationRevealed(false);
    setSilentReadWordPosition(null);
    if (stage === 0 && guidedVerseKey) {
      setMemoView("show");
      setMemoSession((session) => ({
        ...session,
        isActive: true,
        repeatScope: "ayah",
      }));
      const replayAyah = Number(guidedVerseKey.split(":")[1]);
      setPlayingVerseKey(`${guidedVerseKey.split(":")[0]}:${replayAyah}`);
      setIsPlaying(true);
      return;
    }
    if (stage === 2) randomizePartialHide();
    if (stage === 4 && guidedVerseKey) {
      setMemoView("show");
      setMemoSession((session) => ({
        ...session,
        isActive: true,
        repeatScope: "range",
        rangeEnd: Number(guidedVerseKey.split(":")[1]),
      }));
      setPlayingVerseKey(`${guidedVerseKey.split(":")[0]}:${memoSession.rangeStart}`);
      setIsPlaying(true);
      return;
    }
    audioRef.current?.pause();
    setIsPlaying(false);
    setAudibleVerseKey(stage === 1 ? guidedVerseKey : null);
    setMemoView(stage === 2 ? "progressive" : stage === 3 ? "hide" : "show");
  };

  useEffect(() => {
    if (!guidedOpen || guidedStage !== 1 || !guidedVerseKey) {
      setSilentReadWordPosition(null);
      return;
    }
    const wordCount = Math.max(
      1,
      selectedAyahText?.trim().split(/\s+/).filter(Boolean).length ?? 1,
    );
    setAudibleVerseKey(guidedVerseKey);
    setSilentReadWordPosition(1);
    const interval = window.setInterval(() => {
      setSilentReadWordPosition((position) => position === null || position >= wordCount ? 1 : position + 1);
    }, 1150);
    return () => window.clearInterval(interval);
  }, [guidedOpen, guidedStage, guidedVerseKey, selectedAyahText]);

  const replayGuidedRecitation = () => {
    if (!guidedVerseKey) return;
    audioRef.current?.pause();
    setIsPlaying(false);
    setPlayingVerseKey(null);
    window.requestAnimationFrame(() => {
      setPlayingVerseKey(guidedVerseKey);
      setIsPlaying(true);
    });
  };

  const toggleMemoSession = () => {
    if (guidedOpen) {
      closeGuidedMemorization();
      return;
    }
    if (memoSession.isActive) endSession();
    const targetVerse = selectedVerseKey
      ? verses.find((verse) => `${verse.chapter_id}:${verse.number}` === selectedVerseKey)
      : selectedVerse ?? verses.find((verse) => verse.page_id === activePage);
    if (!targetVerse) {
      endSession();
      return;
    }
    const targetKey = `${targetVerse.chapter_id}:${targetVerse.number}`;
    setSelectedVerseKey(targetKey);
    setPlayingVerseKey(targetKey);
    setGuidedVerseKey(targetKey);
    setGuidedStage(0);
    setGuidedRecitationRevealed(false);
    setGuidedOpen(true);
    setEducationSelection(null);
    setMemoSession((session) => ({
      ...session,
      isActive: true,
      rangeStart: targetVerse.number,
      rangeEnd: targetVerse.number,
      repeatScope: "ayah",
      repeatCount: 3,
    }));
    setMemoView("show");
    setIsPlaying(true);
    setAudioDockOpen(true);
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
    const isVisibleInContinuousMode = pageLayout === "continuous"
      && p >= continuousStartPage
      && p <= continuousEndPage;
    if (!isVisibleInContinuousMode && visiblePages.left !== p && visiblePages.right !== p && activePage !== p) {
      setSelectedVerseKey(null);
      setEducationSelection(null);
    }
  }, [
    activePage,
    continuousEndPage,
    continuousStartPage,
    isPlaying,
    pageLayout,
    selectedVerseKey,
    verses,
    visiblePages,
  ]);

  const currentSpreadStart = activePage % 2 === 0 ? activePage - 1 : activePage;
  const canGoToNextSpread = pageLayout === "spread"
    ? currentSpreadStart + 2 <= LAST_PAGE
    : activePage < LAST_PAGE;
  const canGoToPreviousSpread = pageLayout === "spread"
    ? currentSpreadStart > FIRST_PAGE
    : activePage > FIRST_PAGE;

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, FIRST_PAGE), LAST_PAGE);
    if (nextPage === activePage) return;
    const nextVerse = verses.find((verse) => verse.page_id === nextPage);
    setTurnDirection(nextPage > activePage ? "next" : "previous");
    setActivePage(nextPage);
    if (pageLayout === "continuous") {
      setContinuousStartPage(nextPage);
      setContinuousEndPage(Math.min(LAST_PAGE, nextPage + 3));
    }
    if (!isPlaying) {
      setAudioDockOpen(false);
      setEducationSelection(null);
      setSelectedVerseKey(null);
    }
    if (nextVerse) {
      onNavigate({
        surah: nextVerse.chapter_id,
        ayah: nextVerse.number,
        page: nextPage,
      });
    }
  };

  const changePageLayout = (nextLayout: "spread" | "single" | "continuous") => {
    setPageLayout(nextLayout);
    if (nextLayout === "continuous") {
      setContinuousStartPage(activePage);
      setContinuousEndPage(Math.min(LAST_PAGE, activePage + 3));
    }
  };

  const adjustZoom = (delta: number) => {
    setZoom((current) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta));
      if (delta > 0 && next >= 130 && pageLayout === "spread") {
        setPageLayout("single");
        toast.info(lang === "ar"
          ? "تم التحويل إلى صفحة واحدة لتناسب التكبير"
          : "Switched to one page for better zoom");
      }
      return next;
    });
  };

  const continuousPages = useMemo(
    () => Array.from(
      { length: continuousEndPage - continuousStartPage + 1 },
      (_, index) => continuousStartPage + index,
    ),
    [continuousEndPage, continuousStartPage],
  );

  const goToSpread = (direction: "next" | "previous") => {
    const currentPage = pageLayout === "spread" ? currentSpreadStart : activePage;
    const step = pageLayout === "spread" ? 2 : 1;
    goToPage(
      direction === "next"
        ? currentPage + step
        : currentPage - step,
    );
  };

  useEffect(() => {
    const main = readerMainRef.current;
    if (!main) return;

    const resetSwipe = () => {
      swipeStartXRef.current = null;
      swipeLastXRef.current = null;
      swipeStartYRef.current = null;
      suppressSwipeClickRef.current = false;
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        resetSwipe();
        return;
      }
      const target = event.target;
      const isToolbarTouch = target instanceof Node && toolsHeaderRef.current?.contains(target);
      if (isToolbarTouch) {
        didSwipeRef.current = false;
        suppressSwipeClickRef.current = true;
      } else if (pageLayout === "continuous" || !(target instanceof Node) || !main.contains(target)) {
        resetSwipe();
        return;
      } else {
        const quranPage = target instanceof Element ? target.closest("[data-quran-page]") : null;
        if (!quranPage || (target instanceof Element && target.closest("input,select,textarea"))) {
          resetSwipe();
          return;
        }
        didSwipeRef.current = false;
        suppressSwipeClickRef.current = false;
      }
      const touch = event.touches[0];
      swipeStartXRef.current = touch.clientX;
      swipeLastXRef.current = touch.clientX;
      swipeStartYRef.current = touch.clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (swipeStartXRef.current === null || event.touches.length !== 1) return;
      const touch = event.touches[0];
      swipeLastXRef.current = touch.clientX;
      const horizontal = Math.abs(touch.clientX - swipeStartXRef.current);
      const vertical = Math.abs(touch.clientY - (swipeStartYRef.current ?? touch.clientY));
      if (horizontal > 12 && horizontal > vertical) event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      const startX = swipeStartXRef.current;
      const endX = event.changedTouches[0]?.clientX ?? swipeLastXRef.current;
      const suppressClick = suppressSwipeClickRef.current;
      resetSwipe();
      if (suppressClick) return;
      if (startX === null || endX === null) return;
      const movement = endX - startX;
      if (movement > 50) {
        didSwipeRef.current = true;
        goToSpread("next");
      } else if (movement < -50) {
        didSwipeRef.current = true;
        goToSpread("previous");
      }
    };

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    document.addEventListener("touchcancel", resetSwipe, { capture: true, passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", resetSwipe, true);
    };
  }, [activePage, loading, pageLayout]);

  const goToSurah = (chapterId: number) => {
    const firstVerse = verses.find(
      (verse) => verse.chapter_id === chapterId && verse.number === 1,
    );
    if (!firstVerse) return;
    const nextPage = firstVerse.page_id;
    setTurnDirection(nextPage >= activePage ? "next" : "previous");
    setActivePage(nextPage);
    if (pageLayout === "continuous") {
      setContinuousStartPage(nextPage);
      setContinuousEndPage(Math.min(LAST_PAGE, nextPage + 3));
    }
    if (!isPlaying) {
      setAudioDockOpen(false);
      setEducationSelection(null);
      setSelectedVerseKey(null);
    }
    onNavigate({
      surah: chapterId,
      ayah: 1,
      page: nextPage,
    });
  };

  const goToJuz = (partId: number) => {
    const firstVerse = verses.find((verse) => verse.part_id === partId);
    if (firstVerse) goToPage(firstVerse.page_id);
  };

  const renderPage = (page: number, physicalPage: "left" | "right" | "single" | "continuous") => {
    const failed = failedPages.has(page);

    return (
      <figure
        key={page}
        data-quran-page={page}
        data-testid="quran-mushaf-page"
        data-page-number={page}
        data-physical-page={physicalPage}
        className="quran-reader-figure relative mx-auto w-full overflow-hidden bg-[#fdfaf6] md:rounded-[3px] md:bg-white md:shadow-[0_20px_60px_rgba(34,87,57,0.16)] md:ring-1 md:ring-black/10"
        onClick={(event) => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          const target = event.target;
          if (target instanceof Element && target.closest("button,a,input,select,textarea,[role='button']")) return;

          if (physicalPage === "continuous") return;
          const clickedSide = physicalPage === "single"
            ? (event.clientX < event.currentTarget.getBoundingClientRect().left
              + event.currentTarget.getBoundingClientRect().width / 2 ? "left" : "right")
            : physicalPage;
          if (clickedSide === "left" && canGoToNextSpread) goToSpread("next");
          if (clickedSide === "right" && canGoToPreviousSpread) goToSpread("previous");
        }}
      >
        {physicalPage !== "continuous"
          && (physicalPage === "left" || physicalPage === "single")
          && canGoToNextSpread && (
          <button
            type="button"
            data-testid="quran-page-turn-next-zone"
            aria-label={lang === "ar" ? "النقر يسار الصفحة التالية" : "Click left for next page"}
            className="absolute inset-y-0 left-0 z-30 w-[8%] cursor-pointer bg-transparent"
            onClick={(event) => {
              event.stopPropagation();
              goToSpread("next");
            }}
          />
        )}
        {physicalPage !== "continuous"
          && (physicalPage === "right" || physicalPage === "single")
          && canGoToPreviousSpread && (
          <button
            type="button"
            data-testid="quran-page-turn-previous-zone"
            aria-label={lang === "ar" ? "النقر يمين الصفحة السابقة" : "Click right for previous page"}
            className="absolute inset-y-0 right-0 z-30 w-[8%] cursor-pointer bg-transparent"
            onClick={(event) => {
              event.stopPropagation();
              goToSpread("previous");
            }}
          />
        )}
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
            selectedVerseRange={copyRange}
            selectedWordId={educationSelection?.wordId}
            playingVerseKey={guidedOpen && guidedStage === 1 ? guidedVerseKey : audibleVerseKey}
            playingWordPosition={guidedOpen && guidedStage === 1 ? silentReadWordPosition : playingWordPosition}
            isAyahConcealed={(chapterId, verseNumber, wordPosition) =>
              isAyahConcealed(chapterId, verseNumber, playingAyahNum, wordPosition)
            }
            onVerseClick={(selection) => {
               const verseKey = selection.verseKey;
               const chapterId = Number(verseKey.split(":")[0]);
               const verseNumber = Number(verseKey.split(":")[1]);

               if (isAyahConcealed(
                 chapterId,
                 verseNumber,
                 playingAyahNum,
                 selection.wordPosition,
               )) {
                 toggleReveal(chapterId, verseNumber);
                 return;
               }

               if (copyRange && chapterId !== copyRange.surah) {
                 toast.error(lang === "ar"
                   ? "اختر الآية الأخيرة من السورة نفسها"
                   : "Choose the last ayah from the same surah");
                 return;
               }
               setSelectedVerseKey(verseKey);
               if (copyRange) {
                 setCopyRange((current) => current ? { ...current, endAyah: verseNumber } : current);
               }
               if (!educationHidden) {
                 setEducationSelection(selection);
               }
              if (selection.wordPosition !== null) {
                playWord(chapterId, verseNumber, selection.wordPosition);
                return;
              }
              setAudioDockOpen(true);
              // Pressing an ayah marker is a direct playback command. Pause the
              // old source immediately, then let the player load and start the
              // selected ayah even when it belongs to another surah.
              audioRef.current?.pause();
              setPlayingVerseKey(verseKey);
              setIsPlaying(true);
              setAudioDockOpen(true);
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
        "quran-reader-root relative flex flex-col bg-[#eeeae2] font-sans transition-colors duration-300 dark:bg-[#0a0c0b]",
        embedded
          ? "h-full overflow-hidden"
          : standalone
            ? "h-[100dvh] overflow-hidden"
            : "h-full min-h-0 overflow-hidden",
      )}
      dir={dir}
    >
      {quietMode && (
        <button
          type="button"
          onClick={() => setQuietMode(false)}
          className="quran-reader-quiet-exit fixed bottom-6 end-6 z-50 rounded-full bg-emerald-800 p-3 text-white opacity-40 shadow-lg transition-opacity hover:opacity-100"
          aria-label={lang === "ar" ? "إظهار الأدوات" : "Show controls"}
        >
          <Eye className="h-6 w-6" />
        </button>
      )}

      {!quietMode && (
        <header ref={toolsHeaderRef} className="quran-reader-header sticky top-0 z-40 shrink-0 rounded-b-2xl border-b border-emerald-900/10 bg-[#fbfaf6]/95 shadow-[0_6px_20px_rgba(34,87,57,0.08)] backdrop-blur-xl transition-all duration-300 dark:bg-[#0a0c0b]/95 lg:rounded-none lg:shadow-sm">
          <div className="flex flex-nowrap items-center justify-between gap-0.5 px-1 py-0.5 lg:flex-wrap lg:gap-3 lg:px-4 lg:py-3">

            {/* Back Navigation */}
            {!embedded && !standalone && (
              <button
                type="button"
                onClick={() => setLocation(backHref)}
                className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 lg:h-auto lg:w-auto lg:justify-start lg:rounded-none lg:hover:bg-transparent"
              >
                <ChevronLeft className="h-5 w-5 rtl:hidden" />
                <ChevronRight className="h-5 w-5 ltr:hidden" />
                <span className="hidden lg:inline">
                  {backLabel
                    ? (lang === "ar" ? backLabel.ar : backLabel.en)
                    : (lang === "ar" ? "العودة إلى إسلاميات حصاد" : "Back to Hasaad Islamic")}
                </span>
              </button>
            )}
            {standalone && canSync && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void handleStandaloneSyncToggle()}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
                  syncEnabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300",
                )}
                aria-pressed={syncEnabled}
                title={lang === "ar"
                  ? (syncEnabled ? "إيقاف المزامنة بين الأجهزة" : "مزامنة العلامات والموضع والقارئ بين الأجهزة")
                  : (syncEnabled ? "Turn off sync across devices" : "Sync bookmarks, position, and reciter across devices")}
              >
                {isSyncing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : syncEnabled
                    ? <Cloud className="h-4 w-4" />
                    : <CloudOff className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {lang === "ar" ? (syncEnabled ? "المزامنة مفعّلة" : "تفعيل المزامنة") : (syncEnabled ? "Sync on" : "Turn on sync")}
                </span>
              </button>
            )}
            {embedded && onExitEmbedded && (
              <button
                type="button"
                onClick={onExitEmbedded}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-emerald-700 transition-colors hover:bg-emerald-50 lg:hidden dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                aria-label={lang === "ar" ? "العودة إلى أقسام إسلاميات حصاد" : "Back to Hasaad Islamic sections"}
              >
                <ChevronLeft className="h-5 w-5 rtl:hidden" />
                <ChevronRight className="h-5 w-5 ltr:hidden" />
              </button>
            )}
            {/* Mobile location shortcuts */}
            <div className={cn(
              "min-w-0 shrink-0 items-center gap-0.5 lg:hidden",
              mobileToolsOpen ? "hidden" : "flex",
            )}>
              <label className="quran-reader-ui-label relative flex h-9 w-[4.25rem] min-w-0 items-center justify-between gap-0.5 rounded-xl border border-emerald-900/10 bg-white/55 px-1 text-emerald-950 transition-colors active:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100 dark:active:bg-emerald-950/50">
                <span className="min-w-0 truncate text-xs font-semibold">
                  {chapters.find((chapter) => chapter.id === selectedSurah)?.name
                    ? plainArabicSurahName(selectedSurah, chapters.find((chapter) => chapter.id === selectedSurah)!.name)
                    : (lang === "ar" ? "المصحف" : "Mushaf")}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-45" />
                <select
                  value={selectedSurah}
                  onChange={(event) => goToSurah(Number(event.target.value))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
                  data-testid="select-mobile-surah"
                >
                  {chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.id}. {lang === "ar" ? plainArabicSurahName(chapter.id, chapter.name) : chapter.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="quran-reader-ui-label relative flex h-9 shrink-0 items-center rounded-xl border border-emerald-900/10 bg-white/55 px-1.5 text-[11px] font-semibold text-emerald-900 transition-colors active:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100">
                <span>{lang === "ar" ? `ص ${activePage}` : `p. ${activePage}`}</span>
                <select
                  value={activePage}
                  onChange={(event) => goToPage(Number(event.target.value))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={lang === "ar" ? "اختيار الصفحة" : "Choose page"}
                  data-testid="select-mobile-page"
                >
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {lang === "ar" ? `صفحة ${page.id}` : `Page ${page.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Mobile primary actions */}
            <div className="flex shrink-0 items-center gap-0.5 lg:hidden">
              {!mobileToolsOpen && (
                <>
                  {!audioDockOpen && (
                    <button
                      type="button"
                      onClick={openAudioControls}
                      data-testid="button-mobile-audio"
                      className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/10 bg-emerald-50 text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
                      aria-label={lang === "ar" ? "فتح التلاوة واختيار القارئ" : "Open recitation and choose reciter"}
                      title={lang === "ar" ? "فتح مشغل التلاوة واختيار القارئ" : "Open recitation player and choose reciter"}
                    >
                      <Volume2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => changePageLayout(pageLayout === "continuous" ? "single" : "continuous")}
                    data-testid="button-mobile-page-layout"
                    className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/10 bg-white/55 text-emerald-900 transition-colors hover:bg-emerald-50 dark:bg-white/5 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
                    aria-label={pageLayout === "continuous"
                      ? (lang === "ar" ? "عرض صفحة واحدة" : "Show one page")
                      : (lang === "ar" ? "عرض صفحات متصلة" : "Show continuous pages")}
                    title={pageLayout === "continuous"
                      ? (lang === "ar" ? "صفحة واحدة" : "Single page")
                      : (lang === "ar" ? "صفحات متصلة" : "Continuous pages")}
                  >
                    {pageLayout === "continuous"
                      ? <Rows3 className="h-4 w-4" />
                      : <BookOpen className="h-4 w-4" />}
                  </button>
                  <QuranSearchDialog onSelect={({ pageId }) => goToPage(pageId)} />
                  <button
                    type="button"
                    onClick={toggleMemoSession}
                    data-testid="button-mobile-memo-session"
                    className={cn(
                      "quran-reader-ui-label flex h-9 items-center rounded-xl border border-emerald-900/10 px-1.5 text-[11px] font-semibold transition-colors",
                      guidedOpen
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                        : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200",
                    )}
                    aria-label={guidedOpen
                      ? (lang === "ar" ? "إنهاء الحفظ" : "End memorization")
                      : (lang === "ar" ? "ابدأ الحفظ" : "Start memorization")}
                  >
                    <span>{guidedOpen ? (lang === "ar" ? "إنهاء الحفظ" : "End memorization") : (lang === "ar" ? "ابدأ الحفظ" : "Start memorizing")}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setMobileToolsOpen((open) => !open)}
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-900/10 transition-colors",
                  mobileToolsOpen
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-white/55 text-emerald-900 dark:bg-white/5 dark:text-emerald-100"
                )}
                aria-expanded={mobileToolsOpen}
                aria-label={lang === "ar" ? "المزيد من أدوات المصحف" : "More Mushaf tools"}
              >
                {mobileToolsOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>

            {/* Expansion Area (Flex on Desktop, toggled on Mobile) */}
            <div className={cn(
              "w-full lg:w-auto flex-col lg:flex-row lg:flex-1 items-stretch lg:items-center justify-end gap-2 lg:gap-4",
              mobileToolsOpen ? "flex" : "hidden lg:flex"
            )}>
              {/* 1. Location Selectors */}
              <div className="flex items-center w-full lg:w-auto rounded-xl bg-muted/30 p-1 border border-border/40 shadow-sm">
                <div className="relative flex min-w-0 flex-1 items-center lg:flex-none">
                  <select
                    value={selectedSurah}
                    onChange={(event) => goToSurah(Number(event.target.value))}
                    className="w-full appearance-none truncate bg-transparent py-1.5 pe-8 ps-3 text-xs font-bold text-foreground outline-none hover:bg-black/5 cursor-pointer rounded-lg dark:hover:bg-white/5 lg:text-sm"
                    aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
                    data-testid="select-surah"
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id} className="bg-background">
                        {chapter.id}. {lang === "ar" ? plainArabicSurahName(chapter.id, chapter.name) : chapter.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>

                <div className="h-5 w-px shrink-0 bg-border/50" />

                <div className="relative flex min-w-0 flex-1 items-center lg:flex-none">
                  <select
                    value={activePageMeta?.part_id ?? FIRST_PAGE}
                    onChange={(event) => goToJuz(Number(event.target.value))}
                    className="w-full appearance-none truncate bg-transparent py-1.5 pe-8 ps-3 text-xs font-bold text-foreground outline-none hover:bg-black/5 cursor-pointer rounded-lg dark:hover:bg-white/5 lg:text-sm"
                    aria-label={lang === "ar" ? "اختيار الجزء" : "Choose juz"}
                    data-testid="select-juz"
                  >
                    {parts.map((part) => (
                      <option key={part.id} value={part.id} className="bg-background">
                        {lang === "ar" ? `الجزء ${part.id}` : `Juz ${part.id}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>

                <div className="h-5 w-px shrink-0 bg-border/50" />

                <div className="relative flex min-w-0 flex-1 items-center lg:flex-none">
                  <select
                    value={activePage}
                    onChange={(event) => goToPage(Number(event.target.value))}
                    className="w-full appearance-none truncate bg-transparent py-1.5 pe-8 ps-3 text-xs font-bold text-foreground outline-none hover:bg-black/5 cursor-pointer rounded-lg dark:hover:bg-white/5 lg:text-sm"
                    aria-label={lang === "ar" ? "اختيار الصفحة" : "Choose page"}
                    data-testid="select-page"
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id} className="bg-background">
                        {lang === "ar" ? `صفحة ${page.id}` : `Page ${page.id}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* 2. Practice/Memo Actions & View Toggle */}
              <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">

                {/* Practice / Memo */}
                <div className="flex flex-1 items-center gap-2 lg:flex-none">
                  {isIndependentPractice && !standalone && (
                    <button
                      type="button"
                      onClick={() => void recordIndependentPractice()}
                      disabled={recordSession.isPending}
                      data-testid="button-record-practice"
                      className="flex-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-50 lg:flex-none lg:text-sm"
                    >
                      {lang === "ar" ? "تسجيل الجلسة" : "Record"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleMemoSession}
                    data-testid="button-memo-session"
                    className={cn(
                      "hidden rounded-xl border px-3 py-2 text-xs font-black shadow-sm transition-colors lg:flex lg:flex-none lg:text-sm",
                      guidedOpen
                        ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-100"
                        : "border-border/60 bg-white text-foreground hover:bg-muted dark:bg-card"
                    )}
                  >
                    {guidedOpen ? (lang === "ar" ? "إنهاء الحفظ" : "End Memo") : (lang === "ar" ? "ابدأ الحفظ" : "Start Memorizing")}
                  </button>
                  {!standalone && LIVE_RECITATION_ENABLED && isAdmin && (
                    <button
                      type="button"
                      onClick={openLiveRecitation}
                      data-testid="button-live-recitation"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-800 lg:flex-none lg:text-sm"
                    >
                      <Mic2 className="h-4 w-4" />
                      {lang === "ar" ? "تسميع مباشر" : "Live recitation"}
                    </button>
                  )}
                </div>

              </div>

              {/* 3. Tools Island */}
              <div className="flex w-full items-center justify-center gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 px-2 shadow-sm lg:w-auto">
                <div className="hidden lg:block">
                  <QuranSearchDialog onSelect={({ pageId }) => goToPage(pageId)} />
                </div>

                <div className="mx-1 h-5 w-px bg-border/50" />
                <div className="relative">
                  <button type="button" onClick={() => { setCopyActionsOpen((v) => !v); setBookmarkActionsOpen(false); }}
                    data-testid="button-copy-actions" className="grid h-8 w-8 place-items-center rounded-lg text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200"
                    aria-label={lang === "ar" ? "خيارات النسخ" : "Copy options"}>
                    {copiedVerseKey === currentCopyKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  {copyActionsOpen && (
                    <div className="absolute end-0 top-10 z-50 flex min-w-36 flex-col gap-1 rounded-xl border bg-background p-1.5 shadow-xl">
                      <button type="button" onClick={() => void copySelection()} disabled={!selectedAyahText || isFetchingSelectedSurah}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-muted">
                        <Copy className="h-4 w-4" />{lang === "ar" ? (copyRange ? `نسخ ${copyCount} آيات` : "نسخ") : (copyRange ? `Copy ${copyCount}` : "Copy")}
                      </button>
                      <button type="button" onClick={toggleMultiCopy}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-muted">
                        {copyRange ? <X className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
                        {lang === "ar" ? (copyRange ? "إلغاء التحديد" : "تحديد آيات") : (copyRange ? "Cancel" : "Select ayahs")}
                      </button>
                    </div>
                  )}
                </div>

                {(canToggleCurrentBookmark || onOpenBookmarks) && (
                  <div className="relative">
                    <button type="button" onClick={() => { setBookmarkActionsOpen((v) => !v); setCopyActionsOpen(false); }}
                      data-testid="button-bookmark-actions" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={lang === "ar" ? "خيارات العلامات" : "Bookmark options"}>
                      <Bookmark className={cn("h-4 w-4", isCurrentBookmarked && "fill-current text-emerald-700")} />
                    </button>
                    {bookmarkActionsOpen && (
                      <div className="absolute end-0 top-10 z-50 flex min-w-40 flex-col gap-1 rounded-xl border bg-background p-1.5 shadow-xl">
                        {canToggleCurrentBookmark && (
                          <button type="button" disabled={isMutatingBookmark}
                            onClick={() => { toggleBookmark(selectedSurah, selectedAyah, canonicalPage, isCurrentBookmarked); setBookmarkActionsOpen(false); }}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-muted disabled:opacity-50">
                            <Bookmark className={cn("h-4 w-4", isCurrentBookmarked && "fill-current")} />
                            {lang === "ar" ? (isCurrentBookmarked ? "إزالة العلامة" : "حفظ العلامة") : (isCurrentBookmarked ? "Remove" : "Save")}
                          </button>
                        )}
                        {onOpenBookmarks && (
                          <button type="button" onClick={() => { setBookmarkActionsOpen(false); onOpenBookmarks(); }}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold hover:bg-muted">
                            <Bookmark className="h-4 w-4" />{lang === "ar" ? "كل العلامات" : "All bookmarks"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mx-1 h-5 w-px bg-border/50" />

                <select
                  value={pageLayout}
                  onChange={(event) => changePageLayout(event.target.value as "spread" | "single" | "continuous")}
                  data-testid="select-page-layout"
                  aria-label={lang === "ar" ? "طريقة عرض الصفحات" : "Page layout"}
                  className="h-8 rounded-lg bg-transparent px-2 text-xs font-bold text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                >
                  <option value="spread">{lang === "ar" ? "صفحتان" : "Spread"}</option>
                  <option value="single">{lang === "ar" ? "صفحة واحدة" : "Single page"}</option>
                  <option value="continuous">{lang === "ar" ? "متصلة" : "Continuous"}</option>
                </select>

                <div className="hidden items-center md:flex">
                  <button
                    type="button"
                    onClick={() => adjustZoom(-10)}
                    disabled={zoom <= MIN_ZOOM}
                    data-testid="button-zoom-out"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
                    aria-label={lang === "ar" ? "تصغير الصفحة" : "Zoom out"}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="min-w-9 text-center text-xs font-bold text-muted-foreground">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustZoom(10)}
                    disabled={zoom >= MAX_ZOOM}
                    data-testid="button-zoom-in"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
                    aria-label={lang === "ar" ? "تكبير الصفحة" : "Zoom in"}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                <div className="mx-1 hidden h-5 w-px bg-border/50 md:block" />

                <button
                  type="button"
                  onClick={() => setQuietMode(true)}
                  data-testid="button-quiet-mode"
                  className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
                  aria-label={lang === "ar" ? "وضع القراءة الهادئ" : "Quiet mode"}
                >
                  <EyeOff className="h-4 w-4" />
                </button>
              </div>

            </div>
          </div>

          {startAyah !== null && endAyah !== null && (
            <div className="border-y border-emerald-200/50 bg-emerald-50 px-2 py-1 text-center text-xs font-bold text-emerald-900 shadow-inner dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-100 md:px-4 md:py-2 md:text-sm">
              {lang === "ar"
                ? `مهمة ${mode === "memorization" ? "حفظ" : "مراجعة"}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === "memorization" ? "Memorization" : "Review"} task: ayahs ${startAyah}–${endAyah}`}
            </div>
          )}
        </header>
      )}

      <main
        ref={readerMainRef}
        className={cn(
          "quran-reader-main flex min-h-0 flex-1 flex-col items-start overflow-auto bg-[#fdfaf6] px-1.5 py-2 dark:bg-[#0a0c0b] md:bg-transparent md:px-8 md:py-8 md:dark:bg-transparent",
          guidedOpen && "quran-reader-main--guided touch-pan-y overscroll-contain",
        )}
        onScroll={(event) => {
          if (pageLayout !== "continuous") return;
          const container = event.currentTarget;
          if (container.scrollHeight - container.scrollTop - container.clientHeight < 700) {
            setContinuousEndPage((current) => Math.min(LAST_PAGE, current + 3));
          }
          const containerTop = container.getBoundingClientRect().top;
          const pageElements = Array.from(container.querySelectorAll<HTMLElement>("[data-quran-page]"));
          const nearestPage = pageElements.reduce<{ page: number; distance: number } | null>((nearest, element) => {
            const page = Number(element.dataset.quranPage);
            const distance = Math.abs(element.getBoundingClientRect().top - containerTop - 12);
            return !nearest || distance < nearest.distance ? { page, distance } : nearest;
          }, null);
          if (nearestPage && nearestPage.page !== activePage) {
            setActivePage(nearestPage.page);
          }
        }}
      >
        {pageLayout === "continuous" ? (
          <div
            className="quran-page-shell mx-auto flex w-full flex-col gap-1 transition-[width,max-width] duration-200"
            style={{
              width: `${zoom}%`,
              maxWidth: `${Math.round(7.2 * zoom)}px`,
            }}
          >
            {continuousPages.map((page) => renderPage(page, "continuous"))}
            {continuousEndPage < LAST_PAGE && (
              <div
                ref={continuousLoadMoreRef}
                aria-hidden="true"
                className="h-px w-full shrink-0"
              />
            )}
          </div>
        ) : (
          <div
            key={`${pageLayout}:${activePage}`}
            className={cn(
              "quran-page-shell quran-page-shell--paged mx-auto grid grid-cols-1 items-start gap-1 transition-[width,max-width] duration-200 md:gap-3",
              pageLayout === "spread" && "lg:grid-cols-2 lg:gap-3",
              turnDirection === "next" ? "quran-page-turn-next" : "quran-page-turn-previous",
            )}
            style={{
              width: `${zoom}%`,
              maxWidth: pageLayout === "spread"
                ? `${Math.round(10.32 * zoom)}px`
                : `${Math.round(7.2 * zoom)}px`,
            }}
          >
            {pageLayout === "spread" ? (
              <>
                <div className="hidden lg:block">{renderPage(visiblePages.right, "right")}</div>
                <div className="h-full lg:hidden">{renderPage(activePage, "single")}</div>
                {visiblePages.left !== null && (
                  <div className="hidden lg:block">{renderPage(visiblePages.left, "left")}</div>
                )}
              </>
            ) : (
              renderPage(activePage, "single")
            )}
          </div>
        )}

        <nav
          dir={dir}
          aria-label={lang === "ar" ? "التنقل بين صفحات المصحف" : "Mushaf page navigation"}
          className={cn(
            "quran-reader-nav mx-auto mt-1 hidden w-full max-w-[1032px] items-center justify-between gap-2 border-t border-emerald-900/10 px-1 pt-1 dark:border-white/10 md:mt-6 md:flex md:gap-3 md:pt-5",
            pageLayout === "continuous" && "hidden md:flex",
          )}
          style={{ width: pageLayout === "spread" ? `${zoom}%` : "100%" }}
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
        {guidedPanelHeight > 0 && (
          <div
            aria-hidden="true"
            className="quran-guided-scroll-reserve w-full shrink-0"
            style={{
              height: `calc(${guidedPanelHeight}px + 1.5rem + var(--quran-safe-area-bottom, env(safe-area-inset-bottom, 0px)))`,
            }}
          />
        )}
        {bottomDockHeight > 0 && (
          <div
            aria-hidden="true"
            className="quran-dock-scroll-reserve hidden w-full shrink-0 max-md:block"
            style={{
              height: `calc(${bottomDockHeight}px + var(--quran-safe-area-bottom, env(safe-area-inset-bottom, 0px)))`,
            }}
          />
        )}
      </main>

      {bottomDockVisible && (
        <div
          ref={bottomDockRef}
          className="quran-reader-dock relative z-40 flex max-h-[44dvh] w-full shrink-0 flex-col overflow-visible rounded-t-[22px] bg-[#fbfaf6] shadow-[0_-10px_34px_rgba(34,87,57,0.12)] ring-1 ring-emerald-950/10 dark:bg-[#111512] md:max-h-[58dvh] md:rounded-none"
          data-testid="quran-bottom-dock"
        >
          {(audioDockOpen || isPlaying) && selectedVerseKey && audioSurahs.length > 0 && (
            <div className="z-40 w-full shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
              <QuranAudioPlayer
                key={standalone ? (syncActive ? "synced-reciter" : "local-reciter") : "account-reciter"}
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
                guidedMemorizationActive={guidedOpen}
                memoView={memoView}
                onMemoViewChange={setMemoView}
                onPlayingWordChange={setPlayingWordPosition}
                showTafsirRestore={educationHidden}
                onShowTafsir={showEducation}
                onAudibleAyahChange={(audibleSurah, ayahNum) => {
                  if (ayahNum === null) {
                    setAudibleVerseKey(null);
                    return;
                  }
                  const audibleKey = `${audibleSurah}:${ayahNum}`;
                  setAudibleVerseKey(audibleKey);
                  setSelectedVerseKey(audibleKey);
                  const audibleVerse = verses.find(
                    verse => verse.chapter_id === audibleSurah && verse.number === ayahNum,
                  );
                  if (audibleVerse && audibleVerse.page_id !== activePage) {
                    goToPage(audibleVerse.page_id);
                  }
                }}
                preferenceStorage={standalone && !syncActive ? "local" : "server"}
                onPlaybackLocationChange={(nextSurah, nextAyah) => {
                  const nextVerseKey = `${nextSurah}:${nextAyah}`;
                  setPlayingVerseKey(nextVerseKey);
                  setIsPlaying(true);
                  goToSurah(nextSurah);
                }}
                onSurahEnd={() => {
                  if (playingSurah < 114 && startAyah === null && endAyah === null && !memoSession?.isActive) {
                    const nextSurah = playingSurah + 1;
                    setPlayingVerseKey(`${nextSurah}:1`);
                    setIsPlaying(true);
                    goToSurah(nextSurah);
                  }
                }}
                onClose={() => {
                  setIsPlaying(false);
                  setAudioDockOpen(false);
                  setPlayingVerseKey(null);
                  setAudibleVerseKey(null);
                  setSelectedVerseKey(null);
                  setEducationSelection(null);
                  setEducationLocked(false);
                }}
              />
            </div>
          )}
          {!educationHidden && educationSelection && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <QuranEducationPanel
                key={`${educationSelection.verseKey}:${educationSelection.wordPosition ?? 0}`}
                selection={educationSelection}
                onClose={() => setEducationSelection(null)}
                onHide={hideEducation}
                locked={educationLocked}
                onToggleLock={() => setEducationLocked((locked) => !locked)}
              />
            </div>
          )}
        </div>
      )}
      <QuranGuidedMemorizationPanel
        panelRef={guidedPanelRef}
        open={guidedOpen}
        stage={guidedStage}
        surahName={chapters.find((chapter) => chapter.id === Number(guidedVerseKey?.split(":")[0]))?.name ?? ""}
        ayahNumber={Number(guidedVerseKey?.split(":")[1]) || selectedAyah}
        isPlaying={isPlaying}
        repeatCount={memoSession.repeatCount}
        recitationRevealed={guidedRecitationRevealed}
        lang={lang}
        onClose={closeGuidedMemorization}
        onStageChange={setGuidedStageAndPlayback}
        onRepeatCountChange={(repeatCount) => {
          setMemoSession((session) => ({ ...session, repeatCount }));
        }}
        onReplay={replayGuidedRecitation}
        onRevealRecitation={() => {
          setGuidedRecitationRevealed(true);
          setMemoView("show");
        }}
        onAssess={(result) => {
          if (result === "review") {
            setGuidedStageAndPlayback(0);
            toast.success(lang === "ar" ? "سنكرر الآية الآن" : "Let’s repeat this ayah");
            return;
          }
          const currentSurah = Number(guidedVerseKey?.split(":")[0]);
          const currentAyah = Number(guidedVerseKey?.split(":")[1]);
          const nextVerse = verses.find(
            (verse) => verse.chapter_id === currentSurah && verse.number === currentAyah + 1,
          );
          if (!nextVerse) {
            toast.success(lang === "ar" ? "أتممت آخر آية في السورة" : "You completed the final ayah");
            closeGuidedMemorization();
            return;
          }
          const nextKey = `${nextVerse.chapter_id}:${nextVerse.number}`;
          setSelectedVerseKey(nextKey);
          setGuidedVerseKey(nextKey);
          setGuidedStage(0);
          setGuidedRecitationRevealed(false);
          setMemoView("show");
          setMemoSession((session) => ({
            ...session,
            isActive: true,
            rangeEnd: nextVerse.number,
            repeatScope: "ayah",
            repeatCount: 3,
          }));
          setPlayingVerseKey(nextKey);
          setIsPlaying(true);
          if (nextVerse.page_id !== activePage) goToPage(nextVerse.page_id);
          toast.success(lang === "ar" ? "ننتقل إلى الآية التالية" : "Moving to the next ayah");
        }}
      />
    </div>
  );
}
