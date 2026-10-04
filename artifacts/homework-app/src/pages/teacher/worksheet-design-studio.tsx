import { useMemo, useState } from "react";
import { Check, RotateCcw, Sparkles, Briefcase, Baby } from "lucide-react";
import type { WorksheetSettings } from "@workspace/api-zod";
import { THEMES, THEME_BACKGROUNDS, type ThemeId } from "./worksheet-themes";
import { getDesign, type WorksheetDesign } from "./worksheet-design-styles";

interface Props {
  settings: WorksheetSettings;
  onPatch: (patch: Partial<WorksheetSettings>) => void;
  ar: boolean;
  disabled?: boolean;
}

const PRO = new Set(["geometric", "exam_paper", "modern_band", "editorial", "studio_pro", "math_grid", "science_lab"]);
const KIDS = new Set(["kids_play", "pastel_garden", "space_journey", "storybook"]);
type Filter = "all" | "pro" | "kids";

function MiniSheet({ id, c1, c2, bg }: { id: string; c1: string; c2: string; bg: string }) {
  const kid = KIDS.has(id);
  return (
    <svg viewBox="0 0 60 80" className="w-full h-auto rounded-sm border border-black/10" role="img" aria-hidden="true">
      <rect width="60" height="80" fill={bg} />
      {id === "math_grid" && Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 5} 0V80M0 ${i * 7}H60`} stroke={c1} strokeOpacity=".15" strokeWidth=".4" />)}
      <rect x="0" y="0" width="60" height={kid ? 14 : 11} fill={c1} rx={kid ? 0 : 0} />
      <rect x="10" y="4" width="26" height="3" rx="1.5" fill="#fff" opacity=".9" />
      {[0, 1, 2].map(i => (
        <g key={i}>
          <rect x="7" y={20 + i * 17} width="7" height="7" rx={kid ? 3.5 : 1.5} fill={i === 1 ? c2 : c1} />
          <rect x="18" y={21 + i * 17} width="30" height="2" rx="1" fill={c1} opacity=".5" />
          <path d={`M18 ${30 + i * 17}H52`} stroke={c1} strokeOpacity=".4" strokeDasharray={kid ? "1.5 1.5" : undefined} strokeWidth=".8" />
        </g>
      ))}
      {id === "space_journey" && <circle cx="50" cy="66" r="6" fill={c2} />}
      {id === "pastel_garden" && <path d="M0 80C0 66 6 60 14 58" stroke={c2} strokeWidth="2" fill="none" />}
      {id === "storybook" && <path d="M0 80V72C15 66 30 76 60 70V80Z" fill={c2} opacity=".6" />}
      {id === "studio_pro" && <path d="M0 0H14L0 14Z" fill={c2} />}
    </svg>
  );
}

function Seg<T extends string>({ label, value, opts, onChange, disabled, tid }: {
  label: string; value: T | undefined; opts: [T, string][]; onChange: (v: T) => void; disabled?: boolean; tid: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold mb-1 text-muted-foreground">{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {opts.map(([v, l]) => (
          <button key={v} type="button" disabled={disabled} aria-pressed={value === v} data-testid={`design-${tid}-${v}`}
            onClick={() => onChange(v)}
            className={`px-2.5 h-7 rounded-full border text-[11px] font-bold transition-colors ${value === v ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorksheetDesignStudio({ settings, onPatch, ar, disabled }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const d = getDesign(settings);
   const patchDesign = (p: WorksheetDesign, extra: Partial<WorksheetSettings> = {}) =>
     onPatch({ ...extra, design: { ...d, ...p } });

  const themes = useMemo(() => Object.values(THEMES).filter(t => filter === "all" || (filter === "pro" ? PRO.has(t.id) : KIDS.has(t.id))), [filter]);
  const pick = (id: ThemeId | undefined) =>
    patchDesign({ themeSelection: "manual" }, { template: id, themeColor: undefined });

  const preset = (kind: "kids" | "pro") => {
    if (kind === "kids") {
      patchDesign({ themeSelection: "manual", pageFrame: "rounded", questionFrame: "soft", numbering: "circle", answerPattern: "dotted", decoration: "confetti", density: "comfortable", printMode: "color" },
        { template: "pastel_garden", themeColor: undefined, fontFamily: "cairo", fontSizePt: Math.max(settings.fontSizePt, 13) });
    } else {
      patchDesign({ themeSelection: "manual", pageFrame: "line", questionFrame: "default", numbering: "badge", answerPattern: "lines", decoration: "none", density: "compact", printMode: "color" },
        { template: "studio_pro", themeColor: undefined, fontFamily: "tajawal" });
    }
  };

   const resetDesign = () => onPatch({ design: undefined });
  const tab = (f: Filter, l: string, ic: React.ReactNode) => (
    <button key={f} type="button" disabled={disabled} aria-pressed={filter === f} data-testid={`design-filter-${f}`} onClick={() => setFilter(f)}
      className={`flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-bold ${filter === f ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}>{ic}{l}</button>
  );

  return (
    <section className="space-y-4 rounded-xl border bg-card/50 p-3" data-testid="design-studio" aria-label={ar ? "استوديو التصميم" : "Design studio"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" />{ar ? "استوديو التصميم" : "Design studio"}</div>
        <div className="flex gap-1 p-1 bg-muted/50 rounded-full">
          {tab("all", ar ? "الكل" : "All", null)}
          {tab("pro", ar ? "احترافي" : "Professional", <Briefcase className="w-3 h-3" />)}
          {tab("kids", ar ? "للأطفال" : "Children", <Baby className="w-3 h-3" />)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Seg label={ar ? "اختيار القالب" : "Template choice"} value={d.themeSelection ?? "automatic"} disabled={disabled} tid="selection"
          opts={[["automatic", ar ? "تلقائي" : "Automatic"], ["manual", ar ? "يدوي" : "Manual"]]}
          onChange={v => v === "automatic" ? patchDesign({ themeSelection: "automatic" }) : patchDesign({ themeSelection: "manual" })} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <button type="button" disabled={disabled} aria-pressed={!settings.template} data-testid="theme-classic" onClick={() => pick(undefined)}
          className={`relative p-1.5 rounded-lg border-2 text-start ${!settings.template ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
          <MiniSheet id="classic" c1="#225739" c2="#C9972A" bg="#fff" />
          <span className="block mt-1 text-[10px] font-bold truncate">{ar ? "كلاسيك" : "Classic"}</span>
          {!settings.template && <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-3 h-3" /></span>}
        </button>
        {themes.map(t => {
          const active = settings.template === t.id;
          const [c1, c2] = t.swatchColors;
          return (
            <button key={t.id} type="button" disabled={disabled} aria-pressed={active} data-testid={`theme-${t.id}`}
              title={ar ? `${t.nameAr}: ${t.description}` : t.nameEn}
              onClick={() => pick(t.id)}
              className="relative p-1.5 rounded-lg border-2 text-start transition-colors"
              style={{ borderColor: active ? c1 : "transparent", background: active ? `${c1}12` : undefined }}>
              <MiniSheet id={t.id} c1={c1} c2={c2} bg={THEME_BACKGROUNDS[t.id] ?? "#fff"} />
              <span className="block mt-1 text-[10px] font-bold truncate">{ar ? t.nameAr : t.nameEn}</span>
              {active && <span className="absolute top-1 end-1 w-4 h-4 rounded-full text-white flex items-center justify-center" style={{ background: c1 }}><Check className="w-3 h-3" /></span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} data-testid="design-preset-kids" onClick={() => preset("kids")} className="px-3 h-8 rounded-full border text-xs font-bold bg-background hover:bg-muted flex items-center gap-1"><Baby className="w-3.5 h-3.5" />{ar ? "نمط الأطفال" : "Kids style"}</button>
        <button type="button" disabled={disabled} data-testid="design-preset-pro" onClick={() => preset("pro")} className="px-3 h-8 rounded-full border text-xs font-bold bg-background hover:bg-muted flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{ar ? "نمط احترافي" : "Pro style"}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Seg label={ar ? "وضع الطباعة" : "Print mode"} value={d.printMode} disabled={disabled} tid="print" onChange={v => patchDesign({ printMode: v })}
          opts={[["color", ar ? "ملوّن" : "Color"], ["ink_saver", ar ? "توفير الحبر" : "Ink saver"], ["mono", ar ? "رمادي" : "Mono"]]} />
        <Seg label={ar ? "إطار الصفحة" : "Page frame"} value={d.pageFrame} disabled={disabled} tid="page" onChange={v => patchDesign({ pageFrame: v })}
          opts={[["none", ar ? "بدون" : "None"], ["line", ar ? "خط" : "Line"], ["double", ar ? "مزدوج" : "Double"], ["rounded", ar ? "مدوّر" : "Rounded"]]} />
        <Seg label={ar ? "إطار السؤال" : "Question frame"} value={d.questionFrame} disabled={disabled} tid="qframe" onChange={v => patchDesign({ questionFrame: v })}
          opts={[["default", ar ? "افتراضي" : "Default"], ["none", ar ? "بدون" : "None"], ["outline", ar ? "حدود" : "Outline"], ["soft", ar ? "ناعم" : "Soft"]]} />
        <Seg label={ar ? "الترقيم" : "Numbering"} value={d.numbering} disabled={disabled} tid="num" onChange={v => patchDesign({ numbering: v })}
          opts={[["badge", ar ? "شارة" : "Badge"], ["plain", ar ? "نص" : "Plain"], ["circle", ar ? "دائرة" : "Circle"], ["square", ar ? "مربع" : "Square"]]} />
        <Seg label={ar ? "نمط الإجابة" : "Answer pattern"} value={d.answerPattern} disabled={disabled} tid="answer" onChange={v => patchDesign({ answerPattern: v })}
          opts={[["lines", ar ? "خطوط" : "Lines"], ["dotted", ar ? "منقط" : "Dotted"], ["grid", ar ? "شبكة" : "Grid"], ["blank", ar ? "فارغ" : "Blank"]]} />
        <Seg label={ar ? "الزخرفة" : "Decoration"} value={d.decoration} disabled={disabled} tid="deco" onChange={v => patchDesign({ decoration: v })}
          opts={[["none", ar ? "بدون" : "None"], ["botanical", ar ? "نباتية" : "Botanical"], ["space", ar ? "فضاء" : "Space"], ["confetti", ar ? "قصاصات" : "Confetti"]]} />
        <Seg label={ar ? "الكثافة" : "Density"} value={d.density} disabled={disabled} tid="density" onChange={v => patchDesign({ density: v })}
          opts={[["compact", ar ? "مضغوط" : "Compact"], ["comfortable", ar ? "مريح" : "Comfortable"]]} />
        <label className="block">
          <span className="block text-[11px] font-bold mb-1 text-muted-foreground">{ar ? "اللون الثانوي" : "Secondary color"}</span>
          <input type="color" disabled={disabled} data-testid="design-secondary-color" aria-label={ar ? "اللون الثانوي" : "Secondary color"}
            value={d.secondaryColor ?? (settings.template ? THEMES[settings.template]?.swatchColors[1] : undefined) ?? "#c9972a"} onChange={e => patchDesign({ secondaryColor: e.target.value })} className="h-7 w-12 rounded border bg-background cursor-pointer" />
        </label>
      </div>

       <button type="button" disabled={disabled || !settings.design} data-testid="design-reset" onClick={resetDesign}
        className="text-[11px] font-bold text-muted-foreground hover:underline disabled:opacity-40 flex items-center gap-1">
        <RotateCcw className="w-3 h-3" />{ar ? "إعادة ضبط التصميم" : "Reset design"}
      </button>
    </section>
  );
}
