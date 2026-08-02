/**
 * AudioPlayer — unified audio playback for question play screens.
 *
 * - Attempts auto-play as soon as audio is ready (succeeds when user has
 *   already interacted with the page, e.g. clicking to start the quiz).
 * - Falls back to a prominent play button if auto-play is blocked.
 * - Shows an error if the audio file can't be loaded.
 * - Handles two source types:
 *     "yt:VIDEO_ID"  → hidden YouTube IFrame Player (audio only)
 *     any other URL  → native <audio> element
 */
import { useState, useRef, useEffect } from "react";

const BASE = import.meta.env.VITE_API_URL || "";

// YouTube IFrame API — typed loosely to avoid conflicts with other declarations.
type _YTPlayer = {
  playVideo(): void; pauseVideo(): void;
  seekTo(s: number, a: boolean): void; destroy(): void;
};
function _ytWin() {
  return window as unknown as {
    YT?: { Player: new (...a: unknown[]) => _YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  };
}

function resolveUrl(src: string): string {
  if (!src || src.startsWith("yt:") || src.startsWith("http") || src.startsWith("blob:")) return src;
  // Object-storage paths (/objects/...) are served by the API server at /api/objects/...
  if (src.startsWith("/objects/") || src.startsWith("objects/")) {
    const clean = src.startsWith("/") ? src : `/${src}`;
    return `${BASE}/api${clean}`;
  }
  return `${BASE}${src.startsWith("/") ? "" : "/"}${src}`;
}

/* ─── Shared control UI ───────────────────────────────────────────────────── */
function Controls({
  playing, ready, error, autoPlaying, listenCount,
  onPlay, onPause, onReplay,
}: {
  playing: boolean; ready: boolean; error: boolean; autoPlaying: boolean;
  listenCount?: number;
  onPlay(): void; onPause(): void; onReplay(): void;
}) {
  if (error) {
    return (
      <div style={{
        padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5",
        borderRadius: 12, color: "#b91c1c", fontSize: 13, fontWeight: 600, textAlign: "center",
      }}>
        ⚠️ تعذّر تحميل الملف الصوتي — تحقق من الاتصال بالإنترنت
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{
        padding: "12px 16px", background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.15)",
        borderRadius: 12, color: "#92400e", fontSize: 13, textAlign: "center",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
        جاري تحميل الصوت…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(180,83,9,0.07)", border: "1px solid rgba(180,83,9,0.2)",
      borderRadius: 14, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Status banner when auto-playing */}
      {playing && (
        <div style={{
          background: "linear-gradient(135deg,#fcd34d,#f59e0b)",
          borderRadius: 8, padding: "6px 12px", textAlign: "center",
          fontSize: 13, fontWeight: 700, color: "#1c0f00",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <span style={{ animation: "pulse 1s ease-in-out infinite" }}>🔊</span>
          يُشغَّل الآن…
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
      )}

      {/* Main controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!playing ? (
          <button
            onClick={onPlay}
            style={{
              flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "inherit",
              boxShadow: "0 4px 14px rgba(217,119,6,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            ▶ تشغيل الصوت
          </button>
        ) : (
          <button
            onClick={onPause}
            style={{
              flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "rgba(180,83,9,0.15)", color: "#92400e",
              fontWeight: 800, fontSize: 15, fontFamily: "inherit",
            }}
          >
            ⏸ إيقاف
          </button>
        )}
        <button
          onClick={onReplay}
          style={{
            padding: "12px 16px", borderRadius: 10, border: "1.5px solid rgba(180,83,9,0.3)",
            background: "transparent", color: "#92400e",
            fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
          }}
        >
          ↻ إعادة
        </button>
      </div>

      {/* Listen penalty notice */}
      {listenCount !== undefined && listenCount > 1 && (
        <div style={{
          fontSize: 12, color: "#d97706", fontWeight: 700,
          background: "#fef3c7", borderRadius: 8, padding: "6px 10px", textAlign: "center",
        }}>
          🔊 استماع رقم {listenCount} — خصم ثانيتين من الوقت
        </div>
      )}
    </div>
  );
}

/* ─── YouTube hidden player ───────────────────────────────────────────────── */
function YouTubeAudioPlayer({
  videoId, onListen, listenCount,
}: { videoId: string; onListen?(): void; listenCount?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef    = useRef<_YTPlayer | null>(null);
  const [ready,   setReady]   = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error,   setError]   = useState(false);
  const mounted = useRef(true);
  const listenedOnce = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const ytWin = _ytWin();

    function buildPlayer() {
      if (!containerRef.current || !mounted.current) return;
      try {
        playerRef.current = new ytWin.YT!.Player(containerRef.current, {
          width: "1", height: "1",
          videoId,
          playerVars: { controls: 0, playsinline: 1, rel: 0, autoplay: 1 },
          events: {
            onReady: () => {
              if (!mounted.current) return;
              setReady(true);
              // auto-play attempt
              try {
                (playerRef.current as _YTPlayer).playVideo();
                if (!listenedOnce.current) { listenedOnce.current = true; onListen?.(); }
              } catch { /* blocked */ }
            },
            onStateChange: (e: { data: number }) => {
              if (!mounted.current) return;
              setPlaying(e.data === 1);
            },
            onError: () => { if (mounted.current) setError(true); },
          },
        });
      } catch { setError(true); }
    }

    if (ytWin.YT?.Player) {
      buildPlayer();
    } else {
      const prev = ytWin.onYouTubeIframeAPIReady;
      ytWin.onYouTubeIframeAPIReady = () => { prev?.(); buildPlayer(); };
      if (!document.getElementById("yt-iframe-api-script")) {
        const s    = document.createElement("script");
        s.id       = "yt-iframe-api-script";
        s.src      = "https://www.youtube.com/iframe_api";
        s.onerror  = () => { if (mounted.current) setError(true); };
        document.head.appendChild(s);
      }
    }

    return () => {
      mounted.current = false;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
    };
  }, [videoId]);

  const p = playerRef.current as _YTPlayer | null;
  const play = () => { p?.playVideo(); if (!listenedOnce.current) { listenedOnce.current = true; onListen?.(); } else onListen?.(); };
  const pause  = () => p?.pauseVideo();
  const replay = () => { p?.seekTo(0, true); p?.playVideo(); onListen?.(); };

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} style={{
        position: "absolute", left: "-9999px", top: "-9999px", width: 1, height: 1,
      }} />
      <Controls playing={playing} ready={ready} error={error} autoPlaying={false}
        listenCount={listenCount} onPlay={play} onPause={pause} onReplay={replay} />
    </div>
  );
}

/* ─── Native <audio> player ──────────────────────────────────────────────── */
function NativeAudioPlayer({
  src, onListen, listenCount,
}: { src: string; onListen?(): void; listenCount?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [ready,   setReady]   = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error,   setError]   = useState(false);
  const listenedOnce = useRef(false);

  // Auto-play when ready
  useEffect(() => {
    if (!ready || !audioRef.current) return;
    audioRef.current.play()
      .then(() => {
        if (!listenedOnce.current) { listenedOnce.current = true; onListen?.(); }
      })
      .catch(() => { /* auto-play blocked by browser — user sees the button */ });
  }, [ready]);

  const play = () => {
    audioRef.current?.play().catch(() => {});
    onListen?.();
  };
  const pause  = () => audioRef.current?.pause();
  const replay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    onListen?.();
  };

  return (
    <div>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onCanPlay={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />
      <Controls playing={playing} ready={ready} error={error} autoPlaying={false}
        listenCount={listenCount} onPlay={play} onPause={pause} onReplay={replay} />
    </div>
  );
}

/** Extract a YouTube video ID from a full URL or a "yt:ID" token */
export function extractYtId(src: string): string | null {
  if (!src) return null;
  if (src.startsWith("yt:")) return src.slice(3);
  const m = src.match(/[?&]v=([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})|\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1] || m[2] || m[3];
  return null;
}

/* ─── Public export ───────────────────────────────────────────────────────── */
export default function AudioPlayer({
  src, onListen, listenCount,
}: {
  src: string;
  onListen?(): void;
  listenCount?: number;
}) {
  if (!src) return null;
  // Handle both "yt:VIDEO_ID" tokens and full YouTube URLs (legacy data)
  const ytId = extractYtId(src);
  if (ytId) {
    return <YouTubeAudioPlayer videoId={ytId} onListen={onListen} listenCount={listenCount} />;
  }
  return <NativeAudioPlayer src={resolveUrl(src)} onListen={onListen} listenCount={listenCount} />;
}
