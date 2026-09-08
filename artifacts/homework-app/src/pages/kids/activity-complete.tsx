import React from "react";
import { Link, useParams } from "wouter";
import { Star, Trophy, Home, Rocket, Sparkles, CheckCircle2, Award } from "lucide-react";
import { useKidsAdventureState, useKidsProfile } from "@/hooks/use-kids";
import { KidsIllustration } from "@/lib/kids-assets";
import { normalizeKidsAvatarAgeBand } from "@workspace/api-zod";

const celebrateStyles = `
  @keyframes spin-slow {
    100% { transform: rotate(360deg); }
  }
  @keyframes pop-in {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.15); opacity: 1; }
    80% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes float-star {
    0%, 100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-20px) rotate(15deg); }
  }
  @keyframes bounce-jelly {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05) translateY(-5px); }
  }
  .animate-spin-slow { animation: spin-slow 15s linear infinite; }
  .animate-pop-in { animation: pop-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .animate-float-star { animation: float-star 3s ease-in-out infinite; }
  .animate-bounce-jelly { animation: bounce-jelly 2.5s infinite cubic-bezier(0.34, 1.56, 0.64, 1); }

  .sunburst {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 250vw;
    height: 250vw;
    transform: translate(-50%, -50%);
    background: repeating-conic-gradient(
      from 0deg,
      hsl(var(--primary)) 0deg 15deg,
      hsl(var(--primary) / 0.8) 15deg 30deg
    );
    z-index: 0;
    opacity: 0.2;
  }

  .kids-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kids-btn:active { transform: scale(0.92); }

  @media (prefers-reduced-motion: reduce) {
    .animate-spin-slow, .animate-pop-in, .animate-float-star, .animate-bounce-jelly, .sunburst {
      animation: none !important;
      transform: none !important;
    }
    .kids-btn:active {
      transform: none !important;
    }
  }
`;

export default function KidsActivityComplete() {
  const { id } = useParams<{ id: string }>();
  const { data: adventureState } = useKidsAdventureState();
  const { data: profile } = useKidsProfile();

  // Use a fallback ageBand if none, defaulting to young kids
  const ageBand = normalizeKidsAvatarAgeBand(profile?.age_band) || "young";
  const isOlder = ageBand !== "young";

  return (
    <>
      <style>{celebrateStyles}</style>
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-hidden font-display" dir="rtl">

        {/* Animated Sunburst Background - less intense for older */}
        {!isOlder && <div className="sunburst animate-spin-slow"></div>}
        {isOlder && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 to-emerald-50 dark:from-emerald-900/20 dark:to-background z-0"></div>}

        {/* Floating background stars - only for young */}
        {!isOlder && (
          <>
            <Sparkles className="absolute top-[10%] left-[15%] w-16 h-16 text-amber-300 animate-float-star opacity-90" style={{ animationDelay: '0s' }} />
            <Sparkles className="absolute bottom-[20%] right-[15%] w-24 h-24 text-amber-300 animate-float-star opacity-90" style={{ animationDelay: '1s' }} />
            <Sparkles className="absolute top-[30%] right-[25%] w-12 h-12 text-emerald-400 animate-float-star opacity-70" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        {/* Main Content */}
        <div className="relative z-10 max-w-lg w-full flex flex-col items-center">

          {/* Celebration character and reward */}
          <div className={`relative ${isOlder ? '-mb-8' : '-mb-10'} group z-20`}>
            {!isOlder && <div className="absolute inset-0 bg-amber-200 rounded-full blur-[40px] opacity-70 animate-pulse"></div>}

            {isOlder ? (
              <div className="w-32 h-32 bg-emerald-100 dark:bg-emerald-900/50 rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-pop-in">
                 <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : (
              <div className="w-56 h-44 sm:w-64 sm:h-52 flex items-end justify-center transform transition-transform group-hover:scale-105">
                <KidsIllustration assetKey="kids/illustrations/mascot-cheer" alt="مرشد حصاد يحتفل بإنجازك" eager className="relative z-10 h-full w-40 object-contain drop-shadow-xl" fallback={<Trophy className="h-24 w-24 text-amber-300" />} />
                <KidsIllustration assetKey="kids/illustrations/reward-chest" alt="صندوق المكافأة" eager className="relative z-20 -mr-8 h-24 w-24 object-contain drop-shadow-xl" fallback={<Star className="h-16 w-16 fill-amber-300 text-amber-400" />} />
              </div>
            )}
          </div>

          <div className="animate-pop-in text-center flex flex-col items-center w-full">
            {/* Panel */}
            <div className="bg-card/95 backdrop-blur-xl p-8 sm:p-10 pt-16 rounded-[3.5rem] shadow-2xl border-[6px] border-card w-full space-y-8 relative">

              <div className="flex flex-col items-center gap-4">
                <h2 className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm text-center" data-testid="text-success-title">
                  {isOlder ? "أداء ممتاز!" : "عمل رائع يا بطل!"}
                </h2>
              </div>

              <div className={`flex flex-col items-center justify-center gap-4 py-6 sm:py-8 rounded-[2.5rem] ${isOlder ? 'bg-muted/50 border-2 border-border' : 'bg-gradient-to-b from-amber-50 to-amber-100 border-4 border-amber-200'} shadow-inner`}>
                <span className={`text-xl sm:text-2xl font-bold ${isOlder ? 'text-foreground' : 'text-amber-800'}`}>
                  {isOlder ? "رصيد النقاط المكتسبة" : "إجمالي نجومك المدهشة"}
                </span>
                <div className="flex items-center gap-4" data-testid="display-stars-total">
                  {isOlder ? (
                     <Award className="w-10 h-10 text-amber-500" />
                  ) : (
                     <Star className="w-12 h-12 sm:w-16 sm:h-16 fill-amber-500 text-amber-500 drop-shadow-md animate-float-star" />
                  )}
                  <span className={`text-5xl sm:text-6xl font-black ${isOlder ? 'text-foreground' : 'text-amber-500 drop-shadow-md'}`}>
                    {adventureState?.stars || 0}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-5">
                <Link href="/kids/adventure" data-testid="link-next-stop">
                  <button className="kids-btn w-full relative group" data-testid="button-next-stop">
                    <div className="absolute inset-0 bg-emerald-700 rounded-[2.5rem] translate-y-2.5 group-active:translate-y-0 transition-transform"></div>
                    <div className={`relative bg-emerald-500 text-white text-2xl sm:text-3xl font-black py-5 sm:py-6 px-8 rounded-[2.5rem] ${isOlder ? '' : 'border-[5px] border-emerald-300'} flex items-center justify-center gap-4 shadow-xl`}>
                      <Rocket className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-sm" />
                      <span className="drop-shadow-sm">{isOlder ? "الاستمرار" : "المحطة التالية"}</span>
                    </div>
                  </button>
                </Link>
                <Link href="/kids" data-testid="link-home">
                  <button className="kids-btn w-full relative group" data-testid="button-home">
                    <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-[2.5rem] translate-y-2 group-active:translate-y-0 transition-transform"></div>
                    <div className={`relative bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xl sm:text-2xl font-bold py-4 sm:py-5 px-8 rounded-[2.5rem] ${isOlder ? '' : 'border-4 border-white'} flex items-center justify-center gap-3`}>
                      <Home className="w-6 h-6 sm:w-8 sm:h-8" />
                      <span>العودة للرئيسية</span>
                    </div>
                  </button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}