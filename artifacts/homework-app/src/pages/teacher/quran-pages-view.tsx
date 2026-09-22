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
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { QuranSearchDialog } from "./quran-search-dialog";
import { QuranInstallExperience } from "@/components/quran/quran-install-invite";
import { useQuranInstall } from "@/components/quran/use-quran-install";
import {
  getGetQuranJourneyQueryKey,
  getGetQuranSurahContentQueryKey,
  getGetCurrentTeacherQueryKey,
  useGetCurrentTeacher,
  useGetQuranSurahContent,
  getQuranSurahContent,
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
import { QuranAyahActionSurface } from "@/components/quran/quran-ayah-action-surface";
import { QuranWordActionPopover } from "@/components/quran/quran-word-action-popover";
import type { QuranSurahParsed } from "@/lib/quran-parser";
import { useQuranReaderState } from "@/components/quran/use-quran-reader-state";
import { useQuranMemoSession } from "@/components/quran/use-quran-memo-session";
import { useQuranWordAudio } from "@/components/quran/use-quran-word-audio";
import { QuranReaderTips } from "@/components/quran/quran-reader-tips";

const QURAN_EDUCATION_HIDDEN_KEY = "quran-education-hidden";
const QURAN_READER_TIPS_KEY = "quran-reader-tips-seen-v1";

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
  const [toolsHeaderHeight, setToolsHeaderHeight] = useState(0);
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
  const swipePointerIdRef = useRef<number | null>(null);
  const suppressSwipeClickRef = useRef(false);
  const readerMainRef = useRef<HTMLElement | null>(null);
  const continuousProgrammaticNavigationRef = useRef(false);
  const continuousLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const playbackAutoNavigationRef = useRef(false);
  const playbackAutoNavigationTimeoutRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

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
  const bookmarkedVerseKeys = useMemo(
    () => new Set(bookmarksMap.keys()),
    [bookmarksMap],
  );

  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);
  const [educationSelection, setEducationSelection] = useState<{
    verseKey: string;
    wordId: number | null;
    wordPosition: number | null;
    wordText: string | null;
  } | null>(null);
  const [educationInitialTab, setEducationInitialTab] = useState<"meaning" | "translation" | "tafsir">("tafsir");
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [audibleVerseKey, setAudibleVerseKey] = useState<string | null>(null);
  const [playbackFollowSuspended, setPlaybackFollowSuspended] = useState(false);
  const [playingWordPosition, setPlayingWordPosition] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDockOpen, setAudioDockOpen] = useState(false);
  const [educationLocked, setEducationLocked] = useState(false);
  const [educationHidden, setEducationHidden] = useState(true);
  const [copiedVerseKey, setCopiedVerseKey] = useState<string | null>(null);
  const [copyRange, setCopyRange] = useState<{
    surah: number;
    startAyah: number;
    endAyah: number;
  } | null>(null);
  const [copyActionsOpen, setCopyActionsOpen] = useState(false);
  const [bookmarkActionsOpen, setBookmarkActionsOpen] = useState(false);
  const [ayahActionVerseKey, setAyahActionVerseKey] = useState<string | null>(null);
  const [ayahActionAnchor, setAyahActionAnchor] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null>(null);
  const [wordAction, setWordAction] = useState<{
    verseKey: string;
    wordId: number;
    wordPosition: number;
    wordText: string;
    anchorRect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  } | null>(null);
  const [showReaderTips, setShowReaderTips] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(QURAN_READER_TIPS_KEY) !== "true",
  );
  const { playWord, stopWordAudio } = useQuranWordAudio();
  const [installManualOpen, setInstallManualOpen] = useState(false);
  const { platform, isInstallable } = useQuranInstall();

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

  const hideEducation = () => {
    setEducationHidden(true);
    setEducationSelection(null);
    setEducationLocked(false);
    window.localStorage.setItem(QURAN_EDUCATION_HIDDEN_KEY, "true");
  };

  const showEducation = () => {
    setEducationInitialTab("tafsir");
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
    if (!isPlaying || !audibleVerseKey || playbackFollowSuspended) return;
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
          playbackAutoNavigationRef.current = true;
          if (playbackAutoNavigationTimeoutRef.current !== null) {
            window.clearTimeout(playbackAutoNavigationTimeoutRef.current);
          }
          playbackAutoNavigationTimeoutRef.current = window.setTimeout(() => {
            playbackAutoNavigationRef.current = false;
            playbackAutoNavigationTimeoutRef.current = null;
          }, 800);
          verseElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activePage, audibleVerseKey, bottomDockHeight, isPlaying, pageLayout, playbackFollowSuspended]);

  useEffect(() => {
    return () => {
      if (playbackAutoNavigationTimeoutRef.current !== null) {
        window.clearTimeout(playbackAutoNavigationTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    const header = toolsHeaderRef.current;
    if (quietMode || !header) {
      setToolsHeaderHeight(0);
      return;
    }
    const updateHeight = () => setToolsHeaderHeight(header.getBoundingClientRect().height);
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [loading, mobileToolsOpen, quietMode, startAyah, endAyah]);

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
      if (copyRange) setCopyRange(null);
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
      setPlaybackFollowSuspended(false);
    } else {
      const newKey = `${playingSurah}:${ayahNum}`;
      if (playingVerseKey === null) {
        setPlaybackFollowSuspended(false);
      }
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
    setEducationHidden(true);
    setEducationSelection(null);
    setEducationLocked(false);
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

  const playbackPage = useMemo(() => {
    const playbackKey = audibleVerseKey ?? playingVerseKey;
    if (!playbackKey) return null;
    const [surah, ayah] = playbackKey.split(":").map(Number);
    return verses.find(
      verse => verse.chapter_id === surah && verse.number === ayah,
    )?.page_id ?? null;
  }, [audibleVerseKey, playingVerseKey, verses]);

  const isPageVisibleFromAnchor = (
    anchorPage: number,
    targetPage: number,
    layout: "spread" | "single" | "continuous" = pageLayout,
  ) => {
    if (layout === "continuous") {
      return targetPage >= anchorPage && targetPage <= Math.min(LAST_PAGE, anchorPage + 3);
    }
    if (layout === "single") return anchorPage === targetPage;
    const spreadStart = anchorPage % 2 === 0 ? anchorPage - 1 : anchorPage;
    return targetPage === spreadStart || targetPage === spreadStart + 1;
  };

  const beginPlaybackAutoNavigation = () => {
    playbackAutoNavigationRef.current = true;
    if (playbackAutoNavigationTimeoutRef.current !== null) {
      window.clearTimeout(playbackAutoNavigationTimeoutRef.current);
    }
    playbackAutoNavigationTimeoutRef.current = window.setTimeout(() => {
      playbackAutoNavigationRef.current = false;
      playbackAutoNavigationTimeoutRef.current = null;
    }, 800);
  };

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

  const goToPage = (page: number, source: "manual" | "playback" = "manual") => {
    const nextPage = Math.min(Math.max(page, FIRST_PAGE), LAST_PAGE);
    if (source === "playback" && playbackFollowSuspended) {
      if (pageLayout === "continuous") {
        setContinuousStartPage(current => Math.min(current, nextPage));
        setContinuousEndPage(current => Math.max(current, nextPage));
      }
      return;
    }
    if (source === "playback") {
      beginPlaybackAutoNavigation();
    } else if (isPlaying && playbackPage !== null) {
      setPlaybackFollowSuspended(!isPageVisibleFromAnchor(nextPage, playbackPage));
    }
    if (nextPage === activePage) return;
    const nextVerse = verses.find((verse) => verse.page_id === nextPage);
    setTurnDirection(nextPage > activePage ? "next" : "previous");
    setActivePage(nextPage);
    if (pageLayout === "continuous") {
      continuousProgrammaticNavigationRef.current = true;
      setContinuousStartPage(nextPage);
      setContinuousEndPage(Math.min(LAST_PAGE, nextPage + 3));
      window.requestAnimationFrame(() => {
        if (readerMainRef.current) readerMainRef.current.scrollTop = 0;
        window.requestAnimationFrame(() => {
          if (readerMainRef.current) readerMainRef.current.scrollTop = 0;
          continuousProgrammaticNavigationRef.current = false;
        });
      });
    }
    if (!isPlaying) {
      setPlaybackFollowSuspended(false);
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

  const dismissReaderTips = () => {
    window.localStorage.setItem(QURAN_READER_TIPS_KEY, "true");
    setShowReaderTips(false);
  };

  useEffect(() => {
    const main = readerMainRef.current;
    if (!main) return;

    const resetSwipe = () => {
      swipeStartXRef.current = null;
      swipeLastXRef.current = null;
      swipeStartYRef.current = null;
      swipePointerIdRef.current = null;
      suppressSwipeClickRef.current = false;
      setSwipeOffset(0);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      const target = event.target;
      if (pageLayout === "continuous" || !(target instanceof Node) || !main.contains(target)) {
        resetSwipe();
        return;
      }
      const quranPage = target instanceof Element
        ? target.closest("[data-quran-page], .quran-page-shell--paged")
        : null;
      if (!quranPage || (target instanceof Element && target.closest("input,select,textarea"))) {
        resetSwipe();
        return;
      }
      didSwipeRef.current = false;
      suppressSwipeClickRef.current = false;
      swipePointerIdRef.current = event.pointerId;
      swipeStartXRef.current = event.clientX;
      swipeLastXRef.current = event.clientX;
      swipeStartYRef.current = event.clientY;
      try {
        main.setPointerCapture(event.pointerId);
      } catch {
        // Some embedded browsers do not allow capture for synthetic or
        // already-captured touch pointers; bubbling events still drive swipe.
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (swipePointerIdRef.current !== event.pointerId || swipeStartXRef.current === null) return;
      swipeLastXRef.current = event.clientX;
      const movement = event.clientX - swipeStartXRef.current;
      const horizontal = Math.abs(movement);
      const vertical = Math.abs(event.clientY - (swipeStartYRef.current ?? event.clientY));
      if (horizontal > 12 && horizontal > vertical) {
        event.preventDefault();
        const resistedOffset = Math.sign(movement) * Math.min(64, horizontal * 0.42);
        setSwipeOffset(resistedOffset);
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (swipePointerIdRef.current !== event.pointerId) return;
      const startX = swipeStartXRef.current;
      const endX = event.clientX ?? swipeLastXRef.current;
      const suppressClick = suppressSwipeClickRef.current;
      if (main.hasPointerCapture(event.pointerId)) {
        try {
          main.releasePointerCapture(event.pointerId);
        } catch {
          // The browser may release touch capture before pointerup.
        }
      }
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
    const onPointerCancel = (event: PointerEvent) => {
      if (swipePointerIdRef.current !== event.pointerId) return;
      if (main.hasPointerCapture(event.pointerId)) {
        try {
          main.releasePointerCapture(event.pointerId);
        } catch {
          // The browser may release touch capture before pointercancel.
        }
      }
      resetSwipe();
    };

    main.addEventListener("pointerdown", onPointerDown);
    main.addEventListener("pointermove", onPointerMove);
    main.addEventListener("pointerup", onPointerEnd);
    main.addEventListener("pointercancel", onPointerCancel);
    return () => {
      main.removeEventListener("pointerdown", onPointerDown);
      main.removeEventListener("pointermove", onPointerMove);
      main.removeEventListener("pointerup", onPointerEnd);
      main.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [activePage, loading, pageLayout]);

  const goToSurah = (chapterId: number, source: "manual" | "playback" = "manual") => {
    const firstVerse = verses.find(
      (verse) => verse.chapter_id === chapterId && verse.number === 1,
    );
    if (!firstVerse) return;
    const nextPage = firstVerse.page_id;
    if (source === "playback" && playbackFollowSuspended) {
      if (pageLayout === "continuous") {
        setContinuousStartPage(current => Math.min(current, nextPage));
        setContinuousEndPage(current => Math.max(current, nextPage));
      }
      return;
    }
    if (source === "playback") {
      beginPlaybackAutoNavigation();
    } else if (isPlaying && playbackPage !== null) {
      setPlaybackFollowSuspended(!isPageVisibleFromAnchor(nextPage, playbackPage));
    }
    setTurnDirection(nextPage >= activePage ? "next" : "previous");
    setActivePage(nextPage);
    if (pageLayout === "continuous") {
      setContinuousStartPage(nextPage);
      setContinuousEndPage(Math.min(LAST_PAGE, nextPage + 3));
    }
    if (!isPlaying) {
      setPlaybackFollowSuspended(false);
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
          // On phones, page navigation is swipe-only. Taps remain available
          // for words and controls without accidentally turning the page.
          if (window.innerWidth < 768) return;
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
            className="absolute inset-y-0 left-0 z-30 hidden w-[8%] cursor-pointer bg-transparent md:block"
            onClick={(event) => {
              event.stopPropagation();
              if (window.innerWidth < 768) return;
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
            className="absolute inset-y-0 right-0 z-30 hidden w-[8%] cursor-pointer bg-transparent md:block"
            onClick={(event) => {
              event.stopPropagation();
              if (window.innerWidth < 768) return;
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
            bookmarkedVerseKeys={bookmarkedVerseKeys}
            isAyahConcealed={(chapterId, verseNumber, wordPosition) =>
              isAyahConcealed(chapterId, verseNumber, playingAyahNum, wordPosition)
            }
            onVerseAction={(selection) => {
              const [chapterId, verseNumber] = selection.verseKey.split(":").map(Number);
              if (copyRange && selection.wordPosition === null) {
                if (chapterId !== copyRange.surah) {
                  toast.error(lang === "ar"
                    ? "اختر الآية الأخيرة من السورة نفسها"
                    : "Choose the last ayah from the same surah");
                  return;
                }
                setSelectedVerseKey(selection.verseKey);
                setCopyRange((current) => current ? { ...current, endAyah: verseNumber } : current);
                return;
              }
              setSelectedVerseKey(selection.verseKey);
              if (selection.wordPosition !== null) {
                if (selection.wordId !== null && selection.wordText && selection.anchorRect) {
                  setWordAction({
                    verseKey: selection.verseKey,
                    wordId: selection.wordId,
                    wordPosition: selection.wordPosition,
                    wordText: selection.wordText,
                    anchorRect: selection.anchorRect,
                  });
                }
                return;
              }
              setAyahActionAnchor(selection.anchorRect ?? null);
              setAyahActionVerseKey(selection.verseKey);
            }}
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
               if (selection.wordPosition !== null) {
                 if (selection.wordId !== null && selection.wordText && selection.anchorRect) {
                   setWordAction({
                     verseKey: selection.verseKey,
                     wordId: selection.wordId,
                     wordPosition: selection.wordPosition,
                     wordText: selection.wordText,
                     anchorRect: selection.anchorRect,
                   });
                 }
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

  const backButtonDesktop = !embedded && !standalone ? (
    <button
      type="button"
      onClick={() => setLocation(backHref)}
      className="hidden h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:inline-flex"
    >
      <ChevronLeft className="h-4 w-4 rtl:hidden" />
      <ChevronRight className="h-4 w-4 ltr:hidden" />
      <span>
        {backLabel
          ? (lang === "ar" ? backLabel.ar : backLabel.en)
          : (lang === "ar" ? "العودة" : "Back")}
      </span>
    </button>
  ) : null;

  const backButtonMobile = !embedded && !standalone ? (
    <button
      type="button"
      onClick={() => setLocation(backHref)}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
      aria-label={lang === "ar" ? "العودة" : "Back"}
    >
      <ChevronLeft className="h-4 w-4 rtl:hidden" />
      <ChevronRight className="h-4 w-4 ltr:hidden" />
    </button>
  ) : null;

  const exitEmbeddedButton = embedded && onExitEmbedded ? (
    <button
      type="button"
      onClick={onExitEmbedded}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
      aria-label={lang === "ar" ? "العودة" : "Back"}
    >
      <ChevronLeft className="h-4 w-4 rtl:hidden" />
      <ChevronRight className="h-4 w-4 ltr:hidden" />
    </button>
  ) : null;

  const syncButton = standalone && canSync ? (
    <button
      type="button"
      disabled={isSyncing}
      onClick={() => void handleStandaloneSyncToggle()}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-colors disabled:opacity-50",
        syncEnabled
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
          : "text-emerald-700 hover:bg-emerald-900/5 dark:text-emerald-400 dark:hover:bg-white/10",
      )}
      title={lang === "ar"
        ? "مزامنة آخر موضع والعلامات والتفضيلات"
        : "Sync your reading position, bookmarks, and preferences"}
    >
      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : syncEnabled ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {lang === "ar" ? (syncEnabled ? "مزامنة مفعّلة" : "المزامنة") : (syncEnabled ? "Sync on" : "Sync")}
      </span>
    </button>
  ) : null;

  const surahSelect = (
    <div className="relative flex h-full min-w-0 flex-1 items-center lg:flex-none">
      <select
        value={selectedSurah}
        onChange={(event) => goToSurah(Number(event.target.value))}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none transition-colors hover:bg-emerald-900/5 focus:bg-emerald-900/5 cursor-pointer dark:text-emerald-100 dark:hover:bg-white/10 dark:focus:bg-white/10 lg:text-sm"
        aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
        data-testid="select-surah"
      >
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id} className="bg-background text-foreground">
            {chapter.id}. {lang === "ar" ? plainArabicSurahName(chapter.id, chapter.name) : chapter.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const juzSelect = (
    <div className="relative flex h-full min-w-0 flex-1 items-center lg:flex-none">
      <select
        value={activePageMeta?.part_id ?? FIRST_PAGE}
        onChange={(event) => goToJuz(Number(event.target.value))}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none transition-colors hover:bg-emerald-900/5 focus:bg-emerald-900/5 cursor-pointer dark:text-emerald-100 dark:hover:bg-white/10 dark:focus:bg-white/10 lg:text-sm"
        aria-label={lang === "ar" ? "اختيار الجزء" : "Choose juz"}
        data-testid="select-juz"
      >
        {parts.map((part) => (
          <option key={part.id} value={part.id} className="bg-background text-foreground">
            {lang === "ar" ? `الجزء ${part.id}` : `Juz ${part.id}`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const pageSelect = (
    <div className="relative flex h-full min-w-0 flex-1 items-center lg:flex-none">
      <select
        value={activePage}
        onChange={(event) => goToPage(Number(event.target.value))}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none transition-colors hover:bg-emerald-900/5 focus:bg-emerald-900/5 cursor-pointer dark:text-emerald-100 dark:hover:bg-white/10 dark:focus:bg-white/10 lg:text-sm"
        aria-label={lang === "ar" ? "اختيار الصفحة" : "Choose page"}
        data-testid="select-page"
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id} className="bg-background text-foreground">
            {lang === "ar" ? `صفحة ${page.id}` : `Page ${page.id}`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const mobileSurahSelect = (
    <div className="relative flex h-full min-w-0 flex-1 items-center">
      <select
        value={selectedSurah}
        onChange={(event) => goToSurah(Number(event.target.value))}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none cursor-pointer dark:text-emerald-100"
        aria-label={lang === "ar" ? "اختيار السورة" : "Choose surah"}
        data-testid="select-mobile-surah"
      >
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.id}. {lang === "ar" ? plainArabicSurahName(chapter.id, chapter.name) : chapter.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const mobilePageSelect = (
    <div className="relative flex h-full min-w-0 shrink-0 items-center">
      <select
        value={activePage}
        onChange={(event) => goToPage(Number(event.target.value))}
        className="h-full w-full appearance-none truncate rounded-md bg-transparent pe-5 ps-2 text-[11px] font-bold text-emerald-950 outline-none cursor-pointer dark:text-emerald-100"
        aria-label={lang === "ar" ? "اختيار الصفحة" : "Choose page"}
        data-testid="select-mobile-page"
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {lang === "ar" ? `ص ${page.id}` : `p. ${page.id}`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-1 h-3 w-3 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const layoutSelectDesktop = (
    <div className="relative flex h-full flex-1 items-center">
      <select
        value={pageLayout}
        onChange={(event) => changePageLayout(event.target.value as "spread" | "single" | "continuous")}
        data-testid="select-page-layout"
        className="h-full w-full appearance-none rounded-md bg-transparent pe-7 ps-3 text-xs font-bold text-emerald-950 outline-none transition-colors hover:bg-emerald-900/5 focus:bg-emerald-900/5 cursor-pointer dark:text-emerald-100 dark:hover:bg-white/10 dark:focus:bg-white/10"
        aria-label={lang === "ar" ? "طريقة عرض الصفحات" : "Page layout"}
      >
        <option value="spread" className="bg-background text-foreground">{lang === "ar" ? "صفحتان" : "Spread"}</option>
        <option value="single" className="bg-background text-foreground">{lang === "ar" ? "صفحة" : "Single"}</option>
        <option value="continuous" className="bg-background text-foreground">{lang === "ar" ? "متصلة" : "Continuous"}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute end-2 h-3.5 w-3.5 text-emerald-900/40 dark:text-emerald-100/40" />
    </div>
  );

  const zoomControlsDesktop = (
    <div className="flex h-full shrink-0 items-center gap-0.5 px-1">
      <button
        type="button"
        onClick={() => adjustZoom(-10)}
        disabled={zoom <= MIN_ZOOM}
        data-testid="button-zoom-out"
        className="grid h-7 w-7 place-items-center rounded text-emerald-800 transition-colors hover:bg-emerald-900/5 disabled:opacity-35 dark:text-emerald-300 dark:hover:bg-white/10"
        aria-label={lang === "ar" ? "تصغير" : "Zoom out"}
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <span className="min-w-9 text-center text-[11px] font-bold text-emerald-950 dark:text-emerald-100">
        {zoom}%
      </span>
      <button
        type="button"
        onClick={() => adjustZoom(10)}
        disabled={zoom >= MAX_ZOOM}
        data-testid="button-zoom-in"
        className="grid h-7 w-7 place-items-center rounded text-emerald-800 transition-colors hover:bg-emerald-900/5 disabled:opacity-35 dark:text-emerald-300 dark:hover:bg-white/10"
        aria-label={lang === "ar" ? "تكبير" : "Zoom in"}
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </div>
  );

  const searchDialogWrapped = (
    <div className="flex shrink-0 items-center" onPointerDown={() => setMobileToolsOpen(false)}>
      <QuranSearchDialog onSelect={({ pageId }) => goToPage(pageId)} />
    </div>
  );

  const copyDropdown = (
    <div className="relative flex shrink-0">
      <button
        type="button"
        onClick={() => { setCopyActionsOpen((v) => !v); setBookmarkActionsOpen(false); }}
        data-testid="button-copy-actions"
        className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
        aria-label={lang === "ar" ? "خيارات النسخ" : "Copy options"}
      >
        {copiedVerseKey === currentCopyKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      {copyActionsOpen && (
        <div className="fixed inset-x-3 top-24 z-50 flex min-w-40 flex-col gap-1 rounded-xl border border-emerald-900/10 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0a0c0b]/95 sm:absolute sm:inset-x-auto sm:end-0 sm:top-10">
          <button type="button" onClick={() => void copySelection()} disabled={!selectedAyahText || isFetchingSelectedSurah}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:bg-emerald-900/5 disabled:opacity-50 dark:hover:bg-white/10">
            <Copy className="h-4 w-4" />{lang === "ar" ? (copyRange ? `نسخ ${copyCount} آيات` : "نسخ") : (copyRange ? `Copy ${copyCount}` : "Copy")}
          </button>
          <button type="button" onClick={toggleMultiCopy}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:bg-emerald-900/5 dark:hover:bg-white/10">
            {copyRange ? <X className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
            {lang === "ar" ? (copyRange ? "إلغاء التحديد" : "تحديد آيات") : (copyRange ? "Cancel" : "Select ayahs")}
          </button>
        </div>
      )}
    </div>
  );

  const bookmarkDropdown = (canToggleCurrentBookmark || onOpenBookmarks) ? (
    <div className="relative flex shrink-0">
      <button
        type="button"
        onClick={() => { setBookmarkActionsOpen((v) => !v); setCopyActionsOpen(false); }}
        data-testid="button-bookmark-actions"
        className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
        aria-label={lang === "ar" ? "خيارات العلامات" : "Bookmark options"}
      >
        <Bookmark className={cn("h-4 w-4", isCurrentBookmarked && "fill-current")} />
      </button>
      {bookmarkActionsOpen && (
        <div className="fixed inset-x-3 top-24 z-50 flex min-w-40 flex-col gap-1 rounded-xl border border-emerald-900/10 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0a0c0b]/95 sm:absolute sm:inset-x-auto sm:end-0 sm:top-10">
          {canToggleCurrentBookmark && (
            <button type="button" disabled={isMutatingBookmark}
              onClick={() => { toggleBookmark(selectedSurah, selectedAyah, canonicalPage, isCurrentBookmarked); setBookmarkActionsOpen(false); }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:bg-emerald-900/5 disabled:opacity-50 dark:hover:bg-white/10">
              <Bookmark className={cn("h-4 w-4", isCurrentBookmarked && "fill-current")} />
              {lang === "ar" ? (isCurrentBookmarked ? "إزالة العلامة" : "إضافة علامة") : (isCurrentBookmarked ? "Remove" : "Add bookmark")}
            </button>
          )}
          {onOpenBookmarks && (
            <button type="button" onClick={() => { setBookmarkActionsOpen(false); onOpenBookmarks(); }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors hover:bg-emerald-900/5 dark:hover:bg-white/10">
              <Bookmark className="h-4 w-4" />{lang === "ar" ? "كل العلامات" : "All bookmarks"}
            </button>
          )}
        </div>
      )}
    </div>
  ) : null;

  const quietModeButton = (
    <button
      type="button"
      onClick={() => {
        setQuietMode(true);
        toast.info(lang === "ar"
          ? "تم تشغيل وضع القراءة الهادئ — اضغط إظهار الأدوات للخروج"
          : "Quiet reading is on — use Show tools to exit");
      }}
      data-testid="button-quiet-mode"
      className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
      aria-label={lang === "ar" ? "وضع القراءة الهادئ" : "Quiet mode"}
    >
      <EyeOff className="h-4 w-4" />
    </button>
  );

  const installButton = standalone && isInstallable ? (
    <button
      type="button"
      onClick={() => setInstallManualOpen(true)}
      data-testid="button-install-pwa"
      className="grid h-9 w-9 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
      aria-label={lang === "ar" ? "تثبيت التطبيق" : "Install App"}
    >
      <Download className="h-4 w-4" />
    </button>
  ) : null;

  const audioButtonMobile = !audioDockOpen ? (
    <button
      type="button"
      onClick={openAudioControls}
      data-testid="button-mobile-audio"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
      aria-label={lang === "ar" ? "التلاوة" : "Recitation"}
    >
      <Volume2 className="h-4.5 w-4.5" />
    </button>
  ) : null;

  const audioButtonDesktop = !audioDockOpen ? (
    <button
      type="button"
      onClick={openAudioControls}
      data-testid="button-desktop-audio"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
      aria-label={lang === "ar" ? "فتح مشغل التلاوة" : "Open recitation player"}
    >
      <Volume2 className="h-4 w-4" />
      <span>{lang === "ar" ? "التلاوة" : "Recitation"}</span>
    </button>
  ) : null;

  const recordPracticeButton = isIndependentPractice && !standalone ? (
    <button
      type="button"
      onClick={() => void recordIndependentPractice()}
      disabled={recordSession.isPending}
      data-testid="button-record-practice"
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-emerald-700 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700 lg:text-sm"
    >
      {lang === "ar" ? "تسجيل الجلسة" : "Record"}
    </button>
  ) : null;

  const liveRecitationButton = !standalone && liveRecitationAvailable && isAdmin ? (
    <button
      type="button"
      onClick={openLiveRecitation}
      data-testid="button-live-recitation"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 lg:text-sm"
    >
      <Mic2 className="h-4 w-4" />
      <span className="hidden sm:inline">{lang === "ar" ? "تسميع مباشر" : "Live recitation"}</span>
    </button>
  ) : null;

  const memoButton = (
    <button
      type="button"
      onClick={toggleMemoSession}
      data-testid="button-memo-session"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 text-xs font-bold transition-colors lg:text-sm",
        guidedOpen
          ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
          : "bg-emerald-900/5 text-emerald-800 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
      )}
    >
      {guidedOpen ? (lang === "ar" ? "إنهاء حفظني" : "End Memorize me") : (lang === "ar" ? "حفظني" : "Memorize me")}
    </button>
  );

  const memoButtonMobile = (
    <button
      type="button"
      onClick={toggleMemoSession}
      data-testid="button-mobile-memo-session"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-bold transition-colors lg:hidden",
        guidedOpen
          ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
          : "bg-emerald-900/5 text-emerald-800 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
      )}
    >
      {guidedOpen ? (lang === "ar" ? "إنهاء حفظني" : "End Memorize me") : (lang === "ar" ? "حفظني" : "Memorize me")}
    </button>
  );

  const layoutToggleButtonMobile = (
    <button
      type="button"
      onClick={() => changePageLayout(pageLayout === "continuous" ? "single" : "continuous")}
      data-testid="button-mobile-page-layout"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10 lg:hidden"
      aria-label={pageLayout === "continuous" ? (lang === "ar" ? "عرض صفحة واحدة" : "Show one page") : (lang === "ar" ? "عرض صفحات متصلة" : "Show continuous pages")}
    >
      {pageLayout === "continuous" ? <Rows3 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
    </button>
  );

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
          onClick={() => {
            setQuietMode(false);
            toast.info(lang === "ar" ? "عادت أدوات المصحف" : "Quran tools are visible");
          }}
          className="quran-reader-quiet-exit fixed bottom-6 end-6 z-50 rounded-full bg-emerald-800 p-3 text-white opacity-40 shadow-lg transition-opacity hover:opacity-100"
          aria-label={lang === "ar" ? "إظهار الأدوات" : "Show controls"}
        >
          <Eye className="h-6 w-6" />
        </button>
      )}

      {!quietMode && (
        <header ref={toolsHeaderRef} className="quran-reader-header sticky top-0 z-40 w-full shrink-0 border-b border-emerald-900/10 bg-[#fbfaf6]/95 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-[#0a0c0b]/95">
          {/* Desktop Toolbar */}
          <div className="mx-auto hidden w-full max-w-[1400px] flex-row items-center justify-between gap-4 px-4 py-2 lg:flex">
            {/* Left: System & Location */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {backButtonDesktop}
                {syncButton}
              </div>

              <div className="flex h-9 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                {surahSelect}
                <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                {juzSelect}
                <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                {pageSelect}
              </div>
            </div>

            {/* Right: Tools & Actions */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                {layoutSelectDesktop}
                <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                {zoomControlsDesktop}
              </div>

              <div className="flex items-center gap-0.5">
                {installButton}
                {searchDialogWrapped}
                {copyDropdown}
                {bookmarkDropdown}
                {quietModeButton}
              </div>

              <div className="h-5 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />

              <div className="flex items-center gap-2">
                {audioButtonDesktop}
                {recordPracticeButton}
                {memoButton}
                {liveRecitationButton}
              </div>
            </div>
          </div>

          {/* Mobile Toolbar */}
          <div className="flex w-full flex-col px-2 py-2 lg:hidden">
            <div className="flex w-full items-center justify-between gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {exitEmbeddedButton || backButtonMobile}
                <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                  {mobileSurahSelect}
                  <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                  {mobilePageSelect}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {audioButtonMobile}
                {layoutToggleButtonMobile}
                {searchDialogWrapped}
                {memoButtonMobile}
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen((open) => !open)}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors",
                    mobileToolsOpen
                      ? "bg-emerald-900/10 text-emerald-950 dark:bg-white/10 dark:text-emerald-100"
                      : "text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
                  )}
                  aria-expanded={mobileToolsOpen}
                  aria-label={lang === "ar" ? "المزيد من أدوات المصحف" : "More Mushaf tools"}
                >
                  {mobileToolsOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Mobile Expanded Area */}
            {mobileToolsOpen && (
              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-emerald-900/10 bg-white/50 p-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#0a0c0b]/50">
                <p className="px-1 text-[10px] font-extrabold text-emerald-800/60 dark:text-emerald-200/60">
                  {lang === "ar" ? "طريقة العرض" : "Reading view"}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex h-9 w-32 shrink-0 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                    {juzSelect}
                  </div>
                  <div className="flex h-9 min-w-[120px] flex-1 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                    {layoutSelectDesktop}
                  </div>
                </div>

                <p className="border-t border-emerald-900/10 px-1 pt-2 text-[10px] font-extrabold text-emerald-800/60 dark:border-white/10 dark:text-emerald-200/60">
                  {lang === "ar" ? "أدوات القراءة" : "Reading tools"}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {installButton}
                    {copyDropdown}
                    {bookmarkDropdown}
                    {quietModeButton}
                    {syncButton}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="button-mobile-open-bookmarks"
                      onClick={() => {
                        if (onOpenBookmarks) {
                          setMobileToolsOpen(false);
                          setBookmarkActionsOpen(false);
                          onOpenBookmarks();
                          return;
                        }
                        setCopyActionsOpen(false);
                        setBookmarkActionsOpen(true);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-900/5 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
                    >
                      <Bookmark className="h-4 w-4" />
                      <span>{lang === "ar" ? "العلامات" : "Bookmarks"}</span>
                    </button>
                    {recordPracticeButton}
                    {liveRecitationButton}
                  </div>
                </div>
              </div>
            )}
          </div>

          {startAyah !== null && endAyah !== null && (
            <div className="border-y border-emerald-200/50 bg-emerald-50 px-2 py-1 text-center text-[11px] font-bold text-emerald-900 shadow-inner dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-100 md:px-4 md:py-2 md:text-sm">
              {lang === "ar"
                ? `مهمة ${mode === "memorization" ? "حفظ" : "مراجعة"}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === "memorization" ? "Memorization" : "Review"} task: ayahs ${startAyah}–${endAyah}`}
            </div>
          )}
        </header>
      )}

      <main
        ref={readerMainRef}
        style={{
          "--quran-dock-height": `${bottomDockHeight}px`,
        } as React.CSSProperties}
        className={cn(
          "quran-reader-main relative flex min-h-0 flex-1 flex-col items-start overflow-auto bg-[#fdfaf6] px-1.5 py-2 dark:bg-[#0a0c0b] md:bg-transparent md:px-8 md:py-8 md:dark:bg-transparent",
          (guidedOpen || pageLayout !== "continuous") && "touch-pan-y",
          guidedOpen && "quran-reader-main--guided overscroll-contain",
        )}
        onScroll={(event) => {
          if (pageLayout !== "continuous") return;
          if (continuousProgrammaticNavigationRef.current) return;
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
            const nearestVerse = verses.find((verse) => verse.page_id === nearestPage.page);
            if (nearestVerse) {
              onNavigate({
                surah: nearestVerse.chapter_id,
                ayah: nearestVerse.number,
                page: nearestPage.page,
              });
            }
            if (
              isPlaying
              && playbackPage !== null
              && !playbackAutoNavigationRef.current
            ) {
              setPlaybackFollowSuspended(nearestPage.page !== playbackPage);
            }
          }
        }}
        onKeyDown={(event) => {
          if (
            event.target instanceof HTMLInputElement
            || event.target instanceof HTMLSelectElement
            || event.target instanceof HTMLTextAreaElement
          ) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            goToSpread("next");
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            goToSpread("previous");
          }
        }}
        tabIndex={0}
      >
        {!quietMode && toolsHeaderHeight > 0 && (
          <div
            aria-hidden="true"
            className="quran-reader-top-reserve hidden w-full shrink-0 max-md:block"
            style={{
              height: `calc(${toolsHeaderHeight}px + var(--quran-safe-area-top, env(safe-area-inset-top, 0px)) + 0.85rem)`,
            }}
          />
        )}
        {swipeOffset !== 0 && pageLayout !== "continuous" && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 z-50 flex -translate-y-1/2 items-center gap-1 rounded-full border border-emerald-900/10 bg-[#fffdf8]/92 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#101411]/92 dark:text-emerald-200",
              swipeOffset > 0 ? "left-2" : "right-2",
            )}
            style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 34) }}
          >
            {swipeOffset > 0 ? (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{lang === "ar" ? "الصفحة التالية" : "Next page"}</span>
              </>
            ) : (
              <>
                <span>{lang === "ar" ? "الصفحة السابقة" : "Previous page"}</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </>
            )}
          </div>
        )}
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
            onAnimationEnd={(event) => {
              if (event.currentTarget !== event.target) return;
              if (
                event.animationName === "quran-page-turn-next"
                || event.animationName === "quran-page-turn-previous"
              ) {
                setTurnDirection(null);
              }
            }}
            className={cn(
              "quran-page-shell quran-page-shell--paged mx-auto grid grid-cols-1 items-start gap-1 transition-[width,max-width] duration-200 md:gap-3",
              pageLayout === "spread" && "lg:grid-cols-2 lg:gap-3",
              turnDirection === "next"
                ? "quran-page-turn-next"
                : turnDirection === "previous"
                  ? "quran-page-turn-previous"
                  : undefined,
            )}
            style={{
              width: `${zoom}%`,
              maxWidth: pageLayout === "spread"
                ? `${Math.round(10.32 * zoom)}px`
                : `${Math.round(7.2 * zoom)}px`,
              transform: swipeOffset === 0
                ? undefined
                : `perspective(1400px) translate3d(${swipeOffset}px, 0, 0) rotateY(${swipeOffset * -0.035}deg) scale(0.994)`,
              transformOrigin: swipeOffset > 0 ? "right center" : "left center",
              transition: swipeOffset === 0
                ? undefined
                : "none",
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
            pageLayout === "continuous" && "md:hidden",
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
        {pageLayout === "continuous" && (
          <p className="mx-auto mt-4 hidden rounded-full bg-emerald-900/5 px-4 py-2 text-xs font-bold text-emerald-800/70 dark:bg-white/5 dark:text-emerald-200/70 md:block">
            {lang === "ar"
              ? "مرّر لمتابعة القراءة — يتحدّث رقم الصفحة والرابط تلقائيًا"
              : "Scroll to continue reading — the page number and link update automatically"}
          </p>
        )}
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
            className="quran-bottom-dock-scroll-reserve hidden w-full shrink-0 max-md:block"
            style={{
              height: `calc(${bottomDockHeight}px + var(--quran-safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 0.5rem)`,
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
                onAudibleAyahChange={(audibleSurah, ayahNum) => {
                  if (ayahNum === null) {
                    setPlayingWordPosition(null);
                    return;
                  }
                  const audibleKey = `${audibleSurah}:${ayahNum}`;
                  setAudibleVerseKey(audibleKey);
                  setSelectedVerseKey(audibleKey);
                  if (!educationHidden && !educationLocked) {
                     setEducationInitialTab("tafsir");
                    setEducationSelection({
                      verseKey: audibleKey,
                      wordId: null,
                      wordPosition: null,
                      wordText: null,
                    });
                  }
                  const audibleVerse = verses.find(
                    verse => verse.chapter_id === audibleSurah && verse.number === ayahNum,
                  );
                  if (
                    audibleVerse
                    && !isPageVisibleFromAnchor(activePage, audibleVerse.page_id)
                  ) {
                    goToPage(audibleVerse.page_id, "playback");
                  }
                }}
                preferenceStorage={standalone && !syncActive ? "local" : "server"}
                onPlaybackLocationChange={(nextSurah, nextAyah) => {
                  const nextVerseKey = `${nextSurah}:${nextAyah}`;
                  setPlayingVerseKey(nextVerseKey);
                  setIsPlaying(true);
                  const nextVerse = verses.find(
                    verse => verse.chapter_id === nextSurah && verse.number === nextAyah,
                  );
                  if (nextVerse) {
                    goToPage(nextVerse.page_id, "playback");
                  } else {
                    goToSurah(nextSurah, "playback");
                  }
                }}
                onSurahEnd={() => {
                  if (playingSurah < 114 && startAyah === null && endAyah === null && !memoSession?.isActive) {
                    const nextSurah = playingSurah + 1;
                    setPlayingVerseKey(`${nextSurah}:1`);
                    setIsPlaying(true);
                    goToSurah(nextSurah, "playback");
                  }
                }}
                onClose={() => {
                  setIsPlaying(false);
                  setAudioDockOpen(false);
                  setPlayingVerseKey(null);
                  setAudibleVerseKey(null);
                  setPlaybackFollowSuspended(false);
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
                initialTab={educationInitialTab}
                onClose={hideEducation}
                onHide={hideEducation}
                locked={educationLocked}
                onToggleLock={() => {
                  setEducationLocked((locked) => {
                    if (locked && audibleVerseKey) {
                      setEducationSelection({
                        verseKey: audibleVerseKey,
                        wordId: null,
                        wordPosition: null,
                        wordText: null,
                      });
                    }
                    return !locked;
                  });
                }}
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
        onTogglePlayback={() => {
          if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
          }
          if (guidedVerseKey && !playingVerseKey) {
            setPlayingVerseKey(guidedVerseKey);
          }
          setIsPlaying(true);
          window.requestAnimationFrame(() => {
            void audioRef.current?.play().catch(() => {
              setIsPlaying(false);
            });
          });
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

      <QuranAyahActionSurface
        open={ayahActionVerseKey !== null}
        onOpenChange={(open) => {
          if (!open) setAyahActionVerseKey(null);
        }}
        verseKey={ayahActionVerseKey ?? selectedVerseKey ?? `${selectedSurah}:${selectedAyah}`}
        anchorRect={ayahActionAnchor}
        isBookmarked={ayahActionVerseKey ? bookmarksMap.has(ayahActionVerseKey) : false}
        onPlay={() => {
          if (!ayahActionVerseKey) return;
          setSelectedVerseKey(ayahActionVerseKey);
          setEducationSelection(null);
          setAudioDockOpen(true);
          audioRef.current?.pause();
          setPlayingVerseKey(ayahActionVerseKey);
          setIsPlaying(true);
        }}
        onCopy={async () => {
          if (!ayahActionVerseKey) return;
          const [chapterId, verseNumber] = ayahActionVerseKey.split(":").map(Number);
          try {
            const content = await queryClient.fetchQuery({
              queryKey: getGetQuranSurahContentQueryKey(chapterId),
              queryFn: () => getQuranSurahContent(chapterId)
            });
            const ayah = content?.ayahs?.find((a: any) => a.index === verseNumber);
            if (!ayah) return;
            const ayahStrNumber = String(ayah.index).replace(
              /\d/g,
              (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)],
            );
            const copiedText = `${ayah.text} ﴿${ayahStrNumber}﴾`;
            await navigator.clipboard.writeText(copiedText);
            setCopiedVerseKey(ayahActionVerseKey);
            toast.success(lang === "ar" ? "تم نسخ الآية" : "Ayah copied");
            window.setTimeout(
              () => setCopiedVerseKey((current) => current === ayahActionVerseKey ? null : current),
              1800,
            );
          } catch (e) {
            toast.error(lang === "ar" ? "تعذر نسخ الآية" : "Could not copy ayah");
          }
        }}
        onMultiCopy={() => {
          if (!ayahActionVerseKey) return;
          const [chapterId, verseNumber] = ayahActionVerseKey.split(":").map(Number);
          setSelectedVerseKey(ayahActionVerseKey);
          setCopyRange({ surah: chapterId, startAyah: verseNumber, endAyah: verseNumber });
        }}
        onBookmark={() => {
          if (!ayahActionVerseKey) return;
          const [chapterId, verseNumber] = ayahActionVerseKey.split(":").map(Number);
          const pageId = verses.find(v => v.chapter_id === chapterId && v.number === verseNumber)?.page_id ?? activePage;
          setSelectedVerseKey(ayahActionVerseKey);
          toggleBookmark(chapterId, verseNumber, pageId, bookmarksMap.has(ayahActionVerseKey));
        }}
        onTafsir={() => {
          if (!ayahActionVerseKey) return;
          setEducationInitialTab("tafsir");
          setSelectedVerseKey(ayahActionVerseKey);
          setEducationSelection({
            verseKey: ayahActionVerseKey,
            wordId: null,
            wordPosition: null,
            wordText: null,
          });
          setEducationHidden(false);
          window.localStorage.removeItem(QURAN_EDUCATION_HIDDEN_KEY);
        }}
      />
      <QuranWordActionPopover
        open={wordAction !== null}
        wordText={wordAction?.wordText ?? ""}
        anchorRect={wordAction?.anchorRect ?? null}
        onOpenChange={(open) => {
          if (!open) setWordAction(null);
        }}
        onPronounce={() => {
          if (!wordAction) return;
          const [chapterId, verseNumber] = wordAction.verseKey.split(":").map(Number);
          playWord(chapterId, verseNumber, wordAction.wordPosition);
        }}
        onMeaning={() => {
          if (!wordAction) return;
          setEducationInitialTab("meaning");
          setEducationSelection({
            verseKey: wordAction.verseKey,
            wordId: wordAction.wordId,
            wordPosition: wordAction.wordPosition,
            wordText: wordAction.wordText,
          });
          setEducationHidden(false);
          window.localStorage.removeItem(QURAN_EDUCATION_HIDDEN_KEY);
        }}
        onTranslation={() => {
          if (!wordAction) return;
          setEducationInitialTab("translation");
          setEducationSelection({
            verseKey: wordAction.verseKey,
            wordId: wordAction.wordId,
            wordPosition: wordAction.wordPosition,
            wordText: wordAction.wordText,
          });
          setEducationHidden(false);
          window.localStorage.removeItem(QURAN_EDUCATION_HIDDEN_KEY);
        }}
      />
      {copyRange && (
        <aside
          className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[65] mx-auto max-w-md rounded-2xl border border-emerald-900/10 bg-[#fffdf8]/97 p-3 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl dark:border-white/10 dark:bg-[#101411]/97"
          dir={dir}
          aria-live="polite"
          data-testid="copy-range-guide"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
              <ListPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-emerald-950 dark:text-emerald-50">
                {lang === "ar" ? "تحديد عدة آيات" : "Select multiple ayahs"}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-800/70 dark:text-emerald-200/70">
                {lang === "ar"
                  ? `اضغط على الآية الأخيرة — المحدد الآن ${copyCount} ${copyCount === 1 ? "آية" : "آيات"}`
                  : `Tap the last ayah — ${copyCount} selected`}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={() => setCopyRange(null)}
              className="h-9 rounded-xl px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/10"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => void copySelection()}
              disabled={isFetchingSelectedSurah}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              {lang === "ar" ? `نسخ ${copyCount} ${copyCount === 1 ? "آية" : "آيات"}` : `Copy ${copyCount}`}
            </button>
          </div>
        </aside>
      )}
      {showReaderTips && !guidedOpen && (
        <QuranReaderTips
          lang={lang}
          suspended={ayahActionVerseKey !== null || wordAction !== null}
          onDismiss={dismissReaderTips}
          onStepChange={(step) => {
            if (step === 3 && window.innerWidth < 768) {
              setMobileToolsOpen(true);
            }
          }}
        />
      )}

      <QuranInstallExperience
        standalone={standalone}
        isPlaying={isPlaying}
        isDockOpen={audioDockOpen || guidedOpen || !educationHidden}
        manualOpen={installManualOpen}
        onManualOpenChange={setInstallManualOpen}
      />
    </div>
  );
}
