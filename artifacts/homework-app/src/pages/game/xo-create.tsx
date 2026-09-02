import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Grid3X3, Clock, Play, Users, Wifi, School, QrCode } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { getSavedGameActivity, normalizeSavedGameQuestions, saveGameActivity } from "@/lib/saved-game-activities";
import { getXoSocket } from "@/lib/xo-socket";
import { toast } from "@/components/ui/sonner";
import { XO_CLASS_SETUP_KEY } from "@/pages/game/xo-class";

type Question = { text: string; options: string[]; correct: number; imageUrl?: string | null };
const durations = [10, 15, 20, 30, 45];

export default function XoCreate() {
  const { lang } = useI18n(); const ar = lang === "ar"; const dir = ar ? "rtl" : "ltr";
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [teamX, setTeamX] = useState(ar ? "فريق إكس" : "Team X");
  const [teamO, setTeamO] = useState(ar ? "فريق أو" : "Team O");
  const [playMode, setPlayMode] = useState<"online" | "classroom">("online");
  const [duration, setDuration] = useState(20); const [creating, setCreating] = useState(false);
  const loadedSavedGameRef = useRef(false);
  useEffect(() => {
    const savedGameId = new URLSearchParams(window.location.search).get("savedGameId");
    if (!savedGameId || loadedSavedGameRef.current) return;
    loadedSavedGameRef.current = true;
    void getSavedGameActivity(savedGameId).then((activity) => {
      if (activity.gameType !== "xo") throw new Error("invalid-saved-game");
      const restored = normalizeSavedGameQuestions(activity.questions).filter((q) =>
        q.text.trim() && q.options.length >= 2 && q.options.length <= 4
        && q.options.every((option) => option.trim())
        && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length
      );
      if (restored.length < 2) throw new Error("invalid-saved-game");
      setQuestions(restored);
      setTitle(activity.title || null);
      if (activity.settings && typeof activity.settings === "object" && !Array.isArray(activity.settings)) {
        const settings = activity.settings as Record<string, unknown>;
        if (typeof settings.teamX === "string" && settings.teamX.trim()) setTeamX(settings.teamX.slice(0, 40));
        if (typeof settings.teamO === "string" && settings.teamO.trim()) setTeamO(settings.teamO.slice(0, 40));
        if (typeof settings.duration === "number" && durations.includes(settings.duration)) setDuration(settings.duration);
      }
    }).catch(() => toast.error(ar ? "تعذر فتح اللعبة المحفوظة" : "Could not open the saved game"));
  }, [ar]);
  const create = async () => {
    if (questions.length < 2) {
      toast.error(ar ? "أضف سؤالين على الأقل" : "Add at least two questions");
      return;
    }
    setCreating(true);
    try {
      await saveGameActivity({ gameType: "xo", title: title || (ar ? "إكس أو" : "XO"), questions, settings: { duration, teamX, teamO, playMode }, source: "game-launch" });
      if (playMode === "classroom") {
        sessionStorage.setItem(XO_CLASS_SETUP_KEY, JSON.stringify({
          questions,
          duration,
          teamX: teamX.trim() || (ar ? "فريق إكس" : "Team X"),
          teamO: teamO.trim() || (ar ? "فريق أو" : "Team O"),
          title: title || (ar ? "إكس أو الصف" : "XO Class"),
        }));
        setCreating(false);
        navigate("/game/xo/class");
        return;
      }
      getXoSocket().emit("xo:create", { questions, duration, teamX: teamX.trim() || "X", teamO: teamO.trim() || "O" }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
        setCreating(false);
        if (res.error || !res.pin) {
          toast.error(res.error || (ar ? "تعذر إنشاء الغرفة" : "Could not create room"));
          return;
        }
        if (res.creatorToken) sessionStorage.setItem(`xo-creator-${res.pin}`, res.creatorToken);
        navigate(`/game/xo/play/${res.pin}?creator=1`);
      });
    } catch { setCreating(false); toast.error(ar ? "تعذر حفظ اللعبة تلقائياً" : "Could not auto-save the game"); }
  };
  if (!questions.length) return <Layout><main className="min-h-screen bg-[#FCFAF8] px-4 py-8" dir={dir}><UnifiedQuestionSourceFlow gameTitle={ar ? "إنشاء لعبة إكس أو" : "Create XO game"} gameDescription={ar ? "اختر مصدر الأسئلة ثم جهّز تحدي الفريقين." : "Choose questions, then prepare a team challenge."} gameIcon={<Grid3X3 className="h-8 w-8 text-[#225739]" />} accentColor="#225739" floatingAssignmentContinue minQuestions={2} maxQuestions={20} onComplete={({ questions: q, sourceTitle }) => { setQuestions(q); setTitle(sourceTitle); }} /></main></Layout>;
  return <Layout><main className="min-h-screen bg-[#FCFAF8] px-4 py-8" dir={dir}><div className="mx-auto max-w-2xl space-y-5">
    <header className="rounded-3xl bg-[#225739] p-6 text-white shadow-lg"><div className="flex items-center gap-3"><Grid3X3 /><div><h1 className="text-xl font-black">{ar ? "إعداد إكس أو" : "XO setup"}</h1><p className="text-sm text-white/75">{questions.length} {ar ? "أسئلة جاهزة" : "questions ready"}</p></div></div></header>
    <section className="rounded-3xl border border-[#225739]/10 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-black text-[#225739]">{ar ? "الأسئلة المحمّلة" : "Loaded questions"}</h2>
      <div className="space-y-2">
        {questions.slice(0, 4).map((question, index) => (
          <div key={`${index}-${question.text}`} className="flex items-start gap-3 rounded-xl bg-[#F1F5F2] px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#225739] text-xs font-black text-white">{index + 1}</span>
            <p className="line-clamp-2 text-sm font-bold leading-relaxed text-slate-700">{question.text}</p>
          </div>
        ))}
      </div>
      {questions.length > 4 && <p className="mt-2 text-xs font-bold text-slate-500">{ar ? `و${questions.length - 4} أسئلة أخرى` : `And ${questions.length - 4} more questions`}</p>}
    </section>
    <section className="rounded-3xl border border-[#225739]/10 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-black text-[#225739]">{ar ? "نمط اللعب" : "Play mode"}</h2>
      <p className="mb-4 text-sm font-medium text-slate-500">{ar ? "اختر طريقة مشاركة اللعبة مع الطلاب" : "Choose how students will play"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setPlayMode("online")} className={`rounded-2xl border-2 p-4 text-start transition ${playMode === "online" ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-blue-300"}`}>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Wifi className="h-5 w-5" /></span>
          <strong className="block text-slate-900">{ar ? "الدخول عن بُعد" : "Remote join"}</strong>
          <span className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500"><QrCode className="h-3.5 w-3.5" />{ar ? "كود ورابط وQR لكل طالب" : "Code, link and QR for students"}</span>
        </button>
        <button type="button" onClick={() => setPlayMode("classroom")} className={`rounded-2xl border-2 p-4 text-start transition ${playMode === "classroom" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-slate-200 hover:border-amber-300"}`}>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white"><School className="h-5 w-5" /></span>
          <strong className="block text-slate-900">{ar ? "وضع الصف — على السبورة" : "Classroom — on the board"}</strong>
          <span className="mt-1 block text-xs font-bold text-slate-500">{ar ? "شاشتا إجابة ولوحة إكس أو واحدة" : "Two answer panels and one XO board"}</span>
        </button>
      </div>
    </section>
    <section className="rounded-3xl border border-[#225739]/10 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-black text-[#225739]"><Users className="h-5 w-5" />{ar ? "أسماء الفريقين" : "Team names"}</h2><div className="grid gap-3 sm:grid-cols-2"><label className="font-bold text-slate-700">X<input value={teamX} onChange={e => setTeamX(e.target.value)} className="mt-1 w-full rounded-xl border p-3 outline-[#225739]" /></label><label className="font-bold text-slate-700">O<input value={teamO} onChange={e => setTeamO(e.target.value)} className="mt-1 w-full rounded-xl border p-3 outline-[#225739]" /></label></div></section>
    <section className="rounded-3xl border border-[#225739]/10 bg-white p-5 shadow-sm"><h2 className="mb-3 flex items-center gap-2 font-black text-[#225739]"><Clock className="h-5 w-5" />{ar ? "وقت السؤال" : "Question duration"}</h2><div className="flex flex-wrap gap-2">{durations.map(d => <button key={d} onClick={() => setDuration(d)} className={`rounded-xl px-4 py-2 font-black ${duration === d ? "bg-[#225739] text-white" : "bg-[#F1F5F2] text-[#225739]"}`}>{d}{ar ? " ث" : "s"}</button>)}</div></section>
    <div className="flex gap-3"><button onClick={() => setQuestions([])} className="rounded-2xl border px-4 font-bold">{ar ? "تغيير الأسئلة" : "Change questions"}</button><button onClick={create} disabled={creating} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#225739] py-4 font-black text-white disabled:opacity-60"><Play className="h-5 w-5" />{creating ? (ar ? "جارٍ التجهيز..." : "Preparing...") : playMode === "classroom" ? (ar ? "ابدأ وضع الصف" : "Start classroom mode") : (ar ? "إنشاء غرفة الدخول" : "Create join room")}</button></div>
  </div></main></Layout>;
}