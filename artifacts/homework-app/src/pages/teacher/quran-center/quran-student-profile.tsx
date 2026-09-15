import { useState } from "react";
import { 
  useGetQuranStudentSummary, 
  useUpdateQuranStudentProfile,
  useCreateQuranWard,
  useCreateQuranRecitation,
  QuranSurah,
  QuranWard,
  QuranWardInputMode
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { 
  Loader2, BookOpen, Activity, Target,
  Plus, CheckCircle2, History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuranStudentSummaryQueryKey } from "@workspace/api-client-react";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

export function QuranStudentProfileView({ 
  studentId, 
  studentName, 
  surahs 
}: { 
  studentId: number; 
  studentName: string;
  surahs: QuranSurah[];
}) {
  const { lang, dir } = useI18n();
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetQuranStudentSummary(studentId);
  const updateProfile = useUpdateQuranStudentProfile();

  const [isAssigning, setIsAssigning] = useState(false);
  const [recordingWardId, setRecordingWardId] = useState<number | null>(null);
  
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-emerald-800/40">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!summary) return null;

  const { profile, wards, recentRecitations } = summary;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Profile */}
      <div className="bg-white dark:bg-card p-4 md:p-6 rounded-3xl border border-border/60 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 relative overflow-hidden">
        <div className="hidden md:block absolute top-0 end-0 p-8 pointer-events-none opacity-5">
          <BookOpen className="w-32 h-32" />
        </div>
        
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center font-black text-2xl md:text-3xl shadow-md shrink-0">
          {studentName.charAt(0)}
        </div>
        
        <div className="flex-1 text-center md:text-start">
          <h2 className="text-xl md:text-3xl font-black text-foreground">{studentName}</h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">
              <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />
              {lang === "ar" ? "نسبة الإنجاز:" : "Progress:"} {profile.progressPercent}%
            </div>
            {profile.masteredAyahCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">
                <Target className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {lang === "ar" ? "الآيات المتقنة:" : "Mastered:"} {profile.masteredAyahCount}
              </div>
            )}
            {profile.currentSurahNumber && (
              <div className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">
                <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {lang === "ar" ? "السورة الحالية:" : "Current Surah:"} {surahs.find(s => s.number === profile.currentSurahNumber)?.arabicName || profile.currentSurahNumber}
                {profile.currentAyah ? ` (آية ${profile.currentAyah})` : ""}
              </div>
            )}
          </div>
        </div>
        
        <div className="w-full md:w-auto mt-2 md:mt-0">
          <button 
            onClick={() => setIsAssigning(true)}
            className="w-full md:w-auto justify-center px-4 md:px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700 hover:shadow transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {lang === "ar" ? "تعيين مهمة جديدة" : "Assign Ward"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Wards */}
        <div className="bg-white dark:bg-card p-6 rounded-3xl border border-border/60 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-foreground">
            <Activity className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-xl">{lang === "ar" ? "المهام الحالية" : "Active Wards"}</h3>
          </div>
          
          <div className="space-y-3">
            {wards.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                <p className="font-bold">{lang === "ar" ? "لا توجد مهام نشطة" : "No active wards"}</p>
              </div>
            ) : (
              wards.map(ward => (
                <div key={ward.id} className="p-4 border border-border/60 rounded-xl hover:border-emerald-200 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 bg-muted rounded-md text-[10px] font-black uppercase tracking-wider">
                      {ward.mode}
                    </span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md">
                      {ward.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground mb-1">{ward.surahName}</h4>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {lang === "ar" ? "الآيات:" : "Ayahs:"} {ward.startAyah} - {ward.endAyah}
                  </p>
                  
                  {ward.status !== "completed" && (
                    <div className="mt-4 pt-3 border-t border-border/60 flex justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setRecordingWardId(ward.id)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === "ar" ? "تسجيل تسميع" : "Record Recitation"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Recitations */}
        <div className="bg-white dark:bg-card p-6 rounded-3xl border border-border/60 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-foreground">
            <History className="w-5 h-5 text-emerald-500" />
            <h3 className="font-black text-xl">{lang === "ar" ? "سجل التسميع" : "Recitation History"}</h3>
          </div>
          
          <div className="space-y-3">
            {recentRecitations.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                <p className="font-bold">{lang === "ar" ? "لا يوجد سجل تسميع" : "No recitation history"}</p>
              </div>
            ) : (
              recentRecitations.map(rec => (
                <div key={rec.id} className="p-4 border border-border/60 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        rec.status === 'completed' ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                      <span className="font-bold text-sm text-foreground">{rec.recitedDate}</span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{rec.status}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {rec.memorizationScore != null && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold mb-0.5">{lang === "ar" ? "حفظ" : "Mem"}</p>
                        <p className="font-black text-emerald-700 dark:text-emerald-400">{rec.memorizationScore}%</p>
                      </div>
                    )}
                    {rec.recitationScore != null && (
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold mb-0.5">{lang === "ar" ? "تلاوة" : "Rec"}</p>
                        <p className="font-black text-emerald-700 dark:text-emerald-400">{rec.recitationScore}%</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isAssigning && (
        <AssignWardModal 
          studentId={studentId} 
          surahs={surahs} 
          onClose={() => setIsAssigning(false)} 
        />
      )}
      
      {recordingWardId != null && (
        <RecordRecitationModal
          wardId={recordingWardId}
          onClose={() => setRecordingWardId(null)}
        />
      )}
    </div>
  );
}

function AssignWardModal({ studentId, surahs, onClose }: { studentId: number, surahs: QuranSurah[], onClose: () => void }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const createWard = useCreateQuranWard();

  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const [mode, setMode] = useState<QuranWardInputMode>("memorization");
  const [surahNumber, setSurahNumber] = useState<number>(1);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(7);
  const [dueDate, setDueDate] = useState<string>(todayStr);
  
  const selectedSurah = surahs.find(s => s.number === surahNumber);

  const handleAssign = () => {
    const surah = surahs.find(s => s.number === surahNumber);
    if (!surah) return;
    if (!dueDate) {
      toast.error(lang === "ar" ? "تاريخ الاستحقاق مطلوب" : "Due date is required");
      return;
    }
    
    createWard.mutate({
      data: {
        studentId,
        mode,
        surahNumber,
        surahName: surah.arabicName,
        startAyah,
        endAyah,
        assignedDate: todayStr,
        dueDate: dueDate
      }
    }, {
      onSuccess: () => {
        toast.success(lang === "ar" ? "تم تعيين المهمة بنجاح" : "Ward assigned successfully");
        queryClient.invalidateQueries({ queryKey: getGetQuranStudentSummaryQueryKey(studentId) });
        onClose();
      },
      onError: () => {
        toast.error(lang === "ar" ? "فشل تعيين المهمة" : "Failed to assign ward");
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-border">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20">
          <DialogTitle className="font-black text-xl text-foreground">
            {lang === "ar" ? "تعيين مهمة جديدة" : "Assign New Ward"}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "النوع" : "Mode"}</label>
            <select 
              value={mode} 
              onChange={e => setMode(e.target.value as QuranWardInputMode)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
            >
              <option value="memorization">{lang === "ar" ? "حفظ" : "Memorization"}</option>
              <option value="review">{lang === "ar" ? "مراجعة" : "Review"}</option>
              <option value="recitation">{lang === "ar" ? "تلاوة" : "Recitation"}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "السورة" : "Surah"}</label>
            <select 
              value={surahNumber} 
              onChange={e => setSurahNumber(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
            >
              {surahs.map(s => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.arabicName} ({s.ayahCount} {lang === "ar" ? "آية" : "ayahs"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "من آية" : "Start Ayah"}</label>
              <input 
                type="number" 
                min={1} 
                max={selectedSurah?.ayahCount || 100}
                value={startAyah} 
                onChange={e => {
                  const val = Number(e.target.value);
                  setStartAyah(Math.min(Math.max(1, val), selectedSurah?.ayahCount || val));
                }}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "إلى آية" : "End Ayah"}</label>
              <input 
                type="number" 
                min={1} 
                max={selectedSurah?.ayahCount || 100}
                value={endAyah} 
                onChange={e => {
                  const val = Number(e.target.value);
                  setEndAyah(Math.min(Math.max(1, val), selectedSurah?.ayahCount || val));
                }}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</label>
            <input 
              type="date"
              required
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <DialogFooter className="p-6 border-t border-border/60 bg-muted/20 sm:justify-end gap-3 flex-row justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button 
            onClick={handleAssign}
            disabled={createWard.isPending || !dueDate}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createWard.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {lang === "ar" ? "حفظ وتعيين" : "Save and Assign"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function RecordRecitationModal({ wardId, onClose }: { wardId: number, onClose: () => void }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const createRecitation = useCreateQuranRecitation();

  const [status, setStatus] = useState<"completed" | "needs_review" | "absent" | "not_recited">("completed");
  const [memorizationScore, setMemorizationScore] = useState<number>(100);
  const [recitationScore, setRecitationScore] = useState<number>(100);
  const [teacherNote, setTeacherNote] = useState("");

  const handleSave = () => {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    createRecitation.mutate({
      id: wardId,
      data: {
        status,
        memorizationScore: (status === "completed" || status === "needs_review") ? memorizationScore : null,
        recitationScore: (status === "completed" || status === "needs_review") ? recitationScore : null,
        teacherNote,
        recitedDate: today,
      }
    }, {
      onSuccess: () => {
        toast.success(lang === "ar" ? "تم تسجيل التسميع بنجاح" : "Recitation recorded successfully");
        queryClient.invalidateQueries(); // invalidate all to catch summary and dashboard
        onClose();
      },
      onError: () => {
        toast.error(lang === "ar" ? "فشل تسجيل التسميع" : "Failed to record recitation");
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-border">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20">
          <DialogTitle className="font-black text-xl text-foreground">
            {lang === "ar" ? "تسجيل تسميع" : "Record Recitation"}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "حالة التسميع" : "Status"}</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
            >
              <option value="completed">{lang === "ar" ? "مكتمل (مجتاز)" : "Completed"}</option>
              <option value="needs_review">{lang === "ar" ? "يحتاج مراجعة" : "Needs Review"}</option>
              <option value="not_recited">{lang === "ar" ? "لم يسمّع" : "Did Not Recite"}</option>
              <option value="absent">{lang === "ar" ? "غائب" : "Absent"}</option>
            </select>
          </div>
          
          {(status === "completed" || status === "needs_review") && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "درجة الحفظ (%)" : "Memorization Score (%)"}</label>
                <input 
                  type="number" 
                  min={0} max={100} 
                  value={memorizationScore} 
                  onChange={e => setMemorizationScore(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "درجة التلاوة والتجويد (%)" : "Recitation Score (%)"}</label>
                <input 
                  type="number" 
                  min={0} max={100} 
                  value={recitationScore} 
                  onChange={e => setRecitationScore(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "ملاحظات المعلم" : "Teacher Note"}</label>
            <textarea 
              value={teacherNote}
              onChange={e => setTeacherNote(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none h-20"
              placeholder={lang === "ar" ? "أضف ملاحظة للطالب..." : "Add note for student..."}
            />
          </div>
        </div>
        
        <DialogFooter className="p-6 border-t border-border/60 bg-muted/20 sm:justify-end gap-3 flex-row justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button 
            onClick={handleSave}
            disabled={createRecitation.isPending}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createRecitation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {lang === "ar" ? "تسجيل" : "Record"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
