import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { useLocation } from "wouter";
import { Grid3X3, Pause, Play, RotateCcw, Volume2, VolumeX, Clock, ArrowLeft, ArrowRight, Check, Copy, AlertCircle, X, Circle, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { QuestionImage } from "@/components/game/question-image";
import { getIsMuted, playCorrectSound, playGameStartSound, playTickSound, playVictoryFanfare, playWrongSound, startBackgroundBeat, stopBackgroundBeat, toggleMute } from "@/lib/game-sounds";
import { createXoClassState, currentXoClassQuestionForTeam, xoClassReducer, type XoClassQuestion, type XoClassState } from "@/lib/xo-class-engine";
import { QRModalButton } from "@/components/game-qr-code";
import { toast } from "@/components/ui/sonner";
import { decodeXoClassSetup, encodeXoClassSetup, type XoClassSetup } from "@/lib/xo-class-share";
import { ConfettiBurst } from "@/components/confetti-burst";
import { cn } from "@/lib/utils";
import { XO_ANSWER_COLORS } from "@/lib/xo-answer-colors";

export const XO_CLASS_SETUP_KEY = "xo-class-setup";
type Setup = XoClassSetup;
const labels = ["A", "B", "C", "D"];

function getWinningCells(board: XoClassState["board"]): number[] {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  return lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? [];
}

function TeamPanel({ team, name, state, ar, dispatch }: { team: "x" | "o"; name: string; state: XoClassState; ar: boolean; dispatch: Dispatch<any> }) {
  const answering = state.status === "playing" && state.phase === "question";
  const alreadyAnswered = state.answeredTeams.includes(team);
  const question = answering ? currentXoClassQuestionForTeam(state, team) : null;
  const answerLabels = ar ? ["أ", "ب", "ج", "د"] : labels;
  const totalQuestions = state.questions.length;
  const playedQuestions = state.status === "idle"
    ? 0
    : Math.min(state.questionIndex + 1, totalQuestions);

  const isX = team === "x";
  const colorClass = isX ? "text-blue-500" : "text-amber-500";
  const bgClass = isX ? "bg-blue-600" : "bg-amber-500";
  const ringClass = isX ? "ring-blue-500/30" : "ring-amber-500/30";
  const softBg = isX ? "bg-blue-500/10" : "bg-amber-500/10";

  const highlighted = (state.phase === "placement" && state.activeTeam === team) || (answering && !alreadyAnswered);

  // Track selected answer locally for animation feedback
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  useEffect(() => { setSelectedOpt(null); }, [state.questionIndex, state.phase]);

  const handleAnswer = (index: number) => {
    if (alreadyAnswered || selectedOpt !== null) return;
    setSelectedOpt(index);
    dispatch({ type: "answer", team, index });
  };

  const getOptionState = (index: number) => {
    if (selectedOpt !== index) return "default";
    if (state.phase === "placement" && state.activeTeam === team) return "correct";
    if (state.answeredTeams.includes(team) && state.phase === "question") return "wrong";
    return "default";
  };

  return (
    <section
      className={cn(
        "flex flex-1 min-w-0 flex-col rounded-3xl border bg-card p-5 shadow-lg transition-all duration-500",
        highlighted ? `ring-4 ${ringClass} scale-[1.01] border-transparent` : "border-border/50 opacity-90 scale-100"
      )}
      style={{ direction: ar ? "rtl" : "ltr" }}
    >
      <header className="mb-4 flex items-center justify-between gap-2 border-b border-border/50 pb-4">
        <h2 className="flex items-center gap-3 text-xl font-black text-foreground">
          <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm", bgClass)}>
            {isX ? <X strokeWidth={3} className="h-6 w-6" /> : <Circle strokeWidth={3} className="h-6 w-6" />}
          </span>
          <span className="line-clamp-1">{name}</span>
        </h2>
        <div className="flex items-center gap-2">
          {totalQuestions > 0 && (
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground shadow-inner" aria-label={ar ? "عداد الأسئلة" : "Question counter"}>
              <span dir="ltr">{playedQuestions.toLocaleString(ar ? "ar-EG" : "en-US")} / {totalQuestions.toLocaleString(ar ? "ar-EG" : "en-US")}</span>
            </span>
          )}
          {answering && (
            <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-white shadow-sm", bgClass, state.timeLeft <= 5 && "animate-pulse bg-red-600")}>
              <Clock className="h-3.5 w-3.5" />
              {state.timeLeft.toLocaleString(ar ? "ar-EG" : "en-US")}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        {state.status === "playing" && state.phase === "placement" && state.activeTeam === team && (
          <div className={cn("rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4", softBg)}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
              <Check className={cn("h-6 w-6", colorClass)} strokeWidth={3} />
            </div>
            <p className={cn("text-xl font-black", colorClass)}>{ar ? "إجابة صحيحة!" : "Correct!"}</p>
            <p className="mt-1 text-sm font-bold text-foreground">{ar ? "اختر خانة على اللوحة" : "Choose a square on the board"}</p>
            <button
              onClick={() => dispatch({ type: "skip-placement", team })}
              className="mt-6 rounded-xl border-2 border-transparent bg-background/50 px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-background/80 hover:shadow-sm"
            >
              {ar ? "تخطي الدور" : "Skip turn"}
            </button>
          </div>
        )}

        {state.status === "playing" && state.phase === "placement" && state.activeTeam !== team && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground opacity-60">
            <Clock className="mb-2 h-8 w-8 animate-pulse" />
            <p className="text-sm font-bold">{ar ? "الفريق الآخر يختار الخانة" : "The other team is choosing"}</p>
          </div>
        )}

        {question && (
          <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
            <p className="text-center text-lg font-black leading-relaxed text-foreground">{question.text}</p>

            {question.imageUrl && (
              <QuestionImage src={question.imageUrl} alt="" className="mx-auto max-h-40 rounded-xl border border-border shadow-sm object-contain bg-muted/20" />
            )}

            <div className="mt-2 grid gap-3">
              {question.options.map((option, index) => {
                const optState = getOptionState(index);
                const answerColor = XO_ANSWER_COLORS[index] ?? XO_ANSWER_COLORS[0];
                return (
                  <button
                    key={index}
                    disabled={alreadyAnswered || selectedOpt !== null}
                    onClick={() => handleAnswer(index)}
                    className={cn(
                      "group relative min-h-[3.5rem] overflow-hidden rounded-xl border-2 px-4 py-3 text-start text-sm font-black transition-all",
                      optState === "default" && "border-white/20 text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/70",
                      optState === "correct" && "fb-correct-once z-10 border-green-500 bg-green-500 text-white shadow-lg",
                      optState === "wrong" && "fb-wrong-once z-10 border-red-500 bg-red-500 text-white shadow-lg",
                      (alreadyAnswered && optState === "default") && "opacity-50 cursor-not-allowed"
                    )}
                    style={optState === "default" ? { background: answerColor.background, boxShadow: answerColor.shadow } : undefined}
                  >
                    <span className="relative z-10 flex items-center">
                      <b className={cn(
                        "me-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold transition-colors",
                        optState === "default" ? "text-white" : "bg-white/20 text-white"
                      )}>
                        <span
                          className="flex h-full w-full items-center justify-center rounded-lg"
                          style={optState === "default" ? { background: answerColor.badge } : undefined}
                        >
                        {answerLabels[index]}
                        </span>
                      </b>
                      <span>{option}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {alreadyAnswered && state.phase === "question" && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-black text-amber-500 animate-in fade-in">
                <AlertCircle className="h-4 w-4" />
                {ar ? "إجابة خاطئة، ننتظر الفريق الآخر" : "Incorrect, waiting for other team"}
              </p>
            )}
          </div>
        )}

        {state.status === "playing" && state.phase === "question" && !question && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm font-bold">{ar ? "بانتظار السؤال" : "Waiting for question"}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function XoClass() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const [, navigate] = useLocation();
  const setup = useRef<Setup | null>(null);

  if (!setup.current) {
    const sharedSetup = new URLSearchParams(window.location.hash.slice(1)).get("setup")
      || new URLSearchParams(window.location.search).get("setup");
    setup.current = sharedSetup
      ? decodeXoClassSetup(sharedSetup)
      : (() => { try { return JSON.parse(sessionStorage.getItem(XO_CLASS_SETUP_KEY) || "null"); } catch { return null; } })();
  }

  const valid = setup.current && Array.isArray(setup.current.questions) && setup.current.questions.length > 0;
  const [state, dispatch] = useReducer(xoClassReducer, createXoClassState(valid ? setup.current!.questions : [], setup.current?.duration || 20));
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(getIsMuted);
  const previous = useRef(state.status);

  useEffect(() => {
    if (paused || !["countdown", "playing"].includes(state.status)) return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [state.status, paused]);

  useEffect(() => {
    if (state.status === "playing" && !paused) startBackgroundBeat();
    else stopBackgroundBeat();
    return stopBackgroundBeat;
  }, [state.status, paused]);

  useEffect(() => {
    const old = previous.current;
    previous.current = state.status;
    if (old === "countdown" && state.status === "playing") playGameStartSound();
    if (state.status === "finished") playVictoryFanfare();
  }, [state.status]);

  useEffect(() => {
    if (state.status === "countdown" || (state.status === "playing" && state.timeLeft <= 5 && state.timeLeft > 0)) playTickSound();
  }, [state.status, state.countdown, state.timeLeft]);

  const result = useRef(state.lastResult);
  useEffect(() => {
    if (state.lastResult && state.lastResult !== result.current) {
      state.lastResult === "correct" ? playCorrectSound() : playWrongSound();
    }
    result.current = state.lastResult;
  }, [state.lastResult]);

  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}game/xo/class#setup=${encodeURIComponent(encodeXoClassSetup(setup.current!))}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(ar ? "تم نسخ رابط وضع الصف" : "Classroom link copied");
    } catch {
      toast.error(ar ? "تعذّر نسخ الرابط" : "Could not copy the link");
    }
  };

  const handleToggleMute = () => {
    const nextMuted = toggleMute();
    setMuted(nextMuted);
    if (!nextMuted && state.status === "playing" && !paused) startBackgroundBeat();
  };

  if (!valid) {
    return (
      <Layout>
        <main className="grid min-h-[calc(100dvh-3.5rem)] place-items-center bg-slate-950 p-6" dir={dir}>
          <div className="max-w-md rounded-3xl bg-card p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Grid3X3 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-foreground">{ar ? "لا يوجد إعداد للعبة" : "No classroom game setup"}</h1>
            <p className="mt-2 text-muted-foreground">{ar ? "الرجاء العودة وتجهيز اللعبة أولاً." : "Please go back and configure the game first."}</p>
            <button
              onClick={() => navigate("/game/xo/create")}
              className="mt-8 w-full rounded-2xl bg-primary px-5 py-4 font-black text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              {ar ? "العودة للإعداد" : "Back to setup"}
            </button>
          </div>
        </main>
      </Layout>
    );
  }

  const teamName = state.activeTeam === "x" ? (setup.current!.teamX || "Team X") : (setup.current!.teamO || "Team O");
  const isFinished = state.status === "finished";
  const winningCells = getWinningCells(state.board);

  return (
    <Layout>
      <main className="relative min-h-[calc(100dvh-3.5rem)] bg-slate-950 p-3 sm:p-5" dir={dir}>
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className={cn("absolute left-[20%] top-[-10%] h-[40rem] w-[40rem] rounded-full blur-[100px] transition-colors duration-1000", state.activeTeam === 'x' ? 'bg-blue-600/10' : 'bg-amber-500/10')} />
        </div>

        <div className="relative z-10 mx-auto max-w-[90rem] h-full flex flex-col gap-4 sm:gap-6">
          <header className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3 text-white shadow-lg backdrop-blur-md ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => navigate("/game/xo/create")}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {ar ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              <span className="hidden sm:inline">{ar ? "إنهاء اللعبة" : "End game"}</span>
            </button>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-4 text-center">
              <Grid3X3 className="h-5 w-5 text-emerald-400" />
              <span className="truncate font-black text-lg tracking-wide">{setup.current!.title || (ar ? "إكس أو الصف" : "XO Class")}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <QRModalButton url={shareUrl} pin="" label="QR" variant="dark" />
              <button type="button" aria-label={ar ? "نسخ الرابط" : "Copy link"} onClick={copyShareLink} className="hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white">
                <Copy className="h-4 w-4" />
                <span className="hidden xl:inline">{ar ? "نسخ" : "Copy"}</span>
              </button>
              <div className="h-6 w-px bg-white/10 mx-1" />
              <button aria-label={paused ? "Resume" : "Pause"} onClick={() => setPaused(!paused)} className="rounded-xl p-2.5 text-slate-300 hover:bg-white/10 hover:text-white">
                {paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
              </button>
              <button aria-label="Toggle sound" onClick={handleToggleMute} className="rounded-xl p-2.5 text-slate-300 hover:bg-white/10 hover:text-white">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button aria-label="Restart" onClick={() => { setPaused(false); dispatch({ type: "restart" }); }} className="rounded-xl p-2.5 text-slate-300 hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 grid gap-4 lg:grid-cols-[1fr_minmax(320px,460px)_1fr] lg:gap-8">
            <TeamPanel team="x" name={setup.current!.teamX || "Team X"} state={state} ar={ar} dispatch={dispatch} />

            <section className="flex flex-col items-center justify-center rounded-3xl bg-slate-900/50 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-sm">
              <div className="mb-8 w-full text-center">
                {state.status === "playing" ? (
                  <div className="inline-flex flex-col items-center justify-center gap-1">
                    <span className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-black tracking-widest text-slate-400 uppercase">
                      {state.phase === "placement" ? (ar ? "مرحلة الاختيار" : "PLACEMENT PHASE") : (ar ? "مرحلة الإجابة" : "ANSWER PHASE")}
                    </span>
                    <p className={cn("text-xl font-black mt-2 transition-colors", state.activeTeam === 'x' ? 'text-blue-400' : 'text-amber-400')}>
                      {state.phase === "placement" ? (ar ? `اختيار ${teamName}` : `${teamName} chooses`) : (ar ? `دور ${teamName}` : `${teamName}'s turn`)}
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-black text-slate-300 tracking-widest">{ar ? "إكس أو" : "XO"}</p>
                )}
              </div>

              <div className="relative aspect-square w-full max-w-sm">
                {/* Board Grid Lines (Decorative) */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  <div className="border-b-4 border-r-4 border-slate-700/50" />
                  <div className="border-b-4 border-r-4 border-slate-700/50" />
                  <div className="border-b-4 border-slate-700/50" />
                  <div className="border-b-4 border-r-4 border-slate-700/50" />
                  <div className="border-b-4 border-r-4 border-slate-700/50" />
                  <div className="border-b-4 border-slate-700/50" />
                  <div className="border-r-4 border-slate-700/50" />
                  <div className="border-r-4 border-slate-700/50" />
                  <div className="" />
                </div>

                {/* Interactive Cells */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-3 p-3">
                  {state.board.map((cell, index) => {
                    const isX = cell === "x";
                    const isO = cell === "o";
                    const canPlace = state.status === "playing" && state.phase === "placement" && !cell;
                    return (
                      <button
                        key={index}
                        aria-label={`Cell ${index + 1}`}
                        disabled={!canPlace}
                        onClick={() => dispatch({ type: "place", team: state.activeTeam, cell: index })}
                        className={cn(
                          "relative flex items-center justify-center rounded-2xl transition-all duration-300",
                          canPlace ? "cursor-pointer bg-slate-800/60 hover:bg-slate-700 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95" : "cursor-default",
                          !cell && !canPlace && "bg-transparent",
                          isX && "bg-blue-600/20 shadow-[0_0_20px_rgba(37,99,235,0.2)]",
                          isO && "bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]",
                          winningCells.includes(index) && "scale-105 animate-pulse ring-4 ring-amber-300/70"
                        )}
                      >
                        {isX && <X strokeWidth={2.5} className="h-16 w-16 text-blue-500 animate-in zoom-in-50 spin-in-12 duration-300" />}
                        {isO && <Circle strokeWidth={3} className="h-14 w-14 text-amber-500 animate-in zoom-in-50 duration-300" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <TeamPanel team="o" name={setup.current!.teamO || "Team O"} state={state} ar={ar} dispatch={dispatch} />
          </div>
        </div>

        {/* Overlays */}
        {isFinished && state.winner !== "draw" && <ConfettiBurst active={true} />}

        {(state.status === "idle" || state.status === "countdown" || isFinished || paused) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-lg rounded-3xl bg-card p-10 text-center shadow-2xl ring-1 ring-border zoom-in-95 animate-in duration-300">

              {state.status === "countdown" && (
                <div className="py-8">
                  <p className="mb-4 text-lg font-black uppercase tracking-widest text-muted-foreground">{ar ? "استعدوا" : "Get ready"}</p>
                  <strong className="block text-9xl font-black text-primary animate-in zoom-in spin-in-3 duration-500">{state.countdown}</strong>
                </div>
              )}

              {isFinished && (
                <div className="py-4">
                  {state.winner === "draw" ? (
                    <>
                      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Grid3X3 className="h-12 w-12" />
                      </div>
                      <h1 className="text-4xl font-black text-foreground">{ar ? "تعادل!" : "Draw!"}</h1>
                      <p className="mt-3 text-lg font-medium text-muted-foreground">{ar ? "مباراة قوية، لا أحد فائز هذه المرة." : "Great match, no winner this time."}</p>
                    </>
                  ) : (
                    <>
                      <span className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg">
                        <Trophy className="h-4 w-4" />
                        {ar ? "بطل المباراة" : "Match champion"}
                      </span>
                      <div className={cn(
                        "mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-2xl",
                        state.winner === "x" ? "bg-blue-600 shadow-blue-600/30" : "bg-amber-500 shadow-amber-500/30"
                      )}>
                        {state.winner === "x" ? <X className="h-12 w-12 text-white" strokeWidth={3} /> : <Circle className="h-12 w-12 text-white" strokeWidth={3} />}
                      </div>
                      <h1 className="text-4xl font-black text-foreground">
                        {state.winner === "x" ? setup.current!.teamX : setup.current!.teamO}
                        <span className="block mt-2 text-2xl text-muted-foreground">{ar ? "يفوز!" : "wins!"}</span>
                      </h1>
                    </>
                  )}
                  <button
                    onClick={() => dispatch({ type: "restart" })}
                    className="mt-10 w-full rounded-2xl bg-primary px-6 py-4 text-xl font-black text-primary-foreground shadow-xl transition-transform hover:scale-105 hover:bg-primary/90"
                  >
                    {ar ? "لعبة جديدة" : "Play again"}
                  </button>
                </div>
              )}

              {paused && (
                <div className="py-6">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted text-foreground">
                    <Pause className="h-10 w-10 fill-current" />
                  </div>
                  <h1 className="text-3xl font-black text-foreground">{ar ? "اللعبة متوقفة" : "Game paused"}</h1>
                  <button
                    onClick={() => setPaused(false)}
                    className="mt-8 w-full rounded-2xl bg-primary px-6 py-4 text-xl font-black text-primary-foreground shadow-lg hover:bg-primary/90"
                  >
                    {ar ? "استمرار" : "Resume"}
                  </button>
                </div>
              )}

              {state.status === "idle" && (
                <div className="py-4">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Grid3X3 className="h-10 w-10" />
                  </div>
                  <h1 className="text-3xl font-black text-foreground">{ar ? "إكس أو الصف" : "XO Class"}</h1>
                  <p className="mt-3 text-lg font-medium text-muted-foreground">{ar ? "أجب بشكل صحيح لتحصل على مكان في اللوحة." : "Answer correctly to earn a place on the board."}</p>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                      <X className="mx-auto mb-2 h-6 w-6 text-blue-500" strokeWidth={3} />
                      <div className="font-bold text-foreground line-clamp-1">{setup.current!.teamX}</div>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <Circle className="mx-auto mb-2 h-6 w-6 text-amber-500" strokeWidth={3} />
                      <div className="font-bold text-foreground line-clamp-1">{setup.current!.teamO}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => dispatch({ type: "start" })}
                    className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-xl font-black text-primary-foreground shadow-xl transition hover:bg-primary/90"
                  >
                    <Play className="h-6 w-6 fill-current" />
                    {ar ? "ابدأ اللعبة" : "Start Game"}
                  </button>
                </div>
              )}

            </div>
          </div>
        )}
      </main>
    </Layout>
  );
}