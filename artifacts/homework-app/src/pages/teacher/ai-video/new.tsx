import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  useAiVideoProject,
  useCreateAiVideoStoryboard,
  useUpdateAiVideoProject,
  useAiVideoRenderQuote,
  useRenderAiVideoProject,
  useRetryAiVideoProject,
  AiVideoScene,
  AiVideoProject,
  AiVideoRenderQuote,
  getAiVideoStoryboardContentKey,
  getStorageUrl,
  shouldHydrateAiVideoEditor,
} from "@/hooks/use-ai-video";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { Card } from "@/components/ui-elements";
import { toast } from "sonner";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  ArrowRight, ArrowLeft, Image as ImageIcon, Type,
  Clock, Monitor, Sparkles, Loader2, Play,
  Download, AlertCircle, RefreshCw, ChevronUp, ChevronDown, Users
} from "lucide-react";

const VERIFIED_PROVIDER_COSTS: Record<30 | 60 | 90, number> = {
  30: 12,
  60: 24,
  90: 36,
};

function useQueryId() {
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const id = params.get("id");
  return id ? parseInt(id, 10) : null;
}

export default function AiVideoStudio() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();
  const id = useQueryId();

  const { data: currentUser, isLoading: authLoading, error: authError } = useGetCurrentTeacher({ query: { retry: false } as any });
  const isAdmin = currentUser?.isAdmin === true;
  useEffect(() => {
    if (authLoading) return;
    if (authError || !currentUser) {
      setLocation("/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search));
    } else if (!isAdmin) {
      setLocation("/teacher");
    }
  }, [authLoading, authError, currentUser, isAdmin, setLocation]);

  const { data: project, isLoading: loadingProject } = useAiVideoProject(
    id,
    !authLoading && !authError && isAdmin,
  );
  const createMutation = useCreateAiVideoStoryboard();
  const updateMutation = useUpdateAiVideoProject();
  const renderMutation = useRenderAiVideoProject();
  const retryMutation = useRetryAiVideoProject();
  const quoteMutation = useAiVideoRenderQuote();
  const refreshCredits = useRefreshCreditsBalance();

  // Form State
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [prompt, setPrompt] = useState("");

  // Settings
  const [language, setLanguage] = useState<"ar"|"en">("ar");
  const [duration, setDuration] = useState<30|60|90>(60);
  const [aspectRatio, setAspectRatio] = useState<"16:9"|"9:16">("16:9");
  const [visualStyle, setStyle] = useState<"educational"|"cinematic"|"playful"|"minimal">("educational");
  const [captions, setCaptions] = useState(true);
  const [renderQuote, setRenderQuote] = useState<AiVideoRenderQuote | null>(null);
  const [quoteConsent, setQuoteConsent] = useState(false);
  const [quoteAction, setQuoteAction] = useState<"render" | "retry">("render");
  const projectSnapshotRef = useRef<{ id: number; status: AiVideoProject["status"]; contentKey: string | null } | null>(null);

  // Storyboard Edit State
  const [editTitle, setEditTitle] = useState("");
  const [editScenes, setEditScenes] = useState<AiVideoScene[]>([]);
  const initializedForId = useRef<number | null>(null);
  const editsDirty = useRef(false);
  const hydratedContentKey = useRef<string | null>(null);

  const hydrateEditor = (nextProject: AiVideoProject) => {
    setEditTitle(nextProject.storyboard?.title || nextProject.title);
    setEditScenes(nextProject.storyboard?.scenes || []);
    initializedForId.current = nextProject.id;
    hydratedContentKey.current = getAiVideoStoryboardContentKey(nextProject.storyboard);
    editsDirty.current = false;
  };

  // Hydrate backend updates without overwriting an active unsaved storyboard edit.
  useEffect(() => {
    if (!project) return;
    const projectChanged = initializedForId.current !== project.id;
    if (projectChanged && !project.storyboard) {
      setEditTitle(project.title);
      setEditScenes([]);
      initializedForId.current = project.id;
      hydratedContentKey.current = null;
      editsDirty.current = false;
      return;
    }
    const nextContentKey = getAiVideoStoryboardContentKey(project.storyboard);
    if (shouldHydrateAiVideoEditor({
      currentProjectId: initializedForId.current,
      nextProjectId: project.id,
      status: project.status,
      isDirty: editsDirty.current,
      currentContentKey: hydratedContentKey.current,
      nextContentKey,
    })) {
      hydrateEditor(project);
    }
  }, [project]);

  useEffect(() => {
    const nextSnapshot = project ? {
      id: project.id,
      status: project.status,
      contentKey: getAiVideoStoryboardContentKey(project.storyboard),
    } : null;
    const previous = projectSnapshotRef.current;
    if (renderQuote && (!nextSnapshot || !previous
      || previous.id !== nextSnapshot.id
      || previous.status !== nextSnapshot.status
      || previous.contentKey !== nextSnapshot.contentKey)) {
      setRenderQuote(null);
      setQuoteConsent(false);
    }
    projectSnapshotRef.current = nextSnapshot;
  }, [project?.id, project?.status, project?.storyboard, renderQuote]);

  const handleLanguageChange = (lang: "ar"|"en") => {
    setLanguage(lang);
  };

  const handleError = (error: Error) => {
    if (error.message !== "INSUFFICIENT_CREDITS") {
      toast.error(error.message || (isAr ? "حدث خطأ غير متوقع" : "An unexpected error occurred"));
    }
  };

  const handleGenerate = () => {
    if (!topic.trim() && !sourceText.trim()) {
      toast.error(isAr ? "يرجى إدخال الموضوع أو النص التعليمي" : "Please enter a topic or source text");
      return;
    }
    if (sourceText.length > 12000) {
      toast.error(isAr ? "النص التعليمي طويل جداً (الحد الأقصى 12000 حرف)" : "Source text too long (max 12000 chars)");
      return;
    }
    if (prompt.length > 1500) {
      toast.error(isAr ? "التوجيهات طويلة جداً (الحد الأقصى 1500 حرف)" : "Prompt too long (max 1500 chars)");
      return;
    }
    if (!window.confirm(isAr
      ? "سيستخدم إنشاء القصة المصوّرة نقاط أداة الذكاء الاصطناعي لتخطيط النص فقط. لن يبدأ إنتاج الفيديو المدفوع؛ يتطلب ذلك عرض سعر وموافقة منفصلة لاحقاً. هل تريد المتابعة؟"
      : "Creating the storyboard uses AI-tool points for script planning only. It will not start paid video production; that requires a separate quote and approval later. Continue?")) {
      return;
    }

    createMutation.mutate({
      title: topic || (isAr ? "فيديو بدون عنوان" : "Untitled Video"),
      topic,
      sourceText,
      prompt,
      sourceImages: [],
      language,
      durationSeconds: duration,
      aspectRatio,
      visualStyle,
      voice: "native-dialogue",
      music: false,
      captions,
      idempotencyKey: crypto.randomUUID()
    }, {
      onSuccess: (data) => {
        refreshCredits();
        setLocation(`/teacher/ai-video/new?id=${data.id}`);
      },
      onError: handleError,
      onSettled: () => refreshCredits()
    });
  };

  const totalDuration = editScenes.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const requestedDuration = project?.brief.durationSeconds || 0;
  const durationMismatch = editScenes.length > 0 && totalDuration !== requestedDuration;
  const expectedSceneCount = requestedDuration ? requestedDuration / 6 : 5;

  const validateStoryboard = () => {
    if (!editTitle.trim()) {
      toast.error(isAr ? "عنوان الفيديو مطلوب" : "Video title is required");
      return false;
    }
    if (editScenes.length !== expectedSceneCount) {
      toast.error(isAr
        ? `يتطلب فيديو ${requestedDuration} ثانية ${expectedSceneCount} مقاطع حوارية بالضبط، مدة كل منها 6 ثوانٍ.`
        : `A ${requestedDuration}-second video requires exactly ${expectedSceneCount} six-second dialogue clips.`);
      return false;
    }
    const characters = project?.storyboard?.characters;
    if (!characters || characters.length !== 2) {
      toast.error(isAr ? "يلزم تعريف ثابت لشخصيتي الأستاذ والطالب" : "A stable teacher and student character bible is required");
      return false;
    }
    const characterIds = new Set(characters.map(character => character.id));
    for (let i = 0; i < editScenes.length; i++) {
      const s = editScenes[i];
      if (!s.visualPrompt?.trim() || !s.dialogue?.length) {
        toast.error(isAr ? `المشهد ${i+1} غير مكتمل` : `Scene ${i+1} is incomplete`);
        return false;
      }
      if (s.durationSeconds !== 6 || s.transition !== "cut") {
        toast.error(isAr ? `توقيت المشهد ${i+1} يجب أن يبقى مقفلاً على 6 ثوانٍ وقطع مباشر` : `Scene ${i+1} must remain locked to six seconds with a hard cut`);
        return false;
      }
      if (!s.visibleCharacterIds || s.visibleCharacterIds.length < 2 || s.visibleCharacterIds.some(characterId => !characterIds.has(characterId))) {
        toast.error(isAr ? `يجب أن يظهر الأستاذ والطالب في المشهد ${i+1}` : `Teacher and student must be visible in scene ${i+1}`);
        return false;
      }
      if (s.dialogue.some(turn => !turn.text.trim() || !turn.delivery.trim() || !characterIds.has(turn.speakerId))) {
        toast.error(isAr ? `حوار المشهد ${i+1} غير مكتمل` : `Scene ${i+1} dialogue is incomplete`);
        return false;
      }
      if ((s.onScreenText?.trim().split(/\s+/).filter(Boolean).length || 0) > 7 || (s.onScreenText?.trim().length || 0) > 60) {
        toast.error(isAr ? `النص المختصر للمشهد ${i+1} يجب ألا يتجاوز 7 كلمات أو 60 حرفاً` : `Scene ${i+1} label must be no more than 7 words or 60 characters`);
        return false;
      }
    }
    if (durationMismatch) {
      toast.error(isAr ? `إجمالي المدة (${totalDuration}ث) لا يطابق المدة المطلوبة (${requestedDuration}ث)` : `Total duration (${totalDuration}s) does not match requested (${requestedDuration}s)`);
      return false;
    }
    return true;
  };

  const handleSaveStoryboard = () => {
    if (!project || !validateStoryboard()) return;
    updateMutation.mutate({
      id: project.id,
      data: {
        title: editTitle,
        storyboard: {
          title: editTitle,
          version: (project.storyboard?.version || 1) + 1,
          characters: project.storyboard?.characters,
          scenes: editScenes
        }
      }
    }, {
      onSuccess: (savedProject) => {
        hydrateEditor(savedProject);
        toast.success(isAr ? "تم الحفظ" : "Saved");
      },
      onError: handleError
    });
  };

  const openQuote = (action: "render" | "retry", targetProject = project) => {
    if (!targetProject || quoteMutation.isPending || renderMutation.isPending || retryMutation.isPending) return;
    const requestedSnapshot = {
      id: targetProject.id,
      status: targetProject.status,
      contentKey: getAiVideoStoryboardContentKey(targetProject.storyboard),
    };
    projectSnapshotRef.current = requestedSnapshot;
    quoteMutation.mutate(targetProject.id, {
      onSuccess: (quote) => {
        const currentSnapshot = projectSnapshotRef.current;
        if (quote.projectId !== requestedSnapshot.id
          || !currentSnapshot
          || currentSnapshot.id !== requestedSnapshot.id
          || currentSnapshot.status !== requestedSnapshot.status
          || currentSnapshot.contentKey !== requestedSnapshot.contentKey) {
          toast.error(isAr ? "تم تجاهل عرض سعر لا يطابق المشروع الحالي" : "Ignored a quote that does not match the current project");
          return;
        }
        setQuoteAction(action);
        setRenderQuote(quote);
        setQuoteConsent(false);
      },
      onError: handleError,
    });
  };

  const handleRender = () => {
    if (!project || !validateStoryboard()) return;
    updateMutation.mutate({
      id: project.id,
      data: {
        title: editTitle,
        storyboard: {
          title: editTitle,
          version: (project.storyboard?.version || 1) + 1,
          characters: project.storyboard?.characters,
          scenes: editScenes
        }
      }
    }, {
      onSuccess: (savedProject) => {
        hydrateEditor(savedProject);
        openQuote("render", savedProject);
      },
      onError: handleError
    });
  };

  const handleRetry = () => {
    if (!project) return;
    openQuote("retry");
  };

  const submitApprovedRender = () => {
    if (!project || !renderQuote || !quoteConsent || renderQuote.projectId !== project.id) {
      if (renderQuote && project && renderQuote.projectId !== project.id) {
        setRenderQuote(null);
        setQuoteConsent(false);
        toast.error(isAr ? "عرض السعر لا يخص المشروع الحالي" : "This quote does not belong to the current project");
      }
      return;
    }
    const payload = {
      id: project.id,
      idempotencyKey: `ai-video-${quoteAction}-${renderQuote.id}`,
      approval: {
        quoteId: renderQuote.id,
        accepted: true as const,
        maxProviderCostUsd: renderQuote.totalEstimatedUsd,
      },
    };
    const mutation = quoteAction === "retry" ? retryMutation : renderMutation;
    mutation.mutate(payload, {
      onSuccess: () => setRenderQuote(null),
      onError: handleError,
      onSettled: () => refreshCredits()
    });
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= editScenes.length) return;
    setRenderQuote(null);
    setQuoteConsent(false);
    const newScenes = [...editScenes];
    const temp = newScenes[idx];
    newScenes[idx] = newScenes[idx + dir];
    newScenes[idx + dir] = temp;
    editsDirty.current = true;
    setEditScenes(newScenes);
  };

  const updateScene = (idx: number, updates: Partial<AiVideoScene>) => {
    setRenderQuote(null);
    setQuoteConsent(false);
    editsDirty.current = true;
    setEditScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const updateDialogueTurn = (sceneIndex: number, turnIndex: number, updates: Partial<NonNullable<AiVideoScene["dialogue"]>[number]>) => {
    const scene = editScenes[sceneIndex];
    if (!scene?.dialogue) return;
    const dialogue = scene.dialogue.map((turn, index) => index === turnIndex ? { ...turn, ...updates } : turn);
    updateScene(sceneIndex, {
      dialogue,
      narration: dialogue.map(turn => turn.text).join(" ").trim(),
    });
  };

  if (authLoading || (isAdmin && loadingProject)) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[100dvh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </Layout>
    );
  }

  if (authError || !currentUser || !isAdmin) return null;

  const currentStatus = project?.status || "draft";
  const hasRenderableStoryboard = Boolean(project?.storyboard?.characters?.length === 2 && project.storyboard.scenes.length >= 5);
  const productionBusy = quoteMutation.isPending || updateMutation.isPending || renderMutation.isPending || retryMutation.isPending;

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24" dir={isAr ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="bg-white dark:bg-[#15201B] border-b border-emerald-100 dark:border-emerald-900/30 sticky top-0 z-40">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/teacher/ai-video")}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>
              <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {project ? project.title : (isAr ? "فيديو جديد" : "New Video")}
              </h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-5xl">

          {/* STEP 1: BRIEF FORM */}
          {currentStatus === "draft" && !id && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 bg-white dark:bg-[#15201B] rounded-3xl border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <h2 className="text-lg font-black mb-6 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    {isAr ? "المحتوى والفكـرة" : "Content & Idea"}
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {isAr ? "موضوع الفيديو" : "Video Topic"} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        maxLength={300}
                        placeholder={isAr ? "مثال: دورة الماء في الطبيعة" : "e.g., The Water Cycle"}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {isAr ? "نص تعليمي (اختياري)" : "Source Text (Optional)"}
                      </label>
                      <textarea
                        value={sourceText}
                        onChange={e => setSourceText(e.target.value)}
                        maxLength={12000}
                        placeholder={isAr ? "الصق محتوى الدرس هنا ليبني عليه الذكاء الاصطناعي السيناريو..." : "Paste lesson content here..."}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all min-h-[120px] resize-y"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        {isAr ? "توجيهات إضافية للمخرج (اختياري)" : "Director Prompts (Optional)"}
                      </label>
                      <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        maxLength={1500}
                        placeholder={isAr ? "مثال: اجعل النبرة حماسية وركز على أهمية ترشيد المياه..." : "e.g., Make it enthusiastic and focus on saving water..."}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all min-h-[80px] resize-y"
                      />
                    </div>

                    <p className="rounded-xl bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-xs font-medium text-slate-500">
                      {isAr
                        ? "المرحلة الأولى تدعم إنشاء الفيديو من النص فقط؛ الصور المرجعية لا تؤثر في الحركة المولّدة."
                        : "Phase 1 creates video from text only; reference images do not influence generated motion."}
                    </p>
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="p-6 bg-white dark:bg-[#15201B] rounded-3xl border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <h2 className="text-base font-black mb-6 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <Monitor className="w-4 h-4 text-emerald-600" />
                    {isAr ? "إعدادات الإنتاج" : "Production Settings"}
                  </h2>

                  <div className="space-y-5">
                    {/* Language */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "لغة الفيديو" : "Language"}</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => handleLanguageChange("ar")} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${language === 'ar' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>العربية</button>
                        <button onClick={() => handleLanguageChange("en")} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>English</button>
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "المدة" : "Duration"}</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {[30, 60, 90].map(d => (
                          <button
                            key={d}
                            onClick={() => setDuration(d as 30|60|90)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${duration === d ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {isAr
                          ? "يختار الذكاء الاصطناعي مقدار الشرح المناسب، ويحافظ على الفكرة الأساسية ويوزّع حوار الأستاذ والطالب تلقائياً على المقاطع. لا حاجة لتحديد عدد كلمات."
                          : "AI chooses the right amount of explanation, keeps the essential idea, and automatically distributes teacher/student dialogue across clips. No word limit is needed."}
                      </p>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "الأبعاد" : "Aspect Ratio"}</label>
                       <div className="grid grid-cols-2 gap-2">
                        {[
                          { val: "16:9", icon: <div className="w-6 h-3 border-2 border-current rounded-sm" /> },
                          { val: "9:16", icon: <div className="w-3 h-6 border-2 border-current rounded-sm" /> },
                        ].map(a => (
                          <button
                            key={a.val}
                            onClick={() => setAspectRatio(a.val as any)}
                            className={`flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${aspectRatio === a.val ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200'}`}
                          >
                            {a.icon}
                            <span className="text-[10px] font-black">{a.val}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Style */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "النمط البصري" : "Visual Style"}</label>
                      <select
                        value={visualStyle}
                        onChange={e => setStyle(e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                      >
                        <option value="educational">{isAr ? "تعليمي" : "Educational"}</option>
                        <option value="cinematic">{isAr ? "سينمائي" : "Cinematic"}</option>
                        <option value="playful">{isAr ? "مرح وطفولي" : "Playful"}</option>
                        <option value="minimal">{isAr ? "بسيط ونظيف" : "Minimal"}</option>
                      </select>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                        <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                        {isAr
                          ? "حوار أصلي متزامن بين أستاذ وطالب ظاهرين، بأصوات مميزة مولّدة داخل الفيديو — دون تعليق صوتي خارجي."
                          : "Native synchronized dialogue between a visible teacher and student, with distinct voices generated in the video—no external voice-over."}
                      </p>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Type className="w-4 h-4 text-slate-400" />
                          {isAr ? "تسميات توضيحية" : "Captions"}
                        </span>
                        <input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      </label>
                    </div>
                  </div>
                </Card>

                <button
                  onClick={handleGenerate}
                  disabled={createMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-70"
                >
                  {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isAr ? "توليد السيناريو" : "Generate Storyboard"}
                </button>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-4 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                  {isAr
                    ? `تخطط هذه الخطوة ${duration / 6} مقاطع حوارية مدة كل منها 6 ثوانٍ. الإنتاج اللاحق يستخدم fal-ai/veo3.1 بدقة 1080p وصوت أصلي بسعر موثّق $0.40/ثانية (حد أقصى محافظ $${VERIFIED_PROVIDER_COSTS[duration].toFixed(2)}). التخطيط منفصل عن الإنتاج، ولن يبدأ أي إنفاق على الفيديو دون عرض سعر وموافقة جديدة.`
                    : `This step plans ${duration / 6} six-second dialogue clips. Later production uses fal-ai/veo3.1 at 1080p with native audio at a verified $0.40/second (conservative maximum $${VERIFIED_PROVIDER_COSTS[duration].toFixed(2)}). Planning is separate from rendering, and no video spend begins without a fresh quote and approval.`}
                </div>
              </div>
            </div>
          )}

          {currentStatus === "draft" && id && (
            <div className="max-w-2xl mx-auto mt-12">
              <Card className="p-12 bg-white dark:bg-[#15201B] rounded-[2rem] border-emerald-100 dark:border-emerald-900/30 text-center shadow-xl shadow-emerald-900/5">
                <div className="w-24 h-24 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-8">
                  <Sparkles className="w-10 h-10 text-emerald-600 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">
                  {isAr ? "جاري إعداد القصة المصوّرة..." : "Preparing the storyboard..."}
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  {isAr
                    ? "يحلّل الذكاء الاصطناعي محتوى الدرس ويقسّمه إلى مشاهد تعليمية قابلة للمراجعة. ستظهر هنا تلقائياً عند اكتمالها."
                    : "AI is analyzing the lesson and turning it into editable educational scenes. They will appear here automatically when ready."}
                </p>
              </Card>
            </div>
          )}

          {/* STEP 2: STORYBOARD REVIEW */}
          {currentStatus === "storyboard_ready" && (
            <div className="max-w-4xl mx-auto space-y-6">

              {durationMismatch && (
                <div className="text-amber-600 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl text-sm font-bold flex items-center gap-2 mb-4 border border-amber-200 dark:border-amber-900/50">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {isAr ? `تنبيه: إجمالي مدة المشاهد (${totalDuration}ث) يختلف عن المدة المطلوبة (${requestedDuration}ث). أعد توليد التخطيط؛ مدد المقاطع مقفلة تلقائياً.` : `Warning: Total scene duration (${totalDuration}s) differs from the requested ${requestedDuration}s. Regenerate the plan; clip timings are automatically locked.`}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#15201B] p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{isAr ? "عنوان الفيديو" : "Video Title"}</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => {
                      setRenderQuote(null);
                      setQuoteConsent(false);
                      editsDirty.current = true;
                      setEditTitle(e.target.value);
                    }}
                    className="w-full bg-transparent text-lg font-black text-slate-800 dark:text-slate-100 outline-none border-b-2 border-transparent focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSaveStoryboard}
                    disabled={productionBusy}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {isAr ? "حفظ التعديلات" : "Save Changes"}
                  </button>
                  <button
                    onClick={handleRender}
                    disabled={productionBusy}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {productionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {quoteMutation.isPending ? (isAr ? "جاري طلب عرض السعر..." : "Getting quote...") : (isAr ? "حفظ وطلب عرض سعر" : "Save & Get Quote")}
                  </button>
                </div>
              </div>

              <Card className="p-5 bg-white dark:bg-[#15201B] rounded-2xl border-emerald-100 dark:border-emerald-900/30">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {isAr ? "مرجع الشخصيات والأصوات الثابت" : "Locked character and voice bible"}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {project?.storyboard?.characters?.map(character => (
                    <div key={character.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3">
                      <p className="text-sm font-black">{character.displayName} · {character.role === "teacher" ? (isAr ? "الأستاذ" : "Teacher") : (isAr ? "الطالب" : "Student")}</p>
                      <p className="mt-1 text-xs text-slate-500">{character.appearance}</p>
                      <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">{character.voice}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                {editScenes.map((scene, idx) => (
                  <div key={scene.id || idx} className="bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-sm">
                    {/* Sidebar / Controls */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex md:flex-col items-center justify-between md:justify-start gap-2 border-b md:border-b-0 md:border-e border-slate-200 dark:border-slate-800 md:w-16 shrink-0">
                      <span className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-black text-emerald-600 shadow-sm border border-slate-100 dark:border-slate-700">
                        {idx + 1}
                      </span>
                      <span className="whitespace-nowrap text-[10px] font-black text-slate-500 tabular-nums">
                        {editScenes.slice(0, idx).reduce((sum, item) => sum + (item.durationSeconds || 0), 0)}–
                        {editScenes.slice(0, idx + 1).reduce((sum, item) => sum + (item.durationSeconds || 0), 0)}s
                      </span>
                      <div className="flex md:flex-col gap-1">
                        <button onClick={() => moveScene(idx, -1)} disabled={idx===0} className="p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                        <button onClick={() => moveScene(idx, 1)} disabled={idx===editScenes.length-1} className="p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* Scene Content */}
                    <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="inline-flex max-w-full items-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span className="truncate">{scene.onScreenText || (isAr ? "بدون تسمية مختصرة" : "No short label")}</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-2">{isAr ? "حوار المتحدثين" : "Speaker dialogue"}</label>
                          <div className="space-y-3">
                            {scene.dialogue?.map((turn, turnIndex) => {
                              const speaker = project?.storyboard?.characters?.find(character => character.id === turn.speakerId);
                              return (
                                <div key={`${turn.speakerId}-${turnIndex}`} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                  <p className="mb-2 text-xs font-black text-emerald-700 dark:text-emerald-300">
                                    {speaker?.displayName || turn.speakerId}
                                  </p>
                                  <textarea
                                    value={turn.text}
                                    onChange={event => updateDialogueTurn(idx, turnIndex, { text: event.target.value })}
                                    maxLength={500}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 min-h-[64px] resize-y leading-relaxed"
                                  />
                                  <input
                                    value={turn.delivery}
                                    onChange={event => updateDialogueTurn(idx, turnIndex, { delivery: event.target.value })}
                                    maxLength={160}
                                    aria-label={isAr ? "أسلوب الإلقاء" : "Delivery direction"}
                                    className="mt-2 w-full bg-transparent border-b border-slate-200 dark:border-slate-700 px-1 py-1 text-xs text-slate-500 outline-none focus:border-emerald-500"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-[10px] font-medium text-slate-400">
                            {isAr
                              ? "تُخطط سعة الحوار وتوقيته تلقائياً؛ لا تختصر الكلام يدوياً ولا يُسرّع أو يُقص أثناء الإنتاج."
                              : "Dialogue capacity and timing are planned automatically; you are not asked to shorten it, and production never speeds up or cuts speech."}
                          </p>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? "النص على الشاشة" : "On-Screen Text"}</label>
                          <input
                            type="text"
                            value={scene.onScreenText}
                            onChange={e => updateScene(idx, { onScreenText: e.target.value })}
                             maxLength={60}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" />
                            {isAr ? "وصف المشهد البصري" : "Visual Prompt"}
                          </label>
                          <textarea
                            value={scene.visualPrompt}
                            onChange={e => updateScene(idx, { visualPrompt: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 min-h-[80px] resize-y text-slate-600 dark:text-slate-400"
                          />
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <Clock className="me-1 inline h-3.5 w-3.5" />
                          {isAr ? "6 ثوانٍ · توقيت تلقائي مقفل · قطع مباشر" : "6 seconds · locked automatic timing · hard cut"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: RENDERING */}
          {currentStatus === "rendering" && (
            <div className="max-w-2xl mx-auto mt-12">
              <Card className="p-12 bg-white dark:bg-[#15201B] rounded-[2rem] border-emerald-100 dark:border-emerald-900/30 text-center shadow-xl shadow-emerald-900/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-900/10 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-8">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                  </div>

                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">
                    {isAr ? "جاري إنتاج الفيديو الخاص بك..." : "Rendering your video..."}
                  </h2>
                  <p className="text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                    {isAr
                      ? "يُنتج fal-ai/veo3.1 مقاطع 1080p بصوت الشخصيات الأصلي المتزامن، ثم تُجمع بقطع مباشر. يمكنك مغادرة الصفحة والعودة؛ سيتابع النظام الطلبات المحفوظة دون إرسال إنتاج جديد تلقائياً."
                      : "fal-ai/veo3.1 is producing 1080p clips with synchronized native character voices, then joining them with hard cuts. You may leave and return; saved requests are tracked without automatically submitting new production."}
                  </p>

                  <div className="mt-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 w-full max-w-sm text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    {isAr ? "يتم التحديث تلقائياً" : "Auto-updating"}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4: READY */}
          {currentStatus === "ready" && project && (
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="bg-black rounded-3xl overflow-hidden shadow-2xl relative">
                {project.outputUrl ? (
                  <video
                    src={getStorageUrl(project.outputUrl)}
                    controls
                    className="w-full aspect-video object-contain bg-black"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center">
                    <p className="text-white/50">{isAr ? "الفيديو غير متوفر" : "Video not available"}</p>
                  </div>
                )}
              </Card>

              <div className="flex items-center justify-between bg-white dark:bg-[#15201B] p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{project.title}</h2>
                  <p className="text-sm font-medium text-slate-500">{project.brief.durationSeconds}s • {project.brief.aspectRatio}</p>
                </div>
                {project.outputUrl && (
                  <a
                    href={getStorageUrl(project.outputUrl)}
                    download
                    target="_blank"
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {isAr ? "تحميل الفيديو" : "Download Video"}
                  </a>
                )}
              </div>
              <Card className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border-amber-200 dark:border-amber-900/40">
                <h3 className="font-black text-amber-900 dark:text-amber-100">
                  {isAr ? "جاهز للمراجعة البشرية — لم تُقبل الجودة بعد" : "Awaiting human review — quality is not yet accepted"}
                </h3>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                  {isAr
                    ? "شاهد الفيديو كاملاً وتحقق من: مزامنة الشفاه، صحة النطق، اتساق الشخصيات والأصوات بين المقاطع، واكتمال الحوار والمحتوى."
                    : "Watch the complete video and check lip-sync, pronunciation, character and voice consistency across clips, and dialogue/content completeness."}
                </p>
              </Card>
            </div>
          )}

          {/* STEP 5: FAILED */}
          {currentStatus === "failed" && project && (
            <div className="max-w-2xl mx-auto mt-12">
              <Card className="p-10 bg-white dark:bg-[#15201B] rounded-[2rem] border-red-100 dark:border-red-900/30 text-center shadow-xl shadow-red-900/5">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-6">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">
                  {isAr ? "فشل إنتاج الفيديو" : "Rendering Failed"}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                  {project.errorMessage || (isAr ? "حدث خطأ غير متوقع أثناء معالجة الفيديو." : "An unexpected error occurred during rendering.")}
                </p>
                {hasRenderableStoryboard ? (
                  <button
                    onClick={handleRetry}
                    disabled={productionBusy}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black rounded-xl transition-all"
                  >
                    {productionBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    {quoteMutation.isPending ? (isAr ? "جاري طلب عرض سعر جديد..." : "Getting a fresh quote...") : (isAr ? "طلب عرض سعر لإعادة المحاولة" : "Get Retry Quote")}
                  </button>
                ) : (
                  <button
                    onClick={() => setLocation("/teacher/ai-video/new")}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black rounded-xl transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    {isAr ? "بدء مشروع جديد" : "Start a New Project"}
                  </button>
                )}
              </Card>
            </div>
          )}

          {renderQuote && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
              <Card className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#15201B] p-6 shadow-2xl">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {quoteAction === "retry"
                    ? (isAr ? "موافقة جديدة لإعادة الإنتاج" : "Fresh approval for retry")
                    : (isAr ? "مراجعة تكلفة الإنتاج" : "Review production cost")}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {isAr
                    ? `${renderQuote.sceneCount} مقاطع × 6 ثوانٍ، fal-ai/veo3.1، دقة 1080p وصوت أصلي. ينتهي العرض ${new Date(renderQuote.expiresAt).toLocaleString("ar-SA")}.`
                    : `${renderQuote.sceneCount} × 6-second clips, fal-ai/veo3.1, 1080p with native audio. Quote expires ${new Date(renderQuote.expiresAt).toLocaleString("en-US")}.`}
                </p>
                <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4">
                  <div className="flex justify-between text-sm"><span>{isAr ? "تكلفة المزود المقدّرة" : "Estimated provider cost"}</span><strong>${renderQuote.providerCostUsd.toFixed(2)} USD</strong></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 text-sm"><span>{isAr ? "الإجمالي المتوقع (الحد المعتمد)" : "Expected total (approval limit)"}</span><strong>${renderQuote.totalEstimatedUsd.toFixed(2)} USD</strong></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3 text-sm"><span>{isAr ? "نقاط المنصة (منفصلة)" : "Platform points (separate)"}</span><strong>{renderQuote.platformCredits}</strong></div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {isAr
                    ? `السعر الموثّق $0.40/ثانية؛ ${renderQuote.generatedSeconds} ثانية مولّدة. هذا تقدير محافظ وليس فاتورة مزود نهائية. كل إعادة محاولة تحتاج عرضاً وموافقة جديدين.`
                    : `Verified price: $0.40/second for ${renderQuote.generatedSeconds} generated seconds. This is a conservative estimate, not a final provider invoice. Every retry requires a fresh quote and approval.`}
                </p>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <input
                    type="checkbox"
                    checked={quoteConsent}
                    onChange={event => setQuoteConsent(event.target.checked)}
                    className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isAr
                      ? `أوافق صراحة على بدء إنتاج مدفوع واحد حتى حد $${renderQuote.totalEstimatedUsd.toFixed(2)}. أفهم أن عرض السعر أو معاينة القصة لا يبدأ الإنتاج تلقائياً وأن النتيجة تتطلب مراجعة جودة بشرية.`
                      : `I explicitly approve one paid production attempt up to $${renderQuote.totalEstimatedUsd.toFixed(2)}. I understand that quoting or previewing the storyboard never starts production automatically and the result requires human quality review.`}
                  </span>
                </label>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setRenderQuote(null);
                      setQuoteConsent(false);
                    }}
                    disabled={renderMutation.isPending || retryMutation.isPending}
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    onClick={submitApprovedRender}
                    disabled={!quoteConsent || renderMutation.isPending || retryMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {(renderMutation.isPending || retryMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isAr ? "بدء المحاولة المعتمدة" : "Start Approved Attempt"}
                  </button>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}