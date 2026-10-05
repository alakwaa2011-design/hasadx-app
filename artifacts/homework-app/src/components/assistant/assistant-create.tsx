import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  History,
  Headphones,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  getGetAssistantOperationQueryKey,
  getListAssistantOperationsQueryKey,
  useCancelAssistantWorksheet,
  useConfirmAssistantWorksheet,
  useGetAssistantOperation,
  useHideAssistantOperation,
  useListAssistantOperations,
  usePrepareAssistantWorksheet,
  useQuoteAssistantWorksheet,
  type AssistantOperation,
  type WorksheetActivityInput,
} from "@workspace/api-client-react";
import { THEMES } from "@/pages/teacher/worksheet-themes";
import { INSUFFICIENT_CREDITS_EVENT } from "@/lib/credit-aware-fetch";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { ExecutionAccess } from "./execution-access";

const ACTIVE = ["queued", "running", "saving"];
const TERMINAL = ["completed", "failed", "cancelled"];
const CANCELLABLE = ["draft", "quoted", "queued"];

const QTYPES: [string, string, string][] = [
  ["mcq", "اختيار من متعدد", "Multiple choice"],
  ["true_false", "صح وخطأ", "True / false"],
  ["short_answer", "إجابة قصيرة", "Short answer"],
  ["fill_blank", "أكمل الفراغ", "Fill in the blank"],
  ["matching", "توصيل", "Matching"],
  ["worked_problem", "مسألة محلولة", "Worked problem"],
  ["extended_response", "إجابة مطولة", "Extended response"],
  ["error_correction", "تصحيح الخطأ", "Error correction"],
  ["word_bank", "بنك كلمات", "Word bank"],
  ["compare", "مقارنة", "Compare"],
  ["tic_tac_toe", "لوحة مهام تيك تاك توك", "Tic-tac-toe tasks"],
];

const OPTS = {
  difficulty: [["easy", "سهل", "Easy"], ["medium", "متوسط", "Medium"], ["hard", "صعب", "Hard"], ["mixed", "متنوع", "Mixed"]],
  cognitiveSkill: [["remember", "التذكر", "Remember"], ["understand", "الفهم", "Understand"], ["apply", "التطبيق", "Apply"], ["analyze", "التحليل", "Analyze"], ["evaluate", "التقويم", "Evaluate"], ["create", "الإبداع", "Create"], ["mixed", "متنوع", "Mixed"]],
  assessmentMode: [["diagnostic", "تشخيصي", "Diagnostic"], ["formative", "تكويني", "Formative"], ["summative", "ختامي", "Summative"]],
  differentiation: [["none", "بدون", "None"], ["support", "دعم", "Support"], ["enrichment", "إثراء", "Enrichment"], ["scaffolded", "تدرّج", "Scaffolded"]],
  activityStyle: [["auto", "تلقائي", "Auto"], ["concept_map", "خريطة مفاهيم", "Concept map"], ["drawing", "رسم", "Drawing"], ["coloring", "تلوين", "Coloring"], ["sorting", "تصنيف", "Sorting"], ["sequencing", "ترتيب", "Sequencing"], ["group_task", "مهمة جماعية", "Group task"], ["practice", "تدريب", "Practice"]],
  executionMode: [["individual", "فردي", "Individual"], ["group", "جماعي", "Group"]],
} as const;

const ERR: Record<string, [string, string]> = {
  EXECUTION_SUBSCRIPTION_REQUIRED: ["يلزم اشتراك Basic أو Pro بعد تجربة التنفيذ الأولى. شراء النقاط وحده لا يفتح التنفيذ.", "After your first execution, Basic or Pro is required. Buying credits alone does not unlock execution."],
  EXECUTION_TRIAL_IN_PROGRESS: ["تجربتك محجوزة لعملية أخرى. انتظر اكتمالها أو ألغِها قبل بدء طلب جديد.", "Your trial is reserved for another operation. Wait for it to finish or cancel it before starting a new request."],
  PRICE_CHANGED: ["تغيّر السعر. راجع السعر الجديد ثم أكّد.", "The price changed. Review the new price, then confirm."],
  QUOTE_EXPIRED: ["انتهت صلاحية السعر. اطلب سعراً جديداً.", "The quote expired. Get a new quote."],
  DISABLED: ["المساعد غير متاح حالياً. استخدم منشئ أوراق العمل مباشرة.", "The assistant is unavailable. Use the worksheet builder directly."],
  SAVE_RETRY: ["اكتمل التوليد وتعذّر الحفظ. أعد المحاولة دون إعادة التوليد.", "Generated, but saving failed. Retry without regenerating."],
  FAILED: ["تعذّر إنشاء الورقة. ابدأ محاولة جديدة.", "Could not create the worksheet. Start a fresh attempt."],
  INTERRUPTED: ["انقطعت العملية. ابدأ محاولة جديدة.", "The operation was interrupted. Start a fresh attempt."],
  RESULT_DELETED: ["حُذفت الورقة الناتجة.", "The resulting worksheet was deleted."],
  UNSUPPORTED: ["هذا الطلب غير مدعوم هنا (مرفقات أو صور أو تصحيح تلقائي أو تعديل ورقة موجودة).", "Not supported here (attachments, images, auto grading, or editing an existing paper)."],
  CAPACITY: ["الخدمة مزدحمة الآن. حاول بعد قليل.", "The service is busy. Try again shortly."],
  INSUFFICIENT_CREDITS: ["رصيدك لا يكفي لهذه الورقة.", "Not enough credits for this worksheet."],
  STATE_CHANGED: ["تغيّر الطلب في نافذة أخرى. أعد فتحه من سجل الإنشاء.", "This request changed in another window. Reopen it from history."],
  LOCKED: ["بدأ التنفيذ ولا يمكن تعديل هذا الطلب الآن.", "Execution has started. This request is now locked."],
  RATE_LIMITED: ["بلغت حد الطلبات المؤقت. انتظر قليلًا ثم حاول.", "You reached the temporary request limit. Please wait and retry."],
  INVALID_INPUT: ["راجع الإعدادات وحدود أعداد الأسئلة قبل المتابعة.", "Review the settings and question-count limits."],
  INVALID_COUNTS: ["اختر سؤالًا واحدًا على الأقل؛ الحد الإجمالي ٣٠ سؤالًا لكل صفحة.", "Choose at least one question; the total limit is 30 per page."],
  UNAVAILABLE: ["الخدمة غير متاحة الآن. لم يبدأ طلب جديد؛ يمكنك المحاولة لاحقًا.", "The service is unavailable. No new request started; try again later."],
};

const STATUS: Record<string, [string, string]> = {
  draft: ["مسودة", "Draft"], quoted: ["جاهز للتأكيد", "Quoted"], queued: ["في الانتظار", "Queued"],
  running: ["قيد الإنشاء", "Generating"], saving: ["جارٍ الحفظ", "Saving"], completed: ["مكتمل", "Done"],
  failed: ["فشل", "Failed"], cancelled: ["أُلغي", "Cancelled"],
};

function errInfo(e: unknown): { status?: number; code?: string; data?: any } {
  const x = e as any;
  const d = x?.data;
  return { status: x?.status, code: typeof d?.code === "string" ? d.code : typeof d?.errorCode === "string" ? d.errorCode : undefined, data: d };
}

type Form = { title: string; template: string; params: WorksheetActivityInput };

function toForm(op: AssistantOperation): Form {
  return { title: op.title || "", template: op.template || "", params: { ...(op.parameters || {}) } };
}

const field = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35";

export function AssistantCreate({
  lang,
  teacherId,
  seed,
  onSeedUsed,
  onAskGuide,
  onNavigate,
}: {
  lang: string;
  teacherId: number | null;
  seed: string;
  onSeedUsed: () => void;
  onAskGuide: (text: string) => void;
  onNavigate: () => void;
}) {
  const ar = lang === "ar";
  const tr = (a: string, e: string) => (ar ? a : e);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const refreshBalance = useRefreshCreditsBalance();
  const scope = teacherId ?? "anon";

  // Account fence: every async response is dropped if the account changed.
  const fenceRef = useRef(scope);
  fenceRef.current = scope;
  const alive = (s: unknown) => fenceRef.current === s;

  const [view, setView] = useState<"compose" | "history">("compose");
  const [request, setRequest] = useState("");
  const [op, setOp] = useState<AssistantOperation | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "prepare" | "quote" | "confirm" | "cancel">(null);
  const [disabled, setDisabled] = useState(false);
  const restoredRef = useRef(false);
  const currentFormRef = useRef(form);
  const currentOperationRef = useRef(op?.id);
  currentFormRef.current = form;
  currentOperationRef.current = op?.id;

  const prepare = usePrepareAssistantWorksheet();
  const quote = useQuoteAssistantWorksheet();
  const confirm = useConfirmAssistantWorksheet();
  const cancel = useCancelAssistantWorksheet();
  const hide = useHideAssistantOperation();

  const listKey = [...getListAssistantOperationsQueryKey(), scope] as const;
  const history = useListAssistantOperations({ query: { queryKey: listKey, enabled: teacherId !== null, refetchInterval: 5000, refetchOnWindowFocus: true } as any });

  useEffect(() => {
    if (history.data && history.data.enabled === false) setDisabled(true);
    else if (history.data) setDisabled(false);
  }, [history.data]);

  // Reset all local state when the account changes.
  useEffect(() => {
    setOp(null); setForm(null); setStale(false); setNotice(null); setErrorCode(null); setBusy(null); setRequest(""); setView("compose");
    restoredRef.current = false;
  }, [scope]);
  useEffect(() => {
    if (!history.data || restoredRef.current) return;
    restoredRef.current = true;
    const pending = history.data.operations.find(o => ACTIVE.includes(o.status));
    if (pending && !seed) { setOp(pending); setForm(toForm(pending)); setErrorCode(pending.errorCode); }
  }, [history.data, seed]);

  useEffect(() => {
    if (seed) { setRequest(seed); onSeedUsed(); }
  }, [seed, onSeedUsed]);

  const polling = !!op && ACTIVE.includes(op.status);
  const opKey = [...getGetAssistantOperationQueryKey(op?.id ?? "none"), scope] as const;
  const polled = useGetAssistantOperation(op?.id ?? "none", {
    query: { queryKey: opKey, enabled: polling, refetchInterval: 2000, gcTime: 0 } as any,
  });
  useEffect(() => {
    const d = polled.data;
    if (!d || !op || d.id !== op.id || !alive(scope)) return;
    if (d.updatedAt !== op.updatedAt || d.status !== op.status) {
      setOp(d);
      setErrorCode(d.errorCode);
      if (TERMINAL.includes(d.status)) {
        refreshBalance();
        void qc.invalidateQueries({ queryKey: listKey });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled.data]);

  function applyOp(next: AssistantOperation, keepForm = false) {
    setOp(next);
    if (!keepForm) setForm(toForm(next));
    setErrorCode(next.errorCode);
    setStale(false);
    if (next.status === "quoted" || next.status === "queued") setNotice(null);
  }

  function fail(e: unknown) {
    const i = errInfo(e);
    if (i.code === "EXECUTION_SUBSCRIPTION_REQUIRED" || i.code === "EXECUTION_TRIAL_IN_PROGRESS") void history.refetch();
    if (i.status === 402) {
      window.dispatchEvent(new CustomEvent(INSUFFICIENT_CREDITS_EVENT, { detail: { required: typeof i.data?.required === "number" ? i.data.required : undefined, balance: typeof i.data?.balance === "number" ? i.data.balance : undefined } }));
      setErrorCode("INSUFFICIENT_CREDITS");
      return;
    }
    if (i.code === "DISABLED") setDisabled(true);
    const c = i.code && ERR[i.code] ? i.code : "FAILED";
    setErrorCode(c);
    if (c === "QUOTE_EXPIRED" || c === "PRICE_CHANGED") setStale(true);
  }

  const terminalOrNew = !op || TERMINAL.includes(op.status);

  function send() {
    const message = request.trim();
    if (message.length < 2 || busy) return;
    const s = scope;
    setBusy("prepare"); setErrorCode(null); setNotice(null);
    prepare.mutate(
      { data: { message, language: ar ? "ar" : "en", ...(op && !terminalOrNew ? { operationId: op.id, ...(form ? { settings: requestBody() } : {}) } : {}) } },
      {
        onSuccess: (r) => { if (!alive(s)) return; applyOp(r); setRequest(""); void qc.invalidateQueries({ queryKey: listKey }); },
        onError: (e) => { if (alive(s)) fail(e); },
        onSettled: () => { if (alive(s)) setBusy(null); },
      },
    );
  }

  function edit(patch: Partial<WorksheetActivityInput>, title?: string, template?: string) {
    setForm((f) => (f ? { title: title ?? f.title, template: template ?? f.template, params: { ...f.params, ...patch } } : f));
    setStale(true); // any change invalidates the local quote immediately
  }

  const p = form?.params;
  const missing = useMemo(() => {
    if (!p) return [] as string[];
    const m: string[] = [];
    if (!p.topic?.trim() && !p.sourceText?.trim()) m.push("topic");
    if (!p.subject?.trim()) m.push("subject");
    if (!p.gradeLevel?.trim()) m.push("gradeLevel");
    if (p.questionSelection === "manual" && Object.values(p.counts ?? {}).reduce((a, b) => a + b, 0) < 1) m.push("counts");
    return m;
  }, [p]);

  const requestBody = () => ({ title: form!.title.trim() || op!.title || "ورقة عمل", template: form!.template || "geometric", parameters: form!.params });

  // Quote automatically; the price is information, not a separate user action.
  useEffect(() => {
    if (!op || !form || busy || disabled || missing.length || errorCode) return;
    if (!["draft", "quoted"].includes(op.status) && !(op.status === "saving" && op.errorCode === "SAVE_RETRY")) return;
    if (!stale && op.quote && new Date(op.quote.expiresAt).getTime() > Date.now()) return;
    const timer = window.setTimeout(() => getQuote(), stale ? 250 : 0);
    return () => window.clearTimeout(timer);
    // getQuote uses the current render; dependencies below include its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op?.id, op?.status, form, stale, busy, disabled, missing.length, errorCode]);

  function getQuote(then?: (q: AssistantOperation) => void) {
    if (!op || !form || busy) return;
    const s = scope;
    const requestedId = op.id, requestedForm = form;
    setBusy("quote"); setErrorCode(null);
    quote.mutate({ id: op.id, data: requestBody() }, {
      onSuccess: (r) => {
        if (!alive(s) || currentOperationRef.current !== requestedId || currentFormRef.current !== requestedForm) return;
        applyOp(r, true); then?.(r);
      },
      onError: (e) => { if (alive(s)) fail(e); },
      onSettled: () => { if (alive(s)) setBusy(null); },
    });
  }

  function startConfirm(quoteId: string) {
    if (!op) return;
    const s = scope;
    setBusy("confirm");
    confirm.mutate({ id: op.id, data: { quoteId } }, {
      onSuccess: (r) => { if (!alive(s)) return; applyOp(r, true); refreshBalance(); void qc.invalidateQueries({ queryKey: listKey }); },
      onError: (e) => { if (alive(s)) fail(e); refreshBalance(); },
      onSettled: () => { if (alive(s)) setBusy(null); },
    });
  }

  function confirmNow() {
    if (!op || !form || busy || missing.length) return;
    const shown = stale ? undefined : op.quote?.credits;
    // Always refresh the quote before confirming; fail closed on any change.
    const s = scope;
    const requestedId = op.id, requestedForm = form;
    setBusy("quote"); setErrorCode(null);
    quote.mutate({ id: op.id, data: requestBody() }, {
      onSuccess: (r) => {
        if (!alive(s)) return;
        if (currentOperationRef.current !== requestedId || currentFormRef.current !== requestedForm) { setBusy(null); return; }
        applyOp(r, true);
        if (!r.quote || (typeof shown === "number" && r.quote.credits !== shown)) {
          setErrorCode("PRICE_CHANGED");
          setBusy(null);
          return;
        }
        startConfirm(r.quote.id);
      },
      onError: (e) => { if (alive(s)) { fail(e); setBusy(null); } },
    });
  }

  function doCancel(o: AssistantOperation) {
    const s = scope;
    setBusy("cancel");
    cancel.mutate({ id: o.id }, {
      onSuccess: (r) => { if (!alive(s)) return; if (op?.id === o.id) applyOp(r, true); void qc.invalidateQueries({ queryKey: listKey }); refreshBalance(); },
      onError: (e) => { if (alive(s)) fail(e); },
      onSettled: () => { if (alive(s)) setBusy(null); },
    });
  }

  function doHide(o: AssistantOperation) {
    const s = scope;
    hide.mutate({ id: o.id }, {
      onSuccess: () => { if (!alive(s)) return; if (op?.id === o.id) { setOp(null); setForm(null); } void qc.invalidateQueries({ queryKey: listKey }); },
    });
  }

  function reset() { restoredRef.current = true; setOp(null); setForm(null); setStale(false); setErrorCode(null); setNotice(null); setView("compose"); }

  function openOp(o: AssistantOperation) { applyOp(o); setView("compose"); }

  const quoteValid = !!op?.quote && !stale && new Date(op.quote.expiresAt).getTime() > Date.now();
  const inSetup = !!op && !!form && (op.status === "draft" || op.status === "quoted");
  const editing = inSetup;

  function ErrBanner() {
    if (!errorCode) return null;
    const m = ERR[errorCode] ?? ERR.FAILED;
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2" data-testid="text-assistant-error">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <p>{tr(m[0], m[1])}</p>
          {op && ["FAILED", "INTERRUPTED", "UNSUPPORTED", "CAPACITY"].includes(errorCode) && (
            <button type="button" onClick={() => onAskGuide(`${tr("أحتاج مساعدة في عملية إنشاء ورقة", "I need help with a worksheet creation")} (${op.id} / ${errorCode})`)} className="inline-flex items-center gap-1 font-bold underline" data-testid="button-assistant-ask-guide">
              <Headphones className="w-3 h-3" />{tr("اسأل المرشد عن المشكلة", "Ask the Guide about this")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const ops = history.data?.operations ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {teacherId !== null && <div className="mx-3 mt-3 max-h-52 overflow-y-auto shrink-0">
        <ExecutionAccess key={scope} teacherId={teacherId} ar={lang === "ar"}
          access={history.data?.executionAccess}
          operationId={op?.id ?? history.data?.executionAccess?.consumedOperationId ?? history.data?.operations[0]?.id} />
      </div>}
      {disabled && <div className="mx-3 mt-3 rounded-xl border bg-muted/40 p-3 space-y-2" data-testid="panel-assistant-disabled">
        <p className="text-xs font-bold">{tr("الإنشاء بالمساعد غير متاح لهذا الحساب حاليًا", "Assistant creation is currently unavailable for this account")}</p>
        <p className="text-[11px] text-muted-foreground">{tr("يبقى سجلك ونتائجك متاحين. يمكنك استخدام منشئ أوراق العمل مباشرة.", "Your history and results remain available. You can use the worksheet builder directly.")}</p>
        <button type="button" onClick={() => { onNavigate(); setLocation("/teacher/worksheets/create"); }} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-assistant-direct-builder">{tr("فتح منشئ أوراق العمل", "Open worksheet builder")}</button>
      </div>}
      <div className="flex items-center gap-1 px-3 pt-2 text-[11px]">
        <button type="button" onClick={() => setView("compose")} className={`rounded-md px-2 py-1 font-bold ${view === "compose" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} data-testid="button-create-compose">{tr("طلب جديد", "Compose")}</button>
        <button type="button" onClick={() => setView("history")} className={`rounded-md px-2 py-1 font-bold inline-flex items-center gap-1 ${view === "history" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} data-testid="button-create-history"><History className="w-3 h-3" />{tr("سجل الإنشاء", "Creation history")}</button>
        {op && view === "compose" && (
          <button type="button" onClick={reset} className="ms-auto rounded-md px-2 py-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="button-create-new"><Plus className="w-3 h-3" />{tr("جديد", "New")}</button>
        )}
      </div>

      {view === "history" ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
          {history.isError && (
            <div className="text-center text-xs space-y-2 py-6"><p>{tr("تعذّر تحميل السجل", "Could not load history")}</p>
              <button type="button" onClick={() => history.refetch()} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold"><RefreshCw className="w-3 h-3" />{tr("إعادة المحاولة", "Retry")}</button></div>
          )}
          {!history.isLoading && !history.isError && ops.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-10">{tr("لا توجد طلبات إنشاء بعد. صف الورقة التي تريدها وسأجهّز إعدادها.", "No creation requests yet. Describe the worksheet you want.")}</div>
          )}
          {ops.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-2.5 flex items-center gap-2" data-testid={`row-operation-${o.id}`}>
              <button type="button" onClick={() => openOp(o)} className="min-w-0 flex-1 text-start">
                <div className="truncate text-xs font-bold">{o.title || o.requestText}</div>
                <div className="text-[10px] text-muted-foreground">{tr(STATUS[o.status]?.[0] ?? o.status, STATUS[o.status]?.[1] ?? o.status)}{o.credits > 0 ? ` · ${o.credits} ${tr("نقطة", "cr")}` : ""}</div>
              </button>
              {CANCELLABLE.includes(o.status) && <button type="button" onClick={() => doCancel(o)} className="text-[11px] font-bold text-muted-foreground hover:text-destructive px-1.5">{tr("إلغاء", "Cancel")}</button>}
               {TERMINAL.includes(o.status) && <button type="button" onClick={() => { if (window.confirm(tr("إخفاء الطلب من السجل؟ لن تُحذف الورقة أو سجلات النقاط.", "Hide this request? Its worksheet and credit records will remain."))) doHide(o); }} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label={tr("إخفاء من السجل", "Hide from history")} data-testid={`button-hide-${o.id}`}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {ops.length > 0 && <p className="text-[10px] text-muted-foreground text-center">{tr("الإخفاء لا يحذف الورقة المحفوظة ولا سجل النقاط.", "Hiding keeps the saved worksheet and credit records.")}</p>}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!op && (
            <div className="text-center py-4 space-y-1">
              <div className="text-sm font-bold">{tr("ماذا تريد أن تُجهّز؟", "What should we prepare?")}</div>
              <p className="text-[11px] text-muted-foreground">{tr("اكتب طلبك بحرية، ثم راجع الإعدادات والسعر قبل أي خصم.", "Describe it freely, then review settings and price before any charge.")}</p>
              <p className="text-[10px] text-muted-foreground">{tr("التحضير مجاني. يُخصم رصيد ورقة العمل فقط عند التأكيد.", "Preparing is free. Credits are charged only when you confirm.")}</p>
            </div>
          )}

          {op?.messages?.length ? (
            <div className="space-y-1.5">
              {op.messages.slice(-4).map((m, i) => (
                <div key={i} className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground ms-6" : "bg-muted me-6"}`}>{m.text}</div>
              ))}
            </div>
          ) : op?.reply ? <div className="rounded-xl bg-muted px-3 py-2 text-xs whitespace-pre-wrap">{op.reply}</div> : null}

          <ErrBanner />

          {editing && form && p && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2.5" data-testid="form-assistant-setup">
              <div className="text-xs font-bold">{tr("إعدادات الورقة", "Worksheet setup")}</div>
              <label className="block text-[11px] font-bold">{tr("العنوان", "Title")}
                <input className={`${field} mt-1`} value={form.title} maxLength={200} onChange={(e) => edit({}, e.target.value)} data-testid="input-assistant-title" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([["subject", "المادة", "Subject"], ["gradeLevel", "الصف", "Grade"]] as const).map(([k, a, e]) => (
                  <label key={k} className="block text-[11px] font-bold">{tr(a, e)}{missing.includes(k) && <span className="text-destructive"> *</span>}
                    <input className={`${field} mt-1 ${missing.includes(k) ? "border-destructive/60" : ""}`} value={(p[k] as string) ?? ""} maxLength={k === "subject" ? 100 : 50} onChange={(ev) => edit({ [k]: ev.target.value })} data-testid={`input-assistant-${k}`} />
                  </label>
                ))}
              </div>
              <label className="block text-[11px] font-bold">{tr("الموضوع", "Topic")}{missing.includes("topic") && <span className="text-destructive"> *</span>}
                <input className={`${field} mt-1 ${missing.includes("topic") ? "border-destructive/60" : ""}`} value={p.topic ?? ""} maxLength={500} onChange={(e) => edit({ topic: e.target.value })} data-testid="input-assistant-topic" />
              </label>
              <label className="block text-[11px] font-bold">{tr("نص مصدر ألصقه (اختياري)", "Pasted source text (optional)")}
                <textarea className={`${field} mt-1 min-h-[64px]`} value={p.sourceText ?? ""} maxLength={12000} onChange={(e) => edit({ sourceText: e.target.value })} data-testid="input-assistant-source" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-[11px] font-bold">{tr("اللغة", "Language")}
                  <select className={`${field} mt-1`} value={p.language ?? (ar ? "ar" : "en")} onChange={(e) => edit({ language: e.target.value as "ar" | "en" })}><option value="ar">العربية</option><option value="en">English</option></select>
                </label>
                <label className="block text-[11px] font-bold">{tr("الصفحات", "Pages")}
                  <select className={`${field} mt-1`} value={p.pages ?? 1} onChange={(e) => edit({ pages: Number(e.target.value) as 1 | 2 | 3 })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <label className="block text-[11px] font-bold">{tr("الصعوبة", "Difficulty")}
                  <select className={`${field} mt-1`} value={p.difficulty ?? "mixed"} onChange={(e) => edit({ difficulty: e.target.value as any })}>{OPTS.difficulty.map(([v, a, e]) => <option key={v} value={v}>{tr(a, e)}</option>)}</select>
                </label>
              </div>
              <label className="block text-[11px] font-bold">{tr("تصميم الورقة", "Design")}
                <select className={`${field} mt-1`} value={form.template} onChange={(e) => edit({}, undefined, e.target.value)} data-testid="select-assistant-template">
                  {!Object.keys(THEMES).includes(form.template) && form.template && <option value={form.template}>{form.template}</option>}
                  {Object.values(THEMES).map((t: any) => <option key={t.id} value={t.id}>{ar ? t.nameAr : t.nameEn}</option>)}
                </select>
              </label>

              <div className="text-[11px] font-bold">{tr("الأسئلة", "Questions")}{missing.includes("counts") && <span className="text-destructive"> *</span>}</div>
              <div className="flex gap-1.5">
                {(["auto", "manual"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => edit({ questionSelection: m })} className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${(p.questionSelection ?? "auto") === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`} aria-pressed={(p.questionSelection ?? "auto") === m}>
                    {m === "auto" ? tr("اقتراح تلقائي حسب الدرس", "Auto suggestions for this lesson") : tr("يدوي", "Manual counts")}
                  </button>
                ))}
              </div>
              {p.questionSelection === "manual" && (
                <div className="grid grid-cols-2 gap-1.5">
                  {QTYPES.map(([k, a, e]) => (
                    <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1 text-[11px]">
                      <span className="truncate">{tr(a, e)}</span>
                       <input type="number" min={0} max={k === "tic_tac_toe" ? 1 : k === "matching" ? 10 : k === "word_bank" ? 20 : 40} className="w-12 rounded border border-border bg-background px-1 py-0.5 text-center" value={p.counts?.[k] ?? 0}
                         onChange={(ev) => { const max = k === "tic_tac_toe" ? 1 : k === "matching" ? 10 : k === "word_bank" ? 20 : 40; const n = Math.max(0, Math.min(max, Number(ev.target.value) || 0)); edit({ counts: { ...(p.counts ?? {}), [k]: n } }); }} />
                    </label>
                  ))}
                </div>
              )}

              <details className="group rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-1.5 text-[11px] font-bold">{tr("إعدادات تدريس متقدمة", "Advanced teaching settings")}<ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" /></summary>
                <div className="grid grid-cols-2 gap-2 p-2.5 pt-1">
                  {(["cognitiveSkill", "assessmentMode", "differentiation", "activityStyle", "executionMode"] as const).map((k) => {
                    const lbl: Record<string, [string, string]> = { cognitiveSkill: ["المهارة المعرفية", "Cognitive skill"], assessmentMode: ["نمط التقويم", "Assessment"], differentiation: ["التمايز", "Differentiation"], activityStyle: ["نمط النشاط", "Activity style"], executionMode: ["طريقة التنفيذ", "Execution"] };
                    return (
                      <label key={k} className="block text-[11px] font-bold">{tr(lbl[k][0], lbl[k][1])}
                        <select className={`${field} mt-1`} value={(p[k] as string) ?? ""} onChange={(e) => edit({ [k]: e.target.value || undefined })}>
                          <option value="">{tr("افتراضي", "Default")}</option>
                          {OPTS[k].map(([v, a, e]) => <option key={v} value={v}>{tr(a, e)}</option>)}
                        </select>
                      </label>
                    );
                  })}
                  {p.executionMode === "group" && (
                    <label className="block text-[11px] font-bold">{tr("حجم المجموعة", "Group size")}
                      <input type="number" min={2} max={6} className={`${field} mt-1`} value={p.groupSize ?? 3} onChange={(e) => edit({ groupSize: Math.max(2, Math.min(6, Number(e.target.value) || 2)) })} />
                    </label>
                  )}
                  <label className="block text-[11px] font-bold">{tr("المدة (دقيقة)", "Duration (min)")}
                    <input type="number" min={5} max={90} className={`${field} mt-1`} value={p.activityDuration ?? ""} onChange={(e) => edit({ activityDuration: e.target.value ? Math.max(5, Math.min(90, Number(e.target.value))) : undefined })} />
                  </label>
                  <label className="col-span-2 block text-[11px] font-bold">{tr("هدف التعلم", "Learning objective")}
                    <input className={`${field} mt-1`} maxLength={500} value={p.learningObjective ?? ""} onChange={(e) => edit({ learningObjective: e.target.value || undefined })} />
                  </label>
                </div>
              </details>

              {missing.length > 0 && <p className="text-[11px] text-destructive">{tr("أكمل الحقول المطلوبة المعلّمة بنجمة.", "Fill the required fields marked with *.")}</p>}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {quoteValid && op?.quote ? (
                  <div className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary" data-testid="text-assistant-price"
                    title={op.quote.credits === 0 ? tr("بحسب إعدادات النقاط الحالية لهذا الحساب، وليس إعفاءً لتجربة Free.", "Based on this account's current credit settings, not a Free-trial waiver.") : undefined}>
                    {op.quote.credits === 0 ? tr("بدون خصم نقاط لهذا الحساب", "No credit deduction for this account") : tr(`السعر: ${op.quote.credits} نقطة`, `Price: ${op.quote.credits} credits`)}
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground" aria-live="polite" data-testid="text-assistant-price">
                    {missing.length ? tr("أكمل الإعدادات لحساب التكلفة", "Complete settings to calculate the cost") : errorCode ? tr("سيُتحقق من التكلفة عند التأكيد", "The cost will be checked on confirmation") : tr("جارٍ تحديث التكلفة تلقائيًا…", "Updating the cost automatically…")}
                  </div>
                )}
                <button type="button" onClick={confirmNow} disabled={disabled || !!busy || missing.length > 0} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40" data-testid="button-assistant-confirm">
                  {busy === "confirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : tr("تأكيد وبدء الإنشاء", "Confirm and start")}
                </button>
                {op && CANCELLABLE.includes(op.status) && <button type="button" onClick={() => doCancel(op)} disabled={!!busy} className="text-[11px] font-bold text-muted-foreground hover:text-destructive">{tr("إلغاء المسودة", "Cancel draft")}</button>}
              </div>
            </div>
          )}

          {op && !editing && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2" data-testid={`card-operation-${op.id}`}>
              <div className="flex items-center gap-2">
                {ACTIVE.includes(op.status) ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : op.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{op.title}</div>
                  <div className="text-[10px] text-muted-foreground" data-testid="text-assistant-status">{tr(STATUS[op.status]?.[0] ?? op.status, STATUS[op.status]?.[1] ?? op.status)}{op.credits > 0 ? ` · ${op.credits} ${tr("نقطة", "credits")}` : ""}</div></div>
              </div>
              {op.status === "completed" && op.worksheetId && (
                <>
                  <button type="button" onClick={() => { onNavigate(); setLocation(`/teacher/worksheets/create?edit=${op.worksheetId}`); }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" data-testid="button-assistant-open-draft">
                    <ArrowUpRight className="w-3.5 h-3.5" />{tr("فتح المسودة الخاصة للمراجعة", "Open private draft to review")}
                  </button>
                  <p className="text-[10px] text-muted-foreground">{tr("تحقق من تقسيم الصفحات الفعلي عند الطباعة قبل الاستخدام.", "Check the actual print pagination before use.")}</p>
                </>
              )}
              {op.status === "saving" && op.errorCode === "SAVE_RETRY" && (
                <p className="text-xs text-muted-foreground">{tr(`تكلفة الطلب: ${op.quote?.credits ?? op.credits} نقطة. سيُستكمل الحفظ دون توليد جديد.`, `Request cost: ${op.quote?.credits ?? op.credits} credits. Resume saving without regenerating.`)}</p>
              )}
              {op.status === "saving" && op.errorCode === "SAVE_RETRY" && (
                <button type="button" onClick={confirmNow} disabled={!!busy} className="w-full rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary" data-testid="button-assistant-retry-save">{tr("إعادة محاولة الحفظ", "Retry saving")}</button>
              )}
              {["failed", "cancelled"].includes(op.status) && (
                <button type="button" onClick={() => { setRequest(op.requestText); reset(); }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary" data-testid="button-assistant-fresh-retry">
                  <RefreshCw className="w-3.5 h-3.5" />{tr("محاولة جديدة", "Start a fresh attempt")}
                </button>
              )}
              {op.status === "queued" && <button type="button" onClick={() => doCancel(op)} disabled={!!busy} className="text-[11px] font-bold text-muted-foreground hover:text-destructive">{tr("إلغاء الطلب", "Cancel request")}</button>}
              {TERMINAL.includes(op.status) && <button type="button" onClick={() => doHide(op)} className="text-[11px] text-muted-foreground hover:text-destructive">{tr("إخفاء من السجل", "Hide from history")}</button>}
            </div>
          )}
          {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
        </div>
      )}

      {!disabled && view === "compose" && (!op || editing || terminalOrNew) && (
        <div className="border-t border-border p-3 shrink-0 flex items-end gap-2">
          <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={2} maxLength={12000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={editing ? tr("اطلب تعديلاً على الإعدادات…", "Ask to adjust the setup…") : tr("مثال: ورقة عمل عن الكسور للصف الرابع، 10 أسئلة…", "e.g. a fractions worksheet for grade 4, 10 questions…")}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35 max-h-32" data-testid="input-assistant-request" />
          <button type="button" onClick={send} disabled={!!busy || request.trim().length < 2} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40" aria-label={tr("إرسال", "Send")} data-testid="button-assistant-send">
            {busy === "prepare" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
