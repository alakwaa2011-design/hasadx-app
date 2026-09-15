import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, ListChecks } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { QuranSurah, QuranWardRangeInput } from "@workspace/api-client-react";
import { quranChoicesToRanges, type QuranRangeChoice } from "./quran-range-selection";
import { cn } from "@/lib/utils";

interface QuranTaskAssignerModalProps {
  title: string;
  surahs: QuranSurah[];
  onClose: () => void;
  onAssign: (data: { memorization?: QuranWardRangeInput[]; review?: QuranWardRangeInput[]; dueDate: string; notes?: string }) => Promise<void>;
  isPending: boolean;
}

export function QuranTaskAssignerModal({ title, surahs, onClose, onAssign, isPending }: QuranTaskAssignerModalProps) {
  const { lang } = useI18n();
  const isArabic = lang === "ar";
  
  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const [dueDate, setDueDate] = useState<string>(todayStr);
  const [notes, setNotes] = useState("");

  const [memEnabled, setMemEnabled] = useState(true);
  const [memChoices, setMemChoices] = useState<QuranRangeChoice[]>([
    { id: crypto.randomUUID(), kind: "surahs", fromSurah: 1, toSurah: 1 }
  ]);
  
  const [revEnabled, setRevEnabled] = useState(true);
  const [revChoices, setRevChoices] = useState<QuranRangeChoice[]>([
    { id: crypto.randomUUID(), kind: "surahs", fromSurah: 1, toSurah: 1 }
  ]);

  const memRanges = useMemo(() => quranChoicesToRanges(memChoices, surahs), [memChoices, surahs]);
  const revRanges = useMemo(() => quranChoicesToRanges(revChoices, surahs), [revChoices, surahs]);

  const isValid = (memEnabled || revEnabled) && (!memEnabled || memRanges.length > 0) && (!revEnabled || revRanges.length > 0) && !!dueDate;

  const handleSave = async () => {
    if (!isValid) return;
    await onAssign({ 
      memorization: memEnabled ? memRanges : undefined, 
      review: revEnabled ? revRanges : undefined, 
      dueDate, 
      notes: notes || undefined 
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden rounded-3xl border-border flex flex-col max-h-[90vh]">
        <DialogHeader className="p-5 border-b border-border/60 bg-muted/20">
          <DialogTitle className="font-black text-xl text-foreground">
            {title}
          </DialogTitle>
          <p className="text-xs font-bold text-muted-foreground mt-1">
            {isArabic ? "اختر نطاق الحفظ والمراجعة (يجب تفعيل قسم واحد على الأقل)" : "Choose ranges for memorization and review (at least one required)"}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <SectionEditor 
            title={isArabic ? "الحفظ الجديد" : "New Memorization"}
            enabled={memEnabled}
            onEnabledChange={setMemEnabled}
            choices={memChoices}
            setChoices={setMemChoices}
            ranges={memRanges}
            surahs={surahs}
            isArabic={isArabic}
            color="emerald"
          />

          <SectionEditor 
            title={isArabic ? "المراجعة" : "Review"}
            enabled={revEnabled}
            onEnabledChange={setRevEnabled}
            choices={revChoices}
            setChoices={setRevChoices}
            ranges={revRanges}
            surahs={surahs}
            isArabic={isArabic}
            color="amber"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "تاريخ الاستحقاق" : "Due Date"}</label>
              <input 
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isArabic ? "ملاحظات (اختياري)" : "Notes (optional)"}</label>
              <input 
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                placeholder={isArabic ? "أضف ملاحظة للطالب..." : "Add a note..."}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-5 border-t border-border/60 bg-muted/20 sm:justify-end gap-3 flex-row justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button 
            onClick={handleSave}
            disabled={isPending || !isValid}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isArabic ? "حفظ وتعيين" : "Save and Assign"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionEditor({ title, enabled, onEnabledChange, choices, setChoices, ranges, surahs, isArabic, color }: {
  title: string;
  enabled: boolean;
  onEnabledChange: (val: boolean) => void;
  choices: QuranRangeChoice[];
  setChoices: React.Dispatch<React.SetStateAction<QuranRangeChoice[]>>;
  ranges: QuranWardRangeInput[];
  surahs: QuranSurah[];
  isArabic: boolean;
  color: "emerald" | "amber";
}) {
  const addChoice = () => {
    setChoices(prev => [...prev, { id: crypto.randomUUID(), kind: "surahs", fromSurah: 1, toSurah: 1 }]);
  };

  const updateChoice = (id: string, newChoice: QuranRangeChoice) => {
    setChoices(prev => prev.map(c => c.id === id ? newChoice : c));
  };

  const removeChoice = (id: string) => {
    if (choices.length <= 1) return;
    setChoices(prev => prev.filter(c => c.id !== id));
  };

  const activeColorClasses = color === "emerald" 
    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300" 
    : "border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300";

  const disabledColorClasses = "border-border bg-muted/20 opacity-70 text-muted-foreground";

  return (
    <section className={cn("rounded-2xl border p-4 space-y-4 transition-all", enabled ? activeColorClasses : disabledColorClasses)}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox" 
            checked={enabled} 
            onChange={(e) => onEnabledChange(e.target.checked)} 
            className="w-5 h-5 accent-emerald-600 rounded-md"
          />
          <h3 className="font-black text-lg">{title}</h3>
        </label>
        {enabled && (
          <span className="text-xs font-bold bg-background border px-2 py-1 rounded-md text-foreground shadow-sm">
            {isArabic ? "ينتج:" : "Yields:"} {ranges.length} {isArabic ? "مقاطع" : "parts"}
          </span>
        )}
      </div>
      
      {enabled && (
        <>
          <div className="space-y-3">
            {choices.map((choice) => (
              <ChoiceRow 
                key={choice.id} 
                choice={choice} 
                onChange={(c) => updateChoice(choice.id, c)} 
                onRemove={() => removeChoice(choice.id)} 
                surahs={surahs} 
                canRemove={choices.length > 1}
                isArabic={isArabic}
              />
            ))}
          </div>

          <button 
            onClick={addChoice}
            className={cn(
              "w-full py-2 flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-colors",
              color === "emerald" 
                ? "bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                : "bg-amber-100/50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
            )}
          >
            <Plus className="w-4 h-4" />
            {isArabic ? "إضافة اختيار آخر" : "Add another choice"}
          </button>

          {ranges.length > 0 && (
            <div className="pt-3 border-t border-border/50 text-xs font-medium text-foreground flex items-start gap-2">
              <ListChecks className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="leading-relaxed">
                <span className="text-muted-foreground">{isArabic ? "الملخص: " : "Summary: "}</span>
                {ranges.map((r, i) => (
                  <span key={i} className="inline-block me-1">
                    {r.surahName} ({r.startAyah}-{r.endAyah}){i < ranges.length - 1 ? "، " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ChoiceRow({ choice, onChange, onRemove, surahs, canRemove, isArabic }: {
  choice: QuranRangeChoice;
  onChange: (c: QuranRangeChoice) => void;
  onRemove: () => void;
  surahs: QuranSurah[];
  canRemove: boolean;
  isArabic: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-background rounded-xl border border-border shadow-sm">
      <div className="flex gap-2 items-center">
        <select 
          value={choice.kind}
          onChange={(e) => {
            const kind = e.target.value as "surahs" | "juz" | "ayahs";
            if (kind === "surahs") onChange({ id: choice.id, kind, fromSurah: 1, toSurah: 1 });
            else if (kind === "juz") onChange({ id: choice.id, kind, fromJuz: 1, toJuz: 1 });
            else onChange({ id: choice.id, kind, fromSurah: 1, fromAyah: 1, toSurah: 1, toAyah: 7 });
          }}
          className="flex-1 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
        >
          <option value="surahs">{isArabic ? "سور (من سورة إلى سورة)" : "Surahs"}</option>
          <option value="juz">{isArabic ? "أجزاء (من جزء إلى جزء)" : "Ajzaa"}</option>
          <option value="ayahs">{isArabic ? "آيات (من آية إلى آية)" : "Ayahs"}</option>
        </select>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-1">
        {choice.kind === "surahs" && (
          <div className="flex items-center gap-2">
            <SurahSelect 
              value={choice.fromSurah} 
              onChange={v => onChange({ ...choice, fromSurah: v })} 
              surahs={surahs} 
              label={isArabic ? "من" : "From"} 
            />
            <SurahSelect 
              value={choice.toSurah} 
              onChange={v => onChange({ ...choice, toSurah: v })} 
              surahs={surahs} 
              label={isArabic ? "إلى" : "To"} 
            />
          </div>
        )}

        {choice.kind === "juz" && (
          <div className="flex items-center gap-2">
            <JuzSelect 
              value={choice.fromJuz} 
              onChange={v => onChange({ ...choice, fromJuz: v })} 
              label={isArabic ? "من جزء" : "From Juz"} 
            />
            <JuzSelect 
              value={choice.toJuz} 
              onChange={v => onChange({ ...choice, toJuz: v })} 
              label={isArabic ? "إلى جزء" : "To Juz"} 
            />
          </div>
        )}

        {choice.kind === "ayahs" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-6 text-center shrink-0">{isArabic ? "من" : "From"}</span>
              <SurahSelect 
                value={choice.fromSurah} 
                onChange={v => {
                  const max = surahs.find(s => s.number === v)?.ayahCount ?? 1;
                  onChange({ ...choice, fromSurah: v, fromAyah: Math.min(choice.fromAyah, max) });
                }} 
                surahs={surahs} 
                hideLabel 
              />
              <input 
                type="number" 
                min={1} 
                max={surahs.find(s => s.number === choice.fromSurah)?.ayahCount ?? 1}
                value={choice.fromAyah}
                onChange={e => onChange({ ...choice, fromAyah: Number(e.target.value) || 1 })}
                className="w-16 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 text-center"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-6 text-center shrink-0">{isArabic ? "إلى" : "To"}</span>
              <SurahSelect 
                value={choice.toSurah} 
                onChange={v => {
                  const max = surahs.find(s => s.number === v)?.ayahCount ?? 1;
                  onChange({ ...choice, toSurah: v, toAyah: Math.min(choice.toAyah, max) });
                }} 
                surahs={surahs} 
                hideLabel 
              />
              <input 
                type="number" 
                min={1} 
                max={surahs.find(s => s.number === choice.toSurah)?.ayahCount ?? 1}
                value={choice.toAyah}
                onChange={e => onChange({ ...choice, toAyah: Number(e.target.value) || 1 })}
                className="w-16 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 text-center"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SurahSelect({ value, onChange, surahs, label, hideLabel }: { value: number; onChange: (v: number) => void; surahs: QuranSurah[]; label?: string; hideLabel?: boolean }) {
  const { lang } = useI18n();
  return (
    <div className="flex-1 flex items-center gap-1.5">
      {!hideLabel && <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{label}</span>}
      <select 
        value={value} 
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
      >
        {surahs.map(s => (
          <option key={s.number} value={s.number}>{s.number}. {s.arabicName}</option>
        ))}
      </select>
    </div>
  );
}

function JuzSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex-1 flex items-center gap-1.5">
      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{label}</span>
      <select 
        value={value} 
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-emerald-500"
      >
        {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => (
          <option key={juz} value={juz}>{juz}</option>
        ))}
      </select>
    </div>
  );
}
