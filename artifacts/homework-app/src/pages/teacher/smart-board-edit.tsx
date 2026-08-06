/**
 * Smart Whiteboard — Edit Saved Lesson
 * Loads an existing lesson plan and lets the teacher edit all content:
 *   - step titles · voiceText · board action text · colors · add/delete actions
 */
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  ChevronRight, Loader2, Save, PlayCircle,
  Trash2, Plus, GripVertical, AlertCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  intro:   { voiceText: string; boardActions: BoardAction[] };
  steps:   LessonStep[];
  summary: { voiceText: string; boardActions: BoardAction[] };
  keyPoints?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEXT_TYPES = ["bullet", "writeText", "highlight", "underline", "writeMath"];
const VISUAL_TYPES = ["drawArrow", "drawCircle", "showDiagram", "showImage", "clearBoard", "pause", "erase"];

const TYPE_LABELS: Record<string, string> = {
  bullet:"نقطة", writeText:"نص", highlight:"مُميَّز",
  underline:"مُسطَّر", writeMath:"معادلة",
  drawArrow:"سهم", drawCircle:"دائرة", showDiagram:"مخطط",
  showImage:"صورة", clearBoard:"مسح", pause:"توقف", erase:"حذف",
};
const TYPE_COLORS: Record<string, string> = {
  bullet:"#c4b5fd", writeText:"#4ade80", highlight:"#fbbf24",
  underline:"#f9a8d4", writeMath:"#60a5fa",
  drawArrow:"#fb923c", drawCircle:"#34d399", showDiagram:"#a78bfa",
  showImage:"#38bdf8", clearBoard:"#6b7280", pause:"#fbbf24", erase:"#ef4444",
};
const CHALK_COLORS = [
  { value:"white",  label:"أبيض",   dot:"#f2ede0" },
  { value:"yellow", label:"أصفر",   dot:"#f5d76e" },
  { value:"green",  label:"أخضر",   dot:"#a8e6b0" },
  { value:"pink",   label:"وردي",   dot:"#f4a0a8" },
  { value:"blue",   label:"أزرق",   dot:"#9fc8f5" },
  { value:"orange", label:"برتقالي",dot:"#f5b87a" },
  { value:"purple", label:"بنفسجي", dot:"#c4a8f0" },
];

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border)",
  borderRadius: 8, padding: "9px 12px", fontSize: 13,
  background: "var(--background)", color: "var(--foreground)",
  fontFamily: "inherit", lineHeight: 1.65, resize: "none",
  outline: "none", boxSizing: "border-box",
};

// ─── Action editor row ────────────────────────────────────────────────────────

function ActionRow({
  action, onChange, onDelete,
}: {
  action: BoardAction;
  onChange: (a: BoardAction) => void;
  onDelete: () => void;
}) {
  const isText   = TEXT_TYPES.includes(action.type);
  const isVisual = VISUAL_TYPES.includes(action.type);
  const tc = TYPE_COLORS[action.type] ?? "#9ca3af";
  const tl = TYPE_LABELS[action.type]  ?? action.type;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "8px 10px", background: "var(--background)",
      border: "1px solid var(--border)", borderRadius: 8,
      marginBottom: 6,
    }}>
      {/* Type badge */}
      <span style={{
        flexShrink: 0, background: `${tc}18`, color: tc,
        border: `1px solid ${tc}40`, borderRadius: 6,
        padding: "2px 7px", fontSize: 11, fontWeight: 700, marginTop: 1,
        whiteSpace: "nowrap",
      }}>{tl}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isText ? (
          action.type === "writeMath" ? (
            // Math: monospace input
            <input
              value={action.content ?? ""}
              onChange={e => onChange({ ...action, content: e.target.value })}
              style={{ ...inputStyle, fontFamily: "'Courier New',monospace", fontSize: 12, padding: "6px 10px" }}
              placeholder="مثال: \frac{1}{2} + \frac{1}{3}"
              dir="ltr"
            />
          ) : (
            <textarea
              value={action.content ?? ""}
              onChange={e => onChange({ ...action, content: e.target.value })}
              rows={2}
              style={inputStyle}
              dir="rtl"
            />
          )
        ) : isVisual ? (
          <span style={{ fontSize: 12, color: "var(--muted-foreground)", display: "block", paddingTop: 3 }}>
            {action.imageQuery
              ? `🔍 ${action.imageQuery}`
              : action.description ?? action.label ?? "(عنصر مرئي لا يُعدَّل)"}
          </span>
        ) : null}

        {/* Color picker for text actions */}
        {isText && (
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            {CHALK_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => onChange({ ...action, color: c.value })}
                title={c.label}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: c.dot, border: "none", cursor: "pointer", padding: 0,
                  outline: action.color === c.value ? `2px solid ${c.dot}` : "none",
                  outlineOffset: 2, opacity: action.color === c.value ? 1 : 0.55,
                  transition: "opacity .15s",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{
          flexShrink: 0, background: "none", border: "none",
          color: "var(--muted-foreground)", cursor: "pointer",
          padding: "4px 4px", borderRadius: 5,
          transition: "color .15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
      >
        <Trash2 size={13}/>
      </button>
    </div>
  );
}

// ─── Phase editor card ────────────────────────────────────────────────────────

function PhaseCard({
  label, color, voiceText, boardActions,
  onVoiceChange, onActionsChange, onTitleChange, title,
}: {
  label: string; color: string;
  voiceText: string; boardActions: BoardAction[];
  onVoiceChange: (v: string) => void;
  onActionsChange: (a: BoardAction[]) => void;
  onTitleChange?: (t: string) => void;
  title?: string;
}) {
  function updateAction(idx: number, a: BoardAction) {
    const next = [...boardActions];
    next[idx] = a;
    onActionsChange(next);
  }
  function deleteAction(idx: number) {
    onActionsChange(boardActions.filter((_, i) => i !== idx));
  }
  function addBullet() {
    onActionsChange([...boardActions, { type: "bullet", content: "", color: "white" }]);
  }
  function addHighlight() {
    onActionsChange([...boardActions, { type: "highlight", content: "", color: "yellow" }]);
  }
  function addText() {
    onActionsChange([...boardActions, { type: "writeText", content: "", color: "white" }]);
  }

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "16px 18px", marginBottom: 12,
    }}>
      {/* Phase header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {onTitleChange && <GripVertical size={16} color="var(--muted-foreground)" style={{ flexShrink: 0 }}/>}
        <span style={{
          background: `${color}20`, color,
          borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{label}</span>

        {onTitleChange ? (
          <input
            value={title ?? ""}
            onChange={e => onTitleChange(e.target.value)}
            style={{ ...inputStyle, fontSize: 14, fontWeight: 700, padding: "5px 10px" }}
            placeholder="عنوان الخطوة"
          />
        ) : (
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{title}</span>
        )}
      </div>

      {/* voiceText */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 5, letterSpacing: .5 }}>
          🔊 النص الصوتي (يُقرأ بصوت عالٍ)
        </label>
        <textarea
          value={voiceText}
          onChange={e => onVoiceChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, fontSize: 14, lineHeight: 1.75 }}
          dir="rtl"
          placeholder="اكتب ما سيقوله المعلم بصوت عالٍ…"
        />
      </div>

      {/* Board actions */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 8, letterSpacing: .5 }}>
          📋 محتوى السبورة
        </label>
        {boardActions.map((a, i) => (
          <ActionRow
            key={i}
            action={a}
            onChange={updated => updateAction(i, updated)}
            onDelete={() => deleteAction(i)}
          />
        ))}

        {/* Add buttons */}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { label: "+ نقطة",   fn: addBullet,    c: "#c4b5fd" },
            { label: "+ نص",     fn: addText,      c: "#4ade80" },
            { label: "+ مُميَّز", fn: addHighlight, c: "#fbbf24" },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.fn}
              style={{
                background: `${btn.c}10`, border: `1px dashed ${btn.c}60`,
                color: btn.c, borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SmartBoardEdit() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const lessonId = params?.id ? parseInt(params.id) : NaN;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing lesson
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

  // ── Helpers ──

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

  // ── Save ──

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

  // ── Loading / error ──

  if (loading) return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 14 }} dir="rtl">
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#16a34a" }}/>
        <span style={{ color: "var(--muted-foreground)" }}>جارٍ تحميل الدرس…</span>
      </div>
    </Layout>
  );
  if (loadError || !plan) return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 14, color: "var(--destructive)" }} dir="rtl">
        <AlertCircle size={32}/>
        <p>{loadError || "الدرس غير موجود"}</p>
        <button onClick={() => navigate("/teacher/smart-board")}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" }}>
          العودة
        </button>
      </div>
    </Layout>
  );

  // ── Render ──

  return (
    <Layout>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px" }} dir="rtl">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
            <button onClick={() => navigate("/teacher/smart-board")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
              السبورة الذكية
            </button>
            <ChevronRight size={14}/>
            <span style={{ color: "var(--foreground)", fontWeight: 600 }}>تعديل: {plan.title}</span>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => saveChanges(false)}
              disabled={saving}
              style={{
                background: saved ? "rgba(74,222,128,.15)" : "var(--card)",
                border: `1px solid ${saved ? "rgba(74,222,128,.5)" : "var(--border)"}`,
                color: saved ? "#4ade80" : "var(--foreground)",
                borderRadius: 10, padding: "9px 18px", cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 7, transition: "all .2s",
              }}
            >
              {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> : <Save size={14}/>}
              {saved ? "تم الحفظ ✓" : "حفظ التغييرات"}
            </button>
            <button
              onClick={() => saveChanges(true)}
              disabled={saving}
              style={{
                background: "linear-gradient(135deg,#1a4731,#16a34a)",
                color: "white", border: "none", borderRadius: 10,
                padding: "9px 18px", cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 13, fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: "0 2px 12px rgba(22,163,74,.3)",
              }}
            >
              <PlayCircle size={14}/>
              حفظ وعرض
            </button>
          </div>
        </div>

        {/* Lesson title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", display: "block", marginBottom: 5, letterSpacing: .5 }}>
            عنوان الدرس
          </label>
          <input
            value={plan.title}
            onChange={e => setPlan({ ...plan, title: e.target.value })}
            style={{ ...inputStyle, fontSize: 16, fontWeight: 800, padding: "10px 14px" }}
            placeholder="عنوان الدرس"
          />
        </div>

        {/* Key points */}
        {plan.keyPoints && plan.keyPoints.length > 0 && (
          <div style={{ background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8, letterSpacing: .5 }}>
              النقاط الرئيسية
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {plan.keyPoints.map((kp, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={kp}
                    onChange={e => {
                      const kps = [...(plan.keyPoints ?? [])];
                      kps[i] = e.target.value;
                      setPlan({ ...plan, keyPoints: kps });
                    }}
                    style={{ ...inputStyle, fontSize: 13, padding: "6px 10px" }}
                    dir="rtl"
                  />
                  <button onClick={() => setPlan({ ...plan, keyPoints: plan.keyPoints!.filter((_, j) => j !== i) })}
                    style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", flexShrink: 0 }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intro */}
        <PhaseCard
          label="مقدمة" color="#7dd3fc"
          voiceText={plan.intro.voiceText}
          boardActions={plan.intro.boardActions}
          onVoiceChange={v => setPlan({ ...plan, intro: { ...plan.intro, voiceText: v } })}
          onActionsChange={a => setPlan({ ...plan, intro: { ...plan.intro, boardActions: a } })}
        />

        {/* Steps */}
        {plan.steps.map((step, i) => (
          <div key={step.id} style={{ position: "relative" }}>
            <PhaseCard
              label={`خطوة ${i + 1}`} color="#4ade80"
              title={step.title}
              voiceText={step.voiceText}
              boardActions={step.boardActions}
              onTitleChange={t => updateStepTitle(i, t)}
              onVoiceChange={v => updateStepVoice(i, v)}
              onActionsChange={a => updateStepActions(i, a)}
            />
            {/* Delete step */}
            <button
              onClick={() => deleteStep(i)}
              style={{
                position: "absolute", top: 14, left: 14,
                background: "none", border: "none",
                color: "var(--muted-foreground)", cursor: "pointer", padding: 4,
                borderRadius: 5, transition: "color .15s",
              }}
              title="حذف الخطوة"
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
            >
              <Trash2 size={14}/>
            </button>
          </div>
        ))}

        {/* Add step button */}
        <button
          onClick={addStep}
          style={{
            width: "100%", background: "rgba(74,222,128,.06)",
            border: "1.5px dashed rgba(74,222,128,.35)",
            borderRadius: 12, padding: "12px", cursor: "pointer",
            color: "#4ade80", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginBottom: 12, transition: "background .2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,.06)"; }}
        >
          <Plus size={16}/> إضافة خطوة جديدة
        </button>

        {/* Summary */}
        <PhaseCard
          label="خلاصة" color="#c4b5fd"
          voiceText={plan.summary.voiceText}
          boardActions={plan.summary.boardActions}
          onVoiceChange={v => setPlan({ ...plan, summary: { ...plan.summary, voiceText: v } })}
          onActionsChange={a => setPlan({ ...plan, summary: { ...plan.summary, boardActions: a } })}
        />

        {/* Bottom save buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => saveChanges(false)} disabled={saving}
            style={{
              flex: 1, background: "var(--card)", border: "1px solid var(--border)",
              color: "var(--foreground)", borderRadius: 12, padding: "13px",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 15, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {saving ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }}/> : <Save size={18}/>}
            حفظ التغييرات
          </button>
          <button onClick={() => saveChanges(true)} disabled={saving}
            style={{
              flex: 1, background: "linear-gradient(135deg,#1a4731,#16a34a)",
              color: "white", border: "none", borderRadius: 12, padding: "13px",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 15, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(22,163,74,.3)",
            }}>
            <PlayCircle size={18}/> حفظ وابدأ العرض
          </button>
        </div>

        <style>{`
          @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </Layout>
  );
}
