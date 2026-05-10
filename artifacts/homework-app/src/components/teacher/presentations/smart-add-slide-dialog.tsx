import { useState } from "react";
import type { Slide } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import * as LucideIcons from "lucide-react";

const BRAND_GREEN = "#225739";
const API_BASE = import.meta.env.VITE_API_URL || "";

type SlideKind =
  | "concept-card" | "interactive" | "steps" | "comparison"
  | "visual-hero" | "objectives" | "stat" | "quote"
  | "closure" | "callout" | "timeline" | "formula";

interface KindOption {
  key: SlideKind;
  icon: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  color: string;
}

const KIND_OPTIONS: KindOption[] = [
  { key: "concept-card",  icon: "Brain",          labelAr: "شرح وتعريف",     labelEn: "Concept",     descAr: "فكرة محورية مع نقاط شرح",    descEn: "Key concept with points",   color: "#3b82f6" },
  { key: "interactive",   icon: "Zap",            labelAr: "نشاط وأسئلة",    labelEn: "Activity",    descAr: "أسئلة تفاعلية للفصل",        descEn: "Interactive class quiz",    color: "#f59e0b" },
  { key: "steps",         icon: "ListOrdered",    labelAr: "خطوات",           labelEn: "Steps",       descAr: "إجراءات متسلسلة",             descEn: "Sequential procedure",      color: "#10b981" },
  { key: "comparison",    icon: "ArrowLeftRight", labelAr: "مقارنة",          labelEn: "Comparison",  descAr: "مقارنة بين طرفين أو خيارين",  descEn: "Two sides comparison",      color: "#8b5cf6" },
  { key: "visual-hero",   icon: "Eye",            labelAr: "عرض بصري",        labelEn: "Visual",      descAr: "مفهوم بصري مع نقاط داعمة",   descEn: "Visual concept intro",      color: "#ec4899" },
  { key: "objectives",    icon: "Target",         labelAr: "أهداف الدرس",     labelEn: "Objectives",  descAr: "قائمة أهداف الدرس",           descEn: "Lesson objectives list",    color: "#06b6d4" },
  { key: "stat",          icon: "TrendingUp",     labelAr: "إحصائية",         labelEn: "Statistic",   descAr: "رقم أو إحصائية مثيرة",        descEn: "Striking number or stat",   color: "#f97316" },
  { key: "quote",         icon: "Quote",          labelAr: "اقتباس",          labelEn: "Quote",       descAr: "حكمة أو اقتباس مُلهم",        descEn: "Inspirational quote",       color: "#6366f1" },
  { key: "closure",       icon: "CheckCircle",    labelAr: "خلاصة وملخص",     labelEn: "Summary",     descAr: "تلخيص نهائي للدرس",           descEn: "Final lesson recap",        color: "#14b8a6" },
  { key: "callout",       icon: "AlertTriangle",  labelAr: "تنبيه مهم",       labelEn: "Callout",     descAr: "ملاحظة أو تحذير لا يُفوَّت",  descEn: "Important note or warning", color: "#ef4444" },
  { key: "timeline",      icon: "Clock",          labelAr: "تسلسل زمني",      labelEn: "Timeline",    descAr: "أحداث على محور زمني",          descEn: "Chronological events",      color: "#84cc16" },
  { key: "formula",       icon: "Calculator",     labelAr: "قاعدة / معادلة",  labelEn: "Formula",     descAr: "معادلة أو قاعدة علمية",       descEn: "Scientific rule or formula", color: "#a855f7" },
];

export function SmartAddSlideDialog({
  open,
  onClose,
  onInsert,
  onBlank,
  presentationId,
  isAr,
  deckTitle,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (slide: Slide) => void;
  onBlank: () => void;
  presentationId: number;
  isAr: boolean;
  deckTitle: string;
  theme: string;
}) {
  const [selectedKind, setSelectedKind] = useState<SlideKind | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const dir = isAr ? "rtl" : "ltr";

  function handleClose() {
    if (loading) return;
    setSelectedKind(null);
    setPrompt("");
    onClose();
  }

  async function handleGenerate() {
    if (!selectedKind) {
      toast.error(isAr ? "اختر نوع الشريحة أولاً" : "Please select a slide type first");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/presentations/ai/single-slide`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId,
          kind: selectedKind,
          prompt: prompt.trim(),
          theme,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const { slide } = await res.json() as { slide: Slide };
      onInsert(slide);
      setSelectedKind(null);
      setPrompt("");
      onClose();
      toast.success(isAr ? "تمت إضافة الشريحة" : "Slide added");
    } catch (e) {
      toast.error(
        isAr ? "تعذّر توليد الشريحة" : "Failed to generate slide",
        { description: (e as Error).message },
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBlank() {
    setSelectedKind(null);
    setPrompt("");
    onClose();
    onBlank();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl"
        dir={dir}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-bold" style={{ color: BRAND_GREEN }}>
            {isAr ? "إضافة شريحة ذكية" : "Smart Add Slide"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAr
              ? "اختر نوع الشريحة — والذكاء يولّد المحتوى المناسب لعرضك"
              : "Pick a slide type — AI generates matching content for your deck"}
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {KIND_OPTIONS.map((opt) => {
              const IconComp = (LucideIcons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[opt.icon];
              const selected = selectedKind === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedKind(opt.key)}
                  className={[
                    "flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition-all text-center cursor-pointer",
                    "hover:border-current hover:shadow-sm",
                    selected
                      ? "shadow-md ring-2 ring-offset-1"
                      : "border-border bg-card hover:bg-muted/30",
                  ].join(" ")}
                  style={selected ? {
                    borderColor: opt.color,
                    background: `${opt.color}12`,
                  } : {}}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm"
                    style={{ background: selected ? opt.color : `${opt.color}22` }}
                  >
                    {IconComp && (
                      <IconComp
                        className="w-4 h-4"
                        style={{ color: selected ? "white" : opt.color }}
                      />
                    )}
                  </span>
                  <span
                    className="text-xs font-semibold leading-tight"
                    style={{ color: selected ? opt.color : undefined }}
                  >
                    {isAr ? opt.labelAr : opt.labelEn}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                    {isAr ? opt.descAr : opt.descEn}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedKind && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {isAr ? "عنوان الشريحة أو تعليمات إضافية (اختياري)" : "Slide title or extra instructions (optional)"}
              </label>
              <Input
                dir={dir}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  isAr
                    ? "مثال: قانون نيوتن الثالث، أو اكتب ما تريد في الشريحة"
                    : "e.g. Newton's third law, or describe what you want"
                }
                className="text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleGenerate(); }}
                disabled={loading}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "اتركه فارغاً وسيستخدم الذكاء عنوان العرض تلقائياً"
                  : "Leave empty and AI will use the deck title automatically"}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-muted/20">
          <button
            type="button"
            onClick={handleBlank}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            {isAr ? "إضافة شريحة فارغة" : "Add blank slide"}
          </button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              disabled={!selectedKind || loading}
              onClick={handleGenerate}
              className="gap-2 rounded-lg font-bold min-w-[130px]"
              style={{ background: BRAND_GREEN, color: "white" }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ التوليد…" : "Generating…"}</>
              ) : (
                <><Plus className="w-4 h-4" />{isAr ? "أضف بالذكاء" : "Add with AI"}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
