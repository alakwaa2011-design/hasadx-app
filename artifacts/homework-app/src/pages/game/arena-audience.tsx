import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tv2, ChevronLeft, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

interface AudienceTeam {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
}

interface AudienceActiveQuestion {
  questionText: string;
  difficulty: number;
  subCategoryName: string;
}

interface ShuraVotes {
  a: number;
  b: number;
}

interface AudienceSession {
  tournamentName: string;
  teams: AudienceTeam[];
  currentTurn: string;
  activeQuestion: AudienceActiveQuestion | null;
  ended?: boolean;
  shuraActive: boolean;
  shuraVotes: ShuraVotes;
  shuraRoundId: string;
}

type PageState = "loading" | "not-found" | "live";

const DIFF_LABELS: Record<number, string> = { 200: "سهل", 400: "متوسط", 600: "صعب" };
const DIFF_COLORS: Record<number, string> = {
  200: "linear-gradient(135deg,#2457a8,#1e408e)",
  400: "linear-gradient(135deg,#5525a8,#421e88)",
  600: "linear-gradient(135deg,#922340,#7a1c34)",
};

const CONFETTI_COLORS = [
  "#fbbf24", "#34d399", "#60a5fa", "#f472b6",
  "#a78bfa", "#fb923c", "#f87171", "#4ade80",
];

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
  shape: "rect" | "circle";
}

function Confetti() {
  const pieces = useRef<ConfettiPiece[]>(
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    })),
  ).current;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -20,
            width: p.shape === "circle" ? p.size : p.size * 0.7,
            height: p.shape === "circle" ? p.size : p.size * 1.4,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            background: p.color,
            opacity: 0.9,
          }}
          animate={{
            y: ["0vh", "110vh"],
            rotate: [p.rotation, p.rotation + 720],
            opacity: [0.9, 0.9, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

function EndScreen({ session, sorted }: { session: AudienceSession; sorted: AudienceTeam[] }) {
  const winner = sorted[0];
  const topScore = winner?.score ?? 0;
  const isMultiWinner = sorted.filter(t => t.score === topScore).length > 1;

  const rankMedal = (rank: number) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return `${rank + 1}`;
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #1a0a40 0%, #0a0520 60%, #000 100%)" }}
    >
      <Confetti />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-5 mt-6">

        {/* Game over badge */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="text-6xl">🏆</div>
          <h1
            className="text-3xl sm:text-4xl font-black text-center text-transparent bg-clip-text"
            style={{
              backgroundImage: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
              lineHeight: 1.25,
              paddingBottom: "0.05em",
            }}
          >
            انتهت اللعبة!
          </h1>
          <div className="text-amber-300/70 font-bold text-sm tracking-widest">
            {session.tournamentName}
          </div>
        </motion.div>

        {/* Winner highlight */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 24 }}
            className="w-full rounded-2xl overflow-hidden border-2"
            style={{
              borderColor: winner.color,
              background: `linear-gradient(135deg, ${winner.color}33 0%, ${winner.color}11 100%)`,
              boxShadow: `0 0 32px ${winner.color}55`,
            }}
          >
            <div className="flex flex-col items-center py-6 px-4 gap-2">
              <div className="text-5xl">{winner.emoji}</div>
              <div className="font-black text-2xl text-white">{winner.name}</div>
              <div
                className="font-black text-4xl tabular-nums"
                style={{ color: winner.color }}
              >
                {winner.score.toLocaleString("ar-SA")}
              </div>
              <div className="text-amber-200/60 text-sm font-bold">
                {isMultiWinner ? "تعادل في المركز الأول" : "الفائز 🏆"}
              </div>
            </div>
          </motion.div>
        )}

        {/* Full scoreboard */}
        {sorted.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full rounded-2xl overflow-hidden border border-amber-400/20 bg-white/5"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span className="text-amber-200 font-bold text-sm">ترتيب الفرق</span>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {sorted.map((team, rank) => {
                const maxScore = sorted[0]?.score || 1;
                const barPct = maxScore > 0 ? Math.max(6, Math.round((team.score / maxScore) * 100)) : 6;
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + rank * 0.08, type: "spring", stiffness: 300, damping: 30 }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: rank === 0 ? `${team.color}22` : "rgba(255,255,255,0.04)",
                      border: rank === 0 ? `1.5px solid ${team.color}66` : "1.5px solid transparent",
                    }}
                  >
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center font-black text-sm">
                      {rankMedal(rank)}
                    </div>
                    <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                      <span className="text-lg">{team.emoji}</span>
                      <span className="font-bold text-sm text-white truncate">{team.name}</span>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: team.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ delay: 0.7 + rank * 0.08, type: "spring", stiffness: 120, damping: 20 }}
                      />
                    </div>
                    <div
                      className="flex-shrink-0 font-black text-sm tabular-nums"
                      style={{ color: team.color, minWidth: "3rem", textAlign: "start" }}
                    >
                      {team.score.toLocaleString("ar-SA")}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Back button */}
        <div className="mt-4 mb-6">
          <Link href="/games">
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition text-sm">
              <ChevronLeft className="w-4 h-4" />
              الرئيسية
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function getVoteStorageKey(code: string, roundId: string) {
  return `hasad_arena_voted_${code}_${roundId}`;
}

function getSavedVoteForRound(code: string, roundId: string): "a" | "b" | null {
  if (!roundId) return null;
  try {
    const v = localStorage.getItem(getVoteStorageKey(code, roundId));
    if (v === "a" || v === "b") return v;
  } catch { /* ignore */ }
  return null;
}

function saveVoteForRound(code: string, roundId: string, choice: "a" | "b") {
  if (!roundId) return;
  try {
    localStorage.setItem(getVoteStorageKey(code, roundId), choice);
  } catch { /* ignore */ }
}


export default function ArenaAudience() {
  const code = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("code") ?? "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [session, setSession] = useState<AudienceSession | null>(null);
  const [myVote, setMyVote] = useState<"a" | "b" | null>(null);
  const [voting, setVoting] = useState(false);
  // Track the last seen shuraRoundId so we detect round transitions
  const prevRoundIdRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    if (!code) { setPageState("not-found"); return; }
    try {
      const res = await fetch(`/api/arena/session/${encodeURIComponent(code)}`);
      if (res.status === 404) { setPageState("not-found"); return; }
      if (!res.ok) return;
      const data: AudienceSession = await res.json();

      // When the round ID changes (new shura activation), sync myVote from localStorage.
      // This handles the refresh case: a stored vote for this round is restored;
      // a stored vote for a previous round is not, allowing re-voting.
      if (data.shuraRoundId !== prevRoundIdRef.current) {
        prevRoundIdRef.current = data.shuraRoundId;
        setMyVote(getSavedVoteForRound(code, data.shuraRoundId));
      }

      setSession(data);
      setPageState("live");
    } catch {
      /* network error — keep previous state, retry next tick */
    }
  };

  useEffect(() => {
    void poll();
    intervalRef.current = setInterval(() => { void poll(); }, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVote = async (choice: "a" | "b") => {
    if (myVote || voting || !session?.shuraActive) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/arena/session/${encodeURIComponent(code)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; shuraVotes: ShuraVotes };
        saveVoteForRound(code, session?.shuraRoundId ?? "", choice);
        setMyVote(choice);
        // Optimistically update vote counts in session
        setSession(prev => prev ? { ...prev, shuraVotes: data.shuraVotes } : prev);
      }
    } catch { /* silent */ } finally {
      setVoting(false);
    }
  };

  const sorted = session
    ? [...session.teams].sort((a, b) => b.score - a.score)
    : [];

  if (pageState === "live" && session?.ended) {
    return <EndScreen session={session} sorted={sorted} />;
  }
  const shuraTotal = session ? session.shuraVotes.a + session.shuraVotes.b : 0;
  const shuraPctA = shuraTotal > 0 ? Math.round((session!.shuraVotes.a / shuraTotal) * 100) : 50;
  const shuraPctB = 100 - shuraPctA;

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #065f46 0%, #022c22 60%, #000 100%)" }}
    >
      {/* Header */}
      <div className="w-full max-w-lg mt-4 mb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-400/15 border-2 border-amber-300/40 mb-3">
          <Tv2 className="w-8 h-8 text-amber-300" />
        </div>
        <h1
          className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-yellow-200 to-amber-400"
          style={{ lineHeight: 1.25, paddingBottom: "0.05em" }}
        >
          {session?.tournamentName || "تحدّي حصاد"}
        </h1>
        {code && (
          <div className="mt-1 text-amber-400/60 font-mono text-xs tracking-widest">
            {code}
          </div>
        )}
      </div>

      <div className="w-full max-w-lg flex flex-col gap-4">

        {/* ── Loading ── */}
        {pageState === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-8 text-center border border-white/10 bg-white/5"
          >
            <div className="text-amber-300/70 text-lg animate-pulse">جارٍ الاتصال بالجلسة…</div>
          </motion.div>
        )}

        {/* ── Not found ── */}
        {pageState === "not-found" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-8 text-center border-2 border-amber-400/20 bg-amber-400/5"
          >
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-amber-200 font-bold text-lg mb-1">الجلسة غير موجودة</div>
            <div className="text-emerald-100/60 text-sm">
              تأكد من رمز الجلسة، أو أن الأستاذ بدأ اللعبة على جهازه
            </div>
          </motion.div>
        )}

        {/* ── Ended — handled by early return above ── */}

        {/* ── Live ── */}
        {pageState === "live" && session && !session.ended && (
          <>
            {/* Current question card */}
            <AnimatePresence mode="wait">
              {session.activeQuestion ? (
                <motion.div
                  key={session.activeQuestion.questionText}
                  initial={{ opacity: 0, y: -12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                  className="rounded-2xl overflow-hidden border-2"
                  style={{ borderColor: "rgba(212,167,58,0.5)" }}
                >
                  {/* Difficulty bar */}
                  <div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ background: DIFF_COLORS[session.activeQuestion.difficulty] ?? DIFF_COLORS[200] }}
                  >
                    <span className="text-white/90 font-black text-sm">
                      {DIFF_LABELS[session.activeQuestion.difficulty] ?? ""}
                    </span>
                    <span className="text-white/60 text-xs font-bold">
                      {session.activeQuestion.difficulty} نقطة
                    </span>
                    <span className="mr-auto text-white/70 text-xs">
                      {session.activeQuestion.subCategoryName}
                    </span>
                  </div>
                  {/* Question text */}
                  <div
                    className="px-5 py-5"
                    style={{ background: "linear-gradient(160deg,#0f3d2a,#0a2b1e)" }}
                  >
                    <div
                      className="text-white font-bold leading-relaxed"
                      style={{ fontSize: "clamp(16px,4.5vw,22px)" }}
                    >
                      {session.activeQuestion.questionText}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl p-6 text-center border border-white/10 bg-white/5 flex items-center justify-center gap-3"
                >
                  <Clock className="w-5 h-5 text-amber-300/60 animate-pulse" />
                  <span className="text-emerald-100/70 font-bold">
                    انتظر السؤال القادم…
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Shura voting card ── */}
            <AnimatePresence>
              {session.shuraActive && (
                <motion.div
                  key="shura-vote"
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="rounded-2xl overflow-hidden border-2"
                  style={{ borderColor: "rgba(96,165,250,0.55)", background: "linear-gradient(160deg,#0c2a4a,#071d35)" }}
                >
                  {/* Card header */}
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg,#1e3a5f,#163356)" }}>
                    <span className="text-xl">🗣️</span>
                    <span className="text-blue-200 font-black text-sm">شورى الجمهور — صوّت الآن!</span>
                  </div>

                  <div className="px-4 py-4 flex flex-col gap-3">
                    {myVote ? (
                      /* ── Already voted: show results ── */
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-blue-200 text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          صوّتَ لـ «{myVote === "a" ? "خيار أ" : "خيار ب"}» — شكراً!
                        </div>
                        {/* Bar A */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-blue-100/80">
                            <span>خيار أ</span>
                            <span>{session.shuraVotes.a} صوت ({shuraPctA}٪)</span>
                          </div>
                          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-blue-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${shuraPctA}%` }}
                              transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            />
                          </div>
                        </div>
                        {/* Bar B */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold text-blue-100/80">
                            <span>خيار ب</span>
                            <span>{session.shuraVotes.b} صوت ({shuraPctB}٪)</span>
                          </div>
                          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-violet-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${shuraPctB}%` }}
                              transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            />
                          </div>
                        </div>
                        <div className="text-center text-blue-100/40 text-xs">
                          {shuraTotal} صوت إجمالاً
                        </div>
                      </div>
                    ) : (
                      /* ── Not voted yet: show buttons ── */
                      <>
                        <p className="text-blue-100/80 text-sm text-center mb-1">
                          ما رأيك في إجابة السؤال؟ اختر أحد الخيارين:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => void handleVote("a")}
                            disabled={voting}
                            className="py-5 rounded-xl font-black text-xl border-2 border-blue-400/60 bg-blue-500/25 hover:bg-blue-500/40 text-blue-100 transition disabled:opacity-50"
                          >
                            خيار أ
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => void handleVote("b")}
                            disabled={voting}
                            className="py-5 rounded-xl font-black text-xl border-2 border-violet-400/60 bg-violet-500/25 hover:bg-violet-500/40 text-violet-100 transition disabled:opacity-50"
                          >
                            خيار ب
                          </motion.button>
                        </div>
                        <div className="text-center text-blue-100/30 text-xs">
                          يمكنك التصويت مرة واحدة فقط
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scoreboard */}
            <div className="rounded-2xl overflow-hidden border border-amber-400/20 bg-white/5">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <Trophy className="w-4 h-4 text-amber-300" />
                <span className="text-amber-200 font-bold text-sm">لوحة النقاط</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <AnimatePresence>
                  {sorted.map((team, rank) => {
                    const maxScore = sorted[0]?.score || 1;
                    const barPct = maxScore > 0 ? Math.max(6, Math.round((team.score / maxScore) * 100)) : 6;
                    const isCurrentTurn = team.id === session.currentTurn;
                    return (
                      <motion.div
                        key={team.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{
                          background: isCurrentTurn
                            ? `${team.color}22`
                            : "rgba(255,255,255,0.04)",
                          border: isCurrentTurn
                            ? `1.5px solid ${team.color}66`
                            : "1.5px solid transparent",
                        }}
                      >
                        {/* Rank */}
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs"
                          style={{
                            background: rank === 0 ? "#d4a73a" : rank === 1 ? "#aaa" : "#8b6914",
                            color: "#000",
                          }}
                        >
                          {rank + 1}
                        </div>
                        {/* Emoji + name */}
                        <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                          <span className="text-lg">{team.emoji}</span>
                          <span
                            className="font-bold text-sm text-white truncate"
                          >
                            {team.name}
                          </span>
                          {isCurrentTurn && (
                            <span className="text-xs text-amber-300 font-bold">●</span>
                          )}
                        </div>
                        {/* Bar */}
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: team.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                          />
                        </div>
                        {/* Score */}
                        <div
                          className="flex-shrink-0 font-black text-sm tabular-nums"
                          style={{ color: team.color, minWidth: "3rem", textAlign: "start" }}
                        >
                          {team.score.toLocaleString("ar-SA")}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Back button */}
      <div className="mt-8 mb-4">
        <Link href="/games">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition text-sm">
            <ChevronLeft className="w-4 h-4" />
            الرئيسية
          </button>
        </Link>
      </div>
    </div>
  );
}
