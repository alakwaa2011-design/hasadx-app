import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { getSocket } from "@/lib/socket";
import { SlideStage } from "@/lib/slide-render";
import { Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* Projector / "show" view. Anyone with the URL can watch (no auth);
   intended for a classroom screen connected to the teacher's laptop. */
export default function PresentationShow() {
  const params = useParams<{ sessionId: string }>();
  const sid = Number(params.sessionId);

  const [state, setState] = useState<any>(null);
  const [live, setLive] = useState<any>(null);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    fetch(`${API_BASE}/api/p/sessions/${sid}/state`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setState)
      .catch(() => {});
  }, [sid]);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    const s = getSocket();
    s.emit("show:join", { sessionId: sid });
    const onSync = (st: any) => setLive(st);
    const onSlide = ({ index, slide }: { index: number; slide: any }) =>
      setLive((p: any) => ({ ...(p ?? {}), currentSlideIndex: index, slide, activeElementId: null, activeElement: null, revealAnswer: false, revealDistribution: false }));
    const onOpened = ({ elementId, element }: any) =>
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: elementId, activeElement: element }));
    const onClosed = () =>
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: null, activeElement: null }));
    const onEnded = () => setLive((p: any) => ({ ...(p ?? {}), status: "ended" }));
    const onReconnect = () => s.emit("show:join", { sessionId: sid });
    s.on("state:sync", onSync);
    s.on("slide:changed", onSlide);
    s.on("activity:opened", onOpened);
    s.on("activity:closed", onClosed);
    s.on("session:ended", onEnded);
    s.on("connect", onReconnect);
    return () => {
      s.off("state:sync", onSync);
      s.off("slide:changed", onSlide);
      s.off("activity:opened", onOpened);
      s.off("activity:closed", onClosed);
      s.off("session:ended", onEnded);
      s.off("connect", onReconnect);
    };
  }, [sid]);

  /* Slide always comes from socket once we've seen one (slide:changed
     or state:sync); REST `/state` provides the *current* slide for
     the very first paint. We never have the full deck client-side. */
  const slide = live?.slide ?? state?.deck?.currentSlide ?? null;
  const pin: string | null = live?.pin ?? state?.pin ?? null;

  const inLobby = (live?.status ?? state?.status) === "lobby";
  const ended = (live?.status ?? state?.status) === "ended";

  if (ended) {
    return (
      <div dir="rtl" className="fixed inset-0 bg-black flex items-center justify-center text-white text-3xl">
        انتهت الجلسة 👋
      </div>
    );
  }

  if (!state) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div dir="rtl" className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {slide && state.deck && (
        <SlideStage lang={state.deck.language} slide={slide} theme={state.deck.theme} pattern={state.deck.pattern} />
      )}
      {/* Lobby PIN badge — projector view shows the PIN large so the
          back row of a classroom can read it. */}
      {inLobby && pin && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center text-white">
            <div className="text-2xl mb-3 opacity-80">للانضمام، اذهب إلى</div>
            <div className="text-3xl font-bold mb-6 opacity-90">/p/join</div>
            <div className="text-base mb-2 opacity-70">رمز الانضمام (PIN)</div>
            <div className="text-[10rem] leading-none font-black tabular-nums tracking-widest" style={{ color: "#D9A521" }}>
              {pin}
            </div>
          </div>
        </div>
      )}
      {/* Per spec: PIN visible during lobby only. Once running, the
          projector is dedicated to slide content. Late joiners get the
          PIN from the teacher's control panel. */}
      {live?.activeElementId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-6 py-2 text-lg font-bold" style={{ background: "#D9A521", color: "#1c1003" }}>
          نشاط مفتوح — أجيبوا من أجهزتكم
        </div>
      )}
    </div>
  );
}
