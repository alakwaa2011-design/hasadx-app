import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui-elements";
import {
  Sparkles, ChevronRight, Loader2, CheckCircle2,
  Edit2, Trash2, GripVertical, Plus, PlayCircle, Save, ArrowRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

const SUBJECTS = ["الرياضيات", "العلوم", "اللغة العربية", "اللغة الإنجليزية", "الدراسات الاجتماعية", "التربية الإسلامية", "الحاسب الآلي", "الفيزياء", "الكيمياء", "الأحياء", "أخرى"];
const GRADES = ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر"];

function ActionChip({ action }: { action: BoardAction }) {
  const colorMap: Record<string, string> = {
    writeText: "#4ade80", writeMath: "#60a5fa", bullet: "#c4b5fd",
    highlight: "#fbbf24", underline: "#f9a8d4", drawArrow: "#fb923c",
    drawCircle: "#34d399", showDiagram: "#a78bfa", clearBoard: "#6b7280",
    erase: "#ef4444", pause: "#fbbf24", bullet2: "#c4b5fd",
  };
  const color = colorMap[action.type] ?? "#9ca3af";
  const text = action.content ?? action.label ?? action.description ?? action.type;
  const truncated = text.length > 30 ? text.slice(0, 30) + "…" : text;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
      maxWidth: 160, overflow: "hidden",
    }}>{truncated}</span>
  );
}

function StepCard({
  step, index, onEditTitle, onEditVoice, onDelete, isIntro, isSummary,
}: {
  step: LessonStep | { voiceText: string; boardActions: BoardAction[] };
  index: number;
  onEditTitle?: (val: string) => void;
  onEditVoice: (val: string) => void;
  onDelete?: () => void;
  isIntro?: boolean;
  isSummary?: boolean;
}) {
  const [editingVoice, setEditingVoice] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const title = isIntro ? "المقدمة" : isSummary ? "الخلاصة" : ("title" in step ? step.title : "");

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {!isIntro && !isSummary && <GripVertical size={16} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />}
          <div>
            <span style={{
              display: "inline-block", background: isIntro ? "#1e3a4a" : isSummary ? "#2a1a3e" : "#1a3025",
              color: isIntro ? "#7dd3fc" : isSummary ? "#c4b5fd" : "#4ade80",
              borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, marginBottom: 4,
            }}>
              {isIntro ? "مقدمة" : isSummary ? "خلاصة" : `خطوة ${index}`}
            </span>
            {!isIntro && !isSummary && onEditTitle && (
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>
                {"title" in step ? step.title : ""}
              </div>
            )}
          </div>
        </div>
        {onDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Voice text */}
      <div style={{ marginBottom: 10 }}>
        {editingVoice ? (
          <div>
            <textarea
              value={voiceDraft}
              onChange={e => setVoiceDraft(e.target.value)}
              style={{
                width: "100%", minHeight: 72, resize: "vertical",
                borderRadius: 8, border: "1px solid var(--border)",
                padding: "8px 10px", fontSize: 13, fontFamily: "inherit",
                background: "var(--background)", color: "var(--foreground)",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                onClick={() => { onEditVoice(voiceDraft); setEditingVoice(false); }}
                style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
              >حفظ</button>
              <button
                onClick={() => setEditingVoice(false)}
                style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}
              >إلغاء</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6,
              background: "var(--muted)", borderRadius: 8, padding: "8px 10px",
              cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 6,
            }}
            onClick={() => { setVoiceDraft(step.voiceText); setEditingVoice(true); }}
            title="انقر للتعديل"
          >
            <span style={{ color: "var(--muted-foreground)", fontSize: 11, flexShrink: 0 }}>🔊</span>
            <span>{step.voiceText}</span>
            <Edit2 size={12} style={{ flexShrink: 0, marginTop: 2, opacity: 0.5 }} />
          </div>
        )}
      </div>

      {/* Board actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {step.boardActions.slice(0, 6).map((a, i) => <ActionChip key={i} action={a} />)}
        {step.boardActions.length > 6 && (
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>+{step.boardActions.length - 6} أخرى</span>
        )}
      </div>
    </div>
  );
}

export default function SmartBoardNew() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();

  // Form state
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [depth, setDepth] = useState<"brief" | "standard" | "detailed">("standard");

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (!topic.trim()) { setError("اكتب موضوع الدرس أولاً"); return; }
    setError("");
    setLoading(true);
    setPlan(null);
    try {
      const r = await fetch(`${API_BASE}/api/whiteboard/generate`, {
        method: "POST",
        credentials: "include",
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
        method: "POST",
        credentials: "include",
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

  function updateStepVoice(idx: number, val: string) {
    if (!plan) return;
    const steps = [...plan.steps];
    steps[idx] = { ...steps[idx], voiceText: val };
    setPlan({ ...plan, steps });
  }

  function deleteStep(idx: number) {
    if (!plan) return;
    const steps = plan.steps.filter((_, i) => i !== idx);
    setPlan({ ...plan, steps });
  }

  return (
    <Layout>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }} dir="rtl">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, color: "var(--muted-foreground)", fontSize: 13 }}>
          <button onClick={() => navigate("/teacher/smart-board")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
            السبورة الذكية
          </button>
          <ChevronRight size={14} />
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>درس جديد</span>
        </div>

        {/* Topic input */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "24px", marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 6 }}>موضوع الدرس</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginBottom: 16 }}>
            اكتب الموضوع وسيُنشئ الذكاء الاصطناعي خطة درس كاملة لعرضها على السبورة
          </p>

          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
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
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "8px 10px", fontSize: 13,
                  background: "var(--background)", color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <option value="">اختر المادة</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>الصف الدراسي</label>
              <select
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "8px 10px", fontSize: 13,
                  background: "var(--background)", color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <option value="">اختر الصف</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", display: "block", marginBottom: 5 }}>عمق الشرح</label>
              <select
                value={depth}
                onChange={e => setDepth(e.target.value as any)}
                style={{
                  width: "100%", borderRadius: 8, border: "1px solid var(--border)",
                  padding: "8px 10px", fontSize: 13,
                  background: "var(--background)", color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
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
            onClick={generate}
            disabled={loading || !topic.trim()}
            style={{
              marginTop: 16, width: "100%",
              background: loading ? "#6b7280" : "linear-gradient(135deg,#166534,#16a34a)",
              color: "white", border: "none", borderRadius: 10,
              padding: "13px", cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800, fontSize: 15, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                جارٍ إنشاء خطة الدرس…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {plan ? "أعد توليد الخطة" : "أنشئ خطة الدرس"}
              </>
            )}
          </button>
        </div>

        {/* Generated plan */}
        {plan && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckCircle2 size={18} color="#4ade80" />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>
                {plan.title}
              </h2>
              <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>— انقر على أي نص صوتي لتعديله</span>
            </div>

            {/* Key points */}
            {plan.keyPoints && plan.keyPoints.length > 0 && (
              <div style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>النقاط الرئيسية للدرس</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {plan.keyPoints.map((kp, i) => (
                    <span key={i} style={{
                      background: "rgba(74,222,128,0.12)", color: "#4ade80",
                      border: "1px solid rgba(74,222,128,0.3)", borderRadius: 20,
                      padding: "3px 10px", fontSize: 12, fontWeight: 600,
                    }}>{kp}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Intro */}
            <div style={{ marginBottom: 10 }}>
              <StepCard
                step={plan.intro}
                index={0}
                onEditVoice={v => setPlan({ ...plan, intro: { ...plan.intro, voiceText: v } })}
                isIntro
              />
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              {plan.steps.map((step, i) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i + 1}
                  onEditVoice={v => updateStepVoice(i, v)}
                  onDelete={() => deleteStep(i)}
                />
              ))}
            </div>

            {/* Summary */}
            <div style={{ marginBottom: 24 }}>
              <StepCard
                step={plan.summary}
                index={plan.steps.length + 2}
                onEditVoice={v => setPlan({ ...plan, summary: { ...plan.summary, voiceText: v } })}
                isSummary
              />
            </div>

            {/* Start button */}
            <button
              onClick={startPresent}
              disabled={saving}
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
