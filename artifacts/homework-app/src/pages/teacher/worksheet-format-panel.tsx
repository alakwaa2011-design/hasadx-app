import { useState, type ReactNode } from "react";
import { Building2, Settings as SettingsIcon, FileText, Plus, X, ImageIcon } from "lucide-react";
import type { WorksheetSettings } from "@workspace/api-zod";
import { toast } from "@/components/ui/sonner";
import { WorksheetDesignStudio } from "./worksheet-design-studio";

type Settings = WorksheetSettings;
type FontFamily = Settings["fontFamily"];

export const MAX_CUSTOM_FIELDS = 6;

const THEME_PRESETS = [
  { color: "#225739", label: "أخضر حصاد" },
  { color: "#1a3a6b", label: "أزرق رسمي" },
  { color: "#5C2D0E", label: "بني دافئ" },
  { color: "#4a1a6b", label: "أرجواني" },
  { color: "#1A1A2E", label: "أسود راقٍ" },
  { color: "#7b1a1a", label: "أحمر" },
];

export interface WorksheetMeta {
  title: string;
  subject: string;
  gradeLevel: string;
}

interface Props {
  ar: boolean;
  settings: Settings;
  onSettingsChange: (updater: (s: Settings) => Settings) => void;
  meta: WorksheetMeta;
  onMetaChange: (patch: Partial<WorksheetMeta>) => void;
  /** Creator only: clears the locally remembered teacher header profile. */
  onClearProfile?: () => void;
  /** Creator only: shows the "saved for future sheets" note. */
  showProfileNote?: boolean;
  readOnly?: boolean;
  /** Optional grade suggestions for the grade field. */
  gradeSuggestions?: string[];
  /** Which tab opens first (default: data). */
  initialTab?: "data" | "header" | "design";
}

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

function Lbl({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-[11px] font-bold mb-1 text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, value, onChange, testId }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      data-testid={testId}
      onClick={() => onChange(!value)}
      className={`px-3 h-8 rounded-full border text-xs font-bold transition-colors ${value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );
}

/**
 * Single source of truth for worksheet metadata, header and design controls.
 * Used by the creator, the creator preview overlay and the saved print route.
 */
export function WorksheetFormatPanel({
  ar, settings, onSettingsChange, meta, onMetaChange, onClearProfile, showProfileNote, readOnly, gradeSuggestions, initialTab,
}: Props) {
  const [tab, setTab] = useState<"info" | "header" | "design" | null>(initialTab ? (initialTab === "data" ? "info" : initialTab) : null);
  const set = (patch: Partial<Settings>) => onSettingsChange(s => ({ ...s, ...patch }));
  const fields = settings.customFields ?? [];
  const hasProfile = !!(settings.schoolName || settings.section || settings.teacherName || settings.logoUrl || fields.length);

  const tabs = [
    { id: "info" as const, label: ar ? "بيانات الورقة" : "Details", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "header" as const, label: ar ? "الترويسة" : "Header", icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: "design" as const, label: ar ? "التصميم" : "Design", icon: <SettingsIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 m-0" data-testid="panel-worksheet-format">
      <div role="tablist" className={`flex gap-1 p-1 bg-muted/50 rounded-lg w-full sm:w-auto sm:inline-flex ${tab ? "mb-3" : ""}`}>
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-expanded={tab === t.id}
            data-testid={`tab-format-${t.id}`}
            onClick={() => setTab(cur => (cur === t.id ? null : t.id))}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${tab === t.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Lbl label={ar ? "عنوان الورقة" : "Title"} className="sm:col-span-3">
            <input data-testid="input-ws-title" value={meta.title} maxLength={200} onChange={e => onMetaChange({ title: e.target.value })} className={inputCls} />
          </Lbl>
          <Lbl label={ar ? "المادة" : "Subject"} className="sm:col-span-2">
            <input data-testid="input-ws-subject" value={meta.subject} maxLength={100} onChange={e => onMetaChange({ subject: e.target.value })} className={inputCls} />
          </Lbl>
          <Lbl label={ar ? "الصف" : "Grade"}>
            <input data-testid="input-ws-grade" list={gradeSuggestions?.length ? "ws-grade-suggestions" : undefined} value={meta.gradeLevel} maxLength={100} onChange={e => onMetaChange({ gradeLevel: e.target.value })} className={inputCls} />
          </Lbl>
          {gradeSuggestions?.length ? <datalist id="ws-grade-suggestions">{gradeSuggestions.map(g => <option key={g} value={g} />)}</datalist> : null}
        </div>
      )}

      {tab === "header" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {showProfileNote ? (ar ? "تُحفظ تلقائياً لكل أوراقك القادمة" : "Saved automatically for future sheets") : ""}
            </p>
            {onClearProfile && hasProfile && (
              <button type="button" onClick={onClearProfile} className="text-[11px] font-bold text-destructive hover:underline">
                {ar ? "مسح المحفوظ" : "Clear saved"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Lbl label={ar ? "اسم المدرسة" : "School name"}>
              <input data-testid="input-ws-school" value={settings.schoolName ?? ""} maxLength={200} onChange={e => set({ schoolName: e.target.value })} className={inputCls} />
            </Lbl>
            <Lbl label={ar ? "اسم المعلم" : "Teacher"}>
              <input data-testid="input-ws-teacher" value={settings.teacherName ?? ""} maxLength={100} onChange={e => set({ teacherName: e.target.value })} className={inputCls} />
            </Lbl>
            <Lbl label={ar ? "القسم" : "Department"} className="sm:col-span-2">
              <input data-testid="input-ws-section" value={settings.section ?? ""} maxLength={100} onChange={e => set({ section: e.target.value })} className={inputCls} />
            </Lbl>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold">{ar ? "حقول إضافية (اختياري)" : "Extra fields"}</span>
              <button
                type="button"
                data-testid="button-add-custom-field"
                onClick={() => {
                  if (fields.length >= MAX_CUSTOM_FIELDS) {
                    toast.error(ar ? `الحد الأقصى ${MAX_CUSTOM_FIELDS} حقول` : `Max ${MAX_CUSTOM_FIELDS} fields`);
                    return;
                  }
                  set({ customFields: [...fields, { label: "", value: "" }] });
                }}
                className="text-[11px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {ar ? "إضافة" : "Add"}
              </button>
            </div>
            {fields.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{ar ? "مثال: العام الدراسي، الدرجة، الفصل…" : "e.g., Academic Year, Marks, Term…"}</p>
            ) : (
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      aria-label={ar ? "اسم الحقل" : "Label"}
                      value={f.label} maxLength={40} placeholder={ar ? "اسم الحقل" : "Label"}
                      onChange={e => set({ customFields: fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                      className="w-1/3 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"
                    />
                    <input
                      aria-label={ar ? "القيمة" : "Value"}
                      value={f.value} maxLength={120} placeholder={ar ? "القيمة" : "Value"}
                      onChange={e => set({ customFields: fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })}
                      className="flex-1 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      aria-label={ar ? "حذف الحقل" : "Remove field"}
                      onClick={() => set({ customFields: fields.filter((_, j) => j !== i) })}
                      className="p-1 rounded text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Lbl label={ar ? "ملاحظة الترويسة" : "Header note"}>
              <input data-testid="input-ws-header-note" value={settings.headerNote ?? ""} maxLength={300} onChange={e => set({ headerNote: e.target.value })} className={inputCls} />
            </Lbl>
            <Lbl label={ar ? "ملاحظة التذييل" : "Footer note"}>
              <input data-testid="input-ws-footer-note" value={settings.footerNote ?? ""} maxLength={300} onChange={e => set({ footerNote: e.target.value })} className={inputCls} />
            </Lbl>
          </div>
          <Lbl label={ar ? "تعليمات الطالب" : "Instructions"}>
            <textarea data-testid="input-ws-instructions" rows={2} value={settings.instructions ?? ""} onChange={e => set({ instructions: e.target.value })} className="w-full p-2 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
          </Lbl>
          <Lbl label={ar ? "جملة الختام" : "Closing line"}>
            <input data-testid="input-ws-goodluck" value={settings.goodLuck ?? ""} maxLength={200} placeholder={ar ? "نتمنى لك التوفيق (الافتراضي)" : "Good luck! (default)"} onChange={e => set({ goodLuck: e.target.value })} className={inputCls} />
          </Lbl>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            <Check testId="toggle-ws-name" label={ar ? "الاسم" : "Name"} value={settings.includeName} onChange={v => set({ includeName: v })} />
            <Check testId="toggle-ws-date" label={ar ? "التاريخ" : "Date"} value={settings.includeDate} onChange={v => set({ includeDate: v })} />
            <Check testId="toggle-ws-class" label={ar ? "الصف" : "Class"} value={settings.includeClass} onChange={v => set({ includeClass: v })} />
            <Check testId="toggle-ws-answers" label={ar ? "ورقة الإجابات" : "Answer key"} value={settings.includeAnswerKey} onChange={v => set({ includeAnswerKey: v })} />
            <Check testId="toggle-ws-watermark" label={ar ? "علامة مائية" : "Watermark"} value={settings.showWatermark} onChange={v => set({ showWatermark: v })} />
          </div>
        </div>
      )}

      {tab === "design" && (
        <div className="space-y-5">
          <WorksheetDesignStudio settings={settings} ar={ar} disabled={readOnly} onPatch={set} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Lbl label={ar ? "الأعمدة" : "Columns"}>
              <div className="flex gap-1" role="group">
                {([1, 2] as const).map(n => (
                  <button
                    key={n} type="button" aria-pressed={settings.columns === n} data-testid={`columns-${n}`}
                    onClick={() => set({ columns: n })}
                    className={`flex-1 h-9 rounded-lg border text-sm font-bold ${settings.columns === n ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                  >{n}</button>
                ))}
              </div>
            </Lbl>
            <Lbl label={ar ? "نوع الخط" : "Font"}>
              <select data-testid="select-ws-font" value={settings.fontFamily} onChange={e => set({ fontFamily: e.target.value as FontFamily })} className={inputCls}>
                <option value="default">{ar ? "افتراضي" : "Default"}</option>
                <option value="cairo">Cairo</option>
                <option value="tajawal">Tajawal</option>
                <option value="amiri">Amiri</option>
                <option value="noto-naskh">Noto Naskh</option>
                <option value="inter">Inter</option>
                <option value="georgia">Georgia</option>
              </select>
            </Lbl>
            <Lbl label={ar ? `حجم الخط (${settings.fontSizePt}pt)` : `Font size (${settings.fontSizePt}pt)`}>
              <input data-testid="range-ws-fontsize" type="range" min={9} max={18} step={1} value={settings.fontSizePt}
                onChange={e => set({ fontSizePt: parseInt(e.target.value, 10) })} className="w-full mt-2" />
            </Lbl>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold mb-1.5 text-muted-foreground">{ar ? "لون الورقة" : "Accent color"}</div>
              <div className="flex flex-wrap gap-2 items-center">
                {THEME_PRESETS.map(p => (
                  <button
                    key={p.color} type="button" title={p.label} aria-label={p.label}
                    aria-pressed={settings.themeColor === p.color}
                    onClick={() => set({ themeColor: settings.themeColor === p.color ? undefined : p.color })}
                    className="w-6 h-6 rounded-full border-2"
                    style={{ background: p.color, borderColor: settings.themeColor === p.color ? "#fff" : "transparent", boxShadow: settings.themeColor === p.color ? `0 0 0 2px ${p.color}` : "none" }}
                  />
                ))}
                <label className="w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer bg-background" title={ar ? "لون مخصص" : "Custom"}>
                  <input type="color" className="sr-only" aria-label={ar ? "لون مخصص" : "Custom color"} value={settings.themeColor ?? "#225739"} onChange={e => set({ themeColor: e.target.value })} />
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </label>
                {settings.themeColor && (
                  <button type="button" onClick={() => set({ themeColor: undefined })} className="text-[11px] text-muted-foreground hover:underline">{ar ? "افتراضي" : "Reset"}</button>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold mb-1.5 text-muted-foreground">{ar ? "الشعار (اختياري)" : "Logo"}</div>
              {settings.logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={settings.logoUrl} alt={ar ? "الشعار" : "Logo"} className="h-8 w-auto rounded border object-contain bg-white" />
                  <button type="button" onClick={() => set({ logoUrl: undefined })} className="text-[11px] text-destructive hover:underline">{ar ? "إزالة" : "Remove"}</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 cursor-pointer h-8 rounded-lg border border-dashed border-border bg-background hover:bg-muted text-xs text-muted-foreground">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{ar ? "رفع صورة (PNG/JPG)" : "Upload (PNG/JPG)"}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" data-testid="input-ws-logo"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (file.size > 500 * 1024) { toast.error(ar ? "الحجم يجب أن يكون أقل من 500KB" : "Under 500KB"); return; }
                      const reader = new FileReader();
                      reader.onload = ev => set({ logoUrl: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
