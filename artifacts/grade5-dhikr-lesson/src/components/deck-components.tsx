import { useEffect, useState, type ReactNode } from "react";

const base = import.meta.env.BASE_URL;

export function Frame({ children, title, number, dark = false }: { children: ReactNode; title: string; number: string; dark?: boolean }) {
  return (
    <div dir="rtl" className={`relative w-screen h-screen overflow-hidden ${dark ? "bg-[#1d5a3d] text-[#fffaf0]" : "bg-[#f6f1e8] text-[#27352f]"}`}>
      <div className={`absolute inset-x-0 top-0 h-[2.5vh] ${dark ? "bg-[#c79a43]" : "bg-[#1f6f4a]"}`} />
      <div className={`absolute -top-[16vh] -left-[8vw] h-[38vh] w-[38vh] rounded-full border-[1.2vh] ${dark ? "border-[#3f845f]/40" : "border-[#d6e4c7]"}`} />
      <div className={`absolute -bottom-[16vh] -right-[8vw] h-[42vh] w-[42vh] rounded-full border-[1.2vh] ${dark ? "border-[#c79a43]/25" : "border-[#e4c78b]/35"}`} />
      <div className="relative z-10 flex h-full flex-col px-[6vw] py-[6vh]">
        <div className="flex items-center justify-end">
          <div className={`flex items-center gap-[0.8vw] text-[1.25vw] font-bold ${dark ? "text-[#f2d18a]" : "text-[#7b4a8b]"}`}>
            <span className="h-[1.1vw] w-[1.1vw] rounded-full bg-[#c79a43]" />
            <span>{number}</span>
          </div>
        </div>
        <div className="mt-[2.3vh] flex items-end justify-between gap-[4vw]">
          <h1 className={`animate-dhikr-slide-in max-w-[78vw] text-[3.25vw] font-black leading-tight tracking-tight ${dark ? "text-[#fffaf0]" : "text-[#1f6f4a]"}`}>{title}</h1>
          <div className={`h-[0.7vh] w-[8vw] shrink-0 rounded-full ${dark ? "bg-[#c79a43]" : "bg-[#c79a43]"}`} />
        </div>
        <div className="animate-dhikr-soft-rise mt-[3.2vh] min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Cover({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="relative w-screen h-screen overflow-hidden bg-[#1d5a3d] text-[#fffaf0]">
      <img src={`${base}hero-dhikr.png`} crossOrigin="anonymous" alt="مشهد هادئ لدرس الذكر" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-l from-[#173e2d]/95 via-[#1d5a3d]/72 to-[#1d5a3d]/25" />
      <div className="absolute inset-x-0 top-0 h-[2.7vh] bg-[#c79a43]" />
      <div className="absolute bottom-[-16vh] left-[-8vw] h-[50vh] w-[50vh] rounded-full border-[1.5vh] border-[#f2d18a]/20" />
      <div className="relative z-10 flex h-full flex-col justify-center px-[7vw] py-[7vh]">
        <div className="animate-dhikr-soft-rise max-w-[65vw]">{children}</div>
      </div>
    </div>
  );
}

export function Panel({ children, tone = "cream", className = "" }: { children: ReactNode; tone?: "cream" | "green" | "plum" | "gold"; className?: string }) {
  const tones = {
    cream: "bg-[#fffaf0] border-[#dfd5c5]",
    green: "bg-[#e8f0df] border-[#a9c492]",
    plum: "bg-[#f0e6f3] border-[#c8a8d2]",
    gold: "bg-[#fbf0cf] border-[#e3bd69]",
  };
  return <div className={`rounded-[2vw] border-[0.16vw] p-[2.2vw] shadow-[0_0.8vw_2vw_rgba(55,72,56,0.08)] ${tones[tone]} ${className}`}>{children}</div>;
}

export function Label({ children, tone = "plum" }: { children: ReactNode; tone?: "plum" | "green" | "gold" }) {
  const tones = { plum: "bg-[#8b5a9d] text-[#fffaf0]", green: "bg-[#1f6f4a] text-[#fffaf0]", gold: "bg-[#c79a43] text-[#27352f]" };
  return <span className={`inline-flex rounded-full px-[1.3vw] py-[0.7vh] text-[1.25vw] font-bold ${tones[tone]}`}>{children}</span>;
}

export function AudioReadButton({ text, tone = "plum" }: { text: string; tone?: "plum" | "green" | "gold" }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!speechAvailable) return;
    const handleEnd = () => setIsSpeaking(false);
    window.speechSynthesis.addEventListener("end", handleEnd);
    window.speechSynthesis.addEventListener("error", handleEnd);
    return () => {
      window.speechSynthesis.removeEventListener("end", handleEnd);
      window.speechSynthesis.removeEventListener("error", handleEnd);
    };
  }, [speechAvailable]);

  const toggleSpeech = () => {
    if (!speechAvailable) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.78;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const colors = {
    plum: "border-[#8b5a9d] bg-[#f0e6f3] text-[#5b326d]",
    green: "border-[#1f6f4a] bg-[#e8f0df] text-[#1f6f4a]",
    gold: "border-[#c79a43] bg-[#fbf0cf] text-[#806019]",
  };

  return (
    <button
      type="button"
      className={`audio-control mt-[2vh] inline-flex items-center gap-[0.65vw] rounded-full border-[0.14vw] px-[1.15vw] py-[0.75vh] text-[1.35vw] font-extrabold shadow-[0_0.35vw_1vw_rgba(55,72,56,0.08)] ${colors[tone]} ${!speechAvailable ? "cursor-not-allowed opacity-60" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        toggleSpeech();
      }}
      aria-label={speechAvailable ? (isSpeaking ? "إيقاف النطق" : "استمع إلى النص") : "النطق غير متاح في هذا المتصفح"}
      disabled={!speechAvailable}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.45vw] w-[1.45vw] fill-none stroke-current stroke-[2]">
        {isSpeaking ? (
          <>
            <path d="M6 5v14M12 5v14" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" strokeLinejoin="round" />
            <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span>{isSpeaking ? "إيقاف" : "استمع"}</span>
    </button>
  );
}
export function Bullet({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "plum" | "gold" }) {
  const colors = { green: "bg-[#1f6f4a]", plum: "bg-[#8b5a9d]", gold: "bg-[#c79a43]" };
  return <div className="flex items-start gap-[1vw] text-[1.9vw] leading-relaxed"><span className={`mt-[1.1vh] h-[0.85vw] w-[0.85vw] shrink-0 rounded-full ${colors[tone]}`} /><span>{children}</span></div>;
}

export function Quote({ children, reference, audioText, audioTone = "plum" }: { children: ReactNode; reference?: ReactNode; audioText?: string; audioTone?: "plum" | "green" | "gold" }) {
  return (
    <div className="relative rounded-[2vw] border-[0.18vw] border-[#c79a43] bg-[#fffaf0] px-[3vw] py-[3vh] text-center shadow-[0_0.8vw_2vw_rgba(55,72,56,0.08)]">
      <div className="absolute -top-[2.2vh] right-[3vw] rounded-full bg-[#8b5a9d] px-[1.1vw] py-[0.6vh] text-[1.2vw] font-bold text-[#fffaf0]">حديث الدرس</div>
      <p className="text-[2.35vw] font-bold leading-[1.8] text-[#5b326d]">{children}</p>
      {reference && <p className="mt-[1.6vh] text-[1.35vw] text-[#6e7d74]">{reference}</p>}
      {audioText && <AudioReadButton text={audioText} tone={audioTone} />}
    </div>
  );
}

export function Activity({ number, title, children, tone = "green" }: { number: string; title: string; children: ReactNode; tone?: "green" | "plum" | "gold" }) {
  const colors = { green: "bg-[#1f6f4a]", plum: "bg-[#8b5a9d]", gold: "bg-[#c79a43]" };
  return (
    <div className="flex items-start gap-[1.4vw] rounded-[1.8vw] bg-[#fffaf0] p-[1.7vw] shadow-[0_0.8vw_2vw_rgba(55,72,56,0.08)]">
      <div className={`flex h-[3.7vw] w-[3.7vw] shrink-0 items-center justify-center rounded-full text-[1.8vw] font-black text-[#fffaf0] ${colors[tone]}`}>{number}</div>
      <div>
        <div className="text-[1.65vw] font-extrabold text-[#5b326d]">{title}</div>
        <div className="mt-[0.7vh] text-[1.55vw] leading-relaxed text-[#4e5b53]">{children}</div>
      </div>
    </div>
  );
}

export function IconTile({ symbol: _symbol, label, tone = "green" }: { symbol: string; label: string; tone?: "green" | "plum" | "gold" }) {
  const colors = { green: "bg-[#e8f0df] text-[#1f6f4a] border-[#a9c492]", plum: "bg-[#f0e6f3] text-[#8b5a9d] border-[#c8a8d2]", gold: "bg-[#fbf0cf] text-[#9a7120] border-[#e3bd69]" };
  return <div className={`flex min-h-[13vh] flex-col items-center justify-center gap-[1vh] rounded-[1.8vw] border-[0.16vw] ${colors[tone]} p-[1vw]`}><div className="flex h-[3vw] w-[3vw] items-center justify-center rounded-full border-[0.18vw] border-current"><span className="h-[0.9vw] w-[0.9vw] rounded-full bg-current" /></div><div className="text-center text-[1.35vw] font-bold">{label}</div></div>;
}

export function ImageCard({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <img src={src} crossOrigin="anonymous" alt={alt} className={`rounded-[2vw] border-[0.22vw] border-[#fffaf0] object-cover shadow-[0_1vw_2.5vw_rgba(39,53,47,0.16)] ${className}`} />;
}
