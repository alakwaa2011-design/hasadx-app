import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useAiVideoProjects, getStorageUrl } from "@/hooks/use-ai-video";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import {
  Video, Plus, Search, Clapperboard, Clock, LayoutTemplate,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, Play, LayoutGrid
} from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Card } from "@/components/ui-elements";

export default function AiVideoIndexPage() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: currentUser, isLoading: authLoading, error: authError } = useGetCurrentTeacher({ query: { retry: false } as any });
  const isAdmin = currentUser?.isAdmin === true;
  useEffect(() => {
    if (authLoading) return;
    if (authError || !currentUser) {
      setLocation("/login?redirect=" + encodeURIComponent("/teacher/ai-video"));
    } else if (!isAdmin) {
      setLocation("/teacher");
    }
  }, [authLoading, authError, currentUser, isAdmin, setLocation]);

  const { data: projects = [], isLoading } = useAiVideoProjects(!authLoading && !authError && isAdmin);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const lower = search.toLowerCase();
    return projects.filter(p => p.title.toLowerCase().includes(lower) || p.brief.topic.toLowerCase().includes(lower));
  }, [projects, search]);

  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filteredProjects]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "draft":
        return { label: isAr ? "مسودة" : "Draft", color: "text-slate-500 bg-slate-100 dark:bg-slate-800", icon: LayoutTemplate };
      case "storyboard_ready":
        return { label: isAr ? "القصة المصورة جاهزة" : "Storyboard Ready", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30", icon: Clapperboard };
      case "rendering":
        return { label: isAr ? "جاري الإنتاج" : "Rendering", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", icon: Loader2, spin: true };
      case "ready":
        return { label: isAr ? "جاهز" : "Ready", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30", icon: CheckCircle2 };
      case "failed":
        return { label: isAr ? "فشل الإنتاج" : "Failed", color: "text-red-600 bg-red-50 dark:bg-red-900/30", icon: AlertCircle };
      default:
        return { label: status, color: "text-slate-500 bg-slate-100", icon: LayoutTemplate };
    }
  };

  if (authLoading) return <Layout><div className="min-h-[100dvh]" /></Layout>;
  if (authError || !currentUser || !isAdmin) return null;

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-24" dir={isAr ? "rtl" : "ltr"}>
        {/* Header Hero */}
        <div className="bg-emerald-800 text-white relative overflow-hidden">
          <div className="absolute inset-0 hero-noise opacity-20 mix-blend-overlay pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />

          <div className="container mx-auto px-4 py-12 lg:py-16 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-5xl mx-auto">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-700/50 border border-emerald-600/50 flex items-center justify-center backdrop-blur-md">
                    <Video className="w-6 h-6 text-emerald-100" />
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
                    {isAr ? "استوديو الفيديو" : "Video Studio"}
                  </h1>
                </div>
                <p className="text-emerald-100/90 max-w-xl text-sm lg:text-base font-medium leading-relaxed">
                  {isAr
                    ? "حوّل محتواك التعليمي إلى فيديو مولّد بالذكاء الاصطناعي بحركة فعلية ودقة 720p. قد يستغرق الإنشاء عدة دقائق."
                    : "Turn educational content into an AI-generated true-motion video at 720p. Generation may take several minutes."}
                </p>
              </div>
              <button
                onClick={() => setLocation("/teacher/ai-video/new")}
                className="group shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-sm rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-5 h-5" />
                {isAr ? "إنشاء فيديو جديد" : "Create New Video"}
                <ArrowRight className="w-4 h-4 opacity-50 group-hover:-translate-x-1 transition-transform rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 -mt-6 relative z-20 max-w-5xl">
          {/* Controls */}
          <Card className="p-2 mb-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2 shadow-sm rounded-2xl">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute top-1/2 -translate-y-1/2 text-slate-400 start-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "ابحث في الفيديوهات..." : "Search videos..."}
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 py-3.5 ps-11 outline-none"
              />
            </div>
          </Card>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-white dark:bg-slate-900 rounded-3xl skeleton-shimmer border border-emerald-50 dark:border-emerald-900/20" />
              ))}
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                <Video className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
                {isAr ? "لا توجد فيديوهات" : "No videos found"}
              </h3>
              <p className="text-slate-500 font-medium">
                {search ? (isAr ? "لم يطابق أي فيديو بحثك" : "No videos matched your search") : (isAr ? "ابدأ بإنشاء أول فيديو لك" : "Start by creating your first video")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProjects.map(project => {
                const status = getStatusDisplay(project.status);
                const StatusIcon = status.icon;
                return (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link href={`/teacher/ai-video/new?id=${project.id}`}>
                      <a className="group block bg-white dark:bg-slate-900 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">

                        <div className={`relative aspect-video flex items-center justify-center p-6 ${project.status === 'ready' && project.outputUrl ? 'bg-black' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                          {project.status === 'ready' && project.outputUrl ? (
                            <>
                              <video src={getStorageUrl(project.outputUrl)} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Play className="w-6 h-6 text-white fill-white" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <LayoutGrid className="w-12 h-12 text-slate-300 dark:text-slate-700 group-hover:scale-110 transition-transform duration-500" />
                          )}
                          <div className={`absolute top-3 start-3 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 backdrop-blur-md ${status.color}`}>
                            <StatusIcon className={`w-3.5 h-3.5 ${status.spin ? 'animate-spin' : ''}`} />
                            {status.label}
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1 line-clamp-2 leading-snug">
                            {project.title}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium line-clamp-1 mb-4">
                            {project.brief.topic}
                          </p>

                          <div className="mt-auto flex items-center justify-between text-xs font-bold text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {project.brief.durationSeconds}s
                              </span>
                              <span className="flex items-center gap-1">
                                <LayoutTemplate className="w-3.5 h-3.5" />
                                {project.brief.aspectRatio}
                              </span>
                            </div>
                            <span>
                              {format(new Date(project.updatedAt), "dd MMM", { locale: isAr ? ar : enUS })}
                            </span>
                          </div>
                        </div>
                      </a>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}