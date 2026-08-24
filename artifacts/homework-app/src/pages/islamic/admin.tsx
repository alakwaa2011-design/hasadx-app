import { useEffect, useRef, useState } from "react";
import { api, IslamicShell, IslamicCard, GoldButton, GhostButton, BackLink, ISLAMIC_GOLD } from "./_shared";
import AudioPicker from "@/components/AudioPicker";
import { useI18n } from "@/lib/i18n";

interface Category { id: number; sectionId: number; name: string; description: string | null; level: string; isVisible: boolean; order: number; questionCount: number; }
interface Section { id: number; name: string; description: string | null; isVisible: boolean; order: number; categories: Category[]; }
interface Q { id: number; categoryId: number; questionText: string; audioUrl: string | null; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string; difficulty: string; }

export default function IslamicAdmin() {
  const { t } = useI18n();
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
  const [fixRunning, setFixRunning] = useState(false);
  const [fixMsg, setFixMsg] = useState("");
  const [editing, setEditing] = useState<Partial<Q> & { id?: number } | null>(null);
  const [saveError, setSaveError] = useState("");
  const questionsPanelRef = useRef<HTMLDivElement>(null);

  function openCategory(c: Category) {
    setActiveCat(c);
    setTimeout(() => questionsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

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
    const name = prompt(t.islamic.sectionNamePrompt);
    if (!name) return;
    await api("/islamic/sections", { method: "POST", body: JSON.stringify({ name }) });
    reload();
  }
  async function addCategory(sectionId: number) {
    const name = prompt(t.islamic.categoryNamePrompt);
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
    if (!confirm(`${t.islamic.delete} "${s.name}"?`)) return;
    await api(`/islamic/sections/${s.id}`, { method: "DELETE" });
    reload();
  }
  async function deleteCategory(c: Category) {
    if (!confirm(`${t.islamic.delete} "${c.name}"?`)) return;
    await api(`/islamic/categories/${c.id}`, { method: "DELETE" });
    if (activeCat?.id === c.id) setActiveCat(null);
    reload();
  }
  async function saveQuestion() {
    if (!editing || !activeCat) return;
    setSaveError("");
    // Client-side validation
    if (!editing.questionText?.trim()) { setSaveError(t.islamic.questionRequired); return; }
    if (!editing.optionA?.trim() || !editing.optionB?.trim() || !editing.optionC?.trim() || !editing.optionD?.trim()) {
      setSaveError(t.islamic.optionsRequired);
      return;
    }
    if (!editing.correctAnswer?.trim()) { setSaveError(t.islamic.answerRequired); return; }
    const payload = {
      categoryId: activeCat.id,
      questionText: editing.questionText,
      audioUrl: editing.audioUrl || null,
      optionA: editing.optionA, optionB: editing.optionB, optionC: editing.optionC, optionD: editing.optionD,
      correctAnswer: editing.correctAnswer, difficulty: editing.difficulty || "medium",
    };
    try {
      if (editing.id) await api(`/islamic/questions/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/islamic/questions", { method: "POST", body: JSON.stringify(payload) });
      setEditing(null);
      setSaveError("");
      if (activeCat) api<Q[]>(`/islamic/categories/${activeCat.id}/questions`).then(setQuestions);
      reload();
    } catch (err: unknown) {
      setSaveError((err as Error).message || t.islamic.saveFailed);
    }
  }
  async function deleteQuestion(q: Q) {
    if (!confirm(t.islamic.deleteQuestionConfirm)) return;
    await api(`/islamic/questions/${q.id}`, { method: "DELETE" });
    if (activeCat) api<Q[]>(`/islamic/categories/${activeCat.id}/questions`).then(setQuestions);
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
    if (!confirm(t.islamic.revokeConfirm)) return;
    await api(`/islamic/admin/permissions/${teacherId}`, { method: "DELETE" });
    reload();
  }
  async function runFixAnswers() {
    if (!confirm(t.islamic.confirmFixAnswers)) return;
    setFixRunning(true); setFixMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/fix-islamic-correct-answers`, { method: "POST", credentials: "include" });
      const r = await res.json();
      if (!res.ok) { setFixMsg(`${t.islamic.operationFailed}: ${r.message || res.statusText}`); return; }
      setFixMsg(`✅ ${r.letterFixed + r.partialFixed} ${t.islamic.questions}`);
      reload();
    } catch { setFixMsg(t.islamic.unexpectedError); }
    finally { setFixRunning(false); }
  }

  async function runDedup() {
    if (!confirm(t.islamic.confirmRemoveDuplicates)) return;
    setDedupRunning(true);
    setDedupMsg("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/admin/dedup-islamic-questions`, { method: "POST", credentials: "include" });
      const r = await res.json();
      if (!res.ok) { setDedupMsg(`${t.islamic.operationFailed}: ${r.message || res.statusText}`); return; }
      setDedupMsg(`✅ ${r.newQuestionsInserted} ${t.islamic.questions}`);
      reload();
    } catch { setDedupMsg(t.islamic.unexpectedError); }
    finally { setDedupRunning(false); }
  }

  async function importFile(file: File) {
    setImportMsg(t.islamic.importing);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/islamic/import`, { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setImportMsg(`${t.islamic.operationFailed}: ${err.message || res.statusText}`);
      return;
    }
    const r = await res.json();
    setImportMsg(`${r.imported} ${t.islamic.questions}`);
    reload();
  }

  return (
    <IslamicShell title={t.islamic.admin}>
      <BackLink />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setTab("content")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "content" ? ISLAMIC_GOLD : "#fff", color: tab === "content" ? "#fff" : "#92400e", border: `1.5px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>{t.islamic.content}</button>
        {isAdmin && <button onClick={() => setTab("permissions")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "permissions" ? ISLAMIC_GOLD : "#fff", color: tab === "permissions" ? "#fff" : "#92400e", border: `1.5px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>{t.islamic.permissions}</button>}
        <button onClick={() => setTab("import")} style={{ padding: "8px 16px", borderRadius: 10, background: tab === "import" ? ISLAMIC_GOLD : "#fff", color: tab === "import" ? "#fff" : "#92400e", border: `1.5px solid ${ISLAMIC_GOLD}`, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>{t.islamic.importExcel}</button>
      </div>

      {tab === "content" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <GoldButton onClick={addSection}>+ {t.islamic.addSection}</GoldButton>
            {isAdmin && (
              <>
                <GhostButton onClick={runFixAnswers} disabled={fixRunning} style={{ color: "#166534", borderColor: "#16a34a" }}>
                  {fixRunning ? t.islamic.loading : `🔧 ${t.islamic.fixAnswers}`}
                </GhostButton>
                <GhostButton onClick={runDedup} disabled={dedupRunning} style={{ color: "#991b1b", borderColor: "#ef4444" }}>
                  {dedupRunning ? t.islamic.loading : `🧹 ${t.islamic.removeDuplicates}`}
                </GhostButton>
              </>
            )}
            {fixMsg && <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>{fixMsg}</span>}
            {dedupMsg && <span style={{ fontSize: 13, color: ISLAMIC_GOLD }}>{dedupMsg}</span>}
          </div>
          {sections.map((s) => (
            <IslamicCard key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: ISLAMIC_GOLD }}>{s.name} {!s.isVisible && <span style={{ fontSize: 13, opacity: 0.7 }}>(مخفي)</span>}</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <GhostButton onClick={() => addCategory(s.id)}>+ {t.islamic.addCategory}</GhostButton>
                  <GhostButton onClick={() => toggleSectionVisibility(s)}>{s.isVisible ? t.islamic.hide : t.islamic.show}</GhostButton>
                  <GhostButton onClick={() => deleteSection(s)} style={{ color: "#fca5a5" }}>{t.islamic.delete}</GhostButton>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                {s.categories.map((c) => (
                  <div key={c.id} style={{
                    background: activeCat?.id === c.id ? "#fef3c7" : "#ffffff",
                    borderRadius: 12, padding: 12,
                    border: activeCat?.id === c.id ? `2px solid ${ISLAMIC_GOLD}` : "1.5px solid #e8d8b8",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: "#1c1208" }}>{c.name} {!c.isVisible && <span style={{ fontSize: 11, color: "#b45309", fontWeight: 400 }}>(مخفي)</span>}</div>
                    <div style={{ fontSize: 12, color: "#78716c", marginBottom: 8 }}>{c.questionCount} {t.islamic.questions}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button onClick={() => openCategory(c)} style={{ background: activeCat?.id === c.id ? "#92400e" : ISLAMIC_GOLD, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>
                        {activeCat?.id === c.id ? `✓ ${t.islamic.open}` : `📝 ${t.islamic.questions}`}
                      </button>
                      <button onClick={() => toggleCategoryVisibility(c)} style={{ background: "transparent", color: "#92400e", border: "1.5px solid #d4a96a", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>{c.isVisible ? t.islamic.hide : t.islamic.show}</button>
                      <button onClick={() => deleteCategory(c)} style={{ background: "transparent", color: "#b91c1c", border: "1.5px solid #fca5a5", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>{t.islamic.delete}</button>
                    </div>
                  </div>
                ))}
              </div>
            </IslamicCard>
          ))}

          {activeCat && (
            <div ref={questionsPanelRef} style={{ scrollMarginTop: 16 }}>
            <IslamicCard style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: 20, color: "#92400e", fontWeight: 900, margin: 0 }}>
                    📝 {activeCat.name}
                  </h3>
                  <div style={{ fontSize: 13, color: "#78716c", marginTop: 4 }}>
                    {questions.length} {t.islamic.questions}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <GoldButton onClick={() => setEditing({ optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "", questionText: "", difficulty: "medium" })}>+ {t.islamic.newQuestion}</GoldButton>
                  <GhostButton onClick={() => setActiveCat(null)}>✕ {t.islamic.close}</GhostButton>
                </div>
              </div>
              {questions.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#a8a29e", fontSize: 14 }}>
                  {t.islamic.noQuestions}
                </div>
              )}
              {questions.map((q) => (
                <div key={q.id} style={{ borderBottom: "1px solid #e8d8b8", padding: "12px 0" }}>
                  <div style={{ fontWeight: 600, color: "#1c1208" }}>{q.questionText}</div>
                  <div style={{ fontSize: 13, color: "#78716c", marginTop: 4 }}>
                    {t.islamic.correctAnswer}: <strong style={{ color: "#16a34a" }}>{q.correctAnswer}</strong>
                    {" · "}{q.difficulty}
                    {q.audioUrl && <span style={{ marginRight: 6, background: "#fef3c7", color: "#b45309", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>🔊 صوتي</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <GhostButton onClick={() => setEditing(q)}>{t.islamic.edit}</GhostButton>
                    <GhostButton onClick={() => deleteQuestion(q)} style={{ color: "#b91c1c", borderColor: "#fca5a5" }}>{t.islamic.delete}</GhostButton>
                  </div>
                </div>
              ))}
            </IslamicCard>
            </div>
          )}

          {editing && activeCat && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditing(null)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "#fffbf0", borderRadius: 20, padding: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid rgba(180,83,9,0.3)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <h3 style={{ fontSize: 18, color: "#92400e", fontWeight: 900, marginBottom: 12 }}>{editing.id ? t.islamic.edit : t.islamic.newQuestion}</h3>
                <textarea placeholder={t.islamic.questionText} value={editing.questionText || ""} onChange={(e) => setEditing({ ...editing, questionText: e.target.value })} style={inpStyle} rows={3} />
                {[
                  { label: `${t.islamic.option} A`, key: "optionA" as const },
                  { label: `${t.islamic.option} B`, key: "optionB" as const },
                  { label: `${t.islamic.option} C`, key: "optionC" as const },
                  { label: `${t.islamic.option} D`, key: "optionD" as const },
                ].map(({ label, key }) => (
                  <input key={key} placeholder={label} value={(editing as any)[key] || ""} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} style={inpStyle} />
                ))}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#92400e", fontWeight: 700, marginBottom: 6 }}>{t.islamic.correctAnswer}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "A", val: editing.optionA },
                      { label: "B", val: editing.optionB },
                      { label: "C", val: editing.optionC },
                      { label: "D", val: editing.optionD },
                    ].map(({ label, val }) =>
                      val ? (
                        <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: editing.correctAnswer === val ? "#dcfce7" : "#fff", border: editing.correctAnswer === val ? "1.5px solid #16a34a" : "1.5px solid #e8d8b8" }}>
                          <input type="radio" name="correctAnswer" value={val} checked={editing.correctAnswer === val} onChange={() => setEditing({ ...editing, correctAnswer: val })} style={{ accentColor: "#16a34a" }} />
                          <span style={{ color: "#92400e", fontWeight: 700, minWidth: 20 }}>{label}</span>
                          <span style={{ fontSize: 14, color: "#1c1208" }}>{val}</span>
                        </label>
                      ) : null
                    )}
                  </div>
                </div>
                <select value={editing.difficulty || "medium"} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })} style={inpStyle}>
                  <option value="easy">{t.islamic.easy}</option><option value="medium">{t.islamic.medium}</option><option value="hard">{t.islamic.hard}</option>
                </select>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 13, color: "#92400e", fontWeight: 700, display: "block", marginBottom: 6 }}>
                    🔊 {t.islamic.optionalAudio}
                  </label>
                  <AudioPicker
                    value={editing.audioUrl || null}
                    onChange={(url) => setEditing({ ...editing, audioUrl: url || undefined })}
                    uploadEndpoint="/api/islamic/uploads/audio-url"
                  />
                </div>
                {saveError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
                    padding: "10px 14px", marginBottom: 12, color: "#b91c1c", fontWeight: 600, fontSize: 14 }}>
                    ⚠️ {saveError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                  <GhostButton onClick={() => { setEditing(null); setSaveError(""); }}>{t.islamic.cancel}</GhostButton>
                  <GoldButton onClick={saveQuestion}>{t.islamic.save}</GoldButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "permissions" && isAdmin && (
        <IslamicCard>
          <h3 style={{ fontSize: 20, marginBottom: 12, color: ISLAMIC_GOLD }}>{t.islamic.grantPermission}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder={t.islamic.searchTeacher} style={inpStyle} />
            <GoldButton onClick={searchTeachers}>{t.islamic.search}</GoldButton>
          </div>
          {searchResults.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(217,119,6,0.15)" }}>
              <div>{r.name} <span style={{ opacity: 0.7, fontSize: 13 }}>{r.email}</span></div>
              <GoldButton onClick={() => grant(r.id)}>{t.islamic.grant}</GoldButton>
            </div>
          ))}
          <h4 style={{ marginTop: 24, fontSize: 18, color: ISLAMIC_GOLD }}>{t.islamic.currentPermissions}</h4>
          {permissions.length === 0 && <p style={{ opacity: 0.7 }}>{t.islamic.noPermissions}</p>}
          {permissions.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(217,119,6,0.15)" }}>
              <div>{p.teacherName} <span style={{ opacity: 0.7, fontSize: 13 }}>{p.teacherEmail}</span> {!p.isActive && `(${t.islamic.inactive})`}</div>
              {p.isActive && <GhostButton onClick={() => revoke(p.teacherId)} style={{ color: "#fca5a5" }}>{t.islamic.revoke}</GhostButton>}
            </div>
          ))}
        </IslamicCard>
      )}

      {tab === "import" && (
        <IslamicCard>
          <h3 style={{ fontSize: 20, color: ISLAMIC_GOLD, marginBottom: 12 }}>{t.islamic.importQuestions}</h3>
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
            >{t.islamic.downloadTemplate}</a>
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
  background: "#fff",
  color: "#1c1208",
  border: "1px solid #e8d8b8",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 8,
  fontFamily: "inherit",
  fontSize: 15,
  boxSizing: "border-box",
};
