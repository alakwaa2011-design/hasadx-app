import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetQuranStudentSummary, 
  useUpdateQuranStudentProfile,
  useAssignQuranStudentTask,
  useCreateQuranRecitation,
  useListTeacherQuranMemorizationItems,
  useListTeacherQuranMemorizationHistory,
  QuranSurah,
  QuranWard,
  QuranWardRangeInput,
  TeacherQuranMemorizationHistoryEvent,
  QuranMemorizationItem
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { 
  Loader2, BookOpen, Activity, Target,
  Plus, CheckCircle2, History, Brain, XCircle, Link2Off, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuranStudentSummaryQueryKey } from "@workspace/api-client-react";
import { quranDateLabel, quranModeLabel, quranStatusLabel } from "./quran-labels";
import { QuranTaskAssignerModal } from "./quran-task-assigner";

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
  const isArabic = lang === "ar";
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useGetQuranStudentSummary(studentId);
  const updateProfile = useUpdateQuranStudentProfile();

  const [activeTab, setActiveTab] = useState<"wards" | "smart_review">("wards");
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
  const memorizationWards = wards.filter((ward) => ward.mode === "memorization");
  const reviewWards = wards.filter((ward) => ward.mode === "review");

  return (
    <div className="flex flex-col gap-4">
      {/* Header Profile */}
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-white p-4 shadow-sm dark:bg-card sm:flex-row sm:items-center md:p-5">
        <div className="hidden md:block absolute top-0 end-0 p-8 pointer-events-none opacity-5">
          <BookOpen className="w-32 h-32" />
        </div>
        
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-black text-white shadow-sm md:h-16 md:w-16 md:text-2xl">
          {studentName.charAt(0)}
        </div>
        
        <div className="min-w-0 flex-1 text-center sm:text-start">
          <h2 className="truncate text-xl font-black text-foreground md:text-2xl">{studentName}</h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
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
        
        <div className="w-full sm:w-auto">
          <button 
            onClick={() => setIsAssigning(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {lang === "ar" ? "تعيين مهمة جديدة" : "Assign Ward"}
          </button>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex space-x-2 rtl:space-x-reverse border-b border-border/60 px-2">
          <button
            onClick={() => setActiveTab("wards")}
            data-testid="tab-wards"
            className={cn("px-4 py-3 font-black text-sm border-b-2 transition-colors", activeTab === "wards" ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {isArabic ? "المهام والتسميع" : "Wards & Recitations"}
          </button>
          <button
            onClick={() => setActiveTab("smart_review")}
            data-testid="tab-smart-review"
            className={cn("px-4 py-3 font-black text-sm border-b-2 transition-colors flex items-center gap-2", activeTab === "smart_review" ? "border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <Brain className="w-4 h-4" />
            {isArabic ? "المراجعة الذكية" : "Smart Review"}
          </button>
        </div>

        {activeTab === "wards" ? (
          <div className="space-y-4 mt-4">
            {/* One clear assignment card with memorization and review together */}
            <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm dark:bg-card md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 text-foreground">
                <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black md:text-xl">{lang === "ar" ? "المهام الحالية" : "Active Wards"}</h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {wards.length} {lang === "ar" ? "مهام" : "tasks"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {wards.length === 0 ? (
                  <div className="col-span-full text-center p-8 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                    <p className="font-bold">{lang === "ar" ? "لا توجد مهام نشطة" : "No active wards"}</p>
                  </div>
                ) : (
                  <>
                    <WardColumn
                      title={lang === "ar" ? "الحفظ الجديد" : "New memorization"}
                      emptyLabel={lang === "ar" ? "لم يحدد حفظ جديد" : "No memorization assigned"}
                      wards={memorizationWards}
                      surahs={surahs}
                      isArabic={isArabic}
                      onRecord={setRecordingWardId}
                    />
                    <WardColumn
                      title={lang === "ar" ? "المراجعة" : "Review"}
                      emptyLabel={lang === "ar" ? "لم تحدد مراجعة" : "No review assigned"}
                      wards={reviewWards}
                      surahs={surahs}
                      isArabic={isArabic}
                      onRecord={setRecordingWardId}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Recent Recitations */}
            <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm dark:bg-card md:p-5">
              <div className="mb-4 flex items-center gap-2 text-foreground">
                <History className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-black md:text-xl">{lang === "ar" ? "سجل التسميع" : "Recitation History"}</h3>
              </div>

              <div className="space-y-3">
                {recentRecitations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-muted-foreground">
                    <p className="text-sm font-bold">{lang === "ar" ? "لا يوجد سجل تسميع حتى الآن" : "No recitation history yet"}</p>
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
                        <p className="text-xs font-bold text-muted-foreground">{quranStatusLabel(rec.status, isArabic)}</p>
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
        ) : (
          <SmartReviewTab studentId={studentId} surahs={surahs} isArabic={isArabic} />
        )}
      </div>

      {isAssigning && (
        <AssignStudentTaskWrapper
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

function WardColumn({
  title,
  emptyLabel,
  wards,
  isArabic,
  surahs,
  onRecord,
}: {
  title: string;
  emptyLabel: string;
  wards: QuranWard[];
  isArabic: boolean;
  surahs: QuranSurah[];
  onRecord: (wardId: number) => void;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-300">{title}</h4>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-black text-muted-foreground">
          {wards.length}
        </span>
      </div>
      <div className="space-y-2">
        {wards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-6 text-center text-xs font-bold text-muted-foreground">
            {emptyLabel}
          </p>
        ) : wards.map((ward) => {
          const surah = surahs.find(s => s.arabicName === ward.surahName);
          const surahNum = surah ? surah.number : 1;
          const readerUrl = `/teacher/quran-reader/${surahNum}?startAyah=${ward.startAyah}&endAyah=${ward.endAyah}&wardId=${ward.id}&mode=${ward.mode}&view=reader`;
          return (
          <div key={ward.id} className="rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-emerald-200 dark:hover:border-emerald-900">
            <div className="flex items-start justify-between gap-3">
              <Link href={readerUrl} className="min-w-0 flex-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <p className="truncate font-black text-foreground">{ward.surahName}</p>
                <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                  {isArabic ? "من الآية" : "Ayahs"} {ward.startAyah}–{ward.endAyah}
                </p>
              </Link>
              <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {quranStatusLabel(ward.status, isArabic)}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5">
              <span className="text-[11px] font-bold text-muted-foreground">
                {isArabic ? "الاستحقاق:" : "Due:"} {quranDateLabel(ward.dueDate, isArabic)}
              </span>
              <div className="flex shrink-0 gap-1.5">
                <Link href={readerUrl} className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                  <BookOpen className="h-3.5 w-3.5" />
                  {isArabic ? "فتح" : "Open"}
                </Link>
                {ward.status !== "completed" && (
                  <button
                    onClick={() => onRecord(ward.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-black text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isArabic ? "تسجيل" : "Record"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )})}
      </div>
    </section>
  );
}


function AssignStudentTaskWrapper({ studentId, surahs, onClose }: { studentId: number, surahs: QuranSurah[], onClose: () => void }) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const assignTask = useAssignQuranStudentTask();
  const [requestId] = useState(() => `assign-student-${studentId}-${Math.random().toString(36).slice(2)}`);

  const handleAssign = async (data: { memorization?: QuranWardRangeInput[], review?: QuranWardRangeInput[], dueDate: string, notes?: string }) => {
    try {
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      await assignTask.mutateAsync({
        studentId,
        data: {
          requestId,
          assignedDate: localDate,
          dueDate: data.dueDate,
          memorization: data.memorization,
          review: data.review,
          notes: data.notes || null,
        }
      });
      toast.success(lang === "ar" ? "تم تعيين المهمة بنجاح" : "Assignment saved");
      queryClient.invalidateQueries({ queryKey: getGetQuranStudentSummaryQueryKey(studentId) });
      onClose();
    } catch {
      toast.error(lang === "ar" ? "تعذر تعيين المهمة" : "Failed to assign task");
    }
  };

  return (
    <QuranTaskAssignerModal
      title={lang === "ar" ? "تعيين مهمة جديدة" : "Assign New Ward"}
      surahs={surahs}
      onClose={onClose}
      onAssign={handleAssign}
      isPending={assignTask.isPending}
    />
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

function SmartReviewTab({ studentId, surahs, isArabic }: { studentId: number, surahs: QuranSurah[], isArabic: boolean }) {
  const { data: itemsResponse, isLoading: loadingItems, isError: errorItems, refetch: refetchItems } = useListTeacherQuranMemorizationItems(studentId);
  const { data: historyEvents, isLoading: loadingHistory, isError: errorHistory, refetch: refetchHistory } = useListTeacherQuranMemorizationHistory(studentId);

  if (loadingItems || loadingHistory) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600/50" /></div>;
  }

  if (errorItems || errorHistory) {
    return (
      <div className="p-8 md:p-12 text-center bg-white dark:bg-card border border-border/60 shadow-sm rounded-2xl m-2">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h3 className="font-black text-lg text-foreground mb-2">
          {isArabic ? "تعذر تحميل التفاصيل" : "Failed to load details"}
        </h3>
        <button
          onClick={() => { refetchItems(); refetchHistory(); }}
          data-testid="button-retry-student-details"
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 mx-auto"
        >
          {isArabic ? "إعادة المحاولة" : "Try Again"}
        </button>
      </div>
    );
  }

  const items = itemsResponse?.items || [];
  const history = historyEvents || [];
  const isLinked = itemsResponse?.student?.linked;

  if (!isLinked) {
    return (
      <div className="p-8 md:p-12 text-center bg-white dark:bg-card border border-border/60 shadow-sm rounded-2xl m-2">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
           <Link2Off className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="font-black text-lg text-foreground mb-1">
          {isArabic ? "المراجعة الذكية غير مفعلة" : "Smart Review not active"}
        </h3>
        <p className="font-bold text-sm text-muted-foreground max-w-sm mx-auto">
          {isArabic ? "لم يقم هذا الطالب بربط حسابه المستقل بحساب المركز حتى الآن. تتبع المراجعة الذكية يعمل تلقائياً عند قيام الطالب بالحفظ والمراجعة من حسابه." : "This student hasn't linked their independent account to the center yet. Smart review tracking works automatically when the student practices from their account."}
        </p>
      </div>
    );
  }

  const memorized = items.filter(i => i.status === "memorized");
  const learning = items.filter(i => i.status === "learning");
  const needsReview = items.filter(i => i.status === "needs_review");

  const surahsWithItems = surahs.filter(s => items.some(i => i.surahNumber === s.number)).sort((a, b) => a.number - b.number);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "memorized": return isArabic ? "متقنة" : "Memorized";
      case "learning": return isArabic ? "قيد الحفظ" : "Learning";
      case "needs_review": return isArabic ? "تحتاج مراجعة" : "Needs Review";
      default: return status;
    }
  };

  const getHistoryItemLabel = (event: TeacherQuranMemorizationHistoryEvent) => {
    const item = items.find(i => i.id === event.memorizationItemId);
    if (!item) return isArabic ? "آية غير معروفة" : "Unknown ayah";
    const surah = surahs.find(s => s.number === item.surahNumber);
    const surahName = surah?.arabicName || surah?.number;
    return `${surahName}, ${isArabic ? "آية" : "Ayah"} ${item.ayahNumber}`;
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.surahNumber !== b.surahNumber) return a.surahNumber - b.surahNumber;
    return a.ayahNumber - b.ayahNumber;
  });

  const getAyahRanges = (ayahs: number[]) => {
    if (ayahs.length === 0) return "";
    const sorted = [...ayahs].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-4">
      {/* Ayah States */}
      <div className="space-y-4">
        <h3 className="font-black text-lg flex items-center gap-2 text-foreground">
           <Brain className="w-5 h-5 text-emerald-600" />
           {isArabic ? "حالة الآيات" : "Ayah States"}
        </h3>

        <div className="grid grid-cols-3 gap-2 md:gap-3">
           <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 text-center shadow-sm">
             <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">{isArabic ? "متقنة" : "Mastered"}</p>
             <p className="text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-300">{memorized.length}</p>
           </div>
           <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900 text-center shadow-sm">
             <p className="text-xs font-bold text-blue-800 dark:text-blue-400 mb-1">{isArabic ? "قيد الحفظ" : "Learning"}</p>
             <p className="text-xl md:text-2xl font-black text-blue-900 dark:text-blue-300">{learning.length}</p>
           </div>
           <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900 text-center shadow-sm">
             <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">{isArabic ? "تحتاج مراجعة" : "Needs Review"}</p>
             <p className="text-xl md:text-2xl font-black text-amber-900 dark:text-amber-300">{needsReview.length}</p>
           </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 rtl:pl-2 rtl:pr-0">
           {surahsWithItems.map(surah => {
              const sItems = items.filter(i => i.surahNumber === surah.number);
              const sMemorized = sItems.filter(i => i.status === "memorized").map(i => i.ayahNumber);
              const sLearning = sItems.filter(i => i.status === "learning").map(i => i.ayahNumber);
              const sReview = sItems.filter(i => i.status === "needs_review").map(i => i.ayahNumber);

              return (
                 <div key={surah.number} className="p-4 border border-border/60 rounded-xl bg-white dark:bg-card shadow-sm">
                    <h4 className="font-black text-base text-foreground mb-3">{surah.arabicName}</h4>
                    <div className="space-y-2.5 text-xs font-bold">
                       {sMemorized.length > 0 && (
                          <div className="flex gap-2.5 items-start">
                             <span className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" />
                             <span className="text-muted-foreground w-16 shrink-0">{isArabic ? "متقن:" : "Mastered:"}</span>
                             <span className="text-foreground leading-relaxed">{getAyahRanges(sMemorized)}</span>
                          </div>
                       )}
                       {sReview.length > 0 && (
                          <div className="flex gap-2.5 items-start">
                             <span className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />
                             <span className="text-muted-foreground w-16 shrink-0">{isArabic ? "مراجعة:" : "Review:"}</span>
                             <span className="text-foreground leading-relaxed">{getAyahRanges(sReview)}</span>
                          </div>
                       )}
                       {sLearning.length > 0 && (
                          <div className="flex gap-2.5 items-start">
                             <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                             <span className="text-muted-foreground w-16 shrink-0">{isArabic ? "قيد الحفظ:" : "Learning:"}</span>
                             <span className="text-foreground leading-relaxed">{getAyahRanges(sLearning)}</span>
                          </div>
                       )}
                    </div>
                 </div>
              )
           })}
           {surahsWithItems.length === 0 && (
             <div className="text-center p-8 bg-muted/20 border border-dashed border-border rounded-xl">
               <p className="text-sm font-bold text-muted-foreground">{isArabic ? "لا توجد آيات في المراجعة الذكية" : "No ayahs in smart review"}</p>
             </div>
           )}
        </div>
      </div>

      {/* Detailed Ayah Rows */}
      <div className="space-y-4 lg:col-span-2">
        <h3 className="font-black text-lg text-foreground">{isArabic ? "تفاصيل الآيات" : "Ayah Details"}</h3>
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-white dark:bg-card shadow-sm max-h-[400px] overflow-y-auto">
          <table className="w-full text-start text-sm">
            <thead className="sticky top-0 border-b border-border/60 bg-muted/90 backdrop-blur-md text-xs font-bold text-muted-foreground z-10">
              <tr>
                <th className="px-4 py-3 text-start">{isArabic ? "الآية" : "Ayah"}</th>
                <th className="px-4 py-3 text-start">{isArabic ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3 text-start">{isArabic ? "المراجعة القادمة" : "Next Review"}</th>
                <th className="px-4 py-3 text-start">{isArabic ? "الفاصل (أيام)" : "Interval (Days)"}</th>
                <th className="px-4 py-3 text-start">{isArabic ? "آخر تقييم" : "Last Assessed"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-semibold text-foreground">
              {sortedItems.map(item => {
                 const surahName = surahs.find(s => s.number === item.surahNumber)?.arabicName || item.surahNumber;
                 return (
                   <tr key={item.id} data-testid={`row-ayah-detail-${item.id}`} className="hover:bg-muted/30">
                     <td className="px-4 py-3 whitespace-nowrap">{surahName}, {item.ayahNumber}</td>
                     <td className="px-4 py-3 whitespace-nowrap">
                       <span className={cn(
                          item.status === "memorized" ? "text-emerald-600 dark:text-emerald-400" :
                          item.status === "learning" ? "text-blue-600 dark:text-blue-400" :
                          "text-amber-600 dark:text-amber-400"
                       )}>{getStatusLabel(item.status)}</span>
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap">{new Date(item.nextReviewDate).toLocaleDateString(isArabic ? 'ar-KW' : 'en-US')}</td>
                     <td className="px-4 py-3 whitespace-nowrap">{item.intervalDays}</td>
                     <td className="px-4 py-3 whitespace-nowrap">
                       {item.lastAssessedAt
                          ? new Date(item.lastAssessedAt).toLocaleDateString(isArabic ? 'ar-KW' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : "-"}
                     </td>
                   </tr>
                 )
              })}
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {isArabic ? "لا توجد آيات في المراجعة الذكية" : "No ayahs in smart review"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="space-y-4 lg:col-span-2">
        <h3 className="font-black text-lg flex items-center gap-2 text-foreground">
           <History className="w-5 h-5 text-emerald-600" />
           {isArabic ? "سجل التقييمات المستقلة" : "Independent Assessment History"}
        </h3>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 rtl:pl-2 rtl:pr-0">
          {history.map(event => (
             <div key={event.id} data-testid={`row-history-${event.id}`} className="p-4 border border-border/60 rounded-xl bg-white dark:bg-card flex items-start gap-3 shadow-sm">
                <div className="mt-0.5">
                   {event.passed ? (
                     <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                   ) : (
                     <XCircle className="w-5 h-5 text-amber-500" />
                   )}
                </div>
                <div className="flex-1 min-w-0">
                   <p className="font-bold text-sm text-foreground truncate mb-1">
                     {getHistoryItemLabel(event)}
                   </p>
                   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                     <span>
                       {new Date(event.assessedAt).toLocaleDateString(isArabic ? 'ar-KW' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                     </span>
                     <span className="w-1 h-1 rounded-full bg-border" />
                     <span>
                       {isArabic ? "النتيجة:" : "Result:"}{" "}
                       <span className={cn(
                          event.status === "memorized" ? "text-emerald-600 dark:text-emerald-400" :
                          event.status === "learning" ? "text-blue-600 dark:text-blue-400" :
                          "text-amber-600 dark:text-amber-400"
                       )}>
                         {getStatusLabel(event.status)}
                       </span>
                     </span>
                     <span className="w-1 h-1 rounded-full bg-border" />
                     <span>{isArabic ? "الفاصل:" : "Interval:"} {event.intervalDays} {isArabic ? "أيام" : "days"}</span>
                     <span className="w-1 h-1 rounded-full bg-border" />
                     <span>{isArabic ? "المراجعة:" : "Next Review:"} {new Date(event.nextReviewDate).toLocaleDateString(isArabic ? 'ar-KW' : 'en-US')}</span>
                     <span className="w-1 h-1 rounded-full bg-border" />
                     <span>{isArabic ? "التقييم:" : "Passed:"} {event.passed ? (isArabic ? "مجتاز" : "Passed") : (isArabic ? "إخفاق" : "Failed")}</span>
                   </div>
                </div>
             </div>
          ))}
          {history.length === 0 && (
             <div className="text-center p-8 bg-muted/20 border border-dashed border-border rounded-xl">
               <p className="text-sm font-bold text-muted-foreground">{isArabic ? "لا يوجد سجل تقييمات" : "No assessment history"}</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
