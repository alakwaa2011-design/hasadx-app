import React from "react";
import { Link } from "wouter";
import { Play, Star, Radio, Sparkles, Cloud } from "lucide-react";
import { useKidsProfile, useKidsAdventureState, useKidsTodayAdventure, useKidsHome } from "@/hooks/use-kids";

const playfulStyles = `
  @keyframes float-cloud {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    50% { transform: translateY(-8px) translateX(4px); }
  }
  @keyframes bounce-jelly {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  .animate-float-cloud { animation: float-cloud 5s ease-in-out infinite; }
  .animate-bounce-jelly { animation: bounce-jelly 2.5s infinite cubic-bezier(0.34, 1.56, 0.64, 1); }

  .kids-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kids-btn:active { transform: scale(0.92); }

  .kids-card { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kids-card:hover { transform: translateY(-6px) scale(1.02); }

  @media (prefers-reduced-motion: reduce) {
    .animate-float-cloud, .animate-bounce-jelly {
      animation: none !important;
      transform: none !important;
    }
    .kids-card:hover, .kids-btn:active {
      transform: none !important;
    }
  }
`;

export default function KidsHome() {
  const { data: profile } = useKidsProfile();
  const { data: adventureState } = useKidsAdventureState();
  const { data: todayAdventure } = useKidsTodayAdventure();
  const { data: kidsHome } = useKidsHome();

  const nextActivityId = todayAdventure?.adventure?.activity_ids.find(
    id => !todayAdventure.adventure.completed_ids?.includes(id)
  );
  const nextActivity = todayAdventure?.activities?.find(a => a.id === nextActivityId);

  return (
    <>
      <style>{playfulStyles}</style>
      <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700 font-display pb-8">

        {/* Sky Header */}
        <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-b from-sky-400 to-sky-200 p-8 md:p-12 shadow-inner border-4 border-sky-100 flex flex-col md:flex-row items-center justify-between gap-10">
          {/* Decorative clouds */}
          <Cloud className="absolute top-4 left-8 text-white/70 w-24 h-24 animate-float-cloud" style={{ animationDelay: '0s' }} />
          <Cloud className="absolute bottom-4 right-12 text-white/50 w-32 h-32 animate-float-cloud" style={{ animationDelay: '1.5s' }} />
          <Cloud className="absolute top-1/2 left-1/3 text-white/30 w-16 h-16 animate-float-cloud" style={{ animationDelay: '3s' }} />

          <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-right space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-md tracking-tight leading-tight" data-testid="text-welcome">
                مرحباً بك يا بطل،<br/><span className="text-amber-300">{profile?.display_name || "يا صديقي"}!</span>
              </h1>
              <div className="inline-flex items-center gap-3 bg-white/25 backdrop-blur-md rounded-[2rem] px-6 py-3 border-[3px] border-white/50 text-white font-bold text-2xl shadow-sm" data-testid="display-stars">
                <Star className="w-8 h-8 fill-amber-400 text-amber-400 drop-shadow-sm" />
                <span>{adventureState?.stars || 0} نجمة</span>
              </div>
            </div>

            {/* Giant Play Button for Next Activity */}
            <Link href="/kids/adventure" data-testid="link-start-adventure">
              <button className="kids-btn relative group mt-2" data-testid="button-start-adventure">
                <div className="absolute inset-0 bg-amber-600 rounded-[3rem] translate-y-3 transition-transform group-hover:translate-y-4 group-active:translate-y-0"></div>
                <div className="relative bg-amber-400 border-[5px] border-amber-200 text-white font-black text-3xl md:text-4xl px-10 py-6 rounded-[3rem] flex items-center gap-4 animate-bounce-jelly shadow-xl">
                  <Play className="w-10 h-10 fill-white drop-shadow-md" />
                  <span className="drop-shadow-md">{nextActivity ? "العب الآن!" : "خريطة الرحلة"}</span>
                </div>
              </button>
            </Link>
          </div>

          <div className="relative z-10 w-48 h-48 md:w-64 md:h-64 shrink-0 flex justify-center items-center">
            <img
              src="/kids/world/hasaad-guide.webp"
              alt="المرشد حصاد"
              loading="eager"
              className="w-full h-full drop-shadow-xl animate-float-cloud object-contain"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        </div>

        {/* Learning Worlds Showcase (Visual Only) */}
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-black text-slate-700 px-4 drop-shadow-sm">عوالم نكتشفها</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="rounded-[2rem] overflow-hidden relative aspect-video border-4 border-white shadow-sm bg-sky-200 group">
              <img src="/kids/world/arabic-letter-city.jpg" alt="مدينة الحروف العربية" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" style={{ backgroundColor: '#bae6fd' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5">
                <span className="text-white font-bold text-xl drop-shadow-md">مدينة الحروف</span>
              </div>
            </div>
            <div className="rounded-[2rem] overflow-hidden relative aspect-video border-4 border-white shadow-sm bg-indigo-200 group">
              <img src="/kids/world/english-island.jpg" alt="جزيرة الإنجليزية" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" style={{ backgroundColor: '#c7d2fe' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5">
                <span className="text-white font-bold text-xl drop-shadow-md">جزيرة الإنجليزية</span>
              </div>
            </div>
            <div className="rounded-[2rem] overflow-hidden relative aspect-video border-4 border-white shadow-sm bg-amber-200 group">
              <img src="/kids/world/numbers-valley.jpg" alt="وادي الأرقام" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" style={{ backgroundColor: '#fde68a' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-5">
                <span className="text-white font-bold text-xl drop-shadow-md">وادي الأرقام</span>
              </div>
            </div>
          </div>
        </div>

        {/* Teacher Assignments */}
        {!!kidsHome?.assignments.length && (
          <div className="kids-card rounded-[3rem] bg-gradient-to-br from-violet-400 to-fuchsia-500 p-8 md:p-10 shadow-inner border-4 border-violet-200">
            <div className="mb-8 flex items-center justify-center gap-4 text-white">
              <div className="p-4 bg-white/20 rounded-[2rem] backdrop-blur-sm border-2 border-white/30">
                <Sparkles className="h-12 w-12 fill-amber-300 text-amber-300" />
              </div>
              <h3 className="text-3xl md:text-4xl font-black drop-shadow-md text-white">رسائل معلمتي الممتعة</h3>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {kidsHome.assignments.map((assignment) => (
                <Link key={assignment.id} href={`/kids/activity/${assignment.activity_id}`} data-testid={`link-assignment-${assignment.id}`}>
                  <button className="kids-btn w-full relative group text-right text-2xl font-bold" data-testid={`button-assignment-${assignment.id}`}>
                    <div className="absolute inset-0 bg-violet-800 rounded-[2rem] translate-y-2 group-active:translate-y-0 transition-transform"></div>
                    <div className="relative bg-white text-violet-700 p-6 rounded-[2rem] border-4 border-violet-100 flex justify-between items-center shadow-sm">
                      <span className="truncate ml-4">{assignment.title_ar}</span>
                      <Play className="w-8 h-8 shrink-0 fill-violet-400 text-violet-400" />
                    </div>
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Two Column Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Join Board */}
          <Link href="/kids/board" data-testid="link-teacher-board">
            <button className="kids-card kids-btn w-full h-full relative group text-center" data-testid="button-teacher-board">
              <div className="absolute inset-0 bg-emerald-700 rounded-[3rem] translate-y-3 group-active:translate-y-0 transition-transform"></div>
              <div className="relative h-full bg-gradient-to-br from-emerald-400 to-emerald-500 border-4 border-emerald-200 p-8 md:p-12 rounded-[3rem] flex flex-col items-center justify-center gap-6 shadow-inner">
                <div className="w-28 h-28 bg-white/20 rounded-[2.5rem] flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                  <Radio className="w-14 h-14 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl md:text-4xl font-black text-white drop-shadow-md">سبورة المعلمة</h3>
                  <p className="text-emerald-100 font-bold text-xl">انضم للفصل الآن!</p>
                </div>
              </div>
            </button>
          </Link>

          {/* Stickers / Rewards */}
          <Link href="/kids/stickers" data-testid="link-stickers-rewards">
            <button className="kids-card kids-btn w-full h-full relative group text-center" data-testid="button-stickers-rewards">
              <div className="absolute inset-0 bg-pink-700 rounded-[3rem] translate-y-3 group-active:translate-y-0 transition-transform"></div>
              <div className="relative h-full bg-gradient-to-br from-pink-400 to-pink-500 border-4 border-pink-200 p-8 md:p-12 rounded-[3rem] flex flex-col items-center justify-center gap-6 shadow-inner">
                <div className="w-32 h-32 flex items-center justify-center">
                  <img src="/kids/world/reward-chest.webp" alt="صندوق المكافآت" loading="lazy" className="w-full h-full object-contain drop-shadow-lg" style={{ backgroundColor: 'transparent' }} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl md:text-4xl font-black text-white drop-shadow-md">صندوق الكنوز</h3>
                  <p className="text-pink-100 font-bold text-xl">شاهد ملصقاتك الرائعة!</p>
                </div>
              </div>
            </button>
          </Link>

        </div>

      </div>
    </>
  );
}