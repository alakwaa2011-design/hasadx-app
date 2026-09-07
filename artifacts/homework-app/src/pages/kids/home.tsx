import React from "react";
import { Link } from "wouter";
import { Play, Star, Map, Award, Rocket, ClipboardList, Radio } from "lucide-react";
import { useKidsProfile, useKidsAdventureState, useKidsTodayAdventure, useKidsHome } from "@/hooks/use-kids";

export default function KidsHome() {
  const { data: profile } = useKidsProfile();
  const { data: adventureState } = useKidsAdventureState();
  const { data: todayAdventure } = useKidsTodayAdventure();
  const { data: kidsHome } = useKidsHome();

  const nextActivityId = todayAdventure?.adventure?.activity_ids.find(
    id => !todayAdventure.adventure.completed_ids?.includes(id)
  );
  
  const nextActivity = todayAdventure?.activities?.find(a => a.id === nextActivityId);
  const total = todayAdventure?.adventure?.activity_ids.length || 3;
  const completed = todayAdventure?.adventure?.completed_ids?.length || 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Hero Welcome */}
      <div className="bg-gradient-to-br from-primary to-blue-500 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-right">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">مستعد للمغامرة يا {profile?.display_name}؟</h2>
            <p className="text-blue-100 text-lg md:text-xl font-medium">لديك {adventureState?.stars || 0} نجمة، اجمع المزيد!</p>
          </div>
          
          <Link href="/kids/adventure">
            <button className="bg-white text-primary hover:bg-slate-50 transition-transform active:scale-95 font-bold text-xl px-8 py-4 rounded-2xl shadow-[0_8px_0_rgba(0,0,0,0.15)] hover:shadow-[0_4px_0_rgba(0,0,0,0.15)] hover:translate-y-1 flex items-center gap-3">
              <Play className="w-6 h-6 fill-primary" />
              <span>ابدأ اللعب الآن</span>
            </button>
          </Link>
        </div>
      </div>

      {!!kidsHome?.assignments.length && (
        <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-violet-600" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">مهام معلمتي</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {kidsHome.assignments.map((assignment) => (
              <Link key={assignment.id} href={`/kids/activity/${assignment.activity_id}`}>
                <button className="w-full rounded-2xl bg-violet-600 px-5 py-4 text-right text-lg font-bold text-white hover:bg-violet-700">
                  {assignment.title_ar}
                </button>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/kids/board">
        <button className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-sky-300 bg-white px-5 py-4 text-lg font-bold text-sky-700">
          <Radio className="h-6 w-6" />
          الانضمام إلى لوحة المعلمة
        </button>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Next Activity Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Map className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">أكمل رحلتك</h3>
              <p className="text-slate-500 font-medium">{nextActivity ? nextActivity.title_ar : "أكملت جميع الرحلات!"}</p>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 mb-6 overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(100, (completed / total) * 100)}%` }}
            />
          </div>

          <Link href="/kids/adventure">
            <button className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_6px_0_#d97706] active:shadow-[0_2px_0_#d97706] active:translate-y-1 transition-all flex items-center justify-center gap-2">
              <Rocket className="w-5 h-5" />
              <span>أكمل الرحلة</span>
            </button>
          </Link>
        </div>

        {/* Stickers / Rewards Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Award className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">إنجازاتي</h3>
              <p className="text-slate-500 font-medium">اكتشف ملصقاتك الجديدة</p>
            </div>
          </div>
          
          <div className="flex gap-3 mb-6 justify-center">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center">
                <Star className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
            ))}
          </div>

          <Link href="/kids/stickers">
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_6px_0_#059669] active:shadow-[0_2px_0_#059669] active:translate-y-1 transition-all">
              شاهد كل الملصقات
            </button>
          </Link>
        </div>
      </div>

    </div>
  );
}
