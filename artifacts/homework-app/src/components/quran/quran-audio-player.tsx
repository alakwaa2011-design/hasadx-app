import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Settings2, Loader2, Volume2, Repeat, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { getGlobalAyahNumber, QuranSurahParsed } from '@/lib/quran-parser';
import { getNextAyah, getPrevAyah, clampAyah } from '@/lib/quran-audio-logic';

export interface QuranAudioPlayerProps {
  surahs: QuranSurahParsed[];
  surahNumber: number;
  startAyah: number | null;
  endAyah: number | null;
  playingAyah: number | null;
  onPlayingAyahChange: (ayah: number | null) => void;
  isPlaying: boolean;
  onIsPlayingChange: (playing: boolean) => void;
}

const RECITERS = [
  { id: 'ar.alafasy', name: 'مشاري العفاسي' },
  { id: 'ar.husary', name: 'محمود خليل الحصري' },
  { id: 'ar.minshawi', name: 'محمد صديق المنشاوي' },
  { id: 'ar.abdurrahmaansudais', name: 'عبدالرحمن السديس' },
];

const SPEEDS = [0.75, 1, 1.25];
const REPEATS = [1, 3, 5, 10];

export function QuranAudioPlayer({
  surahs,
  surahNumber,
  startAyah,
  endAyah,
  playingAyah,
  onPlayingAyahChange,
  isPlaying,
  onIsPlayingChange
}: QuranAudioPlayerProps) {
  const { lang } = useI18n();
  const isArabic = lang === 'ar';
  
  const [reciter, setReciter] = useState(() => localStorage.getItem('hasaad_quran_reciter') || 'ar.alafasy');
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(1);
  const [currentPlay, setCurrentPlay] = useState(1);
  
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const surahLength = surahs[surahNumber - 1]?.ayahs.length || 0;

  useEffect(() => {
    localStorage.setItem('hasaad_quran_reciter', reciter);
  }, [reciter]);

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
  }, [playingAyah, reciter, isPlaying]);

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

  const globalAyah = playingAyah ? getGlobalAyahNumber(surahs, surahNumber, playingAyah) : null;
  const audioSrc = globalAyah ? `https://cdn.islamic.network/quran/audio/128/${reciter}/${globalAyah}.mp3` : undefined;

  const togglePlay = () => {
    if (!playingAyah) {
      onPlayingAyahChange(startAyah ?? 1);
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
      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          onEnded={handleEnded} 
          onPlay={() => { setIsBuffering(false); setError(false); }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => { setError(true); setIsBuffering(false); onIsPlayingChange(false); }}
        />
      )}

      {showSettings && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl mb-1 text-sm border border-border/50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <select 
                value={reciter} 
                onChange={(e) => setReciter(e.target.value)}
                className="bg-background border-border border rounded-lg px-2 py-1 outline-none text-foreground font-semibold"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
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
              {playingAyah ? (isArabic ? `سورة ${surahs[surahNumber-1]?.name} - آية ${playingAyah}` : `Surah ${surahs[surahNumber-1]?.name} - Ayah ${playingAyah}`) : (isArabic ? 'جاهز للتشغيل' : 'Ready to play')}
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
