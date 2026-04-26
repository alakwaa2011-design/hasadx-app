import { useState, useEffect } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, ArrowRight, ArrowLeft } from "lucide-react";
import { getSocket } from "@/lib/socket";

const fmt = (n: number) => n.toLocaleString("en-US");
type LifelineKey = "fifty" | "phone" | "audience" | "swap";
interface TeamState {
  name: string;
  members: string[];
  score: number;
  lifelinesUsed: Record<LifelineKey, boolean>;
}

const LIFELINE_LABEL: Record<LifelineKey, { ar: string; en: string }> = {
  fifty: { ar: "50:50", en: "50:50" },
  phone: { ar: "📞", en: "📞" },
  audience: { ar: "👥", en: "👥" },
  swap: { ar: "🔄", en: "🔄" },
};

export default function MillionTeamWatch() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/million/team-watch/:pin");
  const search = useSearch();
  const pin = params?.pin || "";
  const myName = new URLSearchParams(search).get("name") || "";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  interface PublicQuestion {
    id: number; text: string; optionA: string; optionB: string; optionC: string; optionD: string;
    imageUrl?: string | null; correctAnswer: string | null;
  }
  const [teamA, setTeamA] = useState<TeamState | null>(null);
  const [teamB, setTeamB] = useState<TeamState | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [isTransferred, setIsTransferred] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<PublicQuestion | null>(null);
  const [gameEnded, setGameEnded] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    // Subscribe to the session room without re-joining as a player
    // (the student already registered via million-class:join during /game/million/join).
    socket.emit("million-class:subscribe", { pin });
    const onTeam = (data: { teamA: TeamState; teamB: TeamState; currentQuestionIdx: number; transferredQuestions: number[]; currentQuestion: PublicQuestion | null }) => {
      setTeamA(data.teamA);
      setTeamB(data.teamB);
      setCurrentIdx(data.currentQuestionIdx);
      setIsTransferred(data.transferredQuestions.includes(data.currentQuestionIdx));
      setCurrentQuestion(data.currentQuestion);
    };
    const onEnded = (data: { teamA?: TeamState; teamB?: TeamState; totalQuestions: number }) => {
      setGameEnded(true);
      if (data.teamA) setTeamA(data.teamA);
      if (data.teamB) setTeamB(data.teamB);
      if (data.totalQuestions) {
        setTotalQuestions(data.totalQuestions);
        setCurrentIdx(data.totalQuestions);
      }
      setCurrentQuestion(null);
    };
    socket.on("million-class:team-state", onTeam);
    socket.on("million-class:game-ended", onEnded);
    // Fetch the question count once so we can detect game-over even if a
    // late-joining spectator missed the live game-ended event.
    fetch(`/api/million/class-session/${encodeURIComponent(pin)}/questions`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { questions?: PublicQuestion[] } | null) => {
        if (d?.questions) setTotalQuestions(d.questions.length);
      })
      .catch(() => { /* silent */ });
    return () => {
      socket.off("million-class:team-state", onTeam);
      socket.off("million-class:game-ended", onEnded);
    };
  }, [pin, myName]);

  const isFinished = gameEnded || (totalQuestions > 0 && currentIdx >= totalQuestions);
  const winner: "A" | "B" | "TIE" | null = !isFinished || !teamA || !teamB
    ? null
    : teamA.score > teamB.score ? "A"
    : teamB.score > teamA.score ? "B"
    : "TIE";

  const myTeam: "A" | "B" | null = !teamA || !teamB ? null
    : teamA.members.includes(myName) ? "A"
    : teamB.members.includes(myName) ? "B"
    : null;

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100vh-4rem)] py-6 px-4" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}>
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setLocation("/game/million")} className="inline-flex items-center gap-2 text-sm text-blue-300 mb-4">
            <BackIcon className="w-4 h-4" /> {lang === "ar" ? "خروج" : "Leave"}
          </button>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <h1 className="text-2xl font-black text-white">{lang === "ar" ? "معركة الفريقين" : "Two-Team Battle"}</h1>
            {!isFinished && (
              <p className="text-blue-300 text-sm">{lang === "ar" ? `السؤال ${currentIdx + 1}` : `Question ${currentIdx + 1}`}</p>
            )}
            {myTeam && (
              <p className="text-xs mt-1 text-amber-300">
                {lang === "ar" ? `أنت في ${myTeam === "A" ? teamA?.name : teamB?.name}` : `You're on ${myTeam === "A" ? teamA?.name : teamB?.name}`}
              </p>
            )}
            {isTransferred && !isFinished && (
              <p className="mt-2 text-amber-300 text-xs font-bold">
                {lang === "ar" ? "↪ السؤال محوّل" : "↪ Question transferred"}
              </p>
            )}
          </motion.div>

          {isFinished && winner && teamA && teamB && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-6 mb-5 text-center"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(124,58,237,0.15))", border: "1px solid rgba(245,158,11,0.4)" }}>
              <p className="text-3xl mb-1">🏆</p>
              <h2 className="text-2xl font-black text-white mb-2">
                {lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}
              </h2>
              {winner === "TIE" ? (
                <p className="text-amber-200 text-lg font-bold">
                  {lang === "ar" ? `تعادل بـ ${fmt(teamA.score)} نقطة!` : `Tie at ${fmt(teamA.score)} points!`}
                </p>
              ) : (
                <p className="text-amber-200 text-lg font-bold">
                  {lang === "ar"
                    ? `الفائز: ${winner === "A" ? teamA.name : teamB.name}!`
                    : `Winner: ${winner === "A" ? teamA.name : teamB.name}!`}
                </p>
              )}
              {myTeam && winner !== "TIE" && (
                <p className="text-sm text-white mt-2 font-bold">
                  {myTeam === winner
                    ? (lang === "ar" ? "🎉 مبروك! فاز فريقك!" : "🎉 Your team won!")
                    : (lang === "ar" ? "حظ أوفر في المرة القادمة!" : "Better luck next time!")}
                </p>
              )}
            </motion.div>
          )}

          {!isFinished && currentQuestion && (
            <div className="rounded-2xl p-5 mb-5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="text-amber-300 text-xs font-bold mb-2">{lang === "ar" ? "السؤال الحالي" : "Current question"}</p>
              <p className="text-white text-lg font-bold leading-relaxed">{currentQuestion.text}</p>
              {currentQuestion.imageUrl && <img src={currentQuestion.imageUrl} alt="" className="mt-3 max-h-48 mx-auto rounded-lg" />}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {(["A", "B", "C", "D"] as const).map(k => {
                  const opt = currentQuestion[`option${k}` as "optionA"];
                  const isCorrect = currentQuestion.correctAnswer && k === currentQuestion.correctAnswer.toUpperCase();
                  return (
                    <div key={k} className={`rounded-lg p-2.5 text-white text-sm font-bold border ${isCorrect ? "bg-green-500/20 border-green-400" : "bg-white/5 border-white/15"}`}>
                      <span className="text-amber-400 ml-2">{k}.</span> {opt}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {teamA && teamB ? (
            <div className="grid grid-cols-2 gap-4">
              {([["A", teamA, "blue", "🔵"], ["B", teamB, "red", "🔴"]] as const).map(([side, t, color, emo]) => {
                const isWin = isFinished && winner === side;
                const isLose = isFinished && winner && winner !== "TIE" && winner !== side;
                return (
                  <motion.div
                    key={side}
                    layout
                    animate={isWin ? { scale: [1, 1.05, 1] } : {}}
                    transition={isWin ? { duration: 1.6, repeat: Infinity } : {}}
                    className={`rounded-2xl p-5 text-center border-2 relative ${myTeam === side ? "ring-2 ring-amber-300" : ""}`}
                    style={{
                      background: side === "A" ? "rgba(59,130,246,0.12)" : "rgba(239,68,68,0.12)",
                      borderColor: isWin ? "rgba(245,158,11,0.9)" : (side === "A" ? "rgba(59,130,246,0.4)" : "rgba(239,68,68,0.4)"),
                      boxShadow: isWin ? "0 0 22px rgba(245,158,11,0.55)" : "none",
                      opacity: isLose ? 0.6 : 1,
                    }}
                  >
                    {isWin && (
                      <span className="absolute -top-3 -right-3 text-3xl" aria-hidden>👑</span>
                    )}
                    <p className={`text-${color}-300 font-bold text-sm`}>{emo}</p>
                    <h3 className={`text-${color}-200 font-black text-lg mt-1`}>{t.name}</h3>
                    <p className="text-amber-300 font-black text-3xl mt-2">{fmt(t.score)}</p>
                    {isWin && (
                      <p className="text-amber-200 text-[11px] font-bold mt-1 uppercase tracking-wider">
                        {lang === "ar" ? "الفائز" : "Winner"}
                      </p>
                    )}
                    {t.members.length > 0 && (
                      <p className={`text-${color}-400 text-[11px] mt-2 line-clamp-3`}>{t.members.join(" · ")}</p>
                    )}
                    <div className="flex justify-center gap-1 mt-3">
                      {(Object.keys(LIFELINE_LABEL) as LifelineKey[]).map(k => (
                        <span key={k} className={`text-xs px-1.5 py-0.5 rounded ${t.lifelinesUsed[k] ? "opacity-30 line-through" : ""}`} style={{ background: "rgba(255,255,255,0.07)" }}>
                          {LIFELINE_LABEL[k][lang]}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-blue-400 text-center py-10">{lang === "ar" ? "في انتظار المعلم..." : "Waiting for host..."}</p>
          )}

          <p className="text-blue-400 text-xs text-center mt-6">
            {lang === "ar"
              ? "تابع الشاشة الرئيسية للمعلم — هو من يدير اللعبة بالكامل."
              : "Watch the host's main screen — they control the entire game."}
          </p>
        </div>
      </div>
    </Layout>
  );
}
