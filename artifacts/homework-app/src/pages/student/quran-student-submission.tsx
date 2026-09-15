import { useState, useRef, useEffect } from 'react';
import { 
  useListMyQuranSubmissions, 
  usePrepareQuranSubmissionUpload, 
  useFinalizeQuranSubmission,
  QuranSubmission,
  getListMyQuranSubmissionsQueryKey,
  getGetQuranJourneyQueryKey,
} from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import { Mic, Square, Trash2, UploadCloud, CheckCircle2, AlertCircle, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Props {
  wardId: number;
}

const getBaseMimeType = (type: string): 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'audio/ogg' | null => {
  const base = type.split(';')[0];
  const allowed = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'];
  return allowed.includes(base) ? base as 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'audio/ogg' : null;
};

export function QuranStudentSubmissionPanel({ wardId }: Props) {
  const { lang, dir } = useI18n();
  const queryClient = useQueryClient();
  const isArabic = lang === 'ar';

  const { data: submissions, isLoading } = useListMyQuranSubmissions();
  
  const prepareUpload = usePrepareQuranSubmissionUpload();
  const finalizeUpload = useFinalizeQuranSubmission();

  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);
  
  const [duration, setDuration] = useState(0);
  const durationIntervalRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find the most recent submission for this ward
  const submission = submissions?.filter(s => s.wardId === wardId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const type = getBaseMimeType(chunksRef.current[0]?.type || '');
        if (!type || chunksRef.current.length === 0) {
          toast.error(isArabic ? "صيغة التسجيل غير مدعومة في هذا المتصفح" : "This browser produced an unsupported audio format");
          stream.getTracks().forEach(t => t.stop());
          setRecordingStatus('idle');
          return;
        }
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordingStatus('recorded');
        setClientRequestId(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
        setUploadedObjectPath(null);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setRecordingStatus('recording');
      setDuration(0);
      durationIntervalRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      toast.error(isArabic ? "تعذر الوصول إلى الميكروفون" : "Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
  };

  const clearRecording = () => {
    setRecordingStatus('idle');
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setClientRequestId(null);
    setUploadedObjectPath(null);
    setDuration(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const type = getBaseMimeType(file.type);
    if (!type) {
      toast.error(isArabic ? "صيغة الملف غير مدعومة. استخدم WebM أو MP4 أو MP3 أو OGG" : "Unsupported audio type. Use WebM, MP4, MP3, or OGG");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    // Size check (max 30MB)
    if (file.size > 31457280) {
      toast.error(isArabic ? "حجم الملف كبير جداً (الحد الأقصى 30 ميجابايت)" : "File is too large (max 30MB)");
      return;
    }
    
    setAudioBlob(new Blob([file], { type }));
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setRecordingStatus('recorded');
    setClientRequestId(typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    setUploadedObjectPath(null);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    const contentType = getBaseMimeType(audioBlob.type);
    if (!contentType || !clientRequestId) {
      toast.error(isArabic ? "اختر تسجيلاً صوتياً صالحاً أولاً" : "Select a valid audio recording first");
      return;
    }
    setIsSubmitting(true);
    try {
      let objectPath = uploadedObjectPath;
      // Keep both the request id and object path stable across retries. This
      // makes a retry after a network error a true idempotent finalize.
      if (!objectPath) {
        const prepared = await prepareUpload.mutateAsync({
          data: { wardId, contentType, fileSize: audioBlob.size }
        });
        const uploadRes = await fetch(prepared.uploadURL, {
          method: 'PUT',
          body: audioBlob,
          headers: { 'Content-Type': contentType }
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        objectPath = prepared.objectPath;
        setUploadedObjectPath(objectPath);
      }

      // 3. Finalize
      await finalizeUpload.mutateAsync({
        data: {
          wardId,
          objectPath,
          clientRequestId
        }
      });

      toast.success(isArabic ? "تم الإرسال بنجاح" : "Submitted successfully");
      queryClient.invalidateQueries({ queryKey: getListMyQuranSubmissionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetQuranJourneyQueryKey() });
      clearRecording();
    } catch (e) {
      toast.error(isArabic ? "حدث خطأ أثناء الإرسال" : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-t border-border p-4 flex justify-center sticky bottom-0 w-full z-40 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const needsResubmission = submission?.status === 'needs_resubmission';
  const showRecorder = !submission || needsResubmission || recordingStatus !== 'idle';

  return (
    <div className="bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-border p-4 sticky bottom-0 w-full z-40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] shrink-0">
      <div className="max-w-4xl mx-auto flex flex-col gap-4">
        {submission && recordingStatus === 'idle' && (
          <div className={cn(
            "rounded-2xl p-4 border",
            submission.status === 'submitted' ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50" :
            submission.status === 'reviewed' ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50" :
            "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
          )}>
            <div className="flex items-center gap-2 font-bold mb-2">
              {submission.status === 'submitted' && (
                <>
                  <UploadCloud className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-800 dark:text-blue-300">{isArabic ? "تم الإرسال - بانتظار المراجعة" : "Submitted - Pending Review"}</span>
                </>
              )}
              {submission.status === 'reviewed' && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-800 dark:text-emerald-300">{isArabic ? "تمت المراجعة" : "Reviewed"}</span>
                </>
              )}
              {submission.status === 'needs_resubmission' && (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-800 dark:text-amber-300">{isArabic ? "يحتاج إلى إعادة التسميع" : "Needs Resubmission"}</span>
                </>
              )}
            </div>
            
            {submission.status === 'reviewed' && (
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50">
                {submission.memorizationScore !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground font-bold">{isArabic ? "الحفظ" : "Memorization"}</p>
                    <p className="font-black text-emerald-700 dark:text-emerald-400">{submission.memorizationScore}%</p>
                  </div>
                )}
                {submission.recitationScore !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground font-bold">{isArabic ? "التلاوة" : "Recitation"}</p>
                    <p className="font-black text-emerald-700 dark:text-emerald-400">{submission.recitationScore}%</p>
                  </div>
                )}
                {submission.feedback && (
                  <div className="w-full">
                    <p className="text-xs text-muted-foreground font-bold">{isArabic ? "ملاحظات المعلم" : "Teacher Notes"}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{submission.feedback}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showRecorder && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-3 rounded-2xl border border-border/60">
            <div className="flex-1 w-full flex flex-wrap items-center justify-center sm:justify-start gap-3">
              {recordingStatus === 'idle' ? (
                <>
                  <button
                    onClick={startRecording}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all"
                  >
                    <Mic className="w-5 h-5" />
                    {isArabic ? "بدء التسجيل" : "Start Recording"}
                  </button>
                  <div className="text-muted-foreground font-bold text-sm">
                    {isArabic ? "أو" : "or"}
                  </div>
                  <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-background hover:bg-muted border border-border text-foreground px-6 py-3 rounded-xl font-bold shadow-sm transition-all cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                    {isArabic ? "إرفاق ملف" : "Attach File"}
                    <input 
                      type="file" 
                      accept="audio/webm,audio/mp4,audio/mpeg,audio/ogg"
                      className="hidden" 
                      onChange={handleFileUpload} 
                      ref={fileInputRef}
                    />
                  </label>
                </>
              ) : recordingStatus === 'recording' ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl font-bold w-full sm:w-auto">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                    <span className="tabular-nums font-mono">{formatDuration(duration)}</span>
                    <span className="text-sm">{isArabic ? "جارٍ التسجيل..." : "Recording..."}</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-all shrink-0"
                  >
                    <Square className="w-5 h-5" fill="currentColor" />
                    {isArabic ? "إيقاف" : "Stop"}
                  </button>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                  <div className="flex-1 w-full bg-background rounded-xl p-2 border border-border flex items-center gap-2">
                    <audio src={audioUrl!} controls className="h-10 w-full" />
                    <button onClick={clearRecording} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0" title={isArabic ? "حذف" : "Delete"}>
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {recordingStatus === 'recorded' && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-sm transition-all disabled:opacity-70 shrink-0"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                {isArabic ? "إرسال التسميع" : "Submit Audio"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
