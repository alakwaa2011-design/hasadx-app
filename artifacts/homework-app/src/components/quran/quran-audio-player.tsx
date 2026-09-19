import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Settings2, Loader2, Volume2, Repeat, Zap, RefreshCw, X, Search, BookOpen, Clock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { QuranSurahParsed } from '@/lib/quran-parser';
import { getNextAyahMemo, getPrevAyah, clampAyah, getActiveWordPosition, AyahTimingSegment } from '@/lib/quran-audio-logic';
import {
  getListQuranRecitersQueryKey,
  useListQuranReciters,
  useUpdateQuranAudioPreference,
  useGetQuranAyahTimings,
  getGetQuranAyahTimingsQueryKey,
  getGetQuranAyahTimingsQueryOptions,
  type GetQuranAyahTimingsQueryResult,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MemoSessionState } from './use-quran-memo-session';
import { useQuranAudioHost } from './quran-audio-host';

export interface QuranAudioPlayerProps {
  surahs: QuranSurahParsed[];
  surahNumber: number;
  startAyah: number | null;
  endAyah: number | null;
  selectedAyah: number;
  playingAyah: number | null;
  onPlayingAyahChange: (ayah: number | null) => void;
  isPlaying: boolean;
  onIsPlayingChange: (playing: boolean) => void;
  onClose?: () => void;
  onSurahEnd?: () => void;
  onPlaybackLocationChange?: (surahNumber: number, ayahNumber: number) => void;
  memoSession?: MemoSessionState;
  onMemoSessionChange?: (session: MemoSessionState) => void;
  guidedMemorizationActive?: boolean;
  memoView?: 'show' | 'hide' | 'progressive';
  onMemoViewChange?: (view: 'show' | 'hide' | 'progressive') => void;
  onPlayingWordChange?: (wordPosition: number | null) => void;
  preferenceStorage?: 'server' | 'local';
}

const SPEEDS = [0.75, 1, 1.25];
const REPEATS = [1, 3, 5, 10];
const MEMO_REPEAT_COUNTS: Array<number | 'continuous'> = [1, 3, 5, 10, 'continuous'];
const ARABIC_RECITATION_STYLES: Readonly<Record<string, string>> = {
  Muallim: 'المعلّم',
  'Kids repeat': 'المعلّم – ترديد الأطفال',
  Murattal: 'مرتّل',
  Mujawwad: 'مجوّد',
};

function recitationStyleLabel(style: string | null, isArabic: boolean): string | null {
  if (!style) return null;
  return isArabic ? ARABIC_RECITATION_STYLES[style] ?? style : style;
}

export function QuranAudioPlayer({
  surahs,
  surahNumber,
  startAyah,
  endAyah,
  selectedAyah,
  playingAyah,
  onPlayingAyahChange,
  isPlaying,
  onIsPlayingChange,
  onClose,
  onSurahEnd,
  onPlaybackLocationChange,
  memoSession,
  onMemoSessionChange,
  guidedMemorizationActive = false,
  memoView,
  onMemoViewChange,
  onPlayingWordChange,
  preferenceStorage = 'server',
}: QuranAudioPlayerProps) {
  const { lang } = useI18n();
  const isArabic = lang === 'ar';
  const queryClient = useQueryClient();
  const reciterCatalog = useListQuranReciters();
  const savePreference = useUpdateQuranAudioPreference();
  const [recitationId, setRecitationId] = useState<number | null>(null);
  const [reciterSearch, setReciterSearch] = useState('');
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(1);

  const [currentAyahPlayCount, setCurrentAyahPlayCount] = useState(1);
  const [currentRangePlayCount, setCurrentRangePlayCount] = useState(1);
  const lastInternalAyahRef = useRef<number | null>(null);
  const [isPausedBetween, setIsPausedBetween] = useState(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'none' | 'settings' | 'memo'>('none');
  const playerRef = useRef<HTMLDivElement>(null);

  const {
    audioRef,
    playback: hostPlayback,
    setPlayback,
    setSession,
    setControllerAttached,
    advanceBoundary,
  } = useQuranAudioHost();
  const preloadedAyahAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeSeekRef = useRef<{ ayah: number, startMs: number, endMs: number, url: string, segments: AyahTimingSegment[] } | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | undefined>();
  const currentAudioSrcRef = useRef<string | undefined>(undefined);
  const lastQueryKeyRef = useRef<string>('');
  const lastAudioSurahRef = useRef(surahNumber);
  const staleSurahSourceBlockedRef = useRef(false);
  const [playingWord, setPlayingWord] = useState<number | null>(null);

  const pendingNextActionRef = useRef<(() => void) | null>(null);
  const isEndedHandledRef = useRef(false);
  const seamlessTransitionKeyRef = useRef<string | null>(null);
  const pendingBoundaryTransitionRef = useRef<string | null>(null);
  const restartWhenTimingsReadyRef = useRef<string | null>(null);
  const surahEntryGuardRef = useRef<{ surah: number; ayah: number } | null>(null);
  const endedEventRef = useRef<() => void>(() => undefined);
  const loadedMetadataEventRef = useRef<() => void>(() => undefined);
  const timeUpdateEventRef = useRef<() => void>(() => undefined);

  const surahLength = surahs[surahNumber - 1]?.ayahs.length || 0;

  useEffect(() => {
    setControllerAttached(true);
    return () => setControllerAttached(false);
  }, [setControllerAttached]);

  const timingsQuery = useGetQuranAyahTimings(
    recitationId ?? 0,
    surahNumber,
    playingAyah ?? 0,
    {
      query: {
        enabled: !!playingAyah && !!recitationId && recitationId !== 1_000_159,
        retry: false,
        staleTime: Infinity,
        queryKey: getGetQuranAyahTimingsQueryKey(recitationId ?? 0, surahNumber, playingAyah ?? 0),
      }
    }
  );

  useEffect(() => {
    if (memoSession?.isActive && !guidedMemorizationActive) setActiveTab('memo');
    else if (activeTab === 'memo') setActiveTab('none');
  }, [activeTab, guidedMemorizationActive, memoSession?.isActive]);

  useEffect(() => {
    if (activeTab === 'none') return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!playerRef.current?.contains(event.target as Node)) {
        setActiveTab('none');
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [activeTab]);

  useEffect(() => {
    if (recitationId !== null || !reciterCatalog.data?.reciters.length) return;
    let locallyPreferred: number | null = null;
    if (preferenceStorage === 'local') {
      try {
        locallyPreferred = Number(window.localStorage.getItem('hasaad:standalone-quran-recitation-id'));
      } catch {
        locallyPreferred = null;
      }
    }
    setRecitationId(
      (locallyPreferred && reciterCatalog.data.reciters.some((item) => item.id === locallyPreferred)
        ? locallyPreferred
        : null)
      ?? (preferenceStorage === 'server' ? reciterCatalog.data.preferredRecitationId : null)
      ?? reciterCatalog.data.reciters[0].id,
    );
  }, [preferenceStorage, recitationId, reciterCatalog.data]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const clearPauseTimeout = () => {
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    pendingNextActionRef.current = null;
    setIsPausedBetween(false);
  };

  useEffect(() => {
    if (playingAyah !== null) {
      const clamped = clampAyah(playingAyah, startAyah, endAyah);
      if (clamped !== playingAyah) {
        onPlayingAyahChange(clamped);
        if (clamped === null) {
          onIsPlayingChange(false);
        }
      }
    }
  }, [playingAyah, startAyah, endAyah, onPlayingAyahChange, onIsPlayingChange]);

  useEffect(() => {
    if (!playingAyah || !recitationId) {
      setAudioSrc(undefined);
      currentAudioSrcRef.current = undefined;
      activeSeekRef.current = null;
      return;
    }

    const currentQueryKey = `${recitationId}-${surahNumber}-${playingAyah}`;
    if (lastQueryKeyRef.current !== currentQueryKey) {
       const isSeamlessTransition = seamlessTransitionKeyRef.current === currentQueryKey;
       const surahChanged = lastAudioSurahRef.current !== surahNumber;
       const hostOwnsSurahTransition = Boolean(
         surahChanged
         && hostPlayback.isPlaying
         && hostPlayback.surahNumber === surahNumber
         && hostPlayback.ayahNumber === playingAyah
         && audioRef.current?.src,
       );
       lastAudioSurahRef.current = surahNumber;
       seamlessTransitionKeyRef.current = null;
       if (!isSeamlessTransition) pendingBoundaryTransitionRef.current = null;
       restartWhenTimingsReadyRef.current = isSeamlessTransition || hostOwnsSurahTransition
         ? null
         : currentQueryKey;
       lastQueryKeyRef.current = currentQueryKey;
       if (hostOwnsSurahTransition && audioRef.current) {
         staleSurahSourceBlockedRef.current = false;
         currentAudioSrcRef.current = audioRef.current.src;
         setAudioSrc(audioRef.current.src);
       } else if (!isSeamlessTransition) {
         audioRef.current?.pause();
         if (surahChanged) {
           staleSurahSourceBlockedRef.current = true;
           currentAudioSrcRef.current = undefined;
           setAudioSrc(undefined);
         }
       }
       if (pauseTimeoutRef.current !== null) {
         clearTimeout(pauseTimeoutRef.current);
         pauseTimeoutRef.current = null;
       }
       pendingNextActionRef.current = null;
       setIsPausedBetween(false);
       if (!isSeamlessTransition) activeSeekRef.current = null;
       isEndedHandledRef.current = false;
       setPlayingWord(null);
       onPlayingWordChange?.(null);
    }

    if (timingsQuery.isLoading || timingsQuery.isFetching) {
       return;
    }

    if (timingsQuery.isError || !timingsQuery.data?.synchronized) {
       if (recitationId >= 1_000_000 && recitationId !== 1_000_159) {
        activeSeekRef.current = null;
        currentAudioSrcRef.current = undefined;
        setAudioSrc(undefined);
        setError(true);
        onIsPlayingChange(false);
        return;
      }
      const fallbackUrl = `/api/quran/audio/${recitationId}/${surahNumber}/${playingAyah}`;
      activeSeekRef.current = null;
      if (currentAudioSrcRef.current !== fallbackUrl) {
         staleSurahSourceBlockedRef.current = false;
         restartWhenTimingsReadyRef.current = null;
         currentAudioSrcRef.current = fallbackUrl;
         setAudioSrc(fallbackUrl);
      } else {
         if (audioRef.current) {
           audioRef.current.currentTime = 0;
           restartWhenTimingsReadyRef.current = null;
           if (isPlaying && !isPausedBetween) {
             audioRef.current.playbackRate = speed;
             void audioRef.current.play().catch(error => {
               if (error.name !== 'AbortError') {
                 setError(true);
                 onIsPlayingChange(false);
               }
             });
           }
         }
      }
    } else {
      const data = timingsQuery.data;
      const shouldRestartSameSource = restartWhenTimingsReadyRef.current === currentQueryKey;
      activeSeekRef.current = {
        ayah: playingAyah,
        startMs: data.verseStartMs,
        endMs: data.verseEndMs,
        url: data.audioUrl,
        segments: data.segments,
      };

      if (currentAudioSrcRef.current !== data.audioUrl) {
         staleSurahSourceBlockedRef.current = false;
         restartWhenTimingsReadyRef.current = null;
         currentAudioSrcRef.current = data.audioUrl;
         setAudioSrc(data.audioUrl);
       } else if (audioRef.current && shouldRestartSameSource) {
         restartWhenTimingsReadyRef.current = null;
         audioRef.current.currentTime = data.verseStartMs / 1000;
         if (isPlaying && !isPausedBetween) {
           audioRef.current.playbackRate = speed;
           void audioRef.current.play().catch(error => {
             if (error.name !== 'AbortError') {
               setError(true);
               onIsPlayingChange(false);
             }
           });
         }
      }
    }
  }, [
    hostPlayback.ayahNumber,
    hostPlayback.isPlaying,
    hostPlayback.surahNumber,
    isPausedBetween,
    isPlaying,
    onIsPlayingChange,
    onPlayingWordChange,
    playingAyah,
    recitationId,
    speed,
    surahNumber,
    timingsQuery.data,
    timingsQuery.isError,
    timingsQuery.isFetching,
    timingsQuery.isLoading,
  ]);

  const handleLoadedMetadata = () => {
    if (activeSeekRef.current && audioRef.current) {
      audioRef.current.currentTime = activeSeekRef.current.startMs / 1000;
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    if (activeSeekRef.current) {
      const activeUrl = new URL(activeSeekRef.current.url, window.location.href).href;
      if (audioRef.current.src !== activeUrl) return;
      const currentTimeMs = audioRef.current.currentTime * 1000;
      const { startMs, endMs, segments, ayah } = activeSeekRef.current;

      if (ayah !== playingAyah) return;
      const entryGuard = surahEntryGuardRef.current;
      if (
        entryGuard
        && entryGuard.surah === surahNumber
        && entryGuard.ayah === playingAyah
      ) {
        if (currentTimeMs >= startMs + 100 && currentTimeMs < endMs) {
          surahEntryGuardRef.current = null;
        } else if (currentTimeMs >= endMs) {
          audioRef.current.currentTime = startMs / 1000;
          return;
        }
      }

      if (currentTimeMs >= endMs) {
        if (trySeamlessAyahTransition()) return;
        audioRef.current.pause();
        handleEnded();
        return;
      }

      const newWord = getActiveWordPosition(currentTimeMs, startMs, segments);
      if (newWord !== playingWord) {
        setPlayingWord(newWord);
        onPlayingWordChange?.(newWord);
      }
    }
  };

  useEffect(() => {
    if (playingAyah !== lastInternalAyahRef.current) {
      setCurrentAyahPlayCount(1);
      setCurrentRangePlayCount(1);
      setPlayingWord(null);
      onPlayingWordChange?.(null);
    }
    lastInternalAyahRef.current = playingAyah;
  }, [playingAyah, onPlayingWordChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (staleSurahSourceBlockedRef.current) {
      audio.pause();
      return;
    }

    if (audioSrc) {
      const nextUrl = new URL(audioSrc, window.location.href).href;
      if (audio.src !== nextUrl) {
        audio.src = audioSrc;
        audio.load();
      }
    }

    if (isPlaying && !isPausedBetween && audioSrc) {
       if (activeSeekRef.current) {
           const ct = audio.currentTime * 1000;
           if (
             audio.readyState >= HTMLMediaElement.HAVE_METADATA
             && (ct < activeSeekRef.current.startMs || ct >= activeSeekRef.current.endMs)
           ) {
              audio.currentTime = activeSeekRef.current.startMs / 1000;
          }
       }
       audio.playbackRate = speed;
       const p = audio.play();
       if (p !== undefined) {
          p.catch(e => {
             if (e.name !== 'AbortError') {
                 setError(true);
                 onIsPlayingChange(false);
             }
          });
       }
    } else if (audioSrc || !audio.src) {
       audio.pause();
    }
  }, [audioRef, audioSrc, isPausedBetween, isPlaying, onIsPlayingChange, speed]);

  useEffect(() => {
    return () => {
      clearPauseTimeout();
      preloadedAyahAudioRef.current.forEach(audio => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      });
      preloadedAyahAudioRef.current.clear();
    };
  }, [onIsPlayingChange]);

  const effectiveStart = memoSession?.isActive ? memoSession.rangeStart : (startAyah ?? 1);
  const effectiveEnd = memoSession?.isActive ? memoSession.rangeEnd : (endAyah ?? surahLength);
  const effectiveScope = memoSession?.isActive ? memoSession.repeatScope : 'ayah';
  const effectiveRepeat = memoSession?.isActive ? memoSession.repeatCount : repeat;
  const effectivePause = memoSession?.isActive ? memoSession.pauseSeconds : 0;

  const getNextPlaybackState = () => {
    if (!playingAyah) return null;
    return getNextAyahMemo(
      playingAyah,
      surahLength,
      effectiveStart,
      effectiveEnd,
      effectiveScope,
      effectiveRepeat,
      currentAyahPlayCount,
      currentRangePlayCount,
    );
  };

  useEffect(() => {
    if (
      !recitationId
      || recitationId === 1_000_159
      || !playingAyah
      || !isPlaying
      || !timingsQuery.data?.synchronized
    ) return;

    const nextState = getNextPlaybackState();
    if (!nextState?.nextAyah || nextState.nextAyah === playingAyah) return;

    void queryClient.prefetchQuery(
      getGetQuranAyahTimingsQueryOptions(
        recitationId,
        surahNumber,
        nextState.nextAyah,
        {
          query: {
            queryKey: getGetQuranAyahTimingsQueryKey(recitationId, surahNumber, nextState.nextAyah),
            retry: false,
            staleTime: Infinity,
          },
        },
      ),
    );
  }, [
    currentAyahPlayCount,
    currentRangePlayCount,
    effectiveEnd,
    effectiveRepeat,
    effectiveScope,
    effectiveStart,
    isPlaying,
    playingAyah,
    queryClient,
    recitationId,
    surahLength,
    surahNumber,
    timingsQuery.data?.synchronized,
  ]);

  useEffect(() => {
    const preloadedAudio = preloadedAyahAudioRef.current;
    preloadedAudio.forEach(audio => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    preloadedAudio.clear();
  }, [recitationId, surahNumber]);

  useEffect(() => {
    if (
      !recitationId
      || !playingAyah
      || !isPlaying
      || (!timingsQuery.isError && recitationId !== 1_000_159)
    ) return;

    const nextState = getNextPlaybackState();
    if (!nextState?.nextAyah || nextState.nextAyah === playingAyah) return;

    const url = `/api/quran/audio/${recitationId}/${surahNumber}/${nextState.nextAyah}`;
    const preloadedAudio = preloadedAyahAudioRef.current;
    if (!preloadedAudio.has(url)) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      preloadedAudio.set(url, audio);
    }

    while (preloadedAudio.size > 3) {
      const oldestEntry = preloadedAudio.entries().next().value as [string, HTMLAudioElement] | undefined;
      if (!oldestEntry) break;
      oldestEntry[1].pause();
      oldestEntry[1].removeAttribute('src');
      oldestEntry[1].load();
      preloadedAudio.delete(oldestEntry[0]);
    }
  }, [
    currentAyahPlayCount,
    currentRangePlayCount,
    effectiveEnd,
    effectiveRepeat,
    effectiveScope,
    effectiveStart,
    isPlaying,
    playingAyah,
    recitationId,
    surahLength,
    surahNumber,
    timingsQuery.isError,
  ]);

  const commitSeamlessAyahTransition = (
    nextState: NonNullable<ReturnType<typeof getNextPlaybackState>>,
    nextTimings: GetQuranAyahTimingsQueryResult,
  ) => {
    if (!recitationId || !nextState.nextAyah) return;
    pendingBoundaryTransitionRef.current = null;
    setCurrentAyahPlayCount(nextState.nextAyahPlayCount);
    setCurrentRangePlayCount(nextState.nextRangePlayCount);
    setPlayingWord(null);
    onPlayingWordChange?.(null);
    activeSeekRef.current = {
      ayah: nextState.nextAyah,
      startMs: nextTimings.verseStartMs,
      endMs: nextTimings.verseEndMs,
      url: nextTimings.audioUrl,
      segments: nextTimings.segments,
    };
    seamlessTransitionKeyRef.current = `${recitationId}-${surahNumber}-${nextState.nextAyah}`;
    lastInternalAyahRef.current = nextState.nextAyah;
    onPlayingAyahChange(nextState.nextAyah);
  };

  const trySeamlessAyahTransition = () => {
    if (!recitationId || recitationId === 1_000_159 || effectivePause !== 0) return false;
    const currentSeek = activeSeekRef.current;
    const nextState = getNextPlaybackState();
    if (!currentSeek || !nextState?.nextAyah || nextState.nextAyah === playingAyah) return false;

    const nextQueryKey = getGetQuranAyahTimingsQueryKey(
      recitationId,
      surahNumber,
      nextState.nextAyah,
    );
    const transitionKey = `${recitationId}-${surahNumber}-${playingAyah}-${nextState.nextAyah}`;
    if (pendingBoundaryTransitionRef.current === transitionKey) return true;

    const nextTimings = queryClient.getQueryData<GetQuranAyahTimingsQueryResult>(nextQueryKey);
    if (nextTimings?.synchronized && nextTimings.audioUrl === currentSeek.url) {
      commitSeamlessAyahTransition(nextState, nextTimings);
      return true;
    }

    pendingBoundaryTransitionRef.current = transitionKey;
    void queryClient.fetchQuery(
      getGetQuranAyahTimingsQueryOptions(
        recitationId,
        surahNumber,
        nextState.nextAyah,
        {
          query: {
            queryKey: nextQueryKey,
            retry: false,
            staleTime: Infinity,
          },
        },
      ),
    ).then(fetchedTimings => {
      if (pendingBoundaryTransitionRef.current !== transitionKey) return;
      if (
        fetchedTimings.synchronized
        && fetchedTimings.audioUrl === currentSeek.url
        && activeSeekRef.current?.ayah === playingAyah
      ) {
        commitSeamlessAyahTransition(nextState, fetchedTimings);
        return;
      }
      pendingBoundaryTransitionRef.current = null;
      audioRef.current?.pause();
      handleEnded();
    }).catch(() => {
      if (pendingBoundaryTransitionRef.current !== transitionKey) return;
      pendingBoundaryTransitionRef.current = null;
      audioRef.current?.pause();
      handleEnded();
    });
    return true;
  };

  const discardPendingAction = () => {
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    pendingNextActionRef.current = null;
    pendingBoundaryTransitionRef.current = null;
    setIsPausedBetween(false);
  };

  const scheduleNextAction = (action: () => void) => {
    discardPendingAction();
    if (effectivePause > 0) {
      setIsPausedBetween(true);
      pendingNextActionRef.current = action;
      pauseTimeoutRef.current = window.setTimeout(() => {
        pauseTimeoutRef.current = null;
        setIsPausedBetween(false);
        if (pendingNextActionRef.current) {
          const fn = pendingNextActionRef.current;
          pendingNextActionRef.current = null;
          fn();
        }
      }, effectivePause * 1000);
    } else {
      action();
    }
  };

  const handleEnded = () => {
    if (!playingAyah) return;
    const entryGuard = surahEntryGuardRef.current;
    if (
      entryGuard
      && entryGuard.surah === surahNumber
      && entryGuard.ayah === playingAyah
    ) return;
    if (isEndedHandledRef.current) return;
    isEndedHandledRef.current = true;

    const { nextAyah, nextAyahPlayCount, nextRangePlayCount } = getNextAyahMemo(
       playingAyah,
       surahLength,
       effectiveStart,
       effectiveEnd,
       effectiveScope,
       effectiveRepeat,
       currentAyahPlayCount,
       currentRangePlayCount
    );

    if (nextAyah !== null) {
      scheduleNextAction(() => {
        isEndedHandledRef.current = false;
        setCurrentAyahPlayCount(nextAyahPlayCount);
        setCurrentRangePlayCount(nextRangePlayCount);
        setPlayingWord(null);
        onPlayingWordChange?.(null);

        if (nextAyah !== playingAyah) {
          lastInternalAyahRef.current = nextAyah;
          onPlayingAyahChange(nextAyah);
        } else {
          if (activeSeekRef.current && audioRef.current) {
            audioRef.current.currentTime = activeSeekRef.current.startMs / 1000;
          } else if (audioRef.current) {
            audioRef.current.currentTime = 0;
          }
          audioRef.current?.play().catch(e => {
            if (e.name !== 'AbortError') setError(true);
          });
        }
      });
    } else {
      if (!memoSession?.isActive && startAyah === null && endAyah === null && surahNumber < 114) {
        advanceBoundary();
      } else {
        onIsPlayingChange(false);
        onPlayingAyahChange(null);
      }
    }
  };

  endedEventRef.current = handleEnded;
  loadedMetadataEventRef.current = handleLoadedMetadata;
  timeUpdateEventRef.current = handleTimeUpdate;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleLoadedMetadataEvent = () => loadedMetadataEventRef.current();
    const handleTimeUpdateEvent = () => timeUpdateEventRef.current();
    const handlePlay = () => { setIsBuffering(false); setError(false); setIsPausedBetween(false); };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);
    const handleError = () => {
      setError(true);
      setIsBuffering(false);
      onIsPlayingChange(false);
    };
    audio.addEventListener("loadedmetadata", handleLoadedMetadataEvent);
    audio.addEventListener("timeupdate", handleTimeUpdateEvent);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadataEvent);
      audio.removeEventListener("timeupdate", handleTimeUpdateEvent);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [audioRef, onIsPlayingChange]);

  const handlePrev = () => {
    if (!playingAyah) return;
    discardPendingAction();
    let prev: number | null = playingAyah - 1;
    if (prev < effectiveStart) {
      prev = null;
    }
    if (prev !== null) {
      onPlayingAyahChange(prev);
      if (!isPlaying) onIsPlayingChange(true);
    }
  };

  const handleNext = () => {
    if (!playingAyah) return;
    discardPendingAction();
    let next: number | null = playingAyah + 1;
    if (next > effectiveEnd) {
      next = (memoSession?.isActive && memoSession.repeatCount === 'continuous') ? effectiveStart : null;
    }
    if (next !== null) {
      onPlayingAyahChange(next);
      if (!isPlaying) onIsPlayingChange(true);
    } else {
      onIsPlayingChange(false);
      onPlayingAyahChange(null);
    }
  };

  const selectedReciter = reciterCatalog.data?.reciters.find(item => item.id === recitationId);
  const filteredReciters = reciterCatalog.data?.reciters.filter((item) => {
    const query = reciterSearch.trim().toLocaleLowerCase(isArabic ? 'ar' : 'en');
    if (!query) return true;
    const localizedStyle = recitationStyleLabel(item.style ?? null, isArabic);
    return `${item.name} ${item.style ?? ''} ${localizedStyle ?? ''}`
      .toLocaleLowerCase(isArabic ? 'ar' : 'en')
      .includes(query);
  }) ?? [];
  const groupedReciters = filteredReciters.reduce<Array<{
    name: string;
    recordings: typeof filteredReciters;
  }>>((groups, item) => {
    const group = groups.find((entry) => entry.name === item.name);
    if (group) group.recordings.push(item);
    else groups.push({ name: item.name, recordings: [item] });
    return groups;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const active = playingAyah !== null;
    setPlayback({
      active,
      isPlaying,
      surahNumber: active ? surahNumber : null,
      ayahNumber: active ? playingAyah : null,
    });
    (window as Window & { __hasaadQuranAudioActive?: boolean }).__hasaadQuranAudioActive = active;
    window.dispatchEvent(new CustomEvent('hasaad:quran-playback', { detail: { active } }));
  }, [isPlaying, playingAyah, setPlayback, surahNumber]);

  useEffect(() => {
    if (!recitationId || !playingAyah) return;
    setSession({
      recitationId,
      surahNumber,
      ayahNumber: playingAyah,
      surahLength,
      endAyah,
      unrestricted: !memoSession?.isActive && startAyah === null && endAyah === null,
      sourceMode: timingsQuery.data?.synchronized ? "chapter" : "ayah",
      speed,
      onAyahEnded: () => endedEventRef.current(),
      onPlaybackLocationChange,
    });
  }, [
    endAyah,
    memoSession?.isActive,
    onPlaybackLocationChange,
    playingAyah,
    recitationId,
    setSession,
    speed,
    startAyah,
    surahLength,
    surahNumber,
    timingsQuery.data?.synchronized,
  ]);

  useEffect(() => {
    if (
      hostPlayback.active
      && hostPlayback.ayahNumber
      && !isPlaying
      && !playingAyah
    ) {
      if (hostPlayback.surahNumber !== surahNumber) {
        if (hostPlayback.surahNumber) {
          onPlaybackLocationChange?.(hostPlayback.surahNumber, hostPlayback.ayahNumber);
        }
        return;
      }
      onPlayingAyahChange(hostPlayback.ayahNumber);
      onIsPlayingChange(hostPlayback.isPlaying);
    }
  }, [
    hostPlayback.active,
    hostPlayback.ayahNumber,
    hostPlayback.isPlaying,
    hostPlayback.surahNumber,
    isPlaying,
    onIsPlayingChange,
    onPlaybackLocationChange,
    onPlayingAyahChange,
    playingAyah,
    surahNumber,
  ]);

  const selectReciter = async (nextRecitationId: number) => {
    if (nextRecitationId === recitationId) return;
    const previousRecitationId = recitationId;
    setRecitationId(nextRecitationId);
    setError(false);
    if (preferenceStorage === 'local') {
      try {
        window.localStorage.setItem('hasaad:standalone-quran-recitation-id', String(nextRecitationId));
        toast.success(isArabic ? 'تم حفظ القارئ المفضل على هذا الجهاز' : 'Preferred reciter saved on this device');
      } catch {
        toast.info(isArabic ? 'سيبقى القارئ محددًا خلال هذه الجلسة' : 'The reciter will stay selected for this session');
      }
      return;
    }
    try {
      await savePreference.mutateAsync({ data: { recitationId: nextRecitationId } });
      await queryClient.invalidateQueries({ queryKey: getListQuranRecitersQueryKey() });
      toast.success(isArabic ? 'تم حفظ القارئ المفضل' : 'Preferred reciter saved');
    } catch {
      setRecitationId(previousRecitationId);
      toast.error(isArabic ? 'تعذر حفظ القارئ المفضل' : 'Could not save preferred reciter');
    }
  };

  const togglePlay = () => {
    if (!playingAyah) {
      isEndedHandledRef.current = false;
      setCurrentAyahPlayCount(1);
      setCurrentRangePlayCount(1);
      onPlayingAyahChange(clampAyah(selectedAyah, effectiveStart, effectiveEnd) ?? effectiveStart ?? 1);
      onIsPlayingChange(true);
    } else {
      if (isPausedBetween) {
        const action = pendingNextActionRef.current;
        discardPendingAction();
        if (action) action();
      } else {
        onIsPlayingChange(!isPlaying);
      }
    }
  };

  const handleRestartAyah = () => {
    discardPendingAction();
    isEndedHandledRef.current = false;
    setCurrentAyahPlayCount(1);
    setCurrentRangePlayCount(1);
    setPlayingWord(null);
    onPlayingWordChange?.(null);
    const activeAyahSeek = activeSeekRef.current?.ayah === playingAyah
      ? activeSeekRef.current
      : null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = activeAyahSeek
        ? activeAyahSeek.startMs / 1000
        : 0;
      audioRef.current.playbackRate = speed;
      void audioRef.current.play();
    }
    onIsPlayingChange(true);
  };

  const cycleSpeed = () => {
    const currentIndex = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(currentIndex + 1) % SPEEDS.length]);
  };

  const cycleRepeat = () => {
    const currentIndex = REPEATS.indexOf(repeat);
    const nextRepeat = REPEATS[(currentIndex + 1) % REPEATS.length];
    isEndedHandledRef.current = false;
    setCurrentAyahPlayCount(1);
    setCurrentRangePlayCount(1);
    setRepeat(nextRepeat);
  };

  return (
    <div ref={playerRef} data-quran-audio-controller="true" className={cn(
       "relative w-full shrink-0 border-t bg-background/95 p-2 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] backdrop-blur-md transition-colors dark:shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.3)]",
       memoSession?.isActive ? "border-amber-300/60 dark:border-amber-900/40" : "border-border/60"
    )}>

      {/* Floating Panel for Active Tab */}
      {activeTab !== 'none' && (
        <div
          data-testid={`panel-${activeTab}`}
          className="absolute bottom-full end-2 z-50 mb-2 max-h-[calc(100dvh-11rem)] w-[340px] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 sm:end-4 sm:mb-3 sm:max-h-[calc(100dvh-5rem)] sm:p-4"
        >
          {activeTab === 'settings' ? (
             <div className="space-y-5">
               <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{isArabic ? 'خيارات التلاوة' : 'Audio Options'}</span>
                   <button data-testid="button-close-panel" onClick={() => setActiveTab('none')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
               </div>

               <div className="flex items-center justify-between gap-3">
                 <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold">
                   <Zap className="w-4 h-4" />
                   <span>{isArabic ? 'السرعة' : 'Speed'}</span>
                 </div>
                 <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50" dir="ltr">
                   {SPEEDS.map(s => (
                     <button
                       key={s}
                       data-testid={`button-speed-${s}`}
                       onClick={() => setSpeed(s)}
                       className={cn(
                          "min-h-8 px-3 py-1 text-xs font-bold rounded-md transition-all",
                         speed === s ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
                       )}
                     >
                       {s}x
                     </button>
                   ))}
                 </div>
               </div>

               {!memoSession?.isActive && (
                 <div className="flex items-center justify-between gap-3">
                   <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold">
                     <Repeat className="w-4 h-4" />
                     <span>{isArabic ? 'التكرار' : 'Repeat'}</span>
                   </div>
                   <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50" dir="ltr">
                     {REPEATS.map(r => (
                       <button
                         key={r}
                         data-testid={`button-repeat-${r}`}
                         onClick={() => {
                           isEndedHandledRef.current = false;
                           setRepeat(r);
                           setCurrentAyahPlayCount(1);
                           setCurrentRangePlayCount(1);
                         }}
                         className={cn(
                            "min-h-8 px-3 py-1 text-xs font-bold rounded-md transition-all",
                           repeat === r ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
                         )}
                       >
                         {r}x
                       </button>
                     ))}
                   </div>
                 </div>
               )}

               <hr className="border-border/50" />

               <div className="space-y-3">
                 <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold">
                   <Volume2 className="w-4 h-4" />
                   <span>{isArabic ? 'القارئ' : 'Reciter'}</span>
                 </div>
                 <div className="relative">
                   <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <input
                     data-testid="input-reciter-search"
                     value={reciterSearch}
                     onChange={e => setReciterSearch(e.target.value)}
                     className="w-full h-9 pl-9 pr-3 rtl:pr-9 rtl:pl-3 text-xs font-semibold rounded-md bg-muted/30 border border-border/50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                     placeholder={isArabic ? 'بحث باسم القارئ...' : 'Search reciter...'}
                   />
                 </div>
                 <div className="max-h-[180px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                   {reciterCatalog.isLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                   ) : groupedReciters.length > 0 ? groupedReciters.map(group => {
                     const onlyRecording = group.recordings.length === 1 ? group.recordings[0] : null;
                     return (
                       <div key={group.name} className="py-1 border-b border-border/30 last:border-0">
                          {onlyRecording ? (
                             <button
                               data-testid={`button-reciter-${onlyRecording.id}`}
                               onClick={() => selectReciter(onlyRecording.id)}
                               disabled={savePreference.isPending}
                               className={cn(
                                  "w-full flex items-center justify-between p-2 rounded-md text-xs font-bold transition-all",
                                  onlyRecording.id === recitationId ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "hover:bg-muted text-foreground"
                               )}
                             >
                                <span className="truncate">{group.name}</span>
                                {savePreference.isPending && onlyRecording.id === recitationId && <Loader2 className="w-3 h-3 animate-spin" />}
                             </button>
                          ) : (
                             <div className="space-y-1.5 p-1">
                                <span className="text-[11px] text-muted-foreground font-bold truncate block">{group.name}</span>
                                <div className="flex flex-wrap gap-1.5">
                                   {group.recordings.map(item => (
                                      <button
                                        key={item.id}
                                        data-testid={`button-reciter-${item.id}`}
                                        onClick={() => selectReciter(item.id)}
                                        disabled={savePreference.isPending}
                                        className={cn(
                                           "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border",
                                           item.id === recitationId
                                             ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300"
                                             : "bg-background border-border/50 hover:bg-muted text-foreground"
                                        )}
                                      >
                                        {recitationStyleLabel(item.style ?? null, isArabic) ?? (isArabic ? 'تلاوة' : 'Recitation')}
                                        {savePreference.isPending && item.id === recitationId && <Loader2 className="inline-block w-3 h-3 animate-spin ml-1 rtl:mr-1 rtl:ml-0" />}
                                      </button>
                                   ))}
                                </div>
                             </div>
                          )}
                       </div>
                     )
                   }) : (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        {isArabic ? 'لا توجد نتائج' : 'No results found'}
                      </p>
                   )}
                 </div>
               </div>
             </div>
          ) : (
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-1.5">
                   <BookOpen className="w-4 h-4 text-amber-600" />
                   <span className="font-bold text-sm text-foreground">{isArabic ? 'جلسة الحفظ والتكرار' : 'Memorization Session'}</span>
                 </div>
                  <button data-testid="button-close-panel" onClick={() => setActiveTab('none')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                   <X className="w-4 h-4" />
                 </button>
               </div>

               {memoSession && onMemoSessionChange && (
                 <div className="space-y-3">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs font-bold text-muted-foreground">{isArabic ? 'النطاق' : 'Range'}</span>
                     <div className="flex items-center bg-muted/50 rounded-lg border border-border/50 p-0.5">
                        <div className="flex items-center px-2 py-1 gap-1">
                          <span className="text-[10px] text-muted-foreground">{isArabic ? 'من' : 'From'}</span>
                          <select
                            data-testid="select-memo-start"
                            value={memoSession.rangeStart}
                            onChange={e => onMemoSessionChange({ ...memoSession, rangeStart: Number(e.target.value) })}
                            className="bg-transparent text-xs font-bold outline-none cursor-pointer text-foreground"
                          >
                            {Array.from({ length: surahLength }, (_, i) => i + 1)
                               .filter(i => (!startAyah || i >= startAyah) && (!endAyah || i <= endAyah))
                               .map(i => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </div>
                        <div className="w-px h-3 bg-border/50 mx-1"></div>
                        <div className="flex items-center px-2 py-1 gap-1">
                          <span className="text-[10px] text-muted-foreground">{isArabic ? 'إلى' : 'To'}</span>
                          <select
                            data-testid="select-memo-end"
                            value={memoSession.rangeEnd}
                            onChange={e => onMemoSessionChange({ ...memoSession, rangeEnd: Math.max(memoSession.rangeStart, Number(e.target.value)) })}
                            className="bg-transparent text-xs font-bold outline-none cursor-pointer text-foreground"
                          >
                            {Array.from({ length: surahLength }, (_, i) => i + 1)
                               .filter(i => i >= memoSession.rangeStart && (!endAyah || i <= endAyah))
                               .map(i => <option key={i} value={i}>{i}</option>)}
                          </select>
                        </div>
                     </div>
                   </div>

                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs font-bold text-muted-foreground">{isArabic ? 'تكرار' : 'Repeat'}</span>
                     <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50">
                       <button
                          data-testid="button-memo-scope-ayah"
                          onClick={() => onMemoSessionChange({ ...memoSession, repeatScope: 'ayah' })}
                           className={cn("min-h-8 px-3 py-1 text-xs font-bold rounded-md transition-all", memoSession.repeatScope === 'ayah' ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                       >
                          {isArabic ? 'الآية' : 'Ayah'}
                       </button>
                       <button
                          data-testid="button-memo-scope-range"
                          onClick={() => onMemoSessionChange({ ...memoSession, repeatScope: 'range' })}
                           className={cn("min-h-8 px-3 py-1 text-xs font-bold rounded-md transition-all", memoSession.repeatScope === 'range' ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                       >
                          {isArabic ? 'النطاق' : 'Range'}
                       </button>
                     </div>
                   </div>

                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs font-bold text-muted-foreground">{isArabic ? 'المرات' : 'Count'}</span>
                     <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50" dir="ltr">
                       {MEMO_REPEAT_COUNTS.map(val => (
                         <button
                            key={val}
                            data-testid={`button-memo-count-${val}`}
                            onClick={() => onMemoSessionChange({ ...memoSession, repeatCount: val })}
                             className={cn("min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-all", memoSession.repeatCount === val ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                         >
                            {val === 'continuous' ? '∞' : `${val}x`}
                         </button>
                       ))}
                     </div>
                   </div>

                   <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold">
                        <Clock className="w-4 h-4" />
                        <span>{isArabic ? 'توقف' : 'Pause'}</span>
                     </div>
                     <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50" dir="ltr">
                       {[0, 1, 2, 3, 5].map(val => (
                         <button
                            key={val}
                            data-testid={`button-memo-pause-${val}`}
                            onClick={() => onMemoSessionChange({ ...memoSession, pauseSeconds: val })}
                             className={cn("min-h-8 px-2 py-1 text-xs font-bold rounded-md transition-all", memoSession.pauseSeconds === val ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                         >
                            {val === 0 ? '0s' : `${val}s`}
                         </button>
                       ))}
                     </div>
                   </div>

                   {memoView && onMemoViewChange && (
                      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/50">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {isArabic ? 'الآيات' : 'Visibility'}
                        </span>
                        <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border/50">
                          <button
                             data-testid="button-memoview-show"
                             onClick={() => onMemoViewChange('show')}
                              className={cn("min-h-8 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all", memoView === 'show' ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                          >
                             {isArabic ? 'الكل' : 'All'}
                          </button>
                          <button
                             data-testid="button-memoview-progressive"
                             onClick={() => onMemoViewChange('progressive')}
                              className={cn("min-h-8 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all", memoView === 'progressive' ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                          >
                             {isArabic ? 'تتابعي' : 'Prog'}
                          </button>
                          <button
                             data-testid="button-memoview-hide"
                             onClick={() => onMemoViewChange('hide')}
                              className={cn("min-h-8 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all", memoView === 'hide' ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground")}
                          >
                             {isArabic ? 'إخفاء' : 'Hide'}
                          </button>
                        </div>
                      </div>
                   )}
                 </div>
               )}
             </div>
          )}
        </div>
      )}

      {/* Main Control Bar */}
      <div className="mx-auto flex w-full max-w-5xl flex-nowrap items-center justify-between gap-1.5 overflow-x-auto px-1 md:gap-4 md:px-2">

        {/* Track information */}
        <div className="order-1 flex min-w-[150px] flex-1 basis-auto items-center gap-2 md:gap-3">
          <button
            data-testid="button-play-pause"
            onClick={togglePlay}
            aria-label={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:h-12 md:w-12",
              memoSession?.isActive ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
            )}
          >
            {isBuffering ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5 rtl:mr-0.5 rtl:ml-0" />}
          </button>
          <div className="flex flex-col min-w-0">
            <span data-testid="text-surah-info" className="truncate text-xs md:text-sm font-bold text-foreground">
               {isArabic
                  ? `سورة ${surahs[surahNumber - 1]?.name} - آية ${playingAyah ?? selectedAyah}`
                  : `Surah ${surahs[surahNumber - 1]?.name} - Ayah ${playingAyah ?? selectedAyah}`}
            </span>
            {isPausedBetween ? (
               <div className="flex items-center gap-1.5 mt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                  <span className="text-[10px] md:text-xs font-bold text-amber-700 dark:text-amber-400">{isArabic ? 'توقف مؤقت...' : 'Paused...'}</span>
               </div>
            ) : error ? (
               <div className="flex items-center gap-1 mt-0.5 text-destructive">
                  <span className="text-[10px] md:text-xs font-bold">{isArabic ? 'تعذر تحميل الصوت' : 'Failed to load audio'}</span>
                  <button onClick={() => { setError(false); setIsBuffering(true); audioRef.current?.load(); audioRef.current?.play(); }} className="underline hover:no-underline">
                    <RefreshCw className="w-3 h-3 inline" />
                  </button>
               </div>
            ) : (
               <div className="flex items-center gap-2 mt-0.5 text-[10px] md:text-xs font-semibold text-muted-foreground">
                 <span className="truncate max-w-[120px] sm:max-w-[200px]">
                   {reciterCatalog.isLoading
                     ? (isArabic ? 'تحميل...' : 'Loading...')
                     : selectedReciter?.name ?? (isArabic ? 'القارئ غير متاح' : 'Reciter unavailable')}
                 </span>
                 {memoSession?.isActive && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 shrink-0">
                        <BookOpen className="w-3 h-3" />
                        {isArabic ? 'حفظ' : 'Memo'}
                      </span>
                    </>
                 )}
                 {playingAyah && (effectiveRepeat === 'continuous' || effectiveRepeat > 1) && (
                   <>
                     <span className="w-1 h-1 rounded-full bg-border shrink-0"></span>
                     <span className={cn("flex items-center gap-1 shrink-0", memoSession?.isActive ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                       <Repeat className="w-3 h-3" />
                       {effectiveScope === 'ayah'
                         ? `${currentAyahPlayCount}/${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}`
                         : `${currentRangePlayCount}/${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}`
                       }
                     </span>
                   </>
                 )}
               </div>
            )}
          </div>
        </div>

        {/* Playback and option controls share one compact row on phones. */}
        <div className="order-2 flex w-auto shrink-0 basis-auto flex-nowrap items-center justify-center gap-0.5 border-s border-border/40 ps-1 md:gap-2 md:ps-3">
          <div className="flex shrink-0 items-center justify-center gap-1 md:gap-2">
            <div className="flex items-center justify-center gap-1 md:gap-2" dir={isArabic ? "rtl" : "ltr"}>
              <button data-testid="button-prev-ayah" onClick={handlePrev} disabled={!playingAyah || getPrevAyah(playingAyah, effectiveStart) === null} aria-label={isArabic ? 'الآية السابقة' : 'Previous ayah'} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
                <SkipBack className={cn("w-4 h-4 md:w-5 md:h-5 fill-current", isArabic && "scale-x-[-1]")} />
              </button>
              <button data-testid="button-restart-ayah" onClick={handleRestartAyah} disabled={!playingAyah} aria-label={isArabic ? 'إعادة الآية من البداية' : 'Restart ayah'} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
                <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button data-testid="button-next-ayah" onClick={handleNext} disabled={!playingAyah} aria-label={isArabic ? 'الآية التالية' : 'Next ayah'} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
                <SkipForward className={cn("w-4 h-4 md:w-5 md:h-5 fill-current", isArabic && "scale-x-[-1]")} />
              </button>
            </div>
            <button
              data-testid="button-cycle-speed"
              type="button"
              onClick={cycleSpeed}
              className="flex h-9 min-w-14 items-center justify-center gap-1 rounded-lg bg-muted/60 px-2 text-[11px] font-black text-foreground transition-colors hover:bg-muted"
              aria-label={isArabic ? `سرعة التلاوة ${speed}` : `Playback speed ${speed}`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-600" />
              <span dir="ltr">{speed}x</span>
            </button>
            {!memoSession?.isActive && (
              <button
                data-testid="button-cycle-repeat"
                type="button"
                onClick={cycleRepeat}
                className="flex h-9 min-w-14 items-center justify-center gap-1 rounded-lg bg-muted/60 px-2 text-[11px] font-black text-foreground transition-colors hover:bg-muted"
                aria-label={isArabic ? `تكرار الآية ${repeat} مرات` : `Repeat ayah ${repeat} times`}
              >
                <Repeat className="h-3.5 w-3.5 text-emerald-700" />
                <span dir="ltr">{repeat}x</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center justify-center gap-0.5 border-s border-border/50 ps-1 md:gap-2 md:ps-3">
          {memoSession?.isActive && (
             <button
               data-testid="button-memo-options"
               onClick={() => setActiveTab(activeTab === 'memo' ? 'none' : 'memo')}
                aria-label={isArabic ? 'إعدادات التكرار والحفظ' : 'Repeat and memorization settings'}
                aria-expanded={activeTab === 'memo'}
               className={cn(
                   "relative flex h-10 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors md:text-xs",
                  activeTab === 'memo' || memoSession.isActive ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "hover:bg-muted text-muted-foreground"
               )}
             >
                <Repeat className="h-4 w-4" />
                 <span className="hidden sm:inline">{isArabic ? 'تكرار' : 'Repeat'}</span>
               {memoSession.isActive && <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-background"></span>}
             </button>
          )}
          <button
             data-testid="button-audio-options"
             onClick={() => {
               const isOpening = activeTab !== 'settings';
               setActiveTab(isOpening ? 'settings' : 'none');
               if (isOpening) void reciterCatalog.refetch();
             }}
             aria-label={isArabic ? 'خيارات التلاوة' : 'Recitation options'}
             aria-expanded={activeTab === 'settings'}
             className={cn(
                 "flex h-10 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors md:text-xs",
                activeTab === 'settings' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "hover:bg-muted text-muted-foreground"
             )}
          >
             <Settings2 className="h-4 w-4" />
             <span className="hidden sm:inline">{isArabic ? 'القارئ والخيارات' : 'Reciter and options'}</span>
          </button>
          {onClose && (
             <button
                data-testid="button-close-player"
                onClick={onClose}
                aria-label={isArabic ? 'إغلاق مشغل التلاوة' : 'Close recitation player'}
                 className="ms-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
             >
                <X className="w-4 h-4 md:w-4 md:h-4" />
             </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
