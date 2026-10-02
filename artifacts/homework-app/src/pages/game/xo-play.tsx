import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Grid3X3, Volume2, VolumeX, Copy, Play, SkipForward, Square, Circle, X, CheckCircle, XCircle, Clock, Trophy, LogOut, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getXoSocket } from "@/lib/xo-socket";
import { QuestionImage } from "@/components/game/question-image";
import { toast } from "@/components/ui/sonner";
import { QRModalButton } from "@/components/game-qr-code";
import { useGameShareUrl } from "@/lib/use-game-share-url";
import { ConfettiBurst } from "@/components/confetti-burst";
import { cn } from "@/lib/utils";
import { XO_ANSWER_COLORS } from "@/lib/xo-answer-colors";
import { localizeXoError } from "@/lib/xo-error-messages";
import { useSmartBack } from "@/lib/nav-history";
import { XoName, XoTitle, normalizeXoTeamName } from "@/components/game/xo-display";
import { XoTeamRoster } from "@/components/game/xo-team-roster";
import {
  getIsMuted,
  playCorrectSound,
  playGameStartSound,
  playNotificationSound,
  playTickSound,
  playTimeUpSound,
  playVictoryFanfare,
  playWrongSound,
  startBackgroundBeat,
  stopBackgroundBeat,
  toggleMute as toggleGameMute,
} from "@/lib/game-sounds";

type Mark = "x" | "o" | null;
type Question = {
  text: string;
  options: string[];
  type?: "mcq" | "true_false";
  imageUrl?: string | null;
  duration?: number;
  remainingSecs?: number;
};
type Player = { id: string; name: string; team: "x" | "o"; connected: boolean };
type Snapshot = { board?: Mark[]; turn?: "x" | "o"; phase?: string; question?: Question | null; timerRemainingSecs?: number; timerExpiresAt?: number | null; turnId?: number; activePlayerId?: string | null; players?: Player[]; teamNames?: { x: string; o: string }; title?: string; placementPlayerId?: string | null; started?: boolean; winner?: "x" | "o" | "draw" | null };

function getWinningCells(board: Mark[]): number[] {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  return lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) ?? [];
}

export default function XoPlay() {
  const { pin = "" } = useParams<{ pin: string }>();
  const search = useSearch();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const creator = new URLSearchParams(search).get("creator") === "1";
  const controlToken = creator && typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem(`xo-control-${pin}`) || undefined
    : undefined;
  const name = new URLSearchParams(search).get("name") || "";
  const [, navigate] = useLocation();
  const goBack = useSmartBack(creator ? "/game/xo/create" : "/game/xo/join");
  const leaveGameSafely = useCallback(() => {
    // Returning to a permanent public launch link would immediately create a
    // new room after the host ended this one.
    if (creator && controlToken) navigate("/game/xo/create", { replace: true });
    else goBack();
  }, [creator, controlToken, goBack, navigate]);

  const [snapshot, setSnapshot] = useState<Snapshot>({ board: Array(9).fill(null), phase: "connecting" });
  const [selected, setSelected] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<boolean | null>(null);
  const [muted, setMuted] = useState(getIsMuted);
  const [time, setTime] = useState(0);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);
  const playerIdRef = useRef<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const arRef = useRef(ar);
  arRef.current = ar;
  const leaveRef = useRef(leaveGameSafely);
  leaveRef.current = leaveGameSafely;
  const initialiseRef = useRef<() => void>(() => {});
  const socketRef = useRef(getXoSocket());
  const previousStarted = useRef(false);
  const previousWinner = useRef<Snapshot["winner"]>(null);
  const previousBoard = useRef<Mark[]>(Array(9).fill(null));

  const merge = useCallback((data: Snapshot) => {
    const previous = snapshotRef.current;
    if (data.turnId !== previous.turnId || data.activePlayerId !== previous.activePlayerId || data.phase !== previous.phase) {
      setSelected(null);
      setAnswerResult(null);
      pendingRef.current = false;
      setPendingAction(null);
    }
    const next = { ...previous, ...data, board: data.board ?? previous.board, question: data.question === null ? null : data.question ?? previous.question };
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const socket = socketRef.current;
    let disposed = false;
    const initialise = () => {
      setConnected(socket.connected);
      setReady(false);
      setConnectionError("");
      const onFailure = (message: unknown) => {
        if (disposed) return;
        setConnectionError(localizeXoError(message, arRef.current, arRef.current ? "تعذر الاتصال بالغرفة، حاول مجددًا" : "Could not connect to the room. Please retry."));
      };
      if (creator) socket.timeout(8000).emit("xo:reclaim-host", { pin, controlToken }, (err: Error | null, r?: Snapshot & { error?: string }) => {
        if (disposed) return;
        if (err || r?.error || !r) return onFailure(r?.error);
        merge(r);
        setReady(true);
      });
      else {
        let stored: { id?: string; rejoinToken?: string } = {};
        try { stored = JSON.parse(localStorage.getItem(`xo-player-${pin}`) || "{}"); } catch {}
        socket.timeout(8000).emit("xo:join", { pin, name, playerId: stored.id, rejoinToken: stored.rejoinToken }, (err: Error | null, joined?: { error?: string; state?: Snapshot; player?: { id: string; rejoinToken: string } }) => {
          if (disposed) return;
          if (err || joined?.error || !joined?.state || !joined.player) return onFailure(joined?.error);
          if (joined.player) {
            playerIdRef.current = joined.player.id;
            setPlayerId(joined.player.id);
            try { localStorage.setItem(`xo-player-${pin}`, JSON.stringify(joined.player)); } catch {}
          }
          if (joined.state) merge(joined.state);
          setReady(true);
        });
      }
    };
    initialiseRef.current = initialise;
    const onDisconnect = () => {
      setConnected(false);
      setReady(false);
      pendingRef.current = false;
      setPendingAction(null);
      setSelected(null);
    };
    const onConnectError = () => {
      onDisconnect();
      setConnectionError(arRef.current ? "تعذر الاتصال بالخادم. نعيد المحاولة تلقائيًا." : "Could not connect to the server. Retrying automatically.");
    };
    socket.on("connect", initialise);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    if (!socket.connected) socket.connect();
    const events: Array<[string, (d: Snapshot) => void]> = [["xo:state", merge]];
    events.forEach(([e, h]) => socket.on(e, h));

    const onAnswerResult = (d: { correct?: boolean; playerId?: string }) => {
      if (typeof d.correct === "boolean") {
        if (d.playerId === playerIdRef.current) setAnswerResult(d.correct);
        d.correct ? playCorrectSound() : playWrongSound();
      }
    };
    socket.on("xo:answer-result", onAnswerResult);

    const onEnded = () => {
      if (!creator) toast.info(arRef.current ? "أنهى المعلم اللعبة" : "The teacher ended the game");
      leaveRef.current();
    };
    socket.on("xo:ended", onEnded);
    const onError = (d: { message?: string } | string) => {
      const message = typeof d === "string" ? d : d.message;
      toast.error(localizeXoError(message, arRef.current, arRef.current ? "خطأ في اللعبة" : "X O error"));
    };
    socket.on("xo:error", onError);
    if (socket.connected) initialise();
    return () => {
      mountedRef.current = false;
      disposed = true;
      events.forEach(([e, h]) => socket.off(e, h));
      socket.off("connect", initialise);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("xo:answer-result", onAnswerResult);
      socket.off("xo:ended", onEnded);
      socket.off("xo:error", onError);
      if (socket.connected) socket.emit("xo:leave", { pin });
      // Don't leave a background socket connected when this game screen closes.
      socket.disconnect();
    };
  }, [creator, controlToken, merge, name, pin]);

  useEffect(() => {
    if (!snapshot.started || !snapshot.timerExpiresAt || !["question", "placement"].includes(snapshot.phase || "")) {
      setTime(0);
      return;
    }
    const tick = () => setTime(Math.max(0, Math.ceil((snapshot.timerExpiresAt! - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 250);
    return () => clearInterval(t);
  }, [snapshot.started, snapshot.timerExpiresAt, snapshot.phase]);

  useEffect(() => {
    const active = snapshot.started && snapshot.phase !== "finished" && !snapshot.winner;
    if (active) startBackgroundBeat();
    else stopBackgroundBeat();
    return stopBackgroundBeat;
  }, [snapshot.phase, snapshot.started, snapshot.winner]);

  useEffect(() => {
    if (snapshot.started && !previousStarted.current) playGameStartSound();
    previousStarted.current = Boolean(snapshot.started);
  }, [snapshot.started]);

  useEffect(() => {
    if (snapshot.phase === "question" && time > 0 && time <= 5) playTickSound();
  }, [snapshot.phase, time]);

  useEffect(() => {
    if (snapshot.winner && snapshot.winner !== previousWinner.current) {
      snapshot.winner === "draw" ? playTimeUpSound() : playVictoryFanfare();
    }
    previousWinner.current = snapshot.winner;
  }, [snapshot.winner]);

  useEffect(() => {
    const nextBoard = snapshot.board ?? Array(9).fill(null);
    const previousMarks = previousBoard.current.filter(Boolean).length;
    const nextMarks = nextBoard.filter(Boolean).length;
    if (nextMarks > previousMarks) playNotificationSound();
    previousBoard.current = [...nextBoard];
  }, [snapshot.board]);

  const emit = (event: string, data: object = {}) => {
    if (pendingRef.current) return;
    if (!connected || !ready) {
      toast.error(ar ? "انتظر استعادة الاتصال بالغرفة" : "Wait for the room connection to recover");
      return;
    }
    pendingRef.current = true;
    setPendingAction(event);
    const sentTurnId = snapshotRef.current.turnId;
    socketRef.current.timeout(8000).emit(`xo:${event}`, {
      pin,
      turnId: sentTurnId,
      ...(creator && controlToken ? { controlToken } : {}),
      ...data,
    }, (err: Error | null, response?: { error?: string; success?: boolean }) => {
      if (!mountedRef.current) return;
      if (snapshotRef.current.turnId !== sentTurnId) return;
      pendingRef.current = false;
      setPendingAction(null);
      if (err || response?.error || !response?.success) {
        if (event === "answer") setSelected(null);
        toast.error(localizeXoError(response?.error, arRef.current, arRef.current ? "تعذر تنفيذ الإجراء، حاول مجددًا" : "The action failed. Please retry."));
        if (err) initialiseRef.current();
      }
    });
  };
  const toggleMute = () => {
    const nextMuted = toggleGameMute();
    setMuted(nextMuted);
    if (!nextMuted && snapshot.started && snapshot.phase !== "finished" && !snapshot.winner) {
      startBackgroundBeat();
    }
  };

  const question = snapshot.question;
  const board = snapshot.board || Array(9).fill(null);
  const winningCells = getWinningCells(board);
  const canPlace = !creator && ready && connected && !pendingAction && snapshot.phase === "placement" && snapshot.placementPlayerId === playerId;
  const canAnswer = !creator && ready && connected && !pendingAction && snapshot.started && snapshot.phase === "question" && snapshot.activePlayerId === playerId;
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}game/xo/join/${pin}`;
  // During a match every share entry must join THIS room, never create a new host room.
  const primaryShare = useGameShareUrl(joinUrl);
  const turn = snapshot.turn ?? "x";
  const team = normalizeXoTeamName(snapshot.teamNames?.[turn], turn, ar ? "ar" : "en");
  const myTeam = snapshot.players?.find(p => p.id === playerId)?.team;
  const activePlayer = snapshot.players?.find(p => p.id === snapshot.activePlayerId);
  const connectedPlayers = snapshot.players?.filter(p => p.connected) || [];
  const teamsReady = connectedPlayers.some(p => p.team === "x") && connectedPlayers.some(p => p.team === "o");
  const isFinished = snapshot.phase === "finished" || snapshot.winner;

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#06131f] text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 8%, rgba(39, 112, 83, 0.24), transparent 36%), linear-gradient(135deg, #06131f 0%, #091b29 48%, #07151f 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[15%] h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute right-[-10%] top-[20%] h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          }}
        />
      </div>
      {/* A CSS backdrop filter here traps the QR overlay's fixed positioning inside this header. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0d1e2d] px-4 py-3 text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Grid3X3 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 title={snapshot.title} className="truncate font-black leading-tight text-white"><XoTitle title={snapshot.title} lang={ar ? "ar" : "en"} /></h1>
            <div className="text-xs font-bold tracking-widest text-muted-foreground flex items-center gap-1.5" dir="ltr">
              {ar ? "الرمز" : "PIN"}: <span className="font-mono text-primary">{pin}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
           {creator && <QRModalButton url={joinUrl} pin={pin} label="QR" variant="light" />}
          <button
             onClick={async () => {
               try {
                 if (primaryShare.status !== "ready") return;
                 await navigator.clipboard?.writeText(primaryShare.url);
                  toast.success(ar ? "تم نسخ رابط انضمام الطلاب لهذه الغرفة" : "Student join link copied");
               } catch {
                 toast.error(ar ? "تعذّر نسخ الرابط" : "Could not copy the link");
               }
             }}
              aria-label={ar ? "نسخ رابط انضمام الطلاب" : "Copy student join link"}
            className="rounded-lg border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            disabled={primaryShare.status !== "ready"}
          >
            <Copy className="h-5 w-5" />
          </button>
            <button
              type="button"
              aria-label={ar ? "الخروج من اللعبة" : "Leave game"}
              onClick={() => creator ? emit("end") : leaveGameSafely()}
              disabled={creator && (!ready || !connected || !!pendingAction)}
              className="rounded-lg border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? (ar ? "تشغيل الصوت" : "Unmute") : (ar ? "كتم الصوت" : "Mute")}
            className="rounded-lg border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        </div>
      </header>
      {primaryShare.status === "pending" && <p role="status" className="text-center text-xs text-muted-foreground">{ar ? "جارٍ تجهيز الرابط القصير…" : "Preparing short link…"}</p>}
      {primaryShare.status === "error" && <button type="button" role="alert" onClick={primaryShare.retry} className="text-center text-xs text-red-500 underline">{ar ? "تعذّر تجهيز الرابط — إعادة المحاولة" : "Could not prepare link — retry"}</button>}
      {(!connected || connectionError) && (
        <div role="alert" className="relative z-20 flex flex-wrap items-center justify-center gap-3 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          <span>{connectionError || (ar ? "جارٍ الاتصال بالغرفة… لا تغلق الصفحة" : "Connecting to the room… keep this page open")}</span>
          <button type="button" className="underline" onClick={() => socketRef.current.connected ? initialiseRef.current() : socketRef.current.connect()}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
          {connectionError && <button type="button" className="underline" onClick={leaveGameSafely}>{ar ? "رجوع" : "Go back"}</button>}
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto mb-5 max-w-5xl">
          <XoTeamRoster players={snapshot.players || []} teamNames={snapshot.teamNames} activePlayerId={isFinished ? null : snapshot.activePlayerId} myPlayerId={playerId} started={!!snapshot.started} ar={ar} />
          {creator && !snapshot.started && (
            <p className="mt-3 text-center text-sm font-bold text-white/90">
              {ar ? "شارك رابط الانضمام أو QR؛ يبدأ اللعب بعد اتصال طالب واحد على الأقل في كل فريق." : "Share the join link or QR. At least one student must be online in each team to start."}
            </p>
          )}
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1fr] xl:gap-10 h-full">

          {/* Question / Status Panel */}
          <section className="flex flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/[0.96] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] relative">
            <div className="mb-6 flex items-center justify-between z-10">
              <span className={cn(
                "rounded-full px-4 py-1.5 text-sm font-black shadow-sm flex items-center gap-2",
                snapshot.turn === 'x' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
              )}>
                {snapshot.turn === 'x' ? <X className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4" strokeWidth={3} />}
                {ar ? "دور" : "Turn"}: {team}
              </span>

              {snapshot.started && (snapshot.phase === "question" || snapshot.phase === "placement") && (
                <span className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black transition-colors",
                  time <= 5 ? "bg-red-100 text-red-600 animate-pulse" : "bg-muted text-muted-foreground"
                )}>
                  <Clock className="h-4 w-4" />
                  {time}
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center z-10">
              {question ? (
                <div className="animate-in fade-in duration-500 space-y-5">
                   <p role="status" data-testid="xo-turn-status" className="text-center text-sm font-bold text-primary">
                     {canAnswer
                       ? (ar ? "أنت ممثل فريقك الآن — أجب عن السؤال" : "You represent your team now — answer the question")
                       : activePlayer
                         ? (ar ? `بانتظار إجابة ${activePlayer.name} — سيتناوب أعضاء الفريق` : `Waiting for ${activePlayer.name} — team members take turns`)
                         : (ar ? "بانتظار اتصال ممثل الفريق" : "Waiting for a team representative to connect")}
                   </p>
                  <h2 className="text-xl sm:text-2xl font-black leading-relaxed text-foreground text-center">{question.text}</h2>

                  {question.imageUrl && (
                    <QuestionImage src={question.imageUrl} alt="" className="mx-auto max-h-48 w-full rounded-2xl object-contain bg-muted/20 border" />
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {question.options.slice(0, 4).map((o, i) => {
                      const isSelected = selected === i;
                      const answerColor = XO_ANSWER_COLORS[i] ?? XO_ANSWER_COLORS[0];
                      const optionText = question.type === "true_false"
                        ? (i === 0 ? (ar ? "صح" : "True") : (ar ? "خطأ" : "False"))
                        : o;
                      let btnState = "default";
                      if (isSelected) {
                        if (answerResult === true) btnState = "correct";
                        else if (answerResult === false) btnState = "wrong";
                        else btnState = "selected";
                      }

                      return (
                        <button
                          key={i}
                          disabled={selected !== null || !canAnswer}
                          onClick={() => {
                            if (!canAnswer || pendingRef.current) return;
                            setSelected(i);
                            emit("answer", { answerIndex: i, playerId });
                          }}
                          className={cn(
                            "group flex min-h-[4rem] items-center rounded-2xl border-2 p-3 text-start font-bold transition-all",
                            btnState === "default" && "border-white/20 text-white hover:brightness-110",
                            btnState === "selected" && "border-primary bg-primary/10 shadow-sm",
                            btnState === "correct" && "fb-correct-once border-green-500 bg-green-500 text-white shadow-lg",
                            btnState === "wrong" && "fb-wrong-once border-red-500 bg-red-500 text-white shadow-lg",
                            ((selected !== null && !isSelected) || !canAnswer) && "opacity-50 cursor-not-allowed"
                          )}
                          style={btnState === "default" ? { background: answerColor.background, boxShadow: answerColor.shadow } : undefined}
                        >
                          <span className={cn(
                            "me-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-sm",
                            btnState === "default" ? "text-white" :
                            btnState === "selected" ? "bg-primary text-primary-foreground" : "bg-white/20 text-white"
                          )}
                            style={btnState === "default" ? { background: answerColor.badge } : undefined}>
                            {(ar ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"])[i]}
                          </span>
                          <span className="flex-1">{optionText}</span>
                          {btnState === "correct" && <CheckCircle className="ms-2 h-5 w-5 text-white" />}
                          {btnState === "wrong" && <XCircle className="ms-2 h-5 w-5 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-4 animate-in fade-in">
                  {snapshot.phase === "finished" ? (
                    <>
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                        <Grid3X3 className="h-8 w-8" />
                      </div>
                      <p className="text-xl font-black text-foreground">{ar ? "انتهت اللعبة" : "Game finished"}</p>
                    </>
                  ) : snapshot.phase === "placement" ? (
                    <>
                      <Clock className="h-10 w-10 animate-pulse text-primary mb-2" />
                      <p className="text-lg font-bold">{activePlayer
                        ? (ar ? `${activePlayer.name} يختار الخانة` : `${activePlayer.name} is choosing a cell`)
                        : (ar ? "بانتظار اتصال زميل لاختيار الخانة…" : "Waiting for a teammate to connect and choose…")}</p>
                      {canPlace && <p className="text-primary font-black animate-bounce mt-2">{ar ? "اختر خانتك الآن!" : "Choose your cell now!"}</p>}
                    </>
                  ) : (
                    <>
                      <Users className="h-10 w-10 text-primary" />
                      <p className="text-lg font-bold">{ar ? "غرفة الانتظار" : "Waiting room"}</p>
                      <p className="text-sm">{ar ? "ينضم الطلاب ثم يبدأ المعلم المباراة" : "Students join, then the teacher starts the match"}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Teacher Controls (Host) */}
            {creator && !isFinished && (
              <div className="mt-6 flex flex-wrap gap-2 border-t pt-4 z-10">
                {snapshot.phase === "connecting" || !snapshot.started ? (
                  <button data-testid="xo-start-game" disabled={!ready || !connected || !teamsReady || !!pendingAction} onClick={() => emit("start")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                    <Play className="h-5 w-5 fill-current" /> {ar ? "ابدأ اللعبة" : "Start Game"}
                  </button>
                ) : (
                  <>
                    <button disabled={!ready || !connected || !!pendingAction} onClick={() => emit("skip")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 font-bold text-amber-600 hover:bg-amber-500/20 disabled:opacity-50">
                      <SkipForward className="h-5 w-5" /> {ar ? "تخطي السؤال" : "Skip Question"}
                    </button>
                    <button disabled={!ready || !connected || !!pendingAction} onClick={() => emit("end-early")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50">
                      <Square className="h-5 w-5 fill-current" /> {ar ? "إنهاء مبكر" : "End Early"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Board Panel */}
          <section className={cn(
            "flex flex-col items-center justify-center rounded-3xl p-6 shadow-lg transition-colors duration-500",
            snapshot.winner ? "bg-slate-900" : "bg-card border"
          )}>
            <div className="mb-8 text-center w-full">
              {snapshot.winner ? (
                <div className="animate-in slide-in-from-top-4 fade-in">
                  {snapshot.winner !== "draw" && (
                    <span className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg">
                      <Trophy className="h-4 w-4" />
                      {ar ? "بطل المباراة" : "Match champion"}
                    </span>
                  )}
                  <h2 className="text-4xl font-black text-white">
                    {snapshot.winner === "draw"
                      ? (ar ? "تعادل!" : "Draw!")
                      : (
                        <span className="flex flex-col items-center gap-2">
                          <span className={cn(
                            "flex h-16 w-16 items-center justify-center rounded-full mb-2",
                            snapshot.winner === 'x' ? "bg-blue-600" : "bg-amber-500"
                          )}>
                            {snapshot.winner === 'x' ? <X className="h-8 w-8 text-white" strokeWidth={3} /> : <Circle className="h-8 w-8 text-white" strokeWidth={3} />}
                          </span>
                          {snapshot.teamNames?.[snapshot.winner] ?? snapshot.winner.toUpperCase()}
                          <span className="text-2xl text-slate-300 mt-1">{ar ? "فاز!" : "wins!"}</span>
                        </span>
                      )}
                  </h2>
                </div>
              ) : (
                <h2 className={cn("text-lg font-black", canPlace ? "text-primary animate-pulse" : "text-foreground")}>
                  {canPlace ? (ar ? "اختر خانة خلال 20 ثانية" : "Choose a cell within 20 seconds")
                    : snapshot.phase === "placement" ? (ar ? "ممثل الفريق يختار الخانة" : "The team representative chooses a cell")
                    : !snapshot.started ? (ar ? "اللوحة المشتركة للفريقين" : "Shared board for both teams")
                    : (ar ? "أجب لتضع علامتك" : "Answer correctly to place your mark")}
                </h2>
              )}
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-[340px] rounded-[2rem] bg-gradient-to-br from-[#367a58] via-[#225739] to-[#153b29] p-3 shadow-[0_24px_55px_rgba(15,60,40,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] ring-4 ring-[#d6b65c]/30 sm:p-4">
              <div className="pointer-events-none absolute inset-2 rounded-[1.6rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
              {/* Interactive Cells */}
              <div role="grid" aria-label={ar ? "لوحة X O" : "X O board"} className="relative grid h-full grid-cols-3 grid-rows-3 gap-2.5 sm:gap-3">
                {board.map((mark, i) => {
                  const isX = mark === "x";
                  const isO = mark === "o";
                  const interactive = canPlace && !mark && !snapshot.winner;

                  return (
                    <button
                      key={i}
                      role="gridcell"
                      disabled={!interactive}
                      aria-label={`${ar ? "المربع" : "Cell"} ${i + 1}${mark ? `: ${mark.toUpperCase()}` : ""}`}
                      onClick={() => emit("place", { cell: i, playerId })}
                      className={cn(
                        "group relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-[#fffdf5] to-emerald-50 shadow-[0_6px_0_rgba(9,45,29,0.28),0_10px_20px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] transition-all duration-300",
                        interactive && "cursor-pointer ring-2 ring-[#e2c56f]/50 hover:-translate-y-1 hover:scale-[1.03] hover:from-amber-50 hover:via-white hover:to-emerald-100 hover:ring-[#f2d77e] hover:shadow-[0_9px_0_rgba(9,45,29,0.25),0_16px_28px_rgba(0,0,0,0.2),0_0_24px_rgba(242,215,126,0.35)] active:translate-y-0 active:scale-95",
                        isX && "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100 shadow-[0_6px_0_rgba(30,64,175,0.25),0_12px_24px_rgba(37,99,235,0.18)]",
                        isO && "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-[0_6px_0_rgba(180,83,9,0.22),0_12px_24px_rgba(245,158,11,0.18)]",
                        winningCells.includes(i) && "z-10 scale-[1.04] animate-pulse ring-4 ring-[#f7d66a] shadow-[0_0_32px_rgba(247,214,106,0.8)]"
                      )}
                    >
                      {!mark && interactive && <span className="h-3 w-3 rounded-full bg-[#225739]/18 shadow-inner transition-transform group-hover:scale-125" />}
                      {isX && <X strokeWidth={3} className="h-14 w-14 text-blue-600 drop-shadow-[0_3px_3px_rgba(37,99,235,0.28)] animate-in zoom-in spin-in-12 duration-300" />}
                      {isO && <Circle strokeWidth={4} className="h-12 w-12 text-amber-500 drop-shadow-[0_3px_3px_rgba(245,158,11,0.3)] animate-in zoom-in duration-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {isFinished && (
              <button
                onClick={() => creator ? emit("end") : leaveGameSafely()}
                className="mt-10 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-black text-primary-foreground shadow-lg hover:bg-primary/90"
                data-testid="button-xo-exit"
              >
                <LogOut className="h-5 w-5" />
                {ar ? "خروج والرجوع" : "Exit and go back"}
              </button>
            )}

            {/* Show my team badge for players */}
            {!creator && myTeam && !isFinished && (
              <div className="mt-8 flex items-center justify-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-bold shadow-sm">
                <span className="text-muted-foreground">{ar ? "فريقك:" : "Your team:"}</span>
                <span className={cn("flex items-center gap-1", myTeam === 'x' ? 'text-blue-600' : 'text-amber-500')}>
                  {myTeam === 'x' ? <X className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4" strokeWidth={3} />}
                  {normalizeXoTeamName(snapshot.teamNames?.[myTeam], myTeam, ar ? "ar" : "en")}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>

      {isFinished && snapshot.winner !== "draw" && <ConfettiBurst active={true} />}
    </main>
  );
}