import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, AlertTriangle, MessageSquare, User, BookOpen, Send, Loader2, Clock, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.VITE_API_URL || "";

const C = {
  green: "#1E4D35", greenLight: "#2d7050", gold: "#C9A050",
  bg: "#F0EDE7", card: "#FFFFFF", surface: "#F7F5F1",
  border: "#E5E0D8", text: "#1a1a1a", muted: "#666",
};

interface Reply {
  id: number; sender: "teacher" | "parent"; body: string; createdAt: string;
}

interface MessageData {
  id: number; subject: string; body: string; parentName: string | null;
  sentAt: string; readAt: string | null; replyText: string | null; repliedAt: string | null;
  tokenExpiresAt: string; expired: boolean;
  studentName: string; studentClass: string | null; gradeLevel: string | null;
  teacherName: string; replies: Reply[];
}

export default function ParentPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<MessageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [localReplies, setLocalReplies] = useState<Reply[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/parent-portal/${token}`)
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "الرابط غير صالح"); }
        return r.json();
      })
      .then(d => { setData(d); setLocalReplies(d.replies || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleReply() {
    if (!replyText.trim() || !token) return;
    setSending(true);
    try {
      const r = await fetch(`${BASE}/api/parent-portal/${token}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || "حدث خطأ"); }
      setLocalReplies(prev => [...prev, { id: Date.now(), sender: "parent", body: replyText.trim(), createdAt: new Date().toISOString() }]);
      setReplyText("");
      setSent(true);
    } catch (e: any) { alert(e.message || "حدث خطأ أثناء الإرسال"); }
    finally { setSending(false); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} style={{ color: C.green, animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: "rtl" }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 32, maxWidth: 420, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <AlertTriangle size={40} style={{ color: "#e53e3e", margin: "0 auto 16px", display: "block" }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>الرابط غير صالح</h2>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const classInfo = [data.gradeLevel, data.studentClass].filter(Boolean).join(" — ");
  const greeting = data.parentName ? data.parentName : "ولي الأمر الكريم";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Tajawal', sans-serif", direction: "rtl" }}>
      {/* Header */}
      <div style={{ background: C.green, padding: "18px 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.gold, letterSpacing: 1 }}>حصاد</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>منصة التعليم التفاعلي</div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 16px" }}>

        {/* Expired banner */}
        {data.expired && (
          <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#856404" }}>
            <XCircle size={16} style={{ flexShrink: 0 }} />
            انتهت صلاحية هذا الرابط — يمكنك مشاهدة المحادثة فقط
          </div>
        )}

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: C.card, borderRadius: 14, padding: "18px 22px", marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>السلام عليكم</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{greeting}</p>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
            محادثتك مع المعلم <strong style={{ color: C.text }}>{data.teacherName}</strong> بخصوص{" "}
            <strong style={{ color: C.green }}>{data.studentName}</strong>
            {classInfo ? ` (${classInfo})` : ""}
          </p>
        </motion.div>

        {/* Subject */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          style={{ background: C.card, borderRadius: 14, padding: "14px 18px", marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5 }}>الموضوع</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{data.subject}</div>
        </motion.div>

        {/* Thread — all messages in order */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{ background: C.card, borderRadius: 14, padding: "18px 20px", marginBottom: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <MessageSquare size={15} style={{ color: C.green }} /> المحادثة
          </div>

          {/* Original message */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={14} style={{ color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green }}>المعلم {data.teacherName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {new Date(data.sentAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: "14px 16px", fontSize: 14, lineHeight: 1.75, color: C.text, whiteSpace: "pre-wrap", borderRight: `4px solid ${C.gold}` }}>
              {data.body}
            </div>
          </div>

          {/* Replies */}
          {localReplies.map((reply, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: reply.sender === "teacher" ? C.green : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>
                    {reply.sender === "teacher" ? "م" : "و"}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: reply.sender === "teacher" ? C.green : "#2563eb" }}>
                    {reply.sender === "teacher" ? `المعلم ${data.teacherName}` : (data.parentName || "أنت")}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {new Date(reply.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              <div style={{
                background: reply.sender === "teacher" ? C.surface : "#f0f7ff",
                borderRadius: 10, padding: "14px 16px", fontSize: 14, lineHeight: 1.75,
                color: C.text, whiteSpace: "pre-wrap",
                borderRight: `4px solid ${reply.sender === "teacher" ? C.gold : "#3b82f6"}`,
              }}>
                {reply.body}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Reply input */}
        {!data.expired ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            style={{ background: C.card, borderRadius: 14, padding: "18px 20px", border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <CheckCircle size={32} style={{ color: C.green, margin: "0 auto 10px", display: "block" }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: C.green }}>تم إرسال ردك</p>
                <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>سيصل للمعلم {data.teacherName} فور الاستلام</p>
                <button onClick={() => setSent(false)} style={{ marginTop: 12, padding: "8px 18px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
                  إضافة رد آخر
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                  <Send size={14} style={{ color: C.green }} /> ردّ على المعلم
                </h3>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} placeholder="اكتب ردك هنا..."
                  style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.surface, color: C.text, lineHeight: 1.6, transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = C.green}
                  onBlur={e => e.target.style.borderColor = C.border} />
                <button onClick={handleReply} disabled={sending || !replyText.trim()}
                  style={{ marginTop: 10, width: "100%", padding: "13px", background: C.green, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: sending || !replyText.trim() ? "not-allowed" : "pointer", opacity: sending || !replyText.trim() ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {sending ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
                  {sending ? "جارٍ الإرسال..." : "إرسال الرد"}
                </button>
              </>
            )}
          </motion.div>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: C.muted, padding: "16px 0" }}>
            <Clock size={18} style={{ margin: "0 auto 6px", display: "block", opacity: 0.4 }} />
            انتهت صلاحية الرابط ولا يمكن إضافة ردود جديدة
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 20 }}>
          منصة حصاد للتعليم التفاعلي · hasaadx.com
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
