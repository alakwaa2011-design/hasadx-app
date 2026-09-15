import { useMemo } from "react";
import { useGetQuranTodayDashboard, QuranSurah } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Loader2, BookOpen, Clock, Activity, CheckCircle2 } from "lucide-react";
import { quranModeLabel } from "./quran-labels";

export function QuranDashboard({ surahs, onNavigate }: { surahs: QuranSurah[], onNavigate: (tab: "circles" | "queue") => void }) {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  const { data: dashboard, isLoading } = useGetQuranTodayDashboard();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-800/40">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!dashboard) return null;

  const pendingWards = dashboard.dueWards.filter(w => w.status !== "completed");
  const todayRecitations = dashboard.todayRecitations;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-foreground">
          {lang === "ar" ? "نظرة عامة على اليوم" : "Today's Overview"}
        </h2>
        <p className="text-muted-foreground text-xs md:text-sm font-semibold mt-1">
          {lang === "ar" ? "متابعة أداء الطلاب والمهام المستحقة" : "Monitor student performance and due tasks"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white dark:bg-card p-5 md:p-6 rounded-2xl border border-border/60 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
            <div className="p-2 md:p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl">
              <Clock className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="font-bold text-sm md:text-base">{lang === "ar" ? "مهام مستحقة" : "Due Wards"}</h3>
          </div>
          <p className="text-3xl md:text-4xl font-black mt-auto">{pendingWards.length}</p>
        </div>

        <div className="bg-white dark:bg-card p-5 md:p-6 rounded-2xl border border-border/60 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-500">
            <div className="p-2 md:p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl">
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="font-bold text-sm md:text-base">{lang === "ar" ? "تسميع اليوم" : "Today's Recitations"}</h3>
          </div>
          <p className="text-3xl md:text-4xl font-black mt-auto">{todayRecitations.length}</p>
        </div>

        <div 
          className="bg-gradient-to-br from-emerald-800 to-emerald-950 p-5 md:p-6 rounded-2xl border border-emerald-700 shadow-md flex flex-col cursor-pointer hover:shadow-lg transition-all sm:col-span-2 md:col-span-1"
          onClick={() => onNavigate("queue")}
        >
          <div className="flex items-center gap-3 mb-4 text-emerald-100">
            <div className="p-2 md:p-2.5 bg-white/10 rounded-xl">
              <Activity className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="font-bold text-sm md:text-base">{lang === "ar" ? "طابور المراجعة" : "Review Queue"}</h3>
          </div>
          <p className="text-emerald-50 text-xs md:text-sm font-semibold mt-auto opacity-80">
            {lang === "ar" ? "انتقل لإدارة التسميع والمراجعات المعلقة" : "Go to manage pending reviews and recitations"}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border/60">
          <h3 className="font-bold text-base md:text-lg">{lang === "ar" ? "المهام المعلقة لليوم" : "Pending Due Wards"}</h3>
        </div>
        {pendingWards.length === 0 ? (
          <div className="p-8 md:p-12 text-center text-muted-foreground flex flex-col items-center">
            <BookOpen className="w-12 h-12 opacity-20 mb-4" />
            <p className="font-bold">{lang === "ar" ? "لا توجد مهام معلقة لليوم" : "No pending wards for today"}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {pendingWards.map(ward => {
              const surah = surahs.find(s => s.arabicName === ward.surahName);
              const surahNum = surah ? surah.number : 1;
              const readerUrl = `/teacher/quran-reader/${surahNum}?startAyah=${ward.startAyah}&endAyah=${ward.endAyah}&wardId=${ward.id}&mode=${ward.mode}`;

              return (
              <div key={ward.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground">{ward.studentName}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {ward.surahName} • {lang === "ar" ? "الآيات:" : "Ayahs:"} {ward.startAyah} - {ward.endAyah}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={readerUrl} className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg dark:bg-blue-900/40 dark:text-blue-300" title={lang === 'ar' ? 'فتح في المصحف' : 'Open in Quran'}>
                    <BookOpen className="w-4 h-4" />
                  </Link>
                  <div className="px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 rounded-md text-xs font-bold shrink-0">
                    {quranModeLabel(ward.mode, isArabic)}
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}