import React, { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2, Sparkles } from "lucide-react";
import { useTeacherKidsActivities } from "@/hooks/use-kids";
import { KidsIllustration } from "@/lib/kids-assets";

export default function TeacherKidsBoard() {
  const [, setLocation] = useLocation();
  const { data: activities, isLoading: activitiesLoading } = useTeacherKidsActivities();
  const [selectedActivityId, setSelectedActivityId] = useState("");

  const handlePlay = () => {
    if (!selectedActivityId) return;
    setLocation(`/teacher/kids/board/activity/${selectedActivityId}`);
  };

  const getActivityLabel = (type?: string) => {
    if (!type) return "نشاط ممتع";
    const map: Record<string, string> = {
      matching: "توصيل",
      media_choice: "اختيار متعدد",
      tracing: "تتبّع",
      ordering_puzzle: "ترتيب",
      counting: "عدّ",
      sorting: "ترتيب",
      coloring: "تلوين",
      drawing: "رسم",
      puzzle: "لغز",
      memory: "ذاكرة",
      flashcards: "بطاقات",
    };
    return map[type.toLowerCase()] || "نشاط ممتع";
  };

  const selectedActivity = activities?.find((a) => a.id === selectedActivityId);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col relative font-display">

        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-l from-indigo-900 via-violet-800 to-purple-900 p-8 md:p-12 shadow-lg mb-8 border-4 border-indigo-100/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-right">
            <div className="flex-1 space-y-4">
               <div className="flex items-center justify-center md:justify-start gap-4">
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => setLocation("/teacher/kids")}
                   className="text-white hover:bg-white/20 rounded-full shrink-0"
                 >
                   <ArrowRight className="w-6 h-6" />
                 </Button>
                 <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-sm tracking-tight leading-tight text-balance">
                   ماذا سيلعب الأبطال اليوم؟
                 </h1>
               </div>
               <p className="text-indigo-100/90 text-lg md:text-xl max-w-2xl leading-relaxed md:pr-14 font-medium">
                 أهلاً بك في عالم المرح! اختر النشاط الذي تود مشاركته الآن، وسيبدأ فوراً على شاشات الصغار في الفصل.
               </p>
            </div>

            <div className="w-40 h-40 md:w-56 md:h-56 shrink-0 relative">
              <KidsIllustration
                assetKey="kids/illustrations/mascot-wave"
                alt="المرشد"
                className="w-full h-full object-contain drop-shadow-2xl motion-safe:animate-float-slow"
                fallback={<Sparkles className="w-24 h-24 text-amber-300 mx-auto" />}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pb-32">
          <div className="flex items-center gap-3 mb-6 px-2">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">1</div>
             <h2 className="text-2xl font-black text-slate-800">اختر النشاط</h2>
          </div>

          {activitiesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 h-36 animate-pulse"></div>
              ))}
            </div>
          ) : activities?.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-500">لا توجد أنشطة متاحة حالياً</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {activities?.map((activity) => {
                const isSelected = selectedActivityId === activity.id;
                return (
                  <button
                    key={activity.id}
                    onClick={() => setSelectedActivityId(activity.id)}
                    className={`group relative flex flex-col items-start p-5 text-right transition-all duration-300 rounded-[2rem] border-[3px] w-full h-full outline-none
                      ${isSelected
                        ? 'border-amber-400 bg-amber-50/80 shadow-md motion-safe:-translate-y-1'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm motion-safe:hover:-translate-y-0.5'
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-4 left-4">
                        <CheckCircle2 className="w-7 h-7 text-amber-500 fill-amber-100 drop-shadow-sm" />
                      </div>
                    )}

                    <div className={`mb-3 inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full transition-colors
                      ${isSelected ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-800'}`}>
                      {getActivityLabel(activity.activity_type)}
                    </div>

                    <h3 className={`text-lg font-black leading-snug line-clamp-3 ${isSelected ? 'text-amber-950' : 'text-slate-700 group-hover:text-indigo-950'}`}>
                      {activity.title_ar}
                    </h3>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Action Bar */}
        <div
          className={`fixed bottom-6 inset-x-0 px-4 flex justify-center z-50 pointer-events-none transition-all duration-500 ease-out
            ${selectedActivityId
              ? 'translate-y-0 opacity-100'
              : 'translate-y-8 opacity-0 motion-reduce:translate-y-0'}
          `}
        >
          <div className="bg-white/95 backdrop-blur-xl border-2 border-slate-200/80 shadow-2xl p-3 md:p-4 rounded-[2.5rem] pointer-events-auto flex items-center gap-4 max-w-xl w-full">
            <div className="flex-1 px-4 hidden sm:block overflow-hidden">
              <p className="text-xs font-bold text-slate-500 mb-0.5">جاهز للتشغيل؟</p>
              <p className="text-sm font-black text-slate-900 truncate">
                {selectedActivity?.title_ar}
              </p>
            </div>
            <Button
              onClick={handlePlay}
              size="lg"
              className="flex-1 sm:flex-none rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg h-14 px-8 shadow-lg shadow-indigo-600/25 gap-2 transition-transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ابدأ اللعب الآن</span>
            </Button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
