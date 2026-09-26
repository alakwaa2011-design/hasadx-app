import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Pause, Play, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import chapters from "@/data/quran/qcomplex/chapters.json";
import { GaplessAyahAudio } from "./gapless-ayah-audio";

interface QuranAudioHostValue {
  audioRef: RefObject<HTMLAudioElement | null>;
  playback: QuranAudioPlaybackState;
  setPlayback: (state: QuranAudioPlaybackState) => void;
  setSession: (session: QuranAudioSession | null) => void;
  setControllerAttached: (attached: boolean) => void;
  advanceBoundary: () => void;
  gapless: () => GaplessAyahAudio | null;
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
  onPlaybackStateChange?: (playing: boolean) => void;
}

const QuranAudioHostContext = createContext<QuranAudioHostValue | null>(null);

export function QuranAudioHostProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const gaplessRef = useRef<GaplessAyahAudio | null>(null);
  const gapless = useCallback(() => {
    if (!audioRef.current) return null;
    return gaplessRef.current ??= new GaplessAyahAudio(audioRef.current);
  }, []);
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
  const samePlaybackLocation = (
    current: QuranAudioSession | null,
    expected: QuranAudioSession,
  ): current is QuranAudioSession => Boolean(
    current
    && current.recitationId === expected.recitationId
    && current.surahNumber === expected.surahNumber
    && current.ayahNumber === expected.ayahNumber,
  );
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
      const engine = gaplessRef.current;
      if (engine?.active) {
        const bufferedSource = `${nextSource}/buffer`;
        const nextSurahLength = chapters[nextSurah - 1]?.verse_count ?? session.surahLength;
        sessionRef.current = { ...session, surahNumber: nextSurah, ayahNumber: nextAyah, surahLength: nextSurahLength };
        try {
          await engine.play(bufferedSource, session.speed, () => sessionRef.current?.onAyahEnded?.());
          if (sourceEpochRef.current !== epoch || transitionIdRef.current !== transitionId) return;
          boundaryLockedRef.current = false;
          setPlayback({ active: true, isPlaying: true, surahNumber: nextSurah, ayahNumber: nextAyah });
          session.onPlaybackLocationChange?.(nextSurah, nextAyah);
        } catch {
          boundaryLockedRef.current = false;
          engine.stop();
          setPlayback({ active: false, isPlaying: false, surahNumber: null, ayahNumber: null });
        }
        return;
      }
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
      if (transitionIdRef.current !== transitionId) return;
      const latestSession = sessionRef.current;
      if (!samePlaybackLocation(latestSession, session)) {
        boundaryLockedRef.current = false;
        unlockSourceRef.current = null;
        return;
      }
      const epoch = ++sourceEpochRef.current;
      const nextSurah = session.surahNumber + 1;
      // Chapter recordings include the basmalah before the first timed ayah
      // (except At-Tawbah, whose recording starts directly with ayah 1).
      // Starting at verseStartMs silently skipped that introduction.
      const nextStartSeconds = nextSurah === 9
        ? Math.max(0, (timing.verseStartMs ?? 0) / 1000)
        : 0;
      audio.autoplay = true;
      audio.src = nextSource;
      audio.load();
      audio.playbackRate = session.speed;
      unlockSourceRef.current = new URL(nextSource, window.location.href).href;
      unlockAtSecondsRef.current = nextStartSeconds + 0.25;
      sessionRef.current = {
        ...latestSession,
        surahNumber: nextSurah,
        ayahNumber: 1,
        surahLength: chapters[nextSurah - 1]?.verse_count ?? session.surahLength,
      };
      try {
        await audio.play();
        if (sourceEpochRef.current !== epoch || transitionIdRef.current !== transitionId) return;
        audio.currentTime = nextStartSeconds;
        setPlayback({ active: true, isPlaying: true, surahNumber: nextSurah, ayahNumber: 1 });
        latestSession.onPlaybackLocationChange?.(nextSurah, 1);
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
      if (gaplessRef.current?.active) {
        gaplessRef.current.pause();
        sessionRef.current?.onAyahEnded?.();
        return;
      }
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration)) audio.currentTime = audio.duration;
    };
    const previous = () => {
      if (gaplessRef.current?.active) {
        const session = sessionRef.current;
        if (session) {
          gaplessRef.current.stop();
          void gaplessRef.current.play(
            `/api/quran/audio/${session.recitationId}/${session.surahNumber}/${session.ayahNumber}/buffer`,
            session.speed, () => sessionRef.current?.onAyahEnded?.(),
          ).catch(() => setPlayback(current => ({ ...current, isPlaying: false })));
        }
        return;
      }
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    mediaSession.setActionHandler("play", () => {
      if (gaplessRef.current?.active) {
        void gaplessRef.current.resume().catch(error => {
          if ((error as Error).name !== "AbortError") setPlayback(current => ({ ...current, isPlaying: false }));
        });
        sessionRef.current?.onPlaybackStateChange?.(true);
      }
      else void audioRef.current?.play().catch(() => undefined);
    });
    mediaSession.setActionHandler("pause", () => {
      if (gaplessRef.current?.active) {
        gaplessRef.current.pause();
        sessionRef.current?.onPlaybackStateChange?.(false);
      }
      else audioRef.current?.pause();
    });
    mediaSession.setActionHandler("nexttrack", next);
    mediaSession.setActionHandler("previoustrack", previous);
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]) {
        try { mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [advanceBoundary, lang, playback.ayahNumber, playback.isPlaying, playback.surahNumber]);
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
    <QuranAudioHostContext.Provider value={{ audioRef, playback, setPlayback, setSession, setControllerAttached, advanceBoundary, gapless }}>
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
            if (gaplessRef.current?.active) {
              if (gaplessRef.current.isPlaying) {
                gaplessRef.current.pause();
                sessionRef.current?.onPlaybackStateChange?.(false);
              } else {
                void gaplessRef.current.resume().catch(() => setPlayback(current => ({ ...current, isPlaying: false })));
                sessionRef.current?.onPlaybackStateChange?.(true);
              }
            } else if (audio.paused) void audio.play().catch(() => undefined);
            else audio.pause();
          }} aria-label={playback.isPlaying ? "Pause Quran" : "Play Quran"}>
            {playback.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted" onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.pause();
            gaplessRef.current?.stop();
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