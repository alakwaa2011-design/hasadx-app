import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  useEnqueuePresentationOutline,
  useGetPresentationOutlineJob,
  getGetPresentationOutlineJobQueryKey,
  useGetCurrentTeacher,
  useUpdatePresentationDraft,
  getListPresentationDraftsQueryKey,
  type PresentationBrief,
  type PresentationDraft,
  type PresentationDraftWithGuardrails,
  type PresentationOutline,
} from "@workspace/api-client-react";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { BriefForm, type BriefFormHandle } from "./brief-form";
import { OutlineReview } from "./outline-review";
import { BuildProgress } from "./build-progress";
import { DesignPicker } from "./design-picker";

const BRAND_GREEN = "#225739";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* Optional starting draft — used when teacher reopens from `/drafts`. */
  initialDraft?: PresentationDraft | null;
}

type Step = "brief" | "outline";

/* AI Presentation Builder — orchestrator dialog.
   Holds the two-step state machine (Brief → Outline review) and, on
   approval, triggers the Phase 1B build via the BuildProgress dialog. */
export function AiPresentationBuilder({ open, onOpenChange, initialDraft }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(initialDraft ? "outline" : "brief");
  const [draft, setDraft] = useState<PresentationDraft | null>(initialDraft ?? null);
  const [guardrailFeedback, setGuardrailFeedback] = useState<string[]>([]);
  const [showBuild, setShowBuild] = useState(false);
  /* deck identity: "" = chosen automatically by the server from subject/grade */
  const [designChoice, setDesignChoice] = useState<string>("");
  const [lastBrief, setLastBrief] = useState<PresentationBrief | undefined>(undefined);
  const savedOutlineRecovery = (() => {
    try { return JSON.parse(localStorage.getItem("hasaad:presentation-outline-recovery") ?? "null") as { key?: string; brief?: PresentationBrief; teacherId?: number } | null; } catch { return null; }
  })();
  const [outlineJobId, setOutlineJobId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem("hasaad:presentation-outline-job"));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  });
  const outlineIdempotencyKey = useRef(savedOutlineRecovery?.key ?? crypto.randomUUID());
  const recoveredRef = useRef(false);
  const { data: currentTeacher } = useGetCurrentTeacher({ query: { retry: false } as any });

  /* Brief form validity — lifted via onValidityChange so the sticky
     footer Generate button can be disabled/enabled without needing
     a ref-based DOM hack. */
  const [briefValid, setBriefValid] = useState(false);
  const briefRef = useRef<BriefFormHandle>(null);

  /* Reset when the dialog closes so the next open is clean. */
  useEffect(() => {
    if (!open) {
      setStep(initialDraft ? "outline" : "brief");
      setDraft(initialDraft ?? null);
      setGuardrailFeedback([]);
      setShowBuild(false);
      setBriefValid(false);
      const savedJob = Number(localStorage.getItem("hasaad:presentation-outline-job"));
      setOutlineJobId(Number.isInteger(savedJob) && savedJob > 0 ? savedJob : null);
      try {
        const recovery = JSON.parse(localStorage.getItem("hasaad:presentation-outline-recovery") ?? "null") as { key?: string } | null;
        outlineIdempotencyKey.current = recovery?.key ?? crypto.randomUUID();
      } catch {
        outlineIdempotencyKey.current = crypto.randomUUID();
      }
      recoveredRef.current = false;
    }
  }, [open, initialDraft]);

  /* Server charges credits for outline generation — refresh the shared balance. */
  const refreshCreditsBalance = useRefreshCreditsBalance();

  const generate = useEnqueuePresentationOutline({
    mutation: {
      onSettled: () => refreshCreditsBalance(),
      onError: (err: unknown) => {
        const e = err as { status?: number; data?: { message?: string } };
        const msg = e?.data?.message ?? (isAr ? "تعذّر توليد المخطط." : "Could not generate outline.");
        toast.error(msg);
      },
    },
    request: { headers: { "X-Idempotency-Key": outlineIdempotencyKey.current } },
  });

  const { data: outlineJob } = useGetPresentationOutlineJob(outlineJobId ?? 0, {
    query: {
      queryKey: getGetPresentationOutlineJobQueryKey(outlineJobId ?? 0),
      enabled: outlineJobId !== null,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "queued" || status === "running" ? 1500 : false;
      },
      refetchIntervalInBackground: true,
      staleTime: 0,
    },
  });

  useEffect(() => {
    if (!outlineJob || (outlineJob.status !== "succeeded" && outlineJob.status !== "failed")) return;
    localStorage.removeItem("hasaad:presentation-outline-job");
    localStorage.removeItem("hasaad:presentation-outline-recovery");
    setOutlineJobId(null);
    outlineIdempotencyKey.current = crypto.randomUUID();
    if (outlineJob.status === "failed") {
      toast.error(outlineJob.errorMessage ?? (isAr ? "تعذّر توليد المخطط." : "Could not generate outline."));
      return;
    }
    const data = outlineJob.result as PresentationDraftWithGuardrails | null;
    if (!data) return;
    const { guardrails, ...rest } = data;
    setDraft(rest as PresentationDraft);
    setGuardrailFeedback(guardrails?.feedback ?? []);
    setStep("outline");
    qc.invalidateQueries({ queryKey: getListPresentationDraftsQueryKey() });
    refreshCreditsBalance();
  }, [outlineJob, isAr, qc, refreshCreditsBalance]);

  useEffect(() => {
    if (!open || recoveredRef.current || outlineJobId !== null) return;
    if (!savedOutlineRecovery?.brief || savedOutlineRecovery.teacherId !== currentTeacher?.id) return;
    recoveredRef.current = true;
    generate.mutate({ data: savedOutlineRecovery.brief }, {
      onSuccess: (job) => {
        setOutlineJobId(job.id);
        localStorage.setItem("hasaad:presentation-outline-job", String(job.id));
      },
    });
  }, [open, outlineJobId, currentTeacher?.id]);

  const update = useUpdatePresentationDraft({
    mutation: {
      onSuccess: (row: PresentationDraft) => {
        setDraft(row);
        qc.invalidateQueries({ queryKey: getListPresentationDraftsQueryKey() });
      },
      onError: () => toast.error(isAr ? "تعذّر الحفظ." : "Save failed."),
    },
  });

  const submitBrief = (brief: PresentationBrief) => {
    setLastBrief(brief);
    localStorage.setItem("hasaad:presentation-outline-recovery", JSON.stringify({
      teacherId: currentTeacher?.id,
      key: outlineIdempotencyKey.current,
      brief,
    }));
    generate.mutate({ data: brief }, {
      onSuccess: (job) => {
        setOutlineJobId(job.id);
        localStorage.setItem("hasaad:presentation-outline-job", String(job.id));
      },
    });
  };

  const outlinePending = generate.isPending ||
    outlineJob?.status === "queued" ||
    outlineJob?.status === "running";

  const saveDraft = async (outline: PresentationOutline) => {
    if (!draft) return;
    await update.mutateAsync({
      id: draft.id,
      data: { outline, status: "draft" },
    });
    toast.success(isAr ? "تم حفظ المسودة." : "Draft saved.");
  };

  /* Approve → mark outline_ready → immediately open the build modal
     so the teacher sees real progress instead of a stale "coming soon"
     placeholder. The dialog stays open behind the build modal so the
     teacher can fall back to the outline if the build fails. */
  const approve = async (outline: PresentationOutline) => {
    if (!draft) return;
    try {
      const updated = await update.mutateAsync({
        id: draft.id,
        data: { outline, status: "outline_ready" },
      });
      setDraft(updated);
      setShowBuild(true);
    } catch {
      toast.error(isAr ? "تعذّر اعتماد المخطط. راجع الشرائح وحاول مرة أخرى." : "Could not approve the outline. Review the slides and try again.");
    }
  };

  /* When the build succeeds, close the orchestrator dialog so the
     teacher lands cleanly in the editor route after navigation. */
  const handleBuildSuccess = (_presentationId: number) => {
    onOpenChange(false);
  };

  const totalSlides = draft?.outline?.slides?.length ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Flex-column layout: header (fixed) → scrollable body → sticky footer.
            This ensures the Generate button is always visible even on small
            screens with many advanced-option fields open. */}
        <DialogContent
          className="max-w-3xl p-0 gap-0 flex flex-col overflow-hidden"
          style={{ maxHeight: "90vh" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: BRAND_GREEN }}>
              <Sparkles className="h-5 w-5" />
              {isAr ? "مساعد بناء العرض" : "AI presentation builder"}
            </DialogTitle>
            <DialogDescription>
              {outlinePending
                ? (isAr
                    ? "يجري إنشاء العرض في الخلفية. يمكنك إغلاق النافذة والعودة لاحقًا دون فقدان التوليد."
                    : "Your outline is generating in the background. You can close this dialog and return later.")
                : step === "brief"
                ? (isAr
                    ? "املأ المُدخلات وسننتج لك مخططاً قابلاً للمراجعة قبل بناء الشرائح."
                    : "Fill the brief; we'll produce a reviewable outline before any slides are built.")
                : (isAr
                    ? "راجع المخطط وعدّله — ستُبنى الشرائح فور اعتمادك."
                    : "Review and edit the outline — slides build as soon as you approve.")}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {step === "brief" ? (
              <BriefForm
                ref={briefRef}
                 loading={outlinePending}
                onSubmit={submitBrief}
                initial={lastBrief ?? (initialDraft?.brief as PresentationBrief | undefined)}
                onValidityChange={(valid) => setBriefValid(valid)}
              />
            ) : draft ? (
              <>
              <DesignPicker value={designChoice} onChange={setDesignChoice} isAr={isAr} />
              <OutlineReview
                key={`${draft.id}-${draft.updatedAt}`}
                draft={draft}
                guardrailFeedback={guardrailFeedback}
                onSaveDraft={saveDraft}
                onApprove={approve}
                onBack={() => setStep("brief")}
                saving={update.isPending && update.variables?.data?.status === "draft"}
                approving={update.isPending && update.variables?.data?.status === "outline_ready"}
              />
              </>
            ) : null}
          </div>

          {/* Sticky footer — only shown on the brief step; outline step
              has its own action buttons rendered by OutlineReview. */}
          {step === "brief" && (
            <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-3 bg-background">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                 disabled={outlinePending}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={() => briefRef.current?.submit()}
                 disabled={!briefValid || outlinePending}
                style={{ background: BRAND_GREEN, color: "white" }}
                className="gap-2 font-bold min-w-[140px]"
              >
                 {outlinePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isAr ? "جارٍ التوليد…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {isAr ? "توليد المخطط" : "Generate outline"}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Phase 1B build — fires once the outline is approved. */}
      {draft && (
        <BuildProgress
          draftId={draft.id}
          totalSlides={totalSlides}
          open={showBuild}
          theme={designChoice || undefined}
          onOpenChange={setShowBuild}
          onSuccess={handleBuildSuccess}
        />
      )}
    </>
  );
}

export default AiPresentationBuilder;
