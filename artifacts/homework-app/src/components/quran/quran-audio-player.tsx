import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Settings2, Loader2, Volume2, Repeat, Zap, RefreshCw, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { QuranSurahParsed } from '@/lib/quran-parser';
import { getNextAyah, getPrevAyah, clampAyah } from '@/lib/quran-audio-logic';
import {
  getListQuranRecitersQueryKey,
  useListQuranReciters,
  useUpdateQuranAudioPreference,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
}

const SPEEDS = [0.75, 1, 1.25];
const REPEATS = [1, 3, 5, 10];

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
  const [currentPlay, setCurrentPlay] = useState(1);
  
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const surahLength = surahs[surahNumber - 1]?.ayahs.length || 0;

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

  // Defense in depth: Never accept an out-of-range ayah
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
    if (playingAyah && isPlaying) {
      setIsBuffering(true);
      setError(false);
      // Let React update the src first
      setTimeout(() => {
        if (!audioRef.current) return;
        audioRef.current.playbackRate = speed;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            if (e.name !== 'AbortError') {
              setError(true);
              onIsPlayingChange(false);
            }
            setIsBuffering(false);
          });
        }
      }, 0);
    } else if (!isPlaying) {
      audioRef.current?.pause();
    }
  }, [playingAyah, recitationId, isPlaying, speed, onIsPlayingChange]);

  useEffect(() => {
    setCurrentPlay(1);
  }, [playingAyah]);

  useEffect(() => {
    return () => {
      onIsPlayingChange(false);
    };
  }, [onIsPlayingChange]);

  const handleEnded = () => {
    if (!playingAyah) return;
    const { nextAyah, nextPlay } = getNextAyah(playingAyah, surahLength, startAyah, endAyah, currentPlay, repeat);
    
    if (nextAyah !== null) {
      setCurrentPlay(nextPlay);
      if (nextAyah !== playingAyah) {
        onPlayingAyahChange(nextAyah);
      } else {
        audioRef.current?.play().catch(() => setError(true));
      }
    } else {
      onIsPlayingChange(false);
      onPlayingAyahChange(null);
      setCurrentPlay(1);
    }
  };

  const handlePrev = () => {
    if (!playingAyah) return;
    const prev = getPrevAyah(playingAyah, startAyah);
    if (prev !== null) {
      onPlayingAyahChange(prev);
      setCurrentPlay(1);
      if (!isPlaying) onIsPlayingChange(true);
    }
  };

  const handleNext = () => {
    if (!playingAyah) return;
    const { nextAyah } = getNextAyah(playingAyah, surahLength, startAyah, endAyah, repeat, repeat);
    if (nextAyah !== null) {
      onPlayingAyahChange(nextAyah);
      setCurrentPlay(1);
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
    return `${item.name} ${item.style ?? ''}`.toLocaleLowerCase(isArabic ? 'ar' : 'en').includes(query);
  }) ?? [];
  const audioSrc = playingAyah && selectedReciter
    ? `/api/quran/audio/${selectedReciter.id}/${surahNumber}/${playingAyah}`
    : undefined;

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
      onPlayingAyahChange(clampAyah(selectedAyah, startAyah, endAyah) ?? startAyah ?? 1);
      onIsPlayingChange(true);
    } else {
      onIsPlayingChange(!isPlaying);
    }
  };

  const handleStop = () => {
    onIsPlayingChange(false);
    onPlayingAyahChange(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-border p-3 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] w-full shrink-0 flex flex-col gap-2 transition-colors">
      {onClose && (
        <div className="flex h-7 shrink-0 items-center justify-start">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={isArabic ? "إغلاق مشغل الآية" : "Close ayah player"}
            aria-label={isArabic ? "إغلاق مشغل الآية" : "Close ayah player"}
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
          onPlay={() => { setIsBuffering(false); setError(false); }}
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

      {showSettings && (
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
                    {filteredReciters.length ? filteredReciters.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={savePreference.isPending}
                        onClick={() => void selectReciter(item.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start transition-colors disabled:opacity-60',
                          item.id === recitationId
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                            : 'hover:bg-muted',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{item.name}</span>
                          {item.style && <span className="block truncate text-xs opacity-70">{item.style}</span>}
                        </span>
                        {savePreference.isPending && item.id === recitationId && (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        )}
                      </button>
                    )) : (
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
                    onClick={() => { setRepeat(r); setCurrentPlay(1); }}
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
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 shrink-0"
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
            <span className="text-xs font-semibold text-muted-foreground line-clamp-1">
              {reciterCatalog.isLoading
                ? (isArabic ? 'تحميل القارئ…' : 'Loading reciter…')
                : selectedReciter?.name ?? (isArabic ? 'القارئ غير متاح' : 'Reciter unavailable')}
            </span>
            {error && (
              <span className="text-xs font-bold text-destructive flex items-center gap-1">
                {isArabic ? 'تعذر تحميل الصوت' : 'Failed to load audio'}
                <button onClick={() => { setError(false); setIsBuffering(true); audioRef.current?.load(); audioRef.current?.play(); }} className="underline ml-1">
                  <RefreshCw className="w-3 h-3 inline" />
                </button>
              </span>
            )}
            {!error && playingAyah && repeat > 1 && (
              <span className="text-xs text-muted-foreground font-semibold">
                {isArabic ? `التكرار: ${currentPlay} من ${repeat}` : `Repeat: ${currentPlay} of ${repeat}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 justify-center" dir="ltr">
          <button 
            onClick={handlePrev} 
            disabled={!playingAyah || getPrevAyah(playingAyah, startAyah) === null}
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
            disabled={!playingAyah || getNextAyah(playingAyah, surahLength, startAyah, endAyah, repeat, repeat).nextAyah === null}
            className="p-2 md:p-3 rounded-full hover:bg-muted text-foreground disabled:opacity-30 transition-colors"
            title={isArabic ? 'الآية التالية' : 'Next Ayah'}
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>
        </div>

        <div className="flex items-center justify-end flex-1">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            aria-expanded={showSettings}
            aria-controls="quran-audio-settings"
            className={cn(
              "p-2 md:p-3 rounded-full transition-colors",
              showSettings ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "hover:bg-muted text-foreground"
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
