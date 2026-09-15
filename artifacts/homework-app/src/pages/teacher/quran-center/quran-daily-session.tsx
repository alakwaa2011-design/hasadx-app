import { useState, useEffect } from "react";
import { 
  QuranCircle, QuranSurah, QuranWard,
  useGetQuranStudentSummary, useCreateQuranRecitation,
  getGetQuranStudentSummaryQueryKey,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { X, Loader2, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function QuranDailySession({ 
  circle, 
  surahs, 
  onClose 
}: { 
  circle: QuranCircle; 
  surahs: QuranSurah[]; 
  onClose: () => void;
}) {
  const { lang, dir } = useI18n();
  const isArabic = lang === "ar";
  const [currentIndex, setCurrentIndex] = useState(0);
  const student = circle.members[currentIndex];
  
  const { data: summary, isLoading } = useGetQuranStudentSummary(student?.id, {
    query: {
      enabled: !!student,
      queryKey: getGetQuranStudentSummaryQueryKey(student?.id),
    }
  });
  
  const activeWards = summary?.wards.filter((ward) =>
    ward.status !== "completed" && (ward.mode === "memorization" || ward.mode === "review")
  ) ?? [];
  
  const [recordedWardIds, setRecordedWardIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setRecordedWardIds(new Set());
  }, [currentIndex]);

  useEffect(() => {
    if (activeWards.length > 0 && activeWards.every(w => recordedWardIds.has(w.id))) {
       const timer = setTimeout(() => {
          if (currentIndex < circle.members.length - 1) {
             setCurrentIndex(i => i + 1);
          } else {
             toast.success(isArabic ? "اكتمل تسميع جميع الطلاب!" : "All students completed!");
             onClose();
          }
       }, 1500);
       return () => clearTimeout(timer);
    }
    return undefined;
  }, [recordedWardIds, activeWards, currentIndex, circle.members.length, isArabic, onClose]);

  if (!student) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col animate-in fade-in zoom-in-95 duration-200">
       <header className="flex items-center justify-between p-4 border-b border-border/60 bg-card shadow-sm">
         <div className="flex items-center gap-3">
           <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
             <X className="w-5 h-5 text-muted-foreground" />
           </button>
           <h2 className="font-black text-lg text-foreground">
             {isArabic ? "جلسة التسميع:" : "Session:"} {circle.name}
           </h2>
         </div>
         <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
            <span className="text-sm font-bold text-foreground">
              {isArabic ? "طالب" : "Student"} {currentIndex + 1} / {circle.members.length}
            </span>
         </div>
       </header>
       
       <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-muted/10">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
               <div className="w-24 h-24 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-4 shadow-sm border border-emerald-200">
                  {student.name.charAt(0)}
               </div>
               <h3 className="text-3xl font-black text-foreground">{student.name}</h3>
               {isLoading && <Loader2 className="w-5 h-5 animate-spin mx-auto mt-4 text-emerald-500" />}
            </div>
            
            {!isLoading && summary && (
               <div className="space-y-4">
                 {activeWards.length === 0 ? (
                   <div className="text-center p-12 bg-white dark:bg-card rounded-3xl border border-dashed border-border shadow-sm">
                     <p className="font-bold text-lg text-muted-foreground">
                       {isArabic ? "لا توجد مهام نشطة للطالب" : "No active wards for student"}
                     </p>
                     <button 
                       onClick={() => {
                         if (currentIndex < circle.members.length - 1) setCurrentIndex(i => i + 1);
                         else onClose();
                       }}
                       className="mt-4 px-6 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold hover:bg-emerald-200 transition-colors"
                     >
                       {isArabic ? "انتقل للطالب التالي" : "Next Student"}
                     </button>
                   </div>
                 ) : (
                   activeWards.map(ward => (
                     <SessionWardCard 
                       key={ward.id} 
                       ward={ward} 
                       isArabic={isArabic}
                       onRecorded={() => setRecordedWardIds(prev => new Set(prev).add(ward.id))} 
                     />
                   ))
                 )}
               </div>
            )}
          </div>
       </div>
       
       <footer className="p-4 border-t border-border/60 bg-card flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
         <button 
           onClick={() => setCurrentIndex(i => i - 1)} 
           disabled={currentIndex === 0} 
           className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors border border-transparent hover:border-border"
         >
           {dir === "rtl" ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
           {isArabic ? "السابق" : "Prev"}
         </button>
         <button 
           onClick={() => {
             if (currentIndex < circle.members.length - 1) setCurrentIndex(i => i + 1);
             else onClose();
           }} 
           className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors"
         >
           {currentIndex === circle.members.length - 1 
             ? (isArabic ? "إنهاء الجلسة" : "End Session")
             : (isArabic ? "الطالب التالي" : "Next Student")}
           {currentIndex < circle.members.length - 1 && (dir === "rtl" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)}
         </button>
       </footer>
    </div>
  )
}

function SessionWardCard({ ward, isArabic, onRecorded }: { ward: QuranWard, isArabic: boolean, onRecorded: () => void }) {
  const createRecitation = useCreateQuranRecitation();
  const queryClient = useQueryClient();
  
  const [status, setStatus] = useState<"completed" | "needs_review" | "absent" | "not_recited">("completed");
  const [memorizationScore, setMemorizationScore] = useState<number>(100);
  const [recitationScore, setRecitationScore] = useState<number>(100);
  const [isSaved, setIsSaved] = useState(false);
  
  const handleSave = () => {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    createRecitation.mutate({
      id: ward.id,
      data: {
        status,
        memorizationScore: (status === "completed" || status === "needs_review") ? memorizationScore : null,
        recitationScore: (status === "completed" || status === "needs_review") ? recitationScore : null,
        recitedDate: today,
      }
    }, {
      onSuccess: () => {
        setIsSaved(true);
        onRecorded();
        queryClient.invalidateQueries(); 
      },
      onError: () => {
        toast.error(isArabic ? "تعذر حفظ النتيجة" : "Failed to save result");
      }
    });
  };
  
  if (isSaved) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 flex items-center justify-between transform transition-all scale-[0.98] opacity-80">
         <div>
           <h4 className="font-black text-xl text-emerald-800 dark:text-emerald-300 mb-1">{ward.surahName}</h4>
           <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80">
             {isArabic ? "تم حفظ النتيجة بنجاح" : "Result saved successfully"}
           </p>
         </div>
         <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-card border border-border/80 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
       <div className="flex items-center justify-between mb-5">
         <div>
           <div className="flex items-center gap-3 mb-1.5">
             <span className={cn(
               "px-3 py-1 rounded-lg text-xs font-black",
               ward.mode === 'memorization' 
                 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" 
                 : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
             )}>
               {ward.mode === 'memorization' ? (isArabic ? 'حفظ' : 'Memo') : (isArabic ? 'مراجعة' : 'Review')}
             </span>
             <h4 className="font-black text-2xl text-foreground">{ward.surahName}</h4>
           </div>
           <p className="text-sm font-bold text-muted-foreground">
             {isArabic ? "الآيات" : "Ayahs"} {ward.startAyah} - {ward.endAyah}
           </p>
         </div>
       </div>
       
       <div className="space-y-5">
         <div className="flex bg-muted/60 p-1 rounded-xl">
           {[
             { id: 'completed', label: isArabic ? 'مكتمل' : 'Completed' },
             { id: 'needs_review', label: isArabic ? 'يحتاج مراجعة' : 'Needs Review' },
              { id: 'not_recited', label: isArabic ? 'لم يسمّع' : 'Not Recited' },
             { id: 'absent', label: isArabic ? 'غائب' : 'Absent' }
           ].map(opt => (
             <button
               key={opt.id}
               onClick={() => setStatus(opt.id as any)}
               className={cn(
                 "flex-1 py-2 text-xs md:text-sm font-black rounded-lg transition-all",
                 status === opt.id 
                   ? "bg-white dark:bg-card shadow-sm text-foreground scale-100 border border-border/50" 
                   : "text-muted-foreground hover:text-foreground scale-95 hover:scale-100 border border-transparent"
               )}
             >
               {opt.label}
             </button>
           ))}
         </div>
         
         {(status === 'completed' || status === 'needs_review') && (
           <div className="flex gap-4">
             <div className="flex-1 bg-muted/30 p-3 rounded-2xl border border-border/50">
               <label className="block text-xs font-black text-muted-foreground mb-2 text-center">
                 {isArabic ? "درجة الحفظ" : "Memo Score"}
               </label>
               <input 
                 type="number" min={0} max={100} 
                 value={memorizationScore} 
                 onChange={e => setMemorizationScore(Number(e.target.value))}
                 className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-xl font-black outline-none focus:border-emerald-500 text-center shadow-sm"
               />
             </div>
             <div className="flex-1 bg-muted/30 p-3 rounded-2xl border border-border/50">
               <label className="block text-xs font-black text-muted-foreground mb-2 text-center">
                 {isArabic ? "درجة التلاوة" : "Recitation Score"}
               </label>
               <input 
                 type="number" min={0} max={100} 
                 value={recitationScore} 
                 onChange={e => setRecitationScore(Number(e.target.value))}
                 className="w-full bg-white dark:bg-card border border-border rounded-xl px-3 py-2.5 text-xl font-black outline-none focus:border-emerald-500 text-center shadow-sm"
               />
             </div>
           </div>
         )}
         
         <button 
           onClick={handleSave}
           disabled={createRecitation.isPending}
           className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-base shadow-sm hover:bg-emerald-700 hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
         >
           {createRecitation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (isArabic ? "حفظ النتيجة" : "Save Result")}
         </button>
       </div>
    </div>
  )
}
