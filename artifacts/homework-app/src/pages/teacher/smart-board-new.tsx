import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, ChevronRight, Loader2, CheckCircle2,
  Edit2, Trash2, GripVertical, Plus, PlayCircle, X, Check,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  writeText: "#4ade80", writeMath: "#60a5fa", bullet: "#c4b5fd",
  highlight: "#fbbf24", underline: "#f9a8d4", drawArrow: "#fb923c",
  drawCircle: "#34d399", showDiagram: "#a78bfa", clearBoard: "#6b7280",
  erase: "#ef4444", pause: "#fbbf24", bullet2: "#c4b5fd", writeTitle: "#f97316",
  showImage: "#06b6d4", drawConnector: "#f59e0b", showChart: "#a855f7",
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
      style={{
        background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)",
        borderRadius: 8, padding: "8px 12px", marginTop: 6,
        color: "#93c5fd", fontSize: 18, overflowX: "auto",
      }}
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
      style={{
        background: isDragOver ? `${color}14` : "var(--background)",
        border: `1px solid ${isDragOver ? color + "60" : "var(--border)"}`,
        borderRadius: 8, padding: "6px 8px", marginBottom: 4,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ cursor: "grab", color: "var(--muted-foreground)", paddingTop: 2, flexShrink: 0 }} title="اسحب لإعادة الترتيب">
          <GripVertical size={14} />
        </span>
        <span style={{
          flexShrink: 0, background: `${color}18`, color, border: `1px solid ${color}40`,
          borderRadius: 5, padding: "1px 6px", fontSize: 10, fontWeight: 700,
          marginTop: 2, whiteSpace: "nowrap",
        }}>
          {ACTION_LABEL[action.type] ?? action.type}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div>
              <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                style={{
                  width: "100%", resize: "vertical", borderRadius: 6,
                  border: `1px solid ${color}60`, padding: "5px 8px",
                  fontSize: 13, fontFamily: "inherit",
                  background: "var(--background)", color: "var(--foreground)",
                  boxSizing: "border-box", outline: "none",
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                  if (e.key === "Escape") cancel();
                }}
              />
              {action.type === "writeMath" && <MathPreview src={draft} />}
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                <button onClick={save} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                  <Check size={11} /> حفظ
                </button>
                <button onClick={cancel} style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                  <X size={11} /> إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={isNonText ? undefined : startEdit}
              style={{
                fontSize: 12, color: isNonText ? "var(--muted-foreground)" : "var(--foreground)",
                lineHeight: 1.5, cursor: isNonText ? "default" : "pointer",
                fontStyle: isNonText ? "italic" : "normal", wordBreak: "break-word",
              }}
              title={isNonText ? undefined : "انقر للتعديل"}
            >
              {text || <span style={{ opacity: 0.4 }}>(فارغ)</span>}
              {!isNonText && <Edit2 size={10} style={{ marginRight: 4, opacity: 0.4, verticalAlign: "middle" }} />}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2, flexShrink: 0, opacity: 0.6, lineHeight: 1 }} title="حذف">
          <Trash2 size={13} />
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
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 5 }}>
        عناصر السبورة
        <span style={{ fontWeight: 400, marginRight: 4 }}>— اسحب لإعادة الترتيب · انقر لتعديل النص</span>
      </div>
      {actions.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic", marginBottom: 6 }}>لا توجد عناصر</div>
      )}
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
      <button
        onClick={() => onChange([...actions, { type: "bullet", content: "نقطة جديدة" }])}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "1px dashed var(--border)", borderRadius: 7,
          padding: "4px 10px", cursor: "pointer", color: "var(--muted-foreground)",
          fontSize: 11, fontWeight: 600, width: "100%", justifyContent: "center", marginTop: 4,
        }}
      >
        <Plus size={11} /> إضافة نقطة
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
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {!isIntro && !isSummary && <GripVertical size={15} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />}
        <span style={{
          display: "inline-block",
          background: isIntro ? "#1e3a4a" : isSummary ? "#2a1a3e" : "#1a3025",
          color: isIntro ? "#7dd3fc" : isSummary ? "#c4b5fd" : "#4ade80",
          borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {isIntro ? "مقدمة" : isSummary ? "خلاصة" : `خطوة ${index}`}
        </span>

        {!isIntro && !isSummary && onEditTitle ? (
          editingTitle ? (
            <div style={{ flex: 1, display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
              <input
                autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                style={{ flex: 1, borderRadius: 6, border: "1px solid #4ade8060", padding: "3px 8px", fontSize: 13, fontFamily: "inherit", background: "var(--background)", color: "var(--foreground)", outline: "none" }}
                onKeyDown={e => {
                  if (e.key === "Enter") { onEditTitle(titleDraft); setEditingTitle(false); }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button onClick={() => { onEditTitle(titleDraft); setEditingTitle(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}><Check size={11} /></button>
              <button onClick={() => setEditingTitle(false)} style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "none", borderRadius: 5, padding: "3px 6px", cursor: "pointer", fontSize: 11 }}><X size={11} /></button>
            </div>
          ) : (
            <div
              style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 4 }}
              onClick={e => { e.stopPropagation(); setTitleDraft(titleText); setEditingTitle(true); }}
              title="انقر لتعديل العنوان"
            >
              {titleText}
              <Edit2 size={11} style={{ opacity: 0.4 }} />
            </div>
          )
        ) : (
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{titleText}</span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: "auto" }}>
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 3, lineHeight: 1 }}>
              <Trash2 size={14} />
            </button>
          )}
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▶</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px" }}>
          {/* Voice text */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 4 }}>🔊 النص الصوتي</div>
            {editingVoice ? (
              <div>
                <textarea
                  autoFocus value={voiceDraft} onChange={e => setVoiceDraft(e.target.value)}
                  style={{ width: "100%", minHeight: 64, resize: "vertical", borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "var(--background)", color: "var(--foreground)", boxSizing: "border-box", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  <button onClick={() => { onEditVoice(voiceDraft); setEditingVoice(false); }} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>حفظ</button>
                  <button onClick={() => setEditingVoice(false)} style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>إلغاء</button>
                </div>
              </div>
            ) : (
              <div
                style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, background: "var(--muted)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 6 }}
                onClick={() => { setVoiceDraft(step.voiceText); setEditingVoice(true); }}
                title="انقر للتعديل"
              >
                <span style={{ flex: 1 }}>{step.voiceText}</span>
                <Edit2 size={11} style={{ flexShrink: 0, marginTop: 3, opacity: 0.4 }} />
              </div>
            )}
          </div>

          <ActionList actions={step.boardActions} onChange={onEditActions} />
        </div>
      )}
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
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }} dir="rtl">

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, color: "var(--muted-foreground)", fontSize: 13 }}>
          <button onClick={() => navigate("/teacher/smart-board")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
            السبورة الذكية
          </button>
          <ChevronRight size={14} />
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>درس جديد</span>
        </div>

        {/* Topic input */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 6 }}>موضوع الدرس</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginBottom: 16 }}>
            اكتب الموضوع وسيُنشئ الذكاء الاصطناعي خطة درس كاملة لعرضها على السبورة
          </p>

          <textarea
            value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="مثال: جمع الكسور المتشابهة وغير المتشابهة، قانون نيوتن الثالث، التمييز في اللغة العربية…"
            rows={3}
            style={{
              width: "100%", borderRadius: 10, border: "1.5px solid var(--border)",
              padding: "12px 14px", fontSize: 14, resize: "none",
              background: "var(--background)", color: "var(--foreground)",
              fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box",
              outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "#16a34a"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>المادة</label>
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px", fontSize: 13, background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}>
                <option value="">اختر المادة</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>الصف الدراسي</label>
              <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px", fontSize: 13, background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}>
                <option value="">اختر الصف</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>عمق الشرح</label>
              <select value={depth} onChange={e => setDepth(e.target.value as any)} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: "8px 10px", fontSize: 13, background: "var(--background)", color: "var(--foreground)", cursor: "pointer" }}>
                <option value="brief">موجز (~١٠ دقائق)</option>
                <option value="standard">عادي (~٢٠ دقيقة)</option>
                <option value="detailed">تفصيلي (~٣٠ دقيقة)</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={generate} disabled={loading || !topic.trim()}
            style={{
              marginTop: 16, width: "100%",
              background: loading ? "#6b7280" : "linear-gradient(135deg,#166534,#16a34a)",
              color: "white", border: "none", borderRadius: 10,
              padding: "13px", cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800, fontSize: 15, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? (
              <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> جارٍ إنشاء خطة الدرس…</>
            ) : (
              <><Sparkles size={18} /> {plan ? "أعد توليد الخطة" : "أنشئ خطة الدرس"}</>
            )}
          </button>
        </div>

        {/* Generated plan */}
        {plan && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckCircle2 size={18} color="#4ade80" />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{plan.title}</h2>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>— انقر على أي عنصر لتعديله</span>
            </div>

            {plan.keyPoints && plan.keyPoints.length > 0 && (
              <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>النقاط الرئيسية للدرس</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {plan.keyPoints.map((kp, i) => (
                    <span key={i} style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{kp}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <StepCard step={plan.intro} index={0} onEditVoice={updateIntroVoice} onEditActions={updateIntroActions} isIntro />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              {plan.steps.map((step, i) => (
                <StepCard
                  key={step.id} step={step} index={i + 1}
                  onEditTitle={v => updateStep(i, { title: v })}
                  onEditVoice={v => updateStep(i, { voiceText: v })}
                  onEditActions={a => updateStep(i, { boardActions: a })}
                  onDelete={() => deleteStep(i)}
                />
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <StepCard step={plan.summary} index={plan.steps.length + 2} onEditVoice={updateSummaryVoice} onEditActions={updateSummaryActions} isSummary />
            </div>

            <button
              onClick={startPresent} disabled={saving}
              style={{
                width: "100%",
                background: saving ? "#6b7280" : "linear-gradient(135deg,#1a4731,#16a34a)",
                color: "white", border: "none", borderRadius: 12,
                padding: "16px", cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 800, fontSize: 17, fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                boxShadow: "0 4px 20px rgba(22,163,74,0.35)",
              }}
            >
              {saving ? (
                <><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> جارٍ الحفظ…</>
              ) : (
                <><PlayCircle size={20} /> ابدأ العرض على السبورة</>
              )}
            </button>
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Layout>
  );
}
