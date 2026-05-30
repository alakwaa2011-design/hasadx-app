import { useEffect, useState } from "react";
import { api, IslamicShell, IslamicCard, GoldButton, GhostButton, BackLink, ISLAMIC_GOLD } from "./_shared";

interface Category { id: number; sectionId: number; name: string; description: string | null; level: string; isVisible: boolean; order: number; questionCount: number; }
interface Section { id: number; name: string; description: string | null; isVisible: boolean; order: number; categories: Category[]; }
interface Q { id: number; categoryId: number; questionText: string; audioUrl: string | null; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; difficulty: string; }

export default function IslamicAdmin() {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [permissions, setPermissions] = useState<Array<{ id: number; teacherId: number; teacherName: string | null; teacherEmail: string | null; isActive: boolean }>>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; email: string | null }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<"content" | "permissions" | "import">("content");
  const [importMsg, setImportMsg] = useState("");
  const [dedupRunning, setDedupRunning] = useState(false);
  const [dedupMsg, setDedupMsg] = useState("");
  const [editing, setEditing] = useState<Partial<Q> & { id?: number } | null>(null);

  async function reload() {
    const [s, perms, acc] = await Promise.all([
      api<Section[]>("/islamic/sections"),
      api<typeof permissions>("/islamic/admin/permissions").catch(() => []),
      api<{ isAdmin: boolean }>("/islamic/access"),
    ]);
    setSections(s);
    setPermissions(perms);
    setIsAdmin(acc.isAdmin);
  }
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (activeCat) api<Q[]>(`/islamic/categories/${activeCat.id}/questions`).then(setQuestions);
    else setQuestions([]);
  }, [activeCat]);

  async function addSection() {
    const name = prompt("اسم القسم:");
    if (!name) return;
    await api("/islamic/sections", { method: "POST", body: JSON.stringify({ name }) });
    reload();
  }
  async function addCategory(sectionId: number) {
    const name = prompt("اسم الفئة:");
    if (!name) return;
    await api("/islamic/categories", { method: "POST", body: JSON.stringify({ sectionId, name }) });
    reload();
  }
  async function toggleSectionVisibility(s: Section) {
    await api(`/islamic/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !s.isVisible }) });
    reload();
  }
  async function toggleCategoryVisibility(c: Category) {
    await api(`/islamic/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !c.isVisible }) });
    reload();
  }
  async function deleteSection(s: Section) {
    if (!confirm(`حذف القسم "${s.name}" وكل ما فيه؟`)) return;
    await api(`/islamic/sections/${s.id}`, { method: "DELETE" });
    reload();
  }
  async function deleteCategory(c: Category) {
    if (!confirm(`حذف الفئة "${c.name}" وكل أسئلتها؟`)) return;
    await api(`/islamic/categories/${c.id}`, { method: "DELETE" });
    if (activeCat?.id === c.id) setActiveCat(null);
    reload();
  }
  async function saveQuestion() {
    if (!editing || !activeCat) return;
    const payload = {
      categoryId: activeCat.id,
      questionText: editing.questionText,
      audioUrl: editing.audioUrl || null,
      optionA: editing.optionA, optionB: editing.optionB, optionC: editing.optionC, optionD: editing.optionD,
      correctAnswer: editing.correctAnswer, difficulty: editing.difficulty || "medium",
    };
    if (editing.id) await api(`/islamic/questions/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    else await api("/islamic/questions", { method: "POST", body: JSON.stringify(payload) });
    setEditing(null);
    if (activeCat) api<Q[]>(`/islamic/categories/${activeCat.id}/questions`).then(setQuestions);
    reload();
  }
  async function deleteQuestion(q: Q) {
    if (!confirm("حذف السؤال؟")) return;
    await api(`/islamic/questions/${q.id}`, { method: "DELETE" });
    if (activeCat) api<Q[]>(`/islamic/categories/${activeCat.id}/questions`).then(setQuestions);
  }
  async function uploadAudio(file: File): Promise<string> {
    const r = await api<{ uploadURL: string; objectPath: string }>("/islamic/uploads/audio-url", {
      method: "POST",
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "audio/mpeg" }),
    });
    await fetch(r.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "audio/mpeg" } });
    return r.objectPath;
  }
  async function searchTeachers() {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const r = await api<typeof searchResults>(`/islamic/admin/teachers-search?q=${encodeURIComponent(searchQ)}`);
    setSearchResults(r);
  }
  async function grant(teacherId: number) {
    await api("/islamic/admin/permissions", { method: "POST", body: JSON.stringify({ teacherId }) });
    setSearchQ(""); setSearchResults([]);
    reload();
  }
  async function revoke(teacherId: number) {
    if (!confirm("سحب الإذن؟")) return;
    await api(`/islamic/admin/permissions/${teacherId}`, { method: "DELETE" });
    reload();
  }
  async function runDedup() {
    if (!confirm("سيتم حذف الأسئلة المكررة وإضافة الأسئلة الأساسية. هل أنت متأكد؟")) return;
    setDedupRunning(true);
    setDedupMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/dedup-islamic-questions`, { method: "POST", credentials: "include" });
      const r = await res.json();
      if (!res.ok) { setDedupMsg(`فشل: ${r.message || res.statusText}`); return; }
      setDedupMsg(`✅ تم: حُذف ${r.deletedDuplicates} مكرر، أُضيف ${r.newQuestionsInserted} سؤال جديد`);
      reload();
    } catch { setDedupMsg("حدث خطأ أثناء التنظيف"); }
    finally { setDedupRunning(false); }
  }

  async function importFile(file: File) {
    setImportMsg("جاري الاستيراد…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/islamic/import`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setImportMsg(`فشل: ${err.message || res.statusText}`);
      return;
    }
    const r = await res.json();
    setImportMsg(`تم استيراد ${r.imported} سؤال (تم تخطي ${r.skipped})`);
    reload();
  }

  return (
    <IslamicShell title="لوحة التحكم">
      <BackLink />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setTab("content")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "content" ? ISLAMIC_GOLD : "transparent", color: "#fff", border: `1px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit" }}>المحتوى</button>
        {isAdmin && <button onClick={() => setTab("permissions")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "permissions" ? ISLAMIC_GOLD : "transparent", color: "#fff", border: `1px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit" }}>الأذونات</button>}
        <button onClick={() => setTab("import")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "import" ? ISLAMIC_GOLD : "transparent", color: "#fff", border: `1px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit" }}>استيراد Excel</button>
      </div>

      {tab === "content" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <GoldButton onClick={addSection}>+ قسم جديد</GoldButton>
            {isAdmin && (
              <GhostButton onClick={runDedup} disabled={dedupRunning} style={{ color: "#fca5a5", borderColor: "#fca5a5" }}>
                {dedupRunning ? "جاري التنظيف…" : "🧹 حذف المكررات"}
              </GhostButton>
            )}
            {dedupMsg && <span style={{ fontSize: 13, color: ISLAMIC_GOLD, marginRight: 8 }}>{dedupMsg}</span>}
          </div>
          {sections.map((s) => (
            <IslamicCard key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ISLAMIC_GOLD }}>{s.name} {!s.isVisible && <span style={{ fontSize: 13, opacity: 0.7 }}>(مخفي)</span>}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <GhostButton onClick={() => addCategory(s.id)}>+ فئة</GhostButton>
                  <GhostButton onClick={() => toggleSectionVisibility(s)}>{s.isVisible ? "إخفاء" : "إظهار"}</GhostButton>
                  <GhostButton onClick={() => deleteSection(s)} style={{ color: "#fca5a5" }}>حذف</GhostButton>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                {s.categories.map((c) => (
                  <div key={c.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, border: activeCat?.id === c.id ? `1px solid ${ISLAMIC_GOLD}` : "1px solid rgba(217,119,6,0.15)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.name} {!c.isVisible && <span style={{ fontSize: 11, opacity: 0.7 }}>(مخفي)</span>}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{c.questionCount} سؤال</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button onClick={() => setActiveCat(c)} style={{ background: "transparent", color: ISLAMIC_GOLD, border: `1px solid ${ISLAMIC_GOLD}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>الأسئلة</button>
                      <button onClick={() => toggleCategoryVisibility(c)} style={{ background: "transparent", color: "#fefce8", border: "1px solid rgba(254,252,232,0.3)", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>{c.isVisible ? "إخفاء" : "إظهار"}</button>
                      <button onClick={() => deleteCategory(c)} style={{ background: "transparent", color: "#fca5a5", border: "1px solid #fca5a5", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            </IslamicCard>
          ))}

          {activeCat && (
            <IslamicCard style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: 20, color: ISLAMIC_GOLD }}>أسئلة فئة: {activeCat.name}</h3>
                <GoldButton onClick={() => setEditing({ optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", questionText: "", difficulty: "medium" })}>+ سؤال جديد</GoldButton>
              </div>
              {questions.length === 0 && <p style={{ opacity: 0.7 }}>لا أسئلة</p>}
              {questions.map((q) => (
                <div key={q.id} style={{ borderBottom: "1px solid rgba(217,119,6,0.15)", padding: "12px 0" }}>
                  <div style={{ fontWeight: 600 }}>{q.questionText}</div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>الصحيحة: {q.correctAnswer} · {q.difficulty}{q.audioUrl ? " · صوتي" : ""}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <GhostButton onClick={() => setEditing(q)}>تعديل</GhostButton>
                    <GhostButton onClick={() => deleteQuestion(q)} style={{ color: "#fca5a5" }}>حذف</GhostButton>
                  </div>
                </div>
              ))}
            </IslamicCard>
          )}

          {editing && activeCat && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditing(null)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "#0d6334", borderRadius: 20, padding: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${ISLAMIC_GOLD}` }}>
                <h3 style={{ fontSize: 18, color: ISLAMIC_GOLD, marginBottom: 12 }}>{editing.id ? "تعديل سؤال" : "سؤال جديد"}</h3>
                <textarea placeholder="نص السؤال" value={editing.questionText || ""} onChange={(e) => setEditing({ ...editing, questionText: e.target.value })} style={inpStyle} rows={3} />
                <input placeholder="الخيار أ" value={editing.optionA || ""} onChange={(e) => setEditing({ ...editing, optionA: e.target.value })} style={inpStyle} />
                <input placeholder="الخيار ب" value={editing.optionB || ""} onChange={(e) => setEditing({ ...editing, optionB: e.target.value })} style={inpStyle} />
                <input placeholder="الخيار ج" value={editing.optionC || ""} onChange={(e) => setEditing({ ...editing, optionC: e.target.value })} style={inpStyle} />
                <input placeholder="الخيار د" value={editing.optionD || ""} onChange={(e) => setEditing({ ...editing, optionD: e.target.value })} style={inpStyle} />
                <input placeholder="الإجابة الصحيحة (انسخ من الخيارات)" value={editing.correctAnswer || ""} onChange={(e) => setEditing({ ...editing, correctAnswer: e.target.value })} style={inpStyle} />
                <select value={editing.difficulty || "medium"} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })} style={inpStyle}>
                  <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
                </select>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, opacity: 0.85 }}>ملف صوتي (اختياري — لقسم "من القارئ"):</label>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.m4a"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await uploadAudio(f);
                      setEditing({ ...editing, audioUrl: url });
                    }}
                    style={{ ...inpStyle, padding: 8 }}
                  />
                  {editing.audioUrl && <div style={{ fontSize: 12, opacity: 0.85 }}>تم الرفع: {editing.audioUrl}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                  <GhostButton onClick={() => setEditing(null)}>إلغاء</GhostButton>
                  <GoldButton onClick={saveQuestion}>حفظ</GoldButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "permissions" && isAdmin && (
        <IslamicCard>
          <h3 style={{ fontSize: 20, marginBottom: 12, color: ISLAMIC_GOLD }}>منح إذن لمعلم</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="ابحث باسم أو إيميل" style={inpStyle} />
            <GoldButton onClick={searchTeachers}>بحث</GoldButton>
          </div>
          {searchResults.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(217,119,6,0.15)" }}>
              <div>{r.name} <span style={{ opacity: 0.7, fontSize: 13 }}>{r.email}</span></div>
              <GoldButton onClick={() => grant(r.id)}>منح</GoldButton>
            </div>
          ))}
          <h4 style={{ marginTop: 24, fontSize: 18, color: ISLAMIC_GOLD }}>الأذونات الحالية</h4>
          {permissions.length === 0 && <p style={{ opacity: 0.7 }}>لا أذونات</p>}
          {permissions.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(217,119,6,0.15)" }}>
              <div>{p.teacherName} <span style={{ opacity: 0.7, fontSize: 13 }}>{p.teacherEmail}</span> {!p.isActive && "(غير نشط)"}</div>
              {p.isActive && <GhostButton onClick={() => revoke(p.teacherId)} style={{ color: "#fca5a5" }}>سحب</GhostButton>}
            </div>
          ))}
        </IslamicCard>
      )}

      {tab === "import" && (
        <IslamicCard>
          <h3 style={{ fontSize: 20, color: ISLAMIC_GOLD, marginBottom: 12 }}>استيراد أسئلة من Excel/Word</h3>
          <p style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.8 }}>
            الأعمدة المطلوبة: <code>section_name</code>, <code>category_name</code>, <code>نص السؤال</code>, <code>الخيار أ</code>, <code>الخيار ب</code>, <code>الخيار ج</code>, <code>الخيار د</code>, <code>الإجابة الصحيحة</code>, <code>الصعوبة</code>, <code>audio_url</code> (اختياري).
            <br />
            تُنشأ الأقسام والفئات تلقائياً إن لم تكن موجودة.
          </p>
          <div style={{ marginTop: 12 }}>
            <a
              href={URL.createObjectURL(new Blob([
                ["section_name","category_name","نص السؤال","الخيار أ","الخيار ب","الخيار ج","الخيار د","الإجابة الصحيحة","الصعوبة","audio_url"].join(",")
              ], { type: "text/csv" }))}
              download="islamic-questions-template.csv"
              style={{ color: ISLAMIC_GOLD }}
            >تحميل قالب CSV</a>
          </div>
          <input type="file" accept=".xlsx,.xls,.csv,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} style={{ ...inpStyle, padding: 8, marginTop: 12 }} />
          {importMsg && <p style={{ marginTop: 8 }}>{importMsg}</p>}
        </IslamicCard>
      )}
    </IslamicShell>
  );
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
};
