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
  Volume2,
  Loader2,
  Menu,
  Search,
  Mic2,
  Cloud,
  CloudOff,
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Info,
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
  getGetQuranWordTajweedQueryKey,
  useGetCurrentTeacher,
  useGetQuranSurahContent,
  useGetQuranWordTajweed,
  getQuranSurahContent,
  useRecordMyQuranIndependentSession,
  useUpdateMyQuranIndependentPosition,
  type QuranTajweedRule,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QuranMadaniPageRenderer } from "./quran-madani-page";
import { pageSwipeDirection, swipeAxis, type SwipeAxis } from "./quran-swipe-gesture";
import { QuranAudioPlayer } from "@/components/quran/quran-audio-player";
import { useQuranAudioHost } from "@/components/quran/quran-audio-host";
import {
  QuranGuidedMemorizationPanel,
  type GuidedMemorizationStage,
} from "@/components/quran/quran-guided-memorization-panel";
import { QuranEducationPanel } from "@/components/quran/quran-education-panel";
import { QuranAyahActionSurface } from "@/components/quran/quran-ayah-action-surface";
import { QuranMutashabihatPanel } from "@/components/quran/quran-mutashabihat-panel";
import { QuranWordActionPopover } from "@/components/quran/quran-word-action-popover";
import { QuranTajweedRuleCard } from "@/components/quran/quran-tajweed-rule-card";
import type { QuranSurahParsed } from "@/lib/quran-parser";
import { useQuranReaderState } from "@/components/quran/use-quran-reader-state";
import { useQuranMemoSession } from "@/components/quran/use-quran-memo-session";
import { useQuranWordAudio } from "@/components/quran/use-quran-word-audio";
import { QuranReaderTips } from "@/components/quran/quran-reader-tips";
import { getGuidedVerseScrollDelta } from "@/components/quran/quran-guided-visibility";
import { QURAN_READING_THEMES, useQuranReadingTheme, type QuranReadingThemeId } from "@/components/quran/use-quran-reading-theme";
import { useQuranTajweedMode } from "@/components/quran/use-quran-tajweed-mode";
import { useQuranPersonalPlan } from "@/components/quran/use-quran-personal-plan";
import { QURAN_PERSONAL_PLAN_KEY, personalQuranStorageKey, verseOrdinal, type QuranPracticeSession, type QuranVerseRef } from "@/components/quran/quran-personal-plan";
import { QuranPersonalPlanPanel } from "@/components/quran/quran-personal-plan-panel";

const QURAN_EDUCATION_HIDDEN_KEY = "quran-education-hidden";
const QURAN_READER_TIPS_KEY = "quran-reader-tips-seen-v1";

interface QComplexChapter {
  id: number;
  name: string;
  verse_count: number;
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

const TAJWEED_LEGEND_SEEN_KEY = "hasaad:quran-tajweed-legend-seen:v1";

/**
 * Rule colors extracted from the actual QCF v4 Tajweed font's default CPAL
 * palette, grouped by the standard Dar Al-Ma'arifah scheme this font is
 * based on. Exact per-letter rules still need the font's own (unpublished)
 * glyph-layer mapping, so this legend explains color *families*, not a 1:1
 * lookup table.
 */
const TAJWEED_LEGEND: {
  color: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
}[] = [
  {
    color: "#b50000",
    labelAr: "أحمر (بدرجاته)",
    labelEn: "Red (shades)",
    descAr: "أحكام المدّ بأنواعه: الطبيعي، الجائز، الواجب، واللازم — يختلف عدد الحركات حسب درجة اللون",
    descEn: "Madd (prolongation) rules: normal, permissible, obligatory, and necessary",
  },
  {
    color: "#09b000",
    labelAr: "أخضر",
    labelEn: "Green",
    descAr: "الغُنّة: الإخفاء، الإقلاب، والإدغام بغنة",
    descEn: "Ghunnah (nasalization): ikhfa, iqlab, and idgham with ghunnah",
  },
  {
    color: "#3f48e6",
    labelAr: "أزرق",
    labelEn: "Blue",
    descAr: "القلقلة، وتفخيم حرف الراء",
    descEn: "Qalqalah, and emphatic pronunciation of raa",
  },
  {
    color: "#ff7b00",
    labelAr: "برتقالي/ذهبي",
    labelEn: "Orange/gold",
    descAr: "الإدغام بلا غنة، وبعض حالات الإخفاء الإضافية",
    descEn: "Idgham without ghunnah, and additional ikhfa cases",
  },
  {
    color: "#a5a5a5",
    labelAr: "رمادي",
    labelEn: "Gray",
    descAr: "حروف لا تُنطق أثناء التلاوة (كالألف بعد واو الجماعة)",
    descEn: "Silent letters not pronounced during recitation",
  },
];

const FIRST_PAGE = 1;
const LAST_PAGE = 604;
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 70;
const MAX_ZOOM = 180;

function pageImageUrl(page: number) {
  return `${import.meta.env.BASE_URL}quran/mushaf-hafs-1441/${String(page).padStart(3, "0")}.webp`;
}

function normalizePageNumberDraft(value: string) {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\D/g, "")
    .slice(0, 3);
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
  isStudentReader = false,
  studentPersonalPlanKey = null,
  studentIdentityPending = false,
  personalPlanRedirectHref,
  openPersonalPlanOnLoad = false,
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
  isStudentReader?: boolean;
  studentPersonalPlanKey?: string | null;
  studentIdentityPending?: boolean;
  personalPlanRedirectHref?: string;
  openPersonalPlanOnLoad?: boolean;
  onStandaloneSyncChange?: (enabled: boolean) => void;
  isIndependentPractice?: boolean;
  liveRecitationAvailable: boolean;
  onExitEmbedded?: () => void;
  onOpenBookmarks?: () => void;
}) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { audioRef } = useQuranAudioHost();
  const isTeacherReader = !standalone && !isStudentReader && readerBasePath.startsWith("/teacher/");
  const {
    data: currentTeacher,
    isFetching: teacherIdentityLoading,
    isError: teacherIdentityError,
    isFetchedAfterMount: teacherIdentityConfirmed,
  } = useGetCurrentTeacher({
    query: {
      enabled: isTeacherReader,
      retry: false,
      queryKey: getGetCurrentTeacherQueryKey(),
      refetchOnMount: "always",
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
  const [pageNumberDraft, setPageNumberDraft] = useState(String(FIRST_PAGE));
  const pageNumberInputFocusedRef = useRef(false);
  const [pagePickerPlacement, setPagePickerPlacement] = useState<"desktop" | "mobile" | null>(null);
  const [pagePickerQuery, setPagePickerQuery] = useState("");
  const [quietMode, setQuietMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [pageLayoutMenuPlacement, setPageLayoutMenuPlacement] = useState<"desktop" | "mobile" | null>(null);
  const [memoChoiceOpen, setMemoChoiceOpen] = useState(false);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [audioFloatingPanelOpen, setAudioFloatingPanelOpen] = useState(false);
  const [guidedStage, setGuidedStage] = useState<GuidedMemorizationStage>(0);
  const [guidedLinkRunId, setGuidedLinkRunId] = useState(0);
  const [guidedVerseKey, setGuidedVerseKey] = useState<string | null>(null);
  const [guidedRecitationRevealed, setGuidedRecitationRevealed] = useState(false);
  const [personalPlanOpen, setPersonalPlanOpen] = useState(false);
  const personalPlanStorageKey = standalone
    ? QURAN_PERSONAL_PLAN_KEY
    : isTeacherReader && teacherIdentityConfirmed && !teacherIdentityError && !teacherIdentityLoading && currentTeacher?.id
      ? personalQuranStorageKey("teacher", currentTeacher.id)
      : isStudentReader ? studentPersonalPlanKey : null;
  const personalPlan = useQuranPersonalPlan(personalPlanStorageKey);
  const personalPlanCanPractice = personalPlan.enabled && !personalPlanRedirectHref;
  const personalPlanIdentityPending = isTeacherReader ? teacherIdentityLoading : isStudentReader && studentIdentityPending;
  const personalGuidedSessionRef = useRef(false);
  useEffect(() => {
    if (openPersonalPlanOnLoad && personalPlanCanPractice) setPersonalPlanOpen(true);
  }, [openPersonalPlanOnLoad, personalPlanCanPractice]);
  const [silentReadWordPosition, setSilentReadWordPosition] = useState<number | null>(null);
  const guidedPanelRef = useRef<HTMLElement | null>(null);
  const [guidedPanelHeight, setGuidedPanelHeight] = useState(0);
  const bottomDockRef = useRef<HTMLDivElement | null>(null);
  const [bottomDockHeight, setBottomDockHeight] = useState(0);
  const toolsHeaderRef = useRef<HTMLElement | null>(null);
  const quranReaderRootRef = useRef<HTMLDivElement | null>(null);
  const [toolsHeaderHeight, setToolsHeaderHeight] = useState(0);
  const [portraitPageHeight, setPortraitPageHeight] = useState<number | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pageLayout, setPageLayout] = useState<"spread" | "single" | "continuous">(
    typeof window !== "undefined" && window.innerWidth < 768 ? "single" : "spread",
  );
  const { themeId: readingThemeId, setThemeId: setReadingThemeId, cssVars: readingThemeVars } = useQuranReadingTheme();
  const { tajweedEnabled, setTajweedEnabled } = useQuranTajweedMode();
  const [tajweedLegendOpen, setTajweedLegendOpen] = useState(false);
  const preLandscapeLayoutRef = useRef<"spread" | "single" | "continuous" | null>(null);
  const [continuousStartPage, setContinuousStartPage] = useState(FIRST_PAGE);
  const [continuousEndPage, setContinuousEndPage] = useState(
    typeof window !== "undefined" && window.innerWidth < 768 ? Math.min(LAST_PAGE, FIRST_PAGE + 3) : FIRST_PAGE,
  );
  const continuousInitializedRef = useRef(false);
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set());
  const swipeGestureRef = useRef<{
    source: "touch" | "pen";
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    axis: SwipeAxis | null;
    shell: HTMLElement;
  } | null>(null);
  const swipeClickUntilRef = useRef(0);
  const swipeTurnLockedRef = useRef(false);
  const swipeNavigateTimerRef = useRef<number | null>(null);
  const swipeUnlockTimerRef = useRef<number | null>(null);
  const readerMainRef = useRef<HTMLElement | null>(null);
  const continuousProgrammaticNavigationRef = useRef(false);
  const continuousLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const playbackAutoNavigationRef = useRef(false);
  const playbackAutoNavigationTimeoutRef = useRef<number | null>(null);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);

  const {
    readerState,
    localStatePosition,
    savePosition: saveMainPosition,
    toggleBookmark,
    bookmarksMap,
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
  const [ayahActionVerseKey, setAyahActionVerseKey] = useState<string | null>(null);
  const [mutashabihatVerseKey, setMutashabihatVerseKey] = useState<string | null>(null);
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
  const [tajweedCard, setTajweedCard] = useState<{
    wordText: string;
    surahNumber: number;
    ayahNumber: number;
    wordPosition: number;
    rules: QuranTajweedRule[];
    sourceName: string;
  } | null>(null);
  const [wordActionSurahNumber, wordActionAyahNumber] = wordAction
    ? wordAction.verseKey.split(":").map(Number)
    : [0, 0];
  // Verified Tajweed rule lookup for the currently open word action popover.
  // Independent of the color font toggle (useQuranTajweedMode) by design: this
  // only reads structured rule data, never the glyph coloring itself, so the
  // action button's visibility never depends on whether colors are enabled.
  const wordTajweedQuery = useGetQuranWordTajweed(
    wordActionSurahNumber,
    wordActionAyahNumber,
    wordAction?.wordPosition ?? 0,
    {
      query: {
        queryKey: getGetQuranWordTajweedQueryKey(
          wordActionSurahNumber,
          wordActionAyahNumber,
          wordAction?.wordPosition ?? 0,
        ),
        enabled: wordAction !== null,
        staleTime: 24 * 60 * 60 * 1000,
        retry: 1,
      },
    },
  );
  const wordTajweedRules = wordAction && wordTajweedQuery.data ? wordTajweedQuery.data.rules : [];
  const [showReaderTips, setShowReaderTips] = useState(
    () => typeof window !== "undefined"
      && new URLSearchParams(window.location.search).get("install") !== "1"
      && window.localStorage.getItem(QURAN_READER_TIPS_KEY) !== "true",
  );
  const { playWord, stopWordAudio } = useQuranWordAudio();
  const [installManualOpen, setInstallManualOpen] = useState(
    () => standalone && new URLSearchParams(window.location.search).get("install") === "1",
  );
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
    if (!mobileToolsOpen && !memoChoiceOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      const element = target instanceof Element ? target : target.parentElement;
      if (mobileToolsOpen && !element?.closest("[data-reader-more], [data-reader-more-trigger]")) setMobileToolsOpen(false);
      if (memoChoiceOpen && !element?.closest("[data-reader-memo-choice], [data-reader-memo-trigger]")) setMemoChoiceOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileToolsOpen(false);
        setMemoChoiceOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileToolsOpen, memoChoiceOpen]);
  useEffect(() => {
    if (pageLayoutMenuPlacement === null) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      const element = target instanceof Element ? target : target.parentElement;
      if (!element?.closest("[data-page-layout-menu], [data-page-layout-trigger]")) {
        setPageLayoutMenuPlacement(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPageLayoutMenuPlacement(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pageLayoutMenuPlacement]);
  useEffect(() => {
    if (pagePickerPlacement === null) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      const element = target instanceof Element ? target : target.parentElement;
      if (!element?.closest("[data-page-picker-panel], [data-page-picker-trigger]")) {
        setPagePickerPlacement(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPagePickerPlacement(null);
        setPagePickerQuery("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pagePickerPlacement]);
  useEffect(() => {
    if (mobileToolsOpen) return;
    setTajweedLegendOpen(false);
  }, [mobileToolsOpen]);
  useEffect(() => {
    if (!mobileToolsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    settingsCloseRef.current?.focus();
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = document.getElementById("quran-reader-more-panel");
      const focusable = panel?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      settingsTriggerRef.current?.focus();
    };
  }, [mobileToolsOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const landscapeQuery = window.matchMedia("(orientation: landscape) and (max-height: 900px) and (any-pointer: coarse)");
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
      const reader = readerMainRef.current;
      const verseElement = Array.from(
        reader?.querySelectorAll<HTMLElement>("[data-verse-key]") ?? [],
      ).find((element) => element.dataset.verseKey === guidedVerseKey);
      if (!reader || !verseElement) return;

      const verseBounds = verseElement.getBoundingClientRect();
      const readerBounds = reader.getBoundingClientRect();
      const panelTop = guidedPanelRef.current?.getBoundingClientRect().top ?? null;
      const delta = getGuidedVerseScrollDelta(
        {
          top: verseBounds.top,
          bottom: verseBounds.bottom,
          height: verseBounds.height,
        },
        {
          top: readerBounds.top,
          bottom: readerBounds.bottom,
          height: readerBounds.height,
        },
        panelTop,
      );
      if (delta === null) return;
      reader.scrollBy({ top: delta, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [guidedOpen, guidedPanelHeight, guidedStage, guidedVerseKey, toolsHeaderHeight]);

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
    if (!pageNumberInputFocusedRef.current) {
      setPageNumberDraft(String(activePage));
    }
  }, [activePage]);

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
  const pagePickerPageNumbers = useMemo(() => {
    const query = normalizePageNumberDraft(pagePickerQuery);
    return Array.from({ length: LAST_PAGE }, (_, index) => index + FIRST_PAGE)
      .filter((page) => String(page).includes(query));
  }, [pagePickerQuery]);
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

  useEffect(() => {
    const reader = readerMainRef.current;
    if (!reader) {
      setPortraitPageHeight(null);
      return;
    }
    const updateHeight = () => {
      const topReserve = reader.querySelector<HTMLElement>(".quran-reader-top-reserve");
      const reserveHeight = topReserve && getComputedStyle(topReserve).display !== "none"
        ? topReserve.getBoundingClientRect().height
        : 0;
      const bottomPadding = Number.parseFloat(getComputedStyle(reader).paddingBottom) || 0;
      const naturalHeight = reader.clientWidth * 547.086 / 382.677;
      const availableHeight = reader.clientHeight - reserveHeight - bottomPadding - 8;
      setPortraitPageHeight(Math.ceil(Math.max(naturalHeight, availableHeight)));
    };
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(reader);
    return () => observer.disconnect();
  }, [loading, toolsHeaderHeight, quietMode]);

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

  const copyRangeStart = copyRange ? Math.min(copyRange.startAyah, copyRange.endAyah) : selectedAyah;
  const copyRangeEnd = copyRange ? Math.max(copyRange.startAyah, copyRange.endAyah) : selectedAyah;
  const copyCount = copyRangeEnd - copyRangeStart + 1;

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
    personalGuidedSessionRef.current = false;
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

  const previousPersonalOwnerRef = useRef(personalPlanStorageKey);
  useEffect(() => {
    if (previousPersonalOwnerRef.current === personalPlanStorageKey) return;
    // A routine refetch must not discard a memorization session. Keep it
    // inaccessible until the same account is confirmed again.
    if (personalPlanStorageKey === null && personalPlanIdentityPending) return;
    previousPersonalOwnerRef.current = personalPlanStorageKey;
    closeGuidedMemorization();
    setPersonalPlanOpen(false);
  }, [personalPlanStorageKey, personalPlanIdentityPending]);

  const guidedLinkStart = (verse: QuranVerseRef): QuranVerseRef => {
    const plan = personalPlanCanPractice ? personalPlan.plan : null;
    const currentOrdinal = verseOrdinal(verse);
    if (plan && currentOrdinal !== null) {
      const start = verseOrdinal(plan.start);
      const end = verseOrdinal(plan.end);
      if (start !== null && end !== null && currentOrdinal >= start && currentOrdinal <= end) {
        return plan.start;
      }
    }
    if (startAyah !== null && verse.surah === initialSurah && startAyah <= verse.ayah) {
      return { surah: verse.surah, ayah: startAyah };
    }
    return verse;
  };

  const showGuidedLinkStart = (start: QuranVerseRef) => {
    const target = verses.find((item) => item.chapter_id === start.surah && item.number === start.ayah);
    if (!target) return;
    setSelectedVerseKey(`${start.surah}:${start.ayah}`);
    if (target.page_id !== activePage) {
      setActivePage(target.page_id);
      if (pageLayout === "continuous") {
        continuousProgrammaticNavigationRef.current = true;
        setContinuousStartPage(target.page_id);
        setContinuousEndPage(Math.min(LAST_PAGE, target.page_id + 3));
        window.requestAnimationFrame(() => {
          if (readerMainRef.current) readerMainRef.current.scrollTop = 0;
          window.requestAnimationFrame(() => { continuousProgrammaticNavigationRef.current = false; });
        });
      }
    }
    if (personalPlanCanPractice) onNavigate({ surah: start.surah, ayah: start.ayah, page: target.page_id });
  };

  const setGuidedStageAndPlayback = (stage: GuidedMemorizationStage) => {
    if (personalPlanCanPractice && guidedVerseKey) {
      const [surah, ayah] = guidedVerseKey.split(":").map(Number);
      if (!personalPlan.saveSession({
        verse: { surah, ayah },
        stage,
        repeatCount: memoSession.repeatCount,
        recitationRevealed: false,
      })) {
        toast.error(lang === "ar" ? "تعذر حفظ خطوة الحفظ على هذا الجهاز" : "Could not save this memorization step");
        return;
      }
    }
    setGuidedStage(stage);
    setGuidedRecitationRevealed(false);
    setSilentReadWordPosition(null);
    if (stage === 0 && guidedVerseKey) {
      const [surah, ayah] = guidedVerseKey.split(":").map(Number);
      setMemoView("show");
      setMemoSession((session) => ({
        ...session,
        isActive: true,
        rangeStart: ayah,
        rangeEnd: ayah,
        rangeStartSurah: surah,
        rangeEndSurah: surah,
        repeatScope: "ayah",
      }));
      setPlayingVerseKey(guidedVerseKey);
      setIsPlaying(true);
      return;
    }
    if (stage === 2) randomizePartialHide();
    if (stage === 4 && guidedVerseKey) {
      const [surah, ayah] = guidedVerseKey.split(":").map(Number);
      const start = guidedLinkStart({ surah, ayah });
      setGuidedLinkRunId((runId) => runId + 1);
      setMemoView("show");
      setMemoSession((session) => ({
        ...session,
        isActive: true,
        repeatScope: "range",
        rangeStart: start.ayah,
        rangeEnd: ayah,
        rangeStartSurah: start.surah,
        rangeEndSurah: surah,
      }));
      showGuidedLinkStart(start);
      setPlayingVerseKey(`${start.surah}:${start.ayah}`);
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

  const beginPersonalGuidedVerse = (verse: QuranVerseRef, saved?: QuranPracticeSession) => {
    const targetVerse = verses.find((item) => item.chapter_id === verse.surah && item.number === verse.ayah);
    if (!targetVerse) {
      toast.error(lang === "ar" ? "لم تُحمّل الآية بعد، حاول مرة أخرى" : "Ayah is not ready yet");
      return;
    }
    const session: QuranPracticeSession = saved ?? {
      verse,
      stage: 0,
      repeatCount: 3,
      recitationRevealed: false,
    };
    if (personalPlanCanPractice && !personalPlan.saveSession(session)) {
      toast.error(lang === "ar" ? "تعذر حفظ الجلسة على هذا الجهاز" : "Could not save the session on this device");
      return;
    }
    const linkStart = session.stage === 4 ? guidedLinkStart(verse) : verse;
    if (session.stage === 4) setGuidedLinkRunId((runId) => runId + 1);
    const linkStartVerse = session.stage === 4
      ? verses.find((item) => item.chapter_id === linkStart.surah && item.number === linkStart.ayah)
      : null;
    personalGuidedSessionRef.current = personalPlanCanPractice;
    audioRef.current?.pause();
    setPersonalPlanOpen(false);
    setMobileToolsOpen(false);
    setSelectedVerseKey(`${linkStart.surah}:${linkStart.ayah}`);
    setGuidedVerseKey(`${verse.surah}:${verse.ayah}`);
    setGuidedStage(session.stage);
    setGuidedRecitationRevealed(session.recitationRevealed);
    setGuidedOpen(true);
    setEducationHidden(true);
    setEducationSelection(null);
    setEducationLocked(false);
    setMemoSession((current) => ({
      ...current,
      isActive: true,
      rangeStart: linkStart.ayah,
      rangeEnd: verse.ayah,
      rangeStartSurah: linkStart.surah,
      rangeEndSurah: verse.surah,
      repeatScope: session.stage === 4 ? "range" : "ayah",
      repeatCount: session.repeatCount,
    }));
    setMemoView(session.stage === 2 ? "progressive" : session.stage === 3 && !session.recitationRevealed ? "hide" : "show");
    if (session.stage === 2) randomizePartialHide();
    setIsPlaying(session.stage === 0);
    setPlayingVerseKey(session.stage === 0 || session.stage === 4 ? `${linkStart.surah}:${linkStart.ayah}` : null);
    setAudioDockOpen(true);
    const visibleVerse = linkStartVerse ?? targetVerse;
    if (visibleVerse.page_id !== activePage) {
      setActivePage(visibleVerse.page_id);
      if (pageLayout === "continuous") {
        continuousProgrammaticNavigationRef.current = true;
        setContinuousStartPage(visibleVerse.page_id);
        setContinuousEndPage(Math.min(LAST_PAGE, visibleVerse.page_id + 3));
        window.requestAnimationFrame(() => {
          if (readerMainRef.current) readerMainRef.current.scrollTop = 0;
          window.requestAnimationFrame(() => { continuousProgrammaticNavigationRef.current = false; });
        });
      }
    }
    if (personalPlanCanPractice) onNavigate({ surah: linkStart.surah, ayah: linkStart.ayah, page: visibleVerse.page_id });
  };

  const toggleMemoSession = () => {
    if (guidedOpen) {
      closeGuidedMemorization();
      return;
    }
    if (personalPlan.enabled) {
      setMobileToolsOpen(false);
      setMemoChoiceOpen((open) => !open);
      return;
    }
    startCurrentAyahGuided();
  };

  const startCurrentAyahGuided = () => {
    setMemoChoiceOpen(false);
    const targetVerse = selectedVerseKey
      ? verses.find((verse) => `${verse.chapter_id}:${verse.number}` === selectedVerseKey)
      : selectedVerse ?? verses.find((verse) => verse.page_id === activePage);
    if (!targetVerse) {
      endSession();
      return;
    }
    if (memoSession.isActive) endSession();
    beginPersonalGuidedVerse({ surah: targetVerse.chapter_id, ayah: targetVerse.number });
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

  const commitPageNumberDraft = (rawDraft: string) => {
    const normalized = normalizePageNumberDraft(rawDraft);
    const page = Number(normalized);
    if (normalized && Number.isInteger(page) && page >= FIRST_PAGE && page <= LAST_PAGE) {
      setPageNumberDraft(String(page));
      if (page !== activePage) goToPage(page);
      return;
    }
    setPageNumberDraft(String(activePage));
  };

  const changePageLayout = (nextLayout: "spread" | "single" | "continuous") => {
    setPageLayout(nextLayout);
    setPageLayoutMenuPlacement(null);
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
    const root = quranReaderRootRef.current;
    if (!root) return;

    const syncTooltips = (scope: ParentNode) => {
      const controls = [
        ...(scope instanceof HTMLButtonElement ? [scope] : []),
        ...scope.querySelectorAll<HTMLButtonElement>("button"),
      ];
      for (const control of controls) {
        const label = control.getAttribute("aria-label")?.trim()
          || control.textContent?.replace(/\s+/g, " ").trim();
        if (!label) continue;
        if (!control.title || control.dataset.quranAutoTooltip === "true") {
          control.title = label;
          control.dataset.quranAutoTooltip = "true";
        }
      }
    };

    syncTooltips(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLButtonElement) {
          syncTooltips(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) syncTooltips(node);
        }
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
    return () => observer.disconnect();
  }, [lang, loading]);

  useEffect(() => {
    const main = readerMainRef.current;
    if (!main) return;

    const restoreShell = (shell: HTMLElement) => {
      if (!shell.isConnected) return;
      shell.style.transition = "transform 170ms cubic-bezier(.22,.82,.28,1)";
      shell.style.removeProperty("--quran-swipe-x");
      window.setTimeout(() => {
        if (shell.isConnected) shell.style.removeProperty("transition");
      }, 180);
    };
    const cancelGesture = () => {
      const gesture = swipeGestureRef.current;
      swipeGestureRef.current = null;
      if (gesture) restoreShell(gesture.shell);
    };
    const startGesture = (source: "touch" | "pen", id: number, x: number, y: number, target: EventTarget | null) => {
      if (pageLayout === "continuous" || swipeNavigateTimerRef.current !== null || swipeGestureRef.current || !(target instanceof Element)) return;
      if (target.closest("input,select,textarea,[contenteditable='true']")) return;
      const shell = target.closest<HTMLElement>(".quran-page-shell--paged");
      if (!shell || !main.contains(shell)) return;
      if (swipeTurnLockedRef.current) {
        swipeTurnLockedRef.current = false;
        if (swipeUnlockTimerRef.current !== null) window.clearTimeout(swipeUnlockTimerRef.current);
        swipeUnlockTimerRef.current = null;
        setTurnDirection(null);
      }
      swipeClickUntilRef.current = 0;
      swipeGestureRef.current = {
        source, id, startX: x, startY: y, lastX: x, lastY: y,
        startTime: performance.now(), axis: null, shell,
      };
    };
    const moveGesture = (source: "touch" | "pen", id: number, x: number, y: number, event: Event) => {
      const gesture = swipeGestureRef.current;
      if (!gesture || gesture.source !== source || gesture.id !== id) return;
      gesture.lastX = x;
      gesture.lastY = y;
      const dx = x - gesture.startX;
      const dy = y - gesture.startY;
      if (!gesture.axis) gesture.axis = swipeAxis(dx, dy);
      if (gesture.axis !== "horizontal") return;
      if (event.cancelable) event.preventDefault();
      swipeClickUntilRef.current = performance.now() + 450;
      const direction = dx > 0 ? "next" : "previous";
      const atBoundary = direction === "next" ? !canGoToNextSpread : !canGoToPreviousSpread;
      const distance = Math.min(atBoundary ? 22 : 112, Math.abs(dx) * (atBoundary ? 0.2 : 0.72));
      gesture.shell.style.transition = "none";
      gesture.shell.style.setProperty("--quran-swipe-x", `${Math.sign(dx) * distance}px`);
    };
    const endGesture = (source: "touch" | "pen", id: number, x: number, y: number) => {
      const gesture = swipeGestureRef.current;
      if (!gesture || gesture.source !== source || gesture.id !== id) return;
      swipeGestureRef.current = null;
      const dx = x - gesture.startX;
      const dy = y - gesture.startY;
      const direction = pageSwipeDirection(dx, dy, performance.now() - gesture.startTime, gesture.axis);
      if (gesture.axis === "horizontal") swipeClickUntilRef.current = performance.now() + 450;
      if (!direction || (direction === "next" ? !canGoToNextSpread : !canGoToPreviousSpread)) {
        restoreShell(gesture.shell);
        return;
      }
      swipeTurnLockedRef.current = true;
      gesture.shell.style.transition = "transform 110ms ease-out, opacity 110ms ease-out";
      gesture.shell.style.setProperty("--quran-swipe-x", `${(direction === "next" ? 1 : -1) * Math.min(main.clientWidth * 0.36, 150)}px`);
      gesture.shell.style.opacity = "0.76";
      swipeNavigateTimerRef.current = window.setTimeout(() => {
        swipeNavigateTimerRef.current = null;
        goToSpread(direction);
        swipeUnlockTimerRef.current = window.setTimeout(() => {
          swipeTurnLockedRef.current = false;
          swipeUnlockTimerRef.current = null;
        }, 280);
      }, 105);
    };
    const findTouch = (event: TouchEvent) => {
      const gesture = swipeGestureRef.current;
      return gesture?.source === "touch"
        ? Array.from(event.changedTouches).find((touch) => touch.identifier === gesture.id)
        : null;
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelGesture();
        return;
      }
      const touch = event.changedTouches[0];
      if (touch) startGesture("touch", touch.identifier, touch.clientX, touch.clientY, event.target);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelGesture();
        return;
      }
      const touch = findTouch(event);
      if (touch) moveGesture("touch", touch.identifier, touch.clientX, touch.clientY, event);
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = findTouch(event);
      if (touch) endGesture("touch", touch.identifier, touch.clientX, touch.clientY);
    };
    const onTouchCancel = (event: TouchEvent) => {
      if (findTouch(event)) cancelGesture();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "pen" && event.isPrimary) {
        startGesture("pen", event.pointerId, event.clientX, event.clientY, event.target);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "pen") moveGesture("pen", event.pointerId, event.clientX, event.clientY, event);
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType === "pen") endGesture("pen", event.pointerId, event.clientX, event.clientY);
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (swipeGestureRef.current?.source === "pen" && swipeGestureRef.current.id === event.pointerId) cancelGesture();
    };
    const onSwipeClick = (event: MouseEvent) => {
      if (performance.now() > swipeClickUntilRef.current) return;
      swipeClickUntilRef.current = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchCancel);
    main.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("lostpointercapture", onPointerCancel);
    main.addEventListener("click", onSwipeClick, true);
    return () => {
      cancelGesture();
      main.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      main.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("lostpointercapture", onPointerCancel);
      main.removeEventListener("click", onSwipeClick, true);
    };
  }, [activePage, loading, pageLayout]);

  useEffect(() => () => {
    if (swipeNavigateTimerRef.current !== null) window.clearTimeout(swipeNavigateTimerRef.current);
    if (swipeUnlockTimerRef.current !== null) window.clearTimeout(swipeUnlockTimerRef.current);
  }, []);

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
        className="quran-reader-figure relative mx-auto w-full overflow-hidden bg-[color:var(--quran-chrome-bg,#fdfaf6)] transition-colors duration-300 md:rounded-[3px] md:shadow-[0_20px_60px_rgba(34,87,57,0.16)] md:ring-1 md:ring-black/10"
        onClick={(event) => {
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
            tajweedEnabled={tajweedEnabled}
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
      data-testid="button-sync-reading"
      className={cn(
        "quran-settings-row rounded-md px-1 transition-colors hover:bg-emerald-900/5 disabled:opacity-50 dark:hover:bg-white/5",
        syncEnabled
          ? "text-emerald-900 dark:text-emerald-100"
          : "text-emerald-800 dark:text-emerald-200",
      )}
      title={lang === "ar"
        ? "مزامنة آخر موضع والعلامات والتفضيلات"
        : "Sync your reading position, bookmarks, and preferences"}
    >
      <span className="inline-flex items-center gap-2">
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : syncEnabled ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        {lang === "ar" ? "مزامنة القراءة" : "Reading sync"}
      </span>
      <span className="text-[11px] font-medium opacity-65">{lang === "ar" ? (syncEnabled ? "مفعّلة" : "متوقفة") : (syncEnabled ? "On" : "Off")}</span>
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

  const pagePickerControl = (placement: "desktop" | "mobile") => {
    const isMobile = placement === "mobile";
    const pickerOpen = pagePickerPlacement === placement;
    const pickerId = `quran-page-picker-${placement}`;

    return (
      <div className="relative flex h-full shrink-0 items-center gap-0.5 px-0.5">
        <span aria-hidden="true" className={cn(
          "font-bold text-emerald-900/50 dark:text-emerald-100/50",
          isMobile ? "text-[9px]" : "text-[10px]",
        )}>
          {lang === "ar" ? "ص" : "p."}
        </span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={pageNumberDraft}
          onChange={(event) => setPageNumberDraft(normalizePageNumberDraft(event.target.value))}
          onFocus={() => { pageNumberInputFocusedRef.current = true; }}
          onBlur={(event) => {
            pageNumberInputFocusedRef.current = false;
            commitPageNumberDraft(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.currentTarget.value = String(activePage);
              setPageNumberDraft(String(activePage));
              event.currentTarget.blur();
            }
          }}
          dir="ltr"
          title={lang === "ar" ? `أدخل رقم الصفحة من ${FIRST_PAGE} إلى ${LAST_PAGE}` : `Enter a page from ${FIRST_PAGE} to ${LAST_PAGE}`}
          className={cn(
            "rounded-md border border-transparent bg-transparent px-0.5 text-center font-extrabold tabular-nums text-emerald-950 outline-none transition-colors hover:bg-emerald-900/5 focus:border-emerald-700/30 focus:bg-white/70 focus:ring-2 focus:ring-emerald-600/20 dark:text-emerald-100 dark:focus:bg-white/10",
            isMobile ? "h-9 w-8 text-[11px]" : "h-8 w-10 text-xs",
          )}
          aria-label={lang === "ar" ? `رقم الصفحة من ${FIRST_PAGE} إلى ${LAST_PAGE}` : `Page number from ${FIRST_PAGE} to ${LAST_PAGE}`}
          data-testid={isMobile ? "select-mobile-page" : "select-page"}
        />
        <button
          type="button"
          data-page-picker-trigger
          data-testid={`button-page-picker-trigger-${placement}`}
          aria-label={lang === "ar" ? "اختيار صفحة من القائمة" : "Choose a page from the list"}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-controls={pickerId}
          onClick={() => {
            setPagePickerQuery("");
            setPagePickerPlacement((current) => current === placement ? null : placement);
          }}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md text-emerald-900/55 transition-colors hover:bg-emerald-900/10 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-100/60 dark:hover:bg-white/10 dark:hover:text-emerald-100",
            isMobile ? "h-9 w-5" : "h-8 w-7",
            pickerOpen && "bg-emerald-900/10 dark:bg-white/10",
          )}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pickerOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {pickerOpen && (
          <div
            id={pickerId}
            data-page-picker-panel
            data-testid={`page-picker-panel-${placement}`}
            role="dialog"
            aria-label={lang === "ar" ? "قائمة صفحات المصحف" : "Mushaf page list"}
            className="absolute end-0 top-full z-[70] mt-1 w-[min(16rem,calc(100vw-1rem))] rounded-xl border border-emerald-900/10 bg-[#fbfaf6] p-2 shadow-xl dark:border-white/10 dark:bg-[#151b18]"
          >
            <label htmlFor={`${pickerId}-search`} className="sr-only">
              {lang === "ar" ? "ابحث برقم الصفحة" : "Search by page number"}
            </label>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-900/40 dark:text-emerald-100/40" aria-hidden="true" />
              <input
                id={`${pickerId}-search`}
                type="text"
                inputMode="numeric"
                maxLength={3}
                autoFocus
                value={pagePickerQuery}
                onChange={(event) => setPagePickerQuery(normalizePageNumberDraft(event.target.value))}
                placeholder={lang === "ar" ? "اكتب رقم الصفحة..." : "Type a page number..."}
                dir="ltr"
                data-testid={`input-page-picker-search-${placement}`}
                className="h-9 w-full rounded-lg border border-emerald-900/10 bg-white/70 ps-8 pe-3 text-sm font-semibold tabular-nums text-emerald-950 outline-none placeholder:text-emerald-900/35 focus:border-emerald-700/40 focus:ring-2 focus:ring-emerald-600/15 dark:border-white/10 dark:bg-white/5 dark:text-emerald-100 dark:placeholder:text-emerald-100/35"
              />
            </div>
            <div
              role="list"
              aria-label={lang === "ar" ? "أرقام الصفحات" : "Page numbers"}
              className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto overscroll-contain"
            >
              {pagePickerPageNumbers.length > 0 ? pagePickerPageNumbers.map((page) => {
                const isCurrentPage = page === activePage;
                return (
                  <div key={page} role="listitem">
                    <button
                      type="button"
                      aria-current={isCurrentPage ? "page" : undefined}
                      data-testid={`button-page-picker-page-${page}-${placement}`}
                      onClick={() => {
                        setPageNumberDraft(String(page));
                        goToPage(page);
                        setPagePickerPlacement(null);
                        setPagePickerQuery("");
                      }}
                      className={cn(
                        "h-8 w-full rounded-md text-sm font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                        isCurrentPage
                          ? "bg-emerald-700 text-white dark:bg-emerald-600"
                          : "text-emerald-900 hover:bg-emerald-900/8 dark:text-emerald-100 dark:hover:bg-white/10",
                      )}
                    >
                      {page}
                    </button>
                  </div>
                );
              }) : (
                <p className="col-span-4 py-5 text-center text-xs font-medium text-emerald-900/55 dark:text-emerald-100/55">
                  {lang === "ar" ? "لا توجد صفحات مطابقة" : "No matching pages"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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

  const layoutModeControl = (placement: "desktop" | "mobile") => {
    const options = [
      { value: "continuous", ar: "متصلة", en: "Continuous" },
      { value: "spread", ar: "صفحتان", en: "2 pages" },
      { value: "single", ar: "صفحة", en: "1 page" },
    ] as const;
    const selectedOption = options.find((option) => option.value === pageLayout)!;
    const menuOpen = pageLayoutMenuPlacement === placement;

    return (
      <div data-testid={`page-layout-control-${placement}`} className="relative min-w-0 flex-1">
        <button
          type="button"
          data-page-layout-trigger
          data-testid={`button-page-layout-trigger-${placement}`}
          aria-label={lang === "ar"
            ? `نمط عرض المصحف: ${selectedOption.ar}`
            : `Mushaf layout: ${selectedOption.en}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={`quran-page-layout-menu-${placement}`}
          onClick={() => setPageLayoutMenuPlacement((current) => current === placement ? null : placement)}
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-1 rounded-md px-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-100 dark:hover:bg-white/10 dark:focus-visible:ring-emerald-400",
            menuOpen && "bg-emerald-900/10 dark:bg-white/10",
          )}
        >
          <span>{lang === "ar" ? selectedOption.ar : selectedOption.en}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", menuOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {menuOpen && (
          <div
            id={`quran-page-layout-menu-${placement}`}
            data-page-layout-menu
            data-testid={`page-layout-menu-${placement}`}
            role="menu"
            aria-label={lang === "ar" ? "طريقة عرض المصحف" : "Mushaf page layout"}
            className="absolute end-0 top-full z-[80] mt-1 w-40 overflow-hidden rounded-xl border border-emerald-900/10 bg-[#fbfaf6] p-1.5 shadow-xl dark:border-white/10 dark:bg-[#151b18]"
          >
            {options.map((option) => {
              const selected = pageLayout === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  data-testid={`button-page-layout-${option.value}-${placement}`}
                  onClick={() => changePageLayout(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm font-bold transition-colors",
                    selected
                      ? "bg-emerald-700 text-white dark:bg-emerald-600"
                      : "text-emerald-900 hover:bg-emerald-900/5 dark:text-emerald-100 dark:hover:bg-white/10",
                  )}
                >
                  <span>{lang === "ar" ? option.ar : option.en}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const toggleTajweedColors = () => {
    const next = !tajweedEnabled;
    setTajweedEnabled(next);
    if (next) {
      try {
        if (window.localStorage.getItem(TAJWEED_LEGEND_SEEN_KEY) !== "true") {
          setTajweedLegendOpen(true);
          window.localStorage.setItem(TAJWEED_LEGEND_SEEN_KEY, "true");
        }
      } catch {}
    } else {
      setTajweedLegendOpen(false);
    }
  };

  const searchDialogWrapped = (
    <div className="quran-toolbar-search flex shrink-0 items-center" onPointerDown={() => setMobileToolsOpen(false)}>
      <QuranSearchDialog onSelect={({ pageId }) => goToPage(pageId)} />
    </div>
  );

  const installButton = standalone && isInstallable ? (
    <button
      type="button"
      onClick={() => { setMobileToolsOpen(false); setInstallManualOpen(true); }}
      data-testid="button-install-pwa"
      className="quran-settings-row rounded-md px-1 text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-200 dark:hover:bg-white/5"
      aria-label={lang === "ar" ? "تثبيت التطبيق" : "Install App"}
    >
      <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />{lang === "ar" ? "تثبيت التطبيق" : "Install app"}</span>
      <ChevronLeft className="h-4 w-4 opacity-50" aria-hidden="true" />
    </button>
  ) : null;

  const audioButtonMobile = (
    <button
      type="button"
      onClick={() => {
        if (audioDockOpen) {
          bottomDockRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        openAudioControls();
      }}
      data-testid="button-mobile-audio"
      className="quran-toolbar-action grid h-10 w-9 shrink-0 place-items-center rounded-lg text-emerald-900 transition-colors hover:bg-emerald-900/5 dark:text-emerald-100 dark:hover:bg-white/10 lg:hidden"
      aria-label={lang === "ar" ? "التلاوة" : "Recitation"}
      aria-pressed={audioDockOpen}
    >
      <Volume2 className="h-[18px] w-[18px]" />
    </button>
  );

  const audioButtonDesktop = (
    <button
      type="button"
      onClick={() => {
        if (audioDockOpen) {
          bottomDockRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        openAudioControls();
      }}
      data-testid="button-desktop-audio"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-900/5 dark:text-emerald-300 dark:hover:bg-white/10"
      aria-label={lang === "ar" ? "فتح مشغل التلاوة" : "Open recitation player"}
      aria-pressed={audioDockOpen}
    >
      <Volume2 className="h-4 w-4" />
      <span>{lang === "ar" ? "التلاوة" : "Recitation"}</span>
    </button>
  );

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
      aria-label={lang === "ar" ? "تسميع مباشر" : "Live recitation"}
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
      data-reader-memo-trigger
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
      data-reader-memo-trigger
      data-testid="button-mobile-memo-session"
      className={cn(
        "inline-flex h-10 max-w-full shrink-0 items-center justify-center truncate rounded-lg px-1.5 text-[11px] font-bold transition-colors lg:hidden",
        guidedOpen
          ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
          : "bg-emerald-900/5 text-emerald-800 hover:bg-emerald-900/10 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10"
      )}
    >
      {guidedOpen ? (lang === "ar" ? "إنهاء حفظني" : "End Memorize me") : (lang === "ar" ? "حفظني" : "Memorize me")}
    </button>
  );

  const moreButton = (mobile: boolean) => (
    <button type="button" ref={(node) => { if (node && typeof window !== "undefined" && (mobile === (window.innerWidth < 1024))) settingsTriggerRef.current = node; }} data-reader-more-trigger data-testid={mobile ? "button-mobile-more-tools" : "button-desktop-more-tools"}
      onClick={() => { setMemoChoiceOpen(false); setMobileToolsOpen((open) => !open); }}
      aria-label={lang === "ar" ? "إعدادات المصحف" : "Mushaf settings"}
      aria-haspopup="dialog" aria-controls="quran-reader-more-panel" aria-expanded={mobileToolsOpen}
      className={cn("quran-toolbar-action inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-emerald-900 transition-colors hover:bg-emerald-900/5 dark:text-emerald-100 dark:hover:bg-white/10", mobileToolsOpen && "bg-emerald-900/10 dark:bg-white/10")}>
      <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
      <span className="hidden text-xs font-bold xl:inline">{lang === "ar" ? "الإعدادات" : "Settings"}</span>
    </button>
  );

  return (
    <div
      ref={quranReaderRootRef}
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
      <span className="sr-only" aria-live="polite">
        {copiedVerseKey ? (lang === "ar" ? "تم نسخ الآية" : "Ayah copied") : ""}
      </span>
      {quietMode && (
        <button
          type="button"
          onClick={() => {
            setQuietMode(false);
            toast.info(lang === "ar" ? "عادت أدوات المصحف" : "Quran tools are visible");
          }}
          className="quran-reader-quiet-exit fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] end-4 z-50 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0b4b35] px-3 text-xs font-bold text-[#fcfbf5] shadow-md opacity-75 transition-opacity hover:opacity-100"
          aria-label={lang === "ar" ? "إظهار الأدوات" : "Show controls"}
        >
          <Eye className="h-4 w-4" /><span>{lang === "ar" ? "إظهار الأدوات" : "Show tools"}</span>
        </button>
      )}

      {!quietMode && (
        <header ref={toolsHeaderRef} className="quran-reader-header relative z-40 w-full shrink-0 border-b border-emerald-900/10 bg-[#fcfbf5]/95 shadow-[0_2px_10px_rgba(15,50,32,0.04)] backdrop-blur-md dark:border-white/10 dark:bg-[#15231a]/95">
          {/* Desktop Toolbar */}
          <div className="quran-reader-toolbar mx-auto hidden w-fit max-w-[1100px] flex-row items-center justify-center gap-8 px-4 py-2 lg:flex">
            <div className="flex min-w-0 items-center gap-3">
              {backButtonDesktop}
              <div className="flex h-9 items-center rounded-lg bg-emerald-900/5 p-1 dark:bg-white/5">
                {surahSelect}
                <div className="mx-1 h-4 w-px shrink-0 bg-emerald-900/10 dark:bg-white/10" />
                {pagePickerControl("desktop")}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {recordPracticeButton}
              {liveRecitationButton}
              {searchDialogWrapped}
              {audioButtonDesktop}
              {memoButton}
              {moreButton(false)}
            </div>
          </div>

          {/* Mobile Toolbar */}
          <div className="quran-reader-toolbar flex w-full items-center justify-between gap-2 px-1 py-1 lg:hidden">
            <div className="quran-toolbar-navigation flex min-w-0 items-center gap-0.5">
              {(exitEmbeddedButton || backButtonMobile) && (
                <div className="quran-toolbar-back shrink-0 overflow-hidden">{exitEmbeddedButton || backButtonMobile}</div>
              )}
              <div className="quran-toolbar-surah flex h-10 min-w-0 items-center rounded-lg border border-emerald-900/10 bg-emerald-900/[.025]">{mobileSurahSelect}</div>
              <div className="quran-toolbar-page flex h-10 shrink-0 items-center rounded-lg border border-emerald-900/10 bg-emerald-900/[.025]">{pagePickerControl("mobile")}</div>
            </div>
            <div className="quran-toolbar-actions flex shrink-0 items-center gap-0.5">
              {searchDialogWrapped}
              {audioButtonMobile}
              <div className="quran-toolbar-memo shrink-0">{memoButtonMobile}</div>
              {moreButton(true)}
            </div>
          </div>
          {memoChoiceOpen && personalPlan.enabled && !guidedOpen && (
            <div data-reader-memo-choice role="group" aria-label={lang === "ar" ? "بدء حفظني" : "Start memorization"}
              className="absolute end-2 top-full z-50 mt-1 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-emerald-900/10 bg-[#fbfaf6] p-2 shadow-xl dark:border-white/10 dark:bg-[#151b18] lg:end-14">
              <p className="px-2 py-1 text-xs font-bold text-emerald-900/65 dark:text-emerald-100/65">{lang === "ar" ? "كيف تود البدء؟" : "How would you like to begin?"}</p>
              <button type="button" data-testid="button-start-current-memo" onClick={startCurrentAyahGuided}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-start text-sm font-bold text-emerald-900 hover:bg-emerald-900/5 dark:text-emerald-100 dark:hover:bg-white/10">
                {lang === "ar" ? "حفظني من الآية الحالية" : "Memorize from current ayah"}
              </button>
              <button type="button" data-testid="button-open-personal-plan" onClick={() => {
                setMemoChoiceOpen(false);
                if (personalPlanRedirectHref) setLocation(personalPlanRedirectHref);
                else setPersonalPlanOpen(true);
              }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm font-bold text-emerald-900 hover:bg-emerald-900/5 dark:text-emerald-100 dark:hover:bg-white/10">
                <span>{lang === "ar" ? "خطتي" : "My plan"}</span>
                <span data-testid="count-personal-quran-due" className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{personalPlan.due.length}</span>
              </button>
            </div>
          )}

          {startAyah !== null && endAyah !== null && (
            <div className="border-y border-emerald-200/50 bg-emerald-50 px-2 py-1 text-center text-[11px] font-bold text-emerald-900 shadow-inner dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-100 md:px-4 md:py-2 md:text-sm">
              {lang === "ar"
                ? `مهمة ${mode === "memorization" ? "حفظ" : "مراجعة"}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === "memorization" ? "Memorization" : "Review"} task: ayahs ${startAyah}–${endAyah}`}
            </div>
          )}
        </header>
      )}

      {mobileToolsOpen && !quietMode && (
        <>
          <div className="quran-settings-backdrop" aria-hidden="true" onPointerDown={() => setMobileToolsOpen(false)} />
          <div data-reader-more id="quran-reader-more-panel" role="dialog" aria-modal="true"
            aria-labelledby="quran-settings-title" className="quran-settings-sheet">
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-emerald-900/20 md:hidden" aria-hidden="true" />
            <div className="flex shrink-0 items-center justify-between border-b border-emerald-900/10 px-5 py-2.5">
              <h2 id="quran-settings-title" className="text-base font-extrabold">{lang === "ar" ? "إعدادات المصحف" : "Mushaf settings"}</h2>
              <button type="button" ref={settingsCloseRef} onClick={() => setMobileToolsOpen(false)}
                data-testid="button-close-mushaf-settings" aria-label={lang === "ar" ? "إغلاق إعدادات المصحف" : "Close Mushaf settings"}
                className="grid h-10 w-10 place-items-center rounded-lg hover:bg-emerald-900/5">
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div className="quran-settings-body px-5">
              <section className="quran-settings-section py-4" aria-label={lang === "ar" ? "التنقل والعرض" : "Navigation and display"}>
                <span className="quran-settings-label">{lang === "ar" ? "التنقل والعرض" : "Navigation & display"}</span>
                <div className="flex items-center gap-2">
                  <div className="quran-settings-control flex h-10 min-w-0 flex-1 items-center">{juzSelect}</div>
                  <div className="quran-settings-control flex min-w-0 flex-1 items-center">{layoutModeControl("mobile")}</div>
                </div>
              </section>
              <section className="quran-settings-section py-4" aria-label={lang === "ar" ? "حجم المصحف" : "Mushaf size"}>
                <span className="quran-settings-label">{lang === "ar" ? "حجم المصحف" : "Mushaf size"}</span>
                <div className="quran-settings-control flex h-11 items-center justify-between px-1">
                  <button type="button" onClick={() => adjustZoom(-10)} disabled={zoom <= MIN_ZOOM}
                    data-testid="button-zoom-out" aria-label={lang === "ar" ? "تصغير" : "Zoom out"}
                    className="grid h-10 w-10 place-items-center rounded-md hover:bg-emerald-900/5 disabled:opacity-35"><ZoomOut className="h-4 w-4" /></button>
                  <span data-testid="text-quran-zoom" className="text-sm font-extrabold tabular-nums" dir="ltr">{zoom}%</span>
                  <button type="button" onClick={() => adjustZoom(10)} disabled={zoom >= MAX_ZOOM}
                    data-testid="button-zoom-in" aria-label={lang === "ar" ? "تكبير" : "Zoom in"}
                    className="grid h-10 w-10 place-items-center rounded-md hover:bg-emerald-900/5 disabled:opacity-35"><ZoomIn className="h-4 w-4" /></button>
                </div>
              </section>
              <section className="quran-settings-section py-4" aria-label={lang === "ar" ? "مظهر المصحف" : "Mushaf appearance"}>
                <span className="quran-settings-label">{lang === "ar" ? "مظهر المصحف" : "Mushaf appearance"}</span>
                <div role="radiogroup" aria-label={lang === "ar" ? "مظهر القراءة" : "Reading appearance"} className="grid grid-cols-3 gap-2">
                  {Object.values(QURAN_READING_THEMES).map((option) => (
                    <button key={option.id} type="button" role="radio" aria-checked={readingThemeId === option.id}
                      data-testid={`button-reading-theme-${option.id}`}
                      onClick={() => setReadingThemeId(option.id as QuranReadingThemeId)}
                      className="quran-theme-choice flex flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-bold">
                      <span aria-hidden="true" className="quran-theme-mini-page"
                        style={{ backgroundColor: option.pageBg, color: option.ink }}>
                        <span /><span /><span />
                      </span>
                      <span className="truncate">{lang === "ar" ? option.labelAr : option.labelEn}</span>
                    </button>
                  ))}
                </div>
                <button type="button" role="switch" aria-checked={tajweedEnabled} onClick={toggleTajweedColors}
                  data-testid="button-tajweed-toggle" className="quran-settings-row mt-3 border-t border-emerald-900/10">
                  <span>{lang === "ar" ? "ألوان التجويد" : "Tajweed colors"}</span>
                  <span aria-hidden="true" className={cn("flex h-6 w-11 items-center rounded-full p-0.5 transition-colors", tajweedEnabled ? "bg-[#0b4b35]" : "bg-[#bac7bf]")}>
                    <span className={cn("h-5 w-5 rounded-full bg-[#fcfbf5] shadow-sm transition-transform", tajweedEnabled && (dir === "rtl" ? "-translate-x-5" : "translate-x-5"))} />
                  </span>
                </button>
                {tajweedEnabled && (
                  <div className="border-t border-emerald-900/10">
                    <button type="button" onClick={() => setTajweedLegendOpen((open) => !open)}
                      data-testid="button-tajweed-legend" aria-expanded={tajweedLegendOpen}
                      className="quran-settings-row text-xs font-bold">
                      <span className="flex items-center gap-2"><Info className="h-4 w-4" />{lang === "ar" ? "دليل ألوان التجويد" : "Tajweed color guide"}</span>
                      <ChevronLeft className={cn("h-4 w-4 transition-transform", tajweedLegendOpen && "-rotate-90")} />
                    </button>
                    {tajweedLegendOpen && (
                      <div data-testid="panel-tajweed-legend" className="border-t border-emerald-900/10 py-2">
                        {TAJWEED_LEGEND.map((rule) => (
                          <div key={rule.color} className="flex items-start gap-2 py-1.5">
                            <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: rule.color }} />
                            <div><p className="text-xs font-bold">{lang === "ar" ? rule.labelAr : rule.labelEn}</p>
                              <p className="text-[11px] leading-relaxed opacity-70">{lang === "ar" ? rule.descAr : rule.descEn}</p></div>
                          </div>
                        ))}
                        <p className="border-t border-emerald-900/10 pt-2 text-[10px] leading-relaxed opacity-70">
                          {lang === "ar" ? "الألوان معتمدة على خط التجويد الرسمي، وقد تختلف درجة اللون قليلًا حسب إضاءة الصفحة المختارة." : "Colors come from the official Tajweed font and may vary slightly with page lighting."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className="quran-settings-section py-2" aria-label={lang === "ar" ? "أدوات العرض" : "Display tools"}>
                <span className="quran-settings-label mb-0 mt-2">{lang === "ar" ? "أدوات العرض" : "Display tools"}</span>
                <button type="button" onClick={() => {
                  setMobileToolsOpen(false);
                  setQuietMode(true);
                  toast.info(lang === "ar" ? "تم تشغيل وضع القراءة الهادئ — اضغط إظهار الأدوات للخروج" : "Quiet reading is on — use Show tools to exit");
                }} data-testid="button-quiet-mode" className="quran-settings-row">
                  <span className="flex items-center gap-2"><EyeOff className="h-4 w-4" />{lang === "ar" ? "القراءة الصافية" : "Clear reading"}</span>
                  <ChevronLeft className="h-4 w-4 opacity-50" />
                </button>
              </section>
              {onOpenBookmarks && (
                <section className="quran-settings-section py-2">
                  <button type="button" data-testid="button-mobile-open-bookmarks"
                    onClick={() => { setMobileToolsOpen(false); onOpenBookmarks(); }} className="quran-settings-row">
                    <span className="flex items-center gap-2"><Bookmark className="h-4 w-4" />{lang === "ar" ? "العلامات المحفوظة" : "Saved bookmarks"}</span>
                    <ChevronLeft className="h-4 w-4 opacity-50" />
                  </button>
                </section>
              )}
              {(installButton || syncButton) && (
                <section className="quran-settings-section py-2" aria-label={lang === "ar" ? "خيارات التطبيق" : "App options"}>
                  <span className="quran-settings-label mb-0 mt-2">{lang === "ar" ? "خيارات التطبيق" : "App options"}</span>
                  {installButton}
                  {syncButton}
                </section>
              )}
            </div>
          </div>
        </>
      )}

      {!quietMode && (recordPracticeButton || liveRecitationButton) && (
        <div className="quran-context-actions absolute end-3 z-30 flex items-center gap-2 lg:hidden"
          style={{ bottom: `calc(${bottomDockHeight}px + var(--quran-safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 12px)` }}>
          {recordPracticeButton}
          {liveRecitationButton}
        </div>
      )}

      <main
        ref={readerMainRef}
        style={{
          "--quran-dock-height": `${bottomDockHeight}px`,
          "--quran-page-height": portraitPageHeight === null ? "auto" : `${portraitPageHeight}px`,
          ...readingThemeVars,
        } as React.CSSProperties}
        className={cn(
          "quran-reader-main relative flex min-h-0 flex-1 flex-col items-start overflow-auto bg-[color:var(--quran-chrome-bg,#fdfaf6)] px-1.5 py-2 transition-colors duration-300 dark:bg-[#0a0c0b] md:bg-transparent md:px-8 md:py-8 md:dark:bg-transparent",
          (guidedOpen || pageLayout !== "continuous") && "touch-pan-y touch-pinch-zoom",
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
            }}
          >
            {pageLayout === "spread" ? (
              <>
                <div className="quran-spread-right-page hidden lg:block">{renderPage(visiblePages.right, "right")}</div>
                <div className="quran-spread-mobile-page h-full lg:hidden">{renderPage(activePage, "single")}</div>
                {visiblePages.left !== null && (
                  <div className="quran-spread-left-page hidden lg:block">{renderPage(visiblePages.left, "left")}</div>
                )}
              </>
            ) : (
              renderPage(activePage, "single")
            )}
          </div>
        )}

        {pageLayout !== "continuous" && (
          <div
            aria-hidden="true"
            className="quran-reader-floating-nav pointer-events-none sticky top-1/2 z-30 hidden h-0 w-full md:block"
          >
            <div
              className="mx-auto flex -translate-y-1/2 items-center justify-between transition-[width,max-width] duration-200"
              style={{
                width: `${zoom}%`,
                maxWidth: pageLayout === "spread"
                  ? `${Math.round(10.32 * zoom)}px`
                  : `${Math.round(7.2 * zoom)}px`,
              }}
            >
              <button
                type="button"
                onClick={() => goToSpread("previous")}
                disabled={!canGoToPreviousSpread}
                className="group pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-900/10 bg-white/90 text-emerald-800 shadow-lg backdrop-blur transition-all hover:scale-105 hover:border-emerald-400 hover:bg-white hover:text-emerald-900 disabled:pointer-events-none disabled:opacity-0 dark:border-white/10 dark:bg-[#141915]/90 dark:text-emerald-200 dark:hover:bg-[#141915]"
                aria-label={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
                title={lang === "ar" ? "الصفحة السابقة" : "Previous page"}
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>

              <button
                type="button"
                onClick={() => goToSpread("next")}
                disabled={!canGoToNextSpread}
                className="group pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-900/10 bg-white/90 text-emerald-800 shadow-lg backdrop-blur transition-all hover:scale-105 hover:border-emerald-400 hover:bg-white hover:text-emerald-900 disabled:pointer-events-none disabled:opacity-0 dark:border-white/10 dark:bg-[#141915]/90 dark:text-emerald-200 dark:hover:bg-[#141915]"
                aria-label={lang === "ar" ? "الصفحة التالية" : "Next page"}
                title={lang === "ar" ? "الصفحة التالية" : "Next page"}
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}

        <nav
          dir={dir}
          aria-label={lang === "ar" ? "التنقل بين صفحات المصحف" : "Mushaf page navigation"}
          className={cn(
            "quran-reader-nav mx-auto mt-1 hidden w-full max-w-[1032px] items-center justify-center gap-2 border-t border-emerald-900/10 px-1 pt-1 dark:border-white/10 md:mt-6 md:flex md:pt-5",
            pageLayout === "continuous" && "md:hidden",
          )}
          style={{ width: pageLayout === "spread" ? `${zoom}%` : "100%" }}
        >
          <span className="text-xs font-bold text-muted-foreground">
            {lang === "ar" ? `صفحة ${activePage} من ${LAST_PAGE}` : `Page ${activePage} of ${LAST_PAGE}`}
          </span>
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
          className={cn(
            "quran-reader-dock relative flex max-h-[44dvh] w-full shrink-0 flex-col overflow-visible rounded-t-[22px] bg-[#fbfaf6] shadow-[0_-10px_34px_rgba(34,87,57,0.12)] ring-1 ring-emerald-950/10 dark:bg-[#111512] md:max-h-[58dvh] md:rounded-none",
            audioFloatingPanelOpen ? "z-[80]" : "z-40",
          )}
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
                showTafsirRestore={educationHidden && !guidedOpen}
                onShowTafsir={showEducation}
                memoSession={memoSession}
                guidedLinkRunId={guidedLinkRunId}
                onMemoSessionChange={setMemoSession}
                guidedMemorizationActive={guidedOpen}
                onFloatingPanelOpenChange={setAudioFloatingPanelOpen}
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
        open={guidedOpen && (!personalGuidedSessionRef.current || personalPlanCanPractice)}
        dockHeight={bottomDockVisible ? bottomDockHeight : 0}
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
          if (personalPlanCanPractice && guidedVerseKey) {
            const [surah, ayah] = guidedVerseKey.split(":").map(Number);
            if (!personalPlan.saveSession({
              verse: { surah, ayah },
              stage: guidedStage,
              repeatCount,
              recitationRevealed: guidedRecitationRevealed,
            })) {
              toast.error(lang === "ar" ? "تعذر حفظ إعداد التكرار" : "Could not save repeat setting");
              return;
            }
          }
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
          if (personalPlanCanPractice && guidedVerseKey) {
            const [surah, ayah] = guidedVerseKey.split(":").map(Number);
            if (!personalPlan.saveSession({
              verse: { surah, ayah },
              stage: guidedStage,
              repeatCount: memoSession.repeatCount,
              recitationRevealed: true,
            })) {
              toast.error(lang === "ar" ? "تعذر حفظ خطوة الحفظ" : "Could not save memorization step");
              return;
            }
          }
          setGuidedRecitationRevealed(true);
          setMemoView("show");
        }}
        onAssess={(result) => {
          if (personalPlanCanPractice && guidedVerseKey) {
            const [surah, ayah] = guidedVerseKey.split(":").map(Number);
            if (!personalPlan.assess({ surah, ayah }, result)) {
              toast.error(lang === "ar" ? "تعذر حفظ نتيجة المراجعة" : "Could not save review result");
              return;
            }
            if (result === "mastered") {
              const currentOrdinal = verseOrdinal({ surah, ayah });
              const withinPlan = currentOrdinal !== null && personalPlan.plan
                && currentOrdinal >= verseOrdinal(personalPlan.plan.start)!
                && currentOrdinal <= verseOrdinal(personalPlan.plan.end)!;
              const reviewWasDue = personalPlan.due.some((item) => item.surah === surah && item.ayah === ayah);
              const nextDue = reviewWasDue
                ? personalPlan.due.find((item) => item.surah !== surah || item.ayah !== ayah)
                : null;
              if (nextDue) {
                beginPersonalGuidedVerse(nextDue);
                return;
              }
              if (reviewWasDue) {
                closeGuidedMemorization();
                setPersonalPlanOpen(true);
                toast.success(lang === "ar" ? "أتممت مراجعاتك المستحقة" : "Due reviews complete");
                return;
              }
              if (withinPlan) {
                const reachedGoal = personalPlan.completedTodayNow() >= personalPlan.plan!.dailyGoal;
                const next = personalPlan.nextNow();
                if (reachedGoal || !next || reviewWasDue) {
                  closeGuidedMemorization();
                  setPersonalPlanOpen(true);
                  toast.success(lang === "ar" ? "حُفظ تقييمك، راجع خطتك" : "Assessment saved. Check your plan");
                  return;
                }
                beginPersonalGuidedVerse(next);
                return;
              }
            }
            if (result === "mastered") {
              closeGuidedMemorization();
              setPersonalPlanOpen(true);
              toast.success(lang === "ar" ? "حُفظ تقييمك الشخصي" : "Personal assessment saved");
              return;
            }
          }
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
      {personalPlanCanPractice && (
        <QuranPersonalPlanPanel
          open={personalPlanOpen}
          onClose={() => setPersonalPlanOpen(false)}
          lang={lang}
          chapters={chapters}
          current={{ surah: selectedSurah, ayah: selectedAyah }}
          plan={personalPlan.plan}
          due={personalPlan.due}
          next={personalPlan.next}
          completedToday={personalPlan.completedToday}
          storageError={personalPlan.error}
          hasSession={personalPlan.session !== null}
          onSavePlan={personalPlan.savePlan}
          onStart={(verse) => beginPersonalGuidedVerse(verse)}
          onResume={() => {
            if (personalPlan.session) beginPersonalGuidedVerse(personalPlan.session.verse, personalPlan.session);
          }}
          onDeletePlan={() => {
            const saved = personalPlan.clearPlan();
            if (!saved) {
              toast.error(lang === "ar" ? "تعذر حذف الخطة على هذا الجهاز" : "Could not remove the plan");
            }
            return saved;
          }}
        />
      )}

      <QuranAyahActionSurface
        open={ayahActionVerseKey !== null}
        onOpenChange={(open) => {
          if (!open) setAyahActionVerseKey(null);
        }}
        verseKey={ayahActionVerseKey ?? selectedVerseKey ?? `${selectedSurah}:${selectedAyah}`}
        anchorRect={ayahActionAnchor}
        isBookmarked={ayahActionVerseKey ? bookmarksMap.has(ayahActionVerseKey) : false}
        bookmarkCategory={ayahActionVerseKey ? bookmarksMap.get(ayahActionVerseKey) : null}
        onSimilar={() => {
          if (ayahActionVerseKey) setMutashabihatVerseKey(ayahActionVerseKey);
        }}
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
        onBookmark={(category) => {
          if (!ayahActionVerseKey) return;
          const [chapterId, verseNumber] = ayahActionVerseKey.split(":").map(Number);
          const pageId = verses.find(v => v.chapter_id === chapterId && v.number === verseNumber)?.page_id ?? activePage;
          setSelectedVerseKey(ayahActionVerseKey);
          toggleBookmark(
            chapterId,
            verseNumber,
            pageId,
            bookmarksMap.has(ayahActionVerseKey),
            category,
          );
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
      {mutashabihatVerseKey && (
        <QuranMutashabihatPanel
          verseKey={mutashabihatVerseKey}
          onClose={() => setMutashabihatVerseKey(null)}
          onNavigate={({ verseKey, pageId }) => {
            const [surah, ayah] = verseKey.split(":").map(Number);
            setMutashabihatVerseKey(null);
            goToPage(pageId);
            setSelectedVerseKey(verseKey);
            onNavigate({ surah, ayah, page: pageId });
          }}
        />
      )}
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
        showTajweedAction={wordTajweedRules.length > 0}
        onTajweed={() => {
          if (!wordAction || !wordTajweedQuery.data || wordTajweedQuery.data.rules.length === 0) return;
          setTajweedCard({
            wordText: wordAction.wordText,
            surahNumber: wordActionSurahNumber,
            ayahNumber: wordActionAyahNumber,
            wordPosition: wordAction.wordPosition,
            rules: wordTajweedQuery.data.rules,
            sourceName: wordTajweedQuery.data.source.name,
          });
        }}
      />
      <QuranTajweedRuleCard
        open={tajweedCard !== null}
        wordText={tajweedCard?.wordText ?? ""}
        surahNumber={tajweedCard?.surahNumber ?? 0}
        ayahNumber={tajweedCard?.ayahNumber ?? 0}
        wordPosition={tajweedCard?.wordPosition ?? 0}
        rules={tajweedCard?.rules ?? []}
        sourceName={tajweedCard?.sourceName ?? ""}
        onClose={() => setTajweedCard(null)}
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
