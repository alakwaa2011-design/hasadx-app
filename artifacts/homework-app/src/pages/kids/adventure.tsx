import React from "react";
import { Link } from "wouter";
import { useKidsTodayAdventure, useStartKidsTodayAdventure } from "@/hooks/use-kids";
import { Star, Lock, CheckCircle2, Play, Cloud } from "lucide-react";
import { KidsAssetKey, KidsIllustration, resolveKidsAsset } from "@/lib/kids-assets";

const playfulStyles = `
  .trail-line {
    position: absolute;
    width: 24px;
    background: #fde68a; /* amber-200 */
    left: 50%;
    transform: translateX(-50%);
    top: 60px;
    bottom: 60px;
    border-radius: 99px;
    z-index: 0;
    border: 6px solid #fef08a; /* amber-300 */
  }
  .node-shadow {
    box-shadow: 0 8px 0 var(--shadow-color);
  }
  .node-active {
    animation: bounce-pulse 2.5s infinite cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes bounce-pulse {
    0%, 100% { transform: scale(1) translateY(0); }
    50% { transform: scale(1.1) translateY(-6px); }
  }
  .kids-btn {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .kids-btn:active {
    transform: scale(0.92);
  }
  .kids-card {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .kids-card:hover {
    transform: translateY(-8px) scale(1.02);
  }
  @keyframes float-cloud {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    50% { transform: translateY(-10px) translateX(5px); }
  }
  .animate-float-cloud {
    animation: float-cloud 6s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .node-active, .animate-float-cloud {
      animation: none !important;
      transform: none !important;
    }
    .kids-card:hover, .kids-btn:active {
      transform: none !important;
    }
  }
`;

const ActivityCard = ({ activity, isCompleted, isAvailable }: any) => (
  <div className={`p-4 sm:p-5 rounded-[2.5rem] w-full max-w-[260px] border-4 flex flex-col items-center text-center kids-card relative z-10 ${
    isCompleted
      ? "bg-emerald-50 border-emerald-300 shadow-[0_8px_0_#6ee7b7]"
      : isAvailable
        ? "bg-white border-amber-300 shadow-[0_8px_0_#fcd34d]"
        : "bg-slate-50 border-slate-200 shadow-[0_8px_0_#e2e8f0] opacity-90 grayscale-[30%]"
  }`}>
    <div className="mb-4 relative group">
      <div className={`absolute inset-0 bg-white rounded-3xl transform rotate-3 transition-transform group-hover:rotate-6 ${isCompleted ? 'opacity-100' : 'opacity-50'}`}></div>
      <img src={resolveKidsAsset(activity.asset_key) ?? undefined} alt="" className={`h-20 w-20 sm:h-24 sm:w-24 rounded-3xl relative z-10 border-4 border-white shadow-md object-cover ${isCompleted ? 'bg-emerald-100' : isAvailable ? 'bg-sky-50' : 'bg-slate-200'}`} />
    </div>
    <h3 className={`font-black text-xl sm:text-2xl mb-3 leading-tight drop-shadow-sm ${isCompleted ? "text-emerald-700" : isAvailable ? "text-amber-700" : "text-slate-500"}`}>
      {activity.title_ar}
    </h3>
    <div className="flex items-center justify-center gap-1.5 bg-white/80 px-4 py-2 rounded-full shadow-sm border-2 border-white">
      {[...Array(3)].map((_, i) => (
        <Star key={i} className={`w-5 h-5 sm:w-6 sm:h-6 ${isCompleted ? "fill-amber-400 text-amber-400 drop-shadow-sm" : "fill-slate-200 text-slate-200"}`} />
      ))}
    </div>
  </div>
);

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
      <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
        <Star className="h-16 w-16 text-amber-400 animate-spin" />
        <h2 className="text-2xl font-bold text-amber-600 animate-pulse font-display">نجهز المغامرة...</h2>
      </div>
    );
  }

  const { adventure, activities } = todayAdventure;

  const combinedText = activities.map(a => `${a.title_ar} ${a.slug} ${a.activity_type}`).join(" ").toLowerCase();
  let bgAsset: KidsAssetKey = "kids/illustrations/world-arabic";
  let bgColorClass = 'bg-sky-200';
  let bgAlt = 'مدينة الحروف العربية';

  if (combinedText.includes('english') || combinedText.includes('انجليزي') || /[a-z]/.test(combinedText)) {
    bgAsset = "kids/illustrations/world-english";
    bgColorClass = 'bg-indigo-200';
    bgAlt = 'جزيرة الإنجليزية';
  } else if (combinedText.includes('number') || combinedText.includes('رقم') || combinedText.includes('ارقام') || combinedText.includes('عد') || /[0-9]/.test(combinedText)) {
    bgAsset = "kids/illustrations/world-numbers";
    bgColorClass = 'bg-amber-200';
    bgAlt = 'وادي الأرقام';
  }

  return (
    <>
      <style>{playfulStyles}</style>
      <div className={`min-h-[85vh] rounded-[3rem] p-4 md:p-8 pb-24 animate-in fade-in zoom-in-95 duration-700 font-display shadow-inner border-4 border-white/60 relative overflow-hidden ${bgColorClass}`}>

        {/* Dynamic Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <KidsIllustration assetKey={bgAsset} alt={bgAlt} eager className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px]"></div>
        </div>

        {/* Clouds */}
        <Cloud className="absolute top-10 right-10 text-white/80 w-24 h-24 animate-float-cloud z-0" style={{ animationDelay: '0s' }} />
        <Cloud className="absolute top-32 left-8 text-white/70 w-32 h-32 animate-float-cloud z-0" style={{ animationDelay: '1.5s' }} />
        <Cloud className="absolute bottom-20 right-20 text-white/60 w-40 h-40 animate-float-cloud z-0" style={{ animationDelay: '3s' }} />

        <div className="flex justify-center items-center mb-16 relative z-20">
          <KidsIllustration assetKey="kids/illustrations/mascot-point" alt="مرشد حصاد يشير إلى طريق المغامرة" eager className="h-32 w-32 object-contain drop-shadow-lg -ml-5" fallback={<Star className="h-20 w-20 fill-amber-300 text-amber-400" />} />
          <div className="text-center space-y-4 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 px-12 border-4 border-white shadow-xl">
            <h1 className="text-4xl md:text-5xl font-black text-emerald-700 drop-shadow-sm" data-testid="text-adventure-title">خريطة المغامرة</h1>
            <p className="text-xl text-emerald-600 font-bold">انطلق في محطتك القادمة!</p>
          </div>
        </div>

        <div className="relative max-w-3xl mx-auto py-8">
          {/* Winding path background line */}
          <div className="trail-line"></div>

          <div className="space-y-16 sm:space-y-24 relative z-10">
            {adventure.activity_ids.map((activityId, index) => {
              const activity = activities.find(a => a.id === activityId);
              if (!activity) return null;

              const isCompleted = adventure.completed_ids?.includes(activityId) || false;
              const prevId = index > 0 ? adventure.activity_ids[index - 1] : null;
              const isUnlocked = index === 0 || (prevId && adventure.completed_ids?.includes(prevId));

              const isLeft = index % 2 === 0;
              const isLocked = !isUnlocked;
              const isAvailable = isUnlocked && !isCompleted;

              return (
                <div key={activityId} className="flex items-center justify-center w-full relative">

                  {/* Right Side visually (first in DOM for RTL) */}
                  <div className="flex-1 flex justify-end px-2 md:px-8 relative z-10 min-w-0">
                    {!isLeft && (
                      <ActivityCard activity={activity} isCompleted={isCompleted} isAvailable={isAvailable} />
                    )}
                  </div>

                  {/* Node */}
                  <div className="relative shrink-0 z-20 flex flex-col items-center justify-center mx-2 sm:mx-6">
                    <div className="absolute inset-0 bg-white/50 rounded-full scale-150 blur-md"></div>
                    {isLocked ? (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-300 flex items-center justify-center relative z-10 border-4 border-slate-400 node-shadow" style={{ '--shadow-color': '#94a3b8' } as any} data-testid={`node-locked-${activityId}`}>
                        <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500" />
                      </div>
                    ) : isAvailable ? (
                      <Link href={`/kids/activity/${activityId}`} data-testid={`link-play-${activityId}`}>
                        <button className="kids-btn w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-400 hover:bg-amber-500 flex items-center justify-center relative z-10 border-4 border-white node-shadow node-active" style={{ '--shadow-color': '#d97706' } as any} data-testid={`button-play-${activityId}`}>
                          <KidsIllustration assetKey="kids/illustrations/play-station" alt="محطة اللعب التالية" className="h-20 w-20 object-contain" fallback={<Play className="w-10 h-10 sm:w-12 sm:h-12 fill-white text-white translate-x-1" />} />
                        </button>
                      </Link>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-400 flex items-center justify-center relative z-10 border-4 border-white node-shadow" style={{ '--shadow-color': '#059669' } as any} data-testid={`node-completed-${activityId}`}>
                        <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Left Side visually (second in DOM for RTL) */}
                  <div className="flex-1 flex justify-start px-2 md:px-8 relative z-10 min-w-0">
                    {isLeft && (
                      <ActivityCard activity={activity} isCompleted={isCompleted} isAvailable={isAvailable} />
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}