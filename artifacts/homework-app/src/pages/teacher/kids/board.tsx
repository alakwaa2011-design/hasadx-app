import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2, Sparkles, MonitorPlay, UserRound, Volume2 } from "lucide-react";
import { useTeacherKidsActivities } from "@/hooks/use-kids";
import { KidsIllustration, resolveKidsAsset, type KidsAssetKey } from "@/lib/kids-assets";

type WorldSlug = "all" | "arabic-letters" | "english-phonics" | "numbers-0-20";
type AgeBand = "3-4" | "4-5" | "5-6";

const worlds: Array<{
  slug: WorldSlug;
  title: string;
  subtitle: string;
  assetKey?: KidsAssetKey;
  color: string;
}> = [
  { slug: "all", title: "كل العوالم", subtitle: "مزيج ممتع", color: "from-violet-600 to-indigo-700" },
  { slug: "arabic-letters", title: "العربية", subtitle: "مدينة الحروف", assetKey: "kids/illustrations/world-arabic", color: "from-sky-500 to-cyan-700" },
  { slug: "english-phonics", title: "English", subtitle: "جزيرة الأصوات", assetKey: "kids/illustrations/world-english", color: "from-fuchsia-500 to-violet-700" },
  { slug: "numbers-0-20", title: "الأرقام", subtitle: "وادي الأعداد", assetKey: "kids/illustrations/world-numbers", color: "from-amber-500 to-orange-700" },
];

const suggestedAges: Record<string, AgeBand[]> = {
  tracing: ["3-4", "4-5"],
  media_choice: ["3-4", "4-5"],
  counting: ["3-4", "4-5", "5-6"],
  matching: ["4-5", "5-6"],
  ordering_puzzle: ["5-6"],
};

export default function TeacherKidsBoard() {
  const [, setLocation] = useLocation();
  const { data: activities, isLoading: activitiesLoading } = useTeacherKidsActivities();
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedWorld, setSelectedWorld] = useState<WorldSlug>("all");
  const [selectedAge, setSelectedAge] = useState<AgeBand>("4-5");

  const handlePlay = (mode: "board" | "solo") => {
    if (!selectedActivityId) return;
    setLocation(`/teacher/kids/board/activity/${selectedActivityId}?mode=${mode}`);
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
  const filteredActivities = useMemo(
    () => activities?.filter((activity) => {
      const inWorld = selectedWorld === "all" || activity.world_slug === selectedWorld;
      const ages = suggestedAges[activity.activity_type] ?? ["3-4", "4-5", "5-6"];
      return inWorld && ages.includes(selectedAge);
    }) ?? [],
    [activities, selectedAge, selectedWorld],
  );

  const selectWorld = (world: WorldSlug) => {
    setSelectedWorld(world);
    setSelectedActivityId("");
  };

  return (
    <Layout>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col p-3 pb-36 font-display sm:p-5 md:p-8">

        <div className="relative mb-6 overflow-hidden rounded-[2rem] border-4 border-indigo-100/20 bg-gradient-to-l from-indigo-900 via-violet-800 to-purple-900 p-5 shadow-lg sm:p-8 md:rounded-[2.5rem] md:p-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-400 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 flex items-center justify-between gap-3 text-right">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="icon" onClick={() => setLocation("/teacher/kids")} className="shrink-0 rounded-full text-white hover:bg-white/20">
                  <ArrowRight className="h-6 w-6" />
                </Button>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl">
                  اختر مغامرة الطفل
                </h1>
              </div>
              <p className="mt-3 max-w-2xl text-base font-bold leading-relaxed text-indigo-100 sm:mr-14 sm:text-lg md:text-xl">
                نشاط واحد، بطريقتين: على سبورة الفصل أو لعب فردي من حسابك.
              </p>
            </div>

            <div className="relative hidden h-36 w-36 shrink-0 sm:block md:h-48 md:w-48">
              <KidsIllustration assetKey="kids/illustrations/mascot-wave" alt="مرشد حصاد الصغير" className="h-full w-full object-contain drop-shadow-2xl motion-safe:animate-float-slow" fallback={<Sparkles className="mx-auto h-24 w-24 text-amber-300" />} />
            </div>
          </div>
        </div>

        <section className="mb-7 rounded-[2rem] border border-violet-100 bg-violet-50/70 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-violet-600">الخطوة الأولى</p>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">اختر عمر الطفل</h2>
            </div>
            <div className="flex rounded-2xl bg-white p-1.5 shadow-sm" aria-label="اختيار عمر الطفل">
              {(["3-4", "4-5", "5-6"] as AgeBand[]).map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => {
                    setSelectedAge(age);
                    setSelectedActivityId("");
                  }}
                  className={`min-h-11 rounded-xl px-4 text-base font-black transition sm:px-6 ${selectedAge === age ? "bg-violet-600 text-white shadow-md" : "text-slate-600 hover:bg-violet-50"}`}
                >
                  {age} سنوات
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm font-bold text-slate-600">سنقترح أنشطة مناسبة لهذه المرحلة، ويمكنك تغيير العمر في أي وقت.</p>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-xs font-black text-indigo-600">الخطوة الثانية</p>
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">اختر العالم</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {worlds.map((world) => {
              const active = selectedWorld === world.slug;
              return (
                <button
                  key={world.slug}
                  type="button"
                  onClick={() => selectWorld(world.slug)}
                  className={`group relative min-h-32 overflow-hidden rounded-[1.75rem] border-4 text-right shadow-sm transition motion-safe:hover:-translate-y-1 ${active ? "border-amber-400 ring-4 ring-amber-100" : "border-white hover:border-indigo-200"}`}
                >
                  {world.assetKey ? (
                    <KidsIllustration assetKey={world.assetKey} alt={world.subtitle} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${world.color}`}></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"></div>
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl font-black sm:text-2xl">{world.title}</p>
                        <p className="text-sm font-bold text-white/85">{world.subtitle}</p>
                      </div>
                      {active && <CheckCircle2 className="h-7 w-7 shrink-0 fill-amber-400 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex-1">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-emerald-700">الخطوة الثالثة</p>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">اختر النشاط الممتع</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-800">{filteredActivities.length} أنشطة</span>
          </div>

          {activitiesLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-44 animate-pulse rounded-[2rem] border-2 border-slate-100 bg-slate-50/50"></div>)}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="rounded-[2.5rem] border-2 border-dashed border-amber-200 bg-amber-50 py-14 text-center">
              <Sparkles className="mx-auto mb-3 h-12 w-12 text-amber-400" />
              <h3 className="text-xl font-black text-slate-700">لا يوجد نشاط مناسب لهذا الاختيار بعد</h3>
              <p className="mt-2 font-bold text-slate-500">اختر عمرًا أو عالمًا آخر لعرض الأنشطة المتاحة.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActivities.map((activity) => {
                const isSelected = selectedActivityId === activity.id;
                const activityImage = resolveKidsAsset(activity.asset_key);
                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => setSelectedActivityId(activity.id)}
                    className={`group relative flex min-h-40 w-full items-stretch overflow-hidden rounded-[2rem] border-[3px] text-right outline-none transition-all duration-300 ${isSelected ? "border-amber-400 bg-amber-50 shadow-lg motion-safe:-translate-y-1" : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md motion-safe:hover:-translate-y-0.5"}`}
                  >
                    <div className={`flex w-24 shrink-0 items-center justify-center bg-gradient-to-br ${activity.world_slug === "arabic-letters" ? "from-sky-100 to-cyan-200" : activity.world_slug === "english-phonics" ? "from-fuchsia-100 to-violet-200" : "from-amber-100 to-orange-200"}`}>
                      {activityImage ? (
                        <img src={activityImage} alt="" className="h-20 w-20 object-contain drop-shadow-md" />
                      ) : (
                        <Volume2 className="h-10 w-10 text-indigo-500" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                      <span className={`mb-2 w-fit rounded-full px-3 py-1 text-xs font-black ${isSelected ? "bg-amber-200 text-amber-950" : "bg-indigo-50 text-indigo-700"}`}>
                        {getActivityLabel(activity.activity_type)}
                      </span>
                      <h3 className="text-xl font-black leading-snug text-slate-900 sm:text-2xl">
                        {activity.title_ar}
                      </h3>
                      <p className="mt-2 text-sm font-bold text-slate-500">صوت وصورة ولمس</p>
                    </div>
                    {isSelected && <CheckCircle2 className="absolute left-4 top-4 h-7 w-7 fill-amber-100 text-amber-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div
          className={`pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 transition-all duration-500 ${selectedActivityId ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 motion-reduce:translate-y-0"}`}
        >
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-[2rem] border-2 border-slate-200/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center md:p-4">
            <div className="min-w-0 flex-1 px-2 sm:px-4">
              <p className="text-xs font-bold text-slate-500">النشاط المختار</p>
              <p className="truncate text-base font-black text-slate-900">{selectedActivity?.title_ar}</p>
            </div>
            <Button
              onClick={() => handlePlay("solo")}
              size="lg"
              variant="outline"
              className="h-14 rounded-2xl border-2 border-violet-200 px-5 text-base font-black text-violet-800 hover:bg-violet-50"
            >
              <UserRound className="h-5 w-5" />
              لعب فردي
            </Button>
            <Button
              onClick={() => handlePlay("board")}
              size="lg"
              className="h-14 rounded-2xl bg-indigo-600 px-6 text-base font-black text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700"
            >
              <MonitorPlay className="h-5 w-5" />
              تشغيل على السبورة
            </Button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
