import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  api,
  IslamicShell,
  IslamicCard,
  GoldButton,
  GhostButton,
  ISLAMIC_GOLD,
} from "@/pages/islamic/_shared";

const BASE = import.meta.env.VITE_API_URL || "";

interface ImportReport {
  imported: number;
  skipped: number;
  total: number;
  errors: Array<{ row: number; message: string }>;
}

interface Category {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  level: string;
  isVisible: boolean;
  order: number;
  questionCount: number;
}

interface Section {
  id: number;
  name: string;
  description: string | null;
  isVisible: boolean;
  order: number;
  categories: Category[];
}

interface Q {
  id: number;
  categoryId: number;
  questionText: string;
  audioUrl: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  difficulty: string;
}

interface QDraft {
  id?: number;
  questionText: string;
  audioUrl: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
}

const emptyDraft = (): QDraft => ({
  questionText: "",
  audioUrl: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  difficulty: "medium",
});

function fromQuestion(q: Q): QDraft {
  const opts: [string, string, string, string] = [q.optionA, q.optionB, q.optionC, q.optionD];
  const idx = Math.max(0, opts.indexOf(q.correctAnswer));
  return {
    id: q.id,
    questionText: q.questionText,
    audioUrl: q.audioUrl || "",
    options: opts,
    correctIndex: idx,
    difficulty: (["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : "medium") as QDraft["difficulty"],
  };
}

function validateDraft(d: QDraft): string | null {
  if (d.questionText.trim().length < 3) return "نص السؤال قصير جداً";
  if (d.questionText.trim().length > 2000) return "نص السؤال طويل جداً";
  const opts = d.options.map((o) => o.trim());
  if (opts.some((o) => !o)) return "يجب تعبئة الخيارات الأربعة";
  if (opts.some((o) => o.length > 500)) return "أحد الخيارات طويل جداً";
  if (new Set(opts).size !== 4) return "يجب أن تكون الخيارات الأربعة فريدة";
  if (d.correctIndex < 0 || d.correctIndex > 3) return "اختر الإجابة الصحيحة";
  return null;
}

export default function TeacherIslamicAdmin() {
  const [, setLocation] = useLocation();
  const [sections, setSections] = useState<Section[]>([]);
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [editing, setEditing] = useState<QDraft | null>(null);
  const [editError, setEditError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportError("");
    setImportReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/islamic/teacher/import`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "فشل الاستيراد");
      }
      setImportReport(data as ImportReport);
      reload();
      if (activeCat) {
        api<Q[]>(`/islamic/teacher/categories/${activeCat.id}/questions`).then(setQuestions).catch(() => {});
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function reload() {
    setLoading(true);
    try {
      const s = await api<Section[]>("/islamic/teacher/my-content");
      setSections(s);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (!activeCat) { setQuestions([]); return; }
    api<Q[]>(`/islamic/teacher/categories/${activeCat.id}/questions`).then(setQuestions).catch(() => setQuestions([]));
  }, [activeCat]);

  async function addSection() {
    const name = prompt("اسم القسم الجديد:");
    if (!name?.trim()) return;
    try {
      await api("/islamic/teacher/sections", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل الإنشاء"); }
  }

  async function renameSection(s: Section) {
    const name = prompt("الاسم الجديد للقسم:", s.name);
    if (!name?.trim() || name.trim() === s.name) return;
    try {
      await api(`/islamic/teacher/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل التعديل"); }
  }

  async function toggleSection(s: Section) {
    try {
      await api(`/islamic/teacher/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !s.isVisible }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل التعديل"); }
  }

  async function deleteSection(s: Section) {
    if (!confirm(`حذف القسم "${s.name}" وكل ما فيه من فئات وأسئلة؟ لا يمكن التراجع.`)) return;
    try {
      await api(`/islamic/teacher/sections/${s.id}`, { method: "DELETE" });
      if (activeCat && s.categories.some((c) => c.id === activeCat.id)) setActiveCat(null);
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل الحذف"); }
  }

  async function addCategory(s: Section) {
    const name = prompt(`اسم الفئة الجديدة في "${s.name}":`);
    if (!name?.trim()) return;
    try {
      await api("/islamic/teacher/categories", {
        method: "POST",
        body: JSON.stringify({ sectionId: s.id, name: name.trim() }),
      });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل الإنشاء"); }
  }

  async function renameCategory(c: Category) {
    const name = prompt("الاسم الجديد للفئة:", c.name);
    if (!name?.trim() || name.trim() === c.name) return;
    try {
      await api(`/islamic/teacher/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل التعديل"); }
  }

  async function toggleCategory(c: Category) {
    try {
      await api(`/islamic/teacher/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !c.isVisible }) });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل التعديل"); }
  }

  async function deleteCategory(c: Category) {
    if (!confirm(`حذف الفئة "${c.name}" وكل أسئلتها؟ لا يمكن التراجع.`)) return;
    try {
      await api(`/islamic/teacher/categories/${c.id}`, { method: "DELETE" });
      if (activeCat?.id === c.id) setActiveCat(null);
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل الحذف"); }
  }

  async function saveQuestion() {
    if (!editing || !activeCat) return;
    const err = validateDraft(editing);
    if (err) { setEditError(err); return; }
    setSaving(true);
    setEditError("");
    const payload = {
      categoryId: activeCat.id,
      questionText: editing.questionText.trim(),
      audioUrl: editing.audioUrl.trim() || null,
      options: editing.options.map((o) => o.trim()),
      correctIndex: editing.correctIndex,
      difficulty: editing.difficulty,
    };
    try {
      if (editing.id) {
        await api(`/islamic/teacher/questions/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/islamic/teacher/questions", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditing(null);
      const refreshed = await api<Q[]>(`/islamic/teacher/categories/${activeCat.id}/questions`);
      setQuestions(refreshed);
      reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAudio(file: File): Promise<string> {
    const r = await api<{ uploadURL: string; objectPath: string }>("/islamic/teacher/uploads/audio-url", {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "audio/mpeg" }),
    });
    const put = await fetch(r.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "audio/mpeg" } });
    if (!put.ok) throw new Error("فشل رفع الملف إلى التخزين");
    return r.objectPath;
  }

  async function deleteQuestion(q: Q) {
    if (!confirm("حذف السؤال؟")) return;
    try {
      await api(`/islamic/teacher/questions/${q.id}`, { method: "DELETE" });
      const refreshed = await api<Q[]>(`/islamic/teacher/categories/${activeCat!.id}/questions`);
      setQuestions(refreshed);
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : "فشل الحذف"); }
  }

  return (
    <IslamicShell title="محتوى تحدي حصاد · لوحة المعلم" subtitle="أنشئ أقسامك وفئاتك وأسئلتك الخاصة لاستخدامها في تحدي حصاد">
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <GhostButton onClick={() => setLocation("/teacher")}>← لوحة المعلم</GhostButton>
        <GhostButton onClick={() => setLocation("/islamic")}>تحدي حصاد</GhostButton>
        <GoldButton onClick={addSection}>+ قسم جديد</GoldButton>
        <GhostButton
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? "جاري الاستيراد…" : "📥 استيراد ملف"}
        </GhostButton>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
          }}
        />
      </div>

      {(importing || importError || importReport) && (
        <IslamicCard style={{ marginBottom: 14 }}>
          {importing && <p style={{ textAlign: "center" }}>جاري معالجة الملف…</p>}
          {importError && !importing && (
            <p style={{ color: "#fca5a5", margin: 0 }}>تعذر الاستيراد: {importError}</p>
          )}
          {importReport && !importing && (
            <div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: ISLAMIC_GOLD, fontWeight: 700 }}>تقرير الاستيراد</span>
                <span>إجمالي الصفوف: {importReport.total}</span>
                <span style={{ color: "#86efac" }}>تمت الإضافة: {importReport.imported}</span>
                <span style={{ color: importReport.skipped ? "#fca5a5" : "#fefce8" }}>
                  تم التخطي: {importReport.skipped}
                </span>
                <button
                  onClick={() => setImportReport(null)}
                  style={{ ...smallBtn(false), marginInlineStart: "auto" }}
                >
                  إخفاء
                </button>
              </div>
              {importReport.errors.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", color: "#fca5a5" }}>
                    أخطاء الصفوف ({importReport.errors.length})
                  </summary>
                  <ul style={{ marginTop: 8, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.8 }}>
                    {importReport.errors.slice(0, 50).map((er, i) => (
                      <li key={i}>صف {er.row}: {er.message}</li>
                    ))}
                    {importReport.errors.length > 50 && (
                      <li style={{ opacity: 0.7 }}>… و{importReport.errors.length - 50} خطأ إضافي</li>
                    )}
                  </ul>
                </details>
              )}
              <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                صيغة الملف: أعمدة (section_name, category_name, question, option_a, option_b, option_c, option_d, correct_answer, difficulty?, audio_url?). يقبل أيضاً المسميات العربية: القسم، الفئة، نص السؤال، الخيار أ/ب/ج/د، الإجابة الصحيحة، الصعوبة. الإجابة الصحيحة يمكن أن تكون A/B/C/D أو أ/ب/ج/د أو نص الخيار كاملاً.
              </p>
            </div>
          )}
        </IslamicCard>
      )}

      {loading && <IslamicCard><p style={{ textAlign: "center" }}>جاري التحميل…</p></IslamicCard>}
      {error && !loading && <IslamicCard><p style={{ color: "#fca5a5" }}>{error}</p></IslamicCard>}

      {!loading && !error && sections.length === 0 && (
        <IslamicCard>
          <p style={{ textAlign: "center", lineHeight: 2 }}>
            لم تقم بإنشاء أي محتوى بعد. ابدأ بإضافة قسم، ثم فئة داخله، ثم أضف الأسئلة.
          </p>
        </IslamicCard>
      )}

      {sections.map((s) => (
        <IslamicCard key={s.id} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: ISLAMIC_GOLD, margin: 0 }}>
              {s.name} {!s.isVisible && <span style={{ fontSize: 13, opacity: 0.7 }}>(مخفي)</span>}
            </h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <GhostButton onClick={() => addCategory(s)}>+ فئة</GhostButton>
              <GhostButton onClick={() => renameSection(s)}>تعديل الاسم</GhostButton>
              <GhostButton onClick={() => toggleSection(s)}>{s.isVisible ? "إخفاء" : "إظهار"}</GhostButton>
              <GhostButton onClick={() => deleteSection(s)} style={{ color: "#fca5a5" }}>حذف</GhostButton>
            </div>
          </div>

          {s.categories.length === 0 && (
            <p style={{ marginTop: 12, opacity: 0.75, fontSize: 14 }}>لا فئات في هذا القسم بعد.</p>
          )}

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {s.categories.map((c) => (
              <div key={c.id} style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: 12,
                border: activeCat?.id === c.id ? `1px solid ${ISLAMIC_GOLD}` : "1px solid rgba(217,119,6,0.15)",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {c.name} {!c.isVisible && <span style={{ fontSize: 11, opacity: 0.7 }}>(مخفية)</span>}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>{c.questionCount} سؤال</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => setActiveCat(c)} style={smallBtn(true)}>الأسئلة</button>
                  <button onClick={() => renameCategory(c)} style={smallBtn(false)}>تعديل</button>
                  <button onClick={() => toggleCategory(c)} style={smallBtn(false)}>{c.isVisible ? "إخفاء" : "إظهار"}</button>
                  <button onClick={() => deleteCategory(c)} style={{ ...smallBtn(false), color: "#fca5a5", borderColor: "#fca5a5" }}>حذف</button>
                </div>
              </div>
            ))}
          </div>
        </IslamicCard>
      ))}

      {activeCat && (
        <IslamicCard style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 20, color: ISLAMIC_GOLD, margin: 0 }}>أسئلة فئة: {activeCat.name}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <GhostButton onClick={() => setActiveCat(null)}>إغلاق</GhostButton>
              <GoldButton onClick={() => { setEditing(emptyDraft()); setEditError(""); }}>+ سؤال جديد</GoldButton>
            </div>
          </div>
          {questions.length === 0 && <p style={{ opacity: 0.7 }}>لا أسئلة في هذه الفئة بعد.</p>}
          {questions.map((q) => (
            <div key={q.id} style={{ borderBottom: "1px solid rgba(217,119,6,0.15)", padding: "12px 0" }}>
              <div style={{ fontWeight: 600 }}>{q.questionText}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                الإجابة: {q.correctAnswer} · {q.difficulty}{q.audioUrl ? " · صوتي" : ""}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <GhostButton onClick={() => { setEditing(fromQuestion(q)); setEditError(""); }}>تعديل</GhostButton>
                <GhostButton onClick={() => deleteQuestion(q)} style={{ color: "#fca5a5" }}>حذف</GhostButton>
              </div>
            </div>
          ))}
        </IslamicCard>
      )}

      {editing && activeCat && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => !saving && setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0d6334", borderRadius: 20, padding: 24, maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${ISLAMIC_GOLD}` }}
          >
            <h3 style={{ fontSize: 18, color: ISLAMIC_GOLD, marginTop: 0, marginBottom: 12 }}>
              {editing.id ? "تعديل سؤال" : "سؤال جديد"}
            </h3>
            <textarea
              placeholder="نص السؤال"
              value={editing.questionText}
              onChange={(e) => setEditing({ ...editing, questionText: e.target.value })}
              style={inpStyle}
              rows={3}
              maxLength={2000}
            />
            {(["A", "B", "C", "D"] as const).map((label, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: editing.correctIndex === i ? ISLAMIC_GOLD : "#fefce8", minWidth: 90, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="correct"
                    checked={editing.correctIndex === i}
                    onChange={() => setEditing({ ...editing, correctIndex: i })}
                    style={{ accentColor: ISLAMIC_GOLD }}
                  />
                  الخيار {label} {editing.correctIndex === i && "✓"}
                </label>
                <input
                  placeholder={`الخيار ${label}`}
                  value={editing.options[i]}
                  onChange={(e) => {
                    const next = [...editing.options] as QDraft["options"];
                    next[i] = e.target.value;
                    setEditing({ ...editing, options: next });
                  }}
                  style={{ ...inpStyle, marginBottom: 0, flex: 1 }}
                  maxLength={500}
                />
              </div>
            ))}
            <select
              value={editing.difficulty}
              onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as QDraft["difficulty"] })}
              style={inpStyle}
            >
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 8 }}>
              <input
                placeholder="رابط ملف صوتي (اختياري)"
                value={editing.audioUrl}
                onChange={(e) => setEditing({ ...editing, audioUrl: e.target.value })}
                style={{ ...inpStyle, marginBottom: 0, flex: 1 }}
                maxLength={1000}
              />
              <label
                style={{
                  ...smallBtn(true),
                  padding: "0 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  cursor: uploadingAudio ? "wait" : "pointer",
                  opacity: uploadingAudio ? 0.6 : 1,
                }}
              >
                {uploadingAudio ? "جاري الرفع…" : "اختر ملفاً"}
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  disabled={uploadingAudio}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 25 * 1024 * 1024) {
                      setEditError("الحجم يتجاوز 25MB");
                      return;
                    }
                    setUploadingAudio(true);
                    setEditError("");
                    try {
                      const path = await uploadAudio(file);
                      setEditing((prev) => (prev ? { ...prev, audioUrl: path } : prev));
                    } catch (err) {
                      setEditError(err instanceof Error ? err.message : "فشل رفع الملف");
                    } finally {
                      setUploadingAudio(false);
                    }
                  }}
                />
              </label>
              {editing.audioUrl.trim() && (
                <button
                  type="button"
                  onClick={() => setEditing((prev) => (prev ? { ...prev, audioUrl: "" } : prev))}
                  disabled={uploadingAudio}
                  style={{
                    ...smallBtn(false),
                    padding: "0 14px",
                    whiteSpace: "nowrap",
                    color: "#fca5a5",
                  }}
                >
                  إزالة الصوت
                </button>
              )}
            </div>
            {editing.audioUrl.trim() && (
              <audio
                controls
                src={editing.audioUrl.trim()}
                style={{ width: "100%", marginBottom: 8 }}
              />
            )}
            {editError && <p style={{ color: "#fca5a5", marginTop: 4 }}>{editError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <GhostButton onClick={() => setEditing(null)} disabled={saving}>إلغاء</GhostButton>
              <GoldButton onClick={saveQuestion} disabled={saving}>{saving ? "جاري الحفظ…" : "حفظ"}</GoldButton>
            </div>
          </div>
        </div>
      )}
    </IslamicShell>
  );
}

function smallBtn(primary: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: primary ? ISLAMIC_GOLD : "#fefce8",
    border: primary ? `1px solid ${ISLAMIC_GOLD}` : "1px solid rgba(254,252,232,0.3)",
    padding: "4px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
  };
}

const inpStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  color: "#fefce8",
  border: "1px solid rgba(217,119,6,0.3)",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 8,
  fontFamily: "inherit",
  fontSize: 15,
  boxSizing: "border-box",
};
