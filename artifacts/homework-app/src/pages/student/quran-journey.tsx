import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  Flame,
  History,
  Loader2,
  RefreshCcw,
  Sparkles,
  Star,
  Target,
  BarChart3,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useGetQuranJourney, getGetQuranJourneyQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Date formatting helper
function formatActivityDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: "emerald" | "amber" | "indigo" | "blue";
}) {
  const colors = {
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    indigo:
      "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-sm transition-colors hover:bg-card/90">
      <CardContent className="flex flex-col items-center justify-center p-4 sm:p-5 text-center">
        <div
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${colors[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="mb-1 text-xl sm:text-2xl font-black text-foreground">
          {value}
        </h4>
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function ActivityGraph({
  activeDates,
  lang,
}: {
  activeDates: string[];
  lang: string;
}) {
  // Generate last 90 days
  const days = useMemo(() => {
    const activeSet = new Set(activeDates);
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      result.push({
        date: dateStr,
        active: activeSet.has(dateStr),
      });
    }
    return result;
  }, [activeDates]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
        {days.map((d) => (
          <div
            key={d.date}
            className={`h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 rounded-[2px] sm:rounded-sm transition-colors duration-300 ${
              d.active
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/20 dark:bg-emerald-500"
                : "bg-emerald-100/50 dark:bg-emerald-950/50"
            }`}
            title={d.date}
          />
        ))}
      </div>
      <div className="mt-6 flex items-center justify-end gap-3 sm:gap-4 text-xs font-semibold text-muted-foreground">
        <span>{lang === "ar" ? "أقل نشاطاً" : "Less"}</span>
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-emerald-100/50 dark:bg-emerald-950/50" />
          <div className="h-3 w-3 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/20" />
        </div>
        <span>{lang === "ar" ? "أكثر نشاطاً" : "More"}</span>
      </div>
    </div>
  );
}

export default function QuranJourneyPage() {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();

  const {
    data: journey,
    isLoading,
    isError,
    refetch,
  } = useGetQuranJourney({
    query: {
      retry: 2,
      queryKey: getGetQuranJourneyQueryKey(),
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
        </div>
      </Layout>
    );
  }

  if (isError || !journey) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="mb-2 rounded-full bg-red-50 p-4 text-red-500 dark:bg-red-950/50">
            <RefreshCcw className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">
            {lang === "ar" ? "تعذر تحميل رحلتك" : "Failed to load your journey"}
          </h2>
          <p className="text-muted-foreground">
            {lang === "ar"
              ? "حدث خطأ أثناء جلب البيانات. يرجى المحاولة مرة أخرى."
              : "An error occurred while fetching data. Please try again."}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            {lang === "ar" ? "إعادة المحاولة" : "Try Again"}
          </Button>
        </div>
      </Layout>
    );
  }

  const { profile, streak, nextWard, summary, activeDates, recentActivities } = journey;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-emerald-50/40 to-background dark:from-emerald-950/20 dark:to-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/student/dashboard")}
              className="rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              {dir === "rtl" ? (
                <ArrowRight className="h-5 w-5" />
              ) : (
                <ArrowLeft className="h-5 w-5" />
              )}
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-50">
                {lang === "ar" ? "رحلتي القرآنية" : "My Quran Journey"}
              </h1>
              <p className="mt-1 text-sm font-semibold text-emerald-700/80 dark:text-emerald-400/80">
                {lang === "ar"
                  ? "تقدمك، إنجازاتك، وخطوتك التالية"
                  : "Your progress, achievements, and next step"}
              </p>
            </div>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-3">
            {/* Main Progress Panel */}
            <Card className="border-emerald-100 bg-white/60 shadow-sm backdrop-blur-sm dark:border-emerald-900/40 dark:bg-background/60 md:col-span-2">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 shadow-inner dark:bg-emerald-900/50">
                    <BookOpen className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {lang === "ar" ? "موقعك الحالي" : "Current Position"}
                    </p>
                    <h2 className="truncate text-2xl font-black text-foreground sm:text-3xl">
                      {profile.currentSurahNumber
                        ? lang === "ar"
                          ? `سورة رقم ${profile.currentSurahNumber}`
                          : `Surah ${profile.currentSurahNumber}`
                        : lang === "ar"
                        ? "لم تبدأ بعد"
                        : "Not started yet"}
                    </h2>
                    {profile.currentAyah && (
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {lang === "ar"
                          ? `آية ${profile.currentAyah}`
                          : `Ayah ${profile.currentAyah}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-2 flex items-end justify-between">
                    <span className="text-sm font-bold text-muted-foreground">
                      {lang === "ar" ? "التقدم العام" : "Overall Progress"}
                    </span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                      {profile.progressPercent}%
                    </span>
                  </div>
                  <Progress
                    value={profile.progressPercent}
                    className="h-3 bg-emerald-100 dark:bg-emerald-950"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Streak Panel */}
            <Card className="relative overflow-hidden border-amber-100 bg-gradient-to-br from-amber-50/50 to-white shadow-sm backdrop-blur-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:to-background/60">
              <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <Flame className="h-24 w-24 text-amber-500" />
                </div>
                <div className="relative z-10 w-full flex flex-col items-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm ring-4 ring-white dark:bg-amber-900/50 dark:text-amber-400 dark:ring-background">
                    <Flame className="h-8 w-8 fill-amber-500 text-amber-500" />
                  </div>
                  <h3 className="mb-1 text-3xl font-black text-amber-700 dark:text-amber-500">
                    {streak.current}
                  </h3>
                  <p className="text-sm font-bold text-amber-900/60 dark:text-amber-200/60">
                    {lang === "ar" ? "أيام متتالية" : "Day Streak"}
                  </p>

                  {streak.longest > 0 && (
                    <div className="mt-4 w-full border-t border-amber-200/50 pt-4 dark:border-amber-800/50">
                      <p className="text-xs font-bold text-amber-800/70 dark:text-amber-400/70">
                        {lang === "ar"
                          ? `أفضل رقم: ${streak.longest} أيام`
                          : `Best: ${streak.longest} days`}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {nextWard && (
            <div className="mb-8">
              <Card
                className="relative overflow-hidden border-0 shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #225739 0%, #2f684d 100%)",
                }}
              >
                {/* subtle pattern */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)",
                    backgroundSize: "24px 24px",
                  }}
                />
                <CardContent className="relative z-10 flex flex-col items-center justify-between gap-6 p-6 md:flex-row md:p-8">
                  <div className="flex w-full items-center gap-4 text-white md:w-auto">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                      <Target className="h-7 w-7 text-emerald-100" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-100 opacity-90">
                        {lang === "ar" ? "خطوتك القادمة" : "Next Step"}
                      </p>
                      <h3 className="text-xl font-black md:text-2xl">
                        {lang === "ar"
                          ? `سورة ${nextWard.surahName}`
                          : `Surah ${nextWard.surahName}`}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-50/80">
                        {lang === "ar"
                          ? `الآيات ${nextWard.startAyah} - ${nextWard.endAyah}`
                          : `Ayahs ${nextWard.startAyah} - ${nextWard.endAyah}`}
                        <span className="mx-2 opacity-50">•</span>
                        {nextWard.mode === "memorization"
                          ? lang === "ar"
                            ? "حفظ"
                            : "Memorization"
                          : lang === "ar"
                          ? "مراجعة"
                          : "Review"}
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    className="w-full bg-white font-black text-emerald-800 shadow-xl hover:bg-emerald-50 md:w-auto"
                    size="lg"
                  >
                    <Link href={`/student/quran-wards/${nextWard.id}`}>
                      {lang === "ar" ? "ابدأ الآن" : "Start Now"}
                      {dir === "rtl" ? (
                        <ArrowLeft className="mr-2 h-5 w-5" />
                      ) : (
                        <ArrowRight className="ml-2 h-5 w-5" />
                      )}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle}
              label={lang === "ar" ? "الأوراد المنجزة" : "Completed Wards"}
              value={summary.completedWardCount}
              color="emerald"
            />
            <StatCard
              icon={Star}
              label={lang === "ar" ? "الآيات المتقنة" : "Mastered Ayahs"}
              value={summary.masteredAyahCount}
              color="amber"
            />
            <StatCard
              icon={Clock}
              label={lang === "ar" ? "قيد الانتظار" : "Pending/Review"}
              value={summary.pendingSubmissionCount + summary.needsReviewCount}
              color="indigo"
            />
            <StatCard
              icon={BarChart3}
              label={lang === "ar" ? "متوسط الحفظ" : "Avg Score"}
              value={
                summary.averageMemorizationScore !== null
                  ? `${Math.round(summary.averageMemorizationScore)}%`
                  : "-"
              }
              color="blue"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Activity Graph */}
            <Card className="border-border/50 shadow-sm lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-emerald-600" />
                  {lang === "ar" ? "نشاطك الأخير" : "Recent Activity"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityGraph activeDates={activeDates} lang={lang} />
              </CardContent>
            </Card>

            {/* Recent Activity List */}
            <Card className="flex flex-col border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {lang === "ar" ? "آخر الإنجازات" : "Latest Achievements"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto px-2 pb-6 max-h-[350px]">
                {recentActivities.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    <p className="text-sm font-semibold">
                      {lang === "ar"
                        ? "لم تسجل أي نشاط بعد. ابدأ رحلتك الآن!"
                        : "No activity recorded yet. Start your journey!"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {recentActivities.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                          {act.type === "recitation" ? (
                            <Clock className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">
                            {lang === "ar" ? `سورة ${act.surahName}` : `Surah ${act.surahName}`}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {lang === "ar"
                              ? `آيات ${act.startAyah}-${act.endAyah}`
                              : `Ayahs ${act.startAyah}-${act.endAyah}`}
                          </p>
                        </div>
                        <div className="whitespace-nowrap pt-1 text-xs font-semibold text-muted-foreground">
                          {formatActivityDate(act.date, lang)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
