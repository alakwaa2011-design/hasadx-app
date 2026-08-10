import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  ChevronRight, Loader2, Save, PlayCircle,
  Trash2, Plus, GripVertical, AlertCircle, Edit2, X, Check,
  ArrowRight, ArrowLeft, Volume2, Sparkles
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import katex from "katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface BoardAction {
  type: string;
  content?: string;
  label?: string;
  description?: string;
  color?: string;
  imageQuery?: string;
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

const CHALK_COLORS = [
  { value:"white",  label:"أبيض",   dot:"#f2ede0" },
  { value:"yellow", label:"أصفر",   dot:"#f5d76e" },
  { value:"green",  label:"أخضر",   dot:"#a8e6b0" },
  { value:"pink",   label:"وردي",   dot:"#f4a0a8" },
  { value:"blue",   label:"أزرق",   dot:"#9fc8f5" },
  { value:"orange", label:"برتقالي",dot:"#f5b87a" },
  { value:"purple", label:"بنفسجي", dot:"#c4a8f0" },
];

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

function getActionText(a: BoardAction): string {
  return a.content ?? a.label ?? a.description ?? "";
}

function setActionText(a: BoardAction, text: string): BoardAction {
  if (a.content !== undefined) return { ...a, content: text };
  if (a.label !== undefined) return { ...a, label: text };
  if (a.description !== undefined) return { ...a, description: text };
  return { ...a, content: text };
}

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
  const isText = ["bullet", "writeText", "highlight", "underline", "writeMath"].includes(action.type);

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

          {isText && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CHALK_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => onUpdate({ ...action, color: c.value })}
                  title={c.label}
                  className="w-5 h-5 rounded-full border-none cursor-pointer transition-all"
                  style={{
                    backgroundColor: c.dot,
                    outline: action.color === c.value ? `2px solid ${c.dot}` : 'none',
                    outlineOffset: '2px',
                    opacity: action.color === c.value ? 1 : 0.55
                  }}
                />
              ))}
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
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => onChange([...actions, { type: "bullet", content: "", color: "white" }])}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-xl py-2.5 text-xs font-black transition-colors"
        >
          <Plus size={14} /> إضافة نقطة
        </button>
        <button
          onClick={() => onChange([...actions, { type: "writeText", content: "", color: "white" }])}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-xl py-2.5 text-xs font-black transition-colors"
        >
          <Plus size={14} /> إضافة نص
        </button>
        <button
          onClick={() => onChange([...actions, { type: "highlight", content: "", color: "yellow" }])}
          className="flex-1 flex items-center justify-center gap-2 bg-amber-50/50 hover:bg-amber-50 dark:bg-amber-900/10 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-dashed border-amber-200 dark:border-amber-800 rounded-xl py-2.5 text-xs font-black transition-colors"
        >
          <Plus size={14} /> إضافة تظليل
        </button>
      </div>
    </div>
  );
}

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
      <div
        className={`flex items-center gap-3 p-4 sm:p-5 select-none cursor-pointer transition-colors hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 ${expanded ? 'border-b border-emerald-50 dark:border-emerald-900/30' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        {!isIntro && !isSummary && <GripVertical size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />}
        <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black ${
          isIntro ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
          isSummary ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
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

export default function SmartBoardEdit() {
  const params = useParams<{ id: string }>();
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const lessonId = params?.id ? parseInt(params.id) : NaN;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isNaN(lessonId)) { setLoadError("معرّف غير صالح"); setLoading(false); return; }
    fetch(`${API_BASE}/api/whiteboard/lessons/${lessonId}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.lesson?.plan) { setLoadError("الدرس غير موجود"); return; }
        const p: LessonPlan = typeof d.lesson.plan === "string"
          ? JSON.parse(d.lesson.plan) : d.lesson.plan;
        setPlan(p);
      })
      .catch(() => setLoadError("تعذّر تحميل الدرس"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  function updateStepVoice(idx: number, v: string) {
    if (!plan) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], voiceText: v };
    setPlan({ ...plan, steps });
  }
  function updateStepTitle(idx: number, t: string) {
    if (!plan) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], title: t };
    setPlan({ ...plan, steps });
  }
  function updateStepActions(idx: number, actions: BoardAction[]) {
    if (!plan) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], boardActions: actions };
    setPlan({ ...plan, steps });
  }
  function deleteStep(idx: number) {
    if (!plan) return;
    if (!confirm("حذف هذه الخطوة؟")) return;
    setPlan({ ...plan, steps: plan.steps.filter((_, i) => i !== idx) });
  }
  function addStep() {
    if (!plan) return;
    const newStep: LessonStep = {
      id: `step-${Date.now()}`,
      title: "خطوة جديدة",
      voiceText: "",
      boardActions: [{ type: "bullet", content: "", color: "white" }],
    };
    setPlan({ ...plan, steps: [...plan.steps, newStep] });
  }

  const updateIntroVoice = (v: string) => plan && setPlan({ ...plan, intro: { ...plan.intro, voiceText: v } });
  const updateIntroActions = (a: BoardAction[]) => plan && setPlan({ ...plan, intro: { ...plan.intro, boardActions: a } });
  const updateSummaryVoice = (v: string) => plan && setPlan({ ...plan, summary: { ...plan.summary, voiceText: v } });
  const updateSummaryActions = (a: BoardAction[]) => plan && setPlan({ ...plan, summary: { ...plan.summary, boardActions: a } });

  async function saveChanges(andPresent = false) {
    if (!plan) return;
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/lessons/${lessonId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: plan.topic, plan }),
      });
      if (!r.ok) { const d = await r.json(); alert(d.message ?? "خطأ في الحفظ"); return; }
      if (andPresent) {
        navigate(`/teacher/smart-board/present/${lessonId}`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      alert("تعذّر حفظ التغييرات");
    } finally {
      setSaving(false);
    }
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
              <Edit2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                تعديل خطة الدرس
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                تعديل محتوى السبورة والنص الصوتي
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-emerald-600/50">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="font-bold text-sm">جارٍ تحميل الدرس…</p>
            </div>
          ) : loadError || !plan ? (
            <div className="flex flex-col items-center justify-center py-32 text-red-500/50 gap-4">
              <AlertCircle className="w-12 h-12" />
              <p className="font-bold text-sm text-red-600 dark:text-red-400">{loadError || "الدرس غير موجود"}</p>
              <button onClick={() => navigate("/teacher/smart-board")} className="px-6 py-2 bg-white dark:bg-[#15201B] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors mt-4">
                العودة
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="mb-6">
                <label className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 ms-1 mb-2">
                  عنوان الدرس
                </label>
                <input
                  value={plan.title}
                  onChange={e => setPlan({ ...plan, title: e.target.value })}
                  className="w-full bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800/50 rounded-2xl px-4 py-3 text-lg font-black text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 transition-all shadow-sm"
                  placeholder="عنوان الدرس"
                />
              </div>

              {plan.keyPoints && plan.keyPoints.length > 0 && (
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-3xl p-5 mb-6">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1.5">
                    <Sparkles size={14} /> النقاط الرئيسية
                  </div>
                  <div className="space-y-2">
                    {plan.keyPoints.map((kp, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={kp}
                          onChange={e => {
                            const kps = [...(plan.keyPoints ?? [])];
                            kps[i] = e.target.value;
                            setPlan({ ...plan, keyPoints: kps });
                          }}
                          className="flex-1 bg-white dark:bg-[#15201B] border border-emerald-100 dark:border-emerald-800/50 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition-all"
                          dir="rtl"
                        />
                        <button onClick={() => setPlan({ ...plan, keyPoints: plan.keyPoints!.filter((_, j) => j !== i) })}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg p-2 transition-colors shrink-0">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <StepCard
                isIntro
                step={plan.intro}
                index={0}
                onEditVoice={updateIntroVoice}
                onEditActions={updateIntroActions}
              />

              {plan.steps.map((step, i) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i + 1}
                  onEditTitle={t => updateStepTitle(i, t)}
                  onEditVoice={v => updateStepVoice(i, v)}
                  onEditActions={a => updateStepActions(i, a)}
                  onDelete={() => deleteStep(i)}
                />
              ))}

              <button
                onClick={addStep}
                className="w-full flex items-center justify-center gap-2 bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-200 dark:border-emerald-800 rounded-2xl py-4 font-black transition-colors"
              >
                <Plus size={18}/> إضافة خطوة جديدة
              </button>

              <StepCard
                isSummary
                step={plan.summary}
                index={0}
                onEditVoice={updateSummaryVoice}
                onEditActions={updateSummaryActions}
              />

            </div>
          )}
        </main>

        {/* Bottom bar */}
        {plan && !loading && !loadError && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0B100E]/90 backdrop-blur-xl border-t border-emerald-100/50 dark:border-emerald-900/30 p-4 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              <button
                onClick={() => saveChanges(false)}
                disabled={saving}
                className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black transition-all flex-1 sm:flex-none ${
                  saved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : <Save size={18} />}
                {saved ? 'تم الحفظ' : 'حفظ التغييرات'}
              </button>
              <button
                onClick={() => saveChanges(true)}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 font-black shadow-md shadow-emerald-600/20 transition-all hover:-translate-y-0.5"
              >
                <PlayCircle size={18} /> حفظ وعرض
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
