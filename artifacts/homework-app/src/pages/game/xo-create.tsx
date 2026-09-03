import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Grid3X3, Clock, Play, Users, Wifi, School, QrCode } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { UnifiedQuestionSourceFlow } from "@/components/game/unified-question-source-flow";
import { GameFlowBackButton } from "@/components/game/game-flow-back-button";
import { getSavedGameActivity, normalizeSavedGameQuestions, saveGameActivity } from "@/lib/saved-game-activities";
import { getXoSocket } from "@/lib/xo-socket";
import { toast } from "@/components/ui/sonner";
import { XO_CLASS_SETUP_KEY } from "@/pages/game/xo-class";
import type { XoClassSetup } from "@/lib/xo-class-share";
import { cn } from "@/lib/utils";
import { localizeXoError } from "@/lib/xo-error-messages";

type Question = {
  text: string;
  options: string[];
  correct: number;
  type?: "mcq" | "true_false";
  imageUrl?: string | null;
};
type QuestionSource = "assignment" | "ai" | "manual" | "bank" | "saved" | "file";
const durations = [10, 15, 20, 30, 45];

function toXoQuestions(questions: Array<{
  text: string;
  options: string[];
  correct: number;
  type?: "mcq" | "true_false" | "fill_blank";
  imageUrl?: string | null;
}>): Question[] {
  return questions.flatMap((question) =>
    question.type === "fill_blank"
      ? []
      : [{
          text: question.text,
          options: question.options,
          correct: question.correct,
          type: question.type,
          imageUrl: question.imageUrl,
        }]
  );
}

export default function XoCreate() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, navigate] = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSource, setQuestionSource] = useState<QuestionSource>("manual");
  const [title, setTitle] = useState<string | null>(null);
  const [teamX, setTeamX] = useState(ar ? "فريق إكس" : "Team X");
  const [teamO, setTeamO] = useState(ar ? "فريق أو" : "Team O");
  const [playMode, setPlayMode] = useState<"online" | "classroom">("classroom");
  const [duration, setDuration] = useState(20);
  const [creating, setCreating] = useState(false);
  const [setupStep, setSetupStep] = useState<"questions" | "settings">("questions");
  const loadedSavedGameRef = useRef(false);

  const handleFlowBack = () => {
    if (setupStep === "settings") {
      setQuestions([]);
      setSetupStep("questions");
      return;
    }
    navigate("/");
  };

  useEffect(() => {
    setTeamX(current => current === "فريق إكس" || current === "Team X" ? (ar ? "فريق إكس" : "Team X") : current);
    setTeamO(current => current === "فريق أو" || current === "Team O" ? (ar ? "فريق أو" : "Team O") : current);
  }, [ar]);

  useEffect(() => {
    const savedGameId = new URLSearchParams(window.location.search).get("savedGameId");
    if (!savedGameId || loadedSavedGameRef.current) return;
    loadedSavedGameRef.current = true;
    void getSavedGameActivity(savedGameId).then((activity) => {
      if (activity.gameType !== "xo") throw new Error("invalid-saved-game");
      const restored = toXoQuestions(normalizeSavedGameQuestions(activity.questions)).filter((q) =>
        q.text.trim() && q.options.length >= 2 && q.options.length <= 4
        && q.options.every((option) => option.trim())
        && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length
      );
      if (restored.length < 2) throw new Error("invalid-saved-game");
      setQuestions(restored);
      setSetupStep("settings");
      setTitle(activity.title || null);
      if (activity.settings && typeof activity.settings === "object" && !Array.isArray(activity.settings)) {
        const settings = activity.settings as Record<string, unknown>;
        if (typeof settings.teamX === "string" && settings.teamX.trim()) setTeamX(settings.teamX.slice(0, 40));
        if (typeof settings.teamO === "string" && settings.teamO.trim()) setTeamO(settings.teamO.slice(0, 40));
        if (typeof settings.duration === "number" && durations.includes(settings.duration)) setDuration(settings.duration);
        if (settings.playMode === "online" || settings.playMode === "classroom") setPlayMode(settings.playMode);
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
      await saveGameActivity({ gameType: "xo", title: title || (ar ? "إكس أو" : "XO"), questions, settings: { duration, teamX, teamO, playMode }, source: questionSource });
      if (playMode === "classroom") {
        const setup: XoClassSetup = {
          questions,
          duration,
          teamX: teamX.trim() || (ar ? "فريق إكس" : "Team X"),
          teamO: teamO.trim() || (ar ? "فريق أو" : "Team O"),
          title: title || (ar ? "إكس أو الصف" : "XO Class"),
        };
        sessionStorage.setItem(XO_CLASS_SETUP_KEY, JSON.stringify(setup));
        setCreating(false);
        navigate("/game/xo/class");
        return;
      }
      getXoSocket().emit("xo:create", { questions, duration, teamX: teamX.trim() || "X", teamO: teamO.trim() || "O" }, (res: { pin?: string; creatorToken?: string; error?: string }) => {
        setCreating(false);
        if (res.error || !res.pin) {
          toast.error(localizeXoError(res.error, ar, ar ? "تعذر إنشاء الغرفة" : "Could not create room"));
          return;
        }
        if (res.creatorToken) sessionStorage.setItem(`xo-creator-${res.pin}`, res.creatorToken);
        navigate(`/game/xo/play/${res.pin}?creator=1`);
      });
    } catch {
      setCreating(false);
      toast.error(ar ? "تعذر حفظ اللعبة تلقائياً" : "Could not auto-save the game");
    }
  };

  if (setupStep === "questions" || !questions.length) {
    return (
      <Layout>
        <main className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-8" dir={dir}>
          <div className="mx-auto mb-3 max-w-3xl">
            <GameFlowBackButton onBack={handleFlowBack} />
          </div>
          <UnifiedQuestionSourceFlow
            gameTitle={ar ? "إنشاء لعبة إكس أو" : "Create XO game"}
            gameDescription={ar ? "اختر مصدر الأسئلة ثم جهّز تحدي الفريقين." : "Choose questions, then prepare a team challenge."}
            gameIcon={<Grid3X3 className="h-8 w-8 text-primary" />}
            accentClass="bg-primary hover:bg-primary/90 text-primary-foreground"
            floatingAssignmentContinue
            minQuestions={2}
            maxQuestions={20}
            onComplete={({ questions: q, sourceTitle, source }) => {
              setQuestions(toXoQuestions(q));
              setQuestionSource(source);
              setTitle(sourceTitle);
              setSetupStep("settings");
            }}
          />
        </main>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-8" dir={dir}>
        <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-3">
            <GameFlowBackButton onBack={handleFlowBack} />
          </div>
          <div className="rounded-3xl border bg-card shadow-sm overflow-hidden">
            <header className="border-b bg-muted/20 px-6 py-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Grid3X3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground">{ar ? "إعداد إكس أو" : "XO setup"}</h1>
                <p className="text-sm font-medium text-muted-foreground line-clamp-1">{title || (ar ? "إكس أو" : "XO")}</p>
              </div>
              <div className="ms-auto flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                  {questions.length} {ar ? "أسئلة" : "Questions"}
                </span>
              </div>
            </header>

            <div className="p-6 space-y-8">
              <section>
                <h2 className="mb-1 text-sm font-black uppercase tracking-wider text-muted-foreground">{ar ? "نمط اللعب" : "Play mode"}</h2>
                <p className="mb-4 text-sm text-muted-foreground">{ar ? "اختر طريقة مشاركة اللعبة مع الطلاب" : "Choose how students will play"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="button-mode-classroom"
                    onClick={() => setPlayMode("classroom")}
                    className={cn(
                      "group flex flex-col rounded-2xl border-2 p-5 text-start transition-all",
                      playMode === "classroom" ? "border-amber-500 bg-amber-500/5 shadow-md" : "border-muted hover:border-amber-500/30 hover:bg-amber-500/5"
                    )}
                  >
                    <span className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                      playMode === "classroom" ? "bg-amber-500 text-white shadow-sm" : "bg-muted text-muted-foreground group-hover:bg-amber-500/20 group-hover:text-amber-600"
                    )}>
                      <School className="h-6 w-6" />
                    </span>
                    <strong className="block text-base text-foreground">{ar ? "وضع الصف — على السبورة" : "Classroom — on the board"}</strong>
                    <span className="mt-1 block text-sm font-medium text-muted-foreground">{ar ? "شاشتا إجابة ولوحة إكس أو واحدة" : "Two answer panels and one XO board"}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="button-mode-online"
                    onClick={() => setPlayMode("online")}
                    className={cn(
                      "group flex flex-col rounded-2xl border-2 p-5 text-start transition-all",
                      playMode === "online" ? "border-blue-500 bg-blue-500/5 shadow-md" : "border-muted hover:border-blue-500/30 hover:bg-blue-500/5"
                    )}
                  >
                    <span className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                      playMode === "online" ? "bg-blue-500 text-white shadow-sm" : "bg-muted text-muted-foreground group-hover:bg-blue-500/20 group-hover:text-blue-600"
                    )}>
                      <Wifi className="h-6 w-6" />
                    </span>
                    <strong className="block text-base text-foreground">{ar ? "الدخول عن بُعد" : "Remote join"}</strong>
                    <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <QrCode className="h-4 w-4" />
                      {ar ? "كود ورابط وQR لكل طالب" : "Code, link and QR for students"}
                    </span>
                  </button>
                </div>
              </section>

              <section>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {ar ? "أسماء الفريقين" : "Team names"}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-foreground">
                      {ar ? "الفريق الأول (X)" : "Team 1 (X)"}
                    </span>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 start-0 flex w-12 items-center justify-center text-blue-500 font-black text-xl">X</div>
                      <input
                        value={teamX}
                        onChange={e => setTeamX(e.target.value)}
                        data-testid="input-team-x"
                        className="w-full rounded-xl border-2 border-muted bg-transparent py-3 pe-4 ps-12 font-bold text-foreground transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-foreground">
                      {ar ? "الفريق الثاني (O)" : "Team 2 (O)"}
                    </span>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 start-0 flex w-12 items-center justify-center text-amber-500 font-black text-xl">O</div>
                      <input
                        value={teamO}
                        onChange={e => setTeamO(e.target.value)}
                        data-testid="input-team-o"
                        className="w-full rounded-xl border-2 border-muted bg-transparent py-3 pe-4 ps-12 font-bold text-foreground transition focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between rounded-2xl border-2 border-muted bg-muted/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-foreground shadow-sm ring-1 ring-border">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground">{ar ? "وقت السؤال" : "Question duration"}</h2>
                      <p className="text-xs text-muted-foreground">{ar ? "الزمن المتاح للإجابة" : "Time available to answer"}</p>
                    </div>
                  </div>
                  <select
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    data-testid="select-duration"
                    className="cursor-pointer appearance-none rounded-xl border-2 border-muted bg-card px-4 py-2 font-black text-foreground shadow-sm transition hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    {durations.map(d => <option key={d} value={d}>{d} {ar ? "ث" : "sec"}</option>)}
                  </select>
                </div>
              </section>
            </div>

            <footer className="border-t bg-muted/20 px-6 py-5 flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => {
                  setQuestions([]);
                  setSetupStep("questions");
                }}
                data-testid="button-change-questions"
                className="w-full sm:w-auto rounded-xl border-2 border-transparent bg-muted px-6 py-3.5 font-bold text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
              >
                {ar ? "تغيير الأسئلة" : "Change questions"}
              </button>
              <button
                onClick={create}
                disabled={creating}
                data-testid="button-start-game"
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-6 font-black text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    {ar ? "جارٍ التجهيز..." : "Preparing..."}
                  </span>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current transition-transform group-hover:scale-110" />
                    {playMode === "classroom" ? (ar ? "ابدأ وضع الصف" : "Start classroom mode") : (ar ? "إنشاء غرفة الدخول" : "Create join room")}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      </main>
    </Layout>
  );
}