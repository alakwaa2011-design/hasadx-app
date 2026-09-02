import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Grid3X3, Volume2, VolumeX, Copy, Play, SkipForward, Square, Circle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getXoSocket } from "@/lib/xo-socket";
import { QuestionImage } from "@/components/game/question-image";
import { toast } from "@/components/ui/sonner";

type Mark = "x" | "o" | null;
type Question = { text: string; options: string[]; imageUrl?: string | null; duration?: number; remainingSecs?: number };
type Player = { id: string; name: string; team: "x" | "o" };
type Snapshot = { board?: Mark[]; turn?: "x" | "o"; phase?: string; question?: Question | null; timerRemainingSecs?: number; players?: Player[]; teamNames?: { x: string; o: string }; placementPlayerId?: string | null; started?: boolean; winner?: "x" | "o" | "draw" | null };
const tone = (ok: boolean) => { try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = ok ? 740 : 180; g.gain.value = .05; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + .12); } catch {} };

export default function XoPlay() {
  const { pin = "" } = useParams<{ pin: string }>(); const search = useSearch(); const [, navigate] = useLocation(); const { lang } = useI18n(); const ar = lang === "ar"; const creator = new URLSearchParams(search).get("creator") === "1"; const name = new URLSearchParams(search).get("name") || "";
  const [snapshot, setSnapshot] = useState<Snapshot>({ board: Array(9).fill(null), phase: "connecting" });
  const [selected, setSelected] = useState<number | null>(null); const [muted, setMuted] = useState(() => localStorage.getItem("xo-muted") === "1"); const [time, setTime] = useState(0); const [playerId, setPlayerId] = useState<string | null>(null); const socketRef = useRef(getXoSocket());
  const merge = useCallback((data: Snapshot) => { setSnapshot(p => ({ ...p, ...data, board: data.board ?? p.board, question: data.question === null ? null : data.question ?? p.question })); }, []);
  useEffect(() => {
    const socket = socketRef.current;
    const initialise = () => {
      if (creator) socket.emit("xo:reclaim-host", { pin }, (r: Snapshot & { error?: string }) => r.error ? toast.error(r.error) : merge(r));
      else {
        let stored: { id?: string; rejoinToken?: string } = {};
        try { stored = JSON.parse(localStorage.getItem(`xo-player-${pin}`) || "{}"); } catch {}
        socket.emit("xo:join", { pin, name, playerId: stored.id, rejoinToken: stored.rejoinToken }, (joined: { error?: string; state?: Snapshot; player?: { id: string; rejoinToken: string } }) => {
          if (joined.error) { toast.error(joined.error); return; }
          if (joined.player) {
            setPlayerId(joined.player.id);
            localStorage.setItem(`xo-player-${pin}`, JSON.stringify(joined.player));
          }
          if (joined.state) merge(joined.state);
        });
      }
    };
    socket.on("connect", initialise); if (socket.connected) initialise();
    const events: Array<[string, (d: Snapshot) => void]> = [["xo:state", d => { setSelected(null); merge(d); }]];
    events.forEach(([e, h]) => socket.on(e, h));
    socket.on("xo:answer-result", (d: { correct?: boolean }) => { if (!muted && typeof d.correct === "boolean") tone(d.correct); });
    socket.on("xo:ended", () => {
      toast.info(ar ? "أنهى المعلم اللعبة" : "The teacher ended the game");
      navigate("/game/xo/join");
    });
    socket.on("xo:error", (d: { message?: string } | string) => toast.error(typeof d === "string" ? d : d.message || "XO error"));
    return () => { events.forEach(([e, h]) => socket.off(e, h)); socket.off("connect", initialise); socket.off("xo:answer-result"); socket.off("xo:ended"); socket.off("xo:error"); };
  }, [ar, creator, merge, muted, name, navigate, pin]);
  useEffect(() => { const q = snapshot.question; if (snapshot.phase === "placement") { setTime(snapshot.timerRemainingSecs ?? 20); return; } if (!q || snapshot.phase !== "question") return; setTime(q.remainingSecs ?? q.duration ?? 20); }, [snapshot.question, snapshot.phase, snapshot.timerRemainingSecs]);
  useEffect(() => { if (!time || snapshot.phase !== "question") return; const t = window.setInterval(() => setTime(v => Math.max(0, v - 1)), 1000); return () => clearInterval(t); }, [time, snapshot.phase]);
  const emit = (event: string, data: object = {}) => socketRef.current.emit(`xo:${event}`, { pin, ...data });
  const question = snapshot.question; const board = snapshot.board || Array(9).fill(null); const canPlace = snapshot.phase === "placement" && snapshot.placementPlayerId === playerId;
  const toggleMute = () => setMuted(v => { const next = !v; localStorage.setItem("xo-muted", next ? "1" : "0"); return next; });
  const team = snapshot.teamNames?.[snapshot.turn ?? "x"] ?? snapshot.turn?.toUpperCase() ?? "X";
  return <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#FCFAF8] text-slate-800"><header className="sticky top-0 z-10 flex items-center justify-between bg-[#225739] px-4 py-3 text-white shadow"><div className="flex items-center gap-2"><Grid3X3 /><b>{ar ? "إكس أو" : "XO"} · <span dir="ltr">{pin}</span></b></div><div className="flex items-center gap-2"><button onClick={() => { navigator.clipboard?.writeText(`${location.origin}/game/xo/join/${pin}`); toast.success(ar ? "تم نسخ الرابط" : "Link copied"); }} aria-label="Copy join link" className="rounded-lg p-2 hover:bg-white/15"><Copy className="h-5 w-5" /></button><button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="rounded-lg p-2 hover:bg-white/15">{muted ? <VolumeX /> : <Volume2 />}</button></div></header>
    <div className="mx-auto grid max-w-5xl gap-5 p-4 lg:grid-cols-[1fr_1.1fr]">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#225739]/10"><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-[#225739]/10 px-3 py-1 text-sm font-black text-[#225739]">{ar ? "دور" : "Turn"}: {team}</span>{snapshot.phase === "question" && <span className={`text-2xl font-black ${time <= 5 ? "text-red-600" : "text-[#225739]"}`}>{time}</span>}</div>
        {question ? <><h1 className="text-xl font-black leading-relaxed">{question.text}</h1>{question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.text} className="my-4 max-h-52 w-full rounded-2xl object-contain" />}<div className="mt-4 grid gap-2">{question.options.slice(0, 4).map((o, i) => <button key={i} disabled={selected !== null || snapshot.phase !== "question" || creator} onClick={() => { setSelected(i); emit("answer", { answerIndex: i, playerId }); }} className={`rounded-xl border p-3 text-start font-bold transition ${selected === i ? "border-[#D9A521] bg-[#D9A521]/10" : "hover:border-[#225739]"}`}>{o}</button>)}</div></> : <div className="py-12 text-center text-slate-500">{snapshot.phase === "finished" ? (ar ? "انتهت اللعبة" : "Game finished") : snapshot.phase === "placement" ? (ar ? "بانتظار اختيار الخانة..." : "Waiting for a cell...") : (ar ? "في انتظار بدء السؤال..." : "Waiting for a question...")}</div>}
        {creator && <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => emit("start")} className="rounded-xl bg-[#225739] px-4 py-2 font-bold text-white"><Play className="inline h-4" /> {ar ? "ابدأ" : "Start"}</button><button onClick={() => emit("skip")} className="rounded-xl bg-amber-100 px-4 py-2 font-bold text-amber-800"><SkipForward className="inline h-4" /> {ar ? "تخطي" : "Skip"}</button><button onClick={() => emit("end-early")} className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-800"><Square className="inline h-4" /> {ar ? "إنهاء" : "End"}</button></div>}</section>
      <section className="rounded-3xl bg-[#225739] p-5 text-white shadow-lg"><h2 className="mb-4 text-center font-black">{snapshot.winner ? (snapshot.winner === "draw" ? (ar ? "تعادل!" : "Draw!") : `${snapshot.teamNames?.[snapshot.winner] ?? snapshot.winner.toUpperCase()} ${ar ? "فاز!" : "wins!"}`) : (canPlace ? (ar ? "اختر خانة خلال 20 ثانية" : "Choose a cell within 20 seconds") : snapshot.phase === "placement" ? (ar ? "اللاعب صاحب الإجابة يختار الخانة" : "The correct responder chooses a cell") : (ar ? "أجب لتضع علامتك" : "Answer to place your mark"))}</h2><div role="grid" aria-label={ar ? "لوحة إكس أو" : "XO board"} className="mx-auto grid aspect-square max-w-md grid-cols-3 gap-2">{board.map((mark, i) => <button key={i} role="gridcell" disabled={!!mark || !canPlace || !!snapshot.winner} aria-label={`${ar ? "المربع" : "Cell"} ${i + 1}${mark ? `: ${mark.toUpperCase()}` : ""}`} onClick={() => emit("place", { cell: i, playerId })} className={`aspect-square rounded-2xl bg-white shadow transition enabled:animate-pulse enabled:hover:scale-[1.03] disabled:cursor-not-allowed ${mark === "x" ? "text-blue-500" : "text-amber-500"}`}>{mark === "x" ? <X className="mx-auto h-3/5 w-3/5" strokeWidth={3} /> : mark === "o" ? <Circle className="mx-auto h-3/5 w-3/5" strokeWidth={3} /> : null}</button>)}</div>{snapshot.phase === "finished" && creator && <button onClick={() => emit("replay")} className="mx-auto mt-5 block rounded-xl bg-[#D9A521] px-5 py-3 font-black text-[#225739]">{ar ? "لعبة جديدة" : "Play again"}</button>}</section>
    </div>
  </main>;
}