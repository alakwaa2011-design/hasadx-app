import { useState } from "react";
import type {
  OutlineSlideCard,
  OutlineSlideCardInteractionHint,
  OutlineVisualDirection,
} from "@workspace/api-client-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GripVertical,
  Trash2,
  Pencil,
  Check,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

const KIND_OPTIONS: OutlineSlideCard["kind"][] = [
  "title", "objectives", "concept-card", "comparison", "visual-hero",
  "steps", "interactive", "closure", "timeline", "formula",
  "stat", "quote", "callout",
];

const INTERACTION_OPTIONS = ["poll", "quiz", "discussion", "activity"] as const;

interface Props {
  slide: OutlineSlideCard;
  onChange: (next: OutlineSlideCard) => void;
  onDelete: () => void;
  allowSubtitle: boolean;
  maxPoints: number;
}

export function OutlineCard({ slide, onChange, onDelete, allowSubtitle, maxPoints }: Props) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [editing, setEditing] = useState(false);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: String(slide.index) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateField = <K extends keyof OutlineSlideCard>(key: K, value: OutlineSlideCard[K]) => {
    onChange({ ...slide, [key]: value });
  };

  const updatePoint = (i: number, v: string) => {
    const next = (slide.talkingPoints ?? []).slice();
    next[i] = v.slice(0, 140);
    updateField("talkingPoints", next as OutlineSlideCard["talkingPoints"]);
  };

  const addPoint = () => {
    const next = (slide.talkingPoints ?? []).slice();
    if (next.length >= maxPoints) return;
    next.push(isAr ? "نقطة جديدة" : "New point");
    updateField("talkingPoints", next as OutlineSlideCard["talkingPoints"]);
  };

  const removePoint = (i: number) => {
    const next = (slide.talkingPoints ?? []).filter((_: string, idx: number) => idx !== i);
    if (next.length === 0) return;
    updateField("talkingPoints", next as OutlineSlideCard["talkingPoints"]);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      dir={isAr ? "rtl" : "ltr"}
      className="rounded-xl border bg-card overflow-hidden"
    >
      <div className="flex items-stretch">
        <button
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-9 bg-muted/40 hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
          aria-label={isAr ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex-1 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 px-2 py-0.5 rounded-md text-xs font-bold text-white"
                style={{ background: BRAND_GREEN }}
              >
                #{slide.index}
              </span>
              {editing ? (
                <Select value={slide.kind} onValueChange={(v) => updateField("kind", v as OutlineSlideCard["kind"])}>
                  <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground truncate">{slide.kind}</span>
              )}
              {slide.interactionHint ? (
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                  style={{ background: `${BRAND_GOLD}20`, color: BRAND_GOLD }}
                >
                  <Sparkles className="h-2.5 w-2.5" /> {slide.interactionHint}
                </span>
              ) : null}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing((v) => !v)}
                title={editing ? (isAr ? "تم" : "Done") : (isAr ? "تعديل" : "Edit")}
              >
                {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title={isAr ? "حذف" : "Delete"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {editing ? (
            <Input
              value={slide.title}
              onChange={(e) => updateField("title", e.target.value.slice(0, 80) as OutlineSlideCard["title"])}
              maxLength={80}
              className="font-semibold"
            />
          ) : (
            <h4 className="font-semibold text-sm truncate">{slide.title}</h4>
          )}

          {allowSubtitle && (editing || slide.subtitle) ? (
            editing ? (
              <Input
                value={slide.subtitle ?? ""}
                onChange={(e) => updateField("subtitle", e.target.value || undefined)}
                maxLength={80}
                placeholder={isAr ? "عنوان فرعي (اختياري)" : "Subtitle (optional)"}
                className="text-sm"
              />
            ) : (
              <p className="text-xs text-muted-foreground">{slide.subtitle}</p>
            )
          ) : null}

          {editing ? (
            <Textarea
              value={slide.purpose}
              onChange={(e) => updateField("purpose", e.target.value.slice(0, 140) as OutlineSlideCard["purpose"])}
              maxLength={140}
              rows={2}
              placeholder={isAr ? "هدف الشريحة" : "Slide purpose"}
              className="text-xs"
            />
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-2">
              <span className="font-semibold">{isAr ? "الهدف: " : "Purpose: "}</span>
              {slide.purpose}
            </p>
          )}

          <ul className="space-y-1.5 pt-1">
            {(slide.talkingPoints ?? []).map((p: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-foreground/60 shrink-0" />
                {editing ? (
                  <>
                    <Input
                      value={p}
                      onChange={(e) => updatePoint(i, e.target.value)}
                      maxLength={140}
                      className="text-xs h-7"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removePoint(i)}
                      disabled={(slide.talkingPoints ?? []).length <= 1}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs">{p}</span>
                )}
              </li>
            ))}
          </ul>

          {editing && (slide.talkingPoints ?? []).length < maxPoints ? (
            <Button variant="ghost" size="sm" onClick={addPoint} className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              {isAr ? "نقطة" : "Point"}
            </Button>
          ) : null}

          {editing ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Select
                value={slide.interactionHint ?? "none"}
                onValueChange={(v) => updateField("interactionHint", v === "none" ? null : (v as OutlineSlideCardInteractionHint))}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isAr ? "بدون تفاعل" : "No interaction"}</SelectItem>
                  {INTERACTION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={slide.visualDirection?.icon ?? ""}
                onChange={(e) => {
                  const next: OutlineVisualDirection = {
                    ...(slide.visualDirection ?? {}),
                    icon: e.target.value.slice(0, 40) || undefined,
                  };
                  updateField("visualDirection", next);
                }}
                placeholder={isAr ? "أيقونة (Lucide)" : "Icon (Lucide)"}
                className="text-xs h-7"
                maxLength={40}
              />
            </div>
          ) : (slide.visualDirection?.icon || slide.visualDirection?.shape) ? (
            <div className="text-[11px] text-muted-foreground">
              {isAr ? "بصرياً: " : "Visual: "}
              {[slide.visualDirection?.icon, slide.visualDirection?.shape, slide.visualDirection?.layoutHint]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}

          {slide.source ? (
            <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
              {isAr ? "المصدر المقترح: " : "Suggested source: "}{slide.source}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
