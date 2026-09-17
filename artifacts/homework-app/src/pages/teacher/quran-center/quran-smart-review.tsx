import { useState } from "react";
import { 
  useGetTeacherQuranMemorizationSummary, 
  useListTeacherQuranMemorizationStudents,
  QuranSurah
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { 
  Loader2, Brain, Activity, AlertCircle, Clock, BookOpen, User, Link2Off, ArrowLeft, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuranStudentProfileView } from "./quran-student-profile";

export function QuranSmartReview({ surahs }: { surahs: QuranSurah[] }) {
  const { lang, dir } = useI18n();
  const isArabic = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const { data: summary, isLoading: loadingSummary, isError: errorSummary, refetch: refetchSummary } = useGetTeacherQuranMemorizationSummary();
  const { data: students, isLoading: loadingStudents, isError: errorStudents, refetch: refetchStudents } = useListTeacherQuranMemorizationStudents();

  if (loadingSummary || loadingStudents) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-800/40">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (errorSummary || errorStudents) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-amber-500" />
        <h3 className="mb-2 text-lg font-black text-foreground">
          {isArabic ? "تعذر تحميل البيانات" : "Failed to load data"}
        </h3>
        <p className="mb-6 text-sm font-bold text-muted-foreground">
          {isArabic ? "حدث خطأ أثناء جلب بيانات المراجعة الذكية." : "An error occurred while fetching smart review data."}
        </p>
        <button
          onClick={() => { refetchSummary(); refetchStudents(); }}
          data-testid="button-retry-smart-review"
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          {isArabic ? "إعادة المحاولة" : "Try Again"}
        </button>
      </div>
    );
  }

  if (selectedStudentId) {
    const studentInfo = students?.find(s => s.studentId === selectedStudentId);
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto h-full flex flex-col overflow-y-auto">
        <div className="mb-4 shrink-0">
          <button 
            onClick={() => setSelectedStudentId(null)}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <BackIcon className="w-4 h-4" />
            {isArabic ? "العودة للقائمة" : "Back to list"}
          </button>
        </div>
        <div className="flex-1">
          <QuranStudentProfileView 
            studentId={selectedStudentId} 
            studentName={studentInfo?.name || (isArabic ? "طالب" : "Student")}
            surahs={surahs} 
          />
        </div>
      </div>
    );
  }

  const linkedStudents = students?.filter(s => s.linked) || [];
  const unlinkedStudents = students?.filter(s => !s.linked) || [];
  
  linkedStudents.sort((a, b) => {
    if (a.due !== b.due) return b.due - a.due;
    return b.needsReview - a.needsReview;
  });

  const allStudents = [...linkedStudents, ...unlinkedStudents];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-xl">
             <Brain className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          {isArabic ? "المراجعة الذكية" : "Smart Review"}
        </h2>
        <p className="text-muted-foreground text-xs md:text-sm font-semibold mt-2">
          {isArabic ? "متابعة تطور الحفظ والمراجعة لطلابك بناءً على خوارزمية التكرار المتباعد. الطلاب المرتبطون بحسابات مستقلة تظهر إحصائياتهم هنا." : "Monitor memorization and review progress based on spaced repetition. Students linked to independent accounts will appear here."}
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white dark:bg-card p-4 md:p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-3 text-emerald-600 dark:text-emerald-500">
               <BookOpen className="w-5 h-5" />
               <h3 className="font-bold text-sm">{isArabic ? "آيات متقنة" : "Mastered"}</h3>
             </div>
             <p className="text-3xl md:text-4xl font-black text-foreground" data-testid="count-smart-mastered">{summary.memorized}</p>
          </div>
          <div className="bg-white dark:bg-card p-4 md:p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-500">
               <Activity className="w-5 h-5" />
               <h3 className="font-bold text-sm">{isArabic ? "قيد الحفظ" : "Learning"}</h3>
             </div>
             <p className="text-3xl md:text-4xl font-black text-foreground" data-testid="count-smart-learning">{summary.learning}</p>
          </div>
          <div className="bg-white dark:bg-card p-4 md:p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-500">
               <AlertCircle className="w-5 h-5" />
               <h3 className="font-bold text-sm">{isArabic ? "تحتاج مراجعة" : "Needs Review"}</h3>
             </div>
             <p className="text-3xl md:text-4xl font-black text-foreground" data-testid="count-smart-needs-review">{summary.needsReview}</p>
          </div>
          <div className="bg-white dark:bg-card p-4 md:p-5 rounded-2xl border border-border/60 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-3 text-red-600 dark:text-red-500">
               <Clock className="w-5 h-5" />
               <h3 className="font-bold text-sm">{isArabic ? "مستحقة اليوم" : "Due Today"}</h3>
             </div>
             <p className="text-3xl md:text-4xl font-black text-foreground" data-testid="count-smart-due">{summary.due}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg text-foreground">{isArabic ? "الطلاب" : "Students"}</h3>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
             {summary?.linkedCount} {isArabic ? "مرتبط" : "Linked"} / {summary?.rosterCount} {isArabic ? "طالب" : "Students"}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allStudents.map(student => (
             <button
               key={student.studentId}
               onClick={() => setSelectedStudentId(student.studentId)}
               className="bg-white dark:bg-card p-5 rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-start group flex flex-col"
               data-testid={`card-smart-student-${student.studentId}`}
             >
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shrink-0">
                     <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <h4 className="font-bold text-foreground truncate text-base group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors" data-testid="student-name">{student.name}</h4>
                     <p className="text-xs text-muted-foreground font-semibold truncate mt-0.5">
                        {student.studentClass || student.gradeLevel || (isArabic ? "غير محدد" : "Unspecified")}
                     </p>
                  </div>
                  {!student.linked && (
                     <div className="p-2 bg-muted rounded-xl text-muted-foreground" title={isArabic ? "غير مرتبط بحساب" : "Not linked"}>
                        <Link2Off className="w-4 h-4" />
                     </div>
                  )}
               </div>
               
               {student.linked ? (
                 <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/60 text-center mt-auto">
                   <div>
                     <p className="text-[10px] font-bold text-muted-foreground mb-1">{isArabic ? "متقن" : "Mastered"}</p>
                     <p className="text-sm font-black text-emerald-600 dark:text-emerald-400" data-testid="student-count-mastered">{student.memorized}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold text-muted-foreground mb-1">{isArabic ? "حفظ" : "Learn"}</p>
                     <p className="text-sm font-black text-blue-600 dark:text-blue-400" data-testid="student-count-learning">{student.learning}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold text-muted-foreground mb-1">{isArabic ? "مراجعة" : "Review"}</p>
                     <p className="text-sm font-black text-amber-600 dark:text-amber-400" data-testid="student-count-needs-review">{student.needsReview}</p>
                   </div>
                   <div className={cn("rounded-lg", student.due > 0 ? "bg-red-50 dark:bg-red-950/30" : "")}>
                     <p className="text-[10px] font-bold text-muted-foreground mb-1">{isArabic ? "مستحق" : "Due"}</p>
                     <p className={cn("text-sm font-black", student.due > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} data-testid="student-count-due">{student.due}</p>
                   </div>
                 </div>
               ) : (
                 <div className="pt-4 border-t border-border/60 mt-auto">
                   <p className="text-[11px] font-bold text-muted-foreground text-center bg-muted/30 py-2 rounded-xl">
                     {isArabic ? "الحساب غير مفعل للمراجعة الذكية" : "Account not activated for smart review"}
                   </p>
                 </div>
               )}
             </button>
          ))}
          {allStudents.length === 0 && (
            <div className="col-span-full p-12 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
               <Brain className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-3" />
               <p className="text-sm font-bold text-muted-foreground">{isArabic ? "لا يوجد طلاب" : "No students found"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
