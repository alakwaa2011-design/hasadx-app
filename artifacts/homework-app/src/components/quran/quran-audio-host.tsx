import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Pause, Play, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import chapters from "@/data/quran/qcomplex/chapters.json";

interface QuranAudioHostValue {
  audioRef: RefObject<HTMLAudioElement | null>;
  playback: QuranAudioPlaybackState;
  setPlayback: (state: QuranAudioPlaybackState) => void;
  setSession: (session: QuranAudioSession | null) => void;
  setControllerAttached: (attached: boolean) => void;
  advanceBoundary: () => void;
}

export interface QuranAudioPlaybackState {
  active: boolean;
  isPlaying: boolean;
  surahNumber: number | null;
  ayahNumber: number | null;
}

export interface QuranAudioSession {
  recitationId: number;
  surahNumber: number;
  ayahNumber: number;
  surahLength: number;
  endAyah: number | null;
  unrestricted: boolean;
  sourceMode: "ayah" | "chapter";
  speed: number;
  /**
   * The view/controller owns ayah-level repeat and timing policy.  The host
   * invokes this only for an ended recording that does not cross a surah
   * boundary; the media element event is still consumed by the host.
   */
  onAyahEnded?: () => void;
  onPlaybackLocationChange?: (surahNumber: number, ayahNumber: number) => void;
}

const QuranAudioHostContext = createContext<QuranAudioHostValue | null>(null);

export function QuranAudioHostProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playback, setPlayback] = useState<QuranAudioPlaybackState>({
    active: false, isPlaying: false, surahNumber: null, ayahNumber: null,
  });
  const [controllerAttached, setControllerAttachedState] = useState(false);
  const sessionRef = useRef<QuranAudioSession | null>(null);
  const sourceEpochRef = useRef(0);
  const transitionIdRef = useRef(0);
  const boundaryLockedRef = useRef(false);
  const unlockSourceRef = useRef<string | null>(null);
  const unlockAtSecondsRef = useRef(0);
  const setSession = useCallback((session: QuranAudioSession | null) => {
    sessionRef.current = session;
  }, []);
  // The host still owns the audio element and media events. This flag only
  // suppresses its floating fallback controls while the full reader controls
  // are mounted, including when the reader is embedded under a non-Quran URL.
  const setControllerAttached = useCallback((attached: boolean) => {
    setControllerAttachedState(attached);
  }, []);
  const advanceBoundary = useCallback(async () => {
    const audio = audioRef.current;
    const session = sessionRef.current;
    if (!audio || !session || boundaryLockedRef.current) return;
    const transitionId = ++transitionIdRef.current;

    if (session.sourceMode === "ayah") {
      const nextAyah = session.ayahNumber < (session.endAyah ?? session.surahLength)
        ? session.ayahNumber + 1
        : (session.unrestricted && session.surahNumber < 114 ? 1 : null);
      const nextSurah = nextAyah === 1 && session.ayahNumber >= (session.endAyah ?? session.surahLength)
        ? session.surahNumber + 1
        : session.surahNumber;
      if (nextAyah && nextSurah === session.surahNumber) {
        session.onAyahEnded?.();
        return;
      }
      if (!nextAyah) {
        sessionRef.current = null;
        setPlayback({ active: false, isPlaying: false, surahNumber: null, ayahNumber: null });
        return;
      }
      boundaryLockedRef.current = true;
      const epoch = ++sourceEpochRef.current;
      const nextSource = `/api/quran/audio/${session.recitationId}/${nextSurah}/${nextAyah}`;
      audio.src = nextSource;
      audio.load();
      audio.playbackRate = session.speed;
      unlockSourceRef.current = new URL(nextSource, window.location.href).href;
      unlockAtSecondsRef.current = 0.25;
      const nextSurahLength = chapters[nextSurah - 1]?.verse_count ?? session.surahLength;
      sessionRef.current = {
        ...session,
        surahNumber: nextSurah,
        ayahNumber: nextAyah,
        surahLength: nextSurahLength,
      };
      try {
        await audio.play();
        if (sourceEpochRef.current !== epoch || transitionIdRef.current !== transitionId) return;
        audio.currentTime = 0;
        setPlayback({ active: true, isPlaying: true, surahNumber: nextSurah, ayahNumber: nextAyah });
        session.onPlaybackLocationChange?.(nextSurah, nextAyah);
      } catch {
        if (sourceEpochRef.current === epoch && transitionIdRef.current === transitionId) {
          boundaryLockedRef.current = false;
          unlockSourceRef.current = null;
          setPlayback(current => ({ ...current, isPlaying: false }));
        }
      }
      return;
    }

    if (!session.unrestricted || session.surahNumber >= 114) {
      sessionRef.current = null;
      setPlayback({ active: false, isPlaying: false, surahNumber: null, ayahNumber: null });
      return;
    }

    try {
      boundaryLockedRef.current = true;
      const response = await fetch(`/api/quran/audio/${session.recitationId}/${session.surahNumber + 1}/1/timings`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("timings unavailable");
      const timing = await response.json() as {
        audioUrl?: string;
        audio_url?: string;
        verseStartMs?: number;
      };
      const nextSource = timing.audioUrl ?? timing.audio_url;
      if (!nextSource) throw new Error("audio unavailable");
      if (transitionIdRef.current !== transitionId || sessionRef.current !== session) return;
      const epoch = ++sourceEpochRef.current;
      const nextSurah = session.surahNumber + 1;
      const nextStartSeconds = Math.max(0, (timing.verseStartMs ?? 0) / 1000);
      audio.src = nextSource;
      audio.load();
      audio.playbackRate = session.speed;
      unlockSourceRef.current = new URL(nextSource, window.location.href).href;
      unlockAtSecondsRef.current = nextStartSeconds + 0.25;
      sessionRef.current = {
        ...session,
        surahNumber: nextSurah,
        ayahNumber: 1,
        surahLength: chapters[nextSurah - 1]?.verse_count ?? session.surahLength,
      };
      try {
        await audio.play();
        if (sourceEpochRef.current !== epoch || transitionIdRef.current !== transitionId) return;
        audio.currentTime = nextStartSeconds;
        setPlayback({ active: true, isPlaying: true, surahNumber: nextSurah, ayahNumber: 1 });
        session.onPlaybackLocationChange?.(nextSurah, 1);
      } catch {
        if (sourceEpochRef.current === epoch && transitionIdRef.current === transitionId) {
          boundaryLockedRef.current = false;
          unlockSourceRef.current = null;
          setPlayback(current => ({ ...current, isPlaying: false }));
        }
      }
    } catch {
      if (transitionIdRef.current !== transitionId) return;
      boundaryLockedRef.current = false;
      unlockSourceRef.current = null;
      sessionRef.current = null;
      setPlayback({ active: false, isPlaying: false, surahNumber: null, ayahNumber: null });
    }
  }, []);
  const { lang } = useI18n();
  const [location] = useLocation();
  const isQuranRoute = location.includes("quran");
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const setPlaying = () => setPlayback(current => ({ ...current, isPlaying: true }));
    const setPaused = () => setPlayback(current => ({ ...current, isPlaying: false }));
    const unlockBoundaryAfterRealProgress = () => {
      if (
        boundaryLockedRef.current
        && unlockSourceRef.current
        && audio.src === unlockSourceRef.current
        && audio.currentTime >= unlockAtSecondsRef.current
      ) {
        boundaryLockedRef.current = false;
        unlockSourceRef.current = null;
      }
    };
    audio.addEventListener("play", setPlaying);
    audio.addEventListener("pause", setPaused);
    audio.addEventListener("timeupdate", unlockBoundaryAfterRealProgress);
    return () => {
      audio.removeEventListener("play", setPlaying);
      audio.removeEventListener("pause", setPaused);
      audio.removeEventListener("timeupdate", unlockBoundaryAfterRealProgress);
    };
  }, []);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const mediaSession = navigator.mediaSession;
    mediaSession.metadata = new MediaMetadata({
      title: playback.ayahNumber
        ? `${lang === "ar" ? "الآية" : "Ayah"} ${playback.ayahNumber} · ${lang === "ar" ? "السورة" : "Surah"} ${playback.surahNumber}`
        : (lang === "ar" ? "تلاوة القرآن" : "Quran recitation"),
      artist: lang === "ar" ? "قارئ القرآن" : "Quran reciter",
      album: lang === "ar" ? "إسلاميات حصاد" : "Hasaad Islamic",
    });
    mediaSession.playbackState = playback.isPlaying ? "playing" : "paused";
    const next = () => {
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration)) audio.currentTime = audio.duration;
    };
    const previous = () => {
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    mediaSession.setActionHandler("play", () => { void audioRef.current?.play(); });
    mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    mediaSession.setActionHandler("nexttrack", next);
    mediaSession.setActionHandler("previoustrack", previous);
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]) {
        try { mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [lang, playback.ayahNumber, playback.isPlaying, playback.surahNumber]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = (event: Event) => {
      const handledEvent = event as Event & { __hasaadQuranHandled?: boolean };
      if (handledEvent.__hasaadQuranHandled) return;
      handledEvent.__hasaadQuranHandled = true;
      void advanceBoundary();
    };
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [advanceBoundary]);
  return (
    <QuranAudioHostContext.Provider value={{ audioRef, playback, setPlayback, setSession, setControllerAttached, advanceBoundary }}>
      {children}
      <audio ref={audioRef} className="hidden" aria-hidden="true" />
      {playback.active && !isQuranRoute && !controllerAttached && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-emerald-200/70 bg-background/95 p-3 shadow-2xl backdrop-blur-xl dark:border-emerald-900/60">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-foreground">
              {lang === "ar" ? "تلاوة القرآن" : "Quran recitation"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {lang === "ar"
                ? `السورة ${playback.surahNumber ?? "—"} · الآية ${playback.ayahNumber ?? "—"}`
                : `Surah ${playback.surahNumber ?? "—"} · Ayah ${playback.ayahNumber ?? "—"}`}
            </p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-white" onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (audio.paused) void audio.play();
            else audio.pause();
          }} aria-label={playback.isPlaying ? "Pause Quran" : "Play Quran"}>
            {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.pause();
            audio.currentTime = 0;
            sessionRef.current = null;
            setPlayback({ active: false, isPlaying: false, surahNumber: null, ayahNumber: null });
          }} aria-label="Stop Quran">
            <Square className="h-4 w-4" />
          </button>
        </div>
      )}
    </QuranAudioHostContext.Provider>
  );
}

export function useQuranAudioHost() {
  const value = useContext(QuranAudioHostContext);
  if (!value) throw new Error("useQuranAudioHost must be used inside QuranAudioHostProvider");
  return value;
}