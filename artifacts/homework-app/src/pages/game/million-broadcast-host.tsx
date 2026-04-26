import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Radio, ChevronLeft, ChevronRight, Loader2, Users, ArrowRight, ArrowLeft, Check, Volume2, VolumeX } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { HostJoinBar } from "@/components/host-join-bar";
import { useGameAudio } from "./useGameAudio";

const API_BASE = import.meta.env.VITE_API_URL || "";
const PRIZE_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const fmt = (n: number) => n.toLocaleString("en-US");

interface BroadcastQuestion {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl?: string | null;
}

interface PlayerRow {
  name: string;
  playerToken: string;
  prize: number;
  correctCount: number;
  level: number;
  status: string;
  connected: boolean;
  hasAnswered: boolean;
}

export default function MillionBroadcastHost() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/million/broadcast/:pin");
  const search = useSearch();
  const pin = params?.pin || "";
  // The host token is stored in sessionStorage (not the URL) so that teachers
  // who mirror their browser to a projector do not expose it to students.
  // For backwards compatibility we still accept ?token=... in the URL, but we
  // immediately move it to sessionStorage and strip it from the address bar.
  const hostToken = (() => {
    const urlToken = new URLSearchParams(search).get("token");
    if (urlToken && pin) {
      try { sessionStorage.setItem(`millionClassHostToken:${pin}`, urlToken); } catch { /* ignore */ }
      try { window.history.replaceState({}, "", window.location.pathname); } catch { /* ignore */ }
      return urlToken;
    }
    try { return pin ? (sessionStorage.getItem(`millionClassHostToken:${pin}`) || "") : ""; } catch { return ""; }
  })();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [questions, setQuestions] = useState<BroadcastQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const joinedRef = useRef(false);
  const audio = useGameAudio();
  const bgStartedRef = useRef(false);
  const joinUrl = pin ? `${typeof window !== "undefined" ? window.location.origin : ""}/game/million/join/${pin}` : "";

  // Start background music after first user interaction (browser autoplay policy)
  useEffect(() => {
    if (!pin || bgStartedRef.current) return;
    const start = () => {
      if (bgStartedRef.current) return;
      bgStartedRef.current = true;
      try { audio.startBg(); } catch { /* ignore */ }
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      audio.stopBg();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Load questions for the session
  useEffect(() => {
    if (!pin) return;
    fetch(`${API_BASE}/api/million/class-session/${encodeURIComponent(pin)}/questions`, { credentials: "include" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "load failed");
        return d as { questions: BroadcastQuestion[] };
      })
      .then(d => {
        setQuestions(d.questions || []);
        setLoading(false);
      })
      .catch(e => {
        toast.error(e.message || (lang === "ar" ? "فشل تحميل الأسئلة" : "Failed to load"));
        setLoading(false);
      });
  }, [pin, lang]);

  // Connect as host and listen for leaderboard
  useEffect(() => {
    if (!pin || !hostToken || joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();
    socket.emit("million-class:create", { pin, hostToken }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) toast.error(res.error);
    });
    const onLb = (data: { players: PlayerRow[]; currentQuestionIdx?: number; questionRevealed?: boolean }) => {
      setPlayers(data.players || []);
      if (typeof data.currentQuestionIdx === "number") setCurrentIdx(data.currentQuestionIdx);
      if (typeof data.questionRevealed === "boolean") setReveal(data.questionRevealed);
    };
    const onQc = (data: { currentQuestionIdx: number }) => {
      setCurrentIdx(data.currentQuestionIdx);
      setReveal(false);
    };
    socket.on("million-class:leaderboard", onLb);
    socket.on("million-class:question-changed", onQc);
    return () => {
      socket.off("million-class:leaderboard", onLb);
      socket.off("million-class:question-changed", onQc);
    };
  }, [pin, hostToken]);

  const currentQuestion = questions[currentIdx];
  const totalQ = questions.length;
  const isLast = currentIdx >= totalQ - 1;
  const correctKey = currentQuestion?.correctAnswer?.toUpperCase();
  const answeredCount = players.filter(p => p.hasAnswered).length;

  function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    const socket = getSocket();
    socket.emit("million-class:host-next-question", { pin, hostToken }, (res: { ok?: boolean; error?: string }) => {
      setAdvancing(false);
      setReveal(false);
      if (res?.error) toast.error(res.error);
    });
  }

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => b.prize - a.prize || b.correctCount - a.correctCount),
    [players]);

  const maxPrize = Math.max(1, ...players.map(p => p.prize));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100vh-4rem)] py-6 px-4" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button onClick={() => setLocation("/game/million")} className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
              <BackIcon className="w-4 h-4" /> {lang === "ar" ? "رجوع" : "Back"}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" /> {lang === "ar" ? "وضع البثّ" : "Broadcast"}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {players.length}
              </span>
              <button
                onClick={audio.toggleMute}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15"
                title={audio.muted ? (lang === "ar" ? "تشغيل الصوت" : "Unmute") : (lang === "ar" ? "كتم الصوت" : "Mute")}
              >
                {audio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {audio.muted ? (lang === "ar" ? "صامت" : "Muted") : (lang === "ar" ? "موسيقى" : "Music")}
              </button>
            </div>
          </div>

          {/* Join panel: PIN + QR + copy link, prominent for the teacher to share */}
          <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(6,182,212,0.10))", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <div className="flex flex-col">
              <span className="text-amber-200 text-xs font-bold mb-1">
                {lang === "ar" ? "للانضمام: امسح الباركود أو افتح الرابط أو أدخل الرقم" : "To join: scan QR, open link, or enter PIN"}
              </span>
              <span className="text-blue-200 text-[11px] opacity-80 break-all max-w-md">{joinUrl}</span>
            </div>
            <HostJoinBar pin={pin} joinUrl={joinUrl} variant="dark" compact />
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
            {/* Question pane */}
            <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between text-blue-300 text-sm font-bold">
                <span>{lang === "ar" ? `سؤال ${currentIdx + 1} من ${totalQ}` : `Question ${currentIdx + 1} / ${totalQ}`}</span>
                <span className="text-amber-300 text-base">{fmt(PRIZE_LADDER[currentIdx] ?? 0)}</span>
              </div>

              {currentQuestion ? (
                <>
                  <div className="rounded-xl p-5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <p className="text-white text-xl font-bold leading-relaxed">{currentQuestion.text}</p>
                    {currentQuestion.imageUrl && (
                      <img src={currentQuestion.imageUrl} alt="" className="mt-3 max-h-64 rounded-lg" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["A", "B", "C", "D"] as const).map(k => {
                      const opt = currentQuestion[`option${k}` as "optionA"];
                      const isCorrect = reveal && k === correctKey;
                      return (
                        <div
                          key={k}
                          className={`rounded-xl p-3 text-white text-base font-bold border-2 transition-all ${
                            isCorrect ? "bg-green-500/20 border-green-400" : "bg-white/5 border-white/15"
                          }`}
                        >
                          <span className="text-amber-400 ml-2">{k}.</span>
                          {opt}
                          {isCorrect && <Check className="inline-block w-4 h-4 mr-1 text-green-300" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-blue-300">
                      {lang === "ar" ? `أجاب ${answeredCount} من ${players.length}` : `${answeredCount} of ${players.length} answered`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReveal(v => !v)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold ${reveal ? "bg-green-500/30 text-green-200 border border-green-400" : "bg-white/10 text-blue-200 border border-white/15"}`}
                      >
                        {reveal ? (lang === "ar" ? "✓ مكشوفة" : "✓ Revealed") : (lang === "ar" ? "كشف الإجابة" : "Reveal answer")}
                      </button>
                      <button
                        onClick={handleAdvance}
                        disabled={advancing}
                        className="px-5 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)" }}
                      >
                        {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        {isLast ? (lang === "ar" ? "إنهاء اللعبة" : "Finish") : (lang === "ar" ? "السؤال التالي" : "Next question")}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-blue-300 text-center py-10">{lang === "ar" ? "لا توجد أسئلة" : "No questions"}</p>
              )}
            </div>

            {/* Live per-student prize bars */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <h3 className="text-white font-bold flex items-center gap-2 text-base">
                <Trophy className="w-4 h-4 text-amber-400" />
                {lang === "ar" ? "الجائزة المتراكمة" : "Accumulated Prize"}
              </h3>
              {sortedPlayers.length === 0 ? (
                <p className="text-blue-400 text-sm text-center py-6">
                  {lang === "ar" ? "في انتظار الطلاب..." : "Waiting for students..."}
                </p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {sortedPlayers.map((p, i) => {
                      const pct = (p.prize / maxPrize) * 100;
                      return (
                        <motion.div
                          key={p.playerToken}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-lg p-2.5 relative overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div className="absolute inset-y-0 right-0 transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04))" }} />
                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-blue-400 text-xs font-bold w-6 text-center">{i + 1}</span>
                              <span className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-slate-500"}`} />
                              <span className="text-white text-sm font-bold truncate">{p.name}</span>
                              {p.hasAnswered && <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-blue-300 text-[11px]">{p.correctCount}✓</span>
                              <span className="text-amber-300 text-sm font-black">{fmt(p.prize)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
