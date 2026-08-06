import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  MessageSquare, Trash2, PlayCircle, Clock, Sparkles, ArrowRight, Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface QEntry {
  id: number;
  topic: string;
  created_at: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SmartBoardHistory() {
  const [, navigate] = useLocation();
  const [entries, setEntries] = useState<QEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/whiteboard/lessons?type=ask`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setEntries(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function replayEntry(id: number) {
    setReplaying(id);
    try {
      const res = await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const plan = data.lesson?.plan ?? data.lesson;
      sessionStorage.setItem("whiteboard_ask_plan", JSON.stringify(plan));
      navigate("/teacher/smart-board/present/ask");
    } catch {
      alert("تعذّر تحميل السؤال — حاول مجدداً");
    } finally {
      setReplaying(null);
    }
  }

  async function deleteEntry(id: number) {
    if (!confirm("حذف هذا السؤال نهائياً؟")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { method: "DELETE", credentials: "include" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 16px 48px" }} dir="rtl">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <button
            onClick={() => navigate("/teacher/smart-board")}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 9, padding: "7px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", color: "var(--muted-foreground)",
            }}
          >
            <ArrowRight size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>
              سجل أسئلة السبورة الذكية
            </h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: "3px 0 0" }}>
              أسئلة طُرحت سابقاً — اضغط "اعرض مجدداً" لفتحها على السبورة فوراً
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
            <Loader2 size={32} style={{ opacity: 0.4, marginBottom: 10, animation: "spin 1s linear infinite" }} />
            <p style={{ margin: 0 }}>جارٍ التحميل…</p>
          </div>
        ) : entries.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 24px",
            border: "2px dashed var(--border)", borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>💬</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>لا توجد أسئلة مسجّلة بعد</h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 22 }}>
              كل سؤال تطرحه على السبورة الذكية يُحفظ هنا تلقائياً
            </p>
            <button
              onClick={() => navigate("/teacher/smart-board")}
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "white", border: "none", borderRadius: 10,
                padding: "11px 26px", cursor: "pointer",
                fontFamily: "'Tajawal',sans-serif", fontSize: 15, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}
            >
              <Sparkles size={17} />
              اطرح سؤالاً الآن
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "14px 18px",
                  display: "flex", alignItems: "center", gap: 14,
                }}
              >
                {/* Icon */}
                <div style={{
                  background: "rgba(99,102,241,0.1)", borderRadius: 10,
                  padding: 10, flexShrink: 0,
                }}>
                  <MessageSquare size={18} color="#6366f1" />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14, color: "var(--foreground)",
                    marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {entry.topic}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--muted-foreground)", fontSize: 12 }}>
                    <Clock size={11} />
                    <span>{formatDate(entry.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => replayEntry(entry.id)}
                    disabled={replaying === entry.id}
                    title="اعرض مجدداً"
                    style={{
                      background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                      color: "white", border: "none", borderRadius: 9,
                      padding: "8px 14px", cursor: replaying === entry.id ? "not-allowed" : "pointer",
                      fontFamily: "'Tajawal',sans-serif", fontWeight: 700, fontSize: 13,
                      display: "flex", alignItems: "center", gap: 6,
                      opacity: replaying === entry.id ? 0.7 : 1,
                    }}
                  >
                    {replaying === entry.id
                      ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      : <PlayCircle size={14} />}
                    اعرض مجدداً
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    title="حذف"
                    style={{
                      background: "transparent", color: "#ef4444",
                      border: "1px solid #fecaca", borderRadius: 9,
                      padding: "8px 10px", cursor: deleting === entry.id ? "not-allowed" : "pointer",
                      opacity: deleting === entry.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
