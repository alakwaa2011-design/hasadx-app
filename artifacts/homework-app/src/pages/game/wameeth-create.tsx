import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAssignments,
  useGetCurrentTeacher,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  creditAwareFetch,
  isInsufficientCreditsResponse,
} from "@/lib/credit-aware-fetch";
import {
  ClassSelector,
  getRememberedTargetClass,
} from "@/components/teacher/class-selector";
import { WAMEETH_CLASS_SETUP_KEY } from "@/pages/game/wameeth-class";
import { storeIndependentControlToken } from "@/lib/independent-game-session";
import { getSavedGameActivity, saveGameActivity } from "@/lib/saved-game-activities";
import {
  canUseActivityAsWameethSource,
  getWameethSetupAssignmentId,
  getWameethSetupPath,
  requiresImportedCopyForLiveWameeth,
  type WameethSourceActivity,
} from "@/lib/wameeth-entry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QuestionCard, emptyQuestion, isValidQ, type Question, type Correct,
} from "@/components/game/question-editor";
import {
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Plus,
  Sparkles,
  School,
  PenLine,
  BookOpen,
  Check,
  X,
  User,
  UsersRound,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface Assignment {
  id: number;
  title: string;
  questionCount?: number;
  teacherId?: number | null;
  isShared?: boolean | null;
  hiddenByAdmin?: boolean | null;
  accessMode?: string | null;
}

type QuestionSource = "assignment" | "ai" | "manual";
type Difficulty = "easy" | "medium" | "hard";
type PlayMode = "solo" | "teams" | "classroom" | "independent";

// Wameedh entry point: prepare a set of questions (from an assignment, AI, or
// written manually), review it, then pick how to play — solo / teams / class
// mode — all three consuming the exact same prepared question list.
export default function WameethCreate() {
  const [, setLocation] = useLocation();
  const { lang, t, dir } = useI18n();
  const ar = lang === "ar";
  const BackIcon = ar ? ChevronRight : ChevronLeft;

  const { data: user, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const { data: assignments, isLoading: assignmentsLoading } = useListAssignments(
    user ? { teacherId: user.id, include: "shared" as const } : undefined,
    { query: { enabled: !!user } as any },
  );

  // ─── Step 1: build & review the shared question set ─────────────────────
  const [step, setStep] = useState<"prepare" | "mode">("prepare");
  const [source, setSource] = useState<QuestionSource | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState("");
  // When the whole list still matches one untouched assignment, we can reuse
  // that assignment directly instead of persisting a new one at start time.
  const [sourceAssignmentId, setSourceAssignmentId] = useState<number | null>(null);

  // From existing assignment (single-select, like the solo-challenge creator)
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const preloadedAssignmentId = getWameethSetupAssignmentId(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const preloadedAssignmentRef = useRef<number | null>(null);
  const loadedSavedGameRef = useRef(false);
  const importingLibraryAssignmentRef = useRef(false);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importingLibraryAssignment, setImportingLibraryAssignment] = useState(false);

  // AI generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ─── Step 2: play mode ────────────────────────────────────────────────────
  const [mode, setMode] = useState<PlayMode | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>(["", "", "", "", "", ""]);
  const [targetClass, setTargetClass] = useState<string>(() => getRememberedTargetClass());
  const [starting, setStarting] = useState(false);

  // If the organizer is not logged in, send them to the login page with a
  // post-login redirect back here so they don't lose their place.
  useEffect(() => {
    if (!authLoading && !user) {
      const backTo = encodeURIComponent(getWameethSetupPath(preloadedAssignmentId));
      setLocation(`/login?returnTo=${backTo}`);
    }
  }, [user, authLoading, preloadedAssignmentId, setLocation]);

  const resetSource = () => {
    setSource(null);
    setQuestions([]);
    setTitle("");
    setSourceAssignmentId(null);
    setSelectedAssignment(null);
    setAssignSearch("");
    setAiTopic("");
    setAiSubject("");
  };

  const wameethSourceAssignments = (assignments || []).filter((a: Assignment) =>
    // The trusted assignments endpoint already excludes admin-hidden shared
    // rows, but it does not serialize hiddenByAdmin in its list response.
    // Normalize only that omitted field here so visibly published library
    // activities remain available for the allowed Wameeth flows.
    canUseActivityAsWameethSource(
      { ...a, hiddenByAdmin: a.hiddenByAdmin ?? false },
      user?.id ?? -1,
    ),
  );

  const filteredAssignments = wameethSourceAssignments.filter((a: Assignment) => {
    if ((a.questionCount ?? 0) === 0) return false;
    if (!assignSearch.trim()) return true;
    return a.title.toLowerCase().includes(assignSearch.toLowerCase());
  });

  // Map one backend question row (mcq / true_false / fill_blank) into the
  // shared editable `Question` shape used across the review list.
  const fromBackendQuestion = (q: {
    text: string; questionType?: string;
    optionA?: string; optionB?: string; optionC?: string; optionD?: string; correctAnswer?: string;
    imageUrl?: string | null;
  }): Question | null => {
    const qt = q.questionType || "mcq";
    if (qt === "true_false") {
      if (q.correctAnswer !== "true" && q.correctAnswer !== "false") return null;
      return { ...emptyQuestion("tf"), text: q.text, correctAnswer: q.correctAnswer === "true" ? "A" : "B", imageUrl: q.imageUrl || null };
    }
    if (qt === "fill_blank") {
      if (!q.correctAnswer) return null;
      const parts = q.correctAnswer.split("|").map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      return { ...emptyQuestion("fill_blank"), text: q.text, fillAnswer: parts[0], closeAnswers: parts.slice(1).join(", "), imageUrl: q.imageUrl || null };
    }
    if (!(q.optionA && q.optionB && q.optionC && q.optionD && q.correctAnswer)) return null;
    return {
      ...emptyQuestion("mcq"),
      text: q.text,
      optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
      correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
      imageUrl: q.imageUrl || null,
    };
  };

  // Single-select an assignment (like the solo-challenge creator) and load its
  // full question set — the existing "from an assignment" service — into the
  // shared, editable review list.
  const handleSelectAssignment = async (a: Assignment) => {
    if (loadingAssignment) return;
    setSelectedAssignment(a);
    setLoadingAssignment(true);
    try {
      const res = await fetch(`${API}/api/assignments/${a.id}`, { credentials: "include" });
      if (!res.ok) { toast.error(ar ? "تعذّر تحميل الأسئلة" : "Failed to load questions"); return; }
      const data = await res.json();
      const loaded = ((data.questions || []) as any[]).map(fromBackendQuestion).filter((q): q is Question => q !== null);
      if (loaded.length === 0) {
        toast.error(ar ? "لا توجد أسئلة مدعومة في هذا الواجب" : "No supported questions in this assignment");
        return;
      }
      setQuestions(loaded);
      setSourceAssignmentId(a.id);
      if (!title) setTitle(a.title);
      toast.success(ar ? `تم تحميل ${loaded.length} سؤال` : `Loaded ${loaded.length} questions`);
    } catch {
      toast.error(ar ? "حدث خطأ" : "An error occurred");
    } finally {
      setLoadingAssignment(false);
    }
  };

  // Every teacher entry that already knows an assignment lands here. Loading
  // it in this one place ensures all play modes, including Independent, use
  // the same play-link and control-token initialization.
  useEffect(() => {
    if (
      !preloadedAssignmentId
      || !user
      || assignmentsLoading
      || loadingAssignment
      || preloadedAssignmentRef.current === preloadedAssignmentId
    ) return;

    const assignment = wameethSourceAssignments.find(
      (item: Assignment) => item.id === preloadedAssignmentId,
    ) as Assignment | undefined;
    preloadedAssignmentRef.current = preloadedAssignmentId;

    if (!assignment) {
      toast.error(ar ? "تعذّر العثور على الواجب المحدد" : "The selected assignment was not found");
      return;
    }

    setSource("assignment");
    void handleSelectAssignment(assignment);
  }, [
    ar,
    assignments,
    assignmentsLoading,
    loadingAssignment,
    preloadedAssignmentId,
    user,
  ]);

  // Same AI endpoint used by the solo-challenge creator — always returns MCQ.
  const generateWithAI = async () => {
    if (!aiTopic.trim()) { toast.error(ar ? "أدخل الموضوع أولاً" : "Enter a topic first"); return; }
    setAiGenerating(true);
    try {
      const res = await creditAwareFetch(`${API}/api/ai/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subject: aiSubject.trim(),
          count: aiCount,
          difficulty: aiDifficulty,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(data.message || (ar ? "فشل التوليد" : "Generation failed"));
      }
      const generated: Question[] = (data.questions || []).map((q: any) => ({
        ...emptyQuestion("mcq"),
        text: q.text || "",
        optionA: q.optionA || "",
        optionB: q.optionB || "",
        optionC: q.optionC || "",
        optionD: q.optionD || "",
        correctAnswer: (["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A") as Correct,
        imageUrl: q.imageUrl || null,
      }));
      setQuestions(prev => [...prev, ...generated]);
      setSourceAssignmentId(null);
      if (!title) setTitle(aiTopic.trim());
      toast.success(ar ? `تم توليد ${generated.length} سؤال` : `Generated ${generated.length} questions`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "خطأ في التوليد" : "Generation error"));
    } finally {
      setAiGenerating(false);
    }
  };

  const addManualQuestion = () => {
    setQuestions(prev => [...prev, emptyQuestion("mcq")]);
    setSourceAssignmentId(null);
  };

  const updateQuestion = (i: number, updated: Question) => {
    setQuestions(prev => prev.map((x, j) => j === i ? updated : x));
    setSourceAssignmentId(null);
  };

  const deleteQuestion = (i: number) => {
    setQuestions(prev => prev.filter((_, j) => j !== i));
    setSourceAssignmentId(null);
  };

  const validQuestions = questions.filter(isValidQ);
  // وميض الصف only supports tap-to-pick options on screen — fill-in-the-blank
  // has no free-text input there, so it is excluded from that mode only.
  const classroomEligible = validQuestions.filter(q => q.type !== "fill_blank");

  useEffect(() => {
    const savedGameId = new URLSearchParams(window.location.search).get("savedGameId");
    if (!savedGameId || loadedSavedGameRef.current) return;
    loadedSavedGameRef.current = true;
    void (async () => {
      try {
        const activity = await getSavedGameActivity(savedGameId);
        if (activity.gameType !== "wameeth" || !Array.isArray(activity.content)) {
          throw new Error("invalid-saved-game");
        }
        const restored = activity.content.filter((question): question is Question =>
          !!question && typeof question === "object" && isValidQ(question as Question),
        );
        // Never silently drop questions from a saved activity; loading a partial
        // competition could change its intended gameplay.
        if (restored.length !== activity.content.length || restored.length < 2) {
          throw new Error("invalid-saved-game");
        }
        const settings = activity.settings;
        if (settings && (typeof settings !== "object" || Array.isArray(settings))) throw new Error("invalid-settings");
        const savedSettings = (settings ?? {}) as Record<string, unknown>;
        const savedTeamCount = savedSettings.teamCount;
        const restoredTeamCount = typeof savedTeamCount === "number" && savedTeamCount >= 2 && savedTeamCount <= 6
          ? savedTeamCount
          : 2;
        const savedCustomTeamNames = savedSettings.customTeamNames;
        if (
          savedCustomTeamNames !== undefined
          && savedCustomTeamNames !== null
          && (
            !Array.isArray(savedCustomTeamNames)
            || savedCustomTeamNames.length > 6
            || savedCustomTeamNames.some(name => typeof name !== "string" || name.length > 20)
            || (savedSettings.mode === "teams" && savedCustomTeamNames.length !== restoredTeamCount)
          )
        ) {
          throw new Error("invalid-settings");
        }
        setTitle(activity.title);
        setQuestions(restored);
        setSource("manual");
        setSourceAssignmentId(null);
        setSelectedAssignment(null);
        setStep("prepare");
        if (savedSettings.mode === "solo" || savedSettings.mode === "teams" ||
            savedSettings.mode === "classroom" || savedSettings.mode === "independent") {
          setMode(savedSettings.mode);
        }
        if (typeof savedTeamCount === "number" && savedTeamCount >= 2 && savedTeamCount <= 6) {
          setTeamCount(savedTeamCount);
        }
        if (Array.isArray(savedCustomTeamNames)) {
          setCustomTeamNames([
            ...savedCustomTeamNames,
            ...Array<string>(6 - savedCustomTeamNames.length).fill(""),
          ]);
        }
        if (typeof savedSettings.targetClass === "string") setTargetClass(savedSettings.targetClass);
        toast.success(ar ? "تم تحميل نشاط اللعبة المحفوظ" : "Saved game activity loaded");
      } catch {
        toast.error(ar ? "تعذّر تحميل نشاط اللعبة المحفوظ" : "Could not load the saved game activity");
      }
    })();
  }, []);

  const sourceNeedsImportForLiveGame =
    sourceAssignmentId === selectedAssignment?.id
    && !!selectedAssignment
    && requiresImportedCopyForLiveWameeth(
      { ...selectedAssignment, hiddenByAdmin: selectedAssignment.hiddenByAdmin ?? false },
      user?.id ?? -1,
    );

  const importLibraryActivityAndOpen = async () => {
    if (
      !selectedAssignment
      || !sourceNeedsImportForLiveGame
      || importingLibraryAssignmentRef.current
    ) return;

    importingLibraryAssignmentRef.current = true;
    setImportingLibraryAssignment(true);
    try {
      const res = await fetch(`${API}/api/assignments/${selectedAssignment.id}/import`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !Number.isInteger(data.id) || data.id <= 0) {
        throw new Error(data.message || t.wameethCreate.importDialog.error);
      }

      setShowImportPrompt(false);
      setLocation(getWameethSetupPath(data.id));
    } catch (err: any) {
      toast.error(err.message || t.wameethCreate.importDialog.error);
    } finally {
      importingLibraryAssignmentRef.current = false;
      setImportingLibraryAssignment(false);
    }
  };

  const ensureAssignment = async (): Promise<number> => {
    if (sourceAssignmentId != null) return sourceAssignmentId;

    const res = await fetch(`${API}/api/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: title.trim() || (ar ? "وميض" : "Wameeth"),
        isShared: false,
        contentKind: "competition",
        questions: validQuestions.map(q => {
          if (q.type === "fill_blank") {
            const alternatives = q.closeAnswers.split(",").map(s => s.trim()).filter(Boolean);
            const allAnswers = [q.fillAnswer.trim(), ...alternatives].join("|");
            return { text: q.text, questionType: "fill_blank", correctAnswer: allAnswers, optionA: "", optionB: "", optionC: "", optionD: "", imageUrl: q.imageUrl || null };
          }
          if (q.type === "tf") {
            return { text: q.text, questionType: "true_false", correctAnswer: q.correctAnswer === "A" ? "true" : "false", optionA: ar ? "صح" : "True", optionB: ar ? "خطأ" : "False", optionC: "", optionD: "", imageUrl: q.imageUrl || null };
          }
          return { text: q.text, questionType: "mcq", optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctAnswer: q.correctAnswer, imageUrl: q.imageUrl || null };
        }),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || (ar ? "تعذّر تجهيز الأسئلة" : "Failed to prepare questions"));
    }
    setSourceAssignmentId(data.id);
    return data.id as number;
  };

  const createPlayLink = async (
    assignmentId: number,
    gameType: "wameeth" | "wameeth_class",
  ): Promise<string> => {
    const res = await fetch(`${API}/api/assignments/${assignmentId}/play-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ gameType }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(data.message || (ar ? "تعذّر إنشاء رابط اللعبة" : "Failed to create game link"));
    }
    return data.token as string;
  };

  // Start the chosen mode using the exact same prepared question set,
  // regardless of where the questions came from.
  const startGame = async () => {
    if (starting || !mode) return;
    if (validQuestions.length < 2) {
      toast.error(ar ? "أضف سؤالين صالحين على الأقل" : "Add at least 2 valid questions");
      return;
    }
    if (mode === "classroom" && classroomEligible.length < 2) {
      toast.error(ar
        ? "وميض الصف يدعم فقط اختيار متعدد وصح/خطأ — أضف سؤالين على الأقل من هذين النوعين"
        : "Class mode only supports MCQ and true/false — add at least 2 of those types");
      return;
    }
    if ((mode === "solo" || mode === "teams") && sourceNeedsImportForLiveGame) {
      setShowImportPrompt(true);
      return;
    }
    setStarting(true);

    try {
      const assignmentId = await ensureAssignment();
      await saveGameActivity({
        gameType: "wameeth",
        title: title.trim() || (ar ? "وميض" : "Wameeth"),
        content: validQuestions,
        settings: {
          mode,
          assignmentId,
          teamCount: mode === "teams" ? teamCount : null,
          customTeamNames: mode === "teams"
            ? customTeamNames.slice(0, teamCount).map(name => name.trim())
            : null,
          targetClass: targetClass || null,
        },
        source: sourceAssignmentId != null ? "assignment" : "game-launch",
      });

      if (mode === "classroom") {
        const qs = classroomEligible.map(q => q.type === "tf"
          ? { text: q.text, options: [ar ? "صح" : "True", ar ? "خطأ" : "False"], correct: q.correctAnswer === "A" ? 0 : 1, imageUrl: q.imageUrl || null }
          : { text: q.text, options: [q.optionA, q.optionB, q.optionC, q.optionD], correct: ["A", "B", "C", "D"].indexOf(q.correctAnswer), imageUrl: q.imageUrl || null });
        sessionStorage.setItem(WAMEETH_CLASS_SETUP_KEY, JSON.stringify({ questions: qs, duration: 20, title: title || undefined }));
        const token = await createPlayLink(assignmentId, "wameeth_class");
        setLocation(`/game/wameeth/class?token=${encodeURIComponent(token)}`);
        return;
      }

      if (mode === "independent") {
        const token = await createPlayLink(assignmentId, "wameeth");
        const res = await fetch(`${API}/api/play/${encodeURIComponent(token)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok || !data.playRoute) {
          throw new Error(data.message || (ar ? "تعذّر بدء اللعبة" : "Failed to start the game"));
        }
        if (!data.pin || !data.controlToken) {
          throw new Error(ar ? "تعذّر تهيئة جلسة اللعب" : "Failed to initialize the game session");
        }
        storeIndependentControlToken(String(data.pin), String(data.controlToken));
        const playerName = ar ? "لاعب" : "Player";
        setLocation(
          `${data.playRoute}?name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent("🎯")}&independent=1&token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent("/game/wameeth/create")}`,
        );
        return;
      }

      // Solo / teams keep the existing live-game socket flow unchanged.
      const socket = getSocket();
      const validCustomNames = mode === "teams" ? customTeamNames.slice(0, teamCount).map(n => n.trim()) : undefined;
      const hasCustomNames = validCustomNames && validCustomNames.some(n => n.length > 0);
      socket.emit(
        "teacher:create-game",
        {
          assignmentId,
          gameMode: mode,
          teamCount: mode === "teams" ? teamCount : undefined,
          customTeamNames: hasCustomNames ? validCustomNames : undefined,
          targetClass: targetClass || undefined,
        },
        (res: { pin?: string; error?: string }) => {
          setStarting(false);
          if (res?.error || !res?.pin) {
            toast.error(res?.error || (ar ? "تعذّر بدء اللعبة" : "Failed to start the game"));
            disconnectSocket();
            return;
          }
          setLocation(`/teacher/game/${res.pin}`);
        },
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "An error occurred"));
      setStarting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir} data-testid="wameeth-setup">
      <Dialog open={showImportPrompt} onOpenChange={setShowImportPrompt}>
        <DialogContent
          className="max-w-md rounded-2xl p-6 text-start"
          dir={dir}
          closeLabel={t.wameethCreate.importDialog.close}
          aria-busy={importingLibraryAssignment}
        >
          <DialogHeader className="text-start">
            <DialogTitle className="text-xl font-black text-foreground">
              {t.wameethCreate.importDialog.title}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-7 text-muted-foreground">
              {t.wameethCreate.importDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 sm:justify-start sm:space-x-0">
            <button
              type="button"
              onClick={() => void importLibraryActivityAndOpen()}
              disabled={importingLibraryAssignment}
              aria-label={importingLibraryAssignment
                ? t.wameethCreate.importDialog.importing
                : t.wameethCreate.importDialog.importAction}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importingLibraryAssignment && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {importingLibraryAssignment
                ? t.wameethCreate.importDialog.importing
                : t.wameethCreate.importDialog.importAction}
            </button>
            <button
              type="button"
              onClick={() => setLocation("/teacher/library/homework")}
              disabled={importingLibraryAssignment}
              aria-label={t.wameethCreate.importDialog.backToLibrary}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.wameethCreate.importDialog.backToLibrary}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-4 lg:py-5 flex items-center gap-4">
          <Link href="/teacher?tab=competitive" className="p-2 lg:p-2.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
            <BackIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </Link>
          <div className="flex items-center gap-3 lg:gap-3.5">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
              <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
            </div>
            <h1 className="text-lg lg:text-xl font-black text-foreground tracking-tight">{ar ? "وميض" : "Wameedh"}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 lg:space-y-8">
        {/* Step progress */}
        <div className="flex items-center gap-2 px-1">
          {[
            { key: "prepare", label: ar ? "١. الأسئلة" : "1. Questions" },
            { key: "mode", label: ar ? "٢. طريقة اللعب" : "2. Play mode" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <span className={cn(
                "text-[11px] lg:text-xs font-extrabold px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full border",
                step === s.key ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-transparent",
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {step === "prepare" ? (
          <>
            {/* Step 1a: choose how to build the question list */}
            <AnimatePresence mode="popLayout">
              {!source && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 lg:space-y-8 max-w-3xl lg:max-w-5xl mx-auto mt-4 lg:mt-6">
                  <div className="text-center space-y-2 lg:space-y-3 mb-2">
                    <h2 className="text-2xl lg:text-3xl font-black text-foreground">{ar ? "كيف تريد إضافة أسئلة وميض؟" : "How do you want to add Wameedh questions?"}</h2>
                    <p className="text-sm lg:text-base text-muted-foreground font-medium">{ar ? "اختر الطريقة الأنسب لتجهيز الأسئلة" : "Choose the best way to prepare your questions"}</p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 lg:gap-6">
                    <button
                      type="button"
                      onClick={() => setSource("assignment")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-primary/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-primary/10 shadow-sm relative z-10">
                        <BookOpen className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "من واجب موجود" : "From an assignment"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "اختر واجباً من مكتبتك واستورد أسئلته مباشرة" : "Pick an assignment from your library and import its questions"}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource("ai")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-amber-500/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-amber-500/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-amber-500/10 shadow-sm relative z-10">
                        <Sparkles className="w-6 h-6 lg:w-7 lg:h-7 text-amber-500" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "بالذكاء الاصطناعي" : "With AI"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "أنشئ أسئلة اختيار متعدد تلقائياً في أي موضوع" : "Auto-generate multiple-choice questions on any topic"}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSource("manual")}
                      className="group p-6 lg:p-8 bg-card border-2 border-border/60 hover:border-emerald-500/50 rounded-3xl text-start transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-0 end-0 w-24 h-24 lg:w-32 lg:h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-emerald-500/10 transition-colors" />
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center mb-5 lg:mb-6 transition-colors border border-emerald-500/10 shadow-sm relative z-10">
                        <PenLine className="w-6 h-6 lg:w-7 lg:h-7 text-emerald-600" />
                      </div>
                      <h3 className="font-black text-foreground text-lg lg:text-xl mb-2 lg:mb-2.5 relative z-10">{ar ? "إضافة يدوية" : "Add manually"}</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed relative z-10">{ar ? "اكتب أسئلتك من الصفر — اختيار متعدد، صح وخطأ، أو أملأ الفراغ" : "Write your own questions — MCQ, true/false, or fill-in-the-blank"}</p>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 1b: source-specific input + unified review */}
            {source && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 lg:space-y-8">
                <div className="flex items-center gap-3 lg:gap-4 mb-2">
                  <button type="button" onClick={resetSource} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                  <div>
                    <h2 className="font-black text-xl lg:text-2xl text-foreground">
                      {source === "assignment" ? (ar ? "اختيار واجب" : "Choose an assignment")
                        : source === "ai" ? (ar ? "ذكاء اصطناعي" : "AI generation")
                        : (ar ? "إضافة يدوية" : "Add manually")}
                    </h2>
                    <p className="text-xs lg:text-sm text-muted-foreground font-medium">
                      {source === "assignment" ? (ar ? "سيتم استيراد أسئلة الواجب لتستخدمها في وميض" : "The assignment's questions will be imported for Wameedh")
                        : source === "ai" ? (ar ? "ولّد أسئلة جديدة تلقائياً ثم عدّلها كما تشاء" : "Generate new questions automatically, then edit as needed")
                        : (ar ? "اكتب الأسئلة والخيارات بنفسك خطوة بخطوة" : "Write the questions and options yourself, step by step")}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_420px] gap-6 lg:gap-8 items-start">
                  {/* Main content */}
                  <div className="space-y-6 lg:space-y-7 order-2 md:order-1">
                    {source === "assignment" && (
                      <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden p-1">
                        <div className="p-4 lg:p-5 border-b border-border/40">
                          <div className="relative">
                            <Search className="absolute top-1/2 -translate-y-1/2 end-4 w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground pointer-events-none" />
                            <input
                              value={assignSearch}
                              onChange={e => setAssignSearch(e.target.value)}
                              placeholder={ar ? "ابحث في واجباتك المحفوظة..." : "Search your saved assignments..."}
                              className="w-full pe-12 ps-4 py-3.5 lg:py-4 rounded-2xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary/20 text-sm lg:text-base font-bold transition-all"
                            />
                          </div>
                        </div>
                        {assignmentsLoading ? (
                          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : filteredAssignments.length === 0 ? (
                          <p className="text-center text-muted-foreground py-16 text-sm lg:text-base font-medium">{ar ? "لا توجد واجبات مطابقة" : "No matching assignments"}</p>
                        ) : (
                          <div className="p-3 lg:p-4 space-y-2 lg:space-y-2.5 max-h-[400px] lg:max-h-[460px] overflow-y-auto">
                            {filteredAssignments.map((a: Assignment) => (
                              <button
                                key={a.id}
                                type="button"
                                data-testid={`wameeth-assignment-${a.id}`}
                                disabled={loadingAssignment}
                                onClick={() => handleSelectAssignment(a)}
                                className={cn(
                                  "w-full text-start px-5 lg:px-6 py-4 lg:py-5 rounded-2xl border-2 transition-all group disabled:opacity-60",
                                  selectedAssignment?.id === a.id ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-background hover:bg-muted/50 hover:border-border",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className={cn("font-bold text-sm lg:text-base truncate", selectedAssignment?.id === a.id ? "text-primary" : "text-foreground group-hover:text-primary")}>{a.title}</p>
                                  {loadingAssignment && selectedAssignment?.id === a.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                                  ) : selectedAssignment?.id === a.id ? (
                                    <Check className="w-5 h-5 text-primary shrink-0" />
                                  ) : null}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {source === "ai" && (
                      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-5 sm:p-6 lg:p-8 shadow-sm">
                        <div className="flex items-center gap-2 lg:gap-3 mb-5 lg:mb-6">
                          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600" />
                          </div>
                          <h3 className="font-black text-base lg:text-lg text-amber-900 dark:text-amber-400">{ar ? "توليد الأسئلة" : "Generate questions"}</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "الموضوع *" : "Topic *"}</label>
                            <input
                              value={aiTopic}
                              onChange={e => setAiTopic(e.target.value)}
                              placeholder={ar ? "مثال: الجهاز الهضمي" : "e.g. Digestive system"}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "المادة (اختياري)" : "Subject (optional)"}</label>
                            <input
                              value={aiSubject}
                              onChange={e => setAiSubject(e.target.value)}
                              placeholder={ar ? "مثال: علوم" : "e.g. Science"}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 text-sm lg:text-base font-bold shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:gap-5 mb-5 lg:mb-6">
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "العدد" : "Count"}</label>
                            <select
                              value={aiCount}
                              onChange={e => setAiCount(Number(e.target.value))}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                            >
                              {[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} {ar ? "أسئلة" : "questions"}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs lg:text-sm font-bold text-foreground mb-1.5 lg:mb-2">{ar ? "المستوى" : "Difficulty"}</label>
                            <select
                              value={aiDifficulty}
                              onChange={e => setAiDifficulty(e.target.value as Difficulty)}
                              className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-card border border-border focus:outline-none text-sm lg:text-base font-bold shadow-sm"
                            >
                              <option value="easy">{ar ? "سهل" : "Easy"}</option>
                              <option value="medium">{ar ? "متوسط" : "Medium"}</option>
                              <option value="hard">{ar ? "صعب" : "Hard"}</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={generateWithAI}
                          disabled={aiGenerating || !aiTopic.trim()}
                          className="w-full flex items-center justify-center gap-2 py-3.5 lg:py-4 rounded-xl font-black text-sm lg:text-base bg-gradient-to-l from-amber-500 to-orange-400 hover:from-amber-600 hover:to-orange-500 text-white transition-all disabled:opacity-50 shadow-md hover:shadow-amber-500/25 active:scale-95"
                        >
                          {aiGenerating ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />{ar ? "جاري التوليد..." : "Generating..."}</>
                          ) : (
                            <><Sparkles className="w-5 h-5" />{questions.length > 0 ? (ar ? "توليد أسئلة إضافية" : "Generate more") : (ar ? "توليد الأسئلة الآن" : "Generate questions")}</>
                          )}
                        </button>
                      </div>
                    )}

                    {source === "manual" && questions.length === 0 && (
                      <div
                        className="bg-card border-2 border-dashed border-border/60 rounded-3xl p-10 lg:p-14 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
                        onClick={addManualQuestion}
                      >
                        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 lg:mb-5 group-hover:bg-primary/10 transition-colors">
                          <Plus className="w-6 h-6 lg:w-7 lg:h-7 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <p className="font-bold text-foreground text-lg lg:text-xl mb-1 lg:mb-1.5 group-hover:text-primary">{ar ? "أضف سؤالك الأول" : "Add your first question"}</p>
                        <p className="text-xs lg:text-sm text-muted-foreground">{ar ? "اضغط هنا للبدء في إضافة الأسئلة يدوياً" : "Click here to start adding questions manually"}</p>
                      </div>
                    )}

                    {/* Unified review list — edit/delete before choosing a play mode */}
                    {questions.length > 0 && (
                      <div className="space-y-4 lg:space-y-5">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="font-black text-lg lg:text-xl text-foreground flex items-center gap-2">
                            {ar ? "أسئلة وميض" : "Wameedh questions"}
                            <span className="bg-muted px-2.5 py-0.5 rounded-md text-sm">{questions.length}</span>
                          </h3>
                          <button
                            type="button"
                            onClick={addManualQuestion}
                            className="flex items-center gap-1.5 px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            {ar ? "سؤال جديد" : "New question"}
                          </button>
                        </div>
                        <div className="space-y-3 lg:space-y-4">
                          {questions.map((q, i) => (
                            <QuestionCard
                              key={i}
                              q={q}
                              index={i}
                              showDifficulty={false}
                              showAudio={false}
                              onChange={updated => updateQuestion(i, updated)}
                              onDelete={() => deleteQuestion(i)}
                            />
                          ))}
                        </div>
                        {questions.length > 2 && (
                          <button
                            type="button"
                            onClick={addManualQuestion}
                            className="w-full py-5 lg:py-6 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors font-bold lg:text-base flex items-center justify-center gap-2"
                          >
                            <Plus className="w-5 h-5" /> {ar ? "أضف سؤالاً آخر" : "Add another question"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="order-1 md:order-2 space-y-5 md:sticky md:top-24">
                    <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-5 lg:space-y-6">
                      <div>
                        <label className="block text-sm lg:text-base font-bold text-foreground mb-2 lg:mb-2.5">{ar ? "عنوان (اختياري)" : "Title (optional)"}</label>
                        <input
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder={ar ? "يظهر في شاشة اللعبة..." : "Shown on the game screen..."}
                          className="w-full px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all shadow-inner"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("mode")}
                        disabled={validQuestions.length < 2}
                        className="w-full flex items-center justify-center gap-2 py-4 lg:py-5 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 active:scale-95 disabled:opacity-50"
                      >
                        <Check className="w-5 h-5" />
                        {ar ? "التالي: اختر طريقة اللعب" : "Next: choose play mode"}
                      </button>
                      {validQuestions.length < 2 && (
                        <p className="text-[10px] lg:text-xs text-center text-muted-foreground font-medium px-2">
                          {ar ? "أضف سؤالين صالحين على الأقل قبل المتابعة" : "Add at least 2 valid questions to continue"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          /* ─── Step 2: play mode ─────────────────────────────────────── */
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 lg:space-y-5 max-w-3xl lg:max-w-4xl mx-auto">
            <div className="flex items-center gap-3 lg:gap-4">
              <button type="button" onClick={() => setStep("prepare")} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <BackIcon className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <div>
                <h2 className="font-black text-xl lg:text-2xl text-foreground">{ar ? "اختر طريقة اللعب" : "Choose play mode"}</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-medium">{ar ? `${validQuestions.length} سؤال جاهز — اختر النمط ثم ابدأ` : `${validQuestions.length} questions ready — choose a mode and start`}</p>
              </div>
            </div>

            <div className="space-y-4 lg:space-y-5">
              <section
                data-testid="playmode-devices-section"
                className="rounded-3xl border border-blue-200/70 bg-blue-50/40 p-3.5 sm:p-4 lg:p-5 dark:border-blue-900/40 dark:bg-blue-950/20"
              >
                <div className="flex items-start gap-3 px-1 pb-3 sm:px-2 sm:pb-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-foreground text-base sm:text-lg">
                      {ar ? "من جهاز كل لاعب" : "From each player's device"}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
                      {ar ? "يجيب كل لاعب من جواله أو جهازه، وتظهر النتائج مباشرة." : "Each player answers from their own device and results update live."}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="playmode-solo"
                    onClick={() => setMode("solo")}
                    className={cn(
                      "relative min-h-[124px] p-3.5 sm:p-4 lg:p-5 rounded-2xl border-2 text-start transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                      mode === "solo" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md shadow-blue-500/10" : "border-border bg-card hover:border-blue-300",
                    )}
                  >
                    <User className={cn("w-6 h-6 mb-2 transition-colors", mode === "solo" ? "text-blue-600" : "text-muted-foreground")} />
                    <p className="font-black text-foreground text-sm sm:text-base">{ar ? "فردي" : "Individual"}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{ar ? "كل لاعب ينافس بنفسه ويجمع نقاطه بشكل مستقل." : "Every player competes individually and earns a personal score."}</p>
                    {mode === "solo" && <Check className="absolute top-3 end-3 w-4 h-4 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    data-testid="playmode-teams"
                    onClick={() => setMode("teams")}
                    className={cn(
                      "relative min-h-[124px] p-3.5 sm:p-4 lg:p-5 rounded-2xl border-2 text-start transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50",
                      mode === "teams" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md shadow-purple-500/10" : "border-border bg-card hover:border-purple-300",
                    )}
                  >
                    <UsersRound className={cn("w-6 h-6 mb-2 transition-colors", mode === "teams" ? "text-purple-600" : "text-muted-foreground")} />
                    <p className="font-black text-foreground text-sm sm:text-base">{ar ? "فرق" : "Teams"}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{ar ? "يلعب كل لاعب من جهازه ضمن فريق واحد." : "Players answer from their devices while competing as teams."}</p>
                    {mode === "teams" && <Check className="absolute top-3 end-3 w-4 h-4 text-purple-600" />}
                  </button>
                </div>
              </section>

              <section
                data-testid="playmode-board-section"
                className="rounded-3xl border border-emerald-200/70 bg-emerald-50/40 p-3.5 sm:p-4 lg:p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              >
                <div className="flex items-start gap-3 px-1 pb-3 sm:px-2 sm:pb-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <School className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-foreground text-base sm:text-lg">
                      {ar ? "على السبورة" : "On the board"}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted-foreground">
                      {ar ? "اللعب من الشاشة المشتركة في الصف، دون حاجة لجهاز لكل لاعب." : "Play together on the shared classroom screen without a device for every player."}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="playmode-classroom"
                    onClick={() => classroomEligible.length >= 2 && setMode("classroom")}
                    disabled={classroomEligible.length < 2}
                    className={cn(
                      "relative min-h-[124px] p-3.5 sm:p-4 lg:p-5 rounded-2xl border-2 text-start transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                      mode === "classroom" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md shadow-emerald-500/10" : "border-border bg-card hover:border-emerald-300",
                      classroomEligible.length < 2 && "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none hover:border-border",
                    )}
                  >
                    <School className={cn("w-6 h-6 mb-2 transition-colors", mode === "classroom" ? "text-emerald-600" : "text-muted-foreground")} />
                    <p className="font-black text-foreground text-sm sm:text-base">{ar ? "وميض الصف" : "Classroom Wameedh"}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                      {classroomEligible.length < 2
                        ? (ar ? "لا توجد أسئلة مناسبة للعب الصف حالياً." : "Not enough suitable questions for class play.")
                        : (ar ? "يتنافس طالبان أو فريقان مباشرة على شاشة واحدة." : "Students or two teams compete directly on one shared screen.")}
                    </p>
                    {mode === "classroom" && <Check className="absolute top-3 end-3 w-4 h-4 text-emerald-600" />}
                  </button>

                  <button
                    type="button"
                    data-testid="playmode-independent"
                    onClick={() => setMode("independent")}
                    className={cn(
                      "relative min-h-[124px] p-3.5 sm:p-4 lg:p-5 rounded-2xl border-2 text-start transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
                      mode === "independent" ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-md shadow-amber-500/10" : "border-border bg-card hover:border-amber-300",
                    )}
                  >
                    <Zap className={cn("w-6 h-6 mb-2 transition-colors", mode === "independent" ? "text-amber-600" : "text-muted-foreground")} />
                    <p className="font-black text-foreground text-sm sm:text-base">{ar ? "مستقلة" : "Independent"}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1 leading-relaxed">{ar ? "لعب فردي على السبورة، مناسب للتحدي السريع أو التدريب الذاتي." : "A solo board experience for a quick challenge or self-practice."}</p>
                    {mode === "independent" && <Check className="absolute top-3 end-3 w-4 h-4 text-amber-600" />}
                  </button>
                </div>
              </section>
            </div>

            {mode === "teams" && (
              <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-5 lg:p-7 space-y-4 lg:space-y-5">
                <div>
                  <label className="block text-xs lg:text-sm font-bold text-foreground mb-2 lg:mb-3 text-center">{ar ? "عدد الفرق" : "Number of teams"}</label>
                  <div className="flex justify-center gap-2 lg:gap-3">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTeamCount(n)}
                        className={cn(
                          "w-10 h-10 lg:w-12 lg:h-12 rounded-xl font-black text-sm lg:text-base transition-all",
                          teamCount === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs lg:text-sm font-bold text-foreground mb-2 lg:mb-3 text-center">{ar ? "أسماء الفرق (اختياري)" : "Team names (optional)"}</label>
                  <div className="space-y-2 lg:space-y-2.5">
                    {Array.from({ length: teamCount }).map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        value={customTeamNames[i] || ""}
                        onChange={(e) => {
                          const next = [...customTeamNames];
                          next[i] = e.target.value;
                          setCustomTeamNames(next);
                        }}
                        placeholder={`${ar ? "الفريق" : "Team"} ${i + 1}`}
                        maxLength={20}
                        className="w-full px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-xl bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:bg-background text-sm lg:text-base font-bold transition-all"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(mode === "solo" || mode === "teams") && (
              <ClassSelector value={targetClass} onChange={setTargetClass} accent="#a855f7" />
            )}

            <button
              type="button"
              onClick={startGame}
              disabled={!mode || starting}
              data-testid="start-wameeth-game"
              className="sticky bottom-3 z-10 w-full flex items-center justify-center gap-2 py-3.5 lg:py-4 rounded-2xl font-black text-base lg:text-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-xl shadow-primary/25 hover:shadow-primary/35 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" fill="currentColor" />}
              {starting ? (ar ? "جارٍ بدء اللعبة..." : "Starting game...") : mode ? (ar ? "ابدأ اللعبة الآن" : "Start game now") : (ar ? "اختر نمط اللعب للبدء" : "Choose a mode to start")}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
