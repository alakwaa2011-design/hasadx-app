/**
 * Activity picker for the slide editor (Phase 2A).
 *
 * Three insertion paths (per spec):
 *   1) "compose"  — author a fresh question inline. Optional
 *                   "save to question bank too" checkbox POSTs the
 *                   composed question to /api/question-bank when
 *                   the user wants the artefact reused later.
 *   2) "bank"     — pick from the teacher's own bank or the shared
 *                   bank with type filters. Selecting inserts a
 *                   questionId-only reference (no duplicated prompt
 *                   or options) — the renderer/exporter resolves
 *                   the bank entry at read time.
 *   3) "convert"  — turn the current slide's first text element
 *                   into a question prompt without manual retyping.
 *
 * The dialog only **builds** the element + signals a save-to-bank
 * preference; insertion + persistence happen in the parent editor.
 */
import { useEffect, useMemo, useState } from "react";
import type { SlideElement, Slide } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Loader2, Search, Sparkles, Wand2 } from "lucide-react";

const BRAND_GREEN = "#225739";
const API_BASE = import.meta.env.VITE_API_URL || "";

type ActivityKind = "mcq" | "true_false" | "open" | "poll" | "word_cloud" | "open_wall";
type BankSource = "own" | "shared";
type TypeFilter = "all" | "mcq" | "true_false" | "open";

interface BankItem {
  id: number;
  text: string;
  questionType?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer?: string | null;
  isAdminContent?: boolean;
  teacherName?: string | null;
}

export interface ActivityPickPayload {
  element: SlideElement;
  saveToBank?: boolean;
  /* When set, the parent should remove this element id from the
     current slide before inserting the new activity (used by the
     "convert this slide" flow so the source text is replaced). */
  replaceElementId?: string;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function blankElement(kind: ActivityKind): SlideElement {
  return {
    id: genId("a"),
    kind: "activity",
    activityKind: kind,
    prompt: "",
    options: kind === "mcq" || kind === "poll" ? ["", ""] : kind === "true_false" ? ["صح", "خطأ"] : undefined,
    correctIndex: kind === "mcq" ? 0 : undefined,
    x: 140, y: 120, w: 1000, h: 480,
  } as SlideElement;
}

export function ActivityPickerDialog({
  open, onClose, onPick, isAr, currentSlide, initialPrompt, initialKind,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (payload: ActivityPickPayload) => void;
  isAr: boolean;
  currentSlide?: Slide | null;
  /* Optional seeds for the Compose tab — used when the picker is
     opened from an AI activity suggestion so the teacher only has
     to confirm/tweak instead of retyping. */
  initialPrompt?: string;
  initialKind?: ActivityKind;
}) {
  const [tab, setTab] = useState<"compose" | "bank" | "convert">("compose");
  const [kind, setKind] = useState<ActivityKind>(initialKind ?? "mcq");
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [saveToBank, setSaveToBank] = useState(false);

  /* Re-seed compose state every time the dialog opens so a fresh
     suggestion replaces stale values from a prior session. */
  useEffect(() => {
    if (!open) return;
    setTab("compose");
    setKind(initialKind ?? "mcq");
    setPrompt(initialPrompt ?? "");
    setSaveToBank(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt, initialKind]);

  /* Bank tab state */
  const [bankSource, setBankSource] = useState<BankSource>("own");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bankCache, setBankCache] = useState<Record<BankSource, BankItem[] | undefined>>({
    own: undefined,
    shared: undefined,
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankErr, setBankErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (kind === "true_false") setOptions(["صح", "خطأ"]);
    else if (kind === "open") setOptions([]);
    else if (options.length < 2) setOptions(["", ""]);
    setCorrectIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  /* Lazy-load whichever bank slice the user is viewing. Cache per
     source so toggling between own/shared doesn't refetch. */
  useEffect(() => {
    if (tab !== "bank") return;
    if (bankCache[bankSource] !== undefined || bankLoading) return;
    setBankLoading(true);
    setBankErr(null);
    const url = bankSource === "shared"
      ? `${API_BASE}/api/question-bank/shared`
      : `${API_BASE}/api/question-bank`;
    fetch(url, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as BankItem[];
      })
      .then((rows) => setBankCache((prev) => ({ ...prev, [bankSource]: Array.isArray(rows) ? rows : [] })))
      .catch((e: Error) => setBankErr(e.message))
      .finally(() => setBankLoading(false));
  }, [tab, bankSource, bankCache, bankLoading]);

  const bankRows = bankCache[bankSource] ?? [];
  const filteredBank = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bankRows
      .filter((b) => typeFilter === "all" ? true : (b.questionType ?? "mcq") === typeFilter)
      .filter((b) => q ? (b.text ?? "").toLowerCase().includes(q) : true);
  }, [bankRows, search, typeFilter]);

  if (!open) return null;

  const labels: Record<ActivityKind, string> = {
    mcq: isAr ? "اختيار من متعدد" : "Multiple choice",
    true_false: isAr ? "صح / خطأ" : "True / False",
    open: isAr ? "إجابة مفتوحة" : "Open answer",
    poll: isAr ? "تصويت" : "Poll",
    word_cloud: isAr ? "☁ سحابة الكلمات" : "☁ Word Cloud",
    open_wall: isAr ? "💬 جدار الردود" : "💬 Response Wall",
  };

  const submitCompose = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error(isAr ? "اكتب نص السؤال / التعليمات" : "Enter a question or prompt");
      return;
    }
    /* word_cloud and open_wall never need options. */
    const isTextOnly = kind === "word_cloud" || kind === "open_wall";
    const cleanOpts = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if ((kind === "mcq" || kind === "poll") && cleanOpts.length < 2) {
      toast.error(isAr ? "أضف خيارين على الأقل" : "Add at least 2 options");
      return;
    }
    const el: SlideElement = {
      id: genId("a"),
      kind: "activity",
      activityKind: kind,
      prompt: trimmed.slice(0, 2000),
      options: isTextOnly || kind === "open" ? undefined : (kind === "true_false" ? ["صح", "خطأ"] : cleanOpts),
      correctIndex: kind === "mcq" && correctIndex < cleanOpts.length ? correctIndex : undefined,
      x: 140, y: 120, w: 1000, h: 480,
    } as SlideElement;
    onPick({ element: el, saveToBank });
    onClose();
  };

  /* questionId-only reference: do NOT duplicate the prompt/options
     into the slide element. The renderer/exporter looks them up by
     id at read time. The element keeps its layout box so it lives
     visually where the user dropped it.
     For the SHARED tab the original row belongs to another teacher;
     the server's PUT handler enforces strict ownership of any
     referenced questionId, so we first POST `/question-bank/:id/import`
     to clone the shared row into the current teacher's bank and then
     reference the new id. */
  const [importing, setImporting] = useState(false);
  const submitFromBank = async (q: BankItem) => {
    const guessedKind: ActivityKind =
      q.questionType === "true_false" ? "true_false"
      : q.questionType === "open" ? "open"
      : "mcq";
    let refId = q.id;
    if (bankSource === "shared") {
      try {
        setImporting(true);
        const r = await fetch(`${API_BASE}/api/question-bank/${q.id}/import`, {
          method: "POST",
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const out = (await r.json()) as { id?: number };
        if (typeof out.id !== "number") throw new Error("Bad import response");
        refId = out.id;
      } catch {
        toast.error(isAr ? "تعذّر استيراد السؤال المشترك" : "Failed to import shared question");
        setImporting(false);
        return;
      } finally {
        setImporting(false);
      }
    }
    const el: SlideElement = {
      id: genId("a"),
      kind: "activity",
      activityKind: guessedKind,
      questionId: refId,
      x: 140, y: 120, w: 1000, h: 480,
    } as SlideElement;
    onPick({ element: el });
    onClose();
  };

  /* Take the first text element on the current slide and use its
     contents as the question prompt. The element is replaced (not
     duplicated) so the slide doesn't end up with both the static
     text and the new activity on top of it. */
  const convertCandidate = (currentSlide?.elements ?? [])
    .find((e) => (e as { kind?: string }).kind === "text") as
    (SlideElement & { text?: string; id: string }) | undefined;

  const submitConvert = (targetKind: ActivityKind) => {
    if (!convertCandidate) return;
    const text = (convertCandidate.text ?? "").trim().slice(0, 2000);
    if (!text) {
      toast.error(isAr ? "اختر شريحة فيها نص" : "Pick a slide with text first");
      return;
    }
    const el: SlideElement = {
      id: genId("a"),
      kind: "activity",
      activityKind: targetKind,
      prompt: text,
      options: targetKind === "mcq" || targetKind === "poll"
        ? ["", ""]
        : targetKind === "true_false"
          ? ["صح", "خطأ"]
          : undefined,
      correctIndex: targetKind === "mcq" ? 0 : undefined,
      x: 140, y: 120, w: 1000, h: 480,
    } as SlideElement;
    onPick({ element: el, replaceElementId: convertCandidate.id });
    onClose();
  };

  const tabs = [
    { id: "compose" as const, label: isAr ? "إنشاء سؤال جديد" : "Compose" },
    { id: "bank" as const, label: isAr ? "من بنك الأسئلة" : "From bank" },
    { id: "convert" as const, label: isAr ? "تحويل هذه الشريحة" : "Convert slide" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        dir={isAr ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ background: `${BRAND_GREEN}08` }}>
          <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: BRAND_GREEN }}>
            <Sparkles className="w-5 h-5" />
            {isAr ? "إضافة نشاط" : "Add activity"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
        </div>

        <div className="flex border-b border-border bg-muted/20">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 px-4 py-3 text-sm font-bold transition-colors"
              style={{
                color: tab === t.id ? BRAND_GREEN : "#64748b",
                borderBottom: tab === t.id ? `3px solid ${BRAND_GREEN}` : "3px solid transparent",
                background: tab === t.id ? "white" : "transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "compose" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold text-muted-foreground block mb-2">
                  {isAr ? "نوع النشاط" : "Activity type"}
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(["mcq", "true_false", "open", "poll", "word_cloud", "open_wall"] as ActivityKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className="px-3 py-2 text-xs font-bold rounded-lg border transition-all"
                      style={{
                        background: kind === k ? BRAND_GREEN : "white",
                        color: kind === k ? "white" : "#1f2937",
                        borderColor: kind === k ? BRAND_GREEN : "#e5e7eb",
                      }}
                    >
                      {labels[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground block mb-2">
                  {isAr ? "نص السؤال" : "Question"}
                </Label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
                  rows={3}
                  className="w-full p-3 text-sm border border-border rounded-lg bg-white resize-y outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={isAr ? "اكتب سؤالك هنا…" : "Type your question…"}
                />
              </div>

              {(kind === "mcq" || kind === "poll") && (
                <div>
                  <Label className="text-xs font-bold text-muted-foreground block mb-2">
                    {isAr ? "الخيارات" : "Options"}
                  </Label>
                  <div className="space-y-2">
                    {options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {kind === "mcq" && (
                          <input
                            type="radio"
                            checked={correctIndex === i}
                            onChange={() => setCorrectIndex(i)}
                            className="w-4 h-4 accent-emerald-700"
                            title={isAr ? "الإجابة الصحيحة" : "Correct"}
                          />
                        )}
                        <Input
                          value={opt}
                          onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value.slice(0, 500) : o)))}
                          placeholder={`${isAr ? "خيار" : "Option"} ${String.fromCharCode(65 + i)}`}
                        />
                        {options.length > 2 && (
                          <button
                            onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                            className="text-red-500 hover:text-red-700 text-sm font-bold w-7 h-7 rounded hover:bg-red-50"
                          >×</button>
                        )}
                      </div>
                    ))}
                    {options.length < 8 && (
                      <Button size="sm" variant="outline" onClick={() => setOptions((prev) => [...prev, ""])}>
                        + {isAr ? "خيار جديد" : "Add option"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {kind === "true_false" && (
                <p className="text-xs text-muted-foreground">
                  {isAr ? "الخياران ثابتان: «صح» و «خطأ»." : 'Options are fixed: "True" and "False".'}
                </p>
              )}

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mt-2 select-none">
                <input
                  type="checkbox"
                  checked={saveToBank}
                  onChange={(e) => setSaveToBank(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700"
                />
                <span>{isAr ? "احفظ هذا السؤال في بنك الأسئلة أيضاً" : "Also save this question to the bank"}</span>
              </label>
            </div>
          )}

          {tab === "bank" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex border border-border rounded-lg overflow-hidden">
                  {(["own", "shared"] as BankSource[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBankSource(s)}
                      className="px-3 py-1.5 text-xs font-bold transition-colors"
                      style={{
                        background: bankSource === s ? BRAND_GREEN : "white",
                        color: bankSource === s ? "white" : "#475569",
                      }}
                    >
                      {s === "own" ? (isAr ? "أسئلتي" : "Mine") : (isAr ? "مشتركة" : "Shared")}
                    </button>
                  ))}
                </div>
                <div className="inline-flex border border-border rounded-lg overflow-hidden">
                  {(["all", "mcq", "true_false", "open"] as TypeFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTypeFilter(f)}
                      className="px-2.5 py-1.5 text-[11px] font-bold transition-colors"
                      style={{
                        background: typeFilter === f ? "#1f2937" : "white",
                        color: typeFilter === f ? "white" : "#64748b",
                      }}
                    >
                      {f === "all" ? (isAr ? "الكل" : "All")
                        : f === "mcq" ? (isAr ? "اختيار" : "MCQ")
                        : f === "true_false" ? (isAr ? "صح/خطأ" : "T/F")
                        : (isAr ? "مفتوح" : "Open")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute top-2.5 start-3 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isAr ? "ابحث في بنك الأسئلة…" : "Search question bank…"}
                  className="ps-9"
                />
              </div>
              {bankLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              {bankErr && !bankLoading && (
                <p className="text-sm text-red-600 text-center py-6">
                  {isAr ? "تعذّر تحميل بنك الأسئلة" : "Failed to load question bank"}
                </p>
              )}
              {!bankLoading && !bankErr && filteredBank.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">
                  {isAr ? "لا توجد أسئلة مطابقة." : "No matching questions."}
                </p>
              )}
              {!bankLoading && filteredBank.length > 0 && (
                <ul className="divide-y divide-border border border-border rounded-lg max-h-[50vh] overflow-y-auto">
                  {filteredBank.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => submitFromBank(q)}
                        disabled={importing}
                        className="w-full text-start px-3 py-2.5 hover:bg-emerald-50/40 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide" style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}>
                            {q.questionType ?? "mcq"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground line-clamp-2">{q.text}</div>
                            {bankSource === "shared" && q.teacherName && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {isAr ? "من" : "by"} {q.teacherName}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "convert" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 border border-border bg-muted/20">
                <div className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5" />
                  {isAr ? "نص الشريحة الحالية" : "Current slide text"}
                </div>
                <div className="text-sm whitespace-pre-wrap text-foreground min-h-[40px]">
                  {convertCandidate?.text?.trim() || (
                    <span className="text-muted-foreground italic">
                      {isAr ? "لا يوجد نص في هذه الشريحة." : "No text on this slide."}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {isAr
                  ? "اختر نوع النشاط وسنحوّل النص أعلاه إلى سؤال يستبدل النص الأصلي."
                  : "Pick an activity type — the text above will become the question, replacing the original."}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["mcq", "true_false", "open", "poll"] as ActivityKind[]).map((k) => (
                  <button
                    key={k}
                    disabled={!convertCandidate?.text?.trim()}
                    onClick={() => submitConvert(k)}
                    className="px-3 py-3 text-xs font-bold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                    style={{
                      background: "white",
                      color: BRAND_GREEN,
                      borderColor: `${BRAND_GREEN}40`,
                    }}
                  >
                    {labels[k]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          {tab === "compose" && (
            <Button
              size="sm"
              onClick={submitCompose}
              style={{ background: BRAND_GREEN, color: "white" }}
            >
              {isAr ? "إضافة إلى الشريحة" : "Insert into slide"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { blankElement as makeBlankActivity };
