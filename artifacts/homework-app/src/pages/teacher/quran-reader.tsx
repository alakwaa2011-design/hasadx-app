import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  getJuzStart,
  getPageStart,
  getQuranLocation,
  groupAyahsByMushafPage,
  parseQuranXml,
  QuranSurahParsed,
} from '@/lib/quran-parser';
import { MADANI_MUSHAF_METADATA } from '@/data/quran/madani-mushaf-metadata';
import { Loader2, ChevronRight, ChevronLeft, ZoomIn, ZoomOut, EyeOff, Eye, BookOpen, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { QuranPagesView } from './quran-pages-view';
import { QuranSearchDialog } from './quran-search-dialog';
import type { QuranWard } from '@workspace/api-client-react';
import {
  useRecordMyQuranIndependentSession,
  useUpdateMyQuranIndependentPosition,
  useGetQuranJourney,
  useGetQuranSurahContent,
  getGetQuranSurahContentQueryKey,
  getGetQuranJourneyQueryKey,
  useGetQuranReaderState,
  getGetQuranReaderStateQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QuranStudentSubmissionPanel } from '../student/quran-student-submission';
import { QuranAudioPlayer } from '@/components/quran/quran-audio-player';
import {
  clampQuranAyah,
  quranNavigationKey,
  reduceQuranReaderPosition,
} from '@/lib/quran-reader-position';
import { useQuranReaderState } from '@/components/quran/use-quran-reader-state';
import { QuranBookmarkToggle } from '@/components/quran/quran-bookmark-toggle';
import { useQuranMemoSession } from '@/components/quran/use-quran-memo-session';
import { useQuranWordAudio } from '@/components/quran/use-quran-word-audio';

export default function QuranReader() {
  const { lang } = useI18n();
  const params = useParams<{ surahNumber?: string; wardId?: string }>();
  const [, setLocation] = useLocation();
  const isStudentWard = window.location.pathname.includes('/student/quran-wards/');
  const isStudentPractice = window.location.pathname.includes('/student/quran-practice/');
  const readerBasePath = isStudentPractice ? '/student/quran-practice' : '/teacher/quran-reader';
  const searchParams = new URLSearchParams(window.location.search);

  const queryStartAyah = searchParams.get('startAyah') ? parseInt(searchParams.get('startAyah')!, 10) : null;
  const queryEndAyah = searchParams.get('endAyah') ? parseInt(searchParams.get('endAyah')!, 10) : null;
  const queryMode = searchParams.get('mode');
  const requestedAyah = searchParams.get('ayah') ? parseInt(searchParams.get('ayah')!, 10) : null;
  const view = searchParams.get('view') || 'reader';
  const {
    data: independentJourney,
    isLoading: independentJourneyLoading,
    isError: independentJourneyError,
  } = useGetQuranJourney({
    query: { enabled: isStudentPractice, queryKey: getGetQuranJourneyQueryKey() },
  });

  const { data: readerState, isLoading: readerStateLoading } = useGetQuranReaderState({
    query: {
      enabled: !isStudentWard && !isStudentPractice,
      queryKey: getGetQuranReaderStateQueryKey(),
      staleTime: 60 * 1000,
    }
  });

  const [studentWard, setStudentWard] = useState<QuranWard | null>(null);
  const [studentWardLoading, setStudentWardLoading] = useState(isStudentWard);
  const [studentWardMissing, setStudentWardMissing] = useState(false);

  useEffect(() => {
    if (!isStudentWard) return;
    const wardId = Number(params.wardId);
    if (!Number.isInteger(wardId) || wardId < 1) {
      setStudentWardMissing(true);
      setStudentWardLoading(false);
      return;
    }
    fetch(`/api/quran/me/wards/${wardId}`, { credentials: 'include', cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) {
          setLocation('/student/login');
          return null;
        }
        if (!response.ok) {
          setStudentWardMissing(true);
          return null;
        }
        return response.json() as Promise<QuranWard>;
      })
      .then(ward => {
        if (ward) setStudentWard(ward);
      })
      .catch(() => setStudentWardMissing(true))
      .finally(() => setStudentWardLoading(false));
  }, [isStudentWard, params.wardId, setLocation]);

  if (studentWardLoading || (isStudentPractice && independentJourneyLoading) || (!isStudentWard && !isStudentPractice && readerStateLoading)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (isStudentPractice && independentJourneyError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#fcfaf8] px-6 text-center dark:bg-background">
        <BookOpen className="h-10 w-10 text-emerald-700" />
        <p className="font-bold text-foreground">
          {lang === 'ar' ? 'تعذر استعادة موضعك المحفوظ' : 'Could not restore your saved position'}
        </p>
        <button onClick={() => setLocation('/student/dashboard')} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">
          {lang === 'ar' ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard'}
        </button>
      </div>
    );
  }

  if (isStudentWard && (studentWardMissing || !studentWard)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#fcfaf8] px-6 text-center dark:bg-background">
        <BookOpen className="h-10 w-10 text-emerald-700" />
        <p className="font-bold text-foreground">
          {lang === 'ar' ? 'هذا الورد غير موجود أو لا يخص حسابك' : 'This Quran task was not found for your account'}
        </p>
        <button onClick={() => setLocation('/student/dashboard')} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">
          {lang === 'ar' ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard'}
        </button>
      </div>
    );
  }

  const independentPosition = independentJourney?.independentPractice.latestPosition;
  const isTeacherStandalone = !isStudentWard && !isStudentPractice;

  let surahNumber = 1;
  let computedRequestedAyah = requestedAyah;
  let computedPageNumber: number | undefined;

  if (studentWard?.surahNumber) {
    surahNumber = studentWard.surahNumber;
  } else if (isStudentPractice && !requestedAyah && independentPosition && independentPosition.textSurahNumber) {
    surahNumber = independentPosition.textSurahNumber;
    computedRequestedAyah = independentPosition.textAyah;
  } else if (isTeacherStandalone && !params.surahNumber && readerState?.position) {
    surahNumber = readerState.position.surahNumber;
    computedRequestedAyah = readerState.position.ayahNumber;
    computedPageNumber = readerState.position.pageNumber;
  } else {
    surahNumber = parseInt(params.surahNumber || '1', 10);
  }

  const startAyah = studentWard?.startAyah ?? queryStartAyah;
  const endAyah = studentWard?.endAyah ?? queryEndAyah;
  const mode = studentWard?.mode ?? queryMode;
  
  if (!isStudentWard && view === 'pages') {
    return (
      <QuranPagesView
        initialSurah={surahNumber}
        initialAyah={computedRequestedAyah ?? startAyah ?? 1}
        initialPage={computedPageNumber ?? (isStudentPractice ? (independentPosition?.pageNumber ?? undefined) : undefined)}
        onNavigate={(loc) => setLocation(`${readerBasePath}/${loc.surah}?ayah=${loc.ayah}&view=pages`)}
        isTaskAyah={(sId, aNum) => sId === surahNumber && startAyah !== null && endAyah !== null && aNum >= startAyah && aNum <= endAyah}
        startAyah={startAyah}
        endAyah={endAyah}
        mode={mode}
        readerBasePath={readerBasePath}
        backHref={isStudentPractice ? "/student/dashboard" : undefined}
        backLabel={isStudentPractice
          ? {
              ar: "العودة إلى لوحة الطالب",
              en: "Back to student dashboard",
            }
          : undefined}
        isIndependentPractice={isStudentPractice}
      />
    );
  }

  return <QuranTextReaderView
    surahNumber={surahNumber}
    startAyah={startAyah}
    endAyah={endAyah}
    mode={mode}
    requestedAyah={computedRequestedAyah}
    isStudentWard={isStudentWard}
    isStudentPractice={isStudentPractice}
    wardId={studentWard?.id}
    isIndependentPractice={isStudentPractice}
  />;
}

interface ReaderViewProps {
  surahNumber: number;
  startAyah: number | null;
  endAyah: number | null;
  mode: string | null;
  requestedAyah: number | null;
  isStudentWard: boolean;
  isStudentPractice: boolean;
  wardId?: number;
  embedded?: boolean;
  onNavigate?: (location: { surah: number; ayah: number; page?: number }) => void;
  onSwitchToPages?: (location: { surah: number; ayah: number; page?: number }) => void;
  isIndependentPractice?: boolean;
  mobileSectionNavigation?: ReactNode;
}

export function QuranTextReaderView({
  surahNumber,
  startAyah,
  endAyah,
  mode,
  requestedAyah,
  isStudentWard,
  isStudentPractice,
  wardId,
  embedded = false,
  onNavigate,
  onSwitchToPages,
  isIndependentPractice = false,
  mobileSectionNavigation,
}: ReaderViewProps) {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const savePosition = useUpdateMyQuranIndependentPosition();
  const recordSession = useRecordMyQuranIndependentSession();
  const { data: officialSurah } = useGetQuranSurahContent(surahNumber, {
    query: {
      queryKey: getGetQuranSurahContentQueryKey(surahNumber),
      staleTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  });
  const lastSavedPositionRef = useRef<string | null>(null);
  const officialSurahRef = useRef(officialSurah);

  const [surahs, setSurahs] = useState<QuranSurahParsed[] | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [isQuietMode, setIsQuietMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const toolsHeaderRef = useRef<HTMLElement | null>(null);

  // Audio and Memorization State
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // This is the authoritative selection while the reader is mounted. The
  // URL is only an initial/navigation hint; it must not overwrite a click.
  const navigationKey = quranNavigationKey(surahNumber, requestedAyah, startAyah);
  const [position, dispatchPosition] = useReducer(
    reduceQuranReaderPosition,
    {
      ayah: clampQuranAyah(requestedAyah ?? startAyah ?? 1),
      navigationKey,
    },
  );
  const selectedAyah = position.ayah;
  const [playingWord, setPlayingWord] = useState<number | null>(null);
  const { activeWordKey, loadingWordKey, playWord, stopWordAudio } = useQuranWordAudio();

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!toolsHeaderRef.current?.contains(event.target as Node)) {
        setMobileToolsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [mobileToolsOpen]);

  const { 
    memoSession, setMemoSession, 
    memoView, setMemoView, 
    isAyahConcealed, toggleReveal, resetReveal,
    startSession, endSession
  } = useQuranMemoSession(surahNumber, selectedAyah, startAyah, endAyah, mode);

  useEffect(() => {
    stopWordAudio();
  }, [surahNumber, stopWordAudio]);

  const { savePosition: saveMainPosition, toggleBookmark, bookmarksMap, isMutatingBookmark } = useQuranReaderState({
    enabled: !isStudentWard && !isIndependentPractice && mode === null,
  });

  useEffect(() => {
    let mounted = true;
    import('@/data/quran/tanzil-uthmani.xml?raw').then(m => {
      if (!mounted) return;
      const parsed = parseQuranXml(m.default);
      const official = officialSurahRef.current;
      if (official) {
        const localSurah = parsed[official.index - 1];
        parsed[official.index - 1] = {
          index: official.index,
          name: official.name,
          ayahs: official.ayahs.map(ayah => ({
            index: ayah.index,
            text: ayah.text,
            ...(localSurah?.ayahs[ayah.index - 1]?.bismillah
              ? { bismillah: localSurah.ayahs[ayah.index - 1].bismillah }
              : {}),
          })),
        };
      }
      setSurahs(parsed);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    officialSurahRef.current = officialSurah;
    if (!officialSurah) return;
    setSurahs(current => {
      if (!current) return current;
      const next = [...current];
      const localSurah = current[officialSurah.index - 1];
      next[officialSurah.index - 1] = {
        index: officialSurah.index,
        name: officialSurah.name,
        ayahs: officialSurah.ayahs.map(ayah => ({
          index: ayah.index,
          text: ayah.text,
          ...(localSurah?.ayahs[ayah.index - 1]?.bismillah
            ? { bismillah: localSurah.ayahs[ayah.index - 1].bismillah }
            : {}),
        })),
      };
      return next;
    });
  }, [officialSurah]);

  useEffect(() => {
    if (surahNumber && !startAyah) {
      localStorage.setItem('hasaad_last_surah', surahNumber.toString());
    }
  }, [surahNumber, startAyah]);

  // Reset audio & memo states on surah/mode change
  useEffect(() => {
    setPlayingAyah(null);
    setIsPlaying(false);
  }, [surahNumber, mode]);

  useEffect(() => {
    dispatchPosition({
      type: "navigation",
      key: navigationKey,
      ayah: requestedAyah ?? startAyah ?? 1,
    });
  }, [navigationKey, requestedAyah, startAyah]);

  useEffect(() => {
    const ayahToReveal = playingAyah ?? selectedAyah;
    if (surahs && ayahToReveal) {
      setTimeout(() => {
        const el = document.getElementById(`ayah-${ayahToReveal}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const isInView = rect.top >= 100 && rect.bottom <= window.innerHeight - 200;
          if (!isInView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
  }, [surahs, selectedAyah, surahNumber, playingAyah]);

  // Independent practice has its own text position. Keep this separate from
  // teacher-assigned progress and persist it whenever the selected ayah changes.
  useEffect(() => {
    if (!isIndependentPractice || !surahNumber) return;
    const positionKey = `${surahNumber}:${selectedAyah}`;
    if (lastSavedPositionRef.current === positionKey) return;
    lastSavedPositionRef.current = positionKey;
    savePosition.mutate({
      data: { textSurahNumber: surahNumber, textAyah: selectedAyah },
    });
  }, [isIndependentPractice, selectedAyah, savePosition, surahNumber]);

  useEffect(() => {
    if (isStudentWard || isIndependentPractice || mode !== null || !surahNumber) return;
    saveMainPosition(surahNumber, selectedAyah, getQuranLocation(surahNumber, selectedAyah).page);
  }, [surahNumber, selectedAyah, isStudentWard, isIndependentPractice, mode, saveMainPosition]);

  if (!surahs) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  const surahIndex = surahNumber - 1;
  const surah = surahs[surahIndex];
  
  if (!surah) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-destructive">
        {lang === 'ar' ? 'السورة غير موجودة' : 'Surah not found'}
      </div>
    );
  }

  const activeAyahURL = Math.min(Math.max(selectedAyah, 1), surah.ayahs.length);
  const activeLocation = getQuranLocation(surahNumber, activeAyahURL);

  const recordIndependentPractice = async () => {
    try {
      await recordSession.mutateAsync({ data: {} });
      await queryClient.invalidateQueries({ queryKey: getGetQuranJourneyQueryKey() });
      toast.success(lang === 'ar' ? 'تم تسجيل جلسة التدريب' : 'Practice session recorded');
    } catch {
      toast.error(lang === 'ar' ? 'تعذر تسجيل الجلسة' : 'Could not record the session');
    }
  };

  const navigateTo = ({ surah, ayah }: { surah: number; ayah: number }) => {
    if (isStudentWard) return;
    if (embedded && onNavigate) {
      onNavigate({ surah, ayah, page: getQuranLocation(surah, ayah).page });
      return;
    }
    const basePath = isStudentPractice ? '/student/quran-practice' : '/teacher/quran-reader';
    setLocation(`${basePath}/${surah}?ayah=${ayah}&view=reader`);
  };

  const isAyahPlayable = (index: number) => {
    if (!isStudentWard) return true;
    if (startAyah !== null && index < startAyah) return false;
    if (endAyah !== null && index > endAyah) return false;
    return true;
  };

  const handleAyahClick = (ayahIndex: number) => {
    if (!isAyahPlayable(ayahIndex)) return;
    dispatchPosition({ type: "click", ayah: ayahIndex });
    if (isAyahConcealed(surahNumber, ayahIndex, playingAyah)) {
      toggleReveal(surahNumber, ayahIndex);
    } else {
      setPlayingAyah(ayahIndex);
      setIsPlaying(true);
    }
  };

  const handleNextSurah = () => {
    if (surahNumber < 114) navigateTo({ surah: surahNumber + 1, ayah: 1 });
  };
  
  const handlePrevSurah = () => {
    if (surahNumber > 1) navigateTo({ surah: surahNumber - 1, ayah: 1 });
  };

  const isTaskAyah = (index: number) => {
    if (startAyah && endAyah) {
      return index >= startAyah && index <= endAyah;
    }
    return false;
  };

  const bismillah = surah.ayahs[0]?.bismillah;
  const textPageGroups = groupAyahsByMushafPage(surahNumber, surah.ayahs);

  const renderAyah = (ayah: QuranSurahParsed['ayahs'][number]) => {
    const concealed = isAyahConcealed(surahNumber, ayah.index, playingAyah);
    const isPlayingThis = playingAyah === ayah.index;
    const inTask = isTaskAyah(ayah.index);
    const playable = isAyahPlayable(ayah.index);
    
    const words = ayah.text.split(' ');

    return (
      <span
        key={ayah.index}
        id={`ayah-${ayah.index}`}
        role={playable ? "button" : undefined}
        tabIndex={playable ? 0 : undefined}
        onClick={() => handleAyahClick(ayah.index)}
        onKeyDown={(e) => {
          if (!playable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAyahClick(ayah.index);
          }
        }}
        className={cn(
          "inline transition-all duration-300 rounded-lg px-1 relative select-none md:select-auto leading-loose",
          playable ? "cursor-pointer" : "opacity-60 grayscale",
          inTask && !concealed ? "bg-amber-100/60 dark:bg-amber-900/30 text-amber-950 dark:text-amber-100" : "text-foreground",
          isPlayingThis && !playingWord ? "bg-emerald-100/80 dark:bg-emerald-900/50 ring-2 ring-emerald-500/50 shadow-sm" : "",
          concealed ? "blur-[5px] opacity-40 hover:blur-[3px] hover:opacity-60 bg-foreground/5" : ""
        )}
        title={!playable ? (lang === 'ar' ? 'خارج النطاق المخصص' : 'Outside assigned range') : concealed ? (lang === 'ar' ? 'انقر للكشف' : 'Tap to reveal') : (lang === 'ar' ? 'انقر للاستماع' : 'Tap to listen')}
        style={concealed ? { userSelect: 'none' } : {}}
      >
        <span className="mx-1">
          {words.map((word, wordIndex) => {
             const wordPosition = wordIndex + 1;
             const isPlayingWord = isPlayingThis && playingWord === wordPosition;
              const wordKey = `${surahNumber}:${ayah.index}:${wordPosition}`;
              const isPreviewingWord = activeWordKey === wordKey;
              const isLoadingWord = loadingWordKey === wordKey;
             return (
               <span 
                 key={wordIndex} 
                  role={playable && !concealed ? "button" : undefined}
                  tabIndex={playable && !concealed ? 0 : undefined}
                  aria-label={playable && !concealed
                    ? (lang === 'ar' ? `استمع إلى كلمة ${word}` : `Listen to ${word}`)
                    : undefined}
                  aria-busy={isLoadingWord || undefined}
                  data-testid={`button-quran-word-${surahNumber}-${ayah.index}-${wordPosition}`}
                  onClick={playable && !concealed ? (event) => {
                    event.stopPropagation();
                    playWord(surahNumber, ayah.index, wordPosition);
                  } : undefined}
                  onKeyDown={playable && !concealed ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      playWord(surahNumber, ayah.index, wordPosition);
                    }
                  } : undefined}
                 className={cn(
                    "inline-block rounded px-0.5 transition-colors duration-200",
                    playable && !concealed ? "cursor-pointer hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500" : "",
                    isPlayingWord ? "text-emerald-800 bg-emerald-200/90 dark:text-emerald-200 dark:bg-emerald-800/80 ring-1 ring-emerald-500/50" : "",
                    isPreviewingWord ? "bg-amber-200/90 text-amber-900 ring-1 ring-amber-500/60 dark:bg-amber-800/80 dark:text-amber-100" : "",
                    isLoadingWord ? "animate-pulse" : "",
                 )}
               >
                 {word}{' '}
               </span>
             );
          })}
        </span>
        <span className={cn(
          "inline-flex items-center justify-center relative w-[1.8em] h-[1.8em] rounded-full border border-current mx-[0.2em] font-sans align-middle",
          isPlayingThis ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-700/40 dark:text-emerald-400/40"
        )}>
          <span className="absolute inset-[2px] border border-dashed border-current rounded-full opacity-40"></span>
          <span className="absolute inset-0 flex items-center justify-center text-[0.45em] font-bold text-foreground/70">{ayah.index}</span>
        </span>
      </span>
    );
  };

  return (
    <div className={cn(
      "flex flex-col font-sans transition-colors duration-300",
      embedded ? "min-h-full" : "min-h-[100dvh]",
      isQuietMode ? "bg-[#fcfaf8] dark:bg-[#111]" : "bg-[#fcfaf8] dark:bg-background",
    )} dir={dir}>
      {/* Quiet Mode Exit Button */}
      {isQuietMode && (
        <button 
          onClick={() => setIsQuietMode(false)}
          className="fixed bottom-[180px] end-6 z-50 p-3 bg-emerald-700 text-white rounded-full shadow-lg hover:bg-emerald-800 transition-all opacity-30 hover:opacity-100"
          title={lang === 'ar' ? 'إنهاء وضع القراءة' : 'Exit quiet mode'}
        >
          <Eye className="w-6 h-6" />
        </button>
      )}

      {!isQuietMode && (
        <header ref={toolsHeaderRef} className="sticky top-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:px-4 md:py-3">
            {!embedded && (
              <button
                onClick={() => setLocation(isStudentWard || isStudentPractice ? '/student/dashboard' : '/teacher/quran-center?tab=mushaf')}
                className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"
              >
                <ChevronLeft className="w-5 h-5 rtl:hidden" />
                <ChevronRight className="w-5 h-5 ltr:hidden" />
                <span className="hidden md:inline">
                  {isStudentWard || isStudentPractice
                    ? (lang === 'ar' ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard')
                    : (lang === 'ar' ? 'العودة إلى حصاد القرآن' : 'Back to Hasaad Quran')}
                </span>
              </button>
            )}
            {!isStudentWard && (
              <div className={cn(
                "shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 md:flex",
                mobileToolsOpen ? "flex" : "hidden",
              )}>
                <span
                  aria-current="page"
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-emerald-800 shadow-sm dark:bg-card dark:text-emerald-200 md:text-sm"
                >
                  {lang === 'ar' ? 'نص القرآن' : 'Quran Text'}
                </span>
                {embedded ? (
                  <button
                    type="button"
                    onClick={() => onSwitchToPages?.({ surah: surahNumber, ayah: activeAyahURL, page: activeLocation.page })}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-background hover:text-foreground md:text-sm"
                  >
                    {lang === 'ar' ? 'مصحف المدينة' : 'Madani Mushaf'}
                  </button>
                ) : (
                  <a
                    href={`${isStudentPractice ? '/student/quran-practice' : '/teacher/quran-reader'}/${surahNumber}?ayah=${activeAyahURL}&view=pages`}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-background hover:text-foreground md:text-sm"
                  >
                    {lang === 'ar' ? 'مصحف المدينة' : 'Madani Mushaf'}
                  </a>
                )}
              </div>
            )}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 md:hidden">
              <span className="truncate text-sm font-black text-emerald-900 dark:text-emerald-100">
                {lang === 'ar' ? `سورة ${surah.name}` : `Surah ${surah.name}`}
              </span>
              <span className="shrink-0 text-xs font-bold text-muted-foreground">
                {lang === 'ar' ? `ص ${activeLocation.page}` : `p. ${activeLocation.page}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileToolsOpen(open => !open)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/70 bg-background text-foreground shadow-sm md:hidden"
              aria-expanded={mobileToolsOpen}
              aria-label={lang === 'ar' ? 'أدوات القراءة' : 'Reading tools'}
            >
              {mobileToolsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            
            <div className={cn(
              "order-3 w-full flex-wrap items-center justify-center gap-2 overflow-x-auto md:order-none md:flex md:w-auto md:flex-1 md:flex-nowrap",
              mobileToolsOpen ? "flex" : "hidden",
            )}>
              {mobileSectionNavigation && (
                <div className="w-full shrink-0 md:hidden">
                  {mobileSectionNavigation}
                </div>
              )}
              <select 
                value={surahNumber} 
                disabled={isStudentWard}
                onChange={e => navigateTo({ surah: Number(e.target.value), ayah: 1 })}
                aria-label={lang === 'ar' ? 'السورة' : 'Surah'}
                className="min-w-32 bg-muted/40 text-sm md:text-base font-black text-center text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg transition-colors"
              >
                {surahs.map(s => (
                  <option key={s.index} value={s.index}>
                    {s.index}. {lang === 'ar' ? s.name : `Surah ${s.name}`}
                  </option>
                ))}
              </select>
              <select
                value={activeAyahURL}
                disabled={isStudentWard}
                onChange={e => navigateTo({ surah: surahNumber, ayah: Number(e.target.value) })}
                aria-label={lang === 'ar' ? 'الآية' : 'Ayah'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {surah.ayahs.map(ayah => (
                  <option key={ayah.index} value={ayah.index}>
                    {lang === 'ar' ? `آية ${ayah.index}` : `Ayah ${ayah.index}`}
                  </option>
                ))}
              </select>
              <select
                value={activeLocation.juz}
                disabled={isStudentWard}
                onChange={e => navigateTo(getJuzStart(Number(e.target.value)))}
                aria-label={lang === 'ar' ? 'الجزء' : 'Juz'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {Array.from({ length: MADANI_MUSHAF_METADATA.juzCount }, (_, index) => index + 1).map(juz => (
                  <option key={juz} value={juz}>
                    {lang === 'ar' ? `الجزء ${juz}` : `Juz ${juz}`}
                  </option>
                ))}
              </select>
              <select
                value={activeLocation.page}
                disabled={isStudentWard}
                onChange={e => navigateTo(getPageStart(Number(e.target.value)))}
                aria-label={lang === 'ar' ? 'صفحة المصحف' : 'Mushaf page'}
                className="bg-muted/40 text-sm font-bold text-foreground outline-none px-2 py-2 cursor-pointer hover:bg-muted rounded-lg"
              >
                {Array.from({ length: MADANI_MUSHAF_METADATA.pageCount }, (_, index) => index + 1).map(page => (
                  <option key={page} value={page}>
                    {lang === 'ar' ? `صفحة ${page}` : `Page ${page}`}
                  </option>
                ))}
              </select>

              {!isStudentWard && !isIndependentPractice && mode === null && (
                <div className="ms-1 border-s border-border/50 ps-1 sm:ms-2 sm:ps-2">
                  <QuranBookmarkToggle
                    surahNumber={surahNumber}
                    ayahNumber={selectedAyah}
                    pageNumber={activeLocation.page}
                    isBookmarked={bookmarksMap.has(`${surahNumber}:${selectedAyah}`)}
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
              {isIndependentPractice && (
                <button
                  type="button"
                  onClick={() => void recordIndependentPractice()}
                  disabled={recordSession.isPending}
                  className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {lang === 'ar' ? 'سجلت جلسة تدريب' : 'Record practice'}
                </button>
              )}
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 mr-2 rtl:ml-2">
                <button 
                  onClick={() => memoSession.isActive ? endSession() : startSession()}
                  className={cn("px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-colors", memoSession.isActive ? "bg-amber-100 text-amber-900 shadow-sm border border-amber-200" : "text-muted-foreground hover:text-foreground")}
                >
                  {memoSession.isActive ? (lang === 'ar' ? 'إنهاء الحفظ' : 'End Memo') : (lang === 'ar' ? 'جلسة حفظ' : 'Memo Session')}
                </button>
                <div className="w-px h-4 bg-border mx-1"></div>
                <button
                  onClick={() => setMemoView('show')}
                  className={cn("px-2 md:px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-colors", memoView === 'show' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {lang === 'ar' ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setMemoView('hide')}
                  className={cn("px-2 md:px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-colors", memoView === 'hide' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {lang === 'ar' ? 'إخفاء' : 'Hide'}
                </button>
                <button
                  onClick={() => setMemoView('progressive')}
                  className={cn("px-2 md:px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-colors", memoView === 'progressive' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {lang === 'ar' ? 'تتابعي' : 'Prog'}
                </button>
              </div>

              {!isStudentWard && (
                <QuranSearchDialog
                  onSelect={({ chapterId, ayah }) =>
                    navigateTo({ surah: chapterId, ayah })
                  }
                />
              )}
              <button onClick={() => setFontSize(f => Math.max(16, f - 2))} className="p-2 hover:bg-muted rounded-xl transition-colors"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => setFontSize(f => Math.min(60, f + 2))} className="p-2 hover:bg-muted rounded-xl transition-colors"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setIsQuietMode(true)} className="p-2 hover:bg-muted rounded-xl transition-colors hidden md:block"><EyeOff className="w-5 h-5" /></button>
            </div>
          </div>
          
          {startAyah && endAyah && (
            <div className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100 px-4 py-2 text-center text-sm font-bold shadow-inner border-y border-emerald-200/50 dark:border-emerald-800/50">
              {lang === 'ar' 
                ? `مهمة ${mode === 'memorization' ? 'حفظ' : 'مراجعة'}: الآيات ${startAyah} إلى ${endAyah}`
                : `${mode === 'memorization' ? 'Memorization' : 'Review'} Task: Ayahs ${startAyah} to ${endAyah}`}
            </div>
          )}
        </header>
      )}

      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 pb-48 w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-8 py-3 rounded-3xl border-2 border-emerald-800/10 bg-emerald-50/50 dark:border-emerald-500/10 dark:bg-emerald-950/20 shadow-sm">
            <h1 className="text-3xl md:text-5xl font-black text-emerald-900 dark:text-emerald-50" style={{ fontFamily: "'Traditional Arabic', 'Amiri', serif" }}>
              {lang === 'ar' ? `سورة ${surah.name}` : `Surah ${surah.name}`}
            </h1>
          </div>
        </div>

        <div className="space-y-7">
          {textPageGroups.map(({ page, ayahs }, pageIndex) => (
            <section
              key={page}
              aria-label={lang === 'ar' ? `صفحة ${page}` : `Page ${page}`}
              className="overflow-hidden rounded-[1.75rem] border border-emerald-900/10 bg-white px-4 py-6 shadow-[0_16px_45px_rgba(34,87,57,0.10)] dark:border-emerald-500/10 dark:bg-card md:px-10 md:py-9"
            >
              <div className="mb-6 flex items-center justify-center gap-3">
                <span className="h-px flex-1 bg-emerald-900/10 dark:bg-white/10" />
                <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {lang === 'ar' ? `صفحة ${page}` : `Page ${page}`}
                </span>
                <span className="h-px flex-1 bg-emerald-900/10 dark:bg-white/10" />
              </div>

              {pageIndex === 0 && bismillah && (
                <div className="mb-7 text-center">
                  <span
                    className="text-2xl font-bold text-foreground/90 md:text-4xl"
                    style={{
                      fontFamily: "'KFGQPC Uthman Taha Naskh', 'Amiri', 'Traditional Arabic', serif",
                      lineHeight: 2.2,
                    }}
                  >
                    {bismillah}
                  </span>
                </div>
              )}

              <div
                translate="no"
                className="text-center md:text-justify rtl"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 2.4,
                  fontFamily: "'KFGQPC Uthman Taha Naskh', 'Amiri', 'Traditional Arabic', 'Scheherazade New', serif",
                  direction: 'rtl',
                }}
              >
                {ayahs.map(renderAyah)}
              </div>
            </section>
          ))}
        </div>

        {!isQuietMode && !isStudentWard && (
          <div className="mt-20 flex flex-col sm:flex-row items-center justify-between border-t border-border/40 pt-8 gap-4">
            <button 
              onClick={handlePrevSurah}
              disabled={surahNumber === 1}
              className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5 rtl:hidden" />
              <ChevronRight className="w-5 h-5 ltr:hidden" />
              {lang === 'ar' ? 'السورة السابقة' : 'Previous Surah'}
            </button>
            <button 
              onClick={handleNextSurah}
              disabled={surahNumber === 114}
              className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {lang === 'ar' ? 'السورة التالية' : 'Next Surah'}
              <ChevronRight className="w-5 h-5 rtl:hidden" />
              <ChevronLeft className="w-5 h-5 ltr:hidden" />
            </button>
          </div>
        )}
      </main>

      {!isQuietMode && (
        <footer className="bg-muted/30 border-t border-border p-6 pb-12 text-center text-xs text-muted-foreground shrink-0">
          <p className="font-bold mb-1">{lang === 'ar' ? 'المصدر الأساسي للنص: Quran Foundation' : 'Primary text source: Quran Foundation'}</p>
          <p className="mb-2">
            {lang === 'ar' ? 'يُجلب النص العثماني الرسمي عبر' : 'Official Uthmani text is provided through'} <a href="https://quran.foundation" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">Quran Foundation</a>
          </p>
          <p className="opacity-70 mb-4">
            {lang === 'ar' ? 'تُستخدم النسخة المحلية الموثوقة تلقائيًا عند انقطاع الخدمة.' : 'A trusted local copy is used automatically during service outages.'}
          </p>
          <p className="font-bold mb-1">{lang === 'ar' ? 'المصدر الأساسي للتلاوات: Quran Foundation' : 'Primary audio source: Quran Foundation'}</p>
          <p className="opacity-70">
            {lang === 'ar' ? 'حقوق التلاوات محفوظة للقراء، وتُشغّل الروابط الموثوقة من Quran Foundation فقط.' : 'Recitation rights remain with their reciters, and only trusted Quran Foundation links are played.'}
          </p>
        </footer>
      )}

      <div className="mt-auto sticky bottom-0 z-40 w-full flex flex-col shrink-0">
        <QuranAudioPlayer
          surahs={surahs}
          surahNumber={surahNumber}
          startAyah={startAyah}
          endAyah={endAyah}
          selectedAyah={selectedAyah}
          playingAyah={playingAyah}
          onPlayingAyahChange={setPlayingAyah}
          isPlaying={isPlaying}
          onIsPlayingChange={setIsPlaying}
          memoSession={memoSession}
          onMemoSessionChange={setMemoSession}
          memoView={memoView}
          onMemoViewChange={setMemoView}
          onPlayingWordChange={setPlayingWord}
          onClose={() => {
            setIsPlaying(false);
            setPlayingAyah(null);
          }}
        />
        {isStudentWard && wardId && <QuranStudentSubmissionPanel wardId={wardId} />}
      </div>
    </div>
  );
}
