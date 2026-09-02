import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { useLocation } from "wouter";
import { Grid3X3, Pause, Play, RotateCcw, Volume2, VolumeX, LogOut, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { QuestionImage } from "@/components/game/question-image";
import { getIsMuted, playCorrectSound, playGameStartSound, playTickSound, playVictoryFanfare, playWrongSound, startBackgroundBeat, stopBackgroundBeat, toggleMute } from "@/lib/game-sounds";
import { createXoClassState, currentXoClassQuestion, xoClassReducer, type XoClassQuestion, type XoClassState } from "@/lib/xo-class-engine";

export const XO_CLASS_SETUP_KEY = "xo-class-setup";
type Setup = { questions: XoClassQuestion[]; duration?: number; teamX?: string; teamO?: string; title?: string };
const labels = ["A", "B", "C", "D"];

function TeamPanel({ team, name, state, ar, dispatch }: { team: "x" | "o"; name: string; state: XoClassState; ar: boolean; dispatch: Dispatch<any> }) {
  const active = state.activeTeam === team && state.status === "playing";
  const question = active && state.phase === "question" ? currentXoClassQuestion(state) : null;
  const color = team === "x" ? "#4f46e5" : "#d97706";
  return <section className="min-w-0 flex-1 rounded-3xl border bg-white p-4 shadow-sm" style={{ borderColor: active ? color : "#e2e8f0", direction: ar ? "rtl" : "ltr" }}>
    <header className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: color }}>{team.toUpperCase()}</span>{name}</h2>{active && <span className="rounded-full px-2.5 py-1 text-xs font-black text-white" style={{ background: color }}><Clock className="inline h-3.5 w-3.5" /> {state.timeLeft}s</span>}</header>
    {!active && <p className="py-8 text-center text-sm font-bold text-slate-400">{ar ? "بانتظار الدور" : "Waiting for turn"}</p>}
    {active && state.phase === "placement" && <div className="py-8 text-center"><p className="text-lg font-black" style={{ color }}>{ar ? "إجابة صحيحة! اختر مربعاً" : "Correct! Choose a square"}</p><p className="mt-2 text-sm font-bold text-slate-500">{ar ? "لديكم 20 ثانية" : "You have 20 seconds"}</p><button onClick={() => dispatch({ type: "skip-placement", team })} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold text-slate-600">{ar ? "تخطي الدور" : "Skip turn"}</button></div>}
    {question && <div className="space-y-3"><p className="text-center text-base font-black leading-relaxed text-slate-800">{question.text}</p><QuestionImage src={question.imageUrl} alt="" className="mx-auto max-h-36 rounded-xl" /><div className="grid gap-2">{question.options.map((option, index) => <button key={index} onClick={() => dispatch({ type: "answer", team, index })} className="rounded-xl border-2 px-3 py-3 text-start text-sm font-bold text-slate-800 transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: ["#818cf8", "#fbbf24", "#f59e0b", "#6366f1"][index % 4], background: ["#eef2ff", "#fffbeb", "#fff7ed", "#f5f3ff"][index % 4] }}><b className="me-2">{labels[index]}.</b>{option}</button>)}</div></div>}
  </section>;
}

export default function XoClass() {
  const { lang, dir } = useI18n(); const ar = lang === "ar"; const [, navigate] = useLocation();
  const setup = useRef<Setup | null>(null);
  if (!setup.current) { try { setup.current = JSON.parse(sessionStorage.getItem(XO_CLASS_SETUP_KEY) || "null"); } catch { setup.current = null; } }
  const valid = setup.current && Array.isArray(setup.current.questions) && setup.current.questions.length > 0;
  const [state, dispatch] = useReducer(xoClassReducer, createXoClassState(valid ? setup.current!.questions : [], setup.current?.duration || 20));
  const [paused, setPaused] = useState(false); const [muted, setMuted] = useState(getIsMuted);
  const previous = useRef(state.status);
  useEffect(() => { if (paused || !["countdown", "playing"].includes(state.status)) return; const id = window.setInterval(() => dispatch({ type: "tick" }), 1000); return () => clearInterval(id); }, [state.status, paused]);
  useEffect(() => { if (state.status === "playing" && !paused) startBackgroundBeat(); else stopBackgroundBeat(); return stopBackgroundBeat; }, [state.status, paused]);
  useEffect(() => { const old = previous.current; previous.current = state.status; if (old === "countdown" && state.status === "playing") playGameStartSound(); if (state.status === "finished") playVictoryFanfare(); }, [state.status]);
  useEffect(() => { if (state.status === "countdown" || (state.status === "playing" && state.timeLeft <= 5 && state.timeLeft > 0)) playTickSound(); }, [state.status, state.countdown, state.timeLeft]);
  const result = useRef(state.lastResult);
  useEffect(() => { if (state.lastResult && state.lastResult !== result.current) { state.lastResult === "correct" ? playCorrectSound() : playWrongSound(); } result.current = state.lastResult; }, [state.lastResult]);
  if (!valid) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6" dir={dir}><div className="max-w-md rounded-3xl bg-white p-7 text-center"><Grid3X3 className="mx-auto h-10 w-10 text-indigo-600" /><h1 className="mt-3 text-xl font-black">{ar ? "لا يوجد إعداد للعبة" : "No classroom game setup"}</h1><button onClick={() => navigate("/game/xo/create")} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">{ar ? "العودة للإعداد" : "Back to setup"}</button></div></main>;
  const teamName = state.activeTeam === "x" ? (setup.current!.teamX || "Team X") : (setup.current!.teamO || "Team O");
  return <main className="min-h-screen bg-slate-950 p-3 text-slate-900" dir={dir}><div className="mx-auto max-w-7xl">
    <header className="mb-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-white"><span className="flex items-center gap-2 font-black"><Grid3X3 />{setup.current!.title || (ar ? "إكس أو الصف" : "XO Class")}</span><div className="flex gap-2"><button aria-label={paused ? "Resume" : "Pause"} onClick={() => setPaused(!paused)} className="rounded-lg p-2 hover:bg-white/15">{paused ? <Play /> : <Pause />}</button><button aria-label="Toggle sound" onClick={() => setMuted(toggleMute())} className="rounded-lg p-2 hover:bg-white/15">{muted ? <VolumeX /> : <Volume2 />}</button><button aria-label="Restart" onClick={() => { setPaused(false); dispatch({ type: "restart" }); }} className="rounded-lg p-2 hover:bg-white/15"><RotateCcw /></button><button aria-label="Exit" onClick={() => navigate("/game/xo/create")} className="rounded-lg p-2 hover:bg-white/15"><LogOut /></button></div></header>
    <div className="grid gap-3 lg:grid-cols-[1fr_minmax(280px,430px)_1fr]"><TeamPanel team="x" name={setup.current!.teamX || "Team X"} state={state} ar={ar} dispatch={dispatch} />
      <section className="rounded-3xl bg-white p-4 shadow-xl"><p className="mb-3 text-center font-black text-slate-600">{state.status === "playing" ? (state.phase === "placement" ? (ar ? `اختيار ${teamName}` : `${teamName} chooses`) : (ar ? `دور ${teamName}` : `${teamName}'s turn`)) : (ar ? "إكس أو" : "XO")}</p><div className="grid aspect-square grid-cols-3 gap-2">{state.board.map((cell, index) => <button key={index} aria-label={`Cell ${index + 1}`} disabled={state.status !== "playing" || state.phase !== "placement" || !!cell} onClick={() => dispatch({ type: "place", team: state.activeTeam, cell: index })} className="aspect-square rounded-xl border-2 border-slate-200 text-4xl font-black disabled:cursor-default" style={{ color: cell === "x" ? "#4f46e5" : "#d97706", background: cell ? (cell === "x" ? "#eef2ff" : "#fffbeb") : "#f8fafc" }}>{cell?.toUpperCase()}</button>)}</div></section>
      <TeamPanel team="o" name={setup.current!.teamO || "Team O"} state={state} ar={ar} dispatch={dispatch} /></div>
  </div>
  {state.status === "idle" || state.status === "countdown" || state.status === "finished" || paused ? <div className="fixed inset-0 grid place-items-center bg-slate-950/85 p-5"><div className="rounded-3xl bg-white p-8 text-center shadow-2xl">{state.status === "countdown" ? <><p className="text-sm font-black text-slate-500">{ar ? "استعدوا" : "Get ready"}</p><strong className="text-7xl text-indigo-600">{state.countdown}</strong></> : state.status === "finished" ? <><h1 className="text-3xl font-black">{state.winner === "draw" ? (ar ? "تعادل" : "Draw") : `${state.winner === "x" ? setup.current!.teamX : setup.current!.teamO} ${ar ? "يفوز!" : "wins!"}`}</h1><button onClick={() => dispatch({ type: "restart" })} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">{ar ? "لعبة جديدة" : "Play again"}</button></> : paused ? <><h1 className="text-2xl font-black">{ar ? "اللعبة متوقفة" : "Game paused"}</h1><button onClick={() => setPaused(false)} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">{ar ? "استمرار" : "Resume"}</button></> : <><h1 className="text-2xl font-black">{ar ? "إكس أو الصف" : "XO Class"}</h1><p className="mt-2 text-slate-500">{ar ? "أجب بشكل صحيح لتحصل على مكان في اللوحة." : "Answer correctly to earn a place on the board."}</p><button onClick={() => dispatch({ type: "start" })} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white">{ar ? "ابدأ" : "Start"}</button></>}</div></div> : null}
  </main>;
}