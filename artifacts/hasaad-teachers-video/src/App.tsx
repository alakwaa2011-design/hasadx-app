import { useEffect, useRef, useState } from 'react';
import VideoWithControls from '@/components/video/VideoWithControls';

export default function App() {
  const [media, setMedia] = useState<'loading' | 'ready' | 'error'>('loading');
  const [muted, setMuted] = useState(false);
  const [preloadMuted, setPreloadMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    // Let the SAME audio element play through a silent 2-second preroll before
    // the scene clock mounts. Seeking back to zero stalls the decoder again.
    const audio = audioRef.current;
    if (!audio) return;
    let warmed = false;
    const ready = () => {
      if (warmed) return;
      warmed = true;
      window.clearTimeout(timeout);
      audio.removeEventListener('timeupdate', warm);
      setMedia('ready');
    };
    const failed = () => setMedia('error');
    const timeout = window.setTimeout(failed, 12000);
    const warm = () => { if (audio.currentTime >= 2) ready(); };
    const start = () => audio.play().catch(() => {
      // Browsers without audible-autoplay permission can still start silently.
      // The preview's volume control lets the viewer enable sound by clicking.
      setPreloadMuted(true);
      window.requestAnimationFrame(() => audio.play().catch(failed));
    });
    audio.addEventListener('timeupdate', warm);
    audio.addEventListener('canplay', start, { once: true });
    audio.addEventListener('error', failed, { once: true });
    audio.load();
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) start();
    return () => {
      window.clearTimeout(timeout);
      audio.removeEventListener('timeupdate', warm);
      audio.removeEventListener('canplay', start);
      audio.removeEventListener('error', failed);
      audio.pause();
    };
  }, []);
  return (
    <>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}audio/final-mix.mp3`} preload="auto" muted={preloadMuted || muted} />
      {media === 'error'
        ? <main dir="rtl" style={{ background: '#fbf7ef', color: '#225739', minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Cairo' }}>تعذّر تحميل صوت الإعلان. أعد فتح المعاينة.</main>
        : media === 'loading'
          ? <main dir="rtl" style={{ background: '#fbf7ef', color: '#225739', minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Cairo', fontWeight: 700 }}>جارٍ تجهيز الإعلان…</main>
          : <VideoWithControls audioRef={audioRef} muted={preloadMuted || muted} onMutedChange={next => { setPreloadMuted(false); setMuted(next); }} />}
    </>
  );
}
