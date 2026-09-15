import { useState } from "react";
import { 
  QuranSubmissionReviewItem, 
  useGetQuranSubmissionAudioUrl, 
  useReviewQuranSubmission,
  getListQuranSubmissionReviewQueueQueryKey,
  getGetQuranReviewQueueQueryKey,
  getGetQuranJourneyQueryKey
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function QuranSubmissionReviewModal({ 
  submission, 
  onClose 
}: { 
  submission: QuranSubmissionReviewItem; 
  onClose: () => void 
}) {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const isArabic = lang === "ar";
  
  const { data: audioData, isLoading: isLoadingAudio, isError: isAudioError } = useGetQuranSubmissionAudioUrl(submission.id);
  const reviewSubmission = useReviewQuranSubmission();

  const [status, setStatus] = useState<"reviewed" | "needs_resubmission">("reviewed");
  const [memorizationScore, setMemorizationScore] = useState<number>(100);
  const [recitationScore, setRecitationScore] = useState<number>(100);
  const [feedback, setFeedback] = useState("");

  const handleSave = () => {
    reviewSubmission.mutate({
      id: submission.id,
      data: {
        status,
        memorizationScore: status === "reviewed" ? memorizationScore : null,
        recitationScore: status === "reviewed" ? recitationScore : null,
        feedback: feedback || null
      }
    }, {
      onSuccess: () => {
        toast.success(isArabic ? "تم حفظ المراجعة بنجاح" : "Review saved successfully");
        queryClient.invalidateQueries({ queryKey: getListQuranSubmissionReviewQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetQuranReviewQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetQuranJourneyQueryKey() });
        onClose();
      },
      onError: () => {
        toast.error(isArabic ? "فشل حفظ المراجعة" : "Failed to save review");
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-border">
        <DialogHeader className="p-6 border-b border-border/60 bg-muted/20">
          <DialogTitle className="font-black text-xl text-foreground">
            {isArabic ? "مراجعة التسميع المسجل" : "Review Audio Submission"}
          </DialogTitle>
          <div className="text-sm font-bold text-muted-foreground mt-1">
            {submission.studentName} • {submission.surahName} (الآيات {submission.startAyah}-{submission.endAyah})
          </div>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          <div className="bg-background rounded-xl p-4 border border-border">
            <h4 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
              {isArabic ? "التسجيل الصوتي" : "Audio Recording"}
            </h4>
            
            {isLoadingAudio ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : isAudioError || !audioData?.url ? (
              <div className="flex items-center justify-center gap-2 py-4 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-bold">{isArabic ? "تعذر تحميل التسجيل" : "Could not load recording"}</span>
              </div>
            ) : (
              <audio src={audioData.url} controls className="w-full h-12" />
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "حالة المراجعة" : "Review Status"}</label>
              <select 
                value={status} 
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              >
                <option value="reviewed">{isArabic ? "مكتمل (تمت المراجعة)" : "Reviewed"}</option>
                <option value="needs_resubmission">{isArabic ? "يحتاج إعادة تسميع" : "Needs Resubmission"}</option>
              </select>
            </div>
            
            {status === "reviewed" && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "درجة الحفظ (%)" : "Memorization Score (%)"}</label>
                  <input 
                    type="number" 
                    min={0} max={100} 
                    value={memorizationScore} 
                    onChange={e => setMemorizationScore(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "درجة التلاوة والتجويد (%)" : "Recitation Score (%)"}</label>
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
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "ملاحظات المعلم (اختياري)" : "Teacher Feedback (Optional)"}</label>
              <textarea 
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-none h-20"
                placeholder={isArabic ? "أضف ملاحظة للطالب..." : "Add feedback for student..."}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-6 border-t border-border/60 bg-muted/20 sm:justify-end gap-3 flex-row justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button 
            onClick={handleSave}
            disabled={reviewSubmission.isPending}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {reviewSubmission.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isArabic ? "حفظ المراجعة" : "Save Review"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}