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
  useGeneratePresentationOutline,
  useGetPresentationAiLimits,
  useUpdatePresentationDraft,
  getGetPresentationAiLimitsQueryKey,
  getListPresentationDraftsQueryKey,
  type PresentationBrief,
  type PresentationDraft,
  type PresentationDraftWithGuardrails,
  type PresentationOutline,
} from "@workspace/api-client-react";
import { BriefForm, type BriefFormHandle } from "./brief-form";
import { OutlineReview } from "./outline-review";
import { BuildProgress } from "./build-progress";

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
  const [lastBrief, setLastBrief] = useState<PresentationBrief | undefined>(undefined);

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
    }
  }, [open, initialDraft]);

  const { data: limits } = useGetPresentationAiLimits({
    query: { queryKey: getGetPresentationAiLimitsQueryKey(), enabled: open },
  });

  const generate = useGeneratePresentationOutline({
    mutation: {
      onSuccess: (data: PresentationDraftWithGuardrails) => {
        const { guardrails, ...rest } = data;
        setDraft(rest as PresentationDraft);
        setGuardrailFeedback(guardrails?.feedback ?? []);
        setStep("outline");
        qc.invalidateQueries({ queryKey: getGetPresentationAiLimitsQueryKey() });
        qc.invalidateQueries({ queryKey: getListPresentationDraftsQueryKey() });
      },
      onError: (err: unknown) => {
        const e = err as { status?: number; data?: { message?: string } };
        const msg = e?.data?.message ?? (isAr ? "تعذّر توليد المخطط." : "Could not generate outline.");
        toast.error(msg);
      },
    },
  });

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
    generate.mutate({ data: brief });
  };

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
    const updated = await update.mutateAsync({
      id: draft.id,
      data: { outline, status: "outline_ready" },
    });
    setDraft(updated);
    setShowBuild(true);
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
              {step === "brief"
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
                limits={limits}
                loading={generate.isPending}
                onSubmit={submitBrief}
                initial={lastBrief ?? (initialDraft?.brief as PresentationBrief | undefined)}
                onValidityChange={(valid) => setBriefValid(valid)}
              />
            ) : draft ? (
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
            ) : null}
          </div>

          {/* Sticky footer — only shown on the brief step; outline step
              has its own action buttons rendered by OutlineReview. */}
          {step === "brief" && (
            <div className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-3 bg-background">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={generate.isPending}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={() => briefRef.current?.submit()}
                disabled={!briefValid || generate.isPending}
                style={{ background: BRAND_GREEN, color: "white" }}
                className="gap-2 font-bold min-w-[140px]"
              >
                {generate.isPending ? (
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
          onOpenChange={setShowBuild}
          onSuccess={handleBuildSuccess}
        />
      )}
    </>
  );
}

export default AiPresentationBuilder;
