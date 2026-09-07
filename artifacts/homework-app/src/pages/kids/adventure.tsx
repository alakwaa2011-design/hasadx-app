import React from "react";
import { Link } from "wouter";
import { useKidsTodayAdventure, useStartKidsTodayAdventure } from "@/hooks/use-kids";
import { Star, Lock, CheckCircle2, Play } from "lucide-react";
import { resolveKidsAsset } from "@/lib/kids-assets";

export default function KidsAdventure() {
  const { data: todayAdventure, isLoading } = useKidsTodayAdventure();
  const startAdventure = useStartKidsTodayAdventure();

  React.useEffect(() => {
    if (todayAdventure && (todayAdventure.adventure as any).started_at === undefined) {
      startAdventure.mutate();
    }
  }, [todayAdventure, startAdventure]);

  if (isLoading || !todayAdventure) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Star className="h-12 w-12 text-amber-400 animate-spin" />
      </div>
    );
  }

  const { adventure, activities } = todayAdventure;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white">رحلة التعلم</h1>
        <p className="text-lg text-slate-500 font-medium">اختر محطتك القادمة في رحلة المعرفة</p>
      </div>

      <div className="relative max-w-lg mx-auto py-8">
        {/* Winding path background line */}
        <div className="absolute top-12 bottom-12 left-1/2 w-4 bg-amber-100 dark:bg-slate-800 -translate-x-1/2 rounded-full z-0"></div>

        <div className="space-y-12 relative z-10">
          {adventure.activity_ids.map((activityId, index) => {
            const activity = activities.find(a => a.id === activityId);
            if (!activity) return null;
            
            const isCompleted = adventure.completed_ids?.includes(activityId) || false;
            // It's unlocked if it's the first one, or the previous one is completed
            const prevId = index > 0 ? adventure.activity_ids[index - 1] : null;
            const isUnlocked = index === 0 || (prevId && adventure.completed_ids?.includes(prevId));
            
            const isLeft = index % 2 === 0;
            const isLocked = !isUnlocked;
            const isAvailable = isUnlocked && !isCompleted;

            return (
              <div key={activityId} className={`flex items-center justify-center gap-4 ${isLeft ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Spacer to push item to side */}
                <div className="w-1/2 flex justify-end px-4">
                  {!isLeft && (
                    <div className={`p-4 rounded-3xl w-full max-w-xs shadow-sm border-b-4 ${isCompleted ? "bg-white border-emerald-100 dark:bg-slate-800 dark:border-slate-700" : isAvailable ? "bg-white border-amber-200 dark:bg-slate-800 dark:border-amber-900/50" : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 opacity-70"}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <img src={resolveKidsAsset(activity.asset_key) ?? undefined} alt="" className="h-12 w-12 rounded-xl" />
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{activity.title_ar}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(3)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${isCompleted ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Node */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-white dark:bg-slate-900 rounded-full scale-110"></div>
                  {isLocked ? (
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center relative z-10 border-4 border-white dark:border-slate-900 shadow-sm">
                      <Lock className="w-6 h-6 text-slate-400" />
                    </div>
                  ) : isAvailable ? (
                    <Link href={`/kids/activity/${activityId}`}>
                      <button className="w-16 h-16 rounded-full bg-amber-400 hover:bg-amber-500 flex items-center justify-center relative z-10 border-4 border-white dark:border-slate-900 shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 transition-all">
                        <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
                      </button>
                    </Link>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-emerald-400 flex items-center justify-center relative z-10 border-4 border-white dark:border-slate-900 shadow-sm">
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>

                {/* Spacer */}
                <div className="w-1/2 flex justify-start px-4">
                  {isLeft && (
                    <div className={`p-4 rounded-3xl w-full max-w-xs shadow-sm border-b-4 ${isCompleted ? "bg-white border-emerald-100 dark:bg-slate-800 dark:border-slate-700" : isAvailable ? "bg-white border-amber-200 dark:bg-slate-800 dark:border-amber-900/50" : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 opacity-70"}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <img src={resolveKidsAsset(activity.asset_key) ?? undefined} alt="" className="h-12 w-12 rounded-xl" />
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{activity.title_ar}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(3)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${isCompleted ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
