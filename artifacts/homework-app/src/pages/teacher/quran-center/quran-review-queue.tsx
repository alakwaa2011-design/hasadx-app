import { useState } from "react";
import { useGetQuranReviewQueue, QuranSurah } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Loader2, ClipboardCheck, AlertCircle } from "lucide-react";
import { RecordRecitationModal } from "./quran-student-profile";

export function QuranReviewQueue({ surahs }: { surahs: QuranSurah[] }) {
  const { lang } = useI18n();
  const { data: queue, isLoading } = useGetQuranReviewQueue();
  const [evaluatingWardId, setEvaluatingWardId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-800/40">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const reviewItems = queue || [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground">
            {lang === "ar" ? "طابور المراجعة" : "Review Queue"}
          </h2>
          <p className="text-muted-foreground text-xs md:text-sm font-semibold mt-1">
            {lang === "ar" ? "المهام التي تتطلب تقييمًا أو مراجعة" : "Wards requiring evaluation or review"}
          </p>
        </div>
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-xl font-bold flex items-center justify-center gap-2 self-start sm:self-auto">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{reviewItems.length} {lang === "ar" ? "قيد الانتظار" : "Pending"}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {reviewItems.length === 0 ? (
          <div className="p-12 md:p-16 text-center text-muted-foreground flex flex-col items-center">
            <ClipboardCheck className="w-12 h-12 md:w-16 md:h-16 opacity-20 mb-4 text-emerald-600" />
            <p className="font-bold text-base md:text-lg">{lang === "ar" ? "الطابور فارغ!" : "Queue is empty!"}</p>
            <p className="text-xs md:text-sm mt-2">{lang === "ar" ? "لقد أكملت جميع المراجعات المعلقة." : "You have completed all pending reviews."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {reviewItems.map((ward) => (
              <div key={ward.id} className="p-4 md:p-5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm md:text-base">
                      {ward.studentName}
                    </span>
                    <span className="text-muted-foreground/60">•</span>
                    <h4 className="font-bold text-foreground text-sm md:text-base">
                      {ward.surahName} (الآيات {ward.startAyah}-{ward.endAyah})
                    </h4>
                  </div>
                  <p className="text-[11px] md:text-xs text-muted-foreground font-medium">
                    {lang === "ar" ? "نوع المهمة:" : "Task Mode:"} <span className="text-foreground">{ward.mode}</span> 
                    {" • "}
                    {lang === "ar" ? "مستحقة في:" : "Due:"} <span className="text-foreground">{ward.dueDate || "-"}</span>
                  </p>
                </div>
                <div className="shrink-0">
                  <button 
                    onClick={() => setEvaluatingWardId(ward.id)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 transition-colors">
                    {lang === "ar" ? "تقييم الآن" : "Evaluate Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {evaluatingWardId != null && (
        <RecordRecitationModal
          wardId={evaluatingWardId}
          onClose={() => setEvaluatingWardId(null)}
        />
      )}
    </div>
  );
}