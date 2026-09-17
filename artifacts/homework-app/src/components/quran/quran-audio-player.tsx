import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Settings2, Loader2, Volume2, Repeat, Zap, RefreshCw, X, Search, BookOpen, Clock, Eye } from 'lucide-react';
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
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MemoSessionState } from './use-quran-memo-session';

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
  memoSession?: MemoSessionState;
  onMemoSessionChange?: (session: MemoSessionState) => void;
  memoView?: 'show' | 'hide' | 'progressive';
  onMemoViewChange?: (view: 'show' | 'hide' | 'progressive') => void;
  onPlayingWordChange?: (wordPosition: number | null) => void;
}

const SPEEDS = [0.75, 1, 1.25];
const REPEATS = [1, 3, 5, 10];
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
  memoSession,
  onMemoSessionChange,
  memoView,
  onMemoViewChange,
  onPlayingWordChange,
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const activeSeekRef = useRef<{ ayah: number, startMs: number, endMs: number, url: string, segments: AyahTimingSegment[] } | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | undefined>();
  const currentAudioSrcRef = useRef<string | undefined>(undefined);
  const lastQueryKeyRef = useRef<string>('');
  const [playingWord, setPlayingWord] = useState<number | null>(null);
  
  const pendingNextActionRef = useRef<(() => void) | null>(null);
  const isEndedHandledRef = useRef(false);

  const surahLength = surahs[surahNumber - 1]?.ayahs.length || 0;

  const timingsQuery = useGetQuranAyahTimings(
    recitationId ?? 0,
    surahNumber,
    playingAyah ?? 0,
    {
      query: {
        enabled: !!playingAyah && !!recitationId,
        retry: false,
        staleTime: Infinity,
        queryKey: getGetQuranAyahTimingsQueryKey(recitationId ?? 0, surahNumber, playingAyah ?? 0),
      }
    }
  );

  useEffect(() => {
    if (memoSession?.isActive) setActiveTab('memo');
    else if (activeTab === 'memo') setActiveTab('none');
  }, [memoSession?.isActive]);

  useEffect(() => {
    if (recitationId !== null || !reciterCatalog.data?.reciters.length) return;
    setRecitationId(
      reciterCatalog.data.preferredRecitationId ?? reciterCatalog.data.reciters[0].id,
    );
  }, [recitationId, reciterCatalog.data]);

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
       lastQueryKeyRef.current = currentQueryKey;
       audioRef.current?.pause();
       if (pauseTimeoutRef.current !== null) {
         clearTimeout(pauseTimeoutRef.current);
         pauseTimeoutRef.current = null;
       }
       pendingNextActionRef.current = null;
       setIsPausedBetween(false);
       activeSeekRef.current = null;
       isEndedHandledRef.current = false;
       setPlayingWord(null);
       onPlayingWordChange?.(null);
    }

    if (timingsQuery.isLoading || timingsQuery.isFetching) {
       if (audioSrc !== undefined) {
         setAudioSrc(undefined);
         currentAudioSrcRef.current = undefined;
       }
       return;
    }
    
    if (timingsQuery.isError || !timingsQuery.data?.synchronized) {
      if (recitationId >= 1_000_000) {
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
         currentAudioSrcRef.current = fallbackUrl;
         setAudioSrc(fallbackUrl);
      } else {
         if (audioRef.current) audioRef.current.currentTime = 0;
      }
    } else {
      const data = timingsQuery.data;
      activeSeekRef.current = {
        ayah: playingAyah,
        startMs: data.verseStartMs,
        endMs: data.verseEndMs,
        url: data.audioUrl,
        segments: data.segments,
      };
      
      if (currentAudioSrcRef.current !== data.audioUrl) {
         currentAudioSrcRef.current = data.audioUrl;
         setAudioSrc(data.audioUrl);
      } else {
         if (audioRef.current) {
            audioRef.current.currentTime = data.verseStartMs / 1000;
         }
      }
    }
  }, [playingAyah, recitationId, surahNumber, timingsQuery.isLoading, timingsQuery.isFetching, timingsQuery.isError, timingsQuery.data]);

  const handleLoadedMetadata = () => {
    if (activeSeekRef.current && audioRef.current) {
      audioRef.current.currentTime = activeSeekRef.current.startMs / 1000;
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    
    if (activeSeekRef.current) {
      const currentTimeMs = audioRef.current.currentTime * 1000;
      const { startMs, endMs, segments, ayah } = activeSeekRef.current;
      
      if (ayah !== playingAyah) return;
      
      if (currentTimeMs >= endMs) {
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
    if (!audioRef.current) return;
    
    if (isPlaying && !isPausedBetween && audioSrc) {
       if (activeSeekRef.current) {
          const ct = audioRef.current.currentTime * 1000;
          if (ct < activeSeekRef.current.startMs || ct >= activeSeekRef.current.endMs) {
             audioRef.current.currentTime = activeSeekRef.current.startMs / 1000;
          }
       }
       audioRef.current.playbackRate = speed;
       const p = audioRef.current.play();
       if (p !== undefined) {
          p.catch(e => {
             if (e.name !== 'AbortError') {
                 setError(true);
                 onIsPlayingChange(false);
             }
          });
       }
    } else {
       audioRef.current.pause();
    }
  }, [isPlaying, isPausedBetween, audioSrc, speed]);

  useEffect(() => {
    return () => {
      clearPauseTimeout();
      onIsPlayingChange(false);
    };
  }, [onIsPlayingChange]);

  const effectiveStart = memoSession?.isActive ? memoSession.rangeStart : (startAyah ?? 1);
  const effectiveEnd = memoSession?.isActive ? memoSession.rangeEnd : (endAyah ?? surahLength);
  const effectiveScope = memoSession?.isActive ? memoSession.repeatScope : 'ayah';
  const effectiveRepeat = memoSession?.isActive ? memoSession.repeatCount : repeat;
  const effectivePause = memoSession?.isActive ? memoSession.pauseSeconds : 0;

  const discardPendingAction = () => {
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    pendingNextActionRef.current = null;
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
      onIsPlayingChange(false);
      onPlayingAyahChange(null);
    }
  };

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

  const selectReciter = async (nextRecitationId: number) => {
    if (nextRecitationId === recitationId) return;
    const previousRecitationId = recitationId;
    setRecitationId(nextRecitationId);
    setError(false);
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

  const handleStop = () => {
    discardPendingAction();
    isEndedHandledRef.current = false;
    setCurrentAyahPlayCount(1);
    setCurrentRangePlayCount(1);
    onIsPlayingChange(false);
    onPlayingAyahChange(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-border p-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] w-full shrink-0 flex flex-col gap-2 transition-colors">
      {memoSession?.isActive && (
         <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-1">
            <div className="flex items-center gap-2">
               <BookOpen className="w-5 h-5 text-emerald-600" />
               <span className="font-bold text-emerald-900 dark:text-emerald-300">{isArabic ? 'جلسة حفظ وتكرار' : 'Memorization Session'}</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={isArabic ? "إغلاق مشغل الآية" : "Close player"}
              >
                <X className="h-4 w-4" />
              </button>
            )}
         </div>
      )}
      {!memoSession?.isActive && onClose && (
        <div className="flex h-7 shrink-0 items-center justify-start mb-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isArabic ? "إغلاق مشغل الآية" : "Close player"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => { setIsBuffering(false); setError(false); setIsPausedBetween(false); }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => {
            setError(true);
            setIsBuffering(false);
            onIsPlayingChange(false);
          }}
        />
      )}

      {activeTab === 'memo' && memoSession && onMemoSessionChange && (
        <div id="quran-memo-settings" className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 mb-2 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 mb-1 hidden md:flex">
             <BookOpen className="w-5 h-5 text-amber-700 dark:text-amber-500" />
             <span className="font-bold text-amber-900 dark:text-amber-300">
                {isArabic ? 'إعدادات الحفظ والتكرار' : 'Memorization Settings'}
             </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1.5 shadow-sm">
                <span className="text-xs font-bold px-2">{isArabic ? 'من' : 'From'}</span>
                <select 
                   value={memoSession.rangeStart} 
                   onChange={e => onMemoSessionChange({ ...memoSession, rangeStart: Number(e.target.value) })}
                   className="bg-transparent font-bold text-sm outline-none cursor-pointer flex-1"
                >
                   {Array.from({ length: surahLength }, (_, i) => i + 1)
                      .filter(i => (!startAyah || i >= startAyah) && (!endAyah || i <= endAyah))
                      .map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <span className="text-xs font-bold px-2 border-l border-border">{isArabic ? 'إلى' : 'To'}</span>
                <select 
                   value={memoSession.rangeEnd} 
                   onChange={e => onMemoSessionChange({ ...memoSession, rangeEnd: Math.max(memoSession.rangeStart, Number(e.target.value)) })}
                   className="bg-transparent font-bold text-sm outline-none cursor-pointer flex-1"
                >
                   {Array.from({ length: surahLength }, (_, i) => i + 1)
                      .filter(i => i >= memoSession.rangeStart && (!endAyah || i <= endAyah))
                      .map(i => <option key={i} value={i}>{i}</option>)}
                </select>
             </div>

             <div className="flex items-center bg-background rounded-lg border border-border shadow-sm p-1">
                <button 
                   onClick={() => onMemoSessionChange({ ...memoSession, repeatScope: 'ayah' })}
                   className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-colors", memoSession.repeatScope === 'ayah' ? "bg-amber-200/50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" : "hover:bg-muted text-foreground")}
                >
                   {isArabic ? 'تكرار الآية' : 'Repeat Ayah'}
                </button>
                <button 
                   onClick={() => onMemoSessionChange({ ...memoSession, repeatScope: 'range' })}
                   className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-colors", memoSession.repeatScope === 'range' ? "bg-amber-200/50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" : "hover:bg-muted text-foreground")}
                >
                   {isArabic ? 'تكرار النطاق' : 'Repeat Range'}
                </button>
             </div>

             <div className="flex items-center gap-2 bg-background rounded-lg border border-border shadow-sm p-1.5">
                <Repeat className="w-4 h-4 text-muted-foreground ml-1" />
                <select
                   value={memoSession.repeatCount === 'continuous' ? 'continuous' : memoSession.repeatCount}
                   onChange={e => onMemoSessionChange({ ...memoSession, repeatCount: e.target.value === 'continuous' ? 'continuous' : Number(e.target.value) })}
                   className="bg-transparent font-bold text-sm outline-none cursor-pointer flex-1"
                >
                   <option value={1}>{isArabic ? 'مرة واحدة' : '1 time'}</option>
                   <option value={3}>{isArabic ? '3 مرات' : '3 times'}</option>
                   <option value={5}>{isArabic ? '5 مرات' : '5 times'}</option>
                   <option value={10}>{isArabic ? '10 مرات' : '10 times'}</option>
                   <option value="continuous">{isArabic ? 'مستمر' : 'Continuous'}</option>
                </select>
             </div>

             <div className="flex items-center gap-2 bg-background rounded-lg border border-border shadow-sm p-1.5">
                <Clock className="w-4 h-4 text-muted-foreground ml-1" />
                <select
                   value={memoSession.pauseSeconds}
                   onChange={e => onMemoSessionChange({ ...memoSession, pauseSeconds: Number(e.target.value) })}
                   className="bg-transparent font-bold text-sm outline-none cursor-pointer flex-1"
                >
                   <option value={0}>{isArabic ? 'بدون توقف' : 'No pause'}</option>
                   <option value={1}>{isArabic ? 'توقف ثانية' : '1s pause'}</option>
                   <option value={2}>{isArabic ? 'توقف ثانيتين' : '2s pause'}</option>
                   <option value={3}>{isArabic ? 'توقف ٣ ثوانٍ' : '3s pause'}</option>
                   <option value={5}>{isArabic ? 'توقف ٥ ثوانٍ' : '5s pause'}</option>
                </select>
             </div>
             
             {memoView && onMemoViewChange && (
               <div className="flex items-center gap-2 md:col-span-2 mt-1">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center bg-background rounded-lg border border-border overflow-hidden p-1">
                     <button 
                        onClick={() => onMemoViewChange('show')}
                        className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", memoView === 'show' ? "bg-emerald-600 text-white" : "hover:bg-muted text-foreground")}
                     >
                        {isArabic ? 'إظهار الكل' : 'Show All'}
                     </button>
                     <button 
                        onClick={() => onMemoViewChange('hide')}
                        className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", memoView === 'hide' ? "bg-emerald-600 text-white" : "hover:bg-muted text-foreground")}
                     >
                        {isArabic ? 'إخفاء' : 'Hide'}
                     </button>
                     <button 
                        onClick={() => onMemoViewChange('progressive')}
                        className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", memoView === 'progressive' ? "bg-emerald-600 text-white" : "hover:bg-muted text-foreground")}
                     >
                        {isArabic ? 'تتابعي' : 'Prog'}
                     </button>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div id="quran-audio-settings" className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl mb-1 text-sm border border-border/50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex w-full flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-72">
              <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold">{isArabic ? 'القارئ المفضل' : 'Preferred reciter'}</span>
              </div>
              {reciterCatalog.isLoading ? (
                <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isArabic ? 'جارٍ تحميل مكتبة القراء…' : 'Loading reciter library…'}</span>
                </div>
              ) : reciterCatalog.isError ? (
                <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 text-destructive">
                  <span>{isArabic ? 'تعذر تحميل مكتبة القراء' : 'Could not load reciter library'}</span>
                  <button
                    type="button"
                    onClick={() => void reciterCatalog.refetch()}
                    className="inline-flex items-center gap-1 font-bold underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {isArabic ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              ) : (
                <>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={reciterSearch}
                      onChange={(event) => setReciterSearch(event.target.value)}
                      placeholder={isArabic ? 'ابحث باسم القارئ أو نوع التلاوة' : 'Search reciter or style'}
                      className="h-10 w-full rounded-lg border border-border bg-background pe-3 ps-9 font-semibold text-foreground outline-none focus:border-emerald-600"
                    />
                  </label>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background p-1">
                    {groupedReciters.length ? groupedReciters.map((group) => {
                      const onlyRecording = group.recordings.length === 1
                        ? group.recordings[0]
                        : null;
                      return (
                        <div
                          key={group.name}
                          className="border-b border-border/60 px-1 py-1 last:border-b-0"
                        >
                          {onlyRecording ? (
                            <button
                              type="button"
                              disabled={savePreference.isPending}
                              onClick={() => void selectReciter(onlyRecording.id)}
                              className={cn(
                                "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-start font-bold transition-colors disabled:opacity-60",
                                onlyRecording.id === recitationId
                                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                                  : "hover:bg-muted",
                              )}
                            >
                              <span className="truncate">{group.name}</span>
                              {savePreference.isPending && onlyRecording.id === recitationId && (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                              )}
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-1">
                              <span className="min-w-0 shrink truncate font-bold">{group.name}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {group.recordings.map((item) => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    disabled={savePreference.isPending}
                                    onClick={() => void selectReciter(item.id)}
                                    className={cn(
                                      "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-60",
                                      item.id === recitationId
                                        ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                                        : "border-border bg-background hover:bg-muted",
                                    )}
                                  >
                                    {recitationStyleLabel(item.style ?? null, isArabic)
                                      ?? (isArabic ? "تلاوة" : "Recitation")}
                                    {savePreference.isPending && item.id === recitationId && (
                                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <p className="px-3 py-5 text-center text-muted-foreground">
                        {isArabic ? 'لا يوجد قارئ مطابق للبحث' : 'No reciter matches your search'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center bg-background rounded-lg border border-border overflow-hidden">
                {REPEATS.map(r => (
                  <button 
                    key={r} 
                     onClick={() => {
                       isEndedHandledRef.current = false;
                       setRepeat(r);
                       setCurrentAyahPlayCount(1);
                       setCurrentRangePlayCount(1);
                     }}
                    className={cn(
                      "px-3 py-1 font-bold text-xs transition-colors",
                      repeat === r ? "bg-emerald-600 text-white" : "hover:bg-muted text-foreground"
                    )}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center bg-background rounded-lg border border-border overflow-hidden">
                {SPEEDS.map(s => (
                  <button 
                    key={s} 
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "px-3 py-1 font-bold text-xs transition-colors",
                      speed === s ? "bg-emerald-600 text-white" : "hover:bg-muted text-foreground"
                    )}
                    style={{ direction: 'ltr' }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto w-full px-2">
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <button 
            onClick={togglePlay}
            className={cn("w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0 text-white", 
              memoSession?.isActive ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
            )}
            aria-label={isPlaying ? (isArabic ? 'إيقاف مؤقت' : 'Pause') : (isArabic ? 'تشغيل' : 'Play')}
          >
            {isBuffering ? (
              <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 md:w-7 md:h-7 fill-current" />
            ) : (
              <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ltr:ml-1 rtl:mr-1" />
            )}
          </button>
          
          <div className="flex flex-col">
            <span className="font-bold text-sm md:text-base text-foreground line-clamp-1">
              {isArabic
                ? `سورة ${surahs[surahNumber - 1]?.name} - آية ${playingAyah ?? selectedAyah}`
                : `Surah ${surahs[surahNumber - 1]?.name} - Ayah ${playingAyah ?? selectedAyah}`}
            </span>
            
            {isPausedBetween ? (
               <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{isArabic ? 'توقف...' : 'Pause...'}</span>
               </div>
            ) : (
               <span className="text-xs font-semibold text-muted-foreground line-clamp-1">
                 {reciterCatalog.isLoading
                   ? (isArabic ? 'تحميل القارئ…' : 'Loading reciter…')
                   : selectedReciter?.name ?? (isArabic ? 'القارئ غير متاح' : 'Reciter unavailable')}
               </span>
            )}
            
            {error && (
              <span className="text-xs font-bold text-destructive flex items-center gap-1 mt-0.5">
                {isArabic ? 'تعذر تحميل الصوت' : 'Failed to load audio'}
                <button onClick={() => { setError(false); setIsBuffering(true); audioRef.current?.load(); audioRef.current?.play(); }} className="underline ml-1">
                  <RefreshCw className="w-3 h-3 inline" />
                </button>
              </span>
            )}
            
            {!error && !isPausedBetween && playingAyah && (effectiveRepeat === 'continuous' || effectiveRepeat > 1) && (
              <span className="text-[10px] text-muted-foreground font-semibold mt-0.5 flex gap-2">
                 {effectiveScope === 'ayah' 
                   ? (isArabic ? `الآية: ${currentAyahPlayCount} من ${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}` : `Ayah: ${currentAyahPlayCount}/${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}`)
                   : (isArabic ? `النطاق: ${currentRangePlayCount} من ${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}` : `Range: ${currentRangePlayCount}/${effectiveRepeat === 'continuous' ? '∞' : effectiveRepeat}`)
                 }
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 justify-center" dir="ltr">
          <button 
            onClick={handlePrev} 
            disabled={!playingAyah || getPrevAyah(playingAyah, effectiveStart) === null}
            className="p-2 md:p-3 rounded-full hover:bg-muted text-foreground disabled:opacity-30 transition-colors"
            title={isArabic ? 'الآية السابقة' : 'Previous Ayah'}
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>
          <button 
            onClick={handleStop}
            disabled={!playingAyah && !isPlaying}
            className="p-2 md:p-3 rounded-full hover:bg-muted text-foreground disabled:opacity-30 transition-colors"
            title={isArabic ? 'إيقاف' : 'Stop'}
          >
            <Square className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          </button>
          <button 
            onClick={handleNext} 
            disabled={!playingAyah}
            className="p-2 md:p-3 rounded-full hover:bg-muted text-foreground disabled:opacity-30 transition-colors"
            title={isArabic ? 'الآية التالية' : 'Next Ayah'}
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>
        </div>

        <div className="flex items-center justify-end flex-1 gap-1">
          {memoSession && (
             <button 
               onClick={() => setActiveTab(activeTab === 'memo' ? 'none' : 'memo')}
               className={cn(
                 "p-2 md:p-3 rounded-full transition-colors hidden md:block",
                 activeTab === 'memo' ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "hover:bg-muted text-foreground"
               )}
               title={isArabic ? 'جلسة الحفظ' : 'Memo Session'}
             >
               <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
             </button>
          )}
          <button 
             onClick={() => {
               const isOpening = activeTab !== 'settings';
               setActiveTab(isOpening ? 'settings' : 'none');
               if (isOpening) void reciterCatalog.refetch();
             }}
            className={cn(
              "p-2 md:p-3 rounded-full transition-colors",
              activeTab === 'settings' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "hover:bg-muted text-foreground"
            )}
            title={isArabic ? 'إعدادات القراءة' : 'Audio Settings'}
          >
            <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
