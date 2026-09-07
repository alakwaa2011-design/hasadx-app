import React from "react";
import { Award, Lock, Sparkles } from "lucide-react";
import { useKidsProfile, useKidsAdventureState } from "@/hooks/use-kids";

const STICKERS = [
  { id: 1, name: "البطل الأول", icon: "🏆", cost: 10, bg: "bg-amber-100" },
  { id: 2, name: "قارئ سريع", icon: "📖", cost: 20, bg: "bg-blue-100" },
  { id: 3, name: "نجم ساطع", icon: "⭐", cost: 30, bg: "bg-purple-100" },
  { id: 4, name: "مستكشف", icon: "🚀", cost: 40, bg: "bg-emerald-100" },
  { id: 5, name: "عالم المستقبل", icon: "🔬", cost: 50, bg: "bg-sky-100" },
  { id: 6, name: "رسام مبدع", icon: "🎨", cost: 60, bg: "bg-pink-100" },
];

export default function KidsStickers() {
  const { data: profile } = useKidsProfile();
  const { data: adventureState } = useKidsAdventureState();
  const stars = adventureState?.stars || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">ملصقاتي</h2>
          <p className="text-slate-500 font-medium">اجمع النجوم وافتح ملصقات جديدة!</p>
        </div>
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center relative">
          <Sparkles className="w-6 h-6 text-amber-500 absolute -top-1 -right-1" />
          <Award className="w-8 h-8 text-amber-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STICKERS.map((sticker) => {
          const unlocked = stars >= sticker.cost;

          return (
            <div 
              key={sticker.id}
              className={`rounded-3xl p-6 flex flex-col items-center gap-4 border-2 transition-all ${unlocked ? `${sticker.bg} border-transparent` : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"}`}
            >
              <div className="text-5xl">
                {unlocked ? sticker.icon : (
                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <Lock className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <h3 className={`font-bold ${unlocked ? "text-slate-800" : "text-slate-400"}`}>
                  {unlocked ? sticker.name : "مقفول"}
                </h3>
                <div className={`text-sm font-bold mt-1 ${unlocked ? "text-slate-600" : "text-slate-400"}`}>
                  {sticker.cost} نجمة
                </div>
              </div>

              {unlocked && (
                <div className="absolute top-2 right-2 text-xs font-bold bg-white/50 px-2 py-1 rounded-full text-slate-700">
                  جديد
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
