import React, { useState } from "react";
import { useCreateKidsProfile, AVATAR_PRESENTATION_MAP, AGE_BAND_PRESENTATION } from "@/hooks/use-kids";
import { Button } from "@/components/ui/button";
import { resolveKidsAsset } from "@/lib/kids-assets";
import { Sparkles, Zap } from "lucide-react";
import { kidsAvatarAgeBands, kidsAvatarKeysByAgeBand, defaultKidsAvatarAgeBand, defaultKidsAvatarByAgeBand, type KidsAvatarAgeBand } from "@workspace/api-zod";

export default function KidsOnboarding() {
  const [name, setName] = useState("");
  const [age, setAge] = useState<KidsAvatarAgeBand>(defaultKidsAvatarAgeBand);
  const [avatar, setAvatar] = useState<string>(defaultKidsAvatarByAgeBand[defaultKidsAvatarAgeBand]);
  const createProfile = useCreateKidsProfile();

  const handleAgeChange = (newAge: KidsAvatarAgeBand) => {
    setAge(newAge);
    setAvatar(defaultKidsAvatarByAgeBand[newAge]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProfile.mutate({ displayName: name, avatarKey: avatar, ageBand: age });
  };

  const activeAvatars = kidsAvatarKeysByAgeBand[age];

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-emerald-50 dark:bg-emerald-950/20 font-sans" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-10 w-full max-w-lg shadow-2xl border border-emerald-100 dark:border-emerald-900/50 text-center space-y-8 animate-in zoom-in-95 duration-500">

        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2">أهلاً بك يا بطل!</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">دعنا نجهز ملفك الخاص لنبدأ رحلة الإنجاز</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="space-y-3 text-right">
            <label className="font-bold text-slate-700 dark:text-slate-300">ما هو اسمك؟</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك هنا"
              className="w-full text-xl font-bold p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 bg-transparent outline-none transition-colors dark:text-white"
              required
            />
          </div>

          <div className="space-y-3 text-right">
            <label className="font-bold text-slate-700 dark:text-slate-300">كم عمرك؟</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {kidsAvatarAgeBands.map(band => (
                <button
                  key={band}
                  type="button"
                  onClick={() => handleAgeChange(band)}
                  className={`flex-1 py-3 px-2 rounded-2xl font-bold transition-all border-2 text-sm ${
                    age === band
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-emerald-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  {AGE_BAND_PRESENTATION[band]}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-3 text-right">
            <legend className="font-bold text-slate-700 dark:text-slate-300">اختر شعارك المميز</legend>
            <div className="grid grid-cols-3 gap-3">
              {activeAvatars.map((key) => {
                const Icon = AVATAR_PRESENTATION_MAP[key]?.Icon;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={avatar === key}
                    onClick={() => setAvatar(key)}
                    className={`rounded-2xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${
                      avatar === key
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                        : "border-slate-200 bg-slate-50 hover:border-emerald-200 dark:bg-slate-800 dark:border-slate-700"
                    }`}
                  >
                    {Icon ? (
                      <Icon className={`w-10 h-10 ${avatar === key ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    ) : (
                      <img src={resolveKidsAsset(key) ?? undefined} alt="" className="h-10 w-10 object-contain" />
                    )}
                    <span className={`block text-sm font-bold ${avatar === key ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {AVATAR_PRESENTATION_MAP[key]?.label || "شعار"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button
            type="submit"
            disabled={!name.trim() || createProfile.isPending}
            className="w-full h-16 text-xl font-bold rounded-2xl shadow-[0_6px_0_rgba(16,185,129,0.2)] active:translate-y-1 active:shadow-none bg-emerald-600 hover:bg-emerald-700 text-white transition-all mt-4"
          >
            {createProfile.isPending ? "جاري التجهيز..." : "هيا ننطلق!"}
          </Button>

        </form>

      </div>
    </div>
  );
}