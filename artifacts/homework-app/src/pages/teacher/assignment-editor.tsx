import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  Save, X, Plus, Minus, Image as ImageIcon, CheckCircle,
  GraduationCap, Clock, FileText, Lock, Globe, EyeOff, Eye, AlertCircle, RotateCcw,
  History, GitCommitHorizontal, RefreshCcw, CopyPlus, Loader2
} from "lucide-react";
import { Card, Button, Input, Label } from "@/components/ui-elements";
import { ClassSelector } from "@/components/teacher/class-selector";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { resolveImageUrl } from "@/lib/image-url";
import { fileToBase64 } from "@/lib/utils";
import { contentDirection } from "@/lib/content-direction";
import { MathTextarea, MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.VITE_API_URL || "";

function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);
  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }
    const result = window.matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);
    return () => result.removeEventListener("change", onChange);
  }, [query]);
  return value;
}

type SubmissionMode = "electronic" | "paper" | "both";
type AccessMode = "public" | "private";

function toDatetimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RevisionHistoryModal({
  assignmentId,
  currentVersion,
  submissionsExist,
  open,
  onOpenChange,
  onRestoreSuccess,
}: {
  assignmentId: number;
  currentVersion: number;
  submissionsExist: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreSuccess: () => void;
}) {
  const { t, lang, dir } = useI18n();
  const ar = lang === "ar";
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/assignments", assignmentId, "revisions"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/revisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revisions");
      return res.json();
    },
    enabled: open && !!assignmentId,
  });

  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [settingsOnly, setSettingsOnly] = useState(submissionsExist);
  const [previewRevisionId, setPreviewRevisionId] = useState<number | null>(null);

  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: ["/api/assignments", assignmentId, "revisions", previewRevisionId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/revisions/${previewRevisionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revision details");
      return res.json();
    },
    enabled: previewRevisionId !== null,
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ revisionId, onlySettings }: { revisionId: number; onlySettings: boolean }) => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/revisions/${revisionId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ version: currentVersion, mode: onlySettings ? "settings" : "full" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw {
          message: typeof err.message === "object" ? err.message?.[lang] : err.message,
          code: err.code,
        };
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}`] });
      toast.success(ar ? "تمت الاستعادة بنجاح" : "Restored successfully");
      onRestoreSuccess();
      onOpenChange(false);
    },
    onError: (err: any) => {
      if (err.code === "ASSIGNMENT_VERSION_CONFLICT") {
        toast.error(ar ? "حدث تعارض في النسخ. يرجى تحديث الصفحة والمحاولة مجدداً." : "Version conflict. Please refresh and try again.");
      } else if (err.code === "REVISION_QUESTIONS_LOCKED") {
        toast.error(ar ? "لا يمكن استعادة الأسئلة لوجود تسليمات. يرجى استعادة الإعدادات فقط." : "Cannot restore questions because submissions exist. Please restore settings only.");
        setSettingsOnly(true);
      } else {
        toast.error(err.message || (ar ? "فشلت الاستعادة" : "Restore failed"));
      }
    },
    onSettled: () => setRestoringId(null),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (revisionId: number) => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/revisions/${revisionId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = typeof err.message === "object" ? err.message?.[lang] : err.message;
        throw new Error(message || "Failed to duplicate");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast.success(ar ? "تم تكرار النسخة بنجاح" : "Revision duplicated successfully");
      window.location.href = `/teacher/assignment/${data.id}`;
    },
    onError: (err: any) => {
      toast.error(err.message || (ar ? "فشل التكرار" : "Duplicate failed"));
    }
  });

  const revisions = Array.isArray(data) ? data : data?.revisions ?? [];

  const content = (
    <div className="space-y-4 py-4" dir={dir}>
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-500 rounded-lg text-sm">{ar ? "فشل تحميل سجل التعديلات" : "Failed to load revision history"}</div>
      ) : revisions.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">{ar ? "لا توجد تعديلات سابقة" : "No previous revisions"}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2 px-2 text-sm text-muted-foreground">
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                 type="checkbox"
                 checked={settingsOnly}
                 onChange={e => setSettingsOnly(e.target.checked)}
                 disabled={submissionsExist}
                 className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
               />
               <span>{ar ? "استعادة الإعدادات فقط (بدون الأسئلة)" : "Restore settings only (keep questions)"}</span>
             </label>
             {submissionsExist && <span className="text-xs text-orange-500">({ar ? "إجباري لوجود تسليمات" : "Required due to submissions"})</span>}
          </div>
          
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {revisions.map((rev: any) => (
              <div key={rev.id} className="p-4 border-2 border-border rounded-xl flex flex-col gap-3 relative bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <GitCommitHorizontal className="w-4 h-4 text-primary" />
                      {ar ? `النسخة ${rev.sourceVersion}` : `Version ${rev.sourceVersion}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rev.createdAt).toLocaleString(ar ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                  <div className="text-xs font-bold bg-accent px-2 py-1 rounded-md shrink-0">
                    {rev.questionCount} {ar ? "أسئلة" : "questions"}
                  </div>
                </div>
                
                {rev.title && (
                  <div className="text-sm bg-muted/50 p-2 rounded-md">
                    {ar ? `نسخة محفوظة قبل تعديل «${rev.title}»` : `Saved before editing “${rev.title}”`}
                  </div>
                )}
                
                <div className="flex items-center gap-2 pt-2 border-t border-border mt-1">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs py-1.5 min-h-0 h-auto"
                    disabled={duplicateMutation.isPending}
                    onClick={() => duplicateMutation.mutate(rev.id)}
                  >
                    <CopyPlus className="w-3.5 h-3.5 mr-1" />
                    {ar ? "نسخ" : "Duplicate"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-xs py-1.5 min-h-0 h-auto"
                    onClick={() => setPreviewRevisionId(rev.id)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    {ar ? "معاينة" : "Preview"}
                  </Button>
                  {rev.sourceVersion !== currentVersion && (
                    <Button
                      className="flex-1 text-xs py-1.5 min-h-0 h-auto"
                      disabled={restoringId !== null}
                      onClick={() => {
                        setRestoringId(rev.id);
                        restoreMutation.mutate({ revisionId: rev.id, onlySettings: settingsOnly });
                      }}
                    >
                      {restoringId === rev.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
                      {ar ? "استعادة" : "Restore"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={previewRevisionId !== null} onOpenChange={(o) => !o && setPreviewRevisionId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ar ? "معاينة النسخة" : "Preview Revision"}</DialogTitle>
          </DialogHeader>
          {isPreviewLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : previewData ? (
             <div className="space-y-4" dir={dir}>
               <h3 className="font-bold text-lg">{previewData.settings?.title}</h3>
               {previewData.settings?.description && <div className="text-sm text-muted-foreground">{previewData.settings.description}</div>}
               <div className="space-y-2 mt-4">
                 <h4 className="font-bold">{ar ? "الأسئلة" : "Questions"} ({previewData.questions?.length || 0})</h4>
                 {previewData.questions?.map((q: any, i: number) => (
                   <div key={q.id || i} className="p-3 border rounded-lg bg-card text-sm">
                     <div className="font-bold mb-2">{i + 1}. <MathText text={q.text} fallbackDirection={ar ? "rtl" : "ltr"} /></div>
                     {q.questionType === "mcq" && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                         <div className={`p-2 rounded ${q.correctAnswer === "A" ? "bg-primary/20 text-primary border-primary border" : "bg-muted border border-border"}`}>A) {q.optionA}</div>
                         <div className={`p-2 rounded ${q.correctAnswer === "B" ? "bg-primary/20 text-primary border-primary border" : "bg-muted border border-border"}`}>B) {q.optionB}</div>
                         {q.optionC && <div className={`p-2 rounded ${q.correctAnswer === "C" ? "bg-primary/20 text-primary border-primary border" : "bg-muted border border-border"}`}>C) {q.optionC}</div>}
                         {q.optionD && <div className={`p-2 rounded ${q.correctAnswer === "D" ? "bg-primary/20 text-primary border-primary border" : "bg-muted border border-border"}`}>D) {q.optionD}</div>}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="w-5 h-5 text-primary" />
              {ar ? "سجل التعديلات" : "Revision History"}
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-xl text-center">
            <History className="w-5 h-5 text-primary inline-block mr-2 align-middle" />
            {ar ? "سجل التعديلات" : "Revision History"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export interface EditQuestion {
  id?: number;
  text: string;
  questionType: "mcq" | "true_false" | "fill_blank" | "whiteboard" | "whiteboard_blank" | "dictation" | "open";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points: number;
  imageUrl?: string | null;
  readAloud?: boolean;
  allowMultipleAnswers?: boolean;
  repeatQuestion?: boolean;
}

export interface AssignmentEditorProps {
  assignment: any;
  submissionsExist: boolean;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  /** Lets the owning route guard navigation outside the editor. */
  onDirtyChange?: (dirty: boolean) => void;
  onRestored?: () => void;
}

export function AssignmentEditor({ assignment, submissionsExist, onSave, onCancel, isSaving, onDirtyChange, onRestored }: AssignmentEditorProps) {
  const { t, lang, dir } = useI18n();
  const ar = lang === "ar";
  
  const [title, setTitle] = useState(assignment.title || "");
  const [subject, setSubject] = useState(assignment.subject || "");
  const [description, setDescription] = useState(assignment.description || "");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(assignment.submissionMode || "both");
  const [accessMode, setAccessMode] = useState<AccessMode>(assignment.accessMode || "public");
  const [accessCode, setAccessCode] = useState(assignment.accessCode || "");
  const [targetClasses, setTargetClasses] = useState<string[]>(
    assignment.targetClasses?.length ? assignment.targetClasses : 
    (assignment.targetClass ? [assignment.targetClass] : [])
  );
  const [showResults, setShowResults] = useState(assignment.showResults ?? true);
  const [deadline, setDeadline] = useState(toDatetimeLocalValue(assignment.deadline));
  const [examMode, setExamMode] = useState(assignment.examMode ?? false);
  const [examDurationMinutes, setExamDurationMinutes] = useState(assignment.examDurationMinutes ?? 30);
  const [resultsReleaseMode, setResultsReleaseMode] = useState<"immediate" | "after_deadline" | "manual">(assignment.resultsReleaseMode || "immediate");
  const [displayTotalPoints, setDisplayTotalPoints] = useState(assignment.displayTotalPoints ?? "");
  const [aiGradingInstructions, setAiGradingInstructions] = useState(assignment.aiGradingInstructions || "");

  const initialQuestions: EditQuestion[] = (assignment.questions || []).map((q: any) => ({
    id: q.id,
    text: q.text || "",
    questionType: (q.questionType || "mcq"),
    optionA: q.optionA || "",
    optionB: q.optionB || "",
    optionC: q.optionC || "",
    optionD: q.optionD || "",
    correctAnswer: q.correctAnswer || "",
    points: q.points ?? 1,
    imageUrl: q.imageUrl || null,
    readAloud: q.readAloud || false,
    allowMultipleAnswers: q.allowMultipleAnswers || false,
    repeatQuestion: q.repeatQuestion || false,
  }));

  const [questions, setQuestions] = useState<EditQuestion[]>(initialQuestions);
  const [imagePickerFor, setImagePickerFor] = useState<number>(-1);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [showImpactConfirmation, setShowImpactConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleRestoreSuccess = () => onRestored?.();

  const isDirty = useMemo(() => {
    if (title !== (assignment.title || "")) return true;
    if (subject !== (assignment.subject || "")) return true;
    if (description !== (assignment.description || "")) return true;
    if (submissionMode !== (assignment.submissionMode || "both")) return true;
    if (accessMode !== (assignment.accessMode || "public")) return true;
    if (accessCode !== (assignment.accessCode || "")) return true;
    if (showResults !== (assignment.showResults ?? true)) return true;
    if (examMode !== (assignment.examMode ?? false)) return true;
    if (examDurationMinutes !== (assignment.examDurationMinutes ?? 30)) return true;
    if (resultsReleaseMode !== (assignment.resultsReleaseMode || "immediate")) return true;
    if (String(displayTotalPoints) !== String(assignment.displayTotalPoints ?? "")) return true;
    if (aiGradingInstructions !== (assignment.aiGradingInstructions || "")) return true;
    const initialDeadline = toDatetimeLocalValue(assignment.deadline);
    if (deadline !== initialDeadline) return true;

    const initialClasses = assignment.targetClasses?.length ? assignment.targetClasses : (assignment.targetClass ? [assignment.targetClass] : []);
    if (targetClasses.length !== initialClasses.length) return true;
    for (let i = 0; i < targetClasses.length; i++) {
      if (!initialClasses.includes(targetClasses[i])) return true;
    }

    if (questions.length !== initialQuestions.length) return true;
    for (let i = 0; i < questions.length; i++) {
      const q1 = questions[i];
      const q2 = initialQuestions[i];
      if (
        q1.text !== q2.text ||
        q1.questionType !== q2.questionType ||
        q1.optionA !== q2.optionA ||
        q1.optionB !== q2.optionB ||
        q1.optionC !== q2.optionC ||
        q1.optionD !== q2.optionD ||
        q1.correctAnswer !== q2.correctAnswer ||
        q1.points !== q2.points ||
        q1.imageUrl !== q2.imageUrl ||
        q1.readAloud !== q2.readAloud ||
        q1.allowMultipleAnswers !== q2.allowMultipleAnswers ||
        q1.repeatQuestion !== q2.repeatQuestion
      ) {
        return true;
      }
    }
    return false;
  }, [
    title, subject, description, submissionMode, accessMode, accessCode, targetClasses,
    showResults, deadline, examMode, examDurationMinutes, resultsReleaseMode,
    displayTotalPoints, aiGradingInstructions, questions, assignment, initialQuestions
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  const questionsChanged = useMemo(() => {
    const comparable = (question: EditQuestion) => ({
      id: question.id ?? null,
      text: question.text,
      questionType: question.questionType,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      points: question.points,
      imageUrl: question.imageUrl ?? null,
      readAloud: question.readAloud ?? false,
      allowMultipleAnswers: question.allowMultipleAnswers ?? false,
      repeatQuestion: question.repeatQuestion ?? false,
    });
    return JSON.stringify(questions.map(comparable)) !== JSON.stringify(initialQuestions.map(comparable));
  }, [questions, initialQuestions]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelConfirmation(true);
    } else {
      onCancel();
    }
  };

  const regenerateAccessCode = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const random = crypto.getRandomValues(new Uint32Array(6));
    const code = Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
    setAccessCode(code);
  };

  const computedTotalPoints = useMemo(() => {
    if (submissionMode === "paper") return parseFloat(String(displayTotalPoints)) || 10;
    return questions.reduce((sum, q) => sum + (q.points || 1), 0);
  }, [submissionMode, displayTotalPoints, questions]);

  const validateAndSave = () => {
    if (!title.trim()) {
      toast.error(ar ? "يجب إدخال عنوان الواجب" : "Assignment title is required");
      return;
    }
    if (submissionMode !== "paper" && questions.length === 0) {
      toast.error(ar ? "يجب إضافة سؤال واحد على الأقل" : "At least one question is required");
      return;
    }
    if (accessMode === "private" && !accessCode.trim()) {
      toast.error(ar ? "أدخل رمز دخول للواجب الخاص" : "Enter an access code for the private assignment");
      return;
    }
    if (examMode && (!Number.isInteger(examDurationMinutes) || examDurationMinutes < 1)) {
      toast.error(ar ? "مدة الاختبار يجب أن تكون دقيقة واحدة على الأقل" : "Exam duration must be at least one minute");
      return;
    }
    if (resultsReleaseMode === "after_deadline" && !deadline) {
      toast.error(ar ? "حدّد موعدًا نهائيًا لإظهار النتائج بعده" : "Set a deadline before releasing results after it");
      return;
    }
    if (submissionMode === "paper") {
      const paperTotal = Number(displayTotalPoints);
      if (!Number.isFinite(paperTotal) || paperTotal <= 0) {
        toast.error(ar ? "أدخل مجموع درجات صحيحًا للواجب الورقي" : "Enter a valid total for the paper assignment");
        return;
      }
    }

    if (submissionMode !== "paper") {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          toast.error(ar ? `نص السؤال مفقود في السؤال رقم ${i + 1}` : `Question text missing in question ${i + 1}`);
          return;
        }
        if (!q.points || q.points <= 0) {
          toast.error(ar ? `الدرجة يجب أن تكون أكبر من 0 في السؤال ${i + 1}` : `Points must be > 0 in question ${i + 1}`);
          return;
        }
        
        if (q.questionType === "mcq") {
          if (!q.optionA.trim() || !q.optionB.trim()) {
            toast.error(ar ? `يجب إدخال خيارين على الأقل في السؤال ${i + 1}` : `At least two options required in question ${i + 1}`);
            return;
          }
          if (!q.correctAnswer) {
            toast.error(ar ? `يجب تحديد الإجابة الصحيحة في السؤال ${i + 1}` : `Correct answer must be selected in question ${i + 1}`);
            return;
          }
          const selectedOption = q[`option${q.correctAnswer}` as keyof EditQuestion];
          if (typeof selectedOption !== "string" || !selectedOption.trim()) {
            toast.error(ar ? `الإجابة المحددة فارغة في السؤال ${i + 1}` : `The selected answer is empty in question ${i + 1}`);
            return;
          }
        } else if (q.questionType === "true_false") {
          if (!q.correctAnswer) {
            toast.error(ar ? `يجب تحديد الإجابة الصحيحة في السؤال ${i + 1}` : `Correct answer must be selected in question ${i + 1}`);
            return;
          }
        } else if (q.questionType === "fill_blank") {
          if (!q.correctAnswer.trim()) {
            toast.error(ar ? `يجب كتابة الإجابة الصحيحة في السؤال ${i + 1}` : `Correct answer must be provided in question ${i + 1}`);
            return;
          }
        }
      }
    }

    if (submissionsExist && questionsChanged) {
      setShowImpactConfirmation(true);
    } else {
      executeSave(!submissionsExist && submissionMode !== "paper");
    }
  };

  const executeSave = (includeQuestions = submissionMode !== "paper") => {
    setShowImpactConfirmation(false);
    const payload: Record<string, unknown> = {
      version: assignment.version,
      title,
      subject: subject.trim() || null,
      description: description.trim() || null,
      submissionMode,
      accessMode,
      accessCode: accessMode === "private" ? (accessCode || null) : null,
      targetClass: targetClasses.length === 1 ? targetClasses[0] : null,
      targetClasses: targetClasses.length > 0 ? targetClasses : null,
      showResults,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      examMode,
      examDurationMinutes: examMode ? examDurationMinutes : null,
      resultsReleaseMode,
      displayTotalPoints: submissionMode === "paper" ? (parseFloat(String(displayTotalPoints)) || 10) : null,
      aiGradingInstructions: aiGradingInstructions || null,
    };
    if (includeQuestions) {
      payload.questions = questions.map(q => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType,
        optionA: q.optionA || null,
        optionB: q.optionB || null,
        optionC: q.optionC || null,
        optionD: q.optionD || null,
        correctAnswer: q.correctAnswer || null,
        points: q.points,
        imageUrl: q.imageUrl || null,
        readAloud: q.readAloud,
        allowMultipleAnswers: q.allowMultipleAnswers,
        repeatQuestion: q.repeatQuestion,
      }));
    }
    onSave(payload);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", questionType: "mcq", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", points: 1 }
    ]);
  };

  const updateQuestion = (index: number, field: keyof EditQuestion, value: any) => {
    const updated = [...questions];
    const previousType = updated[index].questionType;
    (updated[index] as any)[field] = value;
    
    if (field === "questionType") {
      updated[index].correctAnswer = value === "true_false" ? "true" : value === "mcq" ? "A" : "";
      if (value === "whiteboard_blank") {
         updated[index].questionType = "whiteboard";
         updated[index].optionA = "blank";
      } else if (value === "whiteboard") {
         updated[index].optionA = "lined";
      } else if (previousType === "whiteboard") {
        updated[index].optionA = "";
        updated[index].optionB = "";
        updated[index].optionC = "";
        updated[index].optionD = "";
      }
    }
    
    setQuestions(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imagePickerFor === -1) return;
    try {
      const b64 = await fileToBase64(file);
      updateQuestion(imagePickerFor, "imageUrl", b64);
    } catch {
      toast.error(ar ? "فشل تحميل الصورة" : "Failed to load image");
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = "";
      setImagePickerFor(-1);
    }
  };

  return (
    <div className="space-y-6 pb-24" dir={dir}>
      <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={handleImageUpload} />
      
      {assignment.id && (
        <RevisionHistoryModal
          assignmentId={assignment.id}
          currentVersion={assignment.version}
          submissionsExist={submissionsExist}
          open={showHistory}
          onOpenChange={setShowHistory}
          onRestoreSuccess={handleRestoreSuccess}
        />
      )}

      <div className="sticky top-0 z-[100] bg-background/80 backdrop-blur-xl border-b-2 border-border p-4 flex flex-wrap gap-4 items-center justify-between -mx-4 md:-mx-8 lg:-mx-12 xl:-mx-20 px-4 md:px-8 lg:px-12 xl:px-20 mb-8 shadow-sm">
        <h1 className="text-2xl font-black text-foreground">{ar ? "تعديل الواجب" : "Edit Assignment"}</h1>
        <div className="flex items-center gap-3">
          {assignment.id && (
            <Button
              onClick={() => setShowHistory(true)}
              variant="outline"
              className="gap-2 shrink-0 border-dashed text-primary border-primary/50 hover:bg-primary/5"
              aria-label={ar ? "فتح سجل التعديلات" : "Open revision history"}
              title={ar ? "سجل التعديلات" : "Revision history"}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">{ar ? "السجل" : "History"}</span>
            </Button>
          )}
          <Button
            onClick={handleCancel}
            variant="outline"
            className="gap-2"
            disabled={isSaving}
            aria-label={ar ? "إلغاء التعديل" : "Cancel editing"}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{ar ? "إلغاء" : "Cancel"}</span>
          </Button>
          <Button onClick={validateAndSave} disabled={isSaving || !isDirty} className="gap-2 relative">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{isSaving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التغييرات" : "Save changes")}</span>
            <span className="sm:hidden">{ar ? "حفظ" : "Save"}</span>
            {isDirty && !isSaving && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b pb-2">
          <FileText className="w-5 h-5 text-primary" />
          {ar ? "المعلومات الأساسية" : "Basic Info"}
        </h2>
        
        <div>
          <Label>{ar ? "عنوان الواجب" : "Assignment Title"} *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-bold text-lg" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{ar ? "المادة" : "Subject"}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>{ar ? "الفصول المستهدفة" : "Target Classes"}</Label>
            <ClassSelector
              value={targetClasses}
              onChange={() => {}}
              multiple
              values={targetClasses}
              onValuesChange={setTargetClasses}
              accent="#10b981"
            />
          </div>
        </div>

        <div>
          <Label>{ar ? "الوصف أو التعليمات (اختياري)" : "Description or Instructions"}</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none h-24"
          />
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4 border-b pb-2">
          <Lock className="w-5 h-5 text-primary" />
          {ar ? "إعدادات التسليم والوصول" : "Submission & Access Settings"}
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>{ar ? "طريقة التسليم" : "Submission Mode"}</Label>
              <div className="flex flex-wrap gap-2">
                {(["electronic", "paper", "both"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSubmissionMode(mode)}
                    className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg border-2 text-sm font-bold transition-all ${submissionMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-muted-foreground"}`}
                  >
                    {mode === "electronic" ? (ar ? "إلكتروني" : "Electronic") : mode === "paper" ? (ar ? "ورقي" : "Paper") : (ar ? "كلاهما" : "Both")}
                  </button>
                ))}
              </div>
            </div>

            {submissionMode === "paper" && (
              <div>
                <Label>{ar ? "إجمالي الدرجات" : "Total Points"}</Label>
                <Input type="number" min="1" value={displayTotalPoints} onChange={(e) => setDisplayTotalPoints(e.target.value)} />
              </div>
            )}

            <div>
              <Label>{ar ? "صلاحية الوصول" : "Access Mode"}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccessMode("public")}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${accessMode === "public" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-muted-foreground"}`}
                >
                  <Globe className="w-4 h-4" /> {ar ? "عام" : "Public"}
                </button>
                <button
                  type="button"
                  onClick={() => setAccessMode("private")}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${accessMode === "private" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-muted-foreground"}`}
                >
                  <Lock className="w-4 h-4" /> {ar ? "خاص" : "Private"}
                </button>
              </div>
            </div>

            {accessMode === "private" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Label>{ar ? "كود الدخول" : "Access Code"}</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder={ar ? "مثال: HSD246" : "e.g. HSD246"}
                    className="font-mono tracking-widest text-lg"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={regenerateAccessCode} className="gap-2 shrink-0">
                    <RotateCcw className="w-4 h-4" />
                    {ar ? "رمز جديد" : "New code"}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label>{ar ? "آخر موعد للتسليم" : "Deadline"}</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            <div>
              <Label>{ar ? "ظهور النتائج للطلاب" : "Results Visibility"}</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResults(true)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${showResults ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-muted-foreground"}`}
                >
                  <Eye className="w-4 h-4" /> {ar ? "مرئية" : "Visible"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResults(false)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${!showResults ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-muted-foreground"}`}
                >
                  <EyeOff className="w-4 h-4" /> {ar ? "مخفية" : "Hidden"}
                </button>
              </div>
            </div>

            {showResults && (
               <div>
                 <Label>{ar ? "توقيت ظهور النتائج" : "Results Release Timing"}</Label>
                 <select
                   value={resultsReleaseMode}
                   onChange={(e) => setResultsReleaseMode(e.target.value as any)}
                   className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                 >
                   <option value="immediate">{ar ? "فوراً بعد التسليم" : "Immediately after submission"}</option>
                   <option value="after_deadline">{ar ? "بعد انتهاء الموعد" : "After deadline"}</option>
                   <option value="manual">{ar ? "يدوياً (لا تظهر حتى تفعلها)" : "Manual release"}</option>
                 </select>
               </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={examMode}
                  onChange={(e) => {
                    setExamMode(e.target.checked);
                    if (e.target.checked) setSubmissionMode("electronic");
                  }}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-bold text-sm">{ar ? "وضع الاختبار الموقوت" : "Exam Mode (Timed)"}</span>
              </label>
              {examMode && (
                <div className="mt-2 ltr:ml-6 rtl:mr-6">
                  <Label>{ar ? "المدة (بالدقائق)" : "Duration (Minutes)"}</Label>
                  <Input type="number" min="1" value={examDurationMinutes} onChange={(e) => setExamDurationMinutes(Number(e.target.value))} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
           <Label>{ar ? "تعليمات تصحيح الذكاء الاصطناعي (اختياري)" : "AI Grading Instructions (Optional)"}</Label>
           <textarea
             value={aiGradingInstructions}
             onChange={(e) => setAiGradingInstructions(e.target.value)}
             placeholder={ar ? "مثال: تساهل في الأخطاء الإملائية" : "e.g. Ignore spelling mistakes"}
             className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none h-20"
           />
        </div>
      </Card>

      {submissionMode !== "paper" && (
        <>
          <div className="flex flex-wrap items-center justify-between mt-8 mb-4 gap-4">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              {ar ? "الأسئلة" : "Questions"} ({questions.length})
              <span className="text-sm font-bold text-muted-foreground bg-accent px-2 py-1 rounded-full">
                {computedTotalPoints} {ar ? "نقطة" : "pts"}
              </span>
            </h2>
            <Button onClick={addQuestion} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              {ar ? "سؤال جديد" : "Add Question"}
            </Button>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <Card key={idx} className={`p-5 ${ar ? "border-r-4 border-r-primary" : "border-l-4 border-l-primary"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm">{idx + 1}</span>
                    <select
                      value={q.questionType === "whiteboard" ? (q.optionA === "blank" ? "whiteboard_blank" : "whiteboard") : q.questionType}
                      onChange={(e) => updateQuestion(idx, "questionType", e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-background border-2 border-border font-bold text-sm focus:outline-none focus:border-primary transition-all max-w-[180px] sm:max-w-none"
                    >
                      <option value="mcq">{ar ? "اختيار من متعدد" : "Multiple Choice"}</option>
                      <option value="true_false">{ar ? "صح أم خطأ" : "True / False"}</option>
                      <option value="fill_blank">{ar ? "أكمل الفراغ" : "Fill in Blank"}</option>
                      <option value="whiteboard">{ar ? "سبورة (مسطرة)" : "Whiteboard (Lined)"}</option>
                      <option value="whiteboard_blank">{ar ? "سبورة (فارغة)" : "Whiteboard (Blank)"}</option>
                      <option value="open">{ar ? "سؤال مقالي" : "Open Question"}</option>
                      <option value="dictation">{ar ? "إملاء" : "Dictation"}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 ml-auto rtl:mr-auto rtl:ml-0">
                    <div className="flex items-center gap-1.5">
                      <Label className="mb-0 text-xs hidden sm:block">{ar ? "الدرجة:" : "Pts:"}</Label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={q.points}
                        onChange={(e) => updateQuestion(idx, "points", parseFloat(e.target.value) || 1)}
                        className="w-16 px-2 py-1.5 rounded-lg bg-background border-2 border-border text-center font-bold text-sm focus:outline-none focus:border-primary transition-all"
                      />
                    </div>
                    {questions.length > 1 && (
                      <button onClick={() => setQuestions(questions.filter((_, i) => i !== idx))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs mb-1">{ar ? "نص السؤال" : "Question Text"}</Label>
                    <MathTextarea
                      value={q.text}
                      onValueChange={(value) => updateQuestion(idx, "text", value)}
                      placeholder={ar ? "اكتب سؤالك هنا..." : "Type your question..."}
                      language={ar ? "ar" : "en"}
                      rows={2}
                      className="flex min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-bold leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      {q.imageUrl ? (
                        <div className="relative inline-block">
                          <img src={resolveImageUrl(q.imageUrl) ?? ""} alt="" className="max-h-20 rounded-lg border border-border object-contain" />
                          <button
                            type="button"
                            onClick={() => updateQuestion(idx, "imageUrl", "")}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setImagePickerFor(idx); imageInputRef.current?.click(); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-dashed border-border hover:border-primary/50 transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          {ar ? "صورة" : "Image"}
                        </button>
                      )}
                    </div>
                  </div>

                  {q.questionType === "mcq" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 bg-accent/30 p-4 rounded-xl border border-border/50">
                      {["A", "B", "C", "D"].map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuestion(idx, "correctAnswer", opt)}
                            className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center font-black transition-all ${q.correctAnswer === opt ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-110" : "bg-background border-2 border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-500"}`}
                          >
                            {q.correctAnswer === opt ? <CheckCircle className="w-4 h-4" /> : opt}
                          </button>
                          <textarea
                            value={(q as any)[`option${opt}`]}
                            onChange={(e) => updateQuestion(idx, `option${opt}` as keyof EditQuestion, e.target.value)}
                            placeholder={`${ar ? "الخيار" : "Option"} ${opt}`}
                            dir={contentDirection((q as any)[`option${opt}`], ar ? "rtl" : "ltr")}
                            rows={1}
                            className={`min-h-10 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ${q.correctAnswer === opt ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.questionType === "true_false" && (
                    <div className="flex gap-4 mt-4">
                      <button
                        type="button"
                        onClick={() => updateQuestion(idx, "correctAnswer", "true")}
                        className={`flex-1 py-3 rounded-xl border-2 font-black transition-all flex items-center justify-center gap-2 ${q.correctAnswer === "true" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground hover:bg-accent"}`}
                      >
                        {ar ? "صح" : "True"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuestion(idx, "correctAnswer", "false")}
                        className={`flex-1 py-3 rounded-xl border-2 font-black transition-all flex items-center justify-center gap-2 ${q.correctAnswer === "false" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground hover:bg-accent"}`}
                      >
                        {ar ? "خطأ" : "False"}
                      </button>
                    </div>
                  )}

                  {q.questionType === "fill_blank" && (
                    <div className="mt-4">
                      <Label className="text-xs">{ar ? "الإجابة الصحيحة" : "Correct Answer"}</Label>
                      <Input
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(idx, "correctAnswer", e.target.value)}
                        placeholder={ar ? "اكتب الإجابة..." : "Type answer..."}
                      />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Cancel Confirmation Modal */}
      <Dialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
              <AlertCircle className="w-5 h-5" />
              {ar ? "تجاهل التغييرات؟" : "Discard Changes?"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium text-foreground">
              {ar ? "لديك تغييرات غير محفوظة. هل أنت متأكد أنك تريد الإلغاء؟ سيتم فقدان جميع التعديلات." : "You have unsaved changes. Are you sure you want to cancel? All modifications will be lost."}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCancelConfirmation(false)}>
              {ar ? "تراجع" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={onCancel}>
              {ar ? "نعم، تجاهل التغييرات" : "Yes, discard changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Impact Confirmation Modal */}
      <Dialog open={showImpactConfirmation} onOpenChange={setShowImpactConfirmation}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertCircle className="w-5 h-5" />
              {ar ? "لا يمكن تغيير الأسئلة بعد التسليم" : "Questions are locked after submissions"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {ar
                ? "يحتوي هذا الواجب على تسليمات طلاب، لذلك لن نحفظ تغييرات الأسئلة حتى لا تتغير الإجابات والدرجات التاريخية. يمكنك حفظ بقية إعدادات الواجب فقط، أو تكرار الواجب لإنشاء نسخة جديدة بأسئلة معدّلة."
                : "This assignment has student submissions, so question changes cannot be saved without altering historical answers and grades. You can save the other settings only, or duplicate the assignment and edit its questions there."}
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 flex gap-3 text-sm text-amber-800 dark:text-amber-200">
              <RotateCcw className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                {ar
                  ? "سيُبقي الحفظ الآمن الأسئلة والتسليمات السابقة كما هي."
                  : "Safe saving will keep the existing questions and submissions unchanged."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowImpactConfirmation(false)}>
              {ar ? "العودة للأسئلة" : "Return to questions"}
            </Button>
            <Button onClick={() => executeSave(false)} className="bg-amber-600 hover:bg-amber-700 text-white border-none">
              {ar ? "حفظ الإعدادات فقط" : "Save settings only"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
