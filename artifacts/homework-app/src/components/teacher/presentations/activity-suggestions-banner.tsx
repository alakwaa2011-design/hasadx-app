import { useMemo, useState } from "react";
import { Hand, X, MessageCircle, BarChart3, Activity, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useGetPresentationDraft,
  getGetPresentationDraftQueryKey,
  type PresentationDraft,
} from "@workspace/api-client-react";

const BRAND_GREEN = "#225739";

export interface ActivitySuggestion {
  /* Outline index (1-based, matches OutlineCard.index). */
  outlineIndex: number;
  /* Hint kind reported by the AI: poll | quiz | discussion | activity. */
  kind: string;
  /* Slide title at outline time — useful for tooltips. */
  title: string;
}

/* Mode the parent should use when handling an accepted suggestion:
   - "picker": open the activity picker prefilled with the suggestion's
     prompt + kind so the teacher can confirm/tweak before inserting.
   - "quick":  insert the activity directly into the slide without
     opening the picker (used for high-confidence hints like
     "discussion" that map cleanly to an open-answer activity). */
export type SuggestionAcceptMode = "picker" | "quick";

interface Props {
  draftId: number;
  isAr: boolean;
  /* Called when the teacher clicks a chip; jumps to the slide. */
  onJumpToSlide?: (slideIndex0Based: number) => void;
  /* Called when the teacher accepts a suggestion. The banner only
     auto-dismisses the chip for the "quick" path (where insertion is
     synchronous and guaranteed). For the "picker" path the parent
     owns dismissal and must report it back via `externallyDismissed`
     once the activity is actually inserted, so cancelling the picker
     keeps the suggestion on the banner. */
  onAcceptSuggestion?: (s: ActivitySuggestion, mode: SuggestionAcceptMode) => void;
  /* Outline indices the parent considers dismissed (e.g. after a
     picker-mode insertion succeeds). Unioned with the banner's own
     internal dismiss set. */
  externallyDismissed?: ReadonlySet<number>;
}

/* Hints that map to an activity that needs no further authoring
   (open-answer with the slide title as prompt). For these the chip
   exposes a one-click "Quick add" lightning button. */
const QUICK_ADD_KINDS = new Set(["discussion"]);

const HINT_LABEL_AR: Record<string, string> = {
  poll: "استطلاع",
  quiz: "اختبار قصير",
  discussion: "نقاش",
  activity: "نشاط",
};
const HINT_LABEL_EN: Record<string, string> = {
  poll: "Poll",
  quiz: "Quick quiz",
  discussion: "Discussion",
  activity: "Activity",
};

function HintIcon({ kind }: { kind: string }) {
  if (kind === "poll") return <BarChart3 className="h-3.5 w-3.5" />;
  if (kind === "discussion") return <MessageCircle className="h-3.5 w-3.5" />;
  if (kind === "quiz") return <Activity className="h-3.5 w-3.5" />;
  return <Hand className="h-3.5 w-3.5" />;
}

/* Phase 1B activity-suggestions banner.
   Surfaces per-slide AI interaction hints next to the editor canvas
   so the teacher can either Accept (insert via the activity picker)
   or Dismiss each suggestion individually. We never auto-insert —
   spec mandates teacher-driven acceptance. */
export function ActivitySuggestionsBanner({
  draftId,
  isAr,
  onJumpToSlide,
  onAcceptSuggestion,
  externallyDismissed,
}: Props) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [perChipDismissed, setPerChipDismissed] = useState<Set<number>>(new Set());

  const { data: draft } = useGetPresentationDraft(draftId, {
    query: {
      queryKey: getGetPresentationDraftQueryKey(draftId),
      enabled: Number.isFinite(draftId) && draftId > 0,
      staleTime: 5 * 60 * 1000,
    },
  });

  const suggestions = useMemo<ActivitySuggestion[]>(() => {
    const d = draft as PresentationDraft | undefined;
    const slides = d?.outline?.slides ?? [];
    return slides
      .filter((s) => s.interactionHint)
      .map((s) => ({
        outlineIndex: s.index,
        kind: String(s.interactionHint),
        title: s.title,
      }))
      .filter((s) =>
        !perChipDismissed.has(s.outlineIndex) &&
        !(externallyDismissed?.has(s.outlineIndex) ?? false),
      );
  }, [draft, perChipDismissed, externallyDismissed]);

  if (bannerDismissed || suggestions.length === 0) return null;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="mx-3 mb-2 mt-3 flex items-start gap-3 rounded-lg border bg-emerald-50/60 p-3 text-sm"
      style={{ borderColor: `${BRAND_GREEN}33` }}
    >
      <Hand className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND_GREEN }} />
      <div className="flex-1 min-w-0">
        <div className="mb-1.5 font-semibold" style={{ color: BRAND_GREEN }}>
          {isAr
            ? `اقتراحات تفاعل من المخطط (${suggestions.length})`
            : `Suggested interactions (${suggestions.length})`}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((s) => {
            const label = (isAr ? HINT_LABEL_AR : HINT_LABEL_EN)[s.kind] ?? s.kind;
            const accept = (mode: SuggestionAcceptMode) => {
              /* Dismissal is parent-confirmed for both paths: the
                 editor knows whether the activity was actually
                 inserted (quick path always succeeds when slide index
                 is valid; picker path only succeeds on confirm) and
                 reports the dismissed key back via
                 `externallyDismissed`. This avoids removing a chip
                 when the editor decides to reject the suggestion
                 (e.g. stale outline index after slide edits). */
              onAcceptSuggestion?.(s, mode);
            };
            const showQuickAdd = QUICK_ADD_KINDS.has(s.kind);
            return (
              <div
                key={s.outlineIndex}
                className="inline-flex items-center gap-1 rounded-full border bg-white px-1 py-0.5 text-xs font-medium"
                style={{ borderColor: `${BRAND_GREEN}55`, color: BRAND_GREEN }}
                title={s.title}
              >
                <button
                  type="button"
                  onClick={() => onJumpToSlide?.(s.outlineIndex - 1)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-emerald-50"
                >
                  <HintIcon kind={s.kind} />
                  <span>
                    {isAr ? `شريحة ${s.outlineIndex}` : `Slide ${s.outlineIndex}`} · {label}
                  </span>
                </button>
                {showQuickAdd && (
                  <button
                    type="button"
                    onClick={() => accept("quick")}
                    className="rounded-full p-1 text-amber-600 hover:bg-amber-100"
                    title={isAr ? "إضافة سريعة" : "Quick add"}
                    aria-label={isAr ? "إضافة سريعة" : "Quick add"}
                  >
                    <Zap className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => accept("picker")}
                  className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
                  title={isAr ? "إضافة مع التحرير" : "Add (edit first)"}
                  aria-label={isAr ? "إضافة مع التحرير" : "Add (edit first)"}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPerChipDismissed((prev) => {
                      const next = new Set(prev);
                      next.add(s.outlineIndex);
                      return next;
                    })
                  }
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title={isAr ? "تجاهل" : "Dismiss"}
                  aria-label={isAr ? "تجاهل" : "Dismiss"}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {suggestions.length > 8 && (
            <span className="text-xs italic text-slate-500 self-center">
              {isAr ? `و${suggestions.length - 8} أخرى` : `and ${suggestions.length - 8} more`}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 shrink-0 p-0 text-slate-500"
        onClick={() => setBannerDismissed(true)}
        aria-label={isAr ? "إغلاق" : "Dismiss all"}
        title={isAr ? "إغلاق الكل" : "Dismiss all"}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default ActivitySuggestionsBanner;
