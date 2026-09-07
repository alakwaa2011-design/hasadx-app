import React from "react";
import { Link, useParams } from "wouter";
import { Star, Trophy, Home, Rocket, Sparkles } from "lucide-react";
import { useKidsAdventureState } from "@/hooks/use-kids";

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
      #10b981 0deg 15deg,
      #059669 15deg 30deg
    );
    z-index: 0;
    opacity: 0.9;
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

  return (
    <>
      <style>{celebrateStyles}</style>
      <div className="fixed inset-0 bg-emerald-600 z-50 flex items-center justify-center p-4 overflow-hidden font-display" dir="rtl">

        {/* Animated Sunburst Background */}
        <div className="sunburst animate-spin-slow"></div>

        {/* Floating background stars */}
        <Sparkles className="absolute top-[10%] left-[15%] w-16 h-16 text-amber-300 animate-float-star opacity-90" style={{ animationDelay: '0s' }} />
        <Sparkles className="absolute bottom-[20%] right-[15%] w-24 h-24 text-amber-300 animate-float-star opacity-90" style={{ animationDelay: '1s' }} />
        <Sparkles className="absolute top-[30%] right-[25%] w-12 h-12 text-white animate-float-star opacity-70" style={{ animationDelay: '0.5s' }} />

        {/* Main Content */}
        <div className="relative z-10 max-w-lg w-full flex flex-col items-center">

          {/* Giant Trophy */}
          <div className="relative -mb-10 group z-20">
            <div className="absolute inset-0 bg-amber-200 rounded-full blur-[40px] opacity-70 animate-pulse"></div>
            <div className="w-40 h-40 sm:w-48 sm:h-48 bg-gradient-to-br from-amber-300 to-amber-500 rounded-full border-[8px] border-white flex items-center justify-center shadow-[0_16px_0_rgba(180,83,9,0.5)] transform transition-transform group-hover:scale-105">
              <Trophy className="w-20 h-20 sm:w-24 sm:h-24 text-white drop-shadow-xl" />
            </div>
          </div>

          <div className="animate-pop-in text-center flex flex-col items-center w-full">
            {/* Panel */}
            <div className="bg-white/95 backdrop-blur-xl p-8 sm:p-10 pt-16 rounded-[3.5rem] shadow-2xl border-[6px] border-white w-full space-y-8 relative">

              <div className="flex flex-col items-center gap-4">
                <img
                  src="/kids/world/hasaad-guide.webp"
                  alt="المرشد حصاد يهنئك"
                  loading="eager"
                  className="w-32 h-32 object-contain drop-shadow-md animate-bounce-jelly"
                  style={{ backgroundColor: 'transparent' }}
                />
                <h2 className="text-4xl sm:text-5xl font-black text-emerald-600 drop-shadow-sm text-center" data-testid="text-success-title">عمل رائع يا بطل!</h2>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-amber-50 to-amber-100 py-6 sm:py-8 rounded-[2.5rem] border-4 border-amber-200 shadow-inner">
                <span className="text-xl sm:text-2xl font-bold text-amber-800">إجمالي نجومك المدهشة</span>
                <div className="flex items-center gap-4" data-testid="display-stars-total">
                  <Star className="w-12 h-12 sm:w-16 sm:h-16 fill-amber-500 text-amber-500 drop-shadow-md animate-float-star" />
                  <span className="text-5xl sm:text-6xl font-black text-amber-500 drop-shadow-md">{adventureState?.stars || 0}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-5">
                <Link href="/kids/adventure" data-testid="link-next-stop">
                  <button className="kids-btn w-full relative group" data-testid="button-next-stop">
                    <div className="absolute inset-0 bg-emerald-700 rounded-[2.5rem] translate-y-2.5 group-active:translate-y-0 transition-transform"></div>
                    <div className="relative bg-emerald-500 text-white text-2xl sm:text-3xl font-black py-5 sm:py-6 px-8 rounded-[2.5rem] border-[5px] border-emerald-300 flex items-center justify-center gap-4 shadow-xl">
                      <Rocket className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-sm" />
                      <span className="drop-shadow-sm">المحطة التالية</span>
                    </div>
                  </button>
                </Link>
                <Link href="/kids" data-testid="link-home">
                  <button className="kids-btn w-full relative group" data-testid="button-home">
                    <div className="absolute inset-0 bg-slate-300 rounded-[2.5rem] translate-y-2 group-active:translate-y-0 transition-transform"></div>
                    <div className="relative bg-slate-100 text-slate-600 text-xl sm:text-2xl font-bold py-4 sm:py-5 px-8 rounded-[2.5rem] border-4 border-white flex items-center justify-center gap-3">
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