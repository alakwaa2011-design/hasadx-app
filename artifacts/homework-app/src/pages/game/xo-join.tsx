import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Grid3X3, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function XoJoin() {
  const { pin: routePin } = useParams<{ pin?: string }>(); const [, navigate] = useLocation(); const { lang } = useI18n(); const ar = lang === "ar";
  const [pin, setPin] = useState(routePin || ""); const [name, setName] = useState(""); const [muted, setMuted] = useState(() => localStorage.getItem("xo-muted") === "1");
  const toggle = () => setMuted(v => { localStorage.setItem("xo-muted", (!v ? "1" : "0")); return !v; });
  return <main dir={ar ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-[#FCFAF8] p-4"><div className="w-full max-w-md rounded-3xl border border-[#225739]/10 bg-white p-7 shadow-xl">
    <div className="mb-6 flex items-start justify-between"><div><div className="mb-3 inline-flex rounded-2xl bg-[#225739] p-3 text-white"><Grid3X3 /></div><h1 className="text-2xl font-black text-[#225739]">{ar ? "انضم إلى إكس أو" : "Join XO"}</h1><p className="text-sm text-slate-500">{ar ? "أدخل رمز الغرفة واسمك" : "Enter the room code and your name"}</p></div><button aria-label={muted ? "Unmute" : "Mute"} onClick={toggle} className="rounded-xl p-2 text-[#225739]">{muted ? <VolumeX /> : <Volume2 />}</button></div>
    <label className="mb-4 block font-bold text-slate-700">{ar ? "رمز الغرفة" : "Room code"}<input dir="ltr" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border p-4 text-center text-2xl font-black tracking-[.35em] outline-[#225739]" placeholder="000000" /></label>
    <label className="mb-6 block font-bold text-slate-700">{ar ? "اسمك" : "Your name"}<input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && pin && name && navigate(`/game/xo/play/${pin}?name=${encodeURIComponent(name)}`)} className="mt-2 w-full rounded-xl border p-3 outline-[#225739]" /></label>
    <button disabled={!pin || !name.trim()} onClick={() => navigate(`/game/xo/play/${pin}?name=${encodeURIComponent(name.trim())}`)} className="w-full rounded-2xl bg-[#225739] py-4 font-black text-white disabled:opacity-50">{ar ? "انضم الآن" : "Join now"}</button>
  </div></main>;
}