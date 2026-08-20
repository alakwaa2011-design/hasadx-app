import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, ChevronRight, Loader2, CheckCircle2,
  Edit2, Trash2, GripVertical, Plus, PlayCircle, X, Check,
  ArrowRight, ArrowLeft, BookOpen, Clock, Users, Wand2, Volume2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import { createClientRequestId } from "@/lib/client-request-id";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardAction {
  type: string;
  content?: string;
  label?: string;
  description?: string;
  color?: string;
}

interface LessonStep {
  id: string;
  title: string;
  voiceText: string;
  boardActions: BoardAction[];
}

interface LessonPlan {
  title: string;
  topic: string;
  subject?: string;
  gradeLevel?: string;
  intro: { voiceText: string; boardActions: BoardAction[] };
  steps: LessonStep[];
  summary: { voiceText: string; boardActions: BoardAction[] };
  keyPoints?: string[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface WhiteboardSavePayload {
  topic: string;
  plan: LessonPlan;
  subject: string;
  gradeLevel: string;
  depth: "brief" | "standard" | "detailed";
  language: string;
  clientRequestId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECTS_AR = ["الرياضيات", "العلوم", "اللغة العربية", "اللغة الإنجليزية", "الدراسات الاجتماعية", "التربية الإسلامية", "الحاسب الآلي", "الفيزياء", "الكيمياء", "الأحياء", "أخرى"];
const SUBJECTS_EN = ["Mathematics", "Science", "Arabic Language", "English Language", "Social Studies", "Islamic Education", "Computer Science", "Physics", "Chemistry", "Biology", "Other"];
const GRADES_AR = ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر"];
const GRADES_EN = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const ACTION_COLOR: Record<string, string> = {
  writeText: "#2f684d", writeMath: "#60a5fa", bullet: "#c4b5fd",
  highlight: "#fbbf24", underline: "#f9a8d4", drawArrow: "#fb923c",
  drawCircle: "#468064", showDiagram: "#a78bfa", clearBoard: "#6b7280",
  erase: "#ef4444", pause: "#fbbf24", bullet2: "#c4b5fd", writeTitle: "#f97316",
  showImage: "#0ea5e9", drawConnector: "#f59e0b", showChart: "#a855f7",
};

function getActionLabel(type: string, isAr: boolean): string {
  const m: Record<string, [string, string]> = {
    writeText: ["نص","Text"], writeMath: ["معادلة","Math"], bullet: ["نقطة","Bullet"],
    highlight: ["تظليل","Highlight"], underline: ["تسطير","Underline"], drawArrow: ["سهم","Arrow"],
    drawCircle: ["دائرة","Circle"], showDiagram: ["مخطط","Diagram"], clearBoard: ["مسح","Clear"],
    erase: ["حذف","Erase"], pause: ["إيقاف مؤقت","Pause"], bullet2: ["نقطة٢","Bullet 2"],
    writeTitle: ["عنوان","Title"], showImage: ["صورة","Image"],
    drawConnector: ["ربط","Connect"], showChart: ["مخطط بياني","Chart"],
  };
  return isAr ? (m[type]?.[0] ?? type) : (m[type]?.[1] ?? type);
}

/** Returns the editable text field for an action */
function getActionText(a: BoardAction): string {
  return a.content ?? a.label ?? a.description ?? "";
}

/** Returns an updated action with the new text in the right field */
function setActionText(a: BoardAction, text: string): BoardAction {
  if (a.content !== undefined) return { ...a, content: text };
  if (a.label !== undefined) return { ...a, label: text };
  if (a.description !== undefined) return { ...a, description: text };
  return { ...a, content: text };
}

// ── KaTeX preview ─────────────────────────────────────────────────────────────

function MathPreview({ src }: { src: string }) {
  if (!src.trim()) return null;
  let html = "";
  try {
    html = katex.renderToString(src, { throwOnError: false, displayMode: true, strict: false });
  } catch { return null; }
  return (
    <div
      className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl px-3 py-2 mt-2 text-blue-600 dark:text-blue-400 overflow-x-auto text-lg"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Single action row ─────────────────────────────────────────────────────────

function ActionRow({
  action, onUpdate, onDelete, onDragStart, onDragOver, onDrop, isDragOver,
}: {
  action: BoardAction;
  onUpdate: (a: BoardAction) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragOver: boolean;
}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const color = ACTION_COLOR[action.type] ?? "#9ca3af";
  const text = getActionText(action);
  const isNonText = ["clearBoard", "erase", "pause"].includes(action.type);

  function startEdit() {
    if (isNonText) return;
    setDraft(text);
    setEditing(true);
  }

  function save() {
    onUpdate(setActionText(action, draft));
    setEditing(false);
  }

  function cancel() { setEditing(false); }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver(e); }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      className={`group relative rounded-2xl p-2 mb-2 border transition-all ${
        isDragOver 
          ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/20" 
          : "border-emerald-50 dark:border-emerald-900/30 bg-[#f4f7f5] dark:bg-[#0B100E]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="cursor-grab text-slate-300 hover:text-emerald-500 dark:text-slate-600 dark:hover:text-emerald-400 pt-1 shrink-0 transition-colors"
          title={isAr ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        >
          <GripVertical size={16} />
        </div>
        <div 
          className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black mt-1 whitespace-nowrap"
          style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          {getActionLabel(action.type, isAr)}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#15201B] p-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all leading-relaxed"
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                  if (e.key === "Escape") cancel();
                }}
              />
              {action.type === "writeMath" && <MathPreview src={draft} />}
              <div className="flex gap-2 mt-2">
                <button onClick={save} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-1.5 text-xs font-black transition-colors">
                  <Check size={14} /> {isAr ? "حفظ" : "Save"}
                </button>
                <button onClick={cancel} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-1.5 text-xs font-bold transition-colors">
                  <X size={14} /> {isAr ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={isNonText ? undefined : startEdit}
              className={`text-sm font-bold leading-relaxed break-words rounded-xl p-1.5 -ml-1.5 border border-transparent transition-colors ${
                isNonText 
                  ? "text-slate-400 italic cursor-default" 
                  : "text-slate-700 dark:text-slate-200 cursor-text hover:bg-white dark:hover:bg-[#15201B] hover:border-emerald-100 dark:hover:border-emerald-800/50"
              }`}
              title={isNonText ? undefined : (isAr ? "انقر للتعديل" : "Click to edit")}
            >
              {text || <span className="opacity-40">{isAr ? "(فارغ)" : "(empty)"}</span>}
              {!isNonText && <Edit2 size={12} className="inline-block ms-2 opacity-0 group-hover:opacity-40 transition-opacity" />}
            </div>
          )}
        </div>
        <button 
          onClick={onDelete} 
          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg p-1.5 shrink-0 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" 
          title={isAr ? "حذف" : "Delete"}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Draggable action list ─────────────────────────────────────────────────────

function ActionList({ actions, onChange }: { actions: BoardAction[]; onChange: (actions: BoardAction[]) => void }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...actions];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
    setDragIdx(null); setOverIdx(null);
  }

  return (
    <div className="mt-4 pt-4 border-t border-emerald-50 dark:border-emerald-900/30">
      <div className="text-xs font-black text-slate-500 mb-3 flex items-center justify-between">
        <span>{isAr ? "عناصر السبورة" : "Board elements"} <span className="font-bold font-sans text-[10px] text-slate-400 ms-1">— {isAr ? "اسحب للترتيب · انقر للتعديل" : "drag to reorder · click to edit"}</span></span>
      </div>
      {actions.length === 0 && (
        <div className="text-xs font-bold text-slate-400 italic mb-3 px-2">{isAr ? "لا توجد عناصر" : "No elements"}</div>
      )}
      <div className="space-y-1">
        {actions.map((a, i) => (
          <ActionRow
            key={i}
            action={a}
            onUpdate={updated => { const next = [...actions]; next[i] = updated; onChange(next); }}
            onDelete={() => onChange(actions.filter((_, idx) => idx !== i))}
            onDragStart={() => setDragIdx(i)}
            onDragOver={() => setOverIdx(i)}
            onDrop={() => handleDrop(i)}
            isDragOver={overIdx === i && dragIdx !== i}
          />
        ))}
      </div>
      <button
        onClick={() => onChange([...actions, { type: "bullet", content: isAr ? "نقطة جديدة" : "New bullet" }])}
        className="w-full flex items-center justify-center gap-2 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-xl py-2.5 mt-2 text-xs font-black transition-colors"
      >
        <Plus size={14} /> {isAr ? "إضافة نقطة" : "Add bullet"}
      </button>
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step, index, onEditTitle, onEditVoice, onEditActions, onDelete, isIntro, isSummary,
}: {
  step: LessonStep | { voiceText: string; boardActions: BoardAction[] };
  index: number;
  onEditTitle?: (val: string) => void;
  onEditVoice: (val: string) => void;
  onEditActions: (actions: BoardAction[]) => void;
  onDelete?: () => void;
  isIntro?: boolean;
  isSummary?: boolean;
}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [editingVoice, setEditingVoice] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [expanded, setExpanded] = useState(true);

  const titleText = isIntro ? (isAr ? "المقدمة" : "Introduction")
    : isSummary ? (isAr ? "الخلاصة" : "Summary")
    : ("title" in step ? step.title : "");

  return (
    <div className="bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl overflow-hidden shadow-sm transition-all hover:border-emerald-100 dark:hover:border-emerald-800/60">
      {/* Header */}
      <div
        className={`flex items-center gap-3 p-4 sm:p-5 select-none cursor-pointer transition-colors hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 ${expanded ? 'border-b border-emerald-50 dark:border-emerald-900/30' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        {!isIntro && !isSummary && <GripVertical size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />}
        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black ${
          isIntro ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' :
          isSummary ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
          'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
        }`}>
          {isIntro ? (isAr ? "مقدمة" : "Intro") : isSummary ? (isAr ? "خلاصة" : "Summary") : (isAr ? `خطوة ${index}` : `Step ${index}`)}
        </span>

        {!isIntro && !isSummary && onEditTitle ? (
          editingTitle ? (
            <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
              <input
                autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                className="flex-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#0B100E] px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400/20"
                onKeyDown={e => {
                  if (e.key === "Enter") { onEditTitle(titleDraft); setEditingTitle(false); }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button onClick={() => { onEditTitle(titleDraft); setEditingTitle(false); }} className="bg-emerald-600 text-white rounded-lg px-2"><Check size={14} /></button>
              <button onClick={() => setEditingTitle(false)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-2"><X size={14} /></button>
            </div>
          ) : (
            <div
              className="flex-1 text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 group"
              onClick={e => { e.stopPropagation(); setTitleDraft(titleText); setEditingTitle(true); }}
              title={isAr ? "انقر لتعديل العنوان" : "Click to edit title"}
            >
              {titleText}
              <Edit2 size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
          )
        ) : (
          <span className="flex-1 text-sm font-black text-slate-800 dark:text-slate-100">{titleText}</span>
        )}

        <div className="flex items-center gap-3 ms-auto shrink-0">
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg p-1.5 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? '-rotate-90' : 'rotate-180'}`} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="p-4 sm:p-5">
              {/* Voice text */}
              <div>
                <div className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1.5">
                  <Volume2 size={16} className="text-emerald-500" /> {isAr ? "النص الصوتي" : "Voice text"}
                </div>
                {editingVoice ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <textarea
                      autoFocus value={voiceDraft} onChange={e => setVoiceDraft(e.target.value)}
                      className="w-full min-h-[80px] resize-y rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#15201B] p-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all leading-relaxed"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { onEditVoice(voiceDraft); setEditingVoice(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-black transition-colors">{isAr ? "حفظ" : "Save"}</button>
                      <button onClick={() => setEditingVoice(false)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-2 text-xs font-bold transition-colors">{isAr ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm font-bold leading-relaxed text-slate-600 dark:text-slate-300 bg-[#f4f7f5] dark:bg-[#0B100E] border border-slate-100 dark:border-slate-800/60 rounded-xl p-3 cursor-text hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-colors flex items-start gap-2 group"
                    onClick={() => { setVoiceDraft(step.voiceText); setEditingVoice(true); }}
                    title={isAr ? "انقر للتعديل" : "Click to edit"}
                  >
                    <span className="flex-1">{step.voiceText}</span>
                    <Edit2 size={14} className="shrink-0 text-slate-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

              <ActionList actions={step.boardActions} onChange={onEditActions} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SmartBoardNew() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [, navigate] = useLocation();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [depth, setDepth] = useState<"brief" | "standard" | "detailed">("standard");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const savedIdRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [clientRequestId] = useState(createClientRequestId);
  const saveInFlightRef = useRef(false);
  const saveBlockedRef = useRef(false);
  const generationInFlightRef = useRef(false);
  const retryPlanPayloadRef = useRef<WhiteboardSavePayload | null>(null);

  /* Server charges credits for AI generation — refresh the shared balance. */
  const refreshCreditsBalance = useRefreshCreditsBalance();

  async function persistPlan(
    nextPlan: LessonPlan,
    preparingPresentation = false,
    retrying = false,
    exactPayload?: WhiteboardSavePayload,
  ): Promise<number | null> {
    if (saveInFlightRef.current) return null;
    if (saveBlockedRef.current && !retrying) {
      setSaveError(isAr ? "أعد محاولة حفظ الدرس الحالي أولاً" : "Retry saving the current lesson first");
      return null;
    }
    const payload: WhiteboardSavePayload = exactPayload ?? {
      topic: nextPlan.topic,
      plan: nextPlan,
      subject,
      gradeLevel,
      depth,
      language: lang,
      clientRequestId,
    };
    saveInFlightRef.current = true;
    if (preparingPresentation) setSaving(true);
    setSaveStatus("saving");
    setSaveError("");

    try {
      const currentId = savedIdRef.current;
      const response = await fetch(
        currentId
          ? `${API_BASE}/api/whiteboard/lessons/${currentId}`
          : `${API_BASE}/api/whiteboard/lessons`,
        {
          method: currentId ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = responseData.message ?? (isAr ? "تعذّر حفظ الدرس" : "Could not save the lesson");
        saveBlockedRef.current = true;
        retryPlanPayloadRef.current = payload;
        setSaveStatus("error");
        setSaveError(message);
        return null;
      }

      const nextId = Number(responseData.id ?? currentId);
      if (!Number.isFinite(nextId) || nextId <= 0) {
        throw new Error(isAr ? "لم يُرجع الخادم معرّف الحفظ" : "The server did not return a saved id");
      }

      savedIdRef.current = nextId;
      saveBlockedRef.current = false;
      retryPlanPayloadRef.current = null;
      if (retrying) {
        setPlan(payload.plan);
        setTopic(payload.topic);
        setSubject(payload.subject);
        setGradeLevel(payload.gradeLevel);
        setDepth(payload.depth);
      }
      setSaveStatus("saved");
      setSaveError("");
      return nextId;
    } catch (saveFailure) {
      saveBlockedRef.current = true;
      retryPlanPayloadRef.current = payload;
      setSaveStatus("error");
      setSaveError(
        saveFailure instanceof Error && saveFailure.message
          ? saveFailure.message
          : (isAr ? "تعذّر الاتصال أثناء الحفظ" : "Could not connect while saving"),
      );
      return null;
    } finally {
      saveInFlightRef.current = false;
      if (preparingPresentation) setSaving(false);
    }
  }

  async function generate() {
    if (saveBlockedRef.current || saveInFlightRef.current || generationInFlightRef.current) {
      setSaveError(isAr ? "أعد محاولة حفظ الدرس الحالي أولاً" : "Retry saving the current lesson first");
      return;
    }
    if (!topic.trim()) { setError(isAr ? "اكتب موضوع الدرس أولاً" : "Enter a lesson topic first"); return; }
    generationInFlightRef.current = true;
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/generate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), subject, gradeLevel, depth, language: lang }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message ?? (isAr ? "حدث خطأ" : "An error occurred")); return; }
      setPlan(d.plan);
      await persistPlan(d.plan);
    } catch {
      setError(isAr ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      generationInFlightRef.current = false;
      setLoading(false);
      refreshCreditsBalance();
    }
  }

  async function startPresent() {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    const id = await persistPlan(plan, true);
    if (id) navigate(`/teacher/smart-board/present/${id}`);
  }

  const markPlanDirty = () => {
    if (saveBlockedRef.current || saveInFlightRef.current) return;
    setSaveStatus("idle");
    setSaveError("");
  };

  const updateIntroVoice = (v: string) => {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    setPlan({ ...plan, intro: { ...plan.intro, voiceText: v } });
    markPlanDirty();
  };
  const updateIntroActions = (a: BoardAction[]) => {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    setPlan({ ...plan, intro: { ...plan.intro, boardActions: a } });
    markPlanDirty();
  };
  const updateSummaryVoice = (v: string) => {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    setPlan({ ...plan, summary: { ...plan.summary, voiceText: v } });
    markPlanDirty();
  };
  const updateSummaryActions = (a: BoardAction[]) => {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    setPlan({ ...plan, summary: { ...plan.summary, boardActions: a } });
    markPlanDirty();
  };

  function updateStep(idx: number, patch: Partial<LessonStep>) {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], ...patch };
    setPlan({ ...plan, steps });
    markPlanDirty();
  }

  function deleteStep(idx: number) {
    if (!plan || saveBlockedRef.current || saveInFlightRef.current) return;
    setPlan({ ...plan, steps: plan.steps.filter((_, i) => i !== idx) });
    markPlanDirty();
  }

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-32" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            onClick={() => navigate("/teacher/smart-board")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            title={isAr ? "رجوع" : "Back"}
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                {isAr ? "درس جديد" : "New Lesson"}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                {isAr ? "توليد خطة سبورة تفاعلية بالذكاء الاصطناعي" : "Generate an AI-powered interactive board plan"}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
          
          {/* Topic input */}
          <div className="bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 sm:p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{isAr ? "موضوع الدرس" : "Lesson Topic"}</h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">
              {isAr ? "اكتب الموضوع وسيُنشئ الذكاء الاصطناعي خطة درس كاملة لعرضها على السبورة" : "Enter a topic and AI will generate a full lesson plan for the board"}
            </p>

            <div className="space-y-5">
              <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-1 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group">
                <textarea
                  value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder={isAr ? "مثال: جمع الكسور المتشابهة وغير المتشابهة، قانون نيوتن الثالث..." : "e.g. Adding fractions, Newton's third law, photosynthesis..."}
                  rows={2}
                  className="w-full bg-transparent border-none p-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
                  disabled={loading || saveStatus === "error"}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <BookOpen size={14} className="text-emerald-500"/> {isAr ? "المادة" : "Subject"}
                  </label>
                  <select 
                    value={subject} onChange={e => setSubject(e.target.value)} disabled={loading || saveStatus === "error"}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">{isAr ? "اختر المادة" : "Select subject"}</option>
                    {(isAr ? SUBJECTS_AR : SUBJECTS_EN).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <Users size={14} className="text-emerald-500"/> {isAr ? "الصف الدراسي" : "Grade"}
                  </label>
                  <select 
                    value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} disabled={loading || saveStatus === "error"}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">{isAr ? "اختر الصف" : "Select grade"}</option>
                    {(isAr ? GRADES_AR : GRADES_EN).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <Clock size={14} className="text-emerald-500"/> {isAr ? "عمق الشرح" : "Depth"}
                  </label>
                  <select 
                    value={depth} onChange={e => setDepth(e.target.value as any)} disabled={loading || saveStatus === "error"}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="brief">{isAr ? "موجز (~١٠ دقائق)" : "Brief (~10 min)"}</option>
                    <option value="standard">{isAr ? "عادي (~٢٠ دقيقة)" : "Standard (~20 min)"}</option>
                    <option value="detailed">{isAr ? "تفصيلي (~٣٠ دقيقة)" : "Detailed (~30 min)"}</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <X size={16} /> {error}
                </div>
              )}

              <button
                onClick={generate} disabled={loading || saveStatus === "saving" || saveStatus === "error" || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl py-3.5 font-black shadow-md shadow-emerald-600/10 transition-all hover:-translate-y-0.5 mt-2"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> <span>{isAr ? "جارٍ التوليد الذكي…" : "Generating…"}</span></>
                ) : (
                  <><Wand2 size={18} /> <span>{plan ? (isAr ? "أعد توليد الخطة" : "Regenerate plan") : (isAr ? "أنشئ خطة الدرس" : "Generate lesson plan")}</span></>
                )}
              </button>
            </div>
          </div>

          {/* Generated plan */}
          {plan && (
            <div className={`space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
              saveStatus === "saving" || saveStatus === "error" ? "pointer-events-none select-none opacity-70" : ""
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mt-8 mb-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{plan.title}</h2>
                    <p className="text-xs font-bold text-slate-500">{isAr ? "انقر على أي خطوة للتعديل" : "Click any step to edit"}</p>
                  </div>
                </div>
              </div>

              {plan.keyPoints && plan.keyPoints.length > 0 && (
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-3xl p-5">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} /> {isAr ? "النقاط الرئيسية" : "Key Points"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plan.keyPoints.map((kp, i) => (
                      <span key={i} className="bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm">
                        {kp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <StepCard step={plan.intro} index={0} onEditVoice={updateIntroVoice} onEditActions={updateIntroActions} isIntro />
                
                {plan.steps.map((step, i) => (
                  <StepCard
                    key={step.id} step={step} index={i + 1}
                    onEditTitle={v => updateStep(i, { title: v })}
                    onEditVoice={v => updateStep(i, { voiceText: v })}
                    onEditActions={a => updateStep(i, { boardActions: a })}
                    onDelete={() => deleteStep(i)}
                  />
                ))}

                <StepCard step={plan.summary} index={plan.steps.length + 2} onEditVoice={updateSummaryVoice} onEditActions={updateSummaryActions} isSummary />
              </div>
            </div>
          )}
        </main>

        {/* Floating Action Bar */}
        {plan && (
          <div className="fixed bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-[#f4f7f5] via-[#f4f7f5]/90 to-transparent dark:from-[#0B100E] dark:via-[#0B100E]/90 pb-6 pointer-events-none animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="max-w-2xl mx-auto pointer-events-auto space-y-2">
              {saveStatus !== "idle" && (
                <div
                  data-testid="status-smart-board-autosave"
                  className={`flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold backdrop-blur ${
                    saveStatus === "error"
                      ? "border-red-200 bg-red-50/95 text-red-700 dark:border-red-800 dark:bg-red-900/80 dark:text-red-200"
                      : "border-emerald-100 bg-white/95 text-emerald-700 dark:border-emerald-800 dark:bg-[#15201B]/95 dark:text-emerald-300"
                  }`}
                >
                  {saveStatus === "saving" && <Loader2 size={16} className="animate-spin" />}
                  {saveStatus === "saved" && <CheckCircle2 size={16} />}
                  {saveStatus === "error" && <X size={16} />}
                  <span>
                    {saveStatus === "saving" && (isAr ? "جارٍ حفظ الدرس تلقائياً…" : "Saving lesson automatically…")}
                    {saveStatus === "saved" && (isAr ? "تم حفظ الدرس تلقائياً" : "Lesson saved automatically")}
                    {saveStatus === "error" && (saveError || (isAr ? "فشل الحفظ التلقائي" : "Auto-save failed"))}
                  </span>
                  {saveStatus === "error" && (
                    <button
                      type="button"
                      onClick={() => {
                        const payload = retryPlanPayloadRef.current;
                        if (payload) void persistPlan(payload.plan, false, true, payload);
                      }}
                      data-testid="button-retry-smart-board-autosave"
                      className="rounded-lg border border-red-200 bg-white px-2 py-1 hover:bg-red-50 dark:border-red-700 dark:bg-[#15201B] dark:hover:bg-red-900/30"
                    >
                      {isAr ? "إعادة المحاولة" : "Retry"}
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={startPresent} disabled={saving || loading || saveStatus === "saving" || saveStatus === "error"}
                data-testid="button-start-smart-board-presentation"
                className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-1"
              >
                {saving ? (
                  <><Loader2 size={22} className="animate-spin" /> <span>{isAr ? "جارٍ تجهيز العرض…" : "Preparing presentation…"}</span></>
                ) : (
                  <><PlayCircle size={22} /> <span>{isAr ? "ابدأ العرض على السبورة" : "Start board presentation"}</span></>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
