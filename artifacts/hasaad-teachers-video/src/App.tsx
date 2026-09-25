import { useCallback, useEffect, useRef, useState } from 'react';
import VideoWithControls from '@/components/video/VideoWithControls';
import './audio-gate.css';

export default function App() {
  const [media, setMedia] = useState<'loading' | 'gesture' | 'ready' | 'error'>('loading');
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const attemptRef = useRef(0);
  const warmRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const beginPlayback = useCallback((retry = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const attempt = ++attemptRef.current;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    setMedia('loading');
    if (retry && audio.error) audio.load();
    // Must be called directly from the tap handler on iOS, with no await,
    // animation frame, or React effect between the gesture and play().
    try {
      audio.play().catch(() => {
        if (attemptRef.current === attempt && !warmRef.current) {
          if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
          setMedia(audio.error ? 'error' : 'gesture');
        }
      });
    } catch {
      if (attemptRef.current === attempt) setMedia(audio.error ? 'error' : 'gesture');
    }
    timeoutRef.current = window.setTimeout(() => {
      if (attemptRef.current === attempt && !warmRef.current) setMedia('gesture');
    }, 12000);
  }, []);

  useEffect(() => {
    // Let the SAME audio element play through a silent 2-second preroll before
    // the scene clock mounts. Seeking back to zero stalls the decoder again.
    const audio = audioRef.current;
    if (!audio) return;
    const warm = () => {
      if (warmRef.current || audio.paused || audio.currentTime < 2) return;
      warmRef.current = true;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setMedia('ready');
    };
    const failed = () => {
      if (warmRef.current) return;
      ++attemptRef.current;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      setMedia('error');
    };
    audio.addEventListener('timeupdate', warm);
    audio.addEventListener('error', failed);
    audio.load();
    beginPlayback();
    return () => {
      ++attemptRef.current;
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      audio.removeEventListener('timeupdate', warm);
      audio.removeEventListener('error', failed);
      audio.pause();
    };
  }, [beginPlayback]);

  const watchSilently = () => {
    ++attemptRef.current;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    warmRef.current = true;
    setMuted(true);
    setMedia('ready');
  };

  return (
    <>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/final-mix.mp3`} preload="auto" muted={muted} />
      {media === 'ready' ? (
        <VideoWithControls audioRef={audioRef} muted={muted} onMutedChange={setMuted} />
      ) : (
        <main className="audio-gate" dir="rtl">
          <div className="audio-gate-card">
            <span className="audio-gate-brand">حصاد</span>
            <span className="audio-gate-kicker">إعلان للمعلمين · 50 ثانية</span>
            <h1>{media === 'error' ? 'تعذّر تحميل الصوت' : 'درس الغد؟ لا تبدأ من الصفر.'}</h1>
            <p>
              {media === 'error'
                ? 'تحقّق من اتصالك ثم أعد المحاولة، أو شاهد الإعلان بدون صوت.'
                : media === 'gesture'
                  ? 'لتسمع التعليق الصوتي على هاتفك، اضغط تشغيل الإعلان.'
                  : 'جارٍ تجهيز الإعلان… يمكنك الضغط لتشغيله الآن.'}
            </p>
            <button className="audio-gate-play" type="button" onClick={() => beginPlayback(media === 'error')}>
              <span aria-hidden="true">▶</span>
              {media === 'error' ? 'إعادة تحميل الصوت' : 'تشغيل الإعلان بالصوت'}
            </button>
            <button className="audio-gate-silent" type="button" onClick={watchSilently}>
              مشاهدة بدون صوت
            </button>
          </div>
        </main>
      )}
    </>
  );
}
