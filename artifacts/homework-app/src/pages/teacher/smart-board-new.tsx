import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, ChevronRight, Loader2, CheckCircle2,
  Edit2, Trash2, GripVertical, Plus, PlayCircle, X, Check,
  ArrowRight, ArrowLeft, BookOpen, Clock, Users, Wand2, Volume2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
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

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECTS = ["الرياضيات", "العلوم", "اللغة العربية", "اللغة الإنجليزية", "الدراسات الاجتماعية", "التربية الإسلامية", "الحاسب الآلي", "الفيزياء", "الكيمياء", "الأحياء", "أخرى"];
const GRADES = ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر"];

const ACTION_COLOR: Record<string, string> = {
  writeText: "#2f684d", writeMath: "#60a5fa", bullet: "#c4b5fd",
  highlight: "#fbbf24", underline: "#f9a8d4", drawArrow: "#fb923c",
  drawCircle: "#468064", showDiagram: "#a78bfa", clearBoard: "#6b7280",
  erase: "#ef4444", pause: "#fbbf24", bullet2: "#c4b5fd", writeTitle: "#f97316",
  showImage: "#0ea5e9", drawConnector: "#f59e0b", showChart: "#a855f7",
};

const ACTION_LABEL: Record<string, string> = {
  writeText: "نص", writeMath: "معادلة", bullet: "نقطة",
  highlight: "تظليل", underline: "تسطير", drawArrow: "سهم",
  drawCircle: "دائرة", showDiagram: "مخطط", clearBoard: "مسح",
  erase: "حذف", pause: "إيقاف مؤقت", bullet2: "نقطة٢", writeTitle: "عنوان",
  showImage: "صورة", drawConnector: "ربط", showChart: "مخطط بياني",
};

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
          title="اسحب لإعادة الترتيب"
        >
          <GripVertical size={16} />
        </div>
        <div 
          className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black mt-1 whitespace-nowrap"
          style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          {ACTION_LABEL[action.type] ?? action.type}
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
                  <Check size={14} /> حفظ
                </button>
                <button onClick={cancel} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-1.5 text-xs font-bold transition-colors">
                  <X size={14} /> إلغاء
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
              title={isNonText ? undefined : "انقر للتعديل"}
            >
              {text || <span className="opacity-40">(فارغ)</span>}
              {!isNonText && <Edit2 size={12} className="inline-block ms-2 opacity-0 group-hover:opacity-40 transition-opacity" />}
            </div>
          )}
        </div>
        <button 
          onClick={onDelete} 
          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg p-1.5 shrink-0 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" 
          title="حذف"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Draggable action list ─────────────────────────────────────────────────────

function ActionList({ actions, onChange }: { actions: BoardAction[]; onChange: (actions: BoardAction[]) => void }) {
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
        <span>عناصر السبورة <span className="font-bold font-sans text-[10px] text-slate-400 ms-1">— اسحب للترتيب · انقر للتعديل</span></span>
      </div>
      {actions.length === 0 && (
        <div className="text-xs font-bold text-slate-400 italic mb-3 px-2">لا توجد عناصر</div>
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
        onClick={() => onChange([...actions, { type: "bullet", content: "نقطة جديدة" }])}
        className="w-full flex items-center justify-center gap-2 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-xl py-2.5 mt-2 text-xs font-black transition-colors"
      >
        <Plus size={14} /> إضافة نقطة
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
  const [editingVoice, setEditingVoice] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [expanded, setExpanded] = useState(true);

  const titleText = isIntro ? "المقدمة" : isSummary ? "الخلاصة"
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
          {isIntro ? "مقدمة" : isSummary ? "خلاصة" : `خطوة ${index}`}
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
              title="انقر لتعديل العنوان"
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
                  <Volume2 size={16} className="text-emerald-500" /> النص الصوتي
                </div>
                {editingVoice ? (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <textarea
                      autoFocus value={voiceDraft} onChange={e => setVoiceDraft(e.target.value)}
                      className="w-full min-h-[80px] resize-y rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#15201B] p-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all leading-relaxed"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { onEditVoice(voiceDraft); setEditingVoice(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-xs font-black transition-colors">حفظ</button>
                      <button onClick={() => setEditingVoice(false)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-4 py-2 text-xs font-bold transition-colors">إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm font-bold leading-relaxed text-slate-600 dark:text-slate-300 bg-[#f4f7f5] dark:bg-[#0B100E] border border-slate-100 dark:border-slate-800/60 rounded-xl p-3 cursor-text hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-colors flex items-start gap-2 group"
                    onClick={() => { setVoiceDraft(step.voiceText); setEditingVoice(true); }}
                    title="انقر للتعديل"
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
  const [, navigate] = useLocation();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [depth, setDepth] = useState<"brief" | "standard" | "detailed">("standard");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (!topic.trim()) { setError("اكتب موضوع الدرس أولاً"); return; }
    setError(""); setLoading(true); setPlan(null);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/generate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), subject, gradeLevel, depth, language: "ar" }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message ?? "حدث خطأ"); return; }
      setPlan(d.plan);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function startPresent() {
    if (!plan) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/lessons`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: plan.topic, plan, subject, gradeLevel, depth, language: "ar" }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.message ?? "خطأ في الحفظ"); return; }
      navigate(`/teacher/smart-board/present/${d.id}`);
    } catch {
      alert("تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const updateIntroVoice     = (v: string) => plan && setPlan({ ...plan, intro: { ...plan.intro, voiceText: v } });
  const updateIntroActions   = (a: BoardAction[]) => plan && setPlan({ ...plan, intro: { ...plan.intro, boardActions: a } });
  const updateSummaryVoice   = (v: string) => plan && setPlan({ ...plan, summary: { ...plan.summary, voiceText: v } });
  const updateSummaryActions = (a: BoardAction[]) => plan && setPlan({ ...plan, summary: { ...plan.summary, boardActions: a } });

  function updateStep(idx: number, patch: Partial<LessonStep>) {
    if (!plan) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], ...patch };
    setPlan({ ...plan, steps });
  }

  function deleteStep(idx: number) {
    if (!plan) return;
    setPlan({ ...plan, steps: plan.steps.filter((_, i) => i !== idx) });
  }

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-32" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            onClick={() => navigate("/teacher/smart-board")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            title="رجوع"
          >
            {lang === "ar" ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                درس جديد
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                توليد خطة سبورة تفاعلية بالذكاء الاصطناعي
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
          
          {/* Topic input */}
          <div className="bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 sm:p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">موضوع الدرس</h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">
              اكتب الموضوع وسيُنشئ الذكاء الاصطناعي خطة درس كاملة لعرضها على السبورة
            </p>

            <div className="space-y-5">
              <div className="bg-[#f4f7f5] dark:bg-[#0B100E] rounded-2xl p-1 border border-emerald-50 dark:border-emerald-900/30 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-400/10 transition-all group">
                <textarea
                  value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="مثال: جمع الكسور المتشابهة وغير المتشابهة، قانون نيوتن الثالث..."
                  rows={2}
                  className="w-full bg-transparent border-none p-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <BookOpen size={14} className="text-emerald-500"/> المادة
                  </label>
                  <select 
                    value={subject} onChange={e => setSubject(e.target.value)} disabled={loading}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">اختر المادة</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <Users size={14} className="text-emerald-500"/> الصف الدراسي
                  </label>
                  <select 
                    value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} disabled={loading}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">اختر الصف</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1">
                    <Clock size={14} className="text-emerald-500"/> عمق الشرح
                  </label>
                  <select 
                    value={depth} onChange={e => setDepth(e.target.value as any)} disabled={loading}
                    className="w-full bg-[#f4f7f5] dark:bg-[#0B100E] border border-emerald-50 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all cursor-pointer appearance-none"
                  >
                    <option value="brief">موجز (~١٠ دقائق)</option>
                    <option value="standard">عادي (~٢٠ دقيقة)</option>
                    <option value="detailed">تفصيلي (~٣٠ دقيقة)</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <X size={16} /> {error}
                </div>
              )}

              <button
                onClick={generate} disabled={loading || !topic.trim()}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl py-3.5 font-black shadow-md shadow-emerald-600/10 transition-all hover:-translate-y-0.5 mt-2"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> <span>جارٍ التوليد الذكي…</span></>
                ) : (
                  <><Wand2 size={18} /> <span>{plan ? "أعد توليد الخطة" : "أنشئ خطة الدرس"}</span></>
                )}
              </button>
            </div>
          </div>

          {/* Generated plan */}
          {plan && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mt-8 mb-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{plan.title}</h2>
                    <p className="text-xs font-bold text-slate-500">انقر على أي خطوة للتعديل</p>
                  </div>
                </div>
              </div>

              {plan.keyPoints && plan.keyPoints.length > 0 && (
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-3xl p-5">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} /> النقاط الرئيسية
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
            <div className="max-w-2xl mx-auto pointer-events-auto">
              <button
                onClick={startPresent} disabled={saving}
                className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-1"
              >
                {saving ? (
                  <><Loader2 size={22} className="animate-spin" /> <span>جارٍ تجهيز العرض…</span></>
                ) : (
                  <><PlayCircle size={22} /> <span>ابدأ العرض على السبورة</span></>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
