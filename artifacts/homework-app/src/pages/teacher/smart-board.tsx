import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui-elements";
import {
  Plus, BookOpen, Trash2, PlayCircle, Clock, ChevronRight,
  Monitor, Sparkles, GraduationCap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Lesson {
  id: number;
  topic: string;
  subject?: string;
  grade_level?: string;
  level?: string;
  language: string;
  created_at: string;
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en", { year: "numeric", month: "short", day: "numeric" });
}

function SubjectBadge({ subject }: { subject?: string }) {
  if (!subject) return null;
  return (
    <span style={{
      background: "rgba(217,165,33,0.15)", color: "#D9A521",
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>{subject}</span>
  );
}

export default function SmartBoardPage() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/whiteboard/lessons`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setLessons(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function deleteLesson(id: number) {
    if (!confirm(lang === "ar" ? "حذف هذا الدرس نهائياً؟" : "Delete this lesson permanently?")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { method: "DELETE", credentials: "include" });
      setLessons(prev => prev.filter(l => l.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }} dir="rtl">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ background: "linear-gradient(135deg,#1a3a25,#2d5c3a)", borderRadius: 12, padding: 10 }}>
                <Monitor size={22} color="#4ade80" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>السبورة الذكية</h1>
            </div>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: 0 }}>
              أنشئ درسًا، راجع الخطوات، واعرضه على السبورة أمام طلابك
            </p>
          </div>
          <Button
            onClick={() => navigate("/teacher/smart-board/new")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#16a34a", color: "white", fontWeight: 700, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14 }}
          >
            <Plus size={18} />
            درس جديد
          </Button>
        </div>

        {/* Empty state / list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted-foreground)" }}>
            <Sparkles size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
            <p>جارٍ التحميل…</p>
          </div>
        ) : lessons.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "64px 24px",
            border: "2px dashed var(--border)", borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🖊️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>لا توجد دروس محفوظة بعد</h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              اكتب موضوع درس وسيُنشئ الذكاء الاصطناعي خطة شرح كاملة لعرضها على السبورة
            </p>
            <Button
              onClick={() => navigate("/teacher/smart-board/new")}
              style={{ background: "#16a34a", color: "white", fontWeight: 700, padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 15 }}
            >
              ابدأ درسك الأول
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lessons.map(lesson => (
              <div
                key={lesson.id}
                style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: 16,
                  transition: "box-shadow 0.15s",
                }}
              >
                <div style={{ background: "rgba(74,222,128,0.1)", borderRadius: 10, padding: 10, flexShrink: 0 }}>
                  <BookOpen size={20} color="#4ade80" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>{lesson.topic}</span>
                    <SubjectBadge subject={lesson.subject} />
                    {lesson.grade_level && (
                      <span style={{
                        background: "rgba(99,102,241,0.12)", color: "#6366f1",
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                      }}>{lesson.grade_level}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted-foreground)", fontSize: 12 }}>
                    <Clock size={12} />
                    <span>{formatDate(lesson.created_at, lang)}</span>
                    {lesson.level && (
                      <>
                        <span>·</span>
                        <span>{{ brief: "موجز", standard: "عادي", detailed: "تفصيلي" }[lesson.level as string] ?? lesson.level}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/teacher/smart-board/present/${lesson.id}`)}
                    title="عرض الدرس"
                    style={{
                      background: "linear-gradient(135deg,#166534,#16a34a)",
                      color: "white", border: "none", borderRadius: 9,
                      padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <PlayCircle size={16} />
                    عرض
                  </button>
                  <button
                    onClick={() => navigate(`/teacher/smart-board/edit/${lesson.id}`)}
                    title="تعديل الدرس"
                    style={{
                      background: "transparent", color: "var(--muted-foreground)",
                      border: "1px solid var(--border)", borderRadius: 9,
                      padding: "8px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5, fontSize: 13,
                    }}
                  >
                    <GraduationCap size={15} />
                    تعديل
                  </button>
                  <button
                    onClick={() => deleteLesson(lesson.id)}
                    disabled={deleting === lesson.id}
                    title="حذف"
                    style={{
                      background: "transparent", color: "#ef4444",
                      border: "1px solid #fecaca", borderRadius: 9,
                      padding: "8px 10px", cursor: "pointer",
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        {lessons.length === 0 && (
          <div style={{ marginTop: 48 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 16, textAlign: "center" }}>كيف تعمل السبورة الذكية؟</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { icon: "✍️", title: "اكتب موضوع الدرس", desc: "حدد المادة والصف وعمق الشرح" },
                { icon: "🤖", title: "يُنشئ الذكاء الاصطناعي", desc: "خطة درس كاملة بخطوات وشرح صوتي" },
                { icon: "✏️", title: "راجع وعدّل", desc: "تحكم في كل خطوة قبل البدء" },
                { icon: "🖊️", title: "اعرض على الفصل", desc: "كتابة تدريجية مع إمكانية الرسم فوق السبورة" },
              ].map((item, i) => (
                <div key={i} style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "16px 14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
