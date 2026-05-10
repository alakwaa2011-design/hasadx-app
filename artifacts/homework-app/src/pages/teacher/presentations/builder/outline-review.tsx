import { useMemo, useState } from "react";
import type { PresentationDraft, PresentationOutline, OutlineSlideCard } from "@workspace/api-client-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Save, CheckCircle2, ArrowRight, ArrowLeft, Clock, Layers } from "lucide-react";
import { OutlineCard } from "./outline-card";
import { OutlineObjectives } from "./outline-objectives";
import { useI18n } from "@/lib/i18n";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

interface Props {
  draft: PresentationDraft;
  guardrailFeedback?: string[];
  onSaveDraft: (outline: PresentationOutline) => Promise<void>;
  onApprove: (outline: PresentationOutline) => Promise<void>;
  onBack: () => void;
  saving: boolean;
  approving: boolean;
}

const STAGE_LABEL_AR: Record<string, string> = {
  opener: "افتتاح",
  concept: "شرح المفهوم",
  practice: "تطبيق",
  closure: "خاتمة",
};
const STAGE_LABEL_EN: Record<string, string> = {
  opener: "Opener",
  concept: "Concept",
  practice: "Practice",
  closure: "Closure",
};

export function OutlineReview({ draft, guardrailFeedback, onSaveDraft, onApprove, onBack, saving, approving }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const initialOutline = draft.outline as PresentationOutline;
  const [outline, setOutline] = useState<PresentationOutline>(initialOutline);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const allowSubtitle = outline.density === "detailed";
  const maxPoints = outline.density === "detailed" ? 6 : outline.density === "minimal" ? 3 : 4;

  /* Reindex + rebuild teachingFlow whenever the slides array mutates so
     drag/drop and delete operations don't leave dangling indices in
     the flow stages. */
  function syncIndicesAndFlow(nextSlides: OutlineSlideCard[]): PresentationOutline {
    const reindexed = nextSlides.map((s, i) => ({ ...s, index: i + 1 }));
    const total = reindexed.length;
    if (total === 0) return { ...outline, slides: reindexed, teachingFlow: outline.teachingFlow };

    /* Preserve the per-stage minute budgets the model produced; just
       redistribute slide indices proportionally — opener=1, closure=1,
       remaining split ~60/40 between concept/practice. */
    const opener = [1];
    const closure = [total];
    const middle = reindexed.slice(1, -1).map((s) => s.index);
    const conceptCount = Math.max(0, Math.ceil(middle.length * 0.6));
    const concept = middle.slice(0, conceptCount);
    const practice = middle.slice(conceptCount);

    const stageMinutes = (stage: string, fallback: number) =>
      outline.teachingFlow.find((f) => f.stage === stage)?.estimatedMinutes ?? fallback;

    const teachingFlow = [
      { stage: "opener" as const,   slideIndices: opener,                             estimatedMinutes: stageMinutes("opener", 5) },
      { stage: "concept" as const,  slideIndices: concept.length ? concept : opener,  estimatedMinutes: stageMinutes("concept", 20) },
      { stage: "practice" as const, slideIndices: practice.length ? practice : closure, estimatedMinutes: stageMinutes("practice", 15) },
      { stage: "closure" as const,  slideIndices: closure,                            estimatedMinutes: stageMinutes("closure", 5) },
    ];
    return { ...outline, slides: reindexed, teachingFlow };
  }

  const handleSlideChange = (index: number, next: OutlineSlideCard) => {
    const slides = outline.slides.slice();
    slides[index] = next;
    setOutline({ ...outline, slides });
  };

  const handleDelete = (index: number) => {
    if (outline.slides.length <= 3) return;
    const slides = outline.slides.filter((_, i) => i !== index);
    setOutline(syncIndicesAndFlow(slides));
  };

  const handleAdd = () => {
    if (outline.slides.length >= 30) return;
    const newCard: OutlineSlideCard = {
      index: outline.slides.length + 1,
      kind: "concept-card",
      title: isAr ? "شريحة جديدة" : "New slide",
      purpose: isAr ? "—" : "—",
      talkingPoints: [isAr ? "..." : "..."],
      interactionHint: null,
      visualDirection: {},
    };
    setOutline(syncIndicesAndFlow([...outline.slides, newCard]));
  };

  const handleObjectives = (next: string[]) => {
    if (next.length < 2) return;
    setOutline({ ...outline, objectives: next });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = outline.slides.findIndex((s) => String(s.index) === String(active.id));
    const newIndex = outline.slides.findIndex((s) => String(s.index) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(outline.slides, oldIndex, newIndex);
    setOutline(syncIndicesAndFlow(moved));
  };

  const ids = useMemo(() => outline.slides.map((s) => String(s.index)), [outline.slides]);

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {isAr ? "تعديل المُدخلات" : "Edit brief"}
          </Button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {outline.slides.length}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {outline.totalEstimatedMinutes}{isAr ? " د" : "min"}</span>
        </div>
      </div>

      {guardrailFeedback && guardrailFeedback.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          <div className="font-semibold flex items-center gap-1">
            <Sparkles /> {isAr ? "تم تطبيق التحسينات التالية على ناتج النموذج:" : "These adjustments were applied to the model output:"}
          </div>
          <ul className="list-disc ms-5 space-y-0.5">
            {guardrailFeedback.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      ) : null}

      <OutlineObjectives objectives={outline.objectives} onChange={handleObjectives} />

      <section className="rounded-xl border bg-card p-4 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: BRAND_GREEN }}>
          <Clock className="h-4 w-4" /> {isAr ? "تدفّق الحصة" : "Teaching flow"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {outline.teachingFlow.map((f) => (
            <div key={f.stage} className="rounded-lg border p-2 text-xs">
              <div className="font-semibold" style={{ color: BRAND_GOLD }}>
                {(isAr ? STAGE_LABEL_AR : STAGE_LABEL_EN)[f.stage] ?? f.stage}
              </div>
              <div className="text-muted-foreground mt-1">
                {isAr ? `الشرائح: ${f.slideIndices.join(", ")}` : `Slides: ${f.slideIndices.join(", ")}`}
              </div>
              <div className="text-muted-foreground">
                {f.estimatedMinutes}{isAr ? " د" : "min"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: BRAND_GREEN }}>
            {isAr ? `الشرائح (${outline.slides.length})` : `Slides (${outline.slides.length})`}
          </h3>
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={outline.slides.length >= 30} className="gap-1 h-8">
            <Plus className="h-3.5 w-3.5" />
            {isAr ? "بطاقة فارغة" : "Blank card"}
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {outline.slides.map((slide, idx) => (
                <OutlineCard
                  key={`${slide.index}-${idx}`}
                  slide={slide}
                  onChange={(next) => handleSlideChange(idx, next)}
                  onDelete={() => handleDelete(idx)}
                  allowSubtitle={allowSubtitle}
                  maxPoints={maxPoints}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-t bg-background flex flex-col sm:flex-row gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => onSaveDraft(outline)}
          disabled={saving || approving}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isAr ? "حفظ كمسودة" : "Save draft"}
        </Button>
        <Button
          onClick={() => onApprove(outline)}
          disabled={saving || approving}
          className="gap-2 font-bold"
          style={{ background: BRAND_GREEN }}
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isAr ? "اعتمد المخطط" : "Approve outline"}
        </Button>
      </div>
    </div>
  );
}

function Sparkles() {
  return <span aria-hidden>✨</span>;
}
