import React, { useState } from "react";
import { useCreateKidsProfile } from "@/hooks/use-kids";
import { Star, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";

const AVATARS = [
  { key: "kids/avatars/star", label: "نجمة", symbol: "⭐" },
  { key: "kids/avatars/moon", label: "قمر", symbol: "🌙" },
  { key: "kids/avatars/rainbow", label: "قوس قزح", symbol: "🌈" },
];

const AGE_BANDS = [
  { id: "3-4", label: "3 - 4 سنوات" },
  { id: "4-5", label: "4 - 5 سنوات" },
  { id: "5-6", label: "5 - 6 سنوات" }
];

export default function KidsOnboarding() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].key);
  const [age, setAge] = useState(AGE_BANDS[1].id);
  const createProfile = useCreateKidsProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProfile.mutate({ displayName: name, avatarKey: avatar, ageBand: age });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-sky-50 dark:bg-slate-900 font-sans" dir="rtl">
      <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-8 md:p-12 w-full max-w-md shadow-xl text-center space-y-8 animate-in zoom-in-95 duration-500">
        
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2">أهلاً بك يا بطل!</h1>
          <p className="text-slate-500 font-medium">دعنا نجهز ملفك الخاص</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-3 text-right">
            <label className="font-bold text-slate-700 dark:text-slate-300">اسم البطل</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك هنا"
              className="w-full text-xl font-bold p-4 rounded-2xl border-2 border-slate-200 focus:border-primary outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-3 text-right">
            <label className="font-bold text-slate-700 dark:text-slate-300">اختر عمرك</label>
            <div className="flex gap-2">
              {AGE_BANDS.map(band => (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => setAge(band.id)}
                  className={`flex-1 py-3 rounded-2xl font-bold transition-all border-2 ${
                    age === band.id ? "bg-amber-100 border-amber-400 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-200"
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-3 text-right">
            <legend className="font-bold text-slate-700 dark:text-slate-300">اختر شخصيتك</legend>
            <div className="grid grid-cols-3 gap-2">
              {AVATARS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={avatar === option.key}
                  onClick={() => setAvatar(option.key)}
                  className={`rounded-2xl border-2 p-3 text-center transition-all ${
                    avatar === option.key
                      ? "border-primary bg-primary/10"
                      : "border-slate-200 bg-slate-50 hover:border-primary/40"
                  }`}
                >
                  <span className="block text-3xl" aria-hidden="true">{option.symbol}</span>
                  <span className="mt-1 block text-xs font-bold text-slate-700">{option.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button 
            type="submit" 
            disabled={!name.trim() || createProfile.isPending}
            className="w-full h-16 text-xl font-bold rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.15)] active:translate-y-1 active:shadow-none bg-primary hover:bg-primary/90 text-white"
          >
            {createProfile.isPending ? "جاري الإنشاء..." : "هيا نبدأ المغامرة!"}
          </Button>

        </form>

      </div>
    </div>
  );
}