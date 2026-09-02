import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Grid3X3, Volume2, VolumeX, ArrowRight, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getIsMuted, toggleMute } from "@/lib/game-sounds";

export default function XoJoin() {
  const { pin: routePin } = useParams<{ pin?: string }>();
  const [, navigate] = useLocation();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [pin, setPin] = useState(routePin || "");
  const [name, setName] = useState("");
  const [muted, setMuted] = useState(getIsMuted);

  const toggle = () => setMuted(toggleMute());

  const handleJoin = () => {
    if (pin && name.trim()) {
      navigate(`/game/xo/play/${pin}?name=${encodeURIComponent(name.trim())}`);
    }
  };

  return (
    <main dir={ar ? "rtl" : "ltr"} className="flex min-h-[100dvh] items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-amber-500/5 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex flex-col gap-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Grid3X3 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground">{ar ? "انضم إلى إكس أو" : "Join XO"}</h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {ar ? "أدخل رمز الغرفة واسمك للبدء" : "Enter the room code and your name"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggle}
            data-testid="button-toggle-mute"
            className="rounded-xl bg-muted/50 p-3 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">{ar ? "رمز الغرفة" : "Room code"}</span>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
              data-testid="input-room-code"
              className="w-full rounded-2xl border-2 border-muted bg-transparent p-4 text-center text-3xl font-black tracking-[0.3em] text-foreground transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="000000"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">{ar ? "اسمك" : "Your name"}</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              data-testid="input-player-name"
              className="w-full rounded-2xl border-2 border-muted bg-transparent p-4 text-lg font-bold text-foreground transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder={ar ? "اكتب اسمك هنا..." : "Type your name..."}
            />
          </label>
        </div>

        <button
          disabled={!pin || !name.trim()}
          onClick={handleJoin}
          data-testid="button-join-game"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-black text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {ar ? "انضم الآن" : "Join now"}
          {ar ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
        </button>
      </div>
    </main>
  );
}