import { useEffect, useState } from "react";
import type { WorksheetActivityStyle, WorksheetGenerationConstraints } from "@workspace/api-zod";
import {
  Network, Pencil, Palette, Shapes, ListOrdered, Users, ListChecks, Wand2, ChevronDown, Check, Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ExecutionMode = "individual" | "group";

export interface StyleMeta {
  style: WorksheetActivityStyle;
  ar: string; en: string;
  descAr: string; descEn: string;
  minutes: number;
}

export const STYLE_META: Record<WorksheetActivityStyle, StyleMeta> = {
  auto: { style: "auto", ar: "اختيار تلقائي", en: "Automatic", descAr: "يختار حصاد الصيغة الأنسب للمادة والصف.", descEn: "Hasaad picks the best format.", minutes: 15 },
  concept_map: { style: "concept_map", ar: "خريطة مفاهيم", en: "Concept map", descAr: "فكرة مركزية وفروع يملؤها الطالب بنفسه.", descEn: "A central idea with branches students fill.", minutes: 15 },
  drawing: { style: "drawing", ar: "ارسم وفسّر", en: "Draw and explain", descAr: "إطار رسم مفتوح بعد توجيه قصير.", descEn: "An open drawing frame after a short prompt.", minutes: 10 },
  coloring: { style: "coloring", ar: "لوّن الشكل", en: "Colour the figure", descAr: "شكل تعليمي بسيط يلوّنه الطالب حسب التعليمات.", descEn: "A simple figure students colour by instruction.", minutes: 10 },
  sorting: { style: "sorting", ar: "صنّف البطاقات", en: "Sort the cards", descAr: "عناصر مبعثرة تُصنَّف في جدول فارغ.", descEn: "Mixed items sorted into an empty table.", minutes: 10 },
  sequencing: { style: "sequencing", ar: "رتّب الخطوات", en: "Put in order", descAr: "عناصر مخلوطة تُرتَّب في تسلسل مرقّم.", descEn: "Shuffled items placed in a numbered sequence.", minutes: 10 },
  group_task: { style: "group_task", ar: "مهمة جماعية", en: "Group task", descAr: "أدوار وخطوات وإطار مشترك للناتج.", descEn: "Roles, steps and one shared output frame.", minutes: 20 },
  practice: { style: "practice", ar: "تدريبات تقليدية", en: "Classic practice", descAr: "أسئلة قصيرة متنوعة بلا نشاط خاص.", descEn: "Mixed short questions with no special activity.", minutes: 15 },
};

export const STYLE_ORDER: WorksheetActivityStyle[] = [
  "concept_map", "sorting", "sequencing", "drawing", "coloring", "group_task", "practice",
];

const STYLE_ICON: Record<WorksheetActivityStyle, typeof Network> = {
  auto: Wand2, concept_map: Network, drawing: Pencil, coloring: Palette, sorting: Shapes,
  sequencing: ListOrdered, group_task: Users, practice: ListChecks,
};

const YOUNG = /(روضة|تمهيدي|الأول|الثاني|الثالث|first|second|third|grade\s*[1-3]\b|kg|^[1-3]$)/i;
const MID = /(الرابع|الخامس|السادس|fourth|fifth|sixth|grade\s*[4-6]\b|^[4-6]$)/i;

/** Contextual suggestions are plain rules over subject and grade, never model output. */
export function suggestActivities(subject: string, gradeLevel: string): StyleMeta[] {
  const s = subject.trim();
  const g = gradeLevel.trim();
  const score: Partial<Record<WorksheetActivityStyle, number>> = {
    concept_map: 3, sorting: 3, sequencing: 3, drawing: 2, coloring: 1, group_task: 2, practice: 0,
  };
  const add = (k: WorksheetActivityStyle, n: number) => { score[k] = (score[k] ?? 0) + n; };
  if (/(علوم|أحياء|فيزياء|كيمياء|science|biology|physics|chemistry)/i.test(s)) { add("concept_map", 3); add("sequencing", 2); add("drawing", 1); }
  else if (/(رياضيات|حساب|math)/i.test(s)) { add("sorting", 3); add("group_task", 2); add("sequencing", 1); }
  else if (/(عربي|لغة|نحو|إملاء|قراءة|arabic|english|language|reading)/i.test(s)) { add("sorting", 3); add("sequencing", 2); add("concept_map", 1); }
  else if (/(إسلام|دين|قرآن|توحيد|فقه|islamic|quran)/i.test(s)) { add("sequencing", 3); add("concept_map", 2); add("group_task", 1); }
  else if (/(اجتماع|تاريخ|جغراف|وطنية|social|history|geography)/i.test(s)) { add("sequencing", 3); add("group_task", 3); add("concept_map", 1); }
  else if (/(فن|تربية فنية|art)/i.test(s)) { add("drawing", 4); add("coloring", 3); }
  const olderStage = /(ثانوي|متوسط|secondary|high school|middle school)/i.test(g);
  if (g && !olderStage && YOUNG.test(g)) { add("coloring", 4); add("drawing", 3); add("sorting", 2); add("concept_map", -2); add("group_task", -1); }
  else if (g && !olderStage && MID.test(g)) { add("sorting", 1); add("group_task", 1); add("coloring", -1); }
  else if (g) { add("concept_map", 2); add("group_task", 1); add("coloring", -3); }
  const order = STYLE_ORDER.filter(k => k !== "practice");
  return order
    .map((k, i) => ({ k, v: score[k] ?? 0, i }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .slice(0, 3)
    .map(x => STYLE_META[x.k]);
}

/** Remove unset entries so the stored constraints object stays empty until the teacher chooses something. */
export function pruneConstraints(c: WorksheetGenerationConstraints): WorksheetGenerationConstraints {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out as WorksheetGenerationConstraints;
}

export interface AutoRequestInput {
  activityStyle: WorksheetActivityStyle;
  executionMode: ExecutionMode;
  groupSize?: number;
  constraints: WorksheetGenerationConstraints;
  pages: 1 | 2 | 3;
  boardEnabled: boolean;
}

/** Fields an automatic request may carry. No legacy pedagogical defaults and no board flag unless enabled. */
export function autoRequestFields(i: AutoRequestInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    questionSelection: "auto",
    pages: i.pages,
    activityStyle: i.activityStyle,
    executionMode: i.executionMode,
    generationConstraints: pruneConstraints(i.constraints),
  };
  if (i.executionMode === "group" && i.groupSize) out.groupSize = i.groupSize;
  if (i.boardEnabled) out.counts = { tic_tac_toe: 1 };
  return out;
}

/** Same fields as multipart form data (objects JSON-encoded). */
export function appendAutoFormFields(fd: FormData, i: AutoRequestInput) {
  for (const [k, v] of Object.entries(autoRequestFields(i))) {
    fd.append(k, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  }
}

export function countWorksheetPages(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("#ws-printable-root [data-worksheet-page]").length;
}

export function fitBlockMessage(targetPages: number | undefined, actual: number, ar: boolean): string | null {
  if (!targetPages || actual <= targetPages) return null;
  return ar
    ? `الورقة ${actual} صفحات والمستهدف ${targetPages}. اضبط الحجم أو ارفع المستهدف قبل التصدير.`
    : `The worksheet is ${actual} pages but the target is ${targetPages}. Adjust the fit or raise the target before exporting.`;
}

const CONSTRAINT_TYPES: Array<{ v: NonNullable<WorksheetGenerationConstraints["allowedTypes"]>[number]; ar: string; en: string }> = [
  { v: "mcq", ar: "اختيار", en: "MCQ" }, { v: "true_false", ar: "صح/خطأ", en: "T/F" },
  { v: "short_answer", ar: "قصيرة", en: "Short" }, { v: "fill_blank", ar: "فراغ", en: "Blank" },
  { v: "matching", ar: "توصيل", en: "Matching" }, { v: "worked_problem", ar: "مسألة", en: "Problem" },
  { v: "extended_response", ar: "مطولة", en: "Extended" }, { v: "error_correction", ar: "صحح الخطأ", en: "Error" },
  { v: "word_bank", ar: "بنك كلمات", en: "Word bank" }, { v: "compare", ar: "قارن", en: "Compare" },
];

const selectCls = "w-full h-10 px-2 rounded-lg border bg-background text-sm outline-none focus:border-primary";
const AUTO = "";

function Lbl({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-start">
      <span className="mb-1 block px-1 text-[11px] font-bold text-muted-foreground">{text}</span>
      {children}
    </label>
  );
}

export interface QuickSetupProps {
  ar: boolean;
  subject: string; onSubject: (v: string) => void;
  gradeLevel: string; onGrade: (v: string) => void;
  gradeSuggestions: string[];
  activityStyle: WorksheetActivityStyle; onStyle: (s: WorksheetActivityStyle) => void;
  executionMode: ExecutionMode; onMode: (m: ExecutionMode) => void;
  groupSize: number | undefined; onGroupSize: (n: number | undefined) => void;
  pages: 1 | 2 | 3; onPages: (p: 1 | 2 | 3) => void;
  constraints: WorksheetGenerationConstraints; onConstraints: (c: WorksheetGenerationConstraints) => void;
}

export function WorksheetQuickSetup(p: QuickSetupProps) {
  const { ar } = p;
  const [browse, setBrowse] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const suggestions = suggestActivities(p.subject, p.gradeLevel);
  const ready = p.subject.trim().length > 0 && p.gradeLevel.trim().length > 0;
  const c = p.constraints;
  const set = <K extends keyof WorksheetGenerationConstraints>(k: K, v: WorksheetGenerationConstraints[K] | undefined) => {
    const next = { ...c } as WorksheetGenerationConstraints;
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
    else next[k] = v as never;
    p.onConstraints(next);
  };
  const [objective, setObjective] = useState(c.learningObjective ?? "");
  useEffect(() => { setObjective(c.learningObjective ?? ""); }, [c.learningObjective]);
  const types = c.allowedTypes ?? [];

  const StyleCard = ({ m, suggested }: { m: StyleMeta; suggested?: boolean }) => {
    const Icon = STYLE_ICON[m.style];
    const on = p.activityStyle === m.style;
    return (
      <button
        type="button"
        aria-pressed={on}
        data-testid={`style-${m.style}`}
        onClick={() => p.onStyle(m.style)}
        className={cn(
          "group relative flex min-h-24 flex-col gap-1 rounded-xl border p-3 text-start transition-all active:scale-[0.98] motion-reduce:transition-none",
          on ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-background hover:border-primary/40 hover:bg-muted/40",
        )}
      >
        <span className="flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-black">{ar ? m.ar : m.en}</span>
          {on && <Check className="ms-auto h-4 w-4 text-primary" />}
        </span>
        <span className="text-[11px] leading-5 text-muted-foreground">{ar ? m.descAr : m.descEn}</span>
        <span className="mt-auto flex items-center gap-1 text-[11px] font-bold text-primary/80">
          <Clock3 className="h-3 w-3" />
          {ar ? `${m.minutes} دقيقة تقريبًا` : `about ${m.minutes} min`}
          {suggested && <span className="ms-auto rounded-full bg-secondary/30 px-2 py-0.5 text-[10px] text-foreground">{ar ? "مقترح" : "Suggested"}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4" data-testid="worksheet-quick-setup">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Lbl text={ar ? "المادة" : "Subject"}>
          <input data-testid="quick-subject" value={p.subject} onChange={e => p.onSubject(e.target.value)}
            placeholder={ar ? "مثال: العلوم" : "e.g. Science"} className={selectCls} />
        </Lbl>
        <Lbl text={ar ? "الصف" : "Grade"}>
          <input data-testid="quick-grade" list="quick-grade-options" value={p.gradeLevel} onChange={e => p.onGrade(e.target.value)}
            placeholder={ar ? "مثال: الصف الرابع" : "e.g. Grade 4"} className={selectCls} />
          <datalist id="quick-grade-options">{p.gradeSuggestions.map(g => <option key={g} value={g} />)}</datalist>
        </Lbl>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black">{ar ? "أنشطة مقترحة لك" : "Suggested for you"}</h3>
          <span className="text-[11px] text-muted-foreground">
            {ready ? (ar ? "اقتراحات مبنية على المادة والصف" : "Based on subject and grade") : (ar ? "أضف المادة والصف لتخصيصها" : "Add subject and grade to tailor these")}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="suggested-activities">
          {suggestions.map(m => <StyleCard key={m.style} m={m} suggested />)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" data-testid="style-auto" aria-pressed={p.activityStyle === "auto"} onClick={() => p.onStyle("auto")}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors",
              p.activityStyle === "auto" ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
            <Wand2 className="h-3.5 w-3.5" />{ar ? "اختر لي تلقائيًا" : "Choose for me"}
          </button>
          <button type="button" data-testid="button-browse-styles" aria-expanded={browse} onClick={() => setBrowse(v => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-bold hover:bg-muted">
            {ar ? "تصفح صيغ أخرى" : "Browse other formats"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", browse && "rotate-180")} />
          </button>
        </div>
        {browse && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="all-styles">
            {STYLE_ORDER.filter(k => !suggestions.some(s => s.style === k)).map(k => <StyleCard key={k} m={STYLE_META[k]} />)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Lbl text={ar ? "الصفحات" : "Pages"}>
          <div className="flex h-10 gap-1 rounded-lg border bg-muted/50 p-1" role="group">
            {([1, 2, 3] as const).map(n => (
              <button key={n} type="button" aria-pressed={p.pages === n} data-testid={`quick-pages-${n}`} onClick={() => p.onPages(n)}
                className={cn("flex-1 rounded-md text-xs font-bold", p.pages === n ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}>
                {n}
              </button>
            ))}
          </div>
        </Lbl>
        <Lbl text={ar ? "طريقة التنفيذ" : "Working mode"}>
          <div className="flex h-10 gap-1 rounded-lg border bg-muted/50 p-1" role="group">
            {(["individual", "group"] as const).map(m => (
              <button key={m} type="button" aria-pressed={p.executionMode === m} data-testid={`quick-mode-${m}`} onClick={() => p.onMode(m)}
                className={cn("flex-1 rounded-md text-xs font-bold", p.executionMode === m ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}>
                {m === "individual" ? (ar ? "فردي" : "Individual") : (ar ? "جماعي" : "Group")}
              </button>
            ))}
          </div>
        </Lbl>
        {p.executionMode === "group" && (
          <Lbl text={ar ? "حجم المجموعة (اختياري)" : "Group size (optional)"}>
            <select data-testid="quick-group-size" value={p.groupSize ?? AUTO} className={selectCls}
              onChange={e => p.onGroupSize(e.target.value ? Number(e.target.value) : undefined)}>
              <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Lbl>
        )}
      </div>

      <div className="rounded-xl border border-dashed">
        <button type="button" aria-expanded={advanced} data-testid="button-advanced-constraints" onClick={() => setAdvanced(v => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-bold">
          <span>{ar ? "تحكم أدق (اختياري)" : "Fine control (optional)"}
            {Object.keys(c).length > 0 && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{Object.keys(c).length}</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", advanced && "rotate-180")} />
        </button>
        {advanced && (
          <div className="grid grid-cols-1 gap-3 border-t p-3 sm:grid-cols-2" data-testid="constraints-panel">
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              {ar ? "كل حقل على \"تلقائي\" يُترك لتقدير النموذج ولا يُرسل." : "Fields left on Automatic are not sent and stay at the model's discretion."}
            </p>
            <Lbl text={ar ? "الصعوبة" : "Difficulty"}>
              <select data-testid="constraint-difficulty" className={selectCls} value={c.difficulty ?? AUTO}
                onChange={e => set("difficulty", (e.target.value || undefined) as WorksheetGenerationConstraints["difficulty"])}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                <option value="easy">{ar ? "سهل" : "Easy"}</option><option value="medium">{ar ? "متوسط" : "Medium"}</option>
                <option value="hard">{ar ? "صعب" : "Hard"}</option><option value="mixed">{ar ? "متنوع" : "Mixed"}</option>
              </select>
            </Lbl>
            <Lbl text={ar ? "المهارة المعرفية" : "Cognitive skill"}>
              <select data-testid="constraint-skill" className={selectCls} value={c.cognitiveSkill ?? AUTO}
                onChange={e => set("cognitiveSkill", (e.target.value || undefined) as WorksheetGenerationConstraints["cognitiveSkill"])}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                {(["remember", "understand", "apply", "analyze", "evaluate", "create", "mixed"] as const).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Lbl>
            <Lbl text={ar ? "المدة" : "Duration"}>
              <select data-testid="constraint-duration" className={selectCls} value={c.activityDuration ?? AUTO}
                onChange={e => set("activityDuration", e.target.value ? Number(e.target.value) : undefined)}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                {[5, 10, 15, 20, 30, 45].map(n => <option key={n} value={n}>{ar ? `${n} دقيقة` : `${n} min`}</option>)}
              </select>
            </Lbl>
            <Lbl text={ar ? "عدد العناصر" : "Item count"}>
              <select data-testid="constraint-count" className={selectCls} value={c.itemCount ?? AUTO}
                onChange={e => set("itemCount", e.target.value ? Number(e.target.value) : undefined)}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Lbl>
            <Lbl text={ar ? "التمايز" : "Differentiation"}>
              <select data-testid="constraint-differentiation" className={selectCls} value={c.differentiation ?? AUTO}
                onChange={e => set("differentiation", (e.target.value || undefined) as WorksheetGenerationConstraints["differentiation"])}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                <option value="none">{ar ? "بدون" : "None"}</option><option value="support">{ar ? "دعم" : "Support"}</option>
                <option value="enrichment">{ar ? "إثراء" : "Enrichment"}</option><option value="scaffolded">{ar ? "متدرج" : "Scaffolded"}</option>
              </select>
            </Lbl>
            <Lbl text={ar ? "التقييم" : "Assessment"}>
              <select data-testid="constraint-assessment" className={selectCls} value={c.assessmentMode ?? AUTO}
                onChange={e => set("assessmentMode", (e.target.value || undefined) as WorksheetGenerationConstraints["assessmentMode"])}>
                <option value={AUTO}>{ar ? "تلقائي" : "Automatic"}</option>
                <option value="diagnostic">{ar ? "قبلي" : "Diagnostic"}</option><option value="formative">{ar ? "تكويني" : "Formative"}</option>
                <option value="summative">{ar ? "ختامي" : "Summative"}</option>
              </select>
            </Lbl>
            <div className="sm:col-span-2">
              <Lbl text={ar ? "الهدف التعليمي" : "Learning objective"}>
                <input data-testid="constraint-objective" className={selectCls} value={objective} maxLength={500}
                  placeholder={ar ? "تلقائي" : "Automatic"}
                  onChange={e => setObjective(e.target.value)}
                  onBlur={() => set("learningObjective", objective.trim() || undefined)} />
              </Lbl>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block px-1 text-[11px] font-bold text-muted-foreground">
                {ar ? "أنواع الأسئلة المسموحة (فارغ = تلقائي)" : "Allowed question types (none = automatic)"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CONSTRAINT_TYPES.map(t => {
                  const on = types.includes(t.v);
                  return (
                    <button key={t.v} type="button" aria-pressed={on} data-testid={`constraint-type-${t.v}`}
                      onClick={() => set("allowedTypes", on ? types.filter(x => x !== t.v) : [...types, t.v])}
                      className={cn("h-8 rounded-full border px-3 text-[11px] font-bold", on ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted")}>
                      {ar ? t.ar : t.en}
                    </button>
                  );
                })}
              </div>
            </div>
            {Object.keys(c).length > 0 && (
              <button type="button" data-testid="button-clear-constraints" onClick={() => p.onConstraints({})}
                className="h-9 rounded-lg border px-3 text-xs font-bold hover:bg-muted sm:col-span-2">
                {ar ? "إعادة كل الحقول إلى تلقائي" : "Reset every field to Automatic"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
