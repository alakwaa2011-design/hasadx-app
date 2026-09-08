import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  useAiVideoProject,
  useCreateAiVideoStoryboard,
  useUpdateAiVideoProject,
  useRenderAiVideoProject,
  useRetryAiVideoProject,
  AiVideoScene,
  AiVideoProject,
  getAiVideoStoryboardContentKey,
  getStorageUrl,
  shouldHydrateAiVideoEditor,
} from "@/hooks/use-ai-video";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { Card } from "@/components/ui-elements";
import { toast } from "sonner";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  ArrowRight, ArrowLeft, Image as ImageIcon, Music, Type,
  Clock, Monitor, Sparkles, Loader2, Play,
  Download, AlertCircle, RefreshCw, Trash2, ChevronUp, ChevronDown
} from "lucide-react";

const MOTION_COST_PER_GENERATED_SECOND = 0.10;
const DEFAULT_MOTION_COSTS: Record<30 | 60 | 90, number> = {
  30: 3.80,
  60: 7.80,
  90: 11.80,
};

function estimateMotionCost(scenes: AiVideoScene[]): number {
  const generatedSeconds = scenes.reduce((total, scene, index) => {
    const hasOutgoingTransition = index < scenes.length - 1 && scene.transition !== "cut";
    const requestedSeconds = scene.durationSeconds + (hasOutgoingTransition ? 0.4 : 0);
    const billedSeconds = requestedSeconds <= 4 ? 4 : requestedSeconds <= 6 ? 6 : 8;
    return total + billedSeconds;
  }, 0);
  return generatedSeconds * MOTION_COST_PER_GENERATED_SECOND;
}

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
  const refreshCredits = useRefreshCreditsBalance();

  // Form State
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [prompt, setPrompt] = useState("");

  // Settings
  const [language, setLanguage] = useState<"ar"|"en">("ar");
  const [duration, setDuration] = useState<30|60|90>(60);
  const [aspectRatio, setAspectRatio] = useState<"16:9"|"9:16"|"1:1">("16:9");
  const [visualStyle, setStyle] = useState<"educational"|"cinematic"|"playful"|"minimal">("educational");
  const [voice, setVoice] = useState("nova");
  const [music, setMusic] = useState(true);
  const [captions, setCaptions] = useState(true);

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

  const handleLanguageChange = (lang: "ar"|"en") => {
    setLanguage(lang);
    setVoice(lang === "ar" ? "nova" : "alloy");
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
      ? `سيستخدم إنشاء القصة المصوّرة رصيد أدوات الذكاء الاصطناعي. تكلفة الحركة المتوقعة عند الإنتاج بهذه المدة هي $${DEFAULT_MOTION_COSTS[duration].toFixed(2)}، ولا تشمل تكلفة OpenAI. هل تريد المتابعة؟`
      : `Creating the storyboard uses AI-tool credits. The planned motion render for this duration is estimated at $${DEFAULT_MOTION_COSTS[duration].toFixed(2)}, excluding OpenAI costs. Continue?`)) {
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
      voice,
      music,
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
  const minimumSceneCount = requestedDuration ? Math.ceil(requestedDuration / 7) : 5;

  const validateStoryboard = () => {
    if (!editTitle.trim()) {
      toast.error(isAr ? "عنوان الفيديو مطلوب" : "Video title is required");
      return false;
    }
    if (editScenes.length < minimumSceneCount) {
      toast.error(isAr
        ? `عدد المشاهد غير كافٍ لمدة ${requestedDuration} ثانية. يلزم ${minimumSceneCount} مشهداً على الأقل حتى لا يتجاوز أي مشهد 7 ثوانٍ.`
        : `Not enough scenes for ${requestedDuration} seconds. At least ${minimumSceneCount} scenes are required so no scene exceeds 7 seconds.`);
      return false;
    }
    const maximumSceneCount = Math.min(18, Math.floor(requestedDuration / 2));
    if (editScenes.length > maximumSceneCount) {
      toast.error(isAr
        ? `الحد الأقصى لهذه المدة ${maximumSceneCount} مشهداً لأن مدة المشهد لا تقل عن ثانيتين`
        : `This duration allows at most ${maximumSceneCount} scenes because every scene is at least 2 seconds`);
      return false;
    }
    for (let i = 0; i < editScenes.length; i++) {
      const s = editScenes[i];
      if (!s.narration?.trim() || !s.visualPrompt?.trim()) {
        toast.error(isAr ? `المشهد ${i+1} غير مكتمل` : `Scene ${i+1} is incomplete`);
        return false;
      }
      if (s.durationSeconds < 2 || s.durationSeconds > 7) {
        toast.error(isAr ? `مدة المشهد ${i+1} يجب أن تكون بين ثانيتين و7 ثوانٍ` : `Scene ${i+1} duration must be 2-7 seconds`);
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

  const handleRender = () => {
    if (!project || !validateStoryboard()) return;
    const motionCost = estimateMotionCost(editScenes);
    if (!window.confirm(isAr
      ? `تكلفة توليد الحركة المقدّرة لهذا الفيديو هي $${motionCost.toFixed(2)} بسعر $0.10 لكل ثانية مولّدة، ولا تشمل تكلفة OpenAI. هل تريد بدء الإنتاج؟`
      : `Estimated motion generation cost is $${motionCost.toFixed(2)} at $0.10 per generated second, excluding OpenAI costs. Start rendering?`)) return;
    // Save first just in case
    updateMutation.mutate({
      id: project.id,
      data: {
        title: editTitle,
        storyboard: {
          title: editTitle,
          version: (project.storyboard?.version || 1) + 1,
          scenes: editScenes
        }
      }
    }, {
      onSuccess: (savedProject) => {
        hydrateEditor(savedProject);
        renderMutation.mutate({ id: project.id, idempotencyKey: crypto.randomUUID() }, {
          onError: handleError,
          onSettled: () => refreshCredits()
        });
      },
      onError: handleError
    });
  };

  const handleRetry = () => {
    if (!project) return;
    const motionCost = estimateMotionCost(project.storyboard?.scenes || []);
    if (!window.confirm(isAr
      ? `إعادة المحاولة تضيف تكلفة جديدة. تكلفة الحركة المقدّرة للمحاولة هي $${motionCost.toFixed(2)} ولا تشمل تكلفة OpenAI. هل تريد المتابعة؟`
      : `A retry adds a new charge. Estimated motion cost for this attempt is $${motionCost.toFixed(2)}, excluding OpenAI costs. Continue?`)) return;
    retryMutation.mutate({ id: project.id, idempotencyKey: crypto.randomUUID() }, {
      onError: handleError,
      onSettled: () => refreshCredits()
    });
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= editScenes.length) return;
    const newScenes = [...editScenes];
    const temp = newScenes[idx];
    newScenes[idx] = newScenes[idx + dir];
    newScenes[idx + dir] = temp;
    editsDirty.current = true;
    setEditScenes(newScenes);
  };

  const deleteScene = (idx: number) => {
    if (editScenes.length <= minimumSceneCount) {
      toast.error(isAr
        ? `لا يمكن تقليل العدد عن ${minimumSceneCount} مشهداً لهذه المدة`
        : `This duration requires at least ${minimumSceneCount} scenes`);
      return;
    }
    editsDirty.current = true;
    setEditScenes(prev => prev.filter((_, i) => i !== idx));
  };

  const updateScene = (idx: number, updates: Partial<AiVideoScene>) => {
    editsDirty.current = true;
    setEditScenes(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
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
  const hasRenderableStoryboard = Boolean(project?.storyboard && project.storyboard.scenes.length >= 5);
  const voices = [
    { id: "alloy", labelEn: "Alloy (Neutral)", labelAr: "ألوي (محايد)" },
    { id: "echo", labelEn: "Echo (Warm)", labelAr: "إيكو (دافئ)" },
    { id: "fable", labelEn: "Fable (Expressive)", labelAr: "فيبل (معبر)" },
    { id: "onyx", labelEn: "Onyx (Deep)", labelAr: "أونيكس (عميق)" },
    { id: "nova", labelEn: "Nova (Energetic)", labelAr: "نوفا (حيوي)" },
    { id: "shimmer", labelEn: "Shimmer (Clear)", labelAr: "شيمر (واضح)" },
  ];

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
                          ? "يختار الذكاء الاصطناعي مقدار الشرح المناسب، ويحافظ على الفكرة الأساسية ويضبط تلقائياً مدد المشاهد والتعليق الصوتي. لا حاجة لتحديد عدد كلمات."
                          : "AI chooses the right amount of explanation, keeps the essential idea, and automatically adjusts scene durations and voice narration. No word limit is needed."}
                      </p>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "الأبعاد" : "Aspect Ratio"}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: "16:9", icon: <div className="w-6 h-3 border-2 border-current rounded-sm" /> },
                          { val: "9:16", icon: <div className="w-3 h-6 border-2 border-current rounded-sm" /> },
                          { val: "1:1",  icon: <div className="w-5 h-5 border-2 border-current rounded-sm" /> }
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

                    {/* Voice */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">{isAr ? "التعليق الصوتي" : "Voice"}</label>
                      <select
                        value={voice}
                        onChange={e => setVoice(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                      >
                        {voices.map(v => (
                          <option key={v.id} value={v.id}>{isAr ? v.labelAr : v.labelEn}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Music className="w-4 h-4 text-slate-400" />
                          {isAr ? "موسيقى خلفية" : "Background Music"}
                        </span>
                        <input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                      </label>
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
                    ? `تُنشأ الحركة الفعلية بدقة 720p عبر fal-ai/veo3.1/fast (نموذج حركة بلا صوت) بسعر $0.10 لكل ثانية مولّدة بعد التقريب إلى 4 أو 6 أو 8 ثوانٍ لكل مشهد. التقدير الافتراضي لهذه المدة $${DEFAULT_MOTION_COSTS[duration].toFixed(2)} للحركة فقط، ولا يشمل OpenAI، وتضيف كل إعادة محاولة تكلفة جديدة. قد يستغرق التوليد عدة دقائق.`
                    : `True motion is generated at 720p with fal-ai/veo3.1/fast (no-audio motion model) at $0.10 per generated second, rounded to 4, 6, or 8 seconds per scene. The default estimate for this duration is $${DEFAULT_MOTION_COSTS[duration].toFixed(2)} for motion only, excluding OpenAI; each retry adds a new cost. Generation may take several minutes.`}
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
                  {isAr ? `تنبيه: إجمالي مدة المشاهد (${totalDuration}ث) يختلف عن المدة المطلوبة (${requestedDuration}ث). يرجى تعديل المشاهد.` : `Warning: Total duration of scenes (${totalDuration}s) differs from requested (${requestedDuration}s). Please adjust.`}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#15201B] p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{isAr ? "عنوان الفيديو" : "Video Title"}</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => {
                      editsDirty.current = true;
                      setEditTitle(e.target.value);
                    }}
                    className="w-full bg-transparent text-lg font-black text-slate-800 dark:text-slate-100 outline-none border-b-2 border-transparent focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSaveStoryboard}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {isAr ? "حفظ التعديلات" : "Save Changes"}
                  </button>
                  <button
                    onClick={handleRender}
                    disabled={renderMutation.isPending}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {renderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    {isAr ? "حفظ وإنتاج الفيديو" : "Save & Render"}
                  </button>
                </div>
              </div>

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
                      <button
                        onClick={() => deleteScene(idx)}
                        disabled={editScenes.length <= minimumSceneCount}
                        className="p-1.5 text-slate-400 hover:text-red-500 mt-auto disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scene Content */}
                    <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="inline-flex max-w-full items-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span className="truncate">{scene.onScreenText || (isAr ? "بدون تسمية مختصرة" : "No short label")}</span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? "التعليق الصوتي" : "Narration"}</label>
                          <textarea
                            value={scene.narration}
                            onChange={e => updateScene(idx, { narration: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500 min-h-[80px] resize-y leading-relaxed"
                          />
                          <p className="mt-1 text-[10px] font-medium text-slate-400">
                            {isAr
                              ? "يُقاس توقيت التعليق ويُضبط تلقائياً مع زمن المشهد مع الحفاظ على الفكرة الأساسية. إذا تعذّر ضبط التوقيت، سيظهر فشل الإنتاج ويمكنك إعادة المحاولة."
                              : "Narration timing is measured and adjusted automatically to the scene while preserving the essential idea. If timing cannot be completed, rendering will show as failed and you can retry."}
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
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? "المدة (ثواني)" : "Duration (s)"}</label>
                            <input
                              type="number"
                              value={scene.durationSeconds || ""}
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                updateScene(idx, { durationSeconds: isNaN(val) ? 0 : val });
                              }}
                              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">{isAr ? "الانتقال" : "Transition"}</label>
                            <select
                              value={scene.transition}
                              onChange={e => updateScene(idx, { transition: e.target.value as any })}
                              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-emerald-500"
                            >
                              <option value="cut">{isAr ? "قطع (Cut)" : "Cut"}</option>
                              <option value="dissolve">{isAr ? "تلاشي (Dissolve)" : "Dissolve"}</option>
                              <option value="push">{isAr ? "دفع (Push)" : "Push"}</option>
                              <option value="zoom">{isAr ? "تكبير (Zoom)" : "Zoom"}</option>
                            </select>
                          </div>
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
                      ? "قد تستغرق هذه العملية بضع دقائق. يُنشأ التعليق الصوتي ويُقاس توقيته تلقائياً أولاً، ثم تُضبط مدد المشاهد قبل إنشاء الحركة ودمج الفيديو. يمكنك مغادرة الصفحة والعودة لاحقاً."
                      : "This may take a few minutes. Voice narration is generated and timed automatically first; scene durations are adjusted before motion is created and the video is assembled. You can leave and check back later."}
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
                    disabled={retryMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black rounded-xl transition-all"
                  >
                    {retryMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    {isAr ? "إعادة محاولة الإنتاج" : "Retry Render"}
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

        </div>
      </div>
    </Layout>
  );
}